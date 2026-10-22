/* ============================================================================
   Scenemaker editor; Layers
   Part of the modular editor. Classic script sharing global scope with core.js.
   ----------------------------------------------------------------------------
   A "layer" is a second full canvas grid inside the same project, so a big
   branching story doesn't have to live on one crowded sheet. Concretely a
   layer is just a tag: every scene/backdrop optionally carries a `layer` id
   (default 'main' when absent, so every project that predates this feature,
   and every scene created before you ever open the layer picker, keeps
   working exactly as before with zero migration). `project.scenes` and
   `project.backdrops` stay the single flat maps they always were - nothing
   about undo/redo, SCORM export, the player runtime, or normal same-layer
   choice wiring needed to change. Only two things are layer-aware:
     1. What gets drawn on the canvas right now (visibleScenes/visibleBackdrops,
        wired into renderScenes()/renderBackdrops()/SceneConnections).
     2. "Layer portals": a choice can carry a c.portal={layer,scene} pointing
        at another layer (optionally a specific scene there, else that layer's
        start scene). This is purely editor metadata for the chip/navigation UI
        below; the moment it's set, the choice's *real* outcome target
        (outcomes[0].targetNode) is kept in sync to the resolved scene id, so
        the exported player and SCORM package see an ordinary same-map scene
        link and need no awareness of layers at all.
   `project.layers` itself is created lazily (only once a second layer is
   actually added), so a project that never touches this feature never gains
   the key. Until then, allLayers() synthesizes a single implicit "Main".
   ==========================================================================*/
let currentLayerId = 'main';

function ensureLayersArray(){ if(!project.layers) project.layers=[]; return project.layers; }
function allLayers(){ const L=project.layers; return (L&&L.length) ? L : [{id:'main',name:'Main'}]; }
function layerById(id){ return allLayers().find(l=>l.id===id) || allLayers()[0]; }
function layerName(id){ return (layerById(id)||{}).name || 'Main'; }
function sceneLayer(s){ return (s && s.layer) || 'main'; }
function backdropLayer(b){ return (b && b.layer) || 'main'; }

/* #78: whichever layer is PRIMARY owns project.settings.startScene, the one
   field the exported player actually reads (player/runtime.js has no idea
   layers exist; it just starts at settings.startScene and walks the flat
   scene map from there). Every other layer keeps its own startScene field,
   same as before. Undefined primaryLayer defaults to 'main', so an untouched
   project behaves exactly as it always did - zero migration needed. */
function primaryLayerId(){ return (project.settings && project.settings.primaryLayer) || 'main'; }
function layerStartScene(id){
  if(id===primaryLayerId()) return project.settings.startScene||null;
  const l=layerById(id); return l?(l.startScene||null):null;
}
function setLayerStartScene(id, sceneId){
  if(id===primaryLayerId()){ project.settings.startScene=sceneId; }
  else { const l=layerById(id); if(l) l.startScene=sceneId; }
}
/* switching which layer is primary hands project.settings.startScene (the
   field that actually matters at play time) to the new primary's own
   start scene, while the old primary's start scene is preserved by moving
   INTO its own startScene field (materializing it into project.layers
   first if it's 'main', which otherwise has no entry there of its own) -
   so nothing is lost switching back and forth. */
function setPrimaryLayer(id){
  const old=primaryLayerId(); if(id===old) return;
  ensureLayersArray();
  if(!project.layers.find(l=>l.id==='main')) project.layers.unshift({id:'main',name:'Main',startScene:null});
  if(!layerById(id)) return; // unknown layer id, nothing to switch to
  pushUndo();
  const oldEntry=layerById(old); if(oldEntry) oldEntry.startScene=project.settings.startScene||null;
  project.settings.startScene=layerById(id).startScene||null;
  project.settings.primaryLayer=id;
  renderScenes();
  if(typeof renderLayerEditor==='function') renderLayerEditor();
}

function visibleScenes(){ const out={}; Object.keys(scenes).forEach(id=>{ if(sceneLayer(scenes[id])===currentLayerId) out[id]=scenes[id]; }); return out; }
function visibleBackdrops(){ const out={}; Object.keys(backdrops).forEach(id=>{ if(backdropLayer(backdrops[id])===currentLayerId) out[id]=backdrops[id]; }); return out; }

function layerCounts(id){
  let sc=0, ch=0, ln=0;
  Object.values(scenes).forEach(s=>{ if(sceneLayer(s)!==id) return; sc++; ch+=(s.choices||[]).length; ln+=(s.lines||[]).length; });
  return {scenes:sc, choices:ch, lines:ln};
}
/* same shape as layerCounts(), but across every layer - the "whole project"
   side of the bottom bar's optional N/total fraction display */
function projectCounts(){
  let sc=0, ch=0, ln=0;
  Object.values(scenes).forEach(s=>{ sc++; ch+=(s.choices||[]).length; ln+=(s.lines||[]).length; });
  return {scenes:sc, choices:ch, lines:ln};
}
function layerEndpoints(id){
  return Object.values(scenes).filter(s=> sceneLayer(s)===id &&
    (!s.choices || !s.choices.length || s.choices.every(c=> typeof choiceGoesNowhere==='function' ? choiceGoesNowhere(c) : true)));
}
/* every choice project-wide that carries a layer-portal link */
function allPortalChoices(){
  const out=[];
  Object.values(scenes).forEach(s=>{ (s.choices||[]).forEach(c=>{ if(c.portal && c.portal.layer) out.push({scene:s, choice:c}); }); });
  return out;
}
function layerPortalsOut(id, precomputed){ return (precomputed||allPortalChoices()).filter(p=>sceneLayer(p.scene)===id); }
/* portals from ANY layer that resolve to this exact scene (explicit override,
   or implicit because this scene is that layer's start scene). Pass the
   result of one allPortalChoices() call as `precomputed` when checking many
   scenes in a row (e.g. every node in renderScenes()) so the whole-project
   scan happens once per render, not once per scene rendered. */
function incomingPortalsForScene(n, precomputed){
  const list = precomputed || allPortalChoices();
  const myLayer=sceneLayer(n);
  return list.filter(p=>{
    if(p.choice.portal.layer!==myLayer) return false;
    const resolved = p.choice.portal.scene || layerStartScene(myLayer);
    return resolved===n.id;
  });
}
/* keep every portal choice's real outcome target in sync with its layer's
   CURRENT start scene - needed because a portal left on "(that layer's start
   scene)" must track a start scene that can be set well after the portal
   itself was created (e.g. the target layer was empty at the time). Call
   before anything reads outcomes (rendering, export, save). */
