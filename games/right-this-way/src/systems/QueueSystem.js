/*
 * The line of arrivals ("line of singles or pairs" in the sketch).
 *
 * line[0] is the group at (or walking up to) the desk. Every group owns one
 * queue slot; a pair stands side by side in it. When the desk clears, everyone
 * shuffles forward one slot.
 *
 * Visitor-only groups (G / GG) lose patience if kept in line too long and
 * tailgate through the checkpoint behind someone else.
 */
import { QUEUE_SLOTS, PAIR_OFFSET } from '../data/layout.js';
import { PersonState } from '../entities/Person.js';
import { SYSTEM_TEXT } from '../data/incidentText.js';
import { groupVerdict } from './rules.js';
import { clockMinutes } from '../core/clock.js';

export class QueueSystem {
  constructor(game) {
    this.game = game;
    this.line = [];
  }

  get capacity() {
    return Math.min(this.game.settings.QUEUE_SLOTS, QUEUE_SLOTS.length);
  }

  canAccept() {
    return this.line.length < this.capacity;
  }

  /** World positions for each member of a group standing in `slotIndex`. */
  slotPositions(group, slotIndex) {
    const slot = QUEUE_SLOTS[slotIndex];
    if (group.members.length === 1) return [{ x: slot.x, z: slot.z }];
    return group.members.map((_, i) => ({ x: slot.x, z: slot.z + (i === 0 ? -PAIR_OFFSET : PAIR_OFFSET) }));
  }

  join(group) {
    this.line.push(group);
    group.patience = 0;
    // Visitors are on time / early / late by when they got here, not by how long the line took.
    const now = clockMinutes(this.game.time, this.game.settings);
    for (const m of group.members) if (m.isGuest) m.arrivedMinutes ??= now;
    this.#walkToSlot(group, this.line.length - 1);
  }

  #walkToSlot(group, index) {
    group.slot = index;
    group.arrived = 0;
    const spots = this.slotPositions(group, index);
    group.members.forEach((m, i) => {
      m.state = index === 0 ? m.state : PersonState.QUEUED;
      m.walkTo(spots[i], {
        onArrive: () => {
          group.arrived += 1;
          m.mesh.rotation.y = -Math.PI / 2; // face the desk
          if (m.state === PersonState.ARRIVING) m.state = PersonState.QUEUED;
        },
      });
    });
  }

  /** Called when the desk is done with line[0]. */
  shift() {
    this.line.shift();
    this.line.forEach((group, i) => this.#walkToSlot(group, i));
    this.game.bus.emit('desk');
  }

  remove(group) {
    const idx = this.line.indexOf(group);
    if (idx < 0) return;
    this.line.splice(idx, 1);
    this.line.forEach((g, i) => {
      if (i >= idx) this.#walkToSlot(g, i);
    });
    this.game.bus.emit('desk');
  }

  update(dt) {
    const g = this.game;
    const front = this.line[0];
    if (front && !g.desk.group && !g.desk.frozen && front.slot === 0 && front.arrived >= front.members.length) {
      g.desk.begin(front);
    }

    for (const group of [...this.line]) {
      if (group === g.desk.group) continue;
      if (groupVerdict(group.members) !== 'unaccompanied') continue;
      group.patience += dt;
      group.members.forEach((m) => (m.patience = group.patience));
      if (group.patience >= g.settings.QUEUE_PATIENCE) this.#tailgate(group);
    }
  }

  #tailgate(group) {
    const g = this.game;
    this.remove(group);
    for (const guest of group.members) {
      g.score.count('tailgaters');
      g.incidents.create(guest, 'info', SYSTEM_TEXT.tailgated);
      g.wander.admit(guest, { tailgate: true });
    }
  }
}
