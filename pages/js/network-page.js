/**
 * NETWORK-PAGE.JS - pages/network.html, "The Network" webring hub.
 *   1. Ring buttons on member sites link here with ?go=prev|next|random|list&from=<their address>.
 *      prev / next / random send the visitor straight on (shared/network-ring.js picks the site);
 *      list (or no go=) just shows this page.
 *   2. Fills in the full list of member sites (titles and icons are fetched automatically).
 *   3. The "Join" section: type your address, get the copy-and-paste HTML (with a live preview).
 */
(function () {
    'use strict';
    var R = window.NetworkRing;
    if (!R) return;

    // ---- 1. Hop to a neighbor, before the page even draws
    var q = new URLSearchParams(location.search);
    var go = (q.get('go') || '').toLowerCase();
    var from = q.get('from') || document.referrer || '';
    if (go === 'prev' || go === 'next' || go === 'random') {
        var dest = R.target(from, go);
        if (dest) {
            document.documentElement.classList.add('net-hopping');
            var words = { prev: 'the previous site', next: 'the next site', random: 'a random site' }[go];
            document.addEventListener('DOMContentLoaded', function () {
                var hop = document.getElementById('net-hop'), txt = document.getElementById('net-hop-text');
                if (hop) hop.hidden = false;
                if (txt) txt.innerHTML = 'Hopping to ' + words + ' in The Network&hellip;<br><a href="' + R.esc(dest) + '">' + R.esc(R.norm(dest)) + '</a>';
            });
            location.replace(dest);
            return;
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        // ---- 2. The full list
        var ul = document.getElementById('net-list');
        if (ul) {
            var n = R.renderList(ul, '../');
            var count = document.getElementById('net-count');
            if (count) count.textContent = '(' + n + (n === 1 ? ' site)' : ' sites)');
            var empty = document.getElementById('net-empty-note');
            if (empty) empty.hidden = n > 1;
        }
        // the full list is folded up at the bottom; the List button (and ?go=list) opens it
        var openList = function () {
            var d = document.getElementById('net-index'); if (d) d.open = true;
            var m = document.getElementById('members'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        if (go === 'list' || location.hash === '#members') setTimeout(openList, 60);
        document.querySelectorAll('[data-open-list]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); openList(); }); });

        // ---- 3. Join: the copy-and-paste code
        var input = document.getElementById('net-your-url'), code = document.getElementById('net-code');
        var preview = document.getElementById('net-preview'), copy = document.getElementById('net-copy'), said = document.getElementById('net-copied');
        if (!input || !code) return;
        var update = function () {
            var html = R.snippet(input.value.trim() || 'https://YOUR-SITE.com/');
            code.value = html;
            // the preview uses this site's own copies of the images, and its links don't navigate
            preview.innerHTML = html.replace(/<!--[^>]*-->\n?/, '').split(R.hub.replace(/\/$/, '') + '/images/').join('../images/');
            preview.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); a.removeAttribute('href'); });
        };
        input.addEventListener('input', update);
        update();
        copy.addEventListener('click', function () {
            var done = function (ok) { said.textContent = ok ? 'Copied! Now paste it into your page.' : 'Select the code above and copy it (Ctrl+C).'; setTimeout(function () { said.textContent = ''; }, 4000); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code.value).then(function () { done(true); }, function () { code.select(); done(false); });
            else { code.select(); try { done(document.execCommand('copy')); } catch (e) { done(false); } }
        });
        code.addEventListener('focus', function () { code.select(); });
    });
})();