function syncAllPortals(){
  Object.values(scenes).forEach(s=>{ (s.choices||[]).forEach(c=>{ if(c.portal && c.portal.layer) syncPortalOutcome(c); }); });
}
function resolvePortalTarget(c){ if(!c||!c.portal||!c.portal.layer) return null; return c.portal.scene || layerStartScene(c.portal.layer); }
/* keep the choice's real, plain scene-id outcome target in sync with its
   portal config, so runtime/export need zero knowledge of layers */
function syncPortalOutcome(c){
  const t=resolvePortalTarget(c);
  if(!c.outcomes || !c.outcomes.length) c.outcomes=[{id:genId('o'),type:'default',targetNode:null}];
  c.outcomes[0].targetNode = t || null;
}

/* ---- switching layers ---------------------------------------------------- */
function switchLayer(id){
  currentLayerId = layerById(id) ? id : 'main';
  selectedNode = null;
  if(typeof renderAll==='function') renderAll(); else { renderScenes(); if(typeof renderBackdrops==='function') renderBackdrops(); }
}
function switchLayerFromSelect(id){ switchLayer(id); }
function addLayer(){
  const name=(prompt('Name this layer:','Layer '+(allLayers().length+1))||'').trim();
  if(!name) return;
  ensureLayersArray();
  if(!project.layers.find(l=>l.id==='main')) project.layers.unshift({id:'main',name:'Main'});
  const id=genId('layer');
  project.layers.push({id, name, startScene:null});
  switchLayer(id);
  toast('New layer "'+name+'" added; add a scene here to set its start point');
}

/* ---- layer editor: reorder + rename -------------------------------------
   A small modal for renaming layers in place and reordering them (the order
   here is the order they appear in the layer-picker dropdown). Rendered as a
   tilted, receding "stack of cards" purely as a visual flourish - it's still
   just a plain list underneath, reordered with the arrow buttons rather than
   real drag physics. */
function openLayerEditor(){
  ensureLayersArray();
  let bg=document.getElementById('layer-editor-modal');
  if(!bg){
    bg=document.createElement('div'); bg.id='layer-editor-modal'; bg.className='modal-bg hidden';
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('layer-editor-modal', 'Layers') : '';
    bg.innerHTML='<div class="modal-card"><h2>Layers'+detachIco+'</h2><div class="modal-body" id="layer-editor-body"></div>'+
      '<div class="modal-foot"><button class="mini-btn" onclick="addLayer();renderLayerEditor()" title="Add a new, empty layer">+ new layer</button>'+
      '<button class="tb-btn tb-slate" onclick="closeModal(\'layer-editor-modal\')">Close</button></div></div>';
    document.body.appendChild(bg);
  }
  renderLayerEditor();
  bg.classList.remove('hidden');
  if(typeof maybeShowMini==='function') maybeShowMini('layers');
}
// depth 0 = nearest/front card; shared by the full rebuild below AND
// animateLayerReorder() so a move can glide existing cards to their new
// spot in the SAME tilted 3D space, instead of only ever looking 3D while
// sitting still. #79
function layerCardTransform(idx,total){
  const depth=total-1-idx;
  return { transform:`translateZ(${-depth*24}px) translateY(${depth*7}px) translateX(${depth*14}px) rotateX(2deg)`, zIndex:total-depth, filter:`brightness(${Math.max(.55,1-depth*0.09)})` };
}
function renderLayerEditor(){
  const body=document.getElementById('layer-editor-body'); if(!body) return;
  const layers=allLayers();
  const primary=primaryLayerId();
  body.innerHTML = `<div class="hint" style="margin-bottom:10px">Rename a layer right here, drag a card (or use the arrows) to reorder it - that order is what you see in the layer picker on the bottom bar. The <b>★ primary</b> layer's own start scene is the story's actual entry point when played or exported; every other layer's start scene only matters for jumping straight to it (a layer portal, or opening it and pressing play).</div>
    <div class="layer-3d-stack">${layers.map((l,idx)=>{
      const t=layerCardTransform(idx,layers.length);
      const c=layerCounts(l.id);
      const isPrimary=l.id===primary;
      return `<div class="layer-3d-card${l.id===currentLayerId?' current':''}" data-lid="${l.id}" draggable="true" ondragstart="layerDragStart(event,'${l.id}')" ondragover="layerDragOver(event)" ondrop="layerDrop(event,'${l.id}')" ondragend="layerDragEnd(event)" style="transform:${t.transform};z-index:${t.zIndex};filter:${t.filter}">
        <div class="layer-3d-row">
          <span class="layer-3d-order" title="Drag this card to reorder, or use the arrows">${idx+1}</span>
          <input class="layer-3d-name" value="${escAttr(l.name)}" oninput="renameLayer('${l.id}',this.value)" onblur="renderLayerBar()" title="Rename this layer">
          <span class="layer-3d-meta">${c.scenes} sc · ${c.choices} ch · ${c.lines} ln</span>
          <button class="mini-btn layer-3d-up" onclick="moveLayer('${l.id}',-1)" title="Move earlier in the picker" ${idx===0?'disabled':''}>▲</button>
          <button class="mini-btn layer-3d-down" onclick="moveLayer('${l.id}',1)" title="Move later in the picker" ${idx===layers.length-1?'disabled':''}>▼</button>
          ${isPrimary?'<span class="layer-3d-primary-tag" title="This layer\'s start scene is the story\'s actual entry point">★ primary</span>':`<button class="mini-btn layer-3d-primary-btn" onclick="setPrimaryLayer('${l.id}')" title="Make this the primary layer; its start scene becomes the story's actual entry point">☆ make primary</button>`}
          <button class="mini-btn" onclick="openBulkRename('${l.id}')" title="Add a prefix and/or suffix to every scene title and group name on this layer">✎ bulk rename</button>
          <button class="mini-btn" onclick="exportLayerAsProject('${l.id}')" title="Export this layer as its own standalone .vnproj, e.g. to move it into another project">⬇ export</button>
          <button class="mini-btn warn" onclick="deleteLayer('${l.id}')" title="Delete this layer and everything on it" ${layers.length<=1?'disabled':''}>🗑 delete</button>
          ${l.id===currentLayerId?'<span class="layer-3d-current-tag">viewing</span>':`<button class="mini-btn" onclick="switchLayer('${l.id}');renderLayerEditor()" title="Switch to viewing this layer">view</button>`}
        </div>
      </div>`;
    }).join('')}</div>`;
}
/* #97: prefix/suffix every scene title and group name on one layer at once
   (e.g. "Bob" -> "exBob" or "BobEX") - scoped to scenes/groups specifically
   because those are the only per-layer-taggable things (sceneLayer()/
   backdropLayer()); characters and variables are project-wide, not "on" any
   one layer, so they're out of scope here. */
