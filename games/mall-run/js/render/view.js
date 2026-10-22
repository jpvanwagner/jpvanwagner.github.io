/* The 3D view: renderer, lights, chase camera, and syncing game state (runner, shoppers, props) into the scene. */
import * as THREE from "three";
import * as C from "../config.js";
import { G, trackPoint, runnerWorld, runnerY, nextCorner, turnWindowOpen } from "../game/game.js";
import { World } from "./world.js";
import { buildCharacter, randomAppearance, makeShadow } from "./characters/rig.js";
import { Animator } from "./characters/anim.js";
import { playerAppearance } from "./characters/player.js";
import { Coins, makePower, makeObstacleMesh } from "./props.js";
import { shadowTexture, setAnisotropy } from "./textures.js";
import { makeRng } from "../rng.js";
import { PLAYER, SETTINGS } from "../settings.js";
import { ACT } from "../ui/input.js";

const _p = {}, _q = {}, _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    setAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, C.VIEW_DIST + 20);
    this.scene.fog = new THREE.Fog(0xd9dcd6, C.VIEW_DIST * 0.45, C.VIEW_DIST);
    this.scene.background = new THREE.Color(0xd9dcd6);

    const hemi = new THREE.HemisphereLight(0xfffaf0, 0xb3a68e, 2.3);
    const key = new THREE.DirectionalLight(0xfff1dc, 1.3); key.position.set(0.4, 1, 0.25);
    this.scene.add(hemi, key, key.target);
    this.hemi = hemi; this.key = key;

    this.world = new World(this.scene);
    this.coins = new Coins(this.scene, 320);
    this.shadowTex = shadowTexture();

    // runner
    this.runnerCh = null; this.runnerAnim = null;
    this.runnerShadow = makeShadow(this.shadowTex, 1.0); this.scene.add(this.runnerShadow);
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x6fe0cf, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.bubble.visible = false; this.scene.add(this.bubble);

    // shopper pool: varied people reused as the crowd comes and goes
    this.pool = []; this.npcMap = new Map();
    this.obstacleViews = new Map(); this.powerViews = new Map();
    this.peoplePool = { person: [], sample: [] };

    this.cam = { lat: 0, latV: 0, y: C.CAM_HEIGHT, yV: 0, q: new THREE.Quaternion(), init: false, roll: 0, fov: 70 };
    this.shake = 0;
    this.quality = 1;
    this.frameTimes = [];
    this.labels = [];
    this.themeIdx = -1;
    this.fogCol = new THREE.Color(0xd9dcd6);
    this.lastCrash = false;
  }

  buildPool(count) {
    const rng = makeRng(1234);
    for (let i = 0; i < count; i++) {
      const ch = buildCharacter(randomAppearance(rng, rng.chance(0.12)));
      const sh = makeShadow(this.shadowTex, 0.85);
      ch.root.visible = false; sh.visible = false;
      this.scene.add(ch.root); this.scene.add(sh);
      this.pool.push({ ch, anim: new Animator(ch), shadow: sh, npc: null });
    }
    for (const kind of ["person", "sample"]) {
      for (let i = 0; i < 4; i++) {
        const ap = randomAppearance(rng, false);
        ap.bag = null; ap.backpack = null;
        if (kind === "person") { ap.prop = "phone"; ap.shirt = rng.pick(["#8a3f3f", "#3a5a8a", "#6a4a7a", "#2f6a5a"]); ap.shirtStyle = "tee"; }
        else { ap.prop = "tray"; ap.apron = "#c9784f"; ap.shirt = "#f4f1ea"; ap.shirtStyle = "long"; ap.hairStyle = ap.build === "b" ? "bun" : "cap"; ap.capColor = "#c9784f"; }
        const ch = buildCharacter(ap), sh = makeShadow(this.shadowTex, 0.9);
        ch.root.visible = false; sh.visible = false;
        this.scene.add(ch.root, sh);
        this.peoplePool[kind].push({ ch, anim: new Animator(ch), shadow: sh, used: false });
      }
    }
  }

  setRunnerAppearance() {
    if (this.runnerCh) { this.scene.remove(this.runnerCh.root); this.runnerCh.mesh.geometry.dispose(); }
    this.runnerCh = buildCharacter(playerAppearance(PLAYER));
    this.runnerAnim = new Animator(this.runnerCh);
    this.scene.add(this.runnerCh.root);
  }

  resize(w, h) {
    const q = SETTINGS.quality === "low" ? 0.7 : SETTINGS.quality === "high" ? 2 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, q) * this.quality;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep roughly the same horizontal view on phones (portrait) and desktops
    const hfov = 76 * Math.PI / 180;
    let vfov = 2 * Math.atan(Math.tan(hfov / 2) / this.camera.aspect) * 180 / Math.PI;
    this.baseFov = Math.max(56, Math.min(84, vfov));
    this.camera.updateProjectionMatrix();
  }

  /** Adaptive resolution when Graphics = Auto and frames are slow. */
  trackPerf(dt) {
    if (SETTINGS.quality !== "auto") return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 0.024 && this.quality > 0.6) { this.quality = Math.max(0.6, this.quality - 0.15); this.onQuality && this.onQuality(); }
    else if (avg < 0.0145 && this.quality < 1) { this.quality = Math.min(1, this.quality + 0.1); this.onQuality && this.onQuality(); }
  }

  reset() {
    this.world.reset(G.startS);
    for (const [id, v] of this.obstacleViews) this.releaseObstacle(id, v);
    for (const v of this.powerViews.values()) this.disposeObj(v);
    this.obstacleViews.clear(); this.powerViews.clear();
    for (const p of this.pool) { p.npc = null; p.ch.root.visible = false; p.shadow.visible = false; }
    this.npcMap.clear();
    for (const k in this.peoplePool) for (const p of this.peoplePool[k]) { p.used = false; p.ch.root.visible = false; p.shadow.visible = false; }
    this.cam.init = false; this.shake = 0; this.themeIdx = -1;
    this.world.update(G.path, G.r.s, Infinity);      // build everything in view right away
  }

  snapCamera() { this.cam.init = false; this.world.update(G.path, G.r.s, Infinity); }

  disposeObj(o) {
    this.scene.remove(o);
    o.traverse(m => { if (m.isMesh || m.isSprite) { if (m.userData.ownMat) m.material.dispose(); if (m.userData.ownGeo) m.geometry.dispose(); } });
  }

  /* ---------------- per frame ---------------- */
  frame(dt) {
    const r = G.r;
    this.world.update(G.path, r.s, 5);
    this.updateTheme(dt);
    this.updateRunner(dt);
    this.updateCamera(dt);
    this.updateCrowd(dt);
    this.updateEntities(dt);
    this.updateArrows();
    this.renderer.render(this.scene, this.camera);
  }

  updateTheme(dt) {
    const lvl = Math.max(0, Math.floor(G.distance / C.LEVEL_DISTANCE));
    const T = C.THEMES[lvl % C.THEMES.length];
    const target = new THREE.Color(T.haze);
    if (this.themeIdx < 0) this.fogCol.copy(target); else this.fogCol.lerp(target, 1 - Math.exp(-1.5 * dt));
    this.themeIdx = lvl;
    this.scene.fog.color.copy(this.fogCol); this.scene.background.copy(this.fogCol);
    const dark = T.name === "theater";
    const hk = dark ? 1.35 : T.name === "garage" ? 1.9 : 2.3;
    this.hemi.intensity += (hk - this.hemi.intensity) * (1 - Math.exp(-1.5 * dt));
  }

  updateRunner(dt) {
    const r = G.r, ch = this.runnerCh;
    if (!ch) return;
    const p = runnerWorld(_p);
    ch.root.position.set(p.x, p.y, p.z);
    ch.root.rotation.y = -p.h;
    const v = G.speed * C.METRES_PER_SPEED;
    const crashing = G.state === "crashing" || ((G.state === "quiz" || G.state === "quiz-pending") && this.lastCrash);
    if (G.state === "crashing") this.lastCrash = true; else if (G.state === "play") this.lastCrash = false;
    const turnRoll = -Math.max(-0.32, Math.min(0.32, (p.curv || 0) * v * v / 9.8 * 0.45));
    const laneRoll = -Math.max(-0.22, Math.min(0.22, r.latV * 0.045));
    this.runnerRoll = (this.runnerRoll || 0) + ((turnRoll + laneRoll) - (this.runnerRoll || 0)) * (1 - Math.exp(-10 * dt));
    this.runnerAnim.update({
      gait: "run", phase: r.runPhase, speedK: 1, t: G.time,
      air: (r.air && r.mode !== "crash") || r.mode === "drop", vy: r.vy, flip: r.flip,
      slide: r.slideT > 0 ? 1 : 0, land: r.landT > 0 ? r.landT / 0.22 : 0,
      crashT: crashing ? (G.crash ? G.crash.t : 1.0) : -1,
      roll: crashing ? 0 : this.runnerRoll,
      yaw: crashing ? 0 : -Math.atan2(r.latV, Math.max(4, v)) * 0.9
    }, dt);
    ch.root.visible = !(r.blink > 0 && Math.floor(r.blink * 10) % 2 === 0);
    // shadow on the floor below (shrinks as you rise)
    const ground = r.mode === "climb" || r.mode === "drop" ? (Math.abs(r.lat) > C.VOID_HALF + 0.2 ? C.UPPER_H : (r.mode === "drop" ? 0 : (r.y > C.UPPER_H ? C.UPPER_H : 0))) : r.level * C.UPPER_H;
    const hAbove = Math.max(0, p.y - ground);
    this.runnerShadow.position.set(p.x, ground + 0.02, p.z);
    const sc = Math.max(0.35, 1 - hAbove * 0.18);
    this.runnerShadow.scale.set(sc, sc, sc);
    this.runnerShadow.visible = hAbove < 4;
    this.bubble.visible = G.buffs && G.buffs.immuneTime > 0 && G.state !== "title";
    if (this.bubble.visible) {
      this.bubble.position.set(p.x, p.y + 0.95, p.z);
      this.bubble.material.opacity = 0.12 + 0.06 * Math.sin(G.time * 6) + (G.buffs.immuneTime < 2 ? 0.08 * Math.sin(G.time * 25) : 0);
    }
  }

  updateCamera(dt) {
    const r = G.r, cam = this.cam;
    if (this.debugCam) {             // test hook: fixed camera
      const d = this.debugCam;
      this.camera.position.set(d.pos[0], d.pos[1], d.pos[2]); this.camera.lookAt(d.look[0], d.look[1], d.look[2]);
      if (d.fov) { this.camera.fov = d.fov; this.camera.updateProjectionMatrix(); }
      return;
    }
    const upFrac = Math.max(0, Math.min(1, (r.mode === "climb" || r.mode === "drop") ? r.y / C.UPPER_H : r.level));
    const groundY = (r.mode === "climb" || r.mode === "drop") ? r.y : r.level * C.UPPER_H;
    const jumpY = r.mode === "run" && r.air ? r.y : 0;
    // downstairs the camera hangs between lanes; upstairs it sits right behind you on the walkway (clear of the columns)
    const latTarget = r.lat * (0.55 + 0.45 * upFrac);
    const yTarget = groundY + C.CAM_HEIGHT + 0.35 * jumpY + (r.slideT > 0 ? -0.35 : 0);
    if (!cam.init) { cam.lat = latTarget; cam.y = yTarget; cam.latV = 0; cam.yV = 0; }
    // critically damped springs on the camera's path-relative offsets (no lag along the path itself)
    const spring = (x, v, target, w) => { const a = w * w * (target - x) - 2 * w * v; v += a * dt; return [x + v * dt, v]; };
    [cam.lat, cam.latV] = spring(cam.lat, cam.latV, latTarget, 7);
    const scripted = r.mode === "climb" || r.mode === "drop";
    [cam.y, cam.yV] = spring(cam.y, cam.yV, yTarget, scripted ? 7 : 9);

    const back = C.CAM_BACK + (G.state === "crashing" ? Math.min(1.5, (G.crash ? G.crash.t : 1) * 2) : 0);
    trackPoint(r.s - back, cam.lat, _p);
    trackPoint(r.s + C.CAM_LOOK_AHEAD, r.lat * (0.3 + 0.7 * upFrac), _q);
    // aim between the camera's own level and the runner, so a big climb or drop stays in frame
    const baseLook = cam.y - C.CAM_HEIGHT + 1.15 + 0.25 * jumpY;
    const lookY = scripted ? baseLook + (runnerY() + 1.0 - baseLook) * 0.65 : baseLook;
    const camera = this.camera;
    camera.position.set(_p.x + r.offX, cam.y, _p.z + r.offZ);
    camera.lookAt(_q.x, lookY, _q.z);
    // smooth the view direction so corners swing round instead of snapping
    if (!cam.init) { cam.q.copy(camera.quaternion); cam.init = true; }
    else { cam.q.slerp(camera.quaternion, 1 - Math.exp(-11 * dt)); camera.quaternion.copy(cam.q); }
    // bank gently through turns
    trackPoint(r.s, 0, _q);
    const rollT = -(_q.curv || 0) * 0.35;
    cam.roll += (rollT - cam.roll) * (1 - Math.exp(-5 * dt));
    camera.rotateZ(cam.roll);
    // shake + speed FOV
    if (this.shake > 0) {
      const m = this.shake * 0.12;
      camera.position.x += (Math.random() * 2 - 1) * m; camera.position.y += (Math.random() * 2 - 1) * m;
      if (G.state !== "crashing") this.shake = Math.max(0, this.shake - 2.5 * dt);
    }
    const fovT = this.baseFov + (G.buffs && G.buffs.speedTime > 0 ? 8 : 0) + Math.min(6, (G.speed - 6) * 0.6);
    cam.fov += (fovT - cam.fov) * (1 - Math.exp(-3 * dt));
    if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    this.key.position.set(camera.position.x + 6, camera.position.y + 14, camera.position.z + 4);
    this.key.target.position.set(camera.position.x, 0, camera.position.z);
  }

  /* ---------------- shoppers ---------------- */
  updateCrowd(dt) {
    const crowd = G.crowd, rs = G.r.s;
    const seen = new Set();
    for (const n of crowd.npcs) {
      const near = n.s > rs - 12 && n.s < rs + C.VIEW_DIST * 0.92;
      if (!near) continue;
      let slot = this.npcMap.get(n.id);
      if (!slot) {
        slot = this.pool.find(p => !p.npc && (p.ch.ap.kid ? n.seed % 5 === 0 : true)) || this.pool.find(p => !p.npc);
        if (!slot) continue;
        slot.npc = n; this.npcMap.set(n.id, slot); slot.anim.first = true;
      }
      seen.add(n.id);
      G.path.point(n.s, n.lat, _p);
      const y = n.level * C.UPPER_H;
      slot.ch.root.position.set(_p.x, y, _p.z);
      slot.ch.root.rotation.y = -(_p.h + n.face);
      slot.ch.root.visible = true;
      slot.shadow.visible = true; slot.shadow.position.set(_p.x, y + 0.02, _p.z);
      const far = n.s - rs > 70;
      slot.skip = far ? ((slot.skip || 0) + 1) % 3 : 0;        // far-away people animate at a lower rate
      if (slot.skip === 0) slot.anim.update({
        gait: n.speed > 0.08 ? "walk" : "idle", phase: n.phase, speedK: Math.min(1, n.speed / 1.1),
        t: G.time, seed: n.seed % 100, browse: n.state === "idle", crashT: -1
      }, far ? dt * 3 : dt);
    }
    for (const [id, slot] of this.npcMap) if (!seen.has(id)) {
      slot.npc = null; slot.ch.root.visible = false; slot.shadow.visible = false; this.npcMap.delete(id);
    }
  }

  /* ---------------- coins, power-ups, obstacles ---------------- */
  updateEntities(dt) {
    const r = G.r, rs = r.s, coins = this.coins, seen = new Set();
    const rw = runnerWorld(_q); const ry = runnerY();
    this.labels.length = 0;
    coins.begin();
    for (const e of G.entities) {
      if (e.s > rs + C.VIEW_DIST || e.s < rs - 10) continue;
      if (e.type === "coin") {
        let lat = e.lat, y = (e.level || 0) * C.UPPER_H + e.y, sc = 1;
        if (e.done) {                                          // collected: zip into the runner and vanish
          const t = (G.time - e.gotAt) / 0.18;
          if (t >= 1 || !(t >= 0)) continue;
          G.path.point(e.s, e.lat, _p);
          _p.x += (rw.x - _p.x) * t; _p.z += (rw.z - _p.z) * t; y += (ry + 1.0 - y) * t; sc = 1 + t * 0.6;
          coins.put(_p.x, y, _p.z, G.time * 14, sc * (1 - t * 0.5));
          continue;
        }
        if (G.buffs.magnetTime > 0) {
          const d = e.s - rs;
          if (d < 14 && d > -1) { const k = 1 - Math.max(0, d) / 14; lat += (r.lat - lat) * k * k; y += (ry + 0.9 - y) * k * k; }
        }
        G.path.point(e.s, lat, _p);
        coins.put(_p.x, y + Math.sin(G.time * 3 + e.s) * 0.06, _p.z, G.time * 3.2 + e.s * 0.4, 1);
      } else if (e.type === "power") {
        let v = this.powerViews.get(e.id);
        if (e.done) { if (v) { this.disposeObj(v); this.powerViews.delete(e.id); } continue; }
        if (!v) { v = makePower(e.kind); this.scene.add(v); this.powerViews.set(e.id, v); }
        seen.add(e.id);
        G.path.point(e.s, e.lat, _p);
        v.position.set(_p.x, (e.level || 0) * C.UPPER_H + 1.25 + Math.sin(G.time * 2 + e.bob) * 0.15, _p.z);
        v.userData.gem.rotation.y = G.time * 2; v.userData.gem.rotation.x = Math.sin(G.time) * 0.3;
      } else if (e.type === "obstacle" || e.type === "barrier") {
        seen.add(e.id);
        this.updateObstacle(e, dt);
      }
    }
    coins.end();
    for (const [id, v] of this.powerViews) if (!seen.has(id)) { this.disposeObj(v); this.powerViews.delete(id); }
    for (const [id, v] of this.obstacleViews) if (!seen.has(id)) this.releaseObstacle(id, v);
  }

  updateObstacle(e, dt) {
    let v = this.obstacleViews.get(e.id);
    if (!v) {
      if (e.kind === "person" || e.kind === "sample") {
        const slot = this.peoplePool[e.kind].find(p => !p.used);
        if (!slot) return;
        slot.used = true; slot.anim.first = true;
        v = { person: slot, obj: null };
      } else {
        const obj = makeObstacleMesh(e);
        if (!obj) return;
        this.scene.add(obj);
        v = { obj };
      }
      this.obstacleViews.set(e.id, v);
    }
    G.path.point(e.s, e.lat, _p);
    const y = (e.level || 0) * C.UPPER_H;
    if (v.person) {
      const ch = v.person.ch;
      ch.root.visible = true; v.person.shadow.visible = true;
      ch.root.position.set(_p.x, y, _p.z); ch.root.rotation.y = -(_p.h + Math.PI);    // walking toward the runner
      v.person.shadow.position.set(_p.x, y + 0.02, _p.z);
      const knocked = e.hit ? G.time - e.hit : -1;
      v.person.phase = (v.person.phase || 0) + dt * (e.vs || 1) / 1.35;
      v.person.anim.update({ gait: "walk", phase: v.person.phase, speedK: 1, t: G.time, carry: e.kind === "sample" ? "tray" : "phone", crashT: knocked >= 0 ? Math.min(1, knocked) : -1 }, dt);
    } else {
      v.obj.position.set(_p.x, y, _p.z); v.obj.rotation.y = -_p.h;
    }
    // "JUMP / SLIDE / DODGE" tips only during the first level, while players learn the obstacles
    if (e.type === "obstacle" && !e.done && G.r.level === 0 && G.level === 0) {
      const how = e.kind === "rope" ? ["JUMP", ACT.jump, "#3f9d5a", 3.0] : e.kind === "banner" ? ["SLIDE", ACT.slide, "#3a6ab0", 2.8] : ["DODGE", ACT.dodge, "#c85440", e.kind === "kiosk" ? 3.7 : 2.6];
      this.addLabel(_p.x, y + how[3], _p.z, how[0], how[1], how[2]);
    }
  }

  releaseObstacle(id, v) {
    if (v.person) { v.person.used = false; v.person.ch.root.visible = false; v.person.shadow.visible = false; }
    else this.disposeObj(v.obj);
    this.obstacleViews.delete(id);
  }

  addLabel(x, y, z, text, how, color) {
    _v.set(x, y, z);
    const camZ = _v2.copy(_v).applyMatrix4(this.camera.matrixWorldInverse).z * -1;
    if (camZ < 1.5 || camZ > 42) return;
    _v.project(this.camera);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const size = Math.max(10, Math.min(30, 0.9 * (h / (2 * Math.tan(this.camera.fov * Math.PI / 360))) / camZ * 0.55));
    this.labels.push({ x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h, size, alpha: Math.max(0, Math.min(1, (42 - camZ) / 14)), text, how, color });
  }

  updateArrows() {
    const c = nextCorner();
    for (const v of this.world.built.values()) {
      const a = v.piece.arrow; if (!a) continue;
      const active = c && v.piece === c.piece && turnWindowOpen();
      if (active) { const k = 0.5 + 0.5 * Math.sin(G.time * 12); a.material.color.setRGB(1, 0.55 + 0.45 * k, 0.45 + 0.55 * k); }
      else a.material.color.setRGB(1, 1, 1);
    }
  }

  project(x, y, z) { _v.set(x, y, z).project(this.camera); return _v; }
}
