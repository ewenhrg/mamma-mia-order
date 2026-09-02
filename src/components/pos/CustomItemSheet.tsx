'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { MAX_CUSTOM_NAME, type CartLine } from '@/lib/cart';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  /** Ligne existante quand on modifie un hors-carte deja au panier. */
  initial: CartLine | null;
  onClose: () => void;
  onConfirm: (name: string) => void;
};

export function CustomItemSheet({ open, initial, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
  }, [open, initial]);

  const trimmed = name.trim();
  const canConfirm = trimmed.length >= 1 && trimmed.length <= MAX_CUSTOM_NAME;

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('order.custom')}
      subtitle={t('order.customHint')}
      footer={
        <button
          type="submit"
          form="custom-item-form"
          disabled={!canConfirm}
          className="tap-strong flex h-14 w-full items-center justify-center rounded-2xl bg-brand px-4 text-base font-extrabold text-white disabled:opacity-40"
        >
          {initial ? t('order.customSave') : t('order.customAdd')}
        </button>
      }
    >
      <form
        id="custom-item-form"
        className="px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canConfirm) return;
          onConfirm(trimmed);
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink-2">{t('order.customName')}</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_CUSTOM_NAME))}
            placeholder={t('order.customNamePh')}
            className="h-14 w-full rounded-2xl border border-line bg-surface px-4 text-[16px] text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </label>
      </form>
    </Sheet>
  );
}
