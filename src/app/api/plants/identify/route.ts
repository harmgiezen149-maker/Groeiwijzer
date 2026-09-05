import { withGarden } from '@/lib/api';
import { requireLocation } from '@/lib/locations';
import { identifyWithPlantNet, plantnetEnabled } from '@/lib/ai/plantnet';
import { aiEnabled } from '@/lib/ai/client';
import { assertWithinLimit } from '@/lib/ratelimit';
import { MAX_UPLOAD_BYTES, sniffImage, tryStoreImage } from '@/lib/upload';
import { bewaarFotoVerwijzing } from '@/lib/photo-ref';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Stap 1 van herkennen op foto (§6.1): PlantNet bepaalt de soort en de foto
 * gaat naar de opslag. Het zorgprofiel is een aparte aanroep, want die duurt
 * te lang om er in één verzoek achteraan te hangen — samen liepen ze tegen de
 * limiet van de serverfunctie aan.
 */
export const POST = withGarden(async (ctx, req) => {
  if (!aiEnabled && !plantnetEnabled) {
    throw Object.assign(
      new Error(
        'Herkennen staat uit: er is geen ANTHROPIC_API_KEY of PLANTNET_API_KEY ingesteld. ' +
          'Vul de plant zolang zelf in.',
      ),
      { status: 503 },
    );
  }
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
  await requireLocation(ctx.garden.id, locationId);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { type } = sniffImage(bytes);

  const [plantnet, bewaard] = await Promise.all([
    identifyWithPlantNet(bytes, type),
    tryStoreImage(bytes, `tuin/${ctx.garden.id}`),
  ]);

  const photoRef = bewaard.stored
    ? await bewaarFotoVerwijzing(ctx.garden.id, bewaard.stored.url)
    : undefined;

  return {
    photoUrl: bewaard.stored?.url,
    photoRef,
    candidates: plantnet.candidates,
    notes: [plantnet.note, bewaard.note].filter(Boolean),
  };
});
