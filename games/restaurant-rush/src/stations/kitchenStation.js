// Line-cook minigame. Start a plate from a ticket, build it from the bins, fire pasta, meatballs
// and calamari, pull them at the right moment, turn pizzas and meatballs halfway, send to the pass.
import { G, bus } from '../state.js';
import { CFG } from '../config.js';
import { COOKED, BINS, DISHES, componentInfo } from '../data/menu.js';
import { openTickets, ticketAge } from '../sim/tickets.js';
import * as K from '../sim/kitchen.js';
import { slotWorldPos } from '../render/props.js';
import { world } from '../render/world.js';
import { KITCHEN } from '../data/layout.js';
import { toScreen } from '../render/scene.js';
import { h, hex } from '../ui/dom.js';
import { go } from '../ui/views.js';

let parts = null, dirty = true;
const hotspots = new Map();

const EMPTY_ACTIONS = {
  oven: [['Bake pizza', () => K.bakeActive()]],
  pot: [['Spaghetti', () => K.drop('pot', 'spaghetti')], ['Fettuccine', () => K.drop('pot', 'fettuccine')]],
  pan: [['Meatballs', () => K.drop('pan', 'meatballs')]],
  fryer: [['Calamari', () => K.drop('fryer', 'calamari')]],
};
const STATION_NAMES = { oven: 'Oven', pot: 'Pot', pan: 'Pan', fryer: 'Fryer' };

function mount(el) {
  parts = { left: h('div.panel.st-left'), bottom: h('div.panel.st-bottom'), hot: h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }) };
  el.append(parts.hot, parts.left, parts.bottom);
  dirty = true;
}
function unmount() { parts = null; hotspots.clear(); }

bus.on('kitchen:change', () => { dirty = true; });
bus.on('ticket:new', () => { dirty = true; });
bus.on('ticket:update', () => { dirty = true; });

function renderTickets() {
  const tix = openTickets('food');
  parts.left.replaceChildren(...[
    h('div.panel-title', {}, 'Ticket rail'),
    tix.length ? null : h('div.empty', {}, 'No food tickets. Wipe down the line.'),
    ...tix.map((t) => {
      const age = ticketAge(t) / CFG.secondsPerGameMinute;
      return h(`div.ticket${age > 35 ? '.late' : age > 20 ? '.old' : ''}`, {},
        h('div.ticket-head', {}, h('span', {}, `${t.tableLabel} · ${t.partyName}`), h('small', {}, `${Math.floor(age)}m`)),
        t.items.map((it, i) => h(`button.titem${it.done ? '.done' : ''}${it.inProgress ? '.prog' : ''}`, {
          disabled: it.done || it.inProgress, onclick: () => K.startPlate(t.id, i),
          title: it.crew && it.inProgress ? 'The crew is cooking this one' : it.inProgress ? 'Already on the counter' : 'Start a plate for this',
        }, h('span', {}, DISHES[it.key].short), h('span.seat', {}, it.crew && it.inProgress ? 'crew cooking' : it.inProgress ? 'plating' : `seat ${it.seat + 1}`))));
    }),
  ].filter(Boolean));
}

