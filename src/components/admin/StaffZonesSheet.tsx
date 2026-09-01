'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { PrimaryButton } from '@/components/admin/ui';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { describeDbError } from '@/lib/adminErrors';
import { useI18n } from '@/lib/i18n';
import type { StaffRow, ZoneRow } from '@/lib/types';

export function StaffZonesSheet({
  member,
  zones,
  assignedIds,
  onClose,
  onSaved,
}: {
  member: StaffRow | null;
  zones: ZoneRow[];
  assignedIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    setSelected(new Set(assignedIds));
    setError(null);
  }, [member, assignedIds.join(',')]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!member) return;
    setSaving(true);
    setError(null);
    const { error: rpcError } = await getSupabaseBrowser().rpc('pos_set_staff_zones', {
      p_staff_id: member.id,
      p_zone_ids: [...selected],
    });
    setSaving(false);
    if (rpcError) {
      setError(describeDbError(rpcError));
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Sheet
      open={member !== null}
      onClose={onClose}
      title={member ? t('admin.zonesFor', { name: member.full_name }) : ''}
      subtitle={t('admin.zonesForHint')}
      footer={
        <PrimaryButton pending={saving} onClick={() => void save()} className="w-full">
          {t('admin.save')}
        </PrimaryButton>
      }
    >
      <div className="space-y-3 p-4">
        {error ? (
          <p role="alert" className="rounded-2xl border border-alert/25 bg-alert-soft px-4 py-3 text-sm font-medium text-alert">
            {error}
          </p>
        ) : null}

        <p className="text-sm text-ink-2">
          {selected.size === 0 ? t('admin.zonesSeesAll') : t('admin.zonesSeesN', { n: selected.size })}
        </p>

        {zones.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.zonesNone')}</p>
        ) : (
          <ul className="space-y-2">
            {zones.map((zone) => {
              const active = selected.has(zone.id);
              return (
                <li key={zone.id}>
                  <button
                    type="button"
                    onClick={() => toggle(zone.id)}
                    aria-pressed={active}
                    className={`tap flex h-14 w-full items-center gap-3 rounded-2xl border px-4 text-start ${
                      active ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
                    }`}
                  >
                    <span
                      className="size-4 shrink-0 rounded-full"
                      style={{ backgroundColor: zone.color }}
                      aria-hidden="true"
                    />
                    <span className={`min-w-0 flex-1 truncate font-bold ${active ? 'text-brand' : 'text-ink'}`}>
                      {zone.name}
                    </span>
                    {active ? (
                      <span className="text-sm font-extrabold text-brand">✓</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
