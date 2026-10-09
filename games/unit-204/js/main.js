'use strict';
/* ============================== STARTUP & MAIN LOOP ============================== */
const scene = $('scene'), sg = scene.getContext('2d');
sg.imageSmoothingEnabled = false;

/* The title screen: the hallway outside Unit 204, sconces glowing. */
const HALL = { box: { x0: -3.2, x1: 3.2, h: 4, zb: 17 } };
let _hall = null;
function drawTitle(t) {
  const c = $('titleArt'), g = c.getContext('2d');
  if (!_hall) {
    _hall = document.createElement('canvas'); _hall.width = SW; _hall.height = SH;
    const h = _hall.getContext('2d'), r = HALL.box;
    fillPoly(h, [P(r.x0, r.h, 1.5), P(r.x1, r.h, 1.5), P(r.x1, r.h, r.zb), P(r.x0, r.h, r.zb)], '#d9d0bc');
    fillPoly(h, [P(r.x0, 0, 1.5), P(r.x0, 0, r.zb), P(r.x0, r.h, r.zb), P(r.x0, r.h, 1.5)], '#b9a47e');
    fillPoly(h, [P(r.x1, 0, 1.5), P(r.x1, 0, r.zb), P(r.x1, r.h, r.zb), P(r.x1, r.h, 1.5)], '#bea982');
    fillPoly(h, Q.back(r, r.x0, r.x1, 0, r.h), '#c9b48c');
    // carpet runner with a diamond pattern
    fillPoly(h, [P(r.x0, 0, 1.5), P(r.x1, 0, 1.5), P(r.x1, 0, r.zb), P(r.x0, 0, r.zb)], '#6e2430');
    for (let z = 2; z < r.zb; z += 1) for (let x = -2.5; x < 2.6; x += 1.25) fillPoly(h, [P(x, 0, z), P(x + .3, 0, z + .5), P(x, 0, z + 1), P(x - .3, 0, z + .5)], '#8a3a3a');
    fillPoly(h, [P(r.x0, 0, 1.5), P(r.x0 + .35, 0, 1.5), P(r.x0 + .35, 0, r.zb), P(r.x0, 0, r.zb)], '#c9a24a'); fillPoly(h, [P(r.x1 - .35, 0, 1.5), P(r.x1, 0, 1.5), P(r.x1, 0, r.zb), P(r.x1 - .35, 0, r.zb)], '#c9a24a');
    // chair rail + doors along the hall
    for (const side of ['left', 'right']) {
      const q = side === 'left' ? Q.left : Q.right;
      fillPoly(h, q(r, 1.5, r.zb, 1.05, 1.12), '#f2ead6');
      fillPoly(h, q(r, 1.5, r.zb, 0, .28), '#ece4d0');
      for (const [za, num] of side === 'left' ? [[5.5, 'L'], [11, 'L']] : [[8, 'R'], [13.4, 'R']]) {
        fillPoly(h, q(r, za - .1, za + 1.6, 0, 2.95), '#f6f3ea'); fillPoly(h, q(r, za, za + 1.5, 0, 2.85), '#7a4a2a'); fillPoly(h, q(r, za + .1, za + 1.4, .2, 2.7), '#8a5a34');
        fillPoly(h, q(r, za + .55, za + .95, 2.3, 2.55), '#c9a227');
      }
    }
    // Unit 204's door at the end
    fillPoly(h, Q.back(r, -.95, .95, 0, 3.05), '#f6f3ea'); fillPoly(h, Q.back(r, -.8, .8, 0, 2.9), '#7a4a2a');
    for (const [ya, yb] of [[.2, 1.3], [1.5, 2.7]]) for (const xa of [-.65, .1]) fillPoly(h, Q.back(r, xa, xa + .55, ya, yb), '#8a5a34');
    fillPoly(h, Q.back(r, -.3, .3, 2.15, 2.5), '#c9a227');
    const k = P(.6, 1.25, r.zb); pxRect(h, k[0], k[1], 2, 2, '#f2d870');
    // sconces
    for (const [x, z] of [[r.x0, 4], [r.x0, 9.5], [r.x1, 6.6], [r.x1, 12], [r.x0, 14.5]]) { const p = P(x, 2.2, z); pxRect(h, p[0] - 2, p[1] - 3, 4, 6, '#f8e0a0'); }
    _hall.lights = [[r.x0, 4], [r.x0, 9.5], [r.x1, 6.6], [r.x1, 12], [r.x0, 14.5]];
  }
  g.imageSmoothingEnabled = false;
  g.drawImage(_hall, 0, 0);
  for (const [x, z] of _hall.lights) { const p = P(x, 2.2, z), fl = Settings.get('motion') ? (Math.sin(t * 9 + z) > .96 ? 2 : 4) : 4; const rad = 300 / z * 1.4, gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad); gr.addColorStop(0, rgba('#ffe7a8', fl / 10)); gr.addColorStop(1, rgba('#ffe7a8', 0)); g.fillStyle = gr; g.fillRect(p[0] - rad, p[1] - rad, rad * 2, rad * 2); }
  // you and Dana, waiting at the door with a clipboard and a BlackBerry
  const you = Sprites.get('you', { pose: 'clip', blink: t % 4 < .12, led: Math.floor(t * 1.2) % 2 === 0 }), dana = Sprites.get('dana', { pose: 'phone', blink: (t + 1.7) % 4.4 < .12, led: true });
  const py = P(-2.1, 0, 6.2), dy = P(2.1, 0, 6.6);
  g.fillStyle = ditherPx('#1a1222', 9); g.beginPath(); g.ellipse(py[0], py[1] - 1, 14, 4, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(dy[0], dy[1] - 1, 13, 4, 0, 0, 7); g.fill();
  g.drawImage(you, Math.round(py[0] - 19), Math.round(py[1] - 88), 38, 89);
  g.save(); g.translate(Math.round(dy[0]), 0); g.scale(-1, 1); g.drawImage(dana, -18, Math.round(dy[1] - 84), 36, 84); g.restore();
  g.fillStyle = 'rgba(14,10,24,0.38)'; g.fillRect(0, 0, SW, SH);
  g.drawImage(vignette(), 0, 0);
}

