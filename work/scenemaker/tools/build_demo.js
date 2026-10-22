#!/usr/bin/env node
/* ============================================================================
   Scenemaker; standalone demo build (dev-only, not needed to run the app)
   ----------------------------------------------------------------------------
   Builds the browser-only demo bundle meant for static hosting (e.g. a
   Neocities portfolio): the real editor/editor.html and every editor/
   modules/*.js and editor/connections.js it loads, minified with terser and
   grouped into a handful of sm-N.min.js bundles (one per run of consecutive
   <script src> tags between the HTML's own inline <script> blocks, so load
   order and every inline script's assumptions about what's already defined
   stay exactly as they are in the real app); editor/modules/demo-mode.js
   (see that file's own header) is appended as its OWN extra, unminified
   script tag at the end, same as it always has been - it's the one file
   whose whole job is behaving differently in this build, so it stays
   readable on purpose.

   This never touches the real app: app.py/app_native.py never add
   demo-mode.js, and nothing here is required to run `python app.py`. It
   exists purely to regenerate the copy hosted at
   https://jvanwagner.neocities.org/work/scenemaker/app/editor/ (see that
   portfolio site's own DEVELOPER-NOTES.md for how a built folder actually
   gets uploaded - this script only builds it locally).

   Usage: node tools/build_demo.js [out_dir]   (default out_dir: dist/demo)
   ==========================================================================*/
'use strict';
const fs = require('fs');
const path = require('path');
const terser = require('terser');

const REPO_ROOT = path.join(__dirname, '..');
const EDITOR_DIR = path.join(REPO_ROOT, 'editor');
const OUT_DIR = path.resolve(REPO_ROOT, process.argv[2] || 'dist/demo');

// Files fetched dynamically by editor JS (menubar.js's About/Resources
// panels) rather than referenced by a static src=/href= attribute editor.html
// itself carries - not auto-discoverable by scanning the HTML, so listed by
// hand. demo-mode.js is appended deliberately (see header above); it's never
// one of editor.html's own <script> tags in the real app.
const EXTRA_LOCAL_FILES = ['about.html', 'resources.html'];
const DEMO_MODE_JS = 'modules/demo-mode.js';

function readEditorHtml() {
  return fs.readFileSync(path.join(EDITOR_DIR, 'editor.html'), 'utf-8');
}

/** Every local (non-http) src=/href= reference in the HTML, each tagged with
 * whether it's a <script src> (grouped+minified) or a plain asset (copied
 * verbatim) - css/png/ico and the like. */
