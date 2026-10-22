/* The running path: an endless chain of straight 48 m blocks joined by 90° square junctions.
   Everything in the game is positioned by (s, lateral, height): s = metres along the path centre line.

   Heading convention (h, radians): forward = (sin h, -cos h) in world x/z, right = (cos h, sin h).
   h = 0 runs toward -Z, which is the default three.js camera direction. */
import { BLOCK, TURN_R, FIRST_STRAIGHT_BLOCKS, STRAIGHT_BLOCKS_MIN, STRAIGHT_BLOCKS_MAX } from "../config.js";

export const ARC_LEN = TURN_R * Math.PI / 2;

export function fwdX(h) { return Math.sin(h); }
export function fwdZ(h) { return -Math.cos(h); }
export function rightX(h) { return Math.cos(h); }
export function rightZ(h) { return Math.sin(h); }

export class Path {
  constructor(turnsEnabled) {
    this.turns = turnsEnabled;
    this.segs = [];      // { kind:'S'|'A', s0, len, x0, z0, h0, dir?, cx?, cz? }
    this.pieces = [];    // world-building units: { kind:'block'|'junction', id, s0, s1, x, z, h, dir? }
    this.corners = [];   // { s, dir, taken, missed, x, z, h, piece }
    this.genS = 0; this.genX = 0; this.genZ = 0; this.genH = 0;
    this.blocksLeft = FIRST_STRAIGHT_BLOCKS;
    this.pieceId = 0;
    this._hint = 0;
  }

  ensure(upto) {
    let guard = 0;
    while (this.genS < upto && guard++ < 500) {
      if (this.blocksLeft > 0 || !this.turns) {
        this._addStraight();
        this.blocksLeft--;
        if (!this.turns && this.blocksLeft <= 0) this.blocksLeft = 8;
      } else {
        this._addJunction(Math.random() < 0.5 ? -1 : 1);
        this.blocksLeft = STRAIGHT_BLOCKS_MIN + Math.floor(Math.random() * (STRAIGHT_BLOCKS_MAX - STRAIGHT_BLOCKS_MIN + 1));
      }
    }
  }

  _addStraight() {
    const seg = { kind: "S", s0: this.genS, len: BLOCK, x0: this.genX, z0: this.genZ, h0: this.genH };
    this.segs.push(seg);
    this.pieces.push({ kind: "block", id: this.pieceId++, s0: seg.s0, s1: seg.s0 + BLOCK, x: seg.x0, z: seg.z0, h: seg.h0, after: this.afterTurn || 0 });
    this.afterTurn = 0;
    this.genX += fwdX(this.genH) * BLOCK; this.genZ += fwdZ(this.genH) * BLOCK; this.genS += BLOCK;
  }

  _addJunction(dir) {
    const h0 = this.genH, R = TURN_R;
    const seg = { kind: "A", s0: this.genS, len: ARC_LEN, x0: this.genX, z0: this.genZ, h0, dir,
      cx: this.genX + dir * rightX(h0) * R, cz: this.genZ + dir * rightZ(h0) * R };
    this.segs.push(seg);
    const piece = { kind: "junction", id: this.pieceId++, s0: seg.s0, s1: seg.s0 + ARC_LEN, x: seg.x0, z: seg.z0, h: h0, dir };
    this.pieces.push(piece);
    this.corners.push({ s: seg.s0, dir, taken: false, missed: false, x: seg.x0, z: seg.z0, h: h0, piece });
    // exit point = entry + forward*R + dir*right*R ; heading turns by 90°
    this.genX += fwdX(h0) * R + dir * rightX(h0) * R;
    this.genZ += fwdZ(h0) * R + dir * rightZ(h0) * R;
    this.genH = h0 + dir * Math.PI / 2;
    this.afterTurn = dir;            // the next block's inner wall starts at the corner
    this.genS += ARC_LEN;
  }

  _segAt(s) {
    const segs = this.segs;
    let i = Math.min(this._hint, segs.length - 1);
    if (i < 0) i = 0;
    while (i > 0 && segs[i].s0 > s) i--;
    while (i < segs.length - 1 && segs[i].s0 + segs[i].len <= s) i++;
    this._hint = i;
    return segs[i];
  }

  /** Centre-line frame at distance s: writes {x, z, h, curv} into out. */
  sample(s, out) {
    out = out || {};
    if (s < 0) s = 0;
    const g = this._segAt(s);
    let t = s - g.s0;
    if (g.kind === "S") {
      out.x = g.x0 + fwdX(g.h0) * t; out.z = g.z0 + fwdZ(g.h0) * t; out.h = g.h0; out.curv = 0;
    } else {
      if (t > g.len) t = g.len;
      const h = g.h0 + g.dir * (t / TURN_R);
      out.x = g.cx - g.dir * rightX(h) * TURN_R; out.z = g.cz - g.dir * rightZ(h) * TURN_R; out.h = h; out.curv = g.dir / TURN_R;
    }
    return out;
  }

  /** World position of (s, lateral offset) on the centre-line frame. */
  point(s, lat, out) {
    out = this.sample(s, out);
    out.x += rightX(out.h) * lat; out.z += rightZ(out.h) * lat;
    return out;
  }

  /** Drop path data far behind the player. */
  prune(behindS) {
    while (this.segs.length > 4 && this.segs[1].s0 + this.segs[1].len < behindS) { this.segs.shift(); this._hint = Math.max(0, this._hint - 1); }
    while (this.pieces.length > 2 && this.pieces[0].s1 < behindS - 60) this.pieces.shift();
  }
}
