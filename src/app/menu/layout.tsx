import { Cinzel, Cormorant_Garamond } from 'next/font/google';

const display = Cinzel({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-carte-display',
});

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-carte-serif',
});

export default function CarteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${serif.variable}`}>{children}</div>;
}
