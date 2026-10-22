/*
 * DOM elements pinned to world positions: name tags with patience bars,
 * clickable CAM tags, PROPPED door flags, floating score popups, and - while
 * watching a security camera - the names of the rooms in view plus "Send
 * guard" buttons over anyone who needs one (a visitor on their own, someone
 * left in a lounge, a restroom request, or an open incident such as a drill).
 */
import { $, el, setBar, press } from './dom.js';
import { PersonState } from '../entities/Person.js';
import { DOORS, ROOMS } from '../data/layout.js';
import { groupVerdict } from '../systems/rules.js';
import { prefs } from '../core/prefs.js';

const HEAD_HEIGHT = 3.3;
const ROOM_CHIP_RANGE = 24; // camera view: name rooms within this distance of the camera's focus

export class WorldOverlay {
  constructor(app) {
    this.app = app;
    this.root = $('#world-overlay');
    this.tags = new Map(); // person -> { root, name, status, barWrap, fill }
    this.camButtons = new Map();
    this.doorFlags = new Map();
    this.guardButtons = new Map(); // person -> button (camera view only)
    this.roomChips = new Map(); // room id -> chip (camera view only)
    this.camRooms = $('#cam-rooms');
    this.p = { x: 0, y: 0, visible: false };


    app.bus.on('score', ({ delta, reason, pos }) => pos && this.popup(delta, reason, pos));
  }

  reset(game) {
    for (const t of this.tags.values()) t.root.remove();
    this.tags.clear();
    for (const b of this.camButtons.values()) b.remove();
    this.camButtons.clear();
    for (const cam of game.cameras.list()) {
      const btn = el('button', { class: 'cam-btn', title: `View ${cam.label}`, onclick: () => this.app.game?.cameras.view(cam) }, [
        el('span', { class: 'led' }),
        el('span', { class: 'cam-word' }, 'CAM '),
        cam.id.replace('cam', ''),
      ]);
      this.root.append(btn);
      this.camButtons.set(cam, btn);
    }
    for (const b of this.guardButtons.values()) b.remove();
    this.guardButtons.clear();
    for (const f of this.doorFlags.values()) f.remove();
    this.doorFlags.clear();
    for (const d of DOORS) {
      const flag = el('button', { class: 'door-flag', 'data-door': d.id, hidden: true, title: 'Send an officer to close it', ...press(() => this.app.game?.doors.sendOfficer(d.id)) }, 'PROPPED');
      this.root.append(flag);
      this.doorFlags.set(d.id, flag);
    }
    this.root.querySelectorAll('.popup').forEach((n) => n.remove());
  }

