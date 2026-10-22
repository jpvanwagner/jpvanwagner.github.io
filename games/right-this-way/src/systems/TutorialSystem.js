/*
 * The optional tutorial ("Training Day", config/levels.js TUTORIAL).
 *
 * A list of steps, one mechanic each. A step stages its situation (spawns
 * exactly the people it needs), says what to do, and watches for it to be
 * done; then the next step starts. Every step can be skipped (its `skip`
 * tidies up so later steps still work), and the player can leave for the real
 * game at any time (ui/TutorialPanel.js).
 *
 * Step text may use {verb} ("Click" / "Tap"). `focus` names the panel or
 * element to highlight, `tab` the dock tab to bring up on small screens (or a
 * function of the tutorial). `point(t)` lists CSS selectors in priority order:
 * the tutorial panel points an arrow at the first one on screen, so it walks
 * the player through each click (Check ID -> the ID check's button -> ...).
 * Steps without `done` are read-and-continue ("Next").
 */
import { PersonState } from '../entities/Person.js';
import { WORKSTATIONS } from '../data/layout.js';
import { DRILL_INCIDENTS } from '../data/incidentText.js';
import { pick } from '../core/rng.js';

const decided = (t, person, action) => !!person && t.decisions.get(person) === action;
/** Someone in these groups got a wrong call (as scored). */
const decidedWrong = (t, groups) => groups.filter(Boolean).some((grp) => grp.members.some((m) => t.wrong.has(m)));

/** Get these groups out of the way (a skipped step): staff go in, visitors / impostors go home. */
function waveThrough(t, groups) {
  const g = t.game;
  for (const group of groups.filter(Boolean)) {
    if (g.desk.group === group) g.desk.abandon();
    else g.queue.remove(group);
    for (const m of group.members) {
      if (m.removed || t.decisions.has(m) || ![PersonState.ARRIVING, PersonState.QUEUED, PersonState.AT_DESK].includes(m.state)) continue;
      if (m.isGuest || m.badge === 'borrowed') g.leave(m);
      else g.staff.admit(m);
    }
  }
}

const desk = (action) => `#desk-panel [data-action="${action}"]:not(:disabled)`;
const LOOKUP = '.lookup-modal:not([hidden])';

/**
 * Pointer targets for whoever is at the desk: inspect them first (the ID
 * check / desk computer, and the right button inside it), then the decision.
 * plan(m) -> { desk: [actions in order], modal?: ID-check button, lookup?: 'not-on-list' }
 */
const deskPoint = (plan) => (t) => {
  const m = t.game.desk.current;
  const p = m && !t.game.desk.decisionFor(m) ? plan(m) : null;
  if (!p) return null;
  // Their badge / pass is printing: wait for it (deciding now is a mistake or a race).
  if (t.game.desk.printJob?.people?.includes(m)) return null;
  const sel = [];
  if (m.isGuest) {
    if (p.lookup === 'not-on-list') sel.push(`${LOOKUP} [data-action="not-on-list"]`);
    else sel.push(`${LOOKUP} [data-action="confirm"]:not(:disabled)`, `${LOOKUP} .vms-name[data-name="${m.name.replace(/"/g, '')}"]`);
    sel.push('#desk-panel [data-action="verify"]');
  } else {
    sel.push(`.id-modal:not([hidden]) [data-action="${p.modal ?? 'allow'}"]:not(:disabled)`, '#desk-panel [data-action="check"]');
  }
  return [...sel, ...p.desk.map(desk)];
};