function renderBottom() {
  const k = G.kitchen;
  const active = K.activePlate();
  const need = active ? DISHES[active.dish].build : [];
  const plateCard = (p) => {
    const dish = DISHES[p.dish];
    const have = p.comps.map((c) => c.key);
    const chips = [
      ...dish.build.map((key) => h(`span${have.includes(key) ? '.have' : ''}`, {}, componentInfo(key).name)),
      ...have.filter((key) => !dish.build.includes(key)).map((key) => h('span.extra', {}, `+${componentInfo(key).name}`)),
    ];
    if (dish.bake) chips.push(h(`span${p.baked ? '.have' : ''}`, {}, p.inOven ? 'in oven…' : p.baked ? `baked ${Math.round(p.bakeQ * 100)}%` : 'bake'));
    return h(`div.plate-card${p.id === k.activePlateId ? '.active' : ''}`, { onclick: () => K.selectPlate(p.id) },
      h('div.pc-name', {}, h('span', {}, dish.short), h('small', {}, G.tickets.find((t) => t.id === p.ticketId)?.tableLabel || '')),
      h('div.pc-comps', {}, chips),
      h('div.pc-actions', {},
        dish.bake && !p.baked && !p.inOven ? h('button.btn', { onclick: (e) => { e.stopPropagation(); K.selectPlate(p.id); K.bakeActive(); } }, 'Into oven') : null,
        h('button.btn.btn-primary', { disabled: p.inOven, onclick: (e) => { e.stopPropagation(); K.sendPlate(p.id); } }, 'Send ▸'),
        h('button.btn', { onclick: (e) => { e.stopPropagation(); K.trashPlate(p.id); }, title: 'Bin it and start over' }, '✕'),
      ));
  };
  parts.bottom.replaceChildren(
    h('div.row', {},
      h('div.col.grow', {}, h('h4', {}, active ? `Add to the ${DISHES[active.dish].short}` : 'Ingredients (pick a plate first)'),
        h('div.grid-btns', {}, Object.entries(BINS).map(([key, b]) => h(`button.ing${need.includes(key) && !active.comps.some((c) => c.key === key) ? '.need' : ''}`, { onclick: () => K.addBin(key) },
          h('span.sw', { style: { background: hex(b.color) } }), b.name)))),
      h('div.col', {}, h('h4', {}, ' '), h('button.btn.btn-dark', { onclick: () => go('floor') }, 'Floor')),
    ),
    h('div.pad-section.row', {}, h('div.col.grow', {}, h('h4', {}, `On the counter (${k.plates.length}/${CFG.maxPlates})`),
      h('div.grid-btns', {}, k.plates.length ? k.plates.map(plateCard) : h('div.empty', {}, 'Click a dish on a ticket to start a plate.'))),
    k.warmer.length ? h('div.col', { style: { maxWidth: '46%' } }, h('h4', {}, 'Warmer (click to plate)'),
      h('div.grid-btns', {}, k.warmer.map((w) => {
        const q = Math.round(w.quality * 100);
        return h(`button.ing.warm${q >= 95 ? '.good' : q < 50 ? '.bad' : ''}`, { onclick: () => K.addFromWarmer(w.id), title: `${COOKED[w.key].name}, ${q}%` },
          COOKED[w.key].name, h('small', {}, ` ${q}%`),
          h('span.k-bin', { title: 'Throw it out', onclick: (e) => { e.stopPropagation(); K.trashWarmer(w.id); } }, '×'));
      }))) : null),
  );
}

function hotspot(key) {
  let el = hotspots.get(key);
  if (!el) {
    el = h('div.khot');
    parts.hot.append(el);
    hotspots.set(key, el);
  }
  return el;
}

function place(el, x, y, z) {
  const sp = toScreen(x, y, z);
  if (!sp) { el.style.display = 'none'; return false; }
  el.style.display = '';
  el.dataset.x = sp.x;
  el.dataset.y = sp.y;
  return true;
}

/** One "add" chip per station, on the front of its counter, with how many spots are free. */
function stationChip(station) {
  const slots = G.kitchen.slots[station];
  const free = slots.filter((s) => !s).length;
  const el = hotspot(`add-${station}`);
  if (!free) { el.style.display = 'none'; return; }
  const k = KITCHEN[station];
  if (!place(el, k.x, station === 'oven' ? 1.0 : 0.82, k.z + k.d / 2 + 0.02)) return;
  const sig = `${station}${free}`;
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  el.className = 'khot add';
  el.onclick = null;
  el.replaceChildren(h('div.k-name', {}, `${STATION_NAMES[station]} · ${free} free`), h('div.grid-btns', {},
    EMPTY_ACTIONS[station].map(([label, fn]) => h('button.ing', { onclick: (e) => { e.stopPropagation(); fn(); } }, label))));
}

