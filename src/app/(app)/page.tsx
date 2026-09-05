import Link from 'next/link';
import { requireContext } from '@/lib/session';
import { agendaForMonth, agendaForYear, ensureGenerated } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';
import { listPlants } from '@/lib/plants';
import { MONTH_NAMES, parseYmd, todayInAmsterdam } from '@/lib/dates';
import { OccurrenceList } from '@/components/OccurrenceList';
import { MonthCalendar } from '@/components/MonthCalendar';
import { LegeStaat } from '@/components/LegeStaat';
import { WeerBanner } from '@/components/WeerBanner';
import { weatherFor } from '@/lib/weather';
import { applyWeather } from '@/lib/weather-apply';

export const dynamic = 'force-dynamic';

export default async function StartPagina() {
  const { garden } = await requireContext();
  const today = todayInAmsterdam();
  const { year, month } = parseYmd(today);

  await ensureGenerated(garden.id, year);

  // De verwachting is zes uur gecached, dus dit kost hooguit vier calls per dag.
  const weer = await weatherFor(garden);
  await applyWeather(garden, weer);

  const [dezeMaand, ditJaar, planten] = await Promise.all([
    agendaForMonth(garden.id, year, month).then((items) => toRows(garden.id, items)),
    agendaForYear(garden.id, year).then((items) => toRows(garden.id, items)),
    listPlants(garden.id),
  ]);

  const levend = planten.filter((p) => p.status === 'levend');
  if (levend.length === 0) {
    return <LegeStaat />;
  }

  const later = ditJaar
    .filter((row) => row.windowStart > today && !dezeMaand.some((d) => d.id === row.id))
    .slice(0, 12);

  const meldingen = Object.values(weer.rules).filter(
    (regel) => regel.id !== 'geen-vorst' || dezeMaand.some((rij) => rij.taskType === 'snoeien'),
  );

  return (
    <div className="flex flex-col gap-6">
      <WeerBanner rules={meldingen} />

      <section>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">
          {MONTH_NAMES[month - 1]}
        </h1>
        <p className="mb-3 text-sm text-[var(--ink-soft)]">
          {dezeMaand.length === 0
            ? 'Geen open taken deze maand.'
            : `${dezeMaand.length} ${dezeMaand.length === 1 ? 'taak' : 'taken'} open.`}
        </p>
        <OccurrenceList rows={dezeMaand} emptyText="Geen open taken deze maand." />
      </section>

      <section>
        <MonthCalendar year={year} month={month} rows={dezeMaand} today={today} />
      </section>

      {later.length ? (
        <section>
          <h2 className="mb-2 text-lg font-bold">Later dit jaar</h2>
          <ul className="flex flex-col gap-1.5">
            {later.map((row) => (
              <li key={row.id} className="bw-card flex items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <Link href={`/planten/${row.plantId}`} className="font-semibold">
                    {row.plantName}
                  </Link>{' '}
                  <span className="text-[var(--ink-soft)]">— {row.title}</span>
                </span>
                <span className="bw-chip shrink-0">
                  {MONTH_NAMES[parseYmd(row.windowStart).month - 1]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
