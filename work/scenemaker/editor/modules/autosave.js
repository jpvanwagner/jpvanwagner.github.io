/* ============================================================================
   Scenemaker editor; periodic autosave  (#146)
   Off by default (opt-in, so nothing changes for anyone updating to this
   version without asking for it). When on, ticks every N minutes and - ONLY
   if there are actually unsaved changes - saves, but ONLY through a path
   that can write silently, with no dialog and no surprise download:
     - a File System Access handle already connected (the browser "Open a
       file..." flow, once a real handle exists)
     - the native app, once a file is actually connected (checked via the
       bridge's own is_connected(), so this never pops a native Save dialog
       in the background)
   Anywhere else (a plain browser tab with nothing connected yet, where the
   only "save" available is a fresh Downloads-folder file every time) it
   shows a gentle reminder toast instead of silently spamming downloads.
   Both prefs are per-computer (ToolSettings), like the rest of Settings ->
   Workspace.
   Shares core.js scope.
   ==========================================================================*/
let _autosaveTimer=null;
function autosaveOn(){ return typeof ToolSettings!=='undefined' && ToolSettings.get('autosaveOn','0')==='1'; }
function autosaveIntervalMin(){ if(typeof ToolSettings==='undefined') return 5;
  const v=parseInt(ToolSettings.get('autosaveInterval','5'),10); return isNaN(v)?5:Math.max(1,Math.min(60,v)); }
function setAutosaveOn(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('autosaveOn', on?'1':'0'); autosaveArm(); }
function setAutosaveInterval(min){ const n=parseInt(min,10); const v=Math.max(1,Math.min(60,isNaN(n)?5:n));
  if(typeof ToolSettings!=='undefined') ToolSettings.set('autosaveInterval', String(v)); autosaveArm(); }
function autosaveArm(){
  if(_autosaveTimer){ clearInterval(_autosaveTimer); _autosaveTimer=null; }
  if(!autosaveOn()) return;
  _autosaveTimer=setInterval(autosaveTick, autosaveIntervalMin()*60000);
}
async function autosaveTick(){
  if(!autosaveOn() || typeof _dirty==='undefined' || !_dirty) return; // nothing changed since the last save
  // no HAS_SERVER() gate here: _fsHandle is only ever set inside _saveVia()'s
  // own HAS_SERVER()+_hasFsAccess() branch in the first place, so a real,
  // truthy _fsHandle already implies that context on its own.
  if(typeof _hasFsAccess==='function' && _hasFsAccess() && typeof _fsHandle!=='undefined' && _fsHandle){
    if(typeof doSave==='function') doSave(); // the File System Access handle path in _saveVia() writes silently, no dialog
    return;
  }
  if(typeof HAS_BRIDGE==='function' && HAS_BRIDGE()){
    try{
      const r=await window.pywebview.api.is_connected();
      if(r && r.connected){ if(typeof doSave==='function') doSave(); return; }
    }catch(e){}
  }
  if(typeof toast==='function') toast('Autosave: remember to save; nothing connected yet to save to silently');
}
window.addEventListener('load', ()=>{ if(typeof ToolSettings!=='undefined' && ToolSettings.load){ ToolSettings.load().then(autosaveArm); } autosaveArm(); });
