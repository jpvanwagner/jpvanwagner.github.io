/* ============================================================================
 *  core/tutorial.js  —  MODULAR TUTORIAL / FEATURE-DEMO SYSTEM
 * ----------------------------------------------------------------------------
 *  Loads AFTER core/debugroom.js (it reuses that file's map-view plumbing:
 *  openMapView / mountMapCanvas / the dialogue overlay, plus game.js globals
 *  Screens / State / render / goto / sfx / flash / logEvent / MAP_SCREENS).
 *
 *  DESIGN GOALS (per the brief):
 *   • Each lesson is a SELF-CONTAINED, hard-coded little map demoing ONE cluster
 *     of mechanics, so it can later be dropped into the real game when that
 *     feature becomes relevant — nothing here front-loads the whole game.
 *   • POST-CHARGEN FLOW:  chargen → Screens.WAKE_UP (the Day-1 home/morning
 *     routine — a typed-command scene that teaches TIME + RESTED) → then
 *     Screens.TUTORIAL_OFFER offers the optional hands-on MAP lessons (yes plays
 *     them in order with SKIP-ALL / NEXT / BACK; skip drops straight into the game).
 *   • Every lesson is individually REPLAYABLE from Help, and replaying snapshots
 *     + restores the character + world so it never disrupts a game in progress.
 *   • One lesson is a branching dialogue (our retro overlay) that shows
 *     trait-gated options, including a TUTORIAL-ONLY temporary stat buff (a
 *     bright +N by the stat) that unlocks a high-stat option, then goes away.
 *
 *  ── HOW TO ADD A LESSON ─────────────────────────────────────────────────────
 *  Push an entry onto TUTORIAL_LESSONS:
 *    {
 *      key:    'unique_id',
 *      title:  'Shown in menus / Help',
 *      blurb:  'One line describing what it teaches.',
 *      buildMap(): returns map data (same shape as a Mapster export: {map,name,
 *                  settings,fogSettings,start}); use the M.* builder helpers.
 *      intro:  optional array of MID-lower description lines shown under the map.
 *      onEnter(): optional, runs right after the map mounts (e.g. set a buff).
 *      onExit():  optional, runs when leaving the lesson (clean up buffs, etc).
 *    }
 *  The runner handles sequencing, skip/next/back, and character safety for you.
 * ========================================================================== */
