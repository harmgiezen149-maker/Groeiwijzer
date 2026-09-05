import Link from 'next/link';
import { daysInMonth, weekdayIndex, ymd } from '@/lib/dates';
import { TASK_COLOR } from '@/lib/ui';
import type { AgendaRow } from '@/lib/dto';

const LETTERS = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z'];
const KORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

/**
 * Maandkalender met bolletjes per taaktype onder het dagnummer.
 * Een taak beslaat een venster, dus hij verschijnt op elke dag binnen
 * dat venster. Vandaag krijgt de donkere schijf uit het ontwerp.
 */
export function MonthCalendar({
  year,
  month,
  rows,
  today,
  selected,
  hrefForDay,
}: {
  year: number;
  month: number;
  rows: AgendaRow[];
  today?: string;
  /** yyyy-mm-dd van de gekozen dag, als er een gekozen is. */
  selected?: string;
  hrefForDay?: (datum: string | null) => string;
}) {
  const total = daysInMonth(year, month);
  const leading = weekdayIndex(ymd(year, month, 1));

  const perDag = new Map<number, AgendaRow['taskType'][]>();
  for (let day = 1; day <= total; day++) {
    const datum = ymd(year, month, day);
    const types = new Set<AgendaRow['taskType']>();
    for (const row of rows) {
      if (datum >= row.windowStart && datum <= row.windowEnd) types.add(row.taskType);
    }
    if (types.size) perDag.set(day, [...types]);
  }

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10.5px] text-[var(--ink-muted)] sm:gap-2 sm:text-xs">
        {LETTERS.map((letter, i) => (
          <div key={i}>
            <span className="sm:hidden">{letter}</span>
            <span className="hidden sm:inline">{KORT[i]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: leading }, (_, i) => (
          <div key={`leeg-${i}`} />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const day = i + 1;
          const datum = ymd(year, month, day);
          const types = perDag.get(day) ?? [];
          const isVandaag = today === datum;
          const isGekozen = selected === datum;

          const inhoud = (
            <>
              {day}
              {types.length ? (
                <span className="bw-dag-stippen" aria-hidden>
                  {types.slice(0, 3).map((type) => (
                    <i
                      key={type}
                      className="bw-dag-stip"
                      style={{ background: TASK_COLOR[type] }}
                    />
                  ))}
                </span>
              ) : null}
            </>
          );

          const klasse = `bw-dag ${isVandaag ? 'bw-dag-vandaag' : ''}`;
          const stijl = isGekozen && !isVandaag
            ? { boxShadow: 'inset 0 0 0 1.5px var(--dahlia)', color: 'var(--dahlia)', fontWeight: 700 }
            : undefined;

          if (!hrefForDay) {
            return (
              <div key={day} className={klasse} style={stijl}>
                {inhoud}
              </div>
            );
          }

          return (
            <Link
              key={day}
              href={hrefForDay(isGekozen ? null : datum)}
              scroll={false}
              aria-label={`${day}${types.length ? `, ${types.length} soort werk` : ''}`}
              aria-current={isGekozen ? 'date' : undefined}
              className={`${klasse} block`}
              style={stijl}
            >
              {inhoud}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
