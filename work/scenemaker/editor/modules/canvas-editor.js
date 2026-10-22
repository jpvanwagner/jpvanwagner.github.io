/* ============================================================================
   Scenemaker editor; Canvas editor  (full-window, live preview)
   Features #1 live preview (with a built-in sample scene), #2 multi-portrait &
   dual dialogue boxes, #3 box + font resize with auto-fit, #4 box transparency,
   plus templates & element animations. Shares core.js scope.
   ==========================================================================*/
const CANVAS_DEFAULT = {
  // #103: 'alpha' is the WHOLE element's opacity (text and all) - distinct
  // from the box's own long-standing 'bgAlpha', which only fades its
  // background fill so the text stays fully readable over a see-through
  // backdrop. Boxes 2-4 share the main box's alpha (same as they already
  // share its fontSize/bgAlpha), not a separate field each.
  box:{x:2,y:70,w:96,h:27, fontSize:19, autoFit:false, bgAlpha:100, alpha:100, locked:false},
  box2:{enabled:false, combine:false, x:2, y:4, w:96, h:20, locked:false},
  box3:{enabled:false, combine:false, x:2, y:26, w:47, h:20, locked:false},
  box4:{enabled:false, combine:false, x:51, y:26, w:47, h:20, locked:false},
  choices:{mode:'inBox',x:54,y:34,w:44,align:'center', alpha:100, locked:false},
  // #6: mode 'box' attaches every portrait to the main dialogue box's own
  // edge (boxSide), spaced along that edge either evenly or, once dragged,
  // per-portrait via boxAlong[i] (0-100, % along the edge) - see
  // ceBoxAttachPos() below, mirrored exactly in player/layout.js.
  // #5: matchBoxBorder only means anything in 'box' attach mode - gives every
  // portrait the SAME border the dialogue box itself already uses (the
  // theme's own accent-coloured edge), instead of no border at all, so an
  // anchored portrait visually reads as part of the box it's attached to.
  portraits:{anchor:'bottom',offY:0, mode:'auto', slots:[], boxSide:'top', boxAlong:[], shape:'square', size:38, fit:'contain', alpha:100, overrideChars:false, matchBoxBorder:false, locked:false},
  name:{mode:'inBox', x:6, y:62, orient:'horizontal', bg:true, matchBox:false, textColor:'', alpha:100, locked:false},
  continuePrompt:{enabled:false, mode:'inBox', x:88, y:92, align:'right', locked:false},
  // #55: each element can stack several simultaneous entrance effects (not
  // just one), each with its own delay/speed - see ceNormalizeAnimList().
  anim:{box:[{type:'fade',dir:'up',delay:0,speed:1}], choices:[{type:'fade',dir:'up',delay:0,speed:1}], portraits:[{type:'fade',dir:'up',delay:0,speed:1}]}
};
/* normalizes either shape (a real effect list, or an older single
   {type,dir} object) into a real list - mirrors player/layout.js's
   normalizeAnimList() exactly, since both must agree on what a saved
   project's anim field means. */
function ceNormalizeAnimList(v){
  if(Array.isArray(v)) return v.map(a=>({type:(a&&a.type)||'fade', dir:(a&&a.dir)||'up', delay:(a&&a.delay)||0, speed:(a&&a.speed>0)?a.speed:1}));
  if(v && v.type && v.type!=='none') return [{type:v.type, dir:v.dir||'up', delay:0, speed:1}];
  return [];
}
// #1: each template also names how many sample portraits fit its design
// (portraitCount) and, where the layout implies a specific arrangement
// rather than a plain even spread, an explicit manual slot per portrait -
// applyCanvasTemplate() below applies both, not just the box/choices shape.
const CANVAS_TEMPLATES = {
  classic:  { label:'Classic; box + in-box choices',        portraitCount:2, l:{box:{x:3,y:68,w:94,h:29},box2:{x:3,y:4,w:94,h:24},choices:{mode:'inBox',align:'left'},portraits:{anchor:'bottom'}} },
  cinematic:{ label:'Cinematic; wide box, centered choices', portraitCount:2, l:{box:{x:8,y:76,w:84,h:20},box2:{x:8,y:5,w:84,h:18},choices:{mode:'free',x:30,y:34,w:40,align:'center'},portraits:{anchor:'bottom'}} },
  storybook:{ label:'Storybook; centered box',               portraitCount:1, l:{box:{x:18,y:58,w:64,h:24},box2:{x:18,y:6,w:64,h:22},choices:{mode:'free',x:25,y:86,w:50,align:'center'},portraits:{anchor:'center',offY:-6}} },
  party:    { label:'Party; box left, choices right',        portraitCount:3, l:{box:{x:3,y:70,w:52,h:27},box2:{x:45,y:70,w:52,h:27},choices:{mode:'free',x:60,y:6,w:37,align:'left'},portraits:{anchor:'bottom'}} },
  topbar:   { label:'Top bar; box up top',                   portraitCount:2, l:{box:{x:3,y:3,w:94,h:24},box2:{x:3,y:72,w:94,h:24},choices:{mode:'free',x:30,y:80,w:40,align:'center'},portraits:{anchor:'bottom'}} },
  novel:    { label:'Visual novel; box bottom, side choices', portraitCount:2, l:{box:{x:2,y:72,w:96,h:26},box2:{x:2,y:4,w:96,h:22},choices:{mode:'free',x:62,y:32,w:36,align:'left'},portraits:{anchor:'bottom'}} },
  // Duo: portraits sit side by side in the band between the two boxes
  // (box2 ends at y:27, box starts at y:70), not evenly auto-spread across
  // the whole stage, since two speakers standing together is the whole idea.
  duo:      { label:'Two speakers; top & bottom boxes',       portraitCount:2, l:{box:{x:4,y:70,w:92,h:24},box2:{enabled:true,x:4,y:5,w:92,h:22},choices:{mode:'inBox'},portraits:{mode:'manual',slots:[{x:30,y:48},{x:70,y:48}]}} },
  // Sidebar: portraits stack on the LEFT since the box occupies the right side.
  sidebar:  { label:'Sidebar; tall box on the right',         portraitCount:2, l:{box:{x:60,y:6,w:37,h:88},choices:{mode:'inBox',align:'left'},portraits:{mode:'manual',slots:[{x:22,y:80},{x:22,y:35}]}} },
  lowerthird:{ label:'Lower third; slim caption bar',         portraitCount:2, l:{box:{x:0,y:82,w:100,h:16,fontSize:22},choices:{mode:'free',x:30,y:60,w:40,align:'center'},portraits:{anchor:'bottom'}} },
  fullscreen:{ label:'Full-screen text (no box art)',          portraitCount:1, l:{box:{x:12,y:20,w:76,h:60,bgAlpha:0,fontSize:26},choices:{mode:'free',x:30,y:82,w:40,align:'center'},portraits:{anchor:'bottom'}} },
  // Corner chat: a single small avatar tucked near its own small box.
  cornerchat:{ label:'Corner chat; small box bottom-left',    portraitCount:1, l:{box:{x:3,y:66,w:44,h:30},choices:{mode:'free',x:52,y:70,w:44,align:'left'},portraits:{mode:'manual',slots:[{x:15,y:45}]}} }
};
const ANIM_TYPES=[['none','None'],['fade','Fade'],['slide','Slide'],['pop','Pop'],['swoop','Swoop'],['glitch','Glitch']];
const ANIM_DIRS=[['up','Up'],['down','Down'],['left','Left'],['right','Right']];
const CE_SAMPLE={ speaker:'Cloud', text:'This is it. No turning back now.',
  choices:['Let\u2019s mosey','Move out'] };

let _ceScope='project', _ceWork=null, _ceDrag=null, _cePortraitN=2, _ceUndo=[], _ceRedo=[];
// #129: a JSON snapshot of _ceWork exactly as it stood right after opening
// (or the last real Save) - compared against the live _ceWork to answer
// "has anything changed since the last save" for the Close-without-saving
// warning below. Deliberately NOT touched by Reset or loading a named
// layout: both change _ceWork without persisting it to the project either,
// so they're correctly still "unsaved" until a real Save.
let _ceSavedSnapshot=null;
/* #8: which element's properties the sidebar currently shows - like the main
   editor's Properties panel, only the selected element's own controls
   appear, instead of every element's settings stacked in one long scroll.
   'box2'/'box3'/'box4' and the per-index 'portrait' drag target normalize
   to their group ('box' / 'portraits') for panel purposes. */
let _ceSelected=null;
const CE_ELEMENT_LABELS={ box:'Dialogue box', choices:'Choices', portraits:'Portraits', name:'Speaker name', continuePrompt:'"Click to continue" prompt', narrator:'Narrator text' };
function ceNormalizeEl(el){ if(el==='box2'||el==='box3'||el==='box4') return 'box'; if(el==='portrait') return 'portraits'; return el; }
function ceSelect(el){ _ceSelected=ceNormalizeEl(el); renderCanvasControls(); }
function ceDeselect(){ _ceSelected=null; _ceMultiSel.clear(); renderCanvasControls(); renderCanvasMultiHighlight(); }
// #99: multi-select group move + saved groups, alongside (not instead of) the
// existing single-element selection above. Scoped to only the elements that
// already store a plain, stage-absolute x/y of their own - the dialogue box,
// boxes 2-4, free-mode choices, a free-mode "click to continue" prompt, and
// the name tag ONLY in free mode (tab/portrait/inBox modes each have their
// own relative coordinate space, not a uniform one a group move could apply
// the same delta to). Portraits keep their existing per-portrait dragging,
// untouched.
let _ceMultiSel = new Set();
function _ceHasXY(el){
  if(el==='box'||el==='box2'||el==='box3'||el==='box4') return true;
  if(el==='choices') return _ceWork.choices.mode==='free';
  if(el==='name') return _ceWork.name.mode==='free';
  if(el==='continuePrompt') return true;
  return false;
}
function _ceGroupsArr(){ if(!Array.isArray(_ceWork.groups)) _ceWork.groups=[]; return _ceWork.groups; }
function _ceFindGroupContaining(el){ return _ceGroupsArr().find(g=>g.includes(el)) || null; }
function _ceSelectionMatchesGroup(){ const cur=[..._ceMultiSel].sort().join(','); return _ceGroupsArr().find(g=>[...g].sort().join(',')===cur) || null; }
function renderCanvasMultiHighlight(){
  Object.keys(CE_Z_DOM_ID).forEach(k=>{ const el=document.getElementById(CE_Z_DOM_ID[k]); if(el) el.classList.toggle('ce-multi-sel', _ceMultiSel.size>1 && _ceMultiSel.has(k)); });
}
function ceGroupSelected(){
  if(_ceMultiSel.size<2) return;
  ceSnapshot();
  _ceGroupsArr().push([..._ceMultiSel]);
  toast(_ceMultiSel.size+' elements grouped; click any one of them to select the whole group again');
}
function ceUngroupSelected(){
  const g=_ceSelectionMatchesGroup(); if(!g) return;
  ceSnapshot();
  const arr=_ceGroupsArr(); const i=arr.indexOf(g); if(i>=0) arr.splice(i,1);
  toast('Ungrouped; the elements stay right where they are');
}
function ceMultiZOrder(toFront){
  if(_ceMultiSel.size<2) return;
  ceSnapshot();
  const zs=Object.keys(CE_Z_DOM_ID).map(k=>{ const t=ceLockTarget(k); return (t&&t.z!=null)?t.z:0; });
  const z = toFront ? Math.max.apply(null,zs)+1 : Math.min.apply(null,zs)-1;
  _ceMultiSel.forEach(el=>{ const o=ceLockTarget(el); if(o) o.z=z; });
  ceApplyZOrder();
}
function _ceGroupOutOfBounds(){
  const tol=0.5;
  return [..._ceMultiSel].some(k=>{ const o=_ceWork[k]; if(!o) return false; return o.x<-tol||o.y<-tol||(o.x+(o.w||0))>100+tol||(o.y+(o.h||0))>100+tol; });
}
/* the raw per-object lock target for a click - box2/3/4 each lock
   independently even though they share the "Dialogue box" panel */
function ceLockTarget(rawEl){ return rawEl==='portrait' ? _ceWork.portraits : _ceWork[rawEl]; }
function setCanvasElementLocked(rawEl,on){ const o=ceLockTarget(rawEl); if(o) o.locked=!!on; renderCanvasControls(); }
/* #72: stacking order among the Canvas editor's own top-level elements
   (the dialogue box(es), choices when free-floating, portraits, speaker
   name, "click to continue" prompt). Each is independently position:
   absolute, so each one is its OWN stacking context - overriding one
   element's z-index here can never disturb the internal layering of
   another element's children (its own resize handle, lock badge). `z` is
   left undefined on every project that's never touched this, so it's a
   pure no-op reading the original fixed-per-role CSS z-indices (box 5,
   portraits 3, name 7, continuePrompt 8) exactly as before. */
const CE_Z_DOM_ID = { box:'ce-box', box2:'ce-box2', box3:'ce-box3', box4:'ce-box4', choices:'ce-choices', portraits:'ce-portraits', name:'ce-name', continuePrompt:'ce-cont' };
function ceApplyZOrder(){
  Object.keys(CE_Z_DOM_ID).forEach(k=>{
    const el=document.getElementById(CE_Z_DOM_ID[k]); if(!el) return;
    const o=ceLockTarget(k);
    el.style.zIndex = (o && o.z!=null) ? String(100+o.z) : '';
  });
}
function setCanvasElementZ(rawEl,toFront){
  if(rawEl==='portrait') return; // an individual sample portrait shares its container's stacking, nothing to reorder among them
  const o=ceLockTarget(rawEl); if(!o) return;
  ceSnapshot();
  const zs=Object.keys(CE_Z_DOM_ID).map(k=>{ const t=ceLockTarget(k); return (t&&t.z!=null)?t.z:0; });
  o.z = toFront ? Math.max.apply(null,zs)+1 : Math.min.apply(null,zs)-1;
  ceApplyZOrder();
}
/* #11: right-click any live-preview element for a quick lock/reset menu,
   built on the same generic showContextMenu() the main scene graph already
   uses. Right-clicking also selects the element, same as a left-click,
   so the sidebar switches to its properties at the same time. */
