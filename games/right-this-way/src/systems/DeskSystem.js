/*
 * The access desk - where the player makes entry decisions.
 *
 * Sketch: OPTION -> Deny entry / Allow entry / Call escort, with an
 * "Entry Response - 5s window" bar. Level 2+ adds the "Badge / get guest pass"
 * step: printing a pass takes time, and calling an escort is a separate
 * button - if the escort reaches the desk before the pass is printed the desk
 * freezes ("race condition" penalty).
 *
 * The entry window adapts (systems/pacing.js): it starts at twice
 * ENTRY_WINDOW and tightens toward ENTRY_WINDOW as the line and waiting area
 * fill, relaxing again when things calm down.
 *
 * There is one pass printer. It serves the visitors at the desk and visitors
 * already parked in the waiting area: a pass can be printed for anyone right
 * up until their escort physically arrives to collect them.
 *
 * Staff with an EXPIRED badge get a temporary pass from the same printer
 * ("Print temp badge") before you let them in; they then go on the day's
 * "new badges" list, and printing them a new badge (any time that day) puts
 * a fresh six-month badge on their roster entry for future days.
 *
 * Visitors who aren't on the list: "Call officer to verify" sends them aside
 * (VerificationSystem) instead of turning them away.
 *
 * Everyone is approved individually, pairs included: the desk works through
 * the group one person at a time (`current`), each with their own entry
 * window, and the group moves on once everyone has a decision. Denied people
 * leave and unlisted visitors step aside straight away; the rest go in
 * together (a visitor allowed in with their host is escorted by that host).
 *
 * The desk exposes `actions()` (what the UI should render) and `perform(id)`
 * (what a click / hotkey does), so the panel stays dumb.
 */
import { PersonState } from '../entities/Person.js';
import { evaluateMember, DeskAction, hasHost, isExpired, appointmentTiming } from './rules.js';
import { clockMinutes } from '../core/clock.js';
import { renewBadge, formatDate, fromISODate } from './credentials.js';
import { saveCareer } from '../core/career.js';
import { SYSTEM_TEXT } from '../data/incidentText.js';
import { entryLoad, targetEntryWindow, easeEntryWindow } from './pacing.js';
import { DESK_PICKUP } from '../data/layout.js';

export const DeskActionId = Object.freeze({
  ...DeskAction,
  PRINT: 'print',
  TEMP: 'temp', // temporary pass for staff (expired badge)
  VERIFY_OFFICER: DeskAction.VERIFY, // an officer checks on a visitor: not on the list, or too late
  WAIT: DeskAction.WAIT, // the waiting area: early, or no officer free
  CHECK: 'check', // open the ID-check modal for staff
  VERIFY: 'verify', // open the visitor lookup computer
});

export class DeskSystem {
  constructor(game) {
    this.game = game;
    this.group = null;
    this.window = 0; // seconds left in the entry response window
    this.entryWindow = game.settings.ENTRY_WINDOW * game.settings.ENTRY_START_MULT; // current paced length
    this.windowMax = this.entryWindow; // length of the window now running
    this.printJob = null; // { kind: 'guest'|'temp'|'badge', people, member?, remaining, total } - the single printer
    this.escortPending = null; // officer on the way to collect the visitors
    this.frozen = 0; // seconds of race-condition freeze left
    this.handoffQueue = []; // pickups waiting for the freeze to end
    this.decisions = new Map(); // member -> DeskAction, for the group at the desk
  }

  /** The person being approved right now (the first one without a decision). */
  get current() {
    if (!this.group || this.escortPending) return null;
    return this.group.members.find((m) => !this.decisions.has(m)) ?? null;
  }

  decisionFor(member) {
    return this.decisions.get(member) ?? null;
  }

  get guests() {
    return this.group?.members.filter((m) => m.isGuest) ?? [];
  }

  get staff() {
    return this.group?.members.filter((m) => !m.isGuest) ?? [];
  }

