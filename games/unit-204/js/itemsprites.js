/* =========================================================================
   Item sprites: small outlined pixel drawings for everything a tenant can leave behind, so a sock reads as a
   sock from across the room. Each sprite is a grid of palette letters ('.' is see-through, 'o' is the outline),
   anchored at its bottom center. Loaded after decor.js; it swaps in a sprite draw for every CLUTTER kind here.
   ========================================================================= */
const SPR_PAL = {
  o: '#2a2230', W: '#f6f2e6', w: '#d8d2c2', k: '#4a4450', g: '#9aa0ab', G: '#c9ccd4', S: '#e4e8f0', Y: '#f2c418', y: '#c99a08',
  R: '#d43a2a', r: '#9a2418', B: '#2c4f9a', b: '#7ad6ff', P: '#ff8ad0', O: '#f28c28', N: '#7a4a24', n: '#c8a070', T: '#d8b47a', t: '#a8844a',
  E: '#4f9a4a', e: '#9ad08a', L: '#ff6a5a', K: '#1d1f26', C: '#c8883a', M: '#f2a0c0', m: '#ffd0e0'
};
const ITEM_SPRITES = {
  sock: [
    '.oooo.......',
    '.oBRo.......',
    '.oYBo.......',
    '.oBRo.......',
    '.oBBoooooo..',
    '.oBBBRBYBBo.',
    '.oWWBBBBBWo.',
    '..oooooooo..'],
  hanger: [
    '......gg......',
    '.....g..g.....',
    '........g.....',
    '.......g......',
    '.....gGGg.....',
    '...gg....gg...',
    '.gg........gg.',
    'gGGGGGGGGGGGGg'],
  menu: [                         // a trifold takeout menu, opened flat: the name and a photo of the General Tso's in the middle, the price lists on the side panels
    'oooooooooooooooo',
    'oWWWWwRRRRwWWWWo',
    'oWkgkwRYYRwkgkWo',
    'oWWWWwRRRRwWWWWo',
    'oWkkgwWWWWwkkgWo',
    'oWWWWwWCCWwWWWWo',
    'oWkgkwrCCrwkgkWo',
    'oWWWWwWrrWwWWWWo',
    'oWkkgwWWWWwkkgWo',
    'oooooooooooooooo'],
  cd: [
    '...oooooo...',
    '.ooSbbSSSSoo',
    'oSbbSSoSSPSo',
    'oSSSSoKoSPPo',
    'oSSPSSoSSSSo',
    '.ooSSSSSSSoo',
    '...oooooo...'],
  phonebook: [
    'oooooooooooo',
    'oYYYYYYYYYYo',
    'oYWWWYYYkkYo',
    'oYYYYYYYYYYo',
    'oyyyyyyyyyyo',
    'owWwWwWwWwWo',
    'oooooooooooo'],
  pizza: [
    'oooooooooooooo',
    'oTTTTTTTTTTTTo',
    'oTTTRRRRRRTTTo',
    'oTTRWRRRRWRTTo',
    'oTTTRRRRRRTTTo',
    'oTTTTTTTTTTTTo',
    'otttttttttttto',
    'oooooooooooooo'],
  flipflop: [
    '..oooooo....',
    '.obbbbbboo..',
    'obbOObbbbbo.',
    'obObbObbbbbo',
    'obbbbbbbbbbo',
    '.oBBBBBBBBo.',
    '..oooooooo..'],
  dust: [
    '..g..g...g..',
    '.ogGoGGoGo..',
    'oGGSSGGGGGo.',
    'oGSSGGGgGGGo',
    'oGGGGgGGGGo.',
    '.ooooooooo..'],
  brick: [
    '.ooo..ooo.',
    'oLLLooLLLo',
    'oRRRRRRRRo',
    'oRRRRRRRRo',
    'orrrrrrrro',
    '.oooooooo.'],
  charger: [
    '.....kkkk...',
    'oooo.k..k...',
    'oKKo.k..kk..',
    'oKGoKkkkk.k.',
    'oKKo......k.',
    'oooo..kkkk..'],
  catalog: [                      // a flat-pack furniture catalog: a blue masthead, a showroom photo (lamp, red sofa, wood floor), prices, and a dog-eared corner
    'oooooooooo...',
    'oBYYBYBBBBwo.',
    'oWWWWWWWWWwwo',
    'oWbYbbbbbbbWo',
    'oWbtRRRRRbbWo',
    'oWnRRRRRRRnWo',
    'oWkkkWWYYkWWo',
    'ooooooooooooo'],
  coupon: [                       // a stapled booklet of coupons, the top one torn along its perforation
    'ooooooooooo.',
    'oEEEEEEEEEoo',
    'oWWWWWWWWWWo',
    'oWEEWWkkWWWo',
    'okWkWkWkWkWo',
    'owwwwwwwwwwo',
    'oWkkWWWkkWWo',
    'oooooooooooo'],
  dvd: [
    'oooooooooo',
    'oAAAAAAAAo',
    'oAZZZZZZAo',
    'oAZkkkkZAo',
    'oAZZZZZZAo',
    'oAAAAAAYYo',
    'oooooooooo'],
  envelope: [
    'oooooooooooo',
    'oRRRRRRRRRRo',
    'oRWWWWWRRRRo',
    'oRRRRRRRRWRo',
    'orrrrrrrrrro',
    'oooooooooooo'],
  tape: [
    'oooooooooooo',
    'oKKKKKKKKKKo',
    'oKWWWWWWWWKo',
    'oKKGKKKKGKKo',
    'oKKKKKKKKKKo',
    'oooooooooooo'],
  soysauce: [
    'ooooooo',
    'oNNNNNo',
    'oNWWWNo',
    'oNNNNNo',
    'ooooooo'],
  bakingsoda: [
    'ooooooo',
    'oOOOOOo',
    'oWWWWWo',
    'oOOROOo',
    'oOOOOOo',
    'oOOOOOo',
    'ooooooo'],
  pickles: [
    '.ooooo.',
    '.oGGGo.',
    'oeeeeeo',
    'oeEeeeo',
    'oeEeeeo',
    'oeeEeeo',
    'oeeeeeo',
    '.ooooo.'],
  fishstick: [
    '...oooooo...',
    '..oCCCCCCo..',
    'ooooooooooooo',
    'oGGGGGGGGGGGo',
    'ooooooooooooo'],
  stapler: [
    '.oooooooo..',
    'oRRRRRRRRo.',
    'oRRRRRRRRRo',
    'oKKKKKKKKKo',
    'ooooooooooo'],
  mug: [
    'ooooooo..',
    'oWWWWWoo.',
    'oBBBBBoWo',
    'oWWWWWoWo',
    'oWWWWWoo.',
    '.ooooo...'],
  chopsticks: [
    'oooooooooooo',
    'oTTTTRTTTTTo',
    'oTTTTRTTTTTo',
    'oTTTTRTTTTTo',
    'oooooooooooo'],
  mousetrap: [
    '...GGGG....',
    '..G....G...',
    'oooooooooooo',
    'onnnnnnnnnno',
    'oooooooooooo'],
  soap: [
    '.oooooo.',
    'oMmmMMMo',
    'oMMMMMMo',
    '.oooooo.'],
  shampoo: [
    '.ooo.',
    '.oWo.',
    'oeeeo',
    'oWWWo',
    'oWkWo',
    'oeeeo',
    'ooooo'],
  burgerphone: [
    '..oooooo...',
    '.oTTTTTTo..',
    'oTWTTWTTTo.',
    'oEEEEEEEEoK',
    'oNNNNNNNNo.',
    'oTTTTTTTTo.',
    '.oooooooo..'],
  vhs: [                          // a shoebox with the lid off, VHS tapes standing in it spine-up, white labels showing
    '.oooooooooooo.',
    'oKWWKKWWKKWWKo',
    'oKKKKKKKKKKKKo',
    'oKWKKKWKKKWKKo',
    'oNNNNNNNNNNNNo',
    'onnnnnnRRRnnno',
    'onnRRRRRnnnnno',
    'onnnnnnnnnnnno',
    'oNNNNNNNNNNNNo',
    '.oooooooooooo.'],
  waffles: [
    'oooooooooo',
    'oYYYYYYYYo',
    'oYCCCCYYYo',
    'oYCyCyCYYo',
    'oYCCCCYRYo',
    'oooooooooo'],
  icetray: [
    'oooooooooooo',
    'obSbSbSbSbSo',
    'obbbbbbbbbbo',
    'oooooooooooo'],
  spoon: [
    '.........oo.',
    'oooooooooSSo',
    'oGGGGGGGGSSo',
    'ooooooooooo.']
};
/* the necktie: a loud 70s-style tie (think Disco Elysium's horrific necktie), and as long as a real one: a knot, a
   narrow neck that widens into the blade, warm blocks of orange, red and yellow up top, green and blue through the
   middle, gray-and-white flowers, and a yellow sun near the pointed tip. Laid out flat, top to bottom. */
