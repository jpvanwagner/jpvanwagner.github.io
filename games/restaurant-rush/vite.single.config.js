import { copyFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Make the built page pure ASCII: non-ASCII characters (·, —, ½, ★ …) become \u escapes inside
// <script> and &#x…; entities elsewhere. A page served or embedded without a reliable charset
// can otherwise be decoded with the wrong encoding, which corrupts the script before it runs.
function asciiOnly() {
  const jsEscape = (s) => s.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const htmlEscape = (s) => s.replace(/[^\x00-\x7f]/gu, (c) => `&#x${c.codePointAt(0).toString(16)};`);
  const transform = (html) => {
    let out = '';
    let i = 0;
    const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html))) {
      const start = m.index + m[0].indexOf('>') + 1;
      out += htmlEscape(html.slice(i, start)) + jsEscape(m[1]) + '</script>';
      i = m.index + m[0].length;
    }
    return out + htmlEscape(html.slice(i));
  };
  return {
    name: 'ascii-only',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.html')) file.source = transform(classicScript(String(file.source)));
      }
    },
  };
}

// Run the inlined bundle as an ordinary (classic) script at the end of <body> instead of an
// inline <script type="module"> in <head>. Some embed/viewer frames run ordinary inline scripts
// but skip inline modules; the bundle uses no module-only syntax, and a strict-mode IIFE keeps
// its module semantics. Being last in <body>, it runs after the page's markup exists.
function classicScript(html) {
  const re = /<script type="module"[^>]*>([\s\S]*?)<\/script>/;
  const m = html.match(re);
  if (!m) return html;
  { const bad = m[1].match(/.{0,60}(\bimport\.meta\b|^\s*(import|export)\s).{0,60}/m); if (bad) throw new Error('bundle uses module-only syntax: ' + bad[0]); }
  // A bare <script> tag: some hosts only allow inline scripts with no attributes.
  const tag = `<script>window.__rrStep="game script started";try{(function(){"use strict";\n${m[1]}\n})();}catch(e){window.__rrBootError=e;throw e}</script>`;
  const without = html.replace(m[0], '');
  const end = without.lastIndexOf('</body>');
  return without.slice(0, end) + tag + '\n' + without.slice(end);
}

// In one file everything is inlined anyway, so turn the lazy `import('./x.js')` calls (stations,
// the office) back into ordinary imports. That keeps Vite's dynamic-import runtime, which needs
// import.meta and so can't run as a classic script, out of the bundle.
function staticImports() {
  return {
    name: 'static-imports',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/src/') || !/\bimport\(\s*['"]\./.test(code)) return null;
      const heads = [];
      const out = code.replace(/\bimport\(\s*(['"])(\.[^'"]+)\1\s*\)/g, (_, q, spec) => {
        const name = `__inl${heads.length}`;
        heads.push(`import * as ${name} from ${q}${spec}${q};`);
        return `Promise.resolve(${name})`;
      });
      return { code: `${heads.join('\n')}\n${out}`, map: null };
    },
  };
}

// Copy the finished file to where it's used: standalone/ (gitignored) for offline play and the
// claude.ai preview (scripts/split.mjs splits it into page + game.js + game.css there).
function standalone() {
  return {
    name: 'standalone',
    writeBundle(opts) {
      mkdirSync('standalone', { recursive: true });
      copyFileSync(`${opts.dir}/dev.html`, 'standalone/restaurant-rush.html');
    },
  };
}

// `npm run build:single`: ONE self-contained HTML file (three.js, the stations and the fonts all
// inlined) that opens with a double-click. The web build is vite.config.js. The people models
// (people/) are separate files, so this build plays with the simple stand-in figures.
export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [staticImports(), viteSingleFile(), asciiOnly(), standalone()],
  // No modulepreload helper: it uses import.meta, which a classic (non-module) script can't run.
  build: { outDir: 'dist-single', emptyOutDir: true, modulePreload: false, chunkSizeWarningLimit: 2000, rolldownOptions: { input: 'dev.html' } },
});
