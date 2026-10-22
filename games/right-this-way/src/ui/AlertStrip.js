/*
 * When the incident list isn't on screen (tabbed layouts), the most urgent
 * open incident is pinned over the map with its response buttons, so a
 * 3-second window can be answered without switching tabs.
 */
import { $, el, typeDot, setBar, press } from './dom.js';

export class AlertStrip {
  constructor(app) {
    this.app = app;
    this.root = $('#alert-strip');
    this.shownId = null;
    this.dirty = true;
    for (const evt of ['incidents', 'officers', 'camera']) app.bus.on(evt, () => (this.dirty = true));
  }

  #pick(game) {
    const open = game.incidents.open;
    if (!open.length) return null;
    return game.incidents.mostUrgent ?? open[0]; // every one may be paused by a camera
  }

  render(game, incident) {
    this.shownId = incident?.id ?? null;
    this.fill = null;
    if (!incident) {
      this.root.replaceChildren();
      return;
    }
    const others = game.incidents.open.length - 1;
    const p = incident.person;
    this.fill = el('div', { class: 'timer-fill timer-fill-danger' });
    this.root.replaceChildren(
      p ? typeDot(p.type) : el('span'),
      el('div', { class: 'alert-text' }, [el('b', {}, incident.title ?? p?.name ?? 'System'), ' ', incident.text]),
      el(
        'div',
        { class: 'alert-actions' },
        [
          ...game.incidents.responsesFor(incident).map((r) =>
            el(
              'button',
              {
                class: `btn btn-sm ${r.id === 'dispatch' ? 'btn-danger' : r.id === 'camera' ? '' : 'btn-neutral'}`,
                disabled: !r.enabled,
                title: r.hint || r.label,
                ...press(() => game.incidents.respond(incident.id, r.id)),
              },
              r.id === 'dispatch' ? 'Dispatch' : r.id === 'camera' ? 'Cam' : r.label,
            ),
          ),
          others > 0 ? el('span', { class: 'alert-more' }, `+${others}`) : null,
        ],
      ),
      el('div', { class: 'timer-bar' }, this.fill),
    );
  }

  tick(game, incidentsVisible) {
    const incident = this.#pick(game);
    const visible = !!incident && !incidentsVisible;
    this.root.hidden = !visible;
    if (!visible) return;
    if (this.dirty || incident.id !== this.shownId) {
      this.dirty = false;
      this.render(game, incident);
    }
    if (this.fill) setBar(this.fill, incident.remaining / incident.window, { paused: game.incidents.isPaused(incident) });
  }
}
