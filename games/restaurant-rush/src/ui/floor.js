// Front of house on the overhead map: the host stand queue, table labels, and the floor task list.
import { G, bus, partyById, tableById, ticketById, money } from '../state.js';
import { working, onRole } from '../sim/crew.js';
import { ROLES } from '../data/staff.js';
import { toScreen } from '../render/scene.js';
import { queue, canSeat, seatParty, presentCheck } from '../sim/guests.js';
import { queueJob } from '../sim/staff.js';
import { openTickets } from '../sim/tickets.js';
import { CFG, moodLabel } from '../config.js';
import { DISHES, DRINKS } from '../data/menu.js';
import { $, h, moodBar } from './dom.js';
import { go } from './views.js';

const labels = new Map();     // tableId → element
const qlabels = new Map();    // partyId → element
const zlabels = {};

// ── What each table needs from you ─────────────────────────────────────────
export function tableStatus(t) {
  const p = t.partyId && partyById(t.partyId);
  if (p?.complaint) return { cls: 'manager', text: 'Manager!', action: 'manager' };
  if (t.state === 'dirty') return t.bussing ? { cls: 'dirty', text: 'Bussing…' } : { cls: 'dirty', text: 'Dirty', action: 'bus' };
  if (!p) return { cls: 'clean', text: 'Open' };
  switch (p.state) {
    case 'toTable': return { cls: 'busy', text: 'Seating' };
    case 'menu': return { cls: 'busy', text: 'Reading menu' };
    case 'readyOrder': return { cls: 'order', text: 'Take order', action: 'order' };
    case 'waitFood': return { cls: 'busy', text: p.drinksIn || !p.hasDrinks ? 'Waiting on food' : 'Waiting' };
    case 'eating': return { cls: 'busy', text: p.drinksIn ? 'Eating' : 'Eating · no drinks' };
    case 'readyCheck': return { cls: 'check', text: 'Wants check', action: 'check' };
    case 'paying': return { cls: 'busy', text: 'Paying' };
    default: return { cls: 'busy', text: '' };
  }
}

/** Clicking a table on the map (or its chip / task) does the obvious thing. */
export function clickTable(id) {
  const t = tableById(id);
  if (!t) return;
  let sel = partyById(G.selectedPartyId);
  if (sel && sel.state !== 'queue' && sel.state !== 'arriving') { G.selectedPartyId = null; sel = null; }
  if (sel) {
    if (canSeat(sel, t)) { seatParty(sel, t); renderFloorPanels(); return; }
    if (t.cap < sel.size) return bus.emit('toast', { kind: 'bad', text: `${t.label} only seats ${t.cap}. The ${sel.name} party is ${sel.size}.` });
    if (t.state === 'dirty') return bus.emit('toast', { kind: 'info', text: `${t.label} needs bussing first.` });
    if (t.partyId) return bus.emit('toast', { kind: 'info', text: `${t.label} is taken.` });
  }
  const st = tableStatus(t);
  const p = partyById(t.partyId);
  if (st.action === 'manager') bus.emit('manager:visit', p);
  else if (st.action === 'order') go('table', t.id);
  else if (st.action === 'check') presentCheck(p);
  else if (st.action === 'bus') {
    queueJob({ type: 'bus', tableId: t.id });
    bus.emit('toast', { kind: 'info', text: `Busser to ${t.label}.` });
  } else if (p) {
    bus.emit('toast', { kind: 'info', text: `${t.label}: the ${p.name} party · ${moodLabel(p.mood).toLowerCase()} · ${st.text.toLowerCase()}.` });
  }
}

export function selectParty(id) {
  const p = partyById(id);
  if (!p || (p.state !== 'queue' && p.state !== 'arriving')) { G.selectedPartyId = null; renderFloorPanels(); return; }
  G.selectedPartyId = G.selectedPartyId === id ? null : id;
  if (G.view !== 'floor') go('floor');
  renderFloorPanels();
}

