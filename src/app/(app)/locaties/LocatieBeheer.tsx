'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import type { Location, Soil, Sun } from '@/lib/types';

const SUN: Sun[] = ['zon', 'halfschaduw', 'schaduw'];
const SOIL: Soil[] = ['zand', 'klei', 'veen', 'leem', 'potgrond', 'onbekend'];

/** De stip vertelt hoeveel zon er staat. */
const ZONKLEUR: Record<Sun, string> = {
  zon: 'var(--zinnia)',
  halfschaduw: 'var(--leaf)',
  schaduw: 'var(--cornflower)',
};

type Concept = Omit<Location, 'id' | 'sortOrder'> & { id?: string };

const LEEG: Concept = { name: '', outdoor: true, sun: 'zon', soil: 'onbekend', notes: '' };

export function LocatieBeheer({
  locations,
  planten,
  open,
}: {
  locations: Location[];
  planten: Record<string, number>;
  open: Record<string, number>;
}) {
  const router = useRouter();
  const [concept, setConcept] = useState<Concept | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function opslaan() {
    if (!concept) return;
    setBezig(true);
    setFout(null);
    try {
      const body = {
        name: concept.name,
        outdoor: concept.outdoor,
        sun: concept.sun,
        soil: concept.soil,
        notes: concept.notes || undefined,
      };
      if (concept.id) await api(`/api/locations/${concept.id}`, { method: 'PATCH', json: body });
      else await api('/api/locations', { method: 'POST', json: body });
      setConcept(null);
      router.refresh();
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Opslaan lukte niet');
    } finally {
      setBezig(false);
    }
  }

  async function verwijderen(id: string) {
    setFout(null);
    try {
      await api(`/api/locations/${id}`, { method: 'DELETE' });
      setConcept(null);
      router.refresh();
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Verwijderen lukte niet');
    }
  }

  if (concept) {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void opslaan();
        }}
      >
        {fout ? (
          <p role="alert" className="bw-banner bw-banner-urgent">
            {fout}
          </p>
        ) : null}

        <div>
          <label className="bw-label" htmlFor="naam">
            Naam
          </label>
          <input
            id="naam"
            className="bw-input"
            required
            value={concept.name}
            onChange={(e) => setConcept({ ...concept, name: e.target.value })}
            placeholder="Achtertuin border noord"
          />
        </div>

        <fieldset>
          <legend className="bw-label">Binnen of buiten</legend>
          <div className="flex gap-2">
            {[true, false].map((buiten) => (
              <button
                key={String(buiten)}
                type="button"
                className={`bw-btn flex-1 ${
                  concept.outdoor === buiten ? 'bw-btn-primary' : 'bw-btn-secondary'
                }`}
                aria-pressed={concept.outdoor === buiten}
                onClick={() => setConcept({ ...concept, outdoor: buiten })}
              >
                {buiten ? 'Buiten' : 'Binnen'}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="bw-label" htmlFor="zon">
              Zon
            </label>
            <select
              id="zon"
              className="bw-select"
              value={concept.sun}
              onChange={(e) => setConcept({ ...concept, sun: e.target.value as Sun })}
            >
              {SUN.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="bw-label" htmlFor="grond">
              Grond
            </label>
            <select
              id="grond"
              className="bw-select"
              value={concept.soil ?? 'onbekend'}
              onChange={(e) => setConcept({ ...concept, soil: e.target.value as Soil })}
            >
              {SOIL.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="bw-label" htmlFor="notitie">
            Notitie
          </label>
          <textarea
            id="notitie"
            className="bw-textarea"
            value={concept.notes ?? ''}
            onChange={(e) => setConcept({ ...concept, notes: e.target.value })}
          />
        </div>

        <div className="flex gap-2">
          <button type="button" className="bw-btn bw-btn-ghost" onClick={() => setConcept(null)}>
            Terug
          </button>
          <button className="bw-btn bw-btn-primary flex-1" disabled={bezig}>
            {bezig ? 'Bezig…' : 'Bewaren'}
          </button>
        </div>
        {concept.id ? (
          <button
            type="button"
            className="bw-btn bw-btn-gevaar"
            onClick={() => void verwijderen(concept.id!)}
          >
            Locatie verwijderen
          </button>
        ) : null}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {fout ? (
        <p role="alert" className="bw-banner bw-banner-urgent">
          {fout}
        </p>
      ) : null}

      {locations.map((locatie) => {
        const aantal = planten[locatie.id] ?? 0;
        const openTaken = open[locatie.id] ?? 0;
        return (
          <button
            key={locatie.id}
            type="button"
            className="bw-paneel px-4 py-3.5 text-left"
            onClick={() => setConcept({ ...locatie })}
          >
            <span className="block text-[15px] font-semibold">{locatie.name}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[var(--ink-faint)]">
              <i aria-hidden className="bw-stip" style={{ background: ZONKLEUR[locatie.sun] }} />
              {locatie.outdoor ? locatie.sun : 'binnen'} · {aantal}{' '}
              {aantal === 1 ? 'plant' : 'planten'} · {openTaken}{' '}
              {openTaken === 1 ? 'open taak' : 'open taken'}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        className="bw-btn bw-btn-nieuw w-full"
        onClick={() => setConcept({ ...LEEG })}
      >
        + Nieuwe locatie
      </button>
    </div>
  );
}
