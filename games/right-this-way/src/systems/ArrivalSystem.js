/*
 * Spawns arrivals ("line of singles or pairs").
 *
 * The duty officer crew arrives first at 07:00, then groups arrive every
 * ARRIVAL_INTERVAL seconds using the level's rush-hour mix for the first part
 * of the shift and the daytime mix afterwards. Nobody spawns while the line
 * is full - they are assumed to be queuing outside.
 *
 * Everyone comes by car (ParkingSystem): the group appears at their car door
 * (or at the edge of the map if they parked out of view) and walks in.
 *
 * Staff are roster members (core/career.js): the same people, faces and
 * badges every day. Now and then someone turns up with a borrowed badge.
 * Visitors either have an appointment on today's list or (NOT_ON_LIST_CHANCE)
 * don't.
 */
import { Person } from '../entities/Person.js';
import { typeFromCode, PersonType } from '../config/entityTypes.js';
import { weighted, chance, rangeOf, uid, pick } from '../core/rng.js';
import { idCardFor, badgeExpired, impostorAppearance, makeRosterMember, addDays, addMonths } from './credentials.js';
import { SPAWN_POINT } from '../data/layout.js';
import { clockMinutes } from '../core/clock.js';
import { visitorGreeting } from '../data/greetings.js';
import { shiftDurationSeconds } from '../core/clock.js';
import { saveCareer } from '../core/career.js';

export class ArrivalSystem {
  constructor(game) {
    this.game = game;
    this.timer = 0.5;
    this.crewQueue = this.#crewCodes(game.settings.DUTY_OFFICERS);
    this.arrivedToday = new Set(); // roster ids already here (nobody arrives twice)
    this.crewInbound = 0; // duty crew still parking: everyone else waits so the crew is first in line
  }

