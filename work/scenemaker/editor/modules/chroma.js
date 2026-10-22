/* ============================================================================
   Scenemaker editor; background transparency / chroma-key (#4)
   Knocks a solid background colour out of a portrait so it sits cleanly on the
   scene. Transparent-by-default for flat images; leaves images that already
   have their own transparency alone. Pick a colour, click the image to sample
   one, or let it auto-detect the background. Pure pixel helpers below are unit-
   tested; the canvas + modal layer runs in the browser.
   NOTE: no top-level browser calls here, so the pure helpers are Node-testable.
   ==========================================================================*/

/* ---- pure helpers (testable) -------------------------------------------- */
function hexToRgb(hex){ hex=(hex||'#000000').replace('#',''); if(hex.length===3) hex=hex.split('').map(c=>c+c).join('');
  const n=parseInt(hex,16)||0; return [(n>>16)&255,(n>>8)&255,n&255]; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(v=>('0'+Math.max(0,Math.min(255,v|0)).toString(16)).slice(-2)).join(''); }
function imageHasAlpha(data){ for(let i=3;i<data.length;i+=4){ if(data[i]<250) return true; } return false; }

/* average the four corners + edge midpoints → the presumed background colour */
function detectBgColor(data,w,h){
  const at=(x,y)=>{ const i=((y*w)+x)*4; return [data[i],data[i+1],data[i+2]]; };
  const cx=w>>1, cy=h>>1, X=w-1, Y=h-1;
  const pts=[[0,0],[X,0],[0,Y],[X,Y],[cx,0],[cx,Y],[0,cy],[X,cy]];
  let r=0,g=0,b=0; pts.forEach(p=>{ const c=at(Math.max(0,Math.min(X,p[0])),Math.max(0,Math.min(Y,p[1]))); r+=c[0];g+=c[1];b+=c[2]; });
  const n=pts.length; return [Math.round(r/n),Math.round(g/n),Math.round(b/n)];
}

/* set alpha=0 for every pixel within `tolerance` (0..255) of the key colour */
function keyPixels(data,w,h,rgb,tolerance){
  const kr=rgb[0],kg=rgb[1],kb=rgb[2], tol=(tolerance||0), tol2=tol*tol*3; let keyed=0;
  for(let i=0;i<data.length;i+=4){ const dr=data[i]-kr, dg=data[i+1]-kg, db=data[i+2]-kb;
    if(dr*dr+dg*dg+db*db <= tol2){ data[i+3]=0; keyed++; } }
  return keyed;
}
function defaultChroma(){ return { enabled:false, color:'auto', tolerance:60 }; }

