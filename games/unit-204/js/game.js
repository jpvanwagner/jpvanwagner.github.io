'use strict';
/* ============================== GAME ==============================
   State, the two characters, mouse/keyboard input, and what each verb or tool does in a room. */
class Walker {
  constructor(who, speed) { this.who = who; this.x = 0; this.z = 8; this.tx = 0; this.tz = 8; this.face = 1; this.speed = speed; this.phase = 0; this.idle = 0; this.then = null; this.moving = false; this.pose = null; }
  place(x, z) { this.x = this.tx = x; this.z = this.tz = z; this.route = []; this.then = null; this.moving = false; this.pose = null; this.followed = null; }
  goTo(x, z, then) {
    const w = ROOMS[Game.room].walk, f = Obstacles.free(clamp(x, w.x0, w.x1), clamp(z, w.z0, w.z1));   // never into a machine or a table (js/obstacles.js)
    this.route = Obstacles.route(this.x, this.z, f.x, f.z); [this.tx, this.tz] = this.route.shift();
    this.then = then || null; this.idle = 0; this.pose = null;
    if (!this.route.length && Math.hypot(this.tx - this.x, this.tz - this.z) < .08) { this.moving = false; const t = this.then; this.then = null; if (t) t(); }
  }
  update(dt) {
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz);
    if (d > .04) {
      const step = Math.min(d, this.speed * dt * (this.z / 8 + .4));
      this.x += dx / d * step; this.z += dz / d * step; this.moving = true; this.idle = 0;
      if (Math.abs(dx) > .02) this.face = dx > 0 ? 1 : -1;
      this.phase += step * 3.2;
    } else {
      if (this.route && this.route.length) { [this.tx, this.tz] = this.route.shift(); return; }   // on to the next corner around an obstacle
      if (this.moving) { this.moving = false; this.x = this.tx; this.z = this.tz; }
      this.idle += dt;
      if (this.then) { const t = this.then; this.then = null; t(); }
    }
  }
  screen(x = this.x, z = this.z) { const [sx, sy] = P(x, 0, z); return { sx, sy, s: clamp(.62 + 2.4 / z, .78, 1.14) }; }
  sprite(t) {
    const o = {};
    if (this.moving) { const k = Math.sin(this.phase * Math.PI); o.walk = true; o.step = Math.round(k * 2) / 2; o.bob = Math.abs(k) > .7 ? -1 : 0; }
    else if (this.pose) o.pose = this.pose;
    else if (this.who === 'you' && this.idle > 4 && (this.idle - 4) % 9 < 1.6) o.pose = 'clip';   // now and then, a glance at the clipboard
    else if (this.who === 'dana' && this.idle > 4 && !UI.talking('dana')) o.pose = 'phone';
    if (!this.moving) o.breath = Math.floor(t / 1.1 + (this.who === 'dana' ? .5 : 0)) % 2 === 1;   // idle: a slow breath, shoulders and head up a pixel
    o.blink = (t * 1000 + (this.who === 'dana' ? 1700 : 0)) % 3900 < 130;
    o.talk = UI.talking(this.who) && Math.floor(t * 8) % 2 === 0;
    if (this.who === 'you' && PPE.on()) o.ppe = PPE.all().filter(id => PPE.has(id)).join(',');   // whatever you've put on shows
    if (this.who === 'dana' && PPE.on()) o.ppe = PPE.all().join(',');   // Dana's already suited up when you get there
    return Sprites.get(this.who, o, this.screen().s);
  }
  rect(x, z) { const { sx, sy, s } = this.screen(x, z); return { x0: sx - 13 * s, x1: sx + 13 * s, y0: sy - (SPR_H - 4) * s, y1: sy }; }
  draw(g, t) {
    const { sx, sy, s } = this.screen(), spr = this.sprite(t), w = spr.width, h = spr.height;   // drawn at its real size, never stretched
    g.fillStyle = ditherPx('#1a1222', 9); g.beginPath(); g.ellipse(sx, sy - 1, 11 * s, 3 * s, 0, 0, 7); g.fill();
    g.save(); g.imageSmoothingEnabled = false;
    if (this.face < 0) { g.translate(Math.round(sx), 0); g.scale(-1, 1); g.drawImage(spr, Math.round(-w / 2), Math.round(sy - h + 2), w, h); }
    else g.drawImage(spr, Math.round(sx - w / 2), Math.round(sy - h + 2), w, h);
    g.restore();
  }
  head() { const { sx, sy, s } = this.screen(); return [sx, sy - SPR_H * s - 2]; }
}

