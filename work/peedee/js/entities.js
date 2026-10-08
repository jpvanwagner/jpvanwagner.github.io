'use strict';
/* ============================== ENTITIES ============================== */
class Player {
  constructor(x, y) {
    Object.assign(this, { x, y, w: PHYS.PW, h: PHYS.PH, vx: 0, vy: 0, grounded: false, ground: null, coyote: 0, buffer: 0,
      drop: 0, jumping: false, step: PHYS.STEP, face: 1, hp: 100, inv: 0, cd: 0, shootT: 0, hurtT: 0, squash: 0, anim: 0, cleaning: null, prevBottom: y + PHYS.PH });
  }
  update() {
    if (this.inv > 0) this.inv--;
    if (this.cd > 0) this.cd--;
    if (this.shootT > 0) this.shootT--;
    if (this.hurtT > 0) this.hurtT--;
    this.squash *= 0.8;
    this.prevBottom = this.y + this.h;
    const free = this.hurtT <= 0;
    const inp = free ? { left: keys.left, right: keys.right, down: keys.down, jumpHeld: keys.jump, jumpPressed: input.jumpEdge }
                     : { left: false, right: false, down: false, jumpHeld: false, jumpPressed: false };
    // cleaning: stand still on/next to a dirty spot and hold MED
    this.cleaning = null;
    const spot = this.grounded ? (G.spots.find(s => !s.done && s.near(this)) || G.nodes.find(n => n.usable() && n.near(this)) || G.coats.find(c => c.near(this))) : null;
    if (free && keys.med && spot && !inp.jumpPressed) {
      this.cleaning = spot; inp.left = inp.right = false;
      spot.active = true; spot.progress += spot instanceof Spot ? 1.35 : spot instanceof Coat ? 1.6 : 1.7;
      if (G.t % 5 === 0) AudioSys.play('clean', spot.progress);
      if (G.t % 3 === 0) spawnP(spot.x + rand(-6, 6), spot.y - rand(0, 4), { vx: rand(-0.6, 0.6), vy: rand(-1.4, -0.4), color: Math.random() < 0.5 ? '#ffffff' : '#bff8ff', life: 26, size: 2, g: -0.01, shape: 'bubble' });
      if (spot.progress >= 100) { if (spot.complete) spot.complete(); else cleanSpot(spot); }
    } else if (input.medEdge && !spot && free) {
      if (G.medHintT <= 0) { popup(this.x + 5, this.y - 6, 'NOTHING TO CLEAN', '#bdf', 50); G.medHintT = 60; }
    }
    if (inp.left && !inp.right) this.face = -1; else if (inp.right && !inp.left) this.face = 1;
    const ev = stepPlayer(this, inp, G.world);
    if (G.wind) {                         // Hal's bad-breath gust shoves PeeDee along
      const ox = this.x; this.x += G.wind;
      if (G.world.solids.some(s => !s.off && overlaps(this, s)) || this.x < G.world.left || this.x + this.w > G.world.right) this.x = ox;
    }
    if (ev.jumped) { AudioSys.play('jump'); dust(this.x + this.w / 2, this.y + this.h, 4); this.squash = -0.35; }
    if (ev.dropped) AudioSys.play('drop');
    if (ev.landed) this.onLand(ev.landed);
    if (ev.bounced) { AudioSys.play('boing'); this.squash = 0.5; }
    if (this.launched) { this.launched = false; AudioSys.play('boing'); popup(this.x + 5, this.y - 6, 'WHOA!', '#ffb3c6', 30); }
    if (free && keys.shoot && this.cd <= 0 && !this.cleaning) {
      this.cd = 12; this.shootT = 16;                   // the arm stays up while you keep firing
      G.bolts.push({ x: this.face > 0 ? this.x + this.w + 13 : this.x - 21, y: this.y + 10, vx: this.face * 5.2, w: 7, h: 3, life: 44 });
      AudioSys.play('shoot');
    }
    // remember a safe spot to respawn at after falling into drool
    const gr = this.ground;
    if (this.grounded && gr && gr.solid && this.x + this.w / 2 >= gr.x && this.x + this.w / 2 <= gr.x + gr.w && !G.nerves.some(n => this.x + this.w > n.x - 6 && this.x < n.x + n.w + 6))
      this.lastSafe = { x: this.x, y: this.y, g: gr };
    if (this.y > G.world.deathY) this.fell();
    this.anim++;
  }
  onLand(v) {
    const g = this.ground;
    this.squash = Math.min(0.5, v * 0.08);
    if (!g) return;
    const gd = g.mound || g;                       // landing on a gum mound squishes the whole mound
    if (g.kind === 'gum' && gd.dent) { gd.dent.x = this.x + this.w / 2; gd.dent.v += Math.min(5, v * 0.75); AudioSys.play('squish', v); dust(this.x + this.w / 2, this.y + this.h, 3, '#ffc2da'); }
    else if (g.kind === 'floss') { g.sag.x = this.x + this.w / 2; g.sag.v += Math.min(4, v * 0.6); AudioSys.play('boing'); }
    else if (g.kind === 'wire') { g.sag.x = this.x + this.w / 2; g.sag.v += Math.min(0.8, v * 0.1); AudioSys.play('tap'); }
    else if (g.kind === 'tongue') { g.dent.x = this.x + this.w / 2; g.dent.v += Math.min(6, v * 0.9); AudioSys.play('squish', v); }
    else if (v > 2) { AudioSys.play('tap'); dust(this.x + this.w / 2, this.y + this.h, 3); }
  }
  fell() {
    const L = G.L, ex = L.exit;
    if (ex.kind === 'hole' && G.clean && this.x + this.w > ex.x && this.x < ex.x + ex.w) return;     // falling into the receded gum = exit
    AudioSys.play('splash');
    for (let i = 0; i < 18; i++) spawnP(this.x + 5, L.poolY, { vx: rand(-1.6, 1.6), vy: rand(-3.4, -1), color: L.theme === 'root' ? '#ff6a6a' : '#bff6ff', life: 34, size: 2, g: 0.15 });
    this.hp -= 20; G.noHit = false; shake(4);
    if (this.hp <= 0) { this.hp = 0; die('hp'); return; }
    let to = this.lastSafe;
    if (to.g && to.g.off && G.L.arena && G.L.arena.safe) to = { x: G.L.arena.safe.x, y: G.L.arena.safe.y - this.h };   // that gum melted away
    Object.assign(this, { x: to.x, y: to.y, vx: 0, vy: 0, inv: 90, ground: null, grounded: false });
    popup(this.x + 5, this.y - 6, '-20', '#ff6b8f');
  }
  hurt(dmg, fromX) {
    if (this.inv > 0 || G.cleanTimer > 0 || G.state !== 'play') return;
    this.hp -= dmg; this.inv = 70; this.hurtT = 16; G.noHit = false;
    this.vx = (this.x + this.w / 2 < fromX ? -1 : 1) * 2.4 * WS; this.vy = -3.6 * WS; this.ground = null; this.grounded = false; this.jumping = false;
    AudioSys.play('hurt'); shake(3);
    burst(this.x + 5, this.y + 8, 10, ['#ff2e63', '#fff'], 2);
    popup(this.x + 5, this.y - 6, '-' + dmg, '#ff6b8f');
    if (this.hp <= 0) { this.hp = 0; die('hp'); }
  }
  standOffset() {
    const g = this.ground;
    if (!g || !this.grounded) return 0;
    if (g.kind === 'gum') return dentAt(g.mound || g, this.x + this.w / 2);
    if (g.kind === 'floss' || g.kind === 'wire') return g.sag.d;
    if (g.kind === 'tongue') return dentAt(g, this.x + this.w / 2);
    return 0;
  }
  draw() {
    if (this.inv > 0 && Math.floor(this.inv / 3) % 2 === 0 && G.state === 'play') return;
    let legs = 'stand', pose = 'idle';
    if (this.cleaning) pose = 'clean';
    else if (this.shootT > 0) pose = 'shoot';
    if (!this.grounded) legs = this.vy < 1 ? 'jump' : 'stand';
    else if (Math.abs(this.vx) > 0.3 && !this.cleaning) legs = ['run1', 'stand', 'run2', 'stand'][Math.floor(this.anim / 5) % 4];
    const fx = snap(this.x + this.w / 2), fy = snap(this.y + this.h + this.standOffset());
    ctx.save();
    ctx.translate(fx, fy);
    if (G.state === 'dying') ctx.rotate(G.dieT * 0.25 * this.face);
    const sq = this.squash;
    ctx.scale(this.face * (1 + sq * 0.35), 1 - sq * 0.3);
    if (this.hurtT > 0) ctx.rotate(-0.35);
    ctx.translate(-8, -20);
    const swing = !this.grounded ? 0.6 : legs === 'stand' && Math.abs(this.vx) <= 0.3 ? 0 : Math.sin(this.anim * Math.PI / 10);
    drawPeeDee(ctx, legs, pose, G.t, this.hurtT > 0 || G.state === 'dying', { swing, glow: Math.max(0, (this.shootT - 10) / 6) });
    ctx.restore();
  }
}

