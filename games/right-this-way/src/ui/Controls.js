/*
 * Input: keyboard shortcuts plus mouse / touch / pen on the map.
 *
 * Keyboard   A D E P B  desk actions     1-3   answer top incidents
 *            [ ]  cycle cameras          Esc   back to map / close modal
 *            + - 0  zoom in / out / fit  arrows pan (when zoomed)
 *            Space pause   H help   F fullscreen   N all name tags
 * Mouse      wheel zoom, drag pan, click a door, double-click to fit
 * Touch      pinch zoom, drag pan, tap a door, double-tap to fit
 *
 * Hotkeys mirror the desk buttons so a 5-second entry window is playable
 * without the mouse.
 */
import * as THREE from 'three';
import { DeskActionId } from '../systems/DeskSystem.js';
import { roomAt, labelZoneAt } from '../data/layout.js';
import { prefs, setPref } from '../core/prefs.js';

const DESK_KEYS = {
  a: DeskActionId.ALLOW,
  d: DeskActionId.DENY,
  e: DeskActionId.ESCORT,
  p: DeskActionId.PRINT,
  t: DeskActionId.TEMP,
  o: DeskActionId.VERIFY_OFFICER,
  w: DeskActionId.WAIT,
  b: DeskActionId.CHECK,
};

const DRAG_THRESHOLD = 6; // px before a press becomes a drag
const DOUBLE_TAP_MS = 320;

