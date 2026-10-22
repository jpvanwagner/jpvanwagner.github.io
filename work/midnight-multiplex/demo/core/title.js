/* ════════════════════════════════════════════════════════════════════════════
 * MIDNIGHT AT THE MULTIPLEX — TITLE SCREEN MODULE
 * ────────────────────────────────────────────────────────────────────────────
 * Location: midmulti/core/title.js
 * Renders an animated pixel-art title screen onto a 384×288 internal canvas
 * (displayed at any integer multiple — typically 2x = 768×576).
 *
 * USAGE FROM A HOST PAGE
 * ──────────────────────────────────────────────────────────────────────────
 *   <canvas id="stage" width="384" height="288"></canvas>
 *   <script src="core/title.js"></script>
 *   <script>
 *     GameTitle.init(document.getElementById('stage'), {
 *       // Called when the player presses a number key 1-6 in the menu.
 *       // Wire this up to load whatever you want for each menu item.
 *       onMenuSelect(n) {
 *         // n is 1..6 corresponding to:
 *         //   1 = NEW GAME      → e.g. load('scenes/new_game.js')
 *         //   2 = LOAD GAME     → e.g. load('scenes/load_game.js')
 *         //   3 = SETTINGS      → e.g. load('scenes/settings.js')
 *         //   4 = CREDITS       → e.g. load('scenes/credits.js')
 *         //   5 = HELP          → e.g. load('scenes/help.js')
 *         //   6 = QUIT          → e.g. window.close() or load main menu
 *         //
 *         // YOU CAN CHANGE THIS — the title screen doesn't care what
 *         // your menu items DO; it just tells you which one was picked.
 *         console.log('menu selected:', n);
 *       }
 *     });
 *   </script>
 *
 * RUNTIME API
 * ──────────────────────────────────────────────────────────────────────────
 * After init(), the returned namespace exposes:
 *   GameTitle.triggerFlicker(type)   // 0 = common, 1 = shorted-out + sparks
 *   GameTitle.spawnCrew()            // re-randomise the concessionists
 *   GameTitle.triggerSpeech()        // make a concessionist say something
 *   GameTitle.setCandyIntensity(0..8)
 *   GameTitle.setNeonIntensity(0..5)
 *
 * KEY HOOKS YOU CAN EDIT TO CUSTOMISE THE TITLE SCREEN
 * ──────────────────────────────────────────────────────────────────────────
 *  - SPEECH_LINES   — the pool of idle remarks concessionists speak.
 *                     Edit the array to change what they say.
 *  - PAL            — the 36-entry palette (indexed via ix()). Edit to
 *                     re-skin the whole scene.
 *  - SCENE          — runtime object with x/y of every prop. Lets you
 *                     reposition the popper, soda machine, candy case,
 *                     register, door, marquee, etc.
 *  - LIGHTS         — { candy: 4, neon: 2 } default intensities. Bump to
 *                     start with brighter lighting.
 *  - LAYOUT CONSTANTS at the top of buildBackground():
 *      FRONTCTR_TOP / BACKCTR_TOP — counter heights
 *      FLOOR_Y                   — top of the carpet
 *      POPPER_X                  — x of the popcorn popper
 *      PX0,PY0,PX1,PY1           — main-menu box rect
 *  - "MIDNIGHT AT THE / MULTIPLEX" title text — search for those strings
 *    in buildBackground() to change the title.
 *
 * STATE OF EVERY MAJOR ELEMENT
 * ──────────────────────────────────────────────────────────────────────────
 *  - Marquee + bulkhead     — buildBackground() top section
 *  - Main menu               — buildBackground(), search "MAIN MENU"
 *  - Back counter + popper   — buildBackground() back-counter block
 *  - Popcorn popper          — popcornPopper() function
 *  - Butter pump             — inline in buildBackground after back counter
 *  - Front counter + candy   — candyCase() + buildBackground front-counter
 *  - Soda fountain + ICEEs   — sodaMachineDraw() + drawAgitators()
 *  - Cash register           — cashRegisterDraw()
 *  - Staff door              — drawStaffDoor() + drawDoorOverlay() per frame
 *  - Concessionists          — drawCharacterFront() + drawCharacterSide() +
 *                              spawnCrew() / updateCrew()
 *  - Sweepers                — same character sprites + drawSweeperProps()
 *  - Velvet rope             — drawRopeLayer()
 *  - Speech bubbles          — drawSpeech() + SPEECH_LINES
 *  - Lighting + flickers     — drawLightingPass() + tickLightingState()
 * ════════════════════════════════════════════════════════════════════════════
 */

