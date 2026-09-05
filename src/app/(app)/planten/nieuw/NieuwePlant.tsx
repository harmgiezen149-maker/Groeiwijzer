'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { verkleinAfbeelding } from '@/components/OccurrenceList';
import { TaakEditor, type TaakConcept } from '@/components/TaakEditor';
import { PlantFoto } from '@/components/PlantFoto';
import { CATEGORY_LABEL } from '@/lib/ui';
import { PLANT_CATEGORIES } from '@/lib/types';
import type { Location, PlantCandidate, PlantCategory } from '@/lib/types';

type Bron = 'foto' | 'url' | 'handmatig';

interface Profiel {
  commonName: string;
  scientificName?: string | null;
  category: PlantCategory;
  confidence: number;
  frostSensitive: boolean;
  droughtSensitive: boolean;
  hardiness?: string | null;
  tasks: Omit<TaakConcept, 'source' | 'enabled'>[];
}

interface Concept {
  commonName: string;
  scientificName: string;
  cultivar: string;
  category: PlantCategory;
  quantity: number;
  notes: string;
  hardiness: string;
  frostSensitive: boolean;
  droughtSensitive: boolean;
  photoUrl?: string;
  sourceUrl?: string;
}

const LEEG: Concept = {
  commonName: '',
  scientificName: '',
  cultivar: '',
  category: 'vaste plant',
  quantity: 1,
  notes: '',
  hardiness: '',
  frostSensitive: false,
  droughtSensitive: false,
};

