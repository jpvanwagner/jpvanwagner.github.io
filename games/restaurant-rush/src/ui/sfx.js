// Tiny synthesized cues (no audio files): a bell for tables that need you, a buzz for the
// kitchen, a register "ching" for payment.
import { bus } from '../state.js';
import { crewRunning } from '../sim/day.js';

let ctx = null;
// Sound on/off is remembered per browser (separately from the save game).
const MUTE_KEY = 'restaurant-rush-muted';
export let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* private mode */ }
}

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.08) {
  const c = ac();
  if (!c || muted) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

let lastKitchen = 0;
export function initSfx() {
  window.addEventListener('pointerdown', () => ac(), { once: true });
  bus.on('alert', ({ kind }) => {
    if (crewRunning()) return;     // in the quiet hours the crew answers the bells
    if (kind === 'order' || kind === 'check') { tone(1318, 0, 0.5, 'sine', 0.06); tone(1760, 0.08, 0.6, 'sine', 0.04); }
    if (kind === 'kitchen') {
      const now = performance.now();
      if (now - lastKitchen > 1500) { lastKitchen = now; tone(180, 0, 0.25, 'square', 0.03); tone(150, 0.18, 0.25, 'square', 0.03); }
    }
  });
  bus.on('money', () => { tone(1568, 0, 0.12, 'triangle', 0.06); tone(2093, 0.09, 0.3, 'triangle', 0.06); });
  bus.on('party:arrive', () => tone(880, 0, 0.18, 'sine', 0.025));
}
