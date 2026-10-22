/*
 * Builds the static facility (floors, labels, walls, furniture, decor, the
 * grounds outside, the player at the desk, camera devices) from data/layout.js.
 *
 * Room names aren't painted on the map: each room gets a hidden floor label
 * and a faint glowing outline along its walls, shown while the pointer is
 * over that room (see RoomHighlighter below and ui/Controls.js).
 *
 * Small ambient animations (server LEDs, the player's marker) are registered
 * with stage.addAnimator() so the world feels alive even when nothing happens.
 */
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { checkerTexture, carpetTexture, tileTexture, plainTexture, woodTexture, labelTexture, areaLabelTexture } from './textures.js';
import {
  createFurniture,
  createChair,
  createOfficeChair,
  createPersonMesh,
  createCameraDevice,
  createDecor,
  createTree,
  createRing,
} from './meshes.js';
import { wallPieces } from '../data/layoutGeometry.js';
import {
  ROOMS,
  FURNITURE,
  DECOR,
  WAITING_SEATS,
  WORKSTATIONS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  CAMERAS,
  PLAYER_POINT,
  QUEUE_SLOTS,
  PARKING,
  LABEL_ZONES,
} from '../data/layout.js';
import { PersonType } from '../config/entityTypes.js';
import { randomAppearance } from '../data/appearance.js';

function floorMaterial(kind, w, d) {
  const F = PALETTE.floors;
  let tex;
  let repeat = 8;
  switch (kind) {
    case 'lobby': tex = checkerTexture(F.lobby); repeat = 6; break;
    case 'carpetBlue': tex = carpetTexture(F.carpetBlue); break;
    case 'carpetGreen': tex = carpetTexture(F.carpetGreen); break;
    case 'carpetWarm': tex = carpetTexture(F.carpetWarm); break;
    case 'tile': tex = tileTexture(F.tile); repeat = 3; break;
    case 'tileBlue': tex = tileTexture(F.tileBlue); repeat = 2; break;
    case 'server': tex = tileTexture(F.server, 'rgba(0,0,0,0.12)'); repeat = 2; break;
    case 'wood': tex = woodTexture(F.wood); repeat = 6; break;
    case 'concrete': tex = carpetTexture(F.concrete); break;
    default: tex = plainTexture(F.hall); repeat = 4;
  }
  tex.repeat.set(w / repeat, d / repeat);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
}


/**
 * Faint highlight for the room under the pointer: a glow along the top of its
 * walls, a light floor wash, and its name on the floor.
 */
export class RoomHighlighter {
  constructor(root) {
    this.rooms = new Map(); // room or zone id -> { group }
    this.current = null;
    const glow = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.6, depthWrite: false });
    const wash = new THREE.MeshBasicMaterial({ color: 0xfff6d6, transparent: true, opacity: 0.16, depthWrite: false });
    const areas = [
      ...ROOMS.filter((r) => r.id !== 'outside').map((r) => ({ ...r, walls: true })),
      ...LABEL_ZONES.map((z) => ({ ...z, walls: false })),
    ];
    for (const room of areas) {
      const group = new THREE.Group();
      group.visible = false;
      const w = room.x1 - room.x0;
      const d = room.z1 - room.z0;
      // Rooms glow along the tops of their walls; floor zones get a thin outline on the floor.
      const y = room.walls ? WALL_HEIGHT + 0.08 : 0.06;
      const t = room.walls ? 0.8 : 0.3;
      const strip = (sx, sz, x, z) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), glow);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, y, z);
        m.renderOrder = 3;
        group.add(m);
      };
      strip(w + t, t, room.x0 + w / 2, room.z0);
      strip(w + t, t, room.x0 + w / 2, room.z1);
      strip(t, d, room.x0, room.z0 + d / 2);
      strip(t, d, room.x1, room.z0 + d / 2);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), wash);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(room.x0 + w / 2, 0.02, room.z0 + d / 2);
      floor.renderOrder = 2;
      group.add(floor);
      // The name, centred over the area and see-through.
      const { tex, width, height } = areaLabel(room, w, d);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false }),
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(room.x0 + w / 2, 2.6, room.z0 + d / 2); // above desks and chairs
      plane.renderOrder = 5;
      group.add(plane);
      root.add(group);
      this.rooms.set(room.id, { group });
    }
  }

  set(roomId) {
    if (roomId === this.current) return;
    if (this.current) this.rooms.get(this.current).group.visible = false;
    this.current = this.rooms.has(roomId) ? roomId : null;
    if (this.current) this.rooms.get(this.current).group.visible = true;
  }
}

