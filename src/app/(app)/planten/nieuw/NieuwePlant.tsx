'use client';

import { useState } from 'react';
import Link from 'next/link';
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

type Bron = 'foto' | 'tuinfoto' | 'url' | 'handmatig';

/** Eén plant die de scan op een tuinfoto vond, met wat ermee gebeurd is. */
interface Gevonden {
  name: string;
  scientificName: string;
  category: PlantCategory;
  confidence: number;
  where?: string;
  status: 'open' | 'bezig' | 'toegevoegd' | 'overgeslagen';
  plantId?: string;
  fout?: string;
}

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
    bron: 'tuinfoto',
    titel: 'Stuk tuin scannen',
    uitleg: 'Alle planten op één foto',
    kleur: 'var(--zinnia-dark)',
    vorm: '2px',
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
  const [stap, setStap] = useState<'kies' | 'invoer' | 'scan' | 'bevestigen'>(
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
  /** De foto die de gebruiker zelf maakte, los van de keuze in het formulier. */
  const [eigenFoto, setEigenFoto] = useState<string | undefined>();
  const [fotoKeuze, setFotoKeuze] = useState<'eigen' | 'online'>('eigen');
  /** Voorbeeldfoto's die al in de eigen opslag staan, per adres bij de bron. */
  const [bewaardeVoorbeelden, setBewaardeVoorbeelden] = useState<Record<string, string>>({});
  const [voorbeeldBezig, setVoorbeeldBezig] = useState(false);
  /** De tuinfoto en wat de scan erop vond. */
  const [scanFoto, setScanFoto] = useState<string | undefined>();
  const [gevonden, setGevonden] = useState<Gevonden[]>([]);

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
      setEigenFoto(data.photoUrl);
      setFotoKeuze('eigen');
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
      const data = await api<{
        profile: Profiel | null;
        notes?: string[];
        sourceUrl: string;
        photoUrl?: string;
      }>('/api/plants/from-url', { method: 'POST', json: { url, locationId } });
      setMeldingen(data.notes ?? []);
      pasProfielToe(data.profile, { sourceUrl: data.sourceUrl, photoUrl: data.photoUrl });
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
          photoCaption:
            fotoKeuze === 'online'
              ? kandidaten.find((k) => k.name === gekozenKandidaat)?.credit
              : undefined,
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

  /**
   * Een foto van een stuk tuin: de AI zoekt alle planten die erop staan. De
   * gebruiker loopt de lijst daarna zelf langs, want een scan van veraf zit er
   * vaker naast dan een foto van één plant.
   */
  async function scanTuin(file: File) {
    setBezig(true);
    setFout(null);
    setMeldingen([]);
    setVoortgang('Foto versturen…');
    try {
      const verkleind = await verkleinAfbeelding(file);
      const form = new FormData();
      form.append('file', verkleind, 'tuin.jpg');
      form.append('locationId', locationId);
      setVoortgang('Planten zoeken op de foto…');
      const res = await fetch('/api/plants/scan', { method: 'POST', body: form });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        photoUrl?: string;
        plants?: {
          name: string;
          scientificName?: string | null;
          category: PlantCategory;
          confidence: number;
          where?: string | null;
        }[];
        notes?: string[];
      };
      if (!res.ok) throw new Error(data.error ?? 'Scannen lukte niet');

      setScanFoto(data.photoUrl);
      setMeldingen(data.notes ?? []);
      setGevonden(
        (data.plants ?? []).map((plant) => ({
          name: plant.name,
          scientificName: plant.scientificName ?? '',
          category: plant.category,
          confidence: plant.confidence,
          where: plant.where ?? undefined,
          status: 'open',
        })),
      );
      setStap('scan');
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Scannen lukte niet');
    } finally {
      setVoortgang(null);
      setBezig(false);
    }
  }

  function pasGevondenAan(index: number, patch: Partial<Gevonden>) {
    setGevonden((huidig) => huidig.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  /**
   * Eén gevonden plant echt toevoegen: eerst het onderhoudsvoorstel, dan de
   * plant zelf. Per stuk, zodat een misser bij één plant de rest niet raakt.
   */
  async function voegGevondenToe(index: number) {
    const item = gevonden[index];
    if (!item || item.status === 'bezig' || item.status === 'toegevoegd') return;
    const naam = item.name.trim();
    if (!naam) {
      pasGevondenAan(index, { fout: 'Geef eerst een naam.' });
      return;
    }
    pasGevondenAan(index, { status: 'bezig', fout: undefined });
    try {
      let voorstel: Profiel | null = null;
      try {
        const antwoord = await api<{ profile: Profiel | null }>('/api/plants/suggest-care', {
          method: 'POST',
          json: { name: naam, category: item.category, locationId },
        });
        voorstel = antwoord.profile;
      } catch {
        // Zonder voorstel komt de plant er kaal in; taken kunnen later nog.
      }
      const plant = await api<{ plant: { id: string } }>('/api/plants', {
        method: 'POST',
        json: {
          locationId,
          commonName: naam,
          scientificName:
            item.scientificName.trim() || voorstel?.scientificName || undefined,
          category: voorstel?.category ?? item.category,
          quantity: 1,
          hardiness: voorstel?.hardiness || undefined,
          frostSensitive: voorstel?.frostSensitive ?? false,
          droughtSensitive: voorstel?.droughtSensitive ?? false,
          source: 'foto',
          tasks: voorstel?.tasks.map((taak) => ({ ...taak, source: 'ai' as const, enabled: true })),
        },
      });
      pasGevondenAan(index, { status: 'toegevoegd', plantId: plant.plant.id });
    } catch (error) {
      pasGevondenAan(index, {
        status: 'open',
        fout: error instanceof Error ? error.message : 'Toevoegen lukte niet',
      });
    }
  }

  /** Terug naar de foto die de gebruiker zelf maakte. */
  function kiesEigenFoto() {
    setFotoKeuze('eigen');
    setConcept((huidig) => ({ ...huidig, photoUrl: eigenFoto }));
  }

  /**
   * De voorbeeldfoto van de bron als plantfoto. Hij staat nog bij PlantNet;
   * de server haalt hem op en zet hem in de eigen opslag, want een adres van
   * een ander kan zomaar verdwijnen.
   */
  async function kiesOnlineFoto(adres: string | undefined) {
    if (!adres) return;
    const bekend = bewaardeVoorbeelden[adres];
    if (bekend) {
      setFotoKeuze('online');
      setConcept((huidig) => ({ ...huidig, photoUrl: bekend }));
      return;
    }
    setVoorbeeldBezig(true);
    setFout(null);
    try {
      const data = await api<{ photoUrl: string }>('/api/plants/reference-photo', {
        method: 'POST',
        json: { url: adres },
      });
      setBewaardeVoorbeelden((huidig) => ({ ...huidig, [adres]: data.photoUrl }));
      setFotoKeuze('online');
      setConcept((huidig) => ({ ...huidig, photoUrl: data.photoUrl }));
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'De voorbeeldfoto ophalen lukte niet');
      kiesEigenFoto();
    } finally {
      setVoorbeeldBezig(false);
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

        {bron === 'tuinfoto' ? (
          <div className="flex flex-col gap-3">
            <p className="text-[13.5px] text-[var(--ink-soft)]">
              Fotografeer een stuk van de tuin. Je krijgt een lijst met alles wat herkend is en
              bepaalt zelf per plant of het klopt.
            </p>
            <FotoKiezer disabled={bezig} onKies={(file) => void scanTuin(file)} />
            {bezig ? (
              <p className="text-[13.5px]" role="status">
                {voortgang ?? 'Bezig met scannen…'}
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

  /* --------------------------------------------------------------- scan */

  if (stap === 'scan') {
    const open = gevonden.filter((g) => g.status === 'open' || g.status === 'bezig');
    const klaar = gevonden.filter((g) => g.status === 'toegevoegd');
    return (
      <div className="flex flex-col gap-4">
        {berichten}

        {scanFoto ? (
          <PlantFoto
            url={scanFoto}
            alt="De gescande tuinfoto"
            vierkant
            className="bw-randloos h-44 object-cover"
          />
        ) : null}

        <p className="text-[13.5px] text-[var(--ink-soft)]">
          {gevonden.length
            ? `${gevonden.length} planten herkend. Loop ze langs: klopt het, dan voeg je hem toe.`
            : 'Er is niets herkend op deze foto.'}
        </p>

        {gevonden.map((item, index) => (
          <article key={`${item.name}-${index}`} className="bw-card flex flex-col gap-2.5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold">{item.name}</h2>
                <p className="text-[12px] text-[var(--ink-faint)]">
                  {CATEGORY_LABEL[item.category]} · {Math.round(item.confidence * 100)}% zeker
                  {item.where ? ` · ${item.where}` : ''}
                </p>
              </div>
              {item.status === 'toegevoegd' ? (
                <span
                  className="shrink-0 rounded-[var(--pill)] px-2.5 py-1 text-[11.5px] font-semibold"
                  style={{ background: 'var(--tint-leaf)', color: 'var(--op-leaf)' }}
                >
                  Toegevoegd
                </span>
              ) : item.status === 'overgeslagen' ? (
                <span className="shrink-0 text-[11.5px] text-[var(--ink-faint)]">Overgeslagen</span>
              ) : null}
            </div>

            {item.status === 'open' || item.status === 'bezig' ? (
              <>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="bw-label" htmlFor={`scan-naam-${index}`}>
                      Naam
                    </label>
                    <input
                      id={`scan-naam-${index}`}
                      className="bw-input"
                      value={item.name}
                      disabled={item.status === 'bezig'}
                      onChange={(event) => pasGevondenAan(index, { name: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="bw-label" htmlFor={`scan-soort-${index}`}>
                      Soort
                    </label>
                    <select
                      id={`scan-soort-${index}`}
                      className="bw-select"
                      value={item.category}
                      disabled={item.status === 'bezig'}
                      onChange={(event) =>
                        pasGevondenAan(index, { category: event.target.value as PlantCategory })
                      }
                    >
                      {PLANT_CATEGORIES.map((categorie) => (
                        <option key={categorie} value={categorie}>
                          {CATEGORY_LABEL[categorie]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {item.fout ? (
                  <p className="text-[12.5px]" style={{ color: 'var(--wijnrood)' }} role="alert">
                    {item.fout}
                  </p>
                ) : null}

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary h-[var(--tap)] flex-1"
                    disabled={item.status === 'bezig'}
                    onClick={() => void voegGevondenToe(index)}
                  >
                    {item.status === 'bezig' ? 'Bezig…' : 'Toevoegen'}
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn-secondary h-[var(--tap)]"
                    disabled={item.status === 'bezig'}
                    onClick={() => pasGevondenAan(index, { status: 'overgeslagen' })}
                  >
                    Overslaan
                  </button>
                </div>
              </>
            ) : null}

            {item.status === 'toegevoegd' && item.plantId ? (
              <Link
                className="bw-btn bw-btn-secondary h-[var(--tap)] self-start"
                href={`/planten/${item.plantId}`}
              >
                {item.name} bekijken
              </Link>
            ) : null}

            {item.status === 'overgeslagen' ? (
              <button
                type="button"
                className="bw-btn bw-btn-ghost h-[var(--tap)] self-start"
                onClick={() => pasGevondenAan(index, { status: 'open' })}
              >
                Toch toevoegen
              </button>
            ) : null}
          </article>
        ))}

        <div className="flex flex-col gap-2">
          {klaar.length ? (
            <Link className="bw-btn bw-btn-primary h-[50px] w-full" href="/planten">
              Klaar — {klaar.length} {klaar.length === 1 ? 'plant' : 'planten'} toegevoegd
            </Link>
          ) : null}
          <button
            type="button"
            className="bw-btn bw-btn-ghost"
            onClick={() => {
              setGevonden([]);
              setScanFoto(undefined);
              setMeldingen([]);
              setStap('invoer');
            }}
          >
            {open.length ? 'Stoppen en terug' : 'Nog een foto scannen'}
          </button>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------- bevestigen */

  const actieveTaken = taken.filter((t) => t.enabled);
  const kandidaat = kandidaten.find((k) => k.name === gekozenKandidaat) ?? kandidaten[0];
  const voorbeeldAdres = kandidaat?.imageUrl;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void opslaan();
      }}
    >
      {berichten}

      {eigenFoto && voorbeeldAdres ? (
        <section className="flex flex-col gap-2">
          <h2 className="bw-sectie">Klopt het? Kies de foto</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <FotoOptie
              label="Jouw foto"
              url={eigenFoto}
              actief={fotoKeuze === 'eigen'}
              onClick={kiesEigenFoto}
            />
            <FotoOptie
              label={kandidaat?.name ?? 'Ter controle'}
              url={voorbeeldAdres}
              actief={fotoKeuze === 'online'}
              bezig={voorbeeldBezig}
              onClick={() => void kiesOnlineFoto(voorbeeldAdres)}
            />
          </div>
          <p className="text-[11.5px] leading-snug text-[var(--ink-faint)]">
            Rechts staat een foto van de gevonden soort, om de herkenning mee te vergelijken.
            {kandidaat?.credit ? ` Foto: ${kandidaat.credit}.` : ''}
          </p>
        </section>
      ) : concept.photoUrl ? (
        <PlantFoto url={concept.photoUrl} alt="" vierkant className="bw-randloos h-40 object-cover" />
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
                  // De voorbeeldfoto hoort bij de gekozen soort: wisselt de
                  // soort, dan wisselt de foto mee.
                  if (fotoKeuze === 'online') void kiesOnlineFoto(kandidaat.imageUrl);
                }}
              >
                <span className="flex items-center gap-3">
                  {kandidaat.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={kandidaat.imageUrl}
                      alt=""
                      loading="lazy"
                      className="size-11 shrink-0 rounded-[10px] object-cover"
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold">{kandidaat.name}</span>
                    <span className="block text-[12px] text-[var(--ink-faint)]">
                      {kandidaat.scientificName ? `${kandidaat.scientificName} · ` : ''}
                      {Math.round(kandidaat.score * 100)}% zeker
                    </span>
                  </span>
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

/**
 * Eén van de twee foto's om uit te kiezen: de eigen foto of die van de bron.
 * De keuze is een radio, want er kan er maar één de plantfoto worden.
 */
function FotoOptie({
  label,
  url,
  actief,
  bezig = false,
  onClick,
}: {
  label: string;
  url: string;
  actief: boolean;
  bezig?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={actief}
      disabled={bezig}
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-[var(--radius)] p-1.5 text-left"
      style={
        actief
          ? { border: '2px solid var(--dahlia)', background: 'var(--dahlia-wash)' }
          : { border: '1.5px solid var(--line-strong)' }
      }
    >
      <span className="relative block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          loading="lazy"
          className="h-28 w-full rounded-[10px] object-cover"
        />
        {bezig ? (
          <span className="absolute inset-0 grid place-items-center rounded-[10px] bg-[rgb(255_255_255/0.72)] text-[12px]">
            Bezig…
          </span>
        ) : null}
      </span>
      <span className="line-clamp-1 px-1 pb-0.5 text-[12.5px] font-semibold">{label}</span>
    </button>
  );
}
