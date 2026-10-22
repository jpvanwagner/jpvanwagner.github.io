/* ============================================================================
   Scenemaker editor; characters
   Part of the modular editor. Classic script sharing global scope with core.js.
   ==========================================================================*/
/* character library (#8): resolve a cast entry to its display props */
function castProps(entry){ if(entry&&entry.charId){ const ch=(project.characters||[]).find(x=>x.id===entry.charId); if(ch) return ch; } return entry||{}; }
// #10: renderScenes()/renderPropsPanel() are what actually rebuild the "add
// from library"/"link to a character" pickers in scene boxes and the
// Properties panel (they read project.characters fresh on every render) -
// missing them here meant a newly-added character was invisible in either
// place until some UNRELATED edit happened to trigger a re-render, reading
// as a random, unpredictable lag rather than "it just isn't updated yet".
// #105: once a project actually has more than one layer, a newly-added
// character defaults to whichever layer you're viewing right now, instead of
// piling every character from every layer into one undifferentiated list.
// A single-layer project (the common case) is untouched - layer stays ''
// ("all layers"), exactly like every character created before this existed.
function _charDefaultLayer(){ return (typeof allLayers==='function' && allLayers().length>1 && typeof currentLayerId!=='undefined') ? currentLayerId : ''; }
function addCharacter(){ pushUndo(); if(!project.characters)project.characters=[]; project.characters.push({id:genId('char'),name:'Name',media:null,size:'square',scale:1,enter:'fade',border:'none',portraitShape:'',portraitFit:'',color:'',highlightName:false,layer:_charDefaultLayer(),textSpeed:{mode:'',speed:5},typeSound:{enabled:false,wave:'square',pitch:6,volume:5,chirp:0,detune:0},portraits:[]}); renderCharList(); renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); }
// which layer a character belongs to; '' (or missing) means "all layers" -
// the original, still-default behaviour every pre-existing character keeps.
function setCharLayer(i,layerId){ const c=project.characters[i]; if(!c) return; pushUndo(); c.layer=layerId||''; renderCharList(); }
// collapsed by default only when it's scoped to a layer OTHER than the one
// you're viewing (so switching layers naturally declutters the list without
// hiding anything outright); once a card's caret is toggled by hand, that
// explicit choice sticks regardless of which layer you're on afterward.
function _charDefaultCollapsed(c){
  if(typeof allLayers!=='function' || allLayers().length<=1) return false;
  if(!c.layer) return false; // "all layers" characters always default open
  return c.layer!==currentLayerId;
}
function setCharF(i,f,v){ project.characters[i][f]=(f==='scale')?(parseFloat(v)||1):v;
  // #10: 'name' needs the same live refresh as scale/color - scene boxes'
  // and the Properties panel's own "link to a library character" pickers
  // show this character's CURRENT name, and would otherwise keep showing
  // the stale one until some unrelated re-render happened to catch up.
  if(f==='scale'||f==='color'||f==='name'){ renderScenes(); if(f==='name'&&typeof renderPropsPanel==='function') renderPropsPanel(); }
  // #98: a character's colour exists to tell them apart at a glance -
  // picking one another character already has silently defeats that, so
  // flag it. A toast, not a blocking confirm: a duplicate is a mistake
  // worth noticing, not something to forbid outright (e.g. two minor
  // characters who never actually share a scene together).
  if(f==='color' && v){ const dupe=project.characters.find((c,ci)=>ci!==i && c.color===v);
    if(dupe) toast(`"${dupe.name||'Another character'}" already uses this color`); }
  // #88: names are how a picker/dropdown/scene-box tells two characters
  // apart, so a duplicate silently defeats that the same way a duplicate
  // color does above - flagged the same way, never blocked outright (two
  // background extras sharing "Guard" is a real, valid choice sometimes).
  if(f==='name' && v){ const dupe=project.characters.find((c,ci)=>ci!==i && c.name===v);
    if(dupe) toast(`Another character is already named "${v}"`); } }
function setCharSpeed(i,f,v){ const c=project.characters[i]; if(!c.textSpeed)c.textSpeed={mode:'',speed:5}; c.textSpeed[f]=(f==='speed')?(parseInt(v,10)||5):v; if(f==='mode') renderCharList(); }
async function pickCharMedia(i){ const k=await pickMedia('image'); if(k){ pushUndo(); const ch=project.characters[i]; ch.chroma=null; chromaImport(ch,k,()=>{ renderCharList(); renderScenes(); }); } }
function delCharacter(i){ pushUndo(); const removed=project.characters[i].id; project.characters.splice(i,1);
  Object.values(scenes).forEach(s=>{ if(s.cast){ const gone=s.cast.filter(c=>c.charId===removed).map(c=>c.id); s.cast=s.cast.filter(c=>c.charId!==removed);
    s.lines.forEach(l=>{ if(l.stage)l.stage=l.stage.filter(st=>!gone.includes(st.castId)); if(gone.includes(l.speakingCast))l.speakingCast=''; }); } });
  renderCharList(); renderScenes(); }
