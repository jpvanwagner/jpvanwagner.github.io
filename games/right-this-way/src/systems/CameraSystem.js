/*
 * Security cameras: the "zoom-in" from the 2D map into a 3D view.
 *
 * Viewing a camera flies the stage camera into that room and lights the
 * device's red recording LED (blinking). Unescorted visitors in a watched
 * room are deterred (see WanderSystem) unless they have stopped caring.
 */
import { CAMERAS } from '../data/layout.js';
import { PALETTE } from '../world/palette.js';

export class CameraSystem {
  constructor(game, rig, devices) {
    this.game = game;
    this.rig = rig;
    this.devices = devices; // Map camId -> { group, ledMat }
    this.active = null;
    this.blink = 0;
  }

  get activeRoom() {
    return this.active?.room ?? null;
  }

  list() {
    return CAMERAS;
  }

  view(cam) {
    if (!cam) return;
    this.active = cam;
    this.rig.showCamera(cam);
    this.game.bus.emit('camera', { camera: cam });
  }

  exit() {
    if (!this.active) return;
    this.active = null;
    this.rig.showMap();
    this.game.bus.emit('camera', { camera: null });
  }

  /** Cycle through cameras (keyboard: [ and ]). */
  cycle(step) {
    const idx = this.active ? CAMERAS.indexOf(this.active) : -1;
    const next = CAMERAS[(idx + step + CAMERAS.length) % CAMERAS.length];
    this.view(next);
  }

  /** Visual only - runs on real time so the LED blinks while paused too. */
  animate(realDt) {
    this.blink += realDt;
    const on = Math.floor(this.blink * 2.5) % 2 === 0;
    for (const [id, device] of this.devices) {
      const lit = this.active?.id === id && on;
      device.ledMat.color.setHex(lit ? PALETTE.camera.ledOn : PALETTE.camera.ledOff);
    }
  }

  reset() {
    this.active = null;
    this.rig.showMap(0.01);
  }
}
