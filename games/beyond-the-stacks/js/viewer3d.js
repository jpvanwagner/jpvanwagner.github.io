/* JS/VIEWER3D.JS - Runs inside viewer3d.html (the 3D map view in an iframe).

   Boots Mapster's engine in viewer mode (window.mapsterViewer) with the map the game
   sends, then draws what the game streams to it:
     - patrons, as Mapster humanoids in their audience's colour (walking, seated, leaving)
     - a tint layer on each floor: room picking (good/OK/poor fit), programs in progress,
       the noise overlay, and a red flash when someone walks out
     - room labels with occupancy bars
   and reports hovers, clicks and right-clicks on tiles back to the game (js/view3d.js).

   Game tile (x, z) has its centre at x + 0.5 in the game's coordinates; the engine puts
   tile centres on whole numbers, so world = game - 0.5. */

(function () {
  const post = (msg) => { try { parent.postMessage(Object.assign({ bts3d: true }, msg), '*'); } catch (e) { /* no parent */ } };
  let V = null, T = null, booted = false;
  let rooms = [], floors = [], W = 0, H = 0, ground = 0;
  let highlights = null, selected = null, live = [], noise = null, occ = {}, flashes = {};
  let showLabels = true, showNoise = false;
  const agents = new Map();
  const DEMO_COLORS = ['#f2c14e', '#4cc9f0', '#b388ff', '#ff7aa2'];
  const ADULT = '#4cc9f0';
  const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0522d'];
  const TONES = { good: '#3ddc84', ok: '#ffc857', bad: '#ff6b6b', booked: '#8892a6' };

  // Photo textures (ambientCG, CC0; js/library-textures.js) in place of Mapster's drawn ones,
  // keyed by Mapster floor/wall style, then '@zone' or '#colour' to narrow it (see the
  // TEXTURE OVERRIDES note in mapster/core/engine.js). The teen zone keeps Mapster's arcade
  // carpet. size = tiles one image covers; repeat = copies per wall face.
  const TEXTURES = {
    floor: {
      'wood': { tex: 'wood', size: 2 },
      'carpet@children': { tex: 'kids-carpet', size: 2 },
      'lino@study': { tex: 'beige-carpet', size: 2 },
      'lino@offices': { tex: 'office-carpet', size: 2 },
      'lino': { tex: 'beige-carpet', size: 2 },
      'wood@bookshop': { tex: 'wood', size: 2, tint: '#e6c9a6' },
      'hextile': { tex: 'carpet-tiles', size: 2 },
      'tile': { tex: 'tile', size: 1 },
      'terrazzo': { tex: 'terrazzo', size: 2 },
      'concrete@plaza': { tex: 'asphalt', size: 3 },
      'parking': { tex: 'parking-stall', size: 1 },
      'concrete': { tex: 'concrete', size: 3 },
      'stone@plaza': { tex: 'pavement', size: 2 },
      'grass': { tex: 'grass', size: 3 },
    },
    wall: {
      'brick': { tex: 'brick' },
      'window_insert#9c4a32': { tex: 'brick' },
      'solid': { tex: 'plaster' },
      'window_insert#e7e1d3': { tex: 'plaster' },
      'stone#6b7280': { tex: 'pavement', tint: '#a4a9b2' },
      'stone': { tex: 'pavement', tint: '#d9dbe0' },
    },
  };
  function textureOverrides() {
    const src = window.BTS_TEXTURES; if (!src) return null;
    const out = {};
    Object.keys(TEXTURES).forEach(kind => {
      out[kind] = {};
      Object.entries(TEXTURES[kind]).forEach(([key, t]) => { if (src[t.tex]) out[kind][key] = Object.assign({ src: src[t.tex] }, t); });
    });
    return out;
  }

  // ---------------------------------------------------------------- boot
  window.addEventListener('message', (ev) => {
    const m = ev.data; if (!m || !m.bts3d) return;
    if (m.t === 'init') boot(m);
    else if (!booted) return;
    else if (m.t === 'floor') setFloor(m.f);
    else if (m.t === 'frame') frame(m);
    else if (m.t === 'highlights') { highlights = m.map; selected = m.selected; }
    else if (m.t === 'flash') flashes[m.room] = performance.now();
    else if (m.t === 'cmd') command(m);
  });

  function boot(m) {
    if (booted) return;
    booted = true;
    W = m.map.map[0][0].length; H = m.map.map[0].length; ground = m.ground; rooms = m.rooms; floors = m.floors;
    const data = JSON.parse(JSON.stringify(m.map));
    // the bundled copy writes empty cells as 0; the engine wants objects
    const empty = () => ({ f: null, o: null, c: null, n: null, s: null, e: null, w: null, d1: null, d2: null });
    data.map = data.map.map(fl => fl.map(row => row.map(c => (c && typeof c === 'object') ? c : empty())));
    data.settings = Object.assign({}, data.settings, { startZoomDist: 20, minimapMode: 'off', disableLocations: true, flashlight: false, compassMode: 'on' });
    const tag = document.createElement('script');
    tag.type = 'application/json'; tag.id = 'map-data'; tag.textContent = JSON.stringify(data);
    document.body.appendChild(tag);
    window.mapsterViewer = true;
    window.mapsterTextureOverrides = textureOverrides();
    initEngine();
    (async function wait() {
      if (!window.engineViewer) { requestAnimationFrame(wait); return; }
      V = window.engineViewer; T = V.THREE;
      try { await loadFigures(); } catch (e) { console.warn('Patron models failed to load; using simple figures.', e); figures = null; }
      buildOverlays();
      initDoors();
      V.onFrame = onFrame;
      setFloor(m.view && m.view.floor != null ? m.view.floor : ground);
      resetView(m.view);
      document.getElementById('loading').remove();
      bindPointer();
      post({ t: 'started' });
    })();
  }

  // ---------------------------------------------------------------- view
  function fitZoom(f) {
    const b = floors[f] || { x0: 0, z0: 0, x1: W, z1: H };
    const cam = V.camera(), el = V.renderer.domElement;
    const aspect = el.clientWidth / Math.max(1, el.clientHeight);
    const span = Math.max((b.x1 - b.x0), (b.z1 - b.z0));
    const needHalf = Math.max(span * 0.62 / aspect, span * 0.5) * 1.05;
    return cam.top / needHalf;
  }
  function resetView(v) {
    v = v || {};
    const f = V.floor(), b = floors[f] || { x0: 0, z0: 0, x1: W, z1: H };
    V.setFocus((b.x0 + b.x1) / 2 - 0.5, (b.z0 + b.z1) / 2 - 0.5);
    V.setTilt(v.tilt != null ? v.tilt : -14);
    if (v.angle != null) V.rotate(v.angle - V.angle());
    V.setZoom(v.zoom || fitZoom(f));
  }
  function setFloor(f) {
    const before = V.floor();
    V.setFloor(f);
    if (before !== f) { const b = floors[f]; if (b) V.setFocus((b.x0 + b.x1) / 2 - 0.5, (b.z0 + b.z1) / 2 - 0.5); }
    overlays.forEach((o, i) => { o.mesh.visible = (i === f); });
    labelsDirty = true;
  }
  function command(m) {
    if (m.cmd === 'rotate') V.rotate(m.v);
    if (m.cmd === 'tilt') V.tiltBy(m.v);
    if (m.cmd === 'zoom') V.zoomBy(m.v);
    if (m.cmd === 'reset') resetView({ angle: Math.PI / 4 });
    if (m.cmd === 'labels') { showLabels = m.v; labelsDirty = true; }
    if (m.cmd === 'noise') showNoise = m.v;
    if (m.cmd === 'resize' && window.engineResize) window.engineResize();
    post({ t: 'view', angle: V.angle(), tilt: V.tilt(), zoom: V.zoom() });
  }

  // ---------------------------------------------------------------- floor tint layer
  const PX = 8;   // canvas pixels per tile
  const overlays = [];
  function buildOverlays() {
    for (let f = 0; f < floors.length; f++) {
      const c = document.createElement('canvas'); c.width = W * PX; c.height = H * PX;
      const tex = new T.CanvasTexture(c); tex.magFilter = T.NearestFilter; tex.minFilter = T.LinearFilter;
      const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      const mesh = new T.Mesh(new T.PlaneGeometry(W, H), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(W / 2 - 0.5, f * V.FLR_H + 0.05, H / 2 - 0.5);
      mesh.renderOrder = 2;
      V.scene.add(mesh);
      overlays.push({ c, ctx: c.getContext('2d'), tex, mesh });
    }
  }
  let tintTimer = 0;
  function drawTints(now) {
    const f = V.floor(), o = overlays[f]; if (!o) return;
    const ctx = o.ctx; ctx.clearRect(0, 0, o.c.width, o.c.height);
    const tile = (x, z, col) => { ctx.fillStyle = col; ctx.fillRect(x * PX, z * PX, PX, PX); };
    if (showNoise && noise && noise.f === f) {
      for (let i = 0; i < noise.data.length; i++) { const col = noiseColor(noise.data[i]); if (col) tile(i % W, Math.floor(i / W), col); }
    }
    rooms.forEach(r => {
      let col = null;
      if (highlights && highlights[r.id]) col = hexA(TONES[highlights[r.id]] || '#fff', selected === r.id ? 0.6 : 0.32);
      const L = live.find(l => l.room === r.id);
      if (!col && L) col = hexA(r.color, 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(now / 300)));
      const fl = flashes[r.id];
      if (fl) { const age = (now - fl) / 1500; if (age > 1) delete flashes[r.id]; else col = 'rgba(255,60,60,' + (0.5 * (1 - age)).toFixed(2) + ')'; }
      if (!col) return;
      r.tiles.forEach(t => { if (t[0] === f) tile(t[1], t[2], col); });
    });
    o.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- patrons
  // ---------------------------------------------------------------- patron figures
  // Kenney "Mini Characters 1" (CC0; js/patron-models.js): women and men in everyday
  // clothes, all on one skeleton, so one set of animations (idle, walk, sit, wheelchair)
  // drives everyone. Who they are reads from the figure: seniors have grey hair or none,
  // often glasses, sometimes a cane or a wheelchair; teens are a head shorter; toddlers are
  // tiny and come with a grown-up. The disc underfoot is their audience's colour (the
  // legend under the map), the white ring means they're at a program.
  const CAST = {
    0: ['female-c', 'male-b'],                                                      // seniors
    1: ['female-a', 'female-d', 'female-f', 'male-a', 'male-d', 'male-e', 'male-f'],  // adults
    2: ['female-b', 'female-f', 'male-f', 'male-a'],                                // teens
    3: ['female-b', 'male-f'],                                                      // toddlers
  };
  const HEIGHT = { 0: 1.3, 1: 1.36, 2: 1.14, 3: 0.68 };   // world units (a floor is 2)
  const GLASSES_Y = 0.13, GLASSES_Z = 0.12;   // on the head bone
  let figures = null;
  function loadFigures() {
    const M = window.BTS_PATRON_MODELS;
    if (!M || !T.GLTFLoader || !T.SkeletonUtils) return Promise.reject(new Error('models not bundled'));
    const loader = new T.GLTFLoader();
    const bin = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
    const parse = (k) => new Promise((res, rej) => loader.parse(bin(M[k]), '', res, rej));
    const keys = Object.keys(M);
    return Promise.all(keys.map(parse)).then(list => {
      const g = {}; keys.forEach((k, i) => { g[k] = list[i]; });
      figures = { scenes: {}, clips: {}, props: {} };
      keys.forEach(k => {
        const sc = g[k].scene;
        // light them like the rest of Mapster's scene (Lambert, linear colour)
        sc.traverse(o => {
          if (!o.isMesh) return;
          const map = o.material.map; if (map) map.encoding = T.LinearEncoding;
          o.material = new T.MeshLambertMaterial({ map, skinning: !!o.isSkinnedMesh, side: T.DoubleSide });
          o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false;
        });
        if (k === 'cane' || k === 'glasses' || k === 'wheelchair') figures.props[k] = sc;
        else if (k !== 'anims') { const b = new T.Box3().setFromObject(sc); figures.scenes[k] = { scene: sc, h: Math.max(0.1, b.max.y - b.min.y) }; }
      });
      g.anims.animations.forEach(c => { figures.clips[c.name] = c; });
    });
  }
  // a stable pick from the patron's look number
  const pickBy = (arr, look, salt) => arr[Math.abs((look * 2654435761 + salt * 40503) | 0) % arr.length];
  function makeFigure(demo, look, kid) {
    const name = pickBy(CAST[demo], look, 1);
    const src = figures.scenes[name];
    const body = T.SkeletonUtils.clone(src.scene);
    body.scale.setScalar(HEIGHT[demo] / src.h);
    const mixer = new T.AnimationMixer(body);
    const act = {};
    ['idle', 'walk', 'sit', 'wheelchair-sit', 'wheelchair-move-forward'].forEach(n => { if (figures.clips[n]) act[n] = mixer.clipAction(figures.clips[n]); });
    const fig = { body, mixer, act, cur: null, chair: false };
    if (demo === 0) {
      const r = (look % 100) / 100;
      const bone = (n) => { let b = null; body.traverse(o => { if (!b && o.name === n) b = o; }); return b; };
      // the props are modelled around their own origin: glasses sit on the face, the cane
      // stands on the floor at hand height by the right side, the chair under the seat
      if (r < 0.6 && figures.props.glasses) { const head = bone('head'), gl = figures.props.glasses.clone(); gl.position.set(0, GLASSES_Y, GLASSES_Z); if (head) head.add(gl); }
      if (r < 0.12 && figures.props.wheelchair) { fig.chair = figures.props.wheelchair.clone(); body.add(fig.chair); }
      else if (r > 0.65 && figures.props.cane) { const cane = figures.props.cane.clone(); cane.position.set(-0.19, 0, 0.06); body.add(cane); }
    }
    play(fig, fig.chair ? 'wheelchair-sit' : 'idle');
    return fig;
  }
  function play(fig, name) {
    if (!fig || fig.cur === name || !fig.act[name]) return;
    const next = fig.act[name].reset().play();
    if (fig.cur && fig.act[fig.cur]) fig.act[fig.cur].crossFadeTo(next, 0.2, false);
    fig.cur = name;
  }
  function makePerson(demo, flags, look) {
    look = look || Math.floor(Math.random() * 99999);
    const toddler = (flags & 32) !== 0;
    const g = new T.Group();
    let body, care = null, fig = null, careFig = null;
    if (figures) {
      fig = makeFigure(demo, look, toddler); body = fig.body; g.add(body);
      if (toddler) { careFig = makeFigure(1, look + 7, false); care = careFig.body; care.position.set(0.3, 0, 0.1); g.add(care); }
    } else {
      // fallback: Mapster's own block figures in the audience colour
      const skin = SKINS[look % SKINS.length];
      body = V.createHumanoid(skin, DEMO_COLORS[demo], false, null);
      body.scale.setScalar(toddler ? 0.5 : demo === 2 ? 0.88 : 0.95);
      g.add(body);
      if (toddler) { care = V.createHumanoid(SKINS[(look + 3) % SKINS.length], ADULT, false, null); care.scale.setScalar(0.95); care.position.set(0.32, 0, 0.12); g.add(care); }
    }
    const disc = new T.Mesh(new T.CircleGeometry(toddler ? 0.36 : 0.24, 18), new T.MeshBasicMaterial({ color: DEMO_COLORS[demo], transparent: true, opacity: 0.75, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04; if (toddler) disc.position.x = 0.15; g.add(disc);
    const ring = new T.Mesh(new T.RingGeometry(0.3, 0.38, 20), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false; g.add(ring);
    V.scene.add(g);
    return { g, body, care, fig, careFig, ring, phase: Math.random() * 6, x: null, z: null, f: 0, q: [], flags };
  }
  // Each frame brings an agent's new spot plus the tile centres it walked through on the
  // way (its path from the game's pathfinder). The figure walks that polyline, so it goes
  // around corners and through doorways instead of cutting through walls.
  function frame(m) {
    live = m.live || []; occ = m.occ || {};
    if (m.noise) noise = m.noise;
    const seen = new Set();
    m.agents.forEach(a => {
      const [id, demo, f, x, z, flags, corners, look] = a;
      seen.add(id);
      let p = agents.get(id);
      if (!p) { p = makePerson(demo, flags, look); agents.set(id, p); }
      p.flags = flags;
      if (p.x == null) { p.x = x - 0.5; p.z = z - 0.5; p.f = f; return; }
      if (corners) for (let i = 0; i < corners.length; i += 3) p.q.push({ f: corners[i], x: corners[i + 1] - 0.5, z: corners[i + 2] - 0.5 });
      p.q.push({ f, x: x - 0.5, z: z - 0.5 });
      if (p.q.length > 60) { const e = p.q[p.q.length - 1]; p.q = []; p.x = e.x; p.z = e.z; p.f = e.f; }   // a big skip: just jump there
    });
    agents.forEach((p, id) => { if (!seen.has(id)) { V.scene.remove(p.g); agents.delete(id); } });
  }
  function animatePeople(dt) {
    const vf = V.floor();
    agents.forEach(p => {
      // walk the queued points; go faster when far behind so the figure keeps up (~0.15 s)
      let left = 0, lx = p.x, lz = p.z;
      p.q.forEach(pt => { if (pt.f === p.f) left += Math.hypot(pt.x - lx, pt.z - lz); lx = pt.x; lz = pt.z; });
      let step = Math.max(1.6, left / 0.15) * dt, dx = 0, dz = 0;
      while (p.q.length && step > 0) {
        const pt = p.q[0];
        if (pt.f !== p.f) { p.f = pt.f; p.x = pt.x; p.z = pt.z; p.q.shift(); continue; }   // stairs: change floors
        const ex = pt.x - p.x, ez = pt.z - p.z, d = Math.hypot(ex, ez);
        if (d > 1e-4) { dx = ex; dz = ez; }
        if (d <= step) { p.x = pt.x; p.z = pt.z; step -= d; p.q.shift(); }
        else { p.x += ex / d * step; p.z += ez / d * step; step = 0; }
      }
      const moving = Math.hypot(dx, dz) > 1e-4;
      p.g.position.set(p.x, p.f * V.FLR_H, p.z);
      if (moving) p.g.rotation.y = Math.atan2(dx, dz);
      p.g.visible = p.f === vf;
      p.ring.visible = (p.flags & 1) !== 0 && (p.flags & 2) === 0;
      if (p.fig) {
        if (!p.g.visible) return;
        const seated = !moving && (p.flags & 64) !== 0;
        [p.fig, p.careFig].forEach(F => {
          if (!F) return;
          play(F, F.chair ? (moving ? 'wheelchair-move-forward' : 'wheelchair-sit') : moving ? 'walk' : (seated && F === p.fig) ? 'sit' : 'idle');
          F.mixer.update(dt);
        });
        return;
      }
      [p.body, p.care].forEach(h => {
        if (!h) return;
        const L = h.userData && h.userData.limbs;
        if (!L || !L.legL || !L.legL.hip) return;
        if (moving) p.phase += dt * 9;
        const s = moving ? Math.sin(p.phase) * 0.6 : 0;
        L.legL.hip.rotation.x = s; L.legR.hip.rotation.x = -s;
        L.legL.knee.rotation.x = Math.max(0, -s) * 0.5; L.legR.knee.rotation.x = Math.max(0, s) * 0.5;
        if (L.armL) { L.armL.rotation.x = -s * 0.7; L.armR.rotation.x = s * 0.7; }
      });
      p.body.position.y = moving ? Math.abs(Math.sin(p.phase)) * 0.03 : 0;
    });
  }

  // ---------------------------------------------------------------- labels (HTML over the canvas)
  const labelBox = document.getElementById('labels');
  const labelEls = {}, bangEls = [];
  let labelsDirty = true;
  function drawLabels() {
    const vf = V.floor();
    const placed = [];
    const fits = (x, y, w, h) => !placed.some(p => x < p.x + p.w && p.x < x + w && y < p.y + p.h && p.y < y + h);
    rooms.slice().sort((a, b) => b.tiles.length - a.tiles.length).forEach(r => {
      let el = labelEls[r.id];
      const show = showLabels && r.show && r.floor === vf;
      if (!show) { if (el) el.style.display = 'none'; return; }
      if (!el) { el = labelEls[r.id] = document.createElement('div'); el.className = 'lbl'; el.innerHTML = '<span></span><i><b></b></i>'; labelBox.appendChild(el); }
      const L = live.find(l => l.room === r.id);
      const name = (L ? '<img src="assets/emoji/' + L.emoji + '.svg" alt="">' : '') + r.name;
      // measure a label only when its text changes (reading its size every frame
      // makes the browser redo the page layout for each label, every frame)
      if (el._name !== name) { el.firstChild.innerHTML = name; el._name = name; el._w = 0; }
      if (!el._w) { el.style.display = ''; el._w = el.offsetWidth; el._h = el.offsetHeight; }
      const pt = V.project(r.cx - 0.5, vf * V.FLR_H + 0.1, r.cz - 0.5);
      // bigger rooms claim their spot first; a label that would cover another nudges
      // up or down, and hides if there's no room (zoom in to see it)
      const w = el._w || 80, h = el._h || 20;
      let y = null;
      for (const dy of [0, h + 2, -(h + 2)]) { if (fits(pt.x - w / 2, pt.y + dy - h / 2, w, h)) { y = pt.y + dy; break; } }
      if (pt.behind || y == null) { el.style.display = 'none'; return; }
      placed.push({ x: pt.x - w / 2, y: y - h / 2, w, h });
      el.style.display = '';
      el.style.left = pt.x + 'px'; el.style.top = y + 'px';
      const frac = Math.min(1, (occ[r.id] || 0) / r.cap);
      const bar = el.lastChild.firstChild;
      bar.style.width = (frac * 100).toFixed(0) + '%';
      bar.style.background = frac > 0.85 ? '#ff6b6b' : frac > 0.6 ? '#ffc857' : '#3ddc84';
    });
    // "!" over annoyed patrons
    let i = 0;
    agents.forEach(p => {
      if (!p.g.visible || !(p.flags & (4 | 16))) return;
      const pt = V.project(p.x, p.f * V.FLR_H + 1.9, p.z);
      let b = bangEls[i]; if (!b) { b = bangEls[i] = document.createElement('div'); b.className = 'bang'; b.textContent = '!'; labelBox.appendChild(b); }
      b.style.display = ''; b.style.left = pt.x + 'px'; b.style.top = pt.y + 'px'; b.style.color = (p.flags & 4) ? '#ff3b3b' : '#ff9a62';
      i++;
    });
    for (; i < bangEls.length; i++) bangEls[i].style.display = 'none';
  }

  // ---------------------------------------------------------------- doors
  // Mapster's doors are closed until someone opens them: open each one as a patron
  // comes near and close it again a moment after the last one has gone through.
  let doors = [], doorTimer = 0;
  function initDoors() {
    doors = (V.doors ? V.doors() : []).filter(d => !d.rope).map(d => ({
      i: d.i, f: d.f, open: d.open, lastNear: 0,
      x: d.x + (d.dir === 'e' ? 0.5 : d.dir === 'w' ? -0.5 : 0),
      z: d.z + (d.dir === 's' ? 0.5 : d.dir === 'n' ? -0.5 : 0),
    }));
  }
  function updateDoors(now) {
    doors.forEach(d => {
      let near = false;
      for (const p of agents.values()) {
        if (p.f !== d.f) continue;
        if (Math.abs(p.x - d.x) < 1.4 && Math.abs(p.z - d.z) < 1.4) { near = true; break; }
        // also anyone whose next steps go through this doorway
        if (p.q.some((pt, k) => k < 3 && pt.f === d.f && Math.abs(pt.x - d.x) < 0.8 && Math.abs(pt.z - d.z) < 0.8)) { near = true; break; }
      }
      if (near) d.lastNear = now;
      const want = near || now - d.lastNear < 1200;
      if (want !== d.open && V.setDoor(d.i, want)) d.open = want;
    });
  }

  // ---------------------------------------------------------------- per frame
  function onFrame(dt) {
    const now = performance.now();
    animatePeople(dt);
    doorTimer -= dt;
    if (doorTimer <= 0) { updateDoors(now); doorTimer = 0.1; }
    tintTimer -= dt;
    if (tintTimer <= 0) { drawTints(now); tintTimer = 1 / 15; }
    drawLabels();
  }

  // ---------------------------------------------------------------- pointer + keys back to the game
  function bindPointer() {
    const el = V.renderer.domElement;
    let lastHover = '';
    el.addEventListener('pointermove', e => {
      if (e.buttons) return;
      const t = V.pickTile(e.clientX, e.clientY);
      const k = t ? t.f + ',' + t.x + ',' + t.z : '';
      if (k !== lastHover || t) post({ t: 'hover', tile: t, x: e.clientX, y: e.clientY });
      lastHover = k;
    });
    el.addEventListener('pointerleave', () => { lastHover = ''; post({ t: 'hover', tile: null }); });
    el.addEventListener('click', e => {
      if (V.wasDrag()) return;
      post({ t: 'click', tile: V.pickTile(e.clientX, e.clientY), x: e.clientX, y: e.clientY });
    });
    el.addEventListener('contextmenu', e => {
      if (V.wasDrag()) return;
      post({ t: 'context', tile: V.pickTile(e.clientX, e.clientY), x: e.clientX, y: e.clientY });
    });
    el.addEventListener('wheel', () => post({ t: 'view', angle: V.angle(), tilt: V.tilt(), zoom: V.zoom() }), { passive: true });
  }
  document.addEventListener('keydown', e => {
    if (e.key === ' ' || /^[1-5]$/.test(e.key) || e.key === 'Escape') {
      if (e.key === ' ') e.preventDefault();
      post({ t: 'key', key: e.key });
    }
  });

  // same scale as the blueprint (js/facility-view.js)
  function noiseColor(n) {
    if (n < 0.1) return null;
    const t = Math.min(1, n / 2.5), mix = (a, b, k) => Math.round(a + (b - a) * k);
    const [r, g, b] = t < 0.5 ? [255, mix(220, 140, t * 2), mix(90, 50, t * 2)] : [mix(255, 225, t * 2 - 1), mix(140, 40, t * 2 - 1), mix(50, 40, t * 2 - 1)];
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (0.3 + 0.4 * t).toFixed(2) + ')';
  }
  function hexA(hex, a) {
    const h = hex.replace('#', ''), n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return 'rgba(' + parseInt(n.slice(0, 2), 16) + ',' + parseInt(n.slice(2, 4), 16) + ',' + parseInt(n.slice(4, 6), 16) + ',' + a + ')';
  }

  post({ t: 'ready' });
})();
