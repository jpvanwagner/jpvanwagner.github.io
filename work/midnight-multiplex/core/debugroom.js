/* ============================================================================
 *  core/debugroom.js  —  DEBUG ROOM + EXTERNAL LAUNCHERS + LIVE MAP VIEW
 * ----------------------------------------------------------------------------
 *  Split out of core/game.js (which was ~3.9k lines) to keep that file lean.
 *  This file is a plain top-level script (NOT an IIFE) and MUST load AFTER
 *  core/game.js, because it extends the SAME globals game.js declares:
 *    Screens, State, render(), goto(), flash(), sfx, Music, logEvent(),
 *    display, MAP_SCREENS, UI_* width constants, syncPlayerContext().
 *  It defines (all global, callable from game.js at runtime):
 *    LAUNCH_TARGETS, launchExternal()            — minigame/tool registry
 *    DEBUG_KEYWORDS, maybeOpenDebugRoom()         — the "debug" command hook
 *    openMapView/positionMapContainer/mountMapCanvas/unmountMapCanvas()
 *    openMinigame()/closeMinigame()               — the iframe overlay
 *    window.engineDebugAction / window.engineOnPlayerDamage  — engine→host hooks
 *    Screens.DEBUG_ROOM, Screens.DEBUG_ROOM_MAP, Screens.DEBUG_MENU
 *  Nothing else in the project references these by file; they're found as
 *  globals at call time, so the only requirement is load order (after game.js).
 * ========================================================================== */
//═══════════════════════════════════════════════════════════════════════════
// DEBUG: EXTERNAL LAUNCHERS  (minigames + Mapster)
//═══════════════════════════════════════════════════════════════════════════
//
// The minigames and the MAPSTER editor are standalone HTML files that live
// alongside this page. They aren't part of the terminal runtime — launching
// one navigates the browser to that file (in a new tab when the browser
// allows it, otherwise in this same tab).
//
// This registry is the single source of truth for what the DEBUG MENU can
// launch. To add another launchable target (a new minigame, a tool, a test
// harness), just add an entry here — the DEBUG_MENU screen builds its option
// list from this array automatically. No other code needs to change.
//
// Fields:
//   key   — short id, used for the typed command (e.g. "bowling")
//   label — what shows in the menu
//   path  — file path RELATIVE TO midmulti.html (the project root)
//   blurb — one-line description shown under the label
//
// NOTE ON PATHS: these are relative to midmulti.html. If you move this page
// or rename a folder, update the paths here. Current project layout:
//   midmulti.html                      (this page / project root)
//   minigames/bowling_timberlanes.html
//   minigames/leafblower_cleanup.html
//   Mapster/mapster.html
const LAUNCH_TARGETS = [
  { key: 'bowling',  label: "Cool Justin's Timber Lanes (bowling)",
    path: 'minigames/bowling_timberlanes.html', kind: 'minigame',
    blurb: 'The bowling minigame — eventually played at the bowling alley.' },
  { key: 'leafblower', label: 'The Grande Theatre — Cleanup (leafblower)',
    path: 'minigames/leafblower_cleanup.html',  kind: 'minigame',
    blurb: 'The leafblower cleanup minigame.' },
  { key: 'mapster',  label: 'MAPSTER — 3D level editor',
    path: 'Mapster/mapster.html', kind: 'external',
    blurb: 'The level-design tool. Opens in a new tab (editor, not gameplay).' },
  { key: 'saymaker', label: 'SAYMAKER — branching dialogue editor',
    path: 'Saymaker/saymaker.html', kind: 'external',
    blurb: 'Node-graph tool for authoring branching conversations. Opens in a new tab.' },
  { key: 'debugmap', label: 'DEBUG ROOM — authored test map',
    path: 'Mapster/maps/debug_room.html', kind: 'external',
    blurb: 'The hand-built test room: every door type, smashable windows, a lightswitch, neon, a patrol NPC, warp points & portals. Opens in a new tab.' },
];

// ── #18: DEBUG ROOM (engine-cooked) ──────────────────────────────────────
// Typing a keyword at ANY prompt (in-game, chargen, story crawl) opens this
// developer test room. It's intercepted at the command chokepoint in the
// keydown handler (see maybeOpenDebugRoom). The room is a place to test
// anything in-game: minigames, music, sounds, and locations. It auto-updates:
// it builds its minigame/tool list straight from LAUNCH_TARGETS, its music list
// from Music, and its sound list from sfx — so as features are added to those,
// the room reflects them with no extra wiring.
//
// To add a NEW testable feature: add it to LAUNCH_TARGETS (minigame/tool),
// to Music (a play* method), or to sfx (a named beep) and it shows up here.
const DEBUG_KEYWORDS = ['debug', 'debugroom', 'debug room', 'iddqd', 'xyzzy', 'sandbox'];
function maybeOpenDebugRoom(value) {
  const t = (value || '').trim().toLowerCase();
  if (IS_DEMO_BUILD()) return false;   // no dev sandbox in the public web demo (core/demo.js)
  if (DEBUG_KEYWORDS.includes(t)) {
    openDebugRoomFromMenu(State.screen);
    return true;
  }
  return false;
}

// open the debug room WITHOUT disrupting a game in progress. We snapshot
// the current character so any in-room respec can be reverted on exit,
// and if there's no character yet (entering from the title/settings before a
// game), we generate a throwaway random one so the player avatar + stat panel
// have something to show. The snapshot is restored by the map screen's exit.
function openDebugRoomFromMenu(returnScreen) {
  State.debugReturn = returnScreen || State.screen;
  State.mapReturn   = returnScreen || State.screen;
  // Snapshot character so the debug room can't permanently alter a live game.
  try { State._debugCharSnapshot = State.character ? JSON.parse(JSON.stringify(State.character)) : null; } catch (e) { State._debugCharSnapshot = null; }
  // Ensure SOME character exists for the avatar + stat panel.
  if (!State.character || !State.character.name) {
    if (typeof window.MultiplexChargen !== 'undefined' && window.MultiplexChargen.makeRandomCharacter) {
      State.character = window.MultiplexChargen.makeRandomCharacter();
    } else if (typeof randomizeWholeCharacter === 'function') {
      randomizeWholeCharacter();
    }
    State._debugTempChar = true;   // mark it throwaway
  }
  if (typeof sfx !== 'undefined') sfx.confirm();
  openMapView('Mapster/maps/debug_room.data.json', 'Debug Room', '__MAPDATA_debug_room');
}
// Expose for cross-module callers (e.g. chargen's respec-return, #14).
try { window.openDebugRoomFromMenu = openDebugRoomFromMenu; } catch (e) {}

