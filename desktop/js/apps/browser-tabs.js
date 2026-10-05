/**
 * BROWSER-TABS.JS - Tabs for the NetCrawler browser (global: BrowserTabs). Add-on to browser.js,
 * which must load first. Switch tabs off in Settings > Browser (the strip disappears and the
 * browser works exactly as before, one page per window).
 *
 * How it fits into browser.js without rewriting it: browser.js always talks to the iframe with
 * id "browser-iframe-<instId>" and to instances[instId].history. Each tab owns its own iframe
 * and history; switching tabs just hands that id and that history to the tab being shown.
 * So Back/Forward/Refresh/address bar all act on the visible tab automatically.
 *
 *   setup(instId)             called by Browser.open() after the window is built
 *   newTab(instId, url, opener)  open a tab (url defaults to the home page) and show it; `opener` = the
 *                             tab whose link opened it (Back on the new tab's first page returns there)
 *   closeTab(instId, tabId)   close a tab (the active one if tabId is omitted)
 *   switchTo(instId, tabId)
 *   applySettings()           re-reads Settings (tabs on/off, text size) for every window
 * Also: portfolio pages report their title/address and ask for new tabs by postMessage
 * (pages/js/classic.js), which keeps everything working even from file:// (see listen()). Styles: desktop/css/apps.css ("TABS")
 */
