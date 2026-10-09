'use strict';
/* ============================== ICONS & CURSORS ==============================
   16x16 pixel icons. The verbs are drawn as pixel maps; the tools are drawn with rectangles and get an
   automatic dark outline. Each icon also becomes a CSS cursor, so the mouse pointer IS the current verb/tool. */
const VERBS = [
  { id: 'walk', name: 'Walk', tip: 'Walk around the unit.', key: '1' },
  { id: 'look', name: 'Look', tip: 'Look at something. Features open a close-up.', key: '2' },
  { id: 'touch', name: 'Touch', tip: 'Touch, press, open or pull it.', key: '3' },
  { id: 'smell', name: 'Smell', tip: 'Give it a sniff. Noses find gas, mold and worse.', key: '4' },
  { id: 'talk', name: 'Talk', tip: 'Talk to Dana (or to the furniture, if you must).', key: '5' }
];
const ITEMS = [
  { id: 'clipboard', name: 'Clipboard', tip: 'Use on a feature to mark its condition on your form.' },
  { id: 'camera', name: 'Digital camera', tip: 'Photograph a feature. Damage and hazards need photos.' },
  { id: 'tape', name: 'Tape measure', tip: 'Measure holes, stains and cracks. Size matters.' },
  { id: 'flashlight', name: 'Flashlight', tip: 'Light up dark corners, cabinets and wall cavities.' },
  { id: 'screwdriver', name: 'Screwdriver', tip: 'Back out screws and anchors, remove cover plates.' },
  { id: 'hammer', name: 'Hammer', tip: 'Tap tile and drywall. Hollow or mushy sounds mean trouble.' },
  { id: 'pencil', name: 'Pencil', tip: 'Circle problem spots so the repair crew can find them.' }
];
const TOOL = {}; for (const t of [...VERBS, ...ITEMS]) TOOL[t.id] = t;
const CYCLE = VERBS.map(v => v.id);

const ICON_PAL = { k: '#17131f', w: '#ffffff', W: '#e8e0d0', s: '#f2c9a0', S: '#c98b62', b: '#4a8fe0', B: '#23508f', r: '#d64545', o: '#f28c28', y: '#ffd34e', Y: '#d9a400',
  g: '#d4d8e0', G: '#8d93a1', n: '#a8743f', N: '#6b4422', e: '#7bd36b', p: '#f08cb4', l: '#bfe8ff', d: '#3a3f4a', D: '#24272f', t: '#e9d9a6' };
