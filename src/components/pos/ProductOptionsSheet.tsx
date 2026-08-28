'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { formatAmount } from '@/lib/money';
import { MAX_LINE_QUANTITY } from '@/lib/cart';
import type { MenuProduct } from '@/lib/types';

/** Demandes les plus frequentes en salle : un tap au lieu de dix lettres. */
const QUICK_NOTES = [
  'Sans oignon',
  'Sans sauce',
  'Sans piment',
  'Sans glace',
  'Bien cuit',
  'A part',
  'Allergie',
  'Pour enfant',
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
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Re-initialise a chaque ouverture : un produit ne doit jamais heriter
  // des options du precedent.
  useEffect(() => {
    if (!product) return;
    setSelected(initial?.optionIds ?? []);
    setNote(initial?.note ?? '');
    setQuantity(initial?.quantity ?? 1);
  }, [product, initial]);

  const optionById = useMemo(() => {
    const map = new Map<string, { name: string; priceDeltaCents: number }>();
    if (product) {
      for (const group of product.optionGroups) {
        for (const option of group.options) map.set(option.id, option);
      }
    }
    return map;
  }, [product]);

  const unitCents = useMemo(() => {
    if (!product) return 0;
    let total = product.priceCents;
    for (const id of selected) total += optionById.get(id)?.priceDeltaCents ?? 0;
    return total;
  }, [product, selected, optionById]);

  const missingGroup = useMemo(() => {
    if (!product) return null;
    for (const group of product.optionGroups) {
      if (group.minSelect <= 0) continue;
      const count = group.options.filter((o) => selected.includes(o.id)).length;
      if (count < group.minSelect) return group.name;
    }
    return null;
  }, [product, selected]);

  if (!product) return null;

  function toggle(groupMaxSelect: number, groupOptionIds: string[], optionId: string) {
    setSelected((current) => {
      const isOn = current.includes(optionId);
      if (isOn) return current.filter((id) => id !== optionId);

      // Choix unique : la nouvelle option remplace celle du meme groupe.
      if (groupMaxSelect === 1) {
        return [...current.filter((id) => !groupOptionIds.includes(id)), optionId];
      }

      if (groupMaxSelect > 1) {
        const inGroup = current.filter((id) => groupOptionIds.includes(id));
        if (inGroup.length >= groupMaxSelect) return current;
      }

      return [...current, optionId];
    });
  }

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

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      subtitle={`${formatAmount(product.priceCents)} EGP`}
      footer={
        <div className="space-y-2">
          {/* Le rappel du choix manquant vit a cote du bouton grise, pas en
              haut du panneau : sur un telephone il serait hors ecran, et le
              serveur ne comprendrait pas pourquoi rien ne se passe. */}
          {missingGroup ? (
            <p className="rounded-xl bg-busy-soft px-3 py-2 text-center text-sm font-bold text-busy">
              Choisis d&apos;abord : {missingGroup}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <div className="flex h-14 shrink-0 items-center gap-1 rounded-2xl border border-line bg-surface px-1">
              <StepButton
                label="Diminuer la quantite"
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
                label="Augmenter la quantite"
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
              disabled={missingGroup !== null}
              onClick={() => onConfirm({ optionIds: selected, note: note.trim(), quantity })}
              className="tap flex h-14 min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-brand px-5 font-bold text-white shadow-lg shadow-brand/25 active:bg-brand-dark disabled:opacity-45 disabled:shadow-none"
            >
              <span className="truncate">{initial ? 'Modifier' : 'Ajouter'}</span>
              <span className="shrink-0 tabular-nums">{formatAmount(unitCents * quantity)}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 p-4">
        {product.optionGroups.map((group) => {
          const groupOptionIds = group.options.map((o) => o.id);
          const single = group.maxSelect === 1;
          return (
            <section key={group.id}>
              <header className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-2">{group.name}</h3>
                <span className="text-[11px] font-semibold text-muted">
                  {group.minSelect > 0 ? 'Obligatoire' : single ? 'Un seul' : group.maxSelect > 1 ? `Max ${group.maxSelect}` : 'Multiple'}
                </span>
              </header>

              <div className="grid grid-cols-2 gap-2">
                {group.options.map((option) => {
                  const on = selected.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggle(group.maxSelect, groupOptionIds, option.id)}
                      className={`tap flex min-h-13 flex-col justify-center rounded-2xl border px-3 py-2.5 text-left ${
                        on ? 'border-brand bg-brand-soft' : 'border-line bg-surface active:bg-canvas'
                      }`}
                    >
                      <span className={`text-sm font-bold leading-tight ${on ? 'text-brand' : 'text-ink'}`}>
                        {option.name}
                      </span>
                      {option.priceDeltaCents !== 0 ? (
                        <span className="mt-0.5 text-xs font-semibold text-muted">
                          {option.priceDeltaCents > 0 ? '+' : ''}
                          {formatAmount(option.priceDeltaCents)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-2">Note cuisine</h3>
          <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
            {QUICK_NOTES.map((text) => {
              const on = activeNotes.includes(text);
              return (
                <button
                  key={text}
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
            rows={2}
            placeholder="Precision pour la cuisine…"
            className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </section>
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
