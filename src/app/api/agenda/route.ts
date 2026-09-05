import { withGarden } from '@/lib/api';
import { agendaForMonth, agendaForYear, ensureGenerated } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';

export const runtime = 'nodejs';

export const GET = withGarden(async (ctx, req) => {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
  const monthParam = url.searchParams.get('month');
  const includeDone = url.searchParams.get('gedaan') === '1';

  await ensureGenerated(ctx.garden.id, year);

  const items = monthParam
    ? await agendaForMonth(ctx.garden.id, year, Number(monthParam), { includeDone })
    : await agendaForYear(ctx.garden.id, year, { includeDone });

  return { year, month: monthParam ? Number(monthParam) : undefined, items: await toRows(ctx.garden.id, items) };
});
