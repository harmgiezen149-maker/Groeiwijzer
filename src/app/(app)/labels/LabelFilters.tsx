'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function LabelFilters({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="bw-label mb-0" htmlFor="labellocatie">
        Locatie
      </label>
      <select
        id="labellocatie"
        className="bw-select w-auto py-1 text-sm"
        value={params.get('locatie') ?? ''}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          if (event.target.value) next.set('locatie', event.target.value);
          else next.delete('locatie');
          router.replace(`/labels?${next.toString()}`);
        }}
      >
        <option value="">Alle locaties</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button type="button" className="bw-btn bw-btn-primary px-4" onClick={() => window.print()}>
        Printen
      </button>
    </div>
  );
}
