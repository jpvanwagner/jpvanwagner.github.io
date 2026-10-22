/*
 * Mesh factories. Every visible object is built here so the look of the game
 * can be restyled without touching gameplay code.
 */
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { PersonType } from '../config/entityTypes.js';
import { orgLogoSvg } from '../data/organization.js';
import { companyLogoSvg } from '../data/companies.js';

const box = (w, h, d, color, opts = {}) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

// ---------------------------------------------------------------------------
// People: legs, torso, arms, head, hair. From above, the shoulders read as a
// coloured disc around the head (orange visitor, green employee, dark
// officer), so the sketch's colour-coded dots still work at map zoom.
// ---------------------------------------------------------------------------
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...opts });
const SHARED = {
  limb: new THREE.CapsuleGeometry(0.2, 0.75, 4, 8),
  arm: new THREE.CapsuleGeometry(0.15, 0.7, 4, 8),
  torso: new THREE.CapsuleGeometry(0.5, 0.65, 6, 14),
  head: new THREE.SphereGeometry(0.42, 18, 14),
  hairCap: new THREE.SphereGeometry(0.45, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  bun: new THREE.SphereGeometry(0.2, 10, 8),
  shoe: new THREE.BoxGeometry(0.28, 0.14, 0.42),
};

function addHair(head, a) {
  if (a.hairStyle === 'bald') return;
  const hairMat = mat(a.hair, { roughness: 0.9 });
  const cap = new THREE.Mesh(SHARED.hairCap, hairMat);
  cap.position.y = 0.04;
  if (a.hairStyle === 'buzz') cap.scale.setScalar(0.97);
  if (a.hairStyle === 'curly') cap.scale.set(1.12, 1.12, 1.12);
  head.add(cap);
  if (a.hairStyle === 'long' || a.hairStyle === 'bob') {
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.4, a.hairStyle === 'long' ? 0.75 : 0.4, 14, 1, true, Math.PI * 0.6, Math.PI * 0.8), hairMat);
    back.position.y = a.hairStyle === 'long' ? -0.3 : -0.12;
    back.material.side = THREE.DoubleSide;
    head.add(back);
  }
  if (a.hairStyle === 'bun' || a.hairStyle === 'ponytail') {
    const bun = new THREE.Mesh(SHARED.bun, hairMat);
    bun.position.set(0, a.hairStyle === 'bun' ? 0.38 : 0.05, -0.42);
    if (a.hairStyle === 'ponytail') bun.scale.set(0.8, 1.6, 0.8);
    head.add(bun);
  }
}

function addFacialHair(head, a) {
  if (!a.facialHair) return;
  const m = mat(a.hair, { roughness: 0.95, transparent: a.facialHair === 'stubble', opacity: a.facialHair === 'stubble' ? 0.45 : 1 });
  const piece = (w, h, d, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(0, y, z);
    head.add(mesh);
  };
  if (a.facialHair === 'beard' || a.facialHair === 'stubble') piece(0.5, 0.26, 0.2, -0.22, 0.31);
  if (a.facialHair === 'beard' || a.facialHair === 'mustache') piece(0.26, 0.06, 0.07, -0.08, 0.4);
  if (a.facialHair === 'goatee') piece(0.15, 0.17, 0.1, -0.3, 0.35);
}

