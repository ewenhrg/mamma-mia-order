-- =============================================================================
-- MAMMA MIA — Ligne hors carte (serveur uniquement)
-- A executer dans Supabase > SQL Editor, APRES 0001.
-- Rejouable. Ne touche pas aux commandes existantes.
--
-- Le serveur peut envoyer un article qui n'est pas au menu : nom seulement.
-- Le prix n'est pas enregistre : il se regle a la caisse.
-- Le client QR (guest_submit_order) n'a pas ce droit.
-- =============================================================================

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
  v_staff_id          uuid := auth.uid();
  v_existing          jsonb;
  v_order_id          uuid;
  v_batch_id          uuid := gen_random_uuid();
  v_item              jsonb;
  v_product           record;
  v_qty               integer;
  v_note              text;
  v_option_ids        uuid[];
  v_opt_total         integer;
  v_opt_snap          jsonb;
  v_unit              integer;
  v_line              integer;
  v_inserted          integer := 0;
  v_created           boolean := false;
  v_result            jsonb;
  v_product_id_text   text;
  v_custom_name       text;
begin
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

  perform 1 from public.restaurant_tables
   where id = p_table_id and active
   for update;
  if not found then
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

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty <= 0 or v_qty > 99 then
      raise exception 'INVALID_QUANTITY' using errcode = '22023';
    end if;

    v_product_id_text := nullif(trim(coalesce(v_item ->> 'product_id', '')), '');
    v_note := nullif(trim(coalesce(v_item ->> 'note', '')), '');

    -- Hors carte : pas de product_id, nom seulement. Prix = 0 (caisse).
    if v_product_id_text is null then
      v_custom_name := left(trim(coalesce(v_item ->> 'custom_name', '')), 80);
      if v_custom_name is null or length(v_custom_name) < 1 then
        raise exception 'INVALID_CUSTOM' using errcode = '22023';
      end if;

      insert into public.order_items (
        order_id, batch_id, product_id, name_snapshot, base_price_cents,
        options_snapshot, unit_price_cents, quantity, line_total_cents, note, created_by
      ) values (
        v_order_id, v_batch_id, null, v_custom_name, 0,
        jsonb_build_array(jsonb_build_object(
          'id', 'custom', 'name', 'Hors carte', 'price_delta_cents', 0
        )),
        0, v_qty, 0, v_note, v_staff_id
      );

      v_inserted := v_inserted + 1;
      continue;
    end if;

    select p.id, p.name, p.price_cents
      into v_product
      from public.products p
     where p.id = v_product_id_text::uuid
       and p.active and p.available;
    if not found then
      raise exception 'PRODUCT_UNAVAILABLE:%', v_product_id_text using errcode = '23503';
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

    insert into public.order_items (
      order_id, batch_id, product_id, name_snapshot, base_price_cents,
      options_snapshot, unit_price_cents, quantity, line_total_cents, note, created_by
    ) values (
      v_order_id, v_batch_id, v_product.id, v_product.name, v_product.price_cents,
      coalesce(v_opt_snap, '[]'::jsonb), v_unit, v_qty, v_line, v_note, v_staff_id
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
    p_client_request_id, v_staff_id, p_table_id, v_order_id, v_batch_id, v_result
  );

  return v_result;
end $$;

revoke all on function public.pos_submit_order(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.pos_submit_order(uuid, uuid, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
