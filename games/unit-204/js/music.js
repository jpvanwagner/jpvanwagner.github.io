'use strict';
/* ============================== MUSIC ==============================
   Every piece of music is its own ZzFXM song (one shared set of warm instruments, plus room reverb when played) (music/*.js, bundled into js/music-songs.js), called up by name:
     lounge     while you inspect the apartment (the leasing office radio)
     office, warehouse, jobsite: while you inspect Suite 204, Lot 204, and Site 204 (the same band, another station)
     call       the tenant's call about the deposit (hold music)
     excellent, good, okay, bad: from the moment your manager starts talking, through the grade sheet, until you leave
   Songs are rendered to audio once, off the main thread when the browser allows it (a Web Worker built from the
   ZzFXM code itself), then loop through the music bus, so the volume sliders and mute apply. Changing songs
   crossfades. */
const SONG_GAIN = { lounge: 1, call: .9, excellent: 1, good: 1, okay: .95, bad: .9, office: .95, warehouse: .95, jobsite: .95 };   // relative loudness, after every song is matched to the same average level
const Music = {
  buffers: {}, jobs: {}, cur: null, want: null, node: null, gain: null, worker: null, seq: 0, waiting: {},
  /* a song's notes, as stereo samples */
  render(name) {
    if (this.jobs[name]) return this.jobs[name];
    const song = SONGS[name] || (typeof LOOP_SONGS !== 'undefined' && LOOP_SONGS[name]); if (!song) return Promise.reject(new Error('no song ' + name));
    return this.jobs[name] = new Promise(done => {
      const w = this.makeWorker();
      if (w) { const id = ++this.seq; this.waiting[id] = done; w.postMessage({ id, song }); }
      else setTimeout(() => done(zzfxM(...song)), 30);               // no workers here: render on the page
    });
  },
  makeWorker() {
    if (this.worker !== null) return this.worker;
    try {
      const src = `var zzfxR=${zzfxR};var zzfxG=${zzfxG.toString()};var zzfxM=${zzfxM.toString()};
        onmessage=e=>{const [l,r]=zzfxM(...e.data.song);postMessage({id:e.data.id,l:Float32Array.from(l,v=>v||0),r:Float32Array.from(r,v=>v||0)});};`;
      this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this.worker.onmessage = e => { const f = this.waiting[e.data.id]; delete this.waiting[e.data.id]; if (f) f([e.data.l, e.data.r]); };
      this.worker.onerror = () => { this.worker = false; for (const [id, f] of Object.entries(this.waiting)) { delete this.waiting[id]; f(null); } };
    } catch (e) { this.worker = false; }
    return this.worker;
  },
  /* the song as an AudioBuffer, scaled so every song peaks at the same level */
  buffer(name) {
    if (this.buffers[name]) return Promise.resolve(this.buffers[name]);
    return this.render(name).then(ch => {
      if (!ch) { delete this.jobs[name]; return this.render(name).then(c => c); }   // the worker failed: try again on the page
      return ch;
    }).then(([l, r]) => {
      const ctx = Audio2.ctx; if (!ctx) return null;
      // match every song to the same average loudness (RMS), so none jumps out or sinks, without letting peaks clip
      let pk = .001, sq = 0; for (let i = 0; i < l.length; i++) { const a = l[i] || 0, c = r[i] || 0; pk = Math.max(pk, Math.abs(a), Math.abs(c)); sq += a * a + c * c; }
      const rms = Math.sqrt(sq / (2 * l.length)) || .001, k = Math.min(.16 / rms, .95 / pk) * (SONG_GAIN[name] || 1), b = ctx.createBuffer(2, l.length, zzfxR);
      const L = b.getChannelData(0), R = b.getChannelData(1);
      for (let i = 0; i < l.length; i++) { L[i] = (l[i] || 0) * k; R[i] = (r[i] || 0) * k; }
      return this.buffers[name] = b;
    });
  },
  play(name, fade = 1.5) {
    this.want = name;
    if (this.cur === name && this.node) return;
    const ctx = Audio2.ctx; if (!ctx || !Audio2.musicBus) return;
    this.buffer(name).then(b => {
      if (!b || this.want !== name || (this.cur === name && this.node)) return;
      this.fadeOut(fade * .7);
      const src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
      src.buffer = b; src.loop = true; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + fade);
      src.connect(g); g.connect(Audio2.musicBus); src.start(t);
      if (Audio2.verb) { const send = ctx.createGain(); send.gain.value = .9; g.connect(send); send.connect(Audio2.verb); }   // the same room reverb the original lounge music had
      this.node = src; this.gain = g; this.cur = name;
    });
  },
  fadeOut(sec) {
    if (!this.node) return;
    const ctx = Audio2.ctx, t = ctx.currentTime, src = this.node, g = this.gain;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(.0001, t + sec);
    src.stop(t + sec + .05); this.node = null; this.gain = null; this.cur = null;
  },
  stop(fade = 1) { this.want = null; this.fadeOut(fade); },
  /* get the next songs ready ahead of time, one after another */
  prewarm(names) { names.reduce((p, n) => p.then(() => this.buffer(n)).catch(() => {}), Promise.resolve()); },
  forGrade(grade) { return /^A/.test(grade) ? 'excellent' : grade === 'B' ? 'good' : grade === 'C' ? 'okay' : 'bad'; }
};
