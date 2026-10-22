/* ============================================================================
   Scenemaker editor; project settings
   Part of the modular editor. Classic script sharing global scope with core.js.
   ==========================================================================*/
// #3: reference stage dimensions per canvas-size preset - every box/choices/
// portrait position is already stored as a PERCENTAGE of the stage, so
// switching presets is just a different reference width/height for that
// same percentage math, both here (Canvas editor) and in player/runtime.js
// (kept as a small duplicated constant there too, same as other tiny
// editor/player-shared tables in this codebase). 'widescreen' keeps the
// app's original 1000x640 exactly, so an existing project with no
// canvasSize set (or set to 'widescreen') renders byte-identical to before.
const CANVAS_SIZES = {
  widescreen:{ w:1000, h:640 },
  standard:  { w:1000, h:750 },
  portrait:  { w:562,  h:1000 },
  landscape: { w:1000, h:562 }
};
function ceCanvasSizeOf(){ const k=(project.settings&&project.settings.screen&&project.settings.screen.canvasSize)||'widescreen'; return CANVAS_SIZES[k]||CANVAS_SIZES.widescreen; }
// #13: changing the canvas size mid-project used to leave every stored
// layout's percentages untouched, which only looks right by coincidence -
// e.g. a box authored at h:27% (of a 640-tall widescreen stage, ~173
// design-px tall) silently becomes 27% of a 1000-tall portrait stage
// (~270px) instead, distorting under a very different aspect ratio. This
// reprojects every stage-relative x/y/w/h from the OLD reference resolution
// to the NEW one, preserving each element's absolute design size/position
// as closely as possible (clamped back on-stage) - the "nearest reasonable
// match" mid-project resize asked for. Values that are percentages of
// something OTHER than the whole stage (boxAlong - along an edge a box's
// own w/h already rescaled; a tab/portrait-attached name's x - likewise
// along an edge; offY/size - relative nudges) are left alone on purpose;
// they're already resolution-independent.
function ceRescaleLayoutToRef(L, oldRef, newRef){
  if(!L || !oldRef || !newRef) return;
  const rx=v=>((v/100)*oldRef.w)/newRef.w*100, ry=v=>((v/100)*oldRef.h)/newRef.h*100;
  ['box','box2','box3','box4'].forEach(k=>{
    const o=L[k]; if(!o) return;
    if(o.w!=null) o.w=Math.min(100, rx(o.w));
    if(o.h!=null) o.h=Math.min(100, ry(o.h));
    if(o.x!=null) o.x=Math.max(0, Math.min(rx(o.x), 100-(o.w||0)));
    if(o.y!=null) o.y=Math.max(0, Math.min(ry(o.y), 100-(o.h||0)));
  });
  if(L.choices && L.choices.mode==='free'){
    const o=L.choices;
    if(o.w!=null) o.w=Math.min(100, rx(o.w));
    if(o.x!=null) o.x=Math.max(0, Math.min(rx(o.x), 100-(o.w||0)));
    if(o.y!=null) o.y=Math.max(0, Math.min(100, ry(o.y)));
  }
  if(L.name && L.name.mode==='free'){
    if(L.name.x!=null) L.name.x=Math.max(0, Math.min(100, rx(L.name.x)));
    if(L.name.y!=null) L.name.y=Math.max(0, Math.min(100, ry(L.name.y)));
  }
  if(L.continuePrompt && L.continuePrompt.mode==='free'){
    if(L.continuePrompt.x!=null) L.continuePrompt.x=Math.max(0, Math.min(100, rx(L.continuePrompt.x)));
    if(L.continuePrompt.y!=null) L.continuePrompt.y=Math.max(0, Math.min(100, ry(L.continuePrompt.y)));
  }
  if(L.portraits && L.portraits.mode==='manual' && Array.isArray(L.portraits.slots)){
    L.portraits.slots.forEach(s=>{ if(!s) return;
      if(s.x!=null) s.x=Math.max(0, Math.min(100, rx(s.x)));
      if(s.y!=null) s.y=Math.max(0, Math.min(100, ry(s.y)));
    });
  }
}
// Rescales EVERY stored layout in the project (it's a project-wide canvas
// size, not a per-scope one) - project.layout plus every scene's and
// group's own override, so a scene/group that customized its layout
// doesn't silently stay tuned for the old aspect ratio.
function ceRescaleAllLayoutsForCanvasSize(oldRef, newRef){
  if(!oldRef || !newRef || (oldRef.w===newRef.w && oldRef.h===newRef.h)) return;
  if(project.layout) ceRescaleLayoutToRef(project.layout, oldRef, newRef);
  Object.values(scenes).forEach(s=>{ if(s.layout) ceRescaleLayoutToRef(s.layout, oldRef, newRef); });
  Object.values(backdrops).forEach(g=>{ if(g.layout) ceRescaleLayoutToRef(g.layout, oldRef, newRef); });
}
/* ---- focus / edit modal (#13) ------------------------------------------ */
function focusScene(id){ focusId=id; document.getElementById('focus-modal').classList.remove('hidden'); refreshFocus(); }
function closeFocus(){ focusId=null; document.getElementById('focus-modal').classList.add('hidden'); }
function refreshFocus(){
  if(!focusId||!scenes[focusId]) { closeFocus(); return; }
  const n=scenes[focusId];
  document.getElementById('focus-title').textContent='Edit: '+(n.title||'scene');
  /* Reuse the same builders (they mutate scenes[] via the same handlers). Ports are
     omitted here to avoid duplicate DOM ids; wiring is done on the canvas. */
  document.getElementById('focus-body').innerHTML=
    `<div style="font-size:15px">
       <div class="fld"><label>Scene title</label><input type="text" value="${escAttr(n.title)}" oninput="setTitle('${n.id}',this.value); document.getElementById('focus-title').textContent='Edit: '+this.value"></div>
       ${sceneMediaHtml(n)}
       <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">${n.lines.map(l=>lineHtml(n,l)).join('')}</div>
       <button class="mini-btn" style="margin-top:8px" onclick="addLine('${n.id}')">+ line</button>
       <div style="margin-top:12px">${choicesBlockHtml(n).replace(/<div class="port[^>]*><\/div>/g,'')}</div>
       <div class="sec" style="margin-top:14px"><h3>Scene effects</h3>
         <div class="hint" style="margin-bottom:6px">Overrides the group/project effect for this scene only.</div>
         ${typeof fxPickerHtml==='function'?fxPickerHtml(n.id):''}</div>
       ${typeof devNoteHtml==='function'?devNoteHtml(n):''}
     </div>`;
}


