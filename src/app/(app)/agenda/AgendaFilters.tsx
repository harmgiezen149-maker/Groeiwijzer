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
    router.replace(`/agenda?${next.toString()}`, { scroll: false });
  }

  const gedaan = params.get('gedaan') === '1';
  const type = params.get('type') ?? '';
  const locatie = params.get('locatie') ?? '';

  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      <PilSelect
        label="Alle taken"
        value={type}
        opties={types}
        onChange={(v) => zet('type', v)}
      />
      <PilSelect
        label="Alle locaties"
        value={locatie}
        opties={locations.map((l) => ({ value: l.id, label: l.name }))}
        onChange={(v) => zet('locatie', v)}
      />
      <button
        type="button"
        aria-pressed={gedaan}
        className="bw-pil"
        onClick={() => zet('gedaan', gedaan ? '' : '1')}
      >
        Ook afgevinkt
      </button>
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
    <span className="relative inline-flex min-h-[var(--tap)] shrink-0 items-center">
      <span className="bw-pil" aria-hidden data-actief={Boolean(value)}>
        {gekozen?.label ?? label}
      </span>
      <select
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0"
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
