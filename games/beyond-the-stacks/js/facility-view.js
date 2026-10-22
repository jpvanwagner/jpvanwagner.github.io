/* JS/FACILITY-VIEW.JS - Draws one floor of the Mapster map as a top-down blueprint on a
   <canvas>, plus everything live on it: room tints, programs in progress, the noise overlay
   and the patrons.

   The static drawing (floors, walls, furniture) is cached per floor and redrawn only when
   the canvas size or map changes. All floors share one frame (the union of their bounds), so
   switching floors keeps the stairs lined up; the floors above and below show as faint ghosts. */

window.FacilityView = (function () {
  const BP = {
    bg: '#0f2d52', grid: 'rgba(160,200,255,0.07)', gridMajor: 'rgba(160,200,255,0.13)',
    indoor: '#163d68', line: '#e6f0ff', glass: '#8fd8ff', door: '#ffd98a', staff: '#ff8a7a',
    counter: '#d9a066', label: '#ffffff', ghost: 'rgba(200,225,255,0.13)',
  };
  const BOOK_COLORS = ['#e4572e', '#f3a712', '#4cc9f0', '#a8e6cf', '#f4f1de', '#b388ff'];

  function create(canvas, getFac, getSim) {
    const ctx = canvas.getContext('2d');
    const view = { floor: 0, overlays: { noise: false, labels: true }, highlights: null, selectedRoom: null, hoverRoom: null, live: {}, images: {}, zoom: 1, panX: 0, panY: 0 };
    let cache = { key: '', canvas: null }, geom = null;

    // ---------------------------------------------------------------- geometry
    function computeGeom() {
      const fac = getFac();
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      }
      let x0 = Infinity, z0 = Infinity, x1 = 0, z1 = 0;
      fac.floors.forEach(f => { x0 = Math.min(x0, f.bounds.x0); z0 = Math.min(z0, f.bounds.z0); x1 = Math.max(x1, f.bounds.x1); z1 = Math.max(z1, f.bounds.z1); });
      const pad = 10;
      const ts = Math.max(4, Math.min((cw - pad * 2) / (x1 - x0), (ch - pad * 2) / (z1 - z0)));
      const ox = (cw - ts * (x1 - x0)) / 2 - x0 * ts, oz = (ch - ts * (z1 - z0)) / 2 - z0 * ts;
      // zoom around the canvas centre, then pan
      const z = view.zoom;
      geom = { dpr, cw, ch, ts: ts * z, ox: cw / 2 + (ox - cw / 2) * z + view.panX, oz: ch / 2 + (oz - ch / 2) * z + view.panY };
      return geom;
    }
    const X = (x) => geom.ox + x * geom.ts;
    const Z = (z) => geom.oz + z * geom.ts;

    view.roomAt = function (px, py) {
      if (!geom) return null;
      const fac = getFac();
      const x = Math.floor((px - geom.ox) / geom.ts), z = Math.floor((py - geom.oz) / geom.ts);
      if (x < 0 || z < 0 || x >= fac.W || z >= fac.H) return null;
      return fac.tileRoom[view.floor][z][x];
    };

    function emoji(code) {
      if (!view.images[code]) { const im = new Image(); im.src = 'assets/emoji/' + code + '.svg'; view.images[code] = im; }
      const im = view.images[code];
      return im.complete && im.naturalWidth ? im : null;
    }

    // ---------------------------------------------------------------- static layer
    function drawStatic(c, f) {
      const fac = getFac(), ts = geom.ts;
      c.fillStyle = BP.bg; c.fillRect(0, 0, geom.cw, geom.ch);
      // blueprint grid
      for (let x = Math.floor(-geom.ox / ts) - 1; X(x) < geom.cw; x++) {
        c.strokeStyle = x % 5 === 0 ? BP.gridMajor : BP.grid; c.lineWidth = 1;
        c.beginPath(); c.moveTo(Math.round(X(x)) + 0.5, 0); c.lineTo(Math.round(X(x)) + 0.5, geom.ch); c.stroke();
      }
      for (let z = Math.floor(-geom.oz / ts) - 1; Z(z) < geom.ch; z++) {
        c.strokeStyle = z % 5 === 0 ? BP.gridMajor : BP.grid; c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, Math.round(Z(z)) + 0.5); c.lineTo(geom.cw, Math.round(Z(z)) + 0.5); c.stroke();
      }
      // ghosts of the neighbouring floors
      [f - 1, f + 1].forEach(g => { if (g >= 0 && g < fac.floors.length) drawWalls(c, g, true); });

      // floor tiles
      for (let z = 0; z < fac.H; z++) for (let x = 0; x < fac.W; x++) {
        const cell = fac.cell(f, x, z); if (!cell || !cell.f) continue;
        const v = cell.f.v, room = fac.tileRoom[f][z][x], outdoor = !cell.c;
        const px = X(x), pz = Z(z);
        if (outdoor && v === 'grass') {
          c.fillStyle = 'rgba(70,140,100,0.28)'; c.fillRect(px, pz, ts, ts);
          c.fillStyle = 'rgba(160,220,170,0.35)';
          for (let i = 0; i < 3; i++) { const hx = ((x * 7 + z * 13 + i * 5) % 10) / 10, hz = ((x * 3 + z * 11 + i * 7) % 10) / 10; c.fillRect(px + hx * ts, pz + hz * ts, 1.5, 1.5); }
        } else if (outdoor && (v === 'concrete' || v === 'parking')) {
          c.fillStyle = 'rgba(5,20,40,0.55)'; c.fillRect(px, pz, ts, ts);
        } else if (outdoor) {
          c.fillStyle = 'rgba(120,170,220,0.14)'; c.fillRect(px, pz, ts, ts);
          c.strokeStyle = 'rgba(180,210,255,0.12)'; c.beginPath(); c.moveTo(px, pz + ts); c.lineTo(px + ts, pz); c.stroke();
        } else {
          c.fillStyle = BP.indoor; c.fillRect(px, pz, ts, ts);
        }
        if (room) { c.fillStyle = hexA(room.color, outdoor ? 0.07 : 0.16); c.fillRect(px, pz, ts, ts); }
        if (v === 'carpet' && !outdoor) { c.fillStyle = hexA(cell.f.ac || '#fff', 0.12); c.fillRect(px + ts * 0.15, pz + ts * 0.15, ts * 0.7, ts * 0.7); }
      }
      // parking stall lines: a Mapster Parking Stall tile has its line down its west edge
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1;
      for (let z = 0; z < fac.H; z++) for (let x = 0; x < fac.W; x++) {
        const cell = fac.cell(f, x, z); if (!cell || !cell.f || cell.c || cell.f.v !== 'parking') continue;
        c.beginPath(); c.moveTo(X(x) + 0.5, Z(z)); c.lineTo(X(x) + 0.5, Z(z) + ts); c.stroke();
      }
      drawWalls(c, f, false);
      drawObjects(c, f);
    }

    function drawWalls(c, f, ghost) {
      const fac = getFac(), ts = geom.ts;
      for (let z = 0; z < fac.H; z++) for (let x = 0; x < fac.W; x++) {
        const cell = fac.cell(f, x, z); if (!cell) continue;
        ['n', 's', 'e', 'w'].forEach(d => {
          const el = cell[d]; if (!el) return;
          let ax, az, bx, bz;
          if (d === 'n') { ax = X(x); az = Z(z); bx = X(x + 1); bz = az; }
          if (d === 's') { ax = X(x); az = Z(z + 1); bx = X(x + 1); bz = az; }
          if (d === 'w') { ax = X(x); az = Z(z); bx = ax; bz = Z(z + 1); }
          if (d === 'e') { ax = X(x + 1); az = Z(z); bx = ax; bz = Z(z + 1); }
          if (ghost) { c.strokeStyle = BP.ghost; c.lineWidth = 1; c.setLineDash([3, 3]); line(c, ax, az, bx, bz); c.setLineDash([]); return; }
          drawEdge(c, el, ax, az, bx, bz, d, fac.tileRoom[f][z][x]);
        });
      }
    }

    function drawEdge(c, el, ax, az, bx, bz, d, room) {
      const kind = LibraryMap.kindOf(el), ts = geom.ts, horiz = az === bz;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      c.lineCap = 'round';
      if (kind === 'wall') {
        c.strokeStyle = BP.line; c.lineWidth = el.v === 'brick' || el.v === 'stone' ? Math.max(2.5, ts * 0.16) : Math.max(1.8, ts * 0.1);
        line(c, ax, az, bx, bz);
      } else if (kind === 'window') {
        c.strokeStyle = BP.line; c.lineWidth = Math.max(2.5, ts * 0.16); line(c, ax, az, bx, bz);
        c.strokeStyle = BP.glass; c.lineWidth = Math.max(1, ts * 0.06);
        if (horiz) line(c, ax + ts * 0.2, az, bx - ts * 0.2, bz); else line(c, ax, az + ts * 0.2, bx, bz - ts * 0.2);
      } else if (kind === 'glass') {
        c.strokeStyle = BP.glass; c.lineWidth = 1;
        const o = Math.max(1, ts * 0.05);
        if (horiz) { line(c, ax, az - o, bx, bz - o); line(c, ax, az + o, bx, bz + o); } else { line(c, ax - o, az, bx - o, bz); line(c, ax + o, az, bx + o, bz); }
      } else if (kind === 'door' || kind === 'staffdoor') {
        const col = kind === 'staffdoor' ? BP.staff : BP.door;
        c.strokeStyle = BP.line; c.lineWidth = Math.max(1.8, ts * 0.1);
        if (horiz) { line(c, ax, az, ax + ts * 0.08, az); line(c, bx - ts * 0.08, bz, bx, bz); } else { line(c, ax, az, ax, az + ts * 0.08); line(c, bx, bz - ts * 0.08, bx, bz); }
        c.strokeStyle = col; c.lineWidth = Math.max(1, ts * 0.06);
        if (el.v === 'door_slide') { c.setLineDash([ts * 0.15, ts * 0.1]); line(c, ax, az, bx, bz); c.setLineDash([]); }
        else {
          // a swing door: leaf + quarter arc
          const r = ts * 0.84;
          c.beginPath();
          if (horiz) { c.moveTo(ax + ts * 0.08, az); c.lineTo(ax + ts * 0.08, az - r); c.stroke(); c.beginPath(); c.arc(ax + ts * 0.08, az, r, -Math.PI / 2, 0); }
          else { c.moveTo(ax, az + ts * 0.08); c.lineTo(ax + r, az + ts * 0.08); c.stroke(); c.beginPath(); c.arc(ax, az + ts * 0.08, r, 0, Math.PI / 2); }
          c.globalAlpha = 0.5; c.stroke(); c.globalAlpha = 1;
        }
        if (kind === 'staffdoor') { c.fillStyle = BP.staff; c.beginPath(); c.arc(mx, mz, Math.max(1.5, ts * 0.1), 0, Math.PI * 2); c.fill(); }
      } else if (kind === 'arch') {
        c.strokeStyle = BP.line; c.lineWidth = Math.max(1.5, ts * 0.08);
        if (horiz) { line(c, ax, az - ts * 0.15, ax, az + ts * 0.15); line(c, bx, bz - ts * 0.15, bx, bz + ts * 0.15); }
        else { line(c, ax - ts * 0.15, az, ax + ts * 0.15, az); line(c, bx - ts * 0.15, bz, bx + ts * 0.15, bz); }
      } else if (kind === 'counter' || kind === 'counterdoor') {
        const shelving = !(room && room.id === 'entry');
        c.strokeStyle = BP.counter; c.lineWidth = Math.max(3, ts * 0.22);
        if (kind === 'counterdoor') c.setLineDash([ts * 0.12, ts * 0.12]);
        line(c, ax, az, bx, bz); c.setLineDash([]);
        if (shelving && ts >= 9) {   // book spines along a shelf
          const n = 5;
          for (let i = 0; i < n; i++) {
            c.strokeStyle = BOOK_COLORS[(i + Math.round(ax + az)) % BOOK_COLORS.length]; c.lineWidth = 1;
            const t = (i + 0.5) / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t, h = ts * 0.1;
            if (horiz) line(c, px, pz - h, px, pz + h); else line(c, px - h, pz, px + h, pz);
          }
        }
      } else if (kind === 'rope') {
        c.strokeStyle = '#facc15'; c.lineWidth = 1.5; c.setLineDash([2, 3]); line(c, ax, az, bx, bz); c.setLineDash([]);
      }
    }

    function drawObjects(c, f) {
      const fac = getFac(), ts = geom.ts;
      for (let z = 0; z < fac.H; z++) for (let x = 0; x < fac.W; x++) {
        const cell = fac.cell(f, x, z); if (!cell || !cell.o) continue;
        const o = cell.o, cx = X(x + 0.5), cz = Z(z + 0.5), m = o.meta || {};
        c.lineWidth = 1; c.strokeStyle = BP.line;
        switch (o.v) {
          case 'bench': c.fillStyle = 'rgba(230,240,255,0.10)'; rect(c, cx - ts * 0.32, cz - ts * 0.22, ts * 0.64, ts * 0.44, true); break;
          case 'arcade_sit':
            c.fillStyle = 'rgba(143,216,255,0.55)'; rect(c, cx - ts * 0.25, cz - ts * 0.32, ts * 0.5, ts * 0.22, true);
            c.beginPath(); c.arc(cx, cz + ts * 0.18, ts * 0.13, 0, Math.PI * 2); c.stroke(); break;
          case 'arcade': c.fillStyle = hexA(o.c || '#7c3aed', 0.6); rect(c, cx - ts * 0.3, cz - ts * 0.3, ts * 0.6, ts * 0.6, true); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cz, ts * 0.08, 0, Math.PI * 2); c.fill(); break;
          case 'car': {
            const vert = !m.carDir || m.carDir === 'n' || m.carDir === 's';
            const w = vert ? ts * 0.62 : ts * 0.95, h = vert ? ts * 0.95 : ts * 0.62;
            c.fillStyle = hexA(o.c || '#888', 0.55); roundRect(c, cx - w / 2, cz - h / 2, w, h, ts * 0.14); c.fill(); c.stroke();
            c.strokeStyle = 'rgba(255,255,255,0.6)';
            const fwd = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[m.carDir || 'n'];
            const wx = cx + fwd[0] * (vert ? 0 : w * 0.2), wz = cz + fwd[1] * (vert ? h * 0.2 : 0);
            if (vert) line(c, wx - w * 0.35, wz, wx + w * 0.35, wz); else line(c, wx, wz - h * 0.35, wx, wz + h * 0.35);
            break;
          }
          case 'trash': c.beginPath(); c.arc(cx, cz, ts * 0.16, 0, Math.PI * 2); c.stroke(); break;
          case 'box': case 'crate': c.fillStyle = 'rgba(214,170,110,0.45)'; rect(c, cx - ts * 0.3, cz - ts * 0.3, ts * 0.6, ts * 0.6, true); line(c, cx - ts * 0.3, cz - ts * 0.3, cx + ts * 0.3, cz + ts * 0.3); line(c, cx + ts * 0.3, cz - ts * 0.3, cx - ts * 0.3, cz + ts * 0.3); break;
          case 'sign': c.fillStyle = '#ffd98a'; rect(c, cx - ts * 0.28, cz - ts * 0.2, ts * 0.56, ts * 0.28, true); line(c, cx, cz + ts * 0.08, cx, cz + ts * 0.3); break;
          case 'dir': c.fillStyle = 'rgba(143,216,255,0.4)'; rect(c, cx - ts * 0.25, cz - ts * 0.3, ts * 0.5, ts * 0.6, true); line(c, cx, cz - ts * 0.3, cx, cz + ts * 0.3); break;
          case 'standee': c.fillStyle = hexA(o.c || '#facc15', 0.6); c.beginPath(); c.moveTo(cx, cz - ts * 0.3); c.lineTo(cx + ts * 0.26, cz + ts * 0.22); c.lineTo(cx - ts * 0.26, cz + ts * 0.22); c.closePath(); c.fill(); c.stroke(); break;
          case 'stairs': case 'ladder': {
            c.strokeStyle = BP.line;
            for (let i = 0; i < 5; i++) { const t = -0.4 + i * 0.2; line(c, cx - ts * 0.4, cz + t * ts, cx + ts * 0.4, cz + t * ts); }
            const others = (fac.stairLinks[fac.key(f, x, z)] || []).map(t => fac.floors[t.f].name).join('/');
            if (others && ts >= 10) tag(c, cx, cz + ts * 0.85, '⇅ ' + others, '#ffd98a');
            break;
          }
          case 'elevator': {
            c.fillStyle = 'rgba(200,215,230,0.35)'; rect(c, cx - ts * 0.4, cz - ts * 0.4, ts * 0.8, ts * 0.8, true);
            line(c, cx - ts * 0.4, cz - ts * 0.4, cx + ts * 0.4, cz + ts * 0.4); line(c, cx + ts * 0.4, cz - ts * 0.4, cx - ts * 0.4, cz + ts * 0.4);
            if (ts >= 10) tag(c, cx, cz + ts * 0.85, 'Elevator', '#cfe3ff');
            break;
          }
          case 'start':
            c.fillStyle = '#ff8fab'; c.beginPath(); c.moveTo(cx, cz - ts * 0.4); c.lineTo(cx + ts * 0.3, cz + ts * 0.2); c.lineTo(cx - ts * 0.3, cz + ts * 0.2); c.closePath(); c.fill();
            if (ts >= 10) tag(c, cx, cz + ts * 0.8, 'Arrivals', '#ff8fab');
            break;
          case 'warp_point':
            c.fillStyle = '#7ee0b5'; c.beginPath(); c.arc(cx, cz, ts * 0.3, 0, Math.PI * 2); c.fill();
            if (ts >= 10) tag(c, cx, cz + ts * 0.85, m.warpPointName || 'Arrivals', '#7ee0b5');
            break;
          default: break;
        }
      }
    }

    // ---------------------------------------------------------------- live layer
    view.render = function (t) {
      const fac = getFac(), sim = getSim(); if (!fac) return;
      computeGeom();
      if (!canvas.width || !canvas.height) return;   // the map panel is folded away
      const f = view.floor, ts = geom.ts;
      const key = [fac.name, fac.W, fac.H, f, geom.cw, geom.ch, geom.dpr, view.mapVersion || 0, view.zoom.toFixed(3), Math.round(view.panX), Math.round(view.panY)].join('|');
      if (cache.key !== key) {
        cache.canvas = cache.canvas || document.createElement('canvas');
        cache.canvas.width = canvas.width; cache.canvas.height = canvas.height;
        const cc = cache.canvas.getContext('2d');
        cc.setTransform(geom.dpr, 0, 0, geom.dpr, 0, 0);
        drawStatic(cc, f); cache.key = key;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(cache.canvas, 0, 0);
      ctx.setTransform(geom.dpr, 0, 0, geom.dpr, 0, 0);

      const rooms = Object.values(fac.rooms);
      // planning highlights (room picker)
      if (view.highlights) {
        rooms.forEach(r => {
          const tone = view.highlights[r.id]; if (!tone) return;
          const col = { good: '#3ddc84', ok: '#ffc857', bad: '#ff6b6b', booked: '#8892a6' }[tone] || '#fff';
          const sel = view.selectedRoom === r.id;
          r.tiles.forEach(tl => { if (tl.f !== f) return; ctx.fillStyle = hexA(col, sel ? 0.45 : 0.22); ctx.fillRect(X(tl.x), Z(tl.z), ts, ts); });
          if (sel) outlineRoom(r, f, '#ffffff', 2.5);
        });
      }
      // noise
      if (view.overlays.noise && sim) {
        const nf = sim.noise[f];
        for (let z = 0; z < fac.H; z++) for (let x = 0; x < fac.W; x++) {
          const col = noiseColor(nf[z * fac.W + x]); if (!col) continue;
          ctx.fillStyle = col; ctx.fillRect(X(x), Z(z), ts, ts);
        }
      }
      // programs in progress: pulsing outline + sound rings
      Object.values(view.live).forEach(L => {
        const r = fac.rooms[L.room]; if (!r || r.floor !== f) return;
        const pulse = 0.5 + 0.5 * Math.sin(t / 300);
        outlineRoom(r, f, hexA(r.color, 0.55 + 0.45 * pulse), 2 + pulse * 1.5);
        if (L.noise > 0) {
          const cx = X(r.centroid.x), cz = Z(r.centroid.z);
          for (let i = 0; i < L.noise; i++) {
            const ph = ((t / 1400) + i / L.noise) % 1;
            ctx.strokeStyle = hexA(r.soundproof ? '#8fd8ff' : '#ff9a62', (1 - ph) * 0.6); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(cx, cz, ts * (0.6 + ph * (r.soundproof ? 1.6 : 3.2)), 0, Math.PI * 2); ctx.stroke();
          }
        }
      });
      rooms.forEach(r => {
        if (!r._flash || r.floor !== f) return;
        const age = (t - r._flash) / 1000;
        if (age > 1.5) { r._flash = 0; return; }
        outlineRoom(r, f, 'rgba(255,70,70,' + (1 - age / 1.5).toFixed(2) + ')', 3);
      });
      if (view.hoverRoom && view.hoverRoom.floor === f) outlineRoom(view.hoverRoom, f, 'rgba(255,255,255,0.6)', 1.5);

      // staff
      fac.staff.forEach(s => {
        if (s.f !== f) return;
        const cx = X(s.x + 0.5), cz = Z(s.z + 0.5), im = emoji('1f9d1-200d-1f4bc');
        ctx.fillStyle = '#0f2d52'; ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cz, ts * 0.38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (im) ctx.drawImage(im, cx - ts * 0.3, cz - ts * 0.3, ts * 0.6, ts * 0.6);
      });

      // patrons
      if (sim) {
        const r0 = Math.max(2.8, ts * 0.22);
        sim.agents.forEach(a => {
          if (a.f !== f) return;
          const info = GameData.DEMOGRAPHICS[a.demo];
          const px = X(a.x + a.jx), pz = Z(a.z + a.jz);
          ctx.globalAlpha = a.state === 'leaving' ? 0.55 : 1;
          if (info.withCaregiver) { ctx.fillStyle = GameData.DEMOGRAPHICS.adults.color; dot(px + r0 * 1.1, pz - r0 * 0.6, r0 * 0.9, a.overflow); }
          ctx.fillStyle = a.overflow ? '#8892a6' : info.color;
          dot(px, pz, r0, a.kind === 'event' && !a.overflow);
          if (a.angry || a.mood < -0.3) {
            ctx.fillStyle = a.angry ? '#ff3b3b' : '#ff9a62';
            ctx.font = 'bold ' + Math.max(8, r0 * 2.4) + 'px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('!', px, pz - r0 * 1.4);
          }
          ctx.globalAlpha = 1;
        });
      }

      // room labels + occupancy bars
      if (view.overlays.labels) {
        rooms.forEach(r => {
          if (r.floor !== f || r.isUtility || r.tags.includes('transit')) return;
          const occ = sim ? sim.occupancyOf(r.id) : 0;
          const cx = X(r.centroid.x), cz = Z(r.centroid.z);
          const fs = Math.max(9, Math.min(15, ts * 0.62));
          ctx.font = fs + 'px "Special Elite", "Atkinson Hyperlegible", sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const label = shortName(r, ts);
          const w = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(10,30,58,0.72)'; roundRect(ctx, cx - w / 2 - 5, cz - fs * 0.75, w + 10, fs * 1.5 + 7, 4); ctx.fill();
          ctx.fillStyle = BP.label; ctx.fillText(label, cx, cz - 1);
          const live = Object.values(view.live).find(L => L.room === r.id);
          if (live && live.emoji) { const im = emoji(live.emoji); if (im) ctx.drawImage(im, cx - w / 2 - fs * 1.35, cz - fs * 0.6, fs * 1.2, fs * 1.2); }
          // capacity bar
          const bw = Math.max(w, 26), frac = Math.min(1, occ / r.capacity);
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(cx - bw / 2, cz + fs * 0.55, bw, 3);
          ctx.fillStyle = frac > 0.85 ? '#ff6b6b' : frac > 0.6 ? '#ffc857' : '#3ddc84';
          ctx.fillRect(cx - bw / 2, cz + fs * 0.55, bw * frac, 3);
        });
      }
    };

    function shortName(r, ts) {
      if (ts >= 17) return r.name;
      return r.name.replace(' & Circ Desk', '').replace(' & Magazines', '').replace(' & Parking', '').replace("'s Section", "'s").replace('Quiet Study Rooms', 'Study Rooms');
    }

    function outlineRoom(r, f, color, width) {
      const fac = getFac(), set = new Set(r.tiles.filter(t => t.f === f).map(t => t.x + ',' + t.z));
      ctx.strokeStyle = color; ctx.lineWidth = width;
      r.tiles.forEach(t => {
        if (t.f !== f) return;
        if (!set.has(t.x + ',' + (t.z - 1))) line(ctx, X(t.x), Z(t.z), X(t.x + 1), Z(t.z));
        if (!set.has(t.x + ',' + (t.z + 1))) line(ctx, X(t.x), Z(t.z + 1), X(t.x + 1), Z(t.z + 1));
        if (!set.has((t.x - 1) + ',' + t.z)) line(ctx, X(t.x), Z(t.z), X(t.x), Z(t.z + 1));
        if (!set.has((t.x + 1) + ',' + t.z)) line(ctx, X(t.x + 1), Z(t.z), X(t.x + 1), Z(t.z + 1));
      });
    }

    // ---------------------------------------------------------------- tiny helpers
    function dot(x, z, r, ring) {
      ctx.beginPath(); ctx.arc(x, z, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ring ? '#ffffff' : 'rgba(5,20,40,0.8)'; ctx.lineWidth = ring ? 1.4 : 1; ctx.stroke();
    }
    function line(c, ax, az, bx, bz) { c.beginPath(); c.moveTo(ax, az); c.lineTo(bx, bz); c.stroke(); }
    function rect(c, x, z, w, h, fill) { if (fill) c.fillRect(x, z, w, h); c.strokeRect(x, z, w, h); }
    function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function tag(c, x, z, text, color) {
      c.font = '10px "Atkinson Hyperlegible", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = c.measureText(text).width;
      c.fillStyle = 'rgba(10,30,58,0.8)'; c.fillRect(x - w / 2 - 3, z - 6, w + 6, 12);
      c.fillStyle = color; c.fillText(text, x, z);
    }
    // noise level -> overlay colour: pale yellow murmur, orange noisy, red loud (null = quiet)
  function noiseColor(n) {
    if (n < 0.1) return null;
    const t = Math.min(1, n / 2.5), mix = (a, b, k) => Math.round(a + (b - a) * k);
    const [r, g, b] = t < 0.5 ? [255, mix(220, 140, t * 2), mix(90, 50, t * 2)] : [mix(255, 225, t * 2 - 1), mix(140, 40, t * 2 - 1), mix(50, 40, t * 2 - 1)];
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (0.22 + 0.38 * t).toFixed(2) + ')';
  }
  function hexA(hex, a) {
      const h = hex.replace('#', ''); const n = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h;
      return 'rgba(' + parseInt(n.slice(0, 2), 16) + ',' + parseInt(n.slice(2, 4), 16) + ',' + parseInt(n.slice(4, 6), 16) + ',' + a + ')';
    }
    view.invalidate = function () { cache.key = ''; };
    // keep the point under (px, py) still while zooming
    view.zoomAt = function (px, py, factor) {
      const nz = Math.max(1, Math.min(5, view.zoom * factor)), k = nz / view.zoom;
      if (!geom) { view.zoom = nz; return; }
      view.panX = (px - geom.cw / 2) - (px - geom.cw / 2 - view.panX) * k;
      view.panY = (py - geom.ch / 2) - (py - geom.ch / 2 - view.panY) * k;
      view.zoom = nz;
      if (nz === 1) { view.panX = 0; view.panY = 0; }
    };
    view.panBy = function (dx, dy) { if (view.zoom > 1) { view.panX += dx; view.panY += dy; } };
    view.resetZoom = function () { view.zoom = 1; view.panX = 0; view.panY = 0; };
    return view;
  }

  return { create };
})();
