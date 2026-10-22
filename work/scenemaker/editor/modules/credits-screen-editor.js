/* ============================================================================
   Scenemaker editor; Credits Screen editor  (#98)
   Same canvas-editor-style modal shape (topbar + sidebar controls + a live
   preview stage) as the Title Screen editor (#96), for the OTHER end of the
   story: the automatic end-of-game credits overlay. Basic Settings -> Info &
   credits keeps its two original fields (the "show automatic credits screen"
   toggle and the heading text) for a quick edit; this is the richer surface
   next to it, same "also reachable from Settings" precedent #96 set. The
   actual author/team/asset-credit entries themselves stay authored in Info &
   credits (this editor only picks which sections of that content show, plus
   how the screen itself looks: static panel or an auto-scrolling movie-style
   roll, an optional background, optional music while it's open, and heading/
   text color overrides).
   Shares core.js scope.
   ==========================================================================*/
let _ccWork=null, _ccSavedSnapshot=null;

function _ccDefaults(){
  return { showCredits:false, heading:'Credits', style:'static', scrollSpeed:40,
    bg:{type:'none',media:null,fit:'cover'}, music:{media:null,volume:0.6},
    textColor:'', headingColor:'', closeLabel:'Close',
    showAuthor:true, showTeam:true, showAssetCredits:true, showSocials:true };
}
function openCreditsScreenEditor(){
  ccEnsureDom();
  if(typeof ensureProjectInfo==='function') ensureProjectInfo();
  const cs=JSON.parse(JSON.stringify(project.creditsScreen||{}));
  _ccWork=Object.assign(_ccDefaults(), cs, {
    showCredits: !!(project.title && project.title.showCredits),
    heading: (project.title && project.title.creditsHeading) || 'Credits'
  });
  _ccWork.bg=Object.assign({type:'none',media:null,fit:'cover'}, _ccWork.bg||{});
  _ccWork.music=Object.assign({media:null,volume:0.6}, _ccWork.music||{});
  _ccSavedSnapshot=JSON.stringify(_ccWork);
  ccRenderControls(); ccRenderPreview();
  // #98: a real bug (also fixed in the Title Screen editor, same cause) -
  // opened from Settings' "Info & credits" section, whose own .modal-bg sits
  // at a HIGHER z-index (810) than this full-screen editor's .ce-full (700);
  // without closing it first, this editor opens genuinely underneath
  // Settings, interactive but invisible. Settings is one click away again
  // once this closes.
  const storyModal=document.getElementById('story-modal');
  if(storyModal && !storyModal.classList.contains('hidden')) closeModal('story-modal');
  document.getElementById('credits-screen-modal').classList.remove('hidden');
}
function ccEnsureDom(){
  if(document.getElementById('credits-screen-modal')) return;
  const d=document.createElement('div'); d.id='credits-screen-modal'; d.className='ce-full hidden';
  d.innerHTML=`<div class="ce-topbar">
      <b>\u{1F3AC} Credits screen editor</b>
      <span class="ce-spacer"></span>
      <button class="tb-btn tb-slate" onclick="resetCreditsScreenEditor()" title="Discard changes made in this editor, back to what's actually saved">Reset</button>
      <button class="tb-btn tb-emerald" onclick="saveCreditsScreenEditor()" title="Save the credits screen">Save</button>
      <button class="tb-btn" onclick="detachSurface('credits-screen-modal','Credits screen editor')" title="Open in its own window (native app only)">⧉</button>
      <button class="tb-btn tb-slate" onclick="ccRequestClose()" title="Close the credits screen editor">Close</button>
    </div>
    <div class="ce-main">
      <div class="ce-controls" id="cc-controls"></div>
      <div class="ce-preview"><div id="cc-stage" class="tt-stage"></div>
        <div class="hint" style="text-align:center;margin-top:8px">Live preview using your real Info &amp; credits content; the scrolling style animates here too.</div></div>
    </div>`;
  document.body.appendChild(d);
}