const SPR_TIE = [
  '.ooooo.',
  'oOROYRo',
  '.oORYo.',
  '..oRo..',
  '..oOo..',
  '..oRo..',
  '..oYo..',
  '..oOo..',
  '..oRo..',
  '.oRYOo.',
  '.oOYRo.',
  '.oYROo.',
  '.oRORo.',
  '.oEBEo.',
  '.oBEBo.',
  'oEBEBEo',
  'oBEBEBo',
  'oEBBEEo',
  'oBEEBBo',
  'oWgWgWo',
  'ogWgWgo',
  'oWgWWgo',
  'ogWWgWo',
  'oWgWgWo',
  'oWWgWWo',
  'ogWYWgo',
  'oWYYYWo',
  'oYYYYYo',
  'oWYYYWo',
  'oWWYWWo',
  'ogWWWgo',
  '.oWWWo.',
  '..oWo..',
  '...o...'];
/* the same tie slung over a fan blade, sloppily: folded over the top, the short narrow end hanging behind on the
   left, the long wide end hanging in front on the right. Built from the flat tie, so the pattern matches. */
const SPR_TIE_DRAPE = (() => {
  const narrow = SPR_TIE.slice(3, 12).map(r => r.slice(2, 5)), wide = SPR_TIE.slice(9), rows = ['.ooooooooo.', 'oORYROOYRYo'];
  for (let i = 0; i < wide.length; i++) rows.push((i < narrow.length ? narrow[i] : i === narrow.length ? '.o.' : '...') + '.' + wide[i]);
  return rows;
})();
/* the same tie, small enough to hang over a fan blade across the room: a short tail and a long one */
const SPR_TIE_HANG = [
  '.oooooo.',
  'oORYROYo',
  'oRo.oRYo',
  'oOo.oYOo',
  'oYo.oEBo',
  'oEo.oBEo',
  '.o..oEBo',
  '....oWgo',
  '....ogWo',
  '....oWYo',
  '....oYYo',
  '....oWYo',
  '.....oo.'];