export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to the front desk',
    text: (g) =>
      `You run security at the <b>${g.company.name}</b> visitor center. You're the gold ring behind the desk. Scroll or pinch to zoom, drag to pan. {verb} or hover anyone to see who they are and what they're doing; hover a room to see its name. The buttons at the top right slow the game down (\u00bd\u00d7), pause it, or fast-forward (2\u00d7, 3\u00d7); <b>Settings</b> can make officers and trouble spots glow. Follow the <b>blue arrow</b>: it points at what to press next. Skip any step, or jump to the real game whenever you like.`,
    point: () => ['#topbar .speed-group'],
  },
  {
    id: 'officers',
    title: 'Approve the officers',
    focus: '#desk-panel',
    tab: 'desk',
    text: () =>
      'Security officers from <b>The Organization</b> arrive first. Everyone is approved one at a time: {verb} <b>Check ID</b> (B), compare the photo with the face and the expiry date with <b>today’s date</b> by the clock, then <b>Verify &amp; allow</b> (A). Always check first: a right call you didn\u2019t check scores nothing. Approve all three.',
    point: deskPoint(() => ({ desk: ['allow'] })),
    start: (t) => {
      t.refs.crew = [t.spawn([{ code: 'O', duty: true }, { code: 'O', duty: true }]), t.spawn([{ code: 'O', duty: true }])];
    },
    done: (t) => t.game.escorts.officers.length >= 3,
    skip: (t) => waveThrough(t, t.refs.crew),
  },
  {
    id: 'scoring',
    title: 'Your choices, and how they score',
    text: () =>
      'Every person gets one call. <b>Allow</b>: staff with a valid badge, or a visitor whose host you just let in. <b>Deny</b>: only someone using <i>another person\u2019s</i> badge. <b>Temp badge</b>: staff whose badge expired. For visitors: <b>Call escort</b>, the <b>Waiting area</b> (early, or no officer free) or <b>Officer verify</b> (not on the list, or late).<br>A right call is <b>+1</b>, but only if you checked their ID or looked them up first; unchecked, it scores <b>0</b>. Mistakes cost more: <b>\u22122</b> for turning away someone who belongs (expired badges too), <b>\u22123</b> for a visitor let in alone or not on the list, <b>\u22125</b> for letting a borrowed badge in. The popup always says why.',
    point: () => ['#topbar .stat-score'],
  },
  {
    id: 'badge-ok',
    title: 'An employee',
    focus: '#desk-panel',
    tab: 'desk',
    text: () => 'Check their ID: the photo matches and the badge hasn’t expired. <b>Verify &amp; allow</b> them in.',
    point: deskPoint(() => ({ desk: ['allow'] })),
    start: (t) => (t.refs.emp = t.spawn([{ code: 'E' }])),
    done: (t) => decided(t, t.refs.emp.members[0], 'allow'),
    failed: (t) => decidedWrong(t, [t.refs.emp]),
    skip: (t) => waveThrough(t, [t.refs.emp]),
  },
  {
    id: 'badge-expired',
    title: 'An expired badge',
    focus: '#desk-panel',
    tab: 'desk',
    text: () =>
      'Check this ID: the badge <b>expired</b> (its date is before today’s). They still work here, so don\u2019t deny them: {verb} <b>Temp badge &amp; allow</b> (T) right in the ID check. It prints a temp badge and lets them in. Badges last six months.',
    point: deskPoint(() => ({ modal: 'temp-allow', desk: ['temp', 'allow'] })),
    start: (t) => (t.refs.expired = t.spawn([{ code: 'E', badge: 'expired' }])),
    done: (t) => decided(t, t.refs.expired.members[0], 'allow'),
    failed: (t) => decidedWrong(t, [t.refs.expired]),
    skip: (t) => waveThrough(t, [t.refs.expired]),
  },
  {
    id: 'renew',
    title: 'Print them a new badge',
    focus: '#desk-renewals',
    tab: 'desk',
    text: () =>
      'Anyone let in on a temp badge lands on <b>New badges to print</b>. Print it any time today ({verb} <b>Print badge</b>); badges still owed at the end of the shift cost a point. Tomorrow they’ll arrive with the new one.',
    point: () => ['#desk-renewals [data-action="renew"]:not(:disabled)'],
    start: (t) => {
      const g = t.game;
      if (!g.renewals.length) {
        const member = pick(g.career.roster.filter((m) => m.type === 'E'));
        g.renewals.push({ member, name: member.name, person: null });
        g.bus.emit('desk');
      }
    },
    done: (t) => t.game.renewals.length === 0,
    skip: (t) => {
      t.game.renewals = [];
      t.game.bus.emit('desk');
    },
  },
  {
    id: 'badge-borrowed',
    title: 'Somebody else’s badge',
    focus: '#desk-panel',
    tab: 'desk',
    text: () => 'Check this ID closely: the photo doesn’t match the person (hair, glasses). It’s a borrowed badge: <b>Deny</b> (D).',
    point: deskPoint(() => ({ modal: 'deny', desk: ['deny'] })),
    start: (t) => (t.refs.borrowed = t.spawn([{ code: 'E', badge: 'borrowed' }])),
    done: (t) => decided(t, t.refs.borrowed.members[0], 'deny'),
    failed: (t) => decidedWrong(t, [t.refs.borrowed]),
    skip: (t) => waveThrough(t, [t.refs.borrowed]),
  },
  {
    id: 'visitor',
    title: 'A visitor: call an escort',
    focus: '#desk-panel',
    tab: 'desk',
    text: () =>
      'Visitors need an escort. {verb} <b>Verify appointment</b> (V) and find their name on the desk computer (arrow keys, letters or {verb-lc}). Check their <b>appointment time</b> against when they <b>arrived</b> (shown under it): within 15 minutes either way is on time. Confirm it, then <b>Call escort</b> (E). A free officer walks them to their meeting; their host takes it from there.',
    point: deskPoint(() => ({ desk: ['escort'] })),
    start: (t) => (t.refs.visitor = t.spawn([{ code: 'G' }])),
    done: (t) => decided(t, t.refs.visitor.members[0], 'escort'),
    failed: (t) => decidedWrong(t, [t.refs.visitor]),
    skip: (t) => waveThrough(t, [t.refs.visitor]),
  },
  {
    id: 'host',
    title: 'Arriving with their host',
    focus: '#desk-panel',
    tab: 'desk',
    text: () =>
      'An employee (or officer) arriving <i>with</i> a visitor can escort them. Approve the employee first (check their ID, <b>Allow</b>), then verify the visitor and <b>Allow</b> them too. They go in together.',
    point: deskPoint(() => ({ desk: ['allow'] })),
    start: (t) => (t.refs.host = t.spawn([{ code: 'E' }, { code: 'G' }])),
    done: (t) => t.refs.host.members.every((m) => t.decisions.has(m)) && !decidedWrong(t, [t.refs.host]),
    failed: (t) => decidedWrong(t, [t.refs.host]),
    skip: (t) => waveThrough(t, [t.refs.host]),
  },
  {
    id: 'early',
    title: 'Early for their appointment',
    focus: '#desk-panel',
    tab: 'desk',
    text: () =>
      'Look this visitor up and compare their appointment time with when they arrived: they\u2019re <b>more than 15 minutes early</b>. Send them to the <b>Waiting area</b> (W). A guard can only collect them shortly before their appointment.',
    point: deskPoint(() => ({ desk: ['wait'] })),
    start: (t) => (t.refs.early = t.spawn([{ code: 'G', timing: 'early' }])),
    done: (t) => decided(t, t.refs.early.members[0], 'wait'),
    failed: (t) => decidedWrong(t, [t.refs.early]),
    skip: (t) => waveThrough(t, [t.refs.early]),
  },
  {
    id: 'late',
    title: 'Late for their appointment',
    focus: '#desk-panel',
    tab: 'desk',
    text: () =>
      'This one is <b>more than 15 minutes late</b>. <b>Officer verify</b> (O): an officer checks with their host. They\u2019re either rescheduled for later today (and wait in the waiting area) or asked to leave.',
    point: deskPoint(() => ({ desk: ['officerVerify'] })),
    start: (t) => (t.refs.late = t.spawn([{ code: 'G', timing: 'late' }])),
    done: (t) => decided(t, t.refs.late.members[0], 'officerVerify'),
    failed: (t) => decidedWrong(t, [t.refs.late]),
    skip: (t) => waveThrough(t, [t.refs.late]),
  },
  {
    id: 'not-listed',
    title: 'Not on the list',
    focus: '#desk-panel',
    tab: 'desk',
    text: () =>
      'Verify this visitor: they’re <b>not on today’s list</b>. Don’t turn them away: <b>Officer verify</b> (O). They step aside and an officer radios their host. If they’re expected, they’re added to the list and line up again: approve them like any visitor.',
    point: deskPoint(() => ({ lookup: 'not-on-list', desk: ['officerVerify'] })),
    start: (t) => (t.refs.unlisted = t.spawn([{ code: 'G', listed: false, late: true }])),
    done: (t) => decided(t, t.refs.unlisted.members[0], 'officerVerify'),
    failed: (t) => decidedWrong(t, [t.refs.unlisted]),
    skip: (t) => waveThrough(t, [t.refs.unlisted]),
  },
  {
    id: 'passes',
    title: 'Guest passes',
    focus: '#desk-panel',
    tab: 'desk',
    text: () =>
      'From level 2 on, visitors need a printed <b>guest pass</b> before their escort reaches them. Verify this visitor, <b>Print guest pass</b> (P), then <b>Call escort</b>. If the escort beats the printer, the desk freezes for a moment.',
    point: deskPoint(() => ({ desk: ['print', 'escort'] })),
    start: (t) => {
      t.game.features.guestPasses = true;
      t.game.bus.emit('desk');
      t.refs.pass = t.spawn([{ code: 'G' }]);
    },
    done: (t) => decided(t, t.refs.pass.members[0], 'escort'),
    failed: (t) => decidedWrong(t, [t.refs.pass]),
    skip: (t) => waveThrough(t, [t.refs.pass]),
  },
  {
    id: 'waiting',
    title: 'The waiting area',
    focus: '#waiting-panel',
    tab: (t) => (t.flags.seated ? 'waiting' : 'desk'),
    point: (t) =>
      t.flags.seated
        ? t.game.waiting.groups
            .filter((w) => w.guests.some((m) => t.refs.pair.members.includes(m)))
            .filter((w) => !w.guests.some((m) => t.game.desk.printJob?.people?.includes(m))) // printing: wait
            .flatMap((w) => [`[data-group="${w.id}"] [data-action="print-pass"]:not(:disabled)`, `[data-group="${w.id}"] [data-action="dispatch"]:not(:disabled)`])
        : deskPoint(() => ({ desk: ['print', 'wait'] }))(t),
    text: (g, t) =>
      t.flags.seated
        ? 'Officers are free again. In the <b>Waiting Area</b> panel, print their passes, then <b>Dispatch</b> an officer to collect them. Visitors left waiting too long slip into the building on their own.'
        : 'Pretend every officer is busy: <b>Call escort</b> is greyed out, so use <b>Waiting area</b> (W). Approve both visitors (verify, print a pass, then <b>Waiting area</b>). The waiting area seats nine.',
    start: (t) => {
      t.game.escorts.hold = true;
      t.refs.pair = t.spawn([{ code: 'G' }, { code: 'G' }]);
    },
    tick: (t) => {
      const g = t.game;
      if (!t.flags.seated && t.refs.pair.members.every((m) => m.state === PersonState.WAITING || m.removed)) {
        t.flags.seated = true;
        g.escorts.hold = false;
        g.bus.emit('officers');
        g.bus.emit('tutorial');
      }
    },
    done: (t) => t.flags.seated && !t.game.waiting.groups.some((w) => w.guests.some((m) => t.refs.pair.members.includes(m)) && !w.dispatched),
    end: (t) => {
      t.game.escorts.hold = false;
      t.game.bus.emit('officers');
    },
    skip: (t) => {
      const g = t.game;
      g.escorts.hold = false;
      waveThrough(t, [t.refs.pair]);
      for (const w of g.waiting.groups) if (w.guests.some((m) => t.refs.pair.members.includes(m))) g.waiting.dispatch(w.id);
    },
  },
  {
    id: 'cameras',
    title: 'Security cameras',
    focus: '.cam-btn',
    text: () =>
      '{verb} any <b>CAM</b> tag on the map to look through that camera in 3D; it names the rooms in view, and visitors in view behave. Then {verb} <b>Return to map</b> (or press Backspace).',
    point: (t) => (t.flags.cameraViewed ? ['#btn-cam-exit'] : ['.cam-btn']),
    done: (t) => t.flags.cameraViewed && t.flags.cameraLeft,
  },
  {
    id: 'loose',
    title: 'A visitor slipped in',
    focus: '#incident-panel',
    tab: 'incidents',
    text: () =>
      'Someone got past the desk! Every loose visitor raises the <b>incident multiplier</b> and causes incidents (Incident Log). Watching them on camera pauses their timer, but only an officer deals with them: <b>Dispatch officer</b>, or <b>Send guard</b> in the camera view.',
    point: () => ['#incident-panel [data-response="dispatch"]:not(:disabled)', '.guard-btn'],
    start: (t) => {
      const g = t.game;
      const guest = g.arrivals.makeScripted({ code: 'G' }, { x: 24, z: -9 });
      g.wander.admit(guest);
      g.incidents.create(guest, 'guest', 'is wandering the main hallway without an escort.');
      t.refs.loose = guest;
    },
    done: (t) => !!t.refs.loose.targetedBy || t.refs.loose.removed,
    skip: (t) => {
      const g = t.game;
      g.incidents.open.filter((i) => i.person === t.refs.loose).forEach((i) => g.incidents.resolve(i, 'addressed', { score: false }));
      g.despawn(t.refs.loose);
    },
  },
  {
    id: 'drill',
    title: 'Drills',
    focus: '#incident-panel',
    tab: 'incidents',
    text: () => 'Staff run response drills now and then. Answer before the bar runs out: <b>Acknowledge</b>, or <b>Send officer</b> to check in on them.',
    point: () => ['#incident-panel [data-response="acknowledge"]:not(:disabled)'],
    start: (t) => {
      const g = t.game;
      let worker = g.people.find((p) => p.isEmployee && p.state === PersonState.WORKING && p.inside);
      if (!worker) {
        worker = g.arrivals.makeScripted({ code: 'E' }, WORKSTATIONS[0]);
        g.staff.admit(worker);
      }
      t.refs.drill = g.incidents.create(worker, 'drill', pick(DRILL_INCIDENTS));
    },
    done: (t) => t.refs.drill.status !== 'open',
    skip: (t) => t.game.incidents.resolve(t.refs.drill, 'addressed', { score: false }),
  },
  {
    id: 'restroom',
    title: 'Restroom requests',
    focus: '#incident-panel',
    tab: 'incidents',
    text: () =>
      'Visitors need a guard to walk them to the restroom, except the single stall next to the waiting area. This visitor (waiting in a lounge) is asking: <b>Send guard</b>. If nobody comes, they go alone, unescorted.',
    point: () => ['#incident-panel [data-response="dispatch"]:not(:disabled)'],
    start: (t) => {
      const g = t.game;
      const guest = g.arrivals.makeScripted({ code: 'G' }, { x: 20, z: 0 });
      g.escorts.placeInLounge([guest], { done: true });
      g.restrooms.request(guest);
      t.refs.lounger = guest;
    },
    done: (t) => !!t.refs.lounger.respondingOfficer || !t.game.incidents.open.some((i) => i.person === t.refs.lounger),
  },
  {
    id: 'lounge',
    title: 'Visitors left in a lounge',
    focus: '#waiting-panel',
    tab: 'waiting',
    text: () =>
      'Hosts and escorts sometimes leave visitors in the breakroom or cafeteria. That’s fine for 45–60 minutes, then they wander. They’re listed under <b>Left in a lounge</b> in the Waiting panel: once this visitor is back from the restroom, <b>Send guard</b> to walk them out.',
    point: () => ['#waiting-panel [data-action="fetch"]:not(:disabled)'],
    done: (t) => {
      const v = t.refs.lounger?.visit;
      return !v || !!v.fetching || v.phase !== 'lounge' || t.refs.lounger.removed;
    },
  },
  {
    id: 'doors',
    title: 'Propped doors',
    focus: '#incident-panel',
    tab: 'incidents',
    text: () =>
      'Blue doors are <b>secure</b> (badge needed); wood doors aren\u2019t. You can\u2019t reach the doors from the desk. On level 3, staff sometimes prop secure doors open (amber): officers on patrol close any they pass and employees walking by might, but otherwise <b>send an officer</b> (the incident\u2019s button, or {verb-lc} the door\u2019s PROPPED tag). Close the <b>Server Room</b> door.',
    point: () => ['.door-flag[data-door="server"]:not([hidden]):not(.is-enroute)', '#incident-panel [data-response="dispatch"]:not(:disabled)'],
    start: (t) => t.game.doors.prop('server'),
    done: (t) => !t.game.doors.get('server').propped,
    skip: (t) => t.game.doors.close('server'),
  },
  {
    id: 'patrol',
    title: 'Hourly patrols',
    text: () =>
      'Every hour on the hour a free officer walks a set patrol route (main floor and north wing take turns), checking both ends of every room. If nobody is free within 15 minutes, the client is upset. Keep an officer free around the hour.',
    point: () => ['#topbar .stat-clock'],
  },
  {
    id: 'finish',
    title: 'You’re ready',
    text: () =>
      'That\u2019s everything: badges, appointments and their times, escorts, the waiting area, lounges, restrooms, incidents, cameras, doors and patrols. Each real shift is a new day and the same staff come back; shifts grow from 4 hours to 6 and 8, and now and then someone calls off and you pull a 16-hour double. Good luck.',
    final: true,
  },
];

