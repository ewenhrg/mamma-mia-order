'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { getOutbox } from '@/lib/outbox';

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;

    // Se deconnecter avec des envois en attente les rendrait inenvoyables.
    const waiting = getOutbox().length;
    if (waiting > 0) {
      const ok = window.confirm(
        `${waiting} commande(s) ne sont pas encore envoyees. Se deconnecter maintenant empeche leur envoi. Continuer ?`,
      );
      if (!ok) return;
    }

    setPending(true);
    try {
      await getSupabaseBrowser().auth.signOut();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={
        className ??
        'tap h-12 rounded-2xl border border-line bg-surface px-6 font-semibold text-ink-2 active:bg-canvas disabled:opacity-60'
      }
    >
      {pending ? 'Deconnexion…' : 'Se deconnecter'}
    </button>
  );
}
