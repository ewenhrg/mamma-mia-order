'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="pt-safe pb-safe flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-6 text-center">
      <h1 className="text-xl font-bold text-ink">{t('notfound.title')}</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">{t('notfound.body')}</p>
      <Link
        href="/"
        className="tap mt-8 flex h-14 items-center rounded-2xl bg-brand px-8 font-bold text-white shadow-lg shadow-brand/25"
      >
        {t('notfound.back')}
      </Link>
    </main>
  );
}
