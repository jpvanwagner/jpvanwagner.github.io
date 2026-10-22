/* ============================================================================
   Scenemaker editor; per-line sound effects  (feature #7)
   The "Sound effects" block under each dialogue line. Uses shared .opt-row styling.
   ==========================================================================*/
function lineSfxHtml(n,l){
  const arr=l.sfx||[];
  const rows=arr.map((s,si)=>`<div class="sfx-row">
      <div class="sfx-line1">
        <span class="sfx-drop" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropLineSfx(event,'${n.id}','${l.id}',${si})" title="Drop an audio asset here to set this sound"><button class="mini-btn" onclick="pickLineSfx('${n.id}','${l.id}',${si})">${s.media?'sound ✓':'+ sound'}</button></span>
        ${s.media?`<button class="mini-btn" onclick="openSoundStudioWithAsset('${escAttr(s.media)}')" title="Edit this sound in Sound Studio (trim, filter, effects)">✏ edit</button>`:''}
        <span class="opt-lbl">delay ms</span><input type="number" class="opt-num" min="0" value="${s.delay||0}" onchange="setLineSfx('${n.id}','${l.id}',${si},'delay',this.value)" title="Wait this long before playing">
        <label class="chk" style="margin:0"><input type="checkbox" ${s.loop?'checked':''} onchange="setLineSfx('${n.id}','${l.id}',${si},'loop',this.checked)"> loop</label>
        <span class="hdr-icon" style="color:#ef4444;margin-left:auto" onclick="delLineSfx('${n.id}','${l.id}',${si})" title="Remove this sound">✕</span>
      </div>
      <div class="sfx-line2"><label class="opt-lbl" style="white-space:nowrap">Play on word:</label>
        <input type="text" value="${escAttr(s.onWord||'')}" placeholder="blank = play immediately" onchange="setLineSfx('${n.id}','${l.id}',${si},'onWord',this.value)" style="flex:1" title="Type a word from this line; the sound fires as that word is typed">
      </div>
    </div>`).join('');
  return `<div class="opt-group">
    <div class="opt-row"><span class="opt-lbl">Sound effects</span>
      <button class="mini-btn" onclick="addLineSfx('${n.id}','${l.id}')" title="Add a sound effect (each can trigger on a different word)">+ sfx</button></div>
    ${arr.length>1?'<div class="hint" style="margin:0 0 4px 2px">Each sound can trigger on its own word.</div>':''}
    ${rows}</div>`;
}
function addLineSfx(nid,lid){ pushUndo(); const l=scenes[nid].lines.find(x=>x.id===lid); if(!l.sfx)l.sfx=[]; l.sfx.push({id:genId('sfx'),media:null,delay:0,loop:false,onWord:''}); renderScenes(); }
function delLineSfx(nid,lid,si){ pushUndo(); const l=scenes[nid].lines.find(x=>x.id===lid); l.sfx.splice(si,1); renderScenes(); }
function setLineSfx(nid,lid,si,f,v){ const l=scenes[nid].lines.find(x=>x.id===lid); const s=l.sfx[si]; if(!s)return;
  s[f] = (f==='delay') ? Math.max(0,parseInt(v,10)||0) : ((f==='loop') ? !!v : v); }
async function pickLineSfx(nid,lid,si){ const k=await pickMedia('audio'); if(k){ pushUndo(); scenes[nid].lines.find(x=>x.id===lid).sfx[si].media=k; renderScenes(); } }
