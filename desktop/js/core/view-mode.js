/**
 * VIEW-MODE.JS - Switching from the retro desktop to the classic (plain website) view,
 * plus a one-time welcome tip so first-time visitors know both options exist.
 * The classic pages switch back with their own "Retro Desktop" button (pages/js/classic.js).
 */
window.ViewMode = {
    welcomeKey: 'site-welcome-seen',

    // Which portfolio page is showing in the main browser window right now (if any)
    currentPage() {
        const iframe = document.querySelector('iframe[id^="browser-iframe-"]');
        if (!iframe) return 'home.html';
        try {
            // "/pages/resume.html", or "/pages/resume" (Neocities drops ".html")
            const m = (iframe.contentWindow.location.pathname || '').match(/\/pages\/([\w-]+)(\.html)?$/);
            if (m) return m[1] + '.html';
        } catch (e) {}
        return 'home.html';
    },

    toClassic() {
        SiteMode.set('classic');
        location.href = 'pages/' + this.currentPage();
    },

    /** First-visit help: now the step-by-step tips in first-tips.js (after the phone notice, if any). */
    showWelcome() {
        if (this.isPhone() && this.phoneNotice()) return;       // tips start when the notice is closed
        if (window.FirstTips) FirstTips.start();
    },

    /** A phone (not a tablet or laptop with a touch screen): a mobile browser, or a small touch-only screen. */
    isPhone() {
        const ua = navigator.userAgent || '';
        if (/iPhone|iPod|Android.+Mobile|Windows Phone|Mobile Safari/i.test(ua)) return true;
        try {
            return matchMedia('(pointer: coarse) and (hover: none)').matches && Math.min(screen.width, screen.height) < 600;
        } catch (e) { return false; }
    },

    /**
     * Phones only, once per visit: Retro Mode is built for desktops, so say so, with a one-tap way
     * over to Traditional View. Returns true if the notice was shown.
     */
    phoneNotice() {
        try { if (sessionStorage.getItem('phone-notice-shown') === 'true') return false; } catch (e) {}
        if (typeof WM === 'undefined') return false;
        try { sessionStorage.setItem('phone-notice-shown', 'true'); } catch (e) {}
        const html = `
            <div class="phone-notice">
                <p><b>Heads up:</b> Retro Mode is optimized for desktop computers. Some things may not look or work correctly on a phone.</p>
                <p>Traditional View has all the same pages, made for small screens.</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                    <button type="button" class="bevel-out" data-pn="classic" title="Switch to the phone-friendly version of this site"><b>Traditional View</b></button>
                    <button type="button" class="bevel-out" data-pn="stay" title="Keep exploring the retro desktop">Keep Retro Mode</button>
                </div>
            </div>`;
        WM.open('phone-notice', 'Retro Mode on a phone', html, 'images/icons/os/classic-view.svg',
            { width: Math.min(340, innerWidth - 20), height: 220, center: true });
        const win = WM.windows['phone-notice'];
        if (!win) return false;
        win.addEventListener('click', (e) => {
            const b = e.target.closest('[data-pn]');
            if (!b) return;
            if (b.getAttribute('data-pn') === 'classic') { this.toClassic(); return; }
            WM.close('phone-notice');
            if (window.FirstTips) setTimeout(() => FirstTips.start(), 300);
        });
        return true;
    }
};