window.GameTitle = (function(){
  'use strict';

  // The host page calls GameTitle.init(canvas, opts) which fires up the
  // entire scene on that canvas. All internal state is scoped to this IIFE
  // and does NOT leak into the global namespace.
  const _api = {};

  _api.init = function(_canvas, _opts){
    _opts = _opts || {};

    // ── KEYBOARD MENU SELECT [1-6] ─────────────────────────────────────────
    // Pressing 1-6 fires opts.onMenuSelect(n). The host wires this up to
    // load whatever scene/file corresponds to that menu item. The title
    // screen does NOT do file loading itself — it just reports which menu
    // entry was picked. Edit the numbers below or the handler in your host
    // page to change the menu mapping.
    if(_opts.onMenuSelect){
      window.addEventListener('keydown', (e)=>{
        const n = parseInt(e.key, 10);
        if(n >= 1 && n <= 6){
          _opts.onMenuSelect(n);
        }
      });
    }

    // ── MOUSE MENU SELECT — click a menu entry (hit-test the canvas) ───────────
    // The menu is drawn on the canvas, so there are no DOM buttons to click. We
    // map the click from display pixels back to the internal 384x288 coordinate
    // space and test it against the menu-row rects. The geometry below MUST match
    // the MAIN MENU block in buildBackground() (PX0/PY0/PX1 + rowY formula).
    if(_opts.onMenuSelect && _canvas){
      const PX0=150, PY0=89, PX1=300;
      const rowY=(i)=>PY0+16+i*10;
      const rects=[];
      for(let i=0;i<3;i++){
        rects.push({n:i+1, x0:PX0+5,  x1:PX0+78, y0:rowY(i)-2, y1:rowY(i)+9});   // left column 1-3
        rects.push({n:i+4, x0:PX0+78, x1:PX1-3,  y0:rowY(i)-2, y1:rowY(i)+9});   // right column 4-6
      }
      _canvas.addEventListener('click',(e)=>{
        const r=_canvas.getBoundingClientRect();
        if(!r.width||!r.height) return;
        const cx=(e.clientX-r.left)*(384/r.width);    // display px -> internal coords
        const cy=(e.clientY-r.top)*(288/r.height);
        for(const m of rects){ if(cx>=m.x0&&cx<=m.x1&&cy>=m.y0&&cy<=m.y1){ _opts.onMenuSelect(m.n); return; } }
      });
      // hint that the menu is clickable
      try { _canvas.style.cursor='pointer'; } catch(e){}
    }


/* ╔══════════════════════════════════════════════════════════════════════╗
   ║  WHAT TO EDIT                                                        ║
   ║   TITLE  — drawTextCentered() calls in buildBackground(): search     ║
   ║            'MIDNIGHT AT THE' / 'MULTIPLEX'.                          ║
   ║   COLOURS— the PAL array; every entry commented.                     ║
   ║   LAYOUT — buildBackground() sets the depth levels near its top.     ║
   ║   SPEECH — SPEECH_LINES pool.                                        ║
   ║   SPRITE — drawCharacter(): the one shared character sprite.         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

/* ════════════════════════════════════════════════════════════════════════
   1. PALETTE
   ──────────────────────────────────────────────────────────────────────
   36 colors indexed 0..35 (`ix('0')` … `ix('z')`). Indices 1-4 are the
   bulb-chase animation cycle — don't use them for static elements unless
   you want them to flicker every 5 frames.
   To re-skin the scene: change the hex values below. Names are mnemonic
   only; the code references colors by INDEX through ix(char).
   ════════════════════════════════════════════════════════════════════════ */
const PAL = [
  'transparent', // 0
  '#5a5a18',     // 1  bulb off
  '#aaaa00',     // 2  bulb low
  '#ffff55',     // 3  bulb on
  '#ffffd0',     // 4  bulb peak
  '#08080c',     // 5  near-black (slacks, bowtie, carpet bg)
  '#16161e',     // 6  wall dark
  '#23232e',     // 7  wall mid
  '#33333f',     // 8  wall lit
  '#1a1a22',     // 9  shadow / depth side-face
  '#44444f',     // a  metal edge / light tile line
  '#2c2c38',     // b  counter face
  '#ff5555',     // c  red
  '#aa2222',     // d  red dark / velvet
  '#ffaa00',     // e  orange / trim
  '#aa5500',     // f  orange dark
  '#55ffff',     // g  ICEE cyan
  '#5555ff',     // h  ICEE blue
  '#ffffff',     // i  white
  '#aaaaaa',     // j  light grey metal
  '#666672',     // k  mid grey
  '#55ff55',     // l  green
  '#ffe0b0',     // m  skin light
  '#3a2a1a',     // n  hair dark brown
  '#d8d8e0',     // o  bright metal / glass shine
  '#7a1f3a',     // p  burgundy vest
  '#5a1228',     // q  burgundy vest shadow
  '#c89030',     // r  kettle brass
  '#e8c060',     // s  popcorn light
  '#ff66cc',     // t  NEON PINK — marquee frame, neon line halo
  '#2ab0a8',     // u  counter teal — slightly LIGHTER and more cyan than
                 //    the door's ix('v') teal, so the counter lip is
                 //    clearly teal-family but not matchy-matchy with the door
  '#1a8a88',     // v  door teal
  '#0d4f4e',     // w  door teal shadow
  '#2a4a6a',     // x  carpet teal shape
  '#ffaaff',     // y  NEON PINK BRIGHT — neon line core, marquee highlight
  '#caa050',     // z  skin medium / brass mid
];
const fromC = c => parseInt(c, 36);
function ix(ch){ return fromC(ch); }

/* ════════════════════════════════════════════════════════════════════════
   2. GRID PRIMITIVES + DEPTH
   ════════════════════════════════════════════════════════════════════════ */
const W = 384, H = 288;
const DEPTH = 4;

function blankGrid(){
  const g=[]; for(let y=0;y<H;y++) g.push(new Array(W).fill(5)); return g;
}
function pset(g,x,y,i){ if(x>=0&&x<W&&y>=0&&y<H&&i!==0) g[y][x]=i; }
function rect(g,x0,y0,x1,y1,i){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) pset(g,x,y,i); }
function frameRect(g,x0,y0,x1,y1,i){
  for(let x=x0;x<=x1;x++){ pset(g,x,y0,i); pset(g,x,y1,i); }
  for(let y=y0;y<=y1;y++){ pset(g,x0,y,i); pset(g,x1,y,i); }
}
function hline(g,x0,x1,y,i){ for(let x=x0;x<=x1;x++) pset(g,x,y,i); }
function vline(g,y0,y1,x,i){ for(let y=y0;y<=y1;y++) pset(g,x,y,i); }
function disc(g,cx,cy,r,i){
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)
    if(x*x+y*y<=r*r) pset(g,cx+x,cy+y,i);
}
function ringG(g,cx,cy,r,i){
  for(let a=0;a<360;a+=3){
    pset(g,Math.round(cx+r*Math.cos(a*Math.PI/180)),
           Math.round(cy+r*Math.sin(a*Math.PI/180)),i);
  }
}

/* ── 5×7 main font ────────────────────────────────────────────────────── */
const FONT = {
 A:["01110","10001","10001","11111","10001","10001","10001"],
 B:["11110","10001","10001","11110","10001","10001","11110"],
 C:["01110","10001","10000","10000","10000","10001","01110"],
 D:["11110","10001","10001","10001","10001","10001","11110"],
 E:["11111","10000","10000","11110","10000","10000","11111"],
 F:["11111","10000","10000","11110","10000","10000","10000"],
 G:["01110","10001","10000","10111","10001","10001","01111"],
 H:["10001","10001","10001","11111","10001","10001","10001"],
 I:["11111","00100","00100","00100","00100","00100","11111"],
 J:["00111","00010","00010","00010","00010","10010","01100"],
 K:["10001","10010","10100","11000","10100","10010","10001"],
 L:["10000","10000","10000","10000","10000","10000","11111"],
 M:["10001","11011","10101","10101","10001","10001","10001"],
 N:["10001","11001","10101","10011","10001","10001","10001"],
 O:["01110","10001","10001","10001","10001","10001","01110"],
 P:["11110","10001","10001","11110","10000","10000","10000"],
 Q:["01110","10001","10001","10001","10101","10010","01101"],
 R:["11110","10001","10001","11110","10100","10010","10001"],
 S:["01111","10000","10000","01110","00001","00001","11110"],
 T:["11111","00100","00100","00100","00100","00100","00100"],
 U:["10001","10001","10001","10001","10001","10001","01110"],
 V:["10001","10001","10001","10001","01010","01010","00100"],
 W:["10001","10001","10001","10101","10101","11011","10001"],
 X:["10001","10001","01010","00100","01010","10001","10001"],
 Y:["10001","10001","01010","00100","00100","00100","00100"],
 Z:["11111","00001","00010","00100","01000","10000","11111"],
 '0':["01110","10011","10101","10101","10101","11001","01110"],
 '1':["00100","01100","00100","00100","00100","00100","01110"],
 '2':["01110","10001","00001","00110","01000","10000","11111"],
 '3':["11110","00001","00001","01110","00001","00001","11110"],
 '4':["00010","00110","01010","10010","11111","00010","00010"],
 '5':["11111","10000","11110","00001","00001","10001","01110"],
 '6':["00110","01000","10000","11110","10001","10001","01110"],
 '9':["01110","10001","10001","01111","00001","00010","01100"],
 ' ':["00000","00000","00000","00000","00000","00000","00000"],
 '$':["00100","01111","10100","01110","00101","11110","00100"],
 '.':["00000","00000","00000","00000","00000","00110","00110"],
 ',':["00000","00000","00000","00000","00110","00110","01100"],
 '(':["00010","00100","01000","01000","01000","00100","00010"],
 ')':["01000","00100","00010","00010","00010","00100","01000"],
 '-':["00000","00000","00000","11111","00000","00000","00000"],
 '#':["01010","11111","01010","01010","11111","01010","00000"],
 '{':["01110","10001","10111","11001","10111","10001","01110"],
};
function textWidth(text,scale){ return text.length*(6*scale)-scale; }
function drawText(g,text,x0,y0,scale,colorFn){
  let x=x0;
  for(const ch of text){
    const glyph=FONT[ch.toUpperCase()]||FONT[' '];
    for(let r=0;r<7;r++)for(let c=0;c<5;c++){
      if(glyph[r][c]==='1'){
        const i=(typeof colorFn==='function')?colorFn(c,r,x):colorFn;
        rect(g,x+c*scale,y0+r*scale,x+c*scale+scale-1,y0+r*scale+scale-1,i);
      }
    }
    x+=(5*scale)+scale;
  }
  return x;
}
function drawTextCentered(g,text,x0,x1,y0,scale,colorFn){
  const w=textWidth(text,scale);
  return drawText(g,text,Math.round(x0+((x1-x0)-w)/2),y0,scale,colorFn);
}

/* ── compact 3×5 font for speech ──────────────────────────────────────── */
const FONT_SMALL = {
 A:["010","101","111","101","101"], B:["110","101","110","101","110"],
 C:["011","100","100","100","011"], D:["110","101","101","101","110"],
 E:["111","100","110","100","111"], F:["111","100","110","100","100"],
 G:["011","100","101","101","011"], H:["101","101","111","101","101"],
 I:["111","010","010","010","111"], J:["001","001","001","101","010"],
 K:["101","110","100","110","101"], L:["100","100","100","100","111"],
 M:["101","111","111","101","101"], N:["101","111","111","111","101"],
 O:["010","101","101","101","010"], P:["110","101","110","100","100"],
 Q:["010","101","101","110","011"], R:["110","101","110","101","101"],
 S:["011","100","010","001","110"], T:["111","010","010","010","010"],
 U:["101","101","101","101","011"], V:["101","101","101","101","010"],
 W:["101","101","111","111","101"], X:["101","101","010","101","101"],
 Y:["101","101","010","010","010"], Z:["111","001","010","100","111"],
 '0':["010","101","101","101","010"], '1':["010","110","010","010","111"],
 '2':["110","001","010","100","111"], '3':["110","001","010","001","110"],
 '4':["101","101","111","001","001"], '5':["111","100","110","001","110"],
 '6':["011","100","110","101","010"],
 ' ':["000","000","000","000","000"], '.':["000","000","000","000","010"],
 ',':["000","000","000","010","100"], "'":["010","010","000","000","000"],
 '?':["110","001","010","000","010"], '!':["010","010","010","000","010"],
 '-':["000","000","111","000","000"],
 '#':["0101","1111","0101","1111","1010"],
 '{':["0111","1000","1011","1000","0111"],  // © glyph for FONT_SMALL
};
function spCharW(ch){ const g=FONT_SMALL[ch.toUpperCase()]; return g?g[0].length:3; }
function smallTextWidth(text){ let w=0; for(const ch of text) w+=spCharW(ch)+1; return w-1; }

/* ════════════════════════════════════════════════════════════════════════
   3. BACKGROUND LAYER — the static set, built once into a grid.
   ════════════════════════════════════════════════════════════════════════ */
const SCENE = {};                 // filled by buildBackground()

function buildBackground(){
  const g = blankGrid();

  // ── LAYOUT CONSTANTS ───────────────────────────────────────────────────
  // These pin every major element's vertical/horizontal position. Adjust
  // them to reshape the lobby (e.g. lower the counter, push the popper).
  // The candy case, rope barrier, character feetY, and popper all derive
  // from these — changing one value cascades through the scene.
  const BACKCTR_TOP  = 158;       // top of the back counter — lowered 8px [#6]
  const FRONTCTR_TOP = 200;       // top (front edge) of the front counter
  const FLOOR_Y      = 250;       // carpet begins
  const FRONTCTR_BOT = FLOOR_Y;   // counter face runs ALL the way to the
                                  // floor — hides the bases of the door,
                                  // ICEE units and popper behind it [#4]
  const POPPER_X     = 312;
  SCENE.frontCtrTop=FRONTCTR_TOP; SCENE.backCtrTop=BACKCTR_TOP;
  SCENE.floorY=FLOOR_Y;

  // ── BACK WALL ─────────────────────────────────────────────────────
  rect(g,0,0,W-1,H-1,6);
  rect(g,0,0,W-1,46,7);
  // (the "LOBBY" wall clock that used to sit upper-right was removed [#9])

  // ── MARQUEE BULKHEAD as JUTTING CEILING [#4] ──────────────────────
  // The entire upper region (marquee sign + neon side lines) is treated
  // as a CEILING section that JUTS FORWARD toward the viewer, like an
  // overhang above the concession stand. The marquee frame stays at
  // y=MY0..MY1 as the FRONT face. Below that we draw an angled BOTTOM
  // (underside-of-ceiling) face receding back into the scene — this is
  // what reads as the overhang. The neon side lines also follow this
  // tilt: they're on the front face, with a short underside face below.
  const MX0=56, MX1=W-57, MY0=6, MY1=82;
  const CEILING_DEPTH = 10;           // how far the ceiling overhangs forward
  // ── CEILING UNDERSIDE [#3] — the bottom edge of the bulkhead ANGLES
  //    UP at the same slope as the neon side lines (0.18). The center
  //    portion (under the marquee box itself) is flat; outside the
  //    marquee, each side angles UP-and-out toward the screen edges,
  //    so the whole bottom reads as one coherent oblique face receding
  //    upward — matching how the neon lines recede.
  const CEILING_SLOPE = 0.18;
  // For each x column on screen, compute the "front edge y" of the
  // underside at that x. Under the marquee box (MX0..MX1) it's a flat
  // MY1+1. Outside the marquee, it angles up.
  function ceilingFrontY(x){
    if(x >= MX0 && x <= MX1) return MY1 + 1;
    if(x < MX0)  return MY1 + 1 - Math.round((MX0 - 4 - x) * CEILING_SLOPE);
    /* x > MX1 */ return MY1 + 1 - Math.round((x - (MX1 + 4)) * CEILING_SLOPE);
  }
  // Draw the underside: at each x, fill CEILING_DEPTH rows starting at
  // that x's front-edge y and going UP (since the underside RECEDES up
  // into the back). The result is a wedge that matches the neon angle.
  for(let x=0; x<W; x++){
    const frontY = ceilingFrontY(x);
    for(let s=0; s<CEILING_DEPTH; s++){
      const yRow = frontY - s;
      if(yRow < 0 || yRow >= H) continue;
      // s=0 is the front edge (brightest); deeper = darker
      const col = (s < 2) ? ix('k') : (s < 5) ? ix('9') : 5;
      pset(g, x, yRow, col);
    }
  }
  // ── BULKHEAD LIP [#5] — a continuous bright BAND along the bottom
  //    edge of the underside. Under the marquee box the lip is 2-3 rows
  //    thick directly UNDER the box's bottom edge, joining the diagonal
  //    side bottoms with the marquee's bottom. The whole bottom reads
  //    as one continuous ceiling lip.
  for(let x=0; x<W; x++){
    const lipY = ceilingFrontY(x);
    // 2-row bright lip
    if(lipY >= 0 && lipY < H)     pset(g, x, lipY,   ix('o'));
    if(lipY+1 >= 0 && lipY+1 < H) pset(g, x, lipY+1, ix('o'));
    // a soft shadow row below the lip
    if(lipY+2 >= 0 && lipY+2 < H) pset(g, x, lipY+2, ix('9'));
  }
  // ── BULKHEAD TOP LIP — parallel highlight at the TOP of the bulkhead,
  //    mirroring the bottom lip across the entire width. Under the
  //    marquee box, it sits flush at the box's TOP edge (MY0-1).
  //    Outside the marquee, it follows the same upward angle as the
  //    bottom (offset by the marquee box's height) so the bulkhead reads
  //    as one continuous ceiling element, top AND bottom defined.
  function ceilingTopY(x){
    // mirror the front-edge angle but using MY0 as the front edge
    if(x >= MX0 && x <= MX1) return MY0 - 1;
    if(x < MX0)  return Math.max(0, (MY0 - 1) - Math.round((MX0 - 4 - x) * CEILING_SLOPE));
    return Math.max(0, (MY0 - 1) - Math.round((x - (MX1 + 4)) * CEILING_SLOPE));
  }
  for(let x=0; x<W; x++){
    const topY = ceilingTopY(x);
    if(topY >= 0 && topY < H)     pset(g, x, topY,   ix('o'));
    if(topY-1 >= 0 && topY-1 < H) pset(g, x, topY-1, ix('o'));
    if(topY+1 >= 0 && topY+1 < H) pset(g, x, topY+1, ix('9'));
  }
  rect(g,MX0,MY0,MX1,MY1,5);                       // black sign panel
  // double pink frame
  frameRect(g,MX0,MY0,MX1,MY1,ix('t'));            // outer neon pink
  frameRect(g,MX0+3,MY0+3,MX1-3,MY1-3,ix('y'));    // inner brighter pink
  // ── NEON SIDE LINES on the angled marquee sides [#5] ──
  // Lines angle UPWARD (out and UP toward the screen edges), so the
  // marquee reads as jutting forward with the receding sides going up
  // toward the back/ceiling. (The opposite slope made the marquee feel
  // like it sat on top of an angled stage, which wasn't the intent.)
  const linesT=[0.20, 0.50, 0.80];
  for(const t of linesT){
    const yAtFront = MY0+Math.round((MY1-MY0)*t);
    // LEFT side — angles UP going left
    for(let x=0;x<=MX0-4;x++){
      const dx = MX0-4-x;                           // 0 at MX0, increasing left
      const ly = yAtFront - Math.round(dx * 0.18);  // angles UP going left
      if(ly>=0 && ly<H){
        pset(g,x,ly-1,ix('t'));
        pset(g,x,ly  ,ix('y'));
        pset(g,x,ly+1,ix('t'));
      }
    }
    // RIGHT side — mirror; angles UP going right
    for(let x=MX1+4;x<W;x++){
      const dx = x-(MX1+4);
      const ly = yAtFront - Math.round(dx * 0.18);
      if(ly>=0 && ly<H){
        pset(g,x,ly-1,ix('t'));
        pset(g,x,ly  ,ix('y'));
        pset(g,x,ly+1,ix('t'));
      }
    }
  }
  // evenly-spaced bulbs INSIDE the marquee — still cycle on indices 1-4
  SCENE.bulbs=[];
  let phase=0;
  const placeBulb=(bx,by)=>{ rect(g,bx-1,by-1,bx+1,by+1,1+(phase%4));
    SCENE.bulbs.push({x:bx,y:by}); phase++; };
  const bX0=MX0+8,bX1=MX1-8,bY0=MY0+8,bY1=MY1-8;
  const nX=Math.round((bX1-bX0)/22), nY=Math.max(1,Math.round((bY1-bY0)/20));
  for(let i=0;i<=nX;i++){ const bx=Math.round(bX0+(bX1-bX0)*i/nX);
    placeBulb(bx,bY0); placeBulb(bx,bY1); }
  for(let j=1;j<nY;j++){ const by=Math.round(bY0+(bY1-bY0)*j/nY);
    placeBulb(bX0,by); placeBulb(bX1,by); }
  // title — vertically centred in the inner sign area
  const titleColor=(c,r)=> r<2?4: r<5?3:2;
  const tTop=MY0+10+8;
  drawTextCentered(g,'MIDNIGHT AT THE',MX0,MX1,tTop,2,titleColor);
  drawTextCentered(g,'MULTIPLEX',MX0,MX1,tTop+18,3,titleColor);

  // ── STAFF DOOR — teal, lit window (raised a bit) ──────────────────
  // The door is drawn by a dedicated function so the animation layer can
  // redraw it open/closed. We store its geometry for that.
  SCENE.door = { x:6, y:90, w:50, floorY:FLOOR_Y,
                 // window near the TOP of the door [#2]
                 winY0:90+16, winY1:90+44, winX0:6+11, winX1:6+50-11 };
  drawStaffDoor(g, SCENE.door, 'closed');

  // ── POPCORN POPPER — full floor unit ──────────────────────────────
  SCENE.popper = popcornPopper(g, POPPER_X, 92, FLOOR_Y);

  // ── ICEE MACHINES — floor units ───────────────────────────────────
  SCENE.icee=[
    // ICEE machines — topY lowered again so each unit is ~8px shorter
    // still; everything ON the unit stays the same size [#6].
    iceeUnit(g, 64, 113, FLOOR_Y, 'h'),
    iceeUnit(g, 102, 113, FLOOR_Y, 'c'),
  ];

  // ── BACK COUNTER + CABINETS ───────────────────────────────────────
  // BACK_X1 now extends right up to the popper edge (popper begins at
  // POPPER_X). They share an edge so there's no awkward gap of
  // background visible between counter end and popper start [#6].
  const BACK_X0=140, BACK_X1=POPPER_X-1;
  const CAB_TOP=BACKCTR_TOP+14;          // cabinet top — lowered ~8px
  // ── BUTTER PUMP NOTCH [#8] — a "dipped-down" indent in the counter
  //    just left of the popper, where the butter pump sits. The notch
  //    lowers the counter top by NOTCH_DEPTH px across x = BPMP_X0..BPMP_X1.
  const BPMP_X0 = BACK_X1 - 18;          // notch left edge (left of popper)
  const BPMP_X1 = BACK_X1 - 4;           // notch right edge
  const NOTCH_DEPTH = 6;
  rect(g,BACK_X0,CAB_TOP,BACK_X1,FLOOR_Y-1,8);                // cabinet body
  for(let cx=BACK_X0+4;cx<BACK_X1-10;cx+=30){
    frameRect(g,cx,CAB_TOP+3,cx+24,FLOOR_Y-4,ix('k'));        // cabinet doors
    pset(g,cx+20,CAB_TOP+10,ix('o'));                         // door handle
  }
  // counter slab with an oblique 3D top — the depth face stops at
  // BACK_X1 (doesn't extend past, which would clip into the popper [#6])
  // EXCEPT inside the butter pump notch, where the depth face dips down.
  for(let s=0;s<DEPTH;s++){
    for(let xx=BACK_X0+s+1; xx<=BACK_X1; xx++){
      // if in the notch, shift y down by NOTCH_DEPTH for that span
      const inNotch = (xx>=BPMP_X0 && xx<=BPMP_X1);
      const yRow = BACKCTR_TOP-1-s + (inNotch ? NOTCH_DEPTH : 0);
      pset(g, xx, yRow, (s<DEPTH-1)?ix('u'):ix('w'));
    }
  }
  // Counter TOP teal stripe — also dips into the notch
  for(let xx=BACK_X0; xx<=BACK_X1; xx++){
    const inNotch = (xx>=BPMP_X0 && xx<=BPMP_X1);
    const yOff = inNotch ? NOTCH_DEPTH : 0;
    // bright teal lip (2 rows)
    pset(g,xx,BACKCTR_TOP+yOff,   ix('u'));
    pset(g,xx,BACKCTR_TOP+1+yOff, ix('u'));
    pset(g,xx,BACKCTR_TOP+2+yOff, ix('u'));
    // teal shadow row
    pset(g,xx,BACKCTR_TOP+3+yOff, ix('w'));
    pset(g,xx,BACKCTR_TOP+4+yOff, ix('w'));
    pset(g,xx,BACKCTR_TOP+5+yOff, ix('w'));
  }
  // VERTICAL EDGES of the notch — drop walls connecting the upper
  // counter top to the lower notch floor on each side.
  for(let yy=BACKCTR_TOP; yy<=BACKCTR_TOP+NOTCH_DEPTH+5; yy++){
    pset(g, BPMP_X0-1, yy, ix('w'));     // left wall of notch
    pset(g, BPMP_X1+1, yy, ix('w'));     // right wall of notch
  }
  // fill the gap between the counter slab and the (lowered) cabinet top
  rect(g,BACK_X0,BACKCTR_TOP+6,BACK_X1,CAB_TOP-1,7);

  // ── BUTTER PUMP [#8] — a chunky stainless dispenser sitting in the
  //    counter notch. ~14px wide × ~16px tall (compact). Composed of:
  //      - cylindrical body with vertical highlight stripe
  //      - small domed cap on top
  //      - black pump lever sticking out the side NEAR THE TOP
  //      - small spout at the bottom front pointing down
  //      - a yellow label band on the body middle
  //    Drawn LAST so it sits on top of any earlier counter pixels.
  {
    const bpcx = (BPMP_X0+BPMP_X1)>>1;       // pump center x
    const bw = 5;                            // body half-width (narrower)
    const bx0 = bpcx-bw, bx1 = bpcx+bw;
    const bTop = BACKCTR_TOP - 11;           // top of body (a bit above counter)
    const bBot = BACKCTR_TOP + NOTCH_DEPTH - 1; // body sits in the notch
    // BODY — cylindrical, with a brighter highlight stripe
    rect(g, bx0, bTop, bx1, bBot, ix('k'));            // outline / body shadow
    rect(g, bx0+1, bTop+1, bx1-1, bBot-1, ix('7'));    // mid gray
    rect(g, bpcx-1, bTop+1, bpcx, bBot-1, ix('o'));    // bright highlight stripe
    pset(g, bx0+1, bTop+1, ix('j'));                   // left edge highlight
    // DOMED CAP — small semicircle on top
    for(let dy=-2; dy<=0; dy++){
      const half = Math.round(Math.sqrt(Math.max(0, 4 - dy*dy)));
      for(let dx=-half; dx<=half; dx++){
        const col = (dy === -2) ? ix('k') : (dy === -1) ? ix('o') : ix('7');
        pset(g, bpcx+dx, bTop+dy, col);
      }
    }
    // PUMP LEVER — sticks out the RIGHT side at the TOP of the body
    pset(g, bx1+1, bTop+1, ix('k'));
    pset(g, bx1+2, bTop+1, ix('k'));
    pset(g, bx1+3, bTop+1, ix('k'));
    pset(g, bx1+3, bTop,   ix('k'));                   // small angled tip
    pset(g, bx1+3, bTop+2, ix('k'));
    // SPOUT — small protrusion below the body
    pset(g, bpcx-1, bBot+1, ix('k'));
    pset(g, bpcx,   bBot+1, ix('k'));
    pset(g, bpcx,   bBot+2, ix('e'));                  // hint of butter
    // YELLOW LABEL BAND across body middle
    const lbY = bTop+5;
    rect(g, bx0+1, lbY, bx1-1, lbY+2, ix('e'));        // yellow band
    pset(g, bx0+1, lbY, ix('f'));                      // edge shadows
    pset(g, bx1-1, lbY+2, ix('f'));
  }

  // (the nacho station that used to sit on the back counter was removed
  //  — no clear room for it given the menu/counter layout [#11])

  // ── MENU ──────────────────────────────────────────────────────────
  // Menu box: PY1 set so the bottom margin (from the bottom of the last
  // entry's text to PY1) equals the top margin (from PY0 to the top of
  // "MAIN MENU"). "MAIN MENU" is drawn at PY0+5 → top margin = 5px.
  // Last entry's text bottom is at PY0+16+2*10+6=134, so we want PY1 to
  // be 134+5=139 (one extra for the frame line).
  // Menu box — PY0 moved UP 3px so it's not exactly aligned with the
  // popper top (was reading as too matchy with the popper).
  const PX0=150,PY0=89,PX1=300,PY1=136;
  for(let s=0;s<3;s++) hline(g,PX0+s+1,PX1+s+1,PY0-1-s,ix('a'));
  rect(g,PX0,PY0,PX1,PY1,5);
  frameRect(g,PX0,PY0,PX1,PY1,ix('3'));
  frameRect(g,PX0+2,PY0+2,PX1-2,PY1-2,ix('2'));
  drawTextCentered(g,'MAIN MENU',PX0,PX1,PY0+5,1,ix('e'));
  // six even entries — three per column. HELP is #5, QUIT is #6.
  const colL=[['1','NEW GAME'],['2','LOAD GAME'],['3','SETTINGS']];
  const colR=[['4','CREDITS'],['5','HELP'],['6','QUIT']];
  for(let i=0;i<colL.length;i++){
    const yy=PY0+16+i*10;
    drawText(g,colL[i][0],PX0+9,yy,1,ix('l'));
    drawText(g,colL[i][1],PX0+19,yy,1,ix('i'));
  }
  for(let i=0;i<colR.length;i++){
    const yy=PY0+16+i*10;
    drawText(g,colR[i][0],PX0+82,yy,1,ix('l'));
    drawText(g,colR[i][1],PX0+92,yy,1,ix('i'));
  }

  // ── FRONT COUNTER — with oblique depth ────────────────────────────
  // The counter runs off-screen on BOTH sides. The oblique top face used
  // to start its rows at x=s, which left a tiny angled "end" visible on
  // the far left; now every row begins at x=0 so the counter continues
  // off-screen with no visible terminator on either side.
  for(let s=0;s<6;s++)
    hline(g,0,W-1,FRONTCTR_TOP-1-s,(s<4)?ix('u'):ix('w'));
  // Top of the counter is a TEAL stripe — a clearly-teal lip on a clearly-
  // teal shadow row, distinct from the door's exact teal so the counter
  // and the door read as separate objects.
  rect(g,0,FRONTCTR_TOP,W-1,FRONTCTR_TOP+2,ix('u'));     // bright counter teal
  rect(g,0,FRONTCTR_TOP+3,W-1,FRONTCTR_TOP+4,ix('w'));   // teal shadow row
  rect(g,0,FRONTCTR_TOP+5,W-1,FRONTCTR_BOT,ix('b'));
  for(let x=20;x<W;x+=44) vline(g,FRONTCTR_TOP+6,FRONTCTR_BOT,x,6);

  // ── CARPET — black ground, static 90s shapes (no animation) [#6] ──
  carpet(g,0,FLOOR_Y,W-1,H-1);

  // ── SODA MACHINE + REGISTER (drawn into bg; redrawn over chars) ───
  const gp=(x,y,i)=>pset(g,x,y,i);
  SCENE.sodaXY={x:18,y:FRONTCTR_TOP-32};
  SCENE.regXY ={x:252,y:FRONTCTR_TOP-30};
  SCENE.soda=sodaMachineDraw(gp,SCENE.sodaXY.x,SCENE.sodaXY.y);
  SCENE.register=cashRegisterDraw(gp,SCENE.regXY.x,SCENE.regXY.y);

  // ── CANDY CASE — two-tier to the floor, splayed-out U sides [#13] ─
  // candy case — starts right at the orange counter-lip strip and runs
  // all the way to the floor, jutting out at floor level too [#1].
  // candy case — pushed down/forward [#2]. The top of the front pane now
  // sits BELOW the orange counter-lip strip, so the whole case juts
  // FORWARD of the counter face rather than starting flush with it.
  SCENE.candyXY={x:244,y:FRONTCTR_TOP+7};      // up 1px to attach to counter [#3]
  candyCase(g,SCENE.candyXY.x,SCENE.candyXY.y,FLOOR_Y);

  // ── PROMPT + COPYRIGHT [#11] ──────────────────────────────────────
  // Both on the same dark strip at the bottom: SELECT A NUMBER centered
  // in WHITE, copyright on the right in GREY (smaller, 3x5 font).
  rect(g,0,H-13,W-1,H-1,5);
  drawTextCentered(g,'SELECT A NUMBER',0,W-1,H-10,1,ix('i'));   // white
  // copyright in the small 3x5 font, drawn directly to the grid (no
  // dependency on the canvas-context-clipped px() helper).
  const copyTxt='{ 2026 BRICKROAD';                            // '{' = ©
  const cw=smallTextWidth(copyTxt);
  let _cx = W-cw-4;
  const _cy = H-9;
  for(const ch of copyTxt){
    const glyph=FONT_SMALL[ch.toUpperCase()]||FONT_SMALL[' '];
    const gw=glyph[0].length;
    for(let r=0;r<5;r++)for(let c=0;c<gw;c++)
      if(glyph[r][c]==='1') pset(g,_cx+c,_cy+r,ix('k'));
    _cx += gw+1;
  }

  SCENE.grid=g;
  return g;
}

/* ── carpet — black base, STATIC geometric shapes (deterministic) ─────── */
function carpet(g,x0,y0,x1,y1){
  // 90s-geometric carpet: black ground, scattered confetti shapes.
  // IMPORTANT: every colour here must be a STATIC palette index. The
  // bulb-chase cycles indices 1-4, so those must NOT be used or the
  // carpet shapes will shimmer. ix('s') is a static warm yellow [#8].
  rect(g,x0,y0,x1,y1,5);
  const cols=[ix('c'),ix('g'),ix('e'),ix('x'),ix('l'),ix('s')];
  let seed=99173;                              // fixed seed → never animates
  const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
  for(let n=0;n<150;n++){
    const cx=x0+((rnd()*(x1-x0))|0), cy=y0+2+((rnd()*(y1-y0-3))|0);
    const col=cols[(rnd()*cols.length)|0], kind=(rnd()*4)|0;
    if(kind===0){ for(let r=0;r<3;r++) hline(g,cx-r,cx+r,cy+r,col); }       // triangle
    else if(kind===1){ for(let k=0;k<4;k++) pset(g,cx+k,cy+(k%2),col); }    // zigzag
    else if(kind===2){ pset(g,cx,cy,col); pset(g,cx+1,cy,col); pset(g,cx,cy+1,col); } // confetti
    else { pset(g,cx,cy-1,col); pset(g,cx-1,cy,col); pset(g,cx+1,cy,col); pset(g,cx,cy+1,col); } // diamond
  }
}

/* ── BACK ROOM scene [#6] — drawn into a rectangle. Stacked bag-in-box
   ── drink cartons on the LEFT; a staircase on the RIGHT rising up-and-to-
   ── the-left behind the boxes. `detail` true = full version (open
   ── doorway), false = simplified (the tiny door window).
   ── Generic plot P so it works for both the grid and the canvas.        */
// ── BACK ROOM [#5] — ONE fixed scene in absolute coordinates. Both the
// door window and the open doorway are just VIEWPORTS onto it: whatever
// falls inside the passed (vx0..vx1, vy0..vy1) rectangle is shown, the
// rest is clipped. Opening the door simply reveals more of the same room.
function drawBackRoom(P,vx0,vy0,vx1,vy1){
  const d=SCENE.door;
  // the full back-room region — the door's interior, in scene coords
  const RX0=d.x+2, RX1=d.x+d.w-2, RY0=d.y+2, RY1=d.floorY-3;
  const SET=(x,y,i)=>{
    if(x<vx0||x>vx1||y<vy0||y>vy1) return;
    if(x<RX0||x>RX1||y<RY0||y>RY1) return;
    P(x,y,i);
  };
  const RECT=(a,b,c,e,i)=>{ for(let yy=b;yy<=e;yy++)for(let xx=a;xx<=c;xx++) SET(xx,yy,i); };
  // warm-lit room backdrop
  RECT(RX0,RY0,RX1,RY1,ix('f'));
  // ── STAIRCASE BASE [#5] — solid mass extending FROM the floor UP to
  //    the bottom of the visible flight, so the stairs visibly come
  //    out of something rather than floating. Drawn first so the steps
  //    above sit on top of it. Behind the bag-in-boxes (drawn after).
  const stairBottomY=RY0+55;                        // bottom of the visible flight
  const baseTopY=stairBottomY+2;
  // Filled base wedge from the right wall to where the stairs reach
  RECT(RX1-30, baseTopY, RX1, RY1, ix('9'));        // dark base block
  // an angled "fascia" along the top of the base — implies the underside
  // of the staircase that supports the steps
  for(let i=0;i<30;i++){
    const fx0=RX1-30+i, fy=baseTopY-Math.floor(i*0.18);
    RECT(fx0, fy, fx0, baseTopY, ix('k'));          // sloped top edge
  }

  // ── STAIRCASE on the right — climbs UP-and-LEFT, gently. The flight
  //    has a shallow slope; the bottom of the flight rests on the base
  //    above. Steps are visible through the door window.
  const STEPW=4;
  const stepRise=4;
  for(let s=0;s<22;s++){
    const sx1=RX1-s*STEPW, sx0=sx1-STEPW-1;
    const sy=stairBottomY-s*stepRise;
    if(sy<RY0) break;
    if(sx0<RX0) break;
    RECT(sx0,sy,sx1,sy+1,ix('k'));                  // tread (thin, gentle)
    RECT(sx0,sy+2,sx0+1,sy+stepRise,ix('9'));       // riser shadow
  }
  // ── STACKED BAG-IN-BOX cartons on the LEFT — TALL stack with 3D
  //    DEPTH [#14]. Each box has an oblique top face + right side face
  //    so they read as actual cubes, not flat sprites.
  const BOXW=15, BOXH=13;
  const BD=2;                                          // box depth in px
  // Boxes stack DIRECTLY on top of one another [#3] — each box's bottom
  // sits right at the next box's top (no gap). The receded top face of
  // the box ABOVE shows naturally over the box below.
  const stackRows=7;                                   // one fewer than before [#3]
  for(let col=0;col<2;col++)for(let row=0;row<stackRows;row++){
    const bx0=RX0+2+col*(BOXW+BD+2);
    const by1=RY1-1-row*BOXH;                         // stack tightly — no gap
    const by0=by1-BOXH;
    if(by0<RY0) continue;
    // top face — receding up-and-right (lighter)
    for(let s=1;s<=BD;s++){
      for(let xx=bx0+s;xx<=bx0+BOXW+s;xx++) SET(xx,by0-s,ix('z'));
    }
    // right side face — receding up-and-right (darker)
    for(let s=1;s<=BD;s++){
      for(let yy=by0-s;yy<=by1-s;yy++) SET(bx0+BOXW+s,yy,ix('f'));
    }
    // outline along the receded edges (the "back" of the top + side)
    for(let xx=bx0+BD;xx<=bx0+BOXW+BD;xx++) SET(xx,by0-BD,ix('k'));
    for(let yy=by0-BD;yy<=by1-BD;yy++) SET(bx0+BOXW+BD,yy,ix('k'));
    // ── FRONT FACE ──
    RECT(bx0,by0,bx0+BOXW,by1,ix('z'));             // cardboard
    for(let xx=bx0;xx<=bx0+BOXW;xx++){ SET(xx,by0,ix('f')); SET(xx,by1,ix('f')); }
    for(let yy=by0;yy<=by1;yy++){ SET(bx0,yy,ix('f')); SET(bx0+BOXW,yy,ix('f')); }
    RECT(bx0+3,by0+3,bx0+BOXW-3,by0+6,ix('d'));     // label
    RECT(bx0+1,by0+(BOXH>>1),bx0+BOXW-1,by0+(BOXH>>1),ix('f'));  // seam tape
  }
}

/* ── staff door — teal solid metal; `state` = 'closed' | 'open' ──────────
   ── 'open' shows the back room through the doorway.                      */
function drawStaffDoor(g,d,state){
  const {x,y,w,floorY}=d;
  const gp=(xx,yy,i)=>pset(g,xx,yy,i);
  for(let s=0;s<3;s++) vline(g,y-s,floorY-1-s,x+w+1+s,ix('9'));   // depth
  rect(g,x-2,y-2,x+w+2,floorY-1,ix('w'));                        // frame
  if(state==='open'){
    // doorway — dark threshold framing the lit back room beyond
    rect(g,x,y,x+w,floorY-1,ix('9'));
    drawBackRoom(gp, x+3,y+5,x+w-3,floorY-7, true);
    return;
  }
  // closed slab — solid teal
  rect(g,x,y,x+w,floorY-1,ix('v'));
  frameRect(g,x,y,x+w,floorY-1,ix('w'));
  // ── WINDOW — clearly glass [#7]: thick frame, the back room behind,
  //    plus a bright diagonal shine streak.
  const wy0=d.winY0, wy1=d.winY1, wx0=d.winX0, wx1=d.winX1;
  rect(g,wx0-3,wy0-3,wx1+3,wy1+3,ix('k'));      // outer frame
  rect(g,wx0-2,wy0-2,wx1+2,wy1+2,ix('a'));      // inner frame
  drawBackRoom(gp, wx0,wy0,wx1,wy1, false);     // simplified room behind glass
  // glass shine — a bold diagonal streak across the pane
  for(let k=0;k<9;k++){
    pset(g,wx0+2+k,wy0+1+k,ix('i'));
    if(k<6) pset(g,wx0+5+k,wy0+1+k,ix('o'));
  }
  rect(g,x+w-9,y+64,x+w-6,floorY-22,ix('o'));   // push handle
}

/* ── ICEE machine — floor unit, cup recess kept, no cups ──────────────── */
function iceeUnit(g,x,topY,floorY,tint){
  // depth matches the back counter (DEPTH=4): a TOP face and a RIGHT
  // side face, both skewing up-and-right [#7].
  const t=ix(tint), w=30;
  for(let s=0;s<DEPTH;s++)                         // TOP face
    hline(g, x+s+1, x+w+s+1, topY-1-s, (s<DEPTH-1)?ix('a'):ix('k'));
  for(let s=0;s<DEPTH;s++)                         // RIGHT side face
    vline(g, topY-s, floorY-1-s, x+w+1+s, (s<DEPTH-1)?ix('9'):ix('k'));
  rect(g,x,topY,x+w,floorY-1,7);
  frameRect(g,x,topY,x+w,floorY-1,ix('j'));
  rect(g,x+3,topY+2,x+w-3,topY+5,ix('d'));
  const cx=x+(w>>1), cy=topY+19, r=12;            // smaller dome
  disc(g,cx,cy,r,5); disc(g,cx,cy,r-2,t);
  ringG(g,cx,cy,r,ix('o')); ringG(g,cx,cy,r-1,ix('o'));
  rect(g,cx-3,cy+r+1,cx+3,cy+r+6,ix('k'));
  pset(g,cx,cy+r+7,ix('k'));
  const rcy0=cy+r+9, rcy1=cy+r+23;
  rect(g,x+5,rcy0,x+w-5,rcy1,5);
  frameRect(g,x+5,rcy0,x+w-5,rcy1,ix('a'));
  for(let gx=x+7;gx<x+w-6;gx+=3) vline(g,rcy1-3,rcy1-1,gx,ix('k'));
  rect(g,x+2,floorY-4,x+w-2,floorY-1,ix('k'));
  return {cx,cy,r:r-4,tint:t};
}

/* ── popcorn popper — full floor unit; bottom = two built-in doors ────── */
function popcornPopper(g,x,topY,floorY){
  // Depth matches the back counter (DEPTH=4): a TOP face and a RIGHT
  // side face, both skewing up-and-right [#7].
  const w=66;
  for(let s=0;s<DEPTH;s++)                         // TOP face
    hline(g, x+s+1, x+w+s+1, topY-1-s, (s<DEPTH-1)?ix('a'):ix('k'));
  for(let s=0;s<DEPTH;s++)                         // RIGHT side face
    vline(g, topY-s, floorY-1-s, x+w+1+s, (s<DEPTH-1)?ix('9'):ix('k'));
  rect(g,x,topY,x+w,floorY-1,ix('j'));
  frameRect(g,x,topY,x+w,floorY-1,ix('o'));
  rect(g,x+2,topY+2,x+w-2,topY+12,ix('d'));
  for(let sx=x+10;sx<x+w-8;sx+=14) drawStar(g,sx,topY+7);
  drawTextCentered(g,'POPCORN',x,x+w,topY+5,1,ix('i'));
  const cy0=topY+14, cy1=topY+56;     // shorter chamber [#12]
  rect(g,x+4,cy0,x+w-4,cy1,5);
  frameRect(g,x+4,cy0,x+w-4,cy1,ix('o'));
  const ket={x:x+(w>>1),y:cy0+16};
  // ── KETTLE MOUNT [#2] — a bracket so the kettle clearly hangs from the
  //    top of the glass chamber. A horizontal rail across the ceiling, a
  //    vertical post down to a yoke, and the yoke cradling the kettle.
  hline(g,ket.x-14,ket.x+14,cy0+2,ix('k'));          // ceiling rail
  hline(g,ket.x-14,ket.x+14,cy0+3,ix('a'));          // rail shadow
  vline(g,cy0+3,ket.y-6,ket.x,ix('k'));              // vertical drop post
  vline(g,cy0+3,ket.y-6,ket.x+1,ix('a'));
  // yoke arms cradling the top of the kettle
  hline(g,ket.x-7,ket.x+7,ket.y-6,ix('k'));          // yoke crossbar
  vline(g,ket.y-6,ket.y-2,ket.x-7,ix('k'));          // left yoke arm
  vline(g,ket.y-6,ket.y-2,ket.x+7,ix('k'));          // right yoke arm
  rect(g,x+6,cy1+4,x+w-6,cy1+10,ix('a'));         // warming-tray slot
  // ── BUILT-IN BOTTOM DOORS — two metal doors filling the lower cabinet,
  //    inset within the popper frame so they don't overhang its edge.
  const dTop=cy1+12, dBot=floorY-3, dMid=x+(w>>1);
  rect(g,x+3,dTop,x+w-3,dBot,ix('k'));            // door recess
  // left door + right door, meeting at the centre
  frameRect(g,x+4,dTop+1,dMid-1,dBot-1,ix('j'));
  frameRect(g,dMid+1,dTop+1,x+w-4,dBot-1,ix('j'));
  // handles near the centre seam (they open in opposite directions)
  vline(g,dTop+6,dBot-6,dMid-3,ix('o'));
  vline(g,dTop+6,dBot-6,dMid+3,ix('o'));
  // The popping chamber's front opening — stored so the animation layer
  // can draw two PLEXIGLASS DOORS over it (see drawPopperGlassDoors).
  // chamberFront = {x0,y0,x1,y1} of the clear front panel area [#5].
  return {x,topY,w,floorY,cy0,cy1,kettle:ket,
          chamberFront:{x0:x+4,y0:cy0,x1:x+w-4,y1:cy1}};
}
function drawStar(g,cx,cy){
  pset(g,cx,cy-2,ix('i')); pset(g,cx,cy+2,ix('i'));
  pset(g,cx-2,cy,ix('i')); pset(g,cx+2,cy,ix('i')); pset(g,cx,cy,ix('i'));
}



/* ── soda machine — back view ─────────────────────────────────────────── */
function sodaMachineDraw(P,x,y){
  const w=82,h=32;
  const RECT=(a,b,c,d,i)=>{ for(let yy=b;yy<=d;yy++)for(let xx=a;xx<=c;xx++) P(xx,yy,i); };
  const FRAME=(a,b,c,d,i)=>{
    for(let xx=a;xx<=c;xx++){ P(xx,b,i); P(xx,d,i); }
    for(let yy=b;yy<=d;yy++){ P(a,yy,i); P(c,yy,i); }
  };
  // ── OBLIQUE 3D DEPTH — top + right-side faces ──
  const DD=4;
  for(let s=0;s<DD;s++)                            // TOP face
    for(let xx=x+s+1;xx<=x+w+s+1;xx++) P(xx,y-1-s,(s<DD-1)?ix('a'):ix('k'));
  for(let s=0;s<DD;s++)                            // RIGHT side face
    for(let yy=y-s;yy<=y+h-1-s;yy++) P(x+w+1+s,yy,(s<DD-1)?ix('9'):ix('k'));
  // ── CUP-FILL INDENT on the right side face [#5] ──
  // A small rectangular recess implying the area on the OTHER side (the
  // hidden front) where cups are placed under the nozzles. Carved into
  // the 3D right side face we're seeing.
  const indentY0=y+h-18, indentY1=y+h-6;
  const indentX0=x+w+2, indentX1=x+w+DD;
  for(let yy=indentY0;yy<=indentY1;yy++)
    for(let xx=indentX0;xx<=indentX1;xx++) P(xx,yy,ix('5'));   // dark recess
  for(let xx=indentX0;xx<=indentX1;xx++){           // top + bottom edge
    P(xx,indentY0,ix('k')); P(xx,indentY1,ix('k'));
  }
  RECT(x,y,x+w,y+h,8);
  FRAME(x,y,x+w,y+h,ix('j'));
  FRAME(x+1,y+1,x+w-1,y+h-1,ix('a'));
  // ── INDIVIDUAL NOZZLE TOWERS [#4] — each label tower is a fully
  //    self-contained module with WIDE dark seams between modules. The
  //    machine top behind has a dark recessed channel so each tower
  //    looks like a separate pull-down unit sitting in slots — not a
  //    continuous strip with color swatches.
  const labels=[ix('g'),ix('e'),ix('h'),ix('i'),ix('c'),ix('l')];
  const TOWER_W=7, STRIDE=14;                       // wider gap (7px) between towers
  const totalW=(labels.length-1)*STRIDE+TOWER_W;
  const startX=x+((w-totalW)>>1);                  // centred under the box
  // dark recessed channel BEHIND all the towers — extends taller than
  // any single tower so the gaps between towers clearly show this dark
  // recess rather than the machine's mid-gray body.
  RECT(startX-2, y+1, startX+totalW+1, y+10, 5);
  // ── per-tower cap above the channel — a tiny chunky cap on each
  //    tower's top tells the eye these are separate pull-down units.
  for(let k=0;k<labels.length;k++){
    const lx=startX+k*STRIDE;
    const cxx=lx+(TOWER_W>>1);
    // cap notch on the machine top (above the channel)
    RECT(cxx-1,y-1,cxx+1,y+0,ix('a'));              // protruding cap
    // each tower itself — its own outlined module with crisp inner border
    RECT(lx,y+2,lx+TOWER_W-1,y+9,ix('k'));          // tower body
    RECT(lx+1,y+3,lx+TOWER_W-2,y+8,labels[k]);      // bright label color
    FRAME(lx+1,y+3,lx+TOWER_W-2,y+8,ix('o'));       // crisp inner border
  }
  // ── SEPARATOR GAPS through the TOP/DEPTH face [#6] ──
  // The dark seam between two adjacent towers extends UP through the
  // machine's oblique top face. We draw the FULL gap width (not just a
  // center column), with the proper oblique offset so it lines up with
  // the front-face gap. A front-face column at x=xf maps to top-face
  // column xf+s+1 at depth row s (y - 1 - s).
  for(let k=0;k<labels.length-1;k++){
    const gapStart = startX + k*STRIDE + TOWER_W;       // first gap column
    const gapEnd   = startX + (k+1)*STRIDE - 1;         // last gap column
    for(let xf=gapStart; xf<=gapEnd; xf++){
      for(let s=0;s<DD;s++){
        P(xf + s + 1, y - 1 - s, 5);                    // dark seam
      }
    }
  }
  // ── "SODA" sign — fully STATIC.
  const txt='SODA', scale=2, tw=txt.length*(6*scale)-scale;
  const sgx0=x+((w-tw-8)>>1), sgx1=sgx0+tw+7, sgy0=y+10, sgy1=y+h-3;
  RECT(sgx0,sgy0,sgx1,sgy1,5);
  FRAME(sgx0,sgy0,sgx1,sgy1,ix('e'));
  const ty=sgy0+((sgy1-sgy0-(7*scale))>>1)+1;
  plotTextCentered(P,txt,sgx0,sgx1,ty,scale,ix('s'));
  return {x,y,w,h};
}
function cashRegisterDraw(P,x,y){
  // Two-piece register: a NARROWER display tower on top of a WIDER drawer
  // body. We're looking at the BACK of it, so no front-facing handle [#1].
  const w=38,h=30;
  const tw=26;                                  // top (tower) width — narrower
  const tx0=x+((w-tw)>>1);                      // tower centred on the body
  const ty1=y+14;                               // tower bottom row
  const RECT=(a,b,c,d,i)=>{ for(let yy=b;yy<=d;yy++)for(let xx=a;xx<=c;xx++) P(xx,yy,i); };
  const FRAME=(a,b,c,d,i)=>{
    for(let xx=a;xx<=c;xx++){ P(xx,b,i); P(xx,d,i); }
    for(let yy=b;yy<=d;yy++){ P(a,yy,i); P(c,yy,i); }
  };
  // ── OBLIQUE 3D DEPTH ── top + right-side faces. The BOTTOM body uses
  //    full depth; the TOP tower uses LESS depth so the display tower
  //    looks visibly thinner (less deep) than the drawer body [#6].
  const DD=4;                                    // full depth (body)
  const DDT=2;                                   // thinner depth (tower)
  for(let s=0;s<DD;s++)                          // top face of the BODY
    for(let xx=x+s+1;xx<=x+w+s+1;xx++) P(xx,(ty1+1)-1-s,(s<DD-1)?ix('a'):ix('k'));
  for(let s=0;s<DD;s++)                          // right side of the BODY
    for(let yy=(ty1+1)-s;yy<=y+h-1-s;yy++) P(x+w+1+s,yy,(s<DD-1)?ix('9'):ix('k'));
  // TOWER depth — SHALLOWER. Uses DDT instead of DD.
  for(let s=0;s<DDT;s++)
    for(let xx=tx0+s+1;xx<=tx0+tw+s+1;xx++) P(xx,y-1-s,(s<DDT-1)?ix('a'):ix('k'));
  for(let s=0;s<DDT;s++)
    for(let yy=y-s;yy<=ty1-s;yy++) P(tx0+tw+1+s,yy,(s<DDT-1)?ix('9'):ix('k'));
  // ── DISPLAY TOWER (narrow top section) ──
  RECT(tx0,y,tx0+tw,ty1,7);
  FRAME(tx0,y,tx0+tw,ty1,ix('j'));
  // price display
  RECT(tx0+3,y+3,tx0+tw-3,y+12,5);
  FRAME(tx0+3,y+3,tx0+tw-3,y+12,ix('o'));
  const DIG={
    '0':["111","101","101","101","111"],'1':["010","110","010","010","111"],
    '2':["111","001","111","100","111"],'3':["111","001","111","001","111"],
    '4':["101","101","111","001","001"],'5':["111","100","111","001","111"],
    '$':["011","110","011","110","010"],'.':["000","000","000","000","010"],
  };
  const price="$3.50";
  let dx=tx0+5;
  for(const ch of price){
    const gl=DIG[ch]; if(!gl){ dx+=2; continue; }
    for(let r=0;r<5;r++)for(let c=0;c<3;c++)
      if(gl[r][c]==='1') P(dx+c,y+6+r,ix('l'));
    dx += (ch==='.'?2:4);
  }
  // ── DRAWER BODY (wider bottom section) — back view, no handle ──
  RECT(x,ty1+1,x+w,y+h,7);
  FRAME(x,ty1+1,x+w,y+h,ix('j'));
  RECT(x+5,ty1+4,x+w-5,y+h-4,ix('k'));
  for(let xx=x+5;xx<=x+w-5;xx++) P(xx,ty1+7,ix('a'));
  return {x,y,w,h};
}

/* ── candy case [#13] — two tiers to the floor; sides splay OUTWARD
   ── (wider at the back, flat front), an angular U seen from above.       */
function candyCase(g,x,y,floorY){
  // A glass display case that JUTS toward the viewer. Front pane nearest
  // us; both side panes angle back to the counter; consistent jut at
  // top, sides, and bottom. Two tiers, reaching the floor. The base
  // plinth STICKS OUT past the floor line into the carpet a few pixels,
  // so the case visibly juts forward of the counter face at the
  // bottom [#1].
  const fw=54;                              // front-pane width
  const D=7;                                // jut depth — used EVERYWHERE
  const JUT_OUT=8;                          // px the case extends BELOW
                                            // floorY into the carpet, so
                                            // the angled bottom clearly
                                            // juts forward of the counter
                                            // face at floor level [#1]
  const caseBot=floorY+JUT_OUT;             // case bottom — well into carpet
  const tierH=Math.floor((caseBot-y)/2);

  // ── BOTH SIDE PANES — drawn first, full height, angling back-up at
  //    the SAME slope the top/bottom use. The back of each pane is up-
  //    and-inward by D. Thin glass: just the edges, mostly see-through.
  for(let s=0;s<=D;s++){
    // left pane edge
    vline(g,y-s,caseBot-s,x-s,(s===0||s===D)?ix('k'):ix('w'));
    // right pane edge
    vline(g,y-s,caseBot-s,x+fw+s,(s===0||s===D)?ix('k'):ix('9'));
  }

  // ── GLASS TOP — a see-through parallelogram. Complete on BOTH sides:
  //    every depth row spans the full width. Only the edges are drawn
  //    (glass), plus a shine streak; the interior stays open.
  for(let s=0;s<=D;s++){
    // front edge of the top is at s=0; it recedes up-left as s grows.
    const lx=x-s, rx=x+fw-s;
    pset(g,lx,y-s,ix('k')); pset(g,rx,y-s,ix('k'));      // side rails
    if(s===0||s===D) hline(g,lx,rx,y-s,ix('o'));         // front & back rails
  }
  for(let s=0;s<D;s++) pset(g,x+6-s,y-1-s,ix('i'));      // diagonal shine on the glass top

  // ── DARK INTERIOR FILL [#3] — the counter's orange-and-brown lip used
  //    to show through the glass. Fill the case interior with a clean
  //    dark color so nothing bleeds through.
  for(let yy=y;yy<=caseBot;yy++)
    for(let xx=x;xx<=x+fw;xx++) pset(g,xx,yy,ix('9'));

  // ── COUNTER LIP WRAP — the counter's TEAL lip (ix('u')) and teal
  //    shadow row (ix('w')) trace the OUTER TOP-FRONT contour of the
  //    case: across the front pane top edge, then back along each angled
  //    side-pane top edge. Reads as the counter's lip extending forward
  //    onto the case.
  // front edge — directly along the case's top row (y..y+1)
  hline(g, x, x+fw, y,   ix('u'));
  hline(g, x, x+fw, y+1, ix('u'));
  hline(g, x, x+fw, y+2, ix('w'));
  // angled side caps — wrap the lip back along the sides at the SAME
  // slope as the depth (one row per depth step)
  for(let s=1;s<=D;s++){
    pset(g, x-s,    y-s,   ix('u'));
    pset(g, x-s,    y-s+1, ix('u'));
    pset(g, x-s,    y-s+2, ix('w'));
    pset(g, x+fw+s, y-s,   ix('u'));
    pset(g, x+fw+s, y-s+1, ix('u'));
    pset(g, x+fw+s, y-s+2, ix('w'));
  }

  // ── two tiers ──────────────────────────────────────────────────────
  for(let tier=0;tier<2;tier++){
    const ty=y+tier*tierH;
    const tb=(tier===1)?caseBot:(ty+tierH-1);
    // ── INTERIOR LIGHT [illumination] — a soft warm wash inside each tier,
    //    so the case reads as LIT FROM WITHIN (under-shelf lights). The
    //    light pools in the middle of the tier and falls off toward the
    //    edges. Drawn over the dark interior fill.
    const cyT=(ty+tb)>>1;
    for(let yy=ty+1;yy<=tb-1;yy++){
      // brighter band centered vertically; falls off near top/bottom
      const vd=Math.abs(yy-cyT)/((tb-ty)/2);
      for(let xx=x+1;xx<=x+fw-1;xx++){
        const hd=Math.abs(xx-(x+fw/2))/(fw/2);
        const dist=Math.sqrt(vd*vd*0.4+hd*hd);
        if(dist<0.5)      pset(g,xx,yy,ix('a'));    // brightest core
        else if(dist<0.85) pset(g,xx,yy,ix('9'));    // mid wash
        // else: leave the dark interior fill alone (no light reaches)
      }
    }
    // ── MIRROR-FINISH SHELF — for BOTH tiers including the bottom.
    //    A polished slab with a reflective gradient; full depth so the
    //    RIGHT side completes. Drawn as a wedge filling left pane bottom
    //    to right pane bottom at every depth row.
    const shelfY=tb-3;                          // shelf surface row
    for(let s=0;s<=D;s++){
      // full wedge from left pane bottom (x-s) to right pane bottom (x+fw+s)
      const lx=x-s, rx=x+fw+s;
      const shade=(s<2)?ix('o'):(s<4)?ix('j'):ix('k');
      hline(g,lx,rx,shelfY-s,shade);
    }
    // a couple of bright highlight streaks along the polished front lip
    for(let k=2;k<fw-6;k+=5) pset(g,x+k,shelfY,ix('i'));
    // candy sits ON the shelf — placed a row higher so it isn't clipped
    drawCandyShelf(g,x+4,shelfY-1,fw-8,tier);
    // FRONT GLASS PANE — frame + bold diagonal shine (drawn LAST so the
    // shine sits over the interior contents).
    frameRect(g,x,ty,x+fw,tb,ix('o'));
    for(let k=0;k<12;k++){
      pset(g,x+4+k,ty+2+k,ix('i'));
      if(k<8) pset(g,x+7+k,ty+2+k,ix('o'));
    }
    for(let k=0;k<5;k++) pset(g,x+fw-12+k,ty+4+k,ix('o'));
  }
  // (the old "base plinth" wedge was removed because it drew BLACK
  //  rows over the bottom of the case interior, clipping the bottom
  //  shelf's candy and the front window frame. The case's bottom edge
  //  is the frame's bottom row at caseBot, sitting in the carpet. [#4])
}

/* ── candy on a shelf — boxes of varied size/colour so it reads as candy,
   ── not uniform blocks. `bx`,`baseY` = shelf left + bottom; `w` width.   */
function drawCandyShelf(g,bx,baseY,w,seedTier){
  // Realistic candy boxes [#9]: varied real-world shapes (tall bars,
  // wide gum packs, square chocolate boxes), spaced EVENLY across the
  // shelf width, each box has 2-3px of DEPTH (oblique top + side faces),
  // and each casts a soft mirror REFLECTION onto the polished shelf
  // surface below.
  const lib=[
    // Tall narrow bar (like a candy bar standing on end)
    {w:6,  h:14, c:'c', label:'i', stripe:'d'},
    // Wide flat pack (like gum/Tic-Tacs)
    {w:11, h:7,  c:'h', label:'o', stripe:'j'},
    // Square chocolate box
    {w:9,  h:10, c:'e', label:'i', stripe:'f'},
    // Tall stick (single stick of gum)
    {w:4,  h:13, c:'l', label:'i', stripe:'k'},
    // Medium box
    {w:8,  h:9,  c:'g', label:'i', stripe:'k'},
    // Squat brick
    {w:10, h:8,  c:'d', label:'s', stripe:'k'},
  ];
  // Pick 4 boxes for this shelf, offset by tier for variety
  const N=4;
  const picks=[];
  for(let i=0;i<N;i++) picks.push(lib[(seedTier*3+i*2)%lib.length]);
  // Compute total width with 2px gaps between
  let totalW=0;
  for(const b of picks) totalW+=b.w;
  totalW += (N-1)*2;
  // Evenly spread: start at the left side, add equal extra gap to push
  // everything together to fill w
  const extra=Math.max(0,w-totalW);
  const gap=2+Math.floor(extra/(N+1));
  let cx=bx+Math.floor(extra/(N+1));
  const D=2;                                      // box depth (oblique)
  for(const b of picks){
    const bw=b.w, bh=b.h;
    const by1=baseY, by0=baseY-bh;
    // ── DEPTH first (drawn behind the front face) ──
    // top face — receding up-and-right
    for(let s=1;s<=D;s++){
      for(let xx=cx+s;xx<=cx+bw+s;xx++) pset(g,xx,by0-s,ix(b.stripe));
    }
    // right side face — receding up-and-right
    for(let s=1;s<=D;s++){
      for(let yy=by0-s;yy<=by1-s;yy++) pset(g,cx+bw+s,yy,ix(b.stripe));
    }
    // ── FRONT FACE ──
    rect(g,cx,by0,cx+bw,by1,ix(b.c));         // box body
    frameRect(g,cx,by0,cx+bw,by1,ix('k'));    // dark edge
    // label band across the middle
    hline(g,cx+1,cx+bw-1,by0+Math.floor(bh/2)-1,ix(b.label));
    hline(g,cx+1,cx+bw-1,by0+Math.floor(bh/2),  ix(b.label));
    // a couple of brand pips on the label
    pset(g,cx+2,by0+Math.floor(bh/2),ix(b.c));
    pset(g,cx+bw-2,by0+Math.floor(bh/2),ix(b.c));
    // ── MIRROR REFLECTION on the shelf below — 2 rows of dim color
    //    immediately below the box, fading toward the back. Reads as
    //    the polished shelf reflecting the box base.
    for(let xx=cx+1;xx<cx+bw;xx++){
      pset(g,xx,by1+1,ix(b.stripe));          // first reflected row
      if((xx+by1)%2===0) pset(g,xx,by1+2,ix('k'));  // dimmer trailing row
    }
    cx+=bw+gap;
  }
}

/* ── rope barrier — built by the ROPE LAYER, not the background ───────── */
function drawRopeLayer(){
  // velvet rope strung between round-based poles, drawn straight to canvas
  // so it can sit at its own depth (in front of the counter). Pushed
  // FORWARD a few px [#1] so sweepers have room to walk on the carpet
  // between the rope and the candy case without hovering over the case.
  const ropeY=SCENE.floorY+24;
  const poleXs=[44,120,196,272,344];
  const POLE_TOP=44;                 // post height — slightly taller [#6]
  for(const pxc of poleXs){
    // round base — WIDER (radius 7 instead of 5) [#9]
    // Base — middle ground between perfect disc and very squashed
    // ellipse [#6]: 8×3 oblique ellipse so it has visible mass while
    // still reading as viewed slightly from above.
    for(let dy=-3;dy<=3;dy++)
      for(let dx=-8;dx<=8;dx++){
        // ellipse test: (x/8)^2 + (y/3)^2 <= 1
        const nx=dx/8, ny=dy/3;
        if(nx*nx+ny*ny<=1) px(pxc+dx,ropeY+dy-1,ix('k'));
      }
    // inner highlight ellipse — one row narrower for a top-light look
    for(let dy=-2;dy<=2;dy++)
      for(let dx=-6;dx<=6;dx++){
        const nx=dx/6, ny=dy/2;
        if(nx*nx+ny*ny<=1) px(pxc+dx,ropeY-2+dy,ix('j'));
      }
    // post — centered on the base.
    for(let yy=ropeY-POLE_TOP;yy<=ropeY-3;yy++){
      px(pxc-1,yy,ix('j'));
      px(pxc,  yy,ix('o'));
    }
    // ring drawn FIRST so the ball finial drawn after overlaps the
    // ring's upper portion — the ball's bottom curve cuts into the ring's
    // top, reading like the ring is HUNG from the pole behind the ball [#5].
    ringPx(pxc,ropeY-POLE_TOP+1,3,ix('e'));                       // rope hook
    discPx(pxc,ropeY-POLE_TOP-2,3,ix('o'));                       // ball finial
  }
  for(let s=0;s<poleXs.length-1;s++){
    const x0=poleXs[s], x1=poleXs[s+1];
    for(let x=x0+3;x<=x1-3;x++){
      const tt=(x-x0)/(x1-x0);
      const sag=Math.round(9*Math.sin(tt*Math.PI));
      for(let t=0;t<3;t++)
        px(x,ropeY-POLE_TOP+1+sag+t,t===1?ix('c'):ix('d'));       // rope hangs from the ring
    }
  }
}

/* plot a string in the main font via a generic plot function */
function plotTextCentered(P,text,x0,x1,y0,scale,colorIdx){
  const w=text.length*(6*scale)-scale;
  let x=Math.round(x0+((x1-x0)-w)/2);
  for(const ch of text){
    const glyph=FONT[ch.toUpperCase()]||FONT[' '];
    for(let r=0;r<7;r++)for(let c=0;c<5;c++){
      if(glyph[r][c]==='1')
        for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++)
          P(x+c*scale+dx,y0+r*scale+dy,colorIdx);
    }
    x+=(5*scale)+scale;
  }
}