/* what Touch does to a feature from across the room, without opening the close-up */
/* clicking on nothing in particular: a cobweb, the ceiling, or plain wall, with something to say for each tool */
const WEBS = { living: 'x0', bath: 'x1', bedroom: 'x0' };     // the corner each room's cobweb is tucked into
function blankAt(room, x, y) {
  const b = ROOMS[room].box;
  if (WEBS[room]) { const [wx, wy] = P(b[WEBS[room]], b.h, b.zb); if (Math.abs(x - wx) < 11 && Math.abs(y - wy) < 9) return 'web'; }
  // a window (frame and all) never reads as plain wall, even where no close-up hotspot covers it
  for (const w of ROOMS[room].windows || []) if (inPoly(growPoly(Q.back(b, w.xa, w.xb, w.ya, w.yb), 4), x, y)) return w.frosted ? 'frosted' : 'window';
  return inPoly(Q.ceil(b, b.x0, b.x1, 1.5, b.zb), x, y) ? 'ceiling' : 'wall';
}
const BLANK = {
  web: {
    look: ['A cobweb in the corner, long abandoned. The spider moved out before the tenant did.', 'Cobweb. Not damage, just a duster away from gone.', 'A little web up in the corner. Housekeeping, not maintenance.'],
    touch: "Out of reach, and you'd rather not. Make-ready can take a duster to it.",
    smell: "It smells like nothing. Cobwebs are odorless, as far as you know.",
    talk: "\"Anybody home?\" The web doesn't answer. Nobody's home.",
    camera: "Not worth a photo. Nobody's charging a deposit for a cobweb.",
    clipboard: "Cobwebs aren't on the form. Make-ready will dust.",
    flashlight: 'The light catches a few strands and one long-dead fly. No spider.',
    any: "That's a cobweb. Leave it for the cleaning crew."
  },
  ceiling: {
    look: ['Popcorn ceiling. Very 1998.', 'The ceiling. No water stains, no sag, no cracks. Good.', 'Ceiling texture, the bumpy kind. Hard to clean, easy to ignore.'],
    touch: "You can't reach the ceiling, and you're not climbing the counters.",
    smell: 'You sniff upward, feeling a little silly. Nothing.',
    talk: 'You address the ceiling. The ceiling, like most tenants, has no comment.',
    hammer: "You'd need a ladder, and the ceiling's fine anyway.",
    flashlight: 'You sweep the light across the ceiling. No stains, no cracks, no surprises.',
    camera: 'A photo of a perfectly good ceiling. The file can live without it.',
    clipboard: 'The ceiling looks fine. Nothing to mark.',
    any: 'The ceiling. Nothing wrong with it.'
  },
  window: {
    look: ['The window frame. Vinyl, a little sun-faded, solidly caulked.', 'Window trim, painted and plain. The glass itself is where the view is.'],
    touch: 'The frame is solid. No soft spots, no drafts.', smell: 'Window cleaner, faintly, and outside air.',
    talk: 'You tell the window it\'s doing a great job. It reflects on that.', flashlight: 'The light shows clean caulk along the frame. No gaps.',
    camera: 'Try the glass itself for a better shot.', clipboard: 'The frame is fine. Nothing to mark.', any: "It's the window frame. Look at the glass for a closer view."
  },
  frosted: {
    look: ['The edge of the frosted window. Light, and nothing else.', 'Frosted glass, frosted on purpose. Privacy, 1998-style.'],
    touch: 'Bumpy glass, cool to the touch.', smell: 'A little mildew-resistant caulk. Normal for a bathroom.',
    talk: 'The frosted window keeps its secrets.', flashlight: 'The beam turns the frosted glass into a soft white glow.',
    camera: 'Try the middle of the glass for a better shot.', clipboard: 'Nothing to mark on the frame.', any: "It's the frosted bathroom window. Look at the glass for a closer view."
  },
  wall: {
    look: ['Just wall. Nicely painted wall.', 'Plain wall, eggshell finish. Nothing wrong with it.', 'Nothing special there.'],
    touch: 'Smooth, dry, solid. Just a wall.',
    smell: 'Faint paint smell, and a little dust. Normal.',
    talk: 'You talk to the wall. It listens better than some tenants.',
    hammer: 'Tap, tap. Solid. Nothing behind there but a stud.',
    flashlight: 'Raking light across the wall: no patches, no dents. Clean.',
    camera: 'A photo of plain wall. Not useful.',
    clipboard: "There's nothing there to mark.",
    any: 'Nothing there.'
  }
};
const UNITS = ['112', '118', '207', '215', '303', '311', '316', '402', '409', '417'];   // later shifts, elsewhere in the building
/* a way out: a door to another area, or the front door that ends the shift (outlined in cyan, not cream) */
const shiftExit = h => !!h && h.id === Sites.site.exit.id;   // the site's way out (the apartment's front door, the office entry, the warehouse exit, the jobsite gate)
const isExit = h => !!h && (h.kind === 'door' || shiftExit(h));
const ROOM_TOUCH = { fridge: 'handle', sink: 'cabinet', closet: 'knob', stove: 'oven', dishwasher: 'door', patio: 'slats' };

