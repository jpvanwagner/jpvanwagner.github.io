'use strict';
/* ============================== CLOSE-UP (INSPECT) ==============================
   Looking at a feature zooms into it. Inside, the current verb or tool works on the parts of the close-up;
   what you learn is written into your field notes, which carry over to the clipboard form. */
const SYNTHS = new Set(['shutter', 'focus', 'pencil', 'tape', 'light', 'beep', 'buzz', 'wrong', 'stamp', 'drip', 'hiss', 'flush', 'unscrew', 'creak', 'blip']);
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
    default: return `Use ${t.name.toLowerCase()} on <b>${name}</b>`;
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
    this.say(f.variants[Game.cond[fid]].desc + (prompt ? ' ' + prompt : ''));
    this.renderNotes(); this.refresh();
    // zoom out of the spot you clicked
    const panel = $('inspectPanel'), gr = $('game').getBoundingClientRect(), pr = panel.getBoundingClientRect();
    if (origin) { const ox = gr.left + origin[0] / SW * gr.width - pr.left, oy = gr.top + origin[1] / SH * gr.height - pr.top; panel.style.setProperty('--zx', ox + 'px'); panel.style.setProperty('--zy', oy + 'px'); }
    UI.open('inspectScreen'); Audio2.sfx('swish', .7);
    if (Game.tool === 'walk') Game.setTool('look');
    Game.seen.add(fid);
  },
  onClose() { this.fid = null; $('zoomLabel').innerHTML = ''; },
  say(text, who) {
    const d = $('inspectDesc'); d.innerHTML = '';
    if (who) { const s = document.createElement('span'); s.className = 'who'; s.textContent = who + ': '; d.append(s); }
    d.append(document.createTextNode(text));
  },
  refresh() {
    const m = Game.marks[this.fid], s = $('inspectStatus'), photo = Game.photos[this.fid];
    s.innerHTML = '';
    if (m) { const p = document.createElement('span'); p.className = 'cat-pill c' + m.cat; p.textContent = 'Marked: ' + CATS[m.cat].short; s.append(p); }
    if (photo) { const p = document.createElement('span'); p.className = 'cat-pill'; p.style.background = '#d4d8e0'; p.style.marginLeft = '.5em'; p.textContent = '\u{1F4F7} Photo'; s.append(p); }
    s.style.visibility = (m || photo) ? 'visible' : 'hidden';
  },
  renderNotes() {
    const list = $('notesList'), notes = Game.notes[this.fid] || [];
    list.replaceChildren(...notes.map(n => { const li = document.createElement('li'); li.textContent = n; return li; }));
    $('notesEmpty').style.display = notes.length ? 'none' : 'block';
    list.scrollTop = list.scrollHeight;
  },
  partAt(x, y) { for (const p of this.feat.parts) { const [px, py, pw, ph] = p.r; if (x >= px && y >= py && x < px + pw && y < py + ph) return p; } return null; },
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
    if (!part) { if (tool === 'look') this.say(this.feat.variants[Game.cond[this.fid]].desc); return; }
    this.use(part, tool);
  },
  use(part, tool) {
    const f = this.feat, r = resolveResp(f, Game.cond[f.id], part.id, tool);
    Game.actions++;
    if (!r) { this.say(GENERIC[tool] ? GENERIC[tool](part.name) : 'Nothing happens.', TOOL[tool].name); playSfx(TOOL_SFX[tool]); return; }
    if (r.set) { (Game.flags[f.id] = Game.flags[f.id] || {})[r.set] = Game.t; Rooms.invalidate(f.room); }
    if (r.clue) (Game.clues[f.id] = Game.clues[f.id] || new Set()).add(r.clue);
    playSfx(r.sfx || TOOL_SFX[tool]);
    this.say(r.t, TOOL[tool].name);
    if (tool !== 'talk') {
      const note = r.t, list = Game.notes[f.id] = Game.notes[f.id] || [];
      if (!list.includes(note)) { list.push(note); this.renderNotes(); if (tool !== 'look') Audio2.synth('pencil'); }
    }
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
    if (this.hover && Settings.get('hotspots') !== 'off') {
      const [x, y, w, h] = this.hover.r;
      g.save(); g.setLineDash([2, 2]); g.lineDashOffset = -Math.floor(t * 8); g.strokeStyle = 'rgba(255,236,190,0.9)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, w - 1, h - 1); g.restore();
    }
  }
};
