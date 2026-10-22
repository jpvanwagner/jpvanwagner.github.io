/* ============================================================================
   Scenemaker editor; dockable Characters / Variables panels (#8)
   Panels dock to the far-right (default) or far-left, float anywhere (always on
   top, dragged by the header), collapse into their header bar, or close. When
   more than one panel is docked to the SAME side they STACK vertically (splitting
   the column) instead of overlapping, and ▲/▼ reorder them. Layout persists via
   ToolSettings; float dragging honours the "snap panels to grid" toggle (#9).
   #211: a side can also hold more than one COLUMN of stacked panels (⇄ moves a
   panel to the side's other column) instead of forcing every docked panel into
   one ever-shrinking stack. #212: any panel, floating or docked, can also be
   resized taller/shorter by its own bottom edge (independent of the width
   handle above) - a manually-set height sticks (double-click the handle to go
   back to auto-splitting the column's space); this can leave a docked column
   not fully filling its side, which is expected, not a bug.
   ==========================================================================*/

const DOCK_TOP=82, DOCK_HEAD=40, GRID_PANEL=20, DOCK_BOTTOM=26; // DOCK_BOTTOM matches #status-bar's own height
// DOCK_TOP alone only covers the fixed menubar+toolbar stack; the multi-
// project tab bar (project-tabs.js) adds its own header row ABOVE the
// workspace whenever it's showing (body.has-tabs; see #pt-tabbar/#workspace
// in editor.html), and every docked/floating panel needs to start below
// that too, or its header (with the move/dock/float/close controls) ends up
// positioned right under the tab strip instead of visible above the canvas.
// Measured from the real element rather than a second hardcoded constant so
// this can never drift out of sync with the CSS again.
function dockTopOffset(){
  const tb=document.getElementById('pt-tabbar');
  return DOCK_TOP + ((tb && !tb.classList.contains('hidden')) ? tb.offsetHeight : 0);
}
const DOCK_DEFAULT = {
  chars:{ mode:'right', collapsed:false, open:false, x:140, y:130, w:360, order:0, locked:false, col:0 },
  vars: { mode:'right', collapsed:false, open:false, x:180, y:170, w:360, order:1, locked:false, col:0 },
  scenes:{ mode:'right', collapsed:false, open:false, x:220, y:210, w:360, order:2, locked:false, col:0 },
  props: { mode:'right', collapsed:false, open:true,  x:260, y:250, w:360, order:-1, locked:false, col:0 },
  assets:{ mode:'right', collapsed:false, open:false, x:300, y:290, w:360, order:3, locked:false, col:0 },
};
// #211: how many columns of stacked panels a single side can hold at once -
// matches AUTO_DOCK_CAP's own "2 feels right for 5 panels total" judgment;
// ⇄ cycles a docked panel through 0..DOCK_MAX_COLS-1.
const DOCK_MAX_COLS = 2;
const DOCK_META = {
  chars:{ title:'👥 Characters', add:'addCharacter', addLabel:'+ character', list:'char-list', render:'renderCharList' },
  vars: { title:'🎚 Variables',  add:'addVariable',  addLabel:'+ variable',  list:'var-list',  render:'renderVarList' },
  scenes:{ title:'🎬 Scenes', add:'addSceneAtView', addLabel:'+ scene', list:'scene-list', render:'renderScenesPanel' },
  props: { title:'⚙ Properties', add:'', addLabel:'', list:'props-list', render:'renderPropsPanel' },
  assets:{ title:'🗂 Assets', add:'', addLabel:'', list:'assets-list', render:'renderAssetsPanel' },
};

function dockState(id){ try{ return Object.assign({}, DOCK_DEFAULT[id], JSON.parse(ToolSettings.get('panel_'+id,'{}'))); }
  catch(e){ return Object.assign({}, DOCK_DEFAULT[id]); } }
