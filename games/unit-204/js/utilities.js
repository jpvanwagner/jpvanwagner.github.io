'use strict';
/* ============================== BREAKER PANEL & GAS SHUT-OFF ==============================
   Making a hazard safe, the way the SOP says to: the breaker panel on the kitchen wall (by the door) cuts a
   circuit, and the yellow-handled shut-off valve in the cabinet left of the range cuts the gas to the stove.
   A hazard that's made safe when you file counts on the report, and Pat mentions it either way. Turning off a
   circuit really turns things off: lights won't come on, the bathroom fan stops, the sparking stops. */
const CIRCUITS = [
  { id: 'living', label: 'LIVING RM', rooms: ['living'] },
  { id: 'klights', label: 'KITCHEN LTS', rooms: ['kitchen'] },
  { id: 'kplugs', label: 'KIT OUTLETS' },
  { id: 'fridge', label: 'REFRIG' },
  { id: 'dish', label: 'DISHWASHER' },
  { id: 'blights', label: 'BATH LT/FAN', rooms: ['bath'] },
  { id: 'bgfci', label: 'BATH GFCI' },
  { id: 'bed', label: 'BEDROOM', rooms: ['bedroom'] },
  { id: 'hvac', label: 'FURNACE/AC' },
  { id: 'smoke', label: 'SMOKE DET' }
];
/* which hazards each fix makes safe (only when that feature really is the hazard this shift) */
const HAZARD_FIX = { mirror: { circuit: 'blights', what: 'the vanity light' }, outlet: { circuit: 'bgfci', what: 'the bathroom outlet' }, thermostat: { circuit: 'hvac', what: 'the thermostat wiring' }, stove: { gas: true, what: 'the range' } };
/* what a dead circuit stops working in the close-ups: feature -> its breaker, and part -> what you get for trying (touch is
   operating it; the thermostat's screen also goes dark). Damage you can see stays visible with the power off. */
const POWERED = {
  fan: { circuit: 'living', parts: { chain: { touch: 'Click, click. Nothing. The living room breaker is off, so the fan has no power.' }, light: { touch: 'Cool glass. The bulbs are off; the living room breaker is off.' } } },
  thermostat: { circuit: 'hvac', parts: { buttons: { touch: 'You press the arrows. Nothing. The FURNACE/AC breaker is off, so the thermostat is dead.' }, display: { look: 'Blank. No power: the FURNACE/AC breaker is off.' } } },
  outlet: { circuit: 'bgfci', parts: { test: { touch: "Click. Nothing to trip. The BATH GFCI breaker is off, so there's no power to test." }, reset: { touch: 'Click. Nothing. The BATH GFCI breaker is off.' } } },
  smoke: { circuit: 'smoke', parts: { led: { look: "The green power light is out. The SMOKE DET breaker is off, so it's running on its backup battery, if it has one." } } },
  mirror: { circuit: 'blights', parts: { lightbar: { touch: 'You flip the switch. Nothing. The BATH LT/FAN breaker is off.' } } },
  vent: { circuit: 'blights', parts: { grille: { touch: "You hold up a tissue. Nothing pulls it. Of course not: the BATH LT/FAN breaker is off, so the fan can't run." } } },
  sink: { circuit: 'kplugs', parts: { switch: { touch: 'Click. Nothing. The disposal plugs in under the sink, and the KIT OUTLETS breaker is off.' } } },
  dishwasher: { circuit: 'dish', parts: { panel: { touch: 'You press START. Not a beep. The DISHWASHER breaker is off.' } } }
};
const PANEL_Z = [6.55, 7.2], PANEL_Y = [1, 1.95];          // where the panel hangs on the kitchen's left wall

