import Link from 'next/link';
import { DAY_SHORT, addDays, parseYmd, weekdayIndex } from '@/lib/dates';
import { TASK_COLOR } from '@/lib/ui';
import type { AgendaRow } from '@/lib/dto';

/**
 * Zeven dagen op een rij, met vandaag vooraan. Past bij een agenda die over
 * één dag gaat: de maand staat op /agenda.
 */
export function WeekStrook({ today, rows }: { today: string; rows: AgendaRow[] }) {
  const dagen = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const kleurenPerDag = new Map<string, string[]>();
  for (const datum of dagen) {
    const typen = new Set<AgendaRow['taskType']>();
    for (const rij of rows) {
      if (datum >= rij.windowStart && datum <= rij.windowEnd) typen.add(rij.taskType);
    }
    kleurenPerDag.set(datum, [...typen].slice(0, 3).map((t) => TASK_COLOR[t]));
  }

  return (
    <ul className="grid grid-cols-7 gap-1.5">
      {dagen.map((datum) => {
        const { day } = parseYmd(datum);
        const nu = datum === today;
        const stippen = kleurenPerDag.get(datum) ?? [];
        return (
          <li key={datum}>
            <Link
              href={`/agenda?dag=${datum}`}
              className={`bw-weekdag ${nu ? 'bw-weekdag-nu' : ''}`}
              aria-current={nu ? 'date' : undefined}
            >
              <span
                className="block text-[10.5px]"
                style={{ color: nu ? '#ffffffcc' : 'var(--ink-muted)' }}
              >
                {DAY_SHORT[weekdayIndex(datum)]}
              </span>
              <span className="bw-titel-klein mt-0.5 block text-[15px]">{day}</span>
              <span className="mt-1 flex h-1.5 justify-center gap-1">
                {stippen.map((kleur) => (
                  <i
                    key={kleur}
                    aria-hidden
                    className="block size-1.5 rounded-full"
                    style={{ background: nu ? '#ffffffe6' : kleur }}
                  />
                ))}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
