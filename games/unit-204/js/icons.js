'use strict';
/* ============================== ICONS & CURSORS ==============================
   The verb and tool icons are 32x32 pixel art from js/iconart.js (see the credits there and on the Credits screen).
   The small UI icons (report, SOP, gear, menu, the plain arrow) are 16x16 and drawn here. Each verb/tool icon
   also becomes a CSS cursor, so the mouse pointer IS the current verb or tool. Walk is the default. */
const VERBS = [
  { id: 'walk', name: 'Walk', tip: 'Walk around the unit.', key: '1' },
  { id: 'look', name: 'Look', tip: 'Look at something. Features open a close-up.', key: '2' },
  { id: 'touch', name: 'Touch', tip: 'Touch, press, open, or pull it.', key: '3' },
  { id: 'smell', name: 'Smell', tip: 'Give it a sniff. Noses find gas, mold, and worse.', key: '4' },
  { id: 'talk', name: 'Talk', tip: 'Talk to Dana (or to the furniture, if you must).', key: '5' }
];
const ITEMS = [
  { id: 'clipboard', name: 'Clipboard', tip: 'Use on a feature to mark its condition on your form.' },
  { id: 'camera', name: 'Digital camera', tip: 'Photograph anything. Damage and hazards need photos for the file.' },
  { id: 'tape', name: 'Tape measure', tip: 'Measure holes, stains, and cracks. Size matters.' },
  { id: 'flashlight', name: 'Flashlight', tip: 'Light up dark corners, cabinets, and wall cavities.' },
  { id: 'screwdriver', name: 'Screwdriver', tip: 'Back out screws and anchors, remove cover plates.' },
  { id: 'hammer', name: 'Hammer', tip: 'Tap tile and drywall. Hollow or mushy sounds mean trouble.' },
  { id: 'pencil', name: 'Pencil', tip: 'Circle problem spots so the repair crew can find them.' }
];
const TOOL = {}; for (const t of [...VERBS, ...ITEMS]) TOOL[t.id] = t;
const CYCLE = VERBS.map(v => v.id);

const ICON_PAL = { k: '#17131f', w: '#ffffff', W: '#e8e0d0', s: '#f2c9a0', S: '#c98b62', b: '#4a8fe0', B: '#23508f', r: '#d64545', o: '#f28c28', y: '#ffd34e', Y: '#d9a400',
  g: '#d4d8e0', G: '#8d93a1', n: '#a8743f', N: '#6b4422', e: '#7bd36b', p: '#f08cb4', l: '#bfe8ff', d: '#3a3f4a', D: '#24272f', t: '#e9d9a6' };
const ICON_MAPS = {
  arrow: ['k', 'kk', 'kwk', 'kwwk', 'kwwwk', 'kwwwwk', 'kwwwwwk', 'kwwwwwwk', 'kwwwwwwwk', 'kwwwwwkkkk', 'kwwkwwk', 'kwk.kwwk', 'kk..kwwk', 'k....kwwk', '.....kwwk', '......kk'],
  clipboard: ['.....kkkkkk', '..kkkkggggkkkk', '.knnnkGGGGknnnk', '.knwwwwwwwwwwnk', '.knwkkkkkkwwwnk', '.knwwwwwwwwwwnk', '.knwkkkkkwwwwnk', '.knwwwwwwwwwwnk', '.knwkkkkkkkwwnk', '.knwwwwwwwwwwnk', '.knwrwwrwwwwwnk', '.knwwrrwwwwwwnk', '.knwwwwwwwwwwnk', '.knnnnnnnnnnnnk', '.kkkkkkkkkkkkkk']
};

