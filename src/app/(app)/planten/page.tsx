import Link from 'next/link';
import { requireContext } from '@/lib/session';
import { listLocations } from '@/lib/locations';
import { listPlants } from '@/lib/plants';
import { loadYear } from '@/lib/occurrences';
import { PLANT_CATEGORIES } from '@/lib/types';
import { CATEGORY_LABEL } from '@/lib/ui';
import { PlantFilters } from './PlantFilters';
import { LegeStaat } from '@/components/LegeStaat';
import { PlantFoto } from '@/components/PlantFoto';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Planten — Bloeiwijzer' };

interface Zoekparameters {
  locatie?: string;
  categorie?: string;
  taken?: string;
  archief?: string;
  q?: string;
}

export default async function PlantenPagina({
  searchParams,
}: {
  searchParams: Promise<Zoekparameters>;
}) {
  const { garden } = await requireContext();
  const params = await searchParams;
  const archief = params.archief === '1';

  const [alles, locations, occurrences] = await Promise.all([
    listPlants(garden.id),
    listLocations(garden.id),
    loadYear(garden.id, new Date().getFullYear()),
  ]);

  if (alles.length === 0) return <LegeStaat />;

  const openPerPlant = new Set(
    Object.values(occurrences)
      .filter((o) => o.status === 'open')
      .map((o) => o.plantId),
  );

  const zoek = (params.q ?? '').trim().toLowerCase();
  const planten = alles.filter((plant) => {
    if (archief ? plant.status === 'levend' : plant.status !== 'levend') return false;
    if (params.locatie && plant.locationId !== params.locatie) return false;
    if (params.categorie && plant.category !== params.categorie) return false;
    if (params.taken === '1' && !openPerPlant.has(plant.id)) return false;
    if (
      zoek &&
      ![plant.commonName, plant.scientificName, plant.cultivar]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(zoek))
    ) {
      return false;
    }
    return true;
  });

  const locatieNaam = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {archief ? 'Archief' : 'Planten'}
        </h1>
        <Link href="/planten/nieuw" className="bw-btn bw-btn-primary ml-auto px-4">
          Toevoegen
        </Link>
      </header>

      <PlantFilters
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        categories={PLANT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
      />

      <p className="text-sm text-[var(--ink-soft)]">
        {planten.length} van {alles.length} planten
      </p>

      {planten.length === 0 ? (
        <p className="bw-card p-5 text-[var(--ink-soft)]">
          Niets gevonden met deze filters.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {planten.map((plant) => (
            <li key={plant.id}>
              <Link
                href={`/planten/${plant.id}`}
                className="bw-card block h-full overflow-hidden"
              >
                <PlantFoto url={plant.photoUrl} alt="" className="aspect-square w-full" />
                <span className="block p-2.5">
                  <span className="block truncate font-semibold">{plant.commonName}</span>
                  <span className="block truncate text-xs text-[var(--ink-soft)]">
                    {locatieNaam.get(plant.locationId) ?? 'Zonder locatie'}
                    {plant.quantity > 1 ? ` · ${plant.quantity}×` : ''}
                  </span>
                  {openPerPlant.has(plant.id) ? (
                    <span className="mt-1.5 inline-block bw-chip">Open taken</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
