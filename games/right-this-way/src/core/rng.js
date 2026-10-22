/* Randomness helpers. Swap Math.random for a seeded PRNG here if replays are ever needed. */

export const random = () => Math.random();
export const range = (min, max) => min + random() * (max - min);
export const rangeOf = ([min, max]) => range(min, max);
export const chance = (p) => random() < p;
export const pick = (arr) => arr[Math.floor(random() * arr.length)];

/** Picks a key from { key: weight } or an item from [{ weight }]. */
export function weighted(input) {
  const entries = Array.isArray(input)
    ? input.map((item) => [item, item.weight ?? 1])
    : Object.entries(input);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = random() * total;
  for (const [item, w] of entries) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return entries[entries.length - 1][0];
}

let nextId = 1;
export const uid = (prefix = 'id') => `${prefix}${nextId++}`;
