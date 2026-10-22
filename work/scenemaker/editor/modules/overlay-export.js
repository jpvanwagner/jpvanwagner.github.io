/* ============================================================================
   Scenemaker editor; Overlay/popup embed export
   Builds the full player (portraits, backgrounds, layout, dice - everything
   SCORM/Preview already support) as ONE self-contained HTML file meant to
   run as a layer on top of another page or game instead of filling its own
   tab: a full-screen overlay (the host page/game shows through behind it) or
   a small centered modal popup. window.VN_OVERLAY_OPTS, injected at export
   time, is read by player/overlay.js at load, which also reports back
   {endingId, title, vars} over postMessage (or straight to a mount() call's
   own onEnd) once a run ends - see that file's own header for the full
   contract.
   Needs a server/native round trip (scorm.py's build_overlay_html(), the
   same builder SCORM/Preview already use) rather than lite-export.js's pure
   client-side rebuild, since it reuses that same full-player assembly; the
   modal below has its own explicit "Build / refresh" step instead of
   lite-export's instant-on-every-keystroke live view for exactly that
   reason. Shares core.js/export-modal.js scope.
   ==========================================================================*/
let _overlayCurrentHtml = null;

const OVERLAY_HINT_HTML = '<p>The full player - portraits, backgrounds, layout, dice, everything SCORM/Preview already support - as ONE self-contained HTML file, meant to run as a layer on top of another page or game instead of filling its own tab.</p>'
  + '<p><b>Full-screen overlay:</b> fills the screen; wherever a scene has no background of its own, the host page/game shows through. <b>Modal popup:</b> a small centered box with its own backdrop - pick a width/height below.</p>'
  + '<p>Drop the downloaded file into your game’s own asset folder and point an &lt;iframe&gt; at it (the “Copy host-page loader snippet” button below gives a ready-to-paste open/close helper), or, for a same-origin host page that would rather skip the iframe, load the file’s own script directly and call <code>VNOverlay.mount(container, opts)</code>. Either way, reaching an ending reports back <code>{endingId, title, vars}</code> (over <code>postMessage</code> for the iframe case, straight to <code>opts.onEnd</code> for mount()), so the host can resume its own game and react to how the run went.</p>';

const OVERLAY_LOADER_SNIPPET = '<div id="scenemaker-host" style="display:none"></div>\n'
  + '<script>\n'
  + 'function openScenemakerOverlay(url, onEnd){\n'
  + '  var host = document.getElementById(\'scenemaker-host\');\n'
  + '  host.style.display = \'block\';\n'
  + '  var ifr = document.createElement(\'iframe\');\n'
  + '  ifr.src = url;\n'
  + '  ifr.style.cssText = \'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9999\';\n'
  + '  host.appendChild(ifr);\n'
  + '  function onMsg(e){\n'
  + '    if(!e.data || e.data.source!==\'scenemaker-embed\' || e.data.type!==\'ended\') return;\n'
  + '    window.removeEventListener(\'message\', onMsg);\n'
  + '    host.removeChild(ifr);\n'
  + '    host.style.display = \'none\';\n'
  + '    onEnd && onEnd(e.data);\n'
  + '  }\n'
  + '  window.addEventListener(\'message\', onMsg);\n'
  + '}\n'
  + '</script>';

function _overlayReadOptions(){
  const g=id=>document.getElementById(id);
  return {
    mode: g('ov-opt-mode') ? g('ov-opt-mode').value : 'fullscreen',
    dim: g('ov-opt-dim') ? g('ov-opt-dim').checked : true,
    dimAlpha: g('ov-opt-dimalpha') ? Number(g('ov-opt-dimalpha').value) : 60,
    hidePortraits: g('ov-opt-noportraits') ? g('ov-opt-noportraits').checked : false,
    modalWidth: g('ov-opt-mw') ? Number(g('ov-opt-mw').value) : 70,
    modalHeight: g('ov-opt-mh') ? Number(g('ov-opt-mh').value) : 70,
  };
}
function _overlayQueryString(o){
  return 'mode='+encodeURIComponent(o.mode)+'&dim='+(o.dim?'1':'0')+'&dimAlpha='+encodeURIComponent(o.dimAlpha)
    +'&hidePortraits='+(o.hidePortraits?'1':'0')+'&modalWidth='+encodeURIComponent(o.modalWidth)+'&modalHeight='+encodeURIComponent(o.modalHeight);
}

