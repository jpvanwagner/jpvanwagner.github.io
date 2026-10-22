/* ============================================================================
   Scenemaker editor; Title Screen editor  (#96)
   A canvas-editor-style modal (topbar + sidebar controls + live preview
   stage) for the exported game's own title/start screen: extra menu items
   (Credits / Settings / a custom link), background fit mode + video
   playback speed, music loop-or-play-N-times + an optional hover cue, and
   a social-link icon row pulled from Info & Credits. The basic Settings ->
   "Title screen" section still covers the essentials (heading/subheading/
   start label/background/music) for a quick edit - same "also reachable
   from Settings" pattern the Canvas editor's own canvas-size picker already
   uses; this is the one-stop richer surface, with a live preview.
   Shares core.js scope.
   ==========================================================================*/
let _ttWork=null, _ttSavedSnapshot=null;

function _ttDefaults(){
  return { enabled:false, bg:{type:'none',media:null,fit:'cover',speed:1}, music:{media:null,loop:true,volume:0.6,playCount:0},
    heading:'', subheading:'', startLabel:'Start', returnOnEnd:true, hoverSound:null, showSocials:false, menuItems:[] };
}
function openTitleScreenEditor(){
  ttEnsureDom();
  _ttWork=Object.assign(_ttDefaults(), JSON.parse(JSON.stringify(project.title||{})));
  _ttWork.bg=Object.assign({type:'none',media:null,fit:'cover',speed:1}, _ttWork.bg||{});
  _ttWork.music=Object.assign({media:null,loop:true,volume:0.6,playCount:0}, _ttWork.music||{});
  if(!Array.isArray(_ttWork.menuItems)) _ttWork.menuItems=[];
  _ttSavedSnapshot=JSON.stringify(_ttWork);
  ttRenderControls(); ttRenderPreview();
  // #98: opened from Settings' "Title screen" section, whose own .modal-bg
  // sits at a HIGHER z-index (810) than this full-screen editor's .ce-full
  // (700) - a real bug also caught fixing the credits-screen editor: without
  // closing it first, the richer editor opens genuinely underneath Settings,
  // interactive but invisible. Settings is one click away again once this closes.
  const storyModal=document.getElementById('story-modal');
  if(storyModal && !storyModal.classList.contains('hidden')) closeModal('story-modal');
  document.getElementById('title-screen-modal').classList.remove('hidden');
}
function ttEnsureDom(){
  if(document.getElementById('title-screen-modal')) return;
  const d=document.createElement('div'); d.id='title-screen-modal'; d.className='ce-full hidden';
  d.innerHTML=`<div class="ce-topbar">
      <b>🎬 Title screen editor</b>
      <span class="ce-spacer"></span>
      <button class="tb-btn tb-slate" onclick="resetTitleScreenEditor()" title="Discard changes made in this editor, back to what's actually saved">Reset</button>
      <button class="tb-btn tb-emerald" onclick="saveTitleScreenEditor()" title="Save the title screen">Save</button>
      <button class="tb-btn" onclick="detachSurface('title-screen-modal','Title screen editor')" title="Open in its own window (native app only)">⧉</button>
      <button class="tb-btn tb-slate" onclick="ttRequestClose()" title="Close the title screen editor">Close</button>
    </div>
    <div class="ce-main">
      <div class="ce-controls" id="tt-controls"></div>
      <div class="ce-preview"><div id="tt-stage" class="tt-stage"></div>
        <div class="hint" style="text-align:center;margin-top:8px">Live preview with your real heading/media; menu-item buttons are shown but inert here.</div></div>
    </div>`;
  document.body.appendChild(d);
}

