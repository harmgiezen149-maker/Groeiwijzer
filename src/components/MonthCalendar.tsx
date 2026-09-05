import { DAY_SHORT, MONTH_NAMES, daysInMonth, weekdayIndex, ymd } from '@/lib/dates';
import { TASK_COLOR, TASK_LABEL } from '@/lib/ui';
import type { AgendaRow } from '@/lib/dto';

/**
 * Maandkalender met bolletjes per taaktype. Een taak beslaat een venster,
 * dus hij verschijnt op elke dag binnen dat venster in deze maand.
 */
export function MonthCalendar({
  year,
  month,
  rows,
  today,
}: {
  year: number;
  month: number;
  rows: AgendaRow[];
  today?: string;
}) {
  const total = daysInMonth(year, month);
  const first = ymd(year, month, 1);
  const leading = weekdayIndex(first);

  const perDag = new Map<number, Set<AgendaRow['taskType']>>();
  for (const row of rows) {
    for (let day = 1; day <= total; day++) {
      const datum = ymd(year, month, day);
      if (datum >= row.windowStart && datum <= row.windowEnd) {
        const set = perDag.get(day) ?? new Set();
        set.add(row.taskType);
        perDag.set(day, set);
      }
    }
  }

  const gebruikt = [...new Set(rows.map((r) => r.taskType))];

  return (
    <div className="bw-card p-3">
      <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-[var(--ink-soft)]">
        {MONTH_NAMES[month - 1]} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_SHORT.map((d) => (
          <div key={d} className="pb-1 text-[11px] font-semibold text-[var(--ink-faint)]">
            {d}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`leeg-${i}`} />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const day = i + 1;
          const types = [...(perDag.get(day) ?? [])];
          const isVandaag = today === ymd(year, month, day);
          return (
            <div
              key={day}
              className="flex min-h-11 flex-col items-center justify-start rounded-[var(--radius-sm)] py-1"
              style={{ background: isVandaag ? 'var(--paper-sunken)' : undefined }}
            >
              <span
                className="text-xs"
                style={{ fontWeight: isVandaag ? 700 : 400 }}
              >
                {day}
              </span>
              <span className="mt-0.5 flex max-w-full flex-wrap justify-center gap-[2px]">
                {types.slice(0, 4).map((type) => (
                  <span
                    key={type}
                    className="block size-1.5 rounded-full"
                    style={{ background: TASK_COLOR[type] }}
                    title={TASK_LABEL[type]}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>

      {gebruikt.length ? (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--ink-soft)]">
          {gebruikt.map((type) => (
            <li key={type} className="flex items-center gap-1">
              <span
                aria-hidden
                className="block size-2 rounded-full"
                style={{ background: TASK_COLOR[type] }}
              />
              {TASK_LABEL[type]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