/* ════════════════════════════════════════════════════════════════════════
   4. THE UNIFIED CHARACTER SPRITE
   ────────────────────────────────────────────────────────────────────────
   ONE sprite system for both concessionists and sweepers. A character is a
   randomised person in concession uniform (white shirt, BLACK BOWTIE,
   burgundy vest, slacks). A sweeper is the exact same sprite that also
   carries a broom + dustpan and does a sweep animation.

   Poses: 'front' (standing) and 'side' (walking, faces dir).
   Coordinates: feet at (fx,fy). Rows >= clipY are not drawn.
   ════════════════════════════════════════════════════════════════════════ */
const SKIN = ['m','z','n'];
const HAIR = ['n','5','k','d'];
function makeCharacter(){
  const femme=Math.random()<0.5;
  // hair STYLE — most people have short/medium hair; some have genuinely
  // long hair framing the face; a few have an actual small ponytail.
  const roll=Math.random();
  let hairStyle;
  if(femme){
    hairStyle = roll<0.50 ? 'long' : roll<0.78 ? 'medium'
              : roll<0.92 ? 'ponytail' : 'short';
  } else {
    hairStyle = roll<0.62 ? 'short' : roll<0.85 ? 'medium'
              : roll<0.94 ? 'long' : 'ponytail';
  }
  // BUILD — body variety. 'slim' = narrower torso, 'stocky' = wider torso,
  // 'average' = the existing default. This is applied as a width offset
  // to the torso half-width and the shoulder span in the sprite functions.
  const bRoll=Math.random();
  const build = bRoll<0.30?'slim': bRoll<0.75?'average':'stocky';
  return {
    skin: SKIN[(Math.random()*SKIN.length)|0],
    hair: HAIR[(Math.random()*HAIR.length)|0],
    femme,
    hairStyle,
    build,
    tall: Math.random()<0.5,
    beard: (!femme)&&Math.random()<0.4,
    moustache: (!femme)&&Math.random()<0.35,
    eye: ['5','n','x'][(Math.random()*3)|0],
    broomColor: (Math.random()<0.5)?'c':'h',     // red or blue corn broom
  };
}

