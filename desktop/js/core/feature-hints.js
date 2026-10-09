/**
 * FEATURE-HINTS.JS - One short "how this works" balloon the FIRST time a visitor meets a
 * feature on the retro desktop (global: FeatureHints). Each hint shows once per browser
 * (localStorage "feature-hints-seen"), and never while the welcome tips are still up.
 * "Don't show tips again" here is the same switch as in the welcome tips (FirstTips.setOff),
 * and Settings > Desktop can turn tips back on and reset these hints.
 *
 *   FeatureHints.show('tabs')   show that hint if it hasn't been seen (queued if something else is up)
 *   FeatureHints.reset()        forget which hints were seen
 *
 * Where they're triggered from: browser.js (tabs), games.js (games), tools-drawer / doodletop
 * via drawer-tabs.js (tools, doodletop), os-settings.js (settings), window-manager.js (maximize).
 * Looks: desktop/css/first-tips.css (.tip-balloon). Placement: FirstTips.position().
 */
window.FeatureHints = {
    storageKey: 'feature-hints-seen',
    queue: [],

    // target = CSS selector the balloon points at; the first visible match is used
    hints: {
        tabs: {
            title: 'A modern touch',
            target: '.nc-newtab',
            text: "Browsers didn't have tabs in 1995, but NetCrawler does. Click <b>+</b> for a new tab; " +
                  'turn tabs off in <b>Options &gt; Browser Settings</b>.'
        },
        games: {
            title: 'Playing a game',
            target: '.window[id^="window-game-"] .title-bar, #window-games-folder .title-bar',
            text: 'Click inside a game first so it can detect your keyboard. Maximize the window (□) for a bigger screen.'
        },
        tools: {
            title: 'TOOLS drawer',
            target: '#tools-drawer.open #color-grid, #tools-tab',
            text: 'Left-click a color for windows, right-click one for the accent. The buttons below pick themes, wallpapers, and effects.'
        },
        doodletop: {
            title: 'DoodleTop',
            target: '#doodletop-drawer .dt-tool, #doodletop-tab',
            text: 'Pick a tool, then draw anywhere on the screen. Right-click or press Esc to stop drawing.'
        },
        settings: {
            title: 'Settings',
            target: '#window-os-settings .title-bar',
            text: 'Changes apply right away and are saved in this browser. "Reset to defaults" puts everything back.'
        },
        maximize: {
            title: 'Maximized',
            target: '.window.maximized .wc-max',
            text: 'The taskbricks stay visible so you can switch windows. Click ❐ or double-click the title bar to restore.'
        }
    },

    seen() {
        try { return JSON.parse(localStorage.getItem(this.storageKey) || '{}'); } catch (e) { return {}; }
    },

    markSeen(key) {
        const s = this.seen();
        s[key] = true;
        try { localStorage.setItem(this.storageKey, JSON.stringify(s)); } catch (e) {}
    },

    reset() {
        try { localStorage.removeItem(this.storageKey); } catch (e) {}
    },

    tipsOff() {
        return window.FirstTips && FirstTips.isOff();
    },

    show(key) {
        if (!this.hints[key] || this.seen()[key] || this.tipsOff()) return;
        if (!this.queue.includes(key)) this.queue.push(key);
        // Wait for the moment to be right: after the boot, the welcome tips, and any other hint
        setTimeout(() => this.next(), 350);
    },

    busy() {
        return document.body.classList.contains('system-busy') ||
               (window.FirstTips && FirstTips.isShowing()) ||
               !!document.getElementById('feature-hint');
    },

    next() {
        if (this.busy() || this.tipsOff()) return;
        while (this.queue.length) {
            const key = this.queue.shift();
            if (this.seen()[key]) continue;
            const hint = this.hints[key];
            const target = [...document.querySelectorAll(hint.target)].find(el => el.offsetParent !== null);
            if (!target) continue;                // the thing it points at is gone; skip it
            this.render(key, hint);
            return;
        }
    },

    close() {
        const el = document.getElementById('feature-hint');
        if (el) el.remove();
        window.removeEventListener('resize', this._onResize);
        setTimeout(() => this.next(), 300);
    },

    render(key, hint) {
        this.markSeen(key);
        const el = document.createElement('div');
        el.id = 'feature-hint';
        el.className = 'tip-balloon';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', hint.title);
        el.innerHTML = `
            <div class="ft-head">
                <strong>${hint.title}</strong>
                <button type="button" class="ft-x" data-act="close" title="Close" aria-label="Close">X</button>
            </div>
            <p>${hint.text}</p>
            <label class="ft-off" title="No more tips or hints (turn them back on in Settings)">
                <input type="checkbox"> Don't show tips again
            </label>
            <div class="ft-buttons">
                <button type="button" class="bevel-out ft-next" data-act="close">Got it</button>
            </div>
            <div class="ft-arrow"></div>`;
        document.body.appendChild(el);
        el.querySelector('.ft-off input').addEventListener('change', (e) => {
            if (window.FirstTips) FirstTips.setOff(e.target.checked);
        });
        el.addEventListener('click', (e) => { if (e.target.closest('[data-act="close"]')) this.close(); });

        const place = () => { if (window.FirstTips) FirstTips.position(el, { target: hint.target }); };
        place();
        this._onResize = place;
        window.addEventListener('resize', place);
        if (window.FirstTips && FirstTips.follow) FirstTips.follow(el, hint.target, place);   // follows a moving target
    }
};