export class Controls {
  constructor(app) {
    this.app = app;
    this.canvas = app.stage.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointers = new Map(); // pointerId -> { x, y, startX, startY, t }
    this.dragging = false;
    this.pinchDist = 0;
    this.lastTap = { t: 0, x: 0, y: 0 };

    window.addEventListener('keydown', (e) => this.#onKey(e));
    this.canvas.addEventListener('pointerdown', (e) => this.#onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.#onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.#onUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.#onUp(e, true));
    this.canvas.addEventListener('wheel', (e) => this.#onWheel(e), { passive: false });
    this.canvas.addEventListener('pointerleave', () => {
      app.personCard.hover(null);
      app.roomHighlighter.set(null);
    });
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  #onKey(e) {
    const { app } = this;
    const game = app.game;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement) return;
    const key = e.key.toLowerCase();

    // Settings menu: Backspace / Esc closes it; nothing else reaches the game.
    if (!app.screens.settings.hidden) {
      if (key === 'backspace' || key === 'escape') {
        e.preventDefault();
        app.screens.closeSettings();
      }
      return;
    }
    // Level briefing popup: Enter / Space starts the shift.
    if (!app.screens.briefing.hidden) return app.screens.briefingKey?.(e);
    // An open modal (ID check, visitor computer) gets the keyboard first.
    if (app.activeModal?.isOpen && app.activeModal.handleKey(e)) return;
    if (key === 'f') return app.toggleFullscreen();
    if (!game) return;
    if ([' ', 'escape', 'backspace', 'h', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault();
    if (game.ended || app.screens.blocking) return;

    if (key === ' ') return game.setPaused(!game.paused);
    if (key === 'h') return game.setPaused(true);
    if (game.paused) return;

    // Backspace is "back": in fullscreen the browser keeps Esc for itself (it exits
    // fullscreen), so Esc still works too but is only an alias.
    if (key === 'backspace' || key === 'escape') return game.cameras.exit();
    if (key === 'v') return game.desk.perform(DeskActionId.VERIFY);
    if (key === 'n') {
      setPref('allNames', !prefs.allNames);
      return;
    }
    if (key === ',') return app.stepSpeed(-1);
    if (key === '.') return app.stepSpeed(1);
    if (key === '[') return game.cameras.cycle(-1);
    if (key === ']') return game.cameras.cycle(1);
    if (key === '+' || key === '=') return app.rig.zoomAt(1.25);
    if (key === '-' || key === '_') return app.rig.zoomAt(1 / 1.25);
    if (key === '0') return app.rig.resetView();
    const nudge = { arrowleft: [-0.1, 0], arrowright: [0.1, 0], arrowup: [0, -0.1], arrowdown: [0, 0.1] }[key];
    if (nudge) return app.rig.nudge(...nudge);
    if (DESK_KEYS[key]) return game.desk.perform(DESK_KEYS[key]);

    // 1-3: first available response of the most urgent open incidents
    if (['1', '2', '3'].includes(key)) {
      const open = game.incidents.open.sort((a, b) => a.remaining - b.remaining);
      const incident = open[Number(key) - 1];
      const response = incident && game.incidents.responsesFor(incident).find((r) => r.enabled);
      if (response) game.incidents.respond(incident.id, response.id);
    }
  }

  // ---------------------------------------------------------------------------
  // Pointer (mouse, touch, pen) on the map canvas
  // ---------------------------------------------------------------------------

  #ndc(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  }

  #pinchInfo() {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  #onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    window.focus(); // when embedded in an iframe, take keyboard focus
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, t: performance.now() });
    if (this.pointers.size === 2) {
      this.dragging = true; // a pinch is never a tap
      const p = this.#pinchInfo();
      this.pinchDist = p.dist;
      this.pinchCenter = { x: p.cx, y: p.cy };
    }
  }

  #onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') this.#hover(e);
      return;
    }
    const rig = this.app.rig;
    const prev = { x: p.x, y: p.y };
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pointers.size >= 2) {
      const info = this.#pinchInfo();
      if (this.pinchDist > 0) rig.zoomAt(info.dist / this.pinchDist, this.#ndc(info.cx, info.cy));
      rig.dragBy(this.#ndc(this.pinchCenter.x, this.pinchCenter.y), this.#ndc(info.cx, info.cy));
      this.pinchDist = info.dist;
      this.pinchCenter = { x: info.cx, y: info.cy };
      return;
    }

    if (!this.dragging && Math.hypot(p.x - p.startX, p.y - p.startY) > DRAG_THRESHOLD) this.dragging = true;
    if (this.dragging) {
      rig.dragBy(this.#ndc(prev.x, prev.y), this.#ndc(p.x, p.y));
      this.canvas.style.cursor = rig.isZoomed ? 'grabbing' : 'default';
    }
  }

  #onUp(e, cancelled = false) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const wasDrag = this.dragging;
    if (this.pointers.size === 0) this.dragging = false;
    if (this.pointers.size === 1) {
      // Pinch ended with one finger still down: continue as a drag from here.
      const rest = [...this.pointers.values()][0];
      rest.startX = rest.x;
      rest.startY = rest.y;
    }
    if (cancelled || wasDrag) return;

    // A tap / click
    const now = performance.now();
    const isDouble = now - this.lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 30;
    this.lastTap = { t: isDouble ? 0 : now, x: e.clientX, y: e.clientY };
    if (isDouble) {
      this.app.rig.resetView();
      return;
    }
    const game = this.app.game;
    if (!game || game.paused || game.ended) return;
    const doorId = this.#pickDoor(e.clientX, e.clientY);
    // You can't reach the doors from the desk: a propped one gets an officer sent to it.
    if (doorId && game.doors.get(doorId)?.propped) return game.doors.sendOfficer(doorId);
    if (e.pointerType !== 'mouse') {
      // Touch: tap a person for their card, or a room to see its name.
      this.app.personCard.pin(this.app.personCard.pick(e.clientX, e.clientY, 30));
      this.#highlightRoom(e.clientX, e.clientY);
      clearTimeout(this.roomTimer);
      this.roomTimer = setTimeout(() => this.app.roomHighlighter.set(null), 2500);
    }
  }

  /** Which room is under this screen point (map view only). */
  #roomAt(x, y) {
    const rig = this.app.rig;
    if (rig.mode !== 'map' || rig.active) return null;
    this.raycaster.setFromCamera(this.#ndc(x, y), this.app.stage.camera);
    const hit = this.raycaster.ray.intersectPlane(this.ground, (this._hit ??= new THREE.Vector3()));
    return hit ? labelZoneAt(hit.x, hit.z) ?? roomAt(hit.x, hit.z) : null;
  }

  #highlightRoom(x, y) {
    this.app.roomHighlighter.set(this.#roomAt(x, y));
  }

  #onWheel(e) {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    this.app.rig.zoomAt(factor, this.#ndc(e.clientX, e.clientY));
  }

  #pickDoor(x, y) {
    const game = this.app.game;
    if (!game) return null;
    this.raycaster.setFromCamera(this.#ndc(x, y), this.app.stage.camera);
    const hit = this.raycaster.intersectObjects(game.doors.hitTargets(), false)[0];
    return hit?.object.userData.doorId ?? null;
  }

  #hover(e) {
    const doorId = this.#pickDoor(e.clientX, e.clientY);
    const inCamera = this.app.rig.mode === 'camera';
    const person = this.app.personCard.pick(e.clientX, e.clientY, inCamera ? 34 : 16);
    this.app.personCard.hover(person);
    this.#highlightRoom(e.clientX, e.clientY);
    const propped = doorId && this.app.game?.doors.get(doorId)?.propped;
    this.canvas.style.cursor = propped ? 'pointer' : person ? 'help' : this.app.rig.isZoomed ? 'grab' : 'default';
  }
}
