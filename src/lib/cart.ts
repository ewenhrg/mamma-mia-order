import type { MenuProduct } from '@/lib/types';

export type CartLine = {
  /** Cle de fusion : meme produit + memes options + meme note = une seule ligne. */
  key: string;
  productId: string;
  name: string;
  basePriceCents: number;
  unitPriceCents: number;
  quantity: number;
  optionIds: string[];
  optionLabels: string[];
  note: string | null;
};

export type CartState = {
  tableId: string;
  lines: CartLine[];
  note: string;
};

export const MAX_LINE_QUANTITY = 99;
export const MAX_CART_LINES = 200;
export const CUSTOM_PREFIX = 'custom:';
export const CUSTOM_LABEL = 'Hors carte';
export const MAX_CUSTOM_NAME = 80;
/** 20 000 EGP — plafond serveur, pas un prix de menu. */
export const MAX_CUSTOM_PRICE_CENTS = 2_000_000;

export function isCustomLine(productId: string): boolean {
  return productId.startsWith(CUSTOM_PREFIX);
}

export function makeCustomLine(
  name: string,
  priceCents: number,
  quantity: number,
  note: string | null,
): CartLine {
  const trimmed = name.trim().slice(0, MAX_CUSTOM_NAME);
  const id = `${CUSTOM_PREFIX}${trimmed}|${priceCents}`;
  return {
    key: lineKey(id, [], note),
    productId: id,
    name: trimmed,
    basePriceCents: priceCents,
    unitPriceCents: priceCents,
    quantity,
    optionIds: [],
    optionLabels: [CUSTOM_LABEL],
    note,
  };
}

/**
 * Deux ajouts identiques doivent fusionner, deux ajouts differents non.
 * Les options sont triees pour que l'ordre de selection n'influe pas.
 */
export function lineKey(productId: string, optionIds: string[], note: string | null): string {
  const opts = [...optionIds].sort().join(',');
  return `${productId}|${opts}|${note ?? ''}`;
}

/** True si chaque groupe a le bon nombre de choix (ex. mix = exactement 2). */
export function optionsSatisfyGroups(product: MenuProduct, optionIds: string[]): boolean {
  for (const group of product.optionGroups) {
    const count = group.options.filter((o) => optionIds.includes(o.id)).length;
    if (count < group.minSelect) return false;
    if (group.maxSelect > 0 && count > group.maxSelect) return false;
  }
  return true;
}

export function missingRequiredOptions(product: MenuProduct, optionIds: string[]): number {
  let missing = 0;
  for (const group of product.optionGroups) {
    const count = group.options.filter((o) => optionIds.includes(o.id)).length;
    missing += Math.max(0, group.minSelect - count);
  }
  return missing;
}

export function makeLine(
  product: MenuProduct,
  optionIds: string[],
  note: string | null,
  quantity = 1,
): CartLine {
  const selected = product.optionGroups
    .flatMap((g) => g.options)
    .filter((o) => optionIds.includes(o.id));

  const delta = selected.reduce((sum, o) => sum + o.priceDeltaCents, 0);

  return {
    key: lineKey(product.id, optionIds, note),
    productId: product.id,
    name: product.name,
    basePriceCents: product.priceCents,
    unitPriceCents: product.priceCents + delta,
    quantity,
    optionIds: [...optionIds].sort(),
    optionLabels: selected.map((o) => o.name),
    note,
  };
}

export type CartAction =
  | { type: 'add'; line: CartLine }
  | { type: 'increment'; key: string }
  | { type: 'decrement'; key: string }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'remove'; key: string }
  | { type: 'setNote'; note: string }
  | { type: 'replace'; state: CartState }
  | { type: 'clear' };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const index = state.lines.findIndex((l) => l.key === action.line.key);
      if (index === -1) {
        if (state.lines.length >= MAX_CART_LINES) return state;
        return { ...state, lines: [...state.lines, action.line] };
      }
      const lines = state.lines.slice();
      const merged = lines[index];
      const quantity = Math.min(merged.quantity + action.line.quantity, MAX_LINE_QUANTITY);
      if (quantity === merged.quantity) return state;
      lines[index] = { ...merged, quantity };
      return { ...state, lines };
    }
    case 'increment':
      return mapQuantity(state, action.key, (q) => Math.min(q + 1, MAX_LINE_QUANTITY));
    case 'decrement': {
      const line = state.lines.find((l) => l.key === action.key);
      if (!line) return state;
      if (line.quantity <= 1) return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
      return mapQuantity(state, action.key, (q) => q - 1);
    }
    case 'setQuantity': {
      const quantity = Math.max(0, Math.min(Math.trunc(action.quantity), MAX_LINE_QUANTITY));
      if (quantity === 0) return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
      return mapQuantity(state, action.key, () => quantity);
    }
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
    case 'setNote':
      return state.note === action.note ? state : { ...state, note: action.note };
    case 'replace':
      return action.state;
    case 'clear':
      return state.lines.length === 0 && state.note === ''
        ? state
        : { tableId: state.tableId, lines: [], note: '' };
    default:
      return state;
  }
}

function mapQuantity(state: CartState, key: string, next: (q: number) => number): CartState {
  const index = state.lines.findIndex((l) => l.key === key);
  if (index === -1) return state;
  const quantity = next(state.lines[index].quantity);
  if (quantity === state.lines[index].quantity) return state;
  const lines = state.lines.slice();
  lines[index] = { ...lines[index], quantity };
  return { ...state, lines };
}

export function cartItemCount(lines: CartLine[]): number {
  let total = 0;
  for (const line of lines) total += line.quantity;
  return total;
}

/**
 * Total indicatif affiche au serveur. Le montant qui fait foi est celui
 * recalcule par la base lors de l'envoi (pos_submit_order), sauf hors carte
 * ou le prix saisi par le serveur est enregistre tel quel.
 */
export function cartTotalCents(lines: CartLine[]): number {
  let total = 0;
  for (const line of lines) total += line.unitPriceCents * line.quantity;
  return total;
}

/** Quantite deja au panier pour un produit, toutes variantes confondues. */
export function quantityForProduct(lines: CartLine[], productId: string): number {
  let total = 0;
  for (const line of lines) if (line.productId === productId) total += line.quantity;
  return total;
}
