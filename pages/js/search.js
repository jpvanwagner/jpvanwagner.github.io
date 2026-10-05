/**
 * SEARCH.JS - Site-wide search (every page loads this small file).
 *
 *  1. Adds a small, always-open search box to the page header; pressing Enter (or the
 *     magnifier) goes to search.html?q=your+words.
 *  2. Turns every tag box (<ul class="tags"><li>...) on the page into a link that lists all
 *     pages carrying that tag (search.html?tag=Narrated%20audio).
 *  3. On search.html it runs the search against window.SEARCH_INDEX (js/search-index.js, built by
 *     tools/build-search-index.py) and lists matching pages with highlighted snippets. Clicking a
 *     result opens the page and (in most browsers) scrolls to the matching words.
 * Everything runs in the browser, so it also works when the site is opened from a folder.
 */
(function () {
    var MAX_RESULTS = 25;

    function norm(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    function terms(q) {
        return norm(q).split(/[^a-z0-9+#.&'-]+/).filter(function (t) { return t.length > 1 || /\d/.test(t); });
    }
    function count(hay, t) {
        var n = 0, i = hay.indexOf(t);
        while (i !== -1) { n++; i = hay.indexOf(t, i + t.length); }
        return n;
    }

    /** Pages containing ALL the words, best first (title and heading matches count extra). */
    function search(q) {
        var ts = terms(q);
        if (!ts.length || !window.SEARCH_INDEX) return [];
        var out = [];
        window.SEARCH_INDEX.forEach(function (e) {
            var title = norm(e.title), heads = norm((e.headings || []).join(' | ')), text = norm(e.text);
            var score = 0;
            for (var i = 0; i < ts.length; i++) {
                var t = ts[i], inText = count(text, t);
                if (!inText && title.indexOf(t) === -1) return;          // every word must appear somewhere
                score += inText + (title.indexOf(t) !== -1 ? 12 : 0) + count(heads, t) * 4;
            }
            out.push({ e: e, score: score, ts: ts });
        });
        out.sort(function (a, b) { return b.score - a.score; });
        return out.slice(0, MAX_RESULTS);
    }

    /** ~200 characters of text around the first match, with every search word highlighted. */
    function snippet(text, ts) {
        var lower = norm(text), at = -1;
        ts.forEach(function (t) { var i = lower.indexOf(t); if (i !== -1 && (at === -1 || i < at)) at = i; });
        var start = Math.max(0, at - 80), end = Math.min(text.length, (at < 0 ? 0 : at) + 140);
        var cut = (start > 0 ? '… ' : '') + text.slice(start, end) + (end < text.length ? ' …' : '');
        var html = esc(cut);
        ts.forEach(function (t) {
            var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            html = html.replace(re, '<mark>$1</mark>');
        });
        return { html: html, firstWord: at >= 0 ? text.substr(at, ts[0].length) : '' };
    }

    function goTo(q) {
        if (q && q.trim()) location.href = 'search.html?q=' + encodeURIComponent(q.trim());
    }

    // ---------------------------------------------------------------- header button (every page)
    function addHeaderSearch() {
        var inner = document.querySelector('.site-header .inner');
        if (!inner || document.getElementById('site-search')) return;
        var form = document.createElement('form');
        form.id = 'site-search';
        form.className = 'site-search';
        form.setAttribute('role', 'search');
        // Always-open, compact box: type and press Enter (or click the magnifier)
        form.innerHTML =
            '<input type="search" name="q" placeholder="Search" aria-label="Search this site" autocomplete="off">' +
            '<button type="submit" class="search-go" aria-label="Search" title="Search this site">' +
            '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 10l4.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>';
        var mode = document.getElementById('mode-btn');
        inner.insertBefore(form, mode || null);
        var input = form.querySelector('input');
        form.addEventListener('submit', function (e) { e.preventDefault(); goTo(input.value); });
    }

    // ---------------------------------------------------------------- clickable tags (every page)
    function linkTags() {
        document.querySelectorAll('.tags li').forEach(function (li) {
            if (li.querySelector('a')) return;
            var tag = li.textContent.trim();
            var a = document.createElement('a');
            a.className = 'tag-link';
            a.href = 'search.html?tag=' + encodeURIComponent(tag);
            a.title = 'See every page tagged “' + tag + '”';
            a.textContent = tag;
            li.textContent = '';
            li.appendChild(a);
        });
    }

    /** Pages whose tag list includes `tag` (ignoring upper/lower case). */
    function byTag(tag) {
        var t = norm(tag).trim();
        return (window.SEARCH_INDEX || []).filter(function (e) {
            return (e.tags || []).some(function (x) { return norm(x) === t; });
        });
    }

    /** Every tag on the site, most-used first, as clickable boxes (shown when nothing is searched yet). */
    function tagCloud() {
        var counts = {};
        (window.SEARCH_INDEX || []).forEach(function (e) {
            (e.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
        });
        var list = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
        if (!list.length) return '';
        return '<h2>Browse by tag</h2><ul class="tags tag-cloud">' + list.map(function (t) {
            return '<li><a class="tag-link" href="search.html?tag=' + encodeURIComponent(t) + '" title="' + counts[t] + ' page(s)">' + esc(t) + '</a></li>';
        }).join('') + '</ul>';
    }

    // ---------------------------------------------------------------- results page (search.html)
    function runResultsPage() {
        var box = document.getElementById('search-results');
        if (!box) return;
        var input = document.getElementById('search-page-input');
        var status = document.getElementById('search-status');
        var params = new URLSearchParams(location.search);
        var q = params.get('q') || '';
        var tag = params.get('tag');
        var cloud = document.getElementById('search-tags');
        input.value = q;

        // A tag link was clicked: list the pages with that tag
        if (tag && !q) {
            var hits = byTag(tag);
            status.innerHTML = hits.length
                ? hits.length + (hits.length === 1 ? ' page is' : ' pages are') + ' tagged <b>“' + esc(tag) + '”</b>:'
                : 'No pages are tagged “' + esc(tag) + '”.';
            box.innerHTML = hits.map(function (e) {
                return '<li class="search-hit"><a href="' + esc(e.url) + '">' + esc(e.title) + '</a>' +
                       '<p class="hit-tags">' + e.tags.map(function (t) {
                           return '<a class="tag-link' + (norm(t) === norm(tag) ? ' is-current' : '') + '" href="search.html?tag=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
                       }).join(' ') + '</p></li>';
            }).join('');
            if (cloud) cloud.innerHTML = tagCloud();
            input.addEventListener('input', function () { tag = null; render(); });
            document.getElementById('search-page-form').addEventListener('submit', function (e) { e.preventDefault(); render(); });
            return;
        }

        function render() {
            var query = input.value;
            if (cloud) cloud.innerHTML = terms(query).length ? '' : tagCloud();
            var results = search(query);
            if (!terms(query).length) {
                status.textContent = 'Type a word or two, like "Canvas", "Rise 360" or "Alaska".';
                box.innerHTML = '';
                return;
            }
            status.textContent = results.length
                ? results.length + (results.length === 1 ? ' page matches' : ' pages match') + ' “' + query.trim() + '”'
                : 'No pages match “' + query.trim() + '”. Try fewer or different words.';
            // Offer a web search too (Google's embeddable mode works inside the retro desktop's browser)
            var web = document.getElementById('search-web');
            if (web) {
                web.href = 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(query.trim());
                web.parentNode.hidden = false;
                // inside the retro desktop, show Google right in NetCrawler instead of a new tab
                if (document.documentElement.classList.contains('in-desktop')) web.removeAttribute('target');
            }
            box.innerHTML = results.map(function (r) {
                var sn = snippet(r.e.text, r.ts);
                var href = r.e.url + (sn.firstWord ? '#:~:text=' + encodeURIComponent(sn.firstWord) : '');
                return '<li class="search-hit"><a href="' + esc(href) + '">' + esc(r.e.title) + '</a>' +
                       '<p>' + sn.html + '</p></li>';
            }).join('');
        }
        var t = null;
        input.addEventListener('input', function () {
            clearTimeout(t);
            t = setTimeout(function () {
                render();
                try { history.replaceState(null, '', '?q=' + encodeURIComponent(input.value)); } catch (e) {}
            }, 150);
        });
        document.getElementById('search-page-form').addEventListener('submit', function (e) { e.preventDefault(); render(); });
        render();
        input.focus();
    }

    window.SiteSearch = { search: search };   // handy for testing in the console

    document.addEventListener('DOMContentLoaded', function () {
        addHeaderSearch();
        linkTags();
        runResultsPage();
    });
})();