Screens.DEBUG_ROOM = {
  render() {
    const lines = [];
    lines.push(header('★  DEBUG ROOM  —  developer sandbox'));
    lines.push('');
    lines.push('   ' + span('stat-name', 'Test anything in-game. This room auto-updates as'));
    lines.push('   ' + span('stat-name', 'features are added to the launch/music/sound tables.'));
    lines.push('');
    // Minigames + tools (from LAUNCH_TARGETS).
    lines.push('   ' + span('accent', 'MINIGAMES & TOOLS'));
    lines.push('   ' + span('accent', '─'.repeat(56)));
    for (const tgt of LAUNCH_TARGETS) {
      lines.push('   ' + span('accent', '[ ' + tgt.key + ' ]') + '  ' + span('menu-item', tgt.label));
      lines.push('       ' + span('stat-name', tgt.blurb));
    }
    lines.push('');
    // Music (any Music.play* method).
    lines.push('   ' + span('accent', 'MUSIC'));
    lines.push('   ' + span('accent', '─'.repeat(56)));
    const musicCmds = debugMusicCommands();
    for (const m of musicCmds) lines.push('   ' + span('accent', '[ ' + m.cmd + ' ]') + '  ' + span('menu-item', m.label));
    lines.push('   ' + span('accent', '[ music stop ]') + '  ' + span('menu-item', 'stop all music'));
    lines.push('');
    // Sounds (every sfx key).
    lines.push('   ' + span('accent', 'SOUNDS') + span('stat-name', '   (type: sfx <name>)'));
    lines.push('   ' + span('accent', '─'.repeat(56)));
    const sfxNames = (typeof sfx === 'object') ? Object.keys(sfx).filter(k => typeof sfx[k] === 'function') : [];
    lines.push('   ' + span('menu-item', sfxNames.join('   ')));
    lines.push('');
    // Locations / warp points (whatever the embedded engine map exposes).
    lines.push('   ' + span('accent', 'LOCATIONS / WARP POINTS'));
    lines.push('   ' + span('accent', '─'.repeat(56)));
    const wps = (typeof window !== 'undefined' && typeof window.engineWarpPoints === 'function') ? window.engineWarpPoints() : [];
    if (wps.length) {
      wps.forEach((w, i) => lines.push('   ' + span('accent', '[ warp ' + i + ' ]') + '  ' + span('menu-item', w.name) + span('stat-name', '  (' + w.x + ',' + w.z + ' f' + w.f + ')')));
    } else {
      lines.push('   ' + span('stat-name', '(no warp points — load a map with Warp Points to fast-travel)'));
    }
    lines.push('');
    lines.push('   ' + span('accent', '[ roommap ]') + '  ' + span('menu-item', 'load the debug room IN THIS UI (live 3D map)'));
    lines.push('   ' + span('accent', '[ back ]') + '   return to where you were');
    return lines.join('\n');
  },
  handle(text) {
    const t = text.trim().toLowerCase();
    if (t === 'back' || t === 'b' || t === '') { sfx.back(); goto(State.debugReturn || 'TITLE'); return; }
    // load the debug room as a LIVE map embedded in this UI.
    if (t === 'roommap' || t === 'map' || t === 'room') {
      sfx.confirm();
      State.mapReturn = 'DEBUG_ROOM';
      openMapView('Mapster/maps/debug_room.data.json', 'Debug Room', '__MAPDATA_debug_room');
      return;
    }
    // Launch targets.
    const tgt = LAUNCH_TARGETS.find(x => x.key === t);
    if (tgt) {
      sfx.confirm();
      if (tgt.kind === 'minigame') { State.minigameReturn = 'DEBUG_ROOM'; openMinigame(tgt.path, tgt.label); }
      else { launchExternal(tgt.path); }
      return;
    }
    // Music: "music <cmd>" or just "<cmd>".
    if (t.startsWith('music')) {
      const sub = t.replace(/^music\s*/, '').trim();
      if (sub === 'stop' || sub === '') { if (typeof Music !== 'undefined') Music.stop(); if (Array.isArray(window.MusicRegistry)) window.MusicRegistry.forEach(t => { try { t.stop && t.stop(); } catch (e) {} }); sfx.select(); flash('Music stopped.'); return; }
      const mc = debugMusicCommands().find(m => m.cmd === 'music ' + sub || m.sub === sub);
      if (mc) { sfx.select(); mc.run(); flash('Playing: ' + mc.label); return; }
    }
    const mcDirect = debugMusicCommands().find(m => m.cmd === 'music ' + t || m.sub === t);
    if (mcDirect) { sfx.select(); mcDirect.run(); flash('Playing: ' + mcDirect.label); return; }
    // Sounds: "sfx <name>".
    if (t.startsWith('sfx')) {
      const name = t.replace(/^sfx\s*/, '').trim();
      if (typeof sfx !== 'undefined' && typeof sfx[name] === 'function') { sfx[name](); flash('Played sfx: ' + name); return; }
      flash('No sound named "' + name + '".'); sfx.error(); return;
    }
    // Warp: "warp <n>".
    if (t.startsWith('warp')) {
      const n = parseInt(t.replace(/^warp\s*/, ''), 10);
      if (!isNaN(n) && typeof window.engineFastTravel === 'function') { window.engineFastTravel(n); sfx.confirm(); flash('Fast-travelled.'); return; }
      flash('Usage: warp <number>'); sfx.error(); return;
    }
    sfx.error(); flash('Unknown debug command. Type a bracketed keyword, or "back".');
  }
};
// Build the music command list from whatever Music exposes AND from the
// /music/ registry (auto-updating: any module in /music/ that registers a track
// appears here automatically — see music/README.md).
function debugMusicCommands() {
  const out = [];
  if (typeof Music !== 'undefined') {
    if (typeof Music.startTitle === 'function')      out.push({ cmd: 'music title',   sub: 'title',   label: 'Title theme (synth)',   run: () => Music.startTitle() });
    if (typeof Music.playStartJingle === 'function') out.push({ cmd: 'music jingle',  sub: 'jingle',  label: 'Start-of-game jingle',  run: () => Music.playStartJingle() });
  }
  // #12: the ACTUAL title-screen theme is window.TitleMusic and the opening-crawl
  // score is window.CrawlMusic — neither lived on the Music object, so they never
  // showed up here. List them explicitly.
  if (typeof window !== 'undefined' && window.TitleMusic && typeof window.TitleMusic.start === 'function') {
    out.push({ cmd: 'music titletheme', sub: 'titletheme', label: 'Title theme (full)', run: () => { try { window.TitleMusic.start(); } catch (e) {} } });
  }
  if (typeof window !== 'undefined' && window.CrawlMusic && typeof window.CrawlMusic.start === 'function') {
    out.push({ cmd: 'music crawl', sub: 'crawl', label: 'Opening-crawl music', run: () => { try { window.CrawlMusic.start(); } catch (e) {} } });
  }
  // /music/ registry — each track self-registered { id, label, start, stop }.
  if (typeof window !== 'undefined' && Array.isArray(window.MusicRegistry)) {
    for (const trk of window.MusicRegistry) {
      if (!trk || typeof trk.start !== 'function') continue;
      out.push({ cmd: 'music ' + trk.id, sub: trk.id, label: trk.label || trk.id, run: () => trk.start() });
    }
  }
  return out;
}

