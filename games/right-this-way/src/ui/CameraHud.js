/* Overlay shown while zoomed into a security camera. */
import { $ } from './dom.js';

export class CameraHud {
  constructor(app) {
    this.root = $('#camera-hud');
    this.name = $('#cam-name');
    this.stageEl = $('#stage');
    $('#btn-cam-exit').addEventListener('click', () => app.game?.cameras.exit());
    $('#btn-cam-prev').addEventListener('click', () => app.game?.cameras.cycle(-1));
    $('#btn-cam-next').addEventListener('click', () => app.game?.cameras.cycle(1));
    app.bus.on('camera', ({ camera }) => {
      this.root.hidden = !camera;
      this.stageEl.classList.toggle('in-camera', !!camera);
      if (camera) this.name.textContent = `${camera.id.replace('cam', 'Cam ')} · ${camera.label}`;
    });
  }
}
