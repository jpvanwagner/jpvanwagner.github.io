'use strict';
/* ============================== SPRITES ============================== */
const PAL = { k: '#1b0f2e', w: '#ffffff', g: '#b8c7e0', c: '#2ce8f5', C: '#1196c7', r: '#ff2e63', R: '#b3133f', y: '#ffcc00', b: '#3d7bff', B: '#1d3f9e' };
const BODY = [
  '.....kkkkkk.....',
  '...kkwwwwwwkk...',
  '..kwwwwwwwwwwk..',
  '.kwwwwwwwwwwwgk.',
  '.kwkkkkkkkkkkgk.',
  '.kwkwwccccCCkgk.',
  '.kwkwccccccCkgk.',
  '.kwkccccccCCkgk.',
  '.kwwkkkkkkkkggk.',
  '..kgwwwwwwwggk..',
  '...kkgggggggk...',
  '...krrrrrrrrk...',
  '..krrryyyyrrRk..',
  '..krrrryyrrrRk..',
  '..krrrrrrrrRRk..',
  '...kbbbbbbbBk...'
];
const LEGS = {
  stand: ['...kbbk..kbBk...', '...kbBk..kbBk...', '..kwwwk..kwwwk..', '..kkkkk..kkkkk..'],
  run1: ['..kbbk....kbBk..', '.kbBk......kbBk.', 'kwwwk......kwwwk', 'kkkkk......kkkkk'],
  run2: ['....kbbkbBk.....', '....kbBkkwwk....', '...kwwwkkkk.....', '...kkkkk........'],
  jump: ['...kbbkkbBk.....', '..kwwwkkwwwk....', '..kkkkk.kkkk....', '................']
};
function bake(rows, pal) {
  const h = rows.length, w = rows[0].length, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((row, y) => { for (let x = 0; x < w; x++) { const col = pal[row[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  return c;
}
const SPR = { body: bake(BODY, PAL), bodyHurt: bake(BODY, Object.assign({}, PAL, { c: '#ff6b8f', C: '#c2184a' })) };
for (const k in LEGS) SPR[k] = bake(LEGS[k], PAL);

/* PeeDee in sprite space (16x20, facing right, feet at y=20). Used in game, dialogue, the end screen and score card.
   pose: 'idle' | 'run' | 'shoot' | 'clean' | 'cheer' | 'down'. o.swing (-1..1) swings the arms while running;
   o.glow (0..1) lights up the syringe tip just after a shot. */
const STEEL = '#d8dee8', STEEL_D = '#8a96ae';
function mitt(g, x, y) { g.fillStyle = PAL.k; g.fillRect(x - 1, y - 1, 4, 4); g.fillStyle = '#fff'; g.fillRect(x, y, 2, 2); }
/* A dental air/water syringe: a steel handle with two buttons and a long, perfectly straight tip. */
function syringeH(g, x, y, glow) {                       // pointing right from (x, y)
  g.fillStyle = PAL.k; g.fillRect(x, y - 1, 7, 3); g.fillRect(x + 7, y, 5, 1);
  g.fillStyle = STEEL; g.fillRect(x, y, 6, 1);
  g.fillStyle = '#ffffff'; g.fillRect(x + 1, y, 2, 1);
  g.fillStyle = PAL.c; g.fillRect(x + 2, y - 2, 1, 1); g.fillStyle = '#fff'; g.fillRect(x + 4, y - 2, 1, 1);
  g.fillStyle = STEEL_D; g.fillRect(x + 7, y, 4, 1);
  if (glow > 0) {                                          // a faint glow at the tip, like a curing light
    g.globalAlpha = 0.35 * glow; g.fillStyle = '#bff8ff'; g.fillRect(x + 10, y - 2, 5, 5); g.fillRect(x + 9, y - 1, 7, 3);
    g.globalAlpha = 0.8 * glow; g.fillStyle = '#ffffff'; g.fillRect(x + 11, y - 1, 3, 3);
    g.globalAlpha = 1;
  }
}
function syringeDiag(g, x, y) {                          // carried pointing forward and down (2 across : 1 down)
  for (let i = 0; i < 3; i++) { g.fillStyle = PAL.k; g.fillRect(x + i * 2, y + i - 1, 3, 3); }
  for (let i = 0; i < 3; i++) { g.fillStyle = STEEL; g.fillRect(x + i * 2, y + i, 2, 1); }
  g.fillStyle = PAL.c; g.fillRect(x + 1, y - 2, 1, 1);
  g.fillStyle = STEEL_D; g.fillRect(x + 6, y + 3, 2, 1); g.fillRect(x + 8, y + 4, 2, 1);
}
function syringeUp(g, x, y) {                            // held straight up, tip at the top
  g.fillStyle = PAL.k; g.fillRect(x - 1, y - 6, 3, 7); g.fillRect(x, y - 10, 1, 4);
  g.fillStyle = STEEL; g.fillRect(x, y - 5, 1, 5);
  g.fillStyle = PAL.c; g.fillRect(x + 2, y - 4, 1, 1);
  g.fillStyle = STEEL_D; g.fillRect(x, y - 10, 1, 4);
}
function toothbrush(g, x, y) {                           // a little toothbrush, bristles down
  g.fillStyle = PAL.k; g.fillRect(x - 1, y - 1, 10, 3); g.fillRect(x + 6, y - 2, 5, 3);
  g.fillStyle = PAL.c; g.fillRect(x, y, 7, 1);
  g.fillStyle = '#ffffff'; g.fillRect(x + 7, y - 1, 3, 1);
  g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) g.fillRect(x + 6 + i, y + 1, 1, i % 2 ? 2 : 3);
  g.fillStyle = '#bff6ff'; g.fillRect(x + 7, y + 1, 1, 1);
}
function drawPeeDee(g, legs, pose, t, hurt, o) {
  o = o || {};
  const sw = o.swing || 0;
  if (pose === 'idle' || pose === 'run') { if (sw > 0.3) mitt(g, 1, 13); else if (sw > -0.3) mitt(g, 2, 14); }   // the far arm, mostly behind the body
  if (pose === 'cheer') mitt(g, 1, 12);
  g.drawImage(hurt ? SPR.bodyHurt : SPR.body, 0, 0);
  g.drawImage(SPR[legs], 0, 16);
  if (pose === 'down') {                                   // knocked out: X's for eyes, arms limp
    g.fillStyle = PAL.k; for (const ex of [4, 9]) { g.fillRect(ex, 5, 1, 1); g.fillRect(ex + 2, 5, 1, 1); g.fillRect(ex + 1, 6, 1, 1); g.fillRect(ex, 7, 1, 1); g.fillRect(ex + 2, 7, 1, 1); }
    mitt(g, 12, 14);
    return;
  }
  if (pose === 'clean') {                                  // scrubbing away with a toothbrush
    const sx = 6 + Math.round(Math.sin(t * 0.55) * 3);
    g.fillStyle = PAL.r; g.fillRect(11, 12, 2, 2);
    toothbrush(g, sx + 2, 18); mitt(g, sx, 16);
    return;
  }
  if (pose === 'shoot') {                                  // arm out, syringe level
    g.fillStyle = PAL.k; g.fillRect(11, 10, 3, 4); g.fillStyle = PAL.r; g.fillRect(11, 11, 2, 2);
    mitt(g, 13, 11); syringeH(g, 16, 12, o.glow || 0);
    return;
  }
  if (pose === 'cheer') {                                  // fist punched high, syringe and all
    const by = Math.round(o.bob || 0);
    g.fillStyle = PAL.k; g.fillRect(14, 2 + by, 3, 11 - by); g.fillStyle = PAL.r; g.fillRect(15, 3 + by, 1, 9 - by);
    mitt(g, 15, by); syringeUp(g, 16, by - 1);
    return;
  }
  // idle / running: the near arm swings, syringe carried pointing down and forward
  const hx = 12 + Math.round(sw * 2), hy = 14 - Math.round(Math.abs(sw));
  g.fillStyle = PAL.k; g.fillRect(10, 11, 3, 3); g.fillStyle = PAL.r; g.fillRect(11, 11, 1, 2);
  mitt(g, hx, hy); syringeDiag(g, hx + 2, hy + 1);
}
