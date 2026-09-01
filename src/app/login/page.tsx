import { createClient } from '@supabase/supabase-js';
import { LoginForm } from './LoginForm';
import { LoginTagline } from './LoginTagline';
import { SetupNotice } from '@/components/SetupNotice';
import { buildLoginList, ROSTER } from '@/lib/roster';
import type { Database } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connexion — Mamma Mia' };

async function loadLoginPeople() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return ROSTER.map(({ slug, name }) => ({ slug, name }));

  try {
    const admin = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await admin.from('staff').select('full_name').eq('active', true);
    return buildLoginList((data ?? []).map((row) => row.full_name));
  } catch {
    return ROSTER.map(({ slug, name }) => ({ slug, name }));
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // On ne redirige que vers une route interne : un "next" venant de l'URL
  // ne doit pas pouvoir envoyer le serveur ailleurs.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const configured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const people = configured ? await loadLoginPeople() : [];

  return (
    <main className="pt-safe pb-safe flex min-h-[100dvh] flex-col justify-center bg-canvas px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand font-serif text-2xl font-bold text-white shadow-lg shadow-brand/25">
            MM
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Mamma Mia</h1>
          <LoginTagline />
        </div>

        {configured ? <LoginForm next={safeNext} people={people} /> : <SetupNotice />}
      </div>
    </main>
  );
}
