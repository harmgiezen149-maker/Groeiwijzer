import { requireContext } from '@/lib/session';
import { listMembers } from '@/lib/garden';
import { Instellingen } from './Instellingen';
import { signOutAction } from '@/app/actions';
import { voorzieningen } from '@/lib/voorzieningen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Instellingen — Bloeiwijzer' };

export default async function InstellingenPagina() {
  const { garden, user, membership } = await requireContext();
  const members = await listMembers(garden.id);
  const diensten = voorzieningen();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="bw-titel-groot">Instellingen</h1>

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
        vapidPublicKey={
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? null
        }
      />

      <section>
        <h2 className="bw-sectie mb-2">Wat staat aan</h2>
        <ul className="bw-card flex flex-col divide-y divide-[var(--line)] px-4">
          {diensten.map((dienst) => (
            <li key={dienst.naam} className="flex items-start gap-3 py-3">
              <span
                aria-hidden
                className="mt-1.5 block size-2.5 shrink-0 rounded-full"
                style={{ background: dienst.aan ? 'var(--leaf-dark)' : 'var(--ink-faint)' }}
              />
              <span>
                <span className="block text-[14px] font-semibold">
                  {dienst.naam}{' '}
                  <span className="font-normal text-[var(--ink-faint)]">
                    — {dienst.aan ? 'aan' : 'uit'}
                  </span>
                </span>
                <span className="block text-[12.5px] text-[var(--ink-soft)]">{dienst.uitleg}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="bw-sectie mb-2">Account</h2>
        <p className="mb-2 text-[13px] text-[var(--ink-faint)]">Ingelogd als {user.email}.</p>
        <form action={signOutAction}>
          <button className="bw-btn bw-btn-gevaar px-0">Uitloggen</button>
        </form>
      </section>
    </div>
  );
}
