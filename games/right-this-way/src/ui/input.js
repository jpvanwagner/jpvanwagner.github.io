/*
 * Tracks whether the player is using touch or mouse/keyboard, so the UI can
 * say "Tap" vs "Click" and show or hide keyboard hints. Hybrid devices switch
 * on the fly with whatever was used last.
 */
const root = document.documentElement;

export function initInputMode() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  setMode(coarse ? 'touch' : 'mouse');
  window.addEventListener('pointerdown', (e) => setMode(e.pointerType === 'mouse' ? 'mouse' : 'touch'), { capture: true, passive: true });
  window.addEventListener('keydown', () => setMode('mouse'), { capture: true, passive: true });
}

function setMode(mode) {
  if (root.dataset.input !== mode) root.dataset.input = mode;
}

export const isTouch = () => root.dataset.input === 'touch';

/** Inline "Tap"/"Click" that updates itself when the input mode changes (CSS-driven). */
export function verbSpans(capital = true) {
  const t = capital ? 'Tap' : 'tap';
  const c = capital ? 'Click' : 'click';
  return `<span class="when-touch">${t}</span><span class="when-mouse">${c}</span>`;
}
