/**
 * RETRO-CURSOR.JS - Old-school pixel mouse pointers on the retro desktop (global: RetroCursor).
 * On by default; switch it off with TOOLS > Quick Toggles (the arrow button) or
 * Settings > Appearance. The choice is saved with the other settings (OSSettings "retroCursor").
 *
 * The pointers also show inside portfolio pages opened in NetCrawler: pages/js/classic.js
 * reads the same setting when a page loads, and set() below updates pages already open.
 * Traditional View never uses them. Styles: desktop/css/retro-cursor.css (desktop) and the
 * "RETRO CURSOR" block in pages/css/classic.css (pages inside NetCrawler).
 */
window.RetroCursor = {
    on() { return !window.OSSettings || OSSettings.get('retroCursor') !== false; },

    /** Turn the pointers on/off here and in every open page frame we're allowed to reach. */
    apply(on = this.on()) {
        const walk = (win, depth) => {
            if (depth > 3) return;
            try {
                const html = win.document.documentElement;
                // the desktop itself, and portfolio pages shown inside it (not courses or games)
                if (win === window || html.classList.contains('in-desktop')) html.classList.toggle('retro-cursor', on);
            } catch (e) { return; }                         // another site's frame: off-limits
            for (let i = 0; i < win.frames.length; i++) walk(win.frames[i], depth + 1);
        };
        walk(window, 0);
        const btn = document.getElementById('btn-cursor');
        if (btn) btn.classList.toggle('depressed', on);
    },

    toggle() {
        const on = !this.on();
        if (window.OSSettings) OSSettings.set('retroCursor', on); else this.apply(on);
    },

    init() {
        this.apply();
        // Pages opened later in NetCrawler set themselves up (classic.js); this catches the rest
        document.addEventListener('load', (e) => { if (e.target.tagName === 'IFRAME') this.apply(); }, true);
    }
};
document.addEventListener('DOMContentLoaded', () => setTimeout(() => RetroCursor.init(), 0));
