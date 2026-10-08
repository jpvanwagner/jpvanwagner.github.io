'use strict';
/* ============================== MENUS / BUTTONS ============================== */
function toggleMute() {
  AudioSys.init();
  const m = AudioSys.toggle();
  document.querySelectorAll('.js-sound').forEach(b => { b.textContent = 'Sound: ' + (m ? 'Off' : 'On'); });
  $('hudMute').style.opacity = m ? 0.45 : 1;
}
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const req = el.requestFullscreen || el.webkitRequestFullscreen; if (req) Promise.resolve(req.call(el)).catch(() => {}); }
}
document.querySelectorAll('.js-sound').forEach(b => { b.textContent = 'Sound: ' + (AudioSys.muted ? 'Off' : 'On'); b.addEventListener('click', toggleMute); });
$('hudMute').style.opacity = AudioSys.muted ? 0.45 : 1;
const fsOK = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
document.querySelectorAll('.js-fs').forEach(b => { if (!fsOK) b.style.display = 'none'; b.addEventListener('click', toggleFullscreen); });
let helpFrom = 'titleScreen';
$('btnStart').addEventListener('click', () => startGame(false));
$('btnSkip').addEventListener('click', () => startGame(true));
$('btnHelp').addEventListener('click', () => { helpFrom = 'titleScreen'; showOverlay('helpScreen'); });
$('btnPauseHelp').addEventListener('click', () => { helpFrom = 'pauseScreen'; showOverlay('helpScreen'); });
$('btnHelpBack').addEventListener('click', () => showOverlay(helpFrom));
$('btnResume').addEventListener('click', togglePause);
$('btnRestart').addEventListener('click', () => { G.state = 'play'; showOverlay(null); AudioSys.duck(false); retryLevel(); });
$('btnQuit').addEventListener('click', goTitle);
$('btnContinue').addEventListener('click', continueAfterClear);
$('btnRetry').addEventListener('click', retryLevel);
$('btnAgain').addEventListener('click', () => startGame(false));
$('btnEndTitle').addEventListener('click', goTitle);
$('hudPause').addEventListener('click', () => { if (G.state === 'play' || G.state === 'pause') togglePause(); });
$('hudMute').addEventListener('click', toggleMute);

/* ============================== MAIN LOOP (fixed 60 Hz steps, any refresh rate) ============================== */
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  const STEP = 1000 / 60;
  while (acc >= STEP) { update(); acc -= STEP; }
  render();
  if (G.state === 'won' || G.state === 'over') drawEndSprite(G.state === 'won', G.t);
  requestAnimationFrame(frame);
}
G.stats = freshStats();
goTitle();
// dev shortcut: ?level=1..4 starts straight on that level
const qLevel = parseInt(new URLSearchParams(location.search).get('level'), 10);
if (qLevel >= 1 && qLevel <= LEVEL_DEFS.length) { showOverlay(null); G.score = 0; G.stats = freshStats(); loadLevel(qLevel - 1); G.state = 'play'; setBodyState(); }
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { signCache.size = null; refreshSigns(); });
requestAnimationFrame(frame);
window.__pdd = { G, LEVEL_DEFS, loadLevel, keys, input, startBoss, showEnd, cleanSpot };
