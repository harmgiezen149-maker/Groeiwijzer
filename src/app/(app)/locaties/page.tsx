import { requireContext } from '@/lib/session';
import { listLocations } from '@/lib/locations';
import { listPlants } from '@/lib/plants';
import { LocatieBeheer } from './LocatieBeheer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Locaties — Bloeiwijzer' };

export default async function LocatiesPagina() {
  const { garden } = await requireContext();
  const [locations, plants] = await Promise.all([
    listLocations(garden.id),
    listPlants(garden.id),
  ]);

  const aantallen = new Map<string, number>();
  for (const plant of plants) {
    if (plant.status !== 'levend') continue;
    aantallen.set(plant.locationId, (aantallen.get(plant.locationId) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Locaties</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Binnen of buiten bepaalt of de weerregels gelden. Een kamerplant krijgt nooit een
          vorstwaarschuwing.
        </p>
      </header>
      <LocatieBeheer
        locations={locations}
        aantallen={Object.fromEntries(aantallen)}
      />
    </div>
  );
}
