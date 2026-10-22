// Reputation and recipes. Good reviews spread by word of mouth ("buzz"); enough buzz moves the
// trattoria up a rank, which brings bigger crowds and, from the second rank on, a food critic
// once a shift. Refining a recipe in the office makes the dish taste better and sell for more.
import { career, saveCareer } from '../state.js';
import { DISHES } from '../data/menu.js';

// Ranks: buzz needed, name, and how much busier it gets (arrival rate multiplier).
export const RANKS = [
  { at: 0,   name: 'Neighbourhood secret', busy: 1.0 },
  { at: 50,  name: 'Local favourite',      busy: 1.12 },
  { at: 140, name: 'Talk of the street',   busy: 1.25 },
  { at: 280, name: "Critics' pick",        busy: 1.38 },
  { at: 480, name: 'Worth the trip',       busy: 1.5 },
];
export const CRITIC_FROM_RANK = 1;   // index into RANKS (the second rank)

export function rankIndex(buzz = career.buzz) {
  let i = 0;
  RANKS.forEach((r, j) => { if (buzz >= r.at) i = j; });
  return i;
}
export const rank = () => RANKS[rankIndex()];
export const nextRank = () => RANKS[rankIndex() + 1] || null;

/** Buzz from one shift's reviews: every star above three spreads the word, below three hurts.
 *  The critic's review counts five times over. */
export function shiftBuzz(ratings, critic) {
  let b = ratings.reduce((n, s) => n + (s - 3) * 2, 0);
  if (critic) b += (critic.stars - 3) * 10;
  return Math.round(b);
}

export function addBuzz(n) {
  const before = rankIndex();
  career.buzz = Math.max(0, career.buzz + n);
  saveCareer();
  return { before, after: rankIndex() };
}

// ── Recipes ────────────────────────────────────────────────────────────────
export const RECIPE_MAX = 5;
export const recipeLevel = (key) => career.recipes[key] || 1;
/** Menu price: +$2 a level. */
export const dishPrice = (key) => DISHES[key].price + 2 * (recipeLevel(key) - 1);
/** Extra mood when a guest gets the right dish: +3 a level. */
export const dishTaste = (key) => 3 * (recipeLevel(key) - 1);
export const refineCost = (key) => (recipeLevel(key) >= RECIPE_MAX ? null : 70 + 60 * (recipeLevel(key) - 1));

export function refine(key) {
  const cost = refineCost(key);
  if (cost == null || career.cash < cost) return false;
  career.cash -= cost;
  career.recipes[key] = recipeLevel(key) + 1;
  saveCareer();
  return true;
}

// What Mama Maggie's notebook says about each refinement (flavour for the office screen).
export const RECIPE_NOTES = {
  margherita: ['San Marzano tomatoes', 'Fior di latte, not the cheap stuff', '72-hour cold-proved dough', 'A drizzle of the good olive oil'],
  pepperoni: ['Spicier, curling pepperoni', 'A little hot honey', 'Smoked mozzarella blend', 'Leopard-spotted crust'],
  meatballs: ['Half pork, half veal', 'Soaked bread, not breadcrumbs', 'Sauce simmered since morning', "Mama Maggie's secret: a parmesan rind"],
  alfredo: ['Fresh-cut fettuccine', 'Real butter, real cream', 'Aged Parmigiano', 'Cracked black pepper at the table'],
  calamari: ['Buttermilk soak', 'Semolina dredge', 'Fried in fresh oil', 'Charred lemon on the side'],
  caprese: ['Heirloom tomatoes', 'Buffalo mozzarella', 'Basil from the window box', 'Aged balsamic'],
};
