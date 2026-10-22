/*
 * Incident log + incident response windows.
 *
 * Kinds:
 *   'guest' - unaccompanied visitor behaviour (random list 1). Needs a response.
 *   'drill' - employee response test (random list 2). Needs a response.
 *   'patrol'- an hourly patrol nobody is free to walk (see PatrolSystem). Resolves
 *             itself when an officer frees up; its window is the grace period.
 *   'restroom' - a visitor asking for a guard to walk them to the restroom
 *             (RestroomSystem). Missed: they go alone.
 *   'info'  - system notices (tailgating, race condition, forced door...). No window.
 *
 * Responding inside INCIDENT_WINDOW (3s) scores +INCIDENT_ADDRESSED; missing it
 * costs INCIDENT_MISSED x multiplier, where the multiplier doubles for every
 * unescorted visitor currently inside ("each one let through multiplies
 * incidents by 2"). The multiplier affects the penalty only, not frequency.
 *
 * Only an officer actually answers a visitor incident. Cameras just buy time:
 * while the visitor is deterred on camera, their incident windows are paused.
 */
import { formatClock, clockMinutes } from '../core/clock.js';
import { uid } from '../core/rng.js';
import { incidentMultiplier } from './rules.js';
import { cameraForRoom } from '../data/layout.js';
import { PersonState } from '../entities/Person.js';

const MAX_LOG = 80;

export const IncidentResponse = Object.freeze({
  DISPATCH: 'dispatch',
  CAMERA: 'camera',
  ACKNOWLEDGE: 'acknowledge',
});

export class IncidentSystem {
  constructor(game) {
    this.game = game;
    this.list = []; // newest last
    this.multiplier = 1;
  }

  create(person, kind, text, { window, title, door = null } = {}) {
    const g = this.game;
    const needsResponse = kind !== 'info';
    const length = window ?? g.settings.INCIDENT_WINDOW;
    const incident = {
      id: uid('inc'),
      person,
      kind,
      text,
      time: formatClock(clockMinutes(g.time, g.settings)),
      room: person?.room ?? null,
      title: title ?? null, // shown instead of a person's name
      door, // 'door' incidents: which door is propped
      status: needsResponse ? 'open' : 'info',
      remaining: needsResponse ? length : 0,
      window: length,
    };
    this.list.push(incident);
    if (this.list.length > MAX_LOG) this.list.splice(0, this.list.length - MAX_LOG);
    g.bus.emit('incidents');
    return incident;
  }

  get open() {
    return this.list.filter((i) => i.status === 'open');
  }

  /** The open incident closest to expiring (drives the "Incident Response" bar). */
  get mostUrgent() {
    return this.open
      .filter((i) => !this.isPaused(i))
      .reduce((best, i) => (!best || i.remaining < best.remaining ? i : best), null);
  }

  /** Response buttons available for an incident right now. */
  responsesFor(incident) {
    if (incident.status !== 'open') return [];
    if (incident.kind === 'drill') {
      const p = incident.person;
      if (p?.respondingOfficer) return [{ id: IncidentResponse.ACKNOWLEDGE, label: 'Officer en route', enabled: true }];
      const officer = this.game.escorts.idleOfficer(p?.pos);
      return [
        { id: IncidentResponse.DISPATCH, label: 'Send officer', enabled: !!officer && !!p && !p.removed, hint: officer ? '' : 'No officer free' },
        { id: IncidentResponse.ACKNOWLEDGE, label: 'Acknowledge', enabled: true },
      ];
    }
    if (incident.kind === 'patrol') return [{ id: 'wait', label: 'Waiting for a free officer\u2026', enabled: false }];
    if (incident.kind === 'door') {
      const d = this.game.doors.get(incident.door);
      if (d?.officerEnRoute) return [{ id: IncidentResponse.ACKNOWLEDGE, label: 'Officer en route', enabled: true }];
      const officer = d && this.game.escorts.idleOfficer({ x: d.def.x, z: d.def.z });
      return [{ id: IncidentResponse.DISPATCH, label: 'Send officer to close', enabled: !!officer, hint: officer ? '' : 'No officer free' }];
    }
    if (incident.kind === 'restroom') {
      const p = incident.person;
      if (p?.respondingOfficer) return [{ id: IncidentResponse.ACKNOWLEDGE, label: 'Guard en route', enabled: true }];
      const officer = this.game.escorts.idleOfficer(p?.pos);
      return [{ id: IncidentResponse.DISPATCH, label: 'Send guard', enabled: !!officer && !!p && !p.removed, hint: officer ? '' : 'No officer free' }];
    }

    const p = incident.person;
    const out = [];
    const stillLoose = p && !p.removed && p.state === PersonState.WANDERING;
    if (stillLoose && p.targetedBy) {
      out.push({ id: IncidentResponse.ACKNOWLEDGE, label: 'Officer en route', enabled: true });
    } else if (stillLoose) {
      const officer = this.game.escorts.idleOfficer();
      out.push({ id: IncidentResponse.DISPATCH, label: 'Dispatch officer', enabled: !!officer, hint: officer ? '' : 'No officer free' });
    } else {
      out.push({ id: IncidentResponse.ACKNOWLEDGE, label: 'Acknowledge', enabled: true });
    }
    const cam = p && cameraForRoom(p.room);
    if (stillLoose && !p.targetedBy && cam) {
      const watching = this.game.cameras.active === cam;
      out.push({
        id: IncidentResponse.CAMERA,
        label: watching ? `On ${cam.id.replace('cam', 'Cam ')}` : `View ${cam.id.replace('cam', 'Cam ')}`,
        enabled: !watching,
        hint: 'Deters the visitor and pauses this timer; does not resolve it',
      });
    }
    return out;
  }