let _charCollapsed={};
function addCharEnterFx(i){ const c=project.characters[i]; if(!c)return; if(!Array.isArray(c.enterFx))c.enterFx=[]; const v=(document.getElementById('cef-'+i)||{}).value; if(v && c.enterFx.indexOf(v)<0){ pushUndo(); c.enterFx.push(v); renderCharList(); } }
function delCharEnterFx(i,ei){ const c=project.characters[i]; if(c&&c.enterFx){ pushUndo(); c.enterFx.splice(ei,1); renderCharList(); } }
// #105: toggle from the EFFECTIVE (currently displayed) collapsed state, not
// the raw _charCollapsed map value - a card can read as collapsed purely via
// _charDefaultCollapsed()'s smart default with no map entry yet, and flipping
// `undefined` would set it to true (stay collapsed) instead of expanding it.
function toggleCharCollapse(id){
  const c=(project.characters||[]).find(x=>x.id===id);
  const shown=(id in _charCollapsed) ? _charCollapsed[id] : (c ? _charDefaultCollapsed(c) : false);
  _charCollapsed[id]=!shown; renderCharList();
}
function collapseAllChars(){ (project.characters||[]).forEach(c=>_charCollapsed[c.id]=true); renderCharList(); }
function expandAllChars(){ _charCollapsed={}; renderCharList(); }
function renderCharList(){
  const box=document.getElementById('char-list'); if(!box) return;
  const multiLayer = typeof allLayers==='function' && allLayers().length>1;
  box.innerHTML=(project.characters&&project.characters.length)? project.characters.map((c,i)=>{
    const collapsed = (c.id in _charCollapsed) ? _charCollapsed[c.id] : _charDefaultCollapsed(c);
    return `
    <div class="char-card${collapsed?' collapsed':''}">
    <div class="line-top char-head" style="gap:4px" oncontextmenu="if(event.target.tagName!=='INPUT'&&event.target.tagName!=='SELECT'){charCardMenu(event,${i})}">
      <span class="char-caret" onclick="toggleCharCollapse('${c.id}')">${collapsed?'▸':'▾'}</span>
      <div class="portrait-mini" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropCharMedia(event,${i})" title="Drop an image asset here to set this character's face">${mediaURL(c.media)?`<img src="${mediaURL(c.media)}">`:'👤'}</div>
      <input class="speaker-in" style="max-width:96px" value="${escAttr(c.name)}" placeholder="name" oninput="setCharF(${i},'name',this.value)">
      ${multiLayer?`<select class="mini-sel" title="Which layer this character belongs to; 'All layers' keeps it visible everywhere (the original behaviour)" onchange="setCharLayer(${i},this.value)"><option value="" ${!c.layer?'selected':''}>All layers</option>${allLayers().map(l=>`<option value="${l.id}" ${c.layer===l.id?'selected':''}>${escHtml(l.name)}</option>`).join('')}</select>`:''}
      <button class="mini-btn" onclick="pickCharMedia(${i})">${c.media?'img✓':'+img'}</button>
      ${c.media?`<button class="mini-btn" title="Background transparency" onclick="chromaChar(${i})">bg</button>`:''}
      <span class="hint" style="font-size:10px;margin:0 -2px 0 2px">Size</span>
      <select class="mini-sel" title="Portrait size: how much of the screen height this character's portrait takes up on stage (square = small headshot, tall = half-body, full = full-height)" onchange="setCharF(${i},'size',this.value)">${CAST_SIZES.map(s=>`<option value="${s}" ${c.size===s?'selected':''}>${s}</option>`).join('')}</select>
      <span class="hint" style="font-size:10px;margin:0 -2px 0 2px">Scale</span>
      ${scaleSel(c.scale,`setCharF(${i},'scale',this.value)`,'Portrait scale: an extra zoom multiplier on top of the size above (1x = no change)')}
      <span class="hint" style="font-size:10px;margin:0 -2px 0 2px">Enter</span>
      <select class="mini-sel" title="Entrance animation: how this character's portrait appears when they first step on stage" onchange="setCharF(${i},'enter',this.value)">${CAST_ENTER.map(s=>`<option value="${s}" ${c.enter===s?'selected':''}>${s}</option>`).join('')}</select>
      <span class="hint" style="font-size:10px;margin:0 -2px 0 2px">Border</span>
      <select class="mini-sel" title="Portrait border style, drawn around the edge of this character's portrait" onchange="setCharF(${i},'border',this.value)">${BORDER_OPTS.map(b=>`<option value="${b}" ${c.border===b?'selected':''}>${b}</option>`).join('')}</select>
      <input type="color" class="char-color" value="${c.color||'#8b8fa3'}" oninput="setCharF(${i},'color',this.value); hexSyncFromColor(this)" title="Editor colour for this character; shown on their cast entries, dialogue lines and canvas-editor portraits so you can tell speakers apart at a glance. Never appears in the exported game.">${hexFieldHtml(c.color||'#8b8fa3')}
      ${c.color?`<span class="hdr-icon" title="Clear colour (back to no colour-coding)" onclick="setCharF(${i},'color','')">⊘</span>`:''}
      <label class="chk" style="margin:0" title="Automatically bold (and, if a colour is set above, colour) this character's name wherever it appears in dialogue/cutscene text, in actual play"><input type="checkbox" ${c.highlightName?'checked':''} onchange="setCharF(${i},'highlightName',this.checked)"> ✎ name</label>
      <span class="hdr-icon" style="color:#ef4444" onclick="delCharacter(${i})">✕</span>
    </div>
    <div class="char-body">
    <div class="line-top" style="gap:5px;margin:-2px 0 8px 30px;align-items:center">
      <span class="hint" style="margin:0">Text speed:</span>
      ${typeof speedControlHtml==='function'?speedControlHtml(c.textSpeed,true,`setCharSpeed(${i},'mode',this.value)`,`setCharSpeed(${i},'speed',this.value)`):''}
    </div>
    ${typeof charSoundHtml==='function'?charSoundHtml(i,c):''}
    ${typeof charStatesHtml==='function'?charStatesHtml(i,c):''}
    <details class="char-fx"><summary>🎬 Entrance / exit</summary>
      <div class="rowflex">
        <div class="fld"><label>Enter with</label><select onchange="setCharF(${i},'enter',this.value)">${CAST_ENTER.map(o=>`<option value="${o}" ${c.enter===o?'selected':''}>${o}</option>`).join('')}</select></div>
        <div class="fld"><label>Exit with</label><select onchange="setCharF(${i},'exit',this.value)">${CAST_EXIT.map(o=>`<option value="${o}" ${(c.exit||'fade')===o?'selected':''}>${o}</option>`).join('')}</select></div>
      </div>
      <label class="lbl-sm">Extra simultaneous entrance effects</label>
      <div class="mini-row" style="flex-wrap:wrap">${(c.enterFx||[]).map((e,ei)=>`<span class="fx-chip">${e}<span class="row-x" onclick="delCharEnterFx(${i},${ei})">✕</span></span>`).join('')}
        <select id="cef-${i}" class="mini-sel">${CAST_ENTER.filter(x=>x!=='none').map(o=>`<option value="${o}">${o}</option>`).join('')}</select>
        <button class="mini-btn" onclick="addCharEnterFx(${i})" title="Play this entrance effect at the same time as the main one">+ add</button></div>
    </details>
    <details class="char-fx"><summary><img class="btn-ico" src="../assets/icons/portrait.png" alt=""> Portrait look</summary><div class="rowflex">
      <div class="fld"><label>Shape</label><select onchange="setCharF(${i},'portraitShape',this.value)" title="Overrides the canvas default for this character">${['(default)','square','rounded','circle'].map(o=>`<option value="${o==='(default)'?'':o}" ${(c.portraitShape||'')===(o==='(default)'?'':o)?'selected':''}>${o}</option>`).join('')}</select></div>
      <div class="fld"><label>Fit</label><select onchange="setCharF(${i},'portraitFit',this.value)"><option value="" ${!c.portraitFit?'selected':''}>(default)</option>${[['contain','fit'],['cover','fill & crop'],['fill','stretch']].map(o=>`<option value="${o[0]}" ${c.portraitFit===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
    </div></details>
    <details class="char-fx"><summary>✨ Portrait effects</summary>${typeof portraitFxListHtml==='function'?portraitFxListHtml(c.id):''}</details>
    <details class="char-fx"><summary>🗣 Speaking animation</summary><div class="rowflex" style="flex-direction:column;align-items:stretch">
      <label class="chk"><input type="checkbox" id="sp-${i}" ${c.speakPulse?'checked':''}
        onchange="setCharF(${i},'speakPulse',this.checked); document.getElementById('spi-${i}').disabled=!this.checked; document.getElementById('sps-${i}').disabled=!this.checked;"> Pulse the portrait while this character is talking</label>
      <div class="fld"><label>Intensity</label><input type="range" id="spi-${i}" min="0" max="100" value="${c.speakIntensity!=null?c.speakIntensity:50}" oninput="setCharF(${i},'speakIntensity',parseInt(this.value,10))" ${c.speakPulse?'':'disabled'}></div>
      <div class="fld"><label>Speed</label><input type="range" id="sps-${i}" min="0" max="100" value="${c.speakSpeed!=null?c.speakSpeed:50}" oninput="setCharF(${i},'speakSpeed',parseInt(this.value,10))" ${c.speakPulse?'':'disabled'}></div>
      <div class="hint" style="margin-top:-2px">A subtle grow-and-glow while their line is showing, off for everyone else. Uses their own colour above if set.</div>
    </div></details>
    <details class="use-block"><summary>🔎 Where used</summary>${typeof charUsage==='function'?usageListHtml(charUsage(c.id)):''}</details></div></div>`;
  }).join('') : '<div class="hint">No characters yet. Define one, then add them to any scene\u2019s cast with one click.</div>';
}
/* right-click a character card: duplicate it, add it to whatever scene was
   last edited (project.meta.lastEditScene, the same "last worked on" scene
   the editor already centers on when a project reopens), or delete it */
function duplicateCharacter(i){ pushUndo(); const c=project.characters[i]; const copy=JSON.parse(JSON.stringify(c)); copy.id=genId('char'); copy.name=c.name+' copy'; project.characters.splice(i+1,0,copy); renderCharList(); }
// #105: same duplicate-and-splice pattern as duplicateCharacter, but the copy
// is retagged onto a different layer instead of getting a " copy" name; lets
// a character built on one layer become a starting point on another without
// losing the original.
function copyCharToLayer(i,targetLayerId){
  const c=project.characters[i]; if(!c) return;
  pushUndo(); const copy=JSON.parse(JSON.stringify(c)); copy.id=genId('char'); copy.layer=targetLayerId||'';
  project.characters.splice(i+1,0,copy); renderCharList();
  if(typeof toast==='function') toast('Copied to '+(typeof layerName==='function'?layerName(targetLayerId):'layer'));
}
function addCharToCurrentScene(i){ const sid=project.meta&&project.meta.lastEditScene; if(!sid||!scenes[sid]){ if(typeof toast==='function') toast('No current scene to add to'); return; }
  pushUndo(); const s=scenes[sid]; if(!s.cast)s.cast=[]; const cid=genId('cast'); s.cast.push({id:cid,charId:project.characters[i].id});
  stageCastEverywhere(s,cid); if(typeof autoDefaultSpeaker==='function')autoDefaultSpeaker(s); renderScenes();
  if(typeof toast==='function') toast('Added to '+(s.title||'scene')); }
function charCardMenu(e,i){
  e.preventDefault(); e.stopPropagation();
  if(typeof showContextMenu!=='function') return;
  const items=[ { icon:'⧉', label:'Duplicate', onClick:()=>duplicateCharacter(i) } ];
  const sid=project.meta&&project.meta.lastEditScene;
  if(sid && scenes[sid]) items.push({ icon:'➕', label:'Add to current scene’s cast', onClick:()=>addCharToCurrentScene(i) });
  // #105: one "Copy to layer" item per OTHER layer (showContextMenu has no
  // submenus), only once the project actually has more than one layer.
  if(typeof allLayers==='function' && allLayers().length>1){
    const c=project.characters[i]; const own=c&&c.layer||'';
    allLayers().filter(l=>l.id!==own).forEach(l=>{
      items.push({ icon:'📋', label:'Copy to layer “'+l.name+'”', onClick:()=>copyCharToLayer(i,l.id) });
    });
  }
  items.push({ sep:true });
  items.push({ icon:'✕', label:'Delete character', onClick:()=>delCharacter(i) });
  showContextMenu(e.clientX, e.clientY, items);
}
function addCastFromLib(id){ const sel=document.getElementById('libpick-'+id); if(!sel||!sel.value)return; pushUndo(); const s=scenes[id]; if(!s.cast)s.cast=[]; const cid=genId('cast'); s.cast.push({id:cid,charId:sel.value}); stageCastEverywhere(s,cid); if(typeof autoDefaultSpeaker==='function')autoDefaultSpeaker(s); renderScenes(); }
