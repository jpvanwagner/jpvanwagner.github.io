'use strict';
/* Heal-able spots that only matter in boss fights: infected roots (Gingi) and sore gums (Hal).
   Healing one releases a big bouncy bubble (oxygen or mint) to knock into the boss. */
class HealNode {
  constructor(o) { Object.assign(this, { kind: o.kind, x: o.x, y: o.y, progress: 0, ready: true, cool: 0, t: Math.random() * 100, active: false }); }
  near(p) { return Math.abs(p.y + p.h - this.y) < 3 && Math.abs(p.x + p.w / 2 - this.x) < 14; }
  usable() { return G.fight && this.ready; }
  update() {
    this.t++;
    if (!this.ready && --this.cool <= 0 && G.fight) { this.ready = true; burst(this.x, this.y - 2, 8, [this.kind === 'root' ? '#8a1a4a' : '#ff2e4a'], 1); }
    if (!this.active && this.progress > 0) this.progress = Math.max(0, this.progress - 0.3);
    this.active = false;
  }
  complete() {
    this.ready = false; this.progress = 0;
    this.cool = G.boss && G.boss.hp <= G.boss.max / 2 ? 300 : 380;
    const mid = (G.L.arena.x1 + G.L.arena.x2) / 2;
    if (G.bubbles.length >= 3) G.bubbles.shift();
    G.bubbles.push({ kind: this.kind === 'root' ? 'o2' : 'mint', x: this.x, y: this.y - 14, vx: (this.x < mid ? 1.2 : -1.2) * WS, vy: -3.6 * WS, r: 9, life: 900, bump: 0, t: 0 });
    AudioSys.play('fixed'); burst(this.x, this.y - 4, 16, ['#ffffff', this.kind === 'root' ? '#bff6ff' : '#7dffb0'], 2);
    popup(this.x, this.y - 22, this.kind === 'root' ? 'OXYGEN!' : 'MINTY FRESH!', this.kind === 'root' ? '#bff6ff' : '#7dffb0', 60);
    if (!G.hints.bubble) { G.hints.bubble = true; popup(this.x, this.y - 34, 'KNOCK IT INTO HIM!', '#ffcc00', 110); }
  }
}

/* ---------- Tartarus boss: Porphyromonas gingivalis ("Gingi") ----------
   A frantic little anaerobe in goggles, shielded by plates of hardened tartar in sticky biofilm. Zaps bounce
   off; collagenase beams melt the gum tissue. Oxygen bubbles (from healed roots) crack the plates off. */
