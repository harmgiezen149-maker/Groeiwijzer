import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { usingUpstash } from './redis';

/** Kostenbeheersing op de AI-endpoints: 20 per uur en 60 per dag (§13). */
const LIMITS = [
  { name: 'uur', max: 20, windowMs: 60 * 60 * 1000 },
  { name: 'dag', max: 60, windowMs: 24 * 60 * 60 * 1000 },
] as const;

let limiters: Ratelimit[] | null = null;

function upstashLimiters(): Ratelimit[] {
  if (limiters) return limiters;
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  limiters = [
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LIMITS[0].max, '1 h'),
      prefix: 'ratelimit:uur',
    }),
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LIMITS[1].max, '24 h'),
      prefix: 'ratelimit:dag',
    }),
  ];
  return limiters;
}

const geheugen = new Map<string, number[]>();

function geheugenCheck(key: string): boolean {
  const nu = Date.now();
  const stempels = (geheugen.get(key) ?? []).filter((t) => nu - t < LIMITS[1].windowMs);
  for (const limiet of LIMITS) {
    if (stempels.filter((t) => nu - t < limiet.windowMs).length >= limiet.max) {
      geheugen.set(key, stempels);
      return false;
    }
  }
  stempels.push(nu);
  geheugen.set(key, stempels);
  return true;
}

/** Werpt een 429 wanneer de gebruiker over de limiet gaat. */
export async function assertWithinLimit(userId: string, endpoint: string): Promise<void> {
  const key = `${userId}:${endpoint}`;
  if (usingUpstash) {
    for (const limiter of upstashLimiters()) {
      const { success } = await limiter.limit(key);
      if (!success) throw teVaak();
    }
    return;
  }
  if (!geheugenCheck(key)) throw teVaak();
}

function teVaak() {
  return Object.assign(
    new Error('Even wachten: je hebt dit te vaak achter elkaar gedaan.'),
    { status: 429 },
  );
}
