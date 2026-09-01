'use client';

import { SWITCH_LOCALES, LOCALE_META, type Locale } from '@/lib/messages';
import { useI18n } from '@/lib/i18n';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div>
      {compact ? null : (
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('lang.label')}</p>
      )}
      <div className={`grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1 ${compact ? 'w-[7.5rem]' : ''}`}>
        {SWITCH_LOCALES.map((code: Locale) => {
          const active = locale === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`tap rounded-xl font-extrabold ${
                compact ? 'h-9 text-xs' : 'h-11 text-sm'
              } ${active ? 'bg-ink text-white' : 'text-ink-2 active:bg-surface'}`}
            >
              {LOCALE_META[code].short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
