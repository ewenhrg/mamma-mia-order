-- =============================================================================
-- MAMMA MIA — POS : encaissement sans liberation de table
-- A executer APRES 0002_seed.sql.
--
-- Encaisser et liberer deviennent deux gestes distincts :
--   * ENCAISSER  -> marque le paiement, la table RESTE en cours. On peut
--                   continuer a ajouter des articles ; le reste a payer
--                   apparait automatiquement.
--   * LIBERER    -> ferme la commande et rend la table disponible.
--
-- Rejouable sans risque.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Nouveau statut : 'closed' = table liberee.
--    'open' couvre desormais aussi une table encaissee mais encore occupee.
-- ---------------------------------------------------------------------------
alter type public.order_status add value if not exists 'closed';

-- ---------------------------------------------------------------------------
-- 2. Traces d'encaissement
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders
  add column if not exists paid_amount_cents integer not null default 0;
alter table public.orders add column if not exists paid_by uuid;

do $$ begin
  alter table public.orders
    add constraint orders_paid_by_fkey
    foreign key (paid_by) references public.staff(id) on delete set null;
exception when duplicate_object then null; end $$;

comment on column public.orders.paid_amount_cents is
  'Montant reellement encaisse. Si des articles sont ajoutes ensuite, '
  'total_cents repasse au-dessus et la difference est le reste a payer.';

-- ---------------------------------------------------------------------------
-- 3. ENCAISSER — ne libere pas la table
-- ---------------------------------------------------------------------------
create or replace function public.pos_mark_paid(
  p_order_id uuid,
  p_discount_cents integer default 0
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.orders;
begin
  if not public.is_active_staff() then
    raise exception 'STAFF_INACTIVE' using errcode = '42501';
  end if;
  if coalesce(p_discount_cents, 0) < 0 then
    raise exception 'INVALID_DISCOUNT' using errcode = '22023';
  end if;
  -- Une remise reste un geste de manager.
  if coalesce(p_discount_cents, 0) > 0 and not public.is_manager() then
    raise exception 'DISCOUNT_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_row from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;
  if v_row.status <> 'open' then
    raise exception 'ORDER_CLOSED' using errcode = '42501';
  end if;

  update public.orders
     set discount_cents = least(coalesce(p_discount_cents, 0), subtotal_cents)
   where id = p_order_id;

  perform public.recalc_order_totals(p_order_id);

  -- Le montant encaisse est fige APRES recalcul : c'est ce qui a ete paye.
  -- La commande reste 'open', donc la table reste occupee.
  update public.orders
     set paid_at           = now(),
         paid_by           = auth.uid(),
         paid_amount_cents = total_cents
   where id = p_order_id;

  select * into v_row from public.orders where id = p_order_id;
  return jsonb_build_object(
    'ok', true,
    'order_id', v_row.id,
    'status', v_row.status,
    'paid_at', v_row.paid_at,
    'paid_amount_cents', v_row.paid_amount_cents,
    'total_cents', v_row.total_cents,
    'remaining_cents', greatest(v_row.total_cents - v_row.paid_amount_cents, 0)
  );
end $$;

-- Annuler un encaissement (erreur de manipulation) : reserve au manager.
create or replace function public.pos_unmark_paid(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.orders;
begin
  if not public.is_manager() then
    raise exception 'MANAGER_REQUIRED' using errcode = '42501';
  end if;
  select * into v_row from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;

  update public.orders
     set paid_at = null, paid_by = null, paid_amount_cents = 0
   where id = p_order_id;

  return jsonb_build_object('ok', true, 'order_id', p_order_id, 'paid_at', null);
end $$;

-- ---------------------------------------------------------------------------
-- 4. LIBERER LA TABLE — geste explicite et separe
-- ---------------------------------------------------------------------------
create or replace function public.pos_release_table(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.orders;
begin
  if not public.is_active_staff() then
    raise exception 'STAFF_INACTIVE' using errcode = '42501';
  end if;

  select * into v_row from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = '23503';
  end if;
  if v_row.status <> 'open' then
    -- Deja liberee : idempotent, un double tap ne casse rien.
    return jsonb_build_object('ok', true, 'duplicate', true, 'status', v_row.status);
  end if;

  -- On ne libere pas une table qui n'a pas ete encaissee : ce serait perdre
  -- l'addition. Un manager peut forcer via pos_cancel_order.
  if v_row.paid_at is null then
    raise exception 'ORDER_NOT_PAID' using errcode = '42501';
  end if;
  if v_row.total_cents > v_row.paid_amount_cents then
    raise exception 'BALANCE_REMAINING' using errcode = '42501';
  end if;

  update public.orders
     set status = 'closed', closed_at = now()
   where id = p_order_id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'status', 'closed');
end $$;

-- L'ancienne fonction faisait les deux d'un coup : elle n'a plus de sens.
drop function if exists public.pos_close_order(uuid, integer);

-- ---------------------------------------------------------------------------
-- 5. Vue salle : etat de paiement visible d'un coup d'oeil
-- ---------------------------------------------------------------------------
-- La vue est reconstruite plutot que remplacee : CREATE OR REPLACE VIEW
-- n'accepte que des colonnes ajoutees en fin de liste.
--
-- Le bloc est conditionne a la presence de l'ancienne colonne "zone" : si la
-- migration 0004 a deja transforme les zones en table, c'est elle qui fait
-- foi et on ne touche a rien. Les migrations restent ainsi rejouables dans
-- n'importe quel ordre.
do $view$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'restaurant_tables'
       and column_name = 'zone'
  ) then
    drop view if exists public.table_overview;
    execute $sql$
      create view public.table_overview
      with (security_invoker = true) as
      select
        t.id,
        t.label,
        t.zone,
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
        coalesce(i.item_count, 0)::integer as item_count
      from public.restaurant_tables t
      left join public.orders o on o.table_id = t.id and o.status = 'open'
      left join public.staff s on s.id = o.opened_by
      left join lateral (
        select sum(quantity) as item_count from public.order_items where order_id = o.id
      ) i on true
      where t.active
    $sql$;
  end if;
end $view$;

-- ---------------------------------------------------------------------------
-- 6. Privileges
-- ---------------------------------------------------------------------------
revoke all on function public.pos_mark_paid(uuid, integer) from public, anon;
revoke all on function public.pos_unmark_paid(uuid) from public, anon;
revoke all on function public.pos_release_table(uuid) from public, anon;

grant execute on function public.pos_mark_paid(uuid, integer) to authenticated;
grant execute on function public.pos_unmark_paid(uuid) to authenticated;
grant execute on function public.pos_release_table(uuid) to authenticated;
