/* JS/WORKSHOP.JS - The Card Workshop: a full-screen editor for program cards.

   Make new cards from scratch, duplicate a built-in card to make your own version, edit or
   delete your cards, hide cards you don't use from the deck, and export/import your cards
   as a .json file (to back them up or share them). Your cards are saved in this browser
   (Programs keeps them in localStorage) and inside your saved game.

   While you edit, the right-hand side shows the card as it'll look in the deck, the rooms
   in this library it suits best, and how many people it would draw at each time slot. */

window.Workshop = (function () {
  const GD = GameData;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const img = (code, cls) => '<img src="assets/emoji/' + code + '.svg" alt=""' + (cls ? ' class="' + cls + '"' : '') + '>';
  let sel = null, draft = null, dirty = false, filter = 'all', query = '', held = false, built = false;

  // icons you can pick for a card (all in assets/emoji/)
  const EMOJI = ['1f4da', '1f4d6', '1f4d5', '1f4d3', '1f4dd', '270f', '1f58d', '1f3a8', '1f58c', '1f4d0', '1f393', '1f9e0', '1f4a1', '1f50d', '1f5fa', '1f30d', '1f4f0', '1f4dc', '1f9fe', '1f4c8', '1f4ca',
    '1f4bb', '1f5a5', '1f4f1', '1f3ae', '1f579', '1f916', '1f4f7', '1f3a5', '1f3ac', '1f4fa', '1f399', '1f3a4', '1f3a7', '1f9ea', '1f52c', '1f52d', '1f680', '1f9ec', '2697',
    '1f3b5', '1f3b6', '1f3b8', '1f3b9', '1f3bb', '1f941', '1f3ad', '1f483', '1f9f6', '1f9f5', '2702', '1f9e9', '1f3b2', '265f', '1f0cf', '1f3af',
    '2615', '1f375', '1f9c3', '1f36a', '1f382', '1f9c1', '1f355', '1f34e', '1f96a', '1f373', '1f37f',
    '1f331', '1f333', '1f337', '1f33b', '1f344', '1f41d', '1f98b', '1f426', '1f43e', '1f415', '1f408', '1f422', '2600', '1f319', '2b50', '1f308', '2744', '1f342', '1f30a', '1f3d5',
    '1f383', '1f47b', '1f983', '1f384', '1f381', '1f389', '1f38a', '1f388', '1f54e', '1fa94',
    '1f475', '1f474', '1f9d1', '1f476', '1f467', '1f466', '1f46a', '1f91d', '1f4ac', '1f5e3', '1f9d8', '1f3c3', '1f6b2', '26bd', '1f3c0', '1f3c6', '1f396', '1f9f8', '1f9f1', '1fa81',
    '1f3db', '1f5f3', '1f4b0', '1f4b5', '1f4b8', '2696', '1fa7a', '1f48a', '1f3e0', '1f68c', '2708', '1f4ee', '1f4e6', '1f527', '1f528', '1f9f0', '1f526', '1f4c5', '1f3f7', '1faaa', '1f9ed',
    '2694', '1f6e1', '1f3f0', '1f409', '1f984', '1f9d9', '1f9db', '1f52e', '1f4ab', '1f6f8', '1f47d', '1f996', '1f995', '1f4e3', '1f9fa', '1f9ff'];
  // room qualities a card can like or dislike (the tags in GameData.ROOM_RULES)
  const TAGS = [['program', 'program space'], ['soundproof', 'soundproof'], ['quiet', 'quiet'], ['study', 'study'], ['small', 'small'], ['tech', 'computers'], ['kids', 'kids\' area'], ['teen', 'teen area'], ['loud', 'loud'], ['busy', 'high traffic'], ['outdoor', 'outdoors'], ['storage', 'storage'], ['staff', 'staff-only']];
  const LENGTHS = [30, 45, 60, 75, 90, 120, 150, 180, 240];
  const NOISE = ['silent', 'quiet', 'lively', 'loud'];

  function blank() {
    return { id: null, title: 'New Program', emoji: '1f4a1', target: 'adults', also: [], cost: 50, staff: 2, duration: 60, noise: 1, appeal: 1, ideal: ['program'], bad: ['loud'], circ: 0.5, recurring: false, walkIn: false, special: '', blurb: 'Describe it in a sentence or two.', custom: true };
  }
  // make any card (built-in, imported, half-filled) safe to use
  function normalize(c) {
    const b = blank(), n = Object.assign({}, b, c || {});
    const num = (v, lo, hi, d) => { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
    n.title = String(n.title || 'Untitled').slice(0, 48);
    n.blurb = String(n.blurb || '').slice(0, 200);
    if (!EMOJI.includes(n.emoji) && !GD.PROGRAMS.some(p => p.emoji === n.emoji)) n.emoji = b.emoji;
    if (!GD.DEMO_KEYS.includes(n.target)) n.target = 'adults';
    n.also = (Array.isArray(n.also) ? n.also : []).filter(d => GD.DEMO_KEYS.includes(d) && d !== n.target);
    n.cost = Math.round(num(n.cost, 0, 5000, 50)); n.staff = Math.round(num(n.staff, 1, 20, 2));
    n.duration = LENGTHS.includes(+n.duration) ? +n.duration : 60;
    n.noise = Math.round(num(n.noise, 0, 3, 1)); n.appeal = num(n.appeal, 0.5, 1.5, 1); n.circ = num(n.circ, 0, 2, 0.5);
    const tags = TAGS.map(t => t[0]);
    n.ideal = (n.ideal || []).filter(t => tags.includes(t)); n.bad = (n.bad || []).filter(t => tags.includes(t) && !n.ideal.includes(t));
    n.recurring = !!n.recurring; n.walkIn = !!n.walkIn;
    if (!['', 'sale', 'cards', 'tour', 'seasonal'].includes(n.special || '')) n.special = '';
    if (n.special === 'sale') n.revenuePerAttendee = num(n.revenuePerAttendee, 1, 50, 4);
    if (n.special === 'tour') n.maxGroup = Math.round(num(n.maxGroup, 4, 60, 14));
    // seasonal cards: best months (1..12; may wrap past December). Cards made before the year-long
    // calendar stored a range of Fall-quarter weeks: those become the months the weeks fell in.
    if (n.special === 'seasonal') {
      let m = Array.isArray(n.months) ? n.months : null;
      if (!m && Array.isArray(n.season)) m = n.season.map(w => GameData.monthOf(Math.round(num(w, 1, 52, 1)), 0));
      m = m || [1, 12];
      n.months = [Math.round(num(m[0], 1, 12, 1)), Math.round(num(m[1], 1, 12, 12))];
    }
    delete n.season;
    if (!n.special) delete n.special;
    return n;
  }

  // ---------------------------------------------------------------- open / close
  function build() {
    if (built) return; built = true;
    const el = document.createElement('section');
    el.id = 'workshop'; el.className = 'overlay ws'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Card Workshop');
    el.innerHTML = '<div class="ws-shell paper">' +
      '<header class="ws-head"><h2>' + img('1f9e9') + 'Card Workshop</h2><p>Design your own programs. Your cards join the deck and save in this browser.</p>' +
      '<div class="ws-actions"><button type="button" class="btn small primary" id="ws-new">' + Icons.svg('plus') + ' New card</button>' +
      '<button type="button" class="btn small" id="ws-import">' + Icons.svg('upload') + ' Import…</button>' +
      '<button type="button" class="btn small" id="ws-export">' + Icons.svg('download') + ' Export my cards</button>' +
      '<button type="button" class="tbtn close" id="ws-close" aria-label="Back to the library">' + Icons.svg('x') + '</button></div></header>' +
      '<div class="ws-body"><aside class="ws-list"><input type="search" id="ws-search" placeholder="Search cards" aria-label="Search cards">' +
      '<div class="seg" id="ws-filter"><button type="button" data-f="all" class="on">All</button><button type="button" data-f="mine">Mine</button><button type="button" data-f="builtin">Built-in</button><button type="button" data-f="hidden">Hidden</button></div>' +
      '<div id="ws-items" role="listbox"></div></aside>' +
      '<div class="ws-edit" id="ws-edit"></div><aside class="ws-preview" id="ws-preview"></aside></div></div>' +
      '<input type="file" id="ws-file" accept=".json,application/json" hidden>';
    document.body.appendChild(el);
    $('ws-close').addEventListener('click', close);
    $('ws-new').addEventListener('click', () => select(null, blank()));
    $('ws-import').addEventListener('click', () => $('ws-file').click());
    $('ws-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
    $('ws-export').addEventListener('click', exportCards);
    $('ws-search').addEventListener('input', e => { query = e.target.value.toLowerCase(); renderList(); });
    $('ws-filter').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; filter = b.dataset.f; $('ws-filter').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); renderList(); });
    $('ws-items').addEventListener('click', e => { const it = e.target.closest('[data-card]'); if (it) select(it.dataset.card); });
    $('ws-edit').addEventListener('input', onEdit);
    $('ws-edit').addEventListener('change', onEdit);
    $('ws-edit').addEventListener('click', onEditClick);
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  }
  function open(id) {
    build();
    if (Game.running && !held) { Game.hold(); held = true; }
    Menu.close();
    $('workshop').classList.add('on');
    if (id && Programs.exists(id)) select(id); else select(null, blank());
    setTimeout(() => { const t = $('ws-title'); if (t && !t.disabled) t.focus(); }, 30);
  }
  async function close() {
    if (dirty && !(await Screens.ask({ title: 'Close without saving?', text: 'Your changes to this card will be lost.', yes: 'Close', no: 'Keep editing', danger: true }))) return;
    dirty = false;
    $('workshop').classList.remove('on');
    if (held) { held = false; Game.release(); }
    if (window.Planner && Game.state) Planner.refresh();
  }
  function duplicate(id) {
    open(id);
    const src = Programs.get(id);
    select(null, normalize(Object.assign(JSON.parse(JSON.stringify(src)), { id: null, title: (src.title + ' (my version)').slice(0, 48), basedOn: src.id, custom: true, archived: false })));
    dirty = true;
  }
  function inUse(id) { return !!(Game.state && Game.state.events.some(e => e.program === id)); }
  async function remove(id) {
    const p = Programs.get(id); if (!p || !p.custom) return;
    const used = inUse(id);
    if (!(await Screens.ask({ title: 'Delete "' + p.title + '"?', text: used ? 'It\'s on the calendar, so those bookings stay; the card just leaves the deck.' : 'This card will be gone for good.', yes: 'Delete', no: 'Keep it', danger: true }))) return;
    Programs.deleteCard(id, used);
    if (Game.state) Game.save();
    Game.toast('Deleted "' + p.title + '".', 'info', p.emoji);
    if ($('workshop') && $('workshop').classList.contains('on')) { dirty = false; select(null, blank()); renderList(); }
    if (window.Planner && Game.state) Planner.refresh();
  }

  // ---------------------------------------------------------------- list
  function renderList() {
    const all = Programs.allCards();
    const items = all.filter(p => {
      if (filter === 'mine' && !p.custom) return false;
      if (filter === 'builtin' && p.custom) return false;
      if (filter === 'hidden' && !Programs.isHidden(p.id)) return false;
      return !query || (p.title + ' ' + (p.blurb || '') + ' ' + GD.DEMOGRAPHICS[p.target].label).toLowerCase().includes(query);
    });
    $('ws-items').innerHTML = items.map(p => '<button type="button" class="ws-item' + (sel === p.id ? ' on' : '') + '" data-card="' + p.id + '" role="option">' + img(p.emoji) +
      '<span><b>' + esc(p.title) + '</b><small><i class="dot" style="background:' + GD.DEMOGRAPHICS[p.target].color + '"></i>' + GD.DEMOGRAPHICS[p.target].label + '</small></span>' +
      (p.custom ? '<em class="mine">mine</em>' : '') + (Programs.isHidden(p.id) ? '<em>hidden</em>' : '') + '</button>').join('') || '<p class="small-print">No cards match.</p>';
  }

  // ---------------------------------------------------------------- editor
  async function select(id, fresh) {
    if (dirty && !(await Screens.ask({ title: 'Discard your changes?', text: 'You have unsaved changes to this card.', yes: 'Discard', no: 'Keep editing', danger: true }))) return;
    dirty = false;
    sel = id;
    draft = fresh ? normalize(fresh) : JSON.parse(JSON.stringify(Programs.get(id)));
    renderList(); renderEditor(); renderPreview();
  }
  function renderEditor() {
    const d = draft, ro = !d.custom;
    const dis = ro ? ' disabled' : '';
    const chips = (name, vals, multi) => GD.DEMO_KEYS.map(k => '<label class="chip-opt' + (vals.includes(k) ? ' on' : '') + (name === 'also' && k === d.target ? ' off' : '') + '"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + name + '" value="' + k + '"' + (vals.includes(k) ? ' checked' : '') + (name === 'also' && k === d.target ? ' disabled' : '') + dis + '>' + img(GD.DEMOGRAPHICS[k].emoji) + GD.DEMOGRAPHICS[k].label + '</label>').join('');
    const tagState = (t) => d.ideal.includes(t) ? 'good' : d.bad.includes(t) ? 'bad' : '';
    $('ws-edit').innerHTML =
      (ro ? '<div class="ws-banner">' + Icons.svg('cards') + '<span>A built-in card. You can <b>rename</b> it here; to change anything else, <b>duplicate it</b> into your own version.</span><button type="button" class="btn small primary" data-act="dup">Duplicate &amp; customize</button></div>' : '') +
      '<div class="ws-row"><label class="ws-field grow">Title' + (ro && Programs.originalTitle(d.id) !== d.title ? ' <small>(originally "' + esc(Programs.originalTitle(d.id)) + '")</small>' : '') + '<input id="ws-title" maxlength="48" value="' + esc(d.title) + '"></label>' +
      (ro ? '<div class="ws-field"><span>&nbsp;</span><span class="rename-btns"><button type="button" class="btn small" data-act="rename">Save name</button>' + (Programs.originalTitle(d.id) !== d.title ? '<button type="button" class="btn small" data-act="unrename">Reset</button>' : '') + '</span></div>' : '') +
      '<div class="ws-field">Icon<button type="button" class="ws-emoji-btn" data-act="emoji"' + dis + '>' + img(d.emoji) + '</button></div></div>' +
      '<div class="ws-emoji-grid" id="ws-emoji-grid" hidden>' + EMOJI.map(c => '<button type="button" data-emoji="' + c + '" class="' + (c === d.emoji ? 'on' : '') + '">' + img(c) + '</button>').join('') + '</div>' +
      '<label class="ws-field">Description<textarea id="ws-blurb" rows="2" maxlength="200"' + dis + '>' + esc(d.blurb) + '</textarea></label>' +
      '<div class="ws-field">Main audience<div class="chips">' + chips('target', [d.target], false) + '</div></div>' +
      '<div class="ws-field">Also draws<div class="chips">' + chips('also', d.also, true) + '</div></div>' +
      '<div class="ws-grid3">' +
      '<label class="ws-field">Cost ($)<input type="number" id="ws-cost" min="0" max="5000" step="5" value="' + d.cost + '"' + dis + '></label>' +
      '<label class="ws-field">Staff hours<input type="number" id="ws-staff" min="1" max="20" value="' + d.staff + '"' + dis + '></label>' +
      '<label class="ws-field">Length<select id="ws-duration"' + dis + '>' + LENGTHS.map(m => '<option value="' + m + '"' + (m === d.duration ? ' selected' : '') + '>' + (m < 60 ? m + ' min' : (m / 60) + (m === 60 ? ' hour' : ' hours')) + '</option>').join('') + '</select></label></div>' +
      '<div class="ws-grid3">' +
      '<label class="ws-field">Noise: <b id="ws-noise-l">' + NOISE[d.noise] + '</b><input type="range" id="ws-noise" min="0" max="3" step="1" value="' + d.noise + '"' + dis + '></label>' +
      '<label class="ws-field">Draw: <b id="ws-appeal-l">' + appealLabel(d.appeal) + '</b><input type="range" id="ws-appeal" min="0.5" max="1.5" step="0.05" value="' + d.appeal + '"' + dis + '></label>' +
      '<label class="ws-field">Checkouts per person: <b id="ws-circ-l">' + d.circ.toFixed(1) + '</b><input type="range" id="ws-circ" min="0" max="2" step="0.1" value="' + d.circ + '"' + dis + '></label></div>' +
      '<div class="ws-field">Rooms it suits <small>(click: suits it → works against it → doesn\'t matter)</small><div class="chips tags">' +
      TAGS.map(([t, l]) => '<button type="button" class="tag-opt ' + tagState(t) + '" data-tag="' + t + '"' + dis + '>' + (tagState(t) === 'good' ? '✓ ' : tagState(t) === 'bad' ? '✗ ' : '') + l + '</button>').join('') + '</div></div>' +
      '<div class="ws-row checks2"><label class="check"><input type="checkbox" id="ws-recurring"' + (d.recurring ? ' checked' : '') + dis + '><span><b>Works as a weekly regular</b><small>No turnout drop when it repeats every week.</small></span></label>' +
      '<label class="check"><input type="checkbox" id="ws-walkin"' + (d.walkIn ? ' checked' : '') + dis + '><span><b>Walk-ins welcome</b><small>People passing through its room may join in.</small></span></label></div>' +
      '<div class="ws-row"><label class="ws-field">Special<select id="ws-special"' + dis + '><option value="">Nothing special</option><option value="sale"' + (d.special === 'sale' ? ' selected' : '') + '>Fundraiser (raises money)</option><option value="cards"' + (d.special === 'cards' ? ' selected' : '') + '>Library card sign-ups</option><option value="tour"' + (d.special === 'tour' ? ' selected' : '') + '>Behind-the-scenes tour (staff areas OK)</option><option value="seasonal"' + (d.special === 'seasonal' ? ' selected' : '') + '>Seasonal (shines in certain weeks)</option></select></label>' +
      (d.special === 'sale' ? '<label class="ws-field">$ raised per person<input type="number" id="ws-rev" min="1" max="50" value="' + (d.revenuePerAttendee || 4) + '"' + dis + '></label>' : '') +
      (d.special === 'tour' ? '<label class="ws-field">Largest group<input type="number" id="ws-group" min="4" max="60" value="' + (d.maxGroup || 14) + '"' + dis + '></label>' : '') +
      (d.special === 'seasonal' ? ['Best from', 'through'].map((lbl, i) => '<label class="ws-field">' + lbl + '<select id="ws-s' + i + '"' + dis + '>' + GameData.MONTHS.map((mn, k) => '<option value="' + (k + 1) + '"' + ((d.months || [10, 10])[i] === k + 1 ? ' selected' : '') + '>' + mn + '</option>').join('') + '</select></label>').join('') : '') + '</div>' +
      '<div class="ws-foot">' +
      (ro ? '<button type="button" class="btn" data-act="hide">' + (Programs.isHidden(d.id) ? 'Show in deck' : 'Hide from deck') + '</button><span class="grow"></span><button type="button" class="btn primary" data-act="schedule"' + (Game.running ? '' : ' disabled') + '>Schedule it</button>' :
        (d.id ? '<button type="button" class="btn danger" data-act="delete">Delete</button><button type="button" class="btn" data-act="dup">Duplicate</button><button type="button" class="btn" data-act="hide">' + (Programs.isHidden(d.id) ? 'Show in deck' : 'Hide from deck') + '</button>' : '') +
        '<span class="grow"></span>' + (d.id ? '<button type="button" class="btn" data-act="schedule"' + (Game.running ? '' : ' disabled') + '>Schedule it</button>' : '') + '<button type="button" class="btn primary" data-act="save">' + (d.id ? 'Save card' : 'Add to deck') + '</button>') +
      '</div>';
  }
  function appealLabel(a) { return a < 0.75 ? 'niche interest' : a < 0.95 ? 'modest' : a < 1.15 ? 'solid' : a < 1.3 ? 'popular' : 'crowd-pleaser'; }

  function onEdit(e) {
    const d = draft, t = e.target, v = t.value;
    if (t.id === 'ws-title') { d.title = v; if (!d.custom) { renderPreview(); return; } }
    if (!d.custom) return;
    if (t.id === 'ws-blurb') d.blurb = v;
    if (t.name === 'target') { d.target = v; d.also = d.also.filter(x => x !== v); if (e.type === 'change') renderEditor(); }
    if (t.name === 'also') { d.also = [...$('ws-edit').querySelectorAll('input[name=also]:checked')].map(x => x.value); }
    if (t.id === 'ws-cost') d.cost = +v; if (t.id === 'ws-staff') d.staff = +v; if (t.id === 'ws-duration') d.duration = +v;
    if (t.id === 'ws-noise') { d.noise = +v; $('ws-noise-l').textContent = NOISE[d.noise]; }
    if (t.id === 'ws-appeal') { d.appeal = +v; $('ws-appeal-l').textContent = appealLabel(d.appeal); }
    if (t.id === 'ws-circ') { d.circ = +v; $('ws-circ-l').textContent = d.circ.toFixed(1); }
    if (t.id === 'ws-recurring') d.recurring = t.checked;
    if (t.id === 'ws-walkin') d.walkIn = t.checked;
    if (t.id === 'ws-special') { d.special = v; if (e.type === 'change') renderEditor(); }
    if (t.id === 'ws-rev') d.revenuePerAttendee = +v;
    if (t.id === 'ws-group') d.maxGroup = +v;
    if (t.id === 'ws-s0' || t.id === 'ws-s1') d.months = [+($('ws-s0').value), +($('ws-s1').value)];
    dirty = true;
    renderPreview();
  }
  function onEditClick(e) {
    const d = draft;
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'emoji') { const g = $('ws-emoji-grid'); g.hidden = !g.hidden; return; }
      if (a === 'dup') { duplicate(d.id); return; }
      if (a === 'hide') { Programs.setHidden(d.id, !Programs.isHidden(d.id)); renderEditor(); renderList(); return; }
      if (a === 'delete') { remove(d.id); return; }
      if (a === 'save') { save(); return; }
      if (a === 'rename' || a === 'unrename') {
        Programs.rename(d.id, a === 'rename' ? $('ws-title').value : '');
        draft = JSON.parse(JSON.stringify(Programs.get(d.id)));
        if (Game.state) Game.save();
        renderList(); renderEditor(); renderPreview();
        Game.toast(a === 'rename' ? 'Renamed to "' + draft.title + '".' : 'Name reset to "' + draft.title + '".', 'good', draft.emoji);
        return;
      }
      if (a === 'schedule') { if (dirty && !save()) return; const id = d.id; close(); Planner.startPlacing({ pid: id }); return; }
    }
    const em = e.target.closest('[data-emoji]');
    if (em && d.custom) { d.emoji = em.dataset.emoji; dirty = true; renderEditor(); renderPreview(); return; }
    const tag = e.target.closest('[data-tag]');
    if (tag && d.custom) {
      const t = tag.dataset.tag;
      if (d.ideal.includes(t)) { d.ideal = d.ideal.filter(x => x !== t); d.bad.push(t); }
      else if (d.bad.includes(t)) d.bad = d.bad.filter(x => x !== t);
      else d.ideal.push(t);
      dirty = true; renderEditor(); renderPreview();
    }
  }
  function save() {
    const d = normalize(draft);
    if (!d.title.trim()) { Game.toast('Give the card a title.', 'bad'); return false; }
    const saved = Programs.saveCard(d);
    dirty = false; sel = saved.id; draft = JSON.parse(JSON.stringify(saved));
    if (Game.state) Game.save();
    renderList(); renderEditor(); renderPreview();
    Game.toast('"' + saved.title + '" is in your deck.', 'good', saved.emoji);
    Sfx.play('drop');
    return true;
  }

  // ---------------------------------------------------------------- preview: the card, its best rooms, its turnout
  function renderPreview() {
    const d = normalize(draft), D = GD.DEMOGRAPHICS[d.target];
    const card = '<div class="card preview' + (d.custom ? ' custom' : '') + '"><div class="card-top">' + img(d.emoji, 'card-emoji') + '<span class="aud" style="--c:' + D.color + '">' + img(D.emoji) + D.label + '</span></div>' +
      '<strong>' + esc(d.title) + '</strong><div class="card-meta"><span>' + Game.money(d.cost) + '</span><span>' + d.staff + ' staff h</span><span>' + d.duration + ' min</span></div>' +
      '<div class="noise-pips">' + [1, 2, 3].map(i => '<i class="' + (i <= d.noise ? 'on' : '') + '"></i>').join('') + '<span>' + NOISE[d.noise] + '</span></div></div>';
    let rooms = '', turnout = '';
    if (Game.fac) {
      const fits = Object.values(Game.fac.rooms).filter(r => !r.tags.includes('transit')).map(r => ({ r, f: Programs.roomFit(d, r) })).sort((a, b) => b.f.fit - a.f.fit);
      rooms = '<h4>Best rooms here</h4><ul class="ws-rooms">' + fits.slice(0, 4).map(({ r, f }) => '<li><span class="sw" style="background:' + r.color + '"></span>' + r.name + '<em class="t-' + f.tone + '">' + { good: 'great', ok: 'OK', bad: 'poor' }[f.tone] + '</em></li>').join('') + '</ul>';
      const best = fits[0] && fits[0].r;
      const state = Game.state || { goodwill: GD.START.goodwill, events: [] };
      const rows = GD.SLOTS.map(sl => {
        const ev = { _card: d, program: d.id || '_draft', week: 6, day: 1, slot: sl.id, room: best ? best.id : null, scope: 5, marketing: 1, addons: {}, bookedWeek: 1 };
        const pr = Programs.project(ev, state, best);
        return '<tr><td>' + sl.label + '</td><td><span class="mini-bar"><i style="width:' + Math.min(100, pr.total / 60 * 100) + '%;background:' + D.color + '"></i></span></td><td>' + pr.low + '–' + pr.high + '</td></tr>';
      }).join('');
      turnout = '<h4>Expected turnout</h4><table class="ws-turnout">' + rows + '</table><p class="small-print">A weekday 5 weeks out, flyers, balanced scope, in the best room, at today\'s goodwill.</p>';
    }
    const value = d.cost > 0 ? (d.appeal * 40) / d.cost : 99;
    const note = d.cost >= 300 && d.appeal < 1 ? 'Pricey for its draw.' : value > 1.5 && d.appeal >= 1.2 ? 'A bargain crowd-pleaser.' : '';
    $('ws-preview').innerHTML = '<h4>In the deck</h4>' + card + (note ? '<p class="small-print">' + note + '</p>' : '') + rooms + turnout;
  }

  // ---------------------------------------------------------------- import / export
  function exportCards() {
    const cards = Programs.customCards().filter(c => !c.archived);
    if (!cards.length) { Game.toast('You haven\'t made any cards yet.', 'info'); return; }
    const blob = new Blob([JSON.stringify({ game: 'Beyond The Stacks', kind: 'program-cards', version: 1, cards }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'beyond-the-stacks-cards.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    Game.toast('Exported ' + cards.length + ' card' + (cards.length === 1 ? '' : 's') + '.', 'good');
  }
  function importFile(file) {
    file.text().then(t => {
      const data = JSON.parse(t);
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.cards) ? data.cards : null);
      if (!list) throw new Error('No cards in that file.');
      let n = 0;
      list.forEach(c => {
        const card = normalize(Object.assign({}, c, { custom: true, archived: false }));
        if (!card.id || GD.PROGRAMS.some(p => p.id === card.id) || !String(card.id).startsWith('c_')) card.id = null;
        Programs.saveCard(card); n++;
      });
      if (Game.state) Game.save();
      renderList();
      Game.toast('Imported ' + n + ' card' + (n === 1 ? '' : 's') + '.', 'good');
    }).catch(err => Game.toast('Couldn\'t import: ' + err.message, 'bad'));
  }

  // quick rename (from right-click menus)
  function renameCard(id) {
    const p = Programs.get(id); if (!p) return;
    const orig = Programs.originalTitle(id);
    const body = Screens.modal(img(p.emoji) + ' Rename card',
      '<label class="ws-field">New name<input id="rn-input" maxlength="48" value="' + esc(p.title) + '"></label>' +
      (orig && orig !== p.title ? '<p class="small-print">Originally "' + esc(orig) + '". Leave it empty to reset.</p>' : '<p class="small-print">Renames it everywhere: the deck, the calendar and the feed.</p>'),
      [{ label: 'Cancel' }, { label: 'Rename', primary: true, action: () => {
        Programs.rename(id, document.getElementById('rn-input').value);
        if (Game.state) { Game.save(); Planner.refresh(); }
        Game.toast('Renamed to "' + Programs.get(id).title + '".', 'good', p.emoji);
      } }]);
    const inp = body.querySelector('#rn-input');
    setTimeout(() => { inp.focus(); inp.select(); }, 40);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.querySelector('#modal-foot .primary').click(); } });
  }

  return { open, close, duplicate, remove, normalize, renameCard };
})();
