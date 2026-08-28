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
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';

export function TablesScreen({ staff }: { staff: StaffSession }) {
  const { tables, loading, error, live, refresh } = useTables();
  const drafts = useDrafts();
  const [zoneId, setZoneId] = useState<string | 'ALL'>('ALL');
  const [menuOpen, setMenuOpen] = useState(false);

  // Une horloge partagee a la minute : les cartes affichent un temps ecoule
  // sans que chacune ne pose son propre timer.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Les zones viennent des tables elles-memes : ajouter une zone dans
  // l'administration la fait apparaitre ici sans toucher au code.
  const zones = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of tables) if (!seen.has(t.zone_id)) seen.set(t.zone_id, t.zone_name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [tables]);

  const visible = useMemo(
    () => (zoneId === 'ALL' ? tables : tables.filter((t) => t.zone_id === zoneId)),
    [tables, zoneId],
  );

  const stats = useMemo(() => {
    let open = 0;
    let revenue = 0;
    for (const t of tables) {
      if (t.order_id) {
        open += 1;
        revenue += t.order_total_cents ?? 0;
      }
    }
    return { open, free: tables.length - open, revenue };
  }, [tables]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      {/* -------------------------------------------------- en-tete ------- */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand font-serif text-sm font-bold text-white">
            MM
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight text-ink">Salle</h1>
            <p className="truncate text-xs text-muted">
              {stats.free} libres · {stats.open} en cours · {formatAmount(stats.revenue)} EGP
            </p>
          </div>
          <span
            className={`size-2 shrink-0 rounded-full ${live ? 'bg-free' : 'bg-line'}`}
            title={live ? 'Temps reel actif' : 'Temps reel indisponible'}
          />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Menu"
            className="tap flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-2 active:bg-canvas"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {zones.length > 1 ? (
          <div className="no-scrollbar snap-x-tabs flex gap-2 overflow-x-auto px-4 pb-3">
            <ZoneChip active={zoneId === 'ALL'} onClick={() => setZoneId('ALL')} label="Toutes" />
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

      {/* -------------------------------------------------- grille -------- */}
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
              Reessayer
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-10 text-center text-sm text-muted">
            <p>Aucune table dans cette zone.</p>
            {staff.role !== 'server' ? (
              <Link href="/admin/tables" className="mt-3 inline-block font-semibold text-brand underline">
                Ajouter des tables
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
            {visible.map((table) => (
              <TableCard key={table.id} table={table} draft={drafts.get(table.id)} now={now} />
            ))}
          </div>
        )}

        {loading && tables.length > 0 ? (
          <div className="mt-4 flex justify-center text-muted">
            <Spinner className="size-4" />
          </div>
        ) : null}
      </main>

      {/* -------------------------------------------------- menu ---------- */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={staff.fullName} subtitle={roleLabel(staff.role)}>
        <div className="space-y-2 p-4">
          {staff.role !== 'server' ? (
            <>
              <MenuLink href="/admin/menu" label="Menu et produits" />
              <MenuLink href="/admin/tables" label="Tables" />
              <MenuLink href="/admin/staff" label="Equipe" />
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
            Rafraichir la salle
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
      <svg viewBox="0 0 24 24" className="size-5 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

function roleLabel(role: StaffSession['role']): string {
  if (role === 'admin') return 'Administrateur';
  if (role === 'manager') return 'Manager';
  return 'Serveur';
}
