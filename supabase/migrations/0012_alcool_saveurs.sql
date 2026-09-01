-- =============================================================================
-- MAMMA MIA — V1/V2 Mojito et Jus : choix du gout
-- A executer dans Supabase > SQL Editor, APRES 0011_chicha_mix.sql.
-- Rejouable.
--
-- Au clic sur V1/V2 MOJITO : tous les gouts de la page Mojitos.
-- Au clic sur V1/V2 JUICE (ou JUS) : tous les gouts de la page Jus frais.
-- =============================================================================

insert into public.option_groups (name, min_select, max_select, sort_order)
select v.name, 1, 1, v.sort_order
  from (values
    ('Parfums mojito', 7),
    ('Parfums jus',    8)
  ) as v(name, sort_order)
 where not exists (select 1 from public.option_groups g where g.name = v.name);

update public.option_groups
   set min_select = 1, max_select = 1, sort_order = 7
 where name = 'Parfums mojito';

update public.option_groups
   set min_select = 1, max_select = 1, sort_order = 8
 where name = 'Parfums jus';

-- Gouts = produits actifs de la page Mojitos (noms identiques).
insert into public.options (group_id, name, price_delta_cents, sort_order, available)
select g.id, p.name, 0, p.sort_order, true
  from public.products p
  join public.categories c on c.id = p.category_id
  join public.option_groups g on g.name = 'Parfums mojito'
 where c.name = 'Mojitos'
   and p.active
   and not exists (
     select 1 from public.options o where o.group_id = g.id and o.name = p.name
   );

update public.options o
   set available = p.available, price_delta_cents = 0, sort_order = p.sort_order
  from public.products p
  join public.categories c on c.id = p.category_id
  join public.option_groups g on g.name = 'Parfums mojito'
 where o.group_id = g.id
   and o.name = p.name
   and c.name = 'Mojitos';

-- Gouts = produits actifs de la page Jus frais.
insert into public.options (group_id, name, price_delta_cents, sort_order, available)
select g.id, p.name, 0, p.sort_order, true
  from public.products p
  join public.categories c on c.id = p.category_id
  join public.option_groups g on g.name = 'Parfums jus'
 where c.name = 'Jus frais'
   and p.active
   and not exists (
     select 1 from public.options o where o.group_id = g.id and o.name = p.name
   );

update public.options o
   set available = p.available, price_delta_cents = 0, sort_order = p.sort_order
  from public.products p
  join public.categories c on c.id = p.category_id
  join public.option_groups g on g.name = 'Parfums jus'
 where o.group_id = g.id
   and o.name = p.name
   and c.name = 'Jus frais';

-- V1 / V2 Mojito (quel que soit le casing ou l'ordre des mots).
insert into public.product_option_groups (product_id, group_id, sort_order)
select p.id, g.id, 1
  from public.products p
  join public.option_groups g on g.name = 'Parfums mojito'
 where p.name ~* 'v[[:space:]]*[12]'
   and p.name ~* 'mojito'
on conflict (product_id, group_id) do nothing;

-- V1 / V2 Juice ou Jus.
insert into public.product_option_groups (product_id, group_id, sort_order)
select p.id, g.id, 1
  from public.products p
  join public.option_groups g on g.name = 'Parfums jus'
 where p.name ~* 'v[[:space:]]*[12]'
   and p.name ~* 'juice|\yjus\y'
on conflict (product_id, group_id) do nothing;