function ceContextMenu(e,rawEl,idx){
  e.preventDefault(); e.stopPropagation();
  if(typeof showContextMenu!=='function') return;
  // #99: right-clicking a saved-group member (or one already part of an
  // ad-hoc multi-selection) keeps/restores the whole group first, same as a
  // plain click - so the group actions below act on what's actually
  // selected, not just whichever element happened to be under the cursor.
  if(_ceHasXY(rawEl) && !_ceMultiSel.has(rawEl)){
    const g=_ceFindGroupContaining(rawEl); _ceMultiSel = g ? new Set(g) : new Set([rawEl]);
    renderCanvasMultiHighlight();
  }
  ceSelect(rawEl);
  const norm=ceNormalizeEl(rawEl); const label=CE_ELEMENT_LABELS[norm]||norm;
  const canLock = !(rawEl==='name' && _ceWork.name.mode==='inBox');
  const items=[];
  if(canLock){ const o=ceLockTarget(rawEl);
    items.push({ icon:(o&&o.locked)?'🔓':'🔒', label:(o&&o.locked)?'Unlock position':'Lock position', onClick:()=>setCanvasElementLocked(rawEl, !(o&&o.locked)) });
  }
  items.push({ icon:'↺', label:(rawEl==='portrait')?'Reset this portrait’s position':`Reset ${label.toLowerCase()} to default`, onClick:()=>resetCanvasElement(rawEl, idx) });
  if(rawEl!=='portrait'){
    items.push({ sep:true });
    items.push({ icon:'⬆', label:'Bring to front', onClick:()=>setCanvasElementZ(rawEl,true) });
    items.push({ icon:'⬇', label:'Send to back', onClick:()=>setCanvasElementZ(rawEl,false) });
  }
  // #99: multi-select group actions, only when 2+ elements are actually
  // selected together (a lone element sticks with the single-element
  // actions above).
  if(_ceMultiSel.size>1 && _ceMultiSel.has(rawEl)){
    items.push({ sep:true });
    const n=_ceMultiSel.size;
    if(_ceSelectionMatchesGroup()){ items.push({ icon:'🔗', label:`Ungroup (${n} elements)`, onClick:()=>ceUngroupSelected() }); }
    else { items.push({ icon:'🔗', label:`Group these ${n} elements`, onClick:()=>ceGroupSelected() }); }
    items.push({ icon:'⬆', label:'Bring group to front', onClick:()=>ceMultiZOrder(true) });
    items.push({ icon:'⬇', label:'Send group to back', onClick:()=>ceMultiZOrder(false) });
  }
  showContextMenu(e.clientX, e.clientY, items);
}
/* reset one element back to its defaults, instead of the whole layout
   (the toolbar's "Reset" button). A sample portrait has no CANVAS_DEFAULT
   entry of its own - only its manual slot (if any) is cleared, reverting it
   to the auto-spread position for that index. */
function resetCanvasElement(rawEl,idx){
  ceSnapshot();
  if(rawEl==='portrait'){
    if(Array.isArray(_ceWork.portraits.slots) && idx!=null && _ceWork.portraits.slots[idx]!=null){
      _ceWork.portraits.slots[idx]={x:Math.round((idx+0.5)*100/_cePortraitN), y:70};
    }
  } else if(CANVAS_DEFAULT[rawEl]){
    _ceWork[rawEl]=JSON.parse(JSON.stringify(CANVAS_DEFAULT[rawEl]));
  }
  renderCanvasControls(); renderCanvasPreview();
}
function ceSnapshot(){ if(_ceWork){ _ceUndo.push(JSON.stringify(_ceWork)); if(_ceUndo.length>50)_ceUndo.shift(); _ceRedo.length=0; } }
function ceUndo(){ if(!_ceUndo.length) return; _ceRedo.push(JSON.stringify(_ceWork)); _ceWork=JSON.parse(_ceUndo.pop()); renderCanvasControls(); renderCanvasPreview(); }
function ceRedo(){ if(!_ceRedo.length) return; _ceUndo.push(JSON.stringify(_ceWork)); _ceWork=JSON.parse(_ceRedo.pop()); renderCanvasControls(); renderCanvasPreview(); }
function _ceMaxBoxes(){ let mx=1; Object.values(scenes).forEach(sc=>{ const spk=new Set(); (sc.lines||[]).forEach(l=>{ if(l.speakingCast) spk.add(l.speakingCast); }); mx=Math.max(mx, Math.min(2, spk.size||1)); }); return mx; }
function _ceMaxPortraits(scopeSceneId){
  let mx=1;
  const scan=(sc)=>{ (sc.lines||[]).forEach(l=>{ const on=new Set(); (l.stage||[]).forEach(st=>{ if(st.castId) on.add(st.castId); }); if(!(l.stage&&l.stage.length)) (sc.cast||[]).forEach(c=>on.add(c.id)); mx=Math.max(mx,on.size); }); if(!(sc.lines&&sc.lines.length)) mx=Math.max(mx,(sc.cast||[]).length); };
  if(scopeSceneId && scenes[scopeSceneId]) scan(scenes[scopeSceneId]);
  else Object.values(scenes).forEach(scan);
  return Math.max(1,Math.min(6,mx));
}

function _ceFace(letter,hue){ var svg='<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160">'
  +'<rect width="120" height="160" fill="hsl('+hue+',30%,32%)"/>'
  +'<circle cx="60" cy="58" r="30" fill="hsl('+hue+',34%,52%)"/>'
  +'<path d="M18 160 C18 118 40 100 60 100 C80 100 102 118 102 160 Z" fill="hsl('+hue+',34%,52%)"/>'
  +'<text x="60" y="150" font-size="18" font-family="sans-serif" font-weight="800" fill="#ffffffcc" text-anchor="middle">'+letter+'</text></svg>';
  return 'data:image/svg+xml;base64,'+btoa(svg); }
/* which real character (if any) sample portrait slot i should stand in for:
   the actual on-stage cast, in order, for a scene-scoped layout, else the
   project's character library by index - so the preview looks like your
   real cast wherever there's enough info to know who's who. */
function _ceSampleCharFor(i){
  const sc = scenes[_ceScope];
  if(sc && Array.isArray(sc.cast) && sc.cast[i]) return castProps(sc.cast[i]);
  const chars = project.characters||[];
  return chars[i] || null;
}

