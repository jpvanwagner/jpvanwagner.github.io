/**
 * Midnight at the Multiplex — In-Game Window Painter
 * ===================================================
 * Lets the PLAYER draw on glass windows at runtime (in preview, exported
 * maps, and the full game) the same way the Mapster editor's window-decal
 * canvas works. OFF BY DEFAULT — only enabled when the map's settings have
 * `allowWindowDraw: true` (a checkbox in the Mapster export settings).
 *
 * The engine (core/engine.js) calls `window.openInGamePainter(paintWin)` when
 * the player presses interact (Space) while facing a paintable glass window.
 * This module defines that function. It:
 *   1. Checks the global enable flag (window.__allowWindowDraw, set by engine
 *      from CONFIG.settings.allowWindowDraw). If off, shows a hint and bails.
 *   2. Opens a fullscreen overlay with a paint canvas sized to the window's
 *      tile width, pre-loaded with any existing decal (paintWin.meta.paintData).
 *   3. Brush / eraser / color / clear / save controls.
 *   4. On save, writes a data-URL back to paintWin.meta.paintData and applies
 *      it as the glass material's texture map (so it shows in 3D immediately),
 *      then closes the overlay and returns control to the game.
 *
 * Exposes:
 *   window.openInGamePainter(paintWin)
 *   window.__allowWindowDraw   (boolean gate; engine sets this at init)
 */
