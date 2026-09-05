import { withGarden } from '@/lib/api';
import { requireLocation } from '@/lib/locations';
import { identifyWithPlantNet } from '@/lib/ai/plantnet';
import { requestCareProfile } from '@/lib/ai/care-profile';
import { assertWithinLimit } from '@/lib/ratelimit';
import { MAX_UPLOAD_BYTES, sniffImage, storeImage } from '@/lib/upload';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Twee bronnen, één bevestiging (§6.1): PlantNet bepaalt de soort, Claude
 * krijgt de foto plus die kandidaten en levert het profiel. Beide draaien
 * parallel; valt PlantNet weg, dan gaat de rest gewoon door.
 */
export const POST = withGarden(async (ctx, req) => {
  await assertWithinLimit(ctx.user.id, 'identify');

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

  const plantnet = await identifyWithPlantNet(bytes, type);
  const [profiel, opgeslagen] = await Promise.all([
    requestCareProfile({
      outdoor: location.outdoor,
      candidates: plantnet.candidates,
      imageBase64: Buffer.from(bytes).toString('base64'),
      imageMediaType: type as 'image/jpeg' | 'image/png' | 'image/webp',
    }),
    storeImage(bytes, `tuin/${ctx.garden.id}`),
  ]);

  return {
    photoUrl: opgeslagen.url,
    candidates: plantnet.candidates,
    profile: profiel.profile,
    notes: [plantnet.note, profiel.note].filter(Boolean),
  };
});
