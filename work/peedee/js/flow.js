'use strict';
/* ============================== FLOW ============================== */
const SPEAKERS = {
  pd: { name: 'PEEDEE', color: '#ffcc00' },
  hq: { name: 'MOUTH HQ', color: '#2ce8f5' },
  hal: { name: 'HAL', color: '#c6ff3b' },
  gi: { name: 'GINGI', color: '#c58bff' }
};
const LINES = {
  intro: [
    { who: 'hq', text: "PeeDee, come in! Sugar levels are spiking. Cavities and plaque are popping up all over the front teeth!" },
    { who: 'pd', text: 'Say no more. Time to brush up on my heroics!' },
    { who: 'hq', text: "Clean every dirty spot before the ROT meter maxes out. Follow the signs, they'll show you the ropes." },
    { who: 'pd', text: 'And if things get hairy, I packed two FLOSS FRENZY specials. First rule of Bite Club: floss!' }
  ],
  skip: [
    { who: 'hq', text: 'Skipping basic training? Bold. Straight down under the gums with you, PeeDee!' },
    { who: 'pd', text: 'Into the dark. What could possibly go wrong?' }
  ],
  back: [
    { who: 'pd', text: "Fresh air! That shaft came up right behind the molars. I'm on the dark side of the teeth!" },
    { who: 'hq', text: "Nobody ever brushes back there, so it's crawling with tartar. Drop down the backs of the teeth to scrub the gumline, but watch out: that's where the germs hang out." },
    { who: 'hq', text: 'Your special is now the POWER BRUSH. Two charges per area, so save them for a crowd!' }
  ],
  gap: [
    { who: 'hq', text: "Great work, PeeDee! Those front teeth are sparkling... but the scanners are picking up something nasty down past the gumline." },
    { who: 'pd', text: "That tartar plug between the back molars just crumbled. The gum's pulled away from the teeth there... it's a deep pocket!" },
    { who: 'hq', text: "Drop through the braces wire and down into the gap. Whatever is rotting those roots, find it!" }
  ],
  root: [
    { who: 'pd', text: "Whoa! That gum had pulled away from the tooth all the way down to the ROOTS. It's pitch dark down here..." },
    { who: 'hq', text: "PeeDee, you've fallen into TARTARUS, the underworld of tartar! Clean up the decay, then find a way back out. We can't beam specials down that deep, so you're on your own!" }
  ],
  gingi: [
    { who: 'gi', text: "Heh-heh-HEH! An intruder in my subgingival paradise! No oxygen, no toothbrushes... just me and my gorgeous biofilm!" },
    { who: 'pd', text: 'Deep purple, twitchy, terrible goggles... a keystone pathogen! Porphyromonas gingivalis!' },
    { who: 'gi', text: "Call me GINGI! My tartar armor can't be brushed OR zapped, and my collagenase melts gums like butter. Watch your step!" },
    { who: 'pd', text: "He's anaerobic, so oxygen is poison to him! If I heal those infected roots, the fresh tissue should breathe out oxygen..." }
  ],
  tongue: [
    { who: 'pd', text: "Down off the back of the molars and... whoa, the ground is squishy, and it keeps MOVING. I'm on the TONGUE!" },
    { who: 'hq', text: "Careful, it's bouncy! See that furry white gunk? That's tongue coating, where bad breath brews. Scrub it off as you go." },
    { who: 'hq', text: "Something huge is hiding behind a wall of stench at the back. Your special here is a MOUTHWASH WAVE. It rinses away gunk, too!" }
  ],
  hal: [
    { who: 'hal', name: '???', text: 'Well, well. The little toothbrush hero. Do you know what I am?' },
    { who: 'hal', name: '???', text: "I am HALITOSIS! Born of a thousand skipped brushings, fed on soda and midnight snacks, raised in the cracks where floss fears to go!" },
    { who: 'pd', text: 'Halitosis... BAD BREATH! So YOU\'RE what\'s been stinking up this mouth!' },
    { who: 'hal', text: 'Halitosis is such a mouthful. My friends call me HAL. Well... they would, if any of them could stand to be near me.' },
    { who: 'hal', text: "Every crumb you left behind, every 'I'll brush in the morning'... it all became ME. Gingi? A mere whiff. My stench outclasses every germ in this mouth!" },
    { who: 'pd', text: 'Scanning his stench level... no way. It reads... level 9000!' },
    { who: 'hal', text: "Level 9000? HA! It's so bad... IT'S OVER 9000!!!" },
    { who: 'pd', text: "Zaps won't get through a stench that thick... but it's all coming from the gunk on this tongue. Scrub it off and his shield goes down!" },
    { who: 'hal', text: 'Scrub all you like, little brush. I\'ll just slime it right back on!' }
  ],
  outro: [
    { who: 'hal', text: 'Nooo... my stench... it\'s fading... I\'ve been... freshened...' },
    { who: 'pd', text: "Minty fresh! And remember, everyone: brush twice a day and don't forget to floss!" }
  ]
};
const LEVEL_INTRO = { root: 'root', back: 'back', tongue: 'tongue' };   // dialogue that opens each level

