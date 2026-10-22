/* Keyboard, touch-swipe and mouse controls. */
import { G, inputDir, inputJump, inputSlide } from "../game/game.js";

export const IS_TOUCH = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;

export function initInput(canvas, { onPause, onResume, onFullscreen }) {
  document.addEventListener("keydown", e => {
    if (e.repeat) return;
    const k = e.code, key = (e.key || "").toLowerCase();
    const left = k === "ArrowLeft" || k === "KeyA" || key === "a";
    const right = k === "ArrowRight" || k === "KeyD" || key === "d";
    const up = k === "ArrowUp" || k === "KeyW" || k === "Space" || key === "w" || key === " ";
    const down = k === "ArrowDown" || k === "KeyS" || key === "s";
    if (G.state === "play" || G.state === "crashing") {
      if (left) { inputDir(-1); e.preventDefault(); }
      else if (right) { inputDir(1); e.preventDefault(); }
      else if (up) { inputJump(); e.preventDefault(); }
      else if (down) { inputSlide(); e.preventDefault(); }
      else if (k === "KeyP" || k === "Escape") onPause();
    } else if (G.state === "paused" && (k === "KeyP" || k === "Escape")) onResume();
    if ((k === "KeyF" || key === "f") && (G.state === "title" || G.state === "paused")) onFullscreen();
  });

  // Swipes fire as soon as the finger has moved far enough (no need to lift).
  let tStart = null, tFired = false;
  canvas.addEventListener("touchstart", e => { tStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; tFired = false; }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (!tStart || tFired) return;
    const dx = e.touches[0].clientX - tStart.x, dy = e.touches[0].clientY - tStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    tFired = true;
    if (Math.abs(dx) > Math.abs(dy)) inputDir(dx > 0 ? 1 : -1); else if (dy < 0) inputJump(); else inputSlide();
  }, { passive: true });
  canvas.addEventListener("touchend", () => { tStart = null; }, { passive: true });

  canvas.addEventListener("mousedown", e => {
    if (G.state !== "play" || IS_TOUCH) return;
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (my < r.height * 0.3) { inputJump(); return; }
    if (my > r.height * 0.82) { inputSlide(); return; }
    inputDir(mx < r.width / 2 ? -1 : 1);
  });
}

export const ACT = IS_TOUCH
  ? { jump: "swipe up", slide: "swipe down", dodge: "swipe aside" }
  : { jump: "W / ↑", slide: "S / ↓", dodge: "A / D" };

const K = IS_TOUCH
  ? { lane: "Swipe \u2190 / \u2192", jump: "Swipe \u2191", slide: "Swipe \u2193", turn: "swipe the arrow's way", pause: "the \u275A\u275A button" }
  : { lane: "\u2190 \u2192 or A / D", jump: "\u2191, W or Space", slide: "\u2193 or S", turn: "press the arrow's direction", pause: "P or Esc" };
export const CONTROL_HINT =
  "<b>Change lanes:</b> " + K.lane + "<br><b>Jump</b> over ropes: " + K.jump + "<br><b>Slide</b> under banners: " + K.slide +
  " (mid-air too)<br><b>Turns:</b> at a junction, " + K.turn + " before you reach the wall<br><b>Pause:</b> " + K.pause +
  "<br><br>Coins fill your bank and raise the coin multiplier. Glowing orbs are power-ups: answer the question to earn one. " +
  "With <b>Double-Jump</b>, move to the side it names and jump to flip up to the upper level; jump again near the end to drop back down." +
  "<br>Crash and you'll get a harder question: answer it to keep running!";
