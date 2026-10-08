/**
 * OS-DIALOG.JS - Retro message boxes for the desktop "OS" instead of the browser's own popups
 * (global: OSDialog).
 *
 *   OSDialog.confirm({ title, message, ok, cancel, icon }).then(yes => { ... })
 *        title    window title (default "Confirm")
 *        message  the question (plain text; \n = new line)
 *        ok       label of the "yes" button (default "Yes")
 *        cancel   label of the "no" button (default "No")
 *        icon     'warn' (yellow triangle, default) or 'question' (blue circle)
 *
 * It opens as a small window in front of everything and blocks the desktop behind it, like a real
 * system dialog. Enter (or the focused button) answers; Esc, the X, or "No" answers no.
 * Styles: desktop/css/windows.css ("OS DIALOG")
 */
window.OSDialog = {
    ICONS: {
        warn: '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path d="M16 2 31 29H1z" fill="#ffd700" stroke="#000" stroke-width="1.5"/><path d="M14.5 10h3l-.6 11h-1.8z" fill="#000"/><rect x="14.6" y="23" width="2.8" height="2.8" fill="#000"/></svg>',
        question: '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#000080" stroke-width="2"/><text x="16" y="23" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="20" fill="#000080">?</text></svg>'
    },

    confirm(opts = {}) {
        return new Promise((resolve) => {
            const id = 'os-dialog';
            if (WM.windows[id]) WM.close(id);                // one question at a time
            const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
            const html = `
                <div class="osd" role="alertdialog" aria-modal="true" aria-labelledby="osd-msg">
                    <div class="osd-body">
                        <span class="osd-icon">${this.ICONS[opts.icon] || this.ICONS.warn}</span>
                        <p class="osd-msg" id="osd-msg">${esc(opts.message || 'Are you sure?').replace(/\n/g, '<br>')}</p>
                    </div>
                    <div class="osd-btns">
                        <button type="button" class="bevel-out osd-ok">${esc(opts.ok || 'Yes')}</button>
                        <button type="button" class="bevel-out osd-no">${esc(opts.cancel || 'No')}</button>
                    </div>
                </div>`;
            // a see-through cover so the rest of the desktop can't be clicked until it's answered
            const shield = document.createElement('div');
            shield.className = 'osd-shield';
            WM.open(id, opts.title || 'Confirm', html, 'data:image/svg+xml,' + encodeURIComponent(this.ICONS.warn), { width: 360, height: 168, center: true });
            const win = WM.windows[id];
            if (!win) { resolve(window.confirm(opts.message || 'Are you sure?')); return; }
            win.classList.add('osd-win');
            win.parentNode.insertBefore(shield, win);                 // same layer as the windows, just under this one
            shield.style.zIndex = String((parseInt(win.style.zIndex, 10) || 1000) - 1);
            shield.addEventListener('pointerdown', (e) => {          // clicking outside flashes the dialog, like Windows
                e.preventDefault(); e.stopPropagation();
                win.classList.remove('osd-flash'); void win.offsetWidth; win.classList.add('osd-flash');
            });
            let done = false;
            const finish = (yes) => {
                if (done) return;
                done = true;
                document.removeEventListener('keydown', onKey, true);
                watch.disconnect();
                shield.remove();
                if (WM.windows[id]) WM.close(id);
                resolve(yes);
            };
            const onKey = (e) => {
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
            };
            document.addEventListener('keydown', onKey, true);
            // the title-bar X (or anything else) closing the window counts as "no"
            const watch = new MutationObserver(() => { if (!win.isConnected) finish(false); });
            watch.observe(win.parentNode, { childList: true });
            win.querySelector('.osd-ok').onclick = () => finish(true);
            win.querySelector('.osd-no').onclick = () => finish(false);
            // no minimizing or maximizing a message box
            win.querySelectorAll('.wc-min, .wc-max').forEach(b => b.remove());
            setTimeout(() => { const b = win.querySelector('.osd-ok'); if (b) b.focus(); }, 30);
        });
    }
};
