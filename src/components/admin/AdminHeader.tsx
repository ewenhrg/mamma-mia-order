'use client';

import Link from 'next/link';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n';

export function AdminHeader({ fullName }: { fullName: string }) {
  const { t } = useI18n();
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Link
          href="/"
          aria-label={t('admin.back')}
          className="tap flex size-11 shrink-0 items-center justify-center rounded-xl text-ink active:bg-canvas"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-6 rtl:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold leading-tight text-ink">{t('admin.title')}</h1>
          <p className="truncate text-xs text-muted">{fullName}</p>
        </div>
      </div>
      <div className="px-3 pb-2">
        <LanguageSwitcher compact />
      </div>
    </>
  );
}
