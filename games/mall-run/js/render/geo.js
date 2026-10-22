/* GeoBatch: accumulate lots of simple primitives (boxes, cylinders, spheres, quads) with per-vertex
   colours into ONE BufferGeometry, so a whole mall block draws in a handful of draw calls. */
import * as THREE from "three";

function proto(g) {
  const count = g.attributes.position.count;
  let index = g.index ? Array.from(g.index.array) : null;
  if (!index) { index = []; for (let i = 0; i < count; i++) index.push(i); }
  return { pos: g.attributes.position.array, nor: g.attributes.normal.array, uv: g.attributes.uv ? g.attributes.uv.array : null, count, index };
}
export { proto as makeProto };
export const PROTO = {
  box: proto(new THREE.BoxGeometry(1, 1, 1)),
  cyl: proto(new THREE.CylinderGeometry(1, 1, 1, 8, 1)),
  cyl6: proto(new THREE.CylinderGeometry(1, 1, 1, 6, 1)),
  cone: proto(new THREE.CylinderGeometry(0, 1, 1, 8, 1)),
  sphere: proto(new THREE.SphereGeometry(1, 8, 6)),
  sphereLo: proto(new THREE.SphereGeometry(1, 5, 4)),
  torus: proto(new THREE.TorusGeometry(1, 0.08, 3, 12))
};

const colorCache = new Map();
export function col(c) {
  if (c && c.isColor) return c;
  let v = colorCache.get(c);
  if (!v) { v = new THREE.Color(c); colorCache.set(c, v); }
  return v;
}
/** Darken / lighten a colour: f < 1 darker, f > 1 lighter (towards white). */
export function shade(c, f) {
  const k = "s" + c + "_" + f;
  let v = colorCache.get(k);
  if (!v) {
    v = col(c).clone();
    if (f <= 1) v.multiplyScalar(f); else v.lerp(new THREE.Color(1, 1, 1), Math.min(1, f - 1));
    colorCache.set(k, v);
  }
  return v;
}

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();

export class GeoBatch {
  constructor(withUV) {
    this.pos = []; this.nor = []; this.col = []; this.idx = []; this.uv = withUV ? [] : null;
    this.stack = [new THREE.Matrix4()];
  }
  get M() { return this.stack[this.stack.length - 1]; }
  /** Push a local frame (translation, Y rotation, optional full matrix). */
  push(x, y, z, ry, m) {
    const t = new THREE.Matrix4();
    if (m) t.copy(m); else { t.makeRotationY(ry || 0); t.setPosition(x || 0, y || 0, z || 0); }
    this.stack.push(this.M.clone().multiply(t));
  }
  pushMatrix(m) { this.stack.push(this.M.clone().multiply(m)); }
  pop() { this.stack.pop(); }

  add(p, local, color) {
    const m = _m.multiplyMatrices(this.M, local);
    _n.getNormalMatrix(m);
    const c = col(color), P = p.pos, N = p.nor, pos = this.pos, nor = this.nor, cc = this.col;
    const base = pos.length / 3, I = p.index, idx = this.idx;
    for (let i = 0; i < I.length; i++) idx.push(base + I[i]);
    for (let i = 0; i < p.count; i++) {
      _v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(m);
      pos.push(_v.x, _v.y, _v.z);
      _v.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).applyMatrix3(_n).normalize();
      nor.push(_v.x, _v.y, _v.z);
      cc.push(c.r, c.g, c.b);
      if (this.uv) this.uv.push(p.uv ? p.uv[i * 2] : 0, p.uv ? p.uv[i * 2 + 1] : 0);
    }
  }
  /** Axis-aligned (in current frame) box centred at (x,y,z); optional Y rotation. */
  box(x, y, z, w, h, d, color, ry, rx, rz) {
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e);
    const l = new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(w, h, d));
    this.add(PROTO.box, l, color);
  }
  /** Box from y0 to y1 (handy for walls/posts). */
  boxY(x, y0, y1, z, w, d, color) { this.box(x, (y0 + y1) / 2, z, w, y1 - y0, d, color); }
  cyl(x, y, z, r, h, color, lo, rx, rz) {
    _e.set(rx || 0, 0, rz || 0); _q.setFromEuler(_e);
    const l = new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(r, h, r));
    this.add(lo ? PROTO.cyl6 : PROTO.cyl, l, color);
  }
  cone(x, y, z, r, h, color) {
    const l = new THREE.Matrix4().compose(_v.set(x, y, z), _q.identity(), _s.set(r, h, r));
    this.add(PROTO.cone, l, color);
  }
  sphere(x, y, z, r, color, sy, lo) {
    const l = new THREE.Matrix4().compose(_v.set(x, y, z), _q.identity(), _s.set(r, r * (sy || 1), r));
    this.add(lo ? PROTO.sphereLo : PROTO.sphere, l, color);
  }
  torus(x, y, z, r, color, rx) {
    _e.set(rx || 0, 0, 0); _q.setFromEuler(_e);
    const l = new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(r, r, r));
    this.add(PROTO.torus, l, color);
  }
  /** Flat quad p0..p3 (counter-clockwise when seen from the front). Points are [x,y,z]. */
  quad(p0, p1, p2, p3, color, uvs) {
    const m = this.M, c = col(color);
    const a = new THREE.Vector3(...p0).applyMatrix4(m), b = new THREE.Vector3(...p1).applyMatrix4(m),
          cc = new THREE.Vector3(...p2).applyMatrix4(m), d = new THREE.Vector3(...p3).applyMatrix4(m);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(cc, a)).normalize();
    const pts = [a, b, cc, d], uv = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]], base = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      this.pos.push(pts[i].x, pts[i].y, pts[i].z); this.nor.push(n.x, n.y, n.z); this.col.push(c.r, c.g, c.b);
      if (this.uv) this.uv.push(uv[i][0], uv[i][1]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  get empty() { return this.pos.length === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    if (this.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
  mesh(material) { const m = new THREE.Mesh(this.geometry(), material); m.matrixAutoUpdate = false; return m; }
}