/* ---------- dialogue ---------- */
const DLG = { lines: [], i: 0, shown: 0, text: '', done: null };
function dialog(lines, done) {
  DLG.lines = lines; DLG.i = 0; DLG.done = done;
  G.state = 'dialog'; releaseAll(); setBodyState(); showLine(); AudioSys.duck(true);
}
function showLine() {
  const l = DLG.lines[DLG.i], sp = SPEAKERS[l.who];
  $('dlgName').textContent = l.name || sp.name; $('dlgName').style.color = sp.color;
  DLG.text = l.text; DLG.shown = 0; $('dlgText').textContent = ''; $('dlgText').scrollTop = 0;
  drawPortrait(l.who);
  $('dialog').classList.add('on');
}
function updateDialog() {
  if (DLG.shown >= DLG.text.length) return;
  DLG.shown = Math.min(DLG.text.length, DLG.shown + 1.6);
  const el = $('dlgText'); el.textContent = DLG.text.slice(0, Math.floor(DLG.shown)); el.scrollTop = el.scrollHeight;
  if (G.t % 4 === 0) AudioSys.play('blip');
}
function advanceDialog() {
  if (G.state !== 'dialog') return;
  if (DLG.shown < DLG.text.length) { DLG.shown = DLG.text.length; $('dlgText').textContent = DLG.text; $('dlgText').scrollTop = 1e6; return; }
  AudioSys.play('select');
  if (++DLG.i < DLG.lines.length) { showLine(); return; }
  $('dialog').classList.remove('on');
  const done = DLG.done; DLG.done = null;
  G.state = 'play'; input.jumpEdge = false; setBodyState(); AudioSys.duck(false);
  if (done) done();
}
$('stage').addEventListener('pointerdown', e => { if (G.state === 'dialog' && !e.target.closest('.hbtn')) { AudioSys.init(); advanceDialog(); } });

