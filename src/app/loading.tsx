export default function FloorLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="pt-safe border-b border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-brand/80" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-20 rounded-lg bg-line/60" />
            <div className="h-3 w-40 rounded-lg bg-line/40" />
          </div>
        </div>
      </header>
      <main className="grid grid-cols-2 gap-3 p-4 min-[420px]:grid-cols-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[7.5rem] rounded-2xl bg-line/50" />
        ))}
      </main>
    </div>
  );
}
