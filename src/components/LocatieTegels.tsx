import type { AgendaRow } from '@/lib/dto';

/** Vijf paren tint/inkt, in vaste volgorde per locatie. */
const KLEUREN = [
  { vlak: 'var(--tint-leaf)', inkt: 'var(--op-leaf)' },
  { vlak: 'var(--tint-dahlia)', inkt: 'var(--op-dahlia)' },
  { vlak: 'var(--tint-cornflower)', inkt: 'var(--op-cornflower)' },
  { vlak: 'var(--tint-lila)', inkt: 'var(--op-lila)' },
  { vlak: 'var(--tint-zinnia)', inkt: 'var(--op-zinnia)' },
];

/**
 * Kleurstrook boven de takenlijst: per locatie hoeveel er nog open staat.
 * In één oogopslag zie je waar het werk ligt, en het geeft het scherm kleur.
 */
export function LocatieTegels({ rows }: { rows: AgendaRow[] }) {
  const perLocatie = new Map<string, { naam: string; aantal: number }>();
  for (const row of rows) {
    const huidig = perLocatie.get(row.locationId) ?? { naam: row.locationName, aantal: 0 };
    huidig.aantal += 1;
    perLocatie.set(row.locationId, huidig);
  }

  const tegels = [...perLocatie.values()].sort((a, b) => b.aantal - a.aantal);
  if (tegels.length < 2) return null;

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tegels.slice(0, 4).map((tegel, i) => {
        const kleur = KLEUREN[i % KLEUREN.length];
        return (
          <li
            key={tegel.naam}
            className="bw-tegel"
            style={{ background: kleur.vlak, color: kleur.inkt }}
          >
            <span className="bw-tegel-getal">{tegel.aantal}</span>
            <span className="bw-tegel-naam">{tegel.naam}</span>
          </li>
        );
      })}
    </ul>
  );
}
