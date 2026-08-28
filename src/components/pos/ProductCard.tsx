'use client';

import { memo } from 'react';
import { formatAmount } from '@/lib/money';
import type { MenuProduct } from '@/lib/types';

type Props = {
  product: MenuProduct;
  /** Quantite deja au panier, toutes variantes confondues. */
  quantity: number;
  onTap: (product: MenuProduct) => void;
  /** Appui long : ouvre les options meme si le produit peut etre ajoute direct. */
  onLongPress: (product: MenuProduct) => void;
};

function ProductCardBase({ product, quantity, onTap, onLongPress }: Props) {
  const disabled = !product.available;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onTap(product)}
      onContextMenu={(event) => {
        // Appui long sur mobile = menu contextuel : on le detourne
        // pour ouvrir les options sans ajouter de bouton a l'ecran.
        event.preventDefault();
        if (!disabled) onLongPress(product);
      }}
      className={`tap relative flex min-h-[6.5rem] flex-col justify-between rounded-2xl border p-3 text-left shadow-sm ${
        disabled
          ? 'border-line bg-canvas opacity-55'
          : quantity > 0
            ? 'border-brand/40 bg-brand-soft'
            : 'border-line bg-surface active:bg-canvas'
      }`}
    >
      {quantity > 0 ? (
        <span className="animate-pop absolute -right-1.5 -top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-brand px-1.5 text-[13px] font-extrabold text-white shadow-md shadow-brand/30">
          {quantity}
        </span>
      ) : null}

      <span className="line-clamp-2 text-[15px] font-bold leading-tight text-ink">{product.name}</span>

      <span className="mt-2 flex items-end justify-between gap-2">
        <span className="text-[15px] font-extrabold text-brand">
          {formatAmount(product.priceCents)}
        </span>
        {disabled ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-alert">Epuise</span>
        ) : product.hasOptions ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Options</span>
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-brand/10 text-brand">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </span>
    </button>
  );
}

/** La grille peut afficher 100 produits : ne re-rendre que ce qui change. */
export const ProductCard = memo(
  ProductCardBase,
  (prev, next) =>
    prev.product === next.product &&
    prev.quantity === next.quantity &&
    prev.onTap === next.onTap &&
    prev.onLongPress === next.onLongPress,
);
