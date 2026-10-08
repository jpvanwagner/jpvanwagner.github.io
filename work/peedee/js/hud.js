'use strict';
/* ============================== HUD ============================== */
const hudCache = {};
function buildSpotIcons() {
  $('spots').innerHTML = G.spots.map((s, i) => '<span class="ico ' + s.kind + '" data-i="' + i + '"></span>').join('');
  hudCache.spots = null;
}
function updateHud(force) {
  const p = G.player; if (!p) return;
  const hp = Math.max(0, p.hp), rot = Math.min(100, G.rot);
  if (force || hudCache.hp !== hp) { $('hpFill').style.width = hp + '%'; $('hpFill').classList.toggle('low', hp <= 30); hudCache.hp = hp; }
  const r = Math.round(rot * 2) / 2;
  if (force || hudCache.rot !== r) { $('rotFill').style.width = r + '%'; $('rotFill').classList.toggle('hot', r >= 75); hudCache.rot = r; }
  if (force || hudCache.score !== G.score) { $('score').textContent = String(G.score).padStart(6, '0'); hudCache.score = G.score; }
  const sig = G.spots.map(s => s.done ? 1 : 0).join('');
  if (force || hudCache.spots !== sig) { $('spots').querySelectorAll('.ico').forEach((el, i) => el.classList.toggle('done', !!(G.spots[i] && G.spots[i].done))); hudCache.spots = sig; }
  const sp = G.L.def.special ? G.specials : -1;
  if (force || hudCache.sp !== sp) { $('spIcons').innerHTML = sp < 0 ? 'NO SIGNAL' : '<span class="spi"></span>'.repeat(sp); hudCache.sp = sp; }
  const nameNow = G.boss && G.boss.kind === 'hal' && G.boss.exposed ? 'HAL-9001 \u2605 EXPOSED' : null;
  if (nameNow !== hudCache.bossName && G.boss) { $('bossName').textContent = nameNow || G.boss.name; hudCache.bossName = nameNow; }
  const bf = G.bossBar;
  if ($('bossBar').classList.contains('on')) {
    G.bossFillT = (G.bossFillT || 0) + 1;
    const shown = Math.min(bf, G.bossFillT / 70);          // the bar fills up at the start of the fight
    if (hudCache.boss !== shown) { $('bossFill').style.width = (shown * 100) + '%'; hudCache.boss = shown; }
  }
}

/* ============================== SIGNS ============================== */
const TOKENS = {
  kb: { MOVE: '← →', JUMP: 'SPACE', SHOOT: 'X', MED: 'C', DOWN: '↓', SPECIAL: 'V' },
  touch: { MOVE: '◀ ▶', JUMP: 'JUMP', SHOOT: 'ZAP', MED: 'MED', DOWN: '▼', SPECIAL: 'SP' }
};
function tokenize(text) {
  const map = TOKENS[document.body.classList.contains('touch') ? 'touch' : 'kb'];
  return text.split('\n').map(line => {
    const segs = []; let last = 0;
    line.replace(/\{(\w+)\}/g, (m, k, i) => { if (i > last) segs.push({ t: line.slice(last, i) }); segs.push({ t: map[k] || k, hi: true }); last = i + m.length; return m; });
    if (last < line.length) segs.push({ t: line.slice(last) });
    return segs;
  });
}
function refreshSigns() { if (G.signs) for (const s of G.signs) { s.lines = tokenize(s.text); s.linesDone = s.textDone ? tokenize(s.textDone) : null; } G.signsLaid = null; }
