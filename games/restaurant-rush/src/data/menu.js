// The menu: dishes (back of house) and drinks (bar), plus every ingredient they use.

// ── Kitchen ────────────────────────────────────────────────────────────────
// Cooked components: which station cooks them and how the doneness curve runs.
//   done: seconds until perfectly cooked; hold: seconds it stays perfect;
//   ruin: seconds until burnt / mushy; turn: needs a turn/toss halfway through.
export const COOKED = {
  spaghetti:  { name: 'Spaghetti',  station: 'pot',   done: 8,  hold: 4, ruin: 16, color: 0xf0d48a },
  fettuccine: { name: 'Fettuccine', station: 'pot',   done: 9,  hold: 4, ruin: 17, color: 0xf3dc98 },
  meatballs:  { name: 'Meatballs',  station: 'pan',   done: 9,  hold: 4, ruin: 16, color: 0x7a3b22, turn: true },
  calamari:   { name: 'Calamari',   station: 'fryer', done: 6,  hold: 3, ruin: 11, color: 0xe2b062 },
  // Whole pizzas go into the oven: built on the counter first, then baked.
  pizza:      { name: 'Pizza',      station: 'oven',  done: 10, hold: 4, ruin: 17, color: 0xe8b064, turn: true },
};

// Cold / finishing ingredients that live in the bins on the prep counter.
export const BINS = {
  dough:      { name: 'Dough',        color: 0xf2e2c0 },
  sauce:      { name: 'Pizza sauce',  color: 0xc0321f },
  mozzarella: { name: 'Mozzarella',   color: 0xfaf6ea },
  pepperoni:  { name: 'Pepperoni',    color: 0xa3261c },
  basil:      { name: 'Basil',        color: 0x3f8a3a },
  marinara:   { name: 'Marinara',     color: 0xb32a1a },
  alfredo:    { name: 'Alfredo',      color: 0xf4ecd6 },
  parmesan:   { name: 'Parmesan',     color: 0xf1e3b0 },
  parsley:    { name: 'Parsley',      color: 0x4c9a3c },
  lemon:      { name: 'Lemon',        color: 0xf2d43a },
  tomato:     { name: 'Tomato',       color: 0xd23a2a },
  oliveoil:   { name: 'Olive oil',    color: 0xb8b23a },
};

// Dishes. `build` is every component the finished plate needs (cooked + bins).
// `bake: true` means the whole build goes into the oven before it's sent.
export const DISHES = {
  margherita: {
    name: 'Pizza Margherita', short: 'Margherita', price: 16, bake: true,
    build: ['dough', 'sauce', 'mozzarella', 'basil'],
    says: ['the Margherita', 'a Margherita pizza', 'the plain pizza, the Margherita'],
  },
  pepperoni: {
    name: 'Pepperoni Pizza', short: 'Pepperoni', price: 18, bake: true,
    build: ['dough', 'sauce', 'mozzarella', 'pepperoni'],
    says: ['the pepperoni pizza', 'a pepperoni pie', 'pepperoni pizza'],
  },
  meatballs: {
    name: "Mama Maggie's Spaghetti & Meatballs", short: 'Spag & Meatballs', price: 19,
    build: ['spaghetti', 'meatballs', 'marinara', 'parmesan'],
    says: ['the spaghetti and meatballs', "Mama Maggie's meatballs", 'spaghetti with meatballs'],
  },
  alfredo: {
    name: 'Fettuccine Alfredo', short: 'Alfredo', price: 17,
    build: ['fettuccine', 'alfredo', 'parsley'],
    says: ['the fettuccine Alfredo', 'the Alfredo', 'fettuccine'],
  },
  calamari: {
    name: 'Fried Calamari', short: 'Calamari', price: 13,
    build: ['calamari', 'lemon', 'marinara'],
    says: ['the calamari', 'fried calamari', 'the calamari, please'],
  },
  caprese: {
    name: 'Caprese Salad', short: 'Caprese', price: 12,
    build: ['tomato', 'mozzarella', 'basil', 'oliveoil'],
    says: ['the Caprese', 'a Caprese salad', 'the tomato and mozzarella salad'],
  },
};

