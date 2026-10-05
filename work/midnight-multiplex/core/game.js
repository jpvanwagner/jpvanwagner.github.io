/* ════════════════════════════════════════════════════════════════════════════
 * MIDNIGHT AT THE MULTIPLEX  —  GAME RUNTIME (terminal half)
 * ────────────────────────────────────────────────────────────────────────────
 * Location: midmulti/core/game.js
 *
 * WHAT THIS FILE IS
 * ──────────────────────────────────────────────────────────────────────────
 * The text-mode in-game runtime: state, audio engine, music engine, world
 * clock, ASCII frame, gameplay UI, character sheet, save/load, hotkeys, and
 * the in-game screens (LOAD, HELP_MECHANICS, EVENT_LOG, CHARACTER_SHEET,
 * ESC_MENU, GAME_OVER, QUIT). Location screens live in core/locations/.
 *
 * It does NOT contain the title screen (that's core/title.js, a canvas
 * module) or the chargen flow / settings / credits — those live in:
 *   core/chargen.js   — character creation screens + data tables
 *   core/settings.js  — Settings screen
 *   core/credits.js   — Credits screen
 *
 * HOW THE GAME RUNS
 * ──────────────────────────────────────────────────────────────────────────
 *   1. midmulti.html loads game.js FIRST (then settings/credits/chargen,
 *      then title.js last). That populates window.MultiplexGame.
 *   2. title.js renders the pixel-art title canvas and listens for menu picks.
 *   3. When the player picks 1-6, midmulti.html calls
 *      MultiplexGame.show(screenName) which:
 *         - adds .terminal-active to body (swaps canvas to terminal)
 *         - sets State.screen and calls render()
 *   4. From there on, the terminal uses its own event loop:
 *         - State holds all runtime data
 *         - Screens[name].render() returns an HTML string for #display
 *         - Screens[name].handle(text) processes input from the prompt
 *         - goto(name) pushes history + re-renders
 *         - back() pops history; if empty, calls MultiplexGame.hide() to
 *           return to the title canvas.
 *
 * IF YOU'RE LOOKING FOR …
 * ──────────────────────────────────────────────────────────────────────────
 *   - A new stat:                 STAT_KEYS / STAT_INFO   -> core/chargen.js
 *   - A new age bracket:          AGE_MODS                -> core/chargen.js
 *   - A new gender:               GENDER_OPTIONS          -> core/chargen.js
 *   - A new orientation:          ORIENTATION_OPTIONS     -> core/chargen.js
 *   - A new hobby:                HOBBIES                 -> core/chargen.js
 *   - A new skill:                SKILLS                  -> core/chargen.js
 *   - A new clique:               CLIQUES                 -> core/chargen.js
 *   - A new place to live:        LOCATIONS               -> core/chargen.js
 *   - A new in-game screen:       add Screens.MY_SCREEN here
 *   - A new sound effect:         add to `sfx` object below
 *   - Title music / menu / look:  core/title.js (canvas module)
 *   - The pretty in-game frame:   renderInGameFrame() / renderGameplayUI()
 *
 * HOTKEYS (trapped via keydown so they don't echo into the input):
 *   F2  - save the current character
 *   F3  - toggle the in-game character sheet
 *   F4  - load the most recent save
 *   F6  - cycle audio mode (all-on / music-off / sounds-off / muted)
 *   F8  - hide/show the stats partition (in-game only)
 *   F10 - universal "back" (sends "back" to the current screen)
 *   F11 - toggle browser fullscreen
 *   ESC - pause / settings menu (in-game)
 * ════════════════════════════════════════════════════════════════════════════
 */

//───── DOM ELEMENTS ─────────────────────────────────────────────────────────
const display       = document.getElementById('display');
const input         = document.getElementById('input');
// keep the input only as wide as its content so the block cursor (a
// trailing element) sits right after the typed text. Measured in 'ch' with a
// small pad; clamped so an empty prompt still shows the cursor.
function syncInputWidth() {
  if (!input) return;
  const len = (input.value ? input.value.length : 0);
  // width = exact content length so the block cursor (1ch wide, rendered
  // right after the input) occupies the very next character cell — the spot the
  // next typed character will fill. Minimum 0 so an empty prompt shows just the
  // cursor cell.
  input.style.width = len + 'ch';
}
if (input) {
  input.addEventListener('input', syncInputWidth);
  setTimeout(syncInputWidth, 0);
}
const hotkeyBar     = document.getElementById('hotkey-bar');
const versionTag    = document.getElementById('version-tag');

//───── VERSION ──────────────────────────────────────────────────────────────
// Update this when you cut a new build. The canvas title screen (core/title.js)
// shows its own version label, so the host page no longer needs a #version-tag
// element — but if one IS present we fill it in. (Null-safe so game.js loads
// whether or not the host provides the element.)
const VERSION = 'v0.3 pre-alpha';
if (versionTag) versionTag.textContent = VERSION;
//═══════════════════════════════════════════════════════════════════════════
// AUDIO ENGINE
//═══════════════════════════════════════════════════════════════════════════
//
// Browsers require a user gesture before audio can play. We lazy-init the
// AudioContext on first interaction (see firstGesture() at the bottom).
//
// All sound is synthesized live with Web Audio. There are NO audio assets.
// To change a sound effect, edit the sfx object below.
//
//───────────────────────────────────────────────────────────────────────────

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Play a single tone. type: 'square' | 'sawtooth' | 'triangle' | 'sine'.
function beep(freq, dur=0.06, type='square', vol=0.04) {
  if (!State.settings.sounds) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

// a short burst of filtered white noise — used for sparks, blower motors,
// breathy scream texture, door scrapes. dur in s; type 'lowpass'|'highpass'|
// 'bandpass'; freq = filter cutoff/center; vol peak gain.
function noise(dur=0.2, freq=1000, filt='bandpass', vol=0.05, q=1) {
  if (!State.settings.sounds) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = filt; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(); src.stop(ctx.currentTime + dur + 0.02);
  return { src, f, g };
}
// a tone that GLIDES from f0→f1 over dur — screams, sirens, door whirs.
function glide(f0, f1, dur=0.4, type='sawtooth', vol=0.04) {
  if (!State.settings.sounds) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + dur + 0.02);
}

// note1: a one-shot leaf-blower motor burst that mirrors the leafblower
// minigame's RetroAudioEngine exactly — a sawtooth at (42 + level*16) Hz plus
// lowpass-filtered white noise (cutoff 280 + level*240 Hz), ramped up and back
// down over ~0.7s. level ∈ {1,2,3}. Used by sfx.blower1/2/3 in the debug booth.
function blowerBurst(level=1) {
  if (!State.settings.sounds) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime, dur = 0.7;
  // Sawtooth motor buzz.
  const osc = ctx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(42 + level * 16, t0);
  const gOsc = ctx.createGain();
  // Matches the minigame's very low engine-buzz multiplier (0.003*level), nudged
  // up slightly for an audible one-shot, with a quick attack/decay envelope.
  gOsc.gain.setValueAtTime(0.0001, t0);
  gOsc.gain.linearRampToValueAtTime(0.05 + 0.02 * level, t0 + 0.08);
  gOsc.gain.setValueAtTime(0.05 + 0.02 * level, t0 + dur - 0.15);
  gOsc.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gOsc).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
  // Lowpass-filtered white-noise wind rush.
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
  filt.frequency.setValueAtTime(280 + level * 240, t0);
  const gN = ctx.createGain();
  gN.gain.setValueAtTime(0.0001, t0);
  gN.gain.linearRampToValueAtTime(0.05 * level, t0 + 0.08);
  gN.gain.setValueAtTime(0.05 * level, t0 + dur - 0.15);
  gN.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(gN).connect(ctx.destination);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

// Sound effects library. Add new ones here; call them as sfx.NAME().
const sfx = {
  type:    () => beep(1200, 0.010, 'square', 0.012),
  enter:   () => beep(660,  0.05,  'square', 0.04),
  select:  () => { beep(523, 0.04, 'square', 0.04);
                   setTimeout(() => beep(784, 0.06, 'square', 0.04), 45); },
  back:    () => { beep(784, 0.04, 'square', 0.04);
                   setTimeout(() => beep(523, 0.06, 'square', 0.04), 45); },
  error:   () => beep(110,  0.12,  'sawtooth', 0.05),
  confirm: () => { beep(523, 0.05, 'square', 0.045);
                   setTimeout(() => beep(659, 0.05, 'square', 0.045), 60);
                   setTimeout(() => beep(880, 0.10, 'square', 0.045), 120); },
  // Tiny "bell" used when the concessionist arrives at the register
  ding:    () => { beep(1318, 0.04, 'triangle', 0.04);
                   setTimeout(() => beep(1760, 0.20, 'triangle', 0.035), 50); },
  // Two short clicks — used when time advances. Mimics a clock-hand tick.
  tick:    () => { beep(2200, 0.012, 'square', 0.03);
                   setTimeout(() => beep(2200, 0.012, 'square', 0.03), 90); },
  // Positive chime when Rested goes UP (a small breath, two up notes).
  restUp:  () => { beep(523, 0.05, 'triangle', 0.04);
                   setTimeout(() => beep(784, 0.08, 'triangle', 0.04), 60); },
  // Lower drop when Rested goes DOWN.
  restDown:() => { beep(440, 0.05, 'sine', 0.05);
                   setTimeout(() => beep(330, 0.10, 'sine', 0.05), 60); },
  // ── #14: expanded SFX library (testable from the debug room's Sound NPC) ──
  lightswitch: () => { beep(2400, 0.008, 'square', 0.05);
                       setTimeout(() => beep(1400, 0.012, 'square', 0.04), 18); },
  confirmClick: () => { beep(1000, 0.012, 'square', 0.05);
                        setTimeout(() => beep(1500, 0.03, 'square', 0.04), 20); },
  spark: () => { noise(0.06, 5000, 'highpass', 0.07, 1);
                 setTimeout(() => noise(0.04, 3500, 'bandpass', 0.05, 4), 30);
                 setTimeout(() => beep(2000, 0.01, 'sawtooth', 0.04), 10); },
  screamWoman: () => { glide(700, 1200, 0.5, 'sawtooth', 0.05);
                       setTimeout(() => glide(1100, 600, 0.4, 'sawtooth', 0.045), 480);
                       noise(0.9, 1600, 'bandpass', 0.015, 2); },
  screamMan: () => { glide(300, 520, 0.55, 'sawtooth', 0.06);
                     setTimeout(() => glide(480, 240, 0.45, 'sawtooth', 0.05), 520);
                     noise(1.0, 700, 'bandpass', 0.02, 2); },
  doorOpen: () => { glide(180, 90, 0.5, 'sawtooth', 0.035);
                    noise(0.5, 400, 'lowpass', 0.03, 1); },
  doorClose: () => { glide(120, 70, 0.3, 'sawtooth', 0.04);
                     setTimeout(() => { noise(0.05, 300, 'lowpass', 0.06, 1); beep(80, 0.06, 'square', 0.05); }, 280); },
  slidingDoorOpen:  () => { noise(0.7, 1800, 'bandpass', 0.035, 6); glide(600, 1400, 0.7, 'sine', 0.02); },
  slidingDoorClose: () => { noise(0.7, 1800, 'bandpass', 0.035, 6); glide(1400, 600, 0.7, 'sine', 0.02);
                            setTimeout(() => beep(120, 0.04, 'square', 0.05), 700); },
  // Leaf-blower motor — a faithful recreation of the leafblower minigame's
  // RetroAudioEngine: a sawtooth buzz (42 + level*16 Hz) layered with
  // lowpass-filtered white noise (cutoff 280 + level*240 Hz). Played here as a
  // ~0.7s one-shot per power level so the debug booth tests the real sound.
  blower1: () => blowerBurst(1),
  blower2: () => blowerBurst(2),
  blower3: () => blowerBurst(3),
};
//═══════════════════════════════════════════════════════════════════════════
// MUSIC ENGINE
//═══════════════════════════════════════════════════════════════════════════
//
// Single-voice square-wave melody, Apple-IIe-flavored envelope. The original
// build had a TITLE_THEME that played on the title screen — that's been
// removed because title music is now owned by core/title.js (the canvas
// title-screen module). What remains here are the GAME-START JINGLES —
// short one-shot tunes that play once on entering Day 1, routed by scenario
// (summer vs winter) via Music.playStartJingle().
//
// To change a jingle: edit SUMMER_JINGLE or WINTER_JINGLE below. Each entry
// is [freqHz | null, durationSeconds]. null = rest.
// To add more jingles for future scenarios: add a const and case-branch in
// playStartJingle().
//
//───────────────────────────────────────────────────────────────────────────

// Note frequencies (equal temperament A4=440 Hz). Add more as needed.
const NOTE = {
  // Octave 3
  A3: 220.00, Bb3: 233.08, B3: 246.94,
  // Octave 4
  C4: 261.63, Db4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63,
  F4: 349.23, Gb4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00,
  Bb4: 466.16, B4: 493.88,
  // Octave 5
  C5: 523.25, Db5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25,
  F5: 698.46, Gb5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.00,
  Bb5: 932.33, B5: 987.77,
  // Octave 6
  C6: 1046.50, D6: 1174.66, E6: 1318.51, F6: 1396.91, G6: 1567.98,
};
// ─── GAME-START JINGLES ───────────────────────────────────────────────────
//
// Light, happy little tunes that play ONCE when a new game (or loaded game)
// starts. Different jingles for each scenario. Total length ~2–3 seconds.
//
// SUMMER_JINGLE: bright, sunny, ascending — "summer's here" feel.
// WINTER_JINGLE: warm, cozy, with a gentle bell-like ending — "tucked-in" feel.
//
// HOW TO TWEAK:
//   - Add/remove notes from the array below.
//   - Tempo: shorten/lengthen the second number (duration in seconds).
//   - To change which one plays, see Music.playStartJingle() — it routes by
//     State.world.scenario.

const SUMMER_JINGLE = [
  // Bright C-major arpeggio rising into a held C, then a quick wink.
  [NOTE.C5, 0.14], [NOTE.E5, 0.14], [NOTE.G5, 0.14], [NOTE.C6, 0.30],
  [NOTE.G5, 0.14], [NOTE.A5, 0.14], [NOTE.C6, 0.40],
  [null,    0.20],
];

const WINTER_JINGLE = [
  // Warm 6-note phrase: G - C - E - D - C - G (rising then settling).
  [NOTE.G4, 0.16], [NOTE.C5, 0.16], [NOTE.E5, 0.20],
  [NOTE.D5, 0.16], [NOTE.C5, 0.20], [NOTE.G5, 0.40],
  [null,    0.20],
];
const Music = {
  scheduledStops: [],     // OscillatorNodes scheduled to stop after current playthrough
  doneTimer: null,        // setTimeout id for "song just finished"
  replayTimer: null,      // setTimeout id for "play again in 3 min"
  isPlaying: false,

  // Title-screen music is handled by core/title.js (the canvas title module).
  // This stub is kept so any code that calls Music.startTitle() (e.g. when
  // returning to title from in-game ESC menu) doesn't error. It silently
  // no-ops here — if you want a tune that plays after the player returns
  // to title from in-game, replace this body with a _playOnce(SOME_THEME).
  startTitle() {
    this.stop();
    /* no-op — title.js owns title-screen audio */
  },

  // Schedule one full playthrough. Calls onDone when the last note finishes.
  _playOnce(song, onDone) {
    const ctx = ensureAudio();
    if (!ctx) return;
    this.isPlaying = true;
    let when = ctx.currentTime + 0.05;
    let total = 0.05;
    for (const [freq, dur] of song) {
      if (freq === null) { when += dur; total += dur; continue; }
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      // Envelope: sharp attack, steady body, quick release (Apple IIe-ish)
      const attack  = 0.004;
      const release = Math.min(0.04, dur * 0.2);
      const peak    = 0.045;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(peak, when + attack);
      gain.gain.setValueAtTime(peak, when + dur - release);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur - 0.001);
      osc.connect(gain).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + dur);
      this.scheduledStops.push(osc);
      when += dur;
      total += dur;
    }
    this.doneTimer = setTimeout(() => {
      this.scheduledStops = [];
      this.isPlaying = false;
      if (onDone) onDone();
    }, total * 1000);
  },

  // Stop everything: scheduled notes, the "song-done" timer, and replay timer.
  stop() {
    if (this.doneTimer)   { clearTimeout(this.doneTimer);   this.doneTimer = null; }
    if (this.replayTimer) { clearTimeout(this.replayTimer); this.replayTimer = null; }
    for (const o of this.scheduledStops) { try { o.stop(); } catch(e) {} }
    this.scheduledStops = [];
    this.isPlaying = false;
  },

  // PAUSE / RESUME used by the ESC menu, character sheet, and any overlay
  // that shouldn't permanently kill audio. The in-game looping track is the
  // opening crawl music (window.CrawlMusic); we remember whether it was playing
  // and restart it on resume. (CrawlMusic has no sample-accurate pause, so this
  // restarts the loop — acceptable for a pause/resume of a looping bed.)
  pause() {
    this._wasCrawl = !!(window.CrawlMusic && window.CrawlMusic.playing);
    try { if (window.CrawlMusic) window.CrawlMusic.stop(); } catch (e) {}
    this.stop();
  },
  resume() {
    if (this._wasCrawl) { try { if (window.CrawlMusic && State.settings.music) window.CrawlMusic.start(); } catch (e) {} }
    this._wasCrawl = false;
  },

  // Play a one-shot start-of-game jingle. Routes by scenario. Call once at
  // the moment the player enters Day 1 from REVIEW.
  //
  // Doesn't loop; doesn't re-trigger after the song ends. Respects the music
  // setting — silently no-ops if music is off.
  playStartJingle() {
    this.stop();
    if (!State.settings.music) return;
    const scen = State.world && State.world.scenario;
    const song = scen === 'winter' ? WINTER_JINGLE : SUMMER_JINGLE;
    this._playOnce(song, () => { /* one-shot, no replay */ });
  },
};

//═══════════════════════════════════════════════════════════════════════════
// GAME STATE
//═══════════════════════════════════════════════════════════════════════════
//
// State is the runtime "everything" object. It's intentionally global so any
// function can read or write it without plumbing through arguments.
//
// PERSISTED (to localStorage):
//   • settings   → key "mam.settings"
//   • saves      → manifest at "mam.saves.manifest" + blobs at
//                  "mam.save.<id>" (multi-slot, see SAVE SYSTEM below)
//
// EPHEMERAL (resets on reload):
//   • screen, history, animFrame, world clock, transient buffers
//
//───────────────────────────────────────────────────────────────────────────

// True when running inside an <iframe> (cross-origin safe: comparing window
// references never throws). Used to keep embeds windowed — see windowMode.
const IS_EMBEDDED = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
// Build flags. The web-demo page (demo/index.html, generated by
// tools/build_demo.js) sets window.MM_BUILD = { demo: true } BEFORE any game
// script loads; the full game never sets it. Demo-only behavior lives in
// core/demo.js; the few core checks that need it call IS_DEMO_BUILD().
function IS_DEMO_BUILD() { return !!(window.MM_BUILD && window.MM_BUILD.demo); }

const State = {
  // Current screen name (key into Screens). On startup nothing is shown
  // (terminal is hidden); MultiplexGame.show(name) sets the screen explicitly.
  screen: '',
  // Stack of previous screens, for `back` to walk in reverse.
  history: [],
  // Animation tick counter — used to drive blinking, popcorn, ICEE swirl,
  // and the concessionist state machine. Increments every 150 ms while title is open.
  animFrame: 0,

  // The current character. blankCharacter() makes a fresh empty one.
  character: blankCharacter(),

  // The world clock and date. Only advances when the game calls advanceTime().
  world: {
    dayNumber: 1,    // Day 1 = the Sunday that starts tutorial week of the chosen scenario.
    hour: 8,         // 24-hour. 0..23. Starts at 8 AM.
    minute: 0,       // 0..59. Always a multiple of 5 (we advance in 5-min steps).
    money: 12.50,    // dollars on hand. A bit of pocket cash to start; spend it at the concession SHOP (#7), refilled by paydays/events.
    rested: 100,     // 0..100. Drops as the day goes on / staying up. Affects checks.
    scenario: 'summer',  // 'summer' | 'winter'. Set during character creation.
    inTutorial: true,    // true while dayNumber < SCENARIOS[scenario].mainStartDay
  },

  // Player-tweakable settings. Loaded from localStorage on boot.
  settings: {
    // NOTE: 'color' was removed. The game ships a single color scheme; the
    // body class .color-16 stays on the body and is treated as the only mode.
    display: 'widescreen',// 'standard' | 'widescreen'
    audioMode: 'all',     // 'all' | 'music-off' | 'sounds-off' | 'mute'  (cycled by F6)
    crt: true,
    statsHidden: false,   // toggled by F8 (only relevant in-game)

    // Toggled by F7. When true the minimap panel (top-right, above your stats)
    // collapses and the stats expand to fill the freed space. Stored so the
    // player's preference survives reloads. See renderGameplayUI() for the
    // layout math.
    minimapHidden: false,

    // ── DISPLAY SCALE ─────────────────────────────────────────────────────
    // Integer scale factor for the title canvas and a derived font-size for
    // the terminal. 'auto' picks the largest integer that fits the current
    // window (recomputed on resize). Range 2..6 in auto mode; manual override
    // allows 1..6. See applyDisplayScale() for the math and CSS variables.
    displayScale: 'auto', // 'auto' | '1' | '2' | ... | '8' (used in 'manual' mode)

    // ── DISPLAY MODE (resolution / UI fill) ───────────────────────────────
    // Handled by core/display.js (DisplayManager). Controls how the UI fills
    // the screen:
    //   'fill'       = (DEFAULT) grow the UI to fill the viewport (fractional)
    //   'fit'        = largest integer scale that fits (crisp, letterboxed)
    //   'manual'     = honor displayScale (1..8)
    //   'resolution' = present at a specific resolution (displayResolution)
    displayMode: 'fill',
    // Target resolution when displayMode === 'resolution'. See
    // DisplayManager.DISPLAY_RESOLUTIONS. 'native' = current window size.
    displayResolution: 'native',

    // ── WINDOW MODE ───────────────────────────────────────────────────────
    // 'windowed' = run inside the regular browser window (default).
    // 'fullscreen' = on first user gesture, request the browser Fullscreen
    // API so the OS chrome and tab strip vanish. Toggleable from Settings;
    // changing the setting takes effect immediately when the user is
    // already on a page with a user gesture available (i.e. via the
    // settings keypress).
    // When the page is EMBEDDED in someone else's page (an <iframe>, e.g. the
    // web demo on a Neocities site) we default to windowed: auto-fullscreen
    // from inside an iframe is blocked unless the host opts in, and grabbing
    // the whole screen from an embed is rude anyway. F11 still toggles it.
    windowMode: IS_EMBEDDED ? 'windowed' : 'fullscreen', // 'windowed' | 'fullscreen' — auto-fullscreen on start by default (top-level only)
    fpsControlScheme: 'crawler', // 'crawler' (default) | 'retro'
    militaryTime: false,         // 24-hour clock in the UI (off by default)
    showDiagnostics: false,      // diagnostic overlay (FPS/resources); F3 also toggles
    // ── DIALOGUE TYPE-OUT [#3] ─────────────────────────────────────────────
    // textSpeed controls the Earthbound-style typewriter in conversations:
    //   'slow' | 'medium' | 'medfast' (default) | 'fast' | 'instant'
    // 'instant' shows the whole line at once. dialogueSound toggles the per-NPC
    // typing "voice" blips. (Pressing Space mid-type always reveals the rest.)
    textSpeed: 'medfast',
    dialogueSound: true,
    // #3: include the BASIC verbs in the bottom command ticker (scene-specific
    // actions always show). Toggle in Settings.
    tickerBasics: true,
    // #12: display units for travel speeds ('mph' | 'kmh'). Toggle in Settings.
    speedUnits: 'mph',
  },

  // Runtime flags computed from settings.audioMode.
  // (kept here instead of computed inline so ensureAudio/beep can short-circuit)
  get _settings_music_sounds_proxy() {
    // Helper: every read of `settings.music`/`settings.sounds` derives from audioMode.
    // We expose them via getters on settings below.
    return null;
  },

  // Free-form per-screen scratch (e.g. helpReturn, partial creation choices).
  buffers: {},

  // Running log of recent in-game events with timestamps. Populated by
  // logEvent(). Used by the right-side EVENT LOG panel in the gameplay UI.
  // Trimmed to the last ~50 entries to keep memory bounded.
  eventLog: [],
};