// ── BOWTIE [#3] — two triangles meeting at a centre knot, drawn at (cx,y).
// Works for both poses; `prof` true = profile (slightly narrower).
function drawBowtie(cx,y,prof){
  // A clean little bowtie at the collar — triangle wing on each side of
  // a centered knot. The wings stay COMPACT and only extend at the
  // bowtie row, not above/below — earlier versions had wings extending
  // up past the knot into the neck which read as "hair off the neck".
  const TIE=5, KNOT=ix('k');
  const wing=prof?2:3;
  // wings — triangular, narrow at the knot, widening outward at the tie row
  for(let r=-1;r<=1;r++){
    const ext=wing-Math.abs(r);
    for(let e=1;e<=ext;e++){
      px(cx-1-e,y+r,TIE);                        // left wing
      px(cx+1+e,y+r,TIE);                        // right wing
    }
  }
  // centre knot — 3 rows tall
  for(let r=-1;r<=1;r++){ px(cx,y+r,KNOT); px(cx-1,y+r,TIE); px(cx+1,y+r,TIE); }
}

// ════════════════════════════════════════════════════════════════════════
// REDESIGNED CHARACTER SPRITE — better proportions + hand anchors.
// ────────────────────────────────────────────────────────────────────────
// The figure has a real silhouette: a rounded head on a neck, sloped
// shoulders, a torso that tapers to a waist, then legs. Simple retro
// shading (one shade step on the vest + skin).
//
// Each draw function returns ANCHOR POINTS so props attach precisely:
//   { headX, headTopY, handFrontX/Y, handBackX/Y }
// The sweeper props use handFront / handBack so the broom + dustpan are
// genuinely held, not floating.
//
// CHARACTER_H is the figure height (head-top to feet) for the standard
// build; tall adds a few px. The torso/leg row counts derive from it.
// ════════════════════════════════════════════════════════════════════════

// FRONT standing sprite. feet at (fx,fy). Rows >= clipY are not drawn.
function drawCharacterFront(npc,fx,fy,bob,clipY){
  const skin=ix(npc.skin), skinSh=ix('z'), hair=ix(npc.hair), eye=ix(npc.eye);
  const SHIRT=ix('i'), SHIRTSH=ix('j'), TIE=5;
  const VEST=ix('p'), VESTS=ix('q');
  // SLACKS + SHOES use dark gray instead of pure black, so the legs and
  // feet are visible against the (mostly black) carpet. SLACKSH is darker
  // for shading. Old code used 5 (near-black) which made the lower body
  // disappear into the carpet — that's why sweepers' feet looked like
  // they were floating: the shoes were drawn, but invisible.
  const SLACK=ix('7'), SLACKSH=ix('9'), SHOE=ix('6');
  const beardCol=(npc.skin==='n')?ix('k'):hair;
  const tall=npc.tall?6:0;
  const style=npc.hairStyle||'short';
  const longSides=(style==='long');              // hair frames the face
  const ponytail=(style==='ponytail');
  const medium=(style==='medium');
  let y=fy-(94+tall)+bob;                        // top of the head — taller
                                                 // figure, matches side pose
  const put=(x,ci)=>{ if(y<clipY) px(fx+x,y,ci); };
  const span=(x0,x1,ci)=>{ for(let i=x0;i<=x1;i++) put(i,ci); };
  const next=()=>{ y++; };
  const headTopY=y;

  // ── HEAD — bigger & rounder, better proportioned to the body [#1].
  //    ~12px wide, 13 rows tall. Hair style varies per character [#7].
  span(-4,3,hair); next();                       // crown
  span(-5,4,hair); next();
  span(-6,5,hair); next();
  span(-6,5,hair); next();
  // forehead — hair frames the temples; long hair drapes down the sides
  span(-5,4,skin); put(-6,hair); put(5,hair); next();
  span(-5,4,skin); put(-6,hair); put(5,hair);
  if(longSides){ put(-7,hair); put(6,hair); } next();
  // brow
  span(-5,4,skin); put(-4,skinSh); put(-3,skinSh); put(2,skinSh); put(3,skinSh);
  put(-6,hair); put(5,hair); if(longSides){ put(-7,hair); put(6,hair); } next();
  // eyes
  span(-5,4,skin);
  put(-4,ix('i')); put(-3,eye); put(-2,ix('i'));
  put(1,ix('i'));  put(2,eye);  put(3,ix('i'));
  put(-6,hair); put(5,hair); if(longSides){ put(-7,hair); put(6,hair); } next();
  // upper cheek
  span(-5,4,skin);
  if(longSides){ put(-6,hair); put(5,hair); put(-7,hair); put(6,hair); }
  else if(medium){ put(-6,hair); put(5,hair); }
  next();
  // nose
  span(-5,4,skin); put(0,skinSh); put(-1,skinSh);
  if(longSides){ put(-6,hair); put(5,hair); put(-7,hair); put(6,hair); } next();
  // mouth / moustache
  span(-5,4,skin);
  if(npc.moustache){ put(-2,beardCol);put(-1,beardCol);put(0,beardCol);put(1,beardCol); }
  else { put(-1,ix('d')); put(0,ix('d')); }
  if(longSides){ put(-6,hair); put(5,hair); } next();
  // ── JAW / BEARD ──
  // [#beard] At chunky pixel scale, the most readable way to show a
  // beard is a SILHOUETTE CHANGE: the head's outline is visibly BULKIER
  // at the jaw — the bearded chin sticks out past where a clean-shaven
  // jaw would be, in beard color. Internal stippling reads as patchy at
  // this resolution, so we just widen the jaw silhouette and add an
  // extra row below the chin.
  if(npc.beard){
    // jaw row 1 — beard sticks out 1px wider than a clean jaw (-5..4)
    span(-5,4,beardCol);
    next();
    // jaw row 2 — narrower than row 1, tapering toward chin point
    span(-4,3,beardCol);
    next();
    // chin tuft — an extra row poking down below where a clean chin
    // would end. This is the silhouette change that reads as "beard".
    span(-3,2,beardCol);
    next();
  }
  else {
    span(-4,3,skin); next();
    span(-3,2,skin); next();
  }
  // ── NECK ──────────────────────────────────────────────────────────
  span(-2,1,skin); next();
  // ── PONYTAIL — a small bound tail behind the head, only for the
  //    'ponytail' style, so it's clearly an intentional minority [#7].
  if(ponytail){
    for(let r=0;r<7;r++) px(fx+6,headTopY+5+r,hair);
    px(fx+5,headTopY+8,hair); px(fx+7,headTopY+9,hair);
    px(fx+6,headTopY+5,ix('e'));                 // a little hair-tie
  }
  // ── LONG HAIR DRAPE — for characters with 'long' hair style, the hair
  //    actually extends past the head/neck onto the shoulders. Drawn here
  // ── LONG HAIR DRAPE — for 'long' style, the hair extends past the head
  //    onto the shoulders. It is NOT drawn here (in the narrow collar gap,
  //    where it used to float as two disconnected lines sticking out of the
  //    neck); instead it's drawn AFTER the torso below, following the body
  //    edge so it rests ON the shoulders/upper chest. See "LONG HAIR DRAPE
  //    (attached)" further down.
  // ── SHOULDERS — width depends on BUILD (slim/average/stocky) and on
  //    whether the character is femme (narrower shoulders). ────────────
  const buildDW = (npc.build==='slim')?-1 : (npc.build==='stocky')?+1 : 0;
  const femmeDW = npc.femme ? -1 : 0;             // femme = narrower shoulders
  const SHOULDER = 8 + buildDW + femmeDW;         // shoulder half-width
  const WAIST_BASE = 6 + buildDW;                 // base waist half-width
  // femme has a slightly NIPPED waist (1px less); masc has straight taper.
  const WAIST = WAIST_BASE - (npc.femme?1:0);
  // HIPS — for femme, hips are slightly wider than the waist (subtle).
  const HIPS = WAIST + (npc.femme?1:0);

  span(-SHOULDER,SHOULDER-1,VEST); put(-1,SHIRT); put(0,SHIRT);
  put(-SHOULDER,SHIRTSH); put(SHOULDER-1,SHIRTSH); next();
  // ── COLLAR rows [#2 fix] — the bowtie/collar used to be a 3-row GAP (y+=3)
  //    with the SIDES left empty, so the single burgundy shoulder row floated
  //    above the torso as two red "wings" sticking out of the neck. Instead we
  //    DRAW those 3 rows as full-width vest (shoulders stay CONNECTED down into
  //    the torso), with the white shirt placket + bowtie on top in the center.
  const bowtieY = y;
  for(let cr=0;cr<3;cr++){
    span(-SHOULDER,SHOULDER-1,VEST);
    put(-SHOULDER,SHIRTSH); put(SHOULDER-1,SHIRTSH);   // shaded outer edge
    put(-1,SHIRT); put(0,SHIRT);                       // white collar strip
    next();
  }
  if(bowtieY<clipY) drawBowtie(fx,bowtieY,false);       // bowtie on the collar
  const shoulderY=y;
  // ── TORSO — tapers from shoulders to waist; femme also pinches in,
  //    masc keeps a straighter taper. Build widens/narrows the whole trunk.
  const torso=22+tall;
  let waistHalf=WAIST;
  for(let r=0;r<torso;r++){
    const t=r/torso;
    // linear taper from SHOULDER to WAIST
    const SH=Math.round(SHOULDER - (SHOULDER-WAIST)*t);
    waistHalf=SH;
    span(-SH,SH-1,VEST);
    put(-SH+1,VESTS); put(SH-2,VESTS);
    const half=Math.max(1,3-Math.floor(r/8));    // white shirt placket
    for(let i=-half;i<=half;i++) if(r<torso-2) put(i,SHIRT);
    if(r%7===3) put(0,ix('k'));                  // a button
    // ── FEMME BUST [#7] — a subtle two-row shadow curve under each
    //    breast, drawn over the vest. Sits at upper-chest height; gives a
    //    hint of bust without exaggeration.
    if(npc.femme){
      if(r===5){
        put(-4,VESTS); put(-3,VESTS);
        put(2,VESTS); put(3,VESTS);
      }
      if(r===6){
        put(-3,VESTS);
        put(2,VESTS);
      }
    }
    next();
  }
  // ── LONG HAIR DRAPE (attached) — [#1 fix] hair for the 'long' style,
  //    drawn AFTER the torso so it follows the body's outer edge and rests
  //    on the shoulders/upper chest. This replaces the old version that drew
  //    two fixed side-columns up in the narrow collar gap, which floated as
  //    disconnected gray lines "sticking out of the neck". HOW TO MODIFY:
  //    drapeLen sets how far down it falls; the px() pairs hug the 2 outer
  //    pixels of each side at the torso's taper so the hair always connects.
  if(longSides){
    const drapeLen = npc.femme ? 11 : 6;
    const hairSh = ix(npc.hair);
    for(let r=0;r<drapeLen;r++){
      const ay = shoulderY + r;
      if(ay>=clipY) break;
      // mirror the torso taper so the hair sits exactly on the body edge
      const t = r/torso;
      const SH = Math.round(SHOULDER - (SHOULDER-WAIST)*Math.min(1,t));
      px(fx-SH,   ay, hair);  px(fx-SH+1, ay, hairSh);   // left fall + inner shadow
      px(fx+SH-1, ay, hair);  px(fx+SH-2, ay, hairSh);   // right fall + inner shadow
    }
  }
  // ── BELT ──────────────────────────────────────────────────────────
  span(-waistHalf,waistHalf-1,TIE); next();
  // ── HIPS strip — femme has slightly wider hips than waist; for masc
  //    this row just matches the waist (no flare).
  if(HIPS>WAIST){
    span(-HIPS,HIPS-1,TIE); next();
  }
  // ── LEGS ──────────────────────────────────────────────────────────
  const legW = (npc.build==='stocky')?+1 : (npc.build==='slim')?-1 : 0;
  const legs=20+tall;
  for(let r=0;r<legs;r++){
    span(-6-legW,-2,SLACK); span(1,5+legW,SLACK);
    put(-6-legW,SLACKSH); put(5+legW,SLACKSH);
    next();
  }
  span(-7-legW,-2,SHOE); span(1,6+legW,SHOE);
  // ── ARMS — hang against the body, tracking the torso's taper so there
  //    is no gap. White shirt-sleeve; vest is sleeveless. Hands at hips.
  const armLen=22+tall;
  for(let r=0;r<armLen;r++){
    const ay=shoulderY+r;
    if(ay>=clipY) break;
    const t=r/armLen;
    // body half-width at this row (matches the torso taper)
    const bodyHalf=Math.round(SHOULDER - (SHOULDER-WAIST)*Math.min(1,t*(torso/armLen)));
    const ax=bodyHalf+1;
    if(r<armLen-2){
      px(fx-ax-1,ay,SHIRT); px(fx-ax,ay,SHIRT);
      px(fx+ax,ay,SHIRT);   px(fx+ax+1,ay,SHIRT);
      px(fx-ax-1,ay,SHIRTSH); px(fx+ax+1,ay,SHIRTSH);   // outer shade
    } else {
      // hands — skin tone at the very ends
      px(fx-ax-1,ay,skin); px(fx-ax,ay,skin);
      px(fx+ax,ay,skin);   px(fx+ax+1,ay,skin);
    }
  }
  const handY=shoulderY+armLen-1;
  const handAx=WAIST+1;                            // hands at the waist edge
  return { headX:fx, headTopY,
           shoulderY, shoulderHalfWidth: SHOULDER,
           handFrontX:fx+handAx, handFrontY:Math.min(handY,clipY-1),
           handBackX:fx-handAx,  handBackY:Math.min(handY,clipY-1) };
}

