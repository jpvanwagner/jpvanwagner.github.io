'use strict';
/* ============================== UPDATE ============================== */
function update() {
  G.t++;
  if (G.medHintT > 0) G.medHintT--;
  if (G.state === 'title') updateTitle();
  else if (G.state === 'dialog') { updateDialog(); updateAmbient(); }
  else if (G.state === 'play' || G.state === 'dying') updatePlay();
  else if (G.state === 'clear' || G.state === 'pause' || G.state === 'over' || G.state === 'won') { if (G.state !== 'pause') updateAmbient(); }
  if (G.fade > 0 && G.fadeTo) { G.fade += 0.06; if (G.fade >= 1) { const f = G.fadeTo; G.fadeTo = null; f(); } }
  else if (G.fade > 0) G.fade = Math.max(0, G.fade - 0.05);
  input.jumpEdge = false; input.medEdge = false;
}
function fadeThen(fn) { if (G.fadeTo) return; G.fade = 0.01; G.fadeTo = fn; }

function updateAmbient() {
  if (!G.world) return;
  updateTerrain();
  for (const s of G.spots) s.t++;
  updateParticles();
}
function updateTerrain() {
  const p = G.player;
  for (const m of G.world.movers) { const ny = m.baseY + Math.sin(G.t * 0.035 + m.phase) * m.amp; m.dy = ny - m.y; m.y = ny; }
  for (const t of G.L.terrain) {
    const s = t.dent || t.sag;
    if (s) {
      const on = p && p.grounded && (p.ground === t || (p.ground && p.ground.mound === t));
      if (on) s.x = lerp(s.x, p.x + p.w / 2, 0.5);
      s.v = (s.v + ((on ? (t.kind === 'gum' || t.kind === 'mound' ? 2.2 : t.kind === 'wire' ? 0.4 : 3) : 0) - s.d) * 0.22) * 0.82;      // braces wire barely gives s.d += s.v;
    }
  }
  const T = G.L.tongue;
  if (T) {
    G.world.time = G.t;
    const d = T.dent, on = p && p.grounded && p.ground === T;
    if (on) d.x = lerp(d.x, p.x + p.w / 2, 0.5);
    d.v = (d.v + ((on ? 2.5 : 0) - d.d) * 0.2) * 0.8; d.d += d.v;
    // every so often a big surge rolls along the tongue toward PeeDee
    if (p && G.state === 'play' && --G.pulseT <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1, inArena = !!G.lock;
      T.pulses.push({ x: p.x - dir * (VW / 2 + 40), px: 0, v: dir * 2.2 * WS, a: (inArena ? 13 : 16) * WS, w: 24 * WS });
      G.pulseT = inArena ? 420 : rand(260, 380);
    }
    for (const q of T.pulses) { q.px = q.x; q.x += q.v; }
    T.pulses = T.pulses.filter(q => !p || Math.abs(q.x - p.x) < VW + 80);
  }
  const gate = G.L.gate;
  if (gate && gate.opening && gate.open < 1) { gate.open = Math.min(1, gate.open + 0.012); if (gate.open >= 1) gate.off = true; if (G.t % 6 === 0) shake(1); }
  if (G.arenaWall) {
    const w = G.arenaWall;
    if (w.sink) { w.rise -= 0.03; if (w.rise <= 0) { w.off = true; G.arenaWall = null; } }
    else if (w.rise < 1) w.rise = Math.min(1, w.rise + 0.05);
  }
  for (const t of G.L.terrain) if (t.dis > 0 && --t.dis === 0) {          // melted gum grows back
    if (p && overlaps(p, t)) t.dis = 6;
    else { t.off = false; burst(t.x + t.w / 2, t.y + 2, 8, ['#ff9cc6', '#ffd6e8'], 1); }
  }
}
function updateParticles() {
  for (const q of G.parts) { if (q.wait > 0) { q.wait--; continue; } q.x += q.vx; q.y += q.vy; q.vy += q.g; q.vx *= 0.98; q.life--; }
  G.parts = G.parts.filter(q => q.life > 0);
  if (G.parts.length > 500) G.parts.splice(0, G.parts.length - 500);
  for (const q of G.pops) { q.y -= 0.35; q.life--; }
  G.pops = G.pops.filter(q => q.life > 0);
}

