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
  const metEmail = providers.resend || providers.dev;

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

      {providers.google && metEmail ? (
        <div className="flex items-center gap-2.5 text-[13px] text-[var(--ink-muted)]">
          <i className="h-px flex-1 bg-[var(--line-strong)]" />
          of
          <i className="h-px flex-1 bg-[var(--line-strong)]" />
        </div>
      ) : null}

      {metEmail ? (
        <form
          className="flex flex-col gap-3.5"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            await signIn(providers.resend ? 'resend' : 'dev', { email, callbackUrl });
            setBusy(false);
          }}
        >
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
          <button className="bw-btn bw-btn-primary h-[50px] w-full" disabled={busy}>
            {providers.resend ? 'Stuur inloglink' : 'Inloggen'}
          </button>
          {!providers.resend && providers.dev ? (
            <p className="text-center text-[12px] text-[var(--ink-muted)]">
              Ontwikkelmodus: er wordt geen mail verstuurd, je gaat direct naar binnen.
            </p>
          ) : null}
        </form>
      ) : null}

      {nothingConfigured ? (
        <p className="bw-card p-4 text-[13px] text-[var(--ink-soft)]">
          Er is nog geen inlogmethode ingesteld. Zet <code>AUTH_GOOGLE_ID</code> en{' '}
          <code>AUTH_GOOGLE_SECRET</code>, of <code>AUTH_RESEND_KEY</code> en{' '}
          <code>RESEND_FROM</code> in de omgeving.
        </p>
      ) : null}
    </div>
  );
}
