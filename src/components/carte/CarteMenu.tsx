'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  CARTE,
  carteLineKey,
  carteTotals,
  findCarteItem,
  type CarteCategory,
  type CarteGroup,
  type CarteItem,
  type CarteLine,
} from '@/lib/carte';
import { useI18n } from '@/lib/i18n';
import { plural } from '@/lib/messages';
import { formatAmount } from '@/lib/money';
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage';
import { CarteCartSheet, CarteShowScreen } from './CarteOrder';
import { CarteItemSheet, type CarteDraft } from './CarteItemSheet';

type CartState = { lines: CarteLine[]; table: string };

type CartAction =
  | { type: 'hydrate'; state: CartState }
  | { type: 'add'; line: CarteLine }
  | { type: 'increment'; key: string }
  | { type: 'decrement'; key: string }
  | { type: 'setTable'; table: string }
  | { type: 'clear' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'add': {
      const existing = state.lines.find((line) => line.key === action.line.key);
      if (!existing) return { ...state, lines: [...state.lines, action.line] };
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.key === action.line.key ? { ...line, quantity: line.quantity + action.line.quantity } : line,
        ),
      };
    }
    case 'increment':
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.key === action.key ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line,
        ),
      };
    case 'decrement':
      return {
        ...state,
        lines: state.lines
          .map((line) => (line.key === action.key ? { ...line, quantity: line.quantity - 1 } : line))
          .filter((line) => line.quantity > 0),
      };
    case 'setTable':
      return { ...state, table: action.table.slice(0, 20) };
    case 'clear':
      return { ...state, lines: [] };
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

