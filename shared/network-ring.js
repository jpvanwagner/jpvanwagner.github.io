/**
 * NETWORK-RING.JS - "The Network", an old-school webring (global: NetworkRing). One file, used by
 * the Network page (pages/network.html, both views) and the Retro Desktop's Network window.
 *
 * HOW IT WORKS
 *   Members: the addresses in `network` in config/site-config.js, one per line. This site is
 *   always the first stop on the ring (the hub). Order matters: Next goes down the list and wraps
 *   around; Prev goes up.
 *   Member sites paste a small block of HTML (made on the Network page) with four buttons. Each
 *   links to pages/network.html?go=prev|next|random|list&from=<their address>; that page looks the
 *   member up here and sends the visitor on to the right neighbor.
 *   Titles and icons are fetched automatically: the page's <title> and icon come through the free
 *   allOrigins service as JSONP (a <script> tag, which Neocities allows; plain fetch() to other
 *   sites is blocked on free Neocities accounts). Icons fall back to Google's favicon service, then
 *   a globe. Results are remembered in the visitor's browser for a week.
 *   To set a name by hand instead, use { url: 'https://...', name: 'Their Name' } in the list.
 */
(function () {
    'use strict';

    var CACHE_KEY = 'jv-network-meta', WEEK = 7 * 24 * 3600 * 1000;
    var cfg = window.SiteConfig || {};
    var HUB = cfg.siteUrl || 'https://jvanwagner.neocities.org/';

    /** "https://www.Example.com/page/" and "example.com/page" both become "example.com/page" */
    function norm(u) {
        return String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
            .replace(/[?#].*$/, '').replace(/\/(index\.html?)?$/, '');
    }
    function full(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : 'https://' + u; }
    function host(u) { try { return new URL(full(u)).hostname.replace(/^www\./, ''); } catch (e) { return norm(u).split('/')[0]; } }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { return {}; } }
    function writeCache(c) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {} }

    /** Load a URL as JSONP: resolves with the data, or null after 12 seconds. */
    var jsonpCount = 0;
    function jsonp(url) {
        return new Promise(function (resolve) {
            var name = '__netRing' + (++jsonpCount) + '_' + Date.now();
            var s = document.createElement('script'), done = false;
            var finish = function (data) {
                if (done) return; done = true;
                try { delete window[name]; } catch (e) { window[name] = undefined; }
                s.remove(); resolve(data || null);
            };
            window[name] = finish;
            s.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'callback=' + name;
            s.onerror = function () { finish(null); };
            setTimeout(function () { finish(null); }, 12000);
            document.head.appendChild(s);
        });
    }

    /** Pull the title and icon out of a page's HTML. */
    function parse(html, pageUrl) {
        var out = {};
        try {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var t = (doc.querySelector('title') || {}).textContent || '';
            var og = doc.querySelector('meta[property="og:site_name"], meta[property="og:title"]');
            out.title = (t || (og && og.getAttribute('content')) || '').replace(/\s+/g, ' ').trim().slice(0, 90);
            var link = doc.querySelector('link[rel~="icon"][sizes="32x32"], link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
            if (link && link.getAttribute('href')) out.icon = new URL(link.getAttribute('href'), full(pageUrl)).href;
        } catch (e) {}
        return out;
    }

    var R = window.NetworkRing = {
        esc: esc, norm: norm, full: full, host: host,
        hub: HUB,

        /** Every stop on the ring, hub first: [{ url, name? }] */
        members: function () {
            var list = (cfg.network || []).map(function (m) {
                return typeof m === 'string' ? { url: full(m) } : { url: full(m.url), name: m.name, icon: m.icon };
            }).filter(function (m) { return m.url && norm(m.url) !== norm(HUB); });
            return [{ url: HUB, name: cfg.ownerName ? cfg.ownerName + "'s portfolio" : 'The Network hub', icon: 'images/icons/favicon-32.png', isHub: true }].concat(list);
        },

        /** Where a ring button should go from a given site: 'next' | 'prev' | 'random' */
        target: function (from, go) {
            var ring = R.members(), n = ring.length;
            var key = norm(from), i = -1;
            ring.forEach(function (m, k) { if (i < 0 && key && (key === norm(m.url) || key.indexOf(norm(m.url) + '/') === 0)) i = k; });
            if (i < 0) i = 0;                                          // unknown site: start from the hub
            if (go === 'next') return ring[(i + 1) % n].url;
            if (go === 'prev') return ring[(i - 1 + n) % n].url;
            if (go === 'random') {
                if (n < 2) return ring[0].url;
                var j; do { j = Math.floor(Math.random() * n); } while (j === i);
                return ring[j].url;
            }
            return null;
        },

        /** { title, icon } for one site: from the config, the cache, or fetched (then cached). */
        meta: function (m) {
            var cache = readCache(), key = norm(m.url), hit = cache[key];
            var fallbackIcon = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host(m.url)) + '&sz=32';
            if (m.name && m.icon) return Promise.resolve({ title: m.name, icon: m.icon });
            if (hit && Date.now() - hit.at < WEEK) return Promise.resolve({ title: m.name || hit.title || host(m.url), icon: m.icon || hit.icon || fallbackIcon });
            return jsonp('https://api.allorigins.win/get?url=' + encodeURIComponent(full(m.url))).then(function (data) {
                var got = (data && data.contents) ? parse(data.contents, m.url) : {};
                if (got.title || got.icon) { cache[key] = { title: got.title, icon: got.icon, at: Date.now() }; writeCache(cache); }
                return { title: m.name || got.title || host(m.url), icon: m.icon || got.icon || fallbackIcon };
            });
        },

        /** Fill a list element with every member: icon, title, address. base = path prefix for local images. */
        renderList: function (ul, base) {
            base = base || '';
            var ring = R.members();
            ul.innerHTML = ring.map(function (m, k) {
                var icon = m.icon && !/^https?:/.test(m.icon) ? base + m.icon : (m.icon || 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host(m.url)) + '&sz=32');
                return '<li class="net-site' + (m.isHub ? ' is-hub' : '') + '" data-k="' + k + '">' +
                    '<img class="net-fav" src="' + esc(icon) + '" alt="" width="16" height="16" onerror="this.onerror=null;this.dataset.failed=1;this.src=\'' + base + 'images/icons/globe.svg\'">' +
                    '<a href="' + esc(m.url) + '" target="_blank" rel="noopener" title="Opens in a new tab">' +
                        '<span class="net-title">' + esc(m.name || host(m.url)) + '</span>' +
                        '<span class="net-url">' + esc(norm(m.url)) + '</span></a>' +
                    (m.isHub ? '<span class="net-hubtag">hub</span>' : '') + '</li>';
            }).join('');
            ring.forEach(function (m, k) {
                if (m.isHub) return;
                R.meta(m).then(function (info) {
                    var li = ul.querySelector('[data-k="' + k + '"]');
                    if (!li) return;
                    li.querySelector('.net-title').textContent = info.title;
                    var img = li.querySelector('.net-fav');
                    if (info.icon && img.getAttribute('src') !== info.icon && !img.dataset.failed) {
                        img.onerror = function () { img.onerror = null; img.dataset.failed = '1'; img.src = base + 'images/icons/globe.svg'; };
                        img.src = info.icon;
                    }
                });
            });
            return ring.length;
        },

        /** The HTML a member pastes onto their page. */
        snippet: function (siteUrl) {
            var hub = HUB.replace(/\/$/, '') + '/pages/network.html';
            var from = encodeURIComponent(full(siteUrl || 'https://YOUR-SITE.com/'));
            var img = HUB.replace(/\/$/, '') + '/images/network/the-network-';
            var a = function (go, file, alt, w) {
                return '  <a href="' + hub + '?from=' + from + '&amp;go=' + go + '" title="' + alt + '"><img src="' + img + file + '.png" width="' + w + '" height="31" alt="' + alt + '" style="image-rendering:pixelated;border:0"></a>\n';
            };
            return '<!-- The Network -->\n<div class="the-network" style="display:inline-flex;gap:3px;align-items:center">\n' +
                '  <a href="' + hub + '" title="The Network: fellow professionals\' sites"><img src="' + img + 'badge.png" width="88" height="31" alt="The Network" style="image-rendering:pixelated;border:0"></a>\n' +
                a('prev', 'prev', 'Previous site in The Network', 31) +
                a('list', 'list', 'Every site in The Network', 31) +
                a('random', 'random', 'A random site in The Network', 31) +
                a('next', 'next', 'Next site in The Network', 31) +
                '</div>';
        }
    };
})();