/* ---- title screen (#18) ------------------------------------------------- */
function pickTitleBg(type){ pickMedia(type==='video'?'video':'image').then(k=>{ if(k){ pushUndo();
  // #96: assigning a whole new {type,media} object here (the old code)
  // silently wiped bg.fit/bg.speed back to undefined every time a new
  // background was picked - only noticed because the title-screen editor's
  // own fit-mode picker kept "losing" whatever the author had just set.
  // Preserve everything else already on bg; only type/media actually change.
  project.title.bg=Object.assign({}, project.title.bg, {type,media:k}); refreshTitleUI();
  if(type!=='video' && typeof checkBgStretch==='function') checkBgStretch(k, ()=>{ undo(); refreshTitleUI(); }); } }); }
function clearTitleBg(){ pushUndo(); project.title.bg=Object.assign({}, project.title.bg, {type:'none',media:null}); refreshTitleUI(); }
function pickTitleMusic(){ pickMedia('audio').then(k=>{ if(k){ pushUndo(); project.title.music.media=k; refreshTitleUI(); } }); }
function clearTitleMusic(){ pushUndo(); project.title.music.media=null; refreshTitleUI(); }
function refreshTitleUI(){ const b=document.getElementById('tt-bg-label'), m=document.getElementById('tt-mu-label');
  if(b) b.textContent=project.title.bg&&project.title.bg.media?('✓ '+project.title.bg.type):'none';
  if(m) m.textContent=project.title.music&&project.title.music.media?'✓ set':'none'; }

/* ---- module icon (#4): shown as the browser-tab favicon in preview/export */
function pickModuleIcon(){ pickMedia('image').then(k=>{ if(k){ pushUndo(); project.meta.icon=k; refreshModuleIconUI(); } }); }
function clearModuleIcon(){ pushUndo(); project.meta.icon=null; refreshModuleIconUI(); }
function refreshModuleIconUI(){ const l=document.getElementById('st-icon-label'); if(l) l.textContent=(project.meta&&project.meta.icon)?'✓ set':'none'; }

