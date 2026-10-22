#!/usr/bin/env node
/* ============================================================================
 *  tools/build_web_tools.js  —  public "web demo" builds of four side tools
 * ----------------------------------------------------------------------------
 *  Generates web/ (wiped and rebuilt every run — NEVER edit web/ by hand):
 *
 *    web/index.html          a small landing page with embed snippets
 *    web/mapster/            Mapster (map editor) + its 3D preview
 *    web/atlasworks/         Atlasworks (town atlas editor)
 *    web/timberlanes/        Cool Justin's Timber Lanes (bowling minigame)
 *    web/leafblower/         Theater Cleanup (leaf-blower minigame)
 *
 *  These are for Joe's website, NOT the game. Nothing here modifies a shipped
 *  file: every change is a string patch applied to a COPY while building.
 *  What the web builds change vs. the shipped tools:
 *
 *   - Self-contained. No CDN: Tailwind is precompiled (v3 CLI) and inlined,
 *     THREE.js r128 comes from vendor/three-r128/, win9x.css is inlined.
 *   - Locked down. Saving, exporting, opening local files, uploading audio
 *     and importing dialogue are removed (Mapster gets two built-in sample
 *     maps instead of LOAD PROJECT). A "WEB DEMO" tag explains the limits.
 *   - Polished for embedding. Fixed-size pages scale to fit an iframe, the
 *     games pause / ask for a click when the iframe loses focus, and a few
 *     web-only fixes (bowling scoring + setup dialog, labels) are applied.
 *   - Obfuscated. All JavaScript (inline and bundled) goes through
 *     javascript-obfuscator; HTML/CSS comments are stripped.
 *
 *  Usage:  npm run web        (needs the devDependencies: npm install)
 *
 *  HOW TO MODIFY
 *   - Each tool is one build*() function below. Patches use must(), which
 *     throws if its anchor text is missing — so if you edit a source tool
 *     and the build fails, update the anchor here to match.
 *   - Obfuscation strength: OBF_OPTS. Keep controlFlowFlattening OFF — the
 *     3D engine runs every frame and flattening makes it noticeably slower.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'web');
let JO;
try { JO = require('javascript-obfuscator'); }
catch (e) { console.error('javascript-obfuscator is missing — run `npm install` first.'); process.exit(1); }

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

// Replace exactly one occurrence of `a` (a literal string) — throw if absent.
// Uses a replacer FUNCTION so `$&` / `$1` in replacement text stay literal.
function must(s, a, b, label) {
  const i = s.indexOf(a);
  if (i < 0) throw new Error('patch anchor not found' + (label ? ' [' + label + ']' : '') + ': ' + a.slice(0, 90));
  return s.slice(0, i) + b + s.slice(i + a.length);
}

// ── OBFUSCATION ─────────────────────────────────────────────────────────────
// renameGlobals stays OFF: the pages call globals from inline onclick="…"
// attributes and across files. Strings move into an encoded array, locals
// get hex names, comments and whitespace go.
const OBF_OPTS = {
  compact: true, simplify: true,
  identifierNamesGenerator: 'hexadecimal', renameGlobals: false,
  stringArray: true, stringArrayEncoding: ['base64'], stringArrayThreshold: 0.75,
  stringArrayRotate: true, stringArrayShuffle: true, stringArrayIndexShift: true,
  stringArrayWrappersCount: 1, stringArrayWrappersType: 'variable',
  splitStrings: false, controlFlowFlattening: false, deadCodeInjection: false,
  selfDefending: false, debugProtection: false, numbersToExpressions: false,
  transformObjectKeys: false, unicodeEscapeSequence: false,
  target: 'browser', seed: 1999, sourceMap: false,
};
const obf = (code) => JO.obfuscate(code, OBF_OPTS).getObfuscatedCode();

const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n+/g, '\n');
const stripHtmlComments = (html) => html.replace(/<!--(?!\[)[\s\S]*?-->/g, '');

// Obfuscate every executable inline <script> (no src, JS type). JSON and
// text/plain blocks (map data, Mapster's export template) are left alone.
function obfuscateInline(html) {
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
    if (/\bsrc\s*=/.test(attrs)) return m;
    const t = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (t && !/^(text|application)\/javascript$/i.test(t[1])) return m;
    if (!body.trim()) return m;
    return '<script' + attrs + '>' + obf(body) + '</script>';
  });
}
// Inline <style> blocks: strip comments.
const cleanStyles = (html) => html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, a, css) => '<style' + a + '>' + stripCssComments(css) + '</style>');

function finishHtml(html) {
  return obfuscateInline(cleanStyles(stripHtmlComments(html)));
}

// ── SHARED WEB SHELL ────────────────────────────────────────────────────────
// Injected into every page (then obfuscated with the rest). Config comes from
// window.__WEB set just before it:
//   fit:      selector of a fixed-size element to scale to the viewport
//   fitMax:   max upscale (default 1.5)
//   lockFiles:true → block every <input type=file> + drag-drop, explain why
//   badge:    text for the small "WEB DEMO" tag (omit for none)
//   limits:   what the badge's popup lists
//   onBlur:   name of a global function to call when the embedded page loses focus
//   clickGate:true → "click to play" overlay until the first click (audio + focus)
const SHELL_CSS = `
#web-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(20px);opacity:0;z-index:2147483000;background:#101418;color:#fef3c7;border:2px solid #f59e0b;padding:9px 16px;font:bold 13px/1.35 'Courier New',monospace;box-shadow:0 6px 22px rgba(0,0,0,.6);transition:opacity .2s,transform .2s;pointer-events:none;max-width:86vw;text-align:center}
#web-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
#web-badge{position:fixed;right:8px;bottom:8px;z-index:2147482000;background:rgba(16,20,24,.86);color:#fbbf24;border:1px solid #f59e0b;font:bold 10px/1 'Courier New',monospace;letter-spacing:1px;padding:5px 7px;cursor:pointer;user-select:none}
#web-badge:hover{background:#f59e0b;color:#111}
#web-gate{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);cursor:pointer}
#web-gate div{border:2px solid #f59e0b;background:#0b0d10;color:#fbbf24;padding:18px 28px;text-align:center;font:bold 20px/1.4 'Courier New',monospace;letter-spacing:2px}
#web-gate small{display:block;color:#a7f3d0;font-size:12px;letter-spacing:1px;margin-top:6px}
`;
const SHELL_JS = `
(function(){
  var W = window.__WEB || {};
  var embedded = (function(){ try { return window.self !== window.top; } catch (e) { return true; } })();
  var css = document.createElement('style'); css.textContent = ${JSON.stringify(SHELL_CSS)}; document.head.appendChild(css);
  var toastEl = null, toastT = 0;
  function toast(msg, ms){
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'web-toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT);
    toastT = setTimeout(function(){ toastEl.classList.remove('on'); }, ms || 2600);
  }
  window.webNotice = toast;
  var LOCK = 'That\\u2019s turned off in the web demo.';
  // ---- badge
  if (W.badge) {
    var b = document.createElement('div'); b.id = 'web-badge'; b.textContent = W.badge; b.title = 'What the web demo leaves out';
    b.onclick = function(){ toast(W.limits || LOCK, 4200); };
    document.body.appendChild(b);
  }
  // ---- file lock: no local files in, nothing written out
  if (W.lockFiles) {
    var st = document.createElement('style');
    st.textContent = '[onclick*="\\').click()"]{display:none!important}';
    document.head.appendChild(st);
    var origClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function(){ if ((this.type || '').toLowerCase() === 'file') { toast(LOCK); return; } return origClick.apply(this, arguments); };
    document.addEventListener('click', function(e){ var t = e.target; if (t && t.tagName === 'INPUT' && (t.type || '').toLowerCase() === 'file') { e.preventDefault(); e.stopPropagation(); toast(LOCK); } }, true);
    ['dragover','drop'].forEach(function(ev){ window.addEventListener(ev, function(e){ if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); if (ev === 'drop') toast(LOCK); } }, true); });
  }
  // ---- scale a fixed-size layout to fit the viewport
  if (W.fit) {
    var el = document.querySelector(W.fit);
    if (el) {
      document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden';
      var nat = null;
      var fit = function(){
        if (!nat) { el.style.transform = 'none'; var r = el.getBoundingClientRect(); nat = { w: Math.ceil(r.width), h: Math.ceil(r.height) }; }
        var pad = W.fitPad == null ? 8 : W.fitPad;
        var s = Math.min((innerWidth - pad * 2) / nat.w, (innerHeight - pad * 2) / nat.h, W.fitMax || 1.5);
        s = Math.max(0.3, s);
        el.style.position = 'absolute'; el.style.margin = '0';
        el.style.left = Math.max(0, (innerWidth - nat.w * s) / 2) + 'px';
        el.style.top = Math.max(0, (innerHeight - nat.h * s) / 2) + 'px';
        el.style.transformOrigin = '0 0'; el.style.transform = 'scale(' + s + ')';
      };
      addEventListener('resize', fit); fit(); setTimeout(fit, 50);
    }
  }
  // ---- arrows / space never scroll an embedded game page
  if (W.game) {
    addEventListener('keydown', function(e){
      var t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].indexOf(e.key) >= 0) e.preventDefault();
    }, { passive: false });
  }
  // ---- click-to-play gate (focus + audio unlock inside an iframe)
  if (W.clickGate && embedded) {
    var g = document.createElement('div'); g.id = 'web-gate';
    g.innerHTML = '<div>\\u25B6 CLICK TO PLAY<small>' + (W.gateHint || '') + '</small></div>';
    document.body.appendChild(g);
    g.addEventListener('click', function(){ g.remove(); try { window.focus(); } catch (e) {} });
  }
  // ---- losing focus inside an iframe
  if (W.onBlur && embedded) {
    addEventListener('blur', function(){ setTimeout(function(){ if (!document.hasFocus() && typeof window[W.onBlur] === 'function') { try { window[W.onBlur](); } catch (e) {} } }, 60); });
  }
})();
`;
function shell(cfg) {
  return '<script>window.__WEB=' + JSON.stringify(cfg) + ';</script>\n<script>' + SHELL_JS + '</script>\n';
}
// the LAST </body>: Mapster's export template (a text/plain block) has its own
const injectBeforeBodyEnd = (html, add) => { const i = html.lastIndexOf('</body>'); if (i < 0) throw new Error('no </body>'); return html.slice(0, i) + add + html.slice(i); };

// favicon: a tiny inline SVG so pages don't 404 on /favicon.ico
const favicon = (emoji) => '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">' + emoji + '</text></svg>') + '">';
const headAdd = (html, add) => must(html, '</head>', add + '\n</head>', 'head end');
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';

// ════════════════════════════════════════════════════════════════════════════
//  1) COOL JUSTIN'S TIMBER LANES (bowling)
// ════════════════════════════════════════════════════════════════════════════
function buildTimberLanes() {
  let h = read('minigames/bowling_timberlanes.html');
  h = headAdd(h, VIEWPORT + favicon('🎳'));
  // ---- labels: the in-game shift header + the debug stat panel read oddly on a website
  h = must(h, `SHIFT: AUDITORIUM 3<br>
            <span style="font-size: 12px; color: #555555;">ATTENDANT STATION</span>`,
  `LANE 7 · LEAGUE NIGHT<br>
            <span style="font-size: 12px; color: #555555;">MIDNIGHT AT THE MULTIPLEX</span>`, 'bowling header');
  h = must(h, '<h4>[ RPG STAT TESTER ]</h4>', '<h4>[ BOWLER STATS ]</h4>');
  h = must(h, 'FINESSE (Spin Hook)', 'REFLEXES (Spin Hook)');
  // ---- layout: fit any iframe. The lane keeps its 7:9 shape at full height;
  // the sidebar narrows on small embeds instead of being cut off.
  h = must(h, '</style>', `
        #canvas-wrapper { width: auto; flex: 0 1 auto; }
        #canvas-wrapper canvas { height: 100%; width: auto; max-width: none; }
        /* the script "Cool Justin's" sat ON TOP of TIMBER at most sizes: lay the
           two words side by side instead (same neon styles) */
        #header-banner { display: flex; align-items: center; justify-content: center; gap: 14px; }
        .cursive-neon { position: static; transform: rotate(-8deg); margin-top: -6px; }
        .retro-neon { margin-top: 0; }
        @media (max-width: 900px) { #sidebar { width: 280px; padding: 10px; font-size: 13px; } .control-help { font-size: 10px; } .roll-box { width: 9px; font-size: 9px; } .frame-num { font-size: 8px; } }
        @media (max-width: 760px) { #sidebar { width: 220px; } .retro-neon { font-size: 30px; } .cursive-neon { font-size: 20px; } }
        @media (max-height: 640px) { #header-banner { height: 44px; padding-top: 8px; padding-bottom: 8px; } .retro-neon { font-size: 32px; } .cursive-neon { font-size: 22px; } .control-help { display: none; } }
        #web-setup { position: fixed; inset: 0; z-index: 500; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.78); }
        #web-setup.on { display: flex; }
        #web-setup .box { background: #000; border: 4px solid #FF55FF; box-shadow: 0 0 24px #AA00AA; padding: 18px 22px; min-width: 300px; color: #AAAAAA; }
        #web-setup h3 { margin: 0 0 12px; color: #55FFFF; text-align: center; letter-spacing: 2px; }
        #web-setup .row { display: flex; gap: 8px; align-items: center; margin: 8px 0; }
        #web-setup label { width: 34px; color: #FFFF55; font-weight: bold; }
        #web-setup input, #web-setup select { flex: 1; background: #000; color: #FFF; border: 2px solid #555; padding: 6px; font: bold 14px 'Courier New', monospace; text-transform: uppercase; }
        #web-setup .btns { display: flex; gap: 8px; margin-top: 14px; }
    </style>`, 'bowling css');
  // ---- in-page setup dialog instead of the browser's prompt() boxes
  h = must(h, '<div id="game-container">', `<div id="web-setup"><div class="box"><h3 id="ws-title">NEW GAME</h3>
    <div class="row" id="ws-r1"><label>P1</label><input id="ws-n1" maxlength="3" value="P1"><select id="ws-c1"><option>BLUE</option><option>RED</option><option>GREEN</option><option>PURPLE</option></select></div>
    <div class="row" id="ws-r2"><label>P2</label><input id="ws-n2" maxlength="3" value="P2"><select id="ws-c2"><option>RED</option><option>BLUE</option><option>GREEN</option><option>PURPLE</option></select></div>
    <div class="btns"><button id="ws-go">BOWL!</button><button id="ws-x">CANCEL</button></div></div></div>
<div id="game-container">`, 'setup dialog');
  // prompt() → answers queued by the dialog (shadows window.prompt for this page only)
  h = must(h, '// ==================== EGA PALETTES ====================', `let __webAnswers = [];
    const prompt = (q, d) => (__webAnswers.length ? __webAnswers.shift() : d);
    // ==================== EGA PALETTES ====================`, 'prompt shim');
  // ---- SCORING FIX 1: knocked pins are swept off after roll 1, so the pins
  // knocked THIS roll are exactly the ones lying down now. (The shipped code
  // also subtracted roll 1 → negative second-ball counts.)
  h = must(h, 'let officiallyKnocked = knockedThisRoll - previouslyKnocked;', 'let officiallyKnocked = Math.max(0, Math.min(10 - rackDown(p), knockedThisRoll)); void previouslyKnocked;', 'roll count');
  // ---- SCORING FIX 2: real ten-pin scoring (strike / spare bonuses).
  h = must(h, 'if (f.rolls.length > 0 && (is10th || f.rolls.length === 2 || f.rolls[0] === 10)) {', 'const fs = webFrameScore(p.frames, i);\n                if (fs !== null) {', 'frame scoring');
  h = must(h, 'cumulativeScore += f.rolls.reduce((a,b)=>a+b,0);', 'cumulativeScore += fs;', 'frame sum');
  h = must(h, '    // ==================== TRUE ELASTIC ANGULAR PHYSICS ====================', `    // pins already knocked down in the CURRENT rack before this roll (a 10th-frame
    // reset after a strike/spare starts a fresh rack at 0)
    function rackDown(p) {
        const r = p.frames[currentFrame].rolls;
        if (!r.length) return 0;
        if (currentFrame < 9) return r[0];
        if (r.length === 1) return r[0] === 10 ? 0 : r[0];
        if (r.length === 2) { if (r[0] === 10) return r[1] === 10 ? 0 : r[1]; return (r[0] + r[1] === 10) ? 0 : 10; }
        return 0;
    }
    // Ten-pin frame score, or null while it still waits on bonus balls.
    function webFrameScore(frames, i) {
        const f = frames[i], r = f.rolls;
        if (i === 9) { const done = r.length === 3 || (r.length === 2 && r[0] + r[1] < 10); return done ? r.reduce((a, b) => a + b, 0) : null; }
        const next = []; for (let k = i + 1; k < 10 && next.length < 2; k++) next.push(...frames[k].rolls);
        if (r[0] === 10) return next.length >= 2 ? 10 + next[0] + next[1] : null;
        if (r.length < 2) return null;
        if (r[0] + r[1] === 10) return next.length >= 1 ? 10 + next[0] : null;
        return r[0] + r[1];
    }
    function webTotal(p) { let t = 0; for (let i = 0; i < 10; i++) { const s = webFrameScore(p.frames, i); if (s === null) break; t += s; } return t; }
    // GAME OVER: show the result and wait for a mode button (the shipped game
    // silently restarted after 4 s, and a throw in that gap could hang it).
    let webGameOver = false;
    function showGameOver() {
        webGameOver = true; aiming = false; charging = false;
        let msg;
        if (players.length === 1) msg = webTotal(players[0]) + ' PTS';
        else { const a = webTotal(players[0]), b = webTotal(players[1]); msg = a === b ? 'TIE ' + a : ((a > b ? players[0].name : players[1].name) + ' WINS'); }
        const tv = document.getElementById('crt-tv'); const tvText = document.getElementById('crt-text');
        tvText.innerText = msg; tv.style.background = 'repeating-linear-gradient(45deg, #AA00AA, #AA00AA 10px, #000000 10px, #000000 20px)';
        tv.classList.add('active'); setTimeout(() => tv.classList.remove('active'), 4000);
        document.getElementById('turnIndicator').innerText = 'GAME OVER — PICK A MODE';
    }
    // ==================== TRUE ELASTIC ANGULAR PHYSICS ====================`, 'helpers');
  h = must(h, 'if (currentFrame >= 10) setTimeout(() => setupGame(players.length === 1 ? 0 : players[1].isAI ? 2 : 1), 4000);', 'if (currentFrame >= 10) showGameOver();', 'game over');
  h = must(h, '        activePlayerIndex = 0; currentFrame = 0; rollInFrame = 0;', '        activePlayerIndex = 0; currentFrame = 0; rollInFrame = 0; webGameOver = false; charging = false;', 'reset flag');
  h = must(h, "        if (!players[activePlayerIndex]?.isAI) {\n            const canBowl = canThrow();", "        if (webGameOver) { ctx.textAlign = 'center'; ctx.font = \"bold 18px 'Courier New', monospace\"; ctx.fillStyle = '#FF55FF'; ctx.fillText('GAME OVER — pick a mode to bowl again', canvas.width / 2, canvas.height - 8); ctx.textAlign = 'left'; }\n        else if (!players[activePlayerIndex]?.isAI) {\n            const canBowl = canThrow();", 'status line');
  // the total box must use the bonus-aware total
  h = must(h, '<div class="total-box">${cumulativeScore}</div>', '<div class="total-box">${webTotal(p)}</div>', 'total');
  // mode buttons open the dialog (practice stays one click)
  h = must(h, `    document.getElementById('mode2').onclick = () => setupGame(1);
    document.getElementById('mode3').onclick = () => setupGame(2);`, `    function openSetup(mode) {
        const two = mode === 1;
        document.getElementById('ws-title').innerText = two ? '2P HOTSEAT' : '1P VS AI';
        document.getElementById('ws-r2').style.display = two ? 'flex' : 'none';
        document.getElementById('web-setup').classList.add('on');
        document.getElementById('ws-n1').focus(); document.getElementById('ws-n1').select();
        document.getElementById('ws-go').onclick = () => {
            const v = (id) => document.getElementById(id).value;
            __webAnswers = two ? [v('ws-n1'), v('ws-c1'), v('ws-n2'), v('ws-c2')] : [v('ws-n1'), v('ws-c1')];
            document.getElementById('web-setup').classList.remove('on');
            setupGame(mode); __webAnswers = [];
        };
    }
    document.getElementById('ws-x').onclick = () => document.getElementById('web-setup').classList.remove('on');
    document.getElementById('web-setup').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') document.getElementById('ws-go').click(); if (e.key === 'Escape') document.getElementById('ws-x').click(); });
    document.getElementById('mode2').onclick = () => openSetup(1);
    document.getElementById('mode3').onclick = () => openSetup(2);
    // focus lost mid-charge (mouseup happened outside the iframe): cancel the charge
    window.webBlur = () => { charging = false; keys.left = keys.right = false; };`, 'mode buttons');
  // a release outside the canvas still throws; a charge never "sticks"
  h = injectBeforeBodyEnd(h, shell({ game: true, onBlur: 'webBlur', clickGate: true, gateHint: 'Mouse to aim · hold to power · release to throw' }));
  write('timberlanes/index.html', finishHtml(h));
}

// ════════════════════════════════════════════════════════════════════════════
//  2) THEATER CLEANUP (leaf blower)
// ════════════════════════════════════════════════════════════════════════════
function buildLeafblower() {
  let h = read('minigames/leafblower_cleanup.html');
  h = headAdd(h, VIEWPORT + favicon('🍂'));
  h = must(h, '<title>The Grande Theatre - Theater Cleanup</title>', '<title>Theater Cleanup — Midnight at the Multiplex</title>');
  // body padding is replaced by the fit-to-viewport scaler
  // tighter sidebar rows so a two-line HUD alert can't run into CONTROL DIRECTORY
  h = must(h, '</style>', '  html, body { height: 100%; } body { padding: 0; overflow: hidden; }\n  #shift-sidebar p { margin: 2px 0 !important; }\n  #hud-alert-line { margin-top: 6px !important; min-height: 28px !important; line-height: 1.25; }\n  </style>', 'leaf css');
  // pause with the game's own STAFF BREAK screen when the iframe loses focus
  // (a held key's keyup never arrives otherwise, and the shift clock keeps running)
  h = must(h, '// Kick off initial setup state', `window.webBlur = function () {
  // drop a held L (its keyup will never arrive) back to normal play, then pause
  if (State.phase === 'UNTANGLING') State.phase = 'PLAYING';
  State.isHoldingL = false; State.untangleAccumulatedMs = 0; State.untangleStartTs = 0;
  if (State.phase === 'PLAYING') toggleSimulationPauseState();
};
// Kick off initial setup state`, 'leaf blur');
  // the pause screen can also be dismissed with a click
  h = must(h, `    window.addEventListener('keydown', function unpauseCheck(e) {
      if (e.key.toLowerCase() === 'i' || e.key === 'Escape' || e.key.toLowerCase() === 'h') {`, `    const unpauseClick = function () { unpauseCheck({ key: 'Escape' }); };
    setTimeout(function () { modal.addEventListener('click', unpauseClick); }, 0);
    window.addEventListener('keydown', unpauseCheck);
    function unpauseCheck(e) {
      if (e.key.toLowerCase() === 'i' || e.key === 'Escape' || e.key.toLowerCase() === 'h') {
        modal.removeEventListener('click', unpauseClick);`, 'leaf unpause');
  h = must(h, `        RetroAudioEngine.syncBlowerEngineSound(State.powerLevel);
        updateInterfaceReadoutsPanel();
      }
    });
  }
}`, `        RetroAudioEngine.syncBlowerEngineSound(State.powerLevel);
        updateInterfaceReadoutsPanel();
      }
    }
  }
}`, 'leaf unpause end');
  h = must(h, 'Press [ESC] / [I] / [H] to resume cleaning!', 'Press [ESC] / [I] / [H] or click here to resume cleaning!');
  h = injectBeforeBodyEnd(h, shell({ game: true, fit: '#hardware-chassis', fitMax: 1.6, onBlur: 'webBlur' }));
  write('leafblower/index.html', finishHtml(h));
}

// ════════════════════════════════════════════════════════════════════════════
//  3) ATLASWORKS (town atlas editor)
// ════════════════════════════════════════════════════════════════════════════
function buildAtlasworks() {
  let h = read('Atlasworks/atlasworks.html');
  h = headAdd(h, favicon('🗺️'));
  h = must(h, '<button type="button" class="win95-button" onclick="exportMap()">Export File</button>', '', 'atlas export btn');
  h = must(h, '<option value="custom">Play Unique Sounds...</option>', '', 'atlas custom audio');
  h = must(h, `<button type="button" class="win95-button" style="width:100%" onclick="alert('File Picker modal placeholder'); STATE.poi.link='link.map';">Link Mapster File...</button>`, '', 'atlas link btn');
  // belt and braces: the functions themselves refuse too
  h = injectBeforeBodyEnd(h, `<script>
window.exportMap = function () { webNotice('Exporting is turned off in the web demo.'); };
window.loadCustomAudio = function () { webNotice('Custom audio is turned off in the web demo.'); };
</script>
` + shell({ lockFiles: true, badge: 'WEB DEMO', limits: 'Web demo: exporting, custom audio and Mapster links are turned off. Everything else works — paint away!' }));
  write('atlasworks/index.html', finishHtml(h));
}

// ════════════════════════════════════════════════════════════════════════════
//  4) MAPSTER (map editor + 3D preview)
// ════════════════════════════════════════════════════════════════════════════
const EDITOR_SCRIPTS = ['Mapster/core/helpManager.js', 'Mapster/core/fillTools.js', 'core/windowPainter.js', 'core/gameData.js', 'core/items.js', 'core/tokens.js', 'core/dialogueRuntime.js', 'core/cameraControls.js', 'vfx/skyboxManager.js', 'vfx/weatherManager.js', 'vfx/fogManager.js', 'vfx/lightingManager.js', 'vfx/rain.js', 'vfx/snow.js', 'textures/floor.js', 'textures/wall.js'];
// what the 3D preview loads (same order as Mapster's export template)
const RUNTIME_SCRIPTS = ['Mapster/core/helpManager.js', 'core/cameraControls.js', 'vfx/skyboxManager.js', 'vfx/lightingManager.js', 'vfx/fogManager.js', 'vfx/weatherManager.js', 'vfx/rain.js', 'vfx/snow.js', 'textures/floor.js', 'textures/wall.js', 'core/windowPainter.js', 'core/gameData.js', 'core/items.js', 'core/tokens.js', 'core/dialogueRuntime.js', 'core/engine.js'];
const SAMPLE_MAPS = [
  { key: 'parking_lot', label: 'Parking Lot (tutorial)', file: 'Mapster/maps/tutorial/parking_lot.html' },
  { key: 'sunrise', label: 'Sunrise Multiplex (2 floors)', file: 'Mapster/maps/tutorial/sunrise.html' },
];
const bundle = (files) => files.map(f => '/* ' + path.basename(f) + ' */\n' + read(f) + '\n;').join('\n');

function tailwindCss(html) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-tw-'));
  const page = path.join(tmp, 'page.html');
  fs.writeFileSync(page, html + '\n' + EDITOR_SCRIPTS.map(read).join('\n'));
  fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  fs.writeFileSync(path.join(tmp, 'tailwind.config.js'), 'module.exports = { content: [' + JSON.stringify(page) + '] };\n');
  const bin = path.join(ROOT, 'node_modules', '.bin', 'tailwindcss');
  cp.execFileSync(bin, ['-c', path.join(tmp, 'tailwind.config.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'pipe' });
  const css = fs.readFileSync(path.join(tmp, 'out.css'), 'utf8');
  fs.rmSync(tmp, { recursive: true, force: true });
  return css;
}

function buildMapster() {
  let h = read('Mapster/mapster.html');
  h = headAdd(h, favicon('🧱'));
  h = must(h, '<title>Mapster</title>', '<title>Mapster — Midnight at the Multiplex</title>');
  // ---- sidebar: no EXPORT, no LOAD PROJECT → PREVIEW + built-in sample maps
  h = must(h, `<button onclick="exportEngine(false)" class="flex-1 bg-emerald-600 hover:bg-emerald-500 p-2 rounded font-bold text-white text-xs shadow-lg border border-emerald-400">EXPORT</button>`, '', 'mapster export btn');
  h = must(h, `<button onclick="document.getElementById('importProject').click()" class="w-full bg-indigo-600 hover:bg-indigo-500 p-2 rounded font-bold text-white text-xs shadow-lg border border-indigo-400">LOAD PROJECT</button>`,
    `<select id="webSample" onchange="webLoadSample(this.value); this.value='';" class="w-full bg-indigo-600 hover:bg-indigo-500 p-2 rounded font-bold text-white text-xs shadow-lg border border-indigo-400 outline-none cursor-pointer"><option value="">LOAD A SAMPLE MAP…</option>${SAMPLE_MAPS.map(s => '<option value="' + s.key + '">' + s.label + '</option>').join('')}</select>`, 'mapster load btn');
  // ---- settings: hide export-only controls (the element stays: preview reads it)
  h = must(h, '<div class="w-48">\n                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Export Folder Depth</label>', '<div class="w-48" style="display:none">\n                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Export Folder Depth</label>', 'export depth');
  h = must(h, '<p class="text-[10px] text-emerald-400 italic mb-4 -mt-3">(Browsers may ignore subfolders on export.', '<p style="display:none">(', 'export note');
  // allow-scripts + allow-same-origin together is no sandbox at all — it only
  // printed a console warning. The preview runs our own code from our own origin.
  h = must(h, 'id="previewFrame" class="w-full flex-1 border-0 bg-black" sandbox="allow-scripts allow-same-origin"', 'id="previewFrame" class="w-full flex-1 border-0 bg-black"', 'preview sandbox');
  // ---- no CDN: compiled Tailwind + inlined win9x skin (Tailwind first, the skin wins)
  const tw = tailwindCss(h);
  h = must(h, '<script src="https://cdn.tailwindcss.com"></script>', '<style>' + tw + '</style>', 'tailwind');
  h = must(h, '<link rel="stylesheet" href="../theme/win9x.css">', '<style>' + stripCssComments(read('theme/win9x.css')) + '</style>', 'win9x');
  // ---- editor scripts → one obfuscated bundle
  let first = h.indexOf('<script src="./core/helpManager.js"></script>');
  const lastTag = '<script src="../textures/wall.js"></script>';
  let last = h.indexOf(lastTag);
  if (first < 0 || last < 0) throw new Error('mapster editor script block not found');
  h = h.slice(0, first) + '<script src="editor.js"></script>' + h.slice(last + lastTag.length);
  write('mapster/editor.js', obf(bundle(EDITOR_SCRIPTS)));
  // ---- 3D preview: the export template loads three + one runtime bundle from
  // this folder (the preview iframe gets <base href> = this page's folder)
  const tStart = h.indexOf('<scr__ipt src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></scr__ipt>');
  const tEndTag = '<scr__ipt src="__ROOT_PREFIX__core/engine.js"></scr__ipt>';
  const tEnd = h.indexOf(tEndTag);
  if (tStart < 0 || tEnd < 0) throw new Error('mapster template script block not found');
  h = h.slice(0, tStart) + '<scr__ipt src="three.min.js"></scr__ipt>\n<scr__ipt src="runtime.js"></scr__ipt>' + h.slice(tEnd + tEndTag.length);
  fs.copyFileSync(path.join(ROOT, 'vendor/three-r128/three.min.js'), path.join(OUT, 'mapster/three.min.js'));
  write('mapster/runtime.js', obf(bundle(RUNTIME_SCRIPTS)));
  // ---- samples + locks (runs after Mapster's own script, so it can wrap its functions)
  const samples = {}; SAMPLE_MAPS.forEach(s => { samples[s.key] = read(s.file); });
  write('mapster/samples.js', obf('window.__MAPSTER_SAMPLES = ' + JSON.stringify(samples) + ';'));
  h = injectBeforeBodyEnd(h, `<script src="samples.js"></script>
<script>
(function () {
  const realExport = exportEngine;
  // preview (exportEngine(true)) still works; saving a file does not
  window.exportEngine = function (isPreview) {
    if (!isPreview) { webNotice('Exporting is turned off in the web demo. Try PREVIEW!'); return Promise.resolve(null); }
    return realExport.apply(this, arguments);
  };
  window.importDialogueFile = function () { webNotice('Importing dialogue is turned off in the web demo.'); };
  window.loadAudioFile = function () { webNotice('Custom audio is turned off in the web demo.'); };
  window.webLoadSample = function (key) {
    const text = (window.__MAPSTER_SAMPLES || {})[key];
    if (!text) return;
    loadProject({ files: [new File([text], key + '.html', { type: 'text/html' })] });
  };
})();
</script>
` + shell({ lockFiles: true, badge: 'WEB DEMO', limits: 'Web demo: export, loading your own files, custom audio and dialogue import are turned off. Build away, then hit PREVIEW to walk your map in 3D!' }));
  write('mapster/index.html', finishHtml(h));
}

// ════════════════════════════════════════════════════════════════════════════
//  LANDING PAGE + README
// ════════════════════════════════════════════════════════════════════════════
const TOOLS = [
  { dir: 'mapster', name: 'Mapster', blurb: 'The map editor behind every room in the game. Paint floors, walls, doors and props, then PREVIEW to walk it in 3D.', w: 1280, h: 760, kind: 'Editor' },
  { dir: 'atlasworks', name: 'Atlasworks', blurb: 'The town-atlas editor: terrain, rivers, roads, districts, landmarks and bus routes.', w: 1280, h: 760, kind: 'Editor' },
  { dir: 'timberlanes', name: "Cool Justin's Timber Lanes", blurb: 'Bowling at the alley next door. Practice, hotseat a friend, or take on the CPU.', w: 960, h: 640, kind: 'Minigame' },
  { dir: 'leafblower', name: 'Theater Cleanup', blurb: 'Clear the auditorium between shows with a corded leaf blower before the manager inspects.', w: 960, h: 600, kind: 'Minigame' },
];
function buildLanding() {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cards = TOOLS.map(t => {
    const snip = `<iframe src="/multiplex-tools/${t.dir}/" width="${t.w}" height="${t.h}" style="border:0;max-width:100%" allow="autoplay; fullscreen" title="${t.name}"></iframe>`;
    return `<section><h2><a href="${t.dir}/">${esc(t.name)}</a> <small>${t.kind}</small></h2><p>${esc(t.blurb)}</p><pre>${esc(snip)}</pre></section>`;
  }).join('\n');
  write('index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8">${VIEWPORT}<title>Midnight at the Multiplex — tools &amp; minigames</title>${favicon('🎬')}
<style>body{margin:0;background:#0b0d10;color:#d1d5db;font:15px/1.55 Georgia,serif}main{max-width:860px;margin:0 auto;padding:28px 16px}h1{color:#fbbf24;font:bold 26px 'Courier New',monospace;margin:0 0 6px}h2{margin:26px 0 4px;font:bold 19px 'Courier New',monospace}h2 a{color:#67e8f9}small{color:#9ca3af;font-size:12px;letter-spacing:1px;text-transform:uppercase;margin-left:6px}pre{background:#111827;border:1px solid #374151;padding:10px;overflow:auto;font-size:12px;color:#a7f3d0;white-space:pre-wrap;word-break:break-all}</style></head>
<body><main><h1>Midnight at the Multiplex</h1><p>Web demos of the game's tools and minigames. Click a name to open it full-page, or paste the snippet into your own page. The snippets assume this folder is uploaded as <code>/multiplex-tools/</code>; change the path if you put it somewhere else.</p>
${cards}
<p style="margin-top:30px;color:#6b7280;font-size:13px">The editors work best full-page (open in a new tab) at 1280×720 or larger. The minigames are built to sit in an iframe.</p></main></body></html>
`);
}

function buildReadme() {
  write('README.txt', [
    'MIDNIGHT AT THE MULTIPLEX - web demos of the tools and minigames',
    '',
    'Upload this whole folder to your site (e.g. as /multiplex-tools/) and open',
    'index.html for links and copy-paste <iframe> snippets.',
    '',
    '  mapster/      map editor + 3D preview (two built-in sample maps)',
    '  atlasworks/   town atlas editor',
    '  timberlanes/  Cool Justin\'s Timber Lanes (bowling)',
    '  leafblower/   Theater Cleanup (leaf blower)',
    '',
    'Everything is self-contained: no CDN, no server code, works on Neocities.',
    'Turned off in these builds: exporting/saving, opening local files, custom',
    'audio, dialogue import, Mapster links. The editors are best opened',
    'full-page; the minigames are made to sit in an iframe.',
    '',
    'Generated by tools/build_web_tools.js (npm run web). Do not edit by hand.',
    '',
  ].join('\n'));
}

// ── RUN ─────────────────────────────────────────────────────────────────────
(function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  buildTimberLanes(); console.log('  timberlanes ok');
  buildLeafblower(); console.log('  leafblower ok');
  buildAtlasworks(); console.log('  atlasworks ok');
  buildMapster(); console.log('  mapster ok');
  buildLanding();
  buildReadme();
  let n = 0, bytes = 0;
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p); if (s.isDirectory()) walk(p); else { n++; bytes += s.size; } } })(OUT);
  console.log('web tools built: ' + n + ' files, ' + (bytes / 1048576).toFixed(2) + ' MB -> web/  (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
})();
