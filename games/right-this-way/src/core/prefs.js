/*
 * Player preferences (the Settings menu), saved in localStorage when it's
 * available. Anything can listen with onPrefs() and react to changes.
 */
const KEY = 'right-this-way:prefs:v1';

export const DEFAULT_PREFS = {
  officerHighlight: false, // pulsing glow under every officer
  incidentHighlight: true, // glow under loose visitors, requests, lounges, propped doors
  allNames: false, // name tags on everyone (otherwise visitors + busy officers)
  keyHints: true, // keyboard shortcut badges on buttons
  legend: true, // map legend (where there's room)
  daylight: true, // the sun moves across the shift
  smoothCamera: true, // fly into camera views (off: cut straight there)
  uiSize: 'auto', // 'auto' | 'small' | 'medium' | 'large'
};

function load() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export const prefs = { ...DEFAULT_PREFS, ...load() };
const listeners = new Set();

export function setPref(key, value) {
  prefs[key] = value;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* not saved; still applies for this visit */
  }
  listeners.forEach((fn) => fn(key, value));
}

export const onPrefs = (fn) => listeners.add(fn);
