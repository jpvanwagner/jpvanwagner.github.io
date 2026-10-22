/* ============================================================================
   Scenemaker editor; right-click context menus  (features #2, #3)
   A single generic menu (showContextMenu) plus context-sensitive builders for
   empty canvas, scenes and groups. Wired via one 'contextmenu' listener that
   inspects what was clicked. Shares global scope with core.js.
   ==========================================================================*/
let _ctxEl=null, _sceneClipboard=null, _ctxLastEvent=null;

function _ctxHide(){ if(_ctxEl){ _ctxEl.remove(); _ctxEl=null; document.removeEventListener('mousedown',_ctxOutside,true); } }
function _ctxOutside(e){ if(_ctxEl && !_ctxEl.contains(e.target)) _ctxHide(); }
function showContextMenu(x, y, items){
  _ctxHide();
  const m=document.createElement('div'); m.className='ctx-menu';
  items.forEach(it=>{
    if(it.sep){ const s=document.createElement('div'); s.className='ctx-sep'; m.appendChild(s); return; }
    const row=document.createElement('div'); row.className='ctx-item'+(it.disabled?' disabled':'');
    row.innerHTML=`<span class="ctx-ic">${it.icon||''}</span><span>${it.label}</span>`;
    if(!it.disabled) row.addEventListener('click',()=>{ _ctxHide(); it.onClick&&it.onClick(); });
    m.appendChild(row);
  });
  document.body.appendChild(m);
  // keep on-screen
  const w=m.offsetWidth||200, h=m.offsetHeight||100;
  m.style.left=Math.min(x, window.innerWidth-w-6)+'px';
  m.style.top =Math.min(y, window.innerHeight-h-6)+'px';
  _ctxEl=m;
  setTimeout(()=>document.addEventListener('mousedown',_ctxOutside,true),0);
}

/* ---- clipboard (scenes) ------------------------------------------------- */
function copyScene(id){ const n=scenes[id]; if(!n) return; _sceneClipboard=JSON.parse(JSON.stringify(n));
  try{ if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(JSON.stringify(n)); }catch(e){}
  toast('Scene copied'); }
function pasteSceneAt(x,y){ if(!_sceneClipboard){ toast('Nothing to paste'); return; }
  pushUndo(); const s=cloneScene(_sceneClipboard,0,0); s.x=Math.max(0,x); s.y=Math.max(0,y); s.group=null; scenes[s.id]=s; renderScenes(); selectNode(s.id); toast('Scene pasted'); }
function selectNode(id){ if(typeof setSelectedNode==='function') setSelectedNode(id); else selectedNode=id; }

