import { requireContext } from '@/lib/session';
import { listLocations } from '@/lib/locations';
import { listPlants } from '@/lib/plants';
import { loadYear } from '@/lib/occurrences';
import { LocatieBeheer } from './LocatieBeheer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Locaties — Bloeiwijzer' };

export default async function LocatiesPagina() {
  const { garden } = await requireContext();
  const [locations, plants, occurrences] = await Promise.all([
    listLocations(garden.id),
    listPlants(garden.id),
    loadYear(garden.id, new Date().getFullYear()),
  ]);

  const perLocatie = new Map(plants.map((p) => [p.id, p.locationId]));
  const planten = new Map<string, number>();
  const open = new Map<string, number>();

  for (const plant of plants) {
    if (plant.status !== 'levend') continue;
    planten.set(plant.locationId, (planten.get(plant.locationId) ?? 0) + 1);
  }
  for (const occ of Object.values(occurrences)) {
    if (occ.status !== 'open') continue;
    const locatieId = perLocatie.get(occ.plantId);
    if (locatieId) open.set(locatieId, (open.get(locatieId) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="bw-titel-groot">Locaties</h1>
        <p className="mt-1 text-[13px] text-[var(--ink-faint)]">
          Binnen of buiten bepaalt of de weerregels gelden. Een kamerplant krijgt nooit een
          vorstwaarschuwing.
        </p>
      </div>
      <LocatieBeheer
        locations={locations}
        planten={Object.fromEntries(planten)}
        open={Object.fromEntries(open)}
      />
    </div>
  );
}
