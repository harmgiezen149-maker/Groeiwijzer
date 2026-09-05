import type { Metadata, Viewport } from 'next';
import { Fraunces, Karla } from 'next/font/google';
import './globals.css';

/* Fraunces voor de koppen (met de WONK-as aan, zoals in het ontwerp),
   Karla voor alles wat je leest. */
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK'],
  display: 'swap',
  variable: '--font-fraunces',
});

const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
  themeColor: '#fffbf2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${fraunces.variable} ${karla.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
