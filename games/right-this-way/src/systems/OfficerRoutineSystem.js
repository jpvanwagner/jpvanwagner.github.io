/*
 * What free duty officers do between jobs: they don't just stand around.
 *
 *  - Meander between spots around the lobby, security post and hallways.
 *  - Now and then, check in on the waiting area (stand nearby for a few
 *    seconds) - but only if no other officer is already checking it.
 *    Officers collecting visitors from the waiting area don't count.
 *
 * They stay "free" (PersonState.IDLE) throughout, so a dispatch, escort or
 * patrol can grab them from wherever they are (the closest one is chosen).
 */
import { PersonState } from '../entities/Person.js';
import { WAITING_CHECKIN_SPOTS, OFFICER_ROAM_SPOTS } from '../data/layout.js';
import { chance, range } from '../core/rng.js';


export class OfficerRoutineSystem {
  constructor(game) {
    this.game = game;
  }

  #routine(officer) {
    return (officer.routine ??= { activity: 'post', spot: null, linger: range(3, 8) });
  }

  #clearSpot(officer) {
    const r = this.#routine(officer);
    if (r.spot) this.game.spots.release(r.spot);
    r.spot = null;
  }

  /** Is someone already checking on the waiting area? */
  get checkingIn() {
    return this.game.escorts.officers.some((o) => o.routine?.activity === 'checkin' && o.state === PersonState.IDLE && !o.removed);
  }

  #next(officer) {
    const g = this.game;
    const r = this.#routine(officer);
    this.#clearSpot(officer);
    const [quiet, busy] = g.settings.OFFICER_CHECKIN_CHANCE;
    const pCheck = g.waiting.occupancy > 0 ? busy : quiet;

    if (!this.checkingIn && chance(pCheck)) {
      const spot = g.spots.reserveAny(WAITING_CHECKIN_SPOTS, officer, { random: true });
      if (spot) {
        r.activity = 'checkin';
        r.spot = spot;
        r.linger = range(5, 9);
        officer.status = 'Checking waiting area';
        officer.walkTo(spot, { onArrive: () => (officer.mesh.rotation.y = 0) });
        return;
      }
    }
    const spot = g.spots.reserveAny(OFFICER_ROAM_SPOTS, officer, { random: true });
    r.activity = 'roam';
    r.spot = spot;
    r.linger = range(3, 7);
    officer.status = '';
    if (spot) officer.walkTo(spot, { speed: g.settings.WALK_SPEED * 0.7 });
  }

  update(dt) {
    for (const officer of this.game.escorts.officers) {
      if (officer.removed) continue;
      const r = this.#routine(officer);
      // Busy (escort, pickup, patrol): drop whatever we were doing.
      if (officer.state !== PersonState.IDLE || officer.job) {
        if (r.activity !== 'busy') {
          this.#clearSpot(officer);
          r.activity = 'busy';
        }
        continue;
      }
      if (r.activity === 'busy') {
        // Just freed up (returnToDuty sent them toward the post).
        r.activity = 'post';
        r.linger = range(2, 5);
      }
      if (officer.path.length) continue;
      r.linger -= dt;
      if (r.linger <= 0) this.#next(officer);
    }
  }
}
