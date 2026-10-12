/**
 * Mapster — Fill & Wrap Tools
 * =====================================
 * A small modular system (loaded by mapster.html as a <script src>) that adds
 * two flood-based level-building tools:
 *
 *   FLOOR FILL  — from a clicked tile, flood-fills a 4-connected enclosed
 *                 region with the selected floor type + color(s). The flood
 *                 stops at any impassable boundary between two tiles: a wall,
 *                 door, counter, glass, archway, or a solid object/diagonal.
 *                 (i.e. it fills "the room you clicked in".)
 *
 *   WALL WRAP   — from a clicked tile, finds the connected floor region (the
 *                 same flood as above, but bounded by the floor extent rather
 *                 than walls) and places the selected wall type + color(s) on
 *                 every PERIMETER edge — each edge of a region tile that
 *                 borders a tile OUTSIDE the region (or the map edge).
 *
 * Because the editor declares its state with top-level `let` (which does NOT
 * attach to window in a classic script), this module does NOT reach into
 * globals. Instead the editor passes an explicit context object:
 *
 *   ctx = {
 *     grid,            // mapData[curFloor]  (2D array [y][x] of cells)
 *     W, H,            // grid dimensions
 *     tool,            // the floor/wall brush to paint ({n, v, ...})
 *     color, accent,   // primary + accent colors
 *     getDefaultMeta,  // fn(v, color) -> meta object
 *     onDone,          // optional fn(message) called after the op (render+toast)
 *   }
 *
 * Exposed API:
 *   window.MapsterFill.floodFillFloor(ctx, x, y)
 *   window.MapsterFill.wrapRegionWalls(ctx, x, y)
 *
 * mapster.html wires the "Fill" and "Wrap" tools to these in
 * handleCenterAction(). See ARCHITECTURE.md (v14) for integration notes.
 */
(function () {
    'use strict';

    const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
    const DELTA = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

    // Any built edge object present = boundary for a floor flood.
    function edgeBlocks(cell, dir) { return !!(cell && cell[dir]); }
    function diagBlocks(cell) { return !!(cell && (cell.d1 || cell.d2)); }
    function objectBlocks(cell) {
        const o = cell && cell.o;
        if (!o) return false;
        if (o.v === 'start' || o.v === 'warp_pad' || o.v === 'key') return false;
        const SOLID = ['solid_diag1', 'solid_diag2', 'counter', 'bench', 'trash', 'arcade', 'arcade_sit', 'standee', 'sign', 'dir'];
        if (o.meta && o.meta.solid) return true;
        return SOLID.includes(o.v);
    }

    function canCross(ctx, ax, ay, dir) {
        const [dx, dy] = DELTA[dir];
        const nx = ax + dx, ny = ay + dy;
        if (nx < 0 || ny < 0 || nx >= ctx.W || ny >= ctx.H) return false;
        const a = ctx.grid[ay][ax];
        const b = ctx.grid[ny][nx];
        if (edgeBlocks(a, dir)) return false;
        if (edgeBlocks(b, OPP[dir])) return false;
        if (diagBlocks(a) || diagBlocks(b)) return false;
        if (objectBlocks(b)) return false;
        return true;
    }

    // mode 'room'  → bounded by walls/doors/counters (FLOOR FILL)
    // mode 'floor' → only spreads onto tiles that currently have a floor (WALL WRAP)
    function collectRegion(ctx, sx, sy, mode) {
        const seen = new Set();
        const region = [];
        const key = (x, y) => y * ctx.W + x;
        if (mode === 'floor' && !(ctx.grid[sy][sx] && ctx.grid[sy][sx].f)) return region;
        const stack = [[sx, sy]];
        seen.add(key(sx, sy));
        while (stack.length) {
            const [x, y] = stack.pop();
            region.push([x, y]);
            for (const dir of ['n', 's', 'e', 'w']) {
                const [dx, dy] = DELTA[dir];
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= ctx.W || ny >= ctx.H) continue;
                if (seen.has(key(nx, ny))) continue;
                if (mode === 'floor') {
                    // WALL WRAP: spread across every contiguous FLOORED tile,
                    // regardless of existing walls between them (we're going to
                    // wall the OUTER perimeter of the whole floored region). Using
                    // canCross() here was the bug — it stopped the region at any
                    // pre-existing wall, so wrap placed almost nothing.
                    if (!(ctx.grid[ny][nx] && ctx.grid[ny][nx].f)) continue;
                } else {
                    // ROOM (floor fill): bounded by walls/doors/counters.
                    if (!canCross(ctx, x, y, dir)) continue;
                }
                seen.add(key(nx, ny));
                stack.push([nx, ny]);
            }
        }
        return region;
    }

    function floodFillFloor(ctx, sx, sy) {
        if (!ctx.grid || !ctx.grid[sy] || !ctx.grid[sy][sx]) return;
        if (!ctx.tool || ctx.tool.v == null) return;
        const region = collectRegion(ctx, sx, sy, 'room');
        if (region.length === 0) return;
        if (region.length > ctx.W * ctx.H) return; // safety cap
        let filled = 0;
        region.forEach(([x, y]) => {
            ctx.grid[y][x].f = {
                n: ctx.tool.n, type: 'f', v: ctx.tool.v,
                c: ctx.color, ac: ctx.accent,
                meta: ctx.getDefaultMeta(ctx.tool.v, ctx.color),
            };
            filled++;
        });
        if (ctx.onDone) ctx.onDone('Filled ' + filled + ' tile' + (filled === 1 ? '' : 's') + '.');
    }

    function wrapRegionWalls(ctx, sx, sy) {
        if (!ctx.grid || !ctx.grid[sy] || !ctx.grid[sy][sx]) return;
        if (!ctx.tool || ctx.tool.v == null) return;
        if (!(ctx.grid[sy][sx] && ctx.grid[sy][sx].f)) {
            if (ctx.onDone) ctx.onDone('Wrap: click a floored tile first.');
            return;
        }
        const region = collectRegion(ctx, sx, sy, 'floor');
        if (region.length === 0) return;
        const key = (x, y) => y * ctx.W + x;
        const inRegion = new Set(region.map(([x, y]) => key(x, y)));
        let placed = 0;
        region.forEach(([x, y]) => {
            for (const dir of ['n', 's', 'e', 'w']) {
                const [dx, dy] = DELTA[dir];
                const nx = x + dx, ny = y + dy;
                const neighborOut =
                    nx < 0 || ny < 0 || nx >= ctx.W || ny >= ctx.H ||
                    !inRegion.has(key(nx, ny));
                if (neighborOut) {
                    ctx.grid[y][x][dir] = {
                        n: ctx.tool.n, type: 'w', v: ctx.tool.v,
                        c: ctx.color, ac: ctx.accent,
                        meta: ctx.getDefaultMeta(ctx.tool.v, ctx.color),
                    };
                    placed++;
                }
            }
        });
        if (ctx.onDone) ctx.onDone('Wrapped ' + placed + ' wall segment' + (placed === 1 ? '' : 's') + '.');
    }

    window.MapsterFill = {
        floodFillFloor: floodFillFloor,
        wrapRegionWalls: wrapRegionWalls,
    };
})();
