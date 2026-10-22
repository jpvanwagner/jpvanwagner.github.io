/* ============================================================================
   Scenemaker editor; core engine (state, canvas, render, scenes, io, boot)
   Part of the modular editor. Classic script sharing global scope with core.js.
   ==========================================================================*/
/* ============================================================================
   SCENEMAKER; editor logic (v2)
   Data model additions this version (all backward-compatible):
     project.settings.debug  = { enabled, back, forward, restart, resetAll, varEditor }
     project.settings.screen = { style:'plain'|'ff7', border, radius, width, font }
     project.variables[i]    = { id, name, type:'number'|'text'|'bool', initial }
     scene.music             = { media, loop, volume(0..1), fadeOut(sec) }
     line.portrait.border    = 'none'|'round'|'square'|'soft'|'glow'|'gold'
     line.font               = '' | font key
   ==========================================================================*/

const HAS_BRIDGE = () => !!(window.pywebview && window.pywebview.api);
// #demo: an opt-in escape hatch for a build that's served over a real
// http(s) URL but has no actual Scenemaker backend behind it (e.g. a
// static portfolio host) - window.SCENEMAKER_NO_SERVER is never set by
// the real app (app.py/app_native.py), only by a standalone demo build's
// own extra script, so this is a no-op everywhere Scenemaker actually
// ships. Forces every HAS_SERVER()-gated feature onto its existing,
// already-built browser-only fallback path (local file open/download,
// "needs the local helper" messaging) instead of it looking connected
// and then failing against a route that was never there.
const HAS_SERVER = () => !window.SCENEMAKER_NO_SERVER && location.protocol.indexOf('http') === 0;
function downloadBlob(blob, filename){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }
function safeTitle(){ return (project.meta.title||'story').replace(/[^a-z0-9_-]/gi,'_'); }

const FONT_OPTS = ['system','serif','mono','rounded','comic','pixel','terminal'];
const FONT_CSS = {system:"system-ui,sans-serif",serif:"Georgia,'Times New Roman',serif",mono:"'Courier New',monospace",rounded:"'Segoe UI',Verdana,sans-serif",comic:"'Comic Sans MS','Comic Sans',cursive",pixel:"'Press Start 2P',monospace",terminal:"'VT323',monospace"};
function fontOptionStyle(k){ return FONT_CSS[k]?(' style="font-family:'+FONT_CSS[k]+'"'):''; }
const BORDER_OPTS = ['none','round','square','soft','glow','gold'];

/* ---- state -------------------------------------------------------------- */
let project = blankProject();
let scenes = project.scenes, backdrops = project.backdrops;
let globalSettings = { useSmartRouting:false };
let zoomLevel = 1.0, selectedNode = null;
let isDrawingLine = false, drawingFrom = null, panState = null;
let focusId = null;

function blankProject(){
  return {
    // createdAt is stamped once, the moment a genuinely NEW project starts
    // (see loadProject()'s isNew branch below) - never here directly, since
    // this same object is also the merge-defaults skeleton loadProject() uses
    // when OPENING an existing file, where stamping "now" would misreport an
    // old project as freshly created. null here just means "unknown" (an old
    // .vnproj saved before this field existed), same as exportTime's own default.
    meta:{ generator:'Scenemaker', version:3, title:'Untitled Story', exportTime:null, createdAt:null },
    // #96: bg.fit/bg.speed (video playback rate), music.playCount (0 = loop
    // forever, matching the old boolean-only behavior; a positive number
    // plays that many times then stops), hoverSound, showSocials and
    // menuItems are additive (#96, the title-screen mini-editor) - an old
    // .vnproj missing any of them gets these exact defaults on load (see the
    // nested-merge in loadProject()), so a title screen authored before this
    // existed renders byte-identical to before.
    title:{ enabled:false, bg:{type:'none',media:null,fit:'cover',speed:1}, music:{media:null,loop:true,volume:0.6,playCount:0},
      heading:'', subheading:'', startLabel:'Start', returnOnEnd:true, hoverSound:null, showSocials:false, menuItems:[] },
    // #98: the automatic end-credits screen's own richer look (style/bg/music/
    // colors/which sections show) - kept separate from project.title.showCredits/
    // creditsHeading (the two fields the ORIGINAL basic toggle already reads and
    // writes), same "basic Settings field stays put, a mini-editor adds a richer
    // surface next to it" precedent #96's title-screen editor set. Every field
    // here is additive; a project that never opens the Credits screen editor
    // renders its credits screen exactly as it always did (style:'static', no
    // custom bg/music, default colors, every section shown).
    creditsScreen:{ style:'static', scrollSpeed:40, bg:{type:'none',media:null,fit:'cover'}, music:{media:null,volume:0.6},
      textColor:'', headingColor:'', closeLabel:'Close', showAuthor:true, showTeam:true, showAssetCredits:true, showSocials:true },
    // #99: keyphrases - a project-wide list of words/phrases that always get a
    // consistent look (colour/bold/italic) wherever they appear in dialogue or
    // cutscene text, in actual play, without hand-wrapping every occurrence in
    // [c=]/**/* markup. Additive; an empty list (every existing project) means
    // zero rendering change. Character names use their own opt-in toggle
    // (characters[].highlightName) instead of living in this list, since a
    // renamed/recoloured character should stay in sync automatically. Per-
    // variable style (variables[].style) is separate again: it styles whatever
    // a {{token}} actually substitutes to, not a literal phrase match.
    keyphrases:[],
    variables:[], characters:[],
    settings:{ startScene:null, useSmartRouting:false, completion:{ mode:'reachEnd', count:1, criteria:[{type:'reachEnd'}] }, endRestart:true,
      debug:{ enabled:false, back:false, forward:false, restart:false, resetAll:false, varEditor:false },
      screen:{ style:'plain', border:false, radius:16, width:6, font:'system' },
      hud:{ fullscreen:false, screenshot:false, settingsMenu:false, backlog:false, backlogEffects:false, devNotes:false },
      continuePrompt:{ enabled:true, text:'click to continue', align:'right', size:13, style:'blinkArrow', placement:'box', x:50, y:92, keys:[] },
      scorm:{ version:'1.2', reportScore:true, masteryScore:null, scoreVar:'', scoreMax:100, reportInteractions:true, reportTime:true, reportSuccess:true },
      text:{ mode:'letter', speed:5 },
      // #146: both blank means "use the built-in default" (LOADING…, the
      // player's own --accent) - stored this way rather than duplicating the
      // literal default string here too, and so an untouched project's
      // loading screen renders byte-identical to before this existed.
      loading:{ text:'', color:'' },
      // in-game menu cursor sound (choice buttons, HUD settings items): off
      // by default; a blank media means "play the built-in synthesized blip"
      // (player/cursorsound.js), not silence - silence is what enabled:false
      // means. A custom media key overrides the built-in blip.
      cursorSound:{ enabled:false, media:null },
      // #168: whether an "unattributed" line (line.unattributed, no speaker/
      // box - narrator commentary, off-screen dialogue) dims the other
      // on-stage portraits/text and the background while it shows. On by
      // default; toggled from the Canvas editor (a project-wide setting, not
      // per-line, since it's about how the WHOLE stage reacts).
      narration:{ dimOthers:true },
      // #share: an opt-in "share your ending" prompt at the end of a run,
      // linking back to the project's own Website (meta.website, already set
      // in Info & credits - never a second URL field to keep in sync). No
      // new identity fields: just this toggle plus a message template, since
      // author/site/socials already live on project.meta. {ending} and
      // {title} are substituted from the ending scene's own title and
      // meta.title right before sharing; never touched for a project that
      // hasn't turned this on.
      share:{ enabled:false, message:'I got the “{ending}” ending in {title}!' } },
    media:{}, scenes:{}, backdrops:{}
  };
}
function rebind(){ scenes = project.scenes; backdrops = project.backdrops;
  globalSettings.useSmartRouting = !!project.settings.useSmartRouting; }

function genId(p){ return p + '_' + Math.random().toString(36).substr(2,9); }
function mediaURL(key){ return (key && project.media[key]) ? project.media[key] : ''; }
// how long a toast stays up, and whether it shows at all - both per-computer
// (ToolSettings), same as the other workspace-only preferences. Default
// bumped from the old hardcoded 1.9s to 3s; genuinely too quick to read on
// a longer message, and there was no way to change it short of editing code.
function toastDurationMs(){ const v=(typeof ToolSettings!=='undefined')?parseFloat(ToolSettings.get('toastDuration','3')):3; return (isNaN(v)?3:v)*1000; }
function setToastDuration(secs){ const n=parseFloat(secs); const v=Math.max(0.5,Math.min(10,isNaN(n)?3:n)); if(typeof ToolSettings!=='undefined') ToolSettings.set('toastDuration', String(v)); }
function toastsEnabled(){ return (typeof ToolSettings==='undefined')||ToolSettings.get('toastsOff','0')!=='1'; }
function setToastsEnabled(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('toastsOff', on?'0':'1'); }
function toast(msg){
  if(!toastsEnabled()) return;
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), toastDurationMs());
}
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }

/* ---- undo / redo -------------------------------------------------------- */
const UNDO_LIMIT=60; let _undo=[],_redo=[],_pending=false;
// #7: tracks whether the project has real edits since the last successful
// save, so closing/reloading the tab with unsaved work can warn first -
// set true by every pushUndo() (the one entry point nearly every mutating
// action already goes through), cleared on a successful save or a fresh
// load, and read by the beforeunload handler below.
let _dirty=false;
function snap(){ return JSON.stringify({scenes:project.scenes,backdrops:project.backdrops}); }
function restore(s){ const d=JSON.parse(s); project.scenes=d.scenes; project.backdrops=d.backdrops; rebind(); renderAll(); }
function pushUndo(){ _undo.push(snap()); if(_undo.length>UNDO_LIMIT)_undo.shift(); _redo=[]; _dirty=true; updateUndoButtons(); if(typeof ProjectTabs!=='undefined' && ProjectTabs.markDirtySoon){ ProjectTabs.markDirtySoon(); ProjectTabs.render(); } }
function pushUndoOnce(){ if(_pending)return; _pending=true; pushUndo(); }
function endUndo(){ _pending=false; }
function undo(){ if(!_undo.length)return; _redo.push(snap()); restore(_undo.pop()); updateUndoButtons(); }
function redo(){ if(!_redo.length)return; _undo.push(snap()); restore(_redo.pop()); updateUndoButtons(); }
function updateUndoButtons(){ document.getElementById('undo-btn').disabled=!_undo.length; document.getElementById('redo-btn').disabled=!_redo.length; }

/* ---- zoom / pan --------------------------------------------------------- */
const workspace=document.getElementById('workspace'), zoomLayer=document.getElementById('zoom-layer'), svgLayer=document.getElementById('svg-layer');
const svgLayerActive=document.getElementById('svg-layer-active');
function applyZoom(){ zoomLayer.style.transform=`scale(${zoomLevel})`; document.getElementById('zoom-label').textContent=Math.round(zoomLevel*100)+'%'; SceneConnections.renderLines(); }
// #14 (zoom UX): keeps one LOGICAL (unscaled) point stationary under one
// given viewport-relative screen offset while changing zoomLevel - the one
// place both zoom paths below define "what stays put while zooming".
function _zoomKeepingPoint(newZoom, logicalX, logicalY, offX, offY){
  zoomLevel=Math.min(2,Math.max(0.3,+newZoom.toFixed(2)));
  applyZoom();
  workspace.scrollLeft=Math.max(0, logicalX*zoomLevel-offX);
  workspace.scrollTop=Math.max(0, logicalY*zoomLevel-offY);
  if(typeof syncZoomSlider==='function') syncZoomSlider();
}
// The logical point a zoom should stay anchored to: the selected scene's
// own center when one exists (so it never drifts out of view while zooming
// in/out on it), otherwise the CURRENT viewport's own center (so zooming
// with nothing selected holds its place instead of always drifting toward
// the canvas's fixed top-left corner - zoomLayer's transform-origin, which
// is what a plain scale() with no scroll compensation at all effectively
// zoomed around before this).
function _zoomAnchorLogical(){
  if(selectedNode && scenes[selectedNode]){
    const n=scenes[selectedNode]; const wh=(typeof nodeSize==='function')?nodeSize(selectedNode):[420,280];
    return { x:n.x+wh[0]/2, y:n.y+wh[1]/2 };
  }
  const vw=workspace.clientWidth||1, vh=workspace.clientHeight||1;
  return { x:(workspace.scrollLeft+vw/2)/zoomLevel, y:(workspace.scrollTop+vh/2)/zoomLevel };
}
// Bottom-bar +/- buttons (#14: a real request, "zooming-in on the stage
// should center on the selection/selected scene... when using the
// bottom-bar -/+ buttons"): always re-centers the anchor point (the
// selection, or the current view when nothing's selected) at the middle of
// the viewport.
function setZoom(d){
  const p=_zoomAnchorLogical(), vw=workspace.clientWidth||1, vh=workspace.clientHeight||1;
  _zoomKeepingPoint(zoomLevel+d, p.x, p.y, vw/2, vh/2);
}
// Mousewheel/Ctrl+wheel (workspace.js's own handler calls this): centers on
// the SELECTED scene when one exists (same full-center behavior as the
// bottom-bar buttons, so it never drifts out of view no matter where the
// cursor happens to be), otherwise keeps the point under the cursor itself
// stationary - the standard "zoom toward the cursor" feel.
function setZoomAtCursor(d, clientX, clientY){
  const vw=workspace.clientWidth||1, vh=workspace.clientHeight||1;
  if(selectedNode && scenes[selectedNode]){
    const p=_zoomAnchorLogical();
    _zoomKeepingPoint(zoomLevel+d, p.x, p.y, vw/2, vh/2);
    return;
  }
  const wr=workspace.getBoundingClientRect();
  const offX=(clientX!=null?clientX:wr.left+vw/2)-wr.left, offY=(clientY!=null?clientY:wr.top+vh/2)-wr.top;
  const logicalX=(workspace.scrollLeft+offX)/zoomLevel, logicalY=(workspace.scrollTop+offY)/zoomLevel;
  _zoomKeepingPoint(zoomLevel+d, logicalX, logicalY, offX, offY);
}
function resetZoom(){ zoomLevel=1.0; applyZoom(); }
function getLogicalCoords(e){ const r=zoomLayer.getBoundingClientRect(); return { x:(e.clientX-r.left)/zoomLevel, y:(e.clientY-r.top)/zoomLevel }; }
/* #50: bounding box (logical/unscaled px) of everything on the CURRENT
   layer - used both by zoomToFit() below and by the "layer size" indicator
   in the bottom bar. Deliberately scoped to the current layer (unlike
   canvas-grow.js's auto-crop, which considers every layer, since the canvas
   itself is shared workspace) - this is about what you're actually looking
   at right now. */
function contentBounds(){
  const ids=Object.keys(typeof visibleScenes==='function'?visibleScenes():scenes);
  const gids=Object.keys(typeof visibleBackdrops==='function'?visibleBackdrops():backdrops);
  if(!ids.length && !gids.length) return null;
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  const consider=(x,y,w,h)=>{ minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x+w);maxY=Math.max(maxY,y+h); };
  ids.forEach(id=>{ const n=scenes[id]; const wh=nodeSize(id); consider(n.x,n.y,wh[0],wh[1]); });
  gids.forEach(id=>{ const b=backdrops[id]; consider(b.x,b.y,b.w||300,b.h||200); });
  return {minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY};
}
/* zoom and scroll so every scene/group on the current layer is visible at
   once, centered in the workspace - same clamp range as the manual zoom
   controls (30%-200%) so it never lands somewhere those controls couldn't
   reach by hand. */
function zoomToFit(){
  const b=contentBounds(); if(!b){ toast('Nothing on this layer to fit'); return; }
  const pad=80;
  const vw=workspace.clientWidth, vh=workspace.clientHeight;
  const z=Math.min(2, Math.max(0.3, Math.min(vw/(b.w+pad*2), vh/(b.h+pad*2))));
  zoomLevel=+z.toFixed(2); applyZoom();
  const cx=b.minX+b.w/2, cy=b.minY+b.h/2;
  workspace.scrollLeft=Math.max(0, cx*zoomLevel-vw/2);
  workspace.scrollTop=Math.max(0, cy*zoomLevel-vh/2);
  if(typeof syncZoomSlider==='function') syncZoomSlider();
}

