-- =============================================================================
-- MAMMA MIA — Retirer une ligne deja envoyee (admin / manager, toute table)
-- A executer dans Supabase > SQL Editor, APRES 0008_commande_demandee.sql.
-- Rejouable. Ne touche pas aux commandes existantes.
--
-- Les serveurs peuvent toujours retirer une ligne encore "demandee".
-- Une ligne deja partie en cuisine : Ewen (admin) et la caisse (manager).
-- =============================================================================

update public.staff
   set role = 'admin',
       active = true
 where lower(trim(full_name)) = 'ewen'
   and (role is distinct from 'admin' or active is not true);

create or replace function public.pos_void_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  -- Ligne deja envoyee : admin (Ewen) ou manager (caisse). Pas les serveurs.
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

notify pgrst, 'reload schema';
