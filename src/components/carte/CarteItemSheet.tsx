'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import type { CarteItem } from '@/lib/carte';
import { useI18n } from '@/lib/i18n';
import { formatAmount } from '@/lib/money';

export type CarteDraft = { choices: string[]; note: string; quantity: number };

export function CarteItemSheet({
  item,
  onClose,
  onConfirm,
}: {
  item: CarteItem | null;
  onClose: () => void;
  onConfirm: (draft: CarteDraft) => void;
}) {
  const { t } = useI18n();
  const [choices, setChoices] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setChoices([]);
    setNote('');
    setQuantity(1);
  }, [item]);

  if (!item) return null;

  const choice = item.choice;
  const valid = !choice || choices.length >= choice.min;

  const toggle = (option: string) => {
    if (!choice) return;
    if (choice.max === 1) {
      setChoices([option]);
      return;
    }
    setChoices((current) => {
      if (current.includes(option)) return current.filter((value) => value !== option);
      if (current.length >= choice.max) return current;
      return [...current, option];
    });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      subtitle={`${formatAmount(item.price * 100)} EGP`}
      footer={
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-2xl border border-line">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="tap flex size-14 items-center justify-center text-2xl font-bold text-ink"
              aria-label="−"
            >
              −
            </button>
            <span className="w-8 text-center text-lg font-extrabold tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="tap flex size-14 items-center justify-center text-2xl font-bold text-ink"
              aria-label="+"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onConfirm({ choices, note, quantity })}
            className="tap h-14 flex-1 rounded-2xl bg-[#A87C36] text-base font-extrabold text-white disabled:bg-line disabled:text-muted"
          >
            {t('carte.addToCart', { amount: formatAmount(item.price * 100 * quantity) })}
          </button>
        </div>
      }
    >
      <div className="space-y-5 p-4">
        {item.desc ? (
          <p className="text-[17px] italic leading-snug text-[#7C6A52] [font-family:var(--font-carte-serif)]">
            {item.desc}
          </p>
        ) : null}

        {choice ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-sm font-bold text-ink">{choice.label}</p>
              <p className="text-xs font-semibold text-muted">
                {choice.max === 1 ? t('carte.choose') : t('carte.chooseUpTo', { n: choice.max })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {choice.options.map((option) => {
                const selected = choices.includes(option);
                const blocked = !selected && choice.max > 1 && choices.length >= choice.max;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggle(option)}
                    disabled={blocked}
                    aria-pressed={selected}
                    className={`tap min-h-12 rounded-xl border-2 px-3 py-2 text-sm font-bold ${
                      selected
                        ? 'border-[#A87C36] bg-[#A87C36]/10 text-[#3A2A19]'
                        : 'border-line bg-surface text-ink-2 disabled:opacity-40'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink-2">{t('carte.noteLabel')}</span>
          <input
            type="text"
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('carte.notePh')}
            className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-ink outline-none focus:border-[#A87C36]"
          />
        </label>
      </div>
    </Sheet>
  );
}
