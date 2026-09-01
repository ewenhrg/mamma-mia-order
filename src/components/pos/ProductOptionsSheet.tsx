'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { formatAmount } from '@/lib/money';
import { MAX_LINE_QUANTITY } from '@/lib/cart';
import type { MenuProduct } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';

/** Demandes les plus frequentes en salle : un tap au lieu de dix lettres. */
const QUICK_NOTE_KEYS: MessageKey[] = [
  'note.n1',
  'note.n2',
  'note.n3',
  'note.n4',
  'note.n5',
  'note.n6',
  'note.n7',
  'note.n8',
  'note.n9',
  'note.n10',
];

export type OptionsDraft = {
  optionIds: string[];
  note: string;
  quantity: number;
};

type Props = {
  product: MenuProduct | null;
  /** Renseigne quand on modifie une ligne existante du panier. */
  initial?: OptionsDraft | null;
  onClose: () => void;
  onConfirm: (draft: OptionsDraft) => void;
};

export function ProductOptionsSheet({ product, initial, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    setNote(initial?.note ?? '');
    setQuantity(initial?.quantity ?? 1);
  }, [product, initial]);

  if (!product) return null;

  function toggleQuickNote(text: string) {
    setNote((current) => {
      const parts = current.split(',').map((p) => p.trim()).filter(Boolean);
      const index = parts.indexOf(text);
      if (index >= 0) parts.splice(index, 1);
      else parts.push(text);
      return parts.join(', ');
    });
  }

  const activeNotes = note.split(',').map((p) => p.trim());
  const unitCents = product.priceCents;

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      subtitle={`${formatAmount(product.priceCents)} EGP`}
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
            onClick={() => onConfirm({ optionIds: [], note: note.trim(), quantity })}
            className="tap flex h-14 min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-brand px-5 font-bold text-white shadow-lg shadow-brand/25 active:bg-brand-dark"
          >
            <span className="truncate">{initial ? t('note.save') : t('note.add')}</span>
            <span className="shrink-0 tabular-nums">{formatAmount(unitCents * quantity)}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-3 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink-2">{t('note.kitchen')}</h3>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {QUICK_NOTE_KEYS.map((key) => {
            const text = t(key);
            const on = activeNotes.includes(text);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleQuickNote(text)}
                className={`tap h-10 shrink-0 rounded-full border px-3.5 text-sm font-semibold ${
                  on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2'
                }`}
              >
                {text}
              </button>
            );
          })}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 240))}
          rows={3}
          placeholder={t('note.placeholder')}
          className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15"
        />
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
