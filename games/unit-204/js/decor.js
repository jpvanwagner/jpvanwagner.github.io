'use strict';
/* ============================== DECOR ==============================
   What changes from shift to shift, so the unit never looks quite the same twice:
   - the light: morning, afternoon, golden hour, or a rainy day (sky, sun color, room tint)
   - paint: a late-2000s color per room, sometimes with an accent wall
   - floors: different carpet, wood, and tile
   - the oak outside, in October colors
   - stuff the tenant left behind, and clean rectangles where pictures used to hang
   Shading is done in flat color bands (hue-shifted toward the light's shadow color), not with dithering. */
function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b), c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
const TIMES = [
  { id: 'morning', name: 'Morning', sun: '#fff6d6', sunA: .3, shadow: '#3c4f86', tint: '#a8ccff', tintA: .16,
    sky: ['#8cc4f0', '#d6ecf6', '#fff2d2'], building: '#c08a66' },
  { id: 'afternoon', name: 'Afternoon', sun: '#fff0b8', sunA: .34, shadow: '#5a3a78', tint: '#ffdca0', tintA: .14,
    sky: ['#5ea6e8', '#bfe0f2', '#ffe2a6'], building: '#b5805e' },
  { id: 'golden', name: 'Golden hour', sun: '#ffc070', sunA: .42, shadow: '#6a2f5a', tint: '#ff9a4a', tintA: .22,
    sky: ['#6f7fd0', '#f0a07a', '#ffd27a'], building: '#a8604a' },
  { id: 'rain', name: 'Rainy day', sun: null, sunA: 0, shadow: '#2f4060', tint: '#7a90b8', tintA: .2,
    sky: ['#7d8a9c', '#a4aebb', '#c2c8cf'], building: '#8a6a5a', rain: true }
];
const PAINTS = {
  living: [['Tuscan wheat', '#dcc196'], ['Sage', '#b6c497'], ['Terracotta', '#dc9d74'], ['Latte', '#cfae8c']],
  kitchen: [['Butter', '#f0da8e'], ['Celery', '#c6d69a'], ['Tomato bisque', '#e8957a'], ['Robin egg', '#a6d6d0']],
  bath: [['Seafoam', '#9fd8c0'], ['Spa blue', '#a6c8e6'], ['Lavender', '#c6b6e6'], ['Daffodil', '#efdf98']],
  bedroom: [['Dusty blue', '#a0b6d0'], ['Lilac', '#bfaed6'], ['Mushroom', '#c8b49c'], ['Mint', '#aed8b8']]
};
const ACCENTS = { living: ['#b5523b', '#4f7f8f', '#8a5a2e'], bedroom: ['#4c6a96', '#8a4f7a', '#3f7a62'] };
const FLOORS = {
  living: [{ base: '#cdb488', dk: '#b29a70', lt: '#e0caa0' }, { base: '#a9b08a', dk: '#929a74', lt: '#bec4a0' }, { base: '#94a0b6', dk: '#7f8ba2', lt: '#aab4c8' }, { base: '#c79c74', dk: '#ad8460', lt: '#dab38c' }],
  kitchen: [['#efdcb4', '#d3b47e'], ['#f4f0e6', '#bcd6e8'], ['#f0e0c4', '#cf8b66'], ['#eaeadc', '#a8c48c']],
  bath: [['#f0f0e8', '#e2e2d8', '#c4c4bc'], ['#ece4d2', '#ddd2bc', '#bfb39c'], ['#e8f0f4', '#d6e2ea', '#b4c4d0']],
  bedroom: [['#c8874a', '#ba7a40', '#d29458', '#b3743c'], ['#a24c32', '#94452d', '#ae583c', '#8a402a'], ['#aa9c8a', '#9e9080', '#b6a898', '#948676']]
};
const LEAVES = [['#4f8a3a', '#6aa64a', '#3d6e2e'], ['#d8962a', '#e8b83a', '#a8542e', '#6aa64a'], ['#c4402e', '#e07a2a', '#8a3a2a', '#f0c040']];

