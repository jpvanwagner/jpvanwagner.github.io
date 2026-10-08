'use strict';
/* ============================== UTILITIES ============================== */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: fine */ } }
};
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
