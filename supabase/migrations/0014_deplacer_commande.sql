-- =============================================================================
-- MAMMA MIA — Deplacer une commande ouverte d'une table vers une autre
-- Acces admin (Ewen, et les autres comptes admin).
-- A executer dans Supabase > SQL Editor, APRES 0001.
-- Rejouable. Ne touche pas aux commandes existantes.
-- =============================================================================

create or replace function public.pos_move_order(p_order_id uuid, p_to_table_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id    uuid := auth.uid();
  v_order       public.orders;
  v_from_id     uuid;
  v_from_label  text;
  v_to_label    text;
  v_busy        uuid;
begin
  if v_staff_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.staff s
     where s.id = v_staff_id and s.active and s.role = 'admin'
  ) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if p_order_id is null or p_to_table_id is null then
    raise exception 'TABLE_NOT_FOUND' using errcode = '23503';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;
  if v_order.status <> 'open' then
    raise exception 'ORDER_CLOSED' using errcode = '42501';
  end if;

  v_from_id := v_order.table_id;
  if v_from_id = p_to_table_id then
    raise exception 'SAME_TABLE' using errcode = '22023';
  end if;

  -- Verrou dans un ordre stable : evite un deadlock si deux admins croisent
  -- deux deplacements en meme temps.
  perform 1
    from public.restaurant_tables
   where id in (v_from_id, p_to_table_id)
   order by id
     for update;

  select label into v_from_label from public.restaurant_tables where id = v_from_id;
  select label into v_to_label
    from public.restaurant_tables
   where id = p_to_table_id and active;
  if v_to_label is null then
    raise exception 'TABLE_NOT_FOUND' using errcode = '23503';
  end if;

  select id into v_busy
    from public.orders
   where table_id = p_to_table_id and status = 'open'
     for update;
  if v_busy is not null then
    raise exception 'TABLE_OCCUPIED' using errcode = '23505';
  end if;

  update public.orders
     set table_id = p_to_table_id,
         note = concat_ws(
           chr(10),
           nullif(note, ''),
           format('Deplacee de %s vers %s', coalesce(v_from_label, '?'), v_to_label)
         )
   where id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'from_table_id', v_from_id,
    'to_table_id', p_to_table_id,
    'from_label', coalesce(v_from_label, ''),
    'to_label', v_to_label
  );
end $$;

revoke all on function public.pos_move_order(uuid, uuid) from public, anon;
grant execute on function public.pos_move_order(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
