import { notFound, redirect } from 'next/navigation';
import { getStaffSession, getSupabaseServer } from '@/lib/supabase/server';
import { AccessPending } from '@/components/AccessPending';
import { OrderScreen } from '@/components/pos/OrderScreen';

export const dynamic = 'force-dynamic';

export default async function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const supabase = await getSupabaseServer();

  const [staff, tableRes] = await Promise.all([
    getStaffSession(),
    supabase
      .from('restaurant_tables')
      .select('id, label, seats, zone_id, guest_token, active, sort_order, created_at, updated_at')
      .eq('id', tableId)
      .eq('active', true)
      .maybeSingle(),
  ]);

  if (!staff) redirect('/login');
  if (!staff.active) return <AccessPending fullName={staff.fullName} />;

  const table = tableRes.data;
  if (!table) notFound();

  return <OrderScreen key={table.id} table={table} role={staff.role} />;
}