// SIDE walking sprite. dir +1 faces right, -1 left. step 0..3.
function drawCharacterSide(npc,fx,fy,dir,step,clipY,headXShift){
  const skin=ix(npc.skin), skinSh=ix('z'), hair=ix(npc.hair), eye=ix(npc.eye);
  const SHIRT=ix('i'), TIE=5, VEST=ix('p'), VESTS=ix('q');
  // SLACKS + SHOES use dark gray (not pure black) so the lower body
  // reads against the dark carpet (see drawCharacterFront for the bug
  // history — feet were "floating" because they were invisible).
  const SLACK=ix('7'), SHOE=ix('6');
  const beardCol=(npc.skin==='n')?ix('k'):hair;
  const tall=npc.tall?6:0;
  const style=npc.hairStyle||'short';
  const longSides=(style==='long');
  const ponytail=(style==='ponytail');
  // ── headXShift [#11] — when set (e.g. during a sigh), the HEAD ROWS
  //    are drawn at fx+headXShift while the body stays at fx. The shift
  //    affects only the head portion via the `effectiveFx` variable
  //    below, which is reset to fx once the head is drawn.
  let effectiveFx = fx + (headXShift||0);
  const put=(x,yy,ci)=>{ const xx=dir>0?x:-x; if(yy<clipY) px(effectiveFx+xx,yy,ci); };
  const span=(x0,x1,yy,ci)=>{ for(let i=x0;i<=x1;i++) put(i,yy,ci); };
  let y=fy-(94+tall);                            // taller figure; bigger head [#2]
  const headTopY=y;
  const bob=(step===1||step===3)?1:0; y+=bob;
  // ── HEAD profile — BIGGER (≈13 rows). Face toward +x. The hair is a
  //    CLEAN shape: a solid back-of-head cap plus a short fringe; the
  //    EAR is drawn as a clear 2-row nub on the side of the head; the
  //    JAW/BEARD follows the actual jawline shape (narrower at the
  //    chin), not a flat horizontal bar [#4].
  // crown — hair across the top, slightly domed
  span(-5,4,y,hair); y++;                        // crown
  span(-6,5,y,hair); y++;
  span(-6,6,y,hair); y++;
  // fringe row — hair dips a little over the forehead at the front
  span(-6,2,y,hair); span(3,5,y,skin); y++;
  // forehead — skin face, hair caps the back of the head
  span(-4,5,y,skin); put(-5,y,hair); put(-6,y,hair); y++;
  // brow + nose bridge
  span(-4,5,y,skin); put(6,y,skin); put(-5,y,hair); put(-6,y,hair); y++;
  // EYE row — only the eye dots; nothing in the back/cheek area
  span(-4,6,y,skin); put(1,y,ix('i')); put(2,y,eye); put(6,y,skin);
  put(-5,y,hair); put(-6,y,hair); y++;
  // EAR — a clear 2-row vertical nub at the back-side of the head, in
  // skin color. Sits BEHIND the eye/cheek line, just inside the hair.
  span(-4,6,y,skin); put(-4,y,skin); put(-5,y,skinSh);  // ear top + shading
  y++;
  span(-4,5,y,skin); put(-4,y,skin); put(-5,y,skinSh);  // ear bottom + shading
  // moustache rests on the upper lip
  if(npc.moustache){ put(1,y,beardCol); put(2,y,beardCol); put(3,y,beardCol); }
  y++;
  // mouth
  span(-4,5,y,skin); put(2,y,ix('d')); y++;
  // ── JAW / BEARD profile ──
  // [#beard] Silhouette change at chunky pixel scale: the bearded jaw
  // sticks OUT past the clean-shaven jawline. Specifically, the front
  // of the chin pokes forward (to the right since face is +x) by 1px,
  // and an extra row of beard hangs below where a clean chin would end.
  if(npc.beard){
    // upper jaw — extends slightly back AND a bit forward of clean jaw
    span(-4,5,y,beardCol);
    y++;
    // lower jaw — slightly narrower at the back, still poking forward
    span(-3,5,y,beardCol);
    y++;
    // chin tuft — extra row below, only at the chin point area
    span(-2,4,y,beardCol);
    y++;
  }
  else {
    // clean jawline in skin color, tapering to chin point
    span(-3,4,y,skin); y++;
    span(-2,3,y,skin); y++;
  }
  // ── HAIR LENGTH at the back of the head ──
  // 'long' hair drapes a couple of rows down the back of the neck;
  // 'ponytail' is a bound tail off the back. 'short'/'medium' add nothing.
  if(longSides){ put(-5,y,hair); put(-6,y,hair); put(-5,y+1,hair); }
  if(ponytail){
    for(let r=0;r<9;r++) put(-7,headTopY+6+r,hair);
    put(-8,headTopY+9,hair); put(-6,headTopY+12,hair);
    put(-7,headTopY+6,ix('e'));                  // hair-tie
  }
  // ── NECK — a genuine neck: 3 rows tall, narrower than the head, set
  //    slightly back from the face so it clearly reads as a neck. The
  //    neck shifts with the head (via effectiveFx) so a turning head
  //    doesn't separate from the neck.
  span(-2,2,y,skin); put(-2,y,skinSh); y++;
  span(-2,2,y,skin); put(-2,y,skinSh); y++;
  span(-2,2,y,skin); put(-2,y,skinSh); y++;
  // shoulders onward use the fixed body x (no more head-shift) [#11]
  effectiveFx = fx;
  drawBowtie(fx+(dir>0?1:-1),y,true);
  const shoulderY=y; y++;
  // ── TORSO profile — build + femme proportions ─────────────────────
  // 'slim'/'stocky' make the torso shallower/deeper front-to-back, and
  // femme has a slightly pinched waist mid-torso.
  const buildDS = (npc.build==='slim')?-1 : (npc.build==='stocky')?+1 : 0;
  const torso=22+tall;
  for(let r=0;r<torso;r++){
    const t=r/torso;
    // base front-back depth tapering chest→hip
    let back=-4+1*t, front=4-1*t;
    // build offset (deeper or shallower torso)
    back-=buildDS; front+=buildDS;
    // femme: a small pinch at the waist (mid-torso)
    if(npc.femme && Math.abs(t-0.55)<0.18){ back+=0.5; front-=0.5; }
    // femme BUST [#7] — a 1-2px forward bump at chest level on the side
    // profile. Sits at the upper torso (rows 3-6), gentle, not exaggerated.
    if(npc.femme && r>=3 && r<=6){
      front+=1;                                  // chest pushes forward 1px
    }
    back=Math.round(back); front=Math.round(front);
    span(back,front,y,VEST);
    put(back,y,VESTS);
    if(r<torso-3) put(front,y,SHIRT);
    y++;
  }
  span(-3,3,y,TIE); y++;                         // belt
  // ── LEGS profile — 3px thick [#11] ────────────────────────────────
  const legs=20+tall;
  const swing=[[3,-3],[1,-1],[-3,3],[-1,1]][step];
  for(let r=0;r<legs;r++){
    const prog=r/legs;
    const fX=Math.round(swing[0]*prog), bX=Math.round(swing[1]*prog);
    put(fX+1,y,SLACK); put(fX+2,y,SLACK); put(fX+3,y,SLACK);   // front leg
    put(bX-1,y,SLACK); put(bX-2,y,SLACK); put(bX-3,y,SLACK);   // back leg
    y++;
  }
  span(swing[0]+0,swing[0]+5,y,SHOE);
  span(swing[1]-5,swing[1]-0,y,SHOE);
  // ── ARMS — 2-segment swinging arm. Elbow position moved UP — upper
  //    arm is shorter (8 rows) and forearm is longer (11 rows) so the
  //    elbow sits at ~42% down the arm, closer to real proportions.
  //    Previous (11 + 8) placed the elbow too low [#elbow].
  const swingF=[1,0,-1,0][step];
  const swingB=-swingF;
  function drawArm(rootX,phase,sleeveCol){
    let ax=rootX, ay=shoulderY+2;
    // upper arm — 8 rows, 3px thick
    const UPPER=8;
    for(let r=0;r<UPPER;r++){
      const off=Math.round(phase*r*0.34);
      put(ax+off,ay,sleeveCol); put(ax+off+1,ay,sleeveCol); put(ax+off+2,ay,sleeveCol);
      ay++;
    }
    let ex=ax+Math.round(phase*UPPER*0.34);
    // forearm — 11 rows, 3px thick
    const FORE=11;
    for(let r=0;r<FORE;r++){
      const off=Math.round((0.5+phase*0.3)*r*0.45);
      put(ex+off,ay,sleeveCol); put(ex+off+1,ay,sleeveCol); put(ex+off+2,ay,sleeveCol);
      ay++;
    }
    const hx=ex+Math.round((0.5+phase*0.3)*FORE*0.45);
    put(hx,ay,skin); put(hx+1,ay,skin); put(hx+2,ay,skin);     // hand
    return { x:fx+(dir>0?1:-1)*(hx+1), y:ay };
  }
  const handBack =drawArm(-4,swingB,ix('q'));
  const handFront=drawArm( 3,swingF,SHIRT);
  return { headX:fx, headTopY,
           handFrontX:handFront.x, handFrontY:handFront.y,
           handBackX:handBack.x,   handBackY:handBack.y };
}

// FRONT-facing sweeping pose — the sweeper faces the viewer while sweeping.
// Returns hand anchors. The arms emerge from the ACTUAL shoulder points
// (returned by drawCharacterFront) and bend forward and down toward the
// floor, where the props are worked in front of the figure [#6].
function drawCharacterSweepFront(npc,fx,fy,bob,sweepPhase){
  // ── SWEEP POSE — face-front pose with arms reaching down to grip the
  //    props at WAIST level (not below the feet). The broom hand sways
  //    left and right with `sweepPhase`; the dustpan hand HOLDS STILL.
  //    Arms are 2-segment (shoulder→elbow→hand), 2px thick, ending at
  //    the natural waist height of the figure.
  const a=drawCharacterFront(npc,fx,fy,bob,9999);
  const skin=ix(npc.skin), SHIRT=ix('i');
  const shY=a.shoulderY;
  const SH=a.shoulderHalfWidth;
  // Hand y target — at the WAIST level of the figure (a sane arm length
  // down from the shoulders, NOT past the feet).
  const handY = shY + 18;
  // BROOM hand swings; DUSTPAN hand is STATIONARY.
  const broomSwing = Math.round(1*Math.sin(sweepPhase*0.4));
  function bendArm(shoulderX, handX, col){
    // 2-segment arm: shoulder → elbow at midpoint → hand. 2px thick.
    const elbowX = Math.round((shoulderX + handX) / 2);
    const elbowY = Math.round((shY + handY) / 2);
    // upper arm
    let steps = Math.max(1, Math.round(Math.hypot(elbowX-shoulderX, elbowY-shY)));
    for(let s=0;s<=steps;s++){
      const t=s/steps;
      const xp=Math.round(shoulderX+(elbowX-shoulderX)*t);
      const yp=Math.round(shY+(elbowY-shY)*t);
      px(xp,yp,col); px(xp+1,yp,col);
    }
    // forearm
    steps = Math.max(1, Math.round(Math.hypot(handX-elbowX, handY-elbowY)));
    for(let s=0;s<=steps;s++){
      const t=s/steps;
      const xp=Math.round(elbowX+(handX-elbowX)*t);
      const yp=Math.round(elbowY+(handY-elbowY)*t);
      px(xp,yp,col); px(xp+1,yp,col);
    }
    // hand pixel
    px(handX,handY,skin); px(handX+1,handY,skin);
    return {x:handX,y:handY};
  }
  // BROOM hand — right side; SWAYS with broomSwing
  const handBroom = bendArm(fx + SH - 1, fx + SH + 1 + broomSwing, SHIRT);
  // DUSTPAN hand — left side; STATIONARY (no swing applied)
  const handPan   = bendArm(fx - SH + 1, fx - SH - 1,              SHIRT);
  return { headX:fx, headTopY:a.headTopY,
           handFrontX:handBroom.x, handFrontY:handBroom.y,
           handBackX:handPan.x,    handBackY:handPan.y };
}

// ── SWEEPER PROPS — corn broom + long-handled dustpan.
// WHILE WALKING: both props are held at an angle at the sweeper's sides.
// WHILE SWEEPING: the dustpan is planted on the floor and the broom
// strokes, sweeping a couple of kernels across the floor into the pan.
// `anchors` = hand positions; `kernels`/`swept` drive the sweep [#1,#2,#3].
function drawSweeperProps(npc,fx,fy,facing,anchors,sweeping,sweepPhase,kernels,swept){
  // Draws the sweeper's two tools, attached to the character's hand
  // anchors. The BROOM is held in the front hand, the DUSTPAN in the back
  // hand. Behaviour differs between walking and sweeping:
  //   • WALKING  — both carried at an angle at the sides, gripped in the
  //                MIDDLE of the handle (handle sticks up past the hand),
  //                tools held clear of the floor.
  //   • SWEEPING — both reach down to just below / in front of the feet
  //                (NOT disproportionately long); the broom strokes and
  //                kernels travel into the planted dustpan.
  const handleCol=ix(npc.broomColor);     // red or blue broom handle
  const BRISTLE=ix('s');                   // light-yellow corn bristles
  const BRISTLESH=ix('r');                 // bristle shadow strand
  const BAND=ix('e');                      // binding band
  const PAN=ix('j'), PANEDGE=ix('a'), PANSH=ix('k');
  const D=(facing>=0)?1:-1;                // facing direction (+1 right)
  const floorY=fy-1;                       // the floor the feet stand on

  // ── CORN-BROOM HEAD — a flared, flat-bottomed bristle bundle. It flares
  //    along (dirX,dirY): the bristles run in the SAME direction as the
  //    handle, so a tilted broom has tilted bristles [#10]. (cx,cy) is the
  //    collar (top of the head); the head extends `len` px along the dir.
  function broomHead(cx,cy,dirX,dirY,len){
    // normalise the direction
    const mag=Math.hypot(dirX,dirY)||1;
    const ux=dirX/mag, uy=dirY/mag;
    // perpendicular, for the flare width
    const px2=-uy, py2=ux;
    // binding collar across the top of the head
    for(let e=-2;e<=2;e++) px(Math.round(cx+px2*e),Math.round(cy+py2*e),BAND);
    // bristle strands running along the handle direction.
    // Flare from 3 to 5 wide (7-11 px total) — chunky head that reads
    // as a real broom at this pixel scale.
    for(let r=0;r<len;r++){
      const half=3+Math.round(2*(r/(len-1)));      // flares from 3 to 5
      const sx=cx+ux*r, sy=cy+uy*r;
      for(let e=-half;e<=half;e++){
        const bx=Math.round(sx+px2*e), by=Math.round(sy+py2*e);
        px(bx,by,((e+r)%2===0)?BRISTLE:BRISTLESH);
      }
    }
  }

  // ── 2px-thick handle from (x0,y0) to (x1,y1), in `col`. Returns the
  //    direction so the broom head can flare consistently with it.
  function handle(x0,y0,x1,y1,col){
    const steps=Math.max(1,Math.round(Math.hypot(x1-x0,y1-y0)));
    for(let s=0;s<=steps;s++){
      const t=s/steps;
      const xp=Math.round(x0+(x1-x0)*t), yp=Math.round(y0+(y1-y0)*t);
      px(xp,yp,col); px(xp-D,yp,col);               // 2px thick
    }
    return {dx:(x1-x0),dy:(y1-y0)};
  }

  if(!sweeping){
    // ════ WALKING — broom in one hand, dustpan in the other ═════════
    // Each tool is ONE STRAIGHT handle gripped in the middle (hand on the
    // handle), tilted slightly. [#2 fix] The old code drew the part ABOVE
    // the grip with one slope and the part BELOW with the OPPOSITE slope,
    // so the handle bent into a "<" at the hand and read as broken/
    // mismatched pieces as the arm swung. Now a single handle() runs from
    // the top stub straight through the grip to the head, so the swing just
    // slides the whole rigid handle. HOW TO MODIFY: HANDLE_UP/DOWN set how
    // much pokes above/below the hand; ANG_X is the tilt (x shift per row,
    // SAME sign top and bottom = straight).
    const HANDLE_UP   = 10;      // px of handle ABOVE the grip
    const HANDLE_DOWN = 22;      // px from grip DOWN to head/pan
    const ANG_X       = 0.45;    // tilt: x shift per row (one consistent slope)
    const BRISTLE_LEN = 7;

    // BROOM — front hand. Tilts down-and-FORWARD; one straight shaft.
    const bhx=anchors.handFrontX, bhy=anchors.handFrontY;
    const bTopX = bhx - Math.round(HANDLE_UP*ANG_X),   bTopY = bhy - HANDLE_UP;
    const bBotX = bhx + Math.round(HANDLE_DOWN*ANG_X), bBotY = bhy + HANDLE_DOWN;
    handle(bTopX, bTopY, bBotX, bBotY, handleCol);     // single rigid shaft
    broomHead(bBotX, bBotY, ANG_X, 1, BRISTLE_LEN);    // head flares with the tilt

    // DUSTPAN — back hand. Tilts down-and-BACK; one straight shaft.
    const phx=anchors.handBackX, phy=anchors.handBackY;
    const pTopX = phx + Math.round(HANDLE_UP*ANG_X),   pTopY = phy - HANDLE_UP;
    const pBotX = phx - Math.round(HANDLE_DOWN*ANG_X), pBotY = phy + HANDLE_DOWN;
    handle(pTopX, pTopY, pBotX, pBotY, PANSH);         // single rigid shaft
    // CHUNKY pan box at the bottom of the shaft (5-row trapezoid).
    const panX = pBotX, panY = pBotY;
    for(let e=-3;e<=3;e++) px(panX+e, panY,   PANEDGE);   // top open edge
    for(let e=-4;e<=4;e++) px(panX+e, panY+1, PAN);       // front lip widens
    for(let e=-4;e<=4;e++) px(panX+e, panY+2, PAN);
    for(let e=-4;e<=4;e++) px(panX+e, panY+3, PAN);
    for(let e=-4;e<=4;e++) px(panX+e, panY+4, PAN);
    px(panX-4, panY-1, PAN); px(panX+4, panY-1, PAN);    // back wall hint
    return;
  }

  // ════ SWEEPING ════
  if(facing===0){
    // ── FRONT-FACING SWEEP [#2] — the character grips the props LOW
    //    near the feet. Hand positions are anchored low; the props
    //    plant 1-2px BELOW the feet (on the carpet). Total prop length
    //    stays tiny (≈10px). DUSTPAN STAYS STILL on the floor while
    //    the BROOM moves side-to-side, so it reads like sweeping INTO
    //    the dustpan rather than waving both around.
    const stroke=Math.round(1.5*Math.sin(sweepPhase*0.4));  // BROOM ONLY
    // [#2] Visible shoes are at fy-30; bristle/pan bottom should be 2px
    // below the visible shoes (fy-28), not fy+2 which is 30px below.
    const SHOES_Y = fy - 20;       // probe-verified offset
    const TARGET_BOTTOM = SHOES_Y + 2;          // 2px below visible shoes

    // DUSTPAN — planted on the floor, DOESN'T MOVE. Bigger reservoir.
    const phx=anchors.handBackX, phy=anchors.handBackY;
    const panCx=phx;                                     // fixed (no stroke)
    const panBottomY = TARGET_BOTTOM;
    const panY = panBottomY;
    // Pan box: 9 wide at the front lip, flares back. ~5 rows tall.
    for(let e=-4;e<=4;e++) px(panCx+e, panY,   PAN);     // floor row
    for(let e=-4;e<=4;e++) px(panCx+e, panY-1, PAN);     // row above
    for(let e=-3;e<=3;e++) px(panCx+e, panY-2, PAN);     // narrower middle
    for(let e=-3;e<=3;e++) px(panCx+e, panY-3, PAN);
    for(let e=-3;e<=3;e++) px(panCx+e, panY-4, PANEDGE); // open lip at top
    // back wall — taller on the back so it reads as 3D
    px(panCx-3, panY-3, PAN); px(panCx-3, panY-2, PAN);
    // handle from hand (waist) down to back of pan
    handle(phx,phy, panCx-2, panY-4, PANSH);
    handle(phx,phy, phx,phy-1, PANSH);                   // tiny stub above hand

    // BROOM — head sweeps side to side with the stroke [#2]
    const bhx=anchors.handFrontX, bhy=anchors.handFrontY;
    const headX=bhx+stroke;
    const bristleLen=7;
    const headTopY = TARGET_BOTTOM - bristleLen + 1;     // bottom at TARGET_BOTTOM
    handle(bhx,bhy, headX,headTopY, handleCol);
    handle(bhx,bhy, bhx,bhy-1, handleCol);
    broomHead(headX,headTopY, 0, 1, bristleLen);
    // KERNELS being swept toward the pan
    if(kernels){
      for(const k of kernels){
        const startX=fx+k.off;
        const endX=panCx;
        const kx=Math.round(startX+(endX-startX)*(swept||0));
        const ky=(swept>0.85)?panY-2:floorY;
        px(kx,ky,BRISTLE); px(kx+1,ky,ix('i'));
      }
    }
    return;
  }

  // ════ SIDE SWEEPING (kept as fallback though not currently triggered)
  //      tools reach only to just below/in front of the feet, NOT
  //      disproportionately long. ════
  // DUSTPAN planted on the floor just in front of the feet.
  const panX=fx-D*9;                        // pan close behind/at the feet
  const panY=floorY;
  for(let e=0;e<=8;e++) px(panX+D*e,panY,PAN);          // pan floor
  for(let e=0;e<=8;e++) px(panX+D*e,panY-1,PAN);
  for(let e=0;e<=8;e++) px(panX+D*e,panY-3,PANEDGE);    // opening lip
  px(panX,panY-1,PAN); px(panX,panY-2,PAN);             // back wall
  const phx=anchors.handBackX, phy=anchors.handBackY;
  handle(panX,panY-3, phx,phy, PANSH);
  const bhx=anchors.handFrontX, bhy=anchors.handFrontY;
  const stroke=Math.round(3*Math.sin(sweepPhase*0.4));
  const reachStart=fx+D*12, reachEnd=fx+D*2;
  const headX=Math.round(reachStart+(reachEnd-reachStart)*(swept||0))+stroke*D;
  const headTopY=floorY-7;
  const dir=handle(bhx,bhy, headX,headTopY, handleCol);
  broomHead(headX,headTopY, dir.dx,dir.dy, 7);
  if(kernels){
    for(const k of kernels){
      const startX=fx+D*k.off;
      const endX=panX+D*4;
      const kx=Math.round(startX+(endX-startX)*(swept||0));
      const ky=(swept>0.85)?panY-2:floorY;
      px(kx,ky,BRISTLE); px(kx+1,ky,ix('i'));
    }
  }
}

