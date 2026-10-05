/**
 * WINDOW-MANAGER.JS - Creates and manages every program window on the desktop (global: WM).
 * Each window = title bar (drag), _ / □ / X buttons, and resize handles on every edge and corner.
 * Also adds a taskbrick per window.
 *
 * Quick reference:
 *   WM.open(id, title, html, iconUrl, opts)  open a window (or focus it if that id is already open)
 *        opts (all optional): { width, height }  starting size in px (clamped to the screen)
 *                             { center: true }   center it in the work area
 *                             { fullscreen: true } adds Mute + Full screen buttons on the game screen
 *                                                (apps and games: fills the whole screen; Esc exits)
 *                             { fit: fn(area) }  returns {left, top, width, height}; the window
 *                                                re-fits whenever the screen or taskbricks change,
 *                                                until the visitor moves or resizes it
 *   WM.close(id) / minimize(id) / maximize(id) / toggle(id) / focus(id)
 *   WM.workArea()                            the screen area not covered by the taskbricks
 *   setupDragging / setupResizing            pointer (mouse + touch + pen) handling (internal)
 *
 * Window ids become element ids as "window-<id>". Styles: desktop/css/windows.css
 *
 * Why the "shield": while dragging or resizing, the pointer often passes over an <iframe>
 * (the browser, games, courses) which would swallow the mouse events and make the window
 * stick or jump. body.wm-busy (see windows.css) switches iframes to pointer-events:none
 * for the duration of the gesture, and pointer capture keeps events flowing to us.
 */
