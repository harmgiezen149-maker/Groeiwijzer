import { redirect } from 'next/navigation';
import { auth, availableProviders } from '@/auth';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Inloggen — Bloeiwijzer' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ check?: string; error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
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
            Inloggen lukte niet. Probeer het opnieuw.
          </p>
        ) : null}

        <LoginForm providers={availableProviders} callbackUrl={params.callbackUrl ?? '/'} />
      </div>
    </main>
  );
}
