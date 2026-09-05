'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Vijf bestemmingen, zoals in het ontwerp: tekst, geen pictogrammen. */
const ITEMS = [
  { href: '/', label: 'vandaag' },
  { href: '/planten', label: 'planten' },
  { href: '/agenda', label: 'agenda' },
  { href: '/locaties', label: 'locaties' },
  { href: '/instellingen', label: 'instellingen' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="bw-onderbalk bw-geen-print fixed inset-x-0 bottom-0 z-20"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      aria-label="Hoofdnavigatie"
    >
      <ul className="mx-auto flex max-w-[600px] justify-between px-3 sm:justify-center sm:gap-14">
        {ITEMS.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[var(--tap)] items-center px-2 text-[11px] sm:text-xs ${
                  active ? 'bw-nav-actief' : ''
                }`}
                style={active ? { fontWeight: 700 } : { color: 'var(--ink-muted)', fontWeight: 500 }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
