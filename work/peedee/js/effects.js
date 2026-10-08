'use strict';
function killEnemy(e) {
  e.dead = true;
  G.score += e.score || 100; G.stats.germs++;
  popup(e.x + e.w / 2, e.y - 4, '+' + (e.score || 100), '#ffcc00');
  const col = { blob: '#f2e14c', germ: '#ff2e63', crab: '#efe2b0', mite: '#b05cff', bug: '#ff7ad9', spitter: '#8cff3c' }[e.kind] || '#fff';
  burst(e.x + e.w / 2, e.y + e.h / 2, 16, [col, '#ffffff'], 2.2);
  AudioSys.play('pop');
  // very rarely, a germ coughs up an extra special-attack charge
  if (G.L.def.special && Math.random() < 0.07) G.drops.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vy: -2.6, life: 720 });
}

/* ---------- effects ---------- */
function spawnP(x, y, o) { const p = Object.assign({ x, y, vx: 0, vy: 0, life: 30, size: 2, color: '#fff', g: 0.12, shape: 'sq' }, o); p.max = p.life; G.parts.push(p); }
/* Clean-up sparkle: little twinkling stars popping up around a freshly cleaned spot, one after another. */
function sparkle(x, y, n) {
  const cols = ['#ffffff', '#bff8ff', '#fff6a0', '#2ce8f5'];
  for (let i = 0; i < (n || 7); i++)
    spawnP(x + rand(-14, 14), y - rand(2, 22), { shape: 'sparkle', life: 22, wait: i * 5 + Math.floor(rand(0, 4)), vx: 0, vy: -0.15, g: 0, color: cols[i % cols.length] });
}
function burst(x, y, n, colors, spd, o) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * spd;
    spawnP(x, y, Object.assign({ vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.4, life: 18 + Math.floor(Math.random() * 22), color: colors[i % colors.length], size: 1 + Math.floor(Math.random() * 2) }, o || {}));
  }
}
function dust(x, y, n, color) { for (let i = 0; i < n; i++) spawnP(x + rand(-4, 4), y - 1, { vx: rand(-1, 1), vy: rand(-0.8, -0.2), color: color || '#ffffff', life: 16, size: 2, g: 0.02 }); }
function popup(x, y, text, color, life) { G.pops.push({ x, y, text, color, life: life || 50, max: life || 50 }); }
function shake(n) { if (!reduceMotion) G.shake = Math.max(G.shake, n); }
const onScreen = (x, y, m) => x > G.cam.x - m && x < G.cam.x + VW + m && y > G.cam.y - m && y < G.cam.y + VH + m;
function dentAt(g, x) { const d = g.dent; if (!d || Math.abs(d.d) < 0.05) return 0; const k = (x - d.x) / 13; return d.d * Math.exp(-k * k); }
