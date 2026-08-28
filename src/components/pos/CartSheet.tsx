'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { formatAmount } from '@/lib/money';
import { formatElapsed } from '@/lib/time';
import { cartItemCount, cartTotalCents, type CartAction, type CartLine } from '@/lib/cart';
import type { OrderItemRow, OrderRow, StaffRole } from '@/lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  tableLabel: string;

  lines: CartLine[];
  note: string;
  dispatch: (action: CartAction) => void;
  onEditLine: (line: CartLine) => void;

  order: OrderRow | null;
  sentItems: OrderItemRow[];
  requestedItems: OrderItemRow[];

  role: StaffRole;
  submitting: boolean;
  accepting: boolean;
  onSubmit: () => void;
  onAcceptRequested: () => void;
  onVoidItem: (itemId: string) => void;
  onMarkPaid: () => void;
  onReleaseTable: () => void;
};

export function CartSheet({
  open,
  onClose,
  tableLabel,
  lines,
  note,
  dispatch,
  onEditLine,
  order,
  sentItems,
  requestedItems,
  role,
  submitting,
  accepting,
  onSubmit,
  onAcceptRequested,
  onVoidItem,
  onMarkPaid,
  onReleaseTable,
}: Props) {
  const [tab, setTab] = useState<'cart' | 'requested' | 'sent'>('cart');

  const draftTotal = useMemo(() => cartTotalCents(lines), [lines]);
  const draftCount = useMemo(() => cartItemCount(lines), [lines]);
  const sentCount = useMemo(() => sentItems.reduce((sum, i) => sum + i.quantity, 0), [sentItems]);
  const requestedCount = useMemo(
    () => requestedItems.reduce((sum, i) => sum + i.quantity, 0),
    [requestedItems],
  );

  useEffect(() => {
    if (!open) return;
    if (requestedItems.length > 0) setTab('requested');
  }, [open, requestedItems.length]);

  useEffect(() => {
    if (tab === 'requested' && requestedItems.length === 0) setTab('sent');
  }, [tab, requestedItems.length]);

  // Une commande deja ouverte : le serveur doit voir le total reel de la table,
  // pas seulement ce qu'il vient de saisir.
  const tableTotal = (order?.total_cents ?? 0) + draftTotal;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Table ${tableLabel}`}
      subtitle={
        order
          ? `Commande #${order.order_number} · ouverte il y a ${formatElapsed(order.created_at)}`
          : 'Nouvelle commande'
      }
      footer={
        tab === 'cart' ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <span className="text-sm font-semibold text-ink-2">
                {order ? 'Total table' : 'Total'}
              </span>
              <span className="text-xl font-extrabold tabular-nums text-ink">
                {formatAmount(tableTotal)} EGP
              </span>
            </div>
            <button
              type="button"
              disabled={lines.length === 0 || submitting}
              onClick={onSubmit}
              className="tap-strong flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-brand text-lg font-extrabold text-white shadow-lg shadow-brand/25 active:bg-brand-dark disabled:bg-line disabled:text-muted disabled:shadow-none"
            >
              {submitting ? <Spinner className="size-5" /> : null}
              {submitting
                ? 'Envoi…'
                : lines.length === 0
                  ? 'Panier vide'
                  : `Envoyer ${draftCount} article${draftCount > 1 ? 's' : ''}`}
            </button>
          </div>
        ) : tab === 'requested' ? (
          <button
            type="button"
            disabled={requestedItems.length === 0 || accepting}
            onClick={onAcceptRequested}
            className="tap-strong flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-brand text-lg font-extrabold text-white shadow-lg shadow-brand/25 active:bg-brand-dark disabled:bg-line disabled:text-muted disabled:shadow-none"
          >
            {accepting ? <Spinner className="size-5" /> : null}
            {accepting
              ? 'Validation…'
              : requestedCount === 0
                ? 'Rien a valider'
                : `Valider et envoyer ${requestedCount} article${requestedCount > 1 ? 's' : ''}`}
          </button>
        ) : order ? (
          <PaymentActions order={order} onMarkPaid={onMarkPaid} onReleaseTable={onReleaseTable} />
        ) : null
      }
    >
      {/* ------------------------------------------------------- onglets --- */}
      <div className="sticky top-0 z-10 flex gap-2 border-b border-line bg-surface px-4 py-2.5">
        <TabButton active={tab === 'cart'} onClick={() => setTab('cart')} label="Panier" count={draftCount} />
        {requestedCount > 0 ? (
          <TabButton
            active={tab === 'requested'}
            onClick={() => setTab('requested')}
            label="Demandee"
            count={requestedCount}
            highlight
          />
        ) : null}
        <TabButton active={tab === 'sent'} onClick={() => setTab('sent')} label="Envoye" count={sentCount} />
      </div>

      {tab === 'cart' ? (
        <div className="p-4">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Panier vide. Tape un produit pour l&apos;ajouter.
            </p>
          ) : (
            <ul className="space-y-2">
              {lines.map((line) => (
                <li
                  key={line.key}
                  className="rounded-2xl border border-line bg-surface p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold leading-tight text-ink">{line.name}</p>
                      {line.optionLabels.length > 0 ? (
                        <p className="mt-0.5 text-xs leading-snug text-muted">
                          {line.optionLabels.join(' · ')}
                        </p>
                      ) : null}
                      {line.note ? (
                        <p className="mt-1 inline-block rounded-lg bg-busy-soft px-2 py-0.5 text-xs font-semibold text-busy">
                          {line.note}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-ink">
                      {formatAmount(line.unitPriceCents * line.quantity)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex h-12 items-center gap-1 rounded-xl border border-line px-1">
                      <QtyButton
                        label="Retirer un"
                        onClick={() => dispatch({ type: 'decrement', key: line.key })}
                      >
                        {line.quantity <= 1 ? (
                          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M6 12h12" strokeLinecap="round" />
                          </svg>
                        )}
                      </QtyButton>
                      <span className="w-8 text-center text-lg font-extrabold tabular-nums text-ink">
                        {line.quantity}
                      </span>
                      <QtyButton
                        label="Ajouter un"
                        onClick={() => dispatch({ type: 'increment', key: line.key })}
                      >
                        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M12 6v12M6 12h12" strokeLinecap="round" />
                        </svg>
                      </QtyButton>
                    </div>

                    <button
                      type="button"
                      onClick={() => onEditLine(line)}
                      className="tap h-12 flex-1 rounded-xl border border-line text-sm font-semibold text-ink-2 active:bg-canvas"
                    >
                      Note
                    </button>

                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'remove', key: line.key })}
                      aria-label={`Supprimer ${line.name}`}
                      className="tap flex size-12 items-center justify-center rounded-xl border border-line text-alert active:bg-alert-soft"
                    >
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <label htmlFor="order-note" className="mb-1.5 block text-sm font-bold text-ink-2">
              Note pour la table
            </label>
            <textarea
              id="order-note"
              rows={2}
              value={note}
              onChange={(e) => dispatch({ type: 'setNote', note: e.target.value.slice(0, 500) })}
              placeholder="Anniversaire, service groupe…"
              className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </div>

          {lines.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Vider le panier ?')) dispatch({ type: 'clear' });
              }}
              className="tap mt-3 h-12 w-full rounded-2xl text-sm font-semibold text-alert active:bg-alert-soft"
            >
              Vider le panier
            </button>
          ) : null}
        </div>
      ) : tab === 'requested' ? (
        <RequestedItems items={requestedItems} onVoidItem={onVoidItem} />
      ) : (
        <SentItems items={sentItems} order={order} role={role} onVoidItem={onVoidItem} />
      )}
    </Sheet>
  );
}