window.BrowserTabs = {
    count: 0,

    /**
     * Pages report their own title + address (pages/js/classic.js posts {type:'nc-page'}).
     * Needed when the site runs from file://, where the desktop can't read inside the frames.
     * Only messages coming from one of our own browser frames are used.
     */
    listen() {
        window.addEventListener('message', (e) => {
            const d = e.data;
            if (!d || typeof d.href !== 'string') return;
            // A page asked to open one of this site's pages in a new tab (see classic.js)
            if (d.type === 'nc-open') {
                const same = d.href.startsWith(location.protocol === 'file:' ? 'file:' : location.origin + '/');
                const instId = same && this.instanceOf(e.source);
                if (!instId) return;
                // Remember which tab the link was in, so Back on the new tab's first page returns there
                const inst = Browser.instances[instId];
                const src = inst && inst.tabs && inst.tabs.find(t => t.frame.contentWindow === e.source);
                if (this.enabled()) this.newTab(instId, d.href, src ? src.id : null);
                else Browser.navigate(instId, d.href);      // no tabs: open in place, so Back still works
                return;
            }
            if (d.type !== 'nc-page') return;
            Object.keys(Browser.instances).forEach(instId => {
                const inst = Browser.instances[instId];
                (inst.tabs || []).forEach(t => {
                    if (t.frame.contentWindow !== e.source) return;
                    t.title = String(d.title || '').slice(0, 200) || t.title;
                    if (typeof d.icon === 'string' && d.icon) t.icon = d.icon;
                    if (inst.active === t.id) {
                        const input = document.getElementById(`browser-url-input-${instId}`);
                        if (input) input.value = d.href;
                        if (inst.history[inst.historyIndex] !== d.href) {
                            inst.history = inst.history.slice(0, inst.historyIndex + 1);
                            inst.history.push(d.href);
                            inst.historyIndex = inst.history.length - 1;
                        }
                        Browser.updateTitles(instId, t.title, true);
                    } else {
                        t.history.push(d.href); t.historyIndex = t.history.length - 1;
                    }
                    this.renderStrip(instId);
                });
            });
        });
    },

    /** The id of a tab in this window already showing `url` (ignoring #anchors), or null. */
    findTab(instId, url) {
        const inst = Browser.instances[instId];
        const base = u => String(u || '').split('#')[0];
        if (!inst || !inst.tabs) return null;
        const hit = inst.tabs.find(t => {
            const h = t.id === inst.active ? inst.history[inst.historyIndex] : t.history[t.historyIndex];
            return base(h) === base(url) && String(h).split('#')[1] === String(url).split('#')[1];
        });
        return hit ? hit.id : null;
    },

    /** Which browser instance owns the frame a message came from (or null). */
    instanceOf(source) {
        return Object.keys(Browser.instances).find(instId =>
            (Browser.instances[instId].tabs || []).some(t => t.frame.contentWindow === source)) || null;
    },

    enabled() {
        return !window.OSSettings || OSSettings.get('browser.tabs') !== false;
    },

    /** The browser instance whose window is frontmost (or any), for "open in a new tab". */
    topInstance() {
        let best = null, bestZ = -1;
        Object.keys(Browser.instances).forEach(instId => {
            const el = document.getElementById(instId);
            const win = el && el.closest('.window');
            if (!win || win.style.display === 'none') return;
            const z = parseInt(win.style.zIndex) || 0;
            if (z > bestZ) { bestZ = z; best = instId; }
        });
        return best;
    },

    setup(instId) {
        const inst = Browser.instances[instId];
        const container = document.getElementById(instId);
        const frame = document.getElementById(`browser-iframe-${instId}`);
        if (!inst || !container || !frame) return;

        // Tab strip goes right above the page area
        const strip = document.createElement('div');
        strip.className = 'nc-tabs';
        strip.id = `tabs-${instId}`;
        strip.setAttribute('role', 'tablist');
        strip.innerHTML = `<button type="button" class="nc-newtab" title="New tab">+</button>`;
        const pageArea = frame.parentElement;
        pageArea.parentElement.insertBefore(strip, pageArea);
        strip.querySelector('.nc-newtab').onclick = () => this.newTab(instId);

        // The window's existing iframe becomes tab 1
        const tabId = 't' + (++this.count);
        frame.dataset.tab = tabId;
        frame.removeAttribute('onload');
        frame.addEventListener('load', () => this.onFrameLoad(instId, tabId));
        inst.tabs = [{ id: tabId, frame, history: inst.history, historyIndex: inst.historyIndex, title: 'Loading...' }];
        inst.active = tabId;
        this.renderStrip(instId);
        this.applySettings();
    },

    tab(instId, tabId) {
        const inst = Browser.instances[instId];
        return inst && inst.tabs ? inst.tabs.find(t => t.id === tabId) : null;
    },

    newTab(instId, url, openerId) {
        const inst = Browser.instances[instId];
        if (!inst || !inst.tabs) return;
        if (!this.enabled()) { Browser.navigate(instId, url || Browser.defaultUrl); return; }
        const home = window.OSSettings ? OSSettings.get('browser.home') : 'home.html';
        const target = Browser.frameable(Browser.resolve(url || 'pages/' + home));   // outside sites: see browser.js

        const tabId = 't' + (++this.count);
        const frame = document.createElement('iframe');
        frame.dataset.tab = tabId;
        frame.style.cssText = 'width:100%; height:100%; border:none; position:absolute; top:0; left:0;';
        frame.addEventListener('load', () => this.onFrameLoad(instId, tabId));
        inst.tabs[0].frame.parentElement.appendChild(frame);
        inst.tabs.push({ id: tabId, frame, history: [target], historyIndex: 0, title: 'Loading...', opener: openerId || null });
        frame.src = target;
        this.switchTo(instId, tabId);
        const win = document.getElementById(instId).closest('.window');
        if (win) WM.focus(win.id.replace(/^window-/, ''));
    },

    /** The tab that opened the visible tab (still open), or null. */
    openerOf(instId) {
        const inst = Browser.instances[instId];
        const t = inst && inst.tabs && this.tab(instId, inst.active);
        return t && t.opener && this.tab(instId, t.opener) ? t.opener : null;
    },

    /** Back from the first page of a link-opened tab: show the tab it came from, and point it out. */
    backToOpener(instId) {
        const openerId = this.openerOf(instId);
        if (!openerId) return;
        this.switchTo(instId, openerId);
        this.tabHint(instId, openerId, 'You\'re back on the tab you started in. The page you opened is still open in its own tab.');
    },

    /** A small speech-bubble under one tab in the strip; fades away on its own. */
    tabHint(instId, tabId, text) {
        const strip = document.getElementById(`tabs-${instId}`);
        if (!strip) return;
        document.querySelectorAll('.nc-tab-hint').forEach(h => h.remove());
        const tabEl = [...strip.querySelectorAll('.nc-tab')][this.index(instId, tabId)] || strip;
        const hint = document.createElement('div');
        hint.className = 'nc-tab-hint';
        hint.setAttribute('role', 'status');
        hint.textContent = text;
        // Fixed to the screen (the tab strip scrolls sideways and would clip it), just under the tab
        const r = tabEl.getBoundingClientRect();
        hint.style.left = Math.max(4, r.left) + 'px';
        hint.style.top = (r.bottom + 8) + 'px';
        document.body.appendChild(hint);
        clearTimeout(this._hintTimer);
        this._hintTimer = setTimeout(() => { hint.classList.add('fade'); setTimeout(() => hint.remove(), 400); }, 5000);
        hint.onclick = () => hint.remove();
    },

    index(instId, tabId) {
        const inst = Browser.instances[instId];
        return inst && inst.tabs ? inst.tabs.findIndex(t => t.id === tabId) : -1;
    },

    closeTab(instId, tabId) {
        const inst = Browser.instances[instId];
        if (!inst || !inst.tabs) return;
        tabId = tabId || inst.active;
        const i = inst.tabs.findIndex(t => t.id === tabId);
        if (i < 0) return;
        if (inst.tabs.length === 1) {           // last tab closes the window, like a real browser
            const win = document.getElementById(instId).closest('.window');
            if (win) WM.close(win.id.replace(/^window-/, ''));
            return;
        }
        const [gone] = inst.tabs.splice(i, 1);
        gone.frame.remove();
        if (inst.active === tabId) {
            inst.active = null;                  // nothing to save back
            this.switchTo(instId, inst.tabs[Math.min(i, inst.tabs.length - 1)].id);
        } else {
            this.renderStrip(instId);
        }
    },

    switchTo(instId, tabId) {
        const inst = Browser.instances[instId];
        const next = this.tab(instId, tabId);
        if (!inst || !next) return;
        // Save the outgoing tab's place in its history
        const prev = this.tab(instId, inst.active);
        if (prev) { prev.history = inst.history; prev.historyIndex = inst.historyIndex; }

        inst.tabs.forEach(t => {
            const on = t.id === tabId;
            t.frame.style.display = on ? 'block' : 'none';
            t.frame.id = on ? `browser-iframe-${instId}` : `browser-iframe-${instId}-${t.id}`;
        });
        inst.active = tabId;
        inst.history = next.history;
        inst.historyIndex = next.historyIndex;

        // Address bar + window title follow the visible tab
        const input = document.getElementById(`browser-url-input-${instId}`);
        let url = next.history[next.historyIndex];
        try { url = next.frame.contentWindow.location.href; } catch (e) {}
        if (input && url && url !== 'about:blank') input.value = url;
        Browser.updateTitles(instId, next.title && next.title !== 'Loading...' ? next.title : url, next.title !== 'Loading...');
        this.renderStrip(instId);
    },

    /**
     * An old copy of a page stuck in the visitor's browser cache (from before the site was updated)
     * would show the old layout. Each page carries a fingerprint of its content (<meta name="page-version">)
     * and config/page-versions.js lists the current ones: if they don't match, reload the page once,
     * fresh from the server. Returns true when it started a reload.
     */
    refreshIfStale(frame, doc) {
        try {
            const list = window.PAGE_VERSIONS;
            const m = doc && doc.querySelector('meta[name="page-version"]');
            if (!list || !doc) return false;
            let file = (frame.contentWindow.location.pathname.split('/pages/')[1] || '').split('?')[0];
            if (file && file.indexOf('.') === -1) file += '.html';    // Neocities drops ".html" from addresses
            if (!file || !list[file]) return false;
            if (m && m.content === list[file]) return false;
            this._refreshed = this._refreshed || {};
            if (this._refreshed[file]) return false;          // only try once per page per visit
            this._refreshed[file] = true;
            fetch(frame.contentWindow.location.href, { cache: 'reload' })   // replace the stale copy in the cache
                .catch(() => {})
                .then(() => { try { frame.contentWindow.location.reload(); } catch (e) {} });
            return true;
        } catch (e) { return false; }
    },

    /** A tab finished loading: remember its title; if it's the visible tab, let browser.js sync. */
    onFrameLoad(instId, tabId) {
        const t = this.tab(instId, tabId);
        if (!t) return;
        let doc = null;
        try { doc = t.frame.contentWindow.document; } catch (e) {}
        if (this.refreshIfStale(t.frame, doc)) return;
        // Keep a title the page already reported (postMessage); otherwise use what we can read
        if (doc && doc.title) t.title = doc.title;
        else if (!t.title || t.title === 'Loading...') t.title = this.hostOf(t.frame.src);
        t.icon = this.iconFor(doc, t.frame.src);
        if (doc) {
            this.applyZoom(doc);
        }
        const inst = Browser.instances[instId];
        if (inst && inst.active === tabId) Browser.onIframeLoad(instId);
        this.renderStrip(instId);
    },

    /** A short label for a page we can't read the title of: the site name, or for local files "folder/file". */
    hostOf(url) {
        try {
            const u = new URL(url);
            return u.hostname || u.pathname.split('/').slice(-2).join('/') || url;
        } catch (e) { return url; }
    },

    /** The tab's favicon: the page's own <link rel="icon"> when we can read it; for other
     *  sites, their /favicon.ico; this site's logo for our pages that don't name one.
     *  If an icon fails to load, the tab shows the NetCrawler globe instead. */
    iconFor(doc, url) {
        try {
            if (doc) {
                const link = doc.querySelector('link[rel~="icon"]');
                if (link && link.href) return link.href;
            }
            const u = new URL(url, location.href);
            if (u.origin === location.origin || u.protocol === 'file:') return 'images/icons/favicon-32.png';   // this site's pages: the pixel-art head
            if (/^https?:$/.test(u.protocol)) return u.origin + '/favicon.ico';
        } catch (e) {}
        return 'images/icons/globe.svg';
    },

    renderStrip(instId) {
        const inst = Browser.instances[instId];
        const strip = document.getElementById(`tabs-${instId}`);
        if (!inst || !strip) return;
        strip.querySelectorAll('.nc-tab').forEach(el => el.remove());
        const plus = strip.querySelector('.nc-newtab');
        inst.tabs.forEach(t => {
            const el = document.createElement('div');
            el.className = 'nc-tab' + (t.id === inst.active ? ' active' : '');
            el.setAttribute('role', 'tab');
            el.title = t.title;
            el.innerHTML = `<img class="nc-tab-icon" alt="" draggable="false"><span class="nc-tab-title"></span><button type="button" class="nc-tab-x" title="Close tab" aria-label="Close tab">x</button>`;
            el.querySelector('.nc-tab-title').textContent = t.title;
            const ico = el.querySelector('.nc-tab-icon');
            ico.onerror = () => { ico.onerror = null; ico.src = 'images/icons/globe.svg'; };
            ico.src = t.title === 'Loading...' ? 'images/icons/globe.svg' : (t.icon || 'images/icons/globe.svg');
            el.onclick = (e) => {
                if (e.target.closest('.nc-tab-x')) this.closeTab(instId, t.id);
                else this.switchTo(instId, t.id);
            };
            el.onauxclick = (e) => { if (e.button === 1) { e.preventDefault(); this.closeTab(instId, t.id); } };  // middle-click closes
            strip.insertBefore(el, plus);
        });
        Browser.updateNav(instId);                       // Back/Forward follow the visible tab
    },

    applyZoom(doc) {
        const z = window.OSSettings ? OSSettings.get('browser.zoom') : 100;
        try { doc.documentElement.style.zoom = (z && z !== 100) ? (z / 100) : ''; } catch (e) {}
    },

    applySettings() {
        const on = this.enabled();
        Object.keys(Browser.instances).forEach(instId => {
            const inst = Browser.instances[instId];
            const container = document.getElementById(instId);
            if (!container || !inst.tabs) return;
            container.classList.toggle('tabs-off', !on);
            // Tabs switched off: keep only the tab being viewed
            if (!on) inst.tabs.filter(t => t.id !== inst.active).forEach(t => this.closeTab(instId, t.id));
            inst.tabs.forEach(t => { try { this.applyZoom(t.frame.contentWindow.document); } catch (e) {} });
        });
    },

    clearHistory() {
        Object.keys(Browser.instances).forEach(instId => {
            const inst = Browser.instances[instId];
            (inst.tabs || []).forEach(t => {
                const cur = t.id === inst.active ? inst.history[inst.historyIndex] : t.history[t.historyIndex];
                t.history = [cur]; t.historyIndex = 0;
                if (t.id === inst.active) { inst.history = t.history; inst.historyIndex = 0; }
            });
        });
    }
};

BrowserTabs.listen();
