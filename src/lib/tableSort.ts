/**
 * Ordre naturel des tables : BAR-1, BAR-2, BAR-10, BAR-21
 * (pas BAR-1, BAR-10, BAR-2).
 */
export function compareTableLabels(a: string, b: string): number {
  return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });
}

export function sortByTableLabel<T extends { label: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => compareTableLabels(a.label, b.label));
}

/** Salle : zones regroupées, puis numéro naturel dans chaque zone. */
export function sortFloorTables<T extends { label: string; zone_name: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => {
    const zone = a.zone_name.localeCompare(b.zone_name, 'fr', { sensitivity: 'base' });
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
