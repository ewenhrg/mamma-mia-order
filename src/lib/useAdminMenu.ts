'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type {
  CategoryRow,
  OptionGroupRow,
  OptionRow,
  ProductOptionGroupRow,
  ProductRow,
} from '@/lib/types';

export type AdminMenuData = {
  categories: CategoryRow[];
  products: ProductRow[];
  groups: OptionGroupRow[];
  options: OptionRow[];
  links: ProductOptionGroupRow[];
};

const EMPTY: AdminMenuData = { categories: [], products: [], groups: [], options: [], links: [] };

/**
 * Vue complete du menu pour l'administration : contrairement au POS, on
 * charge aussi les elements desactives, sinon on ne pourrait plus les
 * reactiver.
 */
export function useAdminMenu() {
  const [data, setData] = useState<AdminMenuData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const [categories, products, groups, options, links] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('products').select('*').order('sort_order'),
        supabase.from('option_groups').select('*').order('sort_order'),
        supabase.from('options').select('*').order('sort_order'),
        supabase.from('product_option_groups').select('*').order('sort_order'),
      ]);

      const failure =
        categories.error ?? products.error ?? groups.error ?? options.error ?? links.error;
      if (failure) throw failure;

      setData({
        categories: categories.data ?? [],
        products: products.data ?? [],
        groups: groups.data ?? [],
        options: options.data ?? [],
        links: links.data ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
