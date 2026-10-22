// Switching between the overhead floor and the zoomed-in stations.
import { G, bus, tableById } from '../state.js';
import { setView, resize } from '../render/scene.js';
import { $ } from './dom.js';

const stations = {};
let current = null;
let token = 0;

// Each station is its own module exporting { mount(el, arg), unmount(), update(realDt) }, loaded
// the first time it's opened. (The dev server fetches them then; the build bundles them into the
// one game script, and these imports just resolve at once.)
const FILES = {
  table: () => import('../stations/order.js'),
  bar: () => import('../stations/barStation.js'),
  kitchen: () => import('../stations/kitchenStation.js'),
};
const load = (view) => FILES[view]().then((m) => { stations[view] = m.default; });
/** Fetch every station in the background (called once a shift starts) so the first visit is instant. */
export function preloadStations() {
  return Promise.all(Object.keys(FILES).map((v) => load(v).catch(() => null)));
}

export function go(view, arg = null) {
  if (view === 'office') { bus.emit('office:open'); return; }
  if (G.view === view && G.viewTableId === (arg ?? null)) return;
  const ui = $('#station-ui');
  current?.unmount?.();
  ui.innerHTML = '';
  G.view = view;
  G.viewTableId = view === 'table' ? arg : null;
  const t = view === 'table' ? tableById(arg) : null;
  // Close-ups use the full width (the side panels hide); the floor map keeps them.
  document.body.classList.toggle('station-view', view !== 'floor');
  resize();
  setView(view, t);
  current = null;
  const mine = ++token;
  const mount = () => {
    if (mine !== token) return;            // the player moved on while it loaded
    current = stations[view] || null;
    current?.mount?.(ui, arg);
  };
  if (stations[view] || !FILES[view]) mount();
  else {
    load(view).then(mount).catch(() => {
      bus.emit('toast', { kind: 'bad', text: 'That station could not load. Check your connection and try again.' });
      if (mine === token) go('floor');
    });
  }
  document.querySelectorAll('.view-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  bus.emit('view', view);
}

export function updateStation(realDt) { current?.update?.(realDt); }
