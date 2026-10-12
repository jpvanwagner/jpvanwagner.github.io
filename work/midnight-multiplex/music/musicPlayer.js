/* ============================================================================
 *  music/musicPlayer.js  —  the game's music: ZzFXM songs, loaded when needed
 * ----------------------------------------------------------------------------
 *  Every piece of music is a SONG FILE you can open in ZzFXM Tracker
 *  (https://keithclark.github.io/ZzFXM/tracker/ — File ▸ Open / Save):
 *
 *    music/songs/title-theme.js      title screen + credits (loops)
 *    music/songs/opening-crawl.js    the opening story crawl (one-shot)
 *    music/songs/jingle-summer.js    start-of-game jingle, summer scenario
 *    music/songs/jingle-winter.js    start-of-game jingle, winter scenario
 *
 *  A song file is the tracker's own format: one bare ZzFXM song array
 *  [instruments, patterns, sequence, bpm, {metadata}] — nothing else in the
 *  file, so the tracker can open it and save over it.
 *
 *  WHEN A SONG IS NEEDED the game fetches its file (over http(s): the song file
 *  itself, so a tracker save shows up on reload). From file:// (where fetch is
 *  blocked) it loads music/songs/offline/<id>.js instead — a one-line copy that
 *  registers the same array. Those copies are GENERATED: after saving a song in
 *  the tracker, run `npm run music` (npm run demo also does it).
 *
 *  RENDERING: ZzFXM turns a song into raw audio before it plays (the same
 *  zzfxM() the tracker uses — vendor/zzfxm/zzfxm.js — so it sounds the same in
 *  both). That takes ~1 s for the title loop and a few seconds for the crawl, so
 *  it runs in a background Worker (main-thread fallback) and the result is
 *  cached. The title theme renders as soon as the page loads; the crawl renders
 *  right after it, so both are ready before they're needed.
 *
 *  ADD A SONG: save it from the tracker into music/songs/<id>.js, add an entry to
 *  SONGS below (label, loop, gain), run `npm run music`, then play it with
 *  MMMusic.play('<id>') — or wrap it like TitleMusic below. Every SONGS entry
 *  shows up in the debug-room SOUND TEST automatically (window.MusicRegistry).
 *
 *  API: MMMusic.play(id) → handle {stop(fadeSec)} · MMMusic.preload(id) →
 *       Promise · MMMusic.stopAll() · MMMusic.SONGS
 *       window.TitleMusic / window.CrawlMusic: start() · stop() · .playing
 * ========================================================================== */
