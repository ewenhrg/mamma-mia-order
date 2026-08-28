import { notFound, redirect } from 'next/navigation';
import { getStaffSession, getSupabaseServer } from '@/lib/supabase/server';
import { AccessPending } from '@/components/AccessPending';
import { OrderScreen } from '@/components/pos/OrderScreen';

export const dynamic = 'force-dynamic';

export default async function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;

  const staff = await getStaffSession();
  if (!staff) redirect('/login');
  if (!staff.active) return <AccessPending fullName={staff.fullName} />;

  const supabase = await getSupabaseServer();
  const { data: table } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('id', tableId)
    .eq('active', true)
    .maybeSingle();

  if (!table) notFound();

  return <OrderScreen table={table} role={staff.role} />;
}
