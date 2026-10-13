'use strict';
/* ============================== CLOSE-UP (INSPECT) ==============================
   Looking at a feature zooms into it. Inside, the current verb or tool works on the parts of the close-up;
   what you learn is written into your field notes, which carry over to the clipboard form. */
const SYNTHS = new Set(['whir', 'shutter', 'focus', 'pencil', 'tape', 'light', 'beep', 'buzz', 'wrong', 'stamp', 'drip', 'hiss', 'flush', 'unscrew', 'creak', 'blip']);
function playSfx(name) { if (!name) return; if (SYNTHS.has(name)) Audio2.synth(name); else Audio2.sfx(name); }
const TOOL_SFX = { tape: 'tape', pencil: 'pencil', hammer: 'thud', flashlight: 'light', screwdriver: 'ratchet' };
function verbPhrase(tool, name) {
  const t = TOOL[tool];
  switch (tool) {
    case 'walk': return `Walk to <b>${name}</b>`;
    case 'look': return `Look at <b>${name}</b>`;
    case 'touch': return `Touch <b>${name}</b>`;
    case 'smell': return `Smell <b>${name}</b>`;
    case 'talk': return `Talk to <b>${name}</b>`;
    case 'clipboard': return `Mark <b>${name}</b> on clipboard`;
    case 'camera': return `Photograph <b>${name}</b>`;
    default: return `Use ${lower(t.name)} on <b>${name}</b>`;
  }
}
function pickResp(c, fl) {
  if (c == null) return null;
  if (typeof c === 'string') return { t: c };
  if (Array.isArray(c)) {
    for (const o of c) {
      if (!o.if) return o;
      const neg = o.if[0] === '!', k = neg ? o.if.slice(1) : o.if;
      if (!!fl[k] !== neg) return o;
    }
    return null;
  }
  return c;
}
function resolveResp(f, vi, partId, tool) {
  const v = f.variants[vi], fl = Game.flags[f.id] || {};
  for (const c of [v.resp && v.resp[partId] && v.resp[partId][tool], f.base && f.base[partId] && f.base[partId][tool], f.base && f.base['*'] && f.base['*'][tool]]) {
    const r = pickResp(c, fl); if (r) return r;
  }
  return null;
}
const Inspect = {
  fid: null, hover: null, mx: -1, my: -1,
  get feat() { return FEATURE[this.fid]; },
  open(fid, origin, prompt) {
    this.fid = fid; this.hover = null;
    const f = FEATURE[fid];
    $('inspectTitle').textContent = f.name; $('inspectRoom').textContent = ROOMS[f.room].name;
    this.say(this.desc(fid) + (prompt ? ' ' + prompt : ''));
    this.renderNotes(); this.refresh();
    $('inspectSafety').hidden = !f.osha;                       // a safety note for whoever fixes it (js/osha-notes.js)
    // zoom out of the spot you clicked
    const panel = $('inspectPanel'), gr = $('game').getBoundingClientRect(), pr = panel.getBoundingClientRect();
    if (origin) { const ox = gr.left + origin[0] / SW * gr.width - pr.left, oy = gr.top + origin[1] / SH * gr.height - pr.top; panel.style.setProperty('--zx', ox + 'px'); panel.style.setProperty('--zy', oy + 'px'); }
    UI.open('inspectScreen'); Audio2.sfx('swish', .7);
    if (Game.tool === 'walk') Game.setTool('look');
    Game.seen.add(fid); if (fid === 'bwall' && Game.cond.bwall === 3) Achievements.unlock('liger');
  },
  /* the feature's safety note, in the caption, with its citations linked to the handbook */
  safety() {
    const f = FEATURE[this.fid]; if (!f || !f.osha) return;
    const d = $('inspectDesc'); d.innerHTML = ''; d.classList.remove('spoken');
    const s = document.createElement('span'); s.className = 'tag safety-tag'; s.textContent = 'Safety'; d.append(s, SopLinks.linkify(f.osha));
    Audio2.sfx('tick', .6);
  },
  desc(fid) {
    if (fid === 'carpet' && Decor.rugDown()) return 'Builder-beige carpet, with a big patterned area rug the tenant left in the middle of the room.';
    return FEATURE[fid].variants[Game.cond[fid]].desc;
  },
  onClose() { if (this.fid === 'frontdoor' && Game.flags.frontdoor) Game.flags.frontdoor.open = 0;   // you shut the front door behind you
    this.fid = null; $('zoomLabel').innerHTML = ''; },
  /* the caption under the close-up. Narration (what you see and do) by default; tool names a small tag, not a speaker.
     Only Talk is actually spoken, so only Talk gets a speaker's name. */
  say(text, tool) {
    const d = $('inspectDesc'); d.innerHTML = '';
    const spoken = tool === 'talk' && !/^You\b/.test(text);
    d.classList.toggle('spoken', spoken);
    if (spoken) { const s = document.createElement('span'); s.className = 'who'; s.textContent = 'You: '; d.append(s); }
    else if (tool) { const s = document.createElement('span'); s.className = 'tag'; s.textContent = TOOL[tool].name; d.append(s); }
    d.append(SopLinks.linkify(text));
  },
  refresh() {
    const m = Game.marks[this.fid], s = $('inspectStatus'), photo = Game.photos[this.fid];
    s.innerHTML = '';
    if (m) { const p = document.createElement('span'); p.className = 'cat-pill c' + m.cat; p.textContent = 'Marked: ' + CATS[m.cat].short; s.append(p); }
    if (photo) { const p = document.createElement('span'); p.className = 'status-note'; p.textContent = '\u2713 photo on file'; s.append(p); }   // plain text, so it can't be mistaken for a second Photo button
    s.style.visibility = (m || photo) ? 'visible' : 'hidden';
  },
  renderNotes() {
    const list = $('notesList'), notes = Game.notes[this.fid] || [];
    list.replaceChildren(...notes.map(n => { const li = document.createElement('li'); li.append(SopLinks.linkify(n)); return li; }));   // "per the SOP" opens the binder
    $('notesEmpty').style.display = notes.length ? 'none' : 'block';
    list.scrollTop = list.scrollHeight;
  },
  partAt(x, y) { for (const p of CloseupExtras.parts(this.fid)) { const [px, py, pw, ph] = p.r; if (x >= px && y >= py && x < px + pw && y < py + ph) return p; } return null; },
  move(e) {
    const c = $('zoomCanvas'), r = c.getBoundingClientRect();
    this.mx = (e.clientX - r.left) / r.width * ZW; this.my = (e.clientY - r.top) / r.height * ZH;
    this.hover = this.partAt(this.mx, this.my);
    $('zoomLabel').innerHTML = this.hover ? verbPhrase(Game.tool, this.hover.name) : '';
  },
  leave() { this.hover = null; this.mx = this.my = -1; $('zoomLabel').innerHTML = ''; },
  click(e) {
    if (e.button !== 0) return;
    this.move(e);
    const tool = Game.tool;
    if (tool === 'clipboard') return Mark.open(this.fid);
    if (tool === 'camera') return Camera.open(this.fid);
    const part = this.hover;
    if (!part) { if (tool === 'look') this.say(this.desc(this.fid)); return; }
    this.use(part, tool);
  },
  use(part, tool) {
    const own = part.act && part.act(tool);                              // a close-up extra (something left behind, the peephole...) answers for itself
    if (own) { Game.actions++; this.say(own, tool); this.renderNotes(); return; }
    const text = this.act(this.fid, part, tool);
    this.say(text, tool); this.renderNotes();
  },
  /* do something to one part of a feature; returns what happened. Used by the close-up and by Touch in the room. */
  act(fid, part, tool) {
    if (part && part.act) { const own = part.act(tool); if (own) return own; }   // a part that answers for itself (the calendar, things left behind)
    const f = FEATURE[fid];
    // the left-behind rug covers the middle of the living room until you roll it up
    if (fid === 'carpet' && part.id === 'center' && Decor.rugDown() && !['look', 'talk'].includes(tool)) return "The rug's in the way. Roll it up first (Touch it in the room).";
    const dead = Utilities.dead(fid, part.id, tool);                     // no power, no test: the breaker panel wins
    if (dead) { Game.actions++; playSfx('click'); return dead; }
    const r = resolveResp(f, Game.cond[fid], part.id, tool);
    Game.actions++;
    if (!r) { playSfx(TOOL_SFX[tool]); return GENERIC[tool] ? GENERIC[tool](part.name) : 'Nothing happens.'; }
    const fl = Game.flags[fid] = Game.flags[fid] || {};
    if (r.set) { fl[r.set] = Game.t; Rooms.invalidate(f.room); }
    if (r.toggle) { fl[r.toggle] = fl[r.toggle] ? 0 : Game.t; Rooms.invalidate(f.room); Openables.flagged(fid, r.toggle, !!fl[r.toggle]); }
    if (r.unsafe && (!r.toggle || fl[r.toggle])) PPE.unsafe(r.unsafe, lower(f.say || f.name));   // switching on a machine without the PPE it needs
    if (r.clue) { (Game.clues[fid] = Game.clues[fid] || new Set()).add(r.clue); Utilities.noticed(fid, r.clue); }
    if (r.clue && tool === 'tape') Game.measures[fid] = r.t;
    if (r.ach) Achievements.unlock(r.ach);                              // a response can earn a badge (trying a locked-out machine)            // the tenant may argue about this number later
    playSfx(r.sfx || TOOL_SFX[tool]);
    let text = r.t;
    if (fid === 'fan' && ((r.toggle === 'spin' && fl.spin) || r.set === 'wobble')) text += Game.tieFling();
    if (tool !== 'talk') {
      const list = Game.notes[fid] = Game.notes[fid] || [];
      if (!list.includes(r.t)) { list.push(r.t); if (tool !== 'look') Audio2.synth('pencil'); }
    }
    return text;
  },
  render(t) {
    if (!this.fid) return;
    const c = $('zoomCanvas'), g = c.getContext('2d'), f = this.feat;
    drawZoom(g, f, Game.cond[f.id], Game.flags[f.id], t);
    // the flashlight cuts a warm circle out of the dark
    if (Game.tool === 'flashlight' && this.mx >= 0) {
      g.save(); g.beginPath(); g.rect(0, 0, ZW, ZH); g.arc(this.mx, this.my, 30, 0, Math.PI * 2, true);
      g.fillStyle = dither('#05040a', 9); g.fill('evenodd'); g.restore();
      g.fillStyle = dither('#fff3c4', 3); g.beginPath(); g.arc(this.mx, this.my, 26, 0, Math.PI * 2); g.fill();
    }
    // outline the part under the cursor
    Reveal.drawZoom(g, CloseupExtras.parts(this.fid));
    if (this.hover && Settings.get('hotspots') !== 'off') {
      const [x, y, w, h] = this.hover.r;
      g.save(); g.setLineDash([2, 2]); g.lineDashOffset = -Math.floor(t * 8); g.strokeStyle = 'rgba(255,236,190,0.9)'; g.lineWidth = 1; g.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3); g.restore();
    }
  }
};
