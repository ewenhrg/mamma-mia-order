-- =============================================================================
-- MAMMA MIA — Mix 2 parfums : choix obligatoire de deux gouts
-- A executer dans Supabase > SQL Editor, APRES 0010_chicha.sql.
-- Rejouable.
-- =============================================================================

-- Lecture publique des options : le client QR peut choisir les parfums.
drop policy if exists option_groups_public_read on public.option_groups;
create policy option_groups_public_read on public.option_groups
  for select to anon using (true);

drop policy if exists options_public_read on public.options;
create policy options_public_read on public.options
  for select to anon using (available);

drop policy if exists product_option_groups_public_read on public.product_option_groups;
create policy product_option_groups_public_read on public.product_option_groups
  for select to anon using (true);

insert into public.option_groups (name, min_select, max_select, sort_order)
select 'Parfums chicha', 2, 2, 6
where not exists (select 1 from public.option_groups g where g.name = 'Parfums chicha');

update public.option_groups
   set min_select = 2, max_select = 2, sort_order = 6
 where name = 'Parfums chicha';

insert into public.options (group_id, name, price_delta_cents, sort_order, available)
select g.id, v.name, 0, v.sort_order, true
  from (values
    ('Pomme',         1),
    ('Menthe',        2),
    ('Chewing-gum',   3),
    ('Kiwi',          4),
    ('Orange',        5),
    ('Pêche',         6),
    ('Myrtille',      7),
    ('Raisin',        8),
    ('Pastèque',      9),
    ('Mangue',       10),
    ('Magic Love',   11),
    ('Cola',         12),
    ('Vanille',      13),
    ('Citron',       14),
    ('Melon',        15),
    ('Power',        16),
    ('Lotus',        17),
    ('Fraise',       18),
    ('Twist',        19)
  ) as v(name, sort_order)
  join public.option_groups g on g.name = 'Parfums chicha'
 where not exists (
   select 1 from public.options o where o.group_id = g.id and o.name = v.name
 );

update public.options o
   set available = true, price_delta_cents = 0, sort_order = v.sort_order
  from (values
    ('Pomme',         1),
    ('Menthe',        2),
    ('Chewing-gum',   3),
    ('Kiwi',          4),
    ('Orange',        5),
    ('Pêche',         6),
    ('Myrtille',      7),
    ('Raisin',        8),
    ('Pastèque',      9),
    ('Mangue',       10),
    ('Magic Love',   11),
    ('Cola',         12),
    ('Vanille',      13),
    ('Citron',       14),
    ('Melon',        15),
    ('Power',        16),
    ('Lotus',        17),
    ('Fraise',       18),
    ('Twist',        19)
  ) as v(name, sort_order)
  join public.option_groups g on g.name = 'Parfums chicha'
 where o.group_id = g.id and o.name = v.name;

insert into public.product_option_groups (product_id, group_id, sort_order)
select p.id, g.id, 1
  from public.products p
  join public.option_groups g on g.name = 'Parfums chicha'
 where p.name = 'Chicha mix 2 parfums'
on conflict (product_id, group_id) do nothing;

-- Le client QR envoie aussi les parfums choisis (snapshot figé, comme le POS).
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
  v_option_ids  uuid[];
  v_opt_total   integer;
  v_opt_snap    jsonb;
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
      options_snapshot, unit_price_cents, quantity, line_total_cents, note,
      created_by, from_guest, status, sent_at
    ) values (
      v_order_id, v_batch_id, v_product.id, v_product.name, v_product.price_cents,
      coalesce(v_opt_snap, '[]'::jsonb), v_unit, v_qty, v_line, v_note,
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

notify pgrst, 'reload schema';