/* things the tenant left behind */
const CLUTTER = {
  sock: { name: 'Lone sock', look: 'A single argyle sock. Its partner is in a better place.', touch: 'You pick it up with two fingers. You put it down with two fingers.', smell: 'You regret this immediately.',
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - 2 * k, 6 * k, 2 * k, '#2c3f7a'); R(g, x + 2 * k, y - 2 * k, 2 * k, 3 * k, '#2c3f7a'); R(g, x - 2 * k, y - 2 * k, k, k, '#d64545'); R(g, x, y - 2 * k, k, k, '#f2d870'); } },
  hanger: { name: 'Wire hanger', look: 'A wire hanger. Closets breed these when nobody is looking.', touch: 'Bendy. Somebody already tried to pick a lock with it.',
    draw: (g, x, y, k) => { const c = '#9aa0ab'; pxLine(g, x - 6 * k, y, x + 6 * k, y, c); pxLine(g, x - 6 * k, y, x, y - 3 * k, c); pxLine(g, x + 6 * k, y, x, y - 3 * k, c); pxLine(g, x, y - 3 * k, x + k, y - 5 * k, c); } },
  menu: { name: 'Takeout menu', look: "A takeout menu for 'Golden Dragon Express.' The General Tso's is circled. Twice.", touch: 'Greasy in one corner. The good corner.', smell: 'Soy sauce and regret.',
    draw: (g, x, y, k) => { R(g, x - 4 * k, y - 3 * k, 8 * k, 4 * k, '#fbf6e8'); R(g, x - 4 * k, y - 3 * k, 8 * k, k, '#d43a2a'); R(g, x - 3 * k, y - k, 5 * k, k * .6, '#8a8a90'); } },
  cd: { name: 'Free trial CD', look: 'A free internet trial CD. 1,000 hours! You could coaster a whole kitchen with these.', touch: 'Not even scratched. Nobody ever used one.',
    draw: (g, x, y, k) => { pxEllipse(g, x, y - k, Math.max(2, 3 * k), Math.max(1, 1.4 * k), '#d4d8e4'); R(g, x - k, y - 2 * k, 2 * k, k, '#7ad6ff'); R(g, x + k, y - k, k, k, '#ff8ad0'); R(g, x, y - k, 1, 1, '#555'); } },
  phonebook: { name: 'Phone book', look: 'This year\'s phone book, still in its plastic bag. Nobody has opened a phone book since 2003.', touch: 'Heavy enough to prop a door. Which is its whole job now.',
    draw: (g, x, y, k) => { R(g, x - 5 * k, y - 3 * k, 10 * k, 3 * k, '#f2c418'); R(g, x - 5 * k, y - k, 10 * k, k, '#c99a08'); R(g, x - 4 * k, y - 3 * k, 3 * k, k * .7, '#ffffff'); } },
  pizza: { name: 'Pizza box', noTake: "You're not carrying a pizza box around a job site. You do jot down Tony's number from the lid, though.", look: "An empty box from Tony's Pizzeria, the number printed on the lid. Empty, thank goodness.", smell: 'Cold pepperoni, faintly. Your stomach growls.', touch: 'Empty. You checked. Of course you checked.',
    draw: (g, x, y, k) => { R(g, x - 6 * k, y - 3 * k, 12 * k, 3 * k, '#d8b47a'); R(g, x - 6 * k, y, 12 * k, k, '#a8844a'); pxEllipse(g, x, y - 2 * k, Math.max(1, 2 * k), Math.max(1, k * .8), '#d43a2a'); } },
  flipflop: { name: 'Flip-flop', look: 'One flip-flop. Somewhere, a person is walking very unevenly.', touch: 'Foam. Squeaky.',
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - 2 * k, 7 * k, 2 * k, '#3ab0e0'); R(g, x - k, y - 3 * k, k, 2 * k, '#f28c28'); R(g, x + k, y - 3 * k, k, 2 * k, '#f28c28'); } },
  dust: { name: 'Dust bunny', noTake: 'You are not putting that in your bag.', look: 'A dust bunny the size of an actual bunny.', touch: 'It\'s softer than it should be. Concerning.', smell: 'Achoo.',
    draw: (g, x, y, k) => { pxEllipse(g, x, y - k, Math.max(2, 3 * k), Math.max(1, 1.5 * k), '#9a9690'); pxEllipse(g, x - k, y - 2 * k, Math.max(1, 1.5 * k), Math.max(1, k), '#b4b0a8'); } },
  brick: { name: 'Toy brick', look: 'A single red toy brick, placed exactly where a bare foot would find it.', touch: 'Ouch? No, you\'re wearing shoes. Pure instinct.',
    draw: (g, x, y, k) => { R(g, x - 2 * k, y - 2 * k, 4 * k, 2 * k, '#e02c2c'); R(g, x - 2 * k, y - 3 * k, k, k, '#ff5a4a'); R(g, x + k, y - 3 * k, k, k, '#ff5a4a'); } },
  charger: { name: 'Phone charger', look: 'A charger for a flip phone. Abandoned, like the flip phone itself.', touch: 'The cord is wound up neatly. Someone cared, once.',
    draw: (g, x, y, k) => { R(g, x - 4 * k, y - 2 * k, 3 * k, 2 * k, '#222630'); pxLine(g, x - k, y - k, x + 4 * k, y - k, '#222630'); pxEllipse(g, x + 3 * k, y - k, Math.max(1, 2 * k), Math.max(1, k), '#343a48'); } },
  catalog: { name: 'Furniture catalog', look: 'A flat-pack furniture catalog, dog-eared at the bunk beds.', touch: 'Glossy. Every room in it is cleaner than this one.',
    draw: (g, x, y, k) => { R(g, x - 4 * k, y - 3 * k, 8 * k, 3 * k, '#ffd84a'); R(g, x - 4 * k, y - 3 * k, 3 * k, 3 * k, '#2a64c8'); R(g, x + k, y - 2 * k, 2 * k, k, '#d43a2a'); } },
  coupon: { name: 'Coupon booklet', look: 'A booklet of oil-change coupons. All expired in 2007.', touch: 'You flip through it. Nope. All expired.',
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - 2 * k, 6 * k, 2 * k, '#f4f4ec'); R(g, x - 3 * k, y - 2 * k, 6 * k, k * .7, '#3a9a4a'); } }
};
/* movies on the rental cases, mail-order envelopes, and tapes (all out on disc or tape by fall 2008) */
const TITLES = ['Superbad', 'Juno', 'Napoleon Dynamite', 'Anchorman', 'Office Space', 'The Departed', 'Little Miss Sunshine', 'Hot Fuzz',
  'Shaun of the Dead', 'Knocked Up', 'Talladega Nights', 'Mean Girls', 'Elf', '300', 'Ratatouille', 'No Country for Old Men', 'Cloverfield',
  'Iron Man', 'Zoolander', 'Dodgeball', 'Old School', 'Wedding Crashers', 'School of Rock', 'Garden State', 'Transformers', 'Forgetting Sarah Marshall',
  'Eternal Sunshine of the Spotless Mind', 'Pirates of the Caribbean', 'The Royal Tenenbaums', 'Donnie Darko', 'Lost in Translation', 'Kill Bill: Vol. 1',
  'The Matrix', 'Fight Club', 'Clueless', 'Groundhog Day', 'Galaxy Quest', 'Shrek 2', 'Finding Nemo', 'The Incredibles'];
