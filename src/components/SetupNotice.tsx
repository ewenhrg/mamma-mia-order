/** Ecran affiche tant que .env.local n'est pas renseigne. */
export function SetupNotice() {
  return (
    <div className="rounded-2xl border border-busy/30 bg-busy-soft p-5 text-sm leading-relaxed text-ink-2">
      <h2 className="mb-2 text-base font-bold text-ink">Configuration requise</h2>
      <p className="mb-3">
        Cree un fichier <Code>.env.local</Code> a la racine du projet avec les cles de ton projet
        Supabase (Project Settings &rsaquo; API) :
      </p>
      <pre className="overflow-x-auto rounded-xl bg-ink p-3 font-mono text-[11px] leading-relaxed text-white">
        {`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...`}
      </pre>
      <p className="mt-3">
        Puis execute les fichiers de <Code>supabase/migrations/</Code> dans l&apos;ordre
        (<Code>0001</Code> a <Code>0004</Code>) dans le SQL Editor de Supabase, et relance{' '}
        <Code>npm run dev</Code>.
      </p>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">{children}</code>;
}
