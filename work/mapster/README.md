# Mapster

A grid-based level editor for 3D maps. Paint floors, put walls, doors and windows on tile edges, place objects (player start, cars, keys, arcades, benches, NPCs, signs, stairs, warps and more), attach posters, switches and mirrors to walls, and set per-map and per-floor options (camera, minimap, fog, weather, zones). **Preview** plays the map right in the editor, and **Export** saves it as a standalone playable `.html` page.

Mapster started as the map editor for *Midnight at the Multiplex* and now lives here as its own tool. Everything it needs is in this repo.

> **Portfolio build.** This folder is the web demo on jvanwagner.neocities.org, copied from the
> TOOL--Mapster repo with three changes: THREE.js r128 is bundled in `lib/` and Tailwind is
> pre-built into `vendor/tailwind.css` (so nothing loads from a CDN), and `portfolio-samples.js`
> adds an "Open a sample map" dropdown backed by `maps/samples/`. Licenses: `LICENSES.txt`.

## Running it

Open `mapster.html`. It is plain HTML and JavaScript with no build step, and works:

- double-clicked from disk (`file://`), or
- from any static server, e.g. `python3 -m http.server` in the repo root.

It needs an internet connection for two CDN scripts: Tailwind (the editor's styling) and THREE.js r128 (the 3D engine in Preview and in exported maps). (Not in this portfolio build, which bundles both.)

## Using it

- **Load Project** opens any map `.html` that carries a `<script id="map-data">` block. That includes Mapster's own exports and hand-built map files.
- **Preview** plays the current map in an overlay, using the engine files in this repo.
- **Export** saves a playable page. Set **Export Folder Depth** to match where the file will live, so its script paths resolve:

  | Depth | Save the file in | Scripts load from |
  | --- | --- | --- |
  | Same as Editor | next to `mapster.html` | `./core/…` |
  | 1 Deep (default) | `maps/` | `../core/…` |
  | 2 Deep | e.g. `maps/campaign/` | `../../core/…` |

  Browsers may drop the subfolder when saving, so move the file into place yourself. Any project with the same layout (`core/`, `vfx/` and `textures/` next to a `maps/` folder) can host exported maps the same way.
- **Branching dialogue:** NPCs and objects can carry a conversation exported from the Saymaker dialogue editor (a `.json` file). Import it from the NPC's properties; on export it's inlined into the map so it plays offline.
- The **?** buttons and the Help guide explain each tool and setting.

The map data format is documented in [MAP_FORMAT.md](MAP_FORMAT.md).

## What's in this repo

| Path | What it is |
| --- | --- |
| `mapster.html` | The editor, plus the export template (`<script id="export-template">`) that every exported map is built from |
| `core/helpManager.js`, `core/fillTools.js` | In-editor help and tooltips; the fill and wrap-walls paint tools |
| `core/engine.js` | The THREE.js runtime that plays a map (Preview and exported pages) |
| `core/cameraControls.js`, `core/windowPainter.js`, `core/dialogueRuntime.js` | Camera rotation/zoom/tilt, drawable window decals, branching-dialogue playback |
| `core/gameData.js`, `core/items.js`, `core/tokens.js` | Shared catalogs the editor and engine read: character vocabulary (pronouns etc.), the item and clothing list, and the `[NAME]`/`[they]` text tokens for names and pronouns |
| `vfx/` | Skybox, lighting, fog and weather (rain, snow) |
| `textures/` | Procedural floor and wall textures |
| `theme/win9x.css` | The editor's Windows-9x look |
| `custom/` | Drop-in folders for custom assets (objects, NPCs, textures, sounds, music, weather sprites…) |
| `maps/` | Put exported maps here (the default export depth points here) |

## Relationship to Midnight at the Multiplex

The engine, VFX, texture and catalog files here (`core/engine.js`, `core/cameraControls.js`, `core/windowPainter.js`, `core/dialogueRuntime.js`, `core/gameData.js`, `core/items.js`, `core/tokens.js`, `vfx/`, `textures/`) are copies of the ones the game uses. The game keeps its own copies because it plays maps with them. The two sets are now separate: a change to one doesn't reach the other, so copy a file across if you want both to have it. Maps exported here (at depth 1) can be dropped into the game's `maps/` folder, because the game's `core/`, `vfx/` and `textures/` sit one level up from it in the same layout.
