/*
 * Adaptive entry-response pacing - pure functions, unit tested.
 *
 * The desk's entry window starts generous (ENTRY_WINDOW x ENTRY_START_MULT,
 * i.e. twice as long) and tightens toward ENTRY_WINDOW as the facility gets
 * busy: more people in line and a fuller waiting area. When the rush eases,
 * it relaxes again. The window drifts toward its target gradually
 * (ENTRY_PACE_EASE per second) so it never jumps under the player.
 */

/** 0 (quiet) .. 1 (line full and waiting area full). */
export function entryLoad({ lineCount, lineCapacity, waitingCount, waitingCapacity }, settings) {
  const line = lineCapacity ? Math.min(1, lineCount / lineCapacity) : 0;
  const waiting = waitingCapacity ? Math.min(1, waitingCount / waitingCapacity) : 0;
  const { line: wl, waiting: ww } = settings.ENTRY_PACE_WEIGHTS;
  return Math.min(1, (line * wl + waiting * ww) / (wl + ww));
}

/** Entry window (seconds) the desk is heading toward for a given load. */
export function targetEntryWindow(load, settings) {
  const slow = settings.ENTRY_WINDOW * settings.ENTRY_START_MULT;
  const fast = settings.ENTRY_WINDOW;
  return slow + (fast - slow) * Math.max(0, Math.min(1, load));
}

/** Move `current` toward `target` by at most ENTRY_PACE_EASE * dt seconds. */
export function easeEntryWindow(current, target, dt, settings) {
  const step = settings.ENTRY_PACE_EASE * dt;
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}
