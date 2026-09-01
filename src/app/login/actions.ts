'use server';

import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { findRosterEntry, rosterEmail } from '@/lib/roster';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/types';

export type SignInState = { error: null | string };

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
  if (!entry) return { error: 'UNKNOWN_NAME' };

  const requested = String(formData.get('next') ?? '/');
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { error: 'MISSING_CONFIG' };
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = rosterEmail(entry.slug);

  // 1. Compte technique : cree a la premiere connexion, sinon reutilise.
  //    On ignore volontairement l'erreur "deja inscrit" : c'est le cas normal.
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: entry.name },
  });
  if (created.error && !/already|exists|registered/i.test(created.error.message)) {
    return { error: `Connexion impossible : ${created.error.message}` };
  }

  // 2. Jeton a usage unique. Sa reponse porte aussi l'utilisateur, ce qui
  //    donne son identifiant meme quand le compte existait deja.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link.data?.properties?.hashed_token;
  const userId = link.data?.user?.id ?? created.data?.user?.id;

  if (link.error || !tokenHash || !userId) {
    return { error: `Connexion impossible : ${link.error?.message ?? 'jeton indisponible'}` };
  }

  // 3. Provisionnement, rejoue tant qu'il n'a pas abouti.
  //    Le trigger cree la fiche staff inactive ; c'est ici qu'elle prend son
  //    role et son activation. Une fois provisionnee, on n'y touche plus :
  //    les changements faits dans Admin > Equipe font foi.
  const provisioning = await ensureStaff(admin, userId, entry.name, entry.role);
  if (provisioning) return { error: provisioning };

  // 4. Echange du jeton contre une session (pose les cookies).
  const supabase = await getSupabaseServer();
  const { error: sessionError } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: tokenHash,
  });
  if (sessionError) return { error: `Connexion impossible : ${sessionError.message}` };

  // redirect() leve une exception de controle : il doit rester hors du try.
  redirect(next);
}

type AdminClient = ReturnType<typeof createClient<Database>>;

/** Renvoie un message d'erreur, ou null si tout va bien. */
async function ensureStaff(
  admin: AdminClient,
  userId: string,
  fullName: string,
  role: 'server' | 'manager' | 'admin',
): Promise<string | null> {
  const { data: existing, error: readError } = await admin
    .from('staff')
    .select('active, provisioned_at')
    .eq('id', userId)
    .maybeSingle();

  if (readError) {
    if (readError.code === '42703') {
      return "La migration 0005_provisionnement.sql n'a pas ete executee. Colle-la dans Supabase > SQL Editor, puis reessaie.";
    }
    return `Compte incomplet : ${readError.message}`;
  }

  // Deja etabli : on respecte ce qui a ete decide dans Admin > Equipe.
  if (existing?.provisioned_at) {
    return existing.active
      ? null
      : "Ton compte a ete desactive par un administrateur. Demande-lui de te reactiver dans Admin > Equipe.";
  }

  const { error: writeError } = await admin.from('staff').upsert(
    {
      id: userId,
      full_name: fullName,
      role,
      active: true,
      provisioned_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (writeError) return `Compte incomplet : ${writeError.message}`;
  return null;
}
