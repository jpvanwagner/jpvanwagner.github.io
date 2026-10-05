/* ════════════════════════════════════════════════════════════════════════════
 * MIDNIGHT AT THE MULTIPLEX — MAPSTER 3D ENGINE CORE
 * ────────────────────────────────────────────────────────────────────────────
 * Location: midmulti/core/engine.js
 *
 * WHAT THIS FILE IS
 * ──────────────────────────────────────────────────────────────────────────
 * The headless 3D runtime engine for any map exported by the Mapster editor.
 * It is loaded by every exported game HTML, AND by the Mapster Preview iframe.
 * The engine is theme-agnostic: it reads a JSON map blob from the page and
 * builds the Three.js world from it. NO aesthetic decisions live here — all
 * visuals are driven by data in the map config or by the linked managers
 * (lighting, fog, weather, textures, camera).
 *
 * HOW IT GETS LOADED
 * ──────────────────────────────────────────────────────────────────────────
 *   1) Mapster's `mapster.html` injects this file into the export template
 *      as the LAST <script> tag (after Three.js + every manager module).
 *   2) The exported page also contains:
 *        <div id="game-container"></div>
 *        <script type="application/json" id="map-data">{ ...buildData... }</script>
 *      `buildData` is built in mapster.html's exportEngine() function — it
 *      contains: map (3D grid), name, settings (camera/UI/audio), fogSettings,
 *      and start { x, z, f } coordinates.
 *   3) The bottom of this file auto-calls `initEngine()` once DOMContentLoaded
 *      AND a #map-data element are both present.
 *
 * EXTERNAL DEPENDENCIES (loaded BEFORE this file by the export template)
 * ──────────────────────────────────────────────────────────────────────────
 *   THREE             — three.js r128, from cdnjs (window.THREE)
 *   LightingManager   — vfx/lightingManager.js  (lights, flicker, flashlight)
 *   FogManager        — vfx/fogManager.js       (environmental + local fog)
 *   WeatherManager    — vfx/weatherManager.js   (rain/snow particle system)
 *   SkyboxManager     — vfx/skyboxManager.js    (sky / equirect maps)
 *   CameraManager     — core/cameraControls.js  (iso/fps/cinematic cams)
 *   FloorTextures     — textures/floor.js       (procedural floor canvases)
 *   WallTextures      — textures/wall.js        (procedural wall canvases)
 *
 * Each manager is wrapped in a `typeof X !== 'undefined' ? new X(...) : fallback`
 * pattern (graceful degradation), so if a manager fails to load on
 * file:/// the engine still runs with a dummy stand-in. DO NOT REGRESS this
 * pattern — see MAPSTER.docx §5.B (CORS Security on Local file:///).
 *
 * THE MAP DATA SCHEMA (CONFIG.map[floor][z][x])
 * ──────────────────────────────────────────────────────────────────────────
 * `CONFIG.map` is a 3D array — [floors][rows(z)][cols(x)]. Each cell is:
 *   { f, o, c, n, s, e, w, d1, d2 }
 * where each property is either `null` or an object: { v, c, ac, meta }.
 *   v    — the variant string (e.g. 'grass', 'door_swing', 'npc')
 *   c    — primary color hex
 *   ac   — accent color hex (used by procedural texture functions)
 *   meta — type-specific metadata bag (solid, dialogue, linkId, etc.)
 *
 *   f  = Floor       (ground, height 0)
 *   o  = Object      (centre-tile entity: prop, NPC, key, ladder, ...)
 *   c  = Ceiling     (overhead light)
 *   n,s,e,w = cardinal edges (walls, doors, counters, windows, archways)
 *   d1,d2  = cross-tile diagonals
 *
 * MAJOR SECTIONS IN THIS FILE
 * ──────────────────────────────────────────────────────────────────────────
 *   §1  AUDIO SYNTHESIZER          — playSnd(): generated SFX (no asset deps)
 *   §2  SCENE & MANAGERS CONFIG    — boot Three.js, instantiate every manager
 *   §3  UTILITIES & DATA STRUCTS   — getTex, createHumanoid, runtime arrays
 *   §4  MAP GENERATION LOOP        — walk the 3D grid, build geometry
 *        §4.1  FLOORS              — incl. instanced grass
 *        §4.2  OBJECTS             — npc/dir/uplight/diag/key/ladder/...
 *        §4.3  CEILING LIGHTS
 *        §4.4  WALLS & EDGES       — buildEdge() inner function
 *   §5  PLAYER & UI LOGIC          — player, inventory, gap prompt, input
 *        §5.1  Player setup
 *        §5.2  UI helpers          — updateInv, showMsg, executeWarp, gap prompt
 *        §5.3  Collision detection — checkCollision()
 *        §5.4  Input handling      — keydown/keyup/wheel
 *        §5.5  Compass & minimap   — updateCompass, openDir
 *   §6  MAIN ANIMATION LOOP        — anim(): per-frame physics + render
 *
 * COMMON THINGS YOU MIGHT WANT TO CHANGE
 * ──────────────────────────────────────────────────────────────────────────
 *   - Floor height:        FLR_H constant in §2 (default 2.0)
 *   - Player walk speed:   `12 * dt` lerp in §6 (anim → "Physics Interpolation")
 *   - Jump arc height:     `Math.sin(... * 1.5)` in §6 jump branch
 *   - NPC wander chance:   `Math.random() < 0.01` in §6 "AI Update"
 *   - Dialogue timeout:    setTimeout(... 4000) in §5.4 interaction handler
 *   - SFX tone shapes:     in §1 playSnd() — frequency ramps, oscillator types
 *   - Mirror update cost:  `mTick % 2` in §6 — increase divisor to update less
 *   - Wall x-ray opacity:  `h.object.material.opacity = 0.2` in §6 x-ray block
 *   - Fallback camera:     §2 — OrthographicCamera at iso (10×aspect frustum)
 *
 * TEXTURE CACHING NOTE
 * ──────────────────────────────────────────────────────────────────────────
 * There is a `texCache = {}` object declared in §3 that is currently a stub
 * — declared but not read or written from. MAPSTER.docx §6.5 calls out
 * implementing it as a roadmap item to stop re-generating identical canvas
 * textures per tile. Wiring this is a future optimization.
 * ════════════════════════════════════════════════════════════════════════════
 */

// FFT-STYLE 8-STEP CAMERA-RELATIVE DIRECTION TABLE
// Used by 'camera' movementMode. The camera (iso_45 / fps_toggle third-person)
// rotates in 45 deg steps, giving 8 orientations. For each orientation (indexed
// by camManager.InputOffset8, 0..7) this maps each SCREEN INTENT to the WORLD
// grid direction that best matches it on screen, so the controls rotate IN
// LOCKSTEP with the camera ("W is always toward the top of the screen").
//
//   screen-intent slot order: [ up(W key), right(D), down(S), left(A) ]
//   world cardinal index:      0=N(-Z)  1=E(+X)  2=S(+Z)  3=W(-X)
//
// Derived numerically from the engine's iso projection and verified a clean
// right-rotation every 90 deg; diamond (odd) angles inherit the adjacent
// square-on angle so the DEFAULT view (offset 1) matches the old scheme exactly.
//
// HOW TO MODIFY: with 4-direction movement + 8 camera angles you cannot have a
// distinct mapping per angle (only 4 world dirs exist), so angles pair up. To
// flip the diamond-angle convention (W leans up-LEFT vs up-RIGHT at 45 deg
// views), shift each odd row to match the NEXT even row instead of the previous.
const ISO8_DIR = [
  [0, 1, 2, 3], // off 0   (0 deg,   square-on) : W->N D->E S->S A->W
  [0, 1, 2, 3], // off 1   (45 deg,  diamond  ) : == default view (unchanged)
  [3, 0, 1, 2], // off 2   (90 deg,  square-on) : W->W D->N S->E A->S
  [3, 0, 1, 2], // off 3   (135 deg, diamond  )
  [2, 3, 0, 1], // off 4   (180 deg, square-on) : W->S D->W S->N A->E
  [2, 3, 0, 1], // off 5   (225 deg, diamond  )
  [1, 2, 3, 0], // off 6   (270 deg, square-on) : W->E D->S S->W A->N
  [1, 2, 3, 0], // off 7   (315 deg, diamond  )
];

function initEngine() {
    // ── SINGLE-INIT GUARD ──────────────────────────────────────────────
    // initEngine() is invoked from TWO places in an exported map / preview:
    //   1) this file's own auto-launch (DOMContentLoaded, bottom of file)
    //   2) the export template's `window.addEventListener('load', ...)`
    //      handler in mapster.html
    // Both fire in a real exported map. Without this guard, the engine
    // initialized TWICE — creating two scenes, two CameraManagers, two
    // players, two `anim()` loops, and two sets of keydown/wheel listeners,
    // all rendering to the same canvas and fighting each other. That was
    // the root cause of: the camera appearing frozen while the compass
    // still moved (two engines, two cameras, two compasses — input reached
    // both but they rendered different cameras), movement freezing/desyncing
    // after a gap prompt (one engine's gapPromptActive set, the other's
    // not), and erratic diagonal/face-only movement (two players with
    // different tPos). Guard against any second call.
    if (window.__midmultiEngineStarted) return;

    // Wait for both the DOM and the rendering viewport to be ready.
    // (Sometimes the iframe in Preview reports innerWidth=0 for a frame.)
    const container = document.getElementById('game-container');
    if (!container || window.innerWidth === 0) {
        requestAnimationFrame(initEngine);
        return;
    }
    // Mark started only once we're actually past the readiness gate, so a
    // premature early call (innerWidth===0) doesn't permanently block init.
    window.__midmultiEngineStarted = true;
    // ENGINE GENERATION. Every boot bumps window.__engineGen and
    // remembers its own number. The anim loop and the document-level key handlers
    // bail (and the loop stops rescheduling) the moment a NEWER engine boots or
    // unmountMapCanvas() bumps the counter. Without this, every tutorial lesson
    // left a ZOMBIE engine running: its invisible player (parked on the previous
    // exit door) kept answering WASD and re-firing window.engineOnExitReached —
    // the premature, repeated "Ready to move on?" prompts in every lesson after
    // the first.
    const __myEngineGen = (window.__engineGen = (window.__engineGen || 0) + 1);

    // ════════════════════════════════════════════════════════════════════════
    // §1  AUDIO SYNTHESIZER
    // ────────────────────────────────────────────────────────────────────────
    // playSnd(type): generates a quick SFX with the WebAudio API. NO asset
    // files needed. Called from §5 interaction code: when doors swing/slide,
    // light switches toggle, keys are picked up, or interactions error out.
    //
    // To add a NEW sound: add another `if (type === '...')` block below and
    // call `playSnd('yourname')` from wherever you want it.
    // To tweak an existing sound: change the oscillator type ('square',
    // 'triangle', 'sine', 'sawtooth') and/or the frequency ramps.
    // ════════════════════════════════════════════════════════════════════════
    let actx = null;
    function playSnd(type) {
        try {
            // Lazy-init the AudioContext — browsers require a user gesture
            // before audio can play, so we create it on first use.
            if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
            if (actx.state === 'suspended') actx.resume();

            const osc = actx.createOscillator();
            const gain = actx.createGain();
            osc.connect(gain);
            gain.connect(actx.destination);
            const now = actx.currentTime;

            // "click"  — generic button/pickup feedback (1500→1000 Hz, 50 ms)
            if (type === 'click')  { osc.type = 'square';   osc.frequency.setValueAtTime(1500, now); osc.frequency.exponentialRampToValueAtTime(1000, now + 0.05); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05); osc.start(now); osc.stop(now + 0.05); }
            // "switch" — light/sliding-door snap (800→300 Hz, 20 ms)
            if (type === 'switch') { osc.type = 'square';   osc.frequency.setValueAtTime( 800, now); osc.frequency.exponentialRampToValueAtTime( 300, now + 0.02); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.02); osc.start(now); osc.stop(now + 0.02); }
            // "slide"  — sliding door noise (100→150 Hz, 400 ms, slow rise)
            if (type === 'slide')  { osc.type = 'triangle'; osc.frequency.setValueAtTime( 100, now); osc.frequency.linearRampToValueAtTime(    150, now + 0.4 ); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(     0.01, now + 0.4 ); osc.start(now); osc.stop(now + 0.4 ); }
            // "swing"  — swinging door creak (300→50 Hz, 300 ms)
            if (type === 'swing')  { osc.type = 'sine';     osc.frequency.setValueAtTime( 300, now); osc.frequency.linearRampToValueAtTime(     50, now + 0.3 ); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(     0.01, now + 0.3 ); osc.start(now); osc.stop(now + 0.3 ); }
            // "error"  — locked door / invalid action buzz (sawtooth step-down)
            if (type === 'error')  { osc.type = 'sawtooth'; osc.frequency.setValueAtTime( 150, now); osc.frequency.setValueAtTime(            100, now + 0.1 ); gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(     0.01, now + 0.2 ); osc.start(now); osc.stop(now + 0.2 ); }
        } catch (e) { console.warn("Audio Context Failed:", e); }
    }

    // ════════════════════════════════════════════════════════════════════════
    // §2  SCENE & MANAGERS CONFIGURATION
    // ────────────────────────────────────────────────────────────────────────
    // Parse the embedded map JSON, instantiate the Three.js scene + renderer,
    // and bring up every external manager (lighting/fog/weather/sky/camera).
    // Each manager has a fallback stub so a missing module never crashes the
    // engine — see MAPSTER.docx §5.B for why this matters.
    //
    // To change the default fallback background:  edit `baseBgColor` below.
    // To change the floor thickness in the world: edit FLR_H constant.
    // To change the fallback camera frustum size: edit the OrthographicCamera
    //     bounds (currently ±10 × aspect / ±10 with near=1 / far=1000).
    // ════════════════════════════════════════════════════════════════════════

    // Pull the map blob written into the page by mapster.html's export template.
    const dataElement = document.getElementById('map-data');
    if (!dataElement) {
        console.error("CRITICAL: Map data not found. Engine aborted.");
        return;
    }
    const CONFIG = JSON.parse(dataElement.textContent);

    // Expose the in-game window-drawing gate for core/windowPainter.js.
    // OFF unless the map's settings opt in (Mapster "Allow Window Drawing").
    window.__allowWindowDraw = !!CONFIG.settings.allowWindowDraw;

    // The actual 3D grid. MAP[floor][z][x] = cell.
    // W = width  (x dimension, columns)
    // H = height (z dimension, rows)
    // FLR_H = vertical floor spacing in world units. Bump if you want taller
    //         floors — but the camera tuning and humanoid sprite sizes assume
    //         FLR_H is roughly 2.0, so other constants may need a sweep too.
    const MAP = CONFIG.map;
    const W = MAP[0][0].length, H = MAP[0].length, FLR_H = 2.0;

    const scene = new THREE.Scene();
    // size to the CONTAINER when it has explicit dimensions (embedded in
    // the game UI's map panel), otherwise to the window (standalone export).
    const getViewSize = () => {
        const cw = container.clientWidth, ch = container.clientHeight;
        if (cw > 0 && ch > 0 && (cw < window.innerWidth || ch < window.innerHeight)) return { w: cw, h: ch };
        return { w: window.innerWidth, h: window.innerHeight };
    };
    let _vs = getViewSize();
    let clientW = _vs.w, clientH = _vs.h;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    // #16: render at the browser's actual device resolution (capped at 2x so
    // HiDPI / retina screens stay crisp without tanking performance). The browser
    // decides the pixel ratio; the game adopts it.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(clientW, clientH);
    container.appendChild(renderer.domElement);

    // ── LIGHTING MANAGER ───────────────────────────────────────────────────
    // Real one lives in vfx/lightingManager.js. If absent, the engine adds a
    // single ambient + directional light and stubs out all manager methods.
    const lightingManager = typeof LightingManager !== 'undefined' ? new LightingManager(scene, renderer, CONFIG) : (() => {
        console.warn("LightingManager not found. Using fallback lighting.");
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dir = new THREE.DirectionalLight(0xffffff, 0.5); dir.position.set(10, 20, 10); scene.add(dir);
        const dummySpot = new THREE.SpotLight(0xffffff, 0);
        return { addLight: () => {}, toggleLightNetwork: () => {}, update: () => {}, getPlayerLight: () => dummySpot, toggleFlashlight: () => {}, isFlashlightOn: () => false };
    })();

    // ── GLOBAL AUDIO (BGM + AMBIENT) ───────────────────────────────────────
    // Background music and ambient bed, configured in Mapster's settings tab.
    // Both wait for a user click before playing (browser autoplay policy).
    // To change defaults: edit `bgmVol`/`ambVol` (currently 0.5 fallback).
    const listener = new THREE.AudioListener();
    if (CONFIG.settings.bgmUrl) { const bgm = new Audio(CONFIG.settings.bgmUrl); bgm.loop = true; bgm.volume = parseFloat(CONFIG.settings.bgmVol || 0.5); window.addEventListener('click', () => bgm.play().catch(e => console.log(e)), { once: true }); }
    if (CONFIG.settings.ambUrl) { const amb = new Audio(CONFIG.settings.ambUrl); amb.loop = true; amb.volume = parseFloat(CONFIG.settings.ambVol || 0.5); window.addEventListener('click', () => amb.play().catch(e => console.log(e)), { once: true }); }

    // ── ENVIRONMENT & WEATHER MANAGERS ─────────────────────────────────────
    // bgMode is set in Mapster's settings ("black" | "white" | "sky" | custom).
    // The skybox manager handles equirectangular maps; if absent we just set
    // a flat background color on the scene.
    const baseBgColor = CONFIG.settings.bgMode === 'white' ? 0xffffff : (CONFIG.settings.bgMode === 'sky' ? 0x87CEEB : 0x0a0a1a);
    const skyboxManager = typeof SkyboxManager !== 'undefined' ? new SkyboxManager(scene, renderer) : null;
    if (skyboxManager) skyboxManager.setSkybox(CONFIG.settings.bgMode);
    else scene.background = new THREE.Color(baseBgColor);

    const fogManager = typeof FogManager !== 'undefined' ? new FogManager(scene, CONFIG, baseBgColor) : { applyEnvironment: () => {}, addLocalFog: () => {}, update: () => {} };
    const weatherManager = typeof WeatherManager !== 'undefined' ? new WeatherManager(scene) : { applyEnvironment: () => {}, update: () => {}, getCurrentWeather: () => 'none' };

    // ── CAMERA SETUP ───────────────────────────────────────────────────────
    // CameraManager exposes iso / free / FPS / cinematic modes. If missing,
    // we drop to a locked ortho camera that always looks at the spawn point.
    const aspect = clientW / clientH;
    const camManager = typeof CameraManager !== 'undefined' ? new CameraManager(CONFIG.settings, aspect) : null;
    let fallbackCamera = new THREE.OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 1, 1000);

    if (camManager) {
        camManager.init(CONFIG.start.x, CONFIG.start.f * FLR_H, CONFIG.start.z);
        camManager.setListener(listener);
    } else {
        console.warn("CameraManager not found. Using fallback locked isometric camera.");
        fallbackCamera.position.set(CONFIG.start.x + 15, (CONFIG.start.f * FLR_H) + 20, CONFIG.start.z + 15);
        fallbackCamera.lookAt(CONFIG.start.x, CONFIG.start.f * FLR_H, CONFIG.start.z);
    }

    // Keep the renderer in sync with the window/container. CameraManager has its
    // own resize() that re-tunes its perspective + ortho cams.
    const doResize = () => {
        const vs = getViewSize(); let ww = vs.w, wh = vs.h; const asp = ww / wh;
        if (camManager) {
            camManager.resize(asp);
        } else {
            fallbackCamera.left = -10 * asp; fallbackCamera.right = 10 * asp;
            fallbackCamera.top = 10; fallbackCamera.bottom = -10;
            fallbackCamera.updateProjectionMatrix();
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));   // #16: DPR may change between monitors
        renderer.setSize(ww, wh);
    };
    window.addEventListener('resize', doResize);
    // the host can call this after it repositions/resizes the map panel
    // (e.g. on display-scale changes) so the embedded view re-fits.
    window.engineResize = doResize;

    // ════════════════════════════════════════════════════════════════════════
    // §3  UTILITIES & DATA STRUCTURES
    // ────────────────────────────────────────────────────────────────────────
    // Small helpers used throughout the map-build and runtime loop, plus the
    // global runtime arrays that track interactive/animated entities.
    //
    // STUB: `texCache` is currently declared but never read/written. Wiring
    // it is roadmap item §6.5 in MAPSTER.docx — see notes in `getTex()`.
    // ════════════════════════════════════════════════════════════════════════

    // Re-apply per-floor fog/weather/skybox when the player changes floors
    // or warps. Called from §4 (initial spawn), §5 (gap actions, warps), and
    // §5.4 (ladder/stairs floor traversal).
    function applyFloorFog(flr, px, pz) {
        fogManager.applyEnvironment(flr);
        weatherManager.applyEnvironment(CONFIG, flr, px, pz, MAP[flr][pz]?.[px]);
    }

    // ── #7d (option B): CROSS-FLOOR VISIBILITY — "see down, never up" ─────────
    // The engine keeps every floor's geometry in one scene, so from the lobby you
    // used to see straight up into the balcony/booth. Option B hides any floor
    // ABOVE the player and shows the player's floor + everything below — so you
    // can't see up, but you CAN see down through balcony railings / the jump-down
    // gap (wherever the upper floor simply has no tile). A future option A would
    // gate the see-down on real openings (the booth ports); this is the quick cut.
    //
    // Each static mesh is tagged once with its floor, inferred from its bounding-
    // box BASE (lowest point), which always sits within its own floor's vertical
    // band [f*FLR_H, (f+1)*FLR_H). NPCs/doors already carry .f; scene-level point
    // lights (ceiling fixtures) are tagged by height so the glow is culled too.
    let _floorsTagged = false;
    function _tagFloorOf(yBase) { return Math.max(0, Math.min(MAP.length - 1, Math.floor((yBase + 0.05) / FLR_H))); }
    function tagFloors() {
        const box = new THREE.Box3();
        wallMeshes.forEach(m => {
            try { box.setFromObject(m); m.userData.f = isFinite(box.min.y) ? _tagFloorOf(box.min.y) : _tagFloorOf(m.position.y); }
            catch (e) { m.userData.f = _tagFloorOf(m.position ? m.position.y : 0); }
        });
        // ceiling/room point lights added straight to the scene (lights parented
        // to an object group are hidden with that group automatically).
        scene.children.forEach(o => {
            if (o && o.isPointLight && o !== playerSpotlight) { o.userData._cullFloor = true; o.userData.f = _tagFloorOf(o.position.y); }
        });
        _floorsTagged = true;
    }
    function applyFloorVisibility() {
        if (!_floorsTagged) tagFloors();
        // show our floor + everything below it; hide everything above.
        wallMeshes.forEach(m => { if (m.userData.f != null) m.visible = (m.userData.f <= pFlr); });
        doorObjects.forEach(d => { if (d.grp) d.grp.visible = (d.f <= pFlr); });
        npcs.forEach(n => {
            const up = (n.f > pFlr);
            if (n.m) n.m.visible = !up;
            if (n.cone && up) n.cone.visible = false;   // never show an upper-floor cone
        });
        scene.children.forEach(o => { if (o && o.userData && o.userData._cullFloor) o.visible = (o.userData.f <= pFlr); });
    }

    // Texture builder used by all the wall/floor/object mesh creators below.
    // - `dUrl`: if provided, treat as data URL (used for painted-glass decals).
    // - Otherwise: render the named procedural function from FloorTextures or
    //   WallTextures into a 64×64 canvas and wrap it as a CanvasTexture.
    //
    // TODO (roadmap §6.5): a texture cache keyed on (type, hex, ac) here would
    // massively cut memory for tiled walls — currently every brick tile
    // generates its own canvas.
    function getTex(type, hex, ac, dUrl) {
        if (dUrl) {
            const t = new THREE.Texture(); const img = new Image();
            img.onload = () => { t.image = img; t.needsUpdate = true; };
            img.src = dUrl; t.magFilter = THREE.NearestFilter; return t;
        }
        const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d');
        ctx.fillStyle = hex || '#fff'; ctx.fillRect(0, 0, 64, 64);
        if (typeof FloorTextures !== 'undefined' && FloorTextures[type]) FloorTextures[type](ctx, hex, ac, 64);
        else if (typeof WallTextures !== 'undefined' && WallTextures[type]) WallTextures[type](ctx, hex, ac, 64);
        const tex = new THREE.CanvasTexture(c);
        tex.magFilter = THREE.NearestFilter; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    // ── RUNTIME ENTITY ARRAYS ──────────────────────────────────────────────
    // These accumulate during the §4 map-build pass and are then read every
    // frame by the §6 animation loop (or by §5 interaction handlers).
    //
    //   mirrorCams       — { cam, mesh } pairs, cube-camera mirrors updated
    //                      round-robin in §6 to spread the cost.
    //   doorObjects      — { x, z, f, dir, grp, isOpen, baseRot } per door.
    //                      Animated in §5 collision/interaction handlers.
    //   interactables    — anything Space-bar can trigger (keys, signs,
    //                      switches, benches, registers, NPC counters).
    //   npcs             — { m, meta, x, z, f } NPC instances. Ticked in
    //                      §6 "AI Update" — random wander.
    //   wallMeshes       — every solid box used for x-ray transparency
    //                      raycast in §6 (walls between camera and player
    //                      go translucent so player is visible).
    //   localAudios      — { audio, meta, mesh } PositionalAudio attached
    //                      to specific objects. `audioStopInteract` flag
    //                      stops them when the host object is interacted
    //                      with (§5.4).
    //   grassMeshes      — instanced grass blade clumps; per-blade rotation
    //                      animated by weather wind in §6.
    //   paintableWindows — windows whose meta has a paintData URL OR canvas
    //                      width >0. Triggered by §5.4 spacebar handler.
    const mirrorCams = [], doorObjects = [], interactables = [], npcs = [], wallMeshes = [], localAudios = [], grassMeshes = [], paintableWindows = [], sparkleObjects = [];
    let keyFetchCar = null, keyFetchKeyId = null, keyFetchPrompted = false;   // #7: parked-car KEY reminder (set during the scan below)
    // #4: doors animate FRAME-DRIVEN (processed in the anim loop), not via
    // setInterval/setTimeout. The old timer-based swing got STARVED when a held
    // movement key flooded the keydown handler (native key-repeat + our own
    // per-frame auto-repeat), so the door appeared to "halt until you let go".
    // A rAF-driven tween runs at the same priority as everything else, so the
    // swing always completes whether or not a key is held.
    const doorAnims = [];
    const uplightObjects = [], arrowObjects = [], exitWaypoints = [];
    const warpPoints = [];   // named fast-travel destinations

    // Quick humanoid builder — used for the player AND for NPCs. The "nose"
    // box at the front face doubles as a facing indicator so iso players can
    // tell which way the character is pointing.
    //
    // To swap in a sprite-based or model-loaded character, replace this
    // function — the rest of the engine only relies on it returning a
    // THREE.Group whose .position and .rotation.y can be set/lerped.
    // now includes legs + feet (and arms) with references stored on
    // g.userData.limbs so the animation loop can swing them while walking.
    // g.userData.setSeated(on) folds the legs into a non-clipping seated
    // pose (thighs forward + shins down) and drops the torso to sit height.
    // build a "neon"-looking emissive material + an additive glow halo so a
    // neon mesh reads as a glowing tube in its chosen color (self-lit, bright,
    // with a soft bloom-ish aura) regardless of scene lighting. Returns the
    // core material; call addNeonHalo(mesh, color) to attach the aura.
    function neonMaterial(color) {
        // MeshBasicMaterial is unlit → always shows full color (a real neon tube
        // doesn't get darker in shadow). Slightly toward white at the core for a
        // "hot tube" look would need a gradient; basic full-color reads well.
        return new THREE.MeshBasicMaterial({ color: color });
    }
    function addNeonHalo(target, color, scale) {
        // A soft additive sprite behind the tube fakes the glow/bloom. Cheap and
        // reliable in r128. Sprite always faces the camera.
        const cv = document.createElement('canvas'); cv.width = cv.height = 64;
        const c = cv.getContext('2d');
        const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
        g.addColorStop(0, color); g.addColorStop(0.4, color); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.globalAlpha = 0.9; c.beginPath(); c.arc(32, 32, 30, 0, Math.PI * 2); c.fill();
        const tex = new THREE.CanvasTexture(cv);
        const mat = new THREE.SpriteMaterial({ map: tex, color: color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const sp = new THREE.Sprite(mat); sp.scale.set(scale || 1.2, scale || 1.2, 1);
        target.add(sp);
        return sp;
    }
    // Register a neon light/mesh to flicker subtly (neon "buzz"): tiny intensity
    // wobble + occasional dropout. Pushed to neonFlickers, ticked in §6.
    const neonFlickers = [];

    // `outfit` (optional, #10): a resolved clothing description, normally built
    // from a character's worn items via outfitFromWorn(). Shape:
    //   { shirt:{color,style}, jacket:{color,style}|null, pants:{color,style},
    //     belt:{color}|null, footwear:{color,style}, headwear:{color,style}|null,
    //     eyewear:{color,style}|null, skin }
    // Missing pieces fall back to sensible defaults; `cloth` is the legacy
    // single shirt color used when no outfit is supplied.
    function createHumanoid(skin, cloth, shadow = true, outfit = null) {
        const g = new THREE.Group();
        const O = outfit || {};
        const shirtCol = (O.shirt && O.shirt.color) || cloth || '#3a6ea5';
        const shirtStyle = (O.shirt && O.shirt.style) || 'short';
        const pantsCol = (O.pants && O.pants.color) || '#2b2f3a';
        const pantsStyle = (O.pants && O.pants.style) || 'pants';
        const footCol = (O.footwear && O.footwear.color) || '#111111';
        const jacket = O.jacket || null;
        // Belt defaults ON (a subtle dark band) unless the outfit explicitly sets
        // belt:null/false. The pelvis above means there's no floating gap either way.
        const belt = (O.belt !== undefined) ? O.belt : { color: '#2a2018' };

        const mSkin  = new THREE.MeshLambertMaterial({ color: skin });
        const mShirt = new THREE.MeshLambertMaterial({ color: shirtCol });
        const mPants = new THREE.MeshLambertMaterial({ color: pantsCol });
        const mFoot  = new THREE.MeshLambertMaterial({ color: footCol });

        const HIP_Y = 0.5;
        // Torso = shirt. A jacket adds a slightly larger shell over it.
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.25), mShirt);
        torso.position.y = HIP_Y + 0.35; torso.castShadow = shadow; g.add(torso);
        if (jacket) {
            const mJacket = new THREE.MeshLambertMaterial({ color: jacket.color || '#333' });
            // Vests are sleeveless and a touch shorter; jackets cover more.
            const jh = (jacket.style === 'vest') ? 0.42 : 0.5;
            const jShell = new THREE.Mesh(new THREE.BoxGeometry(0.44, jh, 0.29), mJacket);
            jShell.position.y = HIP_Y + 0.36; jShell.castShadow = shadow; g.add(jShell);
            g.userData._jacketStyle = jacket.style || 'jacket';
            g.userData._jacketColor = jacket.color || '#333';
        }
        // Bowtie [#14] — a small dark box at the collar, part of the concession
        // UNIFORM (white shirt + burgundy vest + black bowtie, like the title
        // crew). Set via outfit.bowtie = { color }.
        if (O.bowtie) {
            const bt = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.07), new THREE.MeshLambertMaterial({ color: O.bowtie.color || '#08080c' }));
            bt.position.set(0, HIP_Y + 0.6, -0.13); bt.castShadow = shadow; g.add(bt);
        }
        // Head + nose (facing marker) — the head, nose, headwear and
        // eyewear now live in ONE headGrp so poses can move the whole head as a
        // unit. (They used to be pinned to the body group, so when the crouch
        // dropped the torso the head — and any hat/shades — stayed floating at
        // standing height.) Local offsets reproduce the old world positions.
        const headGrp = new THREE.Group();
        headGrp.position.y = HIP_Y + 0.78;
        g.add(headGrp);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), mSkin);
        head.castShadow = shadow; headGrp.add(head);
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshLambertMaterial({ color: 0xff0000 }));
        nose.position.set(0, 0, -0.15); headGrp.add(nose);
        // Headwear (cap/beanie/bandana) — a simple colored band/dome on the head.
        if (O.headwear) {
            const hc = O.headwear.color || '#222';
            const hw = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.10, 0.27), new THREE.MeshLambertMaterial({ color: hc }));
            hw.position.y = 0.15; hw.castShadow = shadow; headGrp.add(hw);
            if (O.headwear.style === 'cap') { const brim = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.04, 0.14), new THREE.MeshLambertMaterial({ color: hc })); brim.position.set(0, 0.13, -0.18); headGrp.add(brim); }
        }
        // Eyewear (shades/glasses) — a thin bar across the face.
        if (O.eyewear) {
            const ec = O.eyewear.color || '#111';
            const ew = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.04), new THREE.MeshLambertMaterial({ color: ec }));
            ew.position.set(0, 0.02, -0.14); headGrp.add(ew);
        }

        // Leg length depends on bottoms: shorts/skirt expose more skin (shin).
        const shortLegs = (pantsStyle === 'shorts' || pantsStyle === 'swim' || pantsStyle === 'skirt' || pantsStyle === 'underwear');
        const makeLeg = (sideX) => {
            const hip = new THREE.Group();
            hip.position.set(sideX, HIP_Y, 0);
            // Thigh: pants color (or skin if very short). Skirt → both thighs
            // share a wider panel look but we keep per-leg for animation.
            const thighMat = shortLegs ? (pantsStyle === 'underwear' ? mSkin : mPants) : mPants;
            const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.16), thighMat);
            thigh.position.y = -0.13; thigh.castShadow = shadow; hip.add(thigh);
            const knee = new THREE.Group(); knee.position.y = -0.26; hip.add(knee);
            // Shin: covered by pants (pants color) unless shorts/skirt (skin).
            const shinMat = shortLegs ? mSkin : mPants;
            const shin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.14), shinMat);
            shin.position.y = -0.12; shin.castShadow = shadow; knee.add(shin);
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.24), mFoot);
            foot.position.set(0, -0.24 - 0.02, -0.04); foot.castShadow = shadow; knee.add(foot);
            return { hip, knee };
        };
        const legL = makeLeg(-0.11);
        const legR = makeLeg(0.11);
        g.add(legL.hip); g.add(legR.hip);

        // Hips / waistband — a pants-coloured block that fills the gap between the
        // shirt (torso bottom ≈ HIP_Y+0.075) and the thigh tops (HIP_Y), so the
        // torso never floats. Present with OR without a belt; without a belt the
        // shirt simply meets the pants here like a tucked-in shirt would in real life.
        const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.25), mPants);
        pelvis.position.y = HIP_Y + 0.07;        // ≈0.57, spanning ≈0.49..0.65 — bridges legs↔torso
        pelvis.castShadow = shadow; g.add(pelvis);

        // Belt: a thin band at the waist.
        if (belt) {
            const beltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.27), new THREE.MeshLambertMaterial({ color: belt.color || '#3a2a1a' }));
            beltMesh.position.y = HIP_Y + 0.07; beltMesh.castShadow = shadow; g.add(beltMesh);
        }

        // Arms: short-sleeve/tank/bra expose the forearm (skin); long-sleeve and
        // jackets cover it (shirt or jacket color).
        const sleeveCovered = (shirtStyle === 'long' || shirtStyle === 'collared') || !!jacket;
        const armColor = jacket ? (jacket.color || shirtCol) : shirtCol;
        const armMat = sleeveCovered ? new THREE.MeshLambertMaterial({ color: armColor }) : mSkin;
        const tankMat = (shirtStyle === 'tank' || shirtStyle === 'bra' || shirtStyle === 'none') ? mSkin : armMat;
        const makeArm = (sideX) => {
            const sh = new THREE.Group(); sh.position.set(sideX, HIP_Y + 0.6, 0);
            // Upper arm: shoulder covered by shirt for tanks (a small cap), skin below.
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.12), tankMat);
            arm.position.y = -0.2; arm.castShadow = shadow; sh.add(arm);
            return sh;
        };
        const armL = makeArm(-0.26), armR = makeArm(0.26);
        g.add(armL); g.add(armR);

        g.userData.limbs = { legL, legR, armL, armR, torso, headGrp, hipY: HIP_Y };   // headGrp added so poses can move the head
        g.userData.seated = false;
        g.userData.walkPhase = 0;

        g.userData.setSeated = function (on) {
            const L = g.userData.limbs; g.userData.seated = !!on;
            if (on) {
                // #5 (FIX): sit FORWARD-facing. The thighs rotate to point forward
                // (-Z, the character's facing) and the shins drop straight down, so
                // the figure sits like a person on a seat — not backwards. (The old
                // pose used -PI/2 at the hip, which pointed the thighs BACKWARD into
                // the bench, reading as sitting backwards + clipping the seat.)
                legL.hip.rotation.x = legR.hip.rotation.x = Math.PI / 2;    // thighs forward (-Z)
                legL.knee.rotation.x = legR.knee.rotation.x = -Math.PI / 2; // shins straight down
                // arms hang at the SIDES, not jutting forward. The old
                // −0.25 x-rotation swung both arms out over the lap (they read as
                // "reaching"); a person sitting rests their hands by their hips. We
                // drop them to near-vertical with a tiny forward settle and splay
                // them out a hair so they clear the hips. (Arms are single shoulder
                // groups — rotation.x swings fwd/back, rotation.z splays out.)
                armL.rotation.set(0.08, 0, 0.12);   // left arm down, slight outward splay
                armR.rotation.set(0.08, 0, -0.12);  // right arm mirror
                L.torso.position.y = L.hipY + 0.30;
            } else {
                legL.hip.rotation.x = legR.hip.rotation.x = 0;
                legL.knee.rotation.x = legR.knee.rotation.x = 0;
                armL.rotation.set(0, 0, 0); armR.rotation.set(0, 0, 0);   // clear the seated splay
                L.torso.position.y = L.hipY + 0.35;
            }
        };
        // a real CROUCH pose — bend the knees and sink the whole group toward
        // the floor (rather than squashing the mesh vertically). Hips rotate
        // forward a little, knees fold, torso dips, arms tuck. We lower the GROUP
        // via a stored crouchDrop so the feet stay on the ground.
        g.userData.setCrouched = function (on) {
            const L = g.userData.limbs; g.userData.crouched = !!on;
            if (on) {
                // #8 (FIX v4): a natural KNEES-FORWARD crouch. The body lowers
                // through a real squat — thighs angle FORWARD-down (knees come
                // forward) and the shins fold BACK so the feet stay planted under
                // the body, with only a slight torso lean for balance. (v2 left the
                // legs near-straight + bowed the torso; this folds the legs so the
                // silhouette actually drops.) The matching crouch-drop (0.14) sinks
                // the group by the amount the knee-fold raises the feet, keeping them
                // on the floor. Tuning: deepen with bigger hip(+)/knee(-) magnitudes
                // (raise crouch-drop to match); lean with torso.rotation.x.
                // the SELF-CLIPPING is fixed. Two things were wrong:
                //   (1) the old torso rotation (+0.85) actually leaned the torso
                //       TOP BACKWARD — positive rotation.x tips +Y toward +Z, and
                //       the character faces -Z (the nose) — which drove the torso
                //       BOTTOM forward THROUGH the raised thighs;
                //   (2) the head (and any hat/shades) never moved, so it floated
                //       at standing height above the sunken torso.
                // Now: legs keep the good knees-forward fold; the torso hunches
                // genuinely FORWARD (negative rotation.x — top toward the nose) from
                // a higher seat so its underside clears the thighs (only the natural
                // lap-crease contact remains); and the whole headGrp drops/tucks
                // forward over the knees with a slight downward gaze.
                // TUNING: deepen the hunch with torso.rotation.x (more negative) +
                // lower headGrp y to match; deepen the squat with hip(+)/knee(−)
                // and raise __crouchDrop (set in engineSetCrouch) to keep the feet
                // planted.
                // the remaining clip was the torso BOTTOM still
                // overlapping the thigh tops — the torso sat at hipY+0.24 (its
                // 0.55-tall box reaches down to ~hipY-0.03) while the thighs fold
                // up in front of it. Three changes remove it: the thighs fold a
                // touch LESS far forward (0.7) so they don't rise into the belly;
                // the torso seat is RAISED (hipY+0.40) and SHIFTED FORWARD (+z is
                // back, so −0.06 nudges its base out over the lap gap, not into the
                // thighs); the hunch eases to −0.32 so the chest still leans over
                // the knees without driving the lower front edge back into them.
                // The head follows the higher torso. TUNING: torso.position.y sets
                // clearance (raise if any clip remains); .z shifts the seat fwd/back.
                legL.hip.rotation.x = legR.hip.rotation.x = 0.7;    // thighs forward-down (slightly less, clears belly)
                legL.knee.rotation.x = legR.knee.rotation.x = -1.5; // shins fold back, feet under body
                armL.rotation.x = armR.rotation.x = -0.5;           // arms reach forward/down for balance
                // #3 (crouch "beard" — recurring): the stray dark polygon under the
                // chin is the hunched TORSO TOP poking up in front of the head. The
                // old values left almost no margin (head underside ≈ +0.675 vs torso
                // top ≈ +0.661 — ~0.014) AND a hard −0.32 hunch drove the torso top
                // FORWARD under the chin, so any drift re-exposed it. Fix gives a real
                // gap: ease the hunch to −0.20 (top doesn't lunge forward), seat the
                // torso a touch lower, and RAISE the head so its underside sits a clear
                // ~0.12 above the torso top. TUNING: if the beard ever returns, raise
                // L.headGrp.y first (widen the gap), then ease torso.rotation.x toward 0.
                L.torso.position.set(0, L.hipY + 0.35, 0.02);       // #3: seat lower + nudge the base BACK (+z) so the torso TOP no longer pokes forward under the chin
                L.torso.rotation.x = -0.06;                         // #3: gentler hunch — top stays well UNDER the head (was -0.12; that forward lean was the "beard")
                L.headGrp.position.set(0, L.hipY + 0.92, -0.04);    // #3: RAISE the head ~0.07 so its underside clears the torso top by a real ~0.12 (was +0.85 → only ~0.03 gap)
                L.headGrp.rotation.x = -0.10;                       // slight downward gaze
            } else if (!g.userData.seated) {
                legL.hip.rotation.x = legR.hip.rotation.x = 0;
                legL.knee.rotation.x = legR.knee.rotation.x = 0;
                armL.rotation.x = armR.rotation.x = 0;
                L.torso.position.set(0, L.hipY + 0.35, 0);          // restore z (crouch nudges it)
                L.torso.rotation.x = 0;
                L.headGrp.position.set(0, L.hipY + 0.78, 0);        // head back to standing
                L.headGrp.rotation.x = 0;
            }
        };
        return g;
    }

    // ── STEALTH: VISION CONE MESH ──────────────────────────────────────────
    // A flat, translucent fan laid on the floor pointing along the NPC's forward
    // (local -Z, where the nose marker sits). fullAngleDeg is the cone's total
    // spread; rangeTiles its reach. Parent it to the NPC so it sweeps with facing.
    // The mesh is tagged so the per-tick detector can recolor it when it catches
    // the player (yellow = watching, red = spotted).
    // a GLINT, not spinning stars. The old effect was 5 small
    // planes orbiting the object — it read as "spinning stars", not shine. Now
    // it's a single 4-point star-streak sprite (drawn once to a canvas texture:
    // bright core + horizontal/vertical streaks) that stays INVISIBLE most of
    // the time and occasionally fires a quick bright pulse — scale up + fade
    // through, like light catching a key. Timing/curve live in the anim loop
    // (search sparkleObjects). HOW TO MODIFY: pulse length = GLINT_DUR; gap
    // between pulses = GLINT_GAP_MIN/RAND there; size = the PlaneGeometry +
    // the 1.4 scale factor; streak shape = the canvas drawing below.
    function makeGlintTexture(colorHex) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 64;
        const ctx = cv.getContext('2d');
        const cx = 32, cy = 32;
        // bright core
        let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, colorHex); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
        // 4-point streaks (long h/v, short diagonals)
        const streak = (ang, len, wHalf) => {
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
            const lg = ctx.createLinearGradient(-len, 0, len, 0);
            lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, '#ffffff'); lg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = lg; ctx.fillRect(-len, -wHalf, len * 2, wHalf * 2); ctx.restore();
        };
        streak(0, 30, 1.6); streak(Math.PI / 2, 30, 1.6);
        streak(Math.PI / 4, 14, 1.1); streak(-Math.PI / 4, 14, 1.1);
        const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true;
        return tex;
    }
    function makeSparkle(colorHex) {
        const grp = new THREE.Group();
        const m = new THREE.Mesh(
            new THREE.PlaneGeometry(0.42, 0.42),
            new THREE.MeshBasicMaterial({ map: makeGlintTexture(colorHex || '#fff6a8'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        );
        grp.add(m);
        grp.userData.isSparkle = true;
        grp.userData.glint = { next: 0.4 + Math.random() * 1.2, p: -1 };   // p<0 = waiting
        return grp;
    }

    function makeVisionCone(fullAngleDeg, rangeTiles) {
        const half = (fullAngleDeg * Math.PI / 180) / 2;
        const r = rangeTiles;
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        const SEG = 24;
        // Build the fan in the XY plane with the apex at the origin; the arc's
        // CENTER points to shape +Y. Laying it flat with rotateX(-90°) sends
        // shape +Y → world -Z, which is the NPC's forward (the nose marker sits
        // at local -Z, and detection uses -Z). (rotateX(+90°) sent it to +Z,
        // which reversed the cone — that was the bug.)
        for (let i = 0; i <= SEG; i++) {
            const a = -half + (i / SEG) * (half * 2);
            shape.lineTo(Math.sin(a) * r, Math.cos(a) * r);
        }
        shape.lineTo(0, 0);
        const geo = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;     // lay flat; shape +Y → world -Z (forward)
        mesh.position.y = 0.06;             // hover just above the floor
        mesh.renderOrder = 2;
        mesh.userData.isVisionCone = true;
        mesh.userData.baseColor = 0xffe066;
        return mesh;
    }


    function outfitFromWorn(worn, skin) {
        if (!worn || typeof window === 'undefined' || !window.GameItems) return null;
        const MI = window.GameItems;
        const pick = (slot) => {
            const w = worn[slot]; if (!w) return null;
            const it = MI.byId[w.id]; if (!it) return null;
            return { color: w.color || it.color || null, style: it.style || null, id: it.id };
        };
        return {
            skin: skin,
            shirt:    pick('shirt') || { color: '#3a6ea5', style: 'short' },
            jacket:   pick('jacket'),
            pants:    pick('pants') || { color: '#2b2f3a', style: 'pants' },
            belt:     pick('belt'),
            footwear: pick('footwear') || { color: '#111', style: 'sneakers' },
            headwear: pick('headwear'),
            eyewear:  pick('eyewear')
        };
    }

    // ════════════════════════════════════════════════════════════════════════
    // §4  MAP GENERATION LOOP
    // ────────────────────────────────────────────────────────────────────────
    // Iterate every cell of every floor and build the matching Three.js mesh.
    // Subsections mirror the cell schema (f, o, c, n/s/e/w/d1/d2).
    //
    // This runs ONCE on engine boot. Roadmap item §6.4 (chunked streaming)
    // would change this to lazy-instantiate by camera proximity.
    // ════════════════════════════════════════════════════════════════════════
    MAP.forEach((flrD, flr) => {
        const fY = flr * FLR_H;
        flrD.forEach((row, z) => {
            row.forEach((cell, x) => {

                // ── §4.1  FLOORS ────────────────────────────────────────────
                // Plane geometry on the floor's Y level. If a FloorTextures
                // generator matches the variant name, it paints the canvas;
                // otherwise a flat color is used. Special-case: 'grass'
                // adds an InstancedMesh of grass blades for wind animation.
                if (cell.f) {
                    let mapTex = null;
                    // For the unified "Arcade Carpet" brush, the meta.arcadeStyle
                    // (cosmic | zigzag | galaxy) selects which generator to use.
                    let texKey = cell.f.v;
                    if (cell.f.v === 'carpet') {
                        const style = cell.f.meta?.arcadeStyle || 'cosmic';
                        texKey = (style === 'zigzag') ? 'arcade_zigzag' : (style === 'galaxy') ? 'arcade_galaxy' : 'carpet';
                    }
                    if (typeof FloorTextures !== 'undefined' && FloorTextures[texKey]) {
                        const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d');
                        FloorTextures[texKey](ctx, cell.f.c, cell.f.ac, 64);
                        const tex = new THREE.CanvasTexture(c);
                        tex.magFilter = THREE.NearestFilter; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                        // Arcade carpet: rotate the (now seamless) texture by a
                        // per-tile 90° step so identical neighbours don't line up
                        // into an obvious grid. Rotate about center to stay in UV.
                        if (cell.f.v === 'carpet') { tex.center.set(0.5, 0.5); tex.rotation = ((x * 7 + z * 13) % 4) * (Math.PI / 2); }
                        mapTex = tex;
                    } else {
                        const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d');
                        ctx.fillStyle = cell.f.c || '#fff'; ctx.fillRect(0, 0, 64, 64); mapTex = new THREE.CanvasTexture(c);
                    }

                    // #17a: a FLOOR HOLE — render NO floor so you can see DOWN the
                    // stairwell to the flight + floor below (the top step of the
                    // flight sits at this floor's height and fills the opening). The
                    // tile stays walkable in game logic; set via floor meta.floorHole.
                    if (!(cell.f.meta && cell.f.meta.floorHole)) {
                    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ map: mapTex }));
                    m.rotation.x = -Math.PI / 2; m.position.set(x, fY, z); m.receiveShadow = true; m.userData = { f: flr };
                    // #7 option A: a SEE-THROUGH floor tile (glass port) — you look
                    // DOWN through it onto whatever is rendered on the floor below
                    // (the #7d cull keeps lower floors visible). Walkable like any
                    // floor. Set via floor meta.seeThrough (+ optional meta.opacity).
                    if (cell.f.meta && cell.f.meta.seeThrough) {
                        m.material.transparent = true;
                        m.material.opacity = (typeof cell.f.meta.opacity === 'number') ? cell.f.meta.opacity : 0.30;
                        m.material.depthWrite = false;   // let the floor below show through
                        m.renderOrder = 3;               // blend after the opaque floor beneath
                        m.userData.seeThrough = true;
                    }
                    scene.add(m); wallMeshes.push(m);
                    }

                    // Grass tiles: add a flock of cone "blades" via InstancedMesh.
                    // Density defaults to 200 blades per tile, height to 0.5 world units.
                    // Change in Mapster's floor properties panel (grassDensity, grassHeight)
                    // or default them here if you want.
                    if (cell.f.v === 'grass') {
                        const gMat = new THREE.MeshLambertMaterial({ color: cell.f.c });
                        const gHeight = cell.f.meta?.grassHeight || 0.5;
                        const gDensity = cell.f.meta?.grassDensity || 200;
                        const gGeo = new THREE.ConeGeometry(0.02, gHeight, 3);
                        const iMesh = new THREE.InstancedMesh(gGeo, gMat, gDensity);
                        // weatherReact (new) OR windReact (legacy maps) enables
                        // wind+snow animation. A tile is "indoors" if it has a
                        // ceiling (cell.c) on this floor OR a floor above it —
                        // indoor grass never reacts to weather.
                        const ceilingAbove = !!cell.c || !!(MAP[flr + 1] && MAP[flr + 1][z] && MAP[flr + 1][z][x] && MAP[flr + 1][z][x].f);
                        const wantsWeather = (cell.f.meta?.weatherReact !== undefined) ? cell.f.meta.weatherReact : (cell.f.meta?.windReact !== false);
                        iMesh.userData = {
                            wind: wantsWeather && !ceilingAbove,
                            indoor: ceilingAbove,
                            gHeight: gHeight,
                            baseSwayPhase: Math.random() * Math.PI * 2,
                        };
                        const dummy = new THREE.Object3D();
                        for (let i = 0; i < gDensity; i++) {
                            dummy.position.set((Math.random() - 0.5), gHeight / 2, (Math.random() - 0.5));
                            dummy.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.2);
                            dummy.updateMatrix(); iMesh.setMatrixAt(i, dummy.matrix);
                        }
                        iMesh.position.set(x, fY, z); scene.add(iMesh); grassMeshes.push(iMesh);
                    }
                }

                // ── §4.2  OBJECTS (center-tile entities) ────────────────────
                // The big variant switch. Each `cell.o.v` value lights up a
                // different code path. 'start' is skipped here — it's the
                // player spawn marker, read only from CONFIG.start, never
                // rendered. (See MAPSTER.docx §5.C — do NOT delete starts
                // from the data at compile time.)
                //
                // Variants currently handled:
                //   start         — spawn marker (NOT rendered, handled in §5)
                //   npc           — wandering humanoid w/ dialogue + vision cone
                //   sign          — humanoid mesh used as a static placeholder
                //   dir           — directory/kiosk box (opens minimap UI)
                //   uplight       — floor-mounted spotlight emitter
                //   solid_diag1/2 — angled wall slabs across the tile diagonal
                //   arcade        — cabinet box (no chair)
                //   arcade_sit    — cabinet box + sit stool (sittable)
                //   trash         — cylindrical trash bin
                //   bench         — sittable bench (slat + 2 legs)
                //   key           — golden key, picked up into inventory
                //   ladder        — vertical climbable; bumps floor in §5.4
                //   warp_pad      — invisible warp trigger (no geometry)
                //   (default)     — small generic decor box
                if (cell.o && cell.o.v !== 'start') {
                    // rot meta: 0,1,2,3 → 0°, 90°, 180°, 270° (negative because
                    // Three.js Y rotation is counter-clockwise from above).
                    const rY = (cell.o.meta?.rot || 0) * -(Math.PI / 2);
                    const cS = cell.o.meta?.castShadow !== false; // default true
                    // exit waypoint — stepping onto this tile advances (host hook).
                    if (cell.o.meta && cell.o.meta.exitWaypoint) exitWaypoints.push({ x: x, z: z, f: flr, meta: cell.o.meta });

                    if (cell.o.v === 'npc' || cell.o.v === 'sign') {
                        // NPC and sign share the same humanoid mesh; the only
                        // difference is npcs get added to the AI tick array.
                        // #10/#11: build the NPC's outfit from its worn equipment
                        // (meta.worn). If absent (older maps / signs), the legacy
                        // cloth color is used as a plain shirt.
                        const npcSkin = cell.o.meta.skin || '#ffccaa';
                        // #14: a cinema EMPLOYEE (meta.uniform) wears the concession
                        // uniform — white shirt, burgundy vest, black bowtie, dark
                        // trousers — matching the title-screen crew, so staff read
                        // as staff vs ordinary patrons. Otherwise build from worn gear.
                        const npcOutfit = cell.o.meta.uniform ? {
                            shirt:    { color: '#f4f4f0', style: 'short' },
                            jacket:   { style: 'vest', color: '#7a1f3a' },
                            bowtie:   { color: '#08080c' },
                            pants:    { color: '#1a1a22' },
                            footwear: { color: '#111111' },
                        } : ((cell.o.meta.worn && typeof outfitFromWorn === 'function') ? outfitFromWorn(cell.o.meta.worn, npcSkin) : null);
                        const n = createHumanoid(npcSkin, cell.o.meta.cloth || cell.o.c, cS, npcOutfit);
                        n.position.set(x, fY, z); n.rotation.y = rY; scene.add(n);
                        if (cell.o.v === 'npc') {
                            const npcRec = { m: n, meta: cell.o.meta, x: x, z: z, f: flr };
                            // ── STEALTH: a VISION CONE the player must avoid. An NPC opts
                            // in with meta.visionCone (full angle in degrees) and
                            // meta.visionRange (tiles). We build a flat translucent fan
                            // on the floor, parented to the NPC so it sweeps with facing.
                            // makeVisionCone() also stores geometry params for the
                            // per-tick detection test below.
                            // #4 (FIX): only NPCs explicitly flagged as stealth
                            // GUARDS get a vision cone + detection. Previously every
                            // NPC carried default vision values (Mapster seeds
                            // visionRange/visionCone), so ordinary NPCs all triggered
                            // the "Spotted!" response. Now detection is opt-in via
                            // meta.guardVision; plain NPCs are never guards.
                            if (cell.o.meta.guardVision && cell.o.meta.visionCone && cell.o.meta.visionRange) {
                                const coneMesh = makeVisionCone(cell.o.meta.visionCone, cell.o.meta.visionRange);
                                // the cone VISUAL is off by default — only shown
                                // when the map opts in (Mapster: settings.showVisionCones).
                                // Detection still runs either way; the visual is mainly a
                                // tutorial/teaching aid.
                                coneMesh.visible = !!CONFIG.settings.showVisionCones;
                                n.add(coneMesh);
                                npcRec.cone = coneMesh;
                                npcRec.visionHalfRad = (cell.o.meta.visionCone * Math.PI / 180) / 2;
                                npcRec.visionRange = cell.o.meta.visionRange;
                            }
                            npcs.push(npcRec);
                        }
                        else interactables.push({ x: x, z: z, f: flr, obj: cell.o, mesh: n });
                    }
                    else if (cell.o.v === 'dir') {
                        // Directory kiosk — a tall box. When interacted with,
                        // the §5 spacebar handler opens the minimap modal.
                        const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.2), new THREE.MeshLambertMaterial({ color: cell.o.c }));
                        b.castShadow = cS; b.receiveShadow = true; b.position.set(x, fY + 0.75, z); b.rotation.y = rY;
                        scene.add(b); wallMeshes.push(b); interactables.push({ x: x, z: z, f: flr, obj: cell.o, mesh: b });
                    }
                    else if (cell.o.v === 'uplight') {
                        // Tiny lamp puck on the floor that emits via lightingManager.
                        // The light itself isn't a mesh — it's parented to the group.
                        const g = new THREE.Group();
                        const upL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8), new THREE.MeshLambertMaterial({ color: '#333' }));
                        upL.position.y = 0.1; upL.castShadow = cS; g.add(upL);
                        const upLight = lightingManager.addLight(g, cell.o.meta.lightColor, cell.o.meta.intensity, 10, cell.o.meta, new THREE.Vector3(0, 0.3, 0));
                        g.position.set(x, fY, z); scene.add(g); interactables.push({ x: x, z: z, f: flr, obj: cell.o, mesh: g });
                        // #uplight-block: remember this uplight so standing on its
                        // tile can partially block (dim) it in the anim loop.
                        if (upLight) uplightObjects.push({ light: upLight, x: x, z: z, f: flr, base: (cell.o.meta.intensity != null ? cell.o.meta.intensity : 1) });
                    }
                    else if (cell.o.v === 'exit_sign') {
                        // #1 (FIX): a compact, real-looking 1990s EXIT sign — bold RED
                        // block letters on a lit cream/white face in a thin boxy housing,
                        // hung ABOVE a doorway, with a soft red glow. Smaller than the
                        // previous oversized panel. meta.exitWaypoint still works, but the
                        // tutorial now puts the move-on waypoint in a vestibule on the FAR
                        // side of the door so passing THROUGH (not standing under) advances.
                        const g = new THREE.Group();
                        const col = cell.o.c || '#d11f1f';   // classic exit-red
                        // meta.signText lets the same sign say something else (e.g. a
                        // decorative "ENTRANCE"); longer words get a wider sign.
                        const _sTxt = String((cell.o.meta && cell.o.meta.signText) || 'EXIT').toUpperCase();
                        const _wide = _sTxt.length > 5, CW = _wide ? 320 : 192;
                        const cv = document.createElement('canvas'); cv.width = CW; cv.height = 88;
                        const ct = cv.getContext('2d');
                        ct.fillStyle = '#f6f1e4'; ct.fillRect(0, 0, CW, 88);            // lit face
                        ct.strokeStyle = col; ct.lineWidth = 6; ct.strokeRect(3, 3, CW - 6, 82); // red border
                        let _fs = 52; ct.font = 'bold ' + _fs + 'px Arial,Helvetica,sans-serif'; ct.textAlign = 'center'; ct.textBaseline = 'middle';
                        while (ct.measureText(_sTxt).width > CW - 22 && _fs > 18) { _fs -= 2; ct.font = 'bold ' + _fs + 'px Arial,Helvetica,sans-serif'; }
                        ct.fillStyle = col; ct.shadowColor = col; ct.shadowBlur = 6;
                        ct.fillText(_sTxt, CW / 2, 48);
                        const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.LinearFilter;
                        const housing = new THREE.MeshBasicMaterial({ color: '#2a2a2a' });
                        const faceMat = new THREE.MeshBasicMaterial({ map: tex });
                        const SW = _wide ? 0.62 * CW / 192 : 0.62, SH = 0.28, SD = 0.07;
                        const panel = new THREE.Mesh(new THREE.BoxGeometry(SW, SH, SD),
                            [housing, housing, housing, housing, faceMat, housing]);   // face on +Z
                        g.add(panel);
                        const halo = new THREE.Mesh(new THREE.PlaneGeometry(SW * 1.5, SH * 1.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
                        halo.position.z = SD / 2 + 0.01; g.add(halo);
                        try { lightingManager.addLight(g, col, 0.4, 2.5, {}, new THREE.Vector3(0, 0, 0.2)); } catch (e) {}
                        const mountDir = (cell.o.meta && cell.o.meta.mountDir) || ['n', 'e', 's', 'w'][(cell.o.meta && cell.o.meta.rot) || 0];
                        // the door-header LINTEL (added with the
                        // shorter doors) sits on the wall plane at this same height,
                        // so a sign mounted flush in the wall was BURIED inside the
                        // lintel — that's why no exit signs were visible. Hang the
                        // sign so it PROTRUDES ~0.2 into the ROOM, in front of the
                        // lintel, like a real exit sign over a doorway. It's above
                        // the door opening, so it shows whether the door is open or
                        // shut. (The lintel is x-ray-aware too, so even a glance
                        // through the wall reveals it.)
                        // sit the sign ON the door's top frame, just
                        // proud of the header LINTEL — NOT floating into the room.
                        // The lintel spans the wall plane (face ~0.42 from the tile
                        // center); placing the sign at 0.38 from center puts it just
                        // in front of that face, on the frame, for every orientation.
                        // (The previous code offset from the tile CENTER inconsistently,
                        // so n/s doors floated ~a full tile while e/w stuck out.)
                        const headerY = fY + FLR_H - 0.24;   // just above the (shorter) door
                        const FRAME = 0.38;                  // distance from tile center to the sign (wall is at 0.5)
                        let mx = 0, mz = 0, ry = 0;
                        if      (mountDir === 'n') { mz = -FRAME; ry = 0; }            // wall on north edge; face into room (+z)
                        else if (mountDir === 's') { mz =  FRAME; ry = Math.PI; }      // wall on south edge; face -z
                        else if (mountDir === 'e') { mx =  FRAME; ry = -Math.PI / 2; } // wall on east edge; face -x
                        else if (mountDir === 'w') { mx = -FRAME; ry =  Math.PI / 2; } // wall on west edge; face +x
                        g.position.set(x + mx, headerY, z + mz); g.rotation.y = ry; scene.add(g);
                        interactables.push({ x: x, z: z, f: flr, obj: cell.o, mesh: g });
                    }
                    else if (cell.o.v === 'arrow') {
                        // #arrow: a big floating, animated pointing arrow that signposts
                        // "go here / do this" (mainly tutorials). Points meta.arrowDir
                        // (down|up|n|s|e|w; default down), bobs in the anim loop, and —
                        // if meta.disappearOnReach (default true) — vanishes when the
                        // player reaches its tile (or meta.pointAtX/Z).
                        const g = new THREE.Group();
                        const acol = cell.o.c || '#ffd23f';
                        const amat = new THREE.MeshBasicMaterial({ color: acol });
                        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), amat); shaft.position.y = 0.25;
                        const ahead = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 4), amat); ahead.rotation.y = Math.PI / 4; ahead.position.y = -0.2; ahead.rotation.x = Math.PI;
                        g.add(shaft); g.add(ahead);
                        const adir = (cell.o.meta && cell.o.meta.arrowDir) || 'down';
                        if (adir === 'up')      g.rotation.z = Math.PI;
                        else if (adir === 'n')  g.rotation.x = Math.PI / 2;   // -> -Z (north); was inverted (#5 batch)
                        else if (adir === 's')  g.rotation.x = -Math.PI / 2;  // -> +Z (south); was inverted (#5 batch)
                        else if (adir === 'e')  g.rotation.z = Math.PI / 2;
                        else if (adir === 'w')  g.rotation.z = -Math.PI / 2;
                        g.position.set(x, fY + 1.6, z); scene.add(g);
                        // Wave I: meta.hidden starts an arrow invisible; meta.name tags it;
                        // meta.revealOnReach names an arrow to reveal when THIS one's target
                        // is reached (the action arrow reveals the 'exit' arrow).
                        if (cell.o.meta && cell.o.meta.hidden) g.visible = false;
                        arrowObjects.push({ grp: g, x: x, z: z, f: flr, baseY: fY + 1.6, t: Math.random() * Math.PI * 2,
                            disappear: (cell.o.meta ? cell.o.meta.disappearOnReach !== false : true),
                            hidden: !!(cell.o.meta && cell.o.meta.hidden),
                            name: (cell.o.meta && cell.o.meta.name) || null,
                            revealOnReach: (cell.o.meta && cell.o.meta.revealOnReach) || null,
                            targetX: (cell.o.meta && cell.o.meta.pointAtX != null) ? cell.o.meta.pointAtX : x,
                            targetZ: (cell.o.meta && cell.o.meta.pointAtZ != null) ? cell.o.meta.pointAtZ : z });
                    }
                    else if (cell.o.v === 'solid_diag1' || cell.o.v === 'solid_diag2') {
                        // Angled wall slab across the tile diagonal. d1 = NE-SW,
                        // d2 = NW-SE. Width 1.414 = √2 so it spans corner-to-corner.
                        let mapTex = null;
                        if (typeof WallTextures !== 'undefined' && WallTextures[cell.o.v]) {
                            const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d');
                            WallTextures[cell.o.v](ctx, cell.o.c, cell.o.ac, 64);
                            const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; mapTex = tex;
                        } else {
                            const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d');
                            ctx.fillStyle = cell.o.c || '#fff'; ctx.fillRect(0, 0, 64, 64); mapTex = new THREE.CanvasTexture(c);
                        }
                        const b = new THREE.Mesh(new THREE.BoxGeometry(1.414, FLR_H, 0.15), new THREE.MeshLambertMaterial({ map: mapTex }));
                        b.position.set(x, fY + FLR_H / 2, z); b.rotation.y = cell.o.v === 'solid_diag1' ? -Math.PI / 4 : Math.PI / 4;
                        b.castShadow = cS; b.receiveShadow = true; scene.add(b); wallMeshes.push(b);
                    }
                    else {
                        // ── GENERIC OBJECT GROUP ──
                        // Most prop types fall into here. We make a group `g` and
                        // bolt on different geometries by variant. `meshRef` is
                        // the specific bit to record in `interactables` so the
                        // raycaster can hit it (vs. the empty group origin).
                        const g = new THREE.Group(); const mat = new THREE.MeshLambertMaterial({ color: cell.o.c }); let meshRef = null;

                        if (cell.o.v === 'arcade' || cell.o.v === 'arcade_sit') {
                            // Cabinet + sloped screen face. arcade_sit also gets a stool.
                            const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), mat); b.position.y = 0.9; b.castShadow = cS; g.add(b);
                            const scr = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: '#fff' }));
                            scr.position.set(0, 1.3, 0.4); scr.rotation.x = -0.5; g.add(scr);
                            if (cell.o.v === 'arcade_sit') { const st = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), mat); st.position.set(0, 0.25, 0.8); st.castShadow = cS; g.add(st); }
                        } else if (cell.o.v === 'trash') {
                            const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.8, 16), mat); t.position.y = 0.4; t.castShadow = cS; g.add(t); meshRef = t;
                        } else if (cell.o.v === 'bench') {
                            const t = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.4), mat); t.position.y = 0.5; t.castShadow = cS; g.add(t);
                            const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.3), new THREE.MeshLambertMaterial({ color: '#555' })); l1.position.set(-0.4, 0.25, 0); g.add(l1);
                            const l2 = l1.clone(); l2.position.x = 0.4; g.add(l2); meshRef = t;
                        } else if (cell.o.v === 'car') {
                            // #7: a parked CAR — a large placeable prop. It's ~1.8 units
                            // long so it visually overhangs into the neighbouring tile,
                            // but logically it occupies (and blocks) just its own tile.
                            // Orient with meta.carDir (n/s/e/w = which way the FRONT
                            // points). Body colour = the tile colour picked in Mapster.
                            // HOW TO MODIFY: tweak the box sizes / wheel positions below.
                            const carG = new THREE.Group();
                            const glassMat = new THREE.MeshLambertMaterial({ color: '#111820' });
                            const tyreMat  = new THREE.MeshLambertMaterial({ color: '#151515' });
                            const body  = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 0.9), mat); body.position.y = 0.42; body.castShadow = cS; carG.add(body);
                            const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.4, 0.82), mat); cabin.position.set(-0.05, 0.78, 0); cabin.castShadow = cS; carG.add(cabin);
                            const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.84), glassMat); glass.position.set(-0.05, 0.8, 0); carG.add(glass);
                            [[0.6, 0.34], [0.6, -0.34], [-0.6, 0.34], [-0.6, -0.34]].forEach(function (wp) {
                                const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), tyreMat);
                                w.rotation.x = Math.PI / 2; w.position.set(wp[0], 0.2, wp[1]); w.castShadow = cS; carG.add(w);
                            });
                            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.16), new THREE.MeshBasicMaterial({ color: '#fff8d0' }));
                            hl.position.set(0.9, 0.42, 0.28); carG.add(hl);
                            const hl2 = hl.clone(); hl2.position.z = -0.28; carG.add(hl2);
                            const _cd = (cell.o.meta && cell.o.meta.carDir) || 'n';
                            carG.rotation.y = ({ n: Math.PI / 2, e: 0, s: -Math.PI / 2, w: Math.PI })[_cd] || 0;
                            g.add(carG); meshRef = body; if (cell.o.meta && cell.o.meta.keyId) { keyFetchCar = { x: x, z: z, f: flr }; keyFetchKeyId = cell.o.meta.keyId; }   // #7: track ONLY the car that holds the key (the player's), not the decorative parked cars
                        } else if (cell.o.v === 'key') {
                            // Compound shaft + bow + tooth. Optional shimmer light
                            // around it via meta.shimmer flag (light source on group).
                            const kG = new THREE.Group();
                            const shft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1 })); shft.rotation.z = Math.PI / 2;
                            const bow = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1 })); bow.position.x = -0.15;
                            const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1 })); tooth.position.set(0.1, -0.04, 0);
                            kG.add(shft, bow, tooth); kG.position.y = 0.1; g.add(kG); meshRef = kG;
                            if (cell.o.meta && cell.o.meta.keyId && !keyFetchKeyId) keyFetchKeyId = cell.o.meta.keyId;   // #7: the key you must grab from the car
                            if (cell.o.meta?.shimmer) { lightingManager.addLight(g, '#ffaa00', 0.5, 1, { flickerMode: 'normal', flickerSpeed: 10, flickerChaos: 0, intensity: 0.5 }, new THREE.Vector3(0, 0.5, 0)); }
                        } else if (cell.o.v === 'ladder') {
                            // Two rails + rungs spaced 0.5 apart across the floor height.
                            // §5.4 collision handler bumps player floor up/down on step-on.
                            const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, FLR_H), new THREE.MeshLambertMaterial({ color: '#555' })); r1.position.set(-0.3, FLR_H / 2, -0.4); g.add(r1);
                            const r2 = r1.clone(); r2.position.x = 0.3; g.add(r2);
                            for (let i = 0; i < FLR_H * 2; i++) { const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6), new THREE.MeshLambertMaterial({ color: '#555' })); rung.rotation.z = Math.PI / 2; rung.position.set(0, i * 0.5 + 0.25, -0.4); g.add(rung); }
                        } else if (cell.o.v === 'stairs') {
                            // A visible STAIRCASE: open flat treads (the surfaces you'd
                            // step on) with a riser under each, climbing the floor height
                            // in meta.stairDir (n/s/e/w, default 'n'; the TOP meets the far
                            // edge so it lines up with the upper-floor opening). Traversal
                            // is deliberate — stand on the tile and press SPACE (stepping on
                            // alone just shows a hint). HOW TO MODIFY: STEPS / stepW / colors.
                            // #16: the flight is now LONGER + GENTLER (the run spills ~⅔ of a
                            // tile toward the lower floor instead of cramming a whole storey
                            // into one tile) and ~2 TILES WIDE. Keep the tile in FRONT and to
                            // the SIDE clear/walkable so the wider mesh reads cleanly. Tune
                            // steepness with RUN_TILES, width with stepW.
                            // #16: a stairs tile can be PAIRED into a 2-tile-wide flight.
                            // The PRIMARY tile (meta.stairWide = the perpendicular direction
                            // of its partner: 'e'/'w' for n/s stairs, 'n'/'s' for e/w stairs)
                            // draws a 2-tile-wide flight shifted half a tile toward the
                            // partner so it centres over BOTH tiles. The partner is a
                            // meta.stairGhost 'stairs' tile: it renders NO mesh of its own but
                            // is still walkable + climbable, so you can go up either side.
                            // #7: the UPPER end of a flight is a LANDING, not a second
                            // staircase — a meta.stairTop tile renders no rising steps (the
                            // single flight on the floor below is the visible stairs; from up
                            // here you just step onto it to go DOWN). Both stairTop and the old
                            // stairGhost skip the mesh; the tile stays walkable + traversable.
                            if (!cell.o.meta?.stairGhost && !cell.o.meta?.stairTop) {
                            const STEPS = 10;
                            // #7: 2 squares LONG (not wide). The flight runs ~2 tiles along the
                            // climb axis — gentle enough to read as real stairs — and stays ONE
                            // tile wide. (The old 2-tiles-WIDE pairing is gone; keep the tile in
                            // FRONT clear/walkable so the run that spills toward the lower floor
                            // reads cleanly.) Tune length with RUN_TILES, steepness with STEPS.
                            const RUN_TILES = 2.0;                  // #7: ~2 tiles long
                            const stepRise = FLR_H / STEPS;
                            const stepRun  = RUN_TILES / STEPS;     // along-axis depth per step
                            const stepW  = 0.9;                     // #7: ~1 tile wide (never paired wide)
                            const pOff   = 0;
                            const col = cell.o.c || '#8a7f6a';
                            const wood = new THREE.MeshLambertMaterial({ color: col });
                            const dark = new THREE.MeshLambertMaterial({ color: '#4f463a' });
                            const dir = cell.o.meta?.stairDir || 'n';
                            const axisZ = (dir === 'n' || dir === 's');     // climb along Z vs X
                            const sgn   = (dir === 'n' || dir === 'w') ? -1 : 1;   // toward -axis vs +axis
                            // place a (wPerp × h × dAlong) box at along-axis offset `a`, height `y`
                            const place = (wPerp, h, dAlong, a, y, m) => {
                                const geo = axisZ ? new THREE.BoxGeometry(wPerp, h, dAlong)
                                                  : new THREE.BoxGeometry(dAlong, h, wPerp);
                                const mesh = new THREE.Mesh(geo, m);
                                if (axisZ) mesh.position.set(pOff, y, sgn * a);
                                else       mesh.position.set(sgn * a, y, pOff);
                                mesh.castShadow = cS; mesh.receiveShadow = true; g.add(mesh);
                                return mesh;
                            };
                            const topA = 0.46;                              // top tread near the far edge
                            for (let i = 0; i < STEPS; i++) {
                                const ty = (i + 1) * stepRise;              // this tread's top height
                                const a  = topA - (STEPS - 1 - i) * stepRun;
                                place(stepW, 0.08, stepRun * 1.35, a, ty - 0.04, wood);            // flat tread (with a little nosing)
                                place(stepW, stepRise, 0.05, a + stepRun * 0.6, ty - stepRise / 2, dark); // riser face under the tread front
                            }
                            // side stringers + a handrail on the high side so it never reads as a ramp
                            for (const side of [-1, 1]) {
                                const px = pOff + side * (stepW / 2 + 0.03);
                                const top = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, FLR_H * 0.95), dark);
                                const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, FLR_H * 0.42), dark);
                                if (axisZ) { top.position.set(px, FLR_H * 0.48, sgn * topA); bot.position.set(px, FLR_H * 0.21, sgn * (topA - (STEPS - 1) * stepRun)); }
                                else       { top.position.set(sgn * topA, FLR_H * 0.48, px); bot.position.set(sgn * (topA - (STEPS - 1) * stepRun), FLR_H * 0.21, px); }
                                g.add(top); g.add(bot);
                                // a sloped handrail connecting the two posts
                                const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, (STEPS - 1) * stepRun * (axisZ ? 1 : 1)), dark);
                                const rlen = Math.hypot((STEPS - 1) * stepRun, FLR_H * 0.5);
                                rail.geometry = axisZ ? new THREE.BoxGeometry(0.05, 0.05, rlen) : new THREE.BoxGeometry(rlen, 0.05, 0.05);
                                const midA = topA - (STEPS - 1) * stepRun / 2;
                                if (axisZ) { rail.position.set(px, FLR_H * 0.72, sgn * midA); rail.rotation.x = sgn * Math.atan2(FLR_H * 0.5, (STEPS - 1) * stepRun); }
                                else       { rail.position.set(sgn * midA, FLR_H * 0.72, px); rail.rotation.z = -sgn * Math.atan2(FLR_H * 0.5, (STEPS - 1) * stepRun); }
                                g.add(rail);
                            }
                            }   // #16: end !stairGhost — the ghost partner skips all mesh
                        } else if (cell.o.v === 'ledge') {
                            // A visible DROP-OFF LIP along one side of the tile (meta.ledgeDir,
                            // default 's'): a low hazard-striped curb that marks an open ledge
                            // you can step off to fall/jump to the floor below. Non-colliding
                            // (the object's meta.solid is false) — it's purely a visual cue so
                            // the opening doesn't read as a plain wall. HOW TO MODIFY: ledgeDir.
                            const lipMat = new THREE.MeshLambertMaterial({ color: cell.o.c || '#e6b422' });
                            const dir = cell.o.meta?.ledgeDir || 's';
                            const o = 0.46, lh = 0.14;
                            let lip;
                            if (dir === 'n' || dir === 's') {
                                lip = new THREE.Mesh(new THREE.BoxGeometry(0.94, lh, 0.1), lipMat);
                                lip.position.set(0, lh / 2, dir === 's' ? o : -o);
                            } else {
                                lip = new THREE.Mesh(new THREE.BoxGeometry(0.1, lh, 0.94), lipMat);
                                lip.position.set(dir === 'e' ? o : -o, lh / 2, 0);
                            }
                            lip.castShadow = cS; lip.receiveShadow = true; g.add(lip);
                            // two short end posts so the opening reads like a balcony gap
                            for (const s of [-1, 1]) {
                                const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34), new THREE.MeshLambertMaterial({ color: '#3a3327' }));
                                if (dir === 'n' || dir === 's') cap.position.set(s * 0.46, 0.17, dir === 's' ? o : -o);
                                else cap.position.set(dir === 'e' ? o : -o, 0.17, s * 0.46);
                                g.add(cap);
                            }
                        } else if (cell.o.v !== 'warp_pad' && cell.o.v !== 'warp_point' && cell.o.v !== 'eavesdrop' && cell.o.v !== 'fog_src') {
                            // Default fallback: a 0.5³ box. warp_pad, warp_point and
                            // the #13 'eavesdrop' trigger are intentionally invisible —
                            // handled via collision / registries / the step hook.
                            const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat); b.position.y = 0.25; b.castShadow = cS; g.add(b);
                        }
                        // collect named warp points (fast-travel destinations).
                        if (cell.o.v === 'warp_point') {
                            warpPoints.push({ x: x, z: z, f: flr, name: cell.o.meta?.warpPointName || 'Warp Point', fastTravel: cell.o.meta?.directoryFastTravel !== false });
                        }

                        g.position.set(x, fY, z); g.rotation.y = rY; scene.add(g); wallMeshes.push(g);
                        // SPARKLE — any object with meta.sparkle gets an
                        // occasional bright GLINT (a toggleable "look here!" shine,
                        // e.g. for a key). Registered for per-frame animation in the
                        // anim loop.
                        if (cell.o.meta && cell.o.meta.sparkle) {
                            const spk = makeSparkle(cell.o.meta.sparkleColor || '#fff6a8');
                            spk.position.set(0, (cell.o.meta.sparkleY != null ? +cell.o.meta.sparkleY : 0.22), 0);   // sit ON the object (meta.sparkleY raises it, e.g. onto a car roof)
                            g.add(spk);
                            g.userData.sparkle = spk;        // so pickup can remove it
                            sparkleObjects.push({ grp: spk, t: Math.random() * Math.PI * 2 });
                        }

                        // Register this group as interactable if any of these are true.
                        // (Keys/benches/sit-arcades/registers are always interactable;
                        // anything else needs meta.text, meta.isWarp, meta.jumpable,
                        // or a capacity counter for containers.)
                        if (cell.o.v === 'key' || cell.o.v === 'bench' || cell.o.v === 'arcade_sit' || cell.o.v === 'register' || (cell.o.v === 'car' && cell.o.meta?.keyId) || cell.o.meta?.text || cell.o.meta?.isWarp || cell.o.meta?.jumpable || cell.o.meta?.capacity > 0) {
                            interactables.push({ x: x, z: z, f: flr, obj: cell.o, mesh: meshRef || g, grp: g });
                        }

                        // Optional local emitters attached to the object:
                        // - fogEmitter: localized smoke/steam cloud around it
                        // - audioUrl:   PositionalAudio at the object's location
                        if (cell.o.meta?.fogEmitter) {
                            fogManager.addLocalFog(scene, cell.o.meta.fogColor, cell.o.meta.fogDensity, cell.o.meta.fogBillow, new THREE.Vector3(x, fY + FLR_H / 2, z));
                        }
                        if (cell.o.meta?.audioUrl) {
                            const pAudio = new THREE.PositionalAudio(listener);
                            const aLoader = new THREE.AudioLoader();
                            aLoader.load(cell.o.meta.audioUrl, (buf) => {
                                pAudio.setBuffer(buf); pAudio.setRefDistance(cell.o.meta.audioRad); pAudio.setVolume(cell.o.meta.audioVol); pAudio.setLoop(cell.o.meta.audioLoop);
                                window.addEventListener('click', () => pAudio.play().catch(e => console.log(e)), { once: true });
                            });
                            g.add(pAudio); localAudios.push({ audio: pAudio, meta: cell.o.meta, mesh: g });
                        }
                    }
                }

                // ── §4.3  CEILING LIGHTS ────────────────────────────────────
                // Overhead pendant. Separated from the object layer so the
                // fixture doesn't block ground movement. (See MAPSTER.docx §3.)
                if (cell.c && cell.c.v === 'light') {
                    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8), new THREE.MeshBasicMaterial({ color: '#fff' }));
                    l.position.set(x, fY + FLR_H - 0.1, z); scene.add(l);
                    // Ceiling fixtures are the primary illumination, so they keep
                    // shadow-casting (decorative neon/sconces do not — see #9).
                    const ceilMeta = Object.assign({ castShadow: true }, cell.c.meta);
                    lightingManager.addLight(scene, cell.c.meta.lightColor || cell.c.c, cell.c.meta.intensity, cell.c.meta.distance || 10, ceilMeta, new THREE.Vector3(x, fY + FLR_H - 0.2, z));
                }

                // ── §4.4  WALLS & EDGES (and attachments) ───────────────────
                // Each tile has up to 4 cardinal edges (n,s,e,w). buildEdge()
                // is called once per direction, and creates the matching
                // wall / door / counter / window / archway, plus any wall
                // ATTACHMENTS (posters, switches, mirrors, sconces, neon...).
                //
                // The function is defined inline because it closes over a lot
                // of the surrounding loop state (x, z, flr, fY).
                const buildEdge = (dObj, dStr) => {
                    if (!dObj) return;
                    const isH = (dStr === 'n' || dStr === 's');
                    const isA = dObj.v === 'arch';
                    // Edge offset from tile centre: walls live exactly at the
                    // tile boundary (±0.5 in the relevant axis). Slight corner
                    // overlap is handled via wX = 1.05 below (prevents light bleed).
                    const oX = dStr === 'e' ? 0.5 : (dStr === 'w' ? -0.5 : 0);
                    const oZ = dStr === 's' ? 0.5 : (dStr === 'n' ? -0.5 : 0);
                    const isCounter = dObj.v === 'counter' || dObj.v === 'counter_door';

                    // ── ROPE BARRIER ────────────────────────────────────────
                    // Two short waist-height poles with a drooping rope (or
                    // chain) slung between them, sitting on the tile edge. Solid
                    // (blocks walking) but jumpable like a counter, and — if
                    // meta.openable — can be "unhooked" by interacting (the rope
                    // hides and the edge goes non-solid). Registered in
                    // doorObjects so the open/close toggle reuses that path.
                    if (dObj.v === 'rope') {
                        const grp = new THREE.Group();
                        const poleH = dObj.meta?.poleHeight || 0.9;
                        const poleMat = new THREE.MeshLambertMaterial({ color: dObj.c || '#7c2d12' });
                        const ropeMat = new THREE.MeshLambertMaterial({ color: dObj.ac || '#facc15' });
                        const mkPole = (px, pz) => {
                            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, poleH, 8), poleMat);
                            pole.position.set(px, poleH / 2, pz); pole.castShadow = dObj.meta?.castShadow !== false;
                            // little ball cap
                            const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), ropeMat);
                            cap.position.set(px, poleH + 0.02, pz); grp.add(cap);
                            return pole;
                        };
                        // Poles at the two ends of the edge span.
                        const half = 0.45;
                        if (isH) { grp.add(mkPole(-half, 0)); grp.add(mkPole(half, 0)); }
                        else { grp.add(mkPole(0, -half)); grp.add(mkPole(0, half)); }
                        // Rope: a thin tube drooping between the pole tops. We
                        // approximate the catenary with a flattened, sagging
                        // cylinder built from a short curve of segments.
                        const ropeGrp = new THREE.Group();
                        const segs = 8; const sag = 0.18; const topY = poleH - 0.05;
                        for (let s = 0; s < segs; s++) {
                            const t0 = s / segs, t1 = (s + 1) / segs;
                            const droop = (t) => topY - sag * Math.sin(Math.PI * t);
                            const a = isH ? new THREE.Vector3(-half + t0 * 2 * half, droop(t0), 0) : new THREE.Vector3(0, droop(t0), -half + t0 * 2 * half);
                            const b = isH ? new THREE.Vector3(-half + t1 * 2 * half, droop(t1), 0) : new THREE.Vector3(0, droop(t1), -half + t1 * 2 * half);
                            const len = a.distanceTo(b);
                            const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), ropeMat);
                            const mid = a.clone().add(b).multiplyScalar(0.5); seg.position.copy(mid);
                            // orient the segment from a→b
                            const dir = b.clone().sub(a).normalize();
                            const axis = new THREE.Vector3(0, 1, 0);
                            const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir);
                            seg.quaternion.copy(quat);
                            ropeGrp.add(seg);
                        }
                        grp.add(ropeGrp);
                        grp.position.set(x + oX, fY, z + oZ);
                        grp.userData = { f: flr, isW: true, oOp: 1.0 };
                        scene.add(grp);
                        wallMeshes.push(grp);
                        // Register for open/close so interaction can unhook it.
                        doorObjects.push({ x: x, z: z, f: flr, dir: dStr, grp: grp, isH: isH, isOpen: false, isRope: true, ropeGrp: ropeGrp, edgeMeta: dObj.meta });
                        return;
                    }

                    // Wall slab dimensions. Horizontal walls (n/s) are wide
                    // along X; vertical walls (e/w) are wide along Z.
                    // Counter walls are shorter and chunkier.
                    const wX = isH ? 1.05 : (isCounter ? 0.6 : 0.15);
                    const wZ = isH ? (isCounter ? 0.6 : 0.15) : 1.05;
                    const isGlass = ['glass_full', 'window_insert'].includes(dObj.v);

                    // Build the material. Glass walls are ALWAYS see-through:
                    // we cap their opacity at 0.35 regardless of the meta
                    // paintOpacity setting (paintOpacity controls how opaque
                    // any *painted decal* on the glass is — see paintData
                    // below — not the glass itself). Previously glass used
                    // `paintOpacity || 1.0`, so glass with the default
                    // paintOpacity of 1.0 rendered fully opaque, which is why
                    // windows weren't see-through.
                    const glassOpacity = 0.28;
                    const mat = new THREE.MeshLambertMaterial({ color: dObj.c, transparent: isGlass, opacity: isGlass ? glassOpacity : 1, depthWrite: !isGlass });
                    // #border-walls: render solid walls DOUBLE-SIDED so a perimeter
                    // wall seen only from its interior face can't vanish to back-face
                    // culling. (Glass sets DoubleSide separately below.)
                    if (!isGlass) mat.side = THREE.DoubleSide;
                    if (isGlass) {
                        // Belt-and-suspenders to guarantee see-through glass:
                        // explicit transparent flag, double-sided so it reads
                        // from both faces, and a high renderOrder so it draws
                        // after opaque geometry (correct alpha blending). These
                        // together prevent the "glass looks solid" failure that
                        // happens when the renderer sorts the glass before the
                        // things behind it.
                        mat.transparent = true;
                        mat.opacity = glassOpacity;
                        mat.depthWrite = false;
                        mat.side = THREE.DoubleSide;
                        mat.needsUpdate = true;
                    }
                    if (isGlass && dObj.meta?.paintData) {
                        // A painted decal sits on the glass. The PNG carries its
                        // own alpha (clear where unpainted), so we show it with a
                        // white tint (true colors), the texture's alpha driving
                        // transparency, and alphaTest so clear glass shows through.
                        const img = new Image(); img.src = dObj.meta.paintData;
                        const t = new THREE.Texture(img); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
                        if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
                        img.onload = () => { t.needsUpdate = true; };
                        t.needsUpdate = true;
                        mat.map = t;
                        if (mat.color && mat.color.setHex) mat.color.setHex(0xffffff);
                        mat.transparent = true;
                        mat.opacity = 1.0;
                        mat.alphaTest = 0.02;
                        mat.depthWrite = true;
                        mat.side = THREE.DoubleSide;
                        mat.needsUpdate = true;
                    } else if (!isGlass && dObj.v) {
                        // Procedural texture if WallTextures has a generator for this variant.
                        if (typeof WallTextures !== 'undefined' && WallTextures[dObj.v]) {
                            const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d');
                            WallTextures[dObj.v](ctx, dObj.c, dObj.ac, 64);
                            const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; mat.map = tex;
                        } else {
                            const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d');
                            ctx.fillStyle = dObj.c || '#fff'; ctx.fillRect(0, 0, 64, 64); const tex = new THREE.CanvasTexture(c); mat.map = tex;
                        }
                    }

                    // Default wall height = full floor height. Arch = short header only.
                    // Counter = waist-high (0.6m, centred at 0.3m).
                    let mH = FLR_H; let mY = FLR_H / 2;
                    if (isA) { mH = 0.5; mY = FLR_H - 0.25; }
                    if (isCounter) { mH = 0.6; mY = 0.3; }
                    // light passes through windows of ALL types by default —
                    // glass edges don't cast shadows, so point lights illuminate
                    // both sides. An author can force a window to block light with
                    // meta.blocksLight (then it casts shadows like a solid wall).
                    const cS = (dObj.meta?.castShadow !== false && !isGlass) || (isGlass && dObj.meta?.blocksLight === true);
                    let m;

                    if (dObj.v === 'window_insert') {
                        // Window with framing: solid top + solid bottom panel,
                        // transparent glass middle (paintable). canvasWidth
                        // meta extends the glass across multiple tiles.
                        const wGroup = new THREE.Group();
                        const matWall = new THREE.MeshLambertMaterial({ color: dObj.c, map: getTex(dObj.v, dObj.c, dObj.ac) });
                        const wTop = new THREE.Mesh(new THREE.BoxGeometry(wX, 0.4, wZ), matWall); wTop.position.y = FLR_H - 0.2; wTop.castShadow = cS;
                        const wBot = new THREE.Mesh(new THREE.BoxGeometry(wX, 0.8, wZ), matWall); wBot.position.y = 0.4; wBot.castShadow = cS;
                        const glass = new THREE.Mesh(new THREE.BoxGeometry(isH ? (dObj.meta?.canvasWidth || 1) * wX : wX, FLR_H - 1.2, isH ? wZ : (dObj.meta?.canvasWidth || 1) * wZ), mat); glass.position.y = FLR_H / 2;
                        glass.renderOrder = 2;   // draw after opaque geometry for correct blending
                        // Tag the group so a breakable-glass "shatter" can find
                        // and hide this exact window by tile + edge direction.
                        wGroup.add(wTop, wBot, glass); m = wGroup; m.userData = { f: flr, isW: true, oOp: 1.0, isGlassEdge: isGlass, ex: x, ez: z, edir: dStr }; m.position.set(x + oX, fY, z + oZ);
                    } else {
                        // #10a: full-glass windows also span canvasWidth adjacent
                        // tiles (matching window_insert), so a decal drawn across
                        // 1–4 windows stretches over the whole run. A widened box
                        // centered on this tile would grow symmetrically, so we
                        // shift its center by (span-1)/2 tiles along the run so it
                        // extends across the NEXT adjacent tiles (the convention
                        // used by the editor canvas: left-to-right / top-to-bottom).
                        const span = isGlass ? Math.max(1, Math.min(4, dObj.meta?.canvasWidth || 1)) : 1;
                        const gW = isH ? wX * span : wX;
                        const gZ = isH ? wZ : wZ * span;
                        m = new THREE.Mesh(new THREE.BoxGeometry(gW, mH, gZ), mat);
                        if (isGlass) m.renderOrder = 2;
                        const spanShift = (span - 1) / 2;
                        m.userData = { f: flr, isW: !isA, oOp: mat.opacity, isGlassEdge: isGlass, ex: x, ez: z, edir: dStr }; m.castShadow = cS; m.receiveShadow = true;
                        m.position.set(x + oX + (isH ? spanShift : 0), fY + mY, z + oZ + (isH ? 0 : spanShift));

                        // optional pane frame around a full glass wall — four
                        // thin bars hugging the glass edges in the chosen color.
                        if (dObj.v === 'glass_full' && dObj.meta && dObj.meta.borderOn) {
                            const fCol = dObj.meta.borderColor || '#c0c0c0';
                            const fMat = new THREE.MeshLambertMaterial({ color: fCol });
                            const t = 0.08;                 // frame thickness
                            const runW = isH ? gW : 0.12;   // along the wall run
                            const runD = isH ? 0.12 : gZ;
                            const cx = m.position.x, cz = m.position.z, cy = m.position.y;
                            // top + bottom bars
                            [mH/2, -mH/2].forEach(dy => {
                                const bar = new THREE.Mesh(new THREE.BoxGeometry(runW, t, runD), fMat);
                                bar.position.set(cx, cy + dy, cz); scene.add(bar); wallMeshes.push(bar);
                            });
                            // left + right (end) bars, along the run axis
                            const half = (isH ? gW : gZ) / 2;
                            [half, -half].forEach(d => {
                                const bar = new THREE.Mesh(new THREE.BoxGeometry(isH ? t : 0.12, mH, isH ? 0.12 : t), fMat);
                                bar.position.set(cx + (isH ? d : 0), cy, cz + (isH ? 0 : d));
                                scene.add(bar); wallMeshes.push(bar);
                            });
                        }

                        // optional different look on the BACK side of the wall.
                        // The base mesh `m` shows the front material; we lay a thin
                        // slab with the back material against the far face.
                        if (dObj.meta && dObj.meta.back && !isGlass) {
                            const bk = dObj.meta.back;
                            const bMat = new THREE.MeshLambertMaterial({ color: bk.color || '#888888', map: getTex(bk.v || 'solid', bk.color || '#888888', dObj.ac) });
                            const bt = 0.06;   // back-slab thickness
                            const bGeo = new THREE.BoxGeometry(isH ? gW : bt, mH, isH ? bt : gZ);
                            const bMesh = new THREE.Mesh(bGeo, bMat);
                            // Push the slab to the side the attachment normal points
                            // AWAY from (the far face). oX/oZ encode the near side.
                            const push = (0.15 / 2) + bt / 2;
                            bMesh.position.set(
                                m.position.x + (isH ? 0 : (oX > 0 ? push : -push)),
                                m.position.y,
                                m.position.z + (isH ? (oZ > 0 ? push : -push) : 0)
                            );
                            bMesh.castShadow = cS; bMesh.receiveShadow = true;
                            scene.add(bMesh); wallMeshes.push(bMesh);
                        }
                    }

                    // Counter top — a thin slab capping the counter body.
                    // `t` is a CHILD of `m`, and `m` is already positioned at
                    // world y = fY + mY. So `t.position.y` is LOCAL to the
                    // counter body's center. The body has height mH (0.6),
                    // so its top surface is at local +mH/2 (+0.3). We place the
                    // cap slab (0.1 thick) so its underside meets that surface:
                    // local y = mH/2 + 0.05 = 0.35. (Previously this was
                    // `mY + 0.35`, which double-counted mY and left the top
                    // floating ~0.35 above the counter.)
                    if (dObj.v === 'counter' && dObj.meta?.connects) {
                        const t = new THREE.Mesh(new THREE.BoxGeometry(isH ? wX + 0.1 : wX + 0.1, 0.1, isH ? wZ + 0.1 : wZ + 0.1), mat); t.position.y = (mH / 2) + 0.05; m.add(t);
                    }

                    // Arch: just the header beam + 2 side pillars. The header
                    // is the `m` mesh; pillars are added separately to scene.
                    if (isA) {
                        const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, FLR_H, 0.15), mat); p1.position.set(x + oX + (isH ? -0.4 : 0), fY + FLR_H / 2, z + oZ + (isH ? 0 : -0.4)); scene.add(p1);
                        const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, FLR_H, 0.15), mat); p2.position.set(x + oX + (isH ? 0.4 : 0), fY + FLR_H / 2, z + oZ + (isH ? 0 : 0.4)); scene.add(p2);
                    }

                    // Add the slab itself to the scene unless this is a door
                    // (doors get a wrapping group below) or an arch (header
                    // already added inside the arch block above).
                    if (!dObj.v?.startsWith('door') && dObj.v !== 'counter_door' && !isA) {
                        scene.add(m); wallMeshes.push(m);
                        if (isGlass && (dObj.meta?.paintData !== undefined || dObj.meta?.allowDraw)) paintableWindows.push({ x: x, z: z, dir: dStr, mesh: m.children[2] || m, slab: m, mat: mat, meta: dObj.meta, isH: isH });
                        // smooth counter corners. Where this counter meets a
                        // perpendicular counter on the SAME tile, the two 0.6-deep
                        // bodies leave an L-notch at the shared corner. Drop a small
                        // filler cube at that corner so the run reads as continuous.
                        if (isCounter) {
                            const cell = MAP[flr]?.[z]?.[x];
                            const isCtr = (e) => e && (e.v === 'counter' || e.v === 'counter_door');
                            const fillerAt = (cornerX, cornerZ) => {
                                const filler = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat);
                                filler.position.set(cornerX, fY + 0.3, cornerZ);
                                filler.castShadow = cS; filler.receiveShadow = true;
                                if (dObj.meta?.connects) {
                                    const ct = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), mat); ct.position.y = 0.35; filler.add(ct);
                                }
                                scene.add(filler); wallMeshes.push(filler);
                            };
                            // (a) SAME-tile perpendicular counter → L-notch filler.
                            const perp = isH ? ['e', 'w'] : ['n', 's'];
                            perp.forEach(pd => {
                                if (!isCtr(cell?.[pd])) return;
                                const myDX = (dStr === 'e' ? 0.5 : dStr === 'w' ? -0.5 : 0);
                                const myDZ = (dStr === 's' ? 0.5 : dStr === 'n' ? -0.5 : 0);
                                const pDX = (pd === 'e' ? 0.5 : pd === 'w' ? -0.5 : 0);
                                const pDZ = (pd === 's' ? 0.5 : pd === 'n' ? -0.5 : 0);
                                fillerAt(x + (isH ? pDX : myDX), z + (isH ? myDZ : pDZ));
                            });
                            // (b) #8.1/#8.2: ADJACENT-tile turn. A counter on this
                            // edge whose run ends at a tile corner where the
                            // diagonally-adjacent tile carries a perpendicular
                            // counter leaves a cross-tile gap. Fill that corner too.
                            // Only the tile with the lower (x+z) "owns" the filler so
                            // it isn't placed twice.
                            const endpoints = isH ? [['w', -0.5], ['e', 0.5]] : [['n', -0.5], ['s', 0.5]];
                            endpoints.forEach(([endDir, sign]) => {
                                const nx = x + (isH ? sign : 0);
                                const nz = z + (isH ? 0 : sign);
                                const ncell = MAP[flr]?.[nz]?.[nx];
                                // perpendicular counter on the neighbor that turns here
                                const turn = isH ? (isCtr(ncell?.n) ? 'n' : isCtr(ncell?.s) ? 's' : null)
                                                  : (isCtr(ncell?.e) ? 'e' : isCtr(ncell?.w) ? 'w' : null);
                                if (!turn) return;
                                if ((nx + nz) < (x + z)) return;   // ownership guard
                                const cornerX = x + (isH ? sign : (turn === 'e' ? 0.5 : turn === 'w' ? -0.5 : 0));
                                const cornerZ = z + (isH ? (turn === 's' ? 0.5 : turn === 'n' ? -0.5 : 0) : sign);
                                fillerAt(cornerX, cornerZ);
                            });
                        }
                    }

                    // ── DOORS ──
                    // door_swing rotates around a hinge offset (so it opens by
                    // pivoting from one edge, not its centre). door_slide
                    // translates instead.  counter_door is a half-height swing.
                    if (dObj.v?.startsWith('door') || dObj.v === 'counter_door') {
                        const grp = new THREE.Group(); grp.position.set(x + oX, fY, z + oZ);
                        const isCounterDoor = (dObj.v === 'counter_door');
                        // a counter door is the SAME height as the counter
                        // (0.6, centred at 0.3) so it sits flush — it used to be
                        // 0.8/centre-0.4 and stuck up ~0.2 above the run.
                        // a regular door used to be FULL floor height
                        // (FLR_H), so it ran right up to the ceiling and the EXIT
                        // sign had to sit ON the door. Shorten it by DOOR_HEADER so
                        // there's a header gap above the door where the sign hangs
                        // (a wall-colored lintel fills the gap so it still reads as
                        // a framed doorway). TUNING: DOOR_HEADER = gap height.
                        const DOOR_HEADER = 0.34;
                        // #13: a counter door is now a proper HALF-HEIGHT swing door
                        // (FLR_H*0.5 = 1.0 tall, standing from the floor) — a little
                        // bar/counter flap — instead of the flush 0.6 counter-top box.
                        const doorH = isCounterDoor ? (FLR_H * 0.5) : (FLR_H - DOOR_HEADER);
                        const doorCY = isCounterDoor ? (FLR_H * 0.5) / 2 : (FLR_H - DOOR_HEADER) / 2;
                        // Lintel filling the header gap above a full door (wall-colored).
                        if (!isCounterDoor) {
                            const lintel = new THREE.Mesh(new THREE.BoxGeometry(wX, DOOR_HEADER, wZ), mat.clone());
                            lintel.position.set(x + oX, fY + FLR_H - DOOR_HEADER / 2, z + oZ);
                            lintel.castShadow = cS; lintel.receiveShadow = true;
                            lintel.userData.isW = true; lintel.userData.f = flr; lintel.userData.oOp = 1.0;
                            scene.add(lintel); wallMeshes.push(lintel);
                        }
                        // counter doors can be a LIFT-TOP (a hinged flap of
                        // the counter top that lifts up, no side posts) or a SWING
                        // door. #11: a real bar/counter hatch LIFTS UP on a rear
                        // hinge (it doesn't swing sideways into whoever's standing at
                        // the counter), so 'lift' is now the DEFAULT — set
                        // meta.counterDoorStyle:'swing' only if you truly want a side
                        // swing.
                        // #13: counter doors now SWING by default like a half-height
                        // door (that's what reads well). Only use the lift-top flap if
                        // meta.counterDoorStyle is explicitly 'lift'.
                        const liftTop = isCounterDoor && (dObj.meta?.counterDoorStyle === 'lift');
                        let dMesh;
                        // does the surrounding counter run have the
                        // overhang TOP CAP (meta.connects)? If a collinear neighbor
                        // counter does, the door matches it so the run reads as one
                        // continuous counter — caps were the remaining flush mismatch
                        // (heights were already equal).
                        const _capNb = (nx2, nz2) => { const e2 = MAP[flr]?.[nz2]?.[nx2]?.[dStr]; return e2 && e2.v === 'counter' && e2.meta?.connects; };
                        const runHasCap = !!(dObj.meta?.connects || (isH ? (_capNb(x - 1, z) || _capNb(x + 1, z)) : (_capNb(x, z - 1) || _capNb(x, z + 1))));
                        if (liftTop) {
                            // a lift-top door used to be ONLY the floating
                            // 0.1-thick flap — nothing below it, so the counter run had
                            // a see-through hole at the door. Now a STATIC body (the
                            // cabinet front, same 0.6 box as neighboring counters)
                            // fills under the flap; only the top flap lifts. (Visual
                            // only — passability is edge-meta-driven as before, and
                            // counters are vaultable anyway.)
                            // the cabinet body + the top flap BOTH belong
                            // to the hinge group so the WHOLE counter section lifts and
                            // the tile is clear when open. Previously the body was a
                            // static scene mesh (added to fill the closed-counter hole),
                            // so an OPEN counter door still looked blocked by its face.
                            // Hinge sits at the counter top (hy); children are placed in
                            // LOCAL coords relative to that hinge.
                            const hy = 0.6;   // counter top (hinge height)
                            const fX = runHasCap ? wX + 0.1 : wX, fZ = runHasCap ? wZ + 0.1 : wZ;
                            // Cabinet front (0.6 tall): its top is at the hinge, so local
                            // center y = -0.3; it hangs below the hinge and lifts with it.
                            const body = new THREE.Mesh(new THREE.BoxGeometry(wX, 0.6, wZ), mat.clone());
                            body.position.set(0, -0.3, 0);
                            body.castShadow = cS; body.receiveShadow = true;
                            grp.add(body);
                            // Top flap at the hinge height. Raised by +0.05 so its top
                            // (0.70) lines up with the neighbouring counter's TOP CAP
                            // (body top 0.60 + 0.10 cap) — previously it sat at 0.60..0.65,
                            // a 0.05 dip below the counter top that made the run look wrong.
                            dMesh = new THREE.Mesh(new THREE.BoxGeometry(fX, 0.1, fZ), mat.clone());
                            dMesh.castShadow = cS; dMesh.receiveShadow = true;
                            if (isH) { dMesh.position.set(0, 0.05, -fZ / 2); }
                            else { dMesh.position.set(-fX / 2, 0.05, 0); }
                            grp.add(dMesh);
                            grp.position.set(x + oX, fY + hy, z + oZ);   // hinge anchored at the door tile, counter-top height
                            scene.add(grp); m.visible = false;
                            doorObjects.push({ x: x, z: z, f: flr, dir: dStr, grp: grp, isH: isH, isOpen: false, liftTop: true, baseRot: grp.rotation.clone ? 0 : 0, baseP: grp.position.clone(), counterBody: body });   // body ref so the open handler can hide it
                        } else {
                            // optional GAP at the bottom of the door so light
                            // bleeds under it from either side. We shorten the door
                            // by `gap` and raise its centre so the slit sits at the
                            // floor; the door no longer seals the bottom, so the
                            // point lights (which don't cast through the gap region)
                            // visibly leak under. A thin additive strip fakes the
                            // glow spill so it reads even without full shadow sim.
                            const gap = (!isCounterDoor && dObj.meta?.lightGap) ? 0.12 : 0;
                            const dh = doorH - gap;
                            dMesh = new THREE.Mesh(new THREE.BoxGeometry(wX, dh, wZ), mat.clone()); dMesh.castShadow = cS; dMesh.receiveShadow = true;
                            let hingeOffX = 0, hingeOffZ = 0;
                            if (dObj.v === 'door_swing' || isCounterDoor) {
                                if (isH) { hingeOffX = (dObj.meta.dir === 0 || dObj.meta.dir === 2) ? -wX / 2 : wX / 2; grp.position.x += hingeOffX; dMesh.position.x -= hingeOffX; }
                                else { hingeOffZ = (dObj.meta.dir === 0 || dObj.meta.dir === 2) ? -wZ / 2 : wZ / 2; grp.position.z += hingeOffZ; dMesh.position.z -= hingeOffZ; }
                            }
                            dMesh.position.y = doorCY + gap / 2;   // raise so the slit is at the floor
                            // a SWING counter door now carries the same
                            // 0.1-thick overhang TOP CAP as a connected counter run,
                            // as a CHILD of the door so it swings with it — closed,
                            // the counter-top line runs unbroken across the door.
                            if (isCounterDoor && runHasCap) {
                                const cap = new THREE.Mesh(new THREE.BoxGeometry(wX + 0.1, 0.1, wZ + 0.1), mat.clone());
                                cap.position.y = dh / 2 + 0.05; cap.castShadow = cS; cap.receiveShadow = true;
                                dMesh.add(cap);
                            }
                            grp.add(dMesh);

                            // #4/#5: SWING-DOOR window + hardware. Only for full
                            // swing doors (not counter doors / slides). All are
                            // optional and authored in Mapster.
                            if (dObj.v === 'door_swing') {
                                const md = dObj.meta || {};
                                // Local axes on the slab: the slab is thin along
                                // `thinAxis`; its two faces face ±that axis. The
                                // long axis runs along the wall.
                                const faceOffset = (isH ? wZ : wX) / 2 + 0.012;
                                const longHalf = (isH ? wX : wZ) / 2;
                                // Window placement: meta.doorWindow on/off; shape
                                // 'square' | 'tall'; doorWindowX / doorWindowY are
                                // -1..1 offsets along the door's long axis / height
                                // (editable like wall objects).
                                if (md.doorWindow) {
                                    const shape = md.doorWindowShape || 'square';
                                    const wWide = shape === 'tall' ? 0.18 : 0.26;
                                    const wTall = shape === 'tall' ? 0.5 : 0.26;
                                    const offL = (md.doorWindowX != null ? md.doorWindowX : 0) * (longHalf - wWide / 2 - 0.04);
                                    const offY = (md.doorWindowY != null ? md.doorWindowY : 0.35) * (dh / 2 - wTall / 2 - 0.04);
                                    // Transparent pane (see-through; lets light through —
                                    // the door slab around it still blocks, but the
                                    // pane region is a MeshPhysical-ish transparent box).
                                    const paneMat = new THREE.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.32, depthWrite: false });
                                    const paneGeo = isH
                                        ? new THREE.BoxGeometry(wWide, wTall, wZ + 0.03)
                                        : new THREE.BoxGeometry(wX + 0.03, wTall, wWide);
                                    const pane = new THREE.Mesh(paneGeo, paneMat);
                                    // position relative to dMesh local space
                                    const pX = isH ? (dMesh.position.x + offL) : dMesh.position.x;
                                    const pZ = isH ? dMesh.position.z : (dMesh.position.z + offL);
                                    pane.position.set(pX, dMesh.position.y + offY, pZ);
                                    pane.renderOrder = 2;
                                    grp.add(pane);
                                    // A thin frame ring around the pane (uses door color).
                                    const frameMat = new THREE.MeshLambertMaterial({ color: dObj.c || '#5a3a22' });
                                    const fT = 0.03;
                                    const ring = [];
                                    if (isH) {
                                        ring.push([wWide + fT*2, fT, wZ + 0.02, 0,  wTall/2]);
                                        ring.push([wWide + fT*2, fT, wZ + 0.02, 0, -wTall/2]);
                                        ring.push([fT, wTall, wZ + 0.02,  wWide/2, 0]);
                                        ring.push([fT, wTall, wZ + 0.02, -wWide/2, 0]);
                                    } else {
                                        ring.push([wX + 0.02, fT, wWide + fT*2, 0,  wTall/2]);
                                        ring.push([wX + 0.02, fT, wWide + fT*2, 0, -wTall/2]);
                                        ring.push([wX + 0.02, wTall, fT, 0, 0, wWide/2]);
                                        ring.push([wX + 0.02, wTall, fT, 0, 0, -wWide/2]);
                                    }
                                    ring.forEach(seg => {
                                        const fb = new THREE.Mesh(new THREE.BoxGeometry(seg[0], seg[1], seg[2]), frameMat);
                                        fb.position.set(pX + (seg[3] || 0), dMesh.position.y + offY + (seg[4] || 0), pZ + (seg[5] || 0));
                                        grp.add(fb);
                                    });
                                }
                                // Door hardware: handle on the latch side (the
                                // side opposite the hinge), on BOTH faces. Push the
                                // hardware out along the face normal. Handle style:
                                // 'knob' (sphere) or 'lever' (small bar). Optional
                                // push-plate (a flat plate, on the push side) and a
                                // kickplate (bottom metal strip).
                                const handleStyle = md.doorHandle || 'lever';
                                const latchSign = (md.dir === 0 || md.dir === 2) ? 1 : -1;  // opposite hinge
                                const handleL = latchSign * (longHalf - 0.08);
                                const handleY = dMesh.position.y - dh * 0.02;
                                const metalMat = (typeof THREE.MeshStandardMaterial === 'function') ? new THREE.MeshStandardMaterial({ color: 0xcdd2d8, metalness: 0.7, roughness: 0.35 }) : new THREE.MeshLambertMaterial({ color: 0xcdd2d8 });
                                const placeOnFaces = (mkMesh) => {
                                    [faceOffset, -faceOffset].forEach(fo => {
                                        const mh = mkMesh();
                                        const hx = isH ? (dMesh.position.x + handleL) : (dMesh.position.x + fo);
                                        const hz = isH ? (dMesh.position.z + fo) : (dMesh.position.z + handleL);
                                        mh.position.set(hx, handleY, hz);
                                        grp.add(mh);
                                    });
                                };
                                if (handleStyle === 'knob') {
                                    placeOnFaces(() => new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), metalMat));
                                } else { // lever
                                    placeOnFaces(() => {
                                        const lever = new THREE.Mesh(new THREE.BoxGeometry(isH ? 0.16 : 0.05, 0.035, isH ? 0.05 : 0.16), metalMat);
                                        return lever;
                                    });
                                }
                                // Push plate (optional) — a flat rectangle on the latch
                                // side, slightly above mid-height, both faces.
                                if (md.doorPushPlate) {
                                    [faceOffset, -faceOffset].forEach(fo => {
                                        const plate = new THREE.Mesh(
                                            isH ? new THREE.BoxGeometry(0.12, 0.4, 0.01) : new THREE.BoxGeometry(0.01, 0.4, 0.12),
                                            metalMat
                                        );
                                        const hx = isH ? (dMesh.position.x + handleL) : (dMesh.position.x + fo);
                                        const hz = isH ? (dMesh.position.z + fo) : (dMesh.position.z + handleL);
                                        plate.position.set(hx, dMesh.position.y + 0.05, hz);
                                        grp.add(plate);
                                    });
                                }
                                // Kickplate (optional) — a metal strip across the
                                // bottom of the door, both faces.
                                if (md.doorKickPlate) {
                                    [faceOffset, -faceOffset].forEach(fo => {
                                        const kick = new THREE.Mesh(
                                            isH ? new THREE.BoxGeometry(wX * 0.92, 0.18, 0.012) : new THREE.BoxGeometry(0.012, 0.18, wZ * 0.92),
                                            metalMat
                                        );
                                        const kx = isH ? dMesh.position.x : (dMesh.position.x + fo);
                                        const kz = isH ? (dMesh.position.z + fo) : dMesh.position.z;
                                        kick.position.set(kx, (doorCY - dh / 2) + 0.12 + gap, kz);
                                        grp.add(kick);
                                    });
                                }
                            }
                            if (gap > 0) {
                                // Faint warm light-spill strip across the slit (additive,
                                // double-sided so it shows from both rooms).
                                const strip = new THREE.Mesh(
                                    new THREE.PlaneGeometry(wX * 0.92, gap * 0.8),
                                    new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
                                );
                                strip.position.set(dMesh.position.x, gap / 2, dMesh.position.z + 0.001);
                                if (!isH) strip.rotation.y = Math.PI / 2;
                                grp.add(strip);
                            }
                            scene.add(grp); m.visible = false;
                            doorObjects.push({ x: x, z: z, f: flr, dir: dStr, grp: grp, isH: isH, isOpen: false, baseRot: grp.rotation.y, baseP: grp.position.clone() });
                        }
                    }

                    // (rY isn't currently used downstream — left for attachments that may need it.)
                    const rY = isH ? 0 : Math.PI / 2;

                    // ── WALL ATTACHMENTS ──
                    // Posters, switches, sconces, mirrors, signs, plumbing
                    // (sinks/urinals/towels), and neon (text + stripes).
                    // Each gets snapped to the wall surface with a tiny inset
                    // so it doesn't z-fight, and offset along the wall by the
                    // editor-controlled `att.offset` / `att.offsetY` values.
                    //
                    // To add a new attachment kind: add another `if (att.v === ...)`
                    // branch here that creates `aM`, then expose the variant
                    // in mapster.html so the editor can place it.
                    if (dObj.meta?.attachments) {
                        dObj.meta.attachments.forEach(att => {
                            let offX = isH ? att.offset : 0; let offZ = isH ? 0 : att.offset; let aM = null;
                            if (att.v === 'switch') {
                                // a clearly-readable wall switch — a
                                // cream backplate with a bright toggle nub, sized up
                                // from the old tiny white box so it's obvious on the
                                // wall. (The tutorial-only attention sparkle is added
                                // by the map via att.sparkle — see buildSneak/jump.)
                                aM = new THREE.Group();
                                const plate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, 0.06), new THREE.MeshLambertMaterial({ color: '#efe9d8' }));
                                aM.add(plate);
                                const nub = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.1), new THREE.MeshBasicMaterial({ color: att.color || '#ffd23f' }));
                                nub.position.set(0, -0.04, 0.05); aM.add(nub);
                                if (att.sparkle) {
                                    const spk = makeSparkle(att.sparkleColor || '#fff6a8');
                                    spk.position.set(0, 0.05, 0.25); aM.add(spk);
                                    sparkleObjects.push({ grp: spk, t: Math.random() * 3 });
                                }
                            }
                            if (att.v === 'poster') {
                                // new#6: if a custom poster image was uploaded in
                                // Mapster (att.posterImage data-URL), texture the
                                // plane with it; otherwise a flat color placeholder.
                                let pmat;
                                if (att.posterImage) {
                                    const ptex = new THREE.TextureLoader().load(att.posterImage);
                                    if ('colorSpace' in ptex && THREE.SRGBColorSpace) ptex.colorSpace = THREE.SRGBColorSpace;
                                    pmat = new THREE.MeshBasicMaterial({ map: ptex });
                                } else if (att.posterTitle) {
                                    // A TEXT poster naming the film ("NOW PLAYING" + the
                                    // word-wrapped title) — used by the Skyline tutorial so
                                    // posters read which movie is in each auditorium. Just
                                    // the title as text (no copyrighted artwork).
                                    const pc = document.createElement('canvas'); pc.width = 256; pc.height = 384;
                                    const g2 = pc.getContext('2d');
                                    g2.fillStyle = att.color || '#5b2333'; g2.fillRect(0, 0, 256, 384);
                                    g2.strokeStyle = 'rgba(255,255,255,0.45)'; g2.lineWidth = 7; g2.strokeRect(10, 10, 236, 364);
                                    g2.textAlign = 'center';
                                    g2.fillStyle = '#ffe08a'; g2.font = 'bold 22px Georgia, "Times New Roman", serif';
                                    g2.fillText('NOW PLAYING', 128, 50);
                                    g2.fillStyle = '#ffffff'; g2.font = 'bold 27px Georgia, "Times New Roman", serif';
                                    // simple word-wrap, centered, max 5 lines
                                    const words = String(att.posterTitle).split(' '); let line = '', y = 150; const lines = [];
                                    for (const w of words) { const t = line ? line + ' ' + w : w; if (g2.measureText(t).width > 224 && line) { lines.push(line); line = w; } else line = t; }
                                    if (line) lines.push(line);
                                    lines.slice(0, 5).forEach((ln, i) => g2.fillText(ln, 128, y + i * 34));
                                    if (att.posterVenue) { g2.fillStyle = '#ffe08a'; g2.font = 'italic 16px Georgia, serif'; g2.fillText('\u2014 ' + att.posterVenue + ' \u2014', 128, 350); }
                                    const ptex = new THREE.CanvasTexture(pc);
                                    if ('colorSpace' in ptex && THREE.SRGBColorSpace) ptex.colorSpace = THREE.SRGBColorSpace;
                                    pmat = new THREE.MeshBasicMaterial({ map: ptex });
                                } else {
                                    pmat = new THREE.MeshBasicMaterial({ color: att.color });
                                }
                                aM = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), pmat);
                            }
                            if (att.v === 'mirror' || att.v === 'mirror_full') {
                                // a genuinely reflective mirror. A CubeCamera
                                // renders the whole scene from the mirror's POV into
                                // a cube render target each frame; the target's
                                // texture is used as the material's envMap. For r128
                                // we keep the RT simple (no mipmaps — mipmapped cube
                                // RTs can render black) and use a fully reflective
                                // metal material so the reflection is obvious.
                                const cubeRT = new THREE.WebGLCubeRenderTarget(512, {
                                    format: THREE.RGBAFormat,
                                    generateMipmaps: false,
                                    minFilter: THREE.LinearFilter,
                                    magFilter: THREE.LinearFilter
                                });
                                // #15: canonical r128 chrome mirror. Set the cube map's
                                // mapping explicitly, use a plain MeshBasicMaterial whose
                                // envMap IS the live reflection (default MultiplyOperation +
                                // reflectivity 1 on white = pure reflection), and make it
                                // DOUBLE-SIDED so it reflects even if the plane ends up
                                // facing slightly into the wall (the old single-sided plane
                                // showed its culled black back — the "black rectangle").
                                cubeRT.texture.mapping = THREE.CubeReflectionMapping;
                                const mMat = new THREE.MeshBasicMaterial({
                                    envMap: cubeRT.texture, color: 0xffffff, side: THREE.DoubleSide,
                                });
                                mMat.needsUpdate = true;
                                aM = new THREE.Mesh(new THREE.PlaneGeometry(0.8, att.v === 'mirror_full' ? 1.8 : 0.8), mMat);
                                const mCam = new THREE.CubeCamera(0.1, 100, cubeRT);
                                aM.add(mCam);
                                mirrorCams.push({ cam: mCam, mesh: aM, primed: false });
                            }
                            if (att.v === 'sink') { aM = new THREE.Group(); const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.4), new THREE.MeshLambertMaterial({ color: att.color })); aM.add(bowl); }
                            if (att.v === 'urinal') { aM = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.3), new THREE.MeshLambertMaterial({ color: att.color })); }
                            if (att.v === 'towel') { aM = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.2), new THREE.MeshLambertMaterial({ color: att.color })); }
                            if (att.v === 'neon_text') {
                                // neon text sign that reads as a glowing tube in
                                // the chosen color. Dark backing plate, text drawn
                                // in the neon color with a strong bloom on the canvas,
                                // plus an additive halo and a saturated point light.
                                aM = new THREE.Group();
                                const bMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.04), new THREE.MeshBasicMaterial({ color: '#0a0a0a' }));
                                const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const ct = cv.getContext('2d');
                                ct.fillStyle = '#080808'; ct.fillRect(0, 0, 128, 64);
                                ct.font = 'bold 50px monospace'; ct.textAlign = 'center'; ct.textBaseline = 'middle';
                                // outer bloom pass
                                ct.shadowColor = att.color; ct.shadowBlur = 22; ct.fillStyle = att.color; ct.fillText(att.neonText || '00', 64, 36);
                                // hot inner pass (whiter core)
                                ct.shadowBlur = 6; ct.fillStyle = '#ffffff'; ct.globalAlpha = 0.55; ct.fillText(att.neonText || '00', 64, 36); ct.globalAlpha = 1;
                                const tex = new THREE.CanvasTexture(cv);
                                const tMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.32), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
                                tMesh.position.z = 0.026; aM.add(bMesh); aM.add(tMesh);
                                addNeonHalo(aM, att.color, 0.9);
                                const nl = lightingManager.addLight(aM, att.color, (att.intensity || 1) * 1.6, 8, att, new THREE.Vector3(0, 0, 0.35));
                                neonFlickers.push({ light: nl, base: (att.intensity || 1) * 1.6 });
                            }
                            if (att.v === 'sconce') { aM = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.2), new THREE.MeshLambertMaterial({ color: '#444' })); lightingManager.addLight(aM, att.color, att.intensity, 8, att, new THREE.Vector3(0, 0, 0.15)); }
                            if (att.v === 'neon' || att.v === 'neon_num') {
                                // a plain neon tube/bar (or number) — a glowing
                                // rod in the chosen color with a halo + neon light.
                                aM = new THREE.Group();
                                const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), neonMaterial(att.color));
                                tube.rotation.z = Math.PI / 2; aM.add(tube);
                                addNeonHalo(aM, att.color, 1.0);
                                const nl = lightingManager.addLight(aM, att.color, (att.intensity || 1) * 1.6, 8, att, new THREE.Vector3(0, 0, 0.35));
                                neonFlickers.push({ light: nl, base: (att.intensity || 1) * 1.6 });
                            }
                            if (att.v === 'neon_stripe') {
                                // multi-row neon stripes — each tube glows in the
                                // chosen color, with a shared halo + neon light.
                                aM = new THREE.Group(); let count = att.stripeCount || 1; let orient = att.orientation || 'h';
                                for (let i = 0; i < count; i++) {
                                    let nMesh;
                                    if (orient === 'h') { nMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), neonMaterial(att.color)); nMesh.position.y = (i - (count - 1) / 2) * 0.15; }
                                    else { nMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.05), neonMaterial(att.color)); nMesh.position.x = (i - (count - 1) / 2) * 0.15; }
                                    aM.add(nMesh);
                                }
                                addNeonHalo(aM, att.color, 1.1);
                                const nl = lightingManager.addLight(aM, att.color, (att.intensity || 1) * 1.6, 8, att, new THREE.Vector3(0, 0, 0.35));
                                neonFlickers.push({ light: nl, base: (att.intensity || 1) * 1.6 });
                            }
                            if (att.v === 'register') { aM = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), new THREE.MeshLambertMaterial({ color: att.color })); }

                            // Now place the attachment. Most types get a tiny extra inset
                            // so they don't z-fight with the wall plane behind them.
                            if (aM) {
                                // #18: tag the attachment with its floor so applyFloorVisibility()
                                // can hide it when the player is BELOW it. Without this, posters
                                // (and other wall attachments) had no userData.f and were skipped
                                // by the cull — so e.g. the upper projection-booth posters showed
                                // through from the ground floor.
                                aM.userData = aM.userData || {}; aM.userData.f = flr;
                                const isNeon = (att.v === 'neon' || att.v === 'neon_text' || att.v === 'neon_stripe');
                                if (isNeon && att.topMount) {
                                    // project the neon OUT from the wall's top
                                    // EDGE (near its highest point), like a
                                    // protruding sign, toward the chosen side —
                                    // not standing it up above the wall. The sign
                                    // keeps its flush facing but is lifted to the
                                    // top and pushed out along the wall normal.
                                    const side = att.topMountSide || 'front';
                                    // Wall normal points into the room on the side
                                    // the attachment sits; flip for 'back'.
                                    const nx = isH ? 0 : (oX > 0 ? 1 : -1);
                                    const nz = isH ? (oZ > 0 ? 1 : -1) : 0;
                                    const out = 0.32;   // how far it protrudes
                                    const topY = fY + FLR_H - 0.25;   // near the wall's top
                                    const sgn = (side === 'back') ? -1 : 1;
                                    aM.position.set(
                                        x + oX + offX + nx * out * sgn,
                                        topY,
                                        z + oZ + offZ + nz * out * sgn
                                    );
                                    aM.rotation.y = rY;
                                    if (side === 'both') {
                                        aM.traverse(o => { if (o.material && 'side' in o.material) o.material.side = THREE.DoubleSide; });
                                        // also place a mirrored copy out the back
                                        const back = aM.clone();
                                        back.position.set(x + oX + offX - nx * out, topY, z + oZ + offZ - nz * out);
                                        scene.add(back); wallMeshes.push(back);
                                    }
                                    scene.add(aM); wallMeshes.push(aM);
                                    if (dObj.meta.text) {
                                        let cMeta = JSON.parse(JSON.stringify(dObj.meta));
                                        interactables.push({ x: x, z: z, f: flr, dir: dStr, type: att.v, data: dObj, obj: { meta: cMeta }, mesh: aM });
                                    }
                                    return;   // skip the normal flush placement below
                                }
                                aM.position.set(x + oX + offX, fY + FLR_H / 2 + (att.offsetY || 0), z + oZ + offZ);
                                aM.rotation.y = rY;
                                if (att.v === 'poster') {
                                    aM.position.x += isH ? 0 : (oX > 0 ? -0.08 : 0.08); aM.position.z += isH ? (oZ > 0 ? -0.08 : 0.08) : 0;
                                    if (att.crookedAngle) aM.rotation.z = -att.crookedAngle * (Math.PI / 180);
                                    if (att.backlit) { const bL = new THREE.PointLight(att.color, 0.5, 3); bL.position.copy(aM.position); scene.add(bL); }
                                }
                                if (att.v === 'mirror' || att.v === 'mirror_full') { aM.position.x += isH ? 0 : (oX > 0 ? -0.06 : 0.06); aM.position.z += isH ? (oZ > 0 ? -0.06 : 0.06) : 0; }
                                if (att.v === 'switch') { aM.position.x += isH ? 0 : (oX > 0 ? -0.05 : 0.05); aM.position.z += isH ? (oZ > 0 ? -0.05 : 0.05) : 0; }
                                if (att.v === 'sconce' || att.v === 'neon_text' || att.v === 'neon_stripe') { aM.position.x += isH ? 0 : (oX > 0 ? -0.08 : 0.08); aM.position.z += isH ? (oZ > 0 ? -0.08 : 0.08) : 0; }

                                scene.add(aM);
                                // Attachments are interactable if the parent wall has dialogue text,
                                // OR if they're a light switch (toggles via linkId).
                                if (dObj.meta.text || att.v === 'switch') {
                                    let combinedMeta = JSON.parse(JSON.stringify(dObj.meta));
                                    // M#5: a wall switch's linkId/intensity live on the ATTACHMENT
                                    // (att), not the wall. Copy them onto the interactable's meta so
                                    // toggling actually drives the right light network (the wall's
                                    // meta had no linkId, so switches did nothing).
                                    if (att.v === 'switch') {
                                        combinedMeta.linkId = att.linkId || 'main';
                                        combinedMeta.intensity = (att.intensity != null) ? att.intensity : 1;
                                    }
                                    interactables.push({ x: x, z: z, f: flr, dir: dStr, type: att.v, data: dObj, obj: { meta: combinedMeta }, mesh: aM });
                                }
                            }
                        });
                    }

                    // Counters and vault-able / read-able walls also become interactable.
                    if (isCounter || dObj.meta?.jumpable || dObj.meta?.text) interactables.push({ x: x, z: z, f: flr, dir: dStr, obj: dObj, mesh: m });
                };

                // Build all four cardinal edges. (Diagonals d1/d2 are stored
                // as cell properties — see buildDiag below — not as cell.o.)
                buildEdge(cell.n, 'n'); buildEdge(cell.s, 's'); buildEdge(cell.e, 'e'); buildEdge(cell.w, 'w');

                // ── DIAGONAL WALLS (cell.d1, cell.d2) ────────────────────
                // Mapster stores these as separate cell properties (d1 = NW-SE,
                // d2 = NE-SW). The engine used to expect them as `cell.o` of
                // variant `solid_diag1`/`solid_diag2`, which meant diagonals
                // painted in Mapster never rendered at all (including glass
                // diagonals). Render them here.
                //
                // Glass detection: if dObj.v contains 'glass' or the obj has
                // meta.glass === true, draw transparent. Otherwise opaque slab.
                const buildDiag = (dObj, kind) => {
                    if (!dObj) return;
                    const isGlass = (dObj.v && /glass|window/i.test(dObj.v)) || !!dObj.meta?.glass;
                    let mat;
                    if (isGlass) {
                        mat = new THREE.MeshLambertMaterial({
                            color: dObj.c || '#ddeeff',
                            transparent: true,
                            opacity: 0.35,   // always see-through (see note in cardinal glass above)
                            depthWrite: false,
                        });
                        if (dObj.meta?.paintData) {
                            const img = new Image(); img.src = dObj.meta.paintData;
                            const t = new THREE.Texture(img); t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
                            mat.map = t;
                        }
                    } else {
                        let mapTex = null;
                        const variant = dObj.v || 'solid_diag1';
                        if (typeof WallTextures !== 'undefined' && WallTextures[variant]) {
                            const c = document.createElement('canvas'); c.width = 64; c.height = 64;
                            const ctx = c.getContext('2d');
                            WallTextures[variant](ctx, dObj.c, dObj.ac, 64);
                            const tex = new THREE.CanvasTexture(c);
                            tex.magFilter = THREE.NearestFilter; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                            mapTex = tex;
                        } else {
                            const c = document.createElement('canvas'); c.width = 64; c.height = 64;
                            const ctx = c.getContext('2d');
                            ctx.fillStyle = dObj.c || '#888'; ctx.fillRect(0, 0, 64, 64);
                            mapTex = new THREE.CanvasTexture(c);
                        }
                        mat = new THREE.MeshLambertMaterial({ map: mapTex });
                    }
                    // a diagonal COUNTER must be waist-high like a cardinal
                    // counter (0.6), not a floor-to-ceiling wall, and gets a thin
                    // top slab so it connects cleanly with adjacent counters.
                    const isDiagCounter = (dObj.v === 'counter' || dObj.v === 'counter_door');
                    const diagH = isDiagCounter ? 0.6 : FLR_H;
                    const diagY = isDiagCounter ? 0.3 : FLR_H / 2;
                    // 1.414 = √2 — spans corner-to-corner of a 1×1 tile.
                    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.414, diagH, isDiagCounter ? 0.6 : 0.15), mat);
                    slab.position.set(x, fY + diagY, z);
                    slab.rotation.y = kind === 'd1' ? -Math.PI / 4 : Math.PI / 4;
                    slab.castShadow = (dObj.meta?.castShadow !== false) && !isGlass;
                    slab.receiveShadow = true;
                    slab.userData = { f: flr, isW: true, oOp: 1.0, diag: kind, glass: isGlass };
                    scene.add(slab); wallMeshes.push(slab);
                    if (isDiagCounter) {
                        // Counter top capping the diagonal body.
                        const topMat = new THREE.MeshLambertMaterial({ color: dObj.c });
                        const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.7), topMat);
                        top.position.set(x, fY + 0.62, z);
                        top.rotation.y = slab.rotation.y;
                        top.castShadow = slab.castShadow; top.receiveShadow = true;
                        scene.add(top); wallMeshes.push(top);
                    }
                };
                if (cell.d1) buildDiag(cell.d1, 'd1');
                if (cell.d2) buildDiag(cell.d2, 'd2');
            });
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // §5  PLAYER SETUP & UI LOGIC
    // ────────────────────────────────────────────────────────────────────────
    // Spawn the player at CONFIG.start, then wire up the on-screen overlays
    // (inventory, dialogue, gap prompt, message banner), the collision
    // detector, keyboard input, and the compass/minimap.
    //
    // Tunables in this section:
    //   - Player skin/cloth colors  : createHumanoid call (§5.1)
    //   - "Vaulted over!" text       : showMsg() calls in checkCollision (§5.3)
    //   - Gap-prompt button styling  : showGapPrompt() HTML in §5.2
    //   - Dialogue auto-dismiss time : setTimeout 4000 in space-bar handler (§5.4)
    //   - Door open/close animation  : interval(16ms × 15 frames ≈ 240ms) in §5.3/§5.4
    //   - Jump distance              : `jumpDist = 2` in doGapAction (§5.2)
    // ════════════════════════════════════════════════════════════════════════

    // ── §5.1  PLAYER SETUP ─────────────────────────────────────────────────
    let pX = CONFIG.start.x, pZ = CONFIG.start.z, pFlr = CONFIG.start.f;
    // #13b/#14: tiles the player has stood on (per floor), for "discoverable"
    // fog reveal and as the basis for flashlight-gated minimap reveal. Keyed
    // "flr,x,z". Marked in the animation loop as the player moves.
    const visitedTiles = new Set();
    const markVisited = (f, x, z) => { visitedTiles.add(f + ',' + x + ',' + z); };
    markVisited(pFlr, pX, pZ);
    // #10/#12: dress the player from their equipped clothing. window.playerContext
    // carries { worn, skin } when the full game embeds a map; fall back to the
    // classic cyan shirt for standalone preview.
    const _pc = (typeof window !== 'undefined' && window.playerContext) ? window.playerContext : {};
    const _pSkin = _pc.skin || '#ffccaa';
    const _pOutfit = (_pc.worn && typeof outfitFromWorn === 'function') ? outfitFromWorn(_pc.worn, _pSkin) : null;
    const player = createHumanoid(_pSkin, '#06b6d4', true, _pOutfit);
    player.position.set(pX, pFlr * FLR_H, pZ);
    scene.add(player);
    // STEALTH: snap the player back to spawn (used by the sneak tutorial on a
    // "spotted" event; reusable by any future fail-state). pX/pZ/pFlr are the
    // movement source of truth, so update them too — not just the mesh.
    window.engineRespawnAtStart = () => {
        pX = CONFIG.start.x; pZ = CONFIG.start.z; pFlr = CONFIG.start.f;
        player.position.set(pX, pFlr * FLR_H, pZ);
    };
    // the host minimap overlay reads the player's current tile from here.
    window.enginePlayerTile = () => ({ x: pX, z: pZ, f: pFlr, rot: tRot });
    // new#3: camera orientation for the host compass (rose rotation + tilt readout).
    window.__engineCamInfo = () => ({
        isoAngle: (camManager && camManager.isoAngle) || 0,
        tilt: (camManager && camManager.getTiltInfo) ? camManager.getTiltInfo() : null,
    });
    // is the player's current tile OUTDOORS? (no ceiling on this floor and no
    // floor above it). The host uses this for the Indoors/Outdoors indicator.
    window.enginePlayerOutdoors = () => {
        try {
            // A black/white background is an interior "void" map (the tutorial
            // rooms, the debug room): those only place ceiling LIGHTS here and
            // there, so the ceiling test below called most of their floor
            // "Outdoors". Treat them as indoors; sky/night/custom maps (a real
            // sky overhead) keep the per-tile ceiling test.
            const _bg = CONFIG.settings && CONFIG.settings.bgMode;
            if (_bg === 'black' || _bg === 'white') return false;
            const cell = MAP[pFlr] && MAP[pFlr][pZ] && MAP[pFlr][pZ][pX];
            if (!cell) return false;
            const ceilingAbove = !!cell.c || !!(MAP[pFlr + 1] && MAP[pFlr + 1][pZ] && MAP[pFlr + 1][pZ][pX] && MAP[pFlr + 1][pZ][pX].f);
            return !ceilingAbove;
        } catch (e) { return false; }
    };
    // STEALTH runtime hooks.
    //   engineToggleVisionCones(on) — show/hide all NPC cones (tutorial demo).
    //   engineSetCrouch(on)         — crouch-sneak: shrinks how far NPCs can see you.
    //   engineSetLightLevel(0..1)   — ambient light level; dark = smaller cones.
    window.engineToggleVisionCones = (on) => {
        npcs.forEach(n => { if (n.cone) n.cone.visible = !!on; });
    };
    window.engineSetCrouch = (on) => {
        window.__playerCrouching = !!on;
        // crouching = quieter. No NPC hearing exists YET; when it
        // does, multiply its radius by this. (The toggle message already says
        // "quieter", so the hook keeps that promise honest.)
        window.__crouchNoiseMul = on ? 0.5 : 1;
        // use a real crouch POSE (bent knees, lowered torso) via the rig,
        // and sink the whole player toward the floor — no vertical squashing.
        try {
            if (player) {
                if (player.userData && player.userData.setCrouched) player.userData.setCrouched(!!on);
                player.scale.y = 1;                 // never squash
                window.__crouchDrop = on ? 0.14 : 0; // applied to player.position.y in the anim loop
            }
        } catch (e) {}
    };
    window.engineSetLightLevel = (lvl) => { window.__lightLevel = Math.max(0, Math.min(1, lvl)); };
    const playerSpotlight = lightingManager.getPlayerLight();
    player.add(playerSpotlight); player.add(playerSpotlight.target);
    applyFloorFog(pFlr, pX, pZ);
    applyFloorVisibility();   // #7d: hide floors above the spawn floor

    // NPC STATS OVERLAY — a left-side panel that appears when the player
    // faces/interacts with an NPC, showing that NPC's stat sheet (meta.stats,
    // generated in Wave 3) plus name/age/clique. This is the 3D-view analogue
    // of the terminal UI's top-left NPC panel. Hidden until an NPC is in focus,
    // and cleared when the player turns away.
    const npcOverlay = document.createElement('div');
    npcOverlay.id = 'npc-stats-overlay';
    npcOverlay.style.cssText = [
        'position:absolute', 'left:14px', 'top:50%', 'transform:translateY(-50%)',
        'min-width:150px', 'max-width:190px', 'padding:10px 12px',
        'background:rgba(10,12,20,0.82)', 'border:1px solid #38bdf8',
        'border-radius:8px', 'color:#e2e8f0', 'font:12px/1.45 monospace',
        'box-shadow:0 2px 12px rgba(0,0,0,0.5)', 'z-index:40',
        'pointer-events:none', 'display:none', 'backdrop-filter:blur(2px)'
    ].join(';');
    container.appendChild(npcOverlay);

    const STAT_ROWS = [
        ['brawn', 'BRW'], ['reflexes', 'REF'], ['grit', 'GRT'],
        ['intelligence', 'INT'], ['savvy', 'SAV'], ['charm', 'CHM'], ['luck', 'LCK']
    ];
    let npcOverlayKey = null;   // identity of the NPC currently shown (avoid rebuilds)
    // when the engine is EMBEDDED in the game UI, the host renders the NPC's
    // info in the terminal NPC/REL panels, so we suppress the floating overlay
    // and instead push the faced NPC's info to the host via engineOnFocusNpc().
    // (In Mapster's standalone preview the floating box is still used.)
    function isEmbedded() {
        try { return !!document.getElementById('game-container') && container.clientWidth > 0 && container.clientWidth < window.innerWidth; }
        catch (e) { return false; }
    }
    function updateNpcOverlay(meta) {
        // always tell the host about the focus change (it decides what to do).
        try { if (typeof window.engineOnFocusNpc === 'function') window.engineOnFocusNpc(meta || null); } catch (e) {}
        // When embedded, the host UI owns NPC display — keep the floating box hidden.
        if (isEmbedded()) { if (npcOverlay.style.display !== 'none') npcOverlay.style.display = 'none'; return; }
        if (!meta) {
            if (npcOverlay.style.display !== 'none') { npcOverlay.style.display = 'none'; npcOverlayKey = null; }
            return;
        }
        const key = (meta.name || 'NPC') + '|' + (meta.npcClique || '') + '|' + JSON.stringify(meta.stats || {});
        if (key === npcOverlayKey) { npcOverlay.style.display = 'block'; return; }
        npcOverlayKey = key;
        const esc = (s) => String(s == null ? '' : s).replace(/[<&>]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]));
        let h = '<div style="font-weight:bold;color:#38bdf8;letter-spacing:1px;margin-bottom:2px">' + esc((meta.name || 'NPC').toUpperCase()) + '</div>';
        const sub = [];
        if (meta.npcAge) sub.push('age ' + esc(meta.npcAge));
        if (meta.npcClique) sub.push(esc(meta.npcClique));
        if (sub.length) h += '<div style="color:#94a3b8;font-size:10px;margin-bottom:6px">' + sub.join(' · ') + '</div>';
        h += '<div style="border-top:1px solid #1e293b;padding-top:6px">';
        if (meta.stats) {
            for (const [k, lbl] of STAT_ROWS) {
                const v = meta.stats[k];
                h += '<div style="display:flex;justify-content:space-between"><span style="color:#94a3b8">' + lbl + '</span><span style="color:#fcd34d;font-weight:bold">' + (v != null ? v : '?') + '</span></div>';
            }
        } else {
            h += '<div style="color:#64748b">(stats unknown)</div>';
        }
        h += '</div>';
        npcOverlay.innerHTML = h;
        npcOverlay.style.display = 'block';
    }
    // Expose to the host too, mirroring window.engineShowMsg.
    window.engineShowNpc = updateNpcOverlay;

    // Movement state machine:
    //   isMov  — currently lerping toward tPos
    //   isSit  — sat down (on bench/arcade stool); next move stands up
    //   isJump — mid-jump arc (overrides lerp; uses sin() Y-offset)
    let isMov = false, isSit = false, isJump = false, tPos = new THREE.Vector3(pX, pFlr * FLR_H, pZ), tRot = 0;
    // timestamp of the last movement step. A directional (forward) jump
    // only happens if the player is actively moving (a move key was pressed in
    // the last ~350ms); otherwise Space jumps in place.
    let lastMoveTime = 0;
    let jumpProgress = 0, jumpStartPos = new THREE.Vector3();
    let jumpStyle = 'vault';   // 'vault' | 'climb' (slow scramble) | 'recoil' (failed, pushed back) | 'falldown' (drop to a lower floor)
    let pendingDropFlr = -1;   // floor to land on AFTER a 'falldown' arc finishes (-1 = none)
    // STAIR/LADDER CLIMB: an animated traversal up/down between floors (replaces the
    // old fade-teleport). Stairs auto-trigger on walk-on (no prompt) and land you on
    // the tile OFF the top so it reads like real stairs; ladders trigger on SPACE.
    let isClimb = false, climbT = 0, climbVia = 'stairs', climbNewFlr = 0;
    let climbFrom = new THREE.Vector3(), climbTo = new THREE.Vector3();
    let climbLandX = 0, climbLandZ = 0, climbNoTrigger = false;
    let inventory = []; // list of key IDs the player has collected
    // glass shards left on the floor after a window shatters. Each entry:
    //   { x, z, f, mesh, damageMode, damageReqSkill, damageReqValue, damageAmt }
    // The player taking a step onto a shard tile may be cut (see shard damage
    // resolution in the movement code). damageMode: 'always'|'sometimes'|'never'|'check'.
    let glassShards = [];
    // notify the host of damage so the game UI/HP can react. The engine has
    // no HP of its own; it routes damage out and lets the host decide.
    function playerHurt(amount, reason) {
        try { if (typeof window.engineOnPlayerDamage === 'function') window.engineOnPlayerDamage(amount, reason || ''); } catch (e) {}
        if (window.playerContext && typeof window.playerContext.hp === 'number') {
            window.playerContext.hp = Math.max(0, window.playerContext.hp - amount);
        }
    }
    window.enginePlayerHurt = playerHurt;
    // drop a little cluster of glass shards on a floor tile and record it so
    // stepping there can cut the player. No-ops if the tile has no floor.
    function spawnGlassShards(x, z, f, srcMeta) {
        if (x == null || z == null) return;
        if (!MAP[f] || !MAP[f][z] || !MAP[f][z][x] || !MAP[f][z][x].f) return;
        if (glassShards.some(s => s.x === x && s.z === z && s.f === f)) return;  // already shards here
        const grp = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xbfe7ff, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.1 });
        for (let i = 0; i < 7; i++) {
            const s = 0.06 + Math.random() * 0.12;
            const sh = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.6, 3), mat);
            sh.position.set(x + (Math.random() - 0.5) * 0.7, 0.03, z + (Math.random() - 0.5) * 0.7);
            sh.rotation.set(Math.PI / 2 + (Math.random() - 0.5), Math.random() * 6.28, 0);
            grp.add(sh);
        }
        scene.add(grp);
        glassShards.push({
            x, z, f, mesh: grp,
            damageMode: (srcMeta && srcMeta.shardDamageMode) || 'sometimes',
            damageReqSkill: (srcMeta && srcMeta.shardDamageReqSkill) || 'dodge',
            damageReqValue: (srcMeta && srcMeta.shardDamageReqValue != null) ? srcMeta.shardDamageReqValue : 5,
            damageAmt: (srcMeta && srcMeta.shardDamageAmt != null) ? +srcMeta.shardDamageAmt : 1,
        });
    }
    window.engineSpawnGlassShards = spawnGlassShards;
    // resolve whether stepping onto a shard tile cuts the player.
    function resolveShardDamage(shard) {
        const mode = shard.damageMode || 'sometimes';
        if (mode === 'never') return 0;
        if (mode === 'always') return shard.damageAmt;
        if (mode === 'sometimes') return (Math.random() < 0.5) ? shard.damageAmt : 0;
        if (mode === 'check') {
            // A passing skill check = you pick your way through unscathed.
            const r = resolveSkillCheck(shard.damageReqSkill, shard.damageReqValue);
            return (r.outcome === 'pass') ? 0 : shard.damageAmt;
        }
        return 0;
    }

    // ── §5.2  UI HELPERS ───────────────────────────────────────────────────
    function updateInv() {
        const invEl = document.getElementById('inv');
        if (invEl) invEl.innerText = 'Keys: ' + (inventory.length ? inventory.join(', ') : 'None');
    }

    // showMsg: two modes —
    //   pos='overhead' + tgtMesh → 3D-anchored floating text above an object,
    //                              fades over ~2s while following the mesh
    //                              even as the camera moves.
    //   pos='bottom' (default)   → fixed-position banner near the top of screen
    //                              (uses the #msg div from the export template).
    function showMsg(txt, pos = 'bottom', tgtMesh = null, ms = 2000) {
        // #5 FIX: an NPC/object with textOffset 'global' (the default) must fall
        // back to the MAP's global Text Position setting. Previously 'global'
        // was passed straight through and never matched 'overhead', so the
        // "Overhead" choice did nothing and text always showed in the box.
        if (!pos || pos === 'global') {
            pos = (CONFIG && CONFIG.settings && CONFIG.settings.textPosition) || 'bottom';
        }
        // Normalize the global setting's value ('bottom' UI box vs 'overhead').
        if (pos === 'bottom-dialog' || pos === 'box') pos = 'bottom';
        if (pos === 'overhead' && tgtMesh) {
            const m = document.createElement('div');
            m.className = 'overhead-txt'; m.style.position = 'absolute'; m.style.color = '#fff'; m.style.textShadow = '1px 1px 0 #000'; m.style.pointerEvents = 'none'; m.innerText = txt;
            document.body.appendChild(m);
            // Keep projecting the world-pos to screen until the element is removed.
            const updatePos = () => {
                if (!m.isConnected) return;
                const p = tgtMesh.position.clone(); p.y += 1.5;
                if (camManager) p.project(camManager.activeCam); else p.project(fallbackCamera);
                const px = (p.x * .5 + .5) * window.innerWidth; const py = (p.y * -.5 + .5) * window.innerHeight;
                m.style.left = px + 'px'; m.style.top = py + 'px';
                requestAnimationFrame(updatePos);
            };
            updatePos();
            let life = 200; const fade = setInterval(() => { life--; if (life <= 0) { clearInterval(fade); m.remove(); } else { m.style.opacity = life / 200; } }, 10);
            return;
        }
        const m = document.getElementById('msg');
        // One hide-timer per box: every message used to schedule its OWN 2s hide,
        // so an earlier message's timer (e.g. the "you forgot the key" nudge)
        // could blank a NEWER message almost instantly ("You grab the key…"
        // never seemed to appear). Cancel the previous timer first.
        if (m) { m.innerHTML = txt; m.style.display = 'block'; if (m._hideTimer) clearTimeout(m._hideTimer); m._hideTimer = setTimeout(() => { m.style.display = 'none'; m._hideTimer = null; }, ms || 2000); }
    }
    // #14: a STICKY message that stays until the player dismisses it (next key or
    // click), used for poster descriptions / commentary that shouldn't blink away.
    function showStickyMsg(txt) {
        const m = document.getElementById('msg');
        if (!m) return;
        m.innerHTML = txt; m.style.display = 'block';
        if (m._hideTimer) { clearTimeout(m._hideTimer); m._hideTimer = null; }   // a pending showMsg() hide mustn't blank this
        if (m._stickyTimer) { clearTimeout(m._stickyTimer); m._stickyTimer = null; }
        const host = (typeof container !== 'undefined' && container) ? container : document;
        window.__posterMsgPaused = true;   // #9: freeze the world like dialogue while this is up
        const dismiss = (ev) => {
            // #9: consume the dismissing key/click so it ONLY closes the note (it
            // doesn't also step the player or trigger something behind it) — that's
            // how a paused dialogue feels.
            if (ev && ev.type === 'keydown') { try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {} }
            m.style.display = 'none';
            window.__posterMsgPaused = false;
            if (m._stickyTimer) { clearTimeout(m._stickyTimer); m._stickyTimer = null; }
            window.removeEventListener('keydown', dismiss, true);
            host.removeEventListener('click', dismiss, true);
        };
        // defer arming so the SAME keypress that opened it doesn't instantly close it
        setTimeout(() => { window.addEventListener('keydown', dismiss, true); host.addEventListener('click', dismiss, true); }, 60);
        m._stickyTimer = setTimeout(dismiss, 20000);   // safety auto-hide
    }
    // Expose for modular helpers (e.g. core/windowPainter.js) that need to
    // surface a quick message without importing the whole engine scope.
    window.engineShowMsg = showMsg;

    // ── #16: RUNTIME WORLD CONTROLS (driven by the debug room's World NPC) ───
    // Change weather, fog, and time-of-day live without rebuilding the map.
    window.engineSetWeather = (type) => {
        try {
            if (weatherManager && weatherManager.setWeatherType) {
                weatherManager.setWeatherType(type || 'none');
                // #12: a MANUAL weather change (debug room) must show right away. Normally
                // weatherSys.visible + pMaterial.opacity are only set by applyEnvironment's
                // outdoor/intensity pass (on floor changes), so a debug trigger left the
                // particles hidden/transparent. Force them on here, parked at the player.
                const on = !!(type && type !== 'none');
                if (weatherManager.weatherSys) {
                    weatherManager.weatherSys.visible = on;
                    if (on) weatherManager.weatherSys.position.set(pX, pFlr * FLR_H, pZ);
                }
                if (weatherManager.pMaterial) { weatherManager.pMaterial.opacity = on ? 0.9 : 0; weatherManager.pMaterial.needsUpdate = true; }
            }
        } catch (e) {}
    };
    window.engineSetFog = (opts) => {
        // opts: { enabled, color, density }  (density ~ 5..60)
        try {
            if (!scene) return;
            if (opts && opts.enabled) {
                scene.fog = new THREE.FogExp2(opts.color || '#222222', (opts.density != null ? opts.density : 20) / 250);
            } else {
                scene.fog = null;
            }
        } catch (e) {}
    };
    // Time of day 0..24 → tint the ambient/scene background for a quick day/night
    // feel. If LightingManager exposes a setter we use it; otherwise we tint the
    // renderer clear color + ambient light directly.
    window.engineSetTimeOfDay = (hour) => {
        try {
            const h = Math.max(0, Math.min(24, hour));
            if (lightingManager && typeof lightingManager.setTimeOfDay === 'function') { lightingManager.setTimeOfDay(h); return; }
            // Fallback: simple sky tint by hour (night → deep blue, day → light).
            const day = Math.max(0, Math.cos((h - 13) / 24 * Math.PI * 2)); // 0 at night, ~1 midday
            const r = Math.round(10 + day * 120), g = Math.round(12 + day * 140), b = Math.round(30 + day * 160);
            const col = (r << 16) | (g << 8) | b;
            if (renderer && renderer.setClearColor) renderer.setClearColor(col, 1);
            if (scene && scene.children) scene.children.forEach(o => { if (o.isAmbientLight) o.intensity = 0.25 + day * 0.75; });
        } catch (e) {}
    };

    if (window.DialogueRuntime) {
        window.DialogueRuntime.init({
            camManager: camManager,
            player: player,
            showError: (m) => showMsg(m),
            rootPrefix: '',   // preview uses <base href>; exports inline the JSON
        });
    }

    // executeWarp: fade to black, then either swap location.href (cross-map
    // warp via warpMap URL) or teleport pX/pZ/pFlr in-place.
    // The 500ms fade matches the CSS transition on the #fade overlay.
    // A warp only TELEPORTS if it actually names a destination. Fast-travel
    // 'warp_point' markers (directory targets) carry no warpX/Y/Map, so
    // stepping on one must NOT warp the player to (0,0) — that was the rogue
    // teleport into the empty corner. Real warps (with coords/map) still fire.
    function warpHasDest(m) { return !!(m && (m.warpMap || m.warpX != null || m.warpY != null)); }
    function executeWarp(m) {
        // a portal set to 'minigame' opens that minigame instead of moving
        // the player. The host exposes window.openMinigame (the full game); in a
        // standalone Mapster preview we fall back to navigating to the path.
        if (m.portalAction === 'minigame' && m.portalMinigame) {
            if (typeof window.openMinigame === 'function') { window.openMinigame(m.portalMinigame); }
            else { const fe = document.getElementById('fade'); if (fe) { fe.style.opacity = 1; } setTimeout(() => window.location.href = m.portalMinigame, 400); }
            return;
        }
        const fadeEl = document.getElementById('fade');
        if (m.warpMap) {
            if (fadeEl) { fadeEl.style.opacity = 1; setTimeout(() => window.location.href = m.warpMap, 500); }
            else window.location.href = m.warpMap;
            return;
        }
        // in-place warps used to REQUIRE a #fade element — the embedded
        // game doesn't have one, so fast-travel silently did nothing. The move now
        // always happens; the fade is just a nicety when the host provides one.
        const doMove = () => {
            pX = m.warpX || 0; pZ = m.warpY || 0; pFlr = m.warpF || 0; tPos.set(pX, pFlr * FLR_H, pZ);
            player.position.copy(tPos); applyFloorFog(pFlr, pX, pZ); applyFloorVisibility(); isMov = false;
            if (fadeEl) fadeEl.style.opacity = 0;
        };
        if (fadeEl) { fadeEl.style.opacity = 1; setTimeout(doMove, 500); }
        else doMove();
    }
    // fast-travel to a named warp point (used by the directory). Reuses the
    // in-place warp path so the fade + fog refresh are consistent.
    function fastTravelTo(wp) {
        if (!wp) return;
        executeWarp({ warpX: wp.x, warpY: wp.z, warpF: wp.f });
    }
    window.engineWarpPoints = () => warpPoints.filter(w => w.fastTravel);
    window.engineFastTravel = (i) => { const ft = warpPoints.filter(w => w.fastTravel); if (ft[i]) fastTravelTo(ft[i]); };

    // Gap-prompt: triggered by checkCollision() when the player tries to walk
    // onto a tile with no floor AND CONFIG.settings.allowEmptyWalk is false.
    // The four buttons all dispatch to window.doGapAction(...) below.
    //
    // Focus handling: each button blurs itself before calling the action so
    // when the modal is removed, no detached node holds focus. After the
    // action runs we also force focus back to window, which makes the
    // keydown listener resume firing on every browser tested.
    let gapPromptActive = false;
    // M#4: walking onto a pickup item (a key, or any object flagged meta.pickup)
    // pops a small "pick it up?" prompt. These track the prompt + the tile the
    // player declined on (so a decline doesn't immediately re-prompt; stepping
    // away and back asks again).
    let pickupPromptActive = false;
    let _pickupDeclinedTile = '';
    let mmPeek = null;   // minimap floor-peek override (null = follow player)

    // change floors via a ladder/stairs/jump with a clear on-screen
    // MESSAGE so it no longer feels like an unannounced teleport. Bumps the floor,
    // clears any minimap peek, fades, and reapplies the per-floor fog.
    // for a ladder/stairs tile at (x,z) on floor `flr`, which floor
    // does it connect to? Prefer a floor that has a MATCHING ladder/stairs tile at
    // the same (x,z) — above first, then below — so a stacked shaft is followed
    // correctly; otherwise fall back to up-if-possible, else down. Returns -1 if
    // there is nowhere to go. (HOW TO MODIFY: for one-way chutes, special-case here.)
    function floorTargetFrom(flr, x, z) {
      const has = (f) => { const o = MAP[f] && MAP[f][z] && MAP[f][z][x] && MAP[f][z][x].o; return !!o && (o.v === 'ladder' || o.v === 'stairs'); };
      if (flr + 1 < MAP.length && has(flr + 1)) return flr + 1;
      if (flr - 1 >= 0 && has(flr - 1)) return flr - 1;
      if (flr + 1 < MAP.length) return flr + 1;
      if (flr - 1 >= 0) return flr - 1;
      return -1;
    }

    // Where you END UP after taking stairs: one tile OFF the top (in the climb
    // direction) onto a normal floor tile if there is one — so a single flight
    // connects to the floor above "like stairs work", no second flight needed.
    // Falls back to the same tile (the classic both-floors placement still works).
    function computeStairLanding(x, z, fromF, toF, meta) {
      let dir = (meta && meta.stairDir) || 'n';
      if (toF < fromF) dir = { n: 's', s: 'n', e: 'w', w: 'e' }[dir];   // going down → step off the bottom
      const dx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0;
      const dz = dir === 's' ? 1 : dir === 'n' ? -1 : 0;
      const lx = x + dx, lz = z + dz;
      const c = MAP[toF] && MAP[toF][lz] && MAP[toF][lz][lx];
      if (c && c.f && !(c.o && (c.o.v === 'stairs'))) return { x: lx, z: lz };
      return { x: x, z: z };
    }

    // Begin an ANIMATED climb (stairs walk-up / ladder climb) to newFlr, ending on
    // (landX, landZ). Replaces the old instant fade in changeFloor for these.
    function startClimb(newFlr, via, landX, landZ) {
      newFlr = Math.max(0, Math.min(MAP.length - 1, newFlr));
      if (newFlr === pFlr || isClimb) return;
      isClimb = true; climbT = 0; climbVia = via; climbNewFlr = newFlr;
      climbLandX = landX; climbLandZ = landZ;
      climbFrom.copy(player.position);
      climbTo.set(landX, newFlr * FLR_H, landZ);
      isMov = false; gapPromptActive = false;
      try { playSnd('click'); } catch (e) {}
    }

    // Shared door OPEN/CLOSE animation. Both the walk-into path (checkCollision)
    // and the Space-bar path call this, so a lift-top counter door behaves the
    // SAME either way. Previously the two paths were copy-pasted and drifted: the
    // walk-into path treated a lift-top door as a horizontal SWING and never hid
    // the cabinet body, which is why counter doors clipped/looked wonky. Assumes
    // dObj.isOpen has already been toggled.
    function animateDoorOpen(dObj, edge, onDone) {
      // Door SFX (these went missing): swing doors & lift-top counters get a
      // "swing", sliding doors get a "slide". Play on every open/close toggle.
      try {
        if (dObj.liftTop || edge.v === 'door_swing' || edge.v === 'counter_door') playSnd('swing');
        else if (edge.v === 'door_slide') playSnd('slide');
        else playSnd('swing');
      } catch (e) {}
      // #11: the door takes TIME to open — the player must wait, they can't clip
      // through a half-open door (see checkCollision, which keeps the edge solid
      // until onDone fires). Open SPEED is the only thing abilities/hobbies tune:
      // window.__doorSpeedMul (>1 = faster, <1 = slower). Frame count scales with
      // it; everything else about the swing is unchanged.
      const spd = (typeof window !== 'undefined' && window.__doorSpeedMul) ? window.__doorSpeedMul : 1;
      const FR = Math.max(5, Math.round(15 / spd));
      dObj.animating = true;
      // Collect each motion as a tween; the anim loop advances them (see doorAnims
      // processing). `from` is captured now (current rotation/position); `target`
      // is read each frame (it's constant per open/close).
      const _tweens = [];
      const ease = (apply, get, set) => { _tweens.push({ set: set, target: apply, from: get() }); };
      if (dObj.liftTop) {
        // lift-top COUNTER door [#11]: the top flap (+ its cabinet face) hinges
        // STRAIGHT UP about the counter-run axis to near-vertical, exactly like a
        // real bar hatch — lifting clear of anyone at the counter instead of
        // swinging sideways into them. The cabinet body is hidden while open so
        // the tile is a clean walk-through gap. The free edge extends toward -Z
        // (isH) / -X (else); a POSITIVE x-rot (isH) / NEGATIVE z-rot (else) raises
        // it UP. No side-lean any more — that was what made it clip its neighbours.
        const axis = dObj.isH ? 'x' : 'z';
        const tgt = dObj.isOpen ? (dObj.isH ? 1.5 : -1.5) : 0;   // ~86° up, just shy of vertical
        if (dObj.counterBody) dObj.counterBody.visible = !dObj.isOpen;
        ease(() => tgt, () => dObj.grp.rotation[axis], v => { dObj.grp.rotation[axis] = v; });
      } else if (edge.v === 'door_swing' || edge.v === 'counter_door') {
        let tr = (edge.meta.dir === 0 || edge.meta.dir === 2) ? -Math.PI / 2 : Math.PI / 2;
        if (dObj.dir === 's' || dObj.dir === 'e') tr *= -1;
        const tgtR = dObj.baseRot + (dObj.isOpen ? tr : 0);
        ease(() => tgtR, () => dObj.grp.rotation.y, v => { dObj.grp.rotation.y = v; });
      } else if (edge.v === 'door_slide') {
        const t = (edge.meta.dir === 0) ? -0.9 : 0.9;
        const tgtX = dObj.isOpen ? (dObj.isH ? t : 0) : 0, tgtZ = dObj.isOpen ? (dObj.isH ? 0 : t) : 0;
        const baseP = dObj.grp.userData.baseP || dObj.grp.position.clone(); dObj.grp.userData.baseP = baseP;
        ease(() => baseP.x + tgtX, () => dObj.grp.position.x, v => { dObj.grp.position.x = v; });
        ease(() => baseP.z + tgtZ, () => dObj.grp.position.z, v => { dObj.grp.position.z = v; });
      }
      // queue the frame-driven swing (duration scales with FR / the speed mul)
      doorAnims.push({ dObj: dObj, tweens: _tweens, t: 0, dur: Math.max(0.08, FR / 60), onDone: onDone });
    }
    // ── M#4: WALK-ONTO PICKUP PROMPT ─────────────────────────────────────────
    // An object is a "pickup" if it's a key or carries meta.pickup. When the
    // player finishes a step onto such a tile, offer to take it (you can still
    // grab keys with SPACE while facing them — this is the extra convenience).
    function isPickupObj(o) { return !!(o && (o.v === 'key' || (o.meta && o.meta.pickup))); }

    // Find the live interactable for the pickup on the player's current tile
    // (skips ones already taken, where inter.x was set to -1).
    function pickupInterHere() {
        const cell = MAP[pFlr] && MAP[pFlr][pZ] && MAP[pFlr][pZ][pX];
        if (!cell || !isPickupObj(cell.o)) return null;
        return interactables.find(i => i.x === pX && i.z === pZ && i.f === pFlr && !i.dir && isPickupObj(i.obj)) || null;
    }

    // Actually take the item (shared with the SPACE-to-grab path).
    // #12: a human label for a pickup — names WHAT it is, not just its id.
    // "gold" (keyId) on a 'key' object reads as "gold key"; an explicit
    // meta.label wins; we avoid doubling when the id already says the kind.
    function pickupLabel(inter) {
        const o = inter.obj, m = o.meta || {};
        if (m.label) return m.label;
        const id = m.keyId || m.itemId || '';
        const kind = (o.v && o.v !== 'pickup' && o.v !== 'item') ? o.v : '';
        if (id && kind && !new RegExp(kind, 'i').test(id)) return id + ' ' + kind;
        return id || kind || 'item';
    }

    function doPickup(inter) {
        if (!inter) return;
        const grp = inter.grp || inter.mesh;
        const keyId = inter.obj.meta.keyId || inter.obj.meta.itemId || inter.obj.v;
        inventory.push(keyId);
        if (grp) grp.visible = false;
        inter.x = -1;
        const spk = grp && grp.userData && grp.userData.sparkle;
        if (spk) { spk.visible = false; if (spk.parent) spk.parent.remove(spk); const si = sparkleObjects.findIndex(s => s.grp === spk); if (si >= 0) sparkleObjects.splice(si, 1); }
        showMsg('Obtained: ' + pickupLabel(inter)); if (typeof updateInv === 'function') updateInv(); playSnd('click');
    }

    function closePickupPrompt() {
        try { if (window.setSceneWords) window.setSceneWords([]); } catch (e) {}   // #3 ticker
        const ui = document.getElementById('pickup-ui'); if (ui) ui.remove();
        window.__doPickupChoice = null;
        pickupPromptActive = false;
    }

    // Called at the end of a step. If a pickup is underfoot (and not just
    // declined on this same tile), pop the prompt.
    function maybePromptPickup() {
        const tileKey = pX + ',' + pZ + ',' + pFlr;
        if (_pickupDeclinedTile && _pickupDeclinedTile !== tileKey) _pickupDeclinedTile = '';   // moved away → allow asking again
        if (pickupPromptActive || _pickupDeclinedTile === tileKey) return;
        const inter = pickupInterHere();
        if (!inter) return;
        showPickupPrompt(inter);
    }

    // ── #13: EAVESDROPPING ───────────────────────────────────────────────────
    // A map tile can carry meta.eavesdropScript = [{who,text},...]. If the player
    // finishes a step on that tile while CROUCHED (sneaking, so the talkers don't
    // clam up), the scripted exchange is "overheard" line-by-line (Space to go on).
    // Standing on the spot instead gets a nudge to crouch. Each spot fires once.
    let eavesdropActive = false, _eaveScript = null, _eaveIdx = 0;
    function maybeEavesdrop() {
        if (eavesdropActive) return;
        // #8: only crouching triggers an overhear — but now anywhere WITHIN A SMALL
        // RADIUS of the scene works (ducking in front of the counter OR behind the
        // workers), not just standing on one exact tile. Scan the player's tile and
        // its neighbours for a tile carrying meta.eavesdropScript.
        if (!window.__playerCrouching) return;
        const R = 1;   // #15: must be RIGHT up on the scene (adjacent/at the counter), not across the room
        let script = null, fx = pX, fz = pZ;
        for (let dz = -R; dz <= R && !script; dz++) {
            for (let dx = -R; dx <= R; dx++) {
                const cz = pZ + dz, cx = pX + dx;
                const cell = MAP[pFlr] && MAP[pFlr][cz] && MAP[pFlr][cz][cx];
                const sc = cell && cell.o && cell.o.meta && cell.o.meta.eavesdropScript;
                if (sc && sc.length) { script = sc; fx = cx; fz = cz; break; }
            }
        }
        if (!script) return;
        const key = fx + ',' + fz + ',' + pFlr;
        // #15: REPEATABLE — re-triggers if it hasn't played in the last 60s (was once-ever).
        const now = Date.now();
        if (!window.__eavesHeardAt) window.__eavesHeardAt = {};
        if (window.__eavesHeardAt[key] && (now - window.__eavesHeardAt[key]) < 60000) return;
        window.__eavesHeardAt[key] = now;
        startEavesdrop(script);
        // (overhearing stays an easter egg — no built-in "crouch to listen" prompt.)
    }
    function startEavesdrop(script) {
        eavesdropActive = true; isMov = false; _eaveScript = script; _eaveIdx = 0;
        if (typeof activeKeys === 'object') for (const k in activeKeys) delete activeKeys[k];
        showEaveLine();
    }
    function showEaveLine() {
        const line = _eaveScript[_eaveIdx] || {};
        const esc = (s) => String(s == null ? '' : s).replace(/[<&>]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]));
        let ui = document.getElementById('eavesdrop-ui');
        if (!ui) {
            ui = document.createElement('div'); ui.id = 'eavesdrop-ui';
            // (c) MATCH the standard win95 dialogue panel (#dialogue) exactly — same
            // grey raised panel, border, shadow and font — so it reads as the same
            // modal. The ONLY difference is the title bar colour: a VIOLET gradient
            // (vs the normal blue) to signal the line is being OVERHEARD, not said to you.
            ui.style.cssText = "position:absolute;bottom:5%;left:50%;transform:translateX(-50%);min-width:320px;max-width:80%;background:#c0c0c0;color:#000;border:2px solid #dfdfdf;border-right-color:#404040;border-bottom-color:#404040;box-shadow:1px 1px 0 #000,2px 2px 7px rgba(0,0,0,0.45);padding:0;z-index:100;font:26px/1.45 'GrandeRetro','MS Sans Serif',Tahoma,sans-serif;";
            (typeof container !== 'undefined' && container ? container : document.body).appendChild(ui);
        }
        ui.style.display = 'block';
        ui.innerHTML =
            '<div class="dlg-title" style="background:linear-gradient(90deg,#3b0764,#7c3aed);color:#fff;font-weight:bold;padding:3px 7px;font-size:20px;letter-spacing:.3px;">\u25c8 OVERHEARD \u2014 ' + esc(line.who) + '</div>' +
            '<div class="dlg-body" style="padding:10px 14px;font-size:20px;line-height:1.3;font-style:italic;">\u201c' + esc(line.text) + '\u201d' +
            '<div style="text-align:right;margin-top:8px;font-style:normal;font-size:13px;color:#404040;">[G]</div></div>';
    }
    function advanceEavesdrop() {
        _eaveIdx++;
        if (!_eaveScript || _eaveIdx >= _eaveScript.length) { closeEavesdrop(); return; }
        showEaveLine();
    }
    function closeEavesdrop() {
        eavesdropActive = false;
        const ui = document.getElementById('eavesdrop-ui'); if (ui) ui.remove();
    }

    // ── #13: USHER DOORS ─────────────────────────────────────────────────────
    // A theatre ENTRANCE is a normal swing door carrying meta.usher. Trying to open
    // it swings the door OUT toward you, an usher speaks from the doorway asking for
    // a ticket you don't have, then the door swings shut again. Same sequential
    // shape as the eavesdrop, but in the STANDARD blue dialogue chrome (the usher is
    // talking TO you, not overheard). Customise per door via meta.usherName /
    // meta.usherLines (array of strings).
    let usherActive = false, _ushScript = null, _ushIdx = 0, _ushOnDone = null, _ushName = 'Usher';
    function startUsher(name, lines, onDone) {
        usherActive = true; isMov = false; _ushScript = lines || []; _ushIdx = 0; _ushOnDone = onDone || null; _ushName = name || 'Usher';
        if (typeof activeKeys === 'object') for (const k in activeKeys) delete activeKeys[k];
        showUsherLine();
    }
    function showUsherLine() {
        const text = _ushScript[_ushIdx] || '';
        const esc = (s) => String(s == null ? '' : s).replace(/[<&>]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]));
        let ui = document.getElementById('usher-ui');
        if (!ui) {
            ui = document.createElement('div'); ui.id = 'usher-ui';
            ui.style.cssText = "position:absolute;bottom:5%;left:50%;transform:translateX(-50%);min-width:320px;max-width:80%;background:#c0c0c0;color:#000;border:2px solid #dfdfdf;border-right-color:#404040;border-bottom-color:#404040;box-shadow:1px 1px 0 #000,2px 2px 7px rgba(0,0,0,0.45);padding:0;z-index:100;font:26px/1.45 'GrandeRetro','MS Sans Serif',Tahoma,sans-serif;";
            (typeof container !== 'undefined' && container ? container : document.body).appendChild(ui);
        }
        ui.style.display = 'block';
        ui.innerHTML =
            '<div class="dlg-title" style="background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font-weight:bold;padding:3px 7px;font-size:20px;">' + esc(_ushName) + '</div>' +
            '<div class="dlg-body" style="padding:10px 14px;font-size:20px;line-height:1.3;">' + esc(text) +
            '<div style="text-align:right;margin-top:8px;font-size:13px;color:#404040;">[G]</div></div>';
    }
    function advanceUsher() {
        _ushIdx++;
        if (!_ushScript || _ushIdx >= _ushScript.length) { closeUsher(); return; }
        showUsherLine();
    }
    function closeUsher() {
        usherActive = false;
        const ui = document.getElementById('usher-ui'); if (ui) ui.style.display = 'none';
        const cb = _ushOnDone; _ushOnDone = null; _ushScript = null;
        if (cb) try { cb(); } catch (e) {}
    }
    // Open the entrance door OUT toward the player, let the usher speak, then shut it.
    function triggerUsherDoor(dObj, edge) {
        if (dObj._usherBusy || usherActive) return true;
        dObj._usherBusy = true;
        const name = (edge.meta && edge.meta.usherName) || 'Usher';
        const lines = (edge.meta && edge.meta.usherLines) || [
            'Ticket, please.',
            '\u2026No ticket? Sorry, friend \u2014 no ticket, no entry. The box office is up front.',
        ];
        const finish = () => {
            if (dObj.isOpen) animateDoorOpen(dObj, edge, () => { dObj._usherBusy = false; });
            else dObj._usherBusy = false;
        };
        if (!dObj.isOpen) animateDoorOpen(dObj, edge, () => { startUsher(name, lines, finish); });
        else startUsher(name, lines, finish);
        return true;
    }

    // ── #7: CONCESSION SHOP ──────────────────────────────────────────────────
    // Talking to a meta.shop NPC opens this modal: pick an item with Up/Down, buy
    // with Enter/Space (deducts State.world.money), Esc closes. 1999 prices. To
    // edit the menu, change SHOP_ITEMS. Money is shown live here and on the
    // right-hand stats frame (game.js reads State.world.money).
    const SHOP_ITEMS = [
        { name: 'Small Popcorn',        price: 2.50 },
        { name: 'Medium Popcorn',       price: 3.50 },
        { name: 'Large Popcorn',        price: 4.50 },
        { name: 'Small Fountain Soda',  price: 2.00 },
        { name: 'Medium Fountain Soda', price: 3.00 },
        { name: 'Box of Candy',         price: 2.50 },
        { name: 'Hot Dog',              price: 3.00 },
        { name: 'Combo: Med Pop + Med Drink', price: 5.50 },
    ];
    let shopActive = false, _shopSel = 0, _shopTitle = 'Concession', _shopFlash = '';
    function openShop(title) {
        if (shopActive) return;
        shopActive = true; isMov = false; _shopSel = 0; _shopTitle = title || 'Concession'; _shopFlash = '';
        try { if (window.setSceneWords) window.setSceneWords(['buy', 'leave']); } catch (e) {}   // #3 ticker
        if (typeof activeKeys === 'object') for (const k in activeKeys) delete activeKeys[k];
        renderShop();
    }
    function _money() { return (window.State && State.world && typeof State.world.money === 'number') ? State.world.money : 0; }
    function renderShop() {
        const esc = (s) => String(s == null ? '' : s).replace(/[<&>]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]));
        let ui = document.getElementById('shop-ui');
        if (!ui) {
            ui = document.createElement('div'); ui.id = 'shop-ui';
            ui.style.cssText = "position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:46%; max-width:360px; max-height:74%; display:flex; flex-direction:column; background:rgba(8,12,18,0.96); border:2px solid #f59e0b; border-radius:4px; padding:11px 13px; z-index:120; color:#f4efe6; font-family:'Courier New',monospace; font-size:13px; letter-spacing:.3px; box-shadow:0 0 18px rgba(245,158,11,0.4), inset 0 0 12px rgba(0,0,0,0.6);";
            (typeof container !== 'undefined' && container ? container : document.body).appendChild(ui);
        }
        const cash = _money();
        const rows = SHOP_ITEMS.map((it, i) => {
            const sel = i === _shopSel;
            const afford = cash + 0.0001 >= it.price;
            const nm = esc(it.name);
            const pr = '$' + it.price.toFixed(2);
            const dots = '.'.repeat(Math.max(2, 28 - nm.length - pr.length));
            const col = sel ? '#0b0e13' : (afford ? '#f4efe6' : '#7a6a52');
            const bg = sel ? 'background:#f59e0b;' : '';
            return '<div data-shop-row="' + i + '" style="' + bg + 'color:' + col + ';padding:2px 5px;border-radius:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
                (sel ? '\u25b8 ' : '\u00a0\u00a0') + nm + ' <span style="opacity:.5">' + dots + '</span> ' + pr + '</div>';
        }).join('');
        ui.innerHTML =
            '<div style="color:#f59e0b;font-weight:bold;letter-spacing:1.5px;font-size:14px;margin-bottom:6px;flex:0 0 auto">\ud83c\udf7f ' + esc(_shopTitle).toUpperCase() + '</div>' +
            // the item list itself scrolls (#22) when there are many items.
            '<div id="shop-items" style="flex:1 1 auto;overflow-y:auto;min-height:0;line-height:1.55">' + rows + '</div>' +
            '<div style="flex:0 0 auto;margin-top:7px;border-top:1px solid #3a4250;padding-top:6px;display:flex;justify-content:space-between">' +
            '<span>Cash on hand:</span><span style="color:#7CFC8A;font-weight:bold">$' + cash.toFixed(2) + '</span></div>' +
            (_shopFlash ? '<div style="flex:0 0 auto;margin-top:5px;color:#ffd86b;font-size:12px">' + esc(_shopFlash) + '</div>' : '') +
            '<div style="flex:0 0 auto;margin-top:6px;color:#64748b;font-size:12px">\u2191\u2193 choose \u00b7 Enter buy \u00b7 Esc done \u00b7 wheel scrolls</div>';
        // keep the highlighted row visible when scrolling a long menu.
        try { const r = ui.querySelector('[data-shop-row="' + _shopSel + '"]'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
    function shopMove(d) { if (!shopActive) return; _shopSel = (_shopSel + d + SHOP_ITEMS.length) % SHOP_ITEMS.length; _shopFlash = ''; renderShop(); }
    function shopBuy() {
        if (!shopActive) return;
        const it = SHOP_ITEMS[_shopSel];
        if (!(window.State && State.world)) return;
        if (_money() + 0.0001 < it.price) { try { playSnd('error'); } catch (e) {} _shopFlash = 'Not quite enough cash for the ' + it.name + '.'; renderShop(); return; }
        State.world.money = Math.round((_money() - it.price) * 100) / 100;
        try { playSnd('click'); } catch (e) {}
        _shopFlash = 'Enjoy your ' + it.name + '! (\u2212$' + it.price.toFixed(2) + ')';
        renderShop();
        try { if (typeof window.__syncGameplayUI === 'function') window.__syncGameplayUI(); } catch (e) {}
    }
    function closeShop() { shopActive = false; const ui = document.getElementById('shop-ui'); if (ui) ui.remove(); try { if (window.setSceneWords) window.setSceneWords([]); } catch (e) {} }   // #3 ticker

    // #12/#13/#21: a single query for "is any blocking in-game modal up?" — used
    // to (a) stop Enter from ALSO opening the command prompt while you're answering
    // a pickup/shop prompt, (b) let the mousewheel scroll the modal instead of
    // zooming the map behind it, and (c) keep the world paused while a modal is up.
    window.__anyModalOpen = function () {
        return !!(
            pickupPromptActive || shopActive || eavesdropActive || usherActive ||
            (typeof gapPromptActive !== 'undefined' && gapPromptActive) ||
            dismissTextPanel ||
            (typeof window.__debugDialogueActive === 'function' && window.__debugDialogueActive()) ||
            (window.DialogueRuntime && typeof window.DialogueRuntime.isActive === 'function' && window.DialogueRuntime.isActive())
        );
    };

    // #14: a context INTERACTION HINT just below the view — shows only what you
    // can do RIGHT NOW (talk/shop/take/sit/read/eat/listen), never the always-on
    // controls (move/jump/crouch already live in the bottom hotkey bar). Computed
    // from the tile/NPC you're facing; hidden when there's nothing to do.
    function computeContextHint() {
        if (typeof window.__anyModalOpen === 'function' && window.__anyModalOpen()) return '';
        const fX = -Math.sin(tRot), fZ = -Math.cos(tRot);
        const ix = pX + Math.round(fX), iz = pZ + Math.round(fZ);
        try { const inter = (typeof pickupInterHere === 'function') && pickupInterHere(); if (inter) return 'G  \u2014  take ' + ((typeof pickupLabel === 'function') ? pickupLabel(inter) : 'item'); } catch (e) {}
        const here = MAP[pFlr] && MAP[pFlr][pZ] && MAP[pFlr][pZ][pX];
        if (here && here.o && here.o.meta && here.o.meta.eavesdropScript && !window.__eavesHeard) {
            return window.__playerCrouching ? 'G  \u2014  listen in' : 'Crouch (X)  \u2014  to listen in';
        }
        let npc = npcs.find(n => n.f === pFlr && n.x === ix && n.z === iz);
        if (!npc) { let best = 0.5; for (const n of npcs) { if (n.f !== pFlr) continue; const dx = n.x - pX, dz = n.z - pZ; if (Math.abs(dx) > 1 || Math.abs(dz) > 1 || (dx === 0 && dz === 0)) continue; const len = Math.hypot(dx, dz) || 1; const dot = (dx / len) * fX + (dz / len) * fZ; if (dot > best) { best = dot; npc = n; } } }
        if (npc) { const m = npc.meta || {}; if (m.shop) return 'G  \u2014  buy from ' + (m.name || 'the concession'); return 'G  \u2014  talk to ' + (m.name || 'them'); }
        const fo = MAP[pFlr] && MAP[pFlr][iz] && MAP[pFlr][iz][ix] && MAP[pFlr][iz][ix].o;
        if (fo) {
            const m = fo.meta || {};
            if (fo.v === 'poster' || m.poster) return 'G  \u2014  look at the poster';
            if (m.food || fo.v === 'food') return 'G  \u2014  eat';
            if (fo.v === 'bench') return 'G  \u2014  sit';
            if (m.text) return 'G  \u2014  read';
        }
        // #20: a movie poster on the wall you're facing.
        const _d = (iz < pZ) ? 'n' : (iz > pZ) ? 's' : (ix > pX) ? 'e' : 'w';
        const _od = _d === 'n' ? 's' : _d === 's' ? 'n' : _d === 'e' ? 'w' : 'e';
        const _e1 = MAP[pFlr] && MAP[pFlr][pZ] && MAP[pFlr][pZ][pX] && MAP[pFlr][pZ][pX][_d];
        const _e2 = MAP[pFlr] && MAP[pFlr][iz] && MAP[pFlr][iz][ix] && MAP[pFlr][iz][ix][_od];
        const _e3 = MAP[pFlr] && MAP[pFlr][iz] && MAP[pFlr][iz][ix] && MAP[pFlr][iz][ix][_d];
        const _hasPoster = (e) => e && e.meta && Array.isArray(e.meta.attachments) && e.meta.attachments.some(a => a && a.v === 'poster' && a.posterTitle && (a.interactMode || 'interact') !== 'view');
        if (_hasPoster(_e1) || _hasPoster(_e2) || _hasPoster(_e3)) return 'G  \u2014  see what\u2019s showing';
        return '';
    }
    // #L: POSTER CAPTION — when you FACE a poster whose interactMode is 'view' or
    // 'both', show its commentary as a caption near the top (no key needed). The
    // 'interact'/'both' modes still pop the modal on G (see the Space/G handler).
    function _facedPosterAtt() {
        // #11: use the COMMITTED facing (tRot) and the SAME facing vector the
        // context hint uses (fX = -sin, fZ = -cos). The old version used the live,
        // lagging player.rotation.y AND dropped the negation, so it read the tile
        // BEHIND the player — the caption appeared only after you turned away.
        const fX = -Math.sin(tRot), fZ = -Math.cos(tRot);
        const ix = pX + Math.round(fX), iz = pZ + Math.round(fZ);
        const dStr = (iz < pZ) ? 'n' : (iz > pZ) ? 's' : (ix > pX) ? 'e' : 'w';
        const opp = { n: 's', s: 'n', e: 'w', w: 'e' }[dStr];
        const e1 = MAP[pFlr] && MAP[pFlr][pZ] && MAP[pFlr][pZ][pX] && MAP[pFlr][pZ][pX][dStr];
        const e2 = MAP[pFlr] && MAP[pFlr][iz] && MAP[pFlr][iz][ix] && MAP[pFlr][iz][ix][opp];
        const e3 = MAP[pFlr] && MAP[pFlr][iz] && MAP[pFlr][iz][ix] && MAP[pFlr][iz][ix][dStr];
        const of = (e) => (e && e.meta && Array.isArray(e.meta.attachments)) ? e.meta.attachments.find(a => a && a.v === 'poster' && (a.posterComment || a.posterTitle)) : null;
        return of(e1) || of(e2) || of(e3);
    }
    function updatePosterCaption() {
        const p = _facedPosterAtt();
        const mode = p && (p.interactMode || 'interact');
        const show = p && (mode === 'view' || mode === 'both');
        let el = document.getElementById('poster-caption');
        if (!show) { if (el) el.style.display = 'none'; return; }
        const txt = p.posterTitle ? ('Now Showing: ' + p.posterTitle) : (p.posterComment || '');   // #14: facing shows the NAME
        if (!el) {
            el = document.createElement('div'); el.id = 'poster-caption';
            el.style.cssText = "position:absolute; left:50%; top:10px; transform:translateX(-50%); max-width:80%; padding:6px 16px; background:rgba(6,10,16,0.85); border:1px solid #3a4658; border-radius:8px; color:#e8eef6; font-family:Georgia,serif; font-size:14px; font-style:italic; text-align:center; z-index:40; pointer-events:none; box-shadow:0 2px 8px rgba(0,0,0,0.5);";
            (typeof container !== 'undefined' && container ? container : document.body).appendChild(el);
        }
        if (el.textContent !== txt) el.textContent = txt;
        el.style.display = 'block';
    }
    function updateContextHint() {
        let el = document.getElementById('context-hint');
        const txt = computeContextHint();
        if (!txt) { if (el) el.style.display = 'none'; return; }
        if (!el) {
            el = document.createElement('div'); el.id = 'context-hint';
            el.style.cssText = "position:absolute; left:50%; bottom:8px; transform:translateX(-50%); padding:3px 14px; background:rgba(6,10,16,0.82); border:1px solid #3a4658; border-radius:14px; color:#cfe0f0; font-family:'Courier New',monospace; font-size:13px; letter-spacing:.5px; z-index:40; pointer-events:none; white-space:nowrap; box-shadow:0 1px 6px rgba(0,0,0,0.5);";
            (typeof container !== 'undefined' && container ? container : document.body).appendChild(el);
        }
        if (el.textContent !== txt) el.textContent = txt;
        el.style.display = 'block';
    }

    function showPickupPrompt(inter) {
        pickupPromptActive = true; isMov = false;
        if (typeof activeKeys === 'object') for (const k in activeKeys) delete activeKeys[k];
        const name = pickupLabel(inter);
        const ui = document.createElement('div'); ui.id = 'pickup-ui';
        ui.style.cssText = "position:absolute; top:18%; left:50%; transform:translateX(-50%); background:rgba(6,10,16,0.94); border:3px solid #22d3ee; border-radius:2px; padding:18px 22px; z-index:100; text-align:center; color:#e8fbff; font-family:'Courier New',monospace; letter-spacing:1px; min-width:280px; box-shadow:0 0 20px rgba(34,211,238,0.5), inset 0 0 12px rgba(0,0,0,0.6);";
        const header = document.createElement('h2'); header.style.cssText = "margin:0 0 4px; color:#22d3ee; font-family:'Courier New',monospace; letter-spacing:2px; text-shadow:0 0 6px rgba(34,211,238,0.8); font-size:20px;"; header.textContent = '\u25c8 ITEM HERE \u25c8';
        const sub = document.createElement('p'); sub.style.cssText = "font-size:19px; color:#a5f3fc; margin:0 0 16px; letter-spacing:1px;"; sub.textContent = 'Pick up the ' + name + '?';
        const btnBox = document.createElement('div'); btnBox.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
        const mkBtn = (label, color, fn) => {
            const b = document.createElement('button'); b.textContent = label; b.tabIndex = -1;
            b.style.cssText = "padding:10px 12px; background:" + color + "; color:#e8fbff; border:2px solid " + (color === '#06303a' ? '#22d3ee' : '#475569') + "; border-radius:2px; cursor:pointer; font-family:'Courier New',monospace; text-transform:uppercase; letter-spacing:1px; font-weight:bold; font-size:21px;";
            b.addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });
            return b;
        };
        const takeIt = () => { closePickupPrompt(); doPickup(inter); };
        const leaveIt = () => { _pickupDeclinedTile = pX + ',' + pZ + ',' + pFlr; closePickupPrompt(); };
        // #10: read the REAL bound key names from the templating helper rather than
        // hard-coding — so this label tracks the interact/back bindings (G/Esc).
        const _kn = (a, d) => (typeof window.keyName === 'function' ? window.keyName(a) : d);
        btnBox.appendChild(mkBtn('Pick Up  (' + _kn('interact', 'G') + ')', '#06303a', takeIt));
        btnBox.appendChild(mkBtn('Leave It  (' + _kn('back', 'Esc') + ')', '#1e293b', leaveIt));
        ui.appendChild(header); ui.appendChild(sub); ui.appendChild(btnBox);
        (typeof container !== 'undefined' && container ? container : document.body).appendChild(ui);   // #9: keep inside the map subwindow
        // The main keydown handler routes G/Enter/Space → take, Esc/N → leave
        // through this (keeps event ordering simple and consistent with the gap UI).
        window.__doPickupChoice = (choice) => { if (choice === 'take') takeIt(); else leaveIt(); };
        try { if (window.setSceneWords) window.setSceneWords(['take', 'leave']); } catch (e) {}   // #3 ticker
    }

    function showGapPrompt(nx, nz, dir) {
        gapPromptActive = true; isMov = false;
        // Clear any "key held" state so when the prompt closes the player
        // isn't suddenly being walked by a key whose keyup happened while
        // the modal had focus.
        if (typeof activeKeys === 'object') for (const k in activeKeys) delete activeKeys[k];
        const ui = document.createElement('div'); ui.id = 'gap-ui';
        // retro modal styling — monospace, scanline-ish glow,
        // black panel with a colored border + box-shadow, matching the #dialogue
        // and #msg aesthetic. (Gap uses a warning amber/red palette.)
        ui.style.cssText = "position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); box-sizing:border-box; background:rgba(6,10,16,0.94); border:2px solid #f59e0b; border-radius:2px; padding:10px 12px; z-index:100; text-align:center; color:#e8fbff; font-family:'Courier New',monospace; letter-spacing:1px; min-width:150px; max-width:calc(100% - 16px); max-height:calc(100% - 16px); overflow:auto; box-shadow:0 0 16px rgba(245,158,11,0.5), inset 0 0 10px rgba(0,0,0,0.6);";   // #19: fit the map subscreen

        const btn = (label, action, color) => {
            const b = document.createElement('button');
            b.textContent = label;
            // tabindex=-1 so buttons can never be tab-cycled into between key
            // events — they're only triggered by direct click.
            b.tabIndex = -1;
            // Retro button: monospace, uppercase, glowing border feel.
            b.style.cssText = "padding:6px 10px; background:" + color + "; color:#e8fbff; border:2px solid " + (color === '#3a1d00' ? '#f59e0b' : '#475569') + "; border-radius:2px; cursor:pointer; font-family:'Courier New',monospace; text-transform:uppercase; letter-spacing:1px; font-weight:bold; font-size:14px;";   // #19 smaller
            b.addEventListener('click', (e) => {
                // Blur the button BEFORE doGapAction removes the modal — that
                // way activeElement gets handed back to <body> by the browser
                // immediately, not after a detached node was removed (which
                // some browsers handle imperfectly).
                e.currentTarget.blur();
                window.doGapAction(action, nx, nz, dir);
            });
            return b;
        };

        const header = document.createElement('h2'); header.style.cssText = "margin:0 0 2px; color:#f59e0b; font-family:'Courier New',monospace; letter-spacing:2px; text-shadow:0 0 6px rgba(245,158,11,0.8); font-size:14px;"; header.textContent = '▚ VOID AHEAD ▚';
        const sub    = document.createElement('p');  sub.style.cssText = "font-size:11px; color:#7dd3fc; margin:0 0 10px; letter-spacing:1px;"; sub.textContent = '— PHYSICS CHECK —';
        const btnBox = document.createElement('div'); btnBox.style.cssText = 'display:flex; flex-direction:column; gap:5px;';
        btnBox.appendChild(btn('Jump Across', 'jump',     '#3a1d00'));
        btnBox.appendChild(btn('Fall Down',   'fall',     '#3a1d00'));
        btnBox.appendChild(btn('Jump Down',   'jumpdown', '#3a1d00'));
        btnBox.appendChild(btn('Turn Back',   'cancel',   '#1e293b'));

        ui.appendChild(header);
        ui.appendChild(sub);
        ui.appendChild(btnBox);
        (typeof container !== 'undefined' && container ? container : document.body).appendChild(ui);   // #9: keep inside the map subwindow
    }

    // window.doGapAction is exposed globally because the gap UI's buttons
    // use inline onclick attributes (above). Don't rename without updating
    // both places.
    //
    //   'jump'     — try to leap `jumpDist` tiles in `dir`, landing on a floor
    //   'fall'     — drop straight down to whatever floor catches you
    //   'jumpdown' — leap one tile forward AND drop down on landing
    //   'cancel'   — just close the prompt
    window.doGapAction = function (action, nx, nz, dir) {
        const gapUi = document.getElementById('gap-ui'); if(gapUi) gapUi.remove();
        gapPromptActive = false;
        // The HTML button stole keyboard focus when the user clicked it.
        // Removing the button leaves focus in limbo, and on some browsers
        // subsequent keydown events stop reaching our window listener.
        // Two-step recovery:
        //   1) Clear any "keys still held" tracking from BEFORE the prompt
        //      fired (their keyup events were eaten by the modal), so the
        //      next WASD press re-locks a fresh input direction.
        //   2) Explicitly return focus to the page body so window-level
        //      keydown handlers fire again.
        activeKeys = {};
        try { document.body.focus(); } catch (e) {}
        // Also: if the page is running inside an iframe (preview or
        // embedded export), make sure the iframe contentWindow is the
        // active focus target.
        try { window.focus(); } catch (e) {}
        if (action === 'cancel') return;
        if (action === 'fall') {
            // Look for a floor BELOW the current floor at the (nx,nz) cell.
            // We start checking from pFlr-1 (the floor immediately below).
            let dropFlr = pFlr - 1;
            while (dropFlr >= 0 && !(MAP[dropFlr] && MAP[dropFlr][nz] && MAP[dropFlr][nz][nx] && MAP[dropFlr][nz][nx].f)) dropFlr--;
            if (dropFlr < 0) {
                // No floor catches you — refuse the fall instead of teleporting
                // into a void cell (which would cause endless gap prompts).
                showMsg("Nothing to land on.");
                return;
            }
            showMsg('You fell down!');
            jumpStartPos.copy(player.position); pX = nx; pZ = nz;
            tPos.set(pX, dropFlr * FLR_H, pZ); pendingDropFlr = dropFlr;
            isJump = true; jumpStyle = 'falldown'; jumpProgress = 0; isMov = false;
            try { applyFloorFog(dropFlr, pX, pZ); } catch (e) {}
        } else if (action === 'jump') {
            let jumpDist = 2; // tiles the player can clear; bump this for longer jumps
            let lX = nx + (dir === 'e' ? jumpDist : (dir === 'w' ? -jumpDist : 0));
            let lZ = nz + (dir === 's' ? jumpDist : (dir === 'n' ? -jumpDist : 0));
            // Bounds + landing-floor check on the SAME floor we jumped from.
            if (lX >= 0 && lX < W && lZ >= 0 && lZ < H && MAP[pFlr][lZ] && MAP[pFlr][lZ][lX] && MAP[pFlr][lZ][lX].f) {
                showMsg('Jump successful!');
                pX = lX; pZ = lZ;
                isJump = true; jumpProgress = 0;
                jumpStartPos.copy(player.position);
                tPos.set(pX, pFlr * FLR_H, pZ);
            } else {
                // No floor to land on. Try to fall instead — but only if there
                // IS a lower floor to fall to. Otherwise refuse.
                let dropFlr = pFlr - 1;
                while (dropFlr >= 0 && !(MAP[dropFlr] && MAP[dropFlr][lZ] && MAP[dropFlr][lZ][lX] && MAP[dropFlr][lZ][lX].f)) dropFlr--;
                if (dropFlr < 0) {
                    showMsg("Jump failed — nothing to land on.");
                } else {
                    showMsg('Jump failed! Falling!');
                    jumpStartPos.copy(player.position); pX = lX; pZ = lZ;
                    tPos.set(pX, dropFlr * FLR_H, pZ); pendingDropFlr = dropFlr;
                    isJump = true; jumpStyle = 'falldown'; jumpProgress = 0; isMov = false;
                    try { applyFloorFog(dropFlr, pX, pZ); } catch (e) {}
                }
            }
        } else if (action === 'jumpdown') {
            let lX = nx + (dir === 'e' ? 1 : (dir === 'w' ? -1 : 0));
            let lZ = nz + (dir === 's' ? 1 : (dir === 'n' ? -1 : 0));
            // Look for a floor below the (lX,lZ) cell.
            let dropFlr = pFlr - 1;
            while (dropFlr >= 0 && !(MAP[dropFlr] && MAP[dropFlr][lZ] && MAP[dropFlr][lZ][lX] && MAP[dropFlr][lZ][lX].f)) dropFlr--;
            if (dropFlr < 0) {
                showMsg("Nothing to land on.");
                return;
            }
            showMsg('Jumped down!');
            jumpStartPos.copy(player.position); pX = lX; pZ = lZ;
            tPos.set(pX, dropFlr * FLR_H, pZ); pendingDropFlr = dropFlr;
            isJump = true; jumpStyle = 'falldown'; jumpProgress = 0; isMov = false;
            try { applyFloorFog(dropFlr, pX, pZ); } catch (e) {}
        }
    };

    // ── §5.3  COLLISION DETECTION ──────────────────────────────────────────
    // Returns true if movement is BLOCKED. Also has side effects: opens
    // doors, runs warps, kicks off the gap-prompt UI, etc.
    //
    // Edge handling note: each tile shares walls with its neighbors, so we
    // check BOTH (from-tile's edge in dirStr) AND (to-tile's edge in oppDir).
    // If either is solid, we block — unless it's a door we just toggled or a
    // jumpable wall and the player held shift.
    // STEALTH line-of-sight. Walk the tiles between (x0,z0) and (x1,z1) on
    // floor f; if a SOLID edge (wall/closed door) or a tall solid object
    // (counter, pillar) sits between them, the view is blocked. Coarse but cheap
    // — steps in unit increments and checks the edge crossed each step. Returns
    // true if the target is VISIBLE (nothing blocks).
    function tileLineOfSight(x0, z0, x1, z1, f, crouchHide) {
        let cx = x0, cz = z0;
        const tx = x1, tz = z1;
        let guard = 0;
        const isCounter = (e) => e && e.v && (e.v === 'counter' || e.v === 'counter_door');
        while ((cx !== tx || cz !== tz) && guard++ < 64) {
            const ddx = tx - cx, ddz = tz - cz;
            // Step along the dominant axis one tile at a time.
            let sx = 0, sz = 0;
            if (Math.abs(ddx) >= Math.abs(ddz)) sx = ddx > 0 ? 1 : -1;
            else sz = ddz > 0 ? 1 : -1;
            const dStr = sx > 0 ? 'e' : (sx < 0 ? 'w' : (sz > 0 ? 's' : 'n'));
            const opp = dStr === 'n' ? 's' : (dStr === 's' ? 'n' : (dStr === 'e' ? 'w' : 'e'));
            const nxt = { x: cx + sx, z: cz + sz };
            if (nxt.x < 0 || nxt.x >= W || nxt.z < 0 || nxt.z >= H) return false;
            // A solid edge between the current and next tile blocks sight.
            const e1 = MAP[f][cz] && MAP[f][cz][cx] && MAP[f][cz][cx][dStr];
            const e2 = MAP[f][nxt.z] && MAP[f][nxt.z][nxt.x] && MAP[f][nxt.z][nxt.x][opp];
            // a counter is WAIST-HIGH — staff see OVER it when you stand, so it
            // only blocks sight when crouchHide (looking for a ducked player).
            const blocks = (e) => {
                if (!e || !e.meta || !e.meta.solid) return false;
                if (e.v && e.v.startsWith('glass')) return false;
                if (isCounter(e)) return !!crouchHide;
                return true;
            };
            if (blocks(e1) || blocks(e2)) return false;
            // A solid object in the next tile (not the target tile) blocks sight.
            if (!(nxt.x === tx && nxt.z === tz)) {
                const o = MAP[f][nxt.z][nxt.x] && MAP[f][nxt.z][nxt.x].o;
                if (o && o.meta && o.meta.solid) return false;
            }
            cx = nxt.x; cz = nxt.z;
        }
        return true;
    }

    // is a CROUCHED player at (px,pz) concealed from a watcher at
    // (gx,gz) by ADJACENT cover? Checks the player's four sides for sight-blocking
    // cover — a solid edge (wall; counters count for a croucher; glass doesn't) or
    // a solid object on the neighboring tile — and counts it as concealment when
    // that cover lies broadly BETWEEN the player and the watcher (direction dot >
    // 0.45, ~63°). This is what makes crouching mean "hide behind things / hug
    // corners" instead of shrinking vision cones. FUTURE HEARING MECHANICS: pair
    // with window.__crouchNoiseMul (set in engineSetCrouch) for being less audible.
    function crouchCoverConceals(px, pz, f, gx, gz) {
        const tdx = gx - px, tdz = gz - pz;
        const tlen = Math.hypot(tdx, tdz);
        if (tlen < 0.001) return false;
        const ux = tdx / tlen, uz = tdz / tlen;
        const isCounter = (e) => e && e.v && (e.v === 'counter' || e.v === 'counter_door');
        const blocks = (e) => {
            if (!e || !e.meta || !e.meta.solid) return false;
            if (e.v && e.v.startsWith('glass')) return false;   // see-through
            if (isCounter(e)) return true;                       // waist-high = croucher cover
            return true;
        };
        const sides = [ { d: 'n', dx: 0, dz: -1 }, { d: 's', dx: 0, dz: 1 }, { d: 'e', dx: 1, dz: 0 }, { d: 'w', dx: -1, dz: 0 } ];
        for (const s of sides) {
            const dot = s.dx * ux + s.dz * uz;
            if (dot < 0.45) continue;   // this side doesn't face the watcher
            const here = MAP[f] && MAP[f][pz] && MAP[f][pz][px];
            if (!here) continue;
            if (blocks(here[s.d])) return true;   // wall/counter edge on the watcher side
            const nx2 = px + s.dx, nz2 = pz + s.dz;
            const nb = MAP[f] && MAP[f][nz2] && MAP[f][nz2][nx2];
            if (nb && blocks(nb[s.d === 'n' ? 's' : s.d === 's' ? 'n' : s.d === 'e' ? 'w' : 'e'])) return true;
            if (nb && nb.o && nb.o.meta && nb.o.meta.solid) return true;   // crate/box/etc beside you
        }
        return false;
    }

    function checkCollision(nx, nz, pF, dirStr, isJumpMove) {
        // Off the map edge → block, or fire the configured edge warp.
        if (nx < 0 || nx >= W || nz < 0 || nz >= H) {
            // WALKING THROUGH an OPEN perimeter exit door = leaving.
            // The step itself is still blocked (there's no tile out there), but if
            // the edge being walked into is a door that's been OPENED (meta.solid
            // === false) on a tile flagged exitWaypoint, that's the player opening
            // the door and walking through — fire the exit callback. A short latch
            // debounces key-repeat while the prompt opens.
            const exitEdge = MAP[pF][pZ][pX] && MAP[pF][pZ][pX][dirStr];
            const tileObj  = MAP[pF][pZ][pX] && MAP[pF][pZ][pX].o;
            if (exitEdge && String(exitEdge.v || '').indexOf('door') === 0 && exitEdge.meta && exitEdge.meta.solid === false &&
                tileObj && tileObj.meta && tileObj.meta.exitWaypoint &&
                typeof window.engineOnExitReached === 'function' && !window.__exitFireLatch) {
                window.__exitFireLatch = true;
                setTimeout(() => { window.__exitFireLatch = false; }, 500);
                try { window.engineOnExitReached(tileObj.meta || {}); } catch (e) {}
            }
            if (CONFIG.settings.edgeBehavior === 'warp' && CONFIG.settings.edgeWarpUrl) executeWarp({ warpMap: CONFIG.settings.edgeWarpUrl, warpX: CONFIG.settings.edgeWarpX, warpY: CONFIG.settings.edgeWarpY });
            return true;
        }
        let e1 = MAP[pF][pZ][pX][dirStr];
        let oppDir = dirStr === 'n' ? 's' : (dirStr === 's' ? 'n' : (dirStr === 'e' ? 'w' : 'e'));
        let e2 = MAP[pF][nz][nx][oppDir];
        // A wall is blocking UNLESS it's been explicitly marked non-solid
        // (e.g. an open door, an archway with meta.solid===false). Previously
        // this required meta.solid to be truthy — meaning any wall painted
        // without explicit solid metadata was walked-through. New rule:
        // if an edge object exists, it blocks unless meta.solid === false.
        const isBlocking = (edge) => {
            if (!edge) return false;
            if (!edge.meta) return true;                  // no meta → block
            return edge.meta.solid !== false;             // default block
        };
        let blockEdge = isBlocking(e1) ? e1 : (isBlocking(e2) ? e2 : null);

        if (blockEdge) {
            if (blockEdge.meta?.isWarp && warpHasDest(blockEdge.meta)) { executeWarp(blockEdge.meta); return false; }
            if (blockEdge.meta?.jumpable && isJumpMove) { showMsg('Vaulted over!'); isJump = true; jumpProgress = 0; jumpStartPos.copy(player.position); return false; }
            // Door interaction by walking into it: locked check, then the shared
            // animateDoorOpen() helper (the Space-bar handler calls the same helper,
            // so walk-into and press-to-open behave identically — incl. lift-top counters).
            if (blockEdge.v && (blockEdge.v.startsWith('door') || blockEdge.v === 'counter_door')) {
                let dObj = doorObjects.find(d => d.f === pF && ((d.x === pX && d.z === pZ && d.dir === dirStr) || (d.x === nx && d.z === nz && d.dir === oppDir)));
                if (dObj) {
                    if (!dObj.isOpen && blockEdge.meta.usher) { return triggerUsherDoor(dObj, blockEdge); }   // #13: usher entrance
                    if (!dObj.isOpen && blockEdge.meta.locked && !inventory.includes(blockEdge.meta.reqKey)) { showMsg(blockEdge.meta.lockedMsg || 'LOCKED'); playSnd('error'); return true; }
                    else if (dObj.animating) { return true; }   // #11: already swinging — wait, don't re-trigger or slip through
                    else {
                        dObj.isOpen = !dObj.isOpen;
                        if (dObj.isOpen) {
                            // #11: OPENING — keep the edge SOLID (block) until the swing
                            // finishes; only then does onDone open the gap. So the player
                            // waits for the door instead of clipping through it mid-open.
                            animateDoorOpen(dObj, blockEdge, () => {
                                blockEdge.meta.solid = false; if (e1) e1.meta.solid = false; if (e2) e2.meta.solid = false;
                            });
                        } else {
                            // closing again (rare on the walk-into path): reseal immediately
                            animateDoorOpen(dObj, blockEdge);
                            blockEdge.meta.solid = true; if (e1) e1.meta.solid = true; if (e2) e2.meta.solid = true;
                        }
                        return true;
                    }
                }
            }
            return true;
        }


        // A solid NPC currently on the target tile blocks you — you can't walk
        // through people. NPCs WANDER, so check their LIVE roster position; the
        // static 'npc' map object is excluded from the solid checks below so it
        // doesn't ghost-block the tile an NPC has walked away from.
        for (const _n of npcs) {
            if (_n.f === pF && _n.x === nx && _n.z === nz && (!_n.meta || _n.meta.solid !== false)) return true;
        }

        // Center-tile object blocking: diagonals, warps, jumpables, solids.
        let diag = MAP[pF][nz][nx].o?.v === 'solid_diag1' || MAP[pF][nz][nx].o?.v === 'solid_diag2'; if (diag && MAP[pF][nz][nx].o.meta?.solid) return true;

        // Diagonal-wall blocking via cell.d1 / cell.d2.
        // d1 = NW-SE bar; d2 = NE-SW bar. Glass diagonals are still solid for
        // collision purposes unless explicitly meta.solid === false.
        // Entry direction from the player's perspective:
        //   dirStr === 'n' → entering from south side of new tile
        //   dirStr === 's' → entering from north side
        //   dirStr === 'e' → entering from west side
        //   dirStr === 'w' → entering from east side
        // For d1 (NW-SE), the bar separates the NE half from the SW half.
        // Entering from N or E → arriving in the NE half (blocked if you'd
        // need to cross). Entering from S or W → SW half. A d1 bar blocks
        // movement that crosses from one half to the other; from the player's
        // adjacent tile, ANY entry to the d1 tile crosses the bar.
        // Same logic mirrored for d2.
        // Simplest correct rule: if a solid diagonal sits in the DESTINATION
        // tile, block. (More nuanced "which side of the diagonal you end
        // up in" requires sub-tile positions which the grid doesn't track.)
        // Diagonal-wall blocking via cell.d1 / cell.d2 — check BOTH the
        // destination tile AND the current tile (a diagonal on the player's
        // own tile can wall off the void beyond it).
        const diagBlocks = (d) => d && (!d.meta || d.meta.solid !== false);
        const destD1 = MAP[pF][nz][nx].d1, destD2 = MAP[pF][nz][nx].d2;
        const curD1  = MAP[pF][pZ][pX].d1, curD2  = MAP[pF][pZ][pX].d2;
        if (diagBlocks(destD1) || diagBlocks(destD2) || diagBlocks(curD1) || diagBlocks(curD2)) return true;

        let cObj = MAP[pF][nz][nx].o;
        if (cObj && cObj.v !== 'solid_diag1' && cObj.v !== 'solid_diag2') {
            if (cObj.meta?.isWarp && warpHasDest(cObj.meta)) { executeWarp(cObj.meta); return false; }
            if (cObj.meta?.jumpable && isJumpMove) { showMsg('Vaulted over!'); isJump = true; jumpProgress = 0; jumpStartPos.copy(player.position); return false; }
            // Center-tile objects block when meta.solid is truthy. ('npc' objects
            // are handled by the live roster check above, so skip them here — that
            // way a wandered NPC's start tile isn't left ghost-blocked.)
            if (cObj.v !== 'npc' && cObj.meta && cObj.meta.solid) return true;
            // SUBSTANTIAL PROPS block by default. Center objects used
            // to pass unless a map explicitly set meta.solid — so authored props
            // (the debug room's register, arcade cabinet, trash can, crate, ladder,
            // standing sign) were walk-through whenever the map forgot the flag.
            // These render as full solid furniture, so they block unless a map
            // explicitly opts OUT with meta.solid === false. NOTE: #9 — a BENCH is
            // now solid too (you can't walk THROUGH it); you still sit by facing it
            // and pressing Space (the interact handler seats you onto it, bypassing
            // collision). Floor markers (uplight/arrow/warp/dir/key/exit_sign) stay
            // walkable. To make another prop solid-by-default, add its v here.
            const SOLID_BY_DEFAULT = ['sign', 'register', 'arcade', 'trash', 'ladder', 'box', 'crate', 'bench'];
            if (SOLID_BY_DEFAULT.indexOf(cObj.v) >= 0 && !(cObj.meta && cObj.meta.solid === false)) return true;
        }

        // Void floor → trigger gap prompt UNLESS allowEmptyWalk is enabled.
        // IMPORTANT: by the time we reach here, we've already confirmed there's
        // no blocking edge (wall/closed-door/counter/glass) and no blocking
        // diagonal between the player and the destination — so an empty
        // destination really is an open void the player could fall into. If
        // any impassable obstacle sat between, we returned `true` above and
        // never get here, so the gap prompt won't fire through a wall/glass.
        if (!CONFIG.settings.allowEmptyWalk && !MAP[pF][nz][nx].f) { showGapPrompt(nx, nz, dirStr); return true; }
        return false;
    }

    // ── §5.5  COMPASS & MINIMAP ────────────────────────────────────────────
    // updateCompass(): refresh the WASD-label indicator (which key faces N/E/S/W)
    // based on how the camera has been rotated by the player. Called any time
    // the camera turns (§5.4 keydown handler).
    function updateCompass() {
        if (CONFIG.settings.compassMode === 'off' || !camManager) return;
        // the WASD indicator must match the active movementMode.
        //   'fixed'  (default): each key has a CONSTANT cardinal — W=N, D=E, S=S, A=W —
        //            so we show that fixed cardinal and DON'T rotate the labels.
        //   'camera': the legacy screen-relative scheme; labels rotate with the camera.
        const moveMode = CONFIG.settings.movementMode || 'camera'; // #1 batch: camera-relative is the default everywhere now (was 'fixed'); a map can still set movementMode:'fixed' to opt out
        const card = ['N', 'E', 'S', 'W'];
        const arrow = { w: '↑', d: '→', s: '↓', a: '←' };
        if (moveMode === 'camera') {
            // FFT-style: labels rotate with the camera using the SAME 8-step table
            // as movement (ISO8_DIR), so the WASD compass always matches where the
            // keys actually send you. intent: w=up(0) d=right(1) s=down(2) a=left(3).
            const off8 = camManager.InputOffset8 || 0;
            const intent = { w: 0, d: 1, s: 2, a: 3 };
            ['w', 'a', 's', 'd'].forEach(key => {
                const el = document.getElementById('dir-' + key);
                if (el) el.innerText = arrow[key] + ' ' + card[ISO8_DIR[off8][intent[key]]];
            });
        } else {
            // Fixed: W=N, D=E, S=S, A=W — constant regardless of camera.
            const fixedCard = { w: 'N', d: 'E', s: 'S', a: 'W' };
            ['w', 'a', 's', 'd'].forEach(key => {
                const el = document.getElementById('dir-' + key);
                if (el) el.innerText = arrow[key] + ' ' + fixedCard[key];
            });
        }
        // #6 (FIX): a 3D compass. Spin the dial on Z for camera yaw (true-north
        // tracking) AND tip it on X for the camera TILT, so the disc visibly leans
        // as the map tilts. A small pitch-ladder beside it shows the tilt within its
        // -30..+30 range as a numeric + marker readout.
        const tiltInfo = (camManager.getTiltInfo) ? camManager.getTiltInfo() : null;
        const tiltDeg = tiltInfo ? (tiltInfo.deg || 0) : 0;
        const dial = document.querySelector('#compass-ui .compass-dial');
        if (dial) {
            // rotateX leans the disc toward the viewer as tilt increases; rotateZ
            // (negative isoAngle) keeps the N/E/S/W ring pointing at true-north.
            dial.style.transform = `rotateX(${55 + tiltDeg}deg) rotateZ(${-camManager.isoAngle}rad)`;
        }
        // Pitch ladder: map tiltDeg in [min,max] to a marker position (top=max tilt).
        const tEl = document.getElementById('compass-tilt');
        if (tEl) {
            if (tiltInfo && tiltInfo.enabled) {
                tEl.style.display = 'block';
                const mark = tEl.querySelector('.mark');
                const degEl = tEl.querySelector('.deg');
                const min = tiltInfo.min != null ? tiltInfo.min : -30;
                const max = tiltInfo.max != null ? tiltInfo.max : 30;
                const frac = Math.max(0, Math.min(1, (tiltDeg - min) / (max - min)));
                if (mark) mark.style.top = ((1 - frac) * 57) + 'px';   // 0px=top(max), 57px=bottom(min)
                if (degEl) degEl.textContent = (tiltDeg > 0 ? '+' : '') + tiltDeg + '\u00b0';
            } else {
                tEl.style.display = 'none';   // tilt disabled on this map → hide the ladder
            }
        }
        // View-mode availability: highlight the ACTIVE perspective, dim any that
        // this map's camMode doesn't allow. 'fps' = 1P only; 'fps_toggle'/'fps_zoom'
        // = both (V toggles); anything else (iso) = 3P only.
        const vm = document.getElementById('view-mode');
        if (vm) {
            const v3 = vm.querySelector('.v3'), v1 = vm.querySelector('.v1');
            const mode = CONFIG.settings.camMode;
            const canFps = (mode === 'fps' || mode === 'fps_toggle' || mode === 'fps_zoom');
            const canIso = (mode !== 'fps');
            const fpsActive = (mode === 'fps') || ((mode === 'fps_toggle' || mode === 'fps_zoom') && camManager && camManager.activeCam === camManager.perspCamera);
            if (v1) v1.className = 'v1 ' + (!canFps ? 'off' : (fpsActive ? 'on' : ''));
            if (v3) v3.className = 'v3 ' + (!canIso ? 'off' : (!fpsActive ? 'on' : ''));
        }
    }

    // ── §5.4  KEYBOARD INPUT ───────────────────────────────────────────────
    // Hotkeys:
    //   F          — toggle flashlight (if CONFIG.settings.flashlight)
    //   M          — toggle minimap (if minimapMode==='toggle')
    //   C          — toggle compass (if compassMode==='toggle')
    //   Q/E/T/V    — handled by camManager.handleKeyDown() (rotate/tilt/view)
    //   Shift      — jump (mid-air arc)
    //   Space      — interact (the big switchboard below)
    //   W/A/S/D    — move (also Arrow keys). Direction is camera-relative
    //                except in FPS mode where it's player-relative.
    let activeKeys = {};
    // #: tab-away/tab-back recovery hook — the host calls this when the tab
    // regains focus so a key whose keyup was eaten (while unfocused) doesn't stay
    // "stuck" (e.g. the player walking forever). Clears all held-key tracking.
    window.engineClearKeys = function () { try { for (const k in activeKeys) delete activeKeys[k]; } catch (e) {} };

    // Evaluate a breakable-window's break requirement against the current
    // player context. Returns { allowed: bool, message: string }.
    //   meta.breakReqType: 'none' | 'stat' | 'hobby'
    // window.playerContext (set by the full game when a map is embedded) may
    // provide { stats: {brawn, finesse, ...}, hobbies: [..] }. In standalone
    // preview/export there's no character: 'none' always breaks; stat/hobby
    // gates explain what they'd need but still allow the break so the level
    // can be tested. (Set window.__strictBreakReq = true to enforce instead.)
    function checkBreakRequirement(meta) {
        const type = meta.breakReqType || 'none';
        if (type === 'skill') {
            const r = resolveSkillCheck(meta.breakReqSkill || 'force', meta.breakReqValue);
            return { allowed: r.outcome !== 'fail', outcome: r.outcome, check: r,
                     message: r.outcome === 'pass' ? '' : (r.outcome === 'partial' ? 'It cracks but holds — try again.' : 'You bounce off. That hurt.') };
        }
        if (type === 'none') return { allowed: true, message: '' };
        const pc = window.playerContext;
        const strict = !!window.__strictBreakReq;
        if (type === 'stat') {
            const stat = meta.breakReqStat || 'brawn';
            const need = parseInt(meta.breakReqValue, 10) || 0;
            const label = stat.charAt(0).toUpperCase() + stat.slice(1);
            if (pc && pc.stats && typeof pc.stats[stat] === 'number') {
                if (pc.stats[stat] >= need) return { allowed: true, message: '' };
                return { allowed: false, message: 'You need ' + need + ' ' + label + ' to break this.' };
            }
            // No player context.
            return { allowed: !strict, message: 'Requires ' + need + ' ' + label + ' to break.' };
        }
        if (type === 'hobby') {
            const hobby = (meta.breakReqHobby || '').trim();
            if (!hobby) return { allowed: true, message: '' };
            if (pc && Array.isArray(pc.hobbies)) {
                if (pc.hobbies.map(h => String(h).toLowerCase()).includes(hobby.toLowerCase())) return { allowed: true, message: '' };
                return { allowed: false, message: 'Requires the ' + hobby + ' hobby to break this.' };
            }
            return { allowed: !strict, message: 'Requires the ' + hobby + ' hobby to break.' };
        }
        return { allowed: true, message: '' };
    }

    // skill check for VAULTING over a jumpable obstacle (counter, jumpable
    // wall, broken/open window, jumpable prop) or a gap. Mirrors the break
    // requirement style. An obstacle may specify its own gate via meta:
    //   meta.jumpReqType:  'none' | 'stat' | 'hobby'  (default 'stat')
    //   meta.jumpReqStat:  defaults to 'reflexes'
    //   meta.jumpReqValue: target value (default 4 — most people clear a counter)
    // With no player context (standalone preview), non-strict mode allows it so
    // ── #1/#2: SKILL CHECK RESOLVER ────────────────────────────────────────
    // An obstacle (jumpable edge/prop, breakable glass) may gate itself with a
    // SKILL check instead of a flat stat/hobby requirement. Meta shape:
    //   reqType: 'skill'
    //   reqSkill: one of GameData.ACTION_SKILLS keys (e.g. 'jump','climb','force')
    //   reqValue: target number (default 5)
    // The governing stat for the skill comes from GameData.SKILL_STAT. We roll
    // d6 + governingStat and compare to the target:
    //   roll >= target        → 'pass'    (clean success)
    //   roll >= target - 2     → 'partial' (scrape through: slow climb / no dmg-ish)
    //   else                   → 'fail'    (pushed back / takes damage)
    // With no player context (standalone preview) we default to 'partial' so the
    // mechanic is testable without a character.
    function resolveSkillCheck(skillKey, target) {
        const GD = window.GameData;
        const stat = (GD && GD.SKILL_STAT && GD.SKILL_STAT[skillKey]) || 'reflexes';
        const pc = window.playerContext;
        const tgt = (target != null ? target : 5);
        if (!pc || !pc.stats || typeof pc.stats[stat] !== 'number') {
            return { outcome: 'partial', roll: tgt - 1, target: tgt, stat, skill: skillKey };
        }
        const statVal = pc.stats[stat];
        const d6 = 1 + Math.floor(Math.random() * 6);
        const roll = d6 + statVal;
        let outcome = 'fail';
        if (roll >= tgt) outcome = 'pass';
        else if (roll >= tgt - 2) outcome = 'partial';
        return { outcome, roll, target: tgt, stat, skill: skillKey, d6, statVal };
    }
    window.engineResolveSkillCheck = resolveSkillCheck;

    // levels stay testable. Returns { allowed, message }.
    function checkJumpRequirement(meta) {
        meta = meta || {};
        const type = meta.jumpReqType || 'stat';
        // SKILL-based gate — return the full outcome so the caller can branch
        // into pass / slow-climb / pushed-back animations.
        if (type === 'skill') {
            const r = resolveSkillCheck(meta.jumpReqSkill || 'jump', meta.jumpReqValue);
            return { allowed: r.outcome !== 'fail', outcome: r.outcome, check: r,
                     message: r.outcome === 'pass' ? '' : (r.outcome === 'partial' ? 'You scramble over awkwardly…' : 'You can\'t get over it!') };
        }
        if (type === 'none') return { allowed: true, message: '' };
        const pc = window.playerContext;
        const strict = !!window.__strictBreakReq;
        if (type === 'hobby') {
            const hobby = (meta.jumpReqHobby || '').trim();
            if (!hobby) return { allowed: true, message: '' };
            if (pc && Array.isArray(pc.hobbies)) {
                if (pc.hobbies.map(h => String(h).toLowerCase()).includes(hobby.toLowerCase())) return { allowed: true, message: '' };
                return { allowed: false, message: 'You can\'t quite vault that.' };
            }
            return { allowed: !strict, message: '' };
        }
        // stat (default reflexes)
        const stat = meta.jumpReqStat || 'reflexes';
        const need = (meta.jumpReqValue != null ? parseInt(meta.jumpReqValue, 10) : 4) || 0;
        const label = stat.charAt(0).toUpperCase() + stat.slice(1);
        if (pc && pc.stats && typeof pc.stats[stat] === 'number') {
            if (pc.stats[stat] >= need) return { allowed: true, message: '' };
            return { allowed: false, message: 'You need ' + need + ' ' + label + ' to clear that.' };
        }
        return { allowed: !strict, message: '' };
    }
    // #4/#7: the one-shot interaction-text panel. While shown, Space dismisses
    // it (and movement is blocked). dismissTextPanel() is set when a panel is up.
    let dismissTextPanel = null;

    // Listen on document.body — clicks inside the page bubble here, and key
    // events will route here even when focus is on a freshly-removed button
    // or the iframe wrapper. (window-level keydown listeners can stop firing
    // inside iframes after a focus transition; document.body is more robust.)
    function _keydownHandler(e) {
        // DIAGNOSTIC: backtick (`) toggles a tiny overlay showing the
        // movement state machine. If movement ever freezes, press ` and
        // read out gapPromptActive / isMov / isJump — those three values
        // tell us exactly which flag is stuck. This runs BEFORE any of the
        // early-return guards so it works even when input is otherwise
        // "frozen". Remove this block once the freeze is diagnosed.
        if (e.key === '`' || e.key === '~') {
            let dbg = document.getElementById('_state-dbg');
            if (!dbg) {
                dbg = document.createElement('div');
                dbg.id = '_state-dbg';
                dbg.style.cssText = 'position:fixed; top:8px; left:8px; z-index:99999; background:rgba(0,0,0,0.85); color:#0f0; font:12px monospace; padding:6px 10px; border:1px solid #0f0; white-space:pre;';
                document.body.appendChild(dbg);
                dbg._timer = setInterval(() => {
                    let camPos = 'n/a', camAng = 'n/a';
                    try { if (camManager && camManager.activeCam) { const p = camManager.activeCam.position; camPos = p.x.toFixed(1)+','+p.y.toFixed(1)+','+p.z.toFixed(1); camAng = (camManager.isoAngle).toFixed(2); } } catch (e) {}
                    dbg.textContent =
                        'FRAME COUNTER: ' + _frameCount + '   <- must keep rising\n' +
                        '  (if frozen, the rAF loop has stopped)\n' +
                        'gapPromptActive: ' + gapPromptActive + '\n' +
                        'isMov: ' + isMov + '   isJump: ' + isJump + '   isSit: ' + isSit + '\n' +
                        'isCinematic: ' + (camManager ? camManager.isCinematic : 'n/a') + '\n' +
                        'pX,pZ,pFlr: ' + pX + ',' + pZ + ',' + pFlr + '\n' +
                        'player.pos: ' + player.position.x.toFixed(1)+','+player.position.y.toFixed(1)+','+player.position.z.toFixed(1) + '\n' +
                        'camera.pos: ' + camPos + '\n' +
                        'isoAngle: ' + camAng + '\n' +
                        'activeKeys: ' + JSON.stringify(activeKeys) + '\n' +
                        'gap-ui present: ' + !!document.getElementById('gap-ui');
                }, 100);
            } else {
                clearInterval(dbg._timer); dbg.remove();
            }
            return;
        }
        // Pickup prompt is open?  Route E/Enter/Space → take, Esc/N → leave,
        // and swallow everything else so movement keys don't queue behind it.
        if (pickupPromptActive) {
            const pk = (e.key || '').toLowerCase();
            if (pk === 'g' || pk === 'enter' || pk === ' ' || pk === 'spacebar') { e.preventDefault(); if (window.__doPickupChoice) window.__doPickupChoice('take'); }
            else if (pk === 'escape' || pk === 'n') { e.preventDefault(); if (window.__doPickupChoice) window.__doPickupChoice('leave'); }
            return;
        }
        // #13: while overhearing, Space advances the exchange; Esc stops listening.
        if (usherActive) {   // #13: G/Space/Enter advance the usher's lines (Esc skips to the end)
            const uk = (e.key || '').toLowerCase();
            if (uk === ' ' || uk === 'spacebar' || uk === 'enter' || uk === 'g') { e.preventDefault(); advanceUsher(); }
            else if (uk === 'escape') { e.preventDefault(); closeUsher(); }
            return;
        }
        if (eavesdropActive) {
            const ek = (e.key || '').toLowerCase();
            if (ek === ' ' || ek === 'spacebar' || ek === 'enter' || ek === 'g') { e.preventDefault(); advanceEavesdrop(); }
            else if (ek === 'escape') { e.preventDefault(); closeEavesdrop(); }
            return;
        }
        // #7: while the concession shop is open, Up/Down choose, Enter/Space buy,
        // Esc closes.
        if (shopActive) {
            const sk = (e.key || '').toLowerCase();
            if (sk === 'arrowup' || sk === 'w') { e.preventDefault(); shopMove(-1); }
            else if (sk === 'arrowdown' || sk === 's') { e.preventDefault(); shopMove(1); }
            else if (sk === 'enter' || sk === ' ' || sk === 'spacebar' || sk === 'g') { e.preventDefault(); shopBuy(); }
            else if (sk === 'escape' || sk === 'q') { e.preventDefault(); closeShop(); }
            return;
        }
        // Gap prompt is open?  Let ESC cancel it; swallow everything else
        // so movement keys don't queue up behind it.
        if (gapPromptActive) {
            if (e.key === 'Escape') { window.doGapAction('cancel'); }
            return;
        }
        // the HOST command prompt is open (the player is typing a command in
        // the terminal). Swallow ALL movement/camera keys so letters like w/a/s/d/
        // t/q/e/v typed into the prompt don't also drive the engine. The host's
        // Enter/Escape handling still runs (this is a separate listener).
        try {
            if ((typeof window.__hostPromptOpen === 'function' && window.__hostPromptOpen())) return;
        } catch (e2) {}
        // While a Saymaker conversation is playing, capture input for it:
        // Space advances a line; Escape ends the conversation. Block
        // movement/camera keys so the player can't walk off mid-dialogue.
        if (window.DialogueRuntime && window.DialogueRuntime.isActive()) {
            if (e.key === ' ' || e.key === 'g' || e.key === 'G') { e.preventDefault(); window.DialogueRuntime.advance(); }   // #5: G advances dialogue
            else if (e.key === 'Escape') { window.DialogueRuntime.endConversation(); }
            return;
        }
        // #4/#7: a one-shot interaction-text panel is up — Space dismisses it
        // (and we block movement underneath so you don't walk off reading it).
        if (dismissTextPanel) {
            if (e.key === ' ' || e.key === 'g' || e.key === 'G' || e.key === 'Escape') {   // #1: G advances generic dialogue too
                e.preventDefault();
                // #1/#10: the FIRST advance (Space or G) reveals the rest of a still-typing
                // line; only once it's fully shown does it dismiss the panel.
                if ((e.key === ' ' || e.key === 'g' || e.key === 'G') && typeof window.__genericDlgTyping === 'function' && window.__genericDlgTyping()) return;
                dismissTextPanel();
            }
            return;
        }
        if (isClimb || isJump) return;   // climbs / jumps are committed animations
        if (isMov) {
            // #10: let a movement/turn key INTERRUPT a step once it's past the
            // halfway point — commit the current tile and fall through to process
            // the new direction immediately, instead of forcing you to wait for the
            // glide to finish and press again. Non-move keys (and early presses)
            // still wait. Auto-repeat (held key) is excluded; it already chains.
            const _mk = (e.key || '').toLowerCase();
            const _isMoveKey = !e.__auto && ['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(_mk);
            const _dNow = Math.hypot(tPos.x - player.position.x, tPos.z - player.position.z);
            if (_isMoveKey && _dNow < 0.5) {
                player.position.x = tPos.x; player.position.z = tPos.z; isMov = false;   // commit this tile, then handle the new key below
            } else {
                return;
            }
        }
        const k = e.key.toLowerCase();
        if (k === 'f' && CONFIG.settings.flashlight) { lightingManager.toggleFlashlight(); return; }
        // crouch-sneak toggle. While crouched, NPCs see you from ~half the
        // distance. 'x' toggles it (also lowers the player silhouette a touch).
        if (k === 'x') { if (window.engineSetCrouch) window.engineSetCrouch(!window.__playerCrouching); showMsg(window.__playerCrouching ? 'Crouching — hidden behind cover, quieter.' : 'Standing.'); try { maybeEavesdrop(); } catch (e) {} return; }   // #12: crouching IN PLACE on an eavesdrop tile (e.g. in front of Jeff's counter) now triggers the overhear, not just stepping onto it while already crouched
        if (k === 'm' && (CONFIG.settings.minimapMode !== 'off' && CONFIG.settings.minimapMode !== 'none')) { toggleMinimapMini(); return; }
        // [ and ] PEEK other floors on the minimap/directory (display
        // only — you stay put). Lands back on your floor when you peek past it.
        if ((k === '[' || k === ']') && MAP.length > 1) {
            const cur = (typeof mmPeek === 'number' && MAP[mmPeek]) ? mmPeek : pFlr;
            let nf = cur + (k === ']' ? 1 : -1);
            nf = Math.max(0, Math.min(MAP.length - 1, nf));
            mmPeek = (nf === pFlr) ? null : nf;
            const shown = (mmPeek == null ? pFlr : mmPeek);
            showMsg('Minimap: viewing FLOOR ' + (shown + 1) + '/' + MAP.length + (mmPeek == null ? ' (your floor)' : ' (peek)'));
            try { if (typeof renderMinimapMini === 'function') renderMinimapMini(); } catch (e) {}
            const dc = document.getElementById('minimap-canvas');
            if (dc && dc.getContext) { try { _drawMinimap(dc.getContext('2d'), Math.floor(dc.width / CONFIG.map[0][0].length), true); } catch (e) {} }
            return;
        }
        if (k === 'c' && CONFIG.settings.compassMode !== 'off') { const c = document.getElementById('wasd-indicator'); if(c) c.style.display = c.style.display === 'none' ? 'flex' : 'none'; const c2 = document.getElementById('compass-ui'); if (c2) c2.style.display = c2.style.display === 'none' ? 'block' : 'none'; return; }

        // FIRST-PERSON CONTROL SCHEMES. When the camera is actually in
        // first-person, movement is FACING-relative and Q/E mean something
        // different than the iso camera-orbit. Two schemes (player setting
        // window.fpsControlScheme, default 'crawler'):
        //   'crawler' (Dungeon Crawler): W=fwd S=back A=strafe-L D=strafe-R
        //                                Q=turn-left E=turn-right
        //   'retro'   (Retro FPS):       W=fwd S=back A=turn-L D=turn-R
        //                                Q=strafe-L E=strafe-R
        // We handle these here, BEFORE camManager claims Q/E, and return.
        {
            let inFps = false;
            if (CONFIG.settings.camMode === 'fps') inFps = true;
            else if ((CONFIG.settings.camMode === 'fps_toggle' || CONFIG.settings.camMode === 'fps_zoom') && camManager && camManager.activeCam === camManager.perspCamera) inFps = true;
            if (inFps && ['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
                const scheme = (typeof window !== 'undefined' && window.fpsControlScheme) ? window.fpsControlScheme : 'crawler';
                // Current facing as a cardinal index (0=N -Z,1=E +X,2=S +Z,3=W -X).
                // derive from the COMMITTED target tRot, not the live (possibly
                // mid-sweep) player.rotation.y, so rapid turns don't misread.
                const faceFromRot = () => {
                    let a = ((tRot % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
                    if (Math.abs(a - 0) < 0.6 || Math.abs(a - Math.PI*2) < 0.6) return 0;       // N
                    if (Math.abs(a - Math.PI/2) < 0.6) return 3;                                 // W
                    if (Math.abs(a - Math.PI) < 0.6) return 2;                                   // S
                    if (Math.abs(a - 3*Math.PI/2) < 0.6) return 1;                               // E
                    return 0;
                };
                const rotForDir = [0, -Math.PI/2, Math.PI, Math.PI/2];   // index→player.rotation.y
                const turn = (delta) => {
                    if (e.__auto) return;   // #6: auto-repeat (held-key continue) never turns, only steps
                    let f = faceFromRot();
                    f = (f + delta + 4) % 4;
                    // set the TARGET rotation only — the anim loop eases
                    // player.rotation.y toward tRot for a smooth visible turn.
                    tRot = rotForDir[f];
                    updateCompass();
                };
                const stepDir = (cardIdx) => {
                    const dirMap = [[0,-1,'n'],[1,0,'e'],[0,1,'s'],[-1,0,'w']];
                    const [dx,dz,dS] = dirMap[cardIdx];
                    // gate by allowed directions
                    if ((dS==='n'&&!CONFIG.settings.camN)||(dS==='e'&&!CONFIG.settings.camE)||(dS==='s'&&!CONFIG.settings.camS)||(dS==='w'&&!CONFIG.settings.camW)) return;
                    if (isSit) { isSit = false; if (player.userData.setSeated) player.userData.setSeated(false); tPos.set(pX, pFlr*FLR_H, pZ); player.position.y = pFlr*FLR_H; }
                    if (!checkCollision(pX+dx, pZ+dz, pFlr, dS, false)) {
                        if (gapPromptActive) return;
                        pX += dx; pZ += dz; tPos.x = pX; tPos.z = pZ; isMov = true; lastMoveTime = Date.now();
                        let co = MAP[pFlr][pZ][pX].o;
                        if (co?.v === 'ladder') { const _t = floorTargetFrom(pFlr, pX, pZ); if (_t >= 0) showMsg('Press SPACE to climb the ladder.'); }   // stairs auto-walk (no prompt); ladders still prompt
                        if (MAP[pFlr][pZ][pX].f?.meta?.isWarp) executeWarp(MAP[pFlr][pZ][pX].f.meta);
                    }
                };
                const face = faceFromRot();
                const forward = face, back = (face+2)%4, left = (face+3)%4, right = (face+1)%4;
                const isW = (k==='w'||k==='arrowup'), isS = (k==='s'||k==='arrowdown'), isA = (k==='a'||k==='arrowleft'), isD = (k==='d'||k==='arrowright');
                if (isW) { stepDir(forward); return; }
                if (isS) { stepDir(back); return; }
                if (scheme === 'retro') {
                    if (isA) { turn(-1); return; }    // turn left
                    if (isD) { turn(1); return; }     // turn right
                    if (k === 'q') { stepDir(left); return; }   // strafe left
                    if (k === 'e') { stepDir(right); return; }  // strafe right
                } else {  // crawler (default)
                    if (isA) { stepDir(left); return; }   // strafe left
                    if (isD) { stepDir(right); return; }  // strafe right
                    if (k === 'q') { turn(-1); return; }  // turn left
                    if (k === 'e') { turn(1); return; }   // turn right
                }
                return;
            }
        }

        // Let camManager claim Q/E (rotate), T (tilt), V (toggle FPS) first.
        if (camManager && camManager.handleKeyDown(k)) { updateCompass(); return; }

        // Shift is the FACING modifier again (turn in place without
        // stepping) — handled in the movement block below. Jumping moved to
        // Space (when not facing something interactable). A bare Shift press
        // with no direction does nothing on its own.
        if (k === 'shift') return;

        // ── INTERACTION KEY (Space) ──
        // Tries, in order:
        //   1. NPC or signed object directly in front of player
        //   2. NPC behind a counter (one tile further)
        //   3. Paintable window in front (opens in-game painter)
        //   4. Pickable / sittable / directory / switch / warp / readable
        //   5. Door at the edge in front (open/close/locked)
        if (k === 'g' || k === ' ') {
            // #5: G = INTERACT (talk/door/read/pickup/climb), SPACE = JUMP. One
            // handler split by _jk: interact actions gated to G; the jump section
            // gated to Space and always commits a jump. (G chosen because E is
            // camera-rotate.)
            const _jk = (k === ' ');
            if (camManager && camManager.isCinematic) return; // ignore during swoops
            // DELIBERATE floor change. Standing on a ladder/stairs tile,
            // SPACE takes you up/down. (It used to fire automatically the instant you
            // stepped onto the tile, so crossing the ladder/stairs tops on an upper
            // floor silently dropped you — the "teleport out without warning" bug.)
            {
                const onObj = MAP[pFlr] && MAP[pFlr][pZ] && MAP[pFlr][pZ][pX] && MAP[pFlr][pZ][pX].o;
                if (!_jk && onObj && (onObj.v === 'ladder' || onObj.v === 'stairs')) {
                    const t = floorTargetFrom(pFlr, pX, pZ);
                    if (t >= 0 && t !== pFlr) {
                        // animated climb: ladders rise on the same tile; stairs step off the top.
                        const land = (onObj.v === 'stairs') ? computeStairLanding(pX, pZ, pFlr, t, onObj.meta) : { x: pX, z: pZ };
                        startClimb(t, onObj.v, land.x, land.z); return;
                    }
                }
            }
            // Figure out which tile is "in front" given the player's facing.
            let ix = pX + (tRot === -Math.PI / 2 ? 1 : (tRot === Math.PI / 2 ? -1 : 0)); let iz = pZ + (tRot === Math.PI ? 1 : (tRot === 0 ? -1 : 0));
            // Facing a LADDER → climb it. Ladders are SOLID (you can't walk through
            // or stand on them), so you face one and press SPACE. You land on the
            // floor tile you're standing on, one floor up/down (in front of the
            // ladder) — never inside the solid ladder tile.
            {
                const fLad = MAP[pFlr] && MAP[pFlr][iz] && MAP[pFlr][iz][ix] && MAP[pFlr][iz][ix].o;
                if (!_jk && fLad && fLad.v === 'ladder') {
                    const t = floorTargetFrom(pFlr, ix, iz);
                    if (t >= 0 && t !== pFlr) {
                        const dest = MAP[t] && MAP[t][pZ] && MAP[t][pZ][pX];
                        const lx = (dest && dest.f) ? pX : ix, lz = (dest && dest.f) ? pZ : iz;
                        startClimb(t, 'ladder', lx, lz); return;
                    }
                }
            }
            let npc = npcs.find(n => n.x === ix && n.z === iz && n.f === pFlr);
            // Robust NPC pickup: with 8-direction (diagonal) facing, the cardinal
            // ix/iz above can miss an NPC standing right beside you — which left
            // most NPCs "silent". Fall back to the adjacent (incl. diagonal) NPC
            // most aligned with the way you're facing, so a rough face + Space talks.
            if (!npc) {
                const fX = -Math.sin(tRot), fZ = -Math.cos(tRot);   // forward vector (x,z)
                // #10: you must actually FACE the NPC. dot > 0.5 ≈ within 60° of the
                // way you're looking — so an NPC directly ahead or diagonally ahead
                // counts, but one merely BESIDE you (≈90°) or behind does NOT. (Was
                // -0.05 ≈ 95°, which let you talk to anyone standing next to you.)
                let bestDot = 0.5;
                for (const n of npcs) {
                    if (n.f !== pFlr) continue;
                    const dx = n.x - pX, dz = n.z - pZ;
                    if (Math.abs(dx) > 1 || Math.abs(dz) > 1 || (dx === 0 && dz === 0)) continue;
                    const len = Math.hypot(dx, dz) || 1;
                    const dot = (dx / len) * fX + (dz / len) * fZ;
                    if (dot > bestDot) { bestDot = dot; npc = n; }
                }
            }
            let sgn = interactables.find(i => i.x === ix && i.z === iz && i.f === pFlr && i.obj?.meta?.text);
            let dStr = tRot === 0 ? 'n' : (tRot === Math.PI ? 's' : (tRot === -Math.PI / 2 ? 'e' : 'w')); let oppDir = dStr === 'n' ? 's' : (dStr === 's' ? 'n' : (dStr === 'e' ? 'w' : 'e'));
            let edgeInter = interactables.find(i => i.f === pFlr && i.dir && ((i.x === pX && i.z === pZ && i.dir === dStr) || (i.x === ix && i.z === iz && i.dir === oppDir)));

            // Counter shortcut: if you're facing a counter with an NPC behind it,
            // talk to that NPC (skip the counter itself).
            if (!npc && edgeInter && edgeInter.obj?.v === 'counter') {
                let ixx = ix + (tRot === -Math.PI / 2 ? 1 : (tRot === Math.PI / 2 ? -1 : 0)); let izz = iz + (tRot === Math.PI ? 1 : (tRot === 0 ? -1 : 0));
                npc = npcs.find(n => n.x === ixx && n.z === izz && n.f === pFlr);
            }

            // #20: a MOVIE POSTER on the wall you're facing — Space tells you what's
            // showing. Posters are edge attachments (v:'poster', posterTitle). Only
            // when there's no NPC to talk to in front.
            if (!npc) {
                const _pe1 = MAP[pFlr] && MAP[pFlr][pZ] && MAP[pFlr][pZ][pX] && MAP[pFlr][pZ][pX][dStr];
                const _pe2 = MAP[pFlr] && MAP[pFlr][iz] && MAP[pFlr][iz][ix] && MAP[pFlr][iz][ix][oppDir];
                const _pe3 = MAP[pFlr] && MAP[pFlr][iz] && MAP[pFlr][iz][ix] && MAP[pFlr][iz][ix][dStr];   // poster on the FAR wall of the tile ahead
                const _posterOf = (edge) => (edge && edge.meta && Array.isArray(edge.meta.attachments)) ? edge.meta.attachments.find(a => a && a.v === 'poster' && (a.posterTitle || a.posterComment)) : null;
                const _poster = _posterOf(_pe1) || _posterOf(_pe2) || _posterOf(_pe3);
                if (!_jk && _poster) {
                    // #L: interaction mode — 'view' shows only the top caption (handled
                    // each frame), so G does nothing here; 'interact'/'both' pop the
                    // player's commentary (or the title) as a message on G.
                    const _pm = _poster.interactMode || 'interact';
                    if (_pm !== 'view') {
                        showStickyMsg(_poster.posterComment || ('Now showing: ' + (_poster.posterTitle || 'a movie')));   // #14: stays until dismissed
                        return;
                    }
                }
            }

            // SPACE = DIRECTIONAL JUMP. First, see if the thing in front is
            // jump-OVER-able (a jumpable edge/counter, an open or broken-out
            // window edge, a jumpable center prop, or a walkable tile beyond a
            // gap). If so, run the jump skill check and — on success — vault to
            // the LANDING tile beyond the obstacle. If nothing jumpable is in
            // front and nothing interactable either, just hop in place. If
            // something interactable is in front, fall through to interact.
            if (_jk) {   // #5: jump section — Space only
                const isJumpableEdge = (edge) => {
                    if (!edge) return false;
                    if (edge.meta && edge.meta.jumpable) return true;          // explicitly jumpable
                    if (edge.v === 'counter') return true;  // plain counters vault; counter_doors OPEN (handled at the door step below), so they're NOT jumpable here
                    // an open door or a broken-out / non-solid window edge: passable, not "jumped"
                    return false;
                };
                const e1 = MAP[pFlr]?.[pZ]?.[pX]?.[dStr];
                const e2 = MAP[pFlr]?.[iz]?.[ix]?.[oppDir];
                const frontEdgeJumpable = isJumpableEdge(e1) || isJumpableEdge(e2);
                const frontObj = MAP[pFlr]?.[iz]?.[ix]?.o;
                const frontObjJumpable = frontObj && frontObj.meta && frontObj.meta.jumpable;
                // landing tile = one tile PAST the obstacle in the facing dir
                const lx = ix + (ix - pX), lz = iz + (iz - pZ);
                const landInBounds = lx >= 0 && lx < W && lz >= 0 && lz < H;

                // Only VAULT when there's nothing better to do: never vault if
                // there's an NPC to talk to (including one across the counter —
                // talk-across-counter beats vault), and never vault a counter_door
                // (it opens). Those fall through to the talk / door steps below.
                if ((frontEdgeJumpable || frontObjJumpable) && !npc) {
                    // Gather the obstacle's own jump gate (if any) for the check.
                    const obMeta = (e1 && e1.meta && e1.meta.jumpable) ? e1.meta
                                 : (e2 && e2.meta && e2.meta.jumpable) ? e2.meta
                                 : (frontObjJumpable ? frontObj.meta : {});
                    const chk = checkJumpRequirement(obMeta);
                    // FAILURE — pushed back. Don't move; play a recoil hop in
                    // place and a thud. (outcome 'fail' OR a non-skill gate that
                    // returned not-allowed.)
                    if (!chk.allowed) {
                        showMsg(chk.message || 'You can\'t clear that.'); playSnd('error');
                        // Visible recoil: a tiny back-hop in place.
                        isJump = true; jumpStyle = 'recoil'; jumpProgress = 0; jumpStartPos.copy(player.position);
                        if (!isMov) { isMov = true; tPos.copy(player.position); }
                        return;
                    }
                    // PARTIAL (skill check scrape) → slow CLIMB animation; PASS →
                    // smooth VAULT. Non-skill gates pass through as a vault.
                    jumpStyle = (chk.outcome === 'partial') ? 'climb' : 'vault';
                    // Land beyond the obstacle if that tile is reachable; otherwise
                    // land ON the obstacle tile (e.g. hopping onto a counter end).
                    let dest = null;
                    if (landInBounds && MAP[pFlr][lz][lx].f && !(MAP[pFlr][lz][lx].o && MAP[pFlr][lz][lx].o.meta && MAP[pFlr][lz][lx].o.meta.solid)) {
                        dest = { x: lx, z: lz };
                    } else if (MAP[pFlr]?.[iz]?.[ix]?.f) {
                        dest = { x: ix, z: iz };
                    }
                    if (dest) {
                        showMsg(jumpStyle === 'climb' ? 'You clamber over.' : 'Vaulted over!');
                        pX = dest.x; pZ = dest.z; tPos.x = pX; tPos.z = pZ;
                        isMov = true; isJump = true; jumpProgress = 0; jumpStartPos.copy(player.position);
                        playSnd('click');
                        return;
                    }
                    // No valid landing — just hop in place.
                    isJump = true; jumpProgress = 0; jumpStartPos.copy(player.position);
                    if (!isMov) { isMov = true; tPos.copy(player.position); }
                    return;
                }

                // Nothing jumpable: hop in place, or forward over a gap if moving.
                // (Space always jumps, even facing an NPC/door/window — interacting
                // is G, since #5.)
                if (!isJump && !isMov) {   // #5: Space always jumps even facing an NPC
                    // jump FORWARD only if the player is actively moving in
                    // that direction (a move key was pressed recently). Otherwise
                    // jump straight up in place.
                    const movingForward = (Date.now() - lastMoveTime) < 350;
                    if (movingForward && !checkCollision(pX + (ix - pX), pZ + (iz - pZ), pFlr, dStr, true) && (ix !== pX || iz !== pZ)) {
                        pX = ix; pZ = iz; tPos.x = pX; tPos.z = pZ; isMov = true;
                    }
                    isJump = true; jumpProgress = 0; jumpStartPos.copy(player.position);
                    if (!isMov) { isMov = true; tPos.copy(player.position); }
                    return;
                }
            }

            // Rope barrier? If it's openable, "unhook" it: hide the rope and
            // clear the edge solidity so the player can pass. Toggle back on a
            // second interaction.
            {
                let ropeDoor = doorObjects.find(d => d.isRope && d.f === pFlr && ((d.x === pX && d.z === pZ && d.dir === dStr) || (d.x === ix && d.z === iz && d.dir === oppDir)));
                if (ropeDoor) {
                    if (ropeDoor.edgeMeta && ropeDoor.edgeMeta.openable === false) { showMsg('The rope is fixed in place.'); playSnd('error'); return; }
                    ropeDoor.isOpen = !ropeDoor.isOpen;
                    if (ropeDoor.ropeGrp) ropeDoor.ropeGrp.visible = !ropeDoor.isOpen;
                    // Update collision on both shared edges.
                    let rE1 = MAP[pFlr][pZ][pX][dStr], rE2 = MAP[pFlr][iz]?.[ix]?.[oppDir];
                    [rE1, rE2].forEach(e => { if (e && e.v === 'rope' && e.meta) e.meta.solid = !ropeDoor.isOpen; });
                    showMsg(ropeDoor.isOpen ? 'Unhooked the rope.' : 'Hooked the rope back.');
                    playSnd('click');
                    return;
                }
            }

            // Paintable window? Open the in-game paint canvas — but ONLY if THIS
            // window opted in (meta.allowDraw, per-window, off by default). We
            // look from BOTH sides; the side determines which FACE gets painted.
            // on the player's OWN tile, only a window in the FACING
            // direction counts. The old oppDir clause matched the window BEHIND
            // you, so facing a bench while standing at a window opened the painter.
            let paintWin = paintableWindows.find(w =>
                (w.x === pX && w.z === pZ && w.dir === dStr) ||
                (w.x === ix && w.z === iz && (w.dir === dStr || w.dir === oppDir)));
            // Which face is the player on? If the glass edge sits on the player's
            // own tile in their facing dir, they're on the "near" face; otherwise
            // the "far" face. We paint only that face (#draw-one-side).
            if (paintWin) {
                const ownedHere = (MAP[pFlr][pZ][pX][dStr] && (MAP[pFlr][pZ][pX][dStr].v === 'glass_full' || MAP[pFlr][pZ][pX][dStr].v === 'window_insert'));
                paintWin.paintFar = !ownedHere;     // true → decal on the far face
                paintWin.approachDir = dStr;
            }
            // Is this window ALSO breakable? If a window can do both, prompt which.
            const canDraw  = !!(paintWin && paintWin.meta && paintWin.meta.allowDraw);
            // Breakable window? Check the break requirement and, if met, shatter
            // it. We wrap the shatter in a local doBreak() so a "draw or break?"
            // chooser can trigger it on demand.
            const doBreak = () => {
                let gE1 = MAP[pFlr][pZ][pX][dStr];
                let gE2 = MAP[pFlr][iz]?.[ix]?.[oppDir];
                let glassEdge = ([gE1, gE2].find(e => e && (e.v === 'glass_full' || e.v === 'window_insert') && e.meta && e.meta.breakable));
                if (glassEdge && glassEdge.meta.breakBothSides === false) {
                    const ownedHere = (gE1 && gE1 === glassEdge);
                    if (!ownedHere) { showMsg('You can only break this from the other side.'); glassEdge = null; }
                }
                if (glassEdge) {
                    const r = checkBreakRequirement(glassEdge.meta);
                    if (!r.allowed) {
                        showMsg(r.message); playSnd('error');
                        if (r.outcome === 'fail') {
                            const dmg = (glassEdge.meta.breakFailDamage != null) ? +glassEdge.meta.breakFailDamage : 1;
                            if (dmg > 0) playerHurt(dmg, 'bounced off the glass');
                        }
                        return;
                    }
                    if (gE1 && (gE1.v === 'glass_full' || gE1.v === 'window_insert')) MAP[pFlr][pZ][pX][dStr] = null;
                    if (gE2 && (gE2.v === 'glass_full' || gE2.v === 'window_insert')) MAP[pFlr][iz][ix][oppDir] = null;
                    wallMeshes.forEach(m => {
                        const u = m.userData;
                        if (!u || u.f !== pFlr || !u.isGlassEdge) return;
                        if ((u.ex === pX && u.ez === pZ && u.edir === dStr) ||
                            (u.ex === ix && u.ez === iz && u.edir === oppDir)) m.visible = false;
                    });
                    spawnGlassShards(ix, iz, pFlr, glassEdge.meta);
                    spawnGlassShards(pX, pZ, pFlr, glassEdge.meta);
                    showMsg('The glass shatters!'); playSnd('error');
                }
            };
            const canBreak = (() => {
                const a = MAP[pFlr][pZ][pX][dStr], b = MAP[pFlr][iz]?.[ix]?.[oppDir];
                return [a, b].some(e => e && (e.v === 'glass_full' || e.v === 'window_insert') && e.meta && e.meta.breakable);
            })();
            if (canDraw && canBreak && typeof window.engineOpenWindowChoice === 'function') {
                window.engineOpenWindowChoice({
                    onDraw:  () => { if (typeof window.openInGamePainter === 'function') window.openInGamePainter(paintWin); },
                    onBreak: () => { doBreak(); },
                });
                return;
            }
            if (canDraw && !canBreak && typeof window.openInGamePainter === 'function') { window.openInGamePainter(paintWin); return; }
            if (canBreak) { doBreak(); return; }

            // Talk to NPC / read a sign — both share the same dialogue UI.
            let tgt = npc || sgn;
            if (tgt) {
                // mark this NPC as talked-to so a "wave until talked"
                // idle animation stops greeting once the player engages them. Set on
                // the npc record (not signs) regardless of which dialogue path runs.
                if (npc) npc._talkedTo = true;
                // #17: turn an NPC to face you when you start talking to them — but
                // NOT ones with reqFacing (their heading is meaningful: an unspotted
                // NPC like Jeff stays turned away so you can sneak up — see #12), and
                // NOT while you're sneaking (crouched). lookAt at the NPC's own height
                // keeps them upright (yaw only).
                if (npc && npc.m && !npc.meta.reqFacing && !window.__playerCrouching) {
                    try { npc.m.lookAt(player.position.x, npc.m.position.y, player.position.z); } catch (e) {}
                }
                // #7: a concession SHOP NPC (meta.shop) opens the purchase modal
                // instead of a one-line greeting.
                if (tgt.meta.shop) { openShop(tgt.meta.shopTitle || (tgt.meta.name ? tgt.meta.name + '\u2019s Concession' : 'Concession')); return; }
                // DEBUG-MENU NPCs with a conversation tree open an in-game
                // dialogue overlay instead of a one-shot action.
                if (tgt.meta.debugMenu && typeof window.engineOpenDialogue === 'function') {
                    window.engineOpenDialogue(tgt.meta);
                    return;
                }
                // #1b: simple one-shot DEBUG action NPCs.
                if (tgt.meta.debugAction && typeof window.engineDebugAction === 'function') {
                    window.engineDebugAction(tgt.meta.debugAction, tgt.meta.name || '');
                    return;
                }
                // reqFacing: NPC must be facing the player (within ±90°) or they're
                // "busy". #17: SNEAKING (crouched) bypasses this — the whole point of
                // creeping up behind a turned-away NPC like Jeff is to interact/overhear
                // them, so a crouched player is never told "they are busy". Also fixed:
                // the ±90° test now normalizes the angle difference to [0,π] so it reads
                // correctly however the two rotations happen to wrap (it used a raw
                // modulo on an absolute value, which misfired near the wrap point).
                if (tgt.meta.reqFacing && npc && !window.__playerCrouching) {
                    const raw = tgt.m.rotation.y - (tRot + Math.PI);
                    const diff = Math.abs(((raw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
                    if (diff > Math.PI / 2) { showMsg('They are busy.'); return; }
                }
                // Camera cinematic swoop (normal/close/fps/overhead). Lives on camManager.
                if (tgt.meta.swoopType && tgt.meta.swoopType !== 'none' && camManager) { let tgtPos = tgt.mesh ? tgt.mesh.position : tgt.m.position; camManager.startCinematic(tgt.meta.swoopType, tgtPos, player.position, tgt.meta.overheadZoomDist, tgt.meta.overheadRot); }
                // Stop any "stopOnInteract" PositionalAudio attached to the same meta object.
                let aObj = localAudios.find(a => a.meta === tgt.meta); if (aObj && aObj.meta.audioStopInteract) { aObj.audio.stop(); }
                // If a SAYMAKER dialogue file is attached, play the full
                // branching conversation (skill checks, camera moves, choices)
                // instead of the one-shot dialogue string. The runtime handles
                // its own overlay + Space-to-advance.
                if (tgt.meta.dialogueFile && window.DialogueRuntime) {
                    window.DialogueRuntime.start(tgt.meta.dialogueFile, { name: tgt.meta.name || 'Info', gender: tgt.meta.gender || '', mesh: tgt.mesh || tgt.m });
                    return;
                }
                // Show the bottom dialogue panel.
                //   • Default (meta.textTimed falsy): the panel STAYS until the
                //     player presses Space (handled by dismissTextPanel above).
                //   • meta.textTimed: auto-dismiss after meta.textDuration seconds
                //     (default 5), optionally showing a draining countdown bar.
                // #5/#17: when EMBEDDED in the full game the host page has no
                // #dialogue element, so build one on demand into #game-container.
                let diagEl = document.getElementById('dialogue');
                if (!diagEl) {
                    const host = document.getElementById('game-container') || document.body;
                    diagEl = document.createElement('div');
                    diagEl.id = 'dialogue';
                    // no inline style — the engine-injected #dialogue
                    // CSS (win95 dialogue-tree look, 17px) styles it in every shell.
                    diagEl.style.display = 'none';
                    host.appendChild(diagEl);
                }
                if (diagEl) {
                    // Resolve name/pronoun tokens against the player + this NPC.
                    let _npc = { name: tgt.meta.name || '', gender: tgt.meta.gender || '' };
                    // Never leave an NPC SILENT: if they have no scripted line, give
                    // a short generic one so talking to ANY NPC always responds.
                    const _genericNods = ['(They give you a nod.)', 'Busy day, huh?', 'Mornin\u2019.', 'How\u2019s it going?', '(They smile but say nothing much.)'];
                    let _body = tgt.meta.dialogue || tgt.meta.text || (npc ? _genericNods[(pX + pZ) % _genericNods.length] : '');
                    let _name = tgt.meta.name || 'Info';
                    if (window.GameTokens) {
                        const _tctx = { player: window.playerContext || {}, actors: { npc: _npc, speaker: _npc } };
                        _body = window.GameTokens.resolve(_body, _tctx);
                        _name = window.GameTokens.resolve(_name, _tctx);
                    }
                    const timed = !!tgt.meta.textTimed;
                    const showBar = timed && !!tgt.meta.textShowBar;
                    const durMs = Math.max(0.5, (tgt.meta.textDuration != null ? tgt.meta.textDuration : 5)) * 1000;
                    const hint = timed ? '' : ' <span style="opacity:0.55;font-size:0.8em;">[G]</span>';
                    // win95 dialogue-tree layout — speaker name in the
                    // blue title bar, the line in the gray body at the bigger font.
                    diagEl.innerHTML = '<div class="dlg-title">' + _name + '</div>' +
                        '<div class="dlg-body">' + _body + hint +
                        (showBar ? '<div id="dlg-timer-track" style="margin-top:10px;height:5px;background:rgba(0,0,0,0.2);border:1px solid #808080;overflow:hidden;"><div id="dlg-timer-bar" style="height:100%;width:100%;background:#000080;transition:none;"></div></div>' : '') +
                        '</div>';
                    diagEl.style.display = 'block';

                    // Clean up any previous panel timers/raf.
                    let _to = null, _raf = null, _typeTimer2 = null;
                    const close = () => {
                        if (_to) clearTimeout(_to);
                        if (_raf) cancelAnimationFrame(_raf);
                        if (_typeTimer2) { clearInterval(_typeTimer2); _typeTimer2 = null; }
                        diagEl.style.display = 'none';
                        dismissTextPanel = null;
                        window.__genericDlgTyping = null;
                        if (camManager) camManager.stopCinematic();
                    };
                    dismissTextPanel = close;   // Space (handled above) calls this

                    // #10: TYPE the line out for plain one-liner NPCs (Marge, patrons,
                    // …) — same Earthbound feel as the trees. HTML/timed lines show at
                    // once. Space reveals the rest first, THEN dismisses (the keydown
                    // gate checks __genericDlgTyping before calling close).
                    window.__genericDlgTyping = null;
                    {
                        const _set = (window.State && State.settings) || {};
                        const _SPD = { slow: 28, medium: 19, medfast: 12, fast: 6, instant: 0 }   // #1: 2x faster (halved);
                        const _ms = (_SPD[_set.textSpeed] != null) ? _SPD[_set.textSpeed] : 24;
                        const _plain = (typeof _body === 'string' && _body.indexOf('<') === -1 && _body.length > 0);
                        if (_plain && _ms > 0 && !timed) {
                            const _be = diagEl.querySelector('.dlg-body');
                            let _tn = 0, _typing = true;
                            const _fin = () => { _typing = false; if (_typeTimer2) { clearInterval(_typeTimer2); _typeTimer2 = null; } if (_be) _be.innerHTML = _body + hint; };
                            if (_be) _be.innerHTML = hint;
                            _typeTimer2 = setInterval(() => {
                                _tn++;
                                if (_be) _be.innerHTML = _body.slice(0, _tn) + hint;
                                if (_tn % 2 === 0 && window.__npcBlip) { try { window.__npcBlip(_npc.gender, _name); } catch (e) {} }
                                if (_tn >= _body.length) _fin();
                            }, _ms);
                            window.__genericDlgTyping = () => { if (_typing) { _fin(); return true; } return false; };
                        }
                    }

                    if (timed) {
                        _to = setTimeout(close, durMs);
                        if (showBar) {
                            const bar = document.getElementById('dlg-timer-bar');
                            const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                            const tick = () => {
                                const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                                const frac = Math.max(0, 1 - (now - start) / durMs);
                                if (bar) bar.style.width = (frac * 100) + '%';
                                if (frac > 0 && dismissTextPanel === close) _raf = requestAnimationFrame(tick);
                            };
                            _raf = requestAnimationFrame(tick);
                        }
                    }
                    // (not timed → no timeout; waits for Space via dismissTextPanel)
                }
                return;
            }

            // Try a center-tile interactable (key/bench/dir/warp/switch/text).
            let centerInter = interactables.find(i => i.x === ix && i.z === iz && i.f === pFlr && !i.dir); let inter = edgeInter || centerInter;
            // YOUR CAR is forgiving: G anywhere right NEXT to it counts (the car
            // mesh overhangs a neighbouring tile, so players "facing the car" were
            // often facing the wrong tile and nothing happened).
            if (!inter && keyFetchCar && pFlr === keyFetchCar.f && Math.max(Math.abs(pX - keyFetchCar.x), Math.abs(pZ - keyFetchCar.z)) <= 1) {
                inter = interactables.find(i => i.x === keyFetchCar.x && i.z === keyFetchCar.z && i.f === keyFetchCar.f && i.obj && i.obj.v === 'car') || null;
            }
            // Someone else's car: say so (players couldn't tell which car was theirs).
            if (!inter) {
                const _fo = MAP[pFlr] && MAP[pFlr][iz] && MAP[pFlr][iz][ix] && MAP[pFlr][iz][ix].o;
                if (_fo && _fo.v === 'car' && !(_fo.meta && _fo.meta.keyId)) { showMsg(keyFetchCar ? 'Not your car. Yours is the one with the glint on the roof.' : 'Not your car.'); playSnd('error'); return; }
            }
            if (inter) {
                if (inter.obj?.v === 'key') {
                    const grp = inter.grp || inter.mesh;          // the whole key GROUP (body + sparkle)
                    inventory.push(inter.obj.meta.keyId); grp.visible = false; inter.x = -1;
                    // kill any sparkle on this object so it doesn't linger after pickup.
                    const spk = grp.userData && grp.userData.sparkle;
                    if (spk) { spk.visible = false; if (spk.parent) spk.parent.remove(spk); const si = sparkleObjects.findIndex(s => s.grp === spk); if (si >= 0) sparkleObjects.splice(si, 1); }
                    showMsg('Obtained: ' + pickupLabel(inter), 'bottom', null, 3000); updateInv(); playSnd('click');
                    try { if (window.engineLogEvent) window.engineLogEvent('Picked up: ' + pickupLabel(inter)); } catch (e) {}
                    return;
                }
                if (inter.obj?.v === 'car') {
                    // #7: the multiplex key lives INSIDE your car — interact to grab it
                    // (once). meta.keyTaken guards against taking it twice.
                    if (inter.obj.meta?.keyId && !inter.obj.meta.keyTaken) {
                        inventory.push(inter.obj.meta.keyId); inter.obj.meta.keyTaken = true;
                        showMsg('Got it \u2014 you grab the ' + (inter.obj.meta.keyLabel || 'multiplex key') + ' from your car.', 'bottom', null, 4000);
                        if (typeof updateInv === 'function') updateInv(); playSnd('click');
                        // the "this is your car" glint has done its job
                        const _cs = inter.grp && inter.grp.userData && inter.grp.userData.sparkle;
                        if (_cs) { _cs.visible = false; if (_cs.parent) _cs.parent.remove(_cs); const si = sparkleObjects.findIndex(s => s.grp === _cs); if (si >= 0) sparkleObjects.splice(si, 1); }
                        try { if (window.engineLogEvent) window.engineLogEvent('Got the ' + (inter.obj.meta.keyLabel || 'multiplex key') + ' from your car.'); } catch (e) {}
                    } else { showMsg('Just your car. Nothing else in it.'); }
                    return;
                }
                if (inter.obj?.v === 'bench' || inter.obj?.v === 'arcade_sit') {
                    isSit = true;
                    // #5 (FIX): rest the body ON the seat surface (bench/stool top ≈
                    // 0.55) instead of at floor level, so the hips sit on the seat and
                    // the forward-folded legs don't clip through the slab.
                    tPos.set(ix, (pFlr * FLR_H) + 0.05, iz);
                    // #27: don't sit SIDEWAYS across the bench. The seated pose folds the
                    // legs FORWARD along the player's facing, so we snap facing to the
                    // bench's sit axis (perpendicular to the slat) — legs then hang off
                    // the FRONT edge instead of clipping along the seat. Bench long-axis
                    // comes from meta.rot (even = X-long → sit facing N/S; odd = Z-long →
                    // sit facing E/W); of the two valid directions we pick whichever is
                    // closest to where the player is already looking so they don't spin.
                    const _brot = (((inter.obj.meta && inter.obj.meta.rot) || 0) % 4 + 4) % 4;
                    const _opts = (_brot % 2 === 0) ? [0, Math.PI] : [-Math.PI / 2, Math.PI / 2];
                    const _norm = a => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                    const _cur = _norm(tRot); let _best = _opts[0], _bd = 99;
                    for (const o of _opts) { let d = Math.abs(_norm(o) - _cur); d = Math.min(d, Math.PI * 2 - d); if (d < _bd) { _bd = d; _best = o; } }
                    tRot = _best; if (player.rotation) player.rotation.y = _best;
                    if (player.userData.setSeated) player.userData.setSeated(true);   // #16
                    return;
                }
                if (inter.obj?.v === 'dir' && typeof openDir === 'function') { openDir(); return; }
                if (inter.obj?.meta?.isWarp && warpHasDest(inter.obj.meta)) { executeWarp(inter.obj.meta); return; }
                if (inter.type === 'switch') {
                    playSnd('switch');
                    // Read the SWITCH's own linkId/intensity (copied onto obj.meta at
                    // build time), not the host wall's — the wall has no linkId.
                    const lid = (inter.obj && inter.obj.meta && inter.obj.meta.linkId) || inter.data.meta.linkId;
                    const lintensity = (inter.obj && inter.obj.meta && inter.obj.meta.intensity != null) ? inter.obj.meta.intensity : inter.data.meta.intensity;
                    lightingManager.toggleLightNetwork(lid, lintensity);
                    // track a coarse light level off the toggled network so the
                    // stealth system can shrink vision cones in the dark. Networks
                    // start ON, so initialise to true BEFORE flipping — otherwise the
                    // first toggle (lights→OFF) was read as ON and the cones grew
                    // instead of shrinking (and shrank when turned back on).
                    window.__lightNetOn = window.__lightNetOn || {};
                    if (window.__lightNetOn[lid] === undefined) window.__lightNetOn[lid] = true;
                    window.__lightNetOn[lid] = !window.__lightNetOn[lid];   // new state after this toggle
                    if (window.engineSetLightLevel) window.engineSetLightLevel(window.__lightNetOn[lid] ? 1 : 0.45);
                    return;
                }
                if (inter.obj?.meta?.text || inter.data?.meta?.text) { showMsg(inter.obj?.meta?.text || inter.data?.meta?.text, inter.obj?.meta?.textOffset || inter.data?.meta?.textOffset, inter.mesh); return; }
            }

            // Last resort: try to open a door in front of us. Uses the same shared
            // animateDoorOpen() helper as the walk-into path in checkCollision.
            let e1 = MAP[pFlr][pZ][pX][dStr]; let e2 = MAP[pFlr][iz]?.[ix]?.[oppDir]; let tEdge = e1 || e2;
            if (tEdge && (tEdge.v.startsWith('door') || tEdge.v === 'counter_door')) {
                let dObj = doorObjects.find(d => d.f === pFlr && ((d.x === pX && d.z === pZ && d.dir === dStr) || (d.x === ix && d.z === iz && d.dir === oppDir)));
                if (dObj) {
                    if (!dObj.isOpen && tEdge.meta.usher) { return triggerUsherDoor(dObj, tEdge); }   // #13: usher entrance
                    if (!dObj.isOpen && tEdge.meta.locked && !inventory.includes(tEdge.meta.reqKey)) { showMsg(tEdge.meta.lockedMsg || 'LOCKED'); playSnd('error'); return true; }
                    else if (dObj.animating) { return true; }   // #11: mid-swing — wait
                    else {
                        dObj.isOpen = !dObj.isOpen;
                        if (dObj.isOpen) {
                            // #11: gap opens only when the swing completes (no clip-through)
                            animateDoorOpen(dObj, tEdge, () => {
                                tEdge.meta.solid = false; if (e1) e1.meta.solid = false; if (e2) e2.meta.solid = false;
                            });
                        } else {
                            animateDoorOpen(dObj, tEdge);
                            tEdge.meta.solid = true; if (e1) e1.meta.solid = true; if (e2) e2.meta.solid = true;
                        }
                        return true;
                    }
                }
            }
            return;
        }

        // ── MOVEMENT (W/A/S/D + Arrow keys) — TRUE ISOMETRIC CONTROLS ──
        // The camera sits at a 45° isometric angle, so the world's cardinal
        // axes appear as DIAGONALS on screen. We map the keys so each one
        // moves the player along the screen diagonal that matches the key's
        // intuitive direction:
        //
        //   Camera default (isoAngle = 45°, looking from the SE toward NW):
        //     world -X (west)  appears UP-LEFT    on screen
        //     world -Z (north) appears UP-RIGHT   on screen
        //     world +X (east)  appears DOWN-RIGHT on screen
        //     world +Z (south) appears DOWN-LEFT  on screen
        //
        //   So:  W = up-left  = west   D = up-right  = north
        //        A = down-left= south  S = down-right= east
        //   (this is the "W = up-left" feel requested — each key is one tile
        //    step along a grid axis, rendered as a clean screen diagonal.)
        //
        // We further rotate the base mapping by the camera's current
        // InputOffset (how many 90° steps the camera has been turned with
        // Q/E), so the controls stay screen-relative as the camera rotates.
        //
        // FPS modes keep player-relative movement (handled below).
        let isoBaseDir = null;
        //   key → world cardinal index (0=N -Z, 1=E +X, 2=S +Z, 3=W -X)
        if (k === 'w' || k === 'arrowup')    isoBaseDir = 3;   // up-left  = West
        if (k === 'd' || k === 'arrowright') isoBaseDir = 0;   // up-right = North
        if (k === 's' || k === 'arrowdown')  isoBaseDir = 1;   // down-right = East
        if (k === 'a' || k === 'arrowleft')  isoBaseDir = 2;   // down-left = South
        if (isoBaseDir !== null) {
            // FPS movement (player-relative) applies when the camera is
            // ACTUALLY in first-person, not merely configured for a mode that
            // can become FPS. For 'fps' it's always FPS; for 'fps_toggle' and
            // 'fps_zoom' it depends on whether the perspective cam is active.
            let inFpsView = false;
            if (CONFIG.settings.camMode === 'fps') inFpsView = true;
            else if ((CONFIG.settings.camMode === 'fps_toggle' || CONFIG.settings.camMode === 'fps_zoom') && camManager && camManager.activeCam === camManager.perspCamera) inFpsView = true;
            const fpsMode = inFpsView;
            if (fpsMode) {
                // FPS: W = forward relative to facing. Use the player's facing
                // rather than the iso screen mapping.
                let camOffset = camManager ? camManager.InputOffset : 0;
                let fpsBase = (k === 'w' || k === 'arrowup') ? 0 : (k === 'd' || k === 'arrowright') ? 1 : (k === 's' || k === 'arrowdown') ? 2 : 3;
                activeKeys[k] = (fpsBase + camOffset) % 4;
            } else {
                // MOVEMENT MODE.
                //   'fixed'  (default) — W ALWAYS moves world-North (-Z), S south,
                //            A west, D east, regardless of how the camera is turned.
                //            This is the "W = north/forward no matter what" feel most
                //            games use; the camera-rotation no longer remaps the keys.
                //   'camera' — the older screen-relative scheme (W = up-left on the
                //            default iso view; keys rotate with the camera via
                //            camManager.InputOffset).
                // Default to 'fixed' when the map doesn't specify it, so EVERY map
                // (including ones exported before this setting existed) gets W=north
                // without needing a re-export. To restore the old behavior on a map,
                // set settings.movementMode = 'camera' in Mapster.
                const moveMode = CONFIG.settings.movementMode || 'camera'; // #1 batch: camera-relative is the default everywhere now (was 'fixed'); a map can still set movementMode:'fixed' to opt out
                if (moveMode === 'camera') {
                    // FFT-STYLE camera-relative mapping. Snap the controls to the
                    // camera's 45 deg orientation (8 steps) and look up the world
                    // dir for this key's SCREEN INTENT, so WASD rotate in lockstep
                    // with the view (see ISO8_DIR at top of file).
                    //   intent: 0=up(w) 1=right(d) 2=down(s) 3=left(a)
                    const off8 = camManager ? camManager.InputOffset8 : 0;
                    const intent = (k === 'w' || k === 'arrowup')    ? 0
                                 : (k === 'd' || k === 'arrowright')  ? 1
                                 : (k === 's' || k === 'arrowdown')   ? 2
                                 : 3;
                    activeKeys[k] = ISO8_DIR[off8][intent];
                } else {
                    // FIXED world mapping: W=N(0), D=E(1), S=S(2), A=W(3).
                    // No camera offset — the key's world direction never changes.
                    const fixedDir = { w: 0, arrowup: 0, d: 1, arrowright: 1, s: 2, arrowdown: 2, a: 3, arrowleft: 3 };
                    activeKeys[k] = fixedDir[k];
                }
            }
        }

        // Convert the locked world-direction into dx/dz + facing rotation.
        // CONFIG.settings.camN/E/S/W gates whether players may move/face that direction
        // (set in Mapster — "Allowed Camera Angles" checkboxes).
        if (activeKeys[k] !== undefined) {
            // if seated, the first movement key stands the player up
            // (restores the standing pose + height) before stepping.
            if (isSit) {
                isSit = false;
                if (player.userData.setSeated) player.userData.setSeated(false);
                tPos.set(pX, pFlr * FLR_H, pZ);
                player.position.y = pFlr * FLR_H;
            }
            // LOCAL movement vars per keypress (must not leak between presses).
            let dx = 0, dz = 0, rot = 0, dS = '';
            let realDir = activeKeys[k];
            if (realDir === 0) { dz = -1; rot = 0;            dS = 'n'; if (!CONFIG.settings.camN) return; }
            if (realDir === 1) { dx =  1; rot = -Math.PI / 2; dS = 'e'; if (!CONFIG.settings.camE) return; }
            if (realDir === 2) { dz =  1; rot =  Math.PI;     dS = 's'; if (!CONFIG.settings.camS) return; }
            if (realDir === 3) { dx = -1; rot =  Math.PI / 2; dS = 'w'; if (!CONFIG.settings.camW) return; }

            tRot = rot; player.rotation.y = tRot;
            // Shift = FACE that direction without stepping. Turn in place
            // (update facing + compass) and stop — no movement, no jump.
            if (e.shiftKey) { updateCompass(); return; }
            if (!checkCollision(pX + dx, pZ + dz, pFlr, dS, false)) {
                if (gapPromptActive) return;
                pX += dx; pZ += dz; tPos.x = pX; tPos.z = pZ; isMov = true; lastMoveTime = Date.now();
                // Stepping onto a ladder/stairs tile: bump floor up (or down if on top floor).
                let checkObj = MAP[pFlr][pZ][pX].o;
                if (checkObj?.v === 'ladder' || checkObj?.v === 'stairs') {
                    if (checkObj.v === 'ladder') { const _t = floorTargetFrom(pFlr, pX, pZ); if (_t >= 0) showMsg('Press SPACE to climb the ladder.'); }   // stairs auto-walk
                }
                // Floor-tile warp meta (e.g. a marked warp_pad tile painted as floor).
                if (MAP[pFlr][pZ][pX].f?.meta?.isWarp) executeWarp(MAP[pFlr][pZ][pX].f.meta);
            } else {
                // Blocked — if a (solid) LADDER is right in front, prompt to climb it.
                const fObj = MAP[pFlr] && MAP[pFlr][pZ + dz] && MAP[pFlr][pZ + dz][pX + dx] && MAP[pFlr][pZ + dz][pX + dx].o;
                if (fObj && fObj.v === 'ladder') { const _t = floorTargetFrom(pFlr, pX + dx, pZ + dz); if (_t >= 0) showMsg('Press SPACE to climb the ladder.'); }
            }
        }
    }
    // Register the handler ONCE. It was previously registered on window,
    // document, AND documentElement — which meant a single keypress bubbled
    // through all three and ran the handler up to 3× per press. That caused
    // Q/E to rotate 3× as far as intended and created races around the
    // gap-prompt / isMov / activeKeys state (a prime suspect for the
    // movement-freeze-after-prompt bug). One registration on `document`
    // reliably receives bubbled key events in iframes (preview + exports).
    //
    // As a belt-and-suspenders dedupe, we stamp each event object and skip
    // any event we've already processed (covers any stray double-binding).
    const _seenKeyEvents = new WeakSet();
    const _dedupedKeydown = (e) => {
        if (window.__engineGen !== __myEngineGen) { document.removeEventListener('keydown', _dedupedKeydown); return; }   // stale engine — detach
        if (_seenKeyEvents.has(e)) return;
        _seenKeyEvents.add(e);
        if (e.key === 'F3') { e.preventDefault(); window.__showDiag = !window.__showDiag; return; }
        _keydownHandler(e);
    };
    document.addEventListener('keydown', _dedupedKeydown);
    // Click anywhere on the page reasserts focus to the iframe's window.
    // We use 'click' (which fires AFTER mousedown/mouseup) so the click
    // target's own handler — like a gap-prompt button's onclick — runs to
    // completion first. mousedown/mousemove would steal focus too early.
    document.addEventListener('click', () => {
        try { window.focus(); } catch (e) {}
        try { document.body && document.body.focus(); } catch (e) {}
    });

    document.addEventListener('keyup', e => { if (window.__engineGen !== __myEngineGen) return; delete activeKeys[e.key.toLowerCase()]; });   // gated

    // #19: MOUSE in the in-game modals. A click drives the shop and every dialogue
    // exactly like the keyboard does, so players never have to touch a key mid-scene.
    // Capture phase + stopPropagation so it pre-empts the prompt-opener in game.js
    // (a click inside a modal must not also open the command prompt). Saymaker choices
    // are already buttons; the dialogue-TREE choices are wired in debugroom.js.
    function _engineModalClick(e) {
        if (window.__engineGen !== __myEngineGen) return;
        // SHOP: click a row to select it; click the already-selected row to BUY it.
        if (shopActive) {
            e.preventDefault(); e.stopPropagation();
            const row = e.target && e.target.closest && e.target.closest('[data-shop-row]');
            if (row) {
                const i = parseInt(row.getAttribute('data-shop-row'), 10);
                if (!isNaN(i)) { if (i === _shopSel) shopBuy(); else { _shopSel = i; _shopFlash = ''; renderShop(); } }
            }
            return;
        }
        // DIALOGUE: a click advances the usher / eavesdrop / generic panel like G.
        if (usherActive) { e.preventDefault(); e.stopPropagation(); advanceUsher(); return; }
        if (eavesdropActive) { e.preventDefault(); e.stopPropagation(); advanceEavesdrop(); return; }
        if (dismissTextPanel) {
            e.preventDefault(); e.stopPropagation();
            if (typeof window.__genericDlgTyping === 'function' && window.__genericDlgTyping()) return;   // first click finishes the typing
            dismissTextPanel();
            return;
        }
    }
    document.addEventListener('click', _engineModalClick, true);   // capture: runs before the prompt-opener
    // Wheel listener — non-passive + preventDefault so the iframe captures
    // the scroll instead of the parent page consuming it (which is what
    // happens by default when scrolling inside a sandboxed preview iframe).
    // The {passive:false} option lets us call preventDefault().
    const _wheelHandler = (e) => {
        // #21: while an in-game modal is open, let the wheel SCROLL the modal
        // (don't zoom the map behind it, and don't swallow the event).
        if (typeof window.__anyModalOpen === 'function' && window.__anyModalOpen()) return;
        if (camManager) {
            camManager.handleScroll(e.deltaY);
            // Only swallow the event if the zoom mode actually does something
            // with it. In 'locked' mode, leave the event alone so the user
            // can still scroll any surrounding UI normally.
            if (CONFIG.settings.zoomMode !== 'locked') {
                e.preventDefault();
            }
        }
    };
    // Register ONCE (was on window + document, which double-applied each
    // scroll tick). document reliably receives wheel events in iframes.
    const _seenWheelEvents = new WeakSet();
    document.addEventListener('wheel', (e) => {
        if (_seenWheelEvents.has(e)) return;
        _seenWheelEvents.add(e);
        _wheelHandler(e);
    }, { passive: false });

    // ── §5.5 (cont.)  MINIMAP / DIRECTORY ──────────────────────────────────
    // ── DIRECTORY (interactive kiosk modal) ──────────────────────────────
    // Called ONLY when the player interacts with a directory object
    // (cell.o.v === 'dir'). Opens a full modal. Player can:
    //   - HOVER a tile to see what's there (writes to #dir-info)
    //   - LEFT-CLICK a warp tile or labeled object to inspect it
    //   - RIGHT-CLICK a warp tile to teleport there
    //
    // Does NOT auto-open from the M key. The separate minimap overlay
    // (renderMinimapMini below) handles passive map display.
    function openDir() {
        // Fast-travel kiosk. Redesigned so it (a) lets you pick ANY floor via tabs,
        // and (b) never overlaps labels: destinations are NUMBERED markers on the map
        // plus a clickable name list beside it (the old version painted name chips
        // straight onto the map, so "Concession" collided with the "you" marker).
        //
        // HOW TO MODIFY:
        //   - Tile scale: TILE_PX_MAX below (auto-shrinks to fit).
        //   - Marker look: the ft.forEach() draw block in render().
        //   - Legend look: the legend rows in render().
        const host = container || document.getElementById('game-container') || document.body;
        let dirEl = document.getElementById('dir');
        const _savedPeek = mmPeek;             // directory borrows mmPeek to draw other floors; restore on close
        let viewFloor = pFlr;                  // which floor the directory is currently showing
        if (!dirEl) {
            dirEl = document.createElement('div');
            dirEl.id = 'dir';
            dirEl.className = 'win95-win';
            dirEl.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:70;display:none;max-width:62%;max-height:70%;overflow:auto;font-size:12px;';   // #14: smaller-scale directory
            dirEl.innerHTML =
                '<div class="win95-title" style="font-size:14px;"><span>Directory \u2014 Fast Travel</span><span data-x style="cursor:pointer;padding:0 4px;">X</span></div>' +
                '<div class="win95-body" style="padding:8px;">' +
                '<div id="dir-floors" style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;"></div>' +
                '<div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;">' +
                '<canvas id="minimap-canvas" style="display:block;image-rendering:pixelated;background:#000;border:1px solid #555;cursor:pointer;"></canvas>' +
                '<div id="dir-legend" style="min-width:130px;max-width:220px;font:12px sans-serif;color:#111;"></div>' +
                '</div>' +
                '<div id="dir-info" style="margin-top:6px;padding:5px 7px;background:#000;color:#fcd34d;font:11px sans-serif;min-height:16px;border:1px solid #555;">&nbsp;</div>' +
                '</div>';
            host.appendChild(dirEl);
        }
        const cvs    = document.getElementById('minimap-canvas');
        const info   = document.getElementById('dir-info');
        const floorsBar = document.getElementById('dir-floors');
        const legend = document.getElementById('dir-legend');
        if (!cvs) return;

        const close = () => { dirEl.style.display = 'none'; mmPeek = _savedPeek; document.removeEventListener('keydown', onEsc, true); };
        const onEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };

        let hits = [];     // numbered-marker hit rects (canvas px) -> warp point
        let scale = 12;

        function render() {
            // ── floor tabs ──
            floorsBar.innerHTML = '';
            for (let f = 0; f < MAP.length; f++) {
                const b = document.createElement('span');
                b.textContent = 'Floor ' + (f + 1) + (f === pFlr ? ' \u25c9' : '');   // ◉ marks the floor you're actually on
                const on = (f === viewFloor);
                b.style.cssText = 'cursor:pointer;padding:2px 9px;border:2px outset #c0c0c0;font:bold 12px sans-serif;background:' +
                    (on ? '#000080' : '#c0c0c0') + ';color:' + (on ? '#fff' : '#111') + ';';
                b.onclick = () => { viewFloor = f; render(); };
                floorsBar.appendChild(b);
            }

            // ── draw the chosen floor (mmPeek drives _drawMinimap's floor; null = player's floor) ──
            mmPeek = (viewFloor === pFlr) ? null : viewFloor;
            const TILE_PX_MAX = 10;   // #14: was 13 — smaller, crisper tiles
            const availW = Math.max(140, (host.clientWidth || 640) * 0.34);
            const availH = Math.max(100, (host.clientHeight || 480) * 0.38);
            scale = Math.max(6, Math.min(TILE_PX_MAX, Math.floor(availW / W), Math.floor(availH / H)));
            cvs.width = W * scale; cvs.height = H * scale;
            const ctx = cvs.getContext('2d');
            _drawMinimap(ctx, scale, true);

            // ── numbered markers (NO text on the map → nothing overlaps) ──
            hits = [];
            const ft = warpPoints.filter(w => w.f === viewFloor && w.fastTravel);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ft.forEach((wp, i) => {
                const cxp = wp.x * scale + scale / 2, czp = wp.z * scale + scale / 2;
                const r = Math.max(7, scale * 0.5);
                ctx.beginPath(); ctx.arc(cxp, czp, r, 0, Math.PI * 2);
                ctx.fillStyle = '#fcd34d'; ctx.fill();
                ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke();
                ctx.fillStyle = '#000'; ctx.font = 'bold ' + Math.round(r * 1.25) + 'px sans-serif';
                ctx.fillText(String(i + 1), cxp, czp + 0.5);
                hits.push({ x0: cxp - r, y0: czp - r, x1: cxp + r, y1: czp + r, wp });
            });
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

            // ── clickable legend (names live HERE, never on the map) ──
            legend.innerHTML = '';
            const ttl = document.createElement('div');
            ttl.textContent = ft.length ? 'Destinations \u2014 Floor ' + (viewFloor + 1) : 'No fast-travel here';
            ttl.style.cssText = 'font-weight:bold;margin-bottom:4px;border-bottom:1px solid #888;padding-bottom:2px;';
            legend.appendChild(ttl);
            ft.forEach((wp, i) => {
                const row = document.createElement('div');
                row.textContent = (i + 1) + '. ' + wp.name + (wp.f === pFlr && wp.x === pX && wp.z === pZ ? '  (you)' : '');
                row.style.cssText = 'cursor:pointer;padding:3px 5px;margin:1px 0;border:1px solid #00000022;';
                row.onmouseenter = () => { row.style.background = '#000080'; row.style.color = '#fff'; if (info) info.textContent = wp.name + ' \u2014 click to travel'; };
                row.onmouseleave = () => { row.style.background = ''; row.style.color = ''; };
                row.onclick = () => { close(); fastTravelTo(wp); };
                legend.appendChild(row);
            });
            if (viewFloor !== pFlr) {
                const note = document.createElement('div');
                note.textContent = '\u25c9 = your floor (Floor ' + (pFlr + 1) + ')';
                note.style.cssText = 'margin-top:6px;font-size:10px;color:#555;';
                legend.appendChild(note);
            }
            if (info) info.textContent = ft.length
                ? 'Pick a destination from the list (or tap a numbered marker). Floor tabs switch floors.'
                : 'No fast-travel points on this floor \u2014 try another floor tab.';
        }

        // hover/click the numbered markers on the canvas
        const tilePx = (e) => { const r = cvs.getBoundingClientRect(); return { px: (e.clientX - r.left) * (cvs.width / r.width), py: (e.clientY - r.top) * (cvs.height / r.height) }; };
        cvs.onmousemove = (e) => {
            const { px, py } = tilePx(e);
            const hit = hits.find(h => px >= h.x0 && px <= h.x1 && py >= h.y0 && py <= h.y1);
            cvs.style.cursor = hit ? 'pointer' : 'default';
            if (hit && info) info.textContent = hit.wp.name + ' \u2014 click to travel';
        };
        cvs.onclick = (e) => {
            const { px, py } = tilePx(e);
            const hit = hits.find(h => px >= h.x0 && px <= h.x1 && py >= h.y0 && py <= h.y1);
            if (hit) { close(); fastTravelTo(hit.wp); }
        };
        const xb = dirEl.querySelector('[data-x]'); if (xb) xb.onclick = close;

        render();
        dirEl.style.display = 'block';
        document.addEventListener('keydown', onEsc, true);
    }

    // ── MINIMAP OVERLAY (passive, non-blocking) ──────────────────────────
    // A small read-only minimap pinned to a corner. Does NOT prevent the
    // player from moving — that's what makes it different from the
    // directory modal above. Re-rendered each animation frame from the
    // main game loop so the player dot stays current.
    function renderMinimapMini() {
        const cont = document.getElementById('minimap-mini');
        const cvs  = document.getElementById('minimap-mini-canvas');
        if (!cont || !cvs) return;
        if (cont.style.display === 'none') return;   // hidden, don't paint
        // pin the overlay to the author-chosen corner.
        const corner = (CONFIG.settings.minimapCorner || 'tl');
        cont.style.top = cont.style.bottom = cont.style.left = cont.style.right = 'auto';
        if (corner === 'tl') { cont.style.top = '20px';    cont.style.left = '20px'; }
        else if (corner === 'tr') { cont.style.top = '20px';    cont.style.right = '20px'; }
        else if (corner === 'bl') { cont.style.bottom = '20px'; cont.style.left = '20px'; }
        else if (corner === 'br') { cont.style.bottom = '20px'; cont.style.right = '20px'; }
        // Choose a per-cell pixel scale that fits the whole map into the
        // 120×120 canvas, with a minimum so very small maps still look
        // chunky enough to read.
        const scale = Math.max(2, Math.min(Math.floor(120 / W), Math.floor(120 / H)));
        cvs.width  = W * scale;
        cvs.height = H * scale;
        const ctx  = cvs.getContext('2d');
        _drawMinimap(ctx, scale);
    }

    // Shared draw routine used by both the directory canvas and the small
    // overlay. `cell` is the per-tile pixel size in the destination canvas.
    // `isDirectory` selects directory-vs-minimap display rules for zones/fog.
    function _drawMinimap(ctx, cell, isDirectory) {
        const S = CONFIG.settings || {};
        const zoneDefs = S.zoneDefs || [];
        const zoneOn = (S.zoneDisplay === 'both') || (S.zoneDisplay === (isDirectory ? 'directory' : 'minimap'));
        const fogOn  = (S.fogDisplay === 'both')  || (S.fogDisplay === (isDirectory ? 'directory' : 'minimap'));
        const flMode = isDirectory ? 'off' : (S.flashlightMinimap || 'off');   // flashlight gating is a live-minimap concept
        const flOn = flMode !== 'off' && lightingManager.isFlashlightOn && lightingManager.isFlashlightOn();
        const revealSz = Math.max(1, S.flashlightRevealSize || 4);

        // Player facing (for the cone): derive a cardinal from player.rotation.y.
        // 0 ≈ +Z (south), PI/2 ≈ +X (east), etc. We compare tile bearing to it.
        const facing = player ? player.rotation.y : 0;
        const fwd = { x: Math.sin(facing), z: Math.cos(facing) };

        // Is tile (x,z) revealed under the flashlight rule? (radius or cone)
        const flashlightReveals = (x, z) => {
            if (!flOn) return false;
            const dx = x - pX, dz = z - pZ;
            const dist = Math.hypot(dx, dz);
            if (dist > revealSz) return false;
            if (flMode === 'radius') return true;
            // cone: tile must be roughly in front (dot with forward > ~0.5 → ~60° half-angle)
            if (dist < 0.5) return true;
            const dot = (dx * fwd.x + dz * fwd.z) / (dist || 1);
            return dot > 0.5;
        };

        const c = ctx.canvas;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
        // the minimap/directory can show ANY floor. mmPeek (set by the
        // [ and ] keys) overrides the player's floor for DISPLAY only; null = follow
        // the player. The player dot only draws on their actual floor.
        const drawFlr = (typeof mmPeek === 'number' && MAP[mmPeek]) ? mmPeek : pFlr;
        MAP[drawFlr].forEach((row, z) => row.forEach((cellData, x) => {
            // ── visibility gating ──────────────────────────────────────────
            // when flashlight-minimap is on, everything is hidden EXCEPT
            // the player's tile, already-visited tiles, and whatever the
            // flashlight currently reveals.
            if (flMode !== 'off') {
                const seen = (x === pX && z === pZ) || visitedTiles.has(drawFlr + ',' + x + ',' + z) || flashlightReveals(x, z);
                if (!seen) return;   // leave black
            }
            // fog-of-war. If this tile is fogged and fog is shown here,
            // hide it — unless it's "discoverable" and already visited.
            if (fogOn && cellData.fog) {
                const discovered = S.fogDiscoverable && visitedTiles.has(drawFlr + ',' + x + ',' + z);
                if (!discovered) {
                    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(x * cell, z * cell, cell, cell);
                    return;   // obscured: draw a dark veil and skip the rest
                }
            }

            // ── base tile ──────────────────────────────────────────────────
            if (cellData.f) { ctx.fillStyle = '#333'; ctx.fillRect(x * cell, z * cell, cell, cell); }

            // zone overlay tint (drawn over the floor).
            if (zoneOn && cellData.zone) {
                const zd = zoneDefs.find(z2 => z2.id === cellData.zone);
                if (zd) { ctx.globalAlpha = 0.55; ctx.fillStyle = zd.color; ctx.fillRect(x * cell, z * cell, cell, cell); ctx.globalAlpha = 1; }
            }

            if (cellData.o && cellData.o.meta && cellData.o.meta.block) {
                ctx.fillStyle = '#666'; ctx.fillRect(x * cell, z * cell, cell, cell);
            }
            if (cellData.o?.meta?.isWarp || cellData.f?.meta?.isWarp || cellData.o?.v === 'warp_pad') {
                ctx.fillStyle = '#a855f7'; ctx.fillRect(x * cell, z * cell, cell, cell);
            }
            if (cellData.o?.v === 'dir') {
                ctx.fillStyle = '#06b6d4'; ctx.fillRect(x * cell, z * cell, cell, cell);
            }
            if (x === pX && z === pZ && drawFlr === pFlr) {
                ctx.fillStyle = '#fcd34d';
                ctx.beginPath();
                ctx.arc(x * cell + cell/2, z * cell + cell/2, Math.max(2, cell/2 - 1), 0, Math.PI * 2);
                ctx.fill();
            }
        }));
        // floor banner on multi-story maps — shows which floor you're
        // viewing, whether it's a peek, and the [ ] hint.
        if (MAP.length > 1) {
            const label = 'FLOOR ' + (drawFlr + 1) + '/' + MAP.length + (drawFlr === pFlr ? '  (you)' : '  (peek)') + '   [ ]';
            ctx.font = 'bold 10px sans-serif';
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(2, 2, tw + 8, 15);
            ctx.strokeStyle = '#fcd34d'; ctx.strokeRect(2.5, 2.5, tw + 7, 14);
            ctx.fillStyle = drawFlr === pFlr ? '#fcd34d' : '#7dd3fc';
            ctx.fillText(label, 6, 13);
        }
    }

    // Toggle helper for the M key — only affects the small overlay, not
    // the directory modal.
    function toggleMinimapMini() {
        const cont = document.getElementById('minimap-mini');
        if (!cont) return;
        cont.style.display = cont.style.display === 'block' ? 'none' : 'block';
        if (cont.style.display === 'block') renderMinimapMini();
    }

    // GUARANTEE THE 3D CORNER COMPASS EXISTS.
    // The compass DOM + CSS live in Mapster's export template, but maps played
    // through other shells (the in-game embed, older exports, the live preview)
    // may not include them — which is why the compass "wasn't there." So the
    // engine now SELF-INJECTS a compass widget into the game container if one
    // isn't already present, and injects its CSS once. This makes the corner
    // compass appear on every map screen regardless of host.
    //
    // To restyle it: edit the injected CSS string below (or override #compass-ui
    // in your host page — the engine won't clobber an existing element).
    (function ensureCompassUI() {
        if (!document.getElementById('compass-ui')) {
            if (!document.getElementById('engine-compass-css')) {
                const st = document.createElement('style');
                st.id = 'engine-compass-css';
                st.textContent =
                    // #8: the OUTER upright ring is gone — the compass IS the inner
                    // 3D dial now. #compass-ui is just a transparent, perspective
                    // container; all the visible chrome lives on .compass-dial so it
                    // leans with the camera tilt.
                    "#compass-ui{position:absolute;top:20px;right:20px;width:54px;height:54px;border:none;background:none;box-shadow:none;color:#fff;font-weight:bold;font-size:11px;font-family:'Courier New',monospace;line-height:1;pointer-events:none;overflow:visible;z-index:40;perspective:200px;}" +
                    // #8: N/E/S/W ride the dial (they're children of it now), so they
                    // tip and spin with the disc "in 3D" instead of sitting upright.
                    ".compass-border-label{position:absolute;color:#fff;text-shadow:1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;font-weight:bold;font-size:10px;line-height:1;}" +
                    ".compass-border-label.n{top:-7px;left:50%;transform:translateX(-50%);color:#ef4444;}" +
                    ".compass-border-label.s{bottom:-7px;left:50%;transform:translateX(-50%);}" +
                    ".compass-border-label.e{right:-7px;top:50%;transform:translateY(-50%);}" +
                    ".compass-border-label.w{left:-7px;top:50%;transform:translateY(-50%);}" +
                    // #6/#8: the dial is the 3D disc AND the visible compass — a clear
                    // ring + glow so the leaning circle reads on its own (no outer ring).
                    ".compass-dial{position:absolute;inset:0;transition:transform 0.15s;transform-style:preserve-3d;border-radius:50%;border:2px solid #d8b4fe;background:radial-gradient(circle,rgba(48,26,72,0.55),rgba(10,6,20,0.32));box-shadow:0 0 9px rgba(192,132,252,0.75),inset 0 0 7px rgba(192,132,252,0.45);}" +
                    ".compass-dial::before{content:none;}" +
                    ".compass-dial-arrow{position:absolute;top:3px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:12px solid #fcd34d;}" +
                    // Tilt pitch-ladder: a thin vertical gauge to the LEFT of the dial with
                    // a marker that rides the -30..+30 tilt range.
                    "#compass-tilt{position:absolute;right:-26px;top:-3px;width:8px;height:60px;border:1px solid #a855f7;border-radius:3px;background:rgba(0,0,0,0.5);}" +   /* more gap between the compass dial and the tilt ladder */
                    "#compass-tilt .mid{position:absolute;left:-2px;right:-2px;top:50%;height:1px;background:rgba(168,85,247,0.7);}" +
                    "#compass-tilt .mark{position:absolute;left:-1px;width:8px;height:3px;background:#fcd34d;border-radius:1px;transition:top 0.15s;}" +
                    "#compass-tilt .deg{position:absolute;right:12px;bottom:-2px;font-size:8px;color:#c4b5fd;white-space:nowrap;}" +   /* #17: degree label on the inner (compass) side so it stays on-screen */
                    // View-mode indicator under the compass: shows whether 1st- and/or
                    // 3rd-person are available, with the ACTIVE one highlighted.
                    "#view-mode{position:absolute;top:62px;left:50%;transform:translateX(-50%);display:flex;gap:4px;font-family:'Courier New',monospace;font-size:9px;font-weight:bold;white-space:nowrap;}" +
                    "#view-mode span{padding:1px 4px;border:1px solid #5b4a7a;border-radius:3px;color:#6d6486;background:rgba(0,0,0,0.5);}" +
                    "#view-mode span.on{border-color:#a855f7;color:#fcd34d;}" +
                    "#view-mode span.off{opacity:0.35;}";
                document.head.appendChild(st);
            }
            const comp = document.createElement('div');
            comp.id = 'compass-ui';
            comp.innerHTML =
                '<div class="compass-dial">' +
                    '<div class="compass-dial-arrow"></div>' +
                    '<span class="compass-border-label n">N</span>' +
                    '<span class="compass-border-label e">E</span>' +
                    '<span class="compass-border-label s">S</span>' +
                    '<span class="compass-border-label w">W</span>' +
                '</div>' +
                '<div id="compass-tilt"><div class="mid"></div><div class="mark"></div><div class="deg">0\u00b0</div></div>' +
                '<div id="view-mode"><span class="v3">3P</span><span class="v1">1P</span></div>';
            (container || document.body).appendChild(comp);
        }
    })();

    // GUARANTEE THE RETRO MODAL ELEMENTS EXIST.
    // Same rationale as the compass: #msg (one-line banner) and #dialogue (the
    // talk panel) live in the export template, but other shells may omit them.
    // regular dialogues now match the DIALOGUE-TREE modal (clean
    // win95 gray panel, blue title bar with the speaker's name) instead of the
    // old glowing cyan box — at the bigger 17px font all dialogue modals share.
    // The CSS is engine-injected so it works in EVERY shell, not just the host
    // page that defines the .win95-* classes.
    (function ensureModalUI() {
        if (!document.getElementById('engine-modal-css')) {
            const st = document.createElement('style');
            st.id = 'engine-modal-css';
            st.textContent =
                "#msg{position:absolute;top:14%;left:50%;transform:translateX(-50%);background:#c0c0c0;color:#000;border:2px solid #dfdfdf;border-right-color:#404040;border-bottom-color:#404040;box-shadow:1px 1px 0 #000,2px 2px 7px rgba(0,0,0,0.45);padding:8px 16px;font:bold 24px 'GrandeRetro','MS Sans Serif',Tahoma,sans-serif;letter-spacing:.3px;display:none;z-index:30;text-align:center;}" +
                "#dialogue{position:absolute;bottom:5%;left:50%;transform:translateX(-50%);min-width:320px;max-width:80%;background:#c0c0c0;color:#000;border:2px solid #dfdfdf;border-right-color:#404040;border-bottom-color:#404040;box-shadow:1px 1px 0 #000,2px 2px 7px rgba(0,0,0,0.45);padding:0;display:none;z-index:60;font:26px/1.45 'GrandeRetro','MS Sans Serif',Tahoma,sans-serif;}" +
                "#dialogue .dlg-title{background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font-weight:bold;padding:3px 7px;font-size:20px;letter-spacing:.3px;}" +
                "#dialogue .dlg-body{padding:10px 14px;font-size:20px;line-height:1.3;max-height:46vh;overflow-y:auto;}";
            document.head.appendChild(st);
        }
        if (!document.getElementById('msg')) { const m = document.createElement('div'); m.id = 'msg'; (container || document.body).appendChild(m); }
        if (!document.getElementById('dialogue')) { const d = document.createElement('div'); d.id = 'dialogue'; (container || document.body).appendChild(d); }
    })();

    // Initial visibility for the minimap. #20: it's now toggle-able in-game
    // with M for every mode except 'off' (author hard-disabled). It starts
    // VISIBLE for 'on'/'always' and also for 'toggle' (the M key flips it).
    if (CONFIG.settings.minimapMode && (CONFIG.settings.minimapMode !== 'off' && CONFIG.settings.minimapMode !== 'none')) {
        const cont = document.getElementById('minimap-mini');
        if (cont) { cont.style.display = 'block'; renderMinimapMini(); }
    }
    // the compass is ON BY DEFAULT and toggleable. Only an
    // explicit compassMode === 'off' hides it; anything else (including the
    // undefined default) shows it, and the C key flips it (see keydown handler).
    if (CONFIG.settings.compassMode === 'off') {
        const c = document.getElementById('wasd-indicator'); if (c) c.style.display = 'none';
        const c2 = document.getElementById('compass-ui'); if (c2) c2.style.display = 'none';
    } else {
        const c2 = document.getElementById('compass-ui'); if (c2) c2.style.display = 'block';
    }
    updateCompass();

    // ════════════════════════════════════════════════════════════════════════
    // §6  MAIN ANIMATION LOOP
    // ────────────────────────────────────────────────────────────────────────
    // Runs every frame via requestAnimationFrame. Steps:
    //   1) Lerp the player toward tPos (or animate the jump arc).
    //   2) Tick all NPCs (random wander, with collision avoidance).
    //   3) Tick lighting/fog/weather managers (flicker, particles, etc).
    //   4) Wind-sway grass instances if weather is active.
    //   5) Round-robin update one mirror cube-camera per pair of frames.
    //   6) Update active camera (or fallback) and follow the player.
    //   7) X-ray transparency: ray-cast from camera to player and dim any
    //      walls in between so the player stays visible.
    //   8) Render.
    //
    // Performance knobs:
    //   - Player walk speed:    `12 * dt` lerp factor
    //   - Jump arc duration:    `jumpProgress += dt * 3`  (3 = 1/3 second)
    //   - Jump arc height:      `Math.sin(... * 1.5)` peak
    //   - Mirror frequency:     `mTick % 2` divisor
    //   - NPC wander prob/tick: `Math.random() < 0.01`
    //   - X-ray dim opacity:    `0.2` in the wall raycast block
    // ════════════════════════════════════════════════════════════════════════
    const ray = new THREE.Raycaster(); const cDir = new THREE.Vector3(); let hWalls = []; const clock = new THREE.Clock(); let mTick = 0;
    let _frameCount = 0;   // ticks every animation frame; read by the ` debug overlay

    // On-screen error surface. If the animation loop throws, the rAF at the
    // top of anim() keeps the loop alive but every frame dies at the same
    // spot — so the camera and everything after the throw freezes while
    // keydown still fires. That produces a confusing "everything's frozen
    // but I can still trigger prompts" symptom with no console visible
    // (especially inside a sandboxed preview iframe). This banner makes any
    // such throw visible and tells us exactly which line died.
    let _animErrShown = false;
    function _showAnimError(err) {
        if (_animErrShown) return;        // only show the first one
        _animErrShown = true;
        try {
            const box = document.createElement('div');
            box.style.cssText = 'position:fixed; left:0; right:0; bottom:0; z-index:99999; background:#400; color:#fff; font:12px monospace; padding:8px 12px; white-space:pre-wrap; border-top:2px solid #f00; max-height:40vh; overflow:auto;';
            box.textContent = 'ENGINE LOOP ERROR (movement/camera frozen):\n' +
                (err && err.stack ? err.stack : String(err)) +
                '\n\n(This is a bug — please report this text.)';
            document.body.appendChild(box);
        } catch (e) {}
    }

    function anim() {
        if (window.__engineGen !== __myEngineGen) return;   // stale engine — stop the loop
        requestAnimationFrame(anim);
        try {
            _animBody();
        } catch (err) {
            console.error('anim loop error:', err);
            _showAnimError(err);
        }
    }

    function _animBody() {
        _frameCount++;
        if (_frameCount % 8 === 0) { try { updateContextHint(); } catch (e) {} try { updatePosterCaption(); } catch (e) {} }   // #14/#L: context hint + poster caption ~7×/s
        const dt = Math.min(clock.getDelta(), 0.1); // clamp to avoid huge skips
        const time = clock.getElapsedTime();

        // #3: LIGHTS FLICKER ON when you first cross into the multiplex (the first
        // door). A lesson sets window.__flickerOnZ (the z you must reach) + starts
        // the room dim; crossing it once runs a brief flicker up to full.
        if (window.__flickerOnZ != null && !window.__flickerFired && pFlr === 0 && pZ <= window.__flickerOnZ) {
            window.__flickerFired = true;
            if (window.engineSetLightLevel) {
                const _seq = [0.25, 0.9, 0.3, 1, 0.45, 1, 0.6, 1]; let _fi = 0;
                const _iv = setInterval(() => {
                    window.engineSetLightLevel(_seq[_fi] != null ? _seq[_fi] : 1);
                    if (++_fi >= _seq.length) { clearInterval(_iv); window.engineSetLightLevel(1); }
                }, 85);
            }
        }

        // loop; the check used to sit in render(), which only fires on init/floor-tab
        // clicks, so it never triggered while walking). If this map has a car + a key
        // you haven't grabbed, straying >=4 tiles from the car nudges you back; it
        // re-arms within 2 tiles so it can fire again.
        if (keyFetchCar && keyFetchKeyId && !inventory.includes(keyFetchKeyId)) {
            const _dCar = Math.max(Math.abs(pX - keyFetchCar.x), Math.abs(pZ - keyFetchCar.z));
            if (!keyFetchPrompted && _dCar >= 4 && pFlr === keyFetchCar.f && !window.__worldPaused) {
                keyFetchPrompted = true;
                showMsg('Oops \u2014 you forgot the multiplex key in your car! Better go back and grab it.');
            } else if (_dCar <= 2) { keyFetchPrompted = false; }
        }

        // #4: advance frame-driven door swings. Runs UNCONDITIONALLY (before the
        // world-pause check) so a door always finishes opening/closing — even if a
        // prompt opens, and crucially even while a movement key is held (the old
        // setInterval version got starved by the key-flood and appeared to halt).
        if (doorAnims.length) {
            for (let _i = doorAnims.length - 1; _i >= 0; _i--) {
                const _a = doorAnims[_i];
                _a.t += dt;
                let _k = Math.min(1, _a.t / _a.dur);
                const _e = _k * _k * (3 - 2 * _k); // smoothstep
                for (const _tw of _a.tweens) { const _tgt = _tw.target(); _tw.set(_tw.from + (_tgt - _tw.from) * _e); }
                if (_k >= 1) {
                    for (const _tw of _a.tweens) _tw.set(_tw.target());
                    _a.dObj.animating = false;
                    if (typeof _a.onDone === 'function') { try { _a.onDone(); } catch (e) {} }
                    doorAnims.splice(_i, 1);
                }
            }
        }

        // WORLD PAUSE. When a dialogue that requested it is open, freeze the
        // simulation (NPC AI, player stepping) but keep rendering so the scene
        // still shows behind the conversation. The host sets window.__worldPaused
        // (Saymaker's "Pause world during dialogue", on by default).
        const worldPaused = ((typeof window.__worldPaused !== 'undefined') ? !!window.__worldPaused : false)
            || !!window.__posterMsgPaused   // #9: poster/interaction notes freeze the world like dialogue
            || (typeof window.__anyModalOpen === 'function' && window.__anyModalOpen());   // #21: modals pause the world by default

        // ── Physics Interpolation ──
        // Either ride the jump arc (when isJump) or lerp toward tPos.
        // Both flags drop when the player reaches the target.
        window.__climbing = isClimb;   // keep the camera-lag flag in sync every frame
        // SMOOTH WALK: leftover distance from the frame on which we reach a tile.
        // When a direction key is still held, we carry this into the next step so
        // per-frame travel stays constant — no hitch/lope at tile boundaries.
        let _justArrivedOvershoot = 0;
        if (isMov || isSit || isJump || isClimb) {
            if (isClimb) {
                // ANIMATED stair walk-up / ladder climb between floors.
                window.__climbing = true;   // tells the camera to lag so the climb reads as traversal
                climbT += dt * (climbVia === 'ladder' ? 0.85 : 0.62);   // #7: slower stairs so you clearly WALK up them, not blink up
                const p = Math.min(1, climbT);
                const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // ease in-out
                // #7: horizontal follows the climb axis; for STAIRS the height tracks
                // that horizontal progress (a steady ascent up the slope) plus a
                // per-step bob, so it reads as walking the treads rather than gliding.
                if (climbVia === 'stairs') {
                    player.position.x = climbFrom.x + (climbTo.x - climbFrom.x) * e;
                    player.position.z = climbFrom.z + (climbTo.z - climbFrom.z) * e;
                    player.position.y = climbFrom.y + (climbTo.y - climbFrom.y) * e + Math.abs(Math.sin(p * Math.PI * 10)) * 0.08;
                } else {
                    player.position.lerpVectors(climbFrom, climbTo, e);
                    player.position.x += Math.sin(p * Math.PI * 7) * 0.015;                        // ladder body sway
                }
                // face the travel direction
                const ddx = climbTo.x - climbFrom.x, ddz = climbTo.z - climbFrom.z;
                if (Math.abs(ddx) > 0.01 || Math.abs(ddz) > 0.01) player.rotation.y = Math.atan2(ddx, ddz);
                if (p >= 1) {
                    const fromF = Math.round(climbFrom.y / FLR_H);
                    const up = climbNewFlr > fromF;
                    pFlr = climbNewFlr; pX = climbLandX; pZ = climbLandZ;
                    tPos.set(pX, pFlr * FLR_H, pZ); player.position.copy(tPos);
                    isClimb = false; climbNoTrigger = true; mmPeek = null; window.__climbing = false;
                    applyFloorFog(pFlr, pX, pZ);
                    applyFloorVisibility();   // #7d
                    showMsg((up ? '\u25b2 ' : '\u25bc ') + (up ? 'Up the ' : 'Down the ') + (climbVia === 'stairs' ? 'stairs' : 'ladder') + ' \u2014 Floor ' + (pFlr + 1) + ' of ' + MAP.length);
                }
            } else if (isJump) {
                // arc speed + height depend on style. Climb is slow & low (a
                // scramble); vault is the snappy default; recoil is a failed,
                // backward-dipping hop that returns to the start.
                const speed = (jumpStyle === 'climb') ? 1.6 : (jumpStyle === 'recoil') ? 3.5 : (jumpStyle === 'falldown') ? 2.2 : 3;
                jumpProgress += dt * speed;
                if (jumpProgress >= 1.0) {
                    jumpProgress = 1.0; isJump = false; isMov = false;
                    // A falldown arc lands you on a LOWER floor — commit the floor
                    // change now that the visual drop has finished, then fog/refog.
                    if (jumpStyle === 'falldown' && pendingDropFlr >= 0) {
                        const _floorsFell = Math.max(0, pFlr - pendingDropFlr);   // #28: how far we dropped
                        pFlr = pendingDropFlr; pendingDropFlr = -1;
                        try { applyFloorFog(pFlr, pX, pZ); } catch (e) {}
                        // #28: FALL DAMAGE — scaled by floors dropped, routed through
                        // playerHurt → the host applies it to HP and shows GAME OVER at
                        // 0. Temporary tuning: 3 HP per floor. (Joe will retune later.)
                        if (_floorsFell >= 1) {
                            // #19: compute the amount from the Progression config
                            // (read-only) and apply it ONCE through playerHurt ->
                            // engineOnPlayerDamage, which lowers State.world.hp, plays
                            // the hurt sfx, re-renders the HP bar, and triggers GAME
                            // OVER at 0. (The previous branch computed damage but only
                            // called playerHurt in its fallback, so HP never moved.)
                            let dmg = _floorsFell * 3;
                            try {
                                const _hc = window.PROGRESSION_CONFIG && window.PROGRESSION_CONFIG.hp;
                                if (_hc) { const over = Math.max(0, _floorsFell - (_hc.safeDropTiles || 0)); dmg = Math.min(_hc.fallMax || 15, over * (_hc.fallPerTile || 3)); }
                            } catch (e) {}
                            if (dmg > 0) {
                                try { playerHurt(dmg, 'fall'); } catch (e) {}
                                try { showMsg('You hit the ground hard!  (-' + Math.round(dmg) + ' HP)'); } catch (e) {}
                            }
                        }
                    }
                    jumpStyle = 'vault';
                }
                if (jumpStyle === 'recoil') {
                    // Stay at the start tile; dip slightly and lean back, then settle.
                    player.position.copy(jumpStartPos);
                    player.position.y = (pFlr * FLR_H) + Math.sin(jumpProgress * Math.PI) * 0.35;
                } else if (jumpStyle === 'falldown') {
                    // Drop to a lower floor: arc horizontally to the landing tile while
                    // Y eases DOWN from the start height (gravity-ish, ease-in) with a
                    // small initial hop up off the ledge. tPos.y is the landing height.
                    const e = jumpProgress * jumpProgress;                  // ease-in (accelerating fall)
                    player.position.lerpVectors(jumpStartPos, tPos, jumpProgress);
                    player.position.y = jumpStartPos.y + (tPos.y - jumpStartPos.y) * e + Math.sin(jumpProgress * Math.PI) * 0.45;
                } else {
                    const arcH = (jumpStyle === 'climb') ? 0.9 : 1.5;
                    player.position.lerpVectors(jumpStartPos, tPos, jumpProgress);
                    player.position.y = (pFlr * FLR_H) + (Math.sin(jumpProgress * Math.PI) * arcH);
                }
            } else {
                // #8 (FIX): CONSTANT-SPEED step toward the target tile. The old
                // exponential lerp (lerp(tPos, 12*dt)) decelerated into every tile
                // (a lunge-then-settle that read as jerky) and could OVERSHOOT on a
                // frame hitch when 12*dt exceeded 1. A constant tiles/sec glide is
                // smooth and never overshoots. Crouch moves clearly slower.
                const speed = window.__playerCrouching ? 0.935 : 6;   // #2: sneak 10% faster (0.85 -> 0.935); #3 walk is 6 tiles/sec
                const dx = tPos.x - player.position.x, dz = tPos.z - player.position.z;
                const dist = Math.hypot(dx, dz);
                const stepLen = speed * dt;
                // Ease Y to the target floor height while walking/sitting (the crouch
                // logic owns Y when crouched; jumps own it during the arc).
                if (!isJump && (!window.__playerCrouching || isSit)) {
                    player.position.y += (tPos.y - player.position.y) * Math.min(1, 10 * dt);
                }
                if (dist <= stepLen || dist < 0.02) {
                    // Arrived (horizontal). Y is owned by crouch/jump/seat logic.
                    _justArrivedOvershoot = Math.max(0, stepLen - dist);   // leftover travel for a seamless next step
                    player.position.x = tPos.x; player.position.z = tPos.z; isMov = false;
                    // STAIRS auto-walk-up: stepping onto a stairs tile takes you up/down
                    // automatically (no SPACE prompt) with the climb animation. We land
                    // you OFF the top, and a cooldown (cleared once you stand on a non-
                    // stairs tile) stops the destination tile from bouncing you back.
                    {
                        const aObj = MAP[pFlr] && MAP[pFlr][pZ] && MAP[pFlr][pZ][pX] && MAP[pFlr][pZ][pX].o;
                        if (aObj && aObj.v === 'stairs') {
                            if (!climbNoTrigger) {
                                const t = floorTargetFrom(pFlr, pX, pZ);
                                if (t >= 0 && t !== pFlr) {
                                    const land = computeStairLanding(pX, pZ, pFlr, t, aObj.meta);
                                    startClimb(t, 'stairs', land.x, land.z);
                                }
                            }
                        } else {
                            climbNoTrigger = false;   // off the stairs → future stair entries trigger again
                        }
                    }
                    // stepped onto glass shards? Maybe get cut.
                    const shard = glassShards.find(s => s.x === pX && s.z === pZ && s.f === pFlr);
                    if (shard && !shard._stepped) {
                        shard._stepped = true;       // only check on the step that lands here
                        const dmg = resolveShardDamage(shard);
                        if (dmg > 0) { playerHurt(dmg, 'cut on broken glass'); showMsg('You step on broken glass — ' + dmg + ' damage!'); playSnd('error'); }
                    } else if (!shard) {
                        // re-arm shards on tiles we've left
                        glassShards.forEach(s => { if (!(s.x === pX && s.z === pZ && s.f === pFlr)) s._stepped = false; });
                    }
                    // M#4: just stepped onto a tile — offer any pickup underfoot.
                    maybePromptPickup();
                    maybeEavesdrop();   // #13: overhear a scripted exchange if crouched here
                } else {
                    player.position.x += (dx / dist) * stepLen;
                    player.position.z += (dz / dist) * stepLen;
                }
            }
        }

        // #6: CONTINUOUS WALK. The keydown handler ignores input while isMov is
        // true, so historically the player fully STOPPED at each tile and only
        // moved again on the next browser key-repeat event — a lope with a hitch
        // at every tile. Here, the instant a step finishes, if a movement key is
        // still held we re-fire it so the next step begins on the SAME frame (no
        // stop). We re-dispatch through _keydownHandler (so collision/warp/stairs
        // all behave identically) with __auto:true, which turn() ignores — so a
        // held key only ever STEPS, never spins the view. Held keys live in
        // activeKeys (movement keys store a world-direction 0..3); Shift = face-
        // in-place, so we don't auto-step while it's down.
        if (!isMov && !isClimb && !isJump && !isSit && !gapPromptActive && !pickupPromptActive && !activeKeys['shift']
            && !(window.DialogueRuntime && window.DialogueRuntime.isActive())
            && !(typeof window.__hostPromptOpen === 'function' && window.__hostPromptOpen())) {
            const MOVE_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
            let heldKey = null;
            for (const mk of MOVE_KEYS) { if (activeKeys[mk] !== undefined) { heldKey = mk; break; } }
            if (heldKey) {
                try { _keydownHandler({ key: heldKey, shiftKey: false, __auto: true, preventDefault() {} }); } catch (e) {}
                // Seamless continuation: if that step was accepted this same frame,
                // advance into it by the distance we still had left when we hit the
                // last tile. Per-frame travel then stays ~constant across boundaries,
                // which is what removes the tile-to-tile "lope".
                if (isMov && _justArrivedOvershoot > 0) {
                    const ndx = tPos.x - player.position.x, ndz = tPos.z - player.position.z;
                    const nd = Math.hypot(ndx, ndz);
                    if (nd > 1e-4) { const adv = Math.min(_justArrivedOvershoot, nd); player.position.x += (ndx / nd) * adv; player.position.z += (ndz / nd) * adv; }
                }
            }
        }

        // SMOOTH FIRST-PERSON TURNING. In first-person, turning (Q/E or A/D
        // in retro scheme) sets a target rotation tRot; here we ease the player's
        // actual rotation toward it along the SHORTEST arc so the turn reads as a
        // visible sweep rather than an instant snap. (Iso view turns the camera,
        // not the player, so this only smooths the FPS facing.)
        {
            const inFpsView = (CONFIG.settings.camMode === 'fps')
                || ((CONFIG.settings.camMode === 'fps_toggle' || CONFIG.settings.camMode === 'fps_zoom')
                    && camManager && camManager.activeCam === camManager.perspCamera);
            if (inFpsView && typeof tRot === 'number') {
                let cur = player.rotation.y, tgt = tRot;
                // shortest-arc delta in (-π, π]
                let d = ((tgt - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                if (Math.abs(d) > 0.001) {
                    player.rotation.y = cur + d * Math.min(1, 12 * dt);
                } else {
                    player.rotation.y = tgt;
                }
            }
        }
        // While stepping (and not seated), swing the legs from the hip and the
        // arms in opposition for a simple walk. When idle, ease the limbs back
        // to a neutral standing pose. Seated pose is owned by setSeated().
        const L = player.userData && player.userData.limbs;
        // CROUCH-SNEAK CADENCE. When crouched AND moving, hold the
        // crouch pose (deep knee-bend from setCrouched) but add a small, slow leg
        // shuffle so the player visibly creeps instead of sliding as a frozen lump.
        // The amplitude is low and the phase advances slowly, reading as a careful
        // sneak rather than a walk or a hop.
        if (L && !player.userData.seated && window.__playerCrouching) {
            const _movingish = (isMov || (isClimb && climbVia === 'stairs')) && !isJump;
            // #6: keep the sneak gait alive across the 1-frame isMov=false gap at each
            // tile boundary (that freeze-and-resume, while the body glides on, was the
            // choppiness). A short glide timer bridges the gap; on a real stop we ease
            // the limbs back to the static stoop instead of freezing them mid-stride.
            player.userData._crouchGlide = _movingish ? 0.16 : Math.max(0, (player.userData._crouchGlide || 0) - dt);
            const hipBase = 0.7, kneeBase = -1.5;              // == setCrouched base (no clip)
            if (_movingish || player.userData._crouchGlide > 0) {
                player.userData.walkPhase += dt * 3.6;             // slow, deliberate creep cadence
                const sw = Math.sin(player.userData.walkPhase);
                L.legL.hip.rotation.x = hipBase + sw * 0.34;       // alternating stride (visible)
                L.legR.hip.rotation.x = hipBase - sw * 0.34;
                L.legL.knee.rotation.x = kneeBase - Math.max(0, sw) * 0.30;
                L.legR.knee.rotation.x = kneeBase - Math.max(0, -sw) * 0.30;
                L.armL.rotation.x = -0.5 - sw * 0.20;              // opposed arm swing
                L.armR.rotation.x = -0.5 + sw * 0.20;
                L.torso.position.set(0, L.hipY + 0.35 - Math.abs(sw) * 0.03, 0.02); // #3 seat + tiny bob
                L.torso.rotation.x = -0.06;                        // #3 gentle hunch
            } else {
                // crouch-IDLE: ease limbs back to the static stoop so stopping doesn't
                // leave the legs frozen mid-stride.
                const k = Math.min(1, 10 * dt);
                L.legL.hip.rotation.x += (hipBase - L.legL.hip.rotation.x) * k;
                L.legR.hip.rotation.x += (hipBase - L.legR.hip.rotation.x) * k;
                L.legL.knee.rotation.x += (kneeBase - L.legL.knee.rotation.x) * k;
                L.legR.knee.rotation.x += (kneeBase - L.legR.knee.rotation.x) * k;
                L.armL.rotation.x += (-0.5 - L.armL.rotation.x) * k;
                L.armR.rotation.x += (-0.5 - L.armR.rotation.x) * k;
                L.torso.position.set(0, L.hipY + 0.35, 0.02); L.torso.rotation.x = -0.06;
            }
        }
        else if (L && !player.userData.seated && !window.__playerCrouching) {
            const walking = (isMov && !isJump);
            if (isClimb && climbVia === 'ladder') {
                // LADDER climb — alternating hands/feet reaching up the rungs.
                player.userData.walkPhase += dt * 5.0;
                const sw = Math.sin(player.userData.walkPhase);
                L.legL.hip.rotation.x = -0.55 + sw * 0.45; L.legR.hip.rotation.x = -0.55 - sw * 0.45;
                L.legL.knee.rotation.x = 0.7; L.legR.knee.rotation.x = 0.7;
                L.armL.rotation.x = -2.3 + sw * 0.35; L.armR.rotation.x = -2.3 - sw * 0.35;   // arms up gripping rungs
                L.torso.position.set(0, L.hipY + 0.40, -0.02); L.torso.rotation.x = 0.0;
            } else if (isJump) {
                const air = Math.sin(jumpProgress * Math.PI);   // 0→1→0
                if (jumpStyle === 'climb') {
                    // CLIMB pose — one knee up high, torso pitched forward, arms
                    // reaching up as if pulling up and over.
                    L.legL.hip.rotation.x = -1.5 * air;
                    L.legR.hip.rotation.x = -0.4 * air;
                    L.legL.knee.rotation.x = 1.6 * air;
                    L.legR.knee.rotation.x = 0.6 * air;
                    L.armL.rotation.x = -1.4 * air;             // arms forward/up (reach)
                    L.armR.rotation.x = -1.4 * air;
                } else if (jumpStyle === 'recoil') {
                    // RECOIL pose — arms fly up, lean back (failed bounce).
                    L.armL.rotation.x = 1.4 * air;
                    L.armR.rotation.x = 1.4 * air;
                    L.legL.hip.rotation.x = 0.5 * air;
                    L.legR.hip.rotation.x = 0.5 * air;
                } else if (jumpStyle === 'falldown') {
                    // FALLDOWN pose — arms thrown up and out to brace, legs tuck a
                    // little as you drop to the floor below.
                    L.armL.rotation.x = -2.2 * air; L.armL.rotation.z = 0.4 * air;
                    L.armR.rotation.x = -2.2 * air; L.armR.rotation.z = -0.4 * air;
                    L.legL.hip.rotation.x = -0.7 * air;
                    L.legR.hip.rotation.x = -0.5 * air;
                    L.legL.knee.rotation.x = 0.9 * air;
                    L.legR.knee.rotation.x = 0.7 * air;
                } else {
                    // VAULT pose — tuck legs, swing arms.
                    L.legL.hip.rotation.x = -1.1 * air;
                    L.legR.hip.rotation.x = -1.1 * air;
                    L.legL.knee.rotation.x = 1.3 * air;
                    L.legR.knee.rotation.x = 1.3 * air;
                    L.armL.rotation.x = 0.9 * air;
                    L.armR.rotation.x = 0.9 * air;
                }
            } else if (walking) {
                player.userData.walkPhase += dt * 9;       // stride speed
                const s = Math.sin(player.userData.walkPhase) * 0.6;   // leg swing
                L.legL.hip.rotation.x = s;
                L.legR.hip.rotation.x = -s;
                // Knees bend a touch on the back-swing so feet clear the floor.
                L.legL.knee.rotation.x = Math.max(0, -s) * 0.5;
                L.legR.knee.rotation.x = Math.max(0, s) * 0.5;
                L.armL.rotation.x = -s * 0.7;
                L.armR.rotation.x = s * 0.7;
            } else {
                // Ease everything back to neutral standing.
                const ease = (o, key) => { o[key] += (0 - o[key]) * Math.min(1, dt * 12); };
                ease(L.legL.hip.rotation, 'x'); ease(L.legR.hip.rotation, 'x');
                ease(L.legL.knee.rotation, 'x'); ease(L.legR.knee.rotation, 'x');
                ease(L.armL.rotation, 'x'); ease(L.armR.rotation, 'x');
            }
        }

        // ── AI Update (NPC movement) ──
        // #6/#8: while crouched, sink the player toward the floor by __crouchDrop.
        // BUGFIX (#8 NEW BATCH): previously this only applied when NOT moving, so
        // a crouch-walking player popped UP to full height while gliding and
        // dropped back down on stop — that up/down bob is exactly the "bunny hop"
        // reported. Now the crouch drop is held CONTINUOUSLY (moving or still), so
        // the player stays low the whole time and creeps along at a constant height.
        if (!isJump && !isSit) {
            const drop = window.__crouchDrop || 0;
            const baseY = pFlr * FLR_H;
            if (drop > 0) {
                // Crouched: clamp Y to the lowered height every frame (the x/z lerp
                // still moves us; we just override the y the lerp pulled toward base).
                player.position.y = baseY - drop;
            } else if (!isMov) {
                player.position.y = baseY;
            }
        }
        // Three modes, set by n.meta.ai:
        //   'stand'  — never moves.
        //   'wander' — random cardinal steps. Frequency = n.meta.wanderChance
        //              (0..1 per frame; default 0.01). Higher = twitchier.
        //   'patrol' — walks an ordered list of waypoints (n.meta.waypoints,
        //              [{x,z}]). n.meta.patrolMode:
        //                'loop'  → 1,2,3,4,5,1,2,3,4,5,...
        //                'pingpong' (default) → 1,2,3,4,5,4,3,2,1,2,...
        //              Greedy one-step pathing toward the active waypoint. Door
        //              handling + blocked-behavior come from meta (see below).
        // Pathfinding/meta options honored:
        //   n.meta.canOpenDoors        (default true)  — may pass through doors
        //   n.meta.canOpenLockedDoors  (default false) — may pass locked doors
        //   n.meta.ifBlocked           'wait'|'skip'|'reverse' (default 'wait')
        const npcCanEnter = (n, nx, nz) => {
            if (nx < 0 || nx >= W || nz >= H || nz < 0) return false;
            const cell = MAP[n.f][nz][nx];
            if (cell.o?.block) return false;
            if (cell.o && cell.o.v !== 'npc' && cell.o.meta && cell.o.meta.solid) return false;   // solid prop in the way
            if (!(CONFIG.settings.allowEmptyWalk || cell.f)) return false;                          // need a floor tile
            // Never wander onto the PLAYER or another NPC (no clipping through people).
            if (n.f === pFlr && nx === pX && nz === pZ) return false;
            for (const o of npcs) { if (o !== n && o.f === n.f && o.x === nx && o.z === nz) return false; }
            // Never wander THROUGH a solid wall edge between the current and target
            // tile (NPCs were ghosting through walls). A door they may use is fine.
            const dx = nx - n.x, dz = nz - n.z;
            const dir = dz < 0 ? 'n' : dz > 0 ? 's' : dx > 0 ? 'e' : 'w';
            const here = MAP[n.f][n.z][n.x];
            const edge = here && here[dir];
            if (edge && (!edge.meta || edge.meta.solid !== false) && !String(edge.v || '').startsWith('door')) return false;
            // Door between current and target? Respect open-door permissions.
            const door = cell.o && (String(cell.o.v || '').startsWith('door'));
            if (door) {
                if (n.meta.canOpenDoors === false) return false;
                if (cell.o.meta?.locked && !n.meta.canOpenLockedDoors) return false;
            }
            return true;
        };
        npcs.forEach(n => {
            const mode = n.meta.ai;
            // while the world is paused (dialogue), NPCs don't START new
            // moves — but an in-progress hop still settles and detection/cone
            // recolor below still runs so nothing looks frozen mid-step.
            if (!worldPaused && (mode === 'wander') && !n.isMov) {
                // #18: a wandering patron HOLDS STILL when the player is right next to
                // them (within one tile on each axis, same floor), so they never drift
                // out of reach in the moment you're trying to face + talk to them. This
                // — together with the face-on-talk (#17) and the never-silent fallback
                // line below in the talk routing — means every NPC reliably responds.
                const _pNear = (n.f === pFlr) && (Math.abs(n.x - pX) <= 1) && (Math.abs(n.z - pZ) <= 1);
                const chance = _pNear ? 0 : ((typeof n.meta.wanderChance === 'number') ? n.meta.wanderChance : 0.01);
                if (Math.random() < chance) {
                    let ds = [[0, -1], [0, 1], [-1, 0], [1, 0]]; let d = ds[Math.floor(Math.random() * 4)];
                    let nx = n.x + d[0], nz = n.z + d[1];
                    if (npcCanEnter(n, nx, nz)) {
                        n.x = nx; n.z = nz; n.target = new THREE.Vector3(nx, n.f * FLR_H, nz); n.isMov = true; n._hopProg = 0; n.m.lookAt(n.target);
                    }
                }
            } else if (!worldPaused && mode === 'patrol' && !n.isMov) {
                const wps = n.meta.waypoints || [];
                if (wps.length >= 1) {
                    // Initialize patrol cursor + direction on first tick.
                    if (n._wpIdx == null) { n._wpIdx = 0; n._wpDir = 1; }
                    const pingpong = (n.meta.patrolMode || 'pingpong') !== 'loop';
                    let target = wps[Math.max(0, Math.min(wps.length - 1, n._wpIdx))];
                    // Reached the active waypoint? Advance the cursor.
                    if (target && n.x === target.x && n.z === target.z) {
                        if (pingpong) {
                            if (n._wpIdx >= wps.length - 1) n._wpDir = -1;
                            else if (n._wpIdx <= 0) n._wpDir = 1;
                            n._wpIdx += n._wpDir;
                        } else {
                            n._wpIdx = (n._wpIdx + 1) % wps.length;
                        }
                        target = wps[n._wpIdx];
                    }
                    if (target && (target.x !== n.x || target.z !== n.z)) {
                        // Greedy step: reduce the larger axis gap first, try the
                        // other axis if blocked. ifBlocked decides the fallback.
                        const dx = Math.sign(target.x - n.x), dz = Math.sign(target.z - n.z);
                        const tries = Math.abs(target.x - n.x) >= Math.abs(target.z - n.z)
                            ? [[dx, 0], [0, dz]] : [[0, dz], [dx, 0]];
                        let moved = false;
                        for (const [sx, sz] of tries) {
                            if ((sx || sz) && npcCanEnter(n, n.x + sx, n.z + sz)) {
                                n.x += sx; n.z += sz; n.target = new THREE.Vector3(n.x, n.f * FLR_H, n.z); n.isMov = true; n._hopProg = 0; n.m.lookAt(n.target); moved = true;
                                // #smooth: carry the leftover travel from the tile we just
                                // reached into this step so the walk doesn't hitch per tile.
                                if (n._carry > 0) {
                                    const cdx = n.target.x - n.m.position.x, cdz = n.target.z - n.m.position.z, cd = Math.hypot(cdx, cdz);
                                    if (cd > 1e-4) { const adv = Math.min(n._carry, cd); n.m.position.x += (cdx / cd) * adv; n.m.position.z += (cdz / cd) * adv; }
                                }
                                n._carry = 0;
                                break;
                            }
                        }
                        if (!moved) {
                            const ib = n.meta.ifBlocked || 'wait';
                            if (ib === 'skip') {
                                // Give up on this waypoint, advance to the next.
                                if (pingpong) { if (n._wpIdx >= wps.length - 1) n._wpDir = -1; else if (n._wpIdx <= 0) n._wpDir = 1; n._wpIdx += n._wpDir; }
                                else n._wpIdx = (n._wpIdx + 1) % wps.length;
                            } else if (ib === 'reverse' && pingpong) {
                                n._wpDir = -n._wpDir;
                            }
                            // 'wait' → do nothing this tick; try again next tick.
                        }
                    }
                }
            }
            if (n.isMov) {
                // #6: CONSTANT-SPEED glide toward the target tile. The old
                // exponential lerp(n.target, 5*dt) DECELERATED into every tile,
                // which read as the same "lope" the player had — a quick lunge
                // that crawls to a stop at each tile. A steady tiles/sec glide
                // reads as a real walk and never overshoots. HOW TO MODIFY:
                // NPC_SPEED is the stroll speed; vaulting moves go a touch faster.
                const NPC_SPEED = n.vaulting ? 4.5 : 2.6;          // tiles per second
                const ndx = n.target.x - n.m.position.x, ndz = n.target.z - n.m.position.z;
                const ndist = Math.hypot(ndx, ndz);
                const nstep = NPC_SPEED * dt;
                if (n._hopProg == null) n._hopProg = 0;
                n._hopProg = Math.min(1, n._hopProg + dt * (n.vaulting ? 5 : NPC_SPEED));
                // Stride phase advances continuously while moving (NOT reset per
                // tile) so the gait + foot-fall bob never hitch at tile boundaries.
                if (!n.vaulting) n._walkPhase = (n._walkPhase || 0) + dt * 9;
                // WALK CYCLE: swing the NPC's arms & legs like the player does, so
                // wandering NPCs visibly WALK instead of sliding.
                const Lw = n.m.userData && n.m.userData.limbs;
                if (Lw && !n.vaulting) {
                    const s = Math.sin(n._walkPhase) * 0.6;
                    if (Lw.legL && Lw.legL.hip) {
                        Lw.legL.hip.rotation.x = s; Lw.legR.hip.rotation.x = -s;
                        Lw.legL.knee.rotation.x = Math.max(0, -s) * 0.5;
                        Lw.legR.knee.rotation.x = Math.max(0, s) * 0.5;
                    }
                    if (Lw.armL) { Lw.armL.rotation.x = -s * 0.7; Lw.armR.rotation.x = s * 0.7; }
                }
                if (ndist <= nstep || ndist < 0.02) {
                    // arrived — snap to the tile; the AI picks the next target.
                    // #smooth: for PATROL walkers (a continuous path) remember the
                    // leftover travel so the next step can carry it and not hitch at
                    // the tile boundary. Wander NPCs pause between steps, so no carry.
                    if (n.meta.ai === 'patrol') n._carry = Math.max(0, nstep - ndist);
                    n.m.position.x = n.target.x; n.m.position.z = n.target.z;
                    n.m.position.y = n.f * FLR_H;
                    n.isMov = false; n._hopProg = 0; n.vaulting = false;
                } else {
                    n.m.position.x += (ndx / ndist) * nstep;
                    n.m.position.z += (ndz / ndist) * nstep;
                    // #smooth: vaults arc; a normal walk uses a gentle CONTINUOUS
                    // foot-fall bob driven by the stride phase (2 dips per stride),
                    // not a per-tile _hopProg arc that bounced once every tile.
                    if (n.vaulting) n.m.position.y = (n.f * FLR_H) + Math.sin(n._hopProg * Math.PI) * 1.4;
                    else n.m.position.y = (n.f * FLR_H) + Math.abs(Math.sin(n._walkPhase)) * 0.035;
                }
            }

            // ── SECONDARY IDLE ANIMATION ───────────────────
            // While STANDING STILL, an NPC can play a selectable idle animation
            // chosen in Mapster via meta.idleAnim:
            //   'none'       — no idle motion (default)
            //   'wave'       — raises a hand and waves; if meta.waveUntilTalked
            //                  (default true) the wave STOPS once the player has
            //                  talked to them (n._talkedTo, set in the Space
            //                  interaction). Helper NPCs use this to flag "talk to me."
            //   'lookaround' — gently turns the upper body left/right (glancing)
            //   'tapfoot'    — taps a foot (impatient idle)
            //   'nod'        — slow nod (leans the torso forward/back)
            // The animation drives the NPC's limb rig (m.userData.limbs). When the
            // NPC is walking we skip it and ease the arms back so a wave pose can't
            // freeze mid-step. To add a new idle: add a case below + an option in
            // Mapster's NPC editor (renderNpcSheetEditor, meta key 'idleAnim').
            (function idleAnim() {
                const L = n.m.userData && n.m.userData.limbs;
                if (!L) return;
                const mode = n.meta.idleAnim || 'none';
                const easeBack = () => {
                    const ez = (o, k) => { o[k] += (0 - o[k]) * Math.min(1, dt * 10); };
                    ez(L.armR.rotation, 'x'); ez(L.armR.rotation, 'z');
                    ez(L.armL.rotation, 'x');
                    ez(L.torso.rotation, 'x'); ez(L.torso.rotation, 'y');
                    if (L.legL && L.legL.hip) { ez(L.legL.hip.rotation, 'x'); ez(L.legR.hip.rotation, 'x'); ez(L.legL.knee.rotation, 'x'); }
                    ez(L.legR.knee.rotation, 'x');
                };
                // Don't idle-animate while moving, seated, or (for wave) after being
                // talked to with waveUntilTalked on.
                const waveDone = (mode === 'wave') && (n.meta.waveUntilTalked !== false) && n._talkedTo;
                if (n.isMov || mode === 'none' || waveDone) { easeBack(); return; }
                if (n._idleT == null) n._idleT = Math.random() * Math.PI * 2;
                n._idleT += dt;
                const t = n._idleT;
                if (mode === 'wave') {
                    // batch: point the arm STRAIGHT UP. The arm hangs at rot.x=0;
                    // rotating toward -PI (-3.14) swings it up to vertical, so values
                    // NEAR -pi are "straight up" and values nearer -pi/2 lean it BACK.
                    // -2.4 then -1.95 both leaned back (the wrong way); -2.9 is upright.
                    L.armR.rotation.x = -2.9;                       // ~straight up (just shy of vertical)
                    L.armR.rotation.z = Math.sin(t * 6) * 0.5;      // wave
                } else if (mode === 'lookaround') {
                    L.torso.rotation.y = Math.sin(t * 1.2) * 0.5;   // glance L/R
                } else if (mode === 'tapfoot') {
                    L.legR.knee.rotation.x = Math.max(0, Math.sin(t * 7)) * 0.5; // tap
                } else if (mode === 'nod') {
                    L.torso.rotation.x = 0.12 + Math.sin(t * 2) * 0.12; // slow nod
                }
            })();

            // ── STEALTH DETECTION ──────────────────────────────────────────
            // If this NPC has a vision cone, test whether the player is inside it
            // (within range AND within the half-angle of the NPC's forward, on the
            // same floor). Recolor the cone (yellow→red) and fire a host callback
            // the first time the player is caught, so the tutorial / game can react.
            // stealth detection + "spotted" popups ONLY run on maps that
            // declare stealth an objective (settings.stealthObjective). Prevents the
            // banner firing on non-stealth maps. Cones are still only built for
            // guardVision NPCs; this is a hard map-level gate on top of that.
            if (n.cone && n.visionRange && CONFIG.settings.stealthObjective) {
                const npos = n.m.position, ppos = player.position;
                const dx = ppos.x - npos.x, dz = ppos.z - npos.z;
                const dist = Math.hypot(dx, dz);
                // the EFFECTIVE range shrinks when the player crouch-sneaks and
                // when the area is dark (low light). These multipliers also resize
                // the visible cone so the player can SEE the change.
                let rangeMul = 1;
                // crouching NO LONGER shrinks the vision cone. Instead
                // it conceals you behind cover — counters already block sight of a
                // croucher (crouchHide below), and crouchCoverConceals() now hides
                // you behind/around ADJACENT solid cover and corners. Darkness still
                // shortens cones (that's light, not posture).
                rangeMul *= (typeof window.__lightLevel === 'number' ? Math.max(0.35, window.__lightLevel) : 1); // dark = smaller cone
                const effRange = n.visionRange * rangeMul;
                // Scale the cone mesh to match the effective range (visual feedback).
                if (n.cone.scale && Math.abs(n.cone.scale.x - rangeMul) > 0.01) n.cone.scale.set(rangeMul, rangeMul, rangeMul);
                let seen = false;
                if (Math.abs((player.position.y) - (n.f * FLR_H)) < 1.5 && dist <= effRange + 0.5 && dist > 0.001) {
                    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, n.m.rotation.y, 0));
                    const toPlayer = new THREE.Vector3(dx, 0, dz).normalize();
                    const ang = Math.acos(Math.max(-1, Math.min(1, fwd.dot(toPlayer))));
                    if (ang <= (n.visionHalfRad || 0.6)) {
                        // #2/#4: full walls always block; a counter only blocks when
                        // the player is CROUCHED (ducked behind it).
                        const crouchHide = !!window.__playerCrouching;
                        if (tileLineOfSight(Math.round(npos.x), Math.round(npos.z), pX, pZ, n.f, crouchHide)) seen = true;
                        // a CROUCHED player pressed against cover that
                        // sits between them and the watcher is concealed even when
                        // the raw sight-line clips past it (peeking around corners,
                        // hugging crates/counters).
                        if (seen && crouchHide && crouchCoverConceals(pX, pZ, n.f, npos.x, npos.z)) seen = false;
                    }
                }
                // Recolor the cone for feedback.
                const targetHex = seen ? 0xff4444 : (n.cone.userData.baseColor || 0xffe066);
                if (n.cone.material && n.cone.material.color.getHex() !== targetHex) {
                    n.cone.material.color.setHex(targetHex);
                    n.cone.material.opacity = seen ? 0.34 : 0.18;
                }
                // Fire the spotted callback once per continuous detection.
                if (seen && !n._spotted) {
                    n._spotted = true;
                    // SOFT DEFAULT RESPONSE — so stealth visibly
                    // "works" everywhere, not just where a host wires a handler.
                    // The guard snaps to FACE the player (turning toward the noise)
                    // and a retro "Spotted!" banner flashes. No hard penalty here;
                    // a host can escalate via window.engineOnPlayerSpotted (the
                    // tutorial, for example, sends you back to start).
                    try {
                        const faceAng = Math.atan2(dx, dz) + Math.PI; // look toward player
                        n._faceTarget = faceAng;                      // eased in the AI block
                        n.m.rotation.y = faceAng;                     // immediate turn
                        if (n.cone) n.cone.rotation.y = 0;            // cone follows (it's parented)
                    } catch (e) {}
                    const who = (n.meta && n.meta.name) ? n.meta.name : 'Someone';
                    showMsg(who + ' spotted you!');
                    playSnd('error');
                    if (typeof window.engineOnPlayerSpotted === 'function') {
                        try { window.engineOnPlayerSpotted(n.meta || {}); } catch (e) {}
                    }
                } else if (!seen && n._spotted) {
                    n._spotted = false;
                }
            }
        });

        // ── VFX Manager Updates ──
        // Each manager handles its own state machine (flicker timers, particle
        // physics, fog density easing). The engine just ticks them.
        lightingManager.update(time, window);
        fogManager.update(time, dt);
        weatherManager.update(time, dt);

        // #uplight-block: standing ON an uplight partially blocks it (your body
        // occludes the upward throw). Dim the light under the player's tile to
        // ~30%; restore otherwise (unless it's switched off, intensity already 0).
        if (uplightObjects.length) {
            uplightObjects.forEach(u => {
                if (!u.light) return;
                const onTile = (pX === u.x && pZ === u.z && pFlr === u.f);
                if (u.light.userData && u.light.userData.isOn === false) return;
                const target = onTile ? u.base * 0.3 : u.base;
                u.light.intensity += (target - u.light.intensity) * Math.min(1, 8 * dt);
            });
        }

        // #arrow: bob the pointing arrows; remove one when the player reaches its
        // tile (or the tile it points at), if disappear-on-reach.
        if (arrowObjects.length) {
            for (let i = arrowObjects.length - 1; i >= 0; i--) {
                const a = arrowObjects[i];
                a.t += dt * 3;
                a.grp.position.y = a.baseY + Math.sin(a.t) * 0.12;
                if (a.hidden) continue;   // not yet revealed → can't be reached
                if (pFlr === a.f && ((pX === a.x && pZ === a.z) || (pX === a.targetX && pZ === a.targetZ))) {
                    if (a.revealOnReach) {
                        for (const b of arrowObjects) {
                            if (b.name === a.revealOnReach && b.hidden) { b.hidden = false; b.grp.visible = true; }
                        }
                    }
                    if (a.disappear) { scene.remove(a.grp); arrowObjects.splice(i, 1); }
                }
            }
        }

        // EXIT WAYPOINTS no longer fire from merely STANDING on the
        // doorway tile. You leave by OPENING the exit door and WALKING THROUGH it —
        // see the open-exit-door branch in checkCollision(). (The old stand-on-tile
        // fire lived here.)

        // animate SPARKLE clusters — twinkle each sprite's opacity, slowly
        // spin the cluster, and billboard the sprites to face the camera.
        if (sparkleObjects.length) {
            const cam = (camManager && camManager.activeCam) ? camManager.activeCam : fallbackCamera;
            // occasional GLINT pulses. Each sparkle waits (invisible),
            // then runs one quick bright pulse: opacity and scale follow a sine
            // in-out over GLINT_DUR, with a fresh random tilt each pulse so
            // repeats don't look mechanical.
            const GLINT_DUR = 0.5, GLINT_GAP_MIN = 1.1, GLINT_GAP_RAND = 1.5;   // a bit more frequent/obvious
            sparkleObjects.forEach(s => {
                s.t += dt;
                const gl = s.grp.userData.glint; if (!gl) return;
                const m = s.grp.children[0]; if (!m) return;
                if (gl.p < 0) {                                  // waiting
                    if (s.t >= gl.next) { gl.p = 0; m.rotation.z = (Math.random() - 0.5) * 0.9; }
                    m.material.opacity = 0;
                } else {                                          // pulsing
                    gl.p += dt / GLINT_DUR;
                    if (gl.p >= 1) { gl.p = -1; gl.next = s.t + GLINT_GAP_MIN + Math.random() * GLINT_GAP_RAND; m.material.opacity = 0; }
                    else {
                        // brighter, more obvious glint — peak opacity
                        // pushed past 1 (additive, so it blooms) and a bigger swell.
                        const k = Math.sin(gl.p * Math.PI);       // 0→1→0 in-out
                        m.material.opacity = 1.5 * k;
                        const sc = 0.6 + 1.15 * k;
                        m.scale.set(sc, sc, sc);
                    }
                }
                if (cam) m.quaternion.copy(cam.quaternion);
            });
        }

        // ── Grass Wind ──
        // Only sway grass when weather is non-none AND the blade has windReact.
        // This rebuilds the instance matrix in-place; cheaper than re-creating
        // the mesh, but still on the hot path — could be batched.
        grassMeshes.forEach(gm => {
            // Only animate outdoor grass flagged to react to weather, and only
            // when there's actually windy/snowy weather active.
            if (!gm.userData.wind) return;
            const weather = weatherManager.getCurrentWeather();
            if (weather === 'none' || !weatherManager.isWindy || !weatherManager.isWindy()) return;
            const intensity = (weatherManager.getIntensity ? weatherManager.getIntensity() : 50) / 100; // 0..1
            // Snow/blizzard: heavier, slower droop. Wind/rain/storm: quicker sway.
            const isSnow = (weather === 'snow' || weather === 'blizzard');
            const speed = isSnow ? 1.0 : 2.4;
            const amp = (isSnow ? 0.12 : 0.28) * (0.4 + intensity);   // sway radians
            const droop = isSnow ? intensity * 0.18 : 0;              // constant lean from snow weight
            const dummy = new THREE.Object3D(); const m = new THREE.Matrix4();
            for (let i = 0; i < gm.count; i++) {
                gm.getMatrixAt(i, m);
                // Decompose so we keep each blade's original position/scale and
                // only re-derive rotation (the old code dropped position).
                dummy.position.setFromMatrixPosition(m);
                const px = dummy.position.x, pz = dummy.position.z;
                dummy.rotation.set(
                    Math.sin(time * speed + px * 4) * amp + droop,
                    dummy.rotation.y,
                    Math.cos(time * speed + pz * 4) * amp
                );
                dummy.updateMatrix();
                gm.setMatrixAt(i, dummy.matrix);
            }
            gm.instanceMatrix.needsUpdate = true;
        });

        // ── Mirror Round-Robin ──
        // Updating every cube-camera every frame is expensive, so we spread the
        // work: with 1–2 mirrors, refresh one each frame (smooth); with more,
        // round-robin. Hide the mirror's own mesh during its own render so it
        // doesn't reflect its back face. The cube cam renders the WHOLE scene,
        // so reflections include terrain, objects, NPCs, the player, and lights.
        mTick++;
        // every few frames, probe the tile the player is FACING for an NPC
        // and drive the stats overlay. Cheap (runs ~every 6th frame, only when
        // the player isn't mid-move). Mirrors the Space-handler facing math, and
        // includes the "NPC behind a counter" shortcut so clerks register too.
        if (mTick % 6 === 0 && !isMov) {
            const r = player.rotation.y;
            const fx = pX + (Math.abs(r + Math.PI / 2) < 0.01 ? 1 : (Math.abs(r - Math.PI / 2) < 0.01 ? -1 : 0));
            const fz = pZ + (Math.abs(Math.abs(r) - Math.PI) < 0.01 ? 1 : (Math.abs(r) < 0.01 ? -1 : 0));
            let fn = npcs.find(n => n.x === fx && n.z === fz && n.f === pFlr);
            if (!fn) {
                // look one tile further (counter clerk)
                const gx = fx + (fx - pX), gz = fz + (fz - pZ);
                const cand = npcs.find(n => n.x === gx && n.z === gz && n.f === pFlr);
                // only if there's a counter edge between us and them
                if (cand) fn = cand;
            }
            if (!fn) {
                // ADJACENCY fallback so an NPC's stats show whenever you're
                // standing next to them — not only when squarely facing their tile.
                // Keeps the panel populated "always" while you're beside someone.
                fn = npcs.find(n => n.f === pFlr && Math.abs(n.x - pX) + Math.abs(n.z - pZ) === 1);
            }
            updateNpcOverlay(fn ? fn.meta : null);
        }
        // neon "buzz" — subtle intensity wobble + the occasional brief
        // dropout, so tubes feel alive rather than a flat colored light.
        if (neonFlickers.length) {
            const tt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
            for (const nf of neonFlickers) {
                if (!nf.light) continue;
                const wob = 0.92 + 0.08 * Math.sin(tt * 7 + nf.base * 13);
                const drop = (Math.random() < 0.004) ? 0.4 : 1;   // rare flicker-out
                nf.light.intensity = nf.base * wob * drop;
            }
        }
        if (mirrorCams.length > 0) {
            // Prime every mirror for the first few frames so reflections appear
            // immediately; after that, round-robin to keep the cost down.
            const priming = mirrorCams.some(m => !m.primed);
            const updates = (priming || mirrorCams.length <= 2) ? mirrorCams.length : 1;
            for (let u = 0; u < updates; u++) {
                const idx = (priming || mirrorCams.length <= 2) ? u : (mTick % mirrorCams.length);
                const mc = mirrorCams[idx];
                if (!mc) continue;
                mc.mesh.visible = false;                 // don't reflect our own back face
                mc.cam.position.set(0, 0, 0.06);         // local: just in front of the plane
                mc.cam.updateMatrixWorld(true);          // #15: ensure the cube cam is at the mirror before it renders
                mc.cam.update(renderer, scene);
                mc.mesh.visible = true;
                mc.primed = true;
            }
        }

        // ── Camera Targeting ──
        // CameraManager picks orth/persp/cinematic/etc. itself. Fallback just
        // floats at an iso offset above the player.
        let renderCam = fallbackCamera;
        if (camManager) {
            renderCam = camManager.update(dt, player);
        } else {
            let tCamPos = player.position.clone().add(new THREE.Vector3(15, 20, 15));
            fallbackCamera.position.lerp(tCamPos, 10 * dt);
            fallbackCamera.lookAt(player.position);
        }

        // ── X-Ray Transparency for Occluding Walls ──
        // Restore opacity on any walls we hid last frame, then re-raycast
        // from camera → player and dim anything in the way. Skip in FPS
        // modes (no occlusion possible) and during cinematic swoops.
        hWalls.forEach(w => w.material.opacity = w.userData.oOp); hWalls = [];
        if (CONFIG.settings.camMode !== 'fps' && CONFIG.settings.camMode !== 'fps_toggle' && (!camManager || !camManager.isCinematic)) {
            if (player.position.distanceTo(renderCam.position) > 0.1) {
                // ── WALL SEE-THROUGH (x-ray) ──────────────────────────────────
                // Direct occluders only: a fan of rays from the camera to the
                // player's body (feet/center/head/shoulders). Any wall the rays hit
                // before reaching the player is DIRECTLY hiding the player, so it
                // clears to XRAY_NEAR opacity. This only ever reveals what's between
                // the camera and the player, so it never exposes unexplored rooms.
                // (The old "PASS 2" radius-widening fade was removed in #13 — see
                // the note at the end of this block.)
                //
                // TUNING: XRAY_NEAR (opacity of a wall hiding the player).
                const XRAY_NEAR = 0.10;       // opacity right next to the player
                const pp = player.position;
                const fade = (obj, op) => {
                    if (obj.userData.oOp >= 1.0 && hWalls.indexOf(obj) < 0) {
                        obj.material.transparent = true;
                        obj.material.opacity = op;
                        hWalls.push(obj);
                    } else if (hWalls.indexOf(obj) >= 0) {
                        // already faded by a closer pass — keep the MORE transparent value
                        obj.material.opacity = Math.min(obj.material.opacity, op);
                    }
                };
                // PASS 1 — direct occluders (always clear the player).
                const xrayTargets = [
                    pp,
                    new THREE.Vector3(pp.x, pp.y + 1.5, pp.z),   // head
                    new THREE.Vector3(pp.x, pp.y + 0.1, pp.z),   // feet
                    new THREE.Vector3(pp.x + 0.35, pp.y + 1.1, pp.z),  // right shoulder
                    new THREE.Vector3(pp.x - 0.35, pp.y + 1.1, pp.z),  // left shoulder
                ];
                xrayTargets.forEach(tgt => {
                    cDir.subVectors(tgt, renderCam.position).normalize();
                    ray.set(renderCam.position, cDir);
                    const dist = renderCam.position.distanceTo(tgt);
                    ray.intersectObjects(wallMeshes).forEach(h => {
                        // Direct occluders are cleared regardless of which floor they
                        // belong to — on an UPPER floor the wall hiding the player can
                        // be tagged to a different floor, which the old `=== pFlr` gate
                        // skipped (so x-ray "didn't work upstairs"). This pass only ever
                        // reveals the player's own tile, so clearing any occluder is safe.
                        if (h.distance < dist && h.object.userData.isW) {
                            fade(h.object, XRAY_NEAR);
                        }
                    });
                });
                // #13: PASS 2 (radius widening) REMOVED. It faded every wall within
                // ~4 tiles of the player on the camera side, so surfaces RIGHT NEXT to
                // you went translucent even when they weren't between the camera and
                // the player. PASS 1 above already clears the actual occluders via a
                // camera->player raycast, which is the only thing that should fade.
            }
        }

        renderer.render(scene, renderCam);

        // ── DIAGNOSTIC OVERLAY (F3, or the in-game setting) ──
        // FPS, frame time, draw calls/tris/geom/tex (renderer.info), JS heap,
        // player tile/facing, camera mode, paused state. ~5 DOM writes/sec.
        _diag.frames++;
        const _dnow = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (window.__showDiag) {
            if (_dnow - _diag.lastUpdate > 200) {
                const fps = _diag.frames / Math.max(0.001, (_dnow - _diag.lastUpdate) / 1000);
                _diag.frames = 0; _diag.lastUpdate = _dnow;
                const info = renderer.info || { render: {}, memory: {} };
                const heap = (performance && performance.memory)
                    ? `${(performance.memory.usedJSHeapSize/1048576).toFixed(0)}/${(performance.memory.jsHeapSizeLimit/1048576).toFixed(0)} MB` : 'n/a';
                const el = _ensureDiagEl();
                if (el) { el.innerHTML =
                    `<b style="color:#7dd3fc">DIAGNOSTICS</b>  <span style="opacity:.6">F3 to hide</span><br>` +
                    `FPS: <b>${fps.toFixed(0)}</b>  (${(dt*1000).toFixed(1)} ms)<br>` +
                    `draws: ${info.render.calls||0}  tris: ${info.render.triangles||0}<br>` +
                    `geom: ${info.memory.geometries||0}  tex: ${info.memory.textures||0}<br>` +
                    `heap: ${heap}<br>` +
                    `tile: (${pX},${pZ}) f${pFlr}  face:${['N','E','S','W'][tRot]||tRot}<br>` +
                    `cam: ${CONFIG.settings.camMode||'?'}  ${window.__worldPaused?'<span style="color:#fbbf24">PAUSED</span>':'running'}`;
                    el.style.display = 'block'; }
            }
        } else if (_diag.shown) {
            const el = document.getElementById('diag-overlay'); if (el) el.style.display = 'none';
            _diag.frames = 0; _diag.lastUpdate = _dnow;
        }
        _diag.shown = !!window.__showDiag;

        // Refresh the small minimap overlay (if visible) every few frames.
        // Cheap to redraw — it's just rects on a 120×120 canvas — but no
        // point doing it on a paused/hidden minimap.
        _minimapTick = (_minimapTick + 1) % 6;
        if (_minimapTick === 0) {
            markVisited(pFlr, pX, pZ);   // #13b: record presence for fog reveal
            const mm = document.getElementById('minimap-mini');
            if (mm && mm.style.display === 'block') renderMinimapMini();
        }
    }
    let _minimapTick = 0;
    // Diagnostic-overlay state + lazy DOM builder (F3 toggles window.__showDiag).
    const _diag = { frames: 0, lastUpdate: 0, shown: false };
    function _ensureDiagEl() {
        let el = document.getElementById('diag-overlay');
        if (!el) {
            const host = document.getElementById('game-container') || document.body;
            el = document.createElement('div');
            el.id = 'diag-overlay';
            el.style.cssText = 'position:absolute;top:8px;left:8px;z-index:80;background:rgba(6,10,20,0.82);border:1px solid #334155;border-radius:5px;color:#cbd5e1;font:11px/1.45 monospace;padding:6px 9px;pointer-events:none;white-space:nowrap;display:none;';
            host.appendChild(el);
        }
        return el;
    }

    // Kick off the render loop. From here on, the engine is alive.
    requestAnimationFrame(anim);
}

// ════════════════════════════════════════════════════════════════════════════
// AUTO-LAUNCH
// ────────────────────────────────────────────────────────────────────────────
// We don't want to fire initEngine() inside Mapster's main UI page — only
// inside the exported games (which contain a #map-data element). So we
// gate the auto-launch on that element's presence.
//
// The export template (mapster.html → <script id="export-template">) also
// dispatches a window.load handler that ALSO calls initEngine(). Both fire
// in an exported map. initEngine() now guards against this with the
// window.__midmultiEngineStarted flag at its top — whichever call lands
// second is a no-op, so only ONE engine ever starts. (Previously both ran,
// creating two fighting engines — see the note at the top of initEngine.)
// ════════════════════════════════════════════════════════════════════════════
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('map-data')) initEngine();
    });
} else {
    if (document.getElementById('map-data')) initEngine();
}
