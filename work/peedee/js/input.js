'use strict';
/* ============================== INPUT ============================== */
const keys = { left: false, right: false, down: false, jump: false, shoot: false, med: false, special: false };
const input = { jumpEdge: false, medEdge: false };
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
  KeyX: 'shoot', KeyF: 'shoot', KeyJ: 'shoot', KeyC: 'med', KeyE: 'med', KeyK: 'med', KeyV: 'special', KeyQ: 'special', KeyL: 'special'
};
function press(k, on) {
  if (on && k === 'jump') {
    if (G.state === 'dialog') { advanceDialog(); return; }
    if (G.state === 'clear') { continueAfterClear(); return; }
  }
  if (k === 'jump' && on && !keys.jump) input.jumpEdge = true;
  if (k === 'med' && on && !keys.med) input.medEdge = true;
  if (k === 'special' && on && !keys.special) useSpecial();
  keys[k] = on;
}
function releaseAll() { for (const k in keys) keys[k] = false; document.querySelectorAll('.tb.on').forEach(b => b.classList.remove('on')); }
const inGame = () => ['play', 'dialog', 'dying', 'clear', 'pause'].includes(G.state);

window.addEventListener('keydown', e => {
  AudioSys.init();
  if (document.body.classList.contains('touch') && !e.repeat && KEYMAP[e.code]) setTouchMode(false);
  if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat && (G.state === 'play' || G.state === 'pause')) { togglePause(); e.preventDefault(); } return; }
  if (e.code === 'KeyM' && !e.repeat) { toggleMute(); return; }
  if (e.code === 'Enter' && !e.repeat && (G.state === 'dialog' || G.state === 'clear')) { e.preventDefault(); press('jump', true); keys.jump = false; return; }
  const k = KEYMAP[e.code];
  if (!k) return;
  if (inGame()) e.preventDefault();
  if (!e.repeat) press(k, true);
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { releaseAll(); if (G.state === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseAll(); if (G.state === 'play') togglePause(); } });

/* Touch: a 3-way pad (slide your thumb between arrows) and three action buttons; multi-touch safe. */
function setTouchMode(on) { document.body.classList.toggle('touch', on); layout(); refreshSigns(); }
if (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches)) document.body.classList.add('touch');
window.addEventListener('touchstart', () => { if (!document.body.classList.contains('touch')) setTouchMode(true); }, { passive: true });
(function bindTouch() {
  const pad = $('pad'), parts = { left: $('tLeft'), right: $('tRight'), down: $('tDown') };
  const padPointers = new Map();
  const readPad = () => {
    const r = pad.getBoundingClientRect(), st = { left: false, right: false, down: false };
    for (const p of padPointers.values()) {
      const rx = (p.x - r.left) / r.width, ry = (p.y - r.top) / r.height;
      if (ry > 0.5 && rx > 0.3 && rx < 0.7) st.down = true;
      else if (rx < 0.5) st.left = true; else st.right = true;
      if (ry > 0.62 && (rx <= 0.3 || rx >= 0.7)) st.down = true;    // thumb sliding down-left/right also crouches
    }
    for (const k in st) { if (keys[k] !== st[k]) press(k, st[k]); parts[k].classList.toggle('on', st[k]); }
  };
  const padDown = e => { e.preventDefault(); AudioSys.init(); pad.setPointerCapture(e.pointerId); padPointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); readPad(); };
  const padMove = e => { if (!padPointers.has(e.pointerId)) return; padPointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); readPad(); };
  const padUp = e => { padPointers.delete(e.pointerId); readPad(); };
  pad.addEventListener('pointerdown', padDown); pad.addEventListener('pointermove', padMove);
  pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp); pad.addEventListener('lostpointercapture', padUp);
  document.querySelectorAll('.cluster .tb').forEach(b => {
    const k = b.dataset.key;
    const down = e => { e.preventDefault(); AudioSys.init(); b.setPointerCapture(e.pointerId); b.classList.add('on'); press(k, true); };
    const up = () => { b.classList.remove('on'); keys[k] = false; };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
  document.addEventListener('contextmenu', e => { if (e.target.closest('#touch, #stage')) e.preventDefault(); });
})();
