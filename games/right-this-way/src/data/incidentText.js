/*
 * Incident log text. From the design sketch:
 *   orange (unaccompanied visitor) -> "Drawn from random list 1"
 *   green  (employee drill)        -> "Drawn from random list 2"
 * Lines are appended after the person's name: "<Name> is taking pictures of equipment."
 */

// Random list 1 - unaccompanied visitor behaviour (anywhere)
export const GUEST_INCIDENTS = [
  'is taking pictures of equipment.',
  'is trying door handles.',
  'is reading documents left on a desk.',
  'is asking employees for their Wi-Fi password.',
  'is filming the hallway on their phone.',
  'is looking for an unlocked computer.',
  'is wandering without a visitor badge.',
];

// Room-specific variants of list 1 (used when the visitor is in that room)
export const GUEST_INCIDENTS_BY_ROOM = {
  server: ['is touching critical server equipment!', 'is plugging a USB stick into a rack!', 'is photographing the server racks.'],
  private: ['is snooping through a private office.', 'is reading an executive’s whiteboard.'],
  open: ['is disrupting employees in the open office.', 'is looking over shoulders at screens.'],
  conference: ['is photographing the meeting whiteboard.'],
  breakroom: ['is helping themselves to the staff fridge.'],
  cafeteria: ['is chatting up staff about the facility layout.'],
  hallway: ['is taking pictures of the evacuation map.'],
};

// Random list 2 - employee response drills
export const DRILL_INCIDENTS = [
  'is conducting a response test.',
  'triggered a test duress alarm.',
  'reported a "suspicious package" (drill).',
  'is running a tailgating drill at a side door.',
  'is testing the panic button at their desk.',
];

/**
 * Short "why" for each desk mistake, shown on the score popup and in the log,
 * so players learn the rule from the mistake.
 */
export const DESK_REASON = {
  unchecked: (guest) => (guest ? 'Right call, but look them up first to score' : 'Right call, but check their ID first to score'),
  deniedValid: (guest) => (guest ? 'They\u2019re on the list: don\u2019t deny' : 'Valid badge: let them in'),
  deniedExpired: 'Expired badge: print a temp badge, don\u2019t deny',
  deniedUnlisted: 'Not on the list: Officer verify, don\u2019t deny',
  borrowedBadge: 'Not their badge: deny',
  expiredNoPass: 'Expired badge: print a temp badge first',
  letInUnescorted: 'Visitors need an escort',
  noAppointment: 'Not on the list: Officer verify',
  needlessVerify: 'On the list and on time: no verify needed',
  tooLate: 'Over 15 min late: Officer verify',
  tooEarly: 'Over 15 min early: Waiting area',
  neededEscort: 'An officer was free: Call escort',
  noPass: 'Print their guest pass first',
};

// System-generated incident text
export const SYSTEM_TEXT = {
  letInUnescorted: 'was let in without an escort.',
  tailgated: 'lost patience and tailgated through the checkpoint.',
  wanderedOff: 'got tired of waiting and slipped into the facility.',
  expiredNoPass: 'got in on an expired badge without a temp badge.',
  borrowedBadge: 'got in on somebody else\u2019s badge.',
  notVerified: 'was turned away without checking with security.',
  needlessVerify: 'was sent for verification despite being on the list.',
  tooLate: 'was more than 15 minutes late and should have been checked by an officer for rescheduling.',
  tooEarly: 'was more than 15 minutes early and should have waited in the waiting area.',
  neededEscort: 'was sent to the waiting area while an officer was free to escort them.',
  rescheduled: (time) => `was rescheduled for ${time} and is waiting in the waiting area.`,
  notRescheduled: 'couldn\u2019t be rescheduled today and was asked to leave.',
  noAppointment: 'was let in with no appointment on file.',
  noPass: 'entered without a printed guest pass.',
  raceCondition: 'escort arrived before the guest pass was printed. Desk delayed.',
  forcedDoor: (door) => `forced open the ${door} door.`,
  doorPropped: () => 'is propped open. Send an officer to close it before someone wanders through.',
  doorClosed: (door) => `closed the propped ${door} door.`,
  leftInLounge: (room) => `was left in the ${room.toLowerCase()} to wait. Send a guard before they get restless.`,
  restless: (room) => `got restless in the ${room.toLowerCase()} and went exploring.`,
  restroomRequest: 'needs the restroom. Visitors need a guard to walk them there.',
  restroomAlone: 'gave up waiting and went to find the restroom alone.',
  verifyAdded: 'checks out: their host confirmed the visit. Added to the list; they\u2019re lining up again.',
  verifyRejected: 'wasn\u2019t expected by anyone and was sent home.',
  verifyLate: 'is late for their appointment. Waiting for an officer to check about rescheduling.',
  verifyWaiting: 'isn\u2019t on the list. Waiting for an officer to check with security.',
  deniedValid: 'was turned away despite valid credentials.',
};
