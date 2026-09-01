'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import {
  MAX_CUSTOM_NAME,
  MAX_CUSTOM_PRICE_CENTS,
  MAX_LINE_QUANTITY,
  type CartLine,
} from '@/lib/cart';
import { formatAmount, parseAmountToCents } from '@/lib/money';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  /** Ligne existante quand on modifie un hors-carte deja au panier. */
  initial: CartLine | null;
  onClose: () => void;
  onConfirm: (name: string, priceCents: number, quantity: number, note: string | null) => void;
};

export function CustomItemSheet({ open, initial, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setPrice(initial ? formatAmount(initial.unitPriceCents) : '');
    setNote(initial?.note ?? '');
    setQuantity(initial?.quantity ?? 1);
  }, [open, initial]);

  const priceCents = useMemo(() => parseAmountToCents(price), [price]);
  const trimmed = name.trim();
  const canConfirm =
    trimmed.length >= 1 &&
    trimmed.length <= MAX_CUSTOM_NAME &&
    priceCents !== null &&
    priceCents >= 0 &&
    priceCents <= MAX_CUSTOM_PRICE_CENTS;

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('order.custom')}
      subtitle={t('order.customHint')}
      footer={
        <div className="flex items-center gap-3">
          <div className="flex h-14 shrink-0 items-center gap-1 rounded-2xl border border-line bg-surface px-1">
            <StepButton
              label={t('note.qtyDown')}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 12h12" strokeLinecap="round" />
              </svg>
            </StepButton>
            <span className="w-8 text-center text-lg font-extrabold tabular-nums text-ink">
              {quantity}
            </span>
            <StepButton
              label={t('note.qtyUp')}
              onClick={() => setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))}
              disabled={quantity >= MAX_LINE_QUANTITY}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 6v12M6 12h12" strokeLinecap="round" />
              </svg>
            </StepButton>
          </div>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm || priceCents === null) return;
              onConfirm(trimmed, priceCents, quantity, note.trim() || null);
            }}
            className="tap-strong flex h-14 min-w-0 flex-1 items-center justify-center rounded-2xl bg-brand px-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            {initial ? t('order.customSave') : t('order.customAdd')}
            {canConfirm && priceCents !== null ? (
              <span className="ms-2 tabular-nums opacity-90">
                {formatAmount(priceCents * quantity)} EGP
              </span>
            ) : null}
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-4 py-4">
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

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink-2">{t('order.customPrice')}</span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="50"
            className="h-14 w-full rounded-2xl border border-line bg-surface px-4 text-[16px] tabular-nums text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink-2">{t('note.kitchen')}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 240))}
            rows={2}
            placeholder={t('note.placeholder')}
            className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </label>
      </div>
    </Sheet>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="tap flex size-12 items-center justify-center rounded-xl text-ink active:bg-canvas disabled:opacity-30"
    >
      {children}
    </button>
  );
}
