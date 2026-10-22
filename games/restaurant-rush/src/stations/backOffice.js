// The office between shifts: the crew (roles, training), the day's job applicants, Mama Maggie's
// recipe notebook, and renovations. Everything bought here carries over.
import { career, saveCareer, UPGRADES, has, money } from '../state.js';
import { STATS, STAT_KEYS, STAT_MAX, ROLES, ROLE_KEYS, TRAITS, SKILL_AT, xpToNext } from '../data/staff.js';
import { DISHES } from '../data/menu.js';
import * as crew from '../sim/crew.js';
import { rank, nextRank, RANKS, rankIndex, recipeLevel, dishPrice, refineCost, refine, RECIPE_MAX, RECIPE_NOTES } from '../sim/fame.js';
import { h, openModal } from '../ui/dom.js';

let tab = 'crew';
let confirmLetGo = null;

export function openBackOffice(onOpen) {
  const body = h('div.office');
  const head = h('div.office-head');
  const tabs = h('div.tabs');
  const pane = h('div.office-pane');
  body.append(head, tabs, pane);
  let foot = null;

  const draw = () => {
    head.replaceChildren(
      h('div', {}, h('small', {}, 'Cash in the safe'), h('b', {}, money(career.cash))),
      h('div', {}, h('small', {}, 'Payroll tomorrow'), h('b', {}, money(crew.payroll()))),
      reputation(),
    );
    tabs.replaceChildren(...[['crew', `Crew (${career.staff.length}/${crew.MAX_STAFF})`], ['hire', 'Help wanted'], ['recipes', 'Recipes'], ['reno', 'Renovations']]
      .map(([k, label]) => h(`button.tab${tab === k ? '.on' : ''}`, { onclick: () => { tab = k; confirmLetGo = null; draw(); } }, label)));
    pane.replaceChildren(...({ crew: crewPane, hire: hirePane, recipes: recipePane, reno: renoPane }[tab])(draw));
    // You can't open without anyone to carry the food.
    const runners = crew.onRole('runner').length;
    if (foot) {
      const btn = foot.querySelector('.btn-primary');
      btn.disabled = !runners;
      btn.title = runners ? '' : 'Put someone on as a runner first: nobody else carries food to the tables.';
      foot.querySelector('.foot-note')?.remove();
      if (!runners) foot.prepend(h('span.foot-note', {}, 'Nobody is running food. Make someone a runner.'));
    }
  };

  const modal = openModal({
    title: 'Ufficio — between shifts',
    sub: 'Put people where they shine, train them up, and hire help. Everything here carries over.',
    dismissable: false,
    wide: true,
    body,
    actions: [{ label: `Open for Day ${career.day} ▸`, primary: true, run: onOpen }],
  });
  foot = modal.querySelector('.modal-foot');
  draw();
}

function reputation() {
  const r = rank(), nx = nextRank();
  const pct = nx ? ((career.buzz - r.at) / (nx.at - r.at)) * 100 : 100;
  return h('div.rep', { title: 'Word of mouth: good reviews spread, bad ones too. Each rank brings bigger crowds; from the second rank a food critic visits every shift.' },
    h('small', {}, `Word of mouth · rank ${rankIndex() + 1} of ${RANKS.length}`),
    h('b', {}, r.name),
    h('div.rep-bar', {}, h('i', { style: { width: `${Math.max(3, Math.min(100, pct))}%` } })),
    h('small', {}, nx ? `${career.buzz} / ${nx.at} buzz to “${nx.name}”` : `${career.buzz} buzz — top of the town`));
}

// ── Pieces ──────────────────────────────────────────────────────────────────
function pips(p, stat) {
  const v = p.stats[stat], pot = p.potential[stat];
  return h('span.pips', { title: `${STATS[stat].name} ${v} · potential ${pot}` },
    Array.from({ length: STAT_MAX }, (_, i) => h(`i${i < v ? '.on' : i < pot ? '.pot' : ''}`)));
}