(function () {
    'use strict';

    let overlay = null;          // the DOM overlay (created lazily, reused)
    let activePaintWin = null;   // the window currently being painted
    let drawing = false;
    let mode = 'brush';          // brush|erase|line|rect|ellipse|fill
    let brushColor = '#ff2d95';
    let brushSize = 4;
    let _start = null;           // shape anchor (canvas px)
    let _snapshot = null;        // ImageData saved before a live shape drag

    // A small fixed palette (classic-paint feel) + the custom picker.
    const PALETTE = ['#000000','#7f7f7f','#ffffff','#c0c0c0',
                     '#ff2d95','#e11d48','#f59e0b','#fde047',
                     '#22c55e','#10b981','#0ea5e9','#2563eb',
                     '#7c3aed','#a855f7','#92400e','#bae6fd'];

    function ensureOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'ingame-window-painter';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:50000',
            'background:rgba(0,0,0,0.82)', 'display:none',
            'flex-direction:column', 'align-items:center', 'justify-content:center',
            'font-family:"GrandeRetro","MS Sans Serif",Tahoma,monospace', 'color:#000', 'gap:0',
        ].join(';');

        const toolBtn = (act, label) =>
            `<button data-act="${act}" class="igwp-tool" style="display:block;width:100%;margin:2px 0;background:#c0c0c0;color:#000;border:2px solid #fff;border-right-color:#404040;border-bottom-color:#404040;padding:3px 4px;cursor:pointer;font:11px sans-serif;">${label}</button>`;
        const swatches = PALETTE.map(c =>
            `<button data-swatch="${c}" title="${c}" style="width:16px;height:16px;background:${c};border:1px solid #555;cursor:pointer;padding:0;"></button>`).join('');

        // Win9x-style framed window: title bar, then a tool column + canvas, then
        // a palette strip and the action buttons.
        overlay.innerHTML = `
          <div style="background:#c0c0c0;border:2px solid #fff;border-right-color:#404040;border-bottom-color:#404040;box-shadow:3px 3px 0 rgba(0,0,0,0.5);padding:0 0 6px;">
            <div style="background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font:bold 12px sans-serif;padding:3px 6px;display:flex;justify-content:space-between;">
              <span>Window Paint</span><span data-act="cancel" style="cursor:pointer;padding:0 4px;background:#c0c0c0;color:#000;border:1px solid #fff;border-right-color:#404040;border-bottom-color:#404040;">×</span>
            </div>
            <div style="display:flex;gap:6px;padding:6px;">
              <div style="display:flex;flex-direction:column;width:64px;">
                ${toolBtn('brush','✏ Brush')}
                ${toolBtn('erase','▦ Eraser')}
                ${toolBtn('line','╱ Line')}
                ${toolBtn('rect','▭ Rect')}
                ${toolBtn('ellipse','◯ Ellipse')}
                ${toolBtn('fill','▣ Fill')}
                <div style="margin-top:6px;font:10px sans-serif;color:#222;">Size</div>
                <input type="range" id="igwp-size" min="1" max="16" value="4" style="width:60px;">
                <div id="igwp-sizeval" style="font:10px sans-serif;text-align:center;">4</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <canvas id="igwp-canvas" width="64" height="64"
                  style="background:#10243a;border:2px solid #404040;image-rendering:pixelated;cursor:crosshair;touch-action:none;"></canvas>
                <div style="display:flex;align-items:center;gap:6px;">
                  <div style="display:grid;grid-template-columns:repeat(8,16px);grid-auto-rows:16px;gap:2px;border:1px solid #808080;padding:2px;background:#c0c0c0;">${swatches}</div>
                  <div style="display:flex;flex-direction:column;align-items:center;">
                    <div id="igwp-current" style="width:22px;height:22px;background:#ff2d95;border:1px solid #000;"></div>
                    <input type="color" id="igwp-color" value="#ff2d95" style="width:24px;height:18px;border:none;background:none;cursor:pointer;" title="Custom color">
                  </div>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:6px;justify-content:flex-end;padding:0 8px;">
              <button data-act="clear" style="background:#c0c0c0;border:2px solid #fff;border-right-color:#404040;border-bottom-color:#404040;padding:3px 10px;cursor:pointer;font:11px sans-serif;">Clear</button>
              <button data-act="save" style="background:#c0c0c0;border:2px solid #fff;border-right-color:#404040;border-bottom-color:#404040;padding:3px 12px;cursor:pointer;font:bold 11px sans-serif;">Save &amp; Close</button>
              <button data-act="cancel" style="background:#c0c0c0;border:2px solid #fff;border-right-color:#404040;border-bottom-color:#404040;padding:3px 10px;cursor:pointer;font:11px sans-serif;">Cancel</button>
            </div>
          </div>
          <div style="font:11px sans-serif;color:#cbd5e1;margin-top:8px;">Click &amp; drag on the glass. Shapes: press, drag, release. Esc cancels.</div>
        `;
        document.body.appendChild(overlay);

        const canvas = overlay.querySelector('#igwp-canvas');
        const ctx = canvas.getContext('2d');

        const posFromEvent = (e) => {
            const rect = canvas.getBoundingClientRect();
            const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
            return { x: Math.floor(cx / rect.width * canvas.width), y: Math.floor(cy / rect.height * canvas.height) };
        };
        const dab = (p) => {
            if (mode === 'erase') { ctx.clearRect(Math.round(p.x - brushSize / 2), Math.round(p.y - brushSize / 2), brushSize, brushSize); }
            else { ctx.fillStyle = brushColor; ctx.fillRect(Math.round(p.x - brushSize / 2), Math.round(p.y - brushSize / 2), brushSize, brushSize); }
        };
        // Flood fill (4-connected) for the bucket tool.
        const floodFill = (sx, sy) => {
            const W = canvas.width, H = canvas.height;
            const img = ctx.getImageData(0, 0, W, H); const d = img.data;
            const idx = (x, y) => (y * W + x) * 4;
            const tc = document.createElement('canvas'); tc.width = tc.height = 1; const tcx = tc.getContext('2d');
            tcx.fillStyle = brushColor; tcx.fillRect(0, 0, 1, 1); const fc = tcx.getImageData(0, 0, 1, 1).data;
            const si = idx(sx, sy); const tgt = [d[si], d[si+1], d[si+2], d[si+3]];
            if (tgt[0]===fc[0]&&tgt[1]===fc[1]&&tgt[2]===fc[2]&&tgt[3]===fc[3]) return;
            const match = (i) => Math.abs(d[i]-tgt[0])<8 && Math.abs(d[i+1]-tgt[1])<8 && Math.abs(d[i+2]-tgt[2])<8 && Math.abs(d[i+3]-tgt[3])<24;
            const stack = [[sx, sy]];
            while (stack.length) {
                const [x, y] = stack.pop(); if (x<0||y<0||x>=W||y>=H) continue; const i = idx(x, y); if (!match(i)) continue;
                d[i]=fc[0]; d[i+1]=fc[1]; d[i+2]=fc[2]; d[i+3]=fc[3];
                stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
            }
            ctx.putImageData(img, 0, 0);
        };
        const drawShapePreview = (a, b) => {
            if (_snapshot) ctx.putImageData(_snapshot, 0, 0);
            ctx.strokeStyle = brushColor; ctx.fillStyle = brushColor; ctx.lineWidth = brushSize;
            ctx.beginPath();
            if (mode === 'line') { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
            else if (mode === 'rect') { ctx.strokeRect(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.abs(b.x-a.x), Math.abs(b.y-a.y)); }
            else if (mode === 'ellipse') { ctx.ellipse((a.x+b.x)/2, (a.y+b.y)/2, Math.abs(b.x-a.x)/2, Math.abs(b.y-a.y)/2, 0, 0, Math.PI*2); ctx.stroke(); }
        };

        const start = (e) => {
            e.preventDefault(); drawing = true; const p = posFromEvent(e); _start = p;
            if (mode === 'fill') { floodFill(p.x, p.y); drawing = false; return; }
            if (mode === 'line' || mode === 'rect' || mode === 'ellipse') { _snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height); return; }
            dab(p);
        };
        const move = (e) => {
            if (!drawing) return; e.preventDefault(); const p = posFromEvent(e);
            if (mode === 'line' || mode === 'rect' || mode === 'ellipse') { drawShapePreview(_start, p); }
            else { dab(p); }
        };
        const end = (e) => {
            if (!drawing) return; drawing = false;
            if ((mode === 'line' || mode === 'rect' || mode === 'ellipse') && _start) {
                const p = e && (e.changedTouches ? posFromEvent({ touches: e.changedTouches }) : posFromEvent(e));
                if (p) drawShapePreview(_start, p);
            }
            _snapshot = null; _start = null;
        };
        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
        canvas.addEventListener('touchstart', start, { passive: false });
        canvas.addEventListener('touchmove', move, { passive: false });
        canvas.addEventListener('touchend', end);

        const setColor = (c) => { brushColor = c; if (mode === 'erase') mode = 'brush'; const cur = overlay.querySelector('#igwp-current'); if (cur) cur.style.background = c; const cp = overlay.querySelector('#igwp-color'); if (cp) cp.value = c; highlightTool(); };
        overlay.querySelector('#igwp-color').addEventListener('input', (e) => setColor(e.target.value));
        overlay.querySelector('#igwp-size').addEventListener('input', (e) => { brushSize = parseInt(e.target.value, 10) || 4; const v = overlay.querySelector('#igwp-sizeval'); if (v) v.textContent = brushSize; });

        function highlightTool() {
            overlay.querySelectorAll('.igwp-tool').forEach(b => {
                const on = b.getAttribute('data-act') === mode;
                b.style.borderColor = on ? '#404040 #fff #fff #404040' : '#fff #404040 #404040 #fff';
                b.style.background = on ? '#d4d0c8' : '#c0c0c0';
            });
        }

        overlay.addEventListener('click', (e) => {
            const sw = e.target && e.target.getAttribute && e.target.getAttribute('data-swatch');
            if (sw) { setColor(sw); return; }
            const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
            if (!act) return;
            if (['brush','erase','line','rect','ellipse','fill'].includes(act)) { mode = act; highlightTool(); }
            else if (act === 'clear') ctx.clearRect(0, 0, canvas.width, canvas.height);
            else if (act === 'cancel') closePainter();
            else if (act === 'save') savePainter();
        });

        overlay._canvas = canvas;
        overlay._ctx = ctx;
        overlay._highlightTool = highlightTool;
        return overlay;
    }

    function closePainter() {
        if (overlay) overlay.style.display = 'none';
        activePaintWin = null;
        drawing = false;
        // #esc-painter: remove the Esc interceptor when the painter closes.
        if (_painterEscHandler) { document.removeEventListener('keydown', _painterEscHandler, true); _painterEscHandler = null; }
        // Hand focus back so movement keys work immediately.
        try { window.focus(); } catch (e) {}
        try { document.body && document.body.focus(); } catch (e) {}
    }
    let _painterEscHandler = null;

    function savePainter() {
        if (!activePaintWin || !overlay) { closePainter(); return; }
        const canvas = overlay._canvas;
        const dataUrl = canvas.toDataURL('image/png');
        activePaintWin.meta.paintData = dataUrl;

        // Capture references NOW (closePainter() nulls activePaintWin synchronously
        // but the Image.onload fires later).
        try {
            const THREE = window.THREE;
            const slab = activePaintWin.slab;         // the window (group for framed windows)
            const pane = activePaintWin.mesh || slab; // the GLASS pane specifically — size/parent to THIS so
                                                      // the drawing stays on the glass and never bleeds onto
                                                      // the frame/mullions or the surrounding wall.
            const isH  = activePaintWin.isH;          // horizontal (n/s) vs vertical (e/w) edge
            const far  = !!activePaintWin.paintFar;   // which face to paint
            if (THREE && pane) {
                const img = new Image();
                img.onload = () => {
                    const tex = new THREE.Texture(img);
                    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
                    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
                    tex.needsUpdate = true;
                    // a DOUBLE-SIDED decal plane laid against the glass so
                    // the drawing reads THROUGH to the other side too (viewed from
                    // behind it naturally appears mirrored, like writing on a window).
                    // Was FrontSide, which only showed it on the side you drew from.
                    const bb = new THREE.Box3().setFromObject(pane);
                    const sizeX = bb.max.x - bb.min.x, sizeY = bb.max.y - bb.min.y, sizeZ = bb.max.z - bb.min.z;
                    // Inset a frame margin on every side so strokes near the canvas
                    // edge stop before the glass edge (no overlap onto the frame).
                    const MARGIN = 0.09;
                    const planeW = Math.max(0.1, (isH ? sizeX : sizeZ) - MARGIN * 2);
                    const planeH = Math.max(0.1, sizeY - MARGIN * 2);
                    const decalMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthWrite: false });
                    const decal = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), decalMat);
                    decal.userData.isPaintDecal = true;
                    // Local offset off the chosen face. Glass thickness ~0.15 → ±0.085.
                    const off = 0.085 * (far ? -1 : 1);
                    // Plane default faces +Z. For a horizontal (n/s) wall the glass
                    // spans X and its normal is Z → plane is already aligned; offset
                    // in Z and flip for the far face. For a vertical (e/w) wall the
                    // normal is X → rotate the plane 90° about Y and offset in X.
                    if (isH) {
                        decal.position.set(0, 0, off);
                        decal.rotation.y = far ? Math.PI : 0;
                    } else {
                        decal.rotation.y = far ? -Math.PI / 2 : Math.PI / 2;
                        decal.position.set(off, 0, 0);
                    }
                    // Remove any previous decal on this pane, then attach (centered
                    // on the glass — the pane's local origin is its centre).
                    for (let i = pane.children.length - 1; i >= 0; i--) { if (pane.children[i].userData && pane.children[i].userData.isPaintDecal) pane.remove(pane.children[i]); }
                    pane.add(decal);
                };
                img.src = dataUrl;
            }
        } catch (e) { /* non-fatal */ }
        closePainter();
    }

    // Called by the engine when the player interacts with a paintable window.
    window.openInGamePainter = function (paintWin) {
        // Per-window gate: each window opts in via meta.allowDraw. The
        // engine already checks this before calling, but we re-check defensively.
        if (!paintWin || !paintWin.meta || !paintWin.meta.allowDraw) {
            if (typeof window.engineShowMsg === 'function') window.engineShowMsg('This window cannot be drawn on.');
            return;
        }
        activePaintWin = paintWin;
        const ov = ensureOverlay();
        const canvas = ov._canvas, ctx = ov._ctx;
        // #1/#5: AUTO-SHAPE the canvas to the actual window. Width = tile count,
        // height = the glass slab's height/width ratio (so a wide run of glass
        // gets a wide canvas, a tall window a tall one). 64px per tile-unit.
        const tiles = (paintWin.meta && paintWin.meta.canvasWidth) || 1;
        let aspectH = 1;   // height as a fraction of one tile width
        try {
            if (paintWin.slab && window.THREE) {
                const bb = new window.THREE.Box3().setFromObject(paintWin.slab);
                const w = Math.max(0.1, paintWin.isH ? (bb.max.x - bb.min.x) : (bb.max.z - bb.min.z));
                const h = Math.max(0.1, bb.max.y - bb.min.y);
                aspectH = Math.max(0.25, Math.min(3, (h / w)));
            }
        } catch (e) {}
        canvas.width = Math.round(64 * tiles);
        canvas.height = Math.round(64 * tiles * aspectH / Math.max(1, tiles));
        if (canvas.height < 24) canvas.height = 24;
        // Display size: keep it miniaturized but readable; cap to viewport.
        const dispW = Math.min(window.innerWidth * 0.5, 64 * tiles * 4);
        canvas.style.width = Math.round(dispW) + 'px';
        canvas.style.height = Math.round(dispW * (canvas.height / canvas.width)) + 'px';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Pre-load any existing decal so the player edits rather than restarts.
        if (paintWin.meta && paintWin.meta.paintData) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            img.src = paintWin.meta.paintData;
        }
        if (ov._highlightTool) ov._highlightTool();
        ov.style.display = 'flex';
        // #esc-painter: capture Esc so it CLOSES the painter (and Save with Enter),
        // without bubbling to the game's ESC pause menu.
        if (_painterEscHandler) document.removeEventListener('keydown', _painterEscHandler, true);
        _painterEscHandler = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePainter(); }
        };
        document.addEventListener('keydown', _painterEscHandler, true);
    };
    // engine calls this to let the player pick. A tiny retro chooser with two
    // buttons; Esc cancels (without opening the game's ESC menu — we stop the key).
    window.engineOpenWindowChoice = function (opts) {
        opts = opts || {};
        let el = document.getElementById('window-choice');
        if (!el) {
            el = document.createElement('div');
            el.id = 'window-choice';
            el.className = 'win95-win';   // #9 batch: shared clean win95 theme
            const host = document.getElementById('game-container');
            el.style.cssText = 'position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:70;min-width:240px;';
            (host || document.body).appendChild(el);
        }
        const close = () => { el.style.display = 'none'; document.removeEventListener('keydown', onKey, true); };
        // keyboard nav — ←/→/↑/↓ and Tab cycle Draw/Break/Cancel
        // (Shift+Tab back), Enter/Space "click" the focused one. The chooser is
        // OPENED with Space, so Enter/Space are ignored for the first 200ms to
        // swallow key-repeat from the opening press.
        const armedAt = Date.now();
        let btns = [];
        const cycle = (dir) => { const i = btns.indexOf(document.activeElement); btns[(i < 0 ? 0 : (i + dir + btns.length) % btns.length)].focus(); };
        const onKey = (e) => {
            const k = e.key;
            if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
            if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); cycle(-1); return; }
            if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); cycle(+1); return; }
            if (k === 'Tab') { e.preventDefault(); e.stopPropagation(); cycle(e.shiftKey ? -1 : +1); return; }
            if (k === 'Enter' || k === ' ') {
                e.preventDefault(); e.stopPropagation();
                if (Date.now() - armedAt < 200) return;   // swallow the opening Space's repeat
                const a = document.activeElement;
                if (btns.includes(a)) a.click();
            }
        };
        el.innerHTML =
            '<div class="win95-title"><span>This window</span></div>' +
            '<div class="win95-body">What would you like to do?' +
            '<div style="margin-top:12px;display:flex;gap:8px;justify-content:center">' +
            '<button id="wc-draw" class="win95-btn">Draw</button>' +
            '<button id="wc-break" class="win95-btn">Break</button>' +
            '<button id="wc-cancel" class="win95-btn">Cancel</button>' +
            '</div></div>';
        el.style.display = 'block';
        document.addEventListener('keydown', onKey, true);
        el.querySelector('#wc-draw').onclick  = () => { close(); if (opts.onDraw) opts.onDraw(); };
        el.querySelector('#wc-break').onclick = () => { close(); if (opts.onBreak) opts.onBreak(); };
        el.querySelector('#wc-cancel').onclick = close;
        btns = Array.from(el.querySelectorAll('button'));   // collected after the markup is set
        if (btns[0]) btns[0].focus();                       // Draw starts focused
    };
})();
