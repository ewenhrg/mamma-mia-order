-- =============================================================================
-- MAMMA MIA — POS : menu reel (nourriture + boissons)
-- Un seul bloc DO : l'editeur SQL Supabase ne coupe pas le script.
-- Rejouable. Prix en centimes : 550 EGP = 55000.
-- =============================================================================

do $menu$
begin

update public.products set active = false, available = false;
update public.categories set active = false;

insert into public.categories (name, color, sort_order, active)
select v.name, v.color, v.sort_order, true
from (values
  ('Entrées',           '#F59E0B',  1),
  ('Sandwiches',        '#B45309',  2),
  ('Pasta',             '#EA580C',  3),
  ('Plats',             '#7C2D12',  4),
  ('Pizza',             '#C8102E',  5),
  ('Desserts',          '#DB2777',  6),
  ('Pancakes',          '#EC4899',  7),
  ('Soft drinks',       '#2563EB',  8),
  ('Jus frais',         '#16A34A',  9),
  ('Smoothies',         '#0D9488', 10),
  ('Milkshakes',        '#7C3AED', 11),
  ('Cocktails frais',   '#DB2777', 12),
  ('Mojitos',           '#65A30D', 13)
) as v(name, color, sort_order)
where not exists (select 1 from public.categories c where c.name = v.name);

update public.categories c
   set color = v.color, sort_order = v.sort_order, active = true
  from (values
  ('Entrées',           '#F59E0B',  1),
  ('Sandwiches',        '#B45309',  2),
  ('Pasta',             '#EA580C',  3),
  ('Plats',             '#7C2D12',  4),
  ('Pizza',             '#C8102E',  5),
  ('Desserts',          '#DB2777',  6),
  ('Pancakes',          '#EC4899',  7),
  ('Soft drinks',       '#2563EB',  8),
  ('Jus frais',         '#16A34A',  9),
  ('Smoothies',         '#0D9488', 10),
  ('Milkshakes',        '#7C3AED', 11),
  ('Cocktails frais',   '#DB2777', 12),
  ('Mojitos',           '#65A30D', 13)
) as v(name, color, sort_order)
 where c.name = v.name;

