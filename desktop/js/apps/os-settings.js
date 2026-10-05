/**
 * OS-SETTINGS.JS - The "Settings" window, a Win95-style property sheet (global: OSSettings).
 * Changes apply immediately and are remembered in this browser (localStorage "os-settings").
 *
 *   Desktop     boot animation, first-visit tips, "Need a hand?" popup, screensaver + delay
 *   Appearance  themes, wallpaper, CRT effect, retro mouse pointer, auto-hide taskbricks, drawer tabs
 *   Browser     NetCrawler tabs on/off, home page, text size, where "New" opens, clear history
 *
 *   OSSettings.get('browser.tabs')        read a setting (dot path)
 *   OSSettings.set('browser.tabs', false) change + save + apply it
 *   OSSettings.open('browser')            open the window on a given tab
 *
 * Other modules read these values: startup.js (boot, straight from storage because it loads
 * first), browser-tabs.js (browser.*), first-tips.js (its own "don't show" flag).
 * Styles: desktop/css/os-settings.css
 */
window.OSSettings = {
    storageKey: 'os-settings',

    defaults: {
        boot: 'always',          // 'always' | 'session' | 'off'
        idleHelp: true,          // the 2-minute "Need a hand?" dialog
        screensaver: true,
        screensaverMin: 5,
        crt: false,
        retroCursor: true,       // pixel-art mouse pointers (desktop/js/customize/retro-cursor.js)
        autohide: false,
        autoArrange: false,      // desktop icons always in neat columns (desktop-arrange.js)
        snapToGrid: true,        // dropped icons line up with the grid
        browser: {
            tabs: true,          // tab strip in NetCrawler
            home: 'home.html',   // a page in /pages/
            zoom: 100,           // text size (percent) for portfolio pages
            newIn: 'tab'         // File > New opens a 'tab' or a 'window'
        }
    },

    values: null,

    init() {
        this.values = JSON.parse(JSON.stringify(this.defaults));
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            Object.assign(this.values, saved, { browser: Object.assign({}, this.defaults.browser, saved.browser || {}) });
        } catch (e) {}
        this.applyAll();
    },

    get(path) {
        return path.split('.').reduce((o, k) => (o == null ? o : o[k]), this.values);
    },

    set(path, value) {
        const keys = path.split('.');
        const last = keys.pop();
        const obj = keys.reduce((o, k) => o[k], this.values);
        obj[last] = value;
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.values)); } catch (e) {}
        this.apply(path);
    },

    /** Save a value that was already changed elsewhere (e.g. a Quick Toggle), without re-applying it. */
    remember(path, value) {
        if (!this.values) return;
        const keys = path.split('.');
        const last = keys.pop();
        keys.reduce((o, k) => o[k], this.values)[last] = value;
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.values)); } catch (e) {}
    },

    reset() {
        try { localStorage.removeItem(this.storageKey); } catch (e) {}
        this.values = JSON.parse(JSON.stringify(this.defaults));
        if (window.DrawerTabs) { DrawerTabs.showAll(); DrawerTabs.setOnTop('tools', true); DrawerTabs.setOnTop('doodletop', true); }
        if (window.FirstTips) FirstTips.setOff(false);
        this.applyAll();
        this.render();
    },

    applyAll() {
        ['idleHelp', 'screensaver', 'screensaverMin', 'crt', 'retroCursor', 'autohide', 'browser.zoom', 'browser.tabs'].forEach(p => this.apply(p));
    },

    /** Push one setting out to the module that uses it. */
    apply(path) {
        const v = this.get(path);
        const pressed = (id) => { const b = document.getElementById(id); return !!(b && b.classList.contains('depressed')); };
        switch (path) {
            case 'idleHelp':
                if (window.IdleHelp) {
                    IdleHelp.disabled = !v;
                    if (!v) clearTimeout(IdleHelp.timer); else IdleHelp.reset();
                }
                break;
            case 'screensaver':
                if (window.Tools && pressed('btn-screensaver') !== v) Tools.toggleScreensaver();
                break;
            case 'screensaverMin':
                if (window.Screensaver) { Screensaver.idleTime = v * 60000; Screensaver.resetTimer(); }
                break;
            case 'crt':
                if (window.Tools && pressed('btn-crt') !== v) Tools.toggleCRT();
                break;
            case 'retroCursor':
                if (window.RetroCursor) RetroCursor.apply(v !== false);
                break;
            case 'autoArrange':
                if (window.Desktop && Desktop.els) Desktop.init();
                break;
            case 'autohide':
                if (window.Tools && pressed('btn-autohide') !== v) Tools.toggleAutohide();
                break;
            case 'browser.zoom':
            case 'browser.tabs':
                if (window.BrowserTabs) BrowserTabs.applySettings();
                break;
        }
    },

    // ------------------------------------------------------------------ window

    open(tab = 'desktop') {
        this.tab = tab;
        const winId = 'os-settings';
        if (!WM.windows[winId]) {
            WM.open(winId, 'Settings', '<div class="oss" id="oss-root"></div>', 'images/icons/os/tools.png',
                { width: 400, height: 470, center: true });
        } else {
            WM.focus(winId);
        }
        this.render();
        if (window.FeatureHints) FeatureHints.show('settings');
    },

    render() {
        const root = document.getElementById('oss-root');
        if (!root) return;
        const v = this.values, b = v.browser;
        const tabs = [['desktop', 'Desktop'], ['appearance', 'Appearance'], ['browser', 'Browser']];
        const chk = (path, label, tip) =>
            `<label class="oss-row" title="${tip || ''}"><input type="checkbox" data-set="${path}" ${this.get(path) ? 'checked' : ''}> ${label}</label>`;
        const pages = (window.SiteConfig ? SiteConfig.pages : []).filter(p => !p.file.includes('#'));

        const panels = {
            desktop: `
                <fieldset><legend>Starting up</legend>
                    <label class="oss-row" title="The short start-up animation (under 2 seconds; click to skip)">Boot animation
                        <select data-set="boot">
                            <option value="always" ${v.boot === 'always' ? 'selected' : ''}>Every visit</option>
                            <option value="session" ${v.boot === 'session' ? 'selected' : ''}>Once per session</option>
                            <option value="off" ${v.boot === 'off' ? 'selected' : ''}>Off</option>
                        </select></label>
                    <label class="oss-row" title="The yellow help balloons shown to first-time visitors">
                        <input type="checkbox" id="oss-tips" ${window.FirstTips && !FirstTips.isOff() ? 'checked' : ''}> Show tips for new visitors</label>
                    <button type="button" class="bevel-out" data-act="tips" title="Show the tips again right now">Show tips now</button>
                    <label class="oss-row" title="Now and then, a little message from Joe blinks in the tray (every 20 to 30 minutes the desktop is open)">
                        <input type="checkbox" id="oss-msgs" ${window.Messenger && !Messenger.isOff() ? 'checked' : ''}> Messages from Joe</label>
                </fieldset>
                <fieldset><legend>Desktop icons</legend>
                    ${chk('autoArrange', 'Auto arrange icons', 'Keep icons in neat columns; dragging one moves it in the order')}
                    ${chk('snapToGrid', 'Snap icons to the grid', 'Dropped icons line up with the grid')}
                    <div class="oss-buttons">
                        <button type="button" class="bevel-out" data-act="sort-name" title="Alphabetical order">Sort by name</button>
                        <button type="button" class="bevel-out" data-act="sort-type" title="Pages, then programs, then your files">Sort by type</button>
                    </div>
                </fieldset>
                <fieldset><legend>Help</legend>
                    ${chk('idleHelp', '"Need a hand?" popup after 2 idle minutes', 'Offers Traditional View if you seem stuck')}
                </fieldset>
                <fieldset><legend>Screen saver</legend>
                    ${chk('screensaver', 'Use the screen saver', 'A bouncing logo after you stop using the page')}
                    <label class="oss-row">Wait
                        <select data-set="screensaverMin" data-num>
                            ${[1, 3, 5, 10, 15].map(n => `<option value="${n}" ${v.screensaverMin === n ? 'selected' : ''}>${n} minute${n > 1 ? 's' : ''}</option>`).join('')}
                        </select></label>
                </fieldset>`,
            appearance: `
                <fieldset><legend>Look</legend>
                    <div class="oss-buttons">
                        <button type="button" class="bevel-out" data-act="themes" title="Pick a color theme">Themes...</button>
                        <button type="button" class="bevel-out" data-act="wallpaper" title="Pick a desktop wallpaper">Wallpaper...</button>
                    </div>
                    ${chk('crt', 'CRT scanlines effect', 'Old-monitor scanlines over the whole screen')}
                    ${chk('retroCursor', 'Retro mouse pointer', 'Old-school pixel arrow and hand pointers (retro desktop only)')}
                    ${chk('autohide', 'Auto-hide the taskbricks', 'The taskbar slides away until you point at the bottom edge')}
                </fieldset>
                <fieldset><legend>Drawer tabs (right edge)</legend>
                    ${['tools', 'doodletop'].map(k => window.DrawerTabs ? `
                        <div class="oss-drawer"><b>${DrawerTabs.labels[k]}</b>
                            <label title="Show the tab on the right edge"><input type="checkbox" data-drawer="${k}" data-kind="show" ${!DrawerTabs.prefs[k].hidden ? 'checked' : ''}> Show</label>
                            <label title="When off, windows can cover the drawer"><input type="checkbox" data-drawer="${k}" data-kind="top" ${DrawerTabs.prefs[k].onTop ? 'checked' : ''}> Keep on top</label>
                        </div>` : '').join('')}
                </fieldset>`,
            browser: `
                <fieldset><legend>NetCrawler</legend>
                    ${chk('browser.tabs', 'Use tabs (several sites in one window)', 'Adds a tab strip; File > New Tab and the + button open more')}
                    <label class="oss-row" title="What the Home button opens">Home page
                        <select data-set="browser.home">
                            ${pages.map(p => `<option value="${p.file}" ${b.home === p.file ? 'selected' : ''}>${p.label}</option>`).join('')}
                        </select></label>
                    <label class="oss-row" title="Text size for the portfolio pages">Text size
                        <select data-set="browser.zoom" data-num>
                            ${[90, 100, 110, 125, 150].map(n => `<option value="${n}" ${b.zoom === n ? 'selected' : ''}>${n}%</option>`).join('')}
                        </select></label>
                    <label class="oss-row" title="What File > New does">"New" opens a
                        <select data-set="browser.newIn">
                            <option value="tab" ${b.newIn === 'tab' ? 'selected' : ''}>New tab</option>
                            <option value="window" ${b.newIn === 'window' ? 'selected' : ''}>New window</option>
                        </select></label>
                    <button type="button" class="bevel-out" data-act="history" title="Forget Back/Forward history in every browser window">Clear history</button>
                </fieldset>`
        };

        root.innerHTML = `
            <div class="oss-tabs" role="tablist">
                ${tabs.map(([id, label]) => `<button type="button" role="tab" class="oss-tab ${this.tab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
            </div>
            <div class="oss-panel">${panels[this.tab]}</div>
            <div class="oss-foot">
                <button type="button" class="bevel-out" data-act="reset" title="Put every setting back the way it started">Reset to defaults</button>
                <button type="button" class="bevel-out" data-act="close">Close</button>
            </div>`;

        root.onclick = (e) => {
            const t = e.target.closest('[data-tab], [data-act]');
            if (!t) return;
            if (t.dataset.tab) { this.tab = t.dataset.tab; this.render(); return; }
            switch (t.dataset.act) {
                case 'tips':
                    // Replay the welcome tips, and let the first-use hints appear again too
                    if (window.FeatureHints) FeatureHints.reset();
                    if (window.FirstTips) { FirstTips.setOff(false); FirstTips.start(true); }
                    break;
                case 'themes': if (window.Tools) Tools.openThemes(); break;
                case 'wallpaper': if (window.Tools) Tools.openWallpapers(); break;
                case 'history': if (window.BrowserTabs) BrowserTabs.clearHistory(); t.textContent = 'History cleared'; break;
                case 'reset': this.reset(); break;
                case 'sort-name': if (window.Desktop) Desktop.sortBy('name'); break;
                case 'sort-type': if (window.Desktop) Desktop.sortBy('type'); break;
                case 'close': WM.close('os-settings'); break;
            }
        };
        root.onchange = (e) => {
            const el = e.target;
            if (el.id === 'oss-msgs' && window.Messenger) { Messenger.setOff(!el.checked); return; }
            if (el.id === 'oss-tips' && window.FirstTips) {
                FirstTips.setOff(!el.checked);
                if (el.checked && window.FeatureHints) FeatureHints.reset();   // hints can show again too
                return;
            }
            if (el.dataset.drawer && window.DrawerTabs) {
                if (el.dataset.kind === 'show') DrawerTabs.setHidden(el.dataset.drawer, !el.checked);
                else DrawerTabs.setOnTop(el.dataset.drawer, el.checked);
                return;
            }
            if (!el.dataset.set) return;
            let val = el.type === 'checkbox' ? el.checked : el.value;
            if (el.hasAttribute('data-num')) val = Number(val);
            this.set(el.dataset.set, val);
        };
    }
};
document.addEventListener('DOMContentLoaded', () => {
    // After Tools / Screensaver / IdleHelp have started (they also start on DOMContentLoaded)
    setTimeout(() => OSSettings.init(), 0);
});