const GROUP_PHOTOS: Record<CarteGroup, string[]> = {
  drinks: ['/menu/cafe-latte.jpg', '/menu/jus-frais.jpg', '/menu/mojitos.jpg'],
  food: ['/menu/oeuf.jpg', '/menu/salade.jpg', '/menu/pizza.jpg'],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function CarteMenu({ initialTable }: { initialTable: string }) {
  const { t, locale } = useI18n();
  const [group, setGroup] = useState<CarteGroup>('drinks');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string>(CARTE[0].id);
  const [sheetItem, setSheetItem] = useState<CarteItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [showing, setShowing] = useState(false);
  const [cart, dispatch] = useReducer(cartReducer, { lines: [], table: initialTable });
  const hydrated = useRef(false);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = readJSON<CartState | null>(STORAGE_KEYS.carteCart, null);
    const lines = Array.isArray(saved?.lines) ? saved.lines.filter((line) => findCarteItem(line.itemId)) : [];
    dispatch({ type: 'hydrate', state: { lines, table: initialTable || saved?.table || '' } });
    hydrated.current = true;
  }, [initialTable]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (cart.lines.length === 0 && !cart.table) removeKey(STORAGE_KEYS.carteCart);
    else writeJSON(STORAGE_KEYS.carteCart, cart);
  }, [cart]);

  const searching = query.trim().length > 0;

  const visible = useMemo<CarteCategory[]>(() => {
    if (!searching) return CARTE.filter((cat) => cat.group === group);
    const needle = normalize(query.trim());
    return CARTE.map((cat) => {
      const title = normalize(`${cat.title.fr} ${cat.title.en}`);
      const match = (item: CarteItem) =>
        title.includes(needle) || normalize(`${item.name} ${item.desc ?? ''}`).includes(needle);
      return {
        ...cat,
        items: cat.items.filter(match),
        extras: cat.extras ? { ...cat.extras, items: cat.extras.items.filter(match) } : undefined,
      };
    }).filter((cat) => cat.items.length > 0 || (cat.extras?.items.length ?? 0) > 0);
  }, [group, query, searching]);

  useEffect(() => {
    const sections = visible
      .map((cat) => document.getElementById(`cat-${cat.id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    setActiveId(visible[0].id);
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveId(top.target.id.replace('cat-', ''));
      },
      { rootMargin: '-150px 0px -60% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    const chip = chipsRef.current?.querySelector<HTMLElement>(`[data-chip="${activeId}"]`);
    chip?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  const qtyByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart.lines) map.set(line.itemId, (map.get(line.itemId) ?? 0) + line.quantity);
    return map;
  }, [cart.lines]);

  const totals = useMemo(() => carteTotals(cart.lines), [cart.lines]);

  const quickAdd = useCallback((item: CarteItem) => {
    if (item.choice) {
      setSheetItem(item);
      return;
    }
    dispatch({
      type: 'add',
      line: { key: carteLineKey(item.id, [], ''), itemId: item.id, choices: [], note: '', quantity: 1 },
    });
  }, []);

  const confirmDraft = useCallback(
    (draft: CarteDraft) => {
      if (!sheetItem) return;
      const note = draft.note.trim();
      dispatch({
        type: 'add',
        line: {
          key: carteLineKey(sheetItem.id, draft.choices, note),
          itemId: sheetItem.id,
          choices: draft.choices,
          note,
          quantity: draft.quantity,
        },
      });
      setSheetItem(null);
    },
    [sheetItem],
  );

  const switchGroup = (next: CarteGroup) => {
    setGroup(next);
    setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const jumpTo = (id: string) => {
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const titleOf = (cat: CarteCategory) => (locale === 'fr' ? cat.title.fr : cat.title.en);

  if (showing) {
    return (
      <CarteShowScreen
        lines={cart.lines}
        table={cart.table}
        onBack={() => setShowing(false)}
        onDone={() => {
          dispatch({ type: 'clear' });
          setShowing(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FBF6EC] text-[#3A2A19]">
      <header className="relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_-10%,#FFFDF7_0%,#FBF4E6_50%,#F3E6CF_100%)] px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] text-center">
        <div className="pointer-events-none absolute inset-3 rounded-[1.75rem] border border-[#A87C36]/40" />
        <div className="relative flex justify-end">
          <LanguageSwitcher compact />
        </div>
        <img src="/menu/logo.png" alt="Mamma Mia Beach Club" className="relative mx-auto -mt-3 w-56 max-w-[70%]" />
        <div className="relative mt-1 flex items-center justify-center gap-3">
          {GROUP_PHOTOS[group].map((src) => (
            <span key={src} className="rounded-full border border-[#A87C36] bg-[#FFFBF3] p-1">
              <img src={src} alt="" className="size-16 rounded-full object-cover" />
            </span>
          ))}
        </div>
        <p className="relative mt-4 inline-block rounded-full border border-[#A87C36] bg-[#A87C36]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#A87C36]">
          {t('carte.tax')}
        </p>
        {cart.table ? (
          <p className="relative mt-3 text-sm font-bold text-[#2A8C95]">
            {t('carte.table', { label: cart.table })}
          </p>
        ) : null}
      </header>

      <div className="sticky top-0 z-30 border-b border-[#A87C36]/25 bg-[#FBF6EC]/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
        <div className="flex gap-2 px-4 pt-3">
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-full border border-[#A87C36]/40 bg-white/70 p-1">
            {(['drinks', 'food'] as const).map((value) => {
              const active = !searching && group === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchGroup(value)}
                  className={`tap h-10 rounded-full text-sm font-bold uppercase tracking-[0.14em] [font-family:var(--font-carte-display)] ${
                    active ? 'bg-[#A87C36] text-white' : 'text-[#A87C36]'
                  }`}
                >
                  {t(value === 'drinks' ? 'carte.drinks' : 'carte.food')}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pt-2.5">
          <label className="flex h-11 items-center gap-2 rounded-full border border-[#A87C36]/30 bg-white px-4">
            <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-[#A87C36]" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('carte.search')}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-[#3A2A19] outline-none placeholder:text-[#7C6A52]/70"
            />
          </label>
        </div>

        <div ref={chipsRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
          {visible.map((cat) => {
            const active = cat.id === activeId;
            return (
              <button
                key={cat.id}
                data-chip={cat.id}
                type="button"
                onClick={() => jumpTo(cat.id)}
                className={`tap h-9 shrink-0 rounded-full px-4 text-sm font-semibold ${
                  active ? 'bg-[#2A8C95] text-white' : 'border border-[#A87C36]/30 bg-white text-[#7C6A52]'
                }`}
              >
                {titleOf(cat)}
              </button>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-4">
        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm italic text-[#7C6A52]">{t('carte.noResult')}</p>
        ) : (
          visible.map((cat) => (
            <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-[190px] pb-6">
              <div className="mb-3 pt-2 text-center">
                {cat.subtitle ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#B08D55]">{cat.subtitle}</p>
                ) : null}
                <h2 className="text-2xl font-bold tracking-[0.12em] text-[#A87C36] [font-family:var(--font-carte-display)]">
                  {titleOf(cat).toUpperCase()}
                </h2>
                <div className="mx-auto mt-2 flex items-center justify-center gap-2">
                  <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#A87C36]" />
                  <span className="size-1.5 rotate-45 bg-[#A87C36]" />
                  <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#A87C36]" />
                </div>
              </div>

              <ul className="space-y-2">
                {cat.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    qty={qtyByItem.get(item.id) ?? 0}
                    onOpen={() => setSheetItem(item)}
                    onQuickAdd={() => quickAdd(item)}
                    addLabel={t('carte.add')}
                  />
                ))}
              </ul>

              {cat.extras && cat.extras.items.length > 0 ? (
                <>
                  <p className="mb-2 mt-4 text-center text-sm font-semibold tracking-[0.14em] text-[#B08D55] [font-family:var(--font-carte-display)]">
                    — {cat.extras.title.toUpperCase()} —
                  </p>
                  <ul className="space-y-2">
                    {cat.extras.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        qty={qtyByItem.get(item.id) ?? 0}
                        onOpen={() => setSheetItem(item)}
                        onQuickAdd={() => quickAdd(item)}
                        addLabel={t('carte.add')}
                      />
                    ))}
                  </ul>
                </>
              ) : null}

              {cat.note ? (
                <p className="mt-3 border-t border-[#A87C36]/25 px-3 pt-2.5 text-center text-sm italic leading-snug text-[#B08D55] [font-family:var(--font-carte-serif)]">
                  {cat.note}
                </p>
              ) : null}
            </section>
          ))
        )}

        <p className="pt-4 text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#A87C36]">
          Mamma Mia · Beach Club
        </p>
      </main>

      {totals.count > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="tap pointer-events-auto mx-auto flex h-16 w-full max-w-2xl items-center justify-between rounded-2xl bg-[#3A2A19] px-5 text-white shadow-[0_10px_30px_rgba(58,42,25,0.35)]"
          >
            <span className="flex items-center gap-3 font-bold">
              <span key={totals.count} className="animate-pop flex size-8 items-center justify-center rounded-full bg-[#A87C36] text-sm">
                {totals.count}
              </span>
              {t(plural(totals.count, 'carte.viewCart', 'carte.viewCartMany'), { n: totals.count })}
            </span>
            <span className="text-lg font-extrabold tabular-nums">{formatAmount(totals.subtotalCents)} EGP</span>
          </button>
        </div>
      ) : null}

      <CarteItemSheet item={sheetItem} onClose={() => setSheetItem(null)} onConfirm={confirmDraft} />

      <CarteCartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cart.lines}
        table={cart.table}
        onTable={(table) => dispatch({ type: 'setTable', table })}
        onIncrement={(key) => dispatch({ type: 'increment', key })}
        onDecrement={(key) => dispatch({ type: 'decrement', key })}
        onClear={() => {
          dispatch({ type: 'clear' });
          setCartOpen(false);
        }}
        onShow={() => {
          setCartOpen(false);
          setShowing(true);
          window.scrollTo({ top: 0 });
        }}
      />
    </div>
  );
}

function ItemRow({
  item,
  qty,
  onOpen,
  onQuickAdd,
  addLabel,
}: {
  item: CarteItem;
  qty: number;
  onOpen: () => void;
  onQuickAdd: () => void;
  addLabel: string;
}) {
  return (
    <li className="flex items-stretch rounded-2xl border border-[#A87C36]/20 bg-white/80">
      <button type="button" onClick={onOpen} className="tap min-w-0 flex-1 px-4 py-3 text-left">
        <span className="flex items-baseline gap-2">
          <span className="text-[19px] font-bold leading-tight text-[#3A2A19] [font-family:var(--font-carte-serif)]">
            {item.name}
          </span>
          <span className="min-w-3 flex-1 translate-y-[-3px] border-b border-dotted border-[#A87C36]/40" />
          <span className="shrink-0 text-[15px] font-semibold tabular-nums tracking-wide text-[#A87C36]">
            {formatAmount(item.price * 100)}
          </span>
        </span>
        {item.desc ? (
          <span className="mt-0.5 block text-[15px] italic leading-snug text-[#7C6A52] [font-family:var(--font-carte-serif)]">
            {item.desc}
          </span>
        ) : null}
        {item.choice ? (
          <span className="mt-1 block text-xs font-semibold text-[#2A8C95]">
            {item.choice.options.join(' · ')}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onQuickAdd}
        aria-label={`${addLabel} ${item.name}`}
        className="tap flex w-16 shrink-0 items-center justify-center border-l border-[#A87C36]/15"
      >
        <span
          key={qty}
          className={`flex size-10 items-center justify-center rounded-full text-lg font-extrabold ${
            qty > 0 ? 'animate-pop bg-[#A87C36] text-white' : 'border border-[#A87C36]/50 text-[#A87C36]'
          }`}
        >
          {qty > 0 ? qty : '+'}
        </span>
      </button>
    </li>
  );
}
