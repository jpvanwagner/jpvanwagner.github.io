/*
 * Score + shift statistics. Everything that changes the score goes through
 * add(), which emits a 'score' event (HUD total + floating "+1/-1" popups).
 */
export class ScoreSystem {
  constructor(game) {
    this.game = game;
    this.total = 0;
    this.stats = {
      groupsProcessed: 0,
      correctDecisions: 0,
      wrongDecisions: 0,
      uncheckedDecisions: 0, // right calls made without checking (no points)
      entryTimeouts: 0,
      incidentsAddressed: 0,
      incidentsMissed: 0,
      unescortedLetIn: 0,
      tailgaters: 0,
      raceConditions: 0,
      visitsCompleted: 0,
      patrolsCompleted: 0,
      patrolsMissed: 0,
      badgesRenewed: 0,
      badgesNotRenewed: 0,
      verifications: 0,
      restroomEscorts: 0,
      peakMultiplier: 1,
    };
  }

  /**
   * @param {number} delta
   * @param {string} reason  short text for the popup / log
   * @param {{x:number,z:number}} [pos] world position for the floating popup
   */
  add(delta, reason, pos = null) {
    if (!delta && !reason) return; // a zero with a reason still pops up (e.g. "check their ID first")
    this.total += delta;
    this.game.bus.emit('score', { delta, total: this.total, reason, pos });
  }

  count(stat, n = 1) {
    this.stats[stat] += n;
  }

  /** Performance-review grade for the end-of-shift summary. */
  grade() {
    const s = this.stats;
    // Unchecked calls (lucky guesses) count half.
    const decisions = s.correctDecisions + s.wrongDecisions + s.uncheckedDecisions;
    const accuracy = decisions ? (s.correctDecisions + s.uncheckedDecisions * 0.5) / decisions : 1;
    const incidents = s.incidentsAddressed + s.incidentsMissed;
    const response = incidents ? s.incidentsAddressed / incidents : 1;
    const blended = accuracy * 0.6 + response * 0.4 - Math.min(0.3, s.unescortedLetIn * 0.03);
    if (blended >= 0.9) return { letter: 'A', title: 'Exceeds Expectations' };
    if (blended >= 0.75) return { letter: 'B', title: 'Meets Expectations' };
    if (blended >= 0.55) return { letter: 'C', title: 'Needs Improvement' };
    return { letter: 'D', title: 'See Me In My Office' };
  }
}
