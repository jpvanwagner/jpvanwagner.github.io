'use strict';
/* ============================== AUDIO ==============================
   Sound effects are synthesized on the spot. Music is ZzFXM songs in music/*.js (edit them in the ZzFXM
   Tracker), each fetched and rendered the first time it's needed. */
const AudioSys = (() => {
  let ac = null, master, sfxBus, musBus, noiseBuf;
  let muted = store.get('pdd-muted') === '1';
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = 0.6; musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (wanted) startSong(wanted);
  }
  function tone(type, f0, f1, dur, vol, when, bus) {
    if (!ac) return;
    const t = ac.currentTime + (when || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, freq, when, f1, bus) {
    if (!ac) return;
    const t = ac.currentTime + (when || 0);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t); s.stop(t + dur + 0.02);
  }
  const arp = (notes, gap, type, vol, dur) => notes.forEach((f, i) => tone(type || 'square', f, 0, dur || 0.12, vol || 0.08, i * gap));
  const S = {
    jump: () => tone('square', 260, 560, 0.12, 0.09),
    squish: v => { tone('sine', 240, 90, 0.18, 0.12 + Math.min(0.1, v * 0.02)); noise(0.1, 0.05, 500); },
    boing: () => { tone('triangle', 300, 640, 0.08, 0.13); tone('triangle', 640, 420, 0.12, 0.08, 0.08); },
    tap: () => noise(0.05, 0.06, 1800),
    drop: () => tone('triangle', 500, 200, 0.12, 0.08),
    shoot: () => { tone('square', 1300, 520, 0.08, 0.05); tone('sine', 2200, 1200, 0.05, 0.04); },
    ping: () => tone('triangle', 1800, 2400, 0.06, 0.06),
    hit: () => tone('square', 420, 120, 0.08, 0.08),
    pop: () => { tone('square', 500, 1400, 0.07, 0.07); noise(0.12, 0.08, 2400); },
    hurt: () => { tone('sawtooth', 320, 80, 0.26, 0.11); noise(0.12, 0.06, 900); },
    clean: p => tone('sine', 480 + p * 7, 0, 0.05, 0.05),
    fixed: () => arp([523, 659, 784, 1047], 0.07),
    gem: () => { tone('square', 1320, 0, 0.05, 0.045); tone('square', 1760, 0, 0.08, 0.045, 0.05); },
    mint: () => arp([660, 880, 1100, 1320], 0.06, 'triangle', 0.1),
    splash: () => { noise(0.45, 0.2, 1400, 0, 250); tone('sine', 420, 90, 0.3, 0.09); },
    zap: () => { noise(0.18, 0.1, 3200); tone('sawtooth', 140, 60, 0.2, 0.07); },
    blip: () => tone('square', 880 + Math.random() * 120, 0, 0.03, 0.025),
    select: () => { tone('square', 660, 0, 0.05, 0.06); tone('square', 990, 0, 0.07, 0.06, 0.05); },
    warn: () => tone('square', 230, 0, 0.09, 0.05),
    spit: () => { noise(0.14, 0.09, 700, 0, 200); tone('sine', 300, 150, 0.12, 0.06); },
    roar: () => { noise(1.0, 0.22, 380, 0, 110); tone('sawtooth', 110, 52, 1.0, 0.1); },
    stomp: () => { tone('square', 140, 60, 0.18, 0.12); noise(0.2, 0.14, 300); },
    boom: () => { noise(0.7, 0.28, 900, 0, 60); tone('square', 120, 38, 0.55, 0.11); },
    crumble: () => { noise(0.5, 0.18, 1200, 0, 180); arp([392, 523, 659], 0.08, 'triangle', 0.08); },
    clear: () => arp([523, 659, 784, 659, 784, 1047], 0.1, 'square', 0.08, 0.14),
    over: () => arp([392, 330, 262, 196], 0.22, 'triangle', 0.14, 0.26),
    win: () => arp([523, 523, 523, 659, 784, 659, 784, 1047, 1047], 0.11, 'square', 0.08, 0.16),
    fill: () => tone('square', 200 + Math.random() * 600, 0, 0.03, 0.03),
    charge: () => tone('sawtooth', 120, 900, 0.6, 0.05),
    laser: () => { tone('sawtooth', 900, 300, 0.9, 0.06); noise(0.9, 0.06, 2600, 0, 900); },
    sizzle: () => noise(0.25, 0.07, 4200, 0, 1800),
    hiss: () => noise(0.6, 0.16, 5200, 0, 2400),
    bloop: () => tone('sine', 260, 520, 0.09, 0.07),
    boop: () => tone('sine', 520, 780, 0.06, 0.06),
    squeak: () => { tone('square', 1200, 2400, 0.12, 0.05); tone('square', 2400, 1600, 0.12, 0.05, 0.12); },
    nope: () => { tone('square', 200, 0, 0.08, 0.06); tone('square', 150, 0, 0.12, 0.06, 0.09); },
    special: () => { noise(0.5, 0.12, 2400, 0, 600); arp([523, 784, 1047, 1568], 0.05, 'square', 0.08, 0.12); }
  };

  /* ---- music: ZzFXM songs, one file per tune in music/, fetched the first time they're needed ---- */
  const SONG_FILES = { main: 'bite-club', cave: 'tartarus', back: 'dark-side-of-the-molar', tongue: 'tongue-fu', boss: 'boss' };
  const loaded = {};               // name -> Promise of { left, right, loopEnd } (rendered once, then reused)
  let wanted = null, current = null;
  // The tracker saves "short JSON" (empty slots, numbers like .5); this is the same clean-up its loader does.
  const parseSong = text => JSON.parse(text.trim()
    .replace(/\[,/g, '[null,').replace(/,,\]/g, ',null]').replace(/,\s*(?=[,\]])/g, ',null')
    .replace(/([\[,]-?)(?=\.)/g, '$10').replace(/-\./g, '-0.'), (k, v) => v === null ? undefined : v);
  function loadSong(name) {
    if (!loaded[name] && location.protocol === 'file:') {     // opened straight from disk: browsers won't let a page read music/
      if (!loadSong.told) { loadSong.told = true; console.info('Music is off when the game is opened from disk; serve the folder over http(s) to hear it.'); }
      return Promise.reject(new Error('file://'));
    }
    if (!loaded[name]) loaded[name] = fetch('music/' + SONG_FILES[name] + '.js')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(text => {
        const [instruments, patterns, sequence, bpm] = parseSong(text);
        const [left, right] = zzfxM(instruments, patterns, sequence, bpm);
        const rows = sequence.reduce((n, p) => n + patterns[p][0].length - 2, 0);     // the loop point, before the last notes ring out
        return { left, right, loopEnd: rows * (zzfxR / bpm * 60 >> 2) / zzfxR };
      })
      .catch(e => { delete loaded[name]; console.info('Music "' + name + '" is unavailable (the game needs to be served over http(s) to load music/ files).', e); throw e; });
    return loaded[name];
  }
  function startSong(name) {
    if (!ac || !name || !SONG_FILES[name]) return;
    loadSong(name).then(data => {
      if (wanted !== name || !ac || (current && current.name === name)) return;
      stopSong();
      const buf = ac.createBuffer(2, data.left.length, zzfxR);
      buf.getChannelData(0).set(data.left); buf.getChannelData(1).set(data.right);
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = Math.min(data.loopEnd, buf.duration);
      g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(1, ac.currentTime + 0.25);
      src.connect(g); g.connect(musBus); src.start();
      current = { name, src, g };
    }, () => {});
  }
  function stopSong() {
    if (!current || !ac) { current = null; return; }
    const { src, g } = current, t = ac.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    src.stop(t + 0.22); current = null;
  }
  return {
    init,
    play(name, a) { if (ac && S[name]) S[name](a); },
    music(name) {
      wanted = name || null;
      if (!wanted) { stopSong(); return; }
      if (current && current.name === wanted) return;
      startSong(wanted);
    },
    preload(name) { if (SONG_FILES[name]) loadSong(name).catch(() => {}); },   // fetch + render ahead of time
    get muted() { return muted; },
    get playing() { return current ? current.name : null; },     // which song is on (for testing)
    toggle() {
      muted = !muted; store.set('pdd-muted', muted ? '1' : '0');
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ac.currentTime, 0.02);
      return muted;
    },
    duck(on) { if (musBus) musBus.gain.setTargetAtTime(on ? 0.22 : 0.6, ac.currentTime, 0.1); }
  };
})();
