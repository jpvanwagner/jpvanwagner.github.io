/**
 * CONTEXT-MENU.JS - Right-click menus for the retro desktop (global: ContextMenu).
 *
 *   ContextMenu.show(x, y, items)   show a menu; items are
 *        { label, action, checked?, disabled?, tip? }   a clickable row (checked = shows a tick)
 *        { separator: true }                           a divider
 *   ContextMenu.hide()
 *
 * Where right-click does something (decided in onContextMenu below):
 *   desktop background   arrange icons, wallpaper/themes, settings, show hidden drawer tabs...
 *   desktop icon         open, and page shortcuts can open in a new browser window
 *   window title bar     restore / minimize / maximize / close
 *   window taskbrick     same as the title bar (other bricks keep their "Lock the taskbar" menu)
 *   drawer tab           open/close, keep on top, hide (see drawer-tabs.js)
 * Inside windows (text, browser pages) the normal browser menu is left alone, so people can
 * still copy text. DoodleTop uses right-click to stop drawing, so it is skipped while drawing.
 * Styles: desktop/css/context-menu.css
 */
window.ContextMenu = {
    el: null,

    init() {
        this.el = document.createElement('div');
        this.el.id = 'context-menu';
        this.el.setAttribute('role', 'menu');
        document.body.appendChild(this.el);

        document.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        // Any click elsewhere, Escape, scrolling or resizing closes the menu
        document.addEventListener('pointerdown', (e) => { if (!this.el.contains(e.target)) this.hide(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide(); });
        window.addEventListener('resize', () => this.hide());
        window.addEventListener('blur', () => this.hide());   // e.g. clicking into an iframe
    },

    show(x, y, items) {
        const el = this.el;
        el.innerHTML = '';
        items.forEach(item => {
            if (item.separator) {
                const hr = document.createElement('div');
                hr.className = 'cm-sep';
                el.appendChild(hr);
                return;
            }
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'cm-item';
            row.setAttribute('role', 'menuitem');
            row.innerHTML = `<span class="cm-check">${item.checked ? '✓' : ''}</span><span>${item.label}</span>`;
            if (item.tip) row.title = item.tip;
            if (item.disabled) row.disabled = true;
            row.addEventListener('click', () => { this.hide(); if (item.action) item.action(); });
            el.appendChild(row);
        });
        el.style.display = 'block';
        // Keep it on screen
        const w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(2, Math.min(x, window.innerWidth - w - 2)) + 'px';
        el.style.top = Math.max(2, Math.min(y, window.innerHeight - h - 2)) + 'px';
        const first = el.querySelector('.cm-item:not([disabled])');
        if (first) first.focus({ preventScroll: true });
    },

    hide() {
        if (this.el) this.el.style.display = 'none';
    },

    /** Decide which menu (if any) belongs to what was right-clicked. */
    onContextMenu(e) {
        if (window.DoodleTop && DoodleTop.currentTool && DoodleTop.currentTool !== 'none') return;
        const t = e.target;
        let items = null;

        const dfItem = t.closest('.df-item');
        const dfWin = t.closest('.df-window');
        const tab = t.closest('#tools-tab, #doodletop-tab');
        const icon = t.closest('.desktop-icon');
        const titleBar = t.closest('.window .title-bar');
        const winBrick = t.closest('.brick.window-brick');

        if (dfItem && window.DesktopFiles) {
            items = DesktopFiles.itemMenu(dfItem.getAttribute('data-id'), dfItem.getAttribute('data-where'));
        } else if (dfWin && window.DesktopFiles && dfWin.getAttribute('data-folder') !== '__rubbish') {
            const f = dfWin.getAttribute('data-folder');
            items = [{ label: 'New folder', action: () => DesktopFiles.create('folder', f) },
                     { label: 'New text document', action: () => DesktopFiles.create('text', f) }];
        } else if (tab && window.DrawerTabs) {
            items = DrawerTabs.menuFor(tab.id === 'tools-tab' ? 'tools' : 'doodletop');
        } else if (icon) {
            items = this.iconMenu(icon);
        } else if (titleBar) {
            items = this.windowMenu(titleBar.closest('.window').id.replace(/^window-/, ''));
        } else if (winBrick) {
            items = this.windowMenu(winBrick.id.replace(/^brick-/, ''));
        } else if (t.id === 'desktop' || t.id === 'desktop-environment' || t.id === 'window-container') {
            items = this.desktopMenu();
        }

        if (!items) return;          // not ours: let the browser (or another handler) deal with it
        e.preventDefault();
        e.stopPropagation();
        if (window.Menu && Menu.close) Menu.close();
        this.show(e.clientX, e.clientY, items);
    },

    windowMenu(id) {
        const win = WM.windows[id];
        if (!win) return null;
        const max = win.dataset.isMaximized === 'true';
        const hidden = win.style.display === 'none';
        return [
            { label: 'Restore', disabled: !max && !hidden, action: () => { if (hidden) WM.toggle(id); if (max) WM.maximize(id); } },
            { label: 'Minimize', disabled: hidden, action: () => WM.minimize(id) },
            { label: 'Maximize', disabled: max, action: () => { if (hidden) WM.toggle(id); WM.maximize(id); } },
            { separator: true },
            { label: 'Close', action: () => WM.close(id) }
        ];
    },

    iconMenu(iconEl) {
        const icon = iconEl._icon;
        if (!icon) return null;
        const label = icon.label;
        const df = window.DesktopFiles;
        // The Rubbish bin itself
        if (icon.isRubbish && df) {
            return [
                { label: '<b>Open</b>', action: () => df.openRubbish() },
                { label: 'Empty Rubbish', disabled: !df.data.rubbish.length, action: () => df.emptyRubbish() }
            ];
        }
        // A visitor-made folder or text document
        if (icon.fileId && df) {
            return [
                { label: '<b>Open</b>', action: () => df.open(icon.fileId) },
                { label: 'Rename', action: () => df.rename(icon.fileId) },
                { separator: true },
                { label: 'Move to Rubbish', action: () => df.trash(icon.fileId) }
            ];
        }
        const run = () => { iconEl.classList.remove('pulse-red'); new Function(icon.action)(); };
        const items = [{ label: '<b>Open</b>', action: run }];
        // Page shortcuts can also open in their own browser window
        const page = (SiteConfig.pages || []).find(p => p.label === label);
        if (page && window.Browser) {
            const asTab = window.BrowserTabs && BrowserTabs.enabled() && OSSettings.get('browser.newIn') === 'tab' && BrowserTabs.topInstance();
            items.push({ label: asTab ? 'Open in new tab' : 'Open in new window', action: () => Browser.open('pages/' + page.file, true) });
            items.push({ label: 'Open in Traditional View', action: () => {
                SiteMode.set('classic'); location.href = 'pages/' + page.file;
            } });
        }
        items.push({ separator: true });
        if (df && df.canBin(icon)) {
            items.push({ label: 'Move to Rubbish', action: () => df.trash(icon),
                         tip: 'Get it back any time from the Rubbish bin' });
        } else {
            items.push({ label: 'Move to Rubbish', disabled: true, tip: 'Part of the portfolio, so it stays' });
        }
        if (icon.tip) items.push({ label: 'Properties', action: () => this.properties(icon) });
        return items;
    },

    /** A small "Properties" dialog for a desktop icon (just its description). */
    properties(icon) {
        const src = icon.icon.startsWith('http') ? icon.icon : 'images/icons/' + icon.icon;
        WM.open('props-' + icon.label.replace(/\W/g, ''), icon.label + ' Properties', `
            <div class="props-dialog">
                <div class="props-head"><img src="${src}" alt=""><strong>${icon.label}</strong></div>
                <p>${icon.tip}</p>
                <p class="props-kind">Type: ${icon.shortcut ? 'Shortcut to a web page' : 'Program'}</p>
            </div>`, src, { width: 300, height: 190, center: true });
    },

    desktopMenu() {
        const items = [
            ...(window.DesktopUndo ? DesktopUndo.menuItems() : []),
            ...(window.DesktopUndo ? [{ separator: true }] : []),
            { label: 'Arrange icons', action: () => { if (window.Desktop) Desktop.init(); },
              tip: 'Put the desktop icons back in neat columns' },
            ...(window.Desktop && Desktop.arrangeMenu ? Desktop.arrangeMenu() : []),
            { label: 'Refresh', action: () => { if (window.Desktop) Desktop.init(); } },
            { separator: true },
            { label: 'New folder', action: () => window.DesktopFiles && DesktopFiles.create('folder'),
              tip: 'Make a folder on the desktop (saved only in this browser)' },
            { label: 'New text document', action: () => window.DesktopFiles && DesktopFiles.create('text'),
              tip: 'Make a text file you can edit in Notes (saved only in this browser)' },
            { separator: true },
            { label: 'Wallpaper...', action: () => window.Tools && Tools.openWallpapers() },
            { label: 'Themes...', action: () => window.Tools && Tools.openThemes() },
            { label: 'Settings...', action: () => window.OSSettings && OSSettings.open() }
        ];
        if (window.DrawerTabs && DrawerTabs.anyHidden()) {
            items.push({ label: 'Show drawer tabs', action: () => DrawerTabs.showAll(),
                         tip: 'Bring back the TOOLS / DoodleTop tabs you hid' });
        }
        items.push({ separator: true });
        items.push({ label: 'Switch to Traditional View', action: () => window.ViewMode && ViewMode.toClassic() });
        items.push({ label: 'About this site', action: () => window.AboutOS && AboutOS.open() });
        return items;
    }
};
document.addEventListener('DOMContentLoaded', () => ContextMenu.init());
