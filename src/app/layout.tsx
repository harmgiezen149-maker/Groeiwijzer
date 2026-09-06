import type { Metadata, Viewport } from 'next';
import { Baloo_2, Nunito } from 'next/font/google';
import './globals.css';

/* Baloo 2 voor de koppen: rond en speels, Nunito voor alles wat je leest.
   Ontwerp ververst 2026-09-06 — zie docs/ontwerp/AFWIJKINGEN.md. De
   CSS-variabelen heten nog naar de vorige lettertypes; alleen hier
   veranderen zou een aparte hernoemslag door globals.css vergen zonder
   verder voordeel. */
const baloo2 = Baloo_2({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-bricolage',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-karla',
});

export const metadata: Metadata = {
  title: 'Bloeiwijzer',
  description: 'Bijhouden wat je tuin nodig heeft — en wanneer.',
  applicationName: 'Bloeiwijzer',
  appleWebApp: { capable: true, title: 'Bloeiwijzer', statusBarStyle: 'default' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#eaf6dc',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${baloo2.variable} ${nunito.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