(function () {
  'use strict';

  // ── MAP BUILDER HELPERS ───────────────────────────────────────────────────
  // A tiny builder mirroring tools/build_debug_room.js so each lesson can author
  // its map in a few readable lines. makeBlank(w,h) returns a builder bound to a
  // fresh grid; finish() packages it into engine-ready map data.
  function makeBlank(W, H, opts) {
    opts = opts || {};
    const emptyCell = () => ({ f: null, o: null, c: null, n: null, s: null, e: null, w: null, d1: null, d2: null });
    // optional multi-floor maps. opts.floors (default 1) builds that
    // many [rows][cols] grids. The classic helpers (floor/obj/edge/perimeter/fill)
    // still target floor 0 so every existing single-floor map is unchanged; the
    // *F variants below take an explicit floor index for 2-story maps.
    const nFloors = Math.max(1, opts.floors || 1);
    const map = [];
    for (let f = 0; f < nFloors; f++) map.push(Array.from({ length: H }, () => Array.from({ length: W }, emptyCell)));
    const B = {
      W, H, map, floors: nFloors,
      floor: (x, z, v, c, meta) => { map[0][z][x].f = { n: v, v, c, ac: '#666', meta: meta || {} }; },
      obj:   (x, z, v, c, s, meta) => { map[0][z][x].o = { n: v, v, c, s: s || '', meta: meta || {} }; },
      edge:  (x, z, dir, v, c, meta) => { map[0][z][x][dir] = { n: v, v, c, meta: meta || {} }; },
      // floor-indexed variants (for multi-story maps)
      floorF: (f, x, z, v, c, meta) => { map[f][z][x].f = { n: v, v, c, ac: '#666', meta: meta || {} }; },
      objF:   (f, x, z, v, c, s, meta) => { map[f][z][x].o = { n: v, v, c, s: s || '', meta: meta || {} }; },
      edgeF:  (f, x, z, dir, v, c, meta) => { map[f][z][x][dir] = { n: v, v, c, meta: meta || {} }; },
      lightF: (f, x, z, c, meta) => { map[f][z][x].c = { n: 'light', v: 'light', c: c || '#fff4d6', meta: Object.assign({ lightColor: c || '#fff4d6', intensity: 0.3, castShadow: false, distance: 6 }, meta || {}) }; },
      fillF:  (f, v, c, meta) => { for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) map[f][z][x].f = { n: v, v, c, ac: '#666', meta: meta || {} }; },
      perimeterF(f, c, o2) {
        o2 = o2 || {}; c = c || '#6b7f9e'; if (c === '#1e3a5f') c = '#5a76a0';
        for (let x = 0; x < W; x++) { this.edgeF(f, x, 0, 'n', 'solid', c, { solid: true }); this.edgeF(f, x, H - 1, 's', 'solid', c, { solid: true }); }
        for (let z = 0; z < H; z++) { this.edgeF(f, 0, z, 'w', 'solid', c, { solid: true }); this.edgeF(f, W - 1, z, 'e', 'solid', c, { solid: true }); }
        if (!o2.noCeiling) { const step = 5, half = 2; for (let z = half; z < H - 1; z += step) for (let x = half; x < W - 1; x += step) this.lightF(f, x, z, '#fff4d6'); }
      },
      // Convenience: a solid perimeter wall around the whole grid.
      // the old tutorial walls were dark navy on a black void with
      // no ceiling lights, so rooms read as floating slabs. Now perimeter() builds
      // CLEARLY-VISIBLE walls and lights the room so it reads as an enclosed space.
      // Pass { outdoor:true } to SKIP the walls entirely for a room meant to be
      // outdoors (also set bgMode:'sky' + a ground floor in that lesson's finish()).
      // Pass { noCeiling:true } to keep walls but skip the auto ceiling lights.
      perimeter(c, opts) {
        opts = opts || {};
        if (opts.outdoor) return;        // outdoor rooms: no enclosing walls
        c = c || '#6b7f9e';
        // Lift the old dark-navy tutorial color so walls contrast with the void.
        if (c === '#1e3a5f') c = '#5a76a0';
        for (let x = 0; x < W; x++) { this.edge(x, 0, 'n', 'solid', c, { solid: true }); this.edge(x, H - 1, 's', 'solid', c, { solid: true }); }
        for (let z = 0; z < H; z++) { this.edge(0, z, 'w', 'solid', c, { solid: true }); this.edge(W - 1, z, 'e', 'solid', c, { solid: true }); }
        // Light the room with soft, even FILL lights. These ceiling lights are
        // intentionally NON-shadow-casting: in a small room, several shadow-casting
        // overhead points each throw their own oversized shadow, which stack into
        // the harsh, distracting mess that was reported. Shadows are NOT removed —
        // every object still casts ONE realistic, soft shadow from the scene's
        // directional KEY light (LightingManager.mainDir, now high-res + blurred).
        // These fill lights just raise the room's brightness evenly and gently.
        if (!opts.noCeiling) {
          const step = 5, half = 2;
          for (let z = half; z < H - 1; z += step)
            for (let x = half; x < W - 1; x += step)
              map[0][z][x].c = { n: 'light', v: 'light', c: '#fff4d6', meta: { lightColor: '#fff4d6', intensity: 0.3, castShadow: false, distance: 6 } };
        }
      },
      // Fill the whole floor with one tile type.
      fill(v, c, meta) { for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) this.floor(x, z, v, c, meta); },
      // ── Wave I: EXIT DOOR ────────────────────────────────────────────────
      // An EXIT is a DOOR set into the EXISTING perimeter wall (no new walls are
      // added). exitDoor() drops a door into the perimeter on the chosen side at
      // the given coordinate, mounts a compact "EXIT" sign ABOVE it, and makes the
      // doorway tile the move-on waypoint — so walking up to / through the door
      // advances the lesson. Call AFTER perimeter() so the door overwrites the
      // solid wall segment there.
      //   exitDoor(pos, opts) where pos is the coordinate ALONG the chosen wall.
      // opts: { side:'s'|'n'|'e'|'w', doorType, doorColor, text, signName, signColor }
      // Returns { x, z } — the doorway tile (point arrows here).
      exitDoor(pos, opts) {
        opts = opts || {};
        const side = opts.side || 's';
        const doorType = opts.doorType || 'door_swing';
        let dx, dz, edgeDir, signMount;
        if (side === 's')      { dx = pos;   dz = H - 1; edgeDir = 's'; signMount = 's'; }
        else if (side === 'n') { dx = pos;   dz = 0;     edgeDir = 'n'; signMount = 'n'; }
        else if (side === 'e') { dx = W - 1; dz = pos;   edgeDir = 'e'; signMount = 'e'; }
        else                   { dx = 0;     dz = pos;   edgeDir = 'w'; signMount = 'w'; }
        // Door punched into the existing perimeter wall (overwrites the solid edge).
        this.edge(dx, dz, edgeDir, doorType, opts.doorColor || '#b45309', { locked: false, dir: 0, hp: 0 });
        // Compact EXIT sign mounted ABOVE the door; its tile is the move-on waypoint,
        // so reaching the doorway (going through the door) advances.
        this.obj(dx, dz, 'exit_sign', opts.signColor || '#d11f1f', '', { solid: false, name: opts.signName || 'Exit', exitWaypoint: true, mountDir: signMount, text: opts.text || 'Through the door — continuing...' });
        return { x: dx, z: dz };
      },
      // Wave I: ACTION arrow — points the player at the action to perform and, when
      // reached, REVEALS the hidden EXIT arrow. Pair with exitArrow().
      actionArrow(x, z, dir, atX, atZ, color) {
        this.obj(x, z, 'arrow', color || '#ffd23f', '', { arrowDir: dir, disappearOnReach: true, pointAtX: atX, pointAtZ: atZ, name: 'action', revealOnReach: 'exit' });
      },
      // Wave I: EXIT arrow — starts HIDDEN; revealed once the action arrow is
      // reached, then points to the exit DOOR (atX/atZ should be the doorway tile).
      exitArrow(x, z, dir, atX, atZ, color) {
        this.obj(x, z, 'arrow', color || '#ff8a3f', '', { arrowDir: dir, disappearOnReach: true, pointAtX: atX, pointAtZ: atZ, name: 'exit', hidden: true });
      },
    };
    return B;
  }
  function finish(B, name, startX, startZ, settingsOverride) {
    const settings = Object.assign({
      // EVERY tutorial map uses FFT-style camera-relative movement so
      // WASD stay consistent as the view rotates (was only on the movement map).
      // Per-map override still wins (pass movementMode:'fixed' to opt a map out).
      movementMode: 'camera',
      bgMode: 'black', allowEmptyWalk: false, camMode: 'iso_45', fpsZoomDist: 6,
      startZoomDist: 8, zoomMode: 'incremental', tiltEnabled: true, ambUrl: '', bgmUrl: '',
      edgeWarpUrl: '', edgeBehavior: 'block', edgeWarpX: 0, edgeWarpY: 0,
      minimapMode: 'toggle', compassMode: 'on', textPosition: 'bottom',
      flashlight: true, allowWindowDraw: true, camN: true, camE: true, camS: true, camW: true,
      minimapCorner: 'tl', disableLocations: true, zoneDisplay: 'off', fogDisplay: 'off',
      fogDiscoverable: false, flashlightMinimap: 'off', flashlightRevealSize: 4, zoneDefs: []
    }, settingsOverride || {});
    return {
      map: B.map, name: name,
      settings,
      fogSettings: [{ enabled: false, color: '#222222', density: 20, outdoor: false, weather: 'none', weatherInt: 50 }],
      start: { x: startX, z: startZ, f: 0 },
    };
  }
  // A talking guide NPC carrying a dialogue tree (uses the debug dialogue
  // overlay). Dialogue ONLY — no vision cone, no directory behaviour.
  // ── TUTORIAL NPC NAMES ────────────────────────────────────────────────────
  // Every tutorial NPC draws a UNIQUE first name from the shared pool
  // (stats/names.js) at tutorial start, never reusing one and never reusing the
  // PLAYER's name. Builders reference TUT.<role> so the same name is used in the
  // map, the coaching intro, and any NPC dialogue that mentions them.
  let TUT = {};
  function assignTutorialNames() {
    const used = [];
    const ex = (State && State.character && State.character.name) || '';
    const P = (typeof window !== 'undefined') && window.NamePool;
    const u = () => P ? P.pickUnique(used, ex) : 'NPC';
    TUT = {
      pat: u(), ray: u(), dot: u(), mae: u(), sal: u(), ned: u(),
      gus: u(), marge: u(), hank: u(), dewey: u(), lou: u(), cal: u(),
    };
  }

  function guide(B, x, z, name, tree, cloth) {
    B.obj(x, z, 'npc', '#ffccaa', '', {
      name, ai: 'stand', rot: 2, skin: '#ffccaa', cloth: cloth || '#2563eb',
      solid: true, reqFacing: false,
      dialogue: 'Talk to me to learn.', debugMenu: tree,
      // the guide waves you over until you start the conversation.
      idleAnim: 'wave', waveUntilTalked: true,
    });
  }

  // A stationary "tip-giver" NPC: stand near it and press Space for a short
  // blurb about this lesson's mechanic and how it helps in the wider game. Solid
  // (no walking through), faces the player, no vision cone.
  function tipGiver(B, x, z, name, blurb, cloth) {
    B.obj(x, z, 'npc', '#ffccaa', '', {
      name, ai: 'stand', rot: 2, skin: '#ffccaa', cloth: cloth || '#2563eb',
      solid: true, reqFacing: false, dialogue: blurb,
      // helper NPCs WAVE at the player until talked to, flagging
      // "come talk to me." The wave stops once you interact (waveUntilTalked).
      idleAnim: 'wave', waveUntilTalked: true,
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  THE LESSONS
  // ════════════════════════════════════════════════════════════════════════

  // 1b) PARKING LOT — the editable Mapster map at Mapster/maps/tutorial/parking_lot.*
  // A lesson's buildMap() just returns Mapster-export-shaped data
  // {map,name,settings,fogSettings,start} — which is EXACTLY what
  // parking_lot.data.js preloads as window.__MAPDATA_parking_lot. So we bridge the
  // JSON straight in (a CLONE, so replaying resets the doors/key). To change the
  // map, open parking_lot.html in Mapster and re-export — NO code changes here.
  function buildParkingLot() {
    const src = (typeof window !== 'undefined') ? window.__MAPDATA_parking_lot : null;
    if (src && src.map) {
      const data = JSON.parse(JSON.stringify(src));     // clone so the lesson never mutates the preload
      if (data.settings) data.settings.movementMode = 'camera';   // keep WASD view-relative like other lessons
      return data;
    }
    // Fallback (only if the preload script didn't load, e.g. a file:// path issue):
    // a tiny safe lot so the lesson still opens instead of erroring.
    const B = makeBlank(6, 6); B.fill('pavement', '#777c82'); B.perimeter('#1e3a5f');
    B.obj(3, 4, 'start', '#f43f5e', '', {});
    return finish(B, 'parking_lot_fallback', 3, 4, {});
  }

  // 5) SUNRISE MULTIPLEX (item 5): the end-of-tutorial map, now an EDITABLE Mapster
  // file (Mapster/maps/tutorial/sunrise.*). Same bridge pattern as buildParkingLot:
  // return the preloaded window.__MAPDATA_sunrise clone so edits in Mapster show up
  // here with no code changes. buildMinimap() stays below as the original source.
  function buildSunrise() {
    const src = (typeof window !== 'undefined') ? window.__MAPDATA_sunrise : null;
    if (src && src.map) return JSON.parse(JSON.stringify(src));
    return buildMinimap();   // fallback to the procedural build if the preload is missing
  }

  // 3) WINDOWS — draw on a window, then smash it (shards on the floor).
  function buildWindows() {
    const B = makeBlank(9, 9);
    B.fill('concrete', '#9aa0a6');
    B.perimeter('#1e3a5f');
    B.obj(4, 6, 'start', '#f43f5e', '', {});
    // A run of drawable, breakable glass on the north interior wall.
    for (let x = 2; x <= 6; x++) {
      const free = (x <= 3);
      B.edge(x, 3, 'n', 'glass_full', '#bae6fd', {
        solid: true, breakable: true, hp: 1, canvasWidth: 1, paintOpacity: 1.0, allowDraw: true,
        breakReqType: free ? 'none' : 'skill', breakReqSkill: 'force', breakReqValue: 3, breakFailDamage: 0,
        shardDamageMode: 'sometimes', shardDamageReqSkill: 'dodge', shardDamageReqValue: 5, shardDamageAmt: 1,
        borderOn: true, borderColor: '#c0c0c0', breakBothSides: true,
      });
    }
    tipGiver(B, 4, 4, TUT.dot,
      'Face a window and press Space. Some you can draw on (great for signage), some you can smash if you have the muscle — and a few you can do either, so we ask which.',
      '#1f6a6a');
    // exit DOOR in the north wall; arrows guide to the glass, then
    // reveal the door once you reach it.
    B.exitDoor(7, { side: 'n', signName: 'Exit', text: 'Done with the glass? Nice. Continuing...' });
    B.actionArrow(4, 5, 'n', 4, 3, '#bae6fd');   // work the glass on the north wall
    B.exitArrow(7, 2, 'n', 7, 0, '#ff8a3f');     // hidden -> the north door
    return finish(B, 'tut_windows', 4, 6, { startZoomDist: 5, allowWindowDraw: true });
  }

  // 4) DIALOGUE TREES — a branching conversation with trait-gated options. We
  //    apply a TUTORIAL-ONLY temporary buff to reveal a gated option, then drop
  //    it; then repeat with a second stat. The gating is evaluated against the
  //    buffed value via tutorialStat() below, so the overlay can hide options.
  function buildDialogue() {
    // INTIMATE BOX-OFFICE PARLOR — small, warm, and lamplit: cream marble, deep
    // MAROON walls and amber light, with Mae behind a little ticket counter. The
    // warm palette + counter make it read completely differently from the big,
    // cool, open movement lobby.
    const B = makeBlank(7, 7);
    B.fill('marble', '#e8dcc0');                 // warm cream marble (vs the lobby's cool grey tile)
    B.perimeter('#5b2a2a');                       // deep maroon walls (everyone else's walls are navy)
    // amber parlor lighting in the front corners
    B.obj(1, 1, 'uplight', '#ffd9a0', '', { lightColor: '#ffd9a0', intensity: 1.5 });
    B.obj(5, 1, 'uplight', '#ffd9a0', '', { lightColor: '#ffd9a0', intensity: 1.5 });
    B.obj(3, 5, 'start', '#f43f5e', '⭐', {});
    // Mae works the BOX OFFICE: a ticket register beside her + a low counter you
    // chat across (the counter-clerk interaction lets you talk over it).
    B.obj(2, 2, 'register', '#cbd5e1', '', { solid: true });
    B.edge(3, 2, 's', 'counter', '#7a4a24', { solid: true, connects: true });
    B.edge(4, 2, 's', 'counter', '#7a4a24', { solid: true, connects: true });
    // a velvet rope queue line along the west
    B.edge(1, 4, 'e', 'rope', '#a3163b', { solid: true });
    // The guide stands across the counter; talking opens the lesson tree.
    guide(B, 3, 2, TUT.mae, DIALOGUE_TREE, '#7c3aed');
    // a real exit DOOR (east wall) so you leave like every other lesson.
    B.exitDoor(5, { side: 'e', signName: 'Exit', text: 'Done chatting? Nice. Continuing...' });
    B.actionArrow(3, 4, 'n', 3, 3, '#a78bfa');   // step up to Mae's window and press Space to talk
    B.exitArrow(5, 5, 'e', 6, 5, '#ff8a3f');      // hidden -> the east door once you've reached Mae
    return finish(B, 'tut_dialogue', 3, 5, { startZoomDist: 4.5 });
  }

  // 5) FIRST-PERSON & FPS SETTINGS — a short corridor to walk in first-person.
  //    Starts in first-person so the lesson is immediately about FPS movement;
  //    the control scheme (crawler vs retro) is a Settings option we point to.
  function buildFirstPerson() {
    const B = makeBlank(5, 11);
    B.fill('carpet', '#0a0a12', { arcadeStyle: 'cosmic' });
    B.perimeter('#1e3a5f');
    // A poster standee partway down as an orientation landmark (solid, real prop).
    B.obj(3, 5, 'standee', '#22d3ee', '', { solid: true });
    // A tip-giver who explains first-person.
    tipGiver(B, 1, 5, TUT.sal,
      'You start in first-person here. W/A/S/D walks, Q/E turns. Press V any time to pop between first-person and the overhead view — use whichever reads better for a task.',
      '#7c3aed');
    // exit DOOR at the corridor's end; arrows walk you up the hall
    // in first-person (these are the arrows that pointed the WRONG way before the
    // v70 n/s fix), then reveal the door.
    B.exitDoor(2, { side: 'n', signName: 'Exit', text: 'Comfortable in first-person? Nice. Continuing...' });
    B.actionArrow(2, 7, 'n', 2, 5, '#10b981');   // walk up the hall, past the standee
    B.exitArrow(2, 3, 'n', 2, 0, '#ff8a3f');     // hidden -> the door at the end
    // camMode fps_toggle + fpsStartView 'first' opens directly in first-person.
    return finish(B, 'tut_firstperson', 2, 9, { camMode: 'fps_toggle', fpsStartView: 'first', startZoomDist: 5 });
  }

  // 2+6 COMBINED (item 8): VAULTING + SWITCHES + SNEAKING in one course. You vault
  // a skill-checked counter to enter a guarded lane, then use crouch, the cover
  // counter, and the light switch (dims the room -> shrinks the vision cones) to
  // slip past the staff to the exit behind them.
  function buildCombinedStealth() {
    const B = makeBlank(13, 11);
    B.fill('concrete', '#9aa0a6');
    B.perimeter('#1e3a5f');
    B.obj(6, 9, 'start', '#f43f5e', '', {});
    // ENTRY: a skill-checked VAULT counter you must clear to reach the guarded lane.
    B.edge(5, 7, 'n', 'counter', '#b45309', { solid: true, jumpable: true, connects: true, jumpReqType: 'skill', jumpReqSkill: 'vault', jumpReqValue: 4 });
    B.edge(6, 7, 'n', 'counter', '#b45309', { solid: true, jumpable: true, connects: true, jumpReqType: 'skill', jumpReqSkill: 'vault', jumpReqValue: 4 });
    B.edge(7, 7, 'n', 'counter', '#b45309', { solid: true, jumpable: true, connects: true, jumpReqType: 'skill', jumpReqSkill: 'vault', jumpReqValue: 4 });
    // STAFF with vision cones covering the lane (face south, rot 2).
    B.obj(4, 1, 'npc', '#ffccaa', '', { name: 'Stan', ai: 'stand', rot: 2, solid: true, skin: '#ffccaa', cloth: '#1f6a6a', reqFacing: false, guardVision: true, visionRange: 4, visionCone: 70, dialogue: 'Keep out of my sight.' });
    B.obj(9, 1, 'npc', '#ffccaa', '', { name: 'Roy', ai: 'stand', rot: 2, solid: true, skin: '#ffccaa', cloth: '#5b1a1a', reqFacing: false, guardVision: true, visionRange: 4, visionCone: 70, dialogue: 'No sneaking around.' });
    // COVER counter to duck behind (breaks line of sight).
    for (let x = 3; x <= 10; x++) B.edge(x, 4, 'n', 'counter', '#b45309', { solid: true });
    // LIGHTS + a switch (linkId 'lights') — flip OFF to dim and shrink the cones.
    B.obj(2, 1, 'uplight', '#fff3c0', '', { lightColor: '#fff3c0', intensity: 1.6, linkId: 'lights' });
    B.obj(11, 1, 'uplight', '#fff3c0', '', { lightColor: '#fff3c0', intensity: 1.6, linkId: 'lights' });
    B.edge(0, 6, 'w', 'solid', '#5a76a0', { solid: true, linkId: 'lights', intensity: 1.6,
      attachments: [{ v: 'switch', offset: 0, offsetY: 0.1, color: '#ffd23f', neonText: '00', sparkle: true, sparkleColor: '#fff6a8' }] });
    // Tip-giver by the start (out of the cones).
    tipGiver(B, 2, 8, TUT.ned,
      'First VAULT the counter (Space — a Reflexes check). Beyond it the yellow cones are what the staff can see. Crouch (X), hug the cover counter, and flip the wall SWITCH to kill the lights and shrink the cones. Then slip past to the Exit.',
      '#334155');
    // Exit DOOR in the north wall, BEHIND the guards.
    B.exitDoor(6, { side: 'n', signName: 'Exit', text: 'Vaulted, dimmed, and slipped past — nice. Continuing...' });
    // The way you came in: a shut door behind the start under an ENTRANCE sign —
    // the in-joke answer to the parking lot's theater doors being marked EXIT.
    // Decorative only (no exitWaypoint), and the door stays shut.
    B.edge(6, 10, 's', 'door_swing', '#7c2d12', { locked: true, reqKey: '__came_in_this_way__', lockedMsg: 'That\u2019s the way you came in.', dir: 0, hp: 0 });
    B.obj(6, 10, 'exit_sign', '#1f8a3a', '', { solid: false, name: 'Entrance', mountDir: 's', signText: 'ENTRANCE' });
    B.actionArrow(6, 8, 'n', 6, 7, '#ffd23f');   // vault the counter first
    B.exitArrow(6, 2, 'n', 6, 0, '#ff8a3f');     // hidden -> the north door
    return finish(B, 'tut_course', 6, 9, { startZoomDist: 7, showVisionCones: true, stealthObjective: true });
  }

  // 8) MINIMAP, COMPASS & FAST-TRAVEL — a slightly bigger room with two named
  //    warp points the directory can fast-travel between; F7 toggles the
  //    compass/minimap.
  function buildMinimap() {
    // THE SKYLINE — a (small) two-story MULTIPLEX that teaches vertical traversal
    // (LADDER + STAIRCASE up, a signed JUMP-DOWN ledge) and the floor-aware MINIMAP
    // + DIRECTORY fast-travel, dressed as a real cinema: a concourse off which CLOSED
    // auditorium doors lead to numbered screens (neon SCREEN NUMBERS over each door,
    // era-correct MOVIE POSTERS on the walls between them). It's populated with NAMED
    // NPCs so the theatre feels alive.
    //   FLOOR 0 (ground 25x17): auditorium row 1-3 across the top behind closed doors,
    //     a concession + concourse with the kiosk, a right-back STAIRWELL (ladder +
    //     stairs up), and the entrance FOYER (start + greeter).
    //   FLOOR 1 (balcony, x16..23 z1..9): screens 4-5 behind closed doors, the
    //     projection BOOTH, and the signed JUMP-DOWN ledge back to the lobby.
    // HOW TO MODIFY: floor 0 uses B.obj/B.floor/B.edge; floor 1 uses the *F variants.
    // Keep the ladder/stairs at the SAME (x,z) on both floors. Auditorium doors are
    // door_swing edges with a neon-number + (sometimes) a poster attachment — see the
    // aud() helper. Posters name REAL films from the season the player chose at
    // chargen (May 1999 summer blockbusters / Nov 1999 winter releases).
    const W = 25, H = 17;
    const B = makeBlank(W, H, { floors: 2 });

    // Season-correct marquee. State.world.scenario is 'summer' | 'winter'.
    const summer = !(State.world && State.world.scenario === 'winter');
    const MOVIES = summer
      ? ['The Phantom Menace', 'The Mummy', 'The Matrix', 'Notting Hill', 'Entrapment']
      : ['Toy Story 2', 'The World Is Not Enough', 'Sleepy Hollow', 'Pokemon: The First Movie', 'End of Days'];
    const POSTER_C = ['#5b2333', '#1e3a5f', '#3f3a1e', '#4a2c5e', '#234e52'];
    // #L: the player's era-appropriate take on each film, shown as the poster
    // caption (facing) and the modal (G). Keyed by title so it tracks MOVIES.
    const MOVIE_TAKES = {
      'The Phantom Menace': 'Two hours in line and worth it... mostly. That pod race ruled. Jar Jar can walk into a sarlacc.',
      'The Mummy': 'Brendan Fraser doing the whole Indiana Jones thing. Cheesy as anything \u2014 I\u2019d watch it again tomorrow.',
      'The Matrix': 'Walked out not totally sure what\u2019s real anymore. That bullet-dodging shot is going to be everywhere.',
      'Notting Hill': 'My sister dragged me. ...Fine. It was charming. Tell nobody.',
      'Entrapment': 'Catherine Zeta-Jones and that laser-hallway bit. That\u2019s basically the whole trailer, but still.',
      'Toy Story 2': 'A whole movie made on computers \u2014 and it got me misty over a cowgirl doll. What is happening.',
      'The World Is Not Enough': 'Brosnan\u2019s a good Bond. That boat chase down the river is the part everybody\u2019ll be quoting.',
      'Sleepy Hollow': 'Burton and Depp doing headless-horseman gothic. Gorgeous and gross in about equal measure.',
      'Pokemon: The First Movie': 'Half the theater was ten-year-olds. ...I also have several thoughts about Mewtwo.',
      'End of Days': 'Schwarzenegger versus the literal Devil for Y2K. Exactly as ridiculous as that sounds.',
    };

    // a named NPC with stats + one line of dialogue, on either floor. Pass ai:'wave'
    // for a greeter that WAVES the player over until talked to (idleAnim:'wave').
    const npcAt = (flr, x, z, name, cloth, stats, dialogue, rot, ai, uniform) => {
      const wave = ai === 'wave';
      const put = flr === 0 ? B.obj : (xx, zz, v, c, s, meta) => B.objF(1, xx, zz, v, c, s, meta);
      // #8/#14: greeters WAVE then stand; uniformed STAFF hold their post (stand);
      // everyone else is a patron and WANDERS so the lobby feels alive. Pass ai
      // explicitly to override. uniform:true dresses them in the concession outfit.
      const mode = wave ? 'stand' : (ai || (uniform ? 'stand' : 'wander'));
      put(x, z, 'npc', '#ffccaa', '', {
        name, stats, dialogue, skin: '#ffccaa', cloth: cloth || '#2563eb',
        ai: mode, wanderChance: 0.02, rot: (rot == null ? 2 : rot), solid: true, reqFacing: false,
        uniform: uniform || undefined,
        idleAnim: wave ? 'wave' : undefined, waveUntilTalked: wave ? true : undefined,
      });
    };

    // #13: a theatre ENTRANCE guarded by an USHER. It's a normal swing door — trying
    // to open it swings the door OUT toward you, the usher steps into the doorway and
    // asks for a ticket you don't have, then it shuts again (handled in engine.js via
    // meta.usher). The now-playing POSTER sits on the wall just OUTSIDE, beside the
    // door. The auditoria themselves are gone: no enterable screen, so the old sealed
    // lock, fogged alcove and fake projector glow have all been removed. (flr 0/1.)
    const aud = (flr, x, z, num, withPoster) => {
      const edge = flr === 0 ? B.edge : (xx, zz, dr, v, c, m) => B.edgeF(1, xx, zz, dr, v, c, m);
      // the entrance door (north-facing). openOut hints the swing should face the
      // concourse (toward the player); meta.usher drives the ticket-check sequence.
      edge(x, z, 'n', 'door_swing', '#3a2c1e', {
        solid: true, dir: 0, openOut: true,
        usher: true, usherName: 'Usher',
        usherLines: [
          'Ticket for Screen ' + num + '? Let\u2019s see it\u2026',
          '\u2026You don\u2019t have one. Sorry, friend \u2014 no ticket, no entry. Box office is up front.',
        ],
        attachments: [{ v: 'neon_text', neonText: String(num), color: '#22d3ee', intensity: 1.4, offset: 0, offsetY: 0.55, topMount: true }],
      });
      // now-playing poster on the wall panel just OUTSIDE the entrance, beside the door.
      if (withPoster) {
        edge(x + 1, z, 'n', 'solid', '#2a2440', {
          solid: true,
          attachments: [{ v: 'poster', posterTitle: MOVIES[(num - 1) % MOVIES.length], posterVenue: 'THE SKYLINE', color: POSTER_C[(num - 1) % POSTER_C.length], offset: 0, offsetY: 0.1,
            interactMode: 'both', posterComment: MOVIE_TAKES[MOVIES[(num - 1) % MOVIES.length]] || ('Now showing: ' + MOVIES[(num - 1) % MOVIES.length] + '. Looks like a good time.') }],   // #L: caption when facing + your take on G
        });
      }
    };

    // ════════════════ FLOOR 0 — GROUND ════════════════
    B.fill('terrazzo', '#e9e6dc');
    B.perimeter('#1e3a5f');
    const tint = (x0, z0, x1, z1, v, c) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) B.floor(x, z, v, c); };

    // AUDITORIUM ROW (top): three shallow screen alcoves (z1..3) behind CLOSED doors on
    // the z=4 'n' wall. Dark sloped-cinema carpet inside.
    // #16: interior auditoriums removed — no carpeted alcove behind the doors.
    // interior wall between the alcoves (z<=3) and the concourse (z>=4), with 3 doors.
    for (let x = 1; x <= 14; x++) B.edge(x, 4, 'n', 'solid', '#46506e', { solid: true });
    aud(0, 2, 4, 1, true);    // Screen 1 + poster at x=3
    aud(0, 7, 4, 2, true);    // Screen 2 + poster at x=8
    aud(0, 12, 4, 3, true);   // Screen 3 + poster at x=13
    // #16: SCREEN signs removed with the auditorium interiors. The doors on the
    //      z=4 wall remain as impassable, dialogue-triggering walls — enough for a tutorial.

    // RIGHT-BACK STAIRWELL (x16..23, z1..6) — the LADDER + STAIRCASE up to the balcony.
    tint(16, 1, 23, 6, 'carpet', '#2a2440');
    B.obj(17, 1, 'sign', '#cbd5e1', 'BALCONY', { solid: true });
    B.obj(21, 2, 'ladder', '#b45309', 'LADDER', { solid: true });   // SOLID — face it + SPACE to climb
    B.obj(18, 2, 'stairs', '#8a7f6a', 'STAIRS', { solid: false, stairDir: 'n' });   // #7: single 1-wide, 2-LONG flight up to the balcony
    npcAt(0, 16, 5, TUT.hank, '#1e3a8a',
      { brawn: 6, reflexes: 6, grit: 6, intelligence: 5, savvy: 7, charm: 5, luck: 4 },
      'Balcony screens are up the stairs or the ladder. Mind the ledge up there \u2014 it\u2019s a long way down to the lobby.', 2, null, true);  // #14 usher uniform

    // CONCESSION (left of the concourse) + warp + worker
    tint(1, 6, 6, 8, 'tile', '#2f2a18');
    B.obj(3, 7, 'warp_point', '#f59e0b', '', { warpPointName: 'Concession', directoryFastTravel: true, isWarp: true });
    B.obj(2, 6, 'sign', '#cbd5e1', 'SNACKS', { solid: true });
    npcAt(0, 2, 8, TUT.marge, '#b91c1c',
      { brawn: 4, reflexes: 5, grit: 7, intelligence: 5, savvy: 8, charm: 6, luck: 5 },
      'Popcorn\u2019s fresh, hon. Buttered or no? ...Oh, you\u2019re just touring. The stairs to the balcony are in the back hall, right side.', 1, null, true);  // #14 concession uniform

    // #13: THE EAVESDROP SCENE — Jeff is teaching Ryan a register-skim scheme
    // behind the counter. If the player CROUCHES on the marked tile in front
    // (sneaking, so they don't clam up), they overhear the whole thing. Manager
    // Tony lurks a short way off, unable to get close enough himself.
    npcAt(0, 5, 6, 'Jeff', '#3f3f46',
      { brawn: 5, reflexes: 6, grit: 4, intelligence: 6, savvy: 8, charm: 5, luck: 7 },
      'Medium combo? \u2026Yeah. Comin\u2019 right up.', 2, 'stand', true);
    npcAt(0, 4, 6, 'Ryan', '#3f3f46',
      { brawn: 4, reflexes: 5, grit: 5, intelligence: 6, savvy: 5, charm: 6, luck: 4 },
      'Uh \u2014 hey. What can I get ya?', 2, 'stand', true);
    const _jeffSkim = [
      { who: 'Ryan', text: 'Run that by me one more time \u2014 how do you not get caught?' },
      { who: 'Jeff', text: 'No, it\u2019s easy! You take a penny and put it in the left-hand coin tray for every medium pop you sell\u2026' },
      { who: 'Jeff', text: '\u2026and then a dime in the tray for every medium popcorn you sell. Give \u2019em correct change for the single item, counting it out in your head. You don\u2019t even ring it up.' },
      { who: 'Ryan', text: 'Okay\u2026 so the tray just fills up with pennies and dimes.' },
      { who: 'Jeff', text: 'Right. Then later you ring up a medium COMBO for every pair \u2014 a dime and a penny \u2014 you\u2019ve got in the tray, and you pocket the difference.' },
      { who: 'Ryan', text: '\u2026Huh. That\u2019s either genius or a felony.' },
      { who: 'Jeff', text: 'Keep your voice down.' },
    ];
    B.obj(5, 7, 'eavesdrop', '#000000', '', { eavesdropScript: _jeffSkim });   // in front (concourse side)
    B.obj(5, 5, 'eavesdrop', '#000000', '', { eavesdropScript: _jeffSkim });   // #4: BEHIND Jeff (back-hall side) — so you can overhear from behind him too
    npcAt(0, 8, 8, 'Tony', '#334155',
      { brawn: 6, reflexes: 4, grit: 6, intelligence: 6, savvy: 5, charm: 5, luck: 4 },
      'I keep trying to drift close enough to catch whatever Jeff\u2019s always muttering about back there \u2014 but the second I get near, they straighten up and start counting change. I\u2019m just\u2026 not sneaky enough to manage it.', 3, 'stand', true);
    // #7: SAL the cashier runs the actual SHOP. Facing him + Space opens the
    // concession purchase modal (meta.shop). A register prop dresses the counter.
    B.obj(6, 6, 'npc', '#ffccaa', '', {
      name: 'Sal', skin: '#ffccaa', cloth: '#7a1f3a', ai: 'stand', rot: 2, solid: true, reqFacing: false,
      uniform: true, shop: true, shopTitle: 'The Skyline Concession',
      stats: { brawn: 4, reflexes: 6, grit: 6, intelligence: 5, savvy: 7, charm: 7, luck: 5 },
      dialogue: 'Step right up \u2014 popcorn, pop, candy. What\u2019ll it be?',
    });
    // (b) THE CONCESSION COUNTER: a solid counter run across the FRONT of the
    // stand (south edge of the workers' row), exactly like the box-office counter.
    // The workers (Jeff/Ryan/Sal) stand behind it at z=6; you order across it from
    // z=7. This replaces the old lone register box that floated in the walkway with
    // no counter around it (the "random blue block").
    for (let x = 3; x <= 6; x++) B.edge(x, 6, 's', 'counter', '#7a4a24', { solid: true, connects: true });   // spans the workers' row
    // #8: fully ENCIRCLE the concession island (workers' row, x=3-6 at z=6) with
    // counters — back edge + both ends — so it reads as an enclosed stand, not a
    // counter with open sides. (Front edge is the run above; you still order across
    // it from the south.) Crouching just OUTSIDE the ring — in front OR behind —
    // overhears Jeff (see the radius eavesdrop in engine.js).
    for (let x = 3; x <= 6; x++) B.edge(x, 6, 'n', 'counter', '#7a4a24', { solid: true, connects: true });   // back edge (behind the workers)
    B.edge(3, 6, 'w', 'counter', '#7a4a24', { solid: true, connects: true });   // left end
    B.edge(6, 6, 'e', 'counter', '#7a4a24', { solid: true, connects: true });   // right end (concourse side)
    // The register now sits ON the counter beside Sal (the cashier at 6,6).
    B.obj(3, 6, 'register', '#9aa3b2', 'REGISTER', { solid: true });   // left end of the counter (away from the concourse)

    // CONCOURSE / LOBBY (center) — directory kiosk + benches + warp + a patron
    tint(7, 6, 23, 10, 'marble', '#e7e9ee');
    B.obj(8, 9, 'warp_point', '#22d3ee', '', { warpPointName: 'Lobby', directoryFastTravel: true, isWarp: true });
    B.obj(12, 9, 'dir', '#9333ea', '', { solid: true });   // the directory kiosk
    B.obj(10, 9, 'bench', '#3b4252', '', {});
    B.obj(15, 9, 'bench', '#3b4252', '', {});
    npcAt(0, 18, 9, TUT.dewey, '#15803d',
      { brawn: 3, reflexes: 4, grit: 5, intelligence: 7, savvy: 6, charm: 7, luck: 9 },
      'Third time seeing it this week. The projectionist upstairs runs the reels a hair too bright, but don\u2019t tell ' + TUT.cal + ' I said so.', 2, 'wander');

    // FOYER (bottom) — start + greeter (kept close to the player start)
    tint(1, 12, 23, 15, 'terrazzo', '#dad6c8');
    B.obj(12, 14, 'start', '#f43f5e', '', {});
    // #7: the greeter who WANTS the player's attention stands just IN FRONT of the
    // start tile (one step north) and waves until talked to.
    npcAt(0, 12, 12, TUT.lou, '#2563eb',
      { brawn: 4, reflexes: 5, grit: 6, intelligence: 6, savvy: 7, charm: 8, luck: 6 },
      'Welcome to the Skyline! Screens 1\u20133 are off this concourse \u2014 the doors are closed between shows. The KIOSK fast-travels to any marked spot on either floor; to reach the BALCONY screens, take the STAIRCASE (walk on, you climb automatically) or face the LADDER and press SPACE. Up top, walk off the signed LEDGE to JUMP DOWN to the lobby. Press F7 for the minimap \u2014 [ and ] peek the other floor.', 0,
      'wave', true);  // #14 greeter uniform
    // a WANDERING patron drifting the concourse.
    npcAt(0, 6, 13, (window.NamePool ? window.NamePool.pick(State.character && State.character.name) : 'Pat'), '#7e22ce',
      { brawn: 5, reflexes: 5, grit: 5, intelligence: 5, savvy: 5, charm: 6, luck: 6 },
      'Just stretching my legs before the show starts. Big crowd tonight.', 2, 'wander');
    // #8: more WANDERING patrons so the lobby actually feels alive (these amble
    // around the open concourse/foyer; the engine keeps them out of walls/doors).
    npcAt(0, 20, 8, (window.NamePool ? window.NamePool.pick() : 'Gail'), '#0e7490',
      { brawn: 4, reflexes: 6, grit: 5, intelligence: 6, savvy: 6, charm: 5, luck: 5 },
      'Did you see the line for the new one? Wrapped clear around the block earlier.', 2, 'wander');
    npcAt(0, 9, 7, (window.NamePool ? window.NamePool.pick() : 'Marty'), '#4d7c0f',
      { brawn: 6, reflexes: 5, grit: 6, intelligence: 5, savvy: 5, charm: 5, luck: 6 },
      'I always get here early for the good seats. Habit from the drive-in days.', 2, 'wander');
    npcAt(0, 17, 13, (window.NamePool ? window.NamePool.pick() : 'Deb'), '#be185d',
      { brawn: 4, reflexes: 5, grit: 5, intelligence: 6, savvy: 7, charm: 7, luck: 5 },
      'Lost my ticket stub already. Hope they don\u2019t check on the way back from the restroom.', 2, 'wander');

    // ════════════════ FLOOR 1 — BALCONY (x16..23, z1..9) ════════════════
    const MX0 = 16, MX1 = 23, MZ0 = 1, MZ1 = 9;
    for (let z = MZ0; z <= MZ1; z++) for (let x = MX0; x <= MX1; x++) B.floorF(1, x, z, 'carpet', '#34304f');
    // railings around the edge — SOLID everywhere except a wide signed jump-down on
    // the SOUTH edge (z = MZ1) at x = 20..21.
    const JD_X0 = 20, JD_X1 = 21;
    for (let x = MX0; x <= MX1; x++) {
      B.edgeF(1, x, MZ0, 'n', 'solid', '#8a93ad', { solid: true });
      if (x >= JD_X0 && x <= JD_X1) {
        B.objF(1, x, MZ1, 'ledge', '#e6b422', '', { solid: false, ledgeDir: 's' });
      } else {
        B.edgeF(1, x, MZ1, 's', 'solid', '#8a93ad', { solid: true });
      }
    }
    for (let z = MZ0; z <= MZ1; z++) { B.edgeF(1, MX0, z, 'w', 'solid', '#8a93ad', { solid: true }); B.edgeF(1, MX1, z, 'e', 'solid', '#8a93ad', { solid: true }); }
    B.lightF(1, 18, 3, '#fff4d6'); B.lightF(1, 22, 7, '#fff4d6');

    // BALCONY auditorium doors (screens 4 & 5) on the north wall, with neon numbers + posters.
    aud(1, 16, 1, 4, true);   // Screen 4 + poster at x=17
    aud(1, 20, 1, 5, true);   // Screen 5 + poster at x=21

    // ladder + stairs TOPS (same x,z as floor 0)
    B.objF(1, 21, 2, 'ladder', '#b45309', 'DOWN', { solid: true });   // SOLID — face it + SPACE to climb
    B.objF(1, 18, 2, 'stairs', '#8a7f6a', 'DOWN', { solid: false, stairDir: 's', stairTop: true });   // #7: the LANDING atop the flight (no second staircase) — step on it to go DOWN
    // #17a: open the floor over the stairwell so you can SEE the flight below and
    // know this is where you step down. The flight's top step sits at this floor's
    // height and fills the opening, so standing here you're on the top stair.
    B.floorF(1, 18, 2, 'carpet', '#34304f', { floorHole: true });
    // jump-down signage right by the opening
    B.objF(1, 19, 9, 'sign', '#ff8a3f', 'JUMP DOWN', { solid: true });

    // upstairs warps + the projectionist (booth)
    B.objF(1, 22, 3, 'warp_point', '#a3e635', '', { warpPointName: 'Balcony', directoryFastTravel: true, isWarp: true });

    // ── #7c: PROJECTION BOOTH ────────────────────────────────────────────────
    // A long hallway on FLOOR 1 running WEST across the tops of Screens 1-3,
    // connected to the balcony at its east end. Dark-glass PORTS face the houses
    // and the projectionist works the reels up here. To lengthen it, widen
    // BX0..BX1; ports sit over each screen (x = 2, 7, 12).
    const BX0 = 1, BX1 = 15, BZ0 = 2, BZ1 = 3;
    for (let z = BZ0; z <= BZ1; z++) for (let x = BX0; x <= BX1; x++) B.floorF(1, x, z, 'carpet', '#26252e');
    // #7 option A: the PORT tiles (z3, over each screen) are SEE-THROUGH glass —
    // you stand on them and look straight DOWN into the fogged, flickering house
    // below (the floor-0 show-glow sits directly beneath each one). Walkable.
    [2, 7, 12].forEach(px => B.floorF(1, px, BZ1, 'tile', '#1b2740', { seeThrough: true, opacity: 0.26 }));
    for (let x = BX0; x <= BX1; x++) {
      B.edgeF(1, x, BZ0, 'n', 'solid', '#3a3f52', { solid: true });             // back wall
      // projection PORT panels over each screen (dark-glass look); seeing THROUGH
      // them down into the houses is the cross-floor line-of-sight item (#7d).
      const isPort = (x === 2 || x === 7 || x === 12);
      B.edgeF(1, x, BZ1, 's', 'solid', isPort ? '#16203a' : '#3a3f52', { solid: true });
    }
    for (let z = BZ0; z <= BZ1; z++) B.edgeF(1, BX0, z, 'w', 'solid', '#3a3f52', { solid: true });  // west cap
    // OPEN the balcony's west wall where the booth meets it (set SOLID in the
    // railing loop above) so you can walk booth <-> balcony.
    B.edgeF(1, 16, 2, 'w', 'arch', '#8a93ad', { solid: false });
    B.edgeF(1, 16, 3, 'w', 'arch', '#8a93ad', { solid: false });
    // PROJECTORS behind the ports (the 'arcade' cabinet stands in for a projector
    // body until a dedicated prop exists) + the booth sign + worklights.
    B.objF(1, 2, 2, 'arcade', '#1f2937', '', { solid: true });
    B.objF(1, 7, 2, 'arcade', '#1f2937', '', { solid: true });
    B.objF(1, 12, 2, 'arcade', '#1f2937', '', { solid: true });
    B.objF(1, 9, 2, 'sign', '#fbbf24', 'PROJECTION BOOTH', { solid: true });
    B.lightF(1, 4, 3, '#ffe9b0'); B.lightF(1, 11, 3, '#ffe9b0');
    // #7 (booth ports): a gentle, shifting COOL glow at each port reads as the
    // movie running in the dark house below — the projectionist's-eye flicker —
    // without a full cross-floor view. crossfade lerps between screen-light tones
    // at a calm speed (not a strobe). Edit strobeColors/flickerSpeed to taste.
    const portGlow = (spd) => ({ intensity: 0.5, distance: 5, castShadow: false, flicker: true, flickerMode: 'crossfade', flickerSpeed: spd, strobeColors: '#cfe4ff,#aa9fe0,#e8eaff,#9fc0f0,#d8e8ff' });
    B.lightF(1, 2, 3, '#cfe4ff', portGlow(2.5));
    B.lightF(1, 7, 3, '#cfe4ff', portGlow(2.9));
    B.lightF(1, 12, 3, '#cfe4ff', portGlow(3.3));
    // the BOOTH warp now lives in the actual booth hallway.
    B.objF(1, 9, 3, 'warp_point', '#f472b6', '', { warpPointName: 'Booth', directoryFastTravel: true, isWarp: true });
    // CAL the projectionist works the booth (moved up from the balcony corner).
    npcAt(1, 5, 2, TUT.cal, '#7c3aed',
      { brawn: 4, reflexes: 7, grit: 6, intelligence: 8, savvy: 7, charm: 4, luck: 5 },
      'Reel two\u2019s threaded for Screen 1. Through these ports I keep an eye on all three houses at once. Headed down? Mind the LEDGE on the balcony \u2014 or take the stairs.', 2, null, true);  // #14 booth uniform

    // Guidance on floor 0: arrow toward the stairs; reaching the kiosk reveals the exit.
    B.actionArrow(15, 8, 'n', 18, 3, '#8a7f6a');   // point toward the back stairwell
    B.exitDoor(2, { side: 's', signName: 'Exit', text: 'Toured the Skyline \u2014 both floors, stairs, ladder, a jump down, named folks, and the floor-aware minimap? Nice. Continuing...' });
    B.exitArrow(2, 13, 's', 2, 16, '#ff8a3f');

    return finish(B, 'tut_minimap', 12, 14, { startZoomDist: 9, minimapMode: 'toggle', compassMode: 'on' });
  }

  // The branching tree for the dialogue lesson. Options can carry
  // `requires:{stat,min}` and are HIDDEN when unmet (the debug-dialogue overlay
  // filters them via the tutorial-aware hook installed below). Actions prefixed
  // 'tut:' are handled by window.engineDebugAction's tutorial branch.
  const DIALOGUE_TREE = {
    root: 'start',
    nodes: {
      start: { text: 'Hi! Dialogues branch based on what you pick — and some options only appear if your stats or traits qualify. Try the choices below.', options: [
        { label: 'Ask how dialogue trees work', goto: 'how' },
        { label: 'Show me a trait-gated option', goto: 'gate_intro' },
        { label: '(done for now)', back: true },
      ]},
      how: { text: 'Each line gives you choices. Choices can jump to other lines, run effects, or end the talk. Authors build these in Saymaker; this one is hard-coded for the tutorial.', options: [
        { label: 'Got it — back', goto: 'start' },
      ]},
      gate_intro: { text: 'See the option that needs Charm 8? If your Charm is lower, it is HIDDEN. I can lend you a temporary +3 Charm so it appears…', options: [
        { label: 'Lend me +3 Charm', action: 'tut:buff:charm:3', goto: 'gate_charm' },
        { label: 'Back', goto: 'start' },
      ]},
      gate_charm: { text: 'With the buff active, the Charm option below should now show (look at the bright +3 by Charm in your panel).', options: [
        { label: '[Charm 8+] Charm your way backstage', requires: { stat: 'charm', min: 8 }, goto: 'charm_win' },
        { label: 'Drop the buff', action: 'tut:unbuff', goto: 'gate_intro' },
        { label: 'Back', goto: 'start' },
      ]},
      charm_win: { text: 'Smooth. High Charm opened a path others never see. Now let me show how stats also change your ODDS, not just visibility.', options: [
        { label: 'Show me odds with a Grit check', action: 'tut:buff:grit:3', goto: 'odds' },
        { label: 'Back', action: 'tut:unbuff', goto: 'start' },
      ]},
      odds: { text: 'Some options are always visible but ROLL against a stat — higher stat, better odds. With your temporary +3 Grit, try forcing the stuck door.', options: [
        { label: 'Force the stuck door (Grit check)', action: 'tut:check:grit', goto: 'odds_result' },
        { label: 'Drop the buff', action: 'tut:unbuff', goto: 'start' },
      ]},
      odds_result: { text: 'Whatever the result, higher stats shift the odds your way. That is the core of skill checks. That is the whole tour — nicely done!', options: [
        { label: 'Finish', action: 'tut:unbuff', back: true },
      ]},
    }
  };

  // Effective stat = base (+ tutorial buff if it targets this stat).
  function tutorialStat(k) {
    const c = State.character || {};
    let v = (c.stats && typeof c.stats[k] === 'number') ? c.stats[k] : 5;
    if (State._tutorialBuff && State._tutorialBuff.stat === k) v += State._tutorialBuff.amount;
    return v;
  }

  // The ordered lesson list. Add/remove/reorder freely. (The renderer already
  // shows the lesson title above the intro, so intros start with the guidance.)
  const TUTORIAL_LESSONS = [
    { key: 'movement', title: 'Getting to Work', blurb: 'Walk, zoom, turn the view, tilt, compass, first-person \u2014 then grab your key and unlock the doors.',
      buildMap: buildParkingLot,
      intro: ['You just pulled into the multiplex lot. W/A/S/D to walk; the camera follows.',
              'Scroll to zoom, Q/E turn the view, T tilts it, F7 the compass/map, V first-person.',
              'Your car is the blue one with the glint on its roof: stand next to it and press G',
              'to grab the key. Then cross the lot, through the glass doors, and unlock the',
              'theater doors up north (the ones under the EXIT sign).'],
      onEnter() {
        // #3: arm the "lights flicker on" for when you cross the glass doors into
        // the multiplex (z<=5 is past the z=6 entrance). Cleared in onExit.
        try { window.__flickerOnZ = 5; window.__flickerFired = false; } catch (e) {}
      },
      onExit() {
        try { window.__flickerOnZ = null; window.__flickerFired = false; if (window.engineSetLightLevel) window.engineSetLightLevel(1); } catch (e) {}
      } },
    { key: 'course', title: 'Moving Around the Theater: Vaulting, Switches & Sneaking', blurb: 'Vault a counter (skill check), flip a lightswitch, and sneak past staff using cover, crouch, and darkness.',   // #8: merged jump/switch + sneak into ONE map
      buildMap: buildCombinedStealth,
      intro: ['First VAULT the counter: face it and press Space — a Reflexes/Vault check,',
              'so you may clear it clean, scramble over, or get shoved back. Beyond it, the',
              'yellow VISION CONES show what the staff can see (invisible in the real game).',
              'Crouch (X), duck behind the cover counter, and flip the wall SWITCH to dim',
              'the room and shrink the cones. Slip past to the Exit, then type "next".'],
      onEnter() {
        State._sneakSpotHandler = function (npcMeta) {
          try { logEvent('Spotted by ' + (npcMeta && npcMeta.name ? npcMeta.name : 'staff') + ' — wait for their cone to look away, then move.'); } catch (e) {}
        };
        window.engineOnPlayerSpotted = State._sneakSpotHandler;
      },
      onExit() {
        window.engineOnPlayerSpotted = null; State._sneakSpotHandler = null;
        try { if (window.engineSetCrouch) window.engineSetCrouch(false); if (window.engineSetLightLevel) window.engineSetLightLevel(1); } catch (e) {}
      } },
    { key: 'windows', title: 'Drawing & Breaking Windows', blurb: 'Paint on a window, then smash it and watch the shards.',
      buildMap: buildWindows,
      intro: ['Face a window and press G to interact — drawable windows let you',
              'paint; breakable ones shatter (the first two break freely). Broken glass',
              'leaves shards on the floor that can cut you. Try it, then type "next".'] },
    { key: 'firstperson', title: 'First-Person & FPS Controls', blurb: 'Walk the corridor in first-person; tune the FPS control scheme in Settings.',
      buildMap: buildFirstPerson,
      intro: ['You start in FIRST-PERSON. Use W/A/S/D to move and look around;',
              'press V to pop back to the overhead view and V again to return.',
              'Prefer different first-person controls? Settings → FPS Controls switches',
              'between the "crawler" and "retro" schemes. Walk the hall, then type "next".'] },
    // #8: the standalone 'sneak' lesson is MERGED into the 'course' lesson above
    // (vaulting + switches + sneaking in one map). buildSneak() stays defined below.
    // #7: the standalone 'doors' (Doors, Locks & Keys) lesson is RETIRED — the
    // parking-lot arrival lesson now teaches keys + locked doors (grab the key
    // from your car, unlock the theater doors). buildDoors() stays defined below
    // in case you ever want it back.
    { key: 'minimap', title: 'The Skyline \u2014 Two Floors, Ladders & the Map', blurb: 'Tour a small two-story multiplex: climb a ladder/stairs to the balcony screens, jump down a ledge, peek floors on the minimap, and fast-travel.',
      buildMap: buildSunrise,   // #5: load the editable Sunrise map file
      intro: ['This theatre has TWO floors. Take the LADDER or the STAIRCASE in the',
              'top-right hall up to the mezzanine, then JUMP DOWN off the west LEDGE',
              'to drop back. Press F7 for the minimap (it redraws per floor; tap [ or ]',
              'to peek the other floor). The purple DIRECTORY kiosk fast-travels to',
              'warps on BOTH floors. Explore up and down, then type "next".'] },
    { key: 'dialogue', title: 'Dialogue & Trait-Gated Options', blurb: 'Branching talk; a temporary buff reveals a gated option and shifts odds.',
      buildMap: buildDialogue,
      intro: () => ['Walk up to ' + TUT.mae + ' and press Space to talk. Some choices are HIDDEN',
              'until your stats qualify — she will lend you a temporary buff to show how.',
              'When you are done, leave the talk and type "next" (or "done").'],
      onExit() { State._tutorialBuff = null; }   // safety: clear any leftover buff
    },
  ];

  // ════════════════════════════════════════════════════════════════════════
  //  THE RUNNER
  // ════════════════════════════════════════════════════════════════════════
  // State.tut = { seq:[keys], i:index, replay:bool, returnScreen, snapshot }
  // A lesson plays by loading its map into the existing map-view (DEBUG_ROOM_MAP
  // path), with the lesson's intro text and SKIP/NEXT/BACK commands.

  function snapshotCharacter() {
    try { return State.character ? JSON.parse(JSON.stringify(State.character)) : null; } catch (e) { return null; }
  }

  // Begin the full ordered tutorial (post-chargen). Offered via Screens.TUTORIAL_OFFER.
  function startFullTutorial(returnScreen, seq) {
    assignTutorialNames();   // unique pool names for every tutorial NPC, excluding the player's
    State.tut = {
      // explicit lesson order — movement first, then doors, then
      // dialogue, then the rest. currentLesson() looks lessons up by key, so the
      // TUTORIAL_LESSONS array can stay in its original definition order.
      seq: seq || ['course', 'windows', 'firstperson', 'minimap', 'dialogue'],   // #4/#8: the REST of the tutorials — the parking lot ('movement') plays FIRST, standalone. Current lesson keys (course = merged vault/switch/sneak; minimap = Sunrise).
      i: 0, replay: false,
      returnScreen: returnScreen || 'GAME_PLACEHOLDER',
      snapshot: snapshotCharacter(),
    };
    playCurrentLesson();
  }

  // #4: the PARKING-LOT arrival plays FIRST and STANDALONE — no tutorial prompt
  // before it. When you reach the theater doors, nextLesson() fades to the
  // TUTORIAL_OFFER choice (play the rest? / Bob scene) instead of finishing.
  function startParkingLot(returnScreen) {
    assignTutorialNames();
    State.tut = { seq: ['movement'], i: 0, replay: false, returnScreen: returnScreen || 'FIRST_SHIFT', parkingLotIntro: true, snapshot: snapshotCharacter() };
    playCurrentLesson();
  }

  // simple fade-to-black overlay, then run cb (no engine fade existed).
  function fadeThen(cb, ms) {
    ms = ms || 550;
    try {
      let ov = document.getElementById('tut-fade');
      if (!ov) { ov = document.createElement('div'); ov.id = 'tut-fade'; ov.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;z-index:9999;pointer-events:none;transition:opacity ' + ms + 'ms ease'; document.body.appendChild(ov); }
      requestAnimationFrame(() => { ov.style.opacity = '1'; });
      setTimeout(() => { try { cb(); } catch (e) {} requestAnimationFrame(() => { ov.style.opacity = '0'; }); }, ms);
    } catch (e) { cb(); }
  }

  // Replay ONE lesson from Help, without disturbing a game in progress.
  function replayLesson(key, returnScreen) {
    State.tut = {
      seq: [key], i: 0, replay: true,
      returnScreen: returnScreen || 'HELP_MECHANICS',
      restoreHelpTopic: 'tutorials',   // land back on the tutorial list in Help
      snapshot: snapshotCharacter(),
    };
    // Ensure SOME character exists so the avatar + stat panel render.
    if (!State.character || !State.character.name) {
      if (window.MultiplexChargen && window.MultiplexChargen.makeRandomCharacter) State.character = window.MultiplexChargen.makeRandomCharacter();
      State.tut._tempChar = true;
    }
    playCurrentLesson();
  }

  function currentLesson() {
    const t = State.tut; if (!t) return null;
    return TUTORIAL_LESSONS.find(l => l.key === t.seq[t.i]) || null;
  }

  function playCurrentLesson() {
    if (!TUT.mae) assignTutorialNames();   // safety: populate NPC names for any entry path (replay etc.)
    const lesson = currentLesson();
    if (!lesson) { finishTutorial(); return; }
    State._tutorialBuff = null;
    State.mapData  = lesson.buildMap();
    State.mapTitle = lesson.title;
    State.mapReturn = 'TUTORIAL_MAP';   // (back inside a lesson stays in the lesson)
    if (typeof sfx !== 'undefined') sfx.confirm();
    goto('TUTORIAL_MAP');
    // #3/#4: a previous lesson's unmount left #game-container display:none and
    // _mapMounted false; goto() to the SAME screen doesn't re-show it. Force the
    // container visible and (re)mount the new map's canvas over a few frames so
    // each subsequent lesson actually renders its map.
    try {
      document.body.classList.add('map-screen');
      const gc = document.getElementById('game-container');
      if (gc) gc.style.display = 'block';
      const remount = () => { try { if (typeof mountMapCanvas === 'function') mountMapCanvas(); if (typeof positionMapContainer === 'function') positionMapContainer(); if (window.engineResize) window.engineResize(); } catch (e) {} };
      requestAnimationFrame(remount); setTimeout(remount, 60); setTimeout(remount, 200);
    } catch (e) {}
    try { if (typeof lesson.onEnter === 'function') lesson.onEnter(); } catch (e) {}
    // reaching a lit Exit waypoint ASKS whether to move on (no auto-advance).
    // Wording is generic ("move on") because lessons are modular bits dropped
    // through the early game — there's no named "next tutorial".
    window.engineOnExitReached = function () {
      if (window.__tutExitPromptOpen) return;
      // #4: the parking-lot arrival skips the generic "move on?" prompt — crossing
      // the theater door goes straight to nextLesson (fade -> tutorial choice).
      // PORTFOLIO EDIT: getting to work (the parking lot) is part of the story, not a tutorial.
      // Once you're inside, a modal offers the tutorials; skipping it goes straight on.
      if (State.tut && State.tut.parkingLotIntro) {
        window.__tutExitPromptOpen = true;
        if (typeof window.__worldPaused !== 'undefined') window.__worldPaused = true;
        if (typeof sfx !== 'undefined' && sfx.confirm) sfx.confirm();
        showMoveOnPrompt(function (yes) {
          window.__tutExitPromptOpen = false;
          if (typeof window.__worldPaused !== 'undefined') window.__worldPaused = false;
          leaveParkingLot(yes);
        }, {
          title: 'Tutorials',
          html: '<div style="font-weight:bold;margin-bottom:8px;">You made it inside the Grande.</div>' +
                '<div style="text-align:left;margin-bottom:8px;">Want a quick hands-on tutorial before your shift? A handful of tiny rooms, each ' +
                'teaching one thing: vaulting, switches and sneaking; drawing on and breaking windows; first-person; ' +
                'two floors and the map; and how dialogue works.</div>' +
                '<div style="text-align:left;margin-bottom:14px;">You can replay any of them later from Help.</div>',
          yes: 'Start the tutorials', no: 'Skip', noEsc: true
        });
        return;
      }
      window.__tutExitPromptOpen = true;
      if (typeof window.__worldPaused !== 'undefined') window.__worldPaused = true;
      showMoveOnPrompt(function (yes) {
        window.__tutExitPromptOpen = false;
        if (typeof window.__worldPaused !== 'undefined') window.__worldPaused = false;
        if (yes) { if (typeof sfx !== 'undefined' && sfx.confirm) sfx.confirm(); nextLesson(); }
        else { if (typeof sfx !== 'undefined' && sfx.back) sfx.back(); }
      });
    };
  }

  // a tiny yes/no overlay. Built into #game-container (embedded) or body.
  function showMoveOnPrompt(cb, opts) {
    opts = opts || {};
    // (a modal with its own text, like the tutorials offer, covers the whole screen so it fits)
    const ovId = opts.html ? 'tut-offer' : 'tut-moveon';
    let ov = document.getElementById(ovId);
    if (!ov) {
      const host = opts.html ? document.body : (document.getElementById('game-container') || document.body);
      ov = document.createElement('div');
      ov.id = ovId;
      ov.style.cssText = 'position:' + (opts.html ? 'fixed' : 'absolute') + ';inset:0;z-index:' + (opts.html ? 9000 : 70) + ';display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);font:13px/1.4 "GrandeRetro","MS Sans Serif",Tahoma,sans-serif;color:#000;';
      host.appendChild(ov);
    }
    ov.innerHTML =
      '<div class="win95-win" style="min-width:240px;max-width:80%;">' +
      '<div class="win95-title"><span>' + (opts.title || 'Tutorial') + '</span></div>' +
      '<div class="win95-body" style="text-align:center;' + (opts.html ? 'max-width:620px;font-size:20px;line-height:1.45;' : '') + '">' +
      (opts.html || '<div style="margin-bottom:14px;">Ready to move on?</div>') +
      '<div style="display:flex;gap:10px;justify-content:center;">' +
      '<button data-yes class="win95-btn">' + (opts.yes || 'Yes') + '</button>' +
      '<button data-no class="win95-btn">' + (opts.no || 'Not yet') + '</button>' +
      '</div></div></div>';
    ov.style.display = 'flex';
    const done = (yes) => { ov.style.display = 'none'; document.removeEventListener('keydown', onKey, true); if (typeof cb === 'function') cb(yes); };
    // keyboard nav — ←/→/↑/↓ and Tab cycle the buttons (Shift+Tab
    // goes back), Enter/Space "click" the focused one. Yes starts focused, so a
    // plain Enter still means Yes. Y/N/Esc remain direct shortcuts.
    const btns = Array.from(ov.querySelectorAll('button'));
    const cycle = (dir) => { const i = btns.indexOf(document.activeElement); btns[(i < 0 ? 0 : (i + dir + btns.length) % btns.length)].focus(); };
    const onKey = (e) => {
      const k = e.key;
      if (k === 'y' || k === 'Y') { e.preventDefault(); e.stopPropagation(); done(true); return; }
      if (k === 'n' || k === 'N' || (k === 'Escape' && !opts.noEsc)) { e.preventDefault(); e.stopPropagation(); done(false); return; }
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); return; }   // (a choice that matters: no accidental Esc)
      if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); cycle(-1); return; }
      if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); cycle(+1); return; }
      if (k === 'Tab') { e.preventDefault(); e.stopPropagation(); cycle(e.shiftKey ? -1 : +1); return; }
      if (k === 'Enter' || k === ' ') {
        e.preventDefault(); e.stopPropagation();
        const a = document.activeElement;
        if (btns.includes(a)) a.click(); else done(true);
      }
    };
    ov.querySelector('[data-yes]').onclick = () => done(true);
    ov.querySelector('[data-no]').onclick = () => done(false);
    document.addEventListener('keydown', onKey, true);
    const first = ov.querySelector('[data-yes]'); if (first) first.focus();
  }

  // PORTFOLIO EDIT: leave the getting-to-work map; yes = start the tutorials, no = carry on.
  function leaveParkingLot(startTutorials) {
    const t = State.tut; if (!t) return;
    window.engineOnExitReached = null;
    const lesson = currentLesson();
    try { if (lesson && typeof lesson.onExit === 'function') lesson.onExit(); } catch (e) {}
    if (typeof unmountMapCanvas === 'function') unmountMapCanvas();
    const ret = t.returnScreen || 'FIRST_SHIFT';
    if (startTutorials) { fadeThen(() => startFullTutorial(ret), 550); return; }
    if (typeof sfx !== 'undefined' && sfx.back) sfx.back();
    State.tut = null;
    fadeThen(() => goto(ret), 550);
  }

  function nextLesson() {
    const lesson = currentLesson();
    try { if (lesson && typeof lesson.onExit === 'function') lesson.onExit(); } catch (e) {}
    if (typeof unmountMapCanvas === 'function') unmountMapCanvas();
    State.tut.i++;
    if (State.tut.i >= State.tut.seq.length) {
      if (State.tut.parkingLotIntro) {   // #4: hand off to the choice, don't finish
        State.tut.parkingLotIntro = false; State.tut.i = 0; State.tut.seq = [];
        fadeThen(() => goto('TUTORIAL_OFFER'), 550);
        return;
      }
      finishTutorial(); return;
    }
    playCurrentLesson();
  }

  function finishTutorial(skippedAll) {
    const t = State.tut; if (!t) { goto('GAME_PLACEHOLDER'); return; }
    window.engineOnExitReached = null;
    const lesson = currentLesson();
    try { if (lesson && typeof lesson.onExit === 'function') lesson.onExit(); } catch (e) {}
    if (typeof unmountMapCanvas === 'function') unmountMapCanvas();
    State._tutorialBuff = null;
    // Restore the pre-tutorial character (undo temp chars / any demo changes).
    if (t._tempChar) State.character = t.snapshot || null;
    else if (t.snapshot) State.character = t.snapshot;
    const ret = t.returnScreen;
    if (t.restoreHelpTopic) { try { State.buffers.helpTopic = t.restoreHelpTopic; } catch (e) {} }
    State.tut = null;
    if (typeof logEvent === 'function' && !t.replay) logEvent(skippedAll ? 'Skipped the tutorial.' : 'Finished the tutorial.');
    goto(ret || 'GAME_PLACEHOLDER');
  }

  // ── SCREENS ────────────────────────────────────────────────────────────────

  // DAY-1 "WAKE UP" scenario — the home / morning routine that runs
  // right after chargen and BEFORE the optional hands-on map lessons. It is a
  // TYPED-COMMAND scene (no cursor; the command prompt stays open because this
  // screen has no onKey): the player types look / get up / shower / eat / coffee /
  // exercise / dress / go. It teaches the two core life-sim systems by DOING them:
  //   • TIME  — every action advances the world clock (advanceTime); you watch the
  //             morning fill up.
  //   • RESTED — the top status bar; food, a shower and coffee raise it, effort and
  //             a long day lower it. We explain what it's for the first time it moves.
  // Coaching lines print in a distinct color (.tut-coach) so the tutorial voice is
  // visually separate from world description and your own echoed commands. When the
  // player heads out the door it hands off to Screens.TUTORIAL_OFFER (the map
  // lessons). Movement/camera keys are deliberately NOT taught here — those belong
  // to the map tutorials.
  // HOW TO MODIFY: add a verb to the `verbs` table in handle(); give it a minutes
  // cost + rested delta + a world line, and (optionally) a one-time coach() tip.
  function wakeInit() {
    // Day 1 starts early so the routine has somewhere to go; rested starts low
    // ("groggy") so the player can watch it climb as they get ready.
    State.world.hour = 6; State.world.minute = 35; State.world.rested = 58;
    const __home = (typeof homeProfile === 'function') ? homeProfile() : { name: 'Your Apartment', wake: [
      'Your alarm clock radio clicks over to 6:35 and a tinny polka fades in. Morning, Day 1.',
      'You\u2019re still under the covers. Your first shift at the Grande is this morning.'] };
    State._wake = {
      home: __home,
      log: [
        { c: 'world', s: __home.wake[0] },
        { c: 'world', s: __home.wake[1] },
        { c: 'tut-coach', s: '\u27e2 This is your home. Type commands to get your morning going. Start with  GET UP  \u2014 type  help  any time to see your options.' },
      ],
      done: { up: false, shower: false, eat: false, coffee: false, exercise: false, dress: false },
      taught: {},
    };
  }
  function restWord(v) { return v >= 80 ? 'sharp' : v >= 55 ? 'awake' : v >= 35 ? 'groggy' : 'dragging'; }

  Screens.WAKE_UP = {
    render() {
      // #2: render INSIDE the real game UI frame (renderGameplayUI) so the wake-up
      // scenario matches the rest of the game — the player's stats + the RESTED bar
      // show in the right panel, the time/location in the top bar, and the morning
      // narration (coaching in its own colour) fills the center. Typed commands work
      // because this screen has no onKey, so the command prompt stays open.
      if (State._wake == null) wakeInit();
      const w = State._wake;
      const gameText = [];
      gameText.push(span('title-text', 'WAKE UP') + span('stat-name', '  \u2014  Day 1, before your first shift'));
      gameText.push('');
      const recent = w.log.slice(-14);
      for (const e of recent) {
        gameText.push(span(e.c, e.s));   // wrapToFrameWidth keeps the colour while wrapping
        if (e.c === 'tut-coach' || e.c === 'world') gameText.push('');
      }
      gameText.push('');
      const left = [];
      if (!w.done.up) left.push('get up');
      else {
        if (!w.done.shower) left.push('shower');
        if (!w.done.eat) left.push('eat');
        if (!w.done.coffee) left.push('coffee');
        if (!w.done.exercise) left.push('exercise');
        if (!w.done.dress) left.push('dress');
        left.push('go');
      }
      // #6: the available commands are now their OWN auto-scrolling bar pinned to
      // the bottom of the scene frame (the command ticker), not an inline line of
      // narration — so the morning text reads cleanly and the verbs always sit in
      // one place. 'look' / 'help' stay available (shown as a quiet tail).
      try { if (window.setSceneWords) window.setSceneWords(left.concat(['look', 'help'])); } catch (e) {}
      const _homeName = (State._wake && State._wake.home && State._wake.home.name) || (typeof homeProfile === 'function' ? homeProfile().name : 'Your Place');
      return renderGameplayUI({ gameText, overrideLocation: _homeName, npc: null, mapMode: false, noMinimap: true });
    },

    handle(text) {
      if (State._wake == null) wakeInit();
      const w = State._wake;
      const raw = (text || '').trim();
      const t = raw.toLowerCase();
      const say = (c, s) => w.log.push({ c, s });
      const coach = (key, s) => { if (!w.taught[key]) { w.taught[key] = true; say('tut-coach', s); } };
      const echo = () => say('you', '> ' + raw);
      const rerender = () => render();

      // help / look first (work any time)
      if (t === 'help' || t === 'commands' || t === '?' || t === 'h') {
        echo();
        say('sys', w.done.up
          ? 'Commands: look \u00b7 shower \u00b7 eat \u00b7 coffee \u00b7 exercise \u00b7 dress \u00b7 time \u00b7 go'
          : 'Commands: get up \u00b7 look \u00b7 time \u00b7 help. (You\u2019re still in bed \u2014 GET UP first.)');
        sfx.type(); rerender(); return;
      }
      if (t === 'look' || t === 'l' || t === 'look around') {
        echo();
        say('world', w.done.up
          ? 'A small room: unmade bed, a place to wash up, a coffee maker, and your Grande uniform on a hook. The way out is past the bed.'
          : 'From where you are you can see the rest of the room and a sliver of grey morning sky. Best get up.');
        sfx.type(); rerender(); return;
      }
      if (t === 'time' || t === 'status' || t === 'clock') {
        echo();
        say('sys', 'It\u2019s ' + formatTime() + ' on ' + formatDate() + '. Rested ' + State.world.rested + '/100 (' + restWord(State.world.rested) + ').');
        coach('rested', '\u27e2 RESTED is how sharp you feel. When it\u2019s low, everyday tasks and skill checks go worse; food, coffee and sleep bring it back up. Effort and a long day wear it down.');
        sfx.type(); rerender(); return;
      }

      // get up gate
      if (!w.done.up) {
        if (t === 'get up' || t === 'getup' || t === 'wake' || t === 'wake up' || t === 'stand' || t === 'stand up' || t === 'get out of bed' || t === 'rise' || t === 'up') {
          echo(); w.done.up = true; advanceTime(5);
          if (typeof logEvent === 'function') logEvent('Got up and started the morning.');
          say('world', 'You swing your legs out, stretch, and shuffle into the cold morning. The floorboards creak.');
          coach('time', '\u27e2 Notice the CLOCK moved to ' + formatTime() + '. Every action costs TIME \u2014 it\u2019s how your day fills up, so choose what matters before your shift.');
          coach('rested', '\u27e2 The bar up top is RESTED \u2014 how sharp you feel. Right now you\u2019re ' + restWord(State.world.rested) + '. A wash, a bite and some coffee will wake you up; you\u2019ve got time before work.');
          sfx.confirm(); rerender(); return;
        }
        echo(); say('sys', 'You\u2019re still in bed. Try  GET UP  first. (type  help )'); sfx.error(); rerender(); return;
      }

      // post-up verbs: { minutes, rested, world line, doneKey, alreadyMsg }
      const verbs = {
        shower:   { keys: ['shower', 'wash', 'take a shower', 'bathe'], min: 20, rest: +12, done: 'shower', log: 'Showered', world: 'You shower. The hot water and a towel scrub the sleep off you \u2014 much sharper now.', already: 'You\u2019re already clean.' },
        eat:      { keys: ['eat', 'breakfast', 'eat breakfast', 'food', 'cereal'], min: 25, rest: +8, done: 'eat', log: 'Ate breakfast', world: 'You put away a bowl of cereal and some toast standing at the counter. Your stomach settles.', already: 'You\u2019ve already eaten.' },
        coffee:   { keys: ['coffee', 'make coffee', 'brew coffee', 'caffeine'], min: 10, rest: +10, done: 'coffee', log: 'Had coffee', world: 'The percolator gurgles; you drink a mug black at the window. The fog in your head lifts.', already: 'You\u2019ve had your coffee \u2014 any more and you\u2019ll be jittery.' },
        exercise: { keys: ['exercise', 'workout', 'work out', 'stretch', 'jog', 'run', 'pushups', 'push-ups'], min: 30, rest: -6, stamina: -12, done: 'exercise', log: 'Exercised', world: 'You knock out some push-ups and jog in place by the radiator. Tiring this early \u2014 but it\u2019s good for you.', already: 'You\u2019ve already gotten your blood moving.' },
        dress:    { keys: ['dress', 'get dressed', 'dress up', 'uniform', 'clothes', 'wear uniform'], min: 5, rest: 0, done: 'dress', log: 'Put on the Grande uniform', world: 'You pull on the Grande uniform \u2014 maroon polo, name tag, black slacks. Showtime.', already: 'You\u2019re already in your uniform.' },
      };
      for (const name in verbs) {
        const v = verbs[name];
        if (v.keys.indexOf(t) >= 0) {
          echo();
          if (w.done[v.done]) { say('sys', v.already); sfx.error(); rerender(); return; }
          w.done[v.done] = true; advanceTime(v.min); if (v.rest) adjustRested(v.rest); if (v.stamina && typeof adjustStamina === 'function') adjustStamina(v.stamina);
          if (typeof logEvent === 'function' && v.log) logEvent(v.log + (v.rest ? '  (' + (v.rest > 0 ? '+' : '') + v.rest + ' rested' + (v.stamina ? ', ' + v.stamina + ' SP' : '') + ')' : (v.stamina ? '  (' + v.stamina + ' SP)' : '')));
          say('world', v.world);
          if (v.rest > 0) coach('restup', '\u27e2 RESTED climbed \u2014 good food, a wash and coffee all restore it. It\u2019s now ' + State.world.rested + '/100.');
          if (name === 'exercise') coach('restdown', '\u27e2 That cost STAMINA (SP) and dipped RESTED \u2014 effort tires you in the moment, but a fitter character holds up better across a long day. Trade-offs like this are the whole game.');
          sfx.confirm(); rerender(); return;
        }
      }

      // leave / finish
      if (t === 'go' || t === 'leave' || t === 'out' || t === 'head out' || t === 'work' || t === 'go to work' || t === 'door' || t === 'open door' || t === 'exit' || t === 'theatre' || t === 'theater') {
        echo();
        if (!w.done.dress) { say('sys', 'You can\u2019t head to your first shift in pajamas \u2014 try  GET DRESSED  first.'); sfx.error(); rerender(); return; }
        if (typeof logEvent === 'function') logEvent('Left home for the first shift at the Grande.');
        say('world', 'You grab your keys, lock up, and step out into the morning. The Grande\u2019s marquee is a few blocks away.');
        say('tut-coach', '\u27e2 That\u2019s the heart of it: spend TIME, manage RESTED, weigh trade-offs. Next: getting to work. Once you\u2019re inside, you can take a few tiny hands-on tutorial rooms, or skip them.');
        State._wake = null;
        try { if (window.setSceneWords) window.setSceneWords([]); } catch (e) {}   // #6: clear the wake-up command bar on handoff
        sfx.confirm();
        startParkingLot('FIRST_SHIFT');   // #4: parking lot FIRST, standalone (the tutorial choice comes AFTER it)
        return;
      }

      // unknown
      echo();
      say('sys', 'You\u2019re not sure how to "' + raw + '" right now. Type  help  for what you can do here.');
      sfx.error(); rerender();
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // #20/#21: FIRST_SHIFT — the post-tutorial "you're inside, about to start
  // working" scene. The tutorials end with you coming in off the approach; this
  // sets the mood (arcade glow, concession lights, someone in the back) and
  // varies by ARRIVAL TIME (State.world.hour):
  //   • before 9:00a  → you're SO early nobody else is here (concession dark)
  //   • ~9–10a        → the expected window: the place is waking up around you
  //   • 10:00a or after → you're LATE; Bob is here and not thrilled (week one!)
  // It deliberately STOPS at the threshold of the first real conversation.
  // HOW TO MODIFY: the three buckets are picked in render(); edit the per-bucket
  // pushes. The 10:15 rom-com comes from romComForScenario().
  // ════════════════════════════════════════════════════════════════════════
  function romComForScenario() {
    // a real 1999 rom-com on the late-morning screen, chosen by season.
    // Keyed off the scenario actually being played. (It used to test
    // character.scenarioChoice, which chargen sets to 'campaign', so summer
    // always got Runaway Bride, which didn't open until Jul 30, 1999.)
    const scen = (State.world && State.world.scenario) || (State.character && State.character.scenarioChoice) || 'summer';
    const summer = !/winter/i.test(scen);
    return summer
      ? { title: 'Notting Hill', take: 'the one where Hugh Grant stammers at Julia Roberts for two hours. You\u2019ve gathered it\u2019s \u201cpleasant.\u201d Everyone says \u201cpleasant.\u201d That appears to be the whole review.' }
      : { title: 'Runaway Bride', take: 'Julia Roberts keeps leaving men at the altar; Richard Gere writes it up. You suspect you could summarize the entire thing from the poster \u2014 and be right.' };
  }
  Screens.FIRST_SHIFT = {
    render() {
      const h = (State.world && typeof State.world.hour === 'number') ? State.world.hour : 9;
      const bucket = (h >= 10) ? 'late' : (h < 9) ? 'early' : 'ontime';
      const rc = romComForScenario();
      const T = [];
      // W()/C() take one or more parts: a plain string is drawn in the line's
      // own colour; a [cls, text] pair is drawn as its own SIBLING span (e.g. an
      // accent word mid-sentence). Never pass span() output in — span() escapes
      // its text, and nested spans corrupt the terminal (see CLAUDE.md).
      const parts = (cls, ps) => ps.map(p => Array.isArray(p) ? span(p[0], p[1]) : span(cls, p)).join('');
      const W = (...ps) => T.push(parts('world', ps));
      const C = (...ps) => T.push(parts('tut-coach', ps));
      T.push(span('title-text', 'THE GRANDE') + span('stat-name', '  \u2014  your first full shift'));
      T.push('');

      // ── arrival framing, by time ──
      if (bucket === 'early') {
        W('You let yourself in. It\u2019s far too early \u2014 the kind of early where the building still feels asleep. Nobody else has shown up yet. The lobby is entirely yours.');
      } else if (bucket === 'late') {
        W('You shoulder in through the front doors a touch breathless. The clock over concession is, frankly, not on your side this morning.');
      } else {
        W('You step in out of the morning and the doors sigh shut behind you. The Grande is just starting to stir \u2014 those last quiet minutes before a house opens.');
      }
      T.push('');

      // ── the arcade nook (always; it\u2019s on its own clock) ──
      W('To your right, sealed in its own glass room, the little arcade is awake before anyone else: a cabinet runs its attract loop to no one \u2014 ', ['accent', 'boop \u00b7 boop \u00b7 beep \u00b7 bl\u2014 bleep'], ' \u2014 a descending little phrase of electronic nonsense, a pause, then again.');
      T.push('');

      // ── concession + the back room ──
      if (bucket === 'early') {
        W('The concession stand is dark. No warmers ticking, no lights, no one behind it \u2014 just you, the carpet, and the ghost of last night\u2019s popcorn.');
      } else {
        W('Ahead, the concession lights are already on, laying warm amber across the empty counter. From the back room behind it you can hear someone moving \u2014 a box set down, a tap running. You\u2019re not alone in here.');
      }
      T.push('');

      // ── the 10:15 couple outside ──
      if (bucket === 'early') {
        W('Out past the glass the sidewalk is empty. Nobody\u2019s queuing for anything; the first show is hours off.');
      } else if (bucket === 'late') {
        W('Out front a college-aged couple is already waiting \u2014 pointedly \u2014 for the ', ['accent', '10:15'], ' showing of ', ['accent', rc.title], '. Your opinion of it is vague and perfectly neutral: ' + rc.take);
      } else {
        W('Through the front glass a college-aged couple drifts up early, almost certainly here for the ', ['accent', '10:15 ' + rc.title], '. You hold a vague, neutral opinion of that one: ' + rc.take);
      }
      T.push('');

      // ── lead-in to the FIRST conversation ──
      if (bucket === 'late') {
        W(['accent', 'Bob'], ' is planted by the podium, arms crossed, watching you come across the lobby. \u201cMorning,\u201d he says, in the tone of a man who\u2019s been here a while. \u201cWeek one, and we\u2019re already testing the definition of \u2018on time.\u2019\u201d');
        T.push('');
        C('[ Bob wants a word. This is where your first conversation \u2014 and the next round of tutorials \u2014 begins. ', ['warn', 'More coming soon.'], ' ]');
      } else if (bucket === 'early') {
        C('[ You\u2019re early enough that the day hasn\u2019t really started. Whoever opens up will be along soon \u2014 and that\u2019s where the first conversation, and the next tutorials, pick up. ', ['warn', 'More coming soon.'], ' ]');
      } else {
        C('[ Whoever\u2019s in the back room is about to step out and find you. That\u2019s where your first conversation \u2014 and the next round of tutorials \u2014 begins. ', ['warn', 'More coming soon.'], ' ]');
      }

      try { if (window.setSceneWords) window.setSceneWords(['look', 'wait', 'help']); } catch (e) {}
      return renderGameplayUI({ gameText: T, overrideLocation: 'The Grande \u2014 Lobby', npc: null, mapMode: false, noMinimap: true });
    },
    handle(text) {
      const t = (text || '').toLowerCase().trim();
      if (t === 'look' || t === 'l') { sfx.type(); render(); return; }
      if (t === 'help' || t === '?') { flash('First shift. Try:  look \u00b7 wait.'); return; }
      if (t === 'wait' || t === 'clock in' || t === 'start' || t === 'work' || t === 'go' || t === 'continue') {
        sfx.select();
        flash('\u2014 To be continued: the first conversation + the next tutorials arrive in a later build. \u2014');
        return;
      }
      sfx.error(); flash('Not yet. For now:  look \u00b7 wait.');
    }
  };

  Screens.TUTORIAL_OFFER = {
    // cursor/click/arrow driven (was typed-only) so the whole post-
    // chargen flow is keyboard-navigable. ←/→ or ↑/↓ pick, Enter confirms, or click.
    _acts: [{ act: 'yes', label: 'YES \u2014 play the tutorial' }, { act: 'skip', label: 'SKIP \u2014 straight to the game' }],
    render() {
      if (State._offerCur == null) State._offerCur = 0;
      State._offerCur = Math.max(0, Math.min(this._acts.length - 1, State._offerCur));
      const btns = this._acts.map((b, i) => {
        const foc = i === State._offerCur;
        return '<span class="cg-btn cg-act' + (foc ? ' cg-row-focus' : '') + '" data-cg="' + b.act + '">' + (foc ? '\u25b8' : ' ') + '[ ' + b.label + ' ]</span>';
      });
      return header('WELCOME TO THE GRANDE') + '\n' + [
        '',
        '   Want a quick hands-on tutorial? It is a handful of tiny rooms that',
        '   each teach one thing \u2014 moving & the camera, jumping & switches,',
        '   breaking windows, and how dialogue works.',
        '',
        '   You can press \u201cnext\u201d to skip any single room during it, or skip the',
        '   whole thing and jump straight into the game. You can always replay',
        '   any of these later from ' + span('accent', 'Help') + '.',
        '',
        '   ' + btns[0],
        '   ' + btns[1],
        '',
        '   ' + span('stat-name', '\u2191\u2193 / \u2190\u2192 choose \u00b7 Enter confirms \u00b7 or click'),
      ].join('\n');
    },
    onKey(e) {
      if (State._offerCur == null) State._offerCur = 0;
      const n = this._acts.length;
      const k = e.key;
      if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'w' || k === 'a') { State._offerCur = (State._offerCur - 1 + n) % n; sfx.type(); render(); return true; }
      if (k === 'ArrowDown' || k === 'ArrowRight' || k === 's' || k === 'd') { State._offerCur = (State._offerCur + 1) % n; sfx.type(); render(); return true; }
      if (k === 'Enter' || k === ' ') { this.onClick(this._acts[State._offerCur].act); return true; }
      return false;
    },
    onClick(action) {
      if (action === 'yes') { State._offerCur = 0; sfx.confirm(); const ret = State.tut && State.tut.returnScreen; startFullTutorial(ret); return; }   // map lessons directly (the old UI_PRIMER is replaced by WAKE_UP)
      if (action === 'skip') {
        sfx.back();
        const ret = (State.tut && State.tut.returnScreen) || 'GAME_PLACEHOLDER';
        State.tut = null; State._offerCur = 0;
        goto(ret);
        return;
      }
    },
    handle(text) {
      const t = (text || '').trim().toLowerCase();
      if (t === 'yes' || t === 'y' || t === 'ok' || t === '') { this.onClick('yes'); return; }
      if (t === 'skip' || t === 'no' || t === 'n') { this.onClick('skip'); return; }
      sfx.error(); flash('\u2191\u2193 choose, Enter confirms, or click.');
    }
  };

  // The lesson map screen. It's a MAP_SCREEN (the live engine canvas mounts
  // here), with lesson-specific intro text + skip/next/back commands.
  Screens.TUTORIAL_MAP = {
    render() {
      const lesson = currentLesson();
      const t = State.tut || {};
      const _intro = lesson && lesson.intro; const lines = _intro ? (typeof _intro === 'function' ? _intro() : _intro).slice() : ['Tutorial'];
      const stepInfo = (t.seq && t.seq.length > 1) ? ('  (' + (t.i + 1) + '/' + t.seq.length + ')') : '';
      const desc = [
        span('accent', (lesson ? lesson.title : 'Tutorial') + stepInfo),
        '',
        ...lines,
        '',
        t.parkingLotIntro ? '' :   // PORTFOLIO EDIT: getting to work isn't a tutorial, so it can't be skipped
        span('accent', '[ next ]') + ' continue   ·   ' +
          (t.replay ? '' : span('accent', '[ skip ]') + ' skip all tutorials   ·   ') +
          span('accent', '[ back ]') + (t.replay ? ' leave' : ' previous'),
      ];
      // The canvas is mounted by playCurrentLesson() (and re-fit there), so we
      // do NOT remount on every render — that fought with focus re-renders and
      // could flicker. We only ensure it's mounted if somehow it isn't.
      requestAnimationFrame(() => { if (typeof mountMapCanvas === 'function' && !document.querySelector('#game-container canvas')) mountMapCanvas(); });
      return renderGameplayUI({
        mapMode: true,
        npc: State.focusNpc || null,
        gameText: desc,
        overrideLocation: lesson ? lesson.title : 'Tutorial',
      });
    },
    handle(text) {
      const t = (text || '').trim().toLowerCase();
      const tut = State.tut || {};
      if (tut.parkingLotIntro) {   // PORTFOLIO EDIT: no next / skip / back on the way in to work
        if (t.startsWith('warp')) { const n = parseInt(t.replace(/^warp\s*/, ''), 10); if (!isNaN(n) && window.engineFastTravel) { window.engineFastTravel(n); return; } }
        sfx.error(); flash('Grab your key from your car, then head inside through the theater doors.'); return;
      }
      if (t === 'next' || t === 'n' || t === 'continue' || t === 'done') {  // (removed t==='' — a stray Enter no longer skips the lesson)
        sfx.confirm(); nextLesson(); return;
      }
      if (!tut.replay && (t === 'skip' || t === 'skipall')) {
        sfx.back(); finishTutorial(true); return;
      }
      if (t === 'back' || t === 'b') {
        if (tut.replay) { // single-lesson replay: leave back to Help
          const lesson = currentLesson();
          try { if (lesson && typeof lesson.onExit === 'function') lesson.onExit(); } catch (e) {}
          if (typeof unmountMapCanvas === 'function') unmountMapCanvas();
          State._tutorialBuff = null;
          if (tut._tempChar) State.character = tut.snapshot || null;
          const ret = tut.returnScreen || 'HELP_MECHANICS';
          if (tut.restoreHelpTopic) { try { State.buffers.helpTopic = tut.restoreHelpTopic; } catch (e) {} }
          State.tut = null; sfx.back(); goto(ret); return;
        }
        // full run: go to previous lesson (or re-offer if at the first)
        if (tut.i > 0) { if (typeof unmountMapCanvas === 'function') unmountMapCanvas(); tut.i--; sfx.back(); playCurrentLesson(); return; }
        sfx.error(); flash('This is the first lesson — type "next" or "skip".'); return;
      }
      // "warp" passthrough for testing.
      if (t.startsWith('warp')) { const n = parseInt(t.replace(/^warp\s*/, ''), 10); if (!isNaN(n) && window.engineFastTravel) { window.engineFastTravel(n); return; } }
      flash('Type "next", "back"' + (tut.replay ? '' : ', or "skip"') + '.');
    }
  };

  // ── TUTORIAL-AWARE DIALOGUE FILTER + ACTIONS ────────────────────────────────
  // The debug-dialogue overlay (core/debugroom.js) renders option lists. We wrap
  // it so options carrying `requires:{stat,min}` are HIDDEN when the player's
  // (buffed) stat is below min — this is what makes the gated option appear only
  // while the temporary buff is active. We also handle the 'tut:' actions.
  function install() {
    // Filter: expose a hook the overlay calls to decide if an option shows.
    window.__tutorialOptionVisible = function (opt) {
      if (!opt || !opt.requires) return true;
      const need = opt.requires;
      if (need.stat) return tutorialStat(need.stat) >= (need.min || 0);
      return true;
    };
    // Extend engineDebugAction for 'tut:' actions (buff / unbuff / check).
    const prevAction = window.engineDebugAction;
    window.engineDebugAction = function (action, label) {
      const a = String(action || '');
      if (a.startsWith('tut:')) {
        const parts = a.split(':');   // tut:buff:charm:3  | tut:unbuff | tut:check:grit
        if (parts[1] === 'buff') {
          State._tutorialBuff = { stat: parts[2], amount: parseInt(parts[3], 10) || 3 };
          if (typeof sfx !== 'undefined') sfx.confirm();
          if (typeof render === 'function') render();   // refresh stat panel (+N) + the dialogue (re-filter)
          return;
        }
        if (parts[1] === 'unbuff') {
          State._tutorialBuff = null;
          if (typeof sfx !== 'undefined') sfx.back();
          if (typeof render === 'function') render();
          return;
        }
        if (parts[1] === 'check') {
          const stat = parts[2];
          const val = tutorialStat(stat);
          const roll = 1 + Math.floor(Math.random() * 6);
          const ok = (val + roll) >= 11;   // simple demo threshold
          const msg = 'Rolled ' + roll + ' + ' + stat + ' ' + val + ' = ' + (val + roll) + ' → ' + (ok ? 'SUCCESS' : 'just missed') + '.';
          // on a map screen the roll belongs in the LOG, not the below-frame
          // flash line. logEvent feeds the LOG overlay; fall back to flash off-map.
          if (typeof logEvent === 'function' && typeof MAP_SCREENS !== 'undefined' && MAP_SCREENS.has(State.screen)) logEvent(msg);
          else if (typeof flash === 'function') flash(msg);
          if (typeof sfx !== 'undefined') (ok ? sfx.confirm() : sfx.error)();
          return;
        }
        return;
      }
      if (typeof prevAction === 'function') return prevAction(action, label);
    };
  }

  // Expose the public API for the host (chargen → offer; Help → replay).
  window.MultiplexTutorial = {
    offerAfterChargen(returnScreen) {
      // post-chargen flow is now  WAKE_UP (Day-1 morning routine)  ->
      // TUTORIAL_OFFER (optional map lessons) -> game. Stash the return target so
      // both screens can read it.
      State.tut = { returnScreen: returnScreen || 'GAME_PLACEHOLDER' };
      State._wake = null;
      goto('WAKE_UP');
    },
    startFullTutorial,
    replayLesson,
    lessons: TUTORIAL_LESSONS.map(l => ({ key: l.key, title: l.title, blurb: l.blurb })),
  };

  install();
})();
