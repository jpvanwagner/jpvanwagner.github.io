/**
 * RESUME-VIEW.JS - The "Resume format" switch on resume.html.
 *   Traditional (default): jobs in order, most recent first, like the PDF resume.
 *   Functional:            accomplishments grouped by skill, plus a short work history.
 * Only the .resume-view blocks change; the summary, stats, education, certifications, software,
 * awards and memberships show in both. The choice is remembered in this browser
 * (localStorage "resume-view"), and a link can pick one: resume.html?view=functional
 * Printing prints whichever format is showing. "Download this page (PDF)" ([data-resume-pdf]) does the
 * same through the print window, with a file name that says which format it is.
 *
 * SECTIONS: a small "Sections" drop-down (left of Print) does two jobs: the checkbox beside each
 * part of the resume (Summary, Education, Awards...) shows or hides it, on screen AND when
 * printed; clicking a section's name jumps straight to it (turning it back on if it was hidden).
 * Each <h2> and everything after it (until the next <h2>) is one section; the choice is
 * remembered in this browser (localStorage "resume-sections").
 */
(function () {
    var KEY = 'resume-view';

    function apply(view) {
        if (view !== 'functional') view = 'traditional';
        document.querySelectorAll('.resume-view').forEach(function (el) {
            el.hidden = el.getAttribute('data-view') !== view;
        });
        document.querySelectorAll('.resume-switch-btn').forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view));
        });
        try { localStorage.setItem(KEY, view); } catch (e) {}
    }

    // "Download this page (PDF)": the print window's "Save as PDF", named for the format showing
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-resume-pdf]');
        if (!b) return;
        var view = (document.querySelector('.resume-switch-btn[aria-pressed="true"]') || {}).textContent || '';
        var old = document.title;
        document.title = 'Joseph VanWagner Resume' + (view.trim() ? ' (' + view.trim() + ')' : '');
        var hint = document.getElementById('pdf-hint');
        if (!hint) {
            hint = document.createElement('p');
            hint.id = 'pdf-hint'; hint.className = 'pdf-hint no-print'; hint.setAttribute('role', 'status');
            b.parentNode.insertAdjacentElement('afterend', hint);
        }
        hint.textContent = 'In the print window, choose "Save as PDF" (or "Microsoft Print to PDF") as the printer.';
        setTimeout(function () { window.print(); document.title = old; }, 250);
    });

    var SKEY = 'resume-sections';

    /** Wrap each <h2> and the content after it into <section class="rsec" data-sec="Name">. */
    function wrapSections() {
        var names = [];
        document.querySelectorAll('.panel-body, .resume-view').forEach(function (box) {
            var kids = Array.prototype.slice.call(box.children), cur = null;
            kids.forEach(function (el) {
                if (el.tagName === 'H2') {
                    var name = el.textContent.trim();
                    cur = document.createElement('section');
                    cur.className = 'rsec';
                    cur.setAttribute('data-sec', name);
                    box.insertBefore(cur, el);
                    if (names.indexOf(name) === -1) names.push(name);
                }
                if (el.classList && el.classList.contains('resume-view')) { cur = null; return; }
                if (cur) cur.appendChild(el);
            });
        });
        // list them in page order (top to bottom), not in the order they were wrapped
        names = [];
        document.querySelectorAll('.rsec').forEach(function (sec) {
            var n = sec.getAttribute('data-sec');
            if (names.indexOf(n) === -1) names.push(n);
        });
        return names;
    }

    function hiddenSections() {
        try { return JSON.parse(localStorage.getItem(SKEY) || '[]'); } catch (e) { return []; }
    }

    function applySections(hidden) {
        document.querySelectorAll('.rsec').forEach(function (sec) {
            sec.hidden = hidden.indexOf(sec.getAttribute('data-sec')) !== -1;
        });
        try { localStorage.setItem(SKEY, JSON.stringify(hidden)); } catch (e) {}
    }

    /** The compact "Sections" drop-down, placed just left of the Print button. */
    function buildPicker(names) {
        var row = document.querySelector('.btn-row.no-print');
        if (!row || !names.length) return;
        var hidden = hiddenSections();
        var esc = function (n) { return n.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); };
        var d = document.createElement('details');
        d.className = 'print-sections';
        d.innerHTML = '<summary class="btn" title="Jump to a part of the resume, or choose which parts to show and print">Sections ▾</summary>' +
            '<div class="ps-menu"><p>Tick to show &amp; print; click a name to jump there</p>' +
            names.map(function (n) {
                return '<div class="ps-row"><input type="checkbox" value="' + esc(n) + '"' + (hidden.indexOf(n) === -1 ? ' checked' : '') +
                    ' title="Show and print this section" aria-label="Show ' + esc(n) + '">' +
                    '<button type="button" class="ps-go" data-go="' + esc(n) + '" title="Jump to ' + esc(n) + '">' + esc(n) + '</button></div>';
            }).join('') +
            '<div class="ps-actions"><button type="button" data-all="1" title="Show every section">All</button><button type="button" data-all="0" title="Hide every section">None</button></div></div>';
        row.insertBefore(d, row.firstElementChild);     // left of "Print this page"
        var sync = function () {
            var off = Array.prototype.slice.call(d.querySelectorAll('input')).filter(function (i) { return !i.checked; }).map(function (i) { return i.value; });
            applySections(off);
        };
        d.addEventListener('change', sync);
        d.addEventListener('click', function (e) {
            var b = e.target.closest('[data-all]');
            if (b) {
                d.querySelectorAll('input').forEach(function (i) { i.checked = b.getAttribute('data-all') === '1'; });
                sync();
                return;
            }
            var go = e.target.closest('[data-go]');
            if (go) {
                var name = go.getAttribute('data-go');
                var box = go.parentNode.querySelector('input');
                if (box && !box.checked) { box.checked = true; sync(); }      // jumping to a hidden section shows it
                // the visible copy (some sections exist in both the traditional and functional views)
                var target = Array.prototype.slice.call(document.querySelectorAll('.rsec')).filter(function (sec) {
                    return sec.getAttribute('data-sec') === name && sec.offsetParent !== null;
                })[0];
                d.open = false;
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        document.addEventListener('click', function (e) { if (d.open && !d.contains(e.target)) d.open = false; });
        applySections(hidden);
    }

    document.addEventListener('DOMContentLoaded', function () {
        buildPicker(wrapSections());
        var asked = new URLSearchParams(location.search).get('view');
        var saved = null;
        try { saved = localStorage.getItem(KEY); } catch (e) {}
        apply(asked || saved || 'traditional');
        document.querySelectorAll('.resume-switch-btn').forEach(function (b) {
            b.addEventListener('click', function () { apply(b.getAttribute('data-view')); });
        });
    });
})();
