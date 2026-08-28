import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/supabase/server';
import { AdminNav } from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffSession();
  if (!staff) redirect('/login');
  // Double barriere : ce garde-fou ecarte l'ecran, les policies RLS ecartent
  // les ecritures meme si quelqu'un appelle l'API directement.
  if (!staff.active || staff.role === 'server') redirect('/');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Link
            href="/"
            aria-label="Retour a la salle"
            className="tap flex size-11 shrink-0 items-center justify-center rounded-xl text-ink active:bg-canvas"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold leading-tight text-ink">Administration</h1>
            <p className="truncate text-xs text-muted">{staff.fullName}</p>
          </div>
        </div>
        <AdminNav />
      </header>

      <main className="pb-safe flex-1 px-3 py-4">{children}</main>
    </div>
  );
}
