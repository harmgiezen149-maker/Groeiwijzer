import 'server-only';
import { Redis } from '@upstash/redis';

/**
 * Smalle Redis-laag. Productie draait op Upstash Redis (REST).
 * Zonder UPSTASH_*-variabelen valt de app terug op een lokale store in
 * `.dev-data/redis.json`, zodat er zonder sleutels ontwikkeld kan worden.
 * De fallback is nadrukkelijk niet voor productie: hij is niet gedeeld
 * tussen instanties.
 */
export interface Store {
  hget<T>(key: string, field: string): Promise<T | null>;
  hgetall<T>(key: string): Promise<Record<string, T>>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  hsetMany(key: string, entries: Record<string, unknown>): Promise<void>;
  hdel(key: string, ...fields: string[]): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ttlSeconds?: number }): Promise<void>;
  del(...keys: string[]): Promise<void>;
  sadd(key: string, ...members: string[]): Promise<void>;
  srem(key: string, ...members: string[]): Promise<void>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<boolean>;
  lpush(key: string, ...values: unknown[]): Promise<void>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

/** Upstash geeft soms al een geparsed object terug; soms een JSON-string. */
export function decode<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
  return value as T;
}

function encode(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

class UpstashStore implements Store {
  constructor(private readonly redis: Redis) {}

  async hget<T>(key: string, field: string) {
    return decode<T>(await this.redis.hget(key, field));
  }
  async hgetall<T>(key: string) {
    const raw = (await this.redis.hgetall(key)) as Record<string, unknown> | null;
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      const parsed = decode<T>(v);
      if (parsed !== null) out[k] = parsed;
    }
    return out;
  }
  async hset(key: string, field: string, value: unknown) {
    await this.redis.hset(key, { [field]: encode(value) });
  }
  async hsetMany(key: string, entries: Record<string, unknown>) {
    if (Object.keys(entries).length === 0) return;
    const mapped: Record<string, string> = {};
    for (const [k, v] of Object.entries(entries)) mapped[k] = encode(v);
    await this.redis.hset(key, mapped);
  }
  async hdel(key: string, ...fields: string[]) {
    if (fields.length) await this.redis.hdel(key, fields[0], ...fields.slice(1));
  }
  async get<T>(key: string) {
    return decode<T>(await this.redis.get(key));
  }
  async set(key: string, value: unknown, opts?: { ttlSeconds?: number }) {
    if (opts?.ttlSeconds) await this.redis.set(key, encode(value), { ex: opts.ttlSeconds });
    else await this.redis.set(key, encode(value));
  }
  async del(...keys: string[]) {
    if (keys.length) await this.redis.del(keys[0], ...keys.slice(1));
  }
  async sadd(key: string, ...members: string[]) {
    if (members.length) await this.redis.sadd(key, members[0], ...members.slice(1));
  }
  async srem(key: string, ...members: string[]) {
    if (members.length) await this.redis.srem(key, members[0], ...members.slice(1));
  }
  async smembers(key: string) {
    return ((await this.redis.smembers(key)) ?? []).map(String);
  }
  async sismember(key: string, member: string) {
    return (await this.redis.sismember(key, member)) === 1;
  }
  async lpush(key: string, ...values: unknown[]) {
    if (!values.length) return;
    const encoded = values.map(encode);
    await this.redis.lpush(key, encoded[0], ...encoded.slice(1));
  }
  async lrange<T>(key: string, start: number, stop: number) {
    const raw = (await this.redis.lrange(key, start, stop)) ?? [];
    return raw.map((v) => decode<T>(v)).filter((v): v is T => v !== null);
  }
  async ltrim(key: string, start: number, stop: number) {
    await this.redis.ltrim(key, start, stop);
  }
  async keys(pattern: string) {
    return (await this.redis.keys(pattern)) ?? [];
  }
}

type MemValue =
  | { t: 'string'; v: string; exp?: number }
  | { t: 'hash'; v: Record<string, string> }
  | { t: 'set'; v: string[] }
  | { t: 'list'; v: string[] };