workspace.addEventListener('mousedown',e=>{ if(e.target===workspace||e.target===zoomLayer){ panState={x:e.clientX,y:e.clientY,sl:workspace.scrollLeft,st:workspace.scrollTop}; setSelectedNode(null); if(typeof clearPropsSelection==='function') clearPropsSelection(); } });
const GRID=20;
function gridSpacing(){ return parseInt(ToolSettings.get('gridSpacing','30'),10)||30; }
function applyGridStyle(){
  const sp=gridSpacing(), dot=parseInt(ToolSettings.get('gridDot','1'),10);
  const zl=document.getElementById('zoom-layer'); if(!zl) return;
  if(dot<=0){ zl.style.backgroundImage='none'; }
  // #9: a plain radial-gradient defaults to centering itself within each
  // repeated tile, so dots land at (sp/2, sp/2), (sp/2+sp, sp/2+sp)... -
  // half a grid cell away from the (0, sp, 2*sp...) coordinates snapXY()
  // actually snaps to. "at 0 0" centers each tile's dot at its own corner
  // instead, so adjacent tiles' corner-quarters reassemble into full dots
  // sitting exactly on the grid-line intersections scenes snap to.
  else { zl.style.backgroundImage=`radial-gradient(circle at 0 0, var(--dot) ${dot}px, transparent ${dot}px)`; zl.style.backgroundSize=sp+'px '+sp+'px'; }
}
function snapScenesOn(){ return ToolSettings.get('snapScenes','0')==='1'; }
function snapXY(x,y){ if(snapScenesOn()){ const g=gridSpacing(); x=Math.round(x/g)*g; y=Math.round(y/g)*g; } return [x,y]; }
// Chromium's native drag-and-drop targets the nearest draggable ancestor
// (.choice-row, for reordering choices) rather than the actual mousedown
// element, so by the time 'dragstart' fires, e.target is already the row,
// not the port that started the gesture - too late to tell them apart there.
// Track the real mousedown target here, in the capture phase, ahead of any
// dragstart, so choiceDragStart can look it up and cancel the native drag
// when a connection-port drag is what's actually happening.
let _lastMouseDownOnPort=false;
window.addEventListener('mousedown',e=>{ _lastMouseDownOnPort=!!(e.target && e.target.closest && e.target.closest('.port')); },true);
window.addEventListener('mousemove',e=>{
  if(panState){ workspace.scrollLeft=panState.sl-(e.clientX-panState.x); workspace.scrollTop=panState.st-(e.clientY-panState.y); }
  if(nodeDrag){ const c=getLogicalCoords(e); const n=scenes[nodeDrag.id];
    const xy=snapXY(c.x-nodeDrag.dx, c.y-nodeDrag.dy);
    n.x=Math.max(0,xy[0]); n.y=Math.max(0,xy[1]); /* #11 clamp + #9 snap-to-grid */
    const el=document.getElementById(n.id); el.style.left=n.x+'px'; el.style.top=n.y+'px'; if(typeof growCanvasFor==='function')growCanvasFor(n.x+(el?el.offsetWidth:420), n.y+(el?el.offsetHeight:220), n.x, n.y);
    if(nodeDrag.multi){ nodeDrag.multi.forEach(m=>{ const nn=scenes[m.id]; if(!nn)return; nn.x=Math.max(0,n.x+m.ox); nn.y=Math.max(0,n.y+m.oy); const e2=document.getElementById(m.id); if(e2){ e2.style.left=nn.x+'px'; e2.style.top=nn.y+'px'; } }); }
    // #67: which group (if any) this scene is currently hovering is easy to
    // lose track of mid-drag since the group's own border sits BEHIND every
    // scene - trace it on a layer above everything while the drag is live.
    if(typeof updateGroupDragOutline==='function') updateGroupDragOutline(n, el);
    SceneConnections.renderLines(); }
  if(bdDrag){ const c=getLogicalCoords(e); const b=backdrops[bdDrag.id]; const xy=snapXY(c.x-bdDrag.dx,c.y-bdDrag.dy);
    const nx=Math.max(0,xy[0]), ny=Math.max(0,xy[1]), dxm=nx-b.x, dym=ny-b.y; b.x=nx; b.y=ny;
    groupMembers(bdDrag.id).forEach(s=>{ s.x=Math.max(0,s.x+dxm); s.y=Math.max(0,s.y+dym); const sel=document.getElementById(s.id); if(sel){ sel.style.left=s.x+'px'; sel.style.top=s.y+'px'; } });
    const el=document.getElementById(b.id); el.style.left=b.x+'px'; el.style.top=b.y+'px'; if(typeof growCanvasFor==='function')growCanvasFor(b.x+(b.w||300), b.y+(b.h||200), b.x, b.y); SceneConnections.renderLines(); }
  if(nodeRz){ const c=getLogicalCoords(e); const el=document.getElementById(nodeRz.id); const nn=scenes[nodeRz.id];
    const w=Math.max(300,Math.min(820, nodeRz.w0 + (c.x-nodeRz.x0))); const h=Math.max(120, nodeRz.h0 + (c.y-nodeRz.y0));
    if(el){ el.style.width=w+'px'; el.style.height=h+'px'; } if(nn){ nn.w=w; nn.h=h; } SceneConnections.renderLines(); }
  if(bdResize){ const c=getLogicalCoords(e); const b=backdrops[bdResize.id];
    b.w=Math.max(160, bdResize.w0 + (c.x-bdResize.x0));
    b.h=Math.max(120, bdResize.h0 + (c.y-bdResize.y0));
    const el=document.getElementById(b.id); if(el){ el.style.width=b.w+'px'; el.style.height=b.h+'px'; }
    SceneConnections.renderLines(); }
  if(isDrawingLine) SceneConnections.drawTempLine(e);
});
window.addEventListener('mouseup',()=>{ panState=null;
  if(nodeDrag){ const id=nodeDrag.id; if(typeof hideGroupDragOutline==='function') hideGroupDragOutline(); handleSceneDropGroup(id); if(typeof popApartIfNeeded==='function') popApartIfNeeded(id); endUndo(); nodeDrag=null; if(typeof checkObstruction==='function') checkObstruction(id,'scene'); }
  if(bdDrag){ const id=bdDrag.id; endUndo(); bdDrag=null; if(typeof checkObstruction==='function') checkObstruction(id,'group'); }
  if(bdResize){ const id=bdResize.id; endUndo(); bdResize=null;
    // #68: don't stack two uiConfirm prompts (only one modal exists) - if the
    // resize also fully obstructed another group, that warning takes
    // priority and the annex offer is skipped this time around.
    const hadObstruction = typeof _findFullObstruction==='function' && !(typeof obstructWarnOff==='function' && obstructWarnOff()) && !!_findFullObstruction(id,'group');
    if(typeof checkObstruction==='function') checkObstruction(id,'group');
    if(!hadObstruction && typeof checkGroupResizeAnnex==='function') checkGroupResizeAnnex(id);
  }
  if(nodeRz){ const id=nodeRz.id; endUndo(); nodeRz=null; if(typeof renderScenes==='function')SceneConnections.renderLines(); if(typeof checkObstruction==='function') checkObstruction(id,'scene'); }
  if(isDrawingLine){isDrawingLine=false;drawingFrom=null;SceneConnections.renderLines();} });

SceneConnections.init({
  getNodes:()=>(typeof visibleScenes==='function'?visibleScenes():scenes), getGroups:()=>(typeof visibleBackdrops==='function'?visibleBackdrops():backdrops), getSettings:()=>globalSettings, getZoom:()=>zoomLevel,
  getSelectedNode:()=>selectedNode,
  svgLayer, svgLayerActive, zoomLayer, getLogicalCoords,
  setDrawing:(f)=>{ drawingFrom=f; isDrawingLine=!!f; }, getDrawing:()=>drawingFrom,
  onChanged:()=>renderScenes(),
  onTransitionClick:(sourceId,choiceId,outcomeId,e)=>{ if(typeof openTransitionEditor==='function') openTransitionEditor(sourceId,choiceId,outcomeId,e); }
});
// Selecting/deselecting a scene: toggles the `.selected` class on its own DOM
// node (cheap, no full renderScenes()) and re-draws the connection lines so
// the newly (de)selected scene's own wires pick up/lose their "active"
// highlight (see connections.js's renderLines()) right away.
function setSelectedNode(id){
  selectedNode=id;
  document.querySelectorAll('.node.selected').forEach(x=>x.classList.remove('selected'));
  if(id){ const el=document.getElementById(id); if(el) el.classList.add('selected'); }
  SceneConnections.renderLines();
  if(typeof refreshSbCoords==='function') refreshSbCoords();
}
function startConnection(e,n,c,o){ pushUndoOnce(); SceneConnections.startConnection(e,n,c,o); }
function completeConnection(e,t){ SceneConnections.completeConnection(e,t); endUndo(); }
function disconnectPort(e,n,c,o){ pushUndoOnce(); SceneConnections.disconnectPort(e,n,c,o); endUndo(); }
// #11: a direct owner report ("in order to 'disconnect' a connecting line,
// we can only start dragging again from the origin (choice) point... make
// it possible for us to disconnect from the endpoint too"). The input dot
// itself was already claimed as the normal DROP target for a new connection
// in progress (that gesture's own mousedown happens on the OUTPUT port, so
// wiring this on mousedown here never conflicts with it); a genuinely
// surprising/destructive action here gets a confirm first, unlike the
// output side (which was already an explicit "grab this line and move it"
// gesture, not a bare click). Re-enable in Settings -> Workspace.
function endpointDisconnectOff(){ return (typeof ToolSettings!=='undefined') && ToolSettings.get('endpointDisconnectOff','0')==='1'; }
function setEndpointDisconnectWarn(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('endpointDisconnectOff', on?'0':'1'); }
function _incomingConnections(targetId){
  const list=[];
  Object.values(scenes).forEach(n=>{
    (n.choices||[]).forEach(c=>(c.outcomes||[]).forEach(o=>{
      if(o.targetNode===targetId) list.push({sceneId:n.id, choiceId:c.id, outcomeId:o.id, choiceText:(c.text||(c.continue?'Continue':'')||'(unnamed choice)')});
    }));
  });
  return list;
}
function disconnectInputPort(e,targetId){
  if(e&&e.stopPropagation) e.stopPropagation();
  const incoming=_incomingConnections(targetId);
  if(!incoming.length) return;
  const doDetach=()=>{
    pushUndo();
    incoming.forEach(x=>{ const s=scenes[x.sceneId]; const c=s&&s.choices.find(cc=>cc.id===x.choiceId); const o=c&&c.outcomes.find(oo=>oo.id===x.outcomeId); if(o) o.targetNode=null; });
    SceneConnections.renderLines();
  };
  if(endpointDisconnectOff()){ doDetach(); return; }
  const msg = incoming.length===1
    ? `Disconnect the incoming line from "${escHtml(incoming[0].choiceText)}"?`
    : `Disconnect all ${incoming.length} incoming lines to this scene (from ${incoming.map(x=>'"'+escHtml(x.choiceText)+'"').join(', ')})?`;
  uiConfirm(msg, doDetach, { yes:'Disconnect', no:'Cancel',
    checkbox:{ label:'Don’t ask again (re-enable in Settings → Workspace)', onChecked:()=>{ setEndpointDisconnectWarn(false); } } });
}

/* ---- scene CRUD --------------------------------------------------------- */
/* Lorem Ipsum autofill (opt-in, Settings -> Workspace): lets an author block
   out a branching structure's shape with placeholder dialogue before writing
   real content, instead of every new line starting blank. */
const LOREM_SENTENCES=[
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
  'Curabitur blandit tempus porttitor. Nullam quis risus eget urna mollis.',
  'Vestibulum id ligula porta felis euismod semper. Cras mattis consectetur purus.',
  'Aenean lacinia bibendum nulla sed consectetur. Donec sed odio dui.',
  'Etiam porta sem malesuada magna mollis euismod. Cum sociis natoque penatibus.',
  'Maecenas faucibus mollis interdum. Nulla vitae elit libero, a pharetra augue.'
];
function loremAutofillOn(){ return (typeof ToolSettings!=='undefined') && ToolSettings.get('loremAutofill','0')==='1'; }
function randomLorem(){ return LOREM_SENTENCES[Math.floor(Math.random()*LOREM_SENTENCES.length)]; }
function baseLine(){ return { id:genId('l'), speaker:'', text:loremAutofillOn()?randomLorem():'', portrait:{media:null,pos:'left',border:'none',scale:1}, doc:{media:null,label:''}, font:'', stage:[], speakingCast:'', visit:{mode:'always',n:2}, textSpeed:{mode:'',speed:5}, sfx:[] }; }
function baseScene(x,y){ return { id:genId('scene'), x, y, collapsed:false, group:null, title:'New Scene', mode:'dialogue',
  cutscene:{ dim:0.4, effect:'shadow', size:'lg', align:'center' }, viewer:{ kind:'photo360', media:null, loop:true }, cast:[], overlap:false, speakerTop:true,
  bg:{ type:'none', media:null }, music:{ media:null, loop:true, volume:0.6, fadeOut:0, stop:false },
  lines:[ baseLine() ], choices:[] }; }
function addScene(x,y){ pushUndo(); const s=baseScene(x,y);
  const lyr=(typeof currentLayerId!=='undefined')?currentLayerId:'main';
  if(lyr!=='main') s.layer=lyr; // leave the field off entirely for the default layer, so untouched projects stay byte-identical
  scenes[s.id]=s;
  if(typeof layerStartScene==='function'){ if(!layerStartScene(lyr)) setLayerStartScene(lyr,s.id); }
  else if(!project.settings.startScene) project.settings.startScene=s.id;
  renderScenes(); }
function addSceneAtView(){ addScene(workspace.scrollLeft/zoomLevel+300, workspace.scrollTop/zoomLevel+120); }
function deleteScene(id){ pushUndo(); const dyingLayer=typeof sceneLayer==='function'?sceneLayer(scenes[id]):'main'; delete scenes[id];
  Object.values(scenes).forEach(n=>n.choices.forEach(c=>{ c.outcomes.forEach(o=>{ if(o.targetNode===id)o.targetNode=null; }); if(Array.isArray(c.routes)) c.routes.forEach(r=>{ if(r.target===id)r.target=''; }); if(c.portal && c.portal.scene===id) c.portal.scene=null; }));
  if(typeof layerStartScene==='function'){
    if(layerStartScene(dyingLayer)===id){ const remaining=Object.values(scenes).filter(n=>sceneLayer(n)===dyingLayer); setLayerStartScene(dyingLayer, remaining[0]?remaining[0].id:null); }
  } else if(project.settings.startScene===id) project.settings.startScene=Object.keys(scenes)[0]||null;
  if(focusId===id) closeFocus(); renderScenes(); }
function toggleCollapse(id){ scenes[id].collapsed=!scenes[id].collapsed; renderScenes(); }
// #88: scenes are always linked by id, never by title, so a duplicate title
// can't break anything functionally - it's purely a "which one did I mean"
// mixup in the endpoints dropdown, the layer list, a portal's return-here
// link, etc. Flagged the same non-blocking way as the other name warnings.
function setTitle(id,v){ scenes[id].title=v;
  if(v){ const dupe=Object.values(scenes).find(s=>s.id!==id && s.title===v);
    if(dupe && typeof toast==='function') toast(`Another scene is already titled "${v}"`); } }

/* #4: duplicate a whole scene (deep copy, fresh ids, offset) */
// #7: a duplicated/pasted scene keeping the exact same title as its source
// read as a bug, not two intentionally-identically-named scenes - "Copy of
// X" matches how duplicating a file works elsewhere. Left alone if the
// source is already a copy (title already starts with "Copy of "), so
// duplicating a duplicate doesn't run away into "Copy of Copy of Copy of...".
function cloneScene(src, dx, dy){
  const s=JSON.parse(JSON.stringify(src));
  s.id=genId('scene'); s.x=Math.max(0,src.x+(dx||40)); s.y=Math.max(0,src.y+(dy||40));
  s.lines.forEach(l=>l.id=genId('l'));
  s.choices.forEach(c=>{ c.id=genId('c'); c.outcomes.forEach(o=>o.id=genId('o')); });
  const t=s.title||'Scene'; s.title = /^Copy of /.test(t) ? t : ('Copy of '+t);
  return s;
}
function duplicateScene(id){ pushUndo(); const s=cloneScene(scenes[id]); scenes[s.id]=s; renderScenes(); toast('Scene duplicated'); }
/* #4: add a NEXT scene that inherits this scene's look (bg/music/portrait) and wire a Continue to it.
   Same media keys => a background video keeps playing across the two scenes. */
function addLinkedNext(id){
  pushUndo(); const src=scenes[id];
  const n=baseScene(Math.max(0,src.x+480), src.y);
  n.title='New Scene';
  n.bg=JSON.parse(JSON.stringify(src.bg));
  n.music=JSON.parse(JSON.stringify(src.music));
  const lastP=(src.lines[src.lines.length-1]||{}).portrait;
  if(lastP) n.lines[0].portrait=JSON.parse(JSON.stringify(lastP));
  scenes[n.id]=n;
  const cont=newChoice('',true); cont.outcomes[0].targetNode=n.id;
  src.choices.push(cont);
  renderScenes(); toast('Linked next scene created (inherits look)');
}

/* lines */
function addLine(id){ pushUndo(); scenes[id].lines.push(baseLine()); renderScenes(); }
/* #3: ephemeral (not saved) per-line UI state - whether a collapsed
   same-speaker line's override controls are manually expanded */
let _lineOverrideOpen={};
function toggleLineOverride(lid){ _lineOverrideOpen[lid]=!_lineOverrideOpen[lid]; renderScenes(); }
/* Ctrl+Enter inside a dialogue textarea (#24): insert a new line right after
   the current one, for the same speaking character, and focus it, instead of
   forcing the writer to reach for the "+ line" button every beat. */
function addLineAfter(id,lid){
  pushUndo();
  const lines=scenes[id].lines, idx=lines.findIndex(l=>l.id===lid);
  if(idx===-1) return;
  const cur=lines[idx], nl=baseLine();
  nl.speakingCast=cur.speakingCast;
  nl.stage=(cur.stage||[]).map(s=>({...s}));
  lines.splice(idx+1,0,nl);
  renderScenes();
  setTimeout(()=>{ const el=document.getElementById('ta-'+nl.id); if(el){ el.focus(); } }, 0);
}
function delLine(id,lid){ pushUndo(); scenes[id].lines=scenes[id].lines.filter(l=>l.id!==lid); renderScenes(); }
function setLine(id,lid,f,v){ const l=scenes[id].lines.find(l=>l.id===lid); if(l) l[f]=v; }
function setPortraitPos(id,lid,pos){ scenes[id].lines.find(l=>l.id===lid).portrait.pos=pos; renderScenes(); }
function setPortraitBorder(id,lid,b){ scenes[id].lines.find(l=>l.id===lid).portrait.border=b; }
function setPortraitHidden(id,lid,hidden){ pushUndo(); scenes[id].lines.find(l=>l.id===lid).portrait.hidden=hidden; renderScenes(); }
function setLineFont(id,lid,f){ scenes[id].lines.find(l=>l.id===lid).font=f; }
function setDocLabel(id,lid,v){ const l=scenes[id].lines.find(l=>l.id===lid); if(l&&l.doc) l.doc.label=v; }

/* multi-face cast (scene-level) + per-line stage */
const CAST_SIZES=['square','tall','full'], CAST_ENTER=['fade','fromLeft','fromRight','fromBottom','pop','none'], CAST_EXIT=['fade','toLeft','toRight','toBottom','pop','none'], STAGE_POS=['farLeft','left','center','right','farRight'];
function autoDefaultSpeaker(scene){ if(!scene) return; const cast=scene.cast||[]; if(cast.length!==1) return; const only=cast[0].id;
  (scene.lines||[]).forEach(l=>{ if(!l.speakingCast){ l.speakingCast=only; if(!(l.stage||[]).some(st=>st.castId===only)) (l.stage=l.stage||[]).push({castId:only,pos:'center',state:''}); } }); }
function stageCastEverywhere(scene, castId){
  // #8: when a face joins a scene, put it on stage for every line and make it the
  // speaker where no one is speaking yet; so its portrait shows up right away.
  (scene.lines||[]).forEach(l=>{ if(!Array.isArray(l.stage)) l.stage=[];
    if(!l.stage.find(s=>s.castId===castId)) l.stage.push({castId, pos:'center', state:''});
    if(!l.speakingCast) l.speakingCast=castId;
  });
}
function sendCastToLibrary(sceneId, castId){
  const s=scenes[sceneId]; if(!s) return; const c=(s.cast||[]).find(x=>x.id===castId); if(!c) return;
  if(c.charId){ toast('This face already comes from the library'); return; }
  pushUndo();
  const ch={ id:genId('char'), name:c.name||'Character', media:c.media||null, mediaRaw:c.mediaRaw||c.media||null, chroma:c.chroma||null,
    size:c.size||'square', scale:c.scale||1, enter:c.enter||'fade', exit:c.exit||'fade', border:c.border||'none',
    portraitShape:c.portraitShape||'', portraitFit:c.portraitFit||'', textSpeed:{mode:'',speed:5},
    typeSound:{enabled:false,wave:'square',pitch:6,volume:5,chirp:0,detune:0}, portraits:c.portraits?JSON.parse(JSON.stringify(c.portraits)):[] };
  if(!project.characters) project.characters=[]; project.characters.push(ch);
  c.charId=ch.id;                                  // link this face to the new library character
  renderScenes(); if(typeof renderCharList==='function') renderCharList();
  toast('“'+ch.name+'” added to the character library');
}
function addCast(id){ pushUndo(); const s=scenes[id]; if(!s.cast)s.cast=[]; const cid=genId('cast'); s.cast.push({id:cid,name:'Name',media:null,size:'square',scale:1,enter:'fade',border:'none'}); stageCastEverywhere(s,cid); autoDefaultSpeaker(s); renderScenes(); }
function setCast(id,cid,f,v){ const c=scenes[id].cast.find(x=>x.id===cid); if(c) c[f]=(f==='scale')?(parseFloat(v)||1):v; if(f==='scale') renderScenes(); }
function delCast(id,cid){ pushUndo(); const s=scenes[id]; s.cast=s.cast.filter(x=>x.id!==cid);
  s.lines.forEach(l=>{ if(l.stage)l.stage=l.stage.filter(x=>x.castId!==cid); if(l.speakingCast===cid)l.speakingCast=''; }); renderScenes(); }
