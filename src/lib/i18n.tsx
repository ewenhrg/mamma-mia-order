'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';
import { setLocaleRef } from '@/lib/localeStore';
import {
  LOCALE_META,
  translate,
  type Locale,
  type MessageKey,
  type TVars,
} from '@/lib/messages';

function readSavedLocale(): Locale {
  const saved = readJSON<string>(STORAGE_KEYS.locale, 'fr');
  return saved === 'en' ? 'en' : 'fr';
}

type I18nValue = {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  setLocale: (next: Locale) => void;
  t: (key: MessageKey, vars?: TVars) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    setLocaleState(readSavedLocale());
  }, []);

  const setLocale = useCallback((next: Locale) => {
    const code: Locale = next === 'en' ? 'en' : 'fr';
    setLocaleState(code);
    writeJSON(STORAGE_KEYS.locale, code);
  }, []);

  useEffect(() => {
    setLocaleRef(locale);
    const html = document.documentElement;
    html.lang = locale;
    html.dir = LOCALE_META[locale].dir;
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: LOCALE_META[locale].dir,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: 'fr',
      dir: 'ltr',
      setLocale: () => undefined,
      t: (key, vars) => translate('fr', key, vars),
    };
  }
  return ctx;
}
