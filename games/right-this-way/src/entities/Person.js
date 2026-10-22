/*
 * A person in the facility (visitor, employee or officer).
 *
 * Person only knows how to MOVE: walk a nav path, follow a leader, open
 * doors it has access to. What a person decides to do is driven by the
 * systems (QueueSystem, DeskSystem, EscortSystem, WanderSystem, StaffSystem),
 * which set `state` and call walkTo()/follow().
 */
import { createPersonMesh, createRing, createTether, animatePerson } from '../world/meshes.js';
import { randomAppearance } from '../data/appearance.js';
import { genderOf } from '../data/names.js';
import { PersonType } from '../config/entityTypes.js';
import { roomAt, INTERIOR_ROOMS } from '../data/layout.js';
import { uid } from '../core/rng.js';
import { PALETTE } from '../world/palette.js';

export const PersonState = Object.freeze({
  ARRIVING: 'ARRIVING', // walking to the line
  QUEUED: 'QUEUED',
  AT_DESK: 'AT_DESK',
  WAITING: 'WAITING', // seated in the waiting area
  VERIFYING: 'VERIFYING', // stepped aside while an officer checks whether they're expected
  ESCORTED: 'ESCORTED', // following an escort
  VISITING: 'VISITING', // in a meeting (with their host, or the escort standing by)
  LOUNGING: 'LOUNGING', // left in the breakroom / cafeteria by their host or escort
  RESTROOM: 'RESTROOM', // on a restroom trip
  HOSTING: 'HOSTING', // employee meeting visitors / walking them out
  WANDERING: 'WANDERING', // unescorted inside the facility
  WORKING: 'WORKING', // employee at work / on a break
  IDLE: 'IDLE', // duty officer available
  RESPONDING: 'RESPONDING', // duty officer heading to a pickup
  PATROLLING: 'PATROLLING', // duty officer on the hourly patrol
  ESCORTING: 'ESCORTING', // leading visitors
  PASSING: 'PASSING', // visiting officer passing through
  LEAVING: 'LEAVING', // walking out of the building
});

const FOLLOW_SPACING = 1.9;
const TRAIL_STEP = 0.35;
const TRAIL_MAX = 90;

export class Person {
  /**
   * @param {import('../core/Game.js').Game} game
   * @param {object} type  PersonType entry
   * @param {object} opts  { name, valid, isDuty, position }
   */
  constructor(game, type, { name, valid = true, isDuty = false, position, appearance = null }) {
    this.game = game;
    this.id = uid('p');
    this.type = type;
    this.name = name;
    this.valid = valid; // badge valid / appointment on file
    // "revealed" = the player has verified this person (ID check / appointment lookup).
    this.revealed = type === PersonType.GUEST ? !game.features.appointmentChecks : !game.features.badgeChecks;
    this.appearance = appearance ?? randomAppearance(type, genderOf(name));
    this.arrivedAt = game.time; // for the hover card ("on site for 25 min")
    this.roster = null; // staff: their entry in the persistent roster (core/career.js)
    this.badge = 'ok'; // staff: 'ok' | 'expired' | 'borrowed' (hidden from the player)
    this.tempPass = false; // staff: temporary pass printed at the desk
    this.car = null; // ParkingSystem car they came in (null = parked out of view)
    this.visit = null; // visitors: their visit (EscortSystem)
    this.restroomAt = null; // game time they'll next need the restroom (RestroomSystem)
    this.unescortedTrip = false; // visitor walking to/from a restroom without a guard
    this.appointment = null; // visitors: entry from the AppointmentBook (null = not on the list)
    this.idCard = null; // staff: see systems/credentials.js
    this.isDuty = isDuty; // part of the escort pool
    this.hasPass = false; // printed guest pass (visitors)
    this.state = PersonState.ARRIVING;
    this.group = null;
    this.removed = false;

    // Timers used by systems
    this.patience = 0;
    this.neglect = 0;
    this.incidentTimer = 0;
    this.observed = false;
    this.targetedBy = null; // officer dispatched to retrieve this visitor
    this.tailgating = false; // temporary checkpoint access while slipping through
    this.job = null; // escort job this person belongs to
    this.status = ''; // short label for the floating tag

    // Movement
    this.path = [];
    this.onArrive = null;
    this.onBlocked = null;
    this.speed = game.settings.WALK_SPEED;
    this.leader = null;
    this.followIndex = 0;
    this.followers = [];
    this.trail = [];
    this.waitingForDoor = null;

    this.mesh = createPersonMesh(type, this.appearance, { company: game.company });
    this.mesh.position.set(position.x, 0, position.z);
    this.mesh.userData.person = this;
    game.stage.dynamicRoot.add(this.mesh);

    this.warnRing = createRing(PALETTE.rings.unescorted, 1.45, 0.85);
    this.warnRing.visible = false;
    game.stage.dynamicRoot.add(this.warnRing);

    // Dashed line to whoever is responsible for this visitor (set by EscortSystem).
    this.tetherTo = null;
    if (this.isGuest) {
      this.tether = createTether();
      this.tether.visible = false;
      game.stage.dynamicRoot.add(this.tether);
    }

    this.room = roomAt(position.x, position.z);
  }

