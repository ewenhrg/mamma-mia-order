'use client';

import { useMemo, useState } from 'react';
import { CategorySheet } from '@/components/admin/CategorySheet';
import { OptionGroupSheet } from '@/components/admin/OptionGroupSheet';
import { ProductSheet } from '@/components/admin/ProductSheet';
import { EmptyState, ErrorNote, PrimaryButton, Toggle, inputClass } from '@/components/admin/ui';
import { Spinner } from '@/components/ui/Spinner';
import { normalize } from '@/lib/menu';
import { formatAmount } from '@/lib/money';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { describeAdminError } from '@/lib/adminErrors';
import { useAdminMenu } from '@/lib/useAdminMenu';
import type { CategoryRow, OptionGroupRow, ProductRow } from '@/lib/types';

type Tab = 'products' | 'categories' | 'options';

export function MenuAdmin() {
  const { data, loading, error, reload } = useAdminMenu();
  const [tab, setTab] = useState<Tab>('products');
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <TabButton active={tab === 'products'} onClick={() => setTab('products')} label="Produits" />
        <TabButton active={tab === 'categories'} onClick={() => setTab('categories')} label="Categories" />
        <TabButton active={tab === 'options'} onClick={() => setTab('options')} label="Options" />
      </div>

      <ErrorNote message={error ?? actionError} />

      {loading ? (
        <div className="flex justify-center py-12 text-muted">
          <Spinner className="size-6" />
        </div>
      ) : tab === 'products' ? (
        <ProductsTab data={data} reload={reload} onError={setActionError} />
      ) : tab === 'categories' ? (
        <CategoriesTab data={data} reload={reload} onError={setActionError} />
      ) : (
        <OptionsTab data={data} reload={reload} onError={setActionError} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- produits --
function ProductsTab({
  data,
  reload,
  onError,
}: {
  data: ReturnType<typeof useAdminMenu>['data'];
  reload: () => void;
  onError: (message: string | null) => void;
}) {
  const [categoryId, setCategoryId] = useState<string | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const categoryById = useMemo(() => {
    const map = new Map<string, CategoryRow>();
    for (const c of data.categories) map.set(c.id, c);
    return map;
  }, [data.categories]);

  const products = useMemo(() => {
    const q = normalize(query.trim());
    return data.products.filter((p) => {
      // showArchived : on veut les produits inactifs, et eux seuls.
      if (p.active === showArchived) return false;
      if (categoryId !== 'ALL' && p.category_id !== categoryId) return false;
      if (q && !normalize(p.name).includes(q)) return false;
      return true;
    });
  }, [data.products, categoryId, query, showArchived]);

  async function setAvailability(product: ProductRow, available: boolean) {
    setBusyId(product.id);
    onError(null);
    const { error } = await getSupabaseBrowser()
      .from('products')
      .update({ available })
      .eq('id', product.id);
    setBusyId(null);
    if (error) onError(error.message);
    else reload();
  }

  async function remove(product: ProductRow) {
    if (!window.confirm(`Supprimer definitivement « ${product.name} » du menu ?`)) return;
    setBusyId(product.id);
    onError(null);
    // Les commandes deja passees gardent leur copie figee du nom et du prix.
    const { error } = await getSupabaseBrowser().rpc('pos_delete_product', {
      p_product_id: product.id,
    });
    setBusyId(null);
    if (error) onError(describeAdminError(error.message));
    else reload();
  }

  async function setArchived(product: ProductRow, archived: boolean) {
    setBusyId(product.id);
    onError(null);
    const { error } = await getSupabaseBrowser()
      .from('products')
      .update({ active: !archived })
      .eq('id', product.id);
    setBusyId(null);
    if (error) onError(error.message);
    else reload();
  }

  return (
    <div className="space-y-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <Chip active={categoryId === 'ALL'} onClick={() => setCategoryId('ALL')} label="Toutes" />
        {data.categories.map((c) => (
          <Chip
            key={c.id}
            active={categoryId === c.id}
            onClick={() => setCategoryId(c.id)}
            label={c.active ? c.name : `${c.name} (off)`}
          />
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un produit…"
        className={inputClass}
      />

      <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-2.5">
        <span className="text-sm font-bold text-ink-2">Afficher les archives</span>
        <Toggle checked={showArchived} onChange={setShowArchived} label="Afficher les archives" />
      </div>

      <PrimaryButton
        onClick={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
        className="w-full"
        disabled={data.categories.length === 0}
      >
        + Ajouter un produit
      </PrimaryButton>

      {data.categories.length === 0 ? (
        <EmptyState text="Cree d'abord une categorie." />
      ) : products.length === 0 ? (
        <EmptyState text={showArchived ? 'Aucun produit archive.' : 'Aucun produit.'} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {products.map((product) => (
            <li key={product.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold leading-tight text-ink">{product.name}</p>
                <p className="truncate text-xs text-muted">
                  {categoryById.get(product.category_id)?.name ?? '—'} ·{' '}
                  <span className="font-bold text-brand">{formatAmount(product.price_cents)} EGP</span>
                </p>
              </div>

              {busyId === product.id ? (
                <Spinner className="size-5 text-muted" />
              ) : product.active ? (
                <Toggle
                  checked={product.available}
                  onChange={(next) => void setAvailability(product, next)}
                  label={`Disponibilite de ${product.name}`}
                />
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setEditing(product);
                  setSheetOpen(true);
                }}
                aria-label={`Modifier ${product.name}`}
                className="tap flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-2 active:bg-canvas"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 20h4l10-10-4-4L4 16v4z" strokeLinejoin="round" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => void remove(product)}
                aria-label={`Supprimer ${product.name}`}
                className="tap flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-alert active:bg-alert-soft"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => void setArchived(product, product.active)}
                aria-label={product.active ? `Archiver ${product.name}` : `Restaurer ${product.name}`}
                className="tap flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-muted active:bg-canvas"
              >
                {product.active ? (
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 text-xs leading-relaxed text-muted">
        L&apos;interrupteur retire le produit de la vente pour le service (rupture). Archiver le
        sort du menu en gardant l&apos;historique. Supprimer est definitif : les commandes deja
        passees gardent leur libelle et leur prix d&apos;origine.
      </p>

      <ProductSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={reload}
        data={data}
        product={editing}
        defaultCategoryId={categoryId === 'ALL' ? null : categoryId}
      />
    </div>
  );
}

// -------------------------------------------------------------- categories --
function CategoriesTab({
  data,
  reload,
  onError,
}: {
  data: ReturnType<typeof useAdminMenu>['data'];
  reload: () => void;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const nextSortOrder = useMemo(
    () => data.categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1,
    [data.categories],
  );

  async function setActive(category: CategoryRow, active: boolean) {
    setBusyId(category.id);
    onError(null);
    const { error } = await getSupabaseBrowser()
      .from('categories')
      .update({ active })
      .eq('id', category.id);
    setBusyId(null);
    if (error) onError(error.message);
    else reload();
  }

  async function remove(category: CategoryRow) {
    if (!window.confirm(`Supprimer la categorie « ${category.name} » ?`)) return;
    setBusyId(category.id);
    onError(null);
    const { error } = await getSupabaseBrowser().rpc('pos_delete_category', {
      p_category_id: category.id,
    });
    setBusyId(null);
    if (error) onError(describeAdminError(error.message));
    else reload();
  }

  async function move(category: CategoryRow, direction: -1 | 1) {
    const ordered = [...data.categories].sort((a, b) => a.sort_order - b.sort_order);
    const index = ordered.findIndex((c) => c.id === category.id);
    const target = ordered[index + direction];
    if (!target) return;

    setBusyId(category.id);
    onError(null);
    const supabase = getSupabaseBrowser();
    const [first, second] = await Promise.all([
      supabase.from('categories').update({ sort_order: target.sort_order }).eq('id', category.id),
      supabase.from('categories').update({ sort_order: category.sort_order }).eq('id', target.id),
    ]);
    setBusyId(null);
    if (first.error || second.error) onError((first.error ?? second.error)!.message);
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
        + Ajouter une categorie
      </PrimaryButton>

      {data.categories.length === 0 ? (
        <EmptyState text="Aucune categorie." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {data.categories.map((category, index) => (
            <li key={category.id} className="flex items-center gap-2 p-3">
              <span
                className="size-4 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold leading-tight text-ink">{category.name}</p>
                <p className="text-xs text-muted">
                  {data.products.filter((p) => p.category_id === category.id && p.active).length} produits
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                <IconButton
                  label="Monter"
                  disabled={index === 0 || busyId === category.id}
                  onClick={() => void move(category, -1)}
                >
                  <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </IconButton>
                <IconButton
                  label="Descendre"
                  disabled={index === data.categories.length - 1 || busyId === category.id}
                  onClick={() => void move(category, 1)}
                >
                  <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </IconButton>
                <IconButton
                  label="Modifier"
                  onClick={() => {
                    setEditing(category);
                    setSheetOpen(true);
                  }}
                >
                  <path d="M4 20h4l10-10-4-4L4 16v4z" strokeLinejoin="round" />
                </IconButton>
                <IconButton label="Supprimer" tone="alert" onClick={() => void remove(category)}>
                  <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12" strokeLinecap="round" strokeLinejoin="round" />
                </IconButton>
              </div>

              <Toggle
                checked={category.active}
                onChange={(next) => void setActive(category, next)}
                label={`Activer ${category.name}`}
                disabled={busyId === category.id}
              />
            </li>
          ))}
        </ul>
      )}

      <CategorySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={reload}
        category={editing}
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}

// ------------------------------------------------------------------ options --
function OptionsTab({
  data,
  reload,
  onError,
}: {
  data: ReturnType<typeof useAdminMenu>['data'];
  reload: () => void;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState<OptionGroupRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const nextSortOrder = useMemo(
    () => data.groups.reduce((max, g) => Math.max(max, g.sort_order), 0) + 1,
    [data.groups],
  );

  const groupOptions = useMemo(
    () => (editing ? data.options.filter((o) => o.group_id === editing.id) : []),
    [editing, data.options],
  );

  async function removeGroup(group: OptionGroupRow) {
    const used = data.links.filter((l) => l.group_id === group.id).length;
    const message =
      used > 0
        ? `« ${group.name} » est utilise par ${used} produit(s). Le supprimer retirera ces options du menu. Continuer ?`
        : `Supprimer « ${group.name} » ?`;
    if (!window.confirm(message)) return;

    onError(null);
    const { error } = await getSupabaseBrowser().from('option_groups').delete().eq('id', group.id);
    if (error) onError(error.message);
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
        + Ajouter un groupe d&apos;options
      </PrimaryButton>

      {data.groups.length === 0 ? (
        <EmptyState text="Aucun groupe d'options." />
      ) : (
        <ul className="space-y-2">
          {data.groups.map((group) => {
            const options = data.options.filter((o) => o.group_id === group.id);
            const usedBy = data.links.filter((l) => l.group_id === group.id).length;
            return (
              <li key={group.id} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold leading-tight text-ink">{group.name}</p>
                    <p className="text-xs text-muted">
                      {group.max_select === 1 ? 'Choix unique' : 'Choix multiple'}
                      {group.min_select > 0 ? ' · obligatoire' : ''} · {usedBy} produit
                      {usedBy > 1 ? 's' : ''}
                    </p>
                  </div>
                  <IconButton
                    label="Modifier"
                    onClick={() => {
                      setEditing(group);
                      setSheetOpen(true);
                    }}
                  >
                    <path d="M4 20h4l10-10-4-4L4 16v4z" strokeLinejoin="round" />
                  </IconButton>
                  <IconButton label="Supprimer" tone="alert" onClick={() => void removeGroup(group)}>
                    <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12" strokeLinecap="round" strokeLinejoin="round" />
                  </IconButton>
                </div>

                {options.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {options.map((option) => (
                      <span
                        key={option.id}
                        className="rounded-lg bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-2"
                      >
                        {option.name}
                        {option.price_delta_cents !== 0
                          ? ` +${formatAmount(option.price_delta_cents)}`
                          : ''}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <OptionGroupSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={reload}
        group={editing}
        groupOptions={groupOptions}
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}

// ------------------------------------------------------------------- petits --
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

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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
