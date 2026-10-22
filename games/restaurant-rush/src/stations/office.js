// Management: complaints at the table, the office during a shift, and the end-of-day books
// (with how the crew got on and what the reviews did for word of mouth). The between-shift
// office lives in backOffice.js. Also the title screen and the how-to-play sheet.
import { G, bus, career, saveCareer, resetCareer, tableById, money } from '../state.js';
import { CFG, RESTAURANT, moodLabel } from '../config.js';
import { COMPLAINT_TEXT, resolveComplaint } from '../sim/guests.js';
import { DRINKS } from '../data/menu.js';
import { ROLES, STATS } from '../data/staff.js';
import { working, payroll, applyShiftXp } from '../sim/crew.js';
import { dishPrice, shiftBuzz, addBuzz, RANKS } from '../sim/fame.js';
import { h, openModal, closeModal } from '../ui/dom.js';
import { go } from '../ui/views.js';

let hooks = { startShift: () => {}, setPaused: () => {} };
export function initOffice(h_) { hooks = h_; }

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const starsText = (s) => (s ? `${'★'.repeat(Math.round(s))}${'☆'.repeat(5 - Math.round(s))}` : '–');

/** Pause the shift while a dialog is up, and resume when it closes. */
function pausedModal(opts) {
  const was = G.paused;
  hooks.setPaused(true);
  return openModal({ ...opts, onClose: () => { hooks.setPaused(was); opts.onClose?.(); } });
}

// ── Complaint at a table ───────────────────────────────────────────────────
bus.on('manager:visit', (p) => {
  if (!p?.complaint) return;
  const t = tableById(p.tableId);
  go('table', t.id);
  const bill = p.wants.reduce((s, w) => s + dishPrice(w.food) + (w.drink ? DRINKS[w.drink].price : 0), 0);
  const choose = (c) => {
    closeModal();
    const r = resolveComplaint(p, c);
    bus.emit('toast', { kind: 'good', text: `${t.label} calmed down (+${r.boost} mood${r.cost ? `, cost ${money(r.cost)}` : ''}).` });
    go('floor');
  };
  pausedModal({
    title: `${t.label}: the ${p.name} party`,
    sub: `They look ${moodLabel(p.mood).toLowerCase()}.`,
    body: h('div', {},
      h('p', { style: { font: 'italic 600 18px var(--serif)', margin: '4px 0 12px' } }, `“${COMPLAINT_TEXT[p.complaint]}”`),
      h('button.btn.choice', { onclick: () => choose('apologize') }, 'Apologize sincerely', h('small', {}, 'Free. A small bump in mood.')),
      h('button.btn.choice', { onclick: () => choose('dessert') }, 'Send out tiramisù on the house', h('small', {}, `Costs about ${money(6 * p.size)}. A solid bump.`)),
      h('button.btn.choice', { onclick: () => choose('comp') }, 'Comp half the bill', h('small', {}, `Costs about ${money(bill * 0.5)}. They'll forgive almost anything.`)),
    ),
    actions: [{ label: 'Walk away', run: () => go('floor') }],
    onClose: () => { if (G.view === 'table') go('floor'); },
  });
});

// ── Office during the shift ─────────────────────────────────────────────────
bus.on('office:open', () => {
  if (!G.running) return;
  const s = G.stats;
  pausedModal({
    title: 'Ufficio',
    sub: `Mama Maggie's photo watches over the books. Day ${career.day}.`,
    body: h('div', {},
      report(s),
      h('h3', {}, 'On today'),
      h('ul.howto', {}, crewList().map((c) => h('li', {}, c))),
      h('p', { style: { color: 'var(--muted)', fontSize: '13px' } }, 'Hiring, training and moving people between roles happen between shifts — finish the lunch rush first.'),
    ),
    actions: [{ label: 'Back to work', primary: true }],
  });
});

function crewList() {
  const out = ['You — the boss: wherever you are needed'];
  for (const p of working()) {
    const n = G.crewDid[p.id] || 0;
    out.push(`${p.name} — ${ROLES[p.role].name.toLowerCase()} · ${n} job${n === 1 ? '' : 's'} so far today`);
  }
  return out;
}

function report(s) {
  const rating = avg(s.ratings);
  return h('div.report', {},
    h('div', {}, h('small', {}, 'Sales'), h('b', {}, money(s.revenue))),
    h('div', {}, h('small', {}, 'Tips'), h('b', {}, money(s.tips))),
    h('div', {}, h('small', {}, 'Guests served'), h('b', {}, s.served)),
    h('div', {}, h('small', {}, 'Rating'), h('b', {}, rating ? rating.toFixed(1) : '–')),
    h('div', {}, h('small', {}, 'Walkouts'), h('b', {}, s.walkouts + s.turnedAway)),
    h('div', {}, h('small', {}, 'Wrong items'), h('b', {}, s.wrongItems)),
  );
}

