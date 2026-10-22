/* ============================================================================
   Scenemaker editor; Assets panel  (feature #12)
   A dockable library of every media asset in the project. Browse, add assets
   (without linking), see details (type/size/length/resolution) and where each
   is used (click to jump), and clean up unused assets. Shares core.js scope.
   ==========================================================================*/
let _assetSel=null;
let _assetSearchQuery='';
function openAssetsPanel(){ if(typeof openDock==='function') openDock('assets'); if(typeof maybeShowMini==='function') maybeShowMini('assets'); }
/* typing in the search box only re-renders the results (#asset-body), never
   the search input itself - a full renderAssetsPanel() on every keystroke
   would rebuild the <input> and drop focus/cursor position mid-word. The
   clear button's shown/hidden state is toggled directly for the same
   reason, rather than re-rendering the head that contains it. */
function setAssetSearchQuery(v){
  _assetSearchQuery=v;
  const clearBtn=document.getElementById('asset-search-clear');
  if(clearBtn) clearBtn.style.display=v?'':'none';
  _assetsRenderBody();
}
function _assetsFilteredKeys(){
  const keys=Object.keys(project.media||{});
  const q=_assetSearchQuery.trim().toLowerCase();
  if(!q) return keys;
  return keys.filter(k=>k.split('/').pop().toLowerCase().includes(q));
}
function _assetExt(k){ const d=k.lastIndexOf('.'); return d>=0?k.slice(d+1).toLowerCase():'?'; }
function _assetKind(k){ const e=_assetExt(k);
  if(['png','jpg','jpeg','gif','webp','svg','bmp'].includes(e)) return 'image';
  if(['mp3','wav','ogg','oga','m4a','aac','flac','opus','weba'].includes(e)) return 'audio';
  if(['mp4','webm','mov','ogv'].includes(e)) return 'video';
  return 'file'; }
function _assetBytes(dataUrl){ if(!dataUrl) return 0; const i=dataUrl.indexOf(','); const b=i>=0?dataUrl.slice(i+1):dataUrl;
  return Math.round(b.length*3/4 - (b.endsWith('==')?2:b.endsWith('=')?1:0)); }
function _fmtBytes(n){ if(n<1024) return n+' B'; if(n<1048576) return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(2)+' MB'; }

/* #70: how the library lays itself out - a grid of icons (default, at a
   chosen size), a compact single-column list, or a details table with a
   Size/Used-in column. Per-computer preference, like the theme picker's own
   grid/list toggle. */
function assetsViewMode(){ return (typeof ToolSettings!=='undefined') ? ToolSettings.get('assetsViewMode','grid') : 'grid'; }
function setAssetsViewMode(mode){ if(typeof ToolSettings!=='undefined') ToolSettings.set('assetsViewMode', mode); renderAssetsPanel(); }
function assetsIconSize(){ return (typeof ToolSettings!=='undefined') ? ToolSettings.get('assetsIconSize','md') : 'md'; }
function setAssetsIconSize(sz){ if(typeof ToolSettings!=='undefined') ToolSettings.set('assetsIconSize', sz); renderAssetsPanel(); }

