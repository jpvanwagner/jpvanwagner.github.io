/**
 * MAIN.JS - Last script on the desktop page. Draws the desktop icons once everything is loaded.
 * (Most other modules start themselves on DOMContentLoaded; the browser window is opened by startup.js.)
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log((window.SiteConfig ? SiteConfig.osName : 'Desktop') + " initializing...");
    
    // Menu and Tools initialize themselves; only the desktop icons start here.
    try { Desktop.init(); } catch (e) { console.error("Desktop init failed:", e); }

    // Drawer tab preferences (hidden / on top) need both drawers built first
    try { if (window.DrawerTabs) DrawerTabs.init(); } catch (e) { console.error("DrawerTabs init failed:", e); }

    // The browser window is opened by startup.js once the boot animation finishes.
});
