/* ============================================================================
   Scenemaker editor; full-screen effects picker  (feature #8, editor side)
   Reusable fx controls for project / group / scene. An fx object is
   { overlay, filter, intensity }. Player reads these and layers the effect.
   Shares global scope with core.js.
   ==========================================================================*/
const FX_OVERLAYS=[['none','None'],['crt','CRT scanlines'],['bow','CRT curve (bow)'],['glitch','Glitch'],['snow','Snow'],['rain','Rain'],['dust','Dust']];
const FX_FILTERS =[['none','None'],['sepia','Sepia'],['noir','Noir (B&W)'],['contrast','High contrast'],['dream','Dream (soft)'],['warm','Warm'],['cold','Cold'],['vignette','Vignette']];
function fxDefault(){ return {overlay:'none',filter:'none',intensity:5}; }
function fxOf(scope){
  if(typeof scope==='string' && scope.indexOf('char:')===0){ const cid=scope.slice(5); const c=(project.characters||[]).find(x=>x.id===cid); if(c){ if(!c.portraitFx)c.portraitFx=fxDefault(); return c.portraitFx; } return fxDefault(); }
  if(scope==='project'){ if(!project.fx)project.fx=fxDefault(); return project.fx; }
  if(backdrops&&backdrops[scope]){ if(!backdrops[scope].fx)backdrops[scope].fx=fxDefault(); return backdrops[scope].fx; }
  if(scenes&&scenes[scope]){ if(!scenes[scope].fx)scenes[scope].fx=fxDefault(); return scenes[scope].fx; }
  return fxDefault();
}
function fxPickerHtml(scope, label){ const f=fxOf(scope);
  return `<div class="fx-picker">${label?`<div class="hint" style="margin-bottom:4px">${label}</div>`:''}
    <div class="rowflex">
      <div class="fld"><label>Overlay</label><select onchange="setFx('${scope}','overlay',this.value)">${FX_OVERLAYS.map(o=>`<option value="${o[0]}" ${f.overlay===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
      <div class="fld"><label>Colour / contrast</label><select onchange="setFx('${scope}','filter',this.value)">${FX_FILTERS.map(o=>`<option value="${o[0]}" ${f.filter===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
    </div>
    <div class="fld"><label>Intensity</label><input type="range" min="1" max="10" value="${f.intensity||5}" oninput="setFx('${scope}','intensity',this.value)"></div></div>`;
}
function setFx(scope,k,v){ const f=fxOf(scope); f[k]=(k==='intensity')?(parseInt(v,10)||5):v; }

/* ---- #51: a character's portrait can stack several effects at once ------
   (e.g. CRT scanlines AND CRT bowing together) instead of being limited to
   one overlay + one filter. Each list entry is {type, intensity}, drawing
   from the same FX_OVERLAYS/FX_FILTERS catalog as the single-effect picker
   above (nothing stops you combining two "overlay" types or two "filter"
   types now - it's just a flat list). player/runtime.js applies every entry
   simultaneously (filters stack natively via CSS's space-separated filter
   functions; overlay classes are independent, not mutually toggled). */
const FX_ALL_TYPES = FX_OVERLAYS.concat(FX_FILTERS).filter(t=>t[0]!=='none');
function portraitFxList(charId){
  const c=(project.characters||[]).find(x=>x.id===charId); if(!c) return [];
  if(!Array.isArray(c.portraitFxList)){
    // migrate the legacy single {overlay,filter,intensity} shape into a real
    // list the first time this is touched, so an existing project renders
    // identically until you actually add/remove/reorder an effect
    const legacy=c.portraitFx, list=[];
    if(legacy){
      if(legacy.overlay && legacy.overlay!=='none') list.push({type:legacy.overlay, intensity:legacy.intensity||5});
      if(legacy.filter && legacy.filter!=='none') list.push({type:legacy.filter, intensity:legacy.intensity||5});
    }
    c.portraitFxList=list;
  }
  return c.portraitFxList;
}
function portraitFxListHtml(charId){
  const list=portraitFxList(charId);
  const rows=list.map((f,i)=>`<div class="mini-row" style="flex-wrap:wrap">
    <select onchange="setPortraitFxItem('${charId}',${i},'type',this.value)">${FX_ALL_TYPES.map(t=>`<option value="${t[0]}" ${f.type===t[0]?'selected':''}>${t[1]}</option>`).join('')}</select>
    <input type="range" min="1" max="10" value="${f.intensity||5}" oninput="setPortraitFxItem('${charId}',${i},'intensity',this.value)" title="Intensity" style="width:70px">
    <button class="mini-btn" onclick="movePortraitFx('${charId}',${i},-1)" title="Move earlier" ${i===0?'disabled':''}>▲</button>
    <button class="mini-btn" onclick="movePortraitFx('${charId}',${i},1)" title="Move later" ${i===list.length-1?'disabled':''}>▼</button>
    <span class="row-x" onclick="removePortraitFx('${charId}',${i})" title="Remove this effect">✕</span></div>`).join('');
  return `<div class="hint" style="margin-bottom:5px">Stack as many as you like - e.g. CRT scanlines and CRT bowing together.</div>${rows}
    <button class="mini-btn" onclick="addPortraitFx('${charId}')" title="Add another effect, on top of any already here">+ effect</button>`;
}
function addPortraitFx(charId){ const list=portraitFxList(charId); pushUndo(); list.push({type:'crt',intensity:5}); renderCharList(); }
function removePortraitFx(charId,i){ const list=portraitFxList(charId); pushUndo(); list.splice(i,1); renderCharList(); }
function movePortraitFx(charId,i,delta){ const list=portraitFxList(charId); const j=i+delta; if(j<0||j>=list.length) return; pushUndo(); const t=list[i]; list[i]=list[j]; list[j]=t; renderCharList(); }
function setPortraitFxItem(charId,i,field,v){ const list=portraitFxList(charId); if(!list[i]) return; list[i][field]=(field==='intensity')?(parseInt(v,10)||5):v; if(field==='type') renderCharList(); }

/* ---- #10: full-project (and, by the same mechanism, scene/group) effects
   can stack several at once too, e.g. CRT scanlines + a vignette + light
   snow together, instead of one overlay + one filter - same list-of-{type,
   intensity} shape and migrate-on-first-touch approach as the character
   portrait stack above, just keyed to project/scene/group instead of a
   character. Currently only wired up in Settings' project-level Effects
   box (fxListHtml('project')); scene/group still use the single fxPickerHtml
   above, unchanged, since #10 only asked for the project level. */
function fxHolderFor(scope){
  if(scope==='project') return project;
  if(backdrops && backdrops[scope]) return backdrops[scope];
  if(scenes && scenes[scope]) return scenes[scope];
  return null;
}
function fxListOf(scope){
  const holder=fxHolderFor(scope); if(!holder) return [];
  if(!Array.isArray(holder.fxList)){
    const legacy=holder.fx, list=[];
    if(legacy){
      if(legacy.overlay && legacy.overlay!=='none') list.push({type:legacy.overlay, intensity:legacy.intensity||5});
      if(legacy.filter && legacy.filter!=='none') list.push({type:legacy.filter, intensity:legacy.intensity||5});
    }
    holder.fxList=list;
  }
  return holder.fxList;
}
function fxListHtml(scope, label){
  const list=fxListOf(scope);
  const rows=list.map((f,i)=>`<div class="mini-row" style="flex-wrap:wrap">
    <select onchange="setFxListItem('${scope}',${i},'type',this.value)">${FX_ALL_TYPES.map(t=>`<option value="${t[0]}" ${f.type===t[0]?'selected':''}>${t[1]}</option>`).join('')}</select>
    <input type="range" min="1" max="10" value="${f.intensity||5}" oninput="setFxListItem('${scope}',${i},'intensity',this.value)" title="Intensity" style="width:70px">
    <button class="mini-btn" onclick="moveFxListItem('${scope}',${i},-1)" title="Move earlier" ${i===0?'disabled':''}>▲</button>
    <button class="mini-btn" onclick="moveFxListItem('${scope}',${i},1)" title="Move later" ${i===list.length-1?'disabled':''}>▼</button>
    <span class="row-x" onclick="removeFxListItem('${scope}',${i})" title="Remove this effect">✕</span></div>`).join('');
  return `<div class="fx-picker">${label?`<div class="hint" style="margin-bottom:4px">${label}</div>`:''}
    <div class="hint" style="margin-bottom:6px">Stack as many as you like, e.g. CRT scanlines with a vignette and light snow, all applied together.</div>
    ${rows||'<div class="hint" style="margin-bottom:6px">No effects yet.</div>'}
    <button class="mini-btn" onclick="addFxListItem('${scope}')" title="Add another effect, on top of any already here">+ effect</button></div>`;
}
function refreshFxListUI(scope){ if(scope==='project'){ const fb=document.getElementById('fx-project-box'); if(fb) fb.innerHTML=fxListHtml('project'); } }
function addFxListItem(scope){ const list=fxListOf(scope); pushUndo(); list.push({type:'crt',intensity:5}); refreshFxListUI(scope); }
function removeFxListItem(scope,i){ const list=fxListOf(scope); pushUndo(); list.splice(i,1); refreshFxListUI(scope); }
function moveFxListItem(scope,i,delta){ const list=fxListOf(scope); const j=i+delta; if(j<0||j>=list.length) return; pushUndo(); const t=list[i]; list[i]=list[j]; list[j]=t; refreshFxListUI(scope); }
function setFxListItem(scope,i,field,v){ const list=fxListOf(scope); if(!list[i]) return; list[i][field]=(field==='intensity')?(parseInt(v,10)||5):v; if(field==='type') refreshFxListUI(scope); }
