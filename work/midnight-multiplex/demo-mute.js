/* ============================================================================
 *  demo-mute.js  —  PORTFOLIO ADD-ON: a one-click mute button for the web demo
 * ----------------------------------------------------------------------------
 *  Added for jvanwagner.neocities.org (not part of the generated demo build, so
 *  re-add the <script> tag in index.html if the demo is rebuilt).
 *
 *  The game makes its sound through several Web Audio contexts (title theme,
 *  opening crawl, sound effects, dialogue blips). This file loads FIRST and
 *  quietly puts a master volume knob in front of every context's speakers, so
 *  the button mutes everything at once, whatever is playing. The choice is
 *  remembered in this browser (localStorage "mm-demo-muted").
 *  The game's own audio setting (F6 / Settings > Audio) still works as before.
 * ========================================================================== */
(function () {
  'use strict';
  var KEY = 'mm-demo-muted';
  var muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var masters = [];

  // 1. Route every AudioContext's output through its own master gain node.
  var Base = window.BaseAudioContext || window.AudioContext || window.webkitAudioContext;
  if (Base && Base.prototype) {
    var desc = Object.getOwnPropertyDescriptor(Base.prototype, 'destination');
    if (desc && desc.get) {
      Object.defineProperty(Base.prototype, 'destination', {
        configurable: true,
        get: function () {
          var real = desc.get.call(this);
          if (!this.__mmMaster) {
            try {
              var g = this.createGain();
              g.gain.value = muted ? 0 : 1;
              g.connect(real);
              this.__mmMaster = g;
              masters.push(g);
            } catch (e) { return real; }
          }
          return this.__mmMaster;
        }
      });
    }
  }

  function apply() {
    masters.forEach(function (g) { try { g.gain.value = muted ? 0 : 1; } catch (e) {} });
    document.querySelectorAll('audio, video').forEach(function (m) { m.muted = muted; });
    var b = document.getElementById('mm-mute');
    if (b) {
      b.innerHTML = muted
        ? '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor"/><path d="M11 6l4 4M15 6l-4 4" stroke="#ff6b5a" stroke-width="1.8"/></svg>'
        : '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor"/><path d="M11 6.5c1 1 1 2 0 3M13 4.5c2 2 2 5 0 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
      b.title = muted ? 'Sound is off: click to turn it on' : 'Mute all sound';
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', String(muted));
    }
  }

  // 2. The button: top-right corner, above everything (including the click-to-play card).
  function addButton() {
    if (document.getElementById('mm-mute')) return;
    var st = document.createElement('style');
    st.textContent =
      '#mm-mute{position:fixed;top:8px;right:8px;z-index:100000;width:34px;height:34px;display:flex;' +
      'align-items:center;justify-content:center;padding:0;cursor:pointer;color:#f1c84b;' +
      'background:rgba(5,6,10,.72);border:1px solid #6b2a6f;border-radius:6px;opacity:.75;transition:opacity .15s}' +
      '#mm-mute:hover,#mm-mute:focus-visible{opacity:1;border-color:#c9a227}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'mm-mute'; b.tabIndex = -1;
    // don't take keyboard focus away from the game (it's typed commands + WASD)
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function (e) {
      e.stopPropagation();                 // so it doesn't also count as "click to play"
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (err) {}
      apply();
    });
    document.body.appendChild(b);
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton); else addButton();

  window.MMDemoMute = { toggle: function () { var b = document.getElementById('mm-mute'); if (b) b.click(); }, get muted() { return muted; } };
})();
