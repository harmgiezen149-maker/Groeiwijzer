import { get } from '@vercel/blob';
import { toErrorResponse } from '@/lib/api';
import { requireContext } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Serveert een foto uit een besloten Blob-opslag. Het pad begint met de
 * gardenId, en die gaat door dezelfde controle als elke andere route: wie
 * geen lid is van die tuin, ziet de foto niet (§12).
 */
export async function GET(_req: Request, segment: { params: Promise<{ pad: string[] }> }) {
  try {
    const { pad } = await segment.params;
    const [map, gardenId, ...rest] = pad;
    if (map !== 'tuin' || !gardenId || rest.length === 0) {
      throw Object.assign(new Error('Onbekende foto.'), { status: 404 });
    }
    await requireContext(gardenId);

    const gevonden = await get(pad.join('/'), { access: 'private' });
    if (!gevonden || gevonden.statusCode !== 200) {
      throw Object.assign(new Error('Foto niet gevonden.'), { status: 404 });
    }

    return new Response(gevonden.stream, {
      headers: {
        'content-type': gevonden.blob.contentType,
        // Privé: alleen de browser van dit lid mag hem bewaren.
        'cache-control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
