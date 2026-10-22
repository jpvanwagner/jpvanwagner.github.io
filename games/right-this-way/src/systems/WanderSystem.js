/*
 * Unescorted visitors loose in the facility.
 *
 *  - Every UNESCORTED_INCIDENT_INTERVAL (6s) each one causes an incident drawn
 *    from random list 1 (room-specific lines when available).
 *  - They roam toward interesting spots, preferring secure rooms; closed
 *    secure doors stop them unless a door was propped open... or they have
 *    been neglected long enough to force it.
 *  - Camera deterrence: while the player watches the room they are in, they
 *    freeze and behave - unless neglected past CAMERA_DETERRENCE_LIMIT.
 *  - Once an officer is dispatched they stop generating incidents and wait to
 *    be collected when the officer gets close.
 */
import { PersonState } from '../entities/Person.js';
import { WANDER_SPOTS } from '../data/layout.js';
import { GUEST_INCIDENTS, GUEST_INCIDENTS_BY_ROOM } from '../data/incidentText.js';
import { pick, weighted, range, chance } from '../core/rng.js';

const SURRENDER_DISTANCE = 6;

export class WanderSystem {
  constructor(game) {
    this.game = game;
  }

  get wanderers() {
    return this.game.people.filter((p) => p.state === PersonState.WANDERING);
  }

  /**
   * A visitor is now inside without an escort.
   * @param {boolean} tailgate  grants one-time access through the checkpoint
   */
  admit(guest, { tailgate = false } = {}) {
    const g = this.game;
    g.spots.releaseAll(guest);
    guest.unfollow();
    guest.state = PersonState.WANDERING;
    guest.tailgating = tailgate;
    guest.neglect = 0;
    guest.incidentTimer = 0;
    guest.linger = 0;
    guest.status = 'Unescorted';
    this.#pickDestination(guest);
    g.bus.emit('incidents');
  }

  #pickDestination(guest) {
    const g = this.game;
    for (let attempt = 0; attempt < 6; attempt++) {
      const spot = weighted(WANDER_SPOTS);
      const ok = guest.walkTo(spot, {
        speed: g.settings.WANDER_SPEED,
        onArrive: () => (guest.linger = range(2, 5)),
        onBlocked: () => (guest.linger = 0.5),
      });
      if (ok) return;
    }
    guest.linger = 1.5; // nowhere reachable right now; try again shortly
  }

  #incidentText(guest) {
    const roomLines = GUEST_INCIDENTS_BY_ROOM[guest.room];
    return roomLines && chance(0.6) ? pick(roomLines) : pick(GUEST_INCIDENTS);
  }

  update(dt) {
    const g = this.game;
    const s = g.settings;
    const watchedRoom = g.cameras.activeRoom;

    for (const guest of this.wanderers) {
      // Officer on the way: give up when they get close, no more incidents.
      if (guest.targetedBy) {
        guest.observed = false;
        guest.status = 'Officer en route';
        const o = guest.targetedBy.pos;
        if (Math.hypot(o.x - guest.pos.x, o.z - guest.pos.z) < SURRENDER_DISTANCE) guest.stop();
        continue;
      }

      guest.neglect += dt;
      const deterred = watchedRoom && guest.room === watchedRoom && guest.neglect < s.CAMERA_DETERRENCE_LIMIT;
      guest.observed = !!deterred;

      if (deterred) {
        guest.status = 'On camera – behaving';
        if (guest.path.length) {
          guest.stop();
          guest.linger = 0.5;
        }
        continue;
      }
      guest.status = guest.neglect >= s.CAMERA_DETERRENCE_LIMIT ? 'Unescorted – doesn’t care' : 'Unescorted';

      // Incidents only once actually inside the facility.
      if (guest.inside) {
        guest.incidentTimer += dt;
        if (guest.incidentTimer >= s.UNESCORTED_INCIDENT_INTERVAL) {
          guest.incidentTimer = 0;
          g.incidents.create(guest, 'guest', this.#incidentText(guest));
        }
      }

      if (!guest.path.length) {
        guest.linger -= dt;
        if (guest.linger <= 0) this.#pickDestination(guest);
      }
    }
  }
}
