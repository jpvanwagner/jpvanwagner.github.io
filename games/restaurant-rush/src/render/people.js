// Figures that mirror sim actors: guests, runners, the cook and the bartender. Each starts as a
// simple stand-in (capsule body, round head) and swaps to a real, animated person once that
// avatar's files arrive (src/render/avatars.js); the stand-in's body stays as an invisible click
// target. Without the people files (the single-file build) the stand-ins simply stay.
import * as THREE from 'three';
import { scene, pickables } from './scene.js';
import { mat, COLORS } from './world.js';
import { G, bus } from '../state.js';

const figures = new Map();
const capsule = new THREE.CapsuleGeometry(0.17, 0.34, 4, 10);
const head = new THREE.SphereGeometry(0.14, 14, 10);
const hairGeo = new THREE.SphereGeometry(0.148, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
const legGeo = new THREE.BoxGeometry(0.09, 0.42, 0.11);

function makeFigure(a) {
  const g = new THREE.Group();
  const look = a.look || {};
  const body = new THREE.Group();
  g.add(body);
  const shirt = mat(look.shirt ?? 0x777777, { roughness: 0.8 });
  const torso = new THREE.Mesh(capsule, shirt);
  torso.position.y = 0.72;
  torso.castShadow = true;
  body.add(torso);
  if (look.apron) {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.02), mat(look.apron));
    apron.position.set(0, 0.6, 0.17);
    body.add(apron);
  }
  if (a.kind === 'cook') {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.2, 12), mat(0xffffff));
    hat.position.y = 1.2;
    body.add(hat);
  }
  const h = new THREE.Mesh(head, mat(look.skin ?? 0xe0b48f, { roughness: 0.7 }));
  h.position.y = 1.08;
  h.castShadow = true;
  body.add(h);
  const hair = new THREE.Mesh(hairGeo, mat(look.hair ?? 0x2a1d14, { roughness: 0.9 }));
  hair.position.set(0, 1.1, -0.01);
  hair.rotation.x = -0.25;
  body.add(hair);
  const legs = [];
  for (const sx of [-0.07, 0.07]) {
    const leg = new THREE.Mesh(legGeo, mat(0x2a2624));
    leg.geometry.translate(0, 0, 0);
    leg.position.set(sx, 0.21, 0);
    leg.castShadow = true;
    body.add(leg);
    legs.push(leg);
  }
  // Tray / carried things.
  const tray = new THREE.Group();
  tray.position.set(0.2, 0.95, 0.18);
  const trayTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16), mat(COLORS.black));
  tray.add(trayTop);
  const plates = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.02, 14), mat(COLORS.white));
    p.position.set(i ? 0.07 : -0.07, 0.02 + i * 0.03, 0);
    plates.add(p);
  }
  const glasses = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 10), mat(0xf2c25a, { transparent: true, opacity: 0.85 }));
    gl.position.set(Math.cos(i * 2.1) * 0.08, 0.07, Math.sin(i * 2.1) * 0.08);
    glasses.add(gl);
  }
  const tub = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.3), mat(0x6c7a86));
  tub.position.y = 0.06;
  tray.add(plates, glasses, tub);
  tray.visible = false;
  body.add(tray);

  const s = look.tall || 1;
  g.scale.setScalar(s);
  scene.add(g);
  if (a.kind === 'guest') {
    g.userData.pick = { type: 'party', id: a.partyId };
    pickables.push(g);
  }
  // Selection ring at the feet (used once the real person replaces the stand-in).
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  g.add(ring);
  const f = { g, body, torso, legs, tray, plates, glasses, tub, trayTop, ring, sel: false, av: null, clip: null };
  dressUp(a, f);
  return f;
}

// Which avatars a figure can wear: guests pick from the diners, cooks from the chefs, everyone
// else from the floor staff. Seeded by the person (staff id) so a hire looks the same every day.
const ROLE = { guest: 'guest', cook: 'chef', staff: 'staff', bartender: 'staff' };
// The avatar loader (GLTFLoader, the mesh decoder) is loaded with the first person (bundled in the build).
const avatarsModule = () => import('./avatars.js');
function dressUp(a, f) {
  avatarsModule()
    .then((m) => m.pickAvatar(ROLE[a.kind] || 'guest', a.staffId ?? a.id * 7 + (a.partyId || 0)).then(m.makeAvatar))
    .then((av) => {
      if (!av || figures.get(a.id) !== f) return;     // gone before it arrived
      f.av = av;
      for (const c of f.body.children) if (c !== f.tray) c.visible = false;
      f.torso.visible = false;                            // still takes clicks, invisibly
      f.g.add(av.root);
      f.g.scale.setScalar(a.look?.tall ? 0.96 + (a.look.tall - 1) * 0.5 : 1);
      f.tray.position.set(0.22, 1.08, 0.24);              // tray at a real person's hand height
      // Diners pick one of three ways of sitting, so a full room doesn't move in lockstep.
      f.sitClip = ['sit', 'sitRelaxed', 'sitThink'][(a.id * 13) % 3];
      play(f, 'idle', 0);
    })
    .catch(() => {});                                     // keep the stand-in
}

