/**
 * MENU-DATA.JS - What appears in the Start menu.
 *
 * Entry shapes:
 *   { label, icon, action }                  a clickable item (action is JS run on click)
 *   { label, icon, items: [...], keepOrder } a folder with a flyout submenu (optional `action`:
 *                                            what right-click > Open / Add to desktop does)
 *   { separator: true }                      a divider line
 *
 * Icons: 'name.png' means images/icons/os/name.png; 'folder/name.png' means
 * images/icons/folder/name.png; full URLs and 'images/...' paths are used as-is.
 *
 * The menu is rebuilt every time it opens, so the checkbox labels below
 * (getters) always reflect the current state.
 */

const accessoryItems = [
    { tip: "A simple text editor", label: "Notes", icon: "newfile.png", action: "if(window.NotesApp) window.NotesApp.open();" },
    { tip: "A basic calculator", label: "Calculator", icon: "calculator.png", action: "if(window.CalculatorApp) window.CalculatorApp.open();" },
    { tip: "Clock, alarms, stopwatch, and timer", label: "Clock & Timers", icon: "clock.png", action: "if(window.ClockApp) window.ClockApp.open();" },
    { tip: "Draw on top of the whole screen", label: "DoodleTop", icon: "doodletop.png", action: "if(window.DoodleTop) window.DoodleTop.openDrawer();" }
];

const settingsItems = [
    { tip: "Desktop, appearance, and browser settings", label: "All Settings...", icon: "tools.png", action: "if(window.OSSettings) window.OSSettings.open();" },
    { tip: "Tabs, home page, and text size for NetCrawler", label: "Browser Settings...", icon: "images/icons/globe.svg", action: "if(window.OSSettings) window.OSSettings.open('browser');" },
    {
        // Only listed when a drawer tab has been hidden (right-click a tab > Hide)
        get label() { return (window.DrawerTabs && DrawerTabs.anyHidden()) ? 'Show drawer tabs' : ''; },
        icon: "tools.png",
        action: "if(window.DrawerTabs) DrawerTabs.showAll();"
    },
    { tip: "Pick a color theme", label: "Themes", icon: "themesgallery.png", action: "if(window.Tools) window.Tools.openThemes();" },
    { tip: "Pick a desktop wallpaper", label: "Wallpapers", icon: "wallpapergallery.png", action: "if(window.Tools) window.Tools.openWallpapers();" },
    {
        get label() { return document.fullscreenElement ? '☑ Fullscreen' : '☐ Fullscreen'; },
        tip: "Hide your browser's toolbars (Esc exits)",
        icon: "displayoptions.png",
        action: "if(!document.fullscreenElement){document.documentElement.requestFullscreen();}else{document.exitFullscreen();}"
    },
    {
        get label() { return document.body.classList.contains('autohide-bricks') ? '☑ Hide taskbricks' : '☐ Hide taskbricks'; },
        tip: "Slide the taskbar away until you point at the bottom",
        icon: "taskbricks.png",
        action: "if(window.Tools) window.Tools.toggleAutohide();"
    },
    {
        get label() { return (window.TaskBricks && window.TaskBricks.isLocked) ? '☑ Lock taskbricks' : '☐ Lock taskbricks'; },
        tip: "Stop taskbar buttons from being dragged around",
        icon: "taskbricks.png",
        action: "if(window.TaskBricks) { window.TaskBricks.isLocked = !window.TaskBricks.isLocked; const cb = document.getElementById('taskbrick-lock-check'); if(cb) cb.checked = window.TaskBricks.isLocked; }"
    },
    {
        get label() { return (document.getElementById('btn-screensaver') && document.getElementById('btn-screensaver').classList.contains('depressed')) ? '☑ Screensaver' : '☐ Screensaver'; },
        tip: "Bouncing logo after a few idle minutes",
        icon: "screensaver.png",
        action: "if(window.Tools) window.Tools.toggleScreensaver();"
    },
    {
        get label() { return (document.getElementById('btn-crt') && document.getElementById('btn-crt').classList.contains('depressed')) ? '☑ CRT FX' : '☐ CRT FX'; },
        tip: "Old-monitor scanlines over the screen",
        icon: "displayoptions.png",
        action: "if(window.Tools) window.Tools.toggleCRT();"
    }
];