// ── Side panels (re-rendered a few times a second) ─────────────────────────
export function renderFloorPanels() {
  const q = queue();
  const sel = partyById(G.selectedPartyId);
  $('#queue-count').textContent = q.length ? `${q.length} waiting` : 'No one waiting';
  $('#host-hint').textContent = sel
    ? `Seat the ${sel.name} party (${sel.size}) — click a green table.`
    : 'Pick a party, then click an open table that fits them.';
  const list = $('#queue-list');
  list.replaceChildren(...(q.length ? q.map((p) => h(`li.party${p.id === G.selectedPartyId ? '.selected' : ''}`, { onclick: () => selectParty(p.id) },
    h('span.party-size', {}, p.size),
    h('span.party-name', {}, h('span', {}, p.critic ? h('span.critic-tag', {}, '★ Critic') : null, p.name), h('small', {}, `${Math.floor((G.time - p.arrivedAt) / CFG.secondsPerGameMinute)} min`)),
    moodBar(p.mood),
  )) : [h('li.empty', {}, 'The line is empty. Enjoy it while it lasts.')]));

  const tables = G.tables;
  $('#tables-open').textContent = `${tables.filter((t) => t.state === 'clean' && !t.partyId).length} open`;
  $('#table-chips').replaceChildren(...tables.map((t) => {
    const st = tableStatus(t);
    const fits = sel && canSeat(sel, t);
    return h(`button.tchip.${t.state === 'clean' && !t.partyId ? 'clean' : t.state === 'dirty' ? 'dirty' : 'busy'}${fits ? '.fits' : ''}`, { onclick: () => clickTable(t.id), title: st.text },
      t.label, h('small', {}, `${t.cap} · ${st.text.split(' ')[0]}`));
  }));

  // Tasks needing the player.
  const tasks = [];
  for (const t of tables) {
    const st = tableStatus(t);
    if (!st.action) continue;
    const p = partyById(t.partyId);
    const meta = {
      manager: ['☹', 'Talk to the guests', 'Manager visit'],
      order: ['✎', 'Take their order', 'Order'],
      check: ['$', 'Drop the check', 'Check'],
      bus: ['⌫', onRole('busser').length ? 'Busser will clear it' : 'Send someone to clear it', 'Bus'],
    }[st.action];
    tasks.push({ t, p, st, meta, urgent: p && p.mood < 40 });
  }
  const order = { manager: 0, order: 1, check: 2, bus: 3 };
  tasks.sort((a, b) => order[a.st.action] - order[b.st.action]);
  $('#task-count').textContent = tasks.length ? `${tasks.length} to do` : 'All good';
  $('#task-list').replaceChildren(...(tasks.length ? tasks.map(({ t, p, st, meta, urgent }) => h(`li.task.${st.action}${urgent ? '.urgent' : ''}`, { onclick: () => clickTable(t.id) },
    h('span.t-ico', {}, meta[0]),
    h('span.grow', {}, h('b', {}, `${t.label} · ${meta[2]}`), h('small', {}, p ? `${p.name} (${p.size}) — ${meta[1]}` : meta[1])),
    p ? moodBar(p.mood) : null,
  )) : [h('li.empty', {}, 'Nothing needs you on the floor right now.')]));

  // Ticket summary.
  const drinks = openTickets('drink'), food = openTickets('food');
  const nDrinks = drinks.reduce((n, t) => n + t.items.filter((i) => !i.done).length, 0);
  const nPlates = food.reduce((n, t) => n + t.items.filter((i) => !i.done).length, 0);
  const ready = G.tickets.filter((t) => t.status === 'ready' || t.status === 'carrying').length;
  $('#ticket-summary').replaceChildren(
    h('div.tix-row', {}, h('span', {}, 'Drinks to make'), h('b', {}, nDrinks)),
    h('div.tix-row', {}, h('span', {}, 'Plates to cook'), h('b', {}, nPlates)),
    h('div.tix-row', {}, h('span', {}, 'Waiting for a runner'), h('b', {}, ready)),
  );
  setBadge('#badge-bar', nDrinks, drinks.some((t) => G.time - t.createdAt > 40));
  setBadge('#badge-kitchen', nPlates, food.some((t) => G.time - t.createdAt > 60));
  renderAlertStrip(tasks, q);

  // Crew.
  const crew = working();
  $('#crew-list').replaceChildren(...(crew.length ? crew.map((p) => h('li', {},
    h('b', {}, `${p.name} `), h('span', {}, `${ROLES[p.role].name.toLowerCase()} · ${crewDoing(p)}`)))
    : [h('li.empty', {}, 'Just you today. Hire help in the office between shifts.')]));
}

/** At a station (side panels hidden), a compact strip of what's waiting on the floor. */
function renderAlertStrip(tasks, q) {
  const strip = $('#alert-strip');
  strip.hidden = G.view === 'floor' || !G.running;
  if (strip.hidden) return;
  const count = (a) => tasks.filter((t) => t.st.action === a).length;
  const parts = [
    q.length && `${q.length} in line`,
    count('order') && `${count('order')} to order`,
    count('check') && `${count('check')} want checks`,
    count('manager') && `<b>${count('manager')} want the manager</b>`,
    count('bus') && `${count('bus')} dirty`,
  ].filter(Boolean);
  const html = `Floor: ${parts.length ? parts.join(' · ') : 'all quiet'}`;
  const worst = Math.min(100, ...q.map((p) => p.mood), ...tasks.filter((t) => t.p).map((t) => t.p.mood));
  strip.classList.toggle('hot', worst < 40);
  if (strip.dataset.html === html) return;
  strip.dataset.html = html;
  const label = h('span', { html });
  strip.replaceChildren(label, h('button.btn', { onclick: () => go('floor'), title: 'Back to the floor (1)' }, 'Floor (1)'));
}

