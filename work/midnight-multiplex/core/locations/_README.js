/* ════════════════════════════════════════════════════════════════════════════
 * MIDNIGHT AT THE MULTIPLEX — LOCATIONS (modular)
 * ────────────────────────────────────────────────────────────────────────────
 * This folder holds one .js file per in-game location, each defining the
 * gameplay screens that take place there. Pulled out of core/game.js so each
 * place is easy to edit on its own.
 *
 * CURRENT FILES
 * ──────────────────────────────────────────────────────────────────────────
 *   _helpers.js   — shared helpers for location text: seasonLine, locFlavor,
 *                   hasHobby / hasClique, homeProfile (used by WAKE_UP).
 *   multiplex.js  — the movie theatre / workplace: GAME_PLACEHOLDER, the lobby
 *                   hub every Load lands on (still a placeholder).
 *
 * (The unreachable home / mall / school / bowling stubs and the old Day-1
 * commute screens were removed 2026-09-28 — see git history. To launch a
 * minigame from a location, call openMinigame('minigames/<file>.html', title)
 * after setting State.minigameReturn to your screen.)
 *
 * HOW TO WRITE A NEW LOCATION FILE
 * ──────────────────────────────────────────────────────────────────────────
 * Each file just attaches one or more entries to the global Screens object,
 * the same way game.js does. They load via <script> tags in midmulti.html
 * AFTER core/game.js, so all of game.js's helpers (renderGameplayUI, span,
 * goto, advanceTime, sfx, …) are already in scope. Skeleton:
 *
 *     Screens.MY_LOCATION_HERE = {
 *       render() {
 *         // SET STATE.WORLD.SUBLOCATION at the top so the autosave tripwire
 *         // (in render()) fires when the player arrives.
 *         State.world.subLocation = 'My Place';
 *         State.world.location    = 'A1';   // optional grid cell
 *
 *         // ───── EDIT THIS TEXT ─────────────────────────────────────────
 *         // Keep paragraphs short and concrete; the renderer wraps them
 *         // automatically to fit the UI panel.
 *         const content = [
 *           span('accent', 'My Place'),
 *           '',
 *           "Describe the room.",
 *           '',
 *           span('accent', 'COMMANDS:'),
 *           actionLine('wait',  'kill 5 minutes',                false),
 *           actionLine('leave', 'head somewhere else',           false),
 *         ];
 *         return renderGameplayUI({ gameText: content });
 *       },
 *       handle(text) {
 *         const t = text.trim().toLowerCase();
 *         if (t === 'wait' || t === '') { advanceTime(5); sfx.enter(); render(); return; }
 *         if (t === 'leave') { sfx.select(); goto('SOMEWHERE_ELSE'); return; }
 *         // Standard global commands every location should accept:
 *         if (t === 'sheet')  { State.charSheetReturn = 'MY_LOCATION_HERE'; goto('CHARACTER_SHEET'); return; }
 *         if (t === 'log')    { State.logReturn       = 'MY_LOCATION_HERE'; goto('EVENT_LOG');       return; }
 *         if (t === 'debug')  { State.debugReturn     = 'MY_LOCATION_HERE'; goto('DEBUG_MENU');      return; }
 *         if (t === 'save')   { saveSlot(); flash('Saved.'); return; }
 *         if (t === 'menu')   { sfx.back(); MultiplexGame.hide(); return; }
 *         sfx.error(); flash('Try "wait" or "leave".');
 *       }
 *     };
 *
 * Then add this file to the <script> list in midmulti.html.
 * ════════════════════════════════════════════════════════════════════════════
 */