function drawPortrait(who) {
  const c = $('portrait'), g = c.getContext('2d');
  g.imageSmoothingEnabled = false; g.clearRect(0, 0, 40, 40);
  const grd = g.createLinearGradient(0, 0, 0, 40); grd.addColorStop(0, '#5a2a8a'); grd.addColorStop(1, '#2a1450');
  g.fillStyle = grd; g.fillRect(0, 0, 40, 40);
  if (who === 'pd') { g.save(); g.translate(4, 6); g.scale(2, 2); g.drawImage(SPR.body, 0, 0); g.restore(); }
  else if (who === 'hq') {
    g.fillStyle = '#1b0f2e'; g.beginPath(); g.roundRect(9, 7, 22, 28, [9, 9, 4, 4]); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(10, 8, 20, 26, [8, 8, 3, 3]); g.fill();
    g.fillStyle = '#1b0f2e'; g.fillRect(15, 17, 3, 4); g.fillRect(23, 17, 3, 4); g.fillRect(16, 26, 9, 2); g.fillRect(15, 25, 2, 1); g.fillRect(24, 25, 2, 1);
    g.strokeStyle = '#2ce8f5'; g.lineWidth = 2; g.beginPath(); g.arc(20, 18, 14, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.fillStyle = '#2ce8f5'; g.fillRect(4, 16, 4, 7); g.fillRect(32, 16, 4, 7); g.fillRect(6, 23, 2, 6); g.fillRect(6, 29, 6, 2);
  } else if (who === 'hal') {
    [[12, 22, 9], [28, 22, 9], [16, 14, 10], [24, 14, 10], [20, 26, 11]].forEach(([x, y, r]) => { g.fillStyle = '#45283c'; g.beginPath(); g.arc(x, y, r + 1.5, 0, 7); g.fill(); });
    [[12, 22, 9], [28, 22, 9], [16, 14, 10], [24, 14, 10], [20, 26, 11]].forEach(([x, y, r]) => { g.fillStyle = '#7bd132'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    g.fillStyle = '#ffcc00'; g.fillRect(11, 15, 6, 6); g.fillRect(23, 15, 6, 6);
    g.fillStyle = '#ff2e63'; g.fillRect(13, 17, 3, 3); g.fillRect(24, 17, 3, 3);
    g.fillStyle = '#1b0f2e'; g.fillRect(10, 13, 8, 2); g.fillRect(22, 13, 8, 2); g.fillRect(13, 25, 14, 5);
    g.fillStyle = '#e8d36a'; g.fillRect(14, 25, 2, 2); g.fillRect(18, 25, 2, 2); g.fillRect(22, 25, 2, 2);
  } else if (who === 'gi') {
    [[8, 20], [32, 20], [20, 8], [20, 33], [10, 10], [30, 10], [10, 30], [30, 30]].forEach(([x, y]) => { g.strokeStyle = '#c58bff'; g.lineWidth = 1; g.beginPath(); g.moveTo(20, 21); g.lineTo(x, y); g.stroke(); });
    g.fillStyle = '#2a0a4a'; g.beginPath(); g.ellipse(20, 21, 15, 11, 0, 0, 7); g.fill();
    g.fillStyle = '#5a1a9a'; g.beginPath(); g.ellipse(20, 21, 13, 9.5, 0, 0, 7); g.fill();
    g.fillStyle = '#1b0f2e'; g.fillRect(6, 15, 28, 3);
    g.fillStyle = '#ffcc00'; g.beginPath(); g.arc(14, 17, 5, 0, 7); g.arc(27, 17, 4, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(14, 17, 3.4, 0, 7); g.arc(27, 17, 2.6, 0, 7); g.fill();
    g.fillStyle = '#1b0f2e'; g.fillRect(14, 17, 2, 2); g.fillRect(27, 17, 1, 2); g.fillRect(14, 25, 12, 3);
    g.fillStyle = '#fff'; g.fillRect(15, 25, 2, 1); g.fillRect(19, 25, 2, 1); g.fillRect(23, 25, 2, 1);
  } else if (who === 'rr') {
    g.fillStyle = '#3a0f33'; g.beginPath(); g.arc(20, 22, 15, 0, 7); g.fill();
    g.fillStyle = '#7a2e6a'; g.beginPath(); g.arc(20, 22, 13, 0, 7); g.fill();
    g.fillStyle = '#ffcc00'; g.fillRect(11, 16, 7, 5); g.fillRect(22, 16, 7, 5);
    g.fillStyle = '#ff2e63'; g.fillRect(13, 17, 3, 3); g.fillRect(24, 17, 3, 3);
    g.fillStyle = '#1b0f2e'; g.fillRect(10, 13, 8, 2); g.fillRect(22, 13, 8, 2); g.fillRect(13, 26, 14, 5);
    g.fillStyle = '#fff'; g.fillRect(14, 26, 2, 2); g.fillRect(19, 26, 2, 2); g.fillRect(24, 26, 2, 2);
  }
}

/* ---------- screens ---------- */
function showOverlay(id) {
  ['titleScreen', 'helpScreen', 'pauseScreen', 'clearScreen', 'endScreen'].forEach(o => $(o).classList.toggle('on', o === id));
  const first = id && $(id).querySelector('button');
  if (first && !document.body.classList.contains('touch')) setTimeout(() => first.focus({ preventScroll: true }), 30);
}
function setBodyState() {
  const b = document.body.classList;
  b.toggle('playing', G.state === 'play');
  b.toggle('hud-on', ['play', 'dialog', 'pause', 'clear', 'dying'].includes(G.state));
}
function goTitle() {
  G.state = 'title'; G.player = null; G.boss = null; G.lock = null; G.arenaWall = null;
  G.L = buildLevel(LEVEL_DEFS[0]); G.world = makeWorld(G.L);
  G.spots = G.L.spots.map(s => new Spot(s)); G.enemies = G.L.enemies.map(makeEnemy);
  G.gems = G.L.gems.map(g => ({ x: g.x, y: g.y, taken: false })); G.mints = []; G.nerves = []; G.signs = []; G.parts = []; G.pops = []; G.bolts = []; G.foes = [];
  G.nodes = []; G.bubbles = []; G.drops = []; G.special = null; G.wind = 0; G.fight = false; G.ulcers = []; G.coats = [];
  G.cam.y = G.L.poolY + 28 - VH;
  $('dialog').classList.remove('on'); $('bossBar').classList.remove('on');
  showOverlay('titleScreen'); setBodyState(); AudioSys.music(null);
}
function updateTitle() {
  if (!G.world) return;
  updateTerrain();
  for (const e of G.enemies) e.update();
  for (const s of G.spots) { s.t++; if (s.t % 16 === 0) spawnP(s.x + rand(-5, 5), s.y - 3, { vx: 0, vy: -0.35, color: '#b6ff3b', life: 46, size: 1, g: -0.003, shape: 'stink' }); }
  updateParticles();
  const span = Math.max(0, G.L.width - VW - 60);
  G.cam.x = (0.5 - 0.5 * Math.cos(G.t * 0.0016)) * span;
  G.cam.y = G.L.poolY + 28 - VH;
}
function startGame(skip) {
  AudioSys.init(); AudioSys.play('select');
  G.score = 0; G.stats = freshStats(); G.bossDone = false; G.arenaWall = null;
  showOverlay(null);
  G.tutorial = !skip;
  loadLevel(skip ? 1 : 0);
  G.state = 'play'; setBodyState();
  dialog(skip ? LINES.skip.concat(LINES.root) : LINES.intro, null);
}
function retryLevel() {
  AudioSys.play('select');
  G.score = G.snap.score; G.stats = Object.assign({}, G.snap.stats); G.bossDone = false; G.arenaWall = null;
  showOverlay(null); loadLevel(G.levelIdx); G.state = 'play'; setBodyState();
}
function togglePause() {
  if (G.state === 'play') { G.state = 'pause'; releaseAll(); showOverlay('pauseScreen'); AudioSys.duck(true); }
  else if (G.state === 'pause') { G.state = 'play'; showOverlay(null); AudioSys.duck(false); }
  setBodyState();
}
function levelClear() {
  if (G.state !== 'play') return;
  G.state = 'clear'; releaseAll(); setBodyState();
  const fresh = Math.round((100 - G.rot) * 10), flawless = G.noHit ? 500 : 0;
  const gemsGot = G.gems.filter(g => g.taken).length;
  G.score += fresh + flawless;
  $('clearName').textContent = G.L.name;
  $('clearStats').innerHTML = statRows([
    ['Spots cleaned', G.spots.filter(s => s.done).length + ' / ' + G.spots.length],
    ['Fluoride drops', gemsGot + ' / ' + G.gems.length],
    ['Freshness bonus', '+' + fresh],
    ['No-hit bonus', flawless ? '+500' : '-']
  ]);
  $('clearScore').textContent = G.score.toLocaleString();
  showOverlay('clearScreen');
  AudioSys.music(null); AudioSys.play('clear');
}
function continueAfterClear() {
  if (G.state !== 'clear') return;
  AudioSys.play('select'); showOverlay(null);
  G.state = 'transition';
  const next = G.levelIdx + 1;
  G.fade = 0.01; G.fadeTo = () => {
    loadLevel(next); G.state = 'play'; setBodyState();
    const intro = LEVEL_INTRO[LEVEL_DEFS[next].id];
    if (intro) dialog(LINES[intro], null);
  };
}
function lockArena() {
  const A = G.L.arena;
  G.lock = { x1: A.x1 - 12, x2: A.lockR || A.x2 };
  G.arenaWall = { kind: 'wall', solid: true, x: A.x1 - 12, y: G.L.top - 300, w: 12, h: 190 * WS - (G.L.top - 300), rise: 0 };
  G.world.solids.push(G.arenaWall);
}
function startBoss() {
  const A = G.L.arena;
  lockArena();
  AudioSys.music(null); AudioSys.play('roar'); shake(6);
  G.boss = new Hal(clamp(G.player.x + VW * 0.3, A.x1 + 16, A.x2 - 76));
  G.boss.state = 'intro';
  G.coats = [A.x1 + 70, (A.x1 + A.x2) / 2, A.x2 - 70].map(x => new Coat(x));
  dialog(LINES.hal, () => {
    G.boss.go('enter'); G.fight = true;
    showBossBar(G.boss.name, false);
    G.bossBar = 0; G.bossFillT = 0;
    AudioSys.music('boss');
  });
}
function showBossBar(name, rr) {
  $('bossName').textContent = name;
  $('bossFill').classList.toggle('rr', rr);
  $('bossFill').style.width = '0%';
  $('bossBar').classList.add('on');
  G.bossFillT = 0;
}
function halOutro() {
  G.bossDone = true; $('bossBar').classList.remove('on');
  dialog(LINES.outro, () => { showEnd(true); });
}
const statRows = rows => rows.map(([k, v]) => '<div class="row"><span>' + k + '</span><b>' + v + '</b></div>').join('');
const fmtTime = f => { const s = Math.floor(f / 60); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function showEnd(won) {
  G.state = won ? 'won' : 'over'; releaseAll(); setBodyState();
  $('dialog').classList.remove('on'); $('bossBar').classList.remove('on');
  const r = result(won);
  $('endTitle').textContent = won ? 'Mouth Saved!' : 'Game Over';
  $('endTitle').style.color = won ? 'var(--green)' : 'var(--red)';
  $('endSub').textContent = won ? 'Hal-9001 has been freshened. The smile is safe!'
    : G.deathReason === 'rot' ? 'The rot took over. Try cleaning faster next time!' : 'PeeDee got plaque-attacked.';
  $('endScore').textContent = r.score.toLocaleString();
  $('endStats').innerHTML = statRows([
    ['Reached', r.area], ['Spots cleaned', r.cleaned], ['Germs zapped', r.germs], ['Time', r.time]
  ]);
  $('btnRetry').textContent = won ? 'Replay Level' : 'Retry Level';      // same buttons, win or lose
  setupShare(r);
  showOverlay('endScreen');
  if (won) AudioSys.play('win');
}
/* The little PeeDee on the end screen: punching the air if the mouth was saved, flat on his back if not. */
function drawEndSprite(won, t, g, s) {
  g = g || $('endPd').getContext('2d'); s = s || 1;
  if (s === 1) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 44, 36); }
  g.imageSmoothingEnabled = false;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(won ? 12 * s : 6 * s, 34 * s, (won ? 18 : 30) * s, 2 * s);       // shadow
  g.save();
  if (won) {
    const hop = Math.floor(t / 16) % 2 ? -1 : 0, bob = Math.floor(t / 8) % 2 ? -1 : 0;
    g.translate(13 * s, (14 + hop) * s); g.scale(s, s);
    drawPeeDee(g, 'stand', 'cheer', t, false, { bob });
  } else {
    g.translate(8 * s, 34 * s); g.rotate(-Math.PI / 2); g.scale(s, s);
    drawPeeDee(g, 'stand', 'down', t, true);
  }
  g.restore();
  if (!won) { g.save(); g.scale(s, s); syringeH(g, 28, 33, 0); g.restore(); }   // dropped where he fell
}
function result(won) {
  return {
    won, score: G.score, cleaned: G.stats.cleaned, germs: G.stats.germs, gems: G.stats.gems,
    area: won ? "Hal's Lair" : titleCase(LEVEL_DEFS[G.levelIdx].name), time: fmtTime(G.stats.frames)
  };
}
const titleCase = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\bOf The\b/, 'of the');
