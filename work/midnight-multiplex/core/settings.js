/* ════════════════════════════════════════════════════════════════════════════
 * MIDNIGHT AT THE MULTIPLEX — SETTINGS SCREEN
 * ────────────────────────────────────────────────────────────────────────────
 * Location: midmulti/core/settings.js
 *
 * WHAT THIS IS
 * ──────────────────────────────────────────────────────────────────────────
 * The SETTINGS screen. Reached from the title screen (menu option 3) or
 * from the in-game ESC pause menu. Player changes here take effect
 * immediately and are persisted to localStorage between sessions.
 *
 * THE OPTIONS
 * ──────────────────────────────────────────────────────────────────────────
 *   1. DISPLAY SCALE   AUTO / 1× / 2× / 3× / 4× / 5× / 6×
 *                      Controls --ui-scale (CSS) which drives both the
 *                      title canvas size and the terminal font size.
 *                      AUTO picks the largest integer that fits the
 *                      current window; the choice updates live on resize.
 *   2. WINDOW MODE     WINDOWED / FULLSCREEN
 *                      FULLSCREEN requests the browser's Fullscreen API
 *                      (same as F11) immediately when toggled on. On
 *                      page load this is deferred to the first user
 *                      gesture, because browsers block fullscreen
 *                      requests until the user has interacted.
 *   3. DISPLAY MODE    STANDARD (capped width) / WIDESCREEN (full)
 *   4. AUDIO           ALL ON / NO MUSIC / NO SFX / MUTED
 *   5. CRT GLOW        ON / OFF
 *
 * REQUIREMENTS (defined in core/game.js, which loads before this file)
 * ──────────────────────────────────────────────────────────────────────────
 *   State.settings          — { displayScale, windowMode, display, audioMode, crt, … }
 *   header(title), pad      — text helpers
 *   sfx                     — sound effects
 *   flash(msg), render()    — UI helpers
 *   back()                  — return to previous screen
 *   applySettings()         — writes settings to DOM (classes + CSS vars)
 *   applyDisplayScale()     — recomputes --ui-scale and --term-font-size
 *   applyWindowMode()       — enters/exits browser fullscreen
 *   saveSettings()          — persists to localStorage ('mam.settings')
 *   cycleAudioMode()        — shared with F6 hotkey
 *
 * HOW TO EDIT
 * ──────────────────────────────────────────────────────────────────────────
 * Adding a new option:
 *   1. Add the default value to State.settings (in core/game.js).
 *   2. If the setting affects the DOM, extend applySettings() in game.js.
 *   3. Add a row to the ASCII box in render() below — match the column
 *      widths (the pad(..., 36) call right-pads the option label).
 *   4. Add the matching number case in handle() that toggles/cycles the
 *      value, then calls applySettings(), saveSettings(), sfx.select(),
 *      and render().
 * ════════════════════════════════════════════════════════════════════════════
 */

// All scale options surfaced in the menu. 'auto' is always first.
// To support a new scale (e.g. 7×), just add it here AND raise the cap in
// applyDisplayScale() / computeAutoScale() in game.js.
const UI_SCALE_OPTIONS = [
  { key: 'auto', label: 'AUTO' },
  { key: '1',    label: '1\u00d7'  },
  { key: '2',    label: '2\u00d7'  },
  { key: '3',    label: '3\u00d7'  },
  { key: '4',    label: '4\u00d7'  },
  { key: '5',    label: '5\u00d7'  },
  { key: '6',    label: '6\u00d7'  },
];

// Window-mode options.
const WINDOW_MODE_OPTIONS = [
  { key: 'windowed',   label: 'WINDOWED'   },
  { key: 'fullscreen', label: 'FULLSCREEN' },
];

