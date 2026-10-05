/* ============================================================================
 *  core/progression.js  —  PLAYER VITALS & PROGRESSION (modular baselines)
 * ----------------------------------------------------------------------------
 *  ONE place to tune HP (health), SP (stamina), RESTEDNESS, and the NUTRITION /
 *  EXERCISE bonuses, plus era-aware STARTING CASH. Everything you'll want to
 *  rebalance lives in PROGRESSION_CONFIG at the top; the functions below only
 *  READ that config, so you can redefine the whole feel of the game by editing
 *  numbers — no logic changes required. This file is deliberately standalone so
 *  it's easy to find and grow as you flesh these systems out.
 *
 *  Vitals live on State.world:  hp, hpMax, stamina, staminaMax, rested, money.
 *  Long-window progress (nutrition/exercise) lives on State.progress (created
 *  lazily here). Call the API from wherever the relevant event happens:
 *     Progression.initVitals(character)      // at game start / new character
 *     Progression.tick(minutes)              // each time the clock advances
 *     Progression.spendStamina(amount, opts) // sprinting / jumping / labor
 *     Progression.fallDamage(tiles)          // a fall of N tiles
 *     Progression.glassDamage()              // breaking through / stepping on glass
 *     Progression.heal(source)               // 'bandage'|'firstAid'|'rest'|'meal'…
 *     Progression.eatFood({ healthy:true })  // logs nutrition for the window
 *     Progression.logExercise()              // logs an exercise session for the day
 *     Progression.startingCash(character)    // era-aware pocket money
 *  None of these throw; missing State just no-ops so early boot is safe.
 * ========================================================================== */

