/**
 * ATLASWORKS.JS - Opens Atlasworks (my retro town-map editor) in its own desktop window
 * (global: AtlasworksApp). The tool itself is one self-contained file in
 * /work/atlasworks/index.html (synced from the TOOL--Atlasworks repo); pages/project-atlasworks.html explains it.
 * Reached from the Projects folder and the "Open as a desktop program" button on its page.
 */
window.AtlasworksApp = {
    icon: 'images/icons/apps/atlasworks.png',
    url: 'work/atlasworks/index.html',

    open() {
        const html = `
            <div class="game-window">
                <iframe data-demo-nomute src="${this.url}" title="Atlasworks" allow="fullscreen" allowfullscreen></iframe>
            </div>`;
        const w = Math.min(1240, window.innerWidth - 40), h = Math.min(800, window.innerHeight - 80);
        WM.open('atlasworks', 'Atlasworks', html, this.icon, { width: w, height: h, center: true, fullscreen: true });
        if (window.innerWidth < 1000) WM.maximize('atlasworks');   // two sidebars plus the map need room
    }
};
