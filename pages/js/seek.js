/**
 * SEEK.JS - Extras for pages/find.html ("Seek", the site's search-engine start page).
 *   - "I'm Feeling Curious": opens a random page from the search index
 *   - shows how many pages Seek can search, and the tag cloud (from search.js's index)
 * The search itself happens on search.html (js/search.js); this page just sends people there.
 */
document.addEventListener('DOMContentLoaded', function () {
    var index = (window.SEARCH_INDEX || []).filter(function (e) { return e.url !== 'find.html'; });
    var count = document.getElementById('seek-count');
    if (count && index.length) count.textContent = 'Searching all ' + index.length + ' pages of Joseph VanWagner’s portfolio.';

    var curious = document.getElementById('seek-curious');
    if (curious) curious.addEventListener('click', function () {
        if (!index.length) return;
        location.href = index[Math.floor(Math.random() * index.length)].url;
    });

    // Tag cloud: every tag used on the site, most common first (links to search.html?tag=...)
    var box = document.getElementById('search-tags');
    if (box && !box.innerHTML.trim()) {
        var counts = {};
        index.forEach(function (e) { (e.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
        var list = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).slice(0, 40);
        if (list.length) box.innerHTML = '<h2>Browse by tag</h2><ul class="tags tag-cloud">' + list.map(function (t) {
            return '<li><a class="tag-link" href="search.html?tag=' + encodeURIComponent(t) + '">' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</a></li>';
        }).join('') + '</ul>';
    }
});
