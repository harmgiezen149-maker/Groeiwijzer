import { withGarden, readJson } from '@/lib/api';
import { assertWithinLimit } from '@/lib/ratelimit';
import { sniffImage, tryStoreImage } from '@/lib/upload';
import { fetchPageImage } from '@/lib/url-import';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Zet een voorbeeldfoto van de herkenning in de eigen opslag. De foto's van
 * PlantNet blijven anders bij PlantNet staan; kiest de gebruiker er een als
 * plantfoto, dan hoort hij in de eigen tuin thuis. Alle controles van §13
 * lopen via fetchPageImage: alleen http en https, geen privé-adressen,
 * hooguit 5 MB.
 */
export const POST = withGarden(async (ctx, req) => {
  const { url } = await readJson<{ url?: unknown }>(req);
  if (typeof url !== 'string' || !url.trim()) {
    throw Object.assign(new Error('Geen adres meegestuurd.'), { status: 400 });
  }
  await assertWithinLimit(ctx.user.id, 'reference-photo');

  const bytes = await fetchPageImage(url.trim());
  if (!bytes) {
    throw Object.assign(new Error('Die foto kon niet opgehaald worden.'), { status: 400 });
  }
  sniffImage(bytes);

  const { stored, note } = await tryStoreImage(bytes, `tuin/${ctx.garden.id}`);
  if (!stored) {
    throw Object.assign(new Error(note ?? 'De foto kon niet bewaard worden.'), { status: 503 });
  }
  return { photoUrl: stored.url };
});
