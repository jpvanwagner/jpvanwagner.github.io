'use strict';
/* ============================== GAME STATE ============================== */
const G = {
  state: 'title', t: 0, levelIdx: 0, L: null, world: null, player: null, cam: { x: 0, y: 0 }, camLook: 0,
  spots: [], nodes: [], bubbles: [], drops: [], ulcers: [], coats: [], enemies: [], bolts: [], foes: [], parts: [], pops: [], gems: [], mints: [], nerves: [],
  specials: 0, special: null, wind: 0, fight: false, hints: {},
  score: 0, rot: 0, stats: null, snap: null, shake: 0, banner: 0, fade: 0, fadeTo: null,
  boss: null, lock: null, clean: false, noHit: true, cleanTimer: 0, bossBar: 0, deathReason: '', dieT: 0, exitT: 0,
  medHintT: 0, tutorial: false, introSeen: false
};
const freshStats = () => ({ cleaned: 0, germs: 0, gems: 0, frames: 0, reached: 0 });

/* ============================== WORLD ============================== */
function makeWorld(L) {
  const solids = L.terrain.filter(t => t.solid), oneways = L.terrain.filter(t => t.oneway);
  for (const t of L.terrain) {
    if ((t.kind === 'gum' && !t.hidden) || t.kind === 'mound') t.dent = { x: t.x + t.w / 2, d: 0, v: 0 };   // a mound squishes as one piece
    if (t.kind === 'floss' || t.kind === 'wire') t.sag = { x: t.x + t.w / 2, d: 0, v: 0 };
  }
  // which gum touches each side of a tooth (for the gum collar drawn around its base)
  const gumAt = x => L.terrain.find(g => g.kind === 'gum' && x >= g.x && x < g.x + g.w);
  for (const t of L.terrain) if (t.kind === 'tooth' || t.kind === 'backface') {
    const gl = gumAt(t.x - 1), gr = gumAt(t.x + t.w);
    t.gl = gl ? gl.y : null; t.gr = gr ? gr.y : null;
    t.skinL = gl ? gl.skin : 'gum'; t.skinR = gr ? gr.skin : 'gum';
  }
  // gum only rounds off (and shows a seam) where it drops away; next to teeth or higher ground it runs on smoothly
  const topAt = x => { let y = null; for (const o of L.terrain) if ((o.solid || o.kind === 'tooth') && o.kind !== 'ceil' && x >= o.x && x < o.x + o.w && (y == null || o.y < y)) y = o.y; return y; };
  for (const t of L.terrain) if (t.kind === 'gum') {
    const l = topAt(t.x - 0.5), r = topAt(t.x + t.w + 0.5);
    t.roundL = l == null || l > t.y + 3; t.roundR = r == null || r > t.y + 3;
  }
  if (L.tongue) L.tongue.dent = { x: 0, d: 0, v: 0 };
  return { solids, oneways, movers: oneways.filter(o => o.kind === 'papilla'), left: 0, right: L.width, deathY: L.deathY, tongue: L.tongue, time: 0 };
}
function groundAt(x, y) {
  for (const s of G.world.solids) if (!s.off && x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return s;
  for (const p of G.world.oneways) if (!p.off && x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + 5) return p;
  const T = G.world.tongue;
  if (T && x >= T.x0 && x <= T.x1 && y >= tongueY(T, x, G.t) - 1) return T;
  return null;
}
const surfaceUnder = x => {      // highest standable top under x (used for spawning)
  let best = null;
  for (const t of G.L.terrain) if ((t.solid || t.oneway) && t.kind !== 'ceil' && x >= t.x && x < t.x + t.w && (!best || t.y < best.y)) best = t;
  return best;
};

function loadLevel(idx) {
  const def = LEVEL_DEFS[idx];
  G.levelIdx = idx; G.L = buildLevel(def); G.world = makeWorld(G.L);
  const L = G.L;
  G.spots = L.spots.map(s => new Spot(s));
  G.enemies = L.enemies.map(makeEnemy);
  if (L.def.id === 'root') G.spots.push(Object.assign(new Spot({ kind: 'boss', x: 0, y: 0 }), { boss: G.enemies.find(e => e.kind === 'gingi') }));
  G.nodes = L.nodes.map(n => new HealNode(n)); G.bubbles = []; G.drops = []; G.fight = false; G.wind = 0; G.special = null;
  G.specials = def.special ? 2 : 0; G.hints = {};
  G.gems = L.gems.map(g => ({ x: g.x, y: g.y, taken: false }));
  G.mints = L.mints.map(m => ({ x: m.x, y: m.y, taken: false }));
  G.nerves = L.nerves.map(n => Object.assign({ t: Math.floor(n.x) % 170 }, n));
  G.signs = L.signs; refreshSigns();
  G.bolts = []; G.foes = []; G.parts = []; G.pops = [];
  G.rot = 0; G.boss = null; G.lock = null; G.clean = false; G.noHit = true; G.cleanTimer = 0; G.exitT = 0; G.bossBar = 0;
  G.gingiMet = false; G.cleanTalkT = 0; G.arenaWall = null; G.cleanMsg = null;
  const sx = L.start.x, surf = surfaceUnder(sx), floor = surf ? surf.y : tongueY(L.tongue, sx, G.t);
  G.player = new Player(sx, L.start.y != null ? L.start.y : floor - PHYS.PH);
  G.player.lastSafe = { x: sx, y: floor - PHYS.PH };
  G.ulcers = L.ulcers; G.coats = []; G.pulseT = 240;
  G.cam.x = clamp(sx - VW / 2, 0, L.width - VW); G.cam.y = clamp(G.player.y - VH * 0.58, L.top, L.poolY + 28 - VH); G.camLook = 0; G.camFloor = null;
  G.banner = 170;
  G.stats.reached = Math.max(G.stats.reached, idx);
  G.snap = { score: G.score, stats: Object.assign({}, G.stats) };
  $('levelName').textContent = def.name; $('levelName').classList.remove('shown');
  $('bossBar').classList.remove('on');
  AudioSys.music(def.music);
  buildSpotIcons(); updateHud(true);
}
