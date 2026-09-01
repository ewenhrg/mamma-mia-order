/**
 * Acces localStorage tolerant aux pannes : navigation privee, quota plein,
 * WebView qui refuse le stockage. Une lecture ratee ne doit jamais casser le POS.
 */

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota plein ou stockage bloque : on continue en memoire */
  }
}

export function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** crypto.randomUUID n'existe pas sur les vieux WebView Android / http non securise. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const STORAGE_KEYS = {
  cart: (tableId: string) => `mm.cart.v1.${tableId}`,
  outbox: 'mm.outbox.v1',
  lastCategory: 'mm.lastCategory.v1',
  menuCache: 'mm.menu.v1',
  guestMenuCache: 'mm.guest.menu.v1',
  guestCart: (token: string) => `mm.guest.cart.v1.${token}`,
  locale: 'mm.locale.v1',
} as const;