async function _overlayBuild(){
  if(!Object.keys(scenes).length){ toast('Add at least one scene first'); return; }
  if(!project.settings.startScene){ toast('Set a start scene in ⚙️ SETTINGS first'); return; }
  const opts=_overlayReadOptions();
  const box=document.getElementById('overlay-export-code');
  if(HAS_BRIDGE()){
    toast('Building overlay embed…');
    const r=await window.pywebview.api.build_overlay_preview(projectForDisk(), opts);
    if(r&&r.ok){ _overlayCurrentHtml=r.html; if(box) _codeViewRender(box,_overlayCurrentHtml); toast('Built'); }
    else toast((r&&r.error)||'Build failed');
  } else if(HAS_SERVER()){
    try{
      toast('Building overlay embed…');
      const res=await fetch('/api/overlay_export?'+_overlayQueryString(opts),{method:'POST',headers:{'Content-Type':'application/json'},body:projectForDisk()});
      if(!res.ok) throw new Error('server '+res.status);
      _overlayCurrentHtml=await res.text();
      if(box) _codeViewRender(box,_overlayCurrentHtml);
      toast('Built');
    }catch(err){ toast('Build failed: '+err.message); }
  } else toast('Overlay export needs the local helper; launch via app.py / run_scenemaker.bat.');
}

