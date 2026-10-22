/*
 * Picks the screen layout from the viewport size (which is the iframe size
 * when embedded) and sets #app[data-layout]. The map always gets as much room
 * as possible:
 *
 *   side-stack     landscape, tall enough: panels stacked in a sidebar
 *   side-tabs      landscape, medium height: desk on top, waiting/incidents tabbed
 *   side-tabs-all  landscape, short (phone sideways / small embed): all tabbed
 *   bottom-wide    portrait tablet: three panels under the map
 *   bottom-tabs    portrait phone: tabbed panels under the map
 *
 * It also sets --ui-zoom on <html>: on laptop-sized windows and embeds the
 * chrome (top bar, panels, cards, modals) shrinks with the viewport so
 * everything fits on one screen and the map keeps its share. Phones use their
 * own compact CSS instead (zoom 1) so touch targets stay full size.
 */
import { prefs, onPrefs } from '../core/prefs.js';
export function chooseLayout(width, height) {
  const aspect = width / height;
  if (aspect >= 1.15) {
    if (height < 470) return 'side-tabs-all';
    if (height < 780) return 'side-tabs';
    return 'side-stack';
  }
  return width >= 700 ? 'bottom-wide' : 'bottom-tabs';
}

/** UI scale for the chrome: 1 on big screens, down to 0.75 on small windows. */
export function chooseUiZoom(width, height, mode, size = 'auto') {
  const fixed = { small: 0.8, medium: 1, large: 1.15 }[size];
  if (fixed) return fixed;
  if (mode === 'side-tabs-all' || mode === 'bottom-tabs') return 1;
  const z = Math.min(width / 1400, height / 860);
  return Math.round(Math.min(1, Math.max(0.75, z)) * 100) / 100;
}

/** Which dock tabs exist in each layout (empty = no tab bar). */
export const LAYOUT_TABS = {
  'side-stack': [],
  'side-tabs': ['waiting', 'incidents'],
  'side-tabs-all': ['desk', 'waiting', 'incidents'],
  'bottom-wide': [],
  'bottom-tabs': ['desk', 'waiting', 'incidents'],
};

export class Layout {
  constructor(app) {
    onPrefs((key) => key === 'uiSize' && (this.update(), window.dispatchEvent(new Event('resize'))));
    this.app = app;
    this.root = document.getElementById('app');
    this.listeners = new Set();
    this.update();
    window.addEventListener('resize', () => this.update());
    window.visualViewport?.addEventListener('resize', () => this.update());
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  update() {
    const mode = chooseLayout(window.innerWidth, window.innerHeight);
    const zoom = chooseUiZoom(window.innerWidth, window.innerHeight, mode, prefs.uiSize);
    if (zoom !== this.zoom) {
      this.zoom = zoom;
      document.documentElement.style.setProperty('--ui-zoom', zoom);
    }
    if (mode === this.mode) return;
    this.mode = mode;
    this.root.dataset.layout = mode;
    this.listeners.forEach((fn) => fn(mode));
  }

  get tabs() {
    return LAYOUT_TABS[this.mode];
  }
}
