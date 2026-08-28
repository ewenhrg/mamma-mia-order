import { SignOutButton } from '@/components/SignOutButton';

/**
 * Un compte cree n'a aucun acces tant qu'un manager ne l'a pas active.
 * (Voir le trigger tg_handle_new_user : active = false par defaut.)
 */
export function AccessPending({ fullName }: { fullName: string }) {
  return (
    <main className="pt-safe pb-safe flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-6 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-busy-soft text-busy">
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-ink">Compte en attente</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
        Bonjour {fullName}. Ton compte existe mais n&apos;est pas encore active. Demande a un manager de
        t&apos;activer dans <span className="font-semibold text-ink-2">Admin &rsaquo; Equipe</span>.
      </p>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </main>
  );
}
