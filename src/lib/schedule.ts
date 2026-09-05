import { addDays, daysBetween, daysInMonth, ymd } from './dates';
import type { CareTask, Schedule, TaskOccurrence } from './types';

/**
 * Het venster van een sjabloon in een gegeven jaar.
 * Loopt startMonth voorbij endMonth (bv. november t/m februari), dan loopt
 * het venster door in het volgende kalenderjaar (OVERDRACHT §4.3).
 */
export function windowForYear(
  schedule: Schedule,
  year: number,
): { start: string; end: string } {
  const s = schedule.startMonth;
  const e = schedule.endMonth;
  const endYear = s > e ? year + 1 : year;
  return {
    start: ymd(year, s, 1),
    end: ymd(endYear, e, daysInMonth(endYear, e)),
  };
}

export function occurrenceId(plantId: string, taskId: string, year: number, seq: number): string {
  return `${plantId}:${taskId}:${year}:${seq}`;
}

/**
 * De occurrences die een sjabloon in een jaar zou moeten opleveren.
 * Puur: geen Redis, geen datum-van-nu. Zo is dit rechtstreeks te testen.
 */
export function plannedOccurrences(
  task: CareTask,
  year: number,
  generatedAt: string,
): TaskOccurrence[] {
  if (!task.enabled) return [];
  const schedule = task.schedule;
  // Weer-gestuurde taken krijgen geen vooraf gegenereerde occurrences (§7.1).
  if (schedule.kind === 'weer-gestuurd') return [];
  if (
    schedule.kind === 'meerjaarlijks' &&
    (schedule.everyYears < 1 ||
      mod(year - schedule.anchorYear, schedule.everyYears) !== 0)
  ) {
    return [];
  }

  const { start, end } = windowForYear(schedule, year);
  const totalDays = daysBetween(start, end) + 1;
  const slices: { start: string; end: string }[] = [];

  if (schedule.kind === 'interval') {
    const step = Math.max(1, Math.round(schedule.intervalDays));
    for (let offset = 0; offset < totalDays; offset += step) {
      const sliceStart = addDays(start, offset);
      const sliceEnd = addDays(start, Math.min(offset + step - 1, totalDays - 1));
      slices.push({ start: sliceStart, end: sliceEnd });
    }
  } else {
    const times = Math.max(1, Math.min(24, Math.round(schedule.kind === 'jaarvenster' ? schedule.timesPerWindow : 1)));
    // Gelijk verdeeld over het venster: elk deel krijgt zijn eigen deelvenster.
    for (let i = 0; i < times; i++) {
      const from = Math.floor((i * totalDays) / times);
      const to = Math.floor(((i + 1) * totalDays) / times) - 1;
      slices.push({ start: addDays(start, from), end: addDays(start, Math.max(from, to)) });
    }
  }

  return slices.map((slice, index) => ({
    id: occurrenceId(task.plantId, task.id, year, index),
    plantId: task.plantId,
    taskId: task.id,
    year,
    seq: index,
    windowStart: slice.start,
    windowEnd: slice.end,
    status: 'open' as const,
    generatedAt,
  }));
}

/** Modulo die ook voor negatieve getallen een niet-negatief resultaat geeft. */
function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/**
 * Voegt de geplande occurrences samen met wat er al staat.
 * Idempotent: een bestaande id blijft ongemoeid, `gedaan` en `overgeslagen`
 * worden nooit overschreven (§7.1).
 */
export function mergeOccurrences(
  existing: Record<string, TaskOccurrence>,
  planned: TaskOccurrence[],
): { toWrite: Record<string, TaskOccurrence>; added: number } {
  const toWrite: Record<string, TaskOccurrence> = {};
  let added = 0;
  for (const occ of planned) {
    if (existing[occ.id]) continue;
    toWrite[occ.id] = occ;
    added++;
  }
  return { toWrite, added };
}