class Gingi {
  constructor(o) {
    Object.assign(this, { kind: 'gingi', name: 'P. GINGIVALIS', w: 30, h: 28, x: o.x - 15, y: 104 * WS, x1: o.x1, x2: o.x2, armor: 4, max: 4,
      state: 'sleep', t: 0, st: 0, flash: 0, tx: o.x - 15, homeY: 104 * WS, dmg: 20, score: 1500, beam: null, mark: null, n: 0, stompable: false });
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  go(s) { this.state = s; this.st = 0; }
  update() {
    this.t++; this.st++; if (this.flash > 0) this.flash--;
    const p = G.player, fast = this.armor <= 2;
    switch (this.state) {
      case 'sleep': this.y = this.homeY + Math.sin(this.t * 0.04) * 3; break;
      case 'drift':
        this.x += clamp(this.tx - this.x, -0.9 * WS, 0.9 * WS);
        this.y += (this.homeY + Math.sin(this.t * 0.07) * 8 * WS - this.y) * 0.08;
        if (Math.abs(this.tx - this.x) < 2) this.tx = rand(this.x1, this.x2 - this.w);
        if (this.st > (fast ? 95 : 140)) { this.go(this.n++ % 2 ? 'aim' : 'rise'); AudioSys.play('charge'); }
        break;
      case 'rise':                       // climbs, then sweeps a beam along the gum floor
        this.y += (70 * WS - this.y) * 0.08;
        if (this.st > 40) {
          const fromLeft = p.x + p.w / 2 > (this.x1 + this.x2) / 2;
          this.beam = { kind: 'sweep', a: fromLeft ? this.x1 + 2 : this.x2 - 2, b: fromLeft ? this.x2 - 2 : this.x1 + 2, t: 0, dur: fast ? 80 : 100, ex: 0, ey: 192 * WS };
          this.go('fire'); AudioSys.play('laser');
        }
        break;
      case 'aim':                        // locks onto where PeeDee stands (even the root pillars), then blasts it
        if (this.st === 1) this.mark = { x: p.x + p.w / 2, y: p.y + p.h };
        if (this.st > (fast ? 38 : 50)) { this.beam = { kind: 'focus', a: this.mark.x, b: this.mark.x, t: 0, dur: 36, ex: this.mark.x, ey: this.mark.y }; this.mark = null; this.go('fire'); AudioSys.play('laser'); }
        break;
      case 'fire': {
        const B = this.beam; B.t++;
        B.ex = lerp(B.a, B.b, Math.min(1, B.t / B.dur));
        meltAt(B.ex, B.ey);
        if (G.t % 2 === 0) spawnP(B.ex + rand(-3, 3), B.ey - 1, { vx: rand(-1, 1), vy: rand(-2, -0.5), color: Math.random() < 0.5 ? '#ff4dd2' : '#ffe14d', life: 16, size: 1 });
        // the hot end of the beam burns
        const sx = this.cx, sy = this.cy + 6;
        for (let k = 0.55; k <= 1.001; k += 0.05) {
          const bx = lerp(sx, B.ex, k), by = lerp(sy, B.ey, k);
          if (bx > p.x - 2 && bx < p.x + p.w + 2 && by > p.y && by < p.y + p.h + 2) { p.hurt(20, bx); break; }
        }
        if (B.t >= B.dur) { this.beam = null; this.go('drift'); }
        break;
      }
      case 'stun': this.x += Math.sin(this.st * 1.7) * 1.2; this.y += (this.homeY - this.y) * 0.05; if (this.st > 55) this.go('drift'); break;
      case 'panic': this.x += Math.sin(this.st * 2.3) * 2; if (this.st > 70) { this.go('flee'); popup(this.cx, this.y - 16, "YOU HAVEN'T SEEN THE LAST OF ME!", '#c58bff', 120); AudioSys.play('squeak'); } break;
      case 'flee': this.x += ((G.L.arena.lockR || this.x2 + 100) - 60 - this.x) * 0.05; this.y -= 2.6; if (this.st % 4 === 0) spawnP(this.cx, this.cy + 10, { vx: rand(-0.5, 0.5), vy: 1, color: '#c58bff', life: 20, size: 2 }); if (this.y < -280 * WS) this.dead = true; break;
    }
    if (this.state !== 'flee') this.x = clamp(this.x, this.x1 - 10, this.x2 - this.w + 10);
    G.bossBar = this.armor / this.max;
  }
  hit(d, bolt) {
    if (this.armor <= 0 || this.state === 'sleep') return 'deflect';
    if (!G.hints.armor) { G.hints.armor = true; popup(this.cx, this.y - 14, 'TARTAR ARMOR! ZAPS BOUNCE OFF!', '#ffcc00', 120); }
    return 'deflect';
  }
  bubbleHit() {
    if (this.armor <= 0) return;
    this.armor--; this.flash = 20; this.beam = null; this.mark = null; shake(5);
    AudioSys.play('hiss'); AudioSys.play('crumble');
    for (let i = 0; i < 26; i++) spawnP(this.cx + rand(-14, 14), this.cy + rand(-12, 12), { vx: rand(-2.5, 2.5), vy: rand(-3, 0.5), color: ['#e2c870', '#a88a4a', '#bfe65a'][i % 3], life: 40, size: 2 + (i % 2), g: 0.16 });
    popup(this.cx, this.y - 10, this.armor ? 'HISSSSS!' : 'AAAH! OXYGEN!', this.armor ? '#bff6ff' : '#c58bff', 80);
    if (this.armor > 0) { this.go('stun'); return; }
    // fully exposed: he panics and bolts for the surface
    this.defeated = true; this.go('panic');
    G.score += this.score; G.stats.germs++; G.fight = false;
    popup(this.cx, this.y - 24, '+' + this.score, '#ffcc00', 100);
    for (const b of G.bubbles) b.life = Math.min(b.life, 20);
    if (G.arenaWall) G.arenaWall.sink = true;
    G.lock = null; $('bossBar').classList.remove('on');
    AudioSys.music(G.L.def.music);
  }
  draw() {
    const t = this.t, jit = this.state === 'panic' ? rand(-2, 2) : Math.sin(t * 0.9) * 0.6;
    const cx = Math.round(this.cx + jit), cy = Math.round(this.cy);
    // aiming reticle and the collagenase beam
    if (this.mark && t % 6 < 4) { ctx.strokeStyle = '#ff4dd2'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(this.mark.x, this.mark.y - 4, 7, 0, Math.PI * 2); ctx.moveTo(this.mark.x - 10, this.mark.y - 4); ctx.lineTo(this.mark.x + 10, this.mark.y - 4); ctx.stroke(); }
    if (this.state === 'rise' && this.st > 20 && t % 4 < 2) { ctx.fillStyle = '#ff4dd2'; ctx.fillRect(cx - 1, cy + 6, 2, 3); }
    if (this.beam) {
      const B = this.beam;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,77,210,.35)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx, cy + 6); ctx.lineTo(B.ex, B.ey); ctx.stroke();
      ctx.strokeStyle = '#ff4dd2'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      ctx.lineCap = 'butt';
      circ(B.ex, B.ey - 1, 4 + (t % 3), 'rgba(255,225,77,.8)');
    }
    // sticky biofilm halo
    if (this.armor > 0 && this.state !== 'flee') {
      ctx.fillStyle = 'rgba(190,230,90,.25)'; ctx.beginPath(); ctx.arc(cx, cy, 21 + Math.sin(t * 0.1), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(190,230,90,.5)'; for (let i = 0; i < 3; i++) ctx.fillRect(cx - 10 + i * 9, cy + 18, 2, 3 + ((t / 8 + i * 3) % 6));
    }
    // the germ: a deep-purple coccobacillus with wiggly fimbriae
    ctx.strokeStyle = '#c58bff'; ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 7); ctx.lineTo(cx + Math.cos(a) * (13 + Math.sin(t * 0.3 + i) * 2), cy + Math.sin(a) * (10 + Math.sin(t * 0.3 + i) * 2)); ctx.stroke(); }
    ell(cx, cy, 11, 8, '#2a0a4a'); ell(cx, cy, 10, 7, this.flash % 4 > 1 ? '#ffffff' : '#5a1a9a'); ell(cx - 3, cy - 3, 4, 2, '#9a5ad8');
    // engineer goggles (eyes go red while charging)
    const charge = this.state === 'rise' || this.state === 'aim';
    ctx.fillStyle = '#1b0f2e'; ctx.fillRect(cx - 10, cy - 4, 20, 2);
    circ(cx - 4, cy - 2, 4, '#ffcc00'); circ(cx + 5, cy - 2, 3, '#ffcc00');
    circ(cx - 4, cy - 2, 2.6, charge ? '#ff2e63' : '#ffffff'); circ(cx + 5, cy - 2, 1.8, charge ? '#ff2e63' : '#ffffff');
    ctx.fillStyle = '#1b0f2e'; ctx.fillRect(cx - 4 + Math.sign(G.player.x - cx), cy - 2, 1, 1); ctx.fillRect(cx + 5 + Math.sign(G.player.x - cx), cy - 2, 1, 1);
    ctx.fillStyle = '#1b0f2e'; ctx.fillRect(cx - 5, cy + 3, 10, this.state === 'panic' ? 4 : 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 4, cy + 3, 2, 1); ctx.fillRect(cx, cy + 3, 2, 1); ctx.fillRect(cx + 3, cy + 3, 1, 1);
    // tartar plates (top, left, right, bottom): each oxygen hit cracks one off
    const plates = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
    for (let i = 0; i < this.armor; i++) {
      const a = plates[4 - this.armor + i];
      ctx.strokeStyle = '#5a4520'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, 15, a - 0.62, a + 0.62); ctx.stroke();
      ctx.strokeStyle = '#e2c870'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, 15, a - 0.58, a + 0.58); ctx.stroke();
      ctx.fillStyle = '#a88a4a'; ctx.fillRect(Math.round(cx + Math.cos(a) * 15), Math.round(cy + Math.sin(a) * 15), 2, 1);
      ctx.fillStyle = '#fff6c0'; ctx.fillRect(Math.round(cx + Math.cos(a - 0.3) * 16), Math.round(cy + Math.sin(a - 0.3) * 16), 1, 1);
    }
    if (this.state === 'sleep') ptext('z', cx + 16, cy - 20 - (t / 6 % 8), '#d9b8ff', 8);
  }
}
function meltAt(x, y) {
  for (const t of G.L.terrain) {
    if (!t.melt || t.off || x < t.x - 2 || x > t.x + t.w + 2 || Math.abs(t.y - y) > 10 * WS) continue;
    t.off = true; t.dis = 300;
    if (t.dent) { t.dent.d = 0; t.dent.v = 0; }
    AudioSys.play('sizzle');
    for (let i = 0; i < 14; i++) spawnP(t.x + rand(0, t.w), t.y + rand(0, 4), { vx: rand(-0.6, 0.6), vy: rand(-1.4, 0.4), color: ['#ff9cc6', '#d8417a', '#ff4dd2'][i % 3], life: 30, size: 2, g: 0.12 });
  }
}