// #105: reorder a cast slot (its letter is purely its array position) without
// touching its id, so per-line staging/speaking already keyed to it survives.
function moveCast(id,cid,dir){
  const s=scenes[id]; if(!s||!s.cast) return;
  const i=s.cast.findIndex(x=>x.id===cid); if(i<0) return;
  const j=i+dir; if(j<0||j>=s.cast.length) return;
  pushUndo(); const t=s.cast[i]; s.cast[i]=s.cast[j]; s.cast[j]=t; renderScenes();
}
// #105: swap WHICH library character a library-linked slot points to,
// keeping the same cast id (so its slot letter and per-line staging stay
// exactly where they were) instead of deleting and re-adding the slot.
function setCastCharId(id,cid,charId){
  if(!charId) return;
  const s=scenes[id]; const c=s&&s.cast&&s.cast.find(x=>x.id===cid); if(!c) return;
  pushUndo(); c.charId=charId; renderScenes();
}
async function pickCastMedia(id,cid){ const k=await pickMedia('image'); if(k){ pushUndo(); const c=scenes[id].cast.find(x=>x.id===cid); c.chroma=null; chromaImport(c,k,()=>renderScenes()); } }
function toggleOverlap(id,v){ pushUndo(); scenes[id].overlap=!!v; }
function toggleSpeakerTop(id,v){ pushUndo(); scenes[id].speakerTop=!!v; }
function setMusicStop(id,v){ pushUndo(); if(!scenes[id].music)scenes[id].music={}; scenes[id].music.stop=!!v; renderScenes(); }
function setPortraitScale(id,lid,v){ scenes[id].lines.find(l=>l.id===lid).portrait.scale=parseFloat(v)||1; }
const SCALE_OPTS=[['0.5','50%'],['0.65','65%'],['0.8','80%'],['1','100%'],['1.25','125%'],['1.5','150%']];
function scaleSel(cur,handler,title){ const c=(cur!=null?String(cur):'1'); return `<select class="mini-sel" title="${title||'scale'}" onchange="${handler}">${SCALE_OPTS.map(o=>`<option value="${o[0]}" ${c===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select>`; }
function toggleFaceOnStage(id,lid,cid,on){ pushUndo(); const l=scenes[id].lines.find(x=>x.id===lid); if(!l.stage)l.stage=[];
  if(on){ if(!l.stage.find(s=>s.castId===cid)) l.stage.push({castId:cid,pos:'center'}); }
  else { l.stage=l.stage.filter(s=>s.castId!==cid); if(l.speakingCast===cid)l.speakingCast=''; } renderScenes(); }
/* Blank pos = inherit the canvas layout's manual placement for this slot (if
   any); picking an explicit position pins this character here for this line
   regardless of the canvas layout, so scene-level authoring can override the
   canvas default instead of always losing to it. */
function setFacePos(id,lid,cid,pos){ const l=scenes[id].lines.find(x=>x.id===lid); const s=(l.stage||[]).find(s=>s.castId===cid); if(!s)return;
  if(pos===''){ s.posLocked=false; } else { s.pos=pos; s.posLocked=true; } }
function setSpeaking(id,lid,cid){ scenes[id].lines.find(x=>x.id===lid).speakingCast=cid; renderScenes(); }
/* #4: a character can be on stage (speaking, staged) for a line without
   showing their portrait - e.g. talking from off-screen or another room.
   Font, typing sound and speaker name are unaffected; only the face image
   itself is suppressed at render time (player/runtime.js renderStage()). */
function toggleFaceHidden(id,lid,cid,hidden){ pushUndo(); const s=(scenes[id].lines.find(x=>x.id===lid).stage||[]).find(s=>s.castId===cid); if(s){ s.hidden=hidden; renderScenes(); } }



/* choices */
function newChoice(text,cont){ return { id:genId('c'), text:text, continue:!!cont, effects:[], condition:null, dice:null, routes:[], pickFx:null, outcomes:[{id:genId('o'),type:'default',targetNode:null}] }; }
function addChoice(id){ pushUndo(); scenes[id].choices.push(newChoice('Option',false)); renderScenes(); }
function addChoiceAfter(sid,cid){ pushUndo(); const s=scenes[sid]; const idx=s.choices.findIndex(c=>c.id===cid); const nc=newChoice('',false); s.choices.splice(idx+1,0,nc); renderScenes();
  setTimeout(()=>{ const el=document.getElementById('choice-in-'+nc.id); if(el){ el.focus(); } }, 0); }
function choiceKey(e,sid,cid){
  if(e.key==='Enter' && !(e.ctrlKey||e.metaKey)){ e.preventDefault(); addChoiceAfter(sid,cid); }
  else if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); const ta=e.target; const p=ta.selectionStart; ta.value=ta.value.slice(0,p)+'\n'+ta.value.slice(ta.selectionEnd); setChoice(sid,cid,ta.value); } }
function moveChoice(sid,cid,dir){ const s=scenes[sid]; const i=s.choices.findIndex(c=>c.id===cid); const j=i+dir; if(i<0||j<0||j>=s.choices.length) return; pushUndo(); const t=s.choices[i]; s.choices[i]=s.choices[j]; s.choices[j]=t; renderScenes(); }
let _choiceDrag=null;
function choiceDragStart(e,sid,cid){
  // A connection port sits inside this draggable choice row (for the separate
  // "drag to reorder choices" feature). Chromium walks up from the mousedown
  // target to the nearest draggable ancestor regardless of the port's own
  // draggable attribute, so a gesture starting on a port would otherwise be
  // hijacked into a native reorder-drag and never deliver mousemove/mouseup
  // to the custom connect-by-dragging logic. e.target here is already the
  // row itself (not the port), so we consult _lastMouseDownOnPort, recorded
  // at mousedown time, to tell the two gestures apart and bail out of the
  // native drag when it's actually a connection drag.
  if(_lastMouseDownOnPort){ e.preventDefault(); return; }
  _choiceDrag={sid,cid}; try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',cid); }catch(_){} }
function choiceDrop(e,sid,targetCid){ e.preventDefault(); if(!_choiceDrag||_choiceDrag.sid!==sid) return; const s=scenes[sid];
  const from=s.choices.findIndex(c=>c.id===_choiceDrag.cid); const to=s.choices.findIndex(c=>c.id===targetCid);
  if(from<0||to<0||from===to){ _choiceDrag=null; return; } pushUndo(); const moved=s.choices.splice(from,1)[0]; s.choices.splice(to,0,moved); _choiceDrag=null; renderScenes(); }
function delChoice(id,cid){ pushUndo(); scenes[id].choices=scenes[id].choices.filter(c=>c.id!==cid); renderScenes(); }
function setChoice(id,cid,v){ scenes[id].choices.find(c=>c.id===cid).text=v; }

/* scene mode + cutscene options (title screen / cutscenes) */
function setSceneMode(id,m){ pushUndo(); scenes[id].mode=m; if(m==='cutscene'&&!scenes[id].cutscene) scenes[id].cutscene={dim:0.4,effect:'shadow',size:'lg',align:'center'}; if(m==='viewer'&&!scenes[id].viewer) scenes[id].viewer={kind:'photo360',media:null,loop:true}; renderScenes(); }
function setCutscene(id,f,v){ scenes[id].cutscene[f]=(f==='dim')?parseFloat(v):v; if(f!=='dim') renderScenes(); }

/* #90: viewer scenes, a photo (simple pan/zoom "360") or video (native
   play/pause/seek/fast-forward/rewind controls) filling the whole screen. */
function setViewerKind(id,k){ pushUndo(); scenes[id].viewer.kind=k; renderScenes(); }
async function pickViewerMedia(id){ const v=scenes[id].viewer; const k=await pickMedia(v.kind==='video'?'video':'image'); if(k){ pushUndo(); v.media=k; renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); } }
function clearViewerMedia(id){ pushUndo(); scenes[id].viewer.media=null; renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); }
function setViewerLoop(id,v){ pushUndo(); scenes[id].viewer.loop=!!v; renderScenes(); }

/* scene audio settings (#3) */
function setMusicVol(id,v){ scenes[id].music.volume=parseFloat(v); }
function setMusicFade(id,v){ scenes[id].music.fadeOut=parseFloat(v); }
function setMusicLoop(id,v){ scenes[id].music.loop=!!v; }

/* body resize persistence (#13) */
function saveBodyHeight(id,el){ scenes[id].bodyH=el.offsetHeight; }

/* ---- media picking ------------------------------------------------------ */
const ACCEPT={ image:'image/*', video:'video/*', audio:'audio/*', doc:'.pdf,.txt,.doc,.docx', imageOrVideo:'image/*,video/*' };
function pickMedia(kind){
  return new Promise(res=>{
    if(HAS_BRIDGE()){
      window.pywebview.api.pick_media(kind, (typeof defaultPathFor==='function')?defaultPathFor('media'):'').then(r=>{ if(!r||!r.ok){res(null);return;} const key=makeKey(r.name, r.mtime?{lastModified:r.mtime*1000}:null); project.media[key]=r.dataUrl; res(key); });
    } else {
      const inp=document.getElementById('mediaInput'); inp.value=''; inp.accept=ACCEPT[kind]||'*/*';
      inp.onchange=()=>{ const f=inp.files[0]; if(!f){res(null);return;} const rd=new FileReader();
        rd.onload=()=>{ const key=makeKey(f.name, f); project.media[key]=rd.result; res(key); }; rd.readAsDataURL(f); };
      inp.click();
    }
  });
}
function pickMediaMulti(){
  return new Promise(res=>{
    if(HAS_BRIDGE()){ window.pywebview.api.pick_media('image', (typeof defaultPathFor==='function')?defaultPathFor('media'):'').then(r=>{ if(!r||!r.ok){res([]);return;} const key=makeKey(r.name, r.mtime?{lastModified:r.mtime*1000}:null); project.media[key]=r.dataUrl; res([key]); }); return; }
    const inp=document.getElementById('mediaInput'); inp.value=''; inp.accept='image/*,audio/*,video/*'; inp.multiple=true;
    inp.onchange=()=>{ const files=Array.prototype.slice.call(inp.files); inp.multiple=false; if(!files.length){res([]);return;}
      const keys=[]; let pending=files.length;
      files.forEach(f=>{ const rd=new FileReader(); rd.onload=()=>{ const key=makeKey(f.name, f); project.media[key]=rd.result; keys.push(key); if(--pending===0) res(keys); }; rd.onerror=()=>{ if(--pending===0) res(keys); }; rd.readAsDataURL(f); }); };
    inp.click();
  });
}
// #19: stamps every freshly-minted media key with when it was added to this
// project (and, when the caller has a real File/File-like object handy, when
// the underlying file was last modified outside the project) - see
// recordMediaAdded() in asset-info.js. `file` is optional; callers that mint
// a key without an actual imported file (Sound Studio recordings, a keyed
// chroma-import re-slot) just get the "added" stamp with no modified date.
function makeKey(name, file){ const dot=name.lastIndexOf('.'); const ext=dot>=0?name.slice(dot):''; const base=(dot>=0?name.slice(0,dot):name).replace(/[^a-z0-9_-]/gi,'_').slice(0,24)||'file';
  const key = 'media/'+base+'_'+Math.random().toString(36).substr(2,6)+ext;
  if(typeof recordMediaAdded==='function') recordMediaAdded(key, file);
  return key; }

// #18: one background picker that takes either an image or a video, so you
// never have to know/decide the type before opening the file dialog; the
// actual type is read back off the picked file's own extension.
async function pickBg(id){ const k=await pickMedia('imageOrVideo'); if(k){ pushUndo(); const kind=_assetKind(k); scenes[id].bg={type:kind,media:k}; renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel();
  if(kind==='image' && typeof checkBgStretch==='function') checkBgStretch(k, ()=>{ undo(); renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); }); } }
function clearBg(id){ pushUndo(); scenes[id].bg={type:'none',media:null}; renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); }
async function pickMusic(id){ const k=await pickMedia('audio'); if(k){ pushUndo(); scenes[id].music.media=k; renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); } }
function clearMusic(id){ pushUndo(); scenes[id].music.media=null; renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); }
// A scene's audio can come from an uploaded asset (music.media, the default)
// or stream live from a plain external URL (music.source==='url') - the one
// media type the embeddable HTML export can carry, since it ships no files of
// its own; the full player/SCORM export honours it too (player/runtime.js's
// setMusic), so a project author can preview it exactly the same way either export sees it.
function setMusicSource(id,src){ pushUndo(); scenes[id].music.source=(src==='url')?'url':'local'; renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); }
function setMusicUrl(id,url){ scenes[id].music.url=url||''; }
async function pickPortrait(id,lid){ const k=await pickMedia('image'); if(k){ pushUndo(); const p=scenes[id].lines.find(l=>l.id===lid).portrait; p.chroma=null; chromaImport(p,k,()=>renderScenes()); } }
function clearPortrait(id,lid){ pushUndo(); scenes[id].lines.find(l=>l.id===lid).portrait.media=null; renderScenes(); }
async function pickDoc(id,lid){ const k=await pickMedia('doc'); if(k){ pushUndo(); const l=scenes[id].lines.find(l=>l.id===lid); l.doc.media=k; if(!l.doc.label)l.doc.label='Handout'; renderScenes(); } }
function clearDoc(id,lid){ pushUndo(); const l=scenes[id].lines.find(l=>l.id===lid); l.doc={media:null,label:''}; renderScenes(); }

/* ---- backdrops ---------------------------------------------------------- */
const GROUP_COLORS=['#c026d3','#4f46e5','#0891b2','#16a34a','#ca8a04','#dc2626'];
function createBackdrop(){ pushUndo(); const c=getLogicalCoords({clientX:innerWidth/2,clientY:innerHeight/2});
  const lyr=(typeof currentLayerId!=='undefined')?currentLayerId:'main';
  const id=genId('bd'); backdrops[id]={id,x:Math.max(0,c.x-150),y:Math.max(0,c.y-100),w:360,h:240,color:GROUP_COLORS[Object.keys(backdrops).length%GROUP_COLORS.length],name:'Group'};
  if(lyr!=='main') backdrops[id].layer=lyr;
  renderBackdrops(); }
function updateBackdrop(id,f,v){ backdrops[id][f]=v; if(f==='color')renderBackdrops(); }
function deleteBackdrop(id){ pushUndo(); Object.values(scenes).forEach(s=>{ if(s.group===id) s.group=null; }); delete backdrops[id]; renderAll(); }

/* ---- group membership (#3) --------------------------------------------- */
function nodeSize(id){ const el=document.getElementById(id); return [ (el&&el.offsetWidth)||420, (el&&el.offsetHeight)||280 ]; }
function groupAtPoint(x,y){ let hit=null; Object.values(typeof visibleBackdrops==='function'?visibleBackdrops():backdrops).forEach(b=>{ if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h) hit=b.id; }); return hit; }
function groupMembers(gid){ return Object.values(scenes).filter(s=>s.group===gid); }
function refitGroup(gid, shrink){ const g=backdrops[gid]; if(!g) return; const mem=groupMembers(gid); if(!mem.length) return;
  const PAD=26, HEAD=46; let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  mem.forEach(s=>{ const wh=nodeSize(s.id); x0=Math.min(x0,s.x); y0=Math.min(y0,s.y); x1=Math.max(x1,s.x+wh[0]); y1=Math.max(y1,s.y+wh[1]); });
  const fx=Math.max(0,x0-PAD), fy=Math.max(0,y0-PAD-HEAD), fx1=x1+PAD, fy1=y1+PAD;
  if(shrink){ g.x=fx; g.y=fy; g.w=fx1-fx; g.h=fy1-fy; return; }
  // #19 grow-only: expand to include members but never shrink the box the user sized
  const cx1=(g.x||0)+(g.w||0), cy1=(g.y||0)+(g.h||0);
  const nx=Math.min(g.x!=null?g.x:fx, fx), ny=Math.min(g.y!=null?g.y:fy, fy);
  const nx1=Math.max(cx1, fx1), ny1=Math.max(cy1, fy1);
  g.x=nx; g.y=ny; g.w=nx1-nx; g.h=ny1-ny; }
function shrinkGroupToFit(gid){ pushUndo(); refitGroup(gid, true); renderAll(); toast('Group fit to its contents'); }
function handleSceneDropGroup(id){ const n=scenes[id]; if(!n) return;
  const wh=nodeSize(id), cx=n.x+wh[0]/2, cy=n.y+wh[1]/2, gid=groupAtPoint(cx,cy);
  if(gid && n.group!==gid){
    uiConfirm(`Add scene <b>${escHtml(n.title||'(untitled)')}</b> to group <b>${escHtml(backdrops[gid].name)}</b>?`,
      ()=>{ pushUndo(); n.group=gid; refitGroup(gid); renderAll(); },
      { yes:'Add to group', no:'Keep separate' });
  } else if(!gid && n.group){ const old=n.group; n.group=null; refitGroup(old); renderAll(); }
  else if(gid && n.group===gid){ refitGroup(gid); renderBackdrops(); } }

/* ---- scene stacking order (#72) -----------------------------------------
   All scene boxes share one CSS z-index (.node{z-index:10}), so which one
   visually sits "on top" where two overlap is really just DOM append order;
   later sibling paints over earlier ones. That means z-order can be a pure
   ordering problem (no numeric z-index math, no interaction with the
   separate .node.selected z-index bump that already exists to keep a
   selected node above the connection-line layer). project.meta.zOrder is
   OMITTED entirely for any layer nobody has ever reordered - untouched
   projects render in the same natural (scene-creation) order they always
   did, per CLAUDE.md's "no-op on projects that don't use them" rule. Group
   boxes (.backdrop-group, z-index:2) are a lower z-index than any scene
   node regardless of DOM order, so they already stay behind every scene no
   matter what; they intentionally get no reorder controls of their own. */
function ensureSceneZList(layerId){
  if(!project.meta.zOrder) project.meta.zOrder={};
  const ids=Object.keys(scenes).filter(id=>sceneLayer(scenes[id])===layerId);
  let list=project.meta.zOrder[layerId];
  if(!list) list=ids.slice(); // seed from current natural (creation) order
  else { list=list.filter(id=>ids.includes(id)); ids.forEach(id=>{ if(list.indexOf(id)<0) list.push(id); }); }
  project.meta.zOrder[layerId]=list;
  return list;
}
// read-only: renderScenes() calls this every render, so it must never
// mutate project.meta - only the explicit reorder actions below do that.
function sceneRenderOrder(shownScenesObj, layerId){
  const ids=Object.keys(shownScenesObj);
  const list=project.meta && project.meta.zOrder && project.meta.zOrder[layerId];
  if(!list) return ids.map(id=>shownScenesObj[id]);
  const known=list.filter(id=>ids.includes(id));
  const rest=ids.filter(id=>list.indexOf(id)<0); // e.g. a scene added since the last reorder; renders on top until reordered
  return known.concat(rest).map(id=>shownScenesObj[id]);
}
function bringSceneToFront(id){ const n=scenes[id]; if(!n) return; pushUndo(); const list=ensureSceneZList(sceneLayer(n)); const i=list.indexOf(id); if(i>=0) list.splice(i,1); list.push(id); renderScenes(); }
function sendSceneToBack(id){ const n=scenes[id]; if(!n) return; pushUndo(); const list=ensureSceneZList(sceneLayer(n)); const i=list.indexOf(id); if(i>=0) list.splice(i,1); list.unshift(id); renderScenes(); }
function bringSceneForward(id){ const n=scenes[id]; if(!n) return; const list=ensureSceneZList(sceneLayer(n)); const i=list.indexOf(id); if(i<0||i>=list.length-1) return; pushUndo(); const t=list[i+1]; list[i+1]=list[i]; list[i]=t; renderScenes(); }
function sendSceneBackward(id){ const n=scenes[id]; if(!n) return; const list=ensureSceneZList(sceneLayer(n)); const i=list.indexOf(id); if(i<=0) return; pushUndo(); const t=list[i-1]; list[i-1]=list[i]; list[i]=t; renderScenes(); }

/* generic in-UI confirm modal (replaces browser confirm/alert) */
function uiConfirm(message, onYes, opts){
  opts = opts||{};
  let bg=document.getElementById('ui-confirm');
  if(!bg){
    bg=document.createElement('div'); bg.id='ui-confirm'; bg.className='modal-bg hidden';
    bg.innerHTML='<div class="modal-card" style="max-width:440px">'
      +'<div class="modal-body" id="ui-confirm-msg" style="font-size:14px;line-height:1.55"></div>'
      +'<div class="modal-foot" style="display:flex;gap:8px;justify-content:flex-end">'
      +'<button class="tb-btn" id="ui-confirm-extra" style="display:none"></button>'
      +'<button class="tb-btn" id="ui-confirm-no"></button>'
      +'<button class="tb-btn tb-accent" id="ui-confirm-yes" style="background:var(--accent);color:#fff;border:none"></button>'
      +'</div></div>';
    document.body.appendChild(bg);
    bg.addEventListener('mousedown', e=>{ if(e.target===bg){ const no=bg.querySelector('#ui-confirm-no'); no&&no.click(); } });
  }
  bg.querySelector('#ui-confirm-msg').innerHTML=message
    + (opts.checkbox ? `<label class="chk" style="margin-top:12px"><input type="checkbox" id="ui-confirm-chk"> ${escHtml(opts.checkbox.label||'Don\u2019t ask again')}</label>` : '');
  const yes=bg.querySelector('#ui-confirm-yes'), no=bg.querySelector('#ui-confirm-no'), extra=bg.querySelector('#ui-confirm-extra');
  yes.textContent=opts.yes||'OK'; no.textContent=opts.no||'Cancel';
  const close=()=>{ bg.classList.add('hidden'); yes.onclick=null; no.onclick=null; extra.onclick=null; extra.style.display='none'; };
  yes.onclick=()=>{ const chk=bg.querySelector('#ui-confirm-chk'); if(chk&&chk.checked&&opts.checkbox&&opts.checkbox.onChecked) opts.checkbox.onChecked(); close(); onYes&&onYes(); };
  no.onclick=()=>{ close(); opts.onNo&&opts.onNo(); };
  // opts.extra: an optional third choice (e.g. "Shrink to fit" alongside
  // "keep it"/"undo") - rendered only when this particular call asks for it,
  // so every other uiConfirm() caller is unaffected.
  if(opts.extra){ extra.textContent=opts.extra.label; extra.style.display=''; extra.onclick=()=>{ close(); opts.extra.onClick&&opts.extra.onClick(); }; }
  bg.classList.remove('hidden');
}
/* a themed single-line text prompt (there was no equivalent to uiConfirm for
   free-text input before #69 needed one for renaming assets) - same modal
   chrome, an input instead of just a message, Enter submits/Escape cancels,
   and an optional opts.validate(value) returning an error string blocks
   submit and shows it inline instead of accepting bad input silently. */
function uiPromptText(message, defaultValue, onOk, opts){
  opts = opts||{};
  let bg=document.getElementById('ui-prompt');
  if(!bg){
    bg=document.createElement('div'); bg.id='ui-prompt'; bg.className='modal-bg hidden';
    bg.innerHTML='<div class="modal-card" style="max-width:420px">'
      +'<div class="modal-body" style="font-size:14px;line-height:1.5">'
      +'<div id="ui-prompt-msg" style="margin-bottom:8px"></div>'
      +'<input type="text" id="ui-prompt-input" style="width:100%;background:var(--field);border:1px solid var(--line);color:var(--ink);padding:7px 9px;border-radius:5px;font-size:13px;outline:none">'
      +'<div id="ui-prompt-err" class="hint" style="color:#f87171;min-height:16px;margin-top:4px"></div>'
      +'</div>'
      +'<div class="modal-foot" style="display:flex;gap:8px;justify-content:flex-end">'
      +'<button class="tb-btn" id="ui-prompt-no"></button>'
      +'<button class="tb-btn tb-accent" id="ui-prompt-yes" style="background:var(--accent);color:#fff;border:none"></button>'
      +'</div></div>';
    document.body.appendChild(bg);
    bg.addEventListener('mousedown', e=>{ if(e.target===bg){ const no=bg.querySelector('#ui-prompt-no'); no&&no.click(); } });
  }
  bg.querySelector('#ui-prompt-msg').textContent=message;
  const input=bg.querySelector('#ui-prompt-input'); input.value=defaultValue||'';
  const errEl=bg.querySelector('#ui-prompt-err'); errEl.textContent='';
  const yes=bg.querySelector('#ui-prompt-yes'), no=bg.querySelector('#ui-prompt-no');
  yes.textContent=opts.yes||'OK'; no.textContent=opts.no||'Cancel';
  const close=()=>{ bg.classList.add('hidden'); yes.onclick=null; no.onclick=null; input.onkeydown=null; };
  const submit=()=>{
    const err=opts.validate ? opts.validate(input.value) : null;
    if(err){ errEl.textContent=err; return; }
    close(); onOk&&onOk(input.value);
  };
  yes.onclick=submit;
  no.onclick=()=>{ close(); opts.onNo&&opts.onNo(); };
  input.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); submit(); } else if(e.key==='Escape'){ e.preventDefault(); no.click(); } };
  bg.classList.remove('hidden');
  setTimeout(()=>{ input.focus(); input.select(); },0);
}
/* double-click a header bar to collapse/expand (ignoring inputs & icon buttons) */
function nodeHeaderDbl(e,id){ if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||(e.target.closest&&e.target.closest('.hdr-icon')))return; toggleCollapse(id); }
function groupHeaderDbl(e,id){ if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||(e.target.closest&&(e.target.closest('.bd-collapse')||e.target.closest('.bd-resize'))))return; toggleGroupCollapse(id); }
function setSceneColor(id,c){ const s=scenes[id]; if(!s)return; pushUndo(); s.color=c||null; renderScenes(); if(typeof renderScenesPanel==='function'&&document.getElementById('scene-list'))renderScenesPanel(); }
function collapseAllScenes(){ pushUndo(); Object.values(typeof visibleScenes==='function'?visibleScenes():scenes).forEach(s=>s.collapsed=true); Object.values(typeof visibleBackdrops==='function'?visibleBackdrops():backdrops).forEach(b=>b.collapsed=true); renderAll(); toast('All collapsed'); }
function expandAllScenes(){ pushUndo(); Object.values(typeof visibleScenes==='function'?visibleScenes():scenes).forEach(s=>s.collapsed=false); Object.values(typeof visibleBackdrops==='function'?visibleBackdrops():backdrops).forEach(b=>{ b.collapsed=false; refitGroup(b.id); }); renderAll(); toast('All expanded'); }
function toggleGroupCollapse(id){ pushUndo(); const g=backdrops[id]; g.collapsed=!g.collapsed;
  renderScenes(); // show/measure members first (they were display:none while collapsed)
  if(!g.collapsed) refitGroup(id); // now member sizes are real, so the box fits its contents (#1)
  renderBackdrops(); SceneConnections.renderLines(); }
let bdDrag=null, bdResize=null, nodeRz=null;
function startNodeResize(e,id){ e.stopPropagation(); e.preventDefault(); pushUndoOnce(); const el=document.getElementById(id); const c=getLogicalCoords(e); nodeRz={id,x0:c.x,y0:c.y,w0:el.offsetWidth,h0:el.offsetHeight}; }
function toggleSceneLock(id){ const s=scenes[id]; if(!s)return; pushUndo(); s.locked=!s.locked; renderScenes(); toast(s.locked?'Scene locked in place':'Scene unlocked'); }
// Shared by the right-click "Set as this layer's start scene" item and the
// clickable ▸ icon every non-start scene's own card now shows (a direct
// owner report that this capability didn't appear to exist at all - it did,
// but only reachable via right-click or Settings; this is the single place
// both entry points now call).
function setAsStartScene(id){
  const n=scenes[id]; if(!n) return;
  pushUndo();
  if(typeof setLayerStartScene==='function') setLayerStartScene(sceneLayer(n),id); else project.settings.startScene=id;
  renderScenes(); toast('Start scene set');
}
function startBackdropResize(e,id){ e.stopPropagation(); e.preventDefault(); pushUndoOnce();
  const c=getLogicalCoords(e); const b=backdrops[id]; bdResize={id,x0:c.x,y0:c.y,w0:b.w,h0:b.h}; }
function startBackdropDrag(e,id){ if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return; e.stopPropagation(); pushUndoOnce();
  const c=getLogicalCoords(e); const b=backdrops[id]; bdDrag={id,dx:c.x-b.x,dy:c.y-b.y}; }
function renderBackdrops(){
  const layer=document.getElementById('backdrops-layer'); layer.innerHTML='';
  const shownBackdrops = typeof visibleBackdrops==='function' ? visibleBackdrops() : backdrops;
  Object.values(shownBackdrops).forEach(b=>{
    const members=groupMembers(b.id).length, collapsed=!!b.collapsed;
    const d=document.createElement('div'); d.className='backdrop-group'+(collapsed?' collapsed':''); d.id=b.id;
    d.style.cssText=`left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${collapsed?'auto':b.h+'px'};border-color:${b.color};background:${b.color}18`;
    d.onmousedown=e=>startBackdropDrag(e,b.id);
    d.innerHTML=`<div class="backdrop-header" style="color:${b.color}" ondblclick="groupHeaderDbl(event,'${b.id}')" onclick="if(typeof selectGroupProp==='function' && event.target.tagName!=='INPUT' && !(event.target.closest&&(event.target.closest('.bd-collapse')||event.target.closest('.bd-resize'))))selectGroupProp('${b.id}')" title="Double-click to collapse / expand">
      <span class="bd-collapse" title="Collapse / expand group" onclick="toggleGroupCollapse('${b.id}')">${collapsed?'▸':'▾'}</span>
      <input value="${escAttr(b.name)}" oninput="updateBackdrop('${b.id}','name',this.value)">
      <span class="bd-count">${members?members+(collapsed?' hidden':''):''}</span>${typeof groupPinsHtml==='function'?groupPinsHtml(b):''}
      <span onclick="deleteBackdrop('${b.id}')" style="cursor:pointer;color:#ef4444">✕</span></div><div class="backdrop-body"></div>${collapsed?'':`<div class="bd-resize" title="Drag to resize; double-click to fit to contents" onmousedown="startBackdropResize(event,'${b.id}')" ondblclick="event.stopPropagation();shrinkGroupToFit('${b.id}')"></div>`}`;
    layer.appendChild(d);
  });
}

/* ---- render ------------------------------------------------------------- */
function escHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s){ return (s||'').replace(/"/g,'&quot;'); }

/* Keep the browser tab showing the project actually open (not just a generic
   "Scenemaker" label), since renderScenes() runs after every structural
   change: new/loaded project, title edit, undo/redo, etc. The topbar itself
   no longer shows a wordmark or project title (removed per request). */
function syncProjectChrome(){
  const title=(project.meta&&project.meta.title)||'Untitled Story';
  document.title=title+' · Scenemaker';
}
function renderScenes(){
  syncProjectChrome();
  if(typeof syncAllPortals==='function') syncAllPortals();
  // computed once per render (not once per scene, and not a second time for
  // the layer bar) so the portal-aware bits below stay O(N) on larger projects
  const _allPortalsOnce = typeof allPortalChoices==='function' ? allPortalChoices() : [];
  if(typeof renderLayerBar==='function') renderLayerBar(_allPortalsOnce);
  const layer=document.getElementById('nodes-layer');
  const scrollMap={}; // #1b: keep each scene box's scroll position across the rebuild
  layer.querySelectorAll('.node').forEach(nd=>{ const b=nd.querySelector('.node-body'); if(b) scrollMap[nd.id]=b.scrollTop; });
  layer.innerHTML='';
  const shownScenes = typeof visibleScenes==='function' ? visibleScenes() : scenes;
  const orderedScenes = typeof sceneRenderOrder==='function' ? sceneRenderOrder(shownScenes, currentLayerId) : Object.values(shownScenes);
  orderedScenes.forEach(n=>{
    const el=document.createElement('div'); el.className='node'+(n.collapsed?' collapsed':'')+(selectedNode===n.id?' selected':'')+(n.locked?' locked':'')+((typeof ToolSettings!=='undefined'&&ToolSettings.get('compactCards','1')==='1')?' compact':''); el.id=n.id; if(n.color){ el.style.borderLeft='5px solid '+n.color; el.style.setProperty('--scene-color', n.color); }
    el.style.left=n.x+'px'; el.style.top=n.y+'px'; if(n.w) el.style.width=n.w+'px'; if(n.h && !n.collapsed) el.style.height=n.h+'px';
    el.onmousedown=(e)=>{ if(typeof handleSceneMouseDown==='function'){ handleSceneMouseDown(e,n.id); } else { if((e.target.classList.contains('node')||e.target.classList.contains('node-header')) && !n.locked) startNodeDrag(e,n.id); setSelectedNode(n.id); } };
    el.onmouseup=(e)=>{ if(isDrawingLine) completeConnection(e,n.id); }; /* #12: drop anywhere on a scene to connect */

    const isStart=(typeof layerStartScene==='function' ? layerStartScene(sceneLayer(n)) : project.settings.startScene)===n.id;
    // #78: this scene's own layer's start scene isn't necessarily where a
    // played/exported story actually begins any more, now any layer can be
    // primary - only badge it as the real entry point when its layer IS
    // the primary one; otherwise it's still worth marking (jumping straight
    // to this layer lands here) but shouldn't read as "the" start.
    const isPrimaryStart=isStart && (typeof primaryLayerId!=='function' || primaryLayerId()===sceneLayer(n));
    const incomingPortals = typeof incomingPortalsForScene==='function' ? incomingPortalsForScene(n,_allPortalsOnce) : [];
    const bodyStyle = n.bodyH?`style="height:${n.bodyH}px"`:'';
    // grows directly out of the title bar itself (a child of .node-header,
    // which is position:relative) instead of floating below it with a gap -
    // reads as the header's own left edge extending into a tab, aligned
    // with the title row it's actually returning you to.
    const returnTab = incomingPortals.length ? `<div class="portal-tab portal-tab-left" title="Linked here from ${escAttr(incomingPortals.map(p=>(p.scene.title||'Scene')+' ('+layerName(sceneLayer(p.scene))+')').join(', '))}; double-click to jump back" ondblclick="warpAcrossLayers('${incomingPortals[0].scene.id}')">⇠${incomingPortals.length>1?' '+incomingPortals.length:''}</div>` : '';
    el.innerHTML=
      `<div class="node-header" ondblclick="nodeHeaderDbl(event,'${n.id}')" onclick="if(typeof selectSceneProp==='function' && event.target.tagName!=='INPUT' && !(event.target.closest&&event.target.closest('.hdr-icon')))selectSceneProp('${n.id}')" title="Double-click to collapse / expand · click to edit in Properties">
         ${returnTab}
         <input class="node-title-in" value="${escAttr(n.title)}" oninput="setTitle('${n.id}',this.value)" placeholder="Scene title">
         <span style="display:flex;gap:9px;align-items:center;font-size:11px">
           ${isStart?(isPrimaryStart?'<span title="Start scene of the primary layer; the story\'s actual entry point when played or exported" style="color:var(--accent)">▸ START</span>':'<span title="Start scene of this layer only; not the story\'s actual entry point, since this isn\'t the primary layer" style="color:var(--mut)">▸ layer start</span>')
             // A direct owner report ("there does not appear to be an
             // ability to designate a new/different scene as the starting
             // scene") - the capability itself already existed (right-click
             // -> "Set as this layer's start scene", or Settings -> Story),
             // but nothing on an ORDINARY scene's own card hinted that was
             // possible; the only on-card sign of the feature at all was the
             // passive "START" label on whichever scene already had it. A
             // small clickable icon on every OTHER scene makes the action
             // itself discoverable right where you'd look for it, no
             // right-click or Settings dive required.
             :'<span class="hdr-icon" title="Set as this layer\'s start scene" onclick="setAsStartScene(\''+n.id+'\')" style="color:var(--mut)">▸</span>'}
           <span class="hdr-icon" title="Edit in focus view" onclick="focusScene('${n.id}')">⤢</span>
           <span class="hdr-icon" title="Duplicate scene" onclick="duplicateScene('${n.id}')">⧉</span>
           <span class="hdr-icon" title="Add linked next scene (inherits look)" onclick="addLinkedNext('${n.id}')">➔＋</span>
           <span class="hdr-icon" title="Collapse" onclick="toggleCollapse('${n.id}')" style="color:#94a3b8">${n.collapsed?'▸':'▾'}</span>
           <span class="hdr-icon" title="Delete scene" onclick="confirmDeleteScene('${n.id}')" style="color:#ef4444">✕</span>
         </span>
       </div>
       ${typeof scenePinsHtml==='function'?scenePinsHtml(n):''}
       <div class="node-body" ${bodyStyle} onmouseup="saveBodyHeight('${n.id}',this)">${sceneMediaHtml(n)}${n.lines.map((l,li)=>{ const natSame=li>0 && !!l.speakingCast && n.lines[li-1].speakingCast===l.speakingCast && !l.speaker; const open=typeof _lineOverrideOpen!=='undefined' && !!_lineOverrideOpen[l.id]; return lineHtml(n,l, natSame && !open, natSame, li>0?n.lines[li-1]:null); }).join('')}
         <button class="mini-btn" style="align-self:flex-start" onclick="addLine('${n.id}')" title="Add another dialogue line to this scene">+ line</button>
       </div>
       ${choicesBlockHtml(n)}
       <div class="port in ${n.collapsed?'collapsed-in':''}" id="in-${n.id}" onmouseup="completeConnection(event,'${n.id}')" onmousedown="disconnectInputPort(event,'${n.id}')" title="Input; drag from here (or just press) to disconnect an incoming line"></div>
       ${n.collapsed?`<div class="port out collapsed-out" id="out-collapsed-${n.id}" onmousedown="disconnectPort(event,'${n.id}',null,null)"></div>`:''}
       ${n.collapsed?'':`<div class="node-rz" title="Drag to resize" onmousedown="startNodeResize(event,'${n.id}')"></div>`}`;
    const grp = n.group && backdrops[n.group];
    if(grp && grp.collapsed) el.style.display='none'; // #3: members hidden while group collapsed
    layer.appendChild(el);
  });
  Object.keys(scrollMap).forEach(id=>{ const nd=document.getElementById(id); if(nd){ const b=nd.querySelector('.node-body'); if(b) b.scrollTop=scrollMap[id]; } });
  SceneConnections.renderLines();
  if(typeof renderScenesPanel==='function' && document.getElementById('scene-list')) renderScenesPanel();
  if(typeof renderPropsPanel==='function' && document.getElementById('props-list')){ var _ae=document.activeElement, _pl=document.getElementById('props-list'); if(!(_ae && _pl.contains(_ae) && (_ae.tagName==='INPUT'||_ae.tagName==='TEXTAREA'))) renderPropsPanel(); }
  if(focusId && !document.getElementById('focus-modal').classList.contains('hidden')) refreshFocus();
}

function audioSettingsHtml(n){
  const mu=n.music||{};
  const hasTrack = !!mu.media || (mu.source==='url' && !!mu.url);
  const stopRow=`<label class="chk" style="margin:0 0 0 6px"><input type="checkbox" ${mu.stop?'checked':''} onchange="setMusicStop('${n.id}',this.checked)"><img class="btn-ico" style="width:11px;height:11px" src="../assets/icons/stop.png" alt=""> stop audio here</label>`;
  if(!hasTrack){
    return `<div class="audio-row">${stopRow}<span class="hint" style="margin-left:8px">No track set → audio from an earlier scene keeps playing &amp; looping. Tick "stop audio here" for silence.</span></div>`;
  }
  const vol=Math.round((mu.volume!=null?mu.volume:0.6)*100), fade=(mu.fadeOut||0);
  return `<div class="audio-row">
      <label class="chk" style="margin:0"><input type="checkbox" ${mu.loop!==false?'checked':''} onchange="setMusicLoop('${n.id}',this.checked)"> loop</label>
      <span>vol</span><input type="range" min="0" max="1" step="0.05" value="${(mu.volume!=null?mu.volume:0.6)}" oninput="setMusicVol('${n.id}',this.value)">
      <span>fade-out</span><input type="range" min="0" max="10" step="0.5" value="${fade}" oninput="setMusicFade('${n.id}',this.value)"><span>${fade}s</span>
      ${stopRow}
    </div>`;
}
function sceneModeHtml(n){
  const mode=n.mode||'dialogue';
  const seg=(m,label)=>`<button class="${mode===m?'on':''}" onclick="setSceneMode('${n.id}','${m}')">${label}</button>`;
  let opts='';
  if(mode==='cutscene'){
    const cs=n.cutscene||{dim:0.4,effect:'shadow',size:'lg',align:'center'};
    const sel=(f,arr,cur)=>`<select class="mini-sel" onchange="setCutscene('${n.id}','${f}',this.value)">${arr.map(o=>`<option value="${o}" ${cur===o?'selected':''}>${o}</option>`).join('')}</select>`;
    opts=`<div class="audio-row" style="margin-top:4px">
        <span>dim</span><input type="range" min="0" max="0.9" step="0.05" value="${cs.dim}" oninput="setCutscene('${n.id}','dim',this.value)"><span>${Math.round((cs.dim||0)*100)}%</span>
        <span>fx</span>${sel('effect',['none','shadow','emboss','outline','glow'],cs.effect)}
        <span>size</span>${sel('size',['md','lg','xl'],cs.size)}
        <span>pos</span>${sel('align',['top','center','bottom'],cs.align)}
      </div><div class="hint">Cutscene: text is layered over the background; speaker & portrait are ignored.</div>`;
  }
  if(mode==='viewer'){
    const v=n.viewer||{kind:'photo360',media:null,loop:true};
    const isVideo=v.kind==='video';
    const thumb = v.media ? (isVideo
        ? `<video src="${mediaURL(v.media)}" style="width:60px;height:36px;object-fit:cover;border-radius:4px" muted></video>`
        : `<img src="${mediaURL(v.media)}" style="width:60px;height:36px;object-fit:cover;border-radius:4px">`)
      : `<span class="hint">no media</span>`;
    opts=`<div class="audio-row" style="margin-top:4px;flex-wrap:wrap">
        <div class="pos-seg">
          <button class="${!isVideo?'on':''}" onclick="setViewerKind('${n.id}','photo360')">Photo</button>
          <button class="${isVideo?'on':''}" onclick="setViewerKind('${n.id}','video')">Video</button>
        </div>
        ${thumb}
        <button class="mini-btn" onclick="pickViewerMedia('${n.id}')">${v.media?'Change...':'+ media'}</button>
        ${v.media?`<button class="mini-btn" onclick="clearViewerMedia('${n.id}')">Clear</button>`:''}
        ${isVideo?`<label class="chk" title="Restart the video from the beginning once it ends, instead of stopping on the last frame"><input type="checkbox" ${v.loop?'checked':''} onchange="setViewerLoop('${n.id}',this.checked)"> loop</label>`:''}
      </div><div class="hint">${isVideo
        ? 'Video fills the whole screen with the browser\'s own play/pause/seek/fast-forward/rewind controls.'
        : 'Photo fills the whole screen; drag to look around, scroll/pinch to zoom (a simplified pan/zoom, not a true spherical 360).'}</div>`;
  }
  // #10: Dialogue already had its own icon (dialogue.png); Cutscene never
  // got one, reading as an inconsistent, half-finished pair. An inline SVG
  // (a small clapperboard, the standard "cutscene/cinematic" glyph) needs no
  // new asset file and, using currentColor, actually matches the surrounding
  // label's own colour on every theme rather than a fixed PNG tint.
  // NOTE: editor.html has a blanket `svg{position:absolute;width:100%;
  // height:100%;...}` rule meant for the connection-lines layer - it
  // catches every <svg> in the document, not just that one, and a stray
  // inline icon SVG would otherwise balloon to fill its nearest positioned
  // ancestor. The inline style below (higher specificity than that bare-
  // element rule) overrides position/width/height back to a normal small
  // inline icon.
  const cutsceneIco=`<svg class="seg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:static;display:inline-block;width:12px;height:12px;vertical-align:-2px;margin-right:2px;opacity:.9"><path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z"/><path d="M3 8l2-4h3l-2 4"/><path d="M9 8l2-4h3l-2 4"/><path d="M15 8l2-4h3l-2 4"/></svg>`;
  // #90: a magnifying-glass-over-a-frame glyph, same inline-SVG/currentColor
  // treatment as the cutscene icon above (and for the same reason: matches
  // whichever theme is active instead of a fixed PNG tint, no new asset file).
  const viewerIco=`<svg class="seg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:static;display:inline-block;width:12px;height:12px;vertical-align:-2px;margin-right:2px;opacity:.9"><rect x="3" y="4" width="14" height="11" rx="1.5"/><circle cx="17.5" cy="17.5" r="3.5"/><path d="M20 20l2 2"/></svg>`;
  return `<div class="media-slot"><span style="color:var(--mut)">Scene type</span>
    <div class="pos-seg">${seg('dialogue','<img class="seg-ico" src="../assets/icons/dialogue.png" alt="">Dialogue')}${seg('cutscene',cutsceneIco+'Cutscene')}${seg('viewer',viewerIco+'Viewer')}</div></div>${opts}`;
}
function castHtml(n){
  const cast=n.cast||[]; const lib=project.characters||[];
  const rows=cast.map((c,idx)=>{
    // the on-stage letter (A/B/C…) matches the Canvas editor's sample-
    // portrait lettering 1:1 (same cast-array order), so authors can see
    // "who character A is" right in the scene box instead of guessing.
    const letter=String.fromCharCode(65+idx);
    const letterChip=`<span class="cast-letter" title="On-stage slot ${letter}; matches the Canvas editor's sample portrait ${letter}">${letter}</span>`;
    // #105: reordering changes each entry's letter (pure array position), so
    // this is the direct fix for "which slot is who" - move a character up/
    // down instead of deleting and re-adding it (which would also orphan any
    // per-line staging/speaking already set up against its cast id).
    const canUp=idx>0, canDown=idx<cast.length-1;
    const reorderBtns=`<span class="hdr-icon" style="${canUp?'':'opacity:.3;pointer-events:none'}" title="Move up to slot ${canUp?String.fromCharCode(65+idx-1):letter}" onclick="moveCast('${n.id}','${c.id}',-1)">▲</span><span class="hdr-icon" style="${canDown?'':'opacity:.3;pointer-events:none'}" title="Move down to slot ${canDown?String.fromCharCode(65+idx+1):letter}" onclick="moveCast('${n.id}','${c.id}',1)">▼</span>`;
    if(c.charId){ const ch=(project.characters||[]).find(x=>x.id===c.charId)||{name:'(missing)',media:null,size:'?',enter:'?'};
      const dot=ch.color?`<span class="color-dot" style="background:${escAttr(ch.color)}" title="Colour-coded ${escAttr(ch.name)} (editor only, never shown in the exported game)"></span>`:'';
      // #105: swap WHICH library character this exact slot points to, keeping
      // the same cast id (and so the same slot letter, and any per-line
      // staging/speaking already set up here) - the alternative, delete-and-
      // re-add, silently drops all of that.
      const swapSel = lib.length>1 ? `<select class="mini-sel" title="Change which library character slot ${letter} shows; the slot itself (and its per-line staging) stays put" onchange="setCastCharId('${n.id}','${c.id}',this.value)">${lib.map(ch2=>`<option value="${ch2.id}" ${ch2.id===c.charId?'selected':''}>${escHtml(ch2.name)}</option>`).join('')}</select>` : '';
      return `<div class="line-top" style="gap:4px">
        ${letterChip}${reorderBtns}${dot}
        <div class="portrait-mini">${mediaURL(ch.media)?`<img src="${mediaURL(ch.media)}">`:'👤'}</div>
        <span style="flex:1;font-size:12px;color:#c4b5fd" title="From the character library; edit it in Settings → Character library, and every scene using it updates too">👥 ${escHtml(ch.name)} <span class="hint">(library · ${ch.size}/${ch.enter})</span></span>
        ${swapSel}
        <span class="hdr-icon" style="color:#ef4444" onclick="delCast('${n.id}','${c.id}')">✕</span></div>`; }
    return `<div class="line-top" style="gap:4px">
      ${letterChip}${reorderBtns}
      <div class="portrait-mini" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropCastMedia(event,'${n.id}','${c.id}')" title="Drop an image asset here to set this face">${mediaURL(c.media)?`<img src="${mediaURL(c.media)}">`:'👤'}</div>
      <input class="speaker-in" style="max-width:96px" value="${escAttr(c.name)}" placeholder="name" oninput="setCast('${n.id}','${c.id}','name',this.value)">
      <button class="mini-btn" onclick="pickCastMedia('${n.id}','${c.id}')">${c.media?'img✓':'+img'}</button>
      ${c.media?`<button class="mini-btn" title="Background transparency" onclick="chromaCast('${n.id}','${c.id}')">bg</button>`:''}
      <select class="mini-sel" title="size" onchange="setCast('${n.id}','${c.id}','size',this.value)">${CAST_SIZES.map(s=>`<option value="${s}" ${c.size===s?'selected':''}>${s}</option>`).join('')}</select>
      ${scaleSel(c.scale,`setCast('${n.id}','${c.id}','scale',this.value)`)}
      <select class="mini-sel" title="entrance" onchange="setCast('${n.id}','${c.id}','enter',this.value)">${CAST_ENTER.map(s=>`<option value="${s}" ${c.enter===s?'selected':''}>${s}</option>`).join('')}</select>
      <select class="mini-sel" title="border" onchange="setCast('${n.id}','${c.id}','border',this.value)">${BORDER_OPTS.map(b=>`<option value="${b}" ${c.border===b?'selected':''}>${b}</option>`).join('')}</select>
      <button class="mini-btn" title="Save this character to the library so you can reuse it in other scenes" onclick="sendCastToLibrary('${n.id}','${c.id}')">⬆ to library</button>
      <span class="hdr-icon" style="color:#ef4444" onclick="delCast('${n.id}','${c.id}')">✕</span></div>`;
  }).join('');
  const libPick=lib.length?`<select class="mini-sel" id="libpick-${n.id}">${lib.map(c=>`<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}</select><button class="mini-btn" onclick="addCastFromLib('${n.id}')" title="Add an existing library character to this scene">+ from library</button>`:'';
  return `<div class="scene-media" onclick="if(typeof selectSceneProp==='function' && event.target.tagName!=='BUTTON' && event.target.tagName!=='SELECT' && event.target.tagName!=='INPUT')selectSceneProp('${n.id}')">
    <div class="media-slot"><span style="color:var(--mut)">Cast (on-screen faces)</span>
      <button class="mini-btn" onclick="addCast('${n.id}')" title="Add an on-stage face/portrait to this scene">+ face</button>${libPick}
      <label class="chk" style="margin:0 0 0 6px"><input type="checkbox" ${n.speakerTop!==false?'checked':''} onchange="toggleSpeakerTop('${n.id}',this.checked)"> speaker on top</label></div>
    ${rows}
    <div class="hint">${cast.length?'Per line, tick who\'s on stage, set position, and pick 🎤 who speaks. 👥 = a reusable library character (edit it in Settings → Character library).':'No cast → each line uses its single portrait below. Add faces here for a multi-portrait stage.'}</div>
  </div>`;
}
// #9: stageHtml() renders into TWO places at once when a line's stage grid
// is expanded in the scene box AND that same line is open in the
// Properties panel - two separate DOM copies of the same radio group, but
// a native <input type=radio name="..."> group is scoped to the whole
// document (no enclosing <form> here), not to whichever container it's
// rendered in. Sharing one literal name across both copies meant clicking
// a radio in one copy natively unchecked ITS OWN element correctly, but
// left the OTHER copy's matching radio unchecked too (browsers only check
// the exact element you interacted with, never a same-name sibling
// elsewhere in the document) - reading as "the dot didn't appear" until
// something else forced a full re-render of that other copy. `ctx`
// distinguishes the two render sites so their radio groups can't cross-talk;
// the underlying speakingCast value (and both copies' next re-render) is
// unaffected either way.
// #104: with several characters on one line, the old vertical stack of every
// cast member's full row (position/face-state/speaker/hide controls) grew
// tall fast - a busy 4+ character line could push the rest of the scene card
// well down the page. Only the ACTIVE tab's row actually renders now; the
// rest collapse into a strip of small letter tabs above it. Purely a UI
// convenience (which tab is showing), never saved with the project -
// _stageTabSel is keyed by ctx+lineId so the scene box and the Properties
// panel's own copy of this same grid (see the #9 comment below) remember
// their own tab independently, exactly like their radio-group naming already
// does for the same reason.
let _stageTabSel = {};
function _stageTabKey(lid,ctx){ return (ctx||'')+lid; }
function selectStageTab(nid,lid,cid,ctx){ _stageTabSel[_stageTabKey(lid,ctx)]=cid; renderScenes(); }
function _stageActiveCastId(n,l,ctx){
  const cast=n.cast||[]; const st=l.stage||[]; const on=id=>st.find(s=>s.castId===id);
  const stored=_stageTabSel[_stageTabKey(l.id,ctx)];
  if(stored && cast.find(c=>c.id===stored)) return stored;
  if(l.speakingCast && cast.find(c=>c.id===l.speakingCast)) return l.speakingCast;
  const firstStaged=cast.find(c=>on(c.id));
  return (firstStaged||cast[0]).id;
}
// #9: stageHtml() renders into TWO places at once when a line's stage grid
// is expanded in the scene box AND that same line is open in the
// Properties panel - two separate DOM copies of the same radio group, but
// a native <input type=radio name="..."> group is scoped to the whole
// document (no enclosing <form> here), not to whichever container it's
// rendered in. Sharing one literal name across both copies meant clicking
// a radio in one copy natively unchecked ITS OWN element correctly, but
// left the OTHER copy's matching radio unchecked too (browsers only check
// the exact element you interacted with, never a same-name sibling
// elsewhere in the document) - reading as "the dot didn't appear" until
// something else forced a full re-render of that other copy. `ctx`
// distinguishes the two render sites so their radio groups can't cross-talk;
// the underlying speakingCast value (and both copies' next re-render) is
// unaffected either way.
function stageHtml(n,l,ctx){
  ctx = ctx || '';
  const cast=n.cast||[]; if(!cast.length) return '';
  const st=l.stage||[]; const on=id=>st.find(s=>s.castId===id);
  const activeId=_stageActiveCastId(n,l,ctx);
  const tabs = cast.length<2 ? '' : `<div class="stage-tabs">${cast.map((c,idx)=>{
    const letter=String.fromCharCode(65+idx); const cp=castProps(c); const staged=!!on(c.id);
    return `<span class="stage-tab${c.id===activeId?' active':''}${staged?' staged':''}" title="${escAttr(cp.name||'face')}${staged?' - on stage this line':' - not on stage this line'}" onclick="selectStageTab('${n.id}','${l.id}','${c.id}','${ctx}')">${letter}</span>`;
  }).join('')}</div>`;
  const activeIdx=cast.findIndex(c=>c.id===activeId); const c=cast[activeIdx];
  const s=on(c.id); const cp=castProps(c); const nm=cp.name||'face'; const stObj=(s&&s.state)?((cp.portraits||[]).find(p=>p.id===s.state)||null):null; const face=(stObj&&stObj.media)||cp.media; const thumb=mediaURL(face)?`<img src="${mediaURL(face)}">`:'👤';
  const letter=String.fromCharCode(65+activeIdx);
  const dot=cp.color?`<span class="color-dot" style="background:${escAttr(cp.color)}" title="Colour-coded (editor only)"></span>`:'';
  const row=`<div class="line-top cast-face" id="cast-${c.id}" style="gap:4px;align-items:center" onclick="if(typeof selectCastProp==='function' && event.target.tagName!=='INPUT' && event.target.tagName!=='SELECT')selectCastProp('${n.id}','${c.id}')">
      <span class="cast-letter" title="On-stage slot ${letter}">${letter}</span>${dot}
      <div class="portrait-mini" style="width:22px;height:22px">${thumb}</div>
      <label class="chk" style="margin:0"><input type="checkbox" ${s?'checked':''} onchange="toggleFaceOnStage('${n.id}','${l.id}','${c.id}',this.checked)"> ${escHtml(nm)}</label>
      ${s?`<select class="mini-sel" title="Blank = use the canvas layout's placement for this slot; a position pins this character here, overriding the canvas layout" onchange="setFacePos('${n.id}','${l.id}','${c.id}',this.value)"><option value="" ${!s.posLocked?'selected':''}>(canvas default)</option>${STAGE_POS.map(p=>`<option value="${p}" ${s.posLocked&&s.pos===p?'selected':''}>${p}</option>`).join('')}</select>
        ${(cp.portraits&&cp.portraits.length&&typeof stateOptions==='function')?`<select class="mini-sel" title="face / state" onchange="setFaceState('${n.id}','${l.id}','${c.id}',this.value)">${stateOptions(cp,s.state||'')}</select>`:''}
        <label class="chk" style="margin:0" title="speaking this line"><input type="radio" name="spk-${l.id}${ctx}" ${l.speakingCast===c.id?'checked':''} onclick="setSpeaking('${n.id}','${l.id}','${c.id}')"> 🎤</label>
        <label class="chk" style="margin:0" title="Keep them in the scene (speaking, staged) but don't show their portrait for this line"><input type="checkbox" ${s.hidden?'checked':''} onchange="toggleFaceHidden('${n.id}','${l.id}','${c.id}',this.checked)"> 🚫 hide</label>`:''}
    </div>`;
  return `<div class="line-stage" style="background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:6px"><div class="hint" style="margin-bottom:3px">Stage; this line</div>${tabs}${row}</div>`;
}
/* a scene box repeating the full editable Stage grid on every single line -
   even when nothing about who's on stage actually changed from the line
   above - was a big part of why consecutive lines still read as "spread
   out" even after the earlier same-speaker join. Full editing already lives
   in the Properties panel (which reuses this exact stageHtml()), so a line
   whose stage is byte-identical to the one before it collapses to one
   compact row of letter/colour/mic chips instead, with a link into
   Properties for anything that actually needs changing. Any REAL stage
   change (someone enters/exits, a position pins, a different speaker) still
   shows the full grid inline, since that's exactly the case worth seeing
   without an extra click. */
/* a canonical, order-stable string for a line's stage array, comparing only
   the fields that actually affect what's shown/how - NOT a raw JSON.stringify
   of the stored objects, since e.g. an untouched entry (no "hidden" key at
   all) and one explicitly toggled hidden-then-unhidden again (hidden:false)
   mean exactly the same thing but would otherwise never compare equal. */
function _stageKey(stage){
  return (stage||[]).map(s=>[s.castId, s.pos||'', !!s.posLocked, s.state||'', !!s.hidden].join(':')).sort().join('|');
}
function stageSummaryHtml(n,l){
  const cast=n.cast||[]; const st=l.stage||[]; const on=id=>st.find(s=>s.castId===id);
  const onStage=cast.map((c,idx)=>({c,idx})).filter(({c})=>on(c.id));
  const editLink=`<span class="hdr-icon" onclick="selectLineProp('${n.id}','${l.id}')" title="Edit who's on stage for this line, in Properties">🖉 edit</span>`;
  if(!onStage.length) return `<div class="line-top line-stage-summary"><span class="hint">No one on stage this line.</span>${editLink}</div>`;
  const chips=onStage.map(({c,idx})=>{ const s=on(c.id); const cp=castProps(c); const letter=String.fromCharCode(65+idx);
    const dot=cp.color?`<span class="color-dot" style="background:${escAttr(cp.color)}" title="Colour-coded (editor only)"></span>`:'';
    const mic=(l.speakingCast===c.id)?' 🎤':''; const hideTag=s.hidden?' 🚫':'';
    return `<span class="cast-letter" title="${escAttr(cp.name||'face')}${mic?' (speaking)':''}">${letter}</span>${dot}${mic}${hideTag}`; }).join(' ');
  return `<div class="line-top line-stage-summary" style="gap:6px" title="Same stage as the line above"><span class="hint">Stage:</span>${chips}${editLink}</div>`;
}
function sceneMediaHtml(n){
  const bg=n.bg||{type:'none'}, mu=n.music||{media:null};
  let thumb; if(bg.type==='image'&&mediaURL(bg.media)) thumb=`<img src="${mediaURL(bg.media)}">`;
  else if(bg.type==='video'&&mediaURL(bg.media)) thumb=`<video src="${mediaURL(bg.media)}" muted></video>`; else thumb='no bg';
  // #18/#23: an unset background/music box is real estate the scene box
  // doesn't need to spend on a big empty thumbnail (or even two separate
  // rows); when BOTH are unset they collapse into one shared compact row,
  // with a single drop zone that figures out whether what landed on it is a
  // background (image/video) or music (audio) instead of needing two zones.
  // The moment either one is actually set it gets its own full row back
  // (thumbnail + change/clear), since that's real, useful content.
  if(bg.type==='none' && !mu.media){
    const emptyRow=`<div class="media-slot media-slot-empty" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropSceneMedia(event,'${n.id}')" title="Drop an image, video, or audio asset here to set it as this scene's background or audio">
        <span style="color:var(--mut)">🎨 no background · ♪ no audio</span>
        <button class="mini-btn" onclick="pickBg('${n.id}')" title="Set a background image or video for this scene">+ background</button>
        <button class="mini-btn" onclick="pickMusic('${n.id}')" title="Set background audio for this scene">+ audio</button></div>`;
    return `<div class="scene-media" onclick="if(typeof selectSceneProp==='function' && event.target.tagName!=='BUTTON' && event.target.tagName!=='SELECT' && event.target.tagName!=='INPUT')selectSceneProp('${n.id}')">
      ${sceneModeHtml(n)}
      ${emptyRow}
      <div class="scene-audio-extra">${audioSettingsHtml(n)}</div>
    </div>${castHtml(n)}`;
  }
  const bgRow = bg.type==='none'
    ? `<div class="media-slot media-slot-empty" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropSceneBg(event,'${n.id}')" title="Drop an image or video asset here to set it as the background">
        <span style="color:var(--mut)">🎨 no background</span>
        <button class="mini-btn" onclick="pickBg('${n.id}')" title="Set a background image or video for this scene">+ background</button></div>`
    : `<div class="media-slot"><div class="media-thumb" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropSceneBg(event,'${n.id}')" title="Drop an image or video asset here to set it as the background">${thumb}</div><span style="color:var(--mut)">Background</span>
        <button class="mini-btn" onclick="pickBg('${n.id}')" title="Change this scene's background image or video">change</button>
        <button class="mini-btn warn" onclick="clearBg('${n.id}')" title="Remove this scene’s background">clear</button></div>`;
  const musicRow = !mu.media
    ? `<div class="media-slot media-slot-empty" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropSceneMusic(event,'${n.id}')" title="Drop an audio asset here to set it as this scene's audio">
        <span style="color:var(--mut)">♪ no audio of its own</span>
        <button class="mini-btn" onclick="pickMusic('${n.id}')" title="Set background audio for this scene">+ audio</button></div>`
    : `<div class="media-slot"><div class="media-thumb" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropSceneMusic(event,'${n.id}')" title="Drop an audio asset here to set it as this scene's audio">♪</div><span style="color:var(--mut)">Audio</span>
        <button class="mini-btn" onclick="pickMusic('${n.id}')" title="Set background audio for this scene">change</button>
        <button class="mini-btn warn" onclick="clearMusic('${n.id}')" title="Remove this scene’s audio">clear</button></div>`;
  return `<div class="scene-media" onclick="if(typeof selectSceneProp==='function' && event.target.tagName!=='BUTTON' && event.target.tagName!=='SELECT' && event.target.tagName!=='INPUT')selectSceneProp('${n.id}')">
    ${sceneModeHtml(n)}
    ${bgRow}
    ${musicRow}
    <div class="scene-audio-extra">${audioSettingsHtml(n)}</div>
  </div>${castHtml(n)}`;
}
function lineHtml(n,l,sameSpk,canCollapse,prevLine){
  const p=l.portrait||{media:null,pos:'left',border:'none'}, doc=l.doc||{media:null,label:''};
  const hasCast=(n.cast||[]).length>0;
  const pThumb=mediaURL(p.media)?`<img src="${mediaURL(p.media)}">`:'👤';
  const seg=pos=>`<button class="${p.pos===pos?'on':''}" onclick="setPortraitPos('${n.id}','${l.id}','${pos}')">${pos[0].toUpperCase()}</button>`;
  const borderSel=`<select class="mini-sel" title="Portrait border" onchange="setPortraitBorder('${n.id}','${l.id}',this.value)">${BORDER_OPTS.map(b=>`<option value="${b}" ${p.border===b?'selected':''}>${b}</option>`).join('')}</select>`;
  const fontSel=`<select class="mini-sel" title="Line font (blank = universal)" onchange="setLineFont('${n.id}','${l.id}',this.value)"><option value="">font: default</option>${FONT_OPTS.map(f=>`<option value="${f}"${fontOptionStyle(f)} ${l.font===f?'selected':''}>${f}</option>`).join('')}</select>`;
  // a line whose stage (who's on/off, positions, hidden, speaker) is
  // byte-identical to the one above it shows a compact chip summary instead
  // of repeating the full editable grid - see stageSummaryHtml() above.
  const stageUnchanged = hasCast && prevLine && _stageKey(l.stage)===_stageKey(prevLine.stage) && l.speakingCast===prevLine.speakingCast;
  const portraitRow = hasCast ? (stageUnchanged?stageSummaryHtml(n,l):stageHtml(n,l)) : `<div class="line-top">
      <button class="mini-btn" onclick="pickPortrait('${n.id}','${l.id}')">${p.media?'change face':'+ face'}</button>
      ${p.media?`<button class="mini-btn" title="Background transparency" onclick="chromaPortrait('${n.id}','${l.id}')">bg</button>`:''}
      ${p.media?`<button class="mini-btn warn" onclick="clearPortrait('${n.id}','${l.id}')">×</button>`:''}
      <div class="pos-seg">${seg('left')}${seg('center')}${seg('right')}</div>${borderSel}${p.media?scaleSel(p.scale,`setPortraitScale('${n.id}','${l.id}',this.value)`,'portrait scale'):''}
      ${p.media?`<label class="chk" style="margin:0" title="Keep speaking (font, sound) but don't show the portrait for this line"><input type="checkbox" ${p.hidden?'checked':''} onchange="setPortraitHidden('${n.id}','${l.id}',this.checked)"> 🚫 hide</label>`:''}</div>`;
  // #3: a consecutive same-speaker cast line collapses its (otherwise always-
  // empty) speaker-override row into one small button, so the boxes read as
  // one continuous block of dialogue instead of a run of near-identical
  // near-empty cards. Clicking it (or typing a real override / picking a
  // different speaker in Stage below) detaches this line for real.
  const speakerRow = (hasCast && sameSpk)
    ? `<div class="line-top line-top-collapsed">
        <button class="mini-btn" onclick="toggleLineOverride('${l.id}')" title="This line follows the same speaker; click to override who's speaking it (type a name, or pick a different character below)">🖉 override speaker</button>
        <span onclick="delLine('${n.id}','${l.id}')" style="cursor:pointer;color:#ef4444;font-size:12px;margin-left:auto">✕</span>
      </div>`
    : `<div class="line-top">
      ${hasCast?'':`<div class="portrait-mini" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropLinePortrait(event,'${n.id}','${l.id}')" title="Drop an image asset here to set this line's portrait">${pThumb}</div>`}
      <input class="speaker-in" value="${escAttr(l.speaker)}" placeholder="${hasCast?'Speaker override (blank = use 🎤 face name)':'Speaker name (blank = narrator)'}" oninput="setLine('${n.id}','${l.id}','speaker',this.value)">
      ${(hasCast && canCollapse && !sameSpk)?`<span class="hdr-icon" onclick="toggleLineOverride('${l.id}')" title="Nothing's actually overridden yet; collapse this back to following the previous speaker">▴</span>`:''}
      <span onclick="delLine('${n.id}','${l.id}')" style="cursor:pointer;color:#ef4444;font-size:12px">✕</span>
    </div>`;
  // #6: a colour-coded speaker (set in the Characters panel) tints this
  // line's left edge, so you can tell who's talking at a glance in the
  // scene box without reading every name - editor-only, never exported.
  let spkColor='';
  if(hasCast && l.speakingCast){ const entry=(n.cast||[]).find(c=>c.id===l.speakingCast); if(entry){ const cp=castProps(entry); if(cp.color) spkColor=cp.color; } }
  return `<div class="dialogue-line${sameSpk?' line-samespk':''}" id="line-${l.id}" ${spkColor?`style="border-left:3px solid ${escAttr(spkColor)}"`:''} onclick="if(typeof selectLineProp==='function' && event.target.tagName!=='BUTTON')selectLineProp('${n.id}','${l.id}')">
    ${speakerRow}
    ${portraitRow}
    <div class="line-top line-fontdoc">${fontSel}
      <span class="doc-drop" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropLineDoc(event,'${n.id}','${l.id}')" title="Drop a file here to attach it as this line's handout"><button class="mini-btn" onclick="pickDoc('${n.id}','${l.id}')">${doc.media?'doc ✓':'+ doc'}</button></span>
      ${doc.media?`<input class="speaker-in" style="max-width:150px" value="${escAttr(doc.label)}" placeholder="doc label" oninput="setDocLabel('${n.id}','${l.id}',this.value)">
        <button class="mini-btn warn" onclick="clearDoc('${n.id}','${l.id}')">×</button>`:''}
      <label class="chk" style="margin:0" title="Renders as free-floating text with no speaker name or dialogue box - narrator commentary, off-screen dialogue, and the like. Dims the other on-stage portraits/text and the background by default (Canvas editor -> Narrator text)."><input type="checkbox" ${l.unattributed?'checked':''} onchange="setLine('${n.id}','${l.id}','unattributed',this.checked)"> 🗨 unattributed</label>
      ${typeof lineNoteToggleHtml==='function'?lineNoteToggleHtml(l):''}
    </div>
    ${typeof lineNoteBoxHtml==='function'?lineNoteBoxHtml(n,l,'ln-'):''}
    <div class="line-top line-fmt" style="gap:3px">
      <button class="mini-btn" title="Bold" onmousedown="event.preventDefault()" onclick="fmt('${n.id}','${l.id}','**','**')"><b>B</b></button>
      <button class="mini-btn" title="Italic" onmousedown="event.preventDefault()" onclick="fmt('${n.id}','${l.id}','*','*')"><i>I</i></button>
      <button class="mini-btn" title="Underline" onmousedown="event.preventDefault()" onclick="fmt('${n.id}','${l.id}','__','__')"><u>U</u></button>
      <button class="mini-btn" title="Strikethrough" onmousedown="event.preventDefault()" onclick="fmt('${n.id}','${l.id}','~~','~~')"><s>S</s></button>
      <button class="mini-btn" title="Bigger" onmousedown="event.preventDefault()" onclick="fmt('${n.id}','${l.id}','[big]','[/big]')">A+</button>
      <button class="mini-btn" title="Smaller" onmousedown="event.preventDefault()" onclick="fmt('${n.id}','${l.id}','[small]','[/small]')">A-</button>
      <input type="color" id="col-${l.id}" value="#ff5555" title="Colour" style="width:26px;height:22px;padding:0;border:1px solid #475569;border-radius:4px;background:none;cursor:pointer" oninput="hexSyncFromColor(this)">${hexFieldHtml('#ff5555')}
      <button class="mini-btn" title="Colour selection" onmousedown="event.preventDefault()" onclick="fmtColor('${n.id}','${l.id}')">color</button>
      <button class="mini-btn" title="Hyperlink selection" onmousedown="event.preventDefault()" onclick="fmtLink('${n.id}','${l.id}')">🔗</button>
    </div>
    <textarea id="ta-${l.id}" class="dialogue-text line-editable" placeholder="What is said / shown on this beat…" onkeydown="rtHotkey(event,'${n.id}','${l.id}','ta-${l.id}')" oninput="setLine('${n.id}','${l.id}','text',this.value);updatePreview('${l.id}',this.value)">${escHtml(l.text)}</textarea>
    <div id="pv-${l.id}" class="hint" style="background:var(--panel2);border:1px solid var(--line);border-radius:4px;padding:4px 6px;color:var(--ink);min-height:18px;${hasRichMarkup(l.text)?'':'display:none'}" title="Live preview of applied text formatting">${renderRich(l.text)}</div>
    <div class="line-extra">${typeof lineTimingHtml==='function'?lineTimingHtml(n,l):''}${typeof lineVoiceHtml==='function'?lineVoiceHtml(n,l):''}${typeof lineSfxHtml==='function'?lineSfxHtml(n,l):''}</div>
  </div>`;
}
function portHtml(n,c,o,label){
  const cls='port out '+(o.type==='success'?'':'')+(o.targetNode?'connected':'');
  const tag=label?`<span style="font-size:8px;color:${o.type==='failure'?'#f87171':(o.type==='success'?'#4ade80':'#e2e8f0')};margin-right:2px">${label}</span>`:'';
  // draggable="false" here is defensive only; it does not stop Chromium from
  // walking up to the .choice-row ancestor's draggable="true". The real guard
  // against that native-drag hijack lives in choiceDragStart, which cancels
  // the row's own drag when it originates on a .port.
  return `${tag}<div class="${cls}" id="out-${o.id}" draggable="false" onmousedown="disconnectPort(event,'${n.id}','${c.id}','${o.id}')" title="Drag to a scene" ${o.type==='failure'?'style="background:#ef4444"':(o.type==='success'?'style="background:#22c55e"':'')}></div>`;
}
function choicesBlockHtml(n){
  const rows=n.choices.map(c=>{
    const isPortal = c.portal && c.portal.layer;
    const isDice=c.dice&&c.dice.enabled;
    let ports;
    if(isPortal) ports=''; // a portal's real port isn't wired by dragging on the canvas; the tab replaces it
    else if(isDice){ const s=c.outcomes.find(o=>o.type==='success')||c.outcomes[0]; const f=c.outcomes.find(o=>o.type==='failure')||c.outcomes[1];
      ports=`<div style="display:flex;flex-direction:column;gap:4px">${portHtml(n,c,s,'S')}${f?portHtml(n,c,f,'F'):''}</div>`; }
    else ports=portHtml(n,c,c.outcomes[0],'');
    const hasLogic = typeof choiceHasLogic==='function' && choiceHasLogic(c);
    const gear=`<button class="choice-gear${hasLogic?' has-logic':''}" title="Edit effects, conditions & dice for this choice" onclick="selectChoiceProp('${n.id}','${c.id}')" title="Edit this choice in the Properties panel">⚙ options</button>`;
    const label = c.continue
      ? `<span class="choice-cont">▸ Continue</span>`
      : `<input id="choice-in-${c.id}" class="choice-input" value="${escAttr(c.text)}" oninput="setChoice('${n.id}','${c.id}',this.value)" onkeydown="choiceKey(event,'${n.id}','${c.id}')" placeholder="Choice label">`;
    const summary = typeof choiceSummary==='function' ? choiceSummary(c) : '';
    // small inline marker sits with the choice's own content, never
    // absolutely-positioned over the ports/gear/delete controls
    const portalBadge = (isPortal && typeof portalBadgeHtml==='function') ? portalBadgeHtml(c) : '';
    // the real edge tab is a child of THIS row (see choicePortalTabHtml in
    // layers.js) so it grows directly out of the row that actually owns the
    // portal, instead of a stack anchored to the node's corner
    const portalTab = (isPortal && typeof choicePortalTabHtml==='function') ? choicePortalTabHtml(n,c) : '';
    return `<div class="choice-row" draggable="true" ondragstart="choiceDragStart(event,'${n.id}','${c.id}')" ondragover="event.preventDefault()" ondrop="choiceDrop(event,'${n.id}','${c.id}')">
        ${portalTab}
        <div class="choice-main">
          <div class="choice-toprow"><span class="choice-grip" title="Drag to reorder">⠿</span>${label}${gear}${portalBadge}<span class="choice-del" onclick="delChoice('${n.id}','${c.id}')" title="Delete choice">✕</span></div>
          ${summary}
        </div>${ports}
      </div>`;
  }).join('');
  return `<div class="choices-container">
    ${rows||'<div class="hint" style="text-align:center">No exits; this is an ending. Add a choice below to lead somewhere, or leave it as-is to end the story here.</div>'}
    <div style="display:flex;gap:6px"><button class="mini-btn" onclick="addChoice('${n.id}')" title="Add an exit from this scene; tick 'Plain continue' on it (in its own gear menu) for a simple linear link with no choice text">+ Choice</button></div>
  </div>`;
}

let nodeDrag=null;
function startNodeDrag(e,id){ e.stopPropagation(); pushUndoOnce(); const c=getLogicalCoords(e); const n=scenes[id]; nodeDrag={id,dx:c.x-n.x,dy:c.y-n.y,multi:null};
  project.meta.lastEditScene=id; // #2: remember what you were working on
  if(typeof _selScenes!=='undefined' && _selScenes.has(id) && _selScenes.size>1){ nodeDrag.multi=[]; _selScenes.forEach(sid=>{ if(sid!==id && scenes[sid]) nodeDrag.multi.push({id:sid,ox:scenes[sid].x-n.x,oy:scenes[sid].y-n.y}); }); } }
function renderAll(){ renderBackdrops(); renderScenes(); }

/* ---- per-choice logic modal: effects / condition / dice (#9,#10) -------- */
let logicCtx=null;
function openChoiceLogic(sceneId,choiceId){ logicCtx={sceneId,choiceId}; renderLogic(); document.getElementById('logic-modal').classList.remove('hidden'); }
function curChoice(){ return scenes[logicCtx.sceneId].choices.find(c=>c.id===logicCtx.choiceId); }
function enableDiceOutcomes(c){
  let succ=c.outcomes.find(o=>o.type==='success'); if(!succ){ succ=c.outcomes[0]||{id:genId('o'),targetNode:null}; succ.type='success'; c.outcomes=[succ]; }
  if(!c.outcomes.find(o=>o.type==='failure')) c.outcomes.push({id:genId('o'),type:'failure',targetNode:null});
}
function disableDiceOutcomes(c){ let succ=c.outcomes.find(o=>o.type==='success')||c.outcomes[0]; succ.type='default'; c.outcomes=[succ]; }
function opsForType(t){ return t==='text'?['set']:(t==='bool'?['set','toggle']:['add','sub','set']); }
function cmpsForType(t){ return t==='text'?['==','!=','contains']:(t==='bool'?['==','!=']:['>=','<=','>','<','==','!=']); }
function effectValueHtml(e,i,t){
  if(t==='bool'){ if(e.op==='toggle') return ''; const bv=coerceVal('bool',e.value); return `<select class="mini-sel" style="width:74px" onchange="setEffect(${i},'value',this.value)"><option value="false" ${!bv?'selected':''}>false</option><option value="true" ${bv?'selected':''}>true</option></select>`; }
  if(t==='text') return `<input type="text" class="mini-sel" style="width:100px" value="${escAttr(e.value)}" oninput="setEffect(${i},'value',this.value)">`;
  return `<input type="number" class="mini-sel" style="width:64px" value="${e.value}" oninput="setEffect(${i},'value',this.value)">`;
}
function condValueHtml(cond,t){
  if(t==='bool') return `<select class="mini-sel" style="width:74px" onchange="setCond('value',this.value)"><option value="false" ${!cond.value?'selected':''}>false</option><option value="true" ${cond.value?'selected':''}>true</option></select>`;
  if(t==='text') return `<input type="text" class="mini-sel" style="width:100px" value="${escAttr(cond.value)}" oninput="setCond('value',this.value)">`;
  return `<input type="number" class="mini-sel" style="width:60px" value="${cond.value}" oninput="setCond('value',this.value)">`;
}
function addEffect(){ const c=curChoice(); pushUndo(); if(!c.effects)c.effects=[]; const v0=project.variables[0]; c.effects.push({var:(v0||{}).id||'',op:v0&&v0.type==='text'?'set':(v0&&v0.type==='bool'?'set':'add'),value:v0?varDefault(v0.type):0}); renderLogic(); renderScenes(); }
function setEffect(i,f,v){ const c=curChoice(); const e=c.effects[i]; const t=(varById(e.var)||{}).type||'number';
  if(f==='var'){ e.var=v; const nt=(varById(v)||{}).type||'number'; if(opsForType(nt).indexOf(e.op)<0)e.op=opsForType(nt)[0]; e.value=coerceVal(nt,e.value); renderLogic(); }
  else if(f==='op'){ e.op=v; if(v==='toggle')e.value=true; renderLogic(); }
  else if(f==='value'){ e.value=coerceVal(t,v); } }
function delEffect(i){ const c=curChoice(); pushUndo(); c.effects.splice(i,1); renderLogic(); renderScenes(); }
/* Audio-volume effects: a separate list from the variable effects above (no
   variable needed, so it's never disabled), applied by the player alongside
   applyEffects() when the choice is picked. Values are 0-100 (%); 'adjust'
   allows negative deltas, 'set' does not. */
function addAudioFx(){ const c=curChoice(); pushUndo(); if(!c.audioFx)c.audioFx=[]; c.audioFx.push({source:'music',mode:'set',value:50}); renderLogic(); renderScenes(); }
function setAudioFx(i,f,v){ const c=curChoice(); const e=c.audioFx[i];
  if(f==='value'){ const lo=e.mode==='adjust'?-100:0; e.value=Math.max(lo,Math.min(100,parseInt(v,10)||0)); }
  else { e[f]=v; if(f==='mode' && v==='set' && e.value<0) e.value=0; renderLogic(); } }
function delAudioFx(i){ const c=curChoice(); pushUndo(); c.audioFx.splice(i,1); renderLogic(); renderScenes(); }
function toggleCondition(on){ const c=curChoice(); pushUndo(); if(on){ const v0=project.variables[0]||{}; const t=v0.type||'number'; c.condition={var:v0.id||'',cmp:cmpsForType(t)[0],value:varDefault(t),hide:'grey'}; } else c.condition=null; renderLogic(); renderScenes(); }
function setCond(f,v){ const c=curChoice(); const t=(varById(c.condition.var)||{}).type||'number';
  if(f==='var'){ c.condition.var=v; const nt=(varById(v)||{}).type||'number'; if(cmpsForType(nt).indexOf(c.condition.cmp)<0)c.condition.cmp=cmpsForType(nt)[0]; c.condition.value=coerceVal(nt,c.condition.value); renderLogic(); }
  else if(f==='value'){ c.condition.value=coerceVal(t,v); }
  else { c.condition[f]=v; if(f==='cmp'){} } }
function toggleDice(on){ const c=curChoice(); pushUndo(); if(on){ c.dice={enabled:true,target:10,sides:20,count:1,modVar:''}; enableDiceOutcomes(c); } else { c.dice=null; disableDiceOutcomes(c); } renderLogic(); renderScenes(); }
function setDice(f,v){ const c=curChoice(); c.dice[f]=(f==='modVar')?v:(parseInt(v,10)||0); }
// Celebration / bad-choice screen effect fired the moment this choice is
// picked (player/runtime.js's chooseChoice(), and the embeddable HTML
// export's own finishChoice() - see lite-export.js's LITE_FX_TYPES) -
// a single effect, not a list, since one is plenty for "you just made a
// good/bad call". Reuses the exact same FX_CUE_EFFECTS list (and
// VNSceneFx.fire()) the scene/line effect cues already use, so confetti/
// fireworks/big check/big X (and any other cue effect) show up here too.
function togglePickFx(on){ const c=curChoice(); pushUndo(); c.pickFx = on ? {effect:'confetti', intensity:5} : null; renderLogic(); }
function setPickFx(f,v){ const c=curChoice(); if(!c.pickFx) return; c.pickFx[f] = f==='intensity' ? (parseInt(v,10)||5) : v; }
function renderLogic(){
  if(!logicCtx) return; const c=curChoice(); if(!c){ closeModal('logic-modal'); return; }
  const html=choiceLogicHtml(c);
  const modal=document.getElementById('logic-modal');
  if(modal && !modal.classList.contains('hidden')){ const lb=document.getElementById('logic-body'); if(lb) lb.innerHTML=html; }
  if(typeof _propSel!=='undefined' && _propSel && _propSel.kind==='choice' && _propSel.choiceId===logicCtx.choiceId){ if(typeof renderPropsPanel==='function') renderPropsPanel(); }
  return;
}
function choiceLogicHtml(c){
  const noVars=!(project.variables&&project.variables.length);
  const eff=(c.effects||[]).map((e,i)=>{ const t=(varById(e.var)||{}).type||'number'; return `<div class="line-top">
      <select class="mini-sel" onchange="setEffect(${i},'var',this.value)">${varOptions(e.var)}</select>
      <select class="mini-sel" onchange="setEffect(${i},'op',this.value)">${opsForType(t).map(o=>`<option value="${o}" ${e.op===o?'selected':''}>${o}</option>`).join('')}</select>
      ${effectValueHtml(e,i,t)}
      <span class="hdr-icon" style="color:#ef4444" onclick="delEffect(${i})">✕</span></div>`; }).join('');
  const SRC_LABEL={music:'Music',sfx:'Sound effects',typing:'Typing sound'};
  const afx=(c.audioFx||[]).map((e,i)=>`<div class="line-top">
      <select class="mini-sel" onchange="setAudioFx(${i},'source',this.value)">${Object.keys(SRC_LABEL).map(s=>`<option value="${s}" ${e.source===s?'selected':''}>${SRC_LABEL[s]}</option>`).join('')}</select>
      <select class="mini-sel" onchange="setAudioFx(${i},'mode',this.value)"><option value="set" ${e.mode==='set'?'selected':''}>Set to</option><option value="adjust" ${e.mode==='adjust'?'selected':''}>Adjust by</option></select>
      <input type="number" class="mini-sel" style="width:60px" min="${e.mode==='adjust'?-100:0}" max="100" value="${e.value}" oninput="setAudioFx(${i},'value',this.value)">%
      <span class="hdr-icon" style="color:#ef4444" onclick="delAudioFx(${i})">✕</span></div>`).join('');
  const cond=c.condition, dice=c.dice;
  const condType=cond&&cond.var?((varById(cond.var)||{}).type||'number'):'number';
  return `
    ${noVars?'<div class="hint" style="margin-bottom:10px">Tip: define variables in ⚙️ Settings → Variables to use effects and conditions.</div>':''}
    <div class="sec"><h3>Effects; when this choice is picked</h3>
      ${eff||'<div class="hint">No effects.</div>'}
      <button class="mini-btn" style="margin-top:8px" onclick="addEffect()" ${noVars?'disabled':''}>+ effect</button></div>
    <div class="sec"><h3>Audio; when this choice is picked</h3>
      ${afx||'<div class="hint">No audio effects.</div>'}
      <button class="mini-btn" style="margin-top:8px" onclick="addAudioFx()">+ audio effect</button></div>
    <div class="sec"><h3>Screen effect; when this choice is picked</h3>
      <label class="chk"><input type="checkbox" ${c.pickFx?'checked':''} onchange="togglePickFx(this.checked)"> play an effect (confetti, fireworks, a big check/X…) when this choice is picked</label>
      ${c.pickFx?`<div class="line-top" style="margin-top:6px">
        <select class="mini-sel" onchange="setPickFx('effect',this.value)">${_fxEffOptions(c.pickFx.effect)}</select>
        <span>intensity</span><input type="range" min="1" max="10" value="${c.pickFx.intensity||5}" oninput="setPickFx('intensity',this.value)" style="vertical-align:middle;width:70px"></div>`:''}</div>
    <div class="sec"><h3>Condition; show this choice only if…</h3>
      <label class="chk"><input type="checkbox" ${cond&&cond.var?'checked':''} onchange="toggleCondition(this.checked)" ${noVars?'disabled':''}> enable condition</label>
      ${cond&&cond.var?`<div class="line-top" style="margin-top:6px;flex-wrap:wrap">
        <select class="mini-sel" onchange="setCond('var',this.value)">${varOptions(cond.var)}</select>
        <select class="mini-sel" onchange="setCond('cmp',this.value)">${cmpsForType(condType).map(o=>`<option value="${o}" ${cond.cmp===o?'selected':''}>${o}</option>`).join('')}</select>
        ${condValueHtml(cond,condType)}
        <span>if unmet:</span>
        <select class="mini-sel" onchange="setCond('hide',this.value)">${['grey','hidden'].map(o=>`<option value="${o}" ${cond.hide===o?'selected':''}>${o}</option>`).join('')}</select></div>`:''}</div>
    ${typeof routesSectionHtml==='function'?routesSectionHtml(c):''}
    ${typeof portalSectionHtml==='function'?portalSectionHtml(c):''}
    <div class="sec"><h3>Dice roll (off by default)</h3>
      <label class="chk"><input type="checkbox" ${dice&&dice.enabled?'checked':''} onchange="toggleDice(this.checked)"> roll dice when this choice is picked</label>
      ${dice&&dice.enabled?`<div class="line-top" style="margin-top:6px;flex-wrap:wrap">
        <span>roll</span><input type="number" class="mini-sel" style="width:44px" value="${dice.count}" oninput="setDice('count',this.value)">
        <select class="mini-sel" onchange="setDice('sides',this.value)">${[4,6,8,10,12,20,100].map(s=>`<option value="${s}" ${dice.sides==s?'selected':''}>d${s}</option>`).join('')}</select>
        <span>+ mod</span><select class="mini-sel" onchange="setDice('modVar',this.value)"><option value="">none</option>${(project.variables||[]).filter(v=>(v.type||'number')==='number').map(v=>`<option value="${v.id}" ${dice.modVar===v.id?'selected':''}>${escHtml(v.name)}</option>`).join('')}</select>
        <span>vs target</span><input type="number" class="mini-sel" style="width:52px" value="${dice.target}" oninput="setDice('target',this.value)">
      </div><div class="hint">Only number variables can be dice modifiers. Wire the green (success) and red (failure) ports to different scenes.</div>`:''}</div>`;
}

/* ---- save / open / export / preview ------------------------------------ */
function projectForDisk(){ project.meta.exportTime=new Date().toISOString(); if(typeof syncAllPortals==='function') syncAllPortals(); return JSON.stringify(project); }
/* "Save" vs "Save As...": a plain Save should overwrite the same file every
   time, not act like Download and pile up new copies. In the browser this
   uses the File System Access API (Chromium; localhost counts as a secure
   context) to hold a real, reusable file handle across saves; _fsHandle is
   that connection for this tab's session (cleared on reload, same as any
   other in-memory browser state). Where that API isn't available (Firefox/
   Safari, or the plain-file:// fallback) Save behaves exactly as it always
   has: a download to the browser's Downloads folder. */
let _fsHandle=null;
function _hasFsAccess(){ return typeof window.showSaveFilePicker==='function'; }
/* Call this when starting a genuinely fresh project (new/sample), NOT when
   opening one - open_project()/showOpenFilePicker() already connect the
   newly-opened file themselves, and this would race with (and wipe) that. */
function disconnectSavedFile(){ _fsHandle=null; if(HAS_BRIDGE() && window.pywebview.api.reset_current_path) window.pywebview.api.reset_current_path(); }
async function doSave(){ return _saveVia(false); }
async function doSaveAs(){ return _saveVia(true); }
// #86: refreshes this tab's dirty-dot and flushes it to IndexedDB right
// after a successful save, so a tab that was just saved doesn't come back
// showing the dot (or fall out of sync with what's actually on disk) the
// next time a reload restores it.
function _ptAfterSave(){ if(typeof ProjectTabs!=='undefined' && ProjectTabs.ready){ ProjectTabs.render(); ProjectTabs.persist(); } }
async function _saveVia(forceAs){
  if(typeof recentSave==='function') recentSave();
  if(HAS_BRIDGE()){
    const r = forceAs
      ? await window.pywebview.api.save_project_as(projectForDisk(), (typeof defaultPathFor==='function')?defaultPathFor('projects'):'')
      : await window.pywebview.api.save_project(projectForDisk());
    if(r&&r.ok){ toast('Saved: '+r.path); _dirty=false; _ptAfterSave(); } else if(r&&r.error && r.error!=='cancelled') toast('Save failed: '+r.error);
    return;
  }
  if(HAS_SERVER() && _hasFsAccess()){
    try{
      if(forceAs || !_fsHandle){
        _fsHandle = await window.showSaveFilePicker({ suggestedName: safeTitle()+'.vnproj',
          types:[{ description:'Scenemaker project', accept:{'application/octet-stream':['.vnproj']} }] });
      }
      const res=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:projectForDisk()});
      if(!res.ok) throw new Error('server '+res.status);
      const blob=await res.blob();
      const w=await _fsHandle.createWritable(); await w.write(blob); await w.close();
      toast('Saved: '+_fsHandle.name); _dirty=false; _ptAfterSave();
      return;
    }catch(err){
      if(err && err.name==='AbortError') return;   // user closed the picker; not a failure
      _fsHandle=null;                               // something real went wrong; fall back below
    }
  }
  if(HAS_SERVER()){ try{ const res=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:projectForDisk()}); if(!res.ok)throw new Error('server '+res.status); downloadBlob(await res.blob(), safeTitle()+'.vnproj'); toast('Saved to your Downloads folder'); _dirty=false; _ptAfterSave(); }catch(err){ toast('Save failed: '+err.message); } }
  else { downloadBlob(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}), safeTitle()+'.vnproj.json'); toast('Downloaded project JSON (launch via app.py for a real .vnproj)'); _dirty=false; _ptAfterSave(); }
}
// #86: Open always lands in a fresh tab rather than clobbering whatever's
// currently on screen; ProjectTabs.beginNewTab()/finishNewTab() are no-ops
// (and safe to call) if the tabs feature never loaded or nothing's saved yet.
function _ptBeginOpen(){ if(typeof ProjectTabs!=='undefined' && ProjectTabs.ready) ProjectTabs.beginNewTab(); }
function _ptFinishOpen(){ if(typeof ProjectTabs!=='undefined' && ProjectTabs.ready) ProjectTabs.finishNewTab(); }
async function doOpen(){
  if(HAS_BRIDGE()){ const r=await window.pywebview.api.open_project((typeof defaultPathFor==='function')?defaultPathFor('projects'):''); if(r&&r.ok){ _ptBeginOpen(); loadProject(r.project); if(typeof recentSave==='function') recentSave(); toast('Opened project'); _ptFinishOpen(); if(typeof checkOpenOverlapSoon==='function') checkOpenOverlapSoon(); } }
  else if(HAS_SERVER() && typeof window.showOpenFilePicker==='function'){
    try{
      const [handle]=await window.showOpenFilePicker({ types:[{ description:'Scenemaker project', accept:{'application/octet-stream':['.vnproj']} }] });
      const file=await handle.getFile(); const buf=await file.arrayBuffer();
      const res=await fetch('/api/open',{method:'POST',body:buf}); const j=await res.json();
      if(j.ok){ _ptBeginOpen(); loadProject(j.project); _fsHandle=handle; if(typeof recentSave==='function') recentSave(); toast('Opened '+file.name); _ptFinishOpen(); if(typeof checkOpenOverlapSoon==='function') checkOpenOverlapSoon(); }
      else toast('Open failed: '+(j.error||'?'));
    }catch(err){ if(err && err.name==='AbortError') return; toast('Open failed: '+err.message); }
  }
  else if(HAS_SERVER()){ const inp=document.getElementById('openInput'); inp.value=''; inp.onchange=async()=>{ const f=inp.files[0]; if(!f)return;
      try{ const buf=await f.arrayBuffer(); const res=await fetch('/api/open',{method:'POST',body:buf}); const j=await res.json(); if(j.ok){ _ptBeginOpen(); loadProject(j.project); if(typeof recentSave==='function') recentSave(); toast('Opened project'); _ptFinishOpen(); if(typeof checkOpenOverlapSoon==='function') checkOpenOverlapSoon(); } else toast('Open failed: '+(j.error||'?')); }catch(err){ toast('Open failed: '+err.message); } }; inp.click(); }
  else { const inp=document.getElementById('openInput'); inp.value=''; inp.onchange=()=>{ const f=inp.files[0]; if(!f)return; const rd=new FileReader(); rd.onload=()=>{ try{ _ptBeginOpen(); loadProject(JSON.parse(rd.result)); toast('Opened project'); _ptFinishOpen(); if(typeof checkOpenOverlapSoon==='function') checkOpenOverlapSoon(); }catch(err){ toast('Could not read file'); } }; rd.readAsText(f); }; inp.click(); }
}
function loadProject(p,isNew){
  _fsHandle=null; // a freshly-loaded project isn't connected to a file yet; doOpen() reconnects it right after this when it opened one via the File System Access API
  const blank=blankProject();
  project=Object.assign(blank,p);
  project.media=p.media||{}; project.scenes=p.scenes||{}; project.backdrops=p.backdrops||{};
  project.settings=Object.assign(blank.settings, p.settings||{});
  project.settings.debug=migrateDebug(p); delete project.settings.nav;
  project.settings.screen=Object.assign({canvasSize:'widescreen',style:'plain',border:false,radius:16,width:6,font:'system'}, (p.settings&&p.settings.screen)||{});
  project.settings.completion=Object.assign({mode:'reachEnd',count:1}, (p.settings&&p.settings.completion)||{});
  // #16: multiple completion criteria (any one being true marks the learner
  // complete) - a project saved before this existed only has the legacy
  // mode/count fields, so synthesize the equivalent single-item criteria
  // list from them here, once, the same way migrateDebug() above normalizes
  // an old debug shape. Nothing renders differently until a second
  // criterion is actually added.
  if(!Array.isArray(project.settings.completion.criteria)){
    project.settings.completion.criteria=[{
      type: project.settings.completion.mode==='viewCount' ? 'viewCount' : 'reachEnd',
      count: project.settings.completion.count||1
    }];
  }
  if(project.settings.endRestart==null) project.settings.endRestart=true;
  /* rescue any scene/group that was dragged off the top-left before position
     clamping existed, so its header is reachable again */
  let rescued=0;
  Object.values(project.scenes||{}).forEach(s=>{ const nx=Math.max(0,+s.x||0), ny=Math.max(0,+s.y||0); if(nx!==s.x||ny!==s.y)rescued++; s.x=nx; s.y=ny; });
  Object.values(project.backdrops||{}).forEach(b=>{ b.x=Math.max(0,+b.x||0); b.y=Math.max(0,+b.y||0); if(b.collapsed==null)b.collapsed=false; });
  // NOT blank.meta as the merge target: the `project=Object.assign(blank,p)`
  // line just above already reassigned blank.meta to literally BE p.meta
  // (same object reference, whenever p.meta exists) for any top-level key
  // Object.assign copies by reference - so merging "onto blank.meta" here
  // would really just be merging p.meta onto itself, silently dropping every
  // default for a field p.meta doesn't have (undefined, not the real
  // default). A second blankProject() call gets a genuinely fresh, unpolluted
  // defaults object to merge onto instead.
  project.meta=Object.assign(blankProject().meta, p.meta||{});
  // stamped ONLY when this is a genuine brand-new project (isNew, passed by
  // the two actual "New project" call sites) - opening an existing file,
  // sample, or recent keeps whatever createdAt it already carries (or null,
  // for one saved before this field existed; never fabricated as "now").
  if(isNew) project.meta.createdAt=new Date().toISOString();
  // #96: a plain Object.assign({...defaults}, p.title) (the old code here)
  // only merges TOP-level keys - an old .vnproj's p.title.bg/music, missing
  // the new fit/speed/playCount fields entirely, would silently overwrite
  // the whole default bg/music object rather than filling the gaps, leaving
  // those two new fields undefined on every pre-existing project. bg/music
  // (and menuItems, which just needs to exist as an array) are merged one
  // level deeper so an old project gets sane new defaults without losing
  // whatever it already had.
  { const pt=p.title||{};
    project.title=Object.assign({enabled:false,heading:'',subheading:'',startLabel:'Start',returnOnEnd:true,hoverSound:null,showSocials:false,menuItems:[]}, pt);
    project.title.bg=Object.assign({type:'none',media:null,fit:'cover',speed:1}, pt.bg||{});
    project.title.music=Object.assign({media:null,loop:true,volume:0.6,playCount:0}, pt.music||{});
    if(!Array.isArray(project.title.menuItems)) project.title.menuItems=[];
  }
  // #98: same nested-merge discipline as title.bg/music just above - a plain
  // top-level Object.assign would wipe creditsScreen.bg/music's own sub-fields
  // the moment an old .vnproj (or one saved by an earlier version missing this
  // feature) merged in today's defaults.
  { const pc=p.creditsScreen||{};
    project.creditsScreen=Object.assign({style:'static',scrollSpeed:40,textColor:'',headingColor:'',closeLabel:'Close',showAuthor:true,showTeam:true,showAssetCredits:true,showSocials:true}, pc);
    project.creditsScreen.bg=Object.assign({type:'none',media:null,fit:'cover'}, pc.bg||{});
    project.creditsScreen.music=Object.assign({media:null,volume:0.6}, pc.music||{});
  }
  project.keyphrases=(Array.isArray(p.keyphrases)?p.keyphrases:[]).map(k=>Object.assign({id:genId('kw'),phrase:'',color:'',bold:false,italic:false}, k));
  project.variables=Array.isArray(p.variables)?p.variables:[];
  project.characters=Array.isArray(p.characters)?p.characters:[];
  /* upgrade older scenes/lines/choices so new controls have something to bind to */
  (project.characters||[]).forEach(c=>{ if(c.scale==null) c.scale=1; if(!c.textSpeed) c.textSpeed={mode:'',speed:5}; if(!c.typeSound) c.typeSound={enabled:false,wave:'square',pitch:6,volume:5,chirp:0,detune:0}; else { if(c.typeSound.chirp==null)c.typeSound.chirp=0; if(c.typeSound.detune==null)c.typeSound.detune=0; } if(!Array.isArray(c.portraits)) c.portraits=[]; if(c.highlightName==null) c.highlightName=false; });
  Object.values(project.scenes).forEach(s=>{
    if(!s.mode) s.mode='dialogue';
    if(!s.cutscene) s.cutscene={dim:0.4,effect:'shadow',size:'lg',align:'center'};
    if(!s.viewer) s.viewer={kind:'photo360',media:null,loop:true};
    if(!Array.isArray(s.cast)) s.cast=[]; if(s.overlap==null) s.overlap=false; if(s.speakerTop==null) s.speakerTop=true; if(s.group===undefined) s.group=null;
    s.cast.forEach(c=>{ if(!c.charId && c.scale==null) c.scale=1; });
    if(!s.music) s.music={media:null,loop:true,volume:0.6,fadeOut:0,stop:false};
    if(s.music.volume==null) s.music.volume=0.6; if(s.music.fadeOut==null) s.music.fadeOut=0; if(s.music.stop==null) s.music.stop=false;
    (s.lines||[]).forEach(l=>{ if(!l.portrait) l.portrait={media:null,pos:'left',border:'none',scale:1}; if(!l.portrait.border) l.portrait.border='none'; if(l.portrait.scale==null) l.portrait.scale=1; if(l.font==null) l.font=''; if(!l.doc) l.doc={media:null,label:''}; if(!Array.isArray(l.stage)) l.stage=[]; if(l.speakingCast==null) l.speakingCast=''; if(!l.visit) l.visit={mode:'always',n:2}; if(!l.textSpeed) l.textSpeed={mode:'',speed:5}; if(!Array.isArray(l.sfx)) l.sfx=[]; if(l.unattributed==null) l.unattributed=false; });
    (s.choices||[]).forEach(c=>{ if(!c.effects)c.effects=[]; if(c.condition===undefined)c.condition=null; if(c.dice===undefined)c.dice=null; if(!Array.isArray(c.routes))c.routes=[]; if(c.pickFx===undefined)c.pickFx=null; (c.outcomes||[]).forEach(o=>{ if(!o.type)o.type='default'; }); });
  });
  (project.variables||[]).forEach(v=>{ if(!v.type) v.type='number';
    // #99: per-variable style, keyed off whatever a {{token}} actually
    // substitutes to at play time - nested-merged the same way (a bare
    // Object.assign would wipe color/bold/italic if only one was saved).
    v.style=Object.assign({color:'',bold:false,italic:false}, v.style||{}); });
  if(project.settings && project.settings.screen && project.settings.screen.style==='ff7') project.settings.screen.style='jrpg';
  if(project.settings && !project.settings.text) project.settings.text={mode:'letter',speed:5};
  rebind(); if(typeof ensureProjectInfo==='function') ensureProjectInfo(); if(typeof refreshOpenDocks==='function') refreshOpenDocks(); _undo=[];_redo=[];_pending=false;_dirty=false; updateUndoButtons(); closeFocus(); resetZoom(); renderAll();
  // #2/#9: land back where you left off instead of the canvas's default
  // top-left, which on a large project can look like it opened into empty
  // space. If nothing was ever tracked as "last edited" (a brand-new
  // project, or one whose last-edited scene got deleted since), fall back
  // to the current layer's own start scene, and failing that, literally any
  // scene that actually exists on it - so opening a project only ever lands
  // on empty space if the layer genuinely has no scenes at all yet.
  let landId=project.meta.lastEditScene;
  if(!landId || !scenes[landId]){
    const layer=(typeof currentLayerId!=='undefined')?currentLayerId:'main';
    const startId=(typeof layerStartScene==='function')?layerStartScene(layer):null;
    if(startId && scenes[startId]) landId=startId;
    else{ const onLayer=Object.values(scenes).find(s=>(typeof sceneLayer!=='function')||sceneLayer(s)===layer); if(onLayer) landId=onLayer.id; }
  }
  if(landId && scenes[landId] && typeof warpAcrossLayers==='function') setTimeout(()=>warpAcrossLayers(landId), 0);
  if(rescued) setTimeout(()=>toast(rescued+' off-screen scene(s) moved back into view'), 400);
  // #143: the basic "Start with a scene" walkthrough only makes sense for a
  // project that's actually starting from nothing - it used to also fire for
  // Open/Recent/Sample loads, where its own "skip steps already done" logic
  // then jumped straight into the middle of the tour (reported as "starts on
  // step 3"), confusing on an already-built project. Only a genuinely NEW
  // blank project (isNew===true, set by doNew()/startNewProject()) autostarts
  // it now; opening or loading anything else never does.
  if(isNew && typeof maybeAutostartTutorialSoon==='function') maybeAutostartTutorialSoon();
}
async function doExportScorm(){
  if(!Object.keys(scenes).length){ toast('Add at least one scene first'); return; }
  if(!project.settings.startScene){ toast('Set a start scene in ⚙️ SETTINGS first'); return; }
  if(HAS_BRIDGE()){ toast('Building SCORM package…'); const r=await window.pywebview.api.export_scorm(projectForDisk(), (typeof defaultPathFor==='function')?defaultPathFor('exports'):''); if(r&&r.ok) toast('SCORM package saved: '+r.path); else if(r&&r.error) toast(r.error); }
  else if(HAS_SERVER()){ try{ toast('Building SCORM package…'); const res=await fetch('/api/scorm',{method:'POST',headers:{'Content-Type':'application/json'},body:projectForDisk()}); if(!res.ok)throw new Error('server '+res.status); downloadBlob(await res.blob(), safeTitle()+'_SCORM.zip'); toast('SCORM .zip saved to your Downloads folder'); }catch(err){ toast('Export failed: '+err.message); } }
  else toast('SCORM export needs the local helper; launch via app.py / run_scenemaker.bat.');
}
// matches build_exe.py's own wording ("PyInstaller isn't installed...") so
// the offer-to-install prompt below fires on that specific failure only,
// not on every other way a PyInstaller build can fail (a real build error
// should just show as-is, not loop back into an install offer).
const PYINSTALLER_MISSING_RE = /PyInstaller isn.t installed/i;

async function _installPyInstaller(){
  if(HAS_BRIDGE()) return await window.pywebview.api.install_pyinstaller();
  const res = await fetch('/api/install_pyinstaller', { method: 'POST' });
  return await res.json().catch(()=>({ ok:false, log:'server '+res.status }));
}

function _offerInstallPyInstaller(retryFn){
  uiConfirm(
    'Building a standalone executable needs one extra one-time package, <b>PyInstaller</b> (installed via pip; nothing else in Scenemaker needs it, and this only happens once). Install it now?',
    async ()=>{
      toast('Installing PyInstaller… this can take a minute');
      try{
        const r = await _installPyInstaller();
        if(r && r.ok){ toast('PyInstaller installed; building your executable…'); retryFn(); }
        else toast('Install failed: '+((r&&r.log)||'unknown error'));
      }catch(err){ toast('Install failed: '+err.message); }
    },
    { yes:'Install', no:'Not now' }
  );
}

async function doExportExe(){
  if(!Object.keys(scenes).length){ toast('Add at least one scene first'); return; }
  if(!project.settings.startScene){ toast('Set a start scene in ⚙️ SETTINGS first'); return; }
  const onefile=!((typeof ToolSettings!=='undefined') && ToolSettings.get('exeOnefile','1')==='0');
  if(HAS_BRIDGE()){
    toast('Building executable… this can take a minute');
    const r=await window.pywebview.api.export_exe(projectForDisk(), (typeof defaultPathFor==='function')?defaultPathFor('exports'):'', onefile);
    if(r&&r.ok) toast('Executable saved: '+r.path);
    else if(r&&r.error && PYINSTALLER_MISSING_RE.test(r.error)) _offerInstallPyInstaller(doExportExe);
    else if(r&&r.error) toast(r.error);
  }
  else if(HAS_SERVER()){
    try{
      toast('Building executable… this can take a minute');
      const res=await fetch('/api/build_exe?onefile='+(onefile?'1':'0'),{method:'POST',headers:{'Content-Type':'application/json'},body:projectForDisk()});
      if(!res.ok){ const e=await res.json().catch(()=>null); throw new Error((e&&e.error)||('server '+res.status)); }
      const cd=res.headers.get('Content-Disposition')||''; const m=/filename="?([^"]+)"?/.exec(cd);
      downloadBlob(await res.blob(), m?m[1]:(safeTitle()+'.zip'));
      toast('Executable saved to your Downloads folder');
    }catch(err){
      if(PYINSTALLER_MISSING_RE.test(err.message)) _offerInstallPyInstaller(doExportExe);
      else toast('Build failed: '+err.message);
    }
  }
  else toast('Standalone executable export needs the local helper; launch via app.py / run_scenemaker.bat.');
}
function _showPreviewLoading(show){
  let o=document.getElementById('preview-loading');
  if(!o){ o=document.createElement('div'); o.id='preview-loading'; o.className='modal-bg';
    o.innerHTML='<div class="modal-card" style="max-width:340px;text-align:center"><h2>Building preview\u2026</h2><div class="pl-bar"><div class="pl-fill"></div></div><div class="hint" id="pl-note" style="margin-top:8px">Assembling your story\u2026</div></div>';
    document.body.appendChild(o); }
  o.style.display=show?'flex':'none';
  if(show){ setTimeout(()=>{ const n=document.getElementById('pl-note'); if(n && o.style.display!=='none') n.textContent='Large projects with lots of media take a moment\u2026'; }, 2500); }
}
async function doPreview(){
  if(!Object.keys(scenes).length){ toast('Add a scene first'); return; }
  _showPreviewLoading(true);
  try{ await _doPreviewInner(); } finally { setTimeout(()=>_showPreviewLoading(false), 400); }
}
// #96: opening Preview as an ordinary new TAB puts the actual story right
// next to the browser's own tab strip, address bar and bookmarks - breaks
// the "this is a standalone app" illusion immediately. window.open() gets
// that chrome stripped away (a real borderless-ish popup window, no tabs/
// address bar/menu bar) whenever it's called with explicit width/height/
// menubar=no/etc feature flags instead of none, which is the one lever a
// web page actually has over its own window's chrome; sized to roughly the
// story's own canvas design size so it reads like the game's real window,
// not an arbitrary box. Ctrl+scroll browser zoom and View Source stay
// reachable (no web API can block either one at the OS/browser level); the
// existing Settings -> Screen & frame "Disable right-click & text selection"
// toggle is the other half of the immersion this was asked for.
function _previewPopupFeatures(){
  const dim=(typeof CANVAS_SIZES!=='undefined')
    ? (CANVAS_SIZES[(project.settings&&project.settings.screen&&project.settings.screen.canvasSize)||'widescreen']||CANVAS_SIZES.widescreen)
    : {w:1000,h:640};
  const availW=screen.availWidth||1280, availH=screen.availHeight||800;
  const w=Math.min(Math.round(dim.w*1.05)+40, Math.max(480, availW-60));
  const h=Math.min(Math.round(dim.h*1.05)+90, Math.max(360, availH-80));
  const left=Math.max(0, Math.round((availW-w)/2)), top=Math.max(0, Math.round((availH-h)/2));
  // deliberately no "noopener" here: window.open() is spec-required to return
  // null whenever that flag is set (it severs the reference on purpose), but
  // _doPreviewInner() needs the returned window handle to navigate it once
  // the real preview URL comes back from /api/preview - this caused the
  // popup to visibly open and then just sit on about:blank forever, silently
  // (found the hard way, via a real popped-open blank window).
  return `popup=yes,width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
}
async function _doPreviewInner(){
  if(HAS_BRIDGE()){ const r=await window.pywebview.api.preview(projectForDisk()); if(r&&r.error)toast(r.error); }
  else if(HAS_SERVER()){
    // Open the tab SYNCHRONOUSLY, before the first await, while this call
    // still counts as "in response to a user gesture" - most browsers'
    // popup blockers silently swallow a window.open() that fires only after
    // an awaited fetch resolves, with no error and nothing visibly wrong,
    // which is exactly "Preview does nothing" from the user's side. Navigate
    // that already-open tab once the real URL is known instead of opening a
    // second one.
    const win=window.open('about:blank','_blank',_previewPopupFeatures());
    if(!win){ toast('Your browser blocked the preview popup; allow popups for this site and try again'); return; }
    try{
      const res=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:projectForDisk()});
      const j=await res.json();
      if(j.ok) win.location.href=j.url;
      else { win.close(); toast('Preview failed: '+(j.error||'?')); }
    }catch(err){ win.close(); toast('Preview failed: '+err.message); }
  }
  else toast('Preview needs the local helper; launch via app.py / run_scenemaker.bat.');
}