const Utilities = {
  reset() { Game.power = {}; Game.gasOff = false; Game.toldFix = {}; Game.toldLive = {}; },
  on(id) { return !(Game.power && Game.power[id] === false); },
  circuitOf(room) { return CIRCUITS.find(c => c.rooms && c.rooms.includes(room)); },
  roomPowered(room) { const c = this.circuitOf(room); return !c || this.on(c.id); },
  isHazard(fid) { return !!FEATURE[fid] && FEATURE[fid].variants[Game.cond[fid]].cat === 3; },
  /* the close-up's answer when you try to work something whose circuit is off, or null */
  dead(fid, part, tool) { const p = POWERED[fid]; return p && !this.on(p.circuit) && p.parts[part] && p.parts[part][tool] || null; },
  safe(fid) { const f = HAZARD_FIX[fid]; return !!f && (f.gas ? !!Game.gasOff : !this.on(f.circuit)); },

  /* ---------- the panel ---------- */
  flip(id) {
    const c = CIRCUITS.find(c => c.id === id), now = !this.on(id);
    Game.power[id] = now; Game.actions++;
    Audio2.synth('stamp'); Audio2.sfx('click', .8);
    for (const room of c.rooms || []) {                            // lights in that room follow the breaker
      const r = ROOMS[room]; r.lightsOff = !now; if (room === 'bath' && !now) r.ventOn = false; Rooms.invalidate(room);
      if (room === 'living' && !now && Game.flags.fan) Game.flags.fan.spin = 0;   // the ceiling fan winds down with its circuit
    }
    this.render(); Rooms.invalidate('kitchen'); if (CIRCUITS.every(c => !this.on(c.id))) Achievements.unlock('lightsout');   // the open panel in the room shows the flip too
    Game.tell(now ? `Clack. You flip ${c.label} back on.` : `Clack. ${c.label} is off.`);
  },
  build() {
    if ($('breakerScreen')) return;
    const s = document.createElement('section'); s.id = 'breakerScreen'; s.className = 'overlay dim';
    s.innerHTML = `<div class="breaker-box"><div class="win-bar"><span>Breaker panel</span><button class="win-x" data-close type="button" aria-label="Close">&times;</button></div>
      <div class="breaker-door"><p class="breaker-note">Flip a breaker to cut the power to that circuit. Click it again to turn it back on.</p><div class="breaker-grid" id="breakerGrid"></div>
      <p class="breaker-sticker">MAIN 100A</p></div></div>`;
    $('game').append(s);
    s.querySelector('[data-close]').addEventListener('click', () => UI.close('breakerScreen'));
    s.addEventListener('mousedown', e => { if (e.target === s) UI.close('breakerScreen'); });
  },
  render() {
    const grid = $('breakerGrid'); if (!grid) return;
    grid.replaceChildren(...CIRCUITS.map((c, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'breaker' + (this.on(c.id) ? ' is-on' : ''); b.setAttribute('aria-pressed', String(this.on(c.id)));
      b.dataset.tip = `${c.label}|${this.on(c.id) ? 'On. Click to switch this circuit off.' : 'Off. Click to switch it back on.'}`;
      b.innerHTML = `<span class="br-num">${i * 2 + 1}</span><span class="br-handle"></span><span class="br-label">${c.label}</span>`;
      b.addEventListener('click', () => this.flip(c.id)); return b;
    }));
  },
  openPanel() { this.build(); this.render(); Game.panelOpen = true; Rooms.invalidate('kitchen'); UI.open('breakerScreen'); Audio2.synth('creak'); Game.tell('You swing the panel door open. Ten breakers, labeled in somebody\'s handwriting.'); },

  /* you walked away from the panel: you swing its door shut behind you */
  panelClosed() { if (!Game.panelOpen) return; Game.panelOpen = false; Rooms.invalidate('kitchen'); Audio2.sfx('click', .6); },
  /* ---------- the gas shut-off ---------- */
  toggleGas() {
    Game.gasOff = !Game.gasOff; Game.actions++; Audio2.synth('unscrew');
    Game.tell(Game.gasOff ? 'You turn the yellow handle a quarter turn, across the pipe. The gas to the range is off.' : 'You turn the handle back in line with the pipe. The gas to the range is on.');
  },
  /* how to get to the breaker panel from where you're standing: it's in the kitchen, so say where the kitchen is, too */
  where(room) {
    return {
      kitchen: "right here in the kitchen, on the left wall by the doorway",
      living: "in the kitchen. That's through the doorway on the right; the panel's on the wall just inside",
      bedroom: "in the kitchen. Back down the hall to the living room, then the doorway on the right; the panel's on the wall just inside",
      bath: "in the kitchen. Out through the bedroom, down the hall to the living room, then the doorway on the right; the panel's on the wall just inside"
    }[room] || "in the kitchen, on the wall by the doorway";
  },
  /* Dana says it now; if a close-up or the form is covering the room, her line goes in the close-up's text box and
     she says it again out loud once you're back in the room, so it can't get lost behind an overlay */
  danaSay(text) {
    if (UI.isOpen('inspectScreen')) {
      const d = $('inspectDesc'), p = document.createElement('span'); p.className = 'dana-aside';
      const w = document.createElement('b'); w.textContent = 'Dana: '; p.append(w, text); d.append(p);
    }
    const go = () => { if (UI.blocking() || UI.talking('dana')) return setTimeout(go, 600); UI.say('dana', text); };
    go();
  },
  fixLine(fid) {
    const f = HAZARD_FIX[fid];
    return f.gas ? "Gas! The shut-off's in the cabinet left of the range. Yellow handle. Turn it across the pipe."
      : `That's live. Kill that circuit before you write it up. The breaker panel's ${this.where(Game.room)}.`;
  },
  /* a hazard clue just turned up: Dana says where the fix is, once */
  noticed(fid, clue) {
    const f = HAZARD_FIX[fid]; if (!f || !this.isHazard(fid) || this.safe(fid) || Game.toldFix[fid]) return;
    if (!FEATURE[fid].variants[Game.cond[fid]].key.includes(clue)) return;
    Game.toldFix[fid] = true;
    setTimeout(() => { if (!this.safe(fid)) this.danaSay(this.fixLine(fid)); }, 1400);
  },
  /* you just wrote up a hazard that's still live: one reminder per hazard, with directions */
  markedLive(fid, cat) {
    const f = HAZARD_FIX[fid]; if (!f || cat !== 3 || !this.isHazard(fid) || this.safe(fid) || (Game.toldLive = Game.toldLive || {})[fid]) return;
    Game.toldLive[fid] = true;
    setTimeout(() => {
      if (this.safe(fid)) return;
      this.danaSay(f.gas ? "Good call. Now shut the gas off: the valve's in the cabinet left of the range, yellow handle, turn it across the pipe."
        : `Good call. It's still live, though: ${f.what} needs its breaker off. The panel's ${this.where(Game.room)}.`);
    }, 1800);
  }
};

