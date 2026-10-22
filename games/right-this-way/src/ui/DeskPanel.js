/*
 * Access Desk panel: who is at the desk, their credentials, the Entry
 * Response bar, and the decision buttons. Buttons come from
 * DeskSystem.actions(), so the panel never decides game rules itself.
 * Underneath: today's "new badges" to-do list (staff let in on a temp badge).
 */
import { $, el, typeDot, setBar, press } from './dom.js';
import { groupVerdict } from '../systems/rules.js';
import { formatClock } from '../core/clock.js';

const DECISION_CHIP = {
  allow: ['Allowed \u2713', 'cred-ok'],
  deny: ['Denied', 'cred-bad'],
  escort: ['Escort', 'cred-pass'],
  officerVerify: ['Verifying', 'cred-unknown'],
  wait: ['Waiting area', 'cred-unknown'],
};

const TONE_CLASS = {
  ok: 'btn-ok',
  danger: 'btn-danger',
  escort: 'btn-escort',
  wait: 'btn-wait',
  info: 'btn-info',
  neutral: 'btn-neutral',
  warn: 'btn-wait',
};

/**
 * The credential cell on a person's row. Unverified people get a button that
 * opens the ID check (staff) or the visitor computer (visitors); afterwards it
 * shows what the player found - never the hidden truth.
 */
function credential(member, game) {
  const { features, desk } = game;
  // data-action: what the tutorial's pointer looks for ('check' / 'verify' until done).
  const button = (label, cls, fn, title, action) =>
    el('button', { class: `cred-btn ${cls}`, title, 'data-action': action, ...press(fn) }, label);

  if (member.isGuest) {
    const lookup = () => desk.verifyGuest(member);
    let chip;
    if (!features.appointmentChecks) chip = el('span', { class: `cred ${member.valid ? 'cred-ok' : 'cred-bad'}` }, member.valid ? 'Appointment \u2713' : 'No appointment');
    else if (!member.revealed) chip = button(['Verify appointment', el('kbd', {}, 'V')], 'cred-go', lookup, 'Look this visitor up on the desk computer', 'verify');
    else if (member.lookupResult === 'not-found') chip = button('Not on list \u2717', 'cred-bad', lookup, 'Look up again');
    else {
      const a = member.appointment;
      chip = button(a ? `\u2713 ${formatClock(a.minutes).replace(/^0/, '')} \u00b7 ${a.roomLabel}` : 'Appointment \u2713', 'cred-ok', lookup, a ? `Host: ${a.host}` : '');
    }
    // When they walked in: what the appointment time is checked against.
    const arrived = member.revealed && member.appointment && member.arrivedMinutes != null
      ? el('span', { class: 'cred-note', title: 'Within 15 minutes of the appointment either way is on time' }, `Arrived ${formatClock(member.arrivedMinutes).replace(/^0/, '')}`)
      : null;
    if (features.guestPasses && member.revealed && member.valid) {
      return el('div', { class: 'cred-stack' }, [
        chip,
        arrived,
        member.hasPass ? el('span', { class: 'cred cred-pass' }, 'Pass printed') : el('span', { class: 'cred cred-unknown' }, 'Needs pass'),
      ]);
    }
    return arrived ? el('div', { class: 'cred-stack' }, [chip, arrived]) : chip;
  }

  const check = () => desk.perform('check');
  if (!features.badgeChecks) {
    return member.valid
      ? el('span', { class: 'cred cred-ok' }, member.isDuty ? 'On duty \u2713' : 'Badge valid')
      : el('span', { class: 'cred cred-bad' }, 'Badge EXPIRED');
  }
  const temp = member.tempPass ? el('span', { class: 'cred cred-pass' }, 'Temp badge') : null;
  const id = !member.revealed
    ? button(['Check ID', el('kbd', {}, 'B')], 'cred-go', check, 'Inspect their ID card', 'check')
    : button('ID checked \u2713', 'cred-done', check, 'Look at the ID again');
  return temp ? el('div', { class: 'cred-stack' }, [id, temp]) : id;
}

export class DeskPanel {
  constructor(app) {
    this.app = app;
    this.body = $('#desk-body');
    this.actionsEl = $('#desk-actions');
    this.timer = $('#desk-timer');
    this.pace = $('#desk-pace');
    this.queueChip = $('#desk-queue');
    this.frozen = $('#desk-frozen');
    this.frozenTimer = $('#desk-frozen-timer');
    this.renewalsEl = $('#desk-renewals');
    this.renewBars = new Map();
    this.dirty = true;
    for (const evt of ['desk', 'officers', 'waiting']) app.bus.on(evt, () => (this.dirty = true));
  }

