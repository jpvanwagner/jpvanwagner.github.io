/*
 * Officers, escorts and visits.
 *
 * Duty officers (the escort pool) are free between jobs. A visitor group has
 * a `visit` that follows them from the desk to the door:
 *
 *   pickup   -> an officer walks to the visitors (desk, waiting seat, lounge,
 *               or a wandering visitor it has to catch). Desk / waiting-area
 *               pickups go through the pass check (race-condition freeze).
 *   toRoom   -> the escort walks them to the room on their appointment.
 *   handoff  -> meeting rooms: their host (a real employee from the roster,
 *               or a colleague standing in) meets them there and the escort
 *               is free to go. No host around? The escort leaves them in a
 *               lounge (breakroom / cafeteria) to wait instead.
 *               Service rooms (server room, IT, records): nobody hosts them,
 *               so the escort stands by for the whole visit.
 *   meeting  -> they sit for VISIT_DURATION.
 *   out      -> their host (or the escort) walks them out - or, sometimes,
 *               the host leaves them in a lounge "until someone from security
 *               comes to walk you out".
 *   lounge   -> left unattended: fine, as long as someone fetches them within
 *               LOUNGE_PATIENCE_MINUTES (in-game). A guard fetched from the
 *               Waiting panel or a camera takes them on to their meeting (if
 *               their host is free), out (if they're done) or to the waiting
 *               area. Left too long, they get restless and wander.
 *
 * Hosts who arrived WITH their visitor at the desk lead them all the way.
 * Caught wanderers are walked straight out. Two smaller officer jobs live
 * here too: a check-in (e.g. on an employee running a drill) and walking a
 * visitor to the restroom and back.
 */
import { DESK_PICKUP, EXIT_POINT, MEETING_ROOMS, OFFICER_POSTS, LOUNGES, WAITING_CHECKIN_SPOTS } from '../data/layout.js';
import { PersonState } from '../entities/Person.js';
import { rangeOf, chance, pick, uid } from '../core/rng.js';
import { SYSTEM_TEXT } from '../data/incidentText.js';

const CATCH_DISTANCE = 2.4;
const REPATH_INTERVAL = 0.6;
const HANDOFF_DISTANCE = 4;
const HOST_WAIT = 25; // seconds an escort waits for a host before standing in

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const firstName = (p) => p.name.split(' ')[0];

export class EscortSystem {
  constructor(game) {
    this.game = game;
    this.officers = []; // duty officers (escort pool)
    this.jobs = []; // officer jobs: escort pickups, check-ins, restroom walks
    this.visits = []; // every visitor group past the desk
    this.hold = false; // tutorial: pretend nobody is free (to show the waiting area)
  }

  /** A duty officer cleared at the desk joins the pool and heads to a post. */
  register(officer) {
    const g = this.game;
    this.officers.push(officer);
    officer.post = g.spots.reserveAny(OFFICER_POSTS, officer);
    this.returnToDuty(officer);
    g.bus.emit('officers');
  }

  /** Officer is free again: head for the post (OfficerRoutineSystem takes it from there). */
  returnToDuty(officer) {
    officer.job = null;
    officer.state = PersonState.IDLE;
    officer.status = '';
    officer.post ??= this.game.spots.reserveAny(OFFICER_POSTS, officer) ?? OFFICER_POSTS[0];
    officer.walkTo(officer.post, {
      onArrive: () => (officer.mesh.rotation.y = Math.PI),
    });
    this.game.bus.emit('officers');
  }

  /** A free officer - the closest one to `near` if given (officers roam, so distance matters). */
  idleOfficer(near = null) {
    if (this.hold) return null;
    const free = this.officers.filter((o) => !o.removed && o.state === PersonState.IDLE && !o.job);
    if (!near || free.length < 2) return free[0] ?? null;
    return free.reduce((best, o) => (dist(o.pos, near) < dist(best.pos, near) ? o : best));
  }

