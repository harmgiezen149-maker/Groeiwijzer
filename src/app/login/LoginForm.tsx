'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export function LoginForm({
  providers,
  problemen,
  callbackUrl,
}: {
  providers: { google: boolean; resend: boolean; wachtwoord: boolean; dev: boolean };
  problemen: string[];
  callbackUrl: string;
}) {
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [zichtbaar, setZichtbaar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const nothingConfigured = !providers.google && !providers.wachtwoord && !providers.dev;

  async function metWachtwoord(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFout(null);
    const uitkomst = await signIn('wachtwoord', {
      email,
      password: wachtwoord,
      redirect: false,
      callbackUrl,
    });
    if (uitkomst?.error) {
      setFout('Dat e-mailadres en wachtwoord horen niet bij elkaar.');
      setBusy(false);
      return;
    }
    window.location.href = uitkomst?.url ?? callbackUrl;
  }

  return (
    <div className="flex w-full flex-col gap-3.5">
      {providers.google ? (
        <button
          type="button"
          className="bw-btn bw-btn-donker h-[50px] w-full"
          onClick={() => signIn('google', { callbackUrl })}
        >
          Doorgaan met Google
        </button>
      ) : null}

      {providers.google ? (
        <div className="flex items-center gap-2.5 text-[13px] text-[var(--ink-muted)]">
          <i className="h-px flex-1 bg-[var(--line-strong)]" />
          of
          <i className="h-px flex-1 bg-[var(--line-strong)]" />
        </div>
      ) : null}

      {fout ? (
        <p role="alert" className="bw-banner bw-banner-urgent">
          {fout}
        </p>
      ) : null}

      <form className="flex flex-col gap-3.5" onSubmit={metWachtwoord}>
        <label className="sr-only" htmlFor="email">
          E-mailadres
        </label>
        <input
          id="email"
          className="bw-input h-[50px]"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="jouw@email.nl"
        />

        <label className="sr-only" htmlFor="wachtwoord">
          Wachtwoord
        </label>
        <input
          id="wachtwoord"
          className="bw-input h-[50px]"
          type={zichtbaar ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={wachtwoord}
          onChange={(event) => setWachtwoord(event.target.value)}
          placeholder="Wachtwoord"
        />

        <button className="bw-btn bw-btn-primary h-[50px] w-full" disabled={busy}>
          {busy ? 'Bezig…' : 'Inloggen'}
        </button>

        <button
          type="button"
          className="bw-btn bw-btn-ghost text-[13px]"
          onClick={() => setZichtbaar((v) => !v)}
        >
          {zichtbaar ? 'Wachtwoord verbergen' : 'Laat zien wat ik typ'}
        </button>
      </form>

      {providers.resend ? (
        <button
          type="button"
          className="bw-btn bw-btn-ghost text-[13px]"
          disabled={busy || !email}
          onClick={async () => {
            setBusy(true);
            setFout(null);
            await signIn('resend', { email, callbackUrl });
            setBusy(false);
          }}
        >
          Stuur me een inloglink
        </button>
      ) : null}

      {providers.dev ? (
        <button
          type="button"
          className="bw-btn bw-btn-secondary text-[13px]"
          disabled={busy || !email}
          onClick={async () => {
            setBusy(true);
            await signIn('dev', { email, callbackUrl });
            setBusy(false);
          }}
        >
          Ontwikkelmodus: direct naar binnen
        </button>
      ) : null}

      <p className="text-center text-[12.5px] text-[var(--ink-muted)]">
        Nog geen account? Dat maak je via de uitnodiging die je hebt gekregen.
      </p>

      {nothingConfigured || problemen.length ? (
        <div className="bw-card p-4 text-[13px] text-[var(--ink-soft)]">
          <p className="mb-1.5 font-semibold">Nog in te stellen</p>
          <ul className="list-disc pl-4">
            {problemen.map((probleem) => (
              <li key={probleem}>{probleem}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
