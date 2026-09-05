import { afterEach, describe, expect, it } from 'vitest';
import { decode, upstashConfig } from './redis';

const SLEUTELS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
] as const;

function leeg() {
  for (const sleutel of SLEUTELS) delete process.env[sleutel];
}

afterEach(leeg);

describe('upstashConfig', () => {
  it('herkent de namen van Upstash zelf', () => {
    leeg();
    process.env.UPSTASH_REDIS_REST_URL = 'https://voorbeeld.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'geheim';
    expect(upstashConfig()).toEqual({
      url: 'https://voorbeeld.upstash.io',
      token: 'geheim',
    });
  });

  it('herkent ook de KV-namen van de Vercel-integratie', () => {
    // De Upstash-integratie in de marktplaats van Vercel zet dezelfde
    // database neer onder KV_REST_API_*. Zonder dit zou de app denken dat er
    // geen database is en stilletjes in een tijdelijke store schrijven.
    leeg();
    process.env.KV_REST_API_URL = 'https://voorbeeld.upstash.io';
    process.env.KV_REST_API_TOKEN = 'geheim';
    expect(upstashConfig()).toEqual({
      url: 'https://voorbeeld.upstash.io',
      token: 'geheim',
    });
  });

  it('geeft de eigen namen voorrang als beide er staan', () => {
    leeg();
    process.env.UPSTASH_REDIS_REST_URL = 'https://eigen.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'eigen';
    process.env.KV_REST_API_URL = 'https://kv.upstash.io';
    process.env.KV_REST_API_TOKEN = 'kv';
    expect(upstashConfig()?.url).toBe('https://eigen.upstash.io');
  });

  it('geeft niets terug bij een half ingevulde koppeling', () => {
    leeg();
    process.env.KV_REST_API_URL = 'https://voorbeeld.upstash.io';
    expect(upstashConfig()).toBeNull();
  });
});

describe('decode', () => {
  it('leest zowel een JSON-string als een al geparsed object', () => {
    expect(decode<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(decode<{ a: number }>({ a: 1 })).toEqual({ a: 1 });
    expect(decode('gewoon tekst')).toBe('gewoon tekst');
    expect(decode(null)).toBeNull();
  });
});
