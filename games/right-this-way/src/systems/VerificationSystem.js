/*
 * Visitors who aren't on today's list - or who are on it but more than
 * APPOINTMENT_GRACE_MINUTES late (the officer checks whether their host can
 * still fit them in: rescheduled for later today and sent to the waiting
 * area, or asked to leave).
 *
 * For visitors who aren't on the list:
 *
 * The desk calls an officer to verify ("Call officer to verify"). The
 * visitors step out of the line to a spot by the checkpoint. The nearest free
 * officer walks over and radios in (VERIFY_RADIO_TIME), then either:
 *   - their host confirms them (LATE_ADDITION_CHANCE): they're added to the
 *     visitor computer's list and line up again, or
 *   - nobody expected them: they're sent home.
 * If no officer is free they wait at the spot until one is.
 */
import { VERIFY_SPOTS } from '../data/layout.js';
import { PersonState } from '../entities/Person.js';
import { SYSTEM_TEXT } from '../data/incidentText.js';
import { uid, chance } from '../core/rng.js';
import { clockMinutes, formatClock } from '../core/clock.js';

const firstName = (p) => p.name.split(' ')[0];

export class VerificationSystem {
  constructor(game) {
    this.game = game;
    this.parties = []; // { id, guests, spots, officer, phase: 'waiting'|'officer'|'radio'|'requeue', timer }
  }

  add(guests) {
    const g = this.game;
    const party = { id: uid('verify'), guests, spots: [], officer: null, phase: 'waiting', timer: 0 };
    g.score.count('verifications');
    for (const guest of guests) {
      g.spots.releaseAll(guest);
      const spot = g.spots.reserveAny(VERIFY_SPOTS, guest);
      party.spots.push(spot);
      guest.state = PersonState.VERIFYING;
      guest.status = 'Waiting for security';
      guest.patience = 0;
      guest.walkTo(spot ?? VERIFY_SPOTS[0], { onArrive: () => (guest.mesh.rotation.y = 0) });
    }
    const unlisted = guests.find((m) => !m.valid);
    g.incidents.create(unlisted ?? guests[0], 'info', unlisted ? SYSTEM_TEXT.verifyWaiting : SYSTEM_TEXT.verifyLate);
    this.parties.push(party);
    return party;
  }

  #assign(party) {
    const g = this.game;
    const officer = g.escorts.idleOfficer(party.guests[0].pos);
    if (!officer) return;
    party.officer = officer;
    party.phase = 'officer';
    officer.job = { kind: 'verify', party };
    officer.state = PersonState.RESPONDING;
    officer.status = `Verifying ${firstName(party.guests[0])}`;
    party.guests.forEach((m) => (m.status = 'Officer on the way'));
    const p = party.guests[0].pos;
    officer.walkTo({ x: p.x, z: p.z + 2.2 }, {
      onArrive: () => {
        party.phase = 'radio';
        party.timer = g.settings.VERIFY_RADIO_TIME;
        officer.mesh.rotation.y = Math.PI;
        officer.status = 'Radioing in…';
        party.guests.forEach((m) => (m.status = 'Being verified'));
      },
    });
    g.bus.emit('officers');
  }

  #decide(party) {
    const g = this.game;
    const { guests, officer } = party;
    g.escorts.returnToDuty(officer);
    party.officer = null;
    if (guests.every((m) => m.valid)) return this.#reschedule(party);
    const expected = guests.every((m) => m.valid || m.lateAddition);
    const lead = guests.find((m) => !m.valid) ?? guests[0];
    if (!expected) {
      g.incidents.create(lead, 'info', SYSTEM_TEXT.verifyRejected);
      this.#remove(party);
      guests.forEach((m) => g.leave(m));
      return;
    }
    // Added to today's list: they'll look up fine at the desk now.
    for (const m of guests) {
      if (!m.valid) {
        m.appointment = g.appointments.addLate(m.name, m.arrivedMinutes ?? null);
        m.valid = true;
      }
      m.revealed = !g.features.appointmentChecks;
      m.lookupResult = null;
      m.status = 'Lining up again';
    }
    g.incidents.create(lead, 'info', SYSTEM_TEXT.verifyAdded);
    party.phase = 'requeue';
  }

  /** Late visitors: a new time later today (they wait for it), or home. */
  #reschedule(party) {
    const g = this.game;
    const { guests } = party;
    this.#remove(party);
    const now = clockMinutes(g.time, g.settings);
    if (!chance(g.settings.RESCHEDULE_CHANCE) || g.waiting.freeSeats() < guests.length) {
      g.incidents.create(guests[0], 'info', SYSTEM_TEXT.notRescheduled);
      guests.forEach((m) => g.leave(m));
      return;
    }
    for (const m of guests) {
      g.appointments.reschedule(m.appointment, now);
      m.status = '';
    }
    g.incidents.create(guests[0], 'info', SYSTEM_TEXT.rescheduled(formatClock(guests[0].appointment.minutes).replace(/^0/, '')));
    g.waiting.add(guests);
  }

  #remove(party) {
    party.spots.forEach((s) => this.game.spots.release(s));
    this.parties = this.parties.filter((p) => p !== party);
  }

  update(dt) {
    const g = this.game;
    for (const party of [...this.parties]) {
      if (party.guests.every((m) => m.removed)) {
        if (party.officer) g.escorts.returnToDuty(party.officer);
        this.#remove(party);
        continue;
      }
      if (party.phase === 'waiting') this.#assign(party);
      else if (party.phase === 'radio') {
        party.timer -= dt;
        if (party.timer <= 0) this.#decide(party);
      } else if (party.phase === 'requeue' && g.queue.canAccept()) {
        // Back in line as a group of their own.
        this.#remove(party);
        const group = { id: uid('grp'), code: party.guests.map(() => 'G').join(''), members: party.guests, patience: 0, slot: -1, arrived: 0 };
        party.guests.forEach((m) => {
          m.group = group;
          m.state = PersonState.ARRIVING;
          m.status = '';
        });
        g.queue.join(group);
      }
    }
  }
}
