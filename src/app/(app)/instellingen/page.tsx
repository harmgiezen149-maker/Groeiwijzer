import { requireContext } from '@/lib/session';
import { listMembers } from '@/lib/garden';
import { Instellingen } from './Instellingen';
import { signOutAction } from '@/app/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Instellingen — Bloeiwijzer' };

export default async function InstellingenPagina() {
  const { garden, user, membership } = await requireContext();
  const members = await listMembers(garden.id);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Instellingen</h1>

      <Instellingen
        garden={garden}
        membership={membership}
        isEigenaar={membership.role === 'eigenaar'}
        currentUserId={user.id}
        members={members.map((m) => ({
          userId: m.userId,
          role: m.role,
          naam: m.user?.name ?? m.user?.email ?? 'Onbekend',
          email: m.user?.email ?? '',
        }))}
      />

      <section className="bw-card p-4">
        <h2 className="mb-2 text-lg font-bold">Account</h2>
        <p className="mb-3 text-sm text-[var(--ink-soft)]">Je bent ingelogd als {user.email}.</p>
        <form action={signOutAction}>
          <button className="bw-btn bw-btn-secondary">Uitloggen</button>
        </form>
      </section>
    </div>
  );
}
