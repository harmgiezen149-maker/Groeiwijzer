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
import { formatDate } from '@/lib/dates';
import { PlantFoto } from '@/components/PlantFoto';
import { OccurrenceList } from '@/components/OccurrenceList';
import { PlantTaken } from './PlantTaken';
import { PlantBeheer } from './PlantBeheer';
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
  const rijen = (await toRows(garden.id, agenda)).filter((r) => r.plantId === plant.id);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <PlantFoto url={plant.photoUrl} alt="" className="h-52 w-full rounded-[var(--radius)]" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{plant.commonName}</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            {[
              plant.scientificName,
              plant.cultivar ? `'${plant.cultivar}'` : null,
              CATEGORY_LABEL[plant.category],
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            <span className="bw-chip">
              {locatie?.name ?? 'Zonder locatie'} · {locatie?.outdoor ? 'buiten' : 'binnen'}
            </span>
            {plant.quantity > 1 ? <span className="bw-chip">{plant.quantity} stuks</span> : null}
            {plant.frostSensitive ? <span className="bw-chip">Vorstgevoelig</span> : null}
            {plant.droughtSensitive ? <span className="bw-chip">Droogtegevoelig</span> : null}
            {plant.status !== 'levend' ? (
              <span className="bw-chip" style={{ borderColor: 'var(--zinnia)' }}>
                {plant.status}
              </span>
            ) : null}
          </p>
        </div>
        {plant.hardiness ? (
          <p className="text-sm text-[var(--ink-soft)]">{plant.hardiness}</p>
        ) : null}
        {plant.notes ? <p className="text-sm">{plant.notes}</p> : null}
        {plant.sourceUrl ? (
          <p className="text-sm">
            <a href={plant.sourceUrl} rel="noreferrer noopener" target="_blank">
              Bron van de gegevens
            </a>
          </p>
        ) : null}
      </header>

      <section>
        <h2 className="mb-2 text-lg font-bold">Dit jaar</h2>
        <OccurrenceList
          rows={rijen}
          groupBy="geen"
          emptyText="Geen taken dit jaar voor deze plant."
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Zorgprofiel</h2>
        <PlantTaken
          plantId={plant.id}
          taken={taken}
          outdoor={locatie?.outdoor ?? true}
        />
      </section>

      {photos.length ? (
        <section>
          <h2 className="mb-2 text-lg font-bold">Foto&apos;s</h2>
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((foto) => (
              <li key={foto.url} className="bw-card overflow-hidden">
                <PlantFoto url={foto.url} alt={foto.caption ?? ''} className="aspect-square w-full" />
                <span className="block p-1.5 text-[11px] text-[var(--ink-soft)]">
                  {formatDate(foto.takenAt.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-bold">Logboek</h2>
        <Logboek entries={log} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Beheer</h2>
        <PlantBeheer
          plantId={plant.id}
          status={plant.status}
          locationId={plant.locationId}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
        {plant.labelCode ? (
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            Labelcode <strong>{plant.labelCode}</strong> ·{' '}
            <Link href="/labels">printvel met QR-codes</Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
