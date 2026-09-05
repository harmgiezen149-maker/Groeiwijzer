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
    next.delete('label');
    router.replace(`/planten?${next.toString()}`);
  }

  const locatie = params.get('locatie') ?? '';
  const categorie = params.get('categorie') ?? '';
  const archief = params.get('archief') === '1';
  const alleenOpen = params.get('taken') === '1';

  return (
    <div className="flex flex-col gap-2.5">
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
          placeholder="Zoek een plant"
          value={zoek}
          onChange={(event) => setZoek(event.target.value)}
          onBlur={() => zet('q', zoek.trim())}
        />
      </form>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {/* Een select in de vorm van een pil: één tik, geen extra scherm. */}
        <PilSelect
          label="Alle locaties"
          value={locatie}
          opties={locations.map((l) => ({ value: l.id, label: l.name }))}
          onChange={(v) => zet('locatie', v)}
        />
        <PilSelect
          label="Categorie"
          value={categorie}
          opties={categories}
          onChange={(v) => zet('categorie', v)}
        />
        <button
          type="button"
          className="bw-pil"
          aria-pressed={alleenOpen}
          onClick={() => zet('taken', alleenOpen ? '' : '1')}
        >
          Open taken
        </button>
        <button
          type="button"
          className="bw-pil"
          aria-pressed={archief}
          onClick={() => zet('archief', archief ? '' : '1')}
        >
          Archief
        </button>
      </div>
    </div>
  );
}

function PilSelect({
  label,
  value,
  opties,
  onChange,
}: {
  label: string;
  value: string;
  opties: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const gekozen = opties.find((o) => o.value === value);
  return (
    <span className="relative shrink-0">
      <span className="bw-pil" aria-hidden data-actief={Boolean(value)}>
        {gekozen?.label ?? label}
      </span>
      <select
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{label}</option>
        {opties.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
