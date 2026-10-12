'use strict';
/* ============================== AUDIO ==============================
   Recorded sounds (Kenney, CC0) play through plain <audio> elements, which also work when the game is opened
   straight from disk. They're embedded in js/sounds.js (free Neocities accounts don't accept audio files). The shutter, beeps, pencil, and tape measure are synthesized with Web Audio; the music is ZzFXM songs (js/music.js). */
const Audio2 = {
  ctx: null, sfxBus: null, musicBus: null, files: {}, amb: null, steps: null, unlocked: false,
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
  muted() { if (Settings.get('mute')) return true; try { return !!(parent !== window && parent.DemoControls && parent.DemoControls.muted && parent.DemoControls.muted()); } catch (e) { return false; } },
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
      case 'click': this.tone(t, 1200, .025, .03, 'square'); break;
      case 'ring': for (let r = 0; r < 2; r++) for (let i = 0; i < 16; i++) { this.tone(t + r * .9 + i * .045, 440, .04, .045, 'square'); this.tone(t + r * .9 + i * .045, 480, .04, .045, 'square'); } break;   // a desk phone's double ring
      case 'hangup': this.burst(t, .06, 900, 1, .4, 'lowpass'); this.tone(t + .08, 480, .25, .03, 'square'); this.tone(t + .08, 620, .25, .03, 'square'); break;
      case 'whir': this.burst(t, 1.1, 380, .7, .14, 'lowpass'); this.tone(t, 110, .9, .03, 'sawtooth'); break;
    }
  },
  /* ---------- music: ZzFXM songs, see js/music.js ---------- */
  music(on) { if (on) Music.play(Sites.site.music || 'lounge'); else Music.stop(); },   // each property has its own radio station
  tick() {}
};
