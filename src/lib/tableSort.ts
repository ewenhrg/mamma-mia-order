/**
 * Ordre des tables par le numéro dans le nom : BAR-1, BAR-2, BAR-10, BAR-21.
 * Marche avec « BAR-21 », « BAR 21 », « BAR21 », « 21 ».
 */

function asciiDigits(value: string): string {
  return value.normalize('NFKC').replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    return ch;
  });
}

/** Dernier nombre du libellé : « BAR-21 » → 21. Absent → null. */
export function tableNumber(label: string): number | null {
  const matches = asciiDigits(label).match(/\d+/g);
  if (!matches) return null;
  const n = Number(matches[matches.length - 1]);
  return Number.isFinite(n) ? n : null;
}

/** Lettres du prefixe, sans séparateurs : « BAR-21 » et « BAR 21 » → « bar ». */
function tablePrefix(label: string): string {
  return asciiDigits(label)
    .replace(/\d+/g, '')
    .replace(/[^\p{L}]+/gu, '')
    .toLocaleLowerCase('fr');
}

export function compareTableLabels(a: string, b: string): number {
  const la = a ?? '';
  const lb = b ?? '';
  const na = tableNumber(la);
  const nb = tableNumber(lb);
  if (na !== null || nb !== null) {
    if (na === null) return 1;
    if (nb === null) return -1;
    if (na !== nb) return na - nb;
  }
  const prefix = tablePrefix(la).localeCompare(tablePrefix(lb), 'fr', { sensitivity: 'base' });
  if (prefix !== 0) return prefix;
  return la.localeCompare(lb, 'fr', { sensitivity: 'base' });
}

export function sortByTableLabel<T extends { label: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => compareTableLabels(a.label, b.label));
}

/** Salle : zones regroupées, puis numéro du plus petit au plus grand. */
export function sortFloorTables<T extends { label: string; zone_name?: string | null }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => {
    const zone = (a.zone_name ?? '').localeCompare(b.zone_name ?? '', 'fr', { sensitivity: 'base' });
    if (zone !== 0) return zone;
    return compareTableLabels(a.label, b.label);
  });
}

/** Prefixe + numero : « BAR » + 21 → BAR-21. « BAR- » + 21 → BAR-21. */
export function formatTableLabel(prefix: string, n: number): string {
  const p = prefix.trim();
  if (!p) return String(n);
  if (/[-\s_]$/.test(p)) return `${p}${n}`;
  return `${p}-${n}`;
}
