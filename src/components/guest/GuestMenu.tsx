'use client';

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { ProductOptionsSheet, type OptionsDraft } from '@/components/pos/ProductOptionsSheet';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import {
  cartItemCount,
  cartReducer,
  cartTotalCents,
  makeLine,
  type CartLine,
  type CartState,
} from '@/lib/cart';
import { fetchGuestMenu } from '@/lib/menu';
import { formatAmount } from '@/lib/money';
import { STORAGE_KEYS, readJSON, removeKey, uuid, writeJSON } from '@/lib/storage';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { describeDbError } from '@/lib/adminErrors';
import type { Menu, MenuProduct, SubmitOrderResult } from '@/lib/types';

const EMPTY: Menu = { categories: [], products: [] };

export function GuestMenu({ token, tableLabel }: { token: string; tableLabel: string }) {
  const [menu, setMenu] = useState<Menu>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ orderNumber: number; totalCents: number; count: number } | null>(
    null,
  );
  const [noteProduct, setNoteProduct] = useState<MenuProduct | null>(null);
  const [editing, setEditing] = useState<CartLine | null>(null);

  const [cart, dispatch] = useReducer(cartReducer, token, (tableId): CartState => {
    const saved = readJSON<CartState | null>(STORAGE_KEYS.guestCart(tableId), null);
    if (saved && Array.isArray(saved.lines)) {
      return { tableId, lines: saved.lines, note: saved.note ?? '' };
    }
    return { tableId, lines: [], note: '' };
  });

  useEffect(() => {
    if (cart.lines.length === 0 && cart.note === '') removeKey(STORAGE_KEYS.guestCart(token));
    else writeJSON(STORAGE_KEYS.guestCart(token), cart);
  }, [cart, token]);

  useEffect(() => {
    let cancelled = false;
    fetchGuestMenu()
      .then((fresh) => {
        if (cancelled) return;
        setMenu(fresh);
        setCategoryId((current) => current ?? fresh.categories[0]?.id ?? null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeDbError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const products = useMemo(
    () => (categoryId ? menu.products.filter((p) => p.categoryId === categoryId) : menu.products),
    [menu.products, categoryId],
  );
  const count = useMemo(() => cartItemCount(cart.lines), [cart.lines]);
  const total = useMemo(() => cartTotalCents(cart.lines), [cart.lines]);
  const qtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart.lines) {
      map.set(line.productId, (map.get(line.productId) ?? 0) + line.quantity);
    }
    return map;
  }, [cart.lines]);

  const addProduct = useCallback((product: MenuProduct) => {
    dispatch({ type: 'add', line: makeLine(product, [], null, 1) });
  }, []);

  const confirmNote = useCallback(
    (draft: OptionsDraft) => {
      const product = noteProduct;
      if (!product) return;
      const line = makeLine(product, [], draft.note || null, draft.quantity);
      if (editing) dispatch({ type: 'remove', key: editing.key });
      dispatch({ type: 'add', line });
      setNoteProduct(null);
      setEditing(null);
    },
    [noteProduct, editing],
  );

  const submit = useCallback(async () => {
    if (submitting || cart.lines.length === 0) return;
    setSubmitting(true);
    setError(null);
    const { data, error: rpcError } = await getSupabaseBrowser().rpc('guest_submit_order', {
      p_table_token: token,
      p_client_request_id: uuid(),
      p_items: cart.lines.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity,
        option_ids: [],
        note: line.note,
      })),
      p_order_note: cart.note.trim() || null,
    });
    setSubmitting(false);
    if (rpcError || !data) {
      setError(describeDbError(rpcError ?? 'Envoi impossible'));
      return;
    }
    dispatch({ type: 'clear' });
    setCartOpen(false);
    const result = data as SubmitOrderResult;
    setSent({
      orderNumber: result.order_number,
      totalCents: result.total_cents,
      count: result.items_added,
    });
  }, [cart.lines, cart.note, submitting, token]);

  if (sent) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#F6EFE4] px-6 py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#0f9d5c] text-3xl text-white">
          ✓
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-ink">C&apos;est parti</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
          Commande #{sent.orderNumber} transmise au serveur
          {sent.count > 0 ? ` · ${sent.count} article${sent.count > 1 ? 's' : ''}` : ''}.
          Un serveur va la vérifier avant la cuisine.
        </p>
        <p className="mt-1 text-lg font-extrabold tabular-nums text-brand">
          {formatAmount(sent.totalCents)} EGP
        </p>
        <button
          type="button"
          onClick={() => setSent(null)}
          className="tap mt-8 h-14 w-full max-w-sm rounded-2xl bg-brand font-bold text-white shadow-lg shadow-brand/20"
        >
          Commander autre chose
        </button>
      </main>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F6EFE4]">
      <header className="pt-safe sticky top-0 z-20 border-b border-[#eadfce] bg-[#F6EFE4]/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand font-serif text-lg font-bold text-white">
            MM
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold leading-tight text-ink">Mamma Mia</p>
            <p className="text-sm font-semibold text-brand">Table {tableLabel}</p>
          </div>
        </div>
        {menu.categories.length > 0 ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
            {menu.categories.map((category) => {
              const active = category.id === categoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  className={`tap h-10 shrink-0 rounded-full px-4 text-sm font-bold ${
                    active ? 'bg-ink text-white' : 'bg-white text-ink-2 shadow-sm'
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      <main className="flex-1 px-4 py-4 pb-28">
        {error ? (
          <p role="alert" className="mb-3 rounded-2xl border border-alert/25 bg-alert-soft px-4 py-3 text-sm font-medium text-alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16 text-muted">
            <Spinner className="size-7" />
          </div>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">Menu en cours de mise à jour.</p>
        ) : (
          <ul className="space-y-2">
            {products.map((product) => {
              const qty = qtyByProduct.get(product.id) ?? 0;
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(product)}
                    className="tap flex w-full items-stretch gap-3 rounded-2xl bg-white p-3 text-left shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-bold leading-tight text-ink">{product.name}</p>
                      {product.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                          {product.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[15px] font-extrabold text-brand">
                        {formatAmount(product.priceCents)} EGP
                      </p>
                    </div>
                    <span
                      className={`flex size-11 shrink-0 self-center items-center justify-center rounded-full text-lg font-extrabold ${
                        qty > 0 ? 'bg-brand text-white' : 'bg-[#F6EFE4] text-brand'
                      }`}
                    >
                      {qty > 0 ? qty : '+'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {count > 0 ? (
        <div className="pb-safe pointer-events-none sticky bottom-0 z-20 px-4 pb-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="tap pointer-events-auto flex h-16 w-full items-center justify-between rounded-2xl bg-brand px-5 text-white shadow-lg shadow-brand/30"
          >
            <span className="font-bold">
              Voir le panier · {count} article{count > 1 ? 's' : ''}
            </span>
            <span className="text-lg font-extrabold tabular-nums">{formatAmount(total)}</span>
          </button>
        </div>
      ) : null}

      <Sheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title={`Table ${tableLabel}`}
        subtitle="Le serveur vérifie ta commande avant la cuisine"
        footer={
          <button
            type="button"
            disabled={cart.lines.length === 0 || submitting}
            onClick={() => void submit()}
            className="tap flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-extrabold text-white shadow-lg shadow-brand/25 disabled:bg-line disabled:text-muted disabled:shadow-none"
          >
            {submitting ? <Spinner className="size-5" /> : null}
            {submitting ? 'Envoi…' : `Demander · ${formatAmount(total)} EGP`}
          </button>
        }
      >
        <div className="space-y-3 p-4">
          {cart.lines.map((line) => (
            <div key={line.key} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{line.name}</p>
                  {line.note ? (
                    <p className="mt-1 text-xs font-semibold text-busy">{line.note}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-extrabold tabular-nums text-ink">
                  {formatAmount(line.unitPriceCents * line.quantity)}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'decrement', key: line.key })}
                  className="tap flex size-11 items-center justify-center rounded-xl border border-line"
                  aria-label="Retirer un"
                >
                  −
                </button>
                <span className="w-8 text-center text-lg font-extrabold">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'increment', key: line.key })}
                  className="tap flex size-11 items-center justify-center rounded-xl border border-line"
                  aria-label="Ajouter un"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const product = menu.products.find((p) => p.id === line.productId);
                    if (!product) return;
                    setEditing(line);
                    setNoteProduct(product);
                  }}
                  className="tap ml-auto h-11 rounded-xl px-3 text-sm font-semibold text-ink-2"
                >
                  Note
                </button>
              </div>
            </div>
          ))}

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink-2">Note pour la table</span>
            <textarea
              rows={2}
              value={cart.note}
              onChange={(e) => dispatch({ type: 'setNote', note: e.target.value.slice(0, 300) })}
              placeholder="Allergie, sans glace…"
              className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
            />
          </label>
        </div>
      </Sheet>

      <ProductOptionsSheet
        product={noteProduct}
        initial={
          editing
            ? { optionIds: [], note: editing.note ?? '', quantity: editing.quantity }
            : null
        }
        onClose={() => {
          setNoteProduct(null);
          setEditing(null);
        }}
        onConfirm={confirmNote}
      />
    </div>
  );
}
