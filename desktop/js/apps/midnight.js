/**
 * MIDNIGHT.JS - Opens the playable web demo of Midnight at the Multiplex (my game in development)
 * in its own desktop window (global: MidnightApp). The demo is a static build in
 * /work/midnight-multiplex/; pages/project-midnight-multiplex.html describes the game.
 * Reached from the Games folder, MENU > Games, and the Projects page.
 */
window.MidnightApp = {
    icon: 'images/icons/apps/midnight.png',
    url: 'work/midnight-multiplex/index.html',

    open() {
        const html = `
            <div class="game-window">
                <iframe src="${this.url}" title="Midnight at the Multiplex (web demo)" allow="fullscreen; autoplay" allowfullscreen></iframe>
            </div>`;
        // the game is drawn at 16:10; leave room for the title bar
        let w = Math.min(1040, window.innerWidth - 40);
        let h = Math.min(Math.round(w * 10 / 16) + 30, window.innerHeight - 80);
        WM.open('midnight', 'Midnight at the Multiplex (demo)', html, this.icon, { width: w, height: h, center: true, fullscreen: true });
        if (window.innerWidth < 900) WM.maximize('midnight');
    }
};
