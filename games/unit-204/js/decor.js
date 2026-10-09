'use strict';
/* ============================== DECOR ==============================
   What changes from shift to shift, so the unit never looks quite the same twice:
   - the light: morning, afternoon, golden hour or a rainy day (sky, sun color, room tint)
   - paint: a late-2000s color per room, sometimes with an accent wall
   - floors: different carpet, wood and tile
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
const LEAVES = [['#4f8a3a', '#6aa64a', '#3d6e2e'], ['#d8962a', '#e8b83a', '#c4542e', '#6aa64a'], ['#c4402e', '#e07a2a', '#f0c040', '#8a3a2a']];

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
  pizza: { name: 'Pizza box', look: 'An empty pizza box. Empty, thank goodness.', smell: 'Cold pepperoni, faintly. Your stomach growls.', touch: 'Empty. You checked. Of course you checked.',
    draw: (g, x, y, k) => { R(g, x - 6 * k, y - 3 * k, 12 * k, 3 * k, '#d8b47a'); R(g, x - 6 * k, y, 12 * k, k, '#a8844a'); pxEllipse(g, x, y - 2 * k, Math.max(1, 2 * k), Math.max(1, k * .8), '#d43a2a'); } },
  flipflop: { name: 'Flip-flop', look: 'One flip-flop. Somewhere, a person is walking very unevenly.', touch: 'Foam. Squeaky.',
    draw: (g, x, y, k) => { R(g, x - 3 * k, y - 2 * k, 7 * k, 2 * k, '#3ab0e0'); R(g, x - k, y - 3 * k, k, 2 * k, '#f28c28'); R(g, x + k, y - 3 * k, k, 2 * k, '#f28c28'); } },
  dust: { name: 'Dust bunny', look: 'A dust bunny the size of an actual bunny.', touch: 'It\'s softer than it should be. Concerning.', smell: 'Achoo.',
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
function R(g, x, y, w, h, c) { pxRect(g, x, y, Math.max(1, w), Math.max(1, h), c); }
const CLUTTER_SPOTS = {
  living: [[-4.4, 7.2], [4.6, 7.4], [-1.6, 12.3], [3.4, 5.6], [4.4, 11.2], [-3.4, 5.4]],
  kitchen: [[-3.8, 6.2], [3.6, 7], [.9, 5.8], [-1.6, 8.4], [2.6, 9.8]],
  bath: [[1.6, 5.9], [-1.4, 6.2], [2.7, 8.8], [.3, 7.6]],
  bedroom: [[-4.5, 6.4], [2.4, 6], [4.4, 11.2], [.6, 10.6], [-1.6, 7.4], [3.6, 8.2]]
};

const Decor = {
  cur: null,
  roll() {
    const time = pick(TIMES), d = { time, leaves: pick(LEAVES), paint: {}, accent: {}, floor: {}, clutter: {}, ghosts: {} };
    for (const room of Object.keys(PAINTS)) {
      d.paint[room] = pick(PAINTS[room]);
      d.accent[room] = ACCENTS[room] && Math.random() < .45 ? pick(ACCENTS[room]) : null;
      d.floor[room] = pick(FLOORS[room]);
      const spots = shuffle(CLUTTER_SPOTS[room].slice()), kinds = shuffle(Object.keys(CLUTTER));
      d.clutter[room] = spots.slice(0, 1 + Math.floor(Math.random() * 3)).map(([x, z], i) => ({ kind: kinds[i], x: x + rand(-.2, .2), z: z + rand(-.2, .2) }));
      d.ghosts[room] = Array.from({ length: Math.floor(Math.random() * 3) }, () => ({ side: Math.random() < .5 ? 'left' : 'right', z: rand(10.4, 11.6), y: rand(1.4, 2.1), w: rand(.5, 1), h: rand(.4, .8) }));
    }
    this.cur = d; return d;
  },
  get time() { return (this.cur || { time: TIMES[1] }).time; },
  /* the room's colors for this shift */
  pal(id) {
    const d = this.cur, sh = this.time.shadow;
    const wall = d ? d.paint[id][1] : '#d8c6a2', back = (d && d.accent[id]) || wall;
    return {
      wall, back, wallL: mix(wall, sh, .14), wallR: mix(wall, sh, .09),
      ceil: mix('#f1ece0', wall, .1), ceilBand: mix(mix('#f1ece0', wall, .1), sh, .1),
      band1: c => mix(c, sh, .12), band2: c => mix(c, sh, .24),
      floor: d ? d.floor[id] : FLOORS[id][0], leaves: d ? d.leaves : LEAVES[1]
    };
  },
  /* the wall behind a close-up, so the zoom matches the room */
  zoomWall(room, which = 'back') { const p = this.pal(room); return which === 'left' ? p.wallL : which === 'right' ? p.wallR : which === 'side' ? p.wall : p.back; },
  tint(g, w, h) {
    const T = this.time; if (!T.tintA) return;
    g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = rgba(T.tint, T.tintA * 2.2); g.fillRect(0, 0, w, h); g.restore();
    if (T.rain) { g.fillStyle = 'rgba(40,52,80,0.12)'; g.fillRect(0, 0, w, h); }
  },
  clutterHots(id) {
    const out = [];
    for (const c of (this.cur && this.cur.clutter[id]) || []) {
      const def = CLUTTER[c.kind], p = P(c.x, 0, c.z), k = clamp(8 / c.z, .8, 1.7);
      out.push({ kind: 'scenery', id: 'clutter-' + c.kind, name: def.name, pts: [[p[0] - 7 * k, p[1] - 7 * k], [p[0] + 7 * k, p[1] - 7 * k], [p[0] + 7 * k, p[1] + 2], [p[0] - 7 * k, p[1] + 2]], walk: { x: c.x, z: c.z - .5 }, data: def });
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
      const pt = P(c.x, 0, c.z), k = clamp(8 / c.z, .8, 1.7);
      pxEllipse(g, pt[0], pt[1], Math.round(5 * k), Math.max(1, Math.round(k)), 'rgba(30,20,40,0.22)');
      CLUTTER[c.kind].draw(g, Math.round(pt[0]), Math.round(pt[1]), k);
    }
  }
};
