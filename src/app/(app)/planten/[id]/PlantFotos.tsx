'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { verkleinAfbeelding } from '@/components/OccurrenceList';
import { FotoKiezer } from '@/components/FotoKiezer';
import { PlantFoto } from '@/components/PlantFoto';
import { formatDate } from '@/lib/dates';

interface Foto {
  url: string;
  takenAt: string;
  caption?: string;
}

/**
 * De foto's van één plant. De nieuwste foto wordt de hoofdfoto — die zie je
 * boven aan de pagina en in de takenlijst terug — en een oudere is met één
 * tik weer als hoofdfoto te kiezen.
 */
export function PlantFotos({
  plantId,
  photos,
  hoofdfoto,
}: {
  plantId: string;
  photos: Foto[];
  hoofdfoto?: string;
}) {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  /** Welke foto op het punt staat verwijderd te worden; tweede tik bevestigt. */
  const [weg, setWeg] = useState<string | null>(null);

  async function doe(werk: () => Promise<unknown>, watGingMis: string) {
    setBezig(true);
    setFout(null);
    try {
      await werk();
      setWeg(null);
      router.refresh();
    } catch (error) {
      setFout(error instanceof Error ? error.message : watGingMis);
    } finally {
      setBezig(false);
    }
  }

  function nieuweFoto(file: File) {
    void doe(async () => {
      const verkleind = await verkleinAfbeelding(file);
      const form = new FormData();
      form.append('file', verkleind, 'plant.jpg');
      // Een verse foto laat zien hoe de plant er nu bij staat.
      form.append('hoofdfoto', '1');
      const res = await fetch(`/api/plants/${plantId}/photos`, { method: 'POST', body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Foto opslaan lukte niet');
      }
    }, 'Foto opslaan lukte niet');
  }

  function maakHoofdfoto(url: string) {
    void doe(
      () => api(`/api/plants/${plantId}`, { method: 'PATCH', json: { photoUrl: url } }),
      'Hoofdfoto wijzigen lukte niet',
    );
  }

  function verwijder(url: string) {
    void doe(
      () =>
        api(`/api/plants/${plantId}/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' }),
      'Foto verwijderen lukte niet',
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {fout ? (
        <p role="alert" className="bw-banner bw-banner-urgent">
          {fout}
        </p>
      ) : null}

      {photos.length ? (
        <ul className="grid grid-cols-2 gap-3">
          {photos.map((foto, index) => {
            const isHoofd = foto.url === hoofdfoto;
            return (
              <li key={foto.url} className="relative">
                {isHoofd ? (
                  <span className="block">
                    <PlantFoto
                      url={foto.url}
                      alt={foto.caption ?? ''}
                      variant={((index % 3) + 1) as 1 | 2 | 3}
                      className="aspect-square w-full"
                    />
                    <span
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                      style={{ background: 'var(--leaf-dark)', color: '#fff' }}
                    >
                      hoofdfoto
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="block w-full"
                    disabled={bezig}
                    aria-label={`Deze foto als hoofdfoto instellen (${formatDate(foto.takenAt.slice(0, 10))})`}
                    onClick={() => maakHoofdfoto(foto.url)}
                  >
                    <PlantFoto
                      url={foto.url}
                      alt=""
                      variant={((index % 3) + 1) as 1 | 2 | 3}
                      className="aspect-square w-full"
                    />
                    <span
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                      style={{ background: '#ffffffe6', color: 'var(--ink-soft)' }}
                    >
                      kies deze
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  className="absolute right-0 top-0 grid size-11 place-items-center"
                  disabled={bezig}
                  aria-label={`Foto verwijderen (${formatDate(foto.takenAt.slice(0, 10))})`}
                  onClick={() => (weg === foto.url ? verwijder(foto.url) : setWeg(foto.url))}
                >
                  <span
                    className="grid h-7 min-w-7 place-items-center rounded-full px-2 text-[11px] font-bold"
                    style={
                      weg === foto.url
                        ? { background: 'var(--wijnrood)', color: '#fff' }
                        : { background: '#ffffffe6', color: 'var(--ink-soft)' }
                    }
                  >
                    {weg === foto.url ? (
                      'zeker?'
                    ) : (
                      <svg
                        aria-hidden
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      >
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-[var(--ink-quiet)]">
          Nog geen foto. Maak er een, dan staat de plant er meteen bij in de lijst.
        </p>
      )}

      <FotoKiezer disabled={bezig} onKies={nieuweFoto} />
    </div>
  );
}