// ── #12: LIVE MAP VIEW (embedded engine canvas) ──────────────────────────────
// A map renders as a real 3D engine canvas mounted over the MID-UPPER region of
// the in-game frame, with a description box below it (mapMode in
// renderGameplayUI) and the minimap toggleable in the upper-right.
//
//   openMapView(dataUrl, title) — fetch a map's JSON, stash it, go to the
//                                 DEBUG_ROOM_MAP screen (which mounts the canvas).
//   mountMapCanvas()            — inject #map-data, position #game-container over
//                                 the MID-upper cells, boot/refit the engine.
//   unmountMapCanvas()          — hide the canvas + tear the engine down.
//
// The engine reads its map from a #map-data JSON element and exposes
// window.engine* hooks (engineResize, engineWarpPoints, …). We can only run one
// engine instance per page (it has a single-init guard + window-level
// listeners), so leaving a map screen tears it down.
State.mapData = null;
State.mapTitle = '';

// on MAP screens, flash() appends BELOW the UI frame (ugly stacking like
// ">> ♪ confirm"). Debug feedback should go to the LOG panel instead. This
// helper logs to the event log on map screens (and re-renders so it shows),
// and falls back to a normal flash elsewhere.
function mapFlash(msg) {
  const onMap = (typeof MAP_SCREENS !== 'undefined') && MAP_SCREENS.has(State.screen);
  if (onMap && typeof logEvent === 'function') {
    logEvent(msg);
    // Re-render so the LOG panel updates — but not while the dialogue overlay
    // is open (the LOG is hidden behind it and re-rendering every sound press
    // is wasteful; it'll refresh on the next natural render).
    if (!(typeof window.__debugDialogueActive === 'function' && window.__debugDialogueActive())) {
      try { render(); } catch (e) {}
    }
  } else if (typeof flash === 'function') {
    flash(msg);
  }
}


// We keep HP on the character (default 10) and surface a flash + log entry.
window.engineOnPlayerDamage = function (amount, reason) {
  try {
    const c = State.character || (State.character = {});
    if (typeof c.hp !== 'number') c.hp = (typeof c.maxHp === 'number' ? c.maxHp : 10);
    c.hp = Math.max(0, c.hp - (amount || 0));
    if (window.playerContext) window.playerContext.hp = c.hp;
    if (typeof mapFlash === 'function') mapFlash('Ouch! −' + amount + ' HP' + (reason ? ' (' + reason + ')' : '') + '  ·  HP ' + c.hp);
    if (typeof logEvent === 'function') logEvent('Took ' + amount + ' damage' + (reason ? ' — ' + reason : '') + '.');
  } catch (e) { console.error('engineOnPlayerDamage failed:', e); }
};

// the engine reports the currently-faced NPC (or null when the player turns
// away) so the host can show that NPC's info in the terminal NPC/REL panels
// instead of the floating overlay. We map the engine meta into the panel shape
// renderGameplayUI expects and re-render the map screen.
window.engineOnFocusNpc = function (meta) {
  try {
    const newKey = meta ? ((meta.name || 'NPC') + '|' + (meta.npcClique || '')) : null;
    if (newKey === State._focusNpcKey) return;   // no change → nothing to do
    State._focusNpcKey = newKey;
    if (!meta) {
      State.focusNpc = null;
    } else {
      const rel = computeRelationshipToPlayer ? computeRelationshipToPlayer(meta) : null;
      State.focusNpc = { name: meta.name || 'NPC', age: meta.npcAge || null, clique: meta.npcClique || null, stats: meta.stats || null, relationship: rel };
    }
    // #2 FIX (blink + can't-type): re-rendering the whole terminal on every
    // focus change fought with the input prompt (closing it mid-keystroke) and
    // could flicker when focus toggled near a vision-cone edge. We now:
    //   • never re-render while the dialogue overlay is open (you're talking),
    //   • never re-render while the player is actively typing a command,
    //   • debounce the rest so a stable focus settles into ONE re-render.
    if (typeof window.__debugDialogueActive === 'function' && window.__debugDialogueActive()) return;
    if (typeof PromptState !== 'undefined' && PromptState.open) return;
    if (!(typeof MAP_SCREENS !== 'undefined' && MAP_SCREENS.has(State.screen))) return;
    clearTimeout(State._focusRenderTimer);
    State._focusRenderTimer = setTimeout(() => {
      // Re-check guards at fire time (state may have changed during the wait).
      if (typeof window.__debugDialogueActive === 'function' && window.__debugDialogueActive()) return;
      if (typeof PromptState !== 'undefined' && PromptState.open) return;
      if (typeof MAP_SCREENS !== 'undefined' && MAP_SCREENS.has(State.screen)) render();
    }, 180);
  } catch (e) { console.error('engineOnFocusNpc failed:', e); }
};

// derive a light relationship readout between the player and an NPC from
// shared hobbies / clique. (A full reputation system can replace this later.)
function computeRelationshipToPlayer(meta) {
  const c = State.character;
  if (!c) return null;
  const rel = {};
  if (meta.npcClique && c.clique) {
    rel.clique = meta.npcClique;
    if (meta.npcClique === c.clique) rel.tag = 'same clique';
  }
  // Shared hobbies, if the NPC sheet records any.
  if (Array.isArray(meta.hobbies) && Array.isArray(c.hobbies)) {
    const shared = meta.hobbies.filter(h => c.hobbies.includes(h));
    if (shared.length) rel.commonHobbies = shared;
  }
  return Object.keys(rel).length ? rel : { tag: 'stranger' };
}

