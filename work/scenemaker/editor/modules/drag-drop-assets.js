/* ============================================================================
   Scenemaker editor; drag-and-drop assets
   Part of the modular editor. Classic script sharing global scope with core.js.
   Lets a user drag an asset tile straight out of the Assets library panel and
   drop it onto a media "slot" (background, music, a portrait/face, an SFX
   picker, a doc attachment) to assign it there, instead of always going
   through the "pick a file" button. Uses a custom drag mimetype so an
   in-app asset drag never gets mistaken for a real OS file drag.
   #107: the same slots also accept a file dragged in from OUTSIDE the
   browser (the OS file explorer, a desktop folder) - it's imported into the
   project's media library exactly like the "pick a file" button would, then
   handed to the same per-slot assignment callback, so both drag sources end
   up doing the exact same thing from that point on. */
const ASSET_DRAG_MIME = 'text/scenemaker-asset';

/* dragstart on an .asset-cell tile in the Assets panel */
function assetDragStart(e, key){
  if(!e.dataTransfer) return;
  e.dataTransfer.setData(ASSET_DRAG_MIME, key);
  e.dataTransfer.effectAllowed = 'copy';
}

/* dragover on a drop target; reacts to our own in-app asset drags AND real
   OS file drags, so anything else (text, links, etc) still passes through
   untouched. */
function assetDragOver(e){
  const types = e.dataTransfer && e.dataTransfer.types; if(!types) return;
  const includes = (t)=> typeof types.includes==='function' ? types.includes(t) : Array.prototype.indexOf.call(types, t)>=0;
  if(!includes(ASSET_DRAG_MIME) && !includes('Files')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  if(e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.add('drop-hover');
}
function assetDragLeave(e){
  if(e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.remove('drop-hover');
}

/* drop on a target; kind is a comma-separated allow-list ('image', 'audio',
   'video', 'image,video', or 'any') checked against _assetKind(key) from
   assets-panel.js. Calls cb(key) once accepted; the caller owns pushUndo()
   and re-rendering, since different slots do that differently (some go
   through chromaImport's async callback instead of rendering immediately).
   Handles both drag sources: an in-app asset tile (synchronous, the key is
   already known) and a real external file (asynchronous - it has to be
   read and imported into project.media first). */
function assetDrop(e, kind, cb){
  e.preventDefault();
  if(e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.remove('drop-hover');
  if(!e.dataTransfer) return;
  const k = e.dataTransfer.getData(ASSET_DRAG_MIME);
  if(k){
    if(kind && kind!=='any'){
      const allowed = kind.split(',');
      const got = (typeof _assetKind==='function') ? _assetKind(k) : null;
      if(allowed.indexOf(got)===-1){ toast('That spot needs an '+allowed.join(' or ')+' file'); return; }
    }
    cb(k);
    return;
  }
  const files = e.dataTransfer.files;
  if(!files || !files.length) return;
  const file = files[0];
  if(kind && kind!=='any'){
    const allowed = kind.split(',');
    const got = (typeof _assetKind==='function') ? _assetKind(file.name) : null;
    if(allowed.indexOf(got)===-1){ toast('That spot needs an '+allowed.join(' or ')+' file'); return; }
  }
  const rd = new FileReader();
  rd.onload = () => { const key = makeKey(file.name, file); project.media[key] = rd.result; cb(key); };
  rd.onerror = () => { toast('Could not read that file'); };
  rd.readAsDataURL(file);
}

/* ---- per-slot drop handlers (mirror the matching pick*() function) ------- */
function dropSceneBg(e,sid){ assetDrop(e,'image,video', k=>{ pushUndo(); const kind=_assetKind(k); scenes[sid].bg={type:kind,media:k}; renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel();
  if(kind==='image' && typeof checkBgStretch==='function') checkBgStretch(k, ()=>{ undo(); renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); }); }); }
function dropSceneMusic(e,sid){ assetDrop(e,'audio', k=>{ pushUndo(); scenes[sid].music.media=k; renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); }); }
/* #18: the combined "nothing set yet" row shares one drop zone for either
   background (image/video) or music (audio) - route by whatever landed on
   it instead of making the user find the matching zone for their file. */
function dropSceneMedia(e,sid){ assetDrop(e,'image,video,audio', k=>{ pushUndo(); const kind=_assetKind(k);
  if(kind==='audio') scenes[sid].music.media=k; else scenes[sid].bg={type:kind,media:k};
  renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel();
  if(kind==='image' && typeof checkBgStretch==='function') checkBgStretch(k, ()=>{ undo(); renderScenes(); if(typeof renderPropsPanel==='function') renderPropsPanel(); }); }); }
function dropLinePortrait(e,sid,lid){ assetDrop(e,'image', k=>{ pushUndo(); const p=scenes[sid].lines.find(l=>l.id===lid).portrait; p.chroma=null; chromaImport(p,k,()=>renderScenes()); }); }
function dropLineDoc(e,sid,lid){ assetDrop(e,'any', k=>{ pushUndo(); const l=scenes[sid].lines.find(l=>l.id===lid); l.doc.media=k; if(!l.doc.label)l.doc.label='Handout'; renderScenes(); }); }
function dropLineSfx(e,sid,lid,si){ assetDrop(e,'audio', k=>{ pushUndo(); scenes[sid].lines.find(l=>l.id===lid).sfx[si].media=k; renderScenes(); }); }
function dropCastMedia(e,sid,cid){ assetDrop(e,'image', k=>{ pushUndo(); const c=scenes[sid].cast.find(x=>x.id===cid); c.chroma=null; chromaImport(c,k,()=>renderScenes()); }); }
function dropCharMedia(e,i){ assetDrop(e,'image', k=>{ pushUndo(); const ch=project.characters[i]; ch.chroma=null; chromaImport(ch,k,()=>{ renderCharList(); renderScenes(); }); }); }
function dropCharStateMedia(e,i,pi){ assetDrop(e,'image', k=>{ pushUndo(); const st=project.characters[i].portraits[pi]; st.chroma=null; chromaImport(st,k,()=>{ renderCharList(); renderScenes(); }); }); }