/* ---- sidebar controls ----------------------------------------------------- */
function ccRenderControls(){
  const box=document.getElementById('cc-controls'); if(!box||!_ccWork) return;
  const w=_ccWork;
  box.innerHTML=`
    <div class="sec"><h3>Basics</h3>
      <label class="chk"><input type="checkbox" ${w.showCredits?'checked':''} onchange="ccSet('showCredits',this.checked)"> Show an automatic credits screen at the end</label>
      <div class="fld"><label>Heading</label><input type="text" value="${escAttr(w.heading)}" oninput="ccSet('heading',this.value)"></div>
      <div class="fld"><label>Style</label><select onchange="ccSet('style',this.value)">
        <option value="static" ${w.style==='static'?'selected':''}>Static panel (click Close to dismiss)</option>
        <option value="scroll" ${w.style==='scroll'?'selected':''}>Auto-scrolling roll (movie-style)</option>
      </select></div>
      ${w.style==='scroll'?`<div class="fld"><label>Scroll speed</label><input type="range" min="10" max="120" step="5" value="${w.scrollSpeed}" oninput="ccSet('scrollSpeed',parseInt(this.value,10)||40)"><span class="ss-val">${w.scrollSpeed}px/s</span></div>`:''}
      <div class="fld"><label>Close button label</label><input type="text" value="${escAttr(w.closeLabel)}" oninput="ccSet('closeLabel',this.value)"></div>
    </div>
    <div class="sec"><h3>Background</h3>
      <div class="hint" style="margin-bottom:6px">Optional; leave unset to keep the game's own screen dimmed behind the credits panel (the default look).</div>
      <div class="media-slot"><span style="color:var(--mut)">Media</span>
        <button class="mini-btn" onclick="ccPickBg('image')">image</button>
        <button class="mini-btn" onclick="ccPickBg('video')">video</button>
        <button class="mini-btn warn" onclick="ccClearBg()">clear</button>
        <span class="hint">${w.bg.media?('✓ '+w.bg.type):'none'}</span></div>
      ${w.bg.media?`<div class="fld"><label>Fit</label><select onchange="ccSetBg('fit',this.value)">
        ${['cover','stretch','contain','tile','center'].map(f=>`<option value="${f}" ${w.bg.fit===f?'selected':''}>${f[0].toUpperCase()+f.slice(1)}</option>`).join('')}
      </select></div>`:''}
    </div>
    <div class="sec"><h3>Music</h3>
      <div class="hint" style="margin-bottom:6px">Optional; plays only while the credits screen is open, then stops when it closes. Whatever's already playing in the game keeps playing underneath, unaffected.</div>
      <div class="media-slot"><span style="color:var(--mut)">Track</span>
        <button class="mini-btn" onclick="ccPickMusic()">set</button>
        <button class="mini-btn warn" onclick="ccClearMusic()">clear</button>
        <span class="hint">${w.music.media?'✓ set':'none'}</span></div>
      ${w.music.media?`<div class="fld"><label>Volume</label><input type="range" min="0" max="100" value="${Math.round((w.music.volume!=null?w.music.volume:0.6)*100)}" oninput="ccSetMusic('volume',this.value/100)"></div>`:''}
    </div>
    <div class="sec"><h3>Appearance</h3>
      <div class="fld"><label>Heading colour</label><div class="rowflex">
        <input type="color" id="cc-headcolor-swatch" value="${w.headingColor||'#e879f9'}" oninput="ccSetColorSwatch('headingColor','cc-headcolor-hex',this.value)">
        <input type="text" id="cc-headcolor-hex" class="hex-field" maxlength="7" placeholder="#rrggbb" value="${escAttr(w.headingColor)}" oninput="ccSetColorHex('headingColor','cc-headcolor-swatch',this)">
        <button class="mini-btn" title="Use the player's own default" onclick="ccClearColor('headingColor','cc-headcolor-swatch','cc-headcolor-hex','#e879f9')">default</button>
      </div></div>
      <div class="fld"><label>Text colour</label><div class="rowflex">
        <input type="color" id="cc-textcolor-swatch" value="${w.textColor||'#e5e7eb'}" oninput="ccSetColorSwatch('textColor','cc-textcolor-hex',this.value)">
        <input type="text" id="cc-textcolor-hex" class="hex-field" maxlength="7" placeholder="#rrggbb" value="${escAttr(w.textColor)}" oninput="ccSetColorHex('textColor','cc-textcolor-swatch',this)">
        <button class="mini-btn" title="Use the player's own default" onclick="ccClearColor('textColor','cc-textcolor-swatch','cc-textcolor-hex','#e5e7eb')">default</button>
      </div></div>
    </div>
    <div class="sec"><h3>Content shown</h3>
      <div class="hint" style="margin-bottom:6px">Edit the actual author/team/asset-credit entries in Settings -> Info &amp; credits; this just picks which sections appear here.</div>
      <label class="chk"><input type="checkbox" ${w.showAuthor?'checked':''} onchange="ccSet('showAuthor',this.checked)"> Author &amp; website</label>
      <label class="chk"><input type="checkbox" ${w.showTeam?'checked':''} onchange="ccSet('showTeam',this.checked)"> Team / collaborators</label>
      <label class="chk"><input type="checkbox" ${w.showAssetCredits?'checked':''} onchange="ccSet('showAssetCredits',this.checked)"> Asset credits &amp; attributions</label>
      <label class="chk"><input type="checkbox" ${w.showSocials?'checked':''} onchange="ccSet('showSocials',this.checked)"> Social / links</label>
    </div>`;
}

