import type { StaffRole } from '@/lib/types';

export type RosterEntry = {
  /** Identifiant technique, jamais affiche. */
  slug: string;
  /** Ce que le serveur voit et tape. */
  name: string;
  role: StaffRole;
};

/**
 * Equipe du restaurant. Aucun mot de passe : on choisit son prenom et on entre.
 *
 * Ajouter quelqu'un = ajouter une ligne ici. Le compte technique associe est
 * cree automatiquement a la premiere connexion ; le role peut ensuite etre
 * change dans Admin > Equipe sans toucher a ce fichier.
 */
export const ROSTER: RosterEntry[] = [
  { slug: 'ewen', name: 'Ewen', role: 'admin' },
  { slug: 'ramy', name: 'Ramy', role: 'admin' },
  { slug: 'ismail', name: 'Ismail', role: 'admin' },
  { slug: 'caisse', name: 'Caisse', role: 'manager' },
  { slug: 'ayline', name: 'Ayline', role: 'server' },
  { slug: 'riyad', name: 'Riyad', role: 'server' },
  { slug: 'emir', name: 'Emir', role: 'server' },
];

export function findRosterEntry(slug: string): RosterEntry | undefined {
  return ROSTER.find((entry) => entry.slug === slug);
}

/**
 * Adresse technique du compte. Elle n'est jamais affichee ni saisie : elle
 * n'existe que pour donner a chaque prenom une identite stable cote Supabase,
 * ce qui permet de garder les RLS et de savoir qui a pris chaque commande.
 */
export function rosterEmail(slug: string): string {
  return `${slug}@equipe.mammamia`;
}
