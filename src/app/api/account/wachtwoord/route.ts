import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse, readJson } from '@/lib/api';
import { getPasswordHash, setPasswordHash } from '@/lib/garden';
import { hashPassword, verifyPassword, wachtwoordProbleem } from '@/lib/password';
import { requireUser } from '@/lib/session';
import { parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';

const input = z.object({
  huidig: z.string().max(200).optional(),
  nieuw: z.string().min(1).max(200),
});

/**
 * Een wachtwoord zetten of wijzigen voor jezelf. Wie er al een heeft, moet het
 * oude meesturen: anders zou een openstaand scherm genoeg zijn om iemand
 * buiten te sluiten.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { huidig, nieuw } = parseOrThrow(input, await readJson(req));

    const bestaand = await getPasswordHash(user.id);
    if (bestaand && !(huidig && (await verifyPassword(huidig, bestaand)))) {
      throw Object.assign(new Error('Het huidige wachtwoord klopt niet.'), { status: 400 });
    }

    const probleem = wachtwoordProbleem(nieuw, user.email);
    if (probleem) throw Object.assign(new Error(probleem), { status: 400 });

    await setPasswordHash(user.id, await hashPassword(nieuw));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ ingesteld: Boolean(await getPasswordHash(user.id)) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
