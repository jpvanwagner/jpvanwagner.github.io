/* Tiny DOM helpers - the UI is plain DOM, no framework. */

export const $ = (sel, root = document) => root.querySelector(sel);

/**
 * el('button', { class: 'btn', onclick }, ['Label'])
 * Attributes starting with "on" become listeners; `dataset` and `style` objects are merged.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'html') node.innerHTML = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Coloured dot for a person type (matches the sketch legend). */
export const typeDot = (type) => el('span', { class: `dot dot-${type.id.toLowerCase()}` });

/** Sets a timer bar's fill (0..1) and colour state. */
export function setBar(fill, fraction, { paused = false, invert = false } = {}) {
  const f = Math.max(0, Math.min(1, fraction));
  fill.style.width = `${f * 100}%`;
  const danger = invert ? f > 0.8 : f < 0.25;
  const warn = invert ? f > 0.5 : f < 0.5;
  fill.classList.toggle('is-paused', paused);
  fill.classList.toggle('is-danger', !paused && danger);
  fill.classList.toggle('is-warn', !paused && !danger && warn);
}

/**
 * Press handler for in-game buttons.
 *
 * Panels re-render often, and a re-render between mousedown and mouseup would
 * swallow a normal 'click', so:
 *   - mouse: fires on pointerdown (instant, survives re-renders)
 *   - touch / pen: fires on pointerup if the finger didn't move (so scrolling
 *     a list never triggers a button); tracked on window, so it still fires if
 *     the button was re-rendered mid-tap
 *   - keyboard: Enter / Space
 */
const TAP_SLOP = 10; // px a finger may wander and still count as a tap

export function press(fn) {
  return {
    onpointerdown: (e) => {
      if (e.currentTarget.disabled) return;
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        e.preventDefault(); // no focus change from the follow-up mousedown (keeps modal focus intact)
        fn();
        return;
      }
      const { pointerId, clientX, clientY } = e;
      const up = (u) => {
        if (u.pointerId !== pointerId) return;
        cleanup();
        if (u.type === 'pointerup' && Math.hypot(u.clientX - clientX, u.clientY - clientY) <= TAP_SLOP) fn();
      };
      const cleanup = () => {
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    onkeydown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        fn();
      }
    },
  };
}