  /**
   * Entry window is paused while this group's passes print, an escort is on
   * the way, or the player is inspecting an ID / looking a visitor up.
   */
  get windowRunning() {
    return !!this.group && !this.#jobFor(this.group.members) && !this.escortPending && !this.frozen && !this.inspecting;
  }

  /** UI tells the desk when an ID-check or lookup modal is open. */
  setInspecting(on) {
    this.inspecting = on;
  }

  /** Staff whose ID hasn't been inspected / visitors not yet looked up. */
  get uncheckedStaff() {
    return this.staff.filter((m) => !m.revealed);
  }

  get unverifiedGuests() {
    return this.guests.filter((m) => !m.revealed);
  }

  /** Called by the ID-check modal once the player has looked at the cards. */
  markIdChecked(members) {
    members.forEach((m) => (m.revealed = true));
    this.game.bus.emit('desk');
  }

  /**
   * Called by the visitor computer. `entry` is the appointment the player
   * picked, or null for "not on the list". Returns 'confirmed', 'not-found'
   * or 'mismatch' (picked someone else's appointment - nothing is recorded).
   */
  recordLookup(guest, entry) {
    if (entry && entry.name !== guest.name) return 'mismatch';
    guest.revealed = true;
    guest.lookupResult = entry ? 'confirmed' : 'not-found';
    this.game.bus.emit('desk');
    this.game.bus.emit('waiting');
    return guest.lookupResult;
  }

  // -------------------------------------------------------------------------
  // The printer (shared by the desk, the waiting area and badge renewals)
  // -------------------------------------------------------------------------

  /** Seconds left on the current print job (0 = printer idle). */
  get printing() {
    return this.printJob?.remaining ?? 0;
  }

