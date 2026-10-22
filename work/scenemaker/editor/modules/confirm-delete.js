/* ============================================================================
   Scenemaker editor; delete-scene confirmation  (feature #1)
   A confirm modal before deleting a scene, with a "Don't ask me again" toggle
   that's remembered and can be turned back on in Settings → Workspace.
   Shares global scope with core.js.
   ==========================================================================*/
function confirmDeleteScene(id){
  const n=scenes[id]; if(!n) return;
  if(typeof ToolSettings!=='undefined' && ToolSettings.get('confirmDeleteScene','1')!=='1'){ deleteScene(id); return; }
  uiConfirm(`Delete scene <b>${escHtml(n.title||'(untitled)')}</b>?<br><span class="hint">You can still undo with Ctrl+Z.</span>`,
    ()=>{ deleteScene(id); if(typeof selectedNode!=='undefined' && selectedNode===id){ if(typeof setSelectedNode==='function') setSelectedNode(null); else selectedNode=null; } },
    { yes:'Delete scene', no:'Cancel',
      checkbox:{ label:'Don\u2019t ask me again (re-enable in Settings \u2192 Workspace)',
                 onChecked:()=>{ if(typeof ToolSettings!=='undefined') ToolSettings.set('confirmDeleteScene','0'); } } });
}
function setConfirmDelete(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('confirmDeleteScene', on?'1':'0'); }
