/* ============================================================================
   Scenemaker editor; external asset browser
   Search and import free images, video, music and SFX from Pixabay, Pexels,
   Unsplash, Freesound, Jamendo, Wikimedia Commons, NASA Images, the Met
   Museum, Openverse and the Smithsonian, straight into the project's asset
   library, without ever downloading/bundling any of those files with
   Scenemaker itself. The 5 keyed sources (Pixabay/Pexels/Unsplash/Freesound/
   Jamendo/Smithsonian) each need the user's OWN free API key (Settings ->
   Workspace -> External asset sources), since Scenemaker can't ship a shared
   embedded key without violating every one of those services' terms; the
   rest (Wikimedia/NASA/Met/Openverse) need no key at all (SOURCES[x].
   needsKey===false, read from the backend). All search/download calls are
   proxied through app.py's POST /api/ext_search + GET /api/ext_fetch (or
   app_native.py's ext_search()/ext_fetch() bridge in native mode) rather
   than hitting each service straight from the browser; see ext_assets.py for
   the shared request/response logic and its SSRF host allowlist.

   Freesound and Jamendo are non-commercial-use-only on their free tiers
   (SOURCES[x].commercialOk===false); Openverse is a CC aggregator whose
   license varies PER RESULT (SOURCES.openverse.commercialOk==='mixed', and
   each of its results carries its own commercialOk flag) - the non-
   commercial notice below covers both cases, and per-card badges use a
   result's own flag when one is present, falling back to the source's.

   Once imported, an asset is a completely ordinary project.media entry (same
   media/<slug>.<ext> key convention as any other import) - the only extra is
   attribution recorded onto project.mediaMeta[key].ext (source/author/license/
   sourceUrl/commercialOk), which asset-info.js's file-info modal and "copy to
   credits" both already know to read. Shares core.js scope.
   ==========================================================================*/

const EXT_MEDIA_TYPES = [
  { id:'image', label:'Images', icon:'🖼' },
  { id:'video', label:'Video',  icon:'🎞' },
  { id:'music', label:'Music',  icon:'🎵' },
  { id:'sfx',   label:'SFX',    icon:'🔊' },
];
// only the sources that actually NEED a key belong here (labels/notes come
// from the backend once loaded, so the Settings fields still render before
// the modal's ever been opened) - Wikimedia/NASA/Met/Openverse are keyless.
const EXT_KEY_SOURCES = ['pixabay', 'pexels', 'unsplash', 'freesound', 'jamendo', 'smithsonian'];

let _extSources = null;       // {id: {label, media, keyUrl, commercialOk, note}}, from GET /api/ext_sources
let _extMediaType = 'image';  // one of EXT_MEDIA_TYPES ids ('music'/'sfx' both search media='audio')
let _extSelectedSources = {}; // {sourceId: true}
let _extQuery = '';
let _extPage = 1;
let _extResults = [];         // accumulated across "Load more"
let _extHasMore = false;
let _extBusy = false;

function _extApiMedia(type){ return (type==='music'||type==='sfx') ? 'audio' : type; }
function _extDefaultSources(type){
  if(type==='music') return ['jamendo'];
  if(type==='sfx') return ['freesound'];
  if(type==='video') return ['pixabay', 'pexels'];
  return ['pixabay', 'pexels', 'unsplash'];
}
function _extSourcesForMedia(type){
  const media=_extApiMedia(type);
  if(!_extSources) return [];
  return Object.keys(_extSources).filter(id=>(_extSources[id].media||[]).includes(media));
}
function _extHasKey(id){
  const s=(_extSources && _extSources[id]) || {};
  if(s.needsKey===false) return true; // keyless source (Wikimedia/NASA/Met/Openverse) - nothing to save
  return !!(typeof ToolSettings!=='undefined' && ToolSettings.get('extkey_'+id, ''));
}

