/**
 * COLLECTION.JS - Sample courses and learning games: "4 at a time, plus View all".
 *
 * On the Portfolio page (projects.html), a grid marked
 *     <div class="grid" data-collection="courses" data-show="4" data-page="courses.html" data-noun="courses">
 * gets shuffled, shows 4 cards, and hides the rest behind a "View all 11 courses" button (which
 * expands the box in place). A link opens the full list on its own page.
 *
 * On those own pages (courses.html, games.html), an empty grid marked
 *     <div class="grid" data-collection-source="courses">
 * is filled with every card from the matching section of projects.html, so the cards only ever
 * live in ONE place: add a new card on the Portfolio page and it shows up everywhere (Home too,
 * via js/showcase.js). If projects.html can't be read, the fallback link inside the grid stays.
 * data-collection-extra="page.html#card-id" also adds one card from another page at the end
 * (games.html uses it for the Midnight at the Multiplex card on my-projects.html).
 */
(function () {
    function shuffle(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // ---- Portfolio page: random few + View all ----
    function setupPreview(grid) {
        const show = parseInt(grid.dataset.show, 10) || 4;
        const noun = grid.dataset.noun || 'items';
        const cards = shuffle([...grid.querySelectorAll(':scope > article.card')]);
        cards.forEach(c => grid.appendChild(c));                 // new random order
        const extra = cards.slice(show);

        const note = document.createElement('span');
        note.className = 'collection-note';
        const row = document.createElement('p');
        row.className = 'btn-row collection-more';
        if (extra.length) {
            extra.forEach(c => { c.hidden = true; });
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'btn';
            const label = () => grid.classList.contains('expanded')
                ? 'Show fewer ' + noun : 'View all ' + cards.length + ' ' + noun;
            btn.textContent = label();
            btn.title = 'Show every one right here';
            btn.setAttribute('aria-expanded', 'false');
            btn.addEventListener('click', () => {
                const open = grid.classList.toggle('expanded');
                extra.forEach(c => { c.hidden = !open; });
                btn.textContent = label();
                btn.setAttribute('aria-expanded', String(open));
                note.textContent = open ? 'Showing all ' + cards.length + '.' : 'Showing ' + show + ' of ' + cards.length + '.';
                if (!open) grid.closest('section').scrollIntoView({ block: 'start' });
            });
            row.appendChild(btn);
        }
        if (grid.dataset.page) {
            const a = document.createElement('a');
            a.className = 'btn'; a.href = grid.dataset.page;
            a.textContent = 'Open all ' + noun + ' on their own page';
            a.title = 'A page with just the ' + noun;
            row.appendChild(a);
        }
        note.textContent = extra.length ? 'Showing ' + show + ' of ' + cards.length + '.' : '';
        row.appendChild(note);
        grid.after(row);
    }

    // ---- Own page: every card, pulled from projects.html ----
    function fetchDoc(url) {
        return fetch(url, { cache: 'no-cache' })
            .then(r => r.ok ? r.text() : Promise.reject())
            .then(html => new DOMParser().parseFromString(html, 'text/html'));
    }

    function fillFromPortfolio(grid) {
        const [extraPage, extraId] = (grid.dataset.collectionExtra || '').split('#');
        Promise.all([
            fetchDoc('projects.html'),
            extraPage && extraId ? fetchDoc(extraPage).catch(() => null) : Promise.resolve(null)
        ]).then(([doc, extraDoc]) => {
            const sec = doc.getElementById(grid.dataset.collectionSource);
            const cards = sec ? [...sec.querySelectorAll('article.card')] : [];
            const extra = extraDoc && extraDoc.getElementById(extraId);
            if (extra) { extra.removeAttribute('id'); cards.push(extra); }
            if (!cards.length) return;
            grid.replaceChildren(...cards.map(c => document.importNode(c, true)));
            const count = document.querySelector('[data-collection-count]');
            if (count) count.textContent = cards.length;
        }).catch(() => {});
    }

    function init() {
        document.querySelectorAll('[data-collection]').forEach(setupPreview);
        document.querySelectorAll('[data-collection-source]').forEach(fillFromPortfolio);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
