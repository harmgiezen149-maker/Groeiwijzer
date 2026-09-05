import { z } from 'zod';
import { withGarden, readJson } from '@/lib/api';
import { requireLocation } from '@/lib/locations';
import { requestCareProfile } from '@/lib/ai/care-profile';
import { assertWithinLimit } from '@/lib/ratelimit';
import { parseOrThrow } from '@/lib/validation';
import { haalFotoVerwijzing, isBlobUrl } from '@/lib/photo-ref';
import { MAX_UPLOAD_BYTES, sniffImage } from '@/lib/upload';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** De route houdt zelf een marge, zodat het antwoord vóór de limiet vertrekt. */
const MARGE_MS = 8_000;

const input = z.object({
  name: z.string().trim().max(120).optional(),
  category: z.string().trim().max(40).optional(),
  locationId: z.string().trim().min(1),
  /** Verwijzing naar de foto uit /api/plants/identify. */
  photoRef: z.string().trim().max(64).optional(),
  candidates: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        scientificName: z.string().trim().max(160).optional(),
        score: z.coerce.number().min(0).max(1).default(0),
      }),
    )
    .max(5)
    .optional(),
});

/**
 * Stap 2: het onderhoudsvoorstel. Werkt met een naam (zelf invullen) of met de
 * foto en kandidaten uit stap 1. De foto wordt opgehaald via de verwijzing die
 * de app zelf heeft uitgegeven, nooit via een adres uit de browser (§13).
 */
export const POST = withGarden(async (ctx, req) => {
  const start = Date.now();
  await assertWithinLimit(ctx.user.id, 'suggest-care');
  const gegevens = parseOrThrow(input, await readJson(req));
  if (!gegevens.name && !gegevens.photoRef) {
    throw Object.assign(new Error('Vul eerst een naam in.'), { status: 400 });
  }
  const location = await requireLocation(ctx.garden.id, gegevens.locationId);

  const foto = gegevens.photoRef
    ? await haalFoto(ctx.garden.id, gegevens.photoRef)
    : null;

  return requestCareProfile({
    name: gegevens.name,
    category: gegevens.category,
    outdoor: location.outdoor,
    candidates: gegevens.candidates?.map((c) => ({ ...c, source: 'plantnet' })),
    imageBase64: foto?.base64,
    imageMediaType: foto?.mediaType,
    budget: { deadline: start + (maxDuration * 1000 - MARGE_MS) },
  });
});

/** Haalt de bewaarde foto op. Lukt dat niet, dan gaat het profiel zonder beeld. */
async function haalFoto(
  gardenId: string,
  ref: string,
): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' } | null> {
  const url = await haalFotoVerwijzing(gardenId, ref);
  if (!url || !isBlobUrl(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) return null;
    const { type } = sniffImage(bytes);
    return {
      base64: Buffer.from(bytes).toString('base64'),
      mediaType: type as 'image/jpeg' | 'image/png' | 'image/webp',
    };
  } catch (error) {
    console.warn('[bloeiwijzer] foto ophalen voor profiel mislukt', error);
    return null;
  }
}
