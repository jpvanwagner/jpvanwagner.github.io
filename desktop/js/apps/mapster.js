/**
 * MAPSTER.JS - Opens Mapster (my 3D level editor) in its own desktop window (global: MapsterApp).
 * The editor is the copy in /work/mapster/ (see its README.md); ?sample=sunrise opens it with the
 * movie-theater sample map loaded. pages/project-mapster.html explains it.
 * Reached from the Start menu (Programs), the Projects folder and the "Open as a desktop program"
 * button on its page.
 */
window.MapsterApp = {
    icon: 'images/icons/apps/mapster.png',
    url: 'work/mapster/mapster.html?sample=sunrise',

    open() {
        const html = `
            <div class="game-window">
                <iframe data-demo-nomute src="${this.url}" title="Mapster" allow="fullscreen" allowfullscreen></iframe>
            </div>`;
        const w = Math.min(1280, window.innerWidth - 40), h = Math.min(800, window.innerHeight - 80);
        WM.open('mapster', 'Mapster', html, this.icon, { width: w, height: h, center: true, fullscreen: true });
        if (window.innerWidth < 1100) WM.maximize('mapster');   // the editor's three panels need room
    }
};
