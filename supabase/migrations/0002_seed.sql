-- =============================================================================
-- MAMMA MIA — POS : donnees de demarrage
-- A executer APRES 0001_init.sql.
-- Rejouable : n'ecrase et ne supprime aucune donnee existante.
-- Le vrai menu sera saisi depuis /admin (ou en remplacant ce fichier).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES DE SALLE
-- ---------------------------------------------------------------------------
insert into public.restaurant_tables (label, zone, seats, sort_order)
select v.label, v.zone::public.table_zone, v.seats, v.sort_order
from (values
  ('1',  'RESTAURANT', 4,  1),  ('2',  'RESTAURANT', 4,  2),
  ('3',  'RESTAURANT', 4,  3),  ('4',  'RESTAURANT', 2,  4),
  ('5',  'RESTAURANT', 2,  5),  ('6',  'RESTAURANT', 6,  6),
  ('7',  'RESTAURANT', 6,  7),  ('8',  'RESTAURANT', 4,  8),
  ('9',  'TERRASSE',   4,  9),  ('10', 'TERRASSE',   4, 10),
  ('11', 'TERRASSE',   2, 11),  ('12', 'TERRASSE',   6, 12),
  ('13', 'TERRASSE',   4, 13),  ('14', 'TERRASSE',   4, 14),
  ('B1', 'PLAGE',      4, 15),  ('B2', 'PLAGE',      4, 16),
  ('B3', 'PLAGE',      4, 17),  ('B4', 'PLAGE',      6, 18),
  ('B5', 'PLAGE',      6, 19),  ('B6', 'PLAGE',      2, 20),
  ('BAR 1', 'BAR',     2, 21),  ('BAR 2', 'BAR',     2, 22),
  ('VIP 1', 'VIP',     8, 23),  ('VIP 2', 'VIP',     8, 24)
) as v(label, zone, seats, sort_order)
where not exists (select 1 from public.restaurant_tables t where t.label = v.label);

-- ---------------------------------------------------------------------------
-- 2. CATEGORIES (structure du menu — remplir les produits depuis /admin)
-- ---------------------------------------------------------------------------
insert into public.categories (name, color, sort_order)
select v.name, v.color, v.sort_order
from (values
  ('Starters', '#F59E0B', 1),
  ('Pizza',    '#C8102E', 2),
  ('Pasta',    '#EA580C', 3),
  ('Grill',    '#7C2D12', 4),
  ('Seafood',  '#0891B2', 5),
  ('Burgers',  '#B45309', 6),
  ('Drinks',   '#2563EB', 7),
  ('Juice',    '#16A34A', 8),
  ('Shisha',   '#7C3AED', 9),
  ('Dessert',  '#DB2777', 10)
) as v(name, color, sort_order)
where not exists (select 1 from public.categories c where c.name = v.name);

-- ---------------------------------------------------------------------------
-- 3. GROUPES D'OPTIONS reutilisables
-- ---------------------------------------------------------------------------
insert into public.option_groups (name, min_select, max_select, sort_order)
select v.name, v.min_select, v.max_select, v.sort_order
from (values
  ('Cuisson',      1, 1, 1),   -- choix unique obligatoire
  ('Supplements',  0, 0, 2),   -- multi, illimite
  ('Sauce',        0, 2, 3),
  ('Accompagnement', 1, 1, 4)
) as v(name, min_select, max_select, sort_order)
where not exists (select 1 from public.option_groups g where g.name = v.name);

insert into public.options (group_id, name, price_delta_cents, sort_order)
select g.id, v.name, v.price_delta_cents, v.sort_order
from (values
  ('Cuisson',        'Bleu',            0,    1),
  ('Cuisson',        'Saignant',        0,    2),
  ('Cuisson',        'A point',         0,    3),
  ('Cuisson',        'Bien cuit',       0,    4),
  ('Supplements',    'Cheese',          2000, 1),
  ('Supplements',    'Bacon',           3000, 2),
  ('Supplements',    'Egg',             1500, 3),
  ('Supplements',    'Extra sauce',     1000, 4),
  ('Sauce',          'Ketchup',         0,    1),
  ('Sauce',          'Mayo',            0,    2),
  ('Sauce',          'BBQ',             0,    3),
  ('Sauce',          'Spicy',           0,    4),
  ('Accompagnement', 'Fries',           0,    1),
  ('Accompagnement', 'Salad',           0,    2),
  ('Accompagnement', 'Rice',            0,    3),
  ('Accompagnement', 'Grilled veggies', 1000, 4)
) as v(group_name, name, price_delta_cents, sort_order)
join public.option_groups g on g.name = v.group_name
where not exists (
  select 1 from public.options o where o.group_id = g.id and o.name = v.name
);

