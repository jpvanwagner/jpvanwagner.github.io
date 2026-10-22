/*
 * Application shell: builds the long-lived pieces once (stage, world, nav
 * grid, UI) and runs the frame loop. Each shift is a fresh Game instance.
 *
 * URL parameters (handy for testing):
 *   ?level=2      preselect / autostart level
 *   ?autostart=1  skip the start screen and the level briefing
 *   ?speed=3      simulation speed multiplier
 *   ?debug=1      expose window.__app for poking from the console
 *   ?company=id   start a new career with that employer (see data/companies.js)
 *
 * Layout and input adapt to the viewport (desktop, tablet, phone, portrait or
 * landscape, or an <iframe> on another site): see styles/layout.css and
 * ui/Controls.js.
 */
import { Stage } from '../world/Stage.js';
import { CameraRig } from '../world/CameraRig.js';
import { buildWorld } from '../world/WorldBuilder.js';
import { createNavGrid } from '../nav/createNavGrid.js';
import { EventBus } from './EventBus.js';
import { Game } from './Game.js';
import { updateTweens } from './tween.js';
import { getLevel } from '../config/levels.js';
import { $ } from '../ui/dom.js';
import { Hud } from '../ui/Hud.js';
import { DeskPanel } from '../ui/DeskPanel.js';
import { WaitingPanel } from '../ui/WaitingPanel.js';
import { IncidentPanel } from '../ui/IncidentPanel.js';
import { IdCheckModal } from '../ui/IdCheckModal.js';
import { VisitorLookupModal } from '../ui/VisitorLookupModal.js';
import { WorldOverlay } from '../ui/WorldOverlay.js';
import { PersonCard } from '../ui/PersonCard.js';
import { TutorialPanel } from '../ui/TutorialPanel.js';
import { CameraHud } from '../ui/CameraHud.js';
import { Screens } from '../ui/Screens.js';
import { Controls } from '../ui/Controls.js';
import { DockTabs } from '../ui/DockTabs.js';
import { AlertStrip } from '../ui/AlertStrip.js';
import { initInputMode } from '../ui/input.js';
import { Layout } from '../ui/Layout.js';
import { loadCareer, newCareer, startDay } from './career.js';
import { prefs, onPrefs } from './prefs.js';
import { Highlights } from '../world/Highlights.js';
import { COMPANIES } from '../data/companies.js';
import { resolveSettings } from '../config/settings.js';
import { pick } from './rng.js';

const MAX_STEP = 1 / 30;
const SPEEDS = [0.5, 1, 2, 3];

export class App {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.params = params;
    this.speed = Math.max(0.1, Number(params.get('speed')) || 1); // (testing multiplier)
    this.timeScale = 1; // the player's speed buttons: 0.5, 1, 2 or 3

    initInputMode();
    this.bus = new EventBus();
    this.stage = new Stage($('#canvas-host'));
    this.rig = new CameraRig(this.stage);
    this.highlights = new Highlights(this.stage);
    this.bus.on('camera', () => this.roomHighlighter?.set(null)); // no map hover highlight in 3D views
    const { cameraDevices, roomHighlighter } = buildWorld(this.stage);
    this.cameraDevices = cameraDevices;
    this.roomHighlighter = roomHighlighter;
    this.nav = createNavGrid();
    this.game = null;
    this.career = loadCareer({ companyId: params.get('company') });

    this.hud = new Hud(this);
    this.deskPanel = new DeskPanel(this);
    this.waitingPanel = new WaitingPanel(this);
    this.incidentPanel = new IncidentPanel(this);
    this.activeModal = null; // whichever modal currently owns the keyboard
    this.idModal = new IdCheckModal(this);
    this.lookupModal = new VisitorLookupModal(this);
    this.overlay = new WorldOverlay(this);
    this.personCard = new PersonCard(this);
    this.tutorialPanel = new TutorialPanel(this);
    this.cameraHud = new CameraHud(this);
    this.screens = new Screens(this);
    this.controls = new Controls(this);
    this.dockTabs = new DockTabs(this);
    this.layout = new Layout(this);
    this.dockTabs.setLayout(this.layout.tabs);
    this.layout.onChange(() => this.dockTabs.setLayout(this.layout.tabs));
    this.alertStrip = new AlertStrip(this);

    $('#btn-pause').addEventListener('click', () => !this.screens.blocking && this.game?.setPaused(!this.game.paused));
    $('#btn-help').addEventListener('click', () => !this.screens.blocking && this.game?.setPaused(true));
    $('#btn-settings').addEventListener('click', () => this.screens.showSettings());
    document.querySelectorAll('.speed-btn').forEach((b) => b.addEventListener('click', () => this.setSpeed(Number(b.dataset.speed), { toggle: true })));
    $('#btn-speed-cycle').addEventListener('click', () => this.stepSpeed(1, { wrap: true }));
    this.#setupViewControls();
    this.#setupFullscreen();

    // Small stages (phones, small embeds) get lighter overlays.
    const stageEl = $('#stage');
    const markSize = ({ width }) => stageEl.classList.toggle('is-small', width < 640);
    this.stage.onResize(markSize);
    markSize(this.stage.size);

