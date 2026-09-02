'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { describeDbError } from '@/lib/adminErrors';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { sortFloorTables } from '@/lib/tableSort';
import type { TableOverviewRow } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  fromTableId: string;
  fromLabel: string;
  orderNumber: number;
  pending: boolean;
  onClose: () => void;
  onPick: (table: TableOverviewRow) => void;
};

export function MoveOrderSheet({
  open,
  fromTableId,
  fromLabel,
  orderNumber,
  pending,
  onClose,
  onPick,
}: Props) {
  const { t } = useI18n();
  const [tables, setTables] = useState<TableOverviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getSupabaseBrowser()
      .from('table_overview')
      .select('*')
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) setError(describeDbError(queryError));
        else setTables(sortFloorTables(data ?? []));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const free = useMemo(
    () => tables.filter((row) => row.id !== fromTableId && row.order_id === null),
    [tables, fromTableId],
  );

  const groups = useMemo(() => {
    const map = new Map<string, TableOverviewRow[]>();
    for (const row of free) {
      const list = map.get(row.zone_name);
      if (list) list.push(row);
      else map.set(row.zone_name, [row]);
    }
    return [...map.entries()];
  }, [free]);

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={pending ? () => undefined : onClose}
      title={t('cart.moveTitle')}
      subtitle={t('cart.moveHint', { n: orderNumber, from: fromLabel })}
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-7 text-brand" />
        </div>
      ) : error ? (
        <p className="px-4 py-10 text-center text-sm text-alert">{error}</p>
      ) : groups.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">{t('cart.moveEmpty')}</p>
      ) : (
        <div className="space-y-5 px-4 py-4">
          {groups.map(([zone, rows]) => (
            <section key={zone}>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">{zone}</h3>
              <ul className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onPick(row)}
                      className="tap flex h-14 w-full items-center justify-center rounded-2xl border border-line bg-surface text-sm font-extrabold text-ink active:bg-canvas disabled:opacity-40"
                    >
                      {row.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
