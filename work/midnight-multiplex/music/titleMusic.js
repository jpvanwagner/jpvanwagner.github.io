/* ============================================================================
 *  music/titleMusic.js  —  TITLE-SCREEN THEME  (ORIGINAL)
 * ----------------------------------------------------------------------------
 *  An ORIGINAL spooky-but-poppy title theme — think a Saturday-morning
 *  Scooby-Doo chase crossed with a Goosebumps sting: a walking octave bass, a
 *  catchy minor-key hook, a wheezy organ on the chord changes, and a light
 *  boom-snap-shaker groove. Minor key + the Andalusian Am–G–F–E cadence make it
 *  spooky; the bounce and the singable hook make it fun. (The old version was a
 *  detuned "All Star" with two wrong notes — scrapped entirely.)
 *
 *  It starts WITH the Brickroad splash (playBrickroadSplash kicks it off) and
 *  keeps playing through the title menu; it loops seamlessly and stops the
 *  moment a menu item is chosen.
 *
 *  AUTOPLAY: browsers block WebAudio until a user gesture. start() plays at once
 *  if it's allowed; otherwise it arms a one-shot listener so the very first key
 *  press / click / tap (e.g. the "skip splash" key) starts it — no long wait.
 *
 *  WHY A SYNTH, NOT AN AUDIO FILE?  The game runs from file:// where fetch() of
 *  audio is blocked and .mid can't play natively, so everything is rendered with
 *  WebAudio oscillators (same approach as crawlMusic.js).
 *
 *  HOW TO MODIFY (all knobs are constants below):
 *    - Tempo: BPM.  Overall volume: MASTER_VOL.
 *    - The tune: MELODY_BEATS / BASS_BEATS / CHORD_BARS  ([midi,startBeat,durBeat]).
 *    - Groove: the KICK/SNAP/HAT beat-lists in schedulePhrase().
 *  USAGE:  window.TitleMusic.start() / .stop()
 * ========================================================================== */
