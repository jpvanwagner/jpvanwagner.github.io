/*
 * What people look like. Shared by the 3D figures (world/meshes.js) and the
 * ID-card photos (ui/avatar.js), so a badge photo can match - or not match -
 * the person standing at the desk.
 *
 * Clothing colour encodes the role from the design sketch (orange visitor,
 * green employee, dark officer); everything else varies per person.
 */
import { pick, chance } from '../core/rng.js';
import { PersonType } from '../config/entityTypes.js';

export const SKIN_TONES = ['#f3d2b8', '#e8b994', '#d9a07a', '#c68863', '#a86e4c', '#8a5638', '#6b4129', '#4f2f1f'];
export const HAIR_COLORS = ['#1d1a18', '#2f2219', '#4a3122', '#6b4a2e', '#8c5a2b', '#b07b3e', '#d1b06b', '#8a8a8a', '#d8d4cc', '#7a2e1f'];
export const HAIR_STYLES = ['short', 'long', 'bun', 'buzz', 'curly', 'bald', 'ponytail', 'bob'];
// Kept conventional for now: names, hair length and facial hair agree.
export const HAIR_BY_GENDER = {
  f: ['long', 'long', 'bun', 'ponytail', 'bob', 'bob', 'curly'],
  m: ['short', 'short', 'buzz', 'curly', 'bald'],
};
export const FACIAL_HAIR = ['beard', 'mustache', 'goatee', 'stubble'];

const SHIRTS = {
  GUEST: ['#e28743', '#d9773a', '#e8955a', '#cf6f3a'],
  EMPLOYEE: ['#6fae45', '#5f9e3c', '#7cb956', '#4f8f3a'],
  OFFICER: ['#1f2a3a'],
};
const PANTS = {
  GUEST: ['#3b4a63', '#4a4a52', '#5a4a3a', '#2f3542'],
  EMPLOYEE: ['#3a3f4a', '#5b5346', '#2d3340', '#6b6050'],
  OFFICER: ['#18202c'],
};

export function randomAppearance(type, gender = chance(0.5) ? 'f' : 'm') {
  return {
    gender,
    skin: pick(SKIN_TONES),
    hair: pick(HAIR_COLORS),
    hairStyle: pick(HAIR_BY_GENDER[gender]),
    facialHair: gender === 'm' && chance(0.35) ? pick(FACIAL_HAIR) : null,
    glasses: chance(0.25),
    shirt: pick(SHIRTS[type.id]),
    pants: pick(PANTS[type.id]),
    height: 0.94 + Math.random() * 0.14,
    officer: type === PersonType.OFFICER,
  };
}

/** A believable-but-wrong photo for a fake/borrowed badge: same skin, different hair & glasses. */
export function mismatchedAppearance(a) {
  const others = (list, current) => list.filter((x) => x !== current);
  return {
    ...a,
    hair: pick(others(HAIR_COLORS, a.hair)),
    hairStyle: pick(others(HAIR_BY_GENDER[a.gender ?? 'm'], a.hairStyle)),
    facialHair: (a.gender ?? 'm') === 'm' ? (a.facialHair ? null : pick(FACIAL_HAIR)) : null,
    glasses: !a.glasses,
  };
}
