'use strict';
/* ============================== DOING THINGS WITH THE BAG ==============================
   In the bag, pick a verb (Look, Touch, Smell, or Combine), then an item. Combine asks for a second item and tells
   you how that went: a few pairs have their own lines, the rest get a shrug. Nothing here changes the inspection;
   it's for fun. Text for each kind: touch, smell (when CLUTTER doesn't already have one). */
const BAG_TEXT = {
  sock: { touch: 'Argyle, slightly crunchy. You decide not to think about why.' },
  hanger: { touch: 'You bend it into a hook, then a question mark, then back into a hanger. Mostly.', smell: 'Metal. Faintly of dry cleaning.' },
  menu: { touch: 'You unfold it. The lunch specials end at 3. It is never before 3 when you want them.' },
  cd: { touch: 'You hold it up to the light. A tiny rainbow. 1,000 free hours of rainbow.', smell: 'Shrink wrap and broken promises.' },
  phonebook: { touch: 'You try to tear it in half. The phone book wins. The phone book always wins.', smell: 'Newsprint and the year 2003.' },
  flipflop: { touch: 'It flaps. That is the whole sound of a flip-flop, and it is making it at you.', smell: 'Beach, and feet. Mostly feet.' },
  brick: { touch: 'You press the brick into your palm. It leaves a perfect grid of dots. Pain, in a primary color.', smell: 'Plastic. A childhood, somewhere.' },
  charger: { touch: 'You unwind the cord and wind it back the exact same way. Someone taught you well.', smell: 'Dust and a whiff of warm plastic, from memory.' },
  catalog: { touch: 'You flip to a bookcase named after a Swedish lake. You could never afford the lake.', smell: 'Glossy paper and the idea of a nicer apartment.' },
  coupon: { touch: 'You flip through: 20 percent off a car wash, buy one get one at a buffet that closed. Expired, all of it.', smell: 'Cheap ink. Savings, long gone.' },
  dvd: { touch: 'You pop the case open and closed. It makes a satisfying clack. Clack. Clack.' },
  envelope: { touch: 'The red envelope crinkles. Somewhere, a queue is waiting for this to come back.' },
  tape: { touch: 'You spin a reel with your pinky. It does not rewind itself. Be kind, rewind.' },
  soysauce: { touch: 'You squish the packet. It squishes back. A small, salty stress ball.' },
  bakingsoda: { touch: 'The box is half full and rock solid. It absorbed odors until it became one.' },
  pickles: { touch: 'You try the lid. Sealed tight. Generations have tried this lid.' },
  fishstick: { touch: 'It is hard enough to knock on. You knock on it. Nobody answers.' },
  stapler: { touch: 'You give it a test squeeze. Ka-chunk. It is a very good stapler. You understand now why someone would want it back.' },
  mug: { touch: "You hook a finger through the handle. 'WORLD'S OKAYEST LANDLORD.' Still has a coffee ring inside." },
  chopsticks: { touch: 'Still joined at the top. You snap them apart. One breaks into a splinter. Classic.', smell: 'Raw wood, and a little bit of General Tso.' },
  soap: { touch: 'Slick and pink, with a crack down the middle. It has been through things.' },
  shampoo: { touch: "A tiny hotel bottle, still sealed. A souvenir from somebody's better weekend." },
  burgerphone: { touch: 'You open the bun. A dial tone, from nowhere. You close the bun, fast.' },
  vhs: { touch: "You thumb through the tapes: 'XMAS 97', 'GRADUATION', 'DO NOT TAPE OVER', and one with no label at all. You leave that one alone." },
  waffles: { touch: 'Frozen into one solid waffle brick. Freezer burn with a grid pattern.' },
  icetray: { touch: 'You twist it. It cracks, but there was no ice in it. Just the crack.', smell: 'Freezer. Faintly of onion, somehow.' },
  spoon: { touch: 'You look at your reflection in it, upside down. That tracks.', smell: 'Dish soap, and cereal. Long ago cereal.' },
  tie: { touch: 'Silky, loud, and slightly sticky. You loop it around your neck. You feel like you could close a deal, or sing karaoke.' }
};
/* pairs with their own lines (keys are the two kinds, sorted) */
const BAG_COMBOS = {
  'fishstick+soysauce': 'You dress the fossilized fish stick with soy sauce. It is now a salty fossil. Progress.',
  'bakingsoda+pickles': "You consider a science experiment. Then you consider the paperwork. You put them back.",
  'dvd+envelope': 'You put the DVD back in its red envelope. Somewhere, a queue moves up one. You did a good deed.',
  'cd+charger': 'You plug the charger into the CD. Nothing happens, because that is not how any of this works.',
  'hanger+tie': 'You hang the tie on the hanger. Now it looks like a closet. A very small, very loud closet.',
  'burgerphone+charger': 'You look for a place to plug the charger into the hamburger phone. It is a landline. It is also a hamburger.',
  'burgerphone+menu': "You pick up the hamburger phone and dial the number on the takeout menu. Nothing: it isn't plugged into anything. Dana's BlackBerry would work, though.",
  'chopsticks+waffles': 'You try to pry a waffle loose with a chopstick. The chopstick loses.',
  'chopsticks+fishstick': 'You pick up the fish stick with the chopsticks. It is heavier than it looks. You put it down with respect.',
  'mug+spoon': 'You stir the empty mug. Clink, clink. It is the most relaxing thing you have done all day.',
  'shampoo+soap': 'A full spa day, if the spa were a gas station bathroom.',
  'phonebook+stapler': 'You staple the phone book. One staple. It holds nothing together. It feels great anyway.',
  'catalog+coupon': "None of the coupons are for furniture. Somebody's dream sofa will have to wait.",
  'icetray+mug': 'You put the ice tray in the mug. Neither of you knows what happens next.',
  'sock+tie': 'You tie the sock to the tie. It is a scarf now. A terrible, terrible scarf.',
  'hanger+sock': 'You hang one sock on a hanger. Now it looks like a laundry room with one very specific customer.',
  'brick+tie': 'You set the brick on the tie like a paperweight. The tie has never been so still.',
  'tape+vhs': 'You file the loose tape in the shoebox. It fits right between GRADUATION and DO NOT TAPE OVER.',
  'stapler+tie': 'You staple the tie into a loop. It is a crown now. You are the King of Move-Outs.',
  'menu+soysauce': "A menu and its last soy sauce, together again. You've reunited a family.",
  'chopsticks+menu': 'Chopsticks and a takeout menu. All that is missing is the food, and the will to order.',
  'flipflop+sock': 'Socks with sandals. Somewhere, a fashion inspector marks this a hazard.'
};
const BAG_SHRUG = [
  "You hold the {a} next to the {b}. Nothing happens. You don't know what you expected.",
  'You try combining the {a} and the {b}. They remain, stubbornly, two things.',
  'The {a} and the {b} have nothing to say to each other.',
  "You tape the {a} to the {b} in your mind. In real life, you don't have tape. Well, you have a tape measure.",
  "Some things aren't meant to go together. The {a} and the {b} are two of those things."
];
const BagVerbs = {
  verb: 'look', first: null,
  VERBS: [['look', 'Look', 'Look at the item.'], ['touch', 'Touch', 'Feel it, fiddle with it.'], ['smell', 'Smell', 'Give it a sniff. Your choice.'], ['combine', 'Combine', 'Use it with another item.']],
  build() {
    if ($('bagVerbs')) return;
    const bar = document.createElement('div'); bar.id = 'bagVerbs'; bar.className = 'bag-verbs';
    for (const [id, label, tip] of this.VERBS) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.dataset.verb = id; b.textContent = label; b.dataset.tip = label + '|' + tip;
      b.addEventListener('click', () => { this.verb = id; this.first = null; Audio2.sfx('tick'); this.sync(); if (Bag.sel) this.pick(Bag.sel); });
      bar.append(b);
    }
    $('bagGrid').after(bar); this.sync();
  },
  sync() { for (const b of document.querySelectorAll('#bagVerbs button')) b.classList.toggle('on', b.dataset.verb === this.verb); },
  kind(key) { return key.split('|')[0]; },
  /* an item was clicked (or a verb chosen with one selected): what happens */
  pick(key) {
    const it = bagItem(key), k = this.kind(key), T = BAG_TEXT[k] || {}, name = lower(it.def.name);
    if (this.verb === 'combine') {
      if (!this.first || this.first === key) { this.first = key; return this.say(it.name, `Combine the ${name} with what? Pick another item.`); }
      const a = this.kind(this.first), pair = [a, k].sort().join('+'), an = lower(bagItem(this.first).def.name);
      this.first = null; Audio2.sfx('swish', .5);
      if (BAG_COMBOS[pair]) { (Game.combos = Game.combos || new Set()).add(pair); if (Game.combos.size >= 5) Achievements.unlock('chemist'); }
      return this.say(`${an[0].toUpperCase() + an.slice(1)} + ${name}`, BAG_COMBOS[pair] || (a === k ? `Two of the same thing. You make them hold hands.` : pick(BAG_SHRUG).replace('{a}', an).replace('{b}', name)));
    }
    if (this.verb === 'touch') return this.say(it.name, T.touch || clutterText(it.def, 'bagTouch', it.c) || `You turn the ${name} over in your hands. Yep. That's a ${name}.`);
    if (this.verb === 'smell') return this.say(it.name, clutterText(it.def, 'smell', it.c) || T.smell || `It smells like the inside of your bag now.`);
    return this.say(it.name, it.look);
  },
  say(title, text) { const d = $('bagDesc'), t = document.createElement('b'); t.textContent = title; d.replaceChildren(t, document.createTextNode(text)); }
};
