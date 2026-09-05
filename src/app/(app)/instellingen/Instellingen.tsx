'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { PushAanmelden } from '@/components/PushAanmelden';
import { WEATHER_RULE_IDS } from '@/lib/types';
import type { Garden, Membership, WeatherRuleId } from '@/lib/types';

const WEER_NAAM: Record<WeatherRuleId, string> = {
  'geen-vorst': 'Niet snoeien bij vorst',
  'nachtvorst-alarm': 'Nachtvorst-alarm',
  droogte: 'Droogte-waarschuwing',
  'geen-hitte': 'Hitte-waarschuwing',
  groeiseizoen: 'Start groeiseizoen',
};

interface Lid {
  userId: string;
  role: Membership['role'];
  naam: string;
  email: string;
}

/** Eén rij in een instellingenkaart: label links, bediening rechts. */
function Rij({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13.5px]">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Kaart({ children }: { children: React.ReactNode }) {
  return <div className="bw-card-compact flex flex-col gap-2.5 px-3.5 py-3">{children}</div>;
}

export function Instellingen({
  garden,
  membership,
  isEigenaar,
  currentUserId,
  members,
  vapidPublicKey,
}: {
  garden: Garden;
  membership: Membership;
  isEigenaar: boolean;
  currentUserId: string;
  members: Lid[];
  vapidPublicKey: string | null;
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
  const [tuinOpen, setTuinOpen] = useState(false);

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
        <p role="alert" className="bw-banner bw-banner-urgent">
          {fout}
        </p>
      ) : null}
      {melding ? <p className="bw-banner bw-banner-info">{melding}</p> : null}

      {/* --------------------------------------------------------- weer */}
      <section>
        <h2 className="bw-sectie mb-2">Weer</h2>
        <Kaart>
          <Rij label="Locatie voor weerdata">
            <span className="text-[13px] text-[var(--ink-faint)]">
              {garden.postcode || `${garden.lat.toFixed(2)}, ${garden.lon.toFixed(2)}`}
            </span>
          </Rij>
          {WEATHER_RULE_IDS.map((regel) => {
            const aan = !uit.includes(regel);
            return (
              <Rij key={regel} label={WEER_NAAM[regel]}>
                <input
                  type="checkbox"
                  className="bw-toggle"
                  checked={aan}
                  disabled={!isEigenaar || bezig}
                  aria-label={`${WEER_NAAM[regel]} ${aan ? 'uitzetten' : 'aanzetten'}`}
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
              </Rij>
            );
          })}
        </Kaart>
        <p className="mt-1.5 text-[12px] text-[var(--ink-muted)]">
          Weerregels blokkeren nooit iets; ze markeren en melden. Ze gelden alleen buiten.
        </p>
      </section>

      {/* ---------------------------------------------------- meldingen */}
      <section>
        <h2 className="bw-sectie mb-2">Mijn meldingen</h2>
        <Kaart>
          <Rij label="Maandbericht per e-mail">
            <input
              type="checkbox"
              className="bw-toggle"
              checked={notify.email}
              aria-label="Maandbericht per e-mail"
              onChange={(event) => {
                const next = { ...notify, email: event.target.checked };
                setNotify(next);
                void doe(() => api('/api/garden/notify', { method: 'PATCH', json: next }));
              }}
            />
          </Rij>
          <Rij label="Pushmeldingen bij vorst en spoed">
            <input
              type="checkbox"
              className="bw-toggle"
              checked={notify.push}
              aria-label="Pushmeldingen bij vorst en spoed"
              onChange={(event) => {
                const next = { ...notify, push: event.target.checked };
                setNotify(next);
                void doe(() => api('/api/garden/notify', { method: 'PATCH', json: next }));
              }}
            />
          </Rij>
        </Kaart>
        <div className="mt-2.5">
          <PushAanmelden vapidPublicKey={vapidPublicKey} />
        </div>
      </section>

      {/* -------------------------------------------------------- leden */}
      <section>
        <h2 className="bw-sectie mb-2">Leden</h2>
        <Kaart>
          {members.map((lid) => (
            <Rij
              key={lid.userId}
              label={`${lid.naam}${lid.userId === currentUserId ? ' (jij)' : ''}`}
            >
              {isEigenaar && lid.role !== 'eigenaar' ? (
                <button
                  type="button"
                  className="bw-btn bw-btn-gevaar px-2 text-[13px]"
                  disabled={bezig}
                  onClick={() =>
                    doe(
                      () => api(`/api/garden/members/${lid.userId}`, { method: 'DELETE' }),
                      `${lid.naam} is verwijderd.`,
                    )
                  }
                >
                  Verwijderen
                </button>
              ) : (
                <span className="text-[13px] text-[var(--ink-faint)]">{lid.role}</span>
              )}
            </Rij>
          ))}
        </Kaart>

        <form
          className="mt-2.5 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void doe(async () => {
              const data = await api<{ link: string; mail: { sent: boolean } }>(
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
          <label className="sr-only" htmlFor="uitnodigen">
            Iemand uitnodigen
          </label>
          <input
            id="uitnodigen"
            className="bw-input"
            type="email"
            required
            placeholder="naam@voorbeeld.nl"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="bw-btn bw-btn-primary shrink-0" disabled={bezig}>
            Uitnodigen
          </button>
        </form>
        {link ? <p className="mt-1.5 break-all text-[12px] text-[var(--ink-faint)]">{link}</p> : null}
      </section>

      {/* --------------------------------------------------------- tuin */}
      <section>
        <h2 className="bw-sectie mb-2">De tuin</h2>
        <button
          type="button"
          className="bw-card-compact w-full px-3.5 py-3 text-left text-[13.5px]"
          aria-expanded={tuinOpen}
          onClick={() => setTuinOpen((v) => !v)}
        >
          {garden.name}
          <span className="float-right text-[var(--ink-faint)]">{tuinOpen ? '−' : 'wijzig'}</span>
        </button>

        {tuinOpen ? (
          <div className="mt-2.5 flex flex-col gap-3">
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
            <div className="grid grid-cols-3 gap-2">
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
                  Breedte
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
                  Lengte
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
            {isEigenaar ? (
              <button
                type="button"
                className="bw-btn bw-btn-primary"
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
          </div>
        ) : null}
      </section>

      {/* ---------------------------------------------------- gegevens */}
      <section>
        <h2 className="bw-sectie mb-2">Gegevens</h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="bw-card-compact px-3.5 py-3 text-left text-[13.5px]"
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
            Taken opnieuw genereren
          </button>
          <a
            className="bw-card-compact px-3.5 py-3 text-left text-[13.5px]"
            href="/api/export"
            download
          >
            Exporteren als JSON
          </a>
          <div className="bw-pillen">
            {(['planten', 'taken', 'agenda', 'logboek'] as const).map((onderdeel) => (
              <a
                key={onderdeel}
                className="bw-pil"
                href={`/api/export?onderdeel=${onderdeel}`}
                download
              >
                {onderdeel} · CSV
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- meer */}
      <section>
        <h2 className="bw-sectie mb-2">Meer</h2>
        <div className="bw-pillen">
          <Link href="/labels" className="bw-pil">
            QR-labels printen
          </Link>
          <Link href={`/jaar/${new Date().getFullYear()}`} className="bw-pil">
            Jaaroverzicht
          </Link>
          <Link href="/planten?archief=1" className="bw-pil">
            Archief
          </Link>
        </div>
      </section>
    </div>
  );
}
