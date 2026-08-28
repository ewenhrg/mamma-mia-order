'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { drain, getOutbox, subscribeOutbox, type OutboxEntry } from '@/lib/outbox';

const EMPTY: OutboxEntry[] = [];
const serverSnapshot = () => EMPTY;

/** File d'envoi + relance automatique au retour du reseau ou de l'avant-plan. */
export function useOutbox(): OutboxEntry[] {
  const entries = useSyncExternalStore(subscribeOutbox, getOutbox, serverSnapshot);

  useEffect(() => {
    const retry = () => void drain();

    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    // Une premiere tentative au montage vide la file laissee par une session
    // precedente (onglet ferme en plein envoi, telephone en veille).
    retry();

    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, []);

  return entries;
}

/** navigator.onLine, suivi en direct. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
