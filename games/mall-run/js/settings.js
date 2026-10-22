/* Player settings + character customisation, and the menus that edit them. */
import { START_SPEED, SHIRT_SWATCHES, PANTS_SWATCHES, SKIN_SWATCHES, HAIR_SWATCHES, HEIGHTS, BUILDS, HAIR_STYLES } from "./config.js";

export const SETTINGS = { answerTime: 0, turns: true, startSpeed: START_SPEED, obstacles: true, quality: "auto" };
export const PLAYER = { name: "Player", shirt: SHIRT_SWATCHES[0], pants: PANTS_SWATCHES[0], skin: SKIN_SWATCHES[1], look: "a",
  height: "avg", build: "avg", hairStyle: "short", hair: HAIR_SWATCHES[1] };

const SET_SCHEMA = [
  { key: "answerTime", label: "Time limit to answer", opts: [{ t: "Unlimited", v: 0 }, { t: "5s", v: 5 }, { t: "10s", v: 10 }, { t: "15s", v: 15 }] },
  { key: "startSpeed", label: "Starting speed", opts: [{ t: "Stroll", v: 4 }, { t: "Jog", v: 6 }, { t: "Run", v: 8 }, { t: "Sprint", v: 10 }] },
  { key: "turns", label: "Corridor turns", opts: [{ t: "On", v: true }, { t: "Off", v: false }] },
  { key: "obstacles", label: "Obstacles", opts: [{ t: "On", v: true }, { t: "Off", v: false }] },
  { key: "quality", label: "Graphics", opts: [{ t: "Auto", v: "auto" }, { t: "Fast", v: "low" }, { t: "Pretty", v: "high" }] }
];

// Remember choices between visits (best effort — storage can be unavailable).
const STORE_KEY = "mallrun.prefs.v2";
export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (p && p.settings) Object.assign(SETTINGS, p.settings);
    if (p && p.player) Object.assign(PLAYER, p.player);
  } catch (e) { /* ignore */ }
}
export function savePrefs() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ settings: SETTINGS, player: PLAYER })); } catch (e) { /* ignore */ }
}

export function buildSettingsUI(onChange) {
  const grid = document.getElementById("setGrid"); grid.innerHTML = "";
  SET_SCHEMA.forEach(row => {
    const line = document.createElement("div"); line.className = "set-line";
    const lbl = document.createElement("div"); lbl.className = "lbl"; lbl.textContent = row.label;
    const opts = document.createElement("div"); opts.className = "set-opts";
    row.opts.forEach(o => {
      const b = document.createElement("button"); b.className = "opt"; b.textContent = o.t;
      if (SETTINGS[row.key] === o.v) b.classList.add("on");
      b.onclick = () => {
        SETTINGS[row.key] = o.v;
        opts.querySelectorAll(".opt").forEach(x => x.classList.remove("on")); b.classList.add("on");
        savePrefs(); if (onChange) onChange(row.key);
      };
      opts.appendChild(b);
    });
    line.appendChild(lbl); line.appendChild(opts); grid.appendChild(line);
  });
}

/** Title-screen customiser: name, plus Body / Hair / Colors tabs. */
export function buildCharUI(onChange) {
  const $ = id => document.getElementById(id);
  const changed = () => { savePrefs(); onChange(); };
  function swatches(host, list, key) {
    host.innerHTML = "";
    list.forEach(col => {
      const s = document.createElement("button"); s.className = "sw"; s.style.background = col;
      s.setAttribute("aria-label", key + " " + col);
      if (PLAYER[key] === col) s.classList.add("on");
      s.onclick = () => { PLAYER[key] = col; host.querySelectorAll(".sw").forEach(x => x.classList.remove("on")); s.classList.add("on"); changed(); };
      host.appendChild(s);
    });
  }
  // ◀ value ▶ pickers: compact, one row each
  function cycler(host, list, key) {
    host.innerHTML = "";
    const prev = document.createElement("button"), next = document.createElement("button"), label = document.createElement("span");
    prev.className = next.className = "cyc"; prev.textContent = "\u25C0"; next.textContent = "\u25B6";
    prev.setAttribute("aria-label", "previous " + key); next.setAttribute("aria-label", "next " + key);
    const show = () => { const o = list.find(x => x.v === PLAYER[key]) || list[0]; label.textContent = o.t; };
    const step = d => { let i = list.findIndex(x => x.v === PLAYER[key]); if (i < 0) i = 0; PLAYER[key] = list[(i + d + list.length) % list.length].v; show(); changed(); };
    prev.onclick = () => step(-1); next.onclick = () => step(1);
    host.append(prev, label, next); show();
  }
  cycler($("heightCyc"), HEIGHTS, "height");
  cycler($("buildCyc"), BUILDS, "build");
  cycler($("hairCyc"), HAIR_STYLES, "hairStyle");
  swatches($("skinSw"), SKIN_SWATCHES, "skin");
  swatches($("hairSw"), HAIR_SWATCHES, "hair");
  swatches($("shirtSw"), SHIRT_SWATCHES, "shirt");
  swatches($("pantsSw"), PANTS_SWATCHES, "pants");
  document.querySelectorAll(".look").forEach(el => {
    el.classList.toggle("on", el.dataset.look === PLAYER.look);
    el.onclick = () => {
      PLAYER.look = el.dataset.look;
      document.querySelectorAll(".look").forEach(x => x.classList.remove("on")); el.classList.add("on");
      changed();
    };
  });
  document.querySelectorAll(".tab").forEach(t => {
    t.onclick = () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
      document.querySelectorAll(".tabpane").forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
    };
  });
  const ni = $("nameInput");
  ni.value = PLAYER.name;
  ni.oninput = () => { PLAYER.name = ni.value.trim() || "Player"; savePrefs(); };
}
