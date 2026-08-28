'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';
import type {
  CategoryRow,
  Menu,
  MenuOptionGroup,
  MenuProduct,
  OptionGroupRow,
  OptionRow,
  ProductOptionGroupRow,
  ProductRow,
} from '@/lib/types';

/** Marques diacritiques combinantes U+0300..U+036F, laissees par NFD. */
const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

/** Minuscules sans accent : "Creme Brulee" doit matcher "Crème Brûlée". */
export function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');
}

const EMPTY_MENU: Menu = { categories: [], products: [] };

/**
 * Une seule salve de requetes, puis denormalisation cote client.
 * Le menu bouge rarement : le charger d'un bloc evite tout N+1 pendant
 * le service, ou chaque aller-retour reseau coute au serveur.
 */
export async function fetchMenu(): Promise<Menu> {
  const supabase = getSupabaseBrowser();

  const [categoriesRes, productsRes, groupsRes, optionsRes, linksRes] = await Promise.all([
    supabase.from('categories').select('*').eq('active', true).order('sort_order'),
    supabase.from('products').select('*').eq('active', true).order('sort_order'),
    supabase.from('option_groups').select('*').order('sort_order'),
    supabase.from('options').select('*').eq('available', true).order('sort_order'),
    supabase.from('product_option_groups').select('*').order('sort_order'),
  ]);

  const firstError =
    categoriesRes.error ?? productsRes.error ?? groupsRes.error ?? optionsRes.error ?? linksRes.error;
  if (firstError) throw firstError;

  return buildMenu(
    categoriesRes.data ?? [],
    productsRes.data ?? [],
    groupsRes.data ?? [],
    optionsRes.data ?? [],
    linksRes.data ?? [],
  );
}

export function buildMenu(
  categories: CategoryRow[],
  products: ProductRow[],
  groups: OptionGroupRow[],
  options: OptionRow[],
  links: ProductOptionGroupRow[],
): Menu {
  const optionsByGroup = new Map<string, OptionRow[]>();
  for (const option of options) {
    const list = optionsByGroup.get(option.group_id);
    if (list) list.push(option);
    else optionsByGroup.set(option.group_id, [option]);
  }

  const groupById = new Map<string, MenuOptionGroup>();
  for (const group of groups) {
    groupById.set(group.id, {
      id: group.id,
      name: group.name,
      minSelect: group.min_select,
      maxSelect: group.max_select,
      options: (optionsByGroup.get(group.id) ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        priceDeltaCents: o.price_delta_cents,
      })),
    });
  }

  const groupsByProduct = new Map<string, MenuOptionGroup[]>();
  for (const link of links) {
    const group = groupById.get(link.group_id);
    if (!group || group.options.length === 0) continue;
    const list = groupsByProduct.get(link.product_id);
    if (list) list.push(group);
    else groupsByProduct.set(link.product_id, [group]);
  }

  const menuProducts: MenuProduct[] = products.map((p) => {
    const optionGroups = groupsByProduct.get(p.id) ?? [];
    return {
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      description: p.description,
      priceCents: p.price_cents,
      imageUrl: p.image_url,
      available: p.available,
      hasOptions: optionGroups.length > 0,
      optionGroups,
      searchKey: normalize(p.name),
    };
  });

  const countByCategory = new Map<string, number>();
  for (const p of menuProducts) {
    countByCategory.set(p.categoryId, (countByCategory.get(p.categoryId) ?? 0) + 1);
  }

  const menuCategories = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      productCount: countByCategory.get(c.id) ?? 0,
    }))
    // Une categorie vide n'est qu'un onglet a scroller pour rien.
    .filter((c) => c.productCount > 0);

  return { categories: menuCategories, products: menuProducts };
}

export type MenuState = {
  menu: Menu;
  loading: boolean;
  error: string | null;
  /** true quand l'affichage vient du cache et que le reseau n'a pas repondu. */
  stale: boolean;
  reload: () => void;
};

/**
 * Affiche immediatement le menu en cache (peinture instantanee au retour de
 * veille ou en reseau lent), puis revalide en arriere-plan.
 */
export function useMenu(): MenuState {
  const [menu, setMenu] = useState<Menu>(EMPTY_MENU);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const cached = readJSON<Menu | null>(STORAGE_KEYS.menuCache, null);
    if (cached && cached.products?.length) {
      setMenu(cached);
      setLoading(false);
      setStale(true);
    }

    let cancelled = false;
    fetchMenu()
      .then((fresh) => {
        if (cancelled || !mounted.current) return;
        setMenu(fresh);
        setStale(false);
        setError(null);
        writeJSON(STORAGE_KEYS.menuCache, fresh);
      })
      .catch((err: unknown) => {
        if (cancelled || !mounted.current) return;
        setError(err instanceof Error ? err.message : 'Menu indisponible');
      })
      .finally(() => {
        if (!cancelled && mounted.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { menu, loading, error, stale, reload };
}