function openExternalAssetBrowser(){
  let bg=document.getElementById('ext-asset-modal');
  if(!bg){
    bg=document.createElement('div'); bg.id='ext-asset-modal'; bg.className='modal-bg hidden';
    bg.innerHTML='<div class="modal-card big"><h2>Browse online assets<span class="hdr-icon" onclick="closeModal(\'ext-asset-modal\')" style="color:#ef4444">✕</span></h2>'
      +'<div class="modal-body" id="ext-asset-body"></div>'
      +'<div class="modal-foot"><button class="tb-btn tb-slate" onclick="closeModal(\'ext-asset-modal\')">Close</button></div></div>';
    document.body.appendChild(bg);
  }
  bg.classList.remove('hidden');
  if(!_extSources){
    _extRender(true);
    _extFetchSources().then(()=>{ _extInitSelection(); _extRender(); });
  } else {
    _extRender();
  }
}
function _extFetchSources(){
  if(typeof HAS_BRIDGE==='function' && HAS_BRIDGE()){
    return Promise.resolve(window.pywebview.api.ext_sources()).then(r=>{ _extSources=(r&&r.sources)||{}; }).catch(()=>{ _extSources={}; });
  }
  if(typeof fetch!=='function'){ _extSources={}; return Promise.resolve(); }
  return fetch('/api/ext_sources').then(r=>r.ok?r.json():{sources:{}}).then(r=>{ _extSources=r.sources||{}; }).catch(()=>{ _extSources={}; });
}
function _extInitSelection(){
  _extSelectedSources={};
  _extDefaultSources(_extMediaType).forEach(id=>{ if(_extSources && _extSources[id]) _extSelectedSources[id]=true; });
}
function _extSetMediaType(type){
  _extMediaType=type; _extInitSelection(); _extResults=[]; _extPage=1; _extHasMore=false;
  _extRender();
}
function _extToggleSource(id, on){
  if(on) _extSelectedSources[id]=true; else delete _extSelectedSources[id];
  _extRender();
}
function _extDoSearch(reset){
  const q=(_extQuery||'').trim();
  if(!q){ if(typeof toast==='function') toast('Enter a search term'); return; }
  if(reset){ _extResults=[]; _extPage=1; _extHasMore=false; }
  const selected=Object.keys(_extSelectedSources).filter(id=>_extSelectedSources[id]);
  const withKey=selected.filter(_extHasKey);
  if(!selected.length){ if(typeof toast==='function') toast('Select at least one source'); return; }
  if(!withKey.length){ if(typeof toast==='function') toast('None of the selected sources have a saved API key yet'); return; }
  const media=_extApiMedia(_extMediaType);
  _extBusy=true; _extRender();
  Promise.all(withKey.map(id=>_extSearchOne(id, q, media, _extPage))).then(resultsArr=>{
    resultsArr.forEach(r=>{ if(r && r.ok && Array.isArray(r.results)) _extResults=_extResults.concat(r.results); });
    _extHasMore=resultsArr.some(r=>r && r.ok && r.hasMore);
    const failed=resultsArr.filter(r=>r && r.ok===false && r.message);
    if(failed.length && typeof toast==='function') toast(failed[0].message);
    _extBusy=false; _extRender();
  });
}
function _extSearchOne(source, query, media, page){
  if(typeof HAS_BRIDGE==='function' && HAS_BRIDGE()){
    return Promise.resolve(window.pywebview.api.ext_search(source, query, media, page)).catch(()=>({ok:false}));
  }
  if(typeof fetch!=='function') return Promise.resolve({ok:false});
  return fetch('/api/ext_search', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({source, query, media, page}) })
    .then(r=>r.json()).catch(()=>({ok:false}));
}
function _extLoadMore(){ if(_extBusy) return; _extPage++; _extDoSearch(false); }

