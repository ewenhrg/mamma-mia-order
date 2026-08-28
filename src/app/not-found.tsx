import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="pt-safe pb-safe flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-6 text-center">
      <h1 className="text-xl font-bold text-ink">Introuvable</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">
        Cette table ou cette page n&apos;existe pas, ou a ete desactivee.
      </p>
      <Link
        href="/"
        className="tap mt-8 flex h-14 items-center rounded-2xl bg-brand px-8 font-bold text-white shadow-lg shadow-brand/25"
      >
        Retour a la salle
      </Link>
    </main>
  );
}