export function createPersonMesh(type, a, { company = null } = {}) {
  const group = new THREE.Group();
  const rig = new THREE.Group(); // everything that bobs / leans while walking
  rig.scale.setScalar(a.height);
  group.add(rig);

  const pantsMat = mat(a.pants);
  const shirtMat = mat(a.shirt, { roughness: 0.7 });
  const skinMat = mat(a.skin, { roughness: 0.6 });
  const shoeMat = mat(0x24211f);

  const legs = [-0.22, 0.22].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.15, 0);
    const leg = new THREE.Mesh(SHARED.limb, pantsMat);
    leg.position.y = -0.55;
    leg.castShadow = true;
    const shoe = new THREE.Mesh(SHARED.shoe, shoeMat);
    shoe.position.set(0, -1.08, 0.08);
    pivot.add(leg, shoe);
    rig.add(pivot);
    return pivot;
  });

  const torso = new THREE.Mesh(SHARED.torso, shirtMat);
  torso.position.y = 1.72;
  torso.scale.set(1, 1, 0.72);
  torso.castShadow = true;
  rig.add(torso);

  const arms = [-0.62, 0.62].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 2.15, 0);
    const sleeve = new THREE.Mesh(SHARED.arm, shirtMat);
    sleeve.position.y = -0.42;
    sleeve.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), skinMat);
    hand.position.y = -0.9;
    pivot.add(sleeve, hand);
    rig.add(pivot);
    return pivot;
  });

  const head = new THREE.Mesh(SHARED.head, skinMat);
  head.position.y = 2.72;
  head.castShadow = true;
  rig.add(head);
  addHair(head, a);

  addFacialHair(head, a);

  if (a.glasses) {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 14), mat(0x1c1c1c));
    const left = frame.clone();
    left.position.set(-0.15, 0.04, 0.38);
    const right = frame.clone();
    right.position.set(0.15, 0.04, 0.38);
    head.add(left, right);
  }

  if (type === PersonType.OFFICER) {
    // Peaked cap with a light crown band: a dark ring with a pale centre from above.
    const capMat = mat(0x141b26, { roughness: 0.5 });
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.44, 0.26, 18), capMat);
    crown.position.y = 0.3;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 18), mat(0xe9e4d8));
    top.position.y = 0.44;
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), capMat);
    peak.position.set(0, 0.2, 0.45);
    head.add(crown, top, peak);
    // Shoulder epaulettes + chest badge
    for (const x of [-0.45, 0.45]) {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.4), mat(0xc9a646, { metalness: 0.4, roughness: 0.4 }));
      ep.position.set(x, 2.28, 0);
      rig.add(ep);
    }
  }

  // Badge on the chest: officers wear The Organization's seal; staff a lanyard
  // card; for visitors it appears once a pass is printed.
  const badge = type === PersonType.OFFICER
    ? createOrgBadge()
    : type === PersonType.EMPLOYEE && company
      ? createCompanyBadge(company)
      : new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.06), mat(type === PersonType.GUEST ? 0xfafafa : 0x2f6fb0, { roughness: 0.4 }));
  badge.position.set(0.18, 1.85, 0.38);
  badge.visible = type !== PersonType.GUEST;
  rig.add(badge);

  group.scale.setScalar(1.12);
  group.userData = { rig, legs, arms, head, torso, badge, body: torso };
  return group;
}

/** Walk cycle / idle sway. `phase` advances with distance walked. */
export function animatePerson(mesh, phase, moving, time) {
  const { legs, arms, rig } = mesh.userData;
  const swing = moving ? Math.sin(phase) * 0.6 : 0;
  legs[0].rotation.x = swing;
  legs[1].rotation.x = -swing;
  arms[0].rotation.x = -swing * 0.8;
  arms[1].rotation.x = swing * 0.8;
  rig.position.y = moving ? Math.abs(Math.cos(phase)) * 0.06 : Math.sin(time * 1.6) * 0.015;
}

/** Flat ring decal on the floor (desk highlight, unescorted warning...). */
export function createRing(color, radius = 1.35, opacity = 0.75) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.78, radius, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.renderOrder = 2;
  return ring;
}

/** Line between an escort and the visitor they are responsible for. */
export function createTether() {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(
    geo,
    new THREE.LineDashedMaterial({ color: PALETTE.tether, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.8 }),
  );
  line.frustumCulled = false;
  return line;
}

// SVG logos rasterised once into textures (badges, the lobby floor decal).
const svgTextures = new Map();
export function svgTexture(key, svg, size = 128) {
  if (svgTextures.has(key) || typeof document === 'undefined') return svgTextures.get(key) ?? null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    canvas.getContext('2d').drawImage(img, 0, 0, size, size);
    tex.needsUpdate = true;
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  svgTextures.set(key, tex);
  return tex;
}

