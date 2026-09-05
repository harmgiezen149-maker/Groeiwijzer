import { withGardenParams } from '@/lib/api';
import { agendaForYear } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';

export const runtime = 'nodejs';

export const GET = withGardenParams<{ jaar: string }, unknown>(async (ctx, _req, params) => {
  const jaar = Number(params.jaar);
  if (!Number.isInteger(jaar) || jaar < 2000 || jaar > 2200) {
    throw Object.assign(new Error('Onbekend jaar'), { status: 400 });
  }
  const rijen = await toRows(ctx.garden.id, await agendaForYear(ctx.garden.id, jaar, { includeDone: true }));
  return { jaar, items: rijen };
});
