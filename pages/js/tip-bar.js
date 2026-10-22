/**
 * TIP-BAR.JS - a slim "Like what I'm doing? Buy me a coffee" bar (Ko-fi) on every project and game page.
 * One file for both views: Win95 gray status bar + raised button in the Retro Desktop, a soft rounded bar in
 * Traditional View (styles: css/classic.css "TIP BAR" + css/modern.css).
 * Where it goes, first match wins:
 *   1. <div data-tip-bar></div> anywhere on the page (to place it by hand)
 *   2. just below the page's tool or game (the first iframe[data-demo] / [data-demo-guard]), after its note line
 *   3. just below the first card grid (collection pages like Quizcade)
 *   4. at the end of the first panel
 * Add it to a page with <script src="js/tip-bar.js"></script> (tools/build-search-index.py adds the ?v= stamp).
 */
(function () {
    'use strict';
    var KOFI = 'https://ko-fi.com/jvanwagner';
    // a 15x15 pixel coffee cup: steam, a mug with a handle, and a saucer
    var CUP = '<svg class="tip-cup" viewBox="0 0 15 15" width="15" height="15" aria-hidden="true" shape-rendering="crispEdges">' +
        '<path fill="#9a9a9a" d="M4 1h1v1H4zM6 0h1v1H6zM5 2h1v1H5zM7 1h1v1H7zM8 2h1v1H8z"/>' +
        '<path fill="#000" d="M2 4h9v1H2zM2 5h1v6H2zM10 5h1v6h-1zM3 11h7v1H3zM11 5h2v1h-2zM13 6h1v3h-1zM11 9h2v1h-2zM0 13h15v1H0z"/>' +
        '<path fill="#fff" d="M3 5h7v1H3z"/><path fill="#8b4513" d="M3 6h7v1H3z"/><path fill="#d2b48c" d="M3 7h7v4H3z"/>' +
        '<path fill="#c0392b" d="M5 8h3v2H5z"/><path fill="#808080" d="M1 12h13v1H1z"/></svg>';

    function build() {
        var main = document.querySelector('main');
        if (!main || main.querySelector('.tip-bar')) return;
        var bar = document.createElement('aside');
        bar.className = 'tip-bar';
        bar.setAttribute('aria-label', 'Support my work');
        bar.innerHTML = '<span class="tip-text"><b>Like what I\'m doing?</b> Tips help keep these projects going.</span>' +
            '<a class="tip-btn" href="' + KOFI + '" target="_blank" rel="noopener" title="Leave a tip on Ko-fi (opens in a new tab)">' +
            CUP + '<span>Buy me a coffee</span></a>';

        var spot = main.querySelector('[data-tip-bar]');
        if (spot) { spot.parentNode.replaceChild(bar, spot); return; }
        var frame = main.querySelector('iframe[data-demo], iframe[data-demo-guard]');
        var after = frame ? (frame.closest('.course-frame, .game-embed') || frame.parentNode) : main.querySelector('.grid');
        if (after) {
            var next = after.nextElementSibling;
            if (next && next.classList.contains('course-note')) after = next;
            after.parentNode.insertBefore(bar, after.nextSibling);
            return;
        }
        var first = main.querySelector('.panel-body');
        if (first) first.appendChild(bar);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
