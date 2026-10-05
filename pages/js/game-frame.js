/**
 * GAME-FRAME.JS - Sizes the playable game on each game page (pages/project-game-*.html) so the whole
 * game fits on screen: no scrollbars inside the frame, and no need to scroll the page to see it all.
 *
 * The frame is never taller than the window (minus a little room for the page header). Inside it,
 * each quiz game has its own "fit to window" script that narrows the game until it fits that
 * height (games/<id>/index.html); once it settles, the frame shrinks to the game's real height so
 * there's no empty space. Mall Run fills whatever space it's given, so it simply keeps its
 * 900 x 620 shape within the window. Re-measured as the game settles and whenever the window resizes.
 */
(function () {
    function setup(frame) {
        var box = frame.parentElement;
        var id = (frame.getAttribute('src') || '').split('/games/')[1] || '';
        id = id.split('/')[0];

        // Room left on screen: the window minus the page header when it stays pinned at the top
        function avail() {
            var hd = document.querySelector('.site-header');
            var pinned = hd && /sticky|fixed/.test(getComputedStyle(hd).position) ? hd.offsetHeight : 0;
            return Math.max(360, window.innerHeight - pinned - 24);
        }
        function border() { return box.offsetHeight - box.clientHeight; }

        function fit() {
            if (id === 'mall-run') {                       // fills its space: keep its design shape
                box.style.height = Math.round(Math.min(box.clientWidth * 620 / 900, avail())) + 'px';
                return;
            }
            var doc;
            try { doc = frame.contentDocument; } catch (e) { return; }
            if (!doc || !doc.body) return;
            // Step 1: give the game the full available height; its own script then fits itself to it
            box.style.height = avail() + 'px';
            // Step 2 (a moment later): shrink the frame to the game's real height
            setTimeout(function () {
                var w = doc.getElementById('game-wrapper') || doc.body.firstElementChild;
                if (!w) return;
                var cs = doc.defaultView.getComputedStyle(doc.body);
                var h = Math.ceil(w.getBoundingClientRect().bottom + parseFloat(cs.paddingBottom) + 2);
                if (h > 0) box.style.height = (Math.min(h, avail()) + border()) + 'px';
            }, 200);
        }

        frame.addEventListener('load', function () {
            try {
                var st = frame.contentDocument.createElement('style');
                st.textContent = 'html, body { margin: 0 !important; } body { min-height: 0 !important; }';
                frame.contentDocument.head.appendChild(st);
            } catch (e) {}
            fit();
            [600, 1500].forEach(function (ms) { setTimeout(fit, ms); });
        });
        window.addEventListener('resize', function () { clearTimeout(box._fitT); box._fitT = setTimeout(fit, 150); });
    }

    function init() { document.querySelectorAll('.game-frame iframe').forEach(setup); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
