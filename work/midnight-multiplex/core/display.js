/**
 * Midnight at the Multiplex — Display & Resolution Manager
 * =========================================================
 * Centralizes ALL display sizing: how big the terminal text and the title/
 * scene canvas render, and how the whole UI fills the screen. Replaces the
 * old "integer --ui-scale only" approach with a richer system the player can
 * tune, while keeping the retro monospace aesthetic.
 *
 * It drives three CSS custom properties on :root, which midmulti.html's CSS
 * already (or now) hangs sizing off of:
 *   --ui-scale        integer-ish scale factor for the title/scene canvas
 *   --term-font-size  terminal font size in px
 *   --ui-maxwidth     max width of the terminal column (px or 'none')
 *
 * DISPLAY MODES (State.settings.displayMode):
 *   'fill'        — (NEW DEFAULT) fill the viewport as much as possible. The
 *                   terminal font + canvas grow to use the available space
 *                   (fractional scale allowed), column width uncapped. This is
 *                   what "make the UI fill more of the screen" asks for.
 *   'fit'         — largest INTEGER scale that fits (crisp pixels, some
 *                   letterboxing). The classic retro look.
 *   'manual'      — honor State.settings.displayScale (1..8), ignoring fit.
 *   'resolution'  — target a specific logical resolution (e.g. 1280×720). The
 *                   UI is scaled so its design footprint maps onto that
 *                   resolution; in windowed mode the body is sized to it.
 *
 * RESOLUTIONS (State.settings.displayResolution), used when mode==='resolution':
 *   one of DISPLAY_RESOLUTIONS keys, e.g. '1280x720'. 'native' = current
 *   window size.
 *
 * The module exposes window.DisplayManager with:
 *   apply()                 — recompute + push CSS vars (call on load, resize,
 *                             setting change, fullscreen change)
 *   computeFillScale()      — fractional scale for 'fill' mode
 *   computeFitScale()       — integer scale for 'fit' mode
 *   cycleMode() / cycleResolution() / nudgeScale(±1)  — settings helpers
 *   describe()              — short human string of the current state
 *
 * Design footprint: the title/scene canvas is authored at 384×288. The
 * terminal is authored around ~110 columns. We size everything off the canvas
 * footprint and let the terminal font track it.
 */
