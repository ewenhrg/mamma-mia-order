-- =============================================================================
-- MAMMA MIA — POS de prise de commande a table
-- Migration 0001 : schema initial, RLS, RPC transactionnelles
-- A coller dans Supabase > SQL Editor, puis executer.
-- Idempotent : peut etre rejoue sans casser une base existante.
-- =============================================================================

-- gen_random_uuid() fait partie du coeur de Postgres depuis la 13 :
-- aucune extension n'est requise.

-- ============================ ENUMS ==========================================
do $$ begin
  create type public.staff_role as enum ('server', 'manager', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('open', 'paid', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.table_zone as enum ('RESTAURANT', 'PLAGE', 'VIP', 'BAR', 'TERRASSE');
exception when duplicate_object then null; end $$;

-- ============================ UTILITAIRES ====================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ============================ STAFF ==========================================
create table if not exists public.staff (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default 'Serveur',
  role       public.staff_role not null default 'server',
  active     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists staff_set_updated_at on public.staff;
create trigger staff_set_updated_at before update on public.staff
  for each row execute function public.tg_set_updated_at();

-- Cree automatiquement la fiche staff a l'inscription, INACTIVE par defaut.
-- Un admin doit l'activer : creer un compte ne donne aucun acces au POS.
create or replace function public.tg_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.staff (id, full_name, role, active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'server',
    false
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- Helpers RLS. SECURITY DEFINER pour lire public.staff sans declencher
-- de recursion infinie dans les policies qui les appellent.
create or replace function public.current_staff_role()
returns public.staff_role language sql stable security definer set search_path = public as $$
  select s.role from public.staff s where s.id = auth.uid() and s.active
$$;

create or replace function public.is_active_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s where s.id = auth.uid() and s.active)
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.id = auth.uid() and s.active and s.role in ('manager', 'admin')
  )
$$;

-- ============================ MENU ===========================================
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#C8102E',
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.tg_set_updated_at();

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name        text not null,
  description text,
  -- Prix en centimes (piastres). Source de verite unique, jamais le client.
  price_cents integer not null check (price_cents >= 0),
  image_url   text,
  available   boolean not null default true,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
  for each row execute function public.tg_set_updated_at();

create index if not exists products_category_idx on public.products (category_id, sort_order) where active;
create index if not exists products_name_idx on public.products (lower(name)) where active;

-- Groupes d'options reutilisables entre produits (cuisson, sauce, supplements...)
create table if not exists public.option_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 0 check (max_select >= 0), -- 0 = illimite
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists option_groups_set_updated_at on public.option_groups;
create trigger option_groups_set_updated_at before update on public.option_groups
  for each row execute function public.tg_set_updated_at();

create table if not exists public.options (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null references public.option_groups(id) on delete cascade,
  name              text not null,
  price_delta_cents integer not null default 0,
  available         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists options_group_idx on public.options (group_id, sort_order);

create table if not exists public.product_option_groups (
  product_id uuid not null references public.products(id) on delete cascade,
  group_id   uuid not null references public.option_groups(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, group_id)
);

create index if not exists pog_group_idx on public.product_option_groups (group_id);

-- ============================ TABLES DE SALLE ================================
create table if not exists public.restaurant_tables (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique,
  zone       public.table_zone not null default 'RESTAURANT',
  seats      integer not null default 4 check (seats > 0),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists restaurant_tables_set_updated_at on public.restaurant_tables;
create trigger restaurant_tables_set_updated_at before update on public.restaurant_tables
  for each row execute function public.tg_set_updated_at();

create index if not exists restaurant_tables_sort_idx on public.restaurant_tables (zone, sort_order) where active;

-- ============================ COMMANDES ======================================
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    bigint generated always as identity,
  table_id        uuid not null references public.restaurant_tables(id) on delete restrict,
  status          public.order_status not null default 'open',
  opened_by       uuid references public.staff(id) on delete set null,
  subtotal_cents  integer not null default 0,
  discount_cents  integer not null default 0 check (discount_cents >= 0),
  total_cents     integer not null default 0,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz
);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.tg_set_updated_at();

-- GARDE-FOU CENTRAL : une seule commande ouverte par table, garanti par la base.
-- Rend structurellement impossible la creation d'une 2e commande sur une table.
create unique index if not exists orders_one_open_per_table
  on public.orders (table_id) where status = 'open';

create index if not exists orders_status_idx on public.orders (status, created_at desc);

create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  batch_id          uuid not null,           -- un envoi = un batch (bon de cuisine)
  product_id        uuid references public.products(id) on delete set null,
  name_snapshot     text not null,           -- fige : le menu peut changer apres
  base_price_cents  integer not null,
  options_snapshot  jsonb not null default '[]'::jsonb,
  unit_price_cents  integer not null,        -- base + options
  quantity          integer not null check (quantity > 0),
  line_total_cents  integer not null,
  note              text,
  created_by        uuid references public.staff(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id, created_at);
create index if not exists order_items_batch_idx on public.order_items (batch_id);

-- Journal d'idempotence : la meme requete rejouee ne cree jamais de doublon.
create table if not exists public.order_submissions (
  client_request_id uuid primary key,
  staff_id          uuid references public.staff(id) on delete set null,
  table_id          uuid references public.restaurant_tables(id) on delete set null,
  order_id          uuid references public.orders(id) on delete cascade,
  batch_id          uuid not null,
  result            jsonb not null,
  created_at        timestamptz not null default now()
);

create index if not exists order_submissions_order_idx on public.order_submissions (order_id);

-- ============================ RECALCUL DES TOTAUX ============================
create or replace function public.recalc_order_totals(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_subtotal integer;
  v_discount integer;
begin
  select coalesce(sum(line_total_cents), 0) into v_subtotal
  from public.order_items where order_id = p_order_id;

  select discount_cents into v_discount from public.orders where id = p_order_id;

  update public.orders
     set subtotal_cents = v_subtotal,
         total_cents    = greatest(v_subtotal - coalesce(v_discount, 0), 0)
   where id = p_order_id;
end $$;

-- ============================ RPC : ENVOI DE COMMANDE ========================
-- Unique chemin d'ecriture des commandes depuis l'application.
-- Le client n'envoie QUE des identifiants et des quantites : tous les prix
-- sont relus en base ici. Un prix envoye par le telephone est ignore.
--
-- p_items : [{ "product_id": uuid, "quantity": int, "option_ids": [uuid],
--              "note": text|null }]
create or replace function public.pos_submit_order(
  p_client_request_id uuid,
  p_table_id          uuid,
  p_items             jsonb,
  p_order_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id    uuid := auth.uid();
  v_existing    jsonb;
  v_order_id    uuid;
  v_batch_id    uuid := gen_random_uuid();
  v_item        jsonb;
  v_product     record;
  v_qty         integer;
  v_note        text;
  v_option_ids  uuid[];
  v_opt_total   integer;
  v_opt_snap    jsonb;
  v_unit        integer;
  v_line        integer;
  v_inserted    integer := 0;
  v_created     boolean := false;
  v_result      jsonb;
begin
  -- 1. Authentification / autorisation -------------------------------------
  if v_staff_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_active_staff() then
    raise exception 'STAFF_INACTIVE' using errcode = '42501';
  end if;

  if p_client_request_id is null then
    raise exception 'MISSING_REQUEST_ID' using errcode = '22004';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'CART_TOO_LARGE' using errcode = '22023';
  end if;

  -- 2. Verrou sur la table : serialise tous les envois concurrents visant
  --    la meme table (2 serveurs, ou le meme serveur qui double-tape).
  perform 1 from public.restaurant_tables
   where id = p_table_id and active
   for update;
  if not found then
    raise exception 'TABLE_NOT_FOUND' using errcode = '23503';
  end if;

  -- 3. Idempotence : sous le verrou, un rejeu renvoie le resultat d'origine
  --    sans rien reinserer. Protege du double-tap et du retry reseau.
  select result into v_existing
    from public.order_submissions
   where client_request_id = p_client_request_id;
  if v_existing is not null then
    return v_existing || jsonb_build_object('duplicate', true);
  end if;

  -- 4. Commande ouverte de la table, sinon creation
  select id into v_order_id
    from public.orders
   where table_id = p_table_id and status = 'open'
   for update;

  if v_order_id is null then
    insert into public.orders (table_id, opened_by, note)
    values (p_table_id, v_staff_id, nullif(trim(coalesce(p_order_note, '')), ''))
    returning id into v_order_id;
    v_created := true;
  elsif nullif(trim(coalesce(p_order_note, '')), '') is not null then
    update public.orders
       set note = concat_ws(chr(10), nullif(note, ''), trim(p_order_note))
     where id = v_order_id;
  end if;

  -- 5. Lignes : prix relus en base, jamais ceux du client
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty <= 0 or v_qty > 99 then
      raise exception 'INVALID_QUANTITY' using errcode = '22023';
    end if;

    select p.id, p.name, p.price_cents
      into v_product
      from public.products p
     where p.id = (v_item ->> 'product_id')::uuid
       and p.active and p.available;
    if not found then
      raise exception 'PRODUCT_UNAVAILABLE:%', (v_item ->> 'product_id') using errcode = '23503';
    end if;

    -- Options : seules celles reellement rattachees au produit sont acceptees
    v_option_ids := coalesce(
      (select array_agg((value #>> '{}')::uuid)
         from jsonb_array_elements(coalesce(v_item -> 'option_ids', '[]'::jsonb))),
      '{}'::uuid[]
    );

    select coalesce(sum(o.price_delta_cents), 0),
           coalesce(jsonb_agg(jsonb_build_object(
             'id', o.id, 'name', o.name, 'price_delta_cents', o.price_delta_cents
           ) order by o.sort_order, o.name), '[]'::jsonb)
      into v_opt_total, v_opt_snap
      from public.options o
      join public.product_option_groups pog on pog.group_id = o.group_id
     where o.id = any(v_option_ids)
       and pog.product_id = v_product.id
       and o.available;

    v_unit := v_product.price_cents + coalesce(v_opt_total, 0);
    v_line := v_unit * v_qty;
    v_note := nullif(trim(coalesce(v_item ->> 'note', '')), '');

    insert into public.order_items (
      order_id, batch_id, product_id, name_snapshot, base_price_cents,
      options_snapshot, unit_price_cents, quantity, line_total_cents, note, created_by
    ) values (
      v_order_id, v_batch_id, v_product.id, v_product.name, v_product.price_cents,
      coalesce(v_opt_snap, '[]'::jsonb), v_unit, v_qty, v_line, v_note, v_staff_id
    );

    v_inserted := v_inserted + 1;
  end loop;

  -- 6. Totaux recalcules cote base
  perform public.recalc_order_totals(v_order_id);

  select jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'order_id', o.id,
    'order_number', o.order_number,
    'batch_id', v_batch_id,
    'created', v_created,
    'items_added', v_inserted,
    'subtotal_cents', o.subtotal_cents,
    'total_cents', o.total_cents
  ) into v_result
  from public.orders o where o.id = v_order_id;

  -- 7. Journal d'idempotence, dans la meme transaction que les lignes
  insert into public.order_submissions (
    client_request_id, staff_id, table_id, order_id, batch_id, result
  ) values (
    p_client_request_id, v_staff_id, p_table_id, v_order_id, v_batch_id, v_result
  );

  return v_result;
end $$;

-- ============================ RPC : CLOTURE / ANNULATION =====================
create or replace function public.pos_close_order(
  p_order_id uuid,
  p_discount_cents integer default 0
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.orders;
begin
  if not public.is_active_staff() then
    raise exception 'STAFF_INACTIVE' using errcode = '42501';
  end if;
  if coalesce(p_discount_cents, 0) < 0 then
    raise exception 'INVALID_DISCOUNT' using errcode = '22023';
  end if;
  -- Une remise n'est accordable que par un manager.
  if coalesce(p_discount_cents, 0) > 0 and not public.is_manager() then
    raise exception 'DISCOUNT_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_row from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;
  if v_row.status <> 'open' then
    -- Deja cloturee : idempotent, on renvoie l'etat courant.
    return jsonb_build_object('ok', true, 'duplicate', true, 'order_id', v_row.id,
                              'status', v_row.status, 'total_cents', v_row.total_cents);
  end if;

  update public.orders
     set discount_cents = least(coalesce(p_discount_cents, 0), subtotal_cents),
         status         = 'paid',
         closed_at      = now()
   where id = p_order_id;

  perform public.recalc_order_totals(p_order_id);

  select * into v_row from public.orders where id = p_order_id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'order_id', v_row.id,
                            'status', v_row.status, 'total_cents', v_row.total_cents);
end $$;

create or replace function public.pos_cancel_order(p_order_id uuid)
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
  update public.orders set status = 'cancelled', closed_at = now() where id = p_order_id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'cancelled');
end $$;

-- Retirer une ligne deja envoyee : geste sensible, reserve au manager.
create or replace function public.pos_void_item(p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order_id uuid;
begin
  if not public.is_manager() then
    raise exception 'MANAGER_REQUIRED' using errcode = '42501';
  end if;
  select order_id into v_order_id from public.order_items where id = p_item_id;
  if v_order_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if (select status from public.orders where id = v_order_id) <> 'open' then
    raise exception 'ORDER_CLOSED' using errcode = '42501';
  end if;
  delete from public.order_items where id = p_item_id;
  perform public.recalc_order_totals(v_order_id);
  return jsonb_build_object('ok', true, 'duplicate', false, 'order_id', v_order_id);
end $$;

-- ============================ VUE : ETAT DE LA SALLE =========================
-- Une seule requete pour peindre la grille des tables (evite le N+1 mobile).
create or replace view public.table_overview
with (security_invoker = true) as
select
  t.id,
  t.label,
  t.zone,
  t.seats,
  t.sort_order,
  o.id            as order_id,
  o.order_number  as order_number,
  o.total_cents   as order_total_cents,
  o.created_at    as order_opened_at,
  o.opened_by     as order_opened_by,
  s.full_name     as order_opened_by_name,
  coalesce(i.item_count, 0)::integer as item_count
from public.restaurant_tables t
left join public.orders o on o.table_id = t.id and o.status = 'open'
left join public.staff s on s.id = o.opened_by
left join lateral (
  select sum(quantity) as item_count from public.order_items where order_id = o.id
) i on true
where t.active;

-- ============================ RLS ============================================
alter table public.staff                 enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.option_groups         enable row level security;
alter table public.options               enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.restaurant_tables     enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_submissions     enable row level security;

-- staff : chacun lit sa fiche, les managers lisent et gerent tout le monde
drop policy if exists staff_select_self on public.staff;
create policy staff_select_self on public.staff
  for select to authenticated using (id = auth.uid() or public.is_manager());

drop policy if exists staff_manage on public.staff;
create policy staff_manage on public.staff
  for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Menu : lecture pour tout staff actif, ecriture pour les managers
do $$
declare tbl text;
begin
  foreach tbl in array array['categories', 'products', 'option_groups', 'options',
                             'product_option_groups', 'restaurant_tables']
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_read', tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active_staff())',
      tbl || '_read', tbl);

    execute format('drop policy if exists %I on public.%I', tbl || '_write', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_manager()) with check (public.is_manager())',
      tbl || '_write', tbl);
  end loop;
end $$;

-- Commandes : LECTURE seule depuis le client.
-- Aucune policy insert/update/delete => toute ecriture directe est refusee.
-- Le seul chemin d'ecriture est les fonctions SECURITY DEFINER ci-dessus.
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
  for select to authenticated using (public.is_active_staff());

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items
  for select to authenticated using (public.is_active_staff());

drop policy if exists order_submissions_read on public.order_submissions;
create policy order_submissions_read on public.order_submissions
  for select to authenticated using (staff_id = auth.uid() or public.is_manager());

-- ============================ PRIVILEGES =====================================
revoke all on function public.pos_submit_order(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.pos_close_order(uuid, integer) from public, anon;
revoke all on function public.pos_cancel_order(uuid) from public, anon;
revoke all on function public.pos_void_item(uuid) from public, anon;
revoke all on function public.recalc_order_totals(uuid) from public, anon, authenticated;

grant execute on function public.pos_submit_order(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.pos_close_order(uuid, integer) to authenticated;
grant execute on function public.pos_cancel_order(uuid) to authenticated;
grant execute on function public.pos_void_item(uuid) to authenticated;

-- ============================ REALTIME =======================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.orders;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.order_items;
    exception when duplicate_object then null; end;
  end if;
end $$;
