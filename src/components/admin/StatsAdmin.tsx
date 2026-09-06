'use client';

import { useCallback, useEffect, useState } from 'react';
import { ErrorNote, GhostButton } from '@/components/admin/ui';
import { Spinner } from '@/components/ui/Spinner';
import { describeDbError } from '@/lib/adminErrors';
import { useI18n } from '@/lib/i18n';
import { translateMenuName } from '@/lib/menuI18n';
import { formatAmount } from '@/lib/money';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { plural, type Locale } from '@/lib/messages';
import type { OwnerStats } from '@/lib/types';

export function StatsAdmin() {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [tab, setTab] = useState<'salle' | 'staff'>('salle');

  const reload = useCallback(async () => {
    setError(null);
    const { data, error: rpcError } = await getSupabaseBrowser().rpc('pos_owner_stats');
    if (rpcError) {
      setError(describeDbError(rpcError));
      setStats(null);
    } else {
      const next = data as OwnerStats;
      setStats({
        ...next,
        zones: next.zones ?? [],
        tables: next.tables ?? [],
        categories: next.categories ?? [],
        staff: next.staff ?? [],
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function resetDayTotal() {
    if (resetting) return;
    if (!window.confirm(t('stats.resetConfirm'))) return;
    setResetting(true);
    const { error: rpcError } = await getSupabaseBrowser().rpc('pos_reset_day_stats');
    if (rpcError) {
      setError(describeDbError(rpcError));
      setResetting(false);
      return;
    }
    await reload();
    setResetting(false);
  }

  if (loading && !stats) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-7 text-brand" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorNote message={error} />
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void reload();
          }}
          className="tap h-12 rounded-2xl bg-brand px-6 font-bold text-white"
        >
          {t('order.retry')}
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const day = new Date(stats.from).toLocaleDateString(locale === 'ar' ? 'ar' : locale === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="rounded-3xl bg-ink px-5 py-6 text-white">
        <p className="text-xs font-bold uppercase tracking-wide text-white/60">{t('stats.today')}</p>
        <p className="mt-1 text-sm capitalize text-white/70">{day}</p>
        <p className="mt-4 text-4xl font-extrabold tabular-nums tracking-tight">
          {formatAmount(stats.total_cents)}
          <span className="ms-2 text-lg font-bold text-white/70">EGP</span>
        </p>
        <p className="mt-2 text-sm text-white/70">
          {t(plural(stats.order_count, 'stats.orders', 'stats.orders_other'), { n: stats.order_count })}
          {' · '}
          {t(plural(stats.item_count, 'stats.items', 'stats.items_other'), { n: stats.item_count })}
        </p>
      </div>

      <GhostButton
        type="button"
        disabled={resetting}
        className="gap-2"
        onClick={() => void resetDayTotal()}
      >
        {resetting ? <Spinner className="size-5" /> : null}
        {t('stats.reset')}
      </GhostButton>

      <div className="grid grid-cols-2 gap-2">
        <TabButton active={tab === 'salle'} onClick={() => setTab('salle')} label={t('stats.tabSalle')} />
        <TabButton active={tab === 'staff'} onClick={() => setTab('staff')} label={t('stats.tabStaff')} />
      </div>

      {tab === 'salle' ? (
        <>
          <section>
            <h2 className="mb-2 text-sm font-extrabold text-ink">{t('stats.byZone')}</h2>
            <Breakdown rows={stats.zones} total={stats.total_cents} locale={locale} empty={t('stats.empty')} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-extrabold text-ink">{t('stats.byCategory')}</h2>
            <Breakdown
              rows={stats.categories}
              total={stats.total_cents}
              locale={locale}
              empty={t('stats.empty')}
              translate
            />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-extrabold text-ink">{t('stats.byTable')}</h2>
            <Breakdown rows={stats.tables} total={stats.total_cents} locale={locale} empty={t('stats.empty')} />
          </section>
        </>
      ) : (
        <section>
          <h2 className="mb-1 text-sm font-extrabold text-ink">{t('stats.byStaff')}</h2>
          <p className="mb-2 text-xs leading-relaxed text-muted">{t('stats.staffHint')}</p>
          <Breakdown
            rows={stats.staff.map((row) => ({
              ...row,
              name: row.name === '__guest__' ? t('stats.guest') : row.name,
            }))}
            total={stats.total_cents}
            locale={locale}
            empty={t('stats.empty')}
          />
        </section>
      )}
    </div>
  );
}

function Breakdown({
  rows,
  total,
  locale,
  empty,
  translate = false,
}: {
  rows: { name?: string; label?: string; total_cents: number; item_count: number }[];
  total: number;
  locale: Locale;
  empty: string;
  translate?: boolean;
}) {
  const { t } = useI18n();
  if (rows.length === 0) {
    return <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">{empty}</p>;
  }

  const max = Math.max(...rows.map((r) => r.total_cents), 1);

  return (
    <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
      {rows.map((row) => {
        const raw = row.name ?? row.label ?? '';
        const name = translate ? translateMenuName(raw, locale) : raw;
        const pct = total > 0 ? Math.round((row.total_cents / total) * 100) : 0;
        const width = Math.max(4, Math.round((row.total_cents / max) * 100));
        return (
          <li key={raw} className="border-b border-line px-4 py-3 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-bold text-ink">{name}</span>
              <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-ink">
                {formatAmount(row.total_cents)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">
              {pct}% · {t('table.art', { n: row.item_count })}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap h-12 rounded-2xl text-sm font-bold ${
        active ? 'bg-ink text-white' : 'border border-line bg-surface text-ink-2'
      }`}
    >
      {label}
    </button>
  );
}
