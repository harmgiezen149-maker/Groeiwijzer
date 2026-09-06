'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Vier bestemmingen met een pictogram, en in het midden de camera: de
 * snelste weg naar een nieuwe plant. Instellingen zit onder "meer".
 */
const ITEMS = [
  { href: '/', label: 'vandaag', icon: Huis },
  { href: '/planten', label: 'planten', icon: Blad },
  { href: '/agenda', label: 'agenda', icon: Kalender },
  { href: '/instellingen', label: 'meer', icon: Meer },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="bw-onderbalk bw-geen-print fixed inset-x-0 bottom-0 z-20"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      aria-label="Hoofdnavigatie"
    >
      <div className="relative mx-auto flex max-w-[600px] items-end justify-between px-4">
        {ITEMS.slice(0, 2).map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} />
        ))}

        <span className="w-16 shrink-0" aria-hidden />

        {ITEMS.slice(2).map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} />
        ))}

        <Link
          href="/planten/nieuw?bron=foto"
          className="bw-fab"
          aria-label="Plant toevoegen met een foto"
        >
          <Camera />
        </Link>
      </div>
    </nav>
  );
}

function NavItem({
  item,
  pathname,
}: {
  item: (typeof ITEMS)[number];
  pathname: string;
}) {
  const actief = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
  const Icoon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={actief ? 'page' : undefined}
      className="flex min-h-[var(--tap)] w-16 flex-col items-center justify-center gap-1 text-[10.5px]"
      style={{
        color: actief ? 'var(--dahlia)' : 'var(--ink-muted)',
        fontWeight: actief ? 700 : 500,
      }}
    >
      <Icoon />
      {item.label}
    </Link>
  );
}

function svg(kind: React.ReactNode) {
  return (
    <svg
      aria-hidden
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind}
    </svg>
  );
}

function Huis() {
  return svg(
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 9.6V19h11V9.6" />
    </>,
  );
}

function Blad() {
  return svg(
    <>
      <path d="M12 20v-8" />
      <path d="M12 12C12 8 9 5 5 5c0 4 3 7 7 7zM12 12c0-4 3-7 7-7 0 4-3 7-7 7z" />
    </>,
  );
}

function Kalender() {
  return svg(
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
      <path d="M4 10h16M9 3.5v4M15 3.5v4" />
    </>,
  );
}

function Meer() {
  return svg(
    <>
      <circle cx="5.5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18.5" cy="12" r="1.4" />
    </>,
  );
}

function Camera() {
  return (
    <svg
      aria-hidden
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5h3.2l1.5-2.2h7.6l1.5 2.2h3.2v10H3.5z" />
      <circle cx="12" cy="13.2" r="3.4" />
    </svg>
  );
}
