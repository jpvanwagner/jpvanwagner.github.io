/* ════════════════════════════════════════════════════════════════════════════
 * MIDNIGHT AT THE MULTIPLEX: CREDITS (portfolio web demo)
 * ────────────────────────────────────────────────────────────────────────────
 * PORTFOLIO EDIT: the full scrolling credits were removed from this web demo.
 * Title menu option 4 (or typing "credits") now shows a short "Coming soon"
 * card instead. Any key, or typing "back", returns to the title screen.
 * (If the demo is rebuilt from the game, this file is replaced by the real
 * credits again.)
 * ════════════════════════════════════════════════════════════════════════════
 */

Screens.CREDITS = {
  render() {
    // keep the title theme playing, as the real credits did
    try { if (window.TitleMusic && (!State.settings || State.settings.music !== false) && !window.TitleMusic.playing) window.TitleMusic.start(); } catch (e) {}
    _armCreditsExit();
    const W = TITLE_WIDTH;
    return header('CREDITS') + '\n\n\n\n' +
      center('C O M I N G   S O O N', W).replace('C O M I N G   S O O N', span('accent', 'C O M I N G   S O O N')) + '\n\n' +
      center('The full credits roll with the finished game.', W) + '\n\n\n' +
      center('press any key (or type "back") to return to the lobby', W);
  },
  handle(text) { _exitCredits(); }
};

// Any key backs out (debounced so the key that opened this screen doesn't close it)
let _creditsKeyHandler = null;
function _armCreditsExit() {
  if (_creditsKeyHandler) return;
  const openedAt = Date.now();
  _creditsKeyHandler = function (e) {
    if (Date.now() - openedAt < 300) return;
    e.preventDefault(); e.stopPropagation();
    _exitCredits();
  };
  document.addEventListener('keydown', _creditsKeyHandler, true);
}
function _exitCredits() {
  if (_creditsKeyHandler) { document.removeEventListener('keydown', _creditsKeyHandler, true); _creditsKeyHandler = null; }
  else return;
  try { sfx.back(); } catch (e) {}
  back();
}
// (other files may still call these from the old credits roll; keep them harmless)
function ensureCreditsRoll() {}
function removeCreditsRoll() {}