// The Organization's seal, shared by every officer's badge.
const orgSeal = () => svgTexture('org-seal', orgLogoSvg({ size: 128, font: 'Arial, Helvetica, sans-serif', title: false }));

/** The employer's logo painted on the visitor center floor. */
export function createLogoDecal(company, size) {
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: svgTexture(`decal-${company.id}`, companyLogoSvg(company, { size: 512, title: false }), 512), transparent: true, opacity: 0.42, depthWrite: false }),
  );
  decal.rotation.x = -Math.PI / 2;
  decal.renderOrder = 1;
  return decal;
}

/** Employees: a white lanyard card with the employer's logo. */
function createCompanyBadge(company) {
  const badge = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.05), mat(0xf7f7f4, { roughness: 0.4 }));
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.34),
    new THREE.MeshBasicMaterial({ map: svgTexture(`logo-${company.id}`, companyLogoSvg(company, { size: 128, title: false })), transparent: true }),
  );
  logo.position.set(0, 0.04, 0.027);
  badge.add(card, logo);
  return badge;
}

function createOrgBadge() {
  const badge = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x111014, roughness: 0.4, metalness: 0.3 }));
  rim.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24), new THREE.MeshBasicMaterial({ map: orgSeal(), color: 0xffffff }));
  face.position.z = 0.027;
  badge.add(rim, face);
  return badge;
}

// ---------------------------------------------------------------------------
// Doors: a pivot group hinged at one end of the gap, plus floor-plan style
// markings (threshold mat, coloured frame, badge reader) so every
// opening stands out from the walls on the map and in 3D.
// ---------------------------------------------------------------------------
function doorColors(door) {
  const D = PALETTE.door;
  if (door.kind === 'glass') return { leaf: D.glass, frame: D.plainFrame, mat: D.plainMat };
  return door.secure
    ? { leaf: D.secure, frame: D.secureFrame, mat: D.secureMat }
    : { leaf: D.plain, frame: D.plainFrame, mat: D.plainMat };
}

/** Static markings around a doorway (also used for the always-open entrance). */
export function createDoorDecor(door, axis, wallHeight) {
  const colors = doorColors(door);
  const group = new THREE.Group();
  group.position.set(door.x, 0, door.z);
  if (axis === 'v') group.rotation.y = -Math.PI / 2; // build along local x, rotate into place

  // Threshold mat across the opening, both sides of the wall
  const matMaterial = new THREE.MeshBasicMaterial({ color: colors.mat, transparent: true, opacity: 0.55, depthWrite: false });
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(door.width, 2.6), matMaterial);
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = 0.025;
  mat.renderOrder = 1;
  group.add(mat);

  // Door frame: coloured jambs at both ends of the gap, taller than the wall
  for (const sx of [-1, 1]) {
    const jamb = box(0.45, wallHeight + 0.35, 0.95, colors.frame, { roughness: 0.5 });
    jamb.position.set(sx * (door.width / 2 + 0.05), (wallHeight + 0.35) / 2, 0);
    group.add(jamb);
  }

  let readerMat = null;

  // Badge reader beside secure doors: red = locked, green = open
  if (door.secure) {
    const reader = box(0.5, 0.7, 0.3, 0x1f2328, { roughness: 0.4 });
    reader.position.set(door.width / 2 + 0.75, 1.5, 0.45);
    readerMat = new THREE.MeshBasicMaterial({ color: PALETTE.door.readerLocked });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.05), readerMat);
    led.position.set(0, 0.18, 0.17);
    reader.add(led);
    const back = reader.clone();
    back.position.z = -0.45;
    back.rotation.y = Math.PI;
    group.add(reader, back);
    // a small top cap so the reader also shows from above
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 1.3), readerMat);
    cap.position.set(door.width / 2 + 0.75, wallHeight + 0.4, 0);
    group.add(cap);
  }

  return { group, readerMat };
}