/* ---- sidebar controls ----------------------------------------------------- */
function ttRenderControls(){
  const box=document.getElementById('tt-controls'); if(!box||!_ttWork) return;
  const w=_ttWork;
  box.innerHTML=`
    <div class="sec"><h3>Basics</h3>
      <label class="chk"><input type="checkbox" ${w.enabled?'checked':''} onchange="ttSet('enabled',this.checked)"> Show a title screen before the story</label>
      <div class="fld"><label>Heading</label><input type="text" value="${escAttr(w.heading)}" oninput="ttSet('heading',this.value)"></div>
      <div class="fld"><label>Subheading</label><input type="text" value="${escAttr(w.subheading)}" oninput="ttSet('subheading',this.value)"></div>
      <div class="fld"><label>Start button label</label><input type="text" value="${escAttr(w.startLabel)}" oninput="ttSet('startLabel',this.value)"></div>
      <label class="chk"><input type="checkbox" ${w.returnOnEnd!==false?'checked':''} onchange="ttSet('returnOnEnd',this.checked)"> Return to the title screen when the story ends</label>
    </div>
    <div class="sec"><h3>Background</h3>
      <div class="media-slot"><span style="color:var(--mut)">Media</span>
        <button class="mini-btn" onclick="ttPickBg('image')">image</button>
        <button class="mini-btn" onclick="ttPickBg('video')">video</button>
        <button class="mini-btn warn" onclick="ttClearBg()">clear</button>
        <span class="hint">${w.bg.media?('✓ '+w.bg.type):'none'}</span></div>
      <div class="fld"><label>Fit</label><select onchange="ttSetBg('fit',this.value)">
        ${['cover','stretch','contain','tile','center'].map(f=>`<option value="${f}" ${w.bg.fit===f?'selected':''}>${f[0].toUpperCase()+f.slice(1)}</option>`).join('')}
      </select></div>
      ${w.bg.type==='video'?`<div class="fld"><label>Playback speed</label><input type="range" min="25" max="200" step="5" value="${Math.round((w.bg.speed||1)*100)}" oninput="ttSetBg('speed',this.value/100)"><span class="ss-val">${Math.round((w.bg.speed||1)*100)}%</span></div>`:''}
    </div>
    <div class="sec"><h3>Audio</h3>
      <div class="media-slot"><span style="color:var(--mut)">Track</span>
        <button class="mini-btn" onclick="ttPickMusic()">set</button>
        <button class="mini-btn warn" onclick="ttClearMusic()">clear</button>
        <span class="hint">${w.music.media?'✓ set':'none'}</span></div>
      <div class="fld"><label>Volume</label><input type="range" min="0" max="100" value="${Math.round((w.music.volume!=null?w.music.volume:0.6)*100)}" oninput="ttSetMusic('volume',this.value/100)"></div>
      <div class="fld"><label>Play count</label><select onchange="ttSetMusic('playCount',parseInt(this.value,10)||0)">
        <option value="0" ${!w.music.playCount?'selected':''}>${w.music.loop!==false?'Loop forever':'Play once'}</option>
        ${[1,2,3,5,10].map(n=>`<option value="${n}" ${w.music.playCount===n?'selected':''}>Play ${n} time${n>1?'s':''}, then stop</option>`).join('')}
      </select></div>
      ${!w.music.playCount?`<label class="chk"><input type="checkbox" ${w.music.loop!==false?'checked':''} onchange="ttSetMusic('loop',this.checked)"> Loop the track</label>`:''}
      <div class="media-slot" style="margin-top:6px"><span style="color:var(--mut)">Hover cue</span>
        <button class="mini-btn" onclick="ttPickHoverSound()">set</button>
        <button class="mini-btn warn" onclick="ttClearHoverSound()">clear</button>
        <span class="hint">${w.hoverSound?'✓ set':'none'}</span></div>
      <div class="hint" style="margin-top:4px">A short sound played when the pointer enters Start, a menu item, or a social icon.</div>
    </div>
    <div class="sec"><h3>Menu items</h3>
      <div class="hint" style="margin-bottom:6px">Extra buttons shown below Start.</div>
      ${(w.menuItems||[]).map((mi,i)=>ttMenuItemRowHtml(mi,i)).join('') || '<div class="hint">None yet.</div>'}
      <button class="mini-btn" style="margin-top:2px" onclick="ttAddMenuItem()">+ Add menu item</button>
    </div>
    <div class="sec"><h3>Social links</h3>
      <label class="chk"><input type="checkbox" ${w.showSocials?'checked':''} onchange="ttSet('showSocials',this.checked)"> Show social icons on the title screen</label>
      <div class="hint" style="margin-top:4px">Uses the links already set in <b>Info &amp; credits</b> (${((project.meta&&project.meta.socials)||[]).length} configured there).</div>
    </div>`;
}
function ttMenuItemRowHtml(mi,i){
  const n=(_ttWork.menuItems||[]).length, canUp=i>0, canDown=i<n-1;
  return `<div class="ss-row" style="align-items:flex-start;flex-wrap:wrap;border:1px solid var(--line);border-radius:8px;padding:8px;margin-bottom:6px">
    <select class="mini-sel" onchange="ttSetMenuItem(${i},'type',this.value)">
      <option value="credits" ${mi.type==='credits'?'selected':''}>Credits</option>
      <option value="settings" ${mi.type==='settings'?'selected':''}>Settings</option>
      <option value="url" ${mi.type==='url'?'selected':''}>Open a link</option>
    </select>
    <input type="text" class="mini-sel" style="flex:1;min-width:80px" placeholder="Label" value="${escAttr(mi.label||'')}" oninput="ttSetMenuItem(${i},'label',this.value)">
    ${mi.type==='url'?`<input type="text" class="mini-sel" style="flex:2;min-width:120px" placeholder="https://…" value="${escAttr(mi.url||'')}" oninput="ttSetMenuItem(${i},'url',this.value)">`:''}
    <span class="hdr-icon" style="${canUp?'':'opacity:.3;pointer-events:none'}" title="Move up" onclick="ttMoveMenuItem(${i},-1)">▲</span>
    <span class="hdr-icon" style="${canDown?'':'opacity:.3;pointer-events:none'}" title="Move down" onclick="ttMoveMenuItem(${i},1)">▼</span>
    <span class="hdr-icon" style="color:#ef4444" title="Remove" onclick="ttRemoveMenuItem(${i})">✕</span>
  </div>`;
}

