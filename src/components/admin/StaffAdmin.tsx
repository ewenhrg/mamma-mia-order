'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorNote, Field, PrimaryButton, Toggle, inputClass } from '@/components/admin/ui';
import { StaffZonesSheet } from '@/components/admin/StaffZonesSheet';
import { addTeamMember, listTeamDirectory, type PendingMember } from '@/app/admin/staff/actions';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { describeDbError } from '@/lib/adminErrors';
import { useI18n } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';
import type { StaffRole, StaffRow, StaffZoneRow, ZoneRow } from '@/lib/types';

export function StaffAdmin({ currentUserId, currentRole }: { currentUserId: string; currentRole: StaffRole }) {
  const { t } = useI18n();
  const ROLES: { value: StaffRole; label: string; hint: string }[] = [
    { value: 'server', label: t('admin.role.server'), hint: t('admin.role.serverHint') },
    { value: 'manager', label: t('admin.role.manager'), hint: t('admin.role.managerHint') },
    { value: 'admin', label: t('admin.role.admin'), hint: t('admin.role.adminHint') },
  ];
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [pending, setPending] = useState<PendingMember[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [assignments, setAssignments] = useState<StaffZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    const supabase = getSupabaseBrowser();
    const [dir, zonesRes, assignRes] = await Promise.all([
      listTeamDirectory(),
      supabase.from('zones').select('*').eq('active', true).order('sort_order'),
      supabase.from('staff_zones').select('*'),
    ]);
    if (dir.error) setError(dir.error === 'MANAGER_REQUIRED' ? t('err.managerRequired') : dir.error);
    else {
      setStaff(dir.members);
      setPending(dir.pending);
    }

    if (zonesRes.error) setError(describeDbError(zonesRes.error));
    else setZones(zonesRes.data ?? []);

    if (assignRes.error) {
      const missing = assignRes.error.code === 'PGRST205' || assignRes.error.code === '42P01';
      if (!missing) setError(describeDbError(assignRes.error));
      else setAssignments([]);
    } else {
      setAssignments(assignRes.data ?? []);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const zonesByStaff = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of assignments) {
      const list = map.get(row.staff_id) ?? [];
      list.push(row.zone_id);
      map.set(row.staff_id, list);
    }
    return map;
  }, [assignments]);

  const zoneName = useCallback(
    (id: string) => zones.find((z) => z.id === id)?.name ?? id,
    [zones],
  );

  async function update(member: StaffRow, patch: Partial<Pick<StaffRow, 'active' | 'role'>>) {
    setBusyId(member.id);
    setError(null);
    const { error: updateError } = await getSupabaseBrowser()
      .from('staff')
      .update(patch)
      .eq('id', member.id);
    setBusyId(null);
    if (updateError) setError(describeDbError(updateError));
    else void reload();
  }

  const canPromote = currentRole === 'admin';
  const teamRows = useMemo(() => {
    const rows: Array<{ kind: 'member'; member: StaffRow } | { kind: 'pending'; pending: PendingMember }> = [
      ...staff.map((member) => ({ kind: 'member' as const, member })),
      ...pending.map((row) => ({ kind: 'pending' as const, pending: row })),
    ];
    rows.sort((a, b) => {
      const na = a.kind === 'member' ? a.member.full_name : a.pending.name;
      const nb = b.kind === 'member' ? b.member.full_name : b.pending.name;
      return na.localeCompare(nb, 'fr', { sensitivity: 'base' });
    });
    return rows;
  }, [staff, pending]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <PrimaryButton onClick={() => setAddOpen(true)} className="w-full">
        {t('admin.addStaff')}
      </PrimaryButton>
      <p className="px-1 text-sm text-ink-2">{t('admin.addStaffBody')}</p>
      {teamRows.length > 0 ? (
        <p className="px-1 text-xs font-semibold text-muted">
          {t('admin.teamCount', { n: teamRows.length })}
        </p>
      ) : null}

      <ErrorNote message={error} />

      {loading ? (
        <div className="flex justify-center py-12 text-muted">
          <Spinner className="size-6" />
        </div>
      ) : teamRows.length === 0 ? (
        <EmptyState text={t('admin.noStaff')} />
      ) : (
        <ul className="space-y-2">
          {teamRows.map((row) => {
            if (row.kind === 'pending') {
              const person = row.pending;
              return (
                <li key={`pending-${person.slug}`} className="rounded-2xl border border-dashed border-line bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-canvas text-base font-extrabold text-ink">
                      {person.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold leading-tight text-ink">{person.name}</p>
                      <p className="truncate text-xs text-muted">
                        {t('admin.staffPending')} · {ROLES.find((r) => r.value === person.role)?.label}
                      </p>
                      <p className="truncate text-xs text-ink-2">{t('admin.staffPendingHint')}</p>
                    </div>
                  </div>
                </li>
              );
            }

            const member = row.member;
            const isSelf = member.id === currentUserId;
            const assigned = zonesByStaff.get(member.id) ?? [];
            const zoneLabel =
              member.role !== 'server'
                ? t('admin.zonesSeesAll')
                : assigned.length === 0
                  ? t('admin.zonesSeesAll')
                  : assigned.map(zoneName).join(' · ');
            return (
              <li key={member.id} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-canvas text-base font-extrabold text-ink">
                    {member.full_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold leading-tight text-ink">
                      {member.full_name}
                      {isSelf ? <span className="ms-1.5 text-xs font-semibold text-muted">{t('admin.you')}</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {member.active ? t('admin.active') : t('admin.inactive')} ·{' '}
                      {ROLES.find((r) => r.value === member.role)?.label}
                    </p>
                    <p className="truncate text-xs font-semibold text-ink-2">{zoneLabel}</p>
                  </div>

                  {busyId === member.id ? <Spinner className="size-5 text-muted" /> : null}

                  <Toggle
                    checked={member.active}
                    onChange={(next) => void update(member, { active: next })}
                    label={`Activer ${member.full_name}`}
                    disabled={isSelf || busyId === member.id}
                  />
                </div>

                {canPromote && !isSelf ? (
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {ROLES.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => void update(member, { role: role.value })}
                        disabled={busyId === member.id}
                        className={`tap h-11 rounded-xl border text-sm font-bold disabled:opacity-50 ${
                          member.role === role.value
                            ? 'border-brand bg-brand-soft text-brand'
                            : 'border-line bg-surface text-ink-2'
                        }`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {canPromote && member.role === 'server' ? (
                  <button
                    type="button"
                    onClick={() => setEditing(member)}
                    className="tap mt-2.5 h-12 w-full rounded-xl border border-line text-sm font-bold text-ink-2 active:bg-canvas"
                  >
                    {t('admin.zonesPick')}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-2xl border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
        {ROLES.map((role) => (
          <p key={role.value}>
            <span className="font-bold text-ink-2">{role.label}</span> — {role.hint}
          </p>
        ))}
      </div>

      <StaffZonesSheet
        member={editing}
        zones={zones}
        assignedIds={editing ? (zonesByStaff.get(editing.id) ?? []) : []}
        onClose={() => setEditing(null)}
        onSaved={() => void reload()}
      />

      <AddStaffSheet
        open={addOpen}
        canPickRole={canPromote}
        roles={ROLES}
        onClose={() => setAddOpen(false)}
        onSaved={() => void reload()}
      />
    </div>
  );
}

function AddStaffSheet({
  open,
  canPickRole,
  roles,
  onClose,
  onSaved,
}: {
  open: boolean;
  canPickRole: boolean;
  roles: { value: StaffRole; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('server');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setRole('server');
    setError(null);
  }, [open]);

  async function save() {
    setPending(true);
    setError(null);
    const result = await addTeamMember(name, role);
    setPending(false);
    if (!result.ok) {
      setError(staffAddError(result.error, t));
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
      title={t('admin.addStaffTitle')}
      subtitle={t('admin.addStaffBody')}
      footer={
        <PrimaryButton onClick={() => void save()} pending={pending} className="w-full">
          {t('admin.save')}
        </PrimaryButton>
      }
    >
      <div className="space-y-4 p-4">
        <ErrorNote message={error} />
        <Field label={t('admin.staffName')} hint={t('admin.staffNameHint')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            autoCapitalize="words"
            className={inputClass}
          />
        </Field>
        {canPickRole ? (
          <div className="grid grid-cols-3 gap-2">
            {roles.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setRole(item.value)}
                className={`tap h-12 rounded-xl border text-sm font-bold ${
                  role === item.value
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-line bg-surface text-ink-2'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function staffAddError(code: string, t: (key: MessageKey) => string): string {
  if (code === 'DUP_NAME') return t('admin.DUP_NAME');
  if (code === 'INVALID_NAME') return t('admin.INVALID_NAME');
  if (code === 'MANAGER_REQUIRED') return t('err.managerRequired');
  if (code === 'MISSING_CONFIG') return t('login.MISSING_CONFIG');
  return code;
}