(function () {
  'use strict';

  // ── the tune (one 16-beat / 4-bar loop), key of A minor, Am–G–F–E ─────────
  // MELODY: a catchy spooky hook; the G#5 over the E chord is the eerie
  // Andalusian leading-tone. [midiNote, startBeat, durationBeats]
  const MELODY_BEATS = [
    [76, 0.0, 0.5], [81, 0.5, 0.5], [84, 1.0, 1.0], [83, 2.0, 0.5], [81, 2.5, 0.5], [79, 3.0, 1.0],   // Am
    [74, 4.0, 0.5], [79, 4.5, 0.5], [83, 5.0, 1.0], [81, 6.0, 0.5], [79, 6.5, 0.5], [74, 7.0, 1.0],   // G
    [77, 8.0, 0.5], [81, 8.5, 0.5], [84, 9.0, 1.0], [83, 10.0, 0.5], [81, 10.5, 0.5], [77, 11.0, 1.0],// F
    [76, 12.0, 0.5], [80, 12.5, 0.5], [83, 13.0, 1.0], [80, 14.0, 0.5], [76, 14.5, 0.5], [74, 15.0, 1.0] // E (G#5=80)
  ];
  // BASS: a bouncy walking-octave line (root, octave-up, root, walk-note).
  const BASS_BEATS = [
    [33, 0, 0.9], [45, 1, 0.9], [33, 2, 0.9], [40, 3, 0.9],     // A1 A2 A1 E2
    [31, 4, 0.9], [43, 5, 0.9], [31, 6, 0.9], [38, 7, 0.9],     // G1 G2 G1 D2
    [29, 8, 0.9], [41, 9, 0.9], [29, 10, 0.9], [36, 11, 0.9],   // F1 F2 F1 C2
    [28, 12, 0.9], [40, 13, 0.9], [28, 14, 0.9], [35, 15, 0.9]  // E1 E2 E1 B1
  ];
  // CHORDS: a wheezy organ triad stabbed on each bar's downbeat (the "spooky
  // lounge organ"). [ [midi,midi,midi], startBeat, durBeat ]
  const CHORD_BARS = [
    [[57, 60, 64], 0, 3.6],   // Am  A3 C4 E4
    [[55, 59, 62], 4, 3.6],   // G   G3 B3 D4
    [[53, 57, 60], 8, 3.6],   // F   F3 A3 C4
    [[52, 56, 59], 12, 3.6]   // E   E3 G#3 B3
  ];

  // ── tunable knobs ─────────────────────────────────────────────────────────
  const BPM           = 122;      // poppy bounce (not the old funeral 60)
  const MASTER_VOL    = 0.16;     // overall volume (gentle)
  const LEAD_VIB_HZ   = 5.5;      // lead vibrato speed (spooky waver)
  const LEAD_VIB_CTS  = 7;        // lead vibrato depth (cents)
  const LEAD_DETUNE   = 8;        // 2nd lead osc detune (shimmer)

  const spb = 60 / BPM;           // seconds per beat
  const LOOP_BEATS = 16;          // seamless loop length

  let ctx = null, master = null, delay = null, fb = null, noiseBuf = null;
  let sustained = [];             // long voices to clean up
  let loopTimer = null;
  let closeTimer = null;          // #3: deferred ctx.close() after stop(); cancelled if start() re-fires first
  let playing = false, started = false;

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.0001;
    // light cavern tail (cheap reverb)
    delay = ctx.createDelay(1.0); delay.delayTime.value = 0.26;
    fb = ctx.createGain(); fb.gain.value = 0.26;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    master._delayIn = delay;
    master.connect(ctx.destination);
    // a reusable white-noise buffer for the percussion
    const len = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // catchy, slightly-wavery LEAD note (triangle + detuned sine + vibrato).
  function playLead(m, at, durSec) {
    const f = midiToFreq(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.85, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.30, at + durSec * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, at + durSec + 0.22);
    g.connect(master); if (master._delayIn) g.connect(master._delayIn);
    const a = ctx.createOscillator(); a.type = 'triangle'; a.frequency.value = f;
    const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = f; b.detune.value = LEAD_DETUNE;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = LEAD_VIB_HZ;
    const lg = ctx.createGain(); lg.gain.value = LEAD_VIB_CTS;
    lfo.connect(lg); lg.connect(a.detune); lg.connect(b.detune);
    const bg = ctx.createGain(); bg.gain.value = 0.5;
    a.connect(g); b.connect(bg); bg.connect(g);
    const end = at + durSec + 0.3;
    a.start(at); b.start(at); lfo.start(at); a.stop(end); b.stop(end); lfo.stop(end);
  }

  // bouncy plucked BASS note (triangle with a quick decay + sub sine).
  function playBass(m, at, durSec) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.9, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + durSec);
    g.connect(master);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = midiToFreq(m);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = midiToFreq(m - 12); o2.detune.value = 3;
    const o2g = ctx.createGain(); o2g.gain.value = 0.5; o2.connect(o2g); o2g.connect(g);
    o.connect(g);
    o.start(at); o2.start(at); o.stop(at + durSec + 0.05); o2.stop(at + durSec + 0.05);
  }

  // wheezy ORGAN chord stab (saw/square triad + slow tremolo).
  function playChord(notes, at, durSec) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.16, at + 0.05);
    g.gain.setValueAtTime(0.16, at + durSec * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, at + durSec);
    g.connect(master); if (master._delayIn) g.connect(master._delayIn);
    const trem = ctx.createOscillator(); trem.type = 'sine'; trem.frequency.value = 6.0;
    const tg = ctx.createGain(); tg.gain.value = 0.04; trem.connect(tg); tg.connect(g.gain);
    trem.start(at); trem.stop(at + durSec + 0.1);
    notes.forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = i === 0 ? 'sawtooth' : 'square';
      o.frequency.value = midiToFreq(m); o.detune.value = (i - 1) * 4;
      const og = ctx.createGain(); og.gain.value = i === 0 ? 0.5 : 0.35;
      o.connect(og); og.connect(g);
      o.start(at); o.stop(at + durSec + 0.1);
    });
  }

  // ── percussion ────────────────────────────────────────────────────────────
  function playKick(at) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
    g.connect(master);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, at); o.frequency.exponentialRampToValueAtTime(46, at + 0.1);
    o.connect(g); o.start(at); o.stop(at + 0.16);
  }
  function playNoise(at, hz, dur, vol, type) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const filt = ctx.createBiquadFilter(); filt.type = type || 'highpass'; filt.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(at); src.stop(at + dur + 0.02);
  }
  const playHat  = (at) => playNoise(at, 8000, 0.035, 0.10, 'highpass');
  const playSnap = (at) => playNoise(at, 1900, 0.07, 0.16, 'bandpass');

  // schedule one 16-beat loop at ctx-time `base`, then queue the next.
  function schedulePhrase(base) {
    if (!playing) return;
    for (const [m, sb, db] of BASS_BEATS)   playBass(m, base + sb * spb, Math.max(0.18, db * spb * 0.9));
    for (const [m, sb, db] of MELODY_BEATS) playLead(m, base + sb * spb, Math.max(0.22, db * spb * 0.92));
    for (const [ns, sb, db] of CHORD_BARS)  playChord(ns, base + sb * spb, db * spb);
    // groove: kick on each bar's 1 & 3, snap on the backbeats (2 & 4), hats on the &s
    for (let beat = 0; beat < LOOP_BEATS; beat++) {
      const t = base + beat * spb;
      if (beat % 2 === 0) playKick(t);          // beats 0,2 of each bar
      else playSnap(t);                          // beats 1,3 of each bar (backbeat)
      playHat(t + spb * 0.5);                    // the "&" of every beat
    }
    const loopLen = LOOP_BEATS * spb;
    const wait = (base - ctx.currentTime + loopLen) * 1000;
    loopTimer = setTimeout(() => schedulePhrase(ctx.currentTime + 0.02), Math.max(40, wait));
  }

  function begin() {
    if (started || !playing) return;
    started = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(MASTER_VOL, ctx.currentTime + 0.4);   // quick fade-in (no long delay)
    schedulePhrase(ctx.currentTime + 0.05);
  }

  function start() {
    if (playing) return;
    // #3: if stop() queued a ctx.close() that hasn't fired yet (quick
    // return to the title), cancel it and reuse the still-live context so
    // the restart isn't torn down a moment later.
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (!ensureCtx()) return;
    playing = true; started = false;
    if (ctx.state === 'running') { begin(); return; }
    // Autoplay blocked → resume, and also start on the first user gesture.
    try { ctx.resume().then(() => { if (playing && ctx.state === 'running') begin(); }).catch(() => {}); } catch (e) {}
    const kick = () => {
      try { ctx && ctx.resume(); } catch (e) {}
      cleanup();
      if (playing && ctx && ctx.state === 'running') begin();
    };
    const evs = ['pointerdown', 'keydown', 'touchstart', 'click'];
    const cleanup = () => evs.forEach(ev => window.removeEventListener(ev, kick, true));
    evs.forEach(ev => window.addEventListener(ev, kick, true));
  }

  function stop() {
    if (!playing) return;
    playing = false; started = false;
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    if (ctx && master) {
      try {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      } catch (e) {}
      const dead = sustained; sustained = [];
      closeTimer = setTimeout(() => {
        dead.forEach(o => { try { o.stop(); } catch (e) {} });
        try { if (ctx) ctx.close(); } catch (e) {}
        ctx = null; master = null; delay = null; fb = null; noiseBuf = null;
        closeTimer = null;
      }, 360);
    }
  }

  window.TitleMusic = { start, stop, get playing() { return playing; } };

  // Self-register into the shared MUSIC REGISTRY so the debug-room SOUND TEST
  // lists this theme automatically.
  (window.MusicRegistry = window.MusicRegistry || []).push({
    id: 'title-theme', label: 'Title theme (spooky-pop)', start: start, stop: stop,
  });
})();
