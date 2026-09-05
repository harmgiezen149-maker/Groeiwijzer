import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Karla } from 'next/font/google';
import './globals.css';

/* Bricolage Grotesque voor de koppen: levendig en een beetje eigenwijs,
   Karla voor alles wat je leest. */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage',
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
    <html lang="nl" className={`${bricolage.variable} ${karla.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