function statRow(p, stat, { train = false, draw } = {}) {
  const roleStat = p.role && ROLES[p.role].stat === stat;
  const kids = [
    h('span.st-name', { title: STATS[stat].desc }, STATS[stat].name),
    pips(p, stat),
    h('span.st-val', {}, p.stats[stat]),
  ];
  if (train) {
    const cost = crew.costToTrain(p, stat);
    const stretch = crew.isStretch(p, stat);
    kids.push(cost == null ? h('span.maxed', {}, 'max') : h(`button.btn.btn-sm${stretch ? '.stretch' : ''}`, {
      disabled: career.cash < cost,
      title: stretch ? `Past ${p.name}'s natural potential, so training costs a lot more.` : `Train ${STATS[stat].name} to ${p.stats[stat] + 1}.`,
      onclick: () => { crew.train(p, stat); draw(); },
    }, `+1 ${money(cost)}`));
  }
  const row = h(`div.st-row${roleStat ? '.role-stat' : ''}`, {}, kids);
  if (roleStat && train && p.stats[stat] < p.potential[stat]) {
    const need = xpToNext(p.stats[stat]);
    row.append(h('div.xp', { title: `Learning on the job: ${Math.floor(p.xp[stat] || 0)} / ${need} toward ${STATS[stat].name} ${p.stats[stat] + 1}` },
      h('i', { style: { width: `${Math.min(100, ((p.xp[stat] || 0) / need) * 100)}%` } })));
  }
  return row;
}

function traitChip(p) {
  return p.trait ? h('span.trait', { title: TRAITS[p.trait].desc }, TRAITS[p.trait].name) : h('span.trait.none', {}, 'No quirks');
}

const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function rolePicker(p, draw) {
  return h('div.roles', {},
    ...ROLE_KEYS.map((r) => {
      const full = p.role !== r && crew.onRole(r).length >= ROLES[r].slots;
      return h(`button.role${p.role === r ? '.on' : ''}`, {
        disabled: full,
        title: `${ROLES[r].name}: ${ROLES[r].desc}${full ? ' (full)' : ''}`,
        onclick: () => { crew.assign(p, p.role === r ? null : r); draw(); },
      }, ROLES[r].name, h('small', {}, stars(crew.fit(p, r))));
    }),
    h(`button.role.off${!p.role ? '.on' : ''}`, { onclick: () => { crew.assign(p, null); draw(); }, title: 'Day off: not working, not paid.' }, 'Day off', h('small', {}, 'unpaid')),
  );
}

function skillLine(p) {
  if (!p.role) return null;
  const role = ROLES[p.role];
  const have = p.stats[role.stat] >= SKILL_AT;
  return h(`div.skill${have ? '.have' : ''}`, { title: role.skill.desc },
    have ? `✓ ${role.skill.name}: ${role.skill.desc}` : `${role.skill.name} unlocks at ${STATS[role.stat].name} ${SKILL_AT}: ${role.skill.desc}`);
}

// ── Crew ────────────────────────────────────────────────────────────────────
function crewPane(draw) {
  const intro = h('p.pane-note', {},
    'Each role leans on one stat: ', ...ROLE_KEYS.map((r, i) => [h('b', {}, ROLES[r].name), ` ${STATS[ROLES[r].stat].name}${i < ROLE_KEYS.length - 1 ? ', ' : '. '}`]),
    'Stars show how well someone fits. Filled pips are their level; outlined pips are natural potential — training up to it is cheap, training past it is not. People also learn their role’s stat on the job.');
  return [intro, h('div.cards', {}, career.staff.map((p) => h(`div.card.person${p.role ? '' : '.benched'}`, {},
    h('div.card-head', {},
      h('div', {}, h('b.pname', {}, p.name), traitChip(p)),
      h('div.wage', {}, h('b', {}, money(crew.wage(p))), h('small', {}, p.role ? '/ shift' : '/ shift if working')),
    ),
    h('div.blurb', {}, p.blurb, p.shifts ? ` · ${p.shifts} shift${p.shifts === 1 ? '' : 's'} here` : ''),
    rolePicker(p, draw),
    h('div.stats', {}, STAT_KEYS.map((k) => statRow(p, k, { train: true, draw }))),
    skillLine(p),
    career.staff.length > 1 ? h('div.card-foot', {}, confirmLetGo === p.id
      ? [h('span', {}, `Let ${p.name} go?`), h('button.btn.btn-sm', { onclick: () => { crew.letGo(p); confirmLetGo = null; draw(); } }, 'Yes'), h('button.btn.btn-sm', { onclick: () => { confirmLetGo = null; draw(); } }, 'No')]
      : h('button.link', { onclick: () => { confirmLetGo = p.id; draw(); } }, 'Let go')) : null,
  )))];
}

