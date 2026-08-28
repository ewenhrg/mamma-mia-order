'use client';

import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorNote, Toggle } from '@/components/admin/ui';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { describeDbError } from '@/lib/adminErrors';
import type { StaffRole, StaffRow } from '@/lib/types';

const ROLES: { value: StaffRole; label: string; hint: string }[] = [
  { value: 'server', label: 'Serveur', hint: 'Prend les commandes' },
  { value: 'manager', label: 'Manager', hint: 'Gere le menu, annule des lignes, accorde des remises' },
  { value: 'admin', label: 'Admin', hint: 'Acces complet' },
];

export function StaffAdmin({ currentUserId, currentRole }: { currentUserId: string; currentRole: StaffRole }) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const { data, error: queryError } = await getSupabaseBrowser()
      .from('staff')
      .select('*')
      .order('created_at');
    if (queryError) setError(describeDbError(queryError));
    else setStaff(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <div className="rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
        <p className="font-bold text-ink">Ajouter un serveur</p>
        <p className="mt-1">
          Cree son compte dans Supabase &rsaquo; Authentication &rsaquo; Users, puis active-le ci-dessous.
          Un compte fraichement cree n&apos;a aucun acces tant qu&apos;il n&apos;est pas active ici.
        </p>
      </div>

      <ErrorNote message={error} />

      {loading ? (
        <div className="flex justify-center py-12 text-muted">
          <Spinner className="size-6" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState text="Aucun membre." />
      ) : (
        <ul className="space-y-2">
          {staff.map((member) => {
            const isSelf = member.id === currentUserId;
            return (
              <li key={member.id} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-canvas text-base font-extrabold text-ink">
                    {member.full_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold leading-tight text-ink">
                      {member.full_name}
                      {isSelf ? <span className="ml-1.5 text-xs font-semibold text-muted">(toi)</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {member.active ? 'Actif' : 'Inactif'} ·{' '}
                      {ROLES.find((r) => r.value === member.role)?.label}
                    </p>
                  </div>

                  {busyId === member.id ? <Spinner className="size-5 text-muted" /> : null}

                  {/* On ne peut pas se desactiver soi-meme : ce serait perdre
                      l'acces a cet ecran sans moyen de revenir. */}
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
    </div>
  );
}