/* ════════════════════════════════════════════════════════════════════════
   5. RENDERER  — background  →  characters  →  rope layer  →  speech
   ════════════════════════════════════════════════════════════════════════ */
// canvas is provided via the IIFE parameter `_canvas` (see bottom of file).
const canvas = _canvas;
const cx = canvas.getContext('2d');
cx.imageSmoothingEnabled = false;

buildBackground();
let livePalette=PAL.slice();

// CLIP_RECT — when set, px() only draws inside this rectangle. Used to
// render a character sprite clipped to the door window.
let CLIP_RECT=null;
function px(x,y,idx){
  if(idx===0||idx===undefined) return;
  if(CLIP_RECT){
    if(x<CLIP_RECT.x0||x>CLIP_RECT.x1||y<CLIP_RECT.y0||y>CLIP_RECT.y1) return;
  }
  cx.fillStyle=livePalette[idx];
  cx.fillRect(x,y,1,1);
}
function rectPx(x0,y0,x1,y1,i){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) px(x,y,i); }
function discPx(cx2,cy2,r,i){
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)
    if(x*x+y*y<=r*r) px(cx2+x,cy2+y,i);
}
function ringPx(cx2,cy2,r,i){
  for(let a=0;a<360;a+=8){
    px(Math.round(cx2+r*Math.cos(a*Math.PI/180)),
       Math.round(cy2+r*Math.sin(a*Math.PI/180)),i);
  }
}
function paintBackground(){
  const g=SCENE.grid;
  for(let y=0;y<H;y++){ const row=g[y]; for(let x=0;x<W;x++) px(x,y,row[x]); }
}

function drawInstant(){
  cx.clearRect(0,0,W,H);
  paintBackground();
  drawAgitators();
  drawPopper();
  drawDoorOverlay();              // door redrawn if a concessionist is exiting
  drawConcessionists();
  // soda + register redrawn so concessionists pass behind them
  const cp=(x,y,i)=>px(x,y,i);
  sodaMachineDraw(cp,SCENE.sodaXY.x,SCENE.sodaXY.y);
  cashRegisterDraw(cp,SCENE.regXY.x,SCENE.regXY.y);
  // ROPE LAYER — drawn over the counter; sweepers behind it draw first.
  // The sweeper walks IN FRONT OF the candy case at the bottom strip,
  // so the case must NOT obscure the sweeper — no re-blit here.
  drawSweepers('behind');
  drawRopeLayer();
  drawSweepers('front');          // sweepers in the foreground lane
  if(speechActive()) drawSpeech();
  // ── LIGHTING PASS [#6, #7] — additive overlays AFTER everything else.
  //    Tinted soft glows from the candy case (warm) and the marquee neon
  //    (pink). Respect intensity sliders and the flicker state.
  drawLightingPass();
}

// ── LIGHTING SYSTEM ─────────────────────────────────────────────────
// State and intensity for the various light sources in the scene. Each
// is a 0..N intensity that the test panel can adjust or toggle off.
// ── LIGHTS — runtime intensity for the two ambient light sources.
//    Edit these defaults to change how the title screen lighting starts.
//    During play the values are mutated by `setCandyIntensity` /
//    `setNeonIntensity` exposed on the GameTitle API.
//      candy : the warm pool from the candy case backlight (0=off, 8=max)
//      neon  : the pink wash + bulb/title glow around the marquee
//              (0=off, 5=max)
const LIGHTS = {
  candy: 4,    // 0=off, baseline=4, max=8 for testing
  neon:  2,    // 0=off, 1=subtle, 2=normal, 3=bright
};
// ── FLICKER STATE [#4] — the system supports two flicker types:
//    BIG flickers (common / shorted) which affect ALL lighting (neon,
//    candy backlight, menu illumination) and have a stutter-then-out
//    pattern, and MICRO flickers — quick blink-outs of a single element
//    (one bulb, one neon line, one title letter). Micro-flickers are
//    independent of big flickers and happen randomly more often.

// Big flicker state machine. Phases:
//   'stutter' — lights blink unevenly for ~30 frames (half-second)
//   'out'     — lights fully off for ~10-20 frames
//   'recovering' — quick blink as lights come back
//   'idle'    — normal lighting
let bigFlickerPhase = 'idle';     // 'idle' | 'stutter' | 'out' | 'recovering'
let bigFlickerTimer = 0;          // frames remaining in current phase
let bigFlickerType  = 0;          // 0=common, 1=shorted
let stutterStateOn  = true;       // current on/off during stutter (uneven)
let nextBigFlickerFrame = 600;    // when the next big flicker fires

// Micro-flicker — one element blinks out briefly. Independent and frequent.
//   element: {kind, idx} — kind = 'bulb' | 'line' | 'letter'
let microFlickers = [];           // list of {kind, idx, framesLeft}
let nextMicroFlickerFrame = 120;

// Shorted-letter index (-1 if none) and sparks — set during shorted big flicker
let shortedLetterIdx = -1;
let sparkParticles = [];

// ── lookingUp — during a SHORTED flicker, all on-screen characters
//    pause and tilt their heads up at the lights [#7].
function isLookingUp(){
  return bigFlickerType === 1 && bigFlickerPhase !== 'idle';
}
// True while the BIG flicker is forcibly killing all lights — candy +
// menu illumination + neon all go dark together. Used in drawLightingPass.
function bigFlickerKillingLights(){
  return bigFlickerPhase === 'out';
}
// True while the BIG flicker is stuttering (uneven on/off before blackout).
function bigFlickerStuttering(){
  return bigFlickerPhase === 'stutter';
}
// True while any BIG flicker is happening (stutter or blackout).
function bigFlickerActive(){ return bigFlickerPhase !== 'idle'; }

function tickLightingState(){
  // ── BIG FLICKER STATE MACHINE ──
  if(bigFlickerPhase !== 'idle'){
    bigFlickerTimer--;
    if(bigFlickerPhase === 'stutter'){
      // every 3-6 frames, toggle the stutter on/off unevenly
      if(bigFlickerTimer % (3 + ((Math.random()*3)|0)) === 0){
        stutterStateOn = !stutterStateOn;
      }
      if(bigFlickerTimer <= 0){
        // half-second of stutter done — go fully OUT for ~10-20 frames
        bigFlickerPhase = 'out';
        bigFlickerTimer = 10 + ((Math.random()*10)|0);
      }
    } else if(bigFlickerPhase === 'out'){
      if(bigFlickerTimer <= 0){
        // brief recovery blink
        bigFlickerPhase = 'recovering';
        bigFlickerTimer = 4 + ((Math.random()*4)|0);
        stutterStateOn = true;
      }
    } else if(bigFlickerPhase === 'recovering'){
      // quick on/off blip during recovery
      if(bigFlickerTimer % 2 === 0) stutterStateOn = !stutterStateOn;
      if(bigFlickerTimer <= 0){
        bigFlickerPhase = 'idle';
        stutterStateOn = true;
        shortedLetterIdx = -1;
      }
    }
  }
  // schedule next BIG flicker (rare — every 30-60 seconds)
  if(frameCount >= nextBigFlickerFrame && bigFlickerPhase === 'idle'){
    triggerFlicker(Math.random() < 0.18 ? 1 : 0);
    nextBigFlickerFrame = frameCount + 1800 + ((Math.random()*1800)|0);
  }

  // ── MICRO FLICKERS [#4] — quick blink-out of a single element.
  //    Schedule frequently: every 1-3 seconds on average.
  if(frameCount >= nextMicroFlickerFrame){
    const kinds = ['bulb','line','letter'];
    const kind = kinds[(Math.random()*3)|0];
    let idx;
    if(kind === 'bulb'){
      idx = ((Math.random()*Math.max(1,(SCENE.bulbs||[]).length))|0);
    } else if(kind === 'line'){
      // 6 lines total (3 left + 3 right). Index 0-2 = left, 3-5 = right.
      idx = (Math.random()*6)|0;
    } else { // letter
      idx = (Math.random()*22)|0;     // ≈ length of title
    }
    microFlickers.push({kind, idx, framesLeft: 2 + ((Math.random()*4)|0)});
    nextMicroFlickerFrame = frameCount + 60 + ((Math.random()*90)|0);
  }
  // decrement existing micros
  for(const m of microFlickers) m.framesLeft--;
  microFlickers = microFlickers.filter(m => m.framesLeft > 0);

  // sparks
  for(const sp of sparkParticles){
    sp.x += sp.vx; sp.y += sp.vy; sp.vy += 0.25; sp.life--;
  }
  sparkParticles = sparkParticles.filter(sp => sp.life > 0 && sp.y < H);
}

function triggerFlicker(type){
  // Begin a BIG flicker. Phase order: stutter → out → recovering → idle.
  bigFlickerType = type;
  bigFlickerPhase = 'stutter';
  bigFlickerTimer = 28 + ((Math.random()*6)|0);    // ~half a second of stutter
  stutterStateOn = true;
  if(type === 1){
    shortedLetterIdx = (Math.random()*22)|0;
    const sparkY = [16, 44, 72][(Math.random()*3)|0];
    const sparkX = (Math.random()<0.5) ? 30+((Math.random()*20)|0) : W-50+((Math.random()*20)|0);
    for(let i=0;i<5;i++){
      sparkParticles.push({
        x:sparkX, y:sparkY,
        vx:(Math.random()-0.5)*1.4,
        vy:-0.5+Math.random()*0.8,
        life:18+((Math.random()*12)|0),
      });
    }
  }
}

function drawLightingPass(){
  // ── BIG FLICKER OVERLAY [#4] — phased: stutter (uneven blink) → out
  //    (fully dark) → recovering (quick on/off). Each phase visually
  //    affects the marquee/neon region. The candy + menu illumination
  //    blocks below also check bigFlickerKillingLights() / Stuttering()
  //    to drop their light during the same phases.
  if(bigFlickerActive()){
    cx.save();
    cx.globalCompositeOperation = 'multiply';
    if(bigFlickerPhase === 'out'){
      // LIGHTS FULLY OUT [#1] — the ENTIRE environment gets darker
      // during the outage, not just the marquee area. The full-screen
      // multiply overlay simulates the room going dim when the neon
      // gives out.
      cx.fillStyle = '#101010';
      cx.fillRect(0, 0, W, H);
    } else if(bigFlickerPhase === 'stutter'){
      // UNEVEN STUTTER — alternates dim/normal based on stutterStateOn.
      // During the stutter, dim the marquee region heavily and the rest
      // of the scene more subtly (since the marquee is the source of the
      // flicker but ambient light also wavers).
      cx.fillStyle = stutterStateOn ? '#a0a0a0' : '#404040';
      cx.fillRect(0, 0, W, 95);
      cx.fillStyle = stutterStateOn ? '#e0e0e0' : '#a0a0a0';
      cx.fillRect(0, 95, W, H - 95);
    } else if(bigFlickerPhase === 'recovering'){
      // quick blink during recovery — full-scene
      cx.fillStyle = stutterStateOn ? '#c0c0c0' : '#606060';
      cx.fillRect(0, 0, W, 95);
      cx.fillStyle = stutterStateOn ? '#e0e0e0' : '#a0a0a0';
      cx.fillRect(0, 95, W, H - 95);
    }
    cx.restore();
    // shorted letter — paint a black box over one title letter
    if(shortedLetterIdx >= 0 && bigFlickerType === 1){
      const ltrX = 80 + shortedLetterIdx * 11;
      const ltrY = (shortedLetterIdx < 13) ? 28 : 48;
      cx.save();
      cx.fillStyle = '#08080c';
      cx.fillRect(ltrX, ltrY, 10, 14);
      cx.restore();
    }
  }

  // ── MICRO FLICKERS [#4] — individual elements blink out independent
  //    of the big flicker. A black box gets painted over the element.
  for(const m of microFlickers){
    cx.save();
    cx.fillStyle = '#08080c';
    if(m.kind === 'bulb'){
      const b = (SCENE.bulbs||[])[m.idx];
      if(b) cx.fillRect(b.x-1, b.y-1, 3, 3);
    } else if(m.kind === 'line'){
      // Lines on the angled marquee sides — the 3 neon lines at MY0+20%
      // / 50% / 80% of (MY1-MY0). They angle UP going OUT (slope 0.18).
      // [#4] Match the actual angled line positions so the black-out
      // lands on the visible line, not in empty space.
      const MX0=56, MX1=W-57, MY0=6, MY1=82;
      const lineT = [0.20, 0.50, 0.80][m.idx % 3];
      const yAtFront = MY0 + Math.round((MY1-MY0) * lineT);
      if(m.idx < 3){
        // LEFT line — black out a 30px segment along the angled path
        for(let x=15; x<45; x++){
          const dx = (MX0-4) - x;
          const ly = yAtFront - Math.round(dx * 0.18);
          if(ly>=0 && ly<H) cx.fillRect(x, ly-1, 1, 3);
        }
      } else {
        // RIGHT line — mirror
        for(let x=W-44; x<W-14; x++){
          const dx = x - (MX1+4);
          const ly = yAtFront - Math.round(dx * 0.18);
          if(ly>=0 && ly<H) cx.fillRect(x, ly-1, 1, 3);
        }
      }
    } else if(m.kind === 'letter'){
      // Title letter — approximate position. Title text is centered in
      // the marquee box, with "MIDNIGHT AT THE" on the upper line and
      // "MULTIPLEX" on the lower. Index 0-12 = upper, 13+ = lower.
      const ltrX = 80 + (m.idx % 13) * 11;
      const ltrY = (m.idx < 13) ? 24 : 48;
      cx.fillRect(ltrX, ltrY, 10, 16);
    }
    cx.restore();
  }

  // ── NEON AMBIENT LIGHT — pink/magenta wash. Suppressed during ANY big
  //    flicker phase (so the lighting truly goes with the flicker).
  if(LIGHTS.neon > 0 && !bigFlickerActive()){
    const intensity = LIGHTS.neon;       // 1..5
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    // The neon lines are at y≈22, 44, 66 (linesY in marquee). The marquee
    // itself spans y=6..82. Spread the light DOWN from this region with a
    // smooth gradient that fades out by about y=180.
    for(let yy=0; yy<180; yy++){
      // distance from the brightest neon band (around y=44)
      const d = Math.abs(yy - 44);
      // exponential-ish falloff
      const falloff = Math.max(0, 1 - d/120);
      // [#1] dialed down — was 0.18 (too intense). Subtle wash now.
      const a = 0.07 * intensity * falloff * falloff;
      if(a < 0.01) continue;
      cx.globalAlpha = Math.min(0.7, a);
      cx.fillStyle = '#ff66cc';            // neon pink
      cx.fillRect(0, yy, W, 1);
    }
    cx.restore();
  }

  // ── MARQUEE TITLE + BULBS LIGHT EMISSION [#5] — the bulbs and the
  //    title text are their OWN light sources, emitting light of the
  //    COLOR THEY ARE CURRENTLY DISPLAYING. Since the bulbs chase
  //    through palette indices 1-4 each frame, the emitted light
  //    changes color frame-to-frame. Same for the title text.
  if(LIGHTS.neon > 0 && !bigFlickerActive()){
    const intensity = LIGHTS.neon;
    const MX0=56, MX1=W-57, MY0=6, MY1=82;
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    // ── BULB EMISSIONS — each bulb radiates a small pool of its current
    //    chase color. The bulb's color is at livePalette[1 + (i mod 4)]
    //    where i is the bulb's phase index — but `placeBulb` set them
    //    to `1+(phase%4)` at build time, which means each bulb's index
    //    is FIXED but the palette ENTRIES rotate via cycleBulbs(). So
    //    each bulb naturally cycles colors.
    // We read the bulb's palette index from SCENE.bulbs (need to add
    // the colorIdx) — for now, infer based on bulb order.
    if(SCENE.bulbs){
      for(let i=0;i<SCENE.bulbs.length;i++){
        const b=SCENE.bulbs[i];
        const palIdx = 1 + (i % 4);
        const col = livePalette[palIdx];
        // small radial pool around the bulb
        const r=5;
        for(let dy=-r; dy<=r; dy++){
          for(let dx=-r; dx<=r; dx++){
            const d2 = (dx*dx+dy*dy)/(r*r);
            if(d2>1) continue;
            const a = 0.10 * intensity * (1-d2);
            if(a<0.01) continue;
            cx.globalAlpha = Math.min(0.6, a);
            cx.fillStyle = col;
            const xx=b.x+dx, yy=b.y+dy;
            if(xx>=0&&xx<W&&yy>=0&&yy<H) cx.fillRect(xx,yy,1,1);
          }
        }
      }
    }
    // ── TITLE EMISSION — the title text uses indices 2/3/4 which cycle
    //    via livePalette. Pick the "average" of those three for the
    //    title's light tint each frame.
    const c3=livePalette[3];
    // Use index 3 (middle) for the dominant tint
    const titleTint = c3;
    for(let yy=MY0+8; yy<=MY1-4; yy++){
      for(let xx=MX0+8; xx<=MX1-8; xx++){
        if(xx<0||xx>=W||yy<0||yy>=H) continue;
        const cxx=(MX0+MX1)/2, cyy=(MY0+MY1)/2;
        const dx=(xx-cxx)/((MX1-MX0)/2);
        const dy=(yy-cyy)/((MY1-MY0)/2);
        const d2=dx*dx+dy*dy;
        if(d2>1) continue;
        const a = 0.05 * intensity * (1-d2);
        if(a<0.008) continue;
        cx.globalAlpha = Math.min(0.5, a);
        cx.fillStyle = titleTint;
        cx.fillRect(xx,yy,1,1);
      }
    }
    cx.restore();
  }

  // ── MENU BORDER FAINT LIGHT [#3] — the yellow border around the main
  //    menu emits a VERY FAINT warm light onto its immediate surroundings.
  //    Even at full neon intensity this stays subtle.
  if(LIGHTS.neon > 0 && !bigFlickerActive()){
    const intensity = LIGHTS.neon;
    const PX0=150,PY0=89,PX1=300,PY1=136;
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    // a thin yellow halo around the menu frame
    for(let yy=PY0-3; yy<=PY1+3; yy++){
      for(let xx=PX0-3; xx<=PX1+3; xx++){
        if(xx<0||xx>=W||yy<0||yy>=H) continue;
        // distance from the menu interior
        let edgeDist = 0;
        if(xx<PX0) edgeDist = Math.max(edgeDist, PX0-xx);
        if(xx>PX1) edgeDist = Math.max(edgeDist, xx-PX1);
        if(yy<PY0) edgeDist = Math.max(edgeDist, PY0-yy);
        if(yy>PY1) edgeDist = Math.max(edgeDist, yy-PY1);
        if(edgeDist > 3) continue;
        const a = 0.025 * intensity * (1 - edgeDist/4);
        if(a < 0.005) continue;
        cx.globalAlpha = a;
        cx.fillStyle = '#ffd060';
        cx.fillRect(xx, yy, 1, 1);
      }
    }
    cx.restore();
  }

  // ── BACK ROOM LIGHT SPILL [#17] — very faint warm light spilling
  //    through the door's window AND through the doorway when the door
  //    is open. Light area = window rect always + the doorway when
  //    open. Subtle yellow-orange wash on the immediate surroundings.
  {
    const d = SCENE.door;
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    // through the window — always
    const wcx = (d.winX0+d.winX1)/2, wcy = (d.winY0+d.winY1)/2;
    const wReach = 16;
    for(let yy=d.winY0-wReach; yy<=d.winY1+wReach; yy++){
      for(let xx=d.winX0-wReach; xx<=d.winX1+wReach; xx++){
        if(xx<0||xx>=W||yy<0||yy>=H) continue;
        const dx=(xx-wcx)/(d.winX1-d.winX0+wReach);
        const dy=(yy-wcy)/(d.winY1-d.winY0+wReach);
        const d2=dx*dx+dy*dy;
        if(d2>1) continue;
        const a = 0.06 * (1-d2) * (1-d2);
        if(a < 0.005) continue;
        cx.globalAlpha = a;
        cx.fillStyle = '#ffaa50';            // warm back-room glow
        cx.fillRect(xx,yy,1,1);
      }
    }
    // through the open doorway — only when the door is showing open
    if(typeof doorState!=='undefined' && (doorState==='open' || doorState==='half')){
      const dcx = (d.x+d.x+d.w)/2, dcy = (d.y+d.floorY)/2;
      const dReach = 28;
      for(let yy=d.y-dReach; yy<=d.floorY+dReach; yy++){
        for(let xx=d.x-dReach; xx<=d.x+d.w+dReach; xx++){
          if(xx<0||xx>=W||yy<0||yy>=H) continue;
          const dx=(xx-dcx)/(d.w/2+dReach);
          const dy=(yy-dcy)/((d.floorY-d.y)/2+dReach);
          const d2=dx*dx+dy*dy;
          if(d2>1) continue;
          const a = 0.08 * (1-d2) * (1-d2);
          if(a < 0.005) continue;
          cx.globalAlpha = a;
          cx.fillStyle = '#ffaa50';
          cx.fillRect(xx,yy,1,1);
        }
      }
    }
    cx.restore();
  }

  // ── CANDY CASE BACKLIGHT — pool on the floor. Goes out during the
  //    big flicker [#4]: fully OFF during 'out' phase, dimmed during
  //    'stutter' / 'recovering' phases (synced with stutterStateOn).
  if(LIGHTS.candy > 0 && !bigFlickerKillingLights()
       && !(bigFlickerStuttering() && !stutterStateOn)){
    const intensity = LIGHTS.candy;          // 1..8
    const ccX = SCENE.candyXY.x + 27;        // center of candy case (light source)
    const ccY = SCENE.candyXY.y + 18;
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    const reach = 60 + intensity * 6;
    const baseAlpha = 0.04 + intensity * 0.02;
    for(let yy=SCENE.candyXY.y-6; yy<H; yy++){
      for(let xx=ccX-reach; xx<ccX+reach; xx++){
        if(xx<0||xx>=W) continue;
        const dx=(xx-ccX)/reach;
        const dy=(yy-ccY)/(reach*0.9);
        const d2 = dx*dx + dy*dy;
        if(d2 > 1) continue;
        const floorBoost = (yy >= SCENE.floorY) ? 1.5 : 0.9;
        const a = baseAlpha * (1-d2) * floorBoost;
        if(a < 0.008) continue;
        cx.globalAlpha = Math.min(0.75, a);
        cx.fillStyle = '#ffc070';
        cx.fillRect(xx, yy, 1, 1);
      }
    }
    cx.restore();
    // ── SWEEPER SHADOWS REMOVED [per user request] ────────────────────
    // The candy backlight no longer casts sweeper shadows. Pole shadows
    // (see block below) are still drawn.
  }

  // ── ROPE POLE SHADOWS [#6] — same directional logic for the rope
  //    barrier poles when they're inside the candy light's reach.
  if(LIGHTS.candy > 0 && !bigFlickerKillingLights()
       && !(bigFlickerStuttering() && !stutterStateOn)){
    const ccX = SCENE.candyXY.x + 27;
    const ccY = SCENE.candyXY.y + 18;
    const reach = 60 + LIGHTS.candy * 6;
    cx.save();
    cx.globalCompositeOperation = 'multiply';
    const poleXs=[44,120,196,272,344];
    const ropeY = SCENE.floorY + 24;
    for(const pxc of poleXs){
      const sdx = pxc - ccX;
      const sdy = ropeY - ccY;
      const dist = Math.sqrt(sdx*sdx + sdy*sdy);
      if(dist > reach) continue;
      const dirX = sdx / (dist || 1);
      const lengthFactor = 1 - (dist / reach);
      const shadowLen = Math.round(6 + lengthFactor * 10);
      for(let off=0; off<shadowLen; off++){
        const t = off / shadowLen;
        const px_ = Math.round(pxc + dirX * off);
        const py_ = ropeY + 2 + Math.round(off * 0.1);
        if(py_ < SCENE.floorY || py_ >= H) continue;
        const alpha = (1 - t) * 0.35;
        cx.globalAlpha = Math.max(0, alpha);
        cx.fillStyle = '#202028';
        if(px_>=0 && px_<W) cx.fillRect(px_, py_, 2, 1);
      }
    }
    cx.restore();
  }


  // ── SPARKS — tiny falling bright dots during a shorted-out flicker
  for(const sp of sparkParticles){
    px(Math.round(sp.x),     Math.round(sp.y),     ix('s'));
    px(Math.round(sp.x)+1,   Math.round(sp.y),     ix('y'));
  }
}