let _bulkRenameLayerId=null;
function openBulkRename(layerId){
  const l=layerById(layerId); if(!l) return;
  let bg=document.getElementById('bulk-rename-modal');
  if(!bg){
    bg=document.createElement('div'); bg.id='bulk-rename-modal'; bg.className='modal-bg hidden';
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('bulk-rename-modal', 'Bulk rename') : '';
    bg.innerHTML='<div class="modal-card" style="max-width:380px"><h2>Bulk rename'+detachIco+'</h2><div class="modal-body" id="bulk-rename-body"></div>'+
      '<div class="modal-foot" style="display:flex;gap:8px;justify-content:flex-end">'+
      '<button class="tb-btn" onclick="closeModal(\'bulk-rename-modal\')">Cancel</button>'+
      '<button class="tb-btn tb-accent" style="background:var(--accent);color:#fff;border:none" onclick="applyBulkRename()">Rename</button>'+
      '</div></div>';
    document.body.appendChild(bg);
  }
  _bulkRenameLayerId=layerId;
  const scenesN=Object.values(scenes).filter(s=>sceneLayer(s)===layerId).length;
  const groupsN=Object.values(backdrops).filter(b=>backdropLayer(b)===layerId).length;
  document.getElementById('bulk-rename-body').innerHTML=`
    <div class="hint" style="margin-bottom:8px">Adds a prefix and/or suffix to every scene title and group name on <b>${escHtml(l.name)}</b> (${scenesN} scene${scenesN===1?'':'s'}, ${groupsN} group${groupsN===1?'':'s'}). Leave either blank to skip it.</div>
    <div class="fld"><label>Prefix</label><input type="text" id="bulk-rename-prefix" placeholder="e.g. ex"></div>
    <div class="fld"><label>Suffix</label><input type="text" id="bulk-rename-suffix" placeholder="e.g. EX"></div>`;
  bg.classList.remove('hidden');
  setTimeout(()=>{ const f=document.getElementById('bulk-rename-prefix'); if(f) f.focus(); },0);
}
function applyBulkRename(){
  const layerId=_bulkRenameLayerId; if(!layerId) return;
  const pre=(document.getElementById('bulk-rename-prefix')||{}).value||'';
  const suf=(document.getElementById('bulk-rename-suffix')||{}).value||'';
  if(!pre && !suf){ toast('Enter a prefix or suffix first'); return; }
  pushUndo();
  let n=0;
  Object.values(scenes).forEach(s=>{ if(sceneLayer(s)===layerId){ s.title=pre+(s.title||'')+suf; n++; } });
  Object.values(backdrops).forEach(b=>{ if(backdropLayer(b)===layerId){ b.name=pre+(b.name||'')+suf; n++; } });
  closeModal('bulk-rename-modal');
  renderAll();
  toast('Renamed '+n+' item'+(n===1?'':'s'));
}
// #79: moves used to call a full renderLayerEditor() rebuild, which replaces
// every card with a brand-new DOM node at its final position - the .layer-
//3d-card CSS transition (transform/filter) had nothing to animate FROM, so
// the "3D" stack only ever looked three-dimensional sitting still, never
// while actually reordering.
//
// A move needs to change TWO things that both read as "position" here: the
// card's real position in the vertical flex flow (.layer-3d-stack), and its
// per-depth 3D tilt/offset (translateZ/Y/X, the "receding stack" look). Only
// updating the transform in place (an earlier version of this) left the
// flex flow order untouched, so a card's visible ROW never actually moved -
// only its order badge and depth cue did, which reads as broken, not
// animated. Reordering the real DOM nodes (appendChild moves rather than
// clones, so identity/focus/in-progress transitions survive) fixes the flow
// position but on its own would jump instantly, since layout position isn't
// itself a transitionable property. FLIP (First-Last-Invert-Play) bridges
// that: measure each card's screen position before reordering, reorder,
// then for any card whose position changed, immediately (transition
// disabled) nudge it back to where it visually WAS with an extra translateY,
// force a reflow, then release the nudge with the transition back on - so it
// animates smoothly from its old row to its new one instead of teleporting.
function animateLayerReorder(){
  const body=document.getElementById('layer-editor-body'); if(!body) return;
  const stack=body.querySelector('.layer-3d-stack'); if(!stack) return;
  const layers=allLayers();
  const cardOf=(id)=>stack.querySelector(`.layer-3d-card[data-lid="${id}"]`);
  const before={};
  layers.forEach(l=>{ const c=cardOf(l.id); if(c) before[l.id]=c.getBoundingClientRect().top; });
  layers.forEach(l=>{ const c=cardOf(l.id); if(c) stack.appendChild(c); }); // reorders in place, same nodes
  layers.forEach((l,idx)=>{
    const card=cardOf(l.id); if(!card) return;
    const t=layerCardTransform(idx,layers.length);
    const orderEl=card.querySelector('.layer-3d-order'); if(orderEl) orderEl.textContent=idx+1;
    const up=card.querySelector('.layer-3d-up'); if(up) up.disabled=(idx===0);
    const down=card.querySelector('.layer-3d-down'); if(down) down.disabled=(idx===layers.length-1);
    const wasTop=before[l.id];
    const nowTop=card.getBoundingClientRect().top;
    const delta=(wasTop!=null) ? (wasTop-nowTop) : 0;
    if(delta){
      card.style.transition='none';
      card.style.transform=t.transform+` translateY(${delta}px)`;
      card.style.zIndex=t.zIndex; card.style.filter=t.filter;
      card.getBoundingClientRect(); // force layout so the un-transitioned "snap back" above applies before the transition is restored
      requestAnimationFrame(()=>{ card.style.transition=''; card.style.transform=t.transform; });
    } else {
      card.style.transform=t.transform; card.style.zIndex=t.zIndex; card.style.filter=t.filter;
    }
  });
}
/* rename works even before project.layers exists yet (a project that's
   never had a second layer added has no persisted array at all - allLayers()
   just synthesizes an implicit "Main" each call) by materializing a real
   'main' entry the first time it's actually edited. */
