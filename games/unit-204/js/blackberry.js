'use strict';
/* ============================== DANA'S BLACKBERRY ==============================
   Hazards have to be called in to maintenance, not just written down. Dana lends you her BlackBerry Curve for it
   (she offers before you leave, or ask her any time). The phone opens big, in the middle of the screen: a home
   screen with Phone, Messages, Snake, Ringtones, and Calendar. The call to Gus is a Scenemaker project
   (scenes/maint-report.vnproj, embedded as MAINT_CALLS.report): this file plays it on the phone's little screen,
   feeding it one hazard from your form at a time. The other apps are for fun, and if you play with them too long
   instead of calling, Dana notices.
   Controls: click, or the arrow keys and Enter; Esc (or the back key) goes back a screen, then puts it away. */
const BB_APPS = [
  { id: 'phone', name: 'Phone', col: '#3f9a3a' }, { id: 'msgs', name: 'Messages', col: '#3a6ad0' }, { id: 'snake', name: 'Snake', col: '#6a9a2a' },
  { id: 'tones', name: 'Ringtones', col: '#c0508a' }, { id: 'cal', name: 'Calendar', col: '#d08a2a' }
];
const BB_CONTACTS = [
  { id: 'gus', name: 'GUS (MAINT)' }, { id: 'pat', name: 'PAT OKAFOR' }, { id: 'mom', name: 'MOM' }   // restaurants come and go (js/takeout.js)
];
const BB_TEXTS = [
  ['Pat Okafor', 'Did the 204 walkthrough start? Need the report by 5. Thx'],
  ['Gus (Maint)', 'who took my stapler'],
  ['Mom', 'Call your grandmother. Also what is a "tweet"'],
  ['555-0142', 'CONGRATS!! U have won a FREE ringtone!!! Reply YES to claim (charges may apply)'],
  ['Jen', 'r we still doing LOST night?? NO SPOILERS'],
  ['Gus (Maint)', 'nvm found it. its red now??']
];
const BB_TONES = [
  { name: 'BlackBerry Classic', notes: [[784, .1], [988, .1], [1175, .1], [988, .1], [784, .2]] },
  { name: 'Old Phone', notes: [[1200, .05], [0, .03], [1200, .05], [0, .03], [1200, .05], [0, .03], [1200, .05], [0, .25], [1200, .05], [0, .03], [1200, .05]] },
  { name: "Dana's: 'Umbrella'", notes: [[622, .16], [622, .16], [554, .16], [622, .3], [0, .08], [740, .16], [622, .3]] },
  { name: 'Crazy Frog', notes: [[587, .12], [698, .09], [587, .09], [587, .05], [784, .09], [587, .09], [523, .09], [587, .12], [880, .09], [587, .09]] },
  { name: 'Vibrate', notes: [[70, .35], [0, .15], [70, .35]], wave: 'sawtooth' }
];
const BB_CAL = ['TODAY  2:00 PM  Move-out walkthrough, 204', 'TODAY  5:00 PM  Report due to Pat', 'TODAY  7:30 PM  Wii Fit (!!)', 'THU    9:00 AM  Dentist (reschedule??)', 'FRI    LOST night @ Jen\'s'];
const DANA_NAGS = [
  "Dana: Um, boss? Maintenance closes at five.",
  "Dana: Is that my Snake high score you're going for? Call Gus first. Please.",
  "Dana: Okay, I'm going to need that back eventually. Call maintenance, then play all you want."
];
const BlackBerry = {
  screen: 'home', sel: 0, fun: 0, nag: 0, then: null, call: null, _last: 0,
  /* the hazards on your form, in the shape the call wants */
  hazards() {
    return Object.entries(Game.marks).filter(([, m]) => m.cat === 3).map(([fid]) => {
      const f = FEATURE[fid] || ANOMALY[fid], tr = truth(fid), d = FEATURE[fid] ? f.variants[Game.cond[fid]].desc : f.look || '';
      const what = tr.cat === 3 && d ? `The ${lower(f.name)}: ${d.replace(/\.$/, '').replace(/^./, c => c.toLowerCase())}` : `The ${lower(f.name)}. It looks unsafe`;
      return { fid, hazard: what, where: ROOMS[f.room].name.toLowerCase(), safe: Utilities.safe(fid) };
    });
  },
  pending() { const n = Game.notified || new Set(); return this.hazards().filter(h => !n.has(h.fid)); },
  /* ---------- the phone itself ---------- */
  build() {
    if ($('bbScreen')) return;
    const s = document.createElement('section'); s.id = 'bbScreen'; s.className = 'overlay dim';
    s.innerHTML = `<div class="bb-device" id="bbDevice"><canvas id="bbArt" width="112" height="184"></canvas>
      <div class="bb-screen" id="bbLcd"><div class="bb-status"><span id="bbClock">4:47p</span><span class="bb-edge">EDGE</span><span class="bb-bars"></span></div><div class="bb-body" id="bbBody"></div><div class="bb-nag" id="bbNag"></div></div>
      <button class="bb-key k-call" id="bbKCall" type="button" aria-label="Call" data-tip="Call|Open the phone."></button>
      <button class="bb-key k-menu" id="bbKMenu" type="button" aria-label="Menu" data-tip="Menu|Back to the home screen."></button>
      <button class="bb-key k-ball" id="bbKBall" type="button" aria-label="Trackball" data-tip="Trackball|Click its edges to move, its middle to select."></button>
      <button class="bb-key k-back" id="bbKBack" type="button" aria-label="Back" data-tip="Back|Back a screen. (Esc)"></button>
      <button class="bb-key k-end" id="bbKEnd" type="button" aria-label="End" data-tip="End|Hang up, or put the phone away."></button></div>`;
    $('game').append(s);
    s.addEventListener('mousedown', e => { if (e.target === s) this.close(); });
    $('bbKCall').addEventListener('click', () => this.go('phone'));
    $('bbKMenu').addEventListener('click', () => this.home());
    $('bbKBack').addEventListener('click', () => this.back());
    $('bbKEnd').addEventListener('click', () => this.call ? this.hangUp() : this.close());
    $('bbKBall').addEventListener('click', e => {                 // the trackball: its edges steer, its middle clicks
      const r = e.currentTarget.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
      if (Math.hypot(dx, dy) < .2) return this.key('Enter');
      this.key(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'ArrowLeft' : 'ArrowRight') : (dy < 0 ? 'ArrowUp' : 'ArrowDown'));
    });
    window.addEventListener('keydown', e => {                      // first dibs on keys while the phone is up (Esc goes back a screen)
      if (UI.top() !== 'bbScreen') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', ' ', 'w', 'a', 's', 'd'].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); this.key(e.key); }
    }, true);
    this.paintBody();
  },
  open(then) {
    this.build(); this.then = then || null; this.fun = 0; this._last = performance.now();
    UI.open('bbScreen'); Audio2.synth('blip'); this.home();
    const n = this.pending().length;
    this.say(n ? `Dana: Gus is in my contacts. Phone, then GUS (MAINT).` : '');
  },
  close() {
    if (this.call) this.hangUp(true);
    this.stopSnake(); UI.close('bbScreen');
    const t = this.then; this.then = null; if (t) setTimeout(t, 250);
  },
  say(text) { const n = $('bbNag'); if (!n) return; n.textContent = text; n.classList.toggle('on', !!text); clearTimeout(this._nt); if (text) this._nt = setTimeout(() => n.classList.remove('on'), 6000); },
  /* the body of the phone, drawn as pixel art: a dark rounded slab, a silver band, the keyboard, and the trackball */
  paintBody() {
    const c = $('bbArt'), g = c.getContext('2d'), W = 112, H = 184; g.clearRect(0, 0, W, H);
    const rr = (x, y, w, h, r, col) => { g.fillStyle = col; for (let j = 0; j < h; j++) { const d = j < r ? r - j - .5 : j >= h - r ? j - (h - r) + .5 : -1, ins = d < 0 ? 0 : Math.round(r - Math.sqrt(Math.max(0, r * r - d * d))); g.fillRect(x + ins, y + j, w - 2 * ins, 1); } };
    rr(0, 0, W, H, 14, '#0e0e12'); rr(1, 1, W - 2, H - 2, 13, '#26262e'); rr(3, 3, W - 6, H - 6, 11, '#1a1a20');
    g.fillStyle = '#3a3a44'; g.fillRect(14, 4, W - 28, 1);                                        // a shine along the top
    pxRect(g, 44, 7, 24, 2, '#0a0a0c'); for (let i = 0; i < 5; i++) pxRect(g, 47 + i * 4, 7, 2, 1, '#2a2a32');   // earpiece
    pxRect(g, 8, 14, 96, 74, '#08080a');                                                           // the screen's black bezel
    pxRect(g, 6, 96, 100, 18, '#9aa0ab'); pxRect(g, 6, 96, 100, 1, '#c8ccd4'); pxRect(g, 6, 113, 100, 1, '#6a707a');   // the silver band of keys
    const keyAt = (x, col, glyph) => { rr(x, 99, 16, 12, 3, '#3a3a44'); rr(x + 1, 100, 14, 10, 3, '#4a4a56'); g.fillStyle = col; glyph(x); };
    keyAt(8, '#5ad05a', x => { pxRect(g, x + 4, 104, 8, 2, '#5ad05a'); pxRect(g, x + 4, 102, 2, 2, '#5ad05a'); pxRect(g, x + 10, 102, 2, 2, '#5ad05a'); });     // call
    keyAt(26, '#c8ccd4', x => { for (const [dx, dy] of [[4, 102], [8, 102], [4, 106], [8, 106]]) pxRect(g, x + dx, dy, 3, 3, '#c8ccd4'); });                 // menu (the BlackBerry dots)
    keyAt(70, '#c8ccd4', x => { pxRect(g, x + 5, 103, 6, 1, '#c8ccd4'); pxRect(g, x + 4, 102, 1, 3, '#c8ccd4'); pxRect(g, x + 10, 104, 1, 3, '#c8ccd4'); pxRect(g, x + 5, 106, 6, 1, '#c8ccd4'); });   // back
    keyAt(88, '#e04a3a', x => { pxRect(g, x + 4, 104, 8, 2, '#e04a3a'); pxRect(g, x + 4, 106, 2, 2, '#e04a3a'); pxRect(g, x + 10, 106, 2, 2, '#e04a3a'); });     // end
    pxEllipse(g, 56, 105, 7, 7, '#2a2a30'); pxEllipse(g, 56, 105, 5, 5, '#e8eaf0'); pxEllipse(g, 55, 104, 3, 3, '#ffffff'); pxRect(g, 53, 102, 2, 1, '#ffffff');   // the pearl trackball
    // the QWERTY keyboard: four rows of little keys with letters
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM', '  SPACE  '];
    rows.forEach((row, j) => {
      const n = j === 3 ? 1 : row.length, kw = j === 3 ? 40 : 8, gap = 1.6, total = n * kw + (n - 1) * gap, x0 = Math.round((W - total) / 2), y = 120 + j * 14;
      for (let i = 0; i < n; i++) {
        const x = Math.round(x0 + i * (kw + gap)); rr(x, y, kw, 11, 2, '#0a0a0e'); rr(x, y, kw, 10, 2, '#3a3a46'); pxRect(g, x + 1, y + 1, kw - 2, 1, '#5a5a68');
        if (j < 3) { const ch = row[i]; g.fillStyle = '#e8eaf0'; g.font = '6px monospace'; g.textAlign = 'center'; g.fillText(ch, x + kw / 2, y + 8); }
      }
    });
    pxRect(g, 36, 177, 40, 2, '#0a0a0c');                                                          // the BlackBerry wordmark, more or less
  },
  /* ---------- screens ---------- */
  body() { return $('bbBody'); },
  home() { if (this.call) return; this.stopSnake(); this.screen = 'home'; this.sel = 0; this.render(); },
  back() {
    if (this.call) return this.hangUp();
    if (this.screen === 'home') return this.close();
    if (this.screen === 'thread') { this.screen = 'msgs'; return this.render(); }
    this.home();
  },
  go(id) {
    if (this.call) return;
    this.stopSnake(); this.screen = id; this.sel = 0; Audio2.synth('blip');
    if (id === 'snake') this.startSnake();
    this.render();
  },
  isFun() { return ['msgs', 'thread', 'snake', 'tones', 'cal'].includes(this.screen); },
  /* a list of rows you can move through and pick from */
  rows() {
    switch (this.screen) {
      case 'home': return BB_APPS.map(a => ({ label: a.name, app: a, act: () => this.go(a.id) }));
      case 'phone': return [...BB_CONTACTS.map(c => ({ label: c.name + (c.id === 'gus' && this.pending().length ? '  !' : ''), act: () => this.dial(c.id) })), ...Takeout.rows()];
      case 'msgs': return BB_TEXTS.map((m, i) => ({ label: m[0], sub: m[1], act: () => { this.thread = i; this.screen = 'thread'; this.render(); } }));
      case 'tones': return BB_TONES.map(t => ({ label: t.name, act: () => this.play(t) }));
      case 'cal': return BB_CAL.map(c => ({ label: c, act: () => {} }));
      default: return [];
    }
  },
  render() {
    const b = this.body(); if (!b) return;
    b.className = 'bb-body s-' + this.screen;
    if (this.screen === 'snake') return;                          // the game draws itself
    if (this.screen === 'call') return this.renderCall();
    const title = { home: 'Dana\u2019s Curve', phone: 'Contacts', msgs: 'Messages', tones: 'Ringtones', cal: 'Calendar', thread: BB_TEXTS[this.thread] ? BB_TEXTS[this.thread][0] : '' }[this.screen];
    const h = document.createElement('div'); h.className = 'bb-title'; h.textContent = title;
    if (this.screen === 'thread') {
      const m = BB_TEXTS[this.thread], p = document.createElement('p'); p.className = 'bb-bubble'; p.textContent = m[1].replace(/\b204\b/g, Game.unit || '204');
      const hint = document.createElement('p'); hint.className = 'bb-hint'; hint.textContent = 'Back to return.';
      return b.replaceChildren(h, p, hint);
    }
    const rows = this.rows(), list = document.createElement('div'); list.className = this.screen === 'home' ? 'bb-grid' : 'bb-list';
    rows.forEach((r, i) => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'bb-row' + (i === this.sel ? ' sel' : '');
      if (r.app) { const ic = document.createElement('i'); ic.style.background = r.app.col; ic.textContent = r.app.name[0]; el.append(ic); }
      const u = x => x.replace(/\b204\b/g, Game.unit || '204');   // whichever unit this shift is
      const t = document.createElement('span'); t.textContent = u(r.label); el.append(t);
      if (r.sub) { const s = document.createElement('small'); s.textContent = u(r.sub); el.append(s); }
      el.addEventListener('click', () => { this.sel = i; r.act(); });
      el.addEventListener('pointermove', () => { if (this.sel === i) return; this.sel = i; list.querySelectorAll('.bb-row').forEach((x, k) => x.classList.toggle('sel', k === i)); });   // a real move, not the phone appearing under a resting pointer
      list.append(el);
    });
    b.replaceChildren(h, list);
    const s = list.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
  },
  key(k) {
    Audio2.sfx('tick', .5);
    if (k === 'Escape') return this.back();
    if (this.screen === 'snake') return this.steer(k);
    if (this.screen === 'call') return this.callKey(k);
    const rows = this.rows(); if (!rows.length) return;
    const cols = this.screen === 'home' ? 3 : 1, d = { ArrowUp: -cols, ArrowDown: cols, ArrowLeft: -1, ArrowRight: 1, w: -cols, s: cols, a: -1, d: 1 }[k];
    if (d) { this.sel = (this.sel + d + rows.length) % rows.length; return this.render(); }
    if (k === 'Enter' || k === ' ') rows[this.sel].act();
  },
  play(t) {
    const A = Audio2; if (!A.ctx) return; if (A.ctx.state === 'suspended') A.ctx.resume();
    let at = A.ctx.currentTime + .02;
    for (const [f, d] of t.notes) { if (f) A.tone(at, f, d * .9, t.wave ? .06 : .045, t.wave || 'square'); at += d; }
  },
  /* ---------- Phone ---------- */
  dial(id) {
    const canned = {
      pat: ["You've reached Pat Okafor, Brickroad Property Management. Leave a message, and if this is about a deposit, I've already heard it.", 'Beep. You hang up before saying anything. Classic.'],
      mom: ["Dana leans over: 'Do NOT call my mom.'", 'You hang up before it rings. Probably for the best.']
    };
    if (id !== 'gus') { this.call = { canned: canned[id], i: 0, name: BB_CONTACTS.find(c => c.id === id).name }; this.screen = 'call'; Audio2.synth('blip'); return this.render(); }
    const list = this.pending();
    if (!list.length) {
      this.call = { canned: [Object.keys(Game.marks).some(k => Game.marks[k].cat === 3) ? "Gus: You already called about those. I've got 'em on the board. Go home." : "Gus: Brickroad Maintenance. ...Nothing to report? Then quit tying up the line, friend. Click."], i: 0, name: 'GUS (MAINT)' };
      this.screen = 'call'; return this.render();
    }
    // the Scenemaker call: one pass through 'next' per hazard; 'another' loads the next one
    const proj = MAINT_CALLS.report; this.call = { proj, queue: list.slice(), cur: null, vars: {}, byName: {}, name: 'GUS (MAINT)', t0: performance.now() };
    for (const d of proj.variables) { this.call.byName[d.name] = d; this.call.vars[d.id] = d.initial; }
    this.setVar('unit', Game.unit || '204'); this.setVar('count', list.length); this.loadNext();
    this.screen = 'call'; Audio2.synth('ring'); this.fun = 0;
    this.goScene(proj.start);
  },
  setVar(n, v) { const d = this.call.byName[n]; if (d) this.call.vars[d.id] = v; },
  getVar(n) { const d = this.call.byName[n]; return d ? this.call.vars[d.id] : undefined; },
  loadNext() {
    const c = this.call, h = c.queue.shift(); c.cur = h || null; if (!h) return;
    this.setVar('hazard', h.hazard); this.setVar('where', h.where); this.setVar('safe', h.safe); this.setVar('more', c.queue.length > 0);
  },
  goScene(sid) {
    const c = this.call; c.scene = c.proj.scenes[sid]; c.line = 0; c.sid = sid;
    if (!c.scene) return this.endCall();
    if (/_another$/.test(sid)) this.loadNext();                    // Gus asks "what else?": the next hazard on the form
    if (!c.scene.lines.length) return this.afterLines();
    this.render();
  },
  sub(text) { return String(text || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, nm) => { const v = this.getVar(nm); return v === undefined ? '' : String(v); }); },
  /* the same condition tests and effects as the tenant calls' Scenemaker player (js/calls.js) */
  test(id, cmp, value) { const save = Calls.call, sv = Calls.vars; Calls.call = this.call.proj; Calls.vars = this.call.vars; const r = Calls.test(id, cmp, value); Calls.call = save; Calls.vars = sv; return r; },
  exits() { const s = this.call.scene; return s.choices.filter(ch => ((ch.outcomes || []).some(o => o.targetNode) || (ch.routes || []).some(r => r.target)) && (!ch.condition || !ch.condition.var || this.test(ch.condition.var, ch.condition.cmp || '==', ch.condition.value))); },
  afterLines() {
    const ex = this.exits();
    if (!ex.length) return this.endCall();
    if (ex.length === 1 && ex[0].continue) return this.pick(ex[0]);
    this.call.choosing = ex; this.sel = 0; this.render();
  },
  pick(ch) {
    const c = this.call, before = Number(this.getVar('reported')) || 0;
    const save = Calls.call, sv = Calls.vars; Calls.call = c.proj; Calls.vars = c.vars; Calls.apply(ch.effects); Calls.call = save; Calls.vars = sv;
    if ((Number(this.getVar('reported')) || 0) > before && c.cur) (Game.notified = Game.notified || new Set()).add(c.cur.fid);   // Gus has it on the board
    c.choosing = null; c.said = ch.continue ? null : this.sub(ch.text);
    let target = null;
    for (const r of ch.routes || []) { if (r.target && (!r.var || this.test(r.var, r.cmp || '==', r.value))) { target = r.target; break; } }
    if (!target) target = (ch.outcomes || []).map(o => o.targetNode).find(Boolean);
    this.goScene(target);
  },
  callKey(k) {
    const c = this.call;
    if (c.order) return Takeout.key(c, k);
    if (c.canned) { if (k === 'Enter' || k === ' ') { c.i++; if (c.i >= c.canned.length) return this.hangUp(); this.render(); } return; }
    if (c.choosing) {
      const d = { ArrowUp: -1, ArrowDown: 1, w: -1, s: 1 }[k];
      if (d) { this.sel = (this.sel + d + c.choosing.length) % c.choosing.length; return this.render(); }
      if (k === 'Enter' || k === ' ') { Audio2.synth('click'); return this.pick(c.choosing[this.sel]); }
      return;
    }
    if (k === 'Enter' || k === ' ') { c.said = null; if (c.line < c.scene.lines.length - 1) { c.line++; return this.render(); } this.afterLines(); }
  },
  renderCall() {
    const b = this.body(), c = this.call, h = document.createElement('div'); h.className = 'bb-title call';
    const secs = c.t0 ? Math.floor((performance.now() - c.t0) / 1000) : 0;
    h.textContent = `${c.name}  ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    const out = [h];
    const line = (who, text, cls) => { const p = document.createElement('p'); p.className = 'bb-line ' + (cls || ''); if (who) { const n = document.createElement('b'); n.textContent = who + ': '; p.append(n); } p.append(text); out.push(p); };
    const next = label => { const nb = document.createElement('button'); nb.type = 'button'; nb.className = 'bb-row sel bb-next'; nb.textContent = label; nb.addEventListener('click', () => this.callKey('Enter')); out.push(nb); };
    const choice = (text, i, fn) => { const el = document.createElement('button'); el.type = 'button'; el.className = 'bb-row bb-choice' + (i === this.sel ? ' sel' : ''); el.textContent = text;
      el.addEventListener('click', () => { Audio2.synth('click'); fn(); });
      el.addEventListener('pointermove', () => { if (this.sel === i) return; this.sel = i; b.querySelectorAll('.bb-choice').forEach((x, k) => x.classList.toggle('sel', k === i)); });   // move the highlight with the pointer, like the menus
      out.push(el); };
    if (c.order) { Takeout.render(c, line, next, choice); b.replaceChildren(...out); const s = b.querySelector('.bb-choice.sel'); if (s) s.scrollIntoView({ block: 'nearest' }); return; }
    if (c.canned) { line('', c.canned[c.i], 'narr'); next(c.i < c.canned.length - 1 ? '\u25B6 Next' : '\u25B6 Hang up'); return b.replaceChildren(...out); }
    if (c.said) line('You', c.said, 'you');
    if (c.choosing) {
      if (!c.said) { const last = c.scene.lines[c.scene.lines.length - 1]; if (last) line(last.unattributed ? '' : last.speaker, this.sub(last.text), last.unattributed ? 'narr' : 'gus'); }
      c.choosing.forEach((ch, i) => choice(ch.continue ? 'Continue' : this.sub(ch.text), i, () => this.pick(ch)));;   // move the highlight with the pointer, like the menus
    } else {
      const l = c.scene.lines[c.line]; line(l.unattributed ? '' : l.speaker, this.sub(l.text), l.unattributed ? 'narr' : 'gus'); next('\u25B6 Next');
    }
    b.replaceChildren(...out);
    const s = b.querySelector('.bb-choice.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
  },
  endCall() {
    const c = this.call; if (!c) return;
    if (c.proj) Game.maint = { reported: Number(this.getVar('reported')) || 0, pro: clamp(Number(this.getVar('pro')) || 0, 0, 100), silly: !!this.getVar('silly'), urgent: !!this.getVar('urgent') };
    Audio2.synth('hangup'); this.call = null; this.screen = 'phone'; this.sel = 0; this.render();
    if (c.proj) this.say(this.pending().length ? 'Dana: You missed one. Call him back?' : 'Dana: Nice. Gus likes you. Gus doesn\'t like anybody.');
  },
  hangUp(quiet) { if (!this.call) return; const c = this.call; if (c.proj) { this.endCall(); return; } this.call = null; if (!quiet) Audio2.synth('hangup'); this.screen = 'phone'; this.render(); },
  /* ---------- Snake ---------- */
  startSnake() {
    const b = this.body(); if (!b) return; b.className = 'bb-body s-snake';
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 112; cv.id = 'bbSnake';
    const hud = document.createElement('div'); hud.className = 'bb-title'; hud.id = 'bbSnakeHud';
    b.replaceChildren(hud, cv);
    this.sn = { body: [[6, 7], [5, 7], [4, 7]], dir: [1, 0], next: [1, 0], food: [14, 7], score: 0, over: false, acc: 0, best: Math.max(47, this.sn ? this.sn.best : 0) };
    this.snakeHud(); this.drawSnake();
    clearInterval(this._snk); this._snk = setInterval(() => this.stepSnake(), 1000 / 7);
  },
  stopSnake() { clearInterval(this._snk); this._snk = 0; },
  snakeHud() { const h = $('bbSnakeHud'); if (h) h.textContent = this.sn.over ? `GAME OVER  ${this.sn.score}   (OK: again)` : `SNAKE   ${this.sn.score}    DANA: ${this.sn.best}`; },
  steer(k) {
    const s = this.sn; if (!s) return;
    if (s.over) { if (k === 'Enter' || k === ' ') this.startSnake(); return; }
    const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[k];
    if (d && !(d[0] === -s.dir[0] && d[1] === -s.dir[1])) s.next = d;
  },
  stepSnake() {
    const s = this.sn; if (!s || s.over || UI.top() !== 'bbScreen' || this.screen !== 'snake') return;
    s.dir = s.next; const [hx, hy] = s.body[0], n = [hx + s.dir[0], hy + s.dir[1]];
    if (n[0] < 0 || n[1] < 0 || n[0] >= 20 || n[1] >= 14 || s.body.some(([x, y]) => x === n[0] && y === n[1])) { s.over = true; Audio2.synth('wrong'); this.snakeHud(); return this.drawSnake(); }
    s.body.unshift(n);
    if (n[0] === s.food[0] && n[1] === s.food[1]) {
      s.score++; Audio2.synth('blip'); if (s.score >= 10) Achievements.unlock('snake');
      do { s.food = [Math.floor(Math.random() * 20), Math.floor(Math.random() * 14)]; } while (s.body.some(([x, y]) => x === s.food[0] && y === s.food[1]));
      this.snakeHud();
    } else s.body.pop();
    this.drawSnake();
  },
  drawSnake() {
    const cv = $('bbSnake'); if (!cv) return; const g = cv.getContext('2d'), s = this.sn;
    g.fillStyle = '#9ab07a'; g.fillRect(0, 0, 160, 112); g.fillStyle = '#8aa06a'; for (let y = 0; y < 112; y += 8) g.fillRect(0, y, 160, 1);   // that green LCD
    g.fillStyle = '#2a3a1a'; for (const [x, y] of s.body) g.fillRect(x * 8 + 1, y * 8 + 1, 6, 6);
    g.fillRect(s.food[0] * 8 + 3, s.food[1] * 8 + 1, 2, 6); g.fillRect(s.food[0] * 8 + 1, s.food[1] * 8 + 3, 6, 2);
    if (s.over) { g.fillStyle = 'rgba(42,58,26,0.7)'; g.fillRect(0, 44, 160, 24); g.fillStyle = '#c8e0a0'; g.font = '10px monospace'; g.textAlign = 'center'; g.fillText('GAME OVER', 80, 60); }
  },
  /* ---------- every frame: the clock, the call timer, and Dana keeping an eye on you ---------- */
  tick() {
    if (!UI.isOpen('bbScreen')) return;
    const now = performance.now(), dt = (now - this._last) / 1000; this._last = now;
    const c = $('bbClock'); if (c) c.textContent = '4:' + String(47 + Math.floor(Game.t / 60) % 12).padStart(2, '0') + 'p';
    if (this.screen === 'call' && this.call && this.call.t0 && (Math.floor(now / 1000) !== Math.floor((now - dt * 1000) / 1000))) { const h = this.body().querySelector('.bb-title.call'); if (h) h.textContent = h.textContent.replace(/\d\d:\d\d$/, () => { const s = Math.floor((now - this.call.t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }); }
    if (this.isFun() && this.pending().length) {                    // playing instead of calling: Dana notices
      this.fun += dt;
      const at = [20, 45, 80][this.nag];
      if (at && this.fun > at) { this.say(DANA_NAGS[this.nag]); this.nag++; }
    }
  }
};
