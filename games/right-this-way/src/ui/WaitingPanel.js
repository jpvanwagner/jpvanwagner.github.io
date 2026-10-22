/*
 * Waiting Area panel: parked visitor groups, their patience, Dispatch, and
 * (level 2+) Print pass - available until the escort actually arrives.
 * Below them: visitors left unattended in a lounge (breakroom / cafeteria),
 * how long until they get restless, and "Send guard" to fetch them.
 */
import { $, el, typeDot, setBar, press } from './dom.js';
import { formatClock } from '../core/clock.js';

function passChip(m) {
  if (m.revealed && !m.valid) return el('span', { class: 'cred cred-bad' }, 'No appt.');
  return m.hasPass ? el('span', { class: 'cred cred-pass' }, 'Pass') : el('span', { class: 'cred cred-unknown' }, 'No pass');
}

/** True the moment an early group becomes collectable (so the button refreshes). */
function w0(game, grp) {
  const early = game.waiting.tooEarly(grp);
  const changed = grp.wasEarly !== undefined && grp.wasEarly !== early;
  grp.wasEarly = early;
  return changed;
}

export class WaitingPanel {
  constructor(app) {
    this.app = app;
    this.list = $('#waiting-list');
    this.count = $('#waiting-count');
    this.bars = new Map(); // group id -> patience fill element
    this.printBars = new Map(); // group id -> print progress element
    this.loungeBars = new Map(); // visit -> patience fill element
    this.dirty = true;
    for (const evt of ['waiting', 'officers', 'desk']) app.bus.on(evt, () => (this.dirty = true));
  }

  render(game) {
    const w = game.waiting;
    const passes = game.features.guestPasses;
    this.count.textContent = `${w.occupancy}/${game.settings.WAITING_CAPACITY}`;
    this.count.className = `chip ${w.occupancy >= game.settings.WAITING_CAPACITY ? 'chip-danger' : 'chip-warn'}`;
    this.bars.clear();
    this.printBars.clear();
    this.loungeBars.clear();
    const lounging = game.escorts.lounging;
    if (!w.groups.length && !lounging.length) {
      this.list.replaceChildren(el('div', { class: 'empty' }, 'No visitors waiting.\nUnescorted visitors land here when no officer is free.'));
      return;
    }
    const officerFree = !!game.escorts.idleOfficer();
    const loungeItems = lounging.map((visit) => {
      const fill = el('div', { class: 'timer-fill' });
      this.loungeBars.set(visit, fill);
      const guests = visit.guests.filter((m) => !m.removed);
      return el('div', { class: 'wait-item lounge-item' }, [
        el('div', { class: 'wait-names' }, [
          ...guests.map((m) => el('span', {}, [typeDot(m.type), m.name, m.away ? el('span', { class: 'cred cred-unknown' }, 'Restroom') : null])),
          el('span', { class: 'lounge-where' }, `${visit.loungeRoom?.label ?? 'Lounge'} · ${visit.done ? 'to be walked out' : 'waiting for their host'}`),
        ]),
        el('div', { class: 'wait-actions' }, [
          el(
            'button',
            {
              class: `btn btn-sm ${visit.fetching ? '' : 'btn-escort'}`,
              'data-action': 'fetch',
              disabled: !!visit.fetching || !officerFree || visit.guests.some((m) => m.away),
              title: officerFree ? 'A guard collects them and takes them on' : 'No officer free',
              ...press(() => game.escorts.fetchFromLounge(visit)),
            },
            visit.fetching ? 'Guard en route' : 'Send guard',
          ),
        ]),
        el('div', { class: 'timer-bar' }, fill),
      ]);
    });
    const loungeSection = loungeItems.length ? [el('div', { class: 'list-sub' }, 'Left in a lounge'), ...loungeItems] : [];
    this.list.replaceChildren(
      ...w.groups.map((grp) => {
        const fill = el('div', { class: 'timer-fill' });
        this.bars.set(grp.id, fill);

        let printBtn = null;
        if (passes) {
          const progress = game.desk.printProgress(grp.guests);
          const bar = progress !== null ? el('span', { class: 'btn-progress', style: { width: `${progress * 100}%` } }) : null;
          if (bar) this.printBars.set(grp.id, bar);
          printBtn = el(
            'button',
            {
              class: 'btn btn-sm btn-info',
              'data-action': 'print-pass',
              disabled: !game.desk.canPrint(grp.guests),
              title: 'Print guest passes before the escort arrives',
              style: { position: 'relative', overflow: 'hidden' },
              ...press(() => w.printPass(grp.id)),
            },
            [game.desk.printLabel(grp.guests), bar],
          );
        }

        return el('div', { class: 'wait-item', 'data-group': grp.id }, [
          el(
            'div',
            { class: 'wait-names' },
            grp.guests.map((m) => el('span', {}, [typeDot(m.type), m.name, m.away ? el('span', { class: 'cred cred-unknown' }, 'Restroom') : passes ? passChip(m) : null])),
          ),
          el('div', { class: 'wait-actions' }, [
            printBtn,
            el(
              'button',
              {
                class: `btn btn-sm ${grp.dispatched ? '' : 'btn-escort'}`,
                'data-action': 'dispatch',
                disabled: grp.dispatched || !officerFree || grp.guests.some((m) => m.away) || w.tooEarly(grp),
                title: w.tooEarly(grp) ? 'Too early for their appointment' : officerFree ? 'Send a free officer to escort this group' : 'No officer free',
                ...press(() => w.dispatch(grp.id)),
              },
              grp.dispatched ? 'En route' : w.tooEarly(grp) ? `From ${formatClock(grp.notBefore).replace(/^0/, '')}` : 'Dispatch',
            ),
          ]),
          el('div', { class: 'timer-bar' }, fill),
        ]);
      }),
      ...loungeSection,
    );
  }

  tick(game) {
    // Officers change jobs without always announcing it: re-render when the free
    // count changes, so "Dispatch" / "Call escort" / "Send guard" are never stale.
    // Same for early visitors becoming collectable as the clock moves on.
    const free = `${game.escorts.availableCount}|${game.waiting.groups.map((w) => game.waiting.tooEarly(w)).join()}`;
    if (free !== this.freeOfficers) {
      this.freeOfficers = free;
      this.dirty = true;
    }
    if (this.dirty) {
      this.dirty = false;
      this.render(game);
    }
    for (const grp of game.waiting.groups) {
      const fill = this.bars.get(grp.id);
      if (fill) setBar(fill, 1 - grp.patience / game.settings.WAITING_PATIENCE, { paused: grp.dispatched });
      const bar = this.printBars.get(grp.id);
      if (w0(game, grp)) this.dirty = true;
      if (grp.guests.some((m) => m.away) !== !!grp.wasAway) {
        grp.wasAway = grp.guests.some((m) => m.away);
        this.dirty = true; // restroom trip started / ended: refresh the buttons
      }
      const progress = game.desk.printProgress(grp.guests);
      if (bar && progress !== null) bar.style.width = `${progress * 100}%`;
    }
    for (const [visit, fill] of this.loungeBars) {
      setBar(fill, visit.timer / (visit.timerMax || 1), { paused: !!visit.fetching });
      const away = visit.guests.some((m) => m.away);
      if (away !== !!visit.wasAway) {
        visit.wasAway = away;
        this.dirty = true;
      }
    }
  }
}