  get pos() {
    return this.mesh.position;
  }

  get isGuest() {
    return this.type === PersonType.GUEST;
  }

  get isOfficer() {
    return this.type === PersonType.OFFICER;
  }

  get isEmployee() {
    return this.type === PersonType.EMPLOYEE;
  }

  get inside() {
    return INTERIOR_ROOMS.has(this.room);
  }

  setPass(has) {
    this.hasPass = has;
    if (this.isGuest) this.mesh.userData.badge.visible = has;
  }

  /**
   * How this person gets through a door: 'open' (badge / escort),
   * 'force' (bored visitor forcing it), or null (cannot).
   */
  access(doorId) {
    const door = this.game.doors.get(doorId);
    if (!door) return 'open';
    if (!this.isGuest) return 'open';
    if (this.leader) return 'open';
    if (this.tailgating && doorId === 'checkpoint') return 'open';
    if (!door.def.secure) return 'open';
    if (this.state === PersonState.WANDERING && this.neglect >= this.game.settings.FORCE_DOOR_NEGLECT) return 'force';
    return null;
  }

  /** Door predicate for path planning. */
  canPass = (doorId) => this.game.doors.isOpen(doorId) || this.access(doorId) !== null;

  /**
   * Plan a path and walk it. Returns false if the destination is unreachable.
   * onArrive fires once at the destination; onBlocked fires if a door
   * closes in our face mid-route.
   */
  walkTo(point, { onArrive = null, onBlocked = null, speed } = {}) {
    this.unfollow();
    const path = this.game.nav.findPath(this.pos, point, this.canPass);
    this.onArrive = onArrive;
    this.onBlocked = onBlocked;
    this.speed = speed ?? this.game.settings.WALK_SPEED;
    if (!path) {
      this.path = [];
      return false;
    }
    this.path = path;
    if (path.length === 0) this.#arrive();
    return true;
  }

  stop() {
    this.path = [];
    this.onArrive = null;
    this.onBlocked = null;
  }

  get moving() {
    return this.path.length > 0 || !!this.leader;
  }

  follow(leader, index = 0) {
    this.stop();
    this.unfollow();
    this.leader = leader;
    this.followIndex = index;
    // A fresh formation starts a fresh breadcrumb trail (old trails may cross walls).
    if (leader.followers.length === 0) leader.trail = [{ x: leader.pos.x, z: leader.pos.z }];
    leader.followers.push(this);
  }

  unfollow() {
    if (!this.leader) return;
    this.leader.followers = this.leader.followers.filter((f) => f !== this);
    this.leader = null;
  }

  teleport(x, z) {
    this.pos.set(x, 0, z);
    this.trail = [];
  }

