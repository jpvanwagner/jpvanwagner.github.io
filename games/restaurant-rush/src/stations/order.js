// Server minigame: zoom down to the table, listen to each guest, and key their order in.
// The speech bubble fades after a few seconds — ask them to repeat it and it costs you a little mood.
import { G, bus, partyById, tableById } from '../state.js';
import { DISHES, DRINKS, FOOD_KEYS, DRINK_KEYS } from '../data/menu.js';
import { toScreen } from '../render/scene.js';
import { submitOrder } from '../sim/guests.js';
import { pick } from '../data/names.js';
import { h, modalOpen } from '../ui/dom.js';
import { go } from '../ui/views.js';

const LISTEN_SECS = 4.5;   // real seconds a line stays readable
const PARDON_COST = 4;

let st = null;

function linesFor(p) {
  if (p.lines) return p.lines;
  p.lines = p.wants.map((w) => {
    const f = pick(DISHES[w.food].says);
    if (!w.drink) {
      return pick([
        `I'll have ${f}. Just water for me.`,
        `Could I get ${f}? Water's fine.`,
        `${cap(f)}, please. Nothing to drink, thanks.`,
      ]);
    }
    const d = pick(DRINKS[w.drink].says);
    return pick([
      `I'll have ${f}, and ${d}.`,
      `Could I start with ${d}? And then ${f}.`,
      `${cap(f)} for me. Oh — and ${d}.`,
      `Hmm... ${d}, and ${f}, please.`,
    ]);
  });
  return p.lines;
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function mount(el, tableId) {
  const t = tableById(tableId);
  const p = t && partyById(t.partyId);
  if (!p || p.state !== 'readyOrder') { st = null; return; }
  st = {
    el, t, p, seat: 0, bubbleLeft: 0, said: false,
    entered: p.wants.map((w) => ({ seat: w.seat, food: null, drink: undefined })),
    bubble: h('div.speech'),
  };
  linesFor(p);
  el.append(st.bubble);
  render();
  setTimeout(() => speak(0), 650); // after the camera lands
}

function speak(seat) {
  if (!st) return;
  st.seat = seat;
  st.bubble.textContent = `“${st.p.lines[seat]}”`;
  st.bubble.classList.remove('fading');
  st.bubbleLeft = LISTEN_SECS;
  st.said = true;
  render();
}

function pardon() {
  st.p.mood = Math.max(0, st.p.mood - PARDON_COST);
  bus.emit('toast', { kind: 'info', text: '"Sorry, could you say that again?"' });
  speak(st.seat);
}

function choose(kind, key) {
  const e = st.entered[st.seat];
  if (kind === 'food') e.food = key; else e.drink = key; // drink null = water
  if (e.food && e.drink !== undefined) {
    const next = st.entered.findIndex((x, i) => i > st.seat && (!x.food || x.drink === undefined));
    const any = next >= 0 ? next : st.entered.findIndex((x) => !x.food || x.drink === undefined);
    if (any >= 0) { render(); setTimeout(() => st && speak(any), 250); return; }
  }
  render();
}

function send() {
  const entered = st.entered.map((e) => ({ seat: e.seat, food: e.food, drink: e.drink ?? null }));
  submitOrder(st.p, entered);
  bus.emit('toast', { kind: 'good', text: `Order in for ${st.t.label}: ${entered.length} plate${entered.length > 1 ? 's' : ''}, ${entered.filter((e) => e.drink).length} drink(s).` });
  go('floor');
}

function render() {
  if (!st) return;
  const { p, t, entered, seat } = st;
  const e = entered[seat];
  const complete = entered.every((x) => x.food);
  const old = st.el.querySelector('.order-wrap');
  const panel = h('div.order-wrap', {}, h('div.panel', {},
    h('div.row', { style: { justifyContent: 'space-between', alignItems: 'baseline' } },
      h('div.panel-title', {}, `${t.label} · the ${p.name} party`),
      h('div.grid-btns', {},
        h('button.btn', { onclick: pardon, title: 'Ask them to repeat (costs a little mood)' }, 'Pardon?'),
        h('button.btn', { onclick: () => go('floor'), title: 'Esc' }, 'Back to floor'),
        h('button.btn.btn-primary', { onclick: send, disabled: !complete }, 'Send order ▸'),
      )),
    h('div.seat-tabs', {}, entered.map((x, i) => h(`button.seat-tab${i === seat ? '.cur' : ''}${x.food ? '.filled' : ''}`,
      { onclick: () => speak(i) },
      `Guest ${i + 1}${x.food ? ` · ${DISHES[x.food].short}${x.drink ? ` + ${DRINKS[x.drink].short || DRINKS[x.drink].name}` : x.drink === null ? ' + water' : ''}` : ''}`))),
    h('div.pad-section', {}, h('h4', {}, `Food for guest ${seat + 1}`),
      h('div.grid-btns', {}, FOOD_KEYS.map((k) => h(`button.ing${e.food === k ? '.on' : ''}`, { onclick: () => choose('food', k) }, DISHES[k].short)))),
    h('div.pad-section', {}, h('h4', {}, `Drink for guest ${seat + 1}`),
      h('div.grid-btns', {},
        h(`button.ing${e.drink === null ? '.on' : ''}`, { onclick: () => choose('drink', null) }, 'Water'),
        DRINK_KEYS.map((k) => h(`button.ing${e.drink === k ? '.on' : ''}`, { onclick: () => choose('drink', k) }, DRINKS[k].short || DRINKS[k].name)))),
  ));
  if (old) old.replaceWith(panel); else st.el.append(panel);
}

function update(realDt) {
  if (!st || st.p.state !== 'readyOrder') {
    // Nothing to order here (a manager visit, or they gave up): head back once no dialog is open.
    if (!modalOpen() && G.view === 'table') { st = null; go('floor'); }
    return;
  }
  const m = st.p.members[st.seat];
  const pos = m && toScreen(m.x, 1.55, m.z);
  if (pos && st.said) {
    st.bubble.style.display = '';
    st.bubble.style.left = `${pos.x}px`;
    st.bubble.style.top = `${pos.y}px`;
  } else st.bubble.style.display = 'none';
  if (!G.paused && st.bubbleLeft > 0) {
    st.bubbleLeft -= realDt;
    if (st.bubbleLeft <= 0) st.bubble.classList.add('fading');
  }
}

function unmount() { st = null; }

export default { mount, update, unmount };