  #tagFor(person) {
    let t = this.tags.get(person);
    if (!t) {
      const name = el('span', { class: 'tag-name' }, person.name);
      const status = el('span', { class: 'tag-status' });
      const fill = el('div', { class: 'timer-fill' });
      const barWrap = el('div', { class: 'timer-bar' }, fill);
      const root = el('div', { class: 'tag' }, [name, status, barWrap]);
      this.root.append(root);
      t = { root, name, status, barWrap, fill };
      this.tags.set(person, t);
    }
    return t;
  }

  #shouldTag(person) {
    if (person.isGuest) return person.state !== PersonState.LEAVING;
    if (prefs.allNames) return true;
    if (person.isOfficer) return !!person.status;
    return false;
  }

  /** Patience bar for visitors stuck in line or in the waiting area. */
  #patience(game, person) {
    const s = game.settings;
    if (person.state === PersonState.WAITING) {
      const grp = game.waiting.groupOf(person);
      return grp?.dispatched ? null : 1 - person.patience / s.WAITING_PATIENCE;
    }
    if ((person.state === PersonState.QUEUED || person.state === PersonState.ARRIVING) && person.group && groupVerdict(person.group.members) === 'unaccompanied') {
      return 1 - person.patience / s.QUEUE_PATIENCE;
    }
    return null;
  }

  popup(delta, reason, pos) {
    const p = this.app.stage.project(pos.x, HEAD_HEIGHT + 1, pos.z);
    if (!p.visible) return;
    // Mistakes (and unchecked calls) say why, and stay up long enough to read.
    const explain = reason && reason !== 'correct' && reason !== 'Correct call';
    const node = el('div', { class: `popup ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'zero'} ${explain ? 'has-reason' : ''}`, style: { left: `${p.x}px`, top: `${p.y}px` } }, [
      `${delta > 0 ? '+' : ''}${delta}`,
      reason && reason !== 'correct' ? el('small', {}, reason) : null,
    ]);
    this.root.append(node);
    setTimeout(() => node.remove(), explain ? 3200 : 1300);
  }

  tick(game) {
    const stage = this.app.stage;
    const p = this.p;
    const inMap = this.app.rig.mode === 'map' && !this.app.rig.active;

    // Name tags
    const seen = new Set();
    for (const person of game.people) {
      if (!this.#shouldTag(person)) continue;
      seen.add(person);
      const t = this.#tagFor(person);
      stage.project(person.pos.x, HEAD_HEIGHT, person.pos.z, p);
      t.root.hidden = !p.visible;
      if (!p.visible) continue;
      t.root.style.left = `${p.x}px`;
      t.root.style.top = `${p.y}px`;
      const status = person.status || (person.state === PersonState.WAITING ? 'Waiting' : '');
      if (t.status.textContent !== status) t.status.textContent = status;
      t.status.hidden = !status;
      t.root.classList.toggle('is-loose', person.state === PersonState.WANDERING && !person.observed);
      t.root.classList.toggle('is-observed', !!person.observed);
      // On small stages, people calmly in line / waiting show just their bar.
      t.root.classList.toggle('is-quiet', [PersonState.QUEUED, PersonState.ARRIVING, PersonState.WAITING, PersonState.VISITING].includes(person.state));
      const patience = this.#patience(game, person);
      t.barWrap.hidden = patience === null;
      if (patience !== null) setBar(t.fill, patience);
    }
    for (const [person, t] of this.tags) {
      if (!seen.has(person)) {
        t.root.remove();
        this.tags.delete(person);
      }
    }

    // Camera buttons (map view only); pulse when a loose visitor is in that room.
    for (const [cam, btn] of this.camButtons) {
      btn.hidden = !inMap;
      if (!inMap) continue;
      stage.project(cam.mount.x, 4, cam.mount.z, p);
      btn.style.left = `${p.x}px`;
      btn.style.top = `${p.y}px`;
      const loose = game.people.some((q) => q.state === PersonState.WANDERING && q.room === cam.room);
      btn.classList.toggle('has-loose', loose);
    }

    // "Send guard" buttons while watching a camera
    const cam = !this.app.rig.active && this.app.rig.mode === 'camera' ? game.cameras.active : null;
    const wanted = new Set();
    if (cam) {
      for (const person of game.people) {
        if (person.room !== cam.room || !game.incidents.needsGuard(person)) continue;
        wanted.add(person);
        let btn = this.guardButtons.get(person);
        if (!btn) {
          btn = el('button', { class: 'guard-btn', ...press(() => game.incidents.sendOfficerTo(person)) });
          this.root.append(btn);
          this.guardButtons.set(person, btn);
        }
        const enRoute = person.targetedBy || person.respondingOfficer || person.visit?.fetching;
        const free = !enRoute && !!game.escorts.idleOfficer(person.pos);
        const restroom = game.incidents.open.some((i) => i.person === person && i.kind === 'restroom');
        const what = restroom ? 'Send guard (restroom)' : person.state === PersonState.LOUNGING ? 'Send guard to fetch' : 'Send guard';
        const label = enRoute ? 'Guard en route' : free ? what : 'No guard free';
        if (btn.textContent !== label) btn.textContent = label;
        btn.disabled = !free;
        stage.project(person.pos.x, HEAD_HEIGHT + 1.6, person.pos.z, p);
        btn.hidden = !p.visible;
        btn.style.left = `${p.x}px`;
        btn.style.top = `${p.y}px`;
      }
    }
    for (const [person, btn] of this.guardButtons) {
      if (!wanted.has(person)) {
        btn.remove();
        this.guardButtons.delete(person);
      }
    }

    // Room names while looking through a camera
    const shown = new Set();
    if (cam) {
      const { width, height } = stage.size;
      const look = cam.look;
      for (const room of ROOMS) {
        if (room.noLabel || room.id === 'outside') continue;
        // Label the part of the room nearest to where the camera points; skip far-off rooms.
        const inset = Math.min(1.5, (room.x1 - room.x0) / 2, (room.z1 - room.z0) / 2);
        const x = Math.min(room.x1 - inset, Math.max(room.x0 + inset, look.x));
        const z = Math.min(room.z1 - inset, Math.max(room.z0 + inset, look.z));
        if (Math.hypot(x - look.x, z - look.z) > ROOM_CHIP_RANGE) continue;
        stage.project(x, 0.3, z, p);
        if (!p.visible || p.x < 20 || p.y < 70 || p.x > width - 20 || p.y > height - 20) continue;
        shown.add(room.id);
        let chip = this.roomChips.get(room.id);
        if (!chip) {
          chip = el('div', { class: `room-chip ${room.secure ? 'is-secure' : ''}` }, room.label);
          this.root.append(chip);
          this.roomChips.set(room.id, chip);
        }
        chip.style.left = `${p.x}px`;
        chip.style.top = `${p.y}px`;
      }
      // The camera's own room first, then the rest in view
      const names = [cam.room, ...[...shown].filter((id) => id !== cam.room)].map((id) => ROOMS.find((r) => r.id === id)?.label).filter(Boolean);
      const text = `Viewing: ${names.join(' \u00b7 ')}`;
      if (this.camRooms && this.camRooms.textContent !== text) this.camRooms.textContent = text;
    }
    for (const [id, chip] of this.roomChips) chip.hidden = !shown.has(id);

    // Propped door flags
    for (const d of DOORS) {
      const flag = this.doorFlags.get(d.id);
      const door = game.doors.get(d.id);
      const propped = door?.propped;
      flag.hidden = !propped;
      if (!propped) continue;
      const label = door.officerEnRoute ? 'PROPPED \u00b7 officer en route' : 'PROPPED \u00b7 send officer';
      if (flag.textContent !== label) flag.textContent = label;
      flag.classList.toggle('is-enroute', !!door.officerEnRoute);
      stage.project(d.x, 4, d.z, p);
      flag.style.left = `${p.x}px`;
      flag.style.top = `${p.y}px`;
    }
  }
}