/* ---- setters (edit the working copy, then re-render whatever it affects) - */
function ttSet(field,val){ _ttWork[field]=val; ttRenderPreview(); }
function ttSetBg(field,val){ _ttWork.bg[field]=(field==='speed')?(parseFloat(val)||1):val; ttRenderPreview(); }
function ttSetMusic(field,val){
  if(field==='playCount'){ _ttWork.music.playCount=val; ttRenderControls(); }
  else if(field==='volume'){ _ttWork.music.volume=parseFloat(val); }
  else if(field==='loop'){ _ttWork.music.loop=!!val; }
  ttRenderPreview();
}
function ttPickBg(type){ pickMedia(type==='video'?'video':'image').then(k=>{ if(k){ _ttWork.bg=Object.assign({}, _ttWork.bg, {type,media:k}); ttRenderControls(); ttRenderPreview(); } }); }
function ttClearBg(){ _ttWork.bg=Object.assign({}, _ttWork.bg, {type:'none',media:null}); ttRenderControls(); ttRenderPreview(); }
function ttPickMusic(){ pickMedia('audio').then(k=>{ if(k){ _ttWork.music.media=k; ttRenderControls(); ttRenderPreview(); } }); }
function ttClearMusic(){ _ttWork.music.media=null; ttRenderControls(); ttRenderPreview(); }
function ttPickHoverSound(){ pickMedia('audio').then(k=>{ if(k){ _ttWork.hoverSound=k; ttRenderControls(); } }); }
function ttClearHoverSound(){ _ttWork.hoverSound=null; ttRenderControls(); }
function ttAddMenuItem(){ _ttWork.menuItems=_ttWork.menuItems||[]; _ttWork.menuItems.push({id:genId('ttmi'),type:'credits',label:'Credits'}); ttRenderControls(); ttRenderPreview(); }
function ttRemoveMenuItem(i){ _ttWork.menuItems.splice(i,1); ttRenderControls(); ttRenderPreview(); }
function ttMoveMenuItem(i,dir){ const j=i+dir; if(j<0||j>=_ttWork.menuItems.length) return; const t=_ttWork.menuItems[j]; _ttWork.menuItems[j]=_ttWork.menuItems[i]; _ttWork.menuItems[i]=t; ttRenderControls(); ttRenderPreview(); }
function ttSetMenuItem(i,field,val){ const mi=_ttWork.menuItems[i]; if(!mi) return; mi[field]=val;
  if(field==='type'){ if(val==='credits'&&!mi.label) mi.label='Credits'; if(val==='settings'&&!mi.label) mi.label='Settings'; ttRenderControls(); }
  ttRenderPreview(); }

