/**
 * LIGHTBOX.JS - Click a thumbnail to see the full-size picture (any page that loads this file).
 *
 *   <a class="zoom" href="full-size.png" data-caption="What it shows"><img src="thumb.jpg" alt="..."></a>
 *
 * Opens the picture over the page with its caption. Left/Right arrows (or the < > buttons) step
 * through the other .zoom links in the same .shots gallery; Esc, the X or a click outside closes.
 * Without JavaScript the link simply opens the picture. Styles: css/classic.css ("LIGHTBOX").
 */
(function () {
    var box, img, cap, list = [], at = 0;

    function build() {
        box = document.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure>' +
            '<button type="button" class="lb-prev" aria-label="Previous picture" title="Previous (Left arrow)">&lsaquo;</button>' +
            '<button type="button" class="lb-next" aria-label="Next picture" title="Next (Right arrow)">&rsaquo;</button>' +
            '<button type="button" class="lb-close" aria-label="Close" title="Close (Esc)">&times;</button>';
        document.body.appendChild(box);
        img = box.querySelector('img'); cap = box.querySelector('figcaption');
        box.addEventListener('click', function (e) {
            if (e.target.closest('.lb-prev')) return step(-1);
            if (e.target.closest('.lb-next')) return step(1);
            if (e.target === box || e.target.closest('.lb-close')) close();
        });
        document.addEventListener('keydown', function (e) {
            if (!box.classList.contains('open')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') step(-1);
            if (e.key === 'ArrowRight') step(1);
        });
    }
    function show(i) {
        at = (i + list.length) % list.length;
        var a = list[at], t = a.querySelector('img');
        img.src = a.getAttribute('href');
        img.alt = t ? t.alt : '';
        cap.textContent = a.getAttribute('data-caption') || (t ? t.alt : '');
        box.classList.toggle('single', list.length < 2);
    }
    function step(d) { show(at + d); }
    function open(a) {
        if (!box) build();
        var group = a.closest('.shots') || document;
        list = Array.prototype.slice.call(group.querySelectorAll('a.zoom'));
        show(list.indexOf(a));
        box.classList.add('open');
        box.querySelector('.lb-close').focus();
    }
    function close() { box.classList.remove('open'); img.removeAttribute('src'); }

    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a.zoom');
        if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        open(a);
    });
})();

/* Looping clips (.motion video, .motion-thumb): click to pause/play; paused from the start for
   visitors who prefer reduced motion (they can still click to play). */
(function () {
    function setup() {
        var still = false;
        try { still = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
        document.querySelectorAll('.motion video, video.motion-thumb').forEach(function (v) {
            if (still) { v.removeAttribute('autoplay'); v.pause(); }
            if (v.classList.contains('motion-thumb')) return;       // card thumbnails are links
            v.addEventListener('click', function () { if (v.paused) v.play(); else v.pause(); });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
