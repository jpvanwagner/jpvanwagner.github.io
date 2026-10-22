/*
 * Hands out full names with no repeats within a shift (and avoids repeating a
 * first OR last name too often, so the log doesn't read "Smith, Smith, Smith").
 */
import { FIRST_NAMES, LAST_NAMES } from '../data/names.js';
import { pick } from './rng.js';

export class NamePool {
  constructor(first = FIRST_NAMES, last = LAST_NAMES) {
    this.first = first;
    this.last = last;
    this.used = new Set();
    this.recentFirst = [];
    this.recentLast = [];
  }

  /** Reserve a specific name (e.g. pre-booked appointments). Returns false if taken. */
  claim(name) {
    if (this.used.has(name)) return false;
    this.used.add(name);
    return true;
  }

  has(name) {
    return this.used.has(name);
  }

  next({ last } = {}) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const f = pick(this.first);
      const l = last ?? pick(this.last);
      const name = `${f} ${l}`;
      if (this.used.has(name)) continue;
      // Soft rule: avoid reusing a first/last name from the last dozen people.
      if (attempt < 120 && (this.recentFirst.includes(f) || (!last && this.recentLast.includes(l)))) continue;
      this.used.add(name);
      this.recentFirst = [...this.recentFirst.slice(-11), f];
      this.recentLast = [...this.recentLast.slice(-11), l];
      return name;
    }
    // Pools exhausted (practically impossible): fall back to a numbered name.
    const name = `${pick(this.first)} ${last ?? pick(this.last)} ${this.used.size}`;
    this.used.add(name);
    return name;
  }
}

/** "Priya Patel" -> "Patel, Priya" (for sorted visitor lists). */
export function lastFirst(name) {
  const parts = name.split(' ');
  const last = parts.pop();
  return `${last}, ${parts.join(' ')}`;
}
