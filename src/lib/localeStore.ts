import type { Locale } from '@/lib/messages';

let localeRef: Locale = 'fr';

export function getLocale(): Locale {
  return localeRef;
}

export function setLocaleRef(next: Locale): void {
  localeRef = next;
}
