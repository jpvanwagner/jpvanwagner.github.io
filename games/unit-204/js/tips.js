'use strict';
/* ============================== TUTORIAL TIPS ==============================
   Small callouts with a pointer, each shown once, the first time it matters: the toolbar, a feature to look at,
   the close-up, marking, the camera's shutter, doors that open, and finishing up. Click one (or anywhere) to
   dismiss it; they fade on their own too. Settings > Tutorial tips turns them off (turning them on again replays them). */
const TIPS = {
  tools: { text: "Your tools live up here. Hover the top edge, or press I.", phone: 'Your verbs and tools are down here. Tap one, then tap the room.' },
  look: { text: 'Pick Look (the eye, or press 2), then click this for a close-up.' },
  door: { text: 'Doors, cabinets, and appliances open with a click. Things hide inside.' },
  closeup: { text: 'Try Touch, Smell, and your tools on the parts. What you learn lands in your notes.' },
  mark: { text: 'Found something? Mark it here. Damage and hazards need a photo, too.' },
  camera: { text: 'Press the shutter (or Space) to snap.' },
  finish: { text: "Seen enough? Finish (in the toolbar) files your report. Anything you didn't mark counts as missed." },
  dana: { text: 'Dana knows the building. Use Talk on her for hints and SOP refreshers.' },
  bag: { text: 'Things you pick up go in your bag, up in the toolbar. Look at them, smell them, combine them.' },
  hazard: { text: 'A hazard? Make it safe too: the breaker panel is in the kitchen, the gas shut-off is under the counter by the range.' },
  sop: { text: 'Not sure which code fits? The SOP binder in the toolbar spells out all four.' }
};
const TIP_MIN = 2200;            // a tip stays up at least this long (ms), so a click already in progress can't swallow it
const Tips = {
  seen: new Set(store('unit204-tips-2') || []), el: null, cur: null, shownAt: 0,   // a fresh key, so everyone sees this set once
  on() { return Settings.get('tips') && Game.mode === 'play'; },
  /* show tip `id` pointing at a DOM element, or at [x, y] in scene pixels */
  show(id, target) {
    if (!this.on() || this.seen.has(id) || this.cur) return false;
    const t = TIPS[id], game = $('game'), gr = game.getBoundingClientRect(); if (!t || !target) return false;
    let r;
    if (Array.isArray(target)) { const sr = $('scene').getBoundingClientRect(), x = sr.left + target[0] / SW * sr.width, y = sr.top + target[1] / SH * sr.height; r = { left: x, right: x, top: y - 6, bottom: y + 6 }; }
    else {
      // a toolbar button: drop the toolbar down (instantly) while the tip is up, so the arrow lands on the real button
      const tb = $('toolbar');
      if (tb.contains(target) && !game.classList.contains('tb-open')) { tb.style.transition = 'none'; game.classList.add('tb-open'); void tb.offsetWidth; tb.style.transition = ''; this._opened = true; }
      if (!target.offsetParent && target.getClientRects().length === 0) return false;
      // wait while a window is still zooming or sliding in, or the arrow gets aimed at where the button was mid-animation (tick tries again shortly)
      if (document.getAnimations().some(an => an.playState === 'running' && an.effect && an.effect.getComputedTiming().iterations !== Infinity && an.effect.target && an.effect.target.contains && an.effect.target.contains(target))) return false;
      r = target.getBoundingClientRect();
    }
    const el = this.el || (this.el = document.createElement('div'));
    el.className = 'tip-callout'; el.setAttribute('role', 'note');
    el.textContent = (document.body.classList.contains('phone') && t.phone) || t.text;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'tip-x'; x.setAttribute('aria-label', 'Dismiss tip'); x.textContent = '×'; el.append(x);
    game.append(el);
    // below the target if there's room, otherwise above; nudged to stay inside the game
    // the arrow's tip touches the target (or, for a toolbar button, the toolbar's bottom edge, since the toolbar stays on top of every callout)
    const sc = gr.width / game.offsetWidth, w = el.offsetWidth * sc, h = el.offsetHeight * sc, cx = (r.left + r.right) / 2;
    const ah = (parseFloat(getComputedStyle(el, '::before').height) || 10) * sc + 1, rb = this._opened || $('toolbar').contains(target.nodeType ? target : null) ? Math.max(r.bottom, $('toolbar').getBoundingClientRect().bottom) : r.bottom;
    const below = rb + h + ah + 4 < gr.bottom, left = clamp(cx - w / 2, gr.left + 6, gr.right - w - 6), top = below ? rb + ah : r.top - h - ah;
    el.style.left = (left - gr.left) / sc + 'px'; el.style.top = (top - gr.top) / sc + 'px';
    el.style.setProperty('--ax', clamp(cx - left, 12, w - 12) / sc + 'px'); el.classList.toggle('above', !below);
    void el.offsetWidth; el.classList.add('on');
    this.cur = id; this.shownAt = performance.now(); clearTimeout(this._t); this._t = setTimeout(() => this.hide(true), 11000);
    x.addEventListener('click', () => this.hide(true)); el.onclick = () => this.hide(true);
    return true;
  },
  /* a tip only counts as seen once it's been up long enough to read (or you closed it yourself) */
  hide(force) {
    if (!this.cur) return;
    if (!force && performance.now() - this.shownAt < TIP_MIN) return;
    this.seen.add(this.cur); store('unit204-tips-2', [...this.seen]);
    clearTimeout(this._t); this.cur = null; if (this._opened) { this._opened = false; $('game').classList.remove('tb-open'); } if (this.el) { this.el.classList.remove('on'); const e = this.el; setTimeout(() => { if (!this.cur) e.remove(); }, 250); } },
  replay() { this.seen.clear(); store('unit204-tips-2', []); },
  /* checked a few times a second while you play */
  tick() {
    if (!this.on() || this.cur) return;
    const top = UI.top(), el = (id, sel) => this.show(id, $(sel));
    if (!top) {
      const st = (performance.now() - Game.start) / 1000;
      if (st > 9 && !this.seen.has('tools')) return el('tools', document.body.classList.contains('phone') ? 'tb-verbs' : 'tb-tab');
      const h = Game.hover;
      if (h && h.kind === 'feature' && !this.seen.has('look')) return this.show('look', [h.box.cx, h.box.y1]);
      if (h && h.kind === 'openable' && !this.seen.has('door')) return this.show('door', [h.box.cx, h.box.y1]);
      if (st > 40 && !this.seen.has('dana') && Game.dana.screen) return this.show('dana', [Game.dana.screen().sx, Game.dana.screen().sy - 34]);
      if (Game.bag.length && !this.seen.has('bag')) return el('bag', 'tbBag');
      if (Object.keys(Game.marks).some(id => Game.marks[id].cat === 3 && HAZARD_FIX[id]) && !this.seen.has('hazard')) return el('hazard', 'tbBag');
      if ((Object.keys(Game.marks).length >= 6 || st > 600) && !this.seen.has('finish')) return el('finish', 'tbFinish');
    } else if (top === 'inspectScreen') {
      if (!this.seen.has('closeup')) return el('closeup', 'inspectTools');
      if ((Game.notes[Inspect.fid] || []).length && !Game.marks[Inspect.fid] && !this.seen.has('mark')) return el('mark', 'inspectMark');
    } else if (top === 'cameraScreen' && !this.seen.has('camera')) return el('camera', 'camSnapLbl');   // below the SNAP tag, so the tip never covers it
    else if (top === 'markScreen' && !this.seen.has('sop')) return el('sop', 'markCats');
  }
};
document.addEventListener('pointerdown', e => { if (Tips.cur && !e.target.closest('#settingsScreen')) Tips.hide(); }, true);
setInterval(() => Tips.tick(), 400);
