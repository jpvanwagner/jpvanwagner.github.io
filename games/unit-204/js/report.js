'use strict';
/* ============================== SCORING & REPORT ==============================
   The work order lists 3 to 5 real findings per room. The grade is mostly about calling them right: each one is
   worth 100, and cutting a hazard off at the breaker or the gas valve is worth 40 more (those make up the "of"
   total). On top of that, bonus points: +15 for real evidence (a key clue), +15 for a photo on a correct damage or
   hazard call, and +25 for each correct call on something optional (anomalies, and features that turned out
   fine). Bonuses lift the score by up to 8 percent of the total (never past it), and they never cancel a miss: an extra write-up is
   extra credit, not a trade. Missing a hazard costs 50, and rules out an A. A+ takes every call right, every hazard made safe, and
   the evidence and photos to back it all up. Charging a tenant for wear, or for something fine, counts as a
   wrongful charge. */
const PTS = { ppe: 30, correct: 100, evidence: 15, photo: 15, missedHazard: -50, extra: 25, safe: 40, notify: 20 };   // notify: you called maintenance about a real hazard
function gradeFor(pct, flawless) {
  if (pct >= 1 && flawless) return ['A+', 'Flawless. They\'re naming a clipboard after you.'];
  if (pct >= .9) return ['A', 'Senior Inspector material.'];
  if (pct >= .8) return ['B', 'Solid inspector. A few things slipped past.'];
  if (pct >= .65) return ['C', 'Passable, but the SOP manual misses you.'];
  if (pct >= .5) return ['D', 'Back to orientation for a refresher.'];
  return ['F', 'Please hand in your clipboard.'];
}
const Report = {
  compute() {
    const rows = [], extra = [];
    let score = 0, bonus = 0, max = 0, thin = false, correct = 0, partial = 0, notified = 0, notifyTotal = 0, hazards = 0, hazTotal = 0, charged = 0, chargeable = 0, wrongful = 0, evidence = 0, safed = 0, safeTotal = 0;
    for (const f of FEATURES) {
      const v = f.variants[Game.cond[f.id]], m = Game.marks[f.id], photo = !!Game.photos[f.id];
      const clueSet = Game.clues[f.id] || new Set(), ev = v.key.some(k => clueSet.has(k)), ok = !!m && m.cat === v.cat, part = !!m && !ok && acceptable(f.id, m.cat);
      if (m && m.cat === 2 && v.cat < 2) wrongful++;
      if (!Game.required.has(f.id)) { if (m) extra.push({ id: f.id, name: f.name, room: f.room, cat: v.cat, why: v.why, m, ok, part }); continue; }
      let pts = 0;
      max += PTS.correct;
      if (ok) { pts += PTS.correct; correct++; if (ev) { pts += PTS.evidence; bonus += PTS.evidence; } if (v.cat >= 2 && photo) { pts += PTS.photo; bonus += PTS.photo; } }
      if (part) { pts += PTS.partial; partial++; }                  // a defensible call in a gray area: partial credit
      if (!ok || !ev || (v.cat >= 2 && !photo)) thin = true;
      if (ev) evidence++;
      if (v.cat === 3) { hazTotal++; if (ok) hazards++; else pts += PTS.missedHazard; }
      const fixable = v.cat === 3 && !!HAZARD_FIX[f.id], safe = fixable && Utilities.safe(f.id);
      if (fixable) { max += PTS.safe; safeTotal++; if (safe) { pts += PTS.safe; safed++; } }
      const told = v.cat === 3 && ok && !!(Game.notified && Game.notified.has(f.id));   // a hazard isn't handled until maintenance knows
      if (v.cat === 3) { max += PTS.notify; notifyTotal++; if (told) { pts += PTS.notify; notified++; } else thin = true; }
      if (v.cat === 2) { chargeable += v.cost; if (ok && photo) charged += v.cost; }
      score += pts - (ok ? (ev ? PTS.evidence : 0) + (v.cat >= 2 && photo ? PTS.photo : 0) : 0);   // the calls themselves; bonuses are added up separately
      rows.push({ f, v, m, ok, part, pts, photo, ev, fixable, safe, told });
    }
    for (const id of Game.anomalies) {
      const a = ANOMALY[id], m = Game.marks[id]; if (!m) continue;
      if (m.cat === 2 && a.cat < 2) wrongful++;
      extra.push({ id, name: a.name, room: a.room, cat: a.cat, why: a.why, m, ok: m.cat === a.cat, part: m.cat !== a.cat && acceptable(id, m.cat) });
    }
    // your own PPE, on sites that need it: points for each piece you never went without (js/ppe.js)
    const ppeAll = PPE.on() ? PPE.all() : [], ppeMiss = ppeAll.filter(id => PPE.missed.has(id));
    max += ppeAll.length * PTS.ppe; score += (ppeAll.length - ppeMiss.length) * PTS.ppe;
    const extraPts = extra.filter(e => e.ok).length * PTS.extra + extra.filter(e => e.part).length * Math.round(PTS.extra / 2);   // extra credit for optional calls, which never cancels a miss
    bonus += extraPts;
    score = clamp(score + Math.min(bonus, Math.round(max * .08)), 0, max);   // bonuses add at most 8 percent of the total
    let pct = max ? score / max : 0;
    if (hazards < hazTotal || ppeMiss.length) pct = Math.min(pct, .89);   // a missed hazard, or skipping your own PPE, rules out an A               // a missed hazard rules out an A, however good the rest is
    const [grade, rank] = gradeFor(pct, !thin && safed === safeTotal);
    return { ppeMiss, ppeTotal: ppeAll.length, rows, extra, bonus: extraPts, score, max, correct, partial, notified, notifyTotal, total: rows.length, hazards, hazTotal, safed, safeTotal, charged, chargeable, wrongful, evidence, photos: Game.shots, time: Game.elapsed(), grade, rank };
  },
  confirmSubmit() {
    const n = Object.keys(Game.marks).length, calls = BlackBerry.pending();
    UI.closeAll();
    if (calls.length && !Game.bbOffered) {                          // hazards on the form nobody's called in: Dana offers her phone, once
      Game.bbOffered = true;
      return UI.confirm(`Dana: "Wait, before we go. You've got ${calls.length === 1 ? 'a hazard' : calls.length + ' hazards'} on your form. Maintenance needs a call, not just a form. Here, use my BlackBerry."`,
        'Borrow her BlackBerry', () => BlackBerry.open(() => this.confirmSubmit()), 'Submit without calling', () => this.confirmSubmit());
    }
    UI.confirm(`You've written up ${n} ${n === 1 ? 'thing' : 'things'}. Anything you missed counts against you, and once it's filed the shift is over. Submit your ${Sites.site.report.toLowerCase()}?`, 'Submit', () => this.show(), 'Keep inspecting');
  },
  show() {
    const r = this.compute(); Game.last = r; Game.mode = 'end';
    if (r.safeTotal && r.safed === r.safeTotal) Achievements.unlock('safety');
    if (r.ppeTotal && !r.ppeMiss.length) Achievements.unlock('suitedup');
    { const done = new Set(store('unit204-sites') || []); done.add(Sites.cur); store('unit204-sites', [...done]); if (done.size >= Sites.order.length) Achievements.unlock('tourist'); }   // every kind of property, across shifts
    if (r.grade === 'A+') Achievements.unlock({ residential: 'clipboard', office: 'corner', industrial: 'cleanbill', construction: 'toppedout' }[Sites.cur]);
    if (Sites.cur === 'construction') { const stops = r.rows.filter(x => x.v.cat === 3); if (stops.length && stops.every(x => x.ok)) Achievements.unlock('stopwork'); }
    Audio2.walking(false); Audio2.music(false); UI.feedbackHide(); UI.hush();
    $('game').classList.remove('playing');
    Calls.start(() => { this.applyCall(r); Debrief.start(r, () => this.sheet(r)); });   // the tenant calls first, then Pat
  },
  /* what the call did to the money: a dropped charge comes off what you recovered, a fixed mistake comes off your wrongful count */
  applyCall(r) {
    const c = Game.call; if (!c) return;
    r.cs = c.cs; r.csGrade = csGrade(c.cs); if (r.csGrade === 'A') Achievements.unlock('phonepro');
    const row = r.rows.find(x => x.f.id === c.id), counted = row && row.ok && row.photo && row.v.cat === 2;
    if (counted && (c.outcome === 'waived' || c.outcome === 'caved')) r.charged -= c.cost;
    if (counted && c.outcome === 'reduced') r.charged -= c.cost - c.share;
    if (c.truth !== null && c.truth < 2 && c.outcome === 'reversed') r.wrongful = Math.max(0, r.wrongful - 1);
  },
  sheet(r) {
    $('endDate').textContent = 'Inspected ' + GAME_DATE + ' · ' + r.time;
    $('endGrade').textContent = r.grade;
    const cs = $('endCs'); cs.style.display = r.csGrade ? '' : 'none'; if (r.csGrade) $('endCsGrade').textContent = r.csGrade; $('endRank').innerHTML = '<b>' + r.rank + '</b>';
    $('endScore').textContent = r.score.toLocaleString(); $('endOf').textContent = 'of ' + r.max.toLocaleString();
    const stats = [['Customer service', r.csGrade ? `${r.csGrade} (${r.cs})` : '-'], ['Findings called right', `${r.correct}/${r.total}` + (r.partial ? ` (+${r.partial} acceptable)` : '')], ['Hazards caught', `${r.hazards}/${r.hazTotal}`], ...(r.safeTotal ? [['Hazards made safe', `${r.safed}/${r.safeTotal}`]] : []), ...(r.notifyTotal ? [['Hazards called in', `${r.notified}/${r.notifyTotal}`]] : []), ['Deposit charged', `$${r.charged} of $${r.chargeable}`], ['Wrongful charges', r.wrongful],
      ['Evidence found', `${r.evidence}/${r.total}`], ['Extra observations', `${r.extra.filter(e => e.ok).length} right`], ['Photos taken', r.photos], ['Shift time', r.time]];
    $('endStats').replaceChildren(...stats.map(([k, v]) => { const d = document.createElement('div'); const a = document.createElement('span'); a.textContent = k; const b = document.createElement('b'); b.textContent = v; d.append(a, b); return d; }));
    const items = $('endItems'); items.replaceChildren();
    for (const row of r.rows) {
      const d = document.createElement('div'); d.className = 'item-row';
      const ok = document.createElement('span'); ok.className = 'ok ' + (row.m ? (row.ok ? 'y' : row.part ? 'p' : 'n') : 'm'); ok.textContent = row.m ? (row.ok ? '✔' : row.part ? '~' : '✘') : '–';   // ~ is an acceptable call
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = row.f.name + ' '; const sm = document.createElement('small'); sm.textContent = ROOMS[row.f.room].name; nm.append(sm);
      const pts = document.createElement('span'); pts.className = 'pts'; pts.textContent = (row.pts > 0 ? '+' : '') + row.pts;
      const calls = document.createElement('span'); calls.className = 'calls';
      const yours = document.createElement('span'); yours.className = 'cat-pill c' + (row.m ? row.m.cat : 0); if (!row.m) { yours.style.background = '#d8cfb2'; } yours.textContent = 'You: ' + (row.m ? CATS[row.m.cat].short : 'not marked');
      const right = document.createElement('span'); right.className = 'cat-pill c' + row.v.cat; right.textContent = 'Actual: ' + CATS[row.v.cat].short; right.style.marginLeft = '.4em';
      calls.append(yours, right);
      if (row.fixable) { const sf = document.createElement('span'); sf.textContent = row.safe ? '  made safe' : '  left live'; sf.style.color = row.safe ? '#3c9a2f' : '#c0270f'; calls.append(sf); }
      if (row.v.cat >= 2) { const ph = document.createElement('span'); ph.textContent = row.photo ? '  \u{1F4F7} photo' : '  no photo'; ph.style.color = row.photo ? '#3c9a2f' : '#c0270f'; calls.append(ph); }
      const why = document.createElement('span'); why.className = 'why'; SopLinks.why(why, row.v.why, row.v.cat);
      d.append(ok, nm, pts, calls, why); items.append(d);
    }
    // other things you marked: not on the work order, but correct ones are extra credit
    if (r.extra.length) {
      const h = document.createElement('h3'); h.textContent = 'Not on the work order'; items.append(h);
      if (r.bonus) { const p = document.createElement('p'); p.className = 'cover-note'; p.textContent = `Extra credit for the optional calls you got right: +${r.bonus}. It counts toward your score, but it doesn't cancel anything you missed.`; items.append(p); }
      for (const e of r.extra) {
        const d = document.createElement('div'); d.className = 'item-row';
        const ok = document.createElement('span'); ok.className = 'ok ' + (e.ok ? 'y' : e.part ? 'p' : 'n'); ok.textContent = e.ok ? '✔' : e.part ? '~' : '✘';
        const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = e.name + ' '; const sm = document.createElement('small'); sm.textContent = ROOMS[e.room].name + ' · optional'; nm.append(sm);
        const pts = document.createElement('span'); pts.className = 'pts'; pts.textContent = e.ok ? '+' + PTS.extra : e.part ? '+' + Math.round(PTS.extra / 2) : '0';
        const calls = document.createElement('span'); calls.className = 'calls';
        const yours = document.createElement('span'); yours.className = 'cat-pill c' + e.m.cat; yours.textContent = 'You: ' + CATS[e.m.cat].short;
        const right = document.createElement('span'); right.className = 'cat-pill c' + e.cat; right.textContent = 'Actual: ' + CATS[e.cat].short; right.style.marginLeft = '.4em';
        calls.append(yours, right);
        const why = document.createElement('span'); why.className = 'why'; SopLinks.why(why, e.why, e.cat);
        d.append(ok, nm, pts, calls, why); items.append(d);
      }
    }
    // things you documented that aren't on the checklist: listed, never scored
    const extraShots = Game.gallery.filter(e => !e.fid), names = [...new Set([...extraShots.map(e => e.label), ...Game.jotted])];
    if (names.length) {
      const d = document.createElement('div'); d.className = 'item-row';
      const ok = document.createElement('span'); ok.className = 'ok m'; ok.textContent = '+';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = 'Also documented '; const sm = document.createElement('small'); sm.textContent = 'not scored'; nm.append(sm);
      const pts = document.createElement('span'); pts.className = 'pts'; pts.textContent = '0';
      const why = document.createElement('span'); why.className = 'why';
      why.textContent = names.map(n => n + (extraShots.some(e => e.label === n) ? (Game.jotted.has(n) ? ' (photo, note)' : ' (photo)') : ' (note)')).join(', ') + '. Thorough records never count against you.';
      d.append(ok, nm, pts, why); items.append(d);
    }
    const strip = $('endPhotos'); strip.replaceChildren();
    const shots = Object.entries(Game.photos).map(([fid, url]) => [truth(fid).name, url]).concat(extraShots.map(e => [e.label, e.url]));
    shots.slice(0, 6).forEach(([name, url], i) => {
      const fig = document.createElement('figure'); fig.style.setProperty('--r', (i % 2 ? 2.5 : -2) + 'deg');
      const img = new Image(); img.src = url; img.alt = 'Photo of the ' + name;
      const cap = document.createElement('figcaption'); cap.textContent = name;
      fig.append(img, cap); strip.append(fig);
    });
    setupShare(r);
    UI.closeAll(); UI.open('endScreen'); $('endScreen').querySelector('.panel').scrollTop = 0;
    setTimeout(() => Audio2.synth('stamp'), 420);
    Progress.best(r.score);
  }
};

