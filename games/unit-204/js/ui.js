'use strict';
/* ============================== UI ==============================
   Speech over characters, tooltips, the hover toolbar, overlays and the briefing. */
const UI = {
  stack: ['titleScreen'],
  open(id) {
    const el = $(id); if (!el) return;
    if (!this.stack.includes(id)) this.stack.push(id);
    el.classList.add('on'); this.hideTip();
    const f = el.querySelector('.btn.primary, button'); if (f && !('ontouchstart' in window)) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
  },
  close(id) {
    id = id || this.stack[this.stack.length - 1]; if (!id) return;
    $(id).classList.remove('on'); this.stack = this.stack.filter(s => s !== id); this.hideTip();
    if (id === 'inspectScreen') Inspect.onClose();
  },
  closeAll() { for (const id of [...this.stack]) this.close(id); },
  top() { return this.stack[this.stack.length - 1]; },
  isOpen(id) { return this.stack.includes(id); },
  blocking() { return this.stack.some(s => s !== 'titleScreen'); },

  /* ---------- speech ---------- */
  lines: {},
  say(who, text, color) {
    const old = this.lines[who]; if (old) old.el.remove();
    const el = document.createElement('div'); el.className = 'say'; el.textContent = text;
    el.style.color = color || (who === 'dana' ? '#d9a6ff' : who === 'you' ? '#fff6dc' : '#c8f0ff');
    $('speech').append(el);
    const dur = (1.6 + text.length * .055) / (Settings.get('textSpeed') || 1);
    this.lines[who] = { el, until: performance.now() / 1000 + dur };
    return dur;
  },
  hush(who) { for (const k of who ? [who] : Object.keys(this.lines)) { const l = this.lines[k]; if (l) { l.el.remove(); delete this.lines[k]; } } },
  talking(who) { return !!this.lines[who]; },
  updateSpeech(now, pos) {                    // pos(who) -> [x, y] in scene pixels
    for (const [who, l] of Object.entries(this.lines)) {
      if (now > l.until) { l.el.remove(); delete this.lines[who]; continue; }
      const p = pos(who); if (!p) continue;
      const x = clamp(p[0] / SW * 100, 14, 86), y = clamp(p[1] / SH * 100, 12, 95);
      l.el.style.left = x + '%'; l.el.style.top = y + '%'; l.el.style.translate = '';
    }
    const a = this.lines.you, b = this.lines.dana;       // keep two speakers' lines from overlapping
    if (a && b) {
      const ra = a.el.getBoundingClientRect(), rb = b.el.getBoundingClientRect();
      if (ra.left < rb.right && rb.left < ra.right && ra.top < rb.bottom && rb.top < ra.bottom) {
        const [up, other] = rb.top <= ra.top ? [b, ra] : [a, rb], ru = up.el.getBoundingClientRect();
        up.el.style.translate = `0 ${-(ru.bottom - other.top + 4)}px`;
      }
    }
  },
  verb(html) { const v = $('verbline'); if (v._h !== html) { v.innerHTML = html; v._h = html; } },
  roomName(name) { const r = $('roomname'); r.textContent = name; r.classList.add('on'); clearTimeout(r._t); r._t = setTimeout(() => r.classList.remove('on'), 1800); },

  /* ---------- tooltips: any element with data-tip="Title|Body" ---------- */
  tipFor: null,
  showTip(el) {
    const raw = el.dataset.tip; if (!raw) return;
    const [title, body] = raw.split('|'), tip = $('tooltip');
    tip.innerHTML = ''; const b = document.createElement('b'); b.textContent = title; tip.append(b);
    if (body) tip.append(document.createTextNode(body));
    const gr = $('game').getBoundingClientRect(), er = el.getBoundingClientRect();
    tip.classList.add('on'); this.tipFor = el;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = er.left - gr.left + er.width / 2 - tw / 2, y = er.bottom - gr.top + 8;
    if (y + th > gr.height - 4) y = er.top - gr.top - th - 8;
    tip.style.left = clamp(x, 4, gr.width - tw - 4) + 'px'; tip.style.top = clamp(y, 4, gr.height - th - 4) + 'px';
  },
  hideTip() { $('tooltip').classList.remove('on'); this.tipFor = null; },
  bindTips() {
    const game = $('game');
    game.addEventListener('mouseover', e => { const el = e.target.closest('[data-tip]'); if (el && el !== this.tipFor) { clearTimeout(this._tt); this._tt = setTimeout(() => this.showTip(el), 260); } else if (!el) { clearTimeout(this._tt); this.hideTip(); } });
    game.addEventListener('mouseout', e => { const el = e.target.closest('[data-tip]'); if (el && !el.contains(e.relatedTarget)) { clearTimeout(this._tt); this.hideTip(); } });
    game.addEventListener('mousedown', () => { clearTimeout(this._tt); this.hideTip(); });
    game.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el && el.matches(':focus-visible')) this.showTip(el); });
    game.addEventListener('focusout', () => this.hideTip());
  },

  /* ---------- toolbar (and the matching strip inside the close-up window) ---------- */
  buildTools() {
    const make = (t, verb) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tb-btn'; b.dataset.tool = t.id;
      b.dataset.tip = (verb ? `${t.name} (${t.key})` : t.name) + '|' + t.tip + (verb ? ' Right-click cycles verbs.' : '');
      b.setAttribute('aria-label', t.name);
      b.append(Icons.canvas(t.id, 2));
      if (verb) { const k = document.createElement('span'); k.className = 'key'; k.textContent = t.key; b.append(k); }
      b.addEventListener('click', () => { Game.setTool(t.id); Audio2.sfx('tick'); });
      return b;
    };
    const verbs = $('tb-verbs'), items = $('tb-items'), strip = $('inspectTools');
    for (const v of VERBS) verbs.append(make(v, true));
    for (const it of ITEMS) items.append(make(it, false));
    for (const t of [...VERBS.filter(v => v.id !== 'walk'), ...ITEMS]) strip.append(make(t, !!t.key));
    const game = $('game'), trig = $('tb-trigger'), tb = $('toolbar');
    const open = () => { clearTimeout(this._tbT); game.classList.add('tb-open'); };
    const shut = () => { clearTimeout(this._tbT); this._tbT = setTimeout(() => game.classList.remove('tb-open'), 350); };
    trig.addEventListener('mouseenter', open); trig.addEventListener('mouseleave', shut);
    tb.addEventListener('mouseenter', open); tb.addEventListener('mouseleave', shut);
    trig.addEventListener('click', () => game.classList.toggle('tb-open'));
    $('tbReport').addEventListener('click', () => Report.confirmSubmit());
    $('tbSop').addEventListener('click', () => { UI.open('sopScreen'); Audio2.sfx('swish'); });
    $('tbSettings').addEventListener('click', () => { Settings.build(); UI.open('settingsScreen'); });
    $('tbMenu').addEventListener('click', () => UI.open('menuScreen'));
    $('touchCycle').addEventListener('click', () => Game.cycleTool(1));
  },
  syncTools(id) {
    document.querySelectorAll('.tb-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === id));
    const span = $('touchCycle').firstElementChild; span.style.backgroundImage = `url(${Icons.url(id, 2)})`;
  },
  progress(done, total) { $('tbProgress').textContent = `${done}/${total}`; $('tbReport').classList.toggle('done', done === total); },

  /* ---------- feedback toast (immediate-feedback mode) ---------- */
  feedback(good, title, text) {
    const f = $('feedback'); f.className = good ? 'good' : 'bad'; f.innerHTML = '';
    const b = document.createElement('b'); b.textContent = title; f.append(b, document.createTextNode(text));
    void f.offsetWidth; f.classList.add('on');
    clearTimeout(this._fb); this._fb = setTimeout(() => f.classList.remove('on'), Math.max(5200, text.length * 70) / (Settings.get('textSpeed') || 1));
  },
  confirm(text, yesLabel, onYes, noLabel) {
    $('confirmText').textContent = text; $('confirmYes').textContent = yesLabel || 'Yes'; $('confirmNo').textContent = noLabel || 'Not yet';
    $('confirmYes').onclick = () => { this.close('confirmScreen'); onYes(); };
    $('confirmNo').onclick = () => this.close('confirmScreen');
    this.open('confirmScreen');
  }
};

