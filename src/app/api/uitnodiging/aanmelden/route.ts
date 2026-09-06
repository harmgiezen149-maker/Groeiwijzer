import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse, readJson } from '@/lib/api';
import {
  acceptInvite,
  getInvite,
  getUserByEmail,
  setPasswordHash,
  upsertUser,
} from '@/lib/garden';
import { hashPassword, wachtwoordProbleem } from '@/lib/password';
import { assertWithinLimit } from '@/lib/ratelimit';
import { parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';

const input = z.object({
  token: z.string().trim().min(8).max(64),
  name: z.string().trim().max(80).optional(),
  password: z.string().min(1).max(200),
});

/**
 * Een account maken met een zelfgekozen wachtwoord, alleen op vertoon van een
 * geldige uitnodiging. Er is dus geen open registratie: de uitnodiging is het
 * bewijs dat de tuineigenaar dit adres binnen wil hebben (§3).
 *
 * Bestaat het adres al, dan gebeurt er hier niets: die persoon logt in zoals
 * altijd en neemt de uitnodiging daarna aan. Anders zou wie de link in handen
 * krijgt een bestaand account kunnen overnemen.
 */
export async function POST(req: Request) {
  try {
    const { token, name, password } = parseOrThrow(input, await readJson(req));
    await assertWithinLimit(`invite:${token}`, 'aanmelden');

    const invite = await getInvite(token);
    if (!invite) throw fout('Deze uitnodiging bestaat niet meer.');
    if (invite.acceptedAt) throw fout('Deze uitnodiging is al gebruikt.');
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      throw fout('Deze uitnodiging is verlopen. Vraag om een nieuwe.');
    }

    if (await getUserByEmail(invite.email)) {
      throw fout(
        'Er bestaat al een account met dit e-mailadres. Log daarmee in; de uitnodiging wordt dan aangenomen.',
        409,
      );
    }

    const probleem = wachtwoordProbleem(password, invite.email);
    if (probleem) throw fout(probleem);

    const user = await upsertUser({ email: invite.email, name: name || undefined });
    // Eerst lid maken, dan pas inloggen: zo start ze meteen in deze tuin in
    // plaats van in een lege eigen tuin.
    const resultaat = await acceptInvite(token, user);
    if (!resultaat.ok) throw fout('Deze uitnodiging kon niet aangenomen worden.');
    await setPasswordHash(user.id, await hashPassword(password));

    return NextResponse.json({ ok: true, email: user.email });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function fout(bericht: string, status = 400) {
  return Object.assign(new Error(bericht), { status });
}
