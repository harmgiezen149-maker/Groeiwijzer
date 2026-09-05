import { withGardenParams, readJson } from '@/lib/api';
import { completeOccurrence } from '@/lib/occurrences';

export const runtime = 'nodejs';

export const POST = withGardenParams<{ id: string }, unknown>(async (ctx, req, params) => {
  const body = await readJson<{ note?: string; photoUrl?: string }>(req).catch(() => ({}));
  const occurrence = await completeOccurrence(ctx.garden.id, params.id, ctx.user.id, body);
  return { occurrence };
});
