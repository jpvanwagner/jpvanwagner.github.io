// The 3D engine, built on its own (vite.three.config.js) as a classic script that defines a
// global THREE. The game's own script uses that global, so the engine is a separate file that
// browsers keep cached between game updates, and both load from a plain double-click (file://).
export * from 'three';
