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
    const todo = FEATURES.filter(f => f.room === Game.room && !Game.marks[f.id]);
    if (!todo.length) return "Everything in here is on the form. Next room?";
    const f = todo[Game.hintIx++ % todo.length];
    return `The ${f.name.toLowerCase()}: ${f.hint}`;
  } },
  { q: "What's the difference between wear and damage?", a: () => "Wear is what time and normal living do: matting, fading, small nail holes, old caulk. Damage is what an accident or carelessness does: stains, burns, big holes, broken stuff. Wear is never charged. Damage is, with a photo." },
  { q: 'When is something a hazard?', a: () => "If it could hurt someone or the building is getting worse by the hour: gas, sparks, leaks, mold, a dead smoke alarm, something that could fall. It's a hazard even if the tenant caused it. Safety first, billing later." },
  { q: 'Why all the photos?', a: () => "Deposit charges get disputed. No photo, no charge; that's office policy. And maintenance needs pictures of hazards before they send someone out." },
  { q: 'How are we doing?', a: () => {
    const done = Object.keys(Game.marks).length, total = FEATURES.length;
    const left = Object.values(ROOMS).map((r, i) => [r.name, FEATURES.filter(f => f.room === Object.keys(ROOMS)[i] && !Game.marks[f.id]).length]).filter(([, n]) => n).map(([n, k]) => `${n} (${k})`);
    if (done === total) return "That's all fourteen! Submit the report from the menu, or head out the front door.";
    return `${done} of ${total} marked. Still to do: ${left.join(', ')}.`;
  } },
  { q: 'So... how are you?', a: () => DANA_SMALLTALK[Game.smallTalk++ % DANA_SMALLTALK.length] },
  { q: "Let's get back to it.", a: null }
];
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
      const b = document.createElement('button'); b.type = 'button'; b.textContent = tp.q;
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
    const todo = FEATURES.filter(f => f.room === Game.room && !Game.marks[f.id]);
    if (todo.length && Math.random() < .75) {
      const f = todo.find(x => !Game.seen.has(x.id)) || todo[Game.hintIx++ % todo.length];
      UI.say('dana', Game.seen.has(f.id) ? `Psst. The ${f.name.toLowerCase()}. ${f.hint}` : `Don't forget the ${f.name.toLowerCase()}. Give it a Look.`);
    } else if (!todo.length && Object.keys(Game.marks).length < FEATURES.length) {
      UI.say('dana', "This room's done. There's more on the checklist elsewhere.");
    } else UI.say('dana', pick(["Don't fall asleep on me, boss.", 'My feet hurt. These flats were a mistake.', 'Is it just me, or is this unit weirdly quiet?']));
  }
};