/* ---------- boot ---------- */
Settings.load();
Audio2.init();
Icons.build();
Settings.apply();
UI.bindTips();
UI.buildTools();
Game.setTool('look');
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');

const unlock = () => { Audio2.unlock(); };
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

$('btnStart').addEventListener('click', () => { Audio2.sfx('click'); UI.close('titleScreen'); UI.open('introScreen'); Briefing.show(0); });
$('btnSkipIntro').addEventListener('click', () => { Audio2.sfx('click'); Game.beginShift(); });
$('btnTitleSettings').addEventListener('click', () => { Settings.build(); UI.open('settingsScreen'); });
$('btnCredits').addEventListener('click', () => UI.open('creditsScreen'));
$('introNext').addEventListener('click', () => Briefing.next());
$('introBack').addEventListener('click', () => Briefing.back());
$('introSkip').addEventListener('click', () => Game.beginShift());
$('inspectClose').addEventListener('click', () => UI.close('inspectScreen'));
$('inspectMark').addEventListener('click', () => Mark.open(Inspect.fid));
$('inspectPhoto').addEventListener('click', () => Camera.open(Inspect.fid));
$('markCancel').addEventListener('click', () => UI.close('markScreen'));
$('markFile').addEventListener('click', () => Mark.file());
$('markTakePhoto').addEventListener('click', () => Camera.open(Mark.fid));
for (const id of ['camShutter', 'camTake']) $(id).addEventListener('click', () => Camera.snap());
document.querySelector('.cam-lcd').addEventListener('click', () => Camera.snap());
$('camCancel').addEventListener('click', () => { UI.close('cameraScreen'); Camera.fid = null; });
$('setReset').addEventListener('click', () => Settings.reset());
$('setFullscreen').addEventListener('click', toggleFullscreen);
$('menuSop').addEventListener('click', () => { UI.close('menuScreen'); UI.open('sopScreen'); });
$('menuSettings').addEventListener('click', () => { UI.close('menuScreen'); Settings.build(); UI.open('settingsScreen'); });
$('menuSubmit').addEventListener('click', () => Report.confirmSubmit());
$('menuQuit').addEventListener('click', () => UI.confirm('Quit to the title screen? This shift\'s findings will be lost.', 'Quit', toTitle, 'Stay'));
$('btnAgain').addEventListener('click', () => { UI.closeAll(); Game.beginShift(); });
$('btnEndTitle').addEventListener('click', toTitle);
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => UI.close(b.closest('.overlay').id)));
document.querySelectorAll('.overlay.dim').forEach(o => o.addEventListener('mousedown', e => { if (e.target === o && !['endScreen', 'introScreen', 'confirmScreen'].includes(o.id)) UI.close(o.id); }));