function _extRender(loading){
  const body=document.getElementById('ext-asset-body'); if(!body) return;
  if(loading){ body.innerHTML='<div class="hint">Loading sources…</div>'; return; }
  const availSources=_extSourcesForMedia(_extMediaType);
  const tabs=EXT_MEDIA_TYPES.map(t=>`<button class="mini-btn${_extMediaType===t.id?' active':''}" onclick="_extSetMediaType('${t.id}')">${t.icon} ${escHtml(t.label)}</button>`).join('');
  const srcChecks=availSources.map(id=>{
    const s=_extSources[id]||{}; const has=_extHasKey(id); const checked=!!_extSelectedSources[id];
    return `<label class="chk" title="${escAttr(s.note||'')}">
      <input type="checkbox" ${checked?'checked':''} onchange="_extToggleSource('${id}', this.checked)"> ${escHtml(s.label||id)}
      ${has?'':'<span class="hint" style="margin-left:6px">no API key saved &mdash; add one in Settings → Workspace → External asset sources</span>'}
    </label>`;
  }).join('');
  const restricted=Object.keys(_extSelectedSources).map(id=>_extSources[id]).filter(s=>s && (s.commercialOk===false || s.commercialOk==='mixed'));
  const banner=restricted.length ? `<div class="hint" style="background:rgba(239,68,68,.12);border:1px solid #ef4444;border-radius:6px;padding:8px;margin-bottom:10px">
      ⚠ ${restricted.map(s=>escHtml(s.label)).join(', ')} ${restricted.length===1?'has':'may have'} results that are <b>non-commercial use only</b>. A source flagged non-commercial on its whole free tier means every result; a source flagged "mixed" (e.g. Openverse) means it varies per result, check each card's own badge. Don’t use a flagged result in a module that’s sold or distributed commercially unless you get a separate license from that source.</div>` : '';
  body.innerHTML=`
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">${tabs}</div>
    <div class="sec" style="margin-bottom:10px">
      <h3>Sources</h3>
      ${srcChecks || '<div class="hint">No sources support this media type.</div>'}
    </div>
    ${banner}
    <div class="asset-actions" style="margin-bottom:10px">
      <input type="text" id="ext-query" value="${escAttr(_extQuery)}" placeholder="Search…" style="flex:1;min-width:140px;background:var(--field);border:1px solid var(--line);color:var(--ink);padding:7px 9px;border-radius:5px;font-size:13px"
        oninput="_extQuery=this.value" onkeydown="if(event.key==='Enter'){_extDoSearch(true);}">
      <button class="tb-btn tb-emerald" onclick="_extDoSearch(true)" ${_extBusy?'disabled':''}>${_extBusy?'Searching…':'Search'}</button>
    </div>
    <div id="ext-results">${_extResultsHtml()}</div>
    ${(_extResults.length && _extHasMore) ? `<div style="text-align:center;margin-top:10px"><button class="mini-btn" onclick="_extLoadMore()" ${_extBusy?'disabled':''}>Load more</button></div>` : ''}
  `;
}
function _extResultsHtml(){
  if(_extBusy && !_extResults.length) return '<div class="hint">Searching…</div>';
  if(!_extResults.length) return '<div class="hint">No results yet. Pick your sources above and search for something.</div>';
  return `<div class="asset-grid sz-lg">${_extResults.map((r,i)=>_extCardHtml(r,i)).join('')}</div>`;
}
function _extCardHtml(r, i){
  const srcMeta=(_extSources && _extSources[r.source]) || {};
  const preview = r.kind==='image' ? `<img src="${escAttr(r.thumb||r.previewUrl||'')}">`
    : r.kind==='video' ? `<video src="${escAttr(r.previewUrl||'')}" muted loop preload="none" poster="${escAttr(r.thumb||'')}" onmouseover="this.play&&this.play().catch(()=>{})" onmouseout="this.pause&&this.pause()"></video>`
    : '<span style="font-size:26px">♪</span>';
  const audioPrev = r.kind==='audio' && r.previewUrl ? `<audio controls src="${escAttr(r.previewUrl)}" style="width:100%;margin-top:4px"></audio>` : '';
  const licenseLine = r.license ? `<div class="hint">${escHtml(r.license)}</div>` : '';
  // a per-result flag (Openverse, whose license/commercial-OK-ness varies
  // per item since it aggregates many providers) always wins over the
  // source-level default when present; see SOURCES[x].commercialOk==='mixed'.
  const commercialOk = (typeof r.commercialOk==='boolean') ? r.commercialOk : (srcMeta.commercialOk!==false);
  const commercialBadge = commercialOk ? '' : '<span class="asset-badge" style="position:static;background:#ef4444;margin-top:2px;display:inline-block">non-commercial only</span>';
  const importBtn = r._imported
    ? '<span class="hint" style="color:var(--accent)">Imported ✓</span>'
    : `<button class="mini-btn" onclick="_extImport(${i}, event)">+ Import</button>`;
  return `<div class="asset-cell" style="text-align:left;cursor:default">
    <div class="asset-thumb" style="height:70px">${preview}</div>
    ${audioPrev}
    <div class="asset-name" title="${escAttr(r.title||'')}">${escHtml(r.title||'(untitled)')}</div>
    <div class="hint">by ${escHtml(r.author||'unknown')} &middot; ${escHtml(srcMeta.label||r.source||'')}</div>
    ${licenseLine}${commercialBadge}
    <div style="margin-top:4px">${importBtn}</div>
  </div>`;
}