/* the panel on the kitchen wall: a gray steel box with a door, a latch, and a directory sticker */
function drawBreakerPanel(g, r) {
  const [za, zb] = PANEL_Z, [ya, yb] = PANEL_Y, x0 = r.box.x0;
  if (Game.panelOpen) {                                          // open, while you're looking at it up close
    fillPoly(g, Q.left(r.box, za, zb, ya, yb), '#8e939c');
    fillPoly(g, Q.left(r.box, za + .03, zb - .03, ya + .04, yb - .04), '#3a3e46');            // the box's dark inside
    fillPoly(g, Q.left(r.box, za + .3, zb - .3, ya + .08, yb - .08), '#5a5e68');              // the bus bar down the middle
    CIRCUITS.forEach((c, i) => {                                                             // two columns of breakers, matching the close-up
      const col = i % 2, row = Math.floor(i / 2), y1 = yb - .12 - row * .15, y0 = y1 - .1, z0 = col ? (za + zb) / 2 + .03 : za + .07, z1 = col ? zb - .07 : (za + zb) / 2 - .03;
      fillPoly(g, Q.left(r.box, z0, z1, y0, y1), '#1c1d22');
      const on = Utilities.on(c.id), h = col ? (on ? [z0, z0 + .1] : [z1 - .1, z1]) : (on ? [z1 - .1, z1] : [z0, z0 + .1]);   // the handle points in toward the bar when it's on
      fillPoly(g, Q.left(r.box, h[0], h[1], y0 + .02, y1 - .02), on ? '#d8dade' : '#e05a3a');
    });
    // the door, swung out into the room on its far hinge so the breakers stay in view, its inside face (and the directory sticker) toward you
    const th = 1.7, w = zb - za, xe = x0 + Math.sin(th) * w, ze = zb - Math.cos(th) * w;
    fillPoly(g, [P(x0, ya, zb), P(xe, ya, ze), P(xe, yb, ze), P(x0, yb, zb)], '#b8bcc4');
    const dz = t => [x0 + (xe - x0) * t, zb + (ze - zb) * t];
    { const [a1, b1] = dz(.15), [a2, b2] = dz(.85); fillPoly(g, [P(a1, yb - .12, b1), P(a2, yb - .12, b2), P(a2, ya + .2, b2), P(a1, ya + .2, b1)], '#f2eedc');   // the directory, inside the door
      for (let k = 0; k < 6; k++) { const yy = yb - .2 - k * .1, p = P(a1 + (a2 - a1) * .1, yy, b1 + (b2 - b1) * .1), q = P(a2 - (a2 - a1) * .1, yy, b2 - (b2 - b1) * .1); pxLine(g, p[0], p[1], q[0], q[1], '#9aa0ab'); } }
    strokePoly(g, [P(x0, ya, zb), P(xe, ya, ze), P(xe, yb, ze), P(x0, yb, zb)], 'rgba(40,40,52,0.6)');
    strokePoly(g, Q.left(r.box, za, zb, ya, yb), 'rgba(40,40,52,0.6)');
    return;
  }
  fillPoly(g, Q.left(r.box, za, zb, ya, yb), '#8e939c');
  fillPoly(g, Q.left(r.box, za + .03, zb - .03, ya + .04, yb - .04), '#c3c7ce');
  fillPoly(g, Q.left(r.box, za + .05, zb - .05, yb - .2, yb - .08), '#f2eedc');          // the directory sticker
  for (let i = 0; i < 3; i++) fillPoly(g, Q.left(r.box, za + .08, zb - .1, yb - .18 + i * .035, yb - .17 + i * .035), '#9aa0ab');
  fillPoly(g, Q.left(r.box, zb - .12, zb - .07, ya + .4, ya + .55), '#5a5e68');           // the latch
  strokePoly(g, Q.left(r.box, za, zb, ya, yb), 'rgba(40,40,52,0.6)');
}
/* the gas line and its shut-off valve, at the back of the cabinet left of the range */
function drawGasValve(g, d) {
  const x = d.x1 - .14, z = d.z + d.depth * .85, a = P(x, d.y0 + .01, z), b = P(x, d.y1 - .04, z), m = P(x, d.y0 + .24, z);
  pxLine(g, a[0], a[1], b[0], b[1], '#3a3a42', 3); pxLine(g, a[0] + 1, a[1], b[0] + 1, b[1], '#5a5a64', 1);   // black iron pipe
  pxRect(g, m[0] - 3, m[1] - 2, 7, 5, '#8a8a92'); pxRect(g, m[0] - 3, m[1] - 2, 7, 1, '#b4b4bc');               // the valve body
  if (Game.gasOff) { pxRect(g, m[0] - 9, m[1] - 1, 10, 3, '#f2c418'); pxRect(g, m[0] - 9, m[1] - 1, 10, 1, '#ffe27a'); }   // across the pipe: off
  else { pxRect(g, m[0] - 1, m[1] - 9, 3, 10, '#f2c418'); pxRect(g, m[0] - 1, m[1] - 9, 1, 10, '#ffe27a'); }               // in line with it: on
}
function gasValvePts(d) { const m = P(d.x1 - .14, d.y0 + .24, d.z + d.depth * .85); return [[m[0] - 11, m[1] - 11], [m[0] + 6, m[1] - 11], [m[0] + 6, m[1] + 6], [m[0] - 11, m[1] + 6]]; }