class MemoryStore implements Store {
  private data = new Map<string, MemValue>();
  private file: string | null = null;
  private loaded = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(file: string | null) {
    this.file = file;
  }

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.file) return;
    try {
      const fs = await import('node:fs/promises');
      const raw = await fs.readFile(this.file, 'utf8');
      this.data = new Map(Object.entries(JSON.parse(raw) as Record<string, MemValue>));
    } catch {
      /* nog geen bestand */
    }
  }

  private save() {
    if (!this.file) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      try {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        await fs.mkdir(path.dirname(this.file!), { recursive: true });
        await fs.writeFile(this.file!, JSON.stringify(Object.fromEntries(this.data)), 'utf8');
      } catch {
        /* dev-only, mag stilletjes falen */
      }
    }, 50);
    this.saveTimer.unref?.();
  }

  private async entry(key: string): Promise<MemValue | undefined> {
    await this.load();
    const e = this.data.get(key);
    if (e && e.t === 'string' && e.exp && e.exp < Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  private async hash(key: string) {
    const e = await this.entry(key);
    if (e?.t === 'hash') return e.v;
    const v: Record<string, string> = {};
    this.data.set(key, { t: 'hash', v });
    return v;
  }

  async hget<T>(key: string, field: string) {
    return decode<T>((await this.hash(key))[field] ?? null);
  }
  async hgetall<T>(key: string) {
    const h = await this.hash(key);
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(h)) {
      const parsed = decode<T>(v);
      if (parsed !== null) out[k] = parsed;
    }
    return out;
  }
  async hset(key: string, field: string, value: unknown) {
    (await this.hash(key))[field] = encode(value);
    this.save();
  }
  async hsetMany(key: string, entries: Record<string, unknown>) {
    const h = await this.hash(key);
    for (const [k, v] of Object.entries(entries)) h[k] = encode(v);
    this.save();
  }
  async hdel(key: string, ...fields: string[]) {
    const h = await this.hash(key);
    for (const f of fields) delete h[f];
    this.save();
  }
  async get<T>(key: string) {
    const e = await this.entry(key);
    return e?.t === 'string' ? decode<T>(e.v) : null;
  }
  async set(key: string, value: unknown, opts?: { ttlSeconds?: number }) {
    await this.load();
    this.data.set(key, {
      t: 'string',
      v: encode(value),
      exp: opts?.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : undefined,
    });
    this.save();
  }
  async del(...keys: string[]) {
    await this.load();
    for (const k of keys) this.data.delete(k);
    this.save();
  }
  private async set_(key: string) {
    const e = await this.entry(key);
    if (e?.t === 'set') return e.v;
    const v: string[] = [];
    this.data.set(key, { t: 'set', v });
    return v;
  }
  async sadd(key: string, ...members: string[]) {
    const s = await this.set_(key);
    for (const m of members) if (!s.includes(m)) s.push(m);
    this.save();
  }
  async srem(key: string, ...members: string[]) {
    const s = await this.set_(key);
    for (const m of members) {
      const i = s.indexOf(m);
      if (i >= 0) s.splice(i, 1);
    }
    this.save();
  }
  async smembers(key: string) {
    return [...(await this.set_(key))];
  }
  async sismember(key: string, member: string) {
    return (await this.set_(key)).includes(member);
  }
  private async list(key: string) {
    const e = await this.entry(key);
    if (e?.t === 'list') return e.v;
    const v: string[] = [];
    this.data.set(key, { t: 'list', v });
    return v;
  }
  async lpush(key: string, ...values: unknown[]) {
    const l = await this.list(key);
    l.unshift(...values.map(encode));
    this.save();
  }
  async lrange<T>(key: string, start: number, stop: number) {
    const l = await this.list(key);
    const end = stop < 0 ? l.length + stop + 1 : stop + 1;
    return l
      .slice(start, end)
      .map((v) => decode<T>(v))
      .filter((v): v is T => v !== null);
  }
  async ltrim(key: string, start: number, stop: number) {
    const l = await this.list(key);
    const end = stop < 0 ? l.length + stop + 1 : stop + 1;
    const kept = l.slice(start, end);
    this.data.set(key, { t: 'list', v: kept });
    this.save();
  }
  async keys(pattern: string) {
    await this.load();
    const rx = new RegExp('^' + pattern.split('*').map(escapeRe).join('.*') + '$');
    return [...this.data.keys()].filter((k) => rx.test(k));
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const usingUpstash = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

let store: Store | null = null;

export function db(): Store {
  if (store) return store;
  if (usingUpstash) {
    store = new UpstashStore(
      new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
    );
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[bloeiwijzer] UPSTASH_REDIS_REST_URL/TOKEN ontbreken — er wordt een tijdelijke store gebruikt die niet blijft bestaan.',
      );
    }
    store = new MemoryStore(process.env.NODE_ENV === 'production' ? null : '.dev-data/redis.json');
  }
  return store;
}
