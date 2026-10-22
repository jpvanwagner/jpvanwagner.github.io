/* DOM heads-up display: score, distance, coin bank, active buffs, and the big TURN / JUMP prompt. */
import { G, nextCorner, turnWindowOpen } from "../game/game.js";
import { BANK_SIZE, LANE, EXIT_WINDOW } from "../config.js";
import { IS_TOUCH } from "./input.js";

const $ = id => document.getElementById(id);
const el = { score: $("score"), distance: $("distance"), bankFill: $("bankFill"), bankLabel: $("bankLabel"), buffs: $("buffs"), turn: $("turnFlag") };
let lastBuffs = "", lastTurn = "";

export function updateHUD() {
  el.score.textContent = Math.round(G.score).toLocaleString();
  el.distance.textContent = Math.round(G.distance) + " m";
  el.bankFill.style.height = Math.round((G.bank / BANK_SIZE) * 100) + "%";
  el.bankFill.style.background = ["#3fa89b", "#3fa89b", "#e39ab4", "#c9784f", "#f0c85a"][G.coinMultIdx] || "#3fa89b";
  el.bankLabel.textContent = "×" + G.coinMult;

  const b = G.buffs; let out = "";
  if (b.speedTime > 0) out += '<div class="buff">SPEED ' + b.speedTime.toFixed(1) + "s</div>";
  if (b.immuneTime > 0) out += '<div class="buff">IMMUNE ' + b.immuneTime.toFixed(1) + "s</div>";
  if (b.magnetTime > 0) out += '<div class="buff">MAGNET ' + b.magnetTime.toFixed(1) + "s</div>";
  if (b.djArm > 0) out += '<div class="buff">DOUBLE-JUMP ' + b.djArm.toFixed(1) + "s</div>";
  if (G.upper && G.r.level === 1) out += '<div class="buff">UPPER LEVEL ' + Math.max(0, G.upper.exitS - G.r.s).toFixed(0) + "m</div>";
  if (out !== lastBuffs) { el.buffs.innerHTML = out; lastBuffs = out; }

  // big centre prompt
  let t = "";
  const r = G.r, jumpWord = IS_TOUCH ? "SWIPE UP" : "JUMP";
  if (G.state === "play") {
    if (G.upper && r.level === 1 && r.mode === "run") {
      if (r.s > G.upper.exitS - EXIT_WINDOW) t = jumpWord + " ↓ DOWN!";
    } else if (b.djArm > 0 && r.level === 0) {
      const side = b.djSide, there = Math.sign(r.lat) === side && Math.abs(r.lat) > LANE * 0.6;
      t = there ? jumpWord + " \u2191 NOW!" : side < 0 ? "MOVE \u25C0 LEFT TO JUMP UP" : "MOVE RIGHT \u25B6 TO JUMP UP";
    } else if (turnWindowOpen()) {
      t = nextCorner().dir < 0 ? "◀ TURN" : "TURN ▶";
    }
  }
  if (t !== lastTurn) { el.turn.textContent = t; el.turn.className = t ? "on" : ""; lastTurn = t; }
}

export function clearTurnFlag() { el.turn.className = ""; el.turn.textContent = ""; lastTurn = ""; }
