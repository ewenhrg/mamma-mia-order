-- =============================================================================
-- MAMMA MIA — Stats du jour, reservees a Ewen
-- A executer dans Supabase > SQL Editor, APRES 0008.
-- Rejouable. Lecture seule, ne touche pas aux commandes.
-- =============================================================================

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
     where s.id = auth.uid()
       and s.active
       and lower(trim(s.full_name)) = 'ewen'
  )
$$;

create or replace function public.pos_owner_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start     timestamptz;
  v_end       timestamptz;
  v_total     integer;
  v_qty       integer;
  v_orders    integer;
  v_tables    jsonb;
  v_cats      jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_owner() then
    raise exception 'OWNER_REQUIRED' using errcode = '42501';
  end if;

  -- Jour civil en Egypte (le service se termine souvent apres minuit UTC).
  v_start := date_trunc('day', timezone('Africa/Cairo', now())) at time zone 'Africa/Cairo';
  v_end := v_start + interval '1 day';

  select
    coalesce(sum(oi.line_total_cents), 0)::integer,
    coalesce(sum(oi.quantity), 0)::integer,
    count(distinct o.id)::integer
    into v_total, v_qty, v_orders
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where o.status <> 'cancelled'
     and coalesce(oi.sent_at, oi.created_at) >= v_start
     and coalesce(oi.sent_at, oi.created_at) < v_end
     and coalesce(oi.status::text, 'sent') = 'sent';

  select coalesce(jsonb_agg(to_jsonb(r) order by r.total_cents desc, r.label), '[]'::jsonb)
    into v_tables
    from (
      select
        t.label,
        coalesce(sum(oi.line_total_cents), 0)::integer as total_cents,
        coalesce(sum(oi.quantity), 0)::integer as item_count
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.restaurant_tables t on t.id = o.table_id
      where o.status <> 'cancelled'
        and coalesce(oi.sent_at, oi.created_at) >= v_start
        and coalesce(oi.sent_at, oi.created_at) < v_end
        and coalesce(oi.status::text, 'sent') = 'sent'
      group by t.label
    ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.total_cents desc, r.name), '[]'::jsonb)
    into v_cats
    from (
      select
        coalesce(c.name, 'Hors carte') as name,
        coalesce(sum(oi.line_total_cents), 0)::integer as total_cents,
        coalesce(sum(oi.quantity), 0)::integer as item_count
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      left join public.products p on p.id = oi.product_id
      left join public.categories c on c.id = p.category_id
      where o.status <> 'cancelled'
        and coalesce(oi.sent_at, oi.created_at) >= v_start
        and coalesce(oi.sent_at, oi.created_at) < v_end
        and coalesce(oi.status::text, 'sent') = 'sent'
      group by coalesce(c.name, 'Hors carte')
    ) r;

  return jsonb_build_object(
    'ok', true,
    'from', v_start,
    'to', v_end,
    'total_cents', v_total,
    'item_count', v_qty,
    'order_count', v_orders,
    'tables', v_tables,
    'categories', v_cats
  );
end $$;

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

revoke all on function public.pos_owner_stats() from public, anon;
grant execute on function public.pos_owner_stats() to authenticated;

notify pgrst, 'reload schema';
