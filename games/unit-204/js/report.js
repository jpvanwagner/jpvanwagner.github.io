'use strict';
/* ============================== SCORING & REPORT ==============================
   Per feature: +100 for the right condition, +25 if you found real evidence (a key clue), +25 for a photo
   on damage/hazard findings you got right. Missing a hazard costs 50. Charging a tenant for wear (or for
   something clean) counts as a wrongful charge. */
const PTS = { correct: 100, evidence: 25, photo: 25, missedHazard: -50 };
function gradeFor(pct) {
  if (pct >= 1) return ['A+', 'Flawless. They\'re naming a clipboard after you.'];
  if (pct >= .9) return ['A', 'Senior Inspector material.'];
  if (pct >= .8) return ['B', 'Solid inspector. A few things slipped past.'];
  if (pct >= .65) return ['C', 'Passable, but the SOP manual misses you.'];
  if (pct >= .5) return ['D', 'Back to orientation for a refresher.'];
  return ['F', 'Please hand in your clipboard.'];
}
const Report = {
  compute() {
    const rows = [];
    let score = 0, max = 0, correct = 0, hazards = 0, hazTotal = 0, charged = 0, chargeable = 0, wrongful = 0, evidence = 0;
    for (const f of FEATURES) {
      const v = f.variants[Game.cond[f.id]], m = Game.marks[f.id], photo = !!Game.photos[f.id];
      const clueSet = Game.clues[f.id] || new Set(), ev = v.key.some(k => clueSet.has(k));
      const ok = !!m && m.cat === v.cat;
      let pts = 0;
      max += PTS.correct + PTS.evidence + (v.cat >= 2 ? PTS.photo : 0);
      if (ok) { pts += PTS.correct; correct++; if (ev) pts += PTS.evidence; if (v.cat >= 2 && photo) pts += PTS.photo; }
      if (ev) evidence++;
      if (v.cat === 3) { hazTotal++; if (ok) hazards++; else pts += PTS.missedHazard; }
      if (v.cat === 2) { chargeable += v.cost; if (ok && photo) charged += v.cost; }
      if (m && m.cat === 2 && v.cat < 2) wrongful++;
      score += pts;
      rows.push({ f, v, m, ok, pts, photo, ev });
    }
    score = Math.max(0, score);
    const [grade, rank] = gradeFor(score / max);
    return { rows, score, max, correct, total: FEATURES.length, hazards, hazTotal, charged, chargeable, wrongful, evidence, photos: Game.shots, time: Game.elapsed(), grade, rank };
  },
  confirmSubmit() {
    const left = FEATURES.length - Object.keys(Game.marks).length;
    UI.closeAll();
    if (left) UI.confirm(`You still have ${left} unmarked ${left === 1 ? 'feature' : 'features'}. Unmarked items count as missed. Submit the report anyway?`, 'Submit', () => this.show(), 'Keep inspecting');
    else UI.confirm('All 14 features are on the form. Submit your move-out report and end the shift?', 'Submit', () => this.show(), 'Not yet');
  },
  show() {
    const r = this.compute(); Game.last = r; Game.mode = 'end';
    Audio2.walking(false); Audio2.music(false);
    $('game').classList.remove('playing');
    $('endDate').textContent = 'Inspected ' + GAME_DATE + ' · ' + r.time;
    $('endStamp').textContent = r.grade; $('endRank').innerHTML = '<b>' + r.rank + '</b>';
    $('endScore').textContent = r.score.toLocaleString(); $('endOf').textContent = 'of ' + r.max.toLocaleString();
    const stats = [['Correct calls', `${r.correct}/${r.total}`], ['Hazards caught', `${r.hazards}/${r.hazTotal}`], ['Deposit charged', `$${r.charged} of $${r.chargeable}`], ['Wrongful charges', r.wrongful],
      ['Evidence found', `${r.evidence}/${r.total}`], ['Photos taken', r.photos], ['Shift time', r.time], ['Actions', Game.actions]];
    $('endStats').replaceChildren(...stats.map(([k, v]) => { const d = document.createElement('div'); const a = document.createElement('span'); a.textContent = k; const b = document.createElement('b'); b.textContent = v; d.append(a, b); return d; }));
    const items = $('endItems'); items.replaceChildren();
    for (const row of r.rows) {
      const d = document.createElement('div'); d.className = 'item-row';
      const ok = document.createElement('span'); ok.className = 'ok ' + (row.m ? (row.ok ? 'y' : 'n') : 'm'); ok.textContent = row.m ? (row.ok ? '✔' : '✘') : '–';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = row.f.name + ' '; const sm = document.createElement('small'); sm.textContent = ROOMS[row.f.room].name; nm.append(sm);
      const pts = document.createElement('span'); pts.className = 'pts'; pts.textContent = (row.pts > 0 ? '+' : '') + row.pts;
      const calls = document.createElement('span'); calls.className = 'calls';
      const yours = document.createElement('span'); yours.className = 'cat-pill c' + (row.m ? row.m.cat : 0); if (!row.m) { yours.style.background = '#d8cfb2'; } yours.textContent = 'You: ' + (row.m ? CATS[row.m.cat].short : 'not marked');
      const right = document.createElement('span'); right.className = 'cat-pill c' + row.v.cat; right.textContent = 'Actual: ' + CATS[row.v.cat].short; right.style.marginLeft = '.4em';
      calls.append(yours, right);
      if (row.v.cat >= 2) { const ph = document.createElement('span'); ph.textContent = row.photo ? '  \u{1F4F7} photo' : '  no photo'; ph.style.color = row.photo ? '#3c9a2f' : '#c0270f'; calls.append(ph); }
      const why = document.createElement('span'); why.className = 'why'; why.textContent = row.v.why;
      d.append(ok, nm, pts, calls, why); items.append(d);
    }
    const strip = $('endPhotos'); strip.replaceChildren();
    Object.entries(Game.photos).slice(0, 6).forEach(([fid, url], i) => {
      const fig = document.createElement('figure'); fig.style.setProperty('--r', (i % 2 ? 2.5 : -2) + 'deg');
      const img = new Image(); img.src = url; img.alt = 'Photo of the ' + FEATURE[fid].name;
      const cap = document.createElement('figcaption'); cap.textContent = FEATURE[fid].name;
      fig.append(img, cap); strip.append(fig);
    });
    setupShare(r); $('feedback').classList.remove('on');
    UI.closeAll(); UI.open('endScreen'); $('endScreen').querySelector('.panel').scrollTop = 0;
    setTimeout(() => Audio2.synth('stamp'), 420);
    store('unit204-best', Math.max(store('unit204-best') || 0, r.score));
  }
};
