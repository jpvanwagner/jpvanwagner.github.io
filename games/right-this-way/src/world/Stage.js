/*
 * Owns the three.js renderer, scene, lights and the single perspective camera.
 * A narrow field of view from high above gives the flat "2D map" look while
 * letting CameraRig fly the same camera into 3D security-camera views.
 */
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export class Stage {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.background);

    this.camera = new THREE.PerspectiveCamera(22, 1, 1, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    // Touch devices are usually phones/tablets: cap resolution and shadow cost.
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Warm office lighting: high ambient keeps the map readable; the sun
    // travels across the sky over the shift (see setDaylight).
    this.hemi = new THREE.HemisphereLight(0xfff6e8, 0xc9bda6, 1.55);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.45);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 65, bottom: -65, near: 10, far: 260 });
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 3;
    sun.target.position.set(5, 0, -13);
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.setDaylight(0);
    this.animators = [];

    this.staticRoot = new THREE.Group(); // floors, walls, furniture (built once)
    this.dynamicRoot = new THREE.Group(); // people, rings, tethers (rebuilt per shift)
    this.scene.add(this.staticRoot, this.dynamicRoot);

    this.size = { width: 1, height: 1 };
    this.resizeListeners = new Set();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.size = { width, height };
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.resizeListeners.forEach((fn) => fn(this.size));
  }

  /** 0 = start of shift (morning, low eastern sun) .. 1 = end of shift. */
  setDaylight(progress) {
    const p = Math.max(0, Math.min(1, progress));
    const angle = THREE.MathUtils.lerp(-0.9, 0.9, p); // east -> west
    this.sun.position.set(5 + Math.sin(angle) * -90, 80 + Math.cos(angle) * 30, -13 + 55);
    const warm = 1 - Math.sin(p * Math.PI); // warmer at the ends of the shift
    this.sun.color.setRGB(1, 0.94 - warm * 0.06, 0.86 - warm * 0.12);
  }

  /** Register fn(dt, time) to run every frame (ambient animation). */
  addAnimator(fn) {
    this.animators.push(fn);
  }

  runAnimators(dt) {
    this.elapsed = (this.elapsed ?? 0) + dt;
    for (const fn of this.animators) fn(dt, this.elapsed);
  }

  onResize(fn) {
    this.resizeListeners.add(fn);
  }

  clearDynamic() {
    for (const child of [...this.dynamicRoot.children]) this.dynamicRoot.remove(child);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** World position -> container pixel coordinates. */
  project(x, y, z, out = { x: 0, y: 0, visible: false }) {
    const v = (this._v ??= new THREE.Vector3()).set(x, y, z).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * this.size.width;
    out.y = (-v.y * 0.5 + 0.5) * this.size.height;
    out.visible = v.z > -1 && v.z < 1 && out.x > -50 && out.y > -50 && out.x < this.size.width + 50 && out.y < this.size.height + 50;
    return out;
  }

  /** Pointer event -> normalized device coordinates for raycasting. */
  pointerNdc(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  }
}
