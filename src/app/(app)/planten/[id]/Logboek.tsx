import { formatShortDate } from '@/lib/dates';
import type { LogEntry } from '@/lib/types';

/** Sober, zoals in het ontwerp: datum, streepje, wat er gebeurde. */
export function Logboek({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-[13px] text-[var(--ink-muted)]">Nog niets gebeurd.</p>;
  }

  return (
    <ol className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="text-[var(--ink-faint)]">
            {formatShortDate(entry.at.slice(0, 10))}
          </span>{' '}
          — {entry.text}
          {entry.byName ? (
            <span className="text-[var(--ink-muted)]"> · {entry.byName}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
