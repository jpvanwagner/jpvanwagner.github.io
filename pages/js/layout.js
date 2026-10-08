/**
 * LAYOUT.JS - Builds the parts every page shares, so each lives in ONE place.
 *
 *   <header class="site-header"></header>   logo + name, the menu (SiteConfig.nav), Retro Desktop button
 *   <footer class="site-footer"></footer>   copyright, Share / Add to favorites, retro-only badges
 *   <p class="media-note"></p>              the "NOTE:" line (SiteConfig.mediaNote)
 *   <div data-shared="stats"></div>         a block from config/shared-content.js (SharedContent.stats;
 *                                            "colleague-quotes" = SharedContent.colleagueQuotes)
 *   <span data-resume-doc></span>           "View my resume ▾" drop-down: View online / Download PDF
 *                                            (SiteConfig.resumeDocId).
 *                                            Add class="primary" to make it the highlighted button.
 *
 * Load order in each page's <head>: site-config.js, shared-content.js, then THIS file, then
 * classic.js and the rest. This runs first on DOMContentLoaded, so classic.js (names, theme
 * button, current-page highlight) and ticker.js (quote carousels) see the finished page.
 * Same pages are used by the Traditional View and the Retro Desktop's browser.
 */
(function () {
    var cfg = window.SiteConfig || {};

    function header() {
        var nav = (cfg.nav || []).map(function (n) {
            return '<a href="' + n.file + '">' + n.label + '</a>';
        }).join('');
        return '<div class="inner">' +
                 '<a class="brand" href="home.html"><img src="../images/icons/logo.svg" alt="">' +
                 '<span class="name" data-owner>' + (cfg.ownerName || '') + '</span></a>' +
                 '<nav class="site-nav" aria-label="Main">' + nav + '</nav>' +
                 '<a class="mode-btn" id="mode-btn" href="../index.html?mode=retro">Retro Desktop</a>' +
               '</div>';
    }

    /** One webring arrow (prev / random / next) for the footer */
    function ring(go, tip, alt) {
        return '<a class="badge ring-btn" href="network.html?go=' + go + '" target="_blank" rel="noopener" title="' + tip + '">' +
               '<img src="../images/network/the-network-' + go + '.png" width="31" height="31" alt="' + alt + '"></a>';
    }

    function footer() {
        return '&copy; <span data-year></span> <span data-owner>' + (cfg.ownerName || '') + '</span>. ' +
               '<span class="footer-actions">' +
                 '<a href="#share" data-share title="Share this portfolio on LinkedIn, Facebook, email, and more">Share this site</a> &middot; ' +
                 '<a href="#bookmark" data-bookmark title="Save this portfolio in your browser\'s favorites">Add to favorites</a> &middot; ' +
                 '<a href="network.html" title="The Network: fellow professionals\' sites, linked together">The Network</a>' +
               '</span>' +
               // Retro-only: shown inside the Retro Desktop, hidden in Traditional View (see classic.css)
               '<div class="badges retro-only">' +
                 '<a class="badge anybrowser" href="https://anybrowser.org/campaign/" tabindex="-1" aria-hidden="true">BEST VIEWED WITH ANY BROWSER</a>' +
                 '<a class="badge neocities" href="https://neocities.org/" tabindex="-1" aria-hidden="true">HOSTED ON NEOCITIES</a>' +
                 // leave the retro desktop for the regular website (js/classic.js handles [data-to-classic])
                 '<a class="badge classicview" href="#traditional-view" data-to-classic title="Leave the retro desktop and see this page as a regular website">SWITCH TO TRADITIONAL VIEW</a>' +
                 // Visitor counter: one count for the whole site (SiteConfig.hitCounter; hidden while it's empty).
                 // A real 88x31 image shows as-is; if it fails to load, swap in the framed fallback counter.
                 (cfg.hitCounter ? '<a class="badge counter-badge" href="https://88x31.lol/" target="_blank" rel="noopener" title="Unique visitors to this site">' +
                   '<img src="' + String(cfg.hitCounter).replace(/"/g, '&quot;') + '" width="88" height="31" alt="Visitor counter"' +
                   (cfg.hitCounterFallback ? ' data-fallback="' + String(cfg.hitCounterFallback).replace(/"/g, '&quot;') + '"' : '') +
                   ' onerror="Layout.counterFallback(this)"></a>' : '') +
               '</div>' +
               // The Network webring, the whole set: its badge plus Previous / Full list / Random / Next
               // (pages/network.html does the hopping; prev/next/random open the other site in a new tab)
               '<div class="badges ring-badges retro-only" aria-label="The Network webring">' +
                 '<a class="badge network-badge" href="network.html" title="The Network: fellow professionals\' sites, linked together">' +
                   '<img src="../images/network/the-network-badge.png" width="88" height="31" alt="The Network"></a>' +
                 ring('prev', 'Previous site in The Network (opens in a new tab)', 'Previous site') +
                 '<a class="badge ring-btn" href="network.html#members" title="Every site in The Network"><img src="../images/network/the-network-list.png" width="31" height="31" alt="Full list"></a>' +
                 ring('random', 'A random site in The Network (opens in a new tab)', 'Random site') +
                 ring('next', 'Next site in The Network (opens in a new tab)', 'Next site') +
               '</div>';
    }

    /** "View my resume ▾": a drop-down that opens below (same look and behavior as the resume page's
     *  Sections menu) with View online / Download PDF, both made from SiteConfig.resumeDocId. */
    function resumeDoc(primary) {
        var base = 'https://docs.google.com/document/d/' + cfg.resumeDocId;
        var view = base + '/edit?usp=sharing', pdf = base + '/export?format=pdf';
        return '<details class="drop-menu resume-doc">' +
            '<summary class="btn' + (primary ? ' primary' : '') + '" title="My current resume in Google Docs: view it online or download a PDF">View my resume &#9662;</summary>' +
            '<div class="ps-menu">' +
                '<a href="' + view + '" target="_blank" rel="noopener" title="Opens in Google Docs, in a new tab">View online (Google Docs)</a>' +
                '<a href="' + pdf + '" target="_blank" rel="noopener" title="Downloads my resume as a PDF file">Download PDF</a>' +
            '</div></details>';
    }
    // Stat pop-ups (class="stat-pop") slide sideways if they'd run off the edge of the window
    function fitPop(e) {
        var tip = e.target.closest && e.target.closest('.stat-tip');
        var pop = tip && tip.querySelector('.stat-pop');
        if (!pop) return;
        pop.style.marginLeft = '0px';
        var r = pop.getBoundingClientRect(), pad = 8, shift = 0;
        if (r.left < pad) shift = pad - r.left;
        else if (r.right > window.innerWidth - pad) shift = window.innerWidth - pad - r.right;
        pop.style.marginLeft = shift + 'px';
    }
    document.addEventListener('mouseover', fitPop);
    document.addEventListener('focusin', fitPop);

    // Drop-down menus close when you click anywhere else or press Esc
    document.addEventListener('click', function (e) {
        document.querySelectorAll('details.drop-menu[open], details.print-sections[open]').forEach(function (d) {
            if (!d.contains(e.target)) d.open = false;
        });
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') document.querySelectorAll('details.drop-menu[open], details.print-sections[open]').forEach(function (d) { d.open = false; });
    });

    // data-shared="colleague-quotes" -> SharedContent.colleagueQuotes
    function sharedKey(name) {
        return name.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('header.site-header').forEach(function (h) {
            if (!h.children.length) h.innerHTML = header();
        });
        document.querySelectorAll('footer.site-footer').forEach(function (f) {
            if (!f.children.length) f.innerHTML = footer();
        });
        document.querySelectorAll('p.media-note').forEach(function (p) {
            if (!p.innerHTML.trim() && cfg.mediaNote) p.innerHTML = cfg.mediaNote;
        });
        if (cfg.resumeDocId) document.querySelectorAll('[data-resume-doc]').forEach(function (el) {
            if (!el.children.length) el.outerHTML = resumeDoc(el.classList.contains('primary'));
        });
        var shared = window.SharedContent || {};
        document.querySelectorAll('[data-shared]').forEach(function (el) {
            var html = shared[sharedKey(el.getAttribute('data-shared'))];
            if (html && !el.children.length) el.innerHTML = html;
        });
    });

    // Counter fallback: if the main counter image fails, show the backup counter inside a small
    // retro frame; if that fails too, show a plain green "0000000" so the badge never vanishes.
    window.Layout = window.Layout || {};
    window.Layout.counterFallback = function (img) {
        var box = img.parentNode, alt = img.getAttribute('data-fallback');
        box.classList.add('counter-framed');
        box.title = 'Visits to this site';
        box.innerHTML = '<span class="counter-label">VISITORS</span>';
        if (alt) {
            var im = new Image(); im.alt = 'Visitor count'; im.height = 14; im.src = alt;
            im.onerror = function () { im.replaceWith(Object.assign(document.createElement('span'), { className: 'counter-off', textContent: '0000000' })); };
            box.appendChild(im);
        } else {
            box.appendChild(Object.assign(document.createElement('span'), { className: 'counter-off', textContent: '0000000' }));
        }
    };
})();
