'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { verkleinAfbeelding } from '@/components/OccurrenceList';
import { TaakEditor, type TaakConcept } from '@/components/TaakEditor';
import { PlantFoto } from '@/components/PlantFoto';
import { FotoKiezer } from '@/components/FotoKiezer';
import { beschrijfPlanningKort } from '@/lib/schedule-text';
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

const INGANGEN: { bron: Bron; titel: string; uitleg: string; kleur: string; vorm: string }[] = [
  {
    bron: 'foto',
    titel: 'Foto maken',
    uitleg: 'Herkenning plus zorgprofiel',
    kleur: 'var(--dahlia)',
    vorm: '4px',
  },
  {
    bron: 'url',
    titel: 'Link plakken',
    uitleg: 'Vanaf een kwekerij- of infopagina',
    kleur: 'var(--cornflower)',
    vorm: '50%',
  },
  {
    bron: 'handmatig',
    titel: 'Zelf invullen',
    uitleg: 'Handmatig, met onderhoud-voorstel',
    kleur: 'var(--leaf)',
    vorm: '0',
  },
];

export function NieuwePlant({
  locations,
  startBron,
}: {
  locations: Location[];
  startBron: Bron | null;
}) {
  const router = useRouter();
  const [bron, setBron] = useState<Bron | null>(startBron);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [stap, setStap] = useState<'kies' | 'invoer' | 'bevestigen'>(
    startBron ? 'invoer' : 'kies',
  );
  const [concept, setConcept] = useState<Concept>({ ...LEEG });
  const [taken, setTaken] = useState<TaakConcept[]>([]);
  const [kandidaten, setKandidaten] = useState<PlantCandidate[]>([]);
  const [gekozenKandidaat, setGekozenKandidaat] = useState<string | null>(null);
  const [meldingen, setMeldingen] = useState<string[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [voortgang, setVoortgang] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [alleTaken, setAlleTaken] = useState(false);

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
      setTaken(profiel.tasks.map((taak) => ({ ...taak, source: 'ai' as const, enabled: true })));
    } else {
      setConcept((huidig) => ({ ...huidig, ...extra }));
    }
    setStap('bevestigen');
  }

  /**
   * Twee stappen: eerst de soort en de foto, daarna het onderhoudsvoorstel.
   * Zo blijft elke aanroep ruim binnen de tijd die een serverfunctie heeft, en
   * ziet de gebruiker de soort al terwijl het profiel nog loopt.
   */
  async function herkenFoto(file: File) {
    setBezig(true);
    setFout(null);
    setMeldingen([]);
    setVoortgang('Foto versturen…');
    try {
      const verkleind = await verkleinAfbeelding(file);
      const form = new FormData();
      form.append('file', verkleind, 'plant.jpg');
      form.append('locationId', locationId);
      setVoortgang('Soort zoeken…');
      const res = await fetch('/api/plants/identify', { method: 'POST', body: form });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        photoUrl?: string;
        photoRef?: string;
        candidates?: PlantCandidate[];
        notes?: string[];
      };
      if (!res.ok) throw new Error(data.error ?? 'Herkennen lukte niet');

      const gevonden = data.candidates ?? [];
      const eerste = gevonden[0]?.name ?? null;
      setKandidaten(gevonden);
      setGekozenKandidaat(eerste);
      const meldingen = [...(data.notes ?? [])];

      setVoortgang(eerste ? `${eerste} — onderhoud voorstellen…` : 'Onderhoud voorstellen…');
      try {
        const profiel = await api<{ profile: Profiel | null; note?: string }>(
          '/api/plants/suggest-care',
          {
            method: 'POST',
            json: {
              locationId,
              photoRef: data.photoRef,
              name: eerste ?? undefined,
              candidates: gevonden.map((c) => ({
                name: c.name,
                scientificName: c.scientificName,
                score: c.score,
              })),
            },
          },
        );
        if (profiel.note) meldingen.push(profiel.note);
        setMeldingen(meldingen);
        pasProfielToe(profiel.profile, { photoUrl: data.photoUrl });
      } catch (error) {
        // De soort en de foto zijn er al; alleen het voorstel ontbreekt.
        meldingen.push(
          error instanceof Error ? error.message : 'Het onderhoudsvoorstel lukte niet.',
        );
        setMeldingen(meldingen);
        setConcept((huidig) => ({
          ...huidig,
          commonName: eerste ?? huidig.commonName,
          photoUrl: data.photoUrl,
        }));
        setStap('bevestigen');
      }
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Herkennen lukte niet');
    } finally {
      setVoortgang(null);
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
      setStap('bevestigen');
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
          source: bron ?? 'handmatig',
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
      <p className="bw-card p-5 text-[13.5px]">
        Maak eerst een locatie aan bij{' '}
        <a href="/locaties" className="underline">
          Locaties
        </a>
        .
      </p>
    );
  }

  const berichten = (
    <>
      {fout ? (
        <p role="alert" className="bw-banner bw-banner-urgent">
          {fout}
        </p>
      ) : null}
      {meldingen.map((melding) => (
        <p key={melding} className="bw-banner bw-banner-info">
          {melding}
        </p>
      ))}
    </>
  );

  const locatieKiezer = (
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
  );

  /* ------------------------------------------------------------- kiezen */

  if (stap === 'kies') {
    return (
      <div className="flex flex-col gap-4">
        {berichten}
        <p className="text-[13.5px] text-[var(--ink-soft)]">Kies hoe je wilt beginnen.</p>
        {INGANGEN.map((ingang) => (
          <button
            key={ingang.bron}
            type="button"
            className="bw-card flex items-center gap-3.5 p-[18px] text-left"
            onClick={() => {
              setBron(ingang.bron);
              setStap('invoer');
            }}
          >
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-full"
              style={{ background: `color-mix(in srgb, ${ingang.kleur} 10%, transparent)` }}
            >
              <i
                className="block size-4"
                style={{ border: `2px solid ${ingang.kleur}`, borderRadius: ingang.vorm }}
              />
            </span>
            <span>
              <span className="block text-[15px] font-semibold">{ingang.titel}</span>
              <span className="block text-[12.5px] text-[var(--ink-faint)]">{ingang.uitleg}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  /* ------------------------------------------------------------- invoer */

  if (stap === 'invoer') {
    return (
      <div className="flex flex-col gap-4">
        {berichten}
        {locatieKiezer}

        {bron === 'foto' ? (
          <div className="flex flex-col gap-3">
            <p className="text-[13.5px] text-[var(--ink-soft)]">
              Maak een foto van blad, bloem of de hele plant. Twee bronnen bepalen samen de soort;
              je bevestigt daarna zelf.
            </p>
            <FotoKiezer disabled={bezig} onKies={(file) => void herkenFoto(file)} />
            {bezig ? (
              <p className="text-[13.5px]" role="status">
                {voortgang ?? 'Bezig met herkennen…'}
              </p>
            ) : null}
          </div>
        ) : null}

        {bron === 'url' ? (
          <div className="flex flex-col gap-3">
            <div>
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
            </div>
            <button
              type="button"
              className="bw-btn bw-btn-primary h-[50px] w-full"
              disabled={bezig || !url.trim()}
              onClick={() => void haalUrl()}
            >
              {bezig ? 'Bezig…' : 'Ophalen'}
            </button>
          </div>
        ) : null}

        {bron === 'handmatig' ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="bw-label" htmlFor="naam">
                Naam
              </label>
              <input
                id="naam"
                className="bw-input"
                value={concept.commonName}
                onChange={(event) => setConcept({ ...concept, commonName: event.target.value })}
                placeholder="Lavendel"
              />
            </div>
            <div>
              <label className="bw-label" htmlFor="categorie1">
                Categorie
              </label>
              <select
                id="categorie1"
                className="bw-select"
                value={concept.category}
                onChange={(event) =>
                  setConcept({ ...concept, category: event.target.value as PlantCategory })
                }
              >
                {PLANT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="bw-btn bw-btn-donker h-[50px] w-full"
              disabled={bezig || !concept.commonName.trim()}
              onClick={() => void stelOnderhoudVoor()}
            >
              {bezig ? 'Bezig…' : 'Onderhoud voorstellen'}
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-ghost"
              disabled={!concept.commonName.trim()}
              onClick={() => setStap('bevestigen')}
            >
              Overslaan en zelf invullen
            </button>
          </div>
        ) : null}

        <button type="button" className="bw-btn bw-btn-ghost" onClick={() => setStap('kies')}>
          Terug
        </button>
      </div>
    );
  }

  /* --------------------------------------------------------- bevestigen */

  const actieveTaken = taken.filter((t) => t.enabled);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void opslaan();
      }}
    >
      {berichten}

      {concept.photoUrl ? (
        <PlantFoto url={concept.photoUrl} alt="" vierkant className="-mx-5 h-40 w-[calc(100%+2.5rem)] object-cover" />
      ) : null}

      {concept.sourceUrl ? (
        <h2 className="bw-sectie">Van {kortAdres(concept.sourceUrl)}</h2>
      ) : null}

      {kandidaten.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="bw-sectie">Kies de juiste kandidaat</h2>
          {kandidaten.map((kandidaat) => {
            const actief = gekozenKandidaat === kandidaat.name;
            return (
              <button
                key={kandidaat.name}
                type="button"
                className="rounded-[var(--radius)] p-3 text-left"
                style={
                  actief
                    ? { border: '2px solid var(--dahlia)', background: 'var(--dahlia-wash)' }
                    : { border: '1.5px solid var(--line-strong)', boxShadow: 'var(--shadow-inset)' }
                }
                onClick={() => {
                  setGekozenKandidaat(kandidaat.name);
                  setConcept({
                    ...concept,
                    commonName: kandidaat.name,
                    scientificName: kandidaat.scientificName ?? concept.scientificName,
                  });
                }}
              >
                <span className="block text-[14.5px] font-semibold">{kandidaat.name}</span>
                <span className="block text-[12px] text-[var(--ink-faint)]">
                  {kandidaat.scientificName ? `${kandidaat.scientificName} · ` : ''}
                  {Math.round(kandidaat.score * 100)}% zeker
                </span>
              </button>
            );
          })}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
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
            <label className="bw-label" htmlFor="categorie2">
              Soort
            </label>
            <select
              id="categorie2"
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
        {locatieKiezer}
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
        <div className="flex flex-wrap gap-5 text-[13.5px]">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              className="bw-toggle"
              checked={concept.frostSensitive}
              onChange={(e) => setConcept({ ...concept, frostSensitive: e.target.checked })}
            />
            Vorstgevoelig
          </label>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              className="bw-toggle"
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
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <h2 className="bw-sectie">Voorgesteld zorgprofiel</h2>
          <button
            type="button"
            className="bw-btn bw-btn-ghost ml-auto px-3 text-[13px]"
            disabled={bezig}
            onClick={() => void stelOnderhoudVoor()}
          >
            {bezig ? 'Bezig…' : 'Opnieuw voorstellen'}
          </button>
        </div>

        {actieveTaken.length ? (
          <p className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
            {actieveTaken.length} {actieveTaken.length === 1 ? 'taak' : 'taken'}:{' '}
            {actieveTaken
              .map(
                (taak) =>
                  `${taak.title.toLowerCase()} (${beschrijfPlanningKort(taak.schedule, taak.weatherRules)})`,
              )
              .join(', ')}
          </p>
        ) : (
          <p className="text-[13px] text-[var(--ink-muted)]">Nog geen taken.</p>
        )}

        <button
          type="button"
          className="bw-btn bw-btn-secondary"
          aria-expanded={alleTaken}
          onClick={() => setAlleTaken((v) => !v)}
        >
          {alleTaken ? 'Taken dichtklappen' : 'Taken bekijken en bewerken'}
        </button>
        {alleTaken ? (
          <TaakEditor taken={taken} onChange={setTaken} outdoor={outdoor} />
        ) : null}
      </section>

      <div className="flex flex-col gap-2">
        <button
          className="bw-btn bw-btn-primary h-[50px] w-full"
          disabled={bezig || !concept.commonName.trim()}
        >
          {bezig
            ? 'Bezig…'
            : concept.commonName.trim()
              ? `Opslaan als ${concept.commonName.trim()}`
              : 'Plant opslaan'}
        </button>
        <button type="button" className="bw-btn bw-btn-ghost" onClick={() => setStap('invoer')}>
          Terug
        </button>
      </div>
    </form>
  );
}

function kortAdres(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname}`.slice(0, 48);
  } catch {
    return url.slice(0, 48);
  }
}
