import { redirect } from 'next/navigation';
import { auth, availableProviders, configuratieProblemen } from '@/auth';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Inloggen — Bloeiwijzer' };

/**
 * Auth.js geeft alleen een code terug; hier staat wat die betekent en wat je
 * eraan kunt doen. "Probeer het opnieuw" helpt niemand verder.
 */
const FOUTEN: Record<string, string> = {
  EmailSignin:
    'De inloglink kon niet verstuurd worden. Probeer het met Google, of vraag degene die je uitnodigde om je toegang te geven.',
  Verification: 'Deze inloglink is verlopen of al gebruikt. Vraag een nieuwe aan.',
  AccessDenied: 'Je hebt geen toegang gekregen tot deze tuin.',
  Configuration:
    'De inlog is nog niet volledig ingesteld. Laat de eigenaar van de app even kijken.',
  OAuthAccountNotLinked:
    'Dit e-mailadres is eerder op een andere manier gebruikt. Log in zoals de vorige keer.',
  OAuthSignin: 'Google gaf geen antwoord. Probeer het opnieuw.',
  OAuthCallback: 'Google gaf geen antwoord. Probeer het opnieuw.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ check?: string; error?: string; callbackUrl?: string }>;
}) {
  const session = await auth().catch(() => null);
  if (session?.user?.id) redirect('/');
  const params = await searchParams;

  return (
    <main className="bw-bloemen flex min-h-dvh flex-col items-center justify-center gap-9 px-8">
      <header className="text-center">
        <h1
          className="bw-titel"
          style={{ fontSize: '40px', color: 'var(--dahlia)' }}
        >
          Bloeiwijzer
        </h1>
        <p className="mt-2.5 text-[15px] text-[var(--ink-soft)]">
          Bijhouden wat je tuin nodig heeft — en wanneer.
        </p>
      </header>

      <div className="w-full max-w-sm">
        {params.check ? (
          <p className="bw-card mb-4 p-4 text-[13.5px]">
            Kijk in je mail. De inloglink is verstuurd en is een uur geldig.
          </p>
        ) : null}
        {params.error ? (
          <p className="bw-banner bw-banner-urgent mb-4">
            {FOUTEN[params.error] ?? 'Inloggen lukte niet. Probeer het opnieuw.'}
          </p>
        ) : null}

        <LoginForm
          providers={availableProviders}
          problemen={configuratieProblemen()}
          callbackUrl={params.callbackUrl ?? '/'}
        />
      </div>
    </main>
  );
}
