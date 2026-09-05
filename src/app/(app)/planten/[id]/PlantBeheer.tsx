'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import type { PlantStatus } from '@/lib/types';
import { FotoKiezer } from '@/components/FotoKiezer';

export function PlantBeheer({
  plantId,
  status,
  locationId,
  locations,
}: {
  plantId: string;
  status: PlantStatus;
  locationId: string;
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [reden, setReden] = useState('');
  const [nieuweStatus, setNieuweStatus] = useState<PlantStatus | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBezig(true);
    setFout(null);
    try {
      await api(`/api/plants/${plantId}`, { method: 'PATCH', json: body });
      setNieuweStatus(null);
      setReden('');
      router.refresh();
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Opslaan lukte niet');
    } finally {
      setBezig(false);
    }
  }

  async function voegFotoToe(file: File) {
    setBezig(true);
    setFout(null);
    try {
      await uploadFotoNaarPlant(plantId, file);
      router.refresh();
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Foto toevoegen lukte niet');
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {fout ? (
        <p role="alert" className="bw-banner bw-banner-urgent">
          {fout}
        </p>
      ) : null}

      <div className="bw-card-compact flex flex-col gap-3 p-3.5">
        <div>
          <label className="bw-label" htmlFor="verplaats">
            Locatie
          </label>
          <select
            id="verplaats"
            className="bw-select"
            value={locationId}
            disabled={bezig}
            onChange={(event) => void patch({ locationId: event.target.value })}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="bw-label">Foto toevoegen</p>
          <FotoKiezer disabled={bezig} onKies={(file) => void voegFotoToe(file)} />
        </div>
      </div>

      {status === 'levend' ? (
        nieuweStatus ? (
          <form
            className="bw-card-compact flex flex-col gap-3 p-3.5"
            onSubmit={(event) => {
              event.preventDefault();
              void patch({ status: nieuweStatus, statusReason: reden.trim() || undefined });
            }}
          >
            <p className="text-[13.5px] text-[var(--ink-soft)]">
              De plant verdwijnt uit de agenda en de lijst, maar blijft met logboek in het
              archief staan.
            </p>
            <div>
              <label className="bw-label" htmlFor="statusreden">
                Reden (optioneel)
              </label>
              <input
                id="statusreden"
                className="bw-input"
                value={reden}
                onChange={(event) => setReden(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="bw-btn bw-btn-ghost"
                onClick={() => setNieuweStatus(null)}
              >
                Terug
              </button>
              <button className="bw-btn bw-btn-primary flex-1" disabled={bezig}>
                Bevestigen
              </button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              className="bw-btn bw-btn-secondary flex-1 text-[13.5px]"
              onClick={() => setNieuweStatus('dood')}
            >
              Plant is dood
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-secondary flex-1 text-[13.5px]"
              onClick={() => setNieuweStatus('verwijderd')}
            >
              Plant is weg
            </button>
          </div>
        )
      ) : (
        <button
          type="button"
          className="bw-btn bw-btn-secondary"
          disabled={bezig}
          onClick={() => void patch({ status: 'levend', statusReason: undefined })}
        >
          Terugzetten als levend
        </button>
      )}
    </div>
  );
}

async function uploadFotoNaarPlant(plantId: string, file: File): Promise<void> {
  const { verkleinAfbeelding } = await import('@/components/OccurrenceList');
  const verkleind = await verkleinAfbeelding(file);
  const form = new FormData();
  form.append('file', verkleind, 'plant.jpg');
  const res = await fetch(`/api/plants/${plantId}/photos`, { method: 'POST', body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Foto toevoegen lukte niet');
  }
}