/* ---- keyboard + boot ---------------------------------------------------- */
// #7: warn before closing/reloading the tab with unsaved edits, the standard
// browser-native way (custom text isn't shown by modern browsers regardless
// of what's put in returnValue - the browser's own generic prompt is all
// that's possible here, but it still stops the accidental-close/reload).
window.addEventListener('beforeunload',e=>{
  if(!_dirty) return;
  e.preventDefault(); e.returnValue='';
});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!document.getElementById('focus-modal').classList.contains('hidden')) closeFocus();
});
window.addEventListener('load',()=>{
  // #172(detach): a window opened by detachSurface() (editor/modules/
  // detach.js) shows a mirror of exactly one surface, not the real app -
  // none of its own dependency check/start screen/tutorial/menubar/dock
  // machinery has anything to do there (a "New project" click in a detached
  // mirror, for instance, would create a whole separate, disconnected
  // project object in ITS OWN heap, purely confusing since the real one
  // still lives in the main window). Checked first, before anything else.
  if(typeof _detachBootIfNeeded==='function' && _detachBootIfNeeded()) return;
  rebind();
  if(typeof initContextMenus==='function') initContextMenus();
  if(typeof initStatusBar==='function') initStatusBar();
  if(typeof applyPropsVisibility==='function') setTimeout(applyPropsVisibility,100);
  const applyLook=()=>{ loadToolTheme(); applyGridStyle(); if(typeof applyWorkspacePrefs==='function') applyWorkspacePrefs(); };
  applyLook(); // paint immediately from cache
  // tutorialVersionCheck() runs ONLY here, after the real ToolSettings.load()
  // resolves - never synchronously before it. A synchronous call used to sit
  // right above applyLook() too, reading whatever was in the pre-load cache;
  // in native mode (file://, no localStorage carried over from a browser-mode
  // session) that cache is often empty on a fresh window, so it read tutVersion
  // as unset and reset tutorialSeen/tut_seen_*/sampleOfferSeen back to "never
  // seen" - every single native launch, regardless of what settings.json
  // actually had - which is what made every mini-tutorial and the main
  // tutorial popup keep reappearing in app_native.py long after they'd been
  // dismissed for good in app.py's browser mode. Waiting for the real load()
  // (now itself fixed to wait for the pywebview bridge instead of racing it,
  // see tool-settings.js) means this check only ever runs against genuine,
  // reconciled state.
  if(ToolSettings && ToolSettings.load){         // then reconcile with the durable copy
    ToolSettings.load().then(()=>{ applyLook(); if(typeof loadWorkspacePrefsUI==='function') loadWorkspacePrefsUI(); if(typeof tutorialVersionCheck==='function') tutorialVersionCheck(); });
  }
  // #86: restore whatever tabs were open last session before falling back
  // to the normal start screen; ProjectTabs.init() resolves false when
  // nothing was saved. The sample story tour (tutorial.js's
  // startFullTutorial()) opens as one more ordinary in-UI tab through this
  // exact same ProjectTabs mechanism now - it used to boot a whole separate
  // browser tab straight into the tour before #86 added real in-UI tabs to
  // hand it off to instead, which is why there's no special-case left here.
  const runStartFallback=()=>{
    if(typeof showStartScreen==='function'){ showStartScreen(); }
    else { addScene(360,160); toast('New story; press ⚙️ SETTINGS to name it'); if(typeof maybeAutostartTutorial==='function') setTimeout(maybeAutostartTutorial, 800); }
  };
  const proceedPastStartup=()=>{
    if(typeof ProjectTabs!=='undefined' && ProjectTabs.init){
      ProjectTabs.init().then(hadTabs=>{ if(!hadTabs) runStartFallback(); });
    } else runStartFallback();
  };
  // #startup-check: a brief dependency-check loading screen gates just this
  // last step (start screen / tab restore), not the theme/menubar/etc. init
  // above, which all stay instant.
  if(typeof runDependencyCheck==='function') runDependencyCheck(proceedPastStartup);
  else proceedPastStartup();
});
