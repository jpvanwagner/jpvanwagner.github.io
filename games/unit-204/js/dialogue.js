'use strict';
/* ============================== DANA ==============================
   Your assistant from the leasing office. Talk to her for room hints and SOP refreshers; she also pipes up
   (if hints are on) when you've been idle a while. She never gives away a condition, only where to look. */
const DANA_SMALLTALK = [
  "I just got a BlackBerry Curve. Now the office can reach me anywhere. Anywhere. It's a nightmare.",
  "My roommate is obsessed with Guitar Hero. I hear 'Through the Fire and the Flames' in my sleep.",
  "I'm saving up for one of those iPhones. Eight gigs! What would I even do with eight gigs?",
  "Don't tell anyone, but I've been doing Wii Fit on my lunch break. It says I'm 'unbalanced.' Rude.",
  "Did you see the new MySpace layout I made for the office? Glitter text. Very professional.",
  "I'm still on season two of LOST. No spoilers. I mean it. I will mark YOU as a hazard."
];
const DANA_TOPICS = [
  { q: 'Any tips for this room?', a: () => {
    const todo = FEATURES.filter(f => f.room === Game.room && !Game.marks[f.id]);   // any feature, so hints don't give away the work order
    if (!todo.length) return "You've marked everything in here. Next room? Or poke around. Little stuff counts too.";
    const f = todo[Game.hintIx++ % todo.length];
    Game.danaPoint(f.id);
    return `The ${lower(f.name)}: ${f.hint} I'll show you.`;
  } },
  { q: () => danaSays('wear', 0, "What's the difference between wear and damage?"), a: () => danaSays('wear', 1, "Wear is what time and normal living do: matting, fading, small nail holes, old caulk. Damage is what an accident or carelessness does: stains, burns, big holes, broken stuff. Wear is never charged. Damage is, with a photo.") },
  { q: () => danaSays('hazard', 0, 'When is something a hazard?'), a: () => danaSays('hazard', 1, "If it could hurt someone or the building is getting worse by the hour: gas, sparks, leaks, mold, a dead smoke alarm, something that could fall. It's a hazard even if the tenant caused it. Safety first, billing later.") },
  { q: 'Why all the photos?', a: () => danaSays('photos', null, "Deposit charges get disputed. No photo, no charge; that's office policy. And maintenance needs pictures of hazards before they send someone out. Snap anything you want, though. Extra photos never hurt.") },
  { q: 'How are we doing?', a: () => {
    const done = Object.keys(Game.marks).length;            // never how many are left: finding them is the job
    const cold = Object.keys(ROOMS).filter(id => !FEATURES.some(f => f.room === id && Game.seen.has(f.id))).map(id => ROOMS[id].name.toLowerCase());
    return `You've written up ${done} ${done === 1 ? 'thing' : 'things'} so far. How many are left? No idea, boss. That's why they send an inspector.` +
      (cold.length ? ` You haven't really looked around the ${list(cold)} yet.` : ' Did you open every door and cabinet, flip every switch, and check under stuff?');
  } },
  { q: 'Can I borrow your BlackBerry?', a: () => { setTimeout(() => { UI.close('dialogueScreen'); BlackBerry.open(); }, 900); return BlackBerry.pending().length ? "For Gus? Sure. He's under GUS (MAINT). Don't read my texts." : "Sure. Don't read my texts. ...You're going to read my texts."; } },
  { q: 'So... how are you?', a: () => { const list = danaSays('small', null, DANA_SMALLTALK); return list[Game.smallTalk++ % list.length]; } },
  { q: "Let's get back to it.", a: null }
];
/* what Dana says that depends on where you are: each site can give her its own lines (site.dana in js/sites/*.js), and
   anything a site doesn't give falls back to the apartment's. k picks the line; i picks the question (0) or answer (1). */
function danaSays(k, i, fallback) { const d = Sites.site.dana && Sites.site.dana[k]; return d == null ? fallback : i == null ? d : d[i]; }
const Dialogue = {
  open() {
    Game.player.idle = 0;
    this.render("What's up, boss?");
    UI.open('dialogueScreen'); Audio2.synth('blip');
  },
  render(text) {
    $('dlgText').textContent = text;
    Sprites.portrait($('danaPortrait'), 'dana', true); clearTimeout(this._m); this._m = setTimeout(() => Sprites.portrait($('danaPortrait'), 'dana', false), 900);
    const box = $('dlgOptions'); box.replaceChildren();
    DANA_TOPICS.forEach((tp, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = typeof tp.q === 'function' ? tp.q() : tp.q;
      if (Game.asked.has(i) && tp.a) b.classList.add('seen');
      b.addEventListener('click', () => {
        if (!tp.a) { UI.close('dialogueScreen'); UI.say('dana', 'Lead the way, boss.'); return; }
        Game.asked.add(i); Audio2.synth('blip'); this.render(tp.a());
      });
      box.append(b);
    });
  },
  /* idle chatter in the room */
  bark() {
    if (!Settings.get('danaHints') || UI.blocking() || UI.talking('dana') || UI.talking('you')) return;
    const todo = FEATURES.filter(f => f.room === Game.room && !Game.marks[f.id]);   // any feature, so hints don't give away the work order
    if (todo.length && Math.random() < .75) {
      const f = todo.find(x => !Game.seen.has(x.id)) || todo[Game.hintIx++ % todo.length];
      Game.danaPoint(f.id, Game.seen.has(f.id) ? `Psst. The ${lower(f.name)}. ${f.hint}` : `Don't forget the ${lower(f.name)}. Give it a Look.`);   // said once she's standing by it
    } else UI.say('dana', pick(danaSays('barks', null, ["Don't fall asleep on me, boss.", 'My feet hurt. These flats were a mistake.', 'Is it just me, or is this unit weirdly quiet?'])));
  }
};
