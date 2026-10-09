'use strict';
/* ============================== DID YOU KNOW? ==============================
   A short "loading screen" between levels with one real fact about teeth and gums. The facts come from the
   WHO, CDC, ADA, NHS and Mayo Clinic; keep each one short enough to read in a few seconds. */
const FACTS = [
  { text: 'Tooth decay in permanent teeth is the most common health condition in the world. About 2 billion people have it.', src: 'World Health Organization, Global Oral Health Status Report (2022)' },
  { text: 'Close to 3.5 billion people, almost half the world, live with an oral disease such as tooth decay or gum disease.', src: 'World Health Organization (2022)' },
  { text: 'Severe gum disease affects about 1 in 5 adults worldwide, more than 1 billion people.', src: 'World Health Organization (2022)' },
  { text: 'Nearly half of U.S. adults aged 30 and older show signs of gum disease.', src: 'U.S. Centers for Disease Control and Prevention' },
  { text: 'Bleeding gums when you brush or floss can be an early sign of gingivitis, the mild stage of gum disease. Caught early, it can be reversed.', src: 'American Dental Association' },
  { text: 'Gum disease is one of the main reasons adults lose teeth.', src: 'American Dental Association' },
  { text: 'Brushing twice a day for two minutes with a fluoride toothpaste is one of the best ways to prevent cavities.', src: 'American Dental Association' },
  { text: "Spit, don't rinse! Leaving a little fluoride toothpaste on your teeth after brushing helps it keep protecting them.", src: 'NHS (UK)' },
  { text: "Cleaning between your teeth once a day, with floss, picks or tiny brushes, removes plaque a toothbrush can't reach.", src: 'American Dental Association' },
  { text: 'Swap your toothbrush (or brush head) every 3 to 4 months, or sooner if the bristles are frayed.', src: 'American Dental Association' },
  { text: 'Plaque that stays on your teeth can harden into tartar, and only a dental professional can remove tartar.', src: 'American Dental Association' },
  { text: 'Smoking is a major risk factor for gum disease, and it makes gum disease harder to treat.', src: 'U.S. Centers for Disease Control and Prevention' },
  { text: 'How often you have sugary snacks and drinks matters: every sip or bite feeds bacteria that make tooth-dissolving acid.', src: 'American Dental Association' },
  { text: 'The WHO recommends keeping free sugars under 10% of your daily calories, and under 5% for even more benefit.', src: 'World Health Organization' },
  { text: 'Most bad breath (halitosis, like Hal!) starts in the mouth, often from bacteria on the back of the tongue. Cleaning your tongue helps.', src: 'American Dental Association' },
  { text: 'Saliva washes away food and neutralizes acid. Chewing sugar-free gum after meals gets more of it flowing.', src: 'American Dental Association' },
  { text: 'Tooth enamel is the hardest substance in the human body, but acid can still wear it away.', src: 'American Dental Association' },
  { text: 'Sodas, sports drinks and fruit juices are acidic and can erode enamel. Water is the best drink between meals.', src: 'American Dental Association' },
  { text: 'Porphyromonas gingivalis, the real-life "Gingi", is one of the key bacteria behind serious gum disease.', src: 'Periodontal research' },
  { text: 'Dental sealants on back teeth prevent about 80% of cavities in those teeth for two years.', src: 'U.S. Centers for Disease Control and Prevention' },
  { text: 'Community water fluoridation reduces tooth decay by about 25% in children and adults.', src: 'U.S. Centers for Disease Control and Prevention' },
  { text: 'Kids with poor oral health miss more school and get lower grades than kids with healthy teeth.', src: 'U.S. Centers for Disease Control and Prevention' },
  { text: 'Diabetes raises the risk of gum disease, and serious gum disease can make blood sugar harder to control.', src: 'U.S. Centers for Disease Control and Prevention' },
  { text: 'Regular dental checkups catch cavities and gum disease early, when they are easiest to treat.', src: 'American Dental Association' },
  { text: 'Plaque loves to hide around braces. Brushing carefully around each bracket and under the wire keeps teeth healthy.', src: 'American Association of Orthodontists' },
  { text: 'Adults usually have 32 teeth: 16 on top and 16 on the bottom, wisdom teeth included, just like the arch in Bite Club.', src: 'American Dental Association' },
  { text: 'Wisdom teeth are the third molars. They usually come in during the late teens or early twenties, if they come in at all.', src: 'American Dental Association' },
  { text: "Canker sores, like the ones on the tongue in Tongue-Fu, aren't contagious and usually heal on their own in 1 to 2 weeks.", src: 'Mayo Clinic' }
];
const FACT_FRAMES = 420, FACT_SKIP = 60;     // shown for 7 seconds; skippable after 1
let factDeck = [];
function nextFact() {
  if (!factDeck.length) factDeck = FACTS.map((f, i) => i).sort(() => Math.random() - 0.5);   // no repeats until all are seen
  return FACTS[factDeck.pop()];
}
function showFacts(next) {
  const f = nextFact(), def = LEVEL_DEFS[next];
  G.state = 'facts'; G.factT = 0; G.factNext = next; releaseAll(); setBodyState();
  $('factText').textContent = f.text;
  $('factSrc').textContent = 'Source: ' + f.src;
  $('factNext').textContent = 'Next: ' + def.tag.replace(/ - .*/, '') + ' · ' + titleCase(def.name);
  $('factFill').style.width = '0%';
  $('factSkip').classList.remove('on');
  showOverlay('factScreen');
  AudioSys.preload(def.music);              // fetch + render the next level's music while the player reads
}
function updateFacts() {
  G.factT++;
  $('factFill').style.width = Math.min(100, G.factT / FACT_FRAMES * 100) + '%';
  if (G.factT === FACT_SKIP) $('factSkip').classList.add('on');
  if (G.factT >= FACT_FRAMES) leaveFacts();
}
function skipFacts() { if (G.state === 'facts' && G.factT >= FACT_SKIP) leaveFacts(); }
function leaveFacts() {
  if (G.state !== 'facts') return;
  const next = G.factNext;
  G.state = 'transition'; showOverlay(null);
  G.fade = 0.01; G.fadeTo = () => {
    loadLevel(next); G.state = 'play'; setBodyState();
    const intro = LEVEL_INTRO[LEVEL_DEFS[next].id];
    if (intro) dialog(LINES[intro], null);
  };
}
$('factScreen').addEventListener('pointerdown', () => skipFacts());
