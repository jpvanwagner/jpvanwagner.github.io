/*
 * Reservation book for named spots (queue slots, waiting seats, workstations,
 * meeting seats, officer posts...). Reserving a spot before walking to it is
 * what keeps two people from ever standing in the same place.
 */
export class SpotRegistry {
  constructor() {
    this.owners = new Map(); // spot object -> owner
  }

  isFree(spot) {
    return !this.owners.has(spot);
  }

  reserve(spot, owner) {
    if (!this.isFree(spot) && this.owners.get(spot) !== owner) return false;
    this.owners.set(spot, owner);
    return true;
  }

  /** Reserves the first free spot in `spots` (optionally shuffled). */
  reserveAny(spots, owner, { random = false } = {}) {
    const list = random ? [...spots].sort(() => Math.random() - 0.5) : spots;
    const spot = list.find((s) => this.isFree(s));
    if (spot) this.owners.set(spot, owner);
    return spot ?? null;
  }

  release(spot) {
    if (spot) this.owners.delete(spot);
  }

  releaseAll(owner) {
    for (const [spot, o] of this.owners) if (o === owner) this.owners.delete(spot);
  }

  /** Every spot this owner holds. */
  spotsOf(owner) {
    return [...this.owners].filter(([, o]) => o === owner).map(([spot]) => spot);
  }

  freeCount(spots) {
    return spots.filter((s) => this.isFree(s)).length;
  }
}
