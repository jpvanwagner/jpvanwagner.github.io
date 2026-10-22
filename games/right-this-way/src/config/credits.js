/*
 * Credit line (title, pause and end screens) and the game's name.
 *
 * The pixel-face icon next to the name: drop the image in src/assets/ as
 * credit-icon.png (or .gif / .webp / .svg) and rebuild; it's inlined into the
 * single-file build. With no file there, the credit is just text.
 */
const rasters = import.meta.glob('../assets/credit-icon.{png,gif,webp,jpg}', { eager: true, query: '?url', import: 'default' });
const svgs = import.meta.glob('../assets/credit-icon.svg', { eager: true, query: '?raw', import: 'default' });
// A raster original wins over the SVG redraw.
const icon =
  Object.values(rasters)[0] ??
  (Object.values(svgs)[0] ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(Object.values(svgs)[0])}` : null);

export const GAME = {
  name: 'Right This Way, Please',
  subtitle: 'An Access Control Management Simulator',
};

export const CREDITS = {
  author: 'Joe VanWagner',
  url: 'https://jvanwagner.neocities.org/', // portfolio (the credit link)
  gameUrl: 'https://jvanwagner.neocities.org/', // linked when sharing a grade sheet
  since: 2026,
  icon,
};

/** "2026", then "2026–2027" and so on as the years go by. */
export const copyrightYears = (now = new Date()) =>
  now.getFullYear() > CREDITS.since ? `${CREDITS.since}–${now.getFullYear()}` : `${CREDITS.since}`;
