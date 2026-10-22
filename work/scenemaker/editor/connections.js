/**
 * Scenemaker; Connection & Routing Engine
 * ========================================
 * Draws the SVG "wires" that connect a scene's CHOICE output ports to another
 * scene's INPUT port. Two rendering styles: classic Bezier curves and Smart
 * Orthogonal 90-degree routing that steps around scene boxes. Also owns the
 * live temp-wire that follows the cursor while dragging, plus the port
 * connect / disconnect interactions.
 *
 * This module is deliberately project-agnostic: it reaches into NO globals and
 * knows nothing about visual novels, media, or SCORM. The host page hands it a
 * small context object once at startup:
 *
 *   SceneConnections.init({
 *     getNodes:        () => scenes,                 // the live scenes map
 *     getSettings:     () => globalSettings,         // { useSmartRouting, ... }
 *     getZoom:         () => zoomLevel,              // current zoom factor
 *     svgLayer, zoomLayer,                           // the SVG + transform layers
 *     svgLayerActive,                                // optional: see #8 below
 *     getLogicalCoords:(e) => ({x, y}),              // screen -> canvas coords
 *     setDrawing:      (fromObjOrNull) => {},        // host sets its drag source
 *     getDrawing:      () => drawingFrom | null,     // host's current drag source
 *     onChanged:       () => renderScenes(),         // re-render after a wiring change
 *   })
 *
 * HOW TO MODIFY: the data shape it expects is
 *   scene = { id, x, y, collapsed, choices: [ { id, outcomes: [ { id, targetNode, type } ] } ] }
 * Every choice carries an `outcomes` array; a plain "Continue" choice simply has
 * a single outcome. `type` ('default' | 'success' | 'failure') only tints the
 * wire colour (see appendPathToSvg + the .connection.* CSS in editor.html).
 */