// We expose `settings.music` and `settings.sounds` as derived getters so the
// audio engine doesn't have to know about the 4-way audioMode toggle.
Object.defineProperty(State.settings, 'music', {
  get() { return this.audioMode === 'all' || this.audioMode === 'sounds-off'; },
});
Object.defineProperty(State.settings, 'sounds', {
  get() { return this.audioMode === 'all' || this.audioMode === 'music-off'; },
});

// Empty character template. Add new fields here and they'll be saved/loaded for free.
function blankCharacter() {
  return {
    name: '',
    age: null,
    gender: '',
    customGender: '',
    orientation: '',
    townName: '',          // player-chosen name for the town/city
    location: '',          // where you live (key into LOCATIONS)
    hobbies: [],           // array of hobby keys, 1–3
    stats: { brawn:5, reflexes:5, grit:5, intelligence:5, savvy:5, charm:5, luck:5 },
    points: 12,            // remaining stat points to spend
    skills: [],            // array of {key, paidFromStat, cost} — paidFromStat null in pool model
    skillCostNext: 1,      // next skill to be picked costs this many stat points
    clique: '',            // primary clique key, or '' for none
    secondClique: '',      // optional second clique (must be compatible) — gameplay-unlocked usually
    scenarioChoice: '',    // 'summer' | 'winter' — picked at SCENARIO screen
    skipTutorial:   false, // skip the tutorial week and start at the scenario proper
    introSeen:      false, // has the player watched the opening crawl?
    tenure:         '',    // tenure at The Grande (key in TENURE_OPTIONS)
  };
}
//═══════════════════════════════════════════════════════════════════════════
// WORLD / TIME / DATE
//═══════════════════════════════════════════════════════════════════════════
//
// The in-game calendar starts on Sunday, June 6, 1999. Day 1.
// Time advances ONLY when the game calls advanceTime(minutes). It does NOT
// progress in real-time on its own. We expand this when actual gameplay arrives.
//
//───────────────────────────────────────────────────────────────────────────
const DAYS_OF_WEEK = [
  'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday',
];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
//═══════════════════════════════════════════════════════════════════════════
// WORLD CLOCK
//═══════════════════════════════════════════════════════════════════════════
// (The SCENARIOS table — calendar anchors like tutorialStart / mainStartDay —
// lives in core/chargen.js; formatDate()/currentDate() below read it.)

function advanceTime(minutes, opts = {}) {
  const prevDay = State.world.dayNumber;
  State.world.minute += minutes;
  while (State.world.minute >= 60) {
    State.world.minute -= 60;
    State.world.hour   += 1;
  }
  while (State.world.hour >= 24) {
    State.world.hour      -= 24;
    State.world.dayNumber += 1;
  }
  if (!opts.silent) sfx.tick();
  // #F/#G: advance the vitals systems — restedness decays with time, stamina
  // regenerates (scaled by restedness), and exhaustion chips HP at 0 stamina.
  // All baselines live in core/progression.js.
  if (window.Progression && typeof window.Progression.tick === 'function') {
    try { window.Progression.tick(minutes); } catch (e) {}
  }
  // Flash the top-bar time briefly. Implementation: set a transient flag the
  // gameplay UI can check during render. Limited to a few render cycles.
  State.world._timeFlashUntil = (State.animFrame || 0) + 6;
  // Day rollover? Try autosave (handled by maybeAutosave; safe to call always).
  if (State.world.dayNumber !== prevDay) {
    // maybeAutosave is defined later in the file; in a real script load
    // order it'll be available by the time this fires.
    try { maybeAutosave(); } catch (e) {}
  }
}

// Change the rested value, capped 0..100, with appropriate audio + visual
// flash hooks. Use this everywhere instead of mutating State.world.rested
// directly so the player always gets feedback.
function adjustRested(delta) {
  if (!delta) return;
  const oldVal = State.world.rested;
  const newVal = Math.min(100, Math.max(0, oldVal + delta));
  State.world.rested = newVal;
  if (newVal > oldVal)      sfx.restUp();
  else if (newVal < oldVal) sfx.restDown();
  State.world._restFlashUntil = (State.animFrame || 0) + 6;
}

// #1: stamina (SP) — exertion (exercise, later: sprinting/labor) spends it.
// Mirrors adjustRested; reads/writes State.world.stamina against staminaMax
// (default 100) and clamps. The SP bar in the stats panel reads this value.
function adjustStamina(delta) {
  if (!delta) return;
  State.world = State.world || {};
  const max = (+State.world.staminaMax) || 100;
  const oldVal = (typeof State.world.stamina === 'number') ? State.world.stamina : max;
  const newVal = Math.min(max, Math.max(0, oldVal + delta));
  State.world.stamina = newVal;
}

// Log an event with the current in-game timestamp. Newest entries last;
// the EVENT LOG panel (in the new gameplay UI) shows the most recent.
// The full history is available via the LOG command (Screens.EVENT_LOG).
// Capped at 200 entries to keep memory bounded.
function logEvent(text) {
  if (!State.eventLog) State.eventLog = [];
  const stamp = formatTime();   // "9:15 AM"
  State.eventLog.push({ time: stamp, text });
  if (State.eventLog.length > 200) State.eventLog.shift();
}

// ─── ROUTINE-ROUND TRACKING ───────────────────────────────────────────────
// A "routine round" is a chunk of time at one location with the same set of
// available actions (e.g. morning at home). Actions taken during a round are
// tracked so we can:
//   - GREY OUT actions that have already been used (no-benefit repeats)
//   - Show "Are you sure?" before letting a player repeat a no-benefit action
//
// Each gameplay screen calls `startRoutineRound(roundKey)` at the top of its
// render(). When the round key changes (player leaves the screen / location /
// time-of-day flips), the tracker resets.
//
// `markActionTaken(key)` records that an action was just performed.
// `wasActionTaken(key)` checks if it was already used this round.
// `requireConfirmOnRepeat(key, runAction)` is the high-level "do X with
// confirm" helper for location screens (e.g. a "shower" you already took
// this round asks before repeating). See core/locations/_README.js.

function startRoutineRound(roundKey) {
  if (State.buffers.routineRoundKey !== roundKey) {
    State.buffers.routineRoundKey = roundKey;
    State.buffers.actionsThisRound = [];
    State.buffers.confirmingAction = null;
  }
}
function markActionTaken(key) {
  if (!State.buffers.actionsThisRound) State.buffers.actionsThisRound = [];
  State.buffers.actionsThisRound.push(key);
}
function wasActionTaken(key) {
  return (State.buffers.actionsThisRound || []).includes(key);
}
function requireConfirmOnRepeat(key, runAction) {
  // If we're currently awaiting confirmation for this exact key, the player
  // is "saying yes" — clear the flag and run the action.
  if (State.buffers.confirmingAction === key) {
    State.buffers.confirmingAction = null;
    runAction();
    markActionTaken(key);
    return;
  }
  // If it's already been done this round, ask first.
  if (wasActionTaken(key)) {
    State.buffers.confirmingAction = key;
    sfx.error();
    flash('You already did that this round — no further benefit. ' +
          'Type "yes" or repeat the command to do it anyway.');
    return;
  }
  // Fresh action — just do it.
  runAction();
  markActionTaken(key);
}

// Helper used by gameplay UIs to render an action menu with greyed-out items.
// Each entry is { cmd, label, used }. Used items render with the .greyed-out
// span class (defined in CSS) and a strikethrough hint.
function actionLine(cmd, label, used) {
  const c = used ? span('greyed-out', cmd) : span('accent', cmd);
  const desc = used ? span('greyed-out', label + '  (used)') : label;
  return '  ' + c + '   ' + desc;
}

