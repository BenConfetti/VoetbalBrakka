import type { Metadata } from 'next';
import './globals.css';
import './mobile.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'Webapp Voetbalstatistieken',
  description: 'Bereid wedstrijden voor en registreer opstellingen, goals en spelersnotities.',
  openGraph: {
    title: 'Webapp Voetbalstatistieken',
    description: 'Opstellingen, goals en inzichten per kwart',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Webapp Voetbalstatistieken',
    description: 'Opstellingen, goals en inzichten per kwart',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
