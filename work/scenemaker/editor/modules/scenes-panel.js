/* ============================================================================
   Scenemaker editor; Scenes panel  (feature #7)
   A dockable list of every scene. Click to select & see details (group,
   characters, dialogue snippet); double-click or the ⤢ action warps the canvas
   to it with a border flash; manage (focus/duplicate/copy/delete) inline or via
   right-click. Shares core.js scope.
   ==========================================================================*/
let _scenesSel=null;
function openScenesPanel(){ if(typeof openDock==='function') openDock('scenes'); if(typeof maybeShowMini==='function') maybeShowMini('scenes'); }
function firstDialogue(n){
  const txt=(n.lines||[]).map(l=>(l.text||'').trim()).filter(Boolean).join(' ');
  return txt ? (txt.length>90?txt.slice(0,90)+'…':txt) : '(no dialogue yet)';
}
function renderScenesPanel(){
  const box=document.getElementById('scene-list'); if(!box) return;
  const list=Object.values(scenes);
  if(!list.length){ box.innerHTML='<div class="hint">No scenes yet. Press <b>+ scene</b>.</div>'; return; }
  box.innerHTML=list.map(n=>{
    const sel=_scenesSel===n.id;
    const start=project.settings.startScene===n.id;
    const grp=n.group&&backdrops[n.group]?backdrops[n.group].name:null;
    // this panel lists every scene project-wide, not just the current
    // layer's, so a scene from elsewhere needs its own layer named - both
    // as a heads-up that clicking it will switch layers, and so a same-
    // named scene on two layers doesn't read as one ambiguous entry.
    const onOtherLayer=(typeof sceneLayer==='function' && sceneLayer(n)!==currentLayerId);
    const layerTag=onOtherLayer?escHtml(typeof layerName==='function'?layerName(sceneLayer(n)):'other layer'):null;
    let detail='';
    if(sel){
      const cs=(typeof charsInScene==='function'?charsInScene(n):[]).map(c=>escHtml(c.name||'?')).join(', ')||'; ';
      detail=`<div class="scene-detail">
        ${layerTag?`<div><span class="sd-k">Layer:</span> ${layerTag}</div>`:''}
        <div><span class="sd-k">Group:</span> ${grp?escHtml(grp):'; '}</div>
        <div><span class="sd-k">Type:</span> ${n.mode==='cutscene'?'Cutscene':'Dialogue'}</div>
        <div><span class="sd-k">Characters:</span> ${cs}</div>
        <div><span class="sd-k">Opening:</span> <span class="sd-snip">${escHtml(firstDialogue(n))}</span></div>
        <div class="scene-acts">
          <button class="mini-btn" title="Warp to this scene" onclick="event.stopPropagation();warpToScene('${n.id}')">⤢ Warp</button>
          <button class="mini-btn" title="Focus / edit" onclick="event.stopPropagation();focusScene('${n.id}')">Edit</button>
          <button class="mini-btn" title="Duplicate" onclick="event.stopPropagation();duplicateScene('${n.id}');renderScenesPanel()">Duplicate</button>
          <button class="mini-btn" title="Copy" onclick="event.stopPropagation();copyScene('${n.id}')">Copy</button>
          <button class="mini-btn warn" title="Delete" onclick="event.stopPropagation();confirmDeleteScene('${n.id}');setTimeout(renderScenesPanel,0)">Delete</button>
        </div></div>`;
    }
    // #208: the same clickable "set as start scene" ▸ the stage's own scene
    // cards show (core.js's setAsStartScene()), reachable here too so this
    // dedicated list is a real substitute for hunting a scene down on a busy
    // stage first. The CURRENT start scene keeps a plain, non-clickable ▸
    // (nothing to do there); any other scene's ▸ sets it, whatever layer
    // that scene actually lives on (setAsStartScene resolves that itself).
    const startMark = start
      ? '<span title="This is the start scene">▸ </span>'
      : `<span class="scene-row-setstart" title="Set as this layer's start scene" onclick="event.stopPropagation();setAsStartScene('${n.id}');renderScenesPanel()">▹ </span>`;
    return `<div class="scene-row${sel?' sel':''}" onclick="selectSceneRow('${n.id}')" ondblclick="warpToScene('${n.id}')" oncontextmenu="event.preventDefault();event.stopPropagation();sceneRowMenu(event,'${n.id}')">
      <div class="scene-row-top"><span class="scene-row-title">${n.color?`<span class="scene-dot" style="background:${n.color}"></span>`:''}${startMark}${escHtml(n.title||'(untitled)')}</span>${layerTag?`<span class="scene-row-grp" title="On a different layer - clicking switches to it">${layerTag}</span>`:''}${grp?`<span class="scene-row-grp">${escHtml(grp)}</span>`:''}</div>
      ${detail}</div>`;
  }).join('');
}
function selectSceneRow(id){ _scenesSel=(_scenesSel===id?null:id); renderScenesPanel(); }
function sceneRowMenu(e,id){ _scenesSel=id; renderScenesPanel();
  if(typeof showContextMenu!=='function') return;
  showContextMenu(e.clientX,e.clientY,[
    { icon:'⤢', label:'Warp to scene', onClick:()=>warpToScene(id) },
    { icon:'✎', label:'Focus / edit', onClick:()=>focusScene(id) },
    { icon:'⧉', label:'Duplicate', onClick:()=>{ duplicateScene(id); renderScenesPanel(); } },
    { icon:'⧉', label:'Copy', onClick:()=>copyScene(id) },
    { sep:true },
    { icon:'✕', label:'Delete scene', onClick:()=>{ confirmDeleteScene(id); setTimeout(renderScenesPanel,0); } },
  ]);
}
/* warp: center the canvas on the scene and flash its border. The Scenes
   panel lists every scene project-wide, not just the current layer's, so a
   scene warped to may live on a DIFFERENT layer than the one on screen -
   switch to it first, or the canvas has nothing to scroll to/flash (only
   the current layer's scenes are ever actually in the DOM). */
function warpToScene(id){
  const n=scenes[id]; if(!n) return;
  if(typeof sceneLayer==='function' && typeof switchLayer==='function' && sceneLayer(n)!==currentLayerId) switchLayer(sceneLayer(n));
  if(n.group && backdrops[n.group] && backdrops[n.group].collapsed){ toggleGroupCollapse(n.group); }
  const ws=document.getElementById('workspace'); if(ws){
    ws.scrollLeft = Math.max(0, n.x*zoomLevel - ws.clientWidth/2 + 210);
    ws.scrollTop  = Math.max(0, n.y*zoomLevel - ws.clientHeight/2 + 120);
  }
  selectNode(id);
  const el=document.getElementById(id); if(!el) return;
  el.classList.remove('scene-flash'); void el.offsetWidth; el.classList.add('scene-flash');
  setTimeout(()=>{ if(el) el.classList.remove('scene-flash'); }, 1400);
}