function updatePlay() {
  const p = G.player, L = G.L;
  updateTerrain();
  if (G.state === 'dying') {
    G.dieT++; p.vy = Math.min(p.vy + 0.3, 6); p.y += p.vy; p.x += p.vx * 0.5;
    updateParticles(); followCam();
    if (G.dieT === 80) showEnd(false);
    return;
  }
  G.stats.frames++;
  p.update();
  if (G.state !== 'play') { updateParticles(); return; }
  if (G.cleanTimer > 0) G.cleanTimer--;
  if (G.cleanTalkT > 0 && --G.cleanTalkT === 0) { dialog(LINES.gap, null); return; }

  for (const e of G.enemies) {
    if (e.dead) continue;
    e.update();
    if (!e.dead) touchEnemy(e);
  }
  if (G.boss) { G.boss.update(); if (G.boss && G.boss.state !== 'dying' && G.boss.state !== 'enter') touchEnemy(G.boss); }
  G.enemies = G.enemies.filter(e => !e.dead);

  // player bolts
  for (const b of G.bolts) {
    b.x += b.vx; b.life--;
    if (groundAt(b.x + b.w / 2, b.y + 1) && groundAt(b.x + b.w / 2, b.y + 1).solid) { b.life = 0; burst(b.x + 3, b.y, 4, ['#2ce8f5', '#fff'], 1); continue; }
    if (b.deflected) continue;
    const gk = G.foes.find(f => f.kind === 'gunk' && f.life > 0 && Math.abs(f.x - (b.x + b.w / 2)) < f.r + 5 && Math.abs(f.y - (b.y + 1)) < f.r + 4);
    if (gk) { gk.life = 0; b.life = 0; AudioSys.play('pop'); burst(gk.x, gk.y, 10, ['#f4ecd0', '#b8a878'], 1.8); popup(gk.x, gk.y - 8, 'SPLAT!', '#f4ecd0', 30); continue; }
    const bub = G.bubbles.find(u => Math.hypot(u.x - (b.x + b.w / 2), u.y - (b.y + 1)) < u.r + 3);
    if (bub) {                      // zaps knock bubbles around
      bub.vx = clamp(bub.vx + b.vx * 0.55 * WS, -4.2 * WS, 4.2 * WS); bub.vy = Math.min(bub.vy, -1.8 * WS);
      b.life = 0; AudioSys.play('boop'); burst(b.x, b.y, 4, ['#fff', '#bff6ff'], 1); continue;
    }
    const targets = G.boss && G.boss.state !== 'dying' ? G.enemies.concat([G.boss]) : G.enemies;
    for (const e of targets) {
      if (e.dead) continue;
      const box = e.kind === 'hal' ? { x: e.x + 6, y: e.y + 6, w: e.w - 12, h: e.h - 12 } : e;
      if (!overlaps(b, box)) continue;
      const r = e.hit(1, b);
      if (r === 'deflect') { b.vx *= -0.7; b.deflected = true; AudioSys.play('ping'); burst(b.x, b.y, 5, ['#fff', '#ffe14d'], 1.4); }
      else if (r === 'absorb') { b.life = 0; burst(b.x + 3, b.y + 1, 6, ['#a8ee5a', '#7bd132'], 1.2); AudioSys.play('tap'); }
      else { b.life = 0; burst(b.x + 3, b.y + 1, 5, ['#2ce8f5', '#fff'], 1.4); if (!e.dead) AudioSys.play('hit'); }
      break;
    }
  }
  G.bolts = G.bolts.filter(b => b.life > 0);

  // hostile goo
  for (const f of G.foes) {
    f.x += f.vx; f.y += f.vy; f.vy += f.g || 0; f.life--;
    const gnd = groundAt(f.x, f.y + f.r * 0.5);
    if ((gnd && (gnd.solid || gnd.kind === 'tongue')) || f.y > L.deathY) {
      f.life = 0;
      if (f.kind === 'gunk' && G.boss && gnd && gnd.kind === 'tongue' && G.coats.length < 4) {
        G.coats.push(new Coat(clamp(f.x, L.arena.x1 + 16, L.arena.x2 - 16))); AudioSys.play('squish', 2);
        for (let i = 0; i < 8; i++) spawnP(f.x, f.y, { vx: rand(-1.2, 1.2), vy: rand(-1.6, -0.3), color: '#f4ecd0', life: 20, size: 2 });
        continue;
      }
      for (let i = 0; i < 6; i++) spawnP(f.x, f.y, { vx: rand(-1.2, 1.2), vy: rand(-1.8, -0.3), color: f.kind === 'acid' ? '#8cff3c' : f.kind === 'gunk' ? '#f4ecd0' : '#a8ee5a', life: 20, size: 2 });
      continue;
    }
    if (Math.abs(f.x - (p.x + p.w / 2)) < f.r + p.w / 2 - 1 && Math.abs(f.y - (p.y + p.h / 2)) < f.r + p.h / 2 - 1) { p.hurt(15, f.x); f.life = 0; }
  }
  G.foes = G.foes.filter(f => f.life > 0);

  // pickups
  for (const g of G.gems) if (!g.taken && Math.abs(g.x - (p.x + p.w / 2)) < 8 && Math.abs(g.y - (p.y + p.h / 2)) < 12) {
    g.taken = true; G.score += 10; G.stats.gems++; AudioSys.play('gem'); burst(g.x, g.y, 6, ['#2ce8f5', '#fff'], 1.2);
  }
  for (const m of G.mints) if (!m.taken && Math.abs(m.x - (p.x + p.w / 2)) < 9 && Math.abs(m.y - (p.y + p.h / 2)) < 13) {
    m.taken = true; p.hp = Math.min(100, p.hp + 30); AudioSys.play('mint'); popup(m.x, m.y - 10, '+30 HP', '#7dffb0'); burst(m.x, m.y, 12, ['#3dff8a', '#fff'], 1.6);
  }
  // nerves: off -> warning flicker -> zapping
  for (const n of G.nerves) {
    n.t = (n.t + 1) % 170;
    if (n.t === 100 && onScreen(n.x, n.y, 40)) AudioSys.play('zap');
    if (n.t >= 100 && p.x + p.w > n.x + 2 && p.x < n.x + n.w - 2 && p.y + p.h > n.y - 12 && p.y + p.h <= n.y + 2) p.hurt(15, p.x + p.w / 2 - p.vx * 10);
  }
  for (const s of G.spots) s.update();
  for (const n of G.nodes) n.update();
  for (const c of G.coats) c.update();
  for (const u of G.ulcers) if (p.grounded && p.ground === G.L.tongue && p.x + p.w > u.x + 2 && p.x < u.x + u.w - 2) { p.hurt(12, p.x + p.w / 2 - p.face * 10); if (p.hurtT === 16) popup(p.x + 5, p.y - 8, 'OUCH! CANKER SORE!', '#ff6b8f', 50); }
  updateBubbles();
  updateDrops();
  updateSpecial();

  // rot rises with every dirty spot left
  const dirty = G.spots.filter(s => !s.done && s.kind !== 'boss').length;
  if (dirty) {
    G.rot += dirty * L.def.rotRate / 60;
    if (G.rot >= 75 && G.t % 120 === 0) AudioSys.play('warn');
    if (G.rot >= 100) { G.rot = 100; die('rot'); }
  }
  updateTriggers();
  updateParticles();
  followCam();
  if (G.banner > 0) { G.banner--; if (G.banner === 150) $('levelName').classList.add('shown'); }   // the name moves up top once it's been introduced
  if (G.cleanMsg && G.cleanMsg.t > 0) G.cleanMsg.t--;
  updateHud();
}


