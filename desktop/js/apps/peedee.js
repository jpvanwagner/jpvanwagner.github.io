/**
 * PEEDEE.JS - Opens PeeDee's Dental Defense (my pixel-art platformer) in its own desktop window
 * (global: PeeDeeApp). The game lives in /work/peedee/ (index.html plus css/ and js/);
 * pages/project-peedee.html explains it. Reached from the Projects folder and its page.
 */
window.PeeDeeApp = {
    icon: 'images/icons/apps/peedee.png',
    url: 'work/peedee/index.html',

    open() {
        const html = `
            <div class="game-window">
                <iframe src="${this.url}" title="PeeDee's Dental Defense" allow="fullscreen; autoplay; gamepad" allowfullscreen></iframe>
            </div>`;
        const w = Math.min(980, window.innerWidth - 40), h = Math.min(600, window.innerHeight - 80);
        WM.open('peedee', "PeeDee's Dental Defense", html, this.icon, { width: w, height: h, center: true, fullscreen: true });
    }
};