/* ---- canvas processing (browser) ---------------------------------------- */
function chromaLoad(dataUrl, cb){
  if(typeof document==='undefined'){ cb(null); return; }
  const img=new Image();
  img.onload=function(){ try{
    const c=document.createElement('canvas'); c.width=img.naturalWidth||img.width||1; c.height=img.naturalHeight||img.height||1;
    const ctx=c.getContext('2d'); if(!ctx){ cb(null); return; }
    ctx.drawImage(img,0,0); const id=ctx.getImageData(0,0,c.width,c.height); cb(id.data,c.width,c.height);
  }catch(e){ cb(null); } };
  img.onerror=function(){ cb(null); }; img.src=dataUrl;
}
function chromaToUrl(data,w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d'); const id=ctx.createImageData(w,h); id.data.set(data); ctx.putImageData(id,0,0); return c.toDataURL('image/png'); }

/* raw dataURL + chroma settings → keyed dataURL (or raw if disabled/unavailable) */
function chromaApply(rawUrl, chroma, done){
  chromaLoad(rawUrl, function(data,w,h){
    if(!data){ done(rawUrl, chroma||{enabled:false,color:'auto',tolerance:60}); return; }
    if(!chroma){ chroma = imageHasAlpha(data) ? {enabled:false,color:'auto',tolerance:60} : defaultChroma(); }
    if(!chroma.enabled){ done(rawUrl, chroma); return; }
    const key = (chroma.color==='auto') ? detectBgColor(data,w,h) : hexToRgb(chroma.color);
    keyPixels(data,w,h,key,chroma.tolerance);
    done(chromaToUrl(data,w,h), chroma);
  });
}

/* ---- media-store glue (keeps original + keyed as separate media keys) --- */
function putMedia(dataUrl){ const key=makeKey('keyed.png'); project.media[key]=dataUrl; return key; }
function chromaStore(entry, keyedUrl, chroma){
  if(!chroma.enabled){ entry.media = entry.mediaRaw; }
  else if(entry.media && entry.media!==entry.mediaRaw){ project.media[entry.media]=keyedUrl; }  // reuse the keyed slot
  else { entry.media = putMedia(keyedUrl); }
  entry.chroma = chroma;
}
/* first import of an image: decide + apply transparency automatically */
function chromaImport(entry, origKey, after){ entry.mediaRaw=origKey;
  chromaApply(mediaURL(origKey), entry.chroma||null, function(keyedUrl,chroma){ chromaStore(entry,keyedUrl,chroma); after&&after(); }); }

/* ---- modal ------------------------------------------------------------- */
let chromaCtx=null;
function chromaEditEntry(entry, after){ const rawKey=entry.mediaRaw||entry.media; if(!rawKey) return; entry.mediaRaw=rawKey;
  chromaCtx={ entry, after, chroma: entry.chroma?Object.assign({},entry.chroma):null, rawUrl:mediaURL(rawKey) };
  document.getElementById('chroma-modal').classList.remove('hidden');
  const go=()=>{ document.getElementById('chroma-enabled').checked=chromaCtx.chroma.enabled;
    document.getElementById('chroma-tol').value=chromaCtx.chroma.tolerance; document.getElementById('chroma-tolval').textContent=chromaCtx.chroma.tolerance;
    if(chromaCtx.chroma.color&&chromaCtx.chroma.color!=='auto') document.getElementById('chroma-color').value=chromaCtx.chroma.color;
    chromaRefresh(); };
  if(chromaCtx.chroma) go();
  else chromaLoad(chromaCtx.rawUrl,function(data){ chromaCtx.chroma = (data&&imageHasAlpha(data))?{enabled:false,color:'auto',tolerance:60}:defaultChroma(); go(); });
}
function chromaReadControls(){ const c=chromaCtx.chroma; c.enabled=document.getElementById('chroma-enabled').checked;
  c.tolerance=+document.getElementById('chroma-tol').value; document.getElementById('chroma-tolval').textContent=c.tolerance;
  const ctl=document.getElementById('chroma-controls'); ctl.style.opacity=c.enabled?'1':'.4'; ctl.style.pointerEvents=c.enabled?'':'none'; }
function chromaRefresh(){ if(!chromaCtx) return; chromaReadControls();
  chromaApply(chromaCtx.rawUrl, chromaCtx.chroma, function(url){ const pv=document.getElementById('chroma-preview'); if(pv) pv.innerHTML='<img src="'+url+'" draggable="false">'; }); }
function chromaSetColor(hex){ if(!chromaCtx) return; chromaCtx.chroma.color=hex; chromaRefresh(); }
function chromaAuto(){ if(!chromaCtx) return; chromaCtx.chroma.color='auto'; chromaRefresh(); }
function chromaPick(e){ if(!chromaCtx) return; const img=document.querySelector('#chroma-preview img'); if(!img) return;
  const r=img.getBoundingClientRect(); const x=Math.floor((e.clientX-r.left)/r.width*(img.naturalWidth||1)), y=Math.floor((e.clientY-r.top)/r.height*(img.naturalHeight||1));
  chromaLoad(chromaCtx.rawUrl,function(data,w,h){ if(!data)return; const xi=Math.max(0,Math.min(w-1,x)), yi=Math.max(0,Math.min(h-1,y)); const i=((yi*w)+xi)*4;
    const hex=rgbToHex(data[i],data[i+1],data[i+2]); document.getElementById('chroma-color').value=hex; chromaSetColor(hex); }); }
function chromaCancel(){ document.getElementById('chroma-modal').classList.add('hidden'); chromaCtx=null; }
function chromaApplyClose(){ if(!chromaCtx) return; chromaReadControls();
  chromaApply(chromaCtx.rawUrl, chromaCtx.chroma, function(url){ pushUndo(); chromaStore(chromaCtx.entry, url, chromaCtx.chroma);
    const after=chromaCtx.after; document.getElementById('chroma-modal').classList.add('hidden'); chromaCtx=null; after&&after(); }); }

/* ---- entry points from the image rows ---------------------------------- */
function chromaChar(i){ chromaEditEntry(project.characters[i], function(){ renderCharList(); renderScenes(); }); }
function chromaCast(id,cid){ const c=scenes[id].cast.find(x=>x.id===cid); if(c) chromaEditEntry(c, function(){ renderScenes(); }); }
function chromaPortrait(id,lid){ const p=scenes[id].lines.find(l=>l.id===lid).portrait; chromaEditEntry(p, function(){ renderScenes(); }); }
