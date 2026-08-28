'use client';

import { discardEntry, retryAll, retryEntry } from '@/lib/outbox';
import { useOnline, useOutbox } from '@/lib/useOutbox';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Rend visible tout ce qui n'est pas encore arrive en cuisine.
 * Tant que cette barre est la, la commande est conservee sur le telephone :
 * elle ne peut pas etre perdue par un rechargement ou une coupure reseau.
 */
export function OutboxBanner() {
  const entries = useOutbox();
  const online = useOnline();

  if (entries.length === 0) {
    if (online) return null;
    return (
      <div className="flex items-center gap-2 bg-ink px-4 py-2 text-[13px] font-semibold text-white">
        <span className="size-2 shrink-0 rounded-full bg-busy" />
        Hors ligne — les commandes partiront au retour du reseau
      </div>
    );
  }

  const failed = entries.filter((e) => e.status === 'failed');
  const sending = entries.filter((e) => e.status !== 'failed');

  return (
    <div className="border-b border-line">
      {sending.length > 0 ? (
        <div className="flex items-center gap-2 bg-busy-soft px-4 py-2.5 text-[13px] font-semibold text-busy">
          <Spinner className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {sending.length === 1
              ? `Envoi de la table ${sending[0].tableLabel}…`
              : `${sending.length} commandes en cours d'envoi…`}
          </span>
          {!online ? <span className="shrink-0 text-busy/80">hors ligne</span> : null}
        </div>
      ) : null}

      {failed.map((entry) => (
        <div key={entry.clientRequestId} className="bg-alert-soft px-4 py-3">
          <p className="text-[13px] font-bold text-alert">
            Table {entry.tableLabel} — envoi impossible
          </p>
          <p className="mt-0.5 text-xs leading-snug text-alert/85">
            {describeFatal(entry.fatalError)} ({entry.itemCount} article
            {entry.itemCount > 1 ? 's' : ''})
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => retryEntry(entry.clientRequestId)}
              className="tap h-10 rounded-xl bg-alert px-4 text-sm font-bold text-white"
            >
              Reessayer
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Abandonner definitivement cette commande ?')) {
                  discardEntry(entry.clientRequestId);
                }
              }}
              className="tap h-10 rounded-xl border border-alert/30 px-4 text-sm font-semibold text-alert"
            >
              Abandonner
            </button>
          </div>
        </div>
      ))}

      {failed.length > 1 ? (
        <button
          type="button"
          onClick={retryAll}
          className="tap w-full bg-alert px-4 py-2.5 text-sm font-bold text-white"
        >
          Tout reessayer ({failed.length})
        </button>
      ) : null}
    </div>
  );
}

function describeFatal(message: string | null): string {
  if (!message) return 'Erreur inattendue';
  if (message.includes('PRODUCT_UNAVAILABLE')) return "Un produit n'est plus disponible";
  if (message.includes('TABLE_NOT_FOUND')) return "Cette table n'existe plus";
  if (message.includes('STAFF_INACTIVE')) return 'Ton compte a ete desactive';
  if (message.includes('AUTH_REQUIRED')) return 'Session expiree — reconnecte-toi';
  if (message.includes('INVALID_QUANTITY')) return 'Quantite invalide';
  if (message.includes('EMPTY_CART')) return 'Commande vide';
  if (message.includes('CART_TOO_LARGE')) return 'Trop d articles en une seule fois';
  return message;
}
