/* ============================================================================
   Scenemaker editor; Export options  (feature #14)
   A modal offering: SCORM package, a PNG of the project canvas, and a printable
   game script (each scene's lines as pages -> Save as PDF), with options to
   condense scenes and set scenes per page. Shares core.js scope.
   ==========================================================================*/
function ensureScorm(){ const st=project.settings; if(!st.scorm) st.scorm={}; const d={version:'1.2',reportScore:true,masteryScore:null,scoreVar:'',scoreMax:100,reportInteractions:true,reportTime:true,reportSuccess:true}; Object.keys(d).forEach(k=>{ if(st.scorm[k]===undefined) st.scorm[k]=d[k]; }); return st.scorm; }
function setScormOpt(k,v){ const sc=ensureScorm(); if(k==='masteryScore'){ sc[k]=(v===''||v==null)?null:(parseInt(v,10)); } else if(k==='scoreMax'){ sc[k]=parseInt(v,10)||100; } else if(typeof v==='boolean'){ sc[k]=v; } else { sc[k]=v; } }
function _fillScormUI(){ const sc=ensureScorm(); const g=id=>document.getElementById(id);
  if(g('exp-scormver')) g('exp-scormver').value=sc.version||'1.2';
  if(g('exp-mastery')) g('exp-mastery').value=(sc.masteryScore==null?'':sc.masteryScore);
  if(g('exp-scoremax')) g('exp-scoremax').value=sc.scoreMax||100;
  if(g('exp-rscore')) g('exp-rscore').checked=sc.reportScore!==false;
  if(g('exp-rsuccess')) g('exp-rsuccess').checked=sc.reportSuccess!==false;
  if(g('exp-rix')) g('exp-rix').checked=sc.reportInteractions!==false;
  if(g('exp-rtime')) g('exp-rtime').checked=sc.reportTime!==false;
  const sv=g('exp-scorevar'); if(sv){ const nums=(project.variables||[]).filter(v=>v.type==='number'); sv.innerHTML='<option value="">(completion = 100)</option>'+nums.map(v=>`<option value="${v.id}" ${sc.scoreVar===v.id?'selected':''}>${escHtml(v.name)}</option>`).join(''); }
}
function openExportModal(){
  ensureScorm();
  let bg=document.getElementById('export-modal');
  if(!bg){ bg=document.createElement('div'); bg.id='export-modal'; bg.className='modal-bg hidden';
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('export-modal', 'Export') : '';
    bg.innerHTML=`<div class="modal-card" style="max-width:560px"><h2>Export${detachIco}</h2>
      <div class="modal-body">
        <div class="sec"><h3>SCORM package</h3>
          <div class="hint" style="margin-bottom:6px">The playable module for your LMS (any SCORM 1.2/2004 host).</div>
          <div class="rowflex">
            <div class="fld"><label>SCORM version</label><select id="exp-scormver" onchange="setScormOpt('version',this.value)"><option value="1.2">SCORM 1.2</option><option value="2004">SCORM 2004 (4th Ed.)</option></select></div>
            <div class="fld"><label>Mastery score (blank = none)</label><input type="number" id="exp-mastery" min="0" max="100" placeholder="e.g. 70" oninput="setScormOpt('masteryScore',this.value)"></div>
          </div>
          <div class="rowflex">
            <div class="fld"><label>Report score from variable</label><select id="exp-scorevar" onchange="setScormOpt('scoreVar',this.value)"></select></div>
            <div class="fld"><label>&hellip;out of (max)</label><input type="number" id="exp-scoremax" min="1" value="100" oninput="setScormOpt('scoreMax',this.value)"></div>
          </div>
          <label class="chk"><input type="checkbox" id="exp-rscore" checked onchange="setScormOpt('reportScore',this.checked)"> Report a score to the LMS</label>
          <label class="chk"><input type="checkbox" id="exp-rsuccess" checked onchange="setScormOpt('reportSuccess',this.checked)"> Report pass/fail (needs a mastery score)</label>
          <label class="chk"><input type="checkbox" id="exp-rix" checked onchange="setScormOpt('reportInteractions',this.checked)"> Log each choice as an interaction</label>
          <label class="chk"><input type="checkbox" id="exp-rtime" checked onchange="setScormOpt('reportTime',this.checked)"> Report time spent</label>
          <button class="tb-btn tb-accent" style="margin-top:8px" onclick="closeModal('export-modal');doExportScorm()">⇪ Export SCORM</button></div>
        <div class="sec"><h3>Standalone executable</h3>
          <div class="hint" style="margin-bottom:6px">A single double-clickable program that plays the story with no browser, LMS, or install needed. Windows and Mac are both supported, but each executable can only be built by running Scenemaker on that OS - this button builds the one for whichever computer Scenemaker is running on right now. Needs <code>pip install pyinstaller</code> on that machine first (a one-time, optional setup step; nothing else in Scenemaker needs it).</div>
          <label class="chk" title="A single .exe self-extracts its whole Python runtime to a temp folder every time it launches; on some machines (antivirus scanning that folder, or another Python install like Anaconda leaving PYTHONHOME/PYTHONPATH set) that extraction fails with a cryptic 'failed to import encodings module' error. This mode skips the self-extraction step entirely by shipping a folder of files instead of one .exe - slower to hand out, but it can't hit that failure."><input type="checkbox" id="exp-exe-reliable" onchange="ToolSettings.set('exeOnefile', this.checked?'0':'1')"> More reliable (produces a folder instead of one file; use this if the built program won't launch)</label>
          <button class="tb-btn" style="margin-top:8px" onclick="closeModal('export-modal');doExportExe()">📦 Build standalone executable (this computer)</button></div>
        <div class="sec"><h3>Project stage</h3>
          <div class="hint" style="margin-bottom:6px">A picture of your scene graph (nodes and connections) for reference or documentation.</div>
          <button class="tb-btn" onclick="exportCanvasImage()">🖼 Download stage PNG</button></div>
        <div class="sec"><h3>Embeddable HTML</h3>
          <div class="hint" style="margin-bottom:6px">A single portable HTML file (dialogue, choices, character names, and more if you want it) for pasting into an LMS's raw-HTML embed block.</div>
          <button class="tb-btn" onclick="closeModal('export-modal');openLiteExportModal()">⇪ Get embeddable HTML</button></div>
        <div class="sec"><h3>Overlay / popup embed</h3>
          <div class="hint" style="margin-bottom:6px">The full player (portraits, backgrounds, layout - everything SCORM/Preview support) as one file, meant to run as a layer on top of another page or game instead of filling its own tab: a full-screen overlay with the host game showing through behind it, or a small centered popup. Drop the file into your game's own folder and point an &lt;iframe&gt; at it, or load it into a same-origin page and call <code>VNOverlay.mount(container, opts)</code> directly.</div>
          <button class="tb-btn" onclick="closeModal('export-modal');openOverlayExportModal()">🗗 Get overlay / popup embed</button></div>
        <div class="sec"><h3>Game script (printable / PDF)</h3>
          <div class="hint" style="margin-bottom:6px">Every scene's text laid out as pages. Open it and use your browser's Print; Save as PDF.</div>
          <div class="rowflex">
            <div class="fld"><label>Condense each scene to</label>
              <select id="exp-condense"><option value="all">all lines</option><option value="first">first line only</option><option value="last">last line only</option></select></div>
            <div class="fld"><label>Scenes per page</label>
              <select id="exp-perpage"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="0">as many as fit</option></select></div>
          </div>
          <label class="chk"><input type="checkbox" id="exp-choices" checked> Include choices &amp; their effects</label>
          <div style="margin-top:8px"><button class="tb-btn" onclick="exportGameScript()">📄 Open printable script</button></div></div>
        <div class="sec"><h3>Storyboard (visual / PDF)</h3>
          <div class="hint" style="margin-bottom:6px">One visual panel per scene; backdrop, on-stage cast, and its opening line, laid out like a film storyboard. Open it and use your browser's Print; Save as PDF.</div>
          <div class="fld"><label>Panels per row</label>
            <select id="exp-sb-percol"><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option></select></div>
          <div style="margin-top:8px"><button class="tb-btn" onclick="exportStoryboard()">🖼 Open printable storyboard</button></div></div>
      </div>
      <div class="modal-foot"><button class="tb-btn tb-slate" onclick="closeModal('export-modal')">Close</button></div></div>`;
    document.body.appendChild(bg);
  }
  bg.classList.remove('hidden');
  _fillScormUI();
  const exeReliable=document.getElementById('exp-exe-reliable');
  if(exeReliable) exeReliable.checked=(typeof ToolSettings!=='undefined') && ToolSettings.get('exeOnefile','1')==='0';
  if(typeof maybeShowMini==='function') maybeShowMini('export');
}

