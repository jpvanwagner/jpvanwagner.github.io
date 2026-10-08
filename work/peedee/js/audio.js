'use strict';
/* ============================== AUDIO (all synthesized, no files) ============================== */
const AudioSys = (() => {
  let ac = null, master, sfxBus, musBus, noiseBuf, song = null, step = 0, nextT = 0, timer = null;
  let muted = store.get('pdd-muted') === '1';
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = 0.14; musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (song) startSeq();
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

  /* ---- tiny step sequencer: each token is an 8th note, '.' = rest ---- */
  const SONGS = {
    main: { bpm: 140,
      lead: 'E5 . G5 . C6 . G5 E5 A5 . C6 . A5 . E5 . F5 . A5 . C6 . A5 F5 G5 . B5 . D6 . B5 G5 E5 G5 C6 E6 D6 C6 B5 G5 A5 C6 E6 C6 A5 . G5 . F5 A5 C6 F6 E6 C6 A5 . G5 . D6 . B5 . C6 .',
      bass: 'C3 . C4 . G2 . C4 . A2 . A3 . E2 . A3 . F2 . F3 . C3 . F3 . G2 . G3 . D3 . G3 .' },
    back: { bpm: 132,
      lead: 'F5 . A5 . C6 . A5 F5 G5 . A#5 . D6 . A#5 G5 A5 . C6 . F6 . C6 A5 G5 . E5 . C5 . . . F5 A5 C6 A5 F5 . E5 . D5 F5 A#5 F5 D5 . C5 . A4 C5 F5 C5 A4 . A#4 . C5 . E5 . G5 . C6 .',
      bass: 'F2 . F3 . C3 . F3 . G2 . G3 . D3 . G3 . F2 . F3 . C3 . F3 . C3 . C4 . G2 . C4 .' },
    cave: { bpm: 108,
      lead: 'A4 . . C5 . . E5 . . . D5 . C5 . B4 . F4 . . A4 . . C5 . . . B4 . G#4 . E4 . A4 . C5 E5 A5 . G5 . F5 . E5 . D5 . . . F4 . A4 . D5 . C5 . B4 . G#4 . B4 . E5 .',
      bass: 'A2 . . A2 . . A2 . G2 . . G2 . . G2 . F2 . . F2 . . F2 . E2 . . E2 . . E2 .' },
    tongue: { bpm: 150,
      lead: 'D5 F#5 A5 F#5 D6 . A5 . B4 D5 G5 D5 B5 . G5 . A4 C#5 E5 C#5 A5 . E5 . D5 . F#5 . A5 . D6 . F#5 A5 D6 A5 F#5 . E5 . G5 B5 D6 B5 G5 . F#5 . E5 A5 C#6 A5 E5 . G5 . F#5 . E5 . D5 . . .',
      bass: 'D3 . D4 . A2 . D4 . G2 . G3 . D3 . G3 . A2 . A3 . E3 . A3 . D3 . D4 . A2 . D4 .' },
    boss: { bpm: 160,
      lead: 'E5 E5 G5 E5 B5 A5 G5 F#5 E5 E5 G5 E5 C6 B5 A5 B5 E5 E5 G5 E5 B5 A5 G5 F#5 G5 F#5 E5 D5 E5 . . .',
      bass: 'E2 E3 E2 E3 E2 E3 E2 E3 C2 C3 C2 C3 C2 C3 C2 C3 D2 D3 D2 D3 D2 D3 D2 D3 B1 B2 B1 B2 B1 B2 B1 B2' }
  };
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const freq = n => { const m = /^([A-G])(#?)(\d)$/.exec(n); if (!m) return 0; return 440 * Math.pow(2, (12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] ? 1 : 0) - 69) / 12); };
  const parsed = {};
  for (const k in SONGS) parsed[k] = { bpm: SONGS[k].bpm, lead: SONGS[k].lead.split(/\s+/), bass: SONGS[k].bass.split(/\s+/) };
  function startSeq() {
    if (!ac || timer) return;
    nextT = ac.currentTime + 0.06;
    timer = setInterval(() => {
      if (!song || !ac) return;
      const sp = 60 / song.bpm / 2;
      while (nextT < ac.currentTime + 0.15) {
        const when = nextT - ac.currentTime;
        const ln = song.lead[step % song.lead.length], bn = song.bass[step % song.bass.length];
        if (ln && ln !== '.') tone('square', freq(ln), 0, sp * 0.85, 0.32, when, musBus);
        if (bn && bn !== '.') tone('triangle', freq(bn), 0, sp * 0.95, 0.75, when, musBus);
        if (step % 2 === 1) noise(0.03, 0.12, 7000, when, 0, musBus);
        step++; nextT += sp;
      }
    }, 30);
  }
  return {
    init,
    play(name, a) { if (ac && S[name]) S[name](a); },
    music(name) {
      const next = name ? parsed[name] : null;
      if (next === song) return;
      song = next; step = 0;
      if (!song) { clearInterval(timer); timer = null; return; }
      if (ac) { clearInterval(timer); timer = null; startSeq(); }
    },
    get muted() { return muted; },
    toggle() {
      muted = !muted; store.set('pdd-muted', muted ? '1' : '0');
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ac.currentTime, 0.02);
      return muted;
    },
    duck(on) { if (musBus) musBus.gain.setTargetAtTime(on ? 0.05 : 0.14, ac.currentTime, 0.1); }
  };
})();