// ── Between lunch and dinner ────────────────────────────────────────────────
export function showServiceBreak(sum, onContinue) {
  openModal({
    title: 'Lunch is done',
    sub: 'The afternoon crew resets the tables and preps for dinner.',
    dismissable: false,
    body: h('div', {},
      h('div.report', {},
        h('div', {}, h('small', {}, 'Lunch sales'), h('b', {}, money(sum.revenue))),
        h('div', {}, h('small', {}, 'Tips'), h('b', {}, money(sum.tips))),
        h('div', {}, h('small', {}, 'Guests served'), h('b', {}, sum.served)),
        h('div', {}, h('small', {}, 'Rating'), h('b', {}, sum.rating ? sum.rating.toFixed(1) : '–')),
        h('div', {}, h('small', {}, 'Walkouts'), h('b', {}, sum.walkouts)),
      ),
      h('p', { style: { fontSize: '13px', color: 'var(--muted)' } }, 'Dinner opens at 5:00; the rush runs about 6:30 to 8:30, and dinner draws a bigger crowd. The books, the crew and the office come at the end of the day.'),
    ),
    actions: [{ label: 'Open for dinner ▸', primary: true, run: onContinue }],
  });
}

// ── End of shift ────────────────────────────────────────────────────────────
export function endOfShift() {
  const s = G.stats;
  const foodCost = Math.round(s.revenue * CFG.foodCostPct);
  const overheads = CFG.baseWages;
  const wages = payroll();          // today's rates, before anyone levels up
  const net = s.revenue + s.tips - foodCost - overheads - wages - s.comps;
  const rating = avg(s.ratings);
  const ups = applyShiftXp();
  const buzz = shiftBuzz(s.ratings, s.critic);
  const moved = addBuzz(buzz);
  career.cash += net;
  career.history.push({ day: career.day, net, rating, served: s.served, buzz });
  career.day += 1;
  saveCareer();
  openModal({
    title: `Day ${career.day - 1} is in the books`,
    sub: rating >= 4 ? 'Standing ovation from the kitchen. Mama Maggie would be proud.' : rating >= 3 ? 'A solid day. Room to tighten up.' : 'Rough service. Tomorrow is a new day.',
    dismissable: false,
    body: h('div', {},
      report(s),
      h('h3', {}, 'The books'),
      h('table.ledger', {}, h('tbody', {},
        row('Sales', s.revenue), row('Tips', s.tips), row('Food cost (30%)', -foodCost), row('Rent & gas', -overheads), row('Wages', -wages),
        s.comps ? row('Comps & desserts', -s.comps) : null,
        h('tr.total', {}, h('td', {}, 'Net today'), h('td', {}, money(net))),
        h('tr', {}, h('td', {}, 'Cash in the safe'), h('td', {}, money(career.cash))),
      )),
      h('p', { style: { fontSize: '13px', color: 'var(--muted)' } }, `Rating ${starsText(rating)} · ${s.perfectPlates} perfect plates · ${s.drinksMade} drinks poured`),
      h('h3', {}, 'Word of mouth'),
      h('p', {}, s.critic ? `The critic gave ${s.critic.stars} stars. ` : '',
        buzz >= 0 ? `The reviews spread: +${buzz} buzz.` : `Bad reviews travel fast: ${buzz} buzz.`,
        moved.after > moved.before ? h('b', {}, ` ${RESTAURANT.name} is now “${RANKS[moved.after].name}” — expect bigger crowds${moved.before === 0 ? ', and a food critic every shift' : ''}.`)
          : moved.after < moved.before ? h('b', {}, ` Slipped back to “${RANKS[moved.after].name}”.`) : ''),
      ups.length ? h('h3', {}, 'The crew') : null,
      ups.length ? h('ul.howto', {}, ups.map((u) => h('li', {},
        h('b', {}, u.p.name), ` (${ROLES[u.p.role].name.toLowerCase()}): ${u.jobs} job${u.jobs === 1 ? '' : 's'}.`,
        u.to > u.from ? h('b.levelup', {}, ` ${STATS[u.stat].name} ${u.from} → ${u.to}!`) : '',
        u.unlocked ? h('b.levelup', {}, ` New skill: ${ROLES[u.p.role].skill.name}.`) : ''))) : null,
    ),
    actions: [{ label: 'To the office ▸', primary: true, run: shop }],
  });
}
const row = (label, n) => h('tr', {}, h('td', {}, label), h('td', {}, money(n)));

// The between-shift office is its own module, loaded when the day ends (bundled in the build).
function shop() {
  import('./backOffice.js')
    .then((m) => m.openBackOffice(() => hooks.startShift()))
    .catch(() => openModal({
      title: 'The office is locked',
      sub: 'Its file did not load. Check your connection, then try again.',
      dismissable: false,
      body: h('div'),
      actions: [{ label: 'Try again', primary: true, run: shop }, { label: `Skip to Day ${career.day} ▸`, run: () => hooks.startShift() }],
    }));
}

