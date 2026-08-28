/** "3 min", "1 h 05" — compact, lisible d'un coup d'oeil sur une carte table. */
export function formatElapsed(from: string | number | Date, now = Date.now()): string {
  const start = from instanceof Date ? from.getTime() : new Date(from).getTime();
  if (!Number.isFinite(start)) return '';

  const minutes = Math.max(0, Math.floor((now - start) / 60000));
  // Toujours une duree, jamais "a l'instant" : le texte est toujours precede
  // de "il y a", et "il y a a l'instant" ne se lit pas.
  if (minutes < 1) return "moins d'1 min";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

export function minutesSince(from: string | number | Date, now = Date.now()): number {
  const start = from instanceof Date ? from.getTime() : new Date(from).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 60000));
}
