/* ============================================================================
   Scenemaker editor; multi-select scenes  (features #5, #6)
   Ctrl/Cmd-click toggles a scene in the selection; Shift-click adds; a plain
   click on an unselected scene selects just it. Selected scenes move together
   and share a Properties view for common edits. Shares core.js scope.
   ==========================================================================*/
let _selScenes = new Set();
function selCount(){ return _selScenes.size; }
function isSelected(id){ return _selScenes.has(id); }
function updateSelClasses(){
  document.querySelectorAll('.node.multi-sel').forEach(x=>x.classList.remove('multi-sel'));
  _selScenes.forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.add('multi-sel'); });
}
function clearSceneSelection(){ _selScenes.clear(); updateSelClasses(); }

function handleSceneMouseDown(e, id){
  const el=document.getElementById(id);
  if(e.ctrlKey||e.metaKey){ e.stopPropagation(); if(_selScenes.has(id)) _selScenes.delete(id); else _selScenes.add(id); updateSelClasses(); _selReflectProps(); return; }
  if(e.shiftKey){ e.stopPropagation(); _selScenes.add(id); updateSelClasses(); _selReflectProps(); return; }
  // plain click: keep a multi-selection if this scene is part of one (so you can drag the set)
  if(!_selScenes.has(id)){ _selScenes.clear(); _selScenes.add(id); updateSelClasses(); }
  if(typeof setSelectedNode==='function') setSelectedNode(id); else { selectedNode=id; document.querySelectorAll('.node.selected').forEach(x=>x.classList.remove('selected')); if(el) el.classList.add('selected'); }
  if((e.target.classList.contains('node')||e.target.classList.contains('node-header')) && !scenes[id].locked) startNodeDrag(e, id);
}
function _selReflectProps(){
  if(_selScenes.size>1){ if(typeof _propSel!=='undefined'){ _propSel={kind:'multi'}; } if(typeof _propReflect==='function') _propReflect(); }
  else if(_selScenes.size===1){ if(typeof selectSceneProp==='function') selectSceneProp([..._selScenes][0]); }
}
/* apply an action to every selected scene */
function forEachSelected(fn){ _selScenes.forEach(id=>{ if(scenes[id]) fn(scenes[id], id); }); }

/* Properties view when 2+ scenes are selected */
function _propMulti(box){
  const n=_selScenes.size;
  box.innerHTML=`<div class="prop-h">${n} scenes selected</div>
    <div class="hint" style="margin-bottom:8px">Edits below apply to all ${n} selected scenes.</div>
    <div class="fld"><label>Card colour</label><div style="display:flex;gap:8px"><input type="color" value="#334155" oninput="multiSetColor(this.value); hexSyncFromColor(this)" style="width:44px;height:28px;padding:0;border:none;background:none;cursor:pointer">${hexFieldHtml('#334155')}<button class="mini-btn" onclick="multiSetColor(null)">clear</button></div></div>
    <div class="fld"><label>Type</label><select onchange="multiSetMode(this.value)"><option value="">(leave as-is)</option><option value="dialogue">Dialogue</option><option value="cutscene">Cutscene</option></select></div>
    <label class="chk"><input type="checkbox" onchange="multiSetLock(this.checked)"> Lock all selected in place</label>
    <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="mini-btn" onclick="multiAddToGroup()" title="Add all selected scenes to a group">Add to group\u2026</button>
      <button class="mini-btn" onclick="multiCleanup()" title="Snap the selected scenes together">Snap together</button>
      <button class="mini-btn warn" onclick="multiDelete()">Delete all</button>
    </div>`;
}
function multiSetColor(c){ pushUndo(); forEachSelected(s=>{ s.color=c||null; }); renderScenes(); if(typeof renderScenesPanel==='function'&&document.getElementById('scene-list'))renderScenesPanel(); }
function multiSetMode(m){ if(!m)return; pushUndo(); forEachSelected(s=>{ s.mode=m; if(m==='cutscene'&&!s.cutscene)s.cutscene={dim:0.4,effect:'shadow',size:'lg',align:'center'}; }); renderScenes(); }
function multiSetLock(on){ pushUndo(); forEachSelected(s=>{ s.locked=!!on; }); renderScenes(); }
function multiDelete(){ const ids=[..._selScenes]; uiConfirm(`Delete <b>${ids.length}</b> selected scene${ids.length===1?'':'s'}?`, ()=>{ pushUndo(); ids.forEach(id=>{ Object.values(scenes).forEach(nn=>nn.choices.forEach(c=>{ c.outcomes.forEach(o=>{ if(o.targetNode===id)o.targetNode=null; }); if(Array.isArray(c.routes))c.routes.forEach(r=>{ if(r.target===id)r.target=''; }); if(c.portal && c.portal.scene===id)c.portal.scene=null; })); delete scenes[id]; }); clearSceneSelection(); if(typeof clearPropsSelection==='function')clearPropsSelection(); renderAll(); }, {yes:'Delete', no:'Cancel'}); }
/* snap a set of scenes into a tight cluster (keeps rough relative layout) */
function _snapCluster(ids){ if(ids.length<2) return;
  let cx=0,cy=0; ids.forEach(id=>{cx+=scenes[id].x;cy+=scenes[id].y;}); cx/=ids.length; cy/=ids.length;
  ids.forEach(id=>{ const s=scenes[id]; s.x=Math.max(0,Math.round(cx+(s.x-cx)*0.42)); s.y=Math.max(0,Math.round(cy+(s.y-cy)*0.42)); });
  for(let it=0;it<90;it++){ let moved=false;
    for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){ const A=(typeof _sceneRect==='function')?_sceneRect(ids[i]):{x:scenes[ids[i]].x,y:scenes[ids[i]].y,w:420,h:240}; const B=(typeof _sceneRect==='function')?_sceneRect(ids[j]):{x:scenes[ids[j]].x,y:scenes[ids[j]].y,w:420,h:240};
      if(typeof _overlap==='function' && _overlap(A,B,26)){ let dx=(A.x-B.x)||(Math.random()-0.5),dy=(A.y-B.y)||(Math.random()-0.5); const L=Math.hypot(dx,dy)||1; scenes[ids[i]].x=Math.max(0,scenes[ids[i]].x+(dx/L)*26); scenes[ids[j]].x=Math.max(0,scenes[ids[j]].x-(dx/L)*26); scenes[ids[i]].y=Math.max(0,scenes[ids[i]].y+(dy/L)*26); scenes[ids[j]].y=Math.max(0,scenes[ids[j]].y-(dy/L)*26); moved=true; } }
    if(!moved) break; } }
