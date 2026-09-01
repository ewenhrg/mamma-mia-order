'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { describeDbError } from '@/lib/adminErrors';
import type { TableOverviewRow } from '@/lib/types';

/**
 * Etat de la salle, tenu a jour pour tous les serveurs a la fois.
 *
 * Realtime pousse les changements ; un rafraichissement periodique sert de
 * filet quand le socket tombe (tunnel, wifi qui saute). Les evenements sont
 * regroupes : dix ajouts d'articles en rafale ne declenchent qu'une requete.
 */
export function useTables() {
  const [tables, setTables] = useState<TableOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const supabase = getSupabaseBrowser();
      const { data, error: queryError } = await supabase
        .from('table_overview')
        .select('*')
        .order('sort_order');

      if (!mounted.current) return;
      if (queryError) {
        setError(describeDbError(queryError));
      } else {
        setTables(data ?? []);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  /** Regroupe les rafales d'evenements Realtime en une seule requete. */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void refresh();
    }, 350);
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    void refresh();

    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel('pos-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_zones' }, scheduleRefresh)
      .subscribe((status) => {
        if (mounted.current) setLive(status === 'SUBSCRIBED');
      });

    // Filet de securite si Realtime est coupe, et remise a jour au retour
    // en avant-plan (le telephone se met en veille entre deux tables).
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);

    return () => {
      mounted.current = false;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [refresh, scheduleRefresh]);

  return { tables, loading, error, live, refresh };
}
