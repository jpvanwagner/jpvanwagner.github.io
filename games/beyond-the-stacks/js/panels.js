/* JS/PANELS.JS - Collapsible panels, plus full screen.

   Every panel (Community Pulse, the schedule, the facility map, the program cards) has a
   chevron in its header that folds it away; the header's "collapse all / expand all"
   button folds or unfolds them all at once. A folded side panel becomes a narrow strip
   with its title running down it (click the strip to open it again); the folded deck
   keeps just its header. Whatever's left open takes the room. Remembered in the browser
   (localStorage 'bts-collapsed').

   The full-screen button sits beside the sound button, so the game needs no buttons
   laid over it when it's embedded in another page. */

window.Panels = (function () {
  const KEY = 'bts-collapsed';
  const IDS = ['feed-panel', 'calendar-panel', 'map-panel', 'deck-panel'];
  const SIDE = ['feed-panel', 'calendar-panel', 'map-panel'];
  // each workspace column when open; the one that flexes is the first open of: schedule, map, feed
  const OPEN = { 'feed-panel': 'minmax(230px, 270px)', 'calendar-panel': 'minmax(380px, 1fr)', 'map-panel': 'minmax(380px, 42%)' };
  const STRIP = '32px';
  const narrow = window.matchMedia('(max-width: 1020px)');
  let collapsed = new Set();

  function load() { try { collapsed = new Set(JSON.parse(localStorage.getItem(KEY) || '[]').filter(id => IDS.includes(id))); } catch (e) { collapsed = new Set(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify([...collapsed])); } catch (e) { /* private mode */ } }
  const titleOf = (id) => { const h = document.querySelector('#' + id + ' h2'); return h ? h.textContent.trim() : id; };

  function apply() {
    IDS.forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      const c = collapsed.has(id);
      el.classList.toggle('collapsed', c);
      const b = el.querySelector('.collapse-btn');
      if (b) {
        b.innerHTML = Icons.svg(c ? (id === 'deck-panel' ? 'chevron-up' : 'chevron-right') : 'chevron-down');
        b.setAttribute('aria-expanded', String(!c));
        b.setAttribute('aria-label', (c ? 'Expand ' : 'Collapse ') + titleOf(id));
        b.dataset.tip = (c ? 'Expand' : 'Collapse') + '|' + titleOf(id);
      }
    });
    const ws = document.getElementById('workspace');
    const allSide = SIDE.every(id => collapsed.has(id));
    ws.classList.toggle('all-folded', allSide && !narrow.matches);
    if (narrow.matches || !SIDE.some(id => collapsed.has(id))) ws.style.gridTemplateColumns = '';
    else if (allSide) ws.style.gridTemplateColumns = SIDE.map(() => STRIP).join(' ') + ' minmax(0, 1fr)';
    else {
      const flex = ['calendar-panel', 'map-panel', 'feed-panel'].find(id => !collapsed.has(id));
      ws.style.gridTemplateColumns = SIDE.map(id => collapsed.has(id) ? STRIP : id === flex ? 'minmax(0, 1fr)' : OPEN[id]).join(' ');
    }
    document.getElementById('app').classList.toggle('deck-collapsed', collapsed.has('deck-panel'));
    const all = document.getElementById('btn-collapse-all');
    if (all) {
      const allShut = IDS.every(id => collapsed.has(id));
      all.innerHTML = Icons.svg(allShut ? 'arrows-maximize' : 'arrows-minimize');
      all.dataset.tip = allShut ? 'Expand all panels' : 'Collapse all panels|Fold every panel away; click a folded panel to open it again.';
      all.setAttribute('aria-label', allShut ? 'Expand all panels' : 'Collapse all panels');
    }
    // the map canvas / 3D view need to know their new size
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  function set(id, shut) { if (shut) collapsed.add(id); else collapsed.delete(id); save(); apply(); }
  function toggle(id) { set(id, !collapsed.has(id)); if (window.Sfx) Sfx.play('tick'); }
  function toggleAll() {
    const shut = !IDS.every(id => collapsed.has(id));
    collapsed = shut ? new Set(IDS) : new Set();
    save(); apply();
    if (window.Sfx) Sfx.play('tick');
  }

  // ---------------------------------------------------------------- full screen
  // Where the browser won't go full screen (an embedding page that doesn't allow it, iPhone
  // Safari), the button opens the game in a window of its own instead.
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const canFs = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const embedded = () => { try { return window.top !== window; } catch (e) { return true; } };
  function openWindow() {
    const w = window.open(location.href, '_blank', 'noopener');
    if (!w && window.Game && Game.toast) Game.toast('Your browser blocked the new window. Try your browser\'s own full-screen key (F11).', 'info');
  }
  function toggleFullscreen() {
    const root = document.documentElement;
    if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (!canFs()) { if (embedded()) openWindow(); else if (window.Game && Game.toast) Game.toast('This browser can\'t go full screen here. Try its own full-screen key (F11).', 'info'); return; }
    try {
      const r = (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
      if (r && r.catch) r.catch(() => { if (embedded()) openWindow(); });
    } catch (e) { if (embedded()) openWindow(); }
  }
  function syncFullscreen() {
    const b = document.getElementById('btn-fullscreen'); if (!b) return;
    const on = !!fsEl();
    b.innerHTML = Icons.svg(on ? 'minimize' : 'maximize');
    b.dataset.tip = on ? 'Exit full screen' : canFs() ? 'Full screen' : 'Open the game in its own window';
    b.setAttribute('aria-label', b.dataset.tip);
  }

  function init() {
    load();
    IDS.forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      const head = el.querySelector('.panel-head, .deck-head'); if (!head) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'collapse-btn';
      b.addEventListener('click', e => { e.stopPropagation(); toggle(id); });
      head.insertBefore(b, head.firstChild);
      // a folded panel opens again from anywhere on its header strip
      head.addEventListener('click', e => { if (collapsed.has(id) && !e.target.closest('button:not(.collapse-btn), a, input, select')) toggle(id); });
    });
    const all = document.getElementById('btn-collapse-all');
    if (all) all.addEventListener('click', toggleAll);
    const fs = document.getElementById('btn-fullscreen');
    if (fs) {
      fs.addEventListener('click', toggleFullscreen);
      document.addEventListener('fullscreenchange', syncFullscreen);
      document.addEventListener('webkitfullscreenchange', syncFullscreen);
      syncFullscreen();
    }
    (narrow.addEventListener ? narrow.addEventListener('change', apply) : narrow.addListener(apply));
    apply();
  }

  return { init, toggle, toggleAll, set, isCollapsed: (id) => collapsed.has(id), toggleFullscreen };
})();