function toTitle() {
  UI.closeAll(); Game.mode = 'title'; $('game').classList.remove('playing');
  Audio2.music(false); Audio2.ambience(false); Audio2.walking(false); UI.hush(); UI.verb('');
  UI.open('titleScreen');
}
function toggleFullscreen() {
  const el = $('game');
  try { if (document.fullscreenElement) document.exitFullscreen(); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { /* not allowed in this frame */ }
}

/* ---------- input ---------- */
scene.addEventListener('mousemove', e => { Game.mouse = Game.sceneXY(e); Game.updateHover(); });
scene.addEventListener('mouseleave', () => { Game.mouse = null; Game.updateHover(); });
scene.addEventListener('mousedown', e => { if (e.button === 0) { const [x, y] = Game.sceneXY(e); Game.mouse = [x, y]; Game.click(x, y); Game.updateHover(); } });
const zc = $('zoomCanvas');
zc.addEventListener('mousemove', e => Inspect.move(e));
zc.addEventListener('mouseleave', () => Inspect.leave());
zc.addEventListener('mousedown', e => Inspect.click(e));
// right-click cycles the cursor, anywhere in the game
$('game').addEventListener('contextmenu', e => {
  e.preventDefault();
  if (Game.mode !== 'play') return;
  const top = UI.top();
  if (!top || top === 'inspectScreen') { Game.cycleTool(1); if (top === 'inspectScreen') Inspect.move(e); else { Game.mouse = Game.sceneXY(e); Game.updateHover(); } }
});
scene.addEventListener('wheel', e => { if (Game.mode === 'play' && !UI.top() && Math.abs(e.deltaY) > 20) Game.cycleTool(e.deltaY > 0 ? 1 : -1); }, { passive: true });
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input')) return;
  if (e.key === 'Escape') {
    if (UI.top() && !['titleScreen', 'endScreen'].includes(UI.top())) { UI.close(); e.preventDefault(); }
    else if (Game.mode === 'play' && !UI.top()) UI.open('menuScreen');
    return;
  }
  if (Game.mode !== 'play') return;
  const top = UI.top(); if (top && top !== 'inspectScreen') return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= VERBS.length) { if (!(top === 'inspectScreen' && n === 1)) Game.setTool(VERBS[n - 1].id); }
  else if (e.key === 'c' || e.key === 'C') Game.cycleTool(1);
  else if (e.key === 'i' || e.key === 'I') $('game').classList.toggle('tb-open');
});
document.addEventListener('visibilitychange', () => { if (document.hidden) Audio2.walking(false); });

/* ---------- main loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  Game.update(dt);
  if (Game.mode === 'title' && UI.isOpen('titleScreen')) drawTitle(Game.t);
  else if (Game.mode === 'play') Game.render(sg);
  if (UI.isOpen('inspectScreen')) Inspect.render(Game.t);
  if (UI.isOpen('cameraScreen')) Camera.render(Game.t);
  Audio2.tick();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (/[?&]play\b/.test(location.search)) Game.beginShift();   // dev shortcut: skip the title and briefing
