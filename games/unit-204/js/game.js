'use strict';
/* ============================== GAME ==============================
   State, the two characters, mouse/keyboard input and what each verb or tool does in a room. */
class Walker {
  constructor(who, speed) { this.who = who; this.x = 0; this.z = 8; this.tx = 0; this.tz = 8; this.face = 1; this.speed = speed; this.phase = 0; this.idle = 0; this.then = null; this.moving = false; }
  place(x, z) { this.x = this.tx = x; this.z = this.tz = z; this.then = null; this.moving = false; }
  goTo(x, z, then) {
    const w = ROOMS[Game.room].walk;
    this.tx = clamp(x, w.x0, w.x1); this.tz = clamp(z, w.z0, w.z1); this.then = then || null; this.idle = 0;
    if (Math.hypot(this.tx - this.x, this.tz - this.z) < .08) { this.moving = false; const t = this.then; this.then = null; if (t) t(); }
  }
  update(dt) {
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz);
    if (d > .04) {
      const step = Math.min(d, this.speed * dt * (this.z / 8 + .4));
      this.x += dx / d * step; this.z += dz / d * step; this.moving = true; this.idle = 0;
      if (Math.abs(dx) > .02) this.face = dx > 0 ? 1 : -1;
      this.phase += step * 3.2;
    } else {
      if (this.moving) { this.moving = false; this.x = this.tx; this.z = this.tz; }
      this.idle += dt;
      if (this.then) { const t = this.then; this.then = null; t(); }
    }
  }
  screen() { const [sx, sy] = P(this.x, 0, this.z); return { sx, sy, s: clamp(.62 + 2.4 / this.z, .78, 1.14) }; }
  sprite(t) {
    const o = {};
    if (this.moving) { const k = Math.sin(this.phase * Math.PI); o.step = Math.round(k * 2) / 2; o.bob = Math.abs(k) > .7 ? -1 : 0; }
    else if (this.who === 'you' && this.idle > 6) o.pose = 'clip';
    else if (this.who === 'dana' && this.idle > 4 && !UI.talking('dana')) o.pose = 'phone';
    if (this.pose) o.pose = this.pose;
    o.blink = (t * 1000 + (this.who === 'dana' ? 1700 : 0)) % 3900 < 130;
    o.talk = UI.talking(this.who) && Math.floor(t * 8) % 2 === 0;
    o.led = Math.floor(t * 1.2) % 2 === 0;
    return Sprites.get(this.who, o);
  }
  rect() { const { sx, sy, s } = this.screen(); return { x0: sx - 13 * s, x1: sx + 13 * s, y0: sy - (SPR_H - 4) * s, y1: sy }; }
  draw(g, t) {
    const { sx, sy, s } = this.screen(), spr = this.sprite(t), w = Math.round(SPR_W * s), h = Math.round(SPR_H * s);
    g.fillStyle = ditherPx('#1a1222', 9); g.beginPath(); g.ellipse(sx, sy - 1, 11 * s, 3 * s, 0, 0, 7); g.fill();
    g.save(); g.imageSmoothingEnabled = false;
    if (this.face < 0) { g.translate(Math.round(sx), 0); g.scale(-1, 1); g.drawImage(spr, Math.round(-w / 2), Math.round(sy - h + 2), w, h); }
    else g.drawImage(spr, Math.round(sx - w / 2), Math.round(sy - h + 2), w, h);
    g.restore();
  }
  head() { const { sx, sy, s } = this.screen(); return [sx, sy - SPR_H * s - 2]; }
}