/* ---- "click to continue" custom icon (#8) -------------------------------- */
function pickContIcon(){ pickMedia('image').then(k=>{ if(k){ pushUndo(); if(!project.settings.continuePrompt) project.settings.continuePrompt={}; project.settings.continuePrompt.iconMedia=k; refreshContIconUI(); } }); }
function clearContIcon(){ pushUndo(); if(project.settings.continuePrompt) project.settings.continuePrompt.iconMedia=null; refreshContIconUI(); }
function refreshContIconUI(){ const l=document.getElementById('st-cont-icon-label'); if(l) l.textContent=(project.settings.continuePrompt&&project.settings.continuePrompt.iconMedia)?'✓ set':'none'; }

/* ---- in-game menu cursor sound (choice buttons, HUD settings items) ----- */
function pickCursorSound(){ pickMedia('audio').then(k=>{ if(k){ pushUndo(); if(!project.settings.cursorSound) project.settings.cursorSound={enabled:false,media:null}; project.settings.cursorSound.media=k; refreshCursorSoundUI(); } }); }
function clearCursorSound(){ pushUndo(); if(project.settings.cursorSound) project.settings.cursorSound.media=null; refreshCursorSoundUI(); }
function refreshCursorSoundUI(){ const l=document.getElementById('st-cursorsound-label'); const cs=project.settings.cursorSound||{};
  if(l) l.textContent = cs.media ? '✓ custom sound set' : 'none (uses the built-in blip)'; }


/* ---- completion criteria (#16): multiple possible "endings" -------------
   A story used to have exactly one way to be marked complete (reach any
   ending scene, OR view a set number of scenes). This generalizes that
   single mode into a stacked LIST of criteria - same add/remove/reorder
   mechanism as the effects picker (fx-ui.js) - any ONE of which being true
   marks the learner complete, so a story can define several distinct
   "endings" (an ending scene, a scene-view count, a variable reaching some
   value) without picking just one. A project untouched by this still has
   exactly one legacy-shaped criterion, migrated in loadProject() below, so
   nothing changes for it until someone actually adds a second one. */