// tools drawn with rectangles (outline added afterwards)
const ICON_DRAW = {
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
  sound(g) {                       // a speaker with sound waves
    pxRect(g, 1, 6, 4, 4, ICON_PAL.W); for (let i = 0; i < 4; i++) pxRect(g, 5 + i, 5 - i, 1, 6 + 2 * i, ICON_PAL.W);
    pxRect(g, 10, 6, 1, 4, ICON_PAL.y); pxRect(g, 12, 4, 1, 8, ICON_PAL.y); pxRect(g, 11, 5, 1, 1, ICON_PAL.y); pxRect(g, 11, 10, 1, 1, ICON_PAL.y);
    pxRect(g, 14, 3, 1, 10, ICON_PAL.y); pxRect(g, 13, 2, 1, 1, ICON_PAL.y); pxRect(g, 13, 13, 1, 1, ICON_PAL.y);
  },
  mute(g) {                        // the speaker, crossed out
    pxRect(g, 1, 6, 4, 4, ICON_PAL.G); for (let i = 0; i < 4; i++) pxRect(g, 5 + i, 5 - i, 1, 6 + 2 * i, ICON_PAL.G);
    for (let i = 0; i < 5; i++) { pxRect(g, 10 + i, 5 + i, 1, 1, ICON_PAL.r); pxRect(g, 14 - i, 5 + i, 1, 1, ICON_PAL.r); }
  },
  full(g) {                        // four corners pointing out: fill the screen
    for (const [x, y, dx, dy] of [[1, 1, 1, 1], [14, 1, -1, 1], [1, 14, 1, -1], [14, 14, -1, -1]]) { pxRect(g, Math.min(x, x + 4 * dx), y, 5, 1, ICON_PAL.W); pxRect(g, x, Math.min(y, y + 4 * dy), 1, 5, ICON_PAL.W); }
    pxRect(g, 5, 5, 6, 6, ICON_PAL.G);
  },
  reveal(g) {                      // a sparkle: show me everything
    pxRect(g, 7, 1, 2, 14, ICON_PAL.y); pxRect(g, 1, 7, 14, 2, ICON_PAL.y); pxRect(g, 5, 5, 6, 6, ICON_PAL.y); pxRect(g, 7, 7, 2, 2, '#ffffff');
    pxRect(g, 2, 2, 2, 2, '#fff0b0'); pxRect(g, 12, 12, 2, 2, '#fff0b0'); pxRect(g, 12, 2, 1, 1, '#fff0b0');
  },
  trophy(g) {                      // a little gold cup
    pxRect(g, 3, 2, 10, 6, '#e8c35a'); pxRect(g, 4, 8, 8, 2, '#e8c35a'); pxRect(g, 6, 10, 4, 2, '#c99a08'); pxRect(g, 4, 12, 8, 2, '#a8843a');
    pxRect(g, 1, 3, 2, 3, '#c99a08'); pxRect(g, 13, 3, 2, 3, '#c99a08'); pxRect(g, 4, 3, 2, 3, '#fff0b0');
  },
  bag(g) {                         // a canvas messenger bag
    pxRect(g, 4, 1, 8, 2, '#6b4422'); pxRect(g, 3, 2, 2, 4, '#6b4422'); pxRect(g, 11, 2, 2, 4, '#6b4422');
    pxRect(g, 1, 5, 14, 10, '#7a8a5a'); pxRect(g, 1, 5, 14, 6, '#8a9a66'); pxRect(g, 1, 10, 14, 1, '#5a6a42');
    pxRect(g, 7, 9, 2, 3, '#c9a227'); pxRect(g, 2, 6, 3, 1, '#a8b884');
  },
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
  build() {                          // returns a promise: the 32px art decodes first
    for (const id of [...Object.keys(ICON_MAPS), ...Object.keys(ICON_DRAW).filter(k => k[0] !== '_')]) {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const g = c.getContext('2d');
      if (ICON_MAPS[id]) ICON_DRAW._map(g, id); else { ICON_DRAW[id](g); outline(c); }
      this.base[id] = c;
    }
    const art = Object.entries(ICON_ART).map(([id, a]) => {
      const img = new Image(); img.src = a.src;
      return (img.decode ? img.decode() : new Promise(ok => { img.onload = ok; })).then(() => {
        const c = document.createElement('canvas'); c.width = c.height = 32; c.getContext('2d').drawImage(img, 0, 0); this.base[id] = c;
      });
    });
    return Promise.all(art).then(() => {                       // icon images are drawn big (128px) and shrunk smoothly: even pixels at any size
      for (const [cls, id] of [['ico-report', 'report'], ['ico-sop', 'sop'], ['ico-gear', 'gear'], ['ico-menu', 'menu'], ['ico-bag', 'bag'], ['ico-trophy', 'trophy'], ['ico-reveal', 'reveal'], ['ico-camera', 'camera'], ['ico-clipboard', 'clipboard'], ['ico-sound', 'sound'], ['ico-mute', 'mute'], ['ico-full', 'full']]) {
        const style = document.createElement('style'); style.textContent = `.${cls}{background-image:url(${this.url(id, 128)})}`; document.head.append(style);
      }
    });
  },
  canvas(id, px = 32) {                // the icon at px x px, hard pixels
    const c = document.createElement('canvas'); c.width = c.height = px;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(this.base[id], 0, 0, px, px);
    return c;
  },
  url(id, px = 32) { return this.canvas(id, px).toDataURL('image/png'); },
  applyCursors() {
    const px = Settings.get('bigCursor') ? 48 : 32, k = px / 32, game = $('game');
    for (const id of [...CYCLE, ...ITEMS.map(i => i.id)]) {
      const [hx, hy] = ICON_ART[id].hot;
      game.style.setProperty('--cur-' + id, `url(${this.url(id, px)}) ${Math.round(hx * k)} ${Math.round(hy * k)}, auto`);
    }
    game.style.setProperty('--cur-arrow', `url(${this.url('arrow', px)}) 0 0, default`);
    game.style.setProperty('--cur-point', `url(${this.url('touch', px)}) ${Math.round(19 * k)} ${Math.round(11 * k)}, pointer`);
  }
};
