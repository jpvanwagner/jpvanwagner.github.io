// Restaurant Rush — boot, the main loop, input, and the HUD.
// Fonts are bundled (latin subsets) so the built file works offline and embedded anywhere.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/playfair-display/latin-600-italic.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-800-italic.css';
import { RESTAURANT } from './config.js';
import { G, bus, career, newShift, loadCareer, fmtClock, money, tableById } from './state.js';
import { startService, simulateDay, crewRunning, inRush, service, QUIET_SPEED, resetForNextService, serviceSummary } from './sim/day.js';
import { initRenderer, render, updateCamera, pick, toScreen, isTransitioning, camera, renderer, scene } from './render/scene.js';
import { buildWorld, buildTables } from './render/world.js';
import { initPeople, syncPeople, clearPeople } from './render/people.js';
import { initProps, resetProps, updateProps } from './render/props.js';
import { buildGrid } from './sim/pathfind.js';
import { spawnStaff } from './sim/staff.js';
import { $, h, initToasts, modalOpen, closeModal } from './ui/dom.js';
import { go, updateStation, preloadStations } from './ui/views.js';
import { renderFloorPanels, updateOverlay, clickTable, selectParty, clearOverlay } from './ui/floor.js';
import { initSfx, muted, setMuted } from './ui/sfx.js';
import { initOffice, endOfShift, showTitle, showHelp, starsText, showServiceBreak } from './stations/office.js';

const SPEEDS = [0.5, 1, 2, 3];

// ── Boot ────────────────────────────────────────────────────────────────────
// Each step is recorded so the startup safety net (dev.html) can say where boot stopped.
const step = (name) => { window.__rrStep = name; };
step('boot: load save');
loadCareer();
step('boot: start 3D renderer (WebGL)');
initRenderer($('#canvas-host'));
step('boot: build the restaurant');
buildWorld();
step('boot: people, props, toasts, sound');
initPeople();
initProps();
initToasts();
initSfx();
$('#hud-place').textContent = 'Restaurant Rush';
step('boot: set the tables');
newShift();             // an idle dining room behind the title screen
G.running = false;
buildTables(G.tables);
resetProps();
spawnStaff();
step('boot: title screen');
initOffice({ startShift, setPaused });
showTitle();
step('boot: running');

function startShift() {
  clearPeople();
  clearOverlay();
  newShift();
  buildGrid(G.tables);
  buildTables(G.tables);
  resetProps();
  spawnStaff();
  go('floor');
  G.speed = 1;
  updateSpeedBtn();
  startService(0);
  bus.emit('toast', { kind: 'good', text: `Doors open for lunch. Buon appetito! (Day ${career.day})` });
  setTimeout(preloadStations, 1500);
}

export function setPaused(p) {
  G.paused = p;
  $('#pause-veil').hidden = !p || modalOpen();
  $('#btn-pause').textContent = p ? '▶' : '❚❚';
}

// ── The day: lunch, the afternoon, dinner (src/sim/day.js) ─────────────────
function simulate(dt) {
  // In the quiet hours the clock runs faster; take it in small steps so nothing jumps.
  const total = dt * (crewRunning() ? QUIET_SPEED : 1);
  const steps = Math.ceil(total / 0.2);
  for (let i = 0; i < steps; i++) {
    const ev = simulateDay(total / steps);
    if (ev === 'service-over') return afterLunch();
    if (ev === 'day-over') return endOfDay();
  }
}

function afterLunch() {
  G.running = false;
  go('floor');
  setTimeout(() => showServiceBreak(serviceSummary(), () => {
    resetForNextService();
    startService(1);
    G.running = true;
    bus.emit('toast', { kind: 'good', text: 'Dinner service: the doors are open. The crew has it until the rush.' });
  }), 600);
}

function endOfDay() {
  G.ended = true;
  G.running = false;
  go('floor');
  setTimeout(endOfShift, 600);
}

// ── Main loop ───────────────────────────────────────────────────────────────
let last = performance.now();
let panelAcc = 0, hudAcc = 0;
function frame(now) {
  window.__rrFrames = (window.__rrFrames || 0) + 1;   // read by the startup report
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.running && !G.paused && !modalOpen()) simulate(realDt * G.speed);
  updateCamera(realDt);
  syncPeople(G.running && !G.paused && !modalOpen() ? realDt * G.speed : 0);
  updateProps(realDt, now / 1000);
  updateOverlay();
  updateStation(realDt);
  panelAcc += realDt;
  hudAcc += realDt;
  if (panelAcc > 0.25) { panelAcc = 0; renderFloorPanels(); }
  if (hudAcc > 0.2) { hudAcc = 0; updateHud(); }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// The pill beside the clock: which service, and who's running it. Click to take over from the
// crew in the quiet hours (or hand back to them).
function updatePhase() {
  const el = $('#hud-phase');
  if (!G.running) { el.hidden = true; return; }
  el.hidden = false;
  const s = service();
  const rush = inRush();
  el.className = `phase-pill ${rush ? 'rush' : crewRunning() ? 'crew' : 'you'}`;
  el.disabled = rush;
  el.textContent = rush ? `${s.name} rush` : crewRunning() ? `${s.name} · crew's on · Take over` : `${s.name} · you're on · Hand back`;
  el.title = rush ? "The rush: you're running the room." : crewRunning()
    ? 'Quiet hours: the crew runs the room and the clock runs faster. Click to take over.'
    : 'Quiet hours, and you have the room. Click to hand it back to the crew.';
}
$('#hud-phase').addEventListener('click', () => { if (G.running && !inRush()) { G.takeOver = !G.takeOver; updatePhase(); } });
bus.on('phase', ({ phase: ph, service: s }) => {
  if (ph === 'rush') bus.emit('toast', { kind: 'bad', text: `The ${s.name.toLowerCase()} rush is on. You're up!` });
  else if (ph === 'after') bus.emit('toast', { kind: 'good', text: `The ${s.name.toLowerCase()} rush is easing off. The crew has it from here (take over any time).` });
});

