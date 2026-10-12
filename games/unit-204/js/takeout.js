'use strict';
/* ============================== TAKEOUT ==============================
   Dinner, after the shift. The tenant's takeout menu (Golden Dragon Express) and Tony's Pizzeria (its calendar, or
   the number on a pizza box lid) can go into Dana's BlackBerry: carry the menu or calendar in your bag, or jot the
   number off the box, and the Contacts screen offers to save it. Saved numbers stay in the phone from shift to
   shift (this browser only). Calling one opens a little order on the phone's screen: pick up to three things, and
   it's ready for pickup at 5:30, after work. Pat and Dana notice. */
const TAKEOUT = {
  dragon: {
    name: 'GOLDEN DRAGON', full: 'Golden Dragon Express', who: 'Golden Dragon', from: 'the takeout menu',
    hello: 'Golden Dragon Express, pickup or delivery? ...Pickup. Okay. What you want?',
    more: 'Okay. What else?', bye: 'Okay. Bye-bye.',
    items: [['General Tso\'s chicken', 8.95], ['Crab rangoon (6)', 4.5], ['Beef lo mein', 7.95], ['Egg drop soup', 2.95], ['Kung pao shrimp', 9.5]]
  },
  tony: {
    name: "TONY'S PIZZERIA", full: "Tony's Pizzeria", who: "Tony's", from: "Tony's calendar",
    hello: "Tony's, this is Sal. Pickup? Go ahead.",
    more: 'Got it. Anything else?', bye: 'Okay, buddy. Ciao.',
    items: [['Large pepperoni', 12.99], ['Garlic knots', 3.99], ['Meatball sub', 7.49], ['Two-liter of Coke', 2.49], ['Cannoli', 3.25]]
  }
};
const Takeout = {
  /* numbers already in Dana's phone (kept across shifts), and ones you could add from what you're carrying */
  saved() { return store('unit204-takeout') || []; },
  sources() {
    const out = [], bag = Game.bag || [];
    if (bag.some(k => k.split('|')[0] === 'menu')) out.push('dragon');
    if (bag.some(k => /^calendar\|Tony/.test(k)) || (Game.noted && Game.noted.has('tony'))) out.push('tony');
    return out;
  },
  offers() { const s = this.saved(); return this.sources().filter(id => !s.includes(id)); },
  /* jotting a number down without carrying anything (the pizza box lid) */
  note(id) { (Game.noted = Game.noted || new Set()).add(id); },
  add(id) {
    const s = this.saved(); if (!s.includes(id)) { s.push(id); store('unit204-takeout', s); }
    Audio2.synth('blip'); BlackBerry.sel = 0; BlackBerry.render();
    BlackBerry.say(`Dana: Saved ${TAKEOUT[id].full} from ${TAKEOUT[id].from}. Smart.`);
  },
  /* rows for the BlackBerry's Contacts screen */
  rows() {
    return [...this.saved().map(id => ({ label: TAKEOUT[id].name, act: () => this.call(id) })),
      ...this.offers().map(id => ({ label: '+ SAVE ' + TAKEOUT[id].name, sub: `The number's on ${TAKEOUT[id].from}.`, act: () => this.add(id) }))];
  },
  /* ---------- the order, played on the phone's call screen ---------- */
  call(id) {
    const R = TAKEOUT[id];
    if (Game.order) { BlackBerry.call = { canned: [`${R.who}? You already ordered dinner: ${Game.order.items.join(', ')}, from ${Game.order.from}. Pickup at 5:30.`, 'You hang up. One dinner is plenty.'], i: 0, name: R.name }; BlackBerry.screen = 'call'; return BlackBerry.render(); }
    BlackBerry.call = { order: id, cart: [], said: null, line: R.hello, done: false, name: R.name, t0: performance.now() };
    BlackBerry.screen = 'call'; BlackBerry.sel = 0; Audio2.synth('ring'); BlackBerry.render();
  },
  money: n => '$' + n.toFixed(2),
  /* what you can say right now */
  opts(c) {
    const R = TAKEOUT[c.order], out = R.items.filter(([n]) => !c.cart.includes(n)).map(([n, p]) => ({ text: `${n}, ${this.money(p)}`, fn: () => this.pick(c, n) }));
    if (c.cart.length) out.push({ text: "That's everything. For pickup, after work.", fn: () => this.finish(c) });
    else out.push({ text: 'Actually, never mind. Sorry.', fn: () => { c.said = 'Actually, never mind. Sorry.'; c.line = R.bye; c.done = true; } });
    return out;
  },
  pick(c, n) {
    c.cart.push(n); c.said = `One ${n.replace(/ \(\d+\)$/, '').toLowerCase()}, please.`; c.line = TAKEOUT[c.order].more;
    if (c.cart.length >= 3) this.finish(c, true);
  },
  finish(c, full) {
    const R = TAKEOUT[c.order], total = c.cart.reduce((a, n) => a + R.items.find(x => x[0] === n)[1], 0) * 1.0825;   // with sales tax
    if (!full) c.said = "That's everything. For pickup, after work.";
    c.line = `${c.cart.length > 2 ? 'Big order! ' : ''}That's ${this.money(total)} with tax. Ready at 5:30. Name? ...Okay, see you.`;
    c.done = true; Game.order = { from: R.full, items: c.cart.slice(), total };
    Achievements.unlock('takeout');
  },
  /* drawn by BlackBerry.renderCall */
  render(c, line, next, choice) {
    const R = TAKEOUT[c.order];
    if (c.said) line('You', c.said, 'you');
    line(R.who, c.line, 'gus');
    if (c.done) return next('▶ Hang up');
    this.opts(c).forEach((o, i) => choice(o.text, i, () => { o.fn(); BlackBerry.sel = 0; BlackBerry.render(); }));
  },
  key(c, k) {
    if (c.done) { if (k === 'Enter' || k === ' ') { BlackBerry.hangUp(); if (Game.order) BlackBerry.say(c.order === 'dragon' ? 'Dana: Ooh. Get me an egg roll?' : 'Dana: Tony\'s! Okay, you have good taste.'); } return; }
    const o = this.opts(c), d = { ArrowUp: -1, ArrowDown: 1, w: -1, s: 1 }[k];
    if (d) { BlackBerry.sel = (BlackBerry.sel + d + o.length) % o.length; return BlackBerry.render(); }
    if (k === 'Enter' || k === ' ') { Audio2.synth('click'); o[BlackBerry.sel].fn(); BlackBerry.sel = 0; BlackBerry.render(); }
  }
};
