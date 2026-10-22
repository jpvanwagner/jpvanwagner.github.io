/* JS/SCREENS.JS - Everything that opens over the game: the director's welcome memo, the
   first-time tips, How to Play, Settings, the weekly wrap-up, a finished program's results,
   the quarterly reports, the Library Board's year-end review, and the credits. */

window.Screens = (function () {
  const GD = GameData, C = GD.CALENDAR;
  const $ = (id) => document.getElementById(id);
  const img = (code) => '<img src="assets/emoji/' + code + '.svg" alt="" class="inline-emoji">';
  let onClose = null, held = false;

  function modal(title, body, buttons, opts) {
    opts = opts || {};
    $('modal-title').innerHTML = title;
    $('modal-body').innerHTML = body;
    const foot = $('modal-foot'); foot.innerHTML = '';
    (buttons || [{ label: 'Close', primary: true }]).forEach(b => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '');
      el.textContent = b.label;
      el.addEventListener('click', () => { if (b.keepOpen) { b.action && b.action(); return; } hide(); if (b.action) b.action(); });
      foot.appendChild(el);
    });
    const card = document.querySelector('#modal .modal-card');
    card.classList.toggle('wide', !!opts.wide);
    $('modal-close').hidden = !!opts.noClose;
    $('modal').classList.add('on');
    if (Game.running && !held) { Game.hold(); held = true; }
    onClose = opts.onClose || null;
    setTimeout(() => { const f = foot.querySelector('.primary') || foot.querySelector('button'); if (f) f.focus(); }, 30);
    return $('modal-body');
  }
  // An in-game yes/no question (instead of the browser's confirm box). Resolves true or false.
  // ask({ title, text, yes: 'Delete', no: 'Keep it', danger: true })
  let askDone = null;
  function ask(o) {
    if (askDone) askDone(false);
    $('ask-title').textContent = o.title || 'Are you sure?';
    $('ask-text').textContent = o.text || '';
    const yes = $('ask-yes'), no = $('ask-no');
    yes.textContent = o.yes || 'OK'; no.textContent = o.no || 'Cancel';
    yes.classList.toggle('danger', !!o.danger); yes.classList.toggle('primary', !o.danger);
    $('ask').classList.add('on');
    const heldHere = Game.running; if (heldHere) Game.hold();
    setTimeout(() => (o.danger ? no : yes).focus(), 30);
    return new Promise(res => {
      askDone = (v) => { askDone = null; $('ask').classList.remove('on'); if (heldHere) Game.release(); res(v); };
    });
  }
  function initAsk() {
    $('ask-yes').addEventListener('click', () => askDone && askDone(true));
    $('ask-no').addEventListener('click', () => askDone && askDone(false));
    $('ask').addEventListener('click', e => { if (e.target === $('ask') && askDone) askDone(false); });
    document.addEventListener('keydown', e => { if (askDone && e.key === 'Escape') { e.stopPropagation(); askDone(false); } }, true);
  }

  function hide() {
    $('modal').classList.remove('on');
    if (held) { held = false; Game.release(); }
    const cb = onClose; onClose = null; if (cb) cb();
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('modal-close').addEventListener('click', hide);
    $('modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('modal-close').hidden) hide(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('modal').classList.contains('on') && !$('modal-close').hidden) hide(); });
  });

  // ---------------------------------------------------------------- intro memo + coach marks
  function intro() {
    modal(img('1f4dc') + ' Memo: Welcome to Programming',
      '<div class="memo"><p class="memo-head"><b>To:</b> New Programming Director<br><b>From:</b> Dr. Okafor, Library Director<br><b>Re:</b> Your first year</p>' +
      '<p>Welcome aboard! You own the public program calendar for <b>' + C.yearName + '</b>: four quarters, fifty-two weeks, starting ' + Game.fmtDate(1, 0, true) + '. We serve a town of about ' + (Game.state.population || GD.POPULATION.default).toLocaleString('en-US') + '.</p>' +
      '<p>I\'ll send the Board a short report at the end of each quarter, and they\'ll review the whole year at the end of Week 52. They\'ll look at:</p>' +
      '<ul><li><b>Goodwill</b> from all four audiences: seniors, adults, teens and families with toddlers.</li>' +
      '<li><b>Reach</b>: well-attended programs for every audience, all year.</li>' +
      '<li><b>Outreach</b>: programs out in the community, at the parks, the rec center and the schools.</li>' +
      '<li><b>Budget</b>: you have ' + Game.money(GD.START.budget) + ' for the year. Spend it well, and spend it: money left on the table gets cut next year.</li>' +
      '<li><b>Friction</b>: people storming out of noisy or packed rooms, people turned away at the door, programs in places the public shouldn\'t be.</li>' +
      '<li><b>Marketing</b>: the word needs to get out <b>4 to 6 weeks</b> ahead.</li></ul>' +
      '<p>A word on the building: the <b>Program Room</b>, right off the entryway, is soundproof. Everything else leaks, and upstairs the Teen Zone shares a landing with Reference and the PC Lab. The holidays close us, and summer brings the kids.</p>' +
      '<p>Your predecessor left a few things on the calendar, including a weekly storytime series. I\'d look those over.</p><p class="sig">Dr. A. Okafor</p></div>',
      [{ label: 'Let\'s get started', primary: true, action: () => { if (!Game.state.flags.coachDone) coach(); } }], { noClose: false });
  }

  const COACH = [
    ['#deck-panel', 'These are your <b>program cards</b>. Drag one onto a day in the calendar (or click it, then click a day). Hover a card for details.'],
    ['#calendar-panel', 'The <b>Master Schedule</b>: the whole year, a quarter at a time (jump with the season buttons). Colors show marketing lead time from today: <span class="lg good"></span> green weeks are the 4-to-6-week sweet spot. Striped days are holidays; a dotted line means school\'s out. Click a booked program to change it.'],
    ['#map-panel', 'The <b>library</b>, drawn from its Mapster map. Switch floors with the tabs. Dots are patrons; hover a room to see who\'s there and how loud it is. Turn on <b>Noise</b> to see sound spreading.'],
    ['#feed-panel', 'The <b>Community Pulse</b>: what people say about the library. Every post is the math talking: green helps Goodwill, red hurts it.'],
    ['.clock', 'Time is paused. Press <b>play</b> (or the space bar) to open the doors. Skip ahead with the arrows. Time pauses whenever you configure a program.'],
  ];
  function coach(i) {
    i = i || 0;
    const box = $('coach');
    if (i >= COACH.length) { box.hidden = true; document.querySelectorAll('.coach-focus').forEach(x => x.classList.remove('coach-focus')); Game.state.flags.coachDone = true; Game.save(); return; }
    const [sel, text] = COACH[i];
    const target = document.querySelector(sel);
    document.querySelectorAll('.coach-focus').forEach(x => x.classList.remove('coach-focus'));
    target.classList.add('coach-focus');
    $('coach-text').innerHTML = text + ' <small>(' + (i + 1) + '/' + COACH.length + ')</small>';
    box.hidden = false;
    const r = target.getBoundingClientRect(), b = box.getBoundingClientRect();
    let x = r.left + 12, y = r.bottom + 10;
    if (y + b.height > window.innerHeight - 8) y = Math.max(8, r.top - b.height - 10);
    if (y < 8 || (r.height > window.innerHeight * 0.5)) { y = r.top + 40; x = r.left + r.width / 2 - b.width / 2; }
    box.style.left = Math.max(8, Math.min(window.innerWidth - b.width - 8, x)) + 'px';
    box.style.top = Math.max(8, Math.min(window.innerHeight - b.height - 8, y)) + 'px';
    $('coach-next').textContent = i === COACH.length - 1 ? 'Got it' : 'Next';
    $('coach-next').onclick = () => coach(i + 1);
    $('coach-skip').onclick = () => coach(COACH.length);
  }

  // ---------------------------------------------------------------- help
  function help() {
    const sweet = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12].map(w => { const t = GD.timingMultiplier(w); return '<td class="' + t.tone + '">' + (w === 12 ? '12+' : w) + '<br>×' + t.mult + '</td>'; }).join('');
    const avail = GD.SLOT_AVAILABILITY.weekday;
    modal(img('1f4d6') + ' How to Play',
      '<div class="help">' +
      '<h3>The loop</h3><ol><li><b>Review</b> the Community Pulse and your numbers.</li><li><b>Plan</b>: drag program cards onto the calendar.</li><li><b>Configure</b>: date, repeat, time slot, room, scope, refreshments, marketing. The projection updates as you go.</li><li><b>Run time</b> and watch patrons move through the library.</li><li><b>Reflect</b> on the posts and the numbers, and plan the weeks ahead.</li></ol>' +
      '<h3>Right-click everything</h3><p><b>Program cards</b>: schedule, schedule as a series, rename, open in the Card Workshop, duplicate, hide. <b>Bookings</b>: edit, move, make it repeat, book a copy, cancel. <b>Days</b>: schedule something there. <b>Rooms on the map</b>: book a program in that room, see what\'s booked there.</p>' +
      '<h3>Recurring programs</h3><p>Set <b>Repeat</b> in the drawer: weekly (every 1 to 4 weeks, on any days) or monthly (the 1st to 4th or last weekday of the month), ending at the end of the quarter or the year, on a date, or after a number of sessions. Sessions that land on a holiday are skipped. Each session is its own booking: click one to change <i>just that date</i>, or right-click it to skip it, move it, end the series there, or edit the whole series. Sessions you changed one by one keep their changes when you edit the series. A series pays for its marketing once, and its later sessions stay fresh in people\'s minds. Programs that aren\'t weekly regulars draw smaller crowds when repeated less than two weeks apart.</p>' +
      '<h3>The Card Workshop</h3><p>Open it from the deck (or the <b>New card</b> tile) to make your own programs: title, icon, audience, cost, staff time, length, noise, draw, the rooms it suits, and specials like fundraisers or tours. It previews the card, the best rooms for it and its likely turnout. Rename any card (built-in ones too), duplicate a built-in card to make your own version, hide cards you don\'t use, and export or import your cards as a file.</p>' +
      '<h3>The map</h3><p><b>3D</b> is Mapster\'s own engine with no player: drag to pan, scroll to zoom, right-drag (or Shift+drag) to rotate and tilt, or use the buttons in the corner (Q/E rotate and T tilts too). <b>Blueprint</b> is a flat plan: scroll to zoom, drag to pan. The floor tabs show one floor at a time. <b>Noise</b> colours the floor from pale yellow (a murmur) to red (loud), and the line under the map names the loudest room and any quiet room it\'s disturbing.</p>' +
      '<h3>The year</h3><p>Fifty-two weeks in four quarters (Fall, Winter, Spring, Summer); the Board gets a report after each and reviews the year at the end. The library closes for holidays (striped on the calendar). On school breaks (a dotted line under the day) kids and teens are around all day, and the schools are closed. Seasonal cards shine in their months: Spooky Story Night in October, the Holiday Craft Workshop in December, Free Tax Help from February to April, Summer Reading in June and July, the Back-to-School Bash in August.</p>' +
      '<h3>Out in the community</h3><p>Programs don\'t have to happen in the library. Pick an <b>off-site</b> venue in the drawer: Riverside Park or Maple Grove Playground, the Westside Rec Center, Lincoln Elementary, Jefferson Middle, Central High or Riverbend College. Each reaches different people, has its own hours (schools only on school days; parks only in daylight, and nobody comes out in winter) and costs an extra staff hour for travel. A <b>class visit</b> during the school day brings its own audience. Off-site programs sign up new library cardholders, and nobody in the library hears them.</p>' +
      '<h3>Your town</h3><p>Pick the town\'s population on the title screen or in Settings. A bigger town means more visitors and bigger turnouts, but the rooms don\'t grow.</p>' +
      '<h3>Your desk</h3><p>Fold any panel away with the arrow in its corner (click a folded panel to open it again), or fold them all at once with the button next to Help. The map gets the room. The button beside the sound switch plays full screen.</p>' +
      '<h3>Marketing lead time</h3><p>Weeks between booking a program (when its marketing goes out) and the program itself:</p><table class="lead-table"><tr>' + sweet + '</tr></table>' +
      '<p>Flyers add 15% reach; glossy posters and partner outreach add 40%, but only with 3+ weeks to print. Changing a program\'s date or marketing later sends the marketing out again from that day.</p>' +
      '<h3>Who is free when</h3><table class="avail-table"><tr><th></th>' + GD.SLOTS.map(s => '<th>' + s.label + '<br><small>' + Game.fmtTime(s.time) + '</small></th>').join('') + '</tr>' +
      GD.DEMO_KEYS.map(d => '<tr><th>' + img(GD.DEMOGRAPHICS[d].emoji) + GD.DEMOGRAPHICS[d].label + '</th>' + GD.SLOTS.map(s => '<td><span class="mini-bar"><i style="width:' + avail[s.id][d] * 100 + '%;background:' + GD.DEMOGRAPHICS[d].color + '"></i></span></td>').join('') + '</tr>').join('') + '</table>' +
      '<p>Weekdays shown; Saturdays are shorter (10 to 5), families and teens are around all day, and there\'s no evening slot. Teens flood in after 3:00 on school days: when the Teen Zone fills up, they spill into quieter rooms.</p>' +
      '<h3>Rooms</h3><p>Quiet rooms (Reference, Study Rooms, PC Lab) are full of people who came for silence. A loud program in or near them drains their patience until they walk out and post about it. Programs make noise, and so does a crowd in a loud room (the Children\'s Section, the Teen Zone, the entryway). Noise leaks through open archways and doors, less through glass, and not through solid walls. The <b>Program Room is soundproof</b>. Basement rooms are staff-only: the <b>Behind the Stacks Tour</b> is the only program that belongs there. Rooms over 85% full feel crowded; past capacity, people get turned away.</p>' +
      '<h3>Scope</h3><p><b>Niche</b> (left): a small potential audience that converts well. The core audience feels seen (big Goodwill boost), but others may grumble about "narrow programming." <b>Broad</b> (right): a big potential audience that barely converts. A little Goodwill from everyone, but the core audience may find it watered down.</p>' +
      '<h3>Budget and staff</h3><p>Programs are paid for when you lock them in; cancelling refunds everything except marketing already spent. The Book Sale earns money back. Your team can absorb ' + GD.START.staffHoursPerWeek + ' program hours a week; book more and quality slips.</p>' +
      '<h3>Goodwill</h3><p>Each audience\'s Goodwill drifts down a little every week without programming, and faster if nothing has been aimed at them for three weeks. Higher Goodwill brings more everyday visitors and bigger turnouts.</p>' +
      '<h3>Controls</h3><p>Space: pause/play. 1 to 5: speed (½× to 8×). Esc: close. Click a booking to change it; right-click almost anything for more.</p>' +
      '<h3>Editing the library</h3><p>The building is a <a href="https://github.com/Nostalginaut/TOOL--Mapster" target="_blank" rel="noopener">Mapster</a> map: <code>maps/library.html</code>. Open Mapster, choose <b>Load Project</b>, pick that file, and edit: paint zones to make rooms, move walls and doors, add seats (benches, sit-down stations) and props (storage boxes), add floors and connect them with stairs. Export it back over <code>maps/library.html</code>. See the README for the details.</p>' +
      '</div>', null, { wide: true });
  }

  // ---------------------------------------------------------------- settings
  function settings() {
    const s = Game.state;
    const body = modal(img('2699') + ' Settings',
      '<div class="settings">' +
      (s ? '<label class="check"><input type="checkbox" id="set-weekly"' + (s.flags.pauseWeekly ? ' checked' : '') + '><span><b>Pause for a wrap-up at the end of each week</b><small>A summary and a look ahead.</small></span></label>' : '') +
      '<label class="check"><input type="checkbox" id="set-sound"' + (Sfx.muted ? '' : ' checked') + '><span><b>Sound effects</b></span></label>' +
      '<h3>Library map</h3><p class="small-print">Now showing: <b>' + Game.fac.name + '</b> (' + Game.fac.floors.map(f => f.name).join(', ') + '; ' + Object.keys(Game.fac.rooms).length + ' rooms) from ' + Game.mapSource + '.</p>' +
      '<p class="small-print">Try a layout you\'ve edited in Mapster without touching the game\'s files. It\'s used until you reload the page.</p>' +
      '<div class="row"><button type="button" class="btn" id="set-loadmap">Load a Mapster map&hellip;</button><button type="button" class="btn" id="set-resetmap">Back to the library map</button></div>' +
      (s ? '<h3>Town</h3><label class="inline">Population <input type="text" id="set-pop" inputmode="numeric" list="pop-presets" value="' + (s.population || GD.POPULATION.default).toLocaleString('en-US') + '" style="width:120px"></label> <button type="button" class="btn small" id="set-pop-apply">Apply</button><p class="small-print">More people means more visitors and bigger turnouts from now on. The rooms stay the same size.</p>' : '') +
      (s ? '<h3>Year</h3><div class="row"><button type="button" class="btn danger" id="set-restart">Restart the year</button></div>' : '') +
      '</div>');
    const w = body.querySelector('#set-weekly'); if (w) w.addEventListener('change', () => { s.flags.pauseWeekly = w.checked; Game.save(); });
    body.querySelector('#set-sound').addEventListener('change', e => { Sfx.setMuted(!e.target.checked); const b = $('btn-sound'); b.innerHTML = Icons.svg(Sfx.muted ? 'volume-off' : 'volume'); });
    body.querySelector('#set-loadmap').addEventListener('click', () => { hide(); $('map-file').click(); });
    body.querySelector('#set-resetmap').addEventListener('click', () => { hide(); Game.reloadDefaultMap(); });
    const pa = body.querySelector('#set-pop-apply');
    if (pa) pa.addEventListener('click', () => { const n = Math.round(+String(body.querySelector('#set-pop').value).replace(/[^0-9]/g, '')); if (!n) return; Game.setPopulation(n); body.querySelector('#set-pop').value = Game.state.population.toLocaleString('en-US'); Game.toast('Population set to ' + Game.state.population.toLocaleString('en-US') + '.', 'good'); });
    const r = body.querySelector('#set-restart'); if (r) r.addEventListener('click', async () => { if (await ask({ title: 'Restart from Week 1?', text: 'Your progress will be lost.', yes: 'Restart', no: 'Keep playing', danger: true })) { hide(); Game.restart(); } });
  }

  // ---------------------------------------------------------------- weekly wrap-up
  function weekWrap(wk) {
    const s = Game.state;
    const ahead = [s.week + 3, s.week + 4, s.week + 5].filter(w => w <= C.weeks);
    const tips = [];
    if (wk.walkouts >= 3) tips.push(wk.walkouts + ' regulars walked out over noise or crowding. Check the Noise overlay while a program runs.');
    if (ahead.length) tips.push('Weeks ' + ahead[0] + (ahead.length > 1 ? ' to ' + ahead[ahead.length - 1] : '') + ' are 4 to 6 weeks out: book now and the marketing has time to work.');
    const unserved = GD.DEMO_KEYS.filter(d => s.lastServed[d] < s.week - 2);
    if (unserved.length) tips.push('Nobody has programmed for ' + unserved.map(d => GD.DEMOGRAPHICS[d].label.toLowerCase()).join(' or ') + ' lately. They\'re noticing.');
    const sh = Game.staffHours(s.week);
    if (sh > GD.START.staffHoursPerWeek) tips.push('This week is overbooked: ' + sh + ' staff hours against ' + GD.START.staffHoursPerWeek + '.');
    if (!s.events.some(e => e.status === 'scheduled')) tips.push('Nothing is on the calendar. Goodwill fades without programs.');
    const gwRows = GD.DEMO_KEYS.map(d => '<span class="gw-pill" style="--c:' + GD.DEMOGRAPHICS[d].color + '">' + img(GD.DEMOGRAPHICS[d].emoji) + Math.round(s.goodwill[d]) + '%</span>').join('');
    modal(img('1f4c8') + ' Week ' + wk.week + ' Wrap-up',
      '<div class="wrap-stats"><div><b>' + wk.visits + '</b><span>visits</span></div><div><b>' + wk.programs + '</b><span>programs</span></div><div><b>' + wk.attendance + '</b><span>attendees</span></div><div><b>' + wk.circ + '</b><span>checkouts</span></div><div><b class="' + (wk.gwDelta >= 0 ? 'up' : 'down') + '">' + (wk.gwDelta >= 0 ? '+' : '') + wk.gwDelta.toFixed(1) + '</b><span>goodwill</span></div></div>' +
      '<p class="gw-row">' + gwRows + '</p>' +
      '<h3>Planning meeting</h3><ul class="tips">' + tips.map(t => '<li>' + t + '</li>').join('') + '</ul>' +
      '<p class="small-print">Budget left: ' + Game.money(s.budget) + ' · ' + (C.weeks - s.week + 1) + ' weeks to go.</p>',
      [{ label: 'Back to work (Week ' + s.week + ')', primary: true }]);
  }

  // ---------------------------------------------------------------- the quarterly report
  function quarterReport(q) {
    const s = Game.state, next = GD.quarterOf(s.week);
    const gwRows = GD.DEMO_KEYS.map(d => { const ch = q.gwBy[d] - q.gwBy0[d]; return '<span class="gw-pill" style="--c:' + GD.DEMOGRAPHICS[d].color + '">' + img(GD.DEMOGRAPHICS[d].emoji) + Math.round(q.gwBy[d]) + '% <small class="' + (ch >= 0 ? 'up' : 'down') + '">' + (ch >= 0 ? '+' : '') + ch.toFixed(1) + '</small></span>'; }).join('');
    const notes = [];
    if (q.programs === 0) notes.push('No programs ran this quarter. The Board noticed.');
    if (q.walkouts >= 15) notes.push(q.walkouts + ' regulars walked out over noise or crowding.');
    if (q.turnedAway >= 30) notes.push(q.turnedAway + ' people were turned away from full programs.');
    if (q.offsite) notes.push(q.offsite + ' program' + (q.offsite === 1 ? '' : 's') + ' out in the community.'); else notes.push('Nothing off-site yet: the parks, the rec center and the schools reach people who don\'t come in.');
    const behind = GD.DEMO_KEYS.filter(d => q.gwBy[d] - q.gwBy0[d] < -3);
    if (behind.length) notes.push('Losing ground with ' + behind.map(d => GD.DEMOGRAPHICS[d].label.toLowerCase()).join(' and ') + '.');
    const ahead = { 'Winter Quarter': 'Winter: the holidays close us on a few days, schools break for two weeks, and outdoor programs go quiet. Holiday crafts, and Free Tax Help from February.', 'Spring Quarter': 'Spring: tax season, spring break in March, and the parks come back to life in April.', 'Summer Quarter': 'Summer: school\'s out from mid-June. Summer Reading is the big one, and the parks are at their best.' }[next.name] || '';
    modal(img('1f5d3') + ' ' + q.quarter.name + ' Report',
      '<div class="memo"><p class="memo-head"><b>To:</b> Library Board<br><b>From:</b> Dr. Okafor, Library Director<br><b>Re:</b> ' + q.quarter.name + ' programming</p>' +
      '<div class="wrap-stats"><div><b>' + q.programs + '</b><span>programs</span></div><div><b>' + q.attendance.toLocaleString() + '</b><span>attendees</span></div><div><b>' + q.visits.toLocaleString() + '</b><span>visits</span></div><div><b>' + q.circ.toLocaleString() + '</b><span>checkouts</span></div><div><b>' + Game.money(q.spent) + '</b><span>spent</span></div><div><b class="' + (q.gwDelta >= 0 ? 'up' : 'down') + '">' + (q.gwDelta >= 0 ? '+' : '') + q.gwDelta.toFixed(1) + '</b><span>goodwill</span></div></div>' +
      '<p class="gw-row">' + gwRows + '</p><ul class="tips">' + notes.map(n => '<li>' + n + '</li>').join('') + '</ul>' +
      (ahead ? '<p><b>Next up.</b> ' + ahead + '</p>' : '') +
      '<p class="small-print">Budget left for the year: ' + Game.money(s.budget) + ' · ' + (C.weeks - s.week + 1) + ' weeks to go.</p><p class="sig">Dr. A. Okafor</p></div>',
      [{ label: 'On to the ' + next.name, primary: true }], { wide: true });
  }

  // ---------------------------------------------------------------- one program's results
  function result(ev) {
    const p = Programs.get(ev.program), r = ev.result, room = Game.room(ev.room);
    const rows = GD.DEMO_KEYS.filter(d => r.by[d] || r.gw[d]).map(d => '<tr><td>' + img(GD.DEMOGRAPHICS[d].emoji) + GD.DEMOGRAPHICS[d].label + '</td><td>' + (r.by[d] || 0) + '</td><td class="' + (r.gw[d] >= 0 ? 'up' : 'down') + '">' + (r.gw[d] >= 0 ? '+' : '') + r.gw[d] + '</td></tr>').join('');
    modal(img(p.emoji) + ' ' + p.title,
      '<p>' + Game.fmtDate(ev.week, ev.day, true) + ', ' + Game.fmtTime(Programs.startOf(ev)) + ' · ' + (room ? room.name : '') + '</p>' +
      '<div class="wrap-stats"><div><b>' + r.attendance + '</b><span>attended</span></div><div><b>' + (r.turnedAway || 0) + '</b><span>turned away</span></div><div><b>' + Math.round(r.quality * 100) + '%</b><span>quality</span></div><div><b>' + r.circ + '</b><span>checkouts</span></div>' + (r.revenue ? '<div><b>' + Game.money(r.revenue) + '</b><span>raised</span></div>' : '') + (r.signups ? '<div><b>' + r.signups + '</b><span>new cards</span></div>' : '') + '</div>' +
      '<table class="res-table"><tr><th></th><th>Came</th><th>Goodwill</th></tr>' + rows + '</table>' +
      ((r.notes && r.notes.length) ? '<ul class="tips">' + r.notes.map(n => '<li>' + n + '</li>').join('') + '</ul>' : '') +
      (r.complaints ? '<p class="bad">' + r.complaints + ' people elsewhere in the library walked out because of the noise.</p>' : ''));
  }

  // ---------------------------------------------------------------- the Library Board review
  function grade(v, cuts) { const L = ['A', 'B', 'C', 'D']; for (let i = 0; i < cuts.length; i++) if (v(cuts[i])) return L[i]; return 'F'; }
  const GPA = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  function report() {
    const s = Game.state, st = s.stats;
    const ov = Game.overall(), ov0 = GD.DEMO_KEYS.reduce((t, d) => t + s.goodwillStart[d] * GD.DEMOGRAPHICS[d].share, 0);
    // the thresholds were tuned for 12 weeks in a town of 30,000: scale them to the year and the town
    const YF = C.weeks / 12, PF = GD.population(), REACH = 10;
    const served = GD.DEMO_KEYS.filter(d => st.servedCount[d] >= REACH).length;
    const offsite = st.offsite || 0;
    const used = s.spent / (s.startBudget + s.revenue);
    const friction = st.noiseWalkouts + st.crowdWalkouts + Math.round(st.turnedAway / 3) + st.wrongRooms * 10;
    const avgLead = st.leads.length ? st.leads.reduce((a, b) => a + b, 0) / st.leads.length : 0;
    const runs = s.events.filter(e => e.status === 'done');
    const grades = [
      ['Community Goodwill', Math.round(ov) + '% (started at ' + Math.round(ov0) + '%)', grade(c => ov >= c, [74, 67, 60, 52])],
      ['Reach', served + ' of 4 audiences got ' + REACH + '+ programs', grade(c => served >= c, [4, 3, 2, 1])],
      ['Outreach', offsite + ' program' + (offsite === 1 ? '' : 's') + ' out in the community', grade(c => offsite >= c, [10, 6, 3, 1])],
      ['Budget stewardship', Math.round(used * 100) + '% of ' + Game.money(s.startBudget + s.revenue) + ' put to work', grade(c => used >= c, [0.85, 0.7, 0.5, 0.3])],
      ['Friction', friction + ' incidents (walkouts, turned away, wrong rooms)', grade(c => friction <= c * YF * PF, [20, 45, 75, 110])],
      ['Marketing', runs.length ? 'average lead time ' + avgLead.toFixed(1) + ' weeks' : 'no programs ran', runs.length ? grade(c => c(avgLead), [l => l >= 4 && l <= 6, l => l >= 3 && l <= 7, l => l >= 2, () => true]) : 'F'],
      ['Circulation', s.circulation.toLocaleString() + ' checkouts', grade(c => s.circulation >= c * YF * PF, [10000, 9000, 8000, 7000])],
    ];
    const gpa = grades.reduce((t, g) => t + GPA[g[2]], 0) / grades.length;
    const final = gpa >= 3.5 ? 'A' : gpa >= 2.75 ? 'B' : gpa >= 2 ? 'C' : gpa >= 1.25 ? 'D' : 'F';
    const verdict = {
      A: 'The Board is delighted. Attendance is up, complaints are down, and three council members asked for your calendar. Next year\'s budget goes up.',
      B: 'A solid first year. The Board appreciated the variety and wants a little more polish on the details next year.',
      C: 'A mixed year. Some programs landed; others missed their audience or annoyed the regulars. The Board wants a plan for next year.',
      D: 'A rough year. The Board heard more complaints than compliments and is asking hard questions about the programming budget.',
      F: 'The Board is "concerned." There will be a meeting. It will be long.',
    }[final];

    // lessons from what actually happened
    const lessons = [];
    const short = runs.filter(e => (e.week - e.bookedWeek) <= 2), good = runs.filter(e => (e.week - e.bookedWeek) >= 4 && (e.week - e.bookedWeek) <= 6);
    const avg = (arr) => arr.length ? Math.round(arr.reduce((t, e) => t + e.result.attendance, 0) / arr.length) : 0;
    if (short.length && good.length) lessons.push('Programs with 2 weeks of notice or less averaged ' + avg(short) + ' attendees; programs marketed 4 to 6 weeks out averaged ' + avg(good) + '.');
    else if (short.length) lessons.push(short.length + ' program(s) had 2 weeks of notice or less. Earlier marketing reaches more people.');
    if (st.noiseWalkouts) lessons.push(st.noiseWalkouts + ' regulars walked out because of noise. Loud programs belong in the soundproof Program Room, or away from quiet rooms.');
    if (st.crowdWalkouts) lessons.push(st.crowdWalkouts + ' people left crowded rooms. Teens after 3:00 fill the Teen Zone fast: an after-school teen program in the Program Room relieves the pressure.');
    if (st.turnedAway) lessons.push(st.turnedAway + ' people were turned away from full programs. Match the room to the projected turnout.');
    if (st.wrongRooms) lessons.push(st.wrongRooms + ' program(s) ran in staff-only or utility spaces.');
    GD.DEMO_KEYS.filter(d => st.servedCount[d] < REACH).forEach(d => lessons.push(GD.DEMOGRAPHICS[d].label + ' got only ' + st.servedCount[d] + ' program(s) all year. Every audience notices when it\'s left out.'));
    if (offsite < 3) lessons.push('Only ' + offsite + ' program' + (offsite === 1 ? '' : 's') + ' went out into the community. A class visit or a park program reaches people who never come in.');
    if (used < 0.7) lessons.push(Game.money(s.budget) + ' went unspent. Unused programming money tends to disappear from next year\'s budget.');
    const best = runs.slice().sort((a, b) => (b.result.attendance * b.result.quality) - (a.result.attendance * a.result.quality))[0];
    if (best) lessons.push('Best program: ' + Programs.get(best.program).title + ' (Week ' + best.week + ', ' + best.result.attendance + ' attendees).');
    if (!lessons.length) lessons.push('A clean year. Try a harder challenge: a bigger town, fewer staff hours, or a smaller budget (js/data.js).');

    modal(img('1f3db') + ' Library Board Review: ' + C.yearName,
      '<div class="report"><div class="final grade-' + final + '"><span>' + final + '</span><p>' + verdict + '</p></div>' +
      '<table class="grades">' + grades.map(g => '<tr><th>' + g[0] + '</th><td>' + g[1] + '</td><td class="g grade-' + g[2] + '">' + g[2] + '</td></tr>').join('') + '</table>' +
      '<div class="wrap-stats"><div><b>' + s.visits.toLocaleString() + '</b><span>visits</span></div><div><b>' + st.programsRun + '</b><span>programs</span></div><div><b>' + st.attendance.toLocaleString() + '</b><span>attendees</span></div><div><b>' + s.cards + '</b><span>new cards</span></div><div><b>' + Game.money(s.revenue) + '</b><span>raised</span></div></div>' +
      '<h3>What the year taught</h3><ul class="tips">' + lessons.map(l => '<li>' + l + '</li>').join('') + '</ul></div>',
      [{ label: 'Plan another year', primary: true, action: () => Game.restart() }, { label: 'Look around', action: () => {} }], { wide: true });
  }

  // ---------------------------------------------------------------- credits
  function credits() {
    modal(img('2b50') + ' Credits',
      '<div class="help"><p><b>Beyond The Stacks</b>: design, writing and code by Joseph VanWagner.</p>' +
      '<p>The library was built in <b>Mapster</b>, the author\'s own level editor, and is drawn here straight from its map file.</p>' +
      '<h3>Art and type</h3><ul>' +
      '<li>Emoji art: <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener">Twemoji</a> &copy; Twitter, Inc. and other contributors, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.</li>' +
      '<li>Interface icons: <a href="https://tabler.io/icons" target="_blank" rel="noopener">Tabler Icons</a> &copy; Pawe&#322; Kuna, MIT License.</li>' +
      '<li>Floor and wall textures: <a href="https://ambientcg.com/view?id=WoodFloor051" target="_blank" rel="noopener">WoodFloor051</a>, <a href="https://ambientcg.com/view?id=Carpet007" target="_blank" rel="noopener">Carpet007</a>, <a href="https://ambientcg.com/view?id=Carpet016" target="_blank" rel="noopener">Carpet016</a>, <a href="https://ambientcg.com/view?id=Carpet012" target="_blank" rel="noopener">Carpet012</a>, <a href="https://ambientcg.com/view?id=Carpet006" target="_blank" rel="noopener">Carpet006</a>, <a href="https://ambientcg.com/view?id=Tiles036" target="_blank" rel="noopener">Tiles036</a>, <a href="https://ambientcg.com/view?id=Terrazzo005" target="_blank" rel="noopener">Terrazzo005</a>, <a href="https://ambientcg.com/view?id=Concrete036" target="_blank" rel="noopener">Concrete036</a>, <a href="https://ambientcg.com/view?id=Concrete034" target="_blank" rel="noopener">Concrete034</a>, <a href="https://ambientcg.com/view?id=Road012A" target="_blank" rel="noopener">Road012A</a>, <a href="https://ambientcg.com/view?id=Grass004" target="_blank" rel="noopener">Grass004</a>, <a href="https://ambientcg.com/view?id=Bricks101" target="_blank" rel="noopener">Bricks101</a>, <a href="https://ambientcg.com/view?id=Plaster001" target="_blank" rel="noopener">Plaster001</a> from <a href="https://ambientcg.com" target="_blank" rel="noopener">ambientCG</a> by Lennart Demes, <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0</a>.</li>' +
      '<li>Patron figures: <a href="https://kenney.nl/assets/mini-characters" target="_blank" rel="noopener">Mini Characters 1</a> by <a href="https://kenney.nl" target="_blank" rel="noopener">Kenney</a>, <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0</a>.</li>' +
      '<li>3D view: the Mapster engine (the author\'s own) and <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> r128, MIT License.</li>' +
      '<li>Fonts: Atkinson Hyperlegible (Braille Institute), Courier Prime (Alan Dague-Greene), both SIL Open Font License 1.1, and Special Elite (Astigmatic), Apache License 2.0.</li>' +
      '</ul><p class="small-print">Full license texts are in assets/CREDITS.txt.</p></div>');
  }

  // ---------------------------------------------------------------- title art: the library itself
  let titleView = null;
  function titleArt() {
    const c = $('title-art'); if (!c) return;
    titleView = titleView || FacilityView.create(c, () => Game.fac, () => null);
    titleView.floor = Game.fac.ground; titleView.overlays.labels = true; titleView.invalidate();
    const draw = (t) => { if (!$('title-screen').classList.contains('on')) return; titleView.render(t || 0); requestAnimationFrame(draw); };
    requestAnimationFrame(draw);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAsk); else initAsk();
  return { modal, ask, quarterReport, intro, help, settings, weekWrap, result, report, credits, titleArt, coach, hide };
})();