const LINE_MIN = 3.4; // world units per text line: about 14px capitals on the full-map view
const LINE_MAX = 4.2;

/** The hover name for a room / area, wrapped onto two lines when that reads bigger. */
function areaLabel(room, w, d) {
  const color = room.secure ? PALETTE.labelSecure : PALETTE.label;
  const words = room.label.split(' ');
  const half = Math.ceil(words.length / 2);
  const options = [[room.label]];
  if (words.length > 1) options.push([words.slice(0, half).join(' '), words.slice(half).join(' ')]);
  if (room.secure) options.forEach((o) => o.unshift('Secure'));
  let best = null;
  for (const lines of options) {
    const tex = areaLabelTexture(lines, color);
    const aspect = tex.image.width / tex.image.height;
    const height = Math.min(w * 0.9 / aspect, d * 0.8, LINE_MAX * lines.length);
    if (!best || height / lines.length > best.height / best.lines.length) best = { tex, aspect, height, lines };
  }
  // Never smaller than LINE_MIN per line: small areas get a name wider than themselves.
  const height = Math.max(best.height, LINE_MIN * best.lines.length);
  return { tex: best.tex, width: height * best.aspect, height };
}

function addFloorLabel(root, text, x, z, width, color, opacity = 0.55) {
  const tex = labelTexture(text, color);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * (96 / 512)),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(x, 0.03, z);
  root.add(plane);
  return plane;
}

/** Is this wall piece on the building's outer shell? (Those get window glazing.) */
const OUTER = { x0: -50, x1: 50, z0: -60, z1: 34 };
const isOuter = (p) =>
  Math.abs((p.z0 + p.z1) / 2 - OUTER.z0) < 0.5 ||
  Math.abs((p.z0 + p.z1) / 2 - OUTER.z1) < 0.5 ||
  Math.abs((p.x0 + p.x1) / 2 - OUTER.x0) < 0.5 ||
  Math.abs((p.x0 + p.x1) / 2 - OUTER.x1) < 0.5;