const ICON_MAPS = {
  walk: ['k', 'kk', 'kwk', 'kwwk', 'kwwwk', 'kwwwwk', 'kwwwwwk', 'kwwwwwwk', 'kwwwwwwwk', 'kwwwwwkkkk', 'kwwkwwk', 'kwk.kwwk', 'kk..kwwk', 'k....kwwk', '.....kwwk', '......kk'],
  look: ['', '', '', '.....kkkkkk', '...kkwwwwwwkk', '..kwwwwbbwwwwk', '.kwwwwbBBbwwwwk', 'kwwwwbBkwBbwwwwk', 'kwwwwbBkkBbwwwwk', '.kwwwwbBBbwwwwk', '..kwwwwbbwwwwk', '...kkwwwwwwkk', '.....kkkkkk'],
  touch: ['.....kk', '....kssk', '....kssk', '....kssk', '....ksskkk', '....ksskssk', '....ksskssskk', '..kkksskssksskk', '.kssksssssssssk', '.ksssssssssssssk', '..ksssssssssssk', '..ksssssssssSsk', '...ksssssssSsk', '....ksssssssk', '.....kkkkkkk'],
  smell: ['..........e', '......kk...e.e', '.....kssk..e..e', '.....kssk.e..e', '....ksssk..e', '....kssssk', '...ksssssk', '...kssssssk', '..ksssssssk', '..kssssssssk', '.kssSsssSsssk', '.ksSSkssSSksk', '..kkkkkkkkkk'],
  talk: ['', '..kkkkkkkkkkkk', '.kwwwwwwwwwwwwk', 'kwwwwwwwwwwwwwwk', 'kwwkkwwkkwwkkwwk', 'kwwkkwwkkwwkkwwk', 'kwwwwwwwwwwwwwwk', '.kwwwwwwwwwwwwk', '..kkkwwkkkkkkk', '....kwwk', '....kwk', '....kk'],
  clipboard: ['.....kkkkkk', '..kkkkggggkkkk', '.knnnkGGGGknnnk', '.knwwwwwwwwwwnk', '.knwkkkkkkwwwnk', '.knwwwwwwwwwwnk', '.knwkkkkkwwwwnk', '.knwwwwwwwwwwnk', '.knwkkkkkkkwwnk', '.knwwwwwwwwwwnk', '.knwrwwrwwwwwnk', '.knwwrrwwwwwwnk', '.knwwwwwwwwwwnk', '.knnnnnnnnnnnnk', '.kkkkkkkkkkkkkk']
};
const ICON_HOT = { walk: [0, 0], look: [8, 8], touch: [5, 0], smell: [6, 11], talk: [4, 11], clipboard: [8, 8], camera: [8, 8], tape: [15, 12], flashlight: [15, 7], screwdriver: [15, 0], hammer: [12, 3], pencil: [1, 15] };
// tools drawn with rectangles (outline added afterwards)
const ICON_DRAW = {
  camera(g) {
    pxRect(g, 3, 3, 4, 2, ICON_PAL.G); pxRect(g, 1, 4, 14, 9, ICON_PAL.g); pxRect(g, 1, 11, 14, 2, ICON_PAL.G);
    pxRect(g, 11, 3, 3, 1, ICON_PAL.r); pxRect(g, 2, 5, 2, 1, ICON_PAL.w);
    pxEllipse(g, 8, 8, 3, 3, ICON_PAL.k); pxEllipse(g, 8, 8, 2, 2, ICON_PAL.D); pxRect(g, 7, 7, 1, 1, ICON_PAL.l); pxRect(g, 12, 6, 2, 1, ICON_PAL.e);
  },
  tape(g) {
    pxRect(g, 1, 3, 11, 11, ICON_PAL.y); pxRect(g, 1, 12, 11, 2, ICON_PAL.Y); pxRect(g, 2, 2, 9, 1, ICON_PAL.y);
    pxEllipse(g, 6, 8, 2, 2, ICON_PAL.k); pxRect(g, 6, 8, 1, 1, ICON_PAL.G); pxRect(g, 4, 1, 3, 2, ICON_PAL.r);
    pxRect(g, 12, 11, 4, 2, ICON_PAL.t); for (let x = 12; x < 16; x += 2) pxRect(g, x, 11, 1, 1, ICON_PAL.k); pxRect(g, 15, 10, 1, 3, ICON_PAL.G);
  },
  flashlight(g) {
    pxRect(g, 0, 6, 8, 5, ICON_PAL.d); pxRect(g, 1, 7, 6, 1, ICON_PAL.G); pxRect(g, 3, 9, 2, 1, ICON_PAL.r);
    pxRect(g, 8, 4, 4, 9, ICON_PAL.g); pxRect(g, 12, 5, 1, 7, ICON_PAL.l); pxRect(g, 13, 7, 2, 3, ICON_PAL.y); pxRect(g, 14, 5, 1, 1, ICON_PAL.y); pxRect(g, 14, 11, 1, 1, ICON_PAL.y);
  },
  screwdriver(g) {
    pxLine(g, 1, 14, 5, 10, ICON_PAL.r, 3); pxLine(g, 2, 13, 4, 11, ICON_PAL.o, 1); pxRect(g, 6, 9, 2, 2, ICON_PAL.k);
    pxLine(g, 7, 8, 14, 1, ICON_PAL.g, 2); pxLine(g, 8, 8, 14, 2, ICON_PAL.G, 1);
  },
  hammer(g) {
    pxRect(g, 7, 6, 3, 10, ICON_PAL.n); pxRect(g, 7, 6, 1, 10, ICON_PAL.t); pxRect(g, 7, 13, 3, 3, ICON_PAL.N);
    pxRect(g, 2, 2, 12, 4, ICON_PAL.G); pxRect(g, 2, 2, 12, 1, ICON_PAL.g); pxRect(g, 0, 3, 2, 2, ICON_PAL.G); pxRect(g, 14, 1, 1, 2, ICON_PAL.G); pxRect(g, 14, 5, 1, 2, ICON_PAL.G);
  },
  pencil(g) {
    pxLine(g, 4, 11, 12, 3, ICON_PAL.y, 3); pxLine(g, 5, 12, 13, 4, ICON_PAL.Y, 1);
    pxLine(g, 12, 2, 14, 0, ICON_PAL.p, 3); pxRect(g, 11, 3, 2, 2, ICON_PAL.g);
    pxRect(g, 2, 12, 2, 2, ICON_PAL.t); pxRect(g, 1, 14, 1, 1, ICON_PAL.k);
  },
  report(g) { ICON_DRAW._map(g, 'clipboard'); },
  sop(g) {
    pxRect(g, 2, 1, 12, 14, '#3f8f3a'); pxRect(g, 2, 1, 2, 14, '#2c6a28'); pxRect(g, 5, 3, 7, 3, '#e9f5d9'); pxRect(g, 6, 4, 5, 1, '#2c6a28');
    pxRect(g, 12, 2, 2, 12, ICON_PAL.W); pxRect(g, 1, 4, 2, 1, ICON_PAL.g); pxRect(g, 1, 10, 2, 1, ICON_PAL.g);
  },
  gear(g) {
    for (let a = 0; a < 8; a++) { const x = 8 + Math.round(Math.cos(a * Math.PI / 4) * 6), y = 8 + Math.round(Math.sin(a * Math.PI / 4) * 6); pxRect(g, x - 1, y - 1, 3, 3, ICON_PAL.g); }
    pxEllipse(g, 8, 8, 5, 5, ICON_PAL.g); pxEllipse(g, 8, 8, 2, 2, ICON_PAL.k);
  },
  menu(g) { for (const y of [3, 7, 11]) pxRect(g, 2, y, 12, 2, ICON_PAL.W); },
  _map(g, id) {
    ICON_MAPS[id].forEach((row, y) => { for (let x = 0; x < 16 && x < row.length; x++) { const c = ICON_PAL[row[x]]; if (c) pxRect(g, x, y, 1, 1, c); } });
  }
};
function outline(c, color = ICON_PAL.k) {   // add a 1px outline around every opaque pixel
  const g = c.getContext('2d'), w = c.width, h = c.height, d = g.getImageData(0, 0, w, h), src = new Uint8ClampedArray(d.data);
  const [r, gg, b] = hexRgb(color);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (src[i + 3] > 0) continue;
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && src[(ny * w + nx) * 4 + 3] > 0) near = true; }
    if (near) { d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; d.data[i + 3] = 255; }
  }
  g.putImageData(d, 0, 0);
}
const Icons = {
  base: {},
  build() {
    for (const id of [...Object.keys(ICON_MAPS), ...Object.keys(ICON_DRAW).filter(k => k[0] !== '_')]) {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const g = c.getContext('2d');
      if (ICON_MAPS[id]) ICON_DRAW._map(g, id); else { ICON_DRAW[id](g); outline(c); }
      this.base[id] = c;
    }
    for (const [cls, id] of [['ico-report', 'report'], ['ico-sop', 'sop'], ['ico-gear', 'gear'], ['ico-menu', 'menu'], ['ico-camera', 'camera'], ['ico-clipboard', 'clipboard']]) {
      const url = this.url(id, 2);
      const style = document.createElement('style'); style.textContent = `.${cls}{background-image:url(${url})}`; document.head.append(style);
    }
  },
  canvas(id, scale = 2) {
    const c = document.createElement('canvas'); c.width = c.height = 16 * scale;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(this.base[id], 0, 0, 16 * scale, 16 * scale);
    return c;
  },
  url(id, scale = 2) { return this.canvas(id, scale).toDataURL('image/png'); },
  applyCursors() {
    const s = Settings.get('bigCursor') ? 3 : 2, game = $('game');
    for (const id of [...CYCLE, ...ITEMS.map(i => i.id)]) {
      const [hx, hy] = ICON_HOT[id] || [8, 8];
      game.style.setProperty('--cur-' + id, `url(${this.url(id, s)}) ${hx * s} ${hy * s}, auto`);
    }
    game.style.setProperty('--cur-arrow', `url(${this.url('walk', s)}) 0 0, default`);
    game.style.setProperty('--cur-point', `url(${this.url('touch', s)}) ${5 * s} 0, pointer`);
  }
};