const WM = {
    windows: {},
    zIndex: 100,
    MIN_W: 220,     // smallest a window can be resized to
    MIN_H: 140,

    init() {
        window.addEventListener('resize', () => this.onScreenResize());
    },

    /**
     * Screen area available to windows: everything above the taskbricks.
     * Calculated from the taskbrick rows (taskbricks.js places row N at a fixed height), not
     * measured from the screen, because the bricks may still be sliding into place.
     */
    workArea() {
        let bottom = window.innerHeight;
        if (!document.body.classList.contains('autohide-bricks')) {
            const tb = window.TaskBricks;
            if (tb && tb.bricks && Object.keys(tb.bricks).length) {
                let maxRow = 0;
                Object.values(tb.bricks).forEach(b => { if (!b.isFree || b.id === 'system-tray') maxRow = Math.max(maxRow, b.row || 0); });
                bottom = window.innerHeight - tb.brickHeight - 5 - maxRow * (tb.brickHeight + tb.brickGap) - 4;
            } else {
                bottom -= 42;                     // bricks not built yet: assume one row
            }
        }
        return { left: 0, top: 0, width: window.innerWidth, height: Math.max(200, bottom - 2) };
    },

    open(id, title, contentHtml, iconUrl = 'images/icons/logo.svg', opts = {}) {
        if (this.windows[id]) {
            if (this.windows[id].style.display === 'none') {
                this.toggle(id);
            }
            this.focus(id);
            return;
        }

        const container = document.getElementById('window-container');
        const win = document.createElement('div');
        win.className = 'window';
        win.id = `window-${id}`;

        // Starting size/position: callers may pass opts, or resize the window right after opening
        const area = this.workArea();
        const offset = (Object.keys(this.windows).length % 5) * 20;
        const isMobile = window.innerWidth < 768;
        const w = Math.min(opts.width || (isMobile ? area.width * 0.92 : 400), area.width - 8);
        const h = Math.min(opts.height || (isMobile ? area.height * 0.6 : 300), area.height - 8);
        win.style.width = w + 'px';
        win.style.height = h + 'px';
        if (opts.center || isMobile) {
            const nudge = isMobile ? 0 : offset;          // no cascade offset on phones (it would push off-screen)
            win.style.left = Math.max(0, Math.min(area.width - w, (area.width - w) / 2 + nudge)) + 'px';
            win.style.top = Math.max(0, (area.height - h) / 2 + (isMobile ? 0 : offset / 2)) + 'px';
        } else {
            win.style.left = (20 + offset) + 'px';
            win.style.top = (20 + offset) + 'px';
        }

        // Auto-fit windows (e.g. the browser) get their geometry from the caller
        if (opts.fit) {
            win._fit = opts.fit;
            this.applyFit(win, area);
        }

        win.dataset.isMaximized = "false";

        win.innerHTML = `
            <div class="title-bar" id="title-${id}" title="Drag to move · double-click to maximize">
                <div class="title-label">
                    <img src="${iconUrl}" alt="">
                    <span>${title}</span>
                </div>
                <div class="win-controls">
                    <button type="button" class="wc-min" title="Minimize" aria-label="Minimize" onclick="WM.minimize('${id}')">_</button>
                    <button type="button" class="wc-max" title="Maximize" aria-label="Maximize" onclick="WM.maximize('${id}', true)">□</button>
                    <button type="button" class="wc-close" title="Close" aria-label="Close" onclick="WM.close('${id}')">X</button>
                </div>
            </div>
            <div class="window-content">${contentHtml}</div>
            ${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<div class="resizer rz-${d}" data-dir="${d}"></div>`).join('')}
        `;

        win.addEventListener('pointerdown', () => this.focus(id));

        container.appendChild(win);
        this.windows[id] = win;
        // games and demos: tiny Mute + Full screen buttons on the game screen itself (shared/demo-controls.js)
        if (opts.fullscreen && window.DemoControls) DemoControls.enhance(win.querySelector('.window-content iframe'));

        if (typeof TaskBricks !== 'undefined') TaskBricks.addWindowBrick(id, title, iconUrl);

        this.setupDragging(id);
        this.setupResizing(id);
        this.focus(id);
        this.animateWin(win, 'pop');                    // a quick, subtle "pop" as it opens
    },

    applyFit(win, area) {
        const g = win._fit(area);
        win.style.left = Math.max(0, g.left) + 'px';
        win.style.top = Math.max(0, g.top) + 'px';
        win.style.width = Math.max(this.MIN_W, Math.min(g.width, area.width)) + 'px';
        win.style.height = Math.max(this.MIN_H, Math.min(g.height, area.height)) + 'px';
    },

    /** Keep windows reachable when the browser window (or phone orientation) changes size. */
    onScreenResize() {
        const area = this.workArea();
        Object.keys(this.windows).forEach(id => {
            const win = this.windows[id];
            if (win.dataset.isMaximized === "true") {
                this.fitToArea(win);
                return;
            }
            // Auto-fit windows the visitor hasn't moved or resized: fit them again
            if (win._fit && !win.dataset.userPlaced) {
                this.applyFit(win, area);
                return;
            }
            const r = win.getBoundingClientRect();
            if (r.width > area.width) win.style.width = (area.width - 8) + 'px';
            if (r.height > area.height) win.style.height = (area.height - 8) + 'px';
            const r2 = win.getBoundingClientRect();
            if (r2.right > area.width) win.style.left = Math.max(0, area.width - r2.width - 4) + 'px';
            if (r2.bottom > area.height) win.style.top = Math.max(0, area.height - r2.height - 4) + 'px';
        });
    },

    close(id) {
        const win = this.windows[id];
        if (win) {
            win.remove();
            delete this.windows[id];
            if (typeof TaskBricks !== 'undefined') TaskBricks.removeWindowBrick(id);
        }
    },

    focus(id) {
        this.zIndex++;
        const win = this.windows[id];
        if(win) {
            win.style.zIndex = this.zIndex;
            Object.values(this.windows).forEach(w => {
                const tb = w.querySelector('.title-bar');
                if(tb) tb.classList.remove('active');
            });
            const activeTb = win.querySelector('.title-bar');
            if(activeTb) activeTb.classList.add('active');
            if (typeof TaskBricks !== 'undefined') TaskBricks.setActive(id);
        }
    },

    toggle(id) {
        const win = this.windows[id];
        if (!win) return;
        if (parseInt(win.style.zIndex) === this.zIndex && win.style.display !== 'none') {
            this.minimize(id);
        } else {
            const wasHidden = win.style.display === 'none' || win.classList.contains('wm-shrink');
            clearTimeout(win._animT);
            win.style.display = 'flex';
            if (wasHidden) { this.zoomOutline(this.brickRect(id), win.getBoundingClientRect()); this.animateWin(win, 'grow', id); }
            this.focus(id);
        }
    },

    /**
     * Windows 95-style "zoom" effect: a thin outline slides from one rectangle to another
     * (window to taskbrick on minimize, and back on restore; old size to new on maximize).
     * Purely decorative. Shown to everyone (they're short and subtle); the window itself also
     * shrinks into / grows out of its taskbrick (animateWin, styles: windows.css "wm-anim").
     */
    zoomOutline(from, to) {
        if (!from || !to) return;
        const box = document.createElement('div');
        box.className = 'wm-zoom';
        const put = (r) => { box.style.left = r.left + 'px'; box.style.top = r.top + 'px'; box.style.width = r.width + 'px'; box.style.height = r.height + 'px'; };
        put(from);
        document.body.appendChild(box);
        box.getBoundingClientRect();                 // commit the start position before animating
        box.classList.add('go');
        put(to);
        setTimeout(() => box.remove(), 260);
    },

    brickRect(id) {
        const b = document.getElementById(`brick-${id}`);
        return b ? b.getBoundingClientRect() : null;
    },

    /** Play a short CSS animation on a window ('shrink' toward / 'grow' from its taskbrick, 'pop' when opened). */
    animateWin(win, kind, id, done) {
        const r = win.getBoundingClientRect(), b = id ? this.brickRect(id) : null;
        win.style.transformOrigin = b ? `${b.left + b.width / 2 - r.left}px ${b.top + b.height / 2 - r.top}px` : '50% 50%';
        win.classList.remove('wm-shrink', 'wm-grow', 'wm-pop');
        void win.offsetWidth;                          // restart the animation
        win.classList.add('wm-' + kind);
        clearTimeout(win._animT);
        win._animT = setTimeout(() => { win.classList.remove('wm-' + kind); win.style.transformOrigin = ''; if (done) done(); }, 200);
    },

    minimize(id) {
        const win = this.windows[id];
        if (win && win.style.display !== 'none') {
            this.zoomOutline(win.getBoundingClientRect(), this.brickRect(id));
            if (typeof TaskBricks !== 'undefined') TaskBricks.setActive('null-id');
            this.animateWin(win, 'shrink', id, () => { win.style.display = 'none'; });
        }
    },

    /** Full screen for one app/game window: its content fills the whole screen (Esc or the button again exits). */
    fullscreen(id) {
        const win = this.windows[id];
        if (!win) return;
        if (document.fullscreenElement) { document.exitFullscreen(); return; }
        // the game's box when it has the corner buttons (shared/demo-controls.js), so they come along
        const frame = win.querySelector('.window-content iframe');
        const el = (frame && frame.parentElement.classList.contains('demo-host') ? frame.parentElement : frame) || win.querySelector('.window-content');
        if (!el || !el.requestFullscreen) return;
        el.requestFullscreen().then(() => { try { frame && frame.contentWindow.focus(); } catch (e) {} }).catch(() => {});
    },

    /** Maximized windows fill the work area, so the taskbricks always stay visible. */
    fitToArea(win) {
        const area = this.workArea();
        win.style.left = area.left + 'px';
        win.style.top = area.top + 'px';
        win.style.width = area.width + 'px';
        win.style.height = area.height + 'px';
    },

    /** byUser = the visitor clicked □ or double-clicked the title (shows a one-time hint). */
    maximize(id, byUser = false) {
        const win = this.windows[id];
        if (!win) return;
        const btn = win.querySelector('.wc-max');
        const before = win.getBoundingClientRect();
        if (byUser) {                                   // glide to the new size instead of jumping
            win.classList.add('wm-sizing');
            clearTimeout(win._sizeT);
            win._sizeT = setTimeout(() => win.classList.remove('wm-sizing'), 220);
        }

        if (win.dataset.isMaximized === "true") {
            win.style.width = win.dataset.prevWidth;
            win.style.height = win.dataset.prevHeight;
            win.style.left = win.dataset.prevLeft;
            win.style.top = win.dataset.prevTop;
            win.classList.remove('maximized');
            win.dataset.isMaximized = "false";
            if (btn) { btn.textContent = '□'; btn.title = 'Maximize'; }
        } else {
            win.dataset.prevWidth = win.style.width;
            win.dataset.prevHeight = win.style.height;
            win.dataset.prevLeft = win.style.left;
            win.dataset.prevTop = win.style.top;
            win.classList.add('maximized');
            this.fitToArea(win);
            win.dataset.isMaximized = "true";
            if (btn) { btn.textContent = '❐'; btn.title = 'Restore down'; }
            if (byUser && window.FeatureHints) FeatureHints.show('maximize');
        }
        if (byUser) this.zoomOutline(before, win.getBoundingClientRect());
        this.focus(id);
    },

    /**
     * Shared pointer-gesture helper: calls onMove(dx, dy, event) until the pointer is released.
     * Uses pointer capture + the iframe shield so the gesture can't get "stuck".
     */
    gesture(e, onMove, onEnd) {
        if (e.button !== undefined && e.button !== 0) return;   // left button / touch only
        e.preventDefault();
        e.stopPropagation();
        const target = e.currentTarget;
        const sX = e.clientX, sY = e.clientY;
        try { target.setPointerCapture(e.pointerId); } catch (err) {}
        document.body.classList.add('wm-busy');
        const move = (ev) => onMove(ev.clientX - sX, ev.clientY - sY, ev);
        const up = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', up);
            target.removeEventListener('pointercancel', up);
            document.body.classList.remove('wm-busy');
            if (onEnd) onEnd();
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', up);
        target.addEventListener('pointercancel', up);
    },

    setupDragging(id) {
        const win = this.windows[id];
        const titleBar = win.querySelector('.title-bar');
        titleBar.ondblclick = (e) => {
            if (e.target.closest('.win-controls')) return;
            this.maximize(id, true);
        };
        titleBar.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.win-controls')) return;
            this.focus(id);
            let sL = win.offsetLeft, sT = win.offsetTop;
            this.gesture(e, (dx, dy, ev) => {
                // Dragging a maximized window restores it under the pointer (like real Windows)
                if (win.dataset.isMaximized === "true") {
                    if (Math.abs(dx) + Math.abs(dy) < 6) return;
                    const ratio = (ev.clientX - win.offsetLeft) / win.offsetWidth;
                    this.maximize(id);
                    sL = ev.clientX - win.offsetWidth * ratio - dx;
                    sT = 0;
                }
                win.dataset.userPlaced = 'true';   // stop auto-fitting this window
                const area = this.workArea();
                // Keep at least 80px of the title bar on screen so it can always be grabbed again
                const left = Math.min(area.width - 80, Math.max(80 - win.offsetWidth, sL + dx));
                const top = Math.min(area.height - 24, Math.max(0, sT + dy));
                win.style.left = left + 'px';
                win.style.top = top + 'px';
            });
        });
    },

    setupResizing(id) {
        const win = this.windows[id];
        win.querySelectorAll('.resizer').forEach(resizer => {
            const dir = resizer.getAttribute('data-dir');
            resizer.addEventListener('pointerdown', (e) => {
                if (win.dataset.isMaximized === "true") return;
                this.focus(id);
                const sL = win.offsetLeft, sT = win.offsetTop;
                const sW = win.offsetWidth, sH = win.offsetHeight;
                this.gesture(e, (dx, dy) => {
                    win.dataset.userPlaced = 'true';   // stop auto-fitting this window
                    const area = this.workArea();
                    let L = sL, T = sT, W = sW, H = sH;
                    if (dir.includes('e')) W = Math.min(area.width - sL, Math.max(this.MIN_W, sW + dx));
                    if (dir.includes('s')) H = Math.min(area.height - sT, Math.max(this.MIN_H, sH + dy));
                    if (dir.includes('w')) {
                        L = Math.max(0, Math.min(sL + sW - this.MIN_W, sL + dx));
                        W = sL + sW - L;
                    }
                    if (dir.includes('n')) {
                        T = Math.max(0, Math.min(sT + sH - this.MIN_H, sT + dy));
                        H = sT + sH - T;
                    }
                    win.style.left = L + 'px'; win.style.top = T + 'px';
                    win.style.width = W + 'px'; win.style.height = H + 'px';
                });
            });
        });
    }
};
document.addEventListener('DOMContentLoaded', () => WM.init());
