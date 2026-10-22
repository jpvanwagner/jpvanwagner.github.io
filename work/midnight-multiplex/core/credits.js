/* ════════════════════════════════════════════════════════════════════════════
 * MIDNIGHT AT THE MULTIPLEX — CREDITS SCREEN
 * ────────────────────────────────────────────────────────────────────────────
 * Location: midmulti/core/credits.js
 *
 * WHAT THIS IS
 * ──────────────────────────────────────────────────────────────────────────
 * The CREDITS screen. Reached from the title screen (menu option 4) or by
 * typing "credits" anywhere on the title.
 *
 * REQUIREMENTS (loaded from game.html before this file)
 * ──────────────────────────────────────────────────────────────────────────
 *   span(cls, text)      — wraps text in a colored span
 *   center(s, width)     — center-pads a string to a width
 *   header(title)        — section header builder
 *   TITLE_WIDTH          — global int (currently 92)
 *   Screens              — the screens map; we add Screens.CREDITS to it
 *   sfx.back(), back()   — UI helpers for the "back" action
 *
 * HOW TO EDIT
 * ──────────────────────────────────────────────────────────────────────────
 * Just rearrange / extend the rows in `render()` below. The pattern for each
 * line is:
 *     '   ' + A('ROLE TITLE') + '          Person\'s Name'
 * where:
 *   • The 3-space indent at the start keeps the text inside the frame.
 *   • A(...) is a local alias for span('accent', ...) — colors the role.
 *   • Right-side padding (the long run of spaces between role and name) is
 *     visual only; tweak by eye until it lines up in your monospace font.
 *
 * CENTERED LINES use C(...) which is an alias for center(s, TITLE_WIDTH).
 * That keeps the big title and brickroad shout aligned dead-center as the
 * frame width changes.
 *
 * MULTI-LINE NAMES (shout-outs): start the FIRST line with the role tag and
 * indent every subsequent line 26 spaces so they line up under the names.
 *
 * THE LINK at the bottom (brickroad.neocities.org) is shown verbatim because
 * the terminal can't make clickable links. If we ever introduce clickable
 * help links elsewhere, we can revisit this.
 *
 * ADDING A SECTION (e.g. a "TESTING TEAM" block):
 *   1. Add a row before the existing SHOUT-OUTS block.
 *   2. Indent and pad to match the surrounding lines.
 *   3. To group a section under a heading, use a blank line ('') as a spacer
 *      and then a centered subheading via `C(A('TITLE'))`.
 * ════════════════════════════════════════════════════════════════════════════
 */

Screens.CREDITS = {
  render() {
    // #15: keep the title theme rolling over the credits (entering this screen
    // from the title menu otherwise stops it).
    try { if (window.TitleMusic && (!State.settings || State.settings.music !== false) && !window.TitleMusic.playing) window.TitleMusic.start(); } catch (e) {}
    // Build the movie-style SCROLLING credits as a floated overlay (the ASCII
    // terminal can't smooth-scroll). The grid just shows a hint line.
    ensureCreditsRoll();
    const W = TITLE_WIDTH;
    return header('CREDITS') + '\n\n' +
      center('the reel is rolling \u2014 press SPACE (or type "back") to return to the lobby', W);
  },
  handle(text) { _exitCredits(); }
};

// #24: let ANY key (Space/Esc/Enter/…) back out of the credits — the on-screen
// hint promises SPACE works, but the terminal only calls handle() on a typed
// command, so we add a capture-phase keydown that exits. A short debounce stops
// the very keystroke that OPENED the credits from instantly closing them again.
let _creditsKeyHandler = null, _creditsOpenedAt = 0;
function _exitCredits() {
  const ov = document.getElementById('credits-overlay');
  if (!ov && !_creditsRAF && !_creditsKeyHandler) return;   // already exited
  removeCreditsRoll();
  try { sfx.back(); } catch (e) {}
  back();
}

