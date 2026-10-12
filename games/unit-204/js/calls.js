'use strict';
/* ============================== THE TENANT CALLS ==============================
   Two weeks after the inspection, the old tenant phones the leasing office about the deposit. Each kind of call is a
   Scenemaker project in scenes/ (embedded by tools/build-scenes.py as TENANT_CALLS). This file picks the call your
   report sets up, fills in its variables from what you did (did you charge it? was it really damage? did you take
   a picture? did you measure?), plays it in the game's own style, and reads back how it went:
   the customer-service score, and whether a charge held up, got prorated, or got dropped and left the company
   with the bill. */
const TENANT_NAMES = ['Kevin Marsh', 'Jessica Tran', 'Brandon Okoye', 'Ashley Delgado', 'Tyler Brooks', 'Megan Kowalski', 'Marcus Reed', 'Lauren Whitfield', 'Derek Nakamura', 'Brittany Shaw'];
const CALL_DAYS = 30, DEPOSIT = 800;
const Calls = {
  call: null, scene: null, line: 0, vars: {}, done: null, _type: null, _t0: 0,

  /* ---------- which call, and what it's about ---------- */
  pick() {
    const charged = [];
    for (const f of FEATURES) {
      const m = Game.marks[f.id]; if (!m || m.cat !== 2) continue;
      const v = f.variants[Game.cond[f.id]], dmg = f.variants.find(x => x.cat === 2);
      const tapeV = f.variants.find(x => x.cat === 2 && Object.values(x.resp || {}).some(p => p.tape));
      charged.push({ id: f.id, name: f.name, truth: v.cat, cost: v.cost || (dmg && dmg.cost) || 90, why: v.why, photo: !!Game.photos[f.id], floor: !!f.floor,
        tape: v.cat === 2 && Object.values(v.resp || {}).some(p => p.tape), tapeText: tapeV ? Object.values(tapeV.resp).map(p => p.tape && (p.tape.t || p.tape)).find(x => typeof x === 'string') : null });
    }
    for (const id of Game.anomalies) {
      const a = ANOMALY[id], m = Game.marks[id]; if (!m || m.cat !== 2) continue;
      charged.push({ id, name: a.name, truth: a.cat, cost: 75, why: a.why, photo: !!Game.photos[id] });
    }
    const opts = [], add = (w, key, c) => opts.push({ w, key, c });
    for (const c of charged) {
      if (c.truth < 2) add(4, 'wear', c);                                   // you charged for wear: they'll call about that
      else if (!c.photo) add(3, c.tape ? 'size' : 'movein', c);          // a real charge with nothing to back it up
      else { add(1, c.tape ? 'size' : 'movein', c); add(1, 'explain', c); if (c.floor) add(2, 'cost', c); }
    }
    add(charged.length ? 1 : 3, 'refund', null);                        // sometimes they don't complain at all
    let r = Math.random() * opts.reduce((a, o) => a + o.w, 0), choice = opts[0];
    for (const o of opts) { r -= o.w; if (r <= 0) { choice = o; break; } }
    return { key: choice.key, c: choice.c, charged };
  },
  varsFor(key, c, charged) {
    const tenant = pick(TENANT_NAMES), total = charged.reduce((a, x) => a + x.cost, 0);
    const vars = { tenant, charges: charged.length > 0, refund: Math.max(0, DEPOSIT - total), days: CALL_DAYS, cs: 50, outcome: 'none' };
    if (c) {
      const tx = t => t ? t.replace(/\.$/, '').replace(/^./, ch => ch.toLowerCase()) : '';
      const years = 4 + Math.floor(Math.random() * 3), life = 7;
      Object.assign(vars, { item: lower(c.name), cost: c.cost, photo: c.photo, why: c.why, measured: !!Game.measures[c.id],
        size: tx(Game.measures[c.id] || c.tapeText || 'pretty big'), years, life, share: Math.max(10, Math.round(c.cost * Math.max(0, life - years) / life / 5) * 5),
        movein: key === 'movein' && Math.random() < .3 });                // sometimes the move-in checklist backs the tenant up
    }
    if (key === 'refund') {                                               // something they left behind: is it in your bag?
      const held = Game.bag.map(k => bagItem(k)), left = Object.values((Decor.cur && Decor.cur.clutter) || {}).flat().filter(x => !Game.taken.has(x.id));
      const name = x => itemPhrase(x.kind, x.c);                     // 'rental DVD of ...', 'wall calendar', 'phone charger': what it really is
      if (held.length && Math.random() < .6) { const it = pick(held); Object.assign(vars, { found: name(it), hasFound: true }); }
      else { const x = left.length ? pick(left) : null; Object.assign(vars, { found: x ? name({ kind: x.kind, c: x }) : 'phone charger', hasFound: false }); }
    }
    return vars;
  },

  /* ---------- playing a Scenemaker project ---------- */
  start(done) {
    if (!Sites.site.calls) { Game.call = null; return done(); }   // only some sites have a tenant who calls about a deposit (js/sites.js)
    const { key, c, charged } = this.pick();
    this.call = TENANT_CALLS[key]; this.key = key; this.subject = c; this.done = done; this.seed = Math.floor(Math.random() * 1000);   // a new order for the answers every call
    const given = this.varsFor(key, c, charged);
    this.vars = {}; this.byName = {};
    for (const d of this.call.variables) { this.byName[d.name] = d; this.vars[d.id] = d.name in given ? given[d.name] : d.initial; }
    this.tenant = given.tenant; this._t0 = performance.now();
    UI.closeAll(); UI.open('callScreen'); Audio2.synth('ring'); Music.play('call', 2.5);
    $('callerId').textContent = given.tenant; $('callerId').parentNode.title = 'Caller ID: ' + given.tenant;
    this.drawPhone(0);
    this.go(this.call.start);
  },
  get(name) { const d = this.byName[name]; return d ? this.vars[d.id] : undefined; },
  sub(text) { return String(text || '').replace(/\b204\b/g, Game.unit || '204').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, nm) => { const d = this.call.variables.find(v => v.name === nm || v.id === nm); return d ? String(this.vars[d.id]) : ''; }); },
  typeOf(id) { const d = this.call.variables.find(v => v.id === id); return (d && d.type) || 'number'; },
  test(id, cmp, value) {                       // the same comparisons Scenemaker's player makes
    const t = this.typeOf(id); let a = this.vars[id], b = value;
    if (t === 'bool') { a = a === true || a === 'true'; b = b === true || b === 'true'; return cmp === '!=' ? a !== b : a === b; }
    if (t === 'text') { a = String(a); b = String(b); return cmp === 'contains' ? a.includes(b) : cmp === '!=' ? a !== b : a === b; }
    a = Number(a); b = Number(b);
    return { '>=': a >= b, '<=': a <= b, '>': a > b, '<': a < b, '!=': a !== b }[cmp] ?? a === b;
  },
  apply(effects) {
    for (const e of effects || []) {
      const d = this.call.variables.find(v => v.id === e.var); if (!d) continue;
      const t = d.type || 'number', cur = this.vars[e.var];
      if (t === 'bool') this.vars[e.var] = e.op === 'toggle' ? !cur : (e.value === true || e.value === 'true');
      else if (t === 'text') this.vars[e.var] = String(e.value ?? '');
      else { let n = e.op === 'add' ? Number(cur) + Number(e.value) : e.op === 'sub' ? Number(cur) - Number(e.value) : Number(e.value); if (d.min != null) n = Math.max(d.min, n); if (d.max != null) n = Math.min(d.max, n); this.vars[e.var] = n; }
    }
  },
  go(sid) {
    this.scene = this.call.scenes[sid]; this.line = 0;
    if (!this.scene) return this.finish();
    if (!this.scene.lines.length) return this.showChoices();
    this.showLine();
  },
  showLine() {
    const l = this.scene.lines[this.line], spk = l.unattributed ? '' : (l.speaker || '');
    const who = spk === 'Tenant' ? 'tenant' : spk === 'You' ? 'you' : /^Pat/.test(spk) ? 'mgr' : 'narr';
    this.render(who, spk === 'Tenant' ? this.tenant : spk, this.sub(l.text));
    const last = this.line >= this.scene.lines.length - 1, exits = this.exits();
    if (last && exits.length && !(exits.length === 1 && exits[0].continue)) return this.showChoices(true);
    this.options([{ text: last && !exits.length ? 'Hang up' : 'Next', next: true }]);
  },
  exits() { return this.scene.choices.filter(c => (c.outcomes || []).some(o => o.targetNode) || (c.routes || []).some(r => r.target)).filter(c => !c.condition || !c.condition.var || this.test(c.condition.var, c.condition.cmp || '==', c.condition.value) || c.condition.hide !== 'hidden'); },
  advance() {
    if (this.line < this.scene.lines.length - 1) { this.line++; return this.showLine(); }
    const ex = this.exits();
    if (!ex.length) return this.finish();
    if (ex.length === 1 && ex[0].continue) return this.choose(ex[0]);
    this.showChoices();
  },
  showChoices(keepText) {
    if (!keepText) this.render('you', '', '');
    const order = c => hash([...String(c.text || c.id || '')].reduce((a, ch) => a * 31 + ch.charCodeAt(0) | 0, 7) % 9973 + (this.seed || 0));   // a steady shuffle, so the kind answer isn't always first
    this.options(this.exits().slice().sort((a, b) => order(a) - order(b)).map(c => ({ text: c.continue ? 'Continue' : this.sub(c.text), c, locked: c.condition && c.condition.var && !this.test(c.condition.var, c.condition.cmp || '==', c.condition.value) })));
  },
  choose(c) {
    this.apply(c.effects);
    if (!c.continue) this.render('you', 'You', this.sub(c.text), true);
    let target = null;
    for (const r of c.routes || []) { if (!r.target) continue; if (!r.var || this.test(r.var, r.cmp || '==', r.value)) { target = r.target; break; } }
    if (!target) target = (c.outcomes || []).map(o => o.targetNode).find(Boolean);
    if (c.continue) return this.go(target);
    this.options([{ text: 'Next', next: true, then: () => this.go(target) }]);
  },
  finish() {
    const v = n => this.get(n), c = this.subject;
    Game.call = { key: this.key, title: this.call.title, tenant: this.tenant, item: c ? c.name : null, id: c ? c.id : null, cost: c ? c.cost : 0, share: v('share') || 0,
      truth: c ? c.truth : null, photo: c ? c.photo : false, cs: v('cs'), outcome: v('outcome'), escalated: !!v('escalated'), promised: !!v('promised'),
      footBill: !!v('footBill'), threatened: !!v('threatened'), rude: !!v('rude'), flat: !!v('flat'), found: v('found'), hasFound: !!v('hasFound') };
    Audio2.synth('hangup'); clearTimeout(this._type);
    UI.close('callScreen'); const d = this.done; this.done = null; d && d();
  },

  /* ---------- the screen ---------- */
  render(who, name, text, instant) {
    const nm = $('callName'); nm.textContent = name; nm.className = 'dlg-name call-' + who;
    const p = $('callText'); p.className = who === 'narr' ? 'narr' : '';
    clearTimeout(this._type);
    if (instant || !Settings.get('motion')) p.textContent = text;
    else { let i = 0; const step = () => { i = Math.min(text.length, i + 2); p.textContent = text.slice(0, i); if (i < text.length) this._type = setTimeout(step, 14); }; step(); }
    const pc = $('callPortrait');
    if (who === 'you' || who === 'mgr') { pc.style.visibility = 'visible'; Sprites.portrait(pc, who, true); clearTimeout(this._m); this._m = setTimeout(() => Sprites.portrait(pc, who, false), 900); }
    else if (who === 'tenant') { pc.style.visibility = 'visible'; this.drawHandset(pc); }
    else pc.style.visibility = 'hidden';
    if (who !== 'narr' && text) Audio2.synth('blip');
  },
  options(list) {
    const box = $('callOptions'); box.replaceChildren();
    for (const o of list) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o.text;
      if (o.next) b.className = 'next';
      if (o.locked) { b.disabled = true; b.classList.add('locked'); }
      b.addEventListener('click', () => { Audio2.synth('click'); if (o.next) { if (o.then) o.then(); else this.advance(); } else this.choose(o.c); });
      box.append(b);
    }
    const first = box.querySelector('button:not(:disabled)'); if (first && !Phone.on) first.focus({ preventScroll: true });
  },
  /* the tenant is a voice on the line: a little handset with the caller ID instead of a face */
  drawHandset(c) {
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#2a3a5a'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#34466a'; for (let y = 0; y < c.height; y += 4) g.fillRect(0, y, c.width, 1);
    pxRect(g, 9, 6, 22, 30, '#e8dcc0'); pxRect(g, 9, 6, 22, 2, '#fff6dc'); pxRect(g, 11, 9, 18, 7, '#9ab07a'); pxRect(g, 12, 10, 16, 5, '#b8d090');
    for (let i = 0; i < 3; i++) pxRect(g, 13 + i * 5, 11, 3, 1, '#3a4a2a');
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) pxRect(g, 12 + k * 6, 19 + r * 5, 4, 3, '#c8bc9e');
    const blink = Math.floor(performance.now() / 400) % 2; pxRect(g, 30, 4, 3, 3, blink ? '#ff4a3a' : '#7a2a20');
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(33 + i * 2, 18 - i * 3, 1, 6 + i * 6); }
  },
  drawPhone(t) {                               // the desk at the leasing office: phone, caller ID, the deposit statement
    const c = $('callArt'), g = c.getContext('2d'), W = c.width, H = c.height; g.imageSmoothingEnabled = false;
    g.fillStyle = '#c9b48a'; g.fillRect(0, 0, W, H); g.fillStyle = '#b89f74'; for (let y = 3; y < H; y += 7) g.fillRect(0, y, W, 1);          // desk
    g.fillStyle = '#a68a5e'; g.fillRect(0, H - 4, W, 4);
    // the deposit statement: letterhead, the line items and their amounts, a boxed total, a sticky note, a pen, and a coffee ring
    pxRect(g, 15, 11, 46, 42, 'rgba(60,40,20,0.25)'); pxRect(g, 13, 8, 46, 42, '#fbf8ee'); pxRect(g, 13, 8, 46, 1, '#ffffff');
    pxRect(g, 16, 11, 4, 4, '#f28c28'); pxRect(g, 22, 11, 20, 1, '#2a2430'); pxRect(g, 22, 13, 14, 1, '#8a8478');   // logo, company name, address
    pxRect(g, 16, 18, 26, 2, '#2a2430');                                                                        // STATEMENT OF DEPOSIT
    for (let i = 0; i < 5; i++) { const y = 23 + i * 4; pxRect(g, 16, y, 16 + (i * 7) % 9, 1, '#6a6458'); pxRect(g, 46, y, 8 - (i % 2) * 2, 1, '#6a6458'); pxRect(g, 15, y + 2, 41, 1, '#e8e2d2'); }   // items, amounts, rules
    pxRect(g, 40, 43, 16, 5, '#2a2430'); pxRect(g, 41, 44, 14, 3, '#fbf8ee'); pxRect(g, 43, 45, 10, 1, '#d43a2a');  // the total, boxed
    pxRect(g, 44, 4, 14, 13, '#f6e27a'); pxRect(g, 44, 4, 14, 3, '#efd060'); pxLine(g, 46, 10, 54, 9, '#3a5ad0'); pxLine(g, 46, 13, 52, 13, '#3a5ad0');   // a sticky note: call back by Fri
    pxLine(g, 18, 54, 40, 49, '#1d3a8a', 2); pxRect(g, 38, 48, 3, 2, '#c9ccd4'); pxRect(g, 17, 54, 2, 1, '#2a2a30');    // a pen, lying across it
    for (let a = 0; a < 6.28; a += .25) pxRect(g, 30 + Math.cos(a) * 6, 40 + Math.sin(a) * 3, 1, 1, 'rgba(120,80,40,0.35)');   // an old coffee ring
    // the coffee mug, in three-quarter view: a round body, shaded, with a rim, a looped handle, and steam
    const mx = 80, my = 14;   // up the desk, clear of the phone cord
    pxEllipse(g, mx + 1, my + 15, 10, 3, 'rgba(60,40,20,0.3)');                                                // its shadow on the desk
    pxRect(g, mx - 8, my, 16, 14, '#e8e2d6'); pxEllipse(g, mx, my + 14, 8, 2, '#e8e2d6');                      // the body
    pxRect(g, mx - 8, my, 4, 14, '#cfc8b8'); pxEllipse(g, mx - 6, my + 14, 2, 1, '#cfc8b8'); pxRect(g, mx + 4, my + 1, 2, 12, '#ffffff');   // shading, and the highlight
    pxRect(g, mx - 3, my + 5, 6, 5, '#2b3f73'); pxRect(g, mx - 1, my + 6, 2, 2, '#f28c28');                    // the company logo
    pxEllipse(g, mx, my, 8, 3, '#f8f4ec'); pxEllipse(g, mx, my, 6, 2, '#4a2a14'); pxRect(g, mx - 2, my - 1, 3, 1, '#7a4a24');   // the rim, and the coffee
    for (const [dx, dy] of [[8, 3], [11, 4], [12, 7], [11, 10], [8, 11]]) pxRect(g, mx + dx, my + dy, 2, 2, '#e0dacd');   // the handle: a loop with a hole in it
    for (let i = 0; i < 3; i++) { const k = (t * .6 + i / 3) % 1, x = mx - 3 + i * 3 + Math.sin(t * 2 + i) * 1.5; pxRect(g, x, my - 3 - k * 12, 1, 3, `rgba(255,255,255,${(.5 * (1 - k)).toFixed(2)})`); }   // steam
    // the desk phone, line 1 blinking
    pxRect(g, 104, 14, 72, 40, '#3a3a40'); pxRect(g, 104, 14, 72, 2, '#5a5a62'); pxRect(g, 104, 50, 72, 4, '#26262a');
    pxRect(g, 108, 18, 22, 32, '#4a4a52'); pxRect(g, 110, 20, 18, 28, '#2a2a30');                          // the handset's cradle (handset is off: you're on the call)
    pxRect(g, 134, 17, 40, 12, '#8aa070'); pxRect(g, 135, 18, 38, 10, '#a8c088');                            // caller ID screen (the name and timer are text laid over it, see .call-lcd)
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) pxRect(g, 140 + k * 10, 31 + r * 5, 7, 3, '#d8d4c8');
    for (let i = 0; i < 4; i++) { const on = i === 0 && Math.floor(t * 2.5) % 2 === 0; pxRect(g, 166, 31 + i * 5, 4, 3, i === 0 ? (on ? '#ff5a3a' : '#7a2a1a') : '#5a5a62'); }
    // the curly cord, off to your ear
    g.strokeStyle = '#2a2a30'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x < 30; x++) g.lineTo(108 - x * 1.2, 40 + Math.sin(x * 1.3) * 2 + x * .5); g.stroke();
  },
  tick(t) { if (UI.isOpen('callScreen')) { this.drawPhone(t); const s = Math.floor((performance.now() - this._t0) / 1000); $('callTimer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; if (this.scene && $('callName').classList.contains('call-tenant')) this.drawHandset($('callPortrait')); } }
};
/* the customer-service grade on the report card */
function csGrade(n) { return n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 65 ? 'C' : n >= 50 ? 'D' : 'F'; }
