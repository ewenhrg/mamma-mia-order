import type { StaffRole } from '@/lib/types';

export type RosterEntry = {
  /** Identifiant technique, jamais affiche. */
  slug: string;
  /** Ce que le serveur voit et tape. */
  name: string;
  role: StaffRole;
};

export type LoginPerson = {
  slug: string;
  name: string;
};

/**
 * Equipe de base, toujours proposee a la connexion.
 * Les gens ajoutes depuis Admin > Equipe viennent en plus, sans toucher a ce fichier.
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

const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

/** Prenom → identifiant de connexion : « Léa » → lea. */
export function nameToSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function findRosterEntry(slug: string): RosterEntry | undefined {
  return ROSTER.find((entry) => entry.slug === slug);
}

export function buildLoginList(staffNames: string[]): LoginPerson[] {
  const seen = new Set(ROSTER.map((entry) => entry.slug));
  const extra: LoginPerson[] = [];
  for (const name of staffNames) {
    const slug = nameToSlug(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    extra.push({ slug, name });
  }
  extra.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  return [...ROSTER.map(({ slug, name }) => ({ slug, name })), ...extra];
}

/**
 * Adresse technique du compte. Elle n'est jamais affichee ni saisie : elle
 * n'existe que pour donner a chaque prenom une identite stable cote Supabase,
 * ce qui permet de garder les RLS et de savoir qui a pris chaque commande.
 */
export function rosterEmail(slug: string): string {
  return `${slug}@equipe.mammamia`;
}
