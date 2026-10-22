/*
 * What a visitor says when they reach the desk. Sometimes just a name,
 * sometimes who they're seeing, when, and why - a little flavour, and a
 * nudge to check the time on the desk computer. Visitors who aren't on the
 * list are just as confident: they name a host and a time too.
 */
import { pick, chance } from '../core/rng.js';
import { formatClock } from '../core/clock.js';

const VENDORS = [
  'Kessler Office Supply', 'Brightline HVAC', 'Northwind Catering', 'Dunmore Paper', 'Bluebird Couriers',
  'Sterling Recruiting', 'Pixel Perfect Printing', 'Acme Plumbing', 'Halvorsen Elevators', 'Quarry Fire & Safety',
];
const TOPICS = [
  'the quarterly review', 'an interview', 'the budget meeting', 'a site survey', 'the vendor demo',
  'a contract signing', 'the onboarding session', 'an audit walkthrough', 'lunch', 'the project kickoff',
];

const time = (m) => formatClock(m).replace(/^0/, '');
const first = (name) => name.split(' ')[0];

/**
 * @param person  the visitor (name, appointment or null)
 * @param opts    { now: clock minutes, timing: 'on-time'|'early'|'late', hosts: roster employees }
 */
export function visitorGreeting(person, { now, timing, hosts = [] }) {
  const name = person.name;
  const a = person.appointment;
  // Unlisted visitors claim someone and some time all the same.
  const host = a?.host ?? (hosts.length ? pick(hosts).name : 'someone in Legal');
  const at = a ? time(a.minutes) : time(Math.round((now + 20 + Math.random() * 60) / 15) * 15);
  const where = a ? `the ${a.roomLabel}` : pick(['the Conference Room', 'the Training Room', 'the Private Offices']);

  if (chance(0.25)) return `Hi, I’m ${name}.`;
  if (a?.service) {
    return pick([
      `${name}, ${pick(VENDORS)}. I’m booked for ${a.service.toLowerCase()} in the ${a.roomLabel} at ${at}.`,
      `Morning! ${name}, here for the ${a.service.toLowerCase()}. ${first(host)} set it up for ${at}.`,
    ]);
  }
  const lines = [
    `Hi! ${name}. I’ve got a ${at} with ${host}.`,
    `${name}, here to see ${first(host)} at ${at} about ${pick(TOPICS)}.`,
    `Hello, I’m ${name}. I’m meeting ${host} in ${where}.`,
    `${name}. ${first(host)} should be expecting me for ${pick(TOPICS)}.`,
    `Good morning. ${name}, from ${pick(VENDORS)}. My appointment’s at ${at}.`,
  ];
  if (timing === 'early') lines.push(`${name}. I know I’m early for my ${at}, I don’t mind waiting!`);
  if (timing === 'late') lines.push(`${name}. So sorry, traffic was awful. I was supposed to see ${first(host)} at ${at}.`);
  return pick(lines);
}
