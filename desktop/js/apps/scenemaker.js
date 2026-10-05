/**
 * SCENEMAKER.JS - Opens the live demo of Scenemaker (my branching-scenario authoring tool) in
 * its own desktop window (global: SceneMakerApp). The demo itself is a static build of the
 * real editor in /work/scenemaker/ (see its README.md); pages/project-scenemaker.html
 * explains it. Reached from the desktop icon, MENU > Programs, and the Projects page.
 */
window.SceneMakerApp = {
    icon: 'images/icons/os/scenemaker.png',
    url: 'work/scenemaker/app/editor/editor.html',

    open() {
        const html = `
            <div class="game-window">
                <iframe src="${this.url}" title="Scenemaker (live demo)" allow="fullscreen; autoplay; clipboard-write" allowfullscreen></iframe>
            </div>`;
        const w = Math.min(1280, window.innerWidth - 40), h = Math.min(800, window.innerHeight - 80);
        WM.open('scenemaker', 'Scenemaker (demo)', html, this.icon, { width: w, height: h, center: true, fullscreen: true });
        if (window.innerWidth < 900) WM.maximize('scenemaker');   // the editor needs room
    }
};
