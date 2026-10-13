'use strict';
/* ============================== SOP BINDER ==============================
   The SOP manual as a little ring binder you page through: two pages side by side on a wide screen, one at a time
   on a phone held upright. Turning a page swings a leaf over the spine (or off the edge) instead of scrolling.
   The page content lives in the <template id="sopPages"> in index.html. */
const SopBook = {
  pages: [], at: 0, busy: false,
  /* the pages: from a <template> by id, or straight from an HTML string (each site brings its own SOP, js/sites.js) */
  load(src) {
    let content = src && $(src) && $(src).content;
    if (!content) { const t = document.createElement('template'); t.innerHTML = src || ''; content = t.content; }
    this.pages = [...content.querySelectorAll('.pg')].map((p, i) => {
      const d = p.cloneNode(true);
      if (i) { const n = document.createElement('span'); n.className = 'pg-num'; n.textContent = i; d.append(n); }   // no number on the title page
      return d;
    });
    if (this.book === 'sop' && typeof SopLinks !== 'undefined') for (const p of this.pages) SopLinks.citeify(p);   // OSHA citations in the SOP open the handbook
    this.at = 0; if (this._ready) this.show();
  },
  /* which book is open: 'sop' (this site's procedure) or 'osha' (the Field Safety Handbook) */
  book: 'sop',
  use(book) {
    this.book = book; this.load(book === 'osha' ? OshaBook.html() : (typeof Sites !== 'undefined' ? Sites.site.sop : 'sopPages'));
    $('sopBook').classList.toggle('osha', book === 'osha');
    for (const [id, b] of [['tabSop', 'sop'], ['tabOsha', 'osha']]) { $(id).classList.toggle('on', b === book); $(id).setAttribute('aria-selected', b === book); }
  },
  init() {
    this.use('sop'); this._ready = true;
    $('tabSop').addEventListener('click', () => { if (this.book !== 'sop') { this.use('sop'); Audio2.sfx('swish', .5); } });
    $('tabOsha').addEventListener('click', () => { if (this.book !== 'osha') { this.use('osha'); Audio2.sfx('swish', .5); } });
    $('sopSpread').addEventListener('click', e => {
      const go = e.target.closest('.osha-go'); if (go) SopLinks.open('osha-' + go.dataset.osha);   // the handbook's contents
      if (e.target.closest('.osha-back')) { const i = this.pages.findIndex(p => p.classList.contains('osha-toc')); if (i >= 0) { this.at = i; this.show(); Audio2.sfx('swish', .5); } }   // each chapter's way back to them
    });
    $('sopNext').addEventListener('click', () => this.turn(1));
    $('sopPrev').addEventListener('click', () => this.turn(-1));
    window.addEventListener('keydown', e => {
      if (UI.top() !== 'sopScreen') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); this.turn(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); this.turn(-1); }
    });
    window.addEventListener('resize', () => { if (UI.isOpen('sopScreen')) this.show(); });
    this.show();
  },
  single() { return document.body.classList.contains('portrait') || $('sopBook').clientWidth < 520; },   // one page at a time
  step() { return this.single() ? 1 : 2; },
  page(i) { const p = this.pages[i]; return p ? p.cloneNode(true) : document.createElement('div'); },
  fill(el, i) { el.replaceChildren(this.page(i)); },
  show() {
    const one = this.single(); $('sopBook').classList.toggle('one', one);
    if (!one && this.at % 2) this.at--;                             // spreads always start on an even page
    this.fill($('sopL'), this.at); if (!one) this.fill($('sopR'), this.at + 1);
    $('sopPrev').disabled = this.at === 0; $('sopNext').disabled = this.at + this.step() >= this.pages.length;
  },
  turn(dir) {
    const st = this.step(), to = this.at + dir * st;
    if (this.busy || to < 0 || to >= this.pages.length) return;
    Audio2.sfx('swish', .5);
    if (!Settings.get('motion')) { this.at = to; this.show(); return; }
    const one = this.single(), spread = $('sopSpread'), leaf = document.createElement('div'), front = document.createElement('div'), back = document.createElement('div');
    leaf.className = 'book-leaf ' + (one ? 'whole' : dir > 0 ? 'on-right' : 'on-left'); front.className = 'leaf-face front'; back.className = 'leaf-face back';
    if (one) {                                                      // a single page: the old one peels off over the new one
      if (dir > 0) { front.append(this.page(this.at)); this.fill($('sopL'), to); }
      else { front.append(this.page(to)); leaf.classList.add('back-in'); }
    } else if (dir > 0) {                                           // the right-hand page swings over the spine
      front.append(this.page(this.at + 1)); back.append(this.page(to)); this.fill($('sopR'), to + 1);
    } else {                                                        // the left-hand page swings back
      front.append(this.page(this.at)); back.append(this.page(to + 1)); this.fill($('sopL'), to);
    }
    leaf.append(front, back); spread.append(leaf); this.busy = true;
    leaf.addEventListener('animationend', () => { leaf.remove(); this.at = to; this.busy = false; this.show(); }, { once: true });
  }
};
SopBook.init();
