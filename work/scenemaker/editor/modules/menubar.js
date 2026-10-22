/* ============================================================================
   Scenemaker editor; application menu bar + hotkeys
   A traditional File / Edit / View / Insert / Tools / Help menu, themed with the
   editor's CSS variables. Classic script sharing global scope with core.js.
   ==========================================================================*/

/* ---- menu actions (thin wrappers over existing editor functions) --------- */
function doNew(){
  // #86: with tabs, New opens a fresh tab alongside whatever's already open
  // instead of overwriting it, so there's nothing left to warn about losing.
  if(typeof ProjectTabs!=='undefined' && ProjectTabs.ready){ ProjectTabs.newTab(); return; }
  const proceed=()=>{
    if(typeof disconnectSavedFile==='function') disconnectSavedFile();
    loadProject(blankProject(), true); addScene(360,160); toast('New story; press ⚙️ Settings to name it'); };
  // #6: only ask at all when there's actually something unsaved to lose, and
  // ask via the app's own themed modal (uiConfirm, core.js) instead of the
  // browser's native confirm() - matching house style and giving a "don't
  // ask again"-style Cancel button instead of an unstylable OS dialog.
  if(!_dirty){ proceed(); return; }
  uiConfirm('Start a new story? Any unsaved changes will be lost.', proceed, { yes:'Start new', no:'Cancel' });
}
function menuDuplicate(){ if(selectedNode&&scenes[selectedNode]) duplicateScene(selectedNode); else toast('Select a scene first (click its header)'); }
function menuDelete(){ if(selectedNode&&scenes[selectedNode]){ confirmDeleteScene(selectedNode); } else toast('Select a scene first (click its header)'); }
function menuZoomIn(){ setZoom(0.1); }
function menuZoomOut(){ setZoom(-0.1); }
function menuAbout(){
  var body=document.getElementById('about-body');
  document.getElementById('about-modal').classList.remove('hidden');
  fetch('./about.html').then(function(r){ return r.text(); })
    .then(function(html){ body.innerHTML=html; })
    .catch(function(){ body.innerHTML='<div class="sec"><p class="hint" style="font-size:13px">Scenemaker; an interactive scenario builder with SCORM export. Made by <b>Nostalginaut</b>.</p></div>'; });
}
function openResources(){
  var body=document.getElementById('resources-body');
  document.getElementById('resources-modal').classList.remove('hidden');
  fetch('./resources.html').then(function(r){ return r.text(); })
    .then(function(html){ body.innerHTML=html; })
    .catch(function(){ body.innerHTML='<div class="hint" style="font-size:13px">Couldn\u2019t load the resource list. You can edit it at <b>editor/resources.html</b>.</div>'; });
}
function openCharacters(){ openDock('chars'); if(typeof maybeShowMini==='function') maybeShowMini('chars'); }
function openVariables(){ openDock('vars'); if(typeof maybeShowMini==='function') maybeShowMini('vars'); }
function toggleSnapScenes(){ const on=ToolSettings.get('snapScenes','0')==='1'; ToolSettings.set('snapScenes', on?'0':'1'); buildMenubar(); toast('Snap to grid '+(on?'off':'on')); }
// #122: menu actions can't take arguments (menuRun calls window[name]() with
// none), so each dockable panel gets its own thin wrapper over the shared
// dockToggleOpen(id) (dockpanels.js, loaded after this file - fine, these
// only ever run later from a real click, well after every script has loaded).
function toggleDockChars(){ dockToggleOpen('chars'); }
function toggleDockVars(){ dockToggleOpen('vars'); }
function toggleDockScenesPanel(){ dockToggleOpen('scenes'); }
function toggleDockProps(){ dockToggleOpen('props'); }
function toggleDockAssets(){ dockToggleOpen('assets'); }