/* ---- live preview stage --------------------------------------------------- */
function ttRenderPreview(){
  const stage=document.getElementById('tt-stage'); if(!stage||!_ttWork) return;
  const w=_ttWork, dim=(typeof ceCanvasSizeOf==='function')?ceCanvasSizeOf():{w:1000,h:640};
  stage.style.aspectRatio=dim.w+'/'+dim.h;
  const bg=w.bg||{}, fit=bg.fit||'cover';
  const bgSizeCss=({cover:'cover',stretch:'100% 100%',contain:'contain',tile:'auto',center:'auto'})[fit];
  const bgRepeatCss=(fit==='tile')?'repeat':'no-repeat';
  let bgHtml='';
  if(bg.type==='image'&&bg.media){ bgHtml=`<div style="position:absolute;inset:0;background-image:url('${mediaURL(bg.media)}');background-size:${bgSizeCss};background-repeat:${bgRepeatCss};background-position:center"></div>`; }
  else if(bg.type==='video'&&bg.media){ const ofit=({cover:'cover',stretch:'fill',contain:'contain',tile:'none',center:'none'})[fit];
    bgHtml=`<video src="${mediaURL(bg.media)}" autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:${ofit}"></video>`; }
  const menuHtml=(w.menuItems||[]).map(mi=>`<button class="mini-btn" style="pointer-events:none">${escHtml(mi.label||mi.type)}</button>`).join('');
  const socials=((project.meta&&project.meta.socials)||[]);
  const socialHtml=w.showSocials
    ? `<div style="display:flex;gap:6px;margin-top:8px">${socials.length
        ? socials.map(()=>`<span style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.15);display:inline-flex;align-items:center;justify-content:center;font-size:12px">🔗</span>`).join('')
        : `<span class="hint" style="color:#94a3b8">(none configured in Info &amp; credits yet)</span>`}</div>`
    : '';
  stage.innerHTML=`<div style="position:absolute;inset:0;background:#0b1120;border-radius:10px;overflow:hidden">
      ${bgHtml}
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.6))"></div>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:8%;text-align:center">
        <h2 style="color:#fff;font-size:clamp(20px,4vw,40px);margin:0;text-shadow:0 4px 18px rgba(0,0,0,.8)">${escHtml(w.heading||(project.meta&&project.meta.title)||'Untitled Story')}</h2>
        <div style="color:#e2e8f0;font-size:clamp(12px,1.6vw,16px)">${escHtml(w.subheading||'')}</div>
        <button class="tb-btn tb-accent" style="margin-top:10px;pointer-events:none">${escHtml(w.startLabel||'Start')}</button>
        ${menuHtml?`<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">${menuHtml}</div>`:''}
        ${socialHtml}
      </div>
    </div>`;
}

/* ---- save / reset / close (same dirty-check discipline as the Canvas
   editor's own working-copy pattern - see ceIsDirty()/ceRequestClose()) --- */
function ttIsDirty(){ return !!(_ttWork && _ttSavedSnapshot!==null && JSON.stringify(_ttWork)!==_ttSavedSnapshot); }
function saveTitleScreenEditor(){
  pushUndo(); project.title=JSON.parse(JSON.stringify(_ttWork)); _ttSavedSnapshot=JSON.stringify(_ttWork);
  if(typeof refreshTitleUI==='function') refreshTitleUI(); // keep the basic Settings panel's labels correct if it's open behind this one
  toast('Title screen saved');
}
function resetTitleScreenEditor(){ _ttWork=JSON.parse(_ttSavedSnapshot); ttRenderControls(); ttRenderPreview(); }
function ttRequestClose(){
  if(!ttIsDirty()){ closeModal('title-screen-modal'); return; }
  uiConfirm('Close the Title screen editor without saving? Your changes will be lost.',
    ()=>closeModal('title-screen-modal'),
    { yes:'Close without saving', no:'Keep editing',
      extra:{ label:'Save then close', onClick:()=>{ saveTitleScreenEditor(); closeModal('title-screen-modal'); } } });
}