/* ---------- the final boss ---------- */
/* ---------- the final boss: Hal-9001 ----------
   Hal's stench shield feeds on the furry gunk coating the tongue (that's really where bad breath brews).
   Zaps fizzle until PeeDee scrubs every patch away; then Hal is exposed until he spits fresh gunk back
   onto the tongue. Gunk globs can be zapped out of the air before they land. */
class Coat {
  constructor(x) { Object.assign(this, { kind: 'coat', x, y: tongueY(G.L.tongue, x, G.t), progress: 0, active: false, t: Math.random() * 100 }); }
  near(p) { return p.grounded && Math.abs(p.x + p.w / 2 - this.x) < 15 && Math.abs(p.y + p.h - this.y) < 6; }
  update() {
    this.t++; this.y = tongueY(G.L.tongue, this.x, G.t) + dentAt(G.L.tongue, this.x);
    if (!this.active && this.progress > 0) this.progress = Math.max(0, this.progress - 0.4);
    this.active = false;
    if (this.t % 18 === 0) spawnP(this.x + rand(-6, 6), this.y - 3, { vx: 0, vy: -0.35, color: '#b6ff3b', life: 40, size: 1, g: -0.003, shape: 'stink' });
  }
  complete() {
    G.coats = G.coats.filter(c => c !== this);
    G.score += 50; AudioSys.play('fixed');
    burst(this.x, this.y - 2, 16, ['#ffffff', '#f4ecd0', '#ffb3c6'], 2);
    sparkle(this.x, this.y - 2, 6);
    popup(this.x, this.y - 20, G.coats.length ? G.coats.length + ' MORE!' : 'TONGUE CLEAN!', '#ffffff', 60);
    if (!G.coats.length && G.boss) G.boss.auraDown();
  }
}
class Hal {
  constructor(x) {
    Object.assign(this, { kind: 'hal', name: 'HAL-9001', w: 60, h: 50, x, y: -80, hp: 50, max: 50, dmg: 25, t: 0, st: 0, state: 'enter', flash: 0, homeY: 84 * WS, tx: x, n: 0, marks: [], score: 5000, gustDir: 1, bareT: 0 });
  }
  go(s) { this.state = s; this.st = 0; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get busy() { return this.state === 'dying' || this.state === 'enter' || this.state === 'intro'; }
  get exposed() { return !G.coats.length && !this.busy; }
  update() {
    const A = G.L.arena, p = G.player, p2 = this.hp <= this.max / 2, T = G.L.tongue;
    this.t++; this.st++; if (this.flash > 0) this.flash--;
    if (this.exposed) this.bareT++; else this.bareT = 0;
    switch (this.state) {
      case 'enter': this.y += (this.homeY - this.y) * 0.05; if (this.st > 80) this.go('drift'); break;
      case 'drift':
        this.x += clamp(this.tx - this.x, -1.1 * WS, 1.1 * WS);
        this.y += (this.homeY + Math.sin(this.t * 0.05) * 14 * WS - this.y) * 0.1;
        if (Math.abs(this.tx - this.x) < 2) this.tx = clamp(p.x + rand(-VW * 0.38, VW * 0.38) - this.w / 2, A.x1 + 16, A.x2 - this.w - 16);   // hovers near PeeDee, so he stays on screen
        if (this.st > (p2 ? 80 : 115)) {
          let next;
          if (this.exposed && this.bareT > (p2 ? 170 : 230)) next = 'recoat';      // he won't stay bare for long
          else {
            const seq = p2 ? ['spread', 'gust', 'recoat', 'swoop', 'rain', 'summon', 'spread', 'gust', 'swoop'] : ['spread', 'recoat', 'rain', 'spread', 'swoop'];
            next = seq[this.n++ % seq.length];
          }
          if (next === 'recoat' && G.coats.length >= 3) next = 'spread';
          if (next === 'summon' && G.enemies.filter(e => e.kind === 'bug' && !e.dead).length >= 2) next = 'rain';
          this.go(next + 'Warn'); AudioSys.play('warn');
        }
        break;
      case 'recoatWarn':                 // gurgles up a mouthful of gunk and spits it back onto the tongue
        this.y += (this.homeY - 16 - this.y) * 0.06;
        if (this.st > 36) {
          const n = p2 ? 3 : 2, g = 0.1, F = 70;
          for (let i = 0; i < n; i++) {
            const tx = rand(A.x1 + 24, A.x2 - 24), ty = tongueY(T, tx, G.t) - 4, sx = this.cx, sy = this.cy + 10;
            G.foes.push({ kind: 'gunk', x: sx, y: sy, vx: (tx - sx) / F, vy: (ty - sy - 0.5 * g * F * F) / F, g, r: 5, life: 300 });
          }
          AudioSys.play('spit'); this.go('drift');
          if (!G.hints.gunk) { G.hints.gunk = true; popup(this.cx, this.y - 12, 'ZAP THE GUNK BEFORE IT LANDS!', '#ffcc00', 110); }
        }
        break;
      case 'spreadWarn':
        if (this.st > 34) {
          const n = p2 ? 5 : 3, ang = Math.atan2(p.y + 9 - this.cy, p.x + 5 - this.cx);
          for (let i = 0; i < n; i++) { const a = ang + (i - (n - 1) / 2) * 0.3; G.foes.push({ x: this.cx, y: this.cy + 8, vx: Math.cos(a) * 2.1, vy: Math.sin(a) * 2.1, r: 5, life: 240, g: 0, kind: 'stink' }); }
          AudioSys.play('spit'); this.go('drift');
        }
        break;
      case 'rainWarn':
        if (this.st === 1) { this.marks = [p.x + 5]; const k = p2 ? 5 : 3; for (let i = 0; i < k; i++) this.marks.push(rand(A.x1 + 16, A.x2 - 16)); }
        this.y += (16 * WS - this.y) * 0.06;
        if (this.st > 56) { this.marks.forEach((mx, i) => G.foes.push({ x: mx, y: G.cam.y - 8 - i * 16, vx: 0, vy: 1, r: 4, life: 260, g: 0.11, kind: 'drop' })); this.marks = []; this.go('drift'); }
        break;
      case 'swoopWarn':
        this.x += Math.sin(this.st * 1.3) * 1.3;
        if (this.st > 40) { this.sx = clamp(p.x + p.w / 2 - this.w / 2, A.x1, A.x2 - this.w); this.sy = tongueY(T, this.sx + this.w / 2, G.t) - this.h - 2; this.go('swoop'); AudioSys.play('roar'); }
        break;
      case 'swoop': {
        const dx = this.sx - this.x, dy = this.sy - this.y, d = Math.hypot(dx, dy);
        if (d < 4 || this.st > 70) { shake(3); this.go('recover'); } else { this.x += dx / d * 4.2 * WS; this.y += dy / d * 4.2 * WS; }
        break;
      }
      case 'recover': this.y += (this.homeY - this.y) * 0.05; if (this.st > 50) this.go('drift'); break;
      case 'reel': this.y += (112 * WS - this.y) * 0.08; this.x += Math.sin(this.st * 1.2) * 0.8; if (this.st > 55) this.go('drift'); break;
      case 'gustWarn':                   // inhales... then blasts bad breath across the arena
        this.gustDir = p.x + p.w / 2 > this.cx ? 1 : -1;
        if (this.st > 32) { this.go('gust'); AudioSys.play('roar'); }
        break;
      case 'gust':
        G.wind = this.gustDir * 1.05;
        if (this.st % 2 === 0) spawnP(this.gustDir > 0 ? G.cam.x : G.cam.x + VW, G.cam.y + rand(60, VH - 20), { vx: this.gustDir * rand(5, 8), vy: 0, color: 'rgba(200,255,140,.8)', life: 70, size: 1, g: 0, shape: 'streak' });
        if (this.st % 22 === 0) G.foes.push({ x: this.cx, y: this.cy + 6, vx: this.gustDir * 2.6, vy: rand(-0.4, 0.8), r: 4, life: 200, g: 0, kind: 'stink' });
        if (this.st > 100) { G.wind = 0; this.go('drift'); }
        break;
      case 'summonWarn':
        if (this.st > 30) { for (let i = 0; i < 2; i++) G.enemies.push(new Bug({ x: this.cx - 60 + i * 50, y: this.cy + 10, range: 100 })); burst(this.cx, this.cy, 16, ['#86e23a', '#ff7ad9'], 2); this.go('drift'); }
        break;
      case 'dying':
        this.y += 0.15;
        if (this.st % 6 === 0) { burst(this.x + rand(0, this.w), this.y + rand(0, this.h), 10, ['#86e23a', '#ffe14d', '#fff'], 2.2); AudioSys.play('pop'); shake(2); }
        if (this.st > 130) { this.dead = true; burst(this.cx, this.cy, 60, ['#86e23a', '#ffe14d', '#ffffff', '#2ce8f5'], 3.5); AudioSys.play('boom'); shake(8); G.boss = null; setTimeout(halOutro, 900); }
        break;
    }
    if (this.state !== 'gust' && G.wind) G.wind = 0;
    if (this.state !== 'dying') this.x = clamp(this.x, A.x1, A.x2 - this.w);
    G.bossBar = Math.max(0, this.hp / this.max);
  }
  hit(d) {
    if (this.busy) return 'absorb';
    if (!this.exposed) {               // the stench shield eats zaps
      if (!G.hints.aura) { G.hints.aura = true; popup(this.cx, this.y - 12, 'ZAPS FIZZLE! SCRUB THE TONGUE!', '#c6ff3b', 130); }
      return 'absorb';
    }
    return this.damage(d);
  }
  auraDown(bonus) {
    if (this.busy) return;
    G.wind = 0; this.marks = [];
    popup(this.cx, this.y - 12, 'STENCH BROKEN! ZAP HIM!', '#7dffb0', 100);
    AudioSys.play('hiss');
    burst(this.cx, this.cy, 30, ['#7dffb0', '#ffffff', '#2ce8f5'], 3);
    this.damage(bonus || 3);
    if (this.state !== 'dying') this.go('reel');
  }
  mouthwash() {                        // the Mouthwash Wave rinses every patch of gunk away at once
    if (this.busy) return;
    for (const c of G.coats) burst(c.x, c.y - 2, 10, ['#ffffff', '#3dd6ff'], 2);
    G.coats = []; G.foes = G.foes.filter(f => f.kind !== 'gunk');
    this.auraDown(6);
  }
  damage(d) {
    this.hp -= d; this.flash = 6; AudioSys.play('hit');
    if (this.hp <= 0) { this.hp = 0; this.go('dying'); G.bossDone = true; G.fight = false; G.wind = 0; G.coats = []; G.score += this.score; popup(this.cx, this.y - 6, '+' + this.score, '#ffcc00', 90); AudioSys.music(null); AudioSys.play('roar'); }
    return 'hit';
  }
  draw() {
    const cx = Math.round(this.cx), cy = Math.round(this.cy), t = this.t, warn = this.state.endsWith('Warn');
    if (this.flash % 2 && this.state !== 'dying') return;
    // stink wisps
    ctx.strokeStyle = 'rgba(150,230,80,.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const x = cx - 18 + i * 18; ctx.beginPath(); ctx.moveTo(x, cy - 26); ctx.bezierCurveTo(x + 5, cy - 34 - (t % 20), x - 5, cy - 40, x + Math.sin(t * 0.1 + i) * 4, cy - 50); ctx.stroke(); }
    if (!this.exposed && this.state !== 'dying' && this.state !== 'intro') {      // stench shield
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + t * 0.03; circ(cx + Math.cos(a) * 34, cy + Math.sin(a) * 28, 8 + Math.sin(t * 0.1 + i) * 2, 'rgba(160,220,60,.22)'); }
    } else if (this.exposed && t % 10 < 6) { ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 30 + (t * 3 % 60), cy - 26, 2, 2); ctx.fillRect(cx + 26 - (t * 2 % 50), cy + 20, 2, 2); }
    const puffs = [[-22, 4, 13], [22, 4, 13], [-12, -12, 15], [12, -12, 15], [0, -20, 13], [0, 8, 18], [-26, -6, 9], [26, -6, 9]];
    const glow = warn && t % 6 < 3;
    for (const [dx, dy, r] of puffs) circ(cx + dx, cy + dy + Math.sin(t * 0.08 + dx) * 1, r + 2, glow ? '#ff2e63' : '#45283c');
    for (const [dx, dy, r] of puffs) circ(cx + dx, cy + dy + Math.sin(t * 0.08 + dx) * 1, r, this.state === 'dying' && t % 4 < 2 ? '#ffffff' : this.exposed ? '#a8f0c0' : '#7bd132');
    for (const [dx, dy, r] of puffs) circ(cx + dx - r * 0.3, cy + dy - r * 0.35 + Math.sin(t * 0.08 + dx) * 1, r * 0.45, '#a8ee5a');
    // angry eyes
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.ellipse(cx - 12, cy - 6, 7, 9, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 12, cy - 6, 7, 9, 0.5, 0, Math.PI * 2); ctx.fill();
    const lx = clamp((G.player.x - cx) * 0.03, -2, 2);
    ctx.fillStyle = '#ff2e63'; ctx.fillRect(cx - 14 + lx, cy - 6, 4, 4); ctx.fillRect(cx + 10 + lx, cy - 6, 4, 4);
    ctx.fillStyle = '#1b0f2e'; ctx.save(); ctx.translate(cx, cy - 15);
    ctx.rotate(0.35); ctx.fillRect(-20, -1, 13, 3); ctx.rotate(-0.7); ctx.fillRect(7, -1, 13, 3); ctx.restore();
    // grimy grin
    const open = warn || this.state === 'gust' ? 8 : 5;
    if (this.state === 'gustWarn' || this.state === 'recoatWarn') { circ(cx - 22, cy + 8, 6 + this.st / 6, '#7bd132'); circ(cx + 22, cy + 8, 6 + this.st / 6, '#7bd132'); }
    ctx.fillStyle = '#2a0a1a'; ctx.beginPath(); ctx.ellipse(cx, cy + 10, 16, open, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8d36a'; for (let i = 0; i < 5; i++) ctx.fillRect(cx - 12 + i * 5 + (i % 2), cy + 10 - open + 1, 3, 3 + (i % 2));
    ctx.fillStyle = '#c94a8a'; ctx.beginPath(); ctx.ellipse(cx + 2, cy + 10 + open - 3, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }
}