const Game = {
  mode: 'title', room: 'living', tool: 'look', t: 0,
  cond: {}, flags: {}, marks: {}, notes: {}, clues: {}, photos: {}, shots: 0, actions: 0,
  seen: new Set(), asked: new Set(), hintIx: 0, smallTalk: 0,
  player: new Walker('you', 3.4), dana: new Walker('dana', 3.0),
  hover: null, mouse: null, fade: 0, start: 0, idle: 0, nextBark: 30,

  newShift() {
    this.cond = dealConditions(); Decor.roll(); this.flags = {}; this.marks = {}; this.notes = {}; this.clues = {}; this.photos = {};
    this.shots = 0; this.actions = 0; this.seen = new Set(); this.asked = new Set(); this.hintIx = 0;
    for (const r of Object.values(ROOMS)) r.lightsOff = false;
    Rooms.invalidate(); this.start = performance.now();
    this.enter('living', ROOMS.living.start, true);
    UI.progress(0, FEATURES.length);
  },
  beginShift() {
    UI.closeAll(); this.newShift(); this.mode = 'play';
    $('game').classList.add('playing', 'tb-hint'); setTimeout(() => $('game').classList.remove('tb-hint'), 6000);
    this.setTool('look');
    Audio2.music(true); Audio2.ambience(true, ROOMS.living.amb);
    setTimeout(() => UI.say('dana', "Okay! Unit 204. Fourteen things on the checklist. Toolbar's up top, boss."), 700);
    this.nextBark = 40;
  },
  elapsed() { const s = Math.round((performance.now() - this.start) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  enter(id, at, first) {
    this.room = id; this.hots = Rooms.hotspots(id);
    this.player.place(at.x, at.z); this.dana.place(clamp(at.x + (at.x > 0 ? -1.3 : 1.3), ROOMS[id].walk.x0, ROOMS[id].walk.x1), clamp(at.z + .5, ROOMS[id].walk.z0, ROOMS[id].walk.z1));
    this.player.face = at.x > 0 ? -1 : 1; this.dana.face = this.player.face;
    this.fade = first ? 1 : .9; UI.roomName(ROOMS[id].name); UI.hush();
    Audio2.ambience(this.mode === 'play' || first, ROOMS[id].amb);
  },
  setTool(id) {
    this.tool = id; $('game').className = $('game').className.replace(/\bcur-\S+/g, '').trim() + ' cur-' + id;
    UI.syncTools(id);
    if (UI.isOpen('inspectScreen') && Inspect.hover) $('zoomLabel').innerHTML = verbPhrase(id, Inspect.hover.name);
    this.updateHover();
  },
  cycleTool(dir) {
    const list = CYCLE.slice(); if (!CYCLE.includes(this.tool)) list.push(this.tool);
    let i = list.indexOf(this.tool) + dir; if (i >= list.length) i = 0; if (i < 0) i = list.length - 1;
    if (UI.isOpen('inspectScreen') && list[i] === 'walk') i = (i + dir + list.length) % list.length;
    this.setTool(list[i]); Audio2.sfx('tick', .8);
  },

  /* ---------- marking ---------- */
  mark(fid, cat) {
    const first = !this.marks[fid];
    this.marks[fid] = { cat, at: this.elapsed() };
    Audio2.synth('stamp'); this.actions++;
    const done = Object.keys(this.marks).length; UI.progress(done, FEATURES.length);
    const v = FEATURE[fid].variants[this.cond[fid]];
    if (Settings.get('feedback') === 'now') {
      const ok = v.cat === cat, needPhoto = v.cat >= 2 && !this.photos[fid];
      if (ok) { Audio2.sfx('chime'); UI.feedback(true, `Correct: ${CATS[v.cat].name}`, v.why + (needPhoto ? ' Don\'t forget a photo for the file!' : '')); }
      else { Audio2.synth('wrong'); UI.feedback(false, `Not quite. It's ${CATS[v.cat].name}`, v.why); }
    } else Audio2.sfx('click2');
    Rooms.invalidate(FEATURE[fid].room);
    if (first && done === FEATURES.length) setTimeout(() => UI.say('dana', "That's all fourteen! Submit the report from the menu, or head out the front door."), 1200);
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
    if (h) UI.verb(verbPhrase(h.kind === 'door' && this.tool === 'walk' ? 'walk' : this.tool, h.name));
    else UI.verb(this.tool === 'walk' || floorAt(this.mouse[0], this.mouse[1]) ? (this.tool === 'walk' ? 'Walk' : TOOL[this.tool].name) : '');
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
      if (tool === 'look') UI.say('you', pick(['Just wall. Nicely painted wall.', 'Popcorn ceiling. Very 1998.', 'Nothing special there.']));
      return;
    }
    if (h.kind === 'dana') return this.useOnDana(tool);
    const cx = h.box.cx;
    if (h.kind === 'door') {
      const d = h.data;
      if (tool === 'look') { faceTo(cx); UI.say('you', d.exit ? 'The front door. Leaving means filing the report.' : `The way to the ${d.name.toLowerCase()}.`); return; }
      if (tool === 'talk') { UI.say('you', 'Hello? ...Nope, nobody in there.'); return; }
      P0.goTo(d.walk.x, d.walk.z, () => {
        if (d.exit) { faceTo(cx); Report.confirmSubmit(); return; }
        Audio2.sfx('click', .6); this.enter(d.to, d.spawn);
      });
      return;
    }
    if (h.kind === 'scenery') {
      const s = h.data;
      if (tool === 'look') { faceTo(cx); UI.say('you', s.look); return; }
      if (tool === 'walk') { P0.goTo(s.walk.x, s.walk.z); return; }
      P0.goTo(s.walk.x, s.walk.z, () => {
        faceTo(cx);
        if (s.light && tool === 'touch') { const r = ROOMS[this.room]; r.lightsOff = !r.lightsOff; Audio2.sfx('click'); UI.say('you', r.lightsOff ? 'Lights off.' : 'Lights on.'); return; }
        if (tool === 'clipboard') { UI.say('you', "That's not on the checklist."); return; }
        if (tool === 'camera') { UI.say('you', 'Not worth a photo. Memory cards are expensive.'); return; }
        const line = s[tool] || (GENERIC[tool] ? GENERIC[tool](s.name.toLowerCase()) : 'Nothing happens.');
        UI.say('you', line); playSfx(TOOL_SFX[tool]);
      });
      return;
    }
    // a feature
    const f = FEATURE[h.id], spot = ROOMS[this.room].features[h.id].walk, origin = [h.box.cx, h.box.cy];
    if (tool === 'walk') { P0.goTo(spot.x, spot.z, () => faceTo(cx)); return; }
    if (tool === 'look') { faceTo(cx); Inspect.open(h.id, origin); return; }
    if (tool === 'talk') { faceTo(cx); UI.say('you', `The ${f.name.toLowerCase()} isn't talking. That's what the tools are for.`); return; }
    P0.goTo(spot.x, spot.z, () => {
      faceTo(cx);
      if (tool === 'clipboard') return Mark.open(h.id);
      if (tool === 'camera') return Camera.open(h.id);
      Inspect.open(h.id, origin, `(Pick a part to use the ${TOOL[tool].name.toLowerCase()} on.)`);
    });
  },
  useOnDana(tool) {
    const lines = {
      look: "Dana, from the leasing office. Three months in and already running the place.",
      touch: "You tap Dana on the shoulder. 'Yes, boss?'", smell: 'Vanilla body spray and printer toner.',
      clipboard: "Dana is not a finding. 'I'd be a ten, obviously.'", camera: 'Dana throws up a peace sign. You save the shot for later.',
      tape: "'Five-foot-four. Five-five in these flats. Can we get back to work?'", flashlight: "'Ow! My eyes! Point that at the sink!'",
      screwdriver: "'Don't you dare.'", hammer: "You think better of it.", pencil: "You hand Dana the pencil. She hands it back.", walk: null
    };
    if (tool === 'talk') { this.player.goTo(this.dana.x + (this.player.x < this.dana.x ? -1 : 1), this.dana.z, () => { this.player.face = this.dana.x > this.player.x ? 1 : -1; this.dana.face = -this.player.face; Dialogue.open(); }); return; }
    if (tool === 'walk') { this.player.goTo(this.dana.x - 1, this.dana.z); return; }
    UI.say(tool === 'tape' || tool === 'flashlight' || tool === 'screwdriver' || tool === 'clipboard' || tool === 'touch' ? 'dana' : 'you', lines[tool]);
  },

  /* ---------- per frame ---------- */
  update(dt) {
    this.t += dt;
    if (this.mode !== 'play') return;
    const paused = UI.blocking();
    if (!paused) {
      this.player.update(dt); this.dana.update(dt); this.idle += dt;
      // Dana follows at a polite distance and wanders a little
      const P0 = this.player, D = this.dana, dist = Math.hypot(P0.x - D.x, P0.z - D.z);
      if (!D.moving && dist > 2.6) D.goTo(P0.x - P0.face * 1.4 + rand(-.3, .3), P0.z + rand(.2, .8));
      else if (!D.moving && D.idle > 7 && Math.random() < .004) { const w = ROOMS[this.room].walk; D.goTo(clamp(P0.x + rand(-2.5, 2.5), w.x0, w.x1), clamp(P0.z + rand(-.5, 1.5), w.z0, w.z1)); }
      if (!D.moving && !P0.moving && D.idle > 1) D.face = P0.x > D.x ? 1 : -1;
      if (this.idle > this.nextBark) { Dialogue.bark(); this.idle = 0; this.nextBark = 35 + Math.random() * 25; }
      Audio2.walking(P0.moving);
    } else Audio2.walking(false);
    this.fade = Math.max(0, this.fade - dt * 2.5);
  },
  render(g) {
    const t = this.t;
    Rooms.draw(g, this.room, t);
    const hs = Settings.get('hotspots');
    if (!UI.blocking()) {
      if (hs === 'always') for (const h of this.hots) if (h.kind !== 'door' && !(h.kind === 'feature' && this.marks[h.id])) { g.save(); g.setLineDash([1, 3]); strokePoly(g, h.pts, 'rgba(255,236,190,0.35)'); g.restore(); }
      if (this.hover && this.hover.pts && hs !== 'off') { g.save(); g.setLineDash([2, 2]); g.lineDashOffset = -Math.floor(t * 8); strokePoly(g, this.hover.pts, 'rgba(255,236,190,0.95)'); g.restore(); }
    }
    for (const w of [this.player, this.dana].sort((a, b) => b.z - a.z)) w.draw(g, t);
    // paper tags on features already on the form
    if (Settings.get('tags')) for (const h of this.hots) if (h.kind === 'feature' && this.marks[h.id]) {
      const c = ['#7bd36b', '#6fb7ff', '#ffb03b', '#ff5f6d'][this.marks[h.id].cat], x = Math.round(Math.min(h.box.x1 - 4, SW - 10)), y = Math.round(Math.max(h.box.y0, 4));
      pxLine(g, x, y, x + 3, y + 3, '#2a2133'); pxRect(g, x + 2, y + 3, 6, 8, '#2a2133'); pxRect(g, x + 3, y + 4, 4, 6, c); pxRect(g, x + 4, y + 5, 2, 1, '#ffffff');
    }
    Rooms.overlay(g, this.room, t);
    if (this.fade > 0) { g.fillStyle = dither('#0a0812', Math.round(this.fade * 16)); g.fillRect(0, 0, SW, SH); }
    UI.updateSpeech(performance.now() / 1000, who => who === 'you' ? this.player.head() : who === 'dana' ? this.dana.head() : null);
  }
};
