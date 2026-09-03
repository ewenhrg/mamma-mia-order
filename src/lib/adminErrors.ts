/**
 * Traduction des erreurs base en phrases qui disent quoi faire.
 */

import { getLocale } from '@/lib/localeStore';
import { translate, type MessageKey } from '@/lib/messages';

type DbError = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function asDbError(error: unknown): DbError {
  if (typeof error === 'string') return { message: error };
  if (typeof error === 'object' && error !== null) return error as DbError;
  return { message: String(error) };
}

function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(getLocale(), key, vars);
}

export function describeDbError(error: unknown): string {
  const { message = '', code = '' } = asDbError(error);
  const count = message.match(/:(\d+)/)?.[1] ?? '—';

  if (message.includes('TABLE_HAS_ORDERS')) return t('err.tableHasOrders', { n: count });
  if (message.includes('CATEGORY_HAS_PRODUCTS')) return t('err.categoryHasProducts', { n: count });
  if (message.includes('ZONE_HAS_TABLES')) return t('err.zoneHasTables', { n: count });
  if (message.includes('TABLE_NOT_FOUND')) return t('err.tableNotFound');
  if (message.includes('MANAGER_REQUIRED')) return t('err.managerRequired');
  if (message.includes('DISCOUNT_FORBIDDEN')) return t('err.discountForbidden');
  if (message.includes('ORDER_NOT_PAID')) return t('err.orderNotPaid');
  if (message.includes('BALANCE_REMAINING')) return t('err.balanceRemaining');
  if (message.includes('ORDER_CLOSED')) return t('err.orderClosed');
  if (message.includes('ORDER_NOT_FOUND')) return t('err.orderNotFound');
  if (message.includes('STAFF_INACTIVE')) return t('err.staffInactive');
  if (message.includes('STAFF_NOT_SERVER')) return t('err.staffNotServer');
  if (message.includes('ZONE_NOT_FOUND')) return t('err.zoneNotFound');
  if (message.includes('INVALID_CUSTOM')) return t('err.invalidCustom');
  if (message.includes('ADMIN_REQUIRED')) return t('err.adminRequired');
  if (message.includes('TABLE_OCCUPIED')) return t('err.tableOccupied');
  if (message.includes('SAME_TABLE')) return t('err.sameTable');
  if (message.includes('OWNER_REQUIRED')) return t('err.ownerRequired');

  if (code === 'PGRST205' || code === 'PGRST204' || /schema cache/i.test(message)) {
    return t('err.schemaCache');
  }
  if (code === '42P01') return t('err.missingTable');
  if (code === '42703') return t('err.missingColumn');
  if (code === '42883') return t('err.missingFn');
  if (code === '42501' || /row-level security/i.test(message)) return t('err.rls');
  if (code === 'PGRST301' || /JWT|expired/i.test(message)) return t('err.jwt');
  if (code === '23505') return t('err.dupName');
  if (code === '23503') return t('err.inUse');
  if (code === '23502') return t('err.required');
  if (/failed to fetch|networkerror|load failed/i.test(message)) return t('err.network');

  return message || t('err.unknown');
}

/** Ancien nom, conserve pour les appels existants. */
export const describeAdminError = describeDbError;
