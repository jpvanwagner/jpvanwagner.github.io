'use strict';
/* ============================== BADGE SETS ==============================
   Each kind of property is its own little game with its own set of badges: the ones that only happen there, plus
   the everywhere ones (doodles, citations, photos, the bag, gray areas, the handbook, Snake). Earning a property's
   whole set earns its Keys badge (Keys to Unit 204, and so on), and all four Keys earns Platinum. Each of those
   comes with a share card, the same share row as the end-of-shift report: a 1080x1080 image with every badge in
   the set, and a post ready for each site. The trophy case lists every set's progress, with Share on finished ones. */
const BADGE_COMMON = ['margin', 'bythebook', 'shutterbug', 'packrat', 'gray', 'finprint', 'snake'];
const BADGE_SETS = {
  residential: ['birder', 'bigfoot', 'liger', 'dude', 'tiefling', 'lightsout', 'calendar', 'takeout', 'phonepro', 'clipboard', 'safety', 'chemist', ...BADGE_COMMON],
  office: ['stapler', 'corner', 'chemist', ...BADGE_COMMON],
  industrial: ['triedit', 'cleanbill', 'suitedup', ...BADGE_COMMON],
  construction: ['stopwork', 'toppedout', 'suitedup', ...BADGE_COMMON]
};
/* the completion badges themselves (added to the case after the rest) */
ACHIEVEMENTS.push(
  { id: 'keys_residential', site: 'residential', set: true, name: 'Keys to Unit 204', desc: 'Earned every badge at Unit 204.', hint: 'Every badge the apartment has to give.', col: '#c9a227', em: ['.###...', '#...#..', '#...#..', '.####..', '...#...', '...##..', '...#...'] },
  { id: 'keys_office', site: 'office', set: true, name: 'Keys to Suite 204', desc: 'Earned every badge at Suite 204.', hint: 'Every badge the office suite has to give.', col: '#4a6a9a', em: ['.###...', '#...#..', '#...#..', '.####..', '...#...', '...##..', '...#...'] },
  { id: 'keys_industrial', site: 'industrial', set: true, name: 'Keys to Lot 204', desc: 'Earned every badge at Lot 204.', hint: 'Every badge the warehouse has to give.', col: '#5a6a7a', em: ['.###...', '#...#..', '#...#..', '.####..', '...#...', '...##..', '...#...'] },
  { id: 'keys_construction', site: 'construction', set: true, name: 'Keys to Site 204', desc: 'Earned every badge at Site 204.', hint: 'Every badge the jobsite has to give.', col: '#d8862a', em: ['.###...', '#...#..', '#...#..', '.####..', '...#...', '...##..', '...#...'] },
  { id: 'platinum', set: true, name: 'Platinum Inspector', desc: 'Earned every badge at every property.', hint: 'All four sets of keys.', col: '#b8c8d4', em: ['#.#.#.#', '#######', '.#####.', '..###..', '.#####.', '#######', '.......'] }
);
for (const a of ACHIEVEMENTS.slice(-5)) ACH[a.id] = a;