const COMPLETION_TYPES = [
  ['reachEnd', 'reach any ending scene'],
  ['viewCount', 'have viewed a number of scenes'],
  ['variable', 'a variable meets a condition'],
];
function ensureCompletionCriteria(){
  if(!project.settings.completion) project.settings.completion={mode:'reachEnd',count:1};
  if(!Array.isArray(project.settings.completion.criteria)){
    project.settings.completion.criteria=[{
      type: project.settings.completion.mode==='viewCount' ? 'viewCount' : 'reachEnd',
      count: project.settings.completion.count||1
    }];
  }
  return project.settings.completion.criteria;
}
function completionCriterionValueHtml(i,c,t){
  if(t==='bool') return `<select class="mini-sel" style="width:74px" onchange="setCompletionCriterion(${i},'value',this.value)"><option value="false" ${!c.value?'selected':''}>false</option><option value="true" ${c.value?'selected':''}>true</option></select>`;
  if(t==='text') return `<input type="text" class="mini-sel" style="width:100px" value="${escAttr(c.value)}" oninput="setCompletionCriterion(${i},'value',this.value)">`;
  return `<input type="number" class="mini-sel" style="width:60px" value="${c.value!=null?c.value:0}" oninput="setCompletionCriterion(${i},'value',this.value)">`;
}
function completionCriteriaHtml(){
  const list=ensureCompletionCriteria();
  const rows=list.map((c,i)=>{
    const typeSel=`<select class="mini-sel" onchange="setCompletionCriterion(${i},'type',this.value)">${COMPLETION_TYPES.map(t=>`<option value="${t[0]}" ${c.type===t[0]?'selected':''}>${t[1]}</option>`).join('')}</select>`;
    let extra='';
    if(c.type==='viewCount'){
      extra=`<span class="hint" style="margin:0">this many scenes:</span><input type="number" class="mini-sel" style="width:60px" min="1" value="${c.count||1}" oninput="setCompletionCriterion(${i},'count',this.value)">`;
    } else if(c.type==='variable'){
      const vt=(varById(c.var)||{}).type||'number';
      extra=`<select class="mini-sel" onchange="setCompletionCriterion(${i},'var',this.value)">${varOptions(c.var)}</select>
        <select class="mini-sel" onchange="setCompletionCriterion(${i},'cmp',this.value)">${cmpsForType(vt).map(o=>`<option value="${o}" ${c.cmp===o?'selected':''}>${o}</option>`).join('')}</select>
        ${completionCriterionValueHtml(i,c,vt)}`;
    }
    return `<div class="mini-row" style="flex-wrap:wrap">${typeSel}${extra}
      <button class="mini-btn" onclick="moveCompletionCriterion(${i},-1)" title="Move earlier" ${i===0?'disabled':''}>▲</button>
      <button class="mini-btn" onclick="moveCompletionCriterion(${i},1)" title="Move later" ${i===list.length-1?'disabled':''}>▼</button>
      <span class="row-x" onclick="removeCompletionCriterion(${i})" title="${list.length<=1?'At least one criterion is required':'Remove this criterion'}" ${list.length<=1?'style="opacity:.35;pointer-events:none"':''}>✕</span></div>`;
  }).join('');
  return `<div class="hint" style="margin-bottom:6px">Complete the moment <b>any one</b> of these is true - add more than one to give a story several distinct endings.</div>${rows}
    <button class="mini-btn" style="margin-top:6px" onclick="addCompletionCriterion()" title="Add another way this story can be marked complete">+ criterion</button>`;
}
function refreshCompletionCriteriaUI(){ const box=document.getElementById('st-completion-box'); if(box) box.innerHTML=completionCriteriaHtml(); }
function addCompletionCriterion(){ pushUndo(); ensureCompletionCriteria().push({type:'reachEnd'}); refreshCompletionCriteriaUI(); }
function removeCompletionCriterion(i){ const list=ensureCompletionCriteria(); if(list.length<=1) return; pushUndo(); list.splice(i,1); refreshCompletionCriteriaUI(); }
function moveCompletionCriterion(i,delta){ const list=ensureCompletionCriteria(); const j=i+delta; if(j<0||j>=list.length) return; pushUndo(); const t=list[i]; list[i]=list[j]; list[j]=t; refreshCompletionCriteriaUI(); }
function setCompletionCriterion(i,field,v){
  const list=ensureCompletionCriteria(); const c=list[i]; if(!c) return;
  pushUndo();
  if(field==='type'){
    const nc={type:v};
    if(v==='viewCount') nc.count=1;
    else if(v==='variable'){ const v0=project.variables&&project.variables[0]; nc.var=v0?v0.id:''; const t=(v0||{}).type||'number'; nc.cmp=cmpsForType(t)[0]; nc.value=v0?varDefault(t):0; }
    list[i]=nc;
  } else if(field==='count'){ c.count=parseInt(v,10)||1; }
  else if(field==='var'){ c.var=v; const t=(varById(v)||{}).type||'number'; c.cmp=cmpsForType(t)[0]; c.value=varDefault(t); }
  else if(field==='cmp'){ c.cmp=v; }
  else if(field==='value'){ const t=(varById(c.var)||{}).type||'number'; c.value=coerceVal(t,v); }
  refreshCompletionCriteriaUI();
}

