/**
 * FIRST-TIPS.JS - Short "balloon" tips for first-time visitors to the retro desktop (global: FirstTips).
 *
 * A few tips (two sentences max), each pointing at the thing it describes. Every balloon has:
 *   - "Don't show tips again" (remembered in localStorage "first-tips-off")
 *   - a "Traditional View" button for people who'd rather see a regular website
 *   - Next / Done, and an X to close
 * Without "don't show again", the tips return on a later visit (but only once per browser tab session).
 * Settings can turn them back on or replay them (OSSettings). Styles: desktop/css/first-tips.css
 *
 * New site version (config/site-version.js, stamped by tools/stamp-version.py): every tip and
 * tutorial is reset for returning visitors (even "don't show again"), and the first balloon
 * says in small print that the tips are back because the site was updated.
 *
 *   FirstTips.start(force)   show the tips (force = ignore the "seen" flags, e.g. from Settings)
 */
window.FirstTips = {
    offKey: 'first-tips-off',
    sessionKey: 'first-tips-shown',

    // target: CSS selector the balloon points at (falls back to the bottom-left corner)
    tips: [
        { title: 'Welcome!', target: '#start-brick',
          text: 'This portfolio is built like a retro desktop computer. Prefer a regular website? Switch to Traditional View any time.' },
        { title: 'The Menu', target: '#start-brick',
          text: 'Click <b>MENU</b> (bottom left) for every page, program, and setting. The same pages are also on the desktop.' },
        { title: 'Icons and right-click', target: '.desktop-icon',
          text: 'Double-click an icon to open it. Right-click the desktop, icons, windows, and tabs for more options.' },
        { title: 'Tools and DoodleTop', target: '#tools-tab',
          text: 'The <b>TOOLS</b> tab changes colors, themes, and wallpaper. <b>DoodleTop</b> lets you draw on the screen.' },
        { title: 'Take a break', target: '.desktop-icon[data-label="Games"]',
          text: 'The <b>Games</b> folder has quiz games I built for training. They play right here in a window.' }
    ],

    versionKey: 'site-version-seen',
    updatedSinceVisit: false,

    /** Runs once as this file loads: a different site version than last visit resets all tips. */
    versionCheck() {
        const v = window.SITE_VERSION;
        if (!v) return;
        try {
            const seen = localStorage.getItem(this.versionKey);
            if (seen && seen !== v) {
                // (A visitor who ticked "Don't show tips again" stays opted out; only the others see them again)
                localStorage.removeItem('feature-hints-seen');    // first-use hints (feature-hints.js)
                localStorage.removeItem('sm_tutVersion');         // the Scenemaker demo re-runs its own tour reset
                sessionStorage.removeItem(this.sessionKey);
                sessionStorage.removeItem('idle-help-shown');     // "Need a hand?" (idle-help.js)
                this.updatedSinceVisit = true;
            }
            localStorage.setItem(this.versionKey, v);
        } catch (e) {}
    },

    isOff() {
        try { return localStorage.getItem(this.offKey) === 'true'; } catch (e) { return false; }
    },

    setOff(off) {
        try { off ? localStorage.setItem(this.offKey, 'true') : localStorage.removeItem(this.offKey); } catch (e) {}
    },

    start(force = false) {
        if (!force) {
            if (this.isOff()) return;
            try { if (sessionStorage.getItem(this.sessionKey) === 'true') return; } catch (e) {}
        }
        try { sessionStorage.setItem(this.sessionKey, 'true'); } catch (e) {}
        this.index = 0;
        this.render();
    },

    close() {
        const el = document.getElementById('first-tip');
        if (el) el.remove();
        window.removeEventListener('resize', this._onResize);
        // Any feature hint that waited for the tips to finish can show now
        if (window.FeatureHints) setTimeout(() => FeatureHints.next(), 300);
    },

    isShowing() {
        return !!document.getElementById('first-tip');
    },

    render() {
        this.close();
        const tip = this.tips[this.index];
        if (!tip) return;
        const last = this.index === this.tips.length - 1;

        const el = document.createElement('div');
        el.id = 'first-tip';
        el.className = 'tip-balloon';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', tip.title);
        el.innerHTML = `
            <div class="ft-head">
                <strong>${tip.title}</strong>
                <span class="ft-count">${this.index + 1} / ${this.tips.length}</span>
                <button type="button" class="ft-x" data-act="close" title="Close tips" aria-label="Close tips">X</button>
            </div>
            <p>${tip.text}</p>
            ${this.updatedSinceVisit && this.index === 0 ? '<p class="ft-updated">Seen these before? The site was updated since your last visit, so the tips are back.</p>' : ''}
            <label class="ft-off" title="Tips won't appear again (turn them back on in Settings)">
                <input type="checkbox" ${this.isOff() ? 'checked' : ''}> Don't show tips again
            </label>
            <div class="ft-buttons">
                <button type="button" class="bevel-out" data-act="classic" title="Leave the desktop and view the regular website">Traditional View</button>
                <button type="button" class="bevel-out ft-next" data-act="${last || this.isOff() ? 'close' : 'next'}">${last ? 'Done' : this.isOff() ? 'Close' : 'Next &#9656;'}</button>
            </div>
            <div class="ft-arrow"></div>`;
        document.body.appendChild(el);

        // Ticking "Don't show tips again" turns Next into Close: nothing more shows now or on later visits
        el.querySelector('.ft-off input').addEventListener('change', (e) => {
            this.setOff(e.target.checked);
            const nb = el.querySelector('.ft-next');
            if (nb && !last) { nb.setAttribute('data-act', e.target.checked ? 'close' : 'next'); nb.innerHTML = e.target.checked ? 'Close' : 'Next &#9656;'; }
        });
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            const act = btn.getAttribute('data-act');
            if (act === 'next' && !this.isOff()) { this.index++; this.render(); }
            else if (act === 'next') this.close();
            else if (act === 'close') this.close();
            else if (act === 'classic') { this.close(); if (window.ViewMode) ViewMode.toClassic(); }
        });

        this.position(el, tip);
        this._onResize = () => this.position(el, tip);
        window.addEventListener('resize', this._onResize);
        this.follow(el, tip.target, this._onResize);
        const next = el.querySelector('.ft-next');
        if (next) next.focus({ preventScroll: true });
    },

    /** Keep a balloon on its target while it's showing: when the target moves or changes size
     *  (a window dragged, resized, maximized, the taskbricks rearranged), the balloon and its
     *  arrow follow. Checks once per frame and only re-places when something actually moved. */
    follow(el, selector, place) {
        let last = '';
        const tick = () => {
            if (!el.isConnected) return;
            const t = [...document.querySelectorAll(selector)].find(x => x.offsetParent !== null);
            const r = t ? t.getBoundingClientRect() : null;
            const key = r ? [r.left, r.top, r.width, r.height].map(Math.round).join() : 'none';
            if (key !== last) { last = key; place(); }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    },

    /** Place the balloon next to its target, with the little arrow pointing at it. */
    position(el, tip) {
        // first VISIBLE match (a selector list may also match hidden things)
        const target = [...document.querySelectorAll(tip.target)].find(t => t.offsetParent !== null);
        const r = target && target.offsetParent !== null ? target.getBoundingClientRect() : null;
        const w = el.offsetWidth, h = el.offsetHeight;
        const vw = window.innerWidth, vh = window.innerHeight;
        let left, top, side;
        if (!r) {                                   // nothing to point at: bottom-left corner
            left = 10; top = vh - h - 56; side = 'none';
        } else if (r.top > vh / 2) {                // target low on screen: balloon above it
            left = r.left + r.width / 2 - 30; top = r.top - h - 12; side = 'down';
        } else if (r.left > vw / 2) {               // target on the right edge: balloon to its left
            left = r.left - w - 14; top = r.top; side = 'right';
        } else {                                    // target top-left: balloon to its right
            left = r.right + 14; top = r.top; side = 'left';
        }
        left = Math.max(6, Math.min(left, vw - w - 6));
        top = Math.max(6, Math.min(top, vh - h - 6));
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.dataset.side = side;
        const arrow = el.querySelector('.ft-arrow');
        if (arrow && r) {
            if (side === 'down') arrow.style.left = Math.max(10, Math.min(w - 26, r.left + r.width / 2 - left - 8)) + 'px';
            else arrow.style.top = Math.max(10, Math.min(h - 26, r.top + Math.min(r.height, 60) / 2 - top - 8)) + 'px';
        }
    }
};
FirstTips.versionCheck();
