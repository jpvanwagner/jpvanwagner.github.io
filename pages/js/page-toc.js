/**
 * PAGE-TOC.JS - "On this page": a small table of contents box at the top left of each sectioned
 * page (the project pages and About), built automatically from the page's headings.
 *   - Uses the h2 headings in <main>; a page with fewer than 3 h2s but 3+ h3s (Copywriting) uses
 *     the h3s instead. Pages with fewer than 3 sections get no box.
 *   - Headings without an id get one made from their text, so every section can be linked to
 *     directly (e.g. project-instructional-design.html#working-smarter-with-ai).
 *   - The box floats to the left of the intro text, right under the page title and lede. On narrow
 *     screens it sits full width and starts folded up.
 * Section tags: each section can end with its own <ul class="tags section-tags"> list. Those are
 * page tags as far as search is concerned (tools/build-search-index.py), so searching a tag returns
 * the page, not the section. Styles: css/classic.css ("ON THIS PAGE") + css/modern.css.
 */
(function () {
    'use strict';
    function slug(s) {
        return s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';
    }
    function build() {
        var file = (location.pathname.split('/').pop() || '').replace(/\.html?$/, '');
        if (!/^project-|^about$/.test(file)) return;
        var main = document.querySelector('main');
        if (!main || main.querySelector('.page-toc')) return;
        var visible = function (h) { return !h.closest('.retro-only, .page-toc, [hidden]'); };
        var heads = [].slice.call(main.querySelectorAll('h2')).filter(visible);
        if (heads.length < 3) {
            var h3s = [].slice.call(main.querySelectorAll('h3')).filter(visible);
            if (h3s.length >= 3) heads = h3s; else return;
        }
        var used = {};
        [].forEach.call(document.querySelectorAll('[id]'), function (el) { used[el.id] = 1; });
        var items = heads.map(function (h) {
            if (!h.id) {
                var id = slug(h.textContent), n = 2, base = id;
                while (used[id]) id = base + '-' + (n++);
                h.id = id; used[id] = 1;
            }
            return '<li><a href="#' + h.id + '">' + h.textContent.trim().replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</a></li>';
        });
        var nav = document.createElement('nav');
        nav.className = 'page-toc';
        nav.setAttribute('aria-label', 'On this page');
        nav.innerHTML = '<details open><summary title="Jump to a section of this page">On this page</summary><ul>' + items.join('') + '</ul></details>';
        // right under the title (and its lede line, if it has one)
        var h1 = main.querySelector('h1');
        var anchor = h1 && h1.nextElementSibling && h1.nextElementSibling.classList.contains('lede') ? h1.nextElementSibling : h1;
        if (anchor) anchor.parentNode.insertBefore(nav, anchor.nextSibling);
        else main.insertBefore(nav, main.firstChild);
        if (window.matchMedia && matchMedia('(max-width: 700px)').matches) nav.querySelector('details').open = false;
        // the in-page links: smooth, and keep the address bar tidy
        nav.addEventListener('click', function (e) {
            var a = e.target.closest('a[href^="#"]');
            if (!a) return;
            var t = document.getElementById(a.getAttribute('href').slice(1));
            if (!t) return;
            e.preventDefault();
            t.scrollIntoView({ behavior: 'smooth', block: 'start' });
            try { history.replaceState(null, '', '#' + t.id); } catch (err) {}
        });
        // arriving with #section (from another page) after the ids exist
        if (location.hash) { var t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) setTimeout(function () { t.scrollIntoView(); }, 50); }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
