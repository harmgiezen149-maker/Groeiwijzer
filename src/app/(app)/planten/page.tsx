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
  label?: string;
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
    <div className="flex flex-col gap-3">
      <h1 className="bw-titel">{archief ? 'Archief' : 'Planten'}</h1>

      {params.label ? (
        <p className="bw-banner bw-banner-info">
          {params.label === 'geentoegang'
            ? 'Dat label hoort bij een tuin waar je geen lid van bent.'
            : 'Dat label kennen we niet. Staat de plant misschien in het archief?'}
        </p>
      ) : null}

      <PlantFilters
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        categories={PLANT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
      />

      {planten.length === 0 ? (
        <p className="bw-card p-5 text-[13.5px] text-[var(--ink-quiet)]">
          Niets gevonden met deze filters.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
          {planten.map((plant, index) => (
            <li key={plant.id}>
              <Link href={`/planten/${plant.id}`} className="block">
                <PlantFoto
                  url={plant.photoUrl}
                  alt=""
                  variant={((index % 3) + 1) as 1 | 2 | 3}
                  className="aspect-square w-full"
                />
                <span className="mt-2 block truncate text-[13.5px] font-semibold">
                  {plant.commonName}
                </span>
                <span className="block truncate text-[12px] text-[var(--ink-faint)]">
                  {locatieNaam.get(plant.locationId) ?? 'Zonder locatie'}
                  {plant.quantity > 1 ? ` · ${plant.quantity}×` : ''}
                  {openPerPlant.has(plant.id) ? ' · open taken' : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/planten/nieuw" className="bw-btn bw-btn-nieuw mt-1 w-full">
        + Nieuwe plant
      </Link>
    </div>
  );
}
