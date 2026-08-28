'use client';

import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';

const MAX_RECENT = 12;

/**
 * Le serveur retrouve son contexte : meme categorie qu'a la table precedente,
 * et acces immediat a ce qu'il commande le plus souvent pendant ce service.
 */
export function getLastCategory(): string | null {
  return readJSON<string | null>(STORAGE_KEYS.lastCategory, null);
}

export function setLastCategory(categoryId: string): void {
  writeJSON(STORAGE_KEYS.lastCategory, categoryId);
}

export function getRecentProductIds(): string[] {
  return readJSON<string[]>(STORAGE_KEYS.recentProducts, []);
}

/** Remonte le produit en tete de la liste, sans doublon, taille bornee. */
export function pushRecentProduct(productId: string): string[] {
  const current = getRecentProductIds().filter((id) => id !== productId);
  const next = [productId, ...current].slice(0, MAX_RECENT);
  writeJSON(STORAGE_KEYS.recentProducts, next);
  return next;
}
