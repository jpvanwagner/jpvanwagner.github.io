'use strict';
/* ============================== CLOSE-UP EXTRAS ==============================
   The parts of a close-up that change with the shift: whatever the tenant left inside a cabinet, the oven, the
   fridge, the dishwasher, or the closet (anything Z.item draws gets a part you can look at, touch, smell, and take);
   things on the bedroom windowsill; the tie on a fan blade; a cable left in the TV wall's jack; the closet's
   folded-back doors (so you can shut them from the close-up); and the front door's peephole, which you can look
   through. A close-up's fixed parts that stop making sense when a door is open are hidden while it's open.
   Parts here are checked before the feature's own parts, so the thing in front is the thing you click. */
const CloseupExtras = {
  spots: {},                  // feature id -> the left-behind things drawn in its close-up this frame: { door, kind, x, y, k }
  boltMemo: {},               // the front door's thumb-turn: when it last moved, and which way

  /* every part of this close-up, front-most first */
  parts(fid) {
    const f = FEATURE[fid], fl = Game.flags[fid] || {}, ex = EXTRAS[fid] || {}, out = [];
    for (const s of this.spots[fid] || []) if (Openables.item(DOOR[s.door])) out.push(this.itemPart(s));
    if (ex.parts) out.push(...ex.parts(fl));
    const hide = ex.hide ? ex.hide(fl) : [];
    return [...out, ...f.parts.filter(p => !hide.includes(p.id))];
  },
  /* drawn on top of the close-up art (before the time-of-day tint, so it matches) */
  draw(g, f, v, fl, t) { const ex = EXTRAS[f.id]; if (ex && ex.draw) ex.draw(g, v, fl, t); },

  /* ---------- things left behind ---------- */
  itemPart(s) {
    const def = CLUTTER[s.kind], k = s.k, d = DOOR[s.door];
    return { id: 'in-' + s.door, name: lower(def.name), r: [Math.round(s.x - 7 * k), Math.round(s.y - 6 * k), Math.round(14 * k), Math.round(7 * k)],
      act: tool => this.useThing(tool, def, { id: 'in-' + d.id, item: s.kind, room: d.room, where: d.inside === 'oven' ? 'oven' : d.inside === 'closet' ? 'closet' : d.inside === 'dish' ? 'dishwasher' : /fridge|freezer/.test(d.inside) ? 'fridge' : 'cabinet' }) };
  },
  /* look, touch (take), smell, or talk to a left-behind thing; c is the placed clutter (for movie titles), if any */
  useThing(tool, def, o, c) {
    const name = lower(def.name);
    switch (tool) {
      case 'look': return clutterText(def, 'look', c) || `A ${name}.`;
      case 'touch': return this.take(def, o, c);
      case 'smell': return clutterText(def, 'smell', c) || `It smells like the inside of a ${o.where || 'room'}. Which is to say, like nothing much.`;
      case 'talk': return clutterText(def, 'talk', c) || `You ask the ${name} what it's still doing here. It has no forwarding address.`;
      case 'flashlight': return `The light finds the ${name}, right where it was left.`;
      case 'tape': return `You measure the ${name}. It's ${name}-sized. Not on the form.`;
      case 'hammer': return `You are not hitting the ${name} with a hammer.`;
      case 'screwdriver': return `There's nothing on the ${name} to unscrew.`;
      case 'pencil': return `Circling the ${name} won't help anyone.`;
      default: return GENERIC[tool] ? GENERIC[tool](name) : 'Nothing happens.';
    }
  },
  take(def, o, c) {
    if (def.noTake && o.item === 'pizza') Takeout.note('tony');
    if (def.noTake) return def.noTake;
    Game.taken.add(o.id); Bag.add(o.item); Rooms.invalidate(o.room); Game.refreshHots();
    return clutterText(def, 'take', c) || `You take the ${lower(def.name)} and drop it in your bag.`;
  },

  /* ---------- the front door's peephole ---------- */
  peepLine() {
    const across = String((+Game.unit || 204) + ((+Game.unit || 204) % 2 ? 1 : -1));
    return pick([
      `Through the peephole: the hallway, bent like a fishbowl. Nobody's there. The door to ${across}, across the hall, still has a Christmas wreath on it.`,
      `Through the peephole: an empty hallway and the door to ${across}. The wreath on it has gone a little brown. It's October.`,
      'Through the peephole: nobody. Just the hallway carpet, which has seen things, and the exit sign humming at the far end.',
      "Through the peephole: a delivery bag sits outside a door down the hall. Not your unit, not your problem.",
      'Through the peephole: the hall light flickers once, then settles. Still nobody. You feel watched anyway.'
    ]);
  },
  /* the fisheye view of the hallway, drawn once a shift and reused */
  hallView() {
    if (this._hall && this._hallShift === Game.shiftNo) return this._hall;
    const S = 112, src = document.createElement('canvas'); src.width = src.height = S; const g = src.getContext('2d');
    const cx = S / 2, hz = S * .46;                                         // vanishing point
    g.fillStyle = '#c9b48e'; g.fillRect(0, 0, S, S);                       // beige walls
    fillPoly(g, [[0, S], [S, S], [cx + 9, hz + 9], [cx - 9, hz + 9]], '#5a1e2a');   // the maroon hall carpet
    for (let i = 0; i < 8; i++) { const k = i / 8, y = hz + 9 + (S - hz - 9) * k * k; pxLine(g, cx - 9 - (cx - 9) * k * k, y, cx + 9 + (S - cx - 9) * k * k, y, '#6e2a36'); }
    fillPoly(g, [[0, 0], [S, 0], [cx + 9, hz - 9], [cx - 9, hz - 9]], '#e6ddc8');   // ceiling
    pxRect(g, cx - 9, hz - 9, 18, 18, '#a8946e'); pxRect(g, cx - 3, hz - 7, 6, 2, '#d64545');   // the far wall, and the exit sign
    fillPoly(g, [[0, S * .72], [cx - 9, hz + 5], [cx - 9, hz + 6], [0, S * .75]], '#f2ece0');   // chair rail, left
    fillPoly(g, [[S, S * .72], [cx + 9, hz + 5], [cx + 9, hz + 6], [S, S * .75]], '#f2ece0');   // and right
    pxRect(g, 30, 22, 52, 66, '#6a3a22'); pxRect(g, 32, 24, 48, 64, '#7d4a2c');   // the door across the hall
    for (const [x, y, w, h] of [[36, 28, 18, 22], [58, 28, 18, 22], [36, 56, 18, 28], [58, 56, 18, 28]]) { pxRect(g, x, y, w, h, '#6e3e24'); pxRect(g, x, y, w, 1, '#5a3018'); }
    pxRect(g, 52, 18, 8, 4, '#c9a227');                                     // its number plate
    pxEllipse(g, 56, 42, 9, 9, '#2f6a2a'); pxEllipse(g, 56, 42, 5, 5, '#7d4a2c'); pxRect(g, 54, 50, 4, 3, '#c43a3a');   // the tired wreath
    pxEllipse(g, 74, 58, 2, 2, '#c9a227');
    pxEllipse(g, cx, 4, 10, 3, '#fff8e0');                                  // the hall light
    // bend it like a door viewer: the middle swells, the edges crowd in
    const out = document.createElement('canvas'); out.width = out.height = S; const o = out.getContext('2d');
    const a = g.getImageData(0, 0, S, S), b = o.createImageData(S, S), R = S / 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x - R) / R, dy = (y - R) / R, r = Math.hypot(dx, dy); if (r > 1) continue;
      const k = Math.pow(r, 1.7) / (r || 1), sx = Math.round(R + dx * k * R), sy = Math.round(R + dy * k * R);
      const si = (Math.min(S - 1, Math.max(0, sy)) * S + Math.min(S - 1, Math.max(0, sx))) * 4, di = (y * S + x) * 4, shade = 1 - Math.pow(r, 3) * .55;
      b.data[di] = a.data[si] * shade; b.data[di + 1] = a.data[si + 1] * shade; b.data[di + 2] = a.data[si + 2] * shade; b.data[di + 3] = 255;
    }
    o.putImageData(b, 0, 0); this._hall = out; this._hallShift = Game.shiftNo; return out;
  },
  /* the thumb-turn's angle: 0 is unlocked (paddle up and down), 90 degrees is locked; it turns over a quarter second */
  boltAngle(fl, v, t) {
    const m = this.boltMemo, want = !!fl.bolt;
    if (m.shift !== Game.shiftNo) { m.shift = Game.shiftNo; m.state = want; m.t = -9; }
    if (m.state !== want) { m.state = want; m.t = t; }
    const k = clamp((t - m.t) / .25, 0, 1), to = want ? Math.PI / 2 : 0, from = want ? 0 : Math.PI / 2;
    if (fl.spin && t - fl.spin < .9) return (t - fl.spin) / .9 * Math.PI * 4;   // the broken one: it just spins
    return from + (to - from) * (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  }
};

