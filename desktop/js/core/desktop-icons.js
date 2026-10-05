/**
 * DESKTOP-ICONS.JS - The icons on the desktop (global: Desktop).
 * Page icons come from config/site-config.js; the fun extras (readme, browser, Traditional View,
 * Rubbish) are listed in buildIcons(). Icons can be dragged anywhere; double-click opens
 * (single tap on touch screens, Enter key when focused). Icons with `shortcut: true` get the
 * shortcut-arrow badge, because on a real desktop a link to a web page is a shortcut.
 * Styles: desktop/css/desktop-icons.css
 */
window.Desktop = {
    // Built in init() from site-config.js, plus a few fun system icons
    icons: [],

    buildIcons() {
        const cfg = window.SiteConfig || { pages: [] };
        // Sample Courses and Projects open as folders (folders.js), with an "Open in NetCrawler" button inside
        const folderOf = { 'courses': 'courses', 'my-projects': 'projects' };
        const pageIcons = cfg.pages.map(p => folderOf[p.id]
            ? { label: p.label, icon: 'os/folder-full.png', action: `window.FolderApp.open('${folderOf[p.id]}')`, tip: p.tip }
            : { label: p.label, icon: p.icon, action: `window.Browser.openPage('${p.file}')`, shortcut: true, tip: p.tip });
        const system = pageIcons.concat([
            { label: "readme.txt", icon: "os/newfile.png", action: "NotesApp.open('readme.txt', 'readme.txt', { width: 680, height: 560 })", specialClass: "pulse-red", tip: "Start here: how to get around this desktop" },
            { label: "Games", icon: "os/folder-full.png", action: "window.GamesApp.openFolder()", tip: "Quiz games I built for training, plus the Midnight at the Multiplex demo (playable)" },
            { label: "Scenemaker", icon: "os/scenemaker.png", action: "window.SceneMakerApp.open()", tip: "Live demo of Scenemaker, the branching-story authoring tool I'm building" },
            { label: "Network", icon: "os/network.svg", action: "window.NetworkApp.open()", tip: "The Network: fellow professionals' websites, linked together. Hop between them, or join" },
            { label: "Search", icon: "os/search.svg", action: "window.Browser.open('pages/find.html', true, true)", tip: "Seek: search every page of this portfolio, or browse by topic" },
            { label: "NetCrawler", icon: "globe.svg", action: "window.Browser.open(null, true)", tip: "Web browser: opens this portfolio (and other sites)" },
            { label: "Traditional View", icon: "os/classic-view.svg", action: "window.ViewMode.toClassic()", shortcut: true, tip: "Switch to the regular (non-retro) website" },
            { label: "Share", icon: "os/socials.png", action: "window.SiteShare && SiteShare.open()", tip: "Share this portfolio: LinkedIn, email, copy the link, and more" },
            { label: "Rubbish", icon: "os/rubbish.png", action: "DesktopFiles.openRubbish()", isRubbish: true,
              tip: "Rubbish bin: drag things here to throw them away, or open it to restore them" }
        ]);
        // Default desktop order (icons fill each column top to bottom). Anything not listed
        // keeps its place after these; readme.txt and Rubbish are placed separately below.
        const ORDER = ['Home', 'Network', 'About Me', 'Resume', 'Portfolio', 'Sample Courses', 'Projects',
                       'Games', 'Scenemaker', 'NetCrawler', 'Search', 'Share', 'Contact', 'Traditional View'];
        const rank = (i) => { const k = ORDER.indexOf(i.label); return k < 0 ? ORDER.length : k; };
        const bin0 = system.pop();
        system.sort((a, b) => rank(a) - rank(b));        // stable: unlisted icons keep their order
        system.push(bin0);
        this.allIcons = system;
        // Visitors' own folders/text documents (desktop-files.js) go before the Rubbish bin;
        // built-in icons the visitor binned (e.g. readme.txt) are left out until restored
        const df = window.DesktopFiles;
        const shown = df ? system.filter(i => !df.isHidden(i.label)) : system;
        const bin = shown.pop();
        // readme.txt is the last icon by default (after the visitor's own items; Rubbish sits
        // in the opposite corner). Sorting by name puts it wherever the alphabet does.
        const ri = shown.findIndex(i => i.label === 'readme.txt');
        const readme = ri > -1 ? shown.splice(ri, 1) : [];
        const all = shown.concat(df ? df.userIcons() : [], readme, [bin]);
        return this.applyOrder ? this.applyOrder(all) : all;   // remembered order (desktop-arrange.js)
    },

    init() {
        const d = document.getElementById('desktop');
        if(!d) return;
        d.innerHTML = ''; 
        this.icons = this.buildIcons();
        

        setTimeout(() => {
            const tabs = document.querySelectorAll('.drawer-tab, .drawer-handle, #tools-tab, #doodletop-tab, .tab');
            tabs.forEach(tab => {
                Array.from(tab.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '') {
                        const span = document.createElement('span');
                        span.innerText = node.nodeValue.trim();
                        tab.replaceChild(span, node);
                    }
                });
            });
        }, 100);

        this.els = [];
        this.layoutKey = null;           // force a fresh layout ("Arrange icons" calls init again)
        this.icons.forEach((icon) => {
            const el = document.createElement('div');
            el.className = 'desktop-icon';
            el.dataset.label = icon.label;   // lets tips/menus find a specific icon
            if (icon.isRubbish) el.dataset.rubbish = 'true';
            if (icon.fileId) el.dataset.fileId = icon.fileId;   // a visitor-made item (desktop-files.js)
            if (icon.isRubbish && window.DesktopFiles && DesktopFiles.rubbishFull()) el.classList.add('rubbish-full');
            el._icon = icon;                                     // right-click menus and drag-and-drop read this
            if(icon.specialClass) el.classList.add(icon.specialClass);
            this.els.push(el);
            
            // Icon URL logic
            const imgUrl = (icon.icon.startsWith('http')) ? icon.icon : `images/icons/${icon.icon}`;
            
            // Shortcuts (icons that open a web page) get the little arrow badge, like a real desktop
            const arrow = icon.shortcut ? `<img class="shortcut-arrow" src="images/icons/os/shortcut.png" alt="" draggable="false">` : '';
            el.innerHTML = `<div class="icon-art"><img src="${imgUrl}" draggable="false" onerror="this.style.visibility='hidden'">${arrow}</div><span>${icon.label}</span>`;
            // Tooltip: a short description when the icon has one, else just the name
            el.title = icon.tip ? `${icon.tip}\n(double-click to open)` : `Double-click to open ${icon.label}`;
            el.tabIndex = 0;
            
            el.addEventListener('mousedown', (e) => this.dragStart(e, el));
            el.addEventListener('touchstart', (e) => this.dragStart(e, el), {passive: true});
            const run = () => {
                el.classList.remove('pulse-red'); 
                new Function(icon.action)();
            };
            el.ondblclick = run;
            // Touch screens: a single tap opens (double-tapping is awkward on tablets)
            el.addEventListener('click', (e) => { if (e.pointerType === 'touch') run(); });
            el.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
            d.appendChild(el);
        });
        this.layout();

        // Re-arrange when the screen size changes (rotation, resizing the browser window)
        if (!this._resizeHooked) {
            this._resizeHooked = true;
            let t = null;
            window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => this.layout(), 150); });
        }

        if (this._mdHooked) return;
        this._mdHooked = true;
        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.desktop-icon')) {
                document.querySelectorAll('.desktop-icon').forEach(icon => icon.classList.remove('selected'));
            }
        });
    },

    /**
     * Position the icons in columns from the top-left, filling each column down to just above
     * the taskbricks before starting the next one (so fewer columns are needed). Runs again when
     * the screen size or the taskbrick rows change. Icons the visitor dragged somewhere stay put.
     * Small/short screens get smaller icons on a tighter grid (body.compact-desktop).
     */
    layout() {
        if (!this.els) return;
        const compact = window.innerHeight < 560 || window.innerWidth < 600;
        document.body.classList.toggle('compact-desktop', compact);
        const step = compact ? 74 : 96;          // grid cell (icon + label + gap)
        const iconH = compact ? 66 : 88;         // height one icon needs
        this.step = step;
        const areaH = (typeof WM !== 'undefined' && WM.workArea) ? WM.workArea().height : window.innerHeight - 44;
        const perColumn = Math.max(1, Math.floor((areaH - 8 - iconH) / step) + 1);
        this.perColumn = perColumn;
        const key = compact + ':' + perColumn + ':' + areaH;
        if (key === this.layoutKey) return;
        this.layoutKey = key;

        let i = 0;
        this.els.forEach(el => {
            if (el.dataset.rubbish) {             // Rubbish bin: bottom-right corner, above the taskbricks
                el.style.top = 'auto'; el.style.left = 'auto';
                el.style.right = '20px';
                el.style.bottom = (window.innerHeight - areaH + 6) + 'px';
                return;
            }
            // Hand-placed icons stay put, unless "Auto arrange" is on (desktop-arrange.js)
            if (el.dataset.moved !== 'true' || (this.autoArrange && this.autoArrange())) {
                el.style.top = (8 + (i % perColumn) * step) + 'px';
                el.style.left = (10 + Math.floor(i / perColumn) * step) + 'px';
            }
            i++;
        });
    },

    /** Built-in portfolio shortcuts can't be thrown away: say so, and put the icon back. */
    cannotBin(icon) {
        WM.open('cannot-bin', 'Rubbish', `<div class="props-dialog"><p><b>${icon.label}</b> is part of this portfolio, so it can't go in the Rubbish.</p>
            <p>You can throw away your own folders and text documents, plus readme.txt, NetCrawler, and Traditional View.</p></div>`,
            'images/icons/os/rubbish.png', { width: 320, height: 170, center: true });
        this.layoutKey = null;
        const el = this.els.find(x => x._icon === icon);
        if (el) delete el.dataset.moved;
        this.layout();
    },

    /**
     * While an icon is dragged, light up what it would be dropped into: the Rubbish bin (red
     * "no" look if that icon can't be binned) or one of the visitor's folders.
     * Styles: desktop/css/desktop-files.css ("drop-target")
     */
    markDropTarget(el, x, y) {
        let target = null;
        if (el) {
            el.style.pointerEvents = 'none';
            const under = document.elementFromPoint(x, y);
            el.style.pointerEvents = '';
            target = under && under.closest('.desktop-icon');
            const t = target && target !== el && target._icon;
            const df = window.DesktopFiles;
            const folder = t && t.fileId && df && df.item(t.fileId) && df.item(t.fileId).type === 'folder' && !el._icon.isRubbish;
            if (!t || !(t.isRubbish || folder)) target = null;
            // ...or an open folder / Rubbish window
            const win = !target && !el._icon.isRubbish && under && under.closest('.df-window');
            if (win) target = win;
        }
        document.querySelectorAll('.drop-target').forEach(i => {
            if (i !== target) i.classList.remove('drop-target', 'drop-refuse');
        });
        if (target) {
            target.classList.add('drop-target');
            const bin = target._icon ? target._icon.isRubbish : target.getAttribute('data-folder') === '__rubbish';
            target.classList.toggle('drop-refuse', !!(bin && window.DesktopFiles && !DesktopFiles.canBin(el._icon)));
        }
    },

    dragStart(e, el) {
        if(e.type === 'mousedown' && e.button !== 0) return; 
        e.stopPropagation(); 
        document.querySelectorAll('.desktop-icon').forEach(i => {
            i.style.zIndex = '1'; i.classList.remove('selected');
        });
        el.style.zIndex = '100'; el.classList.add('selected');

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = el.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;
        
        el.style.left = startLeft + 'px';
        el.style.top = startTop + 'px';
        el.style.bottom = 'auto';
        el.style.right = 'auto';

        let lastX = clientX, lastY = clientY;
        const onMove = (ev) => {
            const mX = ev.touches ? ev.touches[0].clientX : ev.clientX;
            const mY = ev.touches ? ev.touches[0].clientY : ev.clientY;
            lastX = mX; lastY = mY;
            el.style.left = (startLeft + (mX - clientX)) + 'px';
            el.style.top = (startTop + (mY - clientY)) + 'px';
            el.dataset.moved = 'true';   // dragged by hand: automatic re-arranging leaves it alone
            this.markDropTarget(el, mX, mY);
        };

        const onUp = () => {
            this.markDropTarget(null);
            // Dropped on another icon? (Rubbish = throw away; a visitor's folder = file it there)
            if (el.dataset.moved === 'true' && window.DesktopFiles) {
                el.style.pointerEvents = 'none';
                const under = document.elementFromPoint(lastX, lastY);
                el.style.pointerEvents = '';
                const target = under && under.closest('.desktop-icon');
                const win = !target && under && under.closest('.df-window');
                if (target && target !== el && target._icon) {
                    if (!DesktopFiles.dropOn(el._icon, target._icon) && target._icon.isRubbish) {
                        this.cannotBin(el._icon);
                    }
                } else if (win && !el._icon.isRubbish) {
                    DesktopFiles.dropOnWindow(el._icon, win.getAttribute('data-folder'));   // redraws the desktop
                } else if (this.onDrop) {
                    this.onDrop(el, el.offsetLeft, el.offsetTop);   // auto arrange / snap to grid
                }
            }
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove);
        document.addEventListener('touchend', onUp);
    }
};