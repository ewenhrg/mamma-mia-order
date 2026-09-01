'use client';

import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error('[POS]', error);
  }, [error]);

  return (
    <main className="pt-safe pb-safe flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-6 text-center">
      <h1 className="text-xl font-bold text-ink">{t('error.title')}</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{t('error.body')}</p>
      <button
        type="button"
        onClick={reset}
        className="tap mt-8 h-14 rounded-2xl bg-brand px-8 font-bold text-white shadow-lg shadow-brand/25"
      >
        {t('error.retry')}
      </button>
    </main>
  );
}