function crewDoing(p) {
  if (p.role === 'host') return 'at the stand';
  if (p.role === 'lineCook') return 'on the line';
  if (p.role === 'bartender') {
    const a = G.bar.auto;
    return a ? `mixing for ${ticketById(a.ticketId)?.tableLabel || '…'}` : 'behind the bar';
  }
  const s = G.actors.find((a) => a.staffId === p.id);
  if (!s?.job) return 'free';
  if (s.job.type === 'bus') return `bussing ${tableById(s.job.tableId)?.label || ''}`;
  const t = G.tickets.find((x) => x.id === s.job.ticketId);
  return t ? `${t.kind === 'food' ? 'food' : 'drinks'} → ${t.tableLabel}` : 'busy';
}

function setBadge(sel, n, hot) {
  const el = $(sel);
  el.textContent = n || '';
  el.classList.toggle('hot', !!hot);
}

// ── Labels over the 3D map ─────────────────────────────────────────────────
export function updateOverlay() {
  const host = $('#world-overlay');
  const show = G.view === 'floor';
  host.style.display = show ? '' : 'none';
  if (!show) return;
  const sel = partyById(G.selectedPartyId);

  for (const t of G.tables) {
    let el = labels.get(t.id);
    if (!el) {
      el = h('div.tlabel', { onclick: () => clickTable(t.id) }, h('div.tl-status'), h('div.tl-name'), h('div.mood-wrap'));
      host.append(el);
      labels.set(t.id, el);
    }
    const p = partyById(t.partyId);
    const st = tableStatus(t);
    const pos = toScreen(t.kind === 'bar' ? t.x - 0.5 : t.x, 1.3, t.z);
    if (!pos) continue;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    const fits = sel && canSeat(sel, t);
    el.className = `tlabel s-${st.cls}${fits ? ' fits' : ''}${sel && !fits ? ' nofit' : ''}`;
    el.children[0].textContent = st.text;
    el.children[0].style.display = st.text ? '' : 'none';
    el.children[1].innerHTML = `${t.label}<em>${p ? `${p.size}/${t.cap}` : t.cap}</em>`;
    const mw = el.children[2];
    const m = p && p.state !== 'leaving' ? Math.round(p.mood / 5) : -1;
    if (mw.dataset.m !== String(m)) { mw.dataset.m = m; mw.replaceChildren(...(m >= 0 ? [moodBar(p.mood)] : [])); }
  }
  for (const [id, el] of labels) if (!tableById(id)) { el.remove(); labels.delete(id); }

  // Waiting parties.
  const q = queue();
  for (const p of q) {
    let el = qlabels.get(p.id);
    if (!el) {
      el = h('div.qlabel', { onclick: () => selectParty(p.id) });
      host.append(el);
      qlabels.set(p.id, el);
    }
    const lead = p.members[0];
    const pos = toScreen(lead.x + 0.4, 2.0, lead.z);
    if (!pos) continue;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    el.textContent = `${p.size} · ${p.name}`;
    el.classList.toggle('selected', p.id === G.selectedPartyId);
  }
  for (const [id, el] of qlabels) if (!q.some((p) => p.id === id)) { el.remove(); qlabels.delete(id); }

  // Station call-outs.
  const drinks = openTickets('drink').reduce((n, t) => n + t.items.filter((i) => !i.done).length, 0);
  const plates = openTickets('food').reduce((n, t) => n + t.items.filter((i) => !i.done).length, 0);
  const burning = G.kitchen && Object.values(G.kitchen.slots).flat().some((s) => s && s.warned);
  zone(host, 'kitchen', 5.5, 3.2, `Kitchen${plates ? ` · <b>${plates}</b> to cook` : ''}${burning ? ' · overcooking!' : ''}`, burning);
  zone(host, 'bar', 23.9, 8.8, `Bar${drinks ? ` · <b>${drinks}</b> drinks` : ''}`, drinks && openTickets('drink').some((t) => G.time - t.createdAt > 40));
  zone(host, 'office', 15, 3.2, `Office${G.stats ? ` · ${money(G.stats.revenue + G.stats.tips)}` : ''}`, false);
}

function zone(host, id, x, z, html, hot) {
  let el = zlabels[id];
  if (!el) {
    el = h('div.zlabel', { onclick: () => go(id) });
    host.append(el);
    zlabels[id] = el;
  }
  const pos = toScreen(x, 2.6, z);
  if (!pos) return;
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
  el.classList.toggle('hot', !!hot);
}

export function clearOverlay() {
  for (const el of labels.values()) el.remove();
  for (const el of qlabels.values()) el.remove();
  labels.clear();
  qlabels.clear();
}

export const describeOrderItem = (kind, key) => (kind === 'food' ? DISHES[key]?.short || DISHES[key]?.name : DRINKS[key]?.short || DRINKS[key]?.name);
