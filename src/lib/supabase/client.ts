'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

let cached: SupabaseClient<Database> | null = null;

/**
 * Client navigateur, instancie une seule fois pour toute la session.
 * Un client par appel recreerait un socket Realtime a chaque render.
 */
export function getSupabaseBrowser(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase non configure : renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local',
    );
  }

  cached = createBrowserClient<Database>(url, key, {
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return cached;
}
