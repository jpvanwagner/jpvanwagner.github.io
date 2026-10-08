/**
 * COURSE-CATALOG.JS - Opens the LMS Course Catalog (my course-code and catalog tool) in its own
 * desktop window (global: CourseCatalogApp). The tool itself is one self-contained file in
 * /work/course-catalog/index.html; pages/project-course-catalog.html explains it.
 * Reached from the Projects folder and the "Open as a desktop program" button on its page.
 */
window.CourseCatalogApp = {
    icon: 'images/icons/apps/course-catalog.png',
    url: 'work/course-catalog/index.html',

    open() {
        const html = `
            <div class="game-window">
                <iframe data-demo-nomute src="${this.url}" title="LMS Course Catalog" allow="clipboard-write; fullscreen" allowfullscreen></iframe>
            </div>`;
        const w = Math.min(1180, window.innerWidth - 40), h = Math.min(780, window.innerHeight - 80);
        WM.open('course-catalog', 'LMS Course Catalog', html, this.icon, { width: w, height: h, center: true, fullscreen: true });
        if (window.innerWidth < 900) WM.maximize('course-catalog');   // the tables need room
    }
};