/* ---- setters (edit the working copy, then re-render whatever it affects) - */
function ccSet(field,val){ _ccWork[field]=val; if(field==='style') ccRenderControls(); ccRenderPreview(); }
function ccSetBg(field,val){ _ccWork.bg[field]=val; ccRenderPreview(); }
function ccSetMusic(field,val){ _ccWork.music[field]=(field==='volume')?parseFloat(val):val; ccRenderPreview(); }
function ccPickBg(type){ pickMedia(type==='video'?'video':'image').then(k=>{ if(k){ _ccWork.bg=Object.assign({}, _ccWork.bg, {type,media:k}); ccRenderControls(); ccRenderPreview(); } }); }
function ccClearBg(){ _ccWork.bg=Object.assign({}, _ccWork.bg, {type:'none',media:null}); ccRenderControls(); ccRenderPreview(); }
function ccPickMusic(){ pickMedia('audio').then(k=>{ if(k){ _ccWork.music.media=k; ccRenderControls(); ccRenderPreview(); } }); }
function ccClearMusic(){ _ccWork.music.media=null; ccRenderControls(); ccRenderPreview(); }
function ccSetColorSwatch(field,hexInputId,val){ _ccWork[field]=val; const hx=document.getElementById(hexInputId); if(hx) hx.value=val; ccRenderPreview(); }
function ccSetColorHex(field,swatchId,el){
  const v=el.value.trim();
  if(v===''){ _ccWork[field]=''; el.classList.remove('hex-invalid'); ccRenderPreview(); return; }
  const norm=normalizeHex(v);
  if(!norm){ el.classList.add('hex-invalid'); return; }
  el.classList.remove('hex-invalid'); _ccWork[field]=norm;
  const sw=document.getElementById(swatchId); if(sw) sw.value=norm;
  ccRenderPreview();
}
function ccClearColor(field,swatchId,hexId,dflt){
  _ccWork[field]='';
  const sw=document.getElementById(swatchId); if(sw) sw.value=dflt;
  const hx=document.getElementById(hexId); if(hx) hx.value='';
  ccRenderPreview();
}

