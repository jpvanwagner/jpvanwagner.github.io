'use strict';
/* ============================== LEVELS ==============================
   Coordinates are 1x level pixels (y grows downward); buildLevel() scales the whole level up by WS
   (see physics.js), so the mouth is big and PeeDee and the germs are small inside it. Gums and teeth are solid down to the floor of the
   world; drool/pulp shows through wherever there's no ground. Jump limits (see validate-levels.mjs):
   at 1x PeeDee clears ~64 px up and ~80 px across, so every required hop here stays well inside that. */
// <LEVELS>
/* The sixteen lower teeth. Widths follow real proportions, chunked up a little so the tall crowns don't look skinny; shape(u) is how far the
   biting edge sits below the tooth's highest point across its width (u = 0..1, mesial to distal).
   Collision follows the same outline, so you really do climb over a canine's point or a molar's cusps. */
const TOOTH_KINDS = {
  i1: { name: 'central incisor', w: 98, shape: u => 0.6 * Math.abs(Math.sin(u * Math.PI * 3)) },   // flat edge, tiny mamelons
  i2: { name: 'lateral incisor', w: 102, shape: u => u * 2.5 },                                       // flat, sloping a touch
  c:  { name: 'canine', w: 116, shape: u => Math.pow(Math.abs(u - 0.46) / 0.54, 1.25) * 18 },          // one long pointed cusp
  p1: { name: 'first premolar', w: 114, shape: u => Math.pow(Math.abs(u - 0.5) / 0.5, 1.6) * 12 },     // a sharp single cusp
  p2: { name: 'second premolar', w: 116, shape: u => Math.pow(Math.abs(u - 0.5) / 0.5, 2) * 8 },       // a rounder single cusp
  m1: { name: 'first molar', w: 172, shape: u => 3.5 * (1 - Math.cos(2 * Math.PI * (3 * u - 0.5))) / 2 },   // three buccal cusps
  m2: { name: 'second molar', w: 164, shape: u => 3.5 * (1 - Math.cos(2 * Math.PI * (2 * u - 0.5))) / 2 },  // two buccal cusps
  m3: { name: 'wisdom tooth', w: 152, shape: u => 1 + 4 * (1 - Math.cos(2 * Math.PI * (2 * u - 0.5))) / 2 + u * 2 }
};
function toothTopOffset(kind, u, mirror) {
  if (mirror) u = 1 - u;
  const e = Math.min(u, 1 - u), corner = e < 0.07 ? Math.pow((0.07 - e) / 0.07, 2) * 7 : 0;   // rounded corners
  return TOOTH_KINDS[kind].shape(u) + corner;
}
const ARCH = ['m3', 'm2', 'm1', 'p2', 'p1', 'c', 'i2', 'i1', 'i1', 'i2', 'c', 'p1', 'p2', 'm1', 'm2', 'm3'];
const LEVEL_DEFS = [
  {
    id: 'front', name: 'BITE CLUB', tag: 'LEVEL 1 - TUTORIAL', theme: 'front', width: 2600, top: -60, poolY: 216, keepInView: 200,
    rotRate: 0.05, music: 'main', special: 'floss', start: { x: 30 }, exit: null,
    build(L) {
      L.gum(0, 70, 196);
      L.mound(70, 80, 196, 160, 0.62);                   // the puffy retromolar pad behind the last molar: a gentle slope up
      L.sign(8, 130, '{MOVE} to move');
      L.sign(8, 152, 'Gums are squishy!');
      L.sign(70, 132, '{JUMP} to jump.\nHold it to go higher!');
      L.gems(30, 182, 60, 182, 2);
      L.gems(90, 146, 130, 146, 2);
      const R = L.row(150, 150);                         // the whole lower arch, wearing braces (archwire at y=150)
      R.tooth('m3', 112).gap()
        .at(x => L.sign(x - 60, 112, 'Wisdom tooth! Big molars\nhave bumpy cusps on top.'))
        .tooth('m2', 108)
        .at((x, top) => { L.sign(x - 40, 112, 'PLAQUE! Hold {DOWN} + {JUMP} to drop\nthrough the braces wire, then stand\nnext to it and hold {MED} to scrub.'); L.gems(x - 60, top - 12, x - 20, top - 12, 3); })
        .pocket(26, 200, 'L')                            // a gap between teeth: gum pocket with plaque, the braces wire across it
        .at(x => L.sign(x + 46, 112, 'A CAVITY! Stand on it\nand hold {MED} to fill it.'))
        .tooth('m1', 106, true)
        .at((x, top) => { L.enemy('blob', x - 40, top - 6); L.sign(x - 128, 112, 'GERM! {SHOOT} to zap it.'); })
        .gap().tooth('p2', 100)
        .at(x => L.sign(x - 70, 112, 'You can also bop\ngerms on the head!'))
        .gap().tooth('p1', 96, true)
        .at((x, top) => L.enemy('blob', x - 50, top - 6))
        .pocket(24, 200, 'R')
        .at(x => L.sign(x - 10, 112, 'First rule of Bite Club:\nnever let the ROT meter fill!'))
        .tooth('c', 88).gap().tooth('i2', 100).gap().tooth('i1', 100)
        .at((x, top) => { L.sign(x - 120, 112, 'Gingivitis germs hop!'); L.enemy('germ', x - 100, top - 6); L.gems(x - 60, top - 14, x - 20, top - 14, 3); })
        .pocket(28, 200, 'L')                            // the gap between the two front teeth
        .midline()
        .tooth('i1', 100).gap().tooth('i2', 100, true).gap().tooth('c', 88)
        .at((x, top) => { L.sign(x - 170, 112, 'Too many germs? {SPECIAL} unleashes\nFLOSS FRENZY! Only 2 per level.'); L.enemy('blob', x - 120, top + 6); L.enemy('germ', x - 60, top); })
        .pocket(24, 200, 'R')
        .tooth('p1', 96).gap().tooth('p2', 100, true)
        .at((x, top) => { L.enemy('germ', x - 50, top - 6); L.mint(x - 120, top - 20); L.sign(x - 150, 112, 'Mint leaves heal you.'); })
        .gap().tooth('m1', 106, true)
        .at((x, top) => { L.enemy('blob', x - 110, top - 6); L.enemy('blob', x - 40, top - 6); L.gems(x - 130, top - 14, x - 90, top - 14, 3); })
        .pocket(26, 200, 'L')
        .tooth('m2', 108, true)
        .at((x, top) => { L.enemy('germ', x - 70, top - 6); L.sign(x - 150, 112, 'Clean every spot to\nbreak the tartar plug.'); })
        .crevice(34)                                     // the gum has pulled away between the last two molars
        .tooth('m3', 112);
      const end = R.x;
      L.mound(end, 110, 194, 164, 0.5);                  // the retromolar pad again, at the very back of the jaw
      L.finish(end + 110);
    }
  },
  {
    id: 'root', name: 'TARTARUS', tag: 'LEVEL 2', theme: 'root', width: 2080, top: -200, poolY: 218,
    rotRate: 0.07, music: 'cave', special: null, start: { x: 50, y: 0 }, dark: true,
    exit: { x: 1960, y: -230, w: 120, h: 200, kind: 'up' },
    arena: { x1: 1640, x2: 1960, lockR: 2080, safe: { x: 1652, y: 176 }, camY: 50 },
    build(L) {
      L.ceil(0, 30, 60); L.ceil(90, 1870, 60);
      L.rock(0, 260, 190);
      L.rock(304, 200, 182); L.nerve(372, 44, 182); L.decay(462, 182);   // chasm 260..304
      L.rock(504, 230, 190); L.decay(620, 190);
      L.rock(780, 110, 172);                           // chasm 734..780
      L.rock(890, 190, 186); L.rock(940, 60, 150, 12); L.decay(970, 150); L.nerve(1012, 46, 186);
      // deeper in: a second stretch of roots and nerves (chasm 1080..1120)
      L.rock(1120, 140, 178); L.nerve(1170, 44, 178);
      L.rock(1302, 120, 190); L.rock(1340, 40, 150, 12); L.decay(1400, 190);   // chasm 1260..1302
      L.rock(1472, 168, 186); L.nerve(1500, 40, 186);                       // chasm 1422..1472
      // Gingi's lair: infected roots at both edges, meltable gum tissue between
      L.rock(1640, 40, 176); L.node('root', 1660, 176);
      for (let x = 1680; x < 1920; x += 40) L.gum(x, 40, 192, 'gum', true);
      L.gumpad(1714, 46, 150); L.gumpad(1840, 46, 150); L.gumpad(1777, 46, 116);
      L.rock(1920, 40, 176); L.node('root', 1940, 176);
      L.rock(1960, 120, 190);                          // exit shaft
      L.ledge(1968, 40, 152); L.ledge(2028, 40, 118); L.ledge(1968, 40, 84);
      L.plug(1960, 50, 120, 10);
      L.ledge(2028, 40, 50); L.ledge(1968, 40, 16); L.ledge(2028, 40, -18);

      L.enemy('mite', 200, 60);
      L.enemy('spitter', 340, 182);
      L.enemy('blob', 560, 190);
      L.enemy('mite', 660, 60);
      L.enemy('spitter', 846, 172);
      L.enemy('mite', 1030, 60);
      L.enemy('mite', 1220, 60);
      L.enemy('blob', 1360, 190);
      L.enemy('mite', 1420, 60);
      L.enemy('spitter', 1580, 186);
      L.enemy('gingi', 1800, 190, { x1: 1680, x2: 1920 });

      L.gems(266, 178, 316, 172, 3, 22);
      L.gems(740, 176, 790, 164, 3, 22);
      L.gems(1086, 172, 1120, 164, 2, 18);
      L.gems(1266, 172, 1300, 178, 2, 18);
      L.gems(1346, 140, 1374, 140, 2);
      L.gems(1428, 176, 1468, 174, 3, 20);
      L.mint(1060, 176);
      L.mint(1620, 172);

      L.sign(110, 110, 'Welcome to TARTARUS...');
      L.sign(330, 120, 'Nerves spark on and off.\nTime your jump!');
      L.sign(560, 124, "Too deep for specials.\nNo signal down here!");
    }
  },
  {
    id: 'back', name: 'THE DARK SIDE OF THE MOLAR', tag: 'LEVEL 3', theme: 'back', width: 2400, top: 0, poolY: 216,
    rotRate: 0.04, music: 'back', special: 'brush', start: { x: 40 }, exit: null,
    build(L) {
      // We see the backs of the teeth here, top to bottom: walk along the tops, drop down their backs,
      // and climb the ridges to scrub tartar at the gumline, where the germs hang out.
      const FLOOR = 204;
      L.sign(6, 120, 'Behind the molars!\nWalk the tops, or\nclimb the ridges\ndown to the gums.');
      const R = L.backRow(110, FLOOR);
      R.tooth('m3', 118, { low: 'l', mid: 'r' })
        .at(x => L.sign(x - 110, 58, 'Hold {DOWN} + {JUMP} on a tooth\ntop to drop down its back.'))
        .tooth('m2', 114, { low: 'r', mid: 'l', plaque: true, cavity: true })
        .at(x => { L.sign(x - 120, 150, 'Tartar builds up down here.\nGerms love it, too!'); L.enemy('crab', x - 60, FLOOR, { range: 40 }); })
        .tooth('m1', 112, { low: 'l', mid: 'r', plaque: true })
        .at(x => { L.sign(x - 150, 58, 'Tartar crabs block zaps from the\nfront. Bop them or zap them\nfrom behind!'); L.enemy('bug', x - 140, 140, { range: 160 }); })
        .tooth('p2', 110, { low: 'r', mid: 'l', cavity: true })
        .tooth('p1', 108, { low: 'f', plaque: true })
        .at(x => { L.enemy('spitter', x - 30, FLOOR); L.sign(x - 140, 58, 'Acid spitters lob goo.\nKeep moving!'); })
        .tooth('c', 100, { low: 'l', mid: 'r' })
        .tooth('i2', 112, { low: 'r', mid: 'f', plaque: true })
        .at(x => { L.enemy('blob', x - 40, FLOOR, { range: 40 }); L.mint(x - 30, 128); })
        .tooth('i1', 112, { low: 'l', mid: 'r' })
        .midline()
        .tooth('i1', 112, { low: 'r', mid: 'l', plaque: true })
        .at(x => { L.enemy('crab', x - 40, FLOOR, { range: 36 }); L.enemy('germ', x - 30, 112); })
        .tooth('i2', 112, { low: 'l', mid: 'r' })
        .tooth('c', 100, { low: 'r', mid: 'l' })
        .at(x => L.enemy('bug', x - 120, 140, { range: 160 }))
        .tooth('p1', 108, { low: 'f', mid: 'l', cavity: true })
        .tooth('p2', 110, { low: 'l', mid: 'r', plaque: true })
        .at(x => L.enemy('spitter', x - 40, FLOOR))
        .tooth('m1', 112, { low: 'r', mid: 'l', cavity: true, plaque: true })
        .at(x => { L.enemy('blob', x - 60, FLOOR, { range: 50 }); L.enemy('germ', x - 50, 112); })
        .tooth('m2', 114, { low: 'l', mid: 'r', cavity: true })
        .at(x => L.enemy('crab', x - 60, FLOOR, { range: 44 }))
        .tooth('m3', 118, { low: 'r', mid: 'l', plaque: true });
      const end = R.x;
      L.gum(0, end + 220, FLOOR);                       // the gums at the base of every tooth
      L.gems(20, 192, 90, 192, 3);
      L.gems(end + 30, 192, end + 110, 192, 3);
      L.exitAt({ x: end + 140, y: 120, w: 56, h: 90, kind: 'door', label: 'TONGUE' });
      L.finish(end + 220);
    }
  },
  {
    id: 'tongue', name: 'TONGUE-FU', tag: 'LEVEL 4', theme: 'tongue', width: 2800, top: -60, poolY: 216,
    rotRate: 0.07, music: 'tongue', special: 'rinse', start: { x: 40 },
    exit: { x: 2380, y: 40, w: 120, h: 190, kind: 'boss' },
    arena: { x1: 2320, x2: 2800, camY: 42 },
    tongue: { base: 182, wave: 2, flat: 2300, hills: [[9, 0.010, 0.4], [5, 0.024, 1.3], [3, 0.051, 2.2]] },
    build(L) {
      [300, 640, 980, 1320, 1700, 2060].forEach(x => L.coat(x));     // furry tongue coating, where bad breath brews
      L.ulcer(480, 16); L.ulcer(820, 16); L.ulcer(1160, 18); L.ulcer(1520, 16); L.ulcer(1880, 18);   // canker sores
      L.gate(2280, -200, 260);                                       // a wall of stench in front of Hal's (Halitosis's) lair

      L.enemy('germ', 380, 170);
      L.enemy('bug', 560, 112, { range: 140 });
      L.enemy('blob', 720, 170);
      L.enemy('germ', 900, 170);
      L.enemy('bug', 1040, 104, { range: 140 });
      L.enemy('blob', 1240, 170);
      L.enemy('germ', 1400, 170);
      L.enemy('germ', 1600, 170);
      L.enemy('bug', 1760, 108, { range: 150 });
      L.enemy('blob', 1980, 170);
      L.enemy('bug', 2000, 112, { range: 140 });
      L.enemy('germ', 2150, 170);

      L.gems(150, 150, 260, 150, 4, 10);
      L.gems(560, 140, 700, 140, 4, 16);
      L.gems(1020, 140, 1180, 140, 4, 16);
      L.gems(1600, 140, 1760, 140, 4, 16);
      L.gems(1950, 140, 2120, 140, 4, 16);
      L.mint(1270, 150);
      L.mint(2200, 150);

      L.sign(16, 104, 'The tongue is bouncy!\nBig drops bounce you back up.');
      L.sign(220, 100, 'Tongue gunk = bad breath.\nHold {MED} to scrub it off!');
      L.sign(430, 100, 'Canker sores sting.\nDon\'t land on them!');
      L.sign(700, 100, 'Watch for big ripples!\nJump them or get launched.');
      L.sign(2170, 96, 'Clean up to clear the\nwall of stench!', 'The stench is lifting...\nSomething stirs!');
    }
  }
];

