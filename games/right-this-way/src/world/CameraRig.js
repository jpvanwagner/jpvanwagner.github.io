/*
 * Flies the stage camera between the flat top-down map and zoomed 3D views.
 *
 * A "view" is { position, target, up, fov }. Tweening lerps all four and
 * calls lookAt every frame, which avoids the Euler-angle flips the prototype
 * had when tweening rotations directly.
 *
 * The map view can also be zoomed (wheel / pinch / buttons) and panned
 * (drag / arrow keys); zoom 1 always fits the whole facility to the stage,
 * whatever its size or orientation.
 */
import * as THREE from 'three';
import { tween, Ease } from '../core/tween.js';
import { BOUNDS, WALL_HEIGHT } from '../data/layout.js';

const MAP_FOV = 22;
const CAM_FOV = 52;
const MAX_ZOOM = 5;
const MAP_W = BOUNDS.x1 - BOUNDS.x0;
const MAP_D = BOUNDS.z1 - BOUNDS.z0;
const MAP_CX = (BOUNDS.x0 + BOUNDS.x1) / 2;
const MAP_CZ = (BOUNDS.z0 + BOUNDS.z1) / 2;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export class CameraRig {
  constructor(stage) {
    this.stage = stage;
    this.mode = 'map';
    this.zoom = 1;
    this.pan = new THREE.Vector2(0, 0); // world x / z offset of the map centre
    this.listeners = new Set();
    this.raycaster = new THREE.Raycaster();
    this.current = this.mapView();
    this.apply(this.current);
    stage.onResize(() => this.#refreshMap());
  }

  /** Called with no args whenever zoom / pan / mode changes (UI buttons listen). */
  onChange(fn) {
    this.listeners.add(fn);
  }

  #emit() {
    this.listeners.forEach((fn) => fn());
  }

  get isZoomed() {
    return this.zoom > 1.01;
  }

  /** Camera height (above the ground) that fits the whole map at zoom 1. */
  #fitHeight() {
    const tan = Math.tan(THREE.MathUtils.degToRad(MAP_FOV / 2));
    return Math.max(MAP_D / 2 / tan, MAP_W / 2 / (tan * this.stage.camera.aspect)) * 1.03;
  }

  /** Keeps the visible area over the facility when zoomed in. */
  #clampPan() {
    const tan = Math.tan(THREE.MathUtils.degToRad(MAP_FOV / 2));
    const visD = 2 * (this.#fitHeight() / this.zoom) * tan;
    const visW = visD * this.stage.camera.aspect;
    const maxX = Math.max(0, (MAP_W - visW) / 2);
    const maxZ = Math.max(0, (MAP_D - visD) / 2);
    this.pan.x = THREE.MathUtils.clamp(this.pan.x, -maxX, maxX);
    this.pan.y = THREE.MathUtils.clamp(this.pan.y, -maxZ, maxZ);
  }

  /** Top-down view: fitted to the facility at zoom 1, closer when zoomed. */
  mapView() {
    this.#clampPan();
    const height = this.#fitHeight() / this.zoom + WALL_HEIGHT;
    const x = MAP_CX + this.pan.x;
    const z = MAP_CZ + this.pan.y;
    return {
      position: new THREE.Vector3(x, height, z),
      target: new THREE.Vector3(x, 0, z),
      up: new THREE.Vector3(0, 0, -1),
      fov: MAP_FOV,
    };
  }

  /** Re-apply the map view immediately (after resize, zoom or pan). */
  #refreshMap() {
    if (this.mode !== 'map' || this.active) return;
    this.current = this.mapView();
    this.apply(this.current);
  }

  get canNavigate() {
    return this.mode === 'map' && !this.active;
  }

  /** World point on the floor under a normalized-device-coordinate position. */
  groundPoint(ndc) {
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    return this.raycaster.ray.intersectPlane(GROUND, new THREE.Vector3());
  }

  /** Zoom by `factor` keeping the floor point under `ndc` fixed (cursor / pinch centre). */
  zoomAt(factor, ndc = new THREE.Vector2(0, 0)) {
    if (!this.canNavigate) return;
    const before = this.groundPoint(ndc);
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, 1, MAX_ZOOM);
    this.#refreshMap();
    const after = this.groundPoint(ndc);
    if (before && after) {
      this.pan.x += before.x - after.x;
      this.pan.y += before.z - after.z;
      this.#refreshMap();
    }
    this.#emit();
  }

  /** Drag the map: the floor point under `fromNdc` moves to `toNdc`. */
  dragBy(fromNdc, toNdc) {
    if (!this.canNavigate || !this.isZoomed) return;
    const a = this.groundPoint(fromNdc);
    const b = this.groundPoint(toNdc);
    if (!a || !b) return;
    this.pan.x += a.x - b.x;
    this.pan.y += a.z - b.z;
    this.#refreshMap();
  }

  /** Pan by a fraction of the visible area (keyboard). */
  nudge(fx, fz) {
    if (!this.canNavigate || !this.isZoomed) return;
    const visW = MAP_W / this.zoom;
    this.pan.x += fx * visW;
    this.pan.y += fz * visW;
    this.#refreshMap();
  }

  resetView() {
    this.zoom = 1;
    this.pan.set(0, 0);
    if (this.mode === 'map') this.flyTo(this.mapView(), 'map', 0.35);
    this.#emit();
  }

  /** Over-the-shoulder isometric-ish view from a wall-mounted camera. */
  securityView(cam) {
    const dir = new THREE.Vector2(cam.mount.x - cam.look.x, cam.mount.z - cam.look.z).normalize();
    return {
      position: new THREE.Vector3(cam.mount.x + dir.x * 4, 15, cam.mount.z + dir.y * 4),
      target: new THREE.Vector3(cam.look.x, 0, cam.look.z),
      up: new THREE.Vector3(0, 1, 0),
      fov: this.#cameraFov(),
    };
  }

  /** Vertical FOV for camera views, widened on tall/narrow stages (phones) so the room still fits. */
  #cameraFov() {
    const minHorizontal = THREE.MathUtils.degToRad(68);
    const needed = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minHorizontal / 2) / this.stage.camera.aspect));
    return THREE.MathUtils.clamp(needed, CAM_FOV, 85);
  }

  apply(view) {
    const cam = this.stage.camera;
    cam.position.copy(view.position);
    cam.up.copy(view.up).normalize();
    cam.fov = view.fov;
    cam.updateProjectionMatrix();
    cam.lookAt(view.target);
  }

  flyTo(view, mode, duration = 1.0) {
    if (this.instant) duration = 0.001; // Settings: smooth camera flights off
    this.active?.cancel();
    const from = {
      position: this.current.position.clone(),
      target: this.current.target.clone(),
      up: this.current.up.clone(),
      fov: this.current.fov,
    };
    this.mode = mode;
    this.#emit();
    const scratch = { position: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(), fov: 0 };
    this.active = tween({
      duration,
      ease: Ease.inOutCubic,
      onUpdate: (t) => {
        scratch.position.lerpVectors(from.position, view.position, t);
        scratch.target.lerpVectors(from.target, view.target, t);
        scratch.up.lerpVectors(from.up, view.up, t);
        if (scratch.up.lengthSq() < 1e-4) scratch.up.set(0, 1, 0);
        scratch.fov = from.fov + (view.fov - from.fov) * t;
        this.apply(scratch);
        this.current = {
          position: scratch.position.clone(),
          target: scratch.target.clone(),
          up: scratch.up.clone(),
          fov: scratch.fov,
        };
      },
      onComplete: () => {
        this.active = null;
        this.current = view;
        this.#emit();
      },
    });
  }

  showMap(duration) {
    this.flyTo(this.mapView(), 'map', duration);
  }

  showCamera(cam, duration) {
    this.flyTo(this.securityView(cam), 'camera', duration);
  }
}
