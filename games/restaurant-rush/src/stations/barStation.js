// Bartending minigame: pick a drink off the rail, choose the glass, ice, hold to pour each
// ingredient to the line, shake if it calls for it, garnish, and set it in the well.
import { G, bus } from '../state.js';
import { DRINKS, GLASSES, POURS, GARNISHES } from '../data/menu.js';
import { openTickets, ticketAge } from '../sim/tickets.js';
import * as bar from '../sim/bar.js';
import { barPourState } from '../render/props.js';
import { h, hex } from '../ui/dom.js';
import { go } from '../ui/views.js';
import { CFG } from '../config.js';

let root = null, parts = null, pouring = null, dirty = true;

function mount(el) {
  root = el;
  parts = {
    left: h('div.panel.st-left'),
    right: h('div.panel.st-right'),
    bottom: h('div.panel.st-bottom'),
  };
  el.append(parts.left, parts.right, parts.bottom);
  // Auto-pick the oldest open drink.
  if (!bar.targetDrink()) {
    const t = openTickets('drink')[0];
    if (t) bar.selectTarget(t.id, t.items.findIndex((i) => !i.done));
  }
  dirty = true;
  window.addEventListener('pointerup', stopPour);
}

function unmount() {
  stopPour();
  window.removeEventListener('pointerup', stopPour);
  root = parts = null;
}

function startPour(key) { pouring = key; barPourState.key = key; dirty = true; }
function stopPour() { if (!pouring) return; pouring = null; barPourState.key = null; dirty = true; }

bus.on('bar:change', () => { dirty = true; });
bus.on('ticket:new', () => { dirty = true; });
bus.on('ticket:update', () => { dirty = true; });

function renderTickets() {
  const tgt = G.bar.target;
  const tix = openTickets('drink');
  parts.left.replaceChildren(...[
    h('div.panel-title', {}, 'Drink rail'),
    tix.length ? null : h('div.empty', {}, 'No drink tickets. Nice and quiet.'),
    ...tix.map((t) => {
      const age = ticketAge(t) / CFG.secondsPerGameMinute;
      return h(`div.ticket${age > 25 ? '.late' : age > 14 ? '.old' : ''}`, {},
        h('div.ticket-head', {}, h('span', {}, `${t.tableLabel} · ${t.partyName}`), h('small', {}, `${Math.floor(age)}m`)),
        t.items.map((it, i) => {
          const mixing = it.inProgress && G.bar.auto?.ticketId === t.id && G.bar.auto.idx === i;
          const crew = it.inProgress && it.crew && !mixing;
          return h(`button.titem${it.done ? '.done' : ''}${mixing || crew ? '.auto' : ''}${tgt && tgt.ticketId === t.id && tgt.idx === i ? '.sel' : ''}`, {
            disabled: it.done || mixing || crew, onclick: () => bar.selectTarget(t.id, i),
          }, h('span', {}, DRINKS[it.key].short || DRINKS[it.key].name), h('span.seat', {}, mixing ? `${G.bar.auto.name} mixing…` : crew ? 'crew mixing…' : `seat ${it.seat + 1}`));
        }));
    }),
  ].filter(Boolean));
}

function renderRecipe() {
  const td = bar.targetDrink();
  if (!td) {
    parts.right.replaceChildren(h('div.panel-title', {}, 'Recipe'), h('div.empty', {}, 'Pick a drink from the rail on the left.'));
    return;
  }
  const { def } = td;
  const ev = bar.evaluateDrink(def);
  parts.right.replaceChildren(h('div.recipe', {},
    h('div.r-name', {}, def.name),
    h('div', { style: { color: 'var(--muted)', fontSize: '12px' } }, `for ${td.ticket.tableLabel}, seat ${td.item.seat + 1}`),
    h('ul', {}, ev.lines.map(([ok, text]) => h(`li.${ok ? 'ok' : 'bad'}`, {}, h('span', {}, text), h('span', {}, ok ? '✓' : '·')))),
    pouring && def.pours[pouring] ? gauge(def.pours[pouring], G.bar.pours[pouring] || 0) : null,
    h('div', { style: { marginTop: '6px', fontSize: '12px', color: 'var(--muted)' } }, `Quality if served now: ${Math.round(ev.q * 100)}%`),
  ));
}

function gauge(target, got) {
  const max = target * 1.6;
  return h('div', {}, h('div.gauge', {}, h('i', { style: { width: `${Math.min(100, (got / max) * 100)}%` } }), h('b', { style: { left: `${(target / max) * 100}%` } })),
    h('div', { style: { fontSize: '11px', color: 'var(--muted)' } }, `${POURS[pouring].name}: let go at the line`));
}

function renderControls() {
  const b = G.bar;
  const td = bar.targetDrink();
  const need = td?.def;
  const pourBtn = (k) => h(`button.ing${pouring === k ? '.pouring' : ''}${need?.pours[k] ? '.need' : ''}`, {
    onpointerdown: (e) => { e.preventDefault(); e.currentTarget.classList.add('pouring'); startPour(k); },
    onpointerleave: stopPour,
    title: 'Hold to pour',
  }, h('span.sw', { style: { background: hex(POURS[k].color) } }), POURS[k].name, b.pours[k] ? h('small', {}, ` ${b.pours[k].toFixed(1)}`) : null);
  parts.bottom.replaceChildren(
    h('div.row', {},
      h('div.col', {}, h('h4', {}, 'Glass'), h('div.grid-btns', {}, Object.entries(GLASSES).map(([k, g]) => h(`button.ing${b.glass === k ? '.on' : ''}`, { onclick: () => bar.setGlass(k) }, g.name)))),
      h('div.col', {}, h('h4', {}, 'Prep'), h('div.grid-btns', {},
        h(`button.ing${b.ice ? '.on' : ''}`, { onclick: bar.toggleIce }, 'Ice'),
        h(`button.ing${b.shaken ? '.on' : ''}`, { onclick: bar.shake }, 'Shake'),
      )),
      h('div.col', {}, h('h4', {}, 'Garnish'), h('div.grid-btns', {}, Object.entries(GARNISHES).map(([k, g]) => h(`button.ing${b.garnish === k ? '.on' : ''}`, { onclick: () => bar.setGarnish(k) }, h('span.sw', { style: { background: hex(g.color) } }), g.name)))),
      h('div.col', { style: { marginLeft: 'auto' } }, h('h4', {}, ' '), h('div.grid-btns', {},
        h('button.btn', { onclick: bar.dump }, 'Dump'),
        h('button.btn.btn-primary', { onclick: bar.serveDrink, disabled: !td || !b.glass }, 'Serve ▸'),
        h('button.btn.btn-dark', { onclick: () => go('floor') }, 'Floor'),
      )),
    ),
    h('div.pad-section', {}, h('h4', {}, 'Hold to pour (taps & bottles)'), h('div.grid-btns', {}, Object.keys(POURS).map(pourBtn))),
  );
}

let acc = 0;
function update(realDt) {
  if (!parts) return;
  if (pouring && !G.paused) bar.pour(pouring, realDt);
  acc += realDt;
  if (dirty || (pouring && acc > 0.08)) {
    acc = 0;
    dirty = false;
    renderTickets();
    renderRecipe();
    // Rebuilding the pour buttons mid-hold would drop the pointer, so only refresh them when idle.
    if (!pouring) renderControls();
  }
}

export default { mount, unmount, update };
