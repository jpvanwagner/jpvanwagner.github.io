import { defineConfig } from 'vite';

/*
 * dev.html is the development entry (served by `npm run dev`).
 * `npm run build` bundles it, then scripts/make-standalone.mjs inlines the JS
 * and CSS into the root index.html, which opens with a plain double-click.
 */
export default defineConfig({
  base: './',
  server: { host: true, port: 5173, open: '/dev.html' },
  build: {
    chunkSizeWarningLimit: 900, // three.js alone is ~600 kB
    modulePreload: false,
    assetsInlineLimit: 256 * 1024, // inline the fonts so the export is one file
    rolldownOptions: { input: 'dev.html' },
  },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
