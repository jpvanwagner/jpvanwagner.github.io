/*
 * The parking lot. Everyone arrives by car:
 *
 *  - If a front-row spot is free (and they fancy it), the car drives up the
 *    lane from off-screen, noses into the spot, and the people get out and
 *    walk to the entrance.
 *  - Otherwise they parked further out in the off-screen part of the lot and
 *    simply walk in from the south edge of the map.
 *
 * When visitors (or anyone) leave, they walk back to their car and drive off,
 * freeing the spot - or walk off the south edge if they parked out of view.
 * Some front-row spots are already taken when the shift starts.
 */
import { PARKING } from '../data/layout.js';
import { createCar } from '../world/meshes.js';
import { chance, pick } from '../core/rng.js';

const CAR_COLORS = [0x9c3d3d, 0x2f5b8a, 0xd6d2c7, 0x3d3f44, 0x5b7f5a, 0xb88a3d, 0x6b4f7a, 0xe2e0d8, 0x24384f];
const FACING_BUILDING = Math.PI; // parked nose-in, facing west

export class ParkingSystem {
  constructor(game) {
    this.game = game;
    this.spots = PARKING.spots.map((spot) => ({ spot, car: null }));
    this.cars = new Set();
    this.inbound = 0; // cars still driving in (their people haven't joined the line yet)
    const free = [...this.spots];
    for (let i = 0; i < game.settings.PREPARKED_CARS && free.length; i++) {
      const slot = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      this.#park(slot, this.#makeCar(slot.spot.x, slot.spot.z, FACING_BUILDING));
    }
  }

  #makeCar(x, z, heading) {
    const mesh = createCar(0, 0, pick(CAR_COLORS), heading);
    mesh.position.set(x, 0, z);
    this.game.stage.dynamicRoot.add(mesh);
    const car = { mesh, route: [], onDone: null, riders: new Set(), slot: null };
    this.cars.add(car);
    return car;
  }

  #park(slot, car) {
    slot.car = car;
    car.slot = slot;
  }

  get freeSpots() {
    return this.spots.filter((s) => !s.car);
  }

  /**
   * A group is arriving. Calls `onReady(origin, car)` once they're out of the
   * car (or walking in from the off-screen lot, with car = null).
   */
  arrive(onReady) {
    const free = this.freeSpots;
    if (!free.length || !chance(this.game.settings.PARK_UP_FRONT_CHANCE)) {
      onReady({ ...PARKING.walkIn }, null);
      return;
    }
    const slot = pick(free);
    const { spot } = slot;
    const car = this.#makeCar(PARKING.aisleX, PARKING.offscreenZ, Math.PI / 2);
    this.#park(slot, car);
    this.inbound += 1;
    car.route = [
      { x: PARKING.aisleX, z: spot.z + 5 },
      { x: PARKING.aisleX - 2.5, z: spot.z + 0.8 },
      { x: spot.x, z: spot.z },
    ];
    car.onDone = () => {
      car.mesh.rotation.y = FACING_BUILDING;
      this.inbound -= 1;
      onReady({ ...spot.door }, car);
    };
  }

  /** Walk to the car (or off the edge of the map) and go home. */
  depart(person) {
    const g = this.game;
    const car = person.car;
    if (!car || !car.slot) {
      person.walkTo(PARKING.walkIn, { onArrive: () => g.despawn(person) });
      return;
    }
    const door = car.slot.spot.door;
    person.walkTo(door, {
      onArrive: () => {
        g.despawn(person);
        car.riders.delete(person);
        if (![...car.riders].some((r) => !r.removed)) this.#driveAway(car);
      },
    });
  }

  #driveAway(car) {
    const { spot } = car.slot;
    car.route = [
      { x: spot.x + 4.5, z: spot.z, reverse: true },
      { x: PARKING.aisleX, z: spot.z + 4 },
      { x: PARKING.aisleX, z: PARKING.offscreenZ },
    ];
    car.onDone = () => {
      this.game.stage.dynamicRoot.remove(car.mesh);
      this.cars.delete(car);
    };
    // The spot frees up as soon as the car pulls out.
    car.slot.car = null;
  }

  update(dt) {
    const speed = this.game.settings.CAR_SPEED;
    for (const car of this.cars) {
      if (!car.route.length) continue;
      const target = car.route[0];
      const pos = car.mesh.position;
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      // Ease in at the end of the route
      const step = Math.min(dist, speed * dt * (car.route.length === 1 ? Math.max(0.35, Math.min(1, dist / 6)) : 1));
      if (dist > 1e-3) {
        pos.x += (dx / dist) * step;
        pos.z += (dz / dist) * step;
        const heading = Math.atan2(-dz, dx); // local +x is the car's nose
        car.mesh.rotation.y = target.reverse ? heading + Math.PI : heading;
      }
      if (dist - step < 0.05) {
        car.route.shift();
        if (!car.route.length) {
          const done = car.onDone;
          car.onDone = null;
          done?.();
        }
      }
    }
  }
}
