import Link from 'next/link';
import { requireContext } from '@/lib/session';
import { agendaForMonth, ensureGenerated } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';
import { listLocations } from '@/lib/locations';
import { MONTH_NAMES, parseYmd, todayInAmsterdam } from '@/lib/dates';
import { TASK_TYPES } from '@/lib/types';
import { TASK_LABEL } from '@/lib/ui';
import { MonthCalendar } from '@/components/MonthCalendar';
import { AgendaFilters } from './AgendaFilters';
import { OccurrenceList } from '@/components/OccurrenceList';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agenda — Bloeiwijzer' };

export default async function AgendaPagina({
  searchParams,
}: {
  searchParams: Promise<{ jaar?: string; maand?: string; type?: string; locatie?: string; gedaan?: string }>;
}) {
  const { garden } = await requireContext();
  const params = await searchParams;
  const vandaag = todayInAmsterdam();
  const nu = parseYmd(vandaag);

  const jaar = Number(params.jaar) || nu.year;
  const maand = Math.min(12, Math.max(1, Number(params.maand) || nu.month));
  const toonGedaan = params.gedaan === '1';

  await ensureGenerated(garden.id, jaar);

  const [items, locations] = await Promise.all([
    agendaForMonth(garden.id, jaar, maand, { includeDone: toonGedaan }),
    listLocations(garden.id),
  ]);

  let rijen = await toRows(garden.id, items);
  if (params.type) rijen = rijen.filter((r) => r.taskType === params.type);
  if (params.locatie) rijen = rijen.filter((r) => r.locationId === params.locatie);

  const vorige = maand === 1 ? { jaar: jaar - 1, maand: 12 } : { jaar, maand: maand - 1 };
  const volgende = maand === 12 ? { jaar: jaar + 1, maand: 1 } : { jaar, maand: maand + 1 };
  const bewaar = (extra: Record<string, string>) => {
    const zoek = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...extra })) if (v) zoek.set(k, String(v));
    return `/agenda?${zoek.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          href={bewaar({ jaar: String(vorige.jaar), maand: String(vorige.maand) })}
          className="bw-btn bw-btn-secondary px-3"
          aria-label="Vorige maand"
        >
          ‹
        </Link>
        <h1 className="flex-1 text-center text-xl font-bold tracking-tight">
          {MONTH_NAMES[maand - 1]} {jaar}
        </h1>
        <Link
          href={bewaar({ jaar: String(volgende.jaar), maand: String(volgende.maand) })}
          className="bw-btn bw-btn-secondary px-3"
          aria-label="Volgende maand"
        >
          ›
        </Link>
      </header>

      <MonthCalendar
        year={jaar}
        month={maand}
        rows={rijen}
        today={jaar === nu.year && maand === nu.month ? vandaag : undefined}
      />

      <AgendaFilters
        types={TASK_TYPES.map((t) => ({ value: t, label: TASK_LABEL[t] }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />

      <OccurrenceList
        rows={rijen}
        emptyText={
          toonGedaan
            ? 'Deze maand staat er niets in de agenda.'
            : 'Geen open taken deze maand.'
        }
      />

      <p className="text-center">
        <Link href={`/jaar/${jaar}`} className="text-sm">
          Bekijk het jaaroverzicht van {jaar}
        </Link>
      </p>
    </div>
  );
}