  #jobFor(people, kind = null) {
    return !!this.printJob && (!kind || this.printJob.kind === kind) && this.printJob.people.some((m) => people.includes(m));
  }

  #startJob(kind, people, seconds, extra = {}) {
    this.printJob = { kind, people, remaining: seconds, total: seconds, ...extra };
    this.game.bus.emit('desk');
  }

  /** Staff here without a temp badge (the printer can't tell whose badge is expired - you can). */
  #needsTemp(staff) {
    return staff.filter((m) => !m.tempPass);
  }

  canPrintTemp(staff = this.current ? [this.current] : []) {
    return !this.frozen && !this.printJob && this.#needsTemp(staff).length > 0;
  }

  /**
   * From the ID check: print a temp badge for the person at the desk and let
   * them in as soon as it's done (or straight away if they already have one).
   */
  printTempAndAllow(member = this.current) {
    if (!member || member !== this.current || this.frozen) return false;
    if (member.tempPass) return this.perform(DeskActionId.ALLOW);
    if (!this.canPrintTemp([member])) return false;
    this.#startJob('temp', [member], this.game.settings.BADGE_PRINT_TIME, { allowAfter: true });
    return true;
  }

  tempProgress(staff = this.current ? [this.current] : []) {
    if (!this.#jobFor(staff, 'temp')) return null;
    return 1 - this.printJob.remaining / this.printJob.total;
  }

  /** Badge renewals: print a new six-month badge for someone on today's list. */
  canRenew() {
    return !this.frozen && !this.printJob;
  }

  renewProgress(entry) {
    return this.printJob?.kind === 'badge' && this.printJob.entry === entry ? 1 - this.printJob.remaining / this.printJob.total : null;
  }

  printRenewal(entry) {
    if (!this.canRenew() || !this.game.renewals.includes(entry)) return false;
    this.#startJob('badge', [], this.game.settings.BADGE_REPRINT_TIME, { entry });
    return true;
  }

  /** Any visitor here still needs a pass (and isn't known to have no appointment). */
  needsPass(guests) {
    return guests.some((m) => m.isGuest && !m.hasPass && !(m.revealed && !m.valid));
  }

  canPrint(guests) {
    return this.game.features.guestPasses && !this.frozen && !this.printJob && this.needsPass(guests);
  }

  /** 0..1 progress if the printer is working on these visitors' passes, else null. */
  printProgress(guests) {
    if (!this.#jobFor(guests, 'guest')) return null;
    return 1 - this.printJob.remaining / this.printJob.total;
  }

  /** Short label for a print button aimed at these visitors. */
  printLabel(guests) {
    if (this.#jobFor(guests, 'guest')) return 'Printing pass\u2026';
    if (!this.needsPass(guests)) return guests.some((m) => m.revealed && !m.valid) ? 'No appointment' : 'Pass printed';
    if (this.printJob) return 'Printer busy';
    return 'Print guest pass';
  }

  printFor(guests) {
    if (!this.canPrint(guests)) return false;
    this.#startJob('guest', guests.filter((m) => m.isGuest), this.game.settings.BADGE_PRINT_TIME);
    return true;
  }

  /** Drop the print job if these people are leaving (allowed, denied, wandered off). */
  cancelPrintFor(people) {
    if (this.#jobFor(people)) this.printJob = null;
  }

  begin(group) {
    const g = this.game;
    this.group = group;
    this.decisions = new Map();
    this.#startWindow();
    group.members.forEach((m) => {
      m.state = PersonState.AT_DESK;
      m.patience = 0;
      if (m.isGuest ? !g.features.appointmentChecks : !g.features.badgeChecks) m.revealed = true;
    });
    g.bus.emit('desk');
  }

  #startWindow() {
    this.windowMax = this.entryWindow;
    this.window = this.windowMax;
  }

  /** How busy the front of house is right now, 0..1 (drives the pacing). */
  get load() {
    const g = this.game;
    return entryLoad(
      {
        lineCount: g.queue.line.length,
        lineCapacity: g.queue.capacity,
        waitingCount: g.waiting.occupancy,
        waitingCapacity: g.settings.WAITING_CAPACITY,
      },
      g.settings,
    );
  }

  /** What the desk panel should show for the current person. Each: { id, label, key, enabled, tone, hint } */
  actions() {
    const g = this.game;
    if (!this.group) return [];
    if (this.escortPending) return [{ id: DeskActionId.ESCORT, label: 'Escort en route\u2026', key: 'E', enabled: false, tone: 'escort' }];
    const cur = this.current;
    if (!cur) return [];
    const locked = this.frozen > 0;
    const out = [];

    // Inline actions: rendered on the person's row in the desk card (and on hotkeys).
    if (!cur.isGuest && g.features.badgeChecks) {
      out.push({ id: DeskActionId.CHECK, inline: true, label: cur.revealed ? 'ID checked' : 'Check ID', key: 'B', enabled: !locked, tone: 'neutral', done: cur.revealed });
    }
    if (cur.isGuest && g.features.appointmentChecks) {
      out.push({ id: DeskActionId.VERIFY, inline: true, label: cur.revealed ? 'Look up again' : 'Verify appointment', key: 'V', enabled: !locked, tone: 'neutral', done: cur.revealed });
    }
    if (!cur.isGuest) {
      const busy = this.#jobFor([cur], 'temp');
      out.push({
        id: DeskActionId.TEMP,
        label: busy ? 'Printing temp badge\u2026' : cur.tempPass ? 'Temp badge printed' : this.printJob ? 'Printer busy' : 'Print temp badge',
        key: 'T',
        enabled: !locked && this.canPrintTemp([cur]),
        tone: 'info',
        progress: this.tempProgress([cur]),
        tip: 'For staff whose badge has expired: lets them in for today',
      });
    }
    if (cur.isGuest && g.features.guestPasses) {
      out.push({
        id: DeskActionId.PRINT,
        label: this.printLabel([cur]),
        key: 'P',
        enabled: this.canPrint([cur]),
        tone: 'info',
        progress: this.printProgress([cur]),
      });
    }

    // "Temp badge & allow" in progress: they go in by themselves once it prints.
    const autoAllow = !!this.printJob?.allowAfter && this.printJob.people.includes(cur);
    out.push({ id: DeskActionId.DENY, label: 'Deny', key: 'D', enabled: !locked && !autoAllow, tone: 'danger' });
    out.push({ id: DeskActionId.ALLOW, label: autoAllow ? 'Allowing once printed\u2026' : 'Allow', key: 'A', enabled: !locked && !autoAllow, tone: 'ok' });
    if (cur.isGuest) {
      const officer = g.escorts.idleOfficer();
      const seated = this.group.members.filter((m) => [DeskAction.ESCORT, DeskAction.WAIT].includes(this.decisions.get(m))).length;
      const fits = g.waiting.freeSeats() >= seated + 1;
      out.push({ id: DeskActionId.ESCORT, label: 'Call escort', key: 'E', enabled: !locked && !!officer, tone: 'escort', tip: officer ? 'An officer walks them to their appointment' : 'No officer free' });
      out.push({
        id: DeskActionId.WAIT,
        label: 'Waiting area',
        key: 'W',
        enabled: !locked && fits,
        tone: 'wait',
        tip: fits ? 'Early for their appointment (or no officer free): they wait until a guard can collect them' : 'Waiting area full',
      });
      out.push({
        id: DeskActionId.VERIFY_OFFICER,
        label: 'Officer verify',
        key: 'O',
        enabled: !locked,
        tone: 'warn',
        tip: 'Not on the list, or more than 15 minutes late: an officer checks with their host',
      });
    }
    return out;
  }

  perform(id) {
    const action = this.actions().find((a) => a.id === id);
    if (!action?.enabled) return false;
    const cur = this.current;
    switch (id) {
      case DeskActionId.ALLOW:
      case DeskActionId.DENY:
      case DeskActionId.ESCORT:
      case DeskActionId.WAIT:
      case DeskActionId.VERIFY_OFFICER:
        this.#decide(cur, id);
        break;
      case DeskActionId.PRINT: this.printFor([cur]); break;
      case DeskActionId.TEMP: this.#startJob('temp', [cur], this.game.settings.BADGE_PRINT_TIME); break;
      case DeskActionId.CHECK: this.#check(); break;
      case DeskActionId.VERIFY: this.#verify(); break;
      default: return false;
    }
    return true;
  }

  /** One person's decision: scored now; denied / unlisted people leave the desk now. */
  #decide(m, action) {
    const g = this.game;
    const hostAllowed = this.group.members.some((o) => !o.isGuest && this.decisions.get(o) === DeskAction.ALLOW);
    if (m.isGuest && m.appointment) {
      const arrived = m.arrivedMinutes ?? clockMinutes(g.time, g.settings);
      m.timing = appointmentTiming(m.appointment.minutes, arrived, g.settings.APPOINTMENT_GRACE_MINUTES);
    }
    const officerFree = !!g.escorts.idleOfficer();
    // Did they look before deciding? (Check ID / Verify appointment, where the level has them.)
    const checked = m.revealed || !(m.isGuest ? g.features.appointmentChecks : g.features.badgeChecks);
    const result = evaluateMember(m, action, { hostAllowed, officerFree, checked, features: g.features, score: g.settings.SCORE });
    g.score.count(result.unchecked ? 'uncheckedDecisions' : result.correct ? 'correctDecisions' : 'wrongDecisions');
    if (result.correct) {
      g.score.add(result.delta, result.unchecked ? result.outcomes[0].reason : 'Correct call', m.pos);
    } else {
      // Every mistake says why, on the popup and in the log.
      for (const o of result.outcomes) {
        g.score.add(o.delta, o.reason, m.pos);
        g.incidents.create(m, 'info', `${o.text} ${o.reason}.`);
      }
    }
    this.decisions.set(m, action);
    g.bus.emit('decision', { member: m, action, correct: result.correct, reason: result.correct ? null : result.outcomes[0]?.reason });
    if (action === DeskAction.DENY) {
      this.cancelPrintFor([m]);
      g.leave(m);
    } else if (action === DeskAction.VERIFY) {
      this.cancelPrintFor([m]);
      g.verification.add([m]);
    } else {
      m.status = action === DeskAction.ESCORT ? 'Waiting for escort' : action === DeskAction.WAIT ? 'To the waiting area' : 'Approved';
    }
    if (this.current) {
      this.#startWindow(); // the next person gets their own window
      g.bus.emit('desk');
    } else {
      this.#complete();
    }
  }

  /** Everyone at the desk has a decision: in they go. */
  #complete() {
    const g = this.game;
    const members = this.group.members;
    const decided = (a) => members.filter((m) => this.decisions.get(m) === a);
    g.score.count('groupsProcessed');
    const staffIn = decided(DeskAction.ALLOW).filter((m) => !m.isGuest);
    const guestsIn = decided(DeskAction.ALLOW).filter((m) => m.isGuest);
    const escorted = decided(DeskAction.ESCORT);
    const waiters = decided(DeskAction.WAIT);
    members.forEach((m) => (m.status = ''));
    this.cancelPrintFor([...staffIn, ...guestsIn]);

    const host = staffIn[0] ?? null;
    if (host && guestsIn.length) {
      this.#admitStaff(staffIn.filter((m) => m !== host));
      this.#noteRenewal(host);
      g.escorts.hostEscort(host, guestsIn);
    } else {
      this.#admitStaff(staffIn);
      for (const guest of guestsIn) {
        g.score.count('unescortedLetIn');
        g.wander.admit(guest, { tailgate: true });
      }
    }

    const officer = escorted.length ? g.escorts.idleOfficer(DESK_PICKUP) : null;
    if (!officer) waiters.push(...escorted); // (the officer got busy in the meantime)
    if (waiters.length) g.waiting.add(waiters);
    if (officer) {
      escorted.forEach((m) => (m.status = 'Waiting for escort'));
      this.group.members = escorted;
      this.escortPending = officer;
      g.escorts.dispatch(officer, escorted, { source: 'desk' });
      g.bus.emit('desk');
      return;
    }
    this.#finish();
  }

  /** Tutorial: drop whoever is at the desk without a decision (they're handled elsewhere). */
  abandon() {
    if (!this.group) return;
    this.cancelPrintFor(this.group.members);
    this.#finish();
  }

  /** Staff going in: anyone on a temp badge with an expired badge needs a new one today. */
  #noteRenewal(m) {
    const g = this.game;
    if (m.tempPass && isExpired(m) && m.roster && !g.renewals.some((r) => r.member === m.roster)) {
      g.renewals.push({ member: m.roster, name: m.name, person: m });
      g.bus.emit('desk');
    }
  }

  #admitStaff(staff) {
    for (const m of staff) {
      this.#noteRenewal(m);
      this.game.staff.admit(m);
    }
  }

  /** ID check for the person being approved. */
  #check() {
    const cur = this.current;
    if (cur && !cur.isGuest) this.game.bus.emit('idCheck', { members: [cur] });
  }

  /** Open the visitor computer for a specific visitor (default: the one being approved). */
  #verify(guest = this.current?.isGuest ? this.current : this.unverifiedGuests[0]) {
    if (guest) this.game.bus.emit('visitorLookup', { guest });
  }

  verifyGuest(guest) {
    if (this.group?.members.includes(guest) && !this.frozen) this.#verify(guest);
  }

  #completePrint() {
    const g = this.game;
    const job = this.printJob;
    this.printJob = null;
    if (job.kind === 'temp') {
      job.people.forEach((m) => (m.tempPass = true));
      g.bus.emit('desk');
      const m = job.people[0];
      if (job.allowAfter && m === this.current && !this.decisions.has(m)) this.perform(DeskActionId.ALLOW);
      return;
    }
    if (job.kind === 'badge') {
      const { member, name, person } = job.entry;
      renewBadge(member, g.date, g.settings.BADGE_VALID_MONTHS);
      saveCareer(g.career);
      g.renewals = g.renewals.filter((r) => r !== job.entry);
      g.score.count('badgesRenewed');
      g.incidents.create(person?.removed ? null : person, 'info', `New badge printed for ${name}, valid until ${formatDate(fromISODate(member.expires))}.`, { title: person?.removed ? name : undefined });
      g.bus.emit('desk');
      return;
    }
    for (const guest of job.people) {
      // The pass system checks the appointment book itself.
      guest.revealed = true;
      guest.lookupResult = guest.valid ? 'confirmed' : 'not-found';
      if (guest.valid) guest.setPass(true);
    }
    this.game.bus.emit('desk');
    this.game.bus.emit('waiting');
  }

  /** Visitors leave the desk; next group in line steps up. A print job for them keeps running. */
  #finish() {
    this.group = null;
    this.escortPending = null;
    this.decisions = new Map();
    this.game.queue.shift();
  }

  /**
   * An escort has reached visitors (at the desk or the waiting area). With
   * guest passes enabled, any visitor without a printed pass triggers the
   * race-condition freeze; the pickup completes once the desk unfreezes.
   */
  requestHandoff(guests, onReady) {
    const g = this.game;
    const missing = g.features.guestPasses && guests.some((m) => !m.hasPass);
    if (!missing) {
      this.#releaseFromDesk(guests);
      onReady();
      return;
    }
    if (!this.frozen) {
      this.frozen = g.settings.RACE_PENALTY_FREEZE;
      g.score.count('raceConditions');
      g.score.add(g.settings.SCORE.RACE_CONDITION, 'Badge race condition', guests[0].pos);
      g.incidents.create(guests[0], 'info', SYSTEM_TEXT.raceCondition);
    }
    this.handoffQueue.push({ guests, onReady });
    g.bus.emit('desk');
  }

  #releaseFromDesk(guests) {
    if (this.group && guests.some((m) => this.group.members.includes(m))) this.#finish();
  }

  update(dt) {
    const g = this.game;
    this.entryWindow = easeEntryWindow(this.entryWindow, targetEntryWindow(this.load, g.settings), dt, g.settings);

    if (this.frozen) {
      this.frozen = Math.max(0, this.frozen - dt);
      if (!this.frozen) {
        // Emergency passes are issued once the freeze clears.
        for (const { guests, onReady } of this.handoffQueue.splice(0)) {
          guests.forEach((m) => m.setPass(true));
          if (this.printJob?.kind === 'guest' && this.printJob.people.every((m) => m.hasPass)) this.printJob = null;
          this.#releaseFromDesk(guests);
          onReady();
        }
        g.bus.emit('desk');
        g.bus.emit('waiting');
      }
      return;
    }

    if (this.printJob) {
      this.printJob.remaining -= dt;
      if (this.printJob.remaining <= 0) this.#completePrint();
    }

    if (this.windowRunning) {
      this.window -= dt;
      if (this.window <= 0) {
        g.score.count('entryTimeouts');
        g.score.add(g.settings.SCORE.ENTRY_TIMEOUT, 'Too slow at the desk', this.group.members[0].pos);
        this.#startWindow();
      }
    }
  }

  /** Display info for the desk card. */
  describe() {
    if (!this.group) return null;
    const host = hasHost(this.group.members);
    return {
      members: this.group.members,
      current: this.current,
      accompanied: host,
      window: this.window,
      windowMax: this.windowMax,
      windowRunning: this.windowRunning,
    };
  }
}
