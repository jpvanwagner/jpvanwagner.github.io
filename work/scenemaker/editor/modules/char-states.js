/* ============================================================================
   Scenemaker editor; character portrait "states"  (feature #10)
   The character's row image is its Default face; here you add named alternates
   ("sad","angry","laughing"), each with its own image + background transparency.
   Pick which shows per line with the 🎭 picker in the Stage box. Shared scope.
   ==========================================================================*/
function charStatesHtml(i,c){
  const ps=c.portraits||[];
  const rows=ps.map((p,pi)=>{
    const isTalk=c.talkState===p.id;
    return `<div class="opt-row" style="margin-left:10px">
      <div class="portrait-mini" style="width:24px;height:24px" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropCharStateMedia(event,${i},${pi})" title="Drop an image asset here to set this state's face (an animated GIF plays here automatically, no extra setup)">${mediaURL(p.media)?`<img src="${mediaURL(p.media)}">`:'🎭'}</div>
      <input type="text" value="${escAttr(p.name||'')}" placeholder="state name" oninput="setCharStateName(${i},${pi},this.value)" style="width:92px">
      <button class="mini-btn" onclick="pickCharStateMedia(${i},${pi})">${p.media?'img✓':'+img'}</button>
      ${p.media?`<button class="mini-btn" title="Background transparency" onclick="chromaCharState(${i},${pi})">bg</button>`:''}
      ${p.media?`<button class="mini-btn" onclick="openFrameStudio(${i},${pi})" title="${(p.frames&&p.frames.length>1)?('Edit this state’s '+p.frames.length+'-frame talking animation'):'Turn this state into a frame-by-frame talking animation'}">🏞${(p.frames&&p.frames.length>1)?(' '+p.frames.length):''}</button>`:''}
      <span class="hdr-icon${isTalk?' is-locked':''}" onclick="setTalkState(${i},'${p.id}')" title="${isTalk?'This is the talking state - shown automatically while this character speaks (click to unset)':'Use this face automatically while this character is speaking, instead of whatever state a line otherwise picks'}">🗣</span>
      <span class="hdr-icon" style="color:#ef4444" onclick="delCharState(${i},${pi})">✕</span>
    </div>`;
  }).join('');
  return `<div class="opt-group" style="margin-left:30px">
    <div class="opt-row"><span class="opt-lbl">Extra faces (states)</span>
      <button class="mini-btn" onclick="addCharState(${i})">+ state</button></div>
    ${rows}</div>`;
}
// #NEW: mark (or unmark) one state as THE face shown automatically while
// this character is the one speaking, overriding whatever state a line's
// own 🎭 picker otherwise selected for the duration of that line - a
// second click on the already-marked state clears it. At most one per
// character (a plain field on the character, not a flag on the state
// itself, so setting a new one always replaces the old automatically).
function setTalkState(i,pid){ pushUndo(); const c=project.characters[i]; c.talkState=(c.talkState===pid)?'':pid; renderCharList(); renderScenes(); }
function addCharState(i){ pushUndo(); const c=project.characters[i]; if(!c.portraits)c.portraits=[]; c.portraits.push({id:genId('st'),name:'state',media:null,mediaRaw:null,chroma:null}); renderCharList(); }
function delCharState(i,pi){ pushUndo(); const c=project.characters[i]; const removed=c.portraits[pi].id; c.portraits.splice(pi,1);
  if(c.talkState===removed) c.talkState='';
  Object.values(scenes).forEach(s=>s.lines.forEach(l=>(l.stage||[]).forEach(st=>{ if(st.state===removed) st.state=''; }))); renderCharList(); renderScenes(); }
function setCharStateName(i,pi,v){ project.characters[i].portraits[pi].name=v; }
async function pickCharStateMedia(i,pi){ const k=await pickMedia('image'); if(k){ pushUndo(); const st=project.characters[i].portraits[pi]; st.chroma=null; chromaImport(st,k,()=>{ renderCharList(); renderScenes(); }); } }
function chromaCharState(i,pi){ chromaEditEntry(project.characters[i].portraits[pi], ()=>{ renderCharList(); renderScenes(); }); }
function stateOptions(c, selected){
  let opts='<option value="">Default</option>';
  (c.portraits||[]).forEach(p=>{ opts+=`<option value="${p.id}" ${selected===p.id?'selected':''}>${escHtml(p.name||'state')}${p.id===c.talkState?' 🗣':''}</option>`; });
  return opts;
}
function setFaceState(nid,lid,cid,stateId){ const l=scenes[nid].lines.find(x=>x.id===lid); const s=(l.stage||[]).find(s=>s.castId===cid); if(s){ s.state=stateId; renderScenes(); } }
