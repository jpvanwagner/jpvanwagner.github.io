/* JS/DATA.JS - Everything you might want to tune: the calendar, the audiences, the rooms'
   gameplay rules, the program cards, and the social-feed text. No logic lives here.

   ROOMS come from the Mapster map (maps/library.html). Each zone painted in Mapster is a room;
   ROOM_RULES below adds the gameplay side (capacity, noise behaviour, who it's for), keyed by
   the zone's id. A zone you add in Mapster that isn't listed here still works: it gets a
   capacity from its size and is treated as an ordinary public room. */

window.GameData = (function () {

  // ---------------------------------------------------------------- calendar & clock
  const CALENDAR = {
    yearName: 'Programming Year 2026\u201327',
    startDate: [2026, 8, 7],          // year, month (0-based), day: Monday, Sept 7
    weeks: 52,
    // four quarters; the Board gets a short report after each and reviews the whole year at the end
    quarters: [
      { name: 'Fall Quarter', short: 'Fall', first: 1, last: 13 },
      { name: 'Winter Quarter', short: 'Winter', first: 14, last: 26 },
      { name: 'Spring Quarter', short: 'Spring', first: 27, last: 39 },
      { name: 'Summer Quarter', short: 'Summer', first: 40, last: 52 },
    ],
    // days the library is closed (it opens Monday to Saturday; these are the holidays that land on those days)
    holidays: [
      [2026, 10, 26, 'Thanksgiving'], [2026, 10, 27, 'Day after Thanksgiving'],
      [2026, 11, 24, 'Christmas Eve'], [2026, 11, 25, 'Christmas Day'], [2027, 0, 1, 'New Year\u2019s Day'],
      [2027, 0, 18, 'Martin Luther King Jr. Day'], [2027, 4, 31, 'Memorial Day'], [2027, 5, 18, 'Juneteenth (observed)'],
      [2027, 6, 5, 'Independence Day (observed)'],
    ],
    // school's out: kids and teens are free all day, and the schools are closed for programs
    schoolBreaks: [
      [[2026, 10, 25], [2026, 10, 27], 'Thanksgiving break'],
      [[2026, 11, 21], [2027, 0, 1], 'Winter break'],
      [[2027, 2, 15], [2027, 2, 19], 'Spring break'],
      [[2027, 5, 11], [2027, 7, 20], 'Summer vacation'],
    ],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    dayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    // opening hours in minutes after midnight, per day index (Saturday is short)
    hours: [[540, 1200], [540, 1200], [540, 1200], [540, 1200], [540, 1200], [600, 1020]],
    // game minutes per real second at 1x
    minutesPerSecond: 3,
    speeds: [0.5, 1, 2, 4, 8],          // keys 1-5
  };

  // ---------------------------------------------------------------- dates
  const MS_DAY = 86400000;
  const DATE0 = Date.UTC(CALENDAR.startDate[0], CALENDAR.startDate[1], CALENDAR.startDate[2]);
  const utc = (y, m, d) => Date.UTC(y, m, d);
  // week 1..52, day 0..5 (Mon..Sat) -> a local Date
  function dateOf(week, day) { const [y, m, d] = CALENDAR.startDate; return new Date(y, m, d + (week - 1) * 7 + day); }
  // a calendar date -> { week, day } (day 6 = a Sunday, which isn't on the calendar)
  function weekDayOf(y, m, d) { const n = Math.round((utc(y, m, d) - DATE0) / MS_DAY); return { week: Math.floor(n / 7) + 1, day: ((n % 7) + 7) % 7 }; }
  const dayKey = (week, day) => week * 10 + day;
  const HOLIDAY = {};
  CALENDAR.holidays.forEach(([y, m, d, name]) => { const w = weekDayOf(y, m, d); HOLIDAY[dayKey(w.week, w.day)] = name; });
  // the holiday that closes the library that day, or null
  function holidayOn(week, day) { return HOLIDAY[dayKey(week, day)] || null; }
  // the school break that covers that day, or null (Saturdays count as out of school anyway)
  function schoolBreak(week, day) {
    const t = dateOf(week, day).getTime();
    const b = CALENDAR.schoolBreaks.find(([a, z]) => t >= new Date(a[0], a[1], a[2]).getTime() && t <= new Date(z[0], z[1], z[2]).getTime());
    return b ? b[2] : null;
  }
  function quarterOf(week) { return CALENDAR.quarters.find(q => week >= q.first && week <= q.last) || CALENDAR.quarters[CALENDAR.quarters.length - 1]; }
  const monthOf = (week, day) => dateOf(week, day).getMonth() + 1;   // 1..12
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // is month m (1..12) inside [from, to]? (wraps past December: [12, 1] is December and January)
  const inMonths = (m, r) => r[0] <= r[1] ? (m >= r[0] && m <= r[1]) : (m >= r[0] || m <= r[1]);
  // weather for outdoor programs, by month: winter keeps people home
  const OUTDOOR_WEATHER = { 1: 0.4, 2: 0.45, 3: 0.7, 4: 0.9, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 0.9, 11: 0.65, 12: 0.4 };

  // ---------------------------------------------------------------- town
  // City population scales everyday traffic and the pool a program draws from. The rooms
  // don't get any bigger, so a big city fills them faster. Set it on the title screen or in Settings.
  const POPULATION = { default: 30000, min: 2000, max: 500000,
    presets: [[8000, 'Small town'], [30000, 'Town'], [90000, 'Small city'], [250000, 'City']] };
  let popFactor = 1;
  function setPopulation(n) { popFactor = Math.pow(Math.max(POPULATION.min, Math.min(POPULATION.max, n || POPULATION.default)) / POPULATION.default, 0.55); }
  const population = () => popFactor;

  // program time slots
  const SLOTS = [
    { id: 'morning', label: 'Morning', time: 600 },       // 10:00
    { id: 'afternoon', label: 'Afternoon', time: 780 },   // 1:00
    { id: 'afterschool', label: 'After School', time: 930 }, // 3:30
    { id: 'evening', label: 'Evening', time: 1110, noSaturday: true }, // 6:30
  ];

  // ---------------------------------------------------------------- budget & staff
  const START = {
    budget: 24000,                  // the year's programming budget (about $6,000 a quarter)
    staffHoursPerWeek: 14,          // program prep + run time the team can absorb each week
    goodwill: { seniors: 68, adults: 62, teens: 44, toddlers: 60 },
    circulation: 0,
  };

  // ---------------------------------------------------------------- audiences
  // share = share of the town (weights the overall Goodwill score)
  // speed = tiles per game minute on the map; patience = how long they put up with noise/crowds
  // checkout = chance a regular visitor leaves with something
  const DEMOGRAPHICS = {
    seniors: { label: 'Seniors', emoji: '1f475', color: '#f2c14e', share: 0.22, speed: 1.0, patience: 70, checkout: 0.6, noiseSensitivity: 1.5 },
    adults: { label: 'Adults', emoji: '1f4bc', color: '#4cc9f0', share: 0.38, speed: 1.5, patience: 90, checkout: 0.5, noiseSensitivity: 1.0 },
    teens: { label: 'Teens', emoji: '1f392', color: '#b388ff', share: 0.15, speed: 2.0, patience: 110, checkout: 0.25, noiseSensitivity: 0.4 },
    toddlers: { label: 'Toddlers', emoji: '1f476', color: '#ff7aa2', share: 0.25, speed: 1.2, patience: 80, checkout: 0.8, noiseSensitivity: 0.2, withCaregiver: true },
  };
  const DEMO_KEYS = Object.keys(DEMOGRAPHICS);

  // How many of each audience are around at each program slot (1 = everyone who'd come, can).
  const SLOT_AVAILABILITY = {
    weekday: {
      morning: { seniors: 1.0, adults: 0.45, teens: 0.05, toddlers: 1.0 },
      afternoon: { seniors: 0.85, adults: 0.45, teens: 0.1, toddlers: 0.5 },
      afterschool: { seniors: 0.4, adults: 0.55, teens: 1.0, toddlers: 0.6 },
      evening: { seniors: 0.3, adults: 1.0, teens: 0.65, toddlers: 0.25 },
    },
    saturday: {
      morning: { seniors: 0.7, adults: 0.8, teens: 0.35, toddlers: 1.0 },
      afternoon: { seniors: 0.6, adults: 0.85, teens: 0.85, toddlers: 0.7 },
      afterschool: { seniors: 0.45, adults: 0.7, teens: 0.9, toddlers: 0.55 },
      evening: { seniors: 0, adults: 0, teens: 0, toddlers: 0 },
    },
    // a weekday when school's out (winter, spring and summer breaks): kids and teens are around all day
    schoolout: {
      morning: { seniors: 1.0, adults: 0.45, teens: 0.45, toddlers: 1.0 },
      afternoon: { seniors: 0.85, adults: 0.45, teens: 0.9, toddlers: 0.8 },
      afterschool: { seniors: 0.4, adults: 0.55, teens: 0.9, toddlers: 0.7 },
      evening: { seniors: 0.3, adults: 1.0, teens: 0.7, toddlers: 0.25 },
    },
  };
  // which availability table a day uses
  const dayType = (week, day) => day === 5 ? 'saturday' : schoolBreak(week, day) ? 'schoolout' : 'weekday';

  // Everyday (unprogrammed) visitors arriving per hour, by audience. [fromHour, toHour, perHour]
  const PASSIVE_TRAFFIC = {
    weekday: {
      seniors: [[9, 12, 6], [12, 15, 5], [15, 17, 2], [17, 20, 1]],
      adults: [[9, 12, 4], [12, 14, 6], [14, 17, 4], [17, 20, 7]],
      teens: [[9, 15, 0.5], [15, 18, 17], [18, 20, 5]],
      toddlers: [[9, 12, 5], [12, 15, 2], [15, 18, 3], [18, 20, 1]],
    },
    saturday: {
      seniors: [[10, 17, 4]],
      adults: [[10, 17, 7]],
      teens: [[10, 12, 2], [12, 17, 7]],
      toddlers: [[10, 13, 7], [13, 17, 4]],
    },
    schoolout: {
      seniors: [[9, 12, 6], [12, 15, 5], [15, 17, 2], [17, 20, 1]],
      adults: [[9, 12, 4], [12, 14, 6], [14, 17, 4], [17, 20, 7]],
      teens: [[9, 12, 3], [12, 17, 9], [17, 20, 4]],
      toddlers: [[9, 12, 7], [12, 15, 4], [15, 18, 3], [18, 20, 1]],
    },
  };

  // Where everyday visitors like to go (zone id -> weight). Rooms missing from the map are skipped.
  const ROOM_PREFERENCES = {
    seniors: { reference: 0.35, browse: 0.2, pclab: 0.15, entry: 0.12, bookshop: 0.08, study: 0.05, plaza: 0.05 },
    adults: { reference: 0.2, pclab: 0.2, browse: 0.15, study: 0.15, entry: 0.12, bookshop: 0.08, plaza: 0.1 },
    teens: { teen: 0.7, pclab: 0.15, entry: 0.1, study: 0.05 },
    toddlers: { children: 0.85, entry: 0.15 },
  };
  // When a teen's first choice is full, these are where they spill over (and get loud).
  const TEEN_OVERFLOW = ['pclab', 'hall2', 'reference', 'study', 'entry'];

  // ---------------------------------------------------------------- rooms
  // tags: quiet / study  -> visitors here want silence (noise drains their patience)
  //       loud           -> noise is expected here
  //       soundproof     -> noise from a program here stays in the room
  //       staff          -> off-limits to the public (programs here are a bad idea unless it's a tour)
  //       utility        -> never a program space
  const ROOM_RULES = {
    plaza: { capacity: 120, tags: ['outdoor', 'loud', 'busy', 'public'], blurb: 'Where everyone arrives. Big, open and outdoors: good for sales and sign-up tables.' },
    entry: { capacity: 40, tags: ['loud', 'busy', 'public'], blurb: 'High traffic and never quiet. Passive programs catch everyone walking in.' },
    children: { capacity: 40, tags: ['loud', 'kids', 'public'], blurb: 'Loud by design. Ideal for toddlers and their grown-ups.' },
    browse: { capacity: 20, tags: ['public'], blurb: 'New books, magazines and armchairs, just off the main hall. Calm but not silent.' },
    bookshop: { capacity: 12, tags: ['small', 'public'], blurb: 'The Friends of the Library shop: used books for a dollar or two, all proceeds to programs.' },
    teen: { capacity: 38, tags: ['loud', 'teen', 'public'], blurb: 'Upstairs, away from the quiet rooms. Packed after 3:00 on school days.' },
    pclab: { capacity: 16, tags: ['quiet', 'tech', 'public'], blurb: 'Quiet, with computers. Upstairs, between the landing and the teen zone.' },
    reference: { capacity: 30, tags: ['quiet', 'study', 'public'], blurb: 'Quiet study and magazines, upstairs. Very sensitive to noise.' },
    study: { capacity: 8, tags: ['quiet', 'study', 'small', 'public'], blurb: 'Three bookable rooms off Reference. Tiny and silent.' },
    restrooms: { capacity: 6, tags: ['utility'], blurb: 'Just restrooms.' },
    restrooms2: { capacity: 6, tags: ['utility'], blurb: 'Just restrooms (upstairs).' },
    program: { capacity: 60, tags: ['program', 'soundproof', 'public'], blurb: 'Big and soundproof, right off the entryway: programs here never disturb the rest of the library.' },
    hall: { capacity: 20, tags: ['transit', 'public'], blurb: 'The main hall: the stairs and the elevator. People pass through.' },
    hall2: { capacity: 20, tags: ['transit', 'public'], blurb: 'The upstairs landing, between Reference, the PC Lab and the Teen Zone. People pass through, and so does noise.' },
    stairwell: { capacity: 4, tags: ['staff', 'utility'], blurb: 'Staff stairs to the basement.' },
    stacks: { capacity: 14, tags: ['staff', 'storage'], blurb: 'Closed stacks in the basement. Staff only, except on a tour.' },
    offices: { capacity: 10, tags: ['staff'], blurb: 'Staff offices. Off-limits.' },
    breakroom: { capacity: 8, tags: ['staff'], blurb: 'The staff break room. Off-limits (and it has the good coffee).' },
    storage: { capacity: 10, tags: ['staff', 'storage'], blurb: 'Racks of book-sale donations, holiday decorations and spare chairs. Staff only (tours welcome).' },
  };

  // ---------------------------------------------------------------- off-site venues
  // Programs can also go out into the community. A venue isn't on the map: no patrons walk
  // there, nobody in the library hears it, and turnout is rolled from the projection.
  //   draw     how well a program there reaches each audience, compared with the library
  //   travel   extra staff hours (loading the van, setting up, getting back)
  //   fee      room or permit fee, added to the program's cost
  //   classes  school slots when a class can come to you: the school brings the audience
  //            (classAudience), so marketing hardly matters
  // When each is open is venueOpen() below.
  const VENUES = {
    riverside: { name: 'Riverside Park Pavilion', kind: 'park', emoji: '1f333', color: '#4ade80', capacity: 150, fee: 15, travel: 1,
      tags: ['outdoor', 'busy', 'park', 'public', 'offsite'], draw: { seniors: 0.9, adults: 1.1, teens: 0.9, toddlers: 1.2 },
      hours: 'Dawn to dusk; evening programs April to September.', blurb: 'A covered pavilion on a big riverside lawn. Festivals, concerts and sales draw a crowd, except in winter.' },
    maplegrove: { name: 'Maple Grove Playground', kind: 'park', emoji: '1f6dd', color: '#86efac', capacity: 60, fee: 0, travel: 1,
      tags: ['outdoor', 'kids', 'park', 'public', 'offsite'], draw: { seniors: 0.4, adults: 0.7, teens: 0.5, toddlers: 1.5 },
      hours: 'Dawn to dusk; evening programs April to September.', blurb: 'A neighborhood playground with picnic tables: where the stroller crowd already is.' },
    reccenter: { name: 'Westside Recreation Center', kind: 'rec', emoji: '1f3c0', color: '#fb923c', capacity: 80, fee: 25, travel: 1,
      tags: ['program', 'busy', 'public', 'offsite'], draw: { seniors: 1.3, adults: 0.9, teens: 1.2, toddlers: 0.9 },
      hours: 'Monday to Saturday, 9 a.m. to 9 p.m.', blurb: 'A gym, a pool and a community room. Seniors in the mornings, teens after school.' },
    elementary: { name: 'Lincoln Elementary School', kind: 'school', emoji: '1f3eb', color: '#facc15', capacity: 120, fee: 0, travel: 1,
      tags: ['kids', 'program', 'school', 'public', 'offsite'], draw: { seniors: 0.15, adults: 0.6, teens: 0.15, toddlers: 1.5 },
      classes: ['morning', 'afternoon'], classAudience: 'toddlers',
      hours: 'School days only. Class visits in the morning and afternoon; family nights after school and in the evening.', blurb: 'A class visit reaches every kid in a grade, and their families hear about the library.' },
    middle: { name: 'Jefferson Middle School', kind: 'school', emoji: '1f3eb', color: '#fbbf24', capacity: 150, fee: 0, travel: 1,
      tags: ['teen', 'program', 'school', 'public', 'offsite'], draw: { seniors: 0.1, adults: 0.5, teens: 1.5, toddlers: 0.25 },
      classes: ['afternoon'], classAudience: 'teens', noMorning: true,
      hours: 'School days only, from the afternoon. Class visits in the afternoon; clubs after school; parent nights in the evening.', blurb: 'Sixth to eighth grade: reach teens before they decide the library isn\'t for them.' },
    high: { name: 'Central High School', kind: 'school', emoji: '1f3eb', color: '#f59e0b', capacity: 200, fee: 0, travel: 1,
      tags: ['teen', 'program', 'school', 'public', 'offsite'], draw: { seniors: 0.2, adults: 0.6, teens: 1.6, toddlers: 0.1 },
      classes: ['afternoon'], classAudience: 'teens', noMorning: true,
      hours: 'School days only, from the afternoon. Class visits in the afternoon; clubs after school; events in the evening.', blurb: 'An auditorium, a media center and 1,400 students who mostly don\'t know what the library offers.' },
    college: { name: 'Riverbend College', kind: 'college', emoji: '1f393', color: '#a78bfa', capacity: 120, fee: 0, travel: 1,
      tags: ['program', 'tech', 'public', 'offsite'], draw: { seniors: 0.6, adults: 1.4, teens: 0.7, toddlers: 0.15 },
      hours: 'Weekdays all day, Saturday until mid-afternoon. Closed over winter break; quiet in summer.', blurb: 'A student-union room and a lecture hall. Students, night-class adults and retirees auditing courses.' },
  };
  // { ok, why } for a program at a venue on that day and slot
  function venueOpen(id, week, day, slot) {
    const v = VENUES[id]; if (!v) return { ok: false, why: 'Unknown venue.' };
    const brk = schoolBreak(week, day), m = monthOf(week, day);
    if (v.kind === 'park' && slot === 'evening' && (m < 4 || m > 9)) return { ok: false, why: 'Too dark for an evening program outside until April.' };
    if (v.kind === 'school') {
      if (day === 5) return { ok: false, why: 'Schools are closed on Saturdays.' };
      if (brk) return { ok: false, why: 'Closed for ' + brk.toLowerCase() + '.' };
      if (v.noMorning && slot === 'morning') return { ok: false, why: 'Mornings are full of classes. Class visits are in the afternoon.' };
    }
    if (v.kind === 'college') {
      if (brk === 'Winter break') return { ok: false, why: 'Closed over winter break.' };
      if (day === 5 && (slot === 'afterschool' || slot === 'evening')) return { ok: false, why: 'Closes mid-afternoon on Saturdays.' };
    }
    return { ok: true, why: '' };
  }

  // Floor names. The floor holding the patrons' arrival point (Mapster's Player Start) is 1F;
  // floors below it are basements, floors above are 2F, 3F...
  function floorName(index, groundIndex) {
    const rel = index - groundIndex;
    if (rel < 0) return rel === -1 ? 'Basement' : 'Basement ' + (-rel);
    return (rel + 1) + 'F';
  }

  // ---------------------------------------------------------------- refreshments & marketing
  const ADDONS = {
    juice: { label: 'Juice Boxes & Snacks', emoji: '1f9c3', cost: 40, boost: { toddlers: 1.25, teens: 1.25 }, risk: 0.15, riskKey: 'waste_juice', riskDemos: ['seniors', 'adults'], riskGW: 2 },
    coffee: { label: 'Premium Coffee', emoji: '2615', cost: 120, boost: { adults: 1.5 }, risk: 0.25, riskKey: 'elitism_coffee', riskDemos: ['teens', 'toddlers'], riskGW: 1.5 },
  };

  const MARKETING = [
    { id: 0, label: 'Website & Desk', cost: 0, reach: 0, note: 'Free. Base reach.' },
    { id: 1, label: 'B&W Flyers', cost: 30, reach: 0.15, note: '+15% reach to local walk-ins.' },
    { id: 2, label: 'Glossy Posters & Partners', cost: 150, reach: 0.4, minLead: 3, lateReach: 0.1, note: '+40% reach. Needs 3+ weeks to print and send to partners.' },
  ];

  // Lead time (weeks between booking the marketing and the program) -> multiplier (the GDD's curve).
  function timingMultiplier(leadWeeks) {
    if (leadWeeks <= 0) return { mult: 0.3, label: 'Same week', tone: 'bad', tip: 'Almost nobody will hear about it in time.' };
    if (leadWeeks <= 2) return { mult: 0.4, label: leadWeeks + ' wk notice', tone: 'bad', tip: 'Short notice: people already made plans.' };
    if (leadWeeks === 3) return { mult: 0.8, label: '3 wks out', tone: 'ok', tip: 'Decent. One more week would be ideal.' };
    if (leadWeeks <= 6) return { mult: 1.0, label: leadWeeks + ' wks out', tone: 'good', tip: 'The sweet spot (4 to 6 weeks).' };
    if (leadWeeks <= 11) return { mult: leadWeeks <= 8 ? 0.85 : 0.7, label: leadWeeks + ' wks out', tone: 'ok', tip: 'Early: some people will forget. Plan a reminder closer to the date.' };
    return { mult: 0.6, label: leadWeeks + ' wks out', tone: 'bad', tip: 'Too early (12+ weeks): the audience forgets.' };
  }

  // Scope slider (1 = highly niche, 10 = broad). Returns potential audience and conversion.
  function scopeMath(scope) {
    const t = (scope - 1) / 9;
    const potential = Math.round(50 * Math.pow(20, t));
    const conversion = 0.8 * Math.pow(0.05 / 0.8, t);
    const targetShare = 0.95 - 0.55 * t;
    return { t, potential, conversion, targetShare };
  }

  // ---------------------------------------------------------------- program cards
  // target: main audience. also: who else might come. noise: 0 silent .. 3 loud.
  // ideal/bad: room tags that suit (or don't suit) it. circ: checkouts per attendee.
  // recurring: fine to run weekly (no novelty drop). special: sale | cards | tour | seasonal
  const PROGRAMS = [
    { id: 'storytime', title: 'Toddler Storytime', emoji: '1f4d6', target: 'toddlers', also: [], cost: 25, staff: 2, duration: 45, noise: 2, appeal: 1.1, ideal: ['kids', 'program'], bad: ['quiet', 'tech'], circ: 1.4, recurring: true, blurb: 'Songs, rhymes and picture books. Wiggling encouraged.' },
    { id: 'babysign', title: 'Baby Sign & Sing', emoji: '1f3b5', target: 'toddlers', also: [], cost: 40, staff: 2, duration: 45, noise: 2, appeal: 0.9, ideal: ['kids', 'program'], bad: ['quiet', 'tech'], circ: 1.0, blurb: 'Simple signs for babies and the grown-ups who love them.' },
    { id: 'lego', title: 'LEGO Build Club', emoji: '1f9f1', target: 'toddlers', also: ['teens'], cost: 60, staff: 3, duration: 90, noise: 3, appeal: 1.1, ideal: ['kids', 'program'], bad: ['quiet', 'study', 'tech'], circ: 0.6, blurb: 'Ten thousand bricks and a theme of the week.' },
    { id: 'spooky', title: 'Spooky Story Night', emoji: '1f47b', target: 'toddlers', also: ['teens', 'adults'], cost: 70, staff: 3, duration: 60, noise: 2, appeal: 1.0, ideal: ['kids', 'program'], bad: ['quiet', 'tech'], circ: 1.0, special: 'seasonal', months: [10, 10], blurb: 'Costumes welcome. Best in October, near Halloween.' },
    { id: 'tcg', title: 'Trading Card Tournament', emoji: '1f0cf', target: 'teens', also: ['adults'], cost: 80, staff: 4, duration: 120, noise: 3, appeal: 1.0, ideal: ['teen', 'program'], bad: ['quiet', 'study'], circ: 0.3, blurb: 'Bring your deck. Prizes for the top four.' },
    { id: 'gamenight', title: 'Video Game Night', emoji: '1f3ae', target: 'teens', also: [], cost: 120, staff: 4, duration: 120, noise: 3, appeal: 1.2, ideal: ['teen', 'program'], bad: ['quiet', 'study'], circ: 0.2, blurb: 'Projector, four controllers and a bracket.' },
    { id: 'anime', title: 'Anime & Manga Club', emoji: '1f58d', target: 'teens', also: ['adults'], cost: 45, staff: 2, duration: 90, noise: 2, appeal: 0.9, ideal: ['teen', 'program'], bad: ['quiet'], circ: 0.9, recurring: true, blurb: 'Watch, draw and argue about the best arc.' },
    { id: 'science', title: 'Teen Science Lab', emoji: '1f9ea', target: 'teens', also: [], cost: 90, staff: 3, duration: 90, noise: 2, appeal: 1.0, ideal: ['program', 'teen', 'tech'], bad: ['quiet', 'study'], circ: 0.5, blurb: 'Slime, circuits and the occasional small explosion.' },
    { id: 'revwar', title: 'Rev. War Replica Weapons', emoji: '2694', target: 'adults', also: ['seniors'], cost: 100, staff: 3, duration: 90, noise: 1, appeal: 0.8, ideal: ['program', 'quiet'], bad: ['kids', 'loud'], circ: 0.5, blurb: 'A collector brings muskets, bayonets and a lot of opinions.' },
    { id: 'author', title: 'Local Author Talk', emoji: '1f3a4', target: 'adults', also: ['seniors'], cost: 350, staff: 5, duration: 75, noise: 1, appeal: 1.3, ideal: ['program'], bad: ['loud', 'kids', 'teen'], circ: 1.0, blurb: 'A reading, a Q&A and a signing table.' },
    { id: 'esl', title: 'ESL Conversation Circle', emoji: '1f4ac', target: 'adults', also: ['seniors'], cost: 0, staff: 2, duration: 60, noise: 1, appeal: 0.8, ideal: ['study', 'small', 'program'], bad: ['loud'], circ: 0.5, recurring: true, blurb: 'Practice English with friendly volunteers.' },
    { id: 'resume', title: 'Résumé & Job Search Lab', emoji: '1f4dd', target: 'adults', also: [], cost: 30, staff: 3, duration: 90, noise: 0, appeal: 0.9, ideal: ['tech'], bad: ['loud', 'kids'], circ: 0.3, blurb: 'One-on-one help with résumés and online applications.' },
    { id: 'concert', title: 'String Quartet Concert', emoji: '1f3bb', target: 'adults', also: ['seniors'], cost: 300, staff: 3, duration: 75, noise: 3, appeal: 1.2, ideal: ['program', 'soundproof'], bad: ['quiet', 'study', 'small'], circ: 0.4, blurb: 'The community orchestra\'s best four, up close.' },
    { id: 'phone', title: 'Smartphone Help Clinic', emoji: '1f4f1', target: 'seniors', also: ['adults'], cost: 20, staff: 3, duration: 60, noise: 1, appeal: 1.1, ideal: ['tech', 'program'], bad: ['loud', 'teen'], circ: 0.4, blurb: 'Bring your phone and your questions. No question too small.' },
    { id: 'genealogy', title: 'Genealogy Research Night', emoji: '1f333', target: 'seniors', also: ['adults'], cost: 40, staff: 2, duration: 120, noise: 0, appeal: 0.9, ideal: ['study', 'tech', 'quiet'], bad: ['loud', 'kids'], circ: 0.6, blurb: 'Census records, ship manifests and a lot of squinting.' },
    { id: 'medicare', title: 'Medicare Enrollment Q&A', emoji: '1f4dc', target: 'seniors', also: ['adults'], cost: 0, staff: 1, duration: 90, noise: 0, appeal: 1.0, ideal: ['program', 'quiet'], bad: ['loud', 'teen', 'kids'], circ: 0.1, blurb: 'A partner agency explains this year\'s plans. Open enrollment is Oct 15 to Dec 7.' },
    { id: 'matinee', title: 'Classic Movie Matinee', emoji: '1f3ac', target: 'seniors', also: ['adults'], cost: 60, staff: 2, duration: 120, noise: 2, appeal: 1.0, ideal: ['program'], bad: ['quiet', 'study', 'outdoor'], circ: 0.8, recurring: true, blurb: 'Popcorn, a Hollywood classic and the comfy chairs.' },
    { id: 'knit', title: 'Knit & Natter', emoji: '1f9f6', target: 'seniors', also: ['adults'], cost: 10, staff: 1, duration: 120, noise: 1, appeal: 0.9, ideal: ['study', 'program'], bad: ['loud', 'teen'], circ: 0.6, recurring: true, blurb: 'Needles out, gossip in. All skill levels.' },
    { id: 'seed', title: 'Seed Library Swap', emoji: '1f331', target: 'seniors', also: ['adults', 'toddlers'], cost: 30, staff: 2, duration: 120, noise: 1, appeal: 0.9, ideal: ['outdoor', 'busy'], bad: ['tech', 'small'], circ: 0.4, walkIn: true, blurb: 'Swap saved seeds and gardening tips before the frost.' },
    { id: 'booksale', title: 'Friends Book Sale', emoji: '1f3f7', target: 'adults', also: ['seniors', 'toddlers', 'teens'], cost: 50, staff: 6, duration: 240, noise: 1, appeal: 1.4, ideal: ['outdoor', 'busy'], bad: ['quiet', 'small'], circ: 0, special: 'sale', revenuePerAttendee: 4, walkIn: true, blurb: 'Donated books, a dollar a bag by noon. Raises money for programs.' },
    { id: 'carddrive', title: 'Library Card Sign-up Drive', emoji: '1faaa', target: 'toddlers', also: ['adults', 'teens', 'seniors'], cost: 40, staff: 3, duration: 180, noise: 1, appeal: 0.8, ideal: ['busy', 'outdoor'], bad: ['quiet', 'small'], circ: 0.3, special: 'cards', walkIn: true, blurb: 'A table, a banner and a stack of applications. New cards mean more checkouts all quarter.' },
    { id: 'summerread', title: 'Summer Reading Kickoff', emoji: '2600', target: 'toddlers', also: ['teens', 'adults'], cost: 150, staff: 5, duration: 120, noise: 3, appeal: 1.5, ideal: ['outdoor', 'busy', 'kids', 'park'], bad: ['quiet', 'small'], circ: 1.6, special: 'seasonal', months: [6, 7], blurb: 'Reading logs, prizes and a bounce house to start the summer. Best in June or July, when school is out.' },
    { id: 'holidaycraft', title: 'Holiday Craft Workshop', emoji: '2744', target: 'toddlers', also: ['seniors', 'adults'], cost: 70, staff: 3, duration: 90, noise: 2, appeal: 1.1, ideal: ['program', 'kids'], bad: ['quiet', 'tech'], circ: 0.7, special: 'seasonal', months: [12, 12], blurb: 'Paper snowflakes, cards and ornaments. Best in December.' },
    { id: 'taxhelp', title: 'Free Tax Help', emoji: '1f9fe', target: 'adults', also: ['seniors'], cost: 0, staff: 3, duration: 180, noise: 0, appeal: 1.2, ideal: ['tech', 'quiet', 'program'], bad: ['loud', 'kids'], circ: 0.2, special: 'seasonal', months: [2, 4], recurring: true, blurb: 'Volunteer preparers file simple returns for free. February to April only.' },
    { id: 'backtoschool', title: 'Back-to-School Bash', emoji: '1f392', target: 'teens', also: ['toddlers', 'adults'], cost: 120, staff: 4, duration: 120, noise: 3, appeal: 1.2, ideal: ['outdoor', 'busy', 'school', 'park'], bad: ['quiet', 'study'], circ: 0.8, special: 'seasonal', months: [8, 9], blurb: 'Free school supplies, homework-help sign-ups and a DJ. Best in late summer.' },
    { id: 'tour', title: 'Behind the Stacks Tour', emoji: '1f526', target: 'adults', also: ['seniors', 'teens'], cost: 0, staff: 3, duration: 60, noise: 0, appeal: 0.7, ideal: ['storage', 'staff'], bad: ['loud'], circ: 0.7, special: 'tour', maxGroup: 14, blurb: 'A peek at the closed stacks, the mending table and the book sorter. The one program that belongs in the basement.' },
  ];

  // Programs your predecessor already put on the calendar (week, day index, slot, room, scope, marketing).
  // repeatUntilWeek makes it a weekly series (one session a week until that week).
  const INHERITED = [
    { program: 'storytime', week: 1, day: 1, slot: 'morning', room: 'children', scope: 6, marketing: 0, bookedWeek: -4, repeatUntilWeek: 6 },
    { program: 'tcg', week: 1, day: 3, slot: 'morning', room: 'reference', scope: 5, marketing: 1, bookedWeek: -2 },
    { program: 'author', week: 2, day: 2, slot: 'afternoon', room: 'program', scope: 5, marketing: 0, bookedWeek: 1 },
  ];

  // ---------------------------------------------------------------- the social feed
  const NAMES = ['Darlene P.', 'Marcus T.', 'Priya S.', 'Gloria W.', 'Hank B.', 'Yesenia R.', 'Tom K.', 'Beatrice L.', 'Jamal O.', 'Kayla M.', 'Ed F.', 'Rosa G.', 'Dmitri V.', 'Sunita A.', 'Walt H.', 'Imani J.', 'Carol N.', 'Luis D.', 'Mei C.', 'Frank Z.', 'Nadia E.', 'Owen Q.', 'Patty S.', 'Reggie U.', 'Tasha Y.', 'Vince I.', 'Wendy X.', 'Zoe B.', 'Arturo M.', 'Bernice K.', 'Cody L.', 'Dolores R.', 'Ethan P.', 'Fatima H.', 'Gus W.', 'Hye-jin S.', 'Irene T.', 'Jorge A.', 'Kendra F.', 'Lou G.', 'Maggie D.', 'Ned O.', 'Opal V.', 'Pete C.', 'Ruthie N.', 'Sam E.', 'Tyrone J.', 'Ursula M.', 'Val B.', 'Wes K.'];
  const TEEN_HANDLES = ['xX_shelfie_Xx', 'manga.moth', 'deckbuilder07', 'quietkid.exe', 'lilbookgoblin', 'speedrun_sam', 'not.a.nerd', 'yugi_oh_no', 'cardcaptor_cam', 'pixel.pip'];
  const PLATFORMS = {
    seniors: ['Facebook', 'Nextdoor', 'Facebook'],
    adults: ['Facebook', 'X', 'Nextdoor', 'Google Reviews'],
    teens: ['Instagram', 'TikTok', 'X'],
    toddlers: ['Facebook', 'Instagram', 'Nextdoor'],
  };

  // {name} {program} {room} {addon} {n} {demo} {time} are filled in by feed.js
  const FEED = {
    niche_positive: [
      'The {program} was amazing. So glad the library caters to people like us!',
      'Finally, a {program}! I thought I was the only one in town who cared about this. Feeling seen.',
      'Small crowd at the {program} but every single person there was into it. More like this, please.',
    ],
    broad_positive: [
      'Fun afternoon at the library\'s {program}. Something for everyone.',
      'Took the whole family to the {program}. Packed room, great vibe.',
      'Didn\'t expect much from the {program} but it was a really nice community event.',
    ],
    positive: [
      'Great time at the {program} today. Thanks, library staff!',
      'The {program} was so well run. Already looking forward to the next one.',
      'Big shout-out to the library for the {program}. Worth every tax dollar.',
    ],
    toddler_positive: [
      'My toddler has not stopped singing since the {program}. Send help (and more storytimes).',
      'The {program} is the only hour of my week where I sit down. Bless the children\'s librarian.',
    ],
    teen_positive: [
      'ngl the {program} at the library was fire',
      '{program} at the library slapped. we\'re going every time',
    ],
    watered_down: [
      'The {program} felt watered down. They tried to please everyone and lost what made it special.',
      'Went to the {program} hoping for the real deal. Got the "family friendly" version instead.',
    ],
    narrow_programming: [
      'Why is the library spending money on a {program}? Seems awfully narrow.',
      'Another niche event nobody asked for ({program}). How about something for regular people?',
    ],
    waste_juice: [
      'Unbelievable that my tax dollars are funding juice boxes at the library. Wasteful.',
      'Juice and cookies at the {program}? In THIS economy? Write your council member.',
    ],
    elitism_coffee: [
      'Fancy coffee for the {program} crowd while the kids get nothing. Nice priorities, library.',
      'Premium coffee at a public library event. Must be nice.',
    ],
    noise_reference: [
      'Tried to study at the library but a noisy program ruined it. Had to leave.',
      'Came to read the paper in peace. Left with a headache. What is going on over there?',
    ],
    noise_teen: [
      'My teen just wanted to play cards in the Teen Zone, but a loud program made it impossible!',
    ],
    noise_generic: [
      'Couldn\'t hear myself think in the {room}. Not what I expect from a library.',
      'Left early. The {room} was way too loud today.',
    ],
    teen_overflow: [
      'The {room} was overrun by teenagers this afternoon. Is there no room for them anywhere else?',
      'A pack of teens took over the {room} after school. Loud doesn\'t begin to describe it.',
    ],
    crowded: [
      'The {room} was so crowded I couldn\'t find a seat. Gave up and went home.',
      'Packed like sardines in the {room}. Is this a library or a bus station?',
    ],
    turned_away: [
      'Drove all the way to the {program} and it was full. Turned away at the door.',
      'They had to turn people away from the {program}. Book a bigger room!',
    ],
    wrong_room_staff: [
      'Why was the {program} held in a storage area?? We were tripping over book carts.',
      'The {program} was in some back office in the basement. Felt like we weren\'t supposed to be there.',
    ],
    wrong_room_restroom: [
      'The {program}... was in the restrooms? I have so many questions.',
    ],
    poor_fit: [
      'The {program} was in the {room}, which made zero sense. Everyone was uncomfortable.',
      'Nice idea, wrong room. The {program} didn\'t work in the {room} at all.',
    ],
    low_turnout: [
      '#staff-chat: Only {n} people showed up to the {program}. Wrong time? Not enough notice?',
      '#staff-chat: {n} attendees at the {program}. We set out 40 chairs.',
    ],
    late_notice: [
      'Just found out about the {program}. Today. Would have come if I\'d known sooner!',
      'Library, please announce things more than a week ahead. Missed the {program} again.',
    ],
    burnout: [
      '#staff-chat: Three programs and a desk shift this week. We are running on fumes.',
      '#staff-chat: Can we talk about this week\'s schedule? Nobody has had a lunch break since Monday.',
    ],
    underserved: {
      seniors: 'Does the library still do anything for seniors? Haven\'t seen a program for us in ages.',
      adults: 'Lots of kids\' stuff at the library lately. Anything for grown-ups on the calendar?',
      teens: 'nothing to do at the library rn. so bored',
      toddlers: 'Where did all the toddler programs go? We used to go every week.',
    },
    sale: [
      'Friends of the Library: the {program} raised ${n} for programs! Thank you, book lovers.',
    ],
    cards: [
      'Signed up for a library card at the {program}. Didn\'t realize it was free!',
      '#staff-chat: {n} new library cards from the {program}!',
    ],
    tour: [
      'The {program} was fascinating. I had no idea how much happens behind the scenes!',
    ],
    tour_too_big: [
      'The {program} was so crowded down there we couldn\'t see anything.',
    ],
    cancelled: [
      'Saw a flyer for the {program} and showed up. Cancelled. Thanks for nothing.',
    ],
    seasonal_off: [
      'A {program}... in {when}? Odd timing.',
    ],
  };

  return { CALENDAR, SLOTS, START, DEMOGRAPHICS, DEMO_KEYS, SLOT_AVAILABILITY, PASSIVE_TRAFFIC, ROOM_PREFERENCES, TEEN_OVERFLOW, ROOM_RULES, VENUES, venueOpen, floorName, ADDONS, MARKETING, timingMultiplier, scopeMath, PROGRAMS, INHERITED, NAMES, TEEN_HANDLES, PLATFORMS, FEED,
    dateOf, weekDayOf, holidayOn, schoolBreak, quarterOf, monthOf, MONTHS, inMonths, dayType, OUTDOOR_WEATHER, POPULATION, setPopulation, population };
})();
