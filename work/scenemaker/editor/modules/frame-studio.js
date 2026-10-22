/* ============================================================================
   Scenemaker editor; Frame Studio
   A little modular frame-by-frame image editor for building a "talking"
   animation on any character portrait STATE (char-states.js's #10 feature).
   Add a sequence of images, each with its own on-screen duration, and the
   player cycles through them (looping) for as long as that state is showing
   - the same way you'd flip through a hand-made GIF. Reuses whatever's
   already in the asset library for each frame; jump into Image Studio first
   to crop/adjust a frame's own image, then bring it back in here.
   Non-destructive until "Save animation": a working copy is edited here and
   only written back to the character's portrait state on save. Shares
   core.js scope, same shell pattern as Image Studio (#89).
   ==========================================================================*/
let _fsChar=null, _fsPortrait=null;   // which character/portrait-state this session is editing
let _fsFrames=[];                     // working copy: [{media:key, ms:number}, ...]
let _fsPlaying=false, _fsPlayTimer=null, _fsPlayIdx=0;

/* ---- pure helpers (testable without a real DOM/timers) ------------------- */
function fsClampMs(v){ v=parseInt(v,10); if(isNaN(v)) return 150; return Math.max(30, Math.min(5000, v)); }
function fsNormalizeFrames(list){
  return (list||[]).filter(f=>f&&f.media).map(f=>({media:f.media, ms:fsClampMs(f.ms)}));
}
// pure reorder: swaps frame i with its neighbor (i+delta); no-op (same array
// reference back) if that would go out of bounds, so callers can always just
// reassign the result without checking bounds themselves first.
function fsFramesMoved(frames, i, delta){
  const j=i+delta; if(j<0||j>=frames.length) return frames;
  const out=frames.slice(); const t=out[i]; out[i]=out[j]; out[j]=t; return out;
}

/* ---- modal shell ---------------------------------------------------------*/
function openFrameStudio(ci, pi){
  const c=project.characters[ci]; const p=c && c.portraits && c.portraits[pi];
  if(!p) return;
  _fsChar=ci; _fsPortrait=pi;
  _fsFrames = (Array.isArray(p.frames) && p.frames.length)
    ? p.frames.map(f=>({media:f.media, ms:f.ms||150}))
    : (p.media ? [{media:p.media, ms:150}] : []);
  _fsPlaying=false; if(_fsPlayTimer){ clearTimeout(_fsPlayTimer); _fsPlayTimer=null; }
  let bg=document.getElementById('frame-studio');
  if(!bg){ bg=document.createElement('div'); bg.id='frame-studio'; bg.className='modal-bg hidden';
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('frame-studio', 'Frame Studio') : '';
    bg.innerHTML=`<div class="modal-card big"><h2>🏞 Frame Studio${detachIco}</h2>
      <div class="modal-body" id="fs-body"></div>
      <div class="modal-foot"><button class="tb-btn tb-slate" onclick="closeFrameStudio()">Close</button></div></div>`;
    document.body.appendChild(bg);
  }
  renderFrameStudio(); bg.classList.remove('hidden');
  if(typeof maybeShowMini==='function') maybeShowMini('framestudio');
}
function closeFrameStudio(){
  _fsPlaying=false; if(_fsPlayTimer){ clearTimeout(_fsPlayTimer); _fsPlayTimer=null; }
  const bg=document.getElementById('frame-studio'); if(bg) bg.classList.add('hidden');
}