const CASES = [['#1a3a8a', '#f2c418'], ['#1d1f26', '#c8ccd4'], ['#2a6a3a', '#e8e0c8'], ['#8a1a1a', '#f4f1e8']];
Object.assign(CLUTTER, {
  dvd: { name: 'DVD case', multi: true,
    look: c => [`An empty rental case for '${c.title}'. ${c.n} days overdue.`, `A rental case for '${c.title}'. The disc is still inside. Somebody owes somebody money.`, `'${c.title}' on DVD, in a scratched-up case. The sticker says BE KIND, REWIND. On a DVD.`][(c.n || 0) % 3],
    touch: 'You flip it open and shut. Click.', smell: 'Movie-night popcorn, faintly.', take: c => `You drop '${c.title}' in your bag. You'll return it. Probably.`,
    bagLook: c => `A rental DVD of '${c.title}'. ${c.n} days overdue, and counting.`,
    draw: (g, x, y, k, c) => { const [a, b] = CASES[c && c.n ? c.n % CASES.length : 0]; R(g, x - 3 * k, y - 2 * k, 6 * k, 2 * k, a); R(g, x - 2 * k, y - 1.6 * k, 4 * k, k * .7, b); } },
  envelope: { name: 'DVD-by-mail envelope', multi: true,
    look: c => `A red DVD-by-mail envelope. '${c.title}' is still inside. It has been 'on its way back' since ${c.month}.`, touch: 'The disc slides around inside.', smell: 'Paper and mild guilt.',
    take: c => `You pocket the envelope. '${c.title}' is your problem now.`, bagLook: c => `A red mailer with '${c.title}' inside, never sent back.`,
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - 2 * k, 6 * k, 2 * k, '#c1121f'); R(g, x - 2 * k, y - 1.6 * k, 3 * k, k * .5, '#ffffff'); } },
  tape: { name: 'VHS tape', multi: true,
    look: c => `A VHS copy of '${c.title}', labeled in marker: DO NOT TAPE OVER.`, touch: 'You poke the little flap. Ancient technology.', smell: 'Warm plastic and dust.',
    take: c => `You take '${c.title}' on VHS. You don't own a VCR. Yet.`, bagLook: c => `'${c.title}' on VHS. DO NOT TAPE OVER.`,
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - 2 * k, 6 * k, 2 * k, '#1d1f26'); R(g, x - 2 * k, y - 1.8 * k, 4 * k, k * .7, '#f4f1e8'); } }
});
const FLOOR_CLUTTER = Object.keys(CLUTTER).filter(k => !CLUTTER[k].multi && !['soysauce', 'bakingsoda', 'pickles', 'fishstick', 'stapler', 'mug', 'chopsticks', 'mousetrap', 'soap', 'shampoo', 'burgerphone', 'vhs', 'tie'].includes(k));
const SURFACE_OK = ['cd', 'menu', 'coupon', 'charger', 'catalog', 'brick', 'hanger'];   // small enough to leave on a counter or sill
const MOVIES = ['dvd', 'envelope', 'tape'];
/* what could believably be left where: reading material on the toilet tank, a flip-flop or a sock on the tub's edge,
   small things on counters and sills, and no movies anywhere in the bathroom */