function slotHotspot(station, i, s) {
  const key = `${station}${i}`;
  const el = hotspot(key);
  if (!s) { el.style.display = 'none'; return; }
  const pos = slotWorldPos(station, i);
  if (!pos || !place(el, pos.x, pos.y + (station === 'oven' ? 0.5 : 0.3), pos.z)) return;
  let sig, build;
  {
    const def = COOKED[s.key];
    const stage = K.cookStage(def, s.t);
    const turn = K.needsTurn(def, s);
    const plate = s.plateId && G.kitchen.plates.find((p) => p.id === s.plateId);
    const name = s.key === 'pizza' ? (plate ? DISHES[plate.dish].short : 'Pizza') : def.name;
    const label = turn ? (s.key === 'pizza' ? 'TURN IT!' : 'TOSS IT!') : { cooking: 'cooking…', perfect: 'PULL NOW', over: 'overdone', burnt: 'BURNT' }[stage];
    sig = `${s.key}${stage}${turn}${Math.round((s.t / def.ruin) * 40)}`;
    build = () => {
      el.className = `khot ${turn ? 'turn' : stage}`;
      el.onclick = () => K.tapSlot(station, i);
      const pct = Math.min(100, (s.t / def.ruin) * 100);
      const color = stage === 'perfect' ? '#5fbf7a' : stage === 'cooking' ? '#ffd36b' : stage === 'over' ? '#e08a2a' : '#d23a2a';
      el.replaceChildren(h('div.k-name', {}, name, ' ', h('span.k-state', {}, label)),
        h('div.bar', {}, h('span.win', { style: { left: `${(def.done / def.ruin) * 100}%`, width: `${(def.hold / def.ruin) * 100}%` } }),
          h('i', { style: { width: `${pct}%`, background: color } })));
    };
  }
  if (el.dataset.sig !== sig) { el.dataset.sig = sig; build(); }
}

/** Push overlapping labels apart: each label keeps its x and moves up (or, for the counter
 *  chips, down) until it clears the ones already placed. Labels also stay clear of the ticket
 *  rail on the left and the panel along the bottom. */
function declutter() {
  const host = parts.hot.getBoundingClientRect();
  // Keep labels clear of the bottom panel: anything that would land behind it sits just above.
  const floor = parts.bottom.getBoundingClientRect().top - host.top - 4;
  const wall = parts.left.getBoundingClientRect().right - host.left + 4;   // and clear of the ticket rail
  const items = [];
  for (const el of hotspots.values()) {
    if (el.style.display === 'none' || el.dataset.x == null) continue;
    const w = el.offsetWidth, hgt = el.offsetHeight;
    const below = el.classList.contains('add');
    const x = Math.max(wall + w / 2, Math.min(host.width - w / 2 - 4, +el.dataset.x));
    const y = +el.dataset.y;
    // Box as [left, top, right, bottom] in stage pixels.
    items.push({ el, below, w, h: hgt, x, top: Math.min(below ? y + 4 : y - hgt, floor - hgt) });
  }
  // Counter chips first (they anchor to fixed hardware), then the rest, lowest first.
  items.sort((a, b) => (b.below - a.below) || (b.top - a.top));
  const placed = [];
  const GAP = 3;
  for (const it of items) {
    for (let pass = 0; pass < 12; pass++) {
      const hit = placed.find((p) => Math.abs(p.x - it.x) * 2 < p.w + it.w + GAP && it.top < p.top + p.h + GAP && it.top + it.h + GAP > p.top);
      if (!hit) break;
      it.top = it.below && hit.top + hit.h + GAP + it.h <= floor ? hit.top + hit.h + GAP : hit.top - it.h - GAP;
    }
    placed.push(it);
    it.el.style.left = `${it.x - it.w / 2}px`;
    it.el.style.top = `${Math.max(2, it.top)}px`;
  }
}

let warmAcc = 0;
function update(realDt) {
  if (!parts) return;
  if ((warmAcc += realDt) > 1 && G.kitchen.warmer.length) { warmAcc = 0; dirty = true; }
  if (dirty) { dirty = false; renderTickets(); renderBottom(); }
  for (const station of Object.keys(G.kitchen.slots)) stationChip(station);
  for (const [station, slots] of Object.entries(G.kitchen.slots)) slots.forEach((s, i) => slotHotspot(station, i, s));
  declutter();
}

export default { mount, unmount, update };
