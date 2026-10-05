/**
 * IDLE-HELP.JS - A friendly "Need a hand?" dialog for visitors who seem lost on the Retro Desktop
 * (global: IdleHelp). If nobody clicks, taps, types or scrolls for `idleTime`, it suggests
 * Traditional View and offers a button that switches right away.
 *
 * Plain mouse movement does NOT count as activity on purpose: a lost visitor often wiggles
 * the mouse around without clicking anything.
 * Shows at most once per browser session. Styles: desktop/css/idle-help.css
 *
 * Quick reference:
 *   reset()   restart the countdown (also called for activity inside NetCrawler pages, see browser.js)
 *   show() / hide()
 */
window.IdleHelp = {
    idleTime: 90000,             // 1.5 minutes without a click / tap / key / scroll (the screensaver starts at 2)
    sessionKey: 'idle-help-shown',
    timer: null,

    init() {
        this.reset = this.reset.bind(this);
        ['mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach(evt =>
            document.addEventListener(evt, this.reset, { passive: true, capture: true }));
        this.reset();
    },

    alreadyShown() {
        try { return sessionStorage.getItem(this.sessionKey) === 'true'; } catch (e) { return false; }
    },

    reset() {
        clearTimeout(this.timer);
        if (this.disabled || this.alreadyShown()) return;   // disabled = turned off in Settings
        this.timer = setTimeout(() => this.show(), this.idleTime);
    },

    show() {
        // Wait if the boot or shutdown screen is up, or the screensaver is running
        const busy = document.body.classList.contains('system-busy') || document.getElementById('shutdown-screen')
            || (window.Screensaver && window.Screensaver.isActive);
        if (busy) { this.reset(); return; }
        if (this.alreadyShown() || document.getElementById('idle-help')) return;
        if (window.FirstTips && FirstTips.isOff()) return;          // "Don't show tips again" covers this too
        try { sessionStorage.setItem(this.sessionKey, 'true'); } catch (e) {}

        const overlay = document.createElement('div');
        overlay.id = 'idle-help';
        overlay.innerHTML = `
            <div class="idle-help-dialog" role="dialog" aria-modal="true" aria-labelledby="idle-help-title">
                <div class="idle-help-title" id="idle-help-title">
                    <span>Need a hand?</span>
                    <button type="button" data-act="close" title="Close">X</button>
                </div>
                <div class="idle-help-body">
                    <img src="images/icons/default/info.png" alt="">
                    <div>
                        <p><strong>Not sure where to go? Is this retro layout a little too weird?</strong></p>
                        <p>No problem. You can switch to <b>Traditional View</b>, a regular website with the
                        same content, any time from <b>MENU &gt; Switch to Traditional View</b>.
                        Or just use the button below.</p>
                    </div>
                </div>
                <div class="idle-help-buttons">
                    <button type="button" class="bevel-out" data-act="classic">Switch to Traditional View</button>
                    <button type="button" class="bevel-out" data-act="close">I'll stay here</button>
                </div>
            </div>
        `;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            const act = btn ? btn.getAttribute('data-act') : null;
            if (act === 'close' || e.target === overlay) this.hide();
            if (act === 'classic') window.ViewMode.toClassic();
        });
        overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide(); });
        document.body.appendChild(overlay);
        overlay.querySelector('[data-act="classic"]').focus();
    },

    hide() {
        const el = document.getElementById('idle-help');
        if (el) el.remove();
    }
};

document.addEventListener('DOMContentLoaded', () => window.IdleHelp.init());
