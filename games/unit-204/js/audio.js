'use strict';
/* ============================== AUDIO ==============================
   Recorded sounds (Kenney, CC0) play through plain <audio> elements, which also work when the game is opened
   straight from disk. They're embedded in js/sounds.js (free Neocities accounts don't accept audio files). The shutter, beeps, pencil, tape measure and lounge music are synthesized with Web Audio. */
const Audio2 = {
  ctx: null, sfxBus: null, musicBus: null, files: {}, amb: null, steps: null, musicOn: false, nextBar: 0, bar: 0, unlocked: false,
  FILES: { click: ['click-a', .55], click2: ['click-b', .55], tick: ['tick', .25], chime: ['chime', .7], thud: ['thud', .9], swish: ['swish', .45], ratchet: ['ratchet', .5] },
  src(file) { return (typeof SOUNDS !== 'undefined' && SOUNDS[file]) || 'assets/audio/' + file + '.mp3'; },   // embedded (js/sounds.js) first
  init() {
    for (const [k, [file, vol]] of Object.entries(this.FILES)) { const a = new Audio(this.src(file)); a.preload = 'auto'; this.files[k] = { a, vol }; }
    this.amb = new Audio(this.src('city-ambience')); this.amb.loop = true; this.amb.preload = 'auto';
    this.steps = new Audio(this.src('footsteps')); this.steps.loop = true; this.steps.preload = 'auto';
  },
  unlock() {                       // browsers only allow sound after the first click
    if (this.unlocked) return; this.unlocked = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
      const verb = this.ctx.createConvolver(); verb.buffer = this.impulse(1.6); this.verb = this.ctx.createGain(); this.verb.gain.value = .35;
      this.verb.connect(verb); verb.connect(this.musicBus);
    } catch (e) { this.ctx = null; }
    this.volumes();
  },
  muted() { try { return !!(parent !== window && parent.DemoControls && parent.DemoControls.muted && parent.DemoControls.muted()); } catch (e) { return false; } },
  vol(kind) { return this.muted() ? 0 : Settings.get('master') * Settings.get(kind); },
  volumes() {
    if (this.master) { this.sfxBus.gain.value = this.vol('sfx'); this.musicBus.gain.value = this.vol('music') * .55; }
    if (this.amb) this.amb.volume = clamp(this.vol('ambience') * (this.ambRoom ?? .6), 0, 1);
    if (this.steps) this.steps.volume = clamp(this.vol('sfx') * .45, 0, 1);
  },
  sfx(name, vol = 1) {
    const f = this.files[name]; if (!f || !this.unlocked) return;
    const v = clamp(this.vol('sfx') * f.vol * vol, 0, 1); if (v <= 0) return;
    const a = f.a.cloneNode(); a.volume = v; a.play().catch(() => {});
  },
  ambience(on, roomLevel) {
    if (roomLevel !== undefined) this.ambRoom = roomLevel;
    this.volumes();
    if (on && this.unlocked) this.amb.play().catch(() => {}); else if (!on) this.amb.pause();
  },
  walking(on) {
    if (!this.unlocked) return;
    if (on && this.steps.paused) { this.steps.currentTime = 0; this.steps.play().catch(() => {}); }
    else if (!on && !this.steps.paused) this.steps.pause();
  },
  /* ---------- synthesized sounds ---------- */
  env(node, t, a, peak, d) { node.gain.setValueAtTime(0.0001, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); },
  noise(dur) {
    const b = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  },
  impulse(sec) {
    const n = Math.ceil(this.ctx.sampleRate * sec), b = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    return b;
  },
  burst(t, dur, freq, q, peak, type = 'bandpass') {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise(dur + .05);
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); this.env(g, t, .002, peak, dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t); s.stop(t + dur + .06);
  },
  tone(t, freq, dur, peak, type = 'square', bus) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain(); this.env(g, t, .004, peak, dur);
    o.connect(g); g.connect(bus || this.sfxBus); o.start(t); o.stop(t + dur + .05);
    return o;
  },
  synth(name) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    switch (name) {
      case 'shutter':              // a 2008 compact: fake shutter click + electronic chirp
        this.tone(t, 2400, .05, .08, 'square'); this.tone(t + .06, 3200, .05, .06, 'square');
        this.burst(t + .12, .03, 3000, 2, .5); this.burst(t + .17, .06, 1800, 1.5, .35); break;
      case 'focus': this.tone(t, 2600, .04, .05); this.tone(t + .07, 2600, .04, .05); break;
      case 'pencil': for (let i = 0; i < 5; i++) this.burst(t + i * .07 + Math.random() * .02, .05, 4200 + Math.random() * 1200, 3, .16, 'highpass'); break;
      case 'tape': {               // the zip of a tape measure blade and the snap back
        const o = this.tone(t, 900, .35, .03, 'sawtooth'); o.frequency.linearRampToValueAtTime(1800, t + .3);
        for (let i = 0; i < 9; i++) this.burst(t + i * .035, .012, 5000, 4, .12); this.sfx('ratchet', .7); break;
      }
      case 'light': this.tone(t, 1400, .03, .05); this.burst(t, .02, 2000, 1, .2); break;
      case 'beep': for (let i = 0; i < 3; i++) this.tone(t + i * .22, 3100, .14, .07, 'square'); break;
      case 'buzz': { const o = this.tone(t, 60, .7, .09, 'sawtooth'); this.tone(t, 120, .7, .04, 'square'); break; }
      case 'wrong': this.tone(t, 220, .16, .07, 'square'); this.tone(t + .14, 165, .25, .07, 'square'); break;
      case 'stamp': this.burst(t, .09, 300, .7, .9, 'lowpass'); this.tone(t, 80, .12, .2, 'sine'); break;
      case 'drip': { const o = this.tone(t, 1300, .09, .05, 'sine'); o.frequency.exponentialRampToValueAtTime(2600, t + .08); break; }
      case 'hiss': this.burst(t, .7, 6000, .5, .06, 'highpass'); break;
      case 'flush': this.burst(t, 1.4, 700, .4, .2, 'lowpass'); break;
      case 'unscrew': for (let i = 0; i < 6; i++) this.burst(t + i * .06, .03, 2500, 5, .2); break;
      case 'creak': { const o = this.tone(t, 180, .5, .05, 'sawtooth'); o.frequency.linearRampToValueAtTime(120, t + .45); break; }
      case 'blip': this.tone(t, 880, .05, .04, 'square'); break;
    }
  },
  /* ---------- lounge music: a soft electric-piano ii-V-I loop, like hold music at the leasing office ---------- */
  CHORDS: [[50, 53, 57, 60, 64], [43, 53, 55, 59, 64], [48, 52, 55, 59, 62], [45, 52, 55, 58, 61], [50, 53, 57, 60, 64], [43, 53, 57, 59, 62], [48, 52, 55, 59, 64], [48, 52, 55, 59, 64]],
  music(on) {
    this.musicOn = on;
    if (on && this.ctx) { this.nextBar = Math.max(this.nextBar, this.ctx.currentTime + .1); }
  },
  tick() {                          // called every frame: schedule a bar ahead
    if (!this.musicOn || !this.ctx || this.vol('music') <= 0) return;
    const now = this.ctx.currentTime, beat = 60 / 76;
    while (this.nextBar < now + .5) {
      const ch = this.CHORDS[this.bar % this.CHORDS.length], t0 = this.nextBar;
      const hz = m => 440 * Math.pow(2, (m - 69) / 12);
      // electric piano: sine + soft overtone, gentle tremolo, comped on beats 1 and the "and" of 2
      for (const hit of [0, 1.5]) for (let i = 1; i < ch.length; i++) {
        const t = t0 + hit * beat + i * .012;
        for (const [mul, amp] of [[1, .05], [2, .012]]) {
          const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(ch[i]) * mul;
          const g = this.ctx.createGain(); this.env(g, t, .01, amp, hit ? 1.4 : 2.1);
          o.connect(g); g.connect(this.musicBus); g.connect(this.verb); o.start(t); o.stop(t + 2.4);
        }
      }
      // walking bass
      const root = ch[0] - 12, walk = [root, root + 7, root + 12, root + (this.bar % 2 ? 5 : 3)];
      walk.forEach((m, i) => {
        const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m);
        const g = this.ctx.createGain(); this.env(g, t0 + i * beat, .01, .09, beat * .8);
        o.connect(g); g.connect(this.musicBus); o.start(t0 + i * beat); o.stop(t0 + i * beat + beat);
      });
      // brushes
      for (let i = 0; i < 4; i++) {
        const s = this.ctx.createBufferSource(); s.buffer = this._brush || (this._brush = this.noise(.2));
        const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
        const g = this.ctx.createGain(); this.env(g, t0 + i * beat, .02, i % 2 ? .03 : .015, .12);
        s.connect(f); f.connect(g); g.connect(this.musicBus); s.start(t0 + i * beat); s.stop(t0 + i * beat + .2);
      }
      // a lazy melody note now and then
      if (this.bar % 2 === 1 || hash(this.bar) > .5) {
        const m = ch[2 + Math.floor(hash(this.bar * 7) * 3)] + 12, t = t0 + (2 + Math.floor(hash(this.bar * 3) * 2)) * beat;
        const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m);
        const g = this.ctx.createGain(); this.env(g, t, .02, .04, 1.2);
        o.connect(g); g.connect(this.musicBus); g.connect(this.verb); o.start(t); o.stop(t + 1.4);
      }
      this.nextBar += beat * 4; this.bar++;
    }
  }
};
