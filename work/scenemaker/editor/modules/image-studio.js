/* ============================================================================
   Scenemaker editor; Image Studio  (#89)
   A rudimentary in-app image editor, the same spirit as Sound Studio: load an
   existing library asset (or open straight from the Assets panel), crop /
   rotate / flip it and adjust brightness/contrast/saturation, preview live,
   and save the result to the asset library as a new PNG - never overwrites
   the original, so nothing already placed in a scene silently changes look
   out from under it.
   Crop/rotate/flip are DESTRUCTIVE-but-undoable-via-Reset edits to a working
   canvas (_isBase); brightness/contrast/saturation stay live, non-destructive
   sliders (a CSS `filter` applied at draw time) until Save bakes them in too.
   Shares core.js scope.
   ==========================================================================*/
let _isOriginalImg=null;   // the freshly-loaded <img>, untouched - what Reset returns to
let _isBase=null;          // working <canvas> holding the current crop/rotate/flip state
// #125: brightness/contrast/saturate are the original three (0-300%, neutral
// at 100); opacity (0-100%, real alpha transparency - it's part of the SAME
// canvas filter() chain, so it bakes into the saved PNG's actual alpha
// channel, not just a CSS-only fade) and five more filter effects (all
// neutral at 0, same as CSS's own filter() defaults) join them below.
let _isAdjust={brightness:100, contrast:100, saturate:100, opacity:100, grayscale:0, sepia:0, invert:0, hueRotate:0, blur:0};
let _isCropSel=null;       // {x,y,w,h} in _isBase pixel space, once a drag has committed a selection
let _isCropDragStart=null; // {x,y} in _isBase pixel space while actively dragging

/* ---- pure helpers (testable without a real canvas 2D context) ----------- */
// each slider's own [min,max,neutral] - used both to clamp its value and to
// reset it; kept a single source of truth so renderImageStudio()'s sliders
// and isSet()'s clamping can never silently drift apart.
const IS_RANGES = { brightness:[0,300,100], contrast:[0,300,100], saturate:[0,300,100],
  opacity:[0,100,100], grayscale:[0,100,0], sepia:[0,100,0], invert:[0,100,0], hueRotate:[0,360,0], blur:[0,20,0] };
