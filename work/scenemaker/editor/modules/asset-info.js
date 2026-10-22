/* ============================================================================
   Scenemaker editor; rich asset info modal  (feature #19)
   Double-clicking an asset in the Assets library opens this. Beyond the
   original name/type/size/usage-count, it now shows a real, zoomable preview
   (image/video/audio - audio keeps playing in the background if you close
   the modal mid-track, and reopening the same asset picks the playhead back
   up instead of restarting), when the file was added to this project, when
   the original file was last modified outside the project (captured once,
   at import time, straight off the OS file - a data URL alone can't tell us
   that after the fact), and best-effort embedded authorship metadata (JPEG
   EXIF Artist/Copyright/GPS-presence, PNG tEXt/iTXt Author/Copyright), plus
   one-click "copy to credits" and a shortcut into the credits editor.
   Shares core.js scope.
   ==========================================================================*/

/* ---- added/modified timestamps (recorded once, at import time) ---------- */
// makeKey() calls this the moment a brand-new media key is minted, so every
// asset gets a real "added to this project" stamp with no extra plumbing at
// each of its several call sites (file picker, drag-in, Sound Studio, etc).
function recordMediaAdded(key, file){
  if(!project.mediaMeta) project.mediaMeta={};
  if(project.mediaMeta[key]) return; // never clobber an existing stamp (e.g. re-import)
  project.mediaMeta[key] = {
    addedAt: new Date().toISOString(),
    fileModified: (file && file.lastModified) ? new Date(file.lastModified).toISOString() : null
  };
}
function _assetMeta(key){ return (project.mediaMeta && project.mediaMeta[key]) || null; }
function _fmtWhen(iso){ if(!iso) return null; try{ const d=new Date(iso); return isNaN(d.getTime())?null:d.toLocaleString(); }catch(e){ return null; } }

/* ---- binary helpers ------------------------------------------------------ */
function _dataUrlBytes(dataUrl){
  const i=dataUrl.indexOf(','); const b64=i>=0?dataUrl.slice(i+1):dataUrl;
  const bin=atob(b64); const bytes=new Uint8Array(bin.length);
  for(let j=0;j<bin.length;j++) bytes[j]=bin.charCodeAt(j);
  return bytes;
}

/* ---- JPEG EXIF: Artist / Copyright / DateTimeOriginal / GPS presence ----- */
function _readExif(bytes){
  try{
    if(bytes[0]!==0xFF || bytes[1]!==0xD8) return null; // not a JPEG
    let off=2;
    while(off < bytes.length-4){
      if(bytes[off]!==0xFF) break;
      const marker=bytes[off+1];
      if(marker===0xD8 || marker===0x01 || (marker>=0xD0 && marker<=0xD7)){ off+=2; continue; }
      if(marker===0xDA || marker===0xD9) break; // start-of-scan / end-of-image: no more APPn after this
      const segLen=(bytes[off+2]<<8)|bytes[off+3];
      if(marker===0xE1){
        const p=off+4;
        if(bytes[p]===0x45&&bytes[p+1]===0x78&&bytes[p+2]===0x69&&bytes[p+3]===0x66&&bytes[p+4]===0){
          const parsed=_parseTiff(bytes, p+6);
          if(parsed) return parsed;
        }
      }
      off += 2+segLen;
    }
  }catch(e){}
  return null;
}
function _parseTiff(bytes, base){
  const little = (bytes[base]===0x49 && bytes[base+1]===0x49);
  const u16=(o)=> little ? (bytes[o]|(bytes[o+1]<<8)) : ((bytes[o]<<8)|bytes[o+1]);
  const u32=(o)=> little ? ((bytes[o]|(bytes[o+1]<<8)|(bytes[o+2]<<16)|(bytes[o+3]<<24))>>>0) : (((bytes[o]<<24)|(bytes[o+1]<<16)|(bytes[o+2]<<8)|bytes[o+3])>>>0);
  const readAscii=(byteOffsetFromBase,count)=>{ let s=''; for(let i=0;i<count-1;i++){ const c=bytes[base+byteOffsetFromBase+i]; if(!c) break; s+=String.fromCharCode(c); } return s.trim(); };
  const result={};
  function readIfd(off){
    const count=u16(base+off);
    let exifSub=null, gps=null;
    for(let i=0;i<count;i++){
      const entryOff=base+off+2+i*12;
      const tag=u16(entryOff), type=u16(entryOff+2), cnt=u32(entryOff+4), valOff=entryOff+8;
      if(type===2){ // ASCII
        const dataOffset = cnt<=4 ? (valOff-base) : u32(valOff);
        const str=readAscii(dataOffset,cnt);
        if(tag===0x013B && str) result.artist=str;
        if(tag===0x8298 && str) result.copyright=str;
        if(tag===0x0132 && str) result.dateTime=str;
        if(tag===0x9003 && str) result.dateTimeOriginal=str;
      }
      if(tag===0x8825) gps=u32(valOff);
      if(tag===0x8769) exifSub=u32(valOff);
    }
    if(gps!=null) result.hasGps=true;
    return exifSub;
  }
  const ifdOff=u32(base+4);
  const exifSub=readIfd(ifdOff);
  if(exifSub!=null && exifSub>0 && base+exifSub+2<bytes.length){
    const count=u16(base+exifSub);
    for(let i=0;i<count;i++){
      const entryOff=base+exifSub+2+i*12;
      const tag=u16(entryOff), type=u16(entryOff+2), cnt=u32(entryOff+4), valOff=entryOff+8;
      if(type===2 && tag===0x9003){
        const dataOffset = cnt<=4 ? (valOff-base) : u32(valOff);
        const str=readAscii(dataOffset,cnt);
        if(str) result.dateTimeOriginal=str;
      }
    }
  }
  return Object.keys(result).length ? result : null;
}

