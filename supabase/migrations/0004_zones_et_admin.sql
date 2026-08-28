-- =============================================================================
-- MAMMA MIA — POS : zones de table modifiables + pouvoirs d'administration
-- A executer APRES 0003_encaissement.sql.
--
-- Les zones etaient un type enum Postgres : impossible a modifier depuis le
-- site. Elles deviennent une vraie table, editable comme les categories du
-- menu. Aucune donnee existante n'est perdue : les zones actuelles sont
-- reprises telles quelles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Zones de salle
-- ---------------------------------------------------------------------------
create table if not exists public.zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default '#0B0D12',
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists zones_set_updated_at on public.zones;
create trigger zones_set_updated_at before update on public.zones
  for each row execute function public.tg_set_updated_at();

-- Reprise des zones deja utilisees, avec un libelle lisible.
insert into public.zones (name, color, sort_order)
select v.name, v.color, v.sort_order
from (values
  ('Restaurant', '#C8102E', 1),
  ('Terrasse',   '#EA580C', 2),
  ('Plage',      '#0891B2', 3),
  ('Bar',        '#7C3AED', 4),
  ('VIP',        '#B45309', 5)
) as v(name, color, sort_order)
where not exists (select 1 from public.zones z where z.name = v.name);

-- ---------------------------------------------------------------------------
-- 2. Bascule des tables vers zone_id
-- ---------------------------------------------------------------------------
alter table public.restaurant_tables
  add column if not exists zone_id uuid references public.zones(id) on delete restrict;

do $$
begin
  -- Ne s'execute que tant que l'ancienne colonne enum existe.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'restaurant_tables' and column_name = 'zone'
  ) then
    update public.restaurant_tables t
       set zone_id = z.id
      from public.zones z
     where t.zone_id is null
       and upper(z.name) = upper(t.zone::text);
  end if;
end $$;

-- Filet : toute table encore sans zone rejoint la premiere zone existante.
update public.restaurant_tables
   set zone_id = (select id from public.zones order by sort_order limit 1)
 where zone_id is null;

alter table public.restaurant_tables alter column zone_id set not null;

-- La vue de salle reference encore l ancienne colonne : on la retire d abord,
-- elle est recreee juste apres avec la zone denormalisee.
drop view if exists public.table_overview;
alter table public.restaurant_tables drop column if exists zone;

drop index if exists public.restaurant_tables_sort_idx;
create index if not exists restaurant_tables_sort_idx
  on public.restaurant_tables (zone_id, sort_order) where active;

-- ---------------------------------------------------------------------------
-- 3. Vue salle : la zone voyage avec son nom et sa couleur
-- ---------------------------------------------------------------------------
create view public.table_overview
with (security_invoker = true) as
select
  t.id,
  t.label,
  t.zone_id,
  z.name          as zone_name,
  z.color         as zone_color,
  t.seats,
  t.sort_order,
  o.id            as order_id,
  o.order_number  as order_number,
  o.total_cents   as order_total_cents,
  o.created_at    as order_opened_at,
  o.opened_by     as order_opened_by,
  s.full_name     as order_opened_by_name,
  o.paid_at       as order_paid_at,
  o.paid_amount_cents as order_paid_amount_cents,
  greatest(coalesce(o.total_cents, 0) - coalesce(o.paid_amount_cents, 0), 0)::integer
                  as order_remaining_cents,
  coalesce(i.item_count, 0)::integer as item_count
from public.restaurant_tables t
join public.zones z on z.id = t.zone_id
left join public.orders o on o.table_id = t.id and o.status = 'open'
left join public.staff s on s.id = o.opened_by
left join lateral (
  select sum(quantity) as item_count from public.order_items where order_id = o.id
) i on true
where t.active;

-- ---------------------------------------------------------------------------
-- 4. RLS sur les zones : lecture pour l'equipe, ecriture pour les managers
-- ---------------------------------------------------------------------------
alter table public.zones enable row level security;

drop policy if exists zones_read on public.zones;
create policy zones_read on public.zones
  for select to authenticated using (public.is_active_staff());

drop policy if exists zones_write on public.zones;
create policy zones_write on public.zones
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- 5. Suppressions sures
--    Supprimer est definitif : ces fonctions refusent proprement quand la
--    suppression detruirait un historique, et disent quoi faire a la place.
-- ---------------------------------------------------------------------------
create or replace function public.pos_delete_table(p_table_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_orders integer;
begin
  if not public.is_manager() then
    raise exception 'MANAGER_REQUIRED' using errcode = '42501';
  end if;

  select count(*) into v_orders from public.orders where table_id = p_table_id;
  if v_orders > 0 then
    -- Effacer la table effacerait les commandes qui s'y rattachent.
    raise exception 'TABLE_HAS_ORDERS:%', v_orders using errcode = '23503';
  end if;

  delete from public.restaurant_tables where id = p_table_id;
  return jsonb_build_object('ok', true, 'deleted', true);
end $$;

create or replace function public.pos_delete_category(p_category_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_products integer;
begin
  if not public.is_manager() then
    raise exception 'MANAGER_REQUIRED' using errcode = '42501';
  end if;

  select count(*) into v_products from public.products where category_id = p_category_id;
  if v_products > 0 then
    raise exception 'CATEGORY_HAS_PRODUCTS:%', v_products using errcode = '23503';
  end if;

  delete from public.categories where id = p_category_id;
  return jsonb_build_object('ok', true, 'deleted', true);
end $$;

-- Les produits sont supprimables : les commandes passees gardent une copie
-- figee du nom et du prix (name_snapshot / unit_price_cents).
create or replace function public.pos_delete_product(p_product_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'MANAGER_REQUIRED' using errcode = '42501';
  end if;
  delete from public.products where id = p_product_id;
  return jsonb_build_object('ok', true, 'deleted', true);
end $$;

create or replace function public.pos_delete_zone(p_zone_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tables integer;
begin
  if not public.is_manager() then
    raise exception 'MANAGER_REQUIRED' using errcode = '42501';
  end if;

  select count(*) into v_tables from public.restaurant_tables where zone_id = p_zone_id;
  if v_tables > 0 then
    raise exception 'ZONE_HAS_TABLES:%', v_tables using errcode = '23503';
  end if;
  if (select count(*) from public.zones) <= 1 then
    raise exception 'LAST_ZONE' using errcode = '23503';
  end if;

  delete from public.zones where id = p_zone_id;
  return jsonb_build_object('ok', true, 'deleted', true);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Liberation forcee : un manager peut rendre une table sans encaissement
--    (client parti, erreur de saisie). L'addition reste consultable.
-- ---------------------------------------------------------------------------
create or replace function public.pos_force_release(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.orders;
begin
  if not public.is_manager() then
    raise exception 'MANAGER_REQUIRED' using errcode = '42501';
  end if;

  select * into v_row from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;
  if v_row.status <> 'open' then
    return jsonb_build_object('ok', true, 'duplicate', true, 'status', v_row.status);
  end if;

  update public.orders set status = 'closed', closed_at = now() where id = p_order_id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'closed');
end $$;

-- ---------------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.pos_delete_table(uuid)',
    'public.pos_delete_category(uuid)',
    'public.pos_delete_product(uuid)',
    'public.pos_delete_zone(uuid)',
    'public.pos_force_release(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
