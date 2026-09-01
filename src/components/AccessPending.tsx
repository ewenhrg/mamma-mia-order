'use client';

import { SignOutButton } from '@/components/SignOutButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n';

export function AccessPending({ fullName }: { fullName: string }) {
  const { t } = useI18n();
  return (
    <main className="pt-safe pb-safe flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-6 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-busy-soft text-busy">
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-ink">{t('access.title')}</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{t('access.body', { name: fullName })}</p>
      <div className="mt-8 w-full max-w-xs space-y-4">
        <LanguageSwitcher />
        <SignOutButton />
      </div>
    </main>
  );
}
