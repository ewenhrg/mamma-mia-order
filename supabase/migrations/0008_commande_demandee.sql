-- =============================================================================
-- MAMMA MIA — Commande client : etape "demandee" avant la cuisine
-- A executer dans Supabase > SQL Editor, APRES 0007_commande_client.sql.
-- Rejouable.
--
-- Avant : le QR inserait directement des lignes = deja "envoyees".
-- Apres : le client demande, le serveur voit l'onglet Demandee, valide,
--         et c'est seulement la que ca part en cuisine.
-- =============================================================================

do $$ begin
  create type public.order_item_status as enum ('requested', 'sent');
exception
  when duplicate_object then null;
end $$;

alter table public.order_items
  add column if not exists status public.order_item_status not null default 'sent';

alter table public.order_items
  add column if not exists sent_at timestamptz;

-- Lignes deja en base : elles ont ete traitees comme envoyees.
update public.order_items
   set sent_at = created_at
 where sent_at is null
   and status = 'sent';

alter table public.order_items
  alter column sent_at set default now();

create index if not exists order_items_requested_idx
  on public.order_items (order_id)
  where status = 'requested';

-- ---------------------------------------------------------------------------
-- Envoi client : status = requested, sent_at nul (pas encore en cuisine)
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
      options_snapshot, unit_price_cents, quantity, line_total_cents, note,
      created_by, from_guest, status, sent_at
    ) values (
      v_order_id, v_batch_id, v_product.id, v_product.name, v_product.price_cents,
      '[]'::jsonb, v_unit, v_qty, v_line, v_note,
      null, true, 'requested', null
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

-- ---------------------------------------------------------------------------
-- Validation serveur : les lignes demandees passent en cuisine (un seul bon)
-- ---------------------------------------------------------------------------
create or replace function public.pos_accept_guest_items(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_order    public.orders;
  v_batch_id uuid := gen_random_uuid();
  v_count    integer;
begin
  if v_staff_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_active_staff() then
    raise exception 'STAFF_INACTIVE' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;
  if v_order.status <> 'open' then
    raise exception 'ORDER_CLOSED' using errcode = '42501';
  end if;

  update public.order_items
     set status   = 'sent',
         batch_id = v_batch_id,
         sent_at  = now()
   where order_id = p_order_id
     and status = 'requested';

  get diagnostics v_count = row_count;
  if v_count = 0 then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'batch_id', v_batch_id,
      'items_accepted', 0
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'batch_id', v_batch_id,
    'items_accepted', v_count
  );
end $$;

revoke all on function public.pos_accept_guest_items(uuid) from public, anon;
grant execute on function public.pos_accept_guest_items(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Annuler une ligne demandee : n'importe quel serveur.
-- Annuler une ligne deja envoyee : toujours reserve au manager.
-- ---------------------------------------------------------------------------
create or replace function public.pos_void_item(p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_status   public.order_item_status;
begin
  if not public.is_active_staff() then
    raise exception 'STAFF_INACTIVE' using errcode = '42501';
  end if;

  select order_id, status into v_order_id, v_status
    from public.order_items
   where id = p_item_id;
  if v_order_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if v_status is distinct from 'requested' and not public.is_manager() then
    raise exception 'MANAGER_REQUIRED' using errcode = '42501';
  end if;

  if (select status from public.orders where id = v_order_id) <> 'open' then
    raise exception 'ORDER_CLOSED' using errcode = '42501';
  end if;

  delete from public.order_items where id = p_item_id;
  perform public.recalc_order_totals(v_order_id);
  return jsonb_build_object('ok', true, 'duplicate', false, 'order_id', v_order_id);
end $$;

revoke all on function public.pos_void_item(uuid) from public, anon;
grant execute on function public.pos_void_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Vue salle : nombre d'articles encore a valider (alerte sur la carte)
-- ---------------------------------------------------------------------------
drop view if exists public.table_overview;
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
  coalesce(i.item_count, 0)::integer as item_count,
  coalesce(i.requested_count, 0)::integer as requested_count
from public.restaurant_tables t
join public.zones z on z.id = t.zone_id
left join public.orders o on o.table_id = t.id and o.status = 'open'
left join public.staff s on s.id = o.opened_by
left join lateral (
  select
    sum(quantity) as item_count,
    sum(quantity) filter (where status = 'requested') as requested_count
  from public.order_items
  where order_id = o.id
) i on true
where t.active;

grant select on public.table_overview to authenticated;

notify pgrst, 'reload schema';