insert into public.products (category_id, name, description, price_cents, sort_order, active, available)
select c.id, m.name, m.description, m.price_cents, m.sort_order, true, true
  from (values
  ('Entrées', 'Calamars frits',        'Calamars marinés frits, sauce sweet chili',                        55000, 1),
  ('Entrées', 'Ailes de poulet',       'Ailes croustillantes, sauce au choix',                             50000, 2),
  ('Entrées', 'Fingers de poulet',     'Filets de poulet panés et croustillants',                          40000, 3),
  ('Entrées', 'Samoussa au fromage',   'Samoussas frits, fromage et menthe fraîche',                       30000, 4),
  ('Entrées', 'Crevettes tempura',     'Crevettes tempura, sauce sweet chili',                             65000, 5),
  ('Sandwiches', 'Burger au fromage',           'Boeuf, fromage fondu, laitue, tomate, mayonnaise',        70000, 1),
  ('Sandwiches', 'Sandwich poulet frit',        'Poulet frit, fromage fondu, laitue, mayonnaise',           45000, 2),
  ('Sandwiches', 'Sandwich saumon fumé',        'Saumon fumé, câpres, oignons, laitue, pesto mayo',         90000, 3),
  ('Sandwiches', 'Wrap poulet',                 'Poulet croustillant, légumes frais, fromage',              40000, 4),
  ('Sandwiches', 'Sandwich crevettes frites',   'Crevettes frites, laitue, sauce secrète',                  78000, 5),
  ('Pasta', 'Penne arrabiata',            'Penne, sauce tomate relevée au piment',                         48000, 1),
  ('Pasta', 'Penne alfredo',              'Penne, poulet, champignons, parmesan',                          68000, 2),
  ('Pasta', 'Spaghetti bolognese',        'Spaghetti, boeuf, tomates concassées',                          68000, 3),
  ('Pasta', 'Fettuccine carbonara',       'Dinde fumée, boeuf fumé, crème',                                68000, 4),
  ('Pasta', 'Spaghetti fruits de mer',    'Crevettes, calamars, moules, saumon',                           73000, 5),
  ('Plats', 'Poulet grillé',              'Poulet grillé, sauce champignons, accompagnement au choix',     75000, 1),
  ('Plats', 'Filet de boeuf',             'Filet grillé, sauce poivre et herbes, accompagnement au choix',120000, 2),
  ('Plats', 'Grillades mixtes',           'Kofta, kebab et poulet, riz et tahini',                        120000, 3),
  ('Plats', 'Pavé de saumon',             'Saumon grillé, sauce citron, accompagnement au choix',         128000, 4),
  ('Plats', 'Fruits de mer mix',          'Poisson, saumon, calamars, moules, crevettes',                 150000, 5),
  ('Plats', 'Calamars frits mix',         'Crevettes, calamars, poisson, saumon, moules',                 100000, 6),
  ('Plats', 'Crevettes grillées',         'Crevettes grillées',                                           120000, 7),
  ('Pizza', 'Pizza margherita',           'Mozzarella, sauce tomate',                                      50000, 1),
  ('Pizza', 'Pizza salami',               'Mozzarella, salami, sauce tomate',                              68000, 2),
  ('Pizza', 'Pizza fruits de mer',        'Fruits de mer, mozzarella, sauce tomate',                       73000, 3),
  ('Pizza', 'Pizza quattro formaggi',     'Mélange de quatre fromages',                                    68000, 4),
  ('Pizza', 'Pizza poulet BBQ',           'Poulet, légumes, sauce BBQ',                                    68000, 5),
  ('Desserts', 'Cheesecake',              null,                                                            35000, 1),
  ('Desserts', 'Gâteau au chocolat',      null,                                                            35000, 2),
  ('Desserts', 'Moelleux chocolat glace', 'Moelleux au chocolat et glace',                                  37000, 3),
  ('Desserts', 'Salade de fruits',        null,                                                            30000, 4),
  ('Desserts', 'Assiette de fruits mixte', null,                                                           50000, 5),
  ('Pancakes', 'Pancake Nutella',         null,                                                            31000, 1),
  ('Pancakes', 'Pancake Nutella fruits',  null,                                                            35000, 2),
  ('Pancakes', 'Pancake Nutella nuts',    null,                                                            38000, 3),
  ('Pancakes', 'Pancake caramel',         null,                                                            30000, 4),
  ('Pancakes', 'Pancake caramel fruits',  null,                                                            35000, 5),
  ('Pancakes', 'Pancake caramel nuts',    null,                                                            38000, 6),
  ('Pancakes', 'Mini pancakes',           null,                                                            32000, 7),
  ('Soft drinks', 'Petite eau',           null,                                                             9000, 1),
  ('Soft drinks', 'Grande eau',           null,                                                            12000, 2),
  ('Soft drinks', 'Thé glacé',            null,                                                            25000, 3),
  ('Soft drinks', 'Coca-Cola',            null,                                                            24000, 4),
  ('Soft drinks', 'Fanta',                null,                                                            24000, 5),
  ('Soft drinks', 'Sprite',               null,                                                            24000, 6),
  ('Soft drinks', 'Pepsi',                null,                                                            24000, 7),
  ('Soft drinks', 'Schweppes',            null,                                                            25000, 8),
  ('Soft drinks', 'Tonic',                null,                                                            24000, 9),
  ('Soft drinks', 'Birell',               null,                                                            27000, 10),
  ('Soft drinks', 'Red Bull',             null,                                                            29500, 11),
  ('Jus frais', 'Jus mangue',             null,                                                            22000, 1),
  ('Jus frais', 'Jus fraise',             null,                                                            22000, 2),
  ('Jus frais', 'Jus goyave',             null,                                                            22000, 3),
  ('Jus frais', 'Jus orange',             null,                                                            24000, 4),
  ('Jus frais', 'Jus pastèque',           null,                                                            25000, 5),
  ('Jus frais', 'Jus melon',              null,                                                            22000, 6),
  ('Jus frais', 'Jus ananas',             null,                                                            25000, 7),
  ('Jus frais', 'Jus pêche',              null,                                                            21000, 8),
  ('Jus frais', 'Jus citron',             null,                                                            21000, 9),
  ('Jus frais', 'Jus citron menthe',      null,                                                            25000, 10),
  ('Jus frais', 'Jus avocat',             null,                                                            30000, 11),
  ('Jus frais', 'Jus pomme',              null,                                                            20000, 12),
  ('Smoothies', 'Smoothie mangue',        null,                                                            21000, 1),
  ('Smoothies', 'Smoothie fraise',        null,                                                            21000, 2),
  ('Smoothies', 'Smoothie goyave',        null,                                                            21000, 3),
  ('Smoothies', 'Smoothie pastèque',      null,                                                            24000, 4),
  ('Smoothies', 'Smoothie pêche',         null,                                                            22500, 5),
  ('Smoothies', 'Smoothie citron',        null,                                                            20000, 6),
  ('Smoothies', 'Smoothie citron menthe', null,                                                            24000, 7),
  ('Smoothies', 'Smoothie ananas',        null,                                                            26000, 8),
  ('Smoothies', 'Smoothie myrtille',      null,                                                            26000, 9),
  ('Smoothies', 'Smoothie kiwi',          null,                                                            26000, 10),
  ('Smoothies', 'Smoothie piña colada',   null,                                                            27500, 11),
  ('Smoothies', 'Smoothie mangue kiwi',   null,                                                            29000, 12),
  ('Smoothies', 'Smoothie passion',       null,                                                            30000, 13),
  ('Milkshakes', 'Milkshake mangue',      null,                                                            20000, 1),
  ('Milkshakes', 'Milkshake fraise',      null,                                                            20000, 2),
  ('Milkshakes', 'Milkshake vanille',     null,                                                            25000, 3),
  ('Milkshakes', 'Milkshake caramel',     null,                                                            20000, 4),
  ('Milkshakes', 'Milkshake chocolat',    null,                                                            20000, 5),
  ('Milkshakes', 'Milkshake Nutella',     null,                                                            28000, 6),
  ('Milkshakes', 'Milkshake Lotus',       null,                                                            29000, 7),
  ('Milkshakes', 'Milkshake pistache',    null,                                                            30000, 8),
  ('Milkshakes', 'Milkshake myrtille',    null,                                                            20000, 9),
  ('Milkshakes', 'Milkshake passion',     null,                                                            35000, 10),
  ('Milkshakes', 'Milkshake Oreo',        null,                                                            25000, 11),
  ('Cocktails frais', 'Florida',            'Fraise, mangue, goyave',                                      29000, 1),
  ('Cocktails frais', 'Vitamine C',         'Orange, kiwi, citron',                                        29500, 2),
  ('Cocktails frais', 'Hawaii',             'Ananas, kiwi, pêche',                                         32000, 3),
  ('Cocktails frais', 'Kiango',             'Kiwi, mangue, glace',                                         28000, 4),
  ('Cocktails frais', 'Montana',            'Fraise, mangue, banane',                                      28000, 5),
  ('Cocktails frais', 'Rose',               'Fraise, mangue, glace',                                       32000, 6),
  ('Cocktails frais', 'Cocktail Mamma Mia', 'Avocat, kiwi, banane, lait, miel, noix',                      35000, 7),
  ('Mojitos', 'Mojito classic',           null,                                                            25000, 1),
  ('Mojitos', 'Mojito fraise',            null,                                                            25000, 2),
  ('Mojitos', 'Mojito ananas',            null,                                                            26000, 3),
  ('Mojitos', 'Mojito pastèque',          null,                                                            25000, 4),
  ('Mojitos', 'Mojito kiwi',              null,                                                            29000, 5),
  ('Mojitos', 'Mojito passion',           null,                                                            30000, 6),
  ('Mojitos', 'Mojito cerise cola',       null,                                                            28000, 7),
  ('Mojitos', 'Mojito Blue Mountain',     null,                                                            25000, 8),
  ('Mojitos', 'Mojito Sunshine',          null,                                                            26000, 9),
  ('Mojitos', 'Mojito Scotch Mint',       null,                                                            25000, 10),
  ('Mojitos', 'Mojito Mamma Mia',         null,                                                            29000, 11)
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
  ('Entrées', 'Calamars frits',        'Calamars marinés frits, sauce sweet chili',                        55000, 1),
  ('Entrées', 'Ailes de poulet',       'Ailes croustillantes, sauce au choix',                             50000, 2),
  ('Entrées', 'Fingers de poulet',     'Filets de poulet panés et croustillants',                          40000, 3),
  ('Entrées', 'Samoussa au fromage',   'Samoussas frits, fromage et menthe fraîche',                       30000, 4),
  ('Entrées', 'Crevettes tempura',     'Crevettes tempura, sauce sweet chili',                             65000, 5),
  ('Sandwiches', 'Burger au fromage',           'Boeuf, fromage fondu, laitue, tomate, mayonnaise',        70000, 1),
  ('Sandwiches', 'Sandwich poulet frit',        'Poulet frit, fromage fondu, laitue, mayonnaise',           45000, 2),
  ('Sandwiches', 'Sandwich saumon fumé',        'Saumon fumé, câpres, oignons, laitue, pesto mayo',         90000, 3),
  ('Sandwiches', 'Wrap poulet',                 'Poulet croustillant, légumes frais, fromage',              40000, 4),
  ('Sandwiches', 'Sandwich crevettes frites',   'Crevettes frites, laitue, sauce secrète',                  78000, 5),
  ('Pasta', 'Penne arrabiata',            'Penne, sauce tomate relevée au piment',                         48000, 1),
  ('Pasta', 'Penne alfredo',              'Penne, poulet, champignons, parmesan',                          68000, 2),
  ('Pasta', 'Spaghetti bolognese',        'Spaghetti, boeuf, tomates concassées',                          68000, 3),
  ('Pasta', 'Fettuccine carbonara',       'Dinde fumée, boeuf fumé, crème',                                68000, 4),
  ('Pasta', 'Spaghetti fruits de mer',    'Crevettes, calamars, moules, saumon',                           73000, 5),
  ('Plats', 'Poulet grillé',              'Poulet grillé, sauce champignons, accompagnement au choix',     75000, 1),
  ('Plats', 'Filet de boeuf',             'Filet grillé, sauce poivre et herbes, accompagnement au choix',120000, 2),
  ('Plats', 'Grillades mixtes',           'Kofta, kebab et poulet, riz et tahini',                        120000, 3),
  ('Plats', 'Pavé de saumon',             'Saumon grillé, sauce citron, accompagnement au choix',         128000, 4),
  ('Plats', 'Fruits de mer mix',          'Poisson, saumon, calamars, moules, crevettes',                 150000, 5),
  ('Plats', 'Calamars frits mix',         'Crevettes, calamars, poisson, saumon, moules',                 100000, 6),
  ('Plats', 'Crevettes grillées',         'Crevettes grillées',                                           120000, 7),
  ('Pizza', 'Pizza margherita',           'Mozzarella, sauce tomate',                                      50000, 1),
  ('Pizza', 'Pizza salami',               'Mozzarella, salami, sauce tomate',                              68000, 2),
  ('Pizza', 'Pizza fruits de mer',        'Fruits de mer, mozzarella, sauce tomate',                       73000, 3),
  ('Pizza', 'Pizza quattro formaggi',     'Mélange de quatre fromages',                                    68000, 4),
  ('Pizza', 'Pizza poulet BBQ',           'Poulet, légumes, sauce BBQ',                                    68000, 5),
  ('Desserts', 'Cheesecake',              null,                                                            35000, 1),
  ('Desserts', 'Gâteau au chocolat',      null,                                                            35000, 2),
  ('Desserts', 'Moelleux chocolat glace', 'Moelleux au chocolat et glace',                                  37000, 3),
  ('Desserts', 'Salade de fruits',        null,                                                            30000, 4),
  ('Desserts', 'Assiette de fruits mixte', null,                                                           50000, 5),
  ('Pancakes', 'Pancake Nutella',         null,                                                            31000, 1),
  ('Pancakes', 'Pancake Nutella fruits',  null,                                                            35000, 2),
  ('Pancakes', 'Pancake Nutella nuts',    null,                                                            38000, 3),
  ('Pancakes', 'Pancake caramel',         null,                                                            30000, 4),
  ('Pancakes', 'Pancake caramel fruits',  null,                                                            35000, 5),
  ('Pancakes', 'Pancake caramel nuts',    null,                                                            38000, 6),
  ('Pancakes', 'Mini pancakes',           null,                                                            32000, 7),
  ('Soft drinks', 'Petite eau',           null,                                                             9000, 1),
  ('Soft drinks', 'Grande eau',           null,                                                            12000, 2),
  ('Soft drinks', 'Thé glacé',            null,                                                            25000, 3),
  ('Soft drinks', 'Coca-Cola',            null,                                                            24000, 4),
  ('Soft drinks', 'Fanta',                null,                                                            24000, 5),
  ('Soft drinks', 'Sprite',               null,                                                            24000, 6),
  ('Soft drinks', 'Pepsi',                null,                                                            24000, 7),
  ('Soft drinks', 'Schweppes',            null,                                                            25000, 8),
  ('Soft drinks', 'Tonic',                null,                                                            24000, 9),
  ('Soft drinks', 'Birell',               null,                                                            27000, 10),
  ('Soft drinks', 'Red Bull',             null,                                                            29500, 11),
  ('Jus frais', 'Jus mangue',             null,                                                            22000, 1),
  ('Jus frais', 'Jus fraise',             null,                                                            22000, 2),
  ('Jus frais', 'Jus goyave',             null,                                                            22000, 3),
  ('Jus frais', 'Jus orange',             null,                                                            24000, 4),
  ('Jus frais', 'Jus pastèque',           null,                                                            25000, 5),
  ('Jus frais', 'Jus melon',              null,                                                            22000, 6),
  ('Jus frais', 'Jus ananas',             null,                                                            25000, 7),
  ('Jus frais', 'Jus pêche',              null,                                                            21000, 8),
  ('Jus frais', 'Jus citron',             null,                                                            21000, 9),
  ('Jus frais', 'Jus citron menthe',      null,                                                            25000, 10),
  ('Jus frais', 'Jus avocat',             null,                                                            30000, 11),
  ('Jus frais', 'Jus pomme',              null,                                                            20000, 12),
  ('Smoothies', 'Smoothie mangue',        null,                                                            21000, 1),
  ('Smoothies', 'Smoothie fraise',        null,                                                            21000, 2),
  ('Smoothies', 'Smoothie goyave',        null,                                                            21000, 3),
  ('Smoothies', 'Smoothie pastèque',      null,                                                            24000, 4),
  ('Smoothies', 'Smoothie pêche',         null,                                                            22500, 5),
  ('Smoothies', 'Smoothie citron',        null,                                                            20000, 6),
  ('Smoothies', 'Smoothie citron menthe', null,                                                            24000, 7),
  ('Smoothies', 'Smoothie ananas',        null,                                                            26000, 8),
  ('Smoothies', 'Smoothie myrtille',      null,                                                            26000, 9),
  ('Smoothies', 'Smoothie kiwi',          null,                                                            26000, 10),
  ('Smoothies', 'Smoothie piña colada',   null,                                                            27500, 11),
  ('Smoothies', 'Smoothie mangue kiwi',   null,                                                            29000, 12),
  ('Smoothies', 'Smoothie passion',       null,                                                            30000, 13),
  ('Milkshakes', 'Milkshake mangue',      null,                                                            20000, 1),
  ('Milkshakes', 'Milkshake fraise',      null,                                                            20000, 2),
  ('Milkshakes', 'Milkshake vanille',     null,                                                            25000, 3),
  ('Milkshakes', 'Milkshake caramel',     null,                                                            20000, 4),
  ('Milkshakes', 'Milkshake chocolat',    null,                                                            20000, 5),
  ('Milkshakes', 'Milkshake Nutella',     null,                                                            28000, 6),
  ('Milkshakes', 'Milkshake Lotus',       null,                                                            29000, 7),
  ('Milkshakes', 'Milkshake pistache',    null,                                                            30000, 8),
  ('Milkshakes', 'Milkshake myrtille',    null,                                                            20000, 9),
  ('Milkshakes', 'Milkshake passion',     null,                                                            35000, 10),
  ('Milkshakes', 'Milkshake Oreo',        null,                                                            25000, 11),
  ('Cocktails frais', 'Florida',            'Fraise, mangue, goyave',                                      29000, 1),
  ('Cocktails frais', 'Vitamine C',         'Orange, kiwi, citron',                                        29500, 2),
  ('Cocktails frais', 'Hawaii',             'Ananas, kiwi, pêche',                                         32000, 3),
  ('Cocktails frais', 'Kiango',             'Kiwi, mangue, glace',                                         28000, 4),
  ('Cocktails frais', 'Montana',            'Fraise, mangue, banane',                                      28000, 5),
  ('Cocktails frais', 'Rose',               'Fraise, mangue, glace',                                       32000, 6),
  ('Cocktails frais', 'Cocktail Mamma Mia', 'Avocat, kiwi, banane, lait, miel, noix',                      35000, 7),
  ('Mojitos', 'Mojito classic',           null,                                                            25000, 1),
  ('Mojitos', 'Mojito fraise',            null,                                                            25000, 2),
  ('Mojitos', 'Mojito ananas',            null,                                                            26000, 3),
  ('Mojitos', 'Mojito pastèque',          null,                                                            25000, 4),
  ('Mojitos', 'Mojito kiwi',              null,                                                            29000, 5),
  ('Mojitos', 'Mojito passion',           null,                                                            30000, 6),
  ('Mojitos', 'Mojito cerise cola',       null,                                                            28000, 7),
  ('Mojitos', 'Mojito Blue Mountain',     null,                                                            25000, 8),
  ('Mojitos', 'Mojito Sunshine',          null,                                                            26000, 9),
  ('Mojitos', 'Mojito Scotch Mint',       null,                                                            25000, 10),
  ('Mojitos', 'Mojito Mamma Mia',         null,                                                            29000, 11)
) as m(category_name, name, description, price_cents, sort_order)
  join public.categories c on c.name = m.category_name
 where p.name = m.name and p.category_id = c.id;