/**
 * Encaisser et liberer sont deux gestes separes.
 *
 * Encaisser marque le paiement mais laisse la table occupee : le client peut
 * toujours recommander. Ce n'est qu'en tapant « Liberer » que la table
 * redevient disponible — et si des articles ont ete ajoutes apres le
 * paiement, il faut d'abord encaisser le complement.
 */
function PaymentActions({
  order,
  onMarkPaid,
  onReleaseTable,
}: {
  order: OrderRow;
  onMarkPaid: () => void;
  onReleaseTable: () => void;
}) {
  const remaining = Math.max(order.total_cents - order.paid_amount_cents, 0);
  const paid = order.paid_at !== null;

  if (!paid) {
    return (
      <button
        type="button"
        onClick={onMarkPaid}
        className="tap-strong flex h-16 w-full items-center justify-between rounded-2xl bg-ink px-5 text-lg font-extrabold text-white"
      >
        <span>Encaisser</span>
        <span className="tabular-nums">{formatAmount(order.total_cents)} EGP</span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-2xl bg-free-soft px-4 py-2.5">
        <span className="text-sm font-bold text-free">
          Encaissee il y a {formatElapsed(order.paid_at!)}
        </span>
        <span className="text-sm font-extrabold tabular-nums text-free">
          {formatAmount(order.paid_amount_cents)}
        </span>
      </div>

      {remaining > 0 ? (
        <button
          type="button"
          onClick={onMarkPaid}
          className="tap-strong flex h-16 w-full items-center justify-between rounded-2xl bg-alert px-5 text-lg font-extrabold text-white"
        >
          <span>Encaisser le complement</span>
          <span className="tabular-nums">{formatAmount(remaining)} EGP</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onReleaseTable}
          className="tap flex h-14 w-full items-center justify-center rounded-2xl border-2 border-ink font-bold text-ink active:bg-canvas"
        >
          Liberer la table
        </button>
      )}
    </div>
  );
}

