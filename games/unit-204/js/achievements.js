'use strict';
/* ============================== ACHIEVEMENTS ==============================
   Little badges for doing something nice, thorough, or silly. Unlocking one pops a card in the corner
   ("Achievement Unlocked: Birding Enthusiast"); the trophy on the toolbar opens the case with every badge you've
   earned (in this browser, across shifts), the ones from this shift marked NEW, and the rest as hints. */
const ACHIEVEMENTS = [
  { id: 'birder', site: 'residential', name: 'Birding Enthusiast', desc: 'Photographed a bird at a window.', hint: 'Windows are worth a long look. Keep the camera handy.', col: '#d43a2a', em: ['..##...', '.####..', '##o##>.', '.####..', '..###..', '...#...', '..#.#..'] },
  { id: 'bigfoot', site: 'residential', name: 'Cryptozoologist', desc: 'Photographed a blurry bird-shaped smudge through frosted glass.', hint: 'Some windows only show shapes.', col: '#6a707c', em: ['..###..', '.#####.', '.##.##.', '..###..', '.#####.', '.#.#.#.', '.#...#.'] },
  { id: 'liger', site: 'residential', name: 'Bred for Its Skills in Magic', desc: 'Found the liger sketch on the bedroom wall.', hint: "Pretty much your favorite animal. It's in the bedroom, some shifts.", col: '#7b3fc4', em: ['#.###.#', '#######', '.#o.o#.', '.#####.', '..#v#..', '.#####.', '#.#.#.#'] },
  { id: 'margin', name: 'Margin Artist', desc: 'Filled the margin of your field notes with doodles.', hint: 'The pencil has other uses.', col: '#5d6170', em: ['......#', '.....#.', '....#..', '...#...', '..#....', '.#.....', '##.....'] },
  { id: 'bythebook', name: 'By the Book', desc: 'Followed a citation straight into the SOP binder.', hint: 'Notes that mention the SOP are links.', col: '#3f8f3a', em: ['#######', '#.....#', '#.###.#', '#.....#', '#.###.#', '#.....#', '#######'] },
  { id: 'shutterbug', name: 'Shutterbug', desc: 'Took 20 photos in one shift.', hint: 'Photos never hurt. Lots of photos.', col: '#2f6a3a', em: ['.##....', '#######', '#..#..#', '#.###.#', '#..#..#', '#######', '.......'] },
  { id: 'dude', site: 'residential', name: 'The Dude Abides', desc: 'Looked under the rug the tenant left behind.', hint: 'That rug really ties the room together. Or does it hide something?', col: '#b0703a', em: ['#######', '#.#.#.#', '#######', '#.#.#.#', '#######', '#.#.#.#', '#######'] },
  { id: 'tiefling', site: 'residential', name: 'Business Casualty', desc: 'Flung a necktie off a ceiling fan.', hint: 'Somebody left their tie up there. Fans spin, you know.', col: '#f28c28', em: ['..###..', '...#...', '..###..', '..###..', '.#####.', '.#####.', '..###..'] },
  { id: 'stapler', site: 'office', name: 'I Believe You Have My Stapler', desc: 'Picked up the red stapler.', hint: 'Somebody left their stapler behind. Somebody wants it back.', col: '#d43a2a', em: ['.......', '######.', '#....##', '#######', '.......', '#######', '.......'] },
  { id: 'packrat', name: 'Finders Keepers', desc: 'Carried six left-behind things in your bag at once.', hint: 'Tenants leave all kinds of stuff.', col: '#7a8a5a', em: ['..###..', '.#...#.', '#######', '#.....#', '#..#..#', '#.....#', '#######'] },
  { id: 'chemist', name: 'Mad Scientist', desc: 'Combined five different pairs of things in your bag.', hint: 'Two things in the bag might go together. Probably not, though.', col: '#2f9a8a', em: ['..#.#..', '..#.#..', '..#.#..', '.#...#.', '#.###.#', '#.###.#', '.#####.'] },
  { id: 'lightsout', site: 'residential', name: 'Lights Out', desc: 'Switched off every breaker in the panel at once.', hint: "The panel's in the kitchen. All the switches work.", col: '#24272f', em: ['..###..', '.#...#.', '.#...#.', '..#.#..', '..###..', '..###..', '...#...'] },
  { id: 'gray', name: 'Shades of Gray', desc: 'Made a defensible call in a gray area.', hint: 'Not everything is black and white. Some calls are just acceptable.', col: '#c99a08', em: ['###....', '###....', '###....', '...####', '...####', '...####', '...####'] },
  { id: 'safety', name: 'Safety First', desc: 'Made every hazard safe before filing the report.', hint: 'Breakers and shut-off valves exist for a reason.', col: '#f2c418', em: ['...#...', '..###..', '..#.#..', '.##.##.', '.#####.', '##.#.##', '#######'] },
  { id: 'phonepro', site: 'residential', name: 'Customer Service Voice', desc: 'Earned an A on a tenant call.', hint: 'Listen first. Explain plainly. Never promise what only Pat can approve.', col: '#2a5aa8', em: ['##...##', '#.#.#.#', '#..#..#', '#.....#', '.#...#.', '..#.#..', '...#...'] },
  { id: 'clipboard', site: 'residential', name: 'Clipboard Royalty', desc: 'Earned an A+ on a Unit 204 move-out report.', hint: 'Every call right, every hazard safe, every photo and note to back it up.', col: '#ffb55e', em: ['#.#.#.#', '#######', '#######', '.#####.', '.#####.', '.#####.', '#######'] },
  { id: 'calendar', site: 'residential', name: 'Ahead of Schedule', desc: 'Flipped a wall calendar all the way to December.', hint: 'Somebody left their calendar up. Time flies.', col: '#d08a2a', em: ['#######', '#.#.#.#', '#######', '#.....#', '#.#.#.#', '#.....#', '#######'] },
  { id: 'takeout', site: 'residential', name: 'Dinner Plans', desc: "Ordered takeout on Dana's BlackBerry for after the shift.", hint: 'Tenants leave menus behind. Dana has a phone. You have to eat.', col: '#c43a2a', em: ['.#...#.', '..#.#..', '#######', '.#####.', '.#####.', '..###..', '.......'] },
  { id: 'suitedup', name: 'Suited Up', desc: 'Never set foot in a work area without your PPE on.', hint: 'Industrial and construction sites have a PPE rack. Use it first.', col: '#d4f03a', em: ['..###..', '.#####.', '#######', '.......', '#.###.#', '#######', '#.###.#'] },
  { id: 'tourist', name: 'Property Tourist', desc: 'Filed a report at all four kinds of property.', hint: 'Apartments, offices, a warehouse, a jobsite: pick one on the title screen.', col: '#2a7ab8', em: ['#.#.#.#', '#######', '#.#.#.#', '#######', '#.#.#.#', '#######', '#######'] },
  { id: 'finprint', name: 'Read the Fine Print', desc: 'Followed a citation into the Field Safety Handbook.', hint: 'Numbers like 1910.37 in your notes are links.', col: '#f2c418', em: ['#######', '#.....#', '#.###.#', '#.....#', '#.###.#', '#.....#', '#######'] },
  { id: 'corner', site: 'office', name: 'Corner Office', desc: 'Earned an A+ on a Suite 204 lease-end report.', hint: 'Every call right at the office suite, with photos to back it up.', col: '#4a6a9a', em: ['..#....', '.###...', '.###.#.', '.######', '.######', '.######', '#######'] },
  { id: 'triedit', site: 'industrial', name: 'Lock, Tag, Try', desc: 'Tried to start a machine that was properly locked out. Nothing happened. Good.', hint: 'Lockout is only proven when you try the start button.', col: '#c8202a', em: ['..###..', '.#...#.', '.#...#.', '#######', '###o###', '###.###', '#######'] },
  { id: 'cleanbill', site: 'industrial', name: 'Clean Bill of Health', desc: 'Earned an A+ on a Lot 204 safety inspection.', hint: 'Every call right at the warehouse, with photos to back it up.', col: '#5a6a7a', em: ['..#.#..', '.#####.', '##...##', '.#...#.', '##...##', '.#####.', '..#.#..'] },
  { id: 'stopwork', site: 'construction', name: 'Stop Work Authority', desc: 'Called Stop on every imminent danger at Site 204.', hint: 'On a jobsite, the most important word you have is Stop.', col: '#d82020', em: ['.#####.', '##...##', '#.....#', '#.###.#', '#.....#', '##...##', '.#####.'] },
  { id: 'toppedout', site: 'construction', name: 'Topping Out', desc: 'Earned an A+ on a Site 204 safety walk.', hint: 'Every call right at the jobsite, with photos to back it up.', col: '#3f7a3a', em: ['...#...', '..###..', '.#####.', '...#...', '#######', '#.#.#.#', '.......'] },
  { id: 'snake', name: 'Old School', desc: "Scored 10 in Snake on Dana's BlackBerry.", hint: "Dana's phone has a game on it. Don't let her catch you.", col: '#3a5a30', em: ['.......', '.####..', '.#..#..', '.#..###', '.#.....', '.#####.', '.......'] }
];
const ACH = {}; for (const a of ACHIEVEMENTS) ACH[a.id] = a;
addEventListener('DOMContentLoaded', () => Achievements.badge());
const Achievements = {
  got: store('unit204-ach') || {},                  // id -> when it was first earned (ms)
  where: store('unit204-ach-site') || {},           // id -> which property you were at when you earned it (for resetting one property)
  fresh: new Set(),                                 // earned this shift
  has(id) { return !!this.got[id]; },
  /* earn one (once, ever); extra adds a line to the card, like which bird it was */
  unlock(id, extra) {
    const a = ACH[id]; if (!a || this.got[id]) return false;
    this.got[id] = Date.now(); this.fresh.add(id); store('unit204-ach', this.got);
    this.where[id] = typeof Sites !== 'undefined' ? Sites.cur : 'residential'; store('unit204-ach-site', this.where);
    this.toast(a, extra); this.badge(); return true;
  },
  newShift() { this.fresh = new Set(); this.badge(); },
  /* forget badges: one property's (whatever was earned there, plus that property's own badges), or every one */
  forget(site) {
    for (const id of Object.keys(this.got)) {
      const a = ACH[id], at = this.where[id] || (a && a.site) || 'residential';
      if (!site || at === site || (a && a.site === site) || id === 'tourist') { delete this.got[id]; delete this.where[id]; this.fresh.delete(id); }
    }
    store('unit204-ach', this.got); store('unit204-ach-site', this.where); this.badge();
  },
  /* a medallion: the badge's color, a rim, and its little emblem; locked ones are gray with a question mark */
  medal(a, px = 40, locked = false) {
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    pxEllipse(g, 8, 8, 7, 7, '#17131f'); pxEllipse(g, 8, 8, 6, 6, locked ? '#5a5468' : '#e8c35a'); pxEllipse(g, 8, 8, 5, 5, locked ? '#3e3a4c' : a.col);
    const em = locked ? ['..###..', '.#...#.', '.....#.', '...##..', '...#...', '.......', '...#...'] : a.em;
    em.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = locked ? '#8a8498' : ch === 'o' ? '#17131f' : ch === '>' || ch === 'v' ? '#f2c418' : '#fff6dc'; g.fillRect(5 + x, 5 + y, 1, 1); } }));
    pxRect(g, 4, 3, 2, 1, 'rgba(255,255,255,0.45)');
    return c;                                                     // 16x16: js/crisp.js scales it evenly on screen
  },
  /* the card in the corner */
  toast(a, extra) {
    let el = $('achToast');
    if (!el) { el = document.createElement('div'); el.id = 'achToast'; el.className = 'ach-toast'; el.setAttribute('role', 'status'); $('game').append(el); }
    const txt = document.createElement('div'), k = document.createElement('small'), n = document.createElement('b'), d = document.createElement('span');
    k.textContent = 'ACHIEVEMENT UNLOCKED'; n.textContent = a.name; d.textContent = a.desc + (extra ? ' ' + extra : '');
    txt.append(k, n, d); el.replaceChildren(this.medal(a, 44), txt);
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); Audio2.sfx('chime');
    clearTimeout(this._t); this._t = setTimeout(() => el.classList.remove('on'), 5200);
  },
  /* the trophy button shows how many are new this shift */
  badge() { const b = $('tbAchN'); if (b) b.textContent = Object.keys(this.got).length; const t = $('tbAch'); if (t) t.classList.toggle('has-new', this.fresh.size > 0); },
  /* the trophy case */
  open() {
    let s = $('achScreen');
    if (!s) {
      s = document.createElement('section'); s.id = 'achScreen'; s.className = 'overlay dim';
      s.innerHTML = `<div class="panel ach-panel"><div class="win-bar"><span>Achievements</span><button class="win-x" type="button" aria-label="Close" data-tip="Close|Back to the inspection. (Esc)">&times;</button></div>
        <p class="ach-count" id="achCount"></p><div id="achSets"></div><div class="ach-grid" id="achGrid"></div></div>`;
      $('game').append(s);
      s.querySelector('.win-x').addEventListener('click', () => UI.close('achScreen'));
      s.addEventListener('mousedown', e => { if (e.target === s) UI.close('achScreen'); });
    }
    const n = Object.keys(this.got).length;
    // every unit is different, so some of these only turn up now and then; what you earn stays earned from one inspection to the next
    $('achCount').textContent = `${n} of ${ACHIEVEMENTS.length} earned` + (this.fresh.size ? `, ${this.fresh.size} this shift` : '') + '. Every unit is different, so some only turn up in certain apartments; they carry over from inspection to inspection, so keep taking shifts.';
    { const sets = $('achSets'); if (sets && typeof BadgeSets !== 'undefined') sets.replaceChildren(BadgeSets.summary()); }   // each property's set, and Share on finished ones
    $('achGrid').replaceChildren(...ACHIEVEMENTS.map(a => {
      const got = this.has(a.id), d = document.createElement('div'); d.className = 'ach' + (got ? ' got' : '') + (this.fresh.has(a.id) ? ' new' : '');
      const t = document.createElement('div'), b = document.createElement('b'), p = document.createElement('span');
      b.textContent = got ? a.name : '???'; p.textContent = got ? a.desc : a.hint; t.append(b, p);
      if (a.site && SITES[a.site]) { const tg = document.createElement('small'); tg.className = 'ach-site'; tg.textContent = SITES[a.site].place + ' 204'; t.append(tg); }
      d.append(this.medal(a, 40, !got), t); return d;
    }));
    UI.open('achScreen'); Audio2.sfx('swish');
  }
};
