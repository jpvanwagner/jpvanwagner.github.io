/* JS/VIEW3D.JS - The game's side of the 3D map view.

   The Facility panel can show the library two ways:
     3D         Mapster's own engine (viewer3d.html in an iframe), in viewer mode: drag to pan,
                wheel to zoom, right-drag or the buttons to rotate and tilt. No player.
     Blueprint  the flat drawing in js/facility-view.js.
   This file creates the iframe, hands it the map, streams the patrons and room states to
   it (~12 times a second), and turns its hovers and clicks back into room events for
   engine.js. Messages carry `bts3d: true` so nothing else on the page is confused. */

window.View3D = (function () {
  let frameEl = null, ready = false, started = false, mapKey = null;
  let lastSend = 0, lastNoise = 0, lastHL = '', seats = new Set();
  const sentStep = new Map();   // agent id -> { path, pi } as of the last frame sent
  const handlers = {};

  function supported() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; }
  }

  function send(msg) { if (frameEl && frameEl.contentWindow) frameEl.contentWindow.postMessage(Object.assign({ bts3d: true }, msg), '*'); }

  function roomsFor(fac) {
    return Object.values(fac.rooms).map(r => ({
      id: r.id, name: r.name, color: r.color, floor: r.floor, cx: r.centroid.x, cz: r.centroid.z, cap: r.capacity,
      show: !r.isUtility && !r.tags.includes('transit'), tiles: r.tiles.map(t => [t.f, t.x, t.z]),
    }));
  }

  // (re)build the iframe for the current map
  function mount(wrap, fac, data, view) {
    unmount();
    ready = started = false; lastHL = '';
    frameEl = document.createElement('iframe');
    frameEl.id = 'view3d-frame';
    frameEl.title = '3D view of the library';
    frameEl.src = 'viewer3d.html';
    wrap.insertBefore(frameEl, wrap.firstChild);
    mapKey = { fac, data, view };
    seats = new Set();
    Object.values(fac.rooms).forEach(r => r.seats.forEach(s => seats.add(s.f + ',' + s.x + ',' + s.z)));
  }
  function unmount() { if (frameEl) { frameEl.remove(); frameEl = null; } ready = started = false; sentStep.clear(); }

  window.addEventListener('message', ev => {
    const m = ev.data; if (!m || !m.bts3d || !frameEl || ev.source !== frameEl.contentWindow) return;
    if (m.t === 'ready' && mapKey) {
      ready = true;
      const { fac, data, view } = mapKey;
      send({ t: 'init', map: data, ground: fac.ground, rooms: roomsFor(fac), floors: fac.floors.map(f => f.bounds), view });
    } else if (m.t === 'started') { started = true; if (handlers.started) handlers.started(); }
    else if (handlers[m.t]) handlers[m.t](m, frameEl.getBoundingClientRect());
  });

  // called every animation frame by engine.js while 3D is showing
  function tick(now, G) {
    if (!started || !G.sim) return;
    const hl = JSON.stringify([G.view.highlights, G.view.selectedRoom]);
    if (hl !== lastHL) { lastHL = hl; send({ t: 'highlights', map: G.view.highlights, selected: G.view.selectedRoom }); }
    if (now - lastSend < 80) return;
    lastSend = now;
    const D = GameData.DEMO_KEYS;
    const agents = G.sim.agents.map(a => {
      let fl = 0;
      if (a.kind === 'event') fl |= 1;
      if (a.overflow) fl |= 2;
      if (a.angry) fl |= 4;
      if (a.state === 'leaving') fl |= 8;
      if (a.mood < -0.3) fl |= 16;
      if (GameData.DEMOGRAPHICS[a.demo].withCaregiver) fl |= 32;
      // sitting on a bench or at a computer: the 3D figure sits, right on the seat
      const seated = a.state === 'staying' && a.target && seats.has(a.target.f + ',' + a.target.x + ',' + a.target.z);
      if (seated) fl |= 64;
      // the tile centres walked through since the last frame, so the 3D view can follow
      // the real path (through doorways) instead of cutting across walls between frames
      const was = sentStep.get(a.id), corners = [];
      if (a.path) {
        const from = was && was.path === a.path ? was.pi : 0;
        for (let k = from; k < a.pi && k < a.path.length; k++) { const n = a.path[k]; corners.push(n.f, n.x + 0.5, n.z + 0.5); }
      }
      sentStep.set(a.id, { path: a.path, pi: a.pi });
      const jx = seated ? 0 : a.jx, jz = seated ? 0 : a.jz;
      return [a.id, D.indexOf(a.demo), a.f, +(a.x + jx).toFixed(2), +(a.z + jz).toFixed(2), fl, corners.length ? corners : 0, a.look || 0];
    });
    if (sentStep.size > agents.length * 2) { const ids = new Set(G.sim.agents.map(a => a.id)); sentStep.forEach((v, id) => { if (!ids.has(id)) sentStep.delete(id); }); }
    const occ = {};
    Object.keys(G.fac.rooms).forEach(id => { occ[id] = G.sim.occupancyOf(id); });
    const live = Object.values(G.view.live).map(L => ({ room: L.room, noise: L.noise, emoji: L.emoji }));
    const msg = { t: 'frame', agents, occ, live };
    if (G.view.overlays.noise && now - lastNoise > 250) { lastNoise = now; const f = G.view.floor; msg.noise = { f, data: Array.from(G.sim.noise[f], v => Math.round(v * 100) / 100) }; }
    send(msg);
  }

  return {
    supported, mount, unmount, tick, send,
    on: (t, fn) => { handlers[t] = fn; },
    isMounted: () => !!frameEl,
    isStarted: () => started,
    setFloor: (f) => send({ t: 'floor', f }),
    flash: (roomId) => send({ t: 'flash', room: roomId }),
    cmd: (cmd, v) => send({ t: 'cmd', cmd, v }),
  };
})();
