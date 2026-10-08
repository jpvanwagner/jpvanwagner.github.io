/**
 * DESKTOP-UNDO.JS - Undo and redo for the desktop (global: DesktopUndo).
 *
 * Covers moving icons around, filing things into folders, throwing things in the Rubbish,
 * restoring them, emptying the Rubbish, and new/renamed folders and documents. Not typing inside
 * a text document (Notes keeps what you typed; undoing never throws your writing away).
 *
 *   Ctrl+Z             undo     (only when you're not typing in a text box)
 *   Ctrl+Y / Ctrl+Shift+Z   redo
 *   Right-click the desktop > Undo ... / Redo ...
 *
 * How it works: after every change to the desktop (DesktopFiles.refresh, Desktop.init, or the
 * end of an icon drag) it takes a small snapshot: the visitor's items (desktop-files.js), the
 * remembered icon order (desktop-arrange.js), and where hand-dragged icons sit. If that differs
 * from the last snapshot, the old one goes on the undo list. Undo puts a snapshot back.
 * Lists are for this visit only (up to 50 steps). Load after desktop-files.js and desktop-arrange.js.
 */
window.DesktopUndo = {
    undoList: [],
    redoList: [],
    last: null,          // the snapshot of how things are right now
    restoring: false,
    nextLabel: '',       // what the next recorded change was ("move", "move to Rubbish"...)
    max: 50,

    // ------------------------------------------------------------------ snapshots

    snapshot() {
        const df = window.DesktopFiles;
        const data = df ? JSON.parse(JSON.stringify(df.data)) : null;
        let order = null;
        try { order = localStorage.getItem((window.Desktop && Desktop.orderKey) || 'desktop-order'); } catch (e) {}
        const pos = {};
        document.querySelectorAll('#desktop .desktop-icon').forEach(el => {
            if (el.dataset.moved === 'true' && el._icon) pos[el._icon.label] = { left: el.style.left, top: el.style.top };
        });
        return { data, order, pos, label: this.nextLabel || 'change' };
    },

    /** What counts as "different" (text inside documents is left out on purpose). */
    keyOf(s) {
        if (!s) return '';
        const d = s.data ? Object.assign({}, s.data, { items: s.data.items.map(i => Object.assign({}, i, { content: undefined })) }) : null;
        return JSON.stringify([d, s.order, s.pos]);
    },

    /** Called after anything that may have changed the desktop. */
    record() {
        if (this.restoring) return;
        const now = this.snapshot();
        if (!this.last) { this.last = now; this.nextLabel = ''; return; }
        if (this.keyOf(now) !== this.keyOf(this.last)) {
            this.last.label = now.label;               // the step is named after the change that ended it
            this.undoList.push(this.last);
            if (this.undoList.length > this.max) this.undoList.shift();
            this.redoList = [];
        }
        this.last = now;
        this.nextLabel = '';
    },

    /** Put a snapshot back on screen. */
    apply(s) {
        const df = window.DesktopFiles;
        this.restoring = true;
        try {
            if (df && s.data) {
                // keep the newest text of any document that still exists
                const current = {};
                df.data.items.forEach(i => { current[i.id] = i.content; });
                s.data.items.forEach(i => { if (current[i.id] !== undefined) i.content = current[i.id]; });
                df.data = JSON.parse(JSON.stringify(s.data));
                df.save();
            }
            try {
                const k = (window.Desktop && Desktop.orderKey) || 'desktop-order';
                if (s.order === null) localStorage.removeItem(k); else localStorage.setItem(k, s.order);
            } catch (e) {}
            if (window.Desktop) Desktop.init();
            if (df) df.renderOpenWindows();
            document.querySelectorAll('#desktop .desktop-icon').forEach(el => {
                const p = el._icon && s.pos[el._icon.label];
                if (!p) return;
                el.style.left = p.left; el.style.top = p.top;
                el.style.right = 'auto'; el.style.bottom = 'auto';
                el.dataset.moved = 'true';
            });
        } finally { this.restoring = false; }
        this.last = this.snapshot();
        this.last.label = s.label;
    },

    undo() {
        const s = this.undoList.pop();
        if (!s) return false;
        const now = this.snapshot(); now.label = s.label;
        this.redoList.push(now);
        this.apply(s);
        return true;
    },

    redo() {
        const s = this.redoList.pop();
        if (!s) return false;
        const now = this.snapshot(); now.label = s.label;
        this.undoList.push(now);
        this.apply(s);
        return true;
    },

    /** Right-click menu rows for the desktop (context-menu.js). */
    menuItems() {
        const u = this.undoList[this.undoList.length - 1], r = this.redoList[this.redoList.length - 1];
        return [
            { label: 'Undo' + (u ? ' ' + u.label : '') + '  (Ctrl+Z)', disabled: !u, action: () => this.undo(),
              tip: 'Take back the last move, filing or trip to the Rubbish' },
            { label: 'Redo' + (r ? ' ' + r.label : '') + '  (Ctrl+Y)', disabled: !r, action: () => this.redo(),
              tip: 'Do again what you just undid' }
        ];
    },

    // ------------------------------------------------------------------ hooks

    /** Wrap a method so it names the step and records it when done. */
    wrap(obj, name, label) {
        const orig = obj && obj[name];
        if (typeof orig !== 'function') return;
        const self = this;
        obj[name] = function () {
            if (label && !self.restoring) self.nextLabel = label;
            const out = orig.apply(this, arguments);
            self.record();
            return out;
        };
    },

    init() {
        const df = window.DesktopFiles, dk = window.Desktop;
        if (df) {
            // the named steps (each ends in refresh(), which records too; recording twice is harmless)
            [['trash', 'move to Rubbish'], ['restore', 'restore'], ['moveInto', 'move into folder'],
             ['fileInto', 'shortcut into folder'], ['emptyRubbishNow', 'empty Rubbish'], ['create', 'new item'],
             ['rename', 'rename']].forEach(([n, l]) => {
                const orig = df[n];
                if (typeof orig !== 'function') return;
                const self = this;
                df[n] = function () { if (!self.restoring) self.nextLabel = l; return orig.apply(this, arguments); };
            });
            this.wrap(df, 'refresh');
        }
        if (dk) {
            this.wrap(dk, 'init');
            this.wrap(dk, 'sortBy', 'sort');
            // An icon drag: record once the mouse/finger is let go (after desktop-icons.js handles the drop)
            const origDrag = dk.dragStart, self = this;
            dk.dragStart = function (e) {
                const out = origDrag.apply(this, arguments);
                if (e && e.type === 'mousedown' && e.button !== 0) return out;
                const done = () => {
                    document.removeEventListener('mouseup', done); document.removeEventListener('touchend', done);
                    setTimeout(() => { if (!self.nextLabel) self.nextLabel = 'move'; self.record(); }, 0);
                };
                document.addEventListener('mouseup', done); document.addEventListener('touchend', done);
                return out;
            };
        }

        document.addEventListener('keydown', (e) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
            const k = e.key.toLowerCase();
            if (k !== 'z' && k !== 'y') return;
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;   // typing: leave it alone
            const did = (k === 'y' || (k === 'z' && e.shiftKey)) ? this.redo() : this.undo();
            if (did) e.preventDefault();
        });

        this.record();       // starting point
    }
};
document.addEventListener('DOMContentLoaded', () => setTimeout(() => DesktopUndo.init(), 50));
