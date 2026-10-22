/* JS/FEED.JS - The Community Pulse: the social posts that react to what happens in the
   library. Text comes from GameData.FEED; this file picks a template, fills it in, and
   adds it to the scrolling list (newest on top). Green = praise, red = complaint,
   blue = staff chat, grey = the week's numbers. */

window.Feed = (function () {
  let list = null, filter = 'all', unread = 0;
  const MAX = 150;
  const recent = {};   // template key -> last game-minute posted (keeps repeats down)

  function init(el) {
    list = el;
    document.querySelectorAll('[data-feed-filter]').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.feedFilter;
      document.querySelectorAll('[data-feed-filter]').forEach(x => x.classList.toggle('on', x === b));
      applyFilter();
    }));
  }
  function clear() { if (list) list.innerHTML = ''; Object.keys(recent).forEach(k => delete recent[k]); }

  function pickTemplate(key, demo) {
    const t = GameData.FEED[key];
    if (!t) return key;
    if (Array.isArray(t)) return t[Math.floor(Math.random() * t.length)];
    return t[demo] || Object.values(t)[0];
  }
  function fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null) ? vars[k] : m);
  }
  function author(demo) {
    const G = GameData;
    if (demo === 'teens') return { name: '@' + G.TEEN_HANDLES[Math.floor(Math.random() * G.TEEN_HANDLES.length)], platform: pick(G.PLATFORMS.teens) };
    const plats = G.PLATFORMS[demo] || G.PLATFORMS.adults;
    return { name: G.NAMES[Math.floor(Math.random() * G.NAMES.length)], platform: pick(plats) };
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // post: { key, demo, vars, gw } or { system:true, title, text } ; when: "Wk 3 Tue 2:15 PM"
  function add(post, when, opts) {
    if (!list) return;
    opts = opts || {};
    let text, name, platform, avatar, tone;
    if (post.system) {
      tone = 'system'; name = post.title; platform = ''; avatar = post.emoji || '1f4c5'; text = post.text;
    } else {
      text = fill(pickTemplate(post.key, post.demo), post.vars);
      const staff = /^#staff-chat:\s*/.test(text) || post.demo === 'staff';
      if (staff) {
        text = text.replace(/^#staff-chat:\s*/, ''); name = pick(['Dana (Circulation)', 'Mo (Teen Services)', 'Ruth (Reference)', 'Ari (Children\'s)', 'Kim (Outreach)']);
        platform = '#staff-chat'; avatar = '1f9d1-200d-1f4bc'; tone = 'staff';
      } else {
        const a = author(post.demo); name = a.name; platform = a.platform;
        avatar = (GameData.DEMOGRAPHICS[post.demo] || GameData.DEMOGRAPHICS.adults).emoji;
        tone = post.gw > 0 ? 'pos' : post.gw < 0 ? 'neg' : 'neutral';
      }
    }
    const el = document.createElement('article');
    el.className = 'post ' + tone + (opts.fresh === false ? '' : ' fresh');
    el.dataset.tone = tone;
    const demo = GameData.DEMOGRAPHICS[post.demo];
    const chip = (post.gw && !post.system) ? '<span class="gw-chip ' + (post.gw > 0 ? 'up' : 'down') + '">' + (post.gw > 0 ? '+' : '') + post.gw + ' Goodwill' + (demo ? ' · ' + demo.label : '') + '</span>' : '';
    el.innerHTML = '<img class="avatar" src="assets/emoji/' + avatar + '.svg" alt="">' +
      '<div class="post-body"><header><b>' + esc(name) + '</b>' + (platform ? '<span class="plat">' + esc(platform) + '</span>' : '') + '<time>' + esc(when || '') + '</time></header>' +
      '<p>' + esc(text) + '</p>' + chip + '</div>';
    list.prepend(el);
    while (list.children.length > MAX) list.lastChild.remove();
    applyFilterTo(el);
    setTimeout(() => el.classList.remove('fresh'), 1200);
    unread++;
    if (window.Sfx && !opts.silent) Sfx.play(tone === 'neg' ? 'bad' : tone === 'pos' ? 'good' : 'tick');
  }

  // Rate-limited post for things that happen a lot (noise walk-outs, crowding).
  function addThrottled(key, minute, gap, post, when) {
    if (recent[key] != null && minute - recent[key] < gap) return false;
    recent[key] = minute; add(post, when); return true;
  }

  function applyFilterTo(el) {
    const t = el.dataset.tone;
    const show = filter === 'all' || (filter === 'pos' && t === 'pos') || (filter === 'neg' && t === 'neg') || (filter === 'staff' && (t === 'staff' || t === 'system'));
    el.hidden = !show;
  }
  function applyFilter() { if (list) [...list.children].forEach(applyFilterTo); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  return { init, add, addThrottled, clear };
})();