/* ---- menu definition ----------------------------------------------------- */
const MENU_DEF = [
  { title:'File', items:[
    { label:'New',           key:'Ctrl+N', act:'doNew' },
    { label:'Open…',         key:'Ctrl+O', act:'doOpen' },
    { label:'Save',          key:'Ctrl+S',       act:'doSave' },
    { label:'Save As…',      key:'Ctrl+Shift+S', act:'doSaveAs' },
    { sep:1 },
    { label:'Export…',       key:'Ctrl+E', act:'openExportModal' },
    { label:'Preview',       key:'Ctrl+P', act:'doPreview' },
  ]},
  { title:'Edit', items:[
    { label:'Undo',            key:'Ctrl+Z', act:'undo' },
    { label:'Redo',            key:'Ctrl+Y', act:'redo' },
    { sep:1 },
    { label:'Duplicate scene', key:'Ctrl+D', act:'menuDuplicate' },
    { label:'Delete scene',    key:'Del',    act:'menuDelete' },
    { sep:1 },
    { label:'Find in project…', key:'Ctrl+F', act:'openFindProject' },
    { label:'Fill in next empty content…', key:'', act:'findNextEmptyContent' },
  ]},
  { title:'View', items:[
    { label:'Zoom in',    key:'Ctrl+=', act:'menuZoomIn' },
    { label:'Zoom out',   key:'Ctrl+-', act:'menuZoomOut' },
    { label:'Reset zoom', key:'Ctrl+0', act:'resetZoom' },
    { sep:1 },
    { label:'Collapse all scenes', key:'', act:'collapseAllScenes' },
    { label:'Expand all scenes', key:'', act:'expandAllScenes' },
    { label:'Clean up board (de-overlap)', key:'', act:'cleanUpBoard' },
    { label:'Auto-color scenes by speaker', key:'', act:'autoColorScenesBySpeaker' },
    { sep:1 },
    { toggle:'snapScenes', label:'Snap scenes to grid', act:'toggleSnapScenes' },
    { toggle:'snapPanels', label:'Snap panels to grid', act:'toggleSnapPanels' },
    { sep:1 },
    { dockToggle:'chars',  label:'Characters panel', act:'toggleDockChars' },
    { dockToggle:'vars',   label:'Variables panel',  act:'toggleDockVars' },
    { dockToggle:'scenes', label:'Scenes panel',     act:'toggleDockScenesPanel' },
    { dockToggle:'props',  label:'Properties panel', act:'toggleDockProps' },
    { dockToggle:'assets', label:'Assets panel',     act:'toggleDockAssets' },
  ]},
  { title:'Insert', items:[
    { label:'Scene', key:'', act:'addSceneAtView' },
    { label:'Group', key:'', act:'createBackdrop' },
  ]},
  { title:'Tools', items:[
    { label:'Sound Studio (record / edit)…', key:'', act:'openSoundStudio' },
    { label:'Image Studio (crop / edit)…', key:'', act:'openImageStudio' },
    { label:'Characters',      key:'', act:'openCharacters' },
    { label:'Variables',       key:'', act:'openVariables' },
    { sep:1 },
    { label:'Settings…', key:'', act:'openStorySettings' },
  ]},
  { title:'Help', items:[
    { label:'Help index (search)…', key:'', act:'openHelpIndex' },
    { sep:1 },
    { label:'Restart tutorial', key:'', act:'restartTutorial' },
    { label:'Replay all tutorials', key:'', act:'replayAllTutorials' },
    { label:'Sample story tour…', key:'', act:'startFullTutorial' },
    { label:'Download theme template…', key:'', act:'downloadThemeTemplate' },
    { label:'Import editor theme…', key:'', act:'importCustomTheme' },
    { label:'About Scenemaker', key:'', act:'menuAbout' },
  ]},
];

function buildMenubar(){
  const bar=document.getElementById('menubar'); if(!bar) return;
  bar.innerHTML = MENU_DEF.map((m,mi)=>`
    <div class="menu" data-mi="${mi}">
      <div class="menu-title" onclick="menuToggle(${mi})" onmouseenter="menuHover(${mi})">${m.title}</div>
      <div class="menu-drop" id="menu-drop-${mi}">
        ${m.items.map((it,ii)=> it.sep ? '<div class="menu-sep"></div>' :
          `<div class="menu-item" onclick="menuRun(${mi},${ii})">
             <span class="mi-check">${it.toggle?(ToolSettings.get(it.toggle,'0')==='1'?'✔':'') : it.dockToggle?(dockState(it.dockToggle).open?'✔':''):''}</span>
             <span class="mi-label">${it.label}</span>
             <span class="mi-key">${it.key||''}</span>
           </div>`).join('')}
      </div>
    </div>`).join('');
}
function closeMenus(){ document.querySelectorAll('.menu-drop.open').forEach(d=>d.classList.remove('open'));
  document.querySelectorAll('.menu.active').forEach(m=>m.classList.remove('active')); }
function menuToggle(mi){ const drop=document.getElementById('menu-drop-'+mi); const open=drop.classList.contains('open'); closeMenus();
  if(!open){ drop.classList.add('open'); document.querySelector('.menu[data-mi="'+mi+'"]').classList.add('active'); } }
function menuHover(mi){ if(document.querySelector('.menu-drop.open')) menuToggle(mi); }   // switch menus on hover once one is open
function menuRun(mi,ii){ const it=MENU_DEF[mi].items[ii]; closeMenus(); if(it.act) runAction(it.act); }
function runAction(name){ if(typeof window[name]==='function') window[name](); }
document.addEventListener('click', e=>{ if(!e.target.closest('.menu')) closeMenus(); });

/* ---- application hotkeys -------------------------------------------------- */
window.addEventListener('keydown', e=>{
  const mod = e.ctrlKey||e.metaKey;
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target&&e.target.tagName)||'');
  if(mod){
    const k=(e.key||'').toLowerCase();
    // Undo/redo edits at the structural level (add/delete scene, character, etc.);
    // keystroke-level text edits (a dialogue line, a choice label) never snapshot
    // per character. Hijacking Ctrl+Z/Y while typing in a field would block the
    // browser's own native per-character undo AND jump back to the last
    // structural snapshot, silently discarding everything typed since then with
    // no way to get it back. Let the field's native undo handle itself instead.
    if(k==='z' && !inField){ e.preventDefault(); (e.shiftKey?redo:undo)(); return; }
    if(k==='y' && !inField){ e.preventDefault(); redo(); return; }
    if(k==='s'){ e.preventDefault(); runAction(e.shiftKey?'doSaveAs':'doSave'); return; }
    if(k==='='||k==='+'){ e.preventDefault(); menuZoomIn(); return; }
    if(k==='-'||k==='_'){ e.preventDefault(); menuZoomOut(); return; }
    const map={ o:'doOpen', n:'doNew', e:'openExportModal', p:'doPreview', d:'menuDuplicate', f:'openFindProject', '0':'resetZoom' };
    if(map[k]){ e.preventDefault(); runAction(map[k]); return; }
  }
  if(e.key==='Escape'){ closeMenus(); }
  if(!inField && (e.key==='Delete')){ menuDelete(); }
});

window.addEventListener('load', buildMenubar);
