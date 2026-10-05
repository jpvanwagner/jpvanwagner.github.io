/**
 * MENU-SHORTCUTS.JS - Right-click anything in the MENU (pages, programs, games, links, folders,
 * Find, About...) for: Open, Open in new window / Traditional View (pages), Add to desktop, and
 * Properties (global: MenuShortcuts).
 *
 * Shortcuts are saved with the visitor's own folders and text documents (desktop-files.js,
 * type 'shortcut'), so they can be renamed, dragged into folders, and binned like those.
 * Menu items carry data-action / data-icon attributes for this (added in start-menu.js).
 * Items that are on/off switches (☐ / ☑) can't be made into shortcuts.
 */
window.MenuShortcuts = {
    /** Menu actions compared without spacing or trailing semicolons. */
    same(a, b) { return String(a).replace(/[\s;]+/g, '') === String(b).replace(/[\s;]+/g, ''); },

    /** Is there already a desktop icon that does this? */
    onDesktop(label, action) {
        const icons = (window.Desktop && Desktop.icons) || [];
        if (icons.some(i => !i.fileId && (i.label === label || this.same(i.action, action)))) return true;
        const df = window.DesktopFiles;
        return !!(df && df.data.items.some(i => i.type === 'shortcut' && i.parent === null && !df.inRubbish(i.id) && this.same(i.action, action)));
    },

    add(label, action, icon) {
        const df = window.DesktopFiles;
        if (!df) return;
        df.data.items.push({
            id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            type: 'shortcut', name: df.uniqueName(label, null), content: '', parent: null,
            action, icon: window.Menu ? Menu.iconPath(icon || 'newfile.png') : icon
        });
        df.refresh();
    },

    /** The page file a menu action opens (e.g. "resume.html"), or null. */
    pageOf(action) {
        const m = /openPage\('([^']+)'\)/.exec(action || '');
        return m ? m[1] : null;
    },

    /** Right-click menu for one MENU entry (an item, or a folder like Programs / Games). */
    menuFor(el) {
        const isFolder = el.hasAttribute('data-folder');
        const label = isFolder ? el.getAttribute('data-folder')
                               : (el.querySelector('span') || el).textContent.replace(/\s+/g, ' ').trim();
        const action = el.getAttribute('data-action');
        const icon = el.getAttribute('data-icon') || 'newfile.png';
        const tip = isFolder ? (el.querySelector('div') || el).title : el.title;
        const toggle = /^[☐☑]/.test(label);
        const run = () => { if (window.Menu) Menu.close(); new Function(action)(); };
        const items = [];

        if (action) items.push({ label: '<b>Open</b>', action: run });
        else items.push({ label: '<b>Open</b>', disabled: true, tip: 'Point at the folder to see what\'s inside' });

        // Portfolio pages: also open in a separate window, or in Traditional View
        const page = this.pageOf(action);
        if (page && window.Browser) {
            items.push({ label: 'Open in new window', action: () => { if (window.Menu) Menu.close(); Browser.open('pages/' + page, true, true); } });
            items.push({ label: 'Open in Traditional View', action: () => { if (window.SiteMode) SiteMode.set('classic'); location.href = 'pages/' + page; } });
        }

        items.push({ separator: true });
        const there = action && !toggle && this.onDesktop(label, action);
        items.push({
            label: there ? 'Already on the desktop' : 'Add to desktop',
            disabled: !action || toggle || there,
            tip: toggle ? 'On/off switches can\'t go on the desktop'
                : !action ? 'Right-click something inside this folder instead'
                : 'Put a shortcut to this on the desktop (saved in this browser)',
            action: () => { if (window.Menu) Menu.close(); this.add(label, action, icon); }
        });
        if (tip && window.ContextMenu && ContextMenu.properties) {
            items.push({ separator: true });
            items.push({ label: 'Properties', action: () => {
                if (window.Menu) Menu.close();
                const src = window.Menu ? Menu.iconPath(icon) : icon;
                ContextMenu.properties({ label, tip, shortcut: !!page,
                    icon: src.startsWith('images/icons/') ? src.slice('images/icons/'.length) : src });
            } });
        }
        return items;
    },

    init() {
        // Capture phase, so this runs before the desktop's own right-click handler (context-menu.js).
        // Anywhere in the MENU panel, the browser's own right-click menu is replaced.
        document.addEventListener('contextmenu', (e) => {
            const panel = e.target.closest && e.target.closest('#start-menu-container');
            if (!panel || !window.ContextMenu) return;
            e.preventDefault();
            e.stopPropagation();
            const item = e.target.closest('.os-menu-item');
            if (!item) return;
            ContextMenu.show(e.clientX, e.clientY, this.menuFor(item));
        }, true);
    }
};
document.addEventListener('DOMContentLoaded', () => MenuShortcuts.init());