/* A dirty spot: a cavity on a tooth top, plaque piled at the gumline, or root decay. */
class Spot {
  constructor(o) {
    Object.assign(this, { kind: o.kind, x: o.x, y: o.y, progress: 0, done: false, active: false, t: Math.random() * 200, doneT: 0, side: 0 });
    if (o.y == null && G.L && G.L.tongue) { this.onTongue = true; this.y = tongueY(G.L.tongue, this.x, G.t); }
    if (this.kind === 'plaque' && G.L) {
      const tooth = G.L.terrain.find(t => t.kind === 'tooth' && (Math.abs(t.x - this.x) < 14 || Math.abs(t.x + t.w - this.x) < 14));
      if (tooth) this.side = Math.abs(tooth.x - this.x) < 14 ? 1 : -1;     // +1: tooth on the right
    }
  }
  near(p) {
    if (this.kind === 'boss') return false;
    const cx = p.x + p.w / 2, reach = this.kind === 'plaque' ? 15 : 12;
    return Math.abs(p.y + p.h - this.y) < (this.onTongue ? 6 : 3) && Math.abs(cx - this.x) < reach;
  }
  update() {
    this.t++;
    if (this.onTongue) this.y = tongueY(G.L.tongue, this.x, G.t) + dentAt(G.L.tongue, this.x);
    if (this.kind === 'boss') { if (!this.done && this.boss && (this.boss.defeated || this.boss.dead)) { this.done = true; G.stats.cleaned++; checkClean(); } return; }
    if (this.done) { this.doneT++; return; }
    if (!this.active && this.progress > 0) this.progress = Math.max(0, this.progress - 0.4);
    this.active = false;
    if (this.t % 16 === 0 && onScreen(this.x, this.y, 20))
      spawnP(this.x + rand(-5, 5), this.y - 3, { vx: rand(-0.15, 0.15), vy: -0.35, color: this.kind === 'decay' ? '#c58bff' : '#b6ff3b', life: 46, size: 1, g: -0.003, shape: 'stink' });
  }
}

