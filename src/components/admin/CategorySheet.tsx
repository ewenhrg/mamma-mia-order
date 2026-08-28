'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { ErrorNote, Field, PrimaryButton, inputClass } from '@/components/admin/ui';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { describeDbError } from '@/lib/adminErrors';
import type { CategoryRow } from '@/lib/types';

const PRESET_COLORS = [
  '#C8102E',
  '#EA580C',
  '#F59E0B',
  '#16A34A',
  '#0891B2',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#7C2D12',
  '#0B0D12',
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  category: CategoryRow | null;
  nextSortOrder: number;
};

export function CategorySheet({ open, onClose, onSaved, category, nextSortOrder }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(category?.name ?? '');
    setColor(category?.color ?? PRESET_COLORS[0]);
  }, [open, category]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Le nom est obligatoire.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error: saveError } = category
        ? await supabase.from('categories').update({ name: trimmed, color }).eq('id', category.id)
        : await supabase
            .from('categories')
            .insert({ name: trimmed, color, sort_order: nextSortOrder, active: true });
      if (saveError) throw saveError;
      onSaved();
      onClose();
    } catch (err) {
      setError(describeDbError(err));
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={category ? category.name : 'Nouvelle categorie'}
      footer={
        <PrimaryButton onClick={save} pending={pending} className="w-full">
          {category ? 'Enregistrer' : 'Creer la categorie'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <ErrorNote message={error} />

        <Field label="Nom">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pizza"
            className={inputClass}
          />
        </Field>

        <div>
          <span className="mb-2 block text-sm font-bold text-ink-2">Couleur de l&apos;onglet</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Couleur ${preset}`}
                onClick={() => setColor(preset)}
                style={{ backgroundColor: preset }}
                className={`tap size-11 rounded-xl ${
                  color === preset ? 'ring-4 ring-ink/25' : ''
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
