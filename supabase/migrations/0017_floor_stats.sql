-- =============================================================================
-- MAMMA MIA — Total du soir affiche en haut de la salle
-- Chaque membre du staff voit le cumul de SES tables (sa zone).
-- A executer dans Supabase > SQL Editor, APRES 0009_staff_tables.sql.
-- Rejouable. Lecture seule, ne touche pas aux commandes.
-- =============================================================================

create or replace function public.pos_floor_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start  timestamptz;
  v_end    timestamptz;
  v_total  integer;
  v_zones  jsonb;
begin
  if not public.is_active_staff() then
    raise exception 'STAFF_INACTIVE' using errcode = '42501';
  end if;

  v_start := date_trunc('day', timezone('Africa/Cairo', now())) at time zone 'Africa/Cairo';
  v_end := v_start + interval '1 day';

  select
    coalesce(sum(oi.line_total_cents), 0)::integer
    into v_total
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.restaurant_tables t on t.id = o.table_id
   where o.status <> 'cancelled'
     and public.can_see_table(t.id)
     and coalesce(oi.sent_at, oi.created_at) >= v_start
     and coalesce(oi.sent_at, oi.created_at) < v_end
     and coalesce(oi.status::text, 'sent') = 'sent';

  select coalesce(jsonb_agg(to_jsonb(r) order by r.zone_id), '[]'::jsonb)
    into v_zones
    from (
      select
        t.zone_id,
        coalesce(sum(oi.line_total_cents), 0)::integer as total_cents
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.restaurant_tables t on t.id = o.table_id
      where o.status <> 'cancelled'
        and public.can_see_table(t.id)
        and coalesce(oi.sent_at, oi.created_at) >= v_start
        and coalesce(oi.sent_at, oi.created_at) < v_end
        and coalesce(oi.status::text, 'sent') = 'sent'
      group by t.zone_id
    ) r;

  return jsonb_build_object(
    'ok', true,
    'from', v_start,
    'to', v_end,
    'total_cents', v_total,
    'zones', v_zones
  );
end $$;

revoke all on function public.pos_floor_stats() from public, anon;
grant execute on function public.pos_floor_stats() to authenticated;

notify pgrst, 'reload schema';
