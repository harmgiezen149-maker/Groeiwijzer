import { MONTH_NAMES } from './dates';
import type { Schedule } from './types';

/** Leesbare omschrijving van een planning, in het Nederlands. */
export function beschrijfPlanningTekst(schedule: Schedule): string {
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
      return `als het weer erom vraagt, ${venster}`;
  }
}