  get availableCount() {
    if (this.hold) return 0;
    return this.officers.filter((o) => !o.removed && o.state === PersonState.IDLE && !o.job).length;
  }

  /** Visitors left unattended in a lounge (Waiting panel lists them). */
  get lounging() {
    return this.visits.filter((v) => v.phase === 'lounge');
  }

  // -------------------------------------------------------------------------
  // Visits
  // -------------------------------------------------------------------------

  visitFor(guests) {
    let visit = guests[0].visit;
    if (!visit) {
      visit = {
        id: uid('visit'),
        guests,
        appointment: guests.find((m) => m.appointment)?.appointment ?? null,
        phase: 'arriving',
        done: false, // meeting finished: next stop is the exit
        leader: null, // whoever is responsible for them right now
        room: null,
        seats: [],
        hostSpot: null,
        host: null,
        lounge: null,
        timer: 0,
      };
      guests.forEach((m) => (m.visit = visit));
      this.visits.push(visit);
    }
    return visit;
  }

  #dropVisit(visit) {
    const g = this.game;
    this.#releaseSeats(visit);
    visit.phase = 'gone';
    this.visits = this.visits.filter((v) => v !== visit);
    visit.guests.forEach((m) => (m.visit = null));
    g.bus.emit('waiting');
  }

  #releaseSeats(visit) {
    const g = this.game;
    visit.seats.forEach((s) => g.spots.release(s));
    visit.seats = [];
    if (visit.hostSpot) g.spots.release(visit.hostSpot);
    visit.hostSpot = null;
  }

  #present(visit) {
    return visit.guests.filter((m) => !m.removed);
  }

  /** Someone is responsible for these visitors now: they follow, with the dashed tether. */
  #lead(visit, leader) {
    visit.leader = leader;
    this.#present(visit).forEach((m, i) => {
      m.state = PersonState.ESCORTED;
      m.targetedBy = null;
      m.patience = 0;
      m.away = false; // (a restroom trip in progress ends here: they're with their escort now)
      m.trip = null;
      m.unescortedTrip = false;
      this.game.spots.releaseAll(m);
      m.follow(leader, i);
      m.tetherTo = leader;
    });
  }

  /** Visitors walk over to their leader, then follow (after a meeting / lounge). */
  #regroup(visit, leader, then) {
    const guests = this.#present(visit);
    let ready = 0;
    visit.leader = leader;
    guests.forEach((m, i) => {
      m.tetherTo = leader;
      m.walkTo(
        { x: leader.pos.x + (i === 0 ? 1.4 : -1.4), z: leader.pos.z + 1.2 },
        {
          onArrive: () => {
            ready += 1;
            if (ready >= guests.length) {
              this.#lead(visit, leader);
              then();
            }
          },
        },
      );
    });
    if (!guests.length) then();
  }

  /** Release whoever was leading: officers back to duty, employees back to work. */
  #release(person) {
    const g = this.game;
    if (!person || person.removed) return;
    person.job = null;
    if (this.officers.includes(person)) this.returnToDuty(person);
    else if (person.isDuty) this.register(person); // duty officer who arrived hosting a visitor
    else if (person.isEmployee) g.staff.returnToWork(person);
    else g.leave(person); // visiting officer
  }

  // -------------------------------------------------------------------------
  // Officer jobs
  // -------------------------------------------------------------------------

  /** Send an officer to collect visitors. source: 'desk' | 'waiting' | 'lounge' | 'wander'. */
  dispatch(officer, guests, { source }) {
    const visit = source === 'wander' ? null : this.visitFor(guests);
    const job = { kind: 'escort', escort: officer, guests, visit, source, phase: 'toPickup', repath: 0, timer: 0 };
    this.jobs.push(job);
    officer.job = job;
    officer.state = PersonState.RESPONDING;
    officer.status = 'Responding';
    guests.forEach((m) => (m.targetedBy = officer));

    if (source === 'desk') {
      officer.walkTo(DESK_PICKUP, { onArrive: () => this.#pickup(job) });
    } else if (source === 'waiting' || source === 'lounge') {
      const p = guests[0].pos;
      if (!officer.walkTo({ x: p.x, z: p.z - 2 }, { onArrive: () => this.#pickup(job) })) officer.walkTo(p, { onArrive: () => this.#pickup(job) });
    } else {
      job.repath = 0; // wander: chase in update()
    }
    this.game.bus.emit('officers');
    this.game.bus.emit('waiting');
    return job;
  }

  /** A guard goes to visitors left in a lounge and takes them on. */
  fetchFromLounge(visit) {
    if (visit.phase !== 'lounge' || visit.fetching || visit.guests.some((m) => m.away)) return false;
    const officer = this.idleOfficer(visit.guests[0].pos);
    if (!officer) return false;
    visit.fetching = officer;
    this.dispatch(officer, this.#present(visit), { source: 'lounge' });
    return true;
  }

  /** Seat visitors in the nearest lounge, unattended (the tutorial stages this). */
  placeInLounge(guests, { done = false } = {}) {
    const g = this.game;
    const visit = this.visitFor(guests);
    visit.done = done;
    visit.leader = guests[0];
    const lounge = this.#loungeFor(visit);
    if (!lounge) return null;
    visit.phase = 'lounge';
    visit.lounge = guests.map((m) => g.spots.reserveAny(lounge.seats, m));
    visit.loungeRoom = lounge;
    visit.timer = rangeOf(g.settings.LOUNGE_PATIENCE_MINUTES) / g.settings.CLOCK_MINUTES_PER_SECOND;
    visit.timerMax = visit.timer;
    visit.leader = null;
    guests.forEach((m, i) => {
      m.state = PersonState.LOUNGING;
      m.status = done ? 'Waiting to be walked out' : 'Waiting for their host';
      m.teleport(visit.lounge[i].x, visit.lounge[i].z);
    });
    g.bus.emit('waiting');
    return visit;
  }

  /** Send an officer to check on someone (drill, suspicious behaviour) without escorting them. */
  dispatchCheckIn(officer, person) {
    const job = { kind: 'checkin', escort: officer, guests: [person], phase: 'toPickup', repath: 0, timer: 0 };
    this.jobs.push(job);
    officer.job = job;
    officer.state = PersonState.RESPONDING;
    officer.status = 'Responding';
    person.respondingOfficer = officer;
    this.game.bus.emit('officers');
    return job;
  }

  /** Walk to a propped door and shut it. */
  dispatchDoor(officer, door) {
    const job = { kind: 'door', escort: officer, guests: [], door };
    officer.job = job;
    officer.state = PersonState.RESPONDING;
    officer.status = `Closing the ${door.def.label} door`;
    officer.walkTo({ x: door.def.x, z: door.def.z }, {
      onArrive: () => {
        this.game.doors.close(door.def.id, officer);
        this.#release(officer);
      },
    });
    this.game.bus.emit('officers');
  }

  /** Walk a visitor to the nearest restroom and back to where they were. */
  dispatchRestroom(officer, guest) {
    const g = this.game;
    const target = g.restrooms.reserveFor(guest, { escorted: true });
    if (!target) return false;
    const job = { kind: 'restroom', escort: officer, guests: [guest], phase: 'toPickup', target, home: g.restrooms.homeFor(guest), repath: 0, timer: 0 };
    this.jobs.push(job);
    officer.job = job;
    officer.state = PersonState.RESPONDING;
    officer.status = `Restroom escort: ${firstName(guest)}`;
    guest.respondingOfficer = officer;
    g.score.count('restroomEscorts');
    officer.walkTo({ x: guest.pos.x, z: guest.pos.z - 1.5 }, { onArrive: () => this.#restroomPickup(job) });
    g.bus.emit('officers');
    return true;
  }

  /** Employee / visiting officer escorting the visitor they arrived with. */
  hostEscort(host, guests) {
    const visit = this.visitFor(guests);
    host.job = { kind: 'host', visit };
    host.state = PersonState.HOSTING;
    host.status = `Hosting ${firstName(guests[0])}`;
    visit.host = host;
    this.#lead(visit, host);
    this.#toRoom(visit, host);
  }

  #pickup(job) {
    if (job.phase !== 'toPickup') return;
    job.phase = 'handoff';
    const g = this.game;
    if (job.source === 'wander' || job.source === 'lounge') {
      this.#startEscort(job);
      return;
    }
    g.desk.requestHandoff(job.guests, () => this.#startEscort(job));
  }

  #endJob(job) {
    this.jobs = this.jobs.filter((j) => j !== job);
  }

  #startEscort(job) {
    const g = this.game;
    const { escort, guests, visit } = job;
    this.#endJob(job);
    escort.job = { kind: 'lead', visit };
    escort.state = PersonState.ESCORTING;
    escort.status = 'Escorting';

    if (job.source === 'wander') {
      // Caught: straight out, no meeting.
      const v = this.visitFor(guests);
      v.done = true;
      v.caught = true;
      this.#lead(v, escort);
      this.#toExit(v, escort);
      return;
    }
    if (job.source === 'waiting') {
      const wg = g.waiting.groupOf(guests[0]);
      if (wg) g.waiting.remove(wg);
    }
    visit.fetching = null;
    if (job.source === 'lounge') visit.fromLounge = true;
    if (visit.lounge) {
      visit.lounge.forEach((s) => g.spots.release(s));
      visit.lounge = null;
    }
    this.#lead(visit, escort);

    if (visit.done) return this.#toExit(visit, escort);
    if (job.source === 'lounge' && !this.#findHost(visit, { peek: true })) return this.#toWaiting(visit, escort);
    this.#toRoom(visit, escort);
    g.bus.emit('officers');
  }

  // -------------------------------------------------------------------------
  // Getting visitors where they're going
  // -------------------------------------------------------------------------

  #roomFor(visit) {
    const spots = this.game.spots;
    const n = this.#present(visit).length;
    const fits = (r) => spots.freeCount(r.seats) >= n && spots.freeCount(r.standby) > 0;
    const wanted = MEETING_ROOMS.find((r) => r.room === visit.appointment?.room);
    if (wanted && fits(wanted)) return wanted;
    const similar = MEETING_ROOMS.filter((r) => !!r.service === !!wanted?.service && fits(r));
    return pick(similar) ?? pick(MEETING_ROOMS.filter(fits)) ?? null;
  }

  /**
   * The visitor's host if they're in the building and free, else (sometimes)
   * a colleague standing in. `peek` only checks.
   */
  #findHost(visit, { peek = false } = {}) {
    const g = this.game;
    const free = (p) => !p.removed && p.isEmployee && p.state === PersonState.WORKING && !p.job && p.inside;
    const hostId = visit.appointment?.hostId;
    const host = g.people.find((p) => p.roster?.id === hostId && free(p)) ?? null;
    if (host || peek) return host ?? g.people.find(free) ?? null;
    // A guard fetched them from a lounge because someone is free: use them.
    if (visit.fromLounge || chance(g.settings.HOST_STAND_IN_CHANCE)) return pick(g.people.filter(free)) ?? null;
    return null;
  }

  #toRoom(visit, leader) {
    const g = this.game;
    const room = this.#roomFor(visit);
    if (!room) return this.#toLounge(visit, leader) || this.#toExit(visit, leader); // nowhere to sit at all
    visit.room = room;
    visit.phase = 'toRoom';
    visit.seats = this.#present(visit).map((m) => g.spots.reserveAny(room.seats, m, { random: true }));
    visit.hostSpot = g.spots.reserveAny(room.standby, visit);

    const isOfficerEscort = leader.isOfficer && leader.job?.kind === 'lead';
    if (!room.service && isOfficerEscort && !visit.host) {
      const host = this.#findHost(visit);
      if (host) {
        this.#summonHost(visit, host, room);
      } else if (this.#loungeFor(visit)) {
        // Host isn't around: leave them somewhere comfortable instead.
        this.#releaseSeats(visit);
        visit.room = null;
        return this.#toLounge(visit, leader);
      }
    }
    leader.status = room.service ? `Escorting (${room.service})` : 'Escorting';
    const where = visit.hostSpot ?? room.standby[0];
    const target = visit.host && visit.host !== leader ? { x: where.x + 1.6, z: where.z } : where;
    if (!leader.walkTo(target, { onArrive: () => this.#arriveRoom(visit, leader) })) leader.walkTo(where, { onArrive: () => this.#arriveRoom(visit, leader) });
    return true;
  }

  #summonHost(visit, host, room) {
    const g = this.game;
    g.spots.releaseAll(host);
    host.onBreak = false;
    host.breakSpot = null;
    host.job = { kind: 'host', visit };
    host.state = PersonState.HOSTING;
    host.status = `Meeting ${firstName(visit.guests[0])}`;
    visit.host = host;
    host.walkTo(visit.hostSpot ?? room.standby[0]);
  }

  #arriveRoom(visit, leader) {
    const g = this.game;
    visit.phase = 'meeting';
    visit.timer = rangeOf(g.settings.VISIT_DURATION);
    visit.waited = 0;
    this.#present(visit).forEach((m, i) => {
      m.unfollow();
      m.state = PersonState.VISITING;
      m.status = visit.room.service ?? 'In a meeting';
      const seat = visit.seats[i];
      if (seat) m.walkTo(seat, { onArrive: () => (m.mesh.rotation.y = m.pos.z < (visit.hostSpot?.z ?? m.pos.z) ? 0 : Math.PI) });
    });
    if (leader === visit.host) {
      leader.status = `Hosting ${firstName(visit.guests[0])}`;
      if (visit.hostSpot) leader.walkTo(visit.hostSpot);
    } else if (visit.room.service || !visit.host) {
      // Service visit (or nobody to hand over to): the escort stays.
      leader.status = 'Standing by';
      visit.host = null;
    } else {
      leader.status = 'Handing over';
      visit.handoffFrom = leader; // completes in update() once the host is here
    }
    g.bus.emit('officers');
  }

  #handOver(visit) {
    const officer = visit.handoffFrom;
    visit.handoffFrom = null;
    visit.leader = visit.host;
    this.#present(visit).forEach((m) => (m.tetherTo = visit.host));
    visit.host.status = `Hosting ${firstName(visit.guests[0])}`;
    this.#release(officer);
  }

  /** Nearest lounge with room for the whole group (null if none). */
  #loungeFor(visit) {
    const spots = this.game.spots;
    const n = this.#present(visit).length;
    const from = visit.leader?.pos ?? visit.guests[0].pos;
    const options = LOUNGES.filter((l) => spots.freeCount(l.seats) >= n);
    if (!options.length) return null;
    return options.reduce((best, l) => (dist(l.seats[0], from) < dist(best.seats[0], from) ? l : best));
  }

  /** Leave the visitors in a lounge, unattended. Returns false if there's no room. */
  #toLounge(visit, leader) {
    const g = this.game;
    const lounge = this.#loungeFor(visit);
    if (!lounge) return false;
    const guests = this.#present(visit);
    visit.phase = 'toLounge';
    visit.lounge = guests.map((m) => g.spots.reserveAny(lounge.seats, m));
    visit.loungeRoom = lounge;
    leader.status = `To the ${lounge.label.toLowerCase()}`;
    const seat = visit.lounge[0];
    leader.walkTo({ x: seat.x, z: seat.z + (seat.z < -10 ? 2.4 : -2.2) }, {
      onArrive: () => {
        visit.phase = 'lounge';
        const minutes = rangeOf(g.settings.LOUNGE_PATIENCE_MINUTES);
        visit.timer = minutes / g.settings.CLOCK_MINUTES_PER_SECOND;
        visit.timerMax = visit.timer;
        visit.leader = null;
        guests.forEach((m, i) => {
          m.unfollow();
          m.tetherTo = null;
          m.state = PersonState.LOUNGING;
          m.status = visit.done ? 'Waiting to be walked out' : 'Waiting for their host';
          m.walkTo(visit.lounge[i]);
        });
        if (visit.host === leader) visit.host = null;
        this.#release(leader);
        g.incidents.create(guests[0], 'info', SYSTEM_TEXT.leftInLounge(lounge.label));
        g.bus.emit('waiting');
      },
    });
    return true;
  }

  /** No host free: the guard parks them in the waiting area until one is. */
  #toWaiting(visit, leader) {
    const g = this.game;
    if (g.waiting.freeSeats() < this.#present(visit).length) return this.#toRoom(visit, leader);
    visit.phase = 'toWaiting';
    leader.status = 'To the waiting area';
    leader.walkTo(WAITING_CHECKIN_SPOTS[0], {
      onArrive: () => {
        const guests = this.#present(visit);
        guests.forEach((m) => {
          m.unfollow();
          m.tetherTo = null;
        });
        visit.phase = 'arriving';
        visit.leader = null;
        g.waiting.add(guests);
        this.#release(leader);
      },
    });
    return true;
  }

  #toExit(visit, leader) {
    const g = this.game;
    this.#releaseSeats(visit);
    visit.phase = 'out';
    visit.done = true;
    leader.status = 'Escorting out';
    leader.walkTo(EXIT_POINT, { onArrive: () => this.#complete(visit, leader) });
    g.bus.emit('officers');
    return true;
  }

  #endMeeting(visit) {
    const g = this.game;
    const leader = visit.host ?? visit.leader;
    visit.done = true;
    if (!leader || leader.removed) {
      // Nobody with them (shouldn't happen): they wait in a lounge for security.
      return this.#toLounge(visit, visit.guests[0]);
    }
    const hostEmployee = leader.isEmployee;
    this.#releaseSeats(visit);
    this.#regroup(visit, leader, () => {
      if (hostEmployee && chance(g.settings.LOUNGE_AFTER_MEETING_CHANCE) && this.#toLounge(visit, leader)) return;
      this.#toExit(visit, leader);
    });
    visit.phase = 'regroup';
  }

  #complete(visit, leader) {
    const g = this.game;
    for (const m of this.#present(visit)) {
      if (!visit.caught && m.valid) {
        g.score.count('visitsCompleted');
        g.score.add(g.settings.SCORE.VISIT_COMPLETED, 'Visit completed', m.pos);
      }
      m.tetherTo = null;
      g.leave(m); // on to their car
    }
    this.#dropVisit(visit);
    if (visit.host === leader) visit.host = null;
    this.#release(leader);
    g.bus.emit('officers');
  }

  // -------------------------------------------------------------------------
  // Restroom walks
  // -------------------------------------------------------------------------

  #restroomPickup(job) {
    const { escort, guests, target } = job;
    const guest = guests[0];
    if (guest.removed) return this.#finishRestroom(job);
    job.phase = 'toRestroom';
    guest.away = true;
    guest.state = PersonState.RESTROOM;
    guest.status = 'Restroom (escorted)';
    guest.follow(escort, 0);
    guest.tetherTo = escort;
    escort.status = `Restroom escort: ${firstName(guest)}`;
    escort.walkTo(target.restroom.waitAt, {
      onArrive: () => {
        job.phase = 'inside';
        guest.unfollow();
        guest.walkTo(target.spot, { onArrive: () => (job.timer = rangeOf(this.game.settings.RESTROOM_TIME)) });
        job.timer = 99; // set once they reach the stall
      },
    });
  }

  #restroomReturn(job) {
    const { escort, guests, target } = job;
    const guest = guests[0];
    this.game.spots.release(target.spot);
    job.phase = 'back';
    guest.walkTo(escort.pos, {
      onArrive: () => {
        guest.follow(escort, 0);
        escort.walkTo({ x: job.home.x, z: job.home.z + (job.home.z < -10 ? 2 : -2) }, { onArrive: () => this.#finishRestroom(job) });
      },
    });
  }

  #finishRestroom(job) {
    const { escort, guests } = job;
    const guest = guests[0];
    this.#endJob(job);
    guest.respondingOfficer = null;
    if (!guest.removed) this.game.restrooms.backFromTrip(guest);
    this.#release(escort);
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------

  #updateCheckIn(job, dt) {
    const officer = job.escort;
    const target = job.guests[0];
    const done = () => {
      target.respondingOfficer = null;
      this.#endJob(job);
      officer.job = null;
      this.returnToDuty(officer);
    };
    if (target.removed) return done();
    if (job.phase === 'toPickup') {
      if (dist(target.pos, officer.pos) < CATCH_DISTANCE + 0.6) {
        officer.stop();
        officer.status = `Checking on ${firstName(target)}`;
        job.phase = 'checking';
        job.timer = 2.5;
        return;
      }
      job.repath -= dt;
      if (job.repath <= 0 || !officer.path.length) {
        job.repath = REPATH_INTERVAL;
        officer.walkTo(target.pos);
      }
    } else if (job.phase === 'checking') {
      job.timer -= dt;
      if (job.timer <= 0) done();
    }
  }

  #updateVisit(visit, dt) {
    const g = this.game;
    const guests = this.#present(visit);
    if (!guests.length) return this.#dropVisit(visit);

    if (visit.phase === 'meeting') {
      if (visit.handoffFrom) {
        visit.waited += dt;
        const host = visit.host;
        if (!host || host.removed) {
          visit.host = null;
          visit.handoffFrom.status = 'Standing by';
          visit.handoffFrom = null;
        } else if (dist(host.pos, visit.handoffFrom.pos) < HANDOFF_DISTANCE + 4 && !host.path.length) {
          this.#handOver(visit);
        } else if (visit.waited > HOST_WAIT) {
          // Host never showed: the escort stays with them after all.
          host.job = null;
          g.staff.returnToWork(host);
          visit.host = null;
          visit.handoffFrom.status = 'Standing by';
          visit.handoffFrom = null;
        }
        return;
      }
      if (guests.some((m) => m.away || m.path.length)) return; // someone's in the restroom / still sitting down
      visit.timer -= dt;
      if (visit.timer <= 0) this.#endMeeting(visit);
    } else if (visit.phase === 'lounge') {
      if (visit.fetching || guests.some((m) => m.away)) return;
      visit.timer -= dt;
      if (visit.timer <= 0) {
        // Got restless: off they go to explore.
        this.#dropVisit(visit);
        visit.lounge?.forEach((s) => g.spots.release(s));
        for (const m of guests) {
          g.incidents.create(m, 'info', SYSTEM_TEXT.restless(visit.loungeRoom?.label ?? 'lounge'));
          g.wander.admit(m);
        }
      }
    }
  }

  update(dt) {
    for (const job of [...this.jobs]) {
      if (job.kind === 'checkin') {
        this.#updateCheckIn(job, dt);
        continue;
      }
      if (job.kind === 'restroom') {
        if (job.phase === 'inside' && !job.guests[0].path.length) {
          job.timer -= dt;
          if (job.timer <= 0) this.#restroomReturn(job);
        }
        continue;
      }
      if (job.phase === 'toPickup' && job.source === 'wander') {
        const target = job.guests[0];
        const officer = job.escort;
        if (target.removed) {
          this.#endJob(job);
          this.returnToDuty(officer);
          continue;
        }
        if (dist(target.pos, officer.pos) < CATCH_DISTANCE) {
          officer.stop();
          this.#pickup(job);
          continue;
        }
        job.repath -= dt;
        if (job.repath <= 0 || !officer.path.length) {
          job.repath = REPATH_INTERVAL;
          officer.walkTo(target.pos);
        }
      }
    }
    for (const visit of [...this.visits]) this.#updateVisit(visit, dt);
  }
}