/* ---- settings modal ----------------------------------------------------- */
let _settingsHintsLinkified=false; // #15: see the guarded call near the end of openStorySettings()
function openStorySettings(section){
  if(typeof ensureProjectInfo==='function') ensureProjectInfo();
  document.getElementById('st-title').value=project.meta.title;
  refreshModuleIconUI();
  const sel=document.getElementById('st-start'); const mainScenes=Object.values(scenes).filter(s=>(typeof sceneLayer!=='function')||sceneLayer(s)==='main'); sel.innerHTML=mainScenes.map(s=>`<option value="${s.id}" ${project.settings.startScene===s.id?'selected':''}>${escHtml(s.title)}</option>`).join('')||'<option value="">(no scenes yet)</option>';
  refreshCompletionCriteriaUI();
  document.getElementById('st-smart').checked=!!project.settings.useSmartRouting;
  const sc=project.settings.screen||{};
  document.getElementById('st-canvassize').value=sc.canvasSize||'widescreen';
  document.getElementById('st-style').value=sc.style||'plain';
  document.getElementById('st-border').checked=!!sc.border;
  document.getElementById('st-radius').value=sc.radius!=null?sc.radius:16;
  document.getElementById('st-bwidth').value=sc.width!=null?sc.width:6;
  document.getElementById('st-font').value=sc.font||'system';
  document.getElementById('st-lockdown').checked=!!sc.lockdown;
  document.getElementById('st-charcolorborders').checked=!!sc.charColorBorders;
  const ld=project.settings.loading||{};
  document.getElementById('st-load-text').value=ld.text||'';
  document.getElementById('st-load-color').value=ld.color||'';
  document.getElementById('st-load-color-swatch').value=ld.color||'#e879f9';
  const cp=(project.settings.continuePrompt)||{}; const gv=id=>document.getElementById(id);
  if(gv('st-cont-on')) gv('st-cont-on').checked=cp.enabled!==false;
  if(gv('st-cont-text')) gv('st-cont-text').value=cp.text||'click to continue';
  if(gv('st-cont-align')) gv('st-cont-align').value=cp.align||'right';
  if(gv('st-cont-size')) gv('st-cont-size').value=cp.size||13;
  if(gv('st-cont-style')) gv('st-cont-style').value=cp.style||'blinkArrow';
  if(gv('st-cont-placement')) gv('st-cont-placement').value=cp.placement||'box';
  if(gv('st-cont-x')) gv('st-cont-x').value=cp.x!=null?cp.x:50;
  if(gv('st-cont-y')) gv('st-cont-y').value=cp.y!=null?cp.y:92;
  if(gv('st-cont-free-wrap')) gv('st-cont-free-wrap').style.display=(cp.placement==='free')?'flex':'none';
  const cpKeys=cp.keys||[];
  if(gv('st-cont-key-space')) gv('st-cont-key-space').checked=cpKeys.indexOf('Space')!==-1;
  if(gv('st-cont-key-enter')) gv('st-cont-key-enter').checked=cpKeys.indexOf('Enter')!==-1;
  if(gv('st-cont-key-right')) gv('st-cont-key-right').checked=cpKeys.indexOf('ArrowRight')!==-1;
  if(gv('st-cont-icon-anim')) gv('st-cont-icon-anim').value=cp.iconAnim||'none';
  refreshContIconUI();
  if(typeof FONT_CSS!=='undefined'){ Array.prototype.forEach.call(document.querySelectorAll('#st-font option'), function(o){ if(FONT_CSS[o.value]) o.style.fontFamily=FONT_CSS[o.value]; }); }
  const tx=project.settings.text||{mode:'letter',speed:5};
  document.getElementById('st-textmode').value=tx.mode||'letter';
  document.getElementById('st-textspeed').value=tx.speed!=null?tx.speed:5;
  document.getElementById('st-textoverflow').value=project.settings.textOverflow||'scroll';
  if(!project.settings.debug) project.settings.debug=defaultDebug();
  debugSettingsOpen();
  document.getElementById('st-endrestart').checked=project.settings.endRestart!==false;
  const t=project.title||{};
  document.getElementById('tt-enabled').checked=!!t.enabled;
  document.getElementById('tt-heading').value=t.heading||'';
  document.getElementById('tt-sub').value=t.subheading||'';
  document.getElementById('tt-start').value=t.startLabel||'Start';
  document.getElementById('tt-return').checked=t.returnOnEnd!==false;
  refreshTitleUI(); renderVarList(); renderCharList();
  loadToolTheme();
  if(typeof loadWorkspacePrefsUI==='function') loadWorkspacePrefsUI();
  document.getElementById('story-modal').classList.remove('hidden');
  if(typeof openProjectInfo==='function') openProjectInfo();
  if(typeof fxListHtml==='function'){ const fb=document.getElementById('fx-project-box'); if(fb) fb.innerHTML=fxListHtml('project'); }
  if(typeof openHudSettings==='function') openHudSettings();
  if(typeof showSettingsSection==='function') showSettingsSection(section||'story');
  if(typeof maybeShowMini==='function') maybeShowMini('settings');
  // #15: turn feature mentions in the Settings modal's own hint text (e.g.
  // "Looking for Characters or Variables?") into links straight to that
  // Help topic. The modal's static hint text never changes once built, so
  // this only needs to run the first time it's actually shown; running it
  // again on every reopen would be harmless (already-linked text is
  // skipped, see _hiLinkifyBox) but is simply unnecessary work.
  if(!_settingsHintsLinkified && typeof _hiLinkifyBox==='function'){
    _hiLinkifyBox(document.getElementById('story-modal'), { excludeKeys:['settings'], onClick:jumpToHelpTopic });
    _settingsHintsLinkified=true;
  }
}
function saveStorySettings(){
  project.meta.title=document.getElementById('st-title').value||'Untitled Story';
  project.settings.startScene=document.getElementById('st-start').value||null;
  // completion.criteria is mutated live by setCompletionCriterion() etc. (same
  // pattern as the stacked-effects picker), nothing to read back here.
  project.settings.useSmartRouting=document.getElementById('st-smart').checked;
  globalSettings.useSmartRouting=project.settings.useSmartRouting;
  // #13: rescale every stored layout to match, BEFORE the setting itself changes.
  const oldCanvasRef=ceCanvasSizeOf();
  project.settings.screen={
    canvasSize:document.getElementById('st-canvassize').value,
    style:document.getElementById('st-style').value,
    border:document.getElementById('st-border').checked,
    radius:parseInt(document.getElementById('st-radius').value,10)||0,
    width:parseInt(document.getElementById('st-bwidth').value,10)||0,
    font:document.getElementById('st-font').value,
    lockdown:document.getElementById('st-lockdown').checked,
    charColorBorders:document.getElementById('st-charcolorborders').checked
  };
  ceRescaleAllLayoutsForCanvasSize(oldCanvasRef, ceCanvasSizeOf());
  // #146: an unrecognized/blank hex just falls back to the player's own
  // default accent colour (normalizeHex() returns null for either) rather
  // than blocking Save on a strict validation error - low-stakes cosmetic
  // setting, not worth the friction.
  project.settings.loading={
    text:(document.getElementById('st-load-text')||{}).value||'',
    color:normalizeHex((document.getElementById('st-load-color')||{}).value)||''
  };
  { const _contKeys=[];
    if((document.getElementById('st-cont-key-space')||{}).checked) _contKeys.push('Space');
    if((document.getElementById('st-cont-key-enter')||{}).checked) _contKeys.push('Enter');
    if((document.getElementById('st-cont-key-right')||{}).checked) _contKeys.push('ArrowRight');
    const _priorCp=project.settings.continuePrompt||{};
    project.settings.continuePrompt={ enabled:document.getElementById('st-cont-on')?document.getElementById('st-cont-on').checked:true, text:(document.getElementById('st-cont-text')||{}).value||'click to continue', align:(document.getElementById('st-cont-align')||{}).value||'right', size:parseInt((document.getElementById('st-cont-size')||{}).value,10)||13, style:(document.getElementById('st-cont-style')||{}).value||'blinkArrow', placement:(document.getElementById('st-cont-placement')||{}).value||'box', x:parseInt((document.getElementById('st-cont-x')||{}).value,10),y:parseInt((document.getElementById('st-cont-y')||{}).value,10), keys:_contKeys, iconMedia:_priorCp.iconMedia||null, iconAnim:(document.getElementById('st-cont-icon-anim')||{}).value||'none' };
  }
  project.settings.text={ mode:document.getElementById('st-textmode').value, speed:parseInt(document.getElementById('st-textspeed').value,10)||5 };
  project.settings.textOverflow=(document.getElementById('st-textoverflow')||{}).value||'scroll';
  debugSettingsSave();
  if(typeof saveProjectInfo==='function') saveProjectInfo();
  project.settings.endRestart=document.getElementById('st-endrestart').checked;
  project.title.enabled=document.getElementById('tt-enabled').checked;
  project.title.heading=document.getElementById('tt-heading').value;
  project.title.subheading=document.getElementById('tt-sub').value;
  project.title.startLabel=document.getElementById('tt-start').value||'Start';
  project.title.returnOnEnd=document.getElementById('tt-return').checked;
  closeModal('story-modal'); renderScenes(); toast('Settings saved');
}