function _extExtFromUrl(url, kind){
  try{
    const clean=String(url||'').split('?')[0].split('#')[0];
    const dot=clean.lastIndexOf('.'), slash=clean.lastIndexOf('/');
    if(dot>slash && dot>=0){ const e=clean.slice(dot+1).toLowerCase(); if(e && e.length<=4) return e; }
  }catch(e){}
  return kind==='image' ? 'jpg' : kind==='video' ? 'mp4' : 'mp3';
}
function _extSlugTitle(t){
  return String(t||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
}
function _extFetchAsset(url, ping, source){
  if(typeof HAS_BRIDGE==='function' && HAS_BRIDGE()){
    return Promise.resolve(window.pywebview.api.ext_fetch(url, ping||null, source||null)).then(r=>(r&&r.ok)?r.dataUrl:null).catch(()=>null);
  }
  if(typeof fetch!=='function') return Promise.resolve(null);
  let u='/api/ext_fetch?url='+encodeURIComponent(url);
  if(ping) u+='&ping='+encodeURIComponent(ping);
  // Openverse's own asset URLs span dozens of federated CDN hosts unknown in
  // advance (it's itself an aggregator) - fetch_asset() only applies its
  // public-IP-based SSRF check (instead of the static host allowlist every
  // other source uses) when it's told the result actually came from there.
  if(source) u+='&source='+encodeURIComponent(source);
  return fetch(u).then(r=>{
    if(!r.ok) return null;
    return r.blob().then(blob=>new Promise(res=>{
      const rd=new FileReader();
      rd.onload=()=>res(rd.result);
      rd.onerror=()=>res(null);
      rd.readAsDataURL(blob);
    }));
  }).catch(()=>null);
}
function _extImport(i, ev){
  const r=_extResults[i]; if(!r || r._imported) return Promise.resolve();
  const btn=ev && ev.target; if(btn) btn.disabled=true;
  return _extFetchAsset(r.fileUrl, r.downloadPing, r.source).then(dataUrl=>{
    if(!dataUrl){ if(typeof toast==='function') toast('Import failed; try again'); if(btn) btn.disabled=false; return; }
    pushUndo();
    const ext=_extExtFromUrl(r.fileUrl, r.kind);
    const name=(_extSlugTitle(r.title)||r.kind||'asset')+'.'+ext;
    const key=makeKey(name, null);
    project.media[key]=dataUrl;
    const srcMeta=(_extSources && _extSources[r.source]) || {};
    if(!project.mediaMeta) project.mediaMeta={};
    if(!project.mediaMeta[key]) project.mediaMeta[key]={};
    project.mediaMeta[key].ext={
      source: r.source, sourceLabel: srcMeta.label||r.source,
      author: r.author||'', sourceUrl: r.sourceUrl||'', license: r.license||'',
      commercialOk: (typeof r.commercialOk==='boolean') ? r.commercialOk : (srcMeta.commercialOk!==false),
    };
    r._imported=true;
    _assetSel=key;
    if(typeof renderAssetsPanel==='function') renderAssetsPanel();
    if(typeof toast==='function') toast('Imported "'+name+'" into the asset library');
    _extRender();
  });
}

/* ---- Settings -> Workspace: per-source API key fields --------------------- */
function extKeyFor(id){ return (typeof ToolSettings!=='undefined') ? ToolSettings.get('extkey_'+id, '') : ''; }
function setExtKey(id, val){ if(typeof ToolSettings!=='undefined') ToolSettings.set('extkey_'+id, (val||'').trim()); }
function loadExtKeysUI(){
  EXT_KEY_SOURCES.forEach(id=>{ const el=document.getElementById('ws-extkey-'+id); if(el) el.value=extKeyFor(id); });
}
