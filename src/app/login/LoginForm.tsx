'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ROSTER } from '@/lib/roster';
import { signInAs, type SignInState } from './actions';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Spinner } from '@/components/ui/Spinner';
import { useI18n } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';

const INITIAL: SignInState = { error: null };

/**
 * Un prenom, un tap. Pas de clavier, pas de mot de passe : en plein service
 * personne n'a le temps de taper une adresse email sur un telephone.
 */
export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n();
  const [state, formAction] = useActionState(signInAs, INITIAL);
  const [chosen, setChosen] = useState<string | null>(null);

  const errorText = loginError(state.error, t);

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />

      <div className="mb-5">
        <LanguageSwitcher />
      </div>

      {errorText ? (
        <p
          role="alert"
          className="mb-3 rounded-2xl border border-alert/25 bg-alert-soft px-4 py-3 text-sm font-medium text-alert"
        >
          {errorText}
        </p>
      ) : (
        <p className="mb-3 text-center text-sm font-semibold text-ink-2">{t('login.who')}</p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {ROSTER.map((entry) => (
          <NameButton
            key={entry.slug}
            slug={entry.slug}
            name={entry.name}
            chosen={chosen}
            onChoose={setChosen}
          />
        ))}
      </div>
    </form>
  );
}

const LOGIN_CODES: MessageKey[] = ['login.UNKNOWN_NAME', 'login.MISSING_CONFIG', 'login.SIGNIN_FAILED'];

function loginError(error: string | null, t: (key: MessageKey) => string): string | null {
  if (!error) return null;
  const key = `login.${error}` as MessageKey;
  if (LOGIN_CODES.includes(key)) return t(key);
  return error;
}

function NameButton({
  slug,
  name,
  chosen,
  onChoose,
}: {
  slug: string;
  name: string;
  chosen: string | null;
  onChoose: (slug: string) => void;
}) {
  const { pending } = useFormStatus();
  // Seul le prenom tape tourne : les autres se contentent de se griser.
  const isChosen = pending && chosen === slug;

  return (
    <button
      type="submit"
      name="slug"
      value={slug}
      disabled={pending}
      onClick={() => onChoose(slug)}
      className={`tap flex h-20 items-center justify-center rounded-2xl border-2 text-lg font-extrabold shadow-sm disabled:opacity-45 ${
        isChosen
          ? 'border-brand bg-brand-soft text-brand opacity-100'
          : 'border-line bg-surface text-ink active:border-brand active:bg-brand-soft active:text-brand'
      }`}
    >
      {isChosen ? <Spinner className="size-5" /> : name}
    </button>
  );
}