/* ---------- bubbles, drops, specials ---------- */
function updateBubbles() {
  if (!G.bubbles.length) return;
  const A = G.L.arena, p = G.player;
  const target = G.enemies.find(e => e.kind === 'gingi' && !e.defeated && e.state !== 'sleep');
  for (const b of G.bubbles) {
    b.t++; b.life--; if (b.bump > 0) b.bump--;
    b.vy += 0.06 * WS; b.vx *= 0.996; b.vx += (G.wind || 0) * 0.04;
    b.x += b.vx; b.y += b.vy;
    if (b.x - b.r < A.x1) { b.x = A.x1 + b.r; b.vx = Math.abs(b.vx); }
    if (b.x + b.r > A.x2) { b.x = A.x2 - b.r; b.vx = -Math.abs(b.vx); }
    const top = G.L.def.id === 'root' ? 62 * WS : G.cam.y + 8;
    if (b.y - b.r < top) { b.y = top + b.r; b.vy = Math.abs(b.vy) * 0.8; }
    if (b.vy > 0) { const g = groundAt(b.x, b.y + b.r); if (g) { b.y = g.y - b.r; b.vy = -Math.max(3.3 * WS, b.vy * 0.9); AudioSys.play('bloop'); } }
    if (b.y > G.L.deathY) { b.life = 0; continue; }
    const dx = b.x - (p.x + p.w / 2), dy = b.y - (p.y + p.h / 2);
    if (b.bump <= 0 && Math.abs(dx) < b.r + 5 && Math.abs(dy) < b.r + 9) { b.vx = (dx < 0 ? -1 : 1) * 2.4 * WS; b.vy = Math.min(b.vy, -2.8 * WS); b.bump = 12; AudioSys.play('boop'); }
    if (target) {
      const tx = clamp(b.x, target.x + 4, target.x + target.w - 4), ty = clamp(b.y, target.y + 4, target.y + target.h - 4);
      if (Math.hypot(b.x - tx, b.y - ty) < b.r) { b.life = 0; target.bubbleHit(); popBubble(b); continue; }
    }
    if (b.life <= 0) popBubble(b);
  }
  G.bubbles = G.bubbles.filter(b => b.life > 0);
}
function popBubble(b) { burst(b.x, b.y, 14, ['#ffffff', b.kind === 'o2' ? '#bff6ff' : '#7dffb0'], 2); AudioSys.play('pop'); }
function updateDrops() {
  const p = G.player;
  for (const d of G.drops) {
    d.life--; d.vy = Math.min(d.vy + 0.15, 4); d.y += d.vy;
    const g = groundAt(d.x, d.y + 5); if (g && d.vy > 0) { d.y = g.y - 5; d.vy = 0; }
    if (d.y > G.L.deathY) d.life = 0;
    if (Math.abs(d.x - (p.x + p.w / 2)) < 9 && Math.abs(d.y - (p.y + p.h / 2)) < 13) {
      d.life = 0; G.specials = Math.min(3, G.specials + 1); AudioSys.play('mint');
      popup(d.x, d.y - 12, '+1 SPECIAL!', '#ff6fb1', 70); burst(d.x, d.y, 12, ['#ff6fb1', '#ffcc00', '#fff'], 1.8);
    }
  }
  G.drops = G.drops.filter(d => d.life > 0);
}
const SPECIALS = {
  floss: { name: 'FLOSS FRENZY!', color: '#7ff0dc' },
  brush: { name: 'POWER BRUSH!', color: '#2ce8f5' },
  rinse: { name: 'MOUTHWASH WAVE!', color: '#3dd6ff' }
};
function useSpecial() {
  const p = G.player;
  if (G.state !== 'play' || !p || G.special) return;
  const kind = G.L.def.special;
  if (!kind || G.specials <= 0) {
    if (G.medHintT <= 0) { popup(p.x + 5, p.y - 8, kind ? 'NO SPECIALS LEFT!' : 'NO SIGNAL DOWN HERE!', kind ? '#ff6fb1' : '#c58bff', 70); G.medHintT = 60; }
    AudioSys.play('nope'); return;
  }
  G.specials--; G.special = { kind, t: 0 };
  p.inv = Math.max(p.inv, 100);
  AudioSys.play('special'); shake(4); updateHud(true);
}
function updateSpecial() {
  const s = G.special; if (!s) return;
  s.t++;
  if (s.t === 30) {                  // the moment it connects: everything on screen gets cleaned out
    shake(6);
    for (const e of G.enemies) if (!e.dead && e.kind !== 'gingi' && onScreen(e.x + e.w / 2, e.y + e.h / 2, 4)) killEnemy(e);
    G.foes = G.foes.filter(f => !onScreen(f.x, f.y, 8));
    // and it cleans as it goes: floss and the power brush scrub off plaque, the mouthwash rinses tongue gunk
    const scrubs = { floss: ['plaque'], brush: ['plaque'], rinse: ['coat'] }[s.kind] || [];
    for (const sp of G.spots) if (!sp.done && scrubs.includes(sp.kind) && onScreen(sp.x, sp.y, 4)) cleanSpot(sp);
    if (G.boss && s.kind === 'rinse') G.boss.mouthwash();
  }
  if (s.t > 84) G.special = null;
}