// #1b: debug-room NPCs call this when interacted with (engine → host). Actions:
//   'minigame:<path>'  launch a minigame in the overlay
//   'music:crawl'      play the opening-crawl music
//   'sound:<name>'     play a named sfx (confirm/back/error/select/type)
//   'sheet'            open the character sheet
//   anything else      flashed as-is
window.engineDebugAction = function (action, label) {
  const a = String(action || '');
  try {
    if (a.startsWith('minigame:')) {
      const path = a.slice('minigame:'.length);
      State.minigameReturn = 'DEBUG_ROOM_MAP';
      openMinigame(path, label || 'Minigame');
      return;
    }
    if (a.startsWith('music:')) {
      const which = a.slice('music:'.length);
      if (which === 'stop') { try { if (window.CrawlMusic) window.CrawlMusic.stop(); } catch (e) {} try { if (typeof Music !== 'undefined' && Music.stop) Music.stop(); } catch (e) {} mapFlash('\u25A0 music stopped'); return; }
      if (which === 'crawl' && window.CrawlMusic) { window.CrawlMusic.start(); mapFlash('\u25B6 crawl music'); return; }
      if (which === 'jingle' && typeof Music !== 'undefined' && Music.playStartJingle) { Music.playStartJingle(); mapFlash('\u25B6 jingle'); return; }
      return;
    }
    if (a.startsWith('sound:')) {
      const s = a.slice('sound:'.length);
      if (typeof sfx !== 'undefined' && typeof sfx[s] === 'function') { sfx[s](); mapFlash('♪ ' + s); }
      else mapFlash('no such sound: ' + s);
      return;
    }
    if (a === 'sheet') { State.charSheetReturn = State.screen; goto('CHARACTER_SHEET'); return; }   // record the return screen — without it, "back" followed a null/stale return into a dead screen
    // world controls (debug room outdoor area).
    if (a.startsWith('weather:')) { const t = a.slice(8); if (window.engineSetWeather) window.engineSetWeather(t); mapFlash('weather: ' + t); return; }
    if (a.startsWith('time:'))    { const h = parseInt(a.slice(5), 10) || 12; if (window.engineSetTimeOfDay) window.engineSetTimeOfDay(h); mapFlash('time set to ' + h + ':00'); return; }
    if (a === 'fog:on')   { if (window.engineSetFog) window.engineSetFog({ enabled: true, color: State._fogColor || '#888888', density: 25 }); mapFlash('fog on'); return; }
    if (a === 'fog:off')  { if (window.engineSetFog) window.engineSetFog({ enabled: false }); mapFlash('fog off'); return; }
    if (a.startsWith('fogcolor:')) { State._fogColor = a.slice(9); if (window.engineSetFog) window.engineSetFog({ enabled: true, color: State._fogColor, density: 25 }); mapFlash('fog color ' + State._fogColor); return; }
    // restedness controls. "rest:100" sets an absolute value; "rest:+40" or
    // "rest:-25" adjust relative. Uses the host's setRested helper so the status
    // bar (RESTED/TIRED) updates immediately.
    if (a.startsWith('rest:')) {
      const arg = a.slice(5);
      const cur = (State.world && typeof State.world.rested === 'number') ? State.world.rested : 100;
      let target;
      if (arg[0] === '+' || arg[0] === '-') target = cur + parseInt(arg, 10);
      else target = parseInt(arg, 10);
      if (isNaN(target)) target = cur;
      target = Math.max(0, Math.min(100, target));
      // adjustRested() applies the delta with the proper audio/flash feedback.
      if (typeof adjustRested === 'function') adjustRested(target - cur);
      else if (State.world) State.world.rested = target;
      mapFlash('restedness: ' + target);
      return;
    }
    // respec — re-run chargen for the CURRENT character. The debug-room
    // snapshot (taken on entry) restores the original on exit, so this is safe.
    if (a === 'respec') {
      sfx.confirm();
      // Leave the map cleanly, then open the character sheet (keeps _debugCharSnapshot).
      // REVIEW "start" sees _respecFromDebug and brings you back here; CHARSHEET
      // "back" cancels the respec (respecReturn(true) restores the snapshot).
      if (typeof unmountMapCanvas === 'function') unmountMapCanvas();
      State._respecFromDebug = true;
      State.character = (window.MultiplexChargen && window.MultiplexChargen.blankCharacter)
        ? window.MultiplexChargen.blankCharacter() : State.character;
      goto('CHARSHEET');
      return;
    }
    mapFlash('Debug: ' + a);
  } catch (e) { console.error('engineDebugAction failed:', e); }
};

function openMapView(dataUrl, title, globalKey) {
  // Prefer a preloaded global (file:// safe); fall back to fetch.
  const g = globalKey && window[globalKey];
  if (g) {
    State.mapData = g;
    State.mapTitle = title || 'Map';
    goto('DEBUG_ROOM_MAP');
    return;
  }
  fetch(dataUrl)
    .then(r => r.json())
    .then(data => {
      State.mapData = data;
      State.mapTitle = title || 'Map';
      goto('DEBUG_ROOM_MAP');
    })
    .catch(err => {
      console.error('openMapView failed:', err);
      flash('Could not load the map data file.');
    });
}

// Position #game-container over the MID-UPPER region of the rendered frame, by
// measuring the <pre> character cell size and the MID column offset.
function positionMapContainer() {
  const gc = document.getElementById('game-container');
  if (!gc) return;
  const pre = display;             // the <pre id="display">
  if (!pre) return;
  const preRect = pre.getBoundingClientRect();
  // Measure one character cell: width via a temporary span, height via line.
  const cs = getComputedStyle(pre);
  const fontSize = parseFloat(cs.fontSize) || 16;
  const lineH = parseFloat(cs.lineHeight) || (fontSize * 1.2);
  // Monospace char width ≈ measure 'M' repeated.
  const meas = document.createElement('span');
  meas.style.cssText = 'visibility:hidden;position:absolute;white-space:pre;font-family:' + cs.fontFamily + ';font-size:' + cs.fontSize;
  meas.textContent = '0'.repeat(100);
  document.body.appendChild(meas);
  const charW = meas.getBoundingClientRect().width / 100;
  document.body.removeChild(meas);
  // The frame's MID column starts after: left wall(1) + LEFT(UI_LEFT_W) + div(1).
  // Rows: top frame(1) + top bar(1) + divider(1) = 3 rows before the body.
  const padLeft = parseFloat(cs.paddingLeft) || 0;
  const padTop = parseFloat(cs.paddingTop) || 0;
  const midColStart = 1 + UI_LEFT_W + 1;          // chars from left edge
  const bodyRowStart = 3;                          // rows from top
  const x = preRect.left + padLeft + midColStart * charW;
  const y = preRect.top + padTop + bodyRowStart * lineH;
  // the map sat ~1 char into the right divider. Inset the width by ~0.6 of a
  // character (and floor it) so the canvas stays strictly inside the MID column,
  // never painting over the divider on the right.
  const INSET = charW * 0.6;
  const w = Math.max(0, (UI_MID_W * charW) - INSET);
  // #2: cover the top/bottom UI divider that sits ONE row below the top half —
  // it was peeking out as a horizontal line across the bottom of the game window.
  // Extend the canvas down by one row so the map fills right down to the
  // description (the description lives BELOW that divider, so it's unaffected).
  const h = (UI_TOP_HALF + 1) * lineH;
  gc.style.left = Math.round(x) + 'px';
  gc.style.top = Math.round(y) + 'px';
  gc.style.width = Math.floor(w) + 'px';
  gc.style.height = Math.round(h) + 'px';
}

