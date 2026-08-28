/**
 * Traduction des erreurs base en phrases qui disent quoi faire.
 *
 * Deux familles arrivent ici :
 *  - les refus metier de nos RPC, signales par un code court
 *    (TABLE_HAS_ORDERS:4, MANAGER_REQUIRED...) ;
 *  - les erreurs PostgREST / Postgres, dont le message brut
 *    ("Could not find the table 'public.zones' in the schema cache")
 *    ne veut rien dire pour quelqu'un en plein service.
 */

type DbError = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function asDbError(error: unknown): DbError {
  if (typeof error === 'string') return { message: error };
  if (typeof error === 'object' && error !== null) return error as DbError;
  return { message: String(error) };
}

export function describeDbError(error: unknown): string {
  const { message = '', code = '' } = asDbError(error);

  // --- Refus metier de nos fonctions ---------------------------------------
  const count = message.match(/:(\d+)/)?.[1];

  if (message.includes('TABLE_HAS_ORDERS')) {
    return `Cette table a deja recu ${count ?? 'des'} commande(s). Desactive-la plutot que de la supprimer : son historique reste consultable.`;
  }
  if (message.includes('CATEGORY_HAS_PRODUCTS')) {
    return `Cette categorie contient encore ${count ?? 'des'} produit(s). Deplace-les ou supprime-les d'abord.`;
  }
  if (message.includes('ZONE_HAS_TABLES')) {
    return `Cette zone contient encore ${count ?? 'des'} table(s). Deplace-les dans une autre zone d'abord.`;
  }
  if (message.includes('TABLE_NOT_FOUND')) {
    return "Cette table n'est plus disponible. Scanne a nouveau le QR, ou demande un serveur.";
  }
  if (message.includes('MANAGER_REQUIRED')) return 'Reserve aux managers et administrateurs.';
  if (message.includes('DISCOUNT_FORBIDDEN')) return 'Seul un manager peut accorder une remise.';
  if (message.includes('ORDER_NOT_PAID')) {
    return "Encaisse d'abord la table, ou demande a un manager de la liberer.";
  }
  if (message.includes('BALANCE_REMAINING')) {
    return 'Des articles ont ete ajoutes apres le paiement : encaisse le complement.';
  }
  if (message.includes('ORDER_CLOSED')) return 'Cette commande est deja cloturee.';
  if (message.includes('ORDER_NOT_FOUND')) return 'Cette commande est introuvable.';
  if (message.includes('STAFF_INACTIVE')) return 'Ton compte n est pas actif. Demande a un admin de t activer.';

  // --- Table ou colonne absente du cache de PostgREST ----------------------
  // Symptome classique juste apres avoir execute une migration : la base est
  // a jour mais l'API REST sert encore l'ancien schema.
  if (code === 'PGRST205' || code === 'PGRST204' || /schema cache/i.test(message)) {
    const what = message.match(/'([^']+)'/)?.[1];
    return [
      what
        ? `L'API Supabase ne connait pas encore « ${what} ».`
        : "L'API Supabase sert encore l'ancien schema.",
      "La base est probablement a jour, mais son cache ne l'est pas.",
      'Dans Supabase > SQL Editor, execute :',
      "notify pgrst, 'reload schema';",
      'puis recharge cette page.',
    ].join(' ');
  }

  // --- Objet reellement absent : migration non passee ----------------------
  if (code === '42P01') {
    const what = message.match(/"([^"]+)"/)?.[1];
    return `La table ${what ? `« ${what} » ` : ''}n'existe pas. Verifie que les migrations 0001 a 0004 ont bien ete executees, dans l'ordre.`;
  }
  if (code === '42703') {
    return `Une colonne attendue est absente (${message}). La migration 0004_zones_et_admin.sql n'a probablement pas ete executee jusqu'au bout.`;
  }
  if (code === '42883') {
    return `Une fonction attendue est absente (${message}). Reexecute la migration correspondante.`;
  }

  // --- Droits --------------------------------------------------------------
  if (code === '42501' || /row-level security/i.test(message)) {
    return "Ton compte n'a pas les droits pour cette action. Verifie ton role dans Admin > Equipe (il faut manager ou admin), puis reconnecte-toi.";
  }
  if (code === 'PGRST301' || /JWT|expired/i.test(message)) {
    return 'Ta session a expire. Reconnecte-toi.';
  }

  // --- Contraintes ---------------------------------------------------------
  if (code === '23505') return 'Ce nom existe deja.';
  if (code === '23503') return 'Cet element est encore utilise ailleurs.';
  if (code === '23502') return 'Un champ obligatoire est vide.';

  // --- Reseau / configuration ---------------------------------------------
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Impossible de joindre Supabase. Verifie NEXT_PUBLIC_SUPABASE_URL dans .env.local et ta connexion.";
  }

  return message || 'Erreur inconnue.';
}

/** Ancien nom, conserve pour les appels existants. */
export const describeAdminError = describeDbError;