function touchEnemy(e) {
  const p = G.player;
  const box = e.kind === 'hal' ? { x: e.x + 8, y: e.y + 6, w: e.w - 16, h: e.h - 10 } : e.kind === 'gingi' ? { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 8 } : { x: e.x + 1, y: e.y + 1, w: e.w - 2, h: e.h - 1 };
  if (e.state === 'hang' || e.state === 'sleep' || e.state === 'panic' || e.state === 'flee' || e.state === 'intro') return;
  if (!overlaps(p, box)) return;
  if (e.stompable && p.vy > 0.5 && p.prevBottom <= e.y + 6) {
    e.hit(e.kind === 'crab' ? 3 : 2);
    p.vy = (keys.jump ? -6 : -4.4) * WS; p.jumping = keys.jump; p.y = e.y - p.h;
    AudioSys.play('stomp'); burst(p.x + 5, p.y + p.h, 6, ['#fff'], 1.4);
    return;
  }
  p.hurt(e.dmg, e.x + e.w / 2);
}

function updateTriggers() {
  const p = G.player, L = G.L, ex = L.exit;
  // Gingi wakes up when PeeDee steps onto the first root pillar
  if (L.def.id === 'root' && !G.gingiMet && p.x > L.arena.x1 + 4 && p.grounded) {
    G.gingiMet = true;
    const gi = G.enemies.find(e => e.kind === 'gingi');
    if (gi) {
      lockArena(); AudioSys.music(null);
      dialog(LINES.gingi, () => { gi.go('drift'); G.fight = true; showBossBar(gi.name, true); AudioSys.music('boss'); });
      return;
    }
  }
  const inExit = p.x + p.w > ex.x && p.x < ex.x + ex.w && p.y + p.h > ex.y && p.y < ex.y + ex.h;
  if (!inExit) return;
  if (!G.clean) {
    if (ex.kind === 'door' && G.exitT <= 0) { popup(p.x + 5, p.y - 8, 'CLEAN EVERY SPOT FIRST!', '#ffcc00', 70); G.exitT = 90; }
    if (G.exitT > 0) G.exitT--;
    return;
  }
  if (ex.kind === 'boss') { if (!G.boss && !G.bossDone) startBoss(); return; }
  levelClear();
}

