'use server';

import { createClient } from '@supabase/supabase-js';
import { ROSTER, nameToSlug, rosterEmail } from '@/lib/roster';
import { getStaffSession } from '@/lib/supabase/server';
import type { Database, StaffRole, StaffRow } from '@/lib/types';

export type AddStaffResult = { ok: true } | { ok: false; error: string };

export type PendingMember = {
  slug: string;
  name: string;
  role: StaffRole;
};

export type TeamDirectory = {
  members: StaffRow[];
  pending: PendingMember[];
  error: string | null;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Tous les comptes, y compris ceux du roster pas encore connectes. */
export async function listTeamDirectory(): Promise<TeamDirectory> {
  const session = await getStaffSession();
  if (!session?.active || (session.role !== 'admin' && session.role !== 'manager')) {
    return { members: [], pending: [], error: 'MANAGER_REQUIRED' };
  }

  const admin = adminClient();
  if (!admin) return { members: [], pending: [], error: 'MISSING_CONFIG' };

  const { data, error } = await admin.from('staff').select('*');
  if (error) return { members: [], pending: [], error: error.message };

  const members = [...(data ?? [])].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, 'fr', { sensitivity: 'base' }),
  );
  const known = new Set(members.map((row) => nameToSlug(row.full_name)));

  const pending: PendingMember[] = ROSTER.filter(
    (entry) => !known.has(entry.slug) && !known.has(nameToSlug(entry.name)),
  ).map((entry) => ({ slug: entry.slug, name: entry.name, role: entry.role }));

  pending.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

  return { members, pending, error: null };
}

/**
 * Cree un membre depuis Admin > Equipe. Il apparait tout de suite
 * sur l'ecran de connexion, sans redeployer.
 */
export async function addTeamMember(fullName: string, role: StaffRole): Promise<AddStaffResult> {
  const session = await getStaffSession();
  if (!session?.active || (session.role !== 'admin' && session.role !== 'manager')) {
    return { ok: false, error: 'MANAGER_REQUIRED' };
  }

  const name = fullName.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 40) return { ok: false, error: 'INVALID_NAME' };

  const allowedRole: StaffRole = session.role === 'admin' ? role : 'server';
  if (allowedRole !== 'server' && allowedRole !== 'manager' && allowedRole !== 'admin') {
    return { ok: false, error: 'INVALID_NAME' };
  }

  const slug = nameToSlug(name);
  if (!slug) return { ok: false, error: 'INVALID_NAME' };

  const admin = adminClient();
  if (!admin) return { ok: false, error: 'MISSING_CONFIG' };

  const takenOnRoster = ROSTER.some(
    (entry) => entry.slug === slug || entry.name.localeCompare(name, 'fr', { sensitivity: 'base' }) === 0,
  );
  if (takenOnRoster) return { ok: false, error: 'DUP_NAME' };

  const { data: existing, error: readError } = await admin.from('staff').select('full_name');
  if (readError) return { ok: false, error: readError.message };
  const takenInDb = (existing ?? []).some(
    (row) =>
      nameToSlug(row.full_name) === slug ||
      row.full_name.localeCompare(name, 'fr', { sensitivity: 'base' }) === 0,
  );
  if (takenInDb) return { ok: false, error: 'DUP_NAME' };

  const created = await admin.auth.admin.createUser({
    email: rosterEmail(slug),
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (created.error) {
    if (/already|exists|registered/i.test(created.error.message)) {
      return { ok: false, error: 'DUP_NAME' };
    }
    return { ok: false, error: created.error.message };
  }
  const userId = created.data.user?.id;
  if (!userId) return { ok: false, error: 'MISSING_CONFIG' };

  const { error: writeError } = await admin.from('staff').upsert(
    {
      id: userId,
      full_name: name,
      role: allowedRole,
      active: true,
      provisioned_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (writeError) return { ok: false, error: writeError.message };

  return { ok: true };
}
