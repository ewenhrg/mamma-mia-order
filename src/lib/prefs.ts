'use client';

import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';

/**
 * Le serveur retrouve son contexte : meme categorie qu'a la table precedente.
 */
export function getLastCategory(): string | null {
  return readJSON<string | null>(STORAGE_KEYS.lastCategory, null);
}

export function setLastCategory(categoryId: string): void {
  writeJSON(STORAGE_KEYS.lastCategory, categoryId);
}
