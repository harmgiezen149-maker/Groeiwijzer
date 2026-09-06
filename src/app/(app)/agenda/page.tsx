import Link from 'next/link';
import { requireContext } from '@/lib/session';
import { agendaForDay, agendaForMonth, ensureGenerated } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';
import { listLocations } from '@/lib/locations';
import { MONTH_NAMES, formatDate, parseYmd, todayInAmsterdam, ymd } from '@/lib/dates';
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
  // Altijd één dag in beeld: de agenda gaat over wat je die dag doet, niet
  // over alles wat de maand ergens raakt.
  const gekozen = params.dag && params.dag.startsWith(`${jaar}-`) ? params.dag : null;
  const isDezeMaand = jaar === nu.year && maand === nu.month;
  const dag = gekozen ?? (isDezeMaand ? vandaag : ymd(jaar, maand, 1));

  await ensureGenerated(garden.id, jaar);

  const [items, locations] = await Promise.all([
    agendaForMonth(garden.id, jaar, maand, { includeDone: toonGedaan }),
    listLocations(garden.id),
  ]);

  const filter = (lijst: Awaited<ReturnType<typeof toRows>>) => {
    let uit = lijst;
    if (params.type) uit = uit.filter((r) => r.taskType === params.type);
    if (params.locatie) uit = uit.filter((r) => r.locationId === params.locatie);
    return uit;
  };

  const rijen = filter(await toRows(garden.id, items, vandaag));

  // Vandaag telt ook wat is blijven liggen; een andere dag toont wat er die
  // dag volgens het schema mag.
  const zichtbaar =
    dag === vandaag
      ? filter(
          await toRows(garden.id, (await agendaForDay(garden.id, vandaag)).vandaag, vandaag),
        )
      : rijen.filter((r) => r.windowStart <= dag && r.windowEnd >= dag);

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

      <div className="bw-card px-0 py-3.5">
        <MonthCalendar
          year={jaar}
          month={maand}
          rows={rijen}
          today={jaar === nu.year && maand === nu.month ? vandaag : undefined}
          selected={dag}
          hrefForDay={(datum) => link({ dag: datum ?? undefined })}
        />
      </div>

      <AgendaFilters
        types={TASK_TYPES.map((t) => ({ value: t, label: TASK_LABEL[t] }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />

      <section>
        <h2 className="bw-sectie mb-2.5">
          {dag === vandaag ? `Vandaag · ${formatDate(dag)}` : formatDate(dag)}
        </h2>
        <OccurrenceList
          rows={zichtbaar}
          groupBy="locatie"
          compact
          emptyText={
            dag === vandaag ? 'Niets te doen vandaag. Mooi.' : 'Op deze dag staat niets open.'
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