let drawOnActive=false,doX=0,doY=0;
const DRAW_CHUNK=2900;
function startDrawOn(){ drawOnActive=true; doX=0; doY=0; cx.clearRect(0,0,W,H); }
function stepDrawOn(){
  let budget=DRAW_CHUNK;
  const g=SCENE.grid;
  while(budget-->0&&doY<H){
    px(doX,doY,g[doY][doX]);
    if(++doX>=W){ doX=0; doY++; }
  }
  if(doY>=H) drawOnActive=false;
}

/* ════════════════════════════════════════════════════════════════════════
   6. ANIMATION
   ════════════════════════════════════════════════════════════════════════ */
let frameCount=0, animOn=true;

// (a) marquee bulb chase
let bulbPhase=0;
function cycleBulbs(){
  bulbPhase=(bulbPhase+1)%4;
  const base=[PAL[1],PAL[2],PAL[3],PAL[4]];
  for(let k=0;k<4;k++) livePalette[1+k]=base[(k+bulbPhase)%4];
}

// (b) ICEE agitators
let agitAngle=0;
function drawAgitators(){
  agitAngle+=0.11;
  for(const m of SCENE.icee){
    for(let blade=0;blade<2;blade++){
      const a=agitAngle+blade*Math.PI;
      for(let rr=2;rr<m.r;rr++){
        const bx=m.cx+rr*Math.cos(a), by=m.cy+rr*Math.sin(a);
        const ox=Math.cos(a+Math.PI/2), oy=Math.sin(a+Math.PI/2);
        for(let t=-1;t<=1;t++)
          px(Math.round(bx+ox*t),Math.round(by+oy*t),t===0?ix('o'):ix('j'));
      }
    }
    px(m.cx,m.cy,ix('k'));
  }
}

// (c) popcorn popper — fuller pile, kettle jiggle→lid lift
let popState='REST', popTimer=0, popKernels=[], pile=[];
function initPile(){
  // ── POPCORN PILE — HEAP-SHAPED [#15, #16] ──────────────────────────
  // Starts as a small uneven heap; each column has its own pileTop. The
  // pile's MAXIMUM height varies by column: TALLEST in the middle, much
  // SHORTER at the chamber walls — so it can never stack out to the
  // sides. Once a column reaches its own max, kernels landing on it
  // simply despawn (no more growth) — the top stays uneven instead of
  // flattening into a straight line, because each column has a slightly
  // randomized max.
  const k=SCENE.popper;
  pile=[];
  const floorRow=k.cy1-1;
  const left=k.x+5, right=k.x+k.w-5;
  const cx2=(left+right)/2, halfW=(right-left)/2;
  pileTop=new Map();
  pileMax=new Map();
  let seed=12345;
  const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
  // top of the heap (highest the central columns can reach) — 2px below
  // the kettle's lowest visible pixel.
  const heapPeakY = k.kettle.y + 10;
  // base starting height — short, uneven across the whole chamber
  for(let x=left;x<=right;x++){
    const startH=3+Math.floor(rnd()*2);             // 3 or 4 px tall
    for(let i=0;i<startH;i++) pile.push({x,y:floorRow-i});
    pileTop.set(x, floorRow-startH);
    // ── per-column MAX HEIGHT [#15] — a heap profile. Centre columns
    //    can grow tall; side columns are capped LOW. With a touch of
    //    randomness so the top of the pile is never a flat line [#16].
    const t = Math.abs(x - cx2) / halfW;            // 0=centre, 1=wall
    const profileMax = heapPeakY + Math.round(t*t * 16);
    const jitter = Math.floor(rnd()*3);             // 0..2 px random
    pileMax.set(x, profileMax + jitter);
  }
}
// `pileTop` — per-column current top y (the y where the NEXT kernel
// added to that column will land). Maintained by updatePopper.
// `pileMax` — per-column MAX y (lowest number; column can't grow past it).
let pileTop=new Map();
let pileMax=new Map();
function updatePopper(){
  popTimer++;
  if(popState==='REST'){ if(popTimer>110+((Math.random()*70)|0)){ popState='JIGGLE'; popTimer=0; } }
  else if(popState==='JIGGLE'){
    if(popTimer>14){
      popState='OPEN'; popTimer=0;
      // ── PILE SHUFFLE — when a new pop cycle starts, gently shuffle the
      //    existing settled pile so its shape isn't identical every time.
      //    Each kernel can shift x by ±1; the per-column pileTop heightmap
      //    is left alone (so the overall shape is preserved), only the
      //    visible kernel positions jitter. Subtle but breaks the static
      //    look between cycles. CLAMPED to chamber interior so a shuffled
      //    kernel can't end up at or past the visible wall pixels.
      const _k = SCENE.popper;
      const _wL = _k.x+5, _wR = _k.x+_k.w-5;
      for(const p of pile){
        if(Math.random()<0.35){
          const newX = p.x + ((Math.random()<0.5)?-1:1);
          if(newX >= _wL && newX <= _wR) p.x = newX;
        }
      }
    }
  }
  else if(popState==='OPEN'){
    if(popTimer<18 && popTimer%2===0){
      const k=SCENE.popper;
      for(let n=0;n<5;n++){
        const side=(Math.random()<0.5)?-1:1;
        popKernels.push({x:k.kettle.x+(Math.random()*8-4),y:k.kettle.y,
          vx:side*(0.9+Math.random()*1.8),vy:-(1.0+Math.random()*1.3),
          life:0,landed:false,doomed:false});
      }
    }
    if(popTimer>32){ popState='CLOSE'; popTimer=0; }
  }
  else if(popState==='CLOSE'){ if(popTimer>10){ popState='REST'; popTimer=0; } }
  const k=SCENE.popper;
  // ── CHAMBER WALL COLLISION [#7] — walls match the actual visible
  //    interior (x+5..x+w-5), and the collision predicts the kernel's
  //    NEXT position; if it would land on or past the wall, clamp it
  //    BEFORE the position update. Stops any high-velocity kernel from
  //    visibly exiting the chamber.
  const wallL=k.x+5, wallR=k.x+k.w-5;
  for(const kr of popKernels){
    if(kr.landed) continue;
    // predict next x
    let nx = kr.x + kr.vx;
    if(nx < wallL){ kr.x = wallL; kr.vx = Math.abs(kr.vx)*0.5; nx = kr.x; }
    else if(nx > wallR){ kr.x = wallR; kr.vx = -Math.abs(kr.vx)*0.5; nx = kr.x; }
    else { kr.x = nx; }
    kr.y += kr.vy; kr.vy += 0.13; kr.life++;
    // doomed kernels (rejected from a full column) tumble briefly then despawn
    if(kr.doomed && kr.life>60){ kr.landed=true; kr.despawn=true; continue; }
    if(kr.y<k.cy0+2){ kr.y=k.cy0+2; kr.vy=Math.abs(kr.vy)*0.4; }
    const col=Math.round(kr.x);
    const topY=pileTop.get(col);
    if(topY!==undefined && kr.y>=topY){
      // Kernel lands STRAIGHT DOWN where it falls. No more rolling to
      // shorter neighbors — that was widening the pile out to the sides.
      // The heap shape comes from the per-column MAX in pileMax.
      const landCol=col, landTopY=topY;
      // ── PER-COLUMN max check [#16] — each column has its own max
      //    height (set in initPile by the heap profile). If the target
      //    column has reached its max, the kernel disappears the instant
      //    it touches the top — no tumbling, no piling beyond the heap.
      const colMax = pileMax.get(landCol);
      if(colMax!==undefined && landTopY<=colMax){
        kr.landed=true; kr.despawn=true;
        continue;
      }
      kr.landed=true;
      pile.push({x:landCol,y:landTopY});
      pileTop.set(landCol, landTopY-1);
    }
  }
  // remove despawned kernels
  popKernels=popKernels.filter(kr=>!kr.despawn);
  if(popKernels.length>200) popKernels.splice(0,popKernels.length-200);
}
// Tracks the original pile size set by initPile(); used to clamp growth.
function drawPopper(){
  const k=SCENE.popper, ket=k.kettle;
  let lidDX=0,lidDY=0;
  if(popState==='JIGGLE') lidDX=(popTimer%2)?1:-1;
  if(popState==='OPEN') lidDY=-6;
  if(popState==='CLOSE') lidDY=-6+Math.floor(popTimer/2);
  // settled popcorn pile — kernels are persistent; texture alternates
  // light/white based on (x+y) for a kernel-like read.
  for(const p of pile){
    px(p.x,p.y,((p.x+p.y)%3)?ix('s'):ix('i'));
  }
  rectPx(ket.x-9,ket.y-2,ket.x+9,ket.y+8,ix('r'));
  rectPx(ket.x-9,ket.y+6,ket.x+9,ket.y+8,ix('f'));
  rectPx(ket.x+9,ket.y+1,ket.x+12,ket.y+3,ix('r'));
  rectPx(ket.x-13,ket.y,ket.x-10,ket.y+2,ix('k'));
  rectPx(ket.x-9+lidDX,ket.y-5+lidDY,ket.x+9+lidDX,ket.y-2+lidDY,ix('z'));
  rectPx(ket.x-2+lidDX,ket.y-8+lidDY,ket.x+2+lidDX,ket.y-5+lidDY,ix('k'));
  for(const kr of popKernels){
    if(kr.landed) continue;
    px(Math.round(kr.x),Math.round(kr.y),(kr.life%2)?ix('i'):ix('s'));
  }
  // ── PLEXIGLASS DOORS over the popping chamber [#5] ──
  // Drawn last so they sit IN FRONT of the kettle/popcorn. Currently
  // always closed; `popperDoorOpen` (0..1) is wired so a future tweak can
  // animate them swinging OUTWARD toward the viewer.
  drawPopperGlassDoors(SCENE.popper, popperDoorOpen);
}

// popperDoorOpen: 0 = fully closed, 1 = fully open. Static at 0 for now,
// but the draw routine below already handles the open case so the doors
// can be animated later without reworking anything.
let popperDoorOpen=0;

// Draw the two clear plexiglass doors over the popper's popping chamber.
// They read as glass: a thin bright frame + faint diagonal shine, mostly
// see-through. Split down the middle into a left and a right door; each
// is hinged on its OUTER edge so they open outward, toward the viewer.
function drawPopperGlassDoors(k,openAmt){
  const f=k.chamberFront;
  const midX=(f.x0+f.x1)>>1;
  // a door's apparent width shrinks as it swings open toward us
  const closedW=midX-f.x0;
  const shownW=Math.max(2,Math.round(closedW*(1-0.85*openAmt)));
  // ── LEFT door — hinged at f.x0 ──
  drawOneGlassDoor(f.x0, f.x0+shownW, f.y0, f.y1, +1);
  // ── RIGHT door — hinged at f.x1 ──
  drawOneGlassDoor(f.x1-shownW, f.x1, f.y0, f.y1, -1);
  // centre seam where the two doors meet (only when closed)
  if(openAmt<0.05) vline2(midX,f.y0+1,f.y1-1,ix('o'));
}
// one glass door panel. handleSide +1 = handle on the right edge, -1 left.
function drawOneGlassDoor(x0,x1,y0,y1,handleSide){
  // glassy frame
  for(let x=x0;x<=x1;x++){ px(x,y0,ix('o')); px(x,y1,ix('o')); }
  for(let y=y0;y<=y1;y++){ px(x0,y,ix('o')); px(x1,y,ix('o')); }
  // faint diagonal shine streaks across the pane (the "plexiglass" read)
  for(let s=0;s<(x1-x0);s+=6)
    for(let t=0;t<5 && y0+2+s+t<=y1-1;t++)
      if(x0+2+s+t<=x1-1) px(x0+2+s+t,y0+2+s+t,ix('i'));
  // a small handle on the meeting edge
  const hx=(handleSide>0)?x1-2:x0+2;
  const hy=(y0+y1)>>1;
  px(hx,hy-1,ix('k')); px(hx,hy,ix('k')); px(hx,hy+1,ix('k'));
}
// tiny helper: a vertical line straight to the canvas
function vline2(x,y0,y1,i){ for(let y=y0;y<=y1;y++) px(x,y,i); }

