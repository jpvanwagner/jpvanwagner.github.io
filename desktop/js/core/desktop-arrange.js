/**
 * DESKTOP-ARRANGE.JS - Sorting, auto-arrange and snap-to-grid for the desktop icons.
 * Add-on to desktop-icons.js (Object.assign onto window.Desktop; must load right after it).
 *
 *   Desktop.sortBy('name' | 'type')   put the icons in that order (Rubbish always stays bottom-right)
 *   Auto arrange (setting)            icons always sit in neat columns; dragging one to a new spot
 *                                     moves it to that place in the order
 *   Snap to grid (setting)            a dragged icon lands on the nearest grid cell instead of
 *                                     exactly where it was dropped
 * The toggles live in OSSettings (keys "autoArrange" and "snapToGrid") and in the desktop's
 * right-click menu. The chosen order is remembered in this browser (localStorage "desktop-order").
 */
Object.assign(window.Desktop, {
    orderKey: 'desktop-order',

    pref(key, fallback) {
        const v = window.OSSettings && OSSettings.values ? OSSettings.get(key) : undefined;
        return v === undefined ? fallback : v;
    },
    autoArrange() { return !!this.pref('autoArrange', false); },
    snapToGrid() { return !!this.pref('snapToGrid', true); },

    savedOrder() {
        try { return JSON.parse(localStorage.getItem(this.orderKey) || 'null'); } catch (e) { return null; }
    },
    saveOrder(labels) {
        try { localStorage.setItem(this.orderKey, JSON.stringify(labels)); } catch (e) {}
    },

    /** Called by buildIcons(): apply the remembered order (new icons go just before readme.txt, Rubbish last). */
    applyOrder(icons) {
        const order = this.savedOrder();
        if (!order) return icons;
        const bin = icons.filter(i => i.isRubbish);
        const rest = icons.filter(i => !i.isRubbish);
        // Icons added to the site since the order was saved slot in just before readme.txt,
        // so readme.txt stays the last icon (Rubbish aside)
        const r = order.indexOf('readme.txt');
        const newSpot = r >= 0 ? r - 0.5 : 1e6;
        const pos = (i) => { const k = order.indexOf(i.label); return k < 0 ? (i.label === 'readme.txt' ? 1e6 + 1 : newSpot) : k; };
        rest.sort((a, b) => pos(a) - pos(b));
        return rest.concat(bin);
    },

    sortBy(mode) {
        if (mode === 'type') {
            try { localStorage.removeItem(this.orderKey); } catch (e) {}   // the built-in order: pages, programs, your files
        } else {
            const labels = this.icons.filter(i => !i.isRubbish).map(i => i.label)
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            this.saveOrder(labels);
        }
        this.init();                                          // rebuild: everything back in neat columns
    },

    /** The grid cell (column, row) nearest a screen point. */
    cellAt(x, y) {
        const step = this.step || 96;
        return { col: Math.max(0, Math.round((x - 10) / step)), row: Math.max(0, Math.round((y - 8) / step)) };
    },

    /**
     * An icon was dropped on empty desktop at (x, y) = its new top-left corner.
     * Auto arrange: move it to that slot in the order. Snap to grid: park it on the nearest cell.
     */
    onDrop(el, x, y) {
        const icon = el._icon;
        if (!icon || icon.isRubbish) return;
        const cell = this.cellAt(x, y);
        if (this.autoArrange()) {
            const labels = this.icons.filter(i => !i.isRubbish).map(i => i.label).filter(l => l !== icon.label);
            const index = Math.min(labels.length, cell.col * (this.perColumn || 1) + cell.row);
            labels.splice(index, 0, icon.label);
            this.saveOrder(labels);
            this.init();
        } else if (this.snapToGrid()) {
            const step = this.step || 96;
            el.style.left = (10 + cell.col * step) + 'px';
            el.style.top = (8 + cell.row * step) + 'px';
        }
    },

    /** Right-click menu entries for the desktop (context-menu.js adds these). */
    arrangeMenu() {
        return [
            { label: 'Sort icons by name', action: () => this.sortBy('name') },
            { label: 'Sort icons by type', action: () => this.sortBy('type'), tip: 'Pages first, then programs, then your own files' },
            { label: 'Auto arrange', checked: this.autoArrange(), tip: 'Keep icons in neat columns; dragging one moves it in the order',
              action: () => { if (window.OSSettings) OSSettings.set('autoArrange', !this.autoArrange()); this.init(); } },
            { label: 'Snap to grid', checked: this.snapToGrid(), tip: 'Dropped icons line up with the grid',
              action: () => { if (window.OSSettings) OSSettings.set('snapToGrid', !this.snapToGrid()); } }
        ];
    }
});