export function createDoorMesh(door, axis, wallHeight) {
  const colors = doorColors(door);
  const pivot = new THREE.Group();
  const leafLen = door.width - 0.1;
  const material = new THREE.MeshStandardMaterial({ color: colors.leaf, roughness: 0.55 });
  const leafHeight = wallHeight * 0.95;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafLen, leafHeight, 0.5), material);
  leaf.castShadow = true;
  leaf.position.set(leafLen / 2 + 0.05, leafHeight / 2, 0);
  pivot.add(leaf);
  // Handle, so the leaf reads as a door in 3D views
  const handle = box(0.12, 0.12, 0.8, 0xe8e4da, { roughness: 0.3, metalness: 0.4 });
  handle.position.set(leafLen - 0.4, 1.4, 0);
  pivot.add(handle);

  // Hinge at one end of the opening; leaf extends along the wall when closed.
  if (axis === 'h') {
    pivot.position.set(door.x - door.width / 2, 0, door.z);
  } else {
    pivot.position.set(door.x, 0, door.z - door.width / 2);
    pivot.rotation.y = -Math.PI / 2;
  }

  // Generous invisible hitbox for clicking / tapping on the map.
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(door.width + 2, wallHeight + 2, 3.5),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.set(door.x, wallHeight / 2, door.z);
  if (axis === 'v') hit.rotation.y = Math.PI / 2;

  const decor = createDoorDecor(door, axis, wallHeight);
  return { pivot, leaf, material, hit, decor: decor.group, readerMat: decor.readerMat, baseRotation: pivot.rotation.y, baseColor: colors.leaf };
}