// (d) concessionists — with the DOOR-EXIT sequence for left exits
// states: ENTER → STAND → EXIT (right: walk off) | DOOREXIT (left: door)
let crew=[], crewTimer=0;
let doorState='closed', doorTimer=0, doorExiter=null;
function spawnCrew(){
  const count=Math.random()<0.32?2:1;
  const spotsSingle=[176,300], spotsDouble=[[156,308]];
  crew=[];
  if(count===2){ const pr=spotsDouble[0];
    for(let i=0;i<2;i++) crew.push(mkCrew(pr[i],Math.random()<0.5)); }
  else crew.push(mkCrew(spotsSingle[(Math.random()*spotsSingle.length)|0],Math.random()<0.5));
}
function mkCrew(home,fromLeft){
  return { npc:makeCharacter(), state:'ENTER', timer:0, step:0, bob:0,
    dir:fromLeft?1:-1, x:fromLeft?-26:W+26, home,
    exitLeft:Math.random()<0.5 };
}
const DOORX=SCENE.door.x+SCENE.door.w-6;          // x the exiter aims for
function updateCrew(){
  // ── PAUSE during shorted flicker [#7] — when the lights short out,
  //    everyone freezes for the duration and looks up. No motion updates.
  if(isLookingUp()) return;
  crewTimer++;
  for(const c of crew){
    c.timer++;
    if(c.state==='ENTER'){
      if(c.timer%5===0) c.step=(c.step+1)%4;
      c.x+=c.dir*1.5;
      if((c.dir>0&&c.x>=c.home)||(c.dir<0&&c.x<=c.home)){
        c.x=c.home; c.state='STAND'; c.timer=0; c.step=0;
      }
    } else if(c.state==='STAND'){
      c.bob=(Math.floor(c.timer/22)%2===0)?0:1;
      if(c.timer>360+((Math.random()*240)|0)){
        c.timer=0; c.step=0;
        if(c.exitLeft){ c.state='TODOOR'; c.dir=-1; }
        else { c.state='EXIT'; c.dir=1; }
      }
    } else if(c.state==='EXIT'){           // right exit — walk off-screen
      if(c.timer%5===0) c.step=(c.step+1)%4;
      c.x+=c.dir*1.5;
      if(c.x>W+30) c.state='DONE';
    } else if(c.state==='TODOOR'){         // left exit — walk to the door
      if(c.timer%5===0) c.step=(c.step+1)%4;
      c.x+=c.dir*1.5;
      if(c.x<=DOORX){
        c.x=DOORX; c.state='DOOROPEN'; c.timer=0;
        doorState='opening'; doorTimer=0; doorExiter=c;
      }
    } else if(c.state==='DOOROPEN'){       // wait for the door to open
      if(doorState==='open'){ c.state='THRUDOOR'; c.timer=0; }
    } else if(c.state==='THRUDOOR'){       // step into the dark doorway
      if(c.timer%5===0) c.step=(c.step+1)%4;
      c.x-=1.4;
      if(c.x<SCENE.door.x+SCENE.door.w-14){
        // far enough in — now turn and head RIGHT, deeper into the back
        // room, and close the door behind them.
        c.state='INROOM'; c.timer=0; c.dir=1;
        c.roomX=c.x;                       // position inside the back room
        doorState='closing'; doorTimer=0;
      }
    } else if(c.state==='INROOM'){         // walk RIGHT inside the back room
      if(c.timer%5===0) c.step=(c.step+1)%4;
      c.roomX+=1.2;                        // recede to the right, behind the stand
      // they vanish once they pass the right edge of the doorway interior
      if(c.roomX>SCENE.door.x+SCENE.door.w+4) c.state='DONE';
    }
  }
  // door animation
  if(doorState==='opening'){ doorTimer++; if(doorTimer>14) doorState='open'; }
  else if(doorState==='closing'){ doorTimer++; if(doorTimer>14) doorState='closed'; }
  if(crew.length && crew.every(c=>c.state==='DONE')){
    if(crewTimer>70){ spawnCrew(); crewTimer=0; doorState='closed'; }
  }
}
// the door is redrawn each frame to reflect open/closed + the head-in-window.
// It is clipped at the front-counter top so it never paints over the counter.
function drawDoorOverlay(){
  const d=SCENE.door;
  const clipBot=SCENE.frontCtrTop;          // counter occludes below this
  // ── door visual state — a 2-frame opening animation ──
  // opening: closed → HALF → open ; closing: open → HALF → closed.
  let visState='closed';
  if(doorState==='open') visState='open';
  else if(doorState==='opening') visState=(doorTimer<7)?'half':'open';
  else if(doorState==='closing') visState=(doorTimer<7)?'open':'half';
  else visState='closed';
  drawStaffDoorCanvas(d, visState, clipBot);
  // ── [#7] when the exiter is INROOM they walk RIGHT, deeper into the
  //    back room, and disappear behind the concession stand. Their real
  //    sprite is drawn clipped to the door+window so only what shows
  //    through the glass is visible — a TALL concessionist's head reaches
  //    up into the window, a short one's does not.
  if(doorExiter && doorExiter.state==='INROOM'){
    // clip to the whole door interior (the window is the only see-through
    // part up top; the slab below hides the body) — drawStaffDoorCanvas
    // has already painted the closed slab, so we clip the sprite to the
    // WINDOW rectangle: whatever falls in the glass shows.
    CLIP_RECT={x0:d.winX0,y0:d.winY0,x1:d.winX1,y1:d.winY1};
    // feet set "deep" in the room: a tall (100px) figure's head reaches
    // the window, a standard (94px) one's stays just below it.
    const feetY=d.winY1+102;
    drawCharacterSide(doorExiter.npc, Math.round(doorExiter.roomX),
                      feetY, 1, doorExiter.step||0, H);
    CLIP_RECT=null;
  }
}
// canvas door. state: 'closed' | 'half' | 'open'. Clipped below clipBot.
function drawStaffDoorCanvas(d,state,clipBot){
  const {x,y,w,floorY}=d;
  const cp=(xx,yy,i)=>{ if(yy<clipBot) px(xx,yy,i); };
  const RECTC=(a,b,c,e,i)=>{ for(let yy=b;yy<=e;yy++)for(let xx=a;xx<=c;xx++) cp(xx,yy,i); };
  if(state==='open'){
    RECTC(x,y,x+w,floorY-1,ix('9'));
    drawBackRoom(cp, x+3,y+5,x+w-3,floorY-7, true);
    return;
  }
  if(state==='half'){
    // The handle is on the RIGHT edge of the slab, which means the door
    // HINGES on the LEFT and the handle-side (right) swings outward —
    // matching how a real interior door works. The half-open frame shows
    // a narrow teal slab tucked against the LEFT jamb (the hinge side),
    // with the doorway open on the RIGHT (where the handle was).
    RECTC(x,y,x+w,floorY-1,ix('9'));
    drawBackRoom(cp, x+3,y+5,x+w-3,floorY-7, true);
    // the half-open slab — a narrower teal panel hinged at the LEFT jamb
    const sw=Math.round(w*0.45);
    RECTC(x,y,x+sw,floorY-1,ix('v'));
    for(let yy=y;yy<floorY-1;yy++){ cp(x,yy,ix('w')); cp(x+sw,yy,ix('w')); }
    // ── window stays visible on the slab during the swing [#3] ──
    // The window is part of the door slab, so it must follow the slab as
    // it opens. The window's geometry is in door-coords; while half open
    // the slab is squeezed into the left 45%, so we draw a SCALED window
    // on the slab — clipped to the slab's current width.
    const wy0=d.winY0,wy1=d.winY1;
    const wWin=Math.max(4,Math.round((d.winX1-d.winX0)*0.45));
    const wx0=x+3, wx1=x+3+wWin;
    if(wx1<x+sw){
      RECTC(wx0-1,wy0-1,wx1+1,wy1+1,ix('a'));
      RECTC(wx0,wy0,wx1,wy1,ix('9'));
      // a glimpse of the back room through the squeezed window
      drawBackRoom(cp, wx0,wy0,wx1,wy1, false);
    }
    return;
  }
  // closed
  RECTC(x,y,x+w,floorY-1,ix('v'));
  for(let xx=x;xx<=x+w;xx++){ cp(xx,y,ix('w')); }
  for(let yy=y;yy<floorY-1;yy++){ cp(x,yy,ix('w')); cp(x+w,yy,ix('w')); }
  const wy0=d.winY0,wy1=d.winY1,wx0=d.winX0,wx1=d.winX1;
  RECTC(wx0-3,wy0-3,wx1+3,wy1+3,ix('k'));
  RECTC(wx0-2,wy0-2,wx1+2,wy1+2,ix('a'));
  drawBackRoom(cp, wx0,wy0,wx1,wy1, false);
  for(let k=0;k<9;k++){
    cp(wx0+2+k,wy0+1+k,ix('i'));
    if(k<6) cp(wx0+5+k,wy0+1+k,ix('o'));
  }
  RECTC(x+w-9,y+64,x+w-6,floorY-22,ix('o'));
}
function drawConcessionists(){
  // Concessionists stand BEHIND the front counter. The counter has an
  // oblique 3D top: its front lip is at FRONTCTR_TOP and the surface
  // recedes UP-screen 6px to a back edge at FRONTCTR_TOP-6. A person
  // behind the counter is hidden from that BACK edge down — so we clip
  // the sprite at FRONTCTR_TOP-6, not at FRONTCTR_TOP. Clipping at the
  // front lip (the old bug) let the body draw over the counter's depth
  // top face [#11].
  const COUNTER_DEPTH=6;
  const clipY=SCENE.frontCtrTop-COUNTER_DEPTH;   // counter's back-top edge
  const feetY=SCENE.frontCtrTop+44;              // head ≈ frontCtrTop-50
  for(const c of crew){
    if(c.state==='DONE'||c.state==='INROOM') continue;   // gone / behind door
    const walking=(c.state!=='STAND');
    // [#7] when looking up at the shorted lights, shift everyone's
    // sprite up 1px — implies head tilted upward toward the marquee.
    const lookY = isLookingUp() ? -1 : 0;
    if(walking) drawCharacterSide(c.npc,Math.round(c.x),feetY+lookY,c.dir,c.step,clipY);
    else        drawCharacterFront(c.npc,Math.round(c.x),feetY+lookY,c.bob,clipY);
  }
}

// (d2) sweepers — same sprite + broom/dustpan; walk a lane, occasionally
// stop and sweep. lane 'behind' = between counter & rope; 'front' = ahead.
let sweepers=[], sweepTimer=0;
// build a sweeper — always tall so even the "short" variant reads as a
// proper adult and never rides up onto the counter [#4].
function makeSweeper(fromLeft){
  const npc=makeCharacter();
  npc.tall=true;                                  // sweepers are never short
  return {
    npc, dir:fromLeft?1:-1, x:fromLeft?-30:W+30, step:0, timer:0,
    // Sweepers ALWAYS walk in the BEHIND-the-rope lane (between the rope
    // barrier and the counter). The 'front' lane (in front of the ropes)
    // was removed because a sweeper in front of the rope is supposed to
    // be the public side of the lobby [#5].
    lane:'behind',
    state:'WALK', sweepAt: 80+((Math.random()*220)|0), sweepPhase:0,
    kernels:[], swept:0,
  };
}
function maybeSpawnSweeper(){
  // Sweepers appear MUCH less frequently. The previous 460-840 frame
  // window has been roughly tripled to 1400-2400 frames (~25-40s at 60fps).
  sweepTimer++;
  if(sweepers.length<1 && sweepTimer>1400+((Math.random()*1000)|0)){
    sweepers.push(makeSweeper(Math.random()<0.5));
    sweepTimer=0;
  }
}
function updateSweepers(){
  // ── PAUSE during shorted flicker [#7] ──
  if(isLookingUp()) return;
  for(const s of sweepers){
    s.timer++;
    if(s.state==='WALK'){
      if(s.timer%6===0) s.step=(s.step+1)%4;
      s.x+=s.dir*1.1;
      if(s.sweepAt>0 && Math.abs(s.x-s.sweepAt)<2){
        // pick what they do at this spot: usually sweep, sometimes sigh
        if(Math.random()<0.4){
          s.state='SIGH'; s.timer=0; s.sighPhase=0; s.sweepAt=-1;
        } else {
          s.state='SWEEP'; s.timer=0; s.sweepPhase=0; s.sweepAt=-1;
          // drop 2-3 stray kernels on the floor ahead of the sweeper
          s.kernels=[];
          const n=2+((Math.random()*2)|0);
          for(let i=0;i<n;i++)
            s.kernels.push({ off: 8+i*5+((Math.random()*3)|0) });
          s.swept=0;
        }
      }
    } else if(s.state==='SWEEP'){
      s.sweepPhase++;
      s.swept=Math.min(1, s.sweepPhase/70);
      if(s.sweepPhase>90){ s.state='WALK'; s.timer=0; s.kernels=[]; }
    } else if(s.state==='SIGH'){
      // ── HEAVY SIGH animation (side-on). Shorter [#10]:
      //   0-20 : shoulders SLUMP
      //   20-45: hold the slumped pose
      //   45-65: straighten back up
      //   >70  : resume walking
      s.sighPhase++;
      if(s.sighPhase>70){ s.state='WALK'; s.timer=0; }
    }
  }
  sweepers=sweepers.filter(s=>s.x>-44&&s.x<W+44);
}
function drawSweepers(lane){
  for(const s of sweepers){
    if(s.lane!==lane) continue;
    // ── SWEEP LANE [#1] — based on a direct pixel probe of the rendered
    //    sprite at x=120: visible feet (bottom of legs) appear at y=fy-20,
    //    NOT fy-30 as the math suggested. To put visible feet at y≈275
    //    (in the strip between case bottom 258 and just below the pole
    //    base top 270, on the carpet just in front of the rope), set
    //    feetY = SCENE.floorY + 45 = 295. Shoes draw at fy-20 = 275.
    const feetY = SCENE.floorY + 45;
    const sweeping=(s.state==='SWEEP');
    const sighing=(s.state==='SIGH');
    // sigh slump offset
    let sighDrop=0;
    // ── SIGH HEAD-SHAKE [#11] — slow side-to-side turn of JUST the head
    //    (and neck) during the held-slump portion of the sigh. The body
    //    stays still; we pass headXShift to the sprite draw which shifts
    //    only the head/neck rows. Slow cycle (~30 frames per side) so it
    //    reads as a deliberate head turn, not a body jitter.
    let headXShift=0;
    if(sighing){
      const ph=s.sighPhase;
      // shorter timing [#10] — 70-frame sigh:
      //   0-20  slump   |  20-45 hold  |  45-65 straighten
      if(ph<20)      sighDrop=Math.round((ph/20)*1.5);
      else if(ph<45) sighDrop=2;
      else           sighDrop=Math.round(((65-ph)/20)*1.5);
      if(sighDrop<0) sighDrop=0;
      // slow head turn during the hold — one cycle ≈ 40 frames
      if(ph>=15 && ph<=55){
        headXShift = (Math.sin((ph-15)*Math.PI/20) > 0) ? 1 : -1;
      }
    }
    const drawX = Math.round(s.x);     // body stays still
    // [#7] sweeper looks up during shorted flicker — shift sprite up 1px
    const lookY = isLookingUp() ? -1 : 0;
    let anchors, facing;
    if(sweeping){
      // ── SWEEPING — face the viewer (front pose), arms reaching down
      //    and forward toward the work area. `facing=0` tells the props
      //    routine to draw a SHORT centered sweep (broom + dustpan reach
      //    only to just in front of the feet). [#4]
      anchors=drawCharacterSweepFront(s.npc, drawX, feetY+sighDrop+lookY,
                                       0, s.sweepPhase||0);
      facing=0;
    } else {
      // walking (or sighing): side pose
      const walkStep=sighing?0:s.step;
      anchors=drawCharacterSide(s.npc, drawX, feetY+sighDrop+lookY,
                                s.dir, walkStep, H, headXShift);
      facing=s.dir;
    }
    drawSweeperProps(s.npc, drawX, feetY+sighDrop+lookY, facing, anchors,
                     sweeping, s.sweepPhase||0, s.kernels, s.swept);

    // ── SIGH EMOTE — a small SWEATDROP beside the head during the sigh,
    //    signaling "tired/frustrated" in classic pixel-art shorthand.
    //    Drawn last so it sits over the body.
    if(sighing && s.sighPhase>=10 && s.sighPhase<=60){
      // sweatdrop is a small teardrop shape — a 1-2px wide blue blob
      // positioned just off the head on the side the figure is facing.
      const headX = anchors.headX || drawX;
      const headTopY = anchors.headTopY || (feetY+sighDrop-94);
      // emote position: slightly above the head and out to the side
      // (the side away from the body's direction, like a typical anime
      // sweatdrop). 1px bob to read as "trickling".
      const bob = Math.floor(s.sighPhase/3)%2;
      const ex = headX + (s.dir>0?6:-6);
      const ey = headTopY + 2 + bob;
      // teardrop shape: narrow top, fat bottom
      px(ex,   ey,   ix('h'));                // top point (lighter blue)
      px(ex-1, ey+1, ix('h')); px(ex, ey+1, ix('o')); px(ex+1, ey+1, ix('h'));
      px(ex-1, ey+2, ix('h')); px(ex, ey+2, ix('h')); px(ex+1, ey+2, ix('h'));
      px(ex,   ey+3, ix('h'));                // bottom point
    }
  }
}

// ── SPEECH (concessionist idle remarks) ──────────────────────────────────
// After IDLE_BEFORE_SPEAK frames of nothing happening, a random concessionist
// will pop a speech bubble holding one of the lines below for SPEECH_HOLD
// frames. EDIT THIS ARRAY to change what they say. The substitution `#N`
// (where N is 1..6) renders as the small menu-number digit, so you can tie
// remarks back to the menu items.
let speechText='', speechUntil=0;
const IDLE_BEFORE_SPEAK=520, SPEECH_HOLD=190;
let lastInteract=0;
const SPEECH_LINES=[
  "#1 is always a good place to start.",
  "New here? #1 will get you going.",
  "Not your first time? I'd go with #2.",
  "Pick #2 if you left off somewhere.",
  "#3 if you want to tweak the settings.",
  "Curious who made this? That's #4.",
  "Take your time. Just type a number.",
];
const SPEECH_BUTTON_LINE="Welcome in! Just type a number.";
function speechActive(){ return frameCount<speechUntil; }
function maybeSpeak(){
  if(frameCount-lastInteract<IDLE_BEFORE_SPEAK) return;
  if(speechActive()) return;
  if(!crew.find(c=>c.state==='STAND')) return;
  speechText=SPEECH_LINES[(Math.random()*SPEECH_LINES.length)|0];
  speechUntil=frameCount+SPEECH_HOLD;
  lastInteract=frameCount;
}
function triggerSpeech(){
  if(!crew.find(c=>c.state==='STAND')&&!crew[0]) return;
  speechText=SPEECH_BUTTON_LINE;
  speechUntil=frameCount+SPEECH_HOLD;
}
function wrapSpeech(text,maxPx){
  const words=text.split(' '), lines=[]; let cur='';
  for(const wd of words){
    const test=cur?cur+' '+wd:wd;
    if(smallTextWidth(test)<=maxPx) cur=test;
    else { if(cur) lines.push(cur); cur=wd; }
  }
  if(cur) lines.push(cur);
  return lines;
}
function drawSmallText(text,x0,y0,colorIdx){
  let x=x0;
  for(const ch of text){
    const glyph=FONT_SMALL[ch.toUpperCase()]||FONT_SMALL[' '];
    const gw=glyph[0].length;
    for(let r=0;r<5;r++)for(let c=0;c<gw;c++)
      if(glyph[r][c]==='1') px(x+c,y0+r,colorIdx);
    x+=gw+1;
  }
}
function drawSpeech(){
  // Speech bubble for the active concessionist. The bubble sits directly
  // ABOVE the speaker's head with a tail pointing down to them, so it
  // always clearly belongs to that character [#3].
  const c=crew.find(cc=>cc.state==='STAND')||crew[0];
  if(!c) return;
  const PAD=4,LINE_H=7,MAXW=130;
  const lines=wrapSpeech(speechText,MAXW);
  let txtW=0; for(const ln of lines) txtW=Math.max(txtW,smallTextWidth(ln));
  const bw=txtW+PAD*2, bh=lines.length*LINE_H+PAD*2-1;

  // the speaker's head top (concessionist sprite is 94px; feet at
  // frontCtrTop+44, so head ≈ frontCtrTop-50). Tail aims here.
  const speakerX=Math.round(c.x);
  const headTopY=SCENE.frontCtrTop-50;
  const TAIL=9;                                  // tail height in pixels

  // bubble centred over the speaker, kept on-screen
  let bx=Math.max(4,Math.min(W-bw-4,speakerX-(bw>>1)));
  let by=headTopY-TAIL-bh;                        // sits a tail's height above
  if(by<2) by=2;                                  // never run off the top
  const bottom=by+bh;

  // bubble body + border
  rectPx(bx,by,bx+bw,bottom,ix('i'));
  for(let x=bx;x<=bx+bw;x++){ px(x,by,ix('k')); px(x,bottom,ix('k')); }
  for(let y=by;y<=bottom;y++){ px(bx,y,ix('k')); px(bx+bw,y,ix('k')); }
  for(const [cxx,cyy] of [[bx,by],[bx+bw,by],[bx,bottom],[bx+bw,bottom]]) px(cxx,cyy,5);

  // ── TAIL — a real connecting tail from the bubble down to the speaker's
  //    head. Recomputed every frame, so it tracks a still-moving speaker.
  const rootX=Math.max(bx+5,Math.min(bx+bw-5,speakerX));   // tail root on bubble
  const tipX=speakerX;                                      // tail tip at head
  for(let s=0;s<=TAIL;s++){
    const t=s/TAIL;
    const cxp=Math.round(rootX+(tipX-rootX)*t);   // leans toward the speaker
    const halfW=Math.max(0,Math.round(3*(1-t)));  // tapers to a point
    for(let dx=-halfW;dx<=halfW;dx++) px(cxp+dx,bottom+s,ix('i'));
    px(cxp-halfW-1,bottom+s,ix('k')); px(cxp+halfW+1,bottom+s,ix('k'));
  }
  for(let dx=-3;dx<=3;dx++) px(rootX+dx,bottom,ix('i'));    // heal bubble edge

  for(let i=0;i<lines.length;i++)
    drawSmallText(lines[i],bx+PAD,by+PAD+i*LINE_H,5);
}

/* ════════════════════════════════════════════════════════════════════════
   7. LOOP + CONTROLS
   ════════════════════════════════════════════════════════════════════════ */
function loop(){
  frameCount++;
  if(drawOnActive){ stepDrawOn(); }
  else if(animOn){
    if(frameCount%5===0) cycleBulbs();
    updatePopper();
    updateCrew();
    maybeSpawnSweeper();
    updateSweepers();
    maybeSpeak();
    tickLightingState();
    drawInstant();
  }
  requestAnimationFrame(loop);
}
// ── TEST PANEL HANDLERS ─────────────────────────────────────────────
initPile();
spawnCrew();
startDrawOn();
loop();

// Expose a handful of methods on the namespace for the host to call.
_api.triggerFlicker = triggerFlicker;
_api.spawnCrew = spawnCrew;
_api.triggerSpeech = triggerSpeech;
_api.setCandyIntensity = (n)=>{ LIGHTS.candy = Math.max(0,Math.min(8,n)); };
_api.setNeonIntensity  = (n)=>{ LIGHTS.neon  = Math.max(0,Math.min(5,n)); };


    return _api;
  };

  return _api;
})();
