'use client';

export function PrintButton({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`tap h-14 w-full rounded-2xl bg-brand font-bold text-white ${className}`}
    >
      Imprimer
    </button>
  );
}
