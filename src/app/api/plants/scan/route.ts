import { withGarden } from '@/lib/api';
import { requireLocation } from '@/lib/locations';
import { aiEnabled } from '@/lib/ai/client';
import { scanGardenPhoto } from '@/lib/ai/scan';
import { assertWithinLimit } from '@/lib/ratelimit';
import { MAX_UPLOAD_BYTES, sniffImage, tryStoreImage } from '@/lib/upload';
import { bewaarFotoVerwijzing } from '@/lib/photo-ref';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** De route houdt zelf een marge, zodat het antwoord vóór de limiet vertrekt. */
const MARGE_MS = 8_000;

/**
 * Een foto van een stuk tuin, met alle planten die erop staan. De gebruiker
 * loopt de lijst daarna één voor één langs; elke plant die klopt krijgt zijn
 * eigen zorgprofiel via /api/plants/suggest-care.
 */
export const POST = withGarden(async (ctx, req) => {
  const start = Date.now();
  if (!aiEnabled) {
    throw Object.assign(
      new Error('Scannen staat uit: er is geen ANTHROPIC_API_KEY ingesteld.'),
      { status: 503 },
    );
  }
  await assertWithinLimit(ctx.user.id, 'scan');

  const form = await req.formData();
  const file = form.get('file');
  const locationId = String(form.get('locationId') ?? '');
  if (!(file instanceof File)) {
    throw Object.assign(new Error('Geen foto meegestuurd.'), { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error('Foto is groter dan 5 MB.'), { status: 413 });
  }
  const location = await requireLocation(ctx.garden.id, locationId);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { type } = sniffImage(bytes);

  const [scan, bewaard] = await Promise.all([
    scanGardenPhoto({
      imageBase64: Buffer.from(bytes).toString('base64'),
      imageMediaType: type as 'image/jpeg' | 'image/png' | 'image/webp',
      outdoor: location.outdoor,
      budget: { deadline: start + (maxDuration * 1000 - MARGE_MS) },
    }),
    tryStoreImage(bytes, `tuin/${ctx.garden.id}`),
  ]);

  const photoRef = bewaard.stored
    ? await bewaarFotoVerwijzing(ctx.garden.id, bewaard.stored.url)
    : undefined;

  return {
    photoUrl: bewaard.stored?.url,
    photoRef,
    plants: scan.plants,
    notes: [scan.note, bewaard.note].filter(Boolean),
  };
});
