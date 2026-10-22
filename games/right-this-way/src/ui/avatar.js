/*
 * Portrait drawing for ID-card photos and the "person at the desk" view.
 * Built from the same appearance data as the 3D figure, so a borrowed badge
 * (different hair / glasses) is something the player can actually spot.
 */
const NS = 'http://www.w3.org/2000/svg';

const node = (tag, attrs) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

function hair(svg, a) {
  const c = a.hair;
  switch (a.hairStyle) {
    case 'bald':
      return;
    case 'buzz':
      svg.append(node('path', { d: 'M28 38 Q50 16 72 38 Q70 30 50 26 Q30 30 28 38Z', fill: c, opacity: 0.85 }));
      return;
    case 'curly':
      for (const [x, y] of [[32, 34], [40, 26], [50, 23], [60, 26], [68, 34], [30, 44], [70, 44]]) {
        svg.append(node('circle', { cx: x, cy: y, r: 8, fill: c }));
      }
      return;
    case 'long':
      svg.append(node('path', { d: 'M27 42 Q26 18 50 18 Q74 18 73 42 L76 78 L64 78 L66 44 L34 44 L36 78 L24 78Z', fill: c }));
      return;
    case 'bob':
      svg.append(node('path', { d: 'M27 42 Q26 18 50 18 Q74 18 73 42 L74 62 L66 62 L66 44 L34 44 L34 62 L26 62Z', fill: c }));
      return;
    case 'bun':
      svg.append(node('circle', { cx: 50, cy: 14, r: 8, fill: c }));
      svg.append(node('path', { d: 'M28 40 Q28 20 50 20 Q72 20 72 40 Q64 30 50 30 Q36 30 28 40Z', fill: c }));
      return;
    case 'ponytail':
      svg.append(node('path', { d: 'M70 34 Q84 44 76 66 Q72 52 68 42Z', fill: c }));
      svg.append(node('path', { d: 'M28 40 Q28 20 50 20 Q72 20 72 40 Q64 30 50 30 Q36 30 28 40Z', fill: c }));
      return;
    default: // short
      svg.append(node('path', { d: 'M28 42 Q26 20 50 19 Q74 20 72 42 Q70 30 56 28 Q42 34 30 34Z', fill: c }));
  }
}

function facialHair(svg, a) {
  const c = a.hair;
  const jaw = 'M30 46 Q30 70 50 70 Q70 70 70 46 Q68 60 57 60 Q50 63 43 60 Q32 60 30 46Z';
  if (a.facialHair === 'beard') svg.append(node('path', { d: jaw, fill: c }));
  if (a.facialHair === 'stubble') svg.append(node('path', { d: jaw, fill: c, opacity: 0.35 }));
  if (a.facialHair === 'goatee') svg.append(node('ellipse', { cx: 50, cy: 64, rx: 5.5, ry: 5, fill: c }));
  if (a.facialHair === 'beard' || a.facialHair === 'mustache') {
    svg.append(node('path', { d: 'M41 55 Q50 50 59 55 Q50 57 41 55Z', fill: c }));
  }
}

/** Returns an <svg> portrait for an appearance. */
export function portrait(a, { size = 96, background = '#dfe6ec' } = {}) {
  const svg = node('svg', { viewBox: '0 0 100 100', width: size, height: size, class: 'portrait', role: 'img' });
  svg.append(node('rect', { x: 0, y: 0, width: 100, height: 100, fill: background }));
  // shoulders + neck
  svg.append(node('path', { d: 'M14 100 Q16 74 50 72 Q84 74 86 100Z', fill: a.shirt }));
  svg.append(node('rect', { x: 43, y: 58, width: 14, height: 16, fill: a.skin }));
  if (a.officer) {
    svg.append(node('path', { d: 'M40 74 L50 86 L60 74', fill: 'none', stroke: '#e9e4d8', 'stroke-width': 3 }));
    svg.append(node('rect', { x: 62, y: 84, width: 8, height: 9, fill: '#d4af37', rx: 1 }));
  }
  // head
  svg.append(node('ellipse', { cx: 50, cy: 44, rx: 20, ry: 23, fill: a.skin }));
  svg.append(node('ellipse', { cx: 29.5, cy: 46, rx: 3, ry: 5, fill: a.skin }));
  svg.append(node('ellipse', { cx: 70.5, cy: 46, rx: 3, ry: 5, fill: a.skin }));
  hair(svg, a);
  // face
  svg.append(node('circle', { cx: 42, cy: 46, r: 2, fill: '#2a2320' }));
  svg.append(node('circle', { cx: 58, cy: 46, r: 2, fill: '#2a2320' }));
  svg.append(node('path', { d: 'M44 57 Q50 61 56 57', fill: 'none', stroke: '#6b3f2f', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
  facialHair(svg, a);
  if (a.glasses) {
    for (const cx of [42, 58]) svg.append(node('circle', { cx, cy: 46, r: 6, fill: 'none', stroke: '#1f1f1f', 'stroke-width': 1.8 }));
    svg.append(node('line', { x1: 48, y1: 46, x2: 52, y2: 46, stroke: '#1f1f1f', 'stroke-width': 1.8 }));
  }
  if (a.officer) {
    svg.append(node('path', { d: 'M28 30 Q50 14 72 30 L72 34 L28 34Z', fill: '#141b26' }));
    svg.append(node('rect', { x: 26, y: 32, width: 48, height: 4, rx: 2, fill: '#141b26' }));
    svg.append(node('rect', { x: 46, y: 22, width: 8, height: 6, rx: 1, fill: '#d4af37' }));
  }
  return svg;
}
