/**
 * CLASSIC.JS - Small helpers shared by every page in /pages/ (Traditional View).
 *  - Fills in your name / tagline / links from config/site-config.js
 *  - Highlights the current page in the nav
 *  - Wires the view-mode button:
 *      on the classic site  -> "Retro Desktop" (opens the desktop on this same page)
 *      inside the desktop   -> "Traditional View"  (leaves the desktop for this same page)
 */
(function () {
    var cfg = window.SiteConfig || { ownerName: '', tagline: '', links: [], pages: [] };
    // This page's file name. Neocities serves pages without ".html" (/pages/resume), so add it back.
    var file = (location.pathname.split('/').pop() || 'home.html');
    if (file.indexOf('.') === -1) file += '.html';
    var framed = false;
    try { framed = window.self !== window.top; } catch (e) { framed = true; }
    if (framed) document.documentElement.classList.add('in-desktop');

    /*
     * LIGHT / DARK (Traditional View only). The visitor's choice is saved as localStorage "site-theme"
     * ('light' or 'dark'); until they choose, the page follows their device's own setting and
     * keeps following it if that changes. Set here, in <head>, so there's no white flash.
     * Styles: css/modern.css ("DARK MODE"). The switch is added to the header further down.
     */
    var THEME_KEY = 'site-theme';
    function savedTheme() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
    function systemTheme() { try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; } }
    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        var b = document.getElementById('theme-btn');
        if (b) {
            b.textContent = t === 'dark' ? '\u2600' : '\u263E';           // sun in dark mode, moon in light mode
            b.title = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
            b.setAttribute('aria-label', b.title);
        }
    }
    if (!framed) {
        applyTheme(savedTheme() || systemTheme());
        try {
            matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
                if (!savedTheme()) applyTheme(systemTheme());
            });
        } catch (e) {}
    }
    // Retro desktop's pixel mouse pointers (TOOLS > Quick Toggles; desktop/js/customize/retro-cursor.js)
    if (framed) {
        try {
            var oss = JSON.parse(localStorage.getItem('os-settings') || '{}');
            if (oss.retroCursor !== false) document.documentElement.classList.add('retro-cursor');
        } catch (e) { document.documentElement.classList.add('retro-cursor'); }
    }

    /*
     * THEME SYNC (Retro Desktop only): copy the desktop's current theme colors onto this page's
     * own color variables, so a page inside NetCrawler matches the theme the visitor picked
     * (Start > Settings > Themes). Re-applies whenever the theme changes. Traditional View is untouched.
     */
    function syncTheme() {
        try {
            var parentRoot = window.parent.document.documentElement;
            var cs = window.parent.getComputedStyle(parentRoot);
            var map = {                      // page variable  <-  desktop variable
                '--face':    '--ui-face',
                '--light':   '--ui-light',
                '--dark':    '--ui-dark',
                '--title-1': '--title-grad-1',
                '--title-2': '--title-grad-2'   // (headings keep their dark default so text always stays readable)
            };
            var root = document.documentElement.style;
            Object.keys(map).forEach(function (mine) {
                var v = cs.getPropertyValue(map[mine]).trim();
                if (v) root.setProperty(mine, v);
            });
            var titleText = cs.getPropertyValue('--title-text').trim();
            var uiText = cs.getPropertyValue('--ui-text').trim();
            if (titleText) root.setProperty('--title-text', titleText);
            if (uiText) root.setProperty('--face-text', uiText);
        } catch (e) { /* not same-origin; keep default colors */ }
    }
    if (framed) {
        syncTheme();
        try {
            new MutationObserver(syncTheme).observe(window.parent.document.documentElement, { attributes: true, attributeFilter: ['style'] });
        } catch (e) {}
    }

    document.addEventListener('DOMContentLoaded', function () {
        // Name, tagline and year
        document.querySelectorAll('[data-owner]').forEach(function (el) { el.textContent = cfg.ownerName; });
        document.querySelectorAll('[data-tagline]').forEach(function (el) { el.textContent = cfg.tagline; });
        // Copyright years: "2023–<this year>" (cfg.firstYear), updating automatically every January
        var nowYear = new Date().getFullYear(), firstYear = cfg.firstYear || nowYear;
        document.querySelectorAll('[data-year]').forEach(function (el) {
            el.textContent = firstYear < nowYear ? firstYear + '\u2013' + nowYear : String(nowYear);
        });
        // "Years of experience" numbers: <span data-years-since="2011-06"> shows whole years since
        // that month, so the count goes up by itself every June
        var now = new Date();
        document.querySelectorAll('[data-years-since]').forEach(function (el) {
            var parts = el.getAttribute('data-years-since').split('-');
            var months = (now.getFullYear() - Number(parts[0])) * 12 + (now.getMonth() + 1 - Number(parts[1] || 1));
            if (months >= 0) el.textContent = Math.floor(months / 12);
        });

        var pageTitle = document.body.getAttribute('data-title');
        document.title = (pageTitle ? pageTitle + ' | ' : '') + cfg.ownerName;

        // Inside the Retro Desktop: tell NetCrawler this page's title and address. The desktop
        // can't always read them itself (browsers block that when the site is opened from a
        // folder via file://), so the page reports them. See desktop/js/apps/browser-tabs.js.
        if (framed) {
            var report = function () {
                try { window.parent.postMessage({ type: 'nc-page', href: location.href, title: document.title,
                    icon: (document.querySelector('link[rel~="icon"]') || {}).href || '' }, '*'); } catch (e) {}
            };
            report();
            window.addEventListener('hashchange', report);

            // Links to this same site that would open a new browser tab (target="_blank", e.g.
            // "Open the course full screen") open as a NetCrawler tab/window instead.
            document.addEventListener('click', function (e) {
                var a = e.target.closest && e.target.closest('a[target="_blank"]');
                if (!a) return;
                var url;
                try { url = new URL(a.getAttribute('href'), document.baseURI); } catch (err) { return; }
                var sameSite = url.protocol === 'file:' ? location.protocol === 'file:' : url.origin === location.origin;
                if (!sameSite || a.hasAttribute('download')) return;
                e.preventDefault();
                try { window.parent.postMessage({ type: 'nc-open', href: url.href }, '*'); } catch (err) {}
            }, true);
        }

        // Current page in the nav
        // (a page can override with <body data-nav="projects.html">, e.g. project detail pages)
        var navFile = document.body.getAttribute('data-nav') || file;
        document.querySelectorAll('.site-nav a').forEach(function (a) {
            if (a.getAttribute('href') === navFile) a.setAttribute('aria-current', 'page');
        });

        // A single outside link by its label: <a data-link="LinkedIn"> gets that link's address
        document.querySelectorAll('a[data-link]').forEach(function (a) {
            var l = (cfg.links || []).find(function (x) { return x.label === a.getAttribute('data-link'); });
            if (l && l.url && l.url !== 'email:') a.href = l.url;
        });
        // Outside links (LinkedIn, GitHub, email...) wherever a [data-links] list appears
        document.querySelectorAll('[data-links]').forEach(function (list) {
            var links = (cfg.links || []).filter(function (l) { return l.url; });
            if (!links.length) return;   // keep the placeholder text until links are added
            list.innerHTML = '';
            links.forEach(function (l) {
                var li = document.createElement('li');
                var a = document.createElement('a');
                a.href = l.url;
                if (l.url === 'email:') {
                    // Obfuscated email: never print the address, just a clickable link
                    a.href = '#email'; a.setAttribute('data-email', '');
                    a.title = 'Opens a new email in your mail app';
                    a.textContent = 'Email: send me a message';
                } else {
                    a.textContent = l.label + ': ' + l.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
                }
                if (/^https?:/.test(l.url)) { a.target = '_blank'; a.rel = 'noopener'; }
                li.appendChild(a);
                list.appendChild(li);
            });
        });

        // Light/dark switch, just before the Retro Desktop button (Traditional View only)
        var modeBtn = document.getElementById('mode-btn');
        if (!framed && modeBtn && !document.getElementById('theme-btn')) {
            var tb = document.createElement('button');
            tb.type = 'button'; tb.id = 'theme-btn'; tb.className = 'theme-btn';
            modeBtn.parentNode.insertBefore(tb, modeBtn);
            // search.js also inserts its box right before the Retro Desktop button (after this runs),
            // so re-seat the switch on the next tick: search | switch | Retro Desktop
            setTimeout(function () { if (modeBtn.parentNode) modeBtn.parentNode.insertBefore(tb, modeBtn); }, 0);
            applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
            tb.addEventListener('click', function () {
                var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
                applyTheme(next);
            });
        }

        // View-mode button
        var btn = document.getElementById('mode-btn');
        if (btn) {
            if (framed) {
                btn.textContent = 'Traditional View';
                btn.title = 'Leave the retro desktop and view this as a regular website';
                btn.href = file;
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (window.SiteMode) SiteMode.set('classic');
                    window.top.location.href = location.href;
                });
            } else {
                // NOTE: Neocities rewrites any address that ENDS in ".html" (it strips the extension and
                // re-appends the query), which looped forever on "...&page=about.html". So the page goes
                // first, without ".html", and the address ends in "mode=retro".
                btn.href = '../index.html?page=' + encodeURIComponent(file.replace(/\.html?$/, '')) + '&mode=retro';
                btn.title = 'Open this site as a retro desktop (windows, the MENU, and toys)';
            }
        }

        // "Retro Desktop" links (e.g. in "Why the strange layout?"): open this page in the desktop,
        // or do nothing if we're already inside it. Same address shape as the header button (no ".html" at the end).
        document.addEventListener('click', function (e) {
            var t = e.target.closest && e.target.closest('[data-to-retro]');
            if (!t) return;
            e.preventDefault();
            if (!framed) window.location.href = '../index.html?page=' + encodeURIComponent(file.replace(/\.html?$/, '')) + '&mode=retro';
        });
        // "Traditional View" links and the footer badge (retro desktop): same as the header button;
        // in Traditional View they're already where they point, so nothing happens.
        document.addEventListener('click', function (e) {
            var t = e.target.closest && e.target.closest('[data-to-classic]');
            if (!t) return;
            e.preventDefault();
            if (framed) {
                if (window.SiteMode) SiteMode.set('classic');
                window.top.location.href = location.href;
            }
        });

        // Links to outside sites open in a new tab (they can't load inside the desktop's browser anyway)
        document.querySelectorAll('a[href^="http"]').forEach(function (a) {
            if (a.host !== location.host) { a.target = '_blank'; a.rel = 'noopener'; }
        });
    });
})();
