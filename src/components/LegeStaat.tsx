import Link from 'next/link';

const INGANGEN = [
  {
    href: '/planten/nieuw?bron=foto',
    kleur: 'var(--dahlia)',
    titel: 'Foto maken',
    uitleg: 'Herkenning plus zorgprofiel',
    vorm: 'vierkant' as const,
  },
  {
    href: '/planten/nieuw?bron=url',
    kleur: 'var(--cornflower)',
    titel: 'Link plakken',
    uitleg: 'Vanaf een kwekerij- of infopagina',
    vorm: 'rond' as const,
  },
  {
    href: '/planten/nieuw?bron=handmatig',
    kleur: 'var(--leaf)',
    titel: 'Zelf invullen',
    uitleg: 'Handmatig, met onderhoud-voorstel',
    vorm: 'blok' as const,
  },
];

/** Lege staten zijn instapmomenten, geen mededelingen. */
export function LegeStaat() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="bw-titel">Je eerste plant</h1>
        <p className="mt-1.5 text-[13.5px] text-[var(--ink-soft)]">
          Zodra er planten in staan vult de agenda zich vanzelf met wat er per maand te doen is.
        </p>
      </div>
      <IngangKaarten />
    </div>
  );
}

export function IngangKaarten() {
  return (
    <div className="flex flex-col gap-3">
      {INGANGEN.map((ingang) => (
        <Link
          key={ingang.href}
          href={ingang.href}
          className="bw-card flex items-center gap-3.5 p-[18px]"
        >
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full"
            style={{ background: `color-mix(in srgb, ${ingang.kleur} 10%, transparent)` }}
          >
            <i
              className="block size-4"
              style={{
                border: `2px solid ${ingang.kleur}`,
                borderRadius: ingang.vorm === 'rond' ? '50%' : ingang.vorm === 'vierkant' ? '4px' : '0',
              }}
            />
          </span>
          <span>
            <span className="block text-[15px] font-semibold">{ingang.titel}</span>
            <span className="block text-[12.5px] text-[var(--ink-faint)]">{ingang.uitleg}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
