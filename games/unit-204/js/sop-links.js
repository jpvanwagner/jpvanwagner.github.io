'use strict';
/* ============================== SOP LINKS ==============================
   Wherever the game cites the SOP (a field note that says "per the SOP", a verdict's reasoning, a report line), the
   reference is a link. Clicking it lays the binder over everything, opened to the right page, with that rule
   flashing like a fresh highlighter stroke; closing the binder drops you right back where you were. The rules in the
   binder carry data-sop keys (c0..c3 for the four codes, plus the field-method and phone-call tips). */
const SopLinks = {
  /* the rule a sentence is most likely leaning on, when it just says "the SOP" */
  guess(text) {
    const t = text.toLowerCase();
    if (/no photo|without (a )?photo|photo/.test(t) && /charge|deposit|dispute/.test(t)) return 'nophoto';
    if (/hazard|gas|spark|leak|mold|breaker|shut-?off|smoke alarm/.test(t)) return 'c3';
    if (/1\/4|quarter inch|wear|aged|yellow|faded|matted/.test(t)) return 'c1';
    if (/damage|charge|deposit|stain|burn|broken/.test(t)) return 'c2';
    if (/measure|tape/.test(t)) return 'measure';
    return 'c0';
  },
  /* a small inline link to one rule */
  ref(key, label) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sop-ref' + (key.startsWith('osha-') ? ' osha-ref' : ''); b.dataset.sop = key; b.textContent = label;
    b.dataset.tip = key.startsWith('osha-') ? 'Field Safety Handbook|Open the handbook to this OSHA rule.' : 'SOP 4.2|Open the binder to this rule.';
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.open(key); });
    return b;
  },
  /* text with every mention of the SOP (or the binder) turned into a link; key forces the rule, otherwise it's guessed */
  linkify(text, key) {
    // the SOP, and OSHA citations ("29 CFR 1910.37(a)(3)", "1926.501(b)(1)"), which open the Field Safety Handbook to their chapter
    const frag = document.createDocumentFragment(), re = /\b(?:the )?SOP(?: (?:binder|manual))?\b|(?:29 CFR )?\b19(?:0[34]|10|26)\.\d+(?:\([a-z0-9]+\))*/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      const cite = /^(?:29 CFR )?19/.test(m[0]);
      frag.append(document.createTextNode(text.slice(last, m.index)), cite ? this.ref('osha-' + OshaBook.chapterFor(m[0]), m[0]) : this.ref(key || this.guess(text), m[0]));
      last = m.index + m[0].length;
    }
    frag.append(document.createTextNode(text.slice(last)));
    return frag;
  },
  /* turn the OSHA citations inside an element's text into handbook links (the SOP's pages use this) */
  citeify(root) {
    const re = /(?:29 CFR )?\b19(?:0[34]|10|26)\.\d+(?:\([a-z0-9]+\))*/g, walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), hits = [];
    while (walk.nextNode()) if ((re.lastIndex = 0, re.test(walk.currentNode.nodeValue)) && !walk.currentNode.parentNode.closest('button')) hits.push(walk.currentNode);
    for (const t of hits) {
      const frag = document.createDocumentFragment(), s = t.nodeValue; let last = 0, m; re.lastIndex = 0;
      while ((m = re.exec(s))) { frag.append(document.createTextNode(s.slice(last, m.index)), this.ref('osha-' + OshaBook.chapterFor(m[0]), m[0])); last = m.index + m[0].length; }
      frag.append(document.createTextNode(s.slice(last))); t.replaceWith(frag);
    }
  },
  /* the reasoning behind a verdict, followed by a link to the code it falls under */
  why(el, text, cat) {
    el.replaceChildren(this.linkify(text, 'c' + cat), document.createTextNode(' '));
    if (!/\bSOP\b/.test(text)) el.append(this.ref('c' + cat, 'SOP: ' + CATS[cat].name));
    return el;
  },
  /* open the binder on top of everything, to the page holding this rule, and make the rule flash */
  open(key) {
    const want = key.startsWith('osha-') ? 'osha' : 'sop'; if (SopBook.book !== want) SopBook.use(want);   // the right book first
    if (want === 'osha') Achievements.unlock('finprint');
    const i = SopBook.pages.findIndex(p => p.querySelector(`[data-sop="${key}"]`)); if (i < 0) return;
    const scr = $('sopScreen'); scr.classList.add('linked'); Achievements.unlock('bythebook');
    if (UI.isOpen('sopScreen')) UI.close('sopScreen');           // re-open on top of the stack so Esc closes it first
    SopBook.at = i; UI.open('sopScreen'); SopBook.show(); Audio2.sfx('swish', .5);
    requestAnimationFrame(() => {
      const hit = $('sopSpread').querySelector(`[data-sop="${key}"]`); if (!hit) return;
      hit.classList.remove('sop-flash'); void hit.offsetWidth; hit.classList.add('sop-flash');
    });
  },
  init() {
    // once the binder closes, it goes back to being an ordinary overlay (guarded: an unconditional remove re-fires the observer forever)
    new MutationObserver(() => { const s = $('sopScreen'); if (!s.classList.contains('on') && s.classList.contains('linked')) s.classList.remove('linked'); }).observe($('sopScreen'), { attributes: true, attributeFilter: ['class'] });
  }
};
SopLinks.init();
