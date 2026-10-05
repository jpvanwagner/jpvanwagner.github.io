/**
 * MENUBAR.JS - Makes the app menu bars (NetCrawler's File/View/Options, Notes' File/Edit...)
 * behave like real Windows menus (global: MenuBars):
 *   - click a menu name to open it; click it again or click elsewhere to close it
 *   - while one menu is open, pointing at another menu name switches to that one,
 *     so only ONE dropdown is ever showing (before, a second one could open on top of the first)
 *   - Escape closes the open menu
 * The dropdowns themselves open through CSS :focus-within (desktop/css/apps.css);
 * this file only moves keyboard focus between the menu names.
 */
window.MenuBars = {
    itemSelector: '.browser-menu-item, .notes-menu-item',
    barSelector: '.browser-menubar, .notes-menubar',

    init() {
        // Pointing at another menu name while a menu is open: switch to it
        document.addEventListener('mouseover', (e) => {
            const item = e.target.closest && e.target.closest(this.itemSelector);
            if (!item) return;
            const bar = item.closest(this.barSelector);
            const open = bar && [...bar.querySelectorAll(this.itemSelector)].find(i => i.matches(':focus-within'));
            if (!open || open === item) return;
            if (item.hasAttribute('tabindex')) item.focus({ preventScroll: true });
            else document.activeElement.blur();          // e.g. "External": a plain button, no dropdown
        });

        // Clicking the name of the menu that's already open closes it
        document.addEventListener('mousedown', (e) => {
            const item = e.target.closest && e.target.closest(this.itemSelector);
            if (!item || e.target.closest('.browser-dropdown, .notes-dropdown')) return;
            if (item.contains(document.activeElement) && item === document.activeElement) {
                e.preventDefault();
                item.blur();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const a = document.activeElement;
            if (a && a.closest && a.closest(this.itemSelector)) a.closest(this.itemSelector).blur();
        });
    }
};
document.addEventListener('DOMContentLoaded', () => MenuBars.init());
