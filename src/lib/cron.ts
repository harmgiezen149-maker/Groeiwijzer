import 'server-only';
import { NextResponse } from 'next/server';

/**
 * Cron-routes draaien zonder sessie en zijn daarom afgeschermd met een
 * gedeeld geheim (§8.3). Vercel stuurt dat mee als bearer-token.
 */
export function assertCronRequest(req: Request): void {
  const geheim = process.env.CRON_SECRET;
  if (!geheim) {
    throw Object.assign(new Error('CRON_SECRET ontbreekt in de omgeving.'), { status: 503 });
  }
  const header = req.headers.get('authorization') ?? '';
  if (header !== `Bearer ${geheim}`) {
    throw Object.assign(new Error('Geen toegang.'), { status: 401 });
  }
}

export function withCron<T>(handler: (req: Request) => Promise<T>) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      assertCronRequest(req);
      return NextResponse.json((await handler(req)) ?? { ok: true });
    } catch (error) {
      const status = (error as { status?: number }).status ?? 500;
      const message = error instanceof Error ? error.message : 'Er ging iets mis';
      if (status >= 500) console.error('[bloeiwijzer] cron mislukt', error);
      return NextResponse.json({ error: message }, { status });
    }
  };
}