const Game = {
  mode: 'title', room: 'living', tool: 'look', t: 0,
  cond: {}, required: new Set(), anomalies: [], flags: {}, marks: {}, notes: {}, clues: {}, photos: {}, gallery: [], opened: {}, taken: new Set(), bag: [], from: {}, jotted: new Set(),
  shots: 0, actions: 0, seen: new Set(), asked: new Set(), hintIx: 0, smallTalk: 0,
  player: new Walker('you', 3.4), dana: new Walker('dana', 3.0),
  hover: null, mouse: null, fade: 0, start: 0, idle: 0, nextBark: 30, hots: [],

  newShift() {                                                    // (window views get condition 0: you can only look at them)
    this.shiftNo = (this.shiftNo || 0) + 1;                       // the first shift is Unit 204; after that, another unit in the building
    this.unit = this.shiftNo === 1 ? '204' : pick(UNITS.filter(u => u !== this.unit));
    for (const id of ['markUnit', 'endUnit']) if ($(id)) $(id).textContent = this.unit;
    const deal = dealConditions(); this.cond = deal.cond; for (const id in VIEWS) this.cond[id] = 0; this.required = deal.required; this.anomalies = dealAnomalies(); this.flags = {}; this.order = null; this.noted = new Set(); this.marks = {}; this.notes = {}; this.clues = {}; this.photos = {}; this.gallery = [];
    this.opened = { bblinds: true }; PPE.reset(); Openables.reset(); Utilities.reset(); this.taken = new Set(); this.bag = []; this.from = {}; this.jotted = new Set(); Decor.roll(); Doodles.reset(); Birds.reset(); Achievements.newShift(); this.combos = new Set(); this.notified = new Set(); this.maint = null; this.bbOffered = false; Calendar.reset(); this.hoodOn = false;
    this.measures = {}; this.call = null; this.shots = 0; this.actions = 0; this.toldDone = false; this.seen = new Set(); this.asked = new Set(); this.hintIx = 0;
    for (const r of Object.values(ROOMS)) { r.lightsOff = false; r.ventOn = false; }
    Rooms.invalidate(); this.start = performance.now();
    const st = Sites.site.start; this.enter(st, ROOMS[st].start, true);   // each site starts somewhere different (js/sites.js)
    UI.progress(0, this.required.size); Bag.count();
  },
  beginShift() {
    UI.closeAll(); this.newShift(); this.mode = 'play';
    $('game').classList.add('playing', 'tb-hint'); setTimeout(() => $('game').classList.remove('tb-hint'), 6000);
    this.setTool('walk');
    Audio2.music(true); Audio2.ambience(true, ROOMS[Sites.site.start].amb);
    setTimeout(() => Music.prewarm(['call', 'excellent', 'good', 'okay', 'bad']), 4000);   // ready long before the shift ends
    setTimeout(() => UI.say('dana', Sites.site.opener(this.unit)), 700);
    this.nextBark = 40;
  },
  elapsed() { const s = Math.round((performance.now() - this.start) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  enter(id, at, first) {
    this.room = id; this.refreshHots();
    this.player.place(at.x, at.z);
    const w = ROOMS[id].walk, ds = this.danaSpot(clamp(at.x + (at.x > 0 ? -1.4 : 1.4), w.x0, w.x1), clamp(at.z + .6, w.z0, w.z1));
    this.dana.place(ds.x, ds.z);
    this.player.face = at.x > 0 ? -1 : 1; this.dana.face = this.player.face;
    this.fade = first ? 1 : .9; UI.roomName(ROOMS[id].name); UI.hush();
    Audio2.ambience(this.mode === 'play' || first, ROOMS[id].amb);
    PPE.check(id);                                                // on sites with PPE: walking in without it gets you called out (js/ppe.js)
  },
  refreshHots() { this.hots = Rooms.hotspots(this.room); },
  /* people walk, so their outlines follow them: re-outline the live hotspots every frame, and re-check what's under a still mouse */
  liveHots() {
    let any = false;
    for (const h of this.hots || []) if (h.live) { h.pts = h.ptsFn(); h.box = polyBox(h.pts); any = true; }
    if (any && this.mouse) this.updateHover();
  },
  setTool(id) {
    if (!CYCLE.includes(id)) this.lastTool = id;            // so right-click can keep coming back to it (camera, clipboard, hammer...)
    this.tool = id; $('game').className = $('game').className.replace(/\bcur-\S+/g, '').trim() + ' cur-' + id;
    $('game').style.setProperty('--cur-tool', `var(--cur-${id})`);
    UI.syncTools(id);
    if (UI.isOpen('inspectScreen') && Inspect.hover) $('zoomLabel').innerHTML = verbPhrase(id, Inspect.hover.name);
    this.updateHover();
  },
  cycleTool(dir) {
    const list = CYCLE.slice(); if (this.lastTool && !list.includes(this.lastTool)) list.push(this.lastTool);   // the tool you used last rides along in the cycle
    let i = list.indexOf(this.tool) + dir; if (i >= list.length) i = 0; if (i < 0) i = list.length - 1;
    if (UI.isOpen('inspectScreen') && list[i] === 'walk') i = (i + dir + list.length) % list.length;
    this.setTool(list[i]); Audio2.sfx('tick', .8);
  },
  tell(text) { if (text) UI.narrate(text); },            // narration: what you see and do (not spoken)

  /* ---------- marking ---------- */
  mark(fid, cat) {
    this.marks[fid] = { cat, at: this.elapsed() };
    Audio2.synth('stamp'); this.actions++;
    const done = Object.keys(this.marks).length, total = this.required.size, tr = truth(fid);
    UI.progress(done, total);
    if (Settings.get('feedback') === 'now') {
      const ok = tr.cat === cat, part = !ok && acceptable(fid, cat), needPhoto = tr.cat >= 2 && !this.photos[fid];
      if (ok) { Audio2.sfx('chime'); UI.feedback(true, `Correct: ${CATS[tr.cat].name}`, tr.why + (needPhoto ? ' Don\'t forget a photo for the file!' : ''), tr.cat); }
      else if (part) { Audio2.sfx('chime', .5); Achievements.unlock('gray'); UI.feedback('ok', `Acceptable: ${CATS[cat].name}`, `${tr.why} ${CATS[tr.cat].name} is the better call, but this one is defensible.`, tr.cat); }
      else { Audio2.synth('wrong'); UI.feedback(false, `Not quite. It's ${CATS[tr.cat].name}`, tr.why, tr.cat); }
    } else Audio2.sfx('click2');
    Utilities.markedLive(fid, cat);                               // Dana: "it's still live, the panel's in the kitchen"
  },
  clue(fid, key, note) {
    (this.clues[fid] = this.clues[fid] || new Set()).add(key);
    const list = this.notes[fid] = this.notes[fid] || [];
    if (note && !list.includes(note)) { list.push(note); Audio2.synth('pencil'); }
  },

  /* ---------- things in the room you can flip, open, and pick up ---------- */
  toggleLights() {
    if (!Utilities.roomPowered(this.room)) { Audio2.sfx('click'); return this.tell(`Click. Nothing. The ${Utilities.circuitOf(this.room).label} breaker is off, so nothing on it will come on until you flip it back at the panel.`); }
    const r = ROOMS[this.room]; r.lightsOff = !r.lightsOff; Audio2.sfx('click'); Rooms.invalidate(this.room);
    const fix = { living: 'the fan light', kitchen: 'the fluorescent light', bath: 'the vanity light', bedroom: 'the ceiling light' }[this.room];
    if (this.room === 'bath' && !r.lightsOff && cond('mirror') === 3) return this.tell(`Click. ${fix[0].toUpperCase() + fix.slice(1)} comes on with a buzz, and stutters.`);
    if (this.room === 'bedroom' && !r.lightsOff && cond('dome') === 3) return this.tell('Click. The ceiling light comes on, buzzes, and flickers. Something smells hot.');
    this.tell(r.lightsOff ? `Click. You switch off ${fix}.` : `Click. ${fix[0].toUpperCase() + fix.slice(1)} comes on. Works fine.`);
  },
  fanSwitch() {
    const fl = this.flags.fan = this.flags.fan || {}, v = FEATURE.fan.variants[this.cond.fan];
    Audio2.sfx('click'); Rooms.invalidate('living');
    if (!Utilities.on('living')) return this.tell("Click. Nothing. The living room breaker is off, so the fan has no power.");
    if (v.cat === 3) {
      if (fl.wobble && this.t - fl.wobble < 2.6) return;
      fl.wobble = this.t; Audio2.synth('creak');
      this.clue('fan', 'wobble', 'Wall switch: the fan lurched into a violent wobble. Shut it off.');
      return this.tell('The fan lurches into a violent wobble. The mount groans. You flip it back off, fast.' + this.tieFling());
    }
    fl.spin = fl.spin ? 0 : this.t;
    if (!fl.spin) return this.tell('Click. The fan winds down.');
    this.clue('fan', v.key[0], v.cat === 1 ? 'Wall switch: the fan runs with a soft, steady tick. Old, but solid.' : 'Wall switch: the fan runs smooth and quiet.');
    this.tell((v.cat === 1 ? 'The fan spins up with a soft, steady tick.' : 'The fan spins up, smooth and quiet.') + this.tieFling());
  },
  tieFling() {                         // a tie left on a fan blade doesn't stay there once the fan runs
    if (!tieOnFan()) return '';
    this.opened.tieFell = true; this.refreshHots(); Achievements.unlock('tiefling'); setTimeout(() => Audio2.sfx('swish'), 500);
    return ' The necktie on the blade whips around twice and sails onto the carpet.';
  },
  /* the range hood's fan and light: one rocker switch, on the kitchen outlets' circuit */
  hoodSwitch() {
    if (!Utilities.on('kplugs')) { Audio2.sfx('click'); return this.tell('Click. Nothing. The KIT OUTLETS breaker is off, so the range hood is dead.'); }
    this.hoodOn = !this.hoodOn; Audio2.sfx('click'); Rooms.invalidate('kitchen');
    if (this.hoodOn) { Audio2.synth('whir'); return this.tell('Click. The range hood fan rumbles on, and its little light warms the stovetop. It pulls air fine.'); }
    return this.tell('Click. The hood fan spins down, and the light goes out.');
  },
  ventSwitch() {
    if (!Utilities.on('blights')) { Audio2.sfx('click'); return this.tell("Click. Nothing. The BATH LT/FAN breaker is off, so the vent fan can't run."); }
    const r = ROOMS.bath, vv = cond('vent'); r.ventOn = !r.ventOn; Audio2.sfx('click'); Rooms.invalidate('bath');
    if (!r.ventOn) return this.tell('Click. The vent fan winds down.');
    if (vv === 3) { this.clue('vent', 'dead', 'Vent switch: nothing. The fan is dead.'); return this.tell('Click. Nothing. Not a hum. The vent fan is dead.'); }
    Audio2.synth('whir');
    if (vv === 1) { this.clue('vent', 'dust', 'Vent switch: it rattles and barely pulls air.'); return this.tell('Click. The vent fan rattles to life, but it barely pulls air.'); }
    if (vv === 0) this.clue('vent', 'pull', 'Vent switch: it runs and pulls air well.');
    this.tell('Click. The vent fan hums to life overhead. It pulls air.');
  },
  take(h, withLook) {
    const s = h.data;
    if (s.noTake && !withLook && s.item === 'pizza') Takeout.note('tony');   // Tony's number, off the lid (js/takeout.js)
    if (s.noTake) return this.tell(withLook && s.look ? s.look : s.noTake);   // a plain click on something you won't carry just looks at it
    this.taken.add(h.id); Bag.add(s.item, h.id);
    Rooms.invalidate(this.room); this.refreshHots(); this.updateHover();
    this.tell(s.take || (withLook && s.look ? `${s.look} You drop it in your bag.` : `You pick up the ${lower(s.name)} and drop it in your bag.`));
  },
  jot(name) {
    this.jotted.add(name); Audio2.synth('pencil');
    this.tell(`You jot the ${name.toLowerCase()} in the margin of your form. It isn't on the work order, but now it's documented.`);
  },

  /* ---------- pointing at things ---------- */
  sceneXY(e) { const r = $('scene').getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SW, (e.clientY - r.top) / r.height * SH]; },
  hit(x, y) {
    const dr = this.dana.rect(); if (x > dr.x0 && x < dr.x1 && y > dr.y0 && y < dr.y1) return { kind: 'dana', name: 'Dana' };
    for (const h of this.hots) if (inPoly(h.pts, x, y)) return h;
    return null;
  },
  updateHover() {
    if (this.mode !== 'play' || !this.mouse || UI.blocking()) { this.hover = null; UI.verb(''); return; }
    const h = this.hit(this.mouse[0], this.mouse[1]); this.hover = h;
    if (h) {
      const exit = shiftExit(h) && this.tool === 'walk';
      UI.verb(exit ? `Leave through the <b>${Sites.site.exit.name}</b> (submit report)` : (this.tool === 'walk' && ((h.kind === 'openable' && h.id !== 'rug') || (h.kind === 'feature' && ROOM_TOUCH[h.id])) ? `Open or close <b>${h.name}</b>` : this.tool === 'walk' && h.kind === 'scenery' && h.data && h.data.item ? (h.data.noTake ? `Look at <b>${h.name}</b>` : `Pick up <b>${h.name}</b>`) : this.tool === 'walk' && h.kind === 'scenery' && h.data && (h.data.light || h.data.fan || h.data.vent || h.data.hood) ? `Flip <b>${h.name}</b>` : (this.tool === 'walk' || this.tool === 'touch') && h.data && h.data.panel ? `Open the <b>${h.name}</b>` : (this.tool === 'walk' || this.tool === 'touch') && h.data && h.data.valve ? `Turn the <b>${h.name}</b>` : verbPhrase(h.kind === 'door' && this.tool === 'walk' ? 'walk' : this.tool, h.name)) + ((h.kind === 'feature' || h.kind === 'anomaly') && this.marks[h.id] ? ' <i>(on your form)</i>' : ''));
    } else UI.verb(this.tool === 'walk' || floorAt(this.mouse[0], this.mouse[1]) ? (this.tool === 'walk' ? 'Walk' : TOOL[this.tool].name) : '');
  },
  click(x, y) {
    if (this.mode !== 'play' || UI.blocking()) return;
    this.player.idle = 0; this.idle = 0; this.actions++;
    const h = this.hit(x, y), tool = this.tool, P0 = this.player;
    const faceTo = sx => { const me = P0.screen().sx; if (Math.abs(sx - me) > 4) P0.face = sx > me ? 1 : -1; };
    UI.hush('you');
    if (!h) {
      const f = floorAt(x, y);
      if (f) { P0.goTo(f.x, f.z); return; }
      const what = blankAt(this.room, x, y), say = BLANK[what][tool] || BLANK[what].any;
      if (say && tool !== 'walk') this.tell(typeof say === 'string' ? say : pick(say));
      return;
    }
    if (h.kind === 'dana') return this.useOnDana(tool);
    const cx = h.box.cx, go = (w, fn) => P0.goTo(w.x, w.z, () => { faceTo(cx); fn(); });
    if (h.kind === 'door') {
      const d = h.data;
      if (tool === 'look') { faceTo(cx); this.tell(`The way to the ${lower(d.name)}.`); return; }
      if (tool === 'talk') { UI.say('you', 'Hello? ...Nope, nobody in there.'); return; }
      if (tool === 'camera') { go(d.walk, () => Camera.openScene(h)); return; }
      P0.goTo(d.walk.x, d.walk.z, () => { Audio2.sfx('click', .6); this.enter(d.to, d.spawn); });
      return;
    }
    if (h.kind === 'anomaly') {
      const a = h.data, note = t => { const l = this.notes[a.id] = this.notes[a.id] || []; if (t && !l.includes(t)) l.push(t); };
      if (tool === 'look') { faceTo(cx); this.tell(a.look); note(a.look); return; }
      if (tool === 'walk') { P0.goTo(a.walk.x, a.walk.z); return; }
      go(a.walk, () => {
        if (tool === 'clipboard') return Mark.open(a.id);
        if (tool === 'camera') return Camera.openScene(h);
        const line = a[tool] || (GENERIC[tool] ? GENERIC[tool](lower(a.name)) : 'Nothing happens.');
        if (tool === 'talk') this.tell(line); else { this.tell(line); if (a[tool]) { note(line); Audio2.synth('pencil'); } }
        playSfx(TOOL_SFX[tool]);
      });
      return;
    }
    if (h.kind === 'openable' || h.kind === 'scenery') {
      const s = h.data;
      if (tool === 'look') {
        faceTo(cx);
        this.tell((typeof s.look === 'function' ? s.look() : s.look) + (h.kind === 'openable' && s.id !== 'rug' ? (isOpen(s.id) ? (Openables.item(s) ? ' The door is open. Something is inside.' : ' The door is open. Empty.') : ' It\'s closed. Touch it (or just click it) to open it.') : ''));
        return;
      }
      const wk = h.walk || s.walk;
      const handy = h.kind === 'scenery' && (s.item || s.light || s.fan || s.vent || s.hood || s.panel || s.valve || s.ppe || s.use);   // (ppe: gear on a rack, js/ppe.js; use: any site's own switch or gadget)       // things a plain click should just use
      if (tool === 'walk' && h.kind !== 'openable' && !handy) { P0.goTo(wk.x, wk.z); return; }
      go(wk, () => {
        if (tool === 'walk' && h.kind === 'openable') return this.tell(Openables.toggle(s));     // clicking a door, drawer, or the blinds with the plain cursor opens or shuts it
        if (tool === 'walk' || (tool === 'touch' && (s.panel || s.valve))) {   // a plain click flips a switch, opens the panel, turns the valve, or picks a left-behind thing up
          if (s.panel) return Utilities.openPanel();
          if (s.valve) return Utilities.toggleGas();
          if (s.light) return this.toggleLights();
          if (s.fan) return this.fanSwitch();
          if (s.vent) return this.ventSwitch();
          if (s.hood) return this.hoodSwitch();
          if (s.ppe) return PPE.wear(s.ppe);
          if (s.use) { const said = s.use(); if (said) this.tell(said); return; }
          return this.take(h, true);
        }
        if (tool === 'camera') return Camera.openScene(h);
        if (tool === 'clipboard') return this.jot(s.name);
        if (tool === 'touch') {
          if (h.kind === 'openable') return this.tell(Openables.toggle(s));
          if (s.light) return this.toggleLights();
          if (s.fan) return this.fanSwitch();
          if (s.vent) return this.ventSwitch();
          if (s.hood) return this.hoodSwitch();
          if (s.ppe) return PPE.wear(s.ppe);
          if (s.use) { const said = s.use(); if (said) this.tell(said); return; }
          if (s.item) return this.take(h);
        }
        const line = s[tool] || (GENERIC[tool] ? GENERIC[tool](lower(s.name)) : 'Nothing happens.');
        if (tool === 'talk' && !/^You\b/.test(line)) UI.say('you', line); else this.tell(line);
        playSfx(TOOL_SFX[tool]);
      });
      return;
    }
    // a feature
    const f = FEATURE[h.id], spot = ROOMS[this.room].features[h.id].walk, origin = [h.box.cx, h.box.cy];
    if (tool === 'walk') {
      if (f.floor) { const fl = floorAt(x, y); if (fl) { P0.goTo(fl.x, fl.z); return; } }       // a floor is somewhere to walk, too
      P0.goTo(spot.x, spot.z, () => {
        faceTo(cx); if (shiftExit(h)) Report.confirmSubmit();
        else if (ROOM_TOUCH[h.id]) { const part = f.parts.find(p => p.id === ROOM_TOUCH[h.id]); this.tell(Inspect.act(h.id, part, 'touch')); }   // the fridge, oven, closet, and blinds open with a plain click too
      }); return;
    }
    if (tool === 'look') {   // from across the room, you walk over first (most of the way, not right up to it), then look closely
      const d = Math.hypot(P0.x - spot.x, P0.z - spot.z), near = 2.4;
      if (d > near + .6) { const k = (d - near) / d; P0.goTo(P0.x + (spot.x - P0.x) * k, P0.z + (spot.z - P0.z) * k, () => { faceTo(cx); Inspect.open(h.id, origin); }); return; }
      faceTo(cx); Inspect.open(h.id, origin); return;
    }
    if (tool === 'talk') { faceTo(cx); this.tell(f.talk || `You ask the ${lower(f.name)} how it's doing. It doesn't say. That's what the tools are for.`); return; }   // a feature that's a person (the crew's PPE) answers
    P0.goTo(spot.x, spot.z, () => {
      faceTo(cx);
      if (tool === 'clipboard') return Mark.open(h.id);
      if (tool === 'camera') return Camera.open(h.id);
      if (tool === 'touch' && ROOM_TOUCH[h.id]) { const part = f.parts.find(p => p.id === ROOM_TOUCH[h.id]); return this.tell(Inspect.act(h.id, part, 'touch')); }
      Inspect.open(h.id, origin, `(Pick a part to use the ${lower(TOOL[tool].name)} on.)`);
    });
  },
  useOnDana(tool) {
    const lines = {
      look: "Dana, from the leasing office. Three months in and already running the place.",
      touch: "'Yes, boss?'", smell: danaSays('smell', null, 'Vanilla body spray and printer toner.'),
      clipboard: "'I'm not a finding. I'd be a ten, obviously.'", camera: 'Dana throws up a peace sign. You save the shot for later.',
      tape: "'Five-foot-four. Five-five in these flats. Can we get back to work?'", flashlight: danaSays('flashlight', null, "'Ow! My eyes! Point that at the sink!'"),
      screwdriver: "'Don't you dare.'", hammer: "You think better of it.", pencil: "You hand Dana the pencil. She hands it back.", walk: null
    };
    if (tool === 'talk') { this.player.goTo(this.dana.x + (this.player.x < this.dana.x ? -1 : 1), this.dana.z, () => { this.player.face = this.dana.x > this.player.x ? 1 : -1; this.dana.face = -this.player.face; Dialogue.open(); }); return; }
    if (tool === 'walk') { this.player.goTo(this.dana.x - 1, this.dana.z); return; }
    const line = lines[tool];
    if (line[0] === "'") UI.say('dana', line.slice(1, -1)); else this.tell(line);
  },

  /* ---------- Dana: keeps out of the way, and points at things ---------- */
  danaSpot(nx, nz, avoidPlayer = true) {      // a spot near (nx, nz) where she doesn't block anything you'd want to click
    const w = ROOMS[this.room].walk, boxes = (this.hots || []).filter(h => h.kind !== 'door' && !(h.kind === 'feature' && FEATURE[h.id].floor)).map(h => h.box), pr = avoidPlayer ? this.player.rect() : null;
    const over = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    let best = null;
    for (let i = 0; i < 36; i++) {
      const x = clamp(nx + (i ? rand(-3.5, 3.5) : 0), w.x0, w.x1), z = clamp(nz + (i ? rand(-2.4, 1.2) : 0), w.z0, w.z1), r = this.dana.rect(x, z);
      let cost = Math.hypot(x - nx, z - nz) * 30 + (pr ? over(r, pr) * 2 : 0);
      if (r.x0 < 6 || r.x1 > SW - 6 || r.y0 < 2 || r.y1 > SH - 4) cost += 100000;   // never anywhere she'd be cut off by the edge of the screen
      for (const b of boxes) cost += over(r, b) * 1.5;
      if (!best || cost < best.cost) best = { x, z, cost };
    }
    return best;
  },
  /* walk to one side of a feature and point at it; line (optional) is said once she's there, not from across the room.
     Things inside cabinets and closets have no hotspot while their doors are shut, so she points at the door. */
  danaPoint(fid, line) {
    const fdef = ROOMS[this.room].features[fid]; if (!fdef) { if (line) UI.say('dana', line); return; }
    let box = (this.hots.find(x => x.kind === 'feature' && x.id === fid) || {}).box;
    if (!box) { const host = Openables.hostOf(fid), oh = host && this.hots.find(x => x.id === host); box = oh ? oh.box : null; }
    if (!box) try { box = polyBox(fdef.pts()); } catch (e) { box = null; }
    const spot = fdef.walk, D = this.dana, w = ROOMS[this.room].walk, room = this.room;
    const sides = [1, -1].map(sd => this.danaSpot(clamp(spot.x + sd * 1.4, w.x0, w.x1), spot.z - .3, true));
    const s = sides.sort((a, b) => a.cost - b.cost)[0];
    let said = false;
    const arrive = () => {
      if (said || this.room !== room) return; said = true;
      if (box) { const me = D.screen(), up = box.cy < me.sy - SPR_H * me.s * .75; D.face = box.cx >= me.sx ? 1 : -1; D.pose = up ? 'pointUp' : 'point'; D.pointUntil = this.t + 5; }
      if (line) UI.say('dana', line);
    };
    D.goTo(s.x, s.z, arrive);
    setTimeout(arrive, 5000);                                   // if something blocks her way, she still says it
  },

  /* ---------- per frame ---------- */
  update(dt) {
    this.t += dt;
    if (this.mode !== 'play') return;
    const paused = UI.blocking();
    if (!paused) {
      this.player.update(dt); this.dana.update(dt); this.idle += dt;
      const P0 = this.player, D = this.dana, dist = Math.hypot(P0.x - D.x, P0.z - D.z), pointing = D.pose && D.pointUntil > this.t;
      if (D.pose && !pointing) D.pose = null;
      if (!D.moving && !pointing) {
        // catch up, but only once you've actually moved on: re-picking a spot every frame while you stand in a corner
        // (where no spot is close enough) is what had her pacing back and forth
        const fw = D.followed, movedOn = !fw || Math.hypot(P0.x - fw.x, P0.z - fw.z) > .8;
        if (dist > 2.8 && movedOn) { const s = this.danaSpot(P0.x - P0.face * 1.5, P0.z + .6); D.followed = { x: P0.x, z: P0.z }; D.goTo(s.x, s.z); }
        else if (D.idle > 7 && Math.random() < .004) { const s = this.danaSpot(P0.x + rand(-2.5, 2.5), P0.z + rand(-.3, 1.4)); D.goTo(s.x, s.z); }
        else if (D.idle > 1.5 && !P0.moving && this.danaSpot(D.x, D.z).cost > 60 && Math.random() < .02) { const s = this.danaSpot(D.x, D.z); if (s.cost < 40) D.goTo(s.x, s.z); }   // she notices she's in the way
      }
      if (!D.moving && !P0.moving && D.idle > 1 && !pointing) D.face = P0.x > D.x ? 1 : -1;
      if (this.idle > this.nextBark) { Dialogue.bark(); this.idle = 0; this.nextBark = 35 + Math.random() * 25; }
      Audio2.walking(P0.moving);
    } else Audio2.walking(false);
    this.fade = Math.max(0, this.fade - dt * 2.5);
    if (this.mode === 'play') this.liveHots();
  },
  render(g) {
    const t = this.t;
    Rooms.draw(g, this.room, t);
    const hs = Settings.get('hotspots');
    if (!UI.blocking()) {
      if (hs === 'always') for (const h of this.hots) { g.save(); g.setLineDash([1, 3]); strokePoly(g, h.pts, isExit(h) ? 'rgba(120,220,255,0.4)' : 'rgba(255,236,190,0.35)'); g.restore(); }
      Reveal.drawRoom(g, this.hots);                              // the toolbar's sparkle: everything outlined for a moment
      if (this.hover && this.hover.pts && hs !== 'off') { g.save(); g.setLineDash([2, 2]); g.lineDashOffset = -Math.floor(t * 8); strokePoly(g, growPoly(this.hover.pts, 1.5), isExit(this.hover) ? 'rgba(120,220,255,0.95)' : 'rgba(255,236,190,0.95)'); g.restore(); }   // drawn just outside the edge, so it never cuts into the thing; ways out are cyan
    }
    Obstacles.draw(g, this.room, [this.player, this.dana], t);    // back to front, with machines and tables in front of whoever walks behind them
    Rooms.overlay(g, this.room, t);
    if (this.fade > 0) { g.fillStyle = dither('#0a0812', Math.round(this.fade * 16)); g.fillRect(0, 0, SW, SH); }
    UI.updateSpeech(performance.now() / 1000, who => who === 'you' ? this.player.head() : who === 'dana' ? this.dana.head() : null);
  }
};
