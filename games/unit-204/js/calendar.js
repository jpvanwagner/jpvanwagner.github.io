'use strict';
/* ============================== THE KITCHEN CALENDAR ==============================
   The tenant's wall calendar: a 2008 calendar of one kind or another (a different one each shift: Georgia
   O'Keeffe, pizza, giant robots, space art, dragons, vintage pin-ups, kittens, or office motivation). It's still
   on the month the tenant moved out, with the move-out date circled (yesterday, by the player's own clock).
   Look at it for a close-up: the picture on top, the month grid below, the same size. Touch it to flip to the
   next month (the picture changes too), or the bottom-left corner to flip back. After December there's nothing
   left to flip, so it asks whether to take it down; then it's in your bag, the same calendar, still on December. */
const CAL_THEMES = [
  { id: 'okeeffe', name: "Georgia O'Keeffe", look: "A Georgia O'Keeffe calendar from a museum gift shop. Classy, for a kitchen.",
    bag: "The tenant's Georgia O'Keeffe calendar: enormous flowers, desert bones, and a pencil mustache on November's skull.", touch: 'Heavy matte paper. You flip through the flowers. They do not get any smaller.', smell: 'Museum gift shop: paper and good intentions.',
    months: ['Red Canna. Very red. Very close up.', 'Black Iris. You lean in, then lean back out.', 'Ram\'s Head, White Hollyhock, and Little Hills. A skull floating over the desert, as one does.', 'A pink tulip the size of a hubcap. It\'s a flower. It\'s definitely just a flower.', 'Jimson Weed, white as a bedsheet.', 'Red Poppy, so big it barely fits on the page.', 'The red hills of New Mexico, folded like laundry.', 'Two Calla Lilies on Pink. Art history majors nod knowingly.', 'Sky Above Clouds. Very calm. Nobody in this picture has a deposit dispute.', 'Oriental Poppies, orange enough to warm the kitchen.', 'A cow\'s skull with calico roses. Someone drew a mustache on it in pencil.', 'Blue Morning Glory, for a December that is definitely not blue.'] },
  { id: 'pizza', name: "Tony's Pizzeria", look: "A free calendar from Tony's Pizzeria. Every month is a pizza.",
    bag: "Tony's Pizzeria's free calendar: twelve pizzas, one coupon, all of it expired.", touch: 'The pages are a little greasy. Of course they are.', smell: 'Oregano. Faintly. After a whole year on a kitchen wall.',
    months: ['A New Year\'s pepperoni, cut into twelve slices, one per resolution.', 'A heart-shaped pizza. "PIZZA MY HEART." Somebody got paid for that.', 'Green peppers and spinach, for St. Patrick\'s Day. Nobody ordered this.', 'Pineapple and ham, captioned "APRIL FOOLS?" Bold.', 'Mushrooms. Just mushrooms. May is a quiet month at Tony\'s.', 'The Meat Lover\'s, sweating under the studio lights.', 'Red, white, and blue. The blue is olives. It is mostly olives.', 'A Margherita, with basil from Tony\'s own garden, according to Tony.', 'Back to school: a pizza cut into squares, like the cafeteria.', 'Jack-o\'-lantern pizza: pepperoni eyes, olive teeth. Mildly haunting.', 'Thanksgiving pizza, with turkey and stuffing on it. A crime.', 'A pizza with a basil wreath and a coupon: $2 off any large. Expired.'] },
  { id: 'anime', name: 'Mecha Strike Zero', look: 'A giant-robot anime calendar, MECHA STRIKE ZERO, imported. The price sticker is still on it: $34.99.',
    bag: 'MECHA STRIKE ZERO, the giant-robot calendar. Every page has more speed lines than the one before.', touch: 'Glossy. You can almost hear the theme song.', smell: 'New glossy paper. Somebody kept this in its plastic for a while.',
    months: ['Strike Zero, the giant robot, standing in the snow, determined about January.', 'Strike Zero\'s pilot, hand on heart. The tenant drew little hearts around them.', 'A launch sequence. Speed lines. So many speed lines.', 'Strike Zero under cherry blossoms, sword lowered. Even robots need a day off.', 'A rival robot, drawn as menacingly as a robot can be.', 'The pilot, mid-shout, a single tear sparkling off one eye. Feelings were had.', 'The beach episode. The robot is wearing sunglasses. You have questions.', 'Five small robots combining into one. Physics was not invited.', 'Strike Zero, battered, standing anyway. Very inspiring for a Monday.', 'The Halloween special: the robot in a cape. Fearsome. Also adorable.', 'The pilots, eating ramen at a counter. The most relatable page.', 'Strike Zero in a Santa hat, firing a rocket punch of presents.'] },
  { id: 'space', name: 'Visions of Tomorrow', look: "'Visions of Tomorrow', a space-art calendar from a science museum.",
    bag: "'Visions of Tomorrow': rockets, ringed planets, and a future that was supposed to have monorails.", touch: 'You flip past rockets and ringed planets. 2008 feels a long way behind them.', smell: 'Paper, and the faintest whiff of planetarium gift shop.',
    months: ['A ringed planet over an icy moon. Colder than this apartment, barely.', 'Twin suns setting on a desert world. Somebody\'s about to be called in for dinner.', 'A silver rocket on its pad, all fins, the way 1957 imagined 2008.', 'A nebula, purple and pink, like a lava lamp in space.', 'A wheel-shaped space station, turning to a waltz you can almost hear.', 'An astronaut planting a flag on a moon nobody has named yet.', 'A gas giant\'s red storm, bigger than three Earths and just as upset.', 'A flying saucer over a cornfield. The farmer looks unbothered.', 'A domed city on Mars, with a monorail. No traffic.', 'A comet streaking past. The caption says it\'s back in 2061. This calendar ends in December.', 'A sleek starship at warp. The tenant penciled "pew pew" next to it.', 'Earth, seen from the Moon. Home for the holidays, from very far off.'] },
  { id: 'fantasy', name: 'Realms of Legend', look: "'Realms of Legend', a fantasy-art calendar. A dragon every month, more or less.",
    bag: "'Realms of Legend': dragons, castles, and one wizard who is definitely reading the lease.", touch: 'Thick glossy pages. The dragons look back at you.', smell: 'Paper and incense. The tenant had a whole vibe going.',
    months: ['An ice dragon curled around a frozen tower, guarding it from January.', 'A knight kneeling before a dragon. Whether this is a proposal is unclear.', 'A wizard\'s tower in a storm, lightning in every window.', 'Elves in a spring forest, staring at something offscreen with great concern.', 'A dragon asleep on a hoard of gold. Its security deposit is in there somewhere.', 'A castle on a cliff at sunset, with far too many towers to heat.', 'A sea serpent wrapped around a ship. The ship is having a bad day.', 'A griffin over the mountains. Half eagle, half lion, all majestic.', 'A dwarf forge, glowing orange. Their hammers are nicer than yours.', 'A haunted castle under a full moon. Bats included at no extra charge.', 'A wizard reading a scroll by candlelight. Probably the lease.', 'A red dragon in a wreath, breathing very festive fire.'] },
  { id: 'pinup', name: 'Classic Pin-Up Art', look: 'A vintage pin-up art calendar: 1950s calendar-girl paintings, cheeky by the standards of a 1955 gas station.',
    bag: 'The pin-up calendar: polka dots, victory rolls, and big 1950s smiles. Wholesome, in a gas-station way.', touch: 'Old-style paintings, all winks and polka dots. Nothing that would get you sent to HR. Probably.', smell: 'Like somebody\'s dad\'s garage.',
    months: ['A calendar girl on ice skates, scarf flying, waving at nobody in particular.', 'A calendar girl in a red polka-dot dress, holding a valentine bigger than she is.', 'A calendar girl losing a fight with an umbrella in the March wind, gracefully.', 'A calendar girl in a garden, very surprised by a garden hose.', 'A calendar girl in overalls, holding a wrench. She fixes her own sink. Respect.', 'A calendar girl in a sailor suit, saluting. Somewhere a Navy recruiter smiles.', 'A calendar girl with a sparkler, in a 1955 swimsuit that covers more than most outfits do now.', 'A calendar girl at the beach with a beach ball, squinting at the sun like the rest of us.', 'A calendar girl at a typewriter, pencil behind her ear. A fellow professional.', 'A calendar girl on a broomstick in a witch\'s hat, winking.', 'A calendar girl carrying a turkey that is far too big for her.', 'A calendar girl in a Santa hat, perched on a stack of presents.'] },
  { id: 'kittens', name: 'Hang In There! Kittens', look: "A 'Hang In There!' kitten calendar. Each month: one kitten, one crisis.",
    bag: "The 'Hang In There!' kitten calendar. Twelve kittens, twelve crises, zero regrets.", touch: 'The pages are soft from flipping. Somebody loved this calendar.', smell: 'Paper. And, somehow, cat.',
    months: ['A kitten in a knit hat, deeply unhappy about the hat.', 'Two kittens in one teacup. Only one fits.', 'A kitten dangling from a branch: HANG IN THERE! It has been hanging in there since 1971.', 'A kitten in a rain boot.', 'A kitten asleep in a flower pot. The gardening is going poorly.', 'A kitten staring down a goldfish bowl. The fish is winning.', 'A kitten in a tiny Uncle Sam hat. Patriotic. Confused.', 'Three kittens in a laundry basket, which is where all laundry baskets end up.', 'A kitten in a pencil cup, ready for the school year.', 'A black kitten in a pumpkin. Spooky, at about one percent.', 'A kitten and a ball of yarn, both unraveling.', 'A kitten in a stocking. The best present.'] },
  { id: 'synergy', name: 'SYNERGY', look: "A 'SYNERGY' motivational calendar, the kind offices hand out instead of raises.",
    bag: "The 'SYNERGY' motivational calendar. One capital-letter word a month, and not one raise.", touch: 'Glossy, black-bordered pages. Every one has a single word in capital letters.', smell: 'Toner and quarterly goals.',
    months: ['A summit at dawn. LEADERSHIP.', 'Two hands shaking, a sunrise behind them. PARTNERSHIP.', 'Rowers in perfect unison. TEAMWORK. Nobody rows alone, it says. Lots of people row alone.', 'A single raindrop rippling a pond. INFLUENCE.', 'An eagle in flight. EXCELLENCE. The eagle does not have a quarterly review.', 'A climber hanging off a cliff. PERSEVERANCE. Someone circled the rope and wrote "OSHA?"', 'Fireworks over a city. INNOVATION.', 'A lighthouse in a storm. INTEGRITY.', 'Penguins in a huddle. SYNERGY. You still don\'t know what synergy means.', 'A road through autumn trees. VISION.', 'One goose leading a V of geese. DIRECTION.', 'A candle in the dark. HOPE. Also the last page. It\'s been a year.'] }
];
const CAL_WORDS = ['LEADERSHIP', 'PARTNERSHIP', 'TEAMWORK', 'INFLUENCE', 'EXCELLENCE', 'PERSEVERANCE', 'INNOVATION', 'INTEGRITY', 'SYNERGY', 'VISION', 'DIRECTION', 'HOPE'];
const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_YEAR = 2008;
/* the day the tenant moved out: yesterday on the player's clock, in 2008 (a leap year, so Feb. 29 is fine) */
function moveOutDay() { const d = new Date(); d.setDate(d.getDate() - 1); return { m: d.getMonth(), d: d.getDate() }; }
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