/* ============================== THE DEBRIEF ==============================
   Before the grade sheet, the property manager walks you through how it went: what you nailed, what you
   missed and why it matters. The sheet afterwards has every line item. */
const Debrief = {
  pages: [], i: 0, done: null,
  start(r, done) {
    this.pages = this.build(r); this.i = 0; this.done = done;
    Music.play(Music.forGrade(r.grade), 1.2);              // the verdict's music, through to the grade sheet
    UI.closeAll(); UI.open('debriefScreen'); this.show();
  },
  build(r) {
    const rows = r.rows, out = [], lc = x => lower((x.f || x).say || (x.f || x).name);
    const pct = r.score / r.max;
    out.push(pct >= .9 ? `Okay, I read your form for ${Game.unit}. Honestly? Nice work. Let me go over a couple of things before I sign off.`
      : pct >= .65 ? `Okay, I went through your form for ${Game.unit}. Mostly good. There are a few things we need to talk about.`
      : `So. I went through your form for ${Game.unit}. Grab a coffee. We need to talk.`);
    const missedHaz = rows.filter(x => x.v.cat === 3 && !x.ok), caught = rows.filter(x => x.v.cat === 3 && x.ok);
    for (const x of missedHaz) out.push(`The ${lc(x.f)}. ${x.m ? `You marked it ${CATS[x.m.cat].short}` : 'You never marked it'}, and that one was a hazard. ${x.v.why}` + (x.ev ? ' Your own notes caught the problem, too. Trust them.' : ''));
    if (caught.length) out.push(`You flagged the ${list(caught.map(lc))} as ${caught.length > 1 ? 'hazards' : 'a hazard'}. Good. Those are the ones that can hurt somebody, and you caught ${caught.length > 1 ? 'them' : 'it'}.` + (caught.some(x => !x.photo) ? ' Next time, get a photo of every hazard so maintenance knows what they\'re walking into.' : ''));
    const howFix = x => HAZARD_FIX[x.f.id].gas ? `shut off the gas to ${HAZARD_FIX[x.f.id].what}` : `killed the breaker for ${HAZARD_FIX[x.f.id].what}`;
    const madeSafe = rows.filter(x => x.fixable && x.safe), leftLive = rows.filter(x => x.fixable && !x.safe);
    if (madeSafe.length) out.push(`And you ${list(madeSafe.map(howFix))} before you left. That's the right order: make it safe first, then write it up.`);
    for (const x of leftLive) out.push(HAZARD_FIX[x.f.id].gas ? `The range was leaking gas, and it was still on when you left. The shut-off is in the cabinet left of the range: yellow handle, turn it across the pipe. Next time, that comes first.`
      : `The ${lc(x.f)} was still live when you left. The breaker panel is on the kitchen wall by the door. Kill the circuit first, then write it up.`);
    const untold = caught.filter(x => !x.told), told = caught.filter(x => x.told);
    if (untold.length) out.push(`Nobody called maintenance about the ${list(untold.map(lc))}. A hazard on a form doesn't get fixed until somebody reads it on Monday. Call it in before you leave; Dana will always lend you her phone.`);
    else if (told.length) out.push(`And you called ${told.length > 1 ? 'them' : 'it'} in to Gus before you left.${Game.maint && Game.maint.silly ? ' He did mention you asked him something about his refrigerator. Or birds? Let\'s keep it professional.' : ' He said it was the clearest report he\'s had all month.'}`);
    const wrongful = [...rows.filter(x => x.m && x.m.cat === 2 && x.v.cat < 2), ...r.extra.filter(e => e.m.cat === 2 && e.cat < 2).map(e => ({ f: e, v: { cat: e.cat, why: e.why } }))];
    for (const x of wrongful.slice(0, 2)) out.push(`You put the ${lc(x.f)} down as ${Sites.w('damage')}. It's ${x.v.cat === 1 ? Sites.w('wear') : 'fine'}. ${x.v.why} If that charge went out, the ${Sites.w('tenant')} would dispute it, and they'd win.`);
    const noPhoto = rows.filter(x => x.ok && x.v.cat === 2 && !x.photo);
    if (noPhoto.length) out.push(`The ${list(noPhoto.map(lc))}: right call, but no photo. No photo, no charge. That's $${noPhoto.reduce((a, x) => a + x.v.cost, 0)} we can't collect.`);
    const missedDmg = rows.filter(x => x.v.cat === 2 && x.m && x.m.cat < 2);
    for (const x of missedDmg.slice(0, 2)) out.push(`The ${lc(x.f)}. You called it ${CATS[x.m.cat].short}, but that's ${Sites.w('damage')}. ${x.v.why}`);
    const over = rows.filter(x => x.m && x.m.cat === 3 && x.v.cat < 3);
    if (over.length) out.push(`You flagged the ${list(over.map(lc))} as ${over.length > 1 ? 'hazards' : 'a hazard'}. ${over.length > 1 ? "They aren't" : "It isn't"}. I'd rather you be careful than sorry, but emergency calls cost real money, and maintenance stops believing them.`);
    const gray = [...rows.filter(x => x.part), ...r.extra.filter(e => e.part).map(e => ({ f: e, m: e.m, v: { cat: e.cat } }))];
    const sh = c => CATS[c].short.toLowerCase();
    if (gray.length) out.push(`You called ${list(gray.slice(0, 3).map(x => `the ${lc(x.f)} ${sh(x.m.cat)} (I'd say ${sh(x.v.cat)})`))}. ${gray.length > 1 ? 'Those are gray areas, and your calls are defensible' : "That's a gray area, and your call is defensible"}. Partial credit.`);
    const unmarked = rows.filter(x => !x.m && x.v.cat !== 3);
    if (unmarked.length) out.push(`You never wrote up the ${list(unmarked.map(lc))}. ${unmarked.length > 1 ? 'Those were' : 'That was'} on the work order: ${unmarked.map(x => `${lc(x)}, ${CATS[x.v.cat].short.toLowerCase()}`).join('; ')}.`);
    const extraOk = r.extra.filter(e => e.ok);
    if (extraOk.length) out.push(`You also wrote up a few things that weren't on the work order, like the ${list(extraOk.slice(0, 3).map(lc))}. Good eye.` + (missedHaz.length ? ` That's extra credit, though. It doesn't buy back a missed hazard.` : rows.some(x => !x.ok) ? ` That counts for something, but it's on top of the work order, not instead of it.` : ' And you got the whole work order, too.'));
    const thin = rows.filter(x => x.ok && !x.ev).length;
    if (thin >= 4) out.push(`A lot of your calls were right, but your notes are thin. Touch it, smell it, measure it. If a charge ends up in a dispute, your notes are all we have.`);
    else if (r.evidence >= r.total - 2) out.push(`Your field notes are great, by the way. Measurements, smells, all of it. That's exactly what holds up in a dispute.`);
    if (r.ppeMiss && r.ppeMiss.length) out.push(`One more thing, and it's a big one: you walked in without your ${list(r.ppeMiss.map(id => PPE_ITEMS[id].short))}. You can't write a crew up for PPE you're not wearing yourself. Suit up at the rack first, every time.`);
    else if (r.ppeTotal) out.push(`And you had your PPE on the whole time. That matters more than people think: the crews notice.`);
    const call = Debrief.callPage(); if (call) out.push(call);
    if (Decor.cur && Decor.cur.rug) out.push(Game.opened.rug ? `Oh, and the area rug the tenant left. I'll have maintenance haul it out. It really tied the room together, but it's not ours to keep.`
      : `Oh, and the area rug the tenant left. You know it really tied the room together, man. Still, I'll have maintenance haul it out before the cleaners come.${cond('carpet') === 2 ? ' Somebody should have looked under it, though.' : ''}`);
    if (Game.order) out.push(`Dana also says you ordered dinner on her phone. ${list(Game.order.items.map(x => x.replace(/ \(\d+\)$/, '').toLowerCase()))} from ${Game.order.from}? Pickup's at 5:30, so I'll keep this short.`);
    if (Game.bag.length) out.push(`Also, Dana says you've been collecting things.${Game.bag.includes('stapler') ? ' Is that a red stapler?' : Game.bag.includes('tie') ? ' Is that a necktie?' : ''} ...Keep it. Nobody's coming back for it.`);
    out.push(pct >= .9 ? `That's it. Clean work. I'm putting your name in for ${Sites.w('promo')} next month.`
      : pct >= .65 ? `That's the list. You're getting there. Take the SOP binder home this weekend.`
      : `Okay. We'll do a ride-along on the next one. The SOP binder is your new best friend.`);
    return out;
  },
  /* Pat heard about the phone call */
  callPage() {
    const c = Game.call; if (!c) return '';
    const who = c.tenant.split(' ')[0], it = c.item ? lower(c.item) : '', g = csGrade(c.cs);
    const tone = g === 'A' ? `${who} called about the deposit, and you handled it like a pro. Calm, clear, no promises you can't keep.`
      : g === 'B' ? `${who} called about the deposit. You did fine on the phone. A little smoother next time.`
      : g === 'C' ? `${who} called about the deposit. You got through it, but it got tense in spots. Explain things plainly, and don't argue.`
      : `${who} called about the deposit, and it did not go well. Listen first. Never argue, never threaten, and never promise what only I can approve.`;
    const money = {
      waived: c.truth === 2 ? ` The ${it} charge got dropped. The damage was real, but ${c.photo ? 'it went to the tenant anyway' : "there was no photo, so we couldn't prove it"}. Now we foot the bill for that repair, $${c.cost}.` : '',
      caved: ` You dropped the ${it} charge without even checking your report. The damage was real. Now we foot the bill for that repair, $${c.cost}.`,
      reduced: ` We prorated the ${it} down to $${c.share}. That's the right call when something was already old.`,
      reversed: c.truth !== null && c.truth < 2 ? ` And you were right to take the ${it} charge off. That was normal wear. It never should have been on the statement.` : ` The ${it} charge came off. Their move-in checklist backed them up.`,
      court: c.truth !== null && c.truth < 2 ? ` The ${it} was normal wear, and now ${who} is taking us to small claims over it. We'll lose, and we may owe a penalty on top of the refund.` : ` Now ${who} is filing in small claims over the ${it}.${c.photo ? ' At least we have your photo.' : ' With no photo, we lose, and we foot the bill for that repair.'}`,
      kept: c.item ? ` The ${it} charge held up${c.photo ? ', because you had the photo' : ''}.` : '',
      none: c.hasFound ? ` And you had the ${c.found} in your bag? That's going to get us a nice review.` : ''
    }[c.outcome] || '';
    const manner = c.rude ? ` And I heard some of what you said to ${who}. We don't talk to residents like that, even when we're right. Especially when we're right.`
      : c.flat ? ` You weren't rude, but you weren't much help, either. "It's on the statement" isn't an answer. Explain it like you'd want it explained to you.` : '';
    return tone + money + manner + (c.promised ? ' Also: you promised something on that call. Only I can approve changes to a statement. Run it by me first.' : '');
  },
  show() {
    const last = this.i >= this.pages.length - 1;
    $('debriefText').textContent = this.pages[this.i];
    $('debriefPage').textContent = `${this.i + 1} / ${this.pages.length}`;
    $('debriefNext').textContent = last ? 'See the report >' : 'Next >';
    Sprites.portrait($('mgrPortrait'), 'mgr', true); clearTimeout(this._m); this._m = setTimeout(() => Sprites.portrait($('mgrPortrait'), 'mgr', false), 900);
    Audio2.synth('blip');
  },
  next() {
    if (this.i < this.pages.length - 1) { this.i++; this.show(); return; }
    UI.close('debriefScreen'); this.done && this.done();
  }
};
