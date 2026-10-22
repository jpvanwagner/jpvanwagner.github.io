/* Top bar: score, incident multiplier, free officers, loose visitors, today's date + clock. */
import { $ } from './dom.js';
import { formatDate, formatWeekday } from '../systems/credentials.js';
import { formatClock, clockMinutes } from '../core/clock.js';
import { PersonState } from '../entities/Person.js';

export class Hud {
  constructor(app) {
    this.app = app;
    this.score = $('#hud-score');
    this.scoreWrap = this.score.parentElement;
    this.mult = $('#hud-mult');
    this.multWrap = $('#hud-mult-wrap');
    this.officers = $('#hud-officers');
    this.loose = $('#hud-loose');
    this.looseWrap = this.loose.parentElement;
    this.clock = $('#hud-clock');
    this.date = $('#hud-date');
    this.level = $('#hud-level');
    this.pauseBtn = $('#btn-pause');

    app.bus.on('score', ({ delta, total }) => {
      this.score.textContent = total;
      this.scoreWrap.classList.remove('flash-up', 'flash-down');
      void this.scoreWrap.offsetWidth; // restart animation
      this.scoreWrap.classList.add(delta > 0 ? 'flash-up' : 'flash-down');
    });
    app.bus.on('pause', ({ paused }) => this.#setPauseLabel(paused));
  }

  reset(game) {
    this.score.textContent = '0';
    this.level.textContent = `${game.company.name} · ${game.level.tutorial ? 'Tutorial' : `Day ${game.career.day}`} · ${game.level.name}${game.double ? ' · Double shift' : ''}`;
    this.level.title = `Level ${game.level.id}: ${game.level.name}`;
    // Same format as the badges' expiry dates, so they're easy to compare.
    this.date.textContent = formatDate(game.date);
    this.date.title = `${formatWeekday(game.date)} ${formatDate(game.date)}`;
    this.#setPauseLabel(false);
  }

  #setPauseLabel(paused) {
    this.pauseBtn.classList.toggle('is-paused', paused);
    this.pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  }

  /** Light up the active speed button (and the compact cycle button's label). */
  setSpeed(speed) {
    document.querySelectorAll('.speed-btn').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === speed)));
    const label = document.getElementById('speed-label');
    if (label) label.textContent = speed === 0.5 ? '\u00bd\u00d7' : `${speed}\u00d7`;
  }

  tick(game) {
    this.clock.textContent = formatClock(clockMinutes(game.time, game.settings));
    const m = game.incidents.multiplier;
    this.mult.textContent = `×${m}`;
    this.multWrap.classList.toggle('is-hot', m > 1);
    this.officers.textContent = `${game.escorts.availableCount}/${game.settings.DUTY_OFFICERS}`;
    const loose = game.people.filter((p) => p.state === PersonState.WANDERING).length;
    this.loose.textContent = loose;
    this.looseWrap.classList.toggle('is-hot', loose > 0);
  }
}