export class TutorialSystem {
  constructor(game) {
    this.game = game;
    this.index = -1;
    this.refs = {};
    this.flags = {};
    this.decisions = new Map(); // person -> desk decision, as they happen
    this.complete = false; // current step done (showing "Nice!")
    this.doneTimer = 0;
    this.wrong = new Set(); // people who got a wrong call
    game.bus.on('decision', ({ member, action, correct, reason }) => {
      this.decisions.set(member, action);
      if (!correct) {
        this.wrong.add(member);
        this.lastReason = reason;
      }
    });
    game.bus.on('camera', ({ camera }) => {
      if (camera) this.flags.cameraViewed = true;
      else if (this.flags.cameraViewed) this.flags.cameraLeft = true;
    });
  }

  get step() {
    return TUTORIAL_STEPS[this.index] ?? null;
  }

  get count() {
    return TUTORIAL_STEPS.length;
  }

  /** Spawn a scripted group (see ArrivalSystem.spawnScripted). */
  spawn(specs) {
    return this.game.arrivals.spawnScripted(specs);
  }

  start() {
    this.#go(0);
  }

  #go(i) {
    this.step?.end?.(this);
    this.index = Math.min(i, TUTORIAL_STEPS.length - 1);
    this.complete = false;
    this.flags = { cameraViewed: false, cameraLeft: false };
    this.step.start?.(this);
    this.game.bus.emit('tutorial');
  }

  /** "Next" on read-only steps, or after a step is done. */
  next() {
    if (this.index < TUTORIAL_STEPS.length - 1) this.#go(this.index + 1);
  }

  skip() {
    if (!this.complete) this.step?.skip?.(this);
    this.next();
  }

  update(dt) {
    const step = this.step;
    if (!step) return;
    step.tick?.(this);
    // A wrong call on the person this step is about: say why, and send in another one.
    if (!this.complete && step.failed?.(this)) {
      this.flags.retry = this.lastReason ?? 'Not quite';
      step.start?.(this);
      this.game.bus.emit('tutorial');
    }
    if (!this.complete && step.done?.(this)) {
      this.complete = true;
      this.doneTimer = 1.8;
      this.game.bus.emit('tutorial');
    }
    if (this.complete) {
      this.doneTimer -= dt;
      if (this.doneTimer <= 0) this.next();
    }
  }
}
