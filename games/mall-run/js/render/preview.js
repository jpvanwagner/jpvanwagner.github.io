/* Title-screen character preview: the player's runner jogging on a little turntable. */
import * as THREE from "three";
import { buildCharacter } from "./characters/rig.js";
import { Animator } from "./characters/anim.js";
import { PLAYER } from "../settings.js";
import { playerAppearance } from "./characters/player.js";

export class Preview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xefe9dc);
    this.camera = new THREE.PerspectiveCamera(30, 120 / 176, 0.1, 20);
    this.camera.position.set(0, 1.05, 4.3); this.camera.lookAt(0, 0.92, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9ae98, 2.4));
    const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(1.5, 3, 2.5); this.scene.add(d);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 32), new THREE.MeshLambertMaterial({ color: 0xcfc6b0 }));
    disc.position.y = -0.03; this.scene.add(disc);
    this.t = 0; this.ch = null;
    this.rebuild();
  }
  rebuild() {
    if (this.ch) { this.scene.remove(this.ch.root); this.ch.mesh.geometry.dispose(); }
    this.ch = buildCharacter(playerAppearance(PLAYER));
    this.anim = new Animator(this.ch);
    this.scene.add(this.ch.root);
  }
  resize() {
    const w = this.canvas.clientWidth || 120, h = this.canvas.clientHeight || 176;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  /** PNG data URL of the runner mid-stride, for the shareable score card. */
  snapshot(w, h) {
    const r = this.renderer, size = r.getSize(new THREE.Vector2()), pr = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.ch.root.rotation.y = Math.PI + 0.55;
    this.anim.first = true;
    this.anim.update({ gait: "run", phase: 0.3, speedK: 0.8, t: 0, crashT: -1 }, 1 / 60);
    r.render(this.scene, this.camera);
    const url = r.domElement.toDataURL("image/png");
    r.setPixelRatio(pr); r.setSize(size.x, size.y, false);
    this.camera.aspect = size.x / size.y; this.camera.updateProjectionMatrix();
    return url;
  }
  frame(dt) {
    this.t += dt;
    this.ch.root.rotation.y = Math.PI + Math.sin(this.t * 0.6) * 0.9;
    this.anim.update({ gait: "run", phase: this.t * 1.5, speedK: 0.55, t: this.t, crashT: -1 }, dt);
    this.renderer.render(this.scene, this.camera);
  }
}