function renderAssetsPanel(){
  const box=document.getElementById('assets-list'); if(!box) return;
  const mode=assetsViewMode(), sz=assetsIconSize();
  const viewBtn=(m,label,title)=>`<button class="asset-view-btn${mode===m?' active':''}" onclick="setAssetsViewMode('${m}')" title="${title}">${label}</button>`;
  const szBtn=(s,label)=>`<button class="asset-view-btn${sz===s?' active':''}" onclick="setAssetsIconSize('${s}')" title="Icon size">${label}</button>`;
  box.innerHTML=`<div class="asset-actions">
      <button class="mini-btn" onclick="addAssetsToLibrary()" title="Add images, audio and video (select several at once)">+ add media</button>
      <button class="mini-btn" onclick="openExternalAssetBrowser&&openExternalAssetBrowser()" title="Search and import free images, video, music and SFX from Pixabay, Pexels, Unsplash, Freesound and Jamendo">🌐 browse online</button>
      <button class="mini-btn" onclick="openSoundStudio&&openSoundStudio()" title="Record or edit a sound clip">🎙 record / edit</button>
      <button class="mini-btn" onclick="openImageStudio&&openImageStudio()" title="Crop, rotate, flip or adjust an image">🖼 edit image</button>
      <button class="mini-btn warn" onclick="cleanupUnusedAssets()" title="Delete every asset not used anywhere">🧹 cleanup unused</button>
      <button class="mini-btn" onclick="dedupeAssets()" title="Find identical files and merge them into one">⧉ merge duplicates</button>
    </div>
    <div class="asset-actions" style="margin-top:4px">
      <input type="text" id="asset-search" value="${escAttr(_assetSearchQuery)}" placeholder="Search assets by name…" oninput="setAssetSearchQuery(this.value)" style="flex:1;min-width:110px;background:var(--field);border:1px solid var(--line);color:var(--ink);padding:5px 8px;border-radius:4px;font-size:12px">
      <button class="mini-btn" id="asset-search-clear" onclick="document.getElementById('asset-search').value='';setAssetSearchQuery('')" title="Clear search" ${_assetSearchQuery?'':'style="display:none"'}>✕</button>
    </div>
    <div class="asset-actions" style="margin-top:4px">
      <span class="hint" style="margin-right:2px">View</span>
      ${viewBtn('grid','▦ Grid','Icon grid')}${viewBtn('list','☰ List','Compact list')}${viewBtn('details','▤ Details','Table with size and usage')}
      ${mode==='grid'?`<span class="hint" style="margin-left:8px;margin-right:2px">Size</span>${szBtn('sm','S')}${szBtn('md','M')}${szBtn('lg','L')}`:''}
    </div>
    <div id="asset-body"></div>`;
  _assetsRenderBody();
}
/* the results themselves: a search keystroke calls only this, never
   renderAssetsPanel(), so the search input above is never rebuilt mid-word. */