(function () {
    'use strict';

    const BASE_W = 384, BASE_H = 288;      // title/scene canvas design size
    const MARGIN = 64;                      // breathing room (px): canvas has
                                            // ~48px vertical margin + a prompt
                                            // line below it on the title screen,
                                            // so leave generous headroom.

    // Selectable target resolutions for 'resolution' mode.
    const DISPLAY_RESOLUTIONS = [
        { key: 'native',    label: 'NATIVE',     w: 0,    h: 0    },
        { key: '800x600',   label: '800×600',    w: 800,  h: 600  },
        { key: '1024x768',  label: '1024×768',   w: 1024, h: 768  },
        { key: '1280x720',  label: '1280×720',   w: 1280, h: 720  },
        { key: '1366x768',  label: '1366×768',   w: 1366, h: 768  },
        { key: '1600x900',  label: '1600×900',   w: 1600, h: 900  },
        { key: '1920x1080', label: '1920×1080',  w: 1920, h: 1080 },
        { key: '2560x1440', label: '2560×1440',  w: 2560, h: 1440 },
    ];

    const DISPLAY_MODES = [
        { key: 'fill',       label: 'FILL SCREEN' },
        { key: 'fit',        label: 'FIT (CRISP)' },
        { key: 'manual',     label: 'MANUAL' },
        { key: 'resolution', label: 'RESOLUTION' },
    ];

    function settings() {
        // Tolerate being called before the game state exists.
        return (typeof window.MultiplexGame !== 'undefined' && window.MultiplexGame.State)
            ? window.MultiplexGame.State.settings
            : (window.State ? window.State.settings : {});
    }

    // Effective viewport size — the window, or the chosen target resolution.
    function viewport() {
        const s = settings();
        if (s.displayMode === 'resolution' && s.displayResolution && s.displayResolution !== 'native') {
            const r = DISPLAY_RESOLUTIONS.find(x => x.key === s.displayResolution);
            if (r && r.w) return { w: r.w, h: r.h };
        }
        return { w: window.innerWidth, h: window.innerHeight };
    }

    // Largest INTEGER scale that fits the viewport (>=1).
    function computeFitScale() {
        const v = viewport();
        const sx = Math.floor((v.w - MARGIN) / BASE_W);
        const sy = Math.floor((v.h - MARGIN) / BASE_H);
        return Math.max(1, Math.min(8, Math.min(sx, sy)));
    }

    // Fractional scale that fills the viewport (>=1). Allows non-integer so the
    // UI grows to use the whole screen instead of leaving big margins.
    function computeFillScale() {
        const v = viewport();
        const sx = (v.w - MARGIN) / BASE_W;
        const sy = (v.h - MARGIN) / BASE_H;
        // Use the smaller axis so nothing overflows, but allow fractional.
        return Math.max(1, Math.min(8, Math.min(sx, sy)));
    }

    // Rendered width (px) of ONE terminal character cell at `px` font size,
    // measured with an off-screen probe in the terminal font. Cached per size
    // (the font is bundled, so the answer never changes within a session).
    const _cellCache = {};
    function cellWidth(px) {
        if (_cellCache[px]) return _cellCache[px];
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;' +
            'font-family:var(--font);font-size:' + px + 'px;letter-spacing:normal;';
        probe.textContent = '│'.repeat(50) + 'M'.repeat(50);   // box-drawing + letters (the frame mixes both)
        document.body.appendChild(probe);
        const w = probe.getBoundingClientRect().width / 100;
        probe.remove();
        // Fall back to the 0.6em estimate if the probe couldn't lay out (e.g.
        // called before <body> exists). Don't cache a failed measurement.
        if (!(w > 0)) return px * 0.6;
        return (_cellCache[px] = w);
    }

    // Resolve the active scale for the current mode.
    function activeScale() {
        const s = settings();
        switch (s.displayMode) {
            case 'fit':    return computeFitScale();
            case 'manual': {
                const n = parseInt(s.displayScale, 10);
                return (n >= 1 && n <= 8) ? n : 2;
            }
            case 'resolution': {
                // Fit the design footprint into the target resolution (integer
                // for crispness, but allow the fill look by using fractional if
                // the target is small).
                return computeFitScale();
            }
            case 'fill':
            default:
                return computeFillScale();
        }
    }

    // Push the computed values to CSS variables.
    function apply() {
        const s = settings();
        // Back-compat: if an old save only has displayScale + display, infer a
        // mode. (Old 'display' was 'standard'|'widescreen'.)
        if (!s.displayMode) {
            if (s.displayScale && s.displayScale !== 'auto') s.displayMode = 'manual';
            else s.displayMode = 'fill';      // NEW DEFAULT: fill the screen
        }

        const scale = activeScale();
        // Terminal font tracks scale: ~8 + 3*scale, fractional ok. Clamp to a
        // sane range so 'fill' on an ultrawide doesn't make giant text. #16:
        // raised the ceiling so big displays get larger, more readable text.
        let fontPx = Math.max(10, Math.min(40, 8 + 3 * scale));

        // in FILL mode the scale is driven by the title-canvas footprint,
        // which is limited by HEIGHT — leaving the (120-col) terminal text
        // narrow with big side margins. Compute a WIDTH-driven font size so the
        // text grows to fill the available width: a monospace glyph is ~0.6em
        // wide, the UI is ~120 cols, and we target the usable width (capped by
        // --ui-maxwidth). Use the larger of the two so the screen actually
        // fills, but clamp so the rows still fit vertically.
        if (s.displayMode === 'fill') {
            const v = viewport();
            // #2: size the font to the CURRENT screen so each one fills the window.
            // A fixed 38-row / 120-col guess made the shorter gameplay screen sit
            // small with big side+bottom margins. Measure the live grid instead:
            // rows = lines in #display, cols = widest line. The fixed bottom stack
            // (prompt+controls+hotkey) is reserved as ~3.8 extra rows so the grid
            // grows right down to it without overlapping.
            const disp = document.getElementById('display');
            let rows = 36, cols = 120;
            if (disp && disp.textContent) {
                const lines = disp.textContent.replace(/\n+$/, '').split('\n');
                rows = Math.max(22, lines.length);
                cols = Math.max(80, lines.reduce((m, l) => Math.max(m, l.length), 0));
            }
            const GLYPH = 0.6;
            const usableW = (v.w * 0.997) - 14;            // nearly edge-to-edge
            const widthFont  = usableW / (cols * GLYPH);
            // (rows + 3.8) folds in the fixed bottom stack; -40 leaves a small top
            // pad + a safety gap so the grid never tucks under the bottom bars.
            const heightFont = (v.h - 40) / (rows + 3.8);
            // Use the size that FITS the grid in both directions. (This used to
            // be max(canvasFont, fit), which let the canvas-derived floor win in
            // small windows / iframes — e.g. a 960px embed got ~15px text for a
            // 134-col frame and the right-hand STATS/LOG panel ran off-screen. On
            // big screens the fit is already the larger value, so nothing changes
            // there.)
            fontPx = Math.min(widthFont, heightFont);
            // #5: the terminal font fills the content to the panel; the panels were
            // enlarged to hold MORE text, but the glyphs scaled up with them. Pull
            // the computed size down a notch so the UI reads denser (more rows/cols
            // visible) without shrinking the panels themselves. Tune UI_TEXT_SCALE.
            // #5/#1: keep the text at its good "denser" size — the player wants the
            // FRAMES bigger (more content, bigger game window), NOT bigger glyphs.
            const UI_TEXT_SCALE = 0.86;
            fontPx = fontPx * UI_TEXT_SCALE;
            fontPx = Math.max(9, Math.min(56, fontPx));

            // WIDTH GUARANTEE. The estimate above assumes 0.6em glyphs and no
            // side padding, and at load (#display still empty) it only knows the
            // 120-col default, but the in-game frame is UI_TOTAL_W (136) columns,
            // #terminal adds its own side padding, and at small sizes the browser
            // rounds glyph advances UP (11px text → 7px cells, 0.636em). In a
            // small window/iframe that pushed the right-hand panel off-screen. So
            // measure the real rendered cell width and step the (whole-px) size
            // down until the widest frame actually fits.
            const frameCols = Math.max(cols, (typeof UI_TOTAL_W === 'number') ? UI_TOTAL_W : 0);
            const term = document.getElementById('terminal');
            const tcs = term ? getComputedStyle(term) : null;
            const padX = tcs ? (parseFloat(tcs.paddingLeft) || 0) + (parseFloat(tcs.paddingRight) || 0) : 48;
            fontPx = Math.round(fontPx);
            while (fontPx > 9 && cellWidth(fontPx) * frameCols + padX > v.w) fontPx--;
        }
        // Column width: #16 — fill mode goes truly edge-to-edge (100vw); other
        // modes keep a wide cap so chargen, menus, the in-game UI, and minigames
        // all breathe on larger monitors.
        const maxWidth = (s.displayMode === 'fill') ? '100%' : '1760px';

        const root = document.documentElement;
        root.style.setProperty('--ui-scale', String(scale));
        // Snap to a WHOLE pixel: the terminal UI is drawn with box-drawing glyphs
        // (│ ─ ├ …) at line-height 1.0, so a fractional font size makes each row a
        // fractional height — the verticals land off the pixel grid and the frame
        // looks broken/segmented. An integer px keeps the rows pixel-aligned.
        root.style.setProperty('--term-font-size', Math.round(fontPx) + 'px');
        root.style.setProperty('--ui-maxwidth', maxWidth);

        // In 'resolution' + windowed mode, size the body to the chosen
        // resolution and center it, so the game presents at that exact size.
        if (s.displayMode === 'resolution' && s.displayResolution && s.displayResolution !== 'native' && !isFullscreen()) {
            const r = DISPLAY_RESOLUTIONS.find(x => x.key === s.displayResolution);
            if (r && r.w) {
                root.style.setProperty('--ui-fixed-w', r.w + 'px');
                root.style.setProperty('--ui-fixed-h', r.h + 'px');
                document.body.classList.add('fixed-resolution');
            }
        } else {
            document.body.classList.remove('fixed-resolution');
            root.style.removeProperty('--ui-fixed-w');
            root.style.removeProperty('--ui-fixed-h');
        }
    }

    function isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    // ── Settings helpers ────────────────────────────────────────────────────
    function cycleMode() {
        const s = settings();
        const i = DISPLAY_MODES.findIndex(m => m.key === (s.displayMode || 'fill'));
        s.displayMode = DISPLAY_MODES[(i + 1) % DISPLAY_MODES.length].key;
        apply();
    }
    function cycleResolution() {
        const s = settings();
        const i = DISPLAY_RESOLUTIONS.findIndex(r => r.key === (s.displayResolution || 'native'));
        s.displayResolution = DISPLAY_RESOLUTIONS[(i + 1) % DISPLAY_RESOLUTIONS.length].key;
        apply();
    }
    function nudgeScale(delta) {
        const s = settings();
        // Nudging implies manual mode.
        s.displayMode = 'manual';
        let n = parseInt(s.displayScale, 10); if (!(n >= 1 && n <= 8)) n = 2;
        n = Math.max(1, Math.min(8, n + delta));
        s.displayScale = String(n);
        apply();
    }

    function describe() {
        const s = settings();
        const mode = (DISPLAY_MODES.find(m => m.key === (s.displayMode || 'fill')) || {}).label || 'FILL';
        if (s.displayMode === 'manual') return mode + ' ' + (s.displayScale || '2') + '×';
        if (s.displayMode === 'resolution') {
            const r = DISPLAY_RESOLUTIONS.find(x => x.key === (s.displayResolution || 'native'));
            return mode + ' ' + (r ? r.label : 'NATIVE');
        }
        return mode + ' (' + activeScale().toFixed(s.displayMode === 'fill' ? 1 : 0) + '×)';
    }

    // Recompute on resize + fullscreen transitions.
    window.addEventListener('resize', apply);
    document.addEventListener('fullscreenchange', apply);
    document.addEventListener('webkitfullscreenchange', apply);
    // The bundled terminal font swaps in after first paint; re-measure then so
    // cellWidth() isn't stuck with the fallback font's metrics.
    try {
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => { for (const k in _cellCache) delete _cellCache[k]; apply(); });
        }
    } catch (e) {}

    window.DisplayManager = {
        DISPLAY_RESOLUTIONS,
        DISPLAY_MODES,
        apply,
        computeFitScale,
        computeFillScale,
        activeScale,
        cycleMode,
        cycleResolution,
        nudgeScale,
        describe,
    };
})();