/* the tie looped over a fan blade, drawn to fit the blade it's on instead of pasted on top of it: a band that wraps
   across the blade (following its slant), then both ends hanging straight down from the blade's near edge, the
   narrow tail short and the wide one long with its pointed tip. A is the middle of the loop on the blade, n the
   half-width of the blade there (pointing across it), d a unit vector along the blade, s the size (1 room, 2+ close-up). */
const TIE_COLS = ['#f28c28', '#d43a2a', '#f2c418', '#2f9a8a'];
function drawTieOverBlade(g, A, n, d, s = 1, t = 0) {
  const sg = n[1] >= 0 ? 1 : -1, F = [A[0] + n[0] * sg, A[1] + n[1] * sg], Bk = [A[0] - n[0] * sg, A[1] - n[1] * sg];
  const half = 1.6 * s, w = [d[0] * half, d[1] * half], sway = Settings.get('motion') ? Math.sin(t * 1.3) * .5 * s : 0;
  // the band over the top of the blade, a touch raised (it's wrapped around something), with a shadow line on the blade
  fillPoly(g, [[Bk[0] - w[0], Bk[1] - w[1] - 1], [Bk[0] + w[0], Bk[1] + w[1] - 1], [F[0] + w[0], F[1] + w[1]], [F[0] - w[0], F[1] - w[1]]], TIE_COLS[1]);
  for (let k = 1; k < 4; k++) { const f = k / 4, a = [Bk[0] + (F[0] - Bk[0]) * f, Bk[1] + (F[1] - Bk[1]) * f - (1 - f)]; pxLine(g, a[0] - w[0], a[1] - w[1], a[0] + w[0], a[1] + w[1], TIE_COLS[k % 3 === 0 ? 2 : 0]); }
  pxLine(g, Bk[0] + w[0] + 1, Bk[1] + w[1], F[0] + w[0] + 1, F[1] + w[1] + 1, 'rgba(40,20,10,0.35)');
  // a tail hanging from the front edge: striped on the diagonal, a darker fold where it bends over the edge
  const tail = (x0, y0, wTop, wBot, len, point) => {
    for (let j = 0; j < len; j++) {
      const k = j / len, tip = point && j > len - wBot ? (len - j) / wBot : 1, wj = Math.max(1, Math.round((wTop + (wBot - wTop) * k) * tip));
      const cx = Math.round(x0 + sway * k * k * 4 - wj / 2);
      for (let i = 0; i < wj; i++) g.fillStyle = TIE_COLS[((((i + j) / (1.5 * s)) | 0) % 4 + 4) % 4], g.fillRect(cx + i, Math.round(y0) + j, 1, 1);
      g.fillStyle = 'rgba(60,20,10,0.45)'; g.fillRect(cx - 1, Math.round(y0) + j, 1, 1); g.fillRect(cx + wj, Math.round(y0) + j, 1, 1);   // a soft outline on both sides
      if (j < 2) { g.fillStyle = 'rgba(60,20,10,0.35)'; g.fillRect(cx, Math.round(y0) + j, wj, 1); }                                   // the fold over the edge
    }
    g.fillStyle = 'rgba(60,20,10,0.45)'; g.fillRect(Math.round(x0 + sway * 4 - .5), Math.round(y0) + len, 1, 1);
  };
  tail(F[0] - w[0] * .8, F[1] - w[1] * .8, 1.6 * s, 1.6 * s, Math.round(8 * s), false);           // the narrow end, short
  tail(F[0] + w[0] * .9, F[1] + w[1] * .9, 1.8 * s, 4 * s, Math.round(17 * s), true);             // the wide end, long, to a point
}
/* draw the flat tie turned on its side and a little askew (on the floor, or across the bottom of the bag) */
function drawTieFlat(g, x, y, s = 1, ang = -1.45) {
  const c = spriteCanvas(SPR_TIE, SPR_PAL);
  g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(ang); const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
  g.drawImage(c, Math.round(-c.width * s / 2), Math.round(-c.height * s / 2), c.width * s, c.height * s); g.imageSmoothingEnabled = sm; g.restore();
}