function isClampAdjust(v){ v=parseInt(v,10); if(isNaN(v)) return 100; return Math.max(0, Math.min(300, v)); }
function isClampRange(v,id){ const r=IS_RANGES[id]||[0,300,100]; v=parseInt(v,10); if(isNaN(v)) return r[2]; return Math.max(r[0], Math.min(r[1], v)); }
function isDefaultAdjust(){ const o={}; Object.keys(IS_RANGES).forEach(id=>o[id]=IS_RANGES[id][2]); return o; }
function isFilterString(adj){ const a=Object.assign(isDefaultAdjust(), adj||_isAdjust);
  return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) grayscale(${a.grayscale}%) sepia(${a.sepia}%) invert(${a.invert}%) hue-rotate(${a.hueRotate}deg) blur(${a.blur}px) opacity(${a.opacity}%)`; }
/* two raw drag points (any order) + the buffer's own bounds -> a normalized,
   clamped, non-degenerate crop rect, or null if the drag was too small to be
   a real selection (a stray click, not a drag). */
function isCropRectFromPoints(x0,y0,x1,y1, maxW,maxH){
  let x=Math.min(x0,x1), y=Math.min(y0,y1), w=Math.abs(x1-x0), h=Math.abs(y1-y0);
  x=Math.max(0,Math.min(x,maxW)); y=Math.max(0,Math.min(y,maxH));
  w=Math.max(0,Math.min(w,maxW-x)); h=Math.max(0,Math.min(h,maxH-y));
  if(w<4||h<4) return null;
  return {x:Math.round(x), y:Math.round(y), w:Math.round(w), h:Math.round(h)};
}

/* ---- modal shell ---------------------------------------------------------*/
function openImageStudio(){
  let bg=document.getElementById('image-studio');
  if(!bg){ bg=document.createElement('div'); bg.id='image-studio'; bg.className='modal-bg hidden';
    // #172: crop/paint drag gestures still work detached, relayed over the
    // bridge, but each move is a real round trip rather than same-process.
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('image-studio', 'Image Studio') : '';
    bg.innerHTML=`<div class="modal-card big"><h2>🖼 Image Studio${detachIco}</h2>
      <div class="modal-body" id="is-body"></div>
      <div class="modal-foot"><button class="tb-btn tb-slate" onclick="closeImageStudio()">Close</button></div></div>`;
    document.body.appendChild(bg);
  }
  renderImageStudio(); bg.classList.remove('hidden');
  if(typeof maybeShowMini==='function') maybeShowMini('imagestudio');
}
function closeImageStudio(){ const bg=document.getElementById('image-studio'); if(bg) bg.classList.add('hidden'); }
/* open the studio already loaded with an existing library asset, e.g. from the Assets panel's right-click menu */
function openImageStudioWithAsset(k){
  openImageStudio();
  const sel=document.getElementById('is-load');
  if(sel && Array.from(sel.options).some(o=>o.value===k)){ sel.value=k; isLoadAsset(); }
  else { _isMsg('That asset could not be loaded here.'); }
}
function _isMsg(t){ const m=document.getElementById('is-msg'); if(m) m.textContent=t||''; }

function renderImageStudio(){
  const body=document.getElementById('is-body'); if(!body) return;
  const imageKeys=Object.keys(project.media||{}).filter(k=>(typeof _assetKind==='function'?_assetKind(k):'')==='image');
  const a=_isAdjust;
  const sl=(id,label,val)=>{ const r=IS_RANGES[id]||[0,300,100];
    return `<div class="is-row"><label>${label}</label><input type="range" min="${r[0]}" max="${r[1]}" value="${val}" oninput="isSet('${id}',this.value)"><span class="is-val" id="isv-${id}">${val}${_isUnit(id)}</span></div>`; };
  body.innerHTML=`
    <div class="is-source">
      ${imageKeys.length?`<select id="is-load" class="mini-sel">${imageKeys.map(k=>`<option value="${escAttr(k)}">${escHtml(k.split('/').pop())}</option>`).join('')}</select><button class="mini-btn" onclick="isLoadAsset()">load asset</button>`:'<span class="hint">No image assets in the library yet.</span>'}
      <span class="hint" id="is-status">${_isBase?(_isBase.width+'×'+_isBase.height+'px'):'no image loaded'}</span>
    </div>
    <div class="is-canvas-wrap"><canvas id="is-canvas" width="1" height="1"
      onmousedown="isCropStart(event)"></canvas></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      <button class="mini-btn" onclick="isRotate(-1)" ${_isBase?'':'disabled'} title="Rotate 90° left">⟲ Rotate</button>
      <button class="mini-btn" onclick="isRotate(1)" ${_isBase?'':'disabled'} title="Rotate 90° right">⟳ Rotate</button>
      <button class="mini-btn" onclick="isFlip('h')" ${_isBase?'':'disabled'} title="Flip horizontally">⇋ Flip H</button>
      <button class="mini-btn" onclick="isFlip('v')" ${_isBase?'':'disabled'} title="Flip vertically">⇵ Flip V</button>
      <span class="hint" style="align-self:center">Drag on the image to select a crop area</span>
      <button class="mini-btn tb-accent" onclick="isApplyCrop()" ${_isCropSel?'':'disabled'} title="Crop to the selected area">✂ Apply crop</button>
      <button class="mini-btn" onclick="isCancelCrop()" ${_isCropSel?'':'disabled'} title="Clear the selection without cropping">Cancel selection</button>
    </div>
    <div class="sec"><h3>Adjust</h3>
      ${sl('brightness','Brightness',a.brightness)}
      ${sl('contrast','Contrast',a.contrast)}
      ${sl('saturate','Saturation',a.saturate)}
      ${sl('opacity','Opacity (transparency)',a.opacity)}
    </div>
    <div class="sec"><h3>Effects</h3>
      ${sl('grayscale','Grayscale',a.grayscale)}
      ${sl('sepia','Sepia',a.sepia)}
      ${sl('invert','Invert',a.invert)}
      ${sl('hueRotate','Hue rotate',a.hueRotate)}
      ${sl('blur','Blur',a.blur)}
    </div>
    <div style="display:flex;gap:8px">
      <button class="mini-btn" onclick="isReset()" ${_isOriginalImg?'':'disabled'} title="Discard every edit, back to the originally loaded image">↺ Reset all</button>
      <span style="flex:1"></span>
      <button class="tb-btn tb-emerald" onclick="isSaveToLibrary()" ${_isBase?'':'disabled'}>Save as new asset</button>
    </div>
    <div class="hint" id="is-msg" style="margin-top:6px"></div>`;
  isDrawPreview();
}

/* ---- load / draw ---------------------------------------------------------*/
function isLoadAsset(){
  const sel=document.getElementById('is-load'); if(!sel||!sel.value) return;
  const url=mediaURL(sel.value);
  const img=new Image();
  img.onload=function(){
    _isOriginalImg=img; _isAdjust=isDefaultAdjust(); _isCropSel=null;
    _isBase=_isCanvasFromImage(img);
    renderImageStudio(); _isMsg('Loaded '+img.naturalWidth+'×'+img.naturalHeight+'px');
  };
  img.onerror=function(){ _isMsg('Could not load that asset.'); };
  img.src=url;
}
function _isCanvasFromImage(img){
  const c=document.createElement('canvas'); c.width=img.naturalWidth||img.width||1; c.height=img.naturalHeight||img.height||1;
  const ctx=c.getContext('2d'); if(ctx) ctx.drawImage(img,0,0);
  return c;
}
function _isUnit(id){ return id==='hueRotate' ? '°' : (id==='blur' ? 'px' : '%'); }
function isSet(id,v){ _isAdjust[id]=isClampRange(v,id); const el=document.getElementById('isv-'+id); if(el) el.textContent=_isAdjust[id]+_isUnit(id); isDrawPreview(); }
function isDrawPreview(){
  const canvas=document.getElementById('is-canvas'); if(!canvas) return;
  if(!_isBase){ canvas.width=1; canvas.height=1; return; }
  canvas.width=_isBase.width; canvas.height=_isBase.height;
  const ctx=canvas.getContext && canvas.getContext('2d'); if(!ctx) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.filter=isFilterString(_isAdjust);
  ctx.drawImage(_isBase,0,0);
  ctx.filter='none';
  if(_isCropSel){
    // reads the CURRENT theme's accent colour rather than a hardcoded fuchsia.
    const accentHex=(getComputedStyle(document.documentElement).getPropertyValue('--accent')||'#e879f9').trim();
    const [ar,ag,ab]=hexToRgb(accentHex);
    ctx.strokeStyle=accentHex; ctx.lineWidth=2; ctx.setLineDash([6,4]);
    ctx.strokeRect(_isCropSel.x,_isCropSel.y,_isCropSel.w,_isCropSel.h);
    ctx.fillStyle=`rgba(${ar},${ag},${ab},.12)`; ctx.fillRect(_isCropSel.x,_isCropSel.y,_isCropSel.w,_isCropSel.h);
    ctx.setLineDash([]); }
}

/* ---- crop selection (mouse-drag on the canvas, in its OWN pixel space -
   the canvas's drawing buffer can be larger than its on-screen CSS size, so
   every event coordinate is rescaled by the ratio between the two) ------- */
function _isCanvasPoint(e){
  const canvas=document.getElementById('is-canvas'); if(!canvas) return {x:0,y:0};
  const r=canvas.getBoundingClientRect();
  const sx=r.width?canvas.width/r.width:1, sy=r.height?canvas.height/r.height:1;
  return { x:(e.clientX-r.left)*sx, y:(e.clientY-r.top)*sy };
}
function isCropStart(e){ if(!_isBase) return; const p=_isCanvasPoint(e); _isCropDragStart=p; _isCropSel=null; }
function isCropMove(e){ if(!_isCropDragStart) return; const p=_isCanvasPoint(e);
  _isCropSel=isCropRectFromPoints(_isCropDragStart.x,_isCropDragStart.y,p.x,p.y,_isBase.width,_isBase.height);
  isDrawPreview(); _isSyncCropButtons(); }
function isCropEnd(){ _isCropDragStart=null; }
// mousemove/mouseup used to be bound on the <canvas> itself (plus an
// onmouseleave that also called isCropEnd), so dragging a selection toward
// or past the canvas's own edge - the single most natural thing to do when
// picking a crop area - lost tracking the instant the cursor left the
// element, and mouseleave then cancelled the drag outright even though the
// mouse button was still held down. Tracking on window instead (the same
// pattern dockpanels.js's own float-dragging already uses) keeps the drag
// alive anywhere on the page; isCropRectFromPoints already clamps the
// resulting rect to the image's own bounds, so a selection dragged out
// past the canvas still ends exactly at its edge, not off it.
window.addEventListener('mousemove', e=>{ if(_isCropDragStart) isCropMove(e); });
window.addEventListener('mouseup', ()=>{ if(_isCropDragStart) isCropEnd(); });
// live-toggle just the two crop buttons' disabled state while dragging,
// instead of rebuilding the WHOLE modal body (and recreating the canvas
// element mid-drag) on every single mousemove.
function _isSyncCropButtons(){
  const apply=document.querySelector('#is-body button[onclick="isApplyCrop()"]');
  const cancel=document.querySelector('#is-body button[onclick="isCancelCrop()"]');
  if(apply) apply.disabled=!_isCropSel; if(cancel) cancel.disabled=!_isCropSel;
}
function isApplyCrop(){
  if(!_isCropSel||!_isBase) return;
  const c=document.createElement('canvas'); c.width=_isCropSel.w; c.height=_isCropSel.h;
  const ctx=c.getContext('2d'); if(ctx) ctx.drawImage(_isBase,_isCropSel.x,_isCropSel.y,_isCropSel.w,_isCropSel.h,0,0,_isCropSel.w,_isCropSel.h);
  _isBase=c; _isCropSel=null; renderImageStudio(); _isMsg('Cropped to '+c.width+'×'+c.height+'px');
}
function isCancelCrop(){ _isCropSel=null; renderImageStudio(); }

/* ---- rotate / flip (each bakes immediately into _isBase, so they stack
   freely with each other and with a crop in any order) --------------------*/
function isRotate(dir){
  if(!_isBase) return;
  const w=_isBase.width, h=_isBase.height;
  const c=document.createElement('canvas'); c.width=h; c.height=w;
  const ctx=c.getContext('2d'); if(ctx){ ctx.translate(c.width/2,c.height/2); ctx.rotate((dir>0?90:-90)*Math.PI/180);
    ctx.drawImage(_isBase,-w/2,-h/2); }
  _isBase=c; renderImageStudio();
}
function isFlip(axis){
  if(!_isBase) return;
  const w=_isBase.width, h=_isBase.height;
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d'); if(ctx){
    if(axis==='h'){ ctx.translate(w,0); ctx.scale(-1,1); } else { ctx.translate(0,h); ctx.scale(1,-1); }
    ctx.drawImage(_isBase,0,0); }
  _isBase=c; renderImageStudio();
}
function isReset(){
  if(!_isOriginalImg) return;
  _isBase=_isCanvasFromImage(_isOriginalImg); _isAdjust=isDefaultAdjust(); _isCropSel=null;
  renderImageStudio(); _isMsg('Reset to the original image');
}

/* ---- save (bakes the live brightness/contrast/saturation filter in too) -*/
function isSaveToLibrary(){
  if(!_isBase) return;
  const c=document.createElement('canvas'); c.width=_isBase.width; c.height=_isBase.height;
  const ctx=c.getContext('2d'); if(!ctx){ _isMsg('Rendering not supported here.'); return; }
  ctx.filter=isFilterString(_isAdjust); ctx.drawImage(_isBase,0,0);
  const dataUrl=c.toDataURL('image/png');
  const key=makeKey('edited.png'); project.media[key]=dataUrl;
  pushUndo(); if(typeof _assetSel!=='undefined') _assetSel=key; if(typeof renderAssetsPanel==='function') renderAssetsPanel();
  _isMsg('Saved to the asset library.'); toast('Image saved to the library');
}
