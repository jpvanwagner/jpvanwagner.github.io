#!/usr/bin/env node
/* ============================================================================
 *  tools/sync_portfolio_demo.js  —  copy the web demo onto Joe's portfolio site
 * ----------------------------------------------------------------------------
 *  STANDING RULE (Joe, 2026-10): whenever the game changes, the copy of the web
 *  demo on his portfolio website gets updated too. The site is a SEPARATE repo:
 *  github.com/Nostalginaut/Portfolio (plain static files, uploaded to Neocities).
 *
 *    Portfolio/work/midnight-multiplex/      ← demo/        (npm run demo)
 *    Portfolio/work/midnight-minigames/
 *        timber-lanes.html                   ← web/timberlanes/index.html (npm run web)
 *        theater-cleanup.html                ← web/leafblower/index.html  (npm run web)
 *
 *  Usage:   npm run demo && npm run web
 *           node tools/sync_portfolio_demo.js [path/to/Portfolio]
 *  (default path: $PORTFOLIO_DIR, else ../portfolio, else /home/user/portfolio)
 *  Then, in the Portfolio repo: python3 tools/stamp-version.py, commit, push.
 *  See CLAUDE.md → "The portfolio-site copy of the demo".
 *
 *  SITE-OWNED FILES — the site customised these on purpose; they are never
 *  overwritten or deleted here:
 *    demo-mute.js     the site's one-click mute button (its <script> tag is
 *                     re-inserted into index.html below)
 *    core/credits.js  the site shows a short "coming soon" credits card, not
 *                     the game's full credits roll
 *  Everything else in work/midnight-multiplex/ is replaced by the fresh build
 *  (files that no longer exist in demo/ are removed), so DON'T hand-edit the
 *  site's copy: change the game (or core/demo.js for demo-only behaviour) and
 *  re-sync. The site's fullscreen hand-off (shared/demo-controls.js) is built in:
 *  core/demo.js §5 + game.js "FULLSCREEN DELEGATE".
 *
 *  SCOPE: the demo stops after the first-shift lobby (Screens.DEMO_END). Don't
 *  lengthen it unless Joe asks — only the opening (title, intro, chargen, wake-up,
 *  parking lot, tutorials, first shift) and shared game mechanics update.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEMO = path.join(ROOT, 'demo');
const WEB = path.join(ROOT, 'web');

const KEEP = new Set(['demo-mute.js', 'core/credits.js']);        // site-owned
const SKIP = new Set(['README.txt', 'embed-example.html']);       // build extras the site doesn't use
const MUTE_TAG = '<script src="demo-mute.js"></script>  <!-- portfolio add-on: mute button (loads before any audio) -->';
const MUTE_ANCHOR = '<script>window.MM_BUILD = { demo: true };</script>';
const MINIGAMES = [
  ['web/timberlanes/index.html', 'timber-lanes.html'],
  ['web/leafblower/index.html', 'theater-cleanup.html'],
];

function findPortfolio() {
  const cands = [process.argv[2], process.env.PORTFOLIO_DIR, path.join(ROOT, '..', 'portfolio'), '/home/user/portfolio'].filter(Boolean);
  for (const c of cands) {
    if (fs.existsSync(path.join(c, 'work', 'midnight-multiplex', 'index.html'))) return path.resolve(c);
  }
  console.error('Portfolio checkout not found (looked in: ' + cands.join(', ') + ').\n' +
    'Clone github.com/Nostalginaut/Portfolio and pass its path.');
  process.exit(1);
}

function walk(dir, base = dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

(function main() {
  if (!fs.existsSync(path.join(DEMO, 'index.html'))) { console.error('demo/ not built — run `npm run demo` first.'); process.exit(1); }
  const PF = findPortfolio();
  const DEST = path.join(PF, 'work', 'midnight-multiplex');
  const changed = [], added = [], removed = [];

  // 1. copy the build (except extras), noting what actually changed
  const src = walk(DEMO).filter(f => !SKIP.has(f));
  const srcSet = new Set(src);
  for (const f of src) {
    if (KEEP.has(f)) continue;
    const from = path.join(DEMO, f), to = path.join(DEST, f);
    let data = fs.readFileSync(from);
    if (f === 'index.html' && fs.existsSync(path.join(DEST, 'demo-mute.js'))) {
      let html = data.toString('utf8');
      if (!html.includes(MUTE_ANCHOR)) { console.error('index.html: mute-tag anchor not found — update MUTE_ANCHOR.'); process.exit(1); }
      html = html.replace(MUTE_ANCHOR, MUTE_ANCHOR + '\n' + MUTE_TAG);
      data = Buffer.from(html, 'utf8');
    }
    const exists = fs.existsSync(to);
    if (exists && Buffer.compare(fs.readFileSync(to), data) === 0) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, data);
    (exists ? changed : added).push('work/midnight-multiplex/' + f);
  }
  // 2. remove stale files (never site-owned ones)
  for (const f of walk(DEST)) {
    if (srcSet.has(f) || KEEP.has(f)) continue;
    fs.unlinkSync(path.join(DEST, f));
    removed.push('work/midnight-multiplex/' + f);
  }
  // 3. the two minigames (single-file builds from npm run web)
  const mgDir = path.join(PF, 'work', 'midnight-minigames');
  for (const [from, to] of MINIGAMES) {
    const s = path.join(ROOT, from);
    if (!fs.existsSync(s)) { console.warn('skip ' + to + ': ' + from + ' missing (run `npm run web`)'); continue; }
    const d = path.join(mgDir, to);
    const data = fs.readFileSync(s);
    if (fs.existsSync(d) && Buffer.compare(fs.readFileSync(d), data) === 0) continue;
    fs.mkdirSync(mgDir, { recursive: true });
    (fs.existsSync(d) ? changed : added).push('work/midnight-minigames/' + to);
    fs.writeFileSync(d, data);
  }

  const n = changed.length + added.length + removed.length;
  console.log('Portfolio: ' + PF);
  if (!n) { console.log('Already up to date — nothing changed.'); return; }
  changed.forEach(f => console.log('  M ' + f));
  added.forEach(f => console.log('  A ' + f));
  removed.forEach(f => console.log('  D ' + f));
  console.log(n + ' file(s) synced. Kept site-owned: ' + [...KEEP].join(', ') + '.');
  console.log('Next (in the Portfolio repo): python3 tools/stamp-version.py, then commit + push.');
})();
