import { withGarden } from '@/lib/api';
import { weatherFor } from '@/lib/weather';
import { applyWeather } from '@/lib/weather-apply';

export const runtime = 'nodejs';

export const GET = withGarden(async (ctx, req) => {
  const force = new URL(req.url).searchParams.get('force') === '1';
  const state = await weatherFor(ctx.garden, { force });
  const toegepast = await applyWeather(ctx.garden, state);
  return {
    today: state.today,
    rules: Object.values(state.rules),
    days: state.forecast?.days.slice(7, 12) ?? [],
    fetchedAt: state.forecast?.fetchedAt,
    toegepast,
  };
});
