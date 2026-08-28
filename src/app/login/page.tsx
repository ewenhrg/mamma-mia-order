import { LoginForm } from './LoginForm';
import { SetupNotice } from '@/components/SetupNotice';

export const metadata = { title: 'Connexion — Mamma Mia' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // On ne redirige que vers une route interne : un "next" venant de l'URL
  // ne doit pas pouvoir envoyer le serveur ailleurs.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const configured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <main className="pt-safe pb-safe flex min-h-[100dvh] flex-col justify-center bg-canvas px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand font-serif text-2xl font-bold text-white shadow-lg shadow-brand/25">
            MM
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Mamma Mia</h1>
          <p className="mt-1 text-sm text-muted">Prise de commande</p>
        </div>

        {configured ? <LoginForm next={safeNext} /> : <SetupNotice />}
      </div>
    </main>
  );
}