function RequestedItems({
  items,
  onVoidItem,
}: {
  items: OrderItemRow[];
  onVoidItem: (itemId: string) => void;
}) {
  const batches = useMemo(() => {
    const map = new Map<string, OrderItemRow[]>();
    for (const item of items) {
      const list = map.get(item.batch_id);
      if (list) list.push(item);
      else map.set(item.batch_id, [item]);
    }
    return [...map.values()].reverse();
  }, [items]);

  if (items.length === 0) {
    return (
      <p className="p-6 py-10 text-center text-sm text-muted">
        Aucune commande client en attente.
      </p>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm font-semibold leading-snug text-brand">
        Le client a demande ces articles. Verifie, retire ce qui ne va pas, puis
        valide pour envoyer en cuisine.
      </p>

      {batches.map((batch) => (
        <section key={batch[0].batch_id}>
          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-brand">
            Demandee il y a {formatElapsed(batch[0].created_at)}
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-brand/25 bg-surface">
            {batch.map((item) => (
              <li key={item.id} className="flex items-start gap-3 p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-extrabold tabular-nums text-brand">
                  {item.quantity}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-tight text-ink">{item.name_snapshot}</p>
                  {item.options_snapshot.length > 0 ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {item.options_snapshot.map((o) => o.name).join(' · ')}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-1 inline-block rounded-lg bg-busy-soft px-2 py-0.5 text-xs font-semibold text-busy">
                      {item.note}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[15px] font-bold tabular-nums text-ink">
                  {formatAmount(item.line_total_cents)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Retirer ${item.quantity} x ${item.name_snapshot} ?`)) {
                      onVoidItem(item.id);
                    }
                  }}
                  aria-label="Retirer cette ligne"
                  className="tap -my-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-alert active:bg-alert-soft"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SentItems({
  items,
  order,
  role,
  onVoidItem,
}: {
  items: OrderItemRow[];
  order: OrderRow | null;
  role: StaffRole;
  onVoidItem: (itemId: string) => void;
}) {
  // Un envoi = un batch = un bon de cuisine. Les regrouper permet au serveur
  // de savoir ce qui est parti quand.
  const batches = useMemo(() => {
    const map = new Map<string, OrderItemRow[]>();
    for (const item of items) {
      const list = map.get(item.batch_id);
      if (list) list.push(item);
      else map.set(item.batch_id, [item]);
    }
    return [...map.values()].reverse();
  }, [items]);

  const canVoid = role === 'manager' || role === 'admin';

  if (!order || items.length === 0) {
    return <p className="p-6 py-10 text-center text-sm text-muted">Rien n&apos;a encore ete envoye.</p>;
  }

  return (
    <div className="space-y-4 p-4">
      {batches.map((batch) => (
        <section key={batch[0].batch_id}>
          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            Envoye il y a {formatElapsed(batch[0].sent_at ?? batch[0].created_at)}
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {batch.map((item) => (
              <li key={item.id} className="flex items-start gap-3 p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-canvas text-sm font-extrabold tabular-nums text-ink">
                  {item.quantity}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-tight text-ink">{item.name_snapshot}</p>
                  {item.options_snapshot.length > 0 ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {item.options_snapshot.map((o) => o.name).join(' · ')}
                    </p>
                  ) : null}
                  {item.from_guest ? (
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-brand">
                      Client
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-1 inline-block rounded-lg bg-busy-soft px-2 py-0.5 text-xs font-semibold text-busy">
                      {item.note}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[15px] font-bold tabular-nums text-ink">
                  {formatAmount(item.line_total_cents)}
                </span>
                {canVoid ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Annuler ${item.quantity} x ${item.name_snapshot} ?`)) {
                        onVoidItem(item.id);
                      }
                    }}
                    aria-label="Annuler cette ligne"
                    className="tap -my-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-alert active:bg-alert-soft"
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <dl className="rounded-2xl border border-line bg-surface p-4 text-sm">
        <Row label="Sous-total" value={formatAmount(order.subtotal_cents)} />
        {order.discount_cents > 0 ? (
          <Row label="Remise" value={`-${formatAmount(order.discount_cents)}`} />
        ) : null}
        <div className="mt-2 border-t border-line pt-2">
          <Row label="Total" value={`${formatAmount(order.total_cents)} EGP`} strong />
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <dt className={strong ? 'font-bold text-ink' : 'text-muted'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'text-lg font-extrabold text-ink' : 'font-semibold text-ink-2'}`}>
        {value}
      </dd>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap h-11 flex-1 rounded-xl text-sm font-bold ${
        active
          ? highlight
            ? 'bg-brand text-white'
            : 'bg-ink text-white'
          : highlight
            ? 'bg-brand-soft text-brand'
            : 'bg-canvas text-ink-2'
      }`}
    >
      {label}
      {count > 0 ? <span className="ml-1.5 tabular-nums opacity-80">{count}</span> : null}
    </button>
  );
}

function QtyButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="tap flex size-11 items-center justify-center rounded-lg text-ink active:bg-canvas"
    >
      {children}
    </button>
  );
}
