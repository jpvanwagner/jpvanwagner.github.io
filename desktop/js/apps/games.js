/**
 * GAMES.JS - The "Games" folder and game windows (global: GamesApp).
 *
 * The games themselves are self-contained HTML files in /games/<id>/index.html (the same files
 * Traditional View embeds on pages/project-game-<id>.html). The list, and each game's preferred
 * window size, come from `games` in config/site-config.js.
 *
 *   GamesApp.openFolder()   the Games folder (desktop/js/apps/folders.js: one "file" per game)
 *   GamesApp.open(id)       the game as its own app window, with its own icon (images/icons/apps/<id>.png),
 *                           taskbrick and full-screen button; focus goes straight into the game
 * Styles: desktop/css/apps.css ("GAMES")
 */
window.GamesApp = {
    icon: 'images/icons/os/media.png',

    list() {
        return (window.SiteConfig && SiteConfig.games) || [];
    },

    openFolder() {
        if (window.FolderApp) FolderApp.open('games');
        if (window.FeatureHints) FeatureHints.show('games');   // one-time "how to play" hint
    },

    open(id) {
        const g = this.list().find(x => x.id === id);
        if (!g) return;
        const winId = 'game-' + id;
        const html = `
            <div class="game-window">
                <iframe src="games/${id}/index.html" title="${g.label}" allow="fullscreen; autoplay; gamepad; clipboard-write" allowfullscreen></iframe>
            </div>`;
        const small = window.innerWidth < 768;
        WM.open(winId, g.label, html, 'images/icons/apps/' + id + '.png', { width: g.width || 800, height: g.height || 600, center: true, fullscreen: true });
        if (small) WM.maximize(winId);   // phones: games get the whole screen (taskbricks stay visible)
        if (window.FeatureHints) FeatureHints.show('games');

        // Put keyboard focus inside the game so arrow keys work right away
        const frame = WM.windows[winId] && WM.windows[winId].querySelector('iframe');
        if (frame) {
            frame.addEventListener('load', () => { try { frame.contentWindow.focus(); } catch (e) {} });
            // Clicking back into a game re-focuses its window (iframes don't bubble clicks to us)
            frame.addEventListener('load', () => {
                try {
                    frame.contentWindow.addEventListener('pointerdown', () => {
                        WM.focus(winId);
                        if (window.Menu && Menu.close) Menu.close();
                    });
                } catch (e) {}
            });
        }
    }
};
