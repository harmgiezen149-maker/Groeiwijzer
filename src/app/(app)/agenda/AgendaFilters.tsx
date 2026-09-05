'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function AgendaFilters({
  types,
  locations,
}: {
  types: { value: string; label: string }[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function zet(sleutel: string, waarde: string) {
    const next = new URLSearchParams(params.toString());
    if (waarde) next.set(sleutel, waarde);
    else next.delete(sleutel);
    router.replace(`/agenda?${next.toString()}`);
  }

  const gedaan = params.get('gedaan') === '1';

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <select
        className="bw-select w-auto shrink-0 py-1 text-sm"
        aria-label="Filter op soort werk"
        value={params.get('type') ?? ''}
        onChange={(event) => zet('type', event.target.value)}
      >
        <option value="">Alle taken</option>
        {types.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <select
        className="bw-select w-auto shrink-0 py-1 text-sm"
        aria-label="Filter op locatie"
        value={params.get('locatie') ?? ''}
        onChange={(event) => zet('locatie', event.target.value)}
      >
        <option value="">Alle locaties</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        aria-pressed={gedaan}
        className={`bw-btn shrink-0 px-3 text-sm ${gedaan ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
        onClick={() => zet('gedaan', gedaan ? '' : '1')}
      >
        Ook afgevinkt
      </button>
    </div>
  );
}
