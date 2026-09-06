import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/session';
import { requirePlant, listPhotos } from '@/lib/plants';
import { listTasks } from '@/lib/tasks';
import { listLocations } from '@/lib/locations';
import { readLog } from '@/lib/log';
import { agendaForYear } from '@/lib/occurrences';
import { toRows } from '@/lib/agenda-view';
import { CATEGORY_LABEL } from '@/lib/ui';
import { todayInAmsterdam } from '@/lib/dates';
import { PlantFoto } from '@/components/PlantFoto';
import { OccurrenceList } from '@/components/OccurrenceList';
import { PlantTaken } from './PlantTaken';
import { PlantBeheer } from './PlantBeheer';
import { PlantFotos } from './PlantFotos';
import { Logboek } from './Logboek';

export const dynamic = 'force-dynamic';

export default async function PlantPagina({ params }: { params: Promise<{ id: string }> }) {
  const { garden } = await requireContext();
  const { id } = await params;

  const plant = await requirePlant(garden.id, id).catch(() => null);
  if (!plant) notFound();

  const jaar = new Date().getFullYear();
  const [taken, locations, photos, log, agenda] = await Promise.all([
    listTasks(garden.id, plant.id),
    listLocations(garden.id),
    listPhotos(garden.id, plant.id),
    readLog(garden.id, plant.id),
    agendaForYear(garden.id, jaar, { includeDone: true }),
  ]);

  const locatie = locations.find((l) => l.id === plant.locationId);
  const vandaag = todayInAmsterdam();
  const alleRijen = (await toRows(garden.id, agenda, vandaag)).filter(
    (r) => r.plantId === plant.id,
  );
  // Per taak één regel: de eerstvolgende die nog niet voorbij is. Een taak die
  // elke week terugkomt hoort hier niet vijftig keer te staan.
  const komend = new Map<string, (typeof alleRijen)[number]>();
  for (const rij of alleRijen) {
    if (rij.status !== 'open' || rij.windowEnd < vandaag) continue;
    const eerder = komend.get(rij.taskId);
    if (!eerder || rij.windowStart < eerder.windowStart) komend.set(rij.taskId, rij);
  }
  const rijen = [...komend.values()].sort((a, b) => a.windowStart.localeCompare(b.windowStart));
  const rest = alleRijen.filter((r) => r.status === 'gedaan').length;

  const kenmerken = [
    CATEGORY_LABEL[plant.category],
    plant.hardiness,
    `vorstgevoelig: ${plant.frostSensitive ? 'ja' : 'nee'}`,
    plant.droughtSensitive ? 'droogtegevoelig' : null,
    plant.quantity > 1 ? `${plant.quantity} stuks` : null,
    locatie?.name,
    locatie && !locatie.outdoor && !/binnen/i.test(locatie.name) ? 'binnen' : null,
    plant.status !== 'levend' ? plant.status : null,
  ].filter(Boolean) as string[];

  return (
    <div className="-mx-5 flex flex-col">
      <PlantFoto
        url={plant.photoUrl}
        alt=""
        vierkant
        className={`w-full object-cover ${plant.photoUrl ? 'h-[200px]' : 'h-[104px]'}`}
      />

      <div className="flex flex-col gap-5 px-5 pt-4">
        <header>
          <h1 className="bw-titel-groot">{plant.commonName}</h1>
          {plant.scientificName ? (
            <p className="text-[13px] italic text-[var(--ink-faint)]">{plant.scientificName}</p>
          ) : null}
          <p className="mt-2 flex flex-wrap gap-1.5">
            {kenmerken.map((kenmerk) => (
              <span key={kenmerk} className="bw-chip">
                {kenmerk}
              </span>
            ))}
          </p>
          {plant.notes ? (
            <p className="mt-2.5 text-[13.5px] text-[var(--ink-soft)]">{plant.notes}</p>
          ) : null}
          {plant.sourceUrl ? (
            <p className="mt-1.5 text-[13px]">
              <a
                href={plant.sourceUrl}
                rel="noreferrer noopener"
                target="_blank"
                className="text-[var(--cornflower-dark)] underline"
              >
                Bron van de gegevens
              </a>
            </p>
          ) : null}
        </header>

        <section>
          <h2 className="bw-sectie mb-2">Zorgprofiel</h2>
          <PlantTaken plantId={plant.id} taken={taken} outdoor={locatie?.outdoor ?? true} />
        </section>

        <section>
          <h2 className="bw-sectie mb-2">Wat er aankomt</h2>
          <OccurrenceList
            rows={rijen}
            groupBy="geen"
            zonderPlantnaam
            emptyText="Geen taken meer dit jaar voor deze plant."
          />
          {rest > 0 ? (
            <p className="mt-2 text-[12.5px] text-[var(--ink-muted)]">
              {rest} {rest === 1 ? 'beurt' : 'beurten'} gedaan dit jaar ·{' '}
              <Link href={`/jaar/${jaar}`} className="underline">
                jaaroverzicht
              </Link>
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="bw-sectie mb-2">Foto&apos;s</h2>
          <PlantFotos plantId={plant.id} photos={photos} hoofdfoto={plant.photoUrl} />
        </section>

        <section>
          <h2 className="bw-sectie mb-2">Logboek</h2>
          <Logboek entries={log} />
        </section>

        <section>
          <h2 className="bw-sectie mb-2">Beheer</h2>
          <PlantBeheer
            plantId={plant.id}
            status={plant.status}
            locationId={plant.locationId}
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          />
          {plant.labelCode ? (
            <p className="mt-3 text-[12.5px] text-[var(--ink-faint)]">
              Labelcode <strong>{plant.labelCode}</strong> ·{' '}
              <Link href="/labels" className="underline">
                printvel met QR-codes
              </Link>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
