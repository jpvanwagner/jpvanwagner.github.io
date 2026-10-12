'use strict';
/* ============================== PARTIAL MARKS ==============================
   Some calls are a gray area. Pencil marks on a door frame are best left as Clean (nothing to charge, nothing to
   fix), but writing them up as Normal Wear isn't wrong either; a dusty vent grille is wear, but nobody will fault a
   Clean. For those, the preferred code is the right call (green) and the alternate here is "acceptable" (yellow):
   partial credit, never a wrongful charge, and never counted as a miss. Tenant Damage and Maintenance Hazard are
   never acceptable alternates; those always have one right answer.
   Keys: an oddity's id, or "feature:variant" for a feature in one particular condition. */
const ACCEPTABLE = {
  // oddities that are fine, but could fairly be called wear
  heights: [1], toothpaste: [1], hair: [1], crookedplate: [1], phonenums: [1], glowstars: [1], decals: [1], classy: [1], pedro: [1], oldring: [1], paintedplate: [1],
  // oddities that are wear, but small enough to leave as clean
  tacks: [0], grout: [0],
  // features showing light wear that could fairly be left as clean
  'sink:1': [0], 'counter:1': [0], 'outlet:2': [0], 'thermostat:1': [0], 'vent:1': [0], 'dome:1': [0], 'ucab:1': [0], 'lcab:1': [0], 'vanitycab:1': [0], 'closetin:1': [0], 'bwall:1': [0]
};
PTS.partial = 60;                                   // an acceptable call: most of the credit, none of the bonuses
function acceptable(fid, cat) {
  const alt = ACCEPTABLE[FEATURE[fid] ? fid + ':' + Game.cond[fid] : fid];
  return !!alt && cat < 2 && alt.includes(cat);
}
/* 'right', 'ok' (acceptable), or 'wrong' */
function callQuality(fid, cat) { const tr = truth(fid); return cat === tr.cat ? 'right' : acceptable(fid, cat) ? 'ok' : 'wrong'; }