(function () {
  'use strict';

  // id → how it plays. gain: per-song volume (1 = as rendered). loop: repeat
  // seamlessly (loop point = the end of the last pattern).
  const SONGS = {
    'title-theme':   { label: 'Title theme',             loop: true,  gain: 0.75 },
    'opening-crawl': { label: 'Opening-crawl music',     loop: false, gain: 0.65 },
    'jingle-summer': { label: 'Start jingle (summer)',   loop: false, gain: 1.2 },
    'jingle-winter': { label: 'Start jingle (winter)',   loop: false, gain: 1.2 },
  };
  const DIR = 'music/songs/';
  const FADE_IN = 0.35;            // seconds; also the default stop() fade-out

  // ── 1. LOADING THE SONG FILES ────────────────────────────────────────────
  const songs = {};                // id → song array
  const waiting = {};              // id → [resolve…] for the file:// script route
  const loading = {};              // id → Promise<song>

  // The tracker's own parser (zzfxm-song-encoder decode.js): the files are
  // "short JSON" — empty slots like [,0,220] mean "default" — so turn those into
  // nulls, JSON.parse, and drop the nulls again (zzfxG then uses its defaults).
  function parseSong(text) {
    const safe = text.replace(/\[,/g, '[null,').replace(/,,\]/g, ',null]').replace(/,\s*(?=[,\]])/g, ',null')
      .replace(/([\[,]-?)(?=\.)/g, '$10').replace(/-\./g, '-0.');
    return JSON.parse(safe, (k, v) => (v === null ? undefined : v));
  }
  // Called by the generated music/songs/offline/<id>.js copies.
  function register(id, song) {
    songs[id] = song;
    (waiting[id] || []).forEach(fn => fn(song));
    delete waiting[id];
  }
  function loadViaScript(id) {
    return new Promise((resolve, reject) => {
      (waiting[id] = waiting[id] || []).push(resolve);
      const s = document.createElement('script');
      s.src = DIR + 'offline/' + id + '.js';
      s.onerror = () => reject(new Error('music: no song file for "' + id + '"'));
      document.head.appendChild(s);
    });
  }
  function loadSong(id) {
    if (songs[id]) return Promise.resolve(songs[id]);
    if (loading[id]) return loading[id];
    const http = /^https?:$/.test(location.protocol);
    const p = http
      ? fetch(DIR + id + '.js', { cache: 'no-cache' })
          .then(r => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
          .then(t => { register(id, parseSong(t)); return songs[id]; })
          .catch(() => loadViaScript(id))
      : loadViaScript(id);
    loading[id] = p.catch(e => { delete loading[id]; throw e; });
    return loading[id];
  }

  // ── 2. RENDERING (zzfxM, off the main thread) ────────────────────────────
  const pcm = {};                  // id → { L: Float32Array, R: Float32Array, loopEnd }
  const rendering = {};            // id → Promise
  let worker;                      // undefined = not tried · false = unavailable
  let jobSeq = 0;
  const jobs = {};
  function getWorker() {
    if (worker !== undefined) return worker;
    try {
      // the same two vendored functions, inside a blob Worker (works from file:// too)
      const src = 'zzfxR=44100;zzfxV=.3;zzfxG=' + window.zzfxG.toString() + ';zzfxM=' + window.zzfxM.toString() + ';\n' +
        'onmessage=function(e){try{var o=zzfxM.apply(null,e.data.song),L=Float32Array.from(o[0],function(x){return x||0}),' +
        'R=Float32Array.from(o[1],function(x){return x||0});postMessage({job:e.data.job,L:L,R:R},[L.buffer,R.buffer]);}' +
        'catch(err){postMessage({job:e.data.job,error:String(err)});}};';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = (e) => { const j = jobs[e.data.job]; delete jobs[e.data.job]; if (!j) return; e.data.error ? j.reject(new Error(e.data.error)) : j.resolve(e.data); };
      worker.onerror = () => { const pending = Object.keys(jobs); worker = false; pending.forEach(k => { const j = jobs[k]; delete jobs[k]; j.fallback(); }); };
    } catch (e) { worker = false; }
    return worker;
  }
  function renderOnMainThread(song) {
    return new Promise((resolve) => setTimeout(() => {
      const o = window.zzfxM.apply(null, song);
      resolve({ L: Float32Array.from(o[0], x => x || 0), R: Float32Array.from(o[1], x => x || 0) });
    }, 0));
  }
  function renderSong(song) {
    const w = getWorker();
    if (!w) return renderOnMainThread(song);
    return new Promise((resolve, reject) => {
      const job = ++jobSeq;
      jobs[job] = { resolve, reject, fallback: () => renderOnMainThread(song).then(resolve, reject) };
      w.postMessage({ job, song });
    });
  }
  // Seconds of one pass through the sequence (the loop point) — zzfxM's own row length.
  function songLength(song) {
    const bpm = song[3] || 125, beat = (44100 / bpm * 60) >> 2;
    const rows = song[2].reduce((n, pi) => n + song[1][pi][0].length - 2, 0);
    return rows * beat;            // in samples
  }
  function preload(id) {
    if (pcm[id]) return Promise.resolve(pcm[id]);
    if (rendering[id]) return rendering[id];
    rendering[id] = loadSong(id)
      .then(song => renderSong(song).then(d => { d.loopEnd = songLength(song); pcm[id] = d; return d; }))
      .catch(e => { delete rendering[id]; console.warn(e); throw e; });
    return rendering[id];
  }

  // ── 3. PLAYBACK ──────────────────────────────────────────────────────────
  let ctx = null, master = null;
  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    return ctx;
  }
  // Browsers block audio until a click/key. If the context isn't running yet,
  // resume it on the very first gesture (and anything queued starts then).
  let gestureArmed = false;
  function whenAudible(fn) {
    const c = ensureCtx(); if (!c) return;
    if (c.state === 'running') { fn(); return; }
    try { c.resume().then(() => { if (c.state === 'running') fn(); }).catch(() => {}); } catch (e) {}
    if (gestureArmed) { (whenAudible._q = whenAudible._q || []).push(fn); return; }
    gestureArmed = true; (whenAudible._q = whenAudible._q || []).push(fn);
    const evs = ['pointerdown', 'keydown', 'touchstart', 'click'];
    const kick = () => {
      evs.forEach(ev => window.removeEventListener(ev, kick, true)); gestureArmed = false;
      c.resume().then(() => { const q = whenAudible._q || []; whenAudible._q = []; q.forEach(f => f()); }).catch(() => {});
    };
    evs.forEach(ev => window.addEventListener(ev, kick, true));
  }
  const live = new Set();
  function play(id, opts) {
    opts = opts || {};
    const cfg = SONGS[id] || { loop: false, gain: 1 };
    const h = { id, stopped: false, ended: false, src: null, gain: null, onended: opts.onended || null,
      stop(fade) { stopHandle(h, fade); } };
    live.add(h);
    preload(id).then(d => whenAudible(() => {
      if (h.stopped) return;
      const c = ctx;
      const buf = c.createBuffer(2, d.L.length, 44100);
      buf.copyToChannel(d.L, 0); buf.copyToChannel(d.R, 1);
      const src = c.createBufferSource(); src.buffer = buf;
      if (opts.loop != null ? opts.loop : cfg.loop) { src.loop = true; src.loopStart = 0; src.loopEnd = Math.min(d.loopEnd, d.L.length) / 44100; }
      const g = c.createGain();
      const vol = (opts.gain != null ? opts.gain : cfg.gain);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), c.currentTime + FADE_IN);
      src.connect(g); g.connect(master);
      src.onended = () => { if (h.src === src) { h.ended = true; live.delete(h); if (h.onended) h.onended(); } };
      src.start();
      h.src = src; h.gain = g;
    })).catch(() => { h.ended = true; live.delete(h); });
    return h;
  }
  function stopHandle(h, fade) {
    if (!h || h.stopped) return;
    h.stopped = true; live.delete(h);
    if (!h.src || !ctx) return;
    const f = fade == null ? 0.3 : fade, now = ctx.currentTime;
    try {
      h.gain.gain.cancelScheduledValues(now);
      h.gain.gain.setValueAtTime(Math.max(0.0001, h.gain.gain.value), now);
      h.gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.02, f));
      h.src.stop(now + Math.max(0.02, f) + 0.02);
    } catch (e) {}
  }
  function stopAll(fade) { [...live].forEach(h => stopHandle(h, fade)); }

  // ── 4. THE GAME'S TRACKS (same API the game always used) ─────────────────
  // start() is a no-op while already playing; stop() fades out.
  function track(id) {
    let h = null;
    const t = {
      start() { if (h && !h.stopped && !h.ended) return; h = play(id); },
      stop() { if (h) { h.stop(); h = null; } },
      get playing() { return !!(h && !h.stopped && !h.ended); },
    };
    return t;
  }
  window.MMMusic = { SONGS, play, preload, stopAll, register, parseSong };
  window.TitleMusic = track('title-theme');
  window.CrawlMusic = track('opening-crawl');

  // debug-room SOUND TEST: every song, automatically
  window.MusicRegistry = window.MusicRegistry || [];
  Object.keys(SONGS).forEach(id => {
    const t = (id === 'title-theme') ? window.TitleMusic : (id === 'opening-crawl') ? window.CrawlMusic : track(id);
    window.MusicRegistry.push({ id, label: SONGS[id].label, start: t.start, stop: t.stop });
  });

  // Get the first two songs ready early (the title theme plays with the splash).
  try { preload('title-theme').then(() => preload('opening-crawl')).catch(() => {}); } catch (e) {}
})();
