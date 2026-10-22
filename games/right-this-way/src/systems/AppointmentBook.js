/*
 * Today's visitor appointments - what the "visitor management" computer at
 * the desk shows. Real visitors are drawn from this list; visitors with no
 * appointment get names that are NOT on it (sometimes sharing a last name
 * with someone who is, to keep the player honest).
 *
 * Hosts are real employees from the roster: when a visitor is escorted in,
 * their host (if they're in the building and free) comes to meet them.
 * Some appointments are service visits (server room, IT, records) where the
 * escort has to stay for the whole visit.
 */
import { MEETING_ROOMS } from '../data/layout.js';
import { DEPARTMENTS } from '../data/names.js';
import { pick, chance } from '../core/rng.js';
import { appointmentTiming } from './rules.js';

/** A random quarter-hour (in minutes) between `from` and `to`. */
function quarterHourIn(from, to) {
  const first = Math.ceil(from / 15);
  const last = Math.max(first, Math.floor(to / 15));
  return (first + Math.floor(Math.random() * (last - first + 1))) * 15;
}

const EARLY_LATE_RANGE = 90; // early / late visitors are at most this many minutes off

/** A quarter-hour that makes a visitor arriving at `now` on time / early / late. */
function quarterHourFor(timing, now, grace) {
  if (timing === 'early') return quarterHourIn(now + grace + 15, now + EARLY_LATE_RANGE);
  if (timing === 'late') return quarterHourIn(now - EARLY_LATE_RANGE, now - grace - 15);
  return quarterHourIn(now, now + grace); // a few minutes ahead: parking and walking in take time
}

const SERVICE_SHARE = 0.2; // appointments that are service visits
import { lastFirst } from '../core/namePool.js';

export class AppointmentBook {
  /**
   * @param {import('../core/namePool.js').NamePool} names
   * @param {{ size:number, startMinutes:number, lengthMinutes:number, hosts?:Array<{id,name,department}> }} opts
   */
  constructor(names, { size, startMinutes, lengthMinutes, hosts = [] }) {
    this.names = names;
    this.hosts = hosts;
    this.startMinutes = startMinutes;
    this.lengthMinutes = lengthMinutes;
    this.entries = [];
    for (let i = 0; i < size; i++) this.#add();
  }

  #add(name = this.names.next()) {
    const service = chance(SERVICE_SHARE);
    const room = pick(MEETING_ROOMS.filter((r) => !!r.service === service));
    const minutes = this.startMinutes + Math.floor((Math.random() * this.lengthMinutes) / 15) * 15;
    const host = this.hosts.length ? pick(this.hosts) : { id: null, name: this.names.next(), department: pick(DEPARTMENTS) };
    const entry = {
      name,
      host: host.name,
      hostId: host.id,
      department: host.department,
      room: room.room,
      roomLabel: room.label,
      service: room.service ?? null, // e.g. 'Rack maintenance'
      minutes,
      arrived: false,
    };
    this.entries.push(entry);
    return entry;
  }

  /**
   * An appointment for a visitor who really is expected, arriving `timing`
   * ('on-time' | 'early' | 'late', see rules.appointmentTiming) at clock time
   * `now` (minutes). Uses an entry that already fits, or moves one to a
   * quarter-hour that does.
   */
  takeValid({ now = null, timing = 'on-time', grace = 15 } = {}) {
    const open = this.entries.filter((e) => !e.arrived);
    let entry;
    if (now === null) {
      entry = open.length ? pick(open) : this.#add();
    } else {
      // On time = due within `grace` from now (never already past: the walk in would make them
      // late). Early / late = more than `grace` out, but within EARLY_LATE_RANGE.
      const fits = (e) =>
        timing === 'on-time'
          ? e.minutes >= now && e.minutes <= now + grace
          : appointmentTiming(e.minutes, now, grace) === timing && Math.abs(e.minutes - now) <= EARLY_LATE_RANGE;
      entry = pick(open.filter(fits)) ?? pick(open) ?? this.#add();
      if (!fits(entry)) entry.minutes = quarterHourFor(timing, now, grace);
    }
    entry.arrived = true;
    return entry;
  }

  /** Security agreed a new time with a late visitor's host. */
  reschedule(entry, now) {
    entry.minutes = quarterHourIn(now + 30, now + 75);
    entry.rescheduled = true;
    return entry;
  }

  /**
   * Security confirmed a visitor who wasn't on the list: add them now. A new
   * entry is booked for when they arrived (`around`), so they're on time.
   */
  addLate(name, around = null) {
    let entry = this.find(name);
    if (!entry) {
      entry = this.#add(name);
      if (around !== null) entry.minutes = quarterHourIn(around, around + 14);
    }
    entry.arrived = true;
    entry.late = true;
    return entry;
  }

  /** A name for a visitor who is NOT on the list. */
  fakeName() {
    if (chance(0.5) && this.entries.length) {
      const last = pick(this.entries).name.split(' ').pop();
      return this.names.next({ last });
    }
    return this.names.next();
  }

  find(name) {
    return this.entries.find((e) => e.name === name) ?? null;
  }

  /** Entries sorted by last name, as the desk computer lists them. */
  sorted() {
    return [...this.entries].sort((a, b) => lastFirst(a.name).localeCompare(lastFirst(b.name)));
  }
}
