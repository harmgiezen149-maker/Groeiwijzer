import { requireContext } from '@/lib/session';
import { agendaForDay, agendaForMonth, ensureGenerated } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';
import { listPlants } from '@/lib/plants';
import { MONTH_NAMES, formatDate, parseYmd, todayInAmsterdam } from '@/lib/dates';
import { weatherFor } from '@/lib/weather';
import { applyWeather } from '@/lib/weather-apply';
import { OccurrenceList } from '@/components/OccurrenceList';
import { MonthCalendar } from '@/components/MonthCalendar';
import { WeerBanner } from '@/components/WeerBanner';
import { LegeStaat } from '@/components/LegeStaat';
import { LocatieTegels } from '@/components/LocatieTegels';
import { Binnenkort } from '@/components/Binnenkort';

export const dynamic = 'force-dynamic';

export default async function StartPagina() {
  const { garden } = await requireContext();
  const today = todayInAmsterdam();
  const { year, month } = parseYmd(today);

  await ensureGenerated(garden.id, year);

  // De verwachting is zes uur gecached, dus dit kost hooguit vier calls per dag.
  const weer = await weatherFor(garden);
  await applyWeather(garden, weer);

  const [dag, dezeMaand, planten] = await Promise.all([
    agendaForDay(garden.id, today),
    agendaForMonth(garden.id, year, month).then((items) => toRows(garden.id, items, today)),
    listPlants(garden.id),
  ]);

  if (planten.filter((p) => p.status === 'levend').length === 0) {
    return <LegeStaat />;
  }

  const [vandaag, binnenkort] = await Promise.all([
    toRows(garden.id, dag.vandaag, today),
    toRows(garden.id, dag.binnenkort, today),
  ]);

  const meldingen = Object.values(weer.rules).filter(
    (regel) => regel.id !== 'geen-vorst' || vandaag.some((rij) => rij.taskType === 'snoeien'),
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="bw-titel">Vandaag</h1>
        <p className="mt-1 text-[13.5px] text-[var(--ink-faint)]">{formatDate(today)}</p>
      </header>

      <WeerBanner rules={meldingen} />

      <LocatieTegels rows={vandaag} />

      <OccurrenceList rows={vandaag} emptyText="Niets te doen vandaag. Mooi." />

      <Binnenkort rows={binnenkort} />

      <section>
        <h2 className="bw-sectie mb-2.5">{MONTH_NAMES[month - 1]}</h2>
        <MonthCalendar year={year} month={month} rows={dezeMaand} today={today} />
      </section>
    </div>
  );
}
