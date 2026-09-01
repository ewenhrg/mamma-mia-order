-- =============================================================================
-- MAMMA MIA — Categorie Chicha (menu Shisha Corner)
-- N'archive pas le reste du menu. Rejouable.
-- Prix en centimes : 600 EGP = 60000.
-- A executer dans Supabase > SQL Editor, APRES 0006.
-- =============================================================================

do $chicha$
begin

insert into public.categories (name, color, sort_order, active)
select v.name, v.color, v.sort_order, true
from (values
  ('Chicha', '#57534E', 14)
) as v(name, color, sort_order)
where not exists (select 1 from public.categories c where c.name = v.name);

update public.categories
   set color = '#57534E', sort_order = 14, active = true
 where name = 'Chicha';

insert into public.products (category_id, name, description, price_cents, sort_order, active, available)
select c.id, m.name, m.description, m.price_cents, m.sort_order, true, true
  from (values
  ('Chicha', 'Chicha pomme',            null,                                              60000,  1),
  ('Chicha', 'Chicha menthe',           null,                                              60000,  2),
  ('Chicha', 'Chicha chewing-gum',      null,                                              60000,  3),
  ('Chicha', 'Chicha kiwi',             null,                                              60000,  4),
  ('Chicha', 'Chicha orange',           null,                                              60000,  5),
  ('Chicha', 'Chicha pêche',            null,                                              60000,  6),
  ('Chicha', 'Chicha myrtille',         null,                                              60000,  7),
  ('Chicha', 'Chicha raisin',           null,                                              60000,  8),
  ('Chicha', 'Chicha pastèque',         null,                                              60000,  9),
  ('Chicha', 'Chicha mangue',           null,                                              60000, 10),
  ('Chicha', 'Chicha Magic Love',       null,                                              60000, 11),
  ('Chicha', 'Chicha cola',             null,                                              60000, 12),
  ('Chicha', 'Chicha vanille',          null,                                              60000, 13),
  ('Chicha', 'Chicha citron',           null,                                              60000, 14),
  ('Chicha', 'Chicha melon',            null,                                              60000, 15),
  ('Chicha', 'Chicha Power',            null,                                              60000, 16),
  ('Chicha', 'Chicha Lotus',            null,                                              60000, 17),
  ('Chicha', 'Chicha fraise',           null,                                              60000, 18),
  ('Chicha', 'Chicha Twist',            null,                                              60000, 19),
  ('Chicha', 'Chicha mix 2 parfums',    'Deux parfums au choix',                            65000, 20),
  ('Chicha', 'Recharge chicha',         'Changement / recharge',                           35000, 21),
  ('Chicha', 'Chicha fruits de saison', 'Fruits frais de saison',                           70000, 22),
  ('Chicha', 'Chicha Mamma Mia',        'Edition speciale — demander au shisha man',        70000, 23)
) as m(category_name, name, description, price_cents, sort_order)
  join public.categories c on c.name = m.category_name
 where not exists (
   select 1 from public.products p
    where p.name = m.name and p.category_id = c.id
 );

update public.products p
   set description = m.description,
       price_cents = m.price_cents,
       sort_order  = m.sort_order,
       active      = true,
       available   = true
  from (values
  ('Chicha', 'Chicha pomme',            null,                                              60000,  1),
  ('Chicha', 'Chicha menthe',           null,                                              60000,  2),
  ('Chicha', 'Chicha chewing-gum',      null,                                              60000,  3),
  ('Chicha', 'Chicha kiwi',             null,                                              60000,  4),
  ('Chicha', 'Chicha orange',           null,                                              60000,  5),
  ('Chicha', 'Chicha pêche',            null,                                              60000,  6),
  ('Chicha', 'Chicha myrtille',         null,                                              60000,  7),
  ('Chicha', 'Chicha raisin',           null,                                              60000,  8),
  ('Chicha', 'Chicha pastèque',         null,                                              60000,  9),
  ('Chicha', 'Chicha mangue',           null,                                              60000, 10),
  ('Chicha', 'Chicha Magic Love',       null,                                              60000, 11),
  ('Chicha', 'Chicha cola',             null,                                              60000, 12),
  ('Chicha', 'Chicha vanille',          null,                                              60000, 13),
  ('Chicha', 'Chicha citron',           null,                                              60000, 14),
  ('Chicha', 'Chicha melon',            null,                                              60000, 15),
  ('Chicha', 'Chicha Power',            null,                                              60000, 16),
  ('Chicha', 'Chicha Lotus',            null,                                              60000, 17),
  ('Chicha', 'Chicha fraise',           null,                                              60000, 18),
  ('Chicha', 'Chicha Twist',            null,                                              60000, 19),
  ('Chicha', 'Chicha mix 2 parfums',    'Deux parfums au choix',                            65000, 20),
  ('Chicha', 'Recharge chicha',         'Changement / recharge',                           35000, 21),
  ('Chicha', 'Chicha fruits de saison', 'Fruits frais de saison',                           70000, 22),
  ('Chicha', 'Chicha Mamma Mia',        'Edition speciale — demander au shisha man',        70000, 23)
) as m(category_name, name, description, price_cents, sort_order)
  join public.categories c on c.name = m.category_name
 where p.name = m.name and p.category_id = c.id;

end $chicha$;
