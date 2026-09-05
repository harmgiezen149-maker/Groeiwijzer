import { formatDate } from '@/lib/dates';
import type { LogEntry } from '@/lib/types';

const ICOON: Record<LogEntry['kind'], string> = {
  aangemaakt: '🌱',
  gewijzigd: '✎',
  gedaan: '✓',
  overgeslagen: '–',
  heropend: '↺',
  status: '⚑',
  foto: '📷',
  notitie: '✎',
};

export function Logboek({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) {
    return <p className="bw-card p-4 text-sm text-[var(--ink-soft)]">Nog niets gebeurd.</p>;
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((entry) => (
        <li key={entry.id} className="bw-card flex items-start gap-3 p-3 text-sm">
          <span aria-hidden className="text-base">
            {ICOON[entry.kind]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block">{entry.text}</span>
            <span className="block text-xs text-[var(--ink-faint)]">
              {formatDate(entry.at.slice(0, 10))}
              {entry.byName ? ` · ${entry.byName}` : ''}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
