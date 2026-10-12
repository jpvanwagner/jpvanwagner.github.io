'use strict';
/* ============================== SITE PICKER ==============================
   The title screen's row of properties: Unit 204 (apartments), Suite 204 (offices), Lot 204 (industrial), and
   Site 204 (construction). Each card has a little pixel sign; picking one swaps that site in (js/sites.js), retitles
   the screen, and repaints the backdrop. The choice is remembered. Arrow keys move along the row. */
const SITE_ICON = {
  residential(g) {          // an apartment door with its brass number plate
    pxRect(g, 13, 3, 14, 22, '#f6f3ea'); pxRect(g, 15, 5, 10, 20, '#7a4a2a'); pxRect(g, 16, 6, 3, 8, '#8a5a34'); pxRect(g, 21, 6, 3, 8, '#8a5a34');
    pxRect(g, 16, 16, 3, 7, '#8a5a34'); pxRect(g, 21, 16, 3, 7, '#8a5a34'); pxRect(g, 18, 3, 4, 2, '#c9a227'); pxRect(g, 23, 15, 1, 1, '#f2d870');
  },
  office(g) {               // a glass office tower
    pxRect(g, 10, 2, 20, 23, '#4a5a78'); pxRect(g, 10, 2, 20, 1, '#8aa0c8');
    for (let y = 4; y < 22; y += 3) for (let x = 12; x < 28; x += 4) pxRect(g, x, y, 3, 2, (x * y) % 7 ? '#9ec4e8' : '#ffe9a8');
    pxRect(g, 17, 21, 6, 4, '#2a3040'); pxRect(g, 4, 24, 32, 1, '#6a6a72');
  },
  industrial(g) {           // a warehouse with a roll-up door and a vent stack
    fillPoly(g, [[5, 11], [20, 5], [35, 11], [35, 25], [5, 25]], '#9a8a6a'); fillPoly(g, [[5, 11], [20, 5], [35, 11]], '#7a6a4a');
    pxRect(g, 12, 15, 12, 10, '#c9ccd4'); for (let y = 16; y < 25; y += 2) pxRect(g, 12, y, 12, 1, '#9aa0aa');
    pxRect(g, 27, 18, 5, 7, '#5a5040'); pxRect(g, 29, 1, 3, 6, '#6a6a72'); pxRect(g, 4, 24, 32, 1, '#4a4a52');
  },
  construction(g) {         // a tower crane over a half-built frame, with a cone
    pxRect(g, 8, 4, 2, 21, '#f2c418'); pxRect(g, 2, 4, 30, 2, '#f2c418'); pxLine(g, 9, 4, 30, 6, '#c9a010'); pxRect(g, 26, 6, 1, 8, '#2a2a30'); pxRect(g, 25, 14, 3, 2, '#5a5a62');
    for (const x of [16, 22, 28]) pxRect(g, x, 12, 1, 13, '#8a8e98'); for (const y of [12, 18]) pxRect(g, 16, y, 13, 1, '#8a8e98');
    fillPoly(g, [[33, 18], [35, 25], [31, 25]], '#f28c28'); pxRect(g, 32, 21, 2, 1, '#ffffff'); pxRect(g, 1, 25, 38, 1, '#7a5a3a');
  }
};
const SitePicker = {
  build() {
    const row = $('sitePick'); if (!row) return;
    row.replaceChildren(...Sites.available().map(id => {
      const s = SITES[id], b = document.createElement('button'); b.type = 'button'; b.className = 'site-card'; b.dataset.site = id;
      b.setAttribute('role', 'radio'); b.dataset.tip = `${s.place} 204|${s.kind}: ${s.tag}.`;
      const c = document.createElement('canvas'); c.width = 40; c.height = 28; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      (SITE_ICON[id] || SITE_ICON.residential)(g);
      const n = document.createElement('b'); n.textContent = `${s.place.toUpperCase()} 204`;
      const k = document.createElement('small'); k.textContent = s.kind;
      b.append(c, n, k);
      b.addEventListener('click', () => this.pick(id, true));
      return b;
    }));
    row.addEventListener('keydown', e => {
      const ids = Sites.available(), d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[e.key]; if (!d) return;
      e.preventDefault(); const i = (ids.indexOf(Sites.cur) + d + ids.length) % ids.length; this.pick(ids[i], true);
      row.querySelector(`[data-site="${ids[i]}"]`).focus();
    });
    this.sync();
  },
  pick(id, sound) {
    if (id !== Sites.cur) { Sites.use(id); if (sound) Audio2.sfx('swish', .5); }
    else if (sound) Audio2.sfx('tick', .5);
    this.sync();
  },
  sync() {
    for (const b of document.querySelectorAll('.site-card')) { const on = b.dataset.site === Sites.cur; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }
  }
};
