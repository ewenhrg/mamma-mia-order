'use client';

import { discardEntry, retryAll, retryEntry } from '@/lib/outbox';
import { useOnline, useOutbox } from '@/lib/useOutbox';
import { Spinner } from '@/components/ui/Spinner';
import { useI18n } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';

export function OutboxBanner() {
  const { t } = useI18n();
  const entries = useOutbox();
  const online = useOnline();

  if (entries.length === 0) {
    if (online) return null;
    return (
      <div className="flex items-center gap-2 bg-ink px-4 py-2 text-[13px] font-semibold text-white">
        <span className="size-2 shrink-0 rounded-full bg-busy" />
        {t('outbox.offline')}
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
              ? t('outbox.sendingOne', { label: sending[0].tableLabel })
              : t('outbox.sendingN', { n: sending.length })}
          </span>
          {!online ? <span className="shrink-0 text-busy/80">{t('outbox.offlineShort')}</span> : null}
        </div>
      ) : null}

      {failed.map((entry) => (
        <div key={entry.clientRequestId} className="bg-alert-soft px-4 py-3">
          <p className="text-[13px] font-bold text-alert">
            {t('outbox.fail', { label: entry.tableLabel })}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-alert/85">
            {describeFatal(entry.fatalError, t)} {t('outbox.items', { n: entry.itemCount })}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => retryEntry(entry.clientRequestId)}
              className="tap h-10 rounded-xl bg-alert px-4 text-sm font-bold text-white"
            >
              {t('outbox.retry')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('outbox.dropConfirm'))) {
                  discardEntry(entry.clientRequestId);
                }
              }}
              className="tap h-10 rounded-xl border border-alert/30 px-4 text-sm font-semibold text-alert"
            >
              {t('outbox.drop')}
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
          {t('outbox.retryAll', { n: failed.length })}
        </button>
      ) : null}
    </div>
  );
}

function describeFatal(message: string | null, t: (key: MessageKey) => string): string {
  if (!message) return t('outbox.unexpected');
  if (message.includes('PRODUCT_UNAVAILABLE')) return t('outbox.productGone');
  if (message.includes('TABLE_NOT_FOUND')) return t('outbox.tableGone');
  if (message.includes('STAFF_INACTIVE')) return t('outbox.inactive');
  if (message.includes('AUTH_REQUIRED')) return t('outbox.auth');
  if (message.includes('INVALID_QUANTITY')) return t('outbox.qty');
  if (message.includes('EMPTY_CART')) return t('outbox.empty');
  if (message.includes('CART_TOO_LARGE')) return t('outbox.tooBig');
  return message;
}
