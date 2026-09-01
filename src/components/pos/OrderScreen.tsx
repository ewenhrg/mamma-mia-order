'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CartSheet } from '@/components/pos/CartSheet';
import { OutboxBanner } from '@/components/pos/OutboxBanner';
import { ProductCard } from '@/components/pos/ProductCard';
import { ProductOptionsSheet, type OptionsDraft } from '@/components/pos/ProductOptionsSheet';

import {
  cartItemCount,
  cartReducer,
  cartTotalCents,
  makeLine,
  type CartLine,
  type CartState,
} from '@/lib/cart';
import { normalize, useMenu } from '@/lib/menu';
import { localizeMenu } from '@/lib/menuI18n';
import { formatAmount } from '@/lib/money';
import { enqueue, onOrderSent } from '@/lib/outbox';
import { getLastCategory, getRecentProductIds, pushRecentProduct, setLastCategory } from '@/lib/prefs';
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { describeAdminError } from '@/lib/adminErrors';
import { useOrder } from '@/lib/useOrder';
import { useI18n } from '@/lib/i18n';
import { plural } from '@/lib/messages';
import type { MenuProduct, RestaurantTableRow, StaffRole } from '@/lib/types';

const RECENT_TAB = '__recent__';

type Props = {
  table: RestaurantTableRow;
  role: StaffRole;
};

