'use client';

import { getSupabaseBrowser } from '@/lib/supabase/client';
import { STORAGE_KEYS, readJSON, uuid, writeJSON } from '@/lib/storage';
import type { SubmitItemPayload, SubmitOrderResult } from '@/lib/types';

/**
 * File d'envoi durable ("outbox").
 *
 * Deux garanties, dans cet ordre :
 *  1. NE JAMAIS PERDRE une commande — elle est ecrite dans localStorage AVANT
 *     tout appel reseau, et n'en sort qu'apres confirmation de la base.
 *  2. NE JAMAIS ENVOYER DEUX FOIS — chaque envoi porte un clientRequestId
 *     genere une seule fois ; pos_submit_order est idempotente sur cette cle.
 *     Un retry, un double-tap ou un rechargement rejouent la meme cle et la
 *     base renvoie le resultat d'origine sans rien reinserer.
 */

export type OutboxStatus = 'pending' | 'sending' | 'failed';

export type OutboxEntry = {
  clientRequestId: string;
  tableId: string;
  tableLabel: string;
  items: SubmitItemPayload[];
  note: string | null;
  /** Estimation locale, uniquement pour l'affichage de la file. */
  estimatedTotalCents: number;
  itemCount: number;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: OutboxStatus;
  /** Renseigne uniquement pour une erreur definitive (produit retire, etc.). */
  fatalError: string | null;
};

type Listener = (entries: OutboxEntry[]) => void;

const listeners = new Set<Listener>();
let entries: OutboxEntry[] = [];
let hydrated = false;
let draining = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const MAX_BACKOFF_MS = 30_000;

/** Erreurs metier renvoyees par la RPC : reessayer ne changera rien. */
const FATAL_PATTERNS = [
  'EMPTY_CART',
  'CART_TOO_LARGE',
  'INVALID_QUANTITY',
  'PRODUCT_UNAVAILABLE',
  'INVALID_CUSTOM',
  'TABLE_NOT_FOUND',
  'STAFF_INACTIVE',
  'AUTH_REQUIRED',
  'MISSING_REQUEST_ID',
];

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  entries = readJSON<OutboxEntry[]>(STORAGE_KEYS.outbox, []).map((e) => ({
    ...e,
    // Un envoi interrompu par une fermeture d'onglet doit repartir en attente.
    status: e.status === 'sending' ? 'pending' : e.status,
  }));
}

function persist() {
  writeJSON(STORAGE_KEYS.outbox, entries);
  for (const listener of listeners) listener(entries);
}

export function getOutbox(): OutboxEntry[] {
  hydrate();
  return entries;
}

export function subscribeOutbox(listener: Listener): () => void {
  hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type EnqueueInput = {
  tableId: string;
  tableLabel: string;
  items: SubmitItemPayload[];
  note: string | null;
  estimatedTotalCents: number;
  itemCount: number;
};

/** Ecrit l'envoi sur le disque puis declenche le drain. Retourne l'id d'idempotence. */
export function enqueue(input: EnqueueInput): string {
  hydrate();
  const entry: OutboxEntry = {
    clientRequestId: uuid(),
    ...input,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
    status: 'pending',
    fatalError: null,
  };
  entries = [...entries, entry];
  persist();
  void drain();
  return entry.clientRequestId;
}

export function retryEntry(clientRequestId: string) {
  hydrate();
  entries = entries.map((e) =>
    e.clientRequestId === clientRequestId
      ? { ...e, status: 'pending', attempts: 0, nextAttemptAt: 0, fatalError: null }
      : e,
  );
  persist();
  void drain();
}

export function retryAll() {
  hydrate();
  entries = entries.map((e) => ({ ...e, status: 'pending', attempts: 0, nextAttemptAt: 0, fatalError: null }));
  persist();
  void drain();
}

/** Abandon explicite d'un envoi definitivement en erreur, decide par le serveur. */
export function discardEntry(clientRequestId: string) {
  hydrate();
  entries = entries.filter((e) => e.clientRequestId !== clientRequestId);
  persist();
}

function scheduleDrain(delay: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void drain();
  }, Math.max(delay, 250));
}

function classify(error: unknown): { fatal: boolean; message: string } {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const fatal = FATAL_PATTERNS.some((p) => message.includes(p));
  return { fatal, message };
}

/**
 * Vide la file, un envoi a la fois. Serialise volontairement : deux envois
 * concurrents sur la meme table se bloqueraient de toute facon cote base.
 */
export async function drain(): Promise<void> {
  hydrate();
  if (draining) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const next = entries.find((e) => e.status === 'pending' && e.nextAttemptAt <= Date.now());
  if (!next) {
    const waiting = entries.filter((e) => e.status === 'pending');
    if (waiting.length > 0) {
      scheduleDrain(Math.min(...waiting.map((e) => e.nextAttemptAt - Date.now())));
    }
    return;
  }

  draining = true;
  entries = entries.map((e) =>
    e.clientRequestId === next.clientRequestId ? { ...e, status: 'sending' } : e,
  );
  persist();

  try {
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.rpc('pos_submit_order', {
      p_client_request_id: next.clientRequestId,
      p_table_id: next.tableId,
      p_items: next.items,
      p_order_note: next.note,
    });

    if (error) throw error;

    // Succes (ou rejeu idempotent) : on sort l'envoi de la file.
    entries = entries.filter((e) => e.clientRequestId !== next.clientRequestId);
    persist();
    emitSent(data as unknown as SubmitOrderResult, next);
  } catch (error) {
    const { fatal, message } = classify(error);
    const attempts = next.attempts + 1;
    const backoff = Math.min(1000 * 2 ** (attempts - 1), MAX_BACKOFF_MS);

    entries = entries.map((e) =>
      e.clientRequestId === next.clientRequestId
        ? {
            ...e,
            attempts,
            status: fatal ? ('failed' as const) : ('pending' as const),
            nextAttemptAt: fatal ? 0 : Date.now() + backoff,
            fatalError: fatal ? message : null,
          }
        : e,
    );
    persist();
    if (!fatal) scheduleDrain(backoff);
  } finally {
    draining = false;
  }

  if (entries.some((e) => e.status === 'pending' && e.nextAttemptAt <= Date.now())) {
    void drain();
  }
}

// --- Notification de succes, pour le retour visuel global ------------------
type SentListener = (result: SubmitOrderResult, entry: OutboxEntry) => void;
const sentListeners = new Set<SentListener>();

export function onOrderSent(listener: SentListener): () => void {
  sentListeners.add(listener);
  return () => {
    sentListeners.delete(listener);
  };
}

function emitSent(result: SubmitOrderResult, entry: OutboxEntry) {
  for (const listener of sentListeners) listener(result, entry);
}
