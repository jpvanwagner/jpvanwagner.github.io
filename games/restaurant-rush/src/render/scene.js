// three.js setup: renderer, lights, and a single camera that glides between the overhead
// floor map and close-up 3D views of each station.
import * as THREE from 'three';
import { WORLD, BAR, KITCHEN } from '../data/layout.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141012);

export const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
export let renderer;
let host;

const camState = {
  pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 32,
  from: null, to: null, t: 1, dur: 0.7,
};

export function initRenderer(el) {
  host = el;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a2a24, 1.35));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.6);
  sun.position.set(WORLD.w * 0.3, 22, WORLD.d * 0.9);
  sun.target.position.set(WORLD.w / 2, 0, WORLD.d / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 13, bottom: -13, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // Warm pendant pools over the bar and the pass.
  for (const [x, z] of [[6.5, 5.2]]) {
    const l = new THREE.PointLight(0xffc98a, 6, 6, 1.6);
    l.position.set(x, 2.4, z);
    scene.add(l);
  }
  resize();
  window.addEventListener('resize', resize);
  setView('floor', null, true);
}

export function resize() {
  if (!host || !renderer) return;
  const w = host.clientWidth || 1, h = host.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (camState.t >= 1) { const v = viewFor(currentView, currentArg); camState.pos.copy(v.pos); camState.look.copy(v.look); camState.fov = v.fov; applyCam(); }
  camera.updateProjectionMatrix();
}

let currentView = 'floor';
let currentArg = null;

function viewFor(view, arg) {
  if (view === 'bar') {
    // From a bar stool, looking across the counter at the glass, the bartender and the lit back bar.
    return { pos: new THREE.Vector3(BAR.workGlass.x - 1.75, 1.7, BAR.workGlass.z), look: new THREE.Vector3(BAR.workGlass.x + 1.0, 1.04, BAR.workGlass.z), fov: 44 };
  }
  if (view === 'kitchen') {
    // Fit the whole line (oven at x≈0.4 to prep at x≈11.8) into the part of the screen to the
    // right of the ticket rail, backing the camera off as far as that takes.
    const aspect = camera.aspect || 1.6;
    const fov = 52;
    const width = host?.clientWidth || 1200;
    const rail = Math.min(230, width * 0.3);
    const usable = (width - rail) / width;
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect;
    const d = Math.max(5.3, 6.1 / (tanH * usable));
    const cx = 6.2 - (rail / width) * tanH * d;
    return { pos: new THREE.Vector3(cx, 0.7 + 0.698 * d, 1.4 + 0.717 * d), look: new THREE.Vector3(cx, 0.7, 1.4), fov };
  }
  if (view === 'table' && arg) {
    return { pos: new THREE.Vector3(arg.x, 3.3, arg.z + 3.1), look: new THREE.Vector3(arg.x, 0.6, arg.z), fov: 45 };
  }
  // Overhead: fit the whole floor plan.
  const fov = 32;
  const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const aspect = camera.aspect || 1.6;
  const halfD = WORLD.d / 2 + 0.6, halfW = WORLD.w / 2 + 0.6;
  const h = Math.max(halfD / tan, halfW / (tan * aspect));
  const cx = WORLD.w / 2, cz = WORLD.d / 2 + 0.2;
  return { pos: new THREE.Vector3(cx, h, cz + h * 0.16), look: new THREE.Vector3(cx, 0, cz + 0.35), fov };
}

export function setView(view, arg, instant = false) {
  currentView = view;
  currentArg = arg;
  const to = viewFor(view, arg);
  if (instant) {
    camState.pos.copy(to.pos); camState.look.copy(to.look); camState.fov = to.fov; camState.t = 1;
    applyCam();
    return;
  }
  camState.from = { pos: camState.pos.clone(), look: camState.look.clone(), fov: camState.fov };
  camState.to = to;
  camState.t = 0;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function updateCamera(realDt) {
  if (camState.t < 1 && camState.to) {
    camState.t = Math.min(1, camState.t + realDt / camState.dur);
    const k = ease(camState.t);
    camState.pos.lerpVectors(camState.from.pos, camState.to.pos, k);
    camState.look.lerpVectors(camState.from.look, camState.to.look, k);
    // Arc upward mid-flight so the zoom reads as "dropping down into" the station.
    const lift = Math.sin(k * Math.PI) * 2.5 * (camState.from.pos.distanceTo(camState.to.pos) > 6 ? 1 : 0);
    camState.pos.y += lift;
    camState.fov = camState.from.fov + (camState.to.fov - camState.from.fov) * k;
    applyCam();
  }
}

export const isTransitioning = () => camState.t < 1;

function applyCam() {
  camera.position.copy(camState.pos);
  camera.lookAt(camState.look);
  camera.fov = camState.fov;
  camera.updateProjectionMatrix();
}

export function render() { renderer.render(scene, camera); }

// ── Picking ────────────────────────────────────────────────────────────────
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
export const pickables = [];

export function pick(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.pick) o = o.parent;
    if (o && o.visible !== false) return o.userData.pick;
  }
  return null;
}

/** World → CSS pixel position inside the stage. Returns null when behind the camera. */
const tmp = new THREE.Vector3();
export function toScreen(x, y, z) {
  tmp.set(x, y, z).project(camera);
  if (tmp.z > 1) return null;
  const w = host.clientWidth, h = host.clientHeight;
  return { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h };
}
