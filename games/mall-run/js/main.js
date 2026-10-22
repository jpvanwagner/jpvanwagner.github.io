/* MALL RUN — entry point: boot, screens, and the main loop.
   Module map:
     config.js / questions.js      tuning + content
     game/                         simulation (path, runner, spawning, shoppers) — no rendering
     render/                       three.js view (world builder, shops, characters, props, camera)
     ui/                           DOM HUD, quiz modal, input, 2D effects overlay */
import * as game from "./game/game.js";
import { G, resetGame, update, updateCrash, revive, applyPower, attractUpdate } from "./game/game.js";
import { View } from "./render/view.js";
import { Preview } from "./render/preview.js";
import { initInput, CONTROL_HINT } from "./ui/input.js";
import { updateHUD, clearTurnFlag } from "./ui/hud.js";
import { openQuestion, resetQuestions } from "./ui/quiz.js";
import { resizeFx, addPopup, doFlash, startLevelFlash, drawFx, clearFx } from "./ui/fx2d.js";
import { SETTINGS, PLAYER, loadPrefs, buildSettingsUI, buildCharUI } from "./settings.js";
import { SCORM } from "./scorm.js";
import { NPC_MAX, LEVELS, THEMES } from "./config.js";
import { setupShare } from "./ui/share.js";

const $ = id => document.getElementById(id);

// Credit line: "2026", or "2026-<this year>" once the calendar moves on.
(function copyright() {
  const y = new Date().getFullYear();
  $("copyYears").textContent = y > 2026 ? "2026-" + y : "2026";
})();

let view, preview;
try {
  loadPrefs();
  view = new View($("gc"));
  preview = new Preview($("charPrev"));
} catch (err) {
  $("bootErrorMsg").textContent = "Your browser couldn't start 3D graphics (WebGL). Try another browser or enable hardware acceleration.";
  $("bootError").classList.add("show");
  throw err;
}
view.buildPool(SETTINGS.quality === "low" ? Math.round(NPC_MAX * 0.6) : NPC_MAX + 4);

/* ---------------- sizing ---------------- */
function fit() {
  const w = window.innerWidth || 360, h = window.innerHeight || 640;
  view.resize(w, h);
  resizeFx(w, h, Math.min(window.devicePixelRatio || 1, 2));
  preview.resize();
}
view.onQuality = fit;
window.addEventListener("resize", fit);
window.addEventListener("orientationchange", () => setTimeout(fit, 120));
[60, 300, 900].forEach(t => setTimeout(fit, t));
fit();

/* ---------------- screens ---------------- */
const OVERLAYS = ["title", "settings", "help", "quiz", "pause", "ended"];
function show(id) { $(id).classList.add("show"); }
function hide(id) { $(id).classList.remove("show"); }
function hideAll() { OVERLAYS.forEach(hide); }
function chrome(on) {
  $("hud").style.display = on ? "flex" : "none";
  $("pauseBtn").style.display = on ? "block" : "none";
  $("buffs").style.display = on ? "flex" : "none";
}

