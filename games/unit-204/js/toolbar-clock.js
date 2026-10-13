'use strict';
/* ============================== THE TOOLBAR CLOCK ==============================
   A little retro clock in the middle of the toolbar: the shift's time on top and the date (mm/dd/yyyy) under it. It
   changes style every so often (and when you click it): an LCD, a VFD like a VCR's, a flip clock, an amber dot
   matrix, a projection clock throwing red numbers on the ceiling, and Nixie tubes. The time is the shift's own: it
   starts when the shift does (morning, afternoon, golden hour, or a rainy late morning) and runs six times faster
   than real time; the date is today's, in 2008, like the calendar on the apartment wall. */
const ClockFont = {
  // 5 by 7 numerals for the dot matrix, the flip cards, and the Nixie tubes
  big: { 0: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], 1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'], 2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'], 4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'], 8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'] },
  // 3 by 5, for the date and AM/PM
  small: { 0: '###/#.#/#.#/#.#/###', 1: '.#./##./.#./.#./###', 2: '###/..#/###/#../###', 3: '###/..#/.##/..#/###', 4: '#.#/#.#/###/..#/..#', 5: '###/#../###/..#/###', 6: '###/#../###/#.#/###',
    7: '###/..#/..#/..#/..#', 8: '###/#.#/###/#.#/###', 9: '###/#.#/###/..#/###', '/': '..#/..#/.#./#../#..', A: '.#./#.#/###/#.#/#.#', P: '##./#.#/##./#../#..', M: '#.#/###/###/#.#/#.#' }
};
const TbClock = {
  STYLES: ['lcd', 'vfd', 'flip', 'dots', 'projection', 'nixie'],
  NAMES: { lcd: 'LCD', vfd: 'VFD', flip: 'Flip clock', dots: 'Dot matrix', projection: 'Projection clock', nixie: 'Nixie tubes' },
  style: null, since: 0, lastMin: -1, flipAt: -9,
  /* the shift's clock: its start depends on the light, and it runs six times faster than real time */
  now() {
    const start = { morning: 9 * 60, afternoon: 14 * 60 + 10, golden: 18 * 60 + 25, rain: 11 * 60 + 5 }[(Decor.cur && Decor.cur.time && Decor.cur.time.id) || 'morning'] || 9 * 60;
    const el = Game.start ? Math.max(0, (performance.now() - Game.start) / 1000) : 0, mins = Math.floor(start + el * 6 / 60) % (24 * 60);
    const today = new Date(); return { h: Math.floor(mins / 60), m: mins % 60, mo: today.getMonth() + 1, d: today.getDate(), y: typeof CAL_YEAR !== 'undefined' ? CAL_YEAR : 2008 };
  },
  init() {
    const box = $('tbClock'); if (!box) return;
    this.style = this.STYLES[Math.floor(Math.random() * this.STYLES.length)]; this.since = performance.now();
    box.addEventListener('click', () => this.next(true));
    setInterval(() => this.tick(), 250);
  },
  next(sound) { this.style = this.STYLES[(this.STYLES.indexOf(this.style) + 1) % this.STYLES.length]; this.since = performance.now(); if (sound) Audio2.sfx('tick', .5); this.tick(true); },
  tick(force) {
    const c = $('tbClockArt'); if (!c || !document.getElementById('game').classList.contains('playing')) return;
    if (performance.now() - this.since > 45000) this.next(false);
    const t = this.now(); if (t.m !== this.lastMin) { if (this.lastMin >= 0) this.flipAt = performance.now(); this.lastMin = t.m; }
    $('tbClock').dataset.tip = `${this.NAMES[this.style]}|The shift's clock. Click it for a different one.`;
    this.draw(c.getContext('2d'), t);
  },
  /* helpers */
  px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); },
  small(g, s, x, y, c) { for (const ch of String(s)) { const gl = ClockFont.small[ch]; if (gl) gl.split('/').forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') this.px(g, x + i, y + j, 1, 1, c); })); x += 4; } },
  big(g, n, x, y, c, k = 1, dot) { ClockFont.big[n].forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') this.px(g, x + i * k, y + j * k, dot ? 1 : k, dot ? 1 : k, c); })); },
  /* a seven-segment digit, 7 wide and 13 tall: on segments in on, the rest (ghosts) in off */
  seg(g, n, x, y, on, off) {
    const S = { a: [1, 0, 5, 1], b: [6, 1, 1, 5], c: [6, 7, 1, 5], d: [1, 12, 5, 1], e: [0, 7, 1, 5], f: [0, 1, 1, 5], g: [1, 6, 5, 1] };
    const lit = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd', ' ': '' }[n];
    for (const [k, [sx, sy, w, h]] of Object.entries(S)) { const c = lit.includes(k) ? on : off; if (c) this.px(g, x + sx, y + sy, w, h, c); }
  },
  draw(g, t) {
    const W = g.canvas.width, H = g.canvas.height, h12 = t.h % 12 || 12, ap = t.h < 12 ? 'AM' : 'PM', blink = Math.floor(performance.now() / 500) % 2 === 0;
    const digits = [h12 >= 10 ? 1 : ' ', h12 % 10, Math.floor(t.m / 10), t.m % 10], date = `${String(t.mo).padStart(2, '0')}/${String(t.d).padStart(2, '0')}/${t.y}`;
    g.save(); g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = false;
    const st = this.style, X = [3, 12, 25, 34];                            // where the four digits sit, the colon between 2 and 3
    if (st === 'lcd' || st === 'vfd' || st === 'projection') {
      const pal = { lcd: { bg: '#9aa88a', on: '#1d2a1a', off: '#8c9a7c', dim: '#2a3a26' }, vfd: { bg: '#081010', on: '#5ff0d8', off: '#0f2826', dim: '#3aa898' }, projection: { bg: '#15121e', on: '#ff3a2a', off: null, dim: '#c8302a' } }[st];
      this.px(g, 0, 0, W, H, pal.bg);
      if (st === 'lcd') { this.px(g, 0, 0, W, 1, '#b4c2a4'); this.px(g, 0, H - 1, W, 1, '#7a886a'); }
      if (st === 'projection') { g.translate(2, 0); g.transform(1, 0, -.12, 1, 2, 0); g.shadowColor = 'rgba(255,60,40,0.9)'; g.shadowBlur = 3; g.globalAlpha = .85; }   // thrown on the ceiling: soft and a little skewed
      if (st === 'vfd') { g.shadowColor = 'rgba(95,240,216,0.7)'; g.shadowBlur = 2; }
      digits.forEach((n, i) => this.seg(g, n, X[i], 1, pal.on, n === ' ' && st !== 'lcd' ? null : pal.off));
      if (st !== 'vfd' || blink) { this.px(g, 22, 4, 1, 2, pal.on); this.px(g, 22, 9, 1, 2, pal.on); }   // the colon (a VFD's blinks)
      this.small(g, ap, 44, 1, pal.on); this.small(g, date, 5, 16, pal.dim);
    } else if (st === 'flip') {
      this.px(g, 0, 0, W, H, '#141418');
      const flipping = performance.now() - this.flipAt < 300;
      digits.forEach((n, i) => { const x = X[i] - 1; this.px(g, x, 0, 9, 14, '#2c2c34'); this.px(g, x, 7, 9, 7, '#24242a'); if (n !== ' ') this.big(g, n, x + 2, 3, '#f0eee6');
        this.px(g, x, 7, 9, 1, '#08080a'); this.px(g, x - 1, 6, 1, 3, '#5a5a62'); this.px(g, x + 9, 6, 1, 3, '#5a5a62');   // the split, and the hinge pins
        if (flipping && i === 3) { const k = (performance.now() - this.flipAt) / 300; this.px(g, x, 7 - Math.round(7 * (1 - k)), 9, Math.max(1, Math.round(7 * (1 - k))), '#34343c'); } });
      this.px(g, 22, 4, 1, 2, '#c8c6be'); this.px(g, 22, 9, 1, 2, '#c8c6be'); this.small(g, ap, 44, 1, '#c8c6be'); this.small(g, date, 5, 17, '#a8a6a0');
    } else if (st === 'dots') {
      this.px(g, 0, 0, W, H, '#120c06');
      for (let y = 1; y < 14; y += 2) for (let x = 1; x < 44; x += 2) this.px(g, x, y, 1, 1, '#2a1a08');   // the unlit dots
      digits.forEach((n, i) => { if (n !== ' ') this.big(g, n, [1, 11, 25, 35][i], 1, '#ffb030', 2, true); });   // each numeral is 9 dots wide
      if (blink) { this.px(g, 21, 5, 1, 1, '#ffb030'); this.px(g, 21, 9, 1, 1, '#ffb030'); }
      this.small(g, ap, 45, 1, '#ffb030'); this.small(g, date, 5, 17, '#c8801c');
    } else {                                                                 // Nixie tubes: glass, the other numerals ghosting behind the lit one
      this.px(g, 0, 0, W, H, '#100806');
      digits.forEach((n, i) => { const x = X[i] - 1; this.px(g, x, 0, 9, 15, '#2a1a12'); this.px(g, x + 1, 1, 7, 13, '#1a0e08'); this.px(g, x + 1, 1, 1, 12, 'rgba(255,255,255,0.12)');
        this.big(g, 8, x + 2, 4, '#3a1c0c'); if (n !== ' ') { g.save(); g.shadowColor = 'rgba(255,140,40,0.9)'; g.shadowBlur = 3; this.big(g, n, x + 2, 4, '#ffa040'); g.restore(); } });
      this.px(g, 22, 5, 1, 1, '#ff8a2a'); this.px(g, 22, 9, 1, 1, '#ff8a2a'); this.small(g, ap, 44, 1, '#ff8a2a'); this.small(g, date, 5, 17, '#c86a20');
    }
    g.restore();
  }
};