// ─── SETTINGS  ────────────────────────────────────────────────────────────
Screens.SETTINGS = {
  render() {
    const s = State.settings;
    const cycle = (cur, opts) => opts.map(o =>
      o.key === cur ? '[' + o.label + ']' : ' ' + o.label + ' '
    ).join(' ');
    const DM = window.DisplayManager;
    const displayModeOpts = DM ? DM.DISPLAY_MODES : [{ key: 'fill', label: 'FILL SCREEN' }];
    const resolutionOpts = DM ? DM.DISPLAY_RESOLUTIONS : [{ key: 'native', label: 'NATIVE' }];
    const audioOpts = [
      { key: 'all',        label: 'ALL ON'    },
      { key: 'music-off',  label: 'NO MUSIC'  },
      { key: 'sounds-off', label: 'NO SFX'    },
      { key: 'mute',       label: 'MUTED'     },
    ];
    const controlOpts = [
      { key: 'crawler', label: 'DUNGEON CRAWLER' },
      { key: 'retro',   label: 'RETRO FPS'       },
    ];
    const textSpeedOpts = [
      { key: 'slow',    label: 'SLOW'     },
      { key: 'medium',  label: 'MEDIUM'   },
      { key: 'medfast', label: 'MED-FAST' },
      { key: 'fast',    label: 'FAST'     },
      { key: 'instant', label: 'INSTANT'  },
    ];
    const onoff = (v) => v ? '[ ON  ]' : '[ OFF ]';
    let dispHint = '';
    try { if (DM) dispHint = '   (' + DM.describe() + ')'; } catch (e) {}

    let row3Label, row3Value;
    if (s.displayMode === 'resolution') {
      row3Label = '3.  RESOLUTION';
      row3Value = cycle(s.displayResolution || 'native', resolutionOpts);
    } else if (s.displayMode === 'manual') {
      row3Label = '3.  SCALE (+/-)';
      row3Value = '[ ' + (s.displayScale && s.displayScale !== 'auto' ? s.displayScale : '2') + '\u00d7 ]   (type 3 to grow, 3- to shrink)';
    } else {
      row3Label = '3.  (auto-sized)';
      row3Value = s.displayMode === 'fill' ? 'fills the screen' : 'crisp integer scale';
    }

    // build the box from the CONTENT so the border always wraps it. Each
    // row is "<label>  <value>"; we measure the widest row and size the box to
    // fit (with a minimum), so long option lists never overflow the right edge.
    const rows = [
      ['1.  DISPLAY MODE', cycle(s.displayMode || 'fill', displayModeOpts)],
      ['2.  WINDOW MODE',  cycle(s.windowMode, WINDOW_MODE_OPTIONS)],
      [row3Label,          row3Value],
      ['4.  AUDIO',        cycle(s.audioMode, audioOpts)],
      ['5.  CRT GLOW',     onoff(s.crt)],
      ['6.  FPS CONTROLS', cycle(s.fpsControlScheme || 'crawler', controlOpts)],
      ['7.  CLOCK',        onoff(s.militaryTime) === 'ON' ? '24-HOUR' : '12-HOUR'],
      ['8.  DIAGNOSTICS',  onoff(s.showDiagnostics)],
      ['9.  TEXT SPEED',   cycle(s.textSpeed || 'medfast', textSpeedOpts)],
      ['10. DIALOGUE SFX', onoff(s.dialogueSound !== false)],
      ['11. TICKER BASICS', onoff(s.tickerBasics !== false)],
      ['12. SPEED UNITS',  (s.speedUnits === 'kmh') ? 'KM/H' : 'MPH'],
    ];
    // The developer sandbox isn't part of the public web demo (its portals open
    // the editors + minigames, which the demo doesn't ship). See core/demo.js.
    if (!IS_DEMO_BUILD()) rows.push(['13. DEBUG ROOM',   'OPEN \u00BB']);
    const LABEL_W = 18;
    const lineFor = (label, value) => '  ' + pad(label, LABEL_W) + '  ' + value;
    const TITLE = 'OPTIONS';
    let inner = Math.max(60, ...rows.map(r => lineFor(r[0], r[1]).length), TITLE.length + 4);
    inner += 2;   // a little breathing room on the right
    const bar = '-'.repeat(inner);
    const blank = '|' + ' '.repeat(inner) + '|';
    const boxLine = (txt) => '|' + pad(txt, inner) + '|';
    const center = (txt) => { const total = inner - txt.length; const l = Math.floor(total/2); return '|' + ' '.repeat(Math.max(0,l)) + txt + ' '.repeat(Math.max(0, inner - l - txt.length)) + '|'; };

    const out = [];
    out.push('   .' + bar + '.');
    out.push('   ' + center(TITLE));
    out.push('   |' + bar + '|');
    out.push('   ' + blank);
    rows.forEach((r, i) => {
      out.push('   ' + boxLine(lineFor(r[0], r[1])));
      if (i < rows.length - 1) out.push('   ' + blank);
    });
    out.push('   ' + blank);
    out.push('   `' + bar + "'");

    return header('SETTINGS') + [
      '',
      ...out,
      '',
      '   Type a number to cycle that option. Type "back" when done.' + dispHint,
      '',
      '   (DISPLAY MODE: FILL uses the whole screen; FIT keeps crisp pixels;',
      '    MANUAL lets you set scale with 3/3-; RESOLUTION targets a size.)',
      '   (FPS CONTROLS: DUNGEON CRAWLER = W/S move, A/D strafe, Q/E turn.',
      '    RETRO FPS = W/S move, A/D turn, Q/E strafe.)',
      '   (cycle audio anywhere with F6, toggle fullscreen with F11)',
    ].join('\n');
  },
  handle(text) {
    const t = text.toLowerCase().trim();
    if (t === 'back' || t === 'b' || t === '') { sfx.back(); back(); return; }

    if (t === '1' || t === 'display' || t === 'displaymode') {
      if (window.DisplayManager) window.DisplayManager.cycleMode();
      saveSettings(); sfx.select(); render(); return;
    }
    if (t === '2' || t === 'window' || t === 'windowmode') {
      State.settings.windowMode =
        State.settings.windowMode === 'fullscreen' ? 'windowed' : 'fullscreen';
      applyWindowMode();
      applyDisplayScale();
      saveSettings(); sfx.select(); render(); return;
    }
    if (t === '3' || t === '3+' || t === '3 up') {
      if (State.settings.displayMode === 'resolution') {
        if (window.DisplayManager) window.DisplayManager.cycleResolution();
      } else {
        if (window.DisplayManager) window.DisplayManager.nudgeScale(+1);
      }
      saveSettings(); sfx.select(); render(); return;
    }
    if (t === '3-' || t === '3 down') {
      if (window.DisplayManager) window.DisplayManager.nudgeScale(-1);
      saveSettings(); sfx.select(); render(); return;
    }
    if (t === '4' || t === 'audio') {
      cycleAudioMode(); render(); return;
    }
    if (t === '5' || t === 'crt' || t === 'glow') {
      State.settings.crt = !State.settings.crt;
      applySettings(); saveSettings(); sfx.select(); render(); return;
    }
    // cycle the FPS control scheme (crawler <-> retro). Pushed to
    // window.fpsControlScheme so the embedded engine reads it live.
    if (t === '6' || t === 'fps' || t === 'controls') {
      State.settings.fpsControlScheme = (State.settings.fpsControlScheme === 'retro') ? 'crawler' : 'retro';
      try { window.fpsControlScheme = State.settings.fpsControlScheme; } catch (e) {}
      saveSettings(); sfx.select(); render(); return;
    }
    // toggle 12-hour / 24-hour ("military") clock.
    if (t === '7' || t === 'clock' || t === 'time' || t === 'military') {
      State.settings.militaryTime = !State.settings.militaryTime;
      saveSettings(); sfx.select(); render(); return;
    }
    // Diagnostics overlay (FPS / resources). Mirrors to window.__showDiag so the
    // embedded engine shows/hides it live; F3 toggles the same flag in-engine.
    if (t === '8' || t === 'diag' || t === 'diagnostics' || t === 'fps overlay') {
      State.settings.showDiagnostics = !State.settings.showDiagnostics;
      try { window.__showDiag = !!State.settings.showDiagnostics; } catch (e) {}
      saveSettings(); sfx.select(); render(); return;
    }
    // #3: cycle dialogue type-out speed (slow→medium→med-fast→fast→instant).
    if (t === '9' || t === 'text' || t === 'speed' || t === 'textspeed') {
      const order = ['slow', 'medium', 'medfast', 'fast', 'instant'];
      const i = order.indexOf(State.settings.textSpeed || 'medfast');
      State.settings.textSpeed = order[(i + 1) % order.length];
      saveSettings(); sfx.select(); render(); return;
    }
    // #3: toggle the Earthbound-style typing blips.
    if (t === '10' || t === 'dialogue' || t === 'dialoguesfx' || t === 'blips') {
      State.settings.dialogueSound = !(State.settings.dialogueSound !== false);
      saveSettings(); sfx.select(); render(); return;
    }
    // #3: toggle the BASIC verbs in the bottom command ticker (scene actions
    // still show regardless). Refresh the ticker immediately if it's on screen.
    if (t === '11' || t === 'ticker' || t === 'tickerbasics') {
      State.settings.tickerBasics = !(State.settings.tickerBasics !== false);
      saveSettings(); sfx.select();
      if (typeof updateCommandTicker === 'function') { try { updateCommandTicker(); } catch (e) {} }
      render(); return;
    }
    // open the debug room from settings. It doesn't disturb a game in
    // progress; if no character exists yet, a random one is generated first.
    if (t === '12' || t === 'speed' || t === 'speedunits' || t === 'units') {
      State.settings.speedUnits = (State.settings.speedUnits === 'kmh') ? 'mph' : 'kmh';
      saveSettings(); sfx.select(); render(); return;
    }
    if ((t === '13' || t === 'debug' || t === 'debugroom') && !IS_DEMO_BUILD()) {
      sfx.confirm();
      if (typeof openDebugRoomFromMenu === 'function') openDebugRoomFromMenu(State.screen);
      return;
    }
    sfx.error(); flash(IS_DEMO_BUILD() ? 'Pick 1-12 or "back".' : 'Pick 1-13 or "back".');
  }
};