function _assetsRenderBody(){
  const body=document.getElementById('asset-body'); if(!body) return;
  const allKeys=Object.keys(project.media||{});
  if(!allKeys.length){ body.innerHTML='<div class="hint">No assets yet. Add some above, or they appear here as you use images, audio and video in your story.</div>'; return; }
  const keys=_assetsFilteredKeys();
  if(!keys.length){ body.innerHTML=`<div class="hint">No assets match "${escHtml(_assetSearchQuery)}".</div>`; return; }
  const used=(typeof allUsedMedia==='function')?allUsedMedia():new Set();
  const mode=assetsViewMode(), sz=assetsIconSize();
  const common=(k)=>{ const kk=k.replace(/'/g,"\\'");
    return `draggable="true" ondragstart="assetDragStart(event,'${kk}')" onclick="selectAsset('${kk}')" ondblclick="showAssetInfo('${kk}')" oncontextmenu="assetContextMenu(event,'${kk}')" title="${escAttr(k.split('/').pop())} (double-click for file info, right-click for more, drag onto a slot to assign it)"`; };
  let html;
  if(mode==='list'){
    const rows=keys.map(k=>{ const kind=_assetKind(k); const url=mediaURL(k); const isUsed=used.has(k);
      const thumb = kind==='image' ? `<img src="${url}">` : (kind==='audio'?'♪':(kind==='video'?'🎞':'📄'));
      return `<div class="asset-row${_assetSel===k?' sel':''}${isUsed?'':' unused'}" ${common(k)}>
        <span class="asset-row-thumb">${thumb}</span><span class="asset-row-name">${escHtml(k.split('/').pop())}</span>
        <span class="asset-row-kind">${kind}</span>${isUsed?'':'<span class="asset-badge" style="position:static">unused</span>'}</div>`; }).join('');
    html=`<div class="asset-list">${rows}</div>`;
  } else if(mode==='details'){
    const rows=keys.map(k=>{ const kind=_assetKind(k); const url=mediaURL(k); const isUsed=used.has(k);
      const thumb = kind==='image' ? `<img src="${url}">` : (kind==='audio'?'♪':(kind==='video'?'🎞':'📄'));
      const uses=(typeof mediaUsage==='function')?mediaUsage(k).length:0;
      return `<tr class="${_assetSel===k?'sel':''}${isUsed?'':' unused'}" ${common(k)}>
        <td><span class="asset-row-thumb">${thumb}</span></td>
        <td>${escHtml(k.split('/').pop())}</td>
        <td>${kind} (.${_assetExt(k)})</td>
        <td>${_fmtBytes(_assetBytes(url))}</td>
        <td>${uses} place${uses===1?'':'s'}${isUsed?'':' <span class="hint">(unused)</span>'}</td>
      </tr>`; }).join('');
    html=`<div style="overflow-x:auto"><table class="asset-table"><thead><tr><th></th><th>Name</th><th>Type</th><th>Size</th><th>Used</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else {
    const cells=keys.map(k=>{ const kind=_assetKind(k); const url=mediaURL(k); const isUsed=used.has(k);
      const thumb = kind==='image' ? `<img src="${url}">` : (kind==='audio'?'♪':(kind==='video'?'🎞':'📄'));
      return `<div class="asset-cell${_assetSel===k?' sel':''}${isUsed?'':' unused'}" ${common(k)}>
        <div class="asset-thumb">${thumb}</div><div class="asset-name">${escHtml(k.split('/').pop())}</div>${isUsed?'':'<span class="asset-badge">unused</span>'}</div>`; }).join('');
    html=`<div class="asset-grid sz-${sz}">${cells}</div>`;
  }
  body.innerHTML=html+'<div id="asset-detail"></div>';
  if(_assetSel && project.media[_assetSel]) renderAssetDetail();
}
function selectAsset(k){ _assetSel=(_assetSel===k?null:k); renderAssetsPanel(); }
/* right-click on an asset cell: preview, jump into Sound Studio for audio, file info, delete */
function assetContextMenu(e,k){
  e.preventDefault(); e.stopPropagation();
  if(typeof showContextMenu!=='function') return;
  const kind=_assetKind(k);
  const items=[ { icon:'▶', label:'Preview', onClick:()=>previewAssetInPanel(k) } ];
  if(kind==='audio') items.push({ icon:'🎙', label:'Edit in Sound Studio…', onClick:()=>{ if(typeof openSoundStudioWithAsset==='function') openSoundStudioWithAsset(k); } });
  if(kind==='image') items.push({ icon:'🖼', label:'Edit in Image Studio…', onClick:()=>{ if(typeof openImageStudioWithAsset==='function') openImageStudioWithAsset(k); } });
  items.push({ sep:true });
  items.push({ icon:'✎', label:'Rename…', onClick:()=>renameAsset(k) });
  items.push({ icon:'ⓘ', label:'File info…', onClick:()=>showAssetInfo(k) });
  items.push({ icon:'✕', label:'Delete', onClick:()=>deleteAsset(k) });
  showContextMenu(e.clientX, e.clientY, items);
}
/* select the asset (always, not a toggle) and start playing its preview if it's audio/video */
function previewAssetInPanel(k){
  _assetSel=k; renderAssetsPanel();
  const box=document.getElementById('asset-detail'); if(!box) return;
  box.scrollIntoView({block:'nearest'});
  const media=box.querySelector('audio,video'); if(media&&media.play) media.play().catch(()=>{});
}
function renderAssetDetail(){
  const box=document.getElementById('asset-detail'); if(!box||!_assetSel) return;
  const k=_assetSel, kind=_assetKind(k), url=mediaURL(k);
  const size=_fmtBytes(_assetBytes(url));
  const uses=(typeof mediaUsage==='function')?mediaUsage(k):[];
  const preview = kind==='image' ? `<div class="asset-preview"><img src="${url}"></div>`
    : kind==='audio' ? `<div class="asset-preview"><audio controls src="${url}" style="width:100%"></audio></div>`
    : kind==='video' ? `<div class="asset-preview"><video controls src="${url}" style="max-width:100%;max-height:180px;border-radius:6px"></video></div>` : '';
  box.innerHTML=`<div class="asset-detail-card">
    <div class="prop-h">${escHtml(k.split('/').pop())} <span class="asset-i" title="File info" onclick="showAssetInfo('${k.replace(/'/g,"\\'")}')">\u24D8</span></div>
    ${preview}
    <div class="asset-meta"><span>Type</span><b>${kind} (.${_assetExt(k)})</b></div>
    <div class="asset-meta"><span>Size</span><b>${size}</b></div>
    <div class="asset-meta" id="asset-dims"><span>${kind==='audio'?'Length':'Resolution'}</span><b>reading…</b></div>
    <div class="asset-uses-h">Used in ${uses.length} place${uses.length===1?'':'s'}</div>
    ${usageListHtml(uses)}
    <div style="margin-top:8px"><button class="mini-btn warn" onclick="deleteAsset('${k.replace(/'/g,"\\'")}')">Delete this asset</button></div>
  </div>`;
  // async dims/length
  const dimEl=()=>document.getElementById('asset-dims');
  if(kind==='image'){ const img=new Image(); img.onload=()=>{ const e=dimEl(); if(e) e.innerHTML='<span>Resolution</span><b>'+img.naturalWidth+' × '+img.naturalHeight+'</b>'; }; img.onerror=()=>{ const e=dimEl(); if(e)e.innerHTML='<span>Resolution</span><b>?</b>'; }; img.src=url; }
  else if(kind==='audio'||kind==='video'){ const m=document.createElement(kind==='audio'?'audio':'video'); m.preload='metadata';
    m.onloadedmetadata=()=>{ const e=dimEl(); if(e){ const secs=m.duration||0; const mm=Math.floor(secs/60), ss=Math.round(secs%60); e.innerHTML='<span>Length</span><b>'+mm+':'+String(ss).padStart(2,'0')+(kind==='video'&&m.videoWidth?(' · '+m.videoWidth+'×'+m.videoHeight):'')+'</b>'; } };
    m.onerror=()=>{ const e=dimEl(); if(e)e.innerHTML='<span>Length</span><b>?</b>'; }; m.src=url; }
  else { const e=dimEl(); if(e) e.innerHTML='<span>Info</span><b>?</b>'; }
}
function addAssetToLibrary(kind){ pickMedia(kind).then(k=>{ if(k){ pushUndo(); _assetSel=k; renderAssetsPanel(); toast('Asset added to the library'); } }); }
function deleteAsset(k){ const uses=(typeof mediaUsage==='function')?mediaUsage(k):[];
  const msg = uses.length ? `This asset is used in <b>${uses.length}</b> place${uses.length===1?'':'s'}. Deleting it will leave those blank. Delete anyway?` : 'Delete this unused asset?';
  uiConfirm(msg, ()=>{ pushUndo(); delete project.media[k]; if(_assetSel===k)_assetSel=null; renderAssetsPanel(); renderScenes(); toast('Asset deleted'); }, {yes:'Delete', no:'Cancel'}); }
function cleanupUnusedAssets(){
  const keys=Object.keys(project.media||{}); const used=(typeof allUsedMedia==='function')?allUsedMedia():new Set();
  const unused=keys.filter(k=>!used.has(k));
  if(!unused.length){ toast('No unused assets to clean up'); return; }
  if(typeof ToolSettings!=='undefined' && ToolSettings.get('skipCleanupWarn','0')==='1'){ _doCleanup(unused); return; }
  uiConfirm(`Delete <b>${unused.length}</b> unused asset${unused.length===1?'':'s'} from the project? This removes files that aren\u2019t referenced anywhere and can\u2019t be undone except with Ctrl+Z.`,
    ()=>_doCleanup(unused),
    { yes:'Delete unused', no:'Cancel', checkbox:{ label:'Don\u2019t warn me next time', onChecked:()=>{ if(typeof ToolSettings!=='undefined') ToolSettings.set('skipCleanupWarn','1'); } } });
}
function _doCleanup(unused){ pushUndo(); unused.forEach(k=>delete project.media[k]); if(_assetSel&&unused.includes(_assetSel))_assetSel=null; renderAssetsPanel(); toast('Removed '+unused.length+' unused asset'+(unused.length===1?'':'s')); }

/* #11: find exact-duplicate assets (identical data), keep one, re-point references */
function _remapMediaKey(oldKey,newKey){
  function walk(o){ if(Array.isArray(o)){ o.forEach(walk); }
    else if(o && typeof o==='object'){ Object.keys(o).forEach(kk=>{ if((kk==='media'||kk==='mediaRaw')&&o[kk]===oldKey) o[kk]=newKey; else walk(o[kk]); }); } }
  Object.values(scenes).forEach(walk); (project.characters||[]).forEach(walk); if(project.title) walk(project.title);
}
function dedupeAssets(){
  const keys=Object.keys(project.media||{}); const byVal={}; const dups=[];
  keys.forEach(k=>{ const v=project.media[k]; if(byVal[v]!=null){ dups.push([k, byVal[v]]); } else byVal[v]=k; });
  if(!dups.length){ toast('No exact-duplicate assets found'); return; }
  uiConfirm(`Found <b>${dups.length}</b> duplicate file${dups.length===1?'':'s'}. Merge each into the copy that\u2019s kept and re-point everything that used it?`,
    ()=>{ pushUndo(); dups.forEach(([dup,keep])=>{ _remapMediaKey(dup,keep); delete project.media[dup]; if(_assetSel===dup)_assetSel=keep; });
      renderAssetsPanel(); renderScenes(); toast('Merged '+dups.length+' duplicate'+(dups.length===1?'':'s')); },
    { yes:'Merge duplicates', no:'Cancel' });
}
/* #69: rename an asset. Media keys ARE their identity (project.media maps
   media/<slug>.<ext> -> data URL, and every reference elsewhere in the
   project points at that exact string per CLAUDE.md's media convention), so
   "renaming" means minting a new key, moving the data over, and re-pointing
   every reference via the same _remapMediaKey() dedupeAssets() already uses
   - not just relabeling something cosmetic. The extension is kept fixed
   (changing it wouldn't change the actual file format) and the new name is
   slugged/deduped the same way makeKey() would for a freshly imported file,
   so a collision auto-suffixes instead of silently overwriting a different
   asset. onRenamed(newKey), if given, lets a caller (the file-info modal)
   refresh itself onto the new key instead of going stale. */
function _assetSlug(name){
  return String(name||'').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'asset';
}
function renameAsset(oldKey, onRenamed){
  if(!project.media || !project.media[oldKey]) return;
  const ext=_assetExt(oldKey);
  const curBase=oldKey.split('/').pop().replace(new RegExp('\\.'+ext.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i'),'');
  uiPromptText('Rename asset (the file extension stays .'+ext+'):', curBase, (raw)=>{
    const slug=_assetSlug(raw);
    let newKey='media/'+slug+'.'+ext;
    if(newKey===oldKey) return; // no real change
    if(project.media[newKey]){
      let n=2; while(project.media['media/'+slug+'-'+n+'.'+ext]) n++;
      newKey='media/'+slug+'-'+n+'.'+ext;
    }
    pushUndo();
    project.media[newKey]=project.media[oldKey];
    delete project.media[oldKey];
    _remapMediaKey(oldKey,newKey);
    if(_assetSel===oldKey) _assetSel=newKey;
    renderAssetsPanel(); renderScenes();
    toast('Renamed to "'+newKey.split('/').pop()+'"');
    onRenamed && onRenamed(newKey);
  }, { yes:'Rename', validate:(v)=>(!v||!v.trim())?'Enter a name.':null });
}

/* #19: the richer double-click "file info" modal (preview, dates, embedded
   authorship metadata, credits) now lives in its own module - see
   asset-info.js for showAssetInfo() and everything that feeds it. */

function addAssetsToLibrary(){ pickMediaMulti().then(keys=>{ if(keys&&keys.length){ pushUndo(); _assetSel=keys[keys.length-1]; renderAssetsPanel(); toast('Added '+keys.length+' asset'+(keys.length===1?'':'s')); } }); }
// #107: dropping one or more real OS files anywhere on the Assets panel
// (not onto a specific slot elsewhere in the app) imports all of them
// straight into the library, the same as "+ add media" but without the
// file-picker dialog. An asset tile dragged from inside the panel itself
// has nowhere useful to go if dropped back onto the panel it came from, so
// that case is left alone.
function dropToLibrary(e){
  e.preventDefault();
  if(e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.remove('drop-hover');
  if(!e.dataTransfer || e.dataTransfer.getData(ASSET_DRAG_MIME)) return;
  const files=Array.prototype.slice.call(e.dataTransfer.files||[]);
  if(!files.length) return;
  pushUndo();
  const added=[]; let pending=files.length;
  const done=()=>{ _assetSel=added[added.length-1]||_assetSel; renderAssetsPanel(); toast('Added '+added.length+' asset'+(added.length===1?'':'s')); };
  files.forEach(f=>{
    const rd=new FileReader();
    rd.onload=()=>{ const key=makeKey(f.name,f); project.media[key]=rd.result; added.push(key); if(--pending===0) done(); };
    rd.onerror=()=>{ if(--pending===0) done(); };
    rd.readAsDataURL(f);
  });
}