function cleanSpot(s) {
  s.done = true; s.progress = 100;
  G.score += 250; G.stats.cleaned++; G.rot = Math.max(0, G.rot - 8);
  const label = { cavity: 'FILLED!', plaque: 'SCRUBBED!', decay: 'HEALED!', coat: 'SCRUBBED!' }[s.kind];
  popup(s.x, s.y - 20, '+250 ' + label, '#ffcc00', 70);
  burst(s.x, s.y - 2, 24, ['#ffffff', '#2ce8f5', '#ffcc00'], 2.4);
  spawnP(s.x, s.y - 4, { shape: 'ring', life: 24, color: '#ffffff', g: 0 });
  sparkle(s.x, s.y - 4, 10);
  AudioSys.play('fixed');
  checkClean();
  updateHud(true);
}
function checkClean() {
  if (G.clean || G.spots.some(s => !s.done)) return;
  G.clean = true; G.cleanTimer = 90;
  G.score += 0;
  for (const p of G.L.plugs) crumble(p);
  if (G.L.gate) { G.L.gate.opening = true; AudioSys.play('crumble'); }
  const msg = { door: 'ALL CLEAN! HEAD RIGHT', hole: 'ALL CLEAN! DROP INTO THE GAP', up: 'ALL CLEAN! CLIMB OUT', boss: 'ALL CLEAN! THE STENCH LIFTS' }[G.L.exit.kind];
  G.cleanMsg = { text: msg, t: 150 };
  if (G.L.exit.kind === 'hole') { G.cleanMsg = null; G.cleanTalkT = 70; }      // Bite Club: a quick word from HQ about the gap
  AudioSys.play('clear');
  updateHud(true);
}
function crumble(p) {
  p.off = true; AudioSys.play('crumble'); shake(5);
  for (let i = 0; i < 40; i++) spawnP(p.x + rand(0, p.w), p.y + rand(0, p.h), { vx: rand(-1.5, 1.5), vy: rand(-2.5, 0.5), color: ['#f2d65a', '#c9a93a', '#fff3b0'][i % 3], life: 40, size: 2 + (i % 2), g: 0.18 });
}

