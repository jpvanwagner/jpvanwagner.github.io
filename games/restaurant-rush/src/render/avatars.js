// Real people for the little figures: Microsoft Rocketbox avatars (MIT licence), converted by
// scripts/people/build.mjs into people/*.js. Nothing here is loaded until a figure asks for it,
// each model is fetched once and shared by everyone wearing it, and if the files aren't there
// (or are slow) the simple stand-in figures stay.
//
// Each person is a small classic script that calls window.__rrPeople(name, gltfJson) with its
// textures inside. That works on a web host AND from a double-clicked index.html (file://), where
// browsers block fetch() and won't let WebGL use images loaded from disk.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = 'people/';
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

const waiting = new Map();    // name → { resolve, reject }
window.__rrPeople = (name, data) => { waiting.get(name)?.resolve(data); waiting.delete(name); };
const scripts = new Map();    // name → Promise<data>
function loadScript(name) {
  if (!scripts.has(name)) {
    scripts.set(name, new Promise((resolve, reject) => {
      waiting.set(name, { resolve, reject });
      const el = document.createElement('script');
      el.src = `${BASE}${name}.js`;
      el.async = true;
      el.onerror = () => { waiting.delete(name); reject(new Error(`could not load ${el.src}`)); };
      document.head.append(el);
    }));
  }
  return scripts.get(name);
}
const load = (name) => loadScript(name).then((json) => loader.parseAsync(JSON.stringify(json), ''));

let manifest = null;
const models = new Map();     // avatar id → Promise<gltf>
const clipSets = new Map();   // 'm' | 'f' → Promise<{ name: AnimationClip }>

/** The list of avatars (null if the people files aren't available). Loaded once. */
export function people() {
  manifest ||= loadScript('manifest').catch(() => null);
  return manifest;
}

function clips(sex) {
  if (!clipSets.has(sex)) {
    clipSets.set(sex, people().then((m) => load(m.clips[sex])).then((g) => {
      const out = {};
      for (const c of g.animations) out[c.name] = c;
      out.walkSpeed = 1;
      return out;
    }));
  }
  return clipSets.get(sex);
}

/** Pick an avatar for a figure: by role (guest, chef, staff), stable for a given seed. */
export async function pickAvatar(role, seed) {
  const m = await people();
  if (!m) return null;
  const pool = m.avatars.filter((a) => a.role === role);
  const list = pool.length ? pool : m.avatars.filter((a) => a.role === 'guest');
  return list[Math.abs(seed) % list.length] || null;
}

/** A ready-to-use copy of an avatar: { root, mixer, actions, walkSpeed }, or null. */
export async function makeAvatar(entry) {
  if (!entry) return null;
  if (!models.has(entry.id)) models.set(entry.id, load(entry.file));
  const [gltf, set, m] = await Promise.all([models.get(entry.id), clips(entry.sex), people()]);
  const root = cloneSkinned(gltf.scene);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = !/opacity/i.test(o.material.name);   // lashes and hair cards don't need shadows
    o.receiveShadow = false;
    o.frustumCulled = false;      // skinned bounds follow the bind pose, not the sitting pose
    o.raycast = () => {};         // clicks go to the figure's simple hit shape, not 5,000 triangles
  });
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const [name, clip] of Object.entries(set)) if (clip instanceof THREE.AnimationClip) actions[name] = mixer.clipAction(clip);
  return { root, mixer, actions, walkSpeed: m.clips[`${entry.sex}:walkSpeed`] || 1 };
}
