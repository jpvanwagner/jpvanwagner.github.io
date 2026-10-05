/**
 * TICKER.JS - Looping quote carousels (home.html and about.html).
 *
 * Markup:
 *   <div class="ticker" data-ticker data-interval="6000">                 (student quotes, 1 at a time;
 *                                                                          add data-shuffle for a random order)
 *     <blockquote class="ticker-item">...</blockquote>  ...
 *   </div>
 *   <div class="quotes" data-ticker data-per-view="3" data-interval="9000">  (colleague quotes, 3 at a time)
 *     <blockquote class="testimonial">...</blockquote>  ...
 *   </div>
 * This script puts a < button on the left and a > button on the right, shows data-per-view quotes
 * at once (fewer on narrow screens, so each stays readable), and steps forward by one every
 * data-interval ms. Both arrows loop around in either direction. It pauses while the pointer is
 * over it or a button has keyboard focus, so nobody loses a quote mid-read. Without JavaScript all
 * the quotes simply show as a list/grid.
 */
(function () {
    var MIN_WIDTH = 260;    // narrowest a quote card gets before we show one fewer

    function setup(box) {
        var items = Array.prototype.slice.call(box.children).filter(function (el) {
            return el.matches('.ticker-item, .testimonial');
        });
        if (items.length < 2) return;
        // data-shuffle: start from a random order each visit (long lists don't always open on the same quote)
        if (box.hasAttribute('data-shuffle')) {
            for (var i = items.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1)), t = items[i]; items[i] = items[j]; items[j] = t;
            }
        }
        var interval = Number(box.getAttribute('data-interval')) || 6000;
        var maxPer = Math.max(1, Number(box.getAttribute('data-per-view')) || 1);
        var index = 0, per = 1, timer = null, paused = false;

        // Layout: [<]  [quotes...]  [>]   plus a small counter underneath
        var prev = document.createElement('button');
        var next = document.createElement('button');
        [[prev, -1, 'Previous quote', '&#8249;'], [next, 1, 'Next quote', '&#8250;']].forEach(function (b) {
            b[0].type = 'button'; b[0].className = 'ticker-btn'; b[0].setAttribute('data-dir', b[1]);
            b[0].setAttribute('aria-label', b[2]); b[0].title = b[2]; b[0].innerHTML = b[3];
        });
        var view = document.createElement('div');
        view.className = 'ticker-view';
        items.forEach(function (it) { view.appendChild(it); });
        var count = document.createElement('div');
        count.className = 'ticker-count';
        count.setAttribute('aria-live', 'polite');
        box.append(prev, view, next, count);
        box.classList.add('ticker-ready');
        box.setAttribute('aria-roledescription', 'carousel');

        function perView() {
            var w = view.clientWidth || box.clientWidth;
            return Math.max(1, Math.min(maxPer, items.length, Math.floor((w + 12) / (MIN_WIDTH + 12))));
        }
        function show(i) {
            index = (i + items.length) % items.length;
            per = perView();
            view.style.setProperty('--per', per);
            items.forEach(function (it) { it.classList.remove('is-active'); it.setAttribute('aria-hidden', 'true'); it.style.order = ''; });
            for (var k = 0; k < per; k++) {
                var it = items[(index + k) % items.length];
                it.classList.add('is-active'); it.setAttribute('aria-hidden', 'false'); it.style.order = k;
            }
            var shown = [];
            for (var n = 0; n < per; n++) shown.push((index + n) % items.length + 1);
            count.textContent = (per === 1 ? shown[0] : shown.join(', ')) + ' of ' + items.length;
        }
        function restart() {
            clearInterval(timer);
            timer = setInterval(function () { if (!paused) show(index + 1); }, interval);
        }

        box.addEventListener('click', function (e) {
            var b = e.target.closest('.ticker-btn');
            if (!b || !box.contains(b)) return;
            show(index + Number(b.getAttribute('data-dir')));
            restart();                                   // a manual skip gets a full interval to read
        });
        box.addEventListener('mouseenter', function () { paused = true; });
        box.addEventListener('mouseleave', function () { paused = false; });
        box.addEventListener('focusin', function () { paused = true; });
        box.addEventListener('focusout', function () { paused = false; });
        window.addEventListener('resize', function () { if (perView() !== per) show(index); });

        show(0);
        restart();
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('[data-ticker]').forEach(setup);
    });
})();
