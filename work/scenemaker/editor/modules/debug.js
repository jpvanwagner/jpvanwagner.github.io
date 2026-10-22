/* ============================================================================
   Scenemaker editor; debug features
   The Back/Forward/Restart/Reset-all/variable-editor toggles that appear in the
   settings modal, plus the read-only SM state handle used by automated tests.
   Classic script sharing global scope with core.js.
   ==========================================================================*/
function defaultDebug(){ return { enabled:false, back:false, forward:false, restart:false, resetAll:false, varEditor:false, sceneName:false, interactionCount:false }; }

/* Grey the sub-options until the master "enable debug features" box is ticked. */
function debugToggleUI(){
  const on=document.getElementById('st-debug-enabled').checked;
  const subs=document.getElementById('st-debug-subs');
  if(subs){ subs.style.opacity=on?'1':'.5'; subs.style.pointerEvents=on?'auto':'none'; }
}
function debugSettingsOpen(){
  const d=(project.settings.debug)||defaultDebug();
  document.getElementById('st-debug-enabled').checked=!!d.enabled;
  document.getElementById('st-debug-back').checked=!!d.back;
  document.getElementById('st-debug-fwd').checked=!!d.forward;
  document.getElementById('st-debug-restart').checked=!!d.restart;
  document.getElementById('st-debug-resetall').checked=!!d.resetAll;
  document.getElementById('st-debug-vareditor').checked=!!d.varEditor;
  if(document.getElementById('st-debug-scenename')) document.getElementById('st-debug-scenename').checked=!!d.sceneName;
  if(document.getElementById('st-debug-interactioncount')) document.getElementById('st-debug-interactioncount').checked=!!d.interactionCount;
  debugToggleUI();
}
function debugSettingsSave(){
  project.settings.debug={
    enabled:document.getElementById('st-debug-enabled').checked,
    back:document.getElementById('st-debug-back').checked,
    forward:document.getElementById('st-debug-fwd').checked,
    restart:document.getElementById('st-debug-restart').checked,
    resetAll:document.getElementById('st-debug-resetall').checked,
    varEditor:document.getElementById('st-debug-vareditor').checked,
    sceneName:!!(document.getElementById('st-debug-scenename')&&document.getElementById('st-debug-scenename').checked),
    interactionCount:!!(document.getElementById('st-debug-interactioncount')&&document.getElementById('st-debug-interactioncount').checked)
  };
}
/* Migrate the older settings.nav shape into settings.debug on load. */
function migrateDebug(p){
  const s=p.settings||{};
  if(!s.debug){
    const nav=s.nav||{};
    s.debug=Object.assign(defaultDebug(), { enabled:!!(nav.back||nav.forward||nav.restart), back:!!nav.back, forward:!!nav.forward, restart:!!nav.restart });
  } else {
    s.debug=Object.assign(defaultDebug(), s.debug);
  }
  return s.debug;
}

/* Debug/automation handle (harmless): read-only view of live editor state. */
window.SM = { state:()=>({project,scenes,backdrops}), render:()=>renderScenes() };
