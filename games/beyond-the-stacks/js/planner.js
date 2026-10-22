/* JS/PLANNER.JS - The planning side of the screen: the year's Master Schedule, the deck
   of program cards, the right-click menus, and the configuration drawer (date and time,
   repeat, room, scope, refreshments, marketing, and a live projection).

   Booking: drag a card onto a day, click a card then a day, right-click a day or a room on
   the map, or right-click a card. Click or right-click a booking to change it. While the
   drawer is open, time is paused and rooms on the map are tinted by how well they suit the
   program; click one to pick it.

   Recurring programs work like a desk calendar: a SERIES (Programs explains the shape) makes
   one booking per session. Each session can be edited, moved or skipped on its own (it
   becomes an exception); editing the series updates every upcoming session that isn't. */

window.Planner = (function () {
  const GD = GameData, C = GD.CALENDAR;
  let draft = null, placing = null, deckFilter = 'all', inited = false;
  const $ = (id) => document.getElementById(id);
  const S = () => Game.state;
  const img = (code, cls) => '<img src="assets/emoji/' + code + '.svg" alt=""' + (cls ? ' class="' + cls + '"' : '') + '>';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ORD = ['', '1st', '2nd', '3rd', '4th', 'last'];

  // ---------------------------------------------------------------- time helpers
  const todayAbs = () => Programs.absDay(S().week, S().day);
  function isPastDay(week, day) { const s = S(); return week < s.week || (week === s.week && day < s.day); }
  function slotOpen(week, day, slotId) {
    const sl = Programs.slot(slotId), s = S();
    if (GD.holidayOn(week, day)) return false;   // the library's closed
    if (sl.noSaturday && day === 5) return false;
    if (isPastDay(week, day)) return false;
    if (week === s.week && day === s.day && sl.time < s.minute + 30) return false;
    const [open, close] = C.hours[day];
    return sl.time >= open && sl.time < close;
  }
  function dayHasOpenSlot(week, day) { return GD.SLOTS.some(sl => slotOpen(week, day, sl.id)); }
  // a booking that can still be changed (not run, not started today)
  function editable(ev) {
    const s = S();
    if (ev.status !== 'scheduled') return false;
    if (isPastDay(ev.week, ev.day)) return false;
    return !(ev.week === s.week && ev.day === s.day && s.minute >= Programs.startOf(ev));
  }
  const dateLabel = (w, d) => Game.fmtDate(w, d) + ' (Wk ' + w + ')';
  // the date picker, grouped by quarter; holidays are listed but closed
  function dateOptions(sel, fromAbs) {
    let h = '';
    C.quarters.forEach(q => {
      let g = '';
      for (let w = q.first; w <= q.last; w++) for (let d = 0; d < C.days.length; d++) {
        if (Programs.absDay(w, d) < fromAbs) continue;
        const v = w + '-' + d, hol = GD.holidayOn(w, d);
        g += '<option value="' + v + '"' + (v === sel ? ' selected' : '') + (hol ? ' disabled' : '') + '>' + dateLabel(w, d) + (hol ? ' \u00b7 closed: ' + hol : '') + '</option>';
      }
      if (g) h += '<optgroup label="' + q.name + '">' + g + '</optgroup>';
    });
    return h;
  }
  // why an off-site venue can't take a program then (null if it can)
  function venueClosed(roomId, week, day, slotId) {
    if (!GD.VENUES[roomId]) return null;
    const o = GD.venueOpen(roomId, week, day, slotId);
    return o.ok ? null : o.why;
  }
  const floorLabel = (room) => room.offsite ? 'Off-site' : Game.fac.floors[room.floor].name;
  const seriesOf = (ev) => ev && ev.seriesId ? (S().series || []).find(x => x.id === ev.seriesId) : null;

  // ---------------------------------------------------------------- conflicts
  function overlaps(a, b) {
    const pa = Programs.get(a.program), pb = Programs.get(b.program);
    const sa = Programs.slot(a.slot).time, sb = Programs.slot(b.slot).time;
    return sa < sb + pb.duration + 15 && sb < sa + pa.duration + 15;
  }
  // is the room taken at that date/slot by something other than `ignore` (an event, or a whole series)?
  function roomTaken(room, week, day, slotId, program, ignore) {
    const probe = { program, slot: slotId };
    return S().events.some(o => o.status !== 'cancelled' && o.room === room && o.week === week && o.day === day &&
      !(ignore && (o.id === ignore.id || (ignore.seriesId && o.seriesId === ignore.seriesId))) && overlaps(probe, o));
  }

  // ---------------------------------------------------------------- calendar
  function renderCalendar() {
    const grid = $('calendar-grid'), s = S();
    let h = '<div class="cal-corner"></div>' + C.days.map(d => '<div class="cal-dayhead">' + d + '</div>').join('');
    for (let w = 1; w <= C.weeks; w++) {
      const q = C.quarters.find(x => x.first === w);
      if (q) {
        const qi = C.quarters.indexOf(q), fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        h += '<div class="cal-quarter' + (s.week > q.last ? ' past' : '') + '" data-q="' + qi + '"><b>' + q.name + '</b> ' + fmt(Game.dateOf(q.first, 0)) + ' &ndash; ' + fmt(Game.dateOf(q.last, 5)) + (s.week >= q.first && s.week <= q.last ? ' <span class="now-tag">now</span>' : '') + '</div>';
      }
      const lead = w - s.week, tm = GD.timingMultiplier(lead);
      const weekStart = Game.dateOf(w, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const staff = Game.staffHours(w), over = staff > GD.START.staffHoursPerWeek;
      h += '<div class="cal-week' + (w === s.week ? ' now' : '') + (w < s.week ? ' past' : '') + '" data-week="' + w + '">' +
        '<b>Wk ' + w + '</b><small>' + weekStart + '</small>' +
        (w >= s.week ? '<span class="lead-pip ' + tm.tone + '" title="' + tm.tip + '"></span>' : '') +
        '<span class="staff-pip' + (over ? ' over' : '') + '" title="Staff hours booked this week">' + staff + 'h</span></div>';
      for (let d = 0; d < C.days.length; d++) {
        const past = isPastDay(w, d), today = (w === s.week && d === s.day);
        const hol = GD.holidayOn(w, d), brk = d < 5 && GD.schoolBreak(w, d);
        const evs = s.events.filter(e => e.week === w && e.day === d && e.status !== 'cancelled').sort((a, b) => Programs.startOf(a) - Programs.startOf(b));
        const dt = Game.dateOf(w, d);
        h += '<div class="cal-day' + (past ? ' past' : '') + (today ? ' today' : '') + (hol ? ' closed' : '') + (brk ? ' schoolout' : '') + (!past && !hol && w >= s.week ? ' lead-' + tm.tone : '') + '" data-week="' + w + '" data-day="' + d + '" role="gridcell" aria-label="Week ' + w + ' ' + C.dayNames[d] + (hol ? ', closed for ' + hol : '') + '"' + (brk && !hol ? ' title="' + brk + ': no school"' : '') + '>' +
          '<span class="dnum">' + (dt.getDate() === 1 || (w === 1 && d === 0) ? '<b>' + GD.MONTHS[dt.getMonth()].slice(0, 3) + '</b> ' : '') + dt.getDate() + '</span>' +
          (hol ? '<span class="closed-tag">Closed<br><small>' + hol + '</small></span>' : '') + evs.map(chip).join('') + '</div>';
      }
    }
    grid.innerHTML = h;
    if (lastScrolledWeek !== s.week) { lastScrolledWeek = s.week; scrollToWeek(s.week); }
  }
  // keep the current week near the top of the schedule (a year is a long scroll)
  let lastScrolledWeek = null;
  // scroll the schedule so `el` sits just under the sticky day names
  function scrollGridTo(el, smooth) {
    const grid = $('calendar-grid'), head = grid.querySelector('.cal-dayhead');
    const top = el.getBoundingClientRect().top - grid.getBoundingClientRect().top + grid.scrollTop - (head ? head.offsetHeight : 0) - 4;
    if (smooth) grid.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); else grid.scrollTop = Math.max(0, top);
  }
  function scrollToWeek(w) {
    const grid = $('calendar-grid'), row = grid.querySelector('.cal-week[data-week="' + w + '"]');
    if (!row) return;
    const q = C.quarters.find(x => x.first === w);
    scrollGridTo(q ? grid.querySelector('.cal-quarter[data-q="' + C.quarters.indexOf(q) + '"]') : row, false);
  }
  function renderQuarterTabs() {
    const box = $('cal-quarters'); if (!box) return;
    box.innerHTML = C.quarters.map((q, i) => '<button type="button" data-q="' + i + '" data-tip="' + q.name + '|Weeks ' + q.first + ' to ' + q.last + '">' + q.short + '</button>').join('');
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      const hdr = $('calendar-grid').querySelector('.cal-quarter[data-q="' + b.dataset.q + '"]');
      if (hdr) scrollGridTo(hdr, true);
    });
  }

  function chip(e) {
    const p = Programs.get(e.program), s = S();
    const room = Game.room(e.room);
    const fit = Programs.roomFit(e.program, room);
    const isToday = e.week === s.week && e.day === s.day;
    const started = isToday && s.minute >= Programs.startOf(e);
    const liveNow = started && s.minute < Programs.endOf(e) && e.status === 'scheduled';
    let cls = 'chip';
    if (e.status === 'done') cls += ' done q-' + (e.result.quality >= 1 ? 'good' : e.result.quality >= 0.75 ? 'ok' : 'bad');
    if (liveNow) cls += ' live';
    if (e.inherited && e.status === 'scheduled') cls += ' inherited';
    if (e.seriesId) cls += ' series';
    const warn = e.status === 'scheduled' && (!room || fit.tone === 'bad');
    const drag = editable(e) ? ' draggable="true"' : '';
    const badge = e.status === 'done' ? '<em>' + e.result.attendance + '</em>' : warn ? '<em class="warn">!</em>' : '';
    const rep = e.seriesId ? '<span class="rep" title="' + (e.exception ? 'Changed from the series' : 'Part of a series') + '">' + Icons.svg(e.exception ? 'repeat-off' : 'repeat') + '</span>' : '';
    return '<div class="' + cls + '" data-event="' + e.id + '"' + drag + ' data-tip-html="chip" style="--c:' + (room ? room.color : '#999') + '">' + img(p.emoji) +
      '<span class="t">' + esc(p.title) + '</span><span class="tm">' + rep + Game.fmtTime(Programs.startOf(e)).replace(':00', '').replace(' ', '') + '</span>' + badge + '</div>';
  }

  // ---------------------------------------------------------------- deck
  function renderDeck() {
    const deck = $('deck');
    const progs = Programs.deck().filter(p => deckFilter === 'all' || (deckFilter === 'custom' ? p.custom : p.target === deckFilter));
    deck.innerHTML = progs.map(cardHtml).join('') +
      '<button type="button" class="card new-card" id="deck-new" data-tip="New card|Design your own program in the Card Workshop.">' + Icons.svg('plus') + '<strong>New card</strong><small>Card Workshop</small></button>';
  }
  function cardHtml(p) {
    const D = GD.DEMOGRAPHICS[p.target];
    return '<div class="card' + (p.custom ? ' custom' : '') + (placing && placing.pid === p.id ? ' placing' : '') + '" role="listitem" tabindex="0" draggable="true" data-program="' + p.id + '" data-tip-html="card">' +
      '<div class="card-top">' + img(p.emoji, 'card-emoji') + '<span class="aud" style="--c:' + D.color + '">' + img(D.emoji) + D.label + '</span></div>' +
      '<strong>' + esc(p.title) + '</strong>' +
      '<div class="card-meta"><span>' + Game.money(p.cost) + '</span><span>' + p.staff + ' staff h</span><span>' + p.duration + ' min</span></div>' +
      '<div class="noise-pips" aria-label="Noise ' + p.noise + ' of 3">' + [1, 2, 3].map(i => '<i class="' + (i <= p.noise ? 'on' : '') + '"></i>').join('') + '<span>' + ['silent', 'quiet', 'lively', 'loud'][p.noise] + '</span>' + (p.custom ? '<b class="mine">custom</b>' : '') + '</div>' +
      '</div>';
  }
  function renderDeckFilter() {
    const box = $('deck-filter');
    box.innerHTML = '<button type="button" data-f="all" class="on">All</button>' + GD.DEMO_KEYS.map(d => '<button type="button" data-f="' + d + '">' + img(GD.DEMOGRAPHICS[d].emoji) + GD.DEMOGRAPHICS[d].label + '</button>').join('') + '<button type="button" data-f="custom">Custom</button>';
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      deckFilter = b.dataset.f;
      box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      renderDeck();
    });
  }

  // tooltips for cards and calendar chips
  function tipHtml(el) {
    if (el.dataset.tipHtml === 'card') {
      const p = Programs.get(el.dataset.program), D = GD.DEMOGRAPHICS[p.target];
      return '<b>' + esc(p.title) + '</b>' + (p.custom ? ' <i>(your card)</i>' : '') + '<br><i>' + esc(p.blurb || '') + '</i><br>' +
        'For: ' + D.label + (p.also.length ? ' (also ' + p.also.map(d => GD.DEMOGRAPHICS[d].label.toLowerCase()).join(', ') + ')' : '') + '<br>' +
        Game.money(p.cost) + ' · ' + p.staff + ' staff hours · ' + p.duration + ' min · ' + ['silent', 'quiet', 'lively', 'loud'][p.noise] + '<br>' +
        (p.recurring ? 'Works as a weekly regular.' : 'Repeat it within 2 weeks and turnout drops.') + '<br><small>Right-click for more.</small>';
    }
    if (el.dataset.tipHtml === 'chip') {
      const e = S().events.find(x => x.id === +el.dataset.event); if (!e) return '';
      const p = Programs.get(e.program), room = Game.room(e.room), sr = seriesOf(e);
      let h = '<b>' + esc(p.title) + '</b><br>' + Game.fmtDate(e.week, e.day, true) + ', ' + Game.fmtTime(Programs.startOf(e)) + '<br>' + (room ? room.name : '<span class="bad">No room</span>');
      if (sr) h += '<br>' + Programs.describePattern(sr) + (e.exception ? ' <i>(this session changed)</i>' : '');
      if (e.status === 'done') {
        const r = e.result;
        h += '<br>' + r.attendance + ' attended' + (r.turnedAway ? ', ' + r.turnedAway + ' turned away' : '') + '<br>' + (r.notes || []).join('<br>');
      } else {
        const fit = Programs.roomFit(e.program, room), mk = Programs.marketing(e);
        h += ' (' + { good: 'great fit', ok: 'OK fit', bad: 'poor fit' }[fit.tone] + ')<br>Marketing: ' + mk.tier.label + ', ' + mk.timing.label + (e.inherited ? '<br><i>Booked by your predecessor.</i>' : '') + '<br><small>Click to change it; right-click for more.</small>';
      }
      return h;
    }
    return '';
  }

  // ---------------------------------------------------------------- drag & drop / click to place / right-click
  function bindPlanning() {
    const grid = $('calendar-grid'), deck = $('deck');
    deck.addEventListener('dragstart', e => {
      const c = e.target.closest('.card[data-program]'); if (!c) return;
      e.dataTransfer.setData('text/plain', 'p:' + c.dataset.program); e.dataTransfer.effectAllowed = 'copy';
      document.body.classList.add('dragging');
    });
    grid.addEventListener('dragstart', e => {
      const c = e.target.closest('.chip[draggable="true"]'); if (!c) return;
      e.dataTransfer.setData('text/plain', 'e:' + c.dataset.event); e.dataTransfer.effectAllowed = 'move';
      document.body.classList.add('dragging');
    });
    document.addEventListener('dragend', () => { document.body.classList.remove('dragging'); grid.querySelectorAll('.drop-hover').forEach(x => x.classList.remove('drop-hover')); });
    grid.addEventListener('dragover', e => {
      const cell = e.target.closest('.cal-day'); if (!cell) return;
      if (!dayHasOpenSlot(+cell.dataset.week, +cell.dataset.day)) return;
      e.preventDefault();
      grid.querySelectorAll('.drop-hover').forEach(x => x !== cell && x.classList.remove('drop-hover'));
      cell.classList.add('drop-hover');
    });
    grid.addEventListener('drop', e => {
      const cell = e.target.closest('.cal-day'); if (!cell) return;
      e.preventDefault(); document.body.classList.remove('dragging'); cell.classList.remove('drop-hover');
      const data = e.dataTransfer.getData('text/plain'), week = +cell.dataset.week, day = +cell.dataset.day;
      if (data.startsWith('p:')) newDraft(data.slice(2), week, day);
      else if (data.startsWith('e:')) { const ev = S().events.find(x => x.id === +data.slice(2)); if (ev && (ev.week !== week || ev.day !== day)) editEvent(ev, { week, day }); }
    });
    deck.addEventListener('click', e => {
      if (e.target.closest('#deck-new')) { Workshop.open(null); return; }
      const c = e.target.closest('.card[data-program]'); if (!c) return;
      startPlacing({ pid: c.dataset.program });
    });
    deck.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const c = e.target.closest('.card[data-program]'); if (c) { e.preventDefault(); startPlacing({ pid: c.dataset.program }); } } });
    deck.addEventListener('contextmenu', e => {
      const c = e.target.closest('.card[data-program]'); if (!c) return;
      e.preventDefault(); cardMenu(c.dataset.program, e.clientX, e.clientY);
    });
    grid.addEventListener('click', e => {
      const ch = e.target.closest('.chip');
      if (ch && !placing) { openChip(+ch.dataset.event, e.clientX, e.clientY); return; }
      const cell = e.target.closest('.cal-day');
      if (cell && placing) {
        if (!dayHasOpenSlot(+cell.dataset.week, +cell.dataset.day)) { Game.toast('That day is already over (or has no time slots left).', 'bad'); return; }
        const pl = placing; stopPlacing(); placeOn(pl, +cell.dataset.week, +cell.dataset.day);
      }
    });
    grid.addEventListener('contextmenu', e => {
      const ch = e.target.closest('.chip');
      if (ch) { e.preventDefault(); chipMenu(+ch.dataset.event, e.clientX, e.clientY); return; }
      const cell = e.target.closest('.cal-day');
      if (cell) { e.preventDefault(); dayMenu(+cell.dataset.week, +cell.dataset.day, e.clientX, e.clientY); }
    });
    $('place-cancel').addEventListener('click', stopPlacing);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !Menu.isOpen()) { if (placing) stopPlacing(); else if (draft) close(); } });
  }
  // placing = { pid, room?, repeat?, from? (an event whose settings to copy), move? (an event to move) }
  function startPlacing(pl) {
    placing = pl;
    const p = Programs.get(pl.pid);
    const what = pl.move ? 'Move <b>' + esc(p.title) + '</b> to' : 'Pick a day for <b>' + esc(p.title) + '</b>' + (pl.room ? ' in the ' + Game.room(pl.room).name : '') + (pl.repeat ? ' (first session)' : '');
    $('place-text').innerHTML = img(p.emoji) + ' ' + what;
    $('place-banner').hidden = false; document.body.classList.add('placing');
    renderDeck();
  }
  function stopPlacing() { placing = null; $('place-banner').hidden = true; document.body.classList.remove('placing'); renderDeck(); }
  function placeOn(pl, week, day) {
    if (pl.move) { editEvent(pl.move, { week, day }); return; }
    newDraft(pl.pid, week, day, pl);
  }
  function openChip(id) {
    const ev = S().events.find(x => x.id === id); if (!ev) return;
    if (ev.status === 'done') { Screens.result(ev); return; }
    if (!editable(ev)) { Game.toast('That program has already started.', 'info'); return; }
    if (ev.seriesId) { editEvent(ev, null, 'occurrence'); return; }
    editEvent(ev);
  }

  // ---------------------------------------------------------------- right-click menus
  function cardMenu(pid, x, y) {
    const p = Programs.get(pid);
    Menu.show(x, y, [
      { label: 'Schedule…', icon: 'calendar-plus', hint: 'pick a day', action: () => startPlacing({ pid }) },
      { label: 'Schedule as a series…', icon: 'repeat', hint: 'weekly / monthly', action: () => startPlacing({ pid, repeat: true }) },
      '-',
      p.custom ? { label: 'Edit card…', icon: 'pencil', action: () => Workshop.open(pid) } : { label: 'Open in Card Workshop…', icon: 'cards', action: () => Workshop.open(pid) },
      { label: 'Rename…', icon: 'pencil', action: () => Workshop.renameCard(pid) },
      { label: 'Duplicate & customize…', icon: 'copy', action: () => Workshop.duplicate(pid) },
      { label: 'Hide from deck', icon: 'eye', hint: 'Workshop can unhide', action: () => { Programs.setHidden(pid, true); renderDeck(); Game.toast(p.title + ' hidden. Unhide it in the Card Workshop.', 'info', p.emoji); } },
      p.custom ? { label: 'Delete card…', icon: 'trash', danger: true, action: () => Workshop.remove(pid) } : null,
    ], img(p.emoji) + esc(p.title));
  }

  function chipMenu(id, x, y) {
    const ev = S().events.find(e => e.id === id); if (!ev) return;
    const p = Programs.get(ev.program), sr = seriesOf(ev), can = editable(ev);
    const title = img(p.emoji) + esc(p.title) + ' <small>' + Game.fmtDate(ev.week, ev.day) + '</small>';
    if (ev.status === 'done') {
      Menu.show(x, y, [
        { label: 'View results…', icon: 'chart-bar', action: () => Screens.result(ev) },
        { label: 'Book it again…', icon: 'calendar-plus', hint: 'same settings', action: () => startPlacing({ pid: ev.program, from: ev }) },
        { label: 'Program card…', icon: 'cards', action: () => Workshop.open(ev.program) },
      ], title);
      return;
    }
    if (sr) {
      Menu.show(x, y, [
        { label: 'Edit this session…', icon: 'pencil', disabled: !can, action: () => editEvent(ev, null, 'occurrence') },
        { label: 'Edit the series…', icon: 'repeat', hint: Programs.describePattern(sr), action: () => editSeries(sr, ev) },
        { label: 'Move this session…', icon: 'arrows-move', disabled: !can, action: () => startPlacing({ pid: ev.program, move: ev }) },
        '-',
        { label: 'Skip this session', icon: 'calendar-x', disabled: !can, action: () => cancelOccurrence(ev) },
        { label: 'End the series after this session', icon: 'player-skip-forward', action: () => endSeriesAfter(sr, ev) },
        { label: 'Cancel the whole series…', icon: 'trash', danger: true, action: () => cancelSeries(sr) },
        '-',
        { label: 'Book a copy…', icon: 'copy', hint: 'one-off', action: () => startPlacing({ pid: ev.program, from: ev }) },
      ], title);
      return;
    }
    Menu.show(x, y, [
      { label: 'Edit…', icon: 'pencil', disabled: !can, action: () => editEvent(ev) },
      { label: 'Move to another day…', icon: 'arrows-move', disabled: !can, action: () => startPlacing({ pid: ev.program, move: ev }) },
      { label: 'Make it repeat…', icon: 'repeat', disabled: !can, action: () => editEvent(ev, null, 'single', true) },
      { label: 'Book a copy…', icon: 'copy', hint: 'same settings', action: () => startPlacing({ pid: ev.program, from: ev }) },
      { label: 'Program card…', icon: 'cards', action: () => Workshop.open(ev.program) },
      { label: 'Rename card…', icon: 'pencil', action: () => Workshop.renameCard(ev.program) },
      '-',
      { label: 'Cancel program', icon: 'trash', danger: true, disabled: !can, action: () => removeSingle(ev) },
    ], title);
  }

  function cardsSubmenu(x, y, title, onPick) {
    const items = Programs.deck().map(p => ({ label: esc(p.title), icon: null, hint: GD.DEMOGRAPHICS[p.target].label + (p.custom ? ' · custom' : ''), action: () => onPick(p.id), _emoji: p.emoji }));
    Menu.show(x, y, items.map(it => Object.assign(it, { label: img(it._emoji) + ' ' + it.label })), title);
  }
  function dayMenu(week, day, x, y) {
    const open = dayHasOpenSlot(week, day);
    const label = Game.fmtDate(week, day, true) + ', Wk ' + week;
    Menu.show(x, y, [
      { label: 'Schedule a program…', icon: 'calendar-plus', disabled: !open, action: () => cardsSubmenu(x, y, 'Schedule on ' + label, pid => newDraft(pid, week, day)) },
      { label: 'Schedule a series starting here…', icon: 'repeat', disabled: !open, action: () => cardsSubmenu(x, y, 'Series from ' + label, pid => newDraft(pid, week, day, { repeat: true })) },
      { label: 'New card…', icon: 'plus', action: () => Workshop.open(null) },
    ], label);
  }
  function roomMenu(room, x, y) {
    const items = [
      { label: 'Book a program here…', icon: 'calendar-plus', disabled: room.isUtility || room.tags.includes('transit'), action: () => {
        const fits = Programs.deck().map(p => ({ p, f: Programs.roomFit(p.id, room) })).sort((a, b) => b.f.fit - a.f.fit);
        Menu.show(x, y, fits.map(({ p, f }) => ({ label: img(p.emoji) + ' ' + esc(p.title), hint: { good: 'great fit', ok: 'OK', bad: 'poor fit' }[f.tone], action: () => startPlacing({ pid: p.id, room: room.id }) })), 'Book in the ' + room.name);
      } },
      { label: 'Show this floor', icon: 'map-2', action: () => Game.setFloor(room.floor) },
    ];
    const next = S().events.filter(e => e.room === room.id && e.status === 'scheduled').sort((a, b) => Programs.dayIndex(a) - Programs.dayIndex(b)).slice(0, 4);
    if (next.length) { items.push('-'); next.forEach(e => items.push({ label: img(Programs.get(e.program).emoji) + ' ' + esc(Programs.get(e.program).title), hint: Game.fmtDate(e.week, e.day), action: () => openChip(e.id) })); }
    Menu.show(x, y, items, '<span class="sw" style="background:' + room.color + '"></span>' + room.name);
  }

  // ---------------------------------------------------------------- the drawer
  // draft = { mode: 'new'|'single'|'occurrence'|'series', ev, repeat, sr (series settings), orig, origSeries }
  function baseSeries(ev, kind) {
    return {
      pattern: kind === 'monthly' ? { type: 'monthly', nth: Math.min(4, Math.ceil(Game.dateOf(ev.week, ev.day).getDate() / 7)), day: ev.day } : { type: 'weekly', every: 1, days: [ev.day] },
      end: { type: 'quarter' }, n: 6, endWeek: Math.min(C.weeks, ev.week + 5), endDay: ev.day,
    };
  }
  function newDraft(pid, week, day, opts) {
    opts = opts || {};
    const slot = GD.SLOTS.find(sl => slotOpen(week, day, sl.id));
    if (!slot) { Game.toast('No time slots left that day.', 'bad'); return; }
    const src = opts.from;
    const ev = { id: null, program: pid, week, day, slot: src ? src.slot : slot.id, room: src ? src.room : (opts.room || null), scope: src ? src.scope : 5, marketing: src ? src.marketing : 0, addons: src ? clone(src.addons || {}) : {}, bookedWeek: S().week, status: 'scheduled' };
    if (!slotOpen(week, day, ev.slot)) ev.slot = slot.id;
    if (!ev.room || roomTaken(ev.room, week, day, ev.slot, pid)) {
      const rooms = roomList(pid, ev);
      const best = rooms.find(r => !r.booked && r.fit.tone === 'good') || rooms.find(r => !r.booked && r.fit.tone === 'ok');
      ev.room = best ? best.room.id : null;
    }
    open({ mode: 'new', ev, repeat: !!opts.repeat, sr: baseSeries(ev) });
  }
  // mode: 'single' (a one-off), 'occurrence' (one session of a series)
  function editEvent(ev, move, mode, makeRepeat) {
    const d = clone(ev);
    if (move) { d.week = move.week; d.day = move.day; if (!slotOpen(d.week, d.day, d.slot)) { const sl = GD.SLOTS.find(x => slotOpen(d.week, d.day, x.id)); if (sl) d.slot = sl.id; } }
    if (ev.seriesId) open({ mode: 'occurrence', ev: d, orig: ev, repeat: false });
    else open({ mode: mode || 'single', ev: d, orig: ev, repeat: !!makeRepeat, sr: baseSeries(d) });
  }
  function editSeries(sr, fromEv) {
    const upcoming = S().events.filter(e => e.seriesId === sr.id && editable(e)).sort((a, b) => Programs.dayIndex(a) - Programs.dayIndex(b));
    const sample = clone(upcoming[0] || fromEv);
    const ev = Object.assign(sample, { program: sr.program, slot: sr.slot, room: sr.room, scope: sr.scope, marketing: sr.marketing, addons: clone(sr.addons || {}), week: sr.start.week, day: sr.start.day, seriesId: sr.id, bookedWeek: sr.bookedWeek });
    const s = clone(sr);
    const form = { pattern: s.pattern, end: s.end, n: s.end.type === 'count' ? s.end.n : 6, endWeek: s.end.type === 'date' ? s.end.week : Math.min(C.weeks, ev.week + 5), endDay: s.end.type === 'date' ? s.end.day : ev.day };
    open({ mode: 'series', ev, repeat: true, sr: form, origSeries: sr });
  }

  function open(d) {
    if (!draft) Game.hold();
    Menu.close();
    draft = d;
    const p = Programs.get(d.ev.program), D = GD.DEMOGRAPHICS[p.target];
    $('cfg-emoji').src = 'assets/emoji/' + p.emoji + '.svg';
    $('cfg-title').textContent = p.title;
    $('cfg-sub').innerHTML = '<span class="aud" style="--c:' + D.color + '">' + img(D.emoji) + D.label + '</span>' + (p.also.length ? ' <small>also ' + p.also.map(x => GD.DEMOGRAPHICS[x].label.toLowerCase()).join(', ') + '</small>' : '') + (d.orig && d.orig.inherited ? ' <span class="sticky">Booked by your predecessor</span>' : '') + (p.custom ? ' <span class="sticky mine">Your card</span>' : '');
    $('cfg-blurb').textContent = p.blurb || '';
    const notes = {
      occurrence: Icons.svg('repeat-off') + ' One session of a series. Changes here apply to <b>this date only</b>. <a href="#" data-act="series">Edit the whole series instead</a>',
      series: Icons.svg('repeat') + ' Editing the <b>series</b>: changes apply to every upcoming session (sessions you changed one by one keep their own date, time and room).',
    };
    $('cfg-mode').innerHTML = notes[d.mode] || '';
    $('cfg-mode').hidden = !notes[d.mode];
    $('btn-remove').hidden = !(d.orig || d.origSeries);
    $('btn-remove').textContent = d.mode === 'occurrence' ? 'Skip this session' : d.mode === 'series' ? 'Cancel series' : 'Cancel program';
    $('btn-confirm-schedule').textContent = d.mode === 'new' ? 'Lock in Schedule' : 'Save Changes';
    $('scope-slider').value = d.ev.scope;
    $('config-modal').hidden = false;
    document.body.classList.add('configuring');
    Sfx.play('open');
    const room = Game.room(d.ev.room);
    if (room && !room.offsite && room.floor !== Game.view.floor) Game.setFloor(room.floor);
    Game.hideRoomTip();
    renderDrawer();
  }

  function close() {
    if (!draft) return;
    draft = null;
    $('config-modal').hidden = true;
    document.body.classList.remove('configuring');
    Game.view.highlights = null; Game.view.selectedRoom = null;
    Game.release();
  }

  function roomList(pid, ev) {
    const ignore = draft ? (draft.orig || (draft.origSeries ? { seriesId: draft.origSeries.id } : null)) : null;
    const lib = Object.values(Game.fac.rooms)
      .filter(r => !r.tags.includes('transit'))
      .map(r => ({ room: r, fit: Programs.roomFit(pid, r), booked: roomTaken(r.id, ev.week, ev.day, ev.slot, pid, ignore) }))
      .sort((a, b) => (a.room.isStaff || a.room.isUtility) - (b.room.isStaff || b.room.isUtility) || b.fit.fit - a.fit.fit || a.room.name.localeCompare(b.room.name));
    // off-site venues: after the library's rooms, best fit first
    const out = Object.keys(GD.VENUES).map(id => Programs.venueRoom(id))
      .map(r => ({ room: r, fit: Programs.roomFit(pid, r), booked: roomTaken(r.id, ev.week, ev.day, ev.slot, pid, ignore), closed: venueClosed(r.id, ev.week, ev.day, ev.slot) }))
      .sort((a, b) => !!a.closed - !!b.closed || b.fit.fit - a.fit.fit);
    return lib.concat(out);
  }

  // the series the drawer describes, in Programs' shape
  function seriesFromDraft() {
    const d = draft, f = d.sr, ev = d.ev;
    const end = f.end.type === 'date' ? { type: 'date', week: f.endWeek, day: f.endDay } : f.end.type === 'count' ? { type: 'count', n: f.n } : { type: f.end.type === 'year' ? 'year' : 'quarter' };
    return {
      id: d.origSeries ? d.origSeries.id : null, program: ev.program, slot: ev.slot, room: ev.room, scope: ev.scope, marketing: ev.marketing, addons: clone(ev.addons || {}),
      bookedWeek: d.origSeries && d.origSeries.marketing === ev.marketing ? d.origSeries.bookedWeek : S().week,
      pattern: clone(f.pattern), start: { week: ev.week, day: ev.day }, end,
    };
  }

  // Work out what saving a series would do, without doing it.
  function planSeries(sr, oldSr) {
    const s = S(), plan = { create: [], update: [], remove: [], skipped: [], delta: 0, dates: [] };
    const existing = oldSr ? s.events.filter(e => e.seriesId === oldSr.id && editable(e)) : [];
    const byOrig = {}; existing.forEach(e => { byOrig[(e.origWeek || e.week) + '-' + (e.origDay != null ? e.origDay : e.day)] = e; });
    const dates = Programs.seriesDates(sr).filter(dt => Programs.absDay(dt.week, dt.day) >= todayAbs());
    const ignore = oldSr ? { seriesId: oldSr.id } : (draft && draft.orig ? draft.orig : null);
    const used = new Set();
    dates.forEach(dt => {
      const k = dt.week + '-' + dt.day, ex = byOrig[k];
      if (ex) {
        used.add(ex.id);
        const upd = ex.exception ? Object.assign(clone(ex), { marketing: sr.marketing, bookedWeek: sr.bookedWeek }) : Object.assign(clone(ex), { program: sr.program, slot: sr.slot, room: sr.room, scope: sr.scope, addons: clone(sr.addons), marketing: sr.marketing, bookedWeek: sr.bookedWeek });
        plan.update.push({ from: ex, to: upd }); plan.delta += Programs.cost(upd) - Programs.cost(ex);
        plan.dates.push({ week: upd.week, day: upd.day, ok: true });
        return;
      }
      let why = null;
      const hol = GD.holidayOn(dt.week, dt.day);
      if (hol) why = 'closed: ' + hol;
      else if (!slotOpen(dt.week, dt.day, sr.slot)) why = dt.day === 5 && Programs.slot(sr.slot).noSaturday ? 'no evening slot on Saturdays' : 'too soon';
      else if (sr.room && venueClosed(sr.room, dt.week, dt.day, sr.slot)) why = venueClosed(sr.room, dt.week, dt.day, sr.slot).replace(/\.$/, '').toLowerCase();
      else if (sr.room && roomTaken(sr.room, dt.week, dt.day, sr.slot, sr.program, ignore)) why = 'room already booked';
      if (why) { plan.skipped.push({ week: dt.week, day: dt.day, why }); plan.dates.push({ week: dt.week, day: dt.day, ok: false, why }); return; }
      const ne = { program: sr.program, week: dt.week, day: dt.day, origWeek: dt.week, origDay: dt.day, slot: sr.slot, room: sr.room, scope: sr.scope, marketing: sr.marketing, addons: clone(sr.addons), bookedWeek: sr.bookedWeek, status: 'scheduled', seriesId: sr.id || 'new' };
      plan.create.push(ne); plan.delta += Programs.cost(ne);
      plan.dates.push({ week: dt.week, day: dt.day, ok: true });
    });
    existing.forEach(e => { if (!used.has(e.id)) { plan.remove.push(e); plan.delta -= Programs.cost(e); } });
    // marketing is bought once per series (again if you change the tier)
    if (!oldSr || oldSr.marketing !== sr.marketing) plan.delta += GD.MARKETING[sr.marketing].cost;
    // turning a one-off into a series: its own booking is replaced (its marketing is already spent)
    if (draft && draft.mode === 'single' && draft.orig) plan.delta -= Programs.cost(draft.orig) - GD.MARKETING[draft.orig.marketing].cost;
    return plan;
  }

  function renderDrawer() {
    const d = draft, ev = d.ev, p = Programs.get(ev.program), s = S();
    const canRepeat = d.mode === 'new' || d.mode === 'single' || d.mode === 'series';

    // when
    const fromAbs = todayAbs();
    $('cfg-date').innerHTML = '<label class="inline">' + (d.repeat ? 'Starts' : 'Date') + ' <select id="cfg-date-sel">' + dateOptions(ev.week + '-' + ev.day, fromAbs) + '</select></label>' +
      (ev.week === s.week ? ' <span class="small-print">(this week)</span>' : '');
    const avail = GD.SLOT_AVAILABILITY[GD.dayType(ev.week, ev.day)];
    $('cfg-slots').innerHTML = GD.SLOTS.map(sl => {
      const ok = d.repeat ? !(sl.noSaturday && ev.day === 5) : slotOpen(ev.week, ev.day, sl.id);
      return '<button type="button" class="slot' + (ev.slot === sl.id ? ' on' : '') + '" data-slot="' + sl.id + '"' + (ok ? '' : ' disabled') + '>' +
        '<b>' + sl.label + '</b><span>' + Game.fmtTime(sl.time) + '</span>' +
        '<span class="who-bars" aria-label="Who is around">' + GD.DEMO_KEYS.map(k => '<i title="' + GD.DEMOGRAPHICS[k].label + '" style="height:' + Math.round(avail[sl.id][k] * 100) + '%;background:' + GD.DEMOGRAPHICS[k].color + '"></i>').join('') + '</span></button>';
    }).join('') + '<p class="small-print">Bars: who is usually free then (' + GD.DEMO_KEYS.map(k => '<span class="dotk" style="background:' + GD.DEMOGRAPHICS[k].color + '"></span>' + GD.DEMOGRAPHICS[k].label).join(' ') + ').</p>';

    // repeat
    $('cfg-repeat-fs').hidden = !canRepeat;
    let plan = null, sr = null;
    if (canRepeat) {
      const f = d.sr, type = d.repeat ? f.pattern.type : 'none';
      let h = '<div class="seg rep-type">' + [['none', 'Doesn\'t repeat'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([v, l]) => '<button type="button" data-rep="' + v + '" class="' + (type === v ? 'on' : '') + '"' + (d.mode === 'series' && v === 'none' ? ' disabled' : '') + '>' + l + '</button>').join('') + '</div>';
      if (d.repeat) {
        if (f.pattern.type === 'weekly') {
          h += '<div class="rep-row">Every <select id="rep-every">' + [1, 2, 3, 4].map(n => '<option value="' + n + '"' + (f.pattern.every === n ? ' selected' : '') + '>' + (n === 1 ? 'week' : n + ' weeks') + '</option>').join('') + '</select> on ' +
            '<span class="day-toggles">' + C.days.map((dn, i) => '<button type="button" data-rday="' + i + '" class="' + (f.pattern.days.includes(i) ? 'on' : '') + '">' + dn + '</button>').join('') + '</span>' +
            ' <button type="button" class="btn small" id="rep-weekdays">Weekdays</button></div>';
        } else {
          h += '<div class="rep-row">On the <select id="rep-nth">' + [1, 2, 3, 4, 5].map(n => '<option value="' + n + '"' + (f.pattern.nth === n ? ' selected' : '') + '>' + ORD[n] + '</option>').join('') + '</select> <select id="rep-mday">' + C.dayNames.map((dn, i) => '<option value="' + i + '"' + (f.pattern.day === i ? ' selected' : '') + '>' + dn + '</option>').join('') + '</select> of each month</div>';
        }
        h += '<div class="rep-row ends">Ends ' +
          '<label><input type="radio" name="rep-end" value="quarter"' + (f.end.type === 'quarter' ? ' checked' : '') + '> end of the quarter</label>' +
          '<label><input type="radio" name="rep-end" value="year"' + (f.end.type === 'year' ? ' checked' : '') + '> end of the year</label>' +
          '<label><input type="radio" name="rep-end" value="date"' + (f.end.type === 'date' ? ' checked' : '') + '> on <select id="rep-end-date"' + (f.end.type === 'date' ? '' : ' disabled') + '>' + dateOptions(f.endWeek + '-' + f.endDay, Programs.absDay(ev.week, ev.day)) + '</select></label>' +
          '<label><input type="radio" name="rep-end" value="count"' + (f.end.type === 'count' ? ' checked' : '') + '> after <input type="number" id="rep-n" min="1" max="72" value="' + f.n + '"' + (f.end.type === 'count' ? '' : ' disabled') + '> sessions</label></div>';
        sr = seriesFromDraft();
        plan = planSeries(sr, d.origSeries || null);
        const ok = plan.dates.filter(x => x.ok);
        h += '<p class="rep-sum">' + Icons.svg('repeat') + ' <b>' + Programs.describePattern(sr) + '</b> at ' + Game.fmtTime(Programs.slot(ev.slot).time) +
          (ok.length ? ', ' + Game.fmtDate(ok[0].week, ok[0].day) + ' to ' + Game.fmtDate(ok[ok.length - 1].week, ok[ok.length - 1].day) : '') + ' · <b>' + ok.length + ' session' + (ok.length === 1 ? '' : 's') + '</b>' +
          (plan.skipped.length ? ', <span class="bad">' + plan.skipped.length + ' skipped</span>' : '') + '</p>' +
          '<div class="rep-dates">' + plan.dates.map(x => '<span class="' + (x.ok ? '' : 'skip') + '" title="' + (x.ok ? '' : x.why) + '">' + Game.fmtDate(x.week, x.day).replace(/^\w+, /, '') + '</span>').join('') + '</div>';
        if (!p.recurring && sr.pattern.type === 'weekly' && sr.pattern.every < 2) h += '<p class="small-print bad">' + esc(p.title) + ' isn\'t a weekly-regular kind of program: sessions less than 2 weeks apart draw smaller crowds.</p>';
        if (d.mode === 'series') {
          const exc = S().events.filter(e => e.seriesId === d.origSeries.id && e.exception && editable(e)).length;
          if (exc) h += '<p class="small-print">' + exc + ' upcoming session' + (exc === 1 ? ' has' : 's have') + ' its own changes and will keep them (unless the new pattern drops that date).</p>';
        }
      }
      $('cfg-repeat').innerHTML = h;
    }

    // where
    const list = roomList(ev.program, ev);
    const hl = {};
    let firstOff = true;
    $('cfg-rooms').innerHTML = list.map(({ room, fit, booked, closed }) => {
      if (!room.offsite) hl[room.id] = booked ? 'booked' : fit.tone;
      const label = closed ? 'Closed' : booked ? 'Booked' : room.isStaff && p.special !== 'tour' ? 'Staff only' : room.isUtility ? 'No' : { good: 'Great fit', ok: 'OK', bad: 'Poor fit' }[fit.tone];
      const head = room.offsite && firstOff ? (firstOff = false, '<p class="rooms-head">' + img('1f697') + 'Off-site, out in the community <span class="aside">no map; travel adds staff time</span></p>') : '';
      return head + '<button type="button" class="room-btn' + (room.offsite ? ' offsite' : '') + ' t-' + (closed || booked ? 'booked' : fit.tone) + (ev.room === room.id ? ' on' : '') + '" data-room="' + room.id + '"' + ((booked || closed) && !d.repeat ? ' disabled' : '') + (closed ? ' title="' + esc(closed) + '"' : room.offsite ? ' title="' + esc(room.hours) + '"' : '') + '>' +
        '<span class="sw" style="background:' + room.color + '"></span><span class="nm">' + (room.offsite ? img(room.emoji) : '') + room.name + '</span><small>' + floorLabel(room) + ' · ' + Programs.capacityFor(ev, room) + ' seats' + (closed ? ' · ' + esc(closed) : '') + '</small><em>' + label + '</em></button>';
    }).join('');
    Game.view.highlights = hl; Game.view.selectedRoom = ev.room;
    const room = Game.room(ev.room);
    const fit = Programs.roomFit(ev.program, room);
    $('cfg-fit').innerHTML = (room ? fit.notes.concat(room.offsite ? [room.blurb + ' Open: ' + room.hours] : []) : ['Pick a room here or on the map.']).map(n => '<li class="' + fit.tone + '">' + n + '</li>').join('');

    // scope
    const sm = GD.scopeMath(ev.scope);
    const w = 3 + ev.scope * 2.6;
    $('cfg-cone').innerHTML = '<polygon points="8,30 112,' + (30 - w) + ' 112,' + (30 + w) + '" fill="rgba(46,125,79,0.18)" stroke="#2e7d4f" stroke-width="1.5"/>' +
      Array.from({ length: 6 + ev.scope * 2 }, (_, i) => { const t = (i * 37 % 100) / 100, x = 30 + t * 80, spread = (x - 8) / 104 * w; const y = 30 + (((i * 53) % 100) / 50 - 1) * spread * 0.8; return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (ev.scope <= 3 ? 2.6 : 1.8) + '" fill="' + (i % 4 === 0 || ev.scope <= 3 ? GD.DEMOGRAPHICS[p.target].color : '#8a8f9c') + '"/>'; }).join('') +
      '<circle cx="8" cy="30" r="3.5" fill="#1d2b4f"/>';
    $('cfg-scope-text').innerHTML = 'Potential audience ~' + sm.potential.toLocaleString() + ', converting ~' + Math.round(sm.conversion * 100) + '%. ' +
      (ev.scope <= 3 ? 'Niche: the core crowd feels seen; everyone else may call it narrow.' : ev.scope >= 8 ? 'Broad: a little something for everyone; the core crowd may find it watered down.' : 'Balanced.') +
      ' ' + Math.round(sm.targetShare * 100) + '% ' + GD.DEMOGRAPHICS[p.target].label.toLowerCase() + '.';

    // add-ons
    $('cfg-addons').innerHTML = Object.entries(GD.ADDONS).map(([k, A]) =>
      '<label class="check"><input type="checkbox" data-addon="' + k + '"' + (ev.addons[k] ? ' checked' : '') + '>' + img(A.emoji) +
      '<span><b>' + A.label + '</b> ' + Game.money(A.cost) + (d.repeat ? ' per session' : '') + '<small>Boosts ' + Object.entries(A.boost).map(([dk, m]) => GD.DEMOGRAPHICS[dk].label.toLowerCase() + ' ×' + m).join(', ') + '. ' + Math.round(A.risk * 100) + '% chance of a taxpayer gripe.</small></span></label>').join('');

    // marketing
    const lockedMk = d.mode === 'occurrence';
    const changedMk = d.orig && d.orig.marketing !== ev.marketing;
    const moved = d.orig && (d.orig.week !== ev.week || d.orig.day !== ev.day);
    if (d.mode === 'series') ev.bookedWeek = sr ? sr.bookedWeek : ev.bookedWeek;
    else if (!lockedMk) ev.bookedWeek = (d.orig && !changedMk && !moved) ? d.orig.bookedWeek : s.week;
    const mk = Programs.marketing(d.repeat && sr ? Object.assign({}, ev, { seriesId: 'x', bookedWeek: sr.bookedWeek }) : ev);
    $('cfg-marketing').innerHTML = GD.MARKETING.map(m => '<label class="mk-opt' + (ev.marketing === m.id ? ' on' : '') + (lockedMk ? ' locked' : '') + '"><input type="radio" name="mk" value="' + m.id + '"' + (ev.marketing === m.id ? ' checked' : '') + (lockedMk ? ' disabled' : '') + '><b>' + m.label + '</b><span>' + (m.cost ? Game.money(m.cost) : 'Free') + (d.repeat && m.cost ? ' once' : '') + '</span><small>' + m.note + '</small></label>').join('');
    $('cfg-lead').innerHTML = lockedMk ? 'Marketing belongs to the series (edit the series to change it).' :
      d.repeat ? '<span class="lead-badge ' + GD.timingMultiplier(Math.min(6, (sr ? sr.start.week : ev.week) - (sr ? sr.bookedWeek : s.week))).tone + '">Series</span> One push announces the whole series; later sessions stay fresh as word gets around. The first sessions still need lead time: ' + mk.timing.tip :
      '<span class="lead-badge ' + mk.timing.tone + '">' + mk.timing.label + ' · ×' + mk.timing.mult.toFixed(1) + '</span> ' +
      (d.orig && !changedMk && !moved ? 'Marketing went out in week ' + Math.max(0, ev.bookedWeek) + '. ' : 'Marketing goes out now (week ' + s.week + '). ') + mk.timing.tip +
      (mk.late ? ' <b class="bad">The printer can\'t turn glossy posters around that fast: only +' + Math.round(mk.reach * 100) + '% reach.</b>' : '');

    // projection
    const projEv = d.repeat && sr ? Object.assign({}, ev, { seriesId: 'x', bookedWeek: sr.bookedWeek }) : ev;
    const pr = Programs.project(projEv, s, room);
    const maxN = Math.max(1, ...GD.DEMO_KEYS.map(k => pr.by[k]));
    let cost, delta;
    if (d.repeat && plan) { delta = plan.delta; cost = delta; }
    else { cost = Programs.cost(ev); delta = cost - (d.orig ? Programs.cost(d.orig) : 0); }
    const cap = GD.START.staffHoursPerWeek;
    let staffLine, staffBad = false;
    if (d.repeat && plan) {
      const weeks = {}; plan.create.concat(plan.update.map(u => u.to)).forEach(e => { weeks[e.week] = true; });
      const worst = Object.keys(weeks).map(w => +w).map(w => ({ w, h: Game.staffHours(w, null, d.origSeries ? d.origSeries.id : null) + p.staff * plan.create.concat(plan.update.map(u => u.to)).filter(e => e.week === w).length })).sort((a, b) => b.h - a.h)[0];
      staffLine = worst ? 'busiest week ' + worst.w + ': ' + worst.h + ' / ' + cap + ' h' : '-';
      staffBad = worst && worst.h > cap;
    } else {
      const sw = Game.staffHours(ev.week, ev.id) + p.staff; staffLine = 'week ' + ev.week + ': ' + sw + ' / ' + cap + ' h'; staffBad = sw > cap;
    }
    const warn = [];
    if (pr.overflowRisk && room) warn.push(['bad', 'Could outgrow the room (' + Math.round(pr.people) + ' people incl. caregivers vs ' + pr.cap + ' seats). Extras get turned away.']);
    if (pr.avail[p.target] < 0.3) warn.push(['bad', GD.DEMOGRAPHICS[p.target].label + ' mostly aren\'t free at this time.']);
    if (staffBad) warn.push(['bad', 'More staff hours than the team can do (' + cap + ' a week). Burnout lowers quality.']);
    if (delta > s.budget) warn.push(['bad', 'Not enough budget left (' + Game.money(s.budget) + ').']);
    if (p.special === 'seasonal' && Programs.seasonal(ev) < 1) warn.push(['ok', 'Off season: this one shines in ' + Programs.monthsText(p.months) + '.']);
    if (!d.repeat && room && room.offsite && venueClosed(room.id, ev.week, ev.day, ev.slot)) warn.push(['bad', room.name + ': ' + venueClosed(room.id, ev.week, ev.day, ev.slot)]);
    if (room && room.outdoor && pr.outdoor < 0.7) warn.push(['bad', 'It\'s cold out in ' + GD.MONTHS[GD.monthOf(ev.week, ev.day) - 1] + ': outdoor turnout drops to about ' + Math.round(pr.outdoor * 100) + '%.']);
    if (pr.classVisit) warn.push(['good', 'Class visit: the school brings the ' + GD.DEMOGRAPHICS[room.venue.classAudience].label.toLowerCase() + ', so the marketing hardly matters.']);
    if (GD.schoolBreak(ev.week, ev.day) && ev.day < 5) warn.push(['ok', GD.schoolBreak(ev.week, ev.day) + ': kids and teens are free all day.']);
    if (!d.repeat && Programs.novelty(ev, s.events) < 1) warn.push(['ok', 'You ran this within the last two weeks: turnout will be lower.']);
    if (d.repeat && plan && !plan.dates.some(x => x.ok)) warn.push(['bad', 'No sessions fit that pattern (check the days, end date and room).']);
    $('cfg-projection').innerHTML =
      '<div class="proj-head"><span class="big">' + pr.low + '&ndash;' + pr.high + '</span> expected' + (d.repeat ? ' per session' : '') + '</div>' +
      '<div class="proj-bars">' + GD.DEMO_KEYS.map(k => '<div class="pb"><span>' + img(GD.DEMOGRAPHICS[k].emoji) + GD.DEMOGRAPHICS[k].label + '</span><span class="bar"><i style="width:' + (pr.by[k] / maxN * 100).toFixed(0) + '%;background:' + GD.DEMOGRAPHICS[k].color + '"></i></span><b>' + Math.round(pr.by[k]) + '</b></div>').join('') + '</div>' +
      '<div class="proj-grid"><span>' + (d.repeat ? 'Series cost' : 'Cost') + '</span><b>' + (d.repeat ? (delta >= 0 ? '' : '-') + Game.money(Math.abs(delta)) + (d.origSeries || d.orig ? ' <small>(change)</small>' : '') : Game.money(cost) + (d.orig ? ' <small>(' + (delta >= 0 ? '+' : '') + Game.money(delta) + ')</small>' : '')) + '</b>' +
      '<span>Budget after</span><b class="' + (s.budget - delta < 0 ? 'bad' : '') + '">' + Game.money(s.budget - delta) + '</b>' +
      '<span>Staff</span><b class="' + (staffBad ? 'bad' : '') + '">' + staffLine + '</b>' +
      '<span>Room</span><b>' + (room ? room.name + ', ' + pr.cap + ' seats' : '<span class="bad">none</span>') + '</b></div>' +
      (warn.length ? '<ul class="notes">' + warn.map(([t, x]) => '<li class="' + t + '">' + x + '</li>').join('') + '</ul>' : '');
    const blocked = !room || delta > s.budget || (d.repeat ? !(plan && plan.dates.some(x => x.ok)) : (!slotOpen(ev.week, ev.day, ev.slot) || !!venueClosed(ev.room, ev.week, ev.day, ev.slot) || roomTaken(ev.room, ev.week, ev.day, ev.slot, ev.program, d.orig)));
    $('btn-confirm-schedule').disabled = blocked;
    draft._plan = plan; draft._sr = sr;
  }

  function bindDrawer() {
    $('cfg-slots').addEventListener('click', e => { const b = e.target.closest('.slot'); if (b && !b.disabled) { draft.ev.slot = b.dataset.slot; renderDrawer(); } });
    $('cfg-rooms').addEventListener('click', e => { const b = e.target.closest('.room-btn'); if (b && !b.disabled) pickRoom(b.dataset.room); });
    $('scope-slider').addEventListener('input', e => { draft.ev.scope = +e.target.value; renderDrawer(); });
    $('cfg-addons').addEventListener('change', e => { const c = e.target.closest('[data-addon]'); if (c) { draft.ev.addons[c.dataset.addon] = c.checked; renderDrawer(); } });
    $('cfg-marketing').addEventListener('change', e => { if (e.target.name === 'mk') { draft.ev.marketing = +e.target.value; renderDrawer(); } });
    $('cfg-date').addEventListener('change', e => {
      if (e.target.id !== 'cfg-date-sel') return;
      const [w, dd] = e.target.value.split('-').map(Number);
      const ev = draft.ev; ev.week = w; ev.day = dd;
      if (!draft.repeat && !slotOpen(w, dd, ev.slot)) { const sl = GD.SLOTS.find(x => slotOpen(w, dd, x.id)); if (sl) ev.slot = sl.id; }
      if (draft.repeat && draft.sr.pattern.type === 'weekly' && draft.sr.pattern.days.length === 1) draft.sr.pattern.days = [dd];
      if (draft.repeat && draft.sr.pattern.type === 'monthly') draft.sr.pattern.day = dd;
      renderDrawer();
    });
    $('cfg-mode').addEventListener('click', e => {
      const a = e.target.closest('[data-act="series"]'); if (!a) return;
      e.preventDefault();
      const sr = seriesOf(draft.orig); if (!sr) return;
      const ev = draft.orig; close(); editSeries(sr, ev);
    });
    const rep = $('cfg-repeat');
    rep.addEventListener('click', e => {
      const t = e.target.closest('[data-rep]');
      if (t && !t.disabled) {
        const v = t.dataset.rep;
        if (v === 'none') draft.repeat = false;
        else { draft.repeat = true; if (draft.sr.pattern.type !== v) draft.sr = Object.assign(draft.sr, { pattern: baseSeries(draft.ev, v).pattern }); }
        renderDrawer(); return;
      }
      const dbtn = e.target.closest('[data-rday]');
      if (dbtn) {
        const i = +dbtn.dataset.rday, days = draft.sr.pattern.days;
        if (days.includes(i)) { if (days.length > 1) days.splice(days.indexOf(i), 1); } else days.push(i);
        days.sort(); renderDrawer(); return;
      }
      if (e.target.id === 'rep-weekdays') { draft.sr.pattern.days = [0, 1, 2, 3, 4]; renderDrawer(); }
    });
    rep.addEventListener('change', e => {
      const f = draft.sr, t = e.target;
      if (t.id === 'rep-every') f.pattern.every = +t.value;
      if (t.id === 'rep-nth') f.pattern.nth = +t.value;
      if (t.id === 'rep-mday') { f.pattern.day = +t.value; }
      if (t.name === 'rep-end') f.end = { type: t.value };
      if (t.id === 'rep-end-date') { const [w, dd] = t.value.split('-').map(Number); f.endWeek = w; f.endDay = dd; }
      if (t.id === 'rep-n') f.n = Math.max(1, Math.min(72, +t.value || 1));
      renderDrawer();
    });
    $('cfg-close').addEventListener('click', close);
    $('btn-cancel').addEventListener('click', close);
    $('btn-confirm-schedule').addEventListener('click', confirm);
    $('btn-remove').addEventListener('click', () => {
      const d = draft;
      if (d.mode === 'occurrence') { close(); cancelOccurrence(d.orig); }
      else if (d.mode === 'series') { close(); cancelSeries(d.origSeries); }
      else { close(); removeSingle(d.orig); }
    });
  }

  function pickRoom(id) {
    if (!draft) return;
    const r = Game.room(id); if (!r || r.tags.includes('transit')) return;
    const ev = draft.ev;
    if (!draft.repeat && roomTaken(id, ev.week, ev.day, ev.slot, ev.program, draft.orig)) { Game.toast(r.name + ' is already booked then.', 'bad'); return; }
    if (!draft.repeat && venueClosed(id, ev.week, ev.day, ev.slot)) { Game.toast(r.name + ': ' + venueClosed(id, ev.week, ev.day, ev.slot), 'bad'); return; }
    ev.room = id;
    if (!r.offsite && r.floor !== Game.view.floor) Game.setFloor(r.floor);
    renderDrawer();
  }

  // ---------------------------------------------------------------- saving
  function confirm() {
    const d = draft, s = S(), p = Programs.get(d.ev.program);
    if (d.repeat) { applySeries(d); return; }
    const ev = d.ev;
    const cost = Programs.cost(ev), prev = d.orig ? Programs.cost(d.orig) : 0, delta = cost - prev;
    if (delta > s.budget) return;
    s.budget -= delta; s.spent += delta;
    if (d.orig) {
      const keep = { week: ev.week, day: ev.day, slot: ev.slot, room: ev.room, scope: ev.scope, addons: ev.addons, inherited: false };
      if (d.mode === 'occurrence') { keep.exception = true; if (d.orig.origWeek == null) { keep.origWeek = d.orig.week; keep.origDay = d.orig.day; } }
      else { keep.marketing = ev.marketing; keep.bookedWeek = ev.bookedWeek; }
      Object.assign(d.orig, keep);
      Game.toast(p.title + (d.mode === 'occurrence' ? ' (this session) updated.' : ' updated.'), 'good', p.emoji);
    } else {
      ev.id = s.nextId++; s.events.push(ev);
      Game.toast(p.title + ' booked for ' + Game.fmtDate(ev.week, ev.day) + '.', 'good', p.emoji);
    }
    Sfx.play('drop');
    finish();
  }

  function applySeries(d) {
    const s = S(), p = Programs.get(d.ev.program);
    s.series = s.series || [];
    const sr = seriesFromDraft();
    const plan = planSeries(sr, d.origSeries || null);
    if (plan.delta > s.budget || !plan.dates.some(x => x.ok)) return;
    if (!sr.id) { sr.id = 'sr' + (s.nextSeriesId = (s.nextSeriesId || 0) + 1); }
    // a one-off turned into a series: drop the one-off (refunded except its marketing)
    if (d.mode === 'single' && d.orig) s.events = s.events.filter(e => e !== d.orig);
    plan.remove.forEach(e => { s.events = s.events.filter(x => x !== e); });
    plan.update.forEach(u => Object.assign(u.from, u.to));
    plan.create.forEach(ne => { ne.seriesId = sr.id; ne.id = s.nextId++; s.events.push(ne); });
    if (d.origSeries) Object.assign(d.origSeries, sr); else s.series.push(sr);
    s.budget -= plan.delta; s.spent += plan.delta;
    const n = plan.create.length + plan.update.length;
    Game.toast(p.title + ': ' + Programs.describePattern(sr).toLowerCase() + ', ' + n + ' session' + (n === 1 ? '' : 's') + (plan.skipped.length ? ' (' + plan.skipped.length + ' skipped)' : '') + '.', 'good', p.emoji);
    Sfx.play('drop');
    finish();
  }

  function finish() { close(); refresh(); Game.refreshHUD(); Game.save(); }

  function refundAndPost(ev, includeMarketing) {
    const s = S(), p = Programs.get(ev.program);
    const mkCost = ev.seriesId ? 0 : GD.MARKETING[ev.marketing].cost;
    const refund = Programs.cost(ev) - (includeMarketing ? 0 : mkCost);
    s.budget += refund; s.spent -= refund;
    if (ev.marketing > 0 && ev.week - s.week <= 1) {
      Game.adjustGW(p.target, -0.5);
      Feed.add({ key: 'cancelled', demo: p.target, vars: { program: p.title }, gw: -0.5 }, Game.whenStamp());
    }
    return refund;
  }
  function removeSingle(ev) {
    if (!ev) return;
    const s = S(), p = Programs.get(ev.program);
    const refund = refundAndPost(ev, false);
    s.events = s.events.filter(e => e !== ev);
    Game.toast(p.title + ' cancelled. ' + Game.money(refund) + ' refunded' + (GD.MARKETING[ev.marketing].cost ? ' (marketing already spent)' : '') + '.', 'info', p.emoji);
    finish();
  }
  function cancelOccurrence(ev) {
    if (!ev || !editable(ev)) return;
    const p = Programs.get(ev.program);
    const refund = refundAndPost(ev, true);
    ev.status = 'cancelled'; ev.exception = true;
    if (ev.origWeek == null) { ev.origWeek = ev.week; ev.origDay = ev.day; }
    Game.toast(p.title + ' on ' + Game.fmtDate(ev.week, ev.day) + ' skipped. ' + Game.money(refund) + ' refunded.', 'info', p.emoji);
    finish();
  }
  async function cancelSeries(sr) {
    if (!sr) return;
    const s = S(), p = Programs.get(sr.program);
    const upcoming = s.events.filter(e => e.seriesId === sr.id && editable(e));
    if (!(await Screens.ask({ title: 'Cancel the whole series?', text: 'All ' + upcoming.length + ' upcoming sessions of ' + p.title + ' will be cancelled. Sessions that already ran stay in the record.', yes: 'Cancel the series', no: 'Keep it', danger: true }))) return;
    let refund = 0;
    upcoming.forEach(e => { refund += refundAndPost(e, true); });
    s.events = s.events.filter(e => !upcoming.includes(e));
    sr.cancelled = true;
    Game.toast(p.title + ' series cancelled. ' + Game.money(refund) + ' refunded (marketing already spent).', 'info', p.emoji);
    finish();
  }
  function endSeriesAfter(sr, ev) {
    const s = S(), p = Programs.get(sr.program);
    const later = s.events.filter(e => e.seriesId === sr.id && editable(e) && Programs.dayIndex(e) > Programs.dayIndex(ev));
    let refund = 0;
    later.forEach(e => { refund += refundAndPost(e, true); });
    s.events = s.events.filter(e => !later.includes(e));
    sr.end = { type: 'date', week: ev.week, day: ev.day };
    Game.toast(p.title + ' now ends ' + Game.fmtDate(ev.week, ev.day) + '. ' + later.length + ' later session' + (later.length === 1 ? '' : 's') + ' removed, ' + Game.money(refund) + ' refunded.', 'info', p.emoji);
    finish();
  }

  // ---------------------------------------------------------------- public
  function init() {
    if (!inited) { renderDeckFilter(); renderQuarterTabs(); bindPlanning(); bindDrawer(); inited = true; }
    if (draft) close();
    lastScrolledWeek = null;
    S().series = S().series || [];
    refresh();
  }
  let lastKey = '';
  function refresh() {
    if (!S()) return;
    renderCalendar(); renderDeck();
    if (draft) renderDrawer();
    lastKey = S().week + ':' + S().day;
  }
  // keep the calendar's "today"/"started" states current as the clock moves
  setInterval(() => { if (S() && Game.running && !draft && !document.body.classList.contains('dragging') && !Menu.isOpen()) { const k = S().week + ':' + S().day + ':' + Math.floor(S().minute / 30); if (k !== lastKey) { lastKey = k; renderCalendar(); } } }, 1000);

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  return { init, refresh, tipHtml, isPicking: () => !!draft, pickRoom, close, roomMenu, startPlacing, renderDeck, esc };
})();
