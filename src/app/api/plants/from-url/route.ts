import { z } from 'zod';
import { withGarden, readJson } from '@/lib/api';
import { requireLocation } from '@/lib/locations';
import { requestCareProfile } from '@/lib/ai/care-profile';
import { assertWithinLimit } from '@/lib/ratelimit';
import { fetchPageText } from '@/lib/url-import';
import { parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const input = z.object({
  url: z.url('Vul een geldig webadres in'),
  locationId: z.string().trim().min(1),
});

export const POST = withGarden(async (ctx, req) => {
  await assertWithinLimit(ctx.user.id, 'from-url');
  const { url, locationId } = parseOrThrow(input, await readJson(req));
  const location = await requireLocation(ctx.garden.id, locationId);

  const pagina = await fetchPageText(url);
  const profiel = await requestCareProfile({
    name: pagina.title,
    outdoor: location.outdoor,
    pageText: pagina.text,
  });

  return {
    sourceUrl: url,
    pageTitle: pagina.title,
    profile: profiel.profile,
    notes: [profiel.note].filter(Boolean),
  };
});
