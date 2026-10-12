'use strict';
/* ============================== PROGRESS ==============================
   What the game remembers between shifts, per kind of property: your best score there, that you've filed a report
   there (for Property Tourist), the badges you earned there, and (at the apartment) the takeout numbers saved in
   Dana's phone. Settings has buttons to wipe one property's progress or all of it; your settings and the tutorial
   tips are left alone either way. */
const Progress = {
  bestKey: site => 'unit204-best-' + site,
  /* a new best score for the property you're at */
  best(score) {
    const k = this.bestKey(Sites.cur), old = store(k) ?? (Sites.cur === 'residential' ? store('unit204-best') : 0) ?? 0;
    store(k, Math.max(old || 0, score));
  },
  /* forget one property (site id), or every property (no argument) */
  reset(site) {
    const ids = site ? [site] : Sites.order;
    for (const id of ids) { try { localStorage.removeItem(this.bestKey(id)); } catch (e) {} }
    if (!site || site === 'residential') { try { localStorage.removeItem('unit204-best'); localStorage.removeItem('unit204-takeout'); } catch (e) {} }
    const done = site ? (store('unit204-sites') || []).filter(s => s !== site) : [];
    store('unit204-sites', done);
    Achievements.forget(site);
    // a set that's no longer whole loses its Keys, and Platinum goes with any of them (js/badge-sets.js)
    if (typeof BadgeSets !== 'undefined') { const drop = Object.keys(BADGE_SETS).filter(s => !BadgeSets.done(s)).map(s => 'keys_' + s); if (drop.length) drop.push('platinum');
      for (const id of drop) { delete Achievements.got[id]; delete Achievements.where[id]; } store('unit204-ach', Achievements.got); store('unit204-ach-site', Achievements.where); Achievements.badge(); }
  },
  /* the Progress rows in Settings: one reset per property, then one for everything */
  build(body) {
    const h = document.createElement('div'); h.className = 'set-sec'; h.textContent = 'Progress'; body.append(h);
    const row = (name, note, label, tip, go) => {
      const r = document.createElement('div'); r.className = 'set-row';
      const nm = document.createElement('div'); nm.className = 'set-name'; nm.textContent = name;
      const s = document.createElement('small'); s.textContent = note; nm.append(s);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small ghost'; b.textContent = label; b.dataset.tip = tip;
      b.addEventListener('click', () => { Audio2.sfx('click'); go(); });
      r.append(nm, b); body.append(r);
    };
    for (const id of Sites.order) {
      const st = SITES[id], earned = Object.keys(Achievements.got).filter(a => (Achievements.where[a] || (ACH[a] && ACH[a].site) || 'residential') === id || (ACH[a] && ACH[a].site === id)).length;
      const best = store(this.bestKey(id)) ?? (id === 'residential' ? store('unit204-best') : null);
      row(`${st.place} 204`, `${st.kind}: ${earned} ${earned === 1 ? 'badge' : 'badges'} earned here` + (best ? `, best score ${best}` : ''), 'Reset',
        `Reset ${st.place} 204|Forget your best score and the badges you earned at this property. Settings stay as they are.`,
        () => this.ask(`Reset ${st.place} 204? Your best score there and the badges you earned there are forgotten. This can't be undone.`, id));
    }
    row('Everything', 'Every property, every badge, and the saved takeout numbers', 'Reset all', 'Reset everything|Start over at every property. Settings stay as they are.',
      () => this.ask("Reset every property? All your best scores and every badge are forgotten. This can't be undone.", null));
  },
  ask(text, site) {
    UI.confirm(text, 'Reset', () => { this.reset(site); Settings.build(); Audio2.sfx('swish'); }, 'Cancel');
  }
};