  #arrive() {
    const cb = this.onArrive;
    this.onArrive = null;
    this.onBlocked = null;
    cb?.(this);
  }

  /** Returns true if we may proceed through any door ahead of us. */
  #handleDoorAhead(dirX, dirZ) {
    const ahead = 1.1;
    const doorId = this.game.nav.doorAt(this.pos.x + dirX * ahead, this.pos.z + dirZ * ahead);
    if (!doorId) {
      this.waitingForDoor = null;
      return true;
    }
    const doors = this.game.doors;
    if (doors.isPassable(doorId)) {
      doors.touch(doorId);
      return true;
    }
    const how = doors.isOpen(doorId) ? 'open' : this.access(doorId);
    if (!how) {
      // Door shut in our face: re-plan
      const cb = this.onBlocked;
      this.stop();
      cb?.(this, doorId);
      return false;
    }
    if (!doors.isOpen(doorId)) doors.open(doorId, this, { forced: how === 'force' });
    this.waitingForDoor = doorId;
    return false; // wait for the swing animation
  }

  update(dt) {
    let moved = false;
    if (this.leader) {
      moved = this.#updateFollow(dt);
    } else if (this.path.length) {
      moved = this.#updatePath(dt);
    }

    if (this.followers.length) this.#recordTrail();
    this.room = roomAt(this.pos.x, this.pos.z) ?? this.room;
    if (this.tailgating && this.inside) this.tailgating = false;

    // Walk cycle: the stride advances with distance covered.
    if (moved) this.walkPhase = (this.walkPhase ?? 0) + dt * this.speed * 1.1;
    animatePerson(this.mesh, this.walkPhase ?? 0, moved, this.game.time + this.mesh.id);

    if (this.tether) this.#updateTether();

    this.warnRing.position.set(this.pos.x, 0.06, this.pos.z);
    this.warnRing.visible = this.state === PersonState.WANDERING || this.unescortedTrip;
    if (this.warnRing.visible) {
      const s = 1 + Math.sin(this.game.time * 6) * 0.12;
      this.warnRing.scale.set(s, s, s);
    }
  }

  #updateTether() {
    const other = this.tetherTo;
    this.tether.visible = !!other && !other.removed;
    if (!this.tether.visible) return;
    const attr = this.tether.geometry.attributes.position;
    attr.setXYZ(0, this.pos.x, 1.2, this.pos.z);
    attr.setXYZ(1, other.pos.x, 1.2, other.pos.z);
    attr.needsUpdate = true;
    this.tether.computeLineDistances();
    this.tether.geometry.computeBoundingSphere();
  }

  #face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  #updatePath(dt) {
    const target = this.path[0];
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      this.path.shift();
      if (!this.path.length) this.#arrive();
      return false;
    }
    const nx = dx / dist;
    const nz = dz / dist;
    if (!this.#handleDoorAhead(nx, nz)) return false;
    const step = Math.min(dist, this.speed * dt);
    this.pos.x += nx * step;
    this.pos.z += nz * step;
    this.#face(nx, nz);
    if (step >= dist - 1e-6) {
      this.path.shift();
      if (!this.path.length) this.#arrive();
    }
    return true;
  }

  #recordTrail() {
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(this.pos.x - last.x, this.pos.z - last.z) >= TRAIL_STEP) {
      this.trail.push({ x: this.pos.x, z: this.pos.z });
      if (this.trail.length > TRAIL_MAX) this.trail.shift();
    }
  }

  /** Walk the leader's breadcrumb trail backwards to find our formation slot. */
  #followTarget() {
    const leader = this.leader;
    const want = FOLLOW_SPACING * (this.followIndex + 1);
    let prev = { x: leader.pos.x, z: leader.pos.z };
    let travelled = 0;
    for (let i = leader.trail.length - 1; i >= 0; i--) {
      const p = leader.trail[i];
      const seg = Math.hypot(prev.x - p.x, prev.z - p.z);
      if (travelled + seg >= want) {
        const t = (want - travelled) / (seg || 1);
        return { x: prev.x + (p.x - prev.x) * t, z: prev.z + (p.z - prev.z) * t };
      }
      travelled += seg;
      prev = p;
    }
    return prev;
  }

  #updateFollow(dt) {
    const target = this.#followTarget();
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) return false;
    const nx = dx / dist;
    const nz = dz / dist;
    if (!this.#handleDoorAhead(nx, nz)) return false;
    const speed = Math.max(this.leader.speed, this.game.settings.WALK_SPEED) * 1.35;
    const step = Math.min(dist, speed * dt);
    this.pos.x += nx * step;
    this.pos.z += nz * step;
    this.#face(nx, nz);
    return true;
  }

  dispose() {
    this.removed = true;
    this.unfollow();
    for (const f of [...this.followers]) f.unfollow();
    this.game.stage.dynamicRoot.remove(this.mesh, this.warnRing);
    if (this.tether) this.game.stage.dynamicRoot.remove(this.tether);
  }
}
