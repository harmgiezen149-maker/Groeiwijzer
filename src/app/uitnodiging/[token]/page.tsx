import { redirect } from 'next/navigation';
import Link from 'next/link';
import { acceptInvite, getGarden, getInvite, getUserByEmail } from '@/lib/garden';
import { currentUser } from '@/lib/session';
import { availableProviders } from '@/auth';
import { Aanmelden } from './Aanmelden';

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
  const invite = await getInvite(token);
  const garden = invite ? await getGarden(invite.gardenId) : null;

  // Nog geen account? Dan hoeft er geen mail aan te pas te komen: op vertoon
  // van deze uitnodiging kiest de genodigde hier zelf een wachtwoord.
  if (!user) {
    const bruikbaar =
      invite && !invite.acceptedAt && new Date(invite.expiresAt).getTime() > Date.now();
    if (bruikbaar && !(await getUserByEmail(invite.email))) {
      return (
        <main className="bw-bloemen mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-8 py-10">
          <h1 className="bw-titel">Meedoen</h1>
          <Aanmelden
            token={token}
            email={invite.email}
            tuin={garden?.name ?? 'deze tuin'}
            metGoogle={availableProviders.google}
          />
        </main>
      );
    }
    redirect(`/login?callbackUrl=${encodeURIComponent(`/uitnodiging/${token}`)}`);
  }

  const result = await acceptInvite(token, user!);

  if (result.ok) {
    return (
      <main className="bw-bloemen mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-8 py-10">
        <h1 className="bw-titel">Je doet mee</h1>
        <p className="text-[14px] text-[var(--ink-soft)]">
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
    <main className="bw-bloemen mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-8 py-10">
      <h1 className="bw-titel">Uitnodiging werkt niet</h1>
      <p className="text-[14px] text-[var(--ink-soft)]">{UITLEG[result.reason]}</p>
      <Link href="/" className="bw-btn bw-btn-secondary">
        Naar je eigen tuin
      </Link>
    </main>
  );
}
