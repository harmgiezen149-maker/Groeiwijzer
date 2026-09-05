import { withGardenParams } from '@/lib/api';
import { reopenOccurrence } from '@/lib/occurrences';

export const runtime = 'nodejs';

export const POST = withGardenParams<{ id: string }, unknown>(async (ctx, _req, params) => {
  const occurrence = await reopenOccurrence(ctx.garden.id, params.id, ctx.user.id);
  return { occurrence };
});