const BadgeSets = {
  /* how far along a set is: [earned, total] */
  progress(site) { const set = BADGE_SETS[site]; return [set.filter(id => Achievements.has(id)).length, set.length]; },
  done(site) { const [n, t] = this.progress(site); return n === t; },
  /* after any badge: finish whatever set it completed (and Platinum), and offer to share it */
  check() {
    for (const site of Object.keys(BADGE_SETS)) if (this.done(site) && !Achievements.has('keys_' + site) && Achievements.unlock('keys_' + site)) this.offer('keys_' + site);
    if (Object.keys(BADGE_SETS).every(s => Achievements.has('keys_' + s)) && Achievements.unlock('platinum')) this.offer('platinum');
  },
  offer(id) { clearTimeout(this._t); this._t = setTimeout(() => this.open(id), 1800); },   // after the badge's own card has had its moment
  /* the post */
  text(id) {
    if (id === 'platinum') return `I earned every badge at all four properties: Unit 204, Suite 204, Lot 204, and Site 204. Platinum Inspector!`;
    const site = id.replace('keys_', ''), st = SITES[site], [n] = this.progress(site);
    return `I earned all ${n} badges at ${st.place} 204 (${st.kind}). ${ACH[id].name}!`;
  },
  members(id) { return id === 'platinum' ? Object.keys(BADGE_SETS).map(s => 'keys_' + s) : BADGE_SETS[id.replace('keys_', '')]; },
  /* the 1080x1080 card: the big medal, the title, and every badge in the set, pinned to the clipboard */
  card(id) {
    const W = 1080, H = 1080, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), a = ACH[id], plat = id === 'platinum';
    const sk = s => s + "px 'Silkscreen', 'Courier New', monospace", px = s => s + "px 'Jersey 15', 'Trebuchet MS', sans-serif";
    g.fillStyle = plat ? '#1e2430' : '#2b2440'; g.fillRect(0, 0, W, H); g.fillStyle = plat ? '#283042' : '#332a4c'; for (let y = 0; y < H; y += 24) g.fillRect(0, y, W, 12);
    g.fillStyle = '#0d0b13'; g.fillRect(90, 70, 900, 960);
    const wood = g.createLinearGradient(100, 80, 980, 1020); wood.addColorStop(0, plat ? '#c8d4dc' : '#b07a42'); wood.addColorStop(1, plat ? '#8a9aa8' : '#8a5a2c');
    g.fillStyle = wood; g.fillRect(100, 80, 880, 940); g.fillStyle = '#fffdf4'; g.fillRect(140, 150, 800, 840);
    g.fillStyle = '#0d0b13'; g.fillRect(400, 52, 280, 92); g.fillStyle = '#c9ccd4'; g.fillRect(408, 60, 264, 76); g.fillStyle = '#eef0f4'; g.fillRect(408, 60, 264, 10);
    g.imageSmoothingEnabled = false; g.drawImage(Achievements.medal(a), 180, 190, 192, 192);
    g.textAlign = 'left'; g.fillStyle = '#8a3d00'; g.font = sk(22); g.fillText('BRICKROAD PROPERTY MGMT.', 400, 220);
    g.fillStyle = '#2a2133'; g.font = sk(a.name.length > 16 ? 40 : 48); g.fillText(a.name.toUpperCase(), 400, 290);
    g.font = px(32); g.fillStyle = '#4a3f5a'; g.fillText(a.desc, 400, 336); g.fillText(GAME_DATE, 400, 372);
    g.fillStyle = '#2a2133'; g.fillRect(180, 410, 720, 5);
    const list = this.members(id), cols = plat ? 2 : 3, cw = 720 / cols, rh = plat ? 130 : list.length > 12 ? 74 : 92, ms = plat ? 96 : list.length > 12 ? 56 : 64;
    list.forEach((m, i) => { const b = ACH[m], x = 180 + (i % cols) * cw, y = 440 + Math.floor(i / cols) * rh;
      g.drawImage(Achievements.medal(b, 40, !Achievements.has(m)), x, y, ms, ms);
      g.fillStyle = '#2a2133'; g.font = px(plat ? 30 : 26); let nm = b.name; const room = cw - ms - 18;   // trim long names to fit the column
      while (g.measureText(nm).width > room && nm.length > 4) nm = nm.slice(0, -2).trimEnd() + '…';
      g.fillText(nm, x + ms + 8, y + ms / 2 + 9); });
    let link = shareLink().replace(/^https?:\/\//, '').replace(/\/$/, ''); if (link.length > 44) link = link.slice(0, 43) + '…';
    g.textAlign = 'center'; g.fillStyle = '#e9dcff'; g.font = sk(18); g.fillText(link, W / 2, 1052);
    g.font = sk(16); g.fillStyle = '#c9b8ec'; g.fillText(copyrightYears() + ' Joe VanWagner', W / 2, 32);
    return c;
  },
  blob(id) {
    const ready = document.fonts && document.fonts.load ? Promise.all([document.fonts.load("40px 'Silkscreen'"), document.fonts.load("40px 'Jersey 15'")]).catch(() => {}) : Promise.resolve();
    return ready.then(() => new Promise((ok, fail) => this.card(id).toBlob(b => b ? ok(b) : fail(new Error('no image')), 'image/png')));
  },
  save(id) { this.blob(id).then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `unit-204-${id.replace('_', '-')}.png`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, () => {}); },
  /* the share screen: the card, the post, and the same row of share buttons as the end-of-shift report */
  open(id) {
    let s = $('badgeShare');
    if (!s) {
      s = document.createElement('section'); s.id = 'badgeShare'; s.className = 'overlay dim';
      s.innerHTML = `<div class="panel badge-share"><div class="win-bar"><span>Badge set complete</span><button class="win-x" type="button" aria-label="Close" data-tip="Close|Back to what you were doing. (Esc)">&times;</button></div>
        <div class="badge-share-body scroll"><img class="badge-card" id="badgeCard" alt=""><p class="share-text" id="badgeText"></p><div class="share-links" id="badgeLinks"></div>
        <div class="btn-row"><button class="btn small" type="button" id="badgeSave" data-tip="Save image|Download the 1080x1080 card.">Save image</button><button class="btn small primary" type="button" id="badgeDone">Done</button></div></div></div>`;
      $('game').append(s);
      s.querySelector('.win-x').addEventListener('click', () => UI.close('badgeShare')); $('badgeDone').addEventListener('click', () => UI.close('badgeShare'));
      s.addEventListener('mousedown', e => { if (e.target === s) UI.close('badgeShare'); });
    }
    const text = this.text(id), full = text + ' ' + shareLink(), phone = document.body.classList.contains('touch') && !!navigator.share;
    $('badgeCard').src = this.card(id).toDataURL(); $('badgeCard').alt = ACH[id].name; $('badgeText').textContent = full;
    const row = $('badgeLinks'); row.replaceChildren();
    const flash = (el, msg) => { const label = el.dataset.label || (el.dataset.label = el.textContent); el.textContent = msg; clearTimeout(el.ft); el.ft = setTimeout(() => { el.textContent = label; }, 2400); };
    for (const t of shareTargets(null, phone, text, `${ACH[id].name}: ${GAME_NAME}`)) {
      const a = document.createElement('a'); a.href = t.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = t.label;
      if (t.copy) a.addEventListener('click', () => { copyText(full); flash(a, 'TEXT COPIED - PASTE IT IN'); });
      row.append(a);
    }
    const insta = document.createElement('button'); insta.type = 'button'; insta.textContent = 'Instagram';
    insta.addEventListener('click', () => { copyText(full); let files = false; try { files = !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })); } catch (e) { /* no file sharing */ }
      if (files) this.blob(id).then(b => navigator.share({ files: [new File([b], 'unit-204-badges.png', { type: 'image/png' })], text: full })).catch(() => { this.save(id); flash(insta, 'IMAGE SAVED + TEXT COPIED'); });
      else { window.open('https://www.instagram.com/', '_blank', 'noopener'); this.save(id); flash(insta, 'IMAGE SAVED + TEXT COPIED'); } });
    row.insertBefore(insta, row.children[5] || null);
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'COPY TEXT';
    copy.addEventListener('click', async () => flash(copy, (await copyText(full)) ? 'COPIED!' : "COULDN'T COPY")); row.append(copy);
    $('badgeSave').onclick = () => this.save(id);
    s.querySelector('.win-bar span').textContent = id === 'platinum' ? 'Platinum!' : `${SITES[id.replace('keys_', '')].place} 204: every badge`;
    UI.open('badgeShare'); Audio2.sfx('chime');
  },
  /* the trophy case's summary: each property's progress, with Share on the finished ones */
  summary() {
    const box = document.createElement('div'); box.className = 'badge-sets';
    for (const id of [...Object.keys(BADGE_SETS).map(s => 'keys_' + s), 'platinum']) {
      const row = document.createElement('div'); row.className = 'badge-set' + (Achievements.has(id) ? ' done' : '');
      const [n, t] = id === 'platinum' ? [Object.keys(BADGE_SETS).filter(s => Achievements.has('keys_' + s)).length, 4] : this.progress(id.replace('keys_', ''));
      const lab = document.createElement('span'); lab.textContent = id === 'platinum' ? `Platinum ${n}/${t}` : `${SITES[id.replace('keys_', '')].place} 204 ${n}/${t}`; row.append(lab);
      if (Achievements.has(id)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = 'Share'; b.dataset.tip = 'Share|Post the finished set, with its card.'; b.addEventListener('click', () => this.open(id)); row.append(b); }
      box.append(row);
    }
    return box;
  }
};
/* every new badge might finish a set */
{ const unlock = Achievements.unlock.bind(Achievements);
  Achievements.unlock = (id, extra) => { const got = unlock(id, extra); if (got && !(ACH[id] && ACH[id].set)) BadgeSets.check(); return got; }; }