function clutterFits(kind, room, where) {
  if (room === 'bath' && (MOVIES.includes(kind) || kind === 'pizza')) return false;
  if (where === 'tub') return ['flipflop', 'sock'].includes(kind);
  if (where === 'tank') return ['menu', 'catalog', 'coupon'].includes(kind);
  if (where === 'counter' || where === 'sill') return SURFACE_OK.includes(kind) || MOVIES.includes(kind);
  return true;
}
const MONTHS = ['April', 'May', 'June', 'July', 'August', 'early September'];
/* the instance's own text, for things like DVDs that differ each time */
/* only these kinds carry a title (a movie, or which calendar it is); anything else is named for what it is, never by a title */
const TITLED = { dvd: t => `rental DVD of '${t}'`, envelope: t => `DVD-by-mail envelope with '${t}' still in it`, tape: t => `VHS tape of '${t}'`, calendar: t => `${t} wall calendar` };
function itemPhrase(kind, c) { const def = CLUTTER[kind], t = c && c.title; return t && TITLED[kind] ? TITLED[kind](t) : lower(def ? def.name : kind); }
function itemKey(kind, c) { return c && c.title && TITLED[kind] ? `${kind}|${c.title}|${c.n || 0}` : kind; }   // a bag entry: 'kind', or 'kind|title|n' for titled kinds
function clutterText(def, field, c) { const v = def[field]; return typeof v === 'function' ? v(c || {}) : v; }
/* things left inside cabinets, the fridge, the oven, and the closet (and one tie on the ceiling fan) */
Object.assign(CLUTTER, {
  soysauce: { name: 'Soy sauce packet', bagLook: 'A single packet of soy sauce. The last survivor.', look: 'A single packet of soy sauce, alone on a shelf. The last survivor.', smell: 'Salty.',
    draw: (g, x, y, k) => { R(g, x - 2 * k, y - 2 * k, 4 * k, 2 * k, '#3a2418'); R(g, x - k, y - 2 * k, 2 * k, k * .6, '#e8e0c8'); } },
  bakingsoda: { name: 'Box of baking soda', look: 'An open box of baking soda, quietly absorbing odors since 2006.', smell: 'Clean. Slightly chalky.',
    draw: (g, x, y, k) => { R(g, x - 2 * k, y - 4 * k, 4 * k, 4 * k, '#f28c28'); R(g, x - 2 * k, y - 3 * k, 4 * k, k, '#ffffff'); } },
  pickles: { name: 'Jar of pickles', look: 'A jar with one pickle floating in it. Like a tiny, sad aquarium.', smell: 'Vinegar. Garlic. Defeat.',
    draw: (g, x, y, k) => { R(g, x - 2 * k, y - 4 * k, 4 * k, 4 * k, '#b8d890'); R(g, x - 2 * k, y - 5 * k, 4 * k, k, '#d4d8e0'); R(g, x - k, y - 3 * k, k, 2 * k, '#5a8a3a'); } },
  fishstick: { name: 'Fossilized fish stick', bagLook: 'One fish stick, baked past the point of no return. Why did you take this?', look: 'One fish stick on a baking sheet, baked past the point of no return.', smell: 'Ancient fish.',
    draw: (g, x, y, k) => { R(g, x - 4 * k, y - k, 8 * k, k, '#9aa0ab'); R(g, x - 2 * k, y - 2 * k, 4 * k, k, '#c8883a'); } },
  stapler: { name: 'Red stapler', look: 'A red stapler. Somebody, somewhere, is looking for this. Desperately.', smell: 'Office supplies.',
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - 2 * k, 6 * k, 2 * k, '#d42a2a'); R(g, x - 3 * k, y - k * .5, 6 * k, k * .5, '#2a2a30'); } },
  mug: { name: 'Coffee mug', look: "A mug that says WORLD'S OKAYEST ROOMMATE.", smell: 'Old coffee.',
    draw: (g, x, y, k) => { R(g, x - 2 * k, y - 3 * k, 3 * k, 3 * k, '#f4f1e8'); R(g, x + k, y - 2 * k, k, k, '#f4f1e8'); R(g, x - 2 * k, y - 2 * k, 3 * k, k * .6, '#3a6ac8'); } },
  chopsticks: { name: 'Takeout chopsticks', look: 'A rubber-banded bundle of takeout chopsticks. Dozens. A lifetime supply.',
    draw: (g, x, y, k) => { for (let i = 0; i < 3; i++) R(g, x - 3 * k, y - (1 + i) * k * .7, 6 * k, 1, '#e8d0a0'); R(g, x - k, y - 2 * k, 1, 2 * k, '#c43a3a'); } },
  mousetrap: { name: 'Mousetrap', look: 'A mousetrap. Unsprung, unbaited, unoccupied. Thank goodness.', noTake: 'You leave the mousetrap exactly where it is.',
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - k, 6 * k, k, '#c8a070'); R(g, x - 2 * k, y - 2 * k, 4 * k, 1, '#9aa0ab'); } },
  soap: { name: 'Bar of pink soap', look: 'A bar of pink soap. Handmade, the label says. You decide not to ask what it was made from.', smell: 'Roses. And something else.',
    draw: (g, x, y, k) => { R(g, x - 2 * k, y - 2 * k, 4 * k, 2 * k, '#f2a0c0'); R(g, x - k, y - 2 * k, 2 * k, k * .5, '#ffd0e0'); } },
  shampoo: { name: 'Hotel shampoo', look: 'A tiny hotel shampoo. From a hotel in a city nobody here has ever mentioned.', smell: 'Green apple.',
    draw: (g, x, y, k) => { R(g, x - k, y - 4 * k, 2 * k, 4 * k, '#8ad0a0'); R(g, x - k, y - 5 * k, 2 * k, k, '#ffffff'); } },
  burgerphone: { name: 'Hamburger phone', look: 'A telephone shaped like a hamburger. It still has a dial tone. Somehow.', smell: 'Plastic. Not burger. Disappointing.',
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - 4 * k, 6 * k, 1.5 * k, '#d89a4a'); R(g, x - 3 * k, y - 2.5 * k, 6 * k, k, '#5a8a3a'); R(g, x - 3 * k, y - 1.5 * k, 6 * k, k, '#6a3a1a'); R(g, x - 3 * k, y - .5 * k, 6 * k, k, '#d89a4a'); } },
  vhs: { name: 'Shoebox of VHS tapes', look: "A shoebox of VHS tapes, every one labeled 'DO NOT TAPE OVER'.", smell: 'Cardboard and nostalgia.',
    draw: (g, x, y, k) => { R(g, x - 4 * k, y - 3 * k, 8 * k, 3 * k, '#d8c8a0'); R(g, x - 3 * k, y - 4 * k, 2 * k, k, '#1d1f26'); R(g, x, y - 4 * k, 2 * k, k, '#1d1f26'); } },
  waffles: { name: 'Freezer-burned waffles', look: 'A box of toaster waffles, frosted solid. Best by: a different presidency.', smell: 'Freezer.',
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - 3 * k, 6 * k, 3 * k, '#e8b830'); R(g, x - 2 * k, y - 2.4 * k, 4 * k, k, '#c8602a'); } },
  icetray: { name: 'Ice cube tray', look: 'A plastic ice cube tray with exactly one ice cube in it. Classic.', touch: 'Cold. One cube rattles.',
    draw: (g, x, y, k) => { R(g, x - 4 * k, y - k, 8 * k, k, '#bfe8ff'); for (let i = 0; i < 4; i++) R(g, x - 3.5 * k + i * 2 * k, y - 1.6 * k, k, k * .6, '#e8f8ff'); } },
  spoon: { name: 'Lone spoon', look: 'One spoon, alone in the silverware basket. It has seen things.', touch: 'Clean, at least.',
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - k, 5 * k, k * .6, '#c9ccd4'); R(g, x + 2 * k, y - 1.4 * k, 1.5 * k, k, '#c9ccd4'); } },
  tie: { name: 'Necktie', hang: true, bagLook: 'A loud necktie. It looks like it has opinions. Strong ones.', look: 'A loud necktie, looped over a fan blade by its knot: orange, red, green, blue, gray flowers, and a little yellow sun. It looks like it has opinions.', smell: 'Cheap cologne and poor decisions.', talk: 'The tie says nothing. But you get the feeling it really, really wants to.',
    take: 'You take the tie. It feels like it is judging you. You are fine with this.',
    draw: (g, x, y, k) => { R(g, x - k, y, 2 * k, 6 * k, '#c43a8a'); R(g, x - k, y + 2 * k, 2 * k, k, '#f2d870'); R(g, x - 1.5 * k, y + 6 * k, 3 * k, k, '#c43a8a'); } }
});
const CONTAINERS = {          // what can turn up behind each group of doors (null = empty), and which doors are in the group
  kup: { doors: ['ku1', 'ku2', 'ku3', 'ku4', 'ku5'], items: ['mug', 'chopsticks', null] }, klow: { doors: ['kl1', 'kl2', 'kl3', 'kl4'], items: ['stapler', 'mousetrap', null] },
  fridge: { doors: ['fridge'], items: ['soysauce', 'bakingsoda', 'pickles'] }, freezer: { doors: ['freezer'], items: ['waffles', 'icetray', null] },
  oven: { doors: ['oven'], items: ['fishstick', null, null] }, dishwasher: { doors: ['dishwasher'], items: ['spoon', null] },
  vanity: { doors: ['van1', 'van2'], items: ['soap', 'shampoo', null] }, closet: { doors: ['closet'], items: ['burgerphone', 'vhs', 'hanger'] }
};
/* findings and oddities that hide behind a door: which doors they can be behind */
const HIDDEN = { ucab: ['ku1', 'ku2', 'ku3', 'ku4'], lcab: ['kl1', 'kl2', 'kl3'], vanitycab: ['van1', 'van2'], closetin: ['closet'], linerpaper: ['ku1', 'ku2', 'ku3', 'ku4', 'ku5'], phonenums: ['closet'], bentblinds: ['bblinds'] };
function R(g, x, y, w, h, c) { pxRect(g, x, y, Math.max(1, w), Math.max(1, h), c); }
/* where left-behind things can turn up: [x, z] on the floor, or [x, y, z, where] on a counter, sill, tub ledge, or tank lid */
const CLUTTER_SPOTS = {
  living: [[-4.4, 7.2], [4.6, 7.4], [-1.6, 12.3], [3.4, 5.6], [4.4, 11.2], [-3.4, 5.4], [-3.2, 10.5], [1.8, 6.1], [-.6, 5.6], [2.6, 12.2]],
  kitchen: [[-3.8, 6.2], [3.6, 7], [.9, 5.8], [-1.6, 8.4], [2.6, 9.8], [-4.2, .962, 11.45, 'counter'], [-3.4, .962, 11.6, 'counter'], [-2.2, .962, 11.4, 'counter'], [1.85, .962, 11.5, 'counter'], [-3.9, 6.8]],
  bath: [[1.6, 5.9], [-1.4, 6.2], [2.7, 8.8], [.3, 7.6], [1.6, .93, 10.6, 'counter'], [3.4, .93, 10.6, 'counter'], [-3.5, .59, 9.55, 'tub'], [-.5, .59, 9.55, 'tub'], [-3.82, 1.48, 8.4, 'tank']],
  bedroom: [[-4.5, 6.4], [2.4, 6], [4.4, 11.2], [.6, 10.6], [-1.6, 7.4], [3.6, 8.2], [1.9, .9, 12.35, 'sill'], [3.1, .9, 12.35, 'sill'], [4.2, .9, 12.35, 'sill'], [-4.9, 9]]
};