(function () {
    'use strict';

    let ctx = null;

    function init(context) { ctx = context; }

    // -- helpers -------------------------------------------------------------
    function nodes()    { return ctx.getNodes(); }
    function groups()   { return ctx.getGroups ? ctx.getGroups() : null; }
    // If a node lives in a COLLAPSED group, its own box is hidden; connections
    // should route to the collapsed group box instead of the member's stale x/y. (#6)
    function collapsedGroupOf(node){
        const gs = groups(); if (!gs || !node || !node.group) return null;
        const g = gs[node.group]; return (g && g.collapsed) ? g : null;
    }
    // #74: if source and target both live inside the SAME collapsed group,
    // both ends resolve to that one group box's own dot (see collapsedGroupOf
    // above), so the "line" would just loop from the box back to itself -
    // pure visual noise pointing nowhere useful. Only suppress it when the
    // group is actually collapsed; expanded, both scenes render for real and
    // the link is worth seeing.
    function inSameCollapsedGroup(sourceNode, targetNode){
        const cg = collapsedGroupOf(sourceNode);
        return !!(cg && collapsedGroupOf(targetNode) === cg);
    }
    function settings() { return ctx.getSettings(); }
    function zoom()     { return ctx.getZoom(); }

    // Logical (on-canvas) coordinate of an output port. Collapsed scenes expose
    // one port on their right edge; expanded scenes use the per-outcome port.
    // Logical position of an element relative to the (unscaled) zoom layer.
    // Uses offsetLeft/offsetTop, which layout defines and CSS transforms never
    // touch; so these coordinates are correct even mid zoom-animation and at
    // any zoom level, unlike getBoundingClientRect (which returns scaled screen
    // pixels and was the source of the zoom-breaks-connectors bug).
    function logicalPos(el){
        let x=0, y=0, node=el;
        while(node && node!==ctx.zoomLayer){ x+=node.offsetLeft; y+=node.offsetTop; node=node.offsetParent; }
        return { x, y };
    }
    // #8: a collapsed scene still renders a REAL port dot (out-collapsed-<id>,
    // and the SAME in-<id> element every scene always has, just with an added
    // .collapsed-in/out CSS class) - it used to only be measured against the
    // live DOM when the scene was expanded, and fall back to a hardcoded
    // guess (node.x+420, node.y+20) otherwise, which doesn't match where
    // .collapsed-in/out's own CSS (left:-8px/right:-8px, top:12px) actually
    // renders the dot. That guess is exactly why a wire into or out of a
    // collapsed scene looked like it landed slightly off the dot instead of
    // cleanly on it. Measuring the real element whenever it exists (falling
    // back to the guess only if it's truly missing, e.g. mid re-render) fixes
    // both directions the same way the expanded case already worked.
    function outPortXY(sourceNode, outcomeId) {
        const cgO = collapsedGroupOf(sourceNode);
        if (cgO) return { x: cgO.x + (cgO.w || 220), y: cgO.y + 20 }; // #6 exit collapsed group box
        const outP = document.getElementById(sourceNode.collapsed ? `out-collapsed-${sourceNode.id}` : `out-${outcomeId}`);
        if (outP && outP.offsetParent) {          // visible port
            const p = logicalPos(outP);
            return { x: p.x + (outP.offsetWidth || 16) / 2, y: p.y + (outP.offsetHeight || 16) / 2 };
        }                                          // hidden (collapsed group) or missing: fall through
        return { x: sourceNode.x + 420, y: sourceNode.y + 20 };
    }

    // Logical coordinate of a scene's input port.
    function inPortXY(targetNode) {
        const cgI = collapsedGroupOf(targetNode);
        if (cgI) return { x: cgI.x, y: cgI.y + 20 }; // #6 enter collapsed group box
        const inP = document.getElementById(`in-${targetNode.id}`); // exists collapsed or not
        if (inP && inP.offsetParent) {
            const p = logicalPos(inP);
            return { x: p.x + (inP.offsetWidth || 16) / 2, y: p.y + (inP.offsetHeight || 16) / 2 };
        }
        return { x: targetNode.x, y: targetNode.y + 20 };
    }

    // -- transition indicator (#83) -------------------------------------------
    // A small clickable ⇄ badge at each real connection's midpoint, letting an
    // author set a scene-out/scene-in (or one combined) effect for THAT one
    // link. Host-agnostic like the rest of this file: it only fires
    // ctx.onTransitionClick(sourceId, choiceId, outcomeId, event) and reads
    // o.transition for the has-one-set indicator style; the actual popover UI
    // and data mutation live entirely in the host (scene-transitions.js).
    function transLayerEl() {
        let l = ctx.zoomLayer.querySelector('#trans-layer');
        if (!l) { l = document.createElement('div'); l.id = 'trans-layer'; ctx.zoomLayer.appendChild(l); }
        return l;
    }
    function renderTransitionIndicator(sourceNode, choice, outcome, pathEl) {
        if (!ctx.onTransitionClick) return;
        const targetNode = nodes()[outcome.targetNode]; if (!targetNode) return;
        const a = outPortXY(sourceNode, outcome.id), b = inPortXY(targetNode);
        if (!a || !b) return;
        // The straight-line midpoint between two ports is only where the
        // visible line actually passes for a Bezier curve. Smart Orthogonal
        // routing can detour well away from that straight line to step
        // around an obstacle (see drawOrthogonal), so that same midpoint
        // formula could land the badge floating in empty space, or
        // overlapping a totally unrelated scene it happened to route
        // around - looking like the WIRING itself had gone somewhere odd,
        // when it was really just this badge sitting off of it. Measuring
        // the actual rendered path's own midpoint keeps the badge on the
        // line no matter how it's routed; environments without SVG
        // geometry support (older browsers, jsdom in tests) fall back to
        // the straight-line average, same as before this fix.
        let mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (pathEl && typeof pathEl.getTotalLength === 'function') {
            try {
                const len = pathEl.getTotalLength();
                if (len > 0) { const p = pathEl.getPointAtLength(len / 2); mid = { x: p.x, y: p.y }; }
            } catch (e) { /* SVG geometry unavailable; keep the straight-line fallback above */ }
        }
        const el = document.createElement('div');
        const has = !!(outcome.transition && outcome.transition.mode);
        el.className = 'trans-indicator' + (has ? ' set' : '');
        el.style.left = mid.x + 'px'; el.style.top = mid.y + 'px';
        el.textContent = '⇄';
        el.title = has ? 'Scene transition set; click to edit' : 'Add a scene transition';
        el.onclick = (e) => { e.stopPropagation(); ctx.onTransitionClick(sourceNode.id, choice.id, outcome.id, e); };
        transLayerEl().appendChild(el);
    }

    // -- rendering: all saved connections ------------------------------------
    // #7: whether a connection line passing behind an unrelated scene box gets
    // its overlapping stretch rendered dotted/faded, so it doesn't obstruct
    // that scene's own content. Workspace-level (per computer), default ON.
    function occludeFadeOn() { return (typeof ToolSettings === 'undefined') || ToolSettings.get('fadeOccludedLines', '1') === '1'; }

    function renderLines() {
        ctx.svgLayer.innerHTML = '';
        // #8: the extra elevated layer an active line's own visible stretches
        // draw into - see the z-index comment in editor.html next to
        // #svg-layer-active.
        if (ctx.svgLayerActive) ctx.svgLayerActive.innerHTML = '';
        transLayerEl().innerHTML = '';
        const nodeBoxes = [];
        const smart = settings().useSmartRouting;
        if (smart) {
            Object.values(nodes()).forEach(n => {
                const el = document.getElementById(n.id);
                if (el) nodeBoxes.push({ left: n.x - 20, right: n.x + el.offsetWidth + 20, top: n.y - 20, bottom: n.y + el.offsetHeight + 20 });
            });
        }
        // #7: real (unpadded) scene boxes to test line samples against; only
        // built when the fade is on, so the feature is free when disabled.
        const sceneBoxes = occludeFadeOn() ? Object.values(nodes()).map(n => {
            const el = document.getElementById(n.id);
            return el ? { id: n.id, left: n.x, right: n.x + el.offsetWidth, top: n.y, bottom: n.y + el.offsetHeight } : null;
        }).filter(Boolean) : [];
        // A selected scene's own wires (in either direction) render slightly
        // more prominent, so it's easy to trace what a busy graph's currently-
        // selected scene actually connects to at a glance.
        const selId = ctx.getSelectedNode ? ctx.getSelectedNode() : null;
        // #7: shared per-render-pass counter so drawOrthogonal can fan out any
        // detour row/column that 3+ separate wires would otherwise trace
        // pixel-for-pixel; reset every render since which wires collide
        // depends on the current layout.
        const laneMap = smart ? new Map() : null;
        Object.values(nodes()).forEach(n => {
            (n.choices || []).forEach(c => {
                (c.outcomes || []).forEach(o => {
                    if (o.targetNode && nodes()[o.targetNode]) {
                        if (inSameCollapsedGroup(n, nodes()[o.targetNode])) return; // #74
                        const active = !!selId && (n.id === selId || o.targetNode === selId);
                        const pathEl = smart ? drawPathfindingLine(n, o, false, o.type, nodeBoxes, sceneBoxes, active, laneMap) : drawBezierFromPorts(n, o, false, o.type, sceneBoxes, active);
                        renderTransitionIndicator(n, c, o, pathEl); // #83
                    }
                });
                // variable-branch routes (#4): dashed wire from the choice's default
                // port to each route target, so branching is visible on the graph.
                (c.routes || []).forEach(r => {
                    const base = c.outcomes && c.outcomes[0];
                    if (r.target && nodes()[r.target] && base) {
                        if (inSameCollapsedGroup(n, nodes()[r.target])) return; // #74
                        const a = outPortXY(n, base.id); const b = inPortXY(nodes()[r.target]);
                        const active = !!selId && (n.id === selId || r.target === selId);
                        if (a && b) { if (smart) drawOrthogonal(a.x, a.y, b.x, b.y, false, 'route', nodeBoxes, sceneBoxes, active, laneMap); else drawBezier(a.x, a.y, b.x, b.y, false, 'route', sceneBoxes, active); }
                    }
                });
            });
        });
    }

    // -- rendering: live drag wire -------------------------------------------
    function drawTempLine(e) {
        renderLines();
        const drawingFrom = ctx.getDrawing();
        if (!drawingFrom) return;
        const sourceNode = nodes()[drawingFrom.nodeId];
        if (!sourceNode) return;
        const choice = sourceNode.choices.find(c => c.id === drawingFrom.choiceId);
        const outcome = choice && choice.outcomes.find(o => o.id === drawingFrom.outcomeId);
        if (!outcome) return;

        const p = outPortXY(sourceNode, drawingFrom.outcomeId);
        if (!p) return;
        const eCoords = ctx.getLogicalCoords(e);
        if (settings().useSmartRouting) drawOrthogonal(p.x, p.y, eCoords.x, eCoords.y, true, outcome.type, []);
        else drawBezier(p.x, p.y, eCoords.x, eCoords.y, true, outcome.type);
    }

    // -- Smart Orthogonal routing --------------------------------------------
    function drawPathfindingLine(sourceNode, outcome, isTemp, type, nodeBoxes, sceneBoxes, active, laneMap) {
        const targetNode = nodes()[outcome.targetNode]; if (!targetNode) return null;
        const a = outPortXY(sourceNode, outcome.id); if (!a) return null;
        const b = inPortXY(targetNode); if (!b) return null;
        return drawOrthogonal(a.x, a.y, b.x, b.y, isTemp, type, nodeBoxes, sceneBoxes, active, laneMap);
    }

    // #7: at most 2 Smart-Orthogonal wires may trace the exact same detour
    // row/column - busy graphs could otherwise stack 3+ wires on the identical
    // pixels (e.g. several choices all detouring around the same obstacle, or
    // converging toward the same target), which reads as one thicker line or
    // a confusing blur rather than as several distinct routes even with the
    // halo separation above. A 3rd (and later) wire sharing a corridor fans
    // out a few px to either side instead. Scoped to one renderLines() pass
    // via the fresh Map it hands drawOrthogonal each call; omitted (no
    // laneMap) for the live drag wire and the handful of direct test/API
    // callers, which never need fanning out against anything else.
    const LANE_GAP = 8;
    function laneOffset(laneMap, key) {
        if (!laneMap) return 0;
        const n = laneMap.get(key) || 0;
        laneMap.set(key, n + 1);
        if (n < 2) return 0; // first 2 wires through a corridor: no offset, direct overlap is fine
        const rank = n - 1;
        const mag = Math.ceil(rank / 2) * LANE_GAP;
        return (rank % 2 === 1) ? mag : -mag;
    }

    // #172: how far back from each REAL port's exact center the rendered
    // stroke stops, on either end, so the port dot (16px, drawn above the
    // connections layer at that exact spot) visually caps the wire with a
    // clean rounded edge instead of a straight stroke driving through its
    // center and poking out past its round rim off-axis. Both routing modes
    // approach a port along a purely horizontal final stretch by construction
    // (drawBezier's control points, drawOrthogonal's first/last leg), so
    // trimming is just a straight x-shift, no curve math needed. Slightly
    // more than the dot's own 8px radius so its rounded rim is never grazed.
    const PORT_CAP_TRIM = 9;

    function drawOrthogonal(x1, y1, x2, y2, isTemp, type, nodeBoxes, sceneBoxes, active, laneMap) {
        const margin = 30; let pts = [];
        if (x2 > x1 + margin * 2) {
            let midX = x1 + (x2 - x1) / 2;
            let hit = nodeBoxes.find(box => midX > box.left && midX < box.right && !(Math.max(y1, y2) < box.top || Math.min(y1, y2) > box.bottom));
            if (hit) {
                let safeY = (y1 + y2) / 2 > (hit.top + hit.bottom) / 2 ? hit.bottom + margin : hit.top - margin;
                safeY += laneOffset(laneMap, 'h' + Math.round(safeY / 4)); // #7
                pts = [{ x: x1, y: y1 }, { x: x1 + margin, y: y1 }, { x: x1 + margin, y: safeY }, { x: x2 - margin, y: safeY }, { x: x2 - margin, y: y2 }, { x: x2, y: y2 }];
            } else {
                midX += laneOffset(laneMap, 'v' + Math.round(midX / 4)); // #7
                pts = [{ x: x1, y: y1 }, { x: midX, y: y1 }, { x: midX, y: y2 }, { x: x2, y: y2 }];
            }
        } else {
            let safeY = Math.max(y1, y2) + 80;
            let hit = nodeBoxes.find(box => safeY > box.top && safeY < box.bottom && box.left < Math.max(x1, x2) && box.right > Math.min(x1, x2));
            if (hit) safeY = hit.bottom + margin;
            safeY += laneOffset(laneMap, 'h' + Math.round(safeY / 4)); // #7
            pts = [{ x: x1, y: y1 }, { x: x1 + margin, y: y1 }, { x: x1 + margin, y: safeY }, { x: x2 - margin, y: safeY }, { x: x2 - margin, y: y2 }, { x: x2, y: y2 }];
        }
        // #172: trim the very first/last point back off the real port center
        // (see PORT_CAP_TRIM) - both legs run flat along x here (margin<pts
        // are still further out), so this is a plain x-shift, no re-routing.
        if (!isTemp) {
            pts[0] = { x: pts[0].x + PORT_CAP_TRIM, y: pts[0].y };
            const li = pts.length - 1;
            pts[li] = { x: pts[li].x - PORT_CAP_TRIM, y: pts[li].y };
        }
        let d = `M ${pts[0].x} ${pts[0].y}`;
        const radius = 10;
        for (let i = 1; i < pts.length - 1; i++) {
            const curr = pts[i], next = pts[i + 1], prev = pts[i - 1];
            const dirInX = Math.sign(curr.x - prev.x), dirInY = Math.sign(curr.y - prev.y);
            const dirOutX = Math.sign(next.x - curr.x), dirOutY = Math.sign(next.y - curr.y);
            const p1x = curr.x - dirInX * radius, p1y = curr.y - dirInY * radius;
            const p2x = curr.x + dirOutX * radius, p2y = curr.y + dirOutY * radius;
            d += ` L ${p1x} ${p1y} Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
        }
        d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
        return appendOccludeAwarePath(d, isTemp, type, sceneBoxes, active);
    }

    // -- Classic Bezier routing ----------------------------------------------
    function drawBezierFromPorts(sourceNode, outcome, isTemp, type, sceneBoxes, active) {
        const targetNode = nodes()[outcome.targetNode]; if (!targetNode) return null;
        const a = outPortXY(sourceNode, outcome.id); if (!a) return null;
        const b = inPortXY(targetNode); if (!b) return null;
        return drawBezier(a.x, a.y, b.x, b.y, isTemp, type, sceneBoxes, active);
    }

    function drawBezier(x1, y1, x2, y2, isTemp, type, sceneBoxes, active) {
        const cp = Math.max(Math.abs(x2 - x1) / 2, 50);
        // #172: control points stay anchored to the REAL port coordinates (so
        // the curve's shape/direction is unaffected), only the drawn anchor at
        // each end is pulled back by PORT_CAP_TRIM; both ends approach exactly
        // horizontally by construction, so this is a plain x-shift.
        const sx = isTemp ? x1 : x1 + PORT_CAP_TRIM;
        const ex = isTemp ? x2 : x2 - PORT_CAP_TRIM;
        const d = `M ${sx} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${ex} ${y2}`;
        return appendOccludeAwarePath(d, isTemp, type, sceneBoxes, active);
    }

    // #8: which physical <svg> layer a segment lands on. Defaults to the
    // original shared layer (also what the handful of direct test callers
    // that omit this get); active segments go to svgLayerActive (above even
    // a SELECTED node's z-index, so a scene's own wires never vanish under
    // its own box the moment you click into it), when that layer exists.
    function targetLayer(layer) {
        return layer || ctx.svgLayer;
    }

    function appendPathToSvg(d, isTemp, type, extraClass, layer) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        let classStr = "connection";
        if (isTemp) classStr += " temp";
        if (type === 'success') classStr += " success";
        if (type === 'failure') classStr += " failure";
        if (type === 'route') classStr += " route";
        if (extraClass) classStr += " " + extraClass;
        path.setAttribute("class", classStr);
        targetLayer(layer).appendChild(path);
        return path;
    }

    // #6/#169: appended BEFORE the real coloured path (so it renders
    // underneath), same "d" - a wider workspace-coloured stroke that reads as
    // a small gap wherever this line runs close to another one.
    function appendHaloToSvg(d, active, layer) {
        const halo = document.createElementNS("http://www.w3.org/2000/svg", "path");
        halo.setAttribute("d", d);
        halo.setAttribute("class", active ? "connection-halo active" : "connection-halo");
        targetLayer(layer).appendChild(halo);
        return halo;
    }

    // #7: true when (x,y) falls inside a scene box - including, deliberately,
    // the line's OWN source/target box: a curving line can loop back across
    // its own endpoint's body before finally reaching the port on its edge,
    // and that crossing obstructs that scene's content exactly as much as
    // crossing an unrelated one does. See appendOccludeAwarePath's terminus
    // exemption for how the port's own approach stub stays exempt despite this.
    function pointOccluded(x, y, boxes) {
        return boxes.some(b => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom);
    }

    // #7/#169: how much arc length at each END of the path is exempt from
    // occlusion no matter what box it's inside - the last stretch into a port
    // is SUPPOSED to touch (usually enter) that scene's own box, so hiding it
    // would just make every connection start/end vanish for no reason. Past
    // this exemption, even the line's own source/target box can occlude it
    // (see pointOccluded above) - the actual bug this constant fixes: a curve
    // that loops back over its own endpoint's body mid-route used to render
    // solid through that crossing just because it shared an ID with one end
    // of the line, not because it was anywhere near the port.
    const OCCLUSION_TERMINUS_EXEMPT = 24;

    // #172: turns a run of sampled points into one "M x y L x y ..." path
    // fragment, used for both the halo and the real line so they always trace
    // the exact same visible stretch.
    function segToD(samples, i, end) {
        let d = `M ${samples[i].x} ${samples[i].y}`;
        for (let k = i + 1; k <= end; k++) d += ` L ${samples[k].x} ${samples[k].y}`;
        return d;
    }

    // #7/#172/#186: draws a real (non-temp, non-route-preview) connection,
    // sampling it to find any stretch that overlaps a scene box. That
    // stretch renders dotted and heavily faded (.connection.occluded)
    // instead of a normal solid line - a real report called the earlier
    // (#172) "just omit it entirely" version confusing, since a line with no
    // visible trace at all reads as broken rather than as "continues behind
    // this box". This is also not a full reversion to the ORIGINAL (#162)
    // look either: that drew a bold dash at full opacity, which (since the
    // connections layer always paints above every scene box - see #8's
    // z-index comment near #svg-layer) visibly crossed right over the box's
    // own readable content, the actual complaint #169 fixed. A thin, mostly-
    // transparent dotted trace threads that needle: still visible enough to
    // read as "the wire goes here", faint enough not to obscure anything
    // underneath it. Samples the actual rendered path (works identically for Bezier curves
    // and Smart Orthogonal routes) via an invisible "measure" path, drawing a
    // halo+line pair for each unbroken visible run. The measure path is
    // returned in place of a single visible path so renderTransitionIndicator's
    // getTotalLength()/getPointAtLength() midpoint lookup keeps working
    // exactly as before, unaware anything changed.
    function appendOccludeAwarePath(d, isTemp, type, sceneBoxes, active) {
        const activeCls = active ? 'active' : null;
        // #8: an active line's own VISIBLE stretches render on the elevated
        // layer (above even a selected node's z-index), so editing a scene
        // never covers the wires connecting to it; every other line keeps
        // rendering on the original shared layer, unchanged.
        const visLayer = active ? ctx.svgLayerActive : ctx.svgLayer;
        if (isTemp) return appendPathToSvg(d, isTemp, type, activeCls); // live drag wire: always drawn whole, on top, tracking the cursor
        const testOcclusion = !!(sceneBoxes && sceneBoxes.length && occludeFadeOn());
        if (!testOcclusion) { appendHaloToSvg(d, active, visLayer); return appendPathToSvg(d, false, type, activeCls, visLayer); }
        const measure = document.createElementNS("http://www.w3.org/2000/svg", "path");
        measure.setAttribute("d", d);
        measure.setAttribute("class", "connection-measure");
        ctx.svgLayer.appendChild(measure);
        let len = 0;
        try { len = typeof measure.getTotalLength === 'function' ? measure.getTotalLength() : 0; } catch (e) { len = 0; }
        if (!len) { measure.remove(); appendHaloToSvg(d, active, visLayer); return appendPathToSvg(d, false, type, activeCls, visLayer); } // no SVG geometry support (e.g. some test envs): fall back to one solid path
        const nearTerminus = t => t < OCCLUSION_TERMINUS_EXEMPT || (len - t) < OCCLUSION_TERMINUS_EXEMPT;
        const step = 6;
        const samples = [];
        for (let t = 0; t < len; t += step) {
            const p = measure.getPointAtLength(t);
            samples.push({ x: p.x, y: p.y, occ: !nearTerminus(t) && pointOccluded(p.x, p.y, sceneBoxes) });
        }
        const last = measure.getPointAtLength(len);
        samples.push({ x: last.x, y: last.y, occ: !nearTerminus(len) && pointOccluded(last.x, last.y, sceneBoxes) });
        let i = 0;
        while (i < samples.length - 1) {
            const occ = samples[i].occ;
            let j = i;
            while (j < samples.length - 1 && samples[j + 1].occ === occ) j++;
            // j stays at i when the very next sample already flips state; still
            // emit that one-step segment (i -> i+1) so every run makes progress -
            // without this, i never advances past a single-sample-long run and
            // the loop spins forever, endlessly appending path elements.
            const end = Math.max(j, i + 1);
            const segD = segToD(samples, i, end);
            if (!occ) {
                appendHaloToSvg(segD, active, visLayer);
                appendPathToSvg(segD, false, type, activeCls, visLayer);
            } else {
                // #186: a run behind an unrelated scene box still renders,
                // dotted and heavily faded (.connection.occluded), on the
                // same shared layer as everything else - never omitted and
                // never routed to a layer below the boxes. A prior attempt
                // (#192) drew occluded runs on a layer below every node so
                // they'd never visually cross a box's text; that made them
                // 100% invisible wherever actually behind a box, which read
                // as the line vanishing/broken - exactly what #186 fixed
                // once already. Faded+dashed at low opacity is the balance:
                // visible enough to read as "the wire continues behind this
                // box", faint enough not to obscure the box's own content.
                appendPathToSvg(segD, false, type, (activeCls ? activeCls + ' ' : '') + 'occluded', visLayer);
            }
            i = end;
        }
        return measure;
    }

    // -- Port interactions (connect / disconnect / complete) -----------------
    function startConnection(e, nodeId, choiceId, outcomeId) {
        e.stopPropagation();
        ctx.setDrawing({ nodeId, choiceId, outcomeId });
        drawTempLine(e);
    }

    // mousedown on an OUTPUT port: if it already points somewhere, detach that
    // link first (so you can re-route), then start a fresh drag from it.
    function disconnectPort(e, nodeId, choiceId, outcomeId) {
        e.stopPropagation();
        const node = nodes()[nodeId];
        if (!node) return;
        if (choiceId === null || outcomeId === null) {
            node.choices.forEach(c => c.outcomes.forEach(o => { o.targetNode = null; }));
            if (ctx.onChanged) ctx.onChanged();
            return;
        }
        const choice = node.choices.find(c => c.id === choiceId);
        const outcome = choice && choice.outcomes.find(o => o.id === outcomeId);
        if (!outcome) return;
        if (outcome.targetNode) {
            outcome.targetNode = null;
            if (ctx.onChanged) ctx.onChanged();
        }
        startConnection(e, nodeId, choiceId, outcomeId);
    }

    // Drop onto an INPUT port: finalize the link from the drag source.
    function completeConnection(e, targetNodeId) {
        if (e && e.stopPropagation) e.stopPropagation();
        const drawingFrom = ctx.getDrawing();
        if (!drawingFrom) return;
        const node = nodes()[drawingFrom.nodeId];
        const choice = node && node.choices.find(c => c.id === drawingFrom.choiceId);
        const outcome = choice && choice.outcomes.find(o => o.id === drawingFrom.outcomeId);
        if (outcome && targetNodeId && nodes()[targetNodeId]) {
            outcome.targetNode = targetNodeId;
        }
        ctx.setDrawing(null);
        if (ctx.onChanged) ctx.onChanged(); else renderLines();
    }

    window.SceneConnections = {
        init, renderLines, drawTempLine, drawPathfindingLine, drawOrthogonal,
        drawBezierFromPorts, drawBezier, appendPathToSvg,
        startConnection, completeConnection, disconnectPort,
    };
})();
