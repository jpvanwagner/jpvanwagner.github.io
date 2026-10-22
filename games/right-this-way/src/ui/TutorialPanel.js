/*
 * The tutorial's instruction card, pinned to the top-left of the map: which
 * step you're on, what to do, and buttons to move on (Next / Skip step) or to
 * leave for the real game at any time. Highlights the panel the step is about
 * (and switches dock tabs on small screens), and points a bouncing arrow at
 * the exact thing to press next (the step's `point` selectors, first one on
 * screen wins; re-checked every frame, since buttons re-render and map tags move).
 */
import { $, el, press } from './dom.js';
import { verbSpans } from './input.js';

const ARROW =
  '<svg viewBox="0 0 36 44" width="36" height="44"><path d="M18 42 3 24h9V2h12v22h9z" fill="#2f73b8" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>';

/** Rendered (not hidden, has a size). */
function shown(node) {
  if (node.closest('[hidden]')) return false;
  const r = node.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * Can it actually be clicked? Inside the window, and its centre isn't hidden by
 * a panel's scroll clipping (the tutorial card and arrow don't count: the card
 * moves out of the way).
 */
function reachable(node) {
  const r = node.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
  const hit = document.elementFromPoint(x, y);
  return !hit || node.contains(hit) || !!hit.closest('.tutorial, .tut-pointer');
}

/**
 * Pointable: shown, and reachable. Panel and pop-up contents scrolled out of
 * view are scrolled into view first; map tags only need to be on screen.
 */
function pointable(node) {
  if (!shown(node)) return false;
  if (!node.closest('#dock, .modal')) {
    const r = node.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
  }
  if (!reachable(node)) node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
}

const fill = (text) => text.replaceAll('{verb}', verbSpans(true)).replaceAll('{verb-lc}', verbSpans(false));

export class TutorialPanel {
  constructor(app) {
    this.app = app;
    this.root = el('aside', { class: 'tutorial', hidden: true, 'aria-live': 'polite' });
    $('#stage').append(this.root);
    this.focused = [];
    this.pointer = el('div', { class: 'tut-pointer', hidden: true, 'aria-hidden': 'true', html: ARROW });
    document.body.append(this.pointer);
    this.target = null;
    this.tab = null;
    app.bus.on('tutorial', () => this.render());
    const loop = () => {
      this.#point();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  #focus(selector, tab) {
    this.focused.forEach((n) => n.classList.remove('tut-focus'));
    this.focused = selector ? [...document.querySelectorAll(selector)] : [];
    this.focused.forEach((n) => n.classList.add('tut-focus'));
    const tabs = this.app.layout?.tabs ?? [];
    if (tab && tabs.includes(tab)) this.app.dockTabs.select(tab);
    this.tab = tab;
  }

  /** Move the arrow to the first of the step's targets that's on screen. */
  #point() {
    const t = this.app.game?.tutorial;
    const step = t?.step;
    const blocked = this.app.screens?.anyOpen; // pause / briefing / settings cover the game
    const selectors = step && !t.complete && !this.root.hidden && !blocked ? (step.point?.(t) ?? []) : [];
    let target = null;
    for (const sel of selectors) {
      target = [...document.querySelectorAll(sel)].find(pointable) ?? null;
      if (target) break;
    }
    if (target !== this.target) {
      this.target?.classList.remove('tut-target');
      target?.classList.add('tut-target');
      this.target = target;
    }
    // A step's tab can depend on progress (e.g. desk, then waiting area).
    const tab = typeof step?.tab === 'function' ? step.tab(t) : step?.tab;
    if (tab !== this.tab && !t?.complete && step) this.#focus(step.focus, tab);
    if (!target) {
      this.pointer.hidden = true;
      this.root.classList.remove('is-ghost');
      return;
    }
    const r = target.getBoundingClientRect();
    // Never cover what we point at (small screens): move the card to the other end
    // of the map; if it still covers it there, fade it and let taps through.
    const card = this.root.getBoundingClientRect();
    const covers = r.left < card.right && r.right > card.left && r.top < card.bottom && r.bottom > card.top;
    if (covers) {
      const stage = this.root.parentElement.getBoundingClientRect();
      const bottom = r.top + r.height / 2 < stage.top + stage.height / 2;
      if (this.root.classList.contains('at-bottom') !== bottom) this.root.classList.toggle('at-bottom', bottom);
      else this.root.classList.add('is-ghost');
    } else if (this.root.classList.contains('is-ghost')) {
      // Only un-ghost once the target is clear of where the card would be.
      this.root.classList.remove('is-ghost');
    }
    const below = r.top < 70; // no room above: point up from underneath
    const x = Math.min(window.innerWidth - 20, Math.max(20, r.left + r.width / 2));
    const y = below ? r.bottom + 4 : r.top - 4;
    this.pointer.hidden = false;
    this.pointer.classList.toggle('is-below', below);
    this.pointer.style.transform = `translate(${x}px, ${y}px)`;
  }

  render() {
    const t = this.app.game?.tutorial;
    if (!t || !t.step) {
      this.root.hidden = true;
      this.#focus(null);
      return;
    }
    const step = t.step;
    const game = this.app.game;
    const toGame = () => this.app.startShift(1);
    const buttons = [];
    if (step.final) {
      buttons.push(el('button', { class: 'btn btn-primary btn-sm', ...press(toGame) }, 'Start Level 1 →'));
    } else {
      if (!step.done) buttons.push(el('button', { class: 'btn btn-primary btn-sm', ...press(() => t.next()) }, 'Next →'));
      else if (!t.complete) buttons.push(el('button', { class: 'btn btn-sm', ...press(() => t.skip()) }, 'Skip step'));
      buttons.push(el('button', { class: 'btn btn-ghost btn-sm', ...press(toGame) }, 'Skip to the real game'));
    }
    const parts = [
      el('div', { class: 'tut-head' }, [el('span', {}, 'Training Day'), el('span', {}, `Step ${t.index + 1} of ${t.count}`)]),
      el('div', { class: 'tut-title' }, step.title),
      t.flags.retry && !t.complete ? el('div', { class: 'tut-retry' }, `Not quite: ${t.flags.retry}. Here comes another one: try again.`) : null,
      el('div', { class: 'tut-text', html: fill(step.text(game, t)) }),
      t.complete ? el('div', { class: 'tut-done' }, '✓ Nice! Next step coming up…') : null,
      el('div', { class: 'tut-actions' }, buttons),
    ];
    this.root.replaceChildren(...parts.filter(Boolean));
    this.root.hidden = false;
    // Highlight after the panels have re-rendered this frame.
    const tab = typeof step.tab === 'function' ? step.tab(t) : step.tab;
    requestAnimationFrame(() => this.#focus(t.complete ? null : step.focus, tab));
  }
}