/* ---------- a 3x5 pixel font for the dates and the weekday letters ---------- */
const CAL_GLYPH = { 0: '###/#.#/#.#/#.#/###', 1: '.#./##./.#./.#./###', 2: '###/..#/###/#../###', 3: '###/..#/.##/..#/###', 4: '#.#/#.#/###/..#/..#', 5: '###/#../###/..#/###', 6: '###/#../###/#.#/###', 7: '###/..#/.#./.#./.#.', 8: '###/#.#/###/#.#/###', 9: '###/#.#/###/..#/###',
  S: '###/#../###/..#/###', M: '#.#/###/#.#/#.#/#.#', T: '###/.#./.#./.#./.#.', W: '#.#/#.#/#.#/###/#.#', F: '###/#../##./#../#..' };
function calText(g, s, x, y, col) { g.fillStyle = col; [...String(s)].forEach((ch, i) => { const gl = CAL_GLYPH[ch]; if (gl) gl.split('/').forEach((r, j) => [...r].forEach((c, k) => { if (c === '#') g.fillRect(x + i * 4 + k, y + j, 1, 1); })); }); }

/* pixel-font text centered on whole pixels, so it stays crisp instead of smearing across two */
function crispText(g, s, cx, y, px, col) { g.font = `${px}px 'Silkscreen', monospace`; g.textAlign = 'left'; g.fillStyle = col; g.fillText(s, Math.round(cx - g.measureText(s).width / 2), Math.round(y)); }
/* ---------- the pictures: one small painting per theme and month, in the box x, y, w, h ---------- */
function calPicture(g, theme, m, x, y, w, h) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const R = (a, b, c, d, col) => pxRect(g, x + a, y + b, c, d, col), E = (a, b, rx, ry, col) => pxEllipse(g, x + a, y + b, rx, ry, col), L = (a, b, c, d, col, wd) => pxLine(g, x + a, y + b, x + c, y + d, col, wd);
  const sky = (top, bot) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(x, y, w, h); };
  const cx = w / 2, cy = h / 2, s = h / 58;                                // drawn for a 116x58 box, scaled to whatever this one is
  const S = v => Math.max(1, Math.round(v * s));
  switch (theme.id) {
    case 'okeeffe': {
      const fl = [['#e8302a', '#9a1a18', '#f6d24a'], ['#3a2a4a', '#1a1222', '#d8c8e0'], null, ['#f49ab8', '#d8608a', '#fff0a0'], ['#f6f4ee', '#d8d4c8', '#c8d070'], ['#e83a2a', '#a01a14', '#1a1a1a'], null, ['#f8f2e6', '#e8dcc8', '#f2d84a'], null, ['#f2802a', '#c8501a', '#2a1a10'], null, ['#5a7ae8', '#3a4ab8', '#f8f4e0']][m];
      if (m === 2 || m === 10) { sky('#a8c8e8', '#e8d8c0'); R(0, h * .7, w, h, '#d8a878'); E(cx, h * .42, S(14), S(13), '#f2ede0'); E(cx - S(5), h * .42, S(3), S(3), '#3a2a20'); E(cx + S(5), h * .42, S(3), S(3), '#3a2a20'); L(cx - S(14), h * .3, cx - S(26), h * .18, '#e8e0d0', S(3)); L(cx + S(14), h * .3, cx + S(26), h * .18, '#e8e0d0', S(3));
        if (m === 10) { for (const dx of [-30, 30]) E(cx + dx * s, h * .7, S(6), S(5), '#e85a8a'); L(cx - S(4), h * .55, cx + S(4), h * .55, '#555', 1); } }
      else if (m === 6) { sky('#f2c88a', '#e8a060'); for (let k = 0; k < 5; k++) E(w * (k / 4), h * (.7 + (k % 2) * .08), w * .3, h * .35, ['#c84a2a', '#a83a20', '#d8603a', '#b8402a', '#c85030'][k]); }
      else if (m === 8) { sky('#7aa8e0', '#d8e8f8'); for (let k = 0; k < 14; k++) E(w * hash(k + 3), h * (.5 + hash(k + 9) * .5), S(9), S(3), '#ffffff'); }
      else { R(0, 0, w, h, m === 7 ? '#f0a8c0' : '#f4ead8'); const [a, b2, c] = fl;
        // big petals radiating from the middle, the back ones darker, each lit toward its tip, filling the page edge to edge
        for (const [ring, col, len] of [[0, b2, 34], [1, a, 27]]) for (let k = 0; k < 6; k++) {
          const an = (k + ring * .5) / 6 * 6.28 + m * .4, px2 = x + cx + Math.cos(an) * S(len * .5), py2 = y + cy + Math.sin(an) * S(len * .38);
          g.fillStyle = col; g.beginPath(); g.ellipse(px2, py2, S(len * .55), S(len * .3), an, 0, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(px2 + Math.cos(an) * S(5), py2 + Math.sin(an) * S(4), S(len * .3), S(len * .14), an, 0, 7); g.fill();
        }
        E(cx, cy, S(9), S(7), b2); E(cx, cy, S(5), S(4), c); for (let k = 0; k < 8; k++) R(cx + Math.cos(k) * S(7), cy + Math.sin(k) * S(5), 1, 1, c); }
      break; }
    case 'pizza': {
      R(0, 0, w, h, '#f4ece0'); for (let i = 0; i < w; i += S(8)) for (let j = 0; j < h; j += S(8)) if (((i + j) / S(8)) % 2 < 1) R(i, j, S(8), S(8), '#d8443a');   // the checkered tablecloth
      const r = S(24), top = [['#c8341a'], ['#c8341a'], ['#4a8a3a', '#2a6a2a'], ['#f2d040', '#e88a9a'], ['#8a6a4a'], ['#a8341a', '#6a3a2a', '#e8b8a0'], ['#c8341a', '#f6f4ee', '#2a2a3a'], ['#3a8a3a', '#f6f4ee'], ['#c8341a'], ['#2a2a1a', '#c8341a'], ['#d8b880', '#6a4a2a'], ['#3a8a3a', '#c8341a']][m];
      if (m === 1) { for (let j = -r; j <= r; j++) { const t = j / r, wd = j < 0 ? Math.round(r * (Math.sqrt(1 - (t + .5) * (t + .5) * 4 / 2.25) || 0)) : Math.round(r * (1 - t)); R(cx - wd, cy + j * .9, wd * 2, 1, '#e8a040'); } }
      else if (m === 8) { R(cx - r, cy - r * .8, r * 2, r * 1.6, '#e8a040'); R(cx - r + 2, cy - r * .8 + 2, r * 2 - 4, r * 1.6 - 4, '#f2c860'); for (let k = 1; k < 4; k++) { R(cx - r + k * r / 2, cy - r * .8, 1, r * 1.6, '#c88a30'); R(cx - r, cy - r * .8 + k * r * .4, r * 2, 1, '#c88a30'); } }
      else { E(cx, cy, r, r * .85, '#e8a040'); E(cx, cy, r - 3, r * .85 - 3, '#f2c860'); }
      for (let k = 0; k < 14; k++) { const an = hash(k + m * 9) * 6.28, d = Math.sqrt(hash(k * 3 + m)) * r * .7; E(cx + Math.cos(an) * d, cy + Math.sin(an) * d * .8, S(2.4), S(2), top[k % top.length]); }
      if (m === 9) { E(cx - S(8), cy - S(5), S(4), S(3), '#2a2a1a'); E(cx + S(8), cy - S(5), S(4), S(3), '#2a2a1a'); R(cx - S(10), cy + S(7), S(20), S(3), '#2a2a1a'); }
      break; }
    case 'anime': {
      const tint = ['#c8d8f0', '#f8c8d8', '#f2e070', '#f8d8e8', '#8a5ac8', '#5a8ae8', '#7ad0f0', '#f2a040', '#a83a2a', '#3a2a5a', '#e8c890', '#2a4a8a'][m];
      sky(tint, '#ffffff'); if ([2, 5, 7].includes(m)) for (let k = 0; k < 18; k++) { const a = k / 18 * 6.28; L(cx, cy, cx + Math.cos(a) * w, cy + Math.sin(a) * w, 'rgba(255,255,255,0.7)'); }   // speed lines
      if (m === 3) for (let k = 0; k < 20; k++) E(w * hash(k), h * hash(k + 5), 1, 1, '#f49ab8');
      if (m === 1 || m === 5 || m === 10) {                                            // the pilot (or pilots), big anime eyes
        for (const dx of m === 10 ? [-S(18), S(18)] : [0]) { E(cx + dx, cy + S(4), S(13), S(15), '#f6d2b0'); R(cx + dx - S(14), cy - S(14), S(28), S(10), m === 10 ? '#3a2a1a' : '#e8603a'); for (const ex of [-S(5), S(5)]) { E(cx + dx + ex, cy + S(3), S(3), S(4), '#2a3a8a'); R(cx + dx + ex, cy, S(1.5), S(1.5), '#ffffff'); } R(cx + dx - S(3), cy + S(11), S(6), 1, '#a03a3a'); }
        if (m === 5) R(cx + S(9), cy + S(7), S(2), S(4), '#a8e8ff');
        if (m === 1) for (let k = 0; k < 6; k++) E(w * hash(k + 2), h * hash(k + 7), S(2), S(2), '#e83a6a');
      } else {                                                                        // the robot
        const c1 = m === 4 ? '#3a3a42' : '#f4f4f4', c2 = m === 4 ? '#8a1a1a' : '#2a5ad8', c3 = '#e8c830';
        R(cx - S(12), cy - S(6), S(24), S(26), c2); R(cx - S(9), cy - S(4), S(18), S(10), c1); R(cx - S(7), cy - S(22), S(14), S(15), c1); R(cx - S(5), cy - S(16), S(10), S(3), '#f2e040');
        R(cx - S(2), cy - S(28), S(4), S(7), c3); R(cx - S(22), cy - S(4), S(9), S(20), c1); R(cx + S(13), cy - S(4) - (m === 8 ? 0 : S(8)), S(9), S(20), c1);
        R(cx - S(11), cy + S(20), S(9), S(12), c1); R(cx + S(2), cy + S(20), S(9), S(12), c1);
        if (m === 3 || m === 8) L(cx + S(26), cy - S(26), cx + S(17), cy + S(14), '#d8e0f0', S(2));
        if (m === 6) R(cx - S(7), cy - S(16), S(14), S(3), '#1a1a1a');
        if (m === 9) R(cx - S(14), cy - S(6), S(28), S(30), 'rgba(90,20,120,0.6)');
        if (m === 11) { R(cx - S(8), cy - S(28), S(16), S(6), '#d83a2a'); R(cx - S(8), cy - S(23), S(16), S(2), '#ffffff'); }
        if (m === 0) for (let k = 0; k < 25; k++) R(w * hash(k), h * hash(k + 4), 1, 1, '#ffffff');
      }
      break; }
    case 'space': {
      sky(m === 1 || m === 8 ? '#e8804a' : '#0a0a24', m === 1 || m === 8 ? '#f2c870' : '#2a1a4a');
      for (let k = 0; k < 40; k++) R(w * hash(k + m), h * hash(k * 2 + m), 1, 1, 'rgba(255,255,255,0.8)');
      const P2 = (px, py, r, col, ring) => { E(px, py, r, r, col); E(px - r * .3, py - r * .3, r * .5, r * .5, 'rgba(255,255,255,0.18)'); if (ring) { g.strokeStyle = ring; g.lineWidth = 1; g.beginPath(); g.ellipse(x + px, y + py, r * 1.9, r * .45, -.2, 0, 7); g.stroke(); } };
      if (m === 0) { P2(w * .65, h * .4, S(14), '#d8b878', '#f2e0b0'); E(w * .25, h * 1.05, w * .4, S(16), '#d8e8f8'); }
      else if (m === 1) { E(w * .35, h * .45, S(7), S(7), '#fff0a0'); E(w * .6, h * .5, S(5), S(5), '#ffe080'); R(0, h * .75, w, h, '#c8884a'); }
      else if (m === 2 || m === 5) { R(0, h * .8, w, h, m === 5 ? '#b8b8c0' : '#4a4a5a'); R(cx - S(4), h * .2, S(8), h * .6, '#d8dce8'); E(cx, h * .2, S(4), S(6), '#d8dce8'); R(cx - S(9), h * .65, S(5), S(10), '#c83a2a'); R(cx + S(4), h * .65, S(5), S(10), '#c83a2a'); if (m === 5) { R(cx + S(14), h * .45, 1, S(16), '#ddd'); R(cx + S(15), h * .45, S(8), S(5), '#d83a3a'); } }
      else if (m === 3) { for (let k = 0; k < 8; k++) E(w * hash(k + 1), h * hash(k + 6), S(18), S(10), ['rgba(200,80,200,0.35)', 'rgba(255,120,160,0.35)', 'rgba(120,80,220,0.35)'][k % 3]); }
      else if (m === 4) { g.strokeStyle = '#d8dce8'; g.lineWidth = S(3); g.beginPath(); g.ellipse(x + cx, y + cy, S(22), S(9), 0, 0, 7); g.stroke(); R(cx - 1, cy - S(9), 2, S(18), '#d8dce8'); }
      else if (m === 6) { P2(cx, cy, S(30), '#d8a070'); for (let k = -2; k <= 2; k++) R(cx - S(30), cy + k * S(7), S(60), S(2), 'rgba(160,90,50,0.5)'); E(cx + S(10), cy + S(8), S(7), S(4), '#c83a2a'); }
      else if (m === 7) { R(0, h * .7, w, h, '#3a5a2a'); for (let i = 0; i < w; i += 4) R(i, h * .7, 1, h * .3, '#5a7a3a'); E(cx, h * .3, S(16), S(4), '#b8bcc8'); E(cx, h * .25, S(6), S(4), '#a8e8f8'); g.fillStyle = 'rgba(255,255,180,0.3)'; g.beginPath(); g.moveTo(x + cx - S(6), y + h * .32); g.lineTo(x + cx + S(6), y + h * .32); g.lineTo(x + cx + S(14), y + h); g.lineTo(x + cx - S(14), y + h); g.fill(); }
      else if (m === 8) { R(0, h * .78, w, h, '#a8482a'); E(cx, h * .78, S(26), S(16), 'rgba(200,230,255,0.5)'); for (let k = 0; k < 5; k++) R(cx - S(18) + k * S(8), h * .62, S(4), S(10), '#e8eef4'); L(0, h * .7, w, h * .6, '#d8dce8', 1); }
      else if (m === 9) { E(w * .7, h * .35, S(4), S(4), '#ffffff'); for (let k = 0; k < 20; k++) R(w * .7 - k * S(2), h * .35 + k * S(.8), S(2), 1, `rgba(180,220,255,${(1 - k / 20).toFixed(2)})`); }
      else if (m === 10) { for (let k = 0; k < 16; k++) L(w * hash(k), h * hash(k + 3), w * hash(k) - S(18), h * hash(k + 3), 'rgba(255,255,255,0.6)'); R(cx - S(16), cy - S(3), S(32), S(6), '#d8dce8'); R(cx - S(20), cy - S(8), S(10), S(4), '#c8ccd8'); R(cx - S(20), cy + S(4), S(10), S(4), '#c8ccd8'); }
      else { R(0, h * .75, w, h, '#b8b8c0'); P2(cx, h * .38, S(14), '#3a6ad8'); E(cx - S(4), h * .34, S(6), S(4), '#4a9a4a'); E(cx + S(3), h * .3, S(5), S(2), '#ffffff'); }
      break; }
    case 'fantasy': {
      const night = [0, 2, 9, 10].includes(m); sky(night ? '#1a1a3a' : m === 5 ? '#f2804a' : '#7ab0e0', night ? '#3a3a6a' : m === 5 ? '#f8d070' : '#d8e8f0');
      if (night) E(w * .78, h * .25, S(7), S(7), '#f8f4d8');
      if (m === 2) L(w * .3, 0, w * .38, h * .5, '#f8f8a0', 1);
      if (m === 6) { R(0, h * .7, w, h, '#2a5a8a'); R(cx - S(14), h * .55, S(28), S(8), '#6a4a2a'); R(cx - 1, h * .25, 2, h * .32, '#6a4a2a'); R(cx, h * .3, S(10), S(10), '#f4f0e0'); for (let k = 0; k < 4; k++) E(cx - S(26) + k * S(17), h * .7, S(7), S(6), '#3a8a5a'); }
      else if (m === 3) { R(0, h * .7, w, h, '#4a8a3a'); for (let k = 0; k < 6; k++) { R(w * (k / 6) + S(4), h * .3, S(3), h * .45, '#6a4a2a'); E(w * (k / 6) + S(5), h * .3, S(9), S(10), '#5ab04a'); } }
      else if (m === 8) { R(0, 0, w, h, '#2a1a10'); E(cx, h * .6, S(20), S(10), '#f2802a'); E(cx, h * .6, S(10), S(5), '#fff0a0'); R(cx - S(16), h * .4, S(12), S(4), '#8a8a92'); }
      else {
        R(0, h * .72, w, h, night ? '#2a2a3a' : '#4a6a3a');                          // the hill, and a castle on it
        const cc = m === 0 ? '#c8e0f0' : '#8a8a98';
        R(cx - S(20), h * .4, S(40), h * .34, cc); for (const tx of [-S(24), -S(6), S(14)]) { R(cx + tx, h * .25, S(9), h * .5, cc); R(cx + tx - 1, h * .22, S(11), S(4), cc); }
        for (let k = 0; k < 4; k++) R(cx - S(16) + k * S(9), h * .5, S(3), S(5), night ? '#f8d870' : '#3a3a48');
        if (![2, 9, 10].includes(m)) {                                                  // and a dragon
          const dc = m === 0 ? '#a8d8f8' : m === 11 ? '#d83a2a' : m === 7 ? '#c8a050' : '#3a7a3a', dx = m === 4 ? cx : w * .3, dy = m === 4 ? h * .66 : h * .2;
          E(dx, dy, S(10), S(4), dc); L(dx - S(4), dy, dx - S(16), dy - S(10), dc, S(2)); L(dx + S(2), dy, dx + S(12), dy - S(12), dc, S(2)); E(dx + S(11), dy - S(2), S(3), S(2), dc);
          if (m === 11) { for (let k = 0; k < 6; k++) E(dx + S(16) + k * S(3), dy - S(2) + Math.sin(k) * 2, S(2), S(2), ['#f2c830', '#f2802a'][k % 2]); E(dx, dy, S(5), S(5), 'rgba(0,0,0,0)'); g.strokeStyle = '#2a8a3a'; g.lineWidth = 2; g.beginPath(); g.arc(x + dx, y + dy - S(6), S(4), 0, 7); g.stroke(); }
          if (m === 4) for (let k = 0; k < 10; k++) E(dx - S(14) + k * S(3), dy + S(5), S(2), S(2), '#f2d040');
        }
        if (m === 9) for (let k = 0; k < 5; k++) { const bx = w * hash(k + 1), by = h * hash(k + 9) * .4; L(bx - 2, by, bx, by + 1, '#111'); L(bx, by + 1, bx + 2, by, '#111'); }
      }
      break; }
    case 'pinup': {
      const bg = ['#a8d8f0', '#f8c8d0', '#c8e0a8', '#f8e8a0', '#f2c870', '#a8c8f0', '#f8d0a8', '#f2e8a0', '#e8d8c0', '#f2a860', '#e8b878', '#c8e8c8'][m], dress = ['#d83a3a', '#d83a3a', '#3a8ad8', '#e8708a', '#3a5aa8', '#f4f4f4', '#d83a3a', '#e8483a', '#4a6a9a', '#2a2a2a', '#8a4a2a', '#d83a3a'][m];
      R(0, 0, w, h, bg); E(cx, cy, S(26), S(26), 'rgba(255,255,255,0.45)');                // a sunburst circle, very 1955
      E(cx, cy - S(14), S(6), S(7), '#f6d2b0'); E(cx - S(4), cy - S(20), S(5), S(4), '#7a3a1a'); E(cx + S(4), cy - S(20), S(5), S(4), '#7a3a1a');   // a face and victory rolls
      R(cx - S(2), cy - S(15), S(1.5), S(1.5), '#2a2a2a'); R(cx + S(1), cy - S(15), S(1.5), S(1.5), '#2a2a2a'); R(cx - S(1), cy - S(10), S(3), 1, '#c8283a');
      for (let j = 0; j < S(26); j++) { const wd = S(5) + j * .45; R(cx - wd, cy - S(6) + j, wd * 2, 1, dress); }   // a full skirt, knee length
      if (m === 1 || m === 6) for (let k = 0; k < 10; k++) E(cx - S(8) + hash(k) * S(16), cy + hash(k + 4) * S(20), 1, 1, '#ffffff');   // polka dots
      R(cx - S(4), cy + S(20), S(2), S(8), '#f6d2b0'); R(cx + S(2), cy + S(20), S(2), S(8), '#f6d2b0');
      L(cx - S(5), cy - S(4), cx - S(14), cy - S(14), '#f6d2b0', S(2)); L(cx + S(5), cy - S(4), cx + S(12), cy + S(4), '#f6d2b0', S(2));   // waving
      const prop = [() => R(cx - S(10), cy + S(27), S(20), 1, '#a8c8e0'), () => E(cx + S(16), cy + S(2), S(7), S(6), '#e83a5a'), () => { E(cx - S(16), cy - S(18), S(10), S(4), '#3a3a3a'); L(cx - S(16), cy - S(18), cx - S(14), cy - S(2), '#3a3a3a'); }, () => L(cx + S(12), cy + S(4), cx + S(26), cy - S(6), '#a8e0f8', S(2)),
        () => L(cx + S(12), cy + S(4), cx + S(20), cy - S(4), '#9aa0ab', S(3)), () => R(cx - S(6), cy - S(24), S(12), S(3), '#f4f4f4'), () => L(cx - S(14), cy - S(14), cx - S(18), cy - S(22), '#f8f0a0', 1), () => E(cx + S(18), cy + S(10), S(6), S(6), '#e83a3a'),
        () => R(cx - S(20), cy + S(4), S(14), S(8), '#5a5a62'), () => { R(cx - S(8), cy - S(28), S(16), S(4), '#2a2a2a'); L(cx, cy - S(36), cx, cy - S(28), '#2a2a2a', S(2)); }, () => E(cx + S(16), cy + S(4), S(9), S(7), '#a8682a'), () => { R(cx - S(7), cy - S(26), S(14), S(5), '#d83a2a'); R(cx - S(7), cy - S(22), S(14), S(2), '#ffffff'); }][m];
      prop();
      break; }
    case 'kittens': {
      const bg = ['#c8d8e8', '#f8e0e8', '#a8c890', '#b8c8d8', '#d8e8b0', '#c8e0f0', '#e8e0f0', '#f0e8d8', '#f8f0c8', '#f2a860', '#e8d8c8', '#d84a3a'][m];
      R(0, 0, w, h, bg);
      const kit = (kx, ky, r, col) => { E(kx, ky, r, r * .85, col); for (const sx of [-1, 1]) { g.fillStyle = col; g.beginPath(); g.moveTo(x + kx + sx * r * .9, y + ky - r * .2); g.lineTo(x + kx + sx * r * .7, y + ky - r * 1.15); g.lineTo(x + kx + sx * r * .2, y + ky - r * .75); g.fill(); }
        for (const sx of [-1, 1]) { E(kx + sx * r * .38, ky - r * .05, r * .2, r * .24, '#2a3a2a'); R(kx + sx * r * .38, ky - r * .15, 1, 1, '#ffffff'); } R(kx - 1, ky + r * .25, 2, 1, '#e88a9a'); };
      const col = m === 9 ? '#2a2a2a' : ['#e8a060', '#b8b8c0', '#f2e8d8'][m % 3];
      if (m === 2) { L(0, h * .15, w, h * .1, '#6a4a2a', S(3)); kit(cx, h * .5, S(12), col); L(cx - S(6), h * .2, cx - S(4), h * .38, col, S(3)); L(cx + S(6), h * .2, cx + S(4), h * .38, col, S(3)); }
      else if (m === 1) { kit(cx - S(8), cy - S(2), S(10), col); kit(cx + S(8), cy - S(4), S(10), '#b8b8c0'); E(cx, cy + S(14), S(20), S(8), '#f4f4f4'); }
      else if (m === 7) { R(cx - S(30), cy + S(4), S(60), S(20), '#d8c8a0'); for (const dx of [-18, 0, 18]) kit(cx + dx * s, cy, S(9), ['#e8a060', '#b8b8c0', '#f2e8d8'][(dx / 18 + 1)]); }
      else {
        kit(cx, cy - S(2), S(14), col);
        const hold = [() => { R(cx - S(14), cy - S(18), S(28), S(7), '#d83a5a'); E(cx, cy - S(20), S(3), S(3), '#f4f4f4'); }, null, null, () => R(cx - S(12), cy + S(9), S(24), S(16), '#f2d040'), () => R(cx - S(14), cy + S(9), S(28), S(16), '#c8683a'), () => E(cx + S(26), cy + S(6), S(10), S(9), 'rgba(160,210,240,0.7)'),
          () => { R(cx - S(8), cy - S(26), S(16), S(10), '#f4f4f4'); R(cx - S(12), cy - S(17), S(24), S(3), '#3a5aa8'); }, null, () => R(cx - S(10), cy + S(9), S(20), S(16), '#3a8ad8'), () => E(cx, cy + S(16), S(22), S(13), '#f2802a'), () => E(cx + S(22), cy + S(10), S(8), S(8), '#d84a8a'), () => R(cx - S(12), cy + S(9), S(24), S(16), '#f4f4f4')][m];
        if (hold) hold();
      }
      break; }
    case 'synergy': {
      R(0, 0, w, h, '#0a0a0a'); const ph = { x: S(6), y: S(3), w: w - S(12), h: h - S(15) };
      const bgc = ['#f2c890', '#f2b070', '#7ab0d8', '#5a7a9a', '#8ab8e8', '#c8a878', '#1a1a3a', '#3a4a5a', '#d8e8f8', '#e8a040', '#a8c8e8', '#1a1010'][m];
      R(ph.x, ph.y, ph.w, ph.h, bgc); const X = ph.x, Y = ph.y, W = ph.w, H = ph.h;
      const art = [() => { g.fillStyle = '#6a6a7a'; g.beginPath(); g.moveTo(x + X, y + Y + H); g.lineTo(x + X + W / 2, y + Y + H * .2); g.lineTo(x + X + W, y + Y + H); g.fill(); R(X + W / 2 - 2, Y + H * .2, 4, 3, '#ffffff'); },
        () => { E(X + W / 2, Y + H * .9, W * .2, H * .3, '#f8e070'); R(X + W * .3, Y + H * .55, W * .4, H * .12, '#e8b890'); },
        () => { R(X, Y + H * .65, W, H * .35, '#2a5a8a'); R(X + W * .2, Y + H * .55, W * .6, 3, '#f4f4f4'); for (let k = 0; k < 6; k++) L(X + W * .25 + k * W * .1, Y + H * .55, X + W * .2 + k * W * .1, Y + H * .8, '#c8a050'); },
        () => { for (const r2 of [4, 9, 14]) { g.strokeStyle = 'rgba(220,240,255,0.7)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x + X + W / 2, y + Y + H * .7, r2 * s * 1.6, r2 * s * .4, 0, 0, 7); g.stroke(); } },
        () => { L(X + W * .3, Y + H * .4, X + W * .5, Y + H * .5, '#4a3a2a', S(3)); L(X + W * .5, Y + H * .5, X + W * .7, Y + H * .4, '#4a3a2a', S(3)); E(X + W * .5, Y + H * .5, S(3), S(2), '#f4f4f4'); },
        () => { R(X + W * .6, Y, W * .4, H, '#8a7a6a'); L(X + W * .62, Y, X + W * .55, Y + H * .6, '#f2f2f2'); E(X + W * .55, Y + H * .65, S(3), S(4), '#d83a2a'); },
        () => { for (let k = 0; k < 4; k++) for (let a = 0; a < 6.28; a += .5) R(X + W * (.2 + k * .2) + Math.cos(a) * S(6), Y + H * .35 + Math.sin(a) * S(6), 1, 1, ['#f8d040', '#e84a8a', '#4ad8f8', '#f8f8f8'][k]); R(X, Y + H * .8, W, H * .2, '#2a2a3a'); },
        () => { R(X, Y + H * .75, W, H * .25, '#2a3a4a'); R(X + W * .48, Y + H * .3, W * .06, H * .45, '#f4f4f4'); R(X + W * .48, Y + H * .4, W * .06, H * .06, '#d83a2a'); L(X + W * .51, Y + H * .32, X + W * .9, Y + H * .1, 'rgba(255,250,180,0.6)', S(2)); },
        () => { R(X, Y + H * .75, W, H * .25, '#f4f8fc'); for (let k = 0; k < 6; k++) { E(X + W * .3 + k * W * .08, Y + H * .62, S(3), S(6), '#1a1a1a'); E(X + W * .3 + k * W * .08, Y + H * .64, S(2), S(4), '#f4f4f4'); } },
        () => { R(X, Y + H * .55, W, H * .45, '#8a4a2a'); g.fillStyle = '#5a5a62'; g.beginPath(); g.moveTo(x + X + W * .45, y + Y + H * .55); g.lineTo(x + X + W * .55, y + Y + H * .55); g.lineTo(x + X + W * .8, y + Y + H); g.lineTo(x + X + W * .2, y + Y + H); g.fill(); },
        () => { for (let k = 0; k < 7; k++) { const gx = X + W * .5 + (k - 3) * S(6), gy = Y + H * .3 + Math.abs(k - 3) * S(4); L(gx - 2, gy, gx, gy + 1, '#2a2a2a'); L(gx, gy + 1, gx + 2, gy, '#2a2a2a'); } },
        () => { E(X + W / 2, Y + H * .55, S(14), S(14), 'rgba(255,200,100,0.25)'); R(X + W / 2 - S(2), Y + H * .5, S(4), S(10), '#f4ecd8'); E(X + W / 2, Y + H * .45, S(1.5), S(3), '#f8c040'); }][m];
      art();
      crispText(g, CAL_WORDS[m], x + cx, y + h - S(3), Math.max(8, Math.round(S(8) / 8) * 8), '#f4f4f4');
      break; }
  }
  g.restore();
}

/* ---------- the calendar, as a thing ---------- */
const Calendar = {
  get st() { return Game.cal || (Game.cal = this.fresh()); },
  fresh() { const md = moveOutDay(); return { theme: pick(CAL_THEMES).id, m: md.m, flips: 0 }; },
  reset() { Game.cal = this.fresh(); },
  theme(id) { return CAL_THEMES.find(t => t.id === (id || this.st.theme)) || CAL_THEMES[0]; },
  onWall() { return !Game.opened.calTaken; },
  describe() {
    const t = this.theme(), m = this.st.m, md = moveOutDay();
    return `${t.look} It's open to ${CAL_MONTHS[m]} ${CAL_YEAR}: ${t.months[m]}` + (m === md.m ? ` The ${ordinal(md.d)} is circled in red: 'MOVE OUT!!!'` : '');
  },
  /* flip forward (or back); past December there's nothing left, so it offers to come down */
  flip(dir = 1) {
    const st = this.st, t = this.theme();
    if (dir < 0) {
      if (st.m === 0) return "You're on January already. There's no page before January.";
      st.m--; Audio2.sfx('swish', .5); Rooms.invalidate('kitchen');
      return `You flip back to ${CAL_MONTHS[st.m]}: ${t.months[st.m]}`;
    }
    if (st.m >= 11) { setTimeout(() => this.offer(), 50); return "That's December. There's nothing left to flip."; }
    st.m++; st.flips++; Audio2.sfx('swish', .5); Rooms.invalidate('kitchen');
    if (st.m === 11) Achievements.unlock('calendar');
    return `You flip to ${CAL_MONTHS[st.m]}. ${t.months[st.m]}` + (st.m === 11 ? ' The last page.' : '');
  },
  offer() {
    const t = this.theme();
    UI.confirm(`The ${t.name} calendar is out of months. Take it down and put it in your bag?`, 'Take it down', () => this.take(), 'Leave it up', () => { this.st.m = 11; });
  },
  take() {
    const t = this.theme(); Game.opened.calTaken = true;
    Bag.add(`calendar|${t.name}|11`);
    Rooms.invalidate('kitchen'); Game.refreshHots();
    if (UI.isOpen('inspectScreen') && Inspect.fid === 'calendar') UI.close('inspectScreen');
    Game.tell(`You lift the ${t.name} calendar off its nail and roll it into your bag. There's a cleaner rectangle of paint where it hung.`);
  }
};

/* the close-up: a nail, the picture page on top, a wire binding, and the month grid below, the same height */
ZOOM_ART.calendar = (g, v, fl, t) => {
  Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('kitchen', 'left'), 31);
  const th = Calendar.theme(), m = Calendar.st.m, x0 = 62, w = 116, md = moveOutDay();
  pxRect(g, x0 + 2, 6, w, 128, 'rgba(40,30,20,0.18)');                                       // its shadow on the wall
  pxRect(g, 119, 1, 2, 3, '#7a7a82'); pxRect(g, 118, 1, 4, 1, '#a8a8b0');                    // the nail
  pxRect(g, x0, 4, w, 62, '#f8f6f0'); calPicture(g, th, m, x0 + 3, 7, w - 6, 56);             // the picture page
  pxRect(g, x0, 65, w, 3, '#d8d4c8'); for (let i = x0 + 4; i < x0 + w - 2; i += 4) { pxRect(g, i, 64, 2, 5, '#8a8e98'); pxRect(g, i, 64, 1, 1, '#c8ccd4'); }   // the wire binding
  pxRect(g, x0, 68, w, 64, '#fbfaf5');                                                       // the grid page
  crispText(g, `${CAL_MONTHS[m].toUpperCase()} ${CAL_YEAR}`, x0 + w / 2, 77, 8, '#2a2430');
  const cw = 16, gx = x0 + 2, gy = 83, first = new Date(CAL_YEAR, m, 1).getDay(), days = new Date(CAL_YEAR, m + 1, 0).getDate(), rows = Math.ceil((first + days) / 7), ch = Math.floor(42 / rows);
  'SMTWTFS'.split('').forEach((d, i) => calText(g, d, gx + i * cw + 6, 79 + 0, i === 0 ? '#c0372a' : '#6a6478'));
  const gh = rows * ch;
  for (let i = 0; i <= 7; i++) pxRect(g, gx + i * cw, 85, 1, gh + 1, '#c8c4d0');            // the grid: evenly spaced both ways
  for (let j = 0; j <= rows; j++) pxRect(g, gx, 85 + j * ch, 7 * cw + 1, 1, '#c8c4d0');
  for (let d = 1; d <= days; d++) {
    const k = first + d - 1, cx = gx + (k % 7) * cw, cy = 85 + Math.floor(k / 7) * ch;
    calText(g, d, cx + 2, cy + 2, k % 7 === 0 ? '#c0372a' : '#3a3444');
    if (m === md.m && d === md.d) { g.strokeStyle = '#d42a1a'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx + cw / 2 + .5, cy + ch / 2 + .5, 8, ch / 2 + 1, -.1, 0, 7); g.stroke(); }
  }
  // the page corners: the bottom-right one curls up a little, ready to flip
  g.fillStyle = '#e8e4d8'; g.beginPath(); g.moveTo(x0 + w, 124); g.lineTo(x0 + w - 8, 132); g.lineTo(x0 + w, 132); g.fill(); pxLine(g, x0 + w - 8, 132, x0 + w, 124, '#b8b4a8');
  if (m > 0) { pxRect(g, x0, 131, 6, 1, '#d8d4c8'); }
  Z.vignette(g);
};
/* in the room: the same calendar, small, on the kitchen's left wall (or a clean patch of paint once it's taken) */
function drawWallCalendar(g, r) {
  const za = 10.25, zb = 10.95, x0 = r.box.x0, lw = (y1, z1, y2, z2, c) => lineW(g, P(x0, y1, z1), P(x0, y2, z2), c);
  if (!Calendar.onWall()) { fillPoly(g, Q.left(r.box, za, zb, 1.42, 2.52), 'rgba(255,255,255,0.10)'); const n = P(x0, 2.55, (za + zb) / 2); pxRect(g, n[0], n[1], 1, 2, '#7a7a82'); return; }
  const th = Calendar.theme(), m = Calendar.st.m, top = Q.left(r.box, za, zb, 2.0, 2.52), b = polyBox(top);
  fillPoly(g, Q.left(r.box, za, zb, 1.42, 2.52), '#f8f6f0');
  // the picture: the same painting as the close-up, squeezed onto the wall's slant
  const c = document.createElement('canvas'); c.width = 116; c.height = 58; calPicture(c.getContext('2d'), th, m, 0, 0, 116, 58);
  g.save(); poly(g, Q.left(r.box, za + .03, zb - .03, 2.03, 2.49)); g.clip();
  g.imageSmoothingEnabled = true; g.drawImage(c, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.imageSmoothingEnabled = false; g.restore();
  lw(1.985, za, 1.985, zb, '#8a8e98');                                                           // the binding
  fillPoly(g, Q.left(r.box, za + .03, zb - .03, 1.88, 1.95), '#b8b4c0');                         // the month name
  for (let i = 0; i <= 7; i++) { const z = za + .03 + (zb - za - .06) * i / 7; lw(1.45, z, 1.86, z, '#d2ced8'); }   // the grid, both ways, evenly
  for (let j = 0; j <= 5; j++) { const y = 1.45 + .41 * j / 5; lw(y, za + .03, y, zb - .03, '#d2ced8'); }
  const md = moveOutDay(); if (m === md.m) { const k = new Date(CAL_YEAR, m, 1).getDay() + md.d - 1, p = P(x0, 1.86 - .41 * (Math.floor(k / 7) + .5) / 5, za + .03 + (zb - za - .06) * ((k % 7) + .5) / 7); pxRect(g, p[0] - 1, p[1] - 1, 3, 2, '#d42a1a'); }
  strokePoly(g, Q.left(r.box, za, zb, 1.42, 2.52), 'rgba(80,70,80,0.35)');
  const n = P(x0, 2.55, (za + zb) / 2); pxRect(g, n[0], n[1], 1, 2, '#7a7a82');
}

/* the calendar as a close-up view (never on the form), plus its part of the wall */
VIEWS.calendar = { id: 'calendar', room: 'kitchen', name: 'Wall Calendar', art: 'calendar', view: true,
  parts: [
    { id: 'next', name: 'page corner', r: [160, 116, 20, 18], act: tool => tool === 'touch' || tool === 'walk' ? Calendar.flip(1) : tool === 'look' ? 'The corner of the page, curled from being flipped. Touch it to turn the page.' : null },
    { id: 'prev', name: 'bottom-left corner', r: [60, 116, 20, 18], act: tool => tool === 'touch' ? Calendar.flip(-1) : tool === 'look' ? 'Touch this corner to flip back a month.' : null },
    { id: 'picture', name: 'picture', r: [62, 4, 116, 62], act: tool => { const f = { look: () => Calendar.theme().months[Calendar.st.m], touch: () => Calendar.flip(1), smell: () => Calendar.theme().smell, talk: () => 'You compliment the picture. It takes it well.' }[tool]; return f ? f() : null; } },
    { id: 'grid', name: 'dates', r: [62, 68, 116, 48], act: tool => {
      const m = Calendar.st.m, md = moveOutDay();
      if (tool === 'look') return m === md.m ? `${CAL_MONTHS[m]} ${CAL_YEAR}. The ${ordinal(md.d)} is circled in red: 'MOVE OUT!!!' Nothing else written all month.` : `${CAL_MONTHS[m]} ${CAL_YEAR}. Not a single thing written on it.`;
      if (tool === 'touch') return Calendar.flip(1);
      if (tool === 'pencil') return `You write 'INSPECTED' on today's square. Very official. Nobody will ever see it.`;
      return null; } }
  ],
  base: {}, variants: [{ cat: 0, get desc() { return Calendar.describe(); }, key: [], resp: {}, why: '' }] };
FEATURE.calendar = VIEWS.calendar;
ROOMS.kitchen.features.calendar = { pts: () => Q.left(ROOMS.kitchen.box, 10.2, 11, 1.4, 2.6), walk: { x: -4.2, z: 10.2 }, when: () => Calendar.onWall() };
ROOM_TOUCH.calendar = 'next';                                                                   // a plain click flips it, too

/* in the bag: the same calendar, still on December */
CLUTTER.calendar = { name: 'Wall calendar', multi: true,
  look: c => { const t = CAL_THEMES.find(x => x.name === c.title) || CAL_THEMES[0]; return t.bag; },
  bagLook: c => { const t = CAL_THEMES.find(x => x.name === c.title) || CAL_THEMES[0]; return `${t.bag} It's on December: ${t.months[11]}`; },
  bagTouch: c => (CAL_THEMES.find(x => x.name === c.title) || CAL_THEMES[0]).touch,
  smell: c => (CAL_THEMES.find(x => x.name === c.title) || CAL_THEMES[0]).smell,
  draw: (g, x, y, k, c) => {
    const t = CAL_THEMES.find(q => q.name === (c && c.title)) || CAL_THEMES[0], W = 8 * k, H = 10 * k, x0 = Math.round(x - W / 2), y0 = Math.round(y - H);
    pxRect(g, x0 - 1, y0 - 1, W + 2, H + 2, '#4a4450'); pxRect(g, x0, y0, W, H, '#f8f6f0');
    calPicture(g, t, 11, x0 + 1, y0 + 1, W - 2, H / 2 - 2);
    pxRect(g, x0, y0 + H / 2 - 1, W, 1, '#8a8e98');
    for (let i = 1; i < 7; i++) pxRect(g, x0 + Math.round(i * W / 7), y0 + H / 2 + 1, 1, H / 2 - 2, '#d2ced8');
    for (let j = 1; j < 5; j++) pxRect(g, x0 + 1, y0 + H / 2 + Math.round(j * (H / 2) / 5), W - 2, 1, '#d2ced8');
  } };
