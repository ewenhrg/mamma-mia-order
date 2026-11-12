'use client';

import { useMemo } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { carteLineName, carteTotals, findCarteItem, type CarteGroup, type CarteLine } from '@/lib/carte';
import { useI18n } from '@/lib/i18n';
import { formatAmount } from '@/lib/money';

function Totals({ lines, large = false }: { lines: CarteLine[]; large?: boolean }) {
  const { t } = useI18n();
  const totals = carteTotals(lines);
  return (
    <div className={`space-y-1 ${large ? 'text-base' : 'text-sm'}`}>
      <div className="flex justify-between text-[#7C6A52]">
        <span>{t('carte.subtotal')}</span>
        <span className="tabular-nums">{formatAmount(totals.subtotalCents)} EGP</span>
      </div>
      <div className="flex justify-between text-[#7C6A52]">
        <span>{t('carte.taxLine')}</span>
        <span className="tabular-nums">{formatAmount(totals.taxCents)} EGP</span>
      </div>
      <div className={`flex justify-between pt-1 font-extrabold text-[#3A2A19] ${large ? 'text-2xl' : 'text-lg'}`}>
        <span>{t('carte.total')}</span>
        <span className="tabular-nums">{formatAmount(totals.totalCents)} EGP</span>
      </div>
    </div>
  );
}

export function CarteCartSheet({
  open,
  onClose,
  lines,
  table,
  onTable,
  onIncrement,
  onDecrement,
  onClear,
  onShow,
}: {
  open: boolean;
  onClose: () => void;
  lines: CarteLine[];
  table: string;
  onTable: (table: string) => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onClear: () => void;
  onShow: () => void;
}) {
  const { t } = useI18n();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('carte.cartTitle')}
      subtitle={t('carte.cartSubtitle')}
      footer={
        <button
          type="button"
          disabled={lines.length === 0}
          onClick={onShow}
          className="tap flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-[#3A2A19] text-lg font-extrabold text-white disabled:bg-line disabled:text-muted"
        >
          {t('carte.show')}
        </button>
      }
    >
      <div className="space-y-3 p-4">
        {lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{t('carte.cartEmpty')}</p>
        ) : (
          lines.map((line) => {
            const entry = findCarteItem(line.itemId);
            if (!entry) return null;
            return (
              <div key={line.key} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{carteLineName(entry)}</p>
                    {line.choices.length > 0 ? (
                      <p className="mt-0.5 text-xs font-semibold text-[#2A8C95]">{line.choices.join(' · ')}</p>
                    ) : null}
                    {line.note ? <p className="mt-1 text-xs font-semibold text-busy">{line.note}</p> : null}
                    <p className="mt-1 text-xs text-muted">{formatAmount(entry.item.price * 100)} EGP</p>
                  </div>
                  <p className="shrink-0 font-extrabold tabular-nums text-ink">
                    {formatAmount(entry.item.price * 100 * line.quantity)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDecrement(line.key)}
                    aria-label="−"
                    className="tap flex size-11 items-center justify-center rounded-xl border border-line text-xl"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-lg font-extrabold tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onIncrement(line.key)}
                    aria-label="+"
                    className="tap flex size-11 items-center justify-center rounded-xl border border-line text-xl"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })
        )}

        {lines.length > 0 ? (
          <>
            <input
              type="text"
              inputMode="text"
              value={table}
              onChange={(e) => onTable(e.target.value)}
              placeholder={t('carte.tablePh')}
              className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-ink outline-none focus:border-[#A87C36]"
            />
            <div className="rounded-2xl bg-[#FBF6EC] p-4">
              <Totals lines={lines} />
              <p className="mt-2 text-xs italic text-[#7C6A52]">{t('carte.priceNote')}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('carte.clearConfirm'))) onClear();
              }}
              className="tap h-11 w-full rounded-xl text-sm font-semibold text-alert"
            >
              {t('carte.clear')}
            </button>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

export function CarteShowScreen({
  lines,
  table,
  onBack,
  onDone,
}: {
  lines: CarteLine[];
  table: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();

  const grouped = useMemo(() => {
    const groups: Record<CarteGroup, CarteLine[]> = { drinks: [], food: [] };
    for (const line of lines) {
      const entry = findCarteItem(line.itemId);
      if (entry) groups[entry.category.group].push(line);
    }
    return groups;
  }, [lines]);

  return (
    <div className="min-h-[100dvh] bg-[#FBF6EC] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] text-[#3A2A19]">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <img src="/menu/logo.png" alt="Mamma Mia Beach Club" className="mx-auto w-36" />
          <h1 className="mt-2 text-3xl font-bold tracking-[0.12em] text-[#A87C36] [font-family:var(--font-carte-display)]">
            {t('carte.showTitle').toUpperCase()}
          </h1>
          {table ? (
            <p className="mt-2 inline-block rounded-full bg-[#2A8C95] px-5 py-1.5 text-lg font-extrabold text-white">
              {t('carte.table', { label: table })}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-[#7C6A52]">{t('carte.showHint')}</p>
        </div>

        <div className="mt-6 rounded-3xl border border-[#A87C36]/30 bg-white p-5">
          {(['drinks', 'food'] as const).map((group) =>
            grouped[group].length === 0 ? null : (
              <div key={group} className="mb-5 last:mb-0">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-[#B08D55]">
                  {t(group === 'drinks' ? 'carte.drinks' : 'carte.food')}
                </p>
                <ul className="divide-y divide-[#A87C36]/15">
                  {grouped[group].map((line) => {
                    const entry = findCarteItem(line.itemId);
                    if (!entry) return null;
                    return (
                      <li key={line.key} className="flex items-start gap-3 py-3">
                        <span className="w-12 shrink-0 text-2xl font-extrabold tabular-nums text-[#A87C36]">
                          {line.quantity}×
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xl font-bold leading-tight">{carteLineName(entry)}</p>
                          {line.choices.length > 0 ? (
                            <p className="mt-1 text-base font-semibold text-[#2A8C95]">{line.choices.join(' · ')}</p>
                          ) : null}
                          {line.note ? <p className="mt-1 text-base font-semibold text-busy">« {line.note} »</p> : null}
                        </div>
                        <span className="shrink-0 pt-1 text-base font-semibold tabular-nums text-[#7C6A52]">
                          {formatAmount(entry.item.price * 100 * line.quantity)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
          )}

          <div className="mt-4 border-t border-[#A87C36]/30 pt-4">
            <Totals lines={lines} large />
            <p className="mt-2 text-xs italic text-[#7C6A52]">{t('carte.priceNote')}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onBack}
            className="tap h-14 rounded-2xl border-2 border-[#A87C36] font-extrabold text-[#A87C36]"
          >
            {t('carte.back')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('carte.clearConfirm'))) onDone();
            }}
            className="tap h-14 rounded-2xl bg-[#3A2A19] px-2 text-sm font-extrabold text-white"
          >
            {t('carte.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