// ── Bar ────────────────────────────────────────────────────────────────────
export const GLASSES = {
  pint:     { name: 'Pint',     cap: 5.5 },
  wine:     { name: 'Wine',     cap: 4.5 },
  rocks:    { name: 'Rocks',    cap: 3.5 },
  highball: { name: 'Highball', cap: 5.5 },
  coupe:    { name: 'Coupe',    cap: 4.5 },
};

// Pourables. rate = oz per sim second while held.
export const POURS = {
  lager:     { name: 'Peroni (tap)', rate: 2.0, color: 0xe8b83a, tap: true },
  chianti:   { name: 'Chianti',      rate: 1.4, color: 0x6a0f1c },
  pinot:     { name: 'Pinot Grigio', rate: 1.4, color: 0xeee7a6 },
  prosecco:  { name: 'Prosecco',     rate: 1.4, color: 0xf3e9b5 },
  aperol:    { name: 'Aperol',       rate: 1.0, color: 0xf2661c },
  campari:   { name: 'Campari',      rate: 0.8, color: 0xc0141e },
  gin:       { name: 'Gin',          rate: 0.8, color: 0xe7f2f4 },
  vermouth:  { name: 'Sweet vermouth', rate: 0.8, color: 0x7a2a12 },
  vodka:     { name: 'Vodka',        rate: 1.0, color: 0xf1f4f6 },
  espresso:  { name: 'Espresso',     rate: 0.8, color: 0x2a160c },
  coffeeliq: { name: 'Coffee liqueur', rate: 0.8, color: 0x3a1c0c },
  soda:      { name: 'Soda water',   rate: 1.8, color: 0xdfeff2 },
  limonata:  { name: 'Limonata',     rate: 1.8, color: 0xf6e27a },
};

export const GARNISHES = {
  orange: { name: 'Orange slice', color: 0xf28a1c },
  lemon:  { name: 'Lemon twist',  color: 0xf2d43a },
  beans:  { name: 'Coffee beans', color: 0x3a2214 },
};

export const DRINKS = {
  peroni: {
    name: 'Peroni', price: 7, glass: 'pint', ice: false,
    pours: { lager: 5 },
    says: ['a Peroni', 'a beer, Peroni', 'whatever beer you have on tap'],
  },
  chianti: {
    name: 'Glass of Chianti', short: 'Chianti', price: 11, glass: 'wine', ice: false,
    pours: { chianti: 3 },
    says: ['a glass of Chianti', 'the house red', 'Chianti'],
  },
  pinot: {
    name: 'Glass of Pinot Grigio', short: 'Pinot Grigio', price: 10, glass: 'wine', ice: false,
    pours: { pinot: 3 },
    says: ['a Pinot Grigio', 'the house white', 'a glass of white wine'],
  },
  spritz: {
    name: 'Aperol Spritz', short: 'Spritz', price: 12, glass: 'wine', ice: true,
    pours: { prosecco: 2, aperol: 1.5, soda: 0.5 }, garnish: 'orange',
    says: ['an Aperol Spritz', 'a spritz', 'the orange bubbly one, the spritz'],
  },
  negroni: {
    name: 'Negroni', price: 13, glass: 'rocks', ice: true,
    pours: { gin: 1, campari: 1, vermouth: 1 }, garnish: 'orange',
    says: ['a Negroni', 'a Negroni, please', 'Negroni'],
  },
  espressomartini: {
    name: 'Espresso Martini', short: 'Espresso Mart.', price: 14, glass: 'coupe', ice: false, shake: true,
    pours: { vodka: 1.5, espresso: 1, coffeeliq: 1 }, garnish: 'beans',
    says: ['an espresso martini', 'the espresso martini', 'something with coffee in it — espresso martini'],
  },
  limonata: {
    name: 'San Pellegrino Limonata', short: 'Limonata', price: 5, glass: 'highball', ice: true,
    pours: { limonata: 4 }, garnish: 'lemon',
    says: ['a limonata', 'the lemon soda', 'a Pellegrino limonata'],
  },
};

export const FOOD_KEYS = Object.keys(DISHES);
export const DRINK_KEYS = Object.keys(DRINKS);

/** Every key a plate can contain, with display name and color. */
export function componentInfo(key) {
  return COOKED[key] || BINS[key] || { name: key, color: 0xcccccc };
}
