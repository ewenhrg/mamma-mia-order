'use client';

import { useI18n } from '@/lib/i18n';

export function PrintButton({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`tap h-14 w-full rounded-2xl bg-brand font-bold text-white ${className}`}
    >
      {t('admin.print')}
    </button>
  );
}
