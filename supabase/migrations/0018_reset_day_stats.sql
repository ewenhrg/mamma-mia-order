-- =============================================================================
-- MAMMA MIA — Ewen peut remettre les totaux du soir a 0
-- Ne supprime aucune commande : seul le compteur affiche repart de zero.
-- A executer dans Supabase > SQL Editor, APRES 0016 et 0017.
-- Rejouable.
-- =============================================================================

create table if not exists public.stats_reset (
  id        integer primary key default 1 check (id = 1),
  reset_at  timestamptz not null default '-infinity'::timestamptz,
  reset_by  uuid references public.staff(id) on delete set null
);

insert into public.stats_reset (id) values (1)
  on conflict (id) do nothing;

alter table public.stats_reset enable row level security;

drop policy if exists stats_reset_read on public.stats_reset;
create policy stats_reset_read on public.stats_reset
  for select to authenticated
  using (public.is_active_staff());

revoke all on table public.stats_reset from public, anon;
grant select on table public.stats_reset to authenticated;

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

create or replace function public.stats_period_start()
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day   timestamptz;
  v_reset timestamptz;
begin
  v_day := date_trunc('day', timezone('Africa/Cairo', now())) at time zone 'Africa/Cairo';
  select reset_at into v_reset from public.stats_reset where id = 1;
  return greatest(v_day, coalesce(v_reset, '-infinity'::timestamptz));
end $$;

create or replace function public.pos_reset_day_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_owner() then
    raise exception 'OWNER_REQUIRED' using errcode = '42501';
  end if;

  insert into public.stats_reset (id, reset_at, reset_by)
  values (1, now(), auth.uid())
  on conflict (id) do update
    set reset_at = excluded.reset_at,
        reset_by = excluded.reset_by;

  return jsonb_build_object('ok', true, 'reset_at', now());
end $$;

create or replace function public.pos_owner_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day       timestamptz;
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

  v_day := date_trunc('day', timezone('Africa/Cairo', now())) at time zone 'Africa/Cairo';
  v_start := public.stats_period_start();
  v_end := v_day + interval '1 day';

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

create or replace function public.pos_floor_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day    timestamptz;
  v_start  timestamptz;
  v_end    timestamptz;
  v_total  integer;
  v_zones  jsonb;
begin
  if not public.is_active_staff() then
    raise exception 'STAFF_INACTIVE' using errcode = '42501';
  end if;

  v_day := date_trunc('day', timezone('Africa/Cairo', now())) at time zone 'Africa/Cairo';
  v_start := public.stats_period_start();
  v_end := v_day + interval '1 day';

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

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

revoke all on function public.stats_period_start() from public, anon;
grant execute on function public.stats_period_start() to authenticated;

revoke all on function public.pos_reset_day_stats() from public, anon;
grant execute on function public.pos_reset_day_stats() to authenticated;

revoke all on function public.pos_owner_stats() from public, anon;
grant execute on function public.pos_owner_stats() to authenticated;

revoke all on function public.pos_floor_stats() from public, anon;
grant execute on function public.pos_floor_stats() to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.stats_reset;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
