/**
 * Tous les montants circulent en centimes (entiers) pour eviter les
 * arrondis flottants. Le formatage est le seul endroit qui divise par 100.
 */

export const CURRENCY = 'EGP';

/** 12000 -> "120", 12550 -> "125.50" */
export function formatAmount(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const units = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = units.toLocaleString('en-US');
  return rest === 0 ? `${sign}${grouped}` : `${sign}${grouped}.${String(rest).padStart(2, '0')}`;
}

/** 12000 -> "120 EGP" */
export function formatPrice(cents: number): string {
  return `${formatAmount(cents)} ${CURRENCY}`;
}

/** "120" | "120,50" | "120.5" -> 12050. Renvoie null si non parsable. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [units, decimals = ''] = cleaned.split('.');
  return Number(units) * 100 + Number(decimals.padEnd(2, '0'));
}