  #renderRenewals(game) {
    const desk = game.desk;
    this.renewBars.clear();
    this.renewalsEl.hidden = !game.renewals.length;
    if (!game.renewals.length) return this.renewalsEl.replaceChildren();
    this.renewalsEl.replaceChildren(
      el('div', { class: 'renew-head' }, [el('span', {}, 'New badges to print'), el('span', { class: 'chip chip-warn' }, String(game.renewals.length))]),
      ...game.renewals.map((entry) => {
        const progress = desk.renewProgress(entry);
        const bar = el('span', { class: 'btn-progress', style: { width: `${(progress ?? 0) * 100}%` } });
        this.renewBars.set(entry, bar);
        return el('div', { class: 'renew-row' }, [
          el('span', { class: 'renew-name' }, entry.name),
          el(
            'button',
            { class: 'btn btn-sm btn-info', 'data-action': 'renew', disabled: !desk.canRenew(), title: 'Print a new six-month badge', style: { position: 'relative', overflow: 'hidden' }, ...press(() => desk.printRenewal(entry)) },
            [progress !== null ? 'Printing\u2026' : desk.printJob ? 'Printer busy' : 'Print badge', bar],
          ),
        ]);
      }),
    );
  }

  render(game) {
    const desk = game.desk;
    const info = desk.describe();
    this.#renderRenewals(game);
    this.body.replaceChildren();
    this.actionsEl.replaceChildren();
    this.queueChip.textContent = `Line: ${Math.max(0, game.queue.line.length - (desk.group ? 1 : 0))}`;

    if (!info) {
      this.body.append(el('div', { class: 'empty' }, 'Awaiting next arrival…'));
      return;
    }

    const verdict = groupVerdict(info.members);
    const n = info.members.length;
    const idx = info.current ? info.members.indexOf(info.current) + 1 : 0;
    const status = (m) => {
      const d = desk.decisionFor(m);
      if (d) return el('span', { class: `cred ${DECISION_CHIP[d][1]}` }, DECISION_CHIP[d][0]);
      if (m === info.current) return credential(m, game);
      return el('span', { class: 'cred cred-unknown' }, 'Next');
    };
    const box = el('div', { class: 'desk-group' }, [
      el('div', { class: `desk-verdict ${verdict === 'ok' ? 'ok' : 'bad'}` },
        verdict === 'ok'
          ? info.members.some((m) => m.isGuest) ? '✓ Visitor is accompanied by staff' : '✓ Staff arrival'
          : '✗ Unaccompanied visitor – needs an escort'),
      info.current && n > 1 ? el('div', { class: 'desk-step' }, `Approving ${idx} of ${n}: ${info.current.name}`) : null,
      ...info.members.map((m) =>
        el('div', { class: `member ${m === info.current ? 'is-current' : ''} ${desk.decisionFor(m) ? 'is-decided' : ''}` }, [
          typeDot(m.type),
          el('div', {}, [
            el('div', { class: 'member-name' }, m.name),
            el('div', { class: 'member-role', style: { color: m.type.css } }, m.isDuty ? 'Duty officer' : m.type.label),
            m.isGuest && m.greeting && m === info.current ? el('div', { class: 'member-says' }, `\u201c${m.greeting}\u201d`) : null,
          ]),
          status(m),
        ]),
      ),
    ]);
    this.body.append(box);

    const actions = desk.actions();
    const decisions = ['deny', 'allow', 'escort', 'wait', 'officerVerify'];
    const primary = actions.filter((a) => decisions.includes(a.id));
    const extra = actions.filter((a) => !a.inline && !decisions.includes(a.id));
    // Twelve-column grid: extra steps (temp badge / guest pass) on top, decisions below
    // (five decisions wrap to a row of three and a row of two).
    const spanFor = (a) => {
      if (extra.includes(a)) return 12 / extra.length;
      const n = primary.length;
      if (n <= 3) return 12 / n;
      if (n === 4) return 6;
      return primary.indexOf(a) < 3 ? 4 : 6;
    };
    for (const a of [...extra, ...primary]) {
      const span = spanFor(a);
      const hasProgress = a.progress !== null && a.progress !== undefined;
      const btn = el(
        'button',
        {
          class: `btn ${TONE_CLASS[a.tone] ?? ''}`,
          'data-action': a.id,
          style: { gridColumn: `span ${span}` },
          disabled: !a.enabled,
          title: a.tip || a.hint || a.label,
          ...press(() => desk.perform(a.id)),
        },
        [
          el('span', { class: 'stack' }, [
            el('span', {}, [a.label, el('kbd', {}, a.key)]),
            a.hint ? el('span', { class: 'hint' }, a.hint) : null,
          ]),
          hasProgress ? el('span', { class: 'btn-progress', style: { width: `${a.progress * 100}%` } }) : null,
        ],
      );
      if (hasProgress) this.progressBar = btn.querySelector('.btn-progress');
      this.actionsEl.append(btn);
    }
  }

  tick(game) {
    // Officers change jobs without always announcing it: re-render when the free
    // count changes, so "Dispatch" / "Call escort" / "Send guard" are never stale.
    const free = game.escorts.availableCount;
    if (free !== this.freeOfficers) {
      this.freeOfficers = free;
      this.dirty = true;
    }
    if (this.dirty) {
      this.dirty = false;
      this.progressBar = null;
      this.render(game);
    }
    const desk = game.desk;
    if (desk.group) {
      setBar(this.timer, desk.window / desk.windowMax, { paused: !desk.windowRunning });
    } else {
      setBar(this.timer, 0);
    }
    for (const [entry, bar] of this.renewBars) {
      const p = desk.renewProgress(entry);
      if (p !== null) bar.style.width = `${p * 100}%`;
    }
    const progress = desk.group ? desk.printProgress(desk.guests) ?? desk.tempProgress() : null;
    if (this.progressBar && progress !== null) this.progressBar.style.width = `${progress * 100}%`;
    // Current pace (how long the NEXT group gets), e.g. "8.4s"
    const pace = `${(desk.group ? desk.window : desk.entryWindow).toFixed(1)}s`;
    if (this.pace.textContent !== pace) this.pace.textContent = pace;
    this.frozen.hidden = !desk.frozen;
    if (desk.frozen) setBar(this.frozenTimer, desk.frozen / game.settings.RACE_PENALTY_FREEZE, { invert: false });
  }
}
