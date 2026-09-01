-- =============================================================================
-- MAMMA MIA — Zones (categories de tables) assignees par serveur
-- Un admin choisit quelle zone un serveur voit dans la salle.
-- Sans ligne dans staff_zones : le serveur voit toute la salle.
-- A executer dans Supabase > SQL Editor, APRES 0008.
-- Rejouable. Remplace l'essai "staff_tables" si tu l'avais lance.
-- =============================================================================

drop function if exists public.pos_set_staff_tables(uuid, uuid[]);
drop table if exists public.staff_tables cascade;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.id = auth.uid() and s.active and s.role = 'admin'
  )
$$;

create table if not exists public.staff_zones (
  staff_id uuid not null references public.staff(id) on delete cascade,
  zone_id  uuid not null references public.zones(id) on delete cascade,
  primary key (staff_id, zone_id)
);

create index if not exists staff_zones_zone_idx on public.staff_zones (zone_id);

comment on table public.staff_zones is
  'Zones visibles par un serveur. Aucune ligne = toute la salle. Managers et admins voient toujours tout.';

create or replace function public.can_see_table(p_table_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_manager()
    or not exists (
      select 1 from public.staff_zones sz where sz.staff_id = auth.uid()
    )
    or exists (
      select 1
        from public.staff_zones sz
        join public.restaurant_tables t on t.id = p_table_id
       where sz.staff_id = auth.uid()
         and sz.zone_id = t.zone_id
    )
$$;

create or replace function public.pos_set_staff_zones(p_staff_id uuid, p_zone_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.staff_role;
  v_ids uuid[] := coalesce(p_zone_ids, '{}');
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'MANAGER_REQUIRED' using errcode = '42501';
  end if;
  if p_staff_id is null then
    raise exception 'STAFF_NOT_FOUND' using errcode = '23503';
  end if;

  select s.role into v_role from public.staff s where s.id = p_staff_id;
  if not found then
    raise exception 'STAFF_NOT_FOUND' using errcode = '23503';
  end if;
  if v_role <> 'server' then
    raise exception 'STAFF_NOT_SERVER' using errcode = '42501';
  end if;

  if cardinality(v_ids) > 0 then
    select count(*) into v_count
      from public.zones z
     where z.id = any(v_ids);
    if v_count <> cardinality((select array_agg(distinct x) from unnest(v_ids) as x)) then
      raise exception 'ZONE_NOT_FOUND' using errcode = '23503';
    end if;
  end if;

  delete from public.staff_zones where staff_id = p_staff_id;

  insert into public.staff_zones (staff_id, zone_id)
  select distinct p_staff_id, x
    from unnest(v_ids) as x;

  return jsonb_build_object(
    'ok', true,
    'zone_count', (select count(*) from public.staff_zones where staff_id = p_staff_id)
  );
end $$;

revoke all on function public.pos_set_staff_zones(uuid, uuid[]) from public;
grant execute on function public.pos_set_staff_zones(uuid, uuid[]) to authenticated;
grant execute on function public.can_see_table(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;

alter table public.staff_zones enable row level security;

drop policy if exists staff_zones_select on public.staff_zones;
create policy staff_zones_select on public.staff_zones
  for select to authenticated
  using (staff_id = auth.uid() or public.is_manager());

drop policy if exists staff_zones_admin on public.staff_zones;
create policy staff_zones_admin on public.staff_zones
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists restaurant_tables_read on public.restaurant_tables;
create policy restaurant_tables_read on public.restaurant_tables
  for select to authenticated
  using (public.can_see_table(id));

do $$ begin
  alter publication supabase_realtime add table public.staff_zones;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
