/* ============================================================================
   Scenemaker editor; workspace preferences (this computer)
   Zoom-control visibility + always-on-top (#5), mouse-wheel-zoom (#5), and the
   grid dot spacing / size / off (#6). All stored via ToolSettings (per-computer,
   like the theme). Grid rendering + snapping live in core.js (applyGridStyle /
   snapXY); this file owns the toggles, the wheel handler, and their settings UI.
   Ctrl/Cmd+wheel always zooms the canvas, independent of the plain-wheel-zoom
   toggle below, so the browser's own page-zoom never fires over the workspace.
   ==========================================================================*/
function applyWorkspacePrefs(){
  if(typeof applyGridStyle==='function') applyGridStyle();
  var zc=document.getElementById('zoom-controls');
  if(zc){ zc.style.zIndex='300'; // always above docked panels
    zc.style.display = (ToolSettings.get('showZoom','1')==='1') ? 'flex' : 'none'; }
  var ws=document.getElementById('workspace');
  if(ws && !ws._wheelZoomBound){ ws._wheelZoomBound=true;
    ws.addEventListener('wheel', function(e){
      // Ctrl/Cmd+wheel (and a trackpad pinch, which the browser reports the
      // same way) always zooms the canvas instead of the page; caught here so
      // it never reaches the browser's own page-zoom.
      // #14: zooms centered on the cursor (or the selected scene, if one is
      // selected - see setZoomAtCursor()'s own header comment) instead of
      // always drifting toward the canvas's fixed top-left corner.
      if(e.ctrlKey||e.metaKey){ e.preventDefault(); setZoomAtCursor(e.deltaY<0 ? 0.1 : -0.1, e.clientX, e.clientY); return; }
      if(ToolSettings.get('wheelZoom','0')!=='1') return; // off: normal scroll
      e.preventDefault(); setZoomAtCursor(e.deltaY<0 ? 0.1 : -0.1, e.clientX, e.clientY); // on: plain wheel zooms too
    }, {passive:false});
  }
}
function setWorkspacePref(key,on){ ToolSettings.set(key, on?'1':'0'); applyWorkspacePrefs();
  if(key==='snapScenes' && typeof buildMenubar==='function') buildMenubar();
  if(key==='fadeOccludedLines' && typeof renderScenes==='function') renderScenes(); }