  /**
   * "Send guard" (incident buttons, camera view): the closest free officer
   * goes to this person. An unescorted visitor is caught and walked out; anyone
   * else (e.g. an employee running a drill) gets a check-in. Their open
   * incidents count as handled. Returns false if no officer is free.
   */
  sendOfficerTo(person, { resolve = true } = {}) {
    const g = this.game;
    if (!person || person.removed || person.targetedBy || person.respondingOfficer) return false;
    const officer = g.escorts.idleOfficer(person.pos);
    if (!officer) return false;
    const restroom = this.open.some((i) => i.person === person && i.kind === 'restroom');
    if (person.isGuest && person.state === PersonState.WANDERING) g.escorts.dispatch(officer, [person], { source: 'wander' });
    else if (person.isGuest && restroom) {
      if (!g.escorts.dispatchRestroom(officer, person)) return false;
    } else if (person.isGuest && person.state === PersonState.LOUNGING) {
      if (!g.escorts.fetchFromLounge(person.visit)) return false;
    } else g.escorts.dispatchCheckIn(officer, person);
    if (resolve) {
      const open = this.open.filter((i) => i.person === person);
      open.forEach((i, n) => this.resolve(i, 'addressed', { score: n === 0 }));
    }
    g.bus.emit('incidents');
    return true;
  }

  /** People worth sending a guard to: loose visitors and anyone with an open incident. */
  needsGuard(person) {
    if (!person || person.removed) return false;
    if (person.isGuest && person.state === PersonState.WANDERING) return true;
    if (person.isGuest && person.state === PersonState.LOUNGING && !person.visit?.fetching) return true;
    return this.open.some((i) => i.person === person);
  }

  /** A deterred visitor's incident clock stands still (cameras buy time). */
  isPaused(incident) {
    return incident.status === 'open' && incident.kind === 'guest' && !!incident.person?.observed;
  }

  respond(incidentId, responseId) {
    const incident = this.list.find((i) => i.id === incidentId);
    if (!incident || incident.status !== 'open') return;
    const option = this.responsesFor(incident).find((r) => r.id === responseId);
    if (!option?.enabled) return;

    const g = this.game;
    const p = incident.person;
    if (responseId === IncidentResponse.CAMERA) {
      // Buys time only: the incident stays open.
      g.cameras.view(cameraForRoom(p.room));
      return;
    }
    if (responseId === IncidentResponse.DISPATCH && incident.kind === 'door') {
      if (!g.doors.sendOfficer(incident.door)) return;
    } else if (responseId === IncidentResponse.DISPATCH) {
      if (!this.sendOfficerTo(p, { resolve: false })) return;
    }
    this.resolve(incident, 'addressed');
    // Responding to one incident covers that person's other open incidents too.
    if (p) for (const other of this.open.filter((i) => i.person === p)) this.resolve(other, 'addressed', { score: false });
  }

  /** Close an incident. `score: false` closes it without the +1 (e.g. auto-resolved). */
  resolve(incident, status, { score = true } = {}) {
    const g = this.game;
    if (incident.status !== 'open') return;
    incident.status = status;
    if (status === 'missed' && incident.kind === 'patrol') g.score.count('patrolsMissed');
    if (status === 'addressed') {
      g.score.count('incidentsAddressed');
      if (score) g.score.add(g.settings.SCORE.INCIDENT_ADDRESSED, 'Incident handled', incident.person?.pos);
    } else if (status === 'missed') {
      g.score.count('incidentsMissed');
      g.score.add(g.settings.SCORE.INCIDENT_MISSED * this.multiplier, 'Incident missed', incident.person?.pos);
    }
    g.bus.emit('incidents');
  }

  update(dt) {
    const g = this.game;
    const unescorted = g.people.filter((p) => p.state === PersonState.WANDERING || p.unescortedTrip).length;
    const m = incidentMultiplier(unescorted, g.settings);
    if (m !== this.multiplier) {
      this.multiplier = m;
      g.score.stats.peakMultiplier = Math.max(g.score.stats.peakMultiplier, m);
      g.bus.emit('incidents');
    }
    for (const incident of this.open) {
      if (this.isPaused(incident)) continue;
      incident.remaining -= dt;
      if (incident.remaining <= 0) this.resolve(incident, 'missed');
    }
  }
}