// "11:47 PM"
function formatTime() {
  const h24 = State.world.hour;
  const h12 = (h24 % 12) || 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(State.world.minute).padStart(2,'0')} ${ampm}`;
}

// "Tuesday, September 7th"
function formatDate() {
  // Day 1 = the start of the tutorial week for the chosen scenario.
  // SCENARIOS[State.world.scenario].tutorialStart is a JS Date for Day 1.
  const scen = SCENARIOS[State.world.scenario] || SCENARIOS.summer;
  const start = scen.tutorialStart;
  const d = new Date(start);
  d.setDate(d.getDate() + State.world.dayNumber - 1);
  const dayName  = DAYS_OF_WEEK[d.getDay()];
  const monthName= MONTH_NAMES[d.getMonth()];
  const dayNum   = d.getDate();
  return `${dayName}, ${monthName} ${dayNum}${ordinal(dayNum)}`;
}

// JS Date for the current in-game day.
function currentDate() {
  const scen = SCENARIOS[State.world.scenario] || SCENARIOS.summer;
  const d = new Date(scen.tutorialStart);
  d.setDate(d.getDate() + State.world.dayNumber - 1);
  return d;
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// "(Day 47)"
function formatDayNumber() { return `Day ${State.world.dayNumber}`; }

//═══════════════════════════════════════════════════════════════════════════
// HELPERS
//═══════════════════════════════════════════════════════════════════════════

function escHTML(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function span(cls, text) {
  return '<span class="' + cls + '">' + escHTML(text) + '</span>';
}
function pad(s, n)  { return (s + ' '.repeat(Math.max(0, n - s.length))); }
// wrap a string to `width` columns WITHOUT splitting words across rows.
// A word longer than the width is hard-split as a last resort.
function wrapWords(text, width) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let word of words) {
    // Hard-split an over-long single word.
    while (word.length > width) {
      if (line) { lines.push(line); line = ''; }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (line === '') line = word;
    else if ((line.length + 1 + word.length) <= width) line += ' ' + word;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
function rule(n=72, ch='-') { return ch.repeat(n); }
function center(s, width=86) {
  const left = Math.floor((width - s.length) / 2);
  return ' '.repeat(Math.max(0, left)) + s;
}

// ─── RANDOM ───────────────────────────────────────────────────────────────
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function randPick(arr)     { return arr[Math.floor(Math.random() * arr.length)]; }
function randPickN(arr, n) {
  const copy = arr.slice();
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy[idx]); copy.splice(idx, 1);
  }
  return out;
}
// (The title-screen rendering block originally lived here — it described how
// renderTitleScreen() assembled the marquee, bulbs, popcorn cab, ICEE cab,
// menu board, concessionist, and register. All of that is now owned by
// core/title.js, the canvas-based title module. Removed from this file.)

//═══════════════════════════════════════════════════════════════════════════
// IN-GAME FRAME + STATS PARTITION
//═══════════════════════════════════════════════════════════════════════════
//
// Once the player finishes character creation we show a framed "in-game"
// view. The frame is an ASCII border around the active content. To the right
// of the frame, a stats partition shows clock/date, name/age, stats, and
// status. Pressing F8 hides the partition (the frame widens accordingly).
//
//───────────────────────────────────────────────────────────────────────────

const FRAME_TOTAL_W = 108;     // total width incl. partition (was 92)
const PARTITION_W   = 28;      // width of stats panel
const FRAME_INNER_NARROW = FRAME_TOTAL_W - PARTITION_W - 2;   // = 78 when partition shown
const FRAME_INNER_WIDE   = FRAME_TOTAL_W - 2;                 // = 106 when partition hidden

// Build the stats partition as an array of strings (each ≤ PARTITION_W wide).
// Pure inline — uses the world clock, character data, etc.
function renderStatsPartition() {
  const c = State.character;
  const w = PARTITION_W - 2;     // chars between '|' walls
  const F = (s) => span('frame', s);
  const N = (s) => span('stat-name', s);
  const V = (s) => span('stat-value', s);
  const O = (s) => span('ok',   s);
  const W = (s) => span('warn', s);

  const sep   = F('+' + '-'.repeat(w) + '+');
  const center_ = (s) => {
    const padN = Math.floor((w - s.length) / 2);
    return F('|') + ' '.repeat(padN) + s + ' '.repeat(w - padN - s.length) + F('|');
  };

  const lines = [];
  lines.push(sep);
  lines.push(center_(formatTime()));
  lines.push(center_(formatDate().slice(0, w)));        // truncate if too long
  lines.push(center_('(' + formatDayNumber() + ')'));
  lines.push(sep);

  if (c.name) {
    lines.push(center_(c.name + ', ' + c.age));
    lines.push(center_((typeof bracketLabel === 'function' ? bracketLabel(c.age) : ageBracket(c.age)) || ''));
    lines.push(sep);
    for (const k of STAT_KEYS) {
      const info = STAT_INFO[k];
      const v = statTotal(k);
      // Pad the label to the longest stat name (Intelligence = 12) so it always
      // has at least one space before the value and never butts the wall. #11
      const nameW = 12;
      const valStr = String(v).padStart(3);
      // layout: '| ' + name(nameW) + ' ' + value(3) + fill + '|'
      const fill = Math.max(0, w - (1 + nameW + 1 + 3));
      lines.push(F('|') + ' ' + N(pad(info.label, nameW)) + ' ' + V(valStr) + ' '.repeat(fill) + F('|'));
    }
    lines.push(sep);
    const restedTxt = State.world.rested >= 60 ? 'RESTED' : 'TIRED';
    const restedC   = State.world.rested >= 60 ? O(restedTxt) : W(restedTxt);
    const moneyTxt  = '$' + State.world.money.toFixed(2);
    const innerSpc  = Math.max(1, w - restedTxt.length - moneyTxt.length - 2); // 1 leading + 1 trailing
    lines.push(F('|') + ' ' + restedC + ' '.repeat(innerSpc) + V(moneyTxt) + ' ' + F('|'));
    lines.push(sep);
  } else {
    lines.push(center_('(no character)'));
    lines.push(sep);
  }
  return lines;
}

// Wrap a block of game-content lines in an ASCII frame. Optionally appends
// the stats partition to the right of each row (or hides it).
//
// AUTO-WRAP: any content line whose visible (tag-stripped) length exceeds
// `innerW` is split into multiple framed rows so the right border stays put.
// Splits happen at word boundaries when possible. Span tags are preserved.
//
// HOW IT WORKS:
//   - We tokenize the line into runs of "tag" (e.g. <span class="accent">)
//     and "text" (visible characters).
//   - We accumulate runs into the current line until adding the next run
//     would push the visible-length past innerW. At that point we close out
//     the current line and start a fresh one.
//   - On a text run, if the chunk itself is longer than innerW we break it
//     at the nearest space.
//
// To inspect: stripTags(s) gives the visible text only.
function stripTags(s) {
  // Strip span tags, then DECODE HTML entities so the result's .length equals the
  // true VISIBLE column count. Without this, an escaped char like '>' (rendered as
  // '&gt;') counted as 4 columns instead of 1, so any row containing one (e.g. the
  // wake-up command echo "> get up") got padded 3 short and jagged the right frame.
  return String(s).replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

// Slice a (possibly tagged) row string by VISIBLE character index. Returns a
// self-contained renderable string covering visible chars [start..end). Open
// span tags inside that range are closed at the end of the slice; the slice
// will NOT inherit tags that were open before `start`.
//
// Used by:
//   - the title-screen fountain compositing
//   - the gameplay UI top-bar (truncates over-long location strings while
//     preserving accent color spans)
function sliceRowVisible(base, start, end) {
  let out = '';
  let visIdx = 0;
  let openTags = [];
  let i = 0;
  while (i < base.length) {
    if (base[i] === '<') {
      const tagEnd = base.indexOf('>', i);
      if (tagEnd < 0) break;
      const tag = base.slice(i, tagEnd + 1);
      if (visIdx >= start && visIdx < end) out += tag;
      if (/^<\//.test(tag)) openTags.pop();
      else                  openTags.push(tag);
      i = tagEnd + 1;
    } else if (base[i] === '&') {
      // an HTML entity (&gt; &amp; &#39; …) is ONE visible column, not its length.
      const semi = base.indexOf(';', i);
      if (semi >= 0 && semi - i <= 8) {
        if (visIdx >= start && visIdx < end) out += base.slice(i, semi + 1);
        visIdx++; i = semi + 1;
      } else {
        if (visIdx >= start && visIdx < end) out += base[i];
        visIdx++; i++;
      }
    } else {
      if (visIdx >= start && visIdx < end) out += base[i];
      visIdx++;
      i++;
    }
  }
  for (let j = 0; j < openTags.length; j++) out += '</span>';
  return out;
}

function wrapToFrameWidth(line, innerW) {
  // If nothing exceeds innerW, fast path.
  if (stripTags(line).length <= innerW) return [line];

  // Tokenize into [tag-run | text-run] segments preserving order.
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '<') {
      const end = line.indexOf('>', i);
      if (end < 0) { tokens.push({type:'text', text: line.slice(i)}); break; }
      tokens.push({type:'tag', text: line.slice(i, end+1)});
      i = end + 1;
    } else {
      const end = line.indexOf('<', i);
      const stop = end < 0 ? line.length : end;
      tokens.push({type:'text', text: line.slice(i, stop)});
      i = stop;
    }
  }

  // We re-emit by walking the tokens and tracking visible length.
  // For text tokens that would overflow, split on whitespace.
  const out = [];
  // openTags is the stack of currently-open span tags so we can re-open them
  // on continuation lines for visual continuity.
  let openTags = [];
  let buf = '';
  let visLen = 0;

  const flush = () => {
    // Close all currently open tags before flushing.
    let line = buf;
    for (let i = 0; i < openTags.length; i++) line += '</span>';
    out.push(line);
    // Restart buf with all currently-open tags re-opened.
    buf = openTags.join('');
    visLen = 0;
  };

  for (const tok of tokens) {
    if (tok.type === 'tag') {
      buf += tok.text;
      // Track open/close state.
      if (/^<\//.test(tok.text)) {
        openTags.pop();
      } else {
        openTags.push(tok.text);
      }
      continue;
    }
    // Text token. Split into words, preserving spaces.
    let text = tok.text;
    while (text.length) {
      // Find next space (or end).
      const spaceIdx = text.indexOf(' ');
      const word = spaceIdx < 0 ? text : text.slice(0, spaceIdx + 1);
      // If this word + visLen overflows, flush first (unless visLen is 0
      // and word itself is longer than innerW, in which case hard-break).
      if (visLen > 0 && visLen + word.length > innerW) {
        flush();
        // Trim any leading space of the new line.
        if (word.startsWith(' ')) {
          buf += word.slice(1);
          visLen += word.length - 1;
        } else {
          buf += word;
          visLen += word.length;
        }
      } else if (word.length > innerW) {
        // Single super-long word; hard-break it.
        const slice = word.slice(0, innerW - visLen);
        buf += slice;
        visLen += slice.length;
        flush();
        text = word.slice(slice.length) + text.slice(word.length);
        continue;
      } else {
        buf += word;
        visLen += word.length;
      }
      text = text.slice(word.length);
    }
  }
  if (buf.length) {
    let line = buf;
    for (let i = 0; i < openTags.length; i++) line += '</span>';
    out.push(line);
  }
  return out;
}

//═══════════════════════════════════════════════════════════════════════════
// NEW IN-GAME UI  —  the mockup layout
//═══════════════════════════════════════════════════════════════════════════
//
// Wide-monitor friendly. Single all-ASCII rectangle subdivided into:
//
//   ┌─────────────────────────────────────────────────────────────────────┐
//   │            DATE          LOCATION (coords)         TIME    WEATHER  │   top bar
//   ├──────────┬─────────────────────────────────────────────┬────────────┤
//   │  NPC     │                                             │  YOUR      │   row 1 of body
//   │  STATS   │   GAME SCREEN  (the prose + ASCII art)      │  STATS     │
//   │          │                                             │            │
//   │          │   (dialogue / choices overlay here)         │            │
//   │          │                                             │            │
//   │          ├─────────────────────────────────────────────┤            │
//   │          │   DIALOGUE / EVENT POPUP (overlays game)    │            │
//   ├──────────┤                                             ├────────────┤
//   │  NPC     │                                             │  EVENT     │
//   │  RELATIO │                                             │  LOG       │
//   │          │                                             │            │
//   └──────────┴─────────────────────────────────────────────┴────────────┘
//
// HOW TO USE:
//   call renderGameplayUI({
//     gameText:        [...],          // main center column lines
//     dialoguePopup:   [...] | null,   // overlay lines for NPC speech
//     choicesPopup:    [...] | null,   // overlay lines for action menu
//     npc:             {name, stats, relationship} | null,
//     overrideLocation: 'Theatre Lobby (H3)' | null,
//   })
//
// All overlays auto-position. Sections you don't supply just stay empty.
// The game screen + side panels share a fixed height; long center text wraps
// inside that area. To grow the game screen vertically, bump UI_HEIGHT.


// Width model:
//   UI_TOTAL_W  = total visible width INCLUDING the outer left and right walls.
//   Body rows are: │ + LEFT + │ + MID + │ + RIGHT + │
//   So: UI_TOTAL_W = 4 (walls) + UI_LEFT_W + UI_MID_W + UI_RIGHT_W
//   The top-bar row has only the outer two walls, no internal dividers:
//   that row's inner content width = UI_TOTAL_W - 2.

const UI_TOTAL_W   = 136;   // #1: wider grid so the center GAME WINDOW (UI_MID_W) grows (76 -> 90) — more map visible; text auto-fits at the same density
const UI_LEFT_W    = 18;     // INNER content width of left column (between dividers)
const UI_RIGHT_W   = 24;     // wider LOG column (border pushed further out) so entries read with less wrapping
const UI_MID_W     = UI_TOTAL_W - UI_LEFT_W - UI_RIGHT_W - 4;   // 76; the 4 = the four wall chars
const UI_BODY_H    = 33;     // #1: +3 so the taller top half fits AND LEFT_BOT_H stays 12 (33-20-1). Old note: top section can
                             // hold BOTH the minimap and the full stats without
                             // squishing; the bottom (log/relationships) keeps its
                             // height because LEFT_BOT_H = UI_BODY_H - UI_TOP_HALF - 1
                             // is unchanged (30-17-1 = 12, same as 28-15-1).
const UI_TOP_HALF  = 20;     // #1: +3 taller GAME WINDOW (more map). stats get 20-6=14 rows (need 11). Old note: right-top column
                             // stacks the 6-row minimap ABOVE your stats; your stats
                             // need 11 rows (name + divider + 7 stats + divider +
                             // Rested). 6 + 11 = 17, so at 17 the minimap no longer
                             // clips the bottom stat rows (the reported squish). With
                             // the minimap hidden, stats get all 17 rows = roomy.

// Minimap panel height (rows), claimed FROM the top of the right-top section.
// When the minimap is visible, the right-top column stacks as:
//     [ UI_MAP_H rows of minimap ] + [ remaining rows of YOUR stats ]
// When the minimap is hidden (F7), this is effectively 0 and stats fill the
// whole UI_TOP_HALF.  Value 6 = 2 rows of header + 4 rows of grid content.
const UI_MAP_H     = 6;

// BOT_PANEL_DROP is now 0 — the old 2-row drop made the side
// panels' divider sit 2 rows BELOW the center's divider, and the two horizontal
// lines met the shared vertical border in a Z-shaped jog that read as a broken/
// misaligned frame just above LOG (and mirrored at REL.). The divider is now ONE
// continuous line straight across (see the compose loop), with the side content
// starting right under it. The original note, kept for history:
// #7 (FIX): push the bottom-half SIDE panels (REL. left, LOG right) DOWN a couple
// rows so they're not flush with the top of the center description text. The
// center column still starts at the top of the bottom half; only the side panels
// drop. (Set to 0 to restore flush alignment.)
const BOT_PANEL_DROP = 0;

// #7/#9: position an absolutely-placed HTML element over a rectangular region of
// the terminal grid (the <pre id="display">). colStart/rowStart are 0-based cell
// coordinates from the grid's top-left content origin; wChars/hRows the size in
// cells. Used to float the LOG and minimap panels OUT of the ASCII grid so they
// can use a smaller font (log) or render real graphics (minimap) without the
// monospace constraints. Returns the measured cell metrics for the caller.
function gridCellMetrics() {
  const pre = (typeof display !== 'undefined') ? display : document.getElementById('display');
  if (!pre) return null;
  const cs = getComputedStyle(pre);
  const fontSize = parseFloat(cs.fontSize) || 16;
  const lineH = parseFloat(cs.lineHeight) || (fontSize * 1.2);
  const meas = document.createElement('span');
  meas.style.cssText = 'visibility:hidden;position:absolute;white-space:pre;font-family:' + cs.fontFamily + ';font-size:' + cs.fontSize;
  meas.textContent = '0'.repeat(100);
  document.body.appendChild(meas);
  const charW = meas.getBoundingClientRect().width / 100;
  document.body.removeChild(meas);
  const rect = pre.getBoundingClientRect();
  return { rect, charW, lineH, padLeft: parseFloat(cs.paddingLeft) || 0, padTop: parseFloat(cs.paddingTop) || 0 };
}
function positionGridOverlay(el, colStart, rowStart, wChars, hRows) {
  const m = gridCellMetrics();
  if (!m || !el) return false;
  el.style.position = 'fixed';
  // Round the EDGES (not the size) to the same pixels the monospace grid uses, so
  // the overlay's right/bottom edges land exactly on the surrounding cell walls.
  // Computing width independently (round(left)+floor(w·charW)) let the right edge
  // drift a pixel off the frame — the long-standing seam beside the LOG/minimap.
  const x0 = Math.round(m.rect.left + m.padLeft + colStart * m.charW);
  const x1 = Math.round(m.rect.left + m.padLeft + (colStart + wChars) * m.charW);
  const y0 = Math.round(m.rect.top + m.padTop + rowStart * m.lineH);
  const y1 = Math.round(m.rect.top + m.padTop + (rowStart + hRows) * m.lineH);
  el.style.left   = x0 + 'px';
  el.style.top    = y0 + 'px';
  el.style.width  = (x1 - x0) + 'px';
  el.style.height = (y1 - y0) + 'px';
  return true;
}
// Column/row origins of the four content panels in the frame (0-based cells):
//   left wall(1) + LEFT(UI_LEFT_W) + divider(1) + MID(UI_MID_W) + divider(1) + RIGHT
//   rows: top frame(1) + top bar(1) + divider(1) = 3 before the body; the body's
//   bottom half starts after UI_TOP_HALF rows + 1 inter-divider.
const RIGHT_COL_START = 1 + UI_LEFT_W + 1 + UI_MID_W + 1;     // first cell of the RIGHT column
const BODY_ROW_START  = 3;                                    // first body row
const BOT_ROW_START   = BODY_ROW_START + UI_TOP_HALF + 1;     // first row of the bottom half

function renderGameplayUI(opts = {}) {
  const gameText      = opts.gameText      || [];
  const dialogue      = opts.dialoguePopup || null;   // array of lines or null
  const choices       = opts.choicesPopup  || null;
  const npc           = opts.npc           || null;
  const overrideLoc   = opts.overrideLocation || null;
  // map mode — the MID-UPPER region is left blank so the live 3D map
  // canvas can be positioned over it; gameText becomes the DESCRIPTION shown in
  // the MID-LOWER region, and a UI-matching divider separates the two.
  const mapMode       = !!opts.mapMode;

  const F  = (s) => span('frame', s);
  const A  = (s) => span('accent', s);
  const SN = (s) => span('stat-name', s);
  const SV = (s) => span('stat-value', s);

  // ── pad helpers ──────────────────────────────────────────────────────
  // Pad a (possibly-tagged) line to exactly `n` visible chars. Truncates
  // visibly-too-long strings using the existing sliceRowVisible helper so
  // span tags are preserved when truncating.
  const padTo = (s, n) => {
    const vis = stripTags(s);
    if (vis.length === n) return s;
    if (vis.length > n) {
      return (typeof sliceRowVisible === 'function')
        ? sliceRowVisible(s, 0, n)
        : s.slice(0, n);   // fallback (rare)
    }
    return s + ' '.repeat(n - vis.length);
  };

  // ── top bar ──────────────────────────────────────────────────────
  // Three aligned zones across the full inner width (118 chars):
  //   LEFT  = date + time (left-aligned)
  //   CENTER= location + coordinates (centered)
  //   RIGHT = weather + indoor/outdoor indicator (right-aligned)
  const TB_INNER = UI_TOTAL_W - 2;   // 118

  const w  = State.world || {};
  const dateStr = (w.scenario && w.dayNumber) ? formatDate() : 'Sat, Jun 12, 1999';
  const timeStr = (w.hour != null) ? formatTimeCompact(w.hour, w.minute || 0) : '8:00 AM';
  const timeFlashing = w._timeFlashUntil && (State.animFrame || 0) < w._timeFlashUntil;

  // Location + coordinates. subLocation is narrative; location is the grid
  // cell key (e.g. 'H3'), shown as the coordinates after the name.
  const subLoc = w.subLocation || (overrideLoc || 'Theatre Lobby');
  const coords = w.location ? ('  [' + w.location + ']') : '';
  const locStr = overrideLoc ? overrideLoc : (subLoc + coords);

  // Weather + indoor/outdoor. On a live map screen we ask the engine whether the
  // player's CURRENT tile is outdoors (no ceiling); otherwise fall back to the
  // world flag.
  const weatherStr = (w.weather && w.weather.short) ? w.weather.short : 'Hazy 74°F';
  let indoors;
  if (mapMode && typeof window.enginePlayerOutdoors === 'function') {
    indoors = !window.enginePlayerOutdoors();
  } else {
    indoors = (w.indoors != null) ? w.indoors : !(w.outdoor);
  }
  const inOutStr = indoors ? '[Indoors] ' : '[Outdoors]';
  const rightStr = weatherStr + '  ' + inOutStr;

  // Build the three zones, then place: left flush, right flush, center centered.
  // TIME first, then DATE (was date-first).
  const leftStr  = timeStr + '  ' + dateStr;
  const leftCol  = timeFlashing
    ? span('ok', timeStr) + A('  ' + dateStr)
    : A(leftStr);
  // Compute plain-text lengths for spacing math.
  const leftLen  = leftStr.length;
  const rightLen = rightStr.length;
  const centerLen = locStr.length;
  // Center the location in the full inner width, then ensure it doesn't collide
  // with the left/right blocks (if it would, just left-pad after the left block).
  let centerStart = Math.floor((TB_INNER - centerLen) / 2);
  if (centerStart < leftLen + 1) centerStart = leftLen + 1;
  if (centerStart + centerLen > TB_INNER - rightLen - 1) {
    centerStart = Math.max(leftLen + 1, TB_INNER - rightLen - 1 - centerLen);
  }
  const gapLeft  = Math.max(0, centerStart - leftLen);
  const usedThroughCenter = leftLen + gapLeft + centerLen;
  const gapRight = Math.max(0, (TB_INNER - rightLen) - usedThroughCenter);

  const topBarInnerRaw =
    leftCol +
    ' '.repeat(gapLeft) +
    A(locStr) +
    ' '.repeat(gapRight) +
    span('ok', rightStr);
  // Guarantee exact inner width (visible chars) so the right wall aligns.
  const tbVisLen = leftLen + gapLeft + centerLen + gapRight + rightLen;
  const topBarInner = topBarInnerRaw + (tbVisLen < TB_INNER ? ' '.repeat(TB_INNER - tbVisLen) : '');

  // ── side panels ──────────────────────────────────────────────────────
  // Each side panel's inner content width = UI_LEFT_W or UI_RIGHT_W directly
  // (we changed the model so widths are content widths, not including walls).
  const LEFT_IN  = UI_LEFT_W;
  const RIGHT_IN = UI_RIGHT_W;

  // NPC stats panel (top-left) — shows whatever is known about the active NPC
  const npcStatLines = [];
  npcStatLines.push(A('NPC'));
  npcStatLines.push(A('─'.repeat(LEFT_IN)));
  if (npc && npc.name) {
    npcStatLines.push(npc.name);
    if (npc.stats) {
      for (const k of STAT_KEYS) {
        const v = npc.stats[k];
        const lbl = STAT_INFO[k].short;
        if (v != null) npcStatLines.push(SN(lbl + ' ') + SV(String(v).padStart(2)));
        else           npcStatLines.push(SN(lbl + '  ?'));   // hidden
      }
    } else {
      npcStatLines.push(SN('(stats unknown)'));
    }
  } else {
    npcStatLines.push(SN('(no one'));
    npcStatLines.push(SN('  in focus)'));
  }

  // NPC relationship panel (bottom-left)
  const npcRelLines = [];
  npcRelLines.push(A('REL.'));
  npcRelLines.push(A('─'.repeat(LEFT_IN)));
  if (npc && npc.relationship) {
    const r = npc.relationship;
    if (r.rep != null)     npcRelLines.push(SN('rep ') + SV(String(r.rep)));
    if (r.romance != null) npcRelLines.push(SN('rom ') + SV(String(r.romance)));
    if (r.tag)             npcRelLines.push(SN(r.tag));
    if (r.commonHobbies && r.commonHobbies.length) {
      npcRelLines.push(SN('shared:'));
      for (const h of r.commonHobbies.slice(0, 3)) npcRelLines.push('  ' + SN(h));
    }
    if (r.clique) npcRelLines.push(SN('clique: ') + r.clique);
  } else {
    npcRelLines.push(SN('—'));
  }

  // YOUR stats (top-right) — the existing renderStatsPartition logic, condensed
  const c = State.character || {};
  const yourStatLines = [];
  // Label is the player's name (uppercased) when available, falls back to YOU.
  const youLabel = (c.name || 'YOU').toUpperCase();
  yourStatLines.push(A(youLabel));
  yourStatLines.push(A('─'.repeat(RIGHT_IN)));
  // HP + STAMINA bars — same gauge style as Rested, shown ABOVE the attributes.
  // PLACEHOLDERS: the HP / stamina systems aren't built yet, so these read off
  // State.world.hp / .stamina if present and otherwise sit at full. Swap in the
  // real values once those systems exist.
  {
    const gauge = (val, max) => { const n = Math.max(0, Math.min(10, Math.round((val / max) * 10))); return '[' + '\u2588'.repeat(n) + '\u2591'.repeat(10 - n) + ']'; };
    const hpMax = (State.world && +State.world.hpMax) || (State.character && +State.character.maxHp) || 10;
    const hpVal = (State.world && typeof State.world.hp === 'number') ? State.world.hp : hpMax;
    const stMax = (State.world && +State.world.staminaMax) || 100;
    const stVal = (State.world && typeof State.world.stamina === 'number') ? State.world.stamina : stMax;
    const hpCls = hpVal >= hpMax * 0.55 ? 'ok' : (hpVal >= hpMax * 0.3 ? 'accent' : 'warn');
    const stCls = stVal >= stMax * 0.55 ? 'accent' : (stVal >= stMax * 0.3 ? 'accent' : 'warn');
    // #3: keep each label on the SAME line as its bar. The bar glyphs are
    // full-cell height, so at line-height:1 a bar on its own line visually
    // touches the label rows above/below ("overlap"). Beside the label the bar
    // only abuts other bars/blanks. ("Stamina" -> "SP" to fit the 24-col panel.)
    yourStatLines.push(SN('HP ') + span(hpCls, gauge(hpVal, hpMax) + ' ' + String(hpVal).padStart(3) + '/' + hpMax));
    yourStatLines.push(SN('SP ') + span(stCls, gauge(stVal, stMax) + ' ' + String(stVal).padStart(3) + '/' + stMax));
    yourStatLines.push('');
  }
  if (c.stats) {
    for (const k of STAT_KEYS) {
      const lbl = STAT_INFO[k].label;
      const base = (typeof statTotal === 'function') ? statTotal(k) : c.stats[k];
      // a TUTORIAL temporary buff shows as a bright +N after the value (and
      // is what dialogue gates see). Tutorial-only; cleared when the demo ends.
      const buff = (State._tutorialBuff && State._tutorialBuff.stat === k) ? State._tutorialBuff.amount : 0;
      if (buff) {
        const shown = base + buff;
        yourStatLines.push(SN(pad(lbl, RIGHT_IN - 6)) + SV(String(shown).padStart(3)) + span('ok', '+' + buff));
      } else {
        yourStatLines.push(SN(pad(lbl, RIGHT_IN - 3)) + SV(String(base).padStart(3)));
      }
    }
    // Rested status sits with the player's stats, shown as a BAR (the same
    // portrayal as the Day-1 wake-up scenario): a 10-cell gauge + value + a word,
    // colored by state. A plain blank line separates it from the attributes (no
    // full-width rule — that used to read as a misplaced frame above LOG).
    const restedVal = (State.world && typeof State.world.rested === 'number') ? State.world.rested : 100;
    const restedN = Math.max(0, Math.min(10, Math.round(restedVal / 10)));
    const restedBar = '[' + '\u2588'.repeat(restedN) + '\u2591'.repeat(10 - restedN) + ']';
    const restedCls = restedVal >= 55 ? 'ok' : (restedVal >= 30 ? 'accent' : 'warn');
    yourStatLines.push('');
    // #3: Rested label beside its bar too (same overlap fix). The 24-col panel
    // can't also fit the word, so show the numeric % here (the word still drives
    // the colour); HP/SP/Rested now read as a clean aligned trio.
    yourStatLines.push(SN('Rested ') + span(restedCls, restedBar + ' ' + String(restedVal).padStart(2)));
    // #7: CASH on hand (drives the concession SHOP). State.world.money.
    yourStatLines.push('');
    yourStatLines.push(SN('Cash ') + span('accent', '$' + (State.world.money != null ? State.world.money : 0).toFixed(2)));
  }

  // MINIMAP (top-right, above the stats).  Toggled by F7 — when hidden, the
  // map's allotted rows are returned to the stats panel so the player sees
  // stats with extra breathing room.
  const minimapVisible = opts.noMinimap ? false : !State.settings.minimapHidden;   // #2: WAKE_UP passes noMinimap so stats get the full top-right
  // the minimap is now an HTML CANVAS overlay (#minimap-overlay) that draws
  // the REAL map (floors/walls/objects) centered on the player and scrolls as
  // they move. In the grid we just reserve the rows (a header + blanks); the
  // overlay is positioned + drawn by refreshMinimapOverlay() post-render.
  const mapLines = [];
  if (minimapVisible) {
    mapLines.push(A('MAP'));
    for (let i = 1; i < UI_MAP_H; i++) mapLines.push('');
  }

  // Event log (bottom-right) — pulls from State.eventLog if present.
  //
  // VISUAL MODEL: newest entry at the BOTTOM, oldest at the TOP. As new
  // events arrive, older ones scroll up and off the panel. This matches
  // how chat windows / terminal logs feel — your eye stays at the bottom
  // where the new action is.
  //
  // ENTRY STYLING: each event is its own visually distinct block:
  //   - Timestamp in the accent (yellow) color so events are obviously
  //     separated even at a glance.
  //   - Body text wrapped to fit the panel width.
  //   - A thin dotted separator line between events for clean breaks.
  //
  // FITTING: we compute available rows = LEFT_BOT_H minus the fixed header
  // (LOG title + hint + divider = 3 lines), then build event blocks bottom-up
  // and stop when we run out of space.
  //
  // (LEFT_BOT_H is computed below — we mirror its math here.)
  const _LEFT_BOT_H = UI_BODY_H - UI_TOP_HALF - 1;
  const LOG_HEADER_ROWS = 2;                     // LOG title + divider (dropped the hint row)
  const LOG_BODY_ROWS   = _LEFT_BOT_H - LOG_HEADER_ROWS;

  const evLines = [];
  // #1: the LOG is drawn INLINE in the grid now (it used to be an HTML overlay
  // positioned by pixel math over these rows, which never quite aligned with the
  // monospace frame — the long-standing seam beside LOG). Rendering it as real
  // grid text means the right border can't misalign. refreshLogOverlay() is now a
  // no-op that just hides the old overlay element.
  evLines.push(span('accent', 'LOG'));
  evLines.push(span('frame', '\u2500'.repeat(RIGHT_IN)));
  {
    const log = (State.eventLog || []);
    const blocks = [];   // newest-first event blocks (timestamp + wrapped body)
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i];
      const body = (typeof wrapWords === 'function') ? wrapWords(e.text, RIGHT_IN) : [String(e.text || '')];
      blocks.push([span('accent', e.time)].concat(body.map(l => span('stat-name', l))));
    }
    const kept = []; let used = 0;
    for (const blk of blocks) {
      const need = blk.length + (kept.length ? 1 : 0);   // +1 for a separator between blocks
      if (used + need > LOG_BODY_ROWS) break;
      kept.push(blk); used += need;
    }
    kept.reverse();   // oldest kept at top, newest at the bottom
    const body = [];
    kept.forEach((blk, idx) => { if (idx) body.push(span('frame', '\u00b7'.repeat(Math.min(RIGHT_IN, 12)))); blk.forEach(l => body.push(l)); });
    while (body.length < LOG_BODY_ROWS) body.unshift('');   // push content to the bottom
    body.forEach(l => evLines.push(l));
  }

  // ── assemble ─────────────────────────────────────────────────────────
  // Pad each section to its target height by appending blanks.
  function padCol(lines, h, w) {
    const out = lines.slice(0, h).map(l => padTo(l, w));
    while (out.length < h) out.push(' '.repeat(w));
    return out;
  }
  const LEFT_TOP    = padCol(npcStatLines, UI_TOP_HALF, LEFT_IN);
  const LEFT_BOT_H  = UI_BODY_H - UI_TOP_HALF - 1;   // minus 1 for inter-divider
  const LEFT_BOT    = padCol(npcRelLines, LEFT_BOT_H, LEFT_IN);

  // Right-top column: stack the minimap (if visible) above the stats.
  // When the minimap is hidden, stats get the entire UI_TOP_HALF allocation
  // so the values aren't crammed.
  let RIGHT_TOP;
  if (minimapVisible) {
    // reserve the STATS' full natural height FIRST, then give the
    // minimap only the rows left above them. This guarantees the minimap can never
    // squish/clip the stats — the old code reserved UI_TOP_HALF - UI_MAP_H for the
    // stats, which truncated the bottom stat rows once the map was shown. With
    // UI_TOP_HALF=17 and 11 stat rows, the map gets its full UI_MAP_H (6) rows.
    const statsH = Math.min(yourStatLines.length, UI_TOP_HALF);   // never exceed the section
    const mapH   = Math.max(0, UI_TOP_HALF - statsH);             // map gets the remainder
    const mapBlock   = padCol(mapLines,      mapH,    RIGHT_IN);
    const statsBlock = padCol(yourStatLines, statsH,  RIGHT_IN);
    RIGHT_TOP = mapBlock.concat(statsBlock);
  } else {
    RIGHT_TOP = padCol(yourStatLines, UI_TOP_HALF, RIGHT_IN);
  }
  const RIGHT_BOT   = padCol(evLines, LEFT_BOT_H, RIGHT_IN);

  // Center column — gameText wrapped to UI_MID_W (already content width).
  // If dialoguePopup or choicesPopup are present, overlay them as boxed
  // sub-frames within the center column.
  const MID_IN = UI_MID_W;
  // First, wrap all gameText lines.
  const wrappedGame = [];
  for (const ln of gameText) {
    for (const piece of wrapToFrameWidth(ln, MID_IN)) wrappedGame.push(piece);
  }
  let midRows;
  if (mapMode) {
    // top half stays blank (the live map canvas is overlaid there by the
    // host). The description text fills the bottom half, starting just under
    // the mid-body divider.
    midRows = [];
    for (let i = 0; i < UI_TOP_HALF; i++) midRows.push(' '.repeat(MID_IN));
    // #5: show the LAST rows (newest at the bottom) so the most recent action +
    // its response are always visible — they used to render from the TOP, so a
    // fresh line (e.g. the "coffee" result) sat below the fold until later
    // actions pushed it up. slice(-h) auto-scrolls the description to the bottom.
    const descRows = padCol(wrappedGame.slice(-LEFT_BOT_H), LEFT_BOT_H, MID_IN);
    for (let i = 0; i < LEFT_BOT_H; i++) midRows.push(descRows[i] || ' '.repeat(MID_IN));
  } else {
    // Allocate top half + bottom half rows for game text; if dialoguePopup
    // exists, reserve last 4 rows for it. #5: slice to the LAST rows so the
    // newest action/response is always shown (auto-scroll to bottom) instead of
    // rendering from the top and leaving fresh lines below the fold.
    midRows = padCol(wrappedGame.slice(-UI_BODY_H), UI_BODY_H, MID_IN);
  }
  // Overlay dialogue popup at the bottom of the center column.
  if (dialogue && dialogue.length) {
    const boxH = Math.min(dialogue.length + 2, 6);
    const startRow = UI_BODY_H - boxH;
    const boxW = MID_IN - 4;
    const topB = F('┌' + '─'.repeat(boxW - 2) + '┐');
    const botB = F('└' + '─'.repeat(boxW - 2) + '┘');
    midRows[startRow] = padTo('  ' + topB + '  ', MID_IN);
    for (let i = 1; i < boxH - 1; i++) {
      const t = (dialogue[i - 1] || '');
      midRows[startRow + i] = padTo('  ' + F('│') + ' ' + padTo(t, boxW - 4) + ' ' + F('│') + '  ', MID_IN);
    }
    midRows[startRow + boxH - 1] = padTo('  ' + botB + '  ', MID_IN);
  }
  // Overlay choices popup at top-right of center column.
  if (choices && choices.length) {
    const boxW = 28;
    const boxH = Math.min(choices.length + 2, 10);
    const startRow = 1;
    const startCol = MID_IN - boxW - 2;
    const topB = F('┌' + '─'.repeat(boxW - 2) + '┐');
    const botB = F('└' + '─'.repeat(boxW - 2) + '┘');
    // We splice into the existing row strings at the right column offset.
    for (let i = 0; i < boxH; i++) {
      let content;
      if      (i === 0)         content = topB;
      else if (i === boxH - 1)  content = botB;
      else                      content = F('│') + ' ' + padTo(choices[i - 1] || '', boxW - 4) + ' ' + F('│');
      // Splice: take left part of row, then content, then trailing chars.
      const left = padTo('', startCol);
      midRows[startRow + i] = padTo(left + content, MID_IN);
    }
  }

  // ── compose all rows ─────────────────────────────────────────────────
  // We render as: top-bar row, divider, body rows (with section dividers
  // around the mid-half horizontal split for the LEFT/RIGHT columns), bottom.
  const out = [];
  const dash = (n) => '─'.repeat(n);

  // Top frame + top bar
  out.push(F('┌' + dash(UI_TOTAL_W - 2) + '┐'));
  out.push(F('│') + topBarInner + F('│'));
  // Divider between top bar and body. Column dividers at the LEFT and RIGHT
  // wall positions. Math: ├ + dash(LEFT) + ┬ + dash(MID) + ┬ + dash(RIGHT) + ┤
  //                       = 1 + 18 + 1 + 80 + 1 + 18 + 1 = 120 ✓
  out.push(F('├' + dash(UI_LEFT_W) + '┬' + dash(UI_MID_W) + '┬' + dash(UI_RIGHT_W) + '┤'));

  // Body: the LEFT (REL.) and RIGHT (LOG) bottom panels can be dropped
  // BOT_PANEL_DROP rows below the center split (currently 0 = aligned with the
  // center). When >0, the LEFT/RIGHT top-of-bottom-panel divider is drawn that
  // many rows lower while the center column stays continuous. (Previously only
  // the content moved, leaving
  // an empty boxed strip above the headers + a broken-looking border above LOG.)
  const DROP = BOT_PANEL_DROP;
  const divRow   = UI_TOP_HALF + DROP;               // body-row of the L/R divider
  const bodyRows = UI_TOP_HALF + 1 + LEFT_BOT_H;     // total body rows (unchanged)
  const blankL = ' '.repeat(UI_LEFT_W), blankR = ' '.repeat(UI_RIGHT_W), blankM = ' '.repeat(UI_MID_W);
  // Center text per row: continuous, keeping the original blank gap at UI_TOP_HALF
  // (the center map/description split stays put).
  const midAt = (r) => {
    if (r < UI_TOP_HALF) return midRows[r] || blankM;
    if (r === UI_TOP_HALF) return blankM;
    return midRows[r - 1] || blankM;
  };
  const leftAt  = (r) => (r < divRow) ? (LEFT_TOP[r]  || blankL) : (LEFT_BOT[r - divRow - 1]  || blankL);
  const rightAt = (r) => (r < divRow) ? (RIGHT_TOP[r] || blankR) : (RIGHT_BOT[r - divRow - 1] || blankR);

  for (let r = 0; r < bodyRows; r++) {
    if (mapMode && r === UI_TOP_HALF) {
      // in map mode the center divider and the REL./LOG panel tops
      // are the SAME row, drawn as ONE continuous line with ┼ junctions — the
      // old version drew the center's ├─┤ here and the side ├─┤ two rows lower,
      // and the offset pair met the shared vertical in a Z-jog that looked like
      // a misaligned frame just above LOG.
      out.push(F('├' + dash(UI_LEFT_W) + '┼' + dash(UI_MID_W) + '┼' + dash(UI_RIGHT_W) + '┤'));
    } else if (!mapMode && r === divRow) {
      // Non-map screens: the center column is continuous text; only the side
      // panels divide here.
      out.push(F('├' + dash(UI_LEFT_W) + '┤') + midAt(r) + F('├' + dash(UI_RIGHT_W) + '┤'));
    } else {
      out.push(F('│') + leftAt(r) + F('│') + midAt(r) + F('│') + rightAt(r) + F('│'));
    }
  }

  // Bottom frame
  out.push(F('└' + dash(UI_LEFT_W) + '┴' + dash(UI_MID_W) + '┴' + dash(UI_RIGHT_W) + '┘'));

  // #9/#7: after this grid paints, position + fill the HTML overlays (LOG and
  // the real scrolling minimap) over their bottom-right / top-right regions.
  requestAnimationFrame(() => { try { refreshLogOverlay(); refreshMinimapOverlay(); ensureMinimapTicker(); } catch (e) {} });

  return out.join('\n');
}

// the LOG panel as an HTML overlay floated over the bottom-right grid region.
// Smaller font, newest-at-bottom, fixed border (a CSS box, not ASCII padding).
function refreshLogOverlay() {
  // #5: the LOG reads back as a floated overlay so its text can be SMALLER than
  // the terminal grid (0.72×). It's positioned over the INNER right-bottom region
  // only (never the ASCII border cells) with an opaque terminal-bg background, so
  // the frame stays crisp and the smaller log doesn't disturb the monospace grid.
  // The inline LOG drawn in renderGameplayUI sits underneath as a graceful
  // fallback if the overlay can't measure the grid (e.g. before first paint).
  return _refreshLogOverlayImpl();
}
function _refreshLogOverlayImpl() {
  // Only show on the gameplay/map UI. On other screens, hide it.
  const onUI = (typeof MAP_SCREENS !== 'undefined' && MAP_SCREENS.has(State.screen));
  let el = document.getElementById('log-overlay');
  if (!onUI) { if (el) el.style.display = 'none'; return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'log-overlay';
    el.style.cssText = [
      'position:fixed', 'z-index:6', 'overflow:hidden', 'pointer-events:none',
      'box-sizing:border-box', 'padding:2px 6px',
      'font-family:inherit', 'color:#cfe8ff',
      // OPAQUE terminal-bg background. The transparent overlay let a
      // 1-2px positioning-rounding seam show as the long-standing "misaligned
      // frame above LOG"; a solid panel (matching the terminal) hides it.
      'background:var(--bg)',
      'display:flex', 'flex-direction:column'
    ].join(';');
    document.body.appendChild(el);
  }
  // cover the WHOLE right-bottom column (header + body) so nothing in the
  // ASCII grid can offset the border. We draw our own "LOG" header here.
  // #7 (FIX): drop the LOG panel down BOT_PANEL_DROP rows (and shrink its height to
  // match) so it isn't flush with the top of the center description text.
  const botHalfRows = UI_BODY_H - UI_TOP_HALF - 1;
  const ok = positionGridOverlay(el, RIGHT_COL_START, BOT_ROW_START + BOT_PANEL_DROP, UI_RIGHT_W, botHalfRows - BOT_PANEL_DROP);
  if (!ok) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const m = gridCellMetrics();
  // #6: the bottom-right LOG reads smaller than the rest of the UI (it's
  // reference text, not primary), so fit more entries. 0.60× the terminal font.
  const fs = m ? Math.max(8, Math.round(parseFloat(getComputedStyle(display).fontSize) * 0.60)) : 10;
  el.style.fontSize = fs + 'px';
  el.style.lineHeight = '1.25';
  const events = (State.eventLog || []);
  const esc = (s) => String(s == null ? '' : s).replace(/[<&>]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]));
  // Header (matches the "LOG" label that used to live in the grid).
  // no border-bottom here — the ASCII frame already draws the
  // ├──┤ divider directly above this overlay; a second CSS rule one row down
  // was the "misaligned frame above LOG". Just the label, flush under the line.
  let header = '<div style="color:#ffe066;font-weight:bold;letter-spacing:1px;flex:0 0 auto;margin-bottom:3px">LOG</div>';
  // Scrolling body, newest at the bottom.
  let body;
  if (!events.length) {
    body = '<div style="color:#5a6b7a">(nothing yet)</div>';
  } else {
    const rows = [];
    for (let i = Math.max(0, events.length - 60); i < events.length; i++) {   // #2: keep more history to scroll
      const e = events[i];
      rows.push('<div style="margin-top:3px"><span style="color:#ffd86b;font-weight:bold">' + esc(e.time || '') + '</span><br><span>' + esc(e.text || '') + '</span></div>');
    }
    body = rows.join('');
  }
  el.innerHTML = header + '<div id="log-overlay-body" style="flex:1 1 auto;overflow-y:auto;display:flex;flex-direction:column;justify-content:flex-end">' + body + '</div>';
}

// the minimap as a CANVAS overlay that draws the REAL map (floors/walls/
// objects) from State.mapData, centered on the player, scrolling as they move.
// If the whole map doesn't fit, it shows a window around the player.
function refreshMinimapOverlay() {
  const onUI = (typeof MAP_SCREENS !== 'undefined' && MAP_SCREENS.has(State.screen));
  let el = document.getElementById('minimap-overlay');
  const hidden = State.settings.minimapHidden;
  if (!onUI || hidden) { if (el) el.style.display = 'none'; return; }
  if (!el) {
    el = document.createElement('canvas');
    el.id = 'minimap-overlay';
    el.style.cssText = 'position:fixed;z-index:110;pointer-events:none;image-rendering:pixelated;background:#0a0a14;';   // z-index 110 sits ABOVE the body.crt::before scanline layer (z 100) so the fixed-position horizontal scanline gradient no longer prints its lines across the minimap. The minimap is pixel-art HUD, not part of the CRT-filtered terminal text.
    document.body.appendChild(el);
  }
  // Geometry: top-right region, below the 1-row MAP header.
  const ok = positionGridOverlay(el, RIGHT_COL_START, BODY_ROW_START + 1, UI_RIGHT_W, UI_MAP_H - 1);
  if (!ok) { el.style.display = 'none'; return; }
  // #6: pull the bottom edge up a few px so the minimap NEVER clips the HP/SP bars
  // rendered in the row directly beneath it (rounding used to let it bleed over the
  // top of the HP bar — the long-standing overlap).
  el.style.height = Math.max(1, parseFloat(el.style.height) - 5) + 'px';
  el.style.display = 'block';
  const data = State.mapData;
  if (!data || !data.map) { el.style.display = 'none'; return; }
  // Size the backing store to the CSS box (crisp pixels).
  const cssW = parseFloat(el.style.width), cssH = parseFloat(el.style.height);
  const dpr = window.devicePixelRatio || 1;
  el.width = Math.max(1, Math.round(cssW * dpr));
  el.height = Math.max(1, Math.round(cssH * dpr));
  const ctx = el.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  // Which floor + where's the player?
  const pt = (typeof window.enginePlayerTile === 'function') ? window.enginePlayerTile() : { x: (data.start && data.start.x) || 0, z: (data.start && data.start.z) || 0, f: (data.start && data.start.f) || 0, rot: 0 };
  const floor = data.map[pt.f] || data.map[0];
  if (!floor) { return; }
  const H = floor.length, W = floor[0].length;
  // Tile pixel size: fit the whole map if it's small; otherwise a fixed zoom and
  // scroll to keep the player centered.
  const fitTile = Math.min(cssW / W, cssH / H);
  const TILE = Math.max(4, Math.min(10, Math.floor(fitTile) || 6));
  // Top-left tile so the player sits centered (clamped to map bounds when small).
  let originX = pt.x - (cssW / TILE) / 2 + 0.5;
  let originZ = pt.z - (cssH / TILE) / 2 + 0.5;
  if (W * TILE <= cssW) originX = (W - cssW / TILE) / 2;   // map narrower than panel → center it
  if (H * TILE <= cssH) originZ = (H - cssH / TILE) / 2;

  const sx = (x) => Math.round((x - originX) * TILE);
  const sz = (z) => Math.round((z - originZ) * TILE);

  // Draw floors + walls + a few notable objects.
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const cell = floor[z][x]; if (!cell) continue;
      const px = sx(x), pz = sz(z);
      if (px < -TILE || pz < -TILE || px > cssW || pz > cssH) continue;
      if (cell.f) { ctx.fillStyle = cell.f.c || '#444'; ctx.fillRect(px, pz, TILE, TILE); }
      // Walls on the cell's edges.
      ctx.fillStyle = '#e5e7eb';
      const wall = (e) => e && e.meta && e.meta.solid;
      if (wall(cell.n)) ctx.fillRect(px, pz, TILE, 1);
      if (wall(cell.s)) ctx.fillRect(px, pz + TILE - 1, TILE, 1);
      if (wall(cell.w)) ctx.fillRect(px, pz, 1, TILE);
      if (wall(cell.e)) ctx.fillRect(px + TILE - 1, pz, 1, TILE);
      // Notable objects: doors (brown), warp/dir (cyan), npc (red-ish).
      const o = cell.o;
      if (o) {
        if (o.v === 'npc') { ctx.fillStyle = '#f87171'; ctx.fillRect(px + TILE*0.3, pz + TILE*0.3, TILE*0.4, TILE*0.4); }
        else if (o.v === 'warp_point' || o.v === 'dir' || o.v === 'warp_pad') { ctx.fillStyle = '#22d3ee'; ctx.fillRect(px + TILE*0.25, pz + TILE*0.25, TILE*0.5, TILE*0.5); }
      }
    }
  }
  // Player marker (centered) — a bright dot with a facing tick.
  const ppx = sx(pt.x) + TILE / 2, ppz = sz(pt.z) + TILE / 2;
  ctx.fillStyle = '#fde047';
  ctx.beginPath(); ctx.arc(ppx, ppz, Math.max(2, TILE * 0.35), 0, Math.PI * 2); ctx.fill();

  // #12: the minimap no longer draws its OWN compass rose — the corner 3D
  // compass (#compass-ui) already shows heading, so a second one here was
  // redundant. (Removed the in-minimap rose + N marker + tilt readout.)
}

// keep the minimap scrolling with the player. A light interval redraws it
// (~8fps) only while a map screen is active; it self-stops otherwise.
let _minimapTimer = null;
function ensureMinimapTicker() {
  if (_minimapTimer) return;
  _minimapTimer = setInterval(() => {
    const onUI = (typeof MAP_SCREENS !== 'undefined' && MAP_SCREENS.has(State.screen));
    if (!onUI) { clearInterval(_minimapTimer); _minimapTimer = null; return; }
    try { refreshMinimapOverlay(); } catch (e) {}
    // if the player walked between indoors/outdoors, refresh the top bar.
    try {
      if (typeof window.enginePlayerOutdoors === 'function') {
        const out = window.enginePlayerOutdoors();
        if (State._lastOutdoors == null) State._lastOutdoors = out;
        else if (out !== State._lastOutdoors) { State._lastOutdoors = out; render(); }
      }
    } catch (e) {}
  }, 125);
}

// Helper: format the in-game time (24h → 12h AM/PM with minutes) for the
// gameplay UI top bar. Different signature from formatTime() which reads
// State.world directly — this one takes hour/minute args.
function formatTimeCompact(h, m) {
  const mm = String(m).padStart(2, '0');
  // 24-hour ("military") time when the setting is on (off by default).
  if (State.settings && State.settings.militaryTime) {
    return String(h).padStart(2, '0') + ':' + mm;
  }
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = ((h + 11) % 12) + 1;
  return h12 + ':' + mm + ' ' + period;
}

// ─── LEGACY FRAME (used by current gameplay placeholder screens) ──────────
// Kept for back-compat. Eventually all screens will use renderGameplayUI.
function renderInGameFrame(contentLines, opts = {}) {
  const showStats = !State.settings.statsHidden;
  const innerW    = showStats ? FRAME_INNER_NARROW : FRAME_INNER_WIDE;

  const F = (s) => span('frame', s);
  const top    = F('+' + '-'.repeat(innerW) + '+');
  const bot    = F('+' + '-'.repeat(innerW) + '+');
  const blank  = F('|') + ' '.repeat(innerW) + F('|');

  // Pad a single (already-wrapped, ≤ innerW visible) line to innerW.
  const wrap = (s) => {
    const visible = stripTags(s);
    const pad = Math.max(0, innerW - visible.length);
    return F('|') + s + ' '.repeat(pad) + F('|');
  };

  // First, expand each content line into possibly-multiple wrapped lines.
  const expanded = [];
  for (const cl of contentLines) {
    for (const piece of wrapToFrameWidth(cl, innerW)) expanded.push(piece);
  }

  // Build right-side stats (if shown)
  const stats = showStats ? renderStatsPartition() : [];

  const out = [];

  // Top-right indicator. The character-sheet hotkey is shown PERMANENTLY at
  // top-right per the design doc; the F8 stats toggle joins it when the stats
  // partition is on.
  //
  // To change which hotkeys appear here: edit the indicator pieces below.
  const indicator =
    span('accent', '[F3] sheet') +
    '   ' +
    (showStats ? span('accent', '[F8] hide stats') : span('accent', '[F8] show stats'));
  // Pre-pad to align with the partition column.
  const indicatorRow = ' '.repeat(FRAME_INNER_NARROW + 4) + indicator;
  out.push(indicatorRow);

  // Compose framed rows
  const innerRows = [];
  innerRows.push(top);
  innerRows.push(blank);
  for (const cl of expanded) innerRows.push(wrap(cl));
  // Pad innerRows up to at least the stats partition height
  while (showStats && innerRows.length < stats.length + 1) innerRows.push(blank);
  innerRows.push(blank);
  innerRows.push(bot);

  // Merge with stats partition row-by-row.
  const max = Math.max(innerRows.length, showStats ? stats.length : 0);
  for (let i = 0; i < max; i++) {
    const left  = innerRows[i] || '';
    const right = showStats ? (stats[i] ? ('  ' + stats[i]) : '') : '';
    out.push(left + right);
  }
  return out.join('\n');
}

//═══════════════════════════════════════════════════════════════════════════
// HOTKEY BAR
//═══════════════════════════════════════════════════════════════════════════
//
// Renders into the fixed-position #hotkey-bar at the bottom. Updated whenever
// settings change (via updateHotkeyBar()) and on every render() of the main
// display so the bar stays in sync with the current audio mode.
//
//───────────────────────────────────────────────────────────────────────────
const AUDIO_MODE_LABEL = {
  'all':         'ALL ON',
  'music-off':   'MUSIC OFF',
  'sounds-off':  'SFX OFF',
  'mute':        'MUTED',
};

// screens that show a playable map (the green MID box) and therefore get
// the sticky move/interact controls bar. The in-UI debug room will join
// this set when built.
const MAP_SCREENS = new Set(['GAME_PLACEHOLDER', 'DEBUG_ROOM_MAP', 'TUTORIAL_MAP']);

// A "cursor-driven" screen is any screen object that exposes an onKey() handler.
// On these (the merged chargen ATTRIBUTES screen + its STATS/SKILLS aliases) the
// command prompt stays CLOSED so W/S/arrows drive the cursor instead of opening
// the prompt to type. Returns the screen object (so callers can route to it) or
// null. Add a screen to this behavior simply by giving it an onKey() method.
function cursorScreenObj(name) {
  const s = (typeof Screens !== 'undefined') && Screens[name || State.screen];
  return (s && typeof s.onKey === 'function') ? s : null;
}
// Should this keydown open the command prompt and start a command? True only
// for a plain printable key (no Ctrl/Meta/Alt), while the terminal is showing a
// TEXT-command screen: it has a handle(), no cursor UI (onKey), isn't a live map
// (letters move you there), and no in-game modal is up. See the global keydown
// handler's TYPE-TO-COMMAND block.
function typeOpensPrompt(e) {
  if (!e || !e.key || e.key.length !== 1 || e.key === ' ') return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (!document.body.classList.contains('terminal-active')) return false;   // title canvas owns the keys
  if (State._swallowInputUntil && Date.now() < State._swallowInputUntil) return false;   // the key that launched the terminal
  const s = State.screen && Screens[State.screen];
  if (!s || typeof s.handle !== 'function' || typeof s.onKey === 'function') return false;
  if (MAP_SCREENS.has(State.screen)) return false;
  if (typeof window.__anyModalOpen === 'function' && window.__anyModalOpen()) return false;
  return true;
}
const controlsBar = document.getElementById('controls-bar');

// the sticky controls bar shows movement/interaction keys. It's only
// visible on playable map screens (body.map-screen toggled here), sitting just
// above the F-key hotkey bar and below the (always-sticky) command prompt.
function updateControlsBar() {
  const onMap = MAP_SCREENS.has(State.screen);
  document.body.classList.toggle('map-screen', onMap);
  // mountMapCanvas sets an INLINE display:block on #game-container, which
  // overrides the CSS class rule and would leave a blank box over the center on
  // non-map screens. Clear it (and hide the floated overlays) whenever we're not
  // on a map screen so text can fill the whole center.
  if (!onMap) {
    const gc = document.getElementById('game-container');
    if (gc) gc.style.display = 'none';
    ['log-overlay', 'minimap-overlay'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
  }
  if (!onMap || !controlsBar) return;
  // map-view controls reflect the engine's actual bindings.
  const segs = [
    `<span class="ck"><span class="ck-key">W/A/S/D</span> move</span>`,
    `<span class="ck"><span class="ck-key">G</span> interact</span>`,
    `<span class="ck"><span class="ck-key">Space</span> jump</span>`,
    `<span class="ck"><span class="ck-key">Scroll</span> zoom</span>`,
    `<span class="ck"><span class="ck-key">Q/E</span> turn view</span>`,
    `<span class="ck"><span class="ck-key">T</span> tilt</span>`,
    `<span class="ck"><span class="ck-key">V</span> first-person</span>`,
    `<span class="ck"><span class="ck-key">X</span> crouch</span>`,
    `<span class="ck"><span class="ck-key">F7</span> compass / map</span>`,
    `<span class="ck"><span class="ck-key">Enter</span> command</span>`,
  ];
  controlsBar.innerHTML = segs.join('<span class="ck-sep">|</span>');
}

// #3: COMMAND TICKER. A bottom frame listing the words you can TYPE right now:
// scene-specific actions the engine publishes via window.__sceneWords (highlighted),
// then the basic verbs (toggleable in Settings → "TICKER BASICS"). When the line is
// wider than the screen it scrolls like a TV ticker — the track is duplicated and
// animated to -50% for a seamless loop, and hovering pauses it so you can read/click.
// Each word is clickable: a click opens the command prompt pre-filled with that word.
// HOW TO MODIFY: edit BASIC_TICKER_WORDS, push onto window.__sceneWords from the
// engine/a screen, or tune the scroll SPEED below.
const BASIC_TICKER_WORDS = ['look', 'talk', 'inventory', 'character', 'map', 'save', 'load', 'help', 'settings', 'back'];
function updateCommandTicker() {
  const tk = document.getElementById('command-ticker');
  if (!tk) return;
  const track = tk.querySelector('.tk-track');
  if (!track) return;
  if (!MAP_SCREENS.has(State.screen) && State.screen !== 'WAKE_UP' && State.screen !== 'FIRST_SHIFT') { tk.style.display = 'none'; return; }
  const esc = (s) => String(s).replace(/[<&>"]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' }[c]));
  const scene  = Array.isArray(window.__sceneWords) ? window.__sceneWords.slice(0, 12) : [];
  // #6: the WAKE-UP scene drives its OWN command bar (the scene's verbs only) —
  // no generic movement/map basics, since none of that applies before the door.
  const basics = (State.screen === 'WAKE_UP' || State.screen === 'FIRST_SHIFT') ? [] : ((State.settings.tickerBasics !== false) ? BASIC_TICKER_WORDS : []);
  if (!scene.length && !basics.length) { tk.style.display = 'none'; return; }
  const wordSpan = (w, cls) => '<span class="tk-word ' + cls + '" data-tk="' + esc(w) + '">' + esc(w) + '</span>';
  const parts = [];
  scene.forEach(w => parts.push(wordSpan(w, 'tk-scene')));
  basics.forEach(w => parts.push(wordSpan(w, '')));
  const content = '<span class="tk-label">type:</span>' + parts.join('<span class="tk-sep">\u00b7</span>');
  tk.style.display = 'block';
  // Render once, measure, and only then (if it overflows) duplicate for the loop.
  track.classList.remove('scrolling');
  track.style.animationDuration = '';
  track.innerHTML = content;
  const key = scene.join('|') + '#' + basics.length;      // skip rework if unchanged
  if (track._tkKey === key && track._tkScroll) { track.innerHTML = track._tkScroll.html; if (track._tkScroll.dur) { track.style.animationDuration = track._tkScroll.dur; track.classList.add('scrolling'); } return; }
  track._tkKey = key; track._tkScroll = null;
  requestAnimationFrame(() => {
    if (track.innerHTML !== content) return;             // superseded by a newer update
    const overflow = track.scrollWidth > tk.clientWidth + 4;
    if (overflow) {
      const gap = '<span class="tk-sep" style="margin:0 24px">\u00b7</span>';
      const html = content + gap + content;
      const dur = Math.max(8, Math.round((track.scrollWidth + 48) / 60)) + 's';   // ~60px/sec
      track.innerHTML = html;
      track.style.animationDuration = dur;
      track.classList.add('scrolling');
      track._tkScroll = { html, dur };
    } else {
      track._tkScroll = { html: content, dur: null };
    }
  });
}

// #3: the engine (or any screen) calls window.setSceneWords([...]) to publish the
// special words/actions available in the CURRENT scene (e.g. ['buy','leave'] in a
// shop). They appear highlighted at the front of the ticker and refresh it at once.
// window.updateCommandTicker() is also exposed so the engine can force a refresh.
window.updateCommandTicker = updateCommandTicker;
window.setSceneWords = function (arr) {
  window.__sceneWords = Array.isArray(arr) ? arr : [];
  try { updateCommandTicker(); } catch (e) {}
};

function updateHotkeyBar() {  const m = AUDIO_MODE_LABEL[State.settings.audioMode] || 'ALL ON';
  // inGame = anything besides the (now-deleted) TITLE and the QUIT goodbye.
  // Since TITLE no longer exists in this runtime, we just check for QUIT.
  const inGame = !!State.screen && State.screen !== 'QUIT';
  // Build segments
  const segs = [
    `<span class="hk"><span class="hk-key">F2</span> save</span>`,
    `<span class="hk"><span class="hk-key">F4</span> load</span>`,
    `<span class="hk"><span class="hk-key">F6</span> audio: ${m}</span>`,
  ];
  if (inGame) {
    segs.push(`<span class="hk"><span class="hk-key">F3</span> sheet</span>`);
    segs.push(`<span class="hk"><span class="hk-key">F7</span> map</span>`);
    segs.push(`<span class="hk"><span class="hk-key">F8</span> stats</span>`);
    // PORTFOLIO EDIT: the log hotkey is F9 on every screen (a bare L opens the command prompt on
    // typed-command screens, where it's the first letter of "look"); L still works on map screens.
    segs.push(`<span class="hk"><span class="hk-key">F9</span> log</span>`);
  }
  segs.push(`<span class="hk"><span class="hk-key">F11</span> fullscreen</span>`);
  if (inGame) {
    segs.push(`<span class="hk"><span class="hk-key">ESC</span> menu/pause</span>`);
  }
  hotkeyBar.innerHTML = segs.join('<span class="hk-sep">|</span>');
}

//═══════════════════════════════════════════════════════════════════════════
// SCREENS
//═══════════════════════════════════════════════════════════════════════════
//
// Each screen object has two methods:
//   render()      → returns an HTML string for the #display element
//   handle(text)  → handles a line typed at the prompt
//
// Most character-creation screens accept "r" or "random" to randomize that
// stage's choice. Most accept "back" to step backward; some accept "help"
// to open the mechanics page (returning to where they were).
//
// To add a new screen:
//   Screens.MY_SCREEN = {
//     render() { return ...; },
//     handle(text) { ... goto('NEXT'); }
//───────────────────────────────────────────────────────────────────────────

//═══════════════════════════════════════════════════════════════════════════
// DETAILED CHARACTER SHEET
//═══════════════════════════════════════════════════════════════════════════
//
// Renders a long-form character sheet with all blurbs and modifiers spelled
// out. Used in TWO places:
//   • the REVIEW screen at the end of character creation
//   • the in-game CHARACTER_SHEET screen (F3 hotkey, ESC menu, or "sheet" cmd)
//
// To customize what appears: edit the section blocks below. The blurbs come
// straight from the HOBBIES, SKILLS, and CLIQUES tables — change those tables
// to change what's shown here.
//
//───────────────────────────────────────────────────────────────────────────

function renderCharacterSheet() {
  // a ONE-SCREEN, TWO-COLUMN sheet. The old sheet was a single tall
  // vertical scroll (banner → identity → stats → age → hobbies → abilities →
  // clique → equipment) that ran well past the ~34 visible rows. It's now laid
  // out in two columns under a banner, with EQUIPMENT in its own boxed container:
  //   LEFT  (col width LCOL): Identity, Stats (compact), Age bracket, Clique
  //   RIGHT (col width RCOL): Hobbies, Abilities, then the EQUIPMENT box
  // The two columns are zipped together row-for-row so the whole thing fits.
  // HOW TO MODIFY: LCOL/RCOL set the column widths; push lines into `left`/`right`;
  // the boxed() helper draws a titled container (used for Equipment, reusable).
  const c = State.character;
  const bracket = ageBracket(c.age);
  const ageMods = AGE_MODS[bracket] || {};
  const genderLabel = (GENDER_OPTIONS.find(o => o.key === c.gender) || {}).label ||
                      (c.gender === 'other' ? 'Other' : '');
  // #1: pronouns are resolved by the game-wide helper (custom for 'other',
  // else derived from the gender) so the sheet always reads correctly.
  const _pr = (window.Pronouns && window.Pronouns.of) ? window.Pronouns.of(c) : null;
  const pronounLabel = _pr ? (_pr.subj + ' / ' + _pr.obj) : 'they / them';
  const orLabel    = (ORIENTATION_OPTIONS.find(o => o.key === c.orientation) || {}).label;
  const locObj     = c.location ? LOCATIONS.find(l => l.key === c.location) : null;
  const cliqueObj  = c.clique   ? CLIQUES.find(x => x.key === c.clique)     : null;

  const LCOL = 52, RCOL = 60, GUT = 3;     // left / right column widths + gutter
  const TOT = LCOL + GUT + RCOL;           // total inner width (≈115, fits 120)

  // truncate at a WORD boundary with an ellipsis so the two-column
  // sheet never cuts a word in half (e.g. "jumping hi" -> "jumping high…").
  // Pad a (possibly span-tagged) line to exactly n VISIBLE chars (truncate if over).
  const padVis = (s, n) => {
    s = s || '';
    const vis = stripTags(s).length;
    if (vis === n) return s;
    if (vis > n) return (typeof sliceRowVisible === 'function') ? sliceRowVisible(s, 0, n) : s.slice(0, n);
    return s + ' '.repeat(n - vis);
  };
  const sectionHead = (t, w) => span('accent', t) + ' ' + span('accent', '─'.repeat(Math.max(0, w - t.length - 1)));

  // A titled box container of a fixed inner width. Returns an array of lines.
  const boxed = (title, bodyLines, w) => {
    const inner = w - 2;
    const out = [];
    const t = ' ' + title + ' ';
    // Top border must be exactly `inner` visible chars BETWEEN the corners so it
    // lines up with the body rows (│ + inner + │). The leading '┌─' already spends
    // one dash, so the trailing fill is inner-1-t.length (the earlier inner-2 made
    // the top border one column short → the top-right corner sat in by one). (#5)
    const fill = Math.max(0, inner - 1 - t.length);
    out.push(span('frame', '┌─') + span('accent', t) + span('frame', '─'.repeat(fill) + '┐'));
    bodyLines.forEach(bl => out.push(span('frame', '│') + padVis(' ' + bl, inner) + span('frame', '│')));
    out.push(span('frame', '└' + '─'.repeat(inner) + '┘'));
    return out;
  };

  // ── LEFT COLUMN ──────────────────────────────────────────────────────
  const left = [];
  left.push(sectionHead('IDENTITY', LCOL));
  left.push(' Gender:       ' + escHTML(genderLabel || '') + '  ' + escHTML('(' + pronounLabel + ')'));   // #5: pronouns in parens beside gender
  left.push(' Orientation:  ' + escHTML(orLabel || ''));
  left.push(' Lives:        ' + (locObj ? escHTML(locObj.label) : span('warn', '(unspecified)')));
  // #4: location blurb removed (explanation) — just the LIVES line above.
  left.push('');

  left.push(sectionHead('STATS', LCOL));
  for (const k of STAT_KEYS) {
    const info = STAT_INFO[k];
    const v = statTotal(k);
    // #4: stat DESCRIPTION removed — name + value only, like the mockup.
    left.push(' ' + span('stat-name', pad('[' + info.short + '] ' + info.label, 19)) +
              span('stat-value', pad(String(v), 3)));
  }
  left.push('');

  if (bracket) {
    const _bl = (typeof AGE_BRACKET_LABELS !== 'undefined' && AGE_BRACKET_LABELS[bracket]) ? AGE_BRACKET_LABELS[bracket] : bracket;
    left.push(sectionHead('AGE — ' + _bl, LCOL));
    // #4: age flavor sentence removed (explanation) — keep only the modifiers line.
    const modParts = STAT_KEYS.filter(k => ageMods[k]).map(k => {
      const m = ageMods[k]; const txt = STAT_INFO[k].short + (m > 0 ? '+' : '') + m;
      return m > 0 ? span('ok', txt) : span('warn', txt);
    });
    if (modParts.length) left.push(' Modifiers: ' + modParts.join('  '));
    left.push('');
  }

  left.push(sectionHead('CLIQUE', LCOL));
  if (cliqueObj) {
    left.push(' ' + span('ok', '• ') + span('menu-item', cliqueObj.label));
    // #4: clique blurb removed (explanation) — just the clique name.
    if (cliqueObj.compatible && cliqueObj.compatible.length) {
      left.push('   ' + span('stat-name', padVis('compatible: ' + cliqueObj.compatible.join(', '), LCOL - 3)));
    }
  } else {
    left.push(' ' + span('warn', '(none — independent)'));
  }

  // ── RIGHT COLUMN ─────────────────────────────────────────────────────
  const right = [];
  right.push(sectionHead('HOBBIES (' + c.hobbies.length + ')', RCOL));
  if (!c.hobbies.length) {
    right.push(' ' + span('warn', '(none)'));
  } else {
    for (const hk of c.hobbies) {
      const h = HOBBIES.find(x => x.key === hk);
      if (!h) continue;
      const modParts = Object.entries(h.mods || {}).map(([k, v]) => {
        const txt = STAT_INFO[k].short + (v > 0 ? '+' : '') + v;
        return v > 0 ? span('ok', txt) : span('warn', txt);
      });
      const tail = modParts.length ? '  ' + modParts.join(' ') : '';
      right.push(' ' + span('ok', '• ') + span('menu-item', h.label) + tail);
    }
  }
  right.push('');

  right.push(sectionHead('ABILITIES (' + c.skills.length + ')', RCOL));
  if (!c.skills.length) {
    right.push(' ' + span('warn', '(none)'));
  } else {
    for (const s of c.skills) {
      const sk = SKILLS.find(x => x.key === s.key);
      if (!sk) continue;
      const costStr = (s.free || s.cost === 0)
        ? span('ok', '(FREE)')
        : (s.paidFromStat ? '(from ' + s.paidFromStat.toUpperCase() + ')' : '(' + s.cost + ' pts)');
      right.push(' ' + span('ok', '• ') + span('menu-item', sk.label) + '  ' + span('stat-name', costStr));
    }
  }
  right.push('');

  // EQUIPMENT — its own boxed container.
  let equipLines = [];
  if (typeof window !== 'undefined' && window.GameItems && (c.worn || c.pocket)) {
    const MI = window.GameItems;
    const rows = MI.describeWorn(c.worn || {});
    if (rows.length) {
      for (const r of rows) {
        equipLines.push(span('ok', '• ') + span('stat-name', pad(r.label + ':', 13)) + span('menu-item', r.name));
      }
    } else {
      equipLines.push(span('warn', '(nothing equipped)'));
    }
    const pocket = (c.pocket || []).map(id => (MI.byId[id] || {}).name).filter(Boolean);
    if (pocket.length) {
      equipLines.push('');
      equipLines.push(span('stat-name', 'Pockets: ') + span('menu-item', pocket.join(', ')));
    }
  } else {
    equipLines.push(span('warn', '(no equipment data)'));
  }
  boxed('EQUIPMENT', equipLines, RCOL).forEach(l => right.push(l));

  // ── ZIP THE TWO COLUMNS ──────────────────────────────────────────────
  const lines = [];
  lines.push('');
  // Banner across the full width.
  const banner = (c.name || '(unnamed)') + ', age ' + (c.age || '?');
  lines.push('   ' + span('accent', '╔' + '═'.repeat(TOT) + '╗'));
  const padN = Math.max(0, Math.floor((TOT - banner.length) / 2));
  lines.push('   ' + span('accent', '║') + ' '.repeat(padN) + span('title-text', banner) +
             ' '.repeat(Math.max(0, TOT - padN - banner.length)) + span('accent', '║'));
  lines.push('   ' + span('accent', '╚' + '═'.repeat(TOT) + '╝'));
  lines.push('');

  const rows = Math.max(left.length, right.length);
  for (let i = 0; i < rows; i++) {
    const l = padVis(left[i] || '', LCOL);
    const r = padVis(right[i] || '', RCOL);
    lines.push('   ' + l + ' '.repeat(GUT) + r);
  }

  // ── INVENTORY / QUESTS panels (Screenshot 3) ──────────────────────────
  // Two boxes across the bottom. Placeholders for now — the inventory and
  // quest SYSTEMS aren't built yet, so they read whatever data exists (none)
  // and otherwise show "(empty)". When those systems land, populate
  // c.inventory (items with .label/.flavor) and State.world.quests (with
  // .title/.detail) and this fills in automatically; the interactive
  // select-for-details modal is the next step once there's data to select.
  lines.push('');
  const half = Math.floor((TOT - GUT) / 2);
  const invItems = (State.character && Array.isArray(State.character.inventory)) ? State.character.inventory : [];
  const quests   = (State.world && Array.isArray(State.world.quests)) ? State.world.quests : [];
  const invLines = invItems.length ? invItems.map(it => ' ' + span('ok', '\u2022') + ' ' + (it.label || it.name || String(it))) : [' ' + span('stat-name', '(empty)')];
  const qLines   = quests.length ? quests.map(q => ' ' + span('ok', '\u2022') + ' ' + (q.title || q.name || String(q))) : [' ' + span('stat-name', '(no active quests)')];
  const invBox = boxed('INVENTORY', invLines, half);
  const qBox   = boxed('QUESTS', qLines, half);
  const pr = Math.max(invBox.length, qBox.length);
  for (let i = 0; i < pr; i++) {
    lines.push('   ' + padVis(invBox[i] || '', half) + ' '.repeat(GUT) + padVis(qBox[i] || '', half));
  }
  return lines.join('\n');
}


const Screens = {};
// ─── LOAD GAME ────────────────────────────────────────────────────────────
// Multi-slot picker. Lists every save (manual + autosave), newest first,
// with denormalized metadata so the player can see exactly what they'd be
// resuming before they pick. Commands:
//
//   1, 2, …       — load the save at that position
//   d 1, d 2, …   — delete the save at that position
//   back / b      — return to where you came from (title or pause menu)
//
// Display layout per row:
//
//   [ 1 ] AUTO  Tester · Day 2, 9:15 AM, Sun Jun 13, 1999 · Theatre Lobby
//               saved 2 minutes ago · arrived: Theatre Lobby
//
// "AUTO" / "SAVE" tag colors the row distinctly so manual saves stand out
// from autosaves at a glance.
Screens.LOAD = {
  render() {
    const list = listSaves();
    const lines = [header('LOAD GAME'), ''];
    if (list.length === 0) {
      // Preserve the original "empty projector room" flavor when there are
      // no saves on file at all.
      lines.push('   no saves on file.');
      lines.push('');
      lines.push('   the projector room is empty.  ribbons of unspooled film,');
      lines.push('   a single half-eaten box of Junior Mints.  nothing to load.');
      lines.push('');
      lines.push('');
      lines.push('   ' + '<span data-act="back" style="cursor:pointer">' + span('accent', '[ back ]') + '</span>    return to title');
      return lines.join('\n');
    }

    lines.push('   ' + span('stat-name', 'Newest first.  Type a number to load,  "d N" to delete,  "back" to cancel.'));
    lines.push('');

    const now = Date.now();
    const A   = (s) => span('accent', s);
    const W   = (s) => span('warn',   s);
    const D   = (s) => span('stat-name', s);

    list.forEach((s, i) => {
      const idx     = '[ ' + (i + 1) + ' ]';
      const tag     = s.isAutosave ? W('AUTO') : A('SAVE');
      const name    = s.meta.characterName || '(unnamed)';
      const inGame  = s.meta.inGameTime  || '—';
      const subLoc  = s.meta.subLocation || '—';
      const elapsed = _relativeTimeAgo(now - (s.savedAt || 0));
      const realTm  = new Date(s.savedAt || 0).toLocaleString();
      const reasonText = s.reason ? '  ·  ' + s.reason : '';

      lines.push('   ' + '<span data-act="' + (i + 1) + '" style="cursor:pointer">' + A(idx) + ' ' + tag + '  ' + escHTML(name) +
                 '  ·  ' + inGame + '  ·  ' + escHTML(subLoc) + '</span>');   // #19 clickable slot
      lines.push('         ' + D('saved ' + elapsed + '  (' + realTm + ')' + reasonText));
      lines.push('');
    });

    lines.push('   ' + '<span data-act="back" style="cursor:pointer">' + A('[ back ]') + '</span>    return');
    return lines.join('\n');
  },

  handle(text) {
    const t = (text || '').toLowerCase().trim();
    if (t === 'back' || t === 'b' || t === '') { sfx.back(); back(); return; }

    const list = listSaves();

    // "d N" or "delete N" — delete a specific save.
    const delMatch = t.match(/^(?:d|del|delete)\s+(\d+)$/);
    if (delMatch) {
      const n = parseInt(delMatch[1], 10);
      if (n < 1 || n > list.length) { sfx.error(); flash('No save #' + n + '.'); return; }
      deleteSlotById(list[n - 1].id);
      sfx.back(); flash('Save #' + n + ' deleted.'); render(); return;
    }

    // Numeric: load that save.
    const n = parseInt(t, 10);
    if (!isNaN(n) && n >= 1 && n <= list.length) {
      const blob = loadSlotById(list[n - 1].id);
      if (!blob) { sfx.error(); flash('Could not read save #' + n + '.'); return; }
      State.character = blob.character;
      if (blob.world)    Object.assign(State.world, blob.world);
      if (blob.eventLog) State.eventLog = blob.eventLog.slice();
      sfx.confirm();
      // The autosave tripwire compares to lastSaved* markers — reset them so
      // we don't immediately autosave on the first render after loading.
      State.world._autosaveMarks = {
        lastSavedSubLoc: State.world.subLocation || '',
        lastSavedDay:    State.world.dayNumber  || 0,
      };
      goto('GAME_PLACEHOLDER');
      return;
    }

    sfx.error();
    flash('Type a number, "d N" to delete, or "back".');
  }
};

// ── small helper: "N minutes/hours/days ago" formatting for the LOAD picker.
function _relativeTimeAgo(deltaMs) {
  if (!deltaMs || deltaMs < 0) return 'just now';
  const s = Math.floor(deltaMs / 1000);
  if (s < 45)            return 'just now';
  if (s < 90)            return 'a minute ago';
  const m = Math.floor(s / 60);
  if (m < 45)            return m + ' minutes ago';
  if (m < 90)            return 'an hour ago';
  const h = Math.floor(m / 60);
  if (h < 22)            return h + ' hours ago';
  const d = Math.floor(h / 24);
  if (d < 2)             return 'yesterday';
  if (d < 30)            return d + ' days ago';
  const mo = Math.floor(d / 30);
  if (mo < 12)           return mo + ' months ago';
  return Math.floor(mo / 12) + ' years ago';
}

// ─── HELP / MECHANICS ─────────────────────────────────────────────────────
// ─── HELP — INDEXED, MULTI-TOPIC, DATA-DRIVEN ─────────────────────────────
// The help system is a hub (HELP_MECHANICS) listing topics; each topic renders
// its own page. The character-data topics (Stats/Skills/Hobbies/Cliques) are
// generated from window.GameData (core/gameData.js), so they always reflect
// the real catalog — edit the data there and help updates itself. Type a topic
// number (or its name) to open it; [ back ] returns to the hub, then to game.
const HELP_TOPICS = [
  { key: 'stats',    title: 'Core Stats' },
  { key: 'pointbuy', title: 'Point-Buy & Age' },
  { key: 'skills',   title: 'Skills / Abilities' },
  { key: 'hobbies',  title: 'Hobbies' },
  { key: 'cliques',  title: 'Cliques' },
  { key: 'identity', title: 'Gender & Orientation' },
  { key: 'checks',   title: 'Checks & Luck' },
  { key: 'tokens',   title: 'Name & Pronoun Tokens' },
  { key: 'controls', title: 'Controls' },
  { key: 'tutorials', title: 'Replay a Tutorial  \u00BB' },
];

function _md() { return (typeof window !== 'undefined' && window.GameData) ? window.GameData : null; }

function _helpTopicBody(key) {
  const D = _md();
  const L = [];
  const R = (n) => '   ' + rule(n || 68, '-');
  if (key === 'stats') {
    L.push('   CORE STATS', R());
    if (D) D.STATS.forEach(s => L.push('   ' + pad('[' + s.short + '] ' + s.label, 18) + s.desc));
    L.push('', '   Luck is special: it is NOT rolled against a difficulty like the');
    L.push('   others — it biases how often good fortune comes your way (better');
    L.push('   random encounters, found cash, escaping bad luck).');
  } else if (key === 'pointbuy') {
    const r = D ? D.STAT_RULES : { base:5, pointBudget:12, pointBuyMax:9, min:1 };
    L.push('   POINT-BUY', R());
    L.push('   Every stat starts at ' + r.base + '. You have ' + r.pointBudget + ' points to spend, capped at');
    L.push('   ' + r.pointBuyMax + ' in any single stat from points alone. Leftover points become');
    L.push('   your skill budget. Age + hobby modifiers apply on top and can');
    L.push('   push a stat past ' + r.pointBuyMax + ' or below ' + r.base + ' (floor of ' + r.min + ').');
    L.push('', '   AGE MODIFIERS  (each age leans differently; roughly net-zero)', R());
    if (D && D.AGE_MODS) {
      Object.keys(D.AGE_MODS).forEach(ageKey => {
        const m = D.AGE_MODS[ageKey];
        const ups = [], downs = [];
        Object.keys(m).forEach(k => { if (k === 'flavor') return; if (m[k] > 0) ups.push('+' + k); else if (m[k] < 0) downs.push('-' + k); });
        L.push('   ' + pad(ageKey, 11) + pad(ups.join(' '), 26) + downs.join(' '));
      });
    }
  } else if (key === 'skills') {
    L.push('   SKILLS / ABILITIES', R());
    L.push('   Things you can DO. Each skill picked costs from your leftover');
    L.push('   stat budget (1, then 2, then 3 ... per skill). Some are GATED by');
    L.push('   stat minimums; some are GRANTED FREE by a hobby (e.g. Klepto');
    L.push('   gives Light Fingers). Listed alphabetically:');
    L.push('');
    if (D) D.SKILLS.slice().sort((a,b)=>a.label.localeCompare(b.label)).forEach(s => {
      L.push('   ' + span('bright', s.label));
      L.push('      ' + s.desc);
      if (s.gate && s.gate.note) L.push('      ' + span('dim', 'Requires: ' + s.gate.note));
    });
  } else if (key === 'hobbies') {
    L.push('   HOBBIES  (pick 1-3 at character creation)', R());
    L.push('   Who you are / what you are known for. They shift stats, lean your');
    L.push('   reputation with cliques, and some GRANT a free skill or LOCK you');
    L.push('   into a clique. Listed alphabetically:');
    L.push('');
    if (D) D.HOBBIES.slice().sort((a,b)=>a.label.localeCompare(b.label)).forEach(h => {
      const mods = Object.keys(h.mods||{}).map(k => (h.mods[k]>0?'+':'') + h.mods[k] + ' ' + k).join(', ');
      const grants = (h.grantsSkills && h.grantsSkills.length) ? ('  grants: ' + h.grantsSkills.join(', ')) : '';
      const lock = h.locksClique ? ('  locks: ' + h.locksClique) : '';
      L.push('   ' + span('bright', pad(h.label, 20)) + span('dim', mods));
      L.push('      ' + h.blurb + span('dim', grants + lock));
    });
  } else if (key === 'cliques') {
    L.push('   CLIQUES', R());
    L.push('   Social groups. They bias reputation gain/loss. You may pick none.');
    L.push('   Two compatible cliques can be paired later. Listed alphabetically:');
    L.push('');
    if (D) D.CLIQUES.slice().sort((a,b)=>a.label.localeCompare(b.label)).forEach(c => {
      const compat = (c.compatible && c.compatible.length) ? ('  pairs with: ' + c.compatible.join(', ')) : '';
      L.push('   ' + span('bright', pad(c.label, 16)) + c.blurb);
      if (compat) L.push('      ' + span('dim', compat.trim()));
    });
  } else if (key === 'identity') {
    L.push('   GENDER & ORIENTATION', R());
    L.push('   Set at character creation. They shape pronouns used throughout the');
    L.push('   game and which romance arcs open. No option is mechanically best.');
    L.push('');
    if (D) {
      L.push('   ' + span('bright', 'Genders:'));
      D.GENDERS.forEach(g => L.push('      ' + pad(g.label, 22) + span('dim', g.blurb)));
      L.push('');
      L.push('   ' + span('bright', 'Orientations:'));
      D.ORIENTATIONS.forEach(o => L.push('      ' + pad(o.label, 22) + span('dim', o.blurb)));
    }
  } else if (key === 'checks') {
    L.push('   CHECKS & LUCK', R());
    L.push('   When an action is uncertain, the game rolls your relevant stat');
    L.push('   against a difficulty. Higher stat = better odds. Some checks lean');
    L.push('   on a skill you have (which can open options others never see).');
    L.push('');
    L.push('   LUCK tilts outcomes in your favor over time rather than gating a');
    L.push('   single roll — think of it as how often things break your way.');
    L.push('');
    L.push('   ' + span('dim', '(Exact resolution numbers are still being tuned.)'));
  } else if (key === 'tokens') {
    L.push('   NAME & PRONOUN TOKENS', R());
    L.push('   Dialogue fills these in for your character automatically:');
    L.push('');
    if (typeof window !== 'undefined' && window.GameTokens && window.GameTokens.REFERENCE) {
      window.GameTokens.REFERENCE.player.forEach(t => L.push('   ' + pad(t.token, 12) + span('dim', t.desc)));
    } else {
      L.push('   [NAME]  your name      [THEY]/[THEM]/[THEIR]  your pronouns');
    }
    L.push('', '   Casing follows the token: [they] -> they, [They] -> They.');
  } else if (key === 'controls') {
    L.push('   CONTROLS', R());
    L.push('   In the 3D world:');
    L.push('      Arrows / WASD   move        G   interact / advance text        Space   jump');
    L.push('      Q / E           rotate cam  M       toggle minimap');
    L.push('      F               flashlight  C       compass');
    L.push('');
    L.push('   In the terminal: type a command or the number/word in brackets,');
    L.push('   then Enter.  [ back ] returns to the previous screen.');
  }
  return L;
}

Screens.HELP_MECHANICS = {
  render() {
    // Hub: list the topics. A selected topic is held in buffers.helpTopic.
    const topic = State.buffers.helpTopic;
    if (topic === 'tutorials') {
      // a replayable list of the hands-on tutorial lessons. Replaying does
      // NOT disturb a game in progress (it snapshots + restores the character).
      const lessons = (window.MultiplexTutorial && window.MultiplexTutorial.lessons) || [];
      const L = [header('HELP  ·  REPLAY A TUTORIAL'), ''];
      L.push('   Pick a lesson to play it again. Your current game is untouched —');
      L.push('   you return right here when you finish or press "back".');
      L.push('');
      lessons.forEach((l, i) => {
        L.push('   ' + span('accent', '[ ' + pad(String(i+1),2) + ' ]') + '  ' + l.title);
        L.push('         ' + span('dim', l.blurb));
      });
      L.push('');
      L.push('   ' + span('accent', '[ back ]') + '  topic list      ' + span('accent', '[ quit ]') + '  close help');
      return L.join('\n');
    }
    if (topic) {
      return header('HELP  ·  ' + (HELP_TOPICS.find(t => t.key === topic)?.title || topic).toUpperCase()) +
        '\n' + _helpTopicBody(topic).join('\n') +
        '\n\n   ' + span('accent', '[ back ]') + '  topic list      ' + span('accent', '[ quit ]') + '  close help';
    }
    const L = [header('HELP  ·  CHOOSE A TOPIC'), ''];
    L.push('   Type a number to read that section. Everything here reflects the');
    L.push('   current game data, so it stays accurate as the game grows.');
    L.push('');
    HELP_TOPICS.forEach((t, i) => L.push('   ' + span('accent', '[ ' + pad(String(i+1),2) + ' ]') + '  ' + t.title));
    L.push('');
    L.push('   ' + span('accent', '[ back ]') + '  return to where you were');
    return L.join('\n');
  },
  handle(text) {
    const t = (text || '').trim().toLowerCase();
    // Inside a topic: back -> hub; quit/done -> leave help entirely.
    if (State.buffers.helpTopic) {
      if (t === 'quit' || t === 'done' || t === 'exit') { State.buffers.helpTopic = null; this._leave(); return; }
      // tutorial-replay topic — a number launches that lesson (returns to Help).
      if (State.buffers.helpTopic === 'tutorials') {
        const lessons = (window.MultiplexTutorial && window.MultiplexTutorial.lessons) || [];
        const ln = parseInt(t, 10);
        if (t === 'back' || t === '') { State.buffers.helpTopic = null; sfx.back(); render(); return; }
        if (!isNaN(ln) && ln >= 1 && ln <= lessons.length) {
          const key = lessons[ln - 1].key;
          State.buffers.helpTopic = null;   // we'll come back to the topic list via returnScreen
          if (window.MultiplexTutorial && window.MultiplexTutorial.replayLesson) {
            window.MultiplexTutorial.replayLesson(key, 'HELP_MECHANICS');
            return;
          }
        }
        sfx.error && sfx.error(); render(); return;
      }
      State.buffers.helpTopic = null; sfx.back(); render(); return;
    }
    if (t === 'back' || t === '' || t === 'quit' || t === 'done') { this._leave(); return; }
    // Open a topic by number or by name.
    let topic = null;
    const n = parseInt(t, 10);
    if (!isNaN(n) && n >= 1 && n <= HELP_TOPICS.length) topic = HELP_TOPICS[n-1].key;
    else { const m = HELP_TOPICS.find(x => x.key === t || x.title.toLowerCase().startsWith(t)); if (m) topic = m.key; }
    if (topic) { State.buffers.helpTopic = topic; sfx.select && sfx.select(); render(); }
    else { sfx.error && sfx.error(); render(); }
  },
  _leave() {
    sfx.back();
    const ret = State.buffers.helpReturn;
    State.buffers.helpReturn = null;
    State.buffers.helpTopic = null;
    if (!ret) { MultiplexGame.hide(); return; }
    goto(ret);
  }
};
// ── DEBUG ROOM / EXTERNAL LAUNCHERS / LIVE MAP VIEW ──────────────────────
// Moved to core/debugroom.js (loads right after this file). That file defines
// LAUNCH_TARGETS, maybeOpenDebugRoom(), the map-view + minigame functions, the
// engine→host hooks, and Screens.DEBUG_ROOM / DEBUG_ROOM_MAP / DEBUG_MENU.

// Location screens (today just GAME_PLACEHOLDER, the lobby hub) live in
// core/locations/multiplex.js. See core/locations/_README.js for the pattern.
// The Day-1 arrival (WAKE_UP → parking lot → FIRST_SHIFT) is in core/tutorial.js.
// The shared isWinter / seasonLine / locFlavor / hasHobby / hasClique helpers
// used by every location screen live in core/locations/_helpers.js.

// ─── CHARACTER_SHEET (in-game info dump) ──────────────────────────────────
// Reachable via F3 hotkey, the ESC menu, or "sheet"/"character" command.
// Uses renderCharacterSheet() — same view as the chargen REVIEW screen.
// ─── EVENT LOG VIEWER ─────────────────────────────────────────────────────
// Full timestamped history of every logged event. Players reach this by
// typing `log` from any gameplay screen.
//
// On return, we go back to the screen they came from (State.logReturn).
Screens.EVENT_LOG = {
  render() {
    const log = State.eventLog || [];
    const lines = [
      header('EVENT LOG'),
      '',
      '   ' + span('stat-name', 'Oldest at top, newest at bottom. Cap is 200 entries.'),
      '',
    ];
    if (!log.length) {
      lines.push('   ' + span('stat-name', '(nothing logged yet)'));
    } else {
      // Oldest first — walk forward so newest ends up at the bottom of the
      // rendered list (matches the in-game LOG panel's scroll direction).
      for (let i = 0; i < log.length; i++) {
        const e = log[i];
        lines.push('   ' + span('accent', pad(e.time, 10)) + ' ' + (e.text || ''));
      }
    }
    lines.push('');
    lines.push('   ' + span('accent', '[ back ]') + '   return to the game');
    return lines.join('\n');
  },
  handle(text) {
    sfx.back();
    const ret = State.logReturn || 'GAME_PLACEHOLDER';
    State.logReturn = null;
    // If we came from a live map screen, use returnToScreen so the engine canvas
    // re-mounts and the overlays come back; otherwise a plain screen switch.
    if (typeof MAP_SCREENS !== 'undefined' && MAP_SCREENS.has(ret) && typeof returnToScreen === 'function') {
      returnToScreen(ret);
    } else {
      State.screen = ret; render();
    }
  }
};
Screens.CHARACTER_SHEET = {
  render() {
    const sheet = renderCharacterSheet();
    return [
      header('CHARACTER SHEET'),
      sheet,
      '',
      '   ' + span('accent', '[ back ]') + '  return to where you were  (or press F3 / ESC)',
    ].join('\n');
  },
  handle(text) {
    const t = text.trim().toLowerCase();
    if (t === 'back' || t === 'b' || t === '' || t === 'resume') {
      sfx.back();
      const ret = State.charSheetReturn;
      State.charSheetReturn = null;
      if (!ret) { MultiplexGame.hide(); return; }
      returnToScreen(ret);
      return;
    }
    sfx.error(); flash('Type "back" (or press F3 / ESC).');
  }
};
// ─── ESC_MENU (pause menu) ────────────────────────────────────────────────
// Triggered by ESC anywhere except the title. Saves the current screen in
// State.escReturn so dismissal returns the player exactly where they were.
//
// Options:
//   1. Resume                — close the menu
//   2. Settings              — open the settings screen
//   3. Save Game             — quick-save (only if a character exists)
//   4. Load Game             — open the load screen
//   5. Character Sheet       — open the in-game character sheet
//   6. Return to Main Menu   — go back to TITLE (loses unsaved progress)
//   7. Quit                  — go to QUIT screen
//   8. Debug / launchers     — open the DEBUG_MENU (minigames + Mapster)
//
Screens.ESC_MENU = {
  render() {
    const W = 44;
    const F = (s) => span('accent', s);
    const top = '   ' + F('╔' + '═'.repeat(W) + '╗');
    const bot = '   ' + F('╚' + '═'.repeat(W) + '╝');
    const inside = (s, accent=false) => {
      const padN = Math.floor((W - s.length) / 2);
      const wrapped = accent ? span('accent', s) : s;
      return '   ' + F('║') + ' '.repeat(padN) + wrapped +
             ' '.repeat(W - padN - s.length) + F('║');
    };
    const opt = (n, label) => {
      // Layout per row: '   ' + '[ N ]' + '  ' + label + trailing-spaces = W
      // → trailing = W - 3 - 5 - 2 - label.length = W - 10 - label.length
      const trailing = ' '.repeat(Math.max(0, W - 10 - label.length));
      return '   ' + F('║') + '   ' + '<span data-act="' + n + '" style="cursor:pointer">' + span('menu-number', '[ ' + n + ' ]') +
             '  ' + span('menu-item', label) + '</span>' + trailing + F('║');   // #19: clickable
    };
    const blank = '   ' + F('║') + ' '.repeat(W) + F('║');

    return [
      '', '', '',
      top,
      inside('PAUSED', true),
      '   ' + F('╠' + '═'.repeat(W) + '╣'),
      blank,
      opt('1', 'Resume'),
      opt('2', 'Settings'),
      opt('3', 'Save Game'),
      opt('4', 'Load Game'),
      opt('5', 'Character Sheet'),
      opt('6', 'Return to Main Menu'),
      opt('7', 'Quit'),
      ...(IS_DEMO_BUILD() ? [] : [opt('8', 'Debug / launchers')]),   // no dev launchers in the web demo
      blank,
      bot,
      '',
      '   Press ' + span('accent', 'ESC') + ' to resume',
    ].join('\n');
  },
  handle(text) {
    const t = text.trim().toLowerCase();
    if (t === '1' || t === 'resume' || t === 'back' || t === '') {
      sfx.back();
      const ret = State.escReturn;
      State.escReturn = null;
      if (!ret) { MultiplexGame.hide(); return; }
      returnToScreen(ret);
      return;
    }
    if (t === '2' || t === 'settings') { sfx.select(); goto('SETTINGS'); return; }
    if (t === '3' || t === 'save') {
      if (State.character && State.character.name) {
        saveSlot(); sfx.confirm(); flash('Saved.');
      } else { sfx.error(); flash('Nothing to save yet.'); }
      return;
    }
    if (t === '4' || t === 'load') { sfx.select(); goto('LOAD'); return; }
    if (t === '5' || t === 'character' || t === 'sheet') {
      if (!State.character || !State.character.name) {
        sfx.error(); flash('No character yet.'); return;
      }
      sfx.select(); State.charSheetReturn = State.escReturn;
      State.escReturn = null;
      goto('CHARACTER_SHEET'); return;
    }
    if (t === '6' || t === 'main' || t === 'menu') {
      sfx.back(); State.escReturn = null; MultiplexGame.hide(); return;
    }
    if (t === '7' || t === 'quit' || t === 'exit') {
      sfx.back(); State.escReturn = null; goto('QUIT'); return;
    }
    if ((t === '8' || t === 'debug' || t === 'dev') && !IS_DEMO_BUILD()) {
      // Open the debug menu; return here (or to wherever ESC was opened from)
      // when the player backs out of it.
      sfx.select();
      State.debugReturn = State.escReturn || 'GAME_PLACEHOLDER';
      State.escReturn = null;
      goto('DEBUG_MENU'); return;
    }
    sfx.error(); flash('Pick 1-8 (or "resume" / "back").');
  }
};
//
//───────────────────────────────────────────────────────────────────────────

// Section header used at the top of most non-title screens.
// The title is wrapped in the accent color class so it picks up the active
// color mode (yellow in 16-color, etc.).
function header(title) {
  const bar = '='.repeat(Math.min(72, title.length + 4));
  return [
    '',
    '   ' + span('accent', title),
    '   ' + span('accent', bar),
  ].join('\n');
}
// Append a small "<span class=accent>>></span> message" beneath the current
// frame. Useful for inline error/info that doesn't deserve a full re-render.
function flash(msg) {
  display.innerHTML = display.innerHTML +
    '\n\n   <span class="accent">&gt;&gt;</span> ' + escHTML(msg);
}
// Re-render the current screen and refresh the hotkey bar.
function render() {
  const screenObj = Screens[State.screen];
  if (!screenObj) { display.textContent = '?? unknown screen: ' + State.screen; return; }
  // the minimap + LOG overlays are HTML elements floated over the
  // grid; they were only repositioned/hidden from renderGameplayUI's rAF, which
  // never runs on NON-map screens — so the last map's minimap stuck around over
  // menus, chargen, everything. Hide them here whenever the current screen
  // isn't a map screen.
  if (typeof MAP_SCREENS !== 'undefined' && !MAP_SCREENS.has(State.screen)) {
    try {
      const mo = document.getElementById('minimap-overlay'); if (mo) mo.style.display = 'none';
      const lo = document.getElementById('log-overlay');     if (lo) lo.style.display = 'none';
    } catch (e) {}
  }
  display.innerHTML = screenObj.render();
  updateHotkeyBar();
  updateControlsBar();
  updateCommandTicker();   // #3: refresh the typed-command ticker
  // the "Press Enter to type" closed-prompt state only makes sense on MAP
  // screens, where movement/interaction keys must flow to the 3D game instead of
  // the prompt. On every other screen (chargen, menus, text screens) the prompt
  // is always OPEN so the player can just type — no Enter-to-type step. We don't
  // steal focus while a minigame iframe is up.
  if (!State.minigameActive) {
    const onMapScreen = (typeof MAP_SCREENS !== 'undefined') && MAP_SCREENS.has(State.screen);
    // Cursor-driven chargen screens behave like map screens here: prompt CLOSED so
    // keys reach the cursor, not the typing prompt.
    const keepPromptClosed = onMapScreen || !!cursorScreenObj();
    if (!keepPromptClosed && typeof PromptState !== 'undefined' && !PromptState.open) {
      try { PromptState.openPrompt(); } catch (e) {}
    } else if (keepPromptClosed && typeof PromptState !== 'undefined' && PromptState.open) {
      // On a map screen, start with the prompt CLOSED so WASD/Space reach the
      // game; the player presses Enter to type a command.
      try { PromptState.close(); } catch (e) {}
    }
  }

  // Body class flips so any per-screen CSS can latch on. Since the terminal
  // is only shown via MultiplexGame.show(), .in-game is on whenever the
  // terminal is visible. (We previously distinguished title vs in-game here;
  // title is now in core/title.js outside this DOM tree.)
  document.body.classList.add('in-game');

  // Refresh scroll indicators — content may have grown/shrunk. Defer to the
  // next animation frame so the browser has a moment to lay out the new DOM
  // before we measure scrollHeight.
  if (typeof updateScrollIndicators === 'function') {
    requestAnimationFrame(updateScrollIndicators);
  }
  // when the SCREEN changes, default to the bottom of the content (newest
  // text) so the player doesn't have to scroll down to see the latest. We only
  // do this on a genuine screen change — not on same-screen re-renders — so it
  // doesn't yank the view while the player is reading/scrolling up.
  if (State.screen !== render._lastScrolledScreen) {
    render._lastScrolledScreen = State.screen;
    if (typeof scrollToBottom === 'function') {
      requestAnimationFrame(scrollToBottom);
      setTimeout(scrollToBottom, 40);
    }
  }

  // ── AUTOSAVE TRIPWIRE ────────────────────────────────────────────────
  // Every gameplay screen sets State.world.subLocation at the top of its
  // render() (Theatre Lobby / Home / Commute / …). We check here whether
  // the sub-location or the day has changed since the last save and, if
  // so, fire an autosave. maybeAutosave() is self-gating — it bails out
  // for non-gameplay screens and when no real character is loaded — so
  // it's safe to call unconditionally from here.
  try { maybeAutosave(); } catch (e) {}
}

// Push the previous screen onto the history stack and switch.
//
// NOTE: The old behavior would re-start title music when MultiplexGame.hide() was
// called. Title is now owned by core/title.js — going "to title" means
// hiding the terminal entirely. If a screen wants that, it should call
// MultiplexGame.hide() (or back() from a screen with empty history).
// #2/#4: return from a PAUSE overlay (ESC menu, character sheet) WITHOUT going
// through goto()'s unmount tripwire. If we're returning to the live map screen,
// the engine canvas is still mounted — we just re-show it, refit it, restore the
// map-screen body class + keyboard focus, and resume music. This fixes the
// lockup where the map vanished and input died after opening the ESC menu.
function returnToScreen(ret) {
  State.screen = ret;
  const onMap = (typeof MAP_SCREENS !== 'undefined') && MAP_SCREENS.has(ret);
  // resume music that was paused when the overlay opened.
  try { if (Music.resume) Music.resume(); } catch (e) {}
  render();
  if (onMap) {
    document.body.classList.add('map-screen');
    const gc = document.getElementById('game-container');
    if (gc) gc.style.display = 'block';
    // REMOUNT the engine. goto() tears the canvas down when leaving
    // a map screen for an overlay (sheet/ESC), so coming back needs a real
    // mountMapCanvas(), not just a refit — without it the player returned to a
    // dead frame (no map, no input). mountMapCanvas() is idempotent (only
    // resizes if already mounted) and no-ops without State.mapData.
    try { if (typeof mountMapCanvas === 'function') mountMapCanvas(); } catch (e) {}
    // Refit the canvas to the (re-shown) panel a couple of frames out.
    const refit = () => { try { if (typeof positionMapContainer === 'function') positionMapContainer(); if (window.engineResize) window.engineResize(); } catch (e) {} };
    requestAnimationFrame(refit); setTimeout(refit, 80); setTimeout(refit, 200);
    // On map screens the prompt stays closed so movement keys flow; make sure
    // keyboard focus is on the document (not a stale element) so keys register.
    try { PromptState.close(); if (document.body.focus) document.body.focus(); } catch (e) {}
  }
}

function goto(screen) {
  if (State.screen !== screen) State.history.push(State.screen);
  // #12/#9: if we're leaving a live map screen for a non-map screen, tear the
  // engine canvas down so it doesn't linger behind menus.
  if (typeof MAP_SCREENS !== 'undefined' && MAP_SCREENS.has(State.screen) && !MAP_SCREENS.has(screen) && typeof unmountMapCanvas === 'function') {
    unmountMapCanvas();
    // #9/#7: hide the floated LOG + minimap overlays too.
    ['log-overlay', 'minimap-overlay'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
  }
  // the opening-crawl music plays only on the INTRO screen — stop it on
  // any navigation away (handle() also stops it, this is the safety net).
  if (screen !== 'INTRO') { try { if (window.CrawlMusic) window.CrawlMusic.stop(); } catch (e) {} }
  // clear any leftover text in the command prompt when changing screens, so
  // a keystroke from the previous screen (e.g. pressing "1" on the title) can't
  // bleed into the next screen's prompt.
  try { if (typeof input !== 'undefined' && input) input.value = ''; } catch (e) {}
  State.screen = screen;
  Music.stop();
  // Cursor-driven screens (e.g. ATTRIBUTES chargen) take keys directly, so close
  // the command prompt and reset the cursor to the top on entry.
  if (cursorScreenObj(screen)) {
    State.cg = { cur: 0 };
    try { if (typeof PromptState !== 'undefined') PromptState.close(); } catch (e) {}
  }
  render();
}

// Pop history; if there's no history left, return to the canvas title
// (handled by MultiplexGame.hide()).
//
// resetTitleIdle() used to live in the title-screen module; it no longer
// exists in this runtime, so we don't call it here.
function back() {
  const prev = State.history.pop();
  if (!prev) {
    // No prior screen — exit the terminal entirely.
    if (window.MultiplexGame && typeof MultiplexGame.hide === 'function') {
      MultiplexGame.hide();
    }
    return;
  }
  State.screen = prev;
  Music.stop();
  render();
}
//═══════════════════════════════════════════════════════════════════════════
// SAVE / LOAD / SETTINGS PERSISTENCE
//═══════════════════════════════════════════════════════════════════════════
//
// localStorage keys:
//   "mam.save.slot1"  → { character, world, savedAt }
//   "mam.settings"    → { color, display, audioMode, crt, statsHidden }
//
//───────────────────────────────────────────────────────────────────────────

//═══════════════════════════════════════════════════════════════════════════
// SAVE SYSTEM  (multi-slot, with autosave)
//═══════════════════════════════════════════════════════════════════════════
//
// STORAGE LAYOUT (localStorage — browser-managed, see ARCHITECTURE.md for the
// caveat about why this isn't actually files on disk in /save/):
//
//   mam.saves.manifest   — JSON array of save IDs, newest first
//   mam.save.<id>        — JSON blob for a single save (one entry per id)
//
// SAVE BLOB SHAPE:
//   {
//     id,                 // numeric timestamp at save creation (also the key suffix)
//     savedAt,            // Date.now() at save creation (same as id, kept for clarity)
//     isAutosave,         // true if this came from autosave()
//     reason,             // optional string ('new day', 'entered <area>', …)
//     character,          // full State.character snapshot
//     world,              // full State.world snapshot
//     eventLog,           // copy of State.eventLog
//     // Denormalized metadata for the LOAD screen — fast to list without
//     // having to deserialize the full character object:
//     meta: {
//       characterName,    // e.g. 'Tester'
//       inGameTime,       // 'Day 2, 9:15 AM, Sun Jun 13, 1999'
//       dayNumber,
//       subLocation,      // 'Theatre Lobby', 'Home', etc.
//       location,         // grid cell e.g. 'H3'
//     }
//   }
//
// CAPACITY: SAVE_CAP total saves. When we'd exceed it, we evict the OLDEST
// autosave first; only if no autosaves remain do we evict the oldest manual.
const SAVE_CAP = 20;
const SAVE_MANIFEST_KEY = 'mam.saves.manifest';
const SAVE_BLOB_PREFIX  = 'mam.save.';

// ── Manifest helpers ──────────────────────────────────────────────────────
function _readManifest() {
  try {
    const raw = localStorage.getItem(SAVE_MANIFEST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function _writeManifest(arr) {
  try { localStorage.setItem(SAVE_MANIFEST_KEY, JSON.stringify(arr)); } catch (e) {}
}

// One-time migration: if the legacy single-slot key exists and no manifest
// is present yet, convert the old save into the new format. Called once on
// boot from loadSettings()-adjacent code below.
function migrateLegacySave() {
  // Already migrated? Bail.
  if (_readManifest().length > 0) return;
  // Anything in localStorage from before the rewrite?
  let raw;
  try { raw = localStorage.getItem('mam.save.slot1'); } catch (e) { return; }
  if (!raw) return;
  let legacy;
  try { legacy = JSON.parse(raw); } catch (e) { return; }
  if (!legacy || !legacy.character) return;
  // Build a new-format blob from it.
  const id = legacy.savedAt || Date.now();
  const blob = {
    id, savedAt: legacy.savedAt || id,
    isAutosave: false,
    reason: 'migrated from legacy save',
    character: legacy.character,
    world:     legacy.world || {},
    eventLog:  [],
    meta: {
      characterName: (legacy.character && legacy.character.name) || '(no name)',
      inGameTime:    '—',
      dayNumber:     (legacy.world && legacy.world.dayNumber) || 1,
      subLocation:   (legacy.world && legacy.world.subLocation) || '',
      location:      (legacy.world && legacy.world.location) || '',
    },
  };
  try {
    localStorage.setItem(SAVE_BLOB_PREFIX + id, JSON.stringify(blob));
    _writeManifest([id]);
    localStorage.removeItem('mam.save.slot1');
  } catch (e) {}
}

// ── Public API ─────────────────────────────────────────────────────────────

// List all saves, newest first, as light metadata records suitable for the
// LOAD screen. Each entry: { id, savedAt, isAutosave, reason, meta }.
// (Full blob is fetched on demand via loadSlotById.)
function listSaves() {
  const ids = _readManifest();
  const result = [];
  for (const id of ids) {
    try {
      const raw = localStorage.getItem(SAVE_BLOB_PREFIX + id);
      if (!raw) continue;
      const blob = JSON.parse(raw);
      result.push({
        id:         blob.id,
        savedAt:    blob.savedAt,
        isAutosave: !!blob.isAutosave,
        reason:     blob.reason || '',
        meta:       blob.meta || {},
      });
    } catch (e) {}
  }
  // Defensive: sort by savedAt desc (the manifest should already be ordered
  // but a corrupted manifest shouldn't break the UI).
  result.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return result;
}

// Load a specific save by id. Returns the full blob, or null if missing.
function loadSlotById(id) {
  try {
    const raw = localStorage.getItem(SAVE_BLOB_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// Legacy entry-point used by MultiplexGame.resumeSavedGame and a few internal
// callers — returns the most recent save (autosave or manual), or null.
function loadSlot() {
  const list = listSaves();
  if (!list.length) return null;
  return loadSlotById(list[0].id);
}

// Delete a save by id. Removes both the blob and the manifest entry.
function deleteSlotById(id) {
  try { localStorage.removeItem(SAVE_BLOB_PREFIX + id); } catch (e) {}
  const m = _readManifest().filter(x => x !== id);
  _writeManifest(m);
}

// Internal: enforce SAVE_CAP by evicting from the tail of the manifest.
// We evict the OLDEST autosave first (scan manifest backwards looking for
// isAutosave === true). If no autosaves remain, evict the oldest entry of
// any kind. Idempotent — call until length <= SAVE_CAP.
function _enforceSaveCap() {
  let manifest = _readManifest();
  while (manifest.length > SAVE_CAP) {
    // Find oldest autosave (scan from the end of the array = oldest first).
    let victim = null;
    for (let i = manifest.length - 1; i >= 0; i--) {
      const id = manifest[i];
      let blob;
      try { blob = JSON.parse(localStorage.getItem(SAVE_BLOB_PREFIX + id) || 'null'); }
      catch (e) { blob = null; }
      if (blob && blob.isAutosave) { victim = id; break; }
    }
    // No autosaves to evict? Drop the oldest entry of any type.
    if (victim == null) victim = manifest[manifest.length - 1];
    deleteSlotById(victim);
    manifest = _readManifest();
  }
}

// Build the denormalized metadata for the LOAD picker. Pulls from current
// State, so call this at save time.
function _buildSaveMeta() {
  const c = State.character || {};
  const w = State.world || {};
  let inGameTime = '—';
  try {
    // formatTime/formatDate may throw if world isn't fully set yet — be tolerant.
    inGameTime = 'Day ' + (w.dayNumber || 1) + ', ' + formatTime() + ', ' + formatDate();
  } catch (e) {}
  return {
    characterName: c.name || '(no name)',
    inGameTime,
    dayNumber:     w.dayNumber || 1,
    subLocation:   w.subLocation || '',
    location:      w.location || '',
  };
}

// Create a new save. Options:
//   { manual: true }       — a player-initiated save (F2 / "save" command)
//   { isAutosave: true,    — an autosave triggered by the runtime
//     reason: '<text>' }
// Returns the new save's id, or null on failure.
function saveSlot(opts = {}) {
  // Nothing to save if the player hasn't created a character yet.
  if (!State.character || !State.character.name) return null;

  // ID needs to be strictly monotonic so two saves in the same millisecond
  // (e.g. an autosave triggered concurrently with the player hitting F2)
  // don't clobber each other. savedAt keeps the real wall-clock time for the
  // LOAD screen's "saved N minutes ago" math.
  const savedAt = Date.now();
  const prevId  = _readManifest()[0] || 0;
  const id      = (savedAt > prevId) ? savedAt : (prevId + 1);

  const blob = {
    id,
    savedAt,
    isAutosave: !!opts.isAutosave,
    reason: opts.reason || '',
    character: State.character,
    world:     State.world,
    eventLog:  State.eventLog || [],
    meta:      _buildSaveMeta(),
  };
  try {
    localStorage.setItem(SAVE_BLOB_PREFIX + id, JSON.stringify(blob));
  } catch (e) {
    // Storage quota? Try evicting and retry once.
    try {
      _enforceSaveCap();
      localStorage.setItem(SAVE_BLOB_PREFIX + id, JSON.stringify(blob));
    } catch (e2) { return null; }
  }
  // Prepend to manifest (newest first).
  const manifest = [id, ..._readManifest().filter(x => x !== id)];
  _writeManifest(manifest);
  _enforceSaveCap();

  // Update autosave-trip-wire markers so we don't immediately autosave again
  // on the same area / day.
  if (!State.world._autosaveMarks) State.world._autosaveMarks = {};
  State.world._autosaveMarks.lastSavedSubLoc = State.world.subLocation || '';
  State.world._autosaveMarks.lastSavedDay    = State.world.dayNumber || 0;
  return id;
}

//─── AUTOSAVE TRIGGERS ─────────────────────────────────────────────────────
// Called from advanceTime() (for day rollover) and from render() (for area
// transitions). The function itself is the gate: it only saves when there's
// something new to save (sub-location or day changed since the last save).
//
// To add a new autosave trigger, just call maybeAutosave('<reason>') from
// wherever the trigger fires.
function maybeAutosave() {
  // No character yet, or running pre-game (chargen)?  Bail.
  if (!State.character || !State.character.name) return;
  // We're not in a meaningful game screen (title canvas, chargen, etc.)? Bail.
  // Heuristic: only autosave when we're sitting on a gameplay screen.
  const okScreens = ['GAME_PLACEHOLDER'];
  if (!okScreens.includes(State.screen)) return;

  if (!State.world._autosaveMarks) State.world._autosaveMarks = {};
  const marks   = State.world._autosaveMarks;
  const curLoc  = State.world.subLocation || '';
  const curDay  = State.world.dayNumber || 0;

  let reason = '';
  if (marks.lastSavedDay && curDay > marks.lastSavedDay)      reason = 'new day (Day ' + curDay + ')';
  else if (curLoc && curLoc !== marks.lastSavedSubLoc)        reason = 'arrived: ' + curLoc;

  if (!reason) return;   // nothing worth autosaving
  saveSlot({ isAutosave: true, reason });
}

function saveSettings() {
  try { localStorage.setItem('mam.settings', JSON.stringify(State.settings)); } catch(e) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('mam.settings');
    if (raw) Object.assign(State.settings, JSON.parse(raw));
  } catch(e) {}
  // First-boot tasks that should run alongside settings load: convert any
  // legacy single-slot save into the new multi-slot format.
  try { migrateLegacySave(); } catch(e) {}
}

// Apply settings to the DOM (display class, CRT toggle, UI scale, window mode).
// NOTE: color modes were removed — body keeps the single 'color-16' class
// it was authored with. Do not strip 'color-16' here; the CSS hangs off it.
function applySettings() {
  document.body.classList.remove('display-standard','display-widescreen');
  document.body.classList.add('display-' + State.settings.display);

  document.body.classList.toggle('crt', State.settings.crt);

  // expose the FPS control scheme to the embedded engine (default crawler).
  try { window.fpsControlScheme = State.settings.fpsControlScheme || 'crawler'; } catch (e) {}
  // Mirror the diagnostics-overlay setting to the engine flag (F3 also flips it).
  try { window.__showDiag = !!State.settings.showDiagnostics; } catch (e) {}

  // New responsive sizing + windowing.
  applyDisplayScale();
  applyWindowMode();
}

//═══════════════════════════════════════════════════════════════════════════
// DISPLAY SCALING  (Settings → DISPLAY SCALE)
//═══════════════════════════════════════════════════════════════════════════
//
// The whole UI scales via a single CSS custom property, --ui-scale, set on
// :root. The CSS hangs the title canvas size and the terminal font size off
// that variable, so changing it scales everything in lockstep.
//
//   --ui-scale = N   →  title canvas = (384*N) × (288*N) px
//                       terminal font ≈ 10 + 2*N px (set via --term-font-size)
//
// Auto mode picks the largest integer N (2..6) that fits the current window.
// Manual mode (1..6) honors the user's pick regardless of window size — at
// scales too big for the window, the terminal scrolls and the title canvas
// gets cropped or scrolled. Min is 2 in auto, 1 in manual.
//
// To support new scales: nothing to change here, but UI_SCALE_OPTIONS in
// settings.js drives what the user sees in the OPTIONS menu.

// Compute the integer scale that best fits the current window. Always >= 2
// so the UI stays readable even on small screens (an 800×600 viewport gets
// scale 2, fitting the 768×576 title canvas with 16-32 px margin).
function computeAutoScale() {
  // Headroom: 16 px horizontal margin + 16 px vertical for breathing room.
  // The canvas dominates the title scene; the terminal is more elastic so
  // we size to the canvas footprint.
  const sx = Math.floor((window.innerWidth  - 16) / 384);
  const sy = Math.floor((window.innerHeight - 16) / 288);
  const fit = Math.min(sx, sy);
  return Math.max(2, Math.min(6, fit));
}

// Push the active scale to the DOM. Delegates to the DisplayManager module
// (core/display.js), which handles the richer fill/fit/manual/resolution
// modes. Kept as a named function because many call sites reference it.
function applyDisplayScale() {
  if (window.DisplayManager) { window.DisplayManager.apply(); return; }
  // Fallback (module missing): legacy integer-scale behavior.
  let scale;
  if (State.settings.displayScale === 'auto') {
    scale = computeAutoScale();
  } else {
    const n = parseInt(State.settings.displayScale, 10);
    scale = (n >= 1 && n <= 6) ? n : 2;
  }
  const fontPx = 8 + 3 * scale;
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  document.documentElement.style.setProperty('--term-font-size', fontPx + 'px');
}

// Re-evaluate auto-scale whenever the window resizes. (No-op when the user
// has picked a manual scale; recomputing then yields the same value anyway.)
window.addEventListener('resize', () => {
  if (State.settings.displayScale === 'auto') applyDisplayScale();
});

//═══════════════════════════════════════════════════════════════════════════
// WINDOW MODE  (Settings → WINDOW MODE)
//═══════════════════════════════════════════════════════════════════════════
//
// 'windowed'   — page runs inside the normal browser window (default).
// 'fullscreen' — page requests the browser Fullscreen API (same effect as
//                hitting F11): browser chrome and tabs vanish. Browsers
//                require a user gesture to grant fullscreen, so on first
//                page load this is deferred to the firstGesture handler.
//                When the setting is changed while the page is up, we are
//                already inside a user-gesture handler (keypress in the
//                Settings screen), so we can request immediately.

// True if we currently are in browser fullscreen.
function isFullscreen() {
  try { if (window.parent !== window && window.parent.document.fullscreenElement) return true; } catch (e) {}
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
// PORTFOLIO EDIT: in full screen, keep Esc for the game (cancel / back / pause menu) instead of
// letting the browser leave full screen on a tap; holding Esc still exits (Chrome and Edge).
document.addEventListener('fullscreenchange', () => {
  try {
    if (!navigator.keyboard || !navigator.keyboard.lock) return;
    if (document.fullscreenElement) navigator.keyboard.lock(['Escape']).catch(() => {});
    else navigator.keyboard.unlock();
  } catch (e) {}
});

// Try to enter fullscreen. Safe to call without a user gesture — if the
// browser rejects the request, we silently swallow the failure (the next
// gesture will retry from firstGesture or from the Settings handler).
function enterFullscreen() {
  // PORTFOLIO EDIT: embedded on the portfolio site, full screen goes through the page
  // (shared/demo-controls.js), which also keeps Esc for the game instead of leaving full screen.
  try {
    if (window.parent !== window && window.parent.DemoControls && window.frameElement) {
      const host = window.frameElement.parentElement;
      if (!window.parent.document.fullscreenElement) window.parent.DemoControls.toggleFullscreen(host);
      return null;
    }
  } catch (e) {}
  const el = document.documentElement;
  try {
    // requestFullscreen returns a Promise that REJECTS (not throws) when the
    // browser refuses — catch it so a refusal stays silent, as intended.
    const p = el.requestFullscreen ? el.requestFullscreen()
            : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return p;
  } catch (e) {}
}
function exitFullscreen() {
  try {
    if (document.exitFullscreen)          return document.exitFullscreen();
    if (document.webkitExitFullscreen)    return document.webkitExitFullscreen();
  } catch (e) {}
}

// Sync the browser fullscreen state to State.settings.windowMode. Called
// from applySettings(), from the settings handler, and from firstGesture.
function applyWindowMode() {
  const want = State.settings.windowMode === 'fullscreen';
  const have = isFullscreen();
  if (want && !have)      enterFullscreen();
  else if (!want && have) exitFullscreen();
}
//═══════════════════════════════════════════════════════════════════════════
// AUDIO MODE CYCLING (F6 hotkey + Settings menu)
//═══════════════════════════════════════════════════════════════════════════
const AUDIO_MODE_ORDER = ['all', 'music-off', 'sounds-off', 'mute'];

function cycleAudioMode() {
  const i = AUDIO_MODE_ORDER.indexOf(State.settings.audioMode);
  State.settings.audioMode = AUDIO_MODE_ORDER[(i + 1) % AUDIO_MODE_ORDER.length];
  saveSettings();
  // sfx may be muted now; queue a "select" only if sounds are on
  sfx.select();
  // Music: if it just turned on while on title screen, kick it off; if off, stop it.
  // Title music is owned by core/title.js now — when the terminal is up,
  // we just stop in-game music if needed.
  if (!State.settings.music) Music.stop();
  updateHotkeyBar();
  // Re-render in case the SETTINGS screen is open and showing the mode label
  if (State.screen === 'SETTINGS') render();
}
//═══════════════════════════════════════════════════════════════════════════
// FULLSCREEN HOTKEY (F11 or hotkey bar click target)
//═══════════════════════════════════════════════════════════════════════════
// Browsers: requestFullscreen on documentElement; exitFullscreen on document.
function toggleFullscreen() {
  // PORTFOLIO EDIT: embedded, the page owns full screen (see enterFullscreen)
  try {
    if (window.parent !== window && window.parent.DemoControls && window.frameElement && window.parent.document.fullscreenElement) {
      window.parent.document.exitFullscreen(); return;
    }
  } catch (e) {}
  if (!document.fullscreenElement) {
    enterFullscreen();   // (swallows the rejection when fullscreen isn't allowed, e.g. an iframe without allow="fullscreen")
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}
//═══════════════════════════════════════════════════════════════════════════
// INPUT HANDLING
//═══════════════════════════════════════════════════════════════════════════
//
// Two layers:
//   1. The text input (Enter submits, letters click-clack)
//   2. Document-level keydown for hotkeys (F2/F4/F6/F8/F11)
//
//───────────────────────────────────────────────────────────────────────────

//═══════════════════════════════════════════════════════════════════════════
// COMMAND HISTORY
//═══════════════════════════════════════════════════════════════════════════
//
// Bash-style line history. Pressing Enter pushes the line onto the history
// stack (skipping consecutive duplicates and empty lines). Up/Down arrows
// walk through it. When the user starts editing, we stash the in-progress
// draft so Down past the newest entry restores it.
//
// HOW TO TUNE:
//   - HISTORY_MAX caps how many entries we keep.
//   - To persist history across reloads, save/load CommandHistory.entries.

const HISTORY_MAX = 100;

const CommandHistory = {
  entries: [],          // newest at the END
  cursor: -1,           // -1 = "not navigating"; otherwise index into entries
  draft: '',            // in-progress text saved when starting to navigate

  // Push a new line. Skip empties and exact-duplicate of last entry.
  push(line) {
    if (!line) return;
    const last = this.entries[this.entries.length - 1];
    if (last === line) return;
    this.entries.push(line);
    if (this.entries.length > HISTORY_MAX) this.entries.shift();
    this.cursor = -1;
    this.draft = '';
  },

  // Up arrow — walk to an older entry. Returns the string to set, or null.
  prev(currentInput) {
    if (!this.entries.length) return null;
    if (this.cursor === -1) {
      this.draft = currentInput;
      this.cursor = this.entries.length - 1;
    } else if (this.cursor > 0) {
      this.cursor--;
    }
    return this.entries[this.cursor];
  },

  // Down arrow — walk to a newer entry, or back to the in-progress draft.
  next() {
    if (this.cursor === -1) return null;
    if (this.cursor < this.entries.length - 1) {
      this.cursor++;
      return this.entries[this.cursor];
    }
    // Past the newest; restore draft and exit history mode.
    this.cursor = -1;
    const d = this.draft;
    this.draft = '';
    return d;
  },

  // Reset navigation cursor (called when user types into the input).
  resetCursor() { this.cursor = -1; this.draft = ''; },
};
// Text input
input.addEventListener('keydown', (e) => {
  // #6/#10: swallow the keystroke that launched the terminal (e.g. the "1" from
  // the title menu) for a brief window so it doesn't land in the input.
  if (State._swallowInputUntil && Date.now() < State._swallowInputUntil) {
    if (e.key && e.key.length === 1) { e.preventDefault(); input.value = ''; if (typeof syncInputWidth === 'function') syncInputWidth(); return; }
  }
  // Don't let the global hotkey handler swallow F-keys typed here
  // (it won't, because F-keys have key.length > 1, see below)
  if (e.key === 'Enter') {
    // Enter runs the command (if any) AND closes the prompt. Closing the
    // prompt frees unmodified keys (WASD/arrows) for map movement once real
    // maps are integrated. An empty Enter just closes without doing anything.
    // #3 FIX: stop the event here so it doesn't bubble to the document-level
    // "Enter opens the prompt" handler, which would instantly reopen it.
    e.preventDefault();
    e.stopPropagation();
    const value = input.value;
    if (value.trim() !== '') {
      CommandHistory.push(value.trim());
      input.value = '';
      // typing the debug keyword at ANY prompt opens the debug room. This
      // is intercepted here (the single chokepoint every screen's typed command
      // passes through) so it works from in-game, chargen, or the story crawl.
      if (typeof maybeOpenDebugRoom === 'function' && maybeOpenDebugRoom(value)) {
        PromptState.close();
        return;
      }
      Screens[State.screen].handle(value);
    }
    PromptState.close();
    return;
  }
  if (e.key === 'Escape') { e.preventDefault(); input.value = ''; PromptState.close(); return; }
  // Note: "back" is typed as a command (or you can press F10 globally).
  // Backspace is intentionally NOT a back hotkey — too easy to hit while
  // typing.
  if (e.key === 'ArrowUp') {
    e.preventDefault(); e.stopPropagation();   // #4: keep the recall ours
    const recall = CommandHistory.prev(input.value);
    if (recall != null) {
      input.value = recall;
      if (typeof syncInputWidth === 'function') syncInputWidth();   // #1: widen the input or the recalled text stays clipped to 0ch (invisible)
      // Move caret to end.
      setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
    }
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault(); e.stopPropagation();   // #4
    const recall = CommandHistory.next();
    if (recall != null) {
      input.value = recall;
      if (typeof syncInputWidth === 'function') syncInputWidth();   // #1
      setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
    }
    return;
  }
  if (e.key.length === 1) {
    // User typed a real character — drop history navigation cursor so the
    // line they're editing is "current" again.
    CommandHistory.resetCursor();
    sfx.type();   // single-char keys click-clack
  }
});

// ─── COMMAND PROMPT OPEN/CLOSE ──────────────────────────────────────
// The prompt is a modal text entry: CLOSED by default so unmodified keys are
// free for map movement (WASD/arrows) once real maps are integrated; pressing
// ENTER opens it and focuses the input; pressing ENTER again (with or without
// text) runs the command and closes it. Escape also closes.
const PromptState = {
  open: false,
  _line: document.getElementById('prompt-line'),
  openPrompt() {
    this.open = true;
    if (this._line) this._line.classList.remove('prompt-closed');
    input.focus();
    try { window.__worldPaused = true; } catch (e) {}   // #13: typing a command pauses the world
    if (typeof syncInputWidth === 'function') syncInputWidth();
    setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
  },
  close() {
    this.open = false;
    this._closedAt = Date.now();
    if (this._line) this._line.classList.add('prompt-closed');
    input.blur();
    // #13: resume the world (unless an in-game modal is still holding the pause).
    try { window.__worldPaused = !!(typeof window.__anyModalOpen === 'function' && window.__anyModalOpen()); } catch (e) {}
  },
  toggle() { this.open ? this.close() : this.openPrompt(); }
};
// Start closed.
PromptState.close();
// let the embedded engine know when the command prompt is open (the player
// is typing), so it can swallow movement/camera keys instead of also reacting to
// the letters being typed. (See engine _keydownHandler.)
window.__hostPromptOpen = () => PromptState.open;

// #: TAB-AWAY / TAB-BACK RECOVERY. Returning to the tab can leave the command
// <input> focused (so chargen arrows/Enter type into the box instead of driving
// the cursor) or leave a movement key "stuck" (its keyup was eaten while the
// window was unfocused). On regaining focus/visibility: if we're NOT mid-command,
// blur the input so the global keydown handler drives chargen/gameplay again, and
// tell the engine to drop any held keys.
function _tabReturnRecovery() {
  try { if (!PromptState.open && document.activeElement === input) input.blur(); } catch (e) {}
  try { if (window.engineClearKeys) window.engineClearKeys(); } catch (e) {}
}
window.addEventListener('focus', _tabReturnRecovery);
document.addEventListener('visibilitychange', () => { if (!document.hidden) _tabReturnRecovery(); });

// Keep the command prompt usable: clicking the terminal opens + focuses it,
// but we no longer FORCE focus at all times — when closed, keys flow to the
// game (movement, hotkeys). The input's blur no longer auto-refocuses.
document.addEventListener('mousedown', (e) => {
  // Prevent text-selection drag from stealing focus when the prompt is open.
  if (PromptState.open && e.target !== input) e.preventDefault();
});
document.addEventListener('click', (e) => {
  // auto-fullscreen also needs to fire on a MOUSE-driven start (clicking a
  // title menu item), not just the first keydown. Browsers only grant fullscreen
  // inside a user gesture, so prime it here too.
  if (!State._fsPrimed) {
    State._fsPrimed = true;
    try { if (State.settings && State.settings.windowMode === 'fullscreen' && !isFullscreen()) enterFullscreen(); } catch (err) {}
  }
  // a click should NOT open the command prompt (players reported it firing
  // like an Enter). Keys flow to the game/navigation when the prompt is closed.
  // The prompt only opens when the player clicks the PROMPT LINE itself, or via
  // Enter on screens that accept typing.
  if (State.minigameActive) return;
  // Cursor-driven screen (ATTRIBUTES chargen): a click on a [data-cg] element (a
  // stat [-]/[+], an ability row, or a footer button) routes to the screen's mouse
  // handler instead of opening the prompt.
  {
    const cs = cursorScreenObj();
    if (cs && cs.onClick) {
      const cgEl = e.target && e.target.closest && e.target.closest('[data-cg]');
      if (cgEl) { e.preventDefault(); cs.onClick(cgEl.getAttribute('data-cg')); return; }
    }
  }
  // #3: clicking a ticker word opens the command prompt pre-filled with it, so
  // the player can run it (Enter) or edit it — informational + actionable, and
  // never fires a destructive command on a single misclick.
  {
    const tkEl = e.target && e.target.closest && e.target.closest('[data-tk]');
    if (tkEl) {
      e.preventDefault(); e.stopPropagation();
      const word = tkEl.getAttribute('data-tk') || '';
      try {
        if (typeof PromptState !== 'undefined') PromptState.openPrompt();
        if (typeof input !== 'undefined' && input) {
          input.value = word;
          if (typeof syncInputWidth === 'function') syncInputWidth();
          setTimeout(() => { try { input.focus(); input.setSelectionRange(word.length, word.length); } catch (e2) {} }, 0);
        }
      } catch (e3) {}
      return;
    }
  }
  // #19: MENU items carry data-act="<command>"; a click routes that command to the
  // active screen's handle(), so the typed menus (pause, load, game-over, quit, …)
  // are fully mouse-drivable too. (Cursor screens above already use data-cg.)
  {
    const actEl = e.target && e.target.closest && e.target.closest('[data-act]');
    if (actEl) {
      const scr = Screens[State.screen];
      if (scr && typeof scr.handle === 'function') { e.preventDefault(); e.stopPropagation(); scr.handle(actEl.getAttribute('data-act')); return; }
    }
  }
  const onPromptLine = e.target && (e.target === input ||
    (e.target.closest && e.target.closest('#prompt-line')));
  if (onPromptLine && !PromptState.open && !(typeof window.__anyModalOpen === 'function' && window.__anyModalOpen())) PromptState.openPrompt();
});
// (No forced refocus on window focus / input blur — the prompt can be closed.)
// ─── Scroll indicators ──────────────────────────────────────────────────
// Show/hide the fixed top/bottom scroll markers depending on whether there's
// content scrolled off-screen above or below. Called from scroll/resize
// events AND from render() so content changes pick up immediately.
function updateScrollIndicators() {
  const up   = document.getElementById('scroll-up');
  const down = document.getElementById('scroll-down');
  if (!up || !down) return;
  const docH = document.documentElement.scrollHeight;
  const winH = window.innerHeight;
  const y    = window.scrollY || window.pageYOffset || 0;
  // the fixed bottom stack (prompt + controls + F-keys) covers ~120px of the
  // viewport, so content is only truly "all visible" when the remaining scroll
  // distance is within that covered band.
  const BOTTOM_COVER = 128;
  up.classList.toggle('visible', y > 10);
  down.classList.toggle('visible', (docH - winH - y) > (BOTTOM_COVER + 6));
}
// jump the view to the bottom of the content (newest text), so the player
// doesn't have to scroll down to see the latest. Called after each render.
function scrollToBottom() {
  try { window.scrollTo(0, document.documentElement.scrollHeight); } catch (e) {}
}
window.addEventListener('scroll', updateScrollIndicators);
window.addEventListener('resize', updateScrollIndicators);
// Global hotkey handler
document.addEventListener('keydown', (e) => {
  // FULLSCREEN FALLBACK — browsers only grant fullscreen from inside a user
  // gesture. The title menu-select usually provides that, but to be robust we
  // also try once on the first keydown anywhere if the setting wants fullscreen
  // and we're not in it yet.
  if (!State._fsPrimed) {
    State._fsPrimed = true;
    try { if (State.settings && State.settings.windowMode === 'fullscreen' && !isFullscreen()) enterFullscreen(); } catch (err) {}
  }
  // while a minigame iframe is open, the host must ignore keys entirely so
  // they reach the minigame (and the prompt never opens over it).
  if (State.minigameActive) return;
  // Cursor-driven screen (ATTRIBUTES chargen): route keys to its cursor handler
  // before any prompt/hotkey logic, so arrows/Enter drive the cursor (not history
  // or prompt-open). onKey returns true when it consumed the key.
  {
    const cs = cursorScreenObj();
    if (cs && !PromptState.open && cs.onKey(e)) { e.preventDefault(); return; }
  }
  // when the prompt is CLOSED, Enter opens it (and we stop here so the
  // keypress doesn't also get treated as a game control). When open, the
  // input's own handler deals with Enter, so we ignore it here.
  if (e.key === 'Enter' && !PromptState.open) {
    // Guard against the same Enter that just CLOSED the prompt immediately
    // reopening it (focus/bubble race). PromptState stamps _closedAt on close.
    if (PromptState._closedAt && (Date.now() - PromptState._closedAt) < 250) return;
    // #12: if you're answering an in-game modal (a pickup prompt, the shop, a
    // dialogue…), the Enter is for THAT — don't also open the command prompt.
    if (typeof window.__anyModalOpen === 'function' && window.__anyModalOpen()) return;
    e.preventDefault();
    PromptState.openPrompt();
    return;
  }
  // TYPE-TO-COMMAND on text-only screens. On a screen that is driven purely by
  // typed commands (WAKE_UP, FIRST_SHIFT, the intro crawl, …) there's nothing
  // else a bare letter could mean, so the first printable key OPENS the prompt
  // and becomes the first letter of the command. Without this, a new player's
  // typing silently went nowhere until they discovered "press Enter first"
  // (and every other command got swallowed after Enter closed the prompt).
  // Map screens are excluded on purpose — there, letters are movement/camera
  // keys (WASD, Q/E, T, V, X, G…) and Enter-to-type stays the rule.
  if (!PromptState.open && typeOpensPrompt(e)) {
    e.preventDefault();
    PromptState.openPrompt();
    input.value += e.key;
    CommandHistory.resetCursor();
    if (typeof syncInputWidth === 'function') syncInputWidth();
    sfx.type();
    return;
  }
  // F2 — Save
  if (e.key === 'F2') {
    e.preventDefault();
    if (State.character && State.character.name) {
      saveSlot(); sfx.confirm(); flash('Saved.');
    } else {
      sfx.error(); flash('Nothing to save yet.');
    }
    return;
  }
  // F3 — Character sheet (in-game). Toggles open/closed.
  if (e.key === 'F3') {
    e.preventDefault();
    if (State.screen === 'CHARACTER_SHEET') {
      // dismiss back to where we came from (or to title if we somehow lost it)
      sfx.back();
      const ret = State.charSheetReturn;
      State.charSheetReturn = null;
      if (!ret) { MultiplexGame.hide(); return; }
      returnToScreen(ret);   // same path as "back" — remounts map screens
    } else if (State.character && State.character.name) {
      State.charSheetReturn = State.screen;
      sfx.select();
      goto('CHARACTER_SHEET');
    } else {
      sfx.error(); flash('No character yet.');
    }
    return;
  }
  // F4 — Load (jumps to LOAD screen)
  if (e.key === 'F4') {
    e.preventDefault();
    sfx.select();
    goto('LOAD');
    return;
  }
  // F6 — cycle audio mode
  if (e.key === 'F6') {
    e.preventDefault();
    cycleAudioMode();
    return;
  }
  // F7 — toggle minimap (only meaningful in-game). The setting is persisted
  // so the player's preference survives reloads.
  if (e.key === 'F7') {
    e.preventDefault();
    if (!State.screen || State.screen === 'QUIT') return;
    State.settings.minimapHidden = !State.settings.minimapHidden;
    saveSettings();
    sfx.select();
    render();
    return;
  }
  // F9: open the full EVENT LOG from any in-game screen (PORTFOLIO EDIT).
  if (e.key === 'F9') {
    e.preventDefault();
    if (!State.screen || State.screen === 'QUIT') return;
    if (State.screen === 'EVENT_LOG') { Screens.EVENT_LOG.handle('back'); return; }
    if (!State.character || !State.character.name) { sfx.error(); flash('Nothing logged yet.'); return; }
    if (PromptState.open) PromptState.close();
    State.logReturn = State.screen;
    sfx.select();
    goto('EVENT_LOG');
    return;
  }
  // L — open the full EVENT LOG. Only on a live map screen and only when
  // the command prompt isn't open (so typing 'l' in a command doesn't fire it).
  if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const onMap = (typeof MAP_SCREENS !== 'undefined') && MAP_SCREENS.has(State.screen);
    const promptOpen = (typeof PromptState !== 'undefined') && PromptState.open;
    if (onMap && !promptOpen) {
      e.preventDefault();
      State.logReturn = State.screen;
      sfx.select();
      goto('EVENT_LOG');
      return;
    }
  }
  // F8 — toggle stats partition (only meaningful in-game)
  if (e.key === 'F8') {
    e.preventDefault();
    // F8 only matters in-game. Skip on QUIT goodbye and when no screen is set.
    if (!State.screen || State.screen === 'QUIT') return;
    State.settings.statsHidden = !State.settings.statsHidden;
    saveSettings();
    sfx.select();
    render();
    return;
  }
  // F10 — universal "back" hotkey. Sends a "back" command to the current
  // screen's handle() function. Each screen interprets that in context (go
  // back a chargen step, exit a sub-menu, etc.). Disabled on the title
  // screen, since there's nowhere to go back to.
  if (e.key === 'F10') {
    e.preventDefault();
    // F10 is a universal "back" — no-op when terminal isn't active.
    if (!State.screen) return;
    sfx.back();
    Screens[State.screen].handle('back');
    return;
  }
  // F11 — fullscreen
  if (e.key === 'F11') {
    e.preventDefault();
    sfx.select();
    toggleFullscreen();
    return;
  }
  // ESC — pause / settings menu (anywhere except TITLE and QUIT)
  if (e.key === 'Escape') {
    e.preventDefault();
    // If a minigame is currently embedded, ESC closes it (same as the
    // "Return" button in the overlay top bar).
    if (State.minigameActive) {
      closeMinigame();
      return;
    }
    if (State.screen === 'ESC_MENU') {
      // dismiss back to where we came from
      sfx.back();
      const ret = State.escReturn;
      State.escReturn = null;
      if (!ret) { MultiplexGame.hide(); return; }
      returnToScreen(ret);
    } else if (State.screen === 'CHARACTER_SHEET') {
      // dismiss the sheet (same behavior as F3)
      sfx.back();
      const ret = State.charSheetReturn;
      State.charSheetReturn = null;
      if (!ret) { MultiplexGame.hide(); return; }
      returnToScreen(ret);
    } else {
      State.escReturn = State.screen;
      sfx.select();
      State.screen = 'ESC_MENU';
      // PAUSE music rather than stop it, so it resumes on return.
      try { if (window.CrawlMusic && window.CrawlMusic.playing) { State._musicWasPlaying = true; } } catch (e) {}
      if (Music.pause) Music.pause(); else Music.stop();
      render();
    }
    return;
  }
});
//═══════════════════════════════════════════════════════════════════════════
// ANIMATION TICK
//═══════════════════════════════════════════════════════════════════════════
//
// Drives the title screen's animated bits. While on TITLE, increment
// animFrame and re-render. On other screens we stay still — saves CPU.
//
//───────────────────────────────────────────────────────────────────────────

// The original animation tick re-rendered the TITLE screen for blinking
// bulbs, popcorn motion, ICEE swirl, etc. That title screen is now owned by
// core/title.js (canvas-based), and the terminal here never shows a title.
// We keep the tick alive — and the State.animFrame counter — in case any
// future in-game screen needs cheap periodic redraws. To re-enable, wrap a
// `if (State.screen === 'MY_ANIMATED_SCREEN') render();` here.
setInterval(() => {
  State.animFrame++;
  // (no auto-render — every in-game screen is currently static)
}, 150);

// ─── QUIT  ───────────────────────────────────────────────────────────────
// Reached from the title-screen menu (slot 6) and from the in-game ESC menu
// (option 7). Just a "lights come up" goodbye; typing "back" returns to title.
//
// Style note: the original used center(s, TITLE_WIDTH). We kept TITLE_WIDTH
// defined in the helpers area for any centered text screens that want it.
const TITLE_WIDTH = 92;

// ─── #28: HP / FALL DAMAGE / GAME OVER  (temporary system — will be retuned) ──
// The engine carries no HP of its own; it routes damage OUT via enginePlayerHurt
// → window.engineOnPlayerDamage. We own HP here on State.world.hp (+ .hpMax),
// apply incoming damage, and drop to GAME OVER when it reaches 0. HP lazy-inits
// to the character's maxHp the first time damage lands, so existing saves and the
// gameplay UI (which already defaults the bar to full) keep working untouched.
// TUNING: damage amounts live at the SOURCE (fall = 3/floor in engine.js; glass
// shards via their shard meta). Death threshold + the screen options are below.
window.engineOnPlayerDamage = function (amount, reason) {
  State.world = State.world || {};
  if (typeof State.world.hpMax !== 'number') State.world.hpMax = (State.character && +State.character.maxHp) || 10;
  if (typeof State.world.hp !== 'number') State.world.hp = State.world.hpMax;
  const amt = Math.max(0, +amount || 0);
  if (!amt) return;
  State.world.hp = Math.max(0, State.world.hp - amt);
  try { if (window.playerContext) window.playerContext.hp = State.world.hp; } catch (e) {}   // keep dialogue-runtime HP in step
  try { sfx.error(); } catch (e) {}
  if (State.world.hp <= 0) { State.world.hp = 0; setTimeout(function () { try { goto('GAME_OVER'); } catch (e) {} }, 0); }   // defer so the engine frame that dealt the blow finishes first
  else { try { render(); } catch (e) {} }   // refresh the HP bar in the side panel
};

// Engine → LOG panel. The engine reports pickups etc. here; logEvent() alone only
// records the entry, so re-render to show it in the side panel right away.
window.engineLogEvent = function (text) {
  logEvent(text);
  try { render(); } catch (e) {}
};

// GAME OVER — reached when HP hits 0. Three ways out, mirroring LOAD/QUIT:
//   1 back to title · 2 reload the most recent save · 3 quit.
Screens.GAME_OVER = {
  render() {
    return [
      '', '',
      center('\u2014  GAME OVER  \u2014', TITLE_WIDTH),
      '',
      center('the house lights snap on. someone calls for a manager.', TITLE_WIDTH),
      '', '',
      center('<span data-act="1" style="cursor:pointer">' + span('accent', '[ 1 ]') + '  back to title</span>', TITLE_WIDTH),   // #19 clickable
      center('<span data-act="2" style="cursor:pointer">' + span('accent', '[ 2 ]') + '  load last save</span>', TITLE_WIDTH),
      center('<span data-act="3" style="cursor:pointer">' + span('accent', '[ 3 ]') + '  quit</span>', TITLE_WIDTH),
    ].join('\n');
  },
  handle(text) {
    const t = (text || '').toLowerCase().trim();
    if (t === '1' || t === 'title') { sfx.select(); MultiplexGame.hide(); return; }
    if (t === '2' || t === 'load') {
      const blob = (typeof loadSlot === 'function') ? loadSlot() : null;
      if (!blob) { sfx.error(); flash('No save to load.'); return; }
      State.character = blob.character;
      if (blob.world) Object.assign(State.world, blob.world);
      if (blob.eventLog) State.eventLog = blob.eventLog.slice();
      if (typeof State.world.hpMax !== 'number') State.world.hpMax = (State.character && +State.character.maxHp) || 10;
      if (typeof State.world.hp !== 'number' || State.world.hp <= 0) State.world.hp = State.world.hpMax;   // never resume already-dead
      State.world._autosaveMarks = { lastSavedSubLoc: State.world.subLocation || '', lastSavedDay: State.world.dayNumber || 0 };
      try { syncPlayerContext(); if (window.playerContext) window.playerContext.hp = State.world.hp; } catch (e) {}
      sfx.confirm();
      goto('GAME_PLACEHOLDER');
      return;
    }
    if (t === '3' || t === 'quit') { sfx.back(); State.escReturn = null; goto('QUIT'); return; }
    sfx.error();
  }
};

Screens.QUIT = {
  render() {
    return [
      '',
      '',
      center('the lights come up.', TITLE_WIDTH),
      center('the screen flickers and goes black.', TITLE_WIDTH),
      '',
      center('thanks for stopping by.', TITLE_WIDTH),
      '',
      '',
      center('<span data-act="back" style="cursor:pointer">[ click or type "back" to return to title ]</span>', TITLE_WIDTH),   // #19 clickable
    ].join('\n');
  },
  handle(text) {
    if (text.toLowerCase().trim() === 'back' || text.trim() === '') {
      sfx.select();
      MultiplexGame.hide();
    }
  }
};

//═══════════════════════════════════════════════════════════════════════════
// BOOT  —  exposed as MultiplexGame for the host page (midmulti.html)
//═══════════════════════════════════════════════════════════════════════════
//
// The terminal-based runtime no longer auto-renders. The host page
// (midmulti.html) is responsible for:
//   1) Showing the canvas-based title screen (core/title.js) first.
//   2) When the player picks a menu item (1 NEW / 2 LOAD / 3 SETTINGS / etc.),
//      calling MultiplexGame.show(screenName) — that hides the canvas, shows
//      the terminal, and goes to the requested screen.
//   3) When the player taps "back" from the SETTINGS / CREDITS / LOAD / QUIT
//      screens (or otherwise wants to return to title), the host can call
//      MultiplexGame.hide() to swap back to the canvas.
//
// What still happens on this script's first run:
//   - Persisted settings are loaded.
//   - DOM body classes are set (display/crt).
//   - All event listeners (input, hotkeys, scroll, blur traps) are wired.
//   - AudioContext is initialised on the first user gesture.
// What does NOT happen until show() is called:
//   - No render() — the #display starts empty.

loadSettings();
applySettings();

// First user-gesture handler — needed because browsers block audio AND
// fullscreen requests until then. On the first key/click we (1) start the
// AudioContext, (2) honor the saved windowMode (entering fullscreen if set).
function firstGesture() {
  ensureAudio();
  // If the user previously chose FULLSCREEN, this is our first chance to
  // honor that without the browser blocking the request.
  if (State.settings.windowMode === 'fullscreen' && !isFullscreen()) {
    enterFullscreen();
  }
}
window.addEventListener('keydown', firstGesture, { once: true });
window.addEventListener('click',   firstGesture, { once: true });

// CLEAN SLATE BETWEEN RUNS. Returning to the title (MultiplexGame.hide) or
// starting a New Game must not leave the previous run's live 3D map behind:
// mountMapCanvas() reuses an already-mounted engine, so the NEXT parking lot /
// tutorial room silently kept the OLD world (key already in your pocket, doors
// already open, lessons never loading — "just an empty hallway"). Tear the map
// down and forget the per-run tutorial / wake-up state.
function resetRunState() {
  try { if (typeof unmountMapCanvas === 'function') unmountMapCanvas(); } catch (e) {}
  try { if (window.engineClearKeys) window.engineClearKeys(); } catch (e) {}
  try { if (window.setSceneWords) window.setSceneWords([]); } catch (e) {}
  ['log-overlay', 'minimap-overlay', 'tut-moveon'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
  document.body.classList.remove('map-screen');
  window.engineOnExitReached = null;
  window.__tutExitPromptOpen = false;
  State.tut = null;
  State._wake = null;
  State._demoEndHinted = false;
}

// Public API surfaced for midmulti.html to drive the in-game runtime.
// ─── PLAYER CONTEXT + TEXT TOKENS ──────────────────────────────────────────
// Build the runtime playerContext from the chargen character so the dialogue
// runtime, the engine, and token resolution all see the live player. Crucially
// this EXPANDS hobby-granted skills into the skills array (e.g. a Klepto
// character's skills include 'light_fingers'), which is what the dialogue
// runtime checks. Call syncPlayerContext() whenever the character changes.
function buildPlayerContext(c) {
  c = c || State.character || {};
  const MD = window.GameData;
  // Skills the character picked, plus any auto-granted by their hobbies.
  const picked = (c.skills || []).map(s => (typeof s === 'string' ? s : s.key)).filter(Boolean);
  const granted = (MD && MD.grantedSkillsFor) ? MD.grantedSkillsFor(c.hobbies || []) : [];
  const skills = Array.from(new Set([...picked, ...granted]));
  // Gender key: 'other' uses the typed customGender for display, but the
  // canonical condition key stays 'other'.
  return {
    name: c.name || '',
    stats: Object.assign({}, c.stats || {}),
    hp: (typeof c.hp === 'number') ? c.hp : (typeof c.maxHp === 'number' ? c.maxHp : 10),
    maxHp: (typeof c.maxHp === 'number') ? c.maxHp : 10,
    skills: skills,
    hobbies: (c.hobbies || []).slice(),
    cliques: [c.clique, c.secondClique].filter(Boolean),
    items: (c.items || []).map(i => (typeof i === 'string' ? i : i.key)).filter(Boolean),
    gender: c.gender || '',
    customGender: c.customGender || '',
    orientation: c.orientation || '',
    romance: c.romance || {},
    appearance: c.appearance || {},
    // #10/#12: worn equipment + pocket gear + skin tone so the in-game 3D
    // model (engine.js) dresses the player from their actual clothing.
    worn: c.worn || null,
    pocket: (c.pocket || []).slice(),
    skin: (c.appearance && c.appearance.skin) || '#ffccaa',
  };
}
// Push the current character into window.playerContext (read by tokens.js,
// dialogueRuntime.js, engine.js). Safe to call often.
function syncPlayerContext() {
  window.playerContext = buildPlayerContext(State.character);
  // #28: seed the world HP pool from the character the first time, so the
  // side-panel HP bar reads the real max immediately (the damage system would
  // otherwise lazy-init it only on the first hit). Never clobbers a value
  // already present — e.g. HP carried in from a loaded save.
  State.world = State.world || {};
  // #G/#F: seed the full vitals (HP, stamina, restedness, starting cash) from the
  // modular progression baselines. Non-clobbering, so loaded saves are untouched.
  if (window.Progression && typeof window.Progression.initVitals === 'function') {
    try { window.Progression.initVitals(State.character); } catch (e) {}
  }
  if (typeof State.world.hpMax !== 'number') State.world.hpMax = window.playerContext.maxHp || 10;
  if (typeof State.world.hp !== 'number') State.world.hp = State.world.hpMax;
  return window.playerContext;
}
// Convenience: resolve [NAME]/[THEY]/{npc.*} tokens in any game text against
// the live player (+ optional named actors). Screens can call
// MultiplexGame.fillTokens('...[NAME]...') when printing copy.
function fillTokens(text, actors) {
  if (!window.GameTokens) return text;
  syncPlayerContext();
  return window.GameTokens.resolve(text, { player: window.playerContext, actors: actors || {} });
}

window.MultiplexGame = {
  // Switch into the terminal at a particular screen. Most common entry points:
  //   show('INTRO')         — start a fresh chargen flow
  //   show('LOAD')          — load-save picker (Continue from title)
  //   show('SETTINGS')      — open settings
  //   show('CREDITS')       — open credits
  //   show('HELP_MECHANICS')— open the help screen
  //   show('QUIT')          — the "lights come up" goodbye screen
  show(screenName) {
    document.body.classList.add('terminal-active');
    // entering the game from the title menu is a user gesture, so this is
    // the moment the browser will honor a fullscreen request. Apply the window
    // mode here (default 'fullscreen') so the game auto-fullscreens on start.
    try { applyWindowMode(); } catch (e) {}
    // Reset history so the "back" command returns to the title.
    State.history = [];
    State.screen = screenName;
    updateHotkeyBar();
    render();
    // #6/#10: the keystroke that launched the terminal (e.g. pressing "1" on the
    // title menu) is still propagating this same event-loop tick, so clearing the
    // input now is undone when that "1" lands in the freshly-focused field. We
    // (a) set a brief input-swallow window so the triggering key is ignored, and
    // (b) clear + open the prompt on the next tick, after that key has settled.
    State._swallowInputUntil = Date.now() + 350;
    try { if (typeof input !== 'undefined' && input) input.value = ''; } catch (e) {}
    // Cursor-driven screens (merged chargen ATTRIBUTES/STATS/SKILLS) take keys
    // directly, so DON'T open the prompt for them — keep it closed and reset the
    // cursor, same as goto() does.
    if (cursorScreenObj()) {
      State.cg = { cur: 0 };
      try { PromptState.close(); } catch (e) {}
    } else {
      PromptState.openPrompt();
    }
    const settle = () => {
      try { if (typeof input !== 'undefined' && input) input.value = ''; } catch (e) {}
      if (typeof syncInputWidth === 'function') syncInputWidth();
      // Reassert open prompt on non-map screens (chargen/menus) — but NOT on
      // cursor-driven screens, which must stay closed for the cursor.
      if (!MAP_SCREENS.has(State.screen) && !cursorScreenObj()) { try { PromptState.openPrompt(); } catch (e) {} }
    };
    setTimeout(settle, 0);
    setTimeout(settle, 60);
    setTimeout(settle, 200);
  },
  // Resume the most recently saved game. Returns true if a save existed and
  // was resumed; false if there was nothing on disk. The host can decide what
  // to show if false (an error toast, or just open LOAD as a fallback).
  resumeSavedGame() {
    const saved = loadSlot();
    if (!saved) return false;
    State.character = saved.character;
    if (saved.world) Object.assign(State.world, saved.world);
    syncPlayerContext();
    this.show('GAME_PLACEHOLDER');
    return true;
  },
  // Hide the terminal (revealing whatever the host shows when terminal is
  // not active — typically the title canvas). Stops in-game audio.
  hide() {
    document.body.classList.remove('terminal-active');
    resetRunState();   // leaving to the title ends the run (no live map left behind)
    Music.stop();
    // #3: hide() reveals the title canvas again, so bring the title theme
    // back (it was silenced when a menu item was chosen). start() is a no-op
    // if it's somehow already playing.
    try { if (window.TitleMusic) window.TitleMusic.start(); } catch (e) {}
  },
  // Expose the in-game state object so the host can introspect (e.g. to
  // know whether a save exists for "LOAD GAME" menu UX).
  State,
  Screens,
  hasSave() { return loadSlot() !== null; },
  // Text tokens: resolve [NAME]/[THEY]/{npc.*} against the live player.
  fillTokens,
  syncPlayerContext,
};
