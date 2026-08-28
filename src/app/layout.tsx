import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mamma Mia — Commandes',
  description: 'Prise de commande a table',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Mamma Mia',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pas de zoom accidentel en tapant vite, et le contenu passe sous l'encoche.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#c8102e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-[100dvh] antialiased">{children}</body>
    </html>
  );
}
