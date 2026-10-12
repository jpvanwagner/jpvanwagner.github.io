'use strict';
/* ============================== THE BAG ==============================
   Things the tenant left behind that you picked up. They don't do anything on the job. They're just yours now. */
/* bag entries are clutter kinds, or 'kind|title|n' for things like DVDs that carry their own title */
function bagItem(key) {
  const [kind, title, n] = key.split('|'), def = CLUTTER[kind], c = title && TITLED[kind] ? { title, n: +n, style: (+n || 0) % CASES.length } : {};   // a title only means something for titled kinds
  return { def, c, kind, name: c.title ? `${def.name}: ${c.title}` : def.name, look: clutterText(def, 'bagLook', c) || clutterText(def, 'look', c) };
}
const Bag = {
  sel: null,
  add(kind) {
    if (!Game.bag.includes(kind)) Game.bag.push(kind);
    if (kind === 'stapler') Achievements.unlock('stapler'); if (Game.bag.length >= 6) Achievements.unlock('packrat');
    this.count(); Audio2.sfx('swish', .6);
    const b = $('tbBag'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  },
  count() { $('tbBagN').textContent = Game.bag.length; },
  art(kind, w = 48, h = 36) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const it = bagItem(kind); it.def.draw(g, Math.round(w / 2), Math.round(h * (it.def.hang ? .12 : .72)), 3, it.c);
    outline(c, '#120e18');
    return c;
  },
  open() {
    this.sel = Game.bag[Game.bag.length - 1] || null; BagVerbs.build(); BagVerbs.first = null;
    this.render(); UI.open('bagScreen'); Audio2.sfx('swish', .7);
  },
  mark() { for (const b of document.querySelectorAll('#bagGrid .bag-slot')) b.classList.toggle('first', !!BagVerbs.first && b.getAttribute('aria-label') === bagItem(BagVerbs.first).name); },   // the first half of a Combine
  render() {
    const grid = $('bagGrid'); grid.replaceChildren();
    for (let i = 0; i < Math.max(8, Game.bag.length); i++) {
      const kind = Game.bag[i], b = document.createElement('button'); b.type = 'button'; b.className = 'bag-slot';
      if (kind) {
        b.append(this.art(kind)); b.setAttribute('aria-label', bagItem(kind).name); b.classList.toggle('sel', kind === this.sel);
        b.classList.toggle('first', kind === BagVerbs.first);
        b.addEventListener('click', () => { this.sel = kind; Audio2.sfx('tick'); const first = BagVerbs.first; this.render(); if (BagVerbs.verb !== 'look' || first) BagVerbs.pick(kind); this.mark(); });
      } else { b.disabled = true; b.setAttribute('aria-hidden', 'true'); }
      grid.append(b);
    }
    const d = $('bagDesc'); d.replaceChildren();
    if (this.sel) { const it = bagItem(this.sel), t = document.createElement('b'); t.textContent = it.name; d.append(t, document.createTextNode(it.look)); }
    else d.textContent = 'Empty. Pick up things the tenant left behind with the Touch hand. They won\'t help with the inspection. That isn\'t the point.';
  }
};
