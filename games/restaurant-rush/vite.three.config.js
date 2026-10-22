import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// three.js as a classic script defining `window.THREE`, named for its release (three-r186.js) so
// a new game build doesn't make browsers download the engine again. `npm run build` runs this
// first; vite.config.js copies the result into assets/ and points the page at it.
const r = JSON.parse(readFileSync('node_modules/three/package.json', 'utf8')).version.split('.')[1];
export const THREE_FILE = `three-r${r}.js`;

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-three',
    emptyOutDir: true,
    sourcemap: false,
    lib: { entry: 'src/vendor/three.js', name: 'THREE', formats: ['iife'], fileName: () => THREE_FILE },
  },
});
