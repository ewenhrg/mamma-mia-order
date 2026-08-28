'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Field, PrimaryButton, ErrorNote, inputClass } from '@/components/admin/ui';
import { formatAmount, parseAmountToCents } from '@/lib/money';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { AdminMenuData } from '@/lib/useAdminMenu';
import type { ProductRow } from '@/lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  data: AdminMenuData;
  /** null = creation */
  product: ProductRow | null;
  defaultCategoryId: string | null;
};

export function ProductSheet({ open, onClose, onSaved, data, product, defaultCategoryId }: Props) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [available, setAvailable] = useState(true);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedGroupIds = useMemo(
    () => (product ? data.links.filter((l) => l.product_id === product.id).map((l) => l.group_id) : []),
    [product, data.links],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(product?.name ?? '');
    setPrice(product ? formatAmount(product.price_cents) : '');
    setDescription(product?.description ?? '');
    setCategoryId(product?.category_id ?? defaultCategoryId ?? data.categories[0]?.id ?? '');
    setAvailable(product?.available ?? true);
    setGroupIds(linkedGroupIds);
  }, [open, product, defaultCategoryId, data.categories, linkedGroupIds]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Le nom est obligatoire.');
      return;
    }
    const priceCents = parseAmountToCents(price);
    if (priceCents === null) {
      setError('Prix invalide. Exemples : 120 ou 120.50');
      return;
    }
    if (!categoryId) {
      setError('Choisis une categorie.');
      return;
    }

    setPending(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowser();
      let productId = product?.id;

      if (product) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: trimmed,
            price_cents: priceCents,
            description: description.trim() || null,
            category_id: categoryId,
            available,
          })
          .eq('id', product.id);
        if (updateError) throw updateError;
      } else {
        const maxSort = data.products
          .filter((p) => p.category_id === categoryId)
          .reduce((max, p) => Math.max(max, p.sort_order), 0);

        const { data: inserted, error: insertError } = await supabase
          .from('products')
          .insert({
            name: trimmed,
            price_cents: priceCents,
            description: description.trim() || null,
            category_id: categoryId,
            available,
            sort_order: maxSort + 1,
            active: true,
          })
          .select('id')
          .single();
        if (insertError) throw insertError;
        productId = inserted.id;
      }

      if (!productId) throw new Error('Produit introuvable apres enregistrement');

      // Rattachement des groupes d'options : on ne touche qu'au delta.
      const toAdd = groupIds.filter((id) => !linkedGroupIds.includes(id));
      const toRemove = linkedGroupIds.filter((id) => !groupIds.includes(id));

      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('product_option_groups')
          .delete()
          .eq('product_id', productId)
          .in('group_id', toRemove);
        if (deleteError) throw deleteError;
      }

      if (toAdd.length > 0) {
        const { error: linkError } = await supabase.from('product_option_groups').insert(
          toAdd.map((groupId, index) => ({
            product_id: productId,
            group_id: groupId,
            sort_order: index,
          })),
        );
        if (linkError) throw linkError;
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
      title={product ? product.name : 'Nouveau produit'}
      subtitle={product ? 'Modifier le produit' : 'Ajouter au menu'}
      footer={
        <PrimaryButton onClick={save} pending={pending} className="w-full">
          {product ? 'Enregistrer' : 'Ajouter au menu'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <ErrorNote message={error} />

        <Field label="Nom">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Margherita"
            className={inputClass}
          />
        </Field>

        <Field label="Prix (EGP)" hint="Saisis le prix affiche au client, ex. 120 ou 120.50">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="120"
            className={inputClass}
          />
        </Field>

        <Field label="Categorie">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description" hint="Facultatif">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 300))}
            rows={2}
            className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </Field>

        <label className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
          <span className="text-sm font-bold text-ink-2">Disponible</span>
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
            className="size-6 accent-[color:var(--color-brand)]"
          />
        </label>

        {data.groups.length > 0 ? (
          <div>
            <span className="mb-2 block text-sm font-bold text-ink-2">Groupes d&apos;options</span>
            <div className="space-y-2">
              {data.groups.map((group) => {
                const on = groupIds.includes(group.id);
                const count = data.options.filter((o) => o.group_id === group.id).length;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() =>
                      setGroupIds((current) =>
                        current.includes(group.id)
                          ? current.filter((id) => id !== group.id)
                          : [...current, group.id],
                      )
                    }
                    className={`tap flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                      on ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
                    }`}
                  >
                    <span>
                      <span className={`block text-sm font-bold ${on ? 'text-brand' : 'text-ink'}`}>
                        {group.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {count} option{count > 1 ? 's' : ''}
                        {group.min_select > 0 ? ' · obligatoire' : ''}
                      </span>
                    </span>
                    <span
                      className={`flex size-6 items-center justify-center rounded-md border-2 ${
                        on ? 'border-brand bg-brand text-white' : 'border-line'
                      }`}
                    >
                      {on ? (
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3.5">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