insert into public.option_groups (name, min_select, max_select, sort_order)
select 'Accompagnement', 1, 1, 4
where not exists (select 1 from public.option_groups g where g.name = 'Accompagnement');

update public.option_groups
   set min_select = 1, max_select = 1
 where name = 'Accompagnement';

update public.options o
   set available = false
  from public.option_groups g
 where o.group_id = g.id and g.name = 'Accompagnement';

insert into public.options (group_id, name, price_delta_cents, sort_order, available)
select g.id, v.name, 0, v.sort_order, true
  from (values
    ('Riz',                      1),
    ('Légumes sautés',           2),
    ('Légumes grillés',          3),
    ('Purée de pommes de terre', 4),
    ('Potatoes wedges',          5)
  ) as v(name, sort_order)
  join public.option_groups g on g.name = 'Accompagnement'
 where not exists (
   select 1 from public.options o where o.group_id = g.id and o.name = v.name
 );

update public.options o
   set available = true, price_delta_cents = 0, sort_order = v.sort_order
  from (values
    ('Riz',                      1),
    ('Légumes sautés',           2),
    ('Légumes grillés',          3),
    ('Purée de pommes de terre', 4),
    ('Potatoes wedges',          5)
  ) as v(name, sort_order)
  join public.option_groups g on g.name = 'Accompagnement'
 where o.group_id = g.id and o.name = v.name;

