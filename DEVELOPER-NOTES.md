# Developer Notes

A map of the site so you can find things fast. Plain HTML/CSS/JS, no build step:
upload the folder's contents to Neocities and it runs.

## Two ways to view the site

| Name | What it is | Entry point |
|---|---|---|
| **Retro Desktop** | The pretend 90s computer: windows, Start menu, taskbricks, toys | `index.html` |
| **Traditional View** | A normal website (same content, no desktop) | `pages/home.html` |

The pages in `pages/` are shared: Traditional View shows them directly, and the Retro Desktop
shows them inside its NetCrawler browser window. **Edit content once and it shows up in both.**

Inside the Retro Desktop, pages automatically take on the desktop's current theme colors
(`pages/js/classic.js`, "THEME SYNC"); headings and body text keep their readable defaults.
Traditional View always uses the default navy/grey look.

The visitor's choice is remembered in their browser (`localStorage` key `site-view-mode`):
* Retro to Classic: Start > "Switch to Traditional View", the "Traditional View" desktop icon, or the button in the page header.
* Classic to Retro: the yellow "Retro Desktop" button in the page header.
* First visit: phones/narrow screens get Traditional View, larger screens get the Retro Desktop.

## Folder map

```
index.html                 Retro Desktop shell (loads everything below, in order)
not_found.html             404 page (Neocities serves it for any missing URL)
readme.txt / credits.txt   Opened in the Notes app from the desktop / About window
DEVELOPER-NOTES.md         This file

config/
  site-config.js           ** Your name, tagline, OS name, page list, outside links. Start here. **
  photos.js                My photographs (images/photos/ + thumbs/): wallpapers now, a Photos viewer later

pages/                     Traditional View = the actual portfolio content
  home.html about.html projects.html ("Portfolio") resume.html contact.html
  project-*.html           One detail page per portfolio project (e.g. project-community-engagement.html)
  css/classic.css          Base page styling: the retro look used inside the Retro Desktop (+ print styles)
  css/modern.css           Traditional View's modern look; every rule is scoped to html:not(.in-desktop)
  search.html              Site-wide search results
  js/search.js             Header search button (every page) + the search itself
  js/search-index.js       GENERATED text of every page: run  python tools/build-search-index.py  after editing pages
  js/layout.js             Builds every page's header + menu, footer and "NOTE:" line (from config/site-config.js)
                           and fills data-shared="..." blocks (from config/shared-content.js)
  js/ticker.js             Looping quote carousels (colleagues on Home/About, students on Home)
  js/collection.js         Portfolio page: 4 courses/games at a time + View all; courses.html/games.html copy the cards
  js/showcase.js           Home "Try something I built" rows, pulled from the Portfolio page's cards
  js/resume-view.js        Traditional / Functional switch on resume.html
  js/classic.js            Fills in name/links/copyright years, highlights nav, wires the Retro/Classic
                           button; inside the desktop it reports the page title/address to NetCrawler

desktop/                   Everything that only exists in the Retro Desktop
  css/
    base.css               Color variables, reset, default wallpaper, bevel helpers
    desktop-icons.css      Desktop icons
    windows.css            Program windows
    taskbricks.css         The brick taskbar (+ auto-hide)
    start-menu.css         Start menu items/flyouts
    drawers.css            TOOLS and DOODLETOP side drawers
    apps.css               Browser + Notes menu bars
    effects.css            CRT scanlines, boot + shutdown screens
    idle-help.css          "Need a hand?" dialog
    context-menu.css       Right-click menus + icon Properties dialog
    desktop-files.css      Visitors' folders/text files and the Rubbish bin (+ drag-over highlight)
    retro-cursor.css       Pixel-art mouse pointers (html.retro-cursor)
    y2k.css                Date/Time Properties window + the Y2K glitch
    first-tips.css         First-visit tip balloons
    os-settings.css        Settings window
  js/core/                 The "operating system"
    startup.js             Boot animation, then opens the browser
    window-manager.js      Windows (open/close/drag/resize)       global: WM
    taskbricks.js          Brick taskbar layout + dragging         global: TaskBricks
    taskbricks-parts.js    MENU brick, tray clock, right-click menu
    volume.js              Tray speaker + slider: this site's volume only        global: SiteVolume
    start-menu-data.js     ** What's in the Start menu **
    start-menu.js          Draws the Start menu                    global: Menu
    desktop-icons.js       Desktop icons                            global: Desktop
    view-mode.js           Switch to Traditional View                  global: ViewMode
    first-tips.js          First-visit tips (don't show again / Traditional View) global: FirstTips
    feature-hints.js       One-time hints the first time a feature is used   global: FeatureHints
    menubar.js             App menu bars: one dropdown at a time, hover to switch global: MenuBars
    menu-shortcuts.js      Right-click a MENU item > Open / Add to desktop   global: MenuShortcuts
    tray-share.js          Share button in the system tray                   global: TrayShare
    sys-clock.js           Tray date + time, Date/Time Properties (not saved)  global: SysClock
    idle-help.js           "Need a hand?" dialog after 2 idle minutes global: IdleHelp
    context-menu.js        Right-click menus (desktop, icons, windows, bricks, tabs) global: ContextMenu
    desktop-files.js       Visitors' own folders + text files, Rubbish bin (localStorage) global: DesktopFiles
    desktop-arrange.js     Sort icons, auto arrange, snap to grid (add-on to desktop-icons.js)
    shutdown.js            Shut Down screen
    main.js                Final start-up
  js/apps/                 Programs that open in windows
    browser.js             NetCrawler browser                       global: Browser
    browser-tabs.js        Tabs for NetCrawler (add-on to browser.js) global: BrowserTabs
    games.js               Games folder + game windows              global: GamesApp
    network.js             "Network" window: fellow professionals' sites (config: network) global: NetworkApp
    os-settings.js         Settings window (saved in localStorage)  global: OSSettings
    notes.js               Notepad clone                            global: NotesApp
    calculator.js          Calculator                               global: CalculatorApp
    clock.js + clock-timers.js   Clock, stopwatch, timer            global: ClockApp
    about.js               About This Site window
    scenemaker.js          Scenemaker live demo in a desktop window   global: SceneMakerApp
  js/customize/            Looks and toys
    themes-data.js         ** All color themes (add yours here) **
    theme-browser.js       Theme Browser window
    wallpapers-data.js     ** Wallpaper list (add yours here) **
    wallpaper-gallery.js   Wallpaper picker window
    tools-drawer.js        TOOLS drawer: painter, fonts, color math  global: Tools
    tools-toggles.js       Quick toggles: CRT, screensaver, auto-hide, reset
    doodletop.js + doodletop-ui.js   Paint on the screen             global: DoodleTop
    screensaver.js         Bouncing-logo screensaver
    drawer-tabs.js         Hide / keep-on-top for the two drawers   global: DrawerTabs
    retro-cursor.js        Retro mouse pointer on/off (TOOLS toggle, Settings)   global: RetroCursor
    wallpaper-cycle.js     Wallpaper slideshow: every X minutes, all or ticked ones   global: WallpaperCycle
    y2k.js                 Y2K "millennium bug" Easter egg (clock rolls into 2000)   global: Y2K

work/                      Sample e-learning (unmodified Rise 360 web exports, one folder per course)
  ctpat-course/  supervisors-as-trainers/  body-worn-cameras/  ai-use-policy/  asana-custom-fields/
  retail-post-orders/  first-amendment-auditors/  heat-safety/  use-of-force/
  scenemaker/  (Scenemaker live demo: landing page index.html, editor in app/editor/. The editor's
               code is minified into sm-core.min.js + sm-app.min.js on purpose; the readable
               source stays private. Exports made in the demo carry a credit line.)
  property-post-orders/ (its video, assets/Incident_Documentation_Pro.mp4, is added separately)
                           Each is shown on pages/project-<name>.html in an embedded frame.
                           To add a course: unzip the Rise export's "content" folder into work/<name>/,
                           copy an existing course page in pages/, and add a card to projects.html#courses.
                           Client and employer names are removed before publishing (text, image
                           file names, narration that says them, logos blurred).

games/                     Playable learning games, one self-contained index.html each
  mall-run/  quiz-guy/  quizaga/  quizcavator/  right-this-way/
  unit-204/  (Unit 204: index.html + css/ js/ assets/fonts/, synced from the GAME--Unit-204 repo by its
             sync-to-portfolio workflow; its sounds are embedded in js/sounds.js, so no audio files)
                           Listed in config/site-config.js (games); Traditional View page for each is
                           pages/project-game-<id>.html. To add one: drop it in games/<id>/index.html,
                           add it to `games` in the config, copy a project-game page, add a card to
                           projects.html#games, and put a 480x270 title-screen image in images/games/<id>.jpg.

tools/
  build-search-index.py    Rebuilds pages/js/search-index.js (run after changing page text). Not needed on Neocities.
  stamp-version.py         Writes config/site-version.js; a new stamp makes the tutorial tips show again for returning visitors.
  make-cursors.py          Redraws images/cursors/*.png from pixel maps. Not needed on Neocities.

(Resume: the "View my resume" buttons on resume.html, about.html and contact.html link to the
 live Google Docs version, so it's always current. Change that link in those three pages.)

shared/                    Used by BOTH views
  share.js + share.css     "Share this site" and "Add to Favorites" pop-ups   global: SiteShare

images/
  games/                      Title-screen thumbnails for the games
  icons/logo.svg, globe.svg   Site logo + browser icon (pixel art, editable as text)
  icons/default/, icons/os/   Classic-style icons
  wallpapers/                 Wallpaper images
```