/* ---------- enemies ---------- */
function makeEnemy(o) {
  switch (o.type) {
    case 'blob': return new Walker(o, { kind: 'blob', w: 14, h: 11, hp: 2, speed: 0.5, dmg: 15, score: 100, step: 6 * WS });
    case 'germ': return new Walker(o, { kind: 'germ', w: 14, h: 14, hp: 3, speed: 0.9, dmg: 20, score: 150, step: 6 * WS });
    case 'crab': return new Walker(o, { kind: 'crab', w: 18, h: 11, hp: 3, speed: 0.45, dmg: 20, score: 200, step: 6 * WS });
    case 'mite': return new Walker(o, { kind: 'mite', w: 12, h: 9, hp: 1, speed: 1.1, dmg: 15, score: 120, hang: true });
    case 'bug': return new Bug(o);
    case 'spitter': return new Spitter(o);
    case 'gingi': return new Gingi(o);
  }
  throw new Error('unknown enemy ' + o.type);
}
class Walker {
  constructor(o, c) {
    Object.assign(this, c, { x: o.x - c.w / 2, y: c.hang ? o.y : o.y - c.h, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, t: Math.floor(rand(0, 80)), flash: 0, stompable: true, state: c.hang ? 'hang' : 'walk', st: 0 });
    if (o.range) { this.minX = o.x - o.range - c.w / 2; this.maxX = o.x + o.range - c.w / 2; }   // keep to a patch of open gum
  }
  update() {
    this.t++; if (this.flash > 0) this.flash--;
    const p = G.player;
    if (this.state === 'hang') {
      if (p && Math.abs(p.x + p.w / 2 - (this.x + this.w / 2)) < 26 && p.y > this.y) { this.state = 'shake'; this.st = 0; AudioSys.play('warn'); }
      return;
    }
    if (this.state === 'shake') { if (++this.st > 22) this.state = 'fall'; return; }
    this.vy = Math.min(this.vy + 0.4, 6);
    const airborne = !this.grounded;
    this.vx = (this.kind === 'germ' && airborne) || this.state === 'fall' ? 0 : this.dir * this.speed;
    moveBody(this, G.world);
    if (this.state === 'fall' && this.grounded) { this.state = 'walk'; dust(this.x + this.w / 2, this.y + this.h, 3); }
    if (this.hitWall) this.dir = -this.hitWall;
    else if (this.minX != null && (this.x < this.minX || this.x > this.maxX)) this.dir = this.x < this.minX ? 1 : -1;
    else if (this.grounded) {
      const fx = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      if (!groundAt(fx, this.y + this.h + 3)) this.dir = -this.dir;
    }
    if (this.kind === 'germ' && this.grounded && this.t % 70 === 0) this.vy = -3.4;
    if (this.y > G.world.deathY) this.dead = true;
  }
  hit(d, bolt) {
    if (this.kind === 'crab' && bolt && Math.sign(bolt.vx) === -this.dir) return 'deflect';
    this.hp -= d; this.flash = 8;
    if (this.state === 'hang' || this.state === 'shake') this.state = 'fall';
    if (this.hp <= 0) killEnemy(this);
    return 'hit';
  }
  draw() {
    if (this.flash > 0 && this.flash % 2) return;
    const cx = Math.round(this.x + this.w / 2), by = Math.round(this.y + this.h), t = this.t, d = this.dir;
    if (this.kind === 'blob') {
      const wob = Math.sin(t * 0.2);
      ell(cx, by - 5, 8 + wob, 6 - wob * 0.6, '#8a7410');
      ell(cx, by - 5.5, 7 + wob, 5.2 - wob * 0.6, '#f2e14c');
      ell(cx - 3, by - 8, 2.5, 1.5, '#fff7b0');
      ctx.fillStyle = '#c7ad22'; ctx.fillRect(cx + 3, by - 2, 2, 2 + (t % 40 < 20 ? 1 : 0));
      eyes(cx + d, by - 8, d, false);
    } else if (this.kind === 'germ') {
      const r = 6;
      ctx.strokeStyle = '#7a0a2a'; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + t * 0.05; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, by - 7 + Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * (r + 3), by - 7 + Math.sin(a) * (r + 3)); ctx.stroke(); }
      circ(cx, by - 7, r + 1, '#7a0a2a'); circ(cx, by - 7, r, '#ff2e63'); circ(cx - 2, by - 9, 2, '#ff8fab');
      eyes(cx + d, by - 8, d, true);
    } else if (this.kind === 'crab') {
      const step = Math.floor(t / 6) % 2;
      ctx.fillStyle = '#5a4520';
      for (let i = 0; i < 3; i++) { ctx.fillRect(cx - 7 + i * 3, by - 3 + ((i + step) % 2), 1, 3); ctx.fillRect(cx + 2 + i * 3, by - 3 + ((i + step + 1) % 2), 1, 3); }
      ctx.fillStyle = '#ff8a3c'; ctx.fillRect(cx + d * 8 - 2, by - 7, 4, 3); ctx.fillRect(cx + d * 10 - 1, by - 9 + step, 3, 2);
      ctx.fillStyle = '#5a4520'; ctx.beginPath(); ctx.ellipse(cx, by - 5, 9, 6.5, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#efe2b0'; ctx.beginPath(); ctx.ellipse(cx, by - 5, 8, 5.5, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#a88a4a'; ctx.fillRect(cx - 4, by - 8, 2, 1); ctx.fillRect(cx + 1, by - 9, 2, 1); ctx.fillRect(cx - 1, by - 7, 2, 1);
      ctx.fillStyle = '#d9c88a'; ctx.fillRect(cx - 8, by - 5, 16, 1);
      ctx.fillStyle = '#1b0f2e'; ctx.fillRect(cx + d * 4, by - 13, 1, 3); ctx.fillRect(cx + d * 6, by - 12, 1, 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx + d * 4 - 1, by - 15, 3, 3); ctx.fillRect(cx + d * 6 - 1, by - 14, 3, 3);
      ctx.fillStyle = '#1b0f2e'; ctx.fillRect(cx + d * 4 + (d > 0 ? 1 : -1) + (d > 0 ? 0 : 1), by - 14, 1, 1); ctx.fillRect(cx + d * 6 + (d > 0 ? 1 : 0), by - 13, 1, 1);
    } else if (this.kind === 'mite') {
      const up = this.state === 'hang' || this.state === 'shake';
      const sx = this.state === 'shake' ? (t % 4 < 2 ? -1 : 1) : 0;
      const yy = up ? this.y + 4 : by - 4;
      ctx.fillStyle = '#4a1a6a';
      for (let i = -1; i <= 1; i++) { const leg = (Math.floor(t / 5) + i) % 2; ctx.fillRect(cx + sx + i * 4 - 1, up ? yy - 5 : yy + 1 + leg, 1, 3); }
      ell(cx + sx, yy, 6.5, 4.5, '#4a1a6a'); ell(cx + sx, yy, 5.5, 3.6, '#b05cff'); ell(cx + sx - 2, yy - 1, 1.6, 1, '#e2b8ff');
      ctx.fillStyle = '#fff'; ctx.fillRect(cx + sx + d * 2 - 1, yy - 2 + (up ? 2 : 0), 2, 2);
      ctx.fillStyle = '#ff2e63'; ctx.fillRect(cx + sx + d * 2, yy - 1 + (up ? 2 : 0), 1, 1);
    }
  }
}
class Bug {
  constructor(o) { Object.assign(this, { kind: 'bug', w: 14, h: 10, x0: o.x, range: o.range || 120, x: o.x, baseY: o.y, y: o.y, dir: 1, hp: 1, dmg: 15, score: 120, t: Math.floor(rand(0, 100)), flash: 0, stompable: true }); }
  update() {
    this.t++; if (this.flash > 0) this.flash--;
    this.x += this.dir * 0.8;
    if (this.x > this.x0 + this.range) this.dir = -1; else if (this.x < this.x0) this.dir = 1;
    this.y = this.baseY + Math.sin(this.t * 0.06) * 10;
  }
  hit(d) { this.hp -= d; this.flash = 6; if (this.hp <= 0) killEnemy(this); return 'hit'; }
  draw() {
    if (this.flash % 2) return;
    const cx = Math.round(this.x + 7), cy = Math.round(this.y + 5), flap = Math.floor(this.t / 4) % 2;
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx - 11, cy - 4 - flap * 2); ctx.lineTo(cx - 11, cy + 4 + flap * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 11, cy - 4 - flap * 2); ctx.lineTo(cx + 11, cy + 4 + flap * 2); ctx.fill();
    ell(cx, cy, 7, 5, '#8a1a6a'); ell(cx, cy, 6, 4, '#ff7ad9');
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 3, cy - 4, 1, 8); ctx.fillRect(cx + 2, cy - 4, 1, 8);
    eyes(cx + this.dir, cy - 2, this.dir, true);
  }
}
class Spitter {
  constructor(o) { Object.assign(this, { kind: 'spitter', w: 14, h: 14, x: o.x - 7, y: o.y - 14, hp: 3, dmg: 15, score: 150, t: 0, flash: 0, cd: 60 + Math.floor(rand(0, 60)), warn: 0, face: -1, stompable: true }); }
  update() {
    this.t++; if (this.flash > 0) this.flash--;
    const p = G.player; if (!p) return;
    const dx = p.x + p.w / 2 - (this.x + 7);
    this.face = dx < 0 ? -1 : 1;
    if (this.warn > 0) { if (--this.warn === 0) this.fire(p); return; }
    if (--this.cd <= 0 && Math.abs(dx) < 170 && Math.abs(p.y - this.y) < 100) { this.warn = 30; this.cd = 125; AudioSys.play('warn'); }
  }
  fire(p) {
    const sx = this.x + 7, sy = this.y + 2, tx = p.x + p.w / 2 + p.vx * 20, ty = p.y + p.h / 2;
    const T = clamp(Math.abs(tx - sx) / 2, 28, 64), g = 0.12;
    G.foes.push({ x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy - 0.5 * g * T * T) / T, g, r: 3, life: 220, kind: 'acid' });
    AudioSys.play('spit');
  }
  hit(d) { this.hp -= d; this.flash = 8; if (this.hp <= 0) killEnemy(this); return 'hit'; }
  draw() {
    if (this.flash % 2) return;
    const cx = Math.round(this.x + 7), by = Math.round(this.y + 14), swell = this.warn > 0 ? Math.sin(this.warn * 0.6) * 1.5 + 1.5 : Math.sin(this.t * 0.08) * 0.6;
    ctx.fillStyle = '#2a6a10'; ctx.fillRect(cx - 5, by - 4, 10, 4);
    ell(cx, by - 7, 7 + swell, 7 + swell * 0.5, '#2a6a10'); ell(cx, by - 7, 6 + swell, 6 + swell * 0.5, '#8cff3c');
    ell(cx - 2, by - 10, 2, 1.5, '#d8ffb0');
    ctx.fillStyle = '#1b0f2e'; ctx.beginPath(); ctx.ellipse(cx + this.face * 3, by - 7, 2, this.warn > 0 ? 3 : 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 3 + this.face, by - 12, 2, 2); ctx.fillRect(cx + 1 + this.face, by - 12, 2, 2);
    ctx.fillStyle = '#1b0f2e'; ctx.fillRect(cx - 2 + this.face * 1.5, by - 11, 1, 1); ctx.fillRect(cx + 2 + this.face * 1.5, by - 11, 1, 1);
  }
}