/* ---- live preview stage --------------------------------------------------- */
function ccBuildContentHtml(w){
  const m=project.meta||{}; let body='';
  if(w.showAuthor){
    if(m.author) body+=`<div class="cc-row"><b>${escHtml(m.author)}</b></div>`;
    if(m.website) body+=`<div class="cc-row">${escHtml(m.website)}</div>`;
    if(m.email) body+=`<div class="cc-row">${escHtml(m.email)}</div>`;
  }
  if(w.showSocials){ (m.socials||[]).forEach(s=>{ if(s.label||s.url) body+=`<div class="cc-row">${escHtml(s.label)}${s.url?(': '+escHtml(s.url)):''}</div>`; }); }
  if(w.showTeam && (m.collaborators||[]).length){ body+='<h4>Team</h4>'; m.collaborators.forEach(c=>{ if(c.name||c.role) body+=`<div class="cc-row">${escHtml(c.name)}${c.role?(': '+escHtml(c.role)):''}</div>`; }); }
  if(w.showAssetCredits && (project.credits||[]).length){ body+='<h4>Credits &amp; attributions</h4>'; project.credits.forEach(c=>{ if(c.asset||c.author||c.url) body+=`<div class="cc-row">${escHtml(c.asset||'')}${c.author?(': '+escHtml(c.author)):''}${c.license?(' ('+escHtml(c.license)+')'):''}</div>`; }); }
  return body || '<div class="cc-row" style="opacity:.6">No credits added yet (Settings -> Info &amp; credits).</div>';
}
function ccRenderPreview(){
  const stage=document.getElementById('cc-stage'); if(!stage||!_ccWork) return;
  const w=_ccWork, dim=(typeof ceCanvasSizeOf==='function')?ceCanvasSizeOf():{w:1000,h:640};
  stage.style.aspectRatio=dim.w+'/'+dim.h;
  const bg=w.bg||{}, fit=bg.fit||'cover';
  const bgSizeCss=({cover:'cover',stretch:'100% 100%',contain:'contain',tile:'auto',center:'auto'})[fit];
  const bgRepeatCss=(fit==='tile')?'repeat':'no-repeat';
  let bgHtml='';
  if(bg.type==='image'&&bg.media){ bgHtml=`<div style="position:absolute;inset:0;background-image:url('${mediaURL(bg.media)}');background-size:${bgSizeCss};background-repeat:${bgRepeatCss};background-position:center"></div>`; }
  else if(bg.type==='video'&&bg.media){ const ofit=({cover:'cover',stretch:'fill',contain:'contain',tile:'none',center:'none'})[fit];
    bgHtml=`<video src="${mediaURL(bg.media)}" autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:${ofit}"></video>`; }
  const headColor=w.headingColor||'var(--accent)';
  const textColor=w.textColor||'#e5e7eb';
  const contentHtml=`<h3 style="margin:0 0 12px;color:${headColor}">${escHtml(w.heading||'Credits')}</h3>${ccBuildContentHtml(w)}`;
  let panelHtml;
  if(w.style==='scroll'){
    panelHtml=`<div class="cc-scroll-wrap"><div class="cc-scroll-inner" id="cc-scroll-inner" style="color:${textColor}">${contentHtml}</div></div>
      <button class="tb-btn tb-slate" style="position:absolute;top:10px;right:10px;pointer-events:none" title="Always closeable in real play">${escHtml(w.closeLabel||'Close')}</button>`;
  } else {
    panelHtml=`<div class="cc-panel" style="color:${textColor}">${contentHtml}<button class="tb-btn tb-accent" style="margin-top:16px;pointer-events:none">${escHtml(w.closeLabel||'Close')}</button></div>`;
  }
  stage.innerHTML=`<div style="position:absolute;inset:0;background:#0b1120;border-radius:10px;overflow:hidden">
      ${bgHtml}
      <div style="position:absolute;inset:0;background:rgba(0,0,0,.55)"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:6%">
        ${panelHtml}
      </div>
    </div>`;
  if(w.style==='scroll'){
    const doMeasure=()=>{
      const inner=document.getElementById('cc-scroll-inner'); const wrap=inner&&inner.parentElement;
      if(!inner||!wrap) return;
      const dist=inner.scrollHeight + wrap.clientHeight;
      const dur=Math.max(4, dist/Math.max(10,w.scrollSpeed||40));
      inner.style.animationDuration=dur+'s';
    };
    if(typeof requestAnimationFrame==='function') requestAnimationFrame(doMeasure); else doMeasure();
  }
}

/* ---- save / reset / close (same dirty-check discipline as the Canvas
   editor's own working-copy pattern - see ceIsDirty()/ceRequestClose()) --- */
function ccIsDirty(){ return !!(_ccWork && _ccSavedSnapshot!==null && JSON.stringify(_ccWork)!==_ccSavedSnapshot); }
function saveCreditsScreenEditor(){
  pushUndo();
  if(!project.title) project.title={};
  project.title.showCredits=!!_ccWork.showCredits;
  project.title.creditsHeading=(_ccWork.heading||'').trim()||'Credits';
  project.creditsScreen={
    style:_ccWork.style, scrollSpeed:_ccWork.scrollSpeed,
    bg:Object.assign({}, _ccWork.bg), music:Object.assign({}, _ccWork.music),
    textColor:_ccWork.textColor, headingColor:_ccWork.headingColor, closeLabel:_ccWork.closeLabel,
    showAuthor:_ccWork.showAuthor, showTeam:_ccWork.showTeam, showAssetCredits:_ccWork.showAssetCredits, showSocials:_ccWork.showSocials
  };
  _ccSavedSnapshot=JSON.stringify(_ccWork);
  // keep the basic Settings -> Info & credits fields correct if that panel is open behind this one
  const chk=document.getElementById('pi-showcredits'), hd=document.getElementById('pi-creditshead');
  if(chk) chk.checked=project.title.showCredits;
  if(hd) hd.value=project.title.creditsHeading;
  toast('Credits screen saved');
}
function resetCreditsScreenEditor(){ _ccWork=JSON.parse(_ccSavedSnapshot); ccRenderControls(); ccRenderPreview(); }
function ccRequestClose(){
  if(!ccIsDirty()){ closeModal('credits-screen-modal'); return; }
  uiConfirm('Close the Credits screen editor without saving? Your changes will be lost.',
    ()=>closeModal('credits-screen-modal'),
    { yes:'Close without saving', no:'Keep editing',
      extra:{ label:'Save then close', onClick:()=>{ saveCreditsScreenEditor(); closeModal('credits-screen-modal'); } } });
}
