'use client';

import { memo } from 'react';
import Link from 'next/link';
import { formatAmount } from '@/lib/money';
import { formatElapsed } from '@/lib/time';
import type { TableOverviewRow } from '@/lib/types';
import type { DraftSummary } from '@/lib/drafts';

/** Au-dela, la table est signalee : elle occupe la salle depuis longtemps. */
const LONG_STAY_MINUTES = 90;

export type TableState = 'free' | 'active' | 'long' | 'paid' | 'reopened' | 'requested';

const STATE_STYLES: Record<TableState, { card: string; dot: string; label: string; text: string }> = {
  free: {
    card: 'border-line bg-surface',
    dot: 'bg-free',
    label: 'LIBRE',
    text: 'text-free',
  },
  active: {
    card: 'border-busy/35 bg-busy-soft',
    dot: 'bg-busy',
    label: 'EN COURS',
    text: 'text-busy',
  },
  long: {
    card: 'border-alert/35 bg-alert-soft',
    dot: 'bg-alert',
    label: 'OCCUPEE',
    text: 'text-alert',
  },
  // Encaissee mais TOUJOURS occupee : la table n'est liberee que sur demande.
  paid: {
    card: 'border-free/40 bg-free-soft',
    dot: 'bg-free',
    label: 'ENCAISSEE',
    text: 'text-free',
  },
  reopened: {
    card: 'border-alert/40 bg-alert-soft',
    dot: 'bg-alert',
    label: 'RESTE A PAYER',
    text: 'text-alert',
  },
  requested: {
    card: 'border-brand/40 bg-brand-soft',
    dot: 'bg-brand',
    label: 'DEMANDE',
    text: 'text-brand',
  },
};

type Props = {
  table: TableOverviewRow;
  draft?: DraftSummary;
  /** Passe par le parent pour que toutes les cartes partagent le meme instant. */
  now: number;
};

export function tableState(table: TableOverviewRow, now: number): TableState {
  if (table.order_id === null) return 'free';
  if ((table.requested_count ?? 0) > 0) return 'requested';

  const remaining = table.order_remaining_cents ?? 0;
  if (table.order_paid_at) return remaining > 0 ? 'reopened' : 'paid';

  const openedAt = table.order_opened_at ? new Date(table.order_opened_at).getTime() : now;
  const minutes = Math.floor((now - openedAt) / 60000);
  return minutes >= LONG_STAY_MINUTES ? 'long' : 'active';
}

function TableCardBase({ table, draft, now }: Props) {
  const hasOrder = table.order_id !== null;
  const state = tableState(table, now);
  const style = STATE_STYLES[state];
  const remaining = table.order_remaining_cents ?? 0;

  return (
    <Link
      href={`/table/${table.id}`}
      prefetch={false}
      className={`tap relative flex min-h-[7.5rem] flex-col justify-between rounded-2xl border p-3 shadow-sm ${style.card}`}
    >
      {draft ? (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-bold text-white shadow"
          title="Panier non envoye sur ce telephone"
        >
          {draft.itemCount}
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl font-extrabold leading-none tracking-tight text-ink">
          {table.label}
        </span>
        <span className={`mt-1 size-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
      </div>

      <div className="mt-2">
        <span className={`block text-[11px] font-bold uppercase tracking-wide ${style.text}`}>
          {state === 'requested' ? 'DEMANDE' : draft ? 'BROUILLON' : style.label}
        </span>

        {hasOrder ? (
          <>
            <span className="mt-0.5 block text-[15px] font-bold text-ink">
              {state === 'reopened'
                ? formatAmount(remaining)
                : formatAmount(table.order_total_cents ?? 0)}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-muted">
              {state === 'requested'
                ? `${table.requested_count} a valider`
                : `${table.item_count} art.`}{' '}
              · {formatElapsed(table.order_opened_at ?? now, now)}
            </span>
          </>
        ) : (
          <span className="mt-0.5 block text-[11px] text-muted">{table.seats} places</span>
        )}
      </div>
    </Link>
  );
}

/**
 * memo : sur une grille de 60 tables, un tick d'horloge ou un evenement
 * Realtime ne doit re-rendre que les cartes reellement modifiees.
 */
export const TableCard = memo(TableCardBase, (prev, next) => {
  const a = prev.table;
  const b = next.table;
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.order_id === b.order_id &&
    a.order_total_cents === b.order_total_cents &&
    a.order_paid_at === b.order_paid_at &&
    a.order_remaining_cents === b.order_remaining_cents &&
    a.item_count === b.item_count &&
    a.requested_count === b.requested_count &&
    a.order_opened_at === b.order_opened_at &&
    prev.draft?.itemCount === next.draft?.itemCount &&
    // L'affichage ne change qu'a la minute : inutile de re-rendre plus souvent.
    Math.floor(prev.now / 60000) === Math.floor(next.now / 60000)
  );
});