function multiCleanup(){ const ids=[..._selScenes]; if(ids.length<2) return; pushUndo(); _snapCluster(ids); renderAll(); }

/* #6: add the selected scenes to a group (existing or new) */
function multiAddToGroup(ev){ const ids=[..._selScenes]; if(!ids.length) return;
  const groups=Object.values(typeof visibleBackdrops==='function'?visibleBackdrops():backdrops);
  const items=[{ icon:'\u2795', label:'New group (snap them together)', onClick:()=>_multiToNewGroup(ids) }];
  groups.forEach(g=>items.push({ icon:'\u25A2', label:'Add to \u201C'+(g.name||'group')+'\u201D', onClick:()=>_multiToGroup(ids,g.id) }));
  const x=(ev&&ev.clientX)||(window.innerWidth-360), y=(ev&&ev.clientY)||170;
  if(typeof showContextMenu==='function') showContextMenu(x,y,items); else _multiToNewGroup(ids);
}
function _multiToGroup(ids,gid){ pushUndo(); ids.forEach(id=>{ if(scenes[id]) scenes[id].group=gid; }); if(typeof refitGroup==='function') refitGroup(gid); renderAll(); toast(ids.length+' scene'+(ids.length===1?'':'s')+' added to group'); }
function _multiToNewGroup(ids){ pushUndo(); _snapCluster(ids);
  const gid=genId('bd'); const cols=(typeof GROUP_COLORS!=='undefined')?GROUP_COLORS:['#334155'];
  backdrops[gid]={ id:gid, x:0, y:0, w:360, h:240, color:cols[Object.keys(backdrops).length%cols.length], name:'Group' };
  ids.forEach(id=>{ if(scenes[id]) scenes[id].group=gid; });
  if(typeof refitGroup==='function') refitGroup(gid, true);   // exact-fit the fresh group to the snapped cluster
  renderAll(); if(typeof selectGroupProp==='function') selectGroupProp(gid); toast('New group with '+ids.length+' scene'+(ids.length===1?'':'s')); }

function selectSceneMulti(){ if(typeof _propSel!=="undefined"){ _propSel={kind:"multi"}; } if(typeof openDock==="function") openDock("props"); if(typeof renderPropsPanel==="function") renderPropsPanel(); }
