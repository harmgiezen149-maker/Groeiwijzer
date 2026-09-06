import { requireContext } from '@/lib/session';
import { agendaForDay, agendaForMonth, ensureGenerated } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';
import { listPlants } from '@/lib/plants';
import { addDays, formatDate, parseYmd, todayInAmsterdam } from '@/lib/dates';
import { weatherFor } from '@/lib/weather';
import { applyWeather } from '@/lib/weather-apply';
import { OccurrenceList } from '@/components/OccurrenceList';
import { WeekStrook } from '@/components/WeekStrook';
import { WeerBanner } from '@/components/WeerBanner';
import { LegeStaat } from '@/components/LegeStaat';
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

  // De weekstrook loopt zeven dagen vooruit en kan de maandgrens over.
  const eindeStrook = parseYmd(addDays(today, 6));
  const maanden = [{ jaar: year, maand: month }];
  if (eindeStrook.month !== month) {
    maanden.push({ jaar: eindeStrook.year, maand: eindeStrook.month });
  }

  const [dag, weekItems, planten] = await Promise.all([
    agendaForDay(garden.id, today),
    Promise.all(maanden.map((m) => agendaForMonth(garden.id, m.jaar, m.maand))).then((sets) =>
      toRows(garden.id, sets.flat(), today),
    ),
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
      <header className="flex items-end gap-3">
        <div className="flex-1">
          <p className="bw-sectie mb-1">{formatDate(today)}</p>
          <h1 className="bw-titel">Vandaag</h1>
        </div>
        <p className="text-right">
          <span
            className="bw-titel-groot block leading-none"
            style={{ color: vandaag.length ? 'var(--dahlia)' : 'var(--leaf-dark)' }}
          >
            {vandaag.length}
          </span>
          <span className="text-[11.5px] text-[var(--ink-faint)]">
            {vandaag.length === 1 ? 'te doen' : 'te doen'}
          </span>
        </p>
      </header>

      <WeerBanner rules={meldingen} />

      <OccurrenceList rows={vandaag} emptyText="Niets te doen vandaag. Mooi." />

      <Binnenkort rows={binnenkort} />

      <section>
        <h2 className="bw-sectie mb-2.5">Deze week</h2>
        <WeekStrook today={today} rows={weekItems} />
      </section>
    </div>
  );
}
