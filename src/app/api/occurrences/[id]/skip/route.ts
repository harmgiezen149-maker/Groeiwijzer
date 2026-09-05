import { withGardenParams, readJson } from '@/lib/api';
import { skipOccurrence } from '@/lib/occurrences';

export const runtime = 'nodejs';

export const POST = withGardenParams<{ id: string }, unknown>(async (ctx, req, params) => {
  const body = await readJson<{ skipReason?: string }>(req);
  const occurrence = await skipOccurrence(
    ctx.garden.id,
    params.id,
    ctx.user.id,
    body.skipReason ?? '',
  );
  return { occurrence };
});
