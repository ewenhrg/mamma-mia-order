'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { describeDbError } from '@/lib/adminErrors';
import { sortFloorTables } from '@/lib/tableSort';
import type { FloorStats, TableOverviewRow } from '@/lib/types';

/**
 * Etat de la salle, tenu a jour pour tous les serveurs a la fois.
 *
 * Realtime pousse les changements ; un rafraichissement periodique sert de
 * filet quand le socket tombe (tunnel, wifi qui saute). Les evenements sont
 * regroupes : dix ajouts d'articles en rafale ne declenchent qu'une requete.
 */
export function useTables() {
  const [tables, setTables] = useState<TableOverviewRow[]>([]);
  const [floorStats, setFloorStats] = useState<FloorStats | null>(null);
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
      const [overview, stats] = await Promise.all([
        supabase.from('table_overview').select('*').order('sort_order'),
        supabase.rpc('pos_floor_stats'),
      ]);

      if (!mounted.current) return;
      if (overview.error) {
        setError(describeDbError(overview.error));
      } else {
        setTables(sortFloorTables(overview.data ?? []));
        setError(null);
      }
      if (!stats.error && stats.data) {
        const next = stats.data as FloorStats;
        setFloorStats({ ...next, zones: next.zones ?? [] });
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

  return { tables, floorStats, loading, error, live, refresh };
}