insert into public.product_option_groups (product_id, group_id, sort_order)
select p.id, g.id, 1
  from (values
    ('Poulet grillé'),
    ('Filet de boeuf'),
    ('Pavé de saumon')
  ) as v(product_name)
  join public.products p on p.name = v.product_name
  join public.option_groups g on g.name = 'Accompagnement'
on conflict (product_id, group_id) do nothing;

insert into public.product_option_groups (product_id, group_id, sort_order)
select p.id, g.id, 2
  from public.products p
  join public.option_groups g on g.name = 'Cuisson'
 where p.name = 'Filet de boeuf'
on conflict (product_id, group_id) do nothing;

insert into public.option_groups (name, min_select, max_select, sort_order)
select 'Sauce au choix', 1, 1, 5
where not exists (select 1 from public.option_groups g where g.name = 'Sauce au choix');

insert into public.options (group_id, name, price_delta_cents, sort_order, available)
select g.id, v.name, 0, v.sort_order, true
  from (values
    ('BBQ',          1),
    ('Spicy',        2),
    ('Sweet chili',  3)
  ) as v(name, sort_order)
  join public.option_groups g on g.name = 'Sauce au choix'
 where not exists (
   select 1 from public.options o where o.group_id = g.id and o.name = v.name
 );

insert into public.product_option_groups (product_id, group_id, sort_order)
select p.id, g.id, 1
  from public.products p
  join public.option_groups g on g.name = 'Sauce au choix'
 where p.name = 'Ailes de poulet'
on conflict (product_id, group_id) do nothing;

end;
$menu$;

notify pgrst, 'reload schema';