export function OrderScreen({ table, role }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { menu, loading: menuLoading, error: menuError, reload } = useMenu();
  const displayMenu = useMemo(() => localizeMenu(menu, locale), [menu, locale]);
  const { order, items: orderItems, refresh: refreshOrder } = useOrder(table.id);

  const requestedItems = useMemo(
    () => orderItems.filter((item) => item.status === 'requested'),
    [orderItems],
  );
  const sentItems = useMemo(
    () => orderItems.filter((item) => item.status !== 'requested'),
    [orderItems],
  );
  const requestedCount = useMemo(
    () => requestedItems.reduce((sum, item) => sum + item.quantity, 0),
    [requestedItems],
  );

  // --- panier, restaure depuis le telephone -------------------------------
  const [cart, dispatch] = useReducer(cartReducer, table.id, (tableId): CartState => {
    const saved = readJSON<CartState | null>(STORAGE_KEYS.cart(tableId), null);
    if (saved && Array.isArray(saved.lines)) {
      return { tableId, lines: saved.lines, note: saved.note ?? '' };
    }
    return { tableId, lines: [], note: '' };
  });

  // Sauvegarde a chaque changement : fermer l'app ne perd jamais la saisie.
  useEffect(() => {
    if (cart.lines.length === 0 && cart.note === '') removeKey(STORAGE_KEYS.cart(table.id));
    else writeJSON(STORAGE_KEYS.cart(table.id), cart);
  }, [cart, table.id]);

  // --- navigation dans le menu --------------------------------------------
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => setRecentIds(getRecentProductIds()), []);

  // Reprend la categorie de la table precedente : pendant un service, le
  // serveur enchaine souvent les memes rubriques.
  useEffect(() => {
    if (category !== null || displayMenu.categories.length === 0) return;
    const last = getLastCategory();
    const stillExists = last && displayMenu.categories.some((c) => c.id === last);
    setCategory(stillExists ? last : displayMenu.categories[0].id);
  }, [displayMenu.categories, category]);

  const selectCategory = useCallback((id: string) => {
    setCategory(id);
    setQuery('');
    setSearchOpen(false);
    if (id !== RECENT_TAB) setLastCategory(id);
  }, []);

  // --- feuilles et retours visuels ----------------------------------------
  const [cartOpen, setCartOpen] = useState(false);
  const [optionsFor, setOptionsFor] = useState<MenuProduct | null>(null);
  const [editing, setEditing] = useState<{ line: CartLine; draft: OptionsDraft } | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'info'; text: string } | null>(null);
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const showToast = useCallback((kind: 'ok' | 'info', text: string) => {
    setToast({ kind, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Confirmation reelle : la base a accepte l'envoi. On rafraichit le ticket
  // sans attendre Realtime, qui peut etre coupe sur un reseau faible.
  useEffect(
    () =>
      onOrderSent((result, entry) => {
        if (entry.tableId !== table.id) return;
        void refreshOrder();
        setToast({ kind: 'ok', text: t('order.kitchenToast', { n: result.order_number }) });
      }),
    [table.id, refreshOrder, t],
  );

  // --- derives -------------------------------------------------------------
  const productsById = useMemo(() => {
    const map = new Map<string, MenuProduct>();
    for (const p of displayMenu.products) map.set(p.id, p);
    return map;
  }, [displayMenu.products]);

  /** Une seule passe sur le panier, au lieu d'un parcours par carte affichee. */
  const quantityByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart.lines) {
      map.set(line.productId, (map.get(line.productId) ?? 0) + line.quantity);
    }
    return map;
  }, [cart.lines]);

  const recentProducts = useMemo(
    () => recentIds.map((id) => productsById.get(id)).filter((p): p is MenuProduct => Boolean(p)),
    [recentIds, productsById],
  );

  const visibleProducts = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    if (q.length > 0) {
      return displayMenu.products.filter((p) => p.searchKey.includes(q));
    }
    if (category === RECENT_TAB) return recentProducts;
    if (!category) return [];
    return displayMenu.products.filter((p) => p.categoryId === category);
  }, [displayMenu.products, deferredQuery, category, recentProducts]);

  const draftCount = useMemo(() => cartItemCount(cart.lines), [cart.lines]);
  const draftTotal = useMemo(() => cartTotalCents(cart.lines), [cart.lines]);

  // --- actions -------------------------------------------------------------
  const addProduct = useCallback(
    (product: MenuProduct) => {
      dispatch({ type: 'add', line: makeLine(product, [], null, 1) });
      setRecentIds(pushRecentProduct(product.id));
    },
    [],
  );

  const openOptions = useCallback((product: MenuProduct) => {
    setEditing(null);
    setOptionsFor(product);
  }, []);

  const confirmOptions = useCallback(
    (draft: OptionsDraft) => {
      const product = optionsFor;
      if (!product) return;

      const line = makeLine(product, [], draft.note || null, draft.quantity);
      if (editing) {
        // Modifier = remplacer : la cle de ligne depend de la note.
        dispatch({ type: 'remove', key: editing.line.key });
      }
      dispatch({ type: 'add', line });
      setRecentIds(pushRecentProduct(product.id));
      setOptionsFor(null);
      setEditing(null);
    },
    [optionsFor, editing],
  );

  const editLine = useCallback(
    (line: CartLine) => {
      const product = productsById.get(line.productId);
      if (!product) return;
      setEditing({
        line,
        draft: { optionIds: line.optionIds, note: line.note ?? '', quantity: line.quantity },
      });
      setOptionsFor(product);
    },
    [productsById],
  );

  /**
   * Envoi. Trois verrous contre le double envoi, du plus local au plus sur :
   *  1. submitLock (synchrone) : deux evenements dans le meme tick.
   *  2. le panier est vide juste apres, le bouton se desactive.
   *  3. pos_submit_order est idempotente sur clientRequestId cote base.
   */
  const submit = useCallback(() => {
    if (submitLock.current) return;
    if (cart.lines.length === 0) return;

    submitLock.current = true;
    setSubmitting(true);

    try {
      enqueue({
        tableId: table.id,
        tableLabel: table.label,
        items: cart.lines.map((line) => ({
          product_id: line.productId,
          quantity: line.quantity,
          option_ids: line.optionIds,
          note: line.note,
        })),
        note: cart.note.trim() || null,
        estimatedTotalCents: draftTotal,
        itemCount: draftCount,
      });

      dispatch({ type: 'clear' });
      setCartOpen(false);
      showToast('ok', t('order.sentToast', { n: draftCount }));
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        submitLock.current = false;
      }, 800);
    }
  }, [cart.lines, cart.note, draftCount, draftTotal, table.id, table.label, showToast, t]);

  const voidItem = useCallback(
    async (itemId: string) => {
      const { error } = await getSupabaseBrowser().rpc('pos_void_item', { p_item_id: itemId });
      if (error) showToast('info', describeAdminError(error.message));
      else void refreshOrder();
    },
    [refreshOrder, showToast],
  );

  const acceptRequested = useCallback(async () => {
    if (!order || accepting) return;
    const count = requestedItems.reduce((sum, item) => sum + item.quantity, 0);
    if (count === 0) return;
    if (!window.confirm(t('order.confirmAccept', { n: count }))) return;

    setAccepting(true);
    const { error } = await getSupabaseBrowser().rpc('pos_accept_guest_items', {
      p_order_id: order.id,
    });
    setAccepting(false);
    if (error) {
      showToast('info', describeAdminError(error.message));
      return;
    }
    await refreshOrder();
    showToast('ok', t('order.acceptedToast', { n: count }));
  }, [order, accepting, requestedItems, refreshOrder, showToast, t]);

  /**
   * Encaisser ne libere pas la table : le paiement est enregistre, la
   * commande reste ouverte et le client peut continuer a commander.
   */
  const markPaid = useCallback(async () => {
    if (!order) return;
    const due = Math.max(order.total_cents - order.paid_amount_cents, 0);
    const amount = order.paid_at ? due : order.total_cents;
    if (!window.confirm(t('order.confirmPay', { amount: formatAmount(amount), label: table.label }))) {
      return;
    }

    const { error } = await getSupabaseBrowser().rpc('pos_mark_paid', {
      p_order_id: order.id,
      p_discount_cents: 0,
    });
    if (error) {
      showToast('info', describeAdminError(error.message));
      return;
    }
    await refreshOrder();
    showToast('ok', t('order.paidToast', { label: table.label }));
  }, [order, table.label, refreshOrder, showToast, t]);

  /** Geste distinct et explicite : c'est lui seul qui rend la table libre. */
  const releaseTable = useCallback(async () => {
    if (!order) return;
    if (!window.confirm(t('order.confirmRelease', { label: table.label }))) return;

    const { error } = await getSupabaseBrowser().rpc('pos_release_table', {
      p_order_id: order.id,
    });
    if (error) {
      showToast('info', describeAdminError(error.message));
      return;
    }
    setCartOpen(false);
    router.push('/');
  }, [order, table.label, router, showToast, t]);

  // ------------------------------------------------------------------ vue --
  const headerStatus = useMemo(() => {
    if (!order) return t('order.new', { n: table.seats });
    const remaining = Math.max(order.total_cents - order.paid_amount_cents, 0);
    if (order.paid_at && remaining > 0) {
      return t('order.paidRemain', { amount: formatAmount(remaining) });
    }
    if (order.paid_at) return t('order.paidOpen', { amount: formatAmount(order.paid_amount_cents) });
    return t('order.inProgress', { amount: formatAmount(order.total_cents) });
  }, [order, table.seats, t]);

  const showRecentTab = recentProducts.length > 0;
  const searching = query.trim().length > 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      {/* ------------------------------------------------------- en-tete --- */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Link
            href="/"
            prefetch
            onPointerDown={() => router.prefetch('/')}
            className="tap flex size-11 shrink-0 items-center justify-center rounded-xl text-ink active:bg-canvas"
            aria-label={t('order.back')}
          >
            <svg viewBox="0 0 24 24" className="size-6 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold leading-tight text-ink">
              {t('order.table', { label: table.label })}
            </h1>
            <p className="truncate text-xs text-muted">{headerStatus}</p>
          </div>

          <LanguageSwitcher compact />
        </div>

        <div className="flex items-center gap-2 px-3 pb-2.5">
          <button
            type="button"
            onClick={() => {
              if (searchOpen) {
                setSearchOpen(false);
                setQuery('');
              } else {
                setSearchOpen(true);
                requestAnimationFrame(() => searchInputRef.current?.focus());
              }
            }}
            aria-label={t('order.search')}
            aria-pressed={searchOpen}
            className={`tap flex size-11 shrink-0 items-center justify-center rounded-full border ${
              searchOpen ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2'
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" strokeLinecap="round" />
            </svg>
          </button>
          <div className="no-scrollbar snap-x-tabs flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {showRecentTab ? (
              <CategoryTab
                active={category === RECENT_TAB && !searching}
                onClick={() => selectCategory(RECENT_TAB)}
                label={t('order.recent')}
              />
            ) : null}
            {displayMenu.categories.map((c) => (
              <CategoryTab
                key={c.id}
                active={category === c.id && !searching}
                onClick={() => selectCategory(c.id)}
                label={c.name}
                color={c.color}
              />
            ))}
          </div>
        </div>

        {searchOpen ? (
          <div className="px-3 pb-2.5">
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('order.searchPlaceholder')}
              autoComplete="off"
              enterKeyHint="search"
              className="h-12 w-full rounded-2xl border border-line bg-canvas px-4 text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:bg-surface"
            />
          </div>
        ) : null}
      </header>

      <OutboxBanner />

      {requestedCount > 0 ? (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="tap sticky top-0 z-20 flex w-full items-center gap-3 bg-brand px-4 py-3 text-start text-white"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-sm font-extrabold tabular-nums">
            {requestedCount}
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold">
            {t('order.guestBanner')}
          </span>
          <span className="shrink-0 text-sm font-extrabold">{t('order.open')}</span>
        </button>
      ) : null}

      {toast ? (
        <div
          role="status"
          className={`animate-toast sticky top-0 z-20 flex items-center gap-3 px-4 py-3 ${
            toast.kind === 'ok' ? 'bg-free text-white' : 'bg-ink text-white'
          }`}
        >
          <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{toast.text}</span>
          <Link
            href="/"
            className="tap shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-bold text-white"
          >
            {t('order.floor')}
          </Link>
        </div>
      ) : null}

      {/* ------------------------------------------------------ produits --- */}
      <main className="flex-1 px-3 py-3 pb-32">
        {menuLoading && menu.products.length === 0 ? (
          <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="h-[6.5rem] animate-pulse rounded-2xl bg-line/50" />
            ))}
          </div>
        ) : menuError && menu.products.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-sm font-medium text-alert">{t('order.menuDown')}</p>
            <button
              type="button"
              onClick={reload}
              className="tap mt-4 h-12 rounded-2xl bg-brand px-6 font-bold text-white"
            >
              {t('order.retry')}
            </button>
          </div>
        ) : visibleProducts.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted">
            {searching ? t('order.noSearch', { q: query.trim() }) : t('order.noCategory')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={quantityByProduct.get(product.id) ?? 0}
                onTap={addProduct}
                onLongPress={openOptions}
              />
            ))}
          </div>
        )}
      </main>

      {/* ------------------------------------------------- barre panier --- */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-3 pt-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className={`tap-strong mb-2.5 flex h-16 w-full items-center gap-3 rounded-2xl px-4 text-start ${
            draftCount > 0 || requestedCount > 0
              ? 'bg-brand text-white shadow-lg shadow-brand/25'
              : order
                ? 'border border-line bg-surface text-ink'
                : 'border border-line bg-canvas text-muted'
          }`}
        >
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
              draftCount > 0 || requestedCount > 0 ? 'bg-white/20' : 'bg-canvas'
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h2l2.2 10.2A2 2 0 0010.1 18h6.6a2 2 0 002-1.6L20.5 9H7" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10.5" cy="20.5" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="17.5" cy="20.5" r="1.2" fill="currentColor" stroke="none" />
            </svg>
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-extrabold leading-tight">
              {draftCount > 0
                ? t(plural(draftCount, 'order.items', 'order.items_other'), { n: draftCount })
                : requestedCount > 0
                  ? t(plural(requestedCount, 'order.guestRequests', 'order.guestRequests_other'), {
                      n: requestedCount,
                    })
                  : order
                    ? t('order.viewOrder')
                    : t('order.emptyCart')}
            </span>
            <span className="block truncate text-xs opacity-80">
              {draftCount > 0
                ? t('order.toSend', { amount: formatAmount(draftTotal) })
                : requestedCount > 0
                  ? t('order.checkKitchen')
                  : order
                    ? t('order.alreadyOrdered', { amount: formatAmount(order.total_cents) })
                    : t('order.tapProduct')}
            </span>
          </span>

          {draftCount > 0 || requestedCount > 0 || order ? (
            <span className="shrink-0 rounded-xl bg-white/20 px-3 py-2 text-sm font-extrabold">
              {draftCount > 0 || requestedCount > 0 ? t('order.see') : t('order.open')}
            </span>
          ) : null}
        </button>
      </div>

      {/* -------------------------------------------------------- sheets --- */}
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        tableLabel={table.label}
        lines={cart.lines}
        note={cart.note}
        dispatch={dispatch}
        onEditLine={editLine}
        order={order}
        sentItems={sentItems}
        requestedItems={requestedItems}
        role={role}
        submitting={submitting}
        accepting={accepting}
        onSubmit={submit}
        onAcceptRequested={() => void acceptRequested()}
        onVoidItem={voidItem}
        onMarkPaid={markPaid}
        onReleaseTable={releaseTable}
      />

      <ProductOptionsSheet
        product={optionsFor}
        initial={editing?.draft ?? null}
        onClose={() => {
          setOptionsFor(null);
          setEditing(null);
        }}
        onConfirm={confirmOptions}
      />
    </div>
  );
}

function CategoryTab({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active && color ? { backgroundColor: color } : undefined}
      className={`tap h-11 shrink-0 rounded-full px-4 text-[15px] font-bold ${
        active ? 'text-white' : 'border border-line bg-surface text-ink-2'
      } ${active && !color ? 'bg-ink' : ''}`}
    >
      {label}
    </button>
  );
}