function buildLevel(def) {
  const BOTTOM = 460;
  const L = {
    def, name: def.name, theme: def.theme, width: def.width, top: def.top, poolY: def.poolY, deathY: def.poolY + 24,
    terrain: [], spots: [], nodes: [], enemies: [], gems: [], mints: [], signs: [], nerves: [], ulcers: [], plugs: [], gate: null,
    exit: def.exit, arena: def.arena || null,
    tongue: def.tongue ? Object.assign({ kind: 'tongue', bouncy: true, x0: 0, x1: def.width, pulses: [] }, def.tongue) : null
  };
  const add = o => (L.terrain.push(o), o);
  // one tooth: a drawn piece plus thin collision slices along its outline (solid teeth, or drop-through tops)
  const shapedTooth = (x, kind, top, mirror, sliceKind, solid) => {
    const w = TOOTH_KINDS[kind].w, t = add({ kind: 'tooth', x, y: top, w, h: BOTTOM - top, style: kind, mirror, slices: [] });
    for (let sx = 0; sx < w; sx += 8) {
      const sw = Math.min(8, w - sx), y = Math.round(top + toothTopOffset(kind, (sx + sw / 2) / w, mirror));
      t.slices.push(add(solid ? { kind: sliceKind, solid: true, x: x + sx, y, w: sw, h: BOTTOM - y, tooth: t }
                              : { kind: sliceKind, oneway: true, x: x + sx - (sx ? 0 : 2), y, w: sw + (sx + sw >= w ? 2 : 0) + (sx ? 0 : 2), h: 6, tooth: t }));
    }
    return t;
  };
  const jitter = x => { const h = Math.sin(x * 12.9898) * 43758.5453; return Math.round((h - Math.floor(h) - 0.5) * 4); };   // ±2px
  const api = {
    // a soft, rounded rise of gum (y0 at its left edge up to y1), walkable in thin steps
    mound: (x, w, y0, y1, rise) => {
      const prof = u => u >= rise ? y1 : y0 + (y1 - y0) * (1 - Math.cos(Math.PI * u / rise)) / 2;
      const m = add({ kind: 'mound', x, y: y1, w, h: BOTTOM - y1, y0, rise, skin: 'gum', seamless: true });
      for (let sx = 0; sx < w; sx += 5) { const sw = Math.min(5, w - sx); add({ kind: 'gum', solid: true, hidden: true, mound: m, x: x + sx, y: Math.round(prof((sx + sw / 2) / w)), w: sw, h: BOTTOM - Math.round(prof((sx + sw / 2) / w)), skin: 'gum' }); }
    },
    gum: (x, w, y, skin, melt) => add({ kind: 'gum', solid: true, x, y, w, h: BOTTOM - y, skin: skin || 'gum', melt: !!melt, seamless: !!melt }),
    tooth: (x, w, y, style) => add({ kind: 'tooth', solid: true, x, y, w, h: BOTTOM - y, style: style || 'incisor' }),
    rock: (x, w, y, h) => add({ kind: 'rock', solid: true, x, y, w, h: h || BOTTOM - y }),
    ceil: (x, w, y1) => add({ kind: 'ceil', solid: true, x, y: def.top - 300, w, h: y1 - (def.top - 300) }),
    plug: (x, y, w, h) => { const p = add({ kind: 'plug', solid: true, x, y, w, h }); L.plugs.push(p); return p; },
    gate: (x, y1, y2) => (L.gate = add({ kind: 'gate', solid: true, x, y: y1, w: 12, h: y2 - y1, open: 0 })),
    floss: (x, w, y) => add({ kind: 'floss', oneway: true, x, y, w, h: 3 }),
    wire: (x, w, y) => add({ kind: 'wire', oneway: true, x, y, w, h: 3 }),
    shelf: (x, w, y) => add({ kind: 'shelf', oneway: true, x, y, w, h: 6 }),
    ledge: (x, w, y) => add({ kind: 'ledge', oneway: true, x, y, w, h: 6 }),
    gumpad: (x, w, y) => add({ kind: 'gumpad', oneway: true, x, y, w, h: 6, melt: true }),
    node: (kind, x, y) => L.nodes.push({ kind, x, y }),
    papilla: (x, w, y, amp, phase) => add({ kind: 'papilla', oneway: true, x, y, w, h: 9, baseY: y, amp, phase, dy: 0 }),
    cavity: (x, y) => L.spots.push({ kind: 'cavity', x, y }),
    plaque: (x, y) => L.spots.push({ kind: 'plaque', x, y }),
    decay: (x, y) => L.spots.push({ kind: 'decay', x, y }),
    enemy: (type, x, y, o) => L.enemies.push(Object.assign({ type, x, y }, o || {})),
    gems: (x1, y1, x2, y2, n, arc) => {
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        L.gems.push({ x: lerp(x1, x2, t), y: lerp(y1, y2, t) - Math.sin(t * Math.PI) * (arc || 0) });
      }
    },
    mint: (x, y) => L.mints.push({ x, y }),
    sign: (x, y, text, textDone) => { if (text) L.signs.push({ x, y, text, textDone }); },
    nerve: (x, w, y) => L.nerves.push({ x, w, y }),
    coat: x => L.spots.push({ kind: 'coat', x, y: null }),
    ulcer: (x, w) => L.ulcers.push({ x, w }),
    exitAt: o => { L.exit = o; },
    // the backs of the teeth, seen whole: a face from the top edge down to the gums, a thin top edge you can
    // drop through, and ridges/bulges on the back to climb (low = tartar ridge, mid = cingulum; 'l'/'r'/'f' = side)
    backRow: (x0, floorY) => {
      let cx = x0, mirror = false;
      const r = {
        get x() { return cx; },
        tooth(kind, top, o) {
          o = o || {}; top += jitter(cx);
          const t = shapedTooth(cx, kind, top, mirror, 'crown', false), w = t.w;
          t.kind = 'backface'; t.h = floorY - top;
          const part = (side, y, kind) => {
            if (!side) return;
            const pw = side === 'f' ? w - 8 : Math.round(w * 0.55);
            add({ kind, oneway: true, x: side === 'l' ? cx + 2 : side === 'r' ? cx + w - 2 - pw : cx + 4, y, w: pw, h: 6 });
          };
          part(o.mid, top + 34, 'cingulum');
          part(o.low, floorY - 32, 'ridge');
          if (o.cavity) api.cavity(cx + Math.round(w / 2), t.slices.find(k => cx + w / 2 >= k.x && cx + w / 2 < k.x + k.w).y);
          if (o.plaque) api.plaque(cx + Math.round(w / 2), floorY);
          cx += w; return r;
        },
        midline() { mirror = true; return r; },
        gap(w) { cx += w; return r; },
        at(fn) { fn(cx); return r; }
      };
      return r;
    },
    finish: w => { L.width = w; if (L.tongue) L.tongue.x1 = w; },
    // a row of teeth laid side by side (wireY = braces archwire height, or none)
    row: (x0, wireY) => {
      let cx = x0, lastTop = 160, mirror = false;
      const r = {
        get x() { return cx; },
        tooth(kind, top, cavity) {
          top += jitter(cx);                             // no two teeth quite the same height
          const t = shapedTooth(cx, kind, top, mirror, 'slice', true);
          if (wireY) t.braces = wireY;
          if (cavity) api.cavity(cx + Math.round(t.w / 2), t.slices.find(k => cx + t.w / 2 >= k.x && cx + t.w / 2 < k.x + k.w).y);
          cx += t.w; lastTop = top; return r;
        },
        midline() { mirror = true; return r; },          // past the middle of the arch the teeth face the other way
        gap(w) { w = w || 3; api.gum(cx, w, 194); cx += w; return r; },               // teeth touching
        pocket(w, gumY, plaque) {                                                    // sunken gum between teeth
          api.gum(cx, w, gumY);
          if (wireY) api.wire(cx - 4, w + 8, wireY);                   // braces wire across: drop through it
          if (plaque) api.plaque(plaque === 'L' ? cx + 7 : cx + w - 7, gumY);
          cx += w; return r;
        },
        flat(w, gumY) { api.gum(cx, w, gumY); cx += w; return r; },                 // open gum, no teeth
        at(fn) { fn(cx, lastTop); return r; },                                       // place signs/enemies/etc. right here
        missing(w, gumY) { api.gum(cx, w, gumY); if (wireY) api.wire(cx - 6, w + 12, wireY); cx += w; return r; },
        shelf(w, y, gumY, plaque) { api.shelf(cx, w, y); return r.pocket(w, gumY, plaque); },
        floss(w, y, gumY, plaque) { api.floss(cx, w, y); return r.pocket(w, gumY, plaque); },
        crevice(w) {                                     // receded gum between two teeth: a tartar-plugged way down under the gums
          api.plug(cx, 196, w, 12);
          if (wireY) api.wire(cx - 4, w + 8, wireY);
          L.exit = { x: cx + 2, y: 206, w: w - 4, h: 40, kind: 'hole' };
          cx += w; return r;
        }
      };
      return r;
    }
  };
  def.build(api);
  scaleLevel(L, def);
  return L;
}
/* Blows the finished level up from 1x level pixels to world pixels. */
function scaleLevel(L, def) {
  const s = v => v == null ? v : v * WS;
  const scale = (o, keys) => { for (const k of keys) if (typeof o[k] === 'number') o[k] *= WS; return o; };
  const XYWH = ['x', 'y', 'w', 'h'];
  L.width = s(L.width); L.top = s(L.top); L.poolY = s(L.poolY); L.deathY = L.poolY + 24;
  L.start = { x: s(def.start.x), y: s(def.start.y) };
  L.exit = scale(Object.assign({}, L.exit), XYWH);
  if (L.arena) L.arena = { x1: s(L.arena.x1), x2: s(L.arena.x2), lockR: s(L.arena.lockR), camY: s(L.arena.camY),
    safe: L.arena.safe && { x: s(L.arena.safe.x), y: s(L.arena.safe.y) } };
  if (L.tongue) { scale(L.tongue, ['base', 'wave', 'flat', 'x0', 'x1']); L.tongue.hills = L.tongue.hills.map(([a, k, ph]) => [a * WS, k / WS, ph]); }
  for (const t of L.terrain) scale(t, ['x', 'y', 'w', 'h', 'baseY', 'amp', 'braces', 'y0']);
  for (const list of [L.spots, L.nodes, L.gems, L.mints, L.signs]) for (const o of list) scale(o, ['x', 'y']);
  for (const e of L.enemies) scale(e, ['x', 'y', 'range', 'x1', 'x2']);
  for (const n of L.nerves) scale(n, ['x', 'y', 'w']);
  for (const u of L.ulcers) scale(u, ['x', 'w']);
}
// </LEVELS>
