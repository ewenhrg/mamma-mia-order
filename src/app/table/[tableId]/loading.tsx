export default function TableLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="pt-safe border-b border-line bg-surface px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="size-11 shrink-0 rounded-xl bg-line/60" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-28 rounded-lg bg-line/60" />
            <div className="h-3 w-40 rounded-lg bg-line/40" />
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-11 w-20 shrink-0 rounded-full bg-line/50" />
          ))}
        </div>
      </header>
      <main className="grid grid-cols-2 gap-2.5 p-3 min-[420px]:grid-cols-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[6.5rem] rounded-2xl bg-line/50" />
        ))}
      </main>
    </div>
  );
}