function followCam() {
  const p = G.player, L = G.L;
  G.camLook = lerp(G.camLook, p.face * Math.min(30, VW * 0.08), 0.04);
  let tx = p.x + p.w / 2 - VW / 2 + G.camLook;
  const boss = G.lock && (G.boss || G.enemies.find(e => e.kind === 'gingi' && !e.defeated));
  if (boss) tx = (p.x + p.w / 2 + boss.x + boss.w / 2) / 2 - VW / 2;     // boss fights: keep both PeeDee and the boss in view
  if (boss) tx = clamp(tx, p.x + p.w + 30 - VW, p.x - 30);              // ...but never lose PeeDee if they're far apart
  // follow the ground PeeDee last stood on, so ordinary jumps don't yank the view up and down
  if (p.grounded || G.camFloor == null) G.camFloor = p.y;
  let ty = G.camFloor + p.h / 2 - VH * 0.52;
  if (G.lock && L.arena.camY != null) ty = L.arena.camY;      // boss fights: hold the whole arena in view
  if (L.def.keepInView != null) ty = Math.min(Math.max(ty, L.def.keepInView * WS + 14 - VH), p.y - VH * 0.36);   // show the gumline under tall teeth, but never crowd PeeDee up under the HUD
  if (p.y - 34 < ty) ty = p.y - 34;                       // keep headroom above
  if (p.y + p.h > ty + VH - 24) ty = p.y + p.h - VH + 24;  // and room below when falling
  G.cam.x += (tx - G.cam.x) * 0.12; G.cam.y += (ty - G.cam.y) * 0.1;
  let x1 = 0, x2 = L.width;
  if (G.lock) { x1 = G.lock.x1; x2 = G.lock.x2; }
  G.cam.x = clamp(G.cam.x, x1, Math.max(x1, x2 - VW));
  G.cam.y = clamp(G.cam.y, L.top, L.poolY + 28 - VH);
}

function die(reason) {
  if (G.state !== 'play') return;
  G.deathReason = reason; G.state = 'dying'; G.dieT = 0;
  const p = G.player; p.vy = -4; p.vx = -p.face * 1.2;
  AudioSys.music(null); AudioSys.play('over'); shake(5); setBodyState();
}
