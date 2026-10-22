/* ════════════════════════════════════════════════════════════════════════════
 * LOCATION — THE GRANDE MULTIPLEX
 * ────────────────────────────────────────────────────────────────────────────
 * Screens that take place at the movie theatre / the player's workplace.
 *   - GAME_PLACEHOLDER : the lobby hub. Every Load/Continue lands here today, and
 *                        the tutorial runner falls back to it. It's still the
 *                        in-development placeholder (see docs/TODO.md BUG-5).
 *   (The pre-WAKE_UP Day-1 screens DAY1_COMMUTE / OUTSIDE_MULTIPLEX were removed
 *    2026-09-28; the arrival is now WAKE_UP → the parking lot → FIRST_SHIFT in
 *    core/tutorial.js.)
 *
 *   ╔═══════════════════════════════════════════════════════════════════╗
 *   ║  HOW TO EDIT THE WRITING                                          ║
 *   ║  Look for blocks marked    // ── EDIT THIS TEXT ──                ║
 *   ║  Just rewrite the strings — the renderer handles wrapping.        ║
 *   ╚═══════════════════════════════════════════════════════════════════╝
 * ════════════════════════════════════════════════════════════════════════════
 */

// The post-creation screen where the player lands. Theatre Lobby.
Screens.GAME_PLACEHOLDER = {
  render() {
    const c = State.character;
    State.world.subLocation = State.world.subLocation || 'Theatre Lobby';
    State.world.location    = State.world.location    || 'H3';
    startRoutineRound('lobby_' + State.world.dayNumber + '_' + State.world.hour);

    // ── EDIT THIS TEXT ─────────────────────────────────────────────────────
    // The body of the lobby screen.
    const body = [
      "You are in the lobby of The Grande Multiplex.",
      '',
      "The popcorn machine is on. The carpet is patterned and worn. There is one other employee at the concession counter.",
      '',
      "It is " + formatTime() + " on " + formatDate() + ".",
      formatDayNumber() + (c.name ? '. You are ' + escHTML(c.name) + ', ' + c.age + '.' : '.'),
      '',
      span('warn', '[ This is the demo lobby. Real content will live here. ]'),
    ];

    const content = [
      span('accent', 'Theatre Lobby'),
      '',
      ...body,
      '',
      span('accent', 'COMMANDS:'),
      actionLine('wait',  'wait 5 minutes',                                     false),
      actionLine('sheet', 'view your character sheet (or press F3)',            false),
      actionLine('log',   'view full event log',                                false),
      actionLine('debug', 'open the debug menu (launch minigames / Mapster)',   false),
      actionLine('menu',  'return to the title',                                false),
      actionLine('save',  'save your progress',                                 false),
    ];
    return renderGameplayUI({ gameText: content });
  },
  handle(text) {
    const t = text.trim().toLowerCase();
    if (t === 'sheet' || t === 'character' || t === 'cs') {
      State.charSheetReturn = 'GAME_PLACEHOLDER';
      sfx.select(); goto('CHARACTER_SHEET'); return;
    }
    if (t === 'log' || t === 'history') {
      State.logReturn = 'GAME_PLACEHOLDER';
      sfx.select(); goto('EVENT_LOG'); return;
    }
    if (t === 'debug' || t === 'dev') {
      State.debugReturn = 'GAME_PLACEHOLDER';
      sfx.select(); goto('DEBUG_MENU'); return;
    }
    if (t === 'menu' || t === 'back' || t === 'quit') { sfx.back(); MultiplexGame.hide(); return; }
    if (t === 'save') { saveSlot(); sfx.confirm(); flash('Saved.'); return; }
    if (t === 'wait' || t === '') {
      advanceTime(5);
      adjustRested(-1);
      logEvent('Waited. +5m, -1 rested.');
      sfx.enter(); render(); return;
    }
    sfx.error(); flash('Try "wait", "sheet", "log", "debug", "menu", or "save".');
  }
};
