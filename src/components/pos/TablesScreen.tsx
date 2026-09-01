'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { StaffSession } from '@/lib/supabase/server';
import { useTables } from '@/lib/useTables';
import { useDrafts } from '@/lib/drafts';
import { formatAmount } from '@/lib/money';
import { TableCard } from '@/components/pos/TableCard';
import { OutboxBanner } from '@/components/pos/OutboxBanner';
import { SignOutButton } from '@/components/SignOutButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useI18n } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';

export function TablesScreen({ staff }: { staff: StaffSession }) {
  const { t, locale } = useI18n();
  const { tables, loading, error, live, refresh } = useTables();
  const drafts = useDrafts();
  const [zoneId, setZoneId] = useState<string | 'ALL'>('ALL');
  const [menuOpen, setMenuOpen] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const zones = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of tables) if (!seen.has(t.zone_id)) seen.set(t.zone_id, t.zone_name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [tables]);

  const visible = useMemo(
    () => (zoneId === 'ALL' ? tables : tables.filter((row) => row.zone_id === zoneId)),
    [tables, zoneId],
  );

  const stats = useMemo(() => {
    let open = 0;
    let revenue = 0;
    let requested = 0;
    for (const row of tables) {
      if (row.order_id) {
        open += 1;
        revenue += row.order_total_cents ?? 0;
      }
      requested += row.requested_count ?? 0;
    }
    return { open, free: tables.length - open, revenue, requested };
  }, [tables]);

  const roleKey: MessageKey =
    staff.role === 'admin'
      ? 'salle.role.admin'
      : staff.role === 'manager'
        ? 'salle.role.manager'
        : 'salle.role.server';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand font-serif text-sm font-bold text-white">
            MM
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight text-ink">{t('salle.title')}</h1>
            <p className="truncate text-xs text-muted">
              {t('salle.stats', {
                free: stats.free,
                open: stats.open,
                revenue: formatAmount(stats.revenue),
              })}
              {stats.requested > 0 ? t('salle.statsRequested', { n: stats.requested }) : ''}
            </p>
          </div>
          <span
            className={`size-2 shrink-0 rounded-full ${live ? 'bg-free' : 'bg-line'}`}
            title={live ? t('salle.live') : t('salle.offline')}
          />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t('salle.menu')}
            className="tap flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-2 active:bg-canvas"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {zones.length > 1 ? (
          <div className="no-scrollbar snap-x-tabs flex gap-2 overflow-x-auto px-4 pb-3">
            <ZoneChip active={zoneId === 'ALL'} onClick={() => setZoneId('ALL')} label={t('salle.allZones')} />
            {zones.map((z) => (
              <ZoneChip
                key={z.id}
                active={zoneId === z.id}
                onClick={() => setZoneId(z.id)}
                label={z.name}
              />
            ))}
          </div>
        ) : null}
      </header>

      <OutboxBanner />

      <main className="pb-safe flex-1 px-4 py-4">
        {loading && tables.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="h-[7.5rem] animate-pulse rounded-2xl bg-line/50" />
            ))}
          </div>
        ) : error && tables.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-sm font-medium text-alert">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="tap mt-4 h-12 rounded-2xl bg-brand px-6 font-bold text-white"
            >
              {t('salle.retry')}
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-10 text-center text-sm text-muted">
            <p>{t('salle.emptyZone')}</p>
            {staff.role !== 'server' ? (
              <Link href="/admin/tables" className="mt-3 inline-block font-semibold text-brand underline">
                {t('salle.addTables')}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
            {visible.map((table) => (
              <TableCard key={table.id} table={table} draft={drafts.get(table.id)} now={now} locale={locale} />
            ))}
          </div>
        )}

        {loading && tables.length > 0 ? (
          <div className="mt-4 flex justify-center text-muted">
            <Spinner className="size-4" />
          </div>
        ) : null}
      </main>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={staff.fullName} subtitle={t(roleKey)}>
        <div className="space-y-2 p-4">
          <LanguageSwitcher />
          {staff.role !== 'server' ? (
            <>
              <MenuLink href="/admin/menu" label={t('salle.adminMenu')} />
              <MenuLink href="/admin/tables" label={t('salle.adminTables')} />
              <MenuLink href="/admin/staff" label={t('salle.adminStaff')} />
            </>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void refresh();
            }}
            className="tap flex h-14 w-full items-center rounded-2xl border border-line bg-surface px-4 font-semibold text-ink active:bg-canvas"
          >
            {t('salle.refresh')}
          </button>
          <div className="pt-2">
            <SignOutButton className="tap h-14 w-full rounded-2xl border border-alert/25 bg-alert-soft font-bold text-alert active:bg-alert/10" />
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function ZoneChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap h-10 shrink-0 rounded-full px-4 text-sm font-bold ${
        active ? 'bg-ink text-white' : 'border border-line bg-surface text-ink-2'
      }`}
    >
      {label}
    </button>
  );
}

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="tap flex h-14 items-center justify-between rounded-2xl border border-line bg-surface px-4 font-semibold text-ink active:bg-canvas"
    >
      <span>{label}</span>
      <svg viewBox="0 0 24 24" className="size-5 text-muted rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
