import { withGarden, readJson } from '@/lib/api';
import { generateOccurrences } from '@/lib/occurrences';

export const runtime = 'nodejs';

export const POST = withGarden(async (ctx, req) => {
  const body = await readJson<{ year?: number }>(req).catch(() => ({ year: undefined }));
  const year = Number(body.year) || new Date().getFullYear();
  return generateOccurrences(ctx.garden.id, year);
});
