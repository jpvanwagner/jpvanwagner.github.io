/*
 * The Organization: the contractor that employs every security officer.
 *
 * Its seal is a chromatic purple thumbprint inside a black double-line ring,
 * with THE across the top and ORGANIZATION around the bottom. orgLogoSvg()
 * returns the seal as SVG markup, used on the officers' ID cards (ui) and
 * rasterised onto their chest badges (world). Pure data: no DOM, no three.js.
 */

export const ORGANIZATION = {
  name: 'The Organization',
  // Small print on the back of every officer's ID card.
  smallPrint: 'Property of The Organization. If found, it will be retrieved.',
};

// --- Thumbprint ---------------------------------------------------------------
// A whorl: one elliptical spiral of ridges, broken in a few fixed places (so
// the seal is identical everywhere) the way real ridges split and end.
// Few, bold ridges so it still reads as a thumbprint at badge size.
const CENTER = { x: 50, y: 50.5 };
const TURNS = 5.4;
const SPACING = 4.5; // gap between neighbouring ridges
const ASPECT = 0.8; // thumbs are taller than they are wide
// Gaps along the spiral, in degrees travelled from the core: [start, length].
const BREAKS = [[330, 30], [700, 24], [1010, 20], [1290, 18], [1560, 16], [1800, 14]];

function printPath() {
  const total = TURNS * 360;
  const runs = [];
  let from = 40; // skip the very centre
  for (const [at, len] of BREAKS) {
    runs.push([from, at]);
    from = at + len;
  }
  runs.push([from, total]);
  const pt = (deg) => {
    const t = (deg * Math.PI) / 180;
    const r = (SPACING * deg) / 360 + 0.8;
    return `${(CENTER.x + Math.sin(t) * r * ASPECT).toFixed(2)} ${(CENTER.y - Math.cos(t) * r).toFixed(2)}`;
  };
  return runs
    .filter(([a, b]) => b - a > 4)
    .map(([a, b]) => {
      const steps = Math.ceil((b - a) / 7);
      return `M${Array.from({ length: steps + 1 }, (_, i) => pt(a + ((b - a) * i) / steps)).join('L')}`;
    })
    .join('');
}

const PRINT = printPath();

let uid = 0;

/**
 * The seal as an SVG string. `size` is the rendered width/height in px.
 * `font` should be a family the target can render (SVG drawn into a canvas
 * can't see the page's web fonts).
 */
export function orgLogoSvg({ size = 64, font = "'Inter Variable', Inter, 'Helvetica Neue', Arial, sans-serif", title = true } = {}) {
  const id = `org${(uid += 1)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" class="org-logo" role="img" aria-label="${ORGANIZATION.name}">
${title ? `<title>${ORGANIZATION.name}</title>` : ''}
<defs>
  <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2741d6"/>
    <stop offset="0.4" stop-color="#4766ff"/>
    <stop offset="0.7" stop-color="#5a4ff2"/>
    <stop offset="1" stop-color="#2c2bb8"/>
  </linearGradient>
  <path id="${id}t" d="M 12.2 50 A 37.8 37.8 0 0 1 87.8 50"/>
  <path id="${id}b" d="M 5.6 50 A 44.4 44.4 0 0 0 94.4 50"/>
</defs>
<circle cx="50" cy="50" r="48.5" fill="#f9fafe"/>
<circle cx="50" cy="50" r="47.5" fill="none" stroke="#111" stroke-width="2.4"/>
<circle cx="50" cy="50" r="35.5" fill="none" stroke="#111" stroke-width="2.4"/>
<g fill="#111" font-family="${font}" font-weight="800" text-anchor="middle">
  <text font-size="9" letter-spacing="2.5"><textPath href="#${id}t" startOffset="50%">THE</textPath></text>
  <text font-size="7.6" letter-spacing="1.2"><textPath href="#${id}b" startOffset="50%">ORGANIZATION</textPath></text>
  <circle cx="8.6" cy="50" r="1.5"/><circle cx="91.4" cy="50" r="1.5"/>
</g>
<g fill="none" stroke-linecap="round" stroke-width="2.5">
  <path d="${PRINT}" stroke="#16c6ff" opacity="0.55" transform="translate(-1.1 0.4)"/>
  <path d="${PRINT}" stroke="#a35cff" opacity="0.55" transform="translate(1.1 -0.4)"/>
  <path d="${PRINT}" stroke="url(#${id}g)"/>
</g>
</svg>`;
}
