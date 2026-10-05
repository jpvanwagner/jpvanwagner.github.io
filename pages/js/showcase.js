/**
 * SHOWCASE.JS - "Try something I built" on the Home page: 4 games/tools + 4 sample courses, mixed up each visit.
 *
 * The lists come straight from the Portfolio page (projects.html): every card in its #games and
 * #courses sections (thumbnail + title + link). Add a card there and it joins the rotation here,
 * with nothing to edit in this file. If projects.html can't be read (e.g. opened from a local
 * file), the tiles already written in home.html stay, just shuffled.
 *
 * Markup: <div class="game-strip" data-showcase="games|courses" data-count="4">...tiles...</div>
 * Tiles marked data-extra (e.g. Midnight at the Multiplex, Scenemaker) always stay in that row's pool,
 * so they rotate in here without being added to the Portfolio page's games list or games.html.
 */
(function () {
    // Fisher-Yates shuffle (returns a new array)
    function shuffle(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function tile(item) {
        const a = document.createElement('a');
        a.className = 'game-tile';
        a.href = item.href;
        a.title = 'Open ' + item.title;
        const img = document.createElement('img');
        img.src = item.img; img.alt = ''; img.loading = 'lazy';
        const span = document.createElement('span');
        span.textContent = item.title;
        a.append(img, span);
        return a;
    }

    function fill(strip, items) {
        const n = parseInt(strip.dataset.count, 10) || 4;
        if (!items.length) return;
        strip.replaceChildren(...shuffle(items).slice(0, n).map(tile));
    }

    // Read the cards out of one section of projects.html
    function cardsFrom(doc, id) {
        const sec = doc.getElementById(id);
        if (!sec) return [];
        return [...sec.querySelectorAll('article.card')].map(card => {
            const link = card.querySelector('h3 a'), img = card.querySelector('.thumb img');
            return link && img ? { href: link.getAttribute('href'), img: img.getAttribute('src'), title: link.textContent.trim() } : null;
        }).filter(Boolean);
    }

    function tilesIn(strip, sel) {
        return [...strip.querySelectorAll(sel)].map(a => ({
            href: a.getAttribute('href'), img: a.querySelector('img').getAttribute('src'), title: a.textContent.trim()
        }));
    }

    function init() {
        const strips = [...document.querySelectorAll('[data-showcase]')];
        if (!strips.length) return;
        // Remember each row's extras before anything is shuffled away
        strips.forEach(s => { s._extras = tilesIn(s, 'a.game-tile[data-extra]'); });
        // First, shuffle what's already on the page (works everywhere, even offline)
        strips.forEach(s => fill(s, tilesIn(s, 'a.game-tile')));
        // Then swap in the full, current lists from the Portfolio page
        fetch('projects.html', { cache: 'no-cache' })
            .then(r => r.ok ? r.text() : Promise.reject())
            .then(html => {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                strips.forEach(s => fill(s, cardsFrom(doc, s.dataset.showcase).concat(s._extras)));
            })
            .catch(() => {});
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