/* draw a sprite grid at (x, y) = its bottom center (top center for hanging things), s pixels per cell.
   The outline isn't a flat black: each outline pixel takes a darker shade of the color it borders (a "selective
   outline"), and the bottom edge is the darkest, so things sit in the room instead of looking pasted on. */
const _sprCache = new Map();
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); return '#' + [16, 8, 0].map(b => Math.round(((n >> b) & 255) * k).toString(16).padStart(2, '0')).join(''); }
function spriteCanvas(rows, pal) {
  const key = rows.join('/') + '|' + Object.values(pal).join(); if (_sprCache.has(key)) return _sprCache.get(key);
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), at = (i, j) => (rows[j] && rows[j][i]) || '.';
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = at(i, j); if (ch === '.' || !pal[ch]) continue;
    if (ch !== 'o') { g.fillStyle = pal[ch]; g.fillRect(i, j, 1, 1); continue; }
    let nb = null;                                                       // the nearest inside color, to darken
    for (const [di, dj] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) { const q = at(i + di, j + dj); if (q !== '.' && q !== 'o' && pal[q] && pal[q][0] === '#') { nb = pal[q]; break; } }
    const below = at(i, j + 1) === '.' || j === h - 1;                    // bottom edge: the contact line, darkest
    g.fillStyle = nb ? shade(nb, below ? .38 : .58) : 'rgba(30,22,34,0.75)'; g.fillRect(i, j, 1, 1);
  }
  if (_sprCache.size > 400) _sprCache.clear();
  _sprCache.set(key, c); return c;
}
function drawSprite(g, rows, x, y, s, pal = SPR_PAL, top = false) {
  const c = spriteCanvas(rows, pal), x0 = Math.round(x - c.width * s / 2), y0 = Math.round(top ? y : y - c.height * s);
  const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; g.drawImage(c, x0, y0, c.width * s, c.height * s); g.imageSmoothingEnabled = sm;
}
/* a scale of 1 for most of the room, 2 right up front, and whatever the close-ups and the bag ask for */
const sprScale = k => k >= 2.5 ? Math.round(k) : k >= 1.55 ? 2 : 1;
const BIG_ITEMS = { pizza: 2 };   // a pizza box is a big, flat thing: twice the size of the little stuff on the floor

