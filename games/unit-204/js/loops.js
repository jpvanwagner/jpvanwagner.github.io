'use strict';
/* ============================== MACHINE LOOPS ==============================
   Steady sounds that run as long as something is switched on: the bathroom vent fan (and the kitchen's garbage
   disposal and faucets). Each is a ZzFXM file in sounds/ (bundled into js/music-songs.js as LOOP_SONGS), rendered
   once like the music, and looped from its steady middle through the sound-effects bus, so the SFX slider and
   mute apply. Every frame the game says how loud each one should be (0 is off); levels glide, so nothing clicks. */
const LOOP_GAIN = { vent: .5, disposal: .6, faucet: .4, hood: .55 };
const LOOP_SOURCE = { hood: 'vent' };                       // the range hood is the vent fan's recording, played slower and lower
const Loops = {
  live: {}, pending: {},
  /* make the named loop play at this level (0 to 1), and at this speed (a struggling motor runs slower) */
  set(name, level, rate = 1) {
    const ctx = Audio2.ctx; if (!ctx || !Audio2.sfxBus) return;
    let L = this.live[name];
    if (!L && level > 0) {
      if (this.pending[name]) return; this.pending[name] = true;
      Music.render(LOOP_SOURCE[name] || name).then(ch => {
        this.pending[name] = false; if (!ch || this.live[name]) return;
        const [l, r] = ch, b = ctx.createBuffer(2, l.length, zzfxR), k = LOOP_GAIN[name] || .5;
        const Lc = b.getChannelData(0), Rc = b.getChannelData(1);
        for (let i = 0; i < l.length; i++) { Lc[i] = (l[i] || 0) * k; Rc[i] = (r[i] || 0) * k; }
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = b; src.loop = true; src.loopStart = .5; src.loopEnd = b.duration - .5;   // the steady middle, not the fade in and out
        g.gain.value = 0.0001; src.connect(g); g.connect(Audio2.sfxBus); src.start(ctx.currentTime, .5);
        this.live[name] = { src, g, level: 0, rate: 1 };
      });
      return;
    }
    if (!L) return;
    if (Math.abs(L.level - level) > .01) { L.level = level; L.g.gain.setTargetAtTime(Math.max(.0001, level), ctx.currentTime, .12); }
    if (Math.abs(L.rate - rate) > .01) { L.rate = rate; L.src.playbackRate.setTargetAtTime(rate, ctx.currentTime, .3); }
  },
  /* the levels for this moment of the game */
  update() {
    const play = Game.mode === 'play', bath = ROOMS.bath || {}, vv = cond('vent');
    const ventRuns = play && bath.ventOn && vv !== 3 && Utilities.on('blights');
    const near = Game.room === 'bath' ? (UI.isOpen('inspectScreen') && Inspect.fid === 'vent' ? 1 : .75) : .12;   // muffled from the other rooms
    this.set('vent', ventRuns ? near : 0, vv === 1 ? .82 : 1);                                                  // the dusty one labors
    const hoodRuns = play && Game.hoodOn && Utilities.on('kplugs');
    this.set('hood', hoodRuns ? (Game.room === 'kitchen' ? .8 : .1) : 0, .78);
    if (typeof Sink !== 'undefined') Sink.sounds(play);                                                         // the kitchen's disposal and faucets
  },
  stopAll() { for (const n of Object.keys(this.live)) this.set(n, 0); }
};