/* ---- canvas PNG (best-effort DOM capture) ------------------------------ */
function exportCanvasImage(){
  const layer=document.getElementById('zoom-layer'); if(!layer){ toast('Nothing to capture'); return; }
  try{
    const nodes=Object.values(scenes); if(!nodes.length){ toast('Add a scene first'); return; }
    // bounds of all nodes (+ groups) in logical coords
    let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
    const consider=(x,y,w,h)=>{ minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x+w);maxY=Math.max(maxY,y+h); };
    nodes.forEach(n=>{ const el=document.getElementById(n.id); consider(n.x,n.y,el?el.offsetWidth:360,el?el.offsetHeight:200); });
    Object.values(backdrops).forEach(b=>consider(b.x,b.y,b.w||300,b.h||200));
    const pad=40; minX-=pad;minY-=pad;maxX+=pad;maxY+=pad; const W=Math.max(1,maxX-minX), H=Math.max(1,maxY-minY);
    const clone=layer.cloneNode(true);
    clone.style.transform='none'; clone.style.left=(-minX)+'px'; clone.style.top=(-minY)+'px'; clone.style.position='absolute';
    let styles=''; document.querySelectorAll('style').forEach(s=>{ if(s.id!=='vn-hud-css') styles+=s.textContent+'\n'; });
    const holder=`<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${W}px;height:${H}px;background:var(--workspace,#0b1120)"><style>${styles}</style>${new XMLSerializer().serializeToString(clone)}</div>`;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">${holder}</foreignObject></svg>`;
    const img=new Image();
    img.onload=()=>{ const c=document.createElement('canvas'); c.width=W; c.height=H; const cx=c.getContext('2d');
      cx.fillStyle='#0b1120'; cx.fillRect(0,0,W,H); cx.drawImage(img,0,0);
      c.toBlob(b=>{ if(!b){ toast('Capture failed (try a smaller stage)'); return; } downloadBlob(b, safeTitle()+'-stage.png'); toast('Stage PNG downloaded'); }); };
    img.onerror=()=>toast('Stage capture not supported in this browser');
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }catch(e){ toast('Stage capture failed'); }
}