// ── #15: scrolling-credits overlay ──────────────────────────────────────────
// A full-screen panel whose inner column scrolls smoothly upward like film
// credits, easing to a stop on the closing dedication. Built once; torn down
// when the player leaves. requestAnimationFrame drives the scroll so we can
// hold the final card instead of looping.
let _creditsRAF = null;
function removeCreditsRoll() {
  if (_creditsRAF) { cancelAnimationFrame(_creditsRAF); _creditsRAF = null; }
  if (_creditsKeyHandler) { window.removeEventListener('keydown', _creditsKeyHandler, true); _creditsKeyHandler = null; }
  const ov = document.getElementById('credits-overlay');
  if (ov) ov.remove();
}
function ensureCreditsRoll() {
  if (document.getElementById('credits-overlay')) return;
  const role = (r, who) => '<div style="margin:2px 0"><div style="color:#ffd86b;letter-spacing:2px;font-size:15px">' + r + '</div><div style="color:#e8e6dc;font-size:22px">' + who + '</div></div>';
  const big = (s) => '<div style="color:#ff8a3f;letter-spacing:3px;font-size:30px;margin:10px 0 6px">' + s + '</div>';
  const small = (s) => '<div style="color:#9fb0c0;font-size:17px;line-height:1.5;margin:2px 0">' + s + '</div>';
  const gap = (h) => '<div style="height:' + (h || 28) + 'px"></div>';

  const shoutNames = [
    'Bob Parsons', 'Matt Puckett', 'Matt Maguire', 'Matt Newhouse', 'Lani Stafford',
    'Lee Lott', 'Carrie Bembeneck', 'Scott Bembeneck', 'Jenn Bovee', 'Sara Baier',
    'CJ Kohler', 'Ryan Morse', 'Jackie Money', 'David Anderson', 'Kimberly Anderson',
    'Jacqueline Anderson', 'Adam Giacobazzi', 'Alicia Kik', 'Jacob Kobza', 'Amber Wheelock',
    'Joe Perkette', 'Joe Franks', 'James Taelman', 'Miyun Phelps', 'Jennifer Snyder',
    'John Snyder', 'Teresa Mork', 'Colin Tulloch', 'Jasen Hutchens', 'Corbin Tarrant',
    'George Kerasotes', 'Michelle Kerasotes', 'Jeff Chapin'
  ];

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  EDIT THE DEDICATION HERE — Joe, rewrite this freely.                  ║
  // ║  It's the last card the credits rest on. Each '...<br><br>' is a       ║
  // ║  paragraph break; the colored <span>s just tint a line. Keep it in     ║
  // ║  your own voice — the text below is only a stand-in.                   ║
  // ╚══════════════════════════════════════════════════════════════════════╝
  const dedication =
    '<div style="margin-top:18px;color:#ffe9c7;font-size:23px;line-height:1.7;max-width:620px">' +
    '<div style="color:#ff8a3f;letter-spacing:2px;font-size:20px;margin-bottom:14px">FOR EVERYONE I WORKED WITH AT THE THEATER</div>' +
    'You\u2019re the reason this exists. The late shifts, the dumb jokes, the people who turned into real friends \u2014 that\u2019s what I was trying to put back together here.<br><br>' +
    'Thank you. I miss you, and I love you all.<br><br>' +
    '<span style="color:#9fb0c0;font-size:19px">\u2014 Joe</span>' +
    '</div>';
  // ── end editable dedication ────────────────────────────────────────────────

  const html =
    big('MIDNIGHT&nbsp;&nbsp;AT&nbsp;&nbsp;THE&nbsp;&nbsp;MULTIPLEX') +
    gap(36) +
    role('DIRECTOR', 'Joe VanWagner') +
    role('PRODUCERS', 'Joe VanWagner &middot; Luke Sharrow') +
    role('WRITER', 'Joe VanWagner') +
    role('SCENARIO WRITERS', 'Joe VanWagner &middot; Luke Sharrow') +
    role('CHARACTER DESIGN', 'Joe VanWagner &middot; Luke Sharrow') +
    role('SETTING DESIGN', 'Joe VanWagner &middot; Luke Sharrow') +
    role('ART DIRECTION', 'Joe VanWagner') +
    role('ANIMATION', 'Anthropic Claude') +
    role('SOUND', 'Joe VanWagner &middot; Anthropic Claude') +
    role('PROGRAMMING', 'Joe VanWagner &middot; Anthropic Claude') +
    role('QUALITY ASSURANCE', 'Britney Cossey') +
    gap(30) +
    role('SPECIAL THANKS', 'Britney Cossey') +
    gap(30) +
    '<div style="color:#ffd86b;letter-spacing:2px;font-size:15px">SHOUT-OUTS</div>' +
    shoutNames.map(n => small(n)).join('') +
    gap(40) +
    '<div style="color:#ffd86b;letter-spacing:2px;font-size:18px">A BRICKROAD PRODUCTION</div>' +
    small('https://brickroad.neocities.org/') +
    gap(60) +
    dedication +
    gap(80);

  const ov = document.createElement('div');
  ov.id = 'credits-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:60;overflow:hidden;background:rgba(2,4,9,0.97);' +
    'display:flex;justify-content:center;pointer-events:none;' +
    'font-family:"GrandeTerm","Courier New",monospace;text-align:center;';
  const roll = document.createElement('div');
  roll.id = 'credits-roll';
  roll.style.cssText = 'position:absolute;width:90%;max-width:680px;left:50%;transform:translateX(-50%);top:0;';
  roll.innerHTML = html;
  ov.appendChild(roll);
  document.body.appendChild(ov);
  // #24: arm the "any key backs out" handler (debounced — see _exitCredits).
  _creditsOpenedAt = Date.now();
  _creditsKeyHandler = (e) => {
    if (Date.now() - _creditsOpenedAt < 500) return;   // ignore the keystroke that opened us
    e.preventDefault(); e.stopPropagation();
    _exitCredits();
  };
  window.addEventListener('keydown', _creditsKeyHandler, true);

  // Smooth upward scroll. Start fully below the viewport; ease to a stop with
  // the final dedication resting on-screen. ~42 px/sec feels filmic.
  const vh = ov.clientHeight || window.innerHeight || 600;
  let y = vh;                                  // start below the fold
  let last = null;
  const SPEED = 42;                            // px per second
  const step = (ts) => {
    if (!document.getElementById('credits-overlay')) { _creditsRAF = null; return; }
    if (last == null) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    const contentH = roll.scrollHeight;
    // hold-point: ease to a stop when the BOTTOM of the credits rests ~88% down
    // the screen, so the closing dedication lands and lingers on-screen.
    const endY = (vh * 0.88) - contentH;
    y -= SPEED * dt;
    if (y <= endY) y = endY;                   // ease to a gentle stop
    roll.style.top = y + 'px';
    _creditsRAF = requestAnimationFrame(step);
  };
  _creditsRAF = requestAnimationFrame(step);
}