function updateHud() {
  updatePhase();
  const s = G.stats;
  $('#hud-day').textContent = `Day ${career.day}`;
  $('#hud-clock').textContent = fmtClock(G.clock);
  $('#hud-take').textContent = money(s.revenue + s.tips - s.comps);
  const r = s.ratings.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : 0;
  $('#hud-rating').textContent = r ? `${r.toFixed(1)} ${starsText(r).slice(0, 5)}` : '–';
  $('#hud-rating').title = `${s.ratings.length} parties rated`;
  $('#hud-served').textContent = s.served;
}

bus.on('money', ({ amount, tableId }) => {
  if (G.view !== 'floor') return;
  const t = tableById(tableId);
  const pos = t && toScreen(t.x, 1.6, t.z);
  if (!pos) return;
  const el = h('div.money-pop', { style: { left: `${pos.x}px`, top: `${pos.y}px` } }, `+${money(amount)}`);
  $('#stage').append(el);
  setTimeout(() => el.remove(), 1700);
});

// ── Input ───────────────────────────────────────────────────────────────────
const canvasHost = $('#canvas-host');
let downAt = null;
canvasHost.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
canvasHost.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
  downAt = null;
  if (!G.running || G.view !== 'floor' || isTransitioning()) return;
  const hit = pick(e.clientX, e.clientY);
  if (!hit) { if (G.selectedPartyId) { G.selectedPartyId = null; renderFloorPanels(); } return; }
  if (hit.type === 'table') clickTable(hit.id);
  else if (hit.type === 'party') {
    const p = G.parties.find((x) => x.id === hit.id);
    if (p && (p.state === 'queue' || p.state === 'arriving')) selectParty(p.id);
    else if (p?.tableId) clickTable(p.tableId);
  } else if (hit.type === 'zone') go(hit.id);
});

document.querySelectorAll('.view-btn').forEach((b) => b.addEventListener('click', () => G.running && go(b.dataset.view)));
$('#btn-pause').addEventListener('click', () => G.running && setPaused(!G.paused));
$('#btn-speed').addEventListener('click', () => cycleSpeed(1, true));
$('#btn-help').addEventListener('click', () => showHelp());
$('#btn-sound').addEventListener('click', toggleSound);
$('#btn-full').addEventListener('click', toggleFullscreen);

// ── Sound and full screen ───────────────────────────────────────────────────
function showSound() {
  const b = $('#btn-sound');
  b.classList.toggle('muted', muted);
  b.setAttribute('aria-pressed', String(!muted));
  b.title = muted ? 'Sound is off: turn it on (M)' : 'Sound is on: turn it off (M)';
}
function toggleSound() { setMuted(!muted); showSound(); }
showSound();

// Full screen works inside an iframe only if the page allows it; otherwise open the game in
// its own tab instead.
function toggleFullscreen() {
  if (!document.fullscreenEnabled) { window.open(location.href, '_blank', 'noopener'); return; }
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => window.open(location.href, '_blank', 'noopener'));
}
document.addEventListener('fullscreenchange', () => {
  $('#btn-full').classList.toggle('on', !!document.fullscreenElement);
  $('#btn-full').title = document.fullscreenElement ? 'Leave full screen (F)' : 'Full screen (F)';
});

function cycleSpeed(dir, wrap = false) {
  const i = SPEEDS.indexOf(G.speed);
  const j = wrap ? (i + dir + SPEEDS.length) % SPEEDS.length : Math.max(0, Math.min(SPEEDS.length - 1, i + dir));
  G.speed = SPEEDS[j];
  updateSpeedBtn();
}
function updateSpeedBtn() { $('#btn-speed').textContent = `${G.speed === 0.5 ? '½' : G.speed}×`; }

window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  if (e.key === 'Escape') {
    if (modalOpen()) { if (G.running) closeModal(); return; }
    if (G.view !== 'floor') go('floor');
    else if (G.selectedPartyId) { G.selectedPartyId = null; renderFloorPanels(); }
    return;
  }
  if (modalOpen() || !G.running) return;
  const views = { 1: 'floor', 2: 'bar', 3: 'kitchen', 4: 'office' };
  if (views[e.key]) go(views[e.key]);
  else if (e.key === ' ') { e.preventDefault(); setPaused(!G.paused); }
  else if (e.key === ',') cycleSpeed(-1);
  else if (e.key === '.') cycleSpeed(1);
  else if (e.key === 'h' || e.key === 'H') showHelp();
});
// Sound and full screen work any time, even on the title screen or with a dialog open.
window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'm' || e.key === 'M') toggleSound();
  else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
});

// Debug handle for poking at the sim from the console.
window.__rr = { G, career, go, camera, isTransitioning, get renderer() { return renderer; }, scene };