function dockSave(id,st){ ToolSettings.set('panel_'+id, JSON.stringify(st)); }

function buildDockPanels(){
  let host=document.getElementById('dock-host');
  if(!host){ host=document.createElement('div'); host.id='dock-host'; document.body.appendChild(host); }
  host.innerHTML = Object.keys(DOCK_META).map(id=>{
    const m=DOCK_META[id];
    return `<div class="dock-panel" id="panel-${id}"><div class="dock-wrz" onmousedown="dockResizeStart(event,'${id}')" title="Drag to resize width"></div>
      <div class="dock-hrz" onmousedown="dockResizeVStart(event,'${id}')" ondblclick="dockResetHeight(event,'${id}')" title="Drag to resize height; double-click to reset to auto"></div>
      <div class="dock-head" onmousedown="dockDragStart(event,'${id}')" ondblclick="if(!(event.target.closest&&event.target.closest('.dock-ic')))dockCollapse('${id}')" title="Double-click to collapse / expand">
        <span class="dock-title">${m.title}</span>
        <span class="dock-tools">
          ${typeof panelHelpIcon==='function'?panelHelpIcon(id):''}
          ${typeof detachIconHtml==='function'?detachIconHtml('panel-'+id, m.title, 'dock-ic'):''}
          <span class="dock-ic" title="Move up"    onmousedown="event.stopPropagation()" onclick="dockMove('${id}',-1)">▲</span>
          <span class="dock-ic" title="Move down"  onmousedown="event.stopPropagation()" onclick="dockMove('${id}',1)">▼</span>
          <span class="dock-ic" title="Dock left"  onmousedown="event.stopPropagation()" onclick="dockSet('${id}','left')">⇤</span>
          <span class="dock-ic" title="Float (always on top)" onmousedown="event.stopPropagation()" onclick="dockSet('${id}','float')">◳</span>
          <span class="dock-ic" title="Dock right" onmousedown="event.stopPropagation()" onclick="dockSet('${id}','right')">⇥</span>
          <span class="dock-ic" title="Move to this side's other column" onmousedown="event.stopPropagation()" onclick="dockToggleColumn('${id}')">⇄</span>
          <span class="dock-ic dock-lock" title="Lock position" onmousedown="event.stopPropagation()" onclick="dockToggleLock('${id}')">🔒</span>
          <span class="dock-ic dock-collapse" title="Collapse / expand" onmousedown="event.stopPropagation()" onclick="dockCollapse('${id}')">▾</span>
          <span class="dock-ic" title="Close"      onmousedown="event.stopPropagation()" onclick="dockClose('${id}')">✕</span>
        </span>
      </div>
      <div class="dock-body"${id==='assets'?` ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropToLibrary(event)" title="Drop a file here to add it to the library"`:''}><div id="${m.list}"></div>
        ${m.add?`<button class="mini-btn" style="margin-top:8px" onclick="${m.add}()" title="Add a new ${id==='chars'?'character':'variable'}">${m.addLabel}</button>`:''}</div>
    </div>`;
  }).join('');
  if(typeof uniformDockWidth==='function') uniformDockWidth();
  // A real report: every launch reopened whatever panels happened to be
  // left open last time, piling up alongside the canvas and feeling
  // crowded/overwhelming before anything's even been clicked. Whether a
  // panel is OPEN no longer persists across a fresh app launch (this only
  // runs once, on the real 'load' event below, never on a mid-session New/
  // Open project) - it resets to DOCK_META's own quiet default (nothing but
  // Properties) every time. Everything else about a panel (its dock side,
  // position, width, lock state) still persists exactly as before; this is
  // only about which panels START open.
  Object.keys(DOCK_META).forEach(id=>{
    const st=dockState(id);
    if(st.open!==DOCK_DEFAULT[id].open){ st.open=DOCK_DEFAULT[id].open; dockSave(id,st); }
  });
  Object.keys(DOCK_META).forEach(applyDock);
  layoutDocks();
}
// A single action to close every currently open panel at once - for when
// several have piled up mid-session (the boot-time reset above only ever
// covers a fresh launch, not a session that's grown crowded since). Docked
// AND floating panels alike; a no-op (no toast) when nothing is open.
function dockCloseAll(){
  let any=false;
  Object.keys(DOCK_META).forEach(id=>{ const st=dockState(id); if(st.open){ st.open=false; dockSave(id,st); any=true; } });
  if(!any) return;
  Object.keys(DOCK_META).forEach(applyDock);
  if(typeof buildMenubar==='function') buildMenubar();   // keep the View menu's own panel checkmarks in sync
  if(typeof toast==='function') toast('All panels closed');
}

/* stack every open, docked panel on each side; no overlap, collapse-aware.
   #211: each side can hold more than one COLUMN (grouped by dockState().col),
   columns placed side by side growing inward from that side's own edge, each
   stacking its own panels vertically exactly as a single column always did.
   #212: a panel with a manually-set height (st.h, from dragging its own
   bottom-edge handle) keeps that height instead of being force-split evenly;
   only the OTHER, still-auto panels in that same column share whatever
   vertical space is left, so a resized column can end up not filling the
   full side, that's an accepted tradeoff, not a bug to fix here. */
function layoutDocks(){
  if(typeof uniformDockWidth==='function') uniformDockWidth();
  ['left','right'].forEach(side=>{
    const sideIds=Object.keys(DOCK_META).filter(id=>dockState(id).mode===side);
    // A panel that's closed but whose display was never (re-)synced to that
    // (e.g. its open state changed from elsewhere without a matching
    // applyDock() call reaching it, such as a settings value that arrives
    // after this panel's own initial render) would otherwise sit at its old
    // full-height position, visually burying whatever IS open beside it.
    // Since this pass already knows the real open/closed side-by-side truth,
    // it can self-heal that regardless of how it drifted.
    sideIds.filter(id=>!dockState(id).open).forEach(id=>{ const el=document.getElementById('panel-'+id); if(el) el.style.display='none'; });
    const openIds=sideIds.filter(id=>dockState(id).open);
    if(!openIds.length) return;
    // Leave room for the bottom status bar (its own default CSS already
    // reserves this via bottom:26px, but that gets overridden with an
    // explicit height below whenever panels are actively stacked here -
    // without subtracting it too, a stacked panel's last ~26px sat behind
    // the status bar instead of ending above it).
    const barOn=document.body.classList.contains('sb-on');
    const top=dockTopOffset();
    const H=Math.max(240,(window.innerHeight||800)-top-(barOn?DOCK_BOTTOM:0));
    const cols={};
    openIds.forEach(id=>{ const c=Math.min(DOCK_MAX_COLS-1,Math.max(0,dockState(id).col||0)); (cols[c]=cols[c]||[]).push(id); });
    let inset=0; // px inward from this side's own edge, grows with each column
    Object.keys(cols).map(Number).sort((a,b)=>a-b).forEach(colIdx=>{
      const ids=cols[colIdx].sort((a,b)=>dockState(a).order-dockState(b).order);
      const collapsed=ids.filter(id=>dockState(id).collapsed);
      const manual=ids.filter(id=>!dockState(id).collapsed && dockState(id).h);
      const auto=ids.filter(id=>!dockState(id).collapsed && !dockState(id).h);
      const manualH=manual.reduce((s,id)=>s+dockState(id).h,0);
      const remaining=Math.max(0,H-collapsed.length*DOCK_HEAD-manualH);
      const expH = auto.length ? Math.max(140,remaining/auto.length) : 0;
      let colW=0; ids.forEach(id=>{ colW=Math.max(colW, dockState(id).w||340); });
      let y=top;
      ids.forEach(id=>{ const st=dockState(id), el=document.getElementById('panel-'+id); if(!el) return;
        const h = st.collapsed ? DOCK_HEAD : (st.h || expH);
        el.style.top=y+'px'; el.style.height=h+'px'; el.style.bottom='auto'; el.style.width=(st.w||340)+'px';
        if(side==='right'){ el.style.right=inset+'px'; el.style.left='auto'; }
        else { el.style.left=inset+'px'; el.style.right='auto'; }
        y+=h; });
      inset+=colW;
    });
  });
}

function applyDock(id){
  const st=dockState(id), el=document.getElementById('panel-'+id); if(!el) return;
  el.className='dock-panel dock-'+st.mode+(st.collapsed?' collapsed':'')+(st.locked?' locked':'');
  el.style.display = st.open ? 'flex' : 'none';
  if(st.mode==='float'){
    // #62: re-clamp on every apply (not just live dragging) - catches a
    // position saved before this existed, or one that's only off-screen
    // NOW because the window got smaller since it was saved.
    if(_dockClampFloat(st)) dockSave(id,st);
    // #212: a manually-set height (st.h) sticks even while floating; '' lets
    // the panel size to its own content/CSS max-height as before.
    el.style.right='auto'; el.style.left=st.x+'px'; el.style.top=st.y+'px'; el.style.width=st.w+'px';
    el.style.height = st.collapsed ? 'auto' : (st.h ? st.h+'px' : '');
    el.style.bottom='auto';
  }
  else { el.style.left=''; el.style.right=''; el.style.width=st.w+'px'; /* top/height come from layoutDocks */ }
  const coll=el.querySelector('.dock-collapse'); if(coll) coll.textContent = st.collapsed ? '▸' : '▾';
  const lockIc=el.querySelector('.dock-lock');
  if(lockIc){ lockIc.textContent = st.locked ? '🔓' : '🔒'; lockIc.title = st.locked ? 'Unlock position' : 'Lock position'; lockIc.classList.toggle('is-locked', !!st.locked); }
  if(st.open){ const r=DOCK_META[id].render; if(typeof window[r]==='function') window[r](); }
  layoutDocks();
  // #122: keep the View menu's panel checkmarks in sync no matter how a
  // panel's open state changed (its own ✕/header, a toolbar button, or the
  // View menu itself), rather than only refreshing when toggled from there.
  if(typeof buildMenubar==='function') buildMenubar();
}
// #62: keep a floating panel's header always at least partly reachable on
// screen - a panel dragged (or resized-out-of-view by a shrinking window)
// past the edge would otherwise become permanently stuck with no way to
// grab it back. Returns true when it actually had to move the position.
function _dockClampFloat(st){
  const minVisible=60; // enough of the header stays on-screen to grab and drag back
  const top=dockTopOffset();
  const maxX=Math.max(0,(window.innerWidth||1024)-minVisible);
  const maxY=Math.max(top-52,(window.innerHeight||768)-minVisible);
  const x=Math.max(0,Math.min(st.x,maxX)), y=Math.max(top-52,Math.min(st.y,maxY));
  const changed = x!==st.x || y!==st.y;
  st.x=x; st.y=y;
  return changed;
}
function dockToggleLock(id){ const st=dockState(id); st.locked=!st.locked; dockSave(id,st); applyDock(id); }

// #1: a panel's dock side is remembered forever once it's ever been touched
// (opened, moved, resized, whatever) - dockSave() always writes the FULL
// merged state, so the raw saved JSON already carries a "mode" key from
// that point on. Its ABSENCE is therefore a reliable "this panel has never
// been opened before" signal, since nothing writes to a panel's storage
// before its first open.
function _dockEverTouched(id){
  try{ return Object.prototype.hasOwnProperty.call(JSON.parse(ToolSettings.get('panel_'+id,'{}')), 'mode'); }
  catch(e){ return false; }
}
// Auto-dock where there's room: right (default) first, then left, capping
// each side at 2 auto-docked panels at a time (2 counts as "full"); a panel
// opened once both sides are already full starts floating instead, rather
// than piling a 3rd deep onto either side. This cap only governs where a
// panel lands the FIRST time it's ever opened - manually docking via the
// ⇤/⇥ header icons has no cap, exactly as many as the user wants, stacked
// without overlap the same way layoutDocks() already stacks any side.
const AUTO_DOCK_CAP = 2;
function _autoDockSide(){
  const openCountOn = side => Object.keys(DOCK_META).filter(id=>{ const s=dockState(id); return s.open && s.mode===side; }).length;
  if(openCountOn('right') < AUTO_DOCK_CAP) return 'right';
  if(openCountOn('left') < AUTO_DOCK_CAP) return 'left';
  return 'float';
}
function openDock(id){ const st=dockState(id);
  if(!_dockEverTouched(id)) st.mode=_autoDockSide();
  st.open=true; st.collapsed=false; dockSave(id,st); applyDock(id); }
function dockClose(id){ const st=dockState(id); st.open=false; dockSave(id,st); applyDock(id); layoutDocks(); }
// #122: one call either way, for the View menu's panel toggles (and any
// other future surface) rather than each caller checking open state itself.
function dockToggleOpen(id){ if(dockState(id).open) dockClose(id); else openDock(id); }
function dockCollapse(id){ const st=dockState(id); st.collapsed=!st.collapsed; dockSave(id,st); applyDock(id); }
function dockSet(id,mode){ const st=dockState(id); st.mode=mode; st.open=true; st.col=0; dockSave(id,st); uniformDockWidth(); Object.keys(DOCK_META).forEach(applyDock); layoutDocks(); }
// #211: cycles a docked panel through this side's other column(s); a no-op
// while floating (columns are a docked-side-only concept).
function dockToggleColumn(id){ const st=dockState(id); if(st.mode==='float') return;
  st.col = ((st.col||0)+1) % DOCK_MAX_COLS; dockSave(id,st); uniformDockWidth(); applyDock(id); }
function dockMove(id,dir){ const st=dockState(id); if(st.mode==='float') return;
  const myCol=st.col||0;
  const ids=Object.keys(DOCK_META).filter(x=>{ const s=dockState(x); return s.open && s.mode===st.mode && (s.col||0)===myCol; }).sort((a,b)=>dockState(a).order-dockState(b).order);
  const i=ids.indexOf(id), j=i+dir; if(j<0||j>=ids.length) return;
  const a=dockState(id), b=dockState(ids[j]); const t=a.order; a.order=b.order; b.order=t; dockSave(id,a); dockSave(ids[j],b); layoutDocks(); }

/* ---- float dragging (snaps to grid when "snap panels" is on) ------------ */
// Dragging a DOCKED panel's header undocks it into a floating one, the same
// "grab and move it" gesture as an already-floating panel; the ◳ Float
// button is just a shortcut for the same result, not the only way to get
// there. A real drag (past a small threshold) is required before a docked
// panel actually undocks, so a plain click - notably the same header's own
// double-click-to-collapse - never floats it out from under the user.
let dockDrag=null;
function dockDragStart(e,id){
  const st=dockState(id); if(st.locked) return;   // #62: a locked panel doesn't drag at all
  const el=document.getElementById('panel-'+id); if(!el) return;
  e.preventDefault();
  dockDrag={ id, startX:e.clientX, startY:e.clientY, undocked:st.mode==='float', dx:0, dy:0 };
  if(st.mode==='float'){ dockDrag.dx=e.clientX-el.offsetLeft; dockDrag.dy=e.clientY-el.offsetTop; }
}
window.addEventListener('mousemove', e=>{
  if(!dockDrag) return;
  if(!dockDrag.undocked){
    if(Math.abs(e.clientX-dockDrag.startX)<6 && Math.abs(e.clientY-dockDrag.startY)<6) return;
    const id=dockDrag.id, st=dockState(id), el=document.getElementById('panel-'+id); if(!el) return;
    const r=el.getBoundingClientRect();
    st.mode='float'; st.x=r.left; st.y=r.top; dockSave(id,st); applyDock(id);
    dockDrag.undocked=true; dockDrag.dx=e.clientX-r.left; dockDrag.dy=e.clientY-r.top;
  }
  const st=dockState(dockDrag.id); let x=e.clientX-dockDrag.dx, y=e.clientY-dockDrag.dy;
  if(ToolSettings.get('snapPanels','0')==='1'){ x=Math.round(x/GRID_PANEL)*GRID_PANEL; y=Math.round(y/GRID_PANEL)*GRID_PANEL; }
  st.x=x; st.y=y; _dockClampFloat(st);   // #62: never let a live drag carry it off-screen either
  dockSave(dockDrag.id,st);
  const el=document.getElementById('panel-'+dockDrag.id); el.style.left=st.x+'px'; el.style.top=st.y+'px'; });
let dockWrz=null;
function dockResizeStart(e,id){ e.preventDefault(); e.stopPropagation(); const st=dockState(id); if(st.locked) return;   // #62
  const el=document.getElementById('panel-'+id); dockWrz={id,mode:st.mode,x0:e.clientX,w0:(el?el.offsetWidth:st.w||340)}; }
window.addEventListener('mousemove', e=>{ if(!dockWrz) return; const st=dockState(dockWrz.id);
  const dir = (dockWrz.mode==='right') ? -1 : 1;   // right-docked: dragging left widens
  let w = dockWrz.w0 + dir*(e.clientX-dockWrz.x0);
  w = Math.max(240, Math.min(640, w)); st.w=Math.round(w); dockSave(dockWrz.id,st);
  const el=document.getElementById('panel-'+dockWrz.id); if(el) el.style.width=st.w+'px'; });
window.addEventListener('mouseup', ()=>{ if(dockWrz){ if(dockWrz.mode!=='float' && typeof uniformDockWidth==='function'){} dockWrz=null; if(typeof layoutDocks==='function') layoutDocks(); } });
// #212: vertical resize, mirroring the width handle above but along the
// panel's own bottom edge; works the same whether the panel is floating or
// docked (docked, it just claims a manual height out of its column's
// otherwise-evenly-split space; see layoutDocks()).
let dockWrzV=null;
function dockResizeVStart(e,id){ e.preventDefault(); e.stopPropagation(); const st=dockState(id); if(st.locked) return;
  const el=document.getElementById('panel-'+id); dockWrzV={id,y0:e.clientY,h0:(el?el.offsetHeight:(st.h||220))}; }
window.addEventListener('mousemove', e=>{ if(!dockWrzV) return; const st=dockState(dockWrzV.id);
  let h = dockWrzV.h0 + (e.clientY-dockWrzV.y0);
  h = Math.max(120, Math.min((window.innerHeight||800)-100, h)); st.h=Math.round(h); dockSave(dockWrzV.id,st);
  if(st.mode==='float'){ const el=document.getElementById('panel-'+dockWrzV.id); if(el) el.style.height=st.h+'px'; }
  else if(typeof layoutDocks==='function') layoutDocks(); });
window.addEventListener('mouseup', ()=>{ dockWrzV=null; });
// double-click the height handle to drop the manual override and go back to
// auto-splitting the column's (or the float panel's own natural) height.
function dockResetHeight(e,id){ if(e){ e.preventDefault(); e.stopPropagation(); } const st=dockState(id); delete st.h; dockSave(id,st);
  if(st.mode==='float'){ const el=document.getElementById('panel-'+id); if(el) el.style.height=st.collapsed?'auto':''; }
  if(typeof layoutDocks==='function') layoutDocks(); }
// #3: a direct owner report ("docking modals is too aggressive; don't ask
// unless you basically 'slam' the modal into the sides") - re-enable in
// Settings -> Workspace.
function dockOfferOff(){ return (typeof ToolSettings!=='undefined') && ToolSettings.get('dockOfferOff','0')==='1'; }
function setDockOfferWarn(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('dockOfferOff', on?'0':'1'); }
window.addEventListener('mouseup', e=>{
  if(!dockDrag){ return; }
  const wasUndocked=dockDrag.undocked, id=dockDrag.id, st=dockState(id); dockDrag=null;
  if(!wasUndocked) return;   // a plain click (e.g. the header's dblclick-to-collapse) never floated anything - nothing to redock-prompt about
  if(dockOfferOff()) return;
  // dropped hard against a side edge? offer to dock there (#5). A real
  // report called the old 60px margin too easy to trigger by accident -
  // this now only fires once the panel is genuinely slammed into the very
  // edge of the window (10px), not just dragged generally toward that side.
  const el=document.getElementById('panel-'+id); const w=el?el.offsetWidth:st.w||340;
  const DOCK_OFFER_MARGIN=10;
  const nearLeft = st.x < DOCK_OFFER_MARGIN;
  const nearRight = (st.x + w) > (window.innerWidth - DOCK_OFFER_MARGIN);
  const side = nearLeft ? 'left' : (nearRight ? 'right' : null);
  if(side && typeof uiConfirm==='function'){
    uiConfirm(`Dock this panel to the <b>${side}</b> edge?`, ()=>{ dockSet(id, side); }, {yes:'Dock '+side, no:'Keep floating',
      checkbox:{ label:'Don’t ask again (re-enable in Settings → Workspace)',
                 onChecked:()=>{ setDockOfferWarn(false); } } });
  }
});
/* make every docked panel share the widest one's width WITHIN its own column
   (#5, extended by #211 - columns can legitimately differ in width from
   each other, only panels stacked in the SAME column need to line up). */
function uniformDockWidth(){
  ['left','right'].forEach(side=>{
    const ids=Object.keys(DOCK_META).filter(id=>{ const s=dockState(id); return s.open && s.mode===side; });
    const cols={};
    ids.forEach(id=>{ const c=Math.min(DOCK_MAX_COLS-1,Math.max(0,dockState(id).col||0)); (cols[c]=cols[c]||[]).push(id); });
    Object.values(cols).forEach(colIds=>{
      if(colIds.length<2) return;
      let maxW=0; colIds.forEach(id=>{ maxW=Math.max(maxW, dockState(id).w||340); });
      colIds.forEach(id=>{ const s=dockState(id); if(s.w!==maxW){ s.w=maxW; dockSave(id,s); } });
    });
  });
}
window.addEventListener('resize', layoutDocks);
// #62: a floating panel keeps its raw x/y regardless of window size, so a
// window that's since been shrunk (or a panel dragged near the edge before
// the window changed) could otherwise leave it stranded off-screen with no
// docked-side reflow to save it - re-clamp every open floating panel too.
window.addEventListener('resize', ()=>{ Object.keys(DOCK_META).forEach(id=>{ const st=dockState(id); if(st.mode==='float' && st.open) applyDock(id); }); });

function toggleSnapPanels(){ const on=ToolSettings.get('snapPanels','0')==='1'; ToolSettings.set('snapPanels', on?'0':'1');
  if(typeof buildMenubar==='function') buildMenubar(); toast('Panel snap '+(on?'off':'on')); }

window.addEventListener('load', buildDockPanels);

/* Re-render every open dock panel (e.g. after loading a project/sample so the
   Characters / Variables / Scenes lists reflect the new data). */
function refreshOpenDocks(){
  Object.keys(DOCK_META).forEach(id=>{ const st=dockState(id);
    if(st.open){ const r=DOCK_META[id].render; if(typeof window[r]==='function') window[r](); } });
}
