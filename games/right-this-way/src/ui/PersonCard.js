/*
 * Hover card for people on the map (and in camera views): who they are, their
 * job, how long they've been here, and what they're doing right now.
 *
 * Mouse: hover a person. Touch: tap them (the card stays up for a few
 * seconds). It only shows what the player could know - it never gives away
 * an expired badge or a visitor who isn't on the list.
 */
import { $, el } from './dom.js';
import { PersonState } from '../entities/Person.js';
import { ROOMS } from '../data/layout.js';
import { ORGANIZATION } from '../data/organization.js';
import { clockMinutes, formatClock } from '../core/clock.js';

const ROOM_LABEL = Object.fromEntries(ROOMS.map((r) => [r.id, r.label]));
const firstName = (p) => p?.name.split(' ')[0] ?? '';

function role(game, p) {
  if (p.isOfficer) return p.isDuty ? `Duty officer · ${ORGANIZATION.name}` : `Officer · ${ORGANIZATION.name}`;
  if (p.isEmployee) return `${p.roster?.department ?? 'Staff'} · ${game.company.name}`;
  const a = p.appointment;
  if (p.revealed && a) return a.service ? `Visitor · ${a.service} (${a.roomLabel})` : `Visitor · seeing ${a.host} (${a.roomLabel})`;
  if (p.revealed && p.lookupResult === 'not-found') return 'Visitor · not on today’s list';
  return 'Visitor · appointment not checked yet';
}

function doing(p) {
  const S = PersonState;
  switch (p.state) {
    case S.ARRIVING: return 'Walking in';
    case S.QUEUED: return 'In line for the desk';
    case S.AT_DESK: return 'At the desk';
    case S.WAITING: return 'Sitting in the waiting area';
    case S.ESCORTED: return p.tetherTo ? `Following ${p.tetherTo.name}` : 'Being escorted';
    case S.WANDERING: return p.targetedBy ? 'Unescorted – a guard is on the way' : 'Wandering around unescorted';
    case S.WORKING: return p.onBreak ? 'On a break' : 'Working';
    case S.IDLE: return p.status || 'On duty, free';
    case S.PASSING: return 'Passing through';
    case S.LEAVING: return 'Heading home';
    case S.VISITING: return p.status ? `${p.status}${p.tetherTo ? ` with ${firstName(p.tetherTo)}` : ''}` : 'In a meeting';
    default: return p.status || p.state.toLowerCase();
  }
}

export class PersonCard {
  constructor(app) {
    this.app = app;
    this.root = el('div', { class: 'person-card', hidden: true });
    $('#world-overlay').append(this.root);
    this.person = null;
    this.pinnedUntil = 0;
    this.p = { x: 0, y: 0, visible: false };
    this.text = '';
  }

  /** The person drawn closest to a screen point (client coordinates), within `radius` px. */
  pick(clientX, clientY, radius) {
    const game = this.app.game;
    if (!game) return null;
    const rect = this.app.stage.renderer.domElement.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best = null;
    let bestD = radius;
    for (const person of game.people) {
      for (const h of [0.6, 1.8, 3]) {
        this.app.stage.project(person.pos.x, h, person.pos.z, this.p);
        if (!this.p.visible) continue;
        const d = Math.hypot(this.p.x - x, this.p.y - y);
        if (d < bestD) {
          bestD = d;
          best = person;
        }
      }
    }
    return best;
  }

  /** Mouse hover (null clears, unless a tap pinned the card). */
  hover(person) {
    if (!person && performance.now() < this.pinnedUntil) return;
    this.person = person;
  }

  /** Touch: show the card for a few seconds. */
  pin(person, ms = 4500) {
    this.person = person;
    this.pinnedUntil = person ? performance.now() + ms : 0;
  }

  tick(game) {
    const p = this.person;
    if (p && performance.now() > this.pinnedUntil && this.pinnedUntil) {
      this.pinnedUntil = 0;
      this.person = null;
    }
    if (!p || p.removed || !game.people.includes(p)) {
      this.root.hidden = true;
      this.person = p?.removed ? null : p;
      return;
    }
    this.app.stage.project(p.pos.x, 3.6, p.pos.z, this.p);
    this.root.hidden = !this.p.visible;
    if (!this.p.visible) return;
    this.root.style.left = `${this.p.x}px`;
    this.root.style.top = `${this.p.y}px`;

    const minutesHere = Math.max(0, Math.round((game.time - p.arrivedAt) * game.settings.CLOCK_MINUTES_PER_SECOND));
    const since = `Arrived ${formatClock(clockMinutes(p.arrivedAt, game.settings))} · here ${minutesHere} min`;
    const where = p.room && p.room !== 'outside' ? ROOM_LABEL[p.room] : 'Outside';
    const lines = [p.name, role(game, p), since, `${doing(p)} · ${where}`];
    const text = lines.join('|');
    if (text === this.text) return;
    this.text = text;
    this.root.className = `person-card type-${p.type.id.toLowerCase()}`;
    this.root.replaceChildren(
      el('div', { class: 'pc-name' }, lines[0]),
      el('div', { class: 'pc-role' }, lines[1]),
      el('div', { class: 'pc-line' }, lines[2]),
      el('div', { class: 'pc-line pc-doing' }, lines[3]),
    );
  }
}