(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────────────────────
  //  PROGRESSION_CONFIG — TUNE EVERYTHING HERE
  //  (1999 money, small numbers; keep ranges modest so no build runs away)
  // ──────────────────────────────────────────────────────────────────────────
  var CONFIG = {

    // ── HP (health) ─────────────────────────────────────────────────────────
    hp: {
      // starting max = base + BRAWN*perBrawn + GRIT*perGrit, clamped [min,max]
      base: 6, perBrawn: 0.5, perGrit: 0.25, min: 5, max: 30,
      // DAMAGE sources -------------------------------------------------------
      safeDropTiles: 0,        // floor-drops below this many do NO damage (0 = every real fall hurts)
      fallPerTile: 3,          // HP lost per FLOOR dropped above the safe height
      fallMax: 15,             // cap on a single fall's damage
      brokenGlass: 2,          // breaking through / stepping on glass
      // running on empty: each minute spent at 0 stamina costs this much HP
      exhaustionPerMin: 0.15,
      // HEALING --------------------------------------------------------------
      bandage: 3, firstAid: 8,
      restPerHour: 1,          // natural regen per in-game hour while rested>0
      mealHeal: 1,             // a normal meal nudges HP up a touch
    },

    // ── SP (stamina) ────────────────────────────────────────────────────────
    sp: {
      base: 70, perReflexes: 2, perBrawn: 1, min: 30, max: 200,
      // REGEN scales with restedness: perMin = regenBase * (rested/100)^curve.
      // curve 1 = linear; >1 makes low restedness hurt regen disproportionately.
      regenBasePerMin: 4, regenRestedCurve: 1.0,
      regenFloorFrac: 0.15,    // even at 0 rested you regen at least this fraction
      // COSTS (defaults; callers may pass their own amount) ------------------
      jump: 4, sprintPerSec: 3, climbPerTile: 2,
    },

    // ── RESTEDNESS (0..100) ───────────────────────────────────────────────────
    rested: {
      startOfDay: 95, min: 0, max: 100,
      decayPerHour: 4,         // natural drift down across a normal day
      // BURST PENALTY: spending a lot of stamina in a short window tires you.
      // If > burstThreshold SP is spent within burstWindowSec, lose burstPenalty
      // restedness (then the window resets).
      burstWindowSec: 12, burstThreshold: 28, burstPenalty: 4,
      sleepRecoverPerHour: 12, // sleeping/resting restores restedness
    },

    // ── NUTRITION & EXERCISE (rolling-window bonuses) ─────────────────────────
    // "X days in a time period eating a net positive of healthy food" → +maxHP;
    // exercising X days in the period → +maxSP. The window is a rolling N days.
    progress: {
      windowDays: 7,
      // nutrition: each healthy item = +1, anything else = -1 toward the day's net.
      healthyNetPerDayToCount: 1,  // a day "counts" as healthy if its net >= this
      healthyDaysForBonus: 4,      // this many healthy days in the window →
      maxHpBonusPerTier: 1,        //   +this maxHP (repeatable as tiers stack)
      maxHpBonusCap: 6,            //   up to this many bonus maxHP total
      exerciseDaysForBonus: 4,     // this many exercise days in the window →
      maxSpBonusPerTier: 8,        //   +this maxSP
      maxSpBonusCap: 40,
    },

    // ── TRAVEL SPEEDS (#12) ───────────────────────────────────────────────────
    // Average speeds per mode of transit, in MPH (1999-appropriate averages). The
    // DISPLAY unit is a Settings toggle (State.settings.speedUnits = 'mph'|'kmh').
    // These matter most for travel on the Atlasworks town map later.
    // HOW TO MODIFY: edit the mph numbers, or add a mode (e.g. bus: 18).
    travel: {
      defaultUnits: 'mph',
      mph: { walk: 3, run: 6, skateboard: 8, bike: 10 },
      kmhPerMph: 1.60934,
    },

    // ── STARTING CASH (era-aware — see the note in the chat for reasoning) ────
    // how much of their money is already spoken for: living with parents = more
    // disposable pocket money; paying rent = less. Kept tight so nobody starts
    // with a runaway advantage.
    cash: {
      base: 14,                 // baseline pocket money at age 15
      perYearOver15: 3,         // +$ per year of age above 15 (older = a bit more saved)
      // housing keys should match your LOCATIONS' residence types; unknown → 0.
      housing: {
        with_parents: 6, family: 6, parents: 6,
        apartment: -2, rented_house: -3, rented: -3, renting: -3,
        own_room: 2, dorm: 0, couch: -5, shelter: -6,
      },
      jitter: 4,                // ± random spread so identical builds still differ
      min: 3, max: 60,
    },
  };

  // expose the config so it can be inspected / hot-edited from the console
  window.PROGRESSION_CONFIG = CONFIG;

  // ── helpers ───────────────────────────────────────────────────────────────
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function W() { return (window.State && window.State.world) || null; }
  function statOf(ch, key) { try { return (ch && typeof ch['stat_' + key] === 'number') ? ch['stat_' + key] : (ch && ch.stats && +ch.stats[key]) || 0; } catch (e) { return 0; } }
  function round(v) { return Math.round(v); }

  // ── STARTING MAXES ────────────────────────────────────────────────────────
  function startingHpMax(ch) {
    var h = CONFIG.hp;
    var v = h.base + statOf(ch, 'brawn') * h.perBrawn + statOf(ch, 'grit') * h.perGrit;
    return clamp(round(v), h.min, h.max);
  }
  function startingSpMax(ch) {
    var s = CONFIG.sp;
    var v = s.base + statOf(ch, 'reflexes') * s.perReflexes + statOf(ch, 'brawn') * s.perBrawn;
    return clamp(round(v), s.min, s.max);
  }
  function startingCash(ch) {
    var c = CONFIG.cash, age = (ch && +ch.age) || 15;
    var v = c.base + Math.max(0, age - 15) * c.perYearOver15;
    // housing/residence: try a few likely fields on the character/location
    var hk = (ch && (ch.housing || ch.residence || ch.living)) || '';
    if (typeof hk === 'string') { hk = hk.toLowerCase().replace(/[^a-z]+/g, '_'); }
    if (c.housing[hk] != null) v += c.housing[hk];
    if (c.jitter) v += (Math.random() * 2 - 1) * c.jitter;
    return clamp(Math.round(v * 100) / 100, c.min, c.max);
  }

  // ── INIT ──────────────────────────────────────────────────────────────────
  function initVitals(ch) {
    var w = W(); if (!w) return;
    ch = ch || (window.State && window.State.character) || {};
    // non-clobbering: only seed values that aren't already present (so a loaded
    // save keeps its current hp/stamina/money; a fresh character gets baselines).
    if (typeof w.hpMax !== 'number') w.hpMax = startingHpMax(ch);
    if (typeof w.hp !== 'number') w.hp = w.hpMax;
    if (typeof w.staminaMax !== 'number') w.staminaMax = startingSpMax(ch);
    if (typeof w.stamina !== 'number') w.stamina = w.staminaMax;
    if (typeof w.rested !== 'number') w.rested = CONFIG.rested.startOfDay;
    if (typeof w.money !== 'number') w.money = startingCash(ch);
    initProgress();
    // mirror onto the character for the sheet/REVIEW which read maxHp/maxSp
    try { ch.maxHp = w.hpMax; ch.maxSp = w.staminaMax; } catch (e) {}
  }
  function initProgress() {
    var S = window.State; if (!S) return;
    if (!S.progress) S.progress = { days: [], today: { healthyNet: 0, exercised: false }, bonusHp: 0, bonusSp: 0 };
  }

  // ── DAMAGE ─────────────────────────────────────────────────────────────────
  function dealDamage(amount, cause) {
    var w = W(); if (!w || amount <= 0) return 0;
    if (typeof w.hp !== 'number') w.hp = w.hpMax || startingHpMax();
    w.hp = clamp(w.hp - amount, 0, w.hpMax || 30);
    // route through the existing damage hook so flashes/sfx/game-over fire
    try { if (typeof window.engineOnPlayerDamage === 'function') window.engineOnPlayerDamage(amount, cause || 'hurt'); } catch (e) {}
    try { if (typeof window.onVitalsChanged === 'function') window.onVitalsChanged(); } catch (e) {}
    return amount;
  }
  function fallDamage(tiles) {
    var h = CONFIG.hp;
    var over = Math.max(0, (+tiles || 0) - h.safeDropTiles);
    if (over <= 0) return 0;
    return dealDamage(Math.min(h.fallMax, over * h.fallPerTile), 'fall');
  }
  function glassDamage() { return dealDamage(CONFIG.hp.brokenGlass, 'glass'); }

  // ── HEALING ─────────────────────────────────────────────────────────────────
  function heal(source, customAmt) {
    var w = W(); if (!w) return 0;
    var h = CONFIG.hp, amt = (typeof customAmt === 'number') ? customAmt
      : (source === 'bandage' ? h.bandage : source === 'firstAid' ? h.firstAid
      : source === 'meal' ? h.mealHeal : 0);
    if (amt <= 0) return 0;
    var before = w.hp || 0;
    w.hp = clamp((w.hp || 0) + amt, 0, w.hpMax || 30);
    try { if (typeof window.onVitalsChanged === 'function') window.onVitalsChanged(); } catch (e) {}
    return w.hp - before;
  }

  // ── STAMINA spend + RESTEDNESS burst tracking ────────────────────────────────
  var _burst = { spent: 0, since: 0 };
  function spendStamina(amount, opts) {
    var w = W(); if (!w || amount <= 0) return;
    var s = CONFIG.sp, r = CONFIG.rested;
    if (typeof w.stamina !== 'number') w.stamina = w.staminaMax || s.base;
    w.stamina = clamp(w.stamina - amount, 0, w.staminaMax || s.max);
    // burst → restedness penalty
    var now = Date.now();
    if (now - _burst.since > r.burstWindowSec * 1000) { _burst.spent = 0; _burst.since = now; }
    _burst.spent += amount;
    if (_burst.spent >= r.burstThreshold) { adjustRested(-r.burstPenalty); _burst.spent = 0; _burst.since = now; }
    try { if (typeof window.onVitalsChanged === 'function') window.onVitalsChanged(); } catch (e) {}
  }
  function adjustRested(delta) {
    var w = W(); if (!w) return;
    var r = CONFIG.rested;
    // prefer the host's adjustRested (it has sfx/flash hooks) if present
    if (typeof window.adjustRested === 'function' && window.adjustRested !== adjustRested) { try { window.adjustRested(delta); return; } catch (e) {} }
    w.rested = clamp((w.rested || 0) + delta, r.min, r.max);
  }

  // ── TICK (call when the clock advances; minutes = elapsed in-game minutes) ───
  // Handles: restedness decay over time, stamina regen scaled by restedness, and
  // exhaustion damage while at 0 stamina. Sleeping is handled by sleep().
  function tick(minutes) {
    var w = W(); if (!w || !minutes || minutes <= 0) return;
    var s = CONFIG.sp, r = CONFIG.rested, h = CONFIG.hp;
    // 1) restedness decays with time
    w.rested = clamp((w.rested != null ? w.rested : r.startOfDay) - r.decayPerHour * (minutes / 60), r.min, r.max);
    // 2) stamina regen scales with restedness
    var frac = clamp(w.rested / 100, 0, 1);
    var scaled = Math.pow(frac, s.regenRestedCurve);
    scaled = s.regenFloorFrac + (1 - s.regenFloorFrac) * scaled;   // never fully zero
    var regen = s.regenBasePerMin * scaled * minutes;
    if (typeof w.stamina !== 'number') w.stamina = w.staminaMax || s.base;
    // 3) exhaustion: at 0 stamina you take chip HP damage instead of regen
    if (w.stamina <= 0) { dealDamage(h.exhaustionPerMin * minutes, 'exhaustion'); }
    w.stamina = clamp(w.stamina + regen, 0, w.staminaMax || s.max);
    // 4) gentle HP regen while you still have some rest in the tank
    if ((w.hp || 0) < (w.hpMax || 0) && w.rested > 0) { w.hp = clamp((w.hp || 0) + h.restPerHour * (minutes / 60), 0, w.hpMax); }
    try { if (typeof window.onVitalsChanged === 'function') window.onVitalsChanged(); } catch (e) {}
  }
  function sleep(hours) {
    var w = W(); if (!w) return;
    var r = CONFIG.rested, h = CONFIG.hp;
    w.rested = clamp((w.rested || 0) + r.sleepRecoverPerHour * hours, r.min, r.max);
    w.stamina = w.staminaMax || w.stamina;
    if ((w.hp || 0) < (w.hpMax || 0)) w.hp = clamp((w.hp || 0) + h.restPerHour * hours, 0, w.hpMax);
    rolloverDay();   // sleeping ends the day → evaluate the nutrition/exercise window
    try { if (typeof window.onVitalsChanged === 'function') window.onVitalsChanged(); } catch (e) {}
  }

  // ── NUTRITION & EXERCISE ─────────────────────────────────────────────────────
  function eatFood(opts) {
    initProgress(); var S = window.State; if (!S || !S.progress) return;
    var healthy = !!(opts && opts.healthy);
    S.progress.today.healthyNet += healthy ? 1 : -1;
    // a meal also nudges HP a touch
    heal('meal');
  }
  function logExercise() { initProgress(); var S = window.State; if (S && S.progress) S.progress.today.exercised = true; }
  // close out the current day and re-evaluate the rolling window's bonuses.
  function rolloverDay() {
    initProgress(); var S = window.State, w = W(); if (!S || !S.progress || !w) return;
    var p = CONFIG.progress, pr = S.progress;
    pr.days.push({ healthyNet: pr.today.healthyNet, exercised: pr.today.exercised });
    while (pr.days.length > p.windowDays) pr.days.shift();
    pr.today = { healthyNet: 0, exercised: false };
    // count healthy days + exercise days in the window
    var healthyDays = pr.days.filter(function (d) { return d.healthyNet >= p.healthyNetPerDayToCount; }).length;
    var exDays = pr.days.filter(function (d) { return d.exercised; }).length;
    var hpTiers = Math.floor(healthyDays / p.healthyDaysForBonus);
    var spTiers = Math.floor(exDays / p.exerciseDaysForBonus);
    var newHpBonus = clamp(hpTiers * p.maxHpBonusPerTier, 0, p.maxHpBonusCap);
    var newSpBonus = clamp(spTiers * p.maxSpBonusPerTier, 0, p.maxSpBonusCap);
    // apply the DELTA to the maxes (keep current hp/sp, raise the ceiling)
    if (newHpBonus !== pr.bonusHp) { w.hpMax = (w.hpMax || 0) + (newHpBonus - pr.bonusHp); pr.bonusHp = newHpBonus; }
    if (newSpBonus !== pr.bonusSp) { w.staminaMax = (w.staminaMax || 0) + (newSpBonus - pr.bonusSp); pr.bonusSp = newSpBonus; }
    try { if (typeof window.onVitalsChanged === 'function') window.onVitalsChanged(); } catch (e) {}
  }

  // ── TRAVEL SPEEDS (#12) ─────────────────────────────────────────────────────
  // raw speed in mph for a mode; speedIn() converts to the requested/active unit;
  // speedLabel() formats it ('6 mph' / '10 km/h') using the Settings toggle.
  function activeSpeedUnits() {
    try { var u = window.State && window.State.settings && window.State.settings.speedUnits; if (u === 'mph' || u === 'kmh') return u; } catch (e) {}
    return CONFIG.travel.defaultUnits;
  }
  function speedMph(mode) { var m = CONFIG.travel.mph; return (m[mode] != null) ? m[mode] : 0; }
  function speedIn(mode, units) {
    var v = speedMph(mode);
    return ((units || activeSpeedUnits()) === 'kmh') ? Math.round(v * CONFIG.travel.kmhPerMph * 10) / 10 : v;
  }
  function speedLabel(mode, units) {
    units = units || activeSpeedUnits();
    return speedIn(mode, units) + ' ' + (units === 'kmh' ? 'km/h' : 'mph');
  }

  // ── public API ────────────────────────────────────────────────────────────
  window.Progression = {
    config: CONFIG,
    initVitals: initVitals,
    startingHpMax: startingHpMax, startingSpMax: startingSpMax, startingCash: startingCash,
    dealDamage: dealDamage, fallDamage: fallDamage, glassDamage: glassDamage,
    heal: heal, spendStamina: spendStamina, adjustRested: adjustRested,
    tick: tick, sleep: sleep,
    eatFood: eatFood, logExercise: logExercise, rolloverDay: rolloverDay,
    speedMph: speedMph, speedIn: speedIn, speedLabel: speedLabel, activeSpeedUnits: activeSpeedUnits,
  };
})();
