import { z } from 'zod';
import { withGarden, readJson } from '@/lib/api';
import { requireLocation } from '@/lib/locations';
import { requestCareProfile } from '@/lib/ai/care-profile';
import { assertWithinLimit } from '@/lib/ratelimit';
import { fetchPageImage, fetchPageText } from '@/lib/url-import';
import { sniffImage, tryStoreImage } from '@/lib/upload';
import { parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const input = z.object({
  url: z.url('Vul een geldig webadres in'),
  locationId: z.string().trim().min(1),
});

/** Marge zodat de route zelf antwoordt in plaats van in de limiet te lopen. */
const MARGE_MS = 8_000;

export const POST = withGarden(async (ctx, req) => {
  const start = Date.now();
  await assertWithinLimit(ctx.user.id, 'from-url');
  const { url, locationId } = parseOrThrow(input, await readJson(req));
  const location = await requireLocation(ctx.garden.id, locationId);

  const pagina = await fetchPageText(url);

  // De foto van de pagina en het zorgprofiel tegelijk: de foto is een extra,
  // dus als die wegvalt gaat de import gewoon door.
  const [profiel, foto] = await Promise.all([
    requestCareProfile({
      name: pagina.title,
      outdoor: location.outdoor,
      pageText: pagina.text,
      budget: { deadline: start + (maxDuration * 1000 - MARGE_MS) },
    }),
    pagina.imageUrl ? bewaarPaginafoto(ctx.garden.id, pagina.imageUrl) : null,
  ]);

  return {
    sourceUrl: url,
    pageTitle: pagina.title,
    photoUrl: foto ?? undefined,
    profile: profiel.profile,
    notes: [profiel.note].filter(Boolean),
  };
});

/** Haalt de foto op, controleert dat het echt een afbeelding is, en bewaart hem. */
async function bewaarPaginafoto(gardenId: string, imageUrl: string): Promise<string | null> {
  const bytes = await fetchPageImage(imageUrl);
  if (!bytes) return null;
  try {
    // Op de magic bytes, niet op wat de server zegt (§13).
    sniffImage(bytes);
  } catch {
    return null;
  }
  const bewaard = await tryStoreImage(bytes, `tuin/${gardenId}`);
  return bewaard.stored?.url ?? null;
}