export function NieuwePlant({
  locations,
  startBron,
}: {
  locations: Location[];
  startBron: Bron;
}) {
  const router = useRouter();
  const [bron, setBron] = useState<Bron>(startBron);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [stap, setStap] = useState<'invoer' | 'bevestigen'>('invoer');
  const [concept, setConcept] = useState<Concept>({ ...LEEG });
  const [taken, setTaken] = useState<TaakConcept[]>([]);
  const [kandidaten, setKandidaten] = useState<PlantCandidate[]>([]);
  const [meldingen, setMeldingen] = useState<string[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [url, setUrl] = useState('');

  const locatie = locations.find((l) => l.id === locationId);
  const outdoor = locatie?.outdoor ?? true;

  function pasProfielToe(profiel: Profiel | null, extra: Partial<Concept> = {}) {
    if (profiel) {
      setConcept((huidig) => ({
        ...huidig,
        commonName: profiel.commonName || huidig.commonName,
        scientificName: profiel.scientificName ?? '',
        category: profiel.category,
        hardiness: profiel.hardiness ?? '',
        frostSensitive: profiel.frostSensitive,
        droughtSensitive: profiel.droughtSensitive,
        ...extra,
      }));
      setTaken(
        profiel.tasks.map((taak) => ({ ...taak, source: 'ai' as const, enabled: true })),
      );
    } else {
      setConcept((huidig) => ({ ...huidig, ...extra }));
    }
    setStap('bevestigen');
  }

  async function herkenFoto(file: File) {
    setBezig(true);
    setFout(null);
    setMeldingen([]);
    try {
      const verkleind = await verkleinAfbeelding(file);
      const form = new FormData();
      form.append('file', verkleind, 'plant.jpg');
      form.append('locationId', locationId);
      const res = await fetch('/api/plants/identify', { method: 'POST', body: form });
      const data = (await res.json()) as {
        error?: string;
        photoUrl?: string;
        candidates?: PlantCandidate[];
        profile?: Profiel | null;
        notes?: string[];
      };
      if (!res.ok) throw new Error(data.error ?? 'Herkennen lukte niet');
      setKandidaten(data.candidates ?? []);
      setMeldingen(data.notes ?? []);
      pasProfielToe(data.profile ?? null, { photoUrl: data.photoUrl });
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Herkennen lukte niet');
    } finally {
      setBezig(false);
    }
  }

  async function haalUrl() {
    setBezig(true);
    setFout(null);
    setMeldingen([]);
    try {
      const data = await api<{ profile: Profiel | null; notes?: string[]; sourceUrl: string }>(
        '/api/plants/from-url',
        { method: 'POST', json: { url, locationId } },
      );
      setMeldingen(data.notes ?? []);
      pasProfielToe(data.profile, { sourceUrl: data.sourceUrl });
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Ophalen lukte niet');
    } finally {
      setBezig(false);
    }
  }

  async function stelOnderhoudVoor() {
    if (!concept.commonName.trim()) {
      setFout('Vul eerst een naam in.');
      return;
    }
    setBezig(true);
    setFout(null);
    setMeldingen([]);
    try {
      const data = await api<{ profile: Profiel | null; note?: string }>(
        '/api/plants/suggest-care',
        {
          method: 'POST',
          json: { name: concept.commonName, category: concept.category, locationId },
        },
      );
      if (data.note) setMeldingen([data.note]);
      if (data.profile) {
        setConcept((huidig) => ({
          ...huidig,
          scientificName: data.profile!.scientificName ?? huidig.scientificName,
          category: data.profile!.category,
          hardiness: data.profile!.hardiness ?? huidig.hardiness,
          frostSensitive: data.profile!.frostSensitive,
          droughtSensitive: data.profile!.droughtSensitive,
        }));
        setTaken(data.profile.tasks.map((t) => ({ ...t, source: 'ai' as const, enabled: true })));
      }
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Voorstellen lukte niet');
    } finally {
      setBezig(false);
    }
  }

  async function opslaan() {
    setBezig(true);
    setFout(null);
    try {
      const data = await api<{ plant: { id: string } }>('/api/plants', {
        method: 'POST',
        json: {
          locationId,
          commonName: concept.commonName.trim(),
          scientificName: concept.scientificName.trim() || undefined,
          cultivar: concept.cultivar.trim() || undefined,
          category: concept.category,
          quantity: concept.quantity,
          notes: concept.notes.trim() || undefined,
          hardiness: concept.hardiness.trim() || undefined,
          frostSensitive: concept.frostSensitive,
          droughtSensitive: concept.droughtSensitive,
          photoUrl: concept.photoUrl,
          sourceUrl: concept.sourceUrl,
          source: bron,
          tasks: taken.filter((t) => t.enabled && t.title.trim()),
          identification: kandidaten.length
            ? { plantnet: kandidaten.map((c) => ({ name: c.name, score: c.score })) }
            : undefined,
        },
      });
      router.push(`/planten/${data.plant.id}`);
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Opslaan lukte niet');
      setBezig(false);
    }
  }

  if (locations.length === 0) {
    return (
      <p className="bw-card p-5">
        Maak eerst een locatie aan bij <a href="/locaties">Locaties</a>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {fout ? (
        <p role="alert" className="bw-card border-[var(--zinnia)] p-3 text-sm">
          {fout}
        </p>
      ) : null}
      {meldingen.map((melding) => (
        <p key={melding} className="bw-card p-3 text-sm text-[var(--ink-soft)]">
          {melding}
        </p>
      ))}

      <div>
        <label className="bw-label" htmlFor="locatie">
          Locatie
        </label>
        <select
          id="locatie"
          className="bw-select"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.outdoor ? 'buiten' : 'binnen'})
            </option>
          ))}
        </select>
      </div>

      {stap === 'invoer' ? (
        <>
          <div className="flex gap-2" role="tablist" aria-label="Manier van toevoegen">
            {(['foto', 'url', 'handmatig'] as Bron[]).map((optie) => (
              <button
                key={optie}
                role="tab"
                type="button"
                aria-selected={bron === optie}
                className={`bw-btn flex-1 text-sm ${bron === optie ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                onClick={() => setBron(optie)}
              >
                {optie === 'foto' ? 'Foto' : optie === 'url' ? 'Link' : 'Zelf invullen'}
              </button>
            ))}
          </div>

          {bron === 'foto' ? (
            <div className="bw-card flex flex-col gap-3 p-4">
              <p className="text-sm text-[var(--ink-soft)]">
                Maak een foto van blad, bloem of de hele plant. Twee bronnen bepalen samen de
                soort; je bevestigt daarna zelf.
              </p>
              <input
                className="bw-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                disabled={bezig}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void herkenFoto(file);
                }}
              />
              {bezig ? <p className="text-sm">Bezig met herkennen…</p> : null}
            </div>
          ) : null}

          {bron === 'url' ? (
            <div className="bw-card flex flex-col gap-3 p-4">
              <label className="bw-label" htmlFor="url">
                Link naar de plantpagina
              </label>
              <input
                id="url"
                className="bw-input"
                type="url"
                placeholder="https://"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="bw-btn bw-btn-primary flex-1"
                  disabled={bezig || !url.trim()}
                  onClick={() => void haalUrl()}
                >
                  {bezig ? 'Bezig…' : 'Ophalen'}
                </button>
                <button
                  type="button"
                  className="bw-btn bw-btn-secondary"
                  onClick={() => {
                    setBron('handmatig');
                    setStap('bevestigen');
                  }}
                >
                  Zelf invullen
                </button>
              </div>
            </div>
          ) : null}

          {bron === 'handmatig' ? (
            <div className="bw-card flex flex-col gap-3 p-4">
              <div>
                <label className="bw-label" htmlFor="naam">
                  Naam van de plant
                </label>
                <input
                  id="naam"
                  className="bw-input"
                  value={concept.commonName}
                  onChange={(event) =>
                    setConcept({ ...concept, commonName: event.target.value })
                  }
                  placeholder="Hortensia"
                />
              </div>
              <button
                type="button"
                className="bw-btn bw-btn-primary"
                disabled={!concept.commonName.trim()}
                onClick={() => setStap('bevestigen')}
              >
                Verder
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void opslaan();
          }}
        >
          {concept.photoUrl ? (
            <PlantFoto
              url={concept.photoUrl}
              alt=""
              className="h-48 w-full rounded-[var(--radius)]"
            />
          ) : null}

          {kandidaten.length ? (
            <div className="bw-card p-4">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                Gevonden kandidaten
              </h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {kandidaten.map((kandidaat) => (
                  <li key={kandidaat.name} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="bw-btn bw-btn-secondary px-3 text-sm"
                      onClick={() =>
                        setConcept({
                          ...concept,
                          commonName: kandidaat.name,
                          scientificName: kandidaat.scientificName ?? concept.scientificName,
                        })
                      }
                    >
                      Kies
                    </button>
                    <span className="min-w-0 flex-1 truncate">
                      {kandidaat.name}
                      {kandidaat.scientificName ? (
                        <span className="text-[var(--ink-soft)]"> · {kandidaat.scientificName}</span>
                      ) : null}
                    </span>
                    <span className="bw-chip shrink-0">{Math.round(kandidaat.score * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="bw-card flex flex-col gap-3 p-4">
            <div>
              <label className="bw-label" htmlFor="naam2">
                Naam
              </label>
              <input
                id="naam2"
                className="bw-input"
                required
                value={concept.commonName}
                onChange={(e) => setConcept({ ...concept, commonName: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="bw-label" htmlFor="wetenschappelijk">
                  Wetenschappelijke naam
                </label>
                <input
                  id="wetenschappelijk"
                  className="bw-input"
                  value={concept.scientificName}
                  onChange={(e) => setConcept({ ...concept, scientificName: e.target.value })}
                />
              </div>
              <div>
                <label className="bw-label" htmlFor="cultivar">
                  Cultivar
                </label>
                <input
                  id="cultivar"
                  className="bw-input"
                  value={concept.cultivar}
                  onChange={(e) => setConcept({ ...concept, cultivar: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="bw-label" htmlFor="categorie">
                  Soort
                </label>
                <select
                  id="categorie"
                  className="bw-select"
                  value={concept.category}
                  onChange={(e) =>
                    setConcept({ ...concept, category: e.target.value as PlantCategory })
                  }
                >
                  {PLANT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="bw-label" htmlFor="aantal">
                  Aantal
                </label>
                <input
                  id="aantal"
                  className="bw-input"
                  type="number"
                  min={1}
                  max={999}
                  value={concept.quantity}
                  onChange={(e) => setConcept({ ...concept, quantity: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="bw-label" htmlFor="winterhard">
                Winterhardheid
              </label>
              <input
                id="winterhard"
                className="bw-input"
                value={concept.hardiness}
                onChange={(e) => setConcept({ ...concept, hardiness: e.target.value })}
                placeholder="winterhard tot ongeveer -15 °C"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={concept.frostSensitive}
                  onChange={(e) => setConcept({ ...concept, frostSensitive: e.target.checked })}
                />
                Vorstgevoelig
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={concept.droughtSensitive}
                  onChange={(e) => setConcept({ ...concept, droughtSensitive: e.target.checked })}
                />
                Droogtegevoelig
              </label>
            </div>
            <div>
              <label className="bw-label" htmlFor="notities">
                Notities
              </label>
              <textarea
                id="notities"
                className="bw-textarea"
                value={concept.notes}
                onChange={(e) => setConcept({ ...concept, notes: e.target.value })}
              />
            </div>
          </div>

          <section className="bw-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-bold">Onderhoud</h2>
              <button
                type="button"
                className="bw-btn bw-btn-secondary ml-auto px-3 text-sm"
                disabled={bezig}
                onClick={() => void stelOnderhoudVoor()}
              >
                {bezig ? 'Bezig…' : 'Onderhoud voorstellen'}
              </button>
            </div>
            <TaakEditor taken={taken} onChange={setTaken} outdoor={outdoor} />
          </section>

          <div className="flex gap-2">
            <button
              type="button"
              className="bw-btn bw-btn-ghost"
              onClick={() => setStap('invoer')}
            >
              Terug
            </button>
            <button
              className="bw-btn bw-btn-primary flex-1"
              disabled={bezig || !concept.commonName.trim()}
            >
              {bezig ? 'Bezig…' : 'Plant bewaren'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
