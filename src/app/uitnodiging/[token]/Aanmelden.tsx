'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { MINIMALE_LENGTE } from '@/lib/password-regels';

/**
 * Meedoen zonder mail: de uitnodigingslink is het bewijs, hier kiest de
 * genodigde alleen nog een naam en een wachtwoord.
 */
export function Aanmelden({
  token,
  email,
  tuin,
  metGoogle,
}: {
  token: string;
  email: string;
  tuin: string;
  metGoogle: boolean;
}) {
  const [naam, setNaam] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [zichtbaar, setZichtbaar] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function verstuur(event: React.FormEvent) {
    event.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch('/api/uitnodiging/aanmelden', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, name: naam.trim() || undefined, password: wachtwoord }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Aanmelden lukte niet');

      const inlog = await signIn('wachtwoord', {
        email,
        password: wachtwoord,
        redirect: false,
        callbackUrl: '/',
      });
      if (inlog?.error) throw new Error('Je account is gemaakt. Log nu in met je wachtwoord.');
      window.location.href = '/';
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Aanmelden lukte niet');
      setBezig(false);
    }
  }

  return (
    <form className="flex flex-col gap-3.5" onSubmit={verstuur}>
      {fout ? (
        <p role="alert" className="bw-banner bw-banner-urgent">
          {fout}
        </p>
      ) : null}

      <p className="text-[14px] text-[var(--ink-soft)]">
        Je bent uitgenodigd voor <strong className="font-semibold">{tuin}</strong>. Kies een
        wachtwoord, dan kun je meteen mee.
      </p>

      <div>
        <p className="bw-label">E-mailadres</p>
        <p
          className="bw-input flex items-center break-all text-[var(--ink-soft)]"
          style={{ background: 'var(--paper-sunken)', boxShadow: 'none' }}
        >
          {email}
        </p>
        <p className="mt-1 text-[12.5px] text-[var(--ink-faint)]">
          Op dit adres staat de uitnodiging; daarmee log je voortaan in.
        </p>
      </div>

      <div>
        <label className="bw-label" htmlFor="aanmeld-naam">
          Je naam
        </label>
        <input
          id="aanmeld-naam"
          className="bw-input"
          autoComplete="name"
          value={naam}
          onChange={(event) => setNaam(event.target.value)}
          placeholder="Zodat de ander ziet wie iets deed"
        />
      </div>

      <div>
        <label className="bw-label" htmlFor="aanmeld-wachtwoord">
          Wachtwoord
        </label>
        <input
          id="aanmeld-wachtwoord"
          className="bw-input"
          type={zichtbaar ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={MINIMALE_LENGTE}
          value={wachtwoord}
          onChange={(event) => setWachtwoord(event.target.value)}
        />
        <button
          type="button"
          className="bw-btn bw-btn-ghost mt-1 px-0 text-[13px]"
          onClick={() => setZichtbaar((v) => !v)}
        >
          {zichtbaar ? 'Verbergen' : 'Laat zien wat ik typ'}
        </button>
        <p className="text-[12.5px] text-[var(--ink-faint)]">
          Minstens {MINIMALE_LENGTE} tekens. Een zin onthoudt makkelijker dan een kort raadsel.
        </p>
      </div>

      <button className="bw-btn bw-btn-primary h-[50px] w-full" disabled={bezig}>
        {bezig ? 'Bezig…' : 'Meedoen'}
      </button>

      {metGoogle ? (
        <>
          <div className="flex items-center gap-2.5 text-[13px] text-[var(--ink-muted)]">
            <i className="h-px flex-1 bg-[var(--line-strong)]" />
            of
            <i className="h-px flex-1 bg-[var(--line-strong)]" />
          </div>
          <button
            type="button"
            className="bw-btn bw-btn-donker h-[50px] w-full"
            onClick={() =>
              void signIn('google', { callbackUrl: `/uitnodiging/${token}` })
            }
          >
            Doorgaan met Google
          </button>
        </>
      ) : null}
    </form>
  );
}
