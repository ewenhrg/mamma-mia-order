import type { Metadata, Viewport } from 'next';
import { CarteMenu } from '@/components/carte/CarteMenu';

export const metadata: Metadata = {
  title: 'Menu — Mamma Mia Beach Club',
  description: 'Compose ta commande et montre-la au serveur.',
};

export const viewport: Viewport = {
  themeColor: '#FBF6EC',
};

export default async function CartePage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;
  const safeTable = (table ?? '').replace(/[^\p{L}\p{N} \-]/gu, '').trim().slice(0, 20);
  return <CarteMenu initialTable={safeTable} />;
}
