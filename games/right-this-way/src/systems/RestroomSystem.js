/*
 * Everybody needs the restroom at some point.
 *
 *  - Employees and officers: once during their day, when they're free, they
 *    walk to the nearest restroom with a free stall and come back.
 *  - Visitors (VISITOR_RESTROOM_CHANCE of them) need it during their stay:
 *      - in the waiting area: they may use the single-stall restroom next to
 *        it on their own;
 *      - anywhere else (in a meeting, left in a lounge): they ask for a guard.
 *        That's a request in the incident log with a "Send guard" button; the
 *        guard walks them to the nearest restroom and back (EscortSystem). If
 *        nobody answers in time they go alone - an unescorted visitor
 *        wandering the halls until they're back in their seat.
 */
import { RESTROOMS } from '../data/layout.js';
import { PersonState } from '../entities/Person.js';
import { range, rangeOf, chance } from '../core/rng.js';
import { SYSTEM_TEXT } from '../data/incidentText.js';

const RETRY = 6; // seconds before trying again when every stall is taken
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class RestroomSystem {
  constructor(game) {
    this.game = game;
  }

  /** Decide when a newcomer will need the restroom. */
  schedule(person) {
    const g = this.game;
    if (g.features.scripted) {
      person.restroomAt = null; // the tutorial asks for one when it wants one
    } else if (person.isGuest) {
      person.restroomAt = chance(g.settings.VISITOR_RESTROOM_CHANCE) ? g.time + range(40, 150) : null;
    } else {
      const left = Math.max(30, g.shiftLength - g.time);
      person.restroomAt = g.time + range(25, left * 0.85);
    }
  }

  /** Reserve a stall: visitors going alone may only use the visitor-center restroom. */
  reserveFor(person, { escorted = false } = {}) {
    const g = this.game;
    const alone = person.isGuest && !escorted;
    const options = RESTROOMS.filter((r) => (!alone || r.visitorsAlone) && g.spots.freeCount(r.spots) > 0);
    if (!options.length) return null;
    const restroom = options.reduce((best, r) => (dist(r.waitAt, person.pos) < dist(best.waitAt, person.pos) ? r : best));
    const spot = g.spots.reserveAny(restroom.spots, person);
    return { restroom, spot };
  }

  /** Where a visitor goes back to afterwards: the seat they're holding (or where they stand). */
  homeFor(person) {
    const stalls = new Set(RESTROOMS.flatMap((r) => r.spots));
    const seat = this.game.spots.spotsOf(person).find((s) => !stalls.has(s));
    return seat ? { x: seat.x, z: seat.z } : { x: person.pos.x, z: person.pos.z };
  }

  /** Visitor trip without a guard: allowed to the visitor restroom, otherwise a violation. */
  #aloneTrip(guest, { unescorted }) {
    const target = this.reserveFor(guest, { escorted: unescorted });
    if (!target) return false;
    guest.trip = { ...target, home: this.homeFor(guest), returnState: guest.state, returnStatus: guest.status, phase: 'going', timer: 0 };
    guest.away = true;
    guest.unescortedTrip = unescorted;
    guest.state = PersonState.RESTROOM;
    guest.status = unescorted ? 'Unescorted – looking for the restroom' : 'Restroom';
    guest.tetherTo = null;
    guest.walkTo(target.spot, { onArrive: () => this.#inStall(guest) });
    return true;
  }

  #staffTrip(person) {
    const target = this.reserveFor(person);
    if (!target) return false;
    const g = this.game;
    g.spots.releaseAll(person);
    g.spots.reserve(target.spot, person);
    if (person.isEmployee) {
      person.onBreak = false;
      person.breakSpot = null;
    }
    person.trip = { ...target, phase: 'going', timer: 0 };
    person.job = { kind: 'restroom-break' };
    person.state = PersonState.RESTROOM;
    person.status = 'Restroom break';
    person.walkTo(target.spot, { onArrive: () => this.#inStall(person) });
    return true;
  }

  #inStall(person) {
    if (!person.trip) return;
    person.trip.phase = 'inside';
    person.trip.timer = rangeOf(this.game.settings.RESTROOM_TIME);
  }

  #leaveStall(person) {
    const g = this.game;
    const trip = person.trip;
    g.spots.release(trip.spot);
    if (!person.isGuest) {
      person.trip = null;
      person.job = null;
      if (g.escorts.officers.includes(person)) g.escorts.returnToDuty(person);
      else g.staff.returnToWork(person);
      return;
    }
    trip.phase = 'back';
    person.walkTo(trip.home, { onArrive: () => this.backFromTrip(person) });
  }

  /** A visitor is back from the restroom (alone or escorted): carry on where they were. */
  backFromTrip(guest) {
    const trip = guest.trip;
    guest.trip = null;
    guest.away = false;
    guest.unescortedTrip = false;
    guest.unfollow();
    const visit = guest.visit;
    if (trip) {
      guest.state = trip.returnState;
      guest.status = trip.returnStatus;
    } else if (visit?.phase === 'meeting') {
      guest.state = PersonState.VISITING;
      guest.status = visit.room?.service ?? 'In a meeting';
    } else if (visit?.phase === 'lounge') {
      guest.state = PersonState.LOUNGING;
      guest.status = visit.done ? 'Waiting to be walked out' : 'Waiting for their host';
    }
    guest.tetherTo = visit?.phase === 'meeting' ? visit.leader : null;
    guest.walkTo(this.homeFor(guest));
  }

  request(guest) {
    const g = this.game;
    guest.restroomAt = null;
    guest.restroomRequest = g.incidents.create(guest, 'restroom', SYSTEM_TEXT.restroomRequest, {
      window: g.settings.RESTROOM_REQUEST_WINDOW,
      title: null,
    });
  }

  update(dt) {
    const g = this.game;
    for (const p of g.people) {
      if (p.removed) continue;

      // Trips in progress
      if (p.trip?.phase === 'inside') {
        p.trip.timer -= dt;
        if (p.trip.timer <= 0) this.#leaveStall(p);
        continue;
      }

      // A visitor's request for a guard that nobody answered: they go alone.
      const req = p.restroomRequest;
      if (req && req.status !== 'open') {
        p.restroomRequest = null;
        const guardComing = p.respondingOfficer || p.targetedBy || p.visit?.fetching;
        if (req.status === 'missed' && !guardComing && !p.away && [PersonState.VISITING, PersonState.LOUNGING].includes(p.state)) {
          g.incidents.create(p, 'info', SYSTEM_TEXT.restroomAlone);
          this.#aloneTrip(p, { unescorted: true });
        }
        continue;
      }

      if (p.restroomAt === null || p.restroomAt === undefined || g.time < p.restroomAt || p.away || p.trip) continue;

      let went = false;
      if (p.isGuest) {
        if (p.state === PersonState.WAITING && !g.waiting.groupOf(p)?.dispatched && !p.path.length) went = this.#aloneTrip(p, { unescorted: false });
        else if ((p.state === PersonState.VISITING || p.state === PersonState.LOUNGING) && !p.path.length && !p.respondingOfficer) {
          this.request(p);
          continue;
        } else {
          p.restroomAt = g.time + RETRY; // busy (in line, walking...): ask again shortly
          continue;
        }
      } else if (p.isEmployee && p.state === PersonState.WORKING && !p.job && !p.path.length) {
        went = this.#staffTrip(p);
      } else if (p.isOfficer && g.escorts.officers.includes(p) && p.state === PersonState.IDLE && !p.job) {
        went = this.#staffTrip(p);
      } else {
        p.restroomAt = g.time + RETRY;
        continue;
      }
      p.restroomAt = went ? null : g.time + RETRY;
    }
  }
}
