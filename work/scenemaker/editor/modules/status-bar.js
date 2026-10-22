/* ============================================================================
   Scenemaker editor; bottom status bar + ribbon auto-hide  (feature #13)
   A slim Windows-style bottom bar with a zoom slider. Optionally hidden. The top
   ribbon can auto-hide after a (possibly decimal) number of idle seconds and
   reappear when the mouse nears the top. Shares core.js scope.
   ==========================================================================*/
function setZoomTo(z){ zoomLevel=Math.min(2,Math.max(0.3,+(+z).toFixed(2))); applyZoom(); }
function syncZoomSlider(){ const s=document.getElementById('zoom-slider'); if(s) s.value=Math.round(zoomLevel*100); }

function applyStatusBarPref(){
  const on=(typeof ToolSettings==='undefined')||ToolSettings.get('hideBottomBar','0')!=='1';
  const bar=document.getElementById('status-bar');
  if(bar) bar.classList.toggle('hidden', !on);
  document.body.classList.toggle('sb-on', on);
  // docked side panels reserve space for the status bar only while it's
  // shown (see layoutDocks()); re-run it so toggling this setting live
  // reclaims or gives back that space immediately, not just on next open.
  if(typeof layoutDocks==='function') layoutDocks();
}
function setHideBottomBar(hide){ if(typeof ToolSettings!=='undefined') ToolSettings.set('hideBottomBar', hide?'1':'0'); applyStatusBarPref(); }

let _ribbonTimer=null;
function ribbonAutoHideSecs(){ const v=(typeof ToolSettings!=='undefined')?parseFloat(ToolSettings.get('ribbonAutoHide','0')):0; return isNaN(v)?0:v; }
function setRibbonAutoHide(secs){ const v=Math.max(0,parseFloat(secs)||0); if(typeof ToolSettings!=='undefined') ToolSettings.set('ribbonAutoHide', String(v)); armRibbonAutoHide(); }
function showRibbon(){ document.body.classList.remove('ribbon-hidden'); armRibbonAutoHide(); }
function hideRibbon(){ const secs=ribbonAutoHideSecs(); if(secs>0) document.body.classList.add('ribbon-hidden'); }
function armRibbonAutoHide(){ if(_ribbonTimer){ clearTimeout(_ribbonTimer); _ribbonTimer=null; }
  const secs=ribbonAutoHideSecs();
  if(secs>0){ _ribbonTimer=setTimeout(hideRibbon, secs*1000); } else { document.body.classList.remove('ribbon-hidden'); } }
function initStatusBar(){
  applyStatusBarPref(); syncZoomSlider(); refreshSbToolButtons(); _sbBindCoordTracking(); refreshSbCoords();
  // ribbon auto-hide: peek strip at top reveals it; activity resets the timer
  let peek=document.getElementById('ribbon-peek');
  if(!peek){ peek=document.createElement('div'); peek.id='ribbon-peek'; document.body.appendChild(peek); }
  peek.addEventListener('mouseenter', showRibbon);
  const bar=document.querySelector('.ui-bar'); if(bar){ bar.addEventListener('mouseenter', showRibbon); bar.addEventListener('mouseleave', armRibbonAutoHide); }
  // The app menu bar (File/Edit/View...) stays visible even while the ribbon
  // below it auto-hides, and it has to sit ABOVE #ribbon-peek in stacking
  // order so its own menus stay clickable - which meant hovering anywhere on
  // it (the one thing actually visible up there once the ribbon is gone)
  // never reached the peek strip underneath, so the ribbon never came back
  // unless the mouse found the literal top few pixels of the window instead
  // of the bar a user can actually see. Wire its hover to the same reveal
  // directly, and widen the coordinate fallback below to match its real
  // height instead of a sliver only the topmost pixels would ever satisfy.
  const menubar=document.getElementById('menubar'); if(menubar) menubar.addEventListener('mouseenter', showRibbon);
  document.addEventListener('mousemove', e=>{ if(e.clientY<34) showRibbon(); });
  armRibbonAutoHide();
}
/* keep the slider in sync whenever zoom changes */
(function(){ const _apply=window.applyZoom; if(typeof _apply==='function'){ window.applyZoom=function(){ _apply.apply(this,arguments); syncZoomSlider(); }; } })();

/* ---- bottom-bar quick toggles: orthogonal wiring, snap-to-grid, fullscreen
   Mirrors a PowerPoint-style status bar: view/mode toggles that would
   otherwise be buried a menu or two deep (Story Settings, the View menu)
   get one-click access right where the zoom controls already live. ------- */
const SB_FS_ENTER_ICON='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
const SB_FS_EXIT_ICON='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
function toggleEditorFullscreen(){
  const el=document.documentElement;
  if(!document.fullscreenElement){ (el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el); }
  else { (document.exitFullscreen||document.webkitExitFullscreen||function(){}).call(document); }
}
function refreshFullscreenBtn(){
  const b=document.getElementById('sb-fullscreen'); if(!b) return;
  const isFs=!!document.fullscreenElement;
  b.innerHTML=isFs?SB_FS_EXIT_ICON:SB_FS_ENTER_ICON;
  b.title=isFs?'Exit fullscreen':'Fullscreen';
}
document.addEventListener('fullscreenchange', refreshFullscreenBtn);
document.addEventListener('webkitfullscreenchange', refreshFullscreenBtn);