// ── Title + help ────────────────────────────────────────────────────────────
export function showTitle() {
  const hasSave = career.day > 1;
  const el = h('div.title-screen', {}, h('div.title-card', {},
    h('div.seal', {}, 'M'),
    h('div.kicker', {}, RESTAURANT.name),
    h('h1', {}, 'Restaurant Rush'),
    h('div.place', {}, RESTAURANT.tagline),
    h('div.stripe'),
    h('p.tag', {}, 'Run the family trattoria through lunch and dinner: seat, serve, cook, mix, and build a crew worth bragging about.'),
    h('div.btns', {},
      h('button.btn.btn-primary', { onclick: () => { el.remove(); briefing(); } }, hasSave ? `Continue — Day ${career.day}` : 'Open for lunch'),
      hasSave ? h('button.btn', { onclick: () => { resetCareer(); el.remove(); briefing(); } }, 'New game') : null,
      h('button.btn', { onclick: () => showHelp() }, 'How to play'),
    ),
  ));
  document.body.append(el);
}

function briefing() {
  openModal({
    title: `Day ${career.day}: lunch and dinner`,
    sub: `${RESTAURANT.name} opens at 11:00 for lunch and 5:00 for dinner. You run the rushes (about 12:00–1:30 and 6:30–8:30); in the quiet hours either side, the crew has it and the clock runs faster.`,
    dismissable: false,
    body: helpBody(career.day === 1),
    actions: [{ label: 'Unlock the doors ▸', primary: true, run: () => hooks.startShift() }],
  });
}

export function showHelp() {
  const wasRunning = G.running;
  const open = wasRunning ? pausedModal : openModal;
  open({ title: 'How to run the shift', body: helpBody(true), actions: [{ label: 'Got it', primary: true }] });
}

function helpBody(full) {
  return h('div', {},
    h('h3', {}, 'Front of house · the floor map'),
    h('ul.howto', {},
      h('li', {}, h('b', {}, 'The day: '), 'lunch, then dinner. You run each rush; in the quiet hours either side the crew seats, serves, cooks and mixes on its own (not quite as well as you) and the clock runs four times faster. Take over any time with the button beside the clock.'),
      h('li', {}, h('b', {}, 'Host: '), 'parties wait in line by the door. Click one (left panel or on the map), then click a green table big enough for them. Solo diners and couples can sit at the bar (B1–B3).'),
      h('li', {}, h('b', {}, 'Serve: '), 'when a table shows ', h('b', {}, 'TAKE ORDER'), ', click it. The camera drops to the table; each guest says what they want, and you key it in. Their words fade, so listen. “Pardon?” costs a little patience.'),
      h('li', {}, h('b', {}, 'Check: '), 'when they’re done eating, click ', h('b', {}, 'WANTS CHECK'), ' to take payment. Happier guests tip more.'),
      h('li', {}, h('b', {}, 'Bus: '), 'click a dirty table to send someone to clear it.'),
      h('li', {}, h('b', {}, 'Manage: '), 'unhappy guests ask for the manager. Apologize, send dessert, or comp the bill.'),
    ),
    h('h3', {}, 'Back of house · zoom in with 2 and 3'),
    h('ul.howto', {},
      h('li', {}, h('b', {}, 'Bar (2): '), 'pick a drink off the rail, choose the glass, add ice, ', h('b', {}, 'hold'), ' a bottle to pour and let go at the line, shake if needed, garnish, Serve.'),
      h('li', {}, h('b', {}, 'Kitchen (3): '), 'click a dish on a ticket to start a plate. Pizzas: dough, sauce, cheese, toppings, then into the wood-fired oven. Pasta, meatballs and calamari cook on the line: pull them in the green window, and turn or toss them halfway when they flash. Pulled food waits in the warmer; click it to add it to the selected plate. Then Send.'),
      h('li', {}, 'The kitchen keeps cooking while you’re away. Burnt food makes for sad guests.'),
    ),
    h('h3', {}, 'Your crew · the office between shifts'),
    h('ul.howto', {},
      h('li', {}, h('b', {}, 'Roles: '), 'put people on as host, runner, busser, line cook or bartender. Each role leans on one stat — Charm, Feet, Feet, Hands, Flair — and the stars show who fits where. Anyone on a day off isn’t paid.'),
      h('li', {}, h('b', {}, 'Training: '), 'spend cash to raise a stat. Up to someone’s natural potential it’s cheap; past it, it’s pricey but possible. They also learn their role’s stat on the job, and unlock a skill at 7.'),
      h('li', {}, h('b', {}, 'Hiring: '), 'three new applicants each day, each with strengths, weaknesses and a quirk.'),
      h('li', {}, h('b', {}, 'Word of mouth: '), 'good reviews raise the trattoria’s rank: bigger crowds, and from the second rank a food critic every shift. Refine recipes to sell them for more.'),
    ),
    full ? h('h3', {}, 'Keys') : null,
    full ? h('p', { style: { fontSize: '13px' } }, '1 floor · 2 bar · 3 kitchen · 4 office · Esc back to the floor · Space pause · , . speed · M sound · F full screen · H help') : null,
    full ? h('p', { style: { fontSize: '11px', color: 'var(--muted)', marginTop: '14px' } }, 'People: the Microsoft Rocketbox avatar library (MIT licence). Fonts: Inter and Playfair Display (SIL Open Font License). 3D: three.js.') : null,
  );
}
