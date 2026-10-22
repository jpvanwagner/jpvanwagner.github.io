/*
 * Full-screen overlays:
 *   start     - title, level select, how it works, controls, credit link
 *   briefing  - popup before every shift: objectives, with a "full mechanics" view
 *   pause     - how to play + controls, resume / restart / quit
 *   end       - the end-of-shift performance review
 *
 * Wording adapts to touch vs mouse ("Tap" / "Click") via ui/input.js.
 * On anything bigger than a phone, a card that would still be taller than the
 * window (after the --ui-zoom scaling) is shrunk to fit, so no screen scrolls.
 */
import { $, el, press } from './dom.js';
import { LEVELS, TUTORIAL } from '../config/levels.js';
import { CREDITS, GAME, copyrightYears } from '../config/credits.js';
import { resolveSettings } from '../config/settings.js';
import { verbSpans, isTouch } from './input.js';
import { careerCompany, careerDate } from '../core/career.js';
import { companyLogoSvg, COMPANIES } from '../data/companies.js';
import { formatDate, formatWeekday } from '../systems/credentials.js';
import { prefs, setPref } from '../core/prefs.js';
import { gradeSheet, pngOf, saveImage, shareNative, shareLinks, shareText, canCopyImage, copyImage, copyText } from './gradeSheet.js';