let _mapMounted = false;
function mountMapCanvas() {
  if (!State.mapData) return;
  const gc = document.getElementById('game-container');
  if (!gc) return;
  // a prior unmount set inline `display:none` on the container. The CSS
  // class body.map-screen would show it, but the INLINE style wins and keeps it
  // hidden — so the engine inits against a 0×0 container and renders black. Make
  // sure the map-screen class is on and clear the inline display BEFORE we size
  // or boot the engine.
  document.body.classList.add('map-screen');
  gc.style.display = 'block';
  // #1c: make the player's stats/hobbies available to the engine (breakable
  // windows, vault checks, dialogue conditions all read window.playerContext).
  try { if (typeof syncPlayerContext === 'function') syncPlayerContext(); } catch (e) {}
  // (Re)position the container over the MID-upper region.
  positionMapContainer();
  if (_mapMounted) { if (window.engineResize) window.engineResize(); return; }
  // Inject the #map-data JSON element the engine reads on init.
  let dataEl = document.getElementById('map-data');
  if (!dataEl) {
    dataEl = document.createElement('script');
    dataEl.type = 'application/json';
    dataEl.id = 'map-data';
    document.body.appendChild(dataEl);
  }
  dataEl.textContent = JSON.stringify(State.mapData);
  // Boot the engine (guarded against double-init internally).
  try {
    window.__midmultiEngineStarted = false;   // allow a fresh boot for this view
    if (typeof initEngine === 'function') initEngine();
    _mapMounted = true;
  } catch (e) {
    console.error('engine init failed:', e);
    flash('The 3D engine could not start.');
  }
  // Refit after layout settles.
  requestAnimationFrame(() => { positionMapContainer(); if (window.engineResize) window.engineResize(); });
  setTimeout(() => { positionMapContainer(); if (window.engineResize) window.engineResize(); }, 120);
}

function unmountMapCanvas() {
  const gc = document.getElementById('game-container');
  if (gc) { gc.style.display = 'none'; gc.innerHTML = ''; }
  // Tear down engine state so a future mount boots cleanly.
  // bump the engine generation — the old instance's anim loop stops
  // rescheduling and its key handlers detach on their next event (see engine.js).
  window.__engineGen = (window.__engineGen || 0) + 1;
  _mapMounted = false;
  window.__midmultiEngineStarted = false;
  // #10: NEUTRALIZE the dead engine's globals. window.__anyModalOpen is a closure
  // OWNED by the now-destroyed engine; it stays on window pointing at frozen flags
  // (shopActive / dismissTextPanel / …). If any were truthy at teardown it would
  // keep reporting a phantom modal — which blocks "Enter opens the prompt" and
  // pins the world paused, so after viewing the sheet the command prompt looked
  // perpetually open and unusable. Replace it with a harmless false until the next
  // engine installs its own, and clear the world-pause latch.
  try { window.__anyModalOpen = function () { return false; }; } catch (e) {}
  try { window.__worldPaused = false; } catch (e) {}
  const dataEl = document.getElementById('map-data');
  if (dataEl) dataEl.remove();
}

// Reposition the live map when the window resizes (display scale changes, etc).
window.addEventListener('resize', () => { if (_mapMounted) { positionMapContainer(); if (window.engineResize) window.engineResize(); } });

// ── #14: IN-GAME DIALOGUE OVERLAY (debug NPCs as conversations) ─────────────
// Interacting with a debug NPC that carries meta.debugMenu opens a small,
// retro, Saymaker-style dialogue rendered over the map. It's a tree of nodes:
//   nodes: { start: { text, options:[ {label, action|goto|back} ] }, ... }
// where `action` is an engineDebugAction string (e.g. 'sound:spark'), `goto`
// jumps to a named child node, and `back` closes. Arrow keys (or W/S) move the
// selection; Enter chooses; Esc/Backspace closes. The engine still runs behind
// it; the player just can't move while the box is up.
let _dlg = null;   // { tree, node, sel, npcName }

