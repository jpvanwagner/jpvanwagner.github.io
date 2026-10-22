/* JS/ENGINE.JS - Runs the game: state, the clock, the day/week/quarter/year cycle, the hooks
   that turn simulation events into Goodwill and feed posts, the HUD, the map panel, and
   saving. Planning UI lives in planner.js; modals and screens in screens.js. */

window.Game = (function () {
  const GD = GameData, C = GD.CALENDAR;
  const SAVE_KEY = 'bts-save-v2';   // v2: the year-long calendar, off-site venues, city population
  const G = { state: null, fac: null, sim: null, view: null, mapSource: '', running: false };
  const live = {};   // event id -> view info for programs in progress

  // ---------------------------------------------------------------- formatting
  const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  function fmtTime(min) {
    const h = Math.floor(min / 60), m = Math.floor(min % 60);
    return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function dateOf(week, day) {
    const [y, mo, d] = C.startDate;
    return new Date(y, mo, d + (week - 1) * 7 + day);
  }
  function fmtDate(week, day, long) {
    const dt = dateOf(week, day);
    return (long ? C.dayNames[day] : C.days[day]) + ', ' + dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const whenStamp = () => 'Wk ' + G.state.week + ' ' + C.days[G.state.day] + ' ' + fmtTime(G.state.minute);
  G.money = money; G.fmtTime = fmtTime; G.fmtDate = fmtDate; G.dateOf = dateOf; G.whenStamp = whenStamp;

  // ---------------------------------------------------------------- state
  function newState(population) {
    const s = {
      version: 2, week: 1, day: 0, minute: C.hours[0][0], speed: 0, lastSpeed: 2,
      population: population || GD.POPULATION.default,
      budget: GD.START.budget, startBudget: GD.START.budget,
      goodwill: Object.assign({}, GD.START.goodwill), goodwillStart: Object.assign({}, GD.START.goodwill),
      circulation: 0, visits: 0, cards: 0, revenue: 0, spent: 0,
      events: [], nextId: 1, series: [], nextSeriesId: 0,
      lastServed: {}, weekly: [],
      stats: { noiseWalkouts: 0, crowdWalkouts: 0, turnedAway: 0, wrongRooms: 0, attendance: 0, programsRun: 0, leads: [], lowTurnout: 0, servedCount: {} },
      week0: null,
      flags: { pauseWeekly: true, coachDone: false },
    };
    GD.DEMO_KEYS.forEach(d => { s.lastServed[d] = 0; s.stats.servedCount[d] = 0; });
    GD.INHERITED.forEach(i => {
      if (i.repeatUntilWeek) {
        // a weekly regular: a series, one booking per session
        const sr = { id: 'sr' + (++s.nextSeriesId), program: i.program, slot: i.slot, room: i.room, scope: i.scope, marketing: i.marketing, addons: {}, bookedWeek: i.bookedWeek,
          pattern: { type: 'weekly', every: 1, days: [i.day] }, start: { week: i.week, day: i.day }, end: { type: 'date', week: i.repeatUntilWeek, day: i.day }, inherited: true };
        s.series.push(sr);
        Programs.seriesDates(sr).forEach(dt => s.events.push({ id: s.nextId++, program: i.program, week: dt.week, day: dt.day, origWeek: dt.week, origDay: dt.day, slot: i.slot, room: i.room, scope: i.scope, marketing: i.marketing, addons: {}, bookedWeek: i.bookedWeek, inherited: true, status: 'scheduled', seriesId: sr.id }));
        return;
      }
      s.events.push({ id: s.nextId++, program: i.program, week: i.week, day: i.day, slot: i.slot, room: i.room, scope: i.scope, marketing: i.marketing, addons: {}, bookedWeek: i.bookedWeek, inherited: true, status: 'scheduled' });
    });
    s.week0 = snapshotWeek(s); s.quarter0 = snapshotWeek(s);
    return s;
  }
  function snapshotWeek(s) { return { visits: s.visits, circ: s.circulation, gw: overall(s), gwBy: Object.assign({}, s.goodwill), programs: s.stats.programsRun, attendance: s.stats.attendance, walkouts: s.stats.noiseWalkouts + s.stats.crowdWalkouts, turnedAway: s.stats.turnedAway, spent: s.spent, cards: s.cards, offsite: s.stats.offsite || 0 }; }
  function overall(s) { return GD.DEMO_KEYS.reduce((t, d) => t + s.goodwill[d] * GD.DEMOGRAPHICS[d].share, 0); }
  G.overall = () => overall(G.state);
  function adjustGW(d, v) { G.state.goodwill[d] = Math.max(0, Math.min(100, G.state.goodwill[d] + v)); }
  G.adjustGW = adjustGW;

  function save() {
    if (!G.state) return;
    G.state.customCards = Programs.customCards();
    G.state.cardNames = Programs.cardNames();   // the save carries its cards, so it works in another browser too
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.state)); } catch (e) { /* storage blocked: fine */ }
  }
  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.version === 2 ? s : null; } catch (e) { return null; }
  }
  G.loadSave = loadSave; G.save = save;
  G.clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } };

  // staff hours booked in a week (off-site programs add travel time)
  G.staffHours = function (week, exceptId, exceptSeries) {
    return G.state.events.filter(e => e.week === week && e.status !== 'cancelled' && e.id !== exceptId && !(exceptSeries && e.seriesId === exceptSeries)).reduce((s, e) => s + Programs.get(e.program).staff + (GD.VENUES[e.room] ? GD.VENUES[e.room].travel : 0), 0);
  };
  // a library room or an off-site venue, by id
  G.room = (id) => (id && G.fac && G.fac.rooms[id]) || Programs.venueRoom(id);

  // ---------------------------------------------------------------- map
  function useMap(result) {
    G.fac = LibraryMap.build(result.data);
    G.mapData = result.data;
    G.mapSource = result.source;
    // drop room bookings for rooms this map doesn't have
    if (G.state) G.state.events.forEach(e => { if (e.status === 'scheduled' && !G.room(e.room)) e.room = null; });
    G.sim = Sim.create(G.fac, simHooks);
    if (G.view) { G.view.floor = G.fac.ground; G.view.invalidate(); G.view.mapVersion = (G.view.mapVersion || 0) + 1; }
    buildFloorTabs();
    if (viewMode === '3d' && G.running) mount3d();
    const ms = document.getElementById('map-source');
    if (ms) ms.textContent = 'Library map: ' + G.fac.floors.length + ' floors, ' + Object.keys(G.fac.rooms).length + ' rooms, from ' + G.mapSource + ' (built in Mapster)';
  }
  G.loadMapFile = function (file) {
    return LibraryMap.loadFile(file).then(res => {
      useMap(res);
      if (G.state && G.running) startDay(true);
      toast('Loaded map "' + G.fac.name + '" from ' + res.source + '.');
      Planner.refresh();
    }).catch(err => toast('Couldn\'t load that map: ' + err.message, 'bad'));
  };
  G.reloadDefaultMap = function () {
    return LibraryMap.loadDefault().then(res => { useMap(res); if (G.state && G.running) startDay(true); Planner.refresh(); toast('Back to the library map.'); });
  };

  function buildFloorTabs() {
    const tabs = document.getElementById('floor-tabs');
    tabs.innerHTML = '';
    G.fac.floors.slice().forEach(fl => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.floor = fl.index;
      b.innerHTML = '<span>' + fl.name + '</span><em class="cnt" data-floor-count="' + fl.index + '">0</em>';
      b.addEventListener('click', () => setFloor(fl.index));
      tabs.appendChild(b);
    });
    setFloor(G.view ? G.view.floor : G.fac.ground);
  }
  function setFloor(f) {
    G.view.floor = f;
    if (viewMode === '3d') View3D.setFloor(f);
    document.querySelectorAll('#floor-tabs button').forEach(b => { const on = +b.dataset.floor === f; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    hideRoomTip();
  }
  G.setFloor = setFloor;

  // ---------------------------------------------------------------- simulation hooks
  const simHooks = {
    goodwill: (d) => G.state.goodwill[d],
    onVisit: () => { G.state.visits++; },
    onLeave: (a) => {
      if (a.kind !== 'passive' || a.angry) return;
      const p = GD.DEMOGRAPHICS[a.demo].checkout * (1 + Math.min(0.3, G.state.cards * 0.004));
      if (Math.random() < p) G.state.circulation += 1 + (Math.random() < 0.3 ? 1 : 0);
    },
    onAngry: (a, why, room, src) => {
      const sens = a.demo === 'seniors' ? 0.7 : 0.45;
      adjustGW(a.demo, -sens);
      if (why === 'noise') G.state.stats.noiseWalkouts++; else G.state.stats.crowdWalkouts++;
      let key = 'crowded';
      if (why === 'noise') key = room.id === 'teen' ? 'noise_teen' : (room.isQuiet ? 'noise_reference' : 'noise_generic');
      Feed.addThrottled(key + ':' + room.id, G.state.minute + G.state.day * 2000, 120, { key, demo: a.demo, vars: { room: room.name }, gw: -sens }, whenStamp());
      flashRoom(room);
    },
    onTeenOverflow: (room) => {
      if (Feed.addThrottled('overflow:' + room.id, G.state.minute + G.state.day * 2000, 300, { key: 'teen_overflow', demo: 'seniors', vars: { room: room.name }, gw: -0.3 }, whenStamp())) adjustGW('seniors', -0.3);
    },
  };

  // the map pulses a room red when someone walks out of it
  function flashRoom(room) { room._flash = performance.now(); if (viewMode === '3d') View3D.flash(room.id); }

  // ---------------------------------------------------------------- the day
  function todaysEvents() {
    const s = G.state;
    return s.events.filter(e => e.week === s.week && e.day === s.day && e.status === 'scheduled' && e.room);
  }

  function startDay(restart) {
    const s = G.state, [open, close] = C.hours[s.day];
    if (!restart) s.minute = open;
    // a holiday: the library is closed, and the day goes by
    const hol = GD.holidayOn(s.week, s.day);
    if (hol && !restart) {
      Feed.add({ system: true, title: 'Closed: ' + hol, emoji: '1f3e0', text: 'The library is closed today. See you ' + (s.day === C.days.length - 1 ? 'next week' : 'tomorrow') + '.' }, whenStamp(), { silent: true });
      s.events.forEach(e => { if (e.week === s.week && e.day === s.day && e.status === 'scheduled') { e.status = 'cancelled'; e.result = { notes: ['The library was closed for ' + hol + '.'] }; } });
      s.minute = close;
      endDay();   // straight on to the next day (or week)
      return;
    }
    Object.keys(offsite).forEach(k => delete offsite[k]);
    const events = todaysEvents().filter(e => !GD.VENUES[e.room]).map(e => {
      const p = Programs.get(e.program), room = G.fac.rooms[e.room];
      return {
        id: e.id, program: e.program, room: e.room, start: Programs.startOf(e), end: Programs.endOf(e),
        noise: p.noise, walkIn: !!p.walkIn, cap: Programs.capacityFor(e, room),
        access: (p.special === 'tour' || (room && room.isStaff)) ? 'staff' : 'public',
        plan: Programs.rollTurnout(e, s, room),
      };
    });
    G.sim.startDay({ week: s.week, day: s.day, saturday: s.day === 5, open, close, events });
    Object.keys(live).forEach(k => delete live[k]);
    G.view.live = live;
    if (!restart) save();
    Planner.refresh(); refreshHUD();
  }

  // off-site programs don't go through the library simulation: their turnout is rolled from
  // the projection when they start, and they finish on time
  const offsite = {};
  function checkOffsite(e) {
    const s = G.state, p = Programs.get(e.program), v = GD.VENUES[e.room], room = G.room(e.room);
    let o = offsite[e.id];
    if (!o && s.minute >= Programs.startOf(e)) {
      const plan = Programs.rollTurnout(e, s, room), admitted = {}, turnedAway = {}, cls = Programs.project(e, s, room).classVisit;
      let left = room.capacity, peak = 0;
      GD.DEMO_KEYS.forEach(d => { const per = GD.DEMOGRAPHICS[d].withCaregiver && !cls ? 2 : 1; const n = Math.max(0, Math.min(plan[d], Math.floor(left / per))); admitted[d] = n; turnedAway[d] = plan[d] - n; left -= n * per; peak += n * per; });
      o = offsite[e.id] = { started: true, L: { admitted, turnedAway, walkIns: {}, peakOcc: peak, complaints: 0 } };
      toast(p.title + ' is starting at ' + v.name + '.', 'info', p.emoji);
    }
    if (o && !o.done && s.minute >= Programs.endOf(e)) { o.done = true; s.stats.offsite = (s.stats.offsite || 0) + 1; finishEvent(e, o.L); }
  }

  function checkEvents() {
    const s = G.state;
    todaysEvents().forEach(e => {
      if (GD.VENUES[e.room]) { checkOffsite(e); return; }
      const L = G.sim.liveStats(e.id); if (!L) return;
      const p = Programs.get(e.program);
      if (!L.started && s.minute >= Programs.startOf(e)) {
        G.sim.startEvent(e.id);
        live[e.id] = { room: e.room, noise: p.noise, emoji: p.emoji, title: p.title };
        toast(p.title + ' is starting in the ' + G.room(e.room).name + '.', 'info', p.emoji);
      }
      if (L.started && !L.ended && s.minute >= Programs.endOf(e)) {
        G.sim.endEvent(e.id);
        delete live[e.id];
        finishEvent(e, L);
      }
    });
  }

  function finishEvent(e, L) {
    const s = G.state, p = Programs.get(e.program), room = G.room(e.room);
    const over = G.staffHours(e.week) > GD.START.staffHoursPerWeek;
    const r = Programs.resolve(e, L, s, room, over);
    e.status = 'done'; e.result = { attendance: r.attendance, by: r.by, turnedAway: r.turnedAway, quality: r.quality, gw: r.gw, circ: r.circ, notes: r.notes, complaints: r.complaints, revenue: r.revenue, signups: r.signups };
    GD.DEMO_KEYS.forEach(d => adjustGW(d, r.gw[d]));
    s.circulation += r.circ; s.cards += r.signups;
    if (r.revenue) { s.budget += r.revenue; s.revenue += r.revenue; Sfx.play('cash'); }
    s.stats.attendance += r.attendance; s.stats.programsRun++; s.stats.turnedAway += r.turnedAway;
    s.stats.leads.push(r.lead);
    if (r.attendance < 6 && p.special !== 'tour') s.stats.lowTurnout++;
    if (room && (room.isStaff && p.special !== 'tour' || room.isUtility)) s.stats.wrongRooms++;
    if (r.attendance >= 3) { s.lastServed[p.target] = s.week; s.stats.servedCount[p.target]++; }
    r.posts.forEach((post, i) => setTimeout(() => Feed.add(post, whenStamp()), 250 * i));
    const net = GD.DEMO_KEYS.reduce((t, d) => t + r.gw[d] * GD.DEMOGRAPHICS[d].share, 0);
    toast(p.title + ': ' + r.attendance + ' came' + (r.turnedAway ? ', ' + r.turnedAway + ' turned away' : '') + '. Goodwill ' + (net >= 0 ? '+' : '') + net.toFixed(1) + '.', net >= 0 ? 'good' : 'bad', p.emoji);
    Planner.refresh();
  }

  function endDay() {
    G.sim.endDay();
    Object.keys(live).forEach(k => delete live[k]);
    const s = G.state;
    // anything left on today's calendar (e.g. a room that no longer exists) quietly drops off
    s.events.forEach(e => { if (e.week === s.week && e.day === s.day && e.status === 'scheduled') { e.status = 'cancelled'; e.result = { notes: ['Never ran: it had no room.'] }; } });
    s.day++;
    if (s.day >= C.days.length) { endWeek(); return; }
    startDay();
  }

  function endWeek() {
    const s = G.state;
    // goodwill drifts down without programming; audiences nobody served lately notice
    GD.DEMO_KEYS.forEach(d => {
      adjustGW(d, -0.6);
      if (s.week >= 3 && s.lastServed[d] < s.week - 2) {
        adjustGW(d, -1.2);
        Feed.add({ key: 'underserved', demo: d, vars: {}, gw: -1.2 }, 'Wk ' + s.week + ' Sat');
      }
    });
    const w0 = s.week0, now = snapshotWeek(s);
    const wk = { week: s.week, visits: now.visits - w0.visits, circ: now.circ - w0.circ, programs: now.programs - w0.programs, attendance: now.attendance - w0.attendance, walkouts: now.walkouts - w0.walkouts, gw: now.gw, gwDelta: now.gw - w0.gw };
    // the end of a quarter: the Board's quarterly report (the whole year is reviewed after week 52)
    const q = GD.quarterOf(s.week), quarterEnd = s.week === q.last && s.week < C.weeks;
    let qr = null;
    if (quarterEnd) {
      const q0 = s.quarter0 || s.week0;
      qr = { quarter: q, visits: now.visits - q0.visits, circ: now.circ - q0.circ, programs: now.programs - q0.programs, attendance: now.attendance - q0.attendance, walkouts: now.walkouts - q0.walkouts, turnedAway: now.turnedAway - (q0.turnedAway || 0), spent: now.spent - (q0.spent || 0), cards: now.cards - (q0.cards || 0), offsite: now.offsite - (q0.offsite || 0), gw: now.gw, gwDelta: now.gw - q0.gw, gwBy: now.gwBy, gwBy0: q0.gwBy || now.gwBy };
      (s.quarters = s.quarters || []).push(qr);
      s.quarter0 = now;
    }
    s.weekly.push(wk);
    Feed.add({ system: true, title: 'Week ' + s.week + ' wrap-up', emoji: '1f4c8', text: wk.visits + ' visits · ' + wk.programs + ' programs (' + wk.attendance + ' attendees) · ' + wk.circ + ' checkouts · Goodwill ' + Math.round(wk.gw) + '% (' + (wk.gwDelta >= 0 ? '+' : '') + wk.gwDelta.toFixed(1) + ')' }, 'Wk ' + s.week + ' Sat');
    Sfx.play('week');
    if (s.week >= C.weeks) { s.day = C.days.length - 1; s.minute = C.hours[s.day][1]; G.running = false; setSpeed(0); save(); refreshHUD(); Screens.report(); return; }
    s.week++; s.day = 0; s.week0 = snapshotWeek(s);
    if (G.staffHours(s.week) > GD.START.staffHoursPerWeek) Feed.add({ key: 'burnout', demo: 'staff', vars: {}, gw: 0 }, 'Wk ' + s.week + ' Mon');
    if (qr) Feed.add({ system: true, title: GD.quarterOf(s.week).name + ' begins', emoji: '1f5d3', text: qr.quarter.name + ': ' + qr.programs + ' programs, ' + qr.attendance + ' attendees, Goodwill ' + Math.round(qr.gw) + '% (' + (qr.gwDelta >= 0 ? '+' : '') + qr.gwDelta.toFixed(1) + ').' }, 'Wk ' + s.week + ' Mon');
    startDay();
    if (qr) { setSpeed(0); Screens.quarterReport(qr); }
    else if (s.flags.pauseWeekly) { setSpeed(0); Screens.weekWrap(wk); }
  }

  // ---------------------------------------------------------------- the clock
  function tick(dt) {
    const s = G.state, close = C.hours[s.day][1];
    const step = Math.min(dt, close - s.minute);
    s.minute += step;
    G.sim.step(step, s.minute);
    checkEvents();
    if (s.minute >= close - 0.001) endDay();
  }

  // run the sim without drawing until `target` minute today (or closing time)
  function fastForward(target) {
    const s = G.state, day = s.day, week = s.week;
    const close = C.hours[day][1];
    target = Math.min(target, close);
    let guard = 0;
    while (G.running && s.day === day && s.week === week && s.minute < target && guard++ < 2000) tick(Math.min(1, target - s.minute) || 1);
    refreshHUD();
  }
  G.skipToNextEvent = function () {
    const s = G.state;
    const next = todaysEvents().map(e => Programs.startOf(e) - 45).filter(t => t > s.minute + 1).sort((a, b) => a - b)[0];
    const running = Object.keys(live).length;
    if (running) { toast('A program is running. Watch it, or end the day.', 'info'); return; }
    fastForward(next != null ? next : C.hours[s.day][1]);
  };
  G.skipDay = function () { fastForward(C.hours[G.state.day][1]); };

  function setSpeed(sp) {
    const s = G.state; if (!s) return;
    if (sp > 0) s.lastSpeed = sp;
    s.speed = sp;
    document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', +b.dataset.speed === sp));
    const pb = document.getElementById('btn-pause');
    pb.innerHTML = Icons.svg(sp ? 'player-pause' : 'player-play');
    pb.classList.toggle('paused', !sp);
    pb.setAttribute('aria-label', sp ? 'Pause' : 'Play');
    document.body.classList.toggle('is-paused', !sp);
  }
  G.setSpeed = setSpeed;
  G.togglePause = () => setSpeed(G.state.speed ? 0 : (G.state.lastSpeed || 2));
  let holdCount = 0, heldSpeed = 0;
  G.hold = function () { if (holdCount++ === 0) { heldSpeed = G.state.speed; setSpeed(0); } };
  G.release = function () { if (holdCount > 0 && --holdCount === 0 && heldSpeed) setSpeed(heldSpeed); };

  let lastT = 0, hudTimer = 0;
  function frame(t) {
    const dtReal = Math.min(0.1, (t - (lastT || t)) / 1000); lastT = t;
    if (G.running && G.state.speed > 0) {
      let dt = dtReal * C.minutesPerSecond * G.state.speed;
      while (dt > 0 && G.running) { const st = Math.min(dt, 1); tick(st); dt -= st; }
    }
    // a drawing error must never stop the clock (the loop below has to keep running)
    try { if (G.view && G.fac) { if (viewMode === '3d' && G.running) View3D.tick(t, G); else G.view.render(t); } }
    catch (e) { console.error(e); }
    hudTimer -= dtReal;
    if (hudTimer <= 0 && G.state) { refreshHUD(); hudTimer = 0.25; }
    requestAnimationFrame(frame);
  }
  // ---------------------------------------------------------------- HUD
  // the key under the map while the Noise overlay is on: the colour scale, and what's loud
  // on this floor right now (or why nothing is)
  function updateNoiseKey() {
    const key = document.getElementById('noise-key'), on = !!(G.view && G.view.overlays.noise);
    key.hidden = !on;
    if (!on || !G.sim || !G.fac) return;
    const f = G.view.floor, level = n => n < 0.3 ? 'quiet' : n < 1 ? 'a murmur' : n < 2 ? 'noisy' : 'loud';
    const rooms = Object.values(G.fac.rooms).filter(r => r.floor === f && !r.isUtility).map(r => ({ r, n: Math.max(0, ...r.tiles.filter(t => t.f === f).map(t => G.sim.noiseAt(t.f, t.x, t.z))) }));
    const loud = rooms.filter(x => x.n >= 0.3).sort((a, b) => b.n - a.n);
    const hurt = rooms.filter(x => x.r.isQuiet && x.n > 0.35).map(x => x.r.name);
    document.getElementById('noise-status').innerHTML = !loud.length
      ? 'Quiet on this floor right now. Programs in progress and busy loud rooms make noise.'
      : 'Loudest: <b>' + Planner.esc(loud[0].r.name) + '</b> (' + level(loud[0].n) + ')' + (hurt.length ? '. <span class="bad">Disturbing: ' + hurt.map(Planner.esc).join(', ') + '</span>' : '. Quiet rooms are fine.');
  }

  function refreshHUD() {
    const s = G.state; if (!s) return;
    updateNoiseKey();
    document.getElementById('ui-quarter').textContent = GD.quarterOf(s.week).name + ' \u00b7 Town of ' + (s.population || GD.POPULATION.default).toLocaleString('en-US');
    document.getElementById('ui-date').textContent = 'Week ' + s.week + ' · ' + fmtDate(s.week, s.day);
    document.getElementById('ui-time').textContent = fmtTime(s.minute);
    document.getElementById('ui-budget').textContent = money(s.budget);
    document.getElementById('ui-budget').classList.toggle('low', s.budget < 300);
    const ov = overall(s);
    document.getElementById('ui-gw').textContent = Math.round(ov) + '%';
    document.getElementById('ui-gw').className = 'v ' + (ov >= 68 ? 'good' : ov < 52 ? 'bad' : '');
    document.getElementById('ui-gw-bars').innerHTML = GD.DEMO_KEYS.map(d => '<i style="height:' + Math.round(s.goodwill[d]) + '%;background:' + GD.DEMOGRAPHICS[d].color + '"></i>').join('');
    document.getElementById('ui-circ').textContent = s.circulation.toLocaleString('en-US');
    document.getElementById('ui-visits').textContent = s.visits.toLocaleString('en-US');
    const sh = G.staffHours(s.week), cap = GD.START.staffHoursPerWeek;
    const st = document.getElementById('ui-staff'); st.textContent = sh + '/' + cap; st.classList.toggle('bad', sh > cap);
    document.getElementById('ui-sched').textContent = s.events.filter(e => e.status === 'scheduled').length;
    if (G.sim) {
      const counts = {}; G.sim.agents.forEach(a => { counts[a.f] = (counts[a.f] || 0) + a.size; });
      document.querySelectorAll('[data-floor-count]').forEach(el => { el.textContent = counts[el.dataset.floorCount] || 0; });
    }
    if (tipRoom) showRoomTip(tipRoom, tipPos);
  }
  G.refreshHUD = refreshHUD;
  G.goodwillTip = function () {
    const s = G.state;
    return '<b>Community Goodwill</b><br>How each audience feels about the library, weighted by its share of town.' +
      '<table class="tip-table">' + GD.DEMO_KEYS.map(d => {
        const D = GD.DEMOGRAPHICS[d], v = s.goodwill[d], dv = v - s.goodwillStart[d];
        return '<tr><td><img src="assets/emoji/' + D.emoji + '.svg" alt=""> ' + D.label + '</td><td><span class="mini-bar"><i style="width:' + v + '%;background:' + D.color + '"></i></span></td><td>' + Math.round(v) + '%</td><td class="' + (dv >= 0 ? 'up' : 'down') + '">' + (dv >= 0 ? '+' : '') + dv.toFixed(1) + '</td></tr>';
      }).join('') + '</table><small>Change since the start of the year.</small>';
  };

  // ---------------------------------------------------------------- toasts & tooltips
  function toast(text, tone, emoji) {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (tone || 'info');
    el.innerHTML = (emoji ? '<img src="assets/emoji/' + emoji + '.svg" alt="">' : '') + '<span></span>';
    el.querySelector('span').textContent = text;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 4800);
    while (box.children.length > 4) box.firstChild.remove();
  }
  G.toast = toast;

  function initTooltips() {
    const tip = document.getElementById('tooltip');
    let cur = null;
    const show = (el, x, y) => {
      const html = el.dataset.tipHtml === 'gw' ? G.goodwillTip() : el.dataset.tipHtml ? Planner.tipHtml(el) : null;
      if (html) tip.innerHTML = html;
      else { const [h, b] = el.dataset.tip.split('|'); tip.innerHTML = '<b>' + h + '</b>' + (b ? '<br>' + b : ''); }
      tip.hidden = false;
      const r = tip.getBoundingClientRect();
      tip.style.left = Math.max(6, Math.min(window.innerWidth - r.width - 6, x + 14)) + 'px';
      tip.style.top = Math.max(6, (y + r.height + 20 > window.innerHeight ? y - r.height - 10 : y + 16)) + 'px';
    };
    document.addEventListener('mouseover', e => {
      const el = e.target.closest('[data-tip],[data-tip-html]');
      if (el !== cur) { cur = el; if (!el) tip.hidden = true; }
      if (el && !document.body.classList.contains('dragging')) show(el, e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', e => { if (cur && !tip.hidden) show(cur, e.clientX, e.clientY); });
    document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip],[data-tip-html]'); if (el) { const r = el.getBoundingClientRect(); cur = el; show(el, r.left, r.bottom); } });
    document.addEventListener('focusout', () => { tip.hidden = true; cur = null; });
    document.addEventListener('dragstart', () => { tip.hidden = true; });
  }

  // ---------------------------------------------------------------- map panel interaction
  let tipRoom = null, tipPos = null, tipPinned = false;
  function showRoomTip(room, pos) {
    const el = document.getElementById('room-tip');
    tipRoom = room; tipPos = pos;
    const counts = G.sim ? G.sim.roomCounts(room.id) : { total: 0 };
    const liveHere = Object.values(live).find(L => L.room === room.id);
    const noise = G.sim ? Math.max(0, ...room.tiles.filter(t => t.f === room.floor).map(t => G.sim.noiseAt(t.f, t.x, t.z))) : 0;
    const noiseLabel = noise < 0.3 ? 'Quiet' : noise < 1 ? 'Murmur' : noise < 2 ? 'Noisy' : 'Loud';
    const upcoming = G.state.events.filter(e => e.room === room.id && e.status === 'scheduled').sort((a, b) => Programs.dayIndex(a) - Programs.dayIndex(b))[0];
    el.innerHTML = '<h3><span class="sw" style="background:' + room.color + '"></span>' + room.name + '</h3>' +
      '<p>' + room.blurb + '</p>' +
      '<div class="tags">' + room.tags.map(t => '<span>' + t + '</span>').join('') + '</div>' +
      '<div class="occ"><span>' + counts.total + ' / ' + room.capacity + ' people</span><span class="mini-bar"><i style="width:' + Math.min(100, counts.total / room.capacity * 100) + '%"></i></span></div>' +
      '<div class="who">' + GD.DEMO_KEYS.map(d => '<span><img src="assets/emoji/' + GD.DEMOGRAPHICS[d].emoji + '.svg" alt="' + GD.DEMOGRAPHICS[d].label + '">' + (counts[d] || 0) + '</span>').join('') + '</div>' +
      '<div class="noise">Sound: <b>' + noiseLabel + '</b>' + (room.soundproof ? ' (soundproof)' : '') + '</div>' +
      (liveHere ? '<div class="live-now"><img src="assets/emoji/' + liveHere.emoji + '.svg" alt=""> Now: ' + liveHere.title + '</div>' : '') +
      (upcoming ? '<div class="next">Next booking: ' + Programs.get(upcoming.program).title + ', Wk ' + upcoming.week + ' ' + C.days[upcoming.day] + '</div>' : '');
    el.hidden = false;
    const wrap = document.getElementById('map-wrap').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    let x = pos.x + 14, y = pos.y + 14;
    if (x + r.width > wrap.width - 4) x = pos.x - r.width - 14;
    if (y + r.height > wrap.height - 4) y = Math.max(4, wrap.height - r.height - 4);
    el.style.left = Math.max(4, x) + 'px'; el.style.top = y + 'px';
  }
  function hideRoomTip() { const el = document.getElementById('room-tip'); if (el) el.hidden = true; tipRoom = null; tipPinned = false; }
  G.hideRoomTip = hideRoomTip;

  // one set of room handlers for both the blueprint and the 3D view. pos is relative to #map-wrap.
  function mapHover(room, pos) {
    G.view.hoverRoom = room;
    if (tipPinned) return;
    if (room && !Planner.isPicking()) showRoomTip(room, pos); else if (!room) hideRoomTip();
  }
  function mapClick(room, pos) {
    if (Planner.isPicking()) { if (room) Planner.pickRoom(room.id); return; }
    if (room) { tipPinned = !(tipPinned && tipRoom === room); showRoomTip(room, pos); if (!tipPinned) hideRoomTip(); }
    else hideRoomTip();
  }
  function mapContext(room, clientX, clientY) {
    if (!room || !G.running) return;
    hideRoomTip();
    Planner.roomMenu(room, clientX, clientY);
  }
  const tileRoom = (t) => (t && G.fac.tileRoom[t.f] && G.fac.tileRoom[t.f][t.z]) ? G.fac.tileRoom[t.f][t.z][t.x] : null;

  // ---------------------------------------------------------------- 3D (Mapster) vs blueprint
  let viewMode = '3d';
  try { viewMode = localStorage.getItem('bts-view') || (View3D.supported() ? '3d' : '2d'); } catch (e) { viewMode = View3D.supported() ? '3d' : '2d'; }
  if (!View3D.supported()) viewMode = '2d';
  function mount3d() {
    const wrap = document.getElementById('map-wrap');
    View3D.mount(wrap, G.fac, G.mapData, { floor: G.view.floor });
  }
  function setViewMode(mode) {
    viewMode = mode;
    try { localStorage.setItem('bts-view', mode); } catch (e) { /* ignore */ }
    document.querySelectorAll('[data-viewmode]').forEach(b => b.classList.toggle('on', b.dataset.viewmode === mode));
    document.body.classList.toggle('view-3d', mode === '3d');
    hideRoomTip();
    if (mode === '3d') { if (!View3D.isMounted()) mount3d(); }
    else { View3D.unmount(); G.view.invalidate(); }
  }
  G.setViewMode = setViewMode;
  G.viewMode = () => viewMode;

  function initMapPanel() {
    const canvas = document.getElementById('facility-canvas');
    G.view = FacilityView.create(canvas, () => G.fac, () => G.sim);
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    // blueprint: wheel zooms around the pointer, drag pans
    let drag = null, dragged = false;
    canvas.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); G.view.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    canvas.addEventListener('mousedown', e => { if (e.button === 0) { drag = local(e); dragged = false; } });
    window.addEventListener('mouseup', () => { drag = null; });
    canvas.addEventListener('mousemove', e => {
      const p = local(e);
      if (drag && (dragged || Math.hypot(p.x - drag.x, p.y - drag.y) > 4)) { G.view.panBy(p.x - drag.x, p.y - drag.y); drag = p; dragged = true; hideRoomTip(); return; }
      const room = G.view.roomAt(p.x, p.y);
      canvas.style.cursor = room ? 'pointer' : 'grab';
      mapHover(room, p);
    });
    canvas.addEventListener('mouseleave', () => { G.view.hoverRoom = null; if (!tipPinned) hideRoomTip(); });
    canvas.addEventListener('click', e => { if (dragged) { dragged = false; return; } const p = local(e); mapClick(G.view.roomAt(p.x, p.y), p); });
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); const p = local(e); mapContext(G.view.roomAt(p.x, p.y), e.clientX, e.clientY); });

    // 3D view messages
    View3D.on('hover', (m, r) => mapHover(tileRoom(m.tile), { x: m.x, y: m.y }));
    View3D.on('click', (m) => mapClick(tileRoom(m.tile), { x: m.x, y: m.y }));
    View3D.on('context', (m, r) => mapContext(tileRoom(m.tile), r.left + m.x, r.top + m.y));
    View3D.on('key', (m) => {
      if (m.key === ' ') G.togglePause();
      else if (/^[1-5]$/.test(m.key)) setSpeed(C.speeds[+m.key - 1]);
      else if (m.key === 'Escape') Planner.close();
    });
    View3D.on('started', () => { View3D.setFloor(G.view.floor); View3D.cmd('labels', G.view.overlays.labels); View3D.cmd('noise', G.view.overlays.noise); });

    document.getElementById('ov-noise').addEventListener('click', e => { G.view.overlays.noise = !G.view.overlays.noise; e.currentTarget.classList.toggle('on', G.view.overlays.noise); View3D.cmd('noise', G.view.overlays.noise); updateNoiseKey(); });
    document.getElementById('ov-labels').addEventListener('click', e => { G.view.overlays.labels = !G.view.overlays.labels; e.currentTarget.classList.toggle('on', G.view.overlays.labels); View3D.cmd('labels', G.view.overlays.labels); });
    document.querySelectorAll('[data-viewmode]').forEach(b => b.addEventListener('click', () => setViewMode(b.dataset.viewmode)));
    if (!View3D.supported()) document.querySelector('[data-viewmode="3d"]').disabled = true;
    // camera buttons: in 3D they drive Mapster's camera; on the blueprint, zoom and reset
    document.getElementById('map-controls').addEventListener('click', e => {
      const b = e.target.closest('[data-cam]'); if (!b) return;
      const c = b.dataset.cam;
      if (viewMode === '3d') {
        if (c === 'rotl') View3D.cmd('rotate', -Math.PI / 4);
        if (c === 'rotr') View3D.cmd('rotate', Math.PI / 4);
        if (c === 'tiltu') View3D.cmd('tilt', -10);
        if (c === 'tiltd') View3D.cmd('tilt', 10);
        if (c === 'zin') View3D.cmd('zoom', 1.25);
        if (c === 'zout') View3D.cmd('zoom', 0.8);
        if (c === 'reset') View3D.cmd('reset');
      } else {
        const cv = canvas.getBoundingClientRect();
        if (c === 'zin') G.view.zoomAt(cv.width / 2, cv.height / 2, 1.25);
        if (c === 'zout') G.view.zoomAt(cv.width / 2, cv.height / 2, 0.8);
        if (c === 'reset') G.view.resetZoom();
      }
    });
    window.addEventListener('resize', () => { if (viewMode === '3d') View3D.cmd('resize'); });
    document.getElementById('map-legend').innerHTML = GD.DEMO_KEYS.map(d => '<span><i style="background:' + GD.DEMOGRAPHICS[d].color + '"></i>' + GD.DEMOGRAPHICS[d].label + '</span>').join('') +
      '<span><i class="ring"></i>At a program</span><span><i style="background:#8892a6"></i>Turned away</span><span class="bang">!</span><span>Annoyed</span>';
  }

  // ---------------------------------------------------------------- start / boot
  G.newGame = function (population) {
    G.clearSave();
    population = population || (G.state && G.state.population) || readPopulation();
    GD.setPopulation(population);
    G.state = newState(population);
    Feed.clear();
    begin();
    Feed.add({ system: true, title: 'Welcome aboard', emoji: '1f3db', text: 'Your predecessor left a few programs on the calendar, including a weekly storytime series. Check them over: right-click or click a booking to change it.' }, whenStamp(), { silent: true });
    Screens.intro();
  };
  G.continueGame = function () {
    const s = loadSave(); if (!s) return G.newGame();
    G.state = s; s.speed = 0;
    GD.setPopulation(s.population);
    s.series = s.series || []; s.nextSeriesId = s.nextSeriesId || 0;
    Programs.adoptCards(s.customCards); Programs.adoptNames(s.cardNames);
    Feed.clear();
    Feed.add({ system: true, title: 'Welcome back', emoji: '1f3db', text: 'Picking up on ' + fmtDate(s.week, s.day, true) + ', Week ' + s.week + '.' }, whenStamp(), { silent: true });
    begin();
  };
  // the city population typed (or picked) on the title screen
  function readPopulation() {
    const el = document.getElementById('title-pop');
    const n = el ? Math.round(+String(el.value).replace(/[^0-9]/g, '')) : 0;
    return n ? Math.max(GD.POPULATION.min, Math.min(GD.POPULATION.max, n)) : GD.POPULATION.default;
  }
  G.setPopulation = function (n) {
    if (!G.state) return;
    G.state.population = Math.max(GD.POPULATION.min, Math.min(GD.POPULATION.max, Math.round(n) || GD.POPULATION.default));
    GD.setPopulation(G.state.population); save(); refreshHUD();
  };

  function begin() {
    document.getElementById('title-screen').classList.remove('on');
    document.getElementById('app').setAttribute('aria-hidden', 'false');
    G.running = true;
    G.view.floor = G.fac.ground; setFloor(G.fac.ground);
    setViewMode(viewMode);
    Planner.init();
    startDay(false);
    setSpeed(0);
  }
  G.restart = function () { G.running = false; G.newGame(); };

  function bindHUD() {
    document.querySelectorAll('[data-icon]').forEach(el => { el.insertAdjacentHTML('afterbegin', Icons.svg(el.dataset.icon)); if (!el.getAttribute('aria-label') && el.dataset.tip) el.setAttribute('aria-label', el.dataset.tip.split('|')[0]); });
    document.getElementById('btn-pause').addEventListener('click', () => G.togglePause());
    document.querySelectorAll('.spd').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
    document.getElementById('btn-skip-event').addEventListener('click', () => G.skipToNextEvent());
    document.getElementById('btn-skip-day').addEventListener('click', () => G.skipDay());
    const snd = document.getElementById('btn-sound');
    const syncSnd = () => { snd.innerHTML = Icons.svg(Sfx.muted ? 'volume-off' : 'volume'); snd.classList.toggle('off', Sfx.muted); };
    snd.addEventListener('click', () => { Sfx.setMuted(!Sfx.muted); syncSnd(); Sfx.play('tick'); });
    syncSnd();
    document.getElementById('btn-help').addEventListener('click', () => Screens.help());
    document.getElementById('btn-settings').addEventListener('click', () => Screens.settings());
    document.getElementById('btn-workshop').addEventListener('click', () => Workshop.open(null));
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || !G.running) return;
      if (e.code === 'Space' && !document.getElementById('modal').classList.contains('on')) { e.preventDefault(); G.togglePause(); }
      if (e.key >= '1' && e.key <= '5') setSpeed(C.speeds[+e.key - 1]);
    });
    document.getElementById('map-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) G.loadMapFile(f); e.target.value = ''; });
  }

  function boot() {
    bindHUD();
    Panels.init();
    initTooltips();
    Feed.init(document.getElementById('feed-container'));
    initMapPanel();
    LibraryMap.loadDefault().then(res => {
      useMap(res);
      Screens.titleArt();
      const s = loadSave();
      const cont = document.getElementById('btn-continue');
      if (s) { cont.hidden = false; cont.textContent = 'Continue (Week ' + s.week + ', ' + C.days[s.day] + ')'; }
      const pre = document.getElementById('pop-presets');
      if (pre) pre.innerHTML = GD.POPULATION.presets.map(([n, l]) => '<option value="' + n.toLocaleString('en-US') + '">' + l + '</option>').join('');
      document.getElementById('btn-new').addEventListener('click', async () => { if (loadSave() && !(await Screens.ask({ title: 'Start a new game?', text: 'Your saved game will be replaced.', yes: 'Start over', no: 'Keep it', danger: true }))) return; G.newGame(); });
      cont.addEventListener('click', () => G.continueGame());
      document.getElementById('btn-title-help').addEventListener('click', () => Screens.help());
      document.getElementById('btn-credits').addEventListener('click', e => { e.preventDefault(); Screens.credits(); });
      requestAnimationFrame(frame);
    }).catch(err => {
      document.querySelector('.title-card .pitch').textContent = 'The library map failed to load: ' + err.message;
    });
    window.addEventListener('resize', () => { if (G.view) G.view.invalidate(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  return G;
})();