const SETTINGS_ROWS = [
  ['officerHighlight', 'Highlight officers', 'A pulsing glow under every officer, so they\u2019re easy to spot.'],
  ['incidentHighlight', 'Highlight trouble', 'Glow under unescorted visitors, restroom requests, visitors left in lounges and propped doors.'],
  ['allNames', 'Name tags on everyone', 'Otherwise only visitors and busy officers get tags. (N)'],
  ['keyHints', 'Keyboard hints', 'Show shortcut keys on buttons.'],
  ['legend', 'Map legend', 'The colour key in the corner of the map (on roomy screens).'],
  ['daylight', 'Moving sun', 'Light and shadows move across the shift.'],
  ['smoothCamera', 'Smooth camera flights', 'Off: security cameras cut straight to the view.'],
];
const UI_SIZES = [['auto', 'Auto'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];

const html = (tag, attrs, markup) => el(tag, { ...attrs, html: markup.replaceAll('{verb}', verbSpans(true)).replaceAll('{verb-lc}', verbSpans(false)) });

const dots = (code) =>
  el('span', { class: 'dots' }, [...code].map((c) => el('span', { class: `dot dot-${{ G: 'guest', E: 'employee', O: 'officer' }[c]}` })));

function controls() {
  const keys = [
    ['A / D / E', 'Allow / deny / call escort'],
    ['W', 'Waiting area (early, or no officer free)'],
    ['B', 'Check staff ID'],
    ['V', 'Verify visitor appointment'],
    ['↑↓←→ ↵', 'Find a name on the desk computer'],
    ['T', 'Temp badge & allow (expired staff badge)'],
    ['O', 'Officer verify (not on the list, or late)'],
    ['P', 'Print guest pass (level 2+)'],
    ['1-3', 'Answer the top incidents'],
    ['[ ]', 'Cycle security cameras'],
    ['⌫ Backspace', 'Back to map / close'],
    ['+ − 0', 'Zoom map (or scroll / drag)'],
    ['Space', 'Pause'],
    [', .', 'Slower / faster (½× to 3×)'],
    ['N', 'Name tags on everyone'],
    ['F', 'Fullscreen'],
  ];
  const touch = [
    ['Tap', 'Desk, waiting and incident buttons'],
    ['Check ID / Verify', 'Inspect IDs and look visitors up'],
    ['Tabs', 'Switch panels on small screens'],
    ['Pinch / drag', 'Zoom and pan the map'],
    ['Double-tap', 'Fit the whole map'],
    ['CAM tag', 'Zoom into a 3D camera view'],
    ['Tap a person', 'Who they are and what they\u2019re doing'],
  ];
  return el('div', {}, [
    el('div', { class: 'keys when-mouse' }, keys.flatMap(([k, v]) => [el('kbd', {}, k), el('span', {}, v)])),
    el('div', { class: 'keys when-touch' }, touch.flatMap(([k, v]) => [el('b', {}, k), el('span', {}, v)])),
  ]);
}

/*
 * "How to play": the rules in four short tabs (the desk, after the desk,
 * scoring, controls), shared by the title, briefing and pause screens. One
 * tab at a time keeps each screen readable at a glance.
 */
const HOWTO_TABS = [
  ['desk', 'At the desk', 'Desk'],
  ['after', 'After the desk', 'After'],
  ['score', 'Scoring', 'Scoring'],
  ['keys', 'Controls', 'Keys'],
];
let howtoTab = 'desk'; // remembered between screens

/** A desk decision, styled like its button (with its key). */
const act = (label, tone, key) => el('span', { class: `act act-${tone}` }, [label, key ? el('kbd', {}, key) : null]);

function deskTab() {
  // [who (dots, label), what to look at, what to press]
  const rows = [
    ['EO', 'Badge OK', 'Check ID', [act('Allow', 'ok', 'A')]],
    ['E', 'Badge expired', 'Expiry vs. today', [act('Temp badge & allow', 'info', 'T')]],
    ['E', 'Not their badge', 'Photo \u2260 face', [act('Deny', 'danger', 'D')]],
    ['G', 'On time', 'Verify appointment', [act('Call escort', 'escort', 'E'), el('small', {}, 'or if none free'), act('Waiting area', 'wait', 'W')]],
    ['EG', 'With their host', 'Allow the host first', [act('Allow', 'ok', 'A')]],
    ['G', '15+ min early', 'Appointment vs. arrival', [act('Waiting area', 'wait', 'W')]],
    ['G', '15+ min late, or not listed', 'Desk computer', [act('Officer verify', 'warn', 'O')]],
  ];
  return el('div', { class: 'howto-pane' }, [
    el('div', { class: 'guide-legend' }, [el('span', {}, [dots('E'), ' Staff']), el('span', {}, [dots('O'), ' Officer']), el('span', {}, [dots('G'), ' Visitor'])]),
    el('div', { class: 'guide' }, rows.map(([code, who, look, actions]) =>
      el('div', { class: 'guide-row' }, [
        el('span', { class: 'guide-who' }, [dots(code), el('span', {}, [who, el('small', { class: 'guide-look-inline' }, look)])]),
        el('span', { class: 'guide-look' }, look),
        el('span', { class: 'guide-act' }, actions),
      ]),
    )),
    html('p', { class: 'howto-tip' }, '<b>Always check first.</b> A right call you didn\u2019t check (Check ID / Verify appointment) scores nothing. From level 2, print a visitor\u2019s <b>guest pass</b> before their escort arrives.'),
  ]);
}

function afterTab() {
  const s = resolveSettings();
  const rows = [
    ['Waiting area', `9 seats. Dispatch an officer before visitors lose patience and slip inside.`],
    ['Escorts', 'Walk visitors to their meeting; the host takes over. Service visits (server room, IT, records) keep the escort.'],
    ['Lounges', `Visitors left there are fine for ${s.LOUNGE_PATIENCE_MINUTES[0]}\u2013${s.LOUNGE_PATIENCE_MINUTES[1]} min, then wander: Send guard.`],
    ['Restrooms', 'Visitors need a guard, except the single stall by the waiting area.'],
    ['Incidents', 'Answer before the bar runs out. Every loose visitor doubles the multiplier.'],
    ['Cameras', '{verb} a CAM tag: watching pauses a visitor\u2019s timer, but only an officer resolves it.'],
    ['Patrols', `Every hour on the hour. Keep an officer free (${s.PATROL_GRACE_MINUTES} min grace).`],
    ['Doors', 'Propped open (amber)? Send an officer.'],
  ];
  return el('div', { class: 'howto-pane' }, [
    el('dl', { class: 'facts' }, rows.flatMap(([k, v]) => [el('dt', {}, k), html('dd', {}, v)])),
  ]);
}

function scoreTab() {
  const S = resolveSettings().SCORE;
  const sign = (n) => (n > 0 ? `+${n}` : n < 0 ? `\u2212${-n}` : '0');
  const rows = [
    [S.CORRECT_ENTRY, 'Right call, after checking'],
    [S.UNCHECKED_ENTRY, 'Right call, but you didn\u2019t check'],
    [S.WRONG_ENTRY, 'Small slip: needless verify, early / late mixed up, no guest pass'],
    [S.DENIED_VALID, 'Turned away someone who belongs (expired badges too)'],
    [S.UNESCORTED, 'Visitor let in alone, or not on the list'],
    [S.BORROWED_BADGE, 'Let someone in on another person\u2019s badge'],
    [S.INCIDENT_ADDRESSED, 'Incident answered in time (missed: \u22121 \u00d7 multiplier)'],
    [S.VISIT_COMPLETED, 'Escorted visit completed'],
    [S.ENTRY_TIMEOUT, 'Entry window runs out, or a new badge still owed at day\u2019s end'],
  ];
  return el('div', { class: 'howto-pane' }, [
    el('div', { class: 'points' }, rows.flatMap(([n, label]) => [el('b', { class: n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero' }, sign(n)), el('span', {}, label)])),
    el('p', { class: 'howto-tip' }, 'Every mistake pops up with the reason, and is logged in the incident log.'),
  ]);
}

/** The tabbed rules. `onChange` lets the screen re-fit its card. */
function howToPlay({ onChange } = {}) {
  const body = el('div', { class: 'howto-body' });
  const tabs = HOWTO_TABS.map(([id, label, short]) =>
    el('button', { class: 'howto-tab', role: 'tab', 'data-tab': id, 'aria-label': label, ...press(() => show(id)) }, [
      el('span', { class: 'tab-long' }, label),
      el('span', { class: 'tab-short' }, short),
    ]),
  );
  const show = (id) => {
    howtoTab = id;
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    body.replaceChildren({ desk: deskTab, after: afterTab, score: scoreTab, keys: () => el('div', { class: 'howto-pane' }, [controls()]) }[id]());
    onChange?.();
  };
  const root = el('div', { class: 'howto' }, [el('div', { class: 'howto-tabs', role: 'tablist' }, tabs), body]);
  show(howtoTab);
  return root;
}

/** The employer card: logo, name, today's date and day number. */
function employer(career, { onPick, current = false } = {}) {
  const company = careerCompany(career);
  const day = current ? career.day : career.day + 1; // the title screen shows the coming shift
  const nextDay = careerDate({ ...career, day });
  return el('div', { class: 'employer' }, [
    el('div', { class: 'employer-logo', html: companyLogoSvg(company, { size: 56 }) }),
    el('div', { class: 'employer-text' }, [
      el('div', { class: 'employer-label' }, day > 1 ? `Day ${day} at the front desk` : 'Your new employer'),
      el('div', { class: 'employer-name' }, company.name),
      el('div', { class: 'employer-tag' }, `\u201c${company.tagline}\u201d \u00b7 ${formatWeekday(nextDay)} ${formatDate(nextDay)}`),
    ]),
  ]);
}

/** Every employer's logo; pick one to start a new career there. */
function employerPicker(career, onPick) {
  return el('div', { class: 'employer-pick' }, [
    el('span', { class: 'employer-pick-label' }, 'Employers (picking one starts over on day 1):'),
    el(
      'div',
      { class: 'employer-pick-row' },
      COMPANIES.map((c) =>
        el('button', {
          class: `employer-chip ${c.id === career.companyId ? 'is-current' : ''}`,
          title: `${c.name}${c.id === career.companyId ? ' (current)' : ''}`,
          'aria-label': c.name,
          html: companyLogoSvg(c, { size: 46, title: false }),
          ...press(() => onPick(c.id)),
        }),
      ),
    ),
  ]);
}

function creditLink() {
  return el('a', { class: 'credit', href: CREDITS.url, target: '_blank', rel: 'noopener' }, [
    CREDITS.icon ? el('img', { class: 'credit-icon', src: CREDITS.icon, alt: '' }) : null,
    `\u00a9 ${copyrightYears()} ${CREDITS.author}`,
  ]);
}

export class Screens {
  constructor(app) {
    this.app = app;
    this.start = $('#screen-start');
    this.briefing = $('#screen-briefing');
    this.pause = $('#screen-pause');
    this.end = $('#screen-end');
    this.settings = $('#screen-settings');
    this.selectedLevel = TUTORIAL.id; // new players start with the tutorial
    app.bus.on('shift:end', ({ summary }) => this.showEnd(summary));
    app.bus.on('pause', ({ paused, reason }) => {
      if (paused && reason !== 'briefing' && reason !== 'settings') this.showPause();
      if (!paused) this.pause.hidden = true;
    });
    window.addEventListener('resize', () => this.#fitAll());
    document.fonts?.ready.then(() => this.#fitAll()); // web fonts change the card's height
  }

  /** Shrink a screen's card to fit the window (phones scroll instead, with a sticky Start button). */
  #fit(screen) {
    const card = screen.querySelector('.screen-card');
    if (!card || screen.hidden) return;
    card.style.zoom = '';
    if (window.innerWidth <= 760) return;
    const pad = parseFloat(getComputedStyle(screen).paddingTop) + parseFloat(getComputedStyle(screen).paddingBottom);
    const avail = window.innerHeight - pad - 4;
    // Zooming changes how text wraps, so re-measure a few times.
    for (let i = 0; i < 4; i++) {
      const height = card.getBoundingClientRect().height;
      if (height <= avail) return;
      const zoom = parseFloat(getComputedStyle(card).zoom) || 1;
      const next = Math.max(0.55, (zoom * avail) / height - 0.005);
      if (next >= zoom) return;
      card.style.zoom = next.toFixed(3);
    }
  }

  #fitAll() {
    [this.start, this.briefing, this.pause, this.end].forEach((s) => this.#fit(s));
  }

  /** Start or briefing screen up: gameplay keys are ignored. */
  get blocking() {
    return !this.start.hidden || !this.briefing.hidden;
  }

  get anyOpen() {
    return this.blocking || !this.pause.hidden || !this.end.hidden || !this.settings.hidden;
  }

  /** The Settings menu (pauses the shift while it's open). */
  showSettings() {
    const game = this.app.game;
    if (game && !game.paused && !game.ended) {
      game.setPaused(true, 'settings');
      this.resumeAfterSettings = true;
    }
    const render = () => {
      const toggle = ([key, label, hint]) =>
        el('label', { class: 'setting' }, [
          el('input', { type: 'checkbox', checked: !!prefs[key], onchange: (e) => setPref(key, e.target.checked) }),
          el('span', { class: 'setting-text' }, [el('b', {}, label), el('small', {}, hint)]),
        ]);
      const sizes = el(
        'div',
        { class: 'segmented', role: 'group', 'aria-label': 'Interface size' },
        UI_SIZES.map(([value, label]) =>
          el('button', { class: `btn btn-sm ${prefs.uiSize === value ? 'is-on' : ''}`, 'aria-pressed': String(prefs.uiSize === value), ...press(() => { setPref('uiSize', value); render(); }) }, label),
        ),
      );
      const doc = document;
      const canFull = doc.fullscreenEnabled || doc.webkitFullscreenEnabled;
      this.settings.replaceChildren(
        el('div', { class: 'screen-card narrow-left settings-card' }, [
          el('h1', {}, 'Settings'),
          el('div', { class: 'settings-list' }, SETTINGS_ROWS.map(toggle)),
          el('div', { class: 'setting setting-row' }, [el('span', { class: 'setting-text' }, [el('b', {}, 'Interface size'), el('small', {}, 'Panels and text (the map always fills the space).')]), sizes]),
          el('div', { class: 'screen-actions' }, [
            canFull ? el('button', { class: 'btn', ...press(() => this.app.toggleFullscreen()) }, 'Fullscreen') : null,
            game && !game.ended ? el('button', { class: 'btn', ...press(() => { this.closeSettings({ resume: false }); game.setPaused(true); }) }, 'How to play') : null,
            el('button', { class: 'btn btn-primary', ...press(() => this.closeSettings()) }, ['Done', el('kbd', {}, '\u232b')]),
          ]),
        ]),
      );
      this.#fit(this.settings);
    };
    render();
    this.settings.hidden = false;
  }

  closeSettings({ resume = true } = {}) {
    this.settings.hidden = true;
    if (resume && this.resumeAfterSettings) this.app.game?.setPaused(false);
    this.resumeAfterSettings = false;
  }

  showStart() {
    const levelCards = el('div', { class: 'level-list' });
    const renderLevels = () =>
      levelCards.replaceChildren(
        ...[TUTORIAL, ...LEVELS].map((lvl) =>
          el(
            'button',
            {
              class: `level-card ${lvl.id === this.selectedLevel ? 'is-selected' : ''}`,
              onclick: () => {
                this.selectedLevel = lvl.id;
                renderLevels();
              },
              ondblclick: () => this.#begin(lvl.id),
            },
            [el('span', { class: 'level-num' }, lvl.tutorial ? '?' : lvl.id), el('span', { class: 'level-name' }, lvl.tutorial ? `Tutorial \u00b7 ${lvl.name}` : lvl.name), el('span', { class: 'level-tag' }, lvl.tagline)],
          ),
        ),
      );
    renderLevels();

    this.start.replaceChildren(
      el('div', { class: 'screen-card title-card' }, [
        el('div', { class: 'title-row' }, [el('h1', {}, GAME.name), creditLink()]),
        el('div', { class: 'game-subtitle' }, GAME.subtitle),
        el('div', { class: 'subtitle' }, 'You run the front desk. Nobody gets in unescorted.'),
        employer(this.app.career),
        employerPicker(this.app.career, (id) => {
          this.app.newEmployer(id);
          this.showStart();
        }),
        el('div', { class: 'screen-grid' }, [
          el('div', {}, [el('h2', {}, 'How to play'), howToPlay({ onChange: () => this.#fit(this.start) })]),
          el('div', { class: 'screen-side' }, [el('h2', {}, 'Choose a shift'), levelCards]),
        ]),
        el('div', { class: 'screen-actions' }, [
          el('button', { class: 'btn btn-primary', onclick: () => this.#begin(this.selectedLevel) }, 'Start shift →'),
        ]),
      ]),
    );
    this.start.hidden = false;
    this.pause.hidden = true;
    this.end.hidden = true;
    this.briefing.hidden = true;
    this.#fit(this.start);
  }

  #begin(levelId) {
    this.start.hidden = true;
    this.end.hidden = true;
    this.pause.hidden = true;
    this.app.startShift(levelId);
  }

  /** Popup before each shift: objectives + basic mechanics, with a full-mechanics view. */
  showBriefing(level, { full = false } = {}) {
    const go = () => {
      this.briefing.hidden = true;
      this.app.game?.setPaused(false, 'briefing');
    };
    const body = full
      ? howToPlay({ onChange: () => this.#fit(this.briefing) })
      : el('div', {}, [
          this.app.game?.double ? html('div', { class: 'double-note' }, `<b>Double shift!</b> ${this.app.game.double.calledOff} called off, so you\u2019re covering ${this.app.game.settings.SHIFT_LENGTH_MINUTES / 60} hours today.`) : null,
          el('h2', {}, 'Your objectives'),
          el('ul', { class: 'objectives' }, level.briefing.map((line) => html('li', {}, line))),
          el('div', { class: 'brief-legend' }, [
            el('span', {}, [dots('G'), ' Visitor']),
            el('span', {}, [dots('E'), ' Employee']),
            el('span', {}, [dots('O'), ' Officer']),
            el('span', {}, [el('span', { class: 'swatch swatch-secure' }), ' Secure door']),
          ]),
        ]);
    this.briefing.replaceChildren(
      el('div', { class: `screen-card ${full ? '' : 'narrow-left'}` }, [
        el('h2', {}, `Level ${level.id}`),
        el('h1', {}, level.name),
        employer(this.app.career, { current: true }),
        body,
        el('div', { class: 'screen-actions' }, [
          full
            ? el('button', { class: 'btn', ...press(() => this.showBriefing(level)) }, '← Back to briefing')
            : el('button', { class: 'btn', ...press(() => this.showBriefing(level, { full: true })) }, 'View full mechanics'),
          el('button', { class: 'btn btn-primary', ...press(go) }, ['Start shift', el('kbd', {}, '↵')]),
        ]),
      ]),
    );
    this.briefing.hidden = false;
    this.#fit(this.briefing);
    this.briefing.onkeydown = null;
    this.briefingKey = (e) => {
      if (this.briefing.hidden) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    };
  }

  showPause() {
    this.pause.replaceChildren(
      el('div', { class: 'screen-card' }, [
        el('div', { class: 'title-row' }, [el('h1', {}, 'Paused'), creditLink()]),
        howToPlay({ onChange: () => this.#fit(this.pause) }),
        el('div', { class: 'screen-actions' }, [
          el('button', { class: 'btn btn-primary', onclick: () => this.app.game?.setPaused(false) }, 'Resume'),
          el('button', { class: 'btn', onclick: () => this.#begin(this.app.game.level.id) }, 'Restart shift'),
          el('button', { class: 'btn btn-ghost', onclick: () => this.app.quitToMenu() }, 'Quit to menu'),
        ]),
      ]),
    );
    this.pause.hidden = false;
    this.#fit(this.pause);
  }

  showEnd(summary) {
    const s = summary.stats;
    const next = LEVELS.find((l) => l.id === summary.level.id + 1);
    const rows = [
      ['Groups processed', s.groupsProcessed],
      ['Correct calls', s.correctDecisions],
      ['Wrong calls', s.wrongDecisions],
      ['Calls made without checking (no points)', s.uncheckedDecisions],
      ['Entry window timeouts', s.entryTimeouts],
      ['Incidents handled', s.incidentsAddressed],
      ['Incidents missed', s.incidentsMissed],
      ['Visitors let in unescorted', s.unescortedLetIn],
      ['Visitors who slipped in', s.tailgaters],
      ['Badge race conditions', s.raceConditions],
      ['Visits completed', s.visitsCompleted],
      ['Patrols walked / missed', `${s.patrolsCompleted} / ${s.patrolsMissed}`],
      ['New badges printed / still owed', `${s.badgesRenewed} / ${s.badgesNotRenewed}`],
      ['Officer verifications', s.verifications],
      ['Restroom escorts', s.restroomEscorts],
      ['Peak incident multiplier', `×${s.peakMultiplier}`],
    ];
    const sheet = () => (this.sheet ??= gradeSheet(summary, rows));
    const png = () => (this.png ??= sheet().then(pngOf));
    // Share buttons use plain clicks, not press(): clipboard and share need a real
    // click, and focus moving into the game (inside an iframe, the embed's frame).
    // Brief "Copied!" / "Couldn't copy" feedback on the button itself.
    const flash = (btn, ok, failText = 'Couldn\u2019t copy') => {
      const label = btn.dataset.label ?? (btn.dataset.label = btn.textContent);
      btn.textContent = ok ? 'Copied!' : failText;
      clearTimeout(btn.flashTimer);
      btn.flashTimer = setTimeout(() => (btn.textContent = label), 1800);
    };
    const copyBtn = (label, fn, failText) => {
      const btn = el('button', { class: 'btn btn-sm', onclick: async () => flash(btn, await fn(), failText) }, label);
      return btn;
    };
    const mobile = isTouch() && !!navigator.share;
    const linksBox = el('div', { class: 'share-links', hidden: true }, [
      el('div', { class: 'share-text' }, `${shareText(summary)} ${CREDITS.gameUrl}`),
      el('div', { class: 'share-row' }, [
        canCopyImage() ? copyBtn('Copy image', () => copyImage(png()), 'Blocked: use Save image') : null,
        el('button', { class: 'btn btn-sm', onclick: () => saveImage(png()) }, 'Save image'),
        copyBtn('Copy text', () => copyText(`${shareText(summary)} ${CREDITS.gameUrl}`)),
      ]),
      el('div', { class: 'share-row' }, [
        ...shareLinks(summary, { mobile }).map(([label, href]) => {
          const link = el('a', { class: 'btn btn-sm', href, target: '_blank', rel: 'noopener' }, label);
          // Instagram: phones get the share sheet with the grade sheet (pick Instagram there); computers
          // get the image saved and the caption copied as instagram.com opens, ready for Create > Post.
          if (label === 'Instagram') link.addEventListener('click', (e) => {
            copyText(`${shareText(summary)} ${CREDITS.gameUrl}`);
            if (mobile) {
              e.preventDefault();
              shareNative(png(), summary);
              return;
            }
            saveImage(png());
            flash(link, true);
            link.textContent = 'Image saved, caption copied';
          });
          return link;
        }),
        mobile ? el('button', { class: 'btn btn-sm', onclick: () => shareNative(png(), summary) }, 'More\u2026') : null,
      ]),
      el('small', { class: 'muted' }, 'Copy or save the image, then paste or attach it to your post or message.'),
    ]);
    const showLinks = async () => {
      linksBox.hidden = false;
      this.#fit(this.end);
    };
    // Phones / tablets open the system share sheet (with the image) too; the
    // panel stays as a fallback. Desktop share sheets often fail, so just the panel.
    const share = async () => {
      if (mobile) await shareNative(png(), summary);
      await showLinks();
    };
    this.sheet = null;
    this.png = null;
    setTimeout(png, 300); // encode the image in the background, ready for Share / Save
    this.end.replaceChildren(
      el('div', { class: 'screen-card narrow' }, [
        el('div', { class: 'end-logo', html: companyLogoSvg(summary.company, { size: 72 }) }),
        el('h2', {}, `End of shift · Level ${summary.level.id}: ${summary.level.name}`),
        el('div', { class: 'end-employer' }, `${summary.company.name} \u00b7 Day ${summary.day} \u00b7 ${summary.date}${summary.double ? ' \u00b7 Double shift' : ''}`),
        el('div', { class: 'grade' }, summary.grade.letter),
        el('div', { class: 'grade-title' }, `Performance review: ${summary.grade.title}`),
        el('div', {}, [el('span', { class: 'stat-label' }, 'Final score '), el('b', { style: { fontSize: '22px' } }, summary.score)]),
        el('div', { class: 'summary-stats' }, rows.flatMap(([k, v]) => [el('span', {}, k), el('span', {}, v)])),
        el('div', { class: 'screen-actions' }, [
          el('button', { class: 'btn btn-primary', onclick: () => this.#begin(summary.level.id) }, 'Retry shift'),
          next ? el('button', { class: 'btn', onclick: () => this.#begin(next.id) }, `Next: ${next.name} →`) : null,
          el('button', { class: 'btn btn-ghost', onclick: () => this.app.quitToMenu() }, 'Menu'),
        ]),
        el('div', { class: 'screen-actions share-actions' }, [
          el('button', { class: 'btn btn-info', onclick: share }, 'Share'),
          el('button', { class: 'btn', onclick: () => saveImage(png()) }, 'Save image'),
        ]),
        linksBox,
        el('div', { class: 'end-credit' }, creditLink()),
      ]),
    );
    this.end.hidden = false;
    this.#fit(this.end);
  }
}