/* ============================== BRIEFING ============================== */
const BRIEFING = [
  { title: 'Move-out inspection', art: 'door', text: 'A tenant just moved out of <b>Unit 204</b>. Before anyone paints, cleans or touches the security deposit, every room needs a proper inspection. That\'s you.' },
  { title: 'Your tools', art: 'verbs', text: 'Hover over the <b>top edge</b> of the screen for your toolbar. <b>Right-click</b> anywhere to cycle Walk, Look, Touch, Smell and Talk, like the adventure games of old. Keys <b>1-5</b> work too.' },
  { title: 'Get a closer look', art: 'zoom', text: '<b>Look</b> at a feature to bring up a close-up. Then use your <b>senses</b> and <b>tools</b> (tape measure, flashlight, screwdriver, hammer, pencil) on its parts. Anything useful lands in your field notes.' },
  { title: 'Mark it', art: 'cats', text: 'Use the <b>clipboard</b> on a feature to mark it as <b>Clean</b>, <b>Normal Wear &amp; Tear</b>, <b>Tenant Damage</b> or a <b>Maintenance Hazard</b>. The <b>SOP manual</b> on the toolbar spells out the difference.' },
  { title: 'Document it', art: 'camera', text: 'Damage can only be charged to the deposit if there\'s a <b>photo</b>, and hazards always need one. Snap pictures with your <b>digital camera</b> from the clipboard form or the close-up.' },
  { title: 'Bring a friend', art: 'dana', text: '<b>Dana</b> from the leasing office is tagging along. Talk to her for tips. There are <b>14 features in 4 rooms</b>. When you\'re done, submit your report from the menu or the front door.' }
];
const Briefing = {
  i: 0,
  show(i) {
    this.i = clamp(i, 0, BRIEFING.length - 1);
    const p = BRIEFING[this.i];
    $('introPage').textContent = `MEMO ${this.i + 1}/${BRIEFING.length}`; $('introTitle').textContent = p.title; $('introText').innerHTML = p.text;
    $('introBack').disabled = this.i === 0; $('introNext').textContent = this.i === BRIEFING.length - 1 ? 'Start >' : 'Next >';
    this.art(p.art);
  },
  art(kind) {
    const c = $('introArt'), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#2b2440'; g.fillRect(0, 0, 160, 64); g.fillStyle = '#332a4c'; for (let y = 0; y < 64; y += 4) g.fillRect(0, y, 160, 2);
    const icon = (id, x, y, s = 1) => g.drawImage(Icons.base[id], x, y, 16 * s, 16 * s);
    const person = (who, x, o = {}) => g.drawImage(Sprites.get(who, o), x, 64 - SPR_H + 6);
    if (kind === 'door') { pxRect(g, 62, 4, 40, 60, '#f6f3ea'); pxRect(g, 66, 8, 32, 56, '#ece7da'); pxRect(g, 74, 18, 16, 8, '#c9a227'); g.fillStyle = '#2a1a00'; g.font = '7px monospace'; g.fillText('204', 76, 25); pxRect(g, 92, 38, 3, 3, '#c9a227'); person('you', 30, { pose: 'clip' }); }
    if (kind === 'verbs') VERBS.forEach((v, i) => { pxRect(g, 14 + i * 28, 16, 22, 22, i === 1 ? '#f28c28' : '#4a3f66'); icon(v.id, 17 + i * 28, 19); });
    if (kind === 'zoom') { pxRect(g, 40, 8, 80, 46, '#000'); g.drawImage(this._zoomThumb || (this._zoomThumb = (() => { const z = document.createElement('canvas'); z.width = ZW; z.height = ZH; drawZoom(z.getContext('2d'), FEATURE.sink, 3, { open: 1 }, 1); return z; })()), 42, 10, 76, 42); icon('flashlight', 118, 36); icon('tape', 22, 30); }
    if (kind === 'cats') { icon('clipboard', 10, 22, 2); ['#7bd36b', '#6fb7ff', '#ffb03b', '#ff5f6d'].forEach((c2, i) => { pxRect(g, 52 + i * 26, 20, 22, 22, c2); g.fillStyle = '#17131f'; g.font = '10px monospace'; g.fillText(String(i), 59 + i * 26, 35); }); }
    if (kind === 'camera') { icon('camera', 56, 8, 3); }
    if (kind === 'dana') { person('dana', 52, { pose: 'phone', led: true }); person('you', 82, {}); }
  },
  next() { if (this.i >= BRIEFING.length - 1) Game.beginShift(); else { this.show(this.i + 1); Audio2.sfx('swish', .6); } },
  back() { this.show(this.i - 1); Audio2.sfx('swish', .6); }
};
