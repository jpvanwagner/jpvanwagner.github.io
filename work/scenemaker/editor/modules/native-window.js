/* ============================================================================
   Scenemaker editor; native window prefs (Settings -> Workspace)
   Transparent/overlay window background and a launch-time window size, both
   native-app-only (app_native.py / pywebview) - a plain browser tab has no
   window of its own to affect. Unlike default file paths (default-paths.js,
   read at click-time, in-page), these must be known BEFORE the native window
   even opens, so they can't just live in ToolSettings the normal way (native
   mode has no live HTTP server for ToolSettings' own /__settings round-trip
   to reach; see tool-settings.js's own docstring). Persisted through a small
   dedicated bridge call straight to the same settings.json app.py already
   owns, so app_native.py's main() can read it with plain Python before
   creating any window. Takes effect on the NEXT native launch, not live -
   the window is already open by the time this page can run - so
   setNativeWinPref() below offers to restart right then and there (via the
   restart_app() bridge call, app_native.py) instead of leaving that as an
   easy-to-miss toast.
   Also mirrored into ToolSettings (browser-mode-visible, matches every other
   Settings field's own storage), it just has nothing to act on there.
   Shares core.js scope.
   ==========================================================================*/
function nativeWinPrefs(){
  return {
    overlay: ToolSettings.get('nwOverlay','0')==='1',
    sizeMode: ToolSettings.get('nwSizeMode','default'),
    widthPct: parseInt(ToolSettings.get('nwWidthPct','50'),10) || 50,
    heightPct: parseInt(ToolSettings.get('nwHeightPct','90'),10) || 90,
  };
}
function setNativeWinPref(key,val){
  const map={overlay:'nwOverlay', sizeMode:'nwSizeMode', widthPct:'nwWidthPct', heightPct:'nwHeightPct'};
  const k=map[key]; if(!k) return;
  ToolSettings.set(k, (key==='overlay') ? (val?'1':'0') : String(val));
  _pushNativeWinPrefs();
  // A toast for this was easy to miss (a bottom-corner flash for a change
  // that needs a real restart to actually take effect) - offer to restart
  // right now instead, but only when there's an actual native window to
  // restart (HAS_BRIDGE() and a new-enough app_native.py exposing
  // restart_app()); a plain browser tab has nothing to relaunch, and an
  // older native build without restart_app() falls back to the toast too.
  if(HAS_BRIDGE() && window.pywebview.api.restart_app){
    if(typeof uiConfirm==='function'){
      uiConfirm('This change takes effect the next time Scenemaker’s native window launches. Restart now?',
        ()=>{ window.pywebview.api.restart_app(); },
        { yes:'Restart now', no:'Later' });
    }
  } else if(typeof toast==='function'){
    toast('Saved; takes effect the next time the native app launches.');
  }
}
function _pushNativeWinPrefs(){
  if(!HAS_BRIDGE()) return;   // browser mode has nothing to push this to; the ToolSettings mirror above is enough
  if(window.pywebview.api.set_window_prefs) window.pywebview.api.set_window_prefs(nativeWinPrefs());
}
function _nwToggleCustomRow(){
  const row=document.getElementById('ws-nw-custom-row'); if(!row) return;
  row.style.display = (nativeWinPrefs().sizeMode==='custom') ? '' : 'none';
}
function loadNativeWinPrefsUI(){
  const g=id=>document.getElementById(id), p=nativeWinPrefs();
  if(g('ws-nw-overlay')) g('ws-nw-overlay').checked = p.overlay;
  if(g('ws-nw-sizemode')) g('ws-nw-sizemode').value = p.sizeMode;
  if(g('ws-nw-widthpct')) g('ws-nw-widthpct').value = p.widthPct;
  if(g('ws-nw-heightpct')) g('ws-nw-heightpct').value = p.heightPct;
  _nwToggleCustomRow();
}
