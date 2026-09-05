import Link from 'next/link';

/** Lege staten zijn instapmomenten, geen mededelingen (OVERDRACHT §10). */
export function LegeStaat() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Voeg je eerste plant toe</h1>
        <p className="mt-1 text-[var(--ink-soft)]">
          Zodra er planten in staan, vult de agenda zich vanzelf met wat er per maand te doen is.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Link href="/planten/nieuw?bron=foto" className="bw-card flex flex-col gap-1 p-4">
          <span aria-hidden className="text-2xl">📷</span>
          <span className="font-semibold">Met een foto</span>
          <span className="text-sm text-[var(--ink-soft)]">
            Herkenning bepaalt de soort en het onderhoud.
          </span>
        </Link>
        <Link href="/planten/nieuw?bron=url" className="bw-card flex flex-col gap-1 p-4">
          <span aria-hidden className="text-2xl">🔗</span>
          <span className="font-semibold">Via een link</span>
          <span className="text-sm text-[var(--ink-soft)]">
            Plak de pagina van de kwekerij of tuincentrum.
          </span>
        </Link>
        <Link href="/planten/nieuw?bron=handmatig" className="bw-card flex flex-col gap-1 p-4">
          <span aria-hidden className="text-2xl">✍️</span>
          <span className="font-semibold">Zelf invullen</span>
          <span className="text-sm text-[var(--ink-soft)]">
            Naam en locatie, de rest stellen we voor.
          </span>
        </Link>
      </div>
    </div>
  );
}
