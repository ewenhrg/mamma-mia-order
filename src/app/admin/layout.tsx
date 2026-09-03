import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/supabase/server';
import { isOwnerName } from '@/lib/roster';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminNav } from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffSession();
  if (!staff) redirect('/login');
  if (!staff.active || staff.role === 'server') redirect('/');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <AdminHeader fullName={staff.fullName} />
        <AdminNav showStats={isOwnerName(staff.fullName)} />
      </header>

      <main className="pb-safe flex-1 px-3 py-4">{children}</main>
    </div>
  );
}