export function buildWorld(stage) {
  const root = stage.staticRoot;

  // --- Grounds -----------------------------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  root.add(ground);

  // Sidewalk around the building + parking lot east of the entrance
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(108, 102), new THREE.MeshStandardMaterial({ color: 0xd3cec3, roughness: 1 }));
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(0, -0.012, -13);
  walk.receiveShadow = true;
  root.add(walk);
  // The lot runs on south, off the edge of the map (where the rest of the spots are).
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(26, 160), new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 1 }));
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(73, -0.01, 40);
  lot.receiveShadow = true;
  root.add(lot);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8e6df });
  const spotZ = PARKING.spots.map((s) => s.z);
  const addLine = (x, z) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.18), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.0, z);
    root.add(line);
  };
  for (const z of [...spotZ.map((z) => z - 2), spotZ[spotZ.length - 1] + 2]) addLine(66, z);
  for (let z = -32; z <= 110; z += 4) addLine(80, z); // far row (cars beyond the map edge)
  for (const [x, z, s] of [[-55, -62, 1.2], [-55, -30, 1], [-55, 4, 1.1], [-55, 30, 0.9], [-30, -65, 1], [10, -65, 1.2], [40, -65, 1], [-20, 39, 1.1], [20, 39, 0.9], [54, 9, 0.7], [54, 32, 0.8]]) {
    root.add(createTree(x, z, s));
  }

  // --- Floors + room labels --------------------------------------------------------
  for (const room of ROOMS) {
    const w = room.x1 - room.x0;
    const d = room.z1 - room.z0;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMaterial(room.floor, w, d));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((room.x0 + room.x1) / 2, ['hallway', 'northhall'].includes(room.id) ? 0.005 : 0, (room.z0 + room.z1) / 2);
    floor.receiveShadow = true;
    root.add(floor);
  }
  const roomHighlighter = new RoomHighlighter(root);

  // (The lobby's "Line", "Waiting area" and "Entrance" are LABEL_ZONES, named on hover.)

  // --- Decor that sits on the floor (rugs) before furniture -----------------------
  for (const d of DECOR) root.add(createDecor(d, WALL_HEIGHT));

  // --- Walls: light sides, dark top; outer walls glazed (window bands) -----------
  const sideMat = new THREE.MeshStandardMaterial({ color: PALETTE.wallSide, roughness: 0.9 });
  const topMat = new THREE.MeshStandardMaterial({ color: PALETTE.wallTop, roughness: 0.9 });
  const glassTop = new THREE.MeshStandardMaterial({ color: PALETTE.glazing, roughness: 0.3, metalness: 0.1 });
  const glassSide = new THREE.MeshStandardMaterial({ color: PALETTE.glazingSide, roughness: 0.2, metalness: 0.1 });
  const innerMats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
  const outerMats = [glassSide, glassSide, glassTop, sideMat, glassSide, glassSide];
  for (const p of wallPieces()) {
    const outer = isOuter(p);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, WALL_HEIGHT, p.z1 - p.z0), outer ? outerMats : innerMats);
    mesh.position.set((p.x0 + p.x1) / 2, WALL_HEIGHT / 2, (p.z0 + p.z1) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (outer) {
      // Mullions every 4 units so the glazing reads as windows
      const horizontal = p.x1 - p.x0 > p.z1 - p.z0;
      const len = horizontal ? p.x1 - p.x0 : p.z1 - p.z0;
      for (let t = 2; t < len - 1; t += 4) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 0.25 : WALL_THICKNESS + 0.05, 0.06, horizontal ? WALL_THICKNESS + 0.05 : 0.25), topMat);
        m.position.set(horizontal ? p.x0 + t : mesh.position.x, WALL_HEIGHT + 0.01, horizontal ? mesh.position.z : p.z0 + t);
        root.add(m);
      }
    }
  }

  // --- Furniture ---------------------------------------------------------------------
  const leds = [];
  for (const f of FURNITURE) {
    const obj = createFurniture(f);
    if (obj.userData.leds) leds.push(...obj.userData.leds);
    root.add(obj);
  }
  // Chairs at every workstation, waiting area seats (3x3)
  for (const w of WORKSTATIONS) root.add(createOfficeChair(w.x, w.z + 0.3, 0));
  for (const seat of WAITING_SEATS) root.add(createChair(seat.x, seat.z + 0.2));

  // Queue slot markers (subtle floor dots)
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xc2b9a5, transparent: true, opacity: 0.8, depthWrite: false });
  for (const slot of QUEUE_SLOTS) {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), dotMat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(slot.x, 0.04, slot.z);
    root.add(dot);
  }

  // --- The player: the security manager behind the desk ------------------------
  // No label needed: gold-trimmed uniform, a desk chair and lamp, and a soft
  // pulsing gold spotlight on the floor.
  const player = createPersonMesh(PersonType.OFFICER, { ...randomAppearance(PersonType.OFFICER, 'm'), shirt: '#24324a', hairStyle: 'short', facialHair: null });
  player.position.set(PLAYER_POINT.x, 0, PLAYER_POINT.z);
  player.rotation.y = Math.PI / 2;
  player.scale.setScalar(1.3);
  root.add(player);
  root.add(createOfficeChair(PLAYER_POINT.x - 0.6, PLAYER_POINT.z, -Math.PI / 2, 0x6b4f2a));
  const spot = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.28, depthWrite: false }));
  spot.rotation.x = -Math.PI / 2;
  spot.position.set(PLAYER_POINT.x, 0.03, PLAYER_POINT.z);
  const ring = createRing(0xd9a520, 2.3, 0.9);
  ring.position.set(PLAYER_POINT.x, 0.05, PLAYER_POINT.z);
  root.add(spot, ring);
  const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x2b2b2b }));
  lampPost.position.set(5, 1.85, 23.2);
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.4, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xf2d27a, side: THREE.DoubleSide }));
  lampShade.position.set(5, 2.35, 23.2);
  root.add(lampPost, lampShade);

  // --- Security camera devices ---------------------------------------------------------
  const cameraDevices = new Map();
  for (const cam of CAMERAS) {
    const device = createCameraDevice(cam, WALL_HEIGHT);
    root.add(device.group);
    cameraDevices.set(cam.id, device);
  }

  // --- Ambient animation --------------------------------------------------------------
  let ledClock = 0;
  stage.addAnimator((dt, t) => {
    const pulse = 1 + Math.sin(t * 2.2) * 0.08;
    ring.scale.set(pulse, pulse, pulse);
    spot.material.opacity = 0.22 + Math.sin(t * 2.2) * 0.06;
    ledClock += dt;
    if (ledClock > 0.15) {
      ledClock = 0;
      for (let i = 0; i < 4; i++) {
        const led = leds[Math.floor(Math.random() * leds.length)];
        if (led) led.material.color.setHex(Math.random() < 0.15 ? 0xf2c14e : Math.random() < 0.5 ? 0x5ee08a : 0x2c6b45);
      }
    }
  });

  return { cameraDevices, player, roomHighlighter };
}
