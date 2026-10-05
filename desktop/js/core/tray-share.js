/**
 * TRAY-SHARE.JS - A "Share" button in the system tray, next to the volume speaker
 * (global: TrayShare). Opens the same Share pop-up as MENU > Share this site...,
 * the desktop's Share icon and NetCrawler's Share button (shared/share.js).
 * Styles: desktop/css/taskbricks.css ("VOLUME" block, shared with #tray-volume)
 */
window.TrayShare = {
    init() {
        const tray = document.getElementById('system-tray');
        if (!tray || document.getElementById('tray-share')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'tray-share';
        btn.title = 'Share this portfolio (LinkedIn, email, copy link...)';
        btn.setAttribute('aria-label', 'Share this site');
        btn.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="12" cy="3.5" r="2.2" fill="currentColor"/><circle cx="4" cy="8" r="2.2" fill="currentColor"/><circle cx="12" cy="12.5" r="2.2" fill="currentColor"/><path d="M11 4.5 5 7.5M5 8.5l6 3" stroke="currentColor" stroke-width="1.5"/></svg>';
        btn.addEventListener('click', (e) => { e.stopPropagation(); if (window.SiteShare) SiteShare.open(); });
        tray.insertBefore(btn, tray.firstChild);
        if (window.TaskBricks && TaskBricks.updateLayout) TaskBricks.updateLayout();   // the tray got wider
    }
};
// after volume.js has added its speaker, so Share sits to its left
document.addEventListener('DOMContentLoaded', () => setTimeout(() => TrayShare.init(), 10));