// Smart orthogonal wiring is a per-project setting normally only reachable
// via Story Settings' "Save" button; this flips it live and keeps that
// modal's own checkbox in sync in case it's open at the same time.
function toggleOrthoWiringQuick(){
  if(typeof project==='undefined'||!project.settings) return;
  project.settings.useSmartRouting=!project.settings.useSmartRouting;
  if(typeof globalSettings!=='undefined') globalSettings.useSmartRouting=project.settings.useSmartRouting;
  const chk=document.getElementById('st-smart'); if(chk) chk.checked=project.settings.useSmartRouting;
  if(typeof SceneConnections!=='undefined') SceneConnections.renderLines();
  refreshSbToolButtons();
  if(typeof toast==='function') toast('Orthogonal wiring '+(project.settings.useSmartRouting?'on':'off'));
}
function toggleSnapScenesQuick(){ if(typeof toggleSnapScenes==='function') toggleSnapScenes(); refreshSbToolButtons(); }
function refreshSbToolButtons(){
  const ortho=document.getElementById('sb-ortho');
  if(ortho) ortho.classList.toggle('active', !!(typeof project!=='undefined'&&project.settings&&project.settings.useSmartRouting));
  const snap=document.getElementById('sb-snap');
  if(snap) snap.classList.toggle('active', (typeof ToolSettings!=='undefined')&&ToolSettings.get('snapScenes','0')==='1');
  refreshFullscreenBtn();
}

// #4: jump-to buttons for the two spots you most often want back - the
// project's own start scene, and whatever scene you were last working on
// (project.meta.lastEditScene, the same field #2/#9 already use to land you
// back there on reopen) - a direct owner request, reusing warpAcrossLayers()
// (layers.js) so this also works correctly across layers, not just within
// whichever one happens to be on screen right now.
function warpToStartScene(){
  const id=(typeof layerStartScene==='function' && typeof currentLayerId!=='undefined') ? layerStartScene(currentLayerId) : (typeof project!=='undefined'&&project.settings?project.settings.startScene:null);
  if(!id || !(typeof scenes!=='undefined' && scenes[id])){ if(typeof toast==='function') toast('No start scene set for this layer yet'); return; }
  if(typeof warpAcrossLayers==='function') warpAcrossLayers(id);
}
function warpToLastEditedScene(){
  const id=typeof project!=='undefined' && project.meta ? project.meta.lastEditScene : null;
  if(!id || !(typeof scenes!=='undefined' && scenes[id])){ if(typeof toast==='function') toast('Nothing tracked as last-edited yet'); return; }
  if(typeof warpAcrossLayers==='function') warpAcrossLayers(id);
}

// #2: a live X/Y readout on the bottom bar - the cursor's own logical
// (unscaled, stage-space) position while it's over the canvas, or the
// selected scene/group's own top-left position when something's selected
// (mousemove is deliberately raw, no distance clamp - the report just
// asked to SEE the coordinates, not for a snap/measure tool). Selection
// takes priority over a stale last-known cursor position so it can't read
// "cursor" coordinates that are actually just wherever the mouse used to be.
let _sbLastCursorLogical=null;
function _sbFormatCoords(x,y){ return 'X: '+Math.round(x)+'  Y: '+Math.round(y); }
function refreshSbCoords(){
  const el=document.getElementById('sb-coords'); if(!el) return;
  if(typeof selectedNode!=='undefined' && selectedNode && typeof scenes!=='undefined' && scenes[selectedNode]){
    const n=scenes[selectedNode];
    el.textContent=_sbFormatCoords(n.x,n.y);
    el.title='Selected scene’s own X/Y position on the stage';
    return;
  }
  if(typeof backdrops!=='undefined' && typeof _propSel!=='undefined' && _propSel && _propSel.kind==='group' && backdrops[_propSel.gid]){
    const b=backdrops[_propSel.gid];
    el.textContent=_sbFormatCoords(b.x,b.y);
    el.title='Selected group’s own X/Y position on the stage';
    return;
  }
  if(_sbLastCursorLogical){
    el.textContent=_sbFormatCoords(_sbLastCursorLogical.x,_sbLastCursorLogical.y);
    el.title='Cursor position on the stage';
  } else {
    el.textContent='';
    el.title='';
  }
}
function _sbBindCoordTracking(){
  const ws=document.getElementById('workspace'); if(!ws || ws._sbCoordsBound) return;
  ws._sbCoordsBound=true;
  ws.addEventListener('mousemove', e=>{
    _sbLastCursorLogical=(typeof getLogicalCoords==='function')?getLogicalCoords(e):null;
    refreshSbCoords();
  });
  ws.addEventListener('mouseleave', ()=>{ _sbLastCursorLogical=null; refreshSbCoords(); });
}