    // Pause when the tab is hidden, or when an embedding page scrolls us out of view.
    const autoPause = () => this.game && !this.game.ended && !this.game.paused && this.game.setPaused(true, 'auto');
    document.addEventListener('visibilitychange', () => document.hidden && autoPause());
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => entry.intersectionRatio < 0.25 && autoPause(), { threshold: [0, 0.25] }).observe($('#app'));
    }

    this.#applyPrefs();
    onPrefs(() => this.#applyPrefs());

    if (params.get('debug')) window.__app = this;

    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.#frame(t));

    if (params.get('autostart')) this.startShift(params.get('level') !== null ? Number(params.get('level')) : 1);
    else {
      if (params.get('level')) this.screens.selectedLevel = getLevel(params.get('level')).id;
      this.screens.showStart();
    }
  }

  #setupViewControls() {
    const reset = $('#btn-zoom-reset');
    $('#btn-zoom-in').addEventListener('click', () => this.rig.zoomAt(1.4));
    $('#btn-zoom-out').addEventListener('click', () => this.rig.zoomAt(1 / 1.4));
    reset.addEventListener('click', () => this.rig.resetView());
    this.rig.onChange(() => (reset.hidden = !this.rig.isZoomed));
  }

  #setupFullscreen() {
    const btn = $('#btn-fullscreen');
    const doc = document;
    btn.hidden = !(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
    btn.addEventListener('click', () => this.toggleFullscreen());
  }

  /** Speed buttons: ½×, 1×, 2×, 3×. Pressing the active one again goes back to 1×; any of them resumes. */
  setSpeed(speed, { toggle = false } = {}) {
    this.timeScale = toggle && this.timeScale === speed ? 1 : speed;
    if (this.game?.paused && !this.screens.anyOpen) this.game.setPaused(false);
    this.hud.setSpeed(this.timeScale);
  }

  stepSpeed(dir, { wrap = false } = {}) {
    const speeds = SPEEDS;
    let i = speeds.indexOf(this.timeScale) + dir;
    if (wrap) i = (i + speeds.length) % speeds.length;
    this.setSpeed(speeds[Math.max(0, Math.min(speeds.length - 1, i))]);
  }

  toggleFullscreen() {
    const doc = document;
    const el = doc.documentElement;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
    }
  }

  /** Start over at another employer (a fresh roster and day 1). Random if no id. */
  newEmployer(companyId = null) {
    if (companyId === this.career.companyId) return;
    const others = COMPANIES.filter((c) => c.id !== this.career.companyId);
    this.career = newCareer(companyId ?? others[Math.floor(Math.random() * others.length)].id);
    this.bus.emit('career', { career: this.career });
  }

  startShift(levelId) {
    this.game?.dispose();
    this.activeModal?.close();
    const level = getLevel(levelId);
    if (!level.tutorial) startDay(this.career); // every real shift is a new day
    // Later shifts: sometimes somebody calls off and you cover a double.
    const double =
      !level.tutorial && (this.params.get('double') === '1' || (level.id >= 2 && Math.random() < resolveSettings(level).DOUBLE_SHIFT_CHANCE))
        ? { calledOff: pick(this.career.roster.filter((m) => m.type === 'O')).name }
        : null;
    this.game = new Game({
      career: this.career,
      double,
      stage: this.stage,
      rig: this.rig,
      cameraDevices: this.cameraDevices,
      nav: this.nav,
      bus: this.bus,
      level,
    });
    this.hud.reset(this.game);
    this.overlay.reset(this.game);
    for (const panel of [this.deskPanel, this.waitingPanel, this.incidentPanel]) panel.dirty = true;
    this.bus.emit('camera', { camera: null });
    this.bus.emit('pause', { paused: false });
    // Each shift opens with a briefing popup (skipped by ?autostart=1 for testing);
    // the tutorial explains itself step by step instead.
    this.tutorialPanel.render(); // hides the card outside the tutorial
    if (level.tutorial) {
      this.game.tutorial.start();
    } else if (!this.params.get('autostart')) {
      this.game.setPaused(true, 'briefing');
      this.screens.showBriefing(this.game.level);
    }
  }

  quitToMenu() {
    this.game?.dispose();
    this.game = null;
    this.tutorialPanel.render();
    this.screens.showStart();
  }

  #frame(now) {
    requestAnimationFrame((t) => this.#frame(t));
    const realDt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    updateTweens(realDt);
    this.stage.runAnimators(realDt);
    const game = this.game;
    if (game) {
      // Fixed-size sub-steps keep movement/door checks stable at low FPS or high speed.
      let remaining = realDt * this.speed * this.timeScale;
      while (remaining > 1e-6) {
        const step = Math.min(remaining, MAX_STEP);
        game.update(step);
        remaining -= step;
      }
      game.cameras.animate(realDt);
      this.stage.setDaylight(prefs.daylight ? game.time / game.shiftLength : 0.3);
      this.hud.tick(game);
      this.deskPanel.tick(game);
      this.waitingPanel.tick(game);
      this.incidentPanel.tick(game);
      this.overlay.tick(game);
      this.personCard.tick(game);
      this.dockTabs.tick(game);
      this.alertStrip.tick(game, this.dockTabs.incidentsVisible);
    }
    this.highlights.tick(game, prefs, now / 1000);
    this.stage.render();
  }

  /** Settings that change the page rather than the game. */
  #applyPrefs() {
    document.documentElement.dataset.keyhints = prefs.keyHints ? 'on' : 'off';
    $('#legend').classList.toggle('is-off', !prefs.legend);
    this.rig.instant = !prefs.smoothCamera;
  }
}
