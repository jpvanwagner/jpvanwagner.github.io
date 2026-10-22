/*
 * Tab bar for the dock in layouts that can't show every panel (see
 * ui/Layout.js). Badges keep the hidden panels honest: someone at the desk,
 * visitors waiting, incidents open.
 */
import { $, press } from './dom.js';

export class DockTabs {
  constructor(app) {
    this.app = app;
    this.dock = $('#dock');
    this.tabs = [...document.querySelectorAll('.dock-tab')];
    this.badges = {
      desk: $('#tab-badge-desk'),
      waiting: $('#tab-badge-waiting'),
      incidents: $('#tab-badge-incidents'),
    };
    for (const tab of this.tabs) {
      const handlers = press(() => this.select(tab.dataset.tab));
      tab.addEventListener('pointerdown', handlers.onpointerdown);
      tab.addEventListener('keydown', handlers.onkeydown);
    }
    this.select('desk');
    this.tabs_ = [];
  }

  /** Called when the layout changes: keep the active tab one that exists. */
  setLayout(tabs) {
    this.tabs_ = tabs;
    if (tabs.length && !tabs.includes(this.active)) this.select(tabs.includes('desk') ? 'desk' : 'incidents');
  }

  /** Is the incident list on screen right now? */
  get incidentsVisible() {
    return this.tabs_.length === 0 || this.active === 'incidents';
  }

  get active() {
    return this.dock.dataset.tab;
  }

  select(name) {
    this.dock.dataset.tab = name;
    for (const tab of this.tabs) {
      const on = tab.dataset.tab === name;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
    }
  }

  #badge(name, text, cls = '') {
    const el = this.badges[name];
    if (el.textContent !== text) el.textContent = text;
    el.className = `tab-badge ${cls}`;
  }

  tick(game) {
    const desk = game.desk;
    this.#badge('desk', desk.group ? '!' : '', desk.group && desk.windowRunning ? 'is-attn' : '');
    const waiting = game.waiting.occupancy + game.escorts.lounging.reduce((n, v) => n + v.guests.length, 0);
    this.#badge('waiting', waiting ? String(waiting) : '');
    const open = game.incidents.open.length;
    this.#badge('incidents', open ? String(open) : '', open ? 'is-alert' : '');
  }
}