/* ---- PNG text chunks: Author / Artist / Copyright / Description ---------- */
function _readPngText(bytes){
  try{
    const sig=[0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A];
    for(let i=0;i<8;i++) if(bytes[i]!==sig[i]) return null;
    let off=8; const result={};
    while(off < bytes.length-8){
      const len=(bytes[off]<<24)|(bytes[off+1]<<16)|(bytes[off+2]<<8)|bytes[off+3];
      const type=String.fromCharCode(bytes[off+4],bytes[off+5],bytes[off+6],bytes[off+7]);
      const dataStart=off+8;
      if(dataStart+len > bytes.length) break;
      if(type==='tEXt'){
        let j=dataStart, key='';
        while(j<dataStart+len && bytes[j]!==0){ key+=String.fromCharCode(bytes[j]); j++; }
        let val=''; for(let k=j+1;k<dataStart+len;k++) val+=String.fromCharCode(bytes[k]);
        _pngAssign(result,key,val);
      } else if(type==='iTXt'){
        let j=dataStart, key='';
        while(j<dataStart+len && bytes[j]!==0){ key+=String.fromCharCode(bytes[j]); j++; }
        j++; // null terminator after keyword
        const compFlag=bytes[j]; j+=2; // compression flag + compression method
        while(j<dataStart+len && bytes[j]!==0) j++; j++; // skip language tag
        while(j<dataStart+len && bytes[j]!==0) j++; j++; // skip translated keyword
        if(compFlag===0){ let val=''; for(let k=j;k<dataStart+len;k++) val+=String.fromCharCode(bytes[k]); _pngAssign(result,key,val); }
      } else if(type==='IEND'){ break; }
      off = dataStart+len+4; // +4 to skip the trailing CRC
    }
    return Object.keys(result).length ? result : null;
  }catch(e){ return null; }
}
function _pngAssign(result,key,val){
  if(!val) return;
  const k=key.toLowerCase();
  if(k==='author' || k==='artist') result.artist=val;
  else if(k==='copyright') result.copyright=val;
  else if(k==='description') result.description=val;
  else if(k==='creation time') result.dateTime=val;
  else if(k==='software') result.software=val;
}
function _readEmbeddedMeta(key){
  const url=mediaURL(key); if(!url) return null;
  const ext=_assetExt(key);
  try{
    const bytes=_dataUrlBytes(url);
    if(ext==='jpg'||ext==='jpeg') return _readExif(bytes);
    if(ext==='png') return _readPngText(bytes);
  }catch(e){}
  return null;
}

/* ---- embedded title for tracker-module audio (.it/.xm/.mod/.s3m) --------- */
function _moduleTitle(dataUrl, ext){
  try{ const i=dataUrl.indexOf(','); const bin=atob(dataUrl.slice(i+1));
    const read=(off,len)=>{ let out=''; for(let j=off;j<off+len&&j<bin.length;j++){ const c=bin.charCodeAt(j); if(c>=32&&c<127) out+=String.fromCharCode(c); else if(c===0) break; } return out.trim(); };
    if(ext==='it' && bin.slice(0,4)==='IMPM') return read(4,26);
    if(ext==='xm' && bin.slice(0,15)==='Extended Module') return read(17,20);
    if(ext==='mod') return read(0,20);
    if(ext==='s3m') return read(0,28);
  }catch(e){}
  return '';
}

