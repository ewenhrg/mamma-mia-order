'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { ErrorNote, Field, GhostButton, PrimaryButton, inputClass } from '@/components/admin/ui';
import { formatAmount, parseAmountToCents } from '@/lib/money';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { OptionGroupRow, OptionRow } from '@/lib/types';

type Draft = { id: string | null; name: string; price: string; available: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  group: OptionGroupRow | null;
  groupOptions: OptionRow[];
  nextSortOrder: number;
};

/**
 * Un groupe et ses options se saisissent d'un bloc : creer "Cuisson" puis
 * revenir ajouter chaque cuisson une par une serait insupportable.
 */
export function OptionGroupSheet({
  open,
  onClose,
  onSaved,
  group,
  groupOptions,
  nextSortOrder,
}: Props) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'single' | 'multi'>('multi');
  const [required, setRequired] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(group?.name ?? '');
    setMode(group?.max_select === 1 ? 'single' : 'multi');
    setRequired((group?.min_select ?? 0) > 0);
    setDrafts(
      groupOptions.length > 0
        ? groupOptions.map((o) => ({
            id: o.id,
            name: o.name,
            price: o.price_delta_cents === 0 ? '' : formatAmount(o.price_delta_cents),
            available: o.available,
          }))
        : [{ id: null, name: '', price: '', available: true }],
    );
  }, [open, group, groupOptions]);

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Le nom du groupe est obligatoire.');
      return;
    }

    const cleaned: { id: string | null; name: string; cents: number; available: boolean }[] = [];
    for (const draft of drafts) {
      const optionName = draft.name.trim();
      if (!optionName) continue;
      const cents = draft.price.trim() === '' ? 0 : parseAmountToCents(draft.price);
      if (cents === null) {
        setError(`Supplement invalide pour « ${optionName} ». Exemples : 20 ou 20.50`);
        return;
      }
      cleaned.push({ id: draft.id, name: optionName, cents, available: draft.available });
    }

    if (cleaned.length === 0) {
      setError('Ajoute au moins une option.');
      return;
    }

    setPending(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowser();
      const payload = {
        name: trimmed,
        max_select: mode === 'single' ? 1 : 0,
        min_select: required ? 1 : 0,
      };

      let groupId = group?.id;
      if (group) {
        const { error: updateError } = await supabase
          .from('option_groups')
          .update(payload)
          .eq('id', group.id);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('option_groups')
          .insert({ ...payload, sort_order: nextSortOrder })
          .select('id')
          .single();
        if (insertError) throw insertError;
        groupId = inserted.id;
      }
      if (!groupId) throw new Error('Groupe introuvable apres enregistrement');

      // Options retirees du formulaire : supprimees. Les commandes deja
      // envoyees gardent leur copie figee (options_snapshot).
      const keptIds = cleaned.map((o) => o.id).filter((id): id is string => id !== null);
      const removed = groupOptions.filter((o) => !keptIds.includes(o.id)).map((o) => o.id);
      if (removed.length > 0) {
        const { error: deleteError } = await supabase.from('options').delete().in('id', removed);
        if (deleteError) throw deleteError;
      }

      for (const [index, option] of cleaned.entries()) {
        const row = {
          group_id: groupId,
          name: option.name,
          price_delta_cents: option.cents,
          available: option.available,
          sort_order: index + 1,
        };
        const { error: optionError } = option.id
          ? await supabase.from('options').update(row).eq('id', option.id)
          : await supabase.from('options').insert(row);
        if (optionError) throw optionError;
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
      title={group ? group.name : "Nouveau groupe d'options"}
      subtitle="Reutilisable sur plusieurs produits"
      footer={
        <PrimaryButton onClick={save} pending={pending} className="w-full">
          Enregistrer
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <ErrorNote message={error} />

        <Field label="Nom du groupe">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cuisson, Supplements, Sauce…"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`tap h-14 rounded-2xl border font-bold ${
              mode === 'single' ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2'
            }`}
          >
            Choix unique
          </button>
          <button
            type="button"
            onClick={() => setMode('multi')}
            className={`tap h-14 rounded-2xl border font-bold ${
              mode === 'multi' ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2'
            }`}
          >
            Choix multiple
          </button>
        </div>

        <label className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
          <span className="text-sm font-bold text-ink-2">Selection obligatoire</span>
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="size-6 accent-[color:var(--color-brand)]"
          />
        </label>

        <div>
          <span className="mb-2 block text-sm font-bold text-ink-2">Options</span>
          <div className="space-y-2">
            {drafts.map((draft, index) => (
              <div key={draft.id ?? `new-${index}`} className="flex gap-2">
                <input
                  value={draft.name}
                  onChange={(e) => updateDraft(index, { name: e.target.value })}
                  placeholder="Cheese"
                  className={`${inputClass} flex-1`}
                />
                <input
                  value={draft.price}
                  onChange={(e) => updateDraft(index, { price: e.target.value })}
                  inputMode="decimal"
                  placeholder="+0"
                  className={`${inputClass} w-24 shrink-0`}
                />
                <button
                  type="button"
                  aria-label="Retirer cette option"
                  onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                  className="tap flex size-13 shrink-0 items-center justify-center rounded-2xl border border-line text-alert active:bg-alert-soft"
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <GhostButton
            type="button"
            onClick={() => setDrafts((current) => [...current, { id: null, name: '', price: '', available: true }])}
            className="mt-2 w-full"
          >
            + Ajouter une option
          </GhostButton>
        </div>
      </div>
    </Sheet>
  );
}