/* per-feature extras: parts(fl) -> extra parts, hide(fl) -> ids of the feature's own parts to hide, draw(g, v, fl, t) */
const EXTRAS = {
  closet: {
    hide: fl => fl.open ? ['knob', 'panel'] : [],
    parts: fl => !fl.open ? [] : [
      { id: 'foldL', name: 'folded doors', r: [18, 12, 28, 123], act: tool => tool === 'touch' ? Inspect.act('closet', { id: 'knob', name: 'knob' }, 'touch') : tool === 'look' ? 'The bifold doors, folded back against the jamb. Touch them to fold them shut.' : null },
      { id: 'foldR', name: 'folded doors', r: [194, 12, 28, 123], act: tool => tool === 'touch' ? Inspect.act('closet', { id: 'knob', name: 'knob' }, 'touch') : tool === 'look' ? 'The bifold doors, folded back against the jamb. Touch them to fold them shut.' : null },
      { id: 'inside', name: 'inside of the closet', r: [46, 10, 148, 116], act: tool => ({
        look: 'Inside: a wire shelf, a closet rod, and a tangle of empty hangers. The good hangers left with the tenant.',
        touch: 'The hangers chime against each other. Nobody ever takes the wire ones.',
        smell: 'Cedar block, mothballs, and a ghost of somebody\'s cologne.',
        talk: 'You say hello into the closet. It sounds like a closet.' })[tool] || null }
    ]
  },
  window: {                   // whatever's sitting on the bedroom windowsill
    sill: () => ((Decor.cur && Decor.cur.clutter.bedroom) || []).filter(c => c.y && c.z > 12 && c.x > 1.3 && c.x < 4.7 && !Game.taken.has(c.id)),
    at: c => [Math.round(36 + (c.x - 1.4) / 3.2 * 167), 99],
    parts(fl) { return this.sill().map(c => { const [x, y] = this.at(c), def = CLUTTER[c.kind];
      return { id: c.id, name: lower(def.name), r: [x - 16, y - 14, 32, 16], act: tool => CloseupExtras.useThing(tool, def, { id: c.id, item: itemKey(c.kind, c), room: 'bedroom', where: 'windowsill' }, c) }; }); },
    draw(g) { for (const c of this.sill()) { const [x, y] = this.at(c); pxEllipse(g, x, y + 1, 12, 2, 'rgba(30,20,40,0.18)'); CLUTTER[c.kind].draw(g, x, y, 2, c); } }
  },
  fan: {                      // the tie, looped over a blade (Z.tieRect is where the close-up drew it)
    parts: () => !(Z.tieRect && tieOnFan()) ? [] : [{ id: 'tie', name: 'necktie', r: Z.tieRect, act: tool => {
      if (tool !== 'touch') return CloseupExtras.useThing(tool, CLUTTER.tie, { id: 'tie', item: 'tie', room: 'living', where: 'fan' });
      if ((Game.flags.fan || {}).spin) return "Not while it's spinning. You like your fingers.";
      return CloseupExtras.take(CLUTTER.tie, { id: 'tie', item: 'tie', room: 'living' }) + ' You had to unhook it from the blade like a fish.';
    } }]
  },
  tvwall: {                   // the cable company's leftover, if it's this shift's oddity
    on: () => (Game.anomalies || []).includes('coax'),
    parts() { return this.on() ? [{ id: 'coax', name: 'loose cable', r: [186, 100, 36, 35], act: tool => ({ look: ANOMALY.coax.look, touch: ANOMALY.coax.touch, smell: 'Rubber and dust.', talk: 'You ask the cable what it wants. It wants to be HD-ready.', tape: 'About four feet of cable, going nowhere.' })[tool] || null }] : []; },
    draw(g) {
      if (!this.on()) return;
      const pts = [[196, 104], [198, 112], [203, 120], [212, 126], [224, 131], [240, 133]];   // out of the connector, down, and off along the baseboard
      for (let i = 1; i < pts.length; i++) { pxLine(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], '#1d1f26', 3); pxLine(g, pts[i - 1][0], pts[i - 1][1] - 1, pts[i][0], pts[i][1] - 1, '#3a3d46'); }
      pxRect(g, 193, 99, 7, 7, '#c9a227'); pxRect(g, 194, 100, 5, 2, '#f2d870'); pxRect(g, 193, 104, 7, 1, '#8a6a10');   // its F-connector, screwed onto the jack
    }
  },
  dishwasher: {               // the open dishwasher: racks, the silverware basket, the spray arm, the gasket, and the filter
    parts(fl) {
      if (!fl.open) return [];
      const door = tool => Inspect.act('dishwasher', { id: 'door', name: 'dishwasher door' }, tool), v = cond('dishwasher');
      return [
        { id: 'basket', name: 'silverware basket', r: [166, 62, 34, 20], act: tool => ({ look: 'The silverware basket, hooked over the lower rack. Somebody always leaves one fork.', touch: 'Plastic grid, a little sticky. Nothing stuck in it.', smell: 'Lemon detergent and something that used to be oatmeal.' })[tool] || null },
        { id: 'spray', name: 'spray arm', r: [90, 86, 60, 10], act: tool => ({ look: 'The lower spray arm, under the bottom rack.', touch: 'You give it a flick. It spins freely, holes clear.', flashlight: 'The spray holes are clear. No scale, no gunk.' })[tool] || null },
        { id: 'gasket', name: 'door gasket', r: [30, 32, 8, 72], act: tool => tool === 'flashlight' ? door('flashlight') : ({ look: 'The rubber gasket around the edge of the tub.', touch: v === 3 ? 'Ragged at the bottom corner. That gasket is torn.' : 'Soft and whole, all the way around.', smell: 'Rubber and old dishwater.' })[tool] || null },
        { id: 'racks', name: 'dish racks', r: [36, 38, 168, 48], act: tool => tool === 'look' ? door('look') : ({ touch: v === 1 ? 'Little rough bumps of rust on the tine tips.' : 'You roll the lower rack out and back. Smooth on its wheels.', smell: 'Clean, mostly. Detergent.', tape: 'Standard racks, 22 inches deep.' })[tool] || null },
        { id: 'filter', name: 'filter', r: [40, 96, 160, 8], act: tool => ({ look: 'The filter at the bottom of the tub. A few grains of rice. Normal.', touch: 'You lift the filter cup and set it back. Rice, a lemon seed, nothing worse.', smell: 'Wet and a little sour. Every dishwasher smells like this down here.' })[tool] || null }
      ];
    },
    draw(g, v, fl) {
      if (!fl.open) return;
      for (let x = 168; x < 200; x += 4) pxRect(g, x, 66, 1, 14, '#c8ccd4'); for (let y = 66; y < 81; y += 4) pxRect(g, 167, y, 33, 1, '#c8ccd4');   // the basket
      pxRect(g, 167, 80, 33, 1, '#8a8e98'); pxRect(g, 196, 70, 2, 8, '#d9dce4');                                                                 // and its one fork
      pxRect(g, 96, 90, 48, 3, '#9aa0ab'); pxEllipse(g, 120, 91, 3, 2, '#7a7e88');                                                                  // the spray arm
      pxRect(g, 40, 98, 160, 4, '#3a3c42'); for (let x = 44; x < 196; x += 6) pxRect(g, x, 99, 3, 2, '#4a4c54');                                   // the filter grate
    }
  },
  frontdoor: {
    hide: fl => fl.open ? ['peephole', 'deadbolt', 'knob', 'panel', 'bottom', 'frame'] : [],
    parts: fl => fl.open ? [                                               // the door swung open: its edge-on hardware, the leaf, and the hallway
      { id: 'frame', name: 'door jamb', r: [172, 0, 22, 122] },            // the jamb on its own (it answers with the door frame's findings), not lumped in with the wall beside it
      { id: 'sidewall', name: 'wall', r: [194, 0, 46, 135], act: tool => ({ look: 'The living room wall beside the door. Nothing on it but paint.', touch: 'Plain drywall.', smell: 'Paint.' })[tool] || null },
      { id: 'deadbolt', name: 'deadbolt', r: [48, 46, 30, 18] },        // works just like it does with the door shut, and you can watch the bolt come out of the edge
      { id: 'knob', name: 'doorknob', r: [48, 70, 24, 22], act: tool => tool === 'touch' && (Game.flags.frontdoor || {}).bolt && cond('frontdoor') !== 3 ? "The bolt's sticking out of the edge. It would hit the jamb. Turn it back first." : null },
      { id: 'leaf', name: 'door', r: [10, 0, 46, 119], act: tool => tool === 'touch' ? Inspect.act('frontdoor', { id: 'knob', name: 'doorknob' }, 'touch') : tool === 'look' ? 'The door, swung open. Steel skin, six panels, and a good heavy edge.' : null },
      { id: 'hall', name: 'hallway', r: [80, 0, 96, 119], act: tool => ({ look: CloseupExtras.peepLine().replace('Through the peephole: ', 'Out in the hall: '), smell: 'Hallway air: carpet shampoo, and someone down the hall is making curry.', touch: "You stay on your side of the door. You're inspecting this unit, not the building.", talk: '"Hello?" Your voice goes down the hall and doesn\'t come back.' })[tool] || null }
    ] : [{ id: 'knob', name: 'doorknob', r: [146, 70, 23, 23], act: tool => tool === 'touch' && fl.bolt && cond('frontdoor') !== 3 ? "The knob turns, but the door won't budge. The deadbolt's locked." : null },
      { id: 'peephole', name: 'peephole', r: [84, 20, 18, 16], act: tool => {
      if (tool !== 'look') return null;
      if (fl.open) return "The door's open. You can just look out at the hallway.";
      (Game.flags.frontdoor = Game.flags.frontdoor || {}).peep = Game.t; Audio2.sfx('tick', .6);
      return CloseupExtras.peepLine();
    } }],
    draw(g, v, fl, t) {
      if (!fl.peep || t - fl.peep > 5 || fl.open) return;                 // the view lasts a few seconds
      const k = clamp((t - fl.peep) / .2, 0, 1) * clamp((5 - (t - fl.peep)) / .3, 0, 1);
      g.save(); g.globalAlpha = k; g.fillStyle = '#07060b'; g.fillRect(0, 0, ZW, ZH);
      g.beginPath(); g.arc(120, 67, 56, 0, Math.PI * 2); g.clip(); g.drawImage(CloseupExtras.hallView(), 64, 11); g.restore();
      g.save(); g.globalAlpha = k; g.strokeStyle = '#2a2420'; g.lineWidth = 3; g.beginPath(); g.arc(120, 67, 56, 0, Math.PI * 2); g.stroke(); g.restore();
    }
  }
};