// ---------------------------------------------------------------------------
// Security camera device mounted high on a wall.
// ---------------------------------------------------------------------------
export function createCameraDevice(cam, wallHeight) {
  const group = new THREE.Group();
  group.position.set(cam.mount.x, wallHeight + 0.4, cam.mount.z);
  const body = box(1.1, 0.8, 1.6, PALETTE.camera.body, { roughness: 0.4 });
  group.add(body);
  const ledMat = new THREE.MeshBasicMaterial({ color: PALETTE.camera.ledOff });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), ledMat);
  led.position.set(0, 0.5, 0.5);
  group.add(led);
  group.lookAt(cam.look.x, 0, cam.look.z);
  return { group, ledMat };
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------
export function createFurniture(f) {
  const w = f.x1 - f.x0;
  const d = f.z1 - f.z0;
  const cx = (f.x0 + f.x1) / 2;
  const cz = (f.z0 + f.z1) / 2;
  const C = PALETTE.furniture;
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);

  switch (f.kind) {
    case 'securityDesk': {
      const desk = box(w, 1.3, d, C.securityDesk);
      desk.position.y = 0.65;
      const top = box(w + 0.3, 0.12, d + 0.3, 0xd6d3cc);
      top.position.y = 1.36;
      const monitor = box(0.2, 0.8, 1.6, 0x1f2328);
      monitor.position.set(-0.6, 1.85, -1.2);
      const monitor2 = monitor.clone();
      monitor2.position.z = 1.2;
      group.add(desk, top, monitor, monitor2);
      break;
    }
    case 'cubicle': {
      const top = box(w, 0.12, d, C.cubicleTop);
      top.position.y = 1.0;
      const back = box(w, 1.7, 0.18, C.cubicle);
      back.position.set(0, 0.85, -d / 2);
      const side = box(0.18, 1.7, d + 1.2, C.cubicle);
      side.position.set(-w / 2, 0.85, 0.6);
      const side2 = side.clone();
      side2.position.x = w / 2;
      const monitor = box(1.2, 0.7, 0.12, 0x2b2f36);
      monitor.position.set(0, 1.45, -d / 4);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.55), new THREE.MeshBasicMaterial({ color: 0x8fc1e8 }));
      screen.position.set(0, 1.45, -d / 4 + 0.07);
      group.add(top, back, side, side2, monitor, screen);
      break;
    }
    case 'rack': {
      const rack = box(w, 2.8, d, C.rack, { roughness: 0.5, metalness: 0.2 });
      rack.position.y = 1.4;
      group.add(rack);
      // Blinking-light strip feel: small green dots along the front
      group.userData.leds = [];
      const long = w >= d;
      const len = long ? w : d;
      for (let t = -len / 2 + 0.6; t < len / 2; t += 1.2) {
        for (const side of [1, -1]) {
          const led = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.05), new THREE.MeshBasicMaterial({ color: 0x5ee08a }));
          if (long) led.position.set(t, 2.2 - (Math.random() < 0.5 ? 0.5 : 0), side * (d / 2 + 0.03));
          else {
            led.position.set(side * (w / 2 + 0.03), 2.2 - (Math.random() < 0.5 ? 0.5 : 0), t);
            led.rotation.y = Math.PI / 2;
          }
          group.add(led);
          group.userData.leds.push(led);
        }
      }
      // Top vents so racks read clearly from above
      for (let t = -len / 2 + 1; t < len / 2 - 0.5; t += 2) {
        const vent = box(long ? 1.2 : w * 0.7, 0.03, long ? d * 0.7 : 1.2, 0x5b6573);
        vent.position.set(long ? t : 0, 2.81, long ? 0 : t);
        group.add(vent);
      }
      break;
    }
    case 'execDesk':
    case 'table': {
      const top = box(w, 0.15, d, f.kind === 'execDesk' ? C.execDesk : C.table);
      top.position.y = 1.1;
      const base = box(w * 0.85, 1.05, d * 0.6, 0x6f6658);
      base.position.y = 0.52;
      group.add(top, base);
      break;
    }
    case 'shelf': {
      const shelf = box(w, 2.6, d, C.shelf);
      shelf.position.y = 1.3;
      group.add(shelf);
      break;
    }
    case 'counter': {
      const c = box(w, 1.2, d, C.counter);
      c.position.y = 0.6;
      const machine = box(1.2, 0.9, 1.0, 0x2b2f36);
      machine.position.set(-w / 2 + 2, 1.65, 0);
      group.add(c, machine);
      break;
    }
    case 'cooler': {
      const c = box(w, 1.6, d, 0xe8eef2);
      c.position.y = 0.8;
      const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 16), new THREE.MeshStandardMaterial({ color: C.cooler, transparent: true, opacity: 0.85 }));
      jug.position.y = 2.0;
      group.add(c, jug);
      break;
    }
    case 'vending': {
      const v = box(w, 2.6, d, C.vending);
      v.position.y = 1.3;
      group.add(v);
      break;
    }
    case 'roundTable': {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.15, 24), new THREE.MeshStandardMaterial({ color: C.table, roughness: 0.6 }));
      top.position.y = 1.1;
      top.castShadow = top.receiveShadow = true;
      const stem = box(0.3, 1.05, 0.3, 0x5b5348);
      stem.position.y = 0.52;
      group.add(top, stem);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 14), mat(0xc4573f));
        stool.position.set(Math.cos(a) * (w / 2 + 0.2), 0.75, Math.sin(a) * (w / 2 + 0.2));
        group.add(stool);
      }
      break;
    }
    case 'couch': {
      const seat = box(w, 0.8, d, 0x6f8fa8);
      seat.position.y = 0.4;
      const along = d > w;
      const back = box(along ? 0.5 : w, 1.5, along ? d : 0.5, 0x5f7f98);
      back.position.set(along ? -w / 2 + 0.25 : 0, 0.75, along ? 0 : -d / 2 + 0.25);
      group.add(seat, back);
      for (let i = 0; i < 2; i++) {
        const pillow = box(0.6, 0.6, 0.6, 0xe0b04a);
        pillow.position.set(along ? 0 : (i ? 1 : -1) * w * 0.3, 1.0, along ? (i ? 1 : -1) * d * 0.3 : 0);
        group.add(pillow);
      }
      break;
    }
    case 'printer': {
      const body = box(w, 1.3, d, 0xe4e1da);
      body.position.y = 0.65;
      const panel = box(w * 0.4, 0.1, d * 0.3, 0x2f6fb0);
      panel.position.set(w * 0.2, 1.33, -d * 0.2);
      const paper = box(w * 0.6, 0.06, d * 0.5, 0xffffff);
      paper.position.set(-w * 0.1, 1.32, d * 0.1);
      group.add(body, panel, paper);
      break;
    }
    case 'screen': {
      const scr = box(w, 1.8, Math.max(d, 0.2), 0x23272e);
      scr.position.y = 1.9;
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, 1.6), new THREE.MeshBasicMaterial({ color: 0x6fa3d8 }));
      glow.position.set(0, 1.9, d / 2 + 0.06);
      group.add(scr, glow);
      break;
    }
    case 'stalls': {
      const n = Math.max(2, Math.round(w / 3));
      for (let i = 0; i <= n; i++) {
        const wall = box(0.15, 2.2, d, 0x9fb7c2);
        wall.position.set(-w / 2 + (i * w) / n, 1.1, 0);
        group.add(wall);
      }
      const front = box(w, 2.2, 0.12, 0xb7ccd6);
      front.position.set(0, 1.1, d / 2);
      group.add(front);
      break;
    }
    case 'toilet': {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.42, Math.min(w, d) * 0.32, 0.8, 14), mat(0xf4f6f8, { roughness: 0.3 }));
      bowl.position.y = 0.4;
      const tank = box(w * 0.9, 1.0, d * 0.32, 0xeef1f4, { roughness: 0.3 });
      tank.position.set(0, 0.9, d / 2 - d * 0.16);
      group.add(bowl, tank);
      break;
    }
    case 'sink': {
      const basin = box(w, 0.9, d, 0xe9edf0, { roughness: 0.3 });
      basin.position.y = 0.45;
      const mirror = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0xbfd6e2, roughness: 0.1, metalness: 0.5 }));
      mirror.position.set(0, 1.9, d / 2 - 0.02);
      mirror.rotation.y = Math.PI;
      group.add(basin, mirror);
      break;
    }
    case 'plant': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 0.9, 14), new THREE.MeshStandardMaterial({ color: C.pot }));
      pot.position.y = 0.45;
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), new THREE.MeshStandardMaterial({ color: C.plant, flatShading: true }));
      leaves.position.y = 1.5;
      pot.castShadow = leaves.castShadow = true;
      group.add(pot, leaves);
      break;
    }
    case 'rope': {
      // Queue stanchions with a red rope
      const rope = box(w, 0.12, 0.12, C.rope);
      rope.position.y = 1.0;
      group.add(rope);
      for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 6) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 10), new THREE.MeshStandardMaterial({ color: 0xb8a24a, metalness: 0.4, roughness: 0.4 }));
        post.position.set(x, 0.55, 0);
        post.castShadow = true;
        group.add(post);
      }
      break;
    }
    default: {
      const b = box(w, 1, d, 0x999999);
      b.position.y = 0.5;
      group.add(b);
    }
  }
  return group;
}

