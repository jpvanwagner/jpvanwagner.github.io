/**
 * DESKTOP-FILES.JS - Visitors' own folders and text documents on the desktop, plus the
 * Rubbish bin (global: DesktopFiles). Everything is saved only in the visitor's own browser
 * (localStorage "desktop-files"); nothing is uploaded, and other visitors never see it.
 *
 * What visitors can do:
 *   - Right-click the desktop > New folder / New text document (or inside a folder window)
 *   - Double-click a text document to edit it in Notes (it saves as you type)
 *   - Rename, open, or delete from the right-click menu; drag an item onto a folder (icon or open
 *     window) to file it. Built-in icons dropped on a folder leave a shortcut copy there.
 *     Items in folder windows drag back out to the desktop, into other folders, or to Rubbish.
 *   - Drag an item onto Rubbish (or right-click > Move to Rubbish). Only visitor-made items and a
 *     few extras (readme.txt, NetCrawler, Traditional View, Share) can be binned; the portfolio's own
 *     shortcuts (Home, About Me, Resume...) and Games are protected.
 *   - Open Rubbish to restore items or empty it
 *
 * Data shape: { items: [{ id, type: 'folder'|'text'|'shortcut', name, content, parent }],   parent = folder id or null
 *               (shortcuts, made by right-clicking a MENU item, also carry { action, icon }; see menu-shortcuts.js)
 *               rubbish: [ids of binned items],  hiddenSystem: [labels of binned built-in icons] }
 *
 * Hooks used by desktop-icons.js: userIcons(), isHidden(label), canBin(icon), dropOn(dragged, target)
 * Styles: desktop/css/desktop-files.css
 */
