import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readJson, toErrorResponse } from '@/lib/api';
import { acceptInvite } from '@/lib/garden';
import { requireUser } from '@/lib/session';
import { parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';

const acceptInput = z.object({ token: z.string().trim().min(8).max(64) });

export async function POST(req: Request) {
  try {
    // Bewust niet withGarden: de gebruiker is nog geen lid van deze tuin.
    const user = await requireUser();
    const { token } = parseOrThrow(acceptInput, await readJson(req));
    const result = await acceptInvite(token, user);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
