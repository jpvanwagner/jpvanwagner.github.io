/* ============================================================================
   Scenemaker editor; group options  (features #4 colour, #8 per-group music/fx)
   A modal for a group: name, background colour (+ presets), a music track that
   member scenes inherit, and full-screen effects applied to the whole group.
   Built dynamically so it needs no markup in editor.html. Shares core.js scope.
   ==========================================================================*/
function openGroupOptions(id){
  const b=backdrops[id]; if(!b) return;
  if(!b.music) b.music={media:null,loop:true,volume:0.6,stop:false};
  let bg=document.getElementById('group-modal');
  if(!bg){ bg=document.createElement('div'); bg.id='group-modal'; bg.className='modal-bg hidden';
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('group-modal', 'Group options') : '';
    bg.innerHTML='<div class="modal-card" style="max-width:480px"><h2>Group options'+detachIco+'</h2>'
      +'<div class="modal-body" id="group-modal-body"></div>'
      +'<div class="modal-foot"><button class="tb-btn tb-slate" onclick="closeModal(\'group-modal\')">Close</button></div></div>';
    document.body.appendChild(bg);
  }
  bg.setAttribute('data-gid', id);
  renderGroupOptions(id);
  bg.classList.remove('hidden');
}
function renderGroupOptions(id){
  const b=backdrops[id]; if(!b) return; const body=document.getElementById('group-modal-body');
  const swatches=GROUP_COLORS.map(c=>`<span class="grp-swatch" title="${c}" style="background:${c}" onclick="setGroupColor('${id}','${c}')"></span>`).join('');
  const mu=b.music||{};
  body.innerHTML=
    `<div class="sec"><h3>Appearance</h3>
       <div class="fld"><label>Name</label><input type="text" value="${escAttr(b.name)}" oninput="updateBackdrop('${id}','name',this.value)"></div>
       <div class="fld"><label>Background colour</label>
         <div style="display:flex;align-items:center;gap:10px">
           <input type="color" value="${b.color}" oninput="setGroupColor('${id}',this.value); hexSyncFromColor(this)" style="width:44px;height:30px;padding:0;border:none;background:none;cursor:pointer">${hexFieldHtml(b.color)}
           <div class="grp-swatches">${swatches}</div>
         </div></div>
     </div>
     <div class="sec"><h3>Group audio</h3>
       <div class="hint" style="margin-bottom:6px">Plays for every scene in this group that doesn't set its own track.</div>
       <div class="media-slot"><span style="color:var(--mut)">Track</span>
         <button class="mini-btn" onclick="pickGroupMusic('${id}')">set</button>
         <button class="mini-btn warn" onclick="clearGroupMusic('${id}')">clear</button>
         <span class="hint">${mu.media?'✓ set':'none'}</span></div>
     </div>
     <div class="sec"><h3>Group effects</h3>
       <div class="hint" style="margin-bottom:6px">Applied to every scene in this group (a scene can override with its own effect).</div>
       ${typeof fxPickerHtml==='function'?fxPickerHtml(id):''}
     </div>`;
}
function setGroupColor(id,c){ const b=backdrops[id]; if(!b) return; b.color=c; renderBackdrops(); const bg=document.getElementById('group-modal'); if(bg&&bg.getAttribute('data-gid')===id) renderGroupOptions(id); }
function pickGroupMusic(id){ pickMedia('audio').then(k=>{ if(k){ pushUndo(); const b=backdrops[id]; if(!b.music)b.music={loop:true,volume:0.6}; b.music.media=k; b.music.stop=false; renderGroupOptions(id); toast('Group audio set'); } }); }
function clearGroupMusic(id){ const b=backdrops[id]; if(b&&b.music){ pushUndo(); b.music.media=null; renderGroupOptions(id); } }
