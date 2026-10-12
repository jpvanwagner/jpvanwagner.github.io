'use strict';
/* ============================== MARGIN DOODLES ==============================
   Using the pencil on something with nothing to write down doodles in the margin of your field notes, and the doodle
   actually stays there: the same notepad shows up in every close-up. The margin has room for a handful; once it's
   full, there's nowhere left to doodle and the game gently points out that you're stalling. Graphite pixel art,
   12x12, each set down at a slight angle. */
const DOODLE_ART = {
  house: { name: 'house', rows: ['.....##.....', '....#..#....', '...#....#...', '..#......#..', '.#........#.', '############', '.#........#.', '.#.##..##.#.', '.#.##..##.#.', '.#........#.', '.#...##...#.', '.##########.'] },
  cat: { name: 'cat', rows: ['............', '.#.......#..', '.##.....##..', '.#.#####.#..', '.#.......#..', '.#.#...#.#..', '.#...#...#..', '.#..###..#..', '..#.....#..#', '...#####...#', '...#...#..#.', '...##.##.#..'] },
  star: { name: 'star', rows: ['.....##.....', '.....##.....', '....#..#....', '....#..#....', '############', '.#........#.', '..#......#..', '...#....#...', '...#.##.#...', '..#.#..#.#..', '..##....##..', '.#........#.'] },
  smile: { name: 'smiley face', rows: ['...######...', '..#......#..', '.#........#.', '#..##..##..#', '#..##..##..#', '#..........#', '#..........#', '#.#......#.#', '#..#....#..#', '.#..####..#.', '..#......#..', '...######...'] },
  spiral: { name: 'spiral', rows: ['..########..', '.#........#.', '#..######..#', '#.#......#.#', '#.#.####.#.#', '#.#.#..#.#.#', '#.#.#.##.#.#', '#.#.#....#.#', '#.#..####..#', '#..#.......#', '.#..#######.', '..#.........'] },
  flower: { name: 'flower', rows: ['....####....', '...#....#...', '.###.##.###.', '#..#.##.#..#', '#....##....#', '.###....###.', '...#.##.#...', '....####....', '.....#......', '..##.#......', '...###......', '.....#......'] },
  cube: { name: 'cube', rows: ['...#########', '..#.......##', '.#.......#.#', '#########..#', '#.......#..#', '#.......#..#', '#.......#..#', '#.......#..#', '#.......#.#.', '#.......##..', '#########...', '............'] },
  sun: { name: 'sun', rows: ['.....#......', '.#...#...#..', '..#.....#...', '....###.....', '...#...#....', '##.#...#.##.', '...#...#....', '....###.....', '..#.....#...', '.#...#...#..', '.....#......', '............'] },
  liger: { name: 'liger (bred for its skills in magic)', rows: ['#..######..#', '##########..', '.#........#.', '#..#....#..#', '#..........#', '#....##....#', '#...####...#', '.#...##...#.', '.#.#....#.#.', '..#.####.#..', '...#....#...', '....####....'] },
  heart: { name: 'heart', rows: ['............', '.###....###.', '#...#..#...#', '#....##....#', '#..........#', '#..........#', '.#........#.', '..#......#..', '...#....#...', '....#..#....', '.....##.....', '............'] }
};
/* where a doodle can go on the notepad: the right-hand margin, top to bottom, then beside the heading. % of the panel */
const DOODLE_SLOTS = [[84, 4], [86, 17], [83, 30], [87, 43], [84, 56], [86, 69], [83, 82], [58, 2]];
const Doodles = {
  list: [],
  reset() { this.list = []; this.paint(); },
  full() { return this.list.length >= DOODLE_SLOTS.length; },
  /* the pencil had nothing to write: add a doodle (or admit there's no room left) and say so */
  add() {
    if (this.full()) return "There's no space left to doodle, and you're stalling.";
    const used = new Set(this.list.map(d => d.kind)), left = Object.keys(DOODLE_ART).filter(k => !used.has(k));
    const kind = pick(left.length ? left : Object.keys(DOODLE_ART));
    this.list.push({ kind, tilt: Math.round((Math.random() * 2 - 1) * 14) });
    this.paint(); if (this.full()) Achievements.unlock('margin');
    const n = DOODLE_SLOTS.length - this.list.length;
    return `You doodle a tiny ${DOODLE_ART[kind].name} in the margin of your notes instead.` + (n === 1 ? ' Room for one more.' : n === 0 ? ' The margin is full now.' : '');
  },
  /* draw every doodle into the notes panel of the close-up */
  paint() {
    const side = document.querySelector('.inspect-side'); if (!side) return;
    let box = side.querySelector('.doodles');
    if (!box) { box = document.createElement('div'); box.className = 'doodles'; box.setAttribute('aria-hidden', 'true'); side.append(box); }
    side.classList.toggle('has-doodles', this.list.length > 0);
    box.replaceChildren(...this.list.map((d, i) => {
      const art = DOODLE_ART[d.kind], c = document.createElement('canvas'); c.width = c.height = 12;
      const g = c.getContext('2d'); g.fillStyle = '#5d6170';
      art.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') g.fillRect(x, y, 1, 1); }));
      const [x, y] = DOODLE_SLOTS[i]; c.style.left = `calc(${x}% - ${(x / 100 * 5.4).toFixed(2)} * var(--u))`; c.style.top = `calc(${y}% - ${(y / 100 * 5.4).toFixed(2)} * var(--u))`;   // stays inside the panel at any size c.style.transform = `rotate(${d.tilt}deg)`;
      return c;
    }));
  }
};
