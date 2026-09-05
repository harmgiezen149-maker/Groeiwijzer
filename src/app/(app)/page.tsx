import Link from 'next/link';
import { requireContext } from '@/lib/session';
import { agendaForMonth, agendaForYear, ensureGenerated } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';
import { listPlants } from '@/lib/plants';
import { MONTH_NAMES, parseYmd, todayInAmsterdam } from '@/lib/dates';
import { weatherFor } from '@/lib/weather';
import { applyWeather } from '@/lib/weather-apply';
import { OccurrenceList } from '@/components/OccurrenceList';
import { MonthCalendar } from '@/components/MonthCalendar';
import { WeerBanner } from '@/components/WeerBanner';
import { LegeStaat } from '@/components/LegeStaat';

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

  if (planten.filter((p) => p.status === 'levend').length === 0) {
    return <LegeStaat />;
  }

  const later = ditJaar
    .filter((row) => row.windowStart > today && !dezeMaand.some((d) => d.id === row.id))
    .sort((a, b) => a.windowStart.localeCompare(b.windowStart));

  const meldingen = Object.values(weer.rules).filter(
    (regel) => regel.id !== 'geen-vorst' || dezeMaand.some((rij) => rij.taskType === 'snoeien'),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="bw-titel">Deze maand</h1>

      <WeerBanner rules={meldingen} />

      <OccurrenceList rows={dezeMaand} emptyText="Geen open taken deze maand." />

      <section>
        <h2 className="bw-sectie mb-2.5">{MONTH_NAMES[month - 1]}</h2>
        <MonthCalendar year={year} month={month} rows={dezeMaand} today={today} />
      </section>

      {later.length ? (
        <section>
          <h2 className="bw-sectie mb-1.5">Later dit jaar</h2>
          <p className="mb-2.5 text-[13px] text-[var(--ink-muted)]">
            {samenvatting(later.length, later)}
          </p>
          <ul className="flex flex-col gap-2">
            {later.slice(0, 8).map((row) => (
              <li key={row.id} className="bw-card-compact flex items-center gap-2.5 p-3 text-[13.5px]">
                <Link href={`/planten/${row.plantId}`} className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{row.plantName}</span>
                  <span className="text-[var(--ink-quiet)]"> — {row.title}</span>
                </Link>
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

function samenvatting(aantal: number, rijen: { windowStart: string }[]): string {
  const woord = aantal === 1 ? 'taak' : 'taken';
  const eerste = MONTH_NAMES[parseYmd(rijen[0].windowStart).month - 1];
  const laatste = MONTH_NAMES[parseYmd(rijen[rijen.length - 1].windowStart).month - 1];
  if (eerste === laatste) return `${aantal} ${woord} in ${eerste}`;
  return `${aantal} ${woord} tussen ${eerste} en ${laatste}`;
}
