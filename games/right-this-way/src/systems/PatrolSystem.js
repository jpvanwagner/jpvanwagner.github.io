/*
 * Hourly patrols. Every hour on the hour a free duty officer walks one of the
 * SET routes (layout.PATROL_ROUTES), in order, checking both ends of every
 * room on it. The routes alternate hour by hour, so two consecutive patrols
 * cover the whole facility. Checkpoint markers appear on the map and turn
 * green as they're checked.
 *
 * If nobody is free, a "patrol due" incident starts a PATROL_GRACE_MINUTES
 * countdown; the first officer to free up takes the patrol. If the grace
 * period runs out, the client is upset: it counts as an unaddressed incident
 * (-1 x multiplier).
 */
import { PersonState } from '../entities/Person.js';
import { PATROL_ROUTES } from '../data/layout.js';
import { clockMinutes, formatClock } from '../core/clock.js';
import { createRing } from '../world/meshes.js';

const MARK = { pending: 0x8a93a3, current: 0xf2c14e, done: 0x3fbf5f };

export class PatrolSystem {
  constructor(game) {
    this.game = game;
    const s = game.settings;
    this.next = Math.floor(s.SHIFT_START_MINUTES / s.PATROL_INTERVAL_MINUTES + 1) * s.PATROL_INTERVAL_MINUTES;
    this.pending = null; // { label, route, incident }
    this.routeIndex = 0; // which set route the next patrol walks
  }

  get minutes() {
    return clockMinutes(this.game.time, this.game.settings);
  }

  #start(officer, label, route) {
    const g = this.game;
    officer.state = PersonState.PATROLLING;
    officer.status = `Patrol: ${route.name}`;
    officer.patrol = { index: 0, pause: 0, label, route, markers: this.#makeMarkers(route) };
    this.#walk(officer);
    g.bus.emit('officers');
  }

  /** Checkpoint rings for the whole route (grey -> yellow while heading there -> green). */
  #makeMarkers(route) {
    return route.points.map((pt) => {
      const ring = createRing(MARK.pending, 0.75, 0.85);
      ring.position.set(pt.x, 0.07, pt.z);
      this.game.stage.dynamicRoot.add(ring);
      return ring;
    });
  }

  #mark(officer, i, state) {
    officer.patrol.markers[i]?.material.color.setHex(MARK[state]);
  }

  #clearMarkers(officer) {
    for (const m of officer.patrol?.markers ?? []) this.game.stage.dynamicRoot.remove(m);
  }

  #walk(officer) {
    const p = officer.patrol;
    const g = this.game;
    const target = p.route.points[p.index];
    this.#mark(officer, p.index, 'current');
    const ok = officer.walkTo(target, {
      speed: g.settings.WALK_SPEED * g.settings.PATROL_SPEED_MULT,
      onArrive: () => (p.pause = g.settings.PATROL_CHECKPOINT_PAUSE),
    });
    if (!ok) p.pause = 0.01; // unreachable (should never happen; the nav test checks): skip it
  }

  update(dt) {
    const g = this.game;
    const s = g.settings;
    if (g.features.scripted) return; // (the tutorial just explains patrols)

    // A new hour: schedule a patrol.
    if (this.minutes >= this.next) {
      const route = PATROL_ROUTES[this.routeIndex % PATROL_ROUTES.length];
      this.routeIndex += 1;
      this.pending = { label: formatClock(this.next), route, incident: null };
      this.next += s.PATROL_INTERVAL_MINUTES;
    }

    if (this.pending) {
      const officer = g.escorts.idleOfficer(this.pending.route.points[0]);
      const inc = this.pending.incident;
      if (inc && inc.status !== 'open') {
        this.pending = null; // grace period ran out (missed) - client already upset
      } else if (officer) {
        this.#start(officer, this.pending.label, this.pending.route);
        if (inc) g.incidents.resolve(inc, 'addressed', { score: false });
        this.pending = null;
      } else if (!inc) {
        this.pending.incident = g.incidents.create(
          null,
          'patrol',
          `The ${this.pending.label} patrol (${this.pending.route.name}) is due and no officer is free. Free one up within ${s.PATROL_GRACE_MINUTES} min or the client is upset.`,
          { window: s.PATROL_GRACE_MINUTES / s.CLOCK_MINUTES_PER_SECOND, title: 'Hourly patrol' },
        );
      }
    }

    // Officers on patrol: pause at each checkpoint, then move on.
    for (const officer of g.escorts.officers) {
      if (officer.state !== PersonState.PATROLLING || officer.path.length) continue;
      const p = officer.patrol;
      if (p.pause > 0) {
        p.pause -= dt;
        if (p.pause > 0) continue;
        this.#mark(officer, p.index, 'done');
        p.index += 1;
        if (p.index >= p.route.points.length) {
          this.#clearMarkers(officer);
          officer.patrol = null;
          g.score.count('patrolsCompleted');
          g.incidents.create(officer, 'info', `completed the ${p.label} patrol: ${p.route.name}, ${p.route.points.length} checkpoints.`);
          g.escorts.returnToDuty(officer);
          continue;
        }
        this.#walk(officer);
      }
    }
  }
}
