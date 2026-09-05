import { redirect } from 'next/navigation';
import Link from 'next/link';
import { acceptInvite, getGarden, getInvite } from '@/lib/garden';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Uitnodiging — Bloeiwijzer' };

const UITLEG: Record<string, string> = {
  onbekend: 'Deze uitnodiging bestaat niet (meer).',
  verlopen: 'Deze uitnodiging is verlopen. Vraag om een nieuwe.',
  gebruikt: 'Deze uitnodiging is al gebruikt.',
  'ander-adres':
    'Deze uitnodiging staat op een ander e-mailadres. Log in met het adres waar de uitnodiging naartoe ging.',
};

export default async function UitnodigingPagina({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await currentUser();

  // Zonder sessie eerst inloggen, daarna komt de gebruiker hier terug.
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/uitnodiging/${token}`)}`);
  }

  const invite = await getInvite(token);
  const garden = invite ? await getGarden(invite.gardenId) : null;
  const result = await acceptInvite(token, user);

  if (result.ok) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Je doet mee</h1>
        <p className="text-[var(--ink-soft)]">
          Je bent toegevoegd aan {garden?.name ?? 'de tuin'}. Je ziet dezelfde planten en agenda,
          en kunt taken afvinken.
        </p>
        <Link href="/" className="bw-btn bw-btn-primary">
          Naar de tuin
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Uitnodiging werkt niet</h1>
      <p className="text-[var(--ink-soft)]">{UITLEG[result.reason]}</p>
      <Link href="/" className="bw-btn bw-btn-secondary">
        Naar je eigen tuin
      </Link>
    </main>
  );
}
