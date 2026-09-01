import { getSupabaseServer } from '@/lib/supabase/server';
import { GuestMenu, GuestUnavailable } from '@/components/guest/GuestMenu';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const table = await resolveTable(token);
  return {
    title: table ? `Menu — Table ${table.label}` : 'Menu — Mamma Mia',
    description: 'Commande à table — Mamma Mia Beach Club',
  };
}

async function resolveTable(token: string) {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.rpc('guest_resolve_table', { p_token: token });
    if (error || !data || data.length === 0) return null;
    return data[0];
  } catch {
    return null;
  }
}

export default async function GuestTablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const table = await resolveTable(token);

  if (!table) {
    return <GuestUnavailable />;
  }

  return <GuestMenu token={token} tableLabel={table.label} />;
}
