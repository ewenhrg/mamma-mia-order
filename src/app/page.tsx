import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/supabase/server';
import { SetupNotice } from '@/components/SetupNotice';
import { AccessPending } from '@/components/AccessPending';
import { TablesScreen } from '@/components/pos/TablesScreen';

// Etat de la salle : jamais mis en cache, il change a chaque commande.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <main className="pt-safe flex min-h-[100dvh] items-center justify-center bg-canvas px-5 py-10">
        <div className="w-full max-w-sm">
          <SetupNotice />
        </div>
      </main>
    );
  }

  const staff = await getStaffSession();
  if (!staff) redirect('/login');
  if (!staff.active) return <AccessPending fullName={staff.fullName} />;

  return <TablesScreen staff={staff} />;
}