function newRun() {
  resetGame(); resetQuestions(); clearFx();
  view.reset();
}
function startGame() {
  newRun();
  hideAll(); chrome(true);
  G.state = "play";
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function pauseGame() { if (G.state !== "play") return; G.state = "paused"; show("pause"); }
function resumeGame() { if (G.state !== "paused") return; hide("pause"); G.state = "play"; }
function gameOver() {
  G.state = "ended"; chrome(false); clearTurnFlag();
  $("endTitle").textContent = (PLAYER.name || "Player") + " - Game Over";
  $("endScore").textContent = Math.round(G.score).toLocaleString();
  const area = LEVELS[G.level % THEMES.length];
  $("endStats").textContent = "Distance " + Math.round(G.distance) + " m  \u2022  Level " + (G.level + 1) + " (" + area + ")  \u2022  Revives " + G.revives;
  const st = G.stats, summary = {
    name: PLAYER.name || "Player", score: Math.round(G.score), distance: Math.round(G.distance), level: G.level + 1, area,
    rows: [["Distance", Math.round(G.distance).toLocaleString() + " m"], ["Coins collected", st.coins.toLocaleString()],
      ["Best coin multiplier", "\u00d7" + st.bestMult], ["Questions right", st.correct + " / " + st.asked],
      ["Turns made", st.turns], ["Trips to the upper level", st.balconies], ["Revives", G.revives]]
  };
  setupShare(summary, () => preview.snapshot(380, 540), document.querySelector(".jv-icon") && document.querySelector(".jv-icon").src);
  SCORM.report(Math.min(100, Math.round(G.distance / 13)), G.distance > 200);
  show("ended");
}
function gotoTitle() {
  newRun();
  G.state = "title"; chrome(false); hideAll(); clearTurnFlag();
  buildCharUI(() => { preview.rebuild(); view.setRunnerAppearance(); });
  show("title");
}
function toggleFullscreen() {
  const el = document.documentElement, d = document, fs = d.fullscreenElement || d.webkitFullscreenElement;
  if (!fs) (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
  else (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
  setTimeout(fit, 150);
}

$("playBtn").onclick = startGame;
$("settingsBtn").onclick = () => { buildSettingsUI(key => { if (key === "quality") fit(); }); show("settings"); };
$("setDone").onclick = () => hide("settings");
$("helpBtn").onclick = () => show("help");
$("helpDone").onclick = () => hide("help");
$("fsBtn").onclick = toggleFullscreen;
$("pauseBtn").onclick = pauseGame;
$("resumeBtn").onclick = resumeGame;
$("pauseFsBtn").onclick = toggleFullscreen;
$("restartBtn").onclick = startGame;
$("pauseTitleBtn").onclick = gotoTitle;
$("againBtn").onclick = startGame;
$("endTitleBtn").onclick = gotoTitle;
$("ctrlHint").innerHTML = CONTROL_HINT;
initInput($("gc"), { onPause: pauseGame, onResume: resumeGame, onFullscreen: toggleFullscreen });
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(); });

/* ---------------- game events -> UI ---------------- */
function drainEvents() {
  const evs = G.events; G.events = [];
  for (const e of evs) {
    if (e.type === "popup") addPopup(e.text, e.color);
    else if (e.type === "crash") { doFlash("#c85440", 0.5); view.shake = 1; addPopup("CRASH!", "#c85440"); }
    else if (e.type === "levelUp") startLevelFlash(e.level);
    else if (e.type === "snapCamera") view.snapCamera();
    else if (e.type === "question") {
      G.state = "quiz";
      openQuestion(e.mode, e.kind, e.reason, correct => {
        G.stats.asked++; if (correct) G.stats.correct++;
        if (e.mode === "revive") { if (correct) revive(); else gameOver(); }
        else { if (correct) applyPower(e.kind); if (G.state === "quiz") G.state = "play"; }
        game.questionClosed();          // (after revive, which may move the runner past a corner)
      });
    }
  }
}

/* ---------------- loop ---------------- */
view.setRunnerAppearance();
gotoTitle();

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) dt = 1 / 60;
  dt = Math.min(dt, 1 / 20);

  if (G.state === "play") update(dt);
  else if (G.state === "crashing") updateCrash(dt);
  else if (G.state === "title") attractUpdate(dt);   // keep jogging through the mall behind the menu
  drainEvents();

  view.frame(G.state === "paused" || G.state === "quiz" ? 0.0001 : dt);
  view.trackPerf(dt);
  drawFx(dt, G.state === "play" ? view.labels : []);
  if (G.state === "play" || G.state === "crashing") updateHUD();
  if (G.state === "title") preview.frame(dt);
}
requestAnimationFrame(loop);

// handy for debugging from the console / automated tests
window.__mallrun = { G, view, preview, game, startGame, gotoTitle, gameOver };