/* ---- the modal itself ----------------------------------------------------- */
let _aiKey=null, _aiZoom=100, _aiOpacity=100;

function showAssetInfo(k){
  let bg=document.getElementById('asset-info-modal');
  if(!bg){
    bg=document.createElement('div'); bg.id='asset-info-modal'; bg.className='modal-bg hidden';
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('asset-info-modal', 'File info') : '';
    bg.innerHTML='<div class="modal-card big"><h2>File info'+detachIco+'</h2><div class="modal-body" id="asset-info-body"></div><div class="modal-foot"><button class="tb-btn tb-slate" onclick="closeModal(\'asset-info-modal\')">Close</button></div></div>';
    document.body.appendChild(bg);
  }
  // if this is the SAME asset already loaded (e.g. its audio is still
  // playing in the background from a previous open of this modal), just
  // reopen it as-is rather than rebuilding - rebuilding would tear out and
  // recreate the <audio>/<video> element, resetting playback to the start.
  if(_aiKey===k && bg.dataset.aiKey===k){ bg.classList.remove('hidden'); return; }
  _aiKey=k; bg.dataset.aiKey=k; _aiZoom=100; _aiOpacity=100;

  const url=mediaURL(k), kind=_assetKind(k), ext=_assetExt(k);
  const body=document.getElementById('asset-info-body');
  const meta=_assetMeta(k);
  const embedded=(kind==='image')?_readEmbeddedMeta(k):null;
  const title=(['it','xm','mod','s3m'].includes(ext))?_moduleTitle(url,ext):'';
  const uses=(typeof mediaUsage==='function')?mediaUsage(k).length:0;

  const metaRows=[
    ['Name', escHtml(k.split('/').pop())],
    ['Type', kind+' (.'+ext+')'],
    ['Size', _fmtBytes(_assetBytes(url))],
    ['Added to project', meta&&_fmtWhen(meta.addedAt) ? escHtml(_fmtWhen(meta.addedAt)) : '<span class="hint">unknown (added before this was tracked)</span>'],
    ['File last modified', meta&&_fmtWhen(meta.fileModified) ? escHtml(_fmtWhen(meta.fileModified)) : '<span class="hint">not available for this file</span>'],
  ];
  if(title) metaRows.push(['Embedded title', escHtml(title)]);
  if(meta && meta.ext){
    metaRows.push(['Source', escHtml(meta.ext.sourceLabel||meta.ext.source||'')
      + (meta.ext.commercialOk===false ? ' <span class="asset-badge" style="position:static;background:#ef4444">non-commercial only</span>' : '')]);
    if(meta.ext.author) metaRows.push(['Creator', escHtml(meta.ext.author)]);
    if(meta.ext.license) metaRows.push(['License', escHtml(meta.ext.license)]);
    if(meta.ext.sourceUrl) metaRows.push(['Source page', '<a href="'+escAttr(meta.ext.sourceUrl)+'" target="_blank" rel="noopener">'+escHtml(meta.ext.sourceUrl)+'</a>']);
  }
  if(embedded){
    if(embedded.artist) metaRows.push(['Creator (embedded)', escHtml(embedded.artist)]);
    if(embedded.copyright) metaRows.push(['Copyright (embedded)', escHtml(embedded.copyright)]);
    if(embedded.dateTimeOriginal||embedded.dateTime) metaRows.push(['Date taken/created (embedded)', escHtml(embedded.dateTimeOriginal||embedded.dateTime)]);
    if(embedded.description) metaRows.push(['Description (embedded)', escHtml(embedded.description)]);
    if(embedded.hasGps) metaRows.push(['Location', 'GPS data is embedded in this file (not decoded to coordinates here)']);
  }
  metaRows.push(['Used in', uses+' place'+(uses===1?'':'s')]);

  const canZoom = kind==='image' || kind==='video';
  const zoomCtl = canZoom ? `<div class="ai-ctl"><span>Zoom</span>
      <button class="mini-btn" onclick="aiZoom(-25)" title="Zoom out">−</button>
      <span class="ai-ctl-val">${_aiZoom}%</span>
      <button class="mini-btn" onclick="aiZoom(25)" title="Zoom in">+</button>
      <button class="mini-btn" onclick="aiZoom(0)" title="Reset zoom">reset</button></div>` : '';
  const opacityCtl = (kind==='image') ? `<div class="ai-ctl"><span>Opacity</span>
      <input type="range" min="10" max="100" value="${_aiOpacity}" oninput="aiOpacity(this.value)">
      <span class="ai-ctl-val">${_aiOpacity}%</span></div>` : '';

  const previewHtml = kind==='image'
    ? `<div class="ai-preview" id="ai-preview"><img data-ai-media="image" src="${url}" style="transform:scale(${_aiZoom/100});opacity:${_aiOpacity/100}"></div>`
    : kind==='video'
    ? `<div class="ai-preview" id="ai-preview"><video data-ai-media="video" controls src="${url}" style="transform:scale(${_aiZoom/100})"></video></div>`
    : kind==='audio'
    ? `<div class="ai-preview ai-preview-audio" id="ai-preview"><span class="ai-audio-icon">♪</span><audio data-ai-media="audio" controls src="${url}" style="width:100%"></audio></div>`
    : `<div class="ai-preview ai-preview-none" id="ai-preview">📄 no preview for this file type</div>`;

  body.innerHTML =
    `${previewHtml}
     ${(zoomCtl||opacityCtl)?`<div class="ai-controls">${zoomCtl}${opacityCtl}</div>`:''}
     <div class="ai-meta-grid">${metaRows.map(r=>`<div class="asset-meta"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>
     <div class="hint" style="margin-top:6px">Embedded metadata is read directly from the file (JPEG EXIF, PNG text chunks) when present; most web-sourced images have none.</div>
     <div class="ai-actions">
       <button class="mini-btn" onclick="renameAsset('${k.replace(/'/g,"\\'")}', showAssetInfo)" title="Rename this asset; every scene/character using it stays pointed at it">✎ Rename…</button>
       <button class="mini-btn" onclick="copyAssetToCredits('${k.replace(/'/g,"\\'")}')" title="Add (or update) a credits entry for this asset, using any detected creator/copyright info">+ Copy to credits</button>
       <button class="mini-btn" onclick="closeModal('asset-info-modal'); if(typeof openStorySettings==='function') openStorySettings('info')" title="Open Settings → Info & credits">Credits editor →</button>
     </div>`;

  bg.classList.remove('hidden');
}

function aiZoom(delta){
  _aiZoom = delta===0 ? 100 : Math.max(25, Math.min(400, _aiZoom+delta));
  const el=document.querySelector('#ai-preview img,#ai-preview video');
  if(el) el.style.transform='scale('+(_aiZoom/100)+')';
  const label=document.querySelector('.ai-ctl .ai-ctl-val'); if(label) label.textContent=_aiZoom+'%';
}
function aiOpacity(v){
  _aiOpacity=parseInt(v,10)||100;
  const el=document.querySelector('#ai-preview img');
  if(el) el.style.opacity=(_aiOpacity/100);
  const labels=document.querySelectorAll('.ai-ctl-val'); if(labels[1]) labels[1].textContent=_aiOpacity+'%';
}

/* ---- copy an asset's detected/known authorship into the credits list ----- */
function copyAssetToCredits(k){
  if(typeof ensureProjectInfo==='function') ensureProjectInfo();
  const name=k.split('/').pop();
  const embedded=(_assetKind(k)==='image')?_readEmbeddedMeta(k):null;
  const ext=(_assetMeta(k)||{}).ext;
  const author=(embedded&&(embedded.artist||embedded.copyright))||(ext&&ext.author)||'';
  const source=(ext&&ext.sourceLabel)||'';
  const license=(ext&&ext.license)||'';
  const url=(ext&&ext.sourceUrl)||'';
  let row=(project.credits||[]).find(c=>c.asset===name);
  let wasNew=false;
  if(row){
    if(!row.author && author) row.author=author;
    if(!row.source && source) row.source=source;
    if(!row.license && license) row.license=license;
    if(!row.url && url) row.url=url;
  }
  else { pushUndo(); row={asset:name, author, source, license, url}; project.credits.push(row); wasNew=true; }
  if(typeof renderCredits==='function') renderCredits();
  toast(wasNew ? 'Added to credits' : 'Credits entry updated');
}
