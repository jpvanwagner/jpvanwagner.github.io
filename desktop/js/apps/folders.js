/**
 * FOLDERS.JS - Explorer-style folders for Sample Courses, Games and Projects (global: FolderApp).
 *
 *   FolderApp.open('courses' | 'games' | 'projects')
 *
 * Each folder shows one "file" per course / game / project (a thumbnail with its app icon as a
 * badge). Click once to select it (the bottom bar describes it), double-click (or Enter, or a single
 * tap on touch screens) to open it. Games and tools launch as their own app windows; courses open
 * their page in NetCrawler. "Open in NetCrawler" shows the same section as a web page.
 *
 * Where the lists come from (nothing to edit here when you add things):
 *   courses   the #courses cards on pages/projects.html
 *   games     `games` in config/site-config.js, plus the Midnight at the Multiplex demo
 *   projects  Scenemaker and Midnight at the Multiplex (the tools I'm building)
 * View (large/small icons, list, details) and Sort by (A to Z, Z to A, type) are remembered per visitor.
 * Styles: desktop/css/apps.css ("FOLDERS")
 */
window.FolderApp = {
    folders: {
        courses:  { title: 'Sample Courses', path: 'C:\\Portfolio\\Sample Courses', page: 'courses.html',
                    hint: 'Interactive e-learning I built in Articulate Rise 360. Double-click a course to open it.' },
        games:    { title: 'Games', path: 'C:\\Portfolio\\Games', page: 'games.html',
                    hint: 'Learning games I programmed, plus the demo of the game I\'m building. Double-click to play.' },
        projects: { title: 'Projects', path: 'C:\\Portfolio\\Projects', page: 'my-projects.html',
                    hint: 'What I\'m building now. Double-click to launch one as its own program.' }
    },

    /** The items in a folder (a Promise, since courses are read from the Portfolio page). */
    items(kind) {
        const midnight = { label: 'Midnight at the Multiplex', icon: 'images/icons/apps/midnight.png',
            thumb: 'images/projects/midnight/thumbs/title-screen.jpg', kind: 'Game demo',
            desc: 'My retro life-and-work sim set in a 1999 movie theater. The opening is playable.',
            open: () => MidnightApp.open(), openLabel: 'Play', page: 'project-midnight-multiplex.html' };
        const scenemaker = { label: 'Scenemaker', icon: 'images/icons/os/scenemaker.png',
            thumb: 'work/scenemaker/shots/stage-graph.png', kind: 'Program',
            desc: 'My branching-story authoring tool: build scenario-based training and export SCORM.',
            open: () => SceneMakerApp.open(), openLabel: 'Launch', page: 'project-scenemaker.html' };
        if (kind === 'games') {
            const games = ((window.SiteConfig && SiteConfig.games) || []).map(g => ({
                label: g.label, icon: 'images/icons/apps/' + g.id + '.png', thumb: 'images/games/' + g.id + '.jpg',
                kind: 'Learning game', desc: g.tip || '', open: () => GamesApp.open(g.id), openLabel: 'Play',
                page: 'project-game-' + g.id + '.html' }));
            return Promise.resolve(games.concat([midnight]));
        }
        if (kind === 'projects') return Promise.resolve([scenemaker, midnight]);
        // courses: every course card on the Portfolio page
        return fetch('pages/projects.html', { cache: 'no-cache' })
            .then(r => r.text())
            .then(html => {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const base = new URL('pages/projects.html', location.href);
                return [...doc.querySelectorAll('#courses article.card')].map(card => {
                    const a = card.querySelector('h3 a'), img = card.querySelector('.thumb img'), p = card.querySelector('.content p');
                    const href = a.getAttribute('href');
                    return { label: a.textContent.trim(), icon: 'images/icons/os/newfile.png',
                        thumb: img ? new URL(img.getAttribute('src'), base).href : '', kind: 'Course',
                        desc: p ? p.textContent.trim() : '', open: () => Browser.openPage(href), openLabel: 'Open', page: href };
                });
            })
            .catch(() => []);
    },

    /** View + sort choices, remembered per visitor for every folder (try/catch: storage can be blocked). */
    views: [['large', 'Large icons'], ['small', 'Small icons'], ['list', 'List'], ['details', 'Details']],
    sorts: [['az', 'Name (A to Z)'], ['za', 'Name (Z to A)'], ['type', 'Type'], ['none', 'Original order']],
    pref(key, val) {
        try {
            if (val === undefined) return localStorage.getItem('fx-' + key);
            localStorage.setItem('fx-' + key, val);
        } catch (e) { return null; }
    },

    open(kind) {
        const f = this.folders[kind];
        if (!f) return;
        const id = 'folder-' + kind;
        const opts = (list, cur) => list.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('');
        const view = this.pref('view') || 'large', sort = this.pref('sort') || 'none';
        const html = `
            <div class="fx">
                <div class="fx-bar">
                    <button type="button" class="bevel-out fx-web" title="See this section as a web page in NetCrawler">
                        <img src="images/icons/globe.svg" alt=""> Open in NetCrawler</button>
                    <div class="fx-path bevel-in" title="Where you are">${f.path}</div>
                </div>
                <div class="fx-tools">
                    <label title="How the items are shown: big thumbnails, small icons, a compact list, or a table with details">View
                        <select class="fx-view">${opts(this.views, view)}</select></label>
                    <label title="Put the items in order by name or by type">Sort by
                        <select class="fx-sort">${opts(this.sorts, sort)}</select></label>
                    <span class="fx-hint">${f.hint}</span>
                </div>
                <div class="fx-grid bevel-in fx-v-${view}" role="listbox" aria-label="${f.title}"><p class="fx-loading">Loading...</p></div>
                <div class="fx-status"><span class="fx-sel">Select an item to see what it is.</span></div>
            </div>`;
        WM.open(id, f.title, html, 'images/icons/os/folder-full.png', { width: 660, height: 480, center: true });
        const win = WM.windows[id];
        if (!win || win._fxReady) return;
        win._fxReady = true;
        win.querySelector('.fx-web').onclick = () => Browser.openPage(f.page);

        this.items(kind).then(items => {
            const grid = win.querySelector('.fx-grid');
            const status = win.querySelector('.fx-status');
            const viewSel = win.querySelector('.fx-view'), sortSel = win.querySelector('.fx-sort');
            if (!items.length) { grid.innerHTML = '<p class="fx-loading">Nothing here yet. Try <b>Open in NetCrawler</b>.</p>'; return; }
            items.forEach((it, i) => { it.n = i; });
            const count = () => `<span class="fx-sel">${items.length} item${items.length === 1 ? '' : 's'}</span>`;
            const select = (i) => {
                grid.querySelectorAll('.fx-item').forEach(b => b.classList.toggle('sel', +b.dataset.i === i));
                const it = items[i];
                status.innerHTML = `<span class="fx-sel"><b>${it.label}</b> <span class="fx-kind">${it.kind}</span><br>${it.desc}</span>
                    <span class="fx-acts">
                        <button type="button" class="bevel-out fx-open">${it.openLabel}</button>
                        <button type="button" class="bevel-out fx-about" title="Its page in NetCrawler">About</button>
                    </span>`;
                status.querySelector('.fx-open').onclick = () => it.open();
                status.querySelector('.fx-about').onclick = () => Browser.openPage(it.page);
            };

            // Draw the items in the chosen order and view
            const render = () => {
                const v = viewSel.value, s = sortSel.value;
                const list = items.slice();
                const byName = (a, b) => a.label.localeCompare(b.label);
                if (s === 'az') list.sort(byName);
                else if (s === 'za') list.sort((a, b) => byName(b, a));
                else if (s === 'type') list.sort((a, b) => a.kind.localeCompare(b.kind) || byName(a, b));
                grid.className = 'fx-grid bevel-in fx-v-' + v;
                const head = v === 'details' ? `<div class="fx-head" aria-hidden="true"><span>Name</span><span>Type</span><span>Description</span></div>` : '';
                grid.innerHTML = head + list.map(it => `
                    <button type="button" class="fx-item" role="option" data-i="${it.n}" title="${it.label}\n${it.desc}\n(double-click to ${it.openLabel.toLowerCase()})">
                        <span class="fx-thumb">${it.thumb && (v === 'large') ? `<img src="${it.thumb}" alt="" loading="lazy" draggable="false">` : ''}
                            <img class="fx-badge" src="${it.icon}" alt="" draggable="false"></span>
                        <span class="fx-name">${it.label}</span>
                        <span class="fx-type">${it.kind}</span>
                        <span class="fx-desc">${it.desc}</span>
                    </button>`).join('');
                grid.querySelectorAll('.fx-item').forEach(b => {
                    const i = +b.dataset.i;
                    b.addEventListener('click', () => select(i));
                    b.addEventListener('dblclick', () => items[i].open());
                    b.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); items[i].open(); } });
                    b.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') items[i].open(); });   // touch: one tap opens
                });
                status.innerHTML = count();
            };
            viewSel.onchange = () => { this.pref('view', viewSel.value); render(); };
            sortSel.onchange = () => { this.pref('sort', sortSel.value); render(); };
            win.querySelector('.window-content').addEventListener('click', (e) => {
                if (e.target === grid) {                     // clicking empty space clears the selection
                    grid.querySelectorAll('.fx-item').forEach(b => b.classList.remove('sel'));
                    status.innerHTML = count();
                }
            });
            render();
        });
    }
};