  /** The duty crew: each officer drives in alone. */
  #crewCodes(n) {
    return Array.from({ length: n }, () => 'O');
  }

  /** Duty officers already hired this shift (in line, at desk, or on duty). */
  #dutyCount() {
    return this.game.people.filter((p) => p.isDuty && !p.removed).length;
  }

  /** Someone from the roster who hasn't come in yet today (or a new hire). */
  #rosterMember(type) {
    const g = this.game;
    const mine = g.career.roster.filter((m) => m.type === type.code);
    let pool = mine.filter((m) => !this.arrivedToday.has(m.id));
    // Long shifts: once everyone has been in, people who've gone again can come back.
    if (!pool.length) pool = mine.filter((m) => !g.people.some((p) => p.roster === m));
    let member = pool.length ? pick(pool) : null;
    if (!member) {
      member = makeRosterMember(type, { name: g.names.next(), date: g.date, months: g.settings.BADGE_VALID_MONTHS });
      g.career.roster.push(member);
      saveCareer(g.career);
    }
    this.arrivedToday.add(member.id);
    return member;
  }

  #makePerson(type, origin, i, { crew }) {
    const g = this.game;
    const position = { x: origin.x - i * 1.2, z: origin.z + (i ? 1.4 : 0) };
    if (type === PersonType.GUEST) {
      const s = g.settings;
      const listed = !chance(s.NOT_ON_LIST_CHANCE);
      const timing = chance(s.EARLY_VISITOR_CHANCE) ? 'early' : chance(s.LATE_VISITOR_CHANCE) ? 'late' : 'on-time';
      return this.#visitor({ listed, timing, late: !listed && chance(s.LATE_ADDITION_CHANCE) }, position);
    }
    const isDuty = type === PersonType.OFFICER && (crew || this.#dutyCount() < g.settings.DUTY_OFFICERS);
    const member = this.#rosterMember(type);
    const borrowed = !isDuty && chance(g.settings.BORROWED_BADGE_CHANCE);
    const person = new Person(g, type, {
      name: member.name,
      valid: !borrowed,
      isDuty,
      position,
      appearance: borrowed ? impostorAppearance(member) : member.appearance,
    });
    person.roster = member;
    person.idCard = idCardFor(member, { borrowed });
    person.badge = borrowed ? 'borrowed' : badgeExpired(member, g.date) ? 'expired' : 'ok';
    return person;
  }

  /**
   * Tutorial: a group with exactly the credentials asked for, walking in from
   * the entrance. specs: [{ code: 'E'|'O'|'G', badge?: 'ok'|'expired'|'borrowed',
   * duty?: true, listed?: false, late?: true }]
   */
  spawnScripted(specs) {
    const g = this.game;
    const group = { id: uid('grp'), code: specs.map((x) => x.code).join(''), members: [], patience: 0, slot: -1, arrived: 0 };
    specs.forEach((spec, i) => {
      const person = this.makeScripted(spec, { x: SPAWN_POINT.x - i * 1.2, z: SPAWN_POINT.z + (i ? 1.4 : 0) });
      person.group = group;
      group.members.push(person);
    });
    g.queue.join(group);
    return group;
  }

  /** A visitor: on today's list (arriving on time / early / late) or not. */
  #visitor({ listed, timing, late }, position, { add = false } = {}) {
    const g = this.game;
    const now = clockMinutes(g.time, g.settings);
    // Visitors with an appointment come from today's book; the rest are not on it.
    const appointment = listed ? g.appointments.takeValid({ now, timing, grace: g.settings.APPOINTMENT_GRACE_MINUTES }) : null;
    const name = appointment ? appointment.name : g.appointments.fakeName();
    const person = new Person(g, PersonType.GUEST, { name, valid: listed, position });
    person.appointment = appointment;
    person.lateAddition = late;
    person.greeting = visitorGreeting(person, { now, timing, hosts: g.career.roster.filter((m) => m.type === 'E') });
    if (add) g.addPerson(person);
    return person;
  }

  /** One scripted person (see spawnScripted), added to the game at `position`. */
  makeScripted(spec, position) {
    const g = this.game;
    const type = typeFromCode(spec.code);
    let person;
    if (type === PersonType.GUEST) {
      person = this.#visitor({ listed: spec.listed !== false, timing: spec.timing ?? 'on-time', late: !!spec.late }, position, { add: false });
    } else {
      const member = this.#rosterMember(type);
      const badge = spec.badge ?? 'ok';
      const borrowed = badge === 'borrowed';
      person = new Person(g, type, {
        name: member.name,
        valid: !borrowed,
        isDuty: !!spec.duty,
        position,
        appearance: borrowed ? impostorAppearance(member) : member.appearance,
      });
      person.roster = member;
      const card = idCardFor(member, { borrowed });
      if (badge === 'expired') {
        card.expires = addDays(g.date, -19);
        card.issued = addMonths(card.expires, -g.settings.BADGE_VALID_MONTHS);
      } else if (badgeExpired(member, g.date)) {
        card.issued = addDays(g.date, -30); // (the lesson wants a valid badge here)
        card.expires = addMonths(card.issued, g.settings.BADGE_VALID_MONTHS);
      }
      person.idCard = card;
      person.badge = badge;
    }
    g.addPerson(person);
    g.restrooms.schedule(person);
    return person;
  }

  /**
   * A group arrives together, but officers always drive their own car (never
   * with another officer, an employee or a visitor); everyone else in the
   * group shares one. The group lines up once every car has parked.
   */
  spawnGroup(code, { crew = false } = {}) {
    const g = this.game;
    const group = { id: uid('grp'), code, members: [], patience: 0, slot: -1, arrived: 0 };
    const letters = [...code];
    const others = letters.filter((c) => c !== 'O');
    const parties = [...letters.filter((c) => c === 'O').map((c) => [c]), ...(others.length ? [others] : [])];
    const parked = [];
    if (crew) this.crewInbound += 1;
    for (const party of parties) {
      g.parking.arrive((origin, car) => {
        parked.push({ party, origin, car });
        if (parked.length < parties.length) return;
        if (crew) this.crewInbound -= 1;
        if (g.ended) return;
        for (const p of parked) {
          p.party.forEach((c, i) => {
            const person = this.#makePerson(typeFromCode(c), p.origin, i, { crew });
            person.group = group;
            person.car = p.car;
            p.car?.riders.add(person);
            group.members.push(person);
            g.addPerson(person);
            g.restrooms.schedule(person);
          });
        }
        g.queue.join(group);
      });
    }
    return group;
  }

  update(dt) {
    const g = this.game;
    if (g.features.scripted || g.time >= shiftDurationSeconds(g.settings)) return; // the tutorial spawns its own
    this.timer -= dt;
    // Cars still pulling in count toward the line, so it never overfills.
    if (this.timer > 0 || g.queue.line.length + g.parking.inbound >= g.queue.capacity) return;

    if (this.crewQueue.length) {
      this.spawnGroup(this.crewQueue.shift(), { crew: true });
      this.timer = 1.6;
      return;
    }
    if (this.crewInbound > 0) return;
    const rush = g.time < shiftDurationSeconds(g.settings) * g.settings.RUSH_HOUR_FRACTION;
    const mix = rush ? g.level.mix.rush : g.level.mix.day;
    this.spawnGroup(weighted(mix));
    this.timer = rangeOf(g.settings.ARRIVAL_INTERVAL);
  }
}