function play(f, name, fade = 0.3) {
  const next = f.av.actions[name] || f.av.actions.idle;
  if (!next || f.clip === next) return;
  next.reset().play();
  // Start long idle/sit clips somewhere random so neighbours aren't in step.
  if (name !== 'walk') next.time = Math.random() * next.getClip().duration;
  if (f.clip) next.crossFadeFrom(f.clip, fade, false);
  f.clip = next;
}

export function initPeople() {
  bus.on('actor:add', (a) => figures.set(a.id, makeFigure(a)));
  bus.on('actor:remove', (a) => {
    const f = figures.get(a.id);
    if (!f) return;
    scene.remove(f.g);
    const i = pickables.indexOf(f.g);
    if (i >= 0) pickables.splice(i, 1);
    figures.delete(a.id);
  });
}

export function clearPeople() {
  for (const f of figures.values()) {
    scene.remove(f.g);
    const i = pickables.indexOf(f.g);
    if (i >= 0) pickables.splice(i, 1);
  }
  figures.clear();
}

/** `dt`: game seconds since the last frame (0 while paused), for the people's animations. */
export function syncPeople(dt = 0) {
  for (const a of G.actors) {
    const f = figures.get(a.id);
    if (!f) continue;
    const walking = a.path.length > 0;
    f.g.position.set(a.x, 0, a.z);
    // Smoothly turn toward the facing direction.
    let d = a.face - f.g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    f.g.rotation.y += d * 0.25;
    f.g.visible = !(a.kind === 'cook' && G.view === 'kitchen');
    if (f.av) {
      // Real person: walk (steps matched to their speed), sit at the table, or stand.
      if (walking) { play(f, 'walk', 0.2); f.av.actions.walk && (f.av.actions.walk.timeScale = (a.speed || 1) / f.av.walkSpeed); }
      else if (a.seated) play(f, f.sitClip, 0.4);
      else play(f, a.kind === 'staff' && a.role === 'host' && G.parties.some((p) => p.state === 'queue') ? 'talk' : 'idle', 0.3);
      // Seated diners sit back onto the chair rather than standing in front of it.
      f.av.root.position.z = a.seated ? -0.18 : 0;
      f.av.mixer.update(dt);
      if (a.kind === 'guest') {
        const on = a.partyId === G.selectedPartyId;
        if (f.sel !== on) { f.sel = on; f.ring.visible = on; }
      }
      f.tray.visible = !!a.carrying;
      if (a.carrying) {
        f.plates.visible = a.carrying === 'food';
        f.glasses.visible = a.carrying === 'drink';
        f.tub.visible = a.carrying === 'dishes';
        f.trayTop.visible = a.carrying !== 'dishes';
      }
      continue;
    }
    const swing = walking ? Math.sin(a.walkPhase) * 0.5 : 0;
    f.legs[0].rotation.x = swing;
    f.legs[1].rotation.x = -swing;
    f.body.position.y = walking ? Math.abs(Math.sin(a.walkPhase)) * 0.04 : 0;
    if (a.seated) {
      // Sit: drop the body onto the chair and swing the legs forward.
      f.body.position.y = -0.3;
      f.legs[0].rotation.x = f.legs[1].rotation.x = -1.3;
      f.legs.forEach((l) => { l.position.z = 0.15; l.position.y = 0.36; });
    } else {
      f.legs.forEach((l) => { l.position.z = 0; l.position.y = 0.21; });
    }
    // (Visibility: the cook would stand between the kitchen camera and the oven mouth, so they're
    // hidden there, above. The bartender stays: the bar is shot from a stool, across the counter.)
    if (a.kind === 'guest') {
      const on = a.partyId === G.selectedPartyId;
      if (f.sel !== on) {
        f.sel = on;
        f.torso.material = on ? mat(0xffffff, { emissive: 0x8f1d21, emissiveIntensity: 0.7 }) : mat(a.look.shirt, { roughness: 0.8 });
      }
    }
    f.tray.visible = !!a.carrying;
    if (a.carrying) {
      f.plates.visible = a.carrying === 'food';
      f.glasses.visible = a.carrying === 'drink';
      f.tub.visible = a.carrying === 'dishes';
      f.trayTop.visible = a.carrying !== 'dishes';
    }
  }
}
