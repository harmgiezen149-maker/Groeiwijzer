'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { WEATHER_RULE_IDS } from '@/lib/types';
import type { Garden, Membership, WeatherRuleId } from '@/lib/types';

const WEER_UITLEG: Record<WeatherRuleId, string> = {
  'geen-vorst': 'Snoeitaken krijgen een waarschuwing als er binnen 3 dagen vorst komt.',
  'nachtvorst-alarm': 'Urgente taak plus pushmelding bij nachtvorst binnen 48 uur.',
  droogte: 'Watertaak voor droogtegevoelige buitenplanten na een droge week.',
  'geen-hitte': 'Bemesten en verpotten krijgen een waarschuwing boven 28 °C.',
  groeiseizoen: 'Melding op het startscherm zodra het groeiseizoen begint.',
};

const WEER_NAAM: Record<WeatherRuleId, string> = {
  'geen-vorst': 'Niet snoeien bij vorst',
  'nachtvorst-alarm': 'Nachtvorstalarm',
  droogte: 'Droogte',
  'geen-hitte': 'Hitte',
  groeiseizoen: 'Start groeiseizoen',
};

interface Lid {
  userId: string;
  role: Membership['role'];
  naam: string;
  email: string;
}

export function Instellingen({
  garden,
  membership,
  isEigenaar,
  currentUserId,
  members,
}: {
  garden: Garden;
  membership: Membership;
  isEigenaar: boolean;
  currentUserId: string;
  members: Lid[];
}) {
  const router = useRouter();
  const [naam, setNaam] = useState(garden.name);
  const [postcode, setPostcode] = useState(garden.postcode ?? '');
  const [lat, setLat] = useState(String(garden.lat));
  const [lon, setLon] = useState(String(garden.lon));
  const [uit, setUit] = useState<WeatherRuleId[]>(garden.disabledWeatherRules ?? []);
  const [notify, setNotify] = useState(membership.notify);
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function doe<T>(actie: () => Promise<T>, gelukt?: string) {
    setBezig(true);
    setFout(null);
    setMelding(null);
    try {
      const resultaat = await actie();
      if (gelukt) setMelding(gelukt);
      router.refresh();
      return resultaat;
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Er ging iets mis');
      return undefined;
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {fout ? (
        <p role="alert" className="bw-card border-[var(--zinnia)] p-3 text-sm">
          {fout}
        </p>
      ) : null}
      {melding ? <p className="bw-card p-3 text-sm">{melding}</p> : null}

      <section className="bw-card flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold">De tuin</h2>
        <div>
          <label className="bw-label" htmlFor="tuinnaam">
            Naam
          </label>
          <input
            id="tuinnaam"
            className="bw-input"
            value={naam}
            disabled={!isEigenaar}
            onChange={(event) => setNaam(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="bw-label" htmlFor="postcode">
              Postcode
            </label>
            <input
              id="postcode"
              className="bw-input"
              value={postcode}
              disabled={!isEigenaar}
              onChange={(event) => setPostcode(event.target.value)}
            />
          </div>
          <div>
            <label className="bw-label" htmlFor="lat">
              Breedtegraad
            </label>
            <input
              id="lat"
              className="bw-input"
              value={lat}
              disabled={!isEigenaar}
              onChange={(event) => setLat(event.target.value)}
            />
          </div>
          <div>
            <label className="bw-label" htmlFor="lon">
              Lengtegraad
            </label>
            <input
              id="lon"
              className="bw-input"
              value={lon}
              disabled={!isEigenaar}
              onChange={(event) => setLon(event.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-[var(--ink-faint)]">
          De coördinaten bepalen welk weerbericht gebruikt wordt.
        </p>
        {isEigenaar ? (
          <button
            type="button"
            className="bw-btn bw-btn-primary self-start"
            disabled={bezig}
            onClick={() =>
              doe(
                () =>
                  api('/api/garden', {
                    method: 'PATCH',
                    json: { name: naam, postcode, lat: Number(lat), lon: Number(lon) },
                  }),
                'De tuin is bijgewerkt.',
              )
            }
          >
            Bewaren
          </button>
        ) : null}
      </section>

      <section className="bw-card flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold">Leden</h2>
        <ul className="flex flex-col gap-1.5">
          {members.map((lid) => (
            <li key={lid.userId} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {lid.naam}
                {lid.userId === currentUserId ? ' (jij)' : ''}
                <span className="text-[var(--ink-soft)]"> · {lid.role}</span>
              </span>
              {isEigenaar && lid.role !== 'eigenaar' ? (
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost px-3 text-sm"
                  disabled={bezig}
                  onClick={() =>
                    doe(
                      () => api(`/api/garden/members/${lid.userId}`, { method: 'DELETE' }),
                      `${lid.naam} is verwijderd.`,
                    )
                  }
                >
                  Weg
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        <form
          className="flex flex-col gap-2 border-t border-[var(--line)] pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void doe(async () => {
              const data = await api<{ link: string; mail: { sent: boolean; reason?: string } }>(
                '/api/garden/invite',
                { method: 'POST', json: { email } },
              );
              setEmail('');
              setLink(data.mail.sent ? null : data.link);
              setMelding(
                data.mail.sent
                  ? 'De uitnodiging is verstuurd.'
                  : 'Er kon geen mail verstuurd worden. Deel deze link zelf.',
              );
            });
          }}
        >
          <label className="bw-label" htmlFor="uitnodigen">
            Iemand uitnodigen
          </label>
          <div className="flex gap-2">
            <input
              id="uitnodigen"
              className="bw-input"
              type="email"
              required
              placeholder="naam@voorbeeld.nl"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button className="bw-btn bw-btn-primary shrink-0 px-4" disabled={bezig}>
              Sturen
            </button>
          </div>
          {link ? (
            <p className="break-all text-xs text-[var(--ink-soft)]">{link}</p>
          ) : null}
        </form>
      </section>

      <section className="bw-card flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold">Mijn meldingen</h2>
        {(['email', 'push'] as const).map((kanaal) => (
          <label key={kanaal} className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-5"
              checked={notify[kanaal]}
              onChange={(event) => {
                const next = { ...notify, [kanaal]: event.target.checked };
                setNotify(next);
                void doe(() => api('/api/garden/notify', { method: 'PATCH', json: next }));
              }}
            />
            {kanaal === 'email' ? 'Maandbericht per e-mail' : 'Pushmeldingen bij vorst en spoed'}
          </label>
        ))}
      </section>

      <section className="bw-card flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold">Weerregels</h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Weerregels blokkeren nooit iets; ze markeren en melden. Ze gelden alleen buiten.
        </p>
        {WEATHER_RULE_IDS.map((regel) => {
          const aan = !uit.includes(regel);
          return (
            <label key={regel} className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5"
                checked={aan}
                disabled={!isEigenaar || bezig}
                onChange={() => {
                  const next = aan ? [...uit, regel] : uit.filter((r) => r !== regel);
                  setUit(next);
                  void doe(() =>
                    api('/api/garden', {
                      method: 'PATCH',
                      json: { disabledWeatherRules: next },
                    }),
                  );
                }}
              />
              <span>
                <span className="block font-semibold">{WEER_NAAM[regel]}</span>
                <span className="block text-sm text-[var(--ink-soft)]">{WEER_UITLEG[regel]}</span>
              </span>
            </label>
          );
        })}
      </section>

      <section className="bw-card flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold">Onderhoud van de app</h2>
        <button
          type="button"
          className="bw-btn bw-btn-secondary self-start"
          disabled={bezig}
          onClick={() =>
            doe(async () => {
              const data = await api<{ added: number; removed: number }>(
                '/api/occurrences/generate',
                { method: 'POST', json: { year: new Date().getFullYear() } },
              );
              setMelding(
                `Agenda bijgewerkt: ${data.added} taken toegevoegd, ${data.removed} opgeruimd.`,
              );
            })
          }
        >
          Agenda opnieuw opbouwen
        </button>
        <a className="bw-btn bw-btn-secondary self-start" href="/api/export" download>
          Alles exporteren als JSON
        </a>
      </section>
    </div>
  );
}
