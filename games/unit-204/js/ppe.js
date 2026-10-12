'use strict';
/* ============================== PPE ==============================
   On sites that need it (industrial, construction), you suit up first. The site puts a PPE rack (or a trailer
   shelf) in its starting area: each piece on it is scenery with a `ppe` id, and clicking it puts it on. What you
   have on shows as a row of little icons in the corner. Each area lists what it needs (site.ppe.need); walk in
   without something and Dana calls it out, and the report counts it against you (an inspector who skips their own
   PPE has no business writing anyone else up for it). The characters' sprites don't show the gear yet. */
const PPE_ITEMS = {
  hardhat: { name: 'Hard hat', short: 'hard hat', look: 'A white hard hat with the Brickroad logo. Type I, Class E: rated for falling objects and electrical contact.', on: 'You put on the hard hat and snug the ratchet. Your hair will never recover.' },
  vest: { name: 'Hi-vis vest', short: 'hi-vis vest', look: 'A fluorescent yellow-green safety vest with silver reflective stripes. Class 2.', on: 'You zip on the hi-vis vest. You are now extremely visible.' },
  glasses: { name: 'Safety glasses', short: 'safety glasses', look: 'Clear wraparound safety glasses, stamped Z87+ on the temple.', on: 'You put on the safety glasses. Z87+, impact rated.' },
  ears: { name: 'Hearing protection', short: 'hearing protection', look: 'Foam earplugs in a little dispenser, and a pair of earmuffs on a hook.', on: 'You roll a pair of foam earplugs and let them expand. Everything gets pleasantly far away.' },
  boots: { name: 'Steel-toe boots', short: 'steel-toe boots', look: 'Your steel-toe boots, laced up and waiting under the bench.', on: 'You swap into your steel-toe boots. Your toes thank you in advance.' },
  gloves: { name: 'Work gloves', short: 'gloves', look: 'Cut-resistant work gloves, a little stiff.', on: 'You pull on the work gloves.' },
  mask: { name: 'Respirator', short: 'respirator', look: 'An N95 respirator in a sealed bag.', on: 'You put on the N95 and press the nose clip. Seal check: good.' }
};
/* 9 by 9 pixel icons for the corner HUD */
const PPE_ICON = {
  hardhat: ['.........', '...###...', '..#####..', '.#######.', '.#######.', '#########', '.........', '.........', '.........'],
  vest: ['.##...##.', '.##...##.', '###...###', '#########', '#=======#', '#########', '#=======#', '#########', '.........'],
  glasses: ['.........', '.........', '#########', '###.#.###', '.##...##.', '.........', '.........', '.........', '.........'],
  ears: ['..#####..', '.#.....#.', '#.......#', '##.....##', '##.....##', '##.....##', '.........', '.........', '.........'],
  boots: ['.........', '..###....', '..###....', '..###....', '..#####..', '.#######.', '.########', '.########', '.........'],
  gloves: ['..#.#.#..', '..#.#.#..', '.######..', '.#######.', '.######..', '..####...', '..####...', '.........', '.........'],
  mask: ['.........', '..#####..', '.#######.', '#########', '.#######.', '..#####..', '.........', '.........', '.........']
};
const PPE_COL = { hardhat: '#f4f4ee', vest: '#d4f03a', glasses: '#bfe3f4', ears: '#f28c28', boots: '#8a5a2c', gloves: '#e8c34a', mask: '#e8e8e2' };
const PPE = {
  worn: new Set(), missed: new Set(), warned: new Set(),
  on() { return !!Sites.site.ppe; },
  has(id) { return this.worn.has(id); },
  reset() { this.worn = new Set(); this.missed = new Set(); this.warned = new Set(); this.hud(); },
  /* everything this site asks for, anywhere */
  all() { const p = Sites.site.ppe; return p ? [...new Set(Object.values(p.need || {}).flat())] : []; },
  need(room) { const p = Sites.site.ppe; return (p && p.need && p.need[room]) || []; },
  wear(id) {
    const it = PPE_ITEMS[id]; if (!it) return;
    if (this.worn.has(id)) return Game.tell(`You already have your ${it.short} on.`);
    this.worn.add(id); Audio2.sfx('swish', .6); Game.tell(it.on); this.hud(); Game.refreshHots();
    if (this.all().every(x => this.worn.has(x))) setTimeout(() => UI.say('dana', 'Look at you, all suited up. Okay, now you can go yell at people about theirs.'), 900);
  },
  /* walking into an area: anything missing gets called out once per area, and counts against you */
  check(room) {
    if (!this.on() || Game.mode !== 'play') return;
    const miss = this.need(room).filter(id => !this.worn.has(id)); if (!miss.length) return;
    for (const id of miss) this.missed.add(id);
    if (this.warned.has(room)) return; this.warned.add(room);
    const names = miss.map(id => PPE_ITEMS[id].short);
    setTimeout(() => UI.say('dana', `Boss! No ${list(names)}? Not in here. ${Sites.site.ppe.where || "It's on the rack by the entrance."}`), 600);
  },
  /* the corner row of what you have on */
  hud() {
    let el = $('ppeHud');
    if (!el) { el = document.createElement('div'); el.id = 'ppeHud'; el.setAttribute('aria-label', 'PPE you have on'); $('game').append(el); }
    el.hidden = !this.on();
    el.replaceChildren(...this.all().map(id => {
      const c = document.createElement('canvas'); c.width = 9; c.height = 9; const g = c.getContext('2d');
      PPE_ICON[id].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = ch === '=' ? '#c8ccd4' : PPE_COL[id]; g.fillRect(x, y, 1, 1); } }));
      c.className = this.worn.has(id) ? 'on' : ''; c.dataset.tip = `${PPE_ITEMS[id].name}|${this.worn.has(id) ? 'You have it on.' : 'Not on yet. Find it at the PPE rack.'}`;
      return c;
    }));
  }
};
