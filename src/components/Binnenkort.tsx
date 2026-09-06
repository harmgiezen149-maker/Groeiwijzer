import Link from 'next/link';
import { TASK_COLOR } from '@/lib/ui';
import { formatShortDate } from '@/lib/dates';
import { TaakIcoon } from './TaakIcoon';
import type { AgendaRow } from '@/lib/dto';

/**
 * Wat er de komende dagen aankomt, ingeklapt. Per taak één regel, zodat een
 * plant die elke week water wil hier niet zeven keer staat.
 */
export function Binnenkort({ rows }: { rows: AgendaRow[] }) {
  if (rows.length === 0) return null;

  const gesorteerd = [...rows].sort((a, b) => a.windowStart.localeCompare(b.windowStart));

  return (
    <details className="bw-card overflow-hidden">
      <summary className="flex min-h-[var(--tap)] cursor-pointer items-center gap-2 px-4 py-3">
        <span className="bw-sectie">Binnenkort</span>
        <span className="text-[12.5px] text-[var(--ink-faint)]">
          {rows.length === 1 ? '1 taak' : `${rows.length} taken`} in de komende week
        </span>
      </summary>
      <ul className="border-t border-[var(--line)]">
        {gesorteerd.map((rij) => (
          <li
            key={rij.id}
            className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-2.5 last:border-b-0"
          >
            <span
              className="bw-taakblob bw-taakblob-klein"
              style={{ background: TASK_COLOR[rij.taskType] }}
            >
              <TaakIcoon type={rij.taskType} size={16} />
            </span>
            <Link href={`/planten/${rij.plantId}`} className="min-w-0 flex-1 text-[13.5px]">
              <span className="block truncate font-semibold">{rij.plantName}</span>
              <span className="block truncate text-[12.5px] text-[var(--ink-quiet)]">
                {rij.title}
              </span>
            </Link>
            <span className="shrink-0 text-[12px] text-[var(--ink-faint)]">
              {formatShortDate(rij.windowStart)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
