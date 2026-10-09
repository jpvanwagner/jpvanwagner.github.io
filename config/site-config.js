/**
 * SITE-CONFIG.JS - The one file to edit for names, links and pages.
 *
 * Everything the retro desktop shows (start menu, desktop icons, browser
 * favorites, boot screen, About window) reads from here, so you rarely need
 * to touch the other scripts. The page *content* itself lives in /pages/*.html.
 */
window.SiteConfig = {
    // Your name as it should appear on the site. EDIT ME.
    ownerName: 'Joseph VanWagner',

    // One short line under your name (job title, specialty, etc). EDIT ME.
    tagline: 'Instructional Designer · Educator · Writer · Advocate',

    // My resume in Google Docs (anyone with the link can view). Only the ID between /d/ and /edit
    // goes here; the "View online" and "Download PDF" links are made from it (pages/js/layout.js).
    resumeDocId: '1_HkaDmVCfs0w3XVfM55sDsrYPMJx8XAqS6dICWpnjl0',

    // The name of the desktop's operating system (boot screen, start menu stripe, About box).
    // "Portfolio 26" in 2026, "Portfolio 27" in 2027... (the last two digits of the current year)
    get osName() { return 'Portfolio ' + String(new Date().getFullYear()).slice(-2); },
    osVersion: '1.9',
    siteUrl: 'https://jvanwagner.neocities.org/',   // the public address (used by Share / Bookmark)
    firstYear: 2023,              // copyright starts here: "© 2023–<current year>"

    // Content pages. `file` is relative to /pages/. `icon` is from images/icons/.
    // Order here = order in the start menu and on the desktop.
    pages: [
        { id: 'home',     label: 'Home',     file: 'home.html',     icon: 'default/mycomputer.png', tip: 'My portfolio home page' },
        { id: 'about',    label: 'About Me', file: 'about.html',    icon: 'os/about-card.svg', tip: 'Who I am and how I got here' },
        { id: 'resume',   label: 'Resume',   file: 'resume.html',   icon: 'default/helpsheet.png', tip: 'Experience, skills, and awards' },
        { id: 'projects', label: 'Portfolio', file: 'projects.html', icon: 'os/briefcase.png', tip: 'My past work: sample courses, learning games, and areas of expertise' },
        { id: 'my-projects', label: 'Projects', file: 'my-projects.html', icon: 'os/projects.svg', tip: 'What I\'m building now: Scenemaker and Midnight at the Multiplex' },
        { id: 'courses',  label: 'Sample Courses', file: 'courses.html', icon: 'os/folder-full.png', tip: 'Interactive Rise 360 courses I built' },
        { id: 'contact',  label: 'Contact',  file: 'contact.html',  icon: 'default/letter.png', tip: 'Get in touch' }
    ],

    // The menu across the top of every page (Traditional View and inside the Retro Desktop's browser).
    // `file` is relative to /pages/. Built by pages/js/layout.js, so edit it only here.
    nav: [
        { label: 'Home',      file: 'home.html' },
        { label: 'About',     file: 'about.html' },
        { label: 'Resume',    file: 'resume.html' },
        { label: 'Portfolio', file: 'projects.html' },
        { label: 'Projects',  file: 'my-projects.html' },
        { label: 'Contact',   file: 'contact.html' }
    ],

    // The "NOTE:" line shown wherever a page has an empty <p class="media-note"></p>. Edit it only here.
    mediaNote: '<strong>NOTE:</strong> Most embedded audio and video (voiceovers, videos) can\'t play right now due to hosting limits; games still work. Something else not working? <a href="#email" data-email title="Opens a new email in your mail app">Contact me!</a>',

    // Outside links (shown in the start menu "Links" folder and browser favorites).
    // Leave `url` empty ('') to hide an entry. EDIT ME.
    links: [
        { label: 'LinkedIn', url: 'https://linkedin.com/in/jpvanwagner' },
        { label: 'Email',    url: 'email:' }   // 'email:' = the obfuscated address below
    ],

    // Playable learning games (games/<id>/index.html). The retro desktop opens them in their
    // own window at this size; Traditional View has a page for each (pages/project-game-<id>.html).
    // thumb = the picture in the desktop's Games folder. A short looping clip for the folder's preview
    // pane goes in images/previews/<id>.webm + .mp4 + .jpg (poster); none = the thumb is shown instead.
    games: [
        { id: 'mall-run',    label: 'Mall Run',    width: 900, height: 620, tip: 'Endless 3D runner quiz', thumb: 'images/games/mall-run-v2.jpg' },
        { id: 'quiz-guy',    label: 'Quiz-Guy',    width: 640, height: 700, tip: 'Maze-chase quiz', thumb: 'images/games/quiz-guy-v2.jpg' },
        { id: 'quizaga',     label: 'Quizaga',     width: 640, height: 860, tip: 'Space-shooter quiz', thumb: 'images/games/quizaga-v2.jpg' },
        { id: 'quizcavator', label: 'Quizcavator', width: 640, height: 860, tip: 'Digging quiz', thumb: 'images/games/quizcavator-v2.jpg' },
        { id: 'right-this-way', label: 'Right This Way, Please', width: 1180, height: 760, tip: 'Access-desk security game', thumb: 'images/games/right-this-way.jpg' },
        { id: 'unit-204',    label: 'Unit 204',    width: 960, height: 572, tip: 'Point-and-click move-out inspection', thumb: 'images/games/unit-204.jpg' }
    ],

    // VISITOR COUNTER (the 88x31 badge in the footer). One count for the whole site, shown on
    // every page. It's an image from 88x31.lol (free, no account, no cookies), which counts UNIQUE
    // visitors: each person once per day, however many pages they open. Neocities allows images
    // from other sites. If 88x31.lol is ever down, the badge falls back to hitCounterFallback
    // (hits.sh, which counts page loads instead) so it never disappears.
    hitCounter: 'https://88x31.lol/counter.gif',
    hitCounterFallback: 'https://hits.sh/jvanwagner.neocities.org.svg?style=flat-square&label=hits&color=1084d0&labelColor=000080',

    // THE NETWORK (a webring): member sites, in ring order. TO ADD A SITE, paste its address in
    // quotes on a new line, followed by a comma. That's all; each site's title and icon are fetched
    // automatically. (This site is always the first stop, so don't list it.) For example:
    //   network: [
    //       'https://janedoe.com/',
    //       'https://someone.neocities.org/portfolio/',
    //   ],
    // To set a site's name yourself instead:  { url: 'https://janedoe.com/', name: 'Jane Doe' },
    // Shown on pages/network.html and in the desktop's Network window (shared/network-ring.js).
    network: [
    ],

    // EMAIL (anti-scraper): the address is stored reversed + base64 so it never appears
    // as plain text in the source or on the page. It is only rebuilt when someone clicks
    // an "Email" link, which opens their mail app with the address filled in.
    // To change it, run in a browser console:  btoa('you@example.com'.split('').reverse().join(''))
    emailCode: 'bW9jLmxpYW1ub3RvcnBAcmVuZ2F3bmF2ag==',
    emailSubject: 'Hello from your portfolio',

    // MESSAGES ("Messages from Joe" pop-ups on the Retro Desktop, desktop/js/apps/messenger.js): where in-app replies go.
    // Paste the address of a free form service here (for example Formspree: make a form at formspree.io,
    // then paste its "https://formspree.io/f/xxxxxxxx" address) and replies arrive in your inbox without
    // the visitor ever seeing your email address. Left empty, "Send" opens the visitor's email app instead.
    messageEndpoint: '',

    /** Opens a new email to the owner. Called by every Email link/button. Subject and body are optional. */
    openEmail(subject, body) {
        const addr = atob(this.emailCode).split('').reverse().join('');
        const w = window.top || window;
        w.location.href = 'mai' + 'lto:' + addr + '?subject=' + encodeURIComponent(subject || this.emailSubject) +
            (body ? '&body=' + encodeURIComponent(body) : '');
    }
};

// Any element with [data-email] opens a new email when clicked (works on every page).
document.addEventListener('click', function (e) {
    const el = e.target.closest && e.target.closest('[data-email]');
    if (!el) return;
    e.preventDefault();
    SiteConfig.openEmail();
});

/**
 * SiteMode - remembers whether the visitor prefers the retro desktop or the
 * classic (plain website) view. Shared by index.html and every page in /pages/.
 */
window.SiteMode = {
    key: 'site-view-mode',

    get() {
        try { return localStorage.getItem(this.key); } catch (e) { return null; }
    },

    set(mode) {
        try { localStorage.setItem(this.key, mode); } catch (e) {}
    }
};
