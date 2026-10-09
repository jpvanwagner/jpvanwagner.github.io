'use strict';
/* ============================== SETTINGS ==============================
   Saved in localStorage when the browser allows it; the game runs fine without. */
const SETTING_DEFS = [
  { sec: 'Sound' },
  { id: 'master', name: 'Master volume', type: 'range', def: 0.8 },
  { id: 'music', name: 'Music', note: 'Lounge tunes from the leasing office radio', type: 'range', def: 0.35 },
  { id: 'ambience', name: 'Ambience', note: 'Traffic and birds outside the windows', type: 'range', def: 0.5 },
  { id: 'sfx', name: 'Sound effects', type: 'range', def: 0.8 },
  { sec: 'Gameplay' },
  { id: 'feedback', name: 'Feedback', note: 'Right after each mark, or all at once in the final report', type: 'seg', def: 'now', opts: [['now', 'Immediate'], ['end', 'End of shift']] },
  { id: 'hotspots', name: 'Hotspot hints', note: 'Show what you can interact with', type: 'seg', def: 'hover', opts: [['off', 'Off'], ['hover', 'On hover'], ['always', 'Always']] },
  { id: 'danaHints', name: "Dana's hints", note: 'Your assistant chimes in when you stall', type: 'seg', def: true, opts: [[true, 'On'], [false, 'Off']] },
  { id: 'textSpeed', name: 'Text speed', type: 'seg', def: 1, opts: [[0.6, 'Slow'], [1, 'Normal'], [1.6, 'Fast']] },
  { sec: 'Display' },
  { id: 'dither', name: 'Dithered accents', note: 'Retro pixel dithering on character shadows', type: 'seg', def: true, opts: [[true, 'On'], [false, 'Off']] },
  { id: 'motion', name: 'Ambient animation', note: 'Swaying trees, dust, flicker and screen flashes', type: 'seg', def: true, opts: [[true, 'On'], [false, 'Reduced']] },
  { id: 'bigCursor', name: 'Large cursors', type: 'seg', def: false, opts: [[false, 'Normal'], [true, 'Large']] },
  { id: 'tags', name: 'Tag marked items', note: 'Little paper tags on items already on your form', type: 'seg', def: true, opts: [[true, 'On'], [false, 'Off']] }
];
const Settings = {
  v: {},
  load() {
    const saved = store('unit204-settings') || {};
    for (const d of SETTING_DEFS) if (d.id) this.v[d.id] = d.id in saved ? saved[d.id] : d.def;
  },
  get(id) { return this.v[id]; },
  set(id, val) {
    this.v[id] = val; store('unit204-settings', this.v);
    if (id === 'dither') clearDitherCache();
    this.apply(id);
  },
  reset() { for (const d of SETTING_DEFS) if (d.id) this.v[d.id] = d.def; store('unit204-settings', this.v); clearDitherCache(); this.apply(); this.build(); },
  apply(id) {
    if (!id || ['master', 'music', 'ambience', 'sfx'].includes(id)) Audio2.volumes();
    if (!id || id === 'bigCursor') Icons.applyCursors();
    if (!id || id === 'motion') $('game').classList.toggle('calm', !this.v.motion);
    if (!id || id === 'dither') { if (typeof Rooms !== 'undefined') Rooms.invalidate(); }
  },
  build() {
    const body = $('settingsBody'); body.replaceChildren();
    for (const d of SETTING_DEFS) {
      if (d.sec) { const h = document.createElement('div'); h.className = 'set-sec'; h.textContent = d.sec; body.append(h); continue; }
      const row = document.createElement('div'); row.className = 'set-row';
      const nm = document.createElement('div'); nm.className = 'set-name'; nm.textContent = d.name;
      if (d.note) { const s = document.createElement('small'); s.textContent = d.note; nm.append(s); }
      row.append(nm);
      if (d.type === 'range') {
        const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.05; r.value = this.v[d.id];
        r.setAttribute('aria-label', d.name);
        r.addEventListener('input', () => this.set(d.id, +r.value));
        r.addEventListener('change', () => Audio2.sfx('click'));
        row.append(r);
      } else {
        const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', d.name);
        for (const [val, label] of d.opts) {
          const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
          b.classList.toggle('on', this.v[d.id] === val);
          b.setAttribute('aria-pressed', this.v[d.id] === val);
          b.addEventListener('click', () => {
            this.set(d.id, val); Audio2.sfx('click');
            seg.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
          });
          seg.append(b);
        }
        row.append(seg);
      }
      body.append(row);
    }
  }
};
