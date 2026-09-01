'use client';

import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** Titre lu par les lecteurs d'ecran et affiche en tete. */
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Barre d'action collee en bas, hors de la zone scrollable. */
  footer?: React.ReactNode;
  /** Hauteur max du panneau, en fraction de la hauteur visible. */
  maxHeight?: string;
};

/**
 * Bottom sheet : le geste naturel sur telephone. Le contenu monte depuis
 * le bas, a portee du pouce, et se ferme par le fond ou le bouton.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeight = '88dvh',
}: SheetProps) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    // Bloque le scroll de la page derriere le panneau.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t('sheet.close')}
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-ink/45"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxHeight }}
        className="animate-sheet relative flex w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-[0_-8px_40px_rgba(11,13,18,0.25)]"
      >
        <div className="shrink-0 border-b border-line px-4 pb-3 pt-2">
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-line" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-tight text-ink">{title}</h2>
              {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('sheet.close')}
              className="tap -mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-canvas"
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer ? (
          <div className="pb-safe shrink-0 border-t border-line bg-surface px-4 pt-3">
            <div className="pb-3">{footer}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
