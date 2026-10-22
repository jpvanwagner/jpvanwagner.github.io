/*
 * The 3x3 waiting area ("MAX CAPACITY (9)" in the sketch).
 *
 * Visitors are parked here when no officer is free. They keep their arrival
 * grouping so a pair is escorted together. If left too long they get bored
 * and slip into the facility unescorted. With guest passes enabled, their
 * passes can still be printed here until the escort arrives.
 */
import { WAITING_SEATS } from '../data/layout.js';
import { PersonState } from '../entities/Person.js';
import { SYSTEM_TEXT } from '../data/incidentText.js';
import { uid } from '../core/rng.js';
import { clockMinutes } from '../core/clock.js';

export class WaitingAreaSystem {
  constructor(game) {
    this.game = game;
    this.groups = []; // { id, guests, seats, patience, dispatched }
  }

  get seats() {
    return WAITING_SEATS.slice(0, this.game.settings.WAITING_CAPACITY);
  }

  get occupancy() {
    return this.groups.reduce((n, grp) => n + grp.guests.length, 0);
  }

  freeSeats() {
    return this.game.spots.freeCount(this.seats);
  }

  add(guests) {
    const g = this.game;
    // Early visitors can't be collected until shortly before their appointment.
    const grace = g.settings.APPOINTMENT_GRACE_MINUTES;
    const notBefore = Math.max(...guests.map((m) => (m.appointment ? m.appointment.minutes - grace : -Infinity)));
    const group = { id: uid('wait'), guests, seats: [], patience: 0, dispatched: false, notBefore: Number.isFinite(notBefore) ? notBefore : null };
    for (const guest of guests) {
      const seat = g.spots.reserveAny(this.seats, guest);
      group.seats.push(seat);
      guest.state = PersonState.WAITING;
      guest.patience = 0;
      guest.walkTo(seat, {
        onArrive: () => {
          guest.mesh.rotation.y = Math.PI; // face up toward the desk/line
        },
      });
    }
    this.groups.push(group);
    g.bus.emit('waiting');
    return group;
  }

  groupOf(guest) {
    return this.groups.find((grp) => grp.guests.includes(guest)) ?? null;
  }

  /** Player clicked "Dispatch" on a waiting group. */
  dispatch(groupId) {
    const g = this.game;
    const group = this.groups.find((grp) => grp.id === groupId);
    const officer = group && g.escorts.idleOfficer(group.guests[0].pos);
    if (!group || group.dispatched || !officer || group.guests.some((m) => m.away) || this.tooEarly(group)) return false;
    group.dispatched = true;
    g.escorts.dispatch(officer, group.guests, { source: 'waiting' });
    g.bus.emit('waiting');
    return true;
  }

  /** Still too early to collect them for their appointment? */
  tooEarly(group) {
    return group.notBefore !== null && clockMinutes(this.game.time, this.game.settings) < group.notBefore;
  }

  /** Level 2+: print passes for a parked group (any time before their escort arrives). */
  printPass(groupId) {
    const group = this.groups.find((grp) => grp.id === groupId);
    return !!group && this.game.desk.printFor(group.guests);
  }

  /** Visitors collected by an escort (or wandered off). */
  remove(group) {
    group.seats.forEach((s) => this.game.spots.release(s));
    this.groups = this.groups.filter((grp) => grp !== group);
    this.game.bus.emit('waiting');
  }

  update(dt) {
    const g = this.game;
    for (const group of [...this.groups]) {
      if (group.dispatched || group.guests.some((m) => m.away) || this.tooEarly(group)) continue; // (patience runs once they're due)
      group.patience += dt;
      group.guests.forEach((m) => (m.patience = group.patience));
      if (group.patience >= g.settings.WAITING_PATIENCE) {
        this.remove(group);
        g.desk.cancelPrintFor(group.guests);
        for (const guest of group.guests) {
          g.score.count('tailgaters');
          g.incidents.create(guest, 'info', SYSTEM_TEXT.wanderedOff);
          g.wander.admit(guest, { tailgate: true });
        }
      }
    }
  }
}
