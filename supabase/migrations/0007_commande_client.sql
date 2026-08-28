-- =============================================================================
-- MAMMA MIA — Commande client par QR
-- A executer dans Supabase > SQL Editor, APRES 0004 (et 0006 si deja en place).
-- Rejouable.
-- =============================================================================

-- Token secret par table : le QR pointe vers /t/<token>, pas vers l'id interne.
alter table public.restaurant_tables
  add column if not exists guest_token text;

update public.restaurant_tables
   set guest_token = replace(gen_random_uuid()::text, '-', '')
 where guest_token is null;

alter table public.restaurant_tables
  alter column guest_token set default replace(gen_random_uuid()::text, '-', '');

alter table public.restaurant_tables
  alter column guest_token set not null;

create unique index if not exists restaurant_tables_guest_token_uidx
  on public.restaurant_tables (guest_token);

-- Marque les lignes venues du telephone du client.
alter table public.order_items
  add column if not exists from_guest boolean not null default false;

-- ---------------------------------------------------------------------------
-- Lecture publique du menu (uniquement ce qui est actif)
-- ---------------------------------------------------------------------------
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select to anon using (active);

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon using (active);

-- ---------------------------------------------------------------------------
-- Resoudre une table a partir du token QR, sans reveler les autres
-- ---------------------------------------------------------------------------
create or replace function public.guest_resolve_table(p_token text)
returns table(id uuid, label text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.label
    from public.restaurant_tables t
   where t.guest_token = p_token
     and t.active
   limit 1
$$;

revoke all on function public.guest_resolve_table(text) from public, authenticated;
grant execute on function public.guest_resolve_table(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Envoi client : memes prix relus en base, sans session staff.
-- Les lignes rejoignent la commande ouverte de la table (ou en creent une).
-- ---------------------------------------------------------------------------
create or replace function public.guest_submit_order(
  p_table_token       text,
  p_client_request_id uuid,
  p_items             jsonb,
  p_order_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id    uuid;
  v_existing    jsonb;
  v_order_id    uuid;
  v_batch_id    uuid := gen_random_uuid();
  v_item        jsonb;
  v_product     record;
  v_qty         integer;
  v_note        text;
  v_unit        integer;
  v_line        integer;
  v_inserted    integer := 0;
  v_created     boolean := false;
  v_result      jsonb;
  v_guest_note  text;
begin
  if p_table_token is null or length(trim(p_table_token)) < 8 then
    raise exception 'TABLE_NOT_FOUND' using errcode = '23503';
  end if;
  if p_client_request_id is null then
    raise exception 'MISSING_REQUEST_ID' using errcode = '22004';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 40 then
    raise exception 'CART_TOO_LARGE' using errcode = '22023';
  end if;

  select t.id into v_table_id
    from public.restaurant_tables t
   where t.guest_token = p_table_token and t.active
   for update;
  if v_table_id is null then
    raise exception 'TABLE_NOT_FOUND' using errcode = '23503';
  end if;

  select result into v_existing
    from public.order_submissions
   where client_request_id = p_client_request_id;
  if v_existing is not null then
    return v_existing || jsonb_build_object('duplicate', true);
  end if;

  select id into v_order_id
    from public.orders
   where table_id = v_table_id and status = 'open'
   for update;

  v_guest_note := nullif(trim(coalesce(p_order_note, '')), '');

  if v_order_id is null then
    insert into public.orders (table_id, opened_by, note)
    values (v_table_id, null, concat_ws(chr(10), 'Commande client', v_guest_note))
    returning id into v_order_id;
    v_created := true;
  elsif v_guest_note is not null then
    update public.orders
       set note = concat_ws(chr(10), nullif(note, ''), 'Client : ' || v_guest_note)
     where id = v_order_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty <= 0 or v_qty > 20 then
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

    v_unit := v_product.price_cents;
    v_line := v_unit * v_qty;
    v_note := nullif(trim(coalesce(v_item ->> 'note', '')), '');

    insert into public.order_items (
      order_id, batch_id, product_id, name_snapshot, base_price_cents,
      options_snapshot, unit_price_cents, quantity, line_total_cents, note, created_by, from_guest
    ) values (
      v_order_id, v_batch_id, v_product.id, v_product.name, v_product.price_cents,
      '[]'::jsonb, v_unit, v_qty, v_line, v_note, null, true
    );

    v_inserted := v_inserted + 1;
  end loop;

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

  insert into public.order_submissions (
    client_request_id, staff_id, table_id, order_id, batch_id, result
  ) values (
    p_client_request_id, null, v_table_id, v_order_id, v_batch_id, v_result
  );

  return v_result;
end $$;

revoke all on function public.guest_submit_order(text, uuid, jsonb, text) from public;
grant execute on function public.guest_submit_order(text, uuid, jsonb, text) to anon, authenticated;

notify pgrst, 'reload schema';
