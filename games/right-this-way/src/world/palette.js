/*
 * Colour palette for the 3D world ("muted, paper-y, professional-yet-dorky
 * Office Space"). UI colours live in styles/tokens.css.
 */
export const PALETTE = {
  background: 0xdfe2d6,
  ground: 0xb9c4a6, // muted lawn around the building
  wallSide: 0xf4f0e6,
  wallTop: 0x4f5763,
  glazing: 0x8fb3c9, // outer walls read as window bands from above
  glazingSide: 0xb9d3e2,
  floors: {
    lobby: ['#ece6da', '#ddd4c3'],
    hall: '#e7e2d6',
    carpetBlue: '#c9d5e3',
    carpetGreen: '#cfdfc2',
    carpetWarm: '#e3cfba',
    tile: '#efe9dd',
    tileBlue: '#d9e5ea',
    server: '#cdd3db',
    concrete: '#cfcac0',
    wood: '#c79f78',
  },
  label: '#8a8578',
  labelSecure: '#b45454',
  furniture: {
    securityDesk: 0x4b5563,
    cubicle: 0xb9b0a0,
    cubicleTop: 0xe9e3d6,
    rack: 0x353c47,
    execDesk: 0x9c7f62,
    shelf: 0x8d775f,
    table: 0xb9a78c,
    counter: 0xcfc8b8,
    cooler: 0x9cc3de,
    vending: 0x8f9aa6,
    plant: 0x76a066,
    pot: 0xb07a55,
    rope: 0xa33b3b,
    chair: 0x7c8794,
  },
  // Doors use colours the walls never do, so openings read at a glance:
  // secure (badge) doors are blue, ordinary doors are wood, propped doors amber.
  door: {
    secure: 0x2f6fb0,
    secureFrame: 0x1d4a7a,
    secureMat: 0x6fa3d8,
    plain: 0xc08a52,
    plainFrame: 0x7e5631,
    plainMat: 0xd9b48a,
    propped: 0xe0a33a,
    glass: 0xbcd6e6,
    readerLocked: 0xe0473a,
    readerOpen: 0x3fbf5f,
  },
  camera: { body: 0x1f2328, ledOff: 0x5a1b1b, ledOn: 0xff3b30 },
  rings: { unescorted: 0xd94a3a, desk: 0x2f6fb0, observed: 0x2f6fb0 },
  tether: 0x2f6fb0,
};
