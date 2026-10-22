/*
 * Incident Log panel (sketch: "Incident Log" + "Incident Response - 3s window").
 * Open incidents show their own countdown and response buttons; the header
 * bar tracks the most urgent one.
 */
import { $, el, typeDot, setBar, press } from './dom.js';

const KIND_LABEL = { guest: 'Visitor', drill: 'Drill', patrol: 'Patrol', restroom: 'Request', door: 'Door', info: 'Notice' };

export class IncidentPanel {
  constructor(app) {
    this.app = app;
    this.list = $('#incident-list');
    this.timer = $('#incident-timer');
    this.who = $('#incident-who');
    this.openChip = $('#incident-open');
    this.bars = new Map();
    this.dirty = true;
    for (const evt of ['incidents', 'officers', 'camera']) app.bus.on(evt, () => (this.dirty = true));
  }

  render(game) {
    const inc = game.incidents;
    const open = inc.open.length;
    this.openChip.textContent = `${open} open`;
    this.openChip.className = `chip ${open ? 'chip-danger' : ''}`;
    this.bars.clear();
    if (!inc.list.length) {
      this.list.replaceChildren(el('div', { class: 'empty' }, 'All quiet. Incidents appear here – respond within the window.'));
      return;
    }
    // Open incidents first (most urgent on top), then history newest-first.
    const ordered = [
      ...inc.open.sort((a, b) => a.remaining - b.remaining),
      ...inc.list.filter((i) => i.status !== 'open').reverse(),
    ];
    this.list.replaceChildren(...ordered.slice(0, 40).map((i) => this.#item(game, i)));
  }

  #item(game, i) {
    const p = i.person;
    const children = [
      p ? typeDot(p.type) : el('span', { class: 'dot' }),
      el('div', { class: 'incident-text' }, [
        el('span', { class: 'incident-time' }, `[${i.time}]`),
        el('span', { class: 'incident-kind' }, `${KIND_LABEL[i.kind] ?? 'Incident'} · `),
        el('b', {}, i.title ?? p?.name ?? 'System'),
        ' ',
        i.text,
        i.status === 'missed' ? el('span', { class: 'incident-status missed' }, ` – missed`) : null,
        i.status === 'addressed' ? el('span', { class: 'incident-status addressed' }, ` – handled`) : null,
      ]),
    ];
    if (i.status === 'open') {
      const fill = el('div', { class: 'timer-fill' });
      this.bars.set(i.id, fill);
      children.push(el('div', { class: 'timer-bar' }, fill));
      children.push(
        el(
          'div',
          { class: 'incident-actions' },
          game.incidents.responsesFor(i).map((r) =>
            el(
              'button',
              {
                class: `btn btn-sm ${r.id === 'dispatch' ? 'btn-danger' : r.id === 'camera' ? 'btn-ghost' : 'btn-neutral'}`,
                'data-response': r.id,
                disabled: !r.enabled,
                title: r.hint || r.label,
                ...press(() => game.incidents.respond(i.id, r.id)),
              },
              r.hint && !r.enabled ? `${r.label} (${r.hint})` : r.label,
            ),
          ),
        ),
      );
    }
    return el('div', { class: `incident is-${i.status}` }, children);
  }

  tick(game) {
    // Officers change jobs without always announcing it: re-render when the free
    // count changes, so "Dispatch" / "Call escort" / "Send guard" are never stale.
    const free = game.escorts.availableCount;
    if (free !== this.freeOfficers) {
      this.freeOfficers = free;
      this.dirty = true;
    }
    if (this.dirty) {
      this.dirty = false;
      this.render(game);
    }
    for (const i of game.incidents.open) {
      const fill = this.bars.get(i.id);
      if (fill) setBar(fill, i.remaining / i.window, { paused: game.incidents.isPaused(i) });
    }
    // The header bar follows the newest incident still waiting for you (so it
    // starts full when one comes in); every incident keeps its own bar below.
    const open = game.incidents.open;
    const latest = open[open.length - 1] ?? null;
    setBar(this.timer, latest ? latest.remaining / latest.window : 0, { paused: !!latest && game.incidents.isPaused(latest) });
    const who = latest ? latest.person?.name ?? latest.title ?? '' : '';
    if (this.who.textContent !== who) this.who.textContent = who;
  }
}