-- ---------------------------------------------------------------------------
-- 4. QUELQUES PRODUITS DE TEST (prix en centimes : 12000 = 120.00 EGP)
--    A remplacer par le vrai menu.
-- ---------------------------------------------------------------------------
insert into public.products (category_id, name, price_cents, sort_order)
select c.id, v.name, v.price_cents, v.sort_order
from (values
  ('Starters', 'Bruschetta',        8000,  1),
  ('Starters', 'Garlic Bread',      6000,  2),
  ('Starters', 'Calamari',          15000, 3),
  ('Pizza',    'Margherita',        14000, 1),
  ('Pizza',    'Pepperoni',         17000, 2),
  ('Pizza',    'Quattro Formaggi',  19000, 3),
  ('Pasta',    'Spaghetti Bolognese', 16000, 1),
  ('Pasta',    'Penne Arrabbiata',  14000, 2),
  ('Grill',    'Mixed Grill',       32000, 1),
  ('Grill',    'Beef Steak',        38000, 2),
  ('Burgers',  'Classic Burger',    12000, 1),
  ('Burgers',  'Cheese Burger',     14000, 2),
  ('Seafood',  'Grilled Shrimps',   29000, 1),
  ('Drinks',   'Coca-Cola',         3500,  1),
  ('Drinks',   'Sprite',            3500,  2),
  ('Drinks',   'Water 0.5L',        2000,  3),
  ('Drinks',   'Espresso',          4000,  4),
  ('Drinks',   'Stella Beer',       6000,  5),
  ('Juice',    'Fresh Orange',      5500,  1),
  ('Juice',    'Fresh Mango',       6000,  2),
  ('Juice',    'Lemon Mint',        5500,  3),
  ('Shisha',   'Shisha Classic',    12000, 1),
  ('Shisha',   'Shisha Premium',    18000, 2),
  ('Dessert',  'Tiramisu',          9000,  1),
  ('Dessert',  'Ice Cream',         6000,  2)
) as v(category_name, name, price_cents, sort_order)
join public.categories c on c.name = v.category_name
where not exists (
  select 1 from public.products p where p.name = v.name and p.category_id = c.id
);

-- Rattachement des groupes d'options aux produits concernes
insert into public.product_option_groups (product_id, group_id, sort_order)
select p.id, g.id, v.sort_order
from (values
  ('Classic Burger', 'Supplements',    1),
  ('Classic Burger', 'Sauce',          2),
  ('Classic Burger', 'Accompagnement', 3),
  ('Cheese Burger',  'Supplements',    1),
  ('Cheese Burger',  'Sauce',          2),
  ('Cheese Burger',  'Accompagnement', 3),
  ('Beef Steak',     'Cuisson',        1),
  ('Beef Steak',     'Accompagnement', 2),
  ('Beef Steak',     'Sauce',          3),
  ('Mixed Grill',    'Accompagnement', 1),
  ('Mixed Grill',    'Sauce',          2)
) as v(product_name, group_name, sort_order)
join public.products p on p.name = v.product_name
join public.option_groups g on g.name = v.group_name
on conflict (product_id, group_id) do nothing;

-- =============================================================================
-- 5. BOOTSTRAP ADMIN
-- -----------------------------------------------------------------------------
-- Les comptes crees sont INACTIFS par defaut (voir 0001). Apres avoir cree
-- ton compte dans Supabase > Authentication > Users, execute :
--
--   update public.staff s
--      set role = 'admin', active = true, full_name = 'Ton Nom'
--     from auth.users u
--    where u.id = s.id and u.email = 'ton.email@exemple.com';
--
-- Ensuite tous les autres serveurs s'activent depuis /admin/staff.
-- =============================================================================
