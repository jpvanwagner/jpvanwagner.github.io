'use strict';
/* ============================== KITCHEN SINK ==============================
   The faucet's hot and cold handles and the garbage disposal, which really run: the close-up and the room show the
   water, the disposal shakes, and each has its own looping sound (sounds/faucet.js and sounds/disposal.js, through
   Loops). The disposal plugs into the outlet under the sink, so it's on the KIT OUTLETS breaker; a snapped switch
   (the damaged variant) can't turn it on at all. */
const Sink = {
  fl() { return Game.flags.sink || {}; },
  on(which) { return !!this.fl()[which]; },
  running() { return this.on('hot') || this.on('cold'); },
  grinding() { return this.on('disposal') && cond('sink') !== 2 && Utilities.on('kplugs'); },
  /* the loop levels: full in the kitchen, quieter in the next room */
  sounds(play) {
    const near = UI.isOpen('inspectScreen') && Inspect.fid === 'sink' ? 1 : Game.room === 'kitchen' ? .5 : Game.room === 'living' ? .14 : 0;   // loudest up close at the sink
    const office = (Game.flags.o_sink || {}).run, nearO = UI.isOpen('inspectScreen') && Inspect.fid === 'o_sink' ? 1 : Game.room === 'o_break' ? .5 : Game.room === 'o_open' ? .12 : 0;   // the office break room's faucet uses the same loop
    Loops.set('faucet', play ? Math.max(this.running() ? near : 0, office ? nearO : 0) : 0);
    Loops.set('disposal', play && this.grinding() ? near : 0);
  },
  /* the stream from the faucet into the left basin, in the room */
  drawRoom(g, t) {
    if (!this.running()) return;
    const x = this.on('spout') ? .72 : -.1, a = P(x, 1.42, 11.55), b = P(x, .96, 11.55);   // into whichever basin the spout is over
    for (let y = Math.round(a[1]); y < b[1]; y++) pxRect(g, a[0] + ((y + Math.floor(t * 20)) % 4 === 0 ? 1 : 0), y, 1, 1, (y + Math.floor(t * 24)) % 3 ? '#bfe3f4' : '#ffffff');
    pxEllipse(g, b[0], b[1], 2 + Math.floor(t * 10) % 2, 1, 'rgba(220,244,255,0.85)');
  }
};
