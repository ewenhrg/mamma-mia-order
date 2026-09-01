import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types';

/** Client Supabase pour Server Components, Server Actions et Route Handlers. */
export async function getSupabaseServer() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase non configure : renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local',
    );
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appele depuis un Server Component : le refresh de session est
          // deja pris en charge par le middleware, on peut ignorer.
        }
      },
    },
  });
}

export type StaffSession = {
  userId: string;
  fullName: string;
  role: 'server' | 'manager' | 'admin';
  active: boolean;
};

/** Session + fiche staff, ou null si non connecte / fiche absente. */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data } = await supabase
    .from('staff')
    .select('full_name, role, active')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    userId: user.id,
    fullName: data.full_name,
    role: data.role,
    active: data.active,
  };
}
