'use client';

import { useI18n } from '@/lib/i18n';

export function QrStaffCopy({ empty }: { empty: boolean }) {
  const { t } = useI18n();
  if (empty) {
    return <p className="print:hidden px-4 py-10 text-center text-sm text-muted">{t('admin.qrNeedSql')}</p>;
  }
  return <p className="text-sm leading-relaxed text-ink-2">{t('admin.qrBlurb')}</p>;
}