/** Simple chair (waiting area seats, decor). */
export function createChair(x, z, color = PALETTE.furniture.chair) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const seat = box(1.4, 0.2, 1.4, color);
  seat.position.y = 0.75;
  const back = box(1.4, 1.0, 0.18, color);
  back.position.set(0, 1.25, 0.65);
  group.add(seat, back);
  return group;
}

/** Office swivel chair (decor at workstations). */
export function createOfficeChair(x, z, rotY = 0, color = 0x3c4656) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  const seat = box(1.0, 0.18, 1.0, color);
  seat.position.y = 0.85;
  const back = box(1.0, 1.0, 0.16, color);
  back.position.set(0, 1.4, 0.48);
  const stem = box(0.12, 0.7, 0.12, 0x2a2a2a);
  stem.position.y = 0.4;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 5), mat(0x2a2a2a));
  base.position.y = 0.08;
  group.add(seat, back, stem, base);
  return group;
}

/** Tree for the grounds outside. */
export function createTree(x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.4, 8), mat(0x7a5a3c));
  trunk.position.y = 1.2;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1), mat(0x6f9a5c, { flatShading: true }));
  crown.position.y = 3.6;
  const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), mat(0x7fae68, { flatShading: true }));
  crown2.position.set(0.8, 4.4, 0.4);
  trunk.castShadow = crown.castShadow = crown2.castShadow = true;
  group.add(trunk, crown, crown2);
  return group;
}

