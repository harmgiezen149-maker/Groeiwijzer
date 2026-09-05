import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '@/lib/session';
import { requireContext } from '@/lib/session';
import { BottomNav } from '@/components/BottomNav';
import { GardenSwitcher } from '@/components/GardenSwitcher';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { garden, gardens } = await requireContext();

  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur bw-geen-print">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Link href="/" className="font-bold tracking-tight">
            Bloeiwijzer
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <GardenSwitcher gardens={gardens} activeId={garden.id} />
            <Link
              href="/instellingen"
              className="bw-btn bw-btn-ghost px-3"
              aria-label="Instellingen"
              title="Instellingen"
            >
              <span aria-hidden>⚙</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>

      <BottomNav />
    </div>
  );
}
