import QRCode from 'qrcode';
import { requireContext } from '@/lib/session';
import { listLocations } from '@/lib/locations';
import { listLivePlants } from '@/lib/plants';
import { appUrl } from '@/lib/mail';
import { LabelFilters } from './LabelFilters';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Labels — Bloeiwijzer' };

export default async function LabelsPagina({
  searchParams,
}: {
  searchParams: Promise<{ locatie?: string }>;
}) {
  const { garden } = await requireContext();
  const params = await searchParams;

  const [plants, locations] = await Promise.all([
    listLivePlants(garden.id),
    listLocations(garden.id),
  ]);
  const naam = new Map(locations.map((l) => [l.id, l.name]));

  const gekozen = plants
    .filter((plant) => plant.labelCode)
    .filter((plant) => !params.locatie || plant.locationId === params.locatie);

  const labels = await Promise.all(
    gekozen.map(async (plant) => ({
      id: plant.id,
      name: plant.commonName,
      location: naam.get(plant.locationId) ?? '',
      code: plant.labelCode!,
      svg: await QRCode.toString(appUrl(`/q/${garden.id}/${plant.labelCode}`), {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
      }),
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="bw-geen-print">
        <h1 className="bw-titel-groot">Labels</h1>
        <p className="mt-1 text-[13px] text-[var(--ink-faint)]">
          Scan een label in de tuin en je staat meteen op de juiste plantpagina. Print op stevig
          papier en lamineer het, of steek het in een plantensteker — los papier houdt het buiten
          niet lang.
        </p>
      </header>

      <div className="bw-geen-print">
        <LabelFilters locations={locations.map((l) => ({ id: l.id, name: l.name }))} />
      </div>

      {labels.length === 0 ? (
        <p className="bw-card p-5 text-[13.5px] text-[var(--ink-quiet)]">Geen planten om te labelen.</p>
      ) : (
        <div className="bw-labelvel grid grid-cols-3 gap-3">
          {labels.map((label) => (
            <div
              key={label.id}
              className="bw-label flex flex-col items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white p-2 text-center"
            >
              <span
                className="block w-full max-w-[96px]"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: label.svg }}
              />
              <span className="w-full truncate text-[11px] font-semibold leading-tight">
                {label.name}
              </span>
              <span className="w-full truncate text-[10px] text-[var(--ink-soft)]">
                {label.location} · {label.code}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
