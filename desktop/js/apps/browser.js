/**
 * BROWSER.JS - "NetCrawler", the in-desktop web browser that displays the portfolio pages
 * (global: Browser). Supports several windows, back/forward history, favorites and a hideable menu bar.
 *
 * Quick reference:
 *   openPage('about.html')   open/reuse the browser on a page from /pages/
 *   open(url, forceNew)      open a URL (forceNew = new window)
 *   navigate(instId, url)    load a URL in a given browser window
 *   resolve(url)             'about.html' / 'pages/x.html' -> full local URL; 'example.com' -> https://
 *   onIframeLoad(instId)     syncs address bar + title and keeps the screensaver from firing while reading
 * Note: many outside sites refuse to load inside frames; the "External" menu opens a real tab.
 * Styles: desktop/css/apps.css
 */
window.Browser = {
    appIcon: "images/icons/globe.svg",
    // Home page = the portfolio's own home page (resolved to a full URL in init)
    defaultUrl: 'pages/home.html',
    instanceCount: 0,
    instances: {}, 
    _bootLock: true, // ANTI-DOUBLE-BOOT LOCK

    favorites: [],

    init() {
        this.defaultUrl = this.resolve(this.defaultUrl);

        // Favorites = every portfolio page plus any outside links from site-config.js
        const cfg = window.SiteConfig || { pages: [], links: [] };
        this.favorites = cfg.pages.map(p => ({ name: p.label, url: this.resolve('pages/' + p.file), icon: 'images/icons/' + p.icon }))
            .concat((cfg.links || []).filter(l => /^https?:/.test(l.url)).map(l => ({ name: l.label, url: l.url })));
        // Lifts the boot lock 1.5 seconds after the OS initializes
        setTimeout(() => { this._bootLock = false; }, 1500);
    },

    // Turns 'pages/about.html' or 'example.com' into a full URL the iframe can load
    resolve(url) {
        url = (url || '').trim();
        if (/^[a-z]+:/i.test(url)) return url;                                  // already has a scheme
        if (/^[\w-]+\.html?$/i.test(url)) url = 'pages/' + url;                // bare 'about.html' = a portfolio page
        if (/^(\.{0,2}\/|pages\/|images\/)/i.test(url)) {
            return new URL(url, location.href).href;                           // one of our own files
        }
        return 'https://' + url;                                               // bare domain typed in the address bar
    },

    // Opens (or reuses) the browser window on one of the portfolio pages, e.g. openPage('about.html')
    openPage(file) {
        const url = this.resolve('pages/' + file);
        // A browser is already open: show the page in a NEW TAB there (tabs on), instead of
        // replacing what the visitor is reading. If a tab already shows that page, just switch to it.
        const inst = window.BrowserTabs && BrowserTabs.enabled() ? BrowserTabs.topInstance() : null;
        if (inst && !this._bootLock) {
            const existing = BrowserTabs.findTab(inst, url);
            if (existing) BrowserTabs.switchTo(inst, existing);
            else BrowserTabs.newTab(inst, url);
            const win = document.getElementById(inst).closest('.window');
            if (win) { if (win.style.display === 'none') WM.toggle(win.id.replace(/^window-/, '')); WM.focus(win.id.replace(/^window-/, '')); }
            return;
        }
        this.open(url);
    },

    /** Home button / menu: the home page chosen in Settings (default: the portfolio home page). */
    goHome(instId) {
        const home = window.OSSettings ? OSSettings.get('browser.home') : null;
        this.navigate(instId, home ? this.resolve('pages/' + home) : this.defaultUrl);
    },

    /**
     * open(url, forceNew, reallyNewWindow)
     * With tabs switched on (Settings > Browser), "new" opens a tab in the existing window
     * unless reallyNewWindow is true (File > New Window).
     */
    open(url = null, forceNew = false, reallyNewWindow = false) {
        let targetUrl = url;
        if (!targetUrl || typeof targetUrl !== 'string' || targetUrl.trim() === '') {
            const home = window.OSSettings ? OSSettings.get('browser.home') : null;
            targetUrl = home ? this.resolve('pages/' + home) : this.defaultUrl;
        }
        targetUrl = this.resolve(targetUrl);

        // New tab instead of a new window, when tabs are on and a browser window already exists
        if (forceNew && !reallyNewWindow && window.BrowserTabs && BrowserTabs.enabled() &&
            window.OSSettings && OSSettings.get('browser.newIn') === 'tab') {
            const existing = BrowserTabs.topInstance();
            if (existing) { BrowserTabs.newTab(existing, targetUrl); return; }
        }

        // --- ZOMBIE WINDOW & DOUBLE-BOOT FIX ---
        // Checks if 'netcrawler' window already exists from a LocalStorage restore
        if (!forceNew && typeof WM !== 'undefined' && WM.windows['netcrawler']) {
            const existingInstance = document.getElementById('browser-inst-1');
            if (existingInstance) {
                // If it's a valid V2 window, just focus and navigate
                WM.focus('netcrawler');
                this.navigate('browser-inst-1', targetUrl);
                return;
            } else {
                // If it's a legacy 'Zombie' window from a previous session, kill it
                WM.close('netcrawler');
            }
        }
        
        // Final check for the double-launch bug during boot
        if (this._bootLock && this.instanceCount > 0 && !forceNew) return;

        this.instanceCount++;
        const instId = `browser-inst-${this.instanceCount}`;
        const winId = this.instanceCount === 1 ? 'netcrawler' : `netcrawler-${this.instanceCount}`;

        this.instances[instId] = {
            history: [targetUrl],
            historyIndex: 0,
            autohideMenu: false
        };

        let favHtml = '';
        this.favorites.forEach(fav => {
            const favIcon = fav.icon || `https://www.google.com/s2/favicons?domain=${new URL(fav.url).hostname}`;
            favHtml += `
                <div onmousedown="window.Browser.navigate('${instId}', '${fav.url}'); window.Browser.closeMenu();">
                    <img src="${favIcon}" style="width:16px; height:16px; image-rendering:pixelated;">
                    ${fav.name}
                </div>
            `;
        });

        const html = `
            <div id="${instId}" class="browser-container" style="display:flex; flex-direction:column; height:100%; width:100%; position:relative; background:var(--ui-face); color:var(--ui-text);">
                
                <div class="browser-autohide-zone" style="display:none; position:absolute; top:0; left:0; right:0; height:15px; z-index:100000;"></div>
                
                <div id="menubar-wrapper-${instId}" class="browser-menubar-wrapper" style="background:var(--ui-face); z-index:99999;">
                    <div class="browser-menubar" style="display:flex; border-bottom:1px solid var(--ui-dark); padding:2px 5px; font-size:12px; font-family:var(--user-font, sans-serif);">
                        
                        <div class="browser-menu-item" tabindex="0">
                            File
                            <div class="browser-dropdown">
                                <div class="needs-tabs" onmousedown="window.BrowserTabs.newTab('${instId}'); window.Browser.closeMenu();">New Tab</div>
                                <div onmousedown="window.Browser.open(null, true, true); window.Browser.closeMenu();">New Window</div>
                                <div class="separator"></div>
                                <div class="needs-tabs" onmousedown="window.BrowserTabs.closeTab('${instId}'); window.Browser.closeMenu();">Close Tab</div>
                                <div onmousedown="WM.close('${winId}'); window.Browser.closeMenu();">Close Window</div>
                                <div class="separator"></div>
                                <div title="Print the page you're looking at" onmousedown="window.Browser.closeMenu(); window.Browser.printPage('${instId}');">Print...</div>
                                <div title="Save the page you're looking at as a PDF file (pick &quot;Save as PDF&quot; in the print window)" onmousedown="window.Browser.closeMenu(); window.Browser.printPage('${instId}', true);">Download as PDF...</div>
                            </div>
                        </div>

                        <div class="browser-menu-item" tabindex="0">
                            View
                            <div class="browser-dropdown">
                                <div onmousedown="window.Browser.goBack('${instId}'); window.Browser.closeMenu();">Back</div>
                                <div onmousedown="window.Browser.goForward('${instId}'); window.Browser.closeMenu();">Forward</div>
                                <div onmousedown="window.Browser.refresh('${instId}'); window.Browser.closeMenu();">Refresh</div>
                                <div class="separator"></div>
                                <div onmousedown="window.Browser.goHome('${instId}'); window.Browser.closeMenu();">Go to Homepage</div>
                            </div>
                        </div>

                        <div class="browser-menu-item" tabindex="0">
                            Options
                            <div class="browser-dropdown">
                                <div onmousedown="window.Browser.toggleMenuAutohide('${instId}'); window.Browser.closeMenu();" id="autohide-check-${instId}">☐ Hide Menu Bar</div>
                                <div class="separator"></div>
                                <div onmousedown="window.OSSettings && OSSettings.open('browser'); window.Browser.closeMenu();">Browser Settings...</div>
                            </div>
                        </div>
                        
                        <div style="flex-grow: 1;"></div>

                        <div class="browser-menu-item" title="Open this page in a real browser tab" onmousedown="window.open(document.getElementById('browser-url-input-${instId}').value, '_blank'); window.Browser.closeMenu();">
                            ↗ External
                        </div>

                        <div class="browser-menu-item" tabindex="0" style="font-weight:bold;">
                            <span title="Quick links to every page">⭐ Favorites</span>
                            <div class="browser-dropdown" style="right:0; left:auto;"> 
                                ${favHtml}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:4px; padding:4px; border-bottom:2px solid var(--ui-dark); align-items:center;">
                    <div style="display:flex; gap:4px; flex-shrink:0;">
                        <button class="bevel-out nc-nav-btn" id="back-btn-${instId}" title="Back" aria-label="Back" onclick="window.Browser.goBack('${instId}')" disabled>&lt;</button>
                        <button class="bevel-out nc-nav-btn" id="fwd-btn-${instId}" title="Forward" aria-label="Forward" onclick="window.Browser.goForward('${instId}')" disabled>&gt;</button>
                        <button class="bevel-out nc-icon-btn" title="Refresh this page" aria-label="Refresh" onclick="window.Browser.refresh('${instId}')">
                            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.6-3.7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13.5 1.5v4h-4z" fill="currentColor"/></svg>
                        </button>
                        <button class="bevel-out nc-icon-btn" title="Home page (change it in Options > Browser Settings)" aria-label="Home" onclick="window.Browser.goHome('${instId}')">
                            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1.5 1 8h2v6.5h3.5v-4h3v4H13V8h2z" fill="currentColor"/></svg>
                        </button>
                        <button class="bevel-out nc-icon-btn" title="Search: Seek, the search page for this whole portfolio" aria-label="Search" onclick="window.Browser.navigate('${instId}', window.Browser.resolve('pages/find.html'))">
                            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.8 9.8 14.5 14.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                        </button>
                        <button class="bevel-out nc-icon-btn" title="Share this portfolio (LinkedIn, email, copy link...)" aria-label="Share" onclick="window.SiteShare && SiteShare.open()">
                            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="12" cy="3.5" r="2.2" fill="currentColor"/><circle cx="4" cy="8" r="2.2" fill="currentColor"/><circle cx="12" cy="12.5" r="2.2" fill="currentColor"/><path d="M11 4.5 5 7.5M5 8.5l6 3" stroke="currentColor" stroke-width="1.5"/></svg>
                        </button>
                    </div>
                    <div style="flex-grow:1; display:flex; gap:4px; min-width:120px;">
                        <input type="text" id="browser-url-input-${instId}" title="Type a page or web address, then press Enter" class="bevel-in" style="width:100%; min-width:0; padding:4px; font-family:var(--user-font); font-size:11px; border:none; outline:none;" value="${targetUrl}">
                        <button class="bevel-out" onclick="window.Browser.navigate('${instId}', document.getElementById('browser-url-input-${instId}').value)" style="padding:4px 8px;">Go</button>
                    </div>
                </div>

                <div class="bevel-in" style="flex-grow:1; position:relative; background:#fff; margin:2px; overflow:hidden;">
                    <iframe id="browser-iframe-${instId}" src="${targetUrl}" style="width:100%; height:100%; border:none; position:absolute; top:0; left:0;" onload="window.Browser.onIframeLoad('${instId}')"></iframe>
                </div>

                <div style="padding:2px 5px; font-size:11px; background:var(--ui-face); color:var(--ui-text); display:flex; justify-content:space-between; border-top: 1px solid var(--ui-light);">
                    <span id="status-${instId}">Ready</span>
                    <span>NetCrawler</span>
                </div>
            </div>
        `;

        if (typeof WM !== 'undefined') {
            
            // Size: large, near the top, beside the desktop icons (see fitWindow). It keeps re-fitting
            // when the screen changes until the visitor moves or resizes it themselves.
            const cascade = ((this.instanceCount - 1) % 4) * 24;
            WM.open(winId, 'NetCrawler', html, this.appIcon, { fit: (area) => this.fitWindow(area, cascade) });
            if (window.BrowserTabs) BrowserTabs.setup(instId);   // tab strip (browser-tabs.js)
            // First time the browser appears: a one-time hint about tabs (feature-hints.js)
            if (window.FeatureHints && window.BrowserTabs && BrowserTabs.enabled()) FeatureHints.show('tabs');
            // Phones, landscape and small windows: the browser gets the whole screen (taskbricks stay visible)
            if (document.body.classList.contains('compact-desktop') || window.innerWidth < 768) WM.maximize(winId);

            setTimeout(() => {
                const input = document.getElementById(`browser-url-input-${instId}`);
                if(input) {
                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') this.navigate(instId, input.value);
                    });
                }
                this.updateTitles(instId, targetUrl, false);
            }, 60);
        }
    },

    /**
     * Where a browser window goes: 6px from the top, down to just above the taskbricks,
     * from the right edge of the desktop icons to just left of the TOOLS/DoodleTop tabs.
     * On very wide screens it stops at 1500px wide and centers in the space it has.
     * If the icons leave too little room, it simply covers them (they're still one click away).
     */
    fitWindow(area, cascade = 0) {
        let iconsRight = 0;
        document.querySelectorAll('#desktop .desktop-icon:not([data-rubbish])').forEach(el => {
            if (el.dataset.moved !== 'true') iconsRight = Math.max(iconsRight, el.getBoundingClientRect().right);
        });
        const rightGutter = area.width >= 900 ? 44 : 6;
        let left = iconsRight + 10;
        if (area.width - left - rightGutter < 760) left = 10;          // not enough room beside the icons
        const room = area.width - left - rightGutter;
        const width = Math.min(room, 1500);
        return {
            left: left + (room - width) / 2 + cascade,
            top: 6 + cascade,
            width: width - cascade,
            height: area.height - 12 - cascade      // full height: 6px gap above, 6px above the taskbricks
        };
    },

    updateTitles(instId, text, isExactTitle = false) {
        const num = instId.split('-')[2];
        const winId = num === '1' ? 'netcrawler' : `netcrawler-${num}`;
        
        let displayString = text;
        if (!isExactTitle) {
            try { 
                if (text.includes('http')) {
                    displayString = new URL(text).hostname; 
                } else if (text.startsWith('file:')) {
                    displayString = new URL(text).pathname.split('/').slice(-2).join('/');   // "folder/file.html"
                }
            } catch(e) {}
        }

        // Period-accurate order: "Page Title - Browser"
        const fullTitle = `${displayString} - NetCrawler`;
        
        const winEl = document.getElementById(`window-${winId}`);
        if (winEl) {
            const titleSpan = winEl.querySelector('.title-bar span');
            if (titleSpan) titleSpan.innerText = fullTitle;
        }

        const brickEl = document.getElementById(`brick-${winId}`);
        if (brickEl) {
            const maxChars = 35; // EXACT 35 CHAR CUTOFF
            let truncatedTitle = fullTitle;
            if (truncatedTitle.length > maxChars) {
                truncatedTitle = truncatedTitle.substring(0, maxChars) + '...';
            }
            const icon = brickEl.querySelector('img');
            brickEl.innerHTML = '';
            if (icon) brickEl.appendChild(icon);
            const textSpan = document.createElement('span');
            textSpan.style.verticalAlign = 'middle';
            textSpan.className = 'brick-text';
            textSpan.innerText = ' ' + truncatedTitle;
            brickEl.appendChild(textSpan);
            brickEl.title = fullTitle; 
            if (window.TaskBricks && typeof window.TaskBricks.updateLayout === 'function') {
                window.TaskBricks.updateLayout();
            }
        }
    },

    closeMenu() {
        if (document.activeElement && document.activeElement.classList.contains('browser-menu-item')) {
            document.activeElement.blur();
        }
    },

    /**
     * OUTSIDE WEBSITES. Many big sites forbid being shown inside another page (a security header
     * no website can override), so NetCrawler:
     *   - uses Google's embeddable version (igu=1) for Google searches and the home page
     *   - turns YouTube watch links into the embeddable player
     *   - for sites known to block framing (LinkedIn, Facebook, ...) opens a REAL browser tab and
     *     shows pages/blocked.html in the frame explaining why (with a button to open it again)
     * Everything else loads normally; the status bar mentions ↗ External if a page stays blank.
     */
    blockedHosts: ['linkedin.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'tiktok.com', 'threads.net',
                   'reddit.com', 'github.com', 'amazon.com', 'apple.com', 'microsoft.com', 'netflix.com', 'discord.com',
                   'twitch.tv', 'yahoo.com', 'pinterest.com', 'bsky.app', 'docs.google.com', 'drive.google.com',
                   'mail.google.com', 'gmail.com', 'outlook.com', 'live.com', 'chatgpt.com', 'claude.ai', 'canva.com'],

    frameable(url) {
        let u;
        try { u = new URL(url); } catch (e) { return url; }
        if (!/^https?:$/.test(u.protocol) || u.origin === location.origin) return url;
        const host = u.hostname.replace(/^www\./, '');
        const isHost = (h) => host === h || host.endsWith('.' + h);
        if (this.blockedHosts.some(isHost)) {
            window.open(url, '_blank', 'noopener');                       // the real thing, in a real tab
            return this.resolve('pages/blocked.html?url=' + encodeURIComponent(url));
        }
        if (/^google\.[a-z.]+$/.test(host)) {                             // Google allows this special mode
            if (!u.searchParams.has('igu')) u.searchParams.set('igu', '1');
            if (u.pathname === '/' ) u.pathname = '/webhp';
            return u.href;
        }
        if (isHost('youtube.com') && u.searchParams.get('v')) return 'https://www.youtube.com/embed/' + encodeURIComponent(u.searchParams.get('v'));
        if (host === 'youtu.be') return 'https://www.youtube.com/embed' + u.pathname;
        return url;
    },

    navigate(instId, newUrl) {
        if (!newUrl) return;
        // Words typed in the address bar (spaces, or no dot and no slash) search this site instead
        const typed = String(newUrl).trim();
        if (!/^[a-z]+:/i.test(typed) && (/\s/.test(typed) || !/[./]/.test(typed))) {
            newUrl = 'pages/search.html?q=' + encodeURIComponent(typed);
        }
        newUrl = this.frameable(this.resolve(newUrl));
        const iframe = document.getElementById(`browser-iframe-${instId}`);
        const input = document.getElementById(`browser-url-input-${instId}`);
        const status = document.getElementById(`status-${instId}`);
        const instState = this.instances[instId];
        if (iframe && input && instState) {
            const finalUrl = newUrl;
            if (status) status.innerText = /^https?:/.test(newUrl) && !newUrl.startsWith(location.origin)
                ? 'Loading ' + newUrl + ' ... (if it stays blank, that site blocks being shown here: use ↗ External)'
                : 'Navigating to ' + newUrl + '...';
            iframe.src = finalUrl;
            input.value = newUrl; 
            this.updateTitles(instId, newUrl, false);
            if (instState.history[instState.historyIndex] !== newUrl) {
                instState.history = instState.history.slice(0, instState.historyIndex + 1);
                instState.history.push(newUrl);
                instState.historyIndex++;
            }
            this.updateNav(instId);
        }
    },

    /** Back: one step back in this tab's history. On the first page of a tab that a link opened
     *  (see browser-tabs.js), there's nothing behind it in THIS tab, so go back to the tab you came
     *  from instead, with a small reminder that it's a separate tab. */
    goBack(instId) {
        const instState = this.instances[instId];
        if (!instState) return;
        if (instState.historyIndex > 0) {
            instState.historyIndex--;
            this.updateIframeFromHistory(instId);
        } else if (window.BrowserTabs && BrowserTabs.openerOf(instId)) {
            BrowserTabs.backToOpener(instId);
        }
    },

    /** Grey out Back / Forward when they can't do anything. */
    updateNav(instId) {
        const st = this.instances[instId];
        if (!st) return;
        const back = document.getElementById(`back-btn-${instId}`);
        const fwd = document.getElementById(`fwd-btn-${instId}`);
        const opener = window.BrowserTabs && BrowserTabs.openerOf(instId);
        if (back) {
            back.disabled = !(st.historyIndex > 0 || opener);
            back.title = st.historyIndex > 0 || !opener ? 'Back' : 'Back to the tab this page was opened from';
        }
        if (fwd) fwd.disabled = !(st.historyIndex < st.history.length - 1);
    },

    goForward(instId) {
        const instState = this.instances[instId];
        if (instState && instState.historyIndex < instState.history.length - 1) {
            instState.historyIndex++;
            this.updateIframeFromHistory(instId);
        }
    },

    /** Print the page showing in this NetCrawler (or save it as a PDF through the print window).
     *  The page's title becomes the suggested file name. Pages from other sites can't be printed
     *  from here (the browser blocks it), so those open in a real tab instead. */
    printPage(instId, asPdf) {
        const iframe = document.getElementById(`browser-iframe-${instId}`);
        let win = null;
        try { win = iframe && iframe.contentWindow; void win.document; } catch (e) { win = null; }
        if (!win) {
            const input = document.getElementById(`browser-url-input-${instId}`);
            if (input) window.open(input.value, '_blank');
            if (window.SiteShare && SiteShare.toast) SiteShare.toast('That page is from another website, so it opened in a new tab. Print it from there (Ctrl+P).');
            return;
        }
        if (asPdf && window.SiteShare && SiteShare.toast) SiteShare.toast('In the print window, choose "Save as PDF" as the printer.');
        win.focus();
        setTimeout(() => win.print(), asPdf ? 350 : 0);
    },

    refresh(instId) {
        const iframe = document.getElementById(`browser-iframe-${instId}`);
        const input = document.getElementById(`browser-url-input-${instId}`);
        if (iframe && input) this.navigate(instId, input.value); 
    },

    updateIframeFromHistory(instId) {
        const instState = this.instances[instId];
        const iframe = document.getElementById(`browser-iframe-${instId}`);
        const input = document.getElementById(`browser-url-input-${instId}`);
        if (instState && iframe && input) {
            const url = instState.history[instState.historyIndex];
            if (url) {
                iframe.src = url;
                input.value = url;
                this.updateTitles(instId, url, false);
            }
            this.updateNav(instId);
        }
    },

    toggleMenuAutohide(instId) {
        const instState = this.instances[instId];
        if (!instState) return;
        instState.autohideMenu = !instState.autohideMenu;
        const container = document.getElementById(instId);
        const zone = container.querySelector('.browser-autohide-zone');
        const check = document.getElementById(`autohide-check-${instId}`);
        if (instState.autohideMenu) {
            container.classList.add('autohide-active');
            if (zone) zone.style.display = 'block';
            if (check) check.innerText = '☑ Hide Menu Bar';
        } else {
            container.classList.remove('autohide-active');
            if (zone) zone.style.display = 'none';
            if (check) check.innerText = '☐ Hide Menu Bar';
        }
    },

    onIframeLoad(instId) {
        try {
            const iframe = document.getElementById(`browser-iframe-${instId}`);
            // an old cached copy of one of our pages: reload it fresh (browser-tabs.js)
            try { if (window.BrowserTabs && BrowserTabs.refreshIfStale(iframe, iframe.contentDocument)) return; } catch (e) {}
            const input = document.getElementById(`browser-url-input-${instId}`);
            const status = document.getElementById(`status-${instId}`);
            const instState = this.instances[instId];
            if (status) status.innerText = 'Done';
            // Scrolling/reading inside the page should keep the screensaver away
            if (window.Screensaver && iframe) {
                try {
                    ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'].forEach(evt =>
                        iframe.contentWindow.addEventListener(evt, window.Screensaver.resetTimer, { passive: true }));
                    // Clicks inside the page never reach the desktop, so relay what matters:
                    // close the Start menu and bring this browser window to the front
                    iframe.contentWindow.addEventListener('mousedown', () => {
                        if (window.Menu && window.Menu.isOpen) window.Menu.close();
                        const win = iframe.closest('.window');
                        if (win && typeof WM !== 'undefined') WM.focus(win.id.replace(/^window-/, ''));
                    });
                    // Clicking/scrolling a page also counts as "not lost" for the idle-help dialog
                    if (window.IdleHelp) ['mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'].forEach(evt =>
                        iframe.contentWindow.addEventListener(evt, window.IdleHelp.reset, { passive: true }));
                } catch (err) { /* outside sites can't be watched; that's fine */ }
            }
            if(iframe && iframe.contentWindow && instState) {
                const currentUrl = iframe.contentWindow.location.href;
                const displayUrl = currentUrl.split('?t=')[0].split('&t=')[0];
                if (input && displayUrl && displayUrl !== 'about:blank') {
                    input.value = displayUrl;
                    if (instState.history[instState.historyIndex] !== displayUrl) {
                        instState.history = instState.history.slice(0, instState.historyIndex + 1);
                        instState.history.push(displayUrl);
                        instState.historyIndex++;
                    }
                }
                try {
                    if (iframe.contentWindow.document && iframe.contentWindow.document.title) {
                        this.updateTitles(instId, iframe.contentWindow.document.title, true);
                    }
                } catch(e) {}
                this.updateNav(instId);
            }
        } catch (e) {}
    },

};

document.addEventListener('DOMContentLoaded', () => {
    if(window.Browser && window.Browser.init) window.Browser.init();
});