// ── Hiring ──────────────────────────────────────────────────────────────────
function bestRoles(c) {
  const top = Math.max(...ROLE_KEYS.map((r) => crew.fit(c, r)));
  return ROLE_KEYS.filter((r) => crew.fit(c, r) === top).map((r) => ROLES[r].name.toLowerCase()).join(' or ');
}
function hirePane(draw) {
  const full = career.staff.length >= crew.MAX_STAFF;
  const list = crew.candidates();
  return [
    h('p.pane-note', {}, `New faces answer the sign in the window every day. Hiring costs a one-off fee; their wage is paid only on days they work. ${full ? 'The crew is full — let someone go to hire.' : ''}`),
    h('div.cards', {}, list.map((c) => h(`div.card.person${c.hired ? '.benched' : ''}`, {},
      h('div.card-head', {},
        h('div', {}, h('b.pname', {}, c.name), traitChip(c)),
        h('div.wage', {}, h('b', {}, money(crew.wage(c))), h('small', {}, '/ shift')),
      ),
      h('div.blurb', {}, c.blurb),
      h('div.stats', {}, STAT_KEYS.map((k) => statRow(c, k))),
      h('div.fits', {}, 'Would make a good ', h('b', {}, bestRoles(c))),
      h('div.card-foot', {}, c.hired ? h('span', {}, 'Hired — see the Crew tab.') : h('button.btn.btn-primary', {
        disabled: full || career.cash < c.fee,
        onclick: () => { const p = crew.hire(c); if (p) { tab = 'crew'; draw(); } },
      }, `Hire for ${money(c.fee)}`)),
    ))),
  ];
}

// ── Recipes ─────────────────────────────────────────────────────────────────
function recipePane(draw) {
  return [
    h('p.pane-note', {}, 'Mama Maggie’s notebook. Refining a recipe makes it taste better (happier guests, better reviews) and lets it sell for more.'),
    h('div.recipes', {}, Object.entries(DISHES).map(([key, d]) => {
      const lvl = recipeLevel(key), cost = refineCost(key);
      const note = RECIPE_NOTES[key]?.[lvl - 1];
      return h('div.upgrade', {},
        h('div.grow', {},
          h('b', {}, d.name, ' ', h('span.lvl', { title: `Level ${lvl} of ${RECIPE_MAX}` }, '●'.repeat(lvl) + '○'.repeat(RECIPE_MAX - lvl))),
          h('small', {}, cost == null ? `As good as it gets. ${money(dishPrice(key))} a plate.` : `${money(dishPrice(key))} a plate → ${money(dishPrice(key) + 2)}. Next: ${note}.`)),
        cost == null ? h('span', {}, 'Perfected') : h('button.btn.btn-primary', { disabled: career.cash < cost, onclick: () => { refine(key); draw(); } }, money(cost)));
    })),
  ];
}

// ── Renovations ─────────────────────────────────────────────────────────────
function renoPane(draw) {
  return Object.entries(UPGRADES).map(([key, u]) => {
    const owned = has(key);
    return h(`div.upgrade${owned ? '.owned' : ''}`, {},
      h('div.grow', {}, h('b', {}, u.name), h('small', {}, u.desc)),
      owned ? h('span', {}, 'Done') : h('button.btn.btn-primary', {
        disabled: career.cash < u.cost,
        onclick: () => { career.cash -= u.cost; career.upgrades[key] = true; saveCareer(); draw(); },
      }, money(u.cost)));
  });
}