function setGridSpacing(v){ var n=Math.max(8,Math.min(160,parseInt(v,10)||30)); ToolSettings.set('gridSpacing',String(n)); if(typeof applyGridStyle==='function') applyGridStyle(); }
function setGridDot(v){ ToolSettings.set('gridDot',String(parseInt(v,10)||0)); if(typeof applyGridStyle==='function') applyGridStyle(); }
function loadWorkspacePrefsUI(){
  var g=function(id){return document.getElementById(id);};
  if(g('ws-showzoom'))  g('ws-showzoom').checked  = ToolSettings.get('showZoom','1')==='1';
  if(g('ws-wheelzoom')) g('ws-wheelzoom').checked = ToolSettings.get('wheelZoom','0')==='1';
  if(g('ws-snap'))      g('ws-snap').checked      = ToolSettings.get('snapScenes','0')==='1';
  if(g('ws-gridspace')) g('ws-gridspace').value   = (typeof gridSpacing==='function'?gridSpacing():30);
  if(g('ws-griddot'))   g('ws-griddot').value     = ToolSettings.get('gridDot','1');
  if(g('ws-tutorial'))  g('ws-tutorial').checked  = ToolSettings.get('tutorialOff','0')!=='1';
  if(g('ws-confirmdel')) g('ws-confirmdel').checked = ToolSettings.get('confirmDeleteScene','1')==='1';
  if(g('ws-ceoob')) g('ws-ceoob').checked = ToolSettings.get('ceOobWarnOff','0')!=='1';
  if(g('ws-ceunsaved')) g('ws-ceunsaved').checked = ToolSettings.get('ceUnsavedWarnOff','0')!=='1';
  if(g('ws-obstructwarn')) g('ws-obstructwarn').checked = ToolSettings.get('obstructWarnOff','0')!=='1';
  if(g('ws-dockoffer')) g('ws-dockoffer').checked = ToolSettings.get('dockOfferOff','0')!=='1';
  if(g('ws-endpointdisc')) g('ws-endpointdisc').checked = ToolSettings.get('endpointDisconnectOff','0')!=='1';
  if(g('ws-openoverlap')) g('ws-openoverlap').checked = ToolSettings.get('openOverlapWarnOff','0')!=='1';
  if(g('ws-groupannex')) g('ws-groupannex').checked = ToolSettings.get('groupAnnexOff','0')!=='1';
  if(g('ws-assetquality')) g('ws-assetquality').checked = ToolSettings.get('assetQualityWarnOff','0')!=='1';
  if(g('ws-pinchars')) g('ws-pinchars').checked = ToolSettings.get('pinChars','1')==='1';
  if(g('ws-pincount')) g('ws-pincount').checked = ToolSettings.get('pinLineCount','0')==='1';
  if(g('ws-compact')) g('ws-compact').checked = ToolSettings.get('compactCards','1')==='1';
  if(g('ws-lorem')) g('ws-lorem').checked = ToolSettings.get('loremAutofill','0')==='1';
  if(g('ws-propshide')) g('ws-propshide').value = ToolSettings.get('propsAutoHide','hide');
  if(g('ws-autogrow')) g('ws-autogrow').checked = ToolSettings.get('autoGrowCanvas','1')==='1';
  if(g('ws-nooverlap')) g('ws-nooverlap').checked = ToolSettings.get('disableOverlap','0')==='1';
  if(g('ws-fadeoccluded')) g('ws-fadeoccluded').checked = ToolSettings.get('fadeOccludedLines','1')==='1';
  if(g('ws-hidebar')) g('ws-hidebar').checked = ToolSettings.get('hideBottomBar','0')==='1';
  if(g('ws-ribbon')) g('ws-ribbon').value = ToolSettings.get('ribbonAutoHide','0');
  if(g('ws-sbscenes')) g('ws-sbscenes').checked = ToolSettings.get('sbShowScenes','1')==='1';
  if(g('ws-sbchoices')) g('ws-sbchoices').checked = ToolSettings.get('sbShowChoices','1')==='1';
  if(g('ws-sblines')) g('ws-sblines').checked = ToolSettings.get('sbShowLines','1')==='1';
  if(g('ws-sbsize')) g('ws-sbsize').checked = ToolSettings.get('sbShowSize','1')==='1';
  if(g('ws-sbendpoints')) g('ws-sbendpoints').checked = ToolSettings.get('sbShowEndpoints','1')==='1';
  if(g('ws-sbportals')) g('ws-sbportals').checked = ToolSettings.get('sbShowPortals','1')==='1';
  if(g('ws-sbfraction')) g('ws-sbfraction').checked = ToolSettings.get('sbFraction','0')==='1';
  if(g('ws-toastoff')) g('ws-toastoff').checked = ToolSettings.get('toastsOff','0')!=='1';
  if(g('ws-toastdur')) g('ws-toastdur').value = ToolSettings.get('toastDuration','3');
  if(g('ws-tooltipoff')) g('ws-tooltipoff').checked = ToolSettings.get('tooltipOff','0')!=='1';
  if(g('ws-tooltipdelay')) g('ws-tooltipdelay').value = ToolSettings.get('tooltipDelay','500');
  if(g('ws-autosaveon')) g('ws-autosaveon').checked = ToolSettings.get('autosaveOn','0')==='1';
  if(g('ws-autosaveinterval')) g('ws-autosaveinterval').value = ToolSettings.get('autosaveInterval','5');
  if(typeof loadDefaultPathsUI==='function') loadDefaultPathsUI();
  if(typeof loadExtKeysUI==='function') loadExtKeysUI();
  if(typeof loadNativeWinPrefsUI==='function') loadNativeWinPrefsUI();
}
