/* ============================================================================
 *  portfolio-samples.js  —  PORTFOLIO ADD-ON: sample maps for the web demo
 * ----------------------------------------------------------------------------
 *  Added for jvanwagner.neocities.org (not part of Mapster itself, so re-add
 *  the <script> tag at the end of mapster.html if this copy is refreshed from
 *  the TOOL--Mapster repo).
 *
 *  Puts an "Open a sample map" dropdown under LOAD PROJECT, so visitors have
 *  something to explore without a map file of their own. Each sample is a
 *  normal map file in maps/samples/, fed through Mapster's own loadProject(),
 *  exactly as if it had been picked with LOAD PROJECT.
 *
 *  mapster.html?sample=<id> opens that sample straight away, without the
 *  "Project loaded" message (the portfolio page's embed uses this).
 *
 *  Samples need the page to be served over http(s) (fetch is blocked on
 *  file://); opened from disk, the dropdown says so instead.
 * ========================================================================== */
(function () {
  'use strict';

  // id = file name in maps/samples/ (without .html); label = what the dropdown shows.
  var SAMPLES = [
    { id: 'sunrise',     label: 'Movie theater (2 floors)' },
    { id: 'parking_lot', label: 'Parking lot' }
  ];

  function openSample(id, quiet) {
    return fetch('maps/samples/' + id + '.html')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        var file = new File([text], id + '.html', { type: 'text/html' });
        var realAlert = window.mapsterAlert;
        if (quiet) {
          // loadProject() reports success with mapsterAlert(); skip that one message.
          window.mapsterAlert = function (msg, title) {
            if (/loaded successfully/i.test(String(msg))) { window.mapsterAlert = realAlert; return Promise.resolve(true); }
            return realAlert(msg, title);
          };
        }
        loadProject({ files: [file] });
      })
      .catch(function () {
        window.mapsterAlert('Sample maps need the page to be opened from a web server. Use LOAD PROJECT to open a map file instead.', 'Sample maps');
      });
  }

  function addPicker() {
    var loadBtn = document.getElementById('importProject');
    if (!loadBtn) return;
    var row = loadBtn.parentNode;   // the LOAD PROJECT row in the sidebar
    var select = document.createElement('select');
    select.id = 'sampleMapPicker';
    select.title = 'Open one of the sample maps';
    // Class string copied from an existing Mapster dropdown, so the pre-built
    // vendor/tailwind.css already has every class it uses.
    select.className = 'w-full bg-black p-1.5 rounded text-white text-xs border border-gray-600 mb-2 outline-none';
    select.innerHTML = '<option value="">Open a sample map…</option>' +
      SAMPLES.map(function (s) { return '<option value="' + s.id + '">' + s.label + '</option>'; }).join('');
    select.addEventListener('change', function () {
      if (!select.value) return;
      openSample(select.value, false);
      select.value = '';
    });
    row.parentNode.insertBefore(select, row.nextSibling);
    row.classList.remove('mb-4');   // keep the old spacing: the dropdown now sits under the row
    row.classList.add('mb-2');
    select.classList.remove('mb-2');
    select.classList.add('mb-4');
  }

  function start() {
    addPicker();
    var m = /[?&]sample=([a-z_]+)/.exec(location.search);
    if (m && SAMPLES.some(function (s) { return s.id === m[1]; })) openSample(m[1], true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
