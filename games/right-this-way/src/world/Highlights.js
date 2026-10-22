/*
 * Optional pulsing floor glows (Settings):
 *   - officer highlight: under every officer
 *   - trouble highlight: under unescorted visitors (red), visitors asking for
 *     the restroom or left in a lounge (amber), and propped-open doors (amber)
 *
 * A small pool of soft discs lives in the scene root (not the per-shift
 * dynamic root) and is reused every frame.
 */
import * as THREE from 'three';
import { PersonState } from '../entities/Person.js';

const COLORS = { officer: 0x6fb2ff, danger: 0xff4d3d, warn: 0xffb020 };

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Highlights {
  constructor(stage) {
    this.stage = stage;
    this.pool = [];
    this.texture = typeof document === 'undefined' ? null : glowTexture();
  }

  #disc(i) {
    let m = this.pool[i];
    if (!m) {
      m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 4;
      this.stage.scene.add(m);
      this.pool.push(m);
    }
    return m;
  }

  tick(game, prefs, t) {
    const targets = [];
    if (game) {
      for (const p of game.people) {
        if (p.removed) continue;
        if (prefs.officerHighlight && p.isOfficer) targets.push([p.pos.x, p.pos.z, 'officer', 4.2]);
        if (!prefs.incidentHighlight || !p.isGuest) continue;
        if (p.state === PersonState.WANDERING || p.unescortedTrip) targets.push([p.pos.x, p.pos.z, 'danger', 5]);
        else if (p.state === PersonState.LOUNGING || p.restroomRequest?.status === 'open') targets.push([p.pos.x, p.pos.z, 'warn', 4.2]);
      }
      if (prefs.incidentHighlight) for (const d of game.doors.proppedDoors()) targets.push([d.def.x, d.def.z, 'warn', 6]);
    }
    const pulse = 0.82 + Math.sin(t * 4) * 0.18;
    targets.forEach(([x, z, kind, size], i) => {
      const m = this.#disc(i);
      m.visible = true;
      m.position.set(x, 0.09, z);
      m.scale.setScalar(size * pulse);
      m.material.color.setHex(COLORS[kind]);
      m.material.opacity = kind === 'officer' ? 0.55 : 0.7;
    });
    for (let i = targets.length; i < this.pool.length; i++) this.pool[i].visible = false;
  }
}
