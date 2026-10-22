/*
 * Employees and visiting officers once they are past the desk, plus drills.
 *
 *  - Employees head to a workstation, then periodically take breaks
 *    (breakroom / cafeteria / water cooler) - opening doors as they go, and
 *    sometimes propping them open (level feature).
 *  - Duty officers are handed to the EscortSystem pool.
 *  - Visiting officers (arrivals beyond the duty crew) pass through to a
 *    break spot for a while, then leave.
 *  - Every DRILL_INTERVAL (30s) a random employee runs a response test that
 *    the player must acknowledge (random list 2).
 */
import { PersonState } from '../entities/Person.js';
import { WORKSTATIONS, BREAK_SPOTS } from '../data/layout.js';
import { DRILL_INCIDENTS } from '../data/incidentText.js';
import { pick, range } from '../core/rng.js';

export class StaffSystem {
  constructor(game) {
    this.game = game;
    this.drillTimer = 0;
  }

  admit(person) {
    const g = this.game;
    g.spots.releaseAll(person);
    if (person.isOfficer && person.isDuty) {
      g.escorts.register(person);
    } else if (person.isOfficer) {
      this.#visitAndLeave(person);
    } else {
      this.returnToWork(person);
    }
  }

  returnToWork(person) {
    const g = this.game;
    person.job = null;
    person.state = PersonState.WORKING;
    person.status = '';
    person.breakTimer = range(20, 45);
    person.onBreak = false;
    if (person.breakSpot) {
      g.spots.release(person.breakSpot);
      person.breakSpot = null;
    }
    if (!person.workstation) person.workstation = g.spots.reserveAny(WORKSTATIONS, person, { random: true });
    const target = person.workstation ?? pick(BREAK_SPOTS);
    person.walkTo(target, { onArrive: () => (person.mesh.rotation.y = Math.PI) });
  }

  #takeBreak(person) {
    const g = this.game;
    const spot = g.spots.reserveAny(BREAK_SPOTS, person, { random: true });
    if (!spot) {
      person.breakTimer = range(10, 20);
      return;
    }
    person.onBreak = true;
    person.breakSpot = spot;
    person.breakTimer = range(6, 12);
    person.walkTo(spot);
  }

  #visitAndLeave(officer) {
    const g = this.game;
    officer.state = PersonState.PASSING;
    officer.status = '';
    const spot = g.spots.reserveAny(BREAK_SPOTS, officer, { random: true });
    officer.breakTimer = range(15, 30);
    officer.walkTo(spot ?? pick(BREAK_SPOTS));
  }

  update(dt) {
    const g = this.game;
    for (const p of g.people) {
      if (p.state === PersonState.WORKING && !p.path.length) {
        p.breakTimer -= dt;
        if (p.breakTimer <= 0) {
          if (p.onBreak) this.returnToWork(p);
          else this.#takeBreak(p);
        }
      } else if (p.state === PersonState.PASSING && !p.path.length) {
        p.breakTimer -= dt;
        if (p.breakTimer <= 0) g.leave(p); // back to their car
      }
    }

    // Drills only run once someone is actually at work.
    const workers = g.people.filter((p) => p.isEmployee && p.state === PersonState.WORKING && p.inside);
    if (workers.length && !g.features.scripted) {
      this.drillTimer += dt;
      if (this.drillTimer >= g.settings.DRILL_INTERVAL) {
        this.drillTimer = 0;
        g.incidents.create(pick(workers), 'drill', pick(DRILL_INCIDENTS));
      }
    }
  }
}