function renderFrameStudio(){
  const body=document.getElementById('fs-body'); if(!body) return;
  const c=project.characters[_fsChar]; const p=c && c.portraits && c.portraits[_fsPortrait];
  const label = p ? ((c.name||'Character')+': '+(p.name||'state')) : '';
  const rows=_fsFrames.map((f,idx)=>`<div class="opt-row" style="margin-left:6px">
      <img class="fs-thumb" src="${mediaURL(f.media)||''}">
      <input type="number" min="30" max="5000" step="10" value="${f.ms}" style="width:64px" title="How long this frame shows, in milliseconds" onchange="fsSetMs(${idx},this.value)"> ms
      <button class="mini-btn" onclick="fsMove(${idx},-1)" ${idx===0?'disabled':''} title="Move earlier">▲</button>
      <button class="mini-btn" onclick="fsMove(${idx},1)" ${idx===_fsFrames.length-1?'disabled':''} title="Move later">▼</button>
      <button class="mini-btn" onclick="fsEditFrame(${idx})" title="Open this frame's image in Image Studio to crop/adjust it">🖼 edit</button>
      <span class="hdr-icon" style="color:#ef4444" onclick="fsRemoveFrame(${idx})" title="Remove this frame">✕</span>
    </div>`).join('') || '<div class="hint" style="margin-left:6px">No frames yet, add one below.</div>';
  body.innerHTML = `
    <div class="hint" style="margin-bottom:8px">${escHtml(label)}. Add a sequence of images and each frame's own on-screen time; while this state is showing, the player loops through them like a hand-made GIF.</div>
    <div class="fs-preview-wrap">
      <img id="fs-preview" class="fs-preview" src="${_fsFrames[0]?(mediaURL(_fsFrames[0].media)||''):''}">
      <button class="mini-btn" id="fs-play-btn" onclick="fsPlayToggle()" ${_fsFrames.length<2?'disabled':''} title="Preview the loop right here">▶ Play</button>
    </div>
    <div class="opt-group">${rows}</div>
    <button class="mini-btn" onclick="fsAddFrame()">+ frame</button>
    <div style="display:flex;gap:8px;margin-top:12px">
      <span style="flex:1"></span>
      <button class="tb-btn tb-emerald" onclick="fsSave()">Save animation</button>
    </div>
    <div class="hint" id="fs-msg" style="margin-top:6px"></div>`;
}

/* ---- frame list edits ----------------------------------------------------*/
async function fsAddFrame(){
  const k=await pickMedia('image'); if(!k) return;
  _fsFrames.push({media:k, ms:150});
  renderFrameStudio();
}
function fsSetMs(idx,v){ if(!_fsFrames[idx]) return; _fsFrames[idx].ms=fsClampMs(v); renderFrameStudio(); }
function fsRemoveFrame(idx){ _fsFrames.splice(idx,1); renderFrameStudio(); }
function fsMove(idx,delta){ _fsFrames=fsFramesMoved(_fsFrames, idx, delta); renderFrameStudio(); }
// hands a frame's own image off to Image Studio for cropping/adjusting; the
// edited result becomes a NEW library asset (Image Studio never overwrites),
// so it has to be picked back up here by hand once you're done over there.
function fsEditFrame(idx){
  const f=_fsFrames[idx]; if(!f) return;
  if(typeof openImageStudioWithAsset==='function') openImageStudioWithAsset(f.media);
}

/* ---- live loop preview (real timers, not tied to Save) ------------------ */
function fsPlayToggle(){
  _fsPlaying=!_fsPlaying;
  if(_fsPlaying){ _fsPlayIdx=0; fsPlayTick(); }
  else if(_fsPlayTimer){ clearTimeout(_fsPlayTimer); _fsPlayTimer=null; }
  const btn=document.getElementById('fs-play-btn'); if(btn) btn.textContent=_fsPlaying?'⏸ Pause':'▶ Play';
}
function fsPlayTick(){
  if(!_fsPlaying || !_fsFrames.length) return;
  const f=_fsFrames[_fsPlayIdx % _fsFrames.length];
  const img=document.getElementById('fs-preview'); if(img && f) img.src=mediaURL(f.media)||'';
  _fsPlayIdx++;
  _fsPlayTimer=setTimeout(fsPlayTick, fsClampMs(f?f.ms:150));
}

/* ---- save: writes the working copy back onto the portrait state ---------
   2+ valid frames -> real animation, .media kept in sync as frame 0 (so
   every OTHER place that already reads a state's plain .media, like its
   thumbnail in the states list, still shows something sensible); exactly 1
   frame collapses back down to a plain single-image state; 0 leaves it
   without an image at all, same as it started. -------------------------- */
function fsSave(){
  const c=project.characters[_fsChar]; const p=c && c.portraits && c.portraits[_fsPortrait];
  if(!p) return;
  const list=fsNormalizeFrames(_fsFrames);
  pushUndo();
  if(list.length>=2){ p.frames=list; p.media=list[0].media; }
  else if(list.length===1){ delete p.frames; p.media=list[0].media; }
  else { delete p.frames; }
  if(typeof renderCharList==='function') renderCharList();
  if(typeof renderScenes==='function') renderScenes();
  const m=document.getElementById('fs-msg'); if(m) m.textContent='Saved ('+list.length+' frame'+(list.length===1?'':'s')+').';
  if(typeof toast==='function') toast('Animation saved');
}