window.StartMenuData = {
    build() {
        const cfg = window.SiteConfig || { pages: [], links: [] };
        const menu = [];

        // 1. Portfolio pages, straight at the top so visitors find them instantly.
        //    On short screens (landscape phones) they fold into one "Pages" folder so the menu fits.
        const pageItems = cfg.pages.map(p =>
            ({ label: p.label, icon: p.icon, tip: p.tip, action: `window.Browser.openPage('${p.file}');`, bold: p.id === 'home' }));
        if (window.innerHeight < 560) {
            menu.push({ label: "Pages", icon: "folder-full.png", tip: "Every page of this portfolio", keepOrder: true, items: pageItems });
        } else {
            pageItems.forEach(item => menu.push(item));
        }

        menu.push({ separator: true });

        // Games folder, shown inside Programs: one entry per game in site-config.js (desktop/js/apps/games.js)
        const gamesFolder = (cfg.games || []).length ? {
            label: "Games", icon: "media.png", tip: "Quiz games I built for training, plus my game in development", keepOrder: true, action: "window.GamesApp.openFolder();",
            submenu: cfg.games.map(g => ({ label: g.label, icon: `images/icons/apps/${g.id}.png`, tip: g.tip, action: `GamesApp.open('${g.id}');` }))
                // A game I'm building (Projects): its page, same as from the Projects page
                .concat([{ label: "Midnight at the Multiplex (Demo)", icon: "images/icons/apps/midnight.png", tip: "Play the web demo of my retro life-sim game in development", action: "window.MidnightApp.open();" },
                         { label: "About Midnight at the Multiplex", icon: "media.png", tip: "The game's project page: what it is, how it's built, and first looks", action: "window.Browser.openPage('project-midnight-multiplex.html');" }])
        } : null;

        // 2. Folders
        menu.push({
            label: "Programs", icon: "os/programs.svg", tip: "Notes, Calculator, Clock, DoodleTop, the NetCrawler browser, Scenemaker, and Games", items: [
                { label: "Accessories", icon: "folder.png", tip: "Small handy programs", submenu: accessoryItems },
                { label: "NetCrawler", icon: "images/icons/globe.svg", tip: "Open another browser window", action: "if(window.Browser) window.Browser.open(null, true);" },
                { label: "Scenemaker (Demo)", icon: "os/scenemaker.png", tip: "Try Scenemaker, the branching-story authoring tool I'm building", action: "if(window.SceneMakerApp) SceneMakerApp.open();" }
            ].concat(gamesFolder ? [gamesFolder] : [])
        });

        const links = (cfg.links || []).filter(l => l.url);
        if (links.length) {
            menu.push({
                label: "Links", icon: "socials.png", tip: "LinkedIn and email", keepOrder: true,
                items: links.map(l => ({ label: l.label, action: l.url === 'email:'
                    ? 'SiteConfig.openEmail();'    // obfuscated address, see site-config.js
                    : `window.open('${l.url}', '_blank', 'noopener');` }))
            });
        }

        // The Network: my webring of fellow professionals' sites (desktop/js/apps/network.js)
        menu.push({ label: "The Network", icon: "os/network.svg", tip: "Fellow professionals' sites, how to join, and the buttons for your own page", action: "if(window.NetworkApp) NetworkApp.open();" });

        // Find: "Seek", the site's search-engine page (pages/find.html), like Start > Find on Windows 95
        menu.push({ label: "Find...", icon: "images/icons/os/search.svg", tip: "Seek: search every page of this portfolio, or browse by topic", action: "window.Browser.open('pages/find.html', true, true);" });

        menu.push({ label: "Settings", icon: "tools.png", tip: "Themes, wallpaper, effects, and site settings", items: settingsItems, action: "if(window.OSSettings) OSSettings.open();" });

        menu.push({ separator: true });

        // 3. The escape hatch to a normal website.
        menu.push({ label: "Switch to Traditional View", tip: "See this portfolio as a regular website", icon: "os/classic-view.svg", action: "window.ViewMode.toClassic();", bold: true });

        return menu;
    }
};
