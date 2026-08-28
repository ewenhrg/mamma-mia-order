import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/supabase/server';
import { StaffAdmin } from '@/components/admin/StaffAdmin';

export const metadata = { title: 'Equipe — Administration' };

export default async function AdminStaffPage() {
  const staff = await getStaffSession();
  if (!staff) redirect('/login');

  return <StaffAdmin currentUserId={staff.userId} currentRole={staff.role} />;
}
