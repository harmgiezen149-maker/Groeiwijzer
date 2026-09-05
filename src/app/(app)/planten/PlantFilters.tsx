'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function PlantFilters({
  locations,
  categories,
}: {
  locations: { id: string; name: string }[];
  categories: { value: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [zoek, setZoek] = useState(params.get('q') ?? '');

  function zet(sleutel: string, waarde: string) {
    const next = new URLSearchParams(params.toString());
    if (waarde) next.set(sleutel, waarde);
    else next.delete(sleutel);
    router.replace(`/planten?${next.toString()}`);
  }

  const archief = params.get('archief') === '1';
  const alleenOpen = params.get('taken') === '1';

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          zet('q', zoek.trim());
        }}
      >
        <label className="sr-only" htmlFor="zoek">
          Zoek een plant
        </label>
        <input
          id="zoek"
          className="bw-input"
          type="search"
          placeholder="Zoek op naam"
          value={zoek}
          onChange={(event) => setZoek(event.target.value)}
          onBlur={() => zet('q', zoek.trim())}
        />
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
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

        <select
          className="bw-select w-auto shrink-0 py-1 text-sm"
          aria-label="Filter op categorie"
          value={params.get('categorie') ?? ''}
          onChange={(event) => zet('categorie', event.target.value)}
        >
          <option value="">Alle soorten</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`bw-btn shrink-0 px-3 text-sm ${alleenOpen ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
          aria-pressed={alleenOpen}
          onClick={() => zet('taken', alleenOpen ? '' : '1')}
        >
          Open taken
        </button>

        <button
          type="button"
          className={`bw-btn shrink-0 px-3 text-sm ${archief ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
          aria-pressed={archief}
          onClick={() => zet('archief', archief ? '' : '1')}
        >
          Archief
        </button>
      </div>
    </div>
  );
}
