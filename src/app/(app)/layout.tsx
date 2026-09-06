import { redirect } from 'next/navigation';
import { currentUser, requireContext } from '@/lib/session';
import { BottomNav } from '@/components/BottomNav';
import { GardenSwitcher } from '@/components/GardenSwitcher';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { garden, gardens } = await requireContext();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Het ontwerp kent geen kopbalk: de schermtitel staat in de inhoud.
          Alleen wie meer dan één tuin heeft, krijgt hier een kiezer. */}
      {gardens.length > 1 ? (
        <div className="bw-geen-print border-b border-[var(--line)] bg-[var(--paper)]">
          <div className="mx-auto flex max-w-[600px] items-center gap-2 px-5 py-2">
            <GardenSwitcher gardens={gardens} activeId={garden.id} />
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[600px] flex-1 px-5 pb-32 pt-4">{children}</main>

      <BottomNav />
    </div>
  );
}