function layoutTarget(scope){
  if(scope==='project'){ if(!project.layout) project.layout=JSON.parse(JSON.stringify(CANVAS_DEFAULT)); return project; }
  if(scenes[scope]) return scenes[scope];
  if(backdrops[scope]) return backdrops[scope];
  return project;
}
// #13: the same project-wide canvas size Story settings offers, right from
// the Canvas editor's own topbar - it's a single project setting (not
// per-scope), so changing it here rescales every scene/group's own layout
// override too (ceRescaleAllLayoutsForCanvasSize, project-settings.js), not
// just whichever scope happens to be open right now.
function setCanvasEditorCanvasSize(v){
  const oldRef=ceCanvasSizeOf(), newRef=CANVAS_SIZES[v]||CANVAS_SIZES.widescreen;
  const apply=()=>{
    if(!project.settings.screen) project.settings.screen={};
    project.settings.screen.canvasSize=v;
    ceRescaleAllLayoutsForCanvasSize(oldRef, newRef);
    _dirty=true;
    // the old undo history refers to layouts at the OLD aspect ratio, now
    // stale everywhere (not just in this scope) - starting fresh avoids an
    // "Undo" that quietly reverts to a size that no longer matches Settings.
    _ceUndo=[]; _ceRedo=[];
    openCanvasEditor(_ceScope);
    toast('Canvas size changed; existing layouts rescaled to match.');
  };
  if(oldRef.w===newRef.w && oldRef.h===newRef.h){ apply(); return; }
  uiConfirm('Change the project’s canvas size? Box, choice, and portrait positions across every scene and group will be rescaled to fit the new shape as closely as possible.',
    apply,
    { yes:'Change size', no:'Cancel',
      onNo:()=>{ const sel=document.getElementById('ce-canvassize'); if(sel) sel.value=(project.settings.screen&&project.settings.screen.canvasSize)||'widescreen'; } });
}
function openCanvasEditor(scope){
  if(typeof maybeShowMini==='function') maybeShowMini('canvas');
  _ceScope=scope||'project';
  const tgt=layoutTarget(_ceScope);
  _ceWork = tgt.layout ? JSON.parse(JSON.stringify(tgt.layout)) : JSON.parse(JSON.stringify(CANVAS_DEFAULT));
  ['box','box2','box3','box4','choices','portraits','name','anim','continuePrompt'].forEach(k=>{ _ceWork[k]=Object.assign({}, CANVAS_DEFAULT[k], _ceWork[k]||{}); });
  ['box','choices','portraits'].forEach(k=>{ _ceWork.anim[k]=ceNormalizeAnimList(_ceWork.anim&&_ceWork.anim[k]); });
  if(!Array.isArray(_ceWork.portraits.slots)) _ceWork.portraits.slots=[];
  if(!Array.isArray(_ceWork.groups)) _ceWork.groups=[];   // #99: saved multi-select groups, additive/backward-compatible
  _ceSavedSnapshot=JSON.stringify(_ceWork);   // #129: this scope's own clean baseline, freshly opened
  _ceMultiSel=new Set();   // a fresh scope starts with nothing multi-selected
  // count sample portraits from the actual cast when a scene is scoped
  _cePortraitN = _ceMaxPortraits(scenes[_ceScope]?_ceScope:null) || 2;
  ceEnsureDom(); renderCanvasControls(); renderCanvasPreview();
  // #3: the stage's own aspect ratio follows the project's chosen canvas
  // size preset - every box/choices/portrait position is already stored as
  // a PERCENTAGE of the stage, so this is the only thing that needs to
  // change; player/runtime.js mirrors the same preset table at boot.
  const cs=ceCanvasSizeOf(); document.getElementById('ce-stage').style.aspectRatio=cs.w+'/'+cs.h;
  // #13: lets you pick the same project-wide canvas size from right here,
  // not just Story settings.
  const csSel=document.getElementById('ce-canvassize'); if(csSel) csSel.value=(project.settings.screen&&project.settings.screen.canvasSize)||'widescreen';
  const gd=document.getElementById('ce-griddot'); if(gd) gd.checked=ceGridDotOn();
  const gs=document.getElementById('ce-gridspace'); if(gs) gs.value=ceGridSpacing();
  const sn=document.getElementById('ce-snapels'); if(sn) sn.checked=ceSnapOn();
  document.getElementById('canvas-modal').classList.remove('hidden');
  // the modal was still display:none while renderCanvasPreview() ran above,
  // so .ce-stage had zero width and _ceStageScale() fell back to 1 (#4) -
  // recompute now that it's actually visible and has a real size. Applying
  // zoom also calls cePlace() itself, so this covers both.
  // #114/#172: fit the stage to whatever space is actually available every
  // time the editor opens, not just a genuinely-first-ever one, as long as
  // the user hasn't manually touched zoom yet on this computer (a manual
  // zoom, or a manual click-to-reset, turns this off from then on and is
  // read back like any other deliberate choice - matches the original
  // report's own carve-out: "if we've already interacted with it and
  // zoomed-in and out, it's fine to clip like this"). The same auto-fit also
  // reruns on every window resize while the editor stays open (see the
  // 'resize' listener in ceEnsureDom()), so un-maximizing (or any other
  // resize) keeps the stage fit instead of freezing whatever percentage it
  // happened to open at.
  if(ceZoomAutoOn()) ceAutoFitIfEnabled();
  else ceApplyZoom();
}
function ceEnsureDom(){
  if(document.getElementById('canvas-modal')) return;
  const d=document.createElement('div'); d.id='canvas-modal'; d.className='ce-full hidden';
  d.innerHTML=`<div class="ce-topbar">
      <b>🖼 Canvas editor</b>
      <div class="fld inline"><label>Editing</label><select id="ce-scope" onchange="switchCanvasScope(this.value)"></select></div>
      <div class="fld inline"><label>Template</label><select id="ce-tpl" onchange="applyCanvasTemplate(this.value)"></select>
        <button class="tb-btn" onclick="openTemplatePicker()" title="Browse templates with preview thumbnails" style="padding:4px 8px">🖼</button>
      </div>
      <div class="fld inline"><label>Canvas size</label><select id="ce-canvassize" onchange="setCanvasEditorCanvasSize(this.value)" title="The whole project's screen aspect ratio - same setting as Story settings, changeable from here too">
        <option value="widescreen">Widescreen (16:9)</option>
        <option value="standard">Standard (4:3)</option>
        <option value="portrait">Mobile portrait (9:16)</option>
        <option value="landscape">Mobile landscape (16:9, smaller)</option>
      </select></div>
      <div class="fld inline" title="Background dot grid on this stage, and whether dragging/resizing snaps to it (per-computer, like the main graph's own grid)">
        <label class="chk" style="margin:0"><input type="checkbox" id="ce-griddot" onchange="setCeGridDot(this.checked)"> grid</label>
        <input type="number" id="ce-gridspace" min="4" max="400" step="1" style="width:48px" title="Grid spacing, in design pixels" onchange="setCeGridSpacing(this.value)">
        <label class="chk" style="margin:0"><input type="checkbox" id="ce-snapels" onchange="setCeSnap(this.checked)"> snap</label>
      </div>
      <div class="sb-zoom" title="Zoom the live preview stage">
        <button class="zoom-btn" onclick="ceZoomBy(-10)" title="Zoom out">\u2212</button>
        <input type="range" id="ce-zoom-slider" min="50" max="250" step="1" value="130" oninput="setCeZoom(this.value)" title="Zoom">
        <button class="zoom-btn" onclick="ceZoomBy(10)" title="Zoom in">+</button>
        <span id="ce-zoom-label" onclick="ceZoomReset()" title="Click to reset to 130%">130%</span>
      </div>
      <span class="ce-spacer"></span>
      <button class="tb-btn tb-slate" onclick="ceUndo()" title="Undo (Ctrl+Z)">\u21B6</button>
      <button class="tb-btn tb-slate" onclick="ceRedo()" title="Redo (Ctrl+Y)">\u21B7</button>
      <select id="ce-saved" onchange="ceLoadNamedLayout(this.value)" title="Load a saved layout" style="min-width:150px"></select>
      <button class="tb-btn" onclick="ceSaveNamedLayout()" title="Save this layout by name for reuse">Save as\u2026</button>
      <button class="tb-btn" onclick="resetCanvasLayout()" title="Reset this layout to the default (or clear a scene/group override)">Reset</button>
      <button class="tb-btn tb-emerald" onclick="saveCanvasLayout()" title="Save this layout">Save</button>
      <button class="tb-btn" onclick="detachSurface('canvas-modal','Canvas editor')" title="Open in its own window (native app only); drag gestures still work but relay over the bridge, so dragging may feel a touch less immediate than in-window">⧉</button>
      <button class="tb-btn tb-slate" onclick="ceRequestClose()" title="Close the canvas editor">Close</button>
    </div>
    <div class="ce-main">
      <div class="ce-controls" id="ce-controls"></div>
      <div class="ce-preview"><div id="ce-stage" class="ce-stage"></div>
        <div class="hint" style="text-align:center;margin-top:8px">Live preview with sample content; drag any element to move it, drag its corner to resize.</div></div>
    </div>`;
  document.body.appendChild(d);
  // the stage's rendered width changes with the window (it's 90%/max-1100px
  // wide, not fixed), which _ceStageScale() depends on (#4) - keep the
  // scaled font size in sync instead of it going stale until the next edit.
  // #114 (revisited): while the user hasn't manually zoomed yet on this
  // computer, a resize also re-fits the zoom % itself to the new available
  // space (ceAutoFitIfEnabled()) rather than only repositioning elements at
  // whatever zoom % happened to already be set - previously the stage kept
  // whatever percentage it opened at, so shrinking the window (e.g.
  // un-maximizing) left it clipped/scrolling instead of actually shrinking.
  window.addEventListener('resize', ()=>{
    if(!_ceWork || document.getElementById('canvas-modal').classList.contains('hidden')) return;
    if(ceZoomAutoOn()) ceAutoFitIfEnabled(); else cePlace();
  });
}
function renderCanvasControls(){
  const L=_ceWork; const box=document.getElementById('ce-controls'); if(!box) return;
  const sc=document.getElementById('ce-scope'); if(sc){ sc.innerHTML=ceScopeOptions(); sc.value=_ceScope; }
  const sv=document.getElementById('ce-saved'); if(sv){ sv.innerHTML='<option value="">Saved layouts…</option>'+ceSavedNames().map(nm=>`<option value="${escAttr(nm)}">${escHtml(nm)}</option>`).join(''); }
  const tp=document.getElementById('ce-tpl'); if(tp){ tp.innerHTML='<option value="">Pick a template…</option>'+Object.keys(CANVAS_TEMPLATES).map(k=>`<option value="${k}">${CANVAS_TEMPLATES[k].label}</option>`).join(''); }
  // #55: an element's entrance can stack several simultaneous effects (not
  // just one), each with its own direction/delay/speed, reorderable -
  // mirrors the same add/remove/reorder list pattern used for a character's
  // portrait effects (fx-ui.js's portraitFxListHtml).
  const animRow=(el,label)=>{ const list=L.anim[el]||[];
    const rows=list.map((a,i)=>`<div class="anim-fx-card">
      <div class="mini-row">
        <select onchange="setCanvasAnimItem('${el}',${i},'type',this.value)" title="Entrance animation type">${ANIM_TYPES.filter(t=>t[0]!=='none').map(t=>`<option value="${t[0]}" ${a.type===t[0]?'selected':''}>${t[1]}</option>`).join('')}</select>
        <select onchange="setCanvasAnimItem('${el}',${i},'dir',this.value)" ${a.type!=='slide'?'disabled':''} title="Direction (slide only)">${ANIM_DIRS.map(d=>`<option value="${d[0]}" ${a.dir===d[0]?'selected':''}>${d[1]}</option>`).join('')}</select>
        <button class="mini-btn" onclick="moveCanvasAnim('${el}',${i},-1)" title="Move earlier" ${i===0?'disabled':''}>▲</button>
        <button class="mini-btn" onclick="moveCanvasAnim('${el}',${i},1)" title="Move later" ${i===list.length-1?'disabled':''}>▼</button>
        <span class="row-x" onclick="removeCanvasAnim('${el}',${i})" title="Remove this effect">✕</span>
      </div>
      <div class="mini-row">
        <span class="anim-fx-lbl" title="Delay before this effect starts">delay</span>
        <input type="number" min="0" max="5" step="0.1" value="${a.delay||0}" oninput="setCanvasAnimItem('${el}',${i},'delay',this.value)" title="Delay before this effect starts (seconds)" style="width:48px">
        <span class="anim-fx-lbl" title="Speed multiplier - 2 plays twice as fast">speed</span>
        <input type="number" min="0.1" max="5" step="0.1" value="${a.speed||1}" oninput="setCanvasAnimItem('${el}',${i},'speed',this.value)" title="Speed multiplier (2 = twice as fast)" style="width:48px">
      </div></div>`).join('');
    return `<div class="fld"><label>${label} entrance</label></div>${rows||'<div class="hint">No entrance effect; appears instantly.</div>'}
      <button class="mini-btn" onclick="addCanvasAnim('${el}')" title="Add another simultaneous entrance effect">+ effect</button>`; };
  // #8: only the selected element's own properties render here, instead of
  // every section stacked at once; lockRow adds a per-element "lock position" checkbox.
  const lockRow=(rawKey,label)=>{ const o=ceLockTarget(rawKey); return `<label class="chk" title="Prevent dragging/resizing ${label||'this'} in the preview"><input type="checkbox" ${o&&o.locked?'checked':''} onchange="setCanvasElementLocked('${rawKey}',this.checked)"> \u{1F512} Lock position${label?(' ('+label+')'):''}</label>`; };
  const panelHead=(title)=>`<h3>${title}<span class="hdr-icon" style="float:right;font-size:11px" title="Back to element list" onclick="ceDeselect()">× deselect</span></h3>`;

  let bodyHtml;
  if(!_ceSelected){
    bodyHtml=`<div class="sec"><h3>Nothing selected</h3>
      <div class="hint">Click an element in the preview to edit its properties, or pick one here:</div>
      <div class="rowflex" style="flex-wrap:wrap;gap:6px;margin-top:8px">
        ${Object.keys(CE_ELEMENT_LABELS).map(k=>`<button class="mini-btn" onclick="ceSelect('${k}')">${CE_ELEMENT_LABELS[k]}</button>`).join('')}
      </div></div>`;
  } else if(_ceSelected==='box'){
    const extras=[2,3,4].filter(n=>L['box'+n].enabled);
    bodyHtml=`<div class="sec">${panelHead('Dialogue box')}
      <div class="rowflex">
        <div class="fld"><label>Text size (px)</label><input type="number" min="9" max="48" value="${L.box.fontSize}" oninput="setCanvasBox('fontSize',this.value)" title="Font size of the dialogue text"></div>
        <div class="fld"><label>Background opacity</label><input type="range" min="0" max="100" value="${L.box.bgAlpha}" oninput="setCanvasBox('bgAlpha',this.value)" title="How see-through the dialogue box background is (text stays fully readable)"></div>
        <div class="fld"><label>Element opacity</label><input type="range" min="0" max="100" value="${L.box.alpha!=null?L.box.alpha:100}" oninput="setCanvasBox('alpha',this.value)" title="Fades the whole box, text included - not just its background. Shared by boxes 2-4 too."></div>
      </div>
      <label class="chk"><input type="checkbox" ${L.box.autoFit?'checked':''} onchange="setCanvasAutoFit(this.checked)" title="Off by default; shrink text to fit boxes, choices and name tags"> Auto-resize text to fit (boxes, choices, names)</label>
      <div class="fld"><label>Number of dialogue boxes</label><select onchange="setCanvasBoxCount(this.value)" title="One box per simultaneous speaker; each speaker uses the box matching their on-stage order">${[1,2,3,4].map(n=>`<option value="${n}" ${_ceBoxCount()===n?'selected':''}>${n}</option>`).join('')}</select></div>
      ${_ceBoxCount()>1?`<label class="chk"><input type="checkbox" ${(L.box2.combine||L.box3.combine||L.box4.combine)?'checked':''} onchange="setCanvasCombineBoxes(this.checked)" title="Overlap the extra boxes onto the main one; only the active speaker's box shows"> Combine the extra boxes into the main spot</label>
      <label class="chk" title="Resizing any dialogue box resizes all the others to match, so they always line up"><input type="checkbox" ${L.uniformBoxSize?'checked':''} onchange="setCanvasUniformBoxSize(this.checked)"> Keep all dialogue boxes the same size</label>
      <label class="chk" title="Off by default; an extra box (2-4) that hasn't had a line yet this scene stays hidden entirely, instead of sitting there empty. Once a box has shown a line, it stays visible (dimmed) between that speaker's turns instead of going blank - it never re-hides until the box itself is disabled somewhere else."><input type="checkbox" ${L.hideUntilSpoken?'checked':''} onchange="setCanvasHideUntilSpoken(this.checked)"> Hide extra boxes until their speaker's first line</label>`:''}
      <div class="hint">Auto-detected up to <b>${_ceMaxBoxes()}</b> speaker${_ceMaxBoxes()===1?'':'s'} together on a scene. Drag each box in the preview.</div>
      ${lockRow('box','main box')}
      ${extras.length?`<div class="hint" style="margin-top:4px">Extra boxes:</div>${extras.map(n=>lockRow('box'+n,'box '+n)).join('')}`:''}
      ${ceAttachedToBoxSectionHtml()}
      ${animRow('box','Box')}
    </div>`;
  } else if(_ceSelected==='choices'){
    bodyHtml=`<div class="sec">${panelHead('Choices')}
      <div class="fld"><label>Placement</label>
        <select onchange="setCanvasChoices('mode',this.value)" title="Put choices inside the dialogue box or float them anywhere"><option value="inBox" ${L.choices.mode==='inBox'?'selected':''}>Inside the dialogue box</option><option value="free" ${L.choices.mode==='free'?'selected':''}>Anywhere on screen (free)</option></select></div>
      <div class="fld"><label>Align</label>
        <select onchange="setCanvasChoices('align',this.value)">${['left','center','right'].map(a=>`<option value="${a}" ${L.choices.align===a?'selected':''}>${a}</option>`).join('')}</select></div>
      ${L.choices.mode==='free'?`<div class="fld"><label>Opacity</label><input type="range" min="0" max="100" value="${L.choices.alpha!=null?L.choices.alpha:100}" oninput="setCanvasChoices('alpha',this.value)" title="Fades the free-floating choices panel"></div>`:''}
      ${lockRow('choices')}
      ${animRow('choices','Choices')}
    </div>`;
  } else if(_ceSelected==='portraits'){
    const isManual = L.portraits.mode==='manual';
    const isBox = L.portraits.mode==='box';
    bodyHtml=`<div class="sec">${panelHead('Portraits')}
      <div class="rowflex">
        <div class="fld"><label>Placement</label><select onchange="setCanvasPortraits('mode',this.value)" title="Auto-spread evenly, drag each portrait yourself, or attach them to an edge of the dialogue box"><option value="auto" ${!isManual&&!isBox?'selected':''}>Auto spread</option><option value="manual" ${isManual?'selected':''}>Manual (drag each)</option><option value="box" ${isBox?'selected':''}>Attached to dialogue box</option></select></div>
        <div class="fld"><label>Sample count</label><select onchange="setCanvasSampleN(this.value)" title="How many sample portraits to show (A, B, C…)">${[1,2,3,4].map(n=>`<option value="${n}" ${_cePortraitN===n?'selected':''}>${n}</option>`).join('')}</select></div>
      </div>
      ${isManual ? `<div class="hint">Each portrait has its own dragged position now, so anchor/nudge (auto-spread only) don't apply - drag a portrait in the preview to reposition it, or switch back to Auto spread to use them again.</div>`
        : isBox ? `<div class="fld"><label>Attaches to</label><select onchange="setCanvasPortraits('boxSide',this.value)" title="Which edge of the main dialogue box the portraits sit on">${[['top','Top edge'],['bottom','Bottom edge'],['left','Left edge'],['right','Right edge']].map(o=>`<option value="${o[0]}" ${(L.portraits.boxSide||'top')===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
        <div class="hint">Portraits sit on the chosen edge of the main dialogue box, evenly spaced unless you drag one to slide it along that edge.</div>`
        : `<div class="rowflex">
        <div class="fld"><label>Anchor</label><select onchange="setCanvasPortraits('anchor',this.value)" title="Vertical anchor for portraits">${['bottom','center','top'].map(a=>`<option value="${a}" ${L.portraits.anchor===a?'selected':''}>${a}</option>`).join('')}</select></div>
        <div class="fld"><label>Vertical nudge %</label><input type="number" value="${L.portraits.offY||0}" min="-40" max="40" oninput="setCanvasPortraits('offY',this.value)"></div>
      </div>`}
      <div class="hint">Portraits are labelled A, B, C… (the 1st, 2nd, 3rd character on stage). In manual mode, drag each one in the preview; attached-to-box portraits can be dragged along their edge too. Shape/fit shown here follows each character's own Portrait-look settings when set (same as in play).</div>
      <div class="fld"><label>Opacity</label><input type="range" min="0" max="100" value="${L.portraits.alpha!=null?L.portraits.alpha:100}" oninput="setCanvasPortraits('alpha',this.value)" title="Fades every portrait; a non-speaking portrait dims further on top of this"></div>
      <label class="chk" title="When on, every portrait in this layout uses the shape/fit/scale set here, ignoring each character's own Portrait-look and Scale settings"><input type="checkbox" ${L.portraits.overrideChars?'checked':''} onchange="setCanvasPortraits('overrideChars',this.checked)"> Override each character's own look</label>
      ${L.portraits.overrideChars ? `<div class="rowflex">
        <div class="fld"><label>Shape</label><select onchange="setCanvasPortraits('shape',this.value)">${['square','circle','rounded'].map(s=>`<option value="${s}" ${L.portraits.shape===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="fld"><label>Fit</label><select onchange="setCanvasPortraits('fit',this.value)" title="How the portrait image fills its shape"><option value="contain" ${L.portraits.fit!=='cover'?'selected':''}>Fit inside (contain)</option><option value="cover" ${L.portraits.fit==='cover'?'selected':''}>Fill and crop (cover)</option></select></div>
        <div class="fld"><label>Size %</label><input type="number" value="${L.portraits.size||38}" min="10" max="100" oninput="setCanvasPortraits('size',this.value)"></div>
      </div>` : ''}
      ${isBox ? `<label class="chk" title="Give every portrait the same border the dialogue box itself uses, so an attached portrait reads as part of the box"><input type="checkbox" ${L.portraits.matchBoxBorder?'checked':''} onchange="setCanvasPortraits('matchBoxBorder',this.checked)"> Match dialogue box border</label>` : ''}
      ${lockRow('portraits')}
      ${animRow('portraits','Portraits')}
    </div>`;
  } else if(_ceSelected==='name'){
    bodyHtml=`<div class="sec">${panelHead('Speaker name')}
      <div class="fld"><label>Placement</label><select onchange="setCanvasName('mode',this.value)" title="Where the speaker's name sits">
        <option value="inBox" ${L.name.mode==='inBox'?'selected':''}>Inside the box</option>
        <option value="tab" ${L.name.mode==='tab'?'selected':''}>Tab on the box (drag along it)</option>
        <option value="portrait" ${L.name.mode==='portrait'?'selected':''}>Attached to the speaking portrait</option>
        <option value="free" ${L.name.mode==='free'?'selected':''}>Free-floating (drag anywhere)</option></select></div>
      ${L.name.mode==='portrait'?`<div class="fld"><label>Attaches to</label><select onchange="setCanvasName('portraitSide',this.value)" title="Which edge of the speaking character's portrait the name sits on">${[['top','Top edge'],['bottom','Bottom edge'],['left','Left edge'],['right','Right edge']].map(o=>`<option value="${o[0]}" ${(L.name.portraitSide||'top')===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>`:''}
      <div class="rowflex">
        <div class="fld"><label>Orientation</label><select onchange="setCanvasName('orient',this.value)"><option value="horizontal" ${L.name.orient!=='vertical'?'selected':''}>Horizontal</option><option value="vertical" ${L.name.orient==='vertical'?'selected':''}>Vertical</option></select></div>
        <div class="fld"><label>Background</label><label class="chk" style="margin-top:6px"><input type="checkbox" ${L.name.bg!==false?'checked':''} onchange="setCanvasName('bg',this.checked)"> pill</label></div>
      </div>
      ${L.name.bg!==false?`<label class="chk" title="Use the dialogue box's own background instead of the theme accent colour, so the name pill and box always match"><input type="checkbox" ${L.name.matchBox?'checked':''} onchange="setCanvasName('matchBox',this.checked)"> Match dialogue box background</label>`:''}
      <div class="fld"><label>Text colour</label><div style="display:flex;gap:6px;align-items:center">
        <input type="color" value="${L.name.textColor||'#ffffff'}" oninput="setCanvasName('textColor',this.value); hexSyncFromColor(this)" title="Overrides the theme's default name text colour">${hexFieldHtml(L.name.textColor||'#ffffff')}
        <button class="mini-btn" onclick="setCanvasName('textColor','')" title="Use the theme's default text colour instead">theme default</button>
        ${L.name.textColor?'':'<span class="hint">(theme default)</span>'}</div></div>
      ${L.name.mode==='portrait'?'<div class="hint">Follows whichever portrait is speaking in play; in this preview it sits on sample portrait A. Drag along the edge to slide it.</div>':''}
      ${L.name.mode!=='inBox'?`<div class="fld"><label>Opacity</label><input type="range" min="0" max="100" value="${L.name.alpha!=null?L.name.alpha:100}" oninput="setCanvasName('alpha',this.value)" title="Fades the name tag"></div>`:''}
      ${L.name.mode!=='inBox'?lockRow('name'):''}
    </div>`;
  } else if(_ceSelected==='continuePrompt'){
    bodyHtml=`<div class="sec">${panelHead('"Click to continue" prompt')}
      <label class="chk"><input type="checkbox" ${L.continuePrompt.enabled?'checked':''} onchange="setCanvasContinuePrompt('enabled',this.checked)" title="Off by default; the text/style/keys still come from Settings → Screen & frame, only the placement moves here"> Control its placement here (instead of Settings → Screen &amp; frame)</label>
      ${L.continuePrompt.enabled?`<div class="fld"><label>Placement</label>
        <select onchange="setCanvasContinuePrompt('mode',this.value)" title="Sit at the bottom of the dialogue box, or float it anywhere"><option value="inBox" ${L.continuePrompt.mode==='inBox'?'selected':''}>Inside the dialogue box</option><option value="free" ${L.continuePrompt.mode==='free'?'selected':''}>Anywhere on screen (free)</option></select></div>
        <div class="fld"><label>Align</label><select onchange="setCanvasContinuePrompt('align',this.value)">${['left','center','right'].map(a=>`<option value="${a}" ${L.continuePrompt.align===a?'selected':''}>${a}</option>`).join('')}</select></div>
        <div class="hint">${L.continuePrompt.mode==='free'?'Drag it in the preview.':'Sits at the bottom of the dialogue box; align only.'}</div>
        ${L.continuePrompt.mode==='free'?lockRow('continuePrompt'):''}`:''}
    </div>`;
  } else if(_ceSelected==='narrator'){
    // #168: project-wide (not per-layout-scope like everything else here,
    // since it's about how the whole stage reacts, not this scope's own
    // element placement) - reads/writes project.settings.narration directly
    // rather than going through _ceWork/cePlace, so it's the one entry in
    // this sidebar with nothing to drag in the preview.
    const ns=(project.settings&&project.settings.narration)||{dimOthers:true};
    bodyHtml=`<div class="sec">${panelHead('Narrator text')}
      <div class="hint" style="margin-bottom:6px">A line marked "unattributed" (Properties panel, or the ✎ toggle on any line in a scene card) renders as free-floating text with no speaker name or dialogue box - narrator commentary, off-screen dialogue, and the like.</div>
      <label class="chk"><input type="checkbox" ${ns.dimOthers!==false?'checked':''} onchange="setNarrationDim(this.checked)"> Dim other portraits/text and the background while it shows</label>
      <div class="hint">Applies project-wide, to every unattributed line.</div>
    </div>`;
  }
  box.innerHTML=bodyHtml;
}
function ceScopeOptions(){
  let o=`<option value="project" ${_ceScope==='project'?'selected':''}>Whole project (default)</option>`;
  const bds=typeof visibleBackdrops==='function'?visibleBackdrops():backdrops;
  const scs=typeof visibleScenes==='function'?visibleScenes():scenes;
  Object.values(bds).forEach(b=>{ o+=`<option value="${b.id}" ${_ceScope===b.id?'selected':''}>Group: ${escHtml(b.name||'group')}</option>`; });
  Object.values(scs).forEach(s=>{ o+=`<option value="${s.id}" ${_ceScope===s.id?'selected':''}>Scene: ${escHtml(s.title||'scene')}</option>`; });
  return o;
}
// #3: a small badge on any preview element that's actually locked, so it's
// visible at a glance without having to select the element first and check
// its own checkbox - matches ceLockTarget()'s own resolution of which state
// object a given element key's lock flag lives on.
function _ceLockBadge(rawKey){ const o=ceLockTarget(rawKey); return (o&&o.locked) ? '<span class="ce-lock-badge" title="Locked in place">🔒</span>' : ''; }
function renderCanvasPreview(){
  const st=document.getElementById('ce-stage'); if(!st) return; const L=_ceWork;
  const portHtml=[];
  for(let i=0;i<_cePortraitN;i++){ const letter=String.fromCharCode(65+i);
    const ch=_ceSampleCharFor(i); const realSrc=(ch&&ch.media)?mediaURL(ch.media):null;
    const label=`Portrait ${letter}`+(ch&&ch.name?(': '+ch.name):'');
    portHtml.push(`<img class="ce-por" data-i="${i}" src="${realSrc||_ceFace(letter,(i*70)%360)}" onmousedown="ceStartDrag(event,'portrait',${i})" oncontextmenu="ceContextMenu(event,'portrait',${i})" title="${escAttr(label)}">`); }
  const chBtns=CE_SAMPLE.choices.map(c=>`<div class="ce-choice">${escHtml(c)}</div>`).join('');
  const inBox = L.choices.mode!=='free';
  // #16/#8: "click to continue" defaults to ON and inside the dialogue box in real
  // play (project.settings.continuePrompt.enabled defaults true), and the Canvas
  // editor's own placement override (L.continuePrompt.enabled) defaults OFF - so the
  // preview must fall back to the Settings values whenever the layout override isn't
  // explicitly turned on, or a brand-new project would show nothing here while real
  // gameplay shows the prompt. ceEffectiveContinuePrompt() resolves that the same way
  // player/runtime.js's showContinuePrompt() does. Mirrored into every enabled extra
  // box too, matching how in real play it follows whichever box is currently in use.
  const cpFx=ceEffectiveContinuePrompt();
  const cpIcon=cpFx.iconMedia?mediaURL(cpFx.iconMedia):null;
  const cpInner = cpIcon
    ? `<img class="ce-cont-icon ce-cont-icon-${cpFx.iconAnim||'none'}" src="${cpIcon}">`+(cpFx.style==='none'?'':' '+escHtml(cpFx.text))
    : (cpFx.style==='cursor'?`<span class="ce-cont-cursor">|</span> `:(cpFx.style==='none'?'':'▸ '))+escHtml(cpFx.text);
  const contInBoxHtml = (cpFx.enabled && cpFx.mode==='inBox')
    ? `<div class="ce-cont-inbox" style="text-align:${cpFx.align}">${cpInner}</div>` : '';
  st.innerHTML=`<div class="ce-bg" onmousedown="ceDeselect()" title="Click blank space to deselect"></div>
    <div id="ce-portraits" class="ce-portraits">${_ceLockBadge('portrait')}${portHtml.join('')}<span id="ce-por-rz" class="ce-por-rz" onmousedown="ceStartPortraitResize(event)" title="Drag to resize every portrait (shape is set in the sidebar)"></span></div>
    ${[2,3,4].map(n=>L['box'+n]&&L['box'+n].enabled?`<div id="ce-box${n}" class="ce-el ce-box2" onmousedown="ceStartDrag(event,'box${n}')" oncontextmenu="ceContextMenu(event,'box${n}')"><span class="ce-lbl">Box ${n} · speaker ${String.fromCharCode(63+n)}</span>${_ceLockBadge('box'+n)}<div class="ce-spk2">${['','','Barret','Tifa','Aerith'][n]||'Speaker'}</div><div class="ce-txt">Line for speaker ${String.fromCharCode(63+n)}.</div>${contInBoxHtml}<div class="ce-rz" onmousedown="ceStartResize(event,'box${n}')"></div></div>`:'').join('')}
    <div id="ce-box" class="ce-el ce-box" onmousedown="ceStartDrag(event,'box')" oncontextmenu="ceContextMenu(event,'box')"><span class="ce-lbl">Dialogue box</span>${_ceLockBadge('box')}
      <div class="ce-spk">${escHtml(CE_SAMPLE.speaker)}</div>
      <div class="ce-txt" id="ce-txt">${escHtml(CE_SAMPLE.text)}</div>
      ${inBox?`<div class="ce-choices" id="ce-choices-in">${chBtns}</div>`:''}
      ${contInBoxHtml}
      <div class="ce-rz" onmousedown="ceStartResize(event,'box')"></div></div>
    <div id="ce-name" class="ce-name" onmousedown="ceStartDrag(event,'name')" oncontextmenu="ceContextMenu(event,'name')">${escHtml(CE_SAMPLE.speaker)}${_ceLockBadge('name')}</div>
    ${inBox?'':`<div id="ce-choices" class="ce-el ce-choices-free" onmousedown="ceStartDrag(event,'choices')" oncontextmenu="ceContextMenu(event,'choices')"><span class="ce-lbl">Choices</span>${_ceLockBadge('choices')}${chBtns}<div class="ce-rz" onmousedown="ceStartResize(event,'choices')"></div></div>`}
    ${(cpFx.enabled && cpFx.mode==='free')?`<div id="ce-cont" class="ce-el ce-cont" onmousedown="ceStartDrag(event,'continuePrompt')" oncontextmenu="ceContextMenu(event,'continuePrompt')">${cpInner}${_ceLockBadge('continuePrompt')}</div>`:''}`;
  cePlace();
}
// Resolves the effective "click to continue" state the same way the player does:
// Settings (project.settings.continuePrompt) is the base (enabled defaults true,
// placement defaults 'box'); the Canvas editor's own layout override only takes
// over placement (mode/align/x/y) when explicitly turned on. Text/style/icon
// always come from Settings, matching real play.
function ceEffectiveContinuePrompt(){
  const L=_ceWork; const s=(typeof project!=='undefined'&&project.settings&&project.settings.continuePrompt)||{};
  const layoutOn=!!L.continuePrompt.enabled;
  const enabled=s.enabled!==false;
  const mode=layoutOn ? (L.continuePrompt.mode==='free'?'free':'inBox') : ((s.placement==='free')?'free':'inBox');
  const align=(layoutOn && L.continuePrompt.align) || s.align || 'right';
  const x=layoutOn ? L.continuePrompt.x : (s.x!=null?s.x:50);
  const y=layoutOn ? L.continuePrompt.y : (s.y!=null?s.y:92);
  return { enabled, mode, align, x, y, text:s.text||'click to continue', style:s.style||'blinkArrow', iconMedia:s.iconMedia||null, iconAnim:s.iconAnim||'none' };
}
// #4 (follow-up): a name/continue-prompt sitting "inside the box" (the
// default) or on its "tab" renders as plain preview markup with no drag
// handler of its own - there's nothing in the live preview TO click, so the
// only way to move or detach it used to be finding its own element in the
// sidebar picker first and changing its Placement dropdown there. Listing
// whatever's currently attached right on the box's own panel, with a one-
// click Detach, means an author working on the box doesn't have to already
// know a different element's own sidebar is where that control lives.
function ceAttachedToBoxItems(){
  const L=_ceWork; const items=[];
  if(L.choices.mode==='inBox') items.push({key:'choices', label:'Choices'});
  if(L.name.mode==='inBox'||L.name.mode==='tab') items.push({key:'name', label:'Speaker name ('+(L.name.mode==='tab'?'tab':'inside the box')+')'});
  const cpFx=ceEffectiveContinuePrompt();
  if(cpFx.enabled && cpFx.mode==='inBox') items.push({key:'continuePrompt', label:'"Click to continue" prompt'});
  if(L.portraits.mode==='box') items.push({key:'portraits', label:'Portraits (attached to '+(L.portraits.boxSide||'top')+' edge)'});
  return items;
}
function ceAttachedToBoxSectionHtml(){
  const items=ceAttachedToBoxItems(); if(!items.length) return '';
  return `<div class="hint" style="margin-top:8px">Attached to this box:</div>`+items.map(it=>
    `<div class="rowflex" style="align-items:center;gap:6px;margin-top:2px"><span style="flex:1;font-size:12px">${escHtml(it.label)}</span>`+
    `<button class="mini-btn" onclick="ceDetachFromBox('${it.key}')" title="Move this off the dialogue box so you can freely drag it in the preview">Detach</button></div>`
  ).join('');
}
function ceDetachFromBox(which){
  ceSnapshot();
  if(which==='choices'){ _ceWork.choices.mode='free'; }
  else if(which==='name'){ _ceWork.name.mode='free'; }
  else if(which==='continuePrompt'){
    const cur=ceEffectiveContinuePrompt();
    _ceWork.continuePrompt.enabled=true; _ceWork.continuePrompt.mode='free';
    _ceWork.continuePrompt.x=cur.x; _ceWork.continuePrompt.y=cur.y; _ceWork.continuePrompt.align=cur.align;
  }
  else if(which==='portraits'){ _ceWork.portraits.mode='manual'; ceSyncSlots(); }
  else return;
  // choices/continuePrompt only exist as separate, draggable DOM elements
  // once free (see renderCanvasPreview()'s own ternaries) - a mode switch
  // needs the full preview rebuilt, the same as their own setCanvas*()
  // setters already do for a mode change, not just cePlace()'s repositioning.
  renderCanvasControls(); renderCanvasPreview();
  toast('Detached; drag it in the preview to reposition.');
}
// #3: the editor's own preview stage is a different CSS pixel size than
// player/index_template.html's real #vn-stage, so a literal px value like
// box.fontSize (authored to match the real player's own CSS, e.g.
// #vn-text{font-size:19px}, applied INSIDE that 1000x640-ish internal stage
// before its own fitScale() transform blows the whole thing up to fill
// whatever the actual viewport is) needs the same treatment here: scale by
// how much bigger/smaller this preview's rendered stage is than that same
// internal design width (ceCanvasSizeOf().w - 1000 for the default
// widescreen preset, keeping old projects' math unchanged), not some fixed
// "real 1080p screen" guess. That guess used to divide by 1920 regardless
// of how the real player's own fitScale() upscaling actually behaves, which
// is why this preview's text used to read far smaller than real play does.
function _ceRefW(){ return (typeof ceCanvasSizeOf==='function' && ceCanvasSizeOf().w) || 1000; }
function _ceRefH(){ return (typeof ceCanvasSizeOf==='function' && ceCanvasSizeOf().h) || 640; }
function _ceStageScale(){ const st=document.getElementById('ce-stage'); if(!st) return 1; const w=st.getBoundingClientRect().width; return w>0 ? (w/_ceRefW()) : 1; }
// #77: a background dot grid + optional snap for the Canvas editor's own
// stage, mirroring the main node graph's grid (core.js's applyGridStyle/
// snapXY) but in this editor's own units - percentages of the project's
// real design width/height (ceCanvasSizeOf()), not raw pixels, since every
// element here is already stored as a percentage. Spacing is entered in
// design pixels (same unit the main graph's grid uses) so the two grids
// feel consistent even though one snaps px and the other snaps %.
// Per-computer settings (ToolSettings), like the main graph's grid - not
// saved into the project.
// #60: manual zoom for the live preview stage, independent of the fit-to-
// container sizing that was all it had before. Applied as a CSS transform on
// #ce-stage itself (same technique the main node graph's own zoomLayer
// uses) - the stage's own box model size (and therefore .ce-preview's
// overflow:auto scrolling) is untouched, only the paint is scaled, and
// getBoundingClientRect() (which every drag/position calc in this file
// reads from) reflects the transform automatically. Persisted per-computer
// like the grid/snap prefs just above; 130% by default so a freshly opened
// Canvas editor reads clearly without the user having to reach for zoom
// first (the old 100%-fit default felt small on anything but a wide window).
function ceZoomPct(){ return Math.max(50,Math.min(250,parseInt(ToolSettings.get('ceZoom','130'),10)||130)); }
// #114 (revisited): whether the stage should keep auto-fitting itself to the
// available space (every open, every window resize) or has been handed off
// to a manual, persisted percentage - on by default so a computer that's
// never touched zoom stays fit; a manual zoom (any UI control below) turns
// this off for good, same carve-out #172 already established ("if we've
// already interacted with it... it's fine to clip like this").
function ceZoomAutoOn(){ return ToolSettings.get('ceZoomAuto','1')!=='0'; }
// Applies a zoom value WITHOUT touching the auto-fit flag - used both by the
// manual entry point below (which turns auto off first) and by the auto-fit
// path itself (which needs to keep writing ceZoom, the actual applied
// percentage, while leaving ceZoomAuto alone).
function _ceSetZoomValue(pct){ ToolSettings.set('ceZoom', String(Math.max(50,Math.min(250,parseInt(pct,10)||130)))); ceApplyZoom(); }
function setCeZoom(pct){ ToolSettings.set('ceZoomAuto','0'); _ceSetZoomValue(pct); }
function ceZoomBy(delta){ setCeZoom(ceZoomPct()+delta); }
function ceZoomReset(){ setCeZoom(130); }
// Re-fits the stage to whatever space is actually available right now, but
// only while auto-fit is still on (see ceZoomAutoOn()) - called on every
// open and on every window resize (openCanvasEditor(), the 'resize'
// listener in ceEnsureDom()); a no-op once the user has manually zoomed.
function ceAutoFitIfEnabled(){ if(ceZoomAutoOn()) _ceSetZoomValue(ceComputeFitPct()); }
// #172: the actual "fit the visible open area" percentage for whatever
// window size the Canvas editor happens to be showing in right now -
// recomputed continuously by ceAutoFitIfEnabled() above as long as auto-fit
// stays on, instead of the fixed 130% default below - that fixed value was
// tuned for a fairly wide window (#60's own reasoning: 100%-fit felt small
// there) and clips on anything narrower, exactly the reported bug. Measures
// #ce-stage with its zoom transform momentarily cleared (its CSS width/aspect-ratio, and
// therefore its true unscaled size, isn't affected by that transform at
// all - only reading getBoundingClientRect() while the transform is still
// applied would be), then computes the largest scale that keeps it fully
// inside its wrapper's actual padded content area.
function ceComputeFitPct(){
  const st=document.getElementById('ce-stage');
  const wrap=st&&st.parentElement; // .ce-preview
  if(!st||!wrap) return 130;
  const prevTransform=st.style.transform;
  st.style.transform='none';
  const stageRect=st.getBoundingClientRect();
  const wrapRect=wrap.getBoundingClientRect();
  st.style.transform=prevTransform;
  if(!stageRect.width||!stageRect.height||!wrapRect.width||!wrapRect.height) return 130;
  const padX=48, padY=48; // .ce-preview's own CSS padding (24px each side)
  const availW=Math.max(1,wrapRect.width-padX);
  const availH=Math.max(1,wrapRect.height-padY);
  const fit=Math.min(availW/stageRect.width, availH/stageRect.height);
  return Math.max(50,Math.min(250,Math.round(fit*100)));
}
function ceApplyZoom(){
  const st=document.getElementById('ce-stage'); if(!st) return;
  const pct=ceZoomPct();
  st.style.transform='scale('+(pct/100)+')';
  st.style.transformOrigin='top center';
  const lbl=document.getElementById('ce-zoom-label'); if(lbl) lbl.textContent=pct+'%';
  const sl=document.getElementById('ce-zoom-slider'); if(sl) sl.value=pct;
  cePlace();
}
function ceGridSpacing(){ return Math.max(4,Math.min(400,parseInt(ToolSettings.get('ceGridSpacing','30'),10)||30)); }
function ceGridDotOn(){ return ToolSettings.get('ceGridDot','1')!=='0'; }
function ceSnapOn(){ return ToolSettings.get('ceSnapEls','0')==='1'; }
function setCeGridSpacing(v){ ToolSettings.set('ceGridSpacing', String(Math.max(4,Math.min(400,parseInt(v,10)||30)))); ceApplyGridStyle(); }
function setCeGridDot(on){ ToolSettings.set('ceGridDot', on?'1':'0'); ceApplyGridStyle(); }
function setCeSnap(on){ ToolSettings.set('ceSnapEls', on?'1':'0'); }
// the decorative ambient glow lives here (not in CSS) so this function can
// layer the grid dots ABOVE it in one combined background-image, rather
// than the dots getting silently painted underneath an opaque backdrop and
// never actually showing (that backdrop, .ce-bg, is the actual visible
// surface - #ce-stage's own background sits behind it and is never seen).
const CE_BG_AMBIENT='radial-gradient(ellipse at 50% 30%,#3b2a55 0%,#160e28 45%,#05070d 100%)';
function ceApplyGridStyle(){
  // .ce-bg is rebuilt (a fresh element) every renderCanvasPreview() call,
  // which always calls cePlace() right after - so re-applying here on every
  // cePlace() keeps it current rather than reverting to nothing.
  const bg=document.querySelector('#ce-stage .ce-bg'); if(!bg) return;
  if(!ceGridDotOn()){ bg.style.backgroundImage=CE_BG_AMBIENT; bg.style.backgroundSize=''; return; }
  const spPx=ceGridSpacing()*_ceStageScale(); // design px -> this stage's own rendered px, at its current size/zoom
  if(spPx<3){ bg.style.backgroundImage=CE_BG_AMBIENT; bg.style.backgroundSize=''; return; } // too dense to read; skip rather than render mush
  bg.style.backgroundImage=`radial-gradient(circle at 0 0, var(--dot) 1px, transparent 1px), ${CE_BG_AMBIENT}`;
  bg.style.backgroundSize=spPx+'px '+spPx+'px, 100% 100%';
}
// snaps a percentage-of-stage value to the nearest grid line, in whichever
// axis (design px translated to that axis's own % scale, since width and
// height aren't equal so a fixed px step isn't a fixed % step on both).
function ceSnapPct(pct, axisRefPx){
  if(!ceSnapOn()) return pct;
  const stepPct=(ceGridSpacing()/axisRefPx)*100;
  if(stepPct<=0) return pct;
  return Math.round(pct/stepPct)*stepPct;
}
// #6: where a portrait sits when attached to the main dialogue box's own
// edge - computed purely from the box's own stored x/y/w/h percentages
// (no live DOM measurement needed, unlike name-to-portrait attachment),
// so this resolves identically here and in player/layout.js's mirror.
// #4: which of a rectangle's 4 edges a point is currently nearest, by
// comparing how far outside the rect's half-width vs half-height the point
// sits on each axis - the axis that's proportionally further out wins,
// which is what makes dragging smoothly hand off from one edge to the next
// as you go around a corner instead of jumping unpredictably.
function _ceNearestBoxSide(b, px, py){
  const cx=px-(b.x+b.w/2), cy=py-(b.y+b.h/2);
  const nx=b.w>0?cx/(b.w/2):0, ny=b.h>0?cy/(b.h/2):0;
  if(Math.abs(nx)>Math.abs(ny)) return nx>=0?'right':'left';
  return ny>=0?'bottom':'top';
}
function ceBoxAttachPos(box, side, along){
  const b=box||{x:0,y:0,w:100,h:0}, a=(along==null?50:along)/100;
  if(side==='left') return {x:b.x, y:b.y+a*b.h};
  if(side==='right') return {x:b.x+b.w, y:b.y+a*b.h};
  if(side==='bottom') return {x:b.x+a*b.w, y:b.y+b.h};
  return {x:b.x+a*b.w, y:b.y}; // 'top' default
}
function cePlace(){ const L=_ceWork;
  ceApplyGridStyle();
  renderCanvasMultiHighlight();
  const box=document.getElementById('ce-box'),
        chF=document.getElementById('ce-choices'), port=document.getElementById('ce-portraits'), txt=document.getElementById('ce-txt'), cont=document.getElementById('ce-cont');
  const put=(el,o,resize)=>{ if(!el)return; el.style.left=o.x+'%'; el.style.top=o.y+'%'; if(resize){ el.style.width=o.w+'%'; el.style.minHeight=o.h+'%'; el.style.height='auto'; } };
  ceApplyZOrder();
  put(box,L.box,true);
  if(cont){ const cpFx=ceEffectiveContinuePrompt(); if(cpFx.mode==='free'){ cont.style.left=cpFx.x+'%'; cont.style.top=cpFx.y+'%'; cont.style.textAlign=cpFx.align; } }
  if(txt){ txt.style.fontSize=(L.box.fontSize*_ceStageScale())+'px'; }
  if(box){ box.style.background = (L.box.bgAlpha<100)?('rgba(8,10,18,'+(L.box.bgAlpha/100)+')'):''; box.style.opacity=(L.box.alpha!=null?L.box.alpha:100)/100; }
  // #103: boxes 2-4 share the main box's whole-element opacity (same as they
  // already share its fontSize/bgAlpha), multiplied with the existing
  // "combined into the main spot" dimming so both effects still stack.
  [2,3,4].forEach(n=>{ const bx=document.getElementById('ce-box'+n); const cfg=L['box'+n]; if(bx&&cfg){ const src=cfg.combine?L.box:cfg; put(bx,src,true); bx.style.opacity=(cfg.combine?0.75:1)*((L.box.alpha!=null?L.box.alpha:100)/100); } });
  if(L.choices.mode==='free' && chF){ put(chF,L.choices,true); chF.style.textAlign=L.choices.align; chF.style.opacity=(L.choices.alpha!=null?L.choices.alpha:100)/100; }
  // #4: everything else visible here stands in for a real player element
  // with its own fixed CSS size (#vn-speaker 15px, .vn-text2 19px,
  // .vn-choice 16px, .vn-hint 13px) - scaled by the same factor as the
  // dialogue text above, so the WHOLE preview's text stays in the same
  // relative proportions real gameplay actually has, not just the one box.
  { const sc=_ceStageScale();
    document.querySelectorAll('#ce-stage .ce-txt:not(#ce-txt)').forEach(el=>el.style.fontSize=(19*sc)+'px');
    document.querySelectorAll('#ce-stage .ce-spk, #ce-stage .ce-spk2').forEach(el=>el.style.fontSize=(15*sc)+'px');
    const nmEl=document.getElementById('ce-name'); if(nmEl) nmEl.style.fontSize=(15*sc)+'px';
    document.querySelectorAll('#ce-stage .ce-choice').forEach(el=>el.style.fontSize=(16*sc)+'px');
    document.querySelectorAll('#ce-stage .ce-cont, #ce-stage .ce-cont-inbox').forEach(el=>el.style.fontSize=(13*sc)+'px');
  }
  // portraits
  if(port){ port.style.alignItems=L.portraits.anchor==='center'?'center':(L.portraits.anchor==='top'?'flex-start':'flex-end');
    // #5: auto-spread portraits anchor against THIS container's own box via
    // align-items, so it has to stop exactly at the dialogue box's top edge
    // (matching real play, where #vn-portraits' own `bottom` is live-set to
    // the box's rendered height, player/runtime.js) - otherwise "anchor:
    // bottom" (the default) anchors to the bottom of the whole STAGE
    // instead, landing UNDER the box rather than above it whenever the box
    // doesn't already fill the entire stage height (true almost always).
    // Manual/box-attached portraits ignore this container's box entirely
    // (real fixed-percent-of-stage placement via their own inline style,
    // computed by _cePctRect()/ceBoxAttachPos() against the STAGE, not this
    // container) so they need the container back at its full, untouched
    // stage size or their own math would silently shift.
    port.style.bottom = (L.portraits.mode==='auto') ? (100-(L.box.y||0))+'%' : '0';
    // anchor/nudge only mean anything in auto-spread mode; manual slots are
    // each an explicit absolute position already, so leaving this transform
    // applied in manual mode would silently re-shift every dragged portrait
    // by whatever nudge was last set before switching modes (#2).
    port.style.transform = (L.portraits.mode==='manual'||L.portraits.mode==='box') ? '' : 'translateY('+(L.portraits.offY||0)+'%)';
    // #9: each sample portrait's shape/fit/scale mirrors the same precedence
    // the real player uses (player/runtime.js) - a character's own Portrait-
    // look settings win unless this layout's "override each character's own
    // look" toggle forces the layout's own shape/fit/size onto everyone.
    const baseShape=L.portraits.shape||'square', baseFit=L.portraits.fit||'contain', baseSize=L.portraits.size||38;
    const forceCanvas=!!L.portraits.overrideChars;
    const imgs=port.querySelectorAll('.ce-por');
    imgs.forEach(im=>{
      const i=parseInt(im.dataset.i,10)||0; const ch=_ceSampleCharFor(i);
      const shape = forceCanvas ? baseShape : ((ch&&ch.portraitShape)||baseShape);
      let fit = forceCanvas ? baseFit : ((ch&&ch.portraitFit)||baseFit);
      if(shape==='circle' && !fit) fit='cover';
      const scaleMul = (!forceCanvas && ch && ch.scale>0) ? ch.scale : 1;
      im.style.borderRadius = shape==='circle'?'50%':(shape==='rounded'?'14px':'2px'); im.style.height=(baseSize*scaleMul)+'%'; im.style.objectFit=fit; if(shape==='circle')im.style.aspectRatio='1/1'; else im.style.aspectRatio='';
      // #6: a character's assigned colour rings their sample portrait here,
      // the same editor-only colour-coding shown on their cast entries and
      // dialogue lines in the scene box - so you can match "portrait A" back
      // to a specific character at a glance, without it ever reaching play.
      im.style.outline = (ch&&ch.color) ? `3px solid ${ch.color}` : ''; im.style.outlineOffset = (ch&&ch.color) ? '1px' : '';
      // #5: match the dialogue box's own border when attached to it, so the
      // portrait visually reads as part of the box rather than a separate
      // floating image - mirrors the REAL box border real play ships
      // (border-top:2px solid var(--accent), player/index_template.html),
      // not the editor-only dashed outline .ce-box uses for its own editing.
      im.style.border = (L.portraits.mode==='box' && L.portraits.matchBoxBorder) ? '2px solid var(--accent)' : ''; });
    imgs.forEach((im,i)=>{ let sl=null, tfm='translate(-50%,-50%)';
      if(L.portraits.mode==='manual'){ sl=_slotPos(i); }
      else if(L.portraits.mode==='box'){
        const along=(L.portraits.boxAlong && L.portraits.boxAlong[i]!=null) ? L.portraits.boxAlong[i] : ((i+0.5)*100/_cePortraitN);
        const side=L.portraits.boxSide||'top'; sl=ceBoxAttachPos(L.box, side, along);
        tfm = side==='bottom'?'translate(-50%,0)':(side==='left'?'translate(-100%,-50%)':(side==='right'?'translate(0,-50%)':'translate(-50%,-100%)')); }
      // #103: the layout's own opacity multiplies with the existing "this
      // slot just links back to another one" dimming, instead of one
      // replacing the other.
      const linkedFactor=(L.portraits.mode==='manual'&&L.portraits.slots[i]&&L.portraits.slots[i].link!=null)?0.6:1;
      const alphaFactor=(L.portraits.alpha!=null?L.portraits.alpha:100)/100;
      im.style.opacity=linkedFactor*alphaFactor;
      if(sl!=null){ im.style.position='absolute'; im.style.left=sl.x+'%'; if(sl.y!=null){ im.style.top=sl.y+'%'; im.style.bottom='auto'; } im.style.transform=tfm; }
      else { im.style.position=''; im.style.left=''; im.style.top=''; im.style.bottom=''; im.style.transform=''; } });
    port.style.justifyContent = (L.portraits.mode==='manual'||L.portraits.mode==='box') ? 'flex-start' : 'space-around';
    // #100: the resize handle tracks portrait A's own actual rendered corner
    // (real measured rect, not derived x/y/w/h - auto-spread portraits have
    // no explicit position of their own, same reason name-attach-to-portrait
    // already has to measure this way) so it stays visually attached to a
    // portrait in every placement mode, even though the size it drags is one
    // shared value for every portrait in the layout, not just this one.
    const rz=document.getElementById('ce-por-rz'), r0=imgs[0]&&_cePctRect(imgs[0]);
    if(rz){ if(r0){ rz.style.display='block'; rz.style.left=(r0.x+r0.w)+'%'; rz.style.top=(r0.y+r0.h)+'%'; } else rz.style.display='none'; }
  }
  // speaker name: shown either inside the box (via the box's own .ce-spk) or
  // as the separate #ce-name tag/free chip, never both - matching whichever
  // placement is actually chosen instead of always showing both at once.
  const nm=document.getElementById('ce-name'); const N=L.name||{mode:'inBox'};
  const spkInBox=box&&box.querySelector('.ce-spk');
  if(spkInBox){ spkInBox.style.display = (N.mode==='inBox') ? '' : 'none'; spkInBox.style.color = N.textColor || ''; }
  if(nm){
    nm.style.display = (N.mode==='inBox') ? 'none' : '';
    nm.style.opacity = (N.mode==='inBox') ? '' : ((N.alpha!=null?N.alpha:100)/100);
    nm.classList.toggle('nobg', N.bg===false);
    // #64: an optional "match the dialogue box" background (this preview's
    // own sample-box color, not a real theme variable - the real player
    // uses var(--box-bg) for the same idea, see player/layout.js) and an
    // optional text colour override, instead of always the theme accent.
    nm.style.background = (N.bg!==false && N.matchBox) ? 'rgba(15,18,32,.86)' : '';
    nm.style.color = N.textColor || '';
    nm.style.writingMode = (N.orient==='vertical') ? 'vertical-rl' : '';
    nm.style.cursor = 'move';
    if(N.mode==='tab'){ nm.style.left=((L.box.x||0)+((N.x||0)/100)*(L.box.w||90))+'%'; nm.style.top=(L.box.y||0)+'%'; nm.style.transform=(N.orient==='vertical'?'translateX(-100%)':'translateY(-100%)'); }
    else if(N.mode==='portrait'){
      const p0=document.querySelector('#ce-portraits .ce-por[data-i="0"]'); const r=p0?_cePctRect(p0):null;
      if(r){ const side=N.portraitSide||'top', along=((N.x!=null?N.x:50)/100);
        if(side==='bottom'){ nm.style.left=(r.x+r.w*along)+'%'; nm.style.top=(r.y+r.h)+'%'; nm.style.transform='translate(-50%,0)'; }
        else if(side==='left'){ nm.style.left=r.x+'%'; nm.style.top=(r.y+r.h*along)+'%'; nm.style.transform='translate(-100%,-50%)'; }
        else if(side==='right'){ nm.style.left=(r.x+r.w)+'%'; nm.style.top=(r.y+r.h*along)+'%'; nm.style.transform='translate(0,-50%)'; }
        else { nm.style.left=(r.x+r.w*along)+'%'; nm.style.top=r.y+'%'; nm.style.transform='translate(-50%,-100%)'; }
      } else { nm.style.left='50%'; nm.style.top='50%'; nm.style.transform='translate(-50%,-50%)'; }
    }
    else if(N.mode==='free'){ nm.style.left=(N.x||0)+'%'; nm.style.top=(N.y||0)+'%'; nm.style.transform=''; }
  }
}
function _cePct(e){ const st=document.getElementById('ce-stage').getBoundingClientRect();
  return { x:((e.clientX-st.left)/st.width)*100, y:((e.clientY-st.top)/st.height)*100 }; }
/* an element's own box as percentages of the stage, for positioning things
   (like a name attached to a portrait) relative to another live element
   instead of the layout's raw x/y - needed because auto-spread portraits
   have no explicit x/y of their own, only their actual rendered position. */
function _cePctRect(el){
  const st=document.getElementById('ce-stage'); if(!st||!el) return null;
  const sr=st.getBoundingClientRect(), er=el.getBoundingClientRect();
  if(!sr.width||!sr.height) return null;
  return { x:((er.left-sr.left)/sr.width)*100, y:((er.top-sr.top)/sr.height)*100, w:(er.width/sr.width)*100, h:(er.height/sr.height)*100 };
}
function ceStartDrag(e,el,idx){ if(e.target.classList.contains('ce-rz')) return; e.preventDefault(); e.stopPropagation();
  // #99: ctrl/cmd-click toggles this element in/out of the multi-selection,
  // shift-click adds it - same convention as the main scene graph's own
  // multi-select. Only elements with a real, free-floating x/y of their own
  // can join a group (see _ceHasXY); this only toggles selection, it never
  // also starts a drag in the same gesture.
  if((e.ctrlKey||e.metaKey||e.shiftKey) && _ceHasXY(el)){
    if(e.ctrlKey||e.metaKey){ if(_ceMultiSel.has(el)) _ceMultiSel.delete(el); else _ceMultiSel.add(el); }
    else { _ceMultiSel.add(el); }
    ceSelect(el); renderCanvasMultiHighlight();
    return;
  }
  ceSelect(el); // select it regardless of whether it's locked, so a locked element can still be found + unlocked in the sidebar
  if(el==='name'){ if(_ceWork.name.mode==='inBox') return; if(_ceWork.name.locked) return; }
  else if(el==='portrait'){ if(_ceWork.portraits.locked) return; }
  else if(_ceWork[el] && _ceWork[el].locked) return;
  // #99: a plain click on a group member keeps the whole group selected (so
  // it drags together); a plain click on anything else starts a fresh
  // selection - restoring a saved group if this element belongs to one.
  if(_ceHasXY(el)){
    if(!_ceMultiSel.has(el)){ const g=_ceFindGroupContaining(el); _ceMultiSel = g ? new Set(g) : new Set([el]); }
  } else {
    _ceMultiSel.clear();
  }
  renderCanvasMultiHighlight();
  ceSnapshot();
  const p=_cePct(e);
  // 2+ elements selected: drag the whole group together instead of the
  // per-element branches below, which only ever move ONE thing at a time.
  if(_ceMultiSel.size>1 && _ceHasXY(el)){
    const origins={};
    _ceMultiSel.forEach(k=>{ const o=_ceWork[k]; if(o) origins[k]={ox:o.x||0,oy:o.y||0,ow:o.w,oh:o.h,locked:!!o.locked}; });
    _ceDrag={el:'__group',px:p.x,py:p.y,origins};
    document.addEventListener('mousemove',ceDragMove); document.addEventListener('mouseup',ceDragEnd);
    return;
  }
  if(el==='portrait'){
    if(_ceWork.portraits.mode==='box'){
      // #6: dragging a box-attached portrait stays attached (doesn't fall
      // back to a free manual position) - it just slides along whichever
      // box edge it's already on, recorded per-portrait in boxAlong[idx].
      const side=_ceWork.portraits.boxSide||'top', vertical=(side==='left'||side==='right');
      const b=_ceWork.box||{x:0,y:0,w:100,h:0}, base=vertical?b.y:b.x, span=vertical?b.h:b.w;
      if(!_ceWork.portraits.boxAlong) _ceWork.portraits.boxAlong=[];
      const along0=(_ceWork.portraits.boxAlong[idx]!=null)?_ceWork.portraits.boxAlong[idx]:((idx+0.5)*100/_cePortraitN);
      _ceDrag={el:'portrait',idx,mode:'moveBox',px:p.x,py:p.y,boxBase:base,boxSpan:span,boxVert:vertical,along0,curSide:side,sideStart:side};
    } else {
      if(_ceWork.portraits.mode!=='manual'){ _ceWork.portraits.mode='manual'; ceSyncSlots(); }
      const cur=_ceWork.portraits.slots[idx]||{x:p.x,y:70}; _ceDrag={el:'portrait',idx,mode:'move',ox:cur.x,oy:(cur.y!=null?cur.y:70),px:p.x,py:p.y};
    }
  }
  else if(el==='name'){ const o=_ceWork.name;
    if(o.mode==='portrait'){
      const p0=document.querySelector('#ce-portraits .ce-por[data-i="0"]'); const r=_cePctRect(p0)||{x:0,y:0,w:100,h:100};
      const side=o.portraitSide||'top', vertical=(side==='left'||side==='right'), along=(o.x!=null?o.x:50);
      const base=vertical?r.y:r.x, span=vertical?r.h:r.w;
      _ceDrag={el:'name',mode:'move',px:p.x,py:p.y,portBase:base,portSpan:span,portVert:vertical,px2left0:base+(along/100)*span,curSide:side,sideStart:side};
    } else { const bx=_ceWork.box.x||0, bw=_ceWork.box.w||90; _ceDrag={el:'name',mode:'move',ox:o.x||0,oy:o.y||0,px:p.x,py:p.y,px2left0:bx+((o.x||0)/100)*bw}; }
  }
  else { const o=_ceWork[el]; _ceDrag={el,mode:'move',ox:o.x,oy:o.y,px:p.x,py:p.y}; }
  document.addEventListener('mousemove',ceDragMove); document.addEventListener('mouseup',ceDragEnd); }
function ceStartResize(e,el){ e.preventDefault(); e.stopPropagation();
  ceSelect(el);
  if(_ceWork[el] && _ceWork[el].locked) return;
  ceSnapshot(); const p=_cePct(e); const o=_ceWork[el];
  _ceDrag={el,mode:'resize',ow:o.w,oh:o.h,px:p.x,py:p.y};
  document.addEventListener('mousemove',ceDragMove); document.addEventListener('mouseup',ceDragEnd); }
// #100: drag-resize for portraits, alongside the existing Size % field -
// there's one shared size for every portrait in a layout (same field the
// sidebar's Size % input already writes to), not a per-portrait width/height
// like the box has, so this tracks a single delta rather than reusing
// ceStartResize's w/h model.
function ceStartPortraitResize(e){ e.preventDefault(); e.stopPropagation();
  ceSelect('portraits');
  if(_ceWork.portraits.locked) return;
  ceSnapshot(); const p=_cePct(e);
  _ceDrag={el:'portraitSize',mode:'resize',oSize:_ceWork.portraits.size||38,px:p.x,py:p.y};
  document.addEventListener('mousemove',ceDragMove); document.addEventListener('mouseup',ceDragEnd); }
function ceSyncSlots(){ const cur=(_ceWork.portraits.slots||[]);
  const arr=[]; for(let i=0;i<_cePortraitN;i++){ arr.push(cur[i]||{x:Math.round((i+0.5)*100/_cePortraitN),y:70}); } _ceWork.portraits.slots=arr; }
function ceDragMove(e){ if(!_ceDrag) return; const p=_cePct(e);
  if(_ceDrag.el==='__group'){
    // #99: same delta applied to every selected element's own stored x/y
    // (all stage-absolute percentages, per _ceHasXY's scope), each clamped
    // exactly like a normal single-element move; a locked member sits out.
    const dx=p.x-_ceDrag.px, dy=p.y-_ceDrag.py;
    Object.keys(_ceDrag.origins).forEach(k=>{
      const orig=_ceDrag.origins[k]; const o=_ceWork[k]; if(!o||orig.locked) return;
      o.x=ceSnapPct(Math.max(0,Math.min(100-(orig.ow||o.w||10), orig.ox+dx)), _ceRefW());
      o.y=ceSnapPct(Math.max(0,Math.min(100-(orig.oh||o.h||8), orig.oy+dy)), _ceRefH());
    });
    cePlace(); return;
  }
  if(_ceDrag.el==='portrait'){
    if(_ceDrag.mode==='moveBox'){
      // #4: keep sliding along the current edge by DELTA from wherever this
      // drag (or its last corner-crossing) started, exactly as before - but
      // if the cursor has now drifted nearer a DIFFERENT edge of the box
      // (i.e. it went around a corner), re-baseline onto that edge instead
      // of forcing the stale axis, so a single drag can travel all the way
      // around the box instead of being stuck on whichever edge it began.
      const b=_ceWork.box||{x:0,y:0,w:100,h:0};
      const nearSide=_ceNearestBoxSide(b,p.x,p.y);
      if(nearSide!==_ceDrag.curSide){
        _ceDrag.curSide=nearSide; _ceDrag.boxVert=(nearSide==='left'||nearSide==='right');
        _ceDrag.boxBase=_ceDrag.boxVert?b.y:b.x; _ceDrag.boxSpan=_ceDrag.boxVert?b.h:b.w;
        const posAlong=_ceDrag.boxVert?p.y:p.x;
        _ceDrag.along0=_ceDrag.boxSpan>0?Math.max(0,Math.min(100,((posAlong-_ceDrag.boxBase)/_ceDrag.boxSpan)*100)):50;
        _ceDrag.px=p.x; _ceDrag.py=p.y;
      }
      const delta=_ceDrag.boxVert?(p.y-_ceDrag.py):(p.x-_ceDrag.px);
      const deltaPct=_ceDrag.boxSpan>0?(delta/_ceDrag.boxSpan*100):0;
      if(!_ceWork.portraits.boxAlong) _ceWork.portraits.boxAlong=[];
      _ceWork.portraits.boxAlong[_ceDrag.idx]=Math.max(0,Math.min(100,_ceDrag.along0+deltaPct));
      _ceWork.portraits.boxSide=_ceDrag.curSide;
      cePlace(); return;
    }
    ceSyncSlots(); _ceWork.portraits.slots[_ceDrag.idx]={x:Math.max(0,Math.min(100,_ceDrag.ox+(p.x-_ceDrag.px))), y:Math.max(0,Math.min(100,_ceDrag.oy+(p.y-_ceDrag.py)))}; cePlace(); return; }
  if(_ceDrag.el==='name'){
    if(_ceWork.name.mode==='tab'){ const bx=_ceWork.box.x||0, bw=_ceWork.box.w||90; _ceWork.name.x=Math.max(0,Math.min(100,((_ceDrag.px2left0+(p.x-_ceDrag.px))-bx)/bw*100)); }
    else if(_ceWork.name.mode==='portrait'){
      // same "drag it around a corner" edge hand-off as a box-attached
      // portrait, above, referenced against the speaking portrait instead
      // of the dialogue box.
      const p0=document.querySelector('#ce-portraits .ce-por[data-i="0"]'); const r=p0?_cePctRect(p0):null;
      if(r){
        const nearSide=_ceNearestBoxSide(r,p.x,p.y);
        if(nearSide!==_ceDrag.curSide){
          _ceDrag.curSide=nearSide; _ceDrag.portVert=(nearSide==='left'||nearSide==='right');
          _ceDrag.portBase=_ceDrag.portVert?r.y:r.x; _ceDrag.portSpan=_ceDrag.portVert?r.h:r.w;
          const posAlong=_ceDrag.portVert?p.y:p.x;
          const alongPct=_ceDrag.portSpan>0?Math.max(0,Math.min(100,((posAlong-_ceDrag.portBase)/_ceDrag.portSpan)*100)):50;
          _ceDrag.px2left0=_ceDrag.portBase+(alongPct/100)*_ceDrag.portSpan;
          _ceDrag.px=p.x; _ceDrag.py=p.y;
        }
        const delta=_ceDrag.portVert?(p.y-_ceDrag.py):(p.x-_ceDrag.px);
        const span=_ceDrag.portSpan||100, base=_ceDrag.portBase||0;
        _ceWork.name.x=Math.max(0,Math.min(100,((_ceDrag.px2left0+delta)-base)/span*100));
        _ceWork.name.portraitSide=_ceDrag.curSide;
      }
    }
    else { _ceWork.name.x=Math.max(0,Math.min(100,_ceDrag.ox+(p.x-_ceDrag.px))); _ceWork.name.y=Math.max(0,Math.min(100,_ceDrag.oy+(p.y-_ceDrag.py))); }
    cePlace(); return; }
  if(_ceDrag.el==='portraitSize'){
    // dragging down grows every portrait, up shrinks them - same shared
    // Size % field the sidebar's own input writes to.
    _ceWork.portraits.size=Math.round(Math.max(10,Math.min(100, _ceDrag.oSize+(p.y-_ceDrag.py))));
    cePlace(); return; }
  const o=_ceWork[_ceDrag.el];
  if(_ceDrag.mode==='move'){
    o.x=ceSnapPct(Math.max(0,Math.min(100-(o.w||10), _ceDrag.ox+(p.x-_ceDrag.px))), _ceRefW());
    o.y=ceSnapPct(Math.max(0,Math.min(100-(o.h||8), _ceDrag.oy+(p.y-_ceDrag.py))), _ceRefH());
  } else {
    o.w=ceSnapPct(Math.max(8,Math.min(100-o.x, _ceDrag.ow+(p.x-_ceDrag.px))), _ceRefW());
    o.h=ceSnapPct(Math.max(6,Math.min(100-o.y, _ceDrag.oh+(p.y-_ceDrag.py))), _ceRefH());
    if(_ceWork.uniformBoxSize && ['box','box2','box3','box4'].includes(_ceDrag.el)) syncBoxSizes(_ceDrag.el); }
  cePlace(); }
/* #16: with "keep all dialogue boxes the same size" on, resizing any one of
   them (main or 2/3/4) resizes every other enabled one to match, instead of
   authors having to eyeball/nudge each box to line them up by hand. */
function syncBoxSizes(sourceKey){
  const src=_ceWork[sourceKey]; if(!src) return;
  ['box','box2','box3','box4'].forEach(k=>{ if(k===sourceKey) return; const cfg=_ceWork[k]; if(cfg && (k==='box'||cfg.enabled)){ cfg.w=src.w; cfg.h=src.h; } });
}
function setCanvasUniformBoxSize(on){ ceSnapshot(); _ceWork.uniformBoxSize=!!on; if(on) syncBoxSizes('box'); renderCanvasPreview(); }
// #80: whole-layout toggle (not per-box), read by player/layout.js's own
// hideUntilSpoken() at play time - this preview doesn't simulate multiple
// lines/turns, so there's nothing to visually demo here beyond saving it.
function setCanvasHideUntilSpoken(on){ ceSnapshot(); _ceWork.hideUntilSpoken=!!on; renderCanvasControls(); }
function ceDragEnd(){ const drag=_ceDrag; _ceDrag=null; document.removeEventListener('mousemove',ceDragMove); document.removeEventListener('mouseup',ceDragEnd);
  if(!drag) return;
  // #99: a group move has no single element to attach-detect or shrink-to-fit
  // for, so it gets its own, simpler out-of-bounds check - one warning for
  // the whole group, "keep it" or undo the entire move at once.
  if(drag.el==='__group'){
    if(typeof ToolSettings!=='undefined' && ToolSettings.get('ceOobWarnOff','0')==='1') return;
    if(!_ceGroupOutOfBounds()) return;
    uiConfirm('This group has been dragged outside the visible screen area and may be cut off or not visible to players.',
      ()=>{}, // OK: leave the group where it was dropped
      { yes:'OK, keep it', no:'Cancel (undo)', onNo:()=>{ ceUndo(); },
        checkbox:{ label:'Don’t warn me again (re-enable in Settings → Workspace)',
                   onChecked:()=>{ if(typeof ToolSettings!=='undefined') ToolSettings.set('ceOobWarnOff','1'); } } });
    return;
  }
  // #100: a portrait-size drag isn't a positioned element (no attach
  // candidates, no on/off-stage bounds to warn about) - just refresh the
  // sidebar so its own Size % field (shown when "override each character's
  // own look" is on) doesn't sit stale after a drag changed the same value.
  if(drag.el==='portraitSize'){ renderCanvasControls(); return; }
  // dragging around a box-attached portrait or portrait-attached name can
  // change which edge it's on mid-drag (see ceDragMove) - the sidebar's own
  // "Attaches to" dropdown only needs a refresh once, at the end, not on
  // every mouse-move.
  if(drag.sideStart!=null){
    const nowSide = drag.el==='portrait' ? _ceWork.portraits.boxSide : _ceWork.name.portraitSide;
    if(nowSide!==drag.sideStart) renderCanvasControls();
  }
  // #1: dropping a portrait on the box (or the name tag on a portrait) only
  // OFFERS to attach it, via a confirm prompt, rather than attaching
  // automatically - overlapping on purpose, with no attach, is a valid
  // choice (declining just leaves it exactly where it was dropped).
  const candidate=ceDetectDragAnchorCandidate(drag);
  if(candidate){
    uiConfirm(`Attach this ${candidate.label} to ${candidate.targetLabel}’s ${candidate.side} edge?`,
      ()=>{ ceApplyDragAnchor(candidate); ceCheckOutOfBounds(drag, ()=>ceOfferCascadeAttach(candidate)); },
      { yes:'Attach', no:'Leave it (overlap)', onNo:()=>{ ceCheckOutOfBounds(drag); } });
    return;
  }
  ceCheckOutOfBounds(drag); }
// #4/#1/#94: drag-to-anchor shortcut, alongside (not instead of) the
// existing mode dropdowns - dropping a free/manual portrait onto the
// dialogue box, or the name tag onto a portrait, OFFERS to attach it to
// whichever edge it landed nearest (a confirm prompt, not an automatic
// attach - overlapping on purpose is a valid choice), without having to
// first flip the Placement dropdown to "Attached to..." and then a side
// dropdown to match. Only ever attaches to the MAIN dialogue box/portrait 0
// - the same single shared portraits.mode this layout already had, not a
// new per-portrait or per-box model.
//
// #94 made this work the OTHER way too for each pair: dragging the BOX onto
// a portrait offers the exact same attach as dragging a portrait onto the
// box (same end state either way - which element you happened to grab first
// shouldn't matter), and dragging a portrait onto the NAME tag offers the
// same attach as dragging the name onto a portrait. Checked in this order:
// whichever pair the dragged element could plausibly belong to, box/name
// before portrait since a portrait can trigger either of two different
// pairs depending on what it's over.
function _cePointInRect(x,y,r,margin){ margin=margin||0; return r && x>=r.x-margin && x<=r.x+r.w+margin && y>=r.y-margin && y<=r.y+r.h+margin; }
// shared geometry for "is DRAGGED's center over TARGET, and which edge/how far along": both directions of a pair
// end up wanting this exact same side+along computation, just with dragged/target swapped.
function _ceOverlapSideAlong(draggedR, targetR){
  // a rect that hasn't actually been laid out yet (zero width AND height,
  // e.g. an element the DOM hasn't measured) would otherwise trivially
  // "overlap" any other unmeasured rect at the same 0,0 origin - treat that
  // as no data rather than a false-positive full overlap.
  if(!draggedR.w && !draggedR.h) return null;
  if(!targetR.w && !targetR.h) return null;
  const cx=draggedR.x+draggedR.w/2, cy=draggedR.y+draggedR.h/2;
  if(!_cePointInRect(cx,cy,targetR,2)) return null;
  const side=_ceNearestBoxSide(targetR,cx,cy), vertical=(side==='left'||side==='right');
  const base=vertical?targetR.y:targetR.x, span=vertical?targetR.h:targetR.w, posAlong=vertical?cy:cx;
  return { side, along: span>0?Math.max(0,Math.min(100,((posAlong-base)/span)*100)):50 };
}
function ceDetectDragAnchorCandidate(drag){
  const L=_ceWork;
  const boxEl=document.getElementById('ce-box'), br=boxEl&&_cePctRect(boxEl);
  const p0=document.querySelector('#ce-portraits .ce-por[data-i="0"]'), pr=p0&&_cePctRect(p0);
  const nameEl=document.getElementById('ce-name'), nr=nameEl&&_cePctRect(nameEl);
  if(drag.el==='portrait' && L.portraits.mode!=='box'){
    const el=_ceDragTargetEl(drag), r=el&&_cePctRect(el);
    if(r && br){ const hit=_ceOverlapSideAlong(r,br); if(hit) return { kind:'portraitToBox', idx:drag.idx, side:hit.side, along:hit.along, label:'portrait', targetLabel:'the dialogue box' }; }
    // reverse of nameToPortrait below: only meaningful for portrait 0, the
    // one a name tag can actually attach to.
    if(drag.idx===0 && r && nr && (L.name.mode==='free'||L.name.mode==='tab')){
      const hit=_ceOverlapSideAlong(r,nr); if(hit) return { kind:'nameToPortrait', side:hit.side, along:hit.along, label:'portrait', targetLabel:'the name tag' };
    }
    return null;
  }
  if(drag.el==='box' && L.portraits.mode!=='box' && br && pr){
    const hit=_ceOverlapSideAlong(br,pr); if(hit) return { kind:'portraitToBox', idx:0, side:hit.side, along:hit.along, label:'dialogue box', targetLabel:'the portrait (attaches every portrait to this edge)' };
    return null;
  }
  if(drag.el==='name' && (L.name.mode==='free'||L.name.mode==='tab') && nr && pr){
    const hit=_ceOverlapSideAlong(nr,pr); if(hit) return { kind:'nameToPortrait', side:hit.side, along:hit.along, label:'name tag', targetLabel:'the portrait' };
  }
  return null;
}
function ceApplyDragAnchor(c){
  const L=_ceWork;
  if(c.kind==='portraitToBox'){
    L.portraits.mode='box'; L.portraits.boxSide=c.side;
    if(!L.portraits.boxAlong) L.portraits.boxAlong=[];
    L.portraits.boxAlong[c.idx]=c.along;
  } else if(c.kind==='nameToPortrait'){
    L.name.mode='portrait'; L.name.portraitSide=c.side; L.name.x=c.along;
  }
  renderCanvasControls(); cePlace();
}
// #101: attaching one pair (portrait<->box, name<->portrait) can, as a side
// effect of the layout shift, also bring a SECOND still-detached related
// element (e.g. the name tag) to rest right against its own natural partner
// - offer that follow-up attach too, as its own one-click "Attach"/"Leave
// it" prompt, instead of making the author repeat the same drag a second
// time. Chains at most one hop past the attach that was just confirmed
// (name<->portrait can't itself trigger a further portrait<->box offer),
// same as the original request's own example (portrait to box AND name tag).
// Never auto-attaches, same as every other drag-to-anchor offer.
function ceOfferCascadeAttach(applied){
  const L=_ceWork;
  if(applied.kind==='portraitToBox'){
    if(L.name.mode!=='free' && L.name.mode!=='tab') return; // name tag already attached, or in the box
    const p0=document.querySelector('#ce-portraits .ce-por[data-i="0"]'), nameEl=document.getElementById('ce-name');
    const pr=p0&&_cePctRect(p0), nr=nameEl&&_cePctRect(nameEl);
    if(!pr||!nr) return;
    const hit=_ceOverlapSideAlong(nr,pr); if(!hit) return;
    uiConfirm(`The name tag landed on the portrait too; attach it to the portrait’s ${hit.side} edge?`,
      ()=>{ ceApplyDragAnchor({ kind:'nameToPortrait', side:hit.side, along:hit.along }); },
      { yes:'Attach', no:'Leave it (overlap)' });
  } else if(applied.kind==='nameToPortrait'){
    if(L.portraits.mode==='box') return; // portrait already attached to the box
    const boxEl=document.getElementById('ce-box'), p0=document.querySelector('#ce-portraits .ce-por[data-i="0"]');
    const br=boxEl&&_cePctRect(boxEl), pr=p0&&_cePctRect(p0);
    if(!br||!pr) return;
    const hit=_ceOverlapSideAlong(pr,br); if(!hit) return;
    uiConfirm(`The portrait landed on the dialogue box too; attach it to the box’s ${hit.side} edge?`,
      ()=>{ ceApplyDragAnchor({ kind:'portraitToBox', idx:0, side:hit.side, along:hit.along }); },
      { yes:'Attach', no:'Leave it (overlap)' });
  }
}
// #2: the live DOM element a given drag/resize gesture actually moved,
// so ceCheckOutOfBounds() can measure its REAL rendered position/size
// (via _cePctRect, already used for name-to-portrait math) rather than
// re-deriving it from the raw layout data, which differs in shape per
// element type (box has x/y/w/h, a portrait slot is just a point, etc).
function _ceDragTargetEl(drag){
  if(drag.el==='portrait') return document.querySelector('#ce-portraits .ce-por[data-i="'+drag.idx+'"]');
  if(drag.el==='name') return document.getElementById('ce-name');
  if(drag.el==='choices') return document.getElementById('ce-choices');
  if(drag.el==='continuePrompt') return document.getElementById('ce-cont');
  return document.getElementById('ce-'+drag.el); // box, box2, box3, box4
}
// #2: warn once a drag/resize gesture ends with the element sitting even
// partly outside the visible 0-100% stage - "OK" leaves it where dropped
// (now visibly hanging off, not silently clipped), "Cancel" reverts via
// the same undo stack ceStartDrag()/ceStartResize() already snapshot into
// at the START of this exact gesture. Off entirely once the user ticks
// "don't warn me again" (Settings → Workspace can turn it back on).
// #94: only elements with a genuine, independently-set w/h (the main box,
// boxes 2-4, or the free-mode choices panel) have a "size" that shrinking
// could meaningfully act on; portraits, the name tag, and the continue
// prompt are single points with no width/height of their own to shrink.
function _ceShrinkTarget(el){
  if(['box','box2','box3','box4'].includes(el)) return el;
  if(el==='choices' && _ceWork.choices.mode==='free') return el;
  return null;
}
function ceShrinkToFit(el){
  const o=_ceWork[el]; if(!o) return;
  o.w=Math.min(o.w||10, 100);
  o.h=Math.min(o.h||8, 100);
  o.x=Math.max(0, Math.min(o.x||0, 100-o.w));
  o.y=Math.max(0, Math.min(o.y||0, 100-o.h));
  if(_ceWork.uniformBoxSize && ['box','box2','box3','box4'].includes(el)) syncBoxSizes(el);
  renderCanvasControls(); cePlace();
  toast('Resized to fit within the visible screen area');
}
// #101: optional afterClose runs once this check is fully settled (no
// out-of-bounds warning needed at all, or the warning was shown and
// dismissed via "keep it"/"shrink to fit") - used to chain a cascade
// attach offer onto the END of the gesture, never before or during the
// out-of-bounds prompt (uiConfirm() is a single shared modal, so two
// prompts can't be shown back to back). Skipped on "Cancel (undo)": that
// reverts the whole gesture, including the attach that would have started
// the cascade, so there's nothing left to chain onto.
function ceCheckOutOfBounds(drag, afterClose){
  if(typeof ToolSettings!=='undefined' && ToolSettings.get('ceOobWarnOff','0')==='1'){ afterClose&&afterClose(); return; }
  const el=_ceDragTargetEl(drag); if(!el){ afterClose&&afterClose(); return; }
  const r=_cePctRect(el); if(!r){ afterClose&&afterClose(); return; }
  const tol=0.5; // guards against harmless sub-pixel rounding right at the edge
  const out = r.x < -tol || r.y < -tol || (r.x+r.w) > 100+tol || (r.y+r.h) > 100+tol;
  if(!out){ afterClose&&afterClose(); return; }
  const shrinkEl=_ceShrinkTarget(drag.el);
  uiConfirm('This element has been dragged outside the visible screen area and may be cut off or not visible to players.',
    ()=>{ afterClose&&afterClose(); }, // OK: leave it where it was dropped
    { yes:'OK, keep it', no:'Cancel (undo)',
      onNo:()=>{ ceUndo(); },
      extra: shrinkEl ? { label:'Shrink to fit', onClick:()=>{ ceShrinkToFit(shrinkEl); afterClose&&afterClose(); } } : undefined,
      checkbox:{ label:'Don’t warn me again (re-enable in Settings → Workspace)',
                 onChecked:()=>{ if(typeof ToolSettings!=='undefined') ToolSettings.set('ceOobWarnOff','1'); } } });
}
function setCeOobWarn(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('ceOobWarnOff', on?'0':'1'); }
function switchCanvasScope(scope){ openCanvasEditor(scope); }
// #96: apply against a clean CANVAS_DEFAULT baseline for every element the
// template actually touches, instead of merging on top of whatever the
// PREVIOUS template or manual edits left behind - otherwise a field the new
// template doesn't happen to mention (portraits.mode, an old box2 size, a
// stray alpha/lock override...) silently carries over, so the same template
// can render differently depending on what was applied before it, and it
// stops looking like its own preview. A box2/box3/box4 entry in a template
// also always means "show it" - no template here should have to also
// remember to set enabled:true just to make its own second box appear.
function applyCanvasTemplate(key){ if(!key||!CANVAS_TEMPLATES[key]) return; ceSnapshot(); const tpl=CANVAS_TEMPLATES[key]; const t=tpl.l;
  ['box','box2','box3','box4','choices','portraits'].forEach(k=>{ if(!t[k]) return;
    const isExtraBox=(k==='box2'||k==='box3'||k==='box4');
    _ceWork[k]=Object.assign({}, CANVAS_DEFAULT[k], isExtraBox?{enabled:true}:{}, t[k]); });
  // #1: the template also sets how many sample portraits fit its design,
  // and (for templates whose own portraits.mode/slots came along above) pads
  // the manual-slot array out to match, instead of always leaving whatever
  // count/arrangement the PREVIOUS template or manual edits left behind.
  if(tpl.portraitCount){ _cePortraitN=Math.max(1,Math.min(4,tpl.portraitCount)); if(_ceWork.portraits.mode==='manual') ceSyncSlots(); }
  renderCanvasControls(); renderCanvasPreview(); }
// #96: a small schematic SVG preview for the template picker - box/box2 as
// outlined rectangles, a free-mode choices panel as a dashed rectangle, and
// a portrait as a plain circle (at its real manual slot, or a representative
// spot for its anchor when auto-spread) - all at the template's own real
// percentages, so the thumbnail is an honest miniature of what applying it
// actually looks like, not just a label.
function _ceTemplateThumbSvg(tpl){
  const t=tpl.l, W=160, H=100;
  const rectFor=(o,def)=>Object.assign({x:0,y:0},def,o);
  const boxSvg=(o)=>{ const r=rectFor(o,{w:96,h:20}); return `<rect x="${r.x/100*W}" y="${r.y/100*H}" width="${r.w/100*W}" height="${r.h/100*H}" rx="3" fill="#1e2a3f" stroke="#67e8f9" stroke-width="1.5"/>`; };
  let svg='';
  if(t.box) svg+=boxSvg(t.box);
  if(t.box2) svg+=boxSvg(t.box2);
  if(t.choices && t.choices.mode==='free'){
    const c=rectFor(t.choices,{w:30,h:16});
    svg+=`<rect x="${c.x/100*W}" y="${c.y/100*H}" width="${c.w/100*W}" height="${c.h/100*H}" rx="3" fill="none" stroke="#c4b5fd" stroke-width="1.5" stroke-dasharray="3,2"/>`;
  }
  const portraitSvg=(cx,cy,r)=>`<circle cx="${cx/100*W}" cy="${cy/100*H}" r="${r}" fill="#94a3b8" opacity="0.85"/>`;
  const p=t.portraits||{};
  if(p.mode==='manual' && Array.isArray(p.slots) && p.slots.length){
    p.slots.forEach(s=>{ svg+=portraitSvg(s.x!=null?s.x:50, s.y!=null?s.y:70, 6); });
  } else {
    const anchor=p.anchor||'bottom';
    const cy = anchor==='top' ? 18 : anchor==='center' ? 50 : 78;
    svg+=portraitSvg(50, cy, 7);
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width="${W}" height="${H}" fill="#0b0f1a"/>${svg}</svg>`;
}
function openTemplatePicker(){
  const grid=document.getElementById('ce-tpl-grid'); if(!grid) return;
  grid.innerHTML=Object.keys(CANVAS_TEMPLATES).map(k=>{
    const tpl=CANVAS_TEMPLATES[k];
    return `<div class="ce-tpl-card" onclick="applyCanvasTemplate('${k}');closeTemplatePicker();" title="${escAttr(tpl.label)}">
      <div class="ce-tpl-thumb">${_ceTemplateThumbSvg(tpl)}</div>
      <div class="ce-tpl-label">${escHtml(tpl.label)}</div>
    </div>`;
  }).join('');
  document.getElementById('ce-tpl-picker').classList.remove('hidden');
}
function closeTemplatePicker(){ const m=document.getElementById('ce-tpl-picker'); if(m) m.classList.add('hidden'); }
function setCanvasBox(f,v){ ceSnapshot(); _ceWork.box[f]=(f==='autoFit')?!!v:(f==='fontSize'||f==='bgAlpha'||f==='alpha')?(parseInt(v,10)||((f==='bgAlpha'||f==='alpha')?100:19)):v; cePlace(); }
function setCanvasBox2(f,v){ ceSnapshot(); _ceWork.box2[f]=(f==='enabled')?!!v:v; renderCanvasPreview(); }
function _ceBoxCount(){ return 1 + [2,3,4].filter(n=>_ceWork['box'+n]&&_ceWork['box'+n].enabled).length; }
function setCanvasBoxCount(v){ const n=parseInt(v,10)||1; const wasSingle=_ceBoxCount()===1;
  [2,3,4].forEach(k=>{ _ceWork['box'+k].enabled = (k<=n); });
  // "keep all dialogue boxes the same size" defaults on the first time a
  // layout actually goes multi-box, per the request; a later explicit
  // uncheck is remembered and not re-forced back on by shrinking to one box
  // and growing again.
  if(wasSingle && n>1 && _ceWork.uniformBoxSize===undefined){ _ceWork.uniformBoxSize=true; syncBoxSizes('box'); }
  renderCanvasControls(); renderCanvasPreview(); }
function setCanvasCombineBoxes(on){ [2,3,4].forEach(k=>{ _ceWork['box'+k].combine=!!on; }); renderCanvasPreview(); }
function setCanvasChoices(f,v){ ceSnapshot(); _ceWork.choices[f]=(f==='alpha')?(parseInt(v,10)||100):v; renderCanvasPreview(); }
function setCanvasPortraits(f,v){ ceSnapshot(); _ceWork.portraits[f]=(f==='offY')?(parseInt(v,10)||0):(f==='size')?(parseInt(v,10)||38):(f==='alpha')?(parseInt(v,10)||100):v; if(f==='mode'&&v==='manual') ceSyncSlots();
  // #5: 'overrideChars' toggles whether the Shape/Fit/Size fields below it
  // are shown at all, same reason 'mode' already needed this.
  if(f==='mode'||f==='overrideChars') renderCanvasControls(); cePlace(); }
function setCanvasSampleN(v){ _cePortraitN=parseInt(v,10)||2; if(_ceWork.portraits.mode==='manual') ceSyncSlots(); renderCanvasPreview(); }
function setPortraitLink(i,v){ ceSnapshot(); if(_ceWork.portraits.mode!=='manual'){ _ceWork.portraits.mode='manual'; ceSyncSlots(); } if(!_ceWork.portraits.slots[i]) ceSyncSlots(); _ceWork.portraits.slots[i].link = (v===''?null:parseInt(v,10)); renderCanvasControls(); cePlace(); }
function linkAllPortraits(){ ceSnapshot(); _ceWork.portraits.mode='manual'; ceSyncSlots(); for(let i=1;i<_cePortraitN;i++){ _ceWork.portraits.slots[i].link=0; } renderCanvasControls(); cePlace(); }
function unlinkAllPortraits(){ ceSnapshot(); (_ceWork.portraits.slots||[]).forEach(sl=>{ if(sl) sl.link=null; }); renderCanvasControls(); cePlace(); }
function _slotPos(i){ let sl=_ceWork.portraits.slots[i], guard=0; while(sl && sl.link!=null && _ceWork.portraits.slots[sl.link] && guard++<6){ sl=_ceWork.portraits.slots[sl.link]; } return sl; }
function setCanvasName(f,v){ ceSnapshot(); _ceWork.name[f]=(f==='bg'||f==='matchBox')?!!v:(f==='alpha')?(parseInt(v,10)||100):v; if(f==='mode'||f==='bg') renderCanvasControls(); cePlace(); }
function setCanvasContinuePrompt(f,v){ ceSnapshot(); _ceWork.continuePrompt[f]=(f==='enabled')?!!v:v; if(f==='enabled'||f==='mode'){ renderCanvasControls(); renderCanvasPreview(); } else cePlace(); }
// #168: a plain project.settings write, not part of the layout system (no
// undo snapshot, no per-scope save/reset) - matches setCursorSoundEnabled()'s
// own precedent for a simple project-wide toggle.
function setNarrationDim(on){ if(!project.settings.narration) project.settings.narration={dimOthers:true}; project.settings.narration.dimOthers=!!on; }
function addCanvasAnim(el){ ceSnapshot(); _ceWork.anim[el].push({type:'fade',dir:'up',delay:0,speed:1}); renderCanvasControls(); cePlace(); }
function removeCanvasAnim(el,i){ ceSnapshot(); _ceWork.anim[el].splice(i,1); renderCanvasControls(); cePlace(); }
function moveCanvasAnim(el,i,delta){ const list=_ceWork.anim[el]; const j=i+delta; if(j<0||j>=list.length) return; ceSnapshot(); const t=list[i]; list[i]=list[j]; list[j]=t; renderCanvasControls(); }
function setCanvasAnimItem(el,i,f,v){ const a=_ceWork.anim[el][i]; if(!a) return;
  a[f]=(f==='delay'||f==='speed')?(parseFloat(v)||0):v;
  if(f==='type') renderCanvasControls(); }
function saveCanvasLayout(){ pushUndo(); const tgt=layoutTarget(_ceScope); tgt.layout=JSON.parse(JSON.stringify(_ceWork));
  _ceSavedSnapshot=JSON.stringify(_ceWork);   // #129: this is now the new clean baseline
  toast('Layout saved'+(_ceScope==='project'?' (whole project)':' for this '+(scenes[_ceScope]?'scene':'group'))); }
// #129: true only once _ceWork has actually diverged from what's really
// saved for this scope (open, Save, Reset and loading a named layout all
// keep this correct - see _ceSavedSnapshot's own comment above).
function ceIsDirty(){ return !!(_ceWork && _ceSavedSnapshot!==null && JSON.stringify(_ceWork)!==_ceSavedSnapshot); }
function setCeUnsavedWarn(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('ceUnsavedWarnOff', on?'0':'1'); }
function ceRequestClose(){
  if((typeof ToolSettings!=='undefined' && ToolSettings.get('ceUnsavedWarnOff','0')==='1') || !ceIsDirty()){ closeModal('canvas-modal'); return; }
  uiConfirm('Close the Canvas editor without saving? Your layout changes for this scope will be lost.',
    ()=>closeModal('canvas-modal'),
    { yes:'Close without saving', no:'Keep editing',
      extra:{ label:'Save then close', onClick:()=>{ saveCanvasLayout(); closeModal('canvas-modal'); } },
      checkbox:{ label:'Don’t warn me again (re-enable in Settings → Workspace)',
                 onChecked:()=>{ if(typeof ToolSettings!=='undefined') ToolSettings.set('ceUnsavedWarnOff','1'); } } });
}
function resetCanvasLayout(){ const tgt=layoutTarget(_ceScope);
  if(_ceScope==='project'){ _ceWork=JSON.parse(JSON.stringify(CANVAS_DEFAULT)); }
  else { delete tgt.layout; _ceWork=project.layout?JSON.parse(JSON.stringify(project.layout)):JSON.parse(JSON.stringify(CANVAS_DEFAULT)); toast('Override cleared; inherits project layout'); }
  ['box','box2','box3','box4','choices','portraits','name','anim','continuePrompt'].forEach(k=>{ _ceWork[k]=Object.assign({}, CANVAS_DEFAULT[k], _ceWork[k]||{}); });
  ['box','choices','portraits'].forEach(k=>{ _ceWork.anim[k]=ceNormalizeAnimList(_ceWork.anim&&_ceWork.anim[k]); });
  renderCanvasControls(); renderCanvasPreview(); }

/* #6: save / load named canvas layouts (persisted, reusable across projects) */
function _ceSavedStore(){ try{ return JSON.parse(ToolSettings.get('canvasLayouts','')||'{}'); }catch(e){ return {}; } }
function ceSavedNames(){ return Object.keys(_ceSavedStore()); }
function ceSaveNamedLayout(){ const nm=(prompt('Name this layout:','My layout')||'').trim(); if(!nm) return;
  const store=_ceSavedStore(); store[nm]=JSON.parse(JSON.stringify(_ceWork)); ToolSettings.set('canvasLayouts', JSON.stringify(store));
  renderCanvasControls(); toast('Layout \u201C'+nm+'\u201D saved'); }
function ceLoadNamedLayout(nm){ if(!nm) return; const store=_ceSavedStore(); if(!store[nm]) return; ceSnapshot();
  _ceWork=JSON.parse(JSON.stringify(store[nm])); ['box','box2','box3','box4','choices','portraits','name','anim','continuePrompt'].forEach(k=>{ _ceWork[k]=Object.assign({}, CANVAS_DEFAULT[k], _ceWork[k]||{}); });
  ['box','choices','portraits'].forEach(k=>{ _ceWork.anim[k]=ceNormalizeAnimList(_ceWork.anim&&_ceWork.anim[k]); });
  renderCanvasControls(); renderCanvasPreview(); toast('Loaded \u201C'+nm+'\u201D'); }
/* #7: one switch to auto-fit text in boxes, choices and name tags */
function setCanvasAutoFit(on){ ceSnapshot(); _ceWork.box.autoFit=!!on; if(_ceWork.box2)_ceWork.box2.autoFit=!!on; _ceWork.autoFitText=!!on; renderCanvasControls(); cePlace(); }
/* keyboard undo/redo while the canvas editor is open */
document.addEventListener('keydown', function(e){ const m=document.getElementById('canvas-modal'); if(!m||m.classList.contains('hidden')) return;
  if((e.ctrlKey||e.metaKey) && !e.shiftKey && (e.key==='z'||e.key==='Z')){ e.preventDefault(); ceUndo(); }
  else if((e.ctrlKey||e.metaKey) && (e.key==='y'||e.key==='Y'|| (e.shiftKey&&(e.key==='z'||e.key==='Z')))){ e.preventDefault(); ceRedo(); } });
