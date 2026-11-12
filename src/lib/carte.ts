/**
 * Carte "Menu Jour" (A3 recto-verso, novembre 2026).
 * Noms et prix recopies a l'identique du PDF imprime : toute modification
 * de prix doit etre faite ici ET sur la carte papier.
 * Prix en livres egyptiennes entieres, hors taxe (TAX CHARGE +14%).
 */

export const CARTE_TAX_RATE = 0.14;

export type CarteChoice = {
  /** Libelle de la question, ex. "Flavour". */
  label: string;
  options: string[];
  min: number;
  max: number;
};

export type CarteItem = {
  id: string;
  name: string;
  price: number;
  desc?: string;
  choice?: CarteChoice;
};

export type CarteGroup = 'drinks' | 'food';

export type CarteCategory = {
  id: string;
  group: CarteGroup;
  title: { fr: string; en: string };
  subtitle?: string;
  items: CarteItem[];
  extras?: { title: string; items: CarteItem[] };
  note?: string;
};

const ICE_CREAM_FLAVOURS = ['Vanilla', 'Chocolate', 'Mango', 'Strawberry'];
const MAIN_SIDES_CHOICE: CarteChoice = {
  label: 'Sides (choose two)',
  options: ['Rice', 'Sauteed vegetables', 'Grilled vegetables', 'Mashed potatoes', 'Potato wedges'],
  min: 1,
  max: 2,
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type ItemInput = [name: string, price: number, desc?: string, choice?: CarteChoice];

function category(
  id: string,
  group: CarteGroup,
  title: { fr: string; en: string },
  items: ItemInput[],
  extra: Omit<CarteCategory, 'id' | 'group' | 'title' | 'items' | 'extras'> & {
    extras?: { title: string; items: ItemInput[] };
  } = {},
): CarteCategory {
  const build = (prefix: string) => ([name, price, desc, choice]: ItemInput): CarteItem => ({
    id: `${prefix}-${slug(name)}`,
    name,
    price,
    ...(desc ? { desc } : {}),
    ...(choice ? { choice } : {}),
  });
  const { extras, ...rest } = extra;
  return {
    id,
    group,
    title,
    items: items.map(build(id)),
    ...(extras ? { extras: { title: extras.title, items: extras.items.map(build(`${id}-extra`)) } } : {}),
    ...rest,
  };
}

const one = (label: string, options: string[]): CarteChoice => ({ label, options, min: 1, max: 1 });

export const CARTE: CarteCategory[] = [
  // ------------------------------------------------------------- DRINKS
  category('coffee', 'drinks', { fr: 'Cafés', en: 'Coffee' }, [
    ['Turkish Coffee', 85],
    ['French Coffee', 110],
    ['Nutella/ Hazelnut Coffee', 125, undefined, one('Flavour', ['Nutella', 'Hazelnut'])],
    ['Espresso', 90],
    ['Espresso Double', 110],
    ['Espresso Macchiato', 100],
    ['Cortado', 100],
    ['Spanish Latte', 130],
    ['Macchiato Caramel', 110],
    ['Cappuccino', 110],
    ['Coffee Latte', 110],
    ['Nescafe Black', 90],
    ['Nescafé With Milk', 110],
    ['Americano', 110],
    ['Mocha Black or White', 135, undefined, one('Mocha', ['Black', 'White'])],
  ], { subtitle: 'Hot Drinks' }),
  category('tea', 'drinks', { fr: 'Thés', en: 'Tea' }, [
    ['Black Tea', 70],
    ['Herbal Tea', 70],
    ['Fruit Tea', 90],
    ['Tea Pot', 200],
  ], { subtitle: 'Hot Drinks' }),
  category('hot-mix', 'drinks', { fr: 'Boissons chaudes', en: 'Hot Mix' }, [
    ['Hot Cider', 110],
    ['Sahlab Nuts, Fruits or Flavor', 110, undefined, one('Sahlab', ['Nuts', 'Fruits', 'Flavor'])],
    ['Hot Chocolate', 120],
  ], { subtitle: 'Hot Drinks' }),
  category('iced-coffee', 'drinks', { fr: 'Cafés glacés', en: 'Iced Coffee' }, [
    ['Iced Coffee', 130],
    ['Iced Mocca', 150],
    ['Iced Frappe', 165],
    ['Iced Americano', 130],
    ['Iced Chocolate', 130],
  ], { subtitle: 'Cold Drinks' }),
  category('soft', 'drinks', { fr: 'Softs', en: 'Soft Drinks' }, [
    ['Small Water', 40],
    ['Large Water', 60],
    ['Ice tea', 100],
    ['Cola Fanta Pepsi Sprite', 100, undefined, one('Drink', ['Cola', 'Fanta', 'Pepsi', 'Sprite'])],
    ['Schweppes', 100],
    ['Tonic', 100],
    ['Soda', 100],
    ['Birell', 100],
    ['Red Bull', 200],
  ]),
  category('juices', 'drinks', { fr: 'Jus frais', en: 'Fresh Juices' }, [
    ['Mango', 150],
    ['Strawberry', 130],
    ['Guava', 120],
    ['Orange', 130],
    ['Watermelon', 130],
    ['Cantaloup', 130],
    ['Pineapple', 140],
    ['Peach', 130],
    ['Lemon', 120],
    ['Lemon Mint', 130],
    ['Avocado', 200],
    ['Apple', 130],
  ]),
  category('smoothies', 'drinks', { fr: 'Smoothies', en: 'Smoothies' }, [
    ['Mango', 160],
    ['Strawberry', 140],
    ['Guava', 130],
    ['Watermelon', 140],
    ['Peach', 140],
    ['Lemon', 130],
    ['Lemon Mint', 140],
    ['Pineapple', 150],
    ['Blueberry', 140],
    ['Kiwi', 160],
    ['Pina Colada', 140],
    ['Mango Kiwi', 160],
    ['Passion Fruit', 150],
  ]),
  category('milkshakes', 'drinks', { fr: 'Milkshakes', en: 'Milkshakes' }, [
    ['Mango', 200],
    ['Strawberry', 200],
    ['Vanilla', 200],
    ['Caramel', 200],
    ['Chocolate', 200],
    ['Nutella', 250],
    ['Lotus', 250],
    ['Pistaccio', 250],
    ['Blueberry', 200],
    ['Passion Fruit', 250],
    ['Oreo', 250],
  ]),
  category('cocktails', 'drinks', { fr: 'Cocktails de fruits', en: 'Fresh Cocktails' }, [
    ['Florida', 150, 'Strawberry Mango Guava'],
    ['Vitamin C', 150, 'Orange Kiwi Lemon'],
    ['Hawaii', 150, 'Pineapple Kiwi Peach'],
    ['Kiango', 150, 'Kiwi Mango Banana'],
    ['Montana', 150, 'Strawberry Mango Banana'],
    ['Rose', 150, 'Strawberry Mango Ice Cream'],
    ['Mama Mia', 250, 'Avocado Kiwi Banana Milk Honey Nuts'],
  ]),
  category('mojitos', 'drinks', { fr: 'Mojitos', en: 'Mojitos' }, [
    ['Classic', 150],
    ['Strawberry', 200],
    ['Pineapple', 200],
    ['Watermelon', 200],
    ['Kiwi', 200],
    ['Passion Fruit', 200],
    ['Cherry Cola', 200],
    ['Blue Mountain', 200],
    ['Sunshine', 200],
    ['Scotch Mint', 200],
    ['Mamma Mia', 250],
  ]),
  category('ice-cream', 'drinks', { fr: 'Glaces', en: 'Ice Cream' }, [
    ['1 Scoop', 75, undefined, { label: 'Flavour', options: ICE_CREAM_FLAVOURS, min: 1, max: 1 }],
    ['2 Scoops', 150, undefined, { label: 'Flavours', options: ICE_CREAM_FLAVOURS, min: 1, max: 2 }],
    ['3 Scoops', 175, undefined, { label: 'Flavours', options: ICE_CREAM_FLAVOURS, min: 1, max: 3 }],
    ['Mamma Mia Ice Cream', 200, 'Chocolate, Sauce and 2 scoops', { label: 'Flavours', options: ICE_CREAM_FLAVOURS, min: 1, max: 2 }],
  ], { note: 'Choice: Vanilla - Chocolate - Mango - Strawberry' }),

  // --------------------------------------------------------------- FOOD
  category('breakfast', 'food', { fr: 'Petit-déjeuner', en: 'Breakfast' }, [
    ['Oriental Breakfast', 300, 'A selection of authentic dishes: Fava Beans - Falafel - 2 Eggs - Cheese with Tomatoes - Bread'],
    ['English Breakfast', 380, 'Eggs - Salami - Beans - Cheese - Butter - Honey - Jam - Toast'],
    ['French Breakfast', 430, '2 Croissants - Butter - Honey - Jam - Drink (Orange Juice, Black Coffee or Hot Chocolate)', one('Drink', ['Orange Juice', 'Black Coffee', 'Hot Chocolate'])],
    ['Extras', 100, 'Mixed Cheese or Tahini or Baba Ghanoush or Pickled Eggplant', one('Extra', ['Mixed Cheese', 'Tahini', 'Baba Ghanoush', 'Pickled Eggplant'])],
  ], { subtitle: '8h – 12h' }),
  category('starters', 'food', { fr: 'Entrées', en: 'Starters' }, [
    ['Cold Mezze', 150, 'Tahini or Baba Ghanoush or Tabbouleh', one('Mezze', ['Tahini', 'Baba Ghanoush', 'Tabbouleh'])],
    ['Cheese Samosa', 150, 'Fried and stuffed with cheese and fresh mint'],
    ['Grilled Sausage', 200, 'Spicy sausage slices with lemon juice'],
    ['Chicken Strips', 200, 'Crispy chicken strips'],
    ['Banco Bronze', 450, 'Fried shrimps with sweet chili'],
    ['Fried Calamari', 400, 'Marinated calamari fillets fried with sweet chili'],
    ['Spicy Potatoes with Sriracha', 150],
    ['Chicken Wings', 250, 'Fried Chicken Wings with dip by your choice'],
    ['Prawns', 450, 'Shrimp marinated with garlic, lemon and coriander'],
  ]),
  category('sandwiches', 'food', { fr: 'Sandwichs', en: 'Sandwiches' }, [
    ['Smoked Salmon Sandwich', 450, 'Smoked Salmon filets with dressing and caper'],
    ['Chicken Wrap', 280, 'Chicken breast, mozzarella and vegetables with hot sauce'],
    ['Chicken Quesadilla', 280, 'Mexican-style chicken with hot sauce'],
    ['Classic Burger', 300, 'Beef with lettuce, cheddar cheese'],
    ['Tuna Sandwich', 200, 'Tuna with vegetables and corn'],
  ]),
  category('fajitas', 'food', { fr: 'Fajitas', en: 'Fajitas' }, [
    ['Chicken Fajitas', 650, 'Chicken strips with vegetables, corn'],
    ['Beef Fajitas', 700, 'Sliced marinated Mexican beef steaks'],
    ['Seafood Fajitas', 850, 'A selection of Red Sea seafood prepared in the style of Mamma Mia'],
  ]),
  category('salads', 'food', { fr: 'Salades', en: 'Salads' }, [
    ['Fresh Salad', 150, 'A selection of fresh vegetables'],
    ['Salmon Avocado', 400, 'Smoked salmon with avocado and vegetables'],
    ['Greek Salad', 250, 'Tomatoes, cucumbers, olives, feta, olive oil'],
    ['Classic Caesar Salad', 200, 'Lettuce, Parmesan, dressing and bread'],
    ['Tuna Salad', 250, 'Tuna, vegetables and sweet corn'],
    ['Rocca Salad', 200, 'Rocca salad with Parmesan and special sauce'],
    ['Seafood Salad', 270, 'Mixed seafood with vegetables'],
  ], {
    extras: { title: 'Extras', items: [['Shrimp', 150], ['Chicken', 120], ['Salmon', 200]] },
  }),
  category('soups', 'food', { fr: 'Soupes', en: 'Soups' }, [
    ['Chicken Cream Soup', 220],
    ['Lentil Soup', 150],
    ['Mushroom Cream Soup', 200],
    ['Seafood Soup', 200],
    ['Tomato Soup', 150],
  ]),
  category('mains', 'food', { fr: 'Plats', en: 'Main Courses' }, [
    ['Beef Tenderloin', 850, 'Angus fillet with your choice of sauce', MAIN_SIDES_CHOICE],
    ['Ribeye', 1700, 'Selected beef cooked to your preference', MAIN_SIDES_CHOICE],
    ['Lamb Chops', 850, 'Grilled lamb chops with coriander rice', MAIN_SIDES_CHOICE],
    ['Chicken Diablo', 750, 'Chicken breast with mushrooms cheese sauce', MAIN_SIDES_CHOICE],
    ['Grilled Chicken', 650, 'Grilled marinated chicken breast with sauce', MAIN_SIDES_CHOICE],
    ['Grilled Salmon', 950, 'Grilled Salmon with Herbs', MAIN_SIDES_CHOICE],
    ['Grilled Jumbo Prawns', 950, 'Jumbo prawns grilled with your choice from sauce', MAIN_SIDES_CHOICE],
    ['Mixed Seafood', 1050, 'Shrimp, calamari, fish, salmon, mussels', MAIN_SIDES_CHOICE],
  ], {
    note: 'Main dishes are served with your choice of two: Rice / Sauteed vegetables / Grilled vegetables / Mashed potatoes / Potato wedges',
  }),
  category('grill', 'food', { fr: 'Grillades au charbon', en: 'Charcoal Grill' }, [
    ['Half Grilled Chicken', 450, 'Half marinated grilled chicken with garlic sauce'],
    ['Kofta 450g', 450, 'Beef kofta grilled on charcoal'],
    ['Kebab 350g', 500, 'Beef Kebab on charcoal'],
    ['Mixed Grill', 750, 'Beef, kofta shish tawook and hawawshi'],
    ['Hawawshi', 300, 'Grilled bread stuffed with seasoned minced meat'],
    ['Shish Tawook', 500, 'Chicken marinated with lemon and garlic served on skewers with garlic sauce'],
  ], { note: 'All grilled dishes served with: Mixed rice – Tahini – Garlic sauce – Grilled vegetables' }),
  category('sides', 'food', { fr: 'Accompagnements', en: 'Side Dishes' }, [
    ['White Rice', 80],
    ['Vermicelli Rice', 120],
    ['Sauteed or Grilled Vegetables', 120, undefined, one('Vegetables', ['Sauteed', 'Grilled'])],
    ['French Fries or Wedges', 100, undefined, one('Potatoes', ['French Fries', 'Wedges'])],
    ['Mashed Potatoes', 100],
  ]),
  category('pasta', 'food', { fr: 'Pâtes', en: 'Pasta' }, [
    ['Penne Alfredo', 350, 'Penne with chicken, mushrooms and parmesan'],
    ['Penne Arrabbiata', 250, 'Penne with tomato sauce, chili peppers and olives'],
    ['Spaghetti Bolognese', 350, 'Spaghetti with beef and tomato concasse'],
    ['Seafood Pasta', 400, 'With shrimp, calamari, mussels and salmon'],
    ['Fettuccine Carbonara', 350, 'With smoked turkey, smoked beef and cream'],
  ]),
  category('pizza', 'food', { fr: 'Pizzas', en: 'Pizza' }, [
    ['Margherita Pizza', 250, 'Mozzarella cheese with tomato sauce'],
    ['Quattro Formaggi Pizza', 350, 'A variety of Italian cheese with sauce'],
    ['Quattro Stagioni Pizza', 380, 'Smoked turkey / Smoked beef sausage with vegetables'],
    ['Vegetable Pizza', 300, 'Fresh vegetables with pizza sauce and mozzarella'],
    ['Seafood Pizza', 480, 'Seafood with pizza, sauce and mozzarella cheese'],
    ['BBQ Chicken Pizza', 370, 'Chicken with vegetables and BBQ sauce'],
  ]),
  category('desserts', 'food', { fr: 'Desserts', en: 'Desserts' }, [
    ['Cheesecake', 170],
    ['Chocolate Cake', 170],
    ['Molten Cake', 180],
    ['Fruit Salad', 200],
    ['Mixed Fruit Plate', 500],
  ]),
  category('waffles', 'food', { fr: 'Gaufres & pancakes', en: 'Waffle & Pancakes' }, [
    ['Nutella', 160],
    ['Nutella and Fruit', 185],
    ['Nutella and Nuts', 195],
    ['Caramel', 130],
    ['Caramel and Fruit', 160],
    ['Caramel and Nuts', 170],
    ['Mini Pancakes', 180],
  ]),
];

export type CarteEntry = { item: CarteItem; category: CarteCategory };

const INDEX = new Map<string, CarteEntry>();
for (const cat of CARTE) {
  for (const item of [...cat.items, ...(cat.extras?.items ?? [])]) {
    INDEX.set(item.id, { item, category: cat });
  }
}

export function findCarteItem(id: string): CarteEntry | null {
  return INDEX.get(id) ?? null;
}

/**
 * Libelle affiche au serveur : "Mango" seul est ambigu (jus, smoothie,
 * milkshake...), on prefixe donc par la categorie quand c'est necessaire.
 */
export function carteLineName({ item, category: cat }: CarteEntry): string {
  if (cat.extras?.items.includes(item)) return `${cat.title.en} extra · ${item.name}`;
  const generic = ['juices', 'smoothies', 'milkshakes', 'cocktails', 'mojitos', 'ice-cream', 'waffles'];
  const alreadyNamed = item.name.toLowerCase().includes(cat.title.en.toLowerCase());
  if (generic.includes(cat.id) && !alreadyNamed) return `${item.name} · ${cat.title.en}`;
  return item.name;
}

// ---------------------------------------------------------------- PANIER

export type CarteLine = {
  key: string;
  itemId: string;
  choices: string[];
  note: string;
  quantity: number;
};

export function carteLineKey(itemId: string, choices: string[], note: string): string {
  return `${itemId}|${[...choices].sort().join(',')}|${note.trim()}`;
}

/** Montants en piastres (centimes) pour reutiliser formatAmount. */
export function carteTotals(lines: CarteLine[]): {
  count: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
} {
  let count = 0;
  let subtotalCents = 0;
  for (const line of lines) {
    const entry = findCarteItem(line.itemId);
    if (!entry) continue;
    count += line.quantity;
    subtotalCents += entry.item.price * 100 * line.quantity;
  }
  const taxCents = Math.round(subtotalCents * CARTE_TAX_RATE);
  return { count, subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
