'use client';

import { useState } from 'react';
import { MINIMALE_LENGTE } from '@/lib/password-regels';

/**
 * Zelf een wachtwoord zetten of wijzigen. Handig als je niet met Google wilt
 * of moet inloggen, en nodig voor wie via een uitnodiging binnenkwam.
 */
export function Wachtwoord({ ingesteld }: { ingesteld: boolean }) {
  const [open, setOpen] = useState(false);
  const [huidig, setHuidig] = useState('');
  const [nieuw, setNieuw] = useState('');
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="flex flex-col gap-1.5">
        <button type="button" className="bw-btn bw-btn-secondary self-start" onClick={() => setOpen(true)}>
          {ingesteld ? 'Wachtwoord wijzigen' : 'Wachtwoord instellen'}
        </button>
        {melding ? <p className="text-[13px] text-[var(--leaf-dark)]">{melding}</p> : null}
        {!ingesteld ? (
          <p className="text-[12.5px] text-[var(--ink-faint)]">
            Met een wachtwoord kun je inloggen zonder Google en zonder mail.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="bw-card-compact flex flex-col gap-3 p-3.5"
      onSubmit={async (event) => {
        event.preventDefault();
        setBezig(true);
        setFout(null);
        try {
          const res = await fetch('/api/account/wachtwoord', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ huidig: huidig || undefined, nieuw }),
          });
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Opslaan lukte niet');
          setMelding('Je wachtwoord is opgeslagen.');
          setOpen(false);
          setHuidig('');
          setNieuw('');
        } catch (error) {
          setFout(error instanceof Error ? error.message : 'Opslaan lukte niet');
        } finally {
          setBezig(false);
        }
      }}
    >
      {fout ? (
        <p role="alert" className="bw-banner bw-banner-urgent">
          {fout}
        </p>
      ) : null}

      {ingesteld ? (
        <div>
          <label className="bw-label" htmlFor="huidig-wachtwoord">
            Huidig wachtwoord
          </label>
          <input
            id="huidig-wachtwoord"
            className="bw-input"
            type="password"
            autoComplete="current-password"
            required
            value={huidig}
            onChange={(event) => setHuidig(event.target.value)}
          />
        </div>
      ) : null}

      <div>
        <label className="bw-label" htmlFor="nieuw-wachtwoord">
          Nieuw wachtwoord
        </label>
        <input
          id="nieuw-wachtwoord"
          className="bw-input"
          type="password"
          autoComplete="new-password"
          required
          minLength={MINIMALE_LENGTE}
          value={nieuw}
          onChange={(event) => setNieuw(event.target.value)}
        />
        <p className="mt-1 text-[12.5px] text-[var(--ink-faint)]">
          Minstens {MINIMALE_LENGTE} tekens.
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" className="bw-btn bw-btn-ghost" onClick={() => setOpen(false)}>
          Terug
        </button>
        <button className="bw-btn bw-btn-primary flex-1" disabled={bezig}>
          {bezig ? 'Bezig…' : 'Opslaan'}
        </button>
      </div>
    </form>
  );
}
