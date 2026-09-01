'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import {
  EmptyState,
  ErrorNote,
  Field,
  GhostButton,
  PrimaryButton,
  Toggle,
  inputClass,
} from '@/components/admin/ui';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { describeDbError } from '@/lib/adminErrors';
import { guestOrderUrl, guestQrImageUrl } from '@/lib/guest';
import { useI18n } from '@/lib/i18n';
import { compareTableLabels, formatTableLabel } from '@/lib/tableSort';
import type { RestaurantTableRow, ZoneRow } from '@/lib/types';

const ZONE_COLORS = ['#C8102E', '#EA580C', '#F59E0B', '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#0B0D12'];

type Tab = 'tables' | 'zones';

export function TablesAdmin() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('tables');
  const [tables, setTables] = useState<RestaurantTableRow[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const supabase = getSupabaseBrowser();
    const [tablesRes, zonesRes] = await Promise.all([
      supabase.from('restaurant_tables').select('*').order('sort_order'),
      supabase.from('zones').select('*').order('sort_order'),
    ]);
    if (tablesRes.error || zonesRes.error) {
      setError(describeDbError(tablesRes.error ?? zonesRes.error));
    } else {
      setTables(tablesRes.data ?? []);
      setZones(zonesRes.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <TabButton active={tab === 'tables'} onClick={() => setTab('tables')} label={t('admin.tables')} />
        <TabButton active={tab === 'zones'} onClick={() => setTab('zones')} label={t('admin.zones')} />
      </div>

      <ErrorNote message={error} />

      {loading ? (
        <div className="flex justify-center py-12 text-muted">
          <Spinner className="size-6" />
        </div>
      ) : tab === 'tables' ? (
        <TablesTab tables={tables} zones={zones} reload={reload} onError={setError} />
      ) : (
        <ZonesTab zones={zones} tables={tables} reload={reload} onError={setError} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ tables --
function TablesTab({
  tables,
  zones,
  reload,
  onError,
}: {
  tables: RestaurantTableRow[];
  zones: ZoneRow[];
  reload: () => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<RestaurantTableRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [qrTable, setQrTable] = useState<RestaurantTableRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const nextSortOrder = useMemo(
    () => tables.reduce((max, t) => Math.max(max, t.sort_order), 0) + 1,
    [tables],
  );
  const existingLabels = useMemo(() => new Set(tables.map((t) => t.label)), [tables]);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const orderedTables = useMemo(
    () =>
      [...tables].sort((a, b) => {
        const za = zoneById.get(a.zone_id)?.sort_order ?? 0;
        const zb = zoneById.get(b.zone_id)?.sort_order ?? 0;
        if (za !== zb) return za - zb;
        return compareTableLabels(a.label, b.label);
      }),
    [tables, zoneById],
  );

  async function setActive(table: RestaurantTableRow, active: boolean) {
    setBusyId(table.id);
    onError(null);
    const { error } = await getSupabaseBrowser()
      .from('restaurant_tables')
      .update({ active })
      .eq('id', table.id);
    setBusyId(null);
    if (error) onError(describeDbError(error));
    else reload();
  }

  async function remove(table: RestaurantTableRow) {
    if (!window.confirm(`Supprimer definitivement la table ${table.label} ?`)) return;
    setBusyId(table.id);
    onError(null);
    const { error } = await getSupabaseBrowser().rpc('pos_delete_table', { p_table_id: table.id });
    setBusyId(null);
    if (error) onError(describeDbError(error));
    else reload();
  }

  return (
    <div className="space-y-3">
      <Link
        href="/admin/tables/qr"
        className="tap flex h-14 w-full items-center justify-center rounded-2xl bg-brand px-5 font-bold text-white shadow-lg shadow-brand/25 active:bg-brand-dark"
      >
        {t('admin.qrCodes')}
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <PrimaryButton
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
          disabled={zones.length === 0}
        >
          {t('admin.addTable')}
        </PrimaryButton>
        <GhostButton type="button" onClick={() => setBulkOpen(true)} disabled={zones.length === 0}>
          {t('admin.bulk')}
        </GhostButton>
      </div>

      {zones.length === 0 ? (
        <EmptyState text={t('admin.needZone')} />
      ) : tables.length === 0 ? (
        <EmptyState text={t('admin.noTable')} />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
          {orderedTables.map((table) => {
            const zone = zoneById.get(table.zone_id);
            return (
              <li key={table.id} className="border-b border-line p-3 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-white"
                    style={{ backgroundColor: zone?.color ?? '#0B0D12' }}
                  >
                    {table.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold leading-tight text-ink">
                      {zone?.name ?? '—'}
                    </p>
                    <p className="text-xs text-muted">{t('table.seats', { n: table.seats })}</p>
                  </div>
                  {busyId === table.id ? <Spinner className="size-5 text-muted" /> : null}
                  <Toggle
                    checked={table.active}
                    onChange={(next) => void setActive(table, next)}
                    label={`Activer la table ${table.label}`}
                    disabled={busyId === table.id}
                  />
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setQrTable(table)}
                    className="tap flex h-12 items-center justify-center rounded-xl bg-brand-soft text-sm font-bold text-brand"
                  >
                    QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(table);
                      setSheetOpen(true);
                    }}
                    className="tap flex h-12 items-center justify-center rounded-xl border border-line text-sm font-semibold text-ink-2"
                  >
                    {t('admin.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(table)}
                    className="tap flex h-12 items-center justify-center rounded-xl border border-line text-sm font-semibold text-alert"
                  >
                    {t('admin.delete')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-1 text-xs leading-relaxed text-muted">
        Desactiver une table la retire de la salle en gardant son historique. La supprimer
        n&apos;est possible que si aucune commande n&apos;y a jamais ete prise.
      </p>

      <TableSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={reload}
        table={editing}
        zones={zones}
        nextSortOrder={nextSortOrder}
      />

      <BulkSheet
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSaved={reload}
        zones={zones}
        existingLabels={existingLabels}
        nextSortOrder={nextSortOrder}
      />

      <QrSheet table={qrTable} onClose={() => setQrTable(null)} />
    </div>
  );
}

function TableSheet({
  open,
  onClose,
  onSaved,
  table,
  zones,
  nextSortOrder,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  table: RestaurantTableRow | null;
  zones: ZoneRow[];
  nextSortOrder: number;
}) {
  const [label, setLabel] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [seats, setSeats] = useState('4');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLabel(table?.label ?? '');
    setZoneId(table?.zone_id ?? zones[0]?.id ?? '');
    setSeats(String(table?.seats ?? 4));
  }, [open, table, zones]);

  async function save() {
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Le numero de table est obligatoire.');
      return;
    }
    const seatCount = Number.parseInt(seats, 10);
    if (!Number.isFinite(seatCount) || seatCount < 1) {
      setError('Nombre de places invalide.');
      return;
    }
    if (!zoneId) {
      setError('Choisis une zone.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error: saveError } = table
        ? await supabase
            .from('restaurant_tables')
            .update({ label: trimmed, zone_id: zoneId, seats: seatCount })
            .eq('id', table.id)
        : await supabase.from('restaurant_tables').insert({
            label: trimmed,
            zone_id: zoneId,
            seats: seatCount,
            sort_order: nextSortOrder,
            active: true,
          });
      if (saveError) {
        throw new Error(
          saveError.code === '23505'
            ? `La table « ${trimmed} » existe deja.`
            : describeDbError(saveError),
        );
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={table ? `Table ${table.label}` : 'Nouvelle table'}
      footer={
        <PrimaryButton onClick={save} pending={pending} className="w-full">
          Enregistrer
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <ErrorNote message={error} />

        <Field label="Numero / nom" hint="Ce que le serveur voit sur la carte : 12, B4, VIP 1…">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </Field>

        <ZonePicker zones={zones} value={zoneId} onChange={setZoneId} />

        <Field label="Places">
          <input
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </Field>
      </div>
    </Sheet>
  );
}

/** Ouvrir une salle de 40 tables une par une n'est pas raisonnable. */
function BulkSheet({
  open,
  onClose,
  onSaved,
  zones,
  existingLabels,
  nextSortOrder,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  zones: ZoneRow[];
  existingLabels: Set<string>;
  nextSortOrder: number;
}) {
  const [prefix, setPrefix] = useState('');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('10');
  const [zoneId, setZoneId] = useState('');
  const [seats, setSeats] = useState('4');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setZoneId(zones[0]?.id ?? '');
  }, [open, zones]);

  const preview = useMemo(() => {
    const start = Number.parseInt(from, 10);
    const end = Number.parseInt(to, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    const labels: string[] = [];
    for (let i = start; i <= Math.min(end, start + 199); i += 1) {
      labels.push(formatTableLabel(prefix, i));
    }
    return labels;
  }, [prefix, from, to]);

  const toCreate = useMemo(() => preview.filter((l) => !existingLabels.has(l)), [preview, existingLabels]);

  async function create() {
    if (toCreate.length === 0) {
      setError('Rien a creer : ces tables existent deja.');
      return;
    }
    const seatCount = Number.parseInt(seats, 10);
    if (!Number.isFinite(seatCount) || seatCount < 1) {
      setError('Nombre de places invalide.');
      return;
    }
    if (!zoneId) {
      setError('Choisis une zone.');
      return;
    }

    setPending(true);
    setError(null);
    const { error: insertError } = await getSupabaseBrowser()
      .from('restaurant_tables')
      .insert(
        toCreate.map((label, index) => ({
          label,
          zone_id: zoneId,
          seats: seatCount,
          sort_order: nextSortOrder + index,
          active: true,
        })),
      );
    setPending(false);

    if (insertError) setError(describeDbError(insertError));
    else {
      onSaved();
      onClose();
    }
  }

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Creer des tables en serie"
      subtitle={`${toCreate.length} table(s) seront creees`}
      footer={
        <PrimaryButton onClick={create} pending={pending} className="w-full" disabled={toCreate.length === 0}>
          Creer {toCreate.length} table{toCreate.length > 1 ? 's' : ''}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <ErrorNote message={error} />

        <Field label="Prefixe" hint="Laisse vide pour 1, 2, 3… ou mets « BAR » pour BAR-1, BAR-2…">
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="De">
            <input value={from} onChange={(e) => setFrom(e.target.value)} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label="A">
            <input value={to} onChange={(e) => setTo(e.target.value)} inputMode="numeric" className={inputClass} />
          </Field>
        </div>

        <ZonePicker zones={zones} value={zoneId} onChange={setZoneId} />

        <Field label="Places par table">
          <input value={seats} onChange={(e) => setSeats(e.target.value)} inputMode="numeric" className={inputClass} />
        </Field>

        {preview.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.slice(0, 40).map((label) => (
              <span
                key={label}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  existingLabels.has(label) ? 'bg-canvas text-muted line-through' : 'bg-brand-soft text-brand'
                }`}
              >
                {label}
              </span>
            ))}
            {preview.length > 40 ? (
              <span className="px-1 py-1 text-xs text-muted">+{preview.length - 40}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function ZonePicker({
  zones,
  value,
  onChange,
}: {
  zones: ZoneRow[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-bold text-ink-2">Zone</span>
      <div className="grid grid-cols-2 gap-2">
        {zones.map((zone) => (
          <button
            key={zone.id}
            type="button"
            onClick={() => onChange(zone.id)}
            className={`tap flex h-13 items-center gap-2 rounded-2xl border px-3 font-bold ${
              value === zone.id
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-line bg-surface text-ink-2'
            }`}
          >
            <span
              className="size-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: zone.color }}
              aria-hidden="true"
            />
            <span className="truncate">{zone.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- zones --
function ZonesTab({
  zones,
  tables,
  reload,
  onError,
}: {
  zones: ZoneRow[];
  tables: RestaurantTableRow[];
  reload: () => void;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState<ZoneRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const nextSortOrder = useMemo(
    () => zones.reduce((max, z) => Math.max(max, z.sort_order), 0) + 1,
    [zones],
  );

  async function remove(zone: ZoneRow) {
    if (!window.confirm(`Supprimer la zone « ${zone.name} » ?`)) return;
    setBusyId(zone.id);
    onError(null);
    const { error } = await getSupabaseBrowser().rpc('pos_delete_zone', { p_zone_id: zone.id });
    setBusyId(null);
    if (error) onError(describeDbError(error));
    else reload();
  }

  return (
    <div className="space-y-3">
      <PrimaryButton
        onClick={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
        className="w-full"
      >
        + Ajouter une zone
      </PrimaryButton>

      {zones.length === 0 ? (
        <EmptyState text="Aucune zone." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {zones.map((zone) => {
            const count = tables.filter((t) => t.zone_id === zone.id).length;
            return (
              <li key={zone.id} className="flex items-center gap-3 p-3">
                <span
                  className="size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: zone.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold leading-tight text-ink">{zone.name}</p>
                  <p className="text-xs text-muted">
                    {count} table{count > 1 ? 's' : ''}
                  </p>
                </div>

                {busyId === zone.id ? <Spinner className="size-5 text-muted" /> : null}

                <IconButton
                  label={`Modifier ${zone.name}`}
                  onClick={() => {
                    setEditing(zone);
                    setSheetOpen(true);
                  }}
                >
                  <path d="M4 20h4l10-10-4-4L4 16v4z" strokeLinejoin="round" />
                </IconButton>
                <IconButton label={`Supprimer ${zone.name}`} tone="alert" onClick={() => void remove(zone)}>
                  <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12" strokeLinecap="round" strokeLinejoin="round" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-1 text-xs leading-relaxed text-muted">
        Une zone ne peut etre supprimee que si plus aucune table ne s&apos;y trouve.
      </p>

      <ZoneSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={reload}
        zone={editing}
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}

function ZoneSheet({
  open,
  onClose,
  onSaved,
  zone,
  nextSortOrder,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  zone: ZoneRow | null;
  nextSortOrder: number;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(ZONE_COLORS[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(zone?.name ?? '');
    setColor(zone?.color ?? ZONE_COLORS[0]);
  }, [open, zone]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Le nom est obligatoire.');
      return;
    }

    setPending(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: saveError } = zone
      ? await supabase.from('zones').update({ name: trimmed, color }).eq('id', zone.id)
      : await supabase
          .from('zones')
          .insert({ name: trimmed, color, sort_order: nextSortOrder, active: true });
    setPending(false);

    if (saveError) {
      setError(
        saveError.code === '23505'
          ? `La zone « ${trimmed} » existe deja.`
          : describeDbError(saveError),
      );
      return;
    }
    onSaved();
    onClose();
  }

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={zone ? zone.name : 'Nouvelle zone'}
      subtitle="Restaurant, Terrasse, Plage, Rooftop…"
      footer={
        <PrimaryButton onClick={save} pending={pending} className="w-full">
          Enregistrer
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <ErrorNote message={error} />

        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>

        <div>
          <span className="mb-2 block text-sm font-bold text-ink-2">Couleur</span>
          <div className="flex flex-wrap gap-2">
            {ZONE_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Couleur ${preset}`}
                onClick={() => setColor(preset)}
                style={{ backgroundColor: preset }}
                className={`tap size-11 rounded-xl ${color === preset ? 'ring-4 ring-ink/25' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ petits --
function QrSheet({ table, onClose }: { table: RestaurantTableRow | null; onClose: () => void }) {
  if (!table) return null;

  const token = table.guest_token;
  const url = token ? guestOrderUrl(token) : '';
  const qr = token ? guestQrImageUrl(url, 320) : '';

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copie ce lien :', url);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`QR · Table ${table.label}`}
      subtitle="Le client scanne et commande tout seul"
      footer={
        token ? (
          <div className="grid grid-cols-2 gap-2">
            <GhostButton type="button" onClick={() => void copyLink()}>
              Copier le lien
            </GhostButton>
            <PrimaryButton type="button" onClick={() => window.print()}>
              Imprimer
            </PrimaryButton>
          </div>
        ) : null
      }
    >
      <div className="space-y-4 p-4 text-center">
        {token ? (
          <>
            <img src={qr} alt={`QR table ${table.label}`} className="mx-auto size-56 rounded-2xl bg-white p-2" />
            <p className="break-all text-xs text-muted">{url}</p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-ink-2">
            Execute d&apos;abord <span className="font-bold">0007_commande_client.sql</span> dans
            Supabase &rsaquo; SQL Editor, puis recharge cette page.
          </p>
        )}
      </div>
    </Sheet>
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

function IconButton({
  children,
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'alert';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`tap flex size-11 shrink-0 items-center justify-center rounded-xl border border-line active:bg-canvas disabled:opacity-30 ${
        tone === 'alert' ? 'text-alert' : 'text-ink-2'
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        {children}
      </svg>
    </button>
  );
}
