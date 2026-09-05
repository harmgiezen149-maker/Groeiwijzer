import { requireContext } from '@/lib/session';
import { listLocations } from '@/lib/locations';
import { NieuwePlant } from './NieuwePlant';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plant toevoegen — Bloeiwijzer' };

export default async function NieuwePlantPagina({
  searchParams,
}: {
  searchParams: Promise<{ bron?: string }>;
}) {
  const { garden } = await requireContext();
  const [locations, params] = await Promise.all([listLocations(garden.id), searchParams]);

  const bron =
    params.bron === 'url' || params.bron === 'handmatig' || params.bron === 'foto'
      ? params.bron
      : 'foto';

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Plant toevoegen</h1>
      <NieuwePlant locations={locations} startBron={bron} />
    </div>
  );
}