## Common edits

* **Your name / links / OS name / first copyright year:** `config/site-config.js`.
* **Adding one of your photos:** save `images/photos/<id>.jpg` (~1920px) and `images/photos/thumbs/<id>.jpg` (~320px), then add a line to `config/photos.js`. It shows up in the Wallpaper Gallery as "Photo: ...".
* **After editing any page's text:** run `python tools/build-search-index.py` so search finds the new words.
* **Before every upload:** run `python tools/stamp-version.py` (build-search-index.py also does it) and upload
  `config/site-version.js`. Returning visitors then see the welcome tips, hints and the Scenemaker tour again,
  with a small note in the first tip saying the site was updated.
* **Network (fellow professionals' sites):** add entries to `network` in `config/site-config.js`.
* **Years of experience:** `<span data-years-since="2011-06">` counts up by itself every June.
* **Software & platforms list:** `pages/resume.html#tools` (grouped, linked; `class="key"` = highlighted).
* **Add a sample course:** put the Rise export in `work/<slug>/`, copy a `pages/project-<course>.html`, and add
  one card to `#courses` in `pages/projects.html` (it then appears on courses.html and in the Home rotation).
* **Email address:** stored obfuscated in `config/site-config.js` (`emailCode`), never as plain text.
  Any element with a `data-email` attribute opens a new email when clicked. To change the
  address, run `btoa('you@example.com'.split('').reverse().join(''))` in a browser console and
  paste the result into `emailCode`.
* **One place for everything (both views):** the Traditional View and the Retro Desktop's browser
  show the SAME files in `pages/`, so every edit shows up in both. Content that appears on more than
  one page is kept once:
  * the menu across the top: `nav` in `config/site-config.js`
  * the "NOTE:" line: `mediaNote` in `config/site-config.js` (a page shows it with `<p class="media-note"></p>`)
  * header, footer, copyright, badges: built by `pages/js/layout.js` (pages just have empty
    `<header class="site-header"></header>` / `<footer class="site-footer"></footer>`)
  * the stat boxes and "What colleagues say": `config/shared-content.js` (pages show them with
    `<div ... data-shared="stats"></div>` / `data-shared="colleague-quotes"`)
  * sample courses and learning games: the cards in `pages/projects.html`; `courses.html`, `games.html`
    and the Home page rows all read them from there
* **Page text:** the matching file in `pages/` (look for `EDIT ME` comments).
* **Add a page:** copy a page in `pages/` (keep its `<head>` script list and the empty header/footer),
  and add it to `pages` in `config/site-config.js` (that adds the desktop icon, Start menu entry and
  browser favorite). To put it in the top menu too, add it to `nav` in the same file.
* **Add a project detail page:** copy `pages/project-community-engagement.html`, rename it
  `project-<name>.html`, replace the text, and add a "Read more" link on its card in
  `pages/projects.html`. (`<body data-nav="projects.html">` keeps "Portfolio" highlighted in the nav.)
* **Your photo / project screenshots:** upload to `images/`, then follow the comments in
  `pages/about.html` and `pages/projects.html`.
* **Start menu contents:** `desktop/js/core/start-menu-data.js`.
* **Messages from Joe (Retro Desktop tray pop-ups):** the messages themselves are `MESSAGES` in
  `desktop/js/apps/messenger.js` (one arrives every 20 to 30 minutes, at random; unread ones queue up and open one at a time). In-app replies go to `messageEndpoint`
  in `config/site-config.js` (paste a free Formspree form address there); left empty, "Send" opens the
  visitor's email app. Its "uh-oh!" is synthesized in the browser (no sound file).
* **Folders (Sample Courses / Games / Projects on the desktop):** `desktop/js/apps/folders.js`; they read
  the Portfolio page's course cards and `games` in `config/site-config.js`, so nothing to edit there.
* **Themes / wallpapers:** `desktop/js/customize/themes-data.js` / `wallpapers-data.js`.

## Testing locally

Double-clicking `index.html` works for almost everything. Browsers block a few things for
pages opened straight from a folder (`file://`), such as opening `readme.txt` in the Notes app.
For a full local test, run a tiny web server in the site folder, e.g. `python -m http.server`,
and open http://localhost:8000.

## Conventions

* One feature per file. When a feature grows big it is split into a base file plus an add-on
  that extends the same object (`Object.assign(window.X, {...})`); the add-on must load right
  after the base in `index.html`.
* `class="retro-only"` on anything in `pages/` (badges, emoji, flourishes) shows it only inside
  the Retro Desktop; Traditional View hides it automatically. Keeps Traditional View clean without
  maintaining two copies of each page.
* Styles live in `.css` files, not in JavaScript strings (small one-off inline styles aside).
* Paths in desktop scripts are relative to `index.html` (e.g. `images/icons/...`).