/** Parked car (outside decor). */
export function createCar(x, z, color, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  const body = box(4.4, 1.0, 2.0, color, { roughness: 0.35, metalness: 0.2 });
  body.position.y = 0.75;
  const cabin = box(2.4, 0.8, 1.8, 0x9fb7c8, { roughness: 0.2, metalness: 0.1 });
  cabin.position.set(-0.2, 1.6, 0);
  const roof = box(2.0, 0.08, 1.7, color);
  roof.position.set(-0.2, 2.04, 0);
  group.add(body, cabin, roof);
  for (const [dx, dz] of [[1.4, 1], [-1.4, 1], [1.4, -1], [-1.4, -1]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), mat(0x1c1c1c));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(dx, 0.4, dz);
    group.add(wheel);
  }
  return group;
}

/** Non-blocking decor from layout.DECOR. */
export function createDecor(d, wallHeight) {
  const group = new THREE.Group();
  switch (d.kind) {
    case 'rug': {
      const w = d.x1 - d.x0;
      const h = d.z1 - d.z0;
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: d.color, roughness: 1 }));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set((d.x0 + d.x1) / 2, 0.012, (d.z0 + d.z1) / 2);
      rug.receiveShadow = true;
      const border = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.8, h - 0.8), new THREE.MeshStandardMaterial({ color: new THREE.Color(d.color).offsetHSL(0, 0.05, 0.06), roughness: 1 }));
      border.rotation.x = -Math.PI / 2;
      border.position.set(rug.position.x, 0.016, rug.position.z);
      border.receiveShadow = true;
      group.add(rug, border);
      break;
    }
    case 'welcome': {
      const w = d.x1 - d.x0;
      const h = d.z1 - d.z0;
      const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x9a8a74, roughness: 1 }));
      mat2.rotation.x = -Math.PI / 2;
      mat2.position.set((d.x0 + d.x1) / 2, 0.014, (d.z0 + d.z1) / 2);
      group.add(mat2);
      break;
    }
    case 'art': {
      const frame = box(d.axis === 'h' ? 3.2 : 0.12, 1.6, d.axis === 'h' ? 0.12 : 3.2, 0x3b3328);
      const canvas = box(d.axis === 'h' ? 2.8 : 0.14, 1.2, d.axis === 'h' ? 0.14 : 2.8, new THREE.Color(d.color).getHex());
      const off = 0.38 * d.side;
      frame.position.set(d.x + (d.axis === 'v' ? off : 0), 2.0, d.z + (d.axis === 'h' ? off : 0));
      canvas.position.copy(frame.position);
      canvas.position.x += d.axis === 'v' ? 0.04 * d.side : 0;
      canvas.position.z += d.axis === 'h' ? 0.04 * d.side : 0;
      group.add(frame, canvas);
      break;
    }
    case 'smallPlant': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.6, 12), mat(0xb07a55));
      pot.position.set(d.x, 0.3, d.z);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), mat(0x6f9a5c, { flatShading: true }));
      leaves.position.set(d.x, 1.1, d.z);
      pot.castShadow = leaves.castShadow = true;
      group.add(pot, leaves);
      break;
    }
    default:
      break;
  }
  return group;
}