function dlgOverlay() {
  let el = document.getElementById('debug-dialogue');
  const host = document.getElementById('game-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'debug-dialogue';
    el.style.cssText = [
      'position:absolute', 'left:50%', 'bottom:8%', 'transform:translateX(-50%)',
      'min-width:300px', 'max-width:88%', 'z-index:60',
      'background:#c0c0c0', 'color:#000',
      'border:2px solid #fff', 'border-right-color:#404040', 'border-bottom-color:#404040',
      'box-shadow:2px 2px 0 #404040', 'font:17px/1.4 "GrandeRetro","MS Sans Serif",Tahoma,sans-serif',   // bigger font on all dialogue modals
      'padding:0'
    ].join(';');
    // mount INSIDE the map container so the box sits right over the lower
    // part of the gameplay view (near the player), not far below the frame.
    (host || document.body).appendChild(el);
  } else if (host && el.parentNode !== host) {
    host.appendChild(el);   // re-home it if the container was rebuilt
  }
  return el;
}
function openDebugDialogue(tree, npcName) {
  _dlg = { tree, node: tree.root || 'start', sel: 0, npcName: npcName || '' };
  // pause the world while talking unless the tree opts out. Saymaker writes
  // tree.pauseWorld (default true). The engine reads window.__worldPaused.
  window.__worldPaused = (tree && tree.pauseWorld === false) ? false : true;
  _dlgStartTyping();   // #16: NPC line types out; choices appear after
}
function closeDebugDialogue() {
  if (_dlg && _dlg._typeTimer) { clearInterval(_dlg._typeTimer); _dlg._typeTimer = null; }
  _dlg = null;
  window.__worldPaused = false;   // resume the world
  const el = document.getElementById('debug-dialogue');
  if (el) el.style.display = 'none';
}
function currentDlgNode() { return _dlg && _dlg.tree.nodes[_dlg.node]; }
// ── #10/#16: TYPEWRITER for the dialogue-TREE NPC line ───────────────────────
// The NPC's line types out (with a per-NPC blip); the player's response CHOICES
// stay hidden until it finishes (or is skipped with Space) so you can't pick
// blind — and the skip-Space is swallowed so it can't also select an option
// (the failsafe Joe asked for). Speed/sound reuse State.settings.textSpeed /
// .dialogueSound. Player responses are NEVER typed (they appear instantly).
const _DLG_SPEED = { slow: 28, medium: 19, medfast: 12, fast: 6, instant: 0 }   // #1: 2x faster (halved);
let _dlgAC = null;
function _dlgBlip(name) {
  const set = (window.State && State.settings) || {};
  if (set.dialogueSound === false || set.sounds === false) return;
  try {
    if (!_dlgAC) _dlgAC = new (window.AudioContext || window.webkitAudioContext)();
    const ac = _dlgAC; if (ac.state === 'suspended' && ac.resume) ac.resume();
    let h = 0; const s = String(name || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    const base = 250 + (Math.abs(h) % 150);
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square';
    o.frequency.value = base + (Math.random() * 16 - 8);
    const t = ac.currentTime; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.05);
  } catch (e) {}
}
function _dlgStartTyping() {
  const node = currentDlgNode(); if (!_dlg || !node) return;
  const set = (window.State && State.settings) || {};
  const ms = (_DLG_SPEED[set.textSpeed] != null) ? _DLG_SPEED[set.textSpeed] : _DLG_SPEED.medfast;
  _dlg._full = String(node.text || '');
  if (_dlg._typeTimer) { clearInterval(_dlg._typeTimer); _dlg._typeTimer = null; }
  if (ms === 0 || _dlg._full.length === 0) { _dlg._typeN = _dlg._full.length; _dlg._typing = false; renderDebugDialogue(); return; }
  _dlg._typeN = 0; _dlg._typing = true;
  _dlg._typeTimer = setInterval(() => {
    if (!_dlg) return;
    _dlg._typeN++;
    if (_dlg._typeN % 2 === 0) _dlgBlip(_dlg.npcName);
    if (_dlg._typeN >= _dlg._full.length) { _dlg._typeN = _dlg._full.length; _dlg._typing = false; clearInterval(_dlg._typeTimer); _dlg._typeTimer = null; }
    renderDebugDialogue();
  }, ms);
  renderDebugDialogue();
}
function _dlgFinishTyping() {
  if (_dlg && _dlg._typeTimer) { clearInterval(_dlg._typeTimer); _dlg._typeTimer = null; }
  if (_dlg) { _dlg._typeN = (_dlg._full || '').length; _dlg._typing = false; }
  renderDebugDialogue();
}
function renderDebugDialogue() {
  const el = dlgOverlay();
  const node = currentDlgNode();
  if (!_dlg || !node) { el.style.display = 'none'; return; }
  const esc = (s) => String(s == null ? '' : s).replace(/[<&>]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]));
  let h = '<div style="background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font-weight:bold;padding:3px 6px">' + esc(_dlg.npcName || 'Dialogue') + '</div>';
  h += '<div style="padding:10px 12px;font-weight:normal">';
  // #16: the NPC line types out and is ENLARGED. While it's still typing we show
  // a skip hint instead of the choices, so nothing can be picked blind.
  const _full = (_dlg._full != null) ? _dlg._full : String(node.text || '');
  const _shown = (_dlg._typeN != null) ? _full.slice(0, _dlg._typeN) : _full;
  h += '<div style="margin-bottom:8px;font-size:20px;line-height:1.3;max-height:46vh;overflow-y:auto">' + esc(_shown) + '</div>';
  if (_dlg._typing) {
    h += '<div style="margin-top:8px;color:#404040;font-size:13px">[G] skip</div>';
    h += '</div>';
    el.innerHTML = h; el.style.display = 'block';
    return;
  }
  const opts = visibleOptions(node);
  if (_dlg.sel >= opts.length) _dlg.sel = Math.max(0, opts.length - 1);
  // long option lists (e.g. the sound-test menu) used to run off the bottom
  // of the screen. When there are more than COL_THRESHOLD options we lay them out
  // in TWO columns (column-major: fill the left column top-to-bottom, then the
  // right). Navigation: Up/Down moves within a column, Left/Right jumps columns.
  const COL_THRESHOLD = 8;
  const twoCol = opts.length > COL_THRESHOLD;
  if (twoCol) {
    const rows = Math.ceil(opts.length / 2);
    _dlg._cols = 2; _dlg._rows = rows;
    h += '<div style="display:flex;gap:14px;">';
    for (let c = 0; c < 2; c++) {
      h += '<div style="flex:1;min-width:0;">';
      for (let r = 0; r < rows; r++) {
        const i = c * rows + r;
        if (i >= opts.length) break;
        const onSel = (i === _dlg.sel);
        h += '<div data-dlg-choice="' + i + '" style="cursor:pointer;padding:3px 6px;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + (onSel ? 'background:#000080;color:#fff' : 'color:#000') + '">'
           + (onSel ? '\u25B6 ' : '\u00A0\u00A0') + esc(o_label(opts[i])) + '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
    h += '<div style="margin-top:8px;color:#404040;font-size:12px">\u2191\u2193 row \u00B7 \u2190\u2192 column \u00B7 Enter choose \u00B7 Esc close</div>';
  } else {
    _dlg._cols = 1; _dlg._rows = opts.length;
    opts.forEach((o, i) => {
      const onSel = (i === _dlg.sel);
      h += '<div data-dlg-choice="' + i + '" style="cursor:pointer;padding:3px 6px;font-size:17px;' + (onSel ? 'background:#000080;color:#fff' : 'color:#000') + '">'
         + (onSel ? '\u25B6 ' : '\u00A0\u00A0') + esc(o.label) + '</div>';
    });
    h += '<div style="margin-top:8px;color:#404040;font-size:12px">\u2191\u2193 select \u00B7 Enter choose \u00B7 Esc close</div>';
  }
  h += '</div>';
  el.innerHTML = h;
  el.style.display = 'block';
  // #19: click a choice to pick it (or click while the line is still typing to
  // finish it first), so the dialogue tree is fully mouse-drivable. Reassigning
  // onclick each render keeps exactly one listener.
  el.onclick = function (ev) {
    const c = ev.target && ev.target.closest && ev.target.closest('[data-dlg-choice]');
    if (!c || !_dlg) return;
    ev.preventDefault(); ev.stopPropagation();
    if (_dlg._typing) { debugDialogueKey('Enter'); return; }   // first click reveals the rest of the line
    const i = parseInt(c.getAttribute('data-dlg-choice'), 10);
    if (!isNaN(i)) { _dlg.sel = i; debugDialogueKey('Enter'); }
  };
}
function o_label(o) { return (o && o.label) || ''; }
// an option list filtered by trait gates. The tutorial installs
// window.__tutorialOptionVisible(opt) to hide options whose requires:{} aren't
// met by the (possibly buffed) player; without it, all options show.
function visibleOptions(node) {
  const all = (node && node.options) || [];
  if (typeof window.__tutorialOptionVisible === 'function') {
    return all.filter(o => window.__tutorialOptionVisible(o));
  }
  return all;
}
// Returns true if it consumed the key (so the map screen ignores it).
function debugDialogueKey(key) {
  if (!_dlg) return false;
  // #16 failsafe: if the NPC line is still typing, Enter/Space (or E) just
  // reveals the rest — it must NOT fall through and auto-pick a choice.
  if (_dlg._typing) {
    const kk = (key || '').toLowerCase();
    if (key === 'Enter' || key === ' ' || kk === 'g' || kk === 'spacebar') { _dlgFinishTyping(); return true; }   // #1: G (not E) advances/skips
    if (key === 'Escape' || key === 'Backspace') { sfx.back(); closeDebugDialogue(); return true; }
    return true;   // swallow everything else while typing
  }
  const node = currentDlgNode();
  const opts = visibleOptions(node);
  const k = (key || '').toLowerCase();
  const n = opts.length;
  // column-major navigation. In 1-column mode Up/Down wrap through the list.
  // In 2-column mode the left column is indices [0..rows-1], the right is
  // [rows..n-1]; Up/Down move within a column, Left/Right swap columns.
  const cols = _dlg._cols || 1;
  const rows = _dlg._rows || n;
  if (key === 'ArrowUp' || k === 'w') {
    if (cols === 1) { _dlg.sel = (_dlg.sel - 1 + n) % n; }
    else { const col = Math.floor(_dlg.sel / rows); const row = _dlg.sel % rows; const nr = (row - 1 + rows) % rows; let ni = col * rows + nr; if (ni >= n) ni = n - 1; _dlg.sel = ni; }
    sfx.type(); renderDebugDialogue(); return true;
  }
  if (key === 'ArrowDown' || k === 's') {
    if (cols === 1) { _dlg.sel = (_dlg.sel + 1) % n; }
    else { const col = Math.floor(_dlg.sel / rows); const row = _dlg.sel % rows; const nr = (row + 1) % rows; let ni = col * rows + nr; if (ni >= n) ni = col * rows; _dlg.sel = ni; }
    sfx.type(); renderDebugDialogue(); return true;
  }
  if (key === 'ArrowLeft' || k === 'a') {
    if (cols === 2) { const col = Math.floor(_dlg.sel / rows); const row = _dlg.sel % rows; if (col === 1) { _dlg.sel = row; } else { let ni = rows + row; if (ni < n) _dlg.sel = ni; } sfx.type(); renderDebugDialogue(); }
    return true;
  }
  if (key === 'ArrowRight' || k === 'd') {
    if (cols === 2) { const col = Math.floor(_dlg.sel / rows); const row = _dlg.sel % rows; if (col === 0) { let ni = rows + row; if (ni < n) _dlg.sel = ni; } else { _dlg.sel = row; } sfx.type(); renderDebugDialogue(); }
    return true;
  }
  if (key === 'Escape' || key === 'Backspace') { sfx.back(); closeDebugDialogue(); return true; }
  if (key === 'Enter' || key === ' ' || (key || '').toLowerCase() === 'g') {   // #1: G advances the dialogue tree
    const o = opts[_dlg.sel];
    if (!o) { closeDebugDialogue(); return true; }
    // Run an action first (if any), THEN navigate (goto/back/close). This lets a
    // single option do both — e.g. "Lend me +3 Charm" applies the buff and jumps.
    if (o.action && typeof window.engineDebugAction === 'function') {
      window.engineDebugAction(o.action, _dlg.npcName);
    }
    if (o.back)      { sfx.back(); closeDebugDialogue(); return true; }
    if (o.goto)      { sfx.select(); _dlg.node = o.goto; _dlg.sel = 0; _dlgStartTyping(); return true; }
    if (o.action)    { sfx.confirm(); renderDebugDialogue(); return true; }   // stay (e.g. spam sounds)
    closeDebugDialogue(); return true;
  }
  return false;
}
// Engine calls this when interacting with an NPC that has meta.debugMenu.
window.engineOpenDialogue = function (meta) {
  if (!meta || !meta.debugMenu) return;
  openDebugDialogue(meta.debugMenu, meta.name || '');
};
// The map screen routes keydowns here first (see DEBUG_ROOM_MAP key handling
// hooked in game.js's global keydown via window.__debugDialogueActive).
window.__debugDialogueKey = debugDialogueKey;
window.__debugDialogueActive = () => !!_dlg;
// capture-phase interceptor — when the dialogue is open, it eats the key
// (arrows/WASD/Enter/Esc) BEFORE the engine's window keydown listener sees it,
// so the player can't walk away mid-conversation and the menu drives cleanly.
window.addEventListener('keydown', (e) => {
  if (!_dlg) return;
  // #4: while the host COMMAND PROMPT is open the player is typing a command —
  // this capture-phase handler must not eat their keys (it handles arrows via
  // debugDialogueKey, which otherwise swallows ArrowUp before the prompt's input
  // sees it: letters fall through, arrows don't — exactly the "up-arrow stopped
  // working but typing still works" symptom).
  if (typeof window.__hostPromptOpen === 'function' && window.__hostPromptOpen()) return;
  const handled = debugDialogueKey(e.key);
  if (handled) { e.preventDefault(); e.stopPropagation(); }
}, true);

Screens.DEBUG_ROOM_MAP = {
  render() {
    // Description text shown in the MID-LOWER region (below the map).
    const desc = [
      span('accent', State.mapTitle || 'Map'),
      '',
      'A live test room. Move with the movement keys; the view follows you.',
      'Walk into doors, counters, windows, NPCs and portals to test them.',
      '',
      span('stat-name', 'Type "back" to leave. Press F7 to toggle the minimap.'),
    ];
    // The canvas is mounted after this render() returns (see the rAF below).
    requestAnimationFrame(() => mountMapCanvas());
    return renderGameplayUI({
      mapMode: true,
      npc: State.focusNpc || null,     // faced NPC shows in the NPC/REL panels
      gameText: desc,
      overrideLocation: State.mapTitle || 'Debug Room',
    });
  },
  handle(text) {
    const t = (text || '').trim().toLowerCase();
    if (t === 'back' || t === 'b' || t === '') {
      unmountMapCanvas();
      sfx.back();
      // leaving the debug room must NOT disturb a game in progress. Restore
      // the pre-debug character snapshot (undoing any in-room respec / temp
      // buffs), and discard a throwaway character if we generated one.
      if (State._debugTempChar) {
        State.character = State._debugCharSnapshot || null;
        State._debugTempChar = false;
      } else if (State._debugCharSnapshot) {
        State.character = State._debugCharSnapshot;
      }
      State._debugCharSnapshot = null;
      goto(State.mapReturn || 'DEBUG_ROOM');
      return;
    }
    // Warp by name/number while in the room.
    if (t.startsWith('warp')) {
      const n = parseInt(t.replace(/^warp\s*/, ''), 10);
      if (!isNaN(n) && typeof window.engineFastTravel === 'function') { window.engineFastTravel(n); sfx.confirm(); return; }
    }
    flash('Type "back" to leave the map.');
  }
};

//
// State.minigameReturn — the screen key to come back to (set by the caller).
// State.minigameActive — true while the overlay is up; used by ESC to close.
//
// Mapster is NOT a minigame; it's a separate editor tool. It still opens
// via launchExternal() below (new tab / current tab fallback).

// Open a minigame in the in-game overlay. relPath is relative to midmulti.html.
// title is the label shown in the overlay top-bar.
function openMinigame(relPath, title) {
  // Persist progress so the player can come back even if they reload.
  if (State.character && State.character.name) {
    saveSlot({ isAutosave: true, reason: 'before ' + (title || relPath) });
  }
  let overlay = document.getElementById('minigame-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'minigame-overlay';
    overlay.innerHTML =
      '<div id="minigame-bar">' +
        '<span id="minigame-title"></span>' +
        '<button id="minigame-return-btn" type="button" tabindex="-1">' +
          '&#9664; RETURN' +
        '</button>' +
      '</div>' +
      '<iframe id="minigame-frame" src="" allow="autoplay; fullscreen" tabindex="0"></iframe>';
    document.body.appendChild(overlay);
    document.getElementById('minigame-return-btn').addEventListener('click', () => {
      closeMinigame();
    });
  }
  const titleEl = document.getElementById('minigame-title');
  const frame   = document.getElementById('minigame-frame');
  titleEl.textContent = title || 'Minigame';
  frame.src = relPath;
  overlay.style.display = 'flex';
  document.body.classList.add('minigame-active');
  State.minigameActive = true;
  // make sure the host prompt is closed/blurred so it isn't holding (or
  // grabbing) keyboard focus while the minigame iframe needs it.
  try { if (typeof PromptState !== 'undefined') PromptState.close(); } catch (e) {}

  // Focus the iframe so keyboard events route into the minigame, not the
  // host page. Without this, both bowling and leafblower would appear
  // "frozen" — their `window.addEventListener('keydown')` handlers never
  // fire because the iframe doesn't have keyboard focus on open.
  // We try twice: immediately (some browsers will accept it right away),
  // and after the iframe loads (the more reliable moment). If the user
  // clicks anywhere outside the iframe and loses focus, clicking on the
  // iframe area itself will re-focus it.
  try { frame.focus(); } catch (e) {}
  frame.onload = () => {
    try { frame.focus(); } catch (e) {}
    try { frame.contentWindow && frame.contentWindow.focus(); } catch (e) {}
  };
  // leafblower (and any keyboard-driven minigame) needs the iframe's
  // window to actually hold keyboard focus. Browsers often won't grant it on
  // load alone, so also grab focus whenever the pointer enters or presses the
  // iframe — the first hover/click reliably routes keys into the minigame.
  const grab = () => { try { frame.focus(); frame.contentWindow && frame.contentWindow.focus(); } catch (e) {} };
  frame.addEventListener('mouseenter', grab);
  frame.addEventListener('pointerdown', grab);
  frame.addEventListener('pointerenter', grab);
  // Nudge focus a few times right after opening (covers slow iframe loads).
  setTimeout(grab, 60); setTimeout(grab, 250); setTimeout(grab, 600);
}

// Close the minigame overlay and return to the screen recorded by the
// caller in State.minigameReturn (defaults to the lobby).
function closeMinigame() {
  const overlay = document.getElementById('minigame-overlay');
  if (overlay) {
    document.getElementById('minigame-frame').src = '';   // tear down the minigame
    overlay.style.display = 'none';
  }
  document.body.classList.remove('minigame-active');
  State.minigameActive = false;
  const ret = State.minigameReturn || 'GAME_PLACEHOLDER';
  State.minigameReturn = null;
  // Use goto() rather than State.screen = ... so the autosave tripwire fires
  // for the return location too.
  sfx.back();
  goto(ret);
  // #2 FIX (softlock on return): keyboard focus was left on the now-blanked
  // minigame iframe, so the host's document-level key handlers never received
  // anything — the player couldn't type or press Enter. Pull focus back to the
  // host window, clear the Enter "just-closed" guard, and re-open the prompt for
  // text screens so it's immediately usable. We do this on a microtask + a short
  // timeout because some browsers settle iframe-teardown focus a frame late.
  const restoreFocus = () => {
    try { window.focus(); } catch (e) {}
    try { if (document.body) document.body.focus && document.body.focus(); } catch (e) {}
    PromptState._closedAt = 0;
    // Re-open the prompt on text screens (not on map screens, where movement
    // keys should flow to the game and the prompt opens on Enter).
    if (typeof MAP_SCREENS === 'undefined' || !MAP_SCREENS.has(State.screen)) {
      try { PromptState.openPrompt(); } catch (e) {}
    } else {
      try { input.focus(); } catch (e) {}
    }
  };
  restoreFocus();
  setTimeout(restoreFocus, 60);
  setTimeout(restoreFocus, 200);
}

// Open an external standalone page (Mapster, etc.) in a new tab — the
// original flow. Used by DEBUG_MENU for Mapster.
function launchExternal(relPath) {
  if (State.character && State.character.name) {
    saveSlot({ isAutosave: true, reason: 'before launching ' + relPath });
  }
  let win = null;
  try { win = window.open(relPath, '_blank'); } catch (e) { win = null; }
  if (win) return true;
  window.location.href = relPath;
  return false;
}

//═══════════════════════════════════════════════════════════════════════════
// DEBUG MENU
//═══════════════════════════════════════════════════════════════════════════
//
// A developer/testing menu reached from the demo game (GAME_PLACEHOLDER) by
// typing `debug`. Lists every entry in LAUNCH_TARGETS plus a "back" option.
// The player can pick by number or by typing the target key (e.g. "bowling").
//
// State.debugReturn holds the screen to come back to when the player types
// "back" — set by whoever opens the menu (GAME_PLACEHOLDER sets it to itself).
Screens.DEBUG_MENU = {
  render() {
    const lines = [
      header('DEBUG MENU'),
      '',
      '   ' + span('warn', 'Developer launchers — not part of normal play.'),
      '',
      '   Launching opens the target in a new browser tab when allowed,',
      '   otherwise it navigates this tab (your progress is auto-saved',
      '   first, so use "Continue" on the title screen to come back).',
      '',
    ];
    LAUNCH_TARGETS.forEach((t, i) => {
      lines.push('   ' + span('accent', '[ ' + (i + 1) + ' ]') + '  ' + t.label);
      lines.push('         ' + span('stat-name', t.blurb));
      lines.push('');
    });
    lines.push('   ' + span('accent', '[ back ]') + '  return to the game');
    return lines.join('\n');
  },
  handle(text) {
    const t = text.trim().toLowerCase();
    if (t === 'back' || t === 'b' || t === '') {
      sfx.back();
      State.screen = State.debugReturn || 'GAME_PLACEHOLDER';
      State.debugReturn = null;
      render();
      return;
    }
    // Match either a 1-based number or a target key.
    let target = null;
    const n = parseInt(t, 10);
    if (!isNaN(n) && n >= 1 && n <= LAUNCH_TARGETS.length) {
      target = LAUNCH_TARGETS[n - 1];
    } else {
      target = LAUNCH_TARGETS.find(x => x.key === t);
    }
    if (!target) {
      sfx.error();
      flash('Pick 1-' + LAUNCH_TARGETS.length + ', a name (e.g. "bowling"), or "back".');
      return;
    }
    sfx.confirm();
    flash('Launching: ' + target.label);
    if (target.kind === 'minigame') {
      // Embedded in-game overlay; coming back drops the player on the
      // debug menu where they were.
      State.minigameReturn = 'DEBUG_MENU';
      openMinigame(target.path, target.label);
    } else {
      // External tool (Mapster). New tab when allowed, otherwise navigates.
      const newTab = launchExternal(target.path);
      if (newTab) render();   // stayed here, refresh the menu
    }
  }
};