function scanLocalRefs(html) {
  const assets = new Set();
  const re = /<(script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const url = m[2];
    if (/^https?:\/\//.test(url) || url.startsWith('#')) continue;
    if (m[1] === 'script') continue; // handled separately below (grouped+minified)
    assets.add(url);
  }
  return assets;
}

/** Splits editor.html's own <script src="...."></script> tags into
 * consecutive runs - a run ends wherever something else (an inline <script>,
 * a non-script tag, or the end of file) comes between two src= tags, since
 * an inline script in between may depend on an earlier group having already
 * run and the next group being defined only after it executes. Mirrors the
 * exact split the previously-hand-built demo bundle already used (one group
 * per such run), just computed fresh from today's real script list instead
 * of assumed. */
function groupScriptRuns(html) {
  const tagRe = /<script(?:\s+src="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g;
  const groups = [];
  let current = null;
  let m;
  while ((m = tagRe.exec(html))) {
    const src = m[1];
    // True adjacency only: anything but whitespace between the previous tag
    // in this run and this one (a <style> block, markup, a comment) ends the
    // run right there, even though tagRe still finds this as "the next
    // <script src> tag" - the regex has no notion of what sits between two
    // matches, so that check has to happen here, not by just trusting two
    // consecutive MATCHES actually means consecutive in the real markup. A
    // first pass without this swallowed (and silently deleted) editor.html's
    // own CSS <style> block, which sits right after the very first script
    // tag with nothing else between it and the next one.
    const adjacent = current && html.slice(current.end, m.index).trim() === '';
    if (src && !/^https?:\/\//.test(src)) {
      if (adjacent) { current.files.push(src); current.end = tagRe.lastIndex; }
      else { if (current) groups.push(current); current = { start: m.index, end: tagRe.lastIndex, files: [src] }; }
    } else {
      if (current) groups.push(current);
      current = null;
    }
  }
  if (current) groups.push(current);
  return groups;
}

async function minifyGroup(files) {
  const sources = {};
  for (const f of files) {
    sources[f] = fs.readFileSync(path.join(EDITOR_DIR, f), 'utf-8');
  }
  const result = await terser.minify(sources, { compress: true, mangle: true });
  if (result.error) throw result.error;
  return result.code;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyLocalAsset(rel) {
  // ../assets/... resolves relative to editor.html's own folder (editor/),
  // same as the browser does, landing at the real assets/ dir at repo root.
  const src = path.join(EDITOR_DIR, rel);
  const relFromRoot = path.relative(REPO_ROOT, src);
  const dest = path.join(OUT_DIR, relFromRoot.startsWith('..') ? relFromRoot.replace(/^(\.\.[\\/])+/, '') : path.join('editor', rel));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return path.relative(OUT_DIR, dest).split(path.sep).join('/');
}

async function build() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const html = readEditorHtml();

  // 0) the whole assets/ folder, wholesale: several icons (e.g.
  //    assets/icons/dialogue.png, stop.png) are only ever referenced from
  //    inside editor JS (an <img>.src assignment, not a static src="..." in
  //    editor.html itself), so the static HTML scan below can't find them -
  //    copying the real folder in full, same relative layout, is the only
  //    way to be sure every icon editor JS might reach for is actually
  //    there, instead of discovering 404s one feature at a time.
  copyDirRecursive(path.join(REPO_ROOT, 'assets'), path.join(OUT_DIR, 'assets'));

  // 1) plain assets (css/png/ico): copy verbatim, note their real output path
  //    (assets/icons/* lands OUTSIDE editor/, same relative layout as source).
  const assetRefs = scanLocalRefs(html);
  EXTRA_LOCAL_FILES.forEach((f) => assetRefs.add(f));
  const assetOutPaths = {};
  for (const ref of assetRefs) assetOutPaths[ref] = copyLocalAsset(ref);

  // 2) script groups: minify each run of consecutive <script src> tags into
  //    one sm-N.min.js, in the editor/ output folder (so './sm-N.min.js'
  //    keeps working unchanged - same relative path convention every other
  //    './modules/x.js' reference already uses).
  const groups = groupScriptRuns(html);
  let out = html;
  // Replace from the END of the file backward so earlier replacements don't
  // shift the character offsets groupScriptRuns() already recorded.
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    const bundleName = `sm-${i + 1}.min.js`;
    const code = await minifyGroup(g.files);
    fs.writeFileSync(path.join(OUT_DIR, 'editor', bundleName), code);
    out = out.slice(0, g.start) + `<script src="./${bundleName}"></script>` + out.slice(g.end);
  }
  // 3) rewrite every plain-asset reference to its real output path, relative
  //    to editor.html (which lives at editor/editor.html in the output too).
  for (const [ref, outPath] of Object.entries(assetOutPaths)) {
    const fromEditor = path.relative(path.join(OUT_DIR, 'editor'), path.join(OUT_DIR, outPath)).split(path.sep).join('/');
    out = out.split(`"${ref}"`).join(`"${fromEditor}"`);
  }
  // 4) append demo-mode.js as its own extra, unminified, un-grouped script
  //    tag at the very end - see this file's own header for why.
  fs.mkdirSync(path.join(OUT_DIR, 'editor', 'modules'), { recursive: true });
  fs.copyFileSync(path.join(EDITOR_DIR, DEMO_MODE_JS), path.join(OUT_DIR, 'editor', 'modules', 'demo-mode.js'));
  out = out.replace('</body>', '<script src="./modules/demo-mode.js"></script>\n</body>');

  fs.writeFileSync(path.join(OUT_DIR, 'editor', 'editor.html'), out);

  const totalSize = groups.reduce((sum, _, i) => sum + fs.statSync(path.join(OUT_DIR, 'editor', `sm-${i + 1}.min.js`)).size, 0);
  console.log(`Built ${groups.length} bundle(s), ${totalSize} bytes total, into ${OUT_DIR}/editor/`);
}

build().catch((e) => { console.error(e); process.exit(1); });