function renameLayer(id, name){
  name=(name||'').trim(); if(!name) return;
  ensureLayersArray();
  if(!project.layers.find(l=>l.id==='main')) project.layers.unshift({id:'main', name:'Main'});
  const l=project.layers.find(x=>x.id===id);
  if(l){ l.name=name;
    // #88: a layer's name is what the Layers list and the layer-switcher
    // dropdown are told apart by (portal/warp targets are still by id) -
    // flagged the same non-blocking way as the other duplicate-name checks.
    const dupe=project.layers.find(x=>x.id!==id && x.name===name);
    if(dupe && typeof toast==='function') toast(`Another layer is already named "${name}"`); }
}
function moveLayer(id, delta){
  ensureLayersArray();
  if(!project.layers.find(l=>l.id==='main')) project.layers.unshift({id:'main', name:'Main'});
  const idx=project.layers.findIndex(x=>x.id===id); if(idx<0) return;
  const newIdx=idx+delta; if(newIdx<0 || newIdx>=project.layers.length) return;
  const tmp=project.layers[idx]; project.layers[idx]=project.layers[newIdx]; project.layers[newIdx]=tmp;
  renderLayerBar();
  animateLayerReorder();
}
// #13: drag-and-drop reordering of the layer cards, on top of the existing
// ▲/▼ buttons above (both write the same project.layers array and replay
// through the same FLIP-animated re-render, so either method looks and
// behaves identically).
let _layerDragId=null;
function layerDragStart(e,id){
  _layerDragId=id;
  if(e.dataTransfer){ e.dataTransfer.effectAllowed='move'; try{ e.dataTransfer.setData('text/plain', id); }catch(err){} }
  const card=e.currentTarget; if(card) card.classList.add('layer-3d-dragging');
}
function layerDragOver(e){ e.preventDefault(); if(e.dataTransfer) e.dataTransfer.dropEffect='move'; }
function layerDrop(e,targetId){
  e.preventDefault();
  const dragId=_layerDragId; _layerDragId=null;
  if(!dragId || dragId===targetId) return;
  ensureLayersArray();
  if(!project.layers.find(l=>l.id==='main')) project.layers.unshift({id:'main', name:'Main'});
  const arr=project.layers;
  const from=arr.findIndex(l=>l.id===dragId), to=arr.findIndex(l=>l.id===targetId);
  if(from<0 || to<0) return;
  const [moved]=arr.splice(from,1);
  arr.splice(to,0,moved);
  renderLayerBar();
  animateLayerReorder();
}
function layerDragEnd(e){
  _layerDragId=null;
  document.querySelectorAll('.layer-3d-dragging').forEach(el=>el.classList.remove('layer-3d-dragging'));
}
// #12: permanently removes a layer AND everything tagged to it - a layer's
// scenes/groups only exist there, there's nowhere else for them to "move"
// to, so this is destructive and gated behind a themed confirm naming
// exactly how much is about to go, same pattern as confirmDeleteScene.
function deleteLayer(id){
  ensureLayersArray();
  if(!project.layers.find(l=>l.id==='main')) project.layers.unshift({id:'main', name:'Main'});
  if(allLayers().length<=1){ toast("Can't delete the only layer"); return; }
  const l=layerById(id); if(!l) return;
  const c=layerCounts(id);
  const msg=`Delete layer "${escHtml(l.name)}"? This permanently removes its ${c.scenes} scene${c.scenes===1?'':'s'} and ${c.choices} choice${c.choices===1?'':'s'} with it. This can't be undone once you save.`;
  uiConfirm(msg, ()=>_doDeleteLayer(id), { yes:'Delete layer', no:'Cancel' });
}
function _doDeleteLayer(id){
  pushUndo();
  // any OTHER layer's portal choices pointed AT this one are about to lose
  // their destination - clear them explicitly rather than let them silently
  // resolve to whatever layer happens to be first afterward.
  Object.values(scenes).forEach(s=>{
    if(sceneLayer(s)===id) return;
    (s.choices||[]).forEach(c=>{
      if(c.portal && c.portal.layer===id){ c.portal=null; (c.outcomes||[]).forEach(o=>{ o.targetNode=null; }); }
    });
  });
  Object.keys(scenes).forEach(sid=>{ if(sceneLayer(scenes[sid])===id) delete scenes[sid]; });
  Object.keys(backdrops).forEach(bid=>{ if(backdropLayer(backdrops[bid])===id) delete backdrops[bid]; });
  project.layers = project.layers.filter(l=>l.id!==id);
  if(!project.layers.length) project.layers.push({id:'main', name:'Main'});
  if(primaryLayerId()===id){
    const next=project.layers[0];
    project.settings.primaryLayer=next.id;
    project.settings.startScene=next.startScene||null;
  }
  if(currentLayerId===id) switchLayer(project.layers[0].id); else renderAll();
  if(typeof renderLayerEditor==='function') renderLayerEditor();
  renderLayerBar();
  toast('Layer deleted');
}
// #14: builds a brand-new, standalone project containing only ONE layer's
// content (re-tagged to that new project's implicit "main" layer, since a
// fresh single-layer project has no other layers to distinguish it from),
// so a layer can be handed to someone else or reimported elsewhere via the
// normal importProjectAsLayer()/doOpen() flow - "migrating" a layer out.
// Builds an entirely separate object rather than touching the live project/
// scenes/backdrops at all; only characters/variables/media this layer
// actually references come along, so nothing unused bloats the export.
function exportLayerAsProject(layerId){
  const l=layerById(layerId); if(!l) return;
  const layerScenes=Object.values(scenes).filter(s=>sceneLayer(s)===layerId);
  if(!layerScenes.length){ toast('This layer has no scenes to export'); return; }
  const layerSceneIds=new Set(layerScenes.map(s=>s.id));
  const out=blankProject();
  out.meta=JSON.parse(JSON.stringify(project.meta||out.meta));
  out.meta.title=(project.meta&&project.meta.title?project.meta.title+' - ':'')+l.name;
  out.settings=JSON.parse(JSON.stringify(project.settings||out.settings));
  delete out.settings.primaryLayer; // a single-layer project has no such concept
  out.title=JSON.parse(JSON.stringify(project.title||out.title));
  out.creditsScreen=JSON.parse(JSON.stringify(project.creditsScreen||out.creditsScreen));
  out.keyphrases=JSON.parse(JSON.stringify(project.keyphrases||[]));
  out.credits=JSON.parse(JSON.stringify(project.credits||[]));

  const usedCharIds=new Set(), usedVarIds=new Set(), usedMediaKeys=new Set();
  const noteMedia=v=>{ if(v) usedMediaKeys.add(v); };
  noteMedia(out.title.bg&&out.title.bg.media); noteMedia(out.title.music&&out.title.music.media);
  noteMedia(out.creditsScreen.bg&&out.creditsScreen.bg.media); noteMedia(out.creditsScreen.music&&out.creditsScreen.music.media);
  if(project.meta && project.meta.icon){ out.meta.icon=project.meta.icon; noteMedia(project.meta.icon); }

  out.scenes={};
  layerScenes.forEach(s=>{
    const clone=JSON.parse(JSON.stringify(s));
    delete clone.layer; // this becomes the new project's only (main) layer
    (clone.cast||[]).forEach(c=>{ if(c.charId) usedCharIds.add(c.charId); });
    (clone.lines||[]).forEach(ln=>{
      noteMedia(ln.portrait&&ln.portrait.media); noteMedia(ln.doc&&ln.doc.media);
      (ln.sfx||[]).forEach(x=>noteMedia(x.media));
    });
    noteMedia(clone.bg&&clone.bg.media); noteMedia(clone.music&&clone.music.media);
    if(clone.viewer) noteMedia(clone.viewer.media);
    (clone.choices||[]).forEach(c=>{
      (c.effects||[]).forEach(e=>{ if(e.var) usedVarIds.add(e.var); });
      if(c.condition && c.condition.var) usedVarIds.add(c.condition.var);
      if(c.dice && c.dice.modVar) usedVarIds.add(c.dice.modVar);
      (c.routes||[]).forEach(r=>{ if(r.var) usedVarIds.add(r.var); });
      // a layer portal, or an outcome pointing at another layer entirely,
      // has nothing to resolve to in a single-layer export - strip it back
      // to an ordinary unset choice rather than export a dangling reference.
      if(c.portal) c.portal=null;
      (c.outcomes||[]).forEach(o=>{ if(o.targetNode && !layerSceneIds.has(o.targetNode)) o.targetNode=null; });
      (c.routes||[]).forEach(r=>{ if(r.target && !layerSceneIds.has(r.target)) r.target=''; });
    });
    out.scenes[clone.id]=clone;
  });

  out.backdrops={};
  Object.values(backdrops).filter(b=>backdropLayer(b)===layerId).forEach(b=>{
    const clone=JSON.parse(JSON.stringify(b));
    delete clone.layer;
    noteMedia(clone.bg&&clone.bg.media); noteMedia(clone.music&&clone.music.media);
    out.backdrops[clone.id]=clone;
  });

  out.characters=(project.characters||[]).filter(c=>usedCharIds.has(c.id)).map(c=>{
    const clone=JSON.parse(JSON.stringify(c)); noteMedia(clone.media); return clone;
  });
  out.variables=(project.variables||[]).filter(v=>usedVarIds.has(v.id)).map(v=>JSON.parse(JSON.stringify(v)));

  out.media={}; out.mediaMeta={};
  Object.keys(project.media||{}).forEach(k=>{
    if(!usedMediaKeys.has(k)) return;
    out.media[k]=project.media[k];
    if(project.mediaMeta && project.mediaMeta[k]) out.mediaMeta[k]=project.mediaMeta[k];
  });

  out.settings.startScene = layerStartScene(layerId);
  if(!out.settings.startScene || !out.scenes[out.settings.startScene]) out.settings.startScene=layerScenes[0].id;

  // Deliberately always a plain download, even in the native app: reusing
  // save_project_as() (the native "Save As" bridge call) would also rebind
  // this window's *connected file* to the exported layer's path, so a
  // later plain Save on the real project would silently start writing to
  // the layer export instead - a much worse failure than just landing in
  // Downloads.
  const json=JSON.stringify(out);
  const filename=(l.name||'layer').replace(/[\\/:*?"<>|]/g,'_')+'.vnproj';
  downloadBlob(new Blob([json],{type:'application/octet-stream'}), filename);
  toast('Exported layer "'+l.name+'" as its own project');
}
/* jump to a scene, switching layers first if it lives in a different one */
function warpAcrossLayers(sceneId){
  const s=scenes[sceneId]; if(!s) return;
  const targetLayer=sceneLayer(s);
  if(targetLayer!==currentLayerId) switchLayer(targetLayer);
  if(typeof warpToScene==='function') warpToScene(sceneId);
}
function jumpPortal(sourceSceneId, choiceId){
  const s=scenes[sourceSceneId]; if(!s) return;
  const c=(s.choices||[]).find(x=>x.id===choiceId); if(!c || !c.portal) return;
  const resolved=resolvePortalTarget(c);
  if(!resolved){ toast('That layer has no start scene set yet; add a scene there first'); return; }
  warpAcrossLayers(resolved);
}

/* ---- per-choice portal editing (Logic modal) ----------------------------- */
function togglePortal(on){
  const c=curChoice(); if(!c) return; pushUndo();
  if(on){ const other=allLayers().find(l=>l.id!==currentLayerId) || allLayers()[0]; c.portal={layer:other.id, scene:null}; syncPortalOutcome(c); }
  else { c.portal=null; }
  renderLogic(); renderScenes();
}
function setPortal(field, value){
  const c=curChoice(); if(!c || !c.portal) return; pushUndo();
  if(field==='layer'){ c.portal.layer=value; c.portal.scene=null; }
  else if(field==='scene'){ c.portal.scene=value||null; }
  syncPortalOutcome(c);
  renderLogic(); renderScenes();
}
function layerOptionsHtml(selectedId){
  return allLayers().map(l=>`<option value="${l.id}" ${l.id===selectedId?'selected':''}>${escHtml(l.name)}</option>`).join('');
}
function sceneOptionsForLayer(layerId, selectedId){
  return Object.values(scenes).filter(s=>sceneLayer(s)===layerId)
    .map(s=>`<option value="${s.id}" ${s.id===selectedId?'selected':''}>${escHtml(s.title||'Scene')}</option>`).join('');
}
/* small inline marker next to a portal choice's own label - sits in normal
   document flow inside the choice row, so it never overlaps the row's ports/
   gear/delete controls. Icon only (no repeated layer-name pill) since the
   real edge tab (choicePortalTabHtml below) already names the destination
   layer, growing directly out of this same row's own right edge; showing
   both spelled out would be redundant clutter. */
function portalBadgeHtml(c){
  const resolved = resolvePortalTarget(c);
  const destScn = resolved ? scenes[resolved] : null;
  const layerLbl = layerName(c.portal.layer);
  const destLabel = destScn ? (destScn.title||'scene') : (resolved ? 'scene' : 'no start scene set yet');
  return `<span class="portal-icon" title="Layer portal → ${escAttr(layerLbl+' / '+destLabel)}; double-click to jump there"${resolved?` ondblclick="warpAcrossLayers('${resolved}')"`:''}>⇢</span>`;
}
/* the outgoing portal's own edge tab: rendered as a DIRECT CHILD of the one
   .choice-row that actually carries the portal (see choicesBlockHtml in
   core.js), not a separate stack anchored to the node's bottom corner - a
   fixed-position stack tracked nothing about where that specific choice's
   own row actually sat, so it always looked like an unrelated sticker
   parked near the corner instead of growing out of the row it belongs to.
   Positioned via CSS (.portal-tab-row: left:100%, vertically centered) so
   it touches the row with zero gap and reads as that row's own edge
   stretching into a tab, poking past the scene box's outer border the
   moment it clears the choices-container's padding - never a floating chip. */
function choicePortalTabHtml(n, c){
  const resolved = resolvePortalTarget(c);
  const destScn = resolved ? scenes[resolved] : null;
  const layerLbl = layerName(c.portal.layer);
  const destLabel = destScn ? (destScn.title||'scene') : (resolved ? 'scene' : 'no start scene set yet');
  return `<div class="portal-tab portal-tab-row" title="Layer portal → ${escAttr(layerLbl+' / '+destLabel)}; double-click to jump there"${resolved?` ondblclick="warpAcrossLayers('${resolved}')"`:''}>⇢ ${escHtml(layerLbl)}</div>`;
}
function portalSectionHtml(c){
  const on=!!(c.portal && c.portal.layer);
  const otherLayers=allLayers().filter(l=>l.id!==currentLayerId);
  if(!otherLayers.length && !on){
    return `<div class="sec"><h3>Layer portal; link to another layer</h3><div class="hint">Add another layer first (bottom-left of the workspace) to link a choice to it.</div></div>`;
  }
  return `<div class="sec"><h3>Layer portal; link to another layer</h3>
    <label class="chk"><input type="checkbox" ${on?'checked':''} onchange="togglePortal(this.checked)"> this choice leads to another layer</label>
    ${on?`<div class="line-top" style="margin-top:6px;flex-wrap:wrap">
      <select class="mini-sel" onchange="setPortal('layer',this.value)">${layerOptionsHtml(c.portal.layer)}</select>
      <select class="mini-sel" onchange="setPortal('scene',this.value)"><option value="">(that layer's start scene)</option>${sceneOptionsForLayer(c.portal.layer,c.portal.scene)}</select>
    </div><div class="hint">Wiring this choice's port on the stage is skipped for a portal; a small portal chip appears on the choice instead, double-click it to jump there.</div>`:''}
  </div>`;
}

/* ---- bottom status bar: layer selector + counts + endpoints/portals ------ */
function toggleSbDropdown(which){
  const id='sb-dd-'+which;
  document.querySelectorAll('.sb-dd-menu').forEach(el=>{ if(el.id!==id) el.classList.add('hidden'); });
  const el=document.getElementById(id); if(!el) return;
  const willShow=el.classList.contains('hidden');
  el.classList.toggle('hidden');
  if(willShow){
    // .sb-dd-menu is position:fixed (its .sb-dd parent sits inside #sb-left,
    // which clips overflow to keep the bottom bar from growing sideways -
    // that clipping used to swallow this dropdown too when it tried to poke
    // up above the bar via position:absolute). Fixed positioning escapes
    // that clip, so its screen position is computed here from the button
    // that opens it instead of relying on any ancestor's layout.
    const btn=el.previousElementSibling;
    if(btn){ const r=btn.getBoundingClientRect();
      el.style.left=r.left+'px';
      el.style.bottom=(window.innerHeight-r.top)+'px';
    }
  }
}
function closeSbDropdowns(){ document.querySelectorAll('.sb-dd-menu').forEach(el=>el.classList.add('hidden')); }
document.addEventListener('click', function(e){ if(!e.target.closest || !e.target.closest('.sb-dd')) closeSbDropdowns(); });

function renderLayerBar(precomputedPortals){
  const box=document.getElementById('sb-left'); if(!box) return;
  const layers=allLayers();
  const showScenes=(typeof ToolSettings==='undefined')||ToolSettings.get('sbShowScenes','1')==='1';
  const showChoices=(typeof ToolSettings==='undefined')||ToolSettings.get('sbShowChoices','1')==='1';
  const showLines=(typeof ToolSettings==='undefined')||ToolSettings.get('sbShowLines','1')==='1';
  const showEndpoints=(typeof ToolSettings==='undefined')||ToolSettings.get('sbShowEndpoints','1')==='1';
  const showPortals=(typeof ToolSettings==='undefined')||ToolSettings.get('sbShowPortals','1')==='1';
  const showFraction=(typeof ToolSettings!=='undefined') && ToolSettings.get('sbFraction','0')==='1';
  const showSize=(typeof ToolSettings==='undefined')||ToolSettings.get('sbShowSize','1')==='1';
  const counts=layerCounts(currentLayerId);
  const totals=showFraction?projectCounts():null;
  const fmt=(n,total)=>showFraction?(n+'/'+total):(''+n);
  const bits=[];
  // #9: "sc/ch/ln" read as genuinely ambiguous (lowercase "ln" even reads as
  // capital "In" in some fonts) and stayed that way after an earlier request
  // to fix it - spelling the words out (with real pluralization, matching
  // the endpoint/portal dropdowns below) costs little horizontal room and
  // needs no icon lookup, unlike the open "clearer icons" item.
  const plural=(n,word)=>word+(n===1?'':'s');
  if(showScenes) bits.push(fmt(counts.scenes,totals&&totals.scenes)+' '+plural(counts.scenes,'scene'));
  if(showChoices) bits.push(fmt(counts.choices,totals&&totals.choices)+' '+plural(counts.choices,'choice'));
  if(showLines) bits.push(fmt(counts.lines,totals&&totals.lines)+' '+plural(counts.lines,'line'));
  if(showSize && typeof contentBounds==='function'){ const b=contentBounds(); if(b) bits.push(Math.round(b.w)+' × '+Math.round(b.h)+'px'); }
  const eps=showEndpoints?layerEndpoints(currentLayerId):[];
  const ports=showPortals?layerPortalsOut(currentLayerId,precomputedPortals):[];
  box.innerHTML =
    `<span class="sb-layerpick" title="Switch which layer you're viewing/editing">`+
      `<select id="layer-select" onchange="switchLayerFromSelect(this.value)">${layers.map(l=>`<option value="${l.id}" ${l.id===currentLayerId?'selected':''}>${escHtml(l.name)}</option>`).join('')}</select>`+
      `<button class="mini-btn" onclick="addLayer()" title="Add a new, empty layer">+ layer</button>`+
      `<button class="mini-btn" onclick="importProjectAsLayer()" title="Import another Scenemaker project as a new layer, merging it into this one">⬆ import</button>`+
      `<button class="mini-btn" onclick="openLayerEditor()" title="Reorder or rename your layers">✎ layers</button>`+
    `</span>`+
    (bits.length?`<span class="sb-counts" title="Scenes / choices / lines / bounding-box size of the current layer">${bits.join(' · ')}</span>`:'')+
    (eps.length?`<span class="sb-dd"><button class="sb-dd-btn" onclick="toggleSbDropdown('endpoints')" title="Endings with no way out of them">▲ ${eps.length} endpoint${eps.length===1?'':'s'}</button>`+
      `<div class="sb-dd-menu hidden" id="sb-dd-endpoints">${eps.map(s=>`<div class="sb-dd-item" onclick="warpToScene('${s.id}');closeSbDropdowns()">${escHtml(s.title||'Scene')}</div>`).join('')}</div></span>`:'')+
    (ports.length?`<span class="sb-dd"><button class="sb-dd-btn" onclick="toggleSbDropdown('portals')" title="Choices in this layer that link to another layer">▲ ${ports.length} portal${ports.length===1?'':'s'}</button>`+
      `<div class="sb-dd-menu hidden" id="sb-dd-portals">${ports.map(p=>`<div class="sb-dd-item" onclick="jumpPortal('${p.scene.id}','${p.choice.id}');closeSbDropdowns()">${escHtml(p.scene.title||'Scene')} → ${escHtml(layerName(p.choice.portal.layer))}</div>`).join('')}</div></span>`:'');
  // keeps the bottom bar's own orthogonal-wiring/snap toggle buttons in
  // sync whenever this (frequently-called) render runs, e.g. after loading
  // a different project (its own useSmartRouting may differ) or after
  // either setting changed from elsewhere (Story Settings, the View menu).
  if(typeof refreshSbToolButtons==='function') refreshSbToolButtons();
}

/* ---- import another project as a new layer ------------------------------- */
async function importProjectAsLayer(){
  const name=(prompt('Name for the imported layer:', 'Imported Layer')||'').trim();
  if(!name) return;
  let imported=null;
  try{
    if(HAS_BRIDGE()){
      const r=await window.pywebview.api.open_project((typeof defaultPathFor==='function')?defaultPathFor('projects'):'');
      if(!r || !r.ok) return;
      imported=r.project;
    } else if(HAS_SERVER()){
      const inp=document.createElement('input'); inp.type='file'; inp.accept='.vnproj,.json,application/zip';
      const file=await new Promise(res=>{ inp.onchange=()=>res(inp.files[0]||null); inp.click(); });
      if(!file) return;
      const buf=await file.arrayBuffer();
      const res=await fetch('/api/open',{method:'POST',body:buf});
      const j=await res.json();
      if(!j.ok){ toast('Import failed: '+(j.error||'?')); return; }
      imported=j.project;
    } else {
      const inp=document.createElement('input'); inp.type='file'; inp.accept='.vnproj,.json';
      const file=await new Promise(res=>{ inp.onchange=()=>res(inp.files[0]||null); inp.click(); });
      if(!file) return;
      imported=JSON.parse(await file.text());
    }
  }catch(err){ toast('Import failed: '+err.message); return; }
  if(!imported || typeof imported!=='object'){ toast('That file did not look like a Scenemaker project'); return; }
  // #87: hand off to a modal ONLY when there's actually something ambiguous
  // to resolve - most imports have no name overlap at all, and shouldn't
  // gain an extra click for nothing.
  const conflicts = _importNameConflicts(imported);
  if(conflicts.chars.length || conflicts.vars.length){
    _confirmImportConflicts(conflicts,
      ()=>mergeProjectAsLayer(imported, name, true),
      ()=>mergeProjectAsLayer(imported, name, false));
    return;
  }
  mergeProjectAsLayer(imported, name, false);
}

/* #87: two DIFFERENT kinds of same-name overlap between this project and
   the one being imported, only one of which is actually a conflict -
   - a character sharing a name: always ambiguous (there's no reliable way
     to tell two authors' same-named characters are "the same" one), so
     every overlap is flagged.
   - a variable sharing a name AND type: this is the desired, INTENTIONAL
     merge mergeProjectAsLayer already does below (shared story state
     across layers) - not a conflict, left alone.
   - a variable sharing a name but a DIFFERENT type: a real conflict left
     unresolved, this would silently create two same-named variables of
     different types, and {{token}} substitution (runtime.js) resolves by
     name, so one of them would become permanently unreachable - same root
     issue #88 warns about for a same-named variable created by hand. */
function _importNameConflicts(imported){
  const chars=[...new Set((imported.characters||[])
    .filter(c=>project.characters.some(pc=>pc.name===c.name))
    .map(c=>c.name))];
  const vars=[...new Set((imported.variables||[])
    .filter(v=>project.variables.some(pv=>pv.name===v.name && pv.type!==v.type))
    .map(v=>v.name))];
  return { chars, vars };
}
function _confirmImportConflicts(conflicts, onRename, onKeep){
  const parts=[];
  if(conflicts.chars.length) parts.push(`Character${conflicts.chars.length>1?'s':''} named ${conflicts.chars.map(n=>`<b>${escHtml(n)}</b>`).join(', ')}`);
  if(conflicts.vars.length) parts.push(`Variable${conflicts.vars.length>1?'s':''} named ${conflicts.vars.map(n=>`<b>${escHtml(n)}</b>`).join(', ')} (a different type in each project)`);
  uiConfirm(`This project already has: ${parts.join('; ')}. Scenemaker can't tell whether the imported one is meant to be the same or a different one.<br><br>Rename the imported copies so nothing collides, or import them as-is and sort it out yourself afterward?`,
    onRename,
    { yes:'Rename the imported ones', no:'Import as-is', onNo:onKeep });
}
/* the next free "<name> (imported)" / "<name> (imported 2)" / ... variant
   not already in `used`. Doesn't add the result to `used` itself - each
   caller does that once it commits to the name, so a whole batch of
   renames never collides with each other, not just with what pre-existed. */
function _uniqueImportName(name, used){
  let n=name+' (imported)', i=2;
  while(used.has(n)){ n=name+' (imported '+i+')'; i++; }
  return n;
}
/* Merges an entire other project in as a new layer: media is deduped by
   content (byte-identical data URLs reuse the existing key), variables are
   deduped by name+type (so shared story state carries across layers),
   characters are always added as new entries (there's no reliable way to
   tell two authors' same-named characters are "the same" one), and every
   scene/backdrop id is regenerated to guarantee no collisions with the
   current project, with every internal cross-reference rewritten to match.
   #87: renameConflicts (from the conflict-resolution modal above, when
   there was anything to resolve) auto-renames the IMPORTED side of any
   genuine name conflict before any of that runs, so the merge below never
   has to actually think about it. */
function mergeProjectAsLayer(imported, name, renameConflicts){
  pushUndo();
  if(renameConflicts){
    const usedCharNames=new Set(project.characters.map(c=>c.name));
    (imported.characters||[]).forEach(c=>{
      if(usedCharNames.has(c.name)) c.name=_uniqueImportName(c.name, usedCharNames);
      usedCharNames.add(c.name);
    });
    const usedVarNames=new Set(project.variables.map(v=>v.name));
    (imported.variables||[]).forEach(v=>{
      const clash=project.variables.find(pv=>pv.name===v.name && pv.type!==v.type);
      if(clash) v.name=_uniqueImportName(v.name, usedVarNames);
      usedVarNames.add(v.name);
    });
  }
  ensureLayersArray();
  if(!project.layers.find(l=>l.id==='main')) project.layers.unshift({id:'main',name:'Main'});
  const newLayerId=genId('layer');

  function remapMediaRefsDeep(obj, mediaMap){
    if(!obj || typeof obj!=='object') return;
    ['media','mediaRaw'].forEach(k=>{ if(typeof obj[k]==='string' && mediaMap[obj[k]]!==undefined) obj[k]=mediaMap[obj[k]]; });
    Object.keys(obj).forEach(k=>{ const v=obj[k]; if(v && typeof v==='object') remapMediaRefsDeep(v, mediaMap); });
  }

  // 1) media: dedupe by content
  const mediaMap={};
  project.media = project.media || {};
  const existingByContent={};
  Object.keys(project.media).forEach(k=>{ existingByContent[project.media[k]]=k; });
  Object.keys(imported.media||{}).forEach(oldKey=>{
    const data=imported.media[oldKey];
    if(existingByContent[data]!==undefined){ mediaMap[oldKey]=existingByContent[data]; return; }
    let newKey=oldKey;
    if(project.media[newKey]!==undefined){
      const dot=oldKey.lastIndexOf('.'); const base=dot>=0?oldKey.slice(0,dot):oldKey; const ext=dot>=0?oldKey.slice(dot):'';
      let i=2; while(project.media[base+'-'+i+ext]!==undefined) i++;
      newKey=base+'-'+i+ext;
    }
    project.media[newKey]=data; existingByContent[data]=newKey; mediaMap[oldKey]=newKey;
    // #19: carry the imported asset's own "added/modified" stamps over if the
    // source project tracked them, otherwise stamp it as added now (it's new
    // to THIS project either way, even if it pre-dates the merge).
    if(!project.mediaMeta) project.mediaMeta={};
    const srcMeta=(imported.mediaMeta && imported.mediaMeta[oldKey]) || null;
    project.mediaMeta[newKey]={ addedAt:(srcMeta&&srcMeta.addedAt)||new Date().toISOString(), fileModified:(srcMeta&&srcMeta.fileModified)||null };
  });

  // 2) characters: always new, id-remapped
  const charMap={};
  project.characters = project.characters || [];
  (imported.characters||[]).forEach(ch=>{
    const clone=JSON.parse(JSON.stringify(ch));
    const newId=genId('char'); charMap[ch.id]=newId; clone.id=newId;
    remapMediaRefsDeep(clone, mediaMap);
    project.characters.push(clone);
  });

  // 3) variables: dedupe by name+type
  const varMap={};
  project.variables = project.variables || [];
  (imported.variables||[]).forEach(v=>{
    const existing=project.variables.find(pv=>pv.name===v.name && pv.type===v.type);
    if(existing){ varMap[v.id]=existing.id; return; }
    const clone=JSON.parse(JSON.stringify(v));
    const newId=genId('var'); varMap[v.id]=newId; clone.id=newId;
    project.variables.push(clone);
  });
  function remapVarRefs(c){
    (c.effects||[]).forEach(e=>{ if(e.var && varMap[e.var]) e.var=varMap[e.var]; });
    if(c.condition && c.condition.var && varMap[c.condition.var]) c.condition.var=varMap[c.condition.var];
    if(c.dice && c.dice.modVar && varMap[c.dice.modVar]) c.dice.modVar=varMap[c.dice.modVar];
    (c.routes||[]).forEach(r=>{ if(r.var && varMap[r.var]) r.var=varMap[r.var]; });
  }

  // 4) backdrops: new ids, stamped to the new layer
  const bdMap={};
  project.backdrops = project.backdrops || {};
  Object.values(imported.backdrops||{}).forEach(b=>{
    const clone=JSON.parse(JSON.stringify(b));
    const newId=genId('bd'); bdMap[b.id]=newId; clone.id=newId; clone.layer=newLayerId;
    project.backdrops[newId]=clone;
  });

  // 5) scenes: new ids, stamped to the new layer, media/char/var refs remapped now
  const sceneMap={};
  const clones=[];
  Object.values(imported.scenes||{}).forEach(s=>{
    const clone=JSON.parse(JSON.stringify(s));
    const newId=genId('scene'); sceneMap[s.id]=newId; clone.id=newId; clone.layer=newLayerId;
    if(clone.group) clone.group=bdMap[clone.group]||null;
    remapMediaRefsDeep(clone, mediaMap);
    (clone.cast||[]).forEach(c=>{ if(c.charId && charMap[c.charId]) c.charId=charMap[c.charId]; });
    (clone.choices||[]).forEach(c=>remapVarRefs(c));
    project.scenes[newId]=clone;
    clones.push(clone);
  });
  // pass 2: scene-id cross-references need the full id map, so rewrite last
  clones.forEach(clone=>{
    (clone.choices||[]).forEach(c=>{
      (c.outcomes||[]).forEach(o=>{ if(o.targetNode) o.targetNode=sceneMap[o.targetNode]||null; });
      (c.routes||[]).forEach(r=>{ if(r.target) r.target=sceneMap[r.target]||''; });
      if(c.portal && c.portal.scene) c.portal.scene=sceneMap[c.portal.scene]||null;
    });
  });

  const importedStart = imported.settings && imported.settings.startScene;
  project.layers.push({ id:newLayerId, name: name||'Imported Layer', startScene: importedStart ? (sceneMap[importedStart]||null) : null });

  switchLayer(newLayerId);
  toast('Imported "'+((imported.meta&&imported.meta.title)||'project')+'" as a new layer');
}
