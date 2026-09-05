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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Bloeiwijzer</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Jouw tuin, plant voor plant, maand voor maand.
        </p>
      </header>

      {params.check ? (
        <p className="bw-card p-4 text-sm">
          Kijk in je mail. De inloglink is verstuurd en is een uur geldig.
        </p>
      ) : null}
      {params.error ? (
        <p className="bw-card border-[var(--zinnia)] p-4 text-sm">
          Inloggen lukte niet. Probeer het opnieuw.
        </p>
      ) : null}

      <LoginForm
        providers={availableProviders}
        callbackUrl={params.callbackUrl ?? '/'}
      />
    </main>
  );
}
