'use client';

import { useI18n } from '@/lib/i18n';

export function LoginTagline() {
  const { t } = useI18n();
  return <p className="mt-1 text-sm text-muted">{t('login.tagline')}</p>;
}
