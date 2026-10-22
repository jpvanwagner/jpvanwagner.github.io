/* JS/SIM.JS - The library in motion: patrons arrive at the map's arrival points, walk
   the map's hallways, doors and stairs to a room, stay a while and leave.

   Two kinds of patron:
     passive  everyday visitors (rates in GameData.PASSIVE_TRAFFIC), heading for the rooms their
              audience likes (ROOM_PREFERENCES). Quiet-seekers lose patience in noise or crowds
              and storm out when it runs out.
     event    attendees of a scheduled program, spawned around its start time and routed
              straight to its room. If the room is full they're turned away at the door.

   Noise: each live program (and teens who spill out of a full Teen Zone) is a noise source.
   It spreads tile to tile, losing strength through walls, doors and glass (map-loader.js
   NOISE_LOSS); a soundproof room keeps its own noise inside.

   The engine drives this with step(dtMinutes, clockMinute) and listens through `hooks`. */

window.Sim = (function () {
  const D = () => GameData;
  let nextId = 1;

  function create(fac, hooks) {
    const GD = D();
    const sim = {
      fac, hooks, agents: [], live: {}, dayInfo: null, spawnAcc: {},
      noise: fac.floors.map(() => new Float32Array(fac.W * fac.H)),
      noiseSrc: fac.floors.map(() => new Array(fac.W * fac.H).fill(null)),
      noiseTimer: 0, eventQueue: [],
    };

    const idx = (x, z) => z * fac.W + x;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // ---------------------------------------------------------------- day setup
    // day: { week, day, saturday, open, close, events:[{ id, program, room, start, end, plan:{demo:n}, cap, access }] }
    sim.startDay = function (day) {
      sim.agents = []; sim.live = {}; sim.dayInfo = day; sim.spawnAcc = {};
      sim.eventQueue = [];
      day.events.forEach(ev => {
        sim.live[ev.id] = { ev, admitted: {}, turnedAway: {}, walkIns: {}, occ: 0, peakOcc: 0, complaints: 0, started: false, ended: false, seen: new Set() };
        GD.DEMO_KEYS.forEach(d => {
          for (let i = 0; i < (ev.plan[d] || 0); i++) {
            sim.eventQueue.push({ t: ev.start + rnd(-40, 12), demo: d, ev });
          }
        });
      });
      sim.eventQueue.sort((a, b) => a.t - b.t);
      sim.recomputeNoise();
    };

    // ---------------------------------------------------------------- agents
    function occupancyOf(roomId) {
      let n = 0;
      for (const a of sim.agents) if (a.roomId === roomId && a.state === 'staying') n += a.size;
      return n;
    }
    function roomCounts(roomId) {
      const out = { total: 0 }; GD.DEMO_KEYS.forEach(d => { out[d] = 0; });
      for (const a of sim.agents) if (a.state === 'staying' && a.roomId === roomId) { out[a.demo] += 1; out.total += a.size; }
      return out;
    }
    sim.occupancyOf = occupancyOf; sim.roomCounts = roomCounts;

    function chooseTile(room, access, from) {
      const taken = new Set(sim.agents.filter(a => a.target).map(a => fac.key(a.target.f, a.target.x, a.target.z)));
      const freeSeats = room.seats.filter(s => !taken.has(fac.key(s.f, s.x, s.z)));
      const spots = room.tiles.filter(t => fac.walkable[t.f][t.z][t.x]);
      for (let tries = 0; tries < 6; tries++) {
        const t = (freeSeats.length && Math.random() < 0.7) ? pick(freeSeats) : pick(spots);
        if (!t) return null;
        const path = fac.findPath(from, t, access);
        if (path) return { tile: t, path };
      }
      return null;
    }

    function spawnAgent(demo, kind, room, opts) {
      opts = opts || {};
      const info = GD.DEMOGRAPHICS[demo];
      const spawn = pick(fac.spawns);
      if (!spawn || !room) return null;
      // look picks the 3D figure; about 1 senior in 8 uses a wheelchair (js/viewer3d.js draws it)
      const look = 1 + Math.floor(Math.random() * 99999);
      const wheelchair = demo === 'seniors' && look % 100 < 12;
      const access = { staff: !!opts.staff, lift: demo === 'seniors' || !!info.withCaregiver, wheelchair };
      const choice = chooseTile(room, access, spawn);
      if (!choice) return null;
      const a = {
        id: nextId++, demo, kind, state: 'arriving', size: info.withCaregiver ? 2 : 1,
        f: spawn.f, x: spawn.x + 0.5, z: spawn.z + 0.5, path: choice.path, pi: 1,
        target: choice.tile, roomId: room.id, access, spawn,
        speed: info.speed * rnd(0.85, 1.15), patience: info.patience * rnd(0.8, 1.2),
        stayFor: opts.stayFor || 60, eventId: opts.eventId || null, overflow: !!opts.overflow,
        noisy: !!opts.noisy, jx: rnd(-0.22, 0.22), jz: rnd(-0.22, 0.22), mood: 0, born: sim.clock,
        look,   // picks the figure the 3D view draws (gender, clothes, hair, wheelchair)
      };
      sim.agents.push(a);
      if (hooks.onVisit && kind === 'passive') hooks.onVisit(a);
      return a;
    }

    function sendHome(a, reason) {
      if (a.state === 'leaving') return;
      a.state = 'leaving'; a.leaveReason = reason || 'done';
      const here = { f: a.f, x: Math.floor(a.x), z: Math.floor(a.z) };
      const exit = pick(fac.spawns);
      a.path = fac.findPath(here, exit, Object.assign({}, a.access, { staff: true })) || [here, exit];
      a.pi = 1; a.target = null;
    }

    function weightedRoom(prefs) {
      const entries = Object.entries(prefs).filter(([id]) => fac.rooms[id]);
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = Math.random() * total;
      for (const [id, w] of entries) { r -= w; if (r <= 0) return fac.rooms[id]; }
      return entries.length ? fac.rooms[entries[0][0]] : null;
    }

    function passiveRate(demo, minute) {
      // the day's pattern (school days, Saturdays, school breaks), scaled by the town's size
      const table = GD.PASSIVE_TRAFFIC[GD.dayType(sim.dayInfo.week, sim.dayInfo.day)][demo] || [];
      const hour = minute / 60;
      const band = table.find(([a, b]) => hour >= a && hour < b);
      return band ? band[2] * GD.population() : 0;
    }

    function spawnPassive(minute, dt) {
      if (minute > sim.dayInfo.close - 30 || minute < sim.dayInfo.open) return;
      GD.DEMO_KEYS.forEach(demo => {
        const gw = hooks.goodwill ? hooks.goodwill(demo) : 60;
        const rate = passiveRate(demo, minute) * Math.pow(gw / 62, 0.8);
        sim.spawnAcc[demo] = (sim.spawnAcc[demo] || 0) + rate * dt / 60;
        while (sim.spawnAcc[demo] >= 1 || (sim.spawnAcc[demo] > 0 && Math.random() < sim.spawnAcc[demo] * 0.02)) {
          sim.spawnAcc[demo] -= 1;
          let room = weightedRoom(GD.ROOM_PREFERENCES[demo] || {});
          let noisy = false;
          if (demo === 'teens' && room && occupancyOf(room.id) >= room.capacity * 0.95) {
            const alt = GD.TEEN_OVERFLOW.map(id => fac.rooms[id]).filter(r => r && occupancyOf(r.id) < r.capacity);
            if (!alt.length) continue;
            room = pick(alt); noisy = !room.tags.includes('loud');
            if (noisy && hooks.onTeenOverflow) hooks.onTeenOverflow(room);
          }
          const stay = demo === 'teens' ? rnd(45, 150) : rnd(30, 110);
          spawnAgent(demo, 'passive', room, { stayFor: stay, noisy });
        }
      });
    }

    function spawnEventAttendees(minute) {
      while (sim.eventQueue.length && sim.eventQueue[0].t <= minute) {
        const q = sim.eventQueue.shift();
        const L = sim.live[q.ev.id], ev = q.ev, room = fac.rooms[ev.room];
        if (!room) continue;
        const size = GD.DEMOGRAPHICS[q.demo].withCaregiver ? 2 : 1;
        const admittedTotal = Object.entries(L.admitted).reduce((s, [d, n]) => s + n * (GD.DEMOGRAPHICS[d].withCaregiver ? 2 : 1), 0);
        const overflow = admittedTotal + size > ev.cap;
        if (overflow) L.turnedAway[q.demo] = (L.turnedAway[q.demo] || 0) + 1;
        else L.admitted[q.demo] = (L.admitted[q.demo] || 0) + 1;
        spawnAgent(q.demo, 'event', room, { eventId: ev.id, overflow, staff: ev.access === 'staff', stayFor: 0 });
      }
    }

    // ---------------------------------------------------------------- noise
    sim.recomputeNoise = function () {
      fac.floors.forEach((fl, f) => { sim.noise[f].fill(0); sim.noiseSrc[f].fill(null); });
      const sources = [];
      Object.values(sim.live).forEach(L => {
        if (!L.started || L.ended) return;
        const room = fac.rooms[L.ev.room];
        if (!room) return;
        const level = L.ev.noise + (L.occ > 30 ? 0.4 : 0);
        if (level <= 0) return;
        sources.push({ tiles: room.tiles, level, keepIn: room.soundproof ? room.id : null, id: L.ev.id });
      });
      // a busy loud room (children's section, teen zone, entryway) hums with chatter: up
      // to about a quiet room's limit right next to it, so an open doorway between a loud
      // room and a quiet one matters even when no program is running
      const busy = {};
      sim.agents.forEach(a => { if (a.state === 'staying') busy[a.roomId] = (busy[a.roomId] || 0) + a.size; });
      Object.values(fac.rooms).forEach(room => {
        const n = busy[room.id] || 0;
        if (n < 3 || !room.tags.includes('loud') || room.tags.includes('outdoor')) return;
        if (Object.values(sim.live).some(L => L.started && !L.ended && L.ev.room === room.id)) return;   // the program is the source
        sources.push({ tiles: room.tiles, level: Math.min(1.1, 0.25 + 0.9 * n / room.capacity), keepIn: room.soundproof ? room.id : null, id: 'crowd:' + room.id });
      });
      sim.agents.forEach(a => {
        if (a.noisy && a.state === 'staying') sources.push({ tiles: [{ f: a.f, x: Math.floor(a.x), z: Math.floor(a.z) }], level: 1.3, keepIn: null, id: 'teens:' + a.roomId });
      });
      sources.forEach(src => spread(src));
    };

    function spread(src) {
      const best = new Map();
      const queue = [];
      src.tiles.forEach(t => { const k = fac.key(t.f, t.x, t.z); best.set(k, src.level); queue.push([src.level, t.f, t.x, t.z]); });
      while (queue.length) {
        let bi = 0; for (let i = 1; i < queue.length; i++) if (queue[i][0] > queue[bi][0]) bi = i;
        const [lv, f, x, z] = queue.splice(bi, 1)[0];
        const i = idx(x, z);
        if (lv > sim.noise[f][i]) { sim.noise[f][i] = lv; sim.noiseSrc[f][i] = src.id; }
        for (const d of ['n', 's', 'e', 'w']) {
          const [dx, dz] = fac.STEP[d], nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= fac.W || nz >= fac.H) continue;
          const c = fac.cell(f, nx, nz); if (!c || !c.f) continue;
          if (src.keepIn) { const r = fac.tileRoom[f][nz][nx]; if (!r || r.id !== src.keepIn) continue; }
          const loss = fac.NOISE_LOSS[fac.edgeKind(f, x, z, d)];
          const nl = lv - loss;
          if (nl <= 0.05) continue;
          const k = fac.key(f, nx, nz);
          if (nl > (best.get(k) || 0)) { best.set(k, nl); queue.push([nl, f, nx, nz]); }
        }
      }
    }
    sim.noiseAt = (f, x, z) => sim.noise[f][idx(x, z)];

    // ---------------------------------------------------------------- events
    sim.liveStats = (id) => sim.live[id];
    sim.endEvent = function (id) {
      const L = sim.live[id]; if (!L || L.ended) return L;
      L.ended = true;
      sim.agents.forEach(a => { if (a.eventId === id) sendHome(a, 'event over'); });
      sim.recomputeNoise();
      return L;
    };
    sim.startEvent = function (id) {
      const L = sim.live[id]; if (!L || L.started) return;
      L.started = true; sim.recomputeNoise();
    };

    // ---------------------------------------------------------------- the tick
    function moveAgent(a, dt) {
      let budget = a.speed * dt;
      while (budget > 0 && a.path && a.pi < a.path.length) {
        const n = a.path[a.pi];
        if (n.f !== a.f) { a.f = n.f; a.x = n.x + 0.5; a.z = n.z + 0.5; a.pi++; budget -= 1; continue; }
        const tx = n.x + 0.5, tz = n.z + 0.5, dx = tx - a.x, dz = tz - a.z, dist = Math.hypot(dx, dz);
        if (dist <= budget) { a.x = tx; a.z = tz; a.pi++; budget -= dist; }
        else { a.x += dx / dist * budget; a.z += dz / dist * budget; budget = 0; }
      }
      return !a.path || a.pi >= a.path.length;
    }

    sim.step = function (dt, minute) {
      sim.clock = minute;
      const day = sim.dayInfo; if (!day) return;
      spawnPassive(minute, dt);
      spawnEventAttendees(minute);

      sim.noiseTimer -= dt;
      if (sim.noiseTimer <= 0) { sim.recomputeNoise(); sim.noiseTimer = 2; }

      // closing time: everyone heads out
      if (minute >= day.close - 15) sim.agents.forEach(a => { if (a.state !== 'leaving') sendHome(a, 'closing'); });

      const occ = {};
      Object.values(fac.rooms).forEach(r => { occ[r.id] = 0; });
      sim.agents.forEach(a => { if (a.state === 'staying' && occ[a.roomId] != null) occ[a.roomId] += a.size; });

      for (const a of sim.agents) {
        if (a.state === 'arriving') {
          if (moveAgent(a, dt)) {
            if (a.overflow) { a.mood = -1; sendHome(a, 'turned away'); continue; }
            a.state = 'staying'; a.arrivedAt = minute;
            if (a.kind === 'event') {
              const L = sim.live[a.eventId];
              a.leaveAt = L ? L.ev.end + rnd(0, 8) : minute + 60;
            } else a.leaveAt = minute + a.stayFor;
          }
        } else if (a.state === 'staying') {
          if (minute >= a.leaveAt) { sendHome(a, 'done'); continue; }
          const tx = Math.floor(a.x), tz = Math.floor(a.z);
          const room = fac.rooms[a.roomId];
          if (a.kind === 'passive' && room) {
            const info = GD.DEMOGRAPHICS[a.demo];
            let drain = 0, why = null, src = null;
            const n = sim.noise[a.f][idx(tx, tz)];
            const tol = room.isQuiet ? 0.35 : 2.6;
            if (n > tol && !(a.noisy)) { drain += (n - tol) * 1.2 * info.noiseSensitivity; why = 'noise'; src = sim.noiseSrc[a.f][idx(tx, tz)]; }
            if (occ[a.roomId] > room.capacity * 0.85) { drain += 0.7; why = why || 'crowded'; }
            a.mood = drain > 0 ? -Math.min(1, drain) : 0;
            a.patience -= drain * dt;
            if (a.patience <= 0) {
              a.angry = true; sendHome(a, why);
              if (hooks.onAngry) hooks.onAngry(a, why, room, src);
              if (src && sim.live[src]) sim.live[src].complaints++;
            }
          }
        } else if (a.state === 'leaving') {
          if (moveAgent(a, dt)) { a.state = 'gone'; if (hooks.onLeave) hooks.onLeave(a); }
        }
      }

      // walk-ins: everyday visitors passing through a walk-in program's room may stop by
      Object.values(sim.live).forEach(L => {
        if (!L.started || L.ended) return;
        L.occ = occ[L.ev.room] || 0;
        L.peakOcc = Math.max(L.peakOcc, L.occ);
        if (!L.ev.walkIn) return;
        for (const a of sim.agents) {
          if (a.kind !== 'passive' || L.seen.has(a.id) || a.state === 'gone') continue;
          const r = fac.tileRoom[a.f] && fac.tileRoom[a.f][Math.floor(a.z)] && fac.tileRoom[a.f][Math.floor(a.z)][Math.floor(a.x)];
          if (r && r.id === L.ev.room) { L.seen.add(a.id); if (Math.random() < 0.5) L.walkIns[a.demo] = (L.walkIns[a.demo] || 0) + 1; }
        }
      });

      sim.agents = sim.agents.filter(a => a.state !== 'gone');
    };

    sim.endDay = function () {
      sim.agents.forEach(a => { if (hooks.onLeave) hooks.onLeave(a); });
      sim.agents = []; sim.recomputeNoise();
    };

    return sim;
  }

  return { create };
})();
