import { getSupabaseServer } from '@/lib/supabase/server';
import { GuestMenu } from '@/components/guest/GuestMenu';

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
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#F6EFE4] px-6 py-12 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-brand font-serif text-2xl font-bold text-white">
          MM
        </span>
        <h1 className="mt-5 text-xl font-extrabold text-ink">QR invalide</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
          Cette table n&apos;est plus disponible. Demande un serveur, ou scanne le QR de ta table.
        </p>
      </main>
    );
  }

  return <GuestMenu token={token} tableLabel={table.label} />;
}
