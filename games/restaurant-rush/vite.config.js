import { cpSync, rmSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import { THREE_FILE } from './vite.three.config.js';

// The web build: index.html plus an assets/ folder, made of ordinary (classic) scripts and a
// stylesheet, so the very same files work from any web host (Neocities included) AND from a plain
// double-click on index.html (file://, where browsers refuse module scripts, cross-origin links,
// font files and fetch()):
//
//   assets/three-r186.js  the 3D engine, a global THREE (vite.three.config.js). Named for its
//                         release, so it stays cached across game updates.
//   assets/game-*.js      the game itself (simulation, rendering, stations, the office)
//   assets/game-*.css     styles, with the fonts built in
//   people/*.js           the people, each a small script loaded only when someone wearing it
//                         walks in (scripts/people/build.mjs makes them; they live at the root)
//
// Game file names carry a content hash, so a new upload never serves a stale mix of old and new.
// Every file type here (.html .js .css .txt) is on Neocities' free-plan list.
// dev.html is the source page (`npm run dev`). `npm run build` writes the result to the repo root,
// which is what the portfolio's sync copies.

// Lazy `import('./x.js')` calls (kept for the dev server) become ordinary imports here: a classic
// script is one file, and it's small enough that the stations needn't be separate.
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

// Fontsource lists a .woff fallback after every .woff2; every browser that runs the game reads
// woff2, so drop the fallbacks before the fonts are built into the stylesheet.
function woff2Only() {
  return {
    name: 'woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@fontsource') || !id.endsWith('.css')) return null;
      return { code: code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, ''), map: null };
    },
  };
}

// Turn Vite's module script tag into classic, deferred scripts (three first), and drop the
// crossorigin attributes that file:// pages can't satisfy.
function classicPage() {
  return {
    name: 'classic-page',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue;
        let html = String(file.source);
        html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
        html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/,
          (_, src) => `<script defer src="./assets/${THREE_FILE}"></script>\n    <script defer src="${src}"></script>`);
        html = html.replace(/ crossorigin(?=[ >])/g, '');
        if (/type="module"/.test(html)) throw new Error('classic-page: a module script is left in the page');
        file.source = html;
      }
    },
  };
}

function publish() {
  return {
    name: 'publish-to-root',
    closeBundle() {
      rmSync('assets', { recursive: true, force: true });
      cpSync('dist/assets', 'assets', { recursive: true });
      mkdirSync('assets', { recursive: true });
      copyFileSync(`dist-three/${THREE_FILE}`, `assets/${THREE_FILE}`);
      copyFileSync('dist/dev.html', 'index.html');
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  server: { open: '/dev.html' },
  plugins: [staticImports(), woff2Only(), classicPage(), publish()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,                     // .map files aren't on Neocities' free-plan list
    modulePreload: false,
    assetsInlineLimit: () => true,        // fonts go inside the stylesheet (file:// can't fetch them)
    cssCodeSplit: false,
    rolldownOptions: {
      input: 'dev.html',
      external: ['three'],
      output: {
        format: 'iife',
        globals: { three: 'THREE' },
        entryFileNames: 'assets/game-[hash].js',
        assetFileNames: 'assets/game-[hash][extname]',
      },
    },
  },
});
