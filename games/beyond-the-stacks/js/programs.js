/* JS/PROGRAMS.JS - The program cards, and the math behind a scheduled program: room fit,
   marketing reach, projected attendance, cost, recurring series, and what happens to
   Goodwill/Circulation afterwards.

   CARDS: the built-in cards (GameData.PROGRAMS) plus any you make in the Card Workshop
   (custom: true, ids starting "c_"). Custom cards are kept in this browser (localStorage)
   and in the saved game. A deleted custom card that's still on the calendar is archived
   (hidden from the deck) rather than removed, so its bookings keep working.

   A scheduled program ("event") looks like:
     { id, program, week, day, slot, room, scope, marketing, addons:{juice,coffee},
       bookedWeek, inherited, status:'scheduled'|'done'|'cancelled', result,
       seriesId, origWeek, origDay, exception }
   bookedWeek is when its marketing went out; lead time = week - bookedWeek.

   A recurring SERIES (state.series) is the rule that makes those events:
     { id, program, slot, room, scope, marketing, addons, bookedWeek,
       pattern: { type:'weekly', every:1..4, days:[0..5] } | { type:'monthly', nth:1..5 (5 = last), day:0..5 },
       start:{week,day}, end: { type:'quarter' } | { type:'date', week, day } | { type:'count', n } }
   Each session is its own event with seriesId. Changing one session marks it an exception;
   changing the series updates every upcoming session that isn't an exception. */

