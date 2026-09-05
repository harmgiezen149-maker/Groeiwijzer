import 'server-only';
import { NextResponse } from 'next/server';
import { ForbiddenError, NotFoundError } from './garden';
import { UnauthorizedError, requireContext, type Context } from './session';

export type Handler<T> = (ctx: Context, req: Request) => Promise<T>;

interface ErrorLike {
  status?: number;
  message?: string;
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  const e = error as ErrorLike;
  if (typeof e?.status === 'number' && e.status >= 400 && e.status < 500) {
    return NextResponse.json({ error: e.message ?? 'Verzoek geweigerd' }, { status: e.status });
  }
  console.error('[bloeiwijzer] onverwachte fout', error);
  return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
}

/**
 * Elke route: sessie, daarna assertMember op de actieve tuin (§12).
 * Een gardenId uit de request wordt alleen geaccepteerd na die controle.
 */
export function withGarden<T>(handler: Handler<T>) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      const url = new URL(req.url);
      const requested = url.searchParams.get('gardenId') ?? undefined;
      const ctx = await requireContext(requested);
      const result = await handler(ctx, req);
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw Object.assign(new Error('Ongeldige invoer'), { status: 400 });
  }
}

/** Variant voor routes met dynamische segmenten. */
export function withGardenParams<P, T>(
  handler: (ctx: Context, req: Request, params: P) => Promise<T>,
) {
  return async (req: Request, segment: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      const url = new URL(req.url);
      const requested = url.searchParams.get('gardenId') ?? undefined;
      const ctx = await requireContext(requested);
      const result = await handler(ctx, req, await segment.params);
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
