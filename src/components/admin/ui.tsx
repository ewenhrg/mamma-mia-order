'use client';

import { Spinner } from '@/components/ui/Spinner';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'h-13 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15';

export function PrimaryButton({
  children,
  pending,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || pending}
      className={`tap flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-5 font-bold text-white shadow-lg shadow-brand/25 active:bg-brand-dark disabled:opacity-50 disabled:shadow-none ${className}`}
    >
      {pending ? <Spinner className="size-5" /> : null}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`tap flex h-14 items-center justify-center rounded-2xl border border-line bg-surface px-5 font-semibold text-ink-2 active:bg-canvas disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

/** Interrupteur large : un manager le manipule au pouce, en plein service. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`tap relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-free' : 'bg-line'
      }`}
    >
      <span
        className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[left] duration-150 ${
          checked ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-2xl border border-alert/25 bg-alert-soft px-4 py-3 text-sm font-medium text-alert">
      {message}
    </p>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted">{text}</p>;
}
