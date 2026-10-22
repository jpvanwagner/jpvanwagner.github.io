/* ============================================================================
   Scenemaker editor; default file paths  (Settings -> Workspace)
   Per-computer starting folders for the NATIVE file dialogs (pick media, open/
   save a project, export SCORM/executable) - a plain browser tab has no way
   to influence this (no browser API lets a page suggest a starting directory
   for its own file/save picker, by design), so this only ever does anything
   once running via app_native.py (HAS_BRIDGE()). Stored via ToolSettings,
   same per-computer scope as theme/tooltips/autosave; the fields still show
   and save fine in browser mode, they just have nothing to act on yet.
   Shares core.js scope.
   ==========================================================================*/
const DEFAULT_PATH_KINDS = ['media', 'projects', 'exports'];
function defaultPathFor(kind){ return (typeof ToolSettings!=='undefined') ? ToolSettings.get('path_'+kind, '') : ''; }
function setDefaultPath(kind, val){ if(typeof ToolSettings!=='undefined') ToolSettings.set('path_'+kind, (val||'').trim()); }
function clearDefaultPath(kind){ setDefaultPath(kind, ''); const el=document.getElementById('ws-path-'+kind); if(el) el.value=''; }
function pickDefaultFolder(kind){
  if(!HAS_BRIDGE()){ if(typeof toast==='function') toast('Browsing for a folder needs the native app; launch via app_native.py or run_scenemaker.bat.'); return; }
  window.pywebview.api.pick_folder().then(function(r){
    if(r && r.ok && r.path){ setDefaultPath(kind, r.path); const el=document.getElementById('ws-path-'+kind); if(el) el.value=r.path; }
  });
}
function loadDefaultPathsUI(){
  DEFAULT_PATH_KINDS.forEach(function(kind){ const el=document.getElementById('ws-path-'+kind); if(el) el.value=defaultPathFor(kind); });
}
