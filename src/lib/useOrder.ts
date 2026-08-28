'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { OrderItemRow, OrderRow } from '@/lib/types';

export type OrderState = {
  order: OrderRow | null;
  items: OrderItemRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Commande ouverte d'une table + ses lignes deja envoyees.
 *
 * Ecoute Realtime pour qu'un serveur voie en direct ce qu'un collegue vient
 * d'ajouter sur la meme table : c'est ce qui evite de commander deux fois
 * le meme plat a deux depuis deux telephones.
 */
export function useOrder(tableId: string): OrderState {
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const supabase = getSupabaseBrowser();
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'open')
        .maybeSingle();

      if (!mounted.current) return;
      if (orderError) {
        setError(orderError.message);
        return;
      }

      setOrder(orderRow ?? null);
      orderIdRef.current = orderRow?.id ?? null;

      if (!orderRow) {
        setItems([]);
        setError(null);
        return;
      }

      const { data: itemRows, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderRow.id)
        .order('created_at');

      if (!mounted.current) return;
      if (itemsError) setError(itemsError.message);
      else {
        setItems(itemRows ?? []);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [tableId]);

  const scheduleRefresh = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      void refresh();
    }, 300);
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    void refresh();

    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`pos-table-${tableId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${tableId}` },
        scheduleRefresh,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
        // Filtre cote client : Realtime ne sait pas filtrer sur une valeur
        // qui n'est connue qu'apres la creation de la commande.
        const row = (payload.new ?? payload.old) as { order_id?: string } | null;
        if (!orderIdRef.current || row?.order_id === orderIdRef.current) scheduleRefresh();
      })
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);

    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [tableId, refresh, scheduleRefresh]);

  return { order, items, loading, error, refresh };
}