/* where a picture could have hung: clear stretches of side wall, away from doors, the calendar, the fridge, the tub
   and shower, the towel bar, and the bedroom's big drawing. Rooms with none get no outlines. */
const GHOST_SPANS = {
  living: [{ side: 'left', z0: 9.9, z1: 12.6 }, { side: 'right', z0: 10.8, z1: 12.6 }],
  bedroom: [{ side: 'right', z0: 10.2, z1: 12.3 }]
};
const Decor = {
  cur: null,
  roll() {
    const time = pick(TIMES), kinds = shuffle(FLOOR_CLUTTER.slice()), seen = {}, d = { time, leaves: pick(LEAVES), paint: {}, accent: {}, floor: {}, clutter: {}, ghosts: {} };
    for (const room of Object.keys(PAINTS)) {
      d.paint[room] = pick(PAINTS[room]);
      d.accent[room] = ACCENTS[room] && Math.random() < .45 ? pick(ACCENTS[room]) : null;
      d.floor[room] = pick(FLOORS[room]);
      const spots = shuffle((CLUTTER_SPOTS[room] || []).slice()), n = 2 + Math.floor(Math.random() * 3), placed = [];
      d.clutter[room] = spots.slice(0, n).map((s, i) => {
        const [x, y, z, where] = s.length >= 3 ? s : [s[0], 0, s[1], 'floor'], onFloor = s.length === 2;
        // rental movies can turn up more than once, but only once per room, twice in the whole unit, and three movies
        // in all, so the place doesn't look like a DVD-by-mail warehouse
        const roomKinds = new Set(placed), movies = (seen.dvd || 0) + (seen.envelope || 0) + (seen.tape || 0), fresh = movies >= 3 ? [] : MOVIES.filter(k => (seen[k] || 0) < 2 && !roomKinds.has(k) && clutterFits(k, room, where));
        let kind = Math.random() < .3 && fresh.length ? pick(fresh) : null;
        if (!kind) { const ok = kinds.filter(k => clutterFits(k, room, where) && !roomKinds.has(k)); kind = ok.length ? ok[ok.length - 1] : null; if (kind) kinds.splice(kinds.lastIndexOf(kind), 1); }
        if (!kind) return null;
        seen[kind] = (seen[kind] || 0) + 1; placed.push(kind);
        return { kind, id: `clutter-${room}-${i}`, x: x + (onFloor ? rand(-.2, .2) : rand(-.08, .08)), y, z: z + (onFloor ? rand(-.2, .2) : 0),
          title: ['dvd', 'envelope', 'tape'].includes(kind) ? pick(TITLES) : null,   // only movies have titles (a catalog is not 'No Country for Old Men')
          n: 3 + Math.floor(Math.random() * 40), style: Math.floor(Math.random() * CASES.length), month: pick(MONTHS) };
      }).filter(Boolean);
      const spans = GHOST_SPANS[room] || [], used = [];
      d.ghosts[room] = spans.length ? Array.from({ length: Math.floor(Math.random() * 3) }, () => {
        const sp = pick(spans), w = rand(.5, Math.min(1, sp.z1 - sp.z0)), z = rand(sp.z0, sp.z1 - w), g = { side: sp.side, z, y: rand(1.4, 2.1), w, h: rand(.4, .8) };
        if (used.some(o => o.side === g.side && z < o.z + o.w + .15 && o.z < z + w + .15)) return null;   // two outlines never overlap either
        used.push(g); return g;
      }).filter(Boolean) : [];
    }
    d.rug = Game.cond.carpet === 2 ? Math.random() < .7 : Math.random() < .25; d.tie = Math.random() < .35; d.contents = {};
    for (const g of Object.values(CONTAINERS)) { const k = pick(g.items); if (k) d.contents[pick(g.doors)] = k; }
    d.inside = {}; for (const [what, doors] of Object.entries(HIDDEN)) d.inside[what] = pick(doors);
    this.cur = d; return d;
  },
  get time() { return (this.cur || { time: TIMES[1] }).time; },
  /* the room's colors for this shift */
  pal(id) {
    const d = this.cur, sh = this.time.shadow;
    const wall = d && d.paint[id] ? d.paint[id][1] : '#d8c6a2', back = (d && d.accent[id]) || wall;
    return {
      wall, back, wallL: mix(wall, sh, .14), wallR: mix(wall, sh, .09),
      ceil: mix('#f1ece0', wall, .1), ceilBand: mix(mix('#f1ece0', wall, .1), sh, .1),
      band1: c => mix(c, sh, .12), band2: c => mix(c, sh, .24),
      floor: d && d.floor[id] ? d.floor[id] : (FLOORS[id] || [])[0], leaves: d ? d.leaves : LEAVES[1]
    };
  },
  /* the wall behind a close-up, so the zoom matches the room */
  zoomWall(room, which = 'back') { const p = this.pal(room); return which === 'left' ? p.wallL : which === 'right' ? p.wallR : which === 'side' ? p.wall : p.back; },
  tint(g, w, h) {
    const T = this.time; if (!T.tintA) return;
    g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = rgba(T.tint, T.tintA * 2.2); g.fillRect(0, 0, w, h); g.restore();
    if (T.rain) { g.fillStyle = 'rgba(40,52,80,0.12)'; g.fillRect(0, 0, w, h); }
  },
  rugDown() { return !!(this.cur && this.cur.rug && !Game.opened.rug); },
  clutterHots(id) {
    const out = [];
    for (const c of (this.cur && this.cur.clutter[id]) || []) {
      if (Game.taken.has(c.id)) continue;
      const def = CLUTTER[c.kind], p = P(c.x, c.y || 0, c.z), k = clamp(8 / c.z, .8, 1.7), w = ROOMS[id].walk;
      const data = { ...def, item: itemKey(c.kind, c) };
      for (const f of ['look', 'touch', 'smell', 'take']) if (def[f]) data[f] = clutterText(def, f, c);
      const big = (typeof BIG_ITEMS !== 'undefined' && BIG_ITEMS[c.kind]) || 1, hw = Math.max(7 * k, 8 * big), hh = Math.max(7 * k, 6 * big);   // the clickable area fits the sprite
      out.push({ kind: 'scenery', id: c.id, name: def.name, pts: [[p[0] - hw, p[1] - hh], [p[0] + hw, p[1] - hh], [p[0] + hw, p[1] + 2], [p[0] - hw, p[1] + 2]],
        walk: { x: clamp(c.x, w.x0, w.x1), z: Math.min(c.z - .5, w.z1) }, data });
    }
    for (const [i, gh] of ((this.cur && this.cur.ghosts[id]) || []).entries()) {
      const r = ROOMS[id], q = gh.side === 'left' ? Q.left : Q.right;
      out.push({ kind: 'scenery', id: 'ghost' + i, name: 'Picture outline', pts: q(r.box, gh.z, gh.z + gh.w, gh.y, gh.y + gh.h), walk: { x: gh.side === 'left' ? r.walk.x0 : r.walk.x1, z: gh.z },
        data: { name: 'Picture outline', look: 'A cleaner rectangle where a picture hung for years. The paint around it faded in the sun; the paint behind it didn\'t. Textbook normal wear.', touch: 'One small nail hole in the middle. Picture-nail size.' } });
    }
    return out;
  },
  drawExtras(g, r) {
    const id = r.id, p = this.pal(id);
    for (const gh of (this.cur && this.cur.ghosts[id]) || []) {
      const q = gh.side === 'left' ? Q.left : Q.right, base = gh.side === 'left' ? p.wallL : p.wallR;
      fillPoly(g, q(r.box, gh.z, gh.z + gh.w, gh.y, gh.y + gh.h), mix(base, '#ffffff', .14));
      const n = P(gh.side === 'left' ? r.box.x0 : r.box.x1, gh.y + gh.h * .8, gh.z + gh.w / 2); pxRect(g, n[0], n[1], 1, 1, '#4a3a2a');
    }
    for (const c of (this.cur && this.cur.clutter[id]) || []) {
      if (Game.taken.has(c.id)) continue;
      const pt = P(c.x, c.y || 0, c.z), k = clamp(8 / c.z, .8, 1.7) * (c.y ? .85 : 1);
      const sw = (typeof ITEM_SPRITES !== 'undefined' && ITEM_SPRITES[c.kind] ? ITEM_SPRITES[c.kind][0].length : 10) * sprScale(k) * ((typeof BIG_ITEMS !== 'undefined' && BIG_ITEMS[c.kind]) || 1);
      pxEllipse(g, pt[0] + 1, pt[1] + 1, Math.round(sw * .55), Math.max(1, Math.round(sw * .12)), 'rgba(30,20,40,0.16)'); pxEllipse(g, pt[0], pt[1], Math.round(sw * .45), Math.max(1, Math.round(sw * .07)), 'rgba(30,20,40,0.2)');   // a soft shadow it sits in
      CLUTTER[c.kind].draw(g, Math.round(pt[0]), Math.round(pt[1]), k, c);
    }
  }
};
