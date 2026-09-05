'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export function LoginForm({
  providers,
  callbackUrl,
}: {
  providers: { google: boolean; resend: boolean; dev: boolean };
  callbackUrl: string;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const nothingConfigured = !providers.google && !providers.resend && !providers.dev;

  return (
    <div className="bw-card flex flex-col gap-4 p-5">
      {providers.google ? (
        <button
          type="button"
          className="bw-btn bw-btn-secondary w-full"
          onClick={() => signIn('google', { callbackUrl })}
        >
          Verder met Google
        </button>
      ) : null}

      {providers.resend || providers.dev ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            await signIn(providers.resend ? 'resend' : 'dev', { email, callbackUrl });
            setBusy(false);
          }}
        >
          <div>
            <label className="bw-label" htmlFor="email">
              E-mailadres
            </label>
            <input
              id="email"
              className="bw-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jij@voorbeeld.nl"
            />
          </div>
          <button className="bw-btn bw-btn-primary w-full" disabled={busy}>
            {providers.resend ? 'Stuur een inloglink' : 'Inloggen'}
          </button>
          {!providers.resend && providers.dev ? (
            <p className="text-xs text-[var(--ink-faint)]">
              Ontwikkelmodus: er wordt geen mail verstuurd, je gaat direct naar binnen.
            </p>
          ) : null}
        </form>
      ) : null}

      {nothingConfigured ? (
        <p className="text-sm text-[var(--ink-soft)]">
          Er is nog geen inlogmethode ingesteld. Zet <code>AUTH_GOOGLE_ID</code> en{' '}
          <code>AUTH_GOOGLE_SECRET</code>, of <code>AUTH_RESEND_KEY</code> en{' '}
          <code>RESEND_FROM</code> in de omgeving.
        </p>
      ) : null}
    </div>
  );
}
