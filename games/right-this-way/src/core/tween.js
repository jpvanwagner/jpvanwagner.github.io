/*
 * Tiny tween helper (replaces the prototype's tween.js dependency).
 * tween({ duration, ease, onUpdate(t), onComplete }) returns a handle with cancel().
 * Call updateTweens(dtSeconds) once per frame. Runs on REAL time, so camera
 * moves still animate while the game is paused.
 */

const active = new Set();

export const Ease = {
  linear: (t) => t,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outCubic: (t) => 1 - (1 - t) ** 3,
};

export function tween({ duration, ease = Ease.inOutCubic, onUpdate, onComplete }) {
  const handle = {
    elapsed: 0,
    duration: Math.max(0.0001, duration),
    ease,
    onUpdate,
    onComplete,
    cancel: () => active.delete(handle),
  };
  active.add(handle);
  onUpdate?.(0);
  return handle;
}

export function updateTweens(dt) {
  for (const h of [...active]) {
    h.elapsed += dt;
    const t = Math.min(1, h.elapsed / h.duration);
    h.onUpdate?.(h.ease(t));
    if (t >= 1) {
      active.delete(h);
      h.onComplete?.();
    }
  }
}