function openOverlayExportModal(){
  let bg=document.getElementById('overlay-export-modal');
  if(!bg){
    bg=document.createElement('div'); bg.id='overlay-export-modal'; bg.className='modal-bg hidden';
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('overlay-export-modal', 'Overlay / popup embed') : '';
    bg.innerHTML='<div class="modal-card" style="max-width:640px"><h2>Overlay / popup embed'+detachIco+'</h2>'
      + '<div class="modal-body">'
      + '<div class="hint" style="margin-bottom:10px">'+OVERLAY_HINT_HTML+'</div>'
      + '<div class="rowflex"><div class="fld"><label>Mode</label><select id="ov-opt-mode" onchange="_overlayModeChanged();_overlayBuild()">'
      +   '<option value="fullscreen">Full-screen overlay</option>'
      +   '<option value="modal">Modal popup</option>'
      + '</select></div></div>'
      + '<label class="chk" title="A dark layer behind the scene, so a scene with no background of its own still reads clearly over whatever the host page/game looks like"><input type="checkbox" id="ov-opt-dim" checked onchange="_overlayDimChanged();_overlayBuild()"> Dim backdrop</label>'
      + '<div id="ov-dimalpha-row" class="rowflex"><div class="fld"><label>Dim amount</label>'
      +   '<input type="range" id="ov-opt-dimalpha" min="0" max="100" step="5" value="60" oninput="document.getElementById(\'ov-dimalpha-val\').textContent=this.value+\'%\'" onchange="_overlayBuild()"> <span id="ov-dimalpha-val">60%</span></div></div>'
      + '<label class="chk" title="Hide portraits regardless of this project’s own layout - useful for a small popup with no room for them"><input type="checkbox" id="ov-opt-noportraits" onchange="_overlayBuild()"> Hide portraits</label>'
      + '<div id="ov-modal-size-row" class="rowflex" style="display:none">'
      +   '<div class="fld"><label>Width</label><input type="range" id="ov-opt-mw" min="20" max="100" step="5" value="70" oninput="document.getElementById(\'ov-mw-val\').textContent=this.value+\'%\'" onchange="_overlayBuild()"> <span id="ov-mw-val">70%</span></div>'
      +   '<div class="fld"><label>Height</label><input type="range" id="ov-opt-mh" min="20" max="100" step="5" value="70" oninput="document.getElementById(\'ov-mh-val\').textContent=this.value+\'%\'" onchange="_overlayBuild()"> <span id="ov-mh-val">70%</span></div>'
      + '</div>'
      + '<div style="margin:10px 0"><button class="tb-btn tb-accent" onclick="_overlayBuild()">🔨 Build / refresh preview</button></div>'
      + '<div class="cv-wrap" id="overlay-export-code" style="height:220px"></div>'
      + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'
      + '<button class="tb-btn tb-accent" onclick="_overlayCopyToClipboard()">📋 Copy to clipboard</button>'
      + '<button class="tb-btn" onclick="_overlayDownload()">⬇ Download .html</button>'
      + '<button class="tb-btn" onclick="_overlayOpenPreviewTab()">▶ Preview</button>'
      + '<button class="tb-btn" onclick="_overlayCopyLoaderSnippet()">📋 Copy host-page loader snippet</button>'
      + '</div></div>'
      + '<div class="modal-foot"><button class="tb-btn tb-slate" onclick="closeModal(\'overlay-export-modal\')">Close</button></div></div>';
    document.body.appendChild(bg);
  }
  bg.classList.remove('hidden');
  _overlayModeChanged();
  _overlayDimChanged();
  _overlayBuild();
}
function _overlayModeChanged(){
  const sel=document.getElementById('ov-opt-mode'), row=document.getElementById('ov-modal-size-row');
  if(row) row.style.display = (sel && sel.value==='modal') ? 'flex' : 'none';
}
function _overlayDimChanged(){
  const chk=document.getElementById('ov-opt-dim'), row=document.getElementById('ov-dimalpha-row');
  if(row) row.style.display = (chk && chk.checked) ? 'flex' : 'none';
}
// Copies the RAW export string (never the highlighted/line-numbered markup
// _codeViewRender() builds for on-screen display only) - same pattern as
// lite-export.js's own _liteCopyToClipboard/_liteCopyViaHiddenTextarea,
// reimplemented here rather than shared since the two modals track separate
// "current built HTML" state.
function _overlayCopyToClipboard(){
  if(_overlayCurrentHtml==null){ toast('Build it first'); return; }
  const finish=()=>toast('Copied to clipboard');
  try{ navigator.clipboard.writeText(_overlayCurrentHtml).then(finish).catch(()=>_overlayCopyViaHiddenTextarea(_overlayCurrentHtml,finish)); }
  catch(e){ _overlayCopyViaHiddenTextarea(_overlayCurrentHtml,finish); }
}
function _overlayCopyViaHiddenTextarea(text,onOk){
  try{
    const ta=document.createElement('textarea');
    ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    onOk();
  }catch(e){ toast('Copy failed; select the text manually'); }
}
function _overlayOpenPreviewTab(){
  if(_overlayCurrentHtml==null){ toast('Build it first'); return; }
  try{ const w=window.open('', '_blank'); if(!w){ toast('Allow pop-ups to preview the export'); return; } w.document.write(_overlayCurrentHtml); w.document.close(); }
  catch(e){ toast('Preview failed to open'); }
}
// Unlike lite-export's Download (always a browser-style blob download, since
// its output is a small copy-paste snippet), this one opens a real native
// Save dialog in the desktop app - same as SCORM/EXE export - because where
// the file lands actually matters here: it needs to end up inside another
// game's own asset folder, not a generic Downloads folder.
async function _overlayDownload(){
  if(HAS_BRIDGE()){
    const opts=_overlayReadOptions();
    toast('Building overlay embed…');
    const r=await window.pywebview.api.export_overlay(projectForDisk(), opts, (typeof defaultPathFor==='function')?defaultPathFor('exports'):'');
    if(r&&r.ok) toast('Overlay embed saved: '+r.path);
    else if(r&&r.error) toast(r.error);
  } else {
    if(_overlayCurrentHtml==null){ toast('Build it first'); return; }
    downloadBlob(new Blob([_overlayCurrentHtml],{type:'text/html'}), safeTitle()+'_overlay.html');
    toast('HTML downloaded');
  }
}
function _overlayCopyLoaderSnippet(){
  const finish=()=>toast('Loader snippet copied; paste it into your host page');
  try{ navigator.clipboard.writeText(OVERLAY_LOADER_SNIPPET).then(finish).catch(()=>_overlayCopyViaHiddenTextarea(OVERLAY_LOADER_SNIPPET,finish)); }
  catch(e){ _overlayCopyViaHiddenTextarea(OVERLAY_LOADER_SNIPPET,finish); }
}
