'use server';

import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { findRosterEntry, rosterEmail } from '@/lib/roster';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/types';

export type SignInState = { error: string | null };

/**
 * Connexion par prenom, sans mot de passe cote serveur.
 *
 * Le serveur tape son prenom, rien d'autre. En arriere-plan, cette action
 * ouvre une vraie session Supabase pour un compte technique dedie : c'est ce
 * qui permet de conserver les policies RLS et de savoir qui a pris chaque
 * commande. La cle de service ne quitte jamais le serveur.
 */
export async function signInAs(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const slug = String(formData.get('slug') ?? '');
  const entry = findRosterEntry(slug);
  if (!entry) return { error: 'Prenom inconnu.' };

  const requested = String(formData.get('next') ?? '/');
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return {
      error:
        "Configuration incomplete : ajoute SUPABASE_SERVICE_ROLE_KEY dans .env.local (Supabase > Project Settings > API).",
    };
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = rosterEmail(entry.slug);

  // 1. Compte technique : cree a la premiere connexion, sinon reutilise.
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: entry.name },
  });

  const alreadyExists =
    created.error !== null && /already|exists|registered/i.test(created.error.message);
  if (created.error && !alreadyExists) {
    return { error: `Connexion impossible : ${created.error.message}` };
  }

  // Le role n'est pose qu'a la creation : si un admin l'a change ensuite
  // dans Admin > Equipe, ce choix doit primer sur ce fichier.
  if (created.data?.user) {
    const { error: staffError } = await admin
      .from('staff')
      .upsert(
        { id: created.data.user.id, full_name: entry.name, role: entry.role, active: true },
        { onConflict: 'id' },
      );
    if (staffError) return { error: `Compte incomplet : ${staffError.message}` };
  }

  // 2. Jeton a usage unique, echange immediatement contre une session.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    return { error: `Connexion impossible : ${link.error?.message ?? 'jeton indisponible'}` };
  }

  const supabase = await getSupabaseServer();
  const { error: sessionError } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: tokenHash,
  });
  if (sessionError) return { error: `Connexion impossible : ${sessionError.message}` };

  // redirect() leve une exception de controle : il doit rester hors du try.
  redirect(next);
}
