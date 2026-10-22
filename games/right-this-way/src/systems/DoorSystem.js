/*
 * Doors: logical state (open / propped) + swing animation.
 *
 *  - Staff and escorted visitors open secure doors; doors close themselves
 *    once nobody is in the doorway for DOOR_CLOSE_DELAY seconds.
 *  - With the `staffPropDoors` feature, an employee may leave a secure door
 *    propped open - an opening an unescorted visitor can exploit.
 *  - Bored visitors may force a secure door (reported as an incident).
 *  - A propped door is an incident. The player can't touch doors directly:
 *    officers on patrol close any propped door they pass, employees walking
 *    by might, and otherwise the player sends an officer ("Send officer").
 */
import { DOORS, WALL_HEIGHT } from '../data/layout.js';
import { doorAxis } from '../data/layoutGeometry.js';
import { createDoorMesh, createDoorDecor } from '../world/meshes.js';
import { PALETTE } from '../world/palette.js';
import { chance } from '../core/rng.js';
import { SYSTEM_TEXT } from '../data/incidentText.js';

const SWING = Math.PI / 2 * 0.95;
const SWING_SPEED = 4; // openAmount per second

export class DoorSystem {
  constructor(game) {
    this.game = game;
    this.doors = new Map();
    for (const def of DOORS) {
      const axis = doorAxis(def);
      const door = { def, axis, open: !!def.alwaysOpen, propped: false, amount: def.alwaysOpen ? 1 : 0, idle: 0, view: null };
      if (!def.alwaysOpen) {
        door.view = createDoorMesh(def, axis, WALL_HEIGHT);
        door.view.hit.userData.doorId = def.id;
        game.stage.dynamicRoot.add(door.view.pivot, door.view.hit, door.view.decor);
      } else {
        game.stage.dynamicRoot.add(createDoorDecor(def, axis, WALL_HEIGHT).group);
      }
      this.doors.set(def.id, door);
    }
  }

  get(id) {
    return this.doors.get(id);
  }

  isOpen(id) {
    return !!this.doors.get(id)?.open;
  }

  /** Open far enough to walk through. */
  isPassable(id) {
    const d = this.doors.get(id);
    return !!d && d.open && d.amount > 0.65;
  }

  /** Someone is in the doorway: keep it from closing. */
  touch(id) {
    const d = this.doors.get(id);
    if (d) d.idle = 0;
  }

  open(id, by = null, { forced = false } = {}) {
    const d = this.doors.get(id);
    if (!d || d.open) return;
    d.open = true;
    d.idle = 0;
    if (forced && by) {
      this.game.incidents.create(by, 'info', SYSTEM_TEXT.forcedDoor(d.def.label));
    }
    const { features, settings } = this.game;
    if (by?.isEmployee && d.def.secure && features.staffPropDoors && chance(settings.DOOR_LEFT_OPEN_CHANCE)) {
      this.prop(id, by);
    }
    this.game.bus.emit('doors');
  }

  /** Someone leaves a door propped open: an incident until someone closes it. */
  prop(id, by = null) {
    const d = this.doors.get(id);
    if (!d || d.def.alwaysOpen || d.propped) return;
    d.open = true;
    d.propped = true;
    d.passedBy = new Set(by ? [by] : []); // employees who already walked past it
    d.incident = this.game.incidents.create(null, 'door', SYSTEM_TEXT.doorPropped(d.def.label), {
      window: this.game.settings.DOOR_PROPPED_WINDOW,
      title: `${d.def.label} door`,
      door: id,
    });
    this.game.bus.emit('doors');
  }

  /** Close a propped door (an officer or employee pushed it shut). */
  close(id, by = null) {
    const d = this.doors.get(id);
    if (!d?.propped) return;
    d.propped = false;
    d.idle = this.game.settings.DOOR_CLOSE_DELAY; // auto-close once the doorway is clear
    d.officerEnRoute = null;
    const inc = d.incident;
    d.incident = null;
    if (inc?.status === 'open') this.game.incidents.resolve(inc, 'addressed', { score: false });
    if (by) this.game.incidents.create(by, 'info', SYSTEM_TEXT.doorClosed(d.def.label));
    this.game.bus.emit('doors');
  }

  /** Player: send the nearest free officer to close a propped door. */
  sendOfficer(id) {
    const g = this.game;
    const d = this.doors.get(id);
    if (!d?.propped || d.officerEnRoute) return false;
    const officer = g.escorts.idleOfficer({ x: d.def.x, z: d.def.z });
    if (!officer) return false;
    d.officerEnRoute = officer;
    g.escorts.dispatchDoor(officer, d);
    g.bus.emit('doors');
    return true;
  }

  hitTargets() {
    return [...this.doors.values()].filter((d) => d.view).map((d) => d.view.hit);
  }

  #occupied(d) {
    const r = d.def.width / 2 + 1.4;
    return this.game.people.some((p) => Math.abs(p.pos.x - d.def.x) < r && Math.abs(p.pos.z - d.def.z) < r);
  }

  /** Patrols always close propped doors they pass; employees walking by might. */
  #passersBy(d) {
    const g = this.game;
    const near = (p, r) => Math.hypot(p.pos.x - d.def.x, p.pos.z - d.def.z) < r;
    for (const p of g.people) {
      if (p.removed || !near(p, p.isOfficer ? 6 : 3)) continue;
      if (p.isOfficer && p.state === 'PATROLLING') return this.close(d.def.id, p);
      if (p.isEmployee && !d.passedBy.has(p)) {
        d.passedBy.add(p);
        if (chance(g.settings.EMPLOYEE_CLOSES_DOOR_CHANCE)) return this.close(d.def.id, p);
      }
    }
  }

  update(dt) {
    for (const d of this.doors.values()) {
      if (d.def.alwaysOpen) continue;
      if (d.propped) this.#passersBy(d);
      if (d.open && !d.propped) {
        if (this.#occupied(d)) d.idle = 0;
        else d.idle += dt;
        if (d.idle >= this.game.settings.DOOR_CLOSE_DELAY) {
          d.open = false;
          this.game.bus.emit('doors');
        }
      }
      const target = d.open ? 1 : 0;
      if (d.amount !== target) {
        d.amount = target > d.amount ? Math.min(1, d.amount + SWING_SPEED * dt) : Math.max(0, d.amount - SWING_SPEED * dt);
      }
      const v = d.view;
      v.pivot.rotation.y = v.baseRotation + d.amount * SWING;
      v.material.color.setHex(d.propped ? PALETTE.door.propped : v.baseColor);
      v.readerMat?.color.setHex(d.open ? PALETTE.door.readerOpen : PALETTE.door.readerLocked);
    }
  }

  /** Doors currently propped open (for the HUD warning labels). */
  proppedDoors() {
    return [...this.doors.values()].filter((d) => d.propped);
  }

  reset() {
    for (const d of this.doors.values()) {
      if (d.view) this.game.stage.dynamicRoot.remove(d.view.pivot, d.view.hit, d.view.decor);
    }
  }
}