/* ---- printable game script --------------------------------------------- */
function _orderedScenes(){
  const out=[]; const seen=new Set(); const start=project.settings.startScene;
  if(start&&scenes[start]){ out.push(scenes[start]); seen.add(start); }
  Object.values(scenes).forEach(s=>{ if(!seen.has(s.id)){ out.push(s); seen.add(s.id); } });
  return out;
}
// A library-linked cast entry's own name/media are just placeholders; the
// linked character's record wins, exactly like player/runtime.js's own
// resolveFace() - kept in sync with that priority so exports never disagree
// with what actually plays.
function _resolveCastFace(entry){
  if(entry && entry.charId){ const c=(project.characters||[]).find(x=>x.id===entry.charId); if(c) return c; }
  return entry||{};
}
function _speakerNameForLine(s,l){
  if(l.speaker) return l.speaker;
  if(l.speakingCast && s.cast){ const e=s.cast.find(x=>x.id===l.speakingCast); if(e) return _resolveCastFace(e).name||''; }
  return '';
}
function buildGameScriptHtml(){
  const condense=(document.getElementById('exp-condense')||{}).value||'all';
  const perpage=parseInt((document.getElementById('exp-perpage')||{}).value||'3',10);
  const withChoices=(document.getElementById('exp-choices')||{}).checked!==false;
  const esc=t=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const varName=id=>{ const v=(project.variables||[]).find(x=>x.id===id); return v?v.name:id; };
  const scenesArr=_orderedScenes();
  let blocks=scenesArr.map((s,idx)=>{
    let lines=s.lines||[];
    if(condense==='first') lines=lines.slice(0,1); else if(condense==='last') lines=lines.slice(-1);
    const lineHtml=lines.map(l=>{ const spk=_speakerNameForLine(s,l);
      return `<p class="scr-line">${spk?`<b>${esc(spk)}:</b> `:''}${esc((l.text||'').replace(/\[[^\]]*\]/g,''))}</p>`; }).join('');
    let choiceHtml='';
    if(withChoices && (s.choices||[]).length){ choiceHtml='<ul class="scr-choices">'+s.choices.map(c=>{
      const effs=(c.effects||[]).map(e=>varName(e.var)+' '+(e.op==='add'?'+':e.op==='sub'?'-':'=')+' '+e.value).join(', ');
      return `<li>${esc(c.text||'(continue)')}${effs?` <i>(${esc(effs)})</i>`:''}</li>`; }).join('')+'</ul>'; }
    const brk=(perpage>0 && idx>0 && idx%perpage===0)?' style="page-break-before:always"':'';
    return `<section class="scr-scene"${brk}><h2>${idx+1}. ${esc(s.title||'Scene')} <span class="scr-type">${s.mode==='cutscene'?'cutscene':'dialogue'}</span></h2>${lineHtml||'<p class="scr-empty">(no dialogue)</p>'}${choiceHtml}</section>`;
  }).join('');
  const title=esc((project.meta&&project.meta.title)||'Scenemaker Story');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} ; script</title><style>
    body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:30px;color:#111;background:#fff}
    h1{border-bottom:2px solid #333}
    .scr-scene{margin:0 0 22px;padding:0 0 12px;border-bottom:1px solid #ddd}
    .scr-scene h2{font-size:18px;margin:14px 0 8px}
    .scr-type{font-size:11px;color:#888;font-weight:normal;text-transform:uppercase;letter-spacing:1px}
    .scr-line{margin:4px 0;line-height:1.5}
    .scr-choices{margin:8px 0 0;color:#334;}.scr-choices i{color:#77f}
    .scr-empty{color:#999;font-style:italic}
    @media print{ .noprint{display:none} }
  </style></head><body>
    <h1>${title}</h1><p class="noprint" style="color:#666">Use your browser's <b>Print</b> and choose <b>Save as PDF</b>. (${scenesArr.length} scenes.)</p>
    <button class="noprint" onclick="window.print()">🖨 Print / Save as PDF</button>
    ${blocks}</body></html>`;
}
function exportGameScript(){
  const html=buildGameScriptHtml();
  try{ const w=window.open('', '_blank'); if(!w){ toast('Allow pop-ups to open the script'); return; } w.document.write(html); w.document.close(); }
  catch(e){ const blob=new Blob([html],{type:'text/html'}); downloadBlob(blob, safeTitle()+'-script.html'); toast('Script downloaded (open it, then Print to PDF)'); }
}

/* ---- printable PDF storyboard (visual panels, one per scene) ----------- */
function buildStoryboardHtml(){
  const percol=parseInt((document.getElementById('exp-sb-percol')||{}).value||'3',10);
  const esc=t=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const scenesArr=_orderedScenes();
  const cards=scenesArr.map((s,idx)=>{
    const bgSrc=(s.bg&&s.bg.type!=='video'&&s.bg.media)?mediaURL(s.bg.media):'';
    const thumbStyle=bgSrc?`background-image:url('${bgSrc}');background-size:cover;background-position:center`:'';
    const castImgs=(s.cast||[]).map(c=>{ const f=_resolveCastFace(c); const src=f.media?mediaURL(f.media):''; return src?`<img class="sb-cast" src="${src}" title="${escAttr(f.name||'')}">`:''; }).join('');
    const firstLine=(s.lines||[])[0];
    const spk=firstLine?_speakerNameForLine(s,firstLine):'';
    const text=firstLine?esc((firstLine.text||'').replace(/\[[^\]]*\]/g,'').slice(0,160)):'';
    const choices=(s.choices||[]).map(c=>esc(c.text||'(continue)')).join(' &middot; ');
    return `<div class="sb-card">
      <div class="sb-thumb" style="${thumbStyle}">${castImgs||''}${!bgSrc&&!castImgs?'<span class="sb-noart">no art</span>':''}</div>
      <div class="sb-body"><div class="sb-head"><span class="sb-num">${idx+1}</span><h3>${esc(s.title||'Scene')}</h3><span class="sb-type">${s.mode==='cutscene'?'cutscene':'dialogue'}</span></div>
      ${spk?`<div class="sb-spk">${esc(spk)}</div>`:''}
      <p class="sb-text">${text||'<i>(no dialogue)</i>'}</p>
      ${choices?`<div class="sb-choices">&rarr; ${choices}</div>`:''}</div></div>`;
  }).join('');
  const title=esc((project.meta&&project.meta.title)||'Scenemaker Story');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} ; storyboard</title><style>
    body{font-family:system-ui,Arial,sans-serif;margin:0;padding:26px;color:#111;background:#fff}
    h1{margin:0 0 4px}
    .sb-grid{display:grid;grid-template-columns:repeat(${percol},1fr);gap:16px;margin-top:16px}
    .sb-card{border:1px solid #ccc;border-radius:8px;overflow:hidden;break-inside:avoid;page-break-inside:avoid}
    .sb-thumb{position:relative;height:140px;background:#e2e2e2;display:flex;align-items:flex-end;gap:4px;padding:6px}
    .sb-noart{margin:auto;color:#999;font-size:12px;font-style:italic}
    .sb-cast{height:64px;width:auto;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
    .sb-body{padding:8px 10px 12px}
    .sb-head{display:flex;align-items:center;gap:6px}
    .sb-num{background:#333;color:#fff;font-size:11px;font-weight:700;border-radius:4px;padding:1px 6px}
    .sb-head h3{margin:0;font-size:14px;flex:1}
    .sb-type{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px}
    .sb-spk{font-size:11px;font-weight:700;color:#555;margin-top:4px}
    .sb-text{margin:2px 0 0;font-size:12px;line-height:1.4}
    .sb-choices{margin-top:6px;font-size:11px;color:#557}
    @media print{ .noprint{display:none} .sb-card{border-color:#999} }
  </style></head><body>
    <h1>${title}</h1><p class="noprint" style="color:#666">Use your browser's <b>Print</b> and choose <b>Save as PDF</b>. (${scenesArr.length} scenes.)</p>
    <button class="noprint" onclick="window.print()">🖨 Print / Save as PDF</button>
    <div class="sb-grid">${cards}</div></body></html>`;
}
function exportStoryboard(){
  const html=buildStoryboardHtml();
  try{ const w=window.open('', '_blank'); if(!w){ toast('Allow pop-ups to open the storyboard'); return; } w.document.write(html); w.document.close(); }
  catch(e){ const blob=new Blob([html],{type:'text/html'}); downloadBlob(blob, safeTitle()+'-storyboard.html'); toast('Storyboard downloaded (open it, then Print to PDF)'); }
}
