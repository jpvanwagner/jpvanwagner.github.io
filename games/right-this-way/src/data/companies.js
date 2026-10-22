/*
 * Who you're running the front desk for. One employer is picked at random the
 * first time you play and then kept (see core/career.js), so the badges,
 * signage and visitor computer stay consistent day after day.
 *
 * Tongue-in-cheek nods to fictional mega-corporations, each with its own
 * similar-but-different logo - plus the Orochi Group from The Secret World
 * under its own name. Logos are SVG markup (viewBox 0 0 100 100), used on ID
 * cards, the visitor computer, the title screen, the lobby floor decal and
 * the staff's chest badges. Pure data: no DOM, no three.js.
 */

const FONT = "'Inter Variable', Inter, 'Helvetica Neue', Arial, sans-serif";

const at = (cx, cy, r, deg) => {
  const t = (deg * Math.PI) / 180;
  return [cx + Math.sin(t) * r, cy - Math.cos(t) * r];
};
const pt = ([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`;

// Parasol Org: an eight-panel parasol from above, scalloped, tipped, with a knob.
function parasol() {
  const panels = Array.from({ length: 8 }, (_, i) => {
    const a = i * 45 + 22.5;
    const b = a + 45;
    const fill = i % 2 ? '#f4efe4' : '#c8102e';
    return `<path d="M50 50 L${pt(at(50, 50, 45, a))} Q${pt(at(50, 50, 37, a + 22.5))} ${pt(at(50, 50, 45, b))} Z" fill="${fill}" stroke="#2a1416" stroke-width="1.4" stroke-linejoin="round"/>`;
  }).join('');
  const tips = Array.from({ length: 8 }, (_, i) => `<circle cx="${at(50, 50, 45, i * 45 + 22.5)[0].toFixed(2)}" cy="${at(50, 50, 45, i * 45 + 22.5)[1].toFixed(2)}" r="2.4" fill="#2a1416"/>`).join('');
  return `${panels}${tips}<circle cx="50" cy="50" r="5.5" fill="#f4efe4" stroke="#2a1416" stroke-width="1.6"/>`;
}

// Wexford-Yamato: a winged chevron "W" over a short bar.
function wexford() {
  return `<rect x="4" y="4" width="92" height="92" rx="14" fill="#1b2230"/>
<path d="M12 30 H27 L39 60 L50 38 L61 60 L73 30 H88 L66 78 H56 L50 66 L44 78 H34 Z" fill="#d4ad55"/>
<path d="M8 24 H38 M62 24 H92" stroke="#d4ad55" stroke-width="3.2" stroke-linecap="round"/>
<rect x="46" y="16" width="8" height="12" rx="1.5" fill="#d4ad55"/>`;
}

// Shinto Electric Power Co.: a red diamond split by a lightning bolt.
function shinto() {
  return `<path d="M50 3 L97 50 L50 97 L3 50 Z" fill="#c4161c"/>
<path d="M50 13 L87 50 L50 87 L13 50 Z" fill="none" stroke="#fff" stroke-width="2.4"/>
<path d="M56 22 L37 54 H50 L42 80 L66 44 H53 Z" fill="#fff"/>`;
}

// SkyLAN Defense Systems: a wireframe globe with one red eye.
function skylan() {
  const lines = [0.35, 0.7].map((k) => `<ellipse cx="50" cy="50" rx="${(40 * k).toFixed(1)}" ry="40" fill="none" stroke="#9fb3c8" stroke-width="2"/>`).join('');
  const lat = [-20, 0, 20].map((y) => {
    const half = Math.sqrt(40 * 40 - y * y);
    return `<path d="M${(50 - half).toFixed(1)} ${50 + y} H${(50 + half).toFixed(1)}" stroke="#9fb3c8" stroke-width="2"/>`;
  }).join('');
  return `<circle cx="50" cy="50" r="46" fill="#1e2630"/>
<circle cx="50" cy="50" r="40" fill="none" stroke="#9fb3c8" stroke-width="2.4"/>${lines}${lat}
<circle cx="50" cy="50" r="9" fill="#ff2d2d" opacity="0.35"/><circle cx="50" cy="50" r="5" fill="#ff3b3b"/>`;
}

// Scalar Industries: magnitude without direction - |S|, the absolute value of an S.
function scalar() {
  return `<circle cx="50" cy="50" r="46" fill="#0d3b8c"/>
<circle cx="50" cy="50" r="40" fill="none" stroke="#7fb2ff" stroke-width="2"/>
<rect x="24" y="24" width="7" height="52" rx="2" fill="#fff"/>
<rect x="69" y="24" width="7" height="52" rx="2" fill="#fff"/>
<text x="50" y="68" font-family="${FONT}" font-weight="900" font-size="46" text-anchor="middle" fill="#fff">S</text>`;
}

// Iris Science: a six-blade iris diaphragm.
function iris() {
  const blades = Array.from({ length: 6 }, (_, i) => {
    const a = i * 60;
    return `<path d="M${pt(at(50, 50, 12, a))} L${pt(at(50, 50, 41, a + 18))} A41 41 0 0 1 ${pt(at(50, 50, 41, a + 70))} Z" fill="${i % 2 ? '#e9e7e2' : '#d6d3cc'}" stroke="#2b2b2b" stroke-width="1.6" stroke-linejoin="round"/>`;
  }).join('');
  return `<circle cx="50" cy="50" r="46" fill="#2b2b2b"/>${blades}<circle cx="50" cy="50" r="10" fill="#f28c28"/>`;
}

// Black Butte Research Facility: a narrow butte against a setting sun.
function blackButte() {
  return `<circle cx="50" cy="50" r="45" fill="#f1e5d1" stroke="#1d1d1d" stroke-width="4"/>
<circle cx="50" cy="44" r="15" fill="#e8742a"/>
<path d="M10 68 H30 L37 42 H63 L70 68 H90 V76 H10 Z" fill="#1d1d1d"/>
<path d="M18 82 H82 M26 88 H74" stroke="#1d1d1d" stroke-width="2.4" stroke-linecap="round"/>`;
}

// Orochi Group: a square frame in two L-shaped halves (split by diagonal slits
// at two corners) around a square spiral
// (after the emblem in The Secret World).
function orochi() {
  return `<rect x="1" y="1" width="98" height="98" fill="#fff"/>
<path d="M8.5 6 H94 V91.5 L85 82.5 V15 H17.5 Z" fill="#111"/>
<path d="M6 8.5 L15 17.5 V85 H82.5 L91.5 94 H6 Z" fill="#111"/>
<path d="M26 26 H74 V74 H30 V40 H60 V60 H44 V51" fill="none" stroke="#111" stroke-width="7.5" stroke-linecap="butt" stroke-linejoin="miter"/>`;
}

export const COMPANIES = [
  { id: 'parasol', word: 'PARASOL', wordColor: '#c8102e', name: 'Parasol Org', nod: 'Umbrella Corporation', tagline: 'Our business is life itself. Mostly.', site: 'Arklay Hills Campus', accent: '#c8102e', ink: '#2a1416', draw: parasol },
  { id: 'wexford', word: 'WEXFORD\u2013YAMATO', wordColor: '#1b2230', name: 'Wexford-Yamato Corp.', nod: 'Weyland-Yutani', tagline: 'Building Bigger Worlds', site: 'Hadley Annex', accent: '#b38a2e', ink: '#1b2230', draw: wexford },
  { id: 'shinto', word: 'SHINTO', wordColor: '#c4161c', name: 'Shinto Electric Power Co.', nod: 'Shinra', tagline: 'Powering every sector', site: 'Sector 0 Office', accent: '#c4161c', ink: '#3a0a0c', draw: shinto },
  { id: 'skylan', word: 'SKYLAN', wordColor: '#1e2630', name: 'SkyLAN Defense Systems', nod: 'Skynet / Cyberdyne', tagline: 'Your network is in good hands.', site: 'Mountain View Bunker', accent: '#d22f2f', ink: '#1e2630', draw: skylan },
  { id: 'scalar', word: 'SCALAR', wordColor: '#0d3b8c', name: 'Scalar Industries', nod: 'Vector Industries', tagline: 'Magnitude without direction.', site: 'Second Miltia Branch', accent: '#0d3b8c', ink: '#0d1f40', draw: scalar },
  { id: 'iris', word: 'IRIS SCIENCE', wordColor: '#2b2b2b', name: 'Iris Science', nod: 'Aperture Science', tagline: 'We do what we can, because we must.', site: 'Enrichment Center B', accent: '#f28c28', ink: '#2b2b2b', draw: iris },
  { id: 'blackbutte', word: 'BLACK BUTTE', wordColor: '#1d1d1d', name: 'Black Butte Research Facility', nod: 'Black Mesa', tagline: 'Working hard to make tomorrow happen today.', site: 'Sector D', accent: '#e8742a', ink: '#1d1d1d', draw: blackButte },
  { id: 'orochi', word: 'OROCHI', wordColor: '#111', name: 'Orochi Group', nod: 'The Secret World', tagline: 'Leading the way.', site: 'Seoul Liaison Office', accent: '#a3121f', ink: '#111', draw: orochi },
];

const RENAMED = { shinro: 'shinto' }; // careers saved under an old id
export const getCompany = (id) => COMPANIES.find((c) => c.id === (RENAMED[id] ?? id)) ?? null;

/**
 * A company's logo as an SVG string: its emblem with the name underneath, so
 * it reads as that company's mark wherever it appears. `wordmark: false`
 * gives the bare emblem.
 */
export function companyLogoSvg(company, { size = 48, title = true, wordmark = true } = {}) {
  const word = company.word;
  const fontSize = Math.min(15, 90 / (word.length * 0.66));
  const body = wordmark
    ? `<g transform="translate(16 0) scale(0.68)">${company.draw()}</g>
<text x="50" y="${(80 + fontSize * 0.95).toFixed(1)}" font-family="${FONT}" font-weight="900" font-size="${fontSize.toFixed(1)}" letter-spacing="0.6" text-anchor="middle" fill="${company.wordColor}"${word.length > 9 ? ' textLength="94" lengthAdjust="spacingAndGlyphs"' : ''}>${word}</text>`
    : company.draw();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" class="company-logo" role="img" aria-label="${company.name}">${title ? `<title>${company.name}</title>` : ''}${body}</svg>`;
}