window.Programs = (function () {
  const GD = () => GameData;
  const byId = {};
  let custom = [], hidden = new Set(), names = {};
  const CARDS_KEY = 'bts-cards-v1', HIDDEN_KEY = 'bts-cards-hidden', NAMES_KEY = 'bts-cards-names';
  // built-in cards can be renamed: names[id] overrides the title shown everywhere
  const builtins = () => GameData.PROGRAMS.map(p => names[p.id] ? Object.assign({}, p, { title: names[p.id], renamed: true }) : p);
  function rebuild() {
    Object.keys(byId).forEach(k => delete byId[k]);
    builtins().forEach(p => { byId[p.id] = p; });
    custom.forEach(p => { byId[p.id] = p; });
  }
  function loadLocal() {
    try {
      custom = JSON.parse(localStorage.getItem(CARDS_KEY) || '[]').filter(c => c && c.id);
      hidden = new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'));
      names = JSON.parse(localStorage.getItem(NAMES_KEY) || '{}') || {};
    } catch (e) { custom = []; hidden = new Set(); names = {}; }
    rebuild();
  }
  function saveLocal() {
    try { localStorage.setItem(CARDS_KEY, JSON.stringify(custom)); localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden])); localStorage.setItem(NAMES_KEY, JSON.stringify(names)); } catch (e) { /* storage blocked */ }
  }
  loadLocal();

  const get = (id) => byId[id] || byId.storytime;
  // an event may carry an unsaved card (the Card Workshop's preview) as ev._card
  const cardOf = (ev) => ev._card || get(ev.program);
  const exists = (id) => !!byId[id];
  // everything that should show in the deck, built-ins first
  const deck = () => builtins().filter(p => !hidden.has(p.id)).concat(custom.filter(p => !p.archived && !hidden.has(p.id)));
  const allCards = () => builtins().concat(custom.filter(p => !p.archived));
  // rename any card; an empty name puts a built-in card back to its original title
  function rename(id, title) {
    title = String(title || '').trim().slice(0, 48);
    const c = custom.find(x => x.id === id);
    if (c) { if (title) c.title = title; }
    else if (GameData.PROGRAMS.some(p => p.id === id)) {
      const orig = GameData.PROGRAMS.find(p => p.id === id).title;
      if (!title || title === orig) delete names[id]; else names[id] = title;
    }
    rebuild(); saveLocal();
  }
  const originalTitle = (id) => { const p = GameData.PROGRAMS.find(x => x.id === id); return p ? p.title : null; };
  const cardNames = () => Object.assign({}, names);
  function adoptNames(n) { if (n && typeof n === 'object') { Object.keys(n).forEach(k => { if (!names[k]) names[k] = n[k]; }); rebuild(); saveLocal(); } }
  const isHidden = (id) => hidden.has(id);
  function setHidden(id, on) { if (on) hidden.add(id); else hidden.delete(id); saveLocal(); }
  function customCards() { return custom.slice(); }
  // merge cards from a saved game (so a save made in another browser still has its cards)
  function adoptCards(list) {
    (list || []).forEach(c => { if (c && c.id && !custom.some(x => x.id === c.id)) custom.push(c); });
    rebuild(); saveLocal();
  }
  function saveCard(card) {
    card.custom = true;
    if (!card.id) card.id = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const i = custom.findIndex(c => c.id === card.id);
    if (i >= 0) custom[i] = card; else custom.push(card);
    rebuild(); saveLocal();
    return card;
  }
  // inUse: true if bookings still point at it (then it's archived, not removed)
  function deleteCard(id, inUse) {
    const i = custom.findIndex(c => c.id === id); if (i < 0) return;
    if (inUse) custom[i].archived = true; else custom.splice(i, 1);
    hidden.delete(id); rebuild(); saveLocal();
  }

  const slot = (id) => GD().SLOTS.find(s => s.id === id);
  const startOf = (ev) => slot(ev.slot).time;
  const endOf = (ev) => startOf(ev) + get(ev.program).duration;
  const dayIndex = (ev) => (ev.week - 1) * GD().CALENDAR.days.length + ev.day;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // a series' marketing is paid once for the whole series, not per session
  function cost(ev) {
    const p = get(ev.program), v = GD().VENUES[ev.room];
    let c = p.cost + (ev.seriesId ? 0 : GD().MARKETING[ev.marketing].cost) + (v ? v.fee : 0);
    Object.keys(ev.addons || {}).forEach(k => { if (ev.addons[k]) c += GD().ADDONS[k].cost; });
    return c;
  }

  function marketing(ev) {
    let lead = ev.week - ev.bookedWeek;
    // once a series is announced it stays fresh (a weekly regular can't be "announced too early")
    const effLead = ev.seriesId ? Math.min(lead, 6) : lead;
    const timing = GD().timingMultiplier(effLead);
    const tier = GD().MARKETING[ev.marketing];
    const late = tier.minLead && lead < tier.minLead;
    const reach = late ? tier.lateReach : tier.reach;
    return { lead, timing, tier, late, reach, mult: timing.mult * (1 + reach) };
  }

  // ---------------------------------------------------------------- recurring series
  const C = () => GD().CALENDAR;
  const absDay = (w, d) => (w - 1) * C().days.length + d;
  // the dates (week, day) a series pattern produces, in order
  function seriesDates(sr) {
    const out = [], cal = C(), W = cal.weeks, ND = cal.days.length;
    const startAbs = absDay(sr.start.week, sr.start.day);
    // ends on a date, after n sessions, at the end of the quarter it starts in, or at the end of the year
    const endAbs = sr.end && sr.end.type === 'date' ? absDay(sr.end.week, sr.end.day)
      : sr.end && sr.end.type === 'quarter' ? absDay(GD().quarterOf(sr.start.week).last, ND - 1) : absDay(W, ND - 1);
    const max = sr.end && sr.end.type === 'count' ? Math.max(1, sr.end.n) : Infinity;
    const p = sr.pattern;
    for (let w = 1; w <= W && out.length < max; w++) {
      for (let d = 0; d < ND && out.length < max; d++) {
        const a = absDay(w, d);
        if (a < startAbs || a > endAbs) continue;
        if (p.type === 'weekly') {
          if (!p.days.includes(d)) continue;
          const wkSince = w - sr.start.week;
          if (wkSince % Math.max(1, p.every) !== 0) continue;
        } else if (p.type === 'monthly') {
          if (d !== p.day) continue;
          const dt = Game.dateOf(w, d), dom = dt.getDate();
          const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
          if (p.nth === 5 ? dom + 7 <= last : Math.ceil(dom / 7) !== p.nth) continue;
        }
        out.push({ week: w, day: d });
      }
    }
    return out;
  }
  function describePattern(sr) {
    const cal = C(), p = sr.pattern;
    const names = (ds) => ds.map(d => cal.dayNames[d]).join(', ').replace(/, ([^,]*)$/, ' and $1');
    let txt;
    if (p.type === 'weekly') {
      const ds = p.days.slice().sort();
      const weekdays = ds.length === 5 && !ds.includes(5);
      txt = (p.every === 1 ? 'Every ' : 'Every ' + p.every + ' weeks on ') + (weekdays ? 'weekday' : names(ds));
    } else txt = 'The ' + ['', 'first', 'second', 'third', 'fourth', 'last'][p.nth] + ' ' + cal.dayNames[p.day] + ' of each month';
    return txt;
  }

  // How well a room suits a program. tone: good | ok | bad
  function roomFit(programId, room) {
    const p = typeof programId === 'object' ? programId : get(programId), notes = [];
    if (!room) return { fit: 0, tone: 'bad', notes: ['Pick a room.'] };
    if (room.isUtility && !room.isStaff) return { fit: 0.1, tone: 'bad', notes: ['That\'s the restrooms. Please don\'t.'] };
    if (room.isStaff && p.special !== 'tour') return { fit: 0.15, tone: 'bad', staffArea: true, notes: ['Staff-only area: the public isn\'t supposed to be back here.'] };
    let fit = 1;
    const good = p.ideal.filter(t => room.tags.includes(t));
    const bad = p.bad.filter(t => room.tags.includes(t));
    fit += 0.2 * good.length - 0.3 * bad.length;
    if (p.special === 'tour') {
      if (room.isStaff) { fit = 1.3; notes.push('The tour is the one program that belongs behind the scenes.'); }
      else { fit = 0.6; notes.push('A "behind the scenes" tour of a public room? Try the basement.'); }
    }
    if (good.length && p.special !== 'tour') notes.push('Suits it: ' + good.join(', ') + '.');
    if (bad.length) notes.push('Works against it: ' + bad.join(', ') + '.');
    if (p.noise >= 2 && room.isQuiet) notes.push('Loud program in a quiet room: the regulars will walk out.');
    else if (p.noise >= 2 && !room.soundproof && !room.outdoor && !room.isStaff) notes.push('Noise will carry into nearby rooms.');
    if (room.offsite) notes.push('Off-site: ' + room.venue.travel + ' extra staff hour' + (room.venue.travel === 1 ? '' : 's') + ' for travel' + (room.venue.fee ? ', $' + room.venue.fee + ' fee' : '') + '. Nobody in the library hears it.');
    else if (room.soundproof) notes.push('Soundproof: nobody else will hear it.');
    fit = clamp(fit, 0.25, 1.4);
    const tone = fit >= 1.1 ? 'good' : fit >= 0.8 ? 'ok' : 'bad';
    return { fit, tone, notes };
  }

  // An off-site venue as a room-like object (see GameData.VENUES): not on the map, never noisy.
  const venueCache = {};
  function venueRoom(id) {
    const v = GD().VENUES[id]; if (!v) return null;
    return venueCache[id] || (venueCache[id] = { id, name: v.name, color: v.color, emoji: v.emoji, tags: v.tags.slice(), capacity: v.capacity, blurb: v.blurb, hours: v.hours,
      offsite: true, venue: v, isStaff: false, isUtility: false, isQuiet: false, soundproof: true, outdoor: v.tags.includes('outdoor'), floor: null, tiles: [], seats: [] });
  }
  const isVenue = (id) => !!GD().VENUES[id];

  function capacityFor(ev, room) {
    const p = cardOf(ev);
    if (!room) return 0;
    return p.special === 'tour' ? Math.min(p.maxGroup, room.capacity) : room.capacity;
  }

  // seasonal cards shine in their months (1..12, may wrap past December)
  function seasonal(ev) {
    const p = cardOf(ev);
    if (p.special !== 'seasonal' || !p.months) return 1;
    return GD().inMonths(GD().monthOf(ev.week, ev.day), p.months) ? 1.4 : 0.6;
  }
  const monthsText = (m) => m ? (m[0] === m[1] ? GD().MONTHS[m[0] - 1] : GD().MONTHS[m[0] - 1] + ' to ' + GD().MONTHS[m[1] - 1]) : '';

  function novelty(ev, events) {
    const p = cardOf(ev);
    if (p.recurring) return 1;
    const di = dayIndex(ev);
    const recent = events.some(o => o !== ev && o.id !== ev.id && o.program === ev.program && o.status !== 'cancelled' && dayIndex(o) < di && di - dayIndex(o) <= 13);
    return recent ? 0.75 : 1;
  }

  // Expected attendance, by audience. state supplies goodwill + the event list.
  function project(ev, state, room) {
    const p = cardOf(ev), G = GD();
    const sm = G.scopeMath(ev.scope);
    const mk = marketing(ev);
    const v = G.VENUES[ev.room], m = G.monthOf(ev.week, ev.day);
    // a class visit: the school brings the audience, so the marketing barely matters
    const classVisit = !!(v && v.classes && v.classes.includes(ev.slot) && !G.schoolBreak(ev.week, ev.day) && ev.day !== 5);
    const reach = classVisit ? Math.max(mk.mult, 1) : mk.mult;
    const outdoor = room && room.outdoor ? G.OUTDOOR_WEATHER[m] : 1;
    const summerCampus = v && v.kind === 'college' && m >= 6 && m <= 8 ? 0.6 : 1;
    const base = 0.8 * sm.potential * sm.conversion * p.appeal * reach * seasonal(ev) * novelty(ev, state.events) * G.population() * outdoor * summerCampus;
    const avail = G.SLOT_AVAILABILITY[G.dayType(ev.week, ev.day)][ev.slot];
    const weights = {};
    G.DEMO_KEYS.forEach(d => {
      if (d === p.target) return;
      weights[d] = p.also.includes(d) ? 1 : sm.t * 0.6;
    });
    const wsum = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
    const by = {};
    let total = 0;
    G.DEMO_KEYS.forEach(d => {
      const share = d === p.target ? sm.targetShare : (1 - sm.targetShare) * weights[d] / wsum;
      let boost = 1;
      Object.keys(ev.addons || {}).forEach(k => { if (ev.addons[k] && G.ADDONS[k].boost[d]) boost *= G.ADDONS[k].boost[d]; });
      const gw = state.goodwill[d];
      const draw = (v ? v.draw[d] : 1) * (classVisit && d === v.classAudience ? 2.2 : 1);
      const n = base * share * avail[d] * Math.pow(gw / 62, 0.5) * boost * draw;
      by[d] = n; total += n;
    });
    const cap = capacityFor(ev, room);
    // toddlers come with a grown-up, except on a class visit (the class comes with its teacher)
    const people = G.DEMO_KEYS.reduce((s, d) => s + by[d] * (G.DEMOGRAPHICS[d].withCaregiver && !classVisit ? 2 : 1), 0);
    return { by, total, low: Math.round(total * 0.75), high: Math.round(total * 1.25), people, cap, overflowRisk: people > cap, mk, sm, avail, classVisit, outdoor };
  }

  // On the day: roll the actual turnout around the projection.
  function rollTurnout(ev, state, room) {
    const pr = project(ev, state, room);
    const plan = {};
    GD().DEMO_KEYS.forEach(d => {
      const mean = pr.by[d] * (0.75 + Math.random() * 0.5);
      plan[d] = Math.max(0, Math.floor(mean + Math.random()));
    });
    return plan;
  }

  // ---------------------------------------------------------------- results
  // live: sim stats { admitted, turnedAway, walkIns, peakOcc, complaints }
  function resolve(ev, live, state, room, staffOver) {
    const p = get(ev.program), G = GD();
    const fitInfo = roomFit(ev.program, room);
    const sm = G.scopeMath(ev.scope);
    const mk = marketing(ev);
    const cap = capacityFor(ev, room);
    const by = {};
    let total = 0, turned = 0;
    G.DEMO_KEYS.forEach(d => {
      by[d] = (live.admitted[d] || 0) + (live.walkIns[d] || 0);
      total += by[d]; turned += live.turnedAway[d] || 0;
    });
    const crowd = live.peakOcc > cap * 0.95 ? 0.85 : 1;
    const burnout = staffOver ? 0.75 : 1;
    const quality = fitInfo.fit * crowd * burnout;
    const gw = {}; G.DEMO_KEYS.forEach(d => { gw[d] = 0; });
    const posts = [], notes = [];
    const add = (d, v) => { gw[d] += v; };
    const post = (key, demo, vars, delta) => posts.push({ key, demo, vars: Object.assign({ program: p.title, room: room ? room.name : 'room' }, vars || {}), gw: delta || 0 });

    const gain = {};
    G.DEMO_KEYS.forEach(d => {
      gain[d] = 0;
      if (!by[d]) return;
      // happy audiences are harder to impress further: gains shrink as their goodwill climbs
      const room4more = Math.max(0.25, (110 - state.goodwill[d]) / 50);
      gain[d] = quality >= 0.5 ? Math.min(4, by[d] * 0.09 * quality * room4more) : -Math.min(3, by[d] * 0.05);
      add(d, gain[d]);
    });

    const target = p.target, tAtt = by[target] || 0;
    if (ev.scope <= 3 && tAtt >= 5 && quality >= 0.7) { add(target, 2.5); post('niche_positive', target, {}, 2.5); notes.push('Niche focus paid off: ' + G.DEMOGRAPHICS[target].label + ' felt seen.'); }
    if (ev.scope <= 3 && Math.random() < 0.25) { add('adults', -1); add('seniors', -0.5); post('narrow_programming', pickOther(target), {}, -1); }
    if (ev.scope >= 8 && quality >= 0.7) { G.DEMO_KEYS.forEach(d => add(d, 0.5)); if (total >= 10) post('broad_positive', pickTop(by), {}, 0.5); }
    if (ev.scope >= 8 && Math.random() < 0.35) { add(target, -1.5); post('watered_down', target, {}, -1.5); notes.push('Broad scope watered it down for the core ' + G.DEMOGRAPHICS[target].label.toLowerCase() + '.'); }

    Object.keys(ev.addons || {}).forEach(k => {
      if (!ev.addons[k]) return;
      const A = G.ADDONS[k];
      if (Math.random() < A.risk) {
        A.riskDemos.forEach(d => add(d, -A.riskGW));
        post(A.riskKey, A.riskDemos[0], { addon: A.label }, -A.riskGW);
        notes.push(A.label + ' drew a taxpayer complaint.');
      }
    });

    if (turned >= 3) {
      G.DEMO_KEYS.forEach(d => { if (live.turnedAway[d]) add(d, -Math.min(3, live.turnedAway[d] * 0.1)); });
      const worst = pickTop(live.turnedAway);
      post('turned_away', worst, { n: turned }, -Math.round(Math.min(3, live.turnedAway[worst] * 0.1) * 10) / 10);
      notes.push(turned + ' people were turned away: the room was full.');
    }
    if (fitInfo.staffArea) {
      add(target, -3); G.DEMO_KEYS.forEach(d => add(d, -1));
      post('wrong_room_staff', target, {}, -3); notes.push('Held in a staff-only area.');
    } else if (room && room.isUtility) {
      G.DEMO_KEYS.forEach(d => add(d, -5)); post('wrong_room_restroom', target, {}, -5);
    } else if (fitInfo.fit < 0.7) {
      add(target, -1); post('poor_fit', target, {}, -1); notes.push('The room didn\'t suit the program.');
    }
    if (total < 6 && p.special !== 'tour') {
      post('low_turnout', 'staff', { n: total }, 0);
      notes.push('Low turnout.');
      if (mk.lead <= 2) { add(target, -0.5); post('late_notice', target, {}, -0.5); notes.push('Only ' + Math.max(0, mk.lead) + ' week(s) of notice.'); }
    }
    const av = G.SLOT_AVAILABILITY[G.dayType(ev.week, ev.day)][ev.slot][target];
    if (av < 0.3) notes.push(G.DEMOGRAPHICS[target].label + ' mostly aren\'t free at that time.');
    if (p.special === 'seasonal' && seasonal(ev) < 1) post('seasonal_off', target, { when: G.MONTHS[G.monthOf(ev.week, ev.day) - 1] }, 0);
    if (room && room.outdoor && G.OUTDOOR_WEATHER[G.monthOf(ev.week, ev.day)] < 0.7) notes.push('Cold weather kept people home: outdoor programs struggle in winter.');
    if (room && room.offsite && total >= 8) notes.push('Off-site: people who\'d never have come to the library met you where they were.');

    let revenue = 0, signups = 0;
    if (p.special === 'sale') { revenue = Math.round(total * p.revenuePerAttendee * (0.8 + Math.random() * 0.4)); post('sale', 'adults', { n: revenue }, 0); }
    if (p.special === 'cards') { signups = Math.round(total * 0.4); if (signups) post('cards', Math.random() < 0.5 ? 'staff' : pickTop(by), { n: signups }, 0); }
    if (p.special === 'tour' && total >= 4 && quality >= 0.8) post('tour', pickTop(by), {}, 0);
    // going out into the community signs up people who'd never have walked in
    if (room && room.offsite) signups += Math.round(total * 0.12);

    if (quality >= 0.8 && total >= 8 && !posts.some(x => x.gw > 0)) {
      const top = pickTop(by);
      const key = top === 'toddlers' ? 'toddler_positive' : top === 'teens' ? 'teen_positive' : 'positive';
      post(key, top, {}, Math.max(0.1, Math.round(gain[top] * 10) / 10));
    }

    const circ = Math.round(total * p.circ * Math.max(0.3, quality)) + signups * 3;
    G.DEMO_KEYS.forEach(d => { gw[d] = Math.round(gw[d] * 10) / 10; });
    return { attendance: total, by, turnedAway: turned, walkIns: Object.values(live.walkIns).reduce((s, n) => s + n, 0), peak: live.peakOcc, cap, quality, fit: fitInfo.fit, gw, circ, revenue, signups, complaints: live.complaints, posts, notes, lead: ev.seriesId ? Math.min(mk.lead, 6) : mk.lead };
  }

  function pickTop(obj) {
    let best = 'adults', n = -1;
    Object.keys(obj || {}).forEach(k => { if ((obj[k] || 0) > n) { n = obj[k]; best = k; } });
    return best;
  }
  function pickOther(d) { const o = GD().DEMO_KEYS.filter(k => k !== d); return o[Math.floor(Math.random() * o.length)]; }

  return { venueRoom, isVenue, monthsText, get, exists, deck, allCards, customCards, rename, originalTitle, cardNames, adoptNames, adoptCards, saveCard, deleteCard, isHidden, setHidden, slot, startOf, endOf, dayIndex, absDay, cost, marketing, roomFit, capacityFor, project, rollTurnout, resolve, seasonal, novelty, seriesDates, describePattern };
})();