/* ---- menu builders ------------------------------------------------------ */
function ctxSceneItems(id){
  const n=scenes[id]; const inGroup=!!(n&&n.group);
  if(typeof _selScenes!=='undefined' && _selScenes.size>1 && _selScenes.has(id)){
    return [
      { icon:'\u25A2', label:'Add '+_selScenes.size+' scenes to group\u2026', onClick:(ev)=>multiAddToGroup(_ctxLastEvent) },
      { icon:'\u2921', label:'Snap the '+_selScenes.size+' together', onClick:()=>multiCleanup() },
      { icon:'\u2317', label:'Card colour for all\u2026', onClick:()=>selectSceneMulti() },
      { sep:true },
      { icon:'\u2715', label:'Delete '+_selScenes.size+' scenes', onClick:()=>multiDelete() },
    ];
  }
  return [
    { icon:'⤢', label:'Focus / edit', onClick:()=>focusScene(id) },
    { icon:'⧉', label:'Duplicate', onClick:()=>duplicateScene(id) },
    { icon:'⧉', label:'Copy', onClick:()=>copyScene(id) },
    { icon:'➔', label:'Add linked next scene', onClick:()=>addLinkedNext(id) },
    { icon: (n&&n.collapsed)?'▸':'▾', label:(n&&n.collapsed)?'Expand':'Collapse', onClick:()=>toggleCollapse(id) },
    { icon: (n&&n.locked)?'🔓':'🔒', label:(n&&n.locked)?'Unlock position':'Lock position', onClick:()=>toggleSceneLock(id) },
    { icon:'▸', label:'Set as this layer\'s start scene', onClick:()=>setAsStartScene(id) },
    { icon:'🖼', label:'Canvas layout for this scene…', onClick:()=>openCanvasEditor(id) },
    ...(inGroup?[{ icon:'⤴', label:'Remove from group', onClick:()=>{ pushUndo(); const g=n.group; n.group=null; refitGroup(g); renderAll(); } }]:[]),
    { sep:true },
    // #72: stacking order among overlapping scene boxes; group boxes stay
    // behind every scene regardless (a fixed lower z-index), so they get no
    // reorder controls of their own.
    { icon:'⬆', label:'Bring to front', onClick:()=>bringSceneToFront(id) },
    { icon:'△', label:'Bring forward', onClick:()=>bringSceneForward(id) },
    { icon:'▽', label:'Send backward', onClick:()=>sendSceneBackward(id) },
    { icon:'⬇', label:'Send to back', onClick:()=>sendSceneToBack(id) },
    { sep:true },
    { icon:'✕', label:'Delete scene', onClick:()=>confirmDeleteScene(id) },
  ];
}
function ctxGroupItems(id){
  const g=backdrops[id];
  return [
    { icon:'🎨', label:'Group options / colour…', onClick:()=>openGroupOptions(id) },
    { icon:'🖼', label:'Canvas layout for this group…', onClick:()=>openCanvasEditor(id) },
    { icon:(g&&g.collapsed)?'▸':'▾', label:(g&&g.collapsed)?'Expand group':'Collapse group', onClick:()=>toggleGroupCollapse(id) },
    { icon:'⤢', label:'Fit to members', onClick:()=>shrinkGroupToFit(id) },
    { sep:true },
    { icon:'✕', label:'Delete group (keep scenes)', onClick:()=>deleteBackdrop(id) },
  ];
}
function ctxCanvasItems(lx,ly){
  return [
    { icon:'＋', label:'New scene here', onClick:()=>addScene(lx,ly) },
    { icon:'▢', label:'New group here', onClick:()=>createBackdropAt(lx,ly) },
    { icon:'⧉', label:'Paste scene', disabled:!_sceneClipboard, onClick:()=>pasteSceneAt(lx,ly) },
    { sep:true },
    { icon:'📋', label:'Open scenes list', onClick:()=>{ if(typeof openScenesPanel==='function') openScenesPanel(); } },
    { icon:'👥', label:'Characters', onClick:()=>openCharacters() },
    { icon:'🎚', label:'Variables', onClick:()=>openVariables() },
  ];
}

/* ---- the single listener ------------------------------------------------ */
function initContextMenus(){
  const ws=document.getElementById('workspace'); if(!ws) return;
  ws.addEventListener('contextmenu', function(e){ _ctxLastEvent=e;
    // let inputs/textareas keep the native menu (copy/paste text)
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable) return;
    e.preventDefault();
    const node=e.target.closest('.node'); const group=e.target.closest('.backdrop-group');
    if(node && scenes[node.id]){ selectNode(node.id); showContextMenu(e.clientX,e.clientY, ctxSceneItems(node.id)); return; }
    if(group && backdrops[group.id]){ showContextMenu(e.clientX,e.clientY, ctxGroupItems(group.id)); return; }
    const c=getLogicalCoords(e); showContextMenu(e.clientX,e.clientY, ctxCanvasItems(Math.max(0,c.x-120),Math.max(0,c.y-40)));
  });
  window.addEventListener('scroll', _ctxHide, true);
  window.addEventListener('resize', _ctxHide);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') _ctxHide(); });
}
/* helper: create a group at a specific logical point */
function createBackdropAt(x,y){ pushUndo(); const id=genId('bd');
  backdrops[id]={id,x:Math.max(0,x),y:Math.max(0,y),w:360,h:240,color:GROUP_COLORS[Object.keys(backdrops).length%GROUP_COLORS.length],name:'Group'};
  renderBackdrops(); }
