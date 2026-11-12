import { headers } from 'next/headers';
import { CarteQrSheet } from '@/components/carte/CarteQrSheet';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'QR menu — Mamma Mia' };

export default async function CarteQrPage() {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  return <CarteQrSheet origin={`${proto}://${host}`} />;
}
