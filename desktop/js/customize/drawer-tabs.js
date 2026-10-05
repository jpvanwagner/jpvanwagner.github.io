/**
 * DRAWER-TABS.JS - Visibility and stacking for the two right-edge drawers (global: DrawerTabs).
 *   TOOLS     #tools-drawer      (tools-drawer.js)   open = has class "open"
 *   DOODLETOP #doodletop-drawer  (doodletop-ui.js)   open = style.right is "0px"
 *
 * What it adds:
 *   - Whichever drawer is OPEN is raised above the other one, so the other drawer's tab can
 *     never poke through (overlap) the open drawer.
 *   - Per-drawer preferences, remembered in this browser (localStorage "drawer-prefs"):
 *       hidden  the drawer and its tab are removed from the screen
 *       onTop   true = stays above program windows (default); false = windows can cover it
 *       side    'right' (default) or 'left': which screen edge the drawer lives on. Drag a tab
 *               across to the other side of the screen, or right-click it > Move to the left/right side.
 *   - Right-click a tab (see context-menu.js) to change these; Start > Settings and a
 *     right-click on the desktop can bring hidden tabs back.
 * Styles: desktop/css/drawers.css ("DRAWER STATES")
 */
window.DrawerTabs = {
    storageKey: 'drawer-prefs',
    ids: { tools: 'tools-drawer', doodletop: 'doodletop-drawer' },
    labels: { tools: 'TOOLS', doodletop: 'DoodleTop' },
    prefs: { tools: { hidden: false, onTop: true, side: 'right' }, doodletop: { hidden: false, onTop: true, side: 'right' } },

    init() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
            if (saved) Object.keys(this.prefs).forEach(k => Object.assign(this.prefs[k], saved[k] || {}));
        } catch (e) {}
        this.apply();
        this.watchSideDrags();

        // Watch both drawers so the open one always sits on top of the other
        const watch = () => this.syncOpenState();
        Object.values(this.ids).forEach(id => {
            const el = document.getElementById(id);
            if (el) new MutationObserver(watch).observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
        });
        watch();
    },

    save() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.prefs)); } catch (e) {}
    },

    isOpen(key) {
        const el = document.getElementById(this.ids[key]);
        if (!el) return false;
        return key === 'tools' ? el.classList.contains('open') : el.style.right === '0px';
    },

    /** Mark the open drawer (raised via CSS) and keep the closed one underneath it. */
    syncOpenState() {
        // body.drawer-open-<key> hides the OTHER drawer and its tab completely (drawers.css),
        // so a tab can never sit on top of an open drawer, whatever the stacking order
        const openKey = Object.keys(this.ids).find(k => this.isOpen(k)) || '';
        Object.keys(this.ids).forEach(k => document.body.classList.toggle('drawer-open-' + k, k === openKey));
        Object.keys(this.ids).forEach(k => {
            const el = document.getElementById(this.ids[k]);
            if (!el) return;
            const open = this.isOpen(k);
            const wasOpen = el.classList.contains('drawer-is-open');
            el.classList.toggle('drawer-is-open', open);
            // Just opened on a short screen: slide it up so the whole drawer fits above the taskbricks
            if (open && !wasOpen) {
                // Only one drawer open at a time: opening one closes the other
                Object.keys(this.ids).forEach(other => { if (other !== k && this.isOpen(other)) this.close(other); });
                if (window.FeatureHints) FeatureHints.show(k);   // first time this drawer opens
                const room = window.innerHeight - 46 - el.offsetHeight;
                if (el.offsetTop > room) el.style.top = Math.max(0, room) + 'px';
            }
        });
    },

    close(key) {
        const el = document.getElementById(this.ids[key]);
        if (!el) return;
        if (key === 'tools') el.classList.remove('open');
        else el.style.right = '-175px';
    },

    toggle(key) {
        if (key === 'tools' && window.Tools) Tools.toggleDrawer();
        else if (key === 'doodletop') {
            const el = document.getElementById(this.ids.doodletop);
            if (el) el.style.right = this.isOpen('doodletop') ? '-175px' : '0px';
        }
    },

    apply() {
        Object.keys(this.ids).forEach(k => {
            const el = document.getElementById(this.ids[k]);
            if (!el) return;
            el.classList.toggle('drawer-hidden', !!this.prefs[k].hidden);
            el.classList.toggle('drawer-behind', !this.prefs[k].onTop);
            el.classList.toggle('drawer-left', this.prefs[k].side === 'left');
        });
    },

    /** Move a drawer to the 'left' or 'right' edge of the screen (closes it first). */
    setSide(key, side) {
        this.close(key);
        this.prefs[key].side = side === 'left' ? 'left' : 'right';
        this.save(); this.apply();
        this.syncOpenState();
    },

    /** Dragging a tab most of the way across the screen moves its drawer to that edge. The tabs'
     *  own handlers still do the up/down dragging and the click-to-open; this only watches where
     *  the drag ends, and shows a dashed outline on the far edge while it would switch. */
    watchSideDrags() {
        let drag = null;
        const ghost = document.createElement('div');
        ghost.className = 'drawer-side-ghost';
        document.body.appendChild(ghost);
        const keyOf = (t) => t.closest('#tools-tab') ? 'tools' : t.closest('#doodletop-tab') ? 'doodletop' : null;
        const target = (x) => {
            const side = this.prefs[drag.key].side;
            if (side === 'right' && x < window.innerWidth * 0.3) return 'left';
            if (side === 'left' && x > window.innerWidth * 0.7) return 'right';
            return null;
        };
        document.addEventListener('pointerdown', (e) => {
            const key = e.button === 0 && keyOf(e.target);
            drag = key ? { key, x: e.clientX } : null;
        }, true);
        document.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const to = target(e.clientX);
            ghost.className = 'drawer-side-ghost' + (to ? ' show ' + to : '');
        }, true);
        document.addEventListener('pointerup', (e) => {
            if (!drag) return;
            const to = target(e.clientX), key = drag.key;
            drag = null;
            ghost.className = 'drawer-side-ghost';
            if (to) setTimeout(() => this.setSide(key, to), 0);   // after the tab's own mouseup (which may toggle it)
        }, true);
    },

    setHidden(key, hidden) {
        if (hidden) this.close(key);
        this.prefs[key].hidden = hidden;
        this.save(); this.apply();
    },

    setOnTop(key, onTop) {
        this.prefs[key].onTop = onTop;
        this.save(); this.apply();
    },

    showAll() {
        Object.keys(this.prefs).forEach(k => { this.prefs[k].hidden = false; });
        this.save(); this.apply();
    },

    anyHidden() {
        return Object.keys(this.prefs).some(k => this.prefs[k].hidden);
    },

    /** Right-click menu items for a drawer tab (used by context-menu.js). */
    menuFor(key) {
        const p = this.prefs[key];
        return [
            { label: this.isOpen(key) ? 'Close drawer' : 'Open drawer', action: () => this.toggle(key) },
            { separator: true },
            { label: 'Keep on top of windows', checked: p.onTop, action: () => this.setOnTop(key, !p.onTop),
              tip: 'When off, open windows can cover this drawer' },
            { label: p.side === 'left' ? 'Move to the right side' : 'Move to the left side',
              action: () => this.setSide(key, p.side === 'left' ? 'right' : 'left'),
              tip: 'You can also drag the tab across the screen' },
            { label: `Hide the ${this.labels[key]} tab`, action: () => this.setHidden(key, true),
              tip: 'Bring it back with a right-click on the desktop, or MENU > Settings' }
        ];
    }
};
