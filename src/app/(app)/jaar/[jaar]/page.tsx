import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/session';
import { agendaForYear } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';
import { MONTH_NAMES, formatDate, parseYmd } from '@/lib/dates';
import { TASK_COLOR, TASK_LABEL } from '@/lib/ui';
import { PlantFoto } from '@/components/PlantFoto';
import type { AgendaRow } from '@/lib/dto';

export const dynamic = 'force-dynamic';

export default async function JaarPagina({ params }: { params: Promise<{ jaar: string }> }) {
  const { garden } = await requireContext();
  const { jaar: jaarParam } = await params;
  const jaar = Number(jaarParam);
  if (!Number.isInteger(jaar) || jaar < 2000 || jaar > 2200) notFound();

  const rijen = await toRows(
    garden.id,
    await agendaForYear(garden.id, jaar, { includeDone: true }),
  );

  const afgerond = rijen.filter((r) => r.status === 'gedaan');
  const overgeslagen = rijen.filter((r) => r.status === 'overgeslagen');
  const perMaand = new Map<number, AgendaRow[]>();
  for (const rij of [...afgerond, ...overgeslagen]) {
    const maand = parseYmd(rij.doneAt?.slice(0, 10) ?? rij.windowStart).month;
    perMaand.set(maand, [...(perMaand.get(maand) ?? []), rij]);
  }

  const perLocatie = new Map<string, number>();
  for (const rij of afgerond) {
    perLocatie.set(rij.locationName, (perLocatie.get(rij.locationName) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-1">
        <h1 className="bw-titel-groot flex-1">{jaar}</h1>
        <Link href={`/jaar/${jaar - 1}`} className="bw-btn bw-btn-ghost px-3" aria-label="Vorig jaar">
          ‹
        </Link>
        <Link href={`/jaar/${jaar + 1}`} className="bw-btn bw-btn-ghost px-3" aria-label="Volgend jaar">
          ›
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-2 text-center">
        <p className="bw-card-compact p-3">
          <span className="bw-titel-klein block" style={{ color: 'var(--leaf)' }}>
            {afgerond.length}
          </span>
          <span className="text-[11px] text-[var(--ink-faint)]">gedaan</span>
        </p>
        <p className="bw-card-compact p-3">
          <span className="bw-titel-klein block">{overgeslagen.length}</span>
          <span className="text-[11px] text-[var(--ink-faint)]">overgeslagen</span>
        </p>
        <p className="bw-card-compact p-3">
          <span className="bw-titel-klein block">{rijen.length - afgerond.length - overgeslagen.length}</span>
          <span className="text-[11px] text-[var(--ink-faint)]">nog open</span>
        </p>
      </div>

      {perLocatie.size ? (
        <section>
          <h2 className="bw-sectie mb-2">Per locatie</h2>
          <ul className="bw-card-compact flex flex-col gap-1.5 px-3.5 py-3 text-[13.5px]">
            {[...perLocatie.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([locatie, aantal]) => (
                <li key={locatie} className="flex justify-between">
                  <span>{locatie}</span>
                  <span className="font-semibold">{aantal}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {perMaand.size === 0 ? (
        <p className="bw-card p-5 text-[13.5px] text-[var(--ink-quiet)]">
          In {jaar} is er nog niets afgevinkt.
        </p>
      ) : (
        [...perMaand.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([maand, items]) => (
            <section key={maand}>
              <h2 className="bw-sectie mb-2">{MONTH_NAMES[maand - 1]}</h2>
              <ul className="flex flex-col gap-2">
                {items.map((rij) => (
                  <li key={rij.id} className="bw-card flex items-stretch overflow-hidden">
                    <span
                      aria-hidden
                      className="w-1.5 shrink-0"
                      style={{ background: TASK_COLOR[rij.taskType] }}
                    />
                    {rij.occurrencePhotoUrl ? (
                      <PlantFoto url={rij.occurrencePhotoUrl} alt="" vierkant className="size-20 shrink-0 object-cover" />
                    ) : null}
                    <span className="min-w-0 flex-1 p-3 text-[13.5px]">
                      <Link href={`/planten/${rij.plantId}`} className="font-semibold">
                        {rij.plantName}
                      </Link>
                      <span className="block text-[var(--ink-quiet)]">
                        {rij.title} · {TASK_LABEL[rij.taskType]}
                      </span>
                      <span className="block text-[11.5px] text-[var(--ink-muted)]">
                        {rij.doneAt ? formatDate(rij.doneAt.slice(0, 10)) : ''}
                        {rij.doneByName ? ` · ${rij.doneByName}` : ''}
                        {rij.status === 'overgeslagen' ? ` · overgeslagen: ${rij.skipReason}` : ''}
                      </span>
                      {rij.note ? <span className="mt-1 block">{rij.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}

      <p>
        <a className="bw-btn bw-btn-secondary" href="/api/export?onderdeel=agenda" download>
          Agenda als CSV
        </a>
      </p>
    </div>
  );
}
