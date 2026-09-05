'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import type { Location, Soil, Sun } from '@/lib/types';

const SUN: Sun[] = ['zon', 'halfschaduw', 'schaduw'];
const SOIL: Soil[] = ['zand', 'klei', 'veen', 'leem', 'potgrond', 'onbekend'];

type Concept = Omit<Location, 'id' | 'sortOrder'> & { id?: string };

const LEEG: Concept = { name: '', outdoor: true, sun: 'zon', soil: 'onbekend', notes: '' };

export function LocatieBeheer({
  locations,
  aantallen,
}: {
  locations: Location[];
  aantallen: Record<string, number>;
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
      router.refresh();
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Verwijderen lukte niet');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {fout ? (
        <p role="alert" className="bw-card border-[var(--zinnia)] p-3 text-sm">
          {fout}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {locations.map((locatie) => (
          <li key={locatie.id} className="bw-card flex items-center gap-3 p-3">
            <span aria-hidden className="text-xl">
              {locatie.outdoor ? '🌤' : '🏠'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{locatie.name}</span>
              <span className="block text-sm text-[var(--ink-soft)]">
                {locatie.outdoor ? 'Buiten' : 'Binnen'} · {locatie.sun}
                {locatie.soil && locatie.soil !== 'onbekend' ? ` · ${locatie.soil}` : ''} ·{' '}
                {aantallen[locatie.id] ?? 0} planten
              </span>
            </span>
            <button
              type="button"
              className="bw-btn bw-btn-ghost px-3 text-sm"
              onClick={() => setConcept({ ...locatie })}
            >
              Wijzig
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-ghost px-3 text-sm"
              onClick={() => verwijderen(locatie.id)}
            >
              Weg
            </button>
          </li>
        ))}
      </ul>

      {concept ? (
        <form
          className="bw-card flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void opslaan();
          }}
        >
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

          <div className="flex justify-end gap-2">
            <button type="button" className="bw-btn bw-btn-ghost" onClick={() => setConcept(null)}>
              Terug
            </button>
            <button className="bw-btn bw-btn-primary" disabled={bezig}>
              {bezig ? 'Bezig…' : 'Bewaren'}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="bw-btn bw-btn-secondary w-full"
          onClick={() => setConcept({ ...LEEG })}
        >
          Locatie toevoegen
        </button>
      )}
    </div>
  );
}
