import { NextResponse } from 'next/server';
import { assertMember } from '@/lib/garden';
import { findPlantByLabel } from '@/lib/plants';
import { currentUser } from '@/lib/session';
import { isLabelCode } from '@/lib/ids';

export const runtime = 'nodejs';

/**
 * Doorverwijzing na het scannen van een QR-label. Zonder geldige sessie
 * eerst inloggen, daarna alsnog naar de plant (§9).
 */
export async function GET(
  req: Request,
  segment: { params: Promise<{ gardenId: string; labelCode: string }> },
) {
  const { gardenId, labelCode } = await segment.params;
  const hier = new URL(req.url);
  const terug = `/q/${gardenId}/${labelCode}`;

  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(terug)}`, hier),
    );
  }

  if (!isLabelCode(labelCode)) {
    return NextResponse.redirect(new URL('/planten?label=onbekend', hier));
  }

  try {
    await assertMember(user.id, gardenId);
  } catch {
    return NextResponse.redirect(new URL('/planten?label=geentoegang', hier));
  }

  const plant = await findPlantByLabel(gardenId, labelCode);
  if (!plant) {
    return NextResponse.redirect(new URL('/planten?label=onbekend', hier));
  }
  return NextResponse.redirect(new URL(`/planten/${plant.id}`, hier));
}
