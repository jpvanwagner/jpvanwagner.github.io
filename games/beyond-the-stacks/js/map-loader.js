/* JS/MAP-LOADER.JS - Reads the library layout from a Mapster map and turns it into the
   game's facility model.

   Where the map comes from (first one that works):
     1. maps/library.html, fetched live (works on a web server, e.g. Neocities or
        `python3 -m http.server`), so saving over that file in Mapster updates the game.
     2. js/library-map.js, the bundled copy (works when index.html is opened from disk).
        Regenerate it after editing the map: `python3 tools/sync-map.py`.
     3. Any Mapster .html picked with "Load a Mapster map..." in the game's Settings.

   What the game takes from the map (see MAP_FORMAT.md in the Mapster repo):
     - every floor in buildData.map becomes a floor tab; the floor with the Player Start
       is 1F, the ones under it are basements
     - zones (cell.zone + settings.zoneDefs) become rooms; js/data.js ROOM_RULES adds capacity etc.
     - walls, doors, glass, counters on tile edges decide where patrons can walk and how far
       noise travels; a locked door or counter door is staff-only
     - benches and sit-down arcade stations are seats; Player Start and Warp Points are where
       patrons arrive; NPCs are staff; stairs/ladders at the same spot on two floors connect them */

window.LibraryMap = (function () {

  // ---------------------------------------------------------------- reading map files
  function parseMapHtml(text) {
    let tag = "id='map-data'>", i = text.indexOf(tag);
    if (i === -1) { tag = 'id="map-data">'; i = text.indexOf(tag); }
    if (i === -1) throw new Error('No Mapster map data found in that file.');
    const start = i + tag.length;
    const end = text.indexOf('</' + 'script>', start);
    const data = JSON.parse(text.substring(start, end).trim().replace(/\\u003c/g, '<'));
    if (!data || !Array.isArray(data.map) || !data.map.length) throw new Error('The map data is empty.');
    return data;
  }

  function loadDefault() {
    const bundled = () => {
      if (window.LIBRARY_MAP_DATA) return { data: window.LIBRARY_MAP_DATA, source: 'bundled copy (js/library-map.js)' };
      throw new Error('No library map found. Is js/library-map.js missing?');
    };
    if (!/^https?:/.test(location.protocol)) return Promise.resolve(bundled());
    return fetch('maps/library.html', { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(t => ({ data: parseMapHtml(t), source: 'maps/library.html' }))
      .catch(() => bundled());
  }

  function loadFile(file) {
    return file.text().then(t => ({ data: parseMapHtml(t), source: file.name }));
  }

  // ---------------------------------------------------------------- edges
  const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
  const STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

  // Classify one wall element. Order matters in edgeKind(): permissive kinds win.
  function kindOf(el) {
    if (!el) return null;
    const v = el.v || '';
    if (v === 'arch') return 'arch';
    if (v === 'door_swing' || v === 'door_slide' || v.startsWith('door')) return (el.meta && el.meta.locked) ? 'staffdoor' : 'door';
    if (v === 'counter_door') return 'counterdoor';
    if (v === 'counter') return 'counter';
    if (v === 'rope') return 'rope';
    if (v === 'glass_full') return 'glass';
    if (v === 'window_insert') return 'window';
    return 'wall';
  }
  const KIND_RANK = { arch: 0, door: 1, counterdoor: 2, staffdoor: 3, rope: 4, counter: 5, glass: 6, window: 7, wall: 8 };
  // how much noise an edge soaks up (Infinity = blocks it)
  const NOISE_LOSS = { open: 0.12, arch: 0.3, rope: 0.15, counter: 0.3, counterdoor: 0.4, door: 1.0, staffdoor: 1.0, glass: 1.3, window: 1.6, wall: Infinity };

  // objects you can't stand on (benches and PC seats are seats, not obstacles)
  const BLOCKING_OBJECTS = new Set(['car', 'trash', 'sign', 'dir', 'arcade', 'standee', 'npc', 'key', 'box', 'crate']);
  const SEAT_OBJECTS = new Set(['bench', 'arcade_sit']);

  // ---------------------------------------------------------------- facility model
  function build(data) {
    const R = GameData.ROOM_RULES;
    const floorsRaw = data.map;
    const H = floorsRaw[0].length, W = floorsRaw[0][0].length;
    const zoneDefs = (data.settings && data.settings.zoneDefs) || [];
    const cell = (f, x, z) => (floorsRaw[f] && floorsRaw[f][z] && floorsRaw[f][z][x]) || null;

    // arrival points, staff, ground floor
    const spawns = [], staff = [], stairs = [], lifts = [];
    let ground = 0;
    floorsRaw.forEach((flr, f) => flr.forEach((row, z) => row.forEach((c, x) => {
      if (!c || !c.o) return;
      const o = c.o, m = o.meta || {};
      if (o.v === 'start') { ground = f; spawns.unshift({ f, x, z, name: 'Parking Lot' }); }
      else if (o.v === 'warp_point') spawns.push({ f, x, z, name: m.warpPointName || 'Arrival point' });
      else if (o.v === 'npc') staff.push({ f, x, z, name: m.name || 'Staff', color: m.cloth || o.c || '#2563eb' });
      if (o.v === 'stairs' || o.v === 'ladder') stairs.push({ f, x, z });
      if (o.v === 'elevator') lifts.push({ f, x, z });
    })));
    if (!spawns.length) {   // no Player Start: use any outdoor floor tile
      outer: for (let f = 0; f < floorsRaw.length; f++) for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        const c = cell(f, x, z); if (c && c.f && !c.c) { spawns.push({ f, x, z, name: 'Arrivals' }); ground = f; break outer; }
      }
    }

    // rooms from zones
    const rooms = {};
    const zoneById = {};
    zoneDefs.forEach(z => { zoneById[z.id] = z; });
    floorsRaw.forEach((flr, f) => flr.forEach((row, z) => row.forEach((c, x) => {
      if (!c || !c.zone || !c.f) return;
      const def = zoneById[c.zone] || { id: c.zone, name: c.zone, color: '#94a3b8' };
      if (!rooms[def.id]) {
        const rule = R[def.id] || {};
        rooms[def.id] = { id: def.id, name: def.name, color: def.color || '#94a3b8', rule, tags: (rule.tags || ['public']).slice(), blurb: rule.blurb || 'A room painted in Mapster.', tiles: [], seats: [], floorCounts: {} };
      }
      const room = rooms[def.id];
      room.tiles.push({ f, x, z });
      room.floorCounts[f] = (room.floorCounts[f] || 0) + 1;
      if (c.o && SEAT_OBJECTS.has(c.o.v)) room.seats.push({ f, x, z });
    })));
    Object.values(rooms).forEach(room => {
      room.floor = +Object.keys(room.floorCounts).sort((a, b) => room.floorCounts[b] - room.floorCounts[a])[0];
      room.capacity = room.rule.capacity || Math.max(4, Math.round(room.tiles.length * 0.6));
      room.isStaff = room.tags.includes('staff');
      room.isUtility = room.tags.includes('utility');
      room.isQuiet = room.tags.includes('quiet') || room.tags.includes('study');
      room.soundproof = room.tags.includes('soundproof');
      room.outdoor = room.tags.includes('outdoor');
      // label spot: the room tile nearest its centre, on its main floor
      const own = room.tiles.filter(t => t.f === room.floor);
      const cx = own.reduce((s, t) => s + t.x, 0) / own.length, cz = own.reduce((s, t) => s + t.z, 0) / own.length;
      room.centroid = { x: cx + 0.5, z: cz + 0.5 };
      room.labelTile = own.slice().sort((a, b) => (Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz)))[0];
      const xs = own.map(t => t.x), zs = own.map(t => t.z);
      room.bounds = { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs) + 1, z1: Math.max(...zs) + 1 };
    });

    // per-tile lookups
    const tileRoom = floorsRaw.map(flr => flr.map(row => row.map(c => (c && c.zone && rooms[c.zone]) || null)));
    const walkable = floorsRaw.map(flr => flr.map(row => row.map(c => !!(c && c.f && !(c.o && BLOCKING_OBJECTS.has(c.o.v))))));

    function edgeKind(f, x, z, d) {
      const [dx, dz] = STEP[d];
      const a = cell(f, x, z), b = cell(f, x + dx, z + dz);
      const ka = a && kindOf(a[d]), kb = b && kindOf(b[OPP[d]]);
      if (!ka && !kb) return 'open';
      if (!ka) return kb; if (!kb) return ka;
      return KIND_RANK[ka] <= KIND_RANK[kb] ? ka : kb;
    }

    // stair links: same (x,z) on the floor above/below
    const stairLinks = {};
    const key = (f, x, z) => (f * H + z) * W + x;
    stairs.forEach(s => {
      stairs.forEach(t => {
        if (t.x === s.x && t.z === s.z && Math.abs(t.f - s.f) === 1) {
          (stairLinks[key(s.f, s.x, s.z)] = stairLinks[key(s.f, s.x, s.z)] || []).push(t);
        }
      });
    });
    // elevators: an elevator on the same (x,z) on several floors serves all of them
    lifts.forEach(s => {
      lifts.forEach(t => {
        if (t.x === s.x && t.z === s.z && t.f !== s.f) (stairLinks[key(s.f, s.x, s.z)] = stairLinks[key(s.f, s.x, s.z)] || []).push(Object.assign({ lift: true }, t));
      });
    });

    // floors: name + bounds of anything drawn
    const floors = floorsRaw.map((flr, f) => {
      let x0 = W, z0 = H, x1 = 0, z1 = 0;
      flr.forEach((row, z) => row.forEach((c, x) => {
        if (c && (c.f || c.n || c.s || c.e || c.w)) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x + 1); z1 = Math.max(z1, z + 1); }
      }));
      if (x1 <= x0) { x0 = 0; z0 = 0; x1 = W; z1 = H; }
      return { index: f, name: GameData.floorName(f, ground), bounds: { x0, z0, x1, z1 } };
    });

    // ---------------------------------------------------------------- walking
    function canStand(f, x, z, access) {
      if (x < 0 || z < 0 || x >= W || z >= H || !walkable[f] || !walkable[f][z][x]) return false;
      const room = tileRoom[f][z][x];
      if (room && room.isStaff && !(access && access.staff)) return false;
      return true;
    }
    function canCross(f, x, z, d, access) {
      const k = edgeKind(f, x, z, d);
      if (k === 'open' || k === 'arch' || k === 'door') return true;
      if (k === 'staffdoor' || k === 'counterdoor') return !!(access && access.staff);
      return false;
    }

    // A* from a tile to a tile across floors. Returns [{f,x,z}, ...] or null.
    function findPath(from, to, access) {
      const startK = key(from.f, from.x, from.z), goalK = key(to.f, to.x, to.z);
      if (startK === goalK) return [from];
      const g = new Map([[startK, 0]]), came = new Map(), open = [[0, startK, from]];
      const h = (n) => Math.abs(n.x - to.x) + Math.abs(n.z - to.z) + Math.abs(n.f - to.f) * 6;
      const allowGoal = (n) => key(n.f, n.x, n.z) === goalK;
      let guard = 0;
      while (open.length && guard++ < 20000) {
        let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
        const [, ck, cur] = open.splice(bi, 1)[0];
        if (ck === goalK) {
          const path = [cur]; let k = ck;
          while (came.has(k)) { const p = came.get(k); path.unshift(p.node); k = p.k; }
          return path;
        }
        const nbrs = [];
        for (const d of ['n', 's', 'e', 'w']) {
          const [dx, dz] = STEP[d], n = { f: cur.f, x: cur.x + dx, z: cur.z + dz };
          if ((canStand(n.f, n.x, n.z, access) || allowGoal(n)) && canCross(cur.f, cur.x, cur.z, d, access)) nbrs.push([n, 1]);
        }
        // stairs cost 3 a floor; the elevator a wait plus 1 a floor. Seniors, grown-ups with
        // toddlers and wheelchair users prefer it (access.lift); wheelchairs can't take stairs.
        (stairLinks[ck] || []).forEach(t => {
          if (t.lift) nbrs.push([{ f: t.f, x: t.x, z: t.z }, (access && access.lift ? 1 : 6) + Math.abs(t.f - cur.f)]);
          else if (!(access && access.wheelchair)) nbrs.push([{ f: t.f, x: t.x, z: t.z }, access && access.lift ? 16 : 3]);
        });
        const gc = g.get(ck);
        for (const [n, cost] of nbrs) {
          const nk = key(n.f, n.x, n.z), ng = gc + cost;
          if (ng < (g.has(nk) ? g.get(nk) : Infinity)) {
            g.set(nk, ng); came.set(nk, { k: ck, node: cur }); open.push([ng + h(n), nk, n]);
          }
        }
      }
      return null;
    }

    return {
      name: data.name || 'library', W, H, ground, floors, rooms, spawns, staff,
      cell, tileRoom, walkable, edgeKind, canStand, canCross, findPath, stairLinks, key,
      NOISE_LOSS, STEP, OPP,
    };
  }

  return { loadDefault, loadFile, parseMapHtml, build, kindOf };
})();
