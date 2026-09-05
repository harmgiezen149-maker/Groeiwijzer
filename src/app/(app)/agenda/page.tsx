import Link from 'next/link';
import { requireContext } from '@/lib/session';
import { agendaForMonth, ensureGenerated } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';
import { listLocations } from '@/lib/locations';
import { MONTH_NAMES, formatDate, parseYmd, todayInAmsterdam } from '@/lib/dates';
import { TASK_TYPES } from '@/lib/types';
import { TASK_LABEL } from '@/lib/ui';
import { MonthCalendar } from '@/components/MonthCalendar';
import { AgendaFilters } from './AgendaFilters';
import { OccurrenceList } from '@/components/OccurrenceList';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agenda — Bloeiwijzer' };

interface Params {
  jaar?: string;
  maand?: string;
  dag?: string;
  type?: string;
  locatie?: string;
  gedaan?: string;
}

export default async function AgendaPagina({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { garden } = await requireContext();
  const params = await searchParams;
  const vandaag = todayInAmsterdam();
  const nu = parseYmd(vandaag);

  const jaar = Number(params.jaar) || nu.year;
  const maand = Math.min(12, Math.max(1, Number(params.maand) || nu.month));
  const toonGedaan = params.gedaan === '1';
  const dag = params.dag && params.dag.startsWith(`${jaar}-`) ? params.dag : undefined;

  await ensureGenerated(garden.id, jaar);

  const [items, locations] = await Promise.all([
    agendaForMonth(garden.id, jaar, maand, { includeDone: toonGedaan }),
    listLocations(garden.id),
  ]);

  let rijen = await toRows(garden.id, items);
  if (params.type) rijen = rijen.filter((r) => r.taskType === params.type);
  if (params.locatie) rijen = rijen.filter((r) => r.locationId === params.locatie);

  const zichtbaar = dag
    ? rijen.filter((r) => r.windowStart <= dag && r.windowEnd >= dag)
    : rijen;

  const link = (extra: Partial<Params>) => {
    const zoek = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...extra })) if (v) zoek.set(k, String(v));
    return `/agenda?${zoek.toString()}`;
  };
  const vorige = maand === 1 ? { jaar: jaar - 1, maand: 12 } : { jaar, maand: maand - 1 };
  const volgende = maand === 12 ? { jaar: jaar + 1, maand: 1 } : { jaar, maand: maand + 1 };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-1">
        <h1 className="bw-titel-groot flex-1">
          {MONTH_NAMES[maand - 1].replace(/^./, (c) => c.toUpperCase())} {jaar}
        </h1>
        <Link
          href={link({ jaar: String(vorige.jaar), maand: String(vorige.maand), dag: undefined })}
          className="bw-btn bw-btn-ghost px-3"
          aria-label="Vorige maand"
        >
          ‹
        </Link>
        <Link
          href={link({ jaar: String(volgende.jaar), maand: String(volgende.maand), dag: undefined })}
          className="bw-btn bw-btn-ghost px-3"
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
        selected={dag}
        hrefForDay={(datum) => link({ dag: datum ?? undefined })}
      />

      <AgendaFilters
        types={TASK_TYPES.map((t) => ({ value: t, label: TASK_LABEL[t] }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />

      <section>
        {dag ? <h2 className="bw-sectie mb-2.5">{formatDate(dag)}</h2> : null}
        <OccurrenceList
          rows={zichtbaar}
          groupBy={dag ? 'geen' : 'locatie'}
          compact
          emptyText={
            dag
              ? 'Op deze dag staat niets open.'
              : toonGedaan
                ? 'Deze maand staat er niets in de agenda.'
                : 'Geen open taken deze maand.'
          }
        />
      </section>

      <p className="text-center">
        <Link href={`/jaar/${jaar}`} className="text-[13px] text-[var(--ink-quiet)] underline">
          Jaaroverzicht {jaar}
        </Link>
      </p>
    </div>
  );
}