window.DesktopFiles = {
    storageKey: 'desktop-files',
    // Built-in icons a visitor may bin (they come back with Restore, or Settings > Reset)
    binnableSystem: ['readme.txt', 'NetCrawler', 'Traditional View', 'Share', 'Scenemaker'],
    data: { items: [], rubbish: [], hiddenSystem: [] },

    load() {
        try {
            const d = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
            if (d && Array.isArray(d.items)) this.data = Object.assign({ items: [], rubbish: [], hiddenSystem: [] }, d);
        } catch (e) {}
    },

    save() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.data)); } catch (e) {}
    },

    refresh() {
        this.save();
        if (window.Desktop) Desktop.init();
        this.renderOpenWindows();
    },

    item(id) { return this.data.items.find(i => i.id === id); },
    inRubbish(id) { return this.data.rubbish.includes(id); },

    /** Visible name that doesn't clash with a sibling ("New folder (2)"). */
    uniqueName(base, parent) {
        const taken = this.data.items.filter(i => i.parent === parent && !this.inRubbish(i.id)).map(i => i.name);
        if (!taken.includes(base)) return base;
        let n = 2;
        while (taken.includes(`${base} (${n})`)) n++;
        return `${base} (${n})`;
    },

    create(type, parent = null) {
        const name = this.uniqueName(type === 'folder' ? 'New folder' : 'New text document.txt', parent);
        const it = { id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type, name, content: '', parent };
        this.data.items.push(it);
        this.refresh();
        // Start renaming right away, like a real desktop
        setTimeout(() => this.rename(it.id), 60);
        return it;
    },

    rename(id) {
        const it = this.item(id);
        if (!it) return;
        const label = document.querySelector(`[data-file-id="${id}"] span`);
        if (!label) {                                    // not visible (e.g. inside a closed folder): simple prompt
            const n = prompt('New name:', it.name);
            if (n && n.trim()) { it.name = n.trim(); this.refresh(); }
            return;
        }
        // Inline rename: the label becomes a text box; Enter or clicking away saves, Esc cancels
        const input = document.createElement('input');
        input.className = 'rename-box';
        input.value = it.name;
        label.replaceWith(input);
        input.focus();
        input.select();
        let done = false;
        const finish = (keep) => {
            if (done) return;
            done = true;
            if (keep && input.value.trim()) it.name = input.value.trim().slice(0, 60);
            this.refresh();
        };
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') finish(true);
            if (e.key === 'Escape') finish(false);
        });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('mousedown', (e) => e.stopPropagation());
    },

    open(id) {
        const it = this.item(id);
        if (!it) return;
        if (it.type === 'folder') this.openFolder(id);
        else if (it.type === 'shortcut') { try { new Function(it.action)(); } catch (e) {} }
        else this.openText(id);
    },

    /** Text documents open in Notes and save as you type. */
    openText(id) {
        const it = this.item(id);
        if (!it || !window.NotesApp) return;
        NotesApp.open(null, it.name);
        const instId = `notes-inst-${NotesApp.instanceCount}`;
        const ta = document.getElementById(`textarea-${instId}`);
        if (!ta) return;
        ta.value = it.content || '';
        ta.focus();
        let t = null;
        ta.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => { it.content = ta.value; this.save(); }, 300);
        });
        const status = document.getElementById(`status-lncol-${instId}`);
        if (status) status.title = 'Saved automatically in this browser';
    },

    // ---------------------------------------------------------------- folders & rubbish windows

    listHtml(ids, where) {
        if (!ids.length) return `<p class="df-empty">${where === 'rubbish' ? 'Rubbish is empty.' : 'This folder is empty.'}</p>`;
        return '<div class="df-grid">' + ids.map(id => {
            const it = this.item(id);
            const sys = !it;                                         // a binned built-in icon (by label)
            const name = sys ? id : it.name;
            const icon = sys ? this.systemIconSrc(id) : this.iconSrc(it);
            return `<button type="button" class="df-item" draggable="${where === 'rubbish' ? 'false' : 'true'}" data-id="${id}" data-where="${where}" title="${this.esc(name)}${where === 'rubbish' ? '' : ' (drag it to a folder, the desktop, or the Rubbish)'}">
                        <img src="${icon}" alt=""><span>${this.esc(name)}</span></button>`;
        }).join('') + '</div>';
    },

    esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },

    iconSrc(it) {
        if (it.type === 'shortcut') return it.icon || 'images/icons/os/newfile.png';
        return it.type === 'folder' ? 'images/icons/os/folder.png' : 'images/icons/os/newfile.png';
    },

    systemIconSrc(label) {
        const ic = (window.Desktop && Desktop.allIcons || []).find(i => i.label === label);
        return ic ? 'images/icons/' + ic.icon : 'images/icons/os/newfile.png';
    },

    openFolder(id) {
        const it = this.item(id);
        if (!it) return;
        WM.open('folder-' + id, it.name, `<div class="df-window" data-folder="${id}"></div>`, 'images/icons/os/folder.png',
            { width: 460, height: 320, center: true });
        this.renderOpenWindows();
    },

    openRubbish() {
        WM.open('trash', 'Rubbish', `<div class="df-window" data-folder="__rubbish"></div>`, 'images/icons/os/rubbish.png',
            { width: 460, height: 320, center: true });
        this.renderOpenWindows();
    },

    /** Re-draw every open folder / Rubbish window (after any change). */
    renderOpenWindows() {
        document.querySelectorAll('.df-window').forEach(box => {
            const f = box.getAttribute('data-folder');
            if (f === '__rubbish') {
                const ids = this.data.rubbish.filter(id => this.item(id)).concat(this.data.hiddenSystem);
                box.innerHTML = `<div class="df-bar">
                        <button type="button" class="bevel-out" data-act="empty" title="Delete everything in the Rubbish for good" ${ids.length ? '' : 'disabled'}>Empty Rubbish</button>
                        <span>${ids.length} item(s). Right-click an item to restore it.</span></div>` + this.listHtml(ids, 'rubbish');
            } else {
                if (!this.item(f)) { const w = box.closest('.window'); if (w) WM.close(w.id.replace(/^window-/, '')); return; }
                const ids = this.data.items.filter(i => i.parent === f && !this.inRubbish(i.id)).map(i => i.id);
                box.innerHTML = `<div class="df-bar">
                        <button type="button" class="bevel-out" data-act="new-folder">New folder</button>
                        <button type="button" class="bevel-out" data-act="new-text">New text document</button>
                        <span>${ids.length} item(s)</span></div>` + this.listHtml(ids, f);
            }
        });
    },

    // ---------------------------------------------------------------- bin, restore, move

    canBin(icon) {
        return !!(icon && (icon.fileId || this.binnableSystem.includes(icon.label)));
    },

    trash(iconOrId) {
        const id = typeof iconOrId === 'string' ? iconOrId : (iconOrId.fileId || null);
        if (id && this.item(id)) {
            if (!this.data.rubbish.includes(id)) this.data.rubbish.push(id);
        } else if (iconOrId && this.binnableSystem.includes(iconOrId.label)) {
            if (!this.data.hiddenSystem.includes(iconOrId.label)) this.data.hiddenSystem.push(iconOrId.label);
        } else return;
        this.refresh();
    },

    restore(id) {
        this.data.rubbish = this.data.rubbish.filter(x => x !== id);
        this.data.hiddenSystem = this.data.hiddenSystem.filter(x => x !== id);
        const it = this.item(id);
        if (it && it.parent && !this.item(it.parent)) it.parent = null;   // its folder is gone: back to the desktop
        this.refresh();
    },

    /** Delete for good (and everything inside, for folders). */
    destroy(id) {
        const kids = this.data.items.filter(i => i.parent === id).map(i => i.id);
        kids.forEach(k => this.destroy(k));
        this.data.items = this.data.items.filter(i => i.id !== id);
        this.data.rubbish = this.data.rubbish.filter(x => x !== id);
    },

    emptyRubbish() {
        OSDialog.confirm({ title: 'Empty Rubbish', message: 'Permanently delete everything in the Rubbish?', ok: 'Empty it', cancel: 'Cancel' })
            .then(yes => { if (yes) this.emptyRubbishNow(); });
    },
    emptyRubbishNow() {
        this.data.rubbish.slice().forEach(id => this.destroy(id));
        // Built-in icons can't be destroyed, so they stay binned until restored
        this.refresh();
    },

    moveInto(id, folderId) {
        const it = this.item(id);
        if (!it || it.id === folderId) return;
        // Don't allow a folder inside itself (or inside its own sub-folder)
        for (let p = this.item(folderId); p; p = this.item(p.parent)) if (p.id === id) return;
        it.parent = folderId;
        this.refresh();
    },

    /** Called by desktop-icons.js when an icon is dropped on another icon. */
    dropOn(dragged, target) {
        if (!dragged || !target) return false;
        if (target.isRubbish) {
            if (this.canBin(dragged)) { this.trash(dragged); return true; }
            return false;
        }
        if (target.fileId && this.item(target.fileId) && this.item(target.fileId).type === 'folder') {
            this.fileInto(dragged, target.fileId);
            return true;
        }
        return false;
    },

    /**
     * Put a desktop icon into one of the visitor's folders. Their own items move there; the
     * site's built-in icons (Home, Games...) stay on the desktop and a shortcut copy goes in.
     */
    fileInto(icon, folderId) {
        if (icon.fileId) { this.moveInto(icon.fileId, folderId); return; }
        if (icon.isRubbish || !icon.action) return;
        const src = icon.icon.startsWith('http') || icon.icon.startsWith('images/') ? icon.icon : 'images/icons/' + icon.icon;
        this.data.items.push({ id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: 'shortcut',
            name: this.uniqueName(icon.label, folderId), content: '', parent: folderId, action: icon.action, icon: src });
        this.refresh();
    },

    /** An icon dropped onto an open folder / Rubbish window. */
    dropOnWindow(icon, folder) {
        if (folder === '__rubbish') {
            if (this.canBin(icon)) this.trash(icon); else if (window.Desktop) Desktop.cannotBin(icon);
        } else if (this.item(folder)) {
            this.fileInto(icon, folder);
        }
    },

    /**
     * Items inside folder windows can be dragged (normal browser drag and drop) onto a folder
     * icon or window, the Rubbish, or the empty desktop (moves it back out onto the desktop).
     */
    hookItemDrag() {
        const targetAt = (e) => {
            const icon = e.target.closest && e.target.closest('.desktop-icon');
            if (icon && icon._icon) {
                const t = icon._icon;
                if (t.isRubbish) return { el: icon, kind: 'rubbish' };
                if (t.fileId && this.item(t.fileId) && this.item(t.fileId).type === 'folder') return { el: icon, kind: 'folder', id: t.fileId };
                return null;
            }
            const win = e.target.closest && e.target.closest('.df-window');
            if (win) {
                const f = win.getAttribute('data-folder');
                return f === '__rubbish' ? { el: win, kind: 'rubbish' } : { el: win, kind: 'folder', id: f };
            }
            if (e.target.id === 'desktop' || e.target.id === 'desktop-environment' || e.target.id === 'window-container') return { el: null, kind: 'desktop' };
            return null;
        };
        const clear = () => document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target', 'drop-refuse'));
        document.addEventListener('dragstart', (e) => {
            const b = e.target.closest && e.target.closest('.df-item');
            if (!b || b.getAttribute('data-where') === 'rubbish') return;
            e.dataTransfer.setData('text/x-desktop-file', b.getAttribute('data-id'));
            e.dataTransfer.effectAllowed = 'move';
            this.dragging = b.getAttribute('data-id');
        });
        document.addEventListener('dragend', () => { this.dragging = null; clear(); });
        document.addEventListener('dragover', (e) => {
            if (!this.dragging) return;
            const t = targetAt(e);
            clear();
            if (!t || (t.kind === 'folder' && t.id === this.dragging)) return;
            e.preventDefault();
            if (t.el) t.el.classList.add('drop-target');
        });
        document.addEventListener('drop', (e) => {
            const id = this.dragging;
            if (!id) return;
            e.preventDefault();
            clear();
            this.dragging = null;
            const t = targetAt(e);
            if (!t) return;
            if (t.kind === 'rubbish') this.trash(id);
            else if (t.kind === 'folder') this.moveInto(id, t.id);
            else { const it = this.item(id); if (it) { it.parent = null; this.refresh(); } }
        });
    },

    // ---------------------------------------------------------------- desktop-icons.js hooks

    /** Desktop icons for the visitor's own items that live on the desktop (not in folders or the bin). */
    userIcons() {
        return this.data.items.filter(i => i.parent === null && !this.inRubbish(i.id)).map(i => ({
            label: i.name, fileId: i.id,
            // desktop-icons.js adds "images/icons/" in front of the icon unless it is a full address
            icon: i.type === 'shortcut' ? this.iconSrc(i).replace(/^images\/icons\//, '')
                : (i.type === 'folder' ? 'os/folder.png' : 'os/newfile.png'),
            shortcut: i.type === 'shortcut',              // the little arrow badge
            action: `DesktopFiles.open('${i.id}')`,
            tip: i.type === 'shortcut' ? 'Your shortcut to "' + i.name + '" (saved in this browser)'
                : (i.type === 'folder' ? 'Your folder (saved in this browser)' : 'Your text document (saved in this browser)')
        }));
    },

    isHidden(label) { return this.data.hiddenSystem.includes(label); },

    rubbishFull() { return this.data.rubbish.length + this.data.hiddenSystem.length > 0; },

    // ---------------------------------------------------------------- right-click menus

    /** Menu for an item inside a folder or Rubbish window. */
    itemMenu(id, where) {
        if (where === 'rubbish') {
            return [
                { label: 'Restore', action: () => this.restore(id) },
                { label: 'Delete permanently', disabled: !this.item(id), action: () => OSDialog.confirm({ title: 'Delete', message: 'Delete this for good? It can\'t be restored.', ok: 'Delete', cancel: 'Cancel' }).then(yes => { if (yes) { this.destroy(id); this.refresh(); } }) }
            ];
        }
        return [
            { label: '<b>Open</b>', action: () => this.open(id) },
            { label: 'Rename', action: () => this.rename(id) },
            { label: 'Move to desktop', action: () => { const it = this.item(id); if (it) { it.parent = null; this.refresh(); } } },
            { separator: true },
            { label: 'Move to Rubbish', action: () => this.trash(id) }
        ];
    },

    init() {
        this.load();
        this.hookItemDrag();
        // Clicks inside folder / Rubbish windows (buttons and double-clicking items)
        document.addEventListener('click', (e) => {
            const b = e.target.closest('.df-window [data-act]');
            if (!b) return;
            const f = b.closest('.df-window').getAttribute('data-folder');
            const act = b.getAttribute('data-act');
            if (act === 'empty') this.emptyRubbish();
            if (act === 'new-folder') this.create('folder', f);
            if (act === 'new-text') this.create('text', f);
        });
        document.addEventListener('dblclick', (e) => {
            const b = e.target.closest('.df-item');
            if (!b) return;
            if (b.getAttribute('data-where') === 'rubbish') this.restore(b.getAttribute('data-id'));
            else this.open(b.getAttribute('data-id'));
        });
        document.addEventListener('keydown', (e) => {
            const b = e.target.closest && e.target.closest('.df-item');
            if (b && e.key === 'Enter' && b.getAttribute('data-where') !== 'rubbish') this.open(b.getAttribute('data-id'));
        });
    }
};
DesktopFiles.load();
document.addEventListener('DOMContentLoaded', () => DesktopFiles.init());
