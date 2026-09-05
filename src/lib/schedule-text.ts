import { MONTH_NAMES } from './dates';
import type { Schedule, WeatherRuleId } from './types';

/** Wat een weer-gestuurde taak in gewone taal laat verschijnen. */
const WEER_ZEGT: Partial<Record<WeatherRuleId, string>> = {
  droogte: 'bij droog weer',
  'nachtvorst-alarm': 'bij nachtvorst',
  'geen-vorst': 'als het vorstvrij is',
  'geen-hitte': 'als het niet te warm is',
  groeiseizoen: 'in het groeiseizoen',
};

function weerZin(regels?: WeatherRuleId[]): string | null {
  for (const regel of regels ?? []) {
    const zin = WEER_ZEGT[regel];
    if (zin) return zin;
  }
  return null;
}

/** Leesbare omschrijving van een planning, in het Nederlands. */
export function beschrijfPlanningTekst(schedule: Schedule, weatherRules?: WeatherRuleId[]): string {
  const venster = `${MONTH_NAMES[schedule.startMonth - 1]}–${MONTH_NAMES[schedule.endMonth - 1]}`;
  switch (schedule.kind) {
    case 'jaarvenster':
      return schedule.timesPerWindow === 1
        ? `1× per jaar, ${venster}`
        : `${schedule.timesPerWindow}× per jaar, ${venster}`;
    case 'interval':
      return `elke ${schedule.intervalDays} dagen, ${venster}`;
    case 'meerjaarlijks':
      return `om de ${schedule.everyYears} jaar, ${venster}`;
    case 'weer-gestuurd':
      return `${weerZin(weatherRules) ?? 'als het weer erom vraagt'}, ${venster}`;
  }
}

const KORT = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
] as const;

/** Korte omschrijving voor in een lijstregel: "mrt–apr", "bij droog weer". */
export function beschrijfPlanningKort(schedule: Schedule, weatherRules?: WeatherRuleId[]): string {
  if (schedule.kind === 'weer-gestuurd') return weerZin(weatherRules) ?? 'als het weer erom vraagt';
  const venster =
    schedule.startMonth === schedule.endMonth
      ? KORT[schedule.startMonth - 1]
      : `${KORT[schedule.startMonth - 1]}–${KORT[schedule.endMonth - 1]}`;
  if (schedule.kind === 'interval') return `${venster}, elke ${schedule.intervalDays} dagen`;
  if (schedule.kind === 'meerjaarlijks') return `${venster}, om de ${schedule.everyYears} jaar`;
  return schedule.timesPerWindow > 1 ? `${venster}, ${schedule.timesPerWindow}×` : venster;
}