/* paper never lands square: menus, catalogs, coupons, mailers, and phone books are dropped at a slant (the same slant
   every frame, from where they lie), and stretched a touch wider than tall so they read as flat on the floor */
const PAPER_ITEMS = new Set(['menu', 'catalog', 'coupon', 'envelope', 'phonebook']);
function drawPaper(g, rows, x, y, s, pal) {
  const c = spriteCanvas(rows, pal), h = Math.sin(Math.round(x) * 12.9898 + Math.round(y) * 78.233) * 43758.5453, f = h - Math.floor(h);
  const ang = (f < .5 ? -1 : 1) * (.14 + (f * 2 % 1) * .14);          // 8 to 16 degrees, either way
  g.save(); g.translate(Math.round(x), Math.round(y - c.height * s / 2)); g.rotate(ang);
  const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
  g.drawImage(c, Math.round(-c.width * s / 2), Math.round(-c.height * s / 2), c.width * s, c.height * s);
  g.imageSmoothingEnabled = sm; g.restore();
}
for (const [kind, rows] of Object.entries(ITEM_SPRITES)) {
  if (!CLUTTER[kind]) continue;
  CLUTTER[kind].draw = (g, x, y, k, c) => {
    let pal = SPR_PAL;
    if (kind === 'dvd') { const [a, z] = CASES[c && c.n ? c.n % CASES.length : 0]; pal = { ...SPR_PAL, A: a, Z: z }; }
    const sc = sprScale(k) * (k < 2.5 && BIG_ITEMS[kind] || 1);
    if (PAPER_ITEMS.has(kind)) return drawPaper(g, rows, x, y + 1, sc, pal);
    drawSprite(g, rows, x, y + 1, sc, pal);
  };
}
if (CLUTTER.tie) { CLUTTER.tie.hang = false; CLUTTER.tie.draw = (g, x, y, k) => drawTieFlat(g, g.canvas ? g.canvas.width / 2 : x, g.canvas ? g.canvas.height / 2 : y, 1, -1.5); }   // the whole long tie, laid across
