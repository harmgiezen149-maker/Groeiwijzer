'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Deze maand', icon: '🌱' },
  { href: '/agenda', label: 'Agenda', icon: '📅' },
  { href: '/planten', label: 'Planten', icon: '🪴' },
  { href: '/planten/nieuw', label: 'Toevoegen', icon: '＋' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--paper-raised)] bw-geen-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Hoofdnavigatie"
    >
      <ul className="mx-auto flex max-w-3xl">
        {ITEMS.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="flex min-h-[var(--tap)] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold"
                style={{ color: active ? 'var(--dahlia)' : 'var(--ink-soft)' }}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
