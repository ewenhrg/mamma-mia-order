'use client';

import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/storage';
import type { CartState } from '@/lib/cart';

const PREFIX = STORAGE_KEYS.cart('');

export type DraftSummary = { itemCount: number; totalCents: number };

/**
 * Paniers commences mais pas encore envoyes, sur CE telephone.
 * Ils sont signales sur la grille des tables : sans ca, un serveur qui
 * quitte une table en cours de saisie n'a aucun moyen de s'en souvenir.
 */
export function readDrafts(): Map<string, DraftSummary> {
  const drafts = new Map<string, DraftSummary>();
  if (typeof window === 'undefined') return drafts;

  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const state = JSON.parse(raw) as CartState;
      if (!state?.lines?.length) continue;

      let itemCount = 0;
      let totalCents = 0;
      for (const line of state.lines) {
        itemCount += line.quantity;
        totalCents += line.unitPriceCents * line.quantity;
      }
      drafts.set(key.slice(PREFIX.length), { itemCount, totalCents });
    }
  } catch {
    /* stockage inaccessible : on affiche simplement aucun brouillon */
  }

  return drafts;
}

export function useDrafts(): Map<string, DraftSummary> {
  const [drafts, setDrafts] = useState<Map<string, DraftSummary>>(() => new Map());

  const refresh = useCallback(() => setDrafts(readDrafts()), []);

  useEffect(() => {
    refresh();
    // Retour depuis un ecran de commande, ou depuis un autre onglet.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  return drafts;
}
