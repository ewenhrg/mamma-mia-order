/**
 * Les RPC d'administration refusent une suppression avec un code court
 * (TABLE_HAS_ORDERS:4). On le traduit en phrase qui dit quoi faire, plutot
 * que de laisser remonter l'erreur Postgres brute.
 */
export function describeAdminError(message: string): string {
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
  if (message.includes('LAST_ZONE')) {
    return 'Il doit rester au moins une zone.';
  }
  if (message.includes('MANAGER_REQUIRED')) {
    return 'Reserve aux managers et administrateurs.';
  }
  if (message.includes('ORDER_NOT_PAID')) {
    return "Encaisse d'abord la table, ou utilise la liberation forcee (manager).";
  }
  if (message.includes('BALANCE_REMAINING')) {
    return 'Des articles ont ete ajoutes apres le paiement : encaisse le complement.';
  }
  if (message.includes('ORDER_CLOSED')) {
    return 'Cette commande est deja cloturee.';
  }
  return message;
}
