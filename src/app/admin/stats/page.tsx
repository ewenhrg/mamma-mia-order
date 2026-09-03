import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/supabase/server';
import { isOwnerName } from '@/lib/roster';
import { StatsAdmin } from '@/components/admin/StatsAdmin';

export const metadata = { title: 'Stats — Administration' };

export default async function AdminStatsPage() {
  const staff = await getStaffSession();
  if (!staff || !staff.active || !isOwnerName(staff.fullName)) redirect('/admin/menu');

  return <StatsAdmin />;
}
