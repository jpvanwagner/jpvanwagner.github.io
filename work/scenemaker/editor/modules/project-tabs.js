/* ============================================================================
   Scenemaker editor; multi-project tabs  (#86)
   Lets several projects stay open at once in one tab bar, each with its own
   live project data, undo/redo history, zoom level and selection; the whole
   set of open tabs, and each one's in-progress (possibly unsaved) edits,
   persists in the browser's IndexedDB so a reload or relaunch restores the
   entire bar, not just whichever single project used to be the only one.

   Scope decided up front (see docs/eisenhower-matrix.md for the full callout):
   - Persistence is IndexedDB, not localStorage; a project's data URLs for
     embedded media can easily exceed localStorage's ~5-10MB quota, and there
     was no IndexedDB usage anywhere in the codebase to build on, so this is a
     new storage layer, isolated entirely to this file.
   - A tab's connection to a real on-disk file (_fsHandle, the File System
     Access API handle core.js's doSave()/doOpen() already use) is NOT
     persisted across a reload; browsers cannot silently reconnect a file
     handle without a fresh user gesture, so a restored tab only remembers
     its last-known filename for the tab's tooltip. Save on a freshly
     restored tab behaves exactly like a brand-new unsaved project (falls
     back to the normal Save/Save As picker) until the user saves it again.
   - Only ONE set of live globals exists at a time (project/scenes/
     backdrops/zoomLevel/selectedNode/_undo/_redo/_dirty, all declared in
     core.js); switching tabs snapshots the outgoing tab's globals into its
     own record and then hands the incoming tab's saved project to the very
     same loadProject() every New/Open/Recent flow already uses. That means
     a tab's exact scroll/pan position isn't replayed pixel for pixel on
     switch or reload; it re-centers on that project's own last-edited
     scene, same as opening any project already does (#2/#9). Undo/redo
     history and zoom level ARE restored exactly, since those are cheap,
     already-serializable values.
   - "New" and "Open" (menu, toolbar, Ctrl+N/O, a Recent-projects click)
     always open into a fresh tab rather than replacing the current one;
     that is the entire point of tabs existing.
   Shares core.js scope.
   ==========================================================================*/
const PT_DB_NAME='scenemaker-tabs-db', PT_DB_VERSION=1, PT_STORE='tabs', PT_META_KEY='__meta';
function ptHasIndexedDb(){ return typeof indexedDB!=='undefined'; }
let _ptDb=null;
function ptOpenDb(){
  return new Promise(resolve=>{
    if(!ptHasIndexedDb()){ resolve(null); return; }
    try{
      const req=indexedDB.open(PT_DB_NAME, PT_DB_VERSION);
      req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains(PT_STORE)) db.createObjectStore(PT_STORE,{keyPath:'id'}); };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>resolve(null);
    }catch(e){ resolve(null); }
  });
}
function ptStore(mode){ return _ptDb ? _ptDb.transaction(PT_STORE, mode).objectStore(PT_STORE) : null; }
function ptGetAll(){ return new Promise(resolve=>{ const s=ptStore('readonly'); if(!s){ resolve([]); return; } try{ const r=s.getAll(); r.onsuccess=()=>resolve(r.result||[]); r.onerror=()=>resolve([]); }catch(e){ resolve([]); } }); }
function ptPut(rec){ return new Promise(resolve=>{ const s=ptStore('readwrite'); if(!s){ resolve(); return; } try{ const r=s.put(rec); r.onsuccess=()=>resolve(); r.onerror=()=>resolve(); }catch(e){ resolve(); } }); }
function ptDel(id){ return new Promise(resolve=>{ const s=ptStore('readwrite'); if(!s){ resolve(); return; } try{ const r=s.delete(id); r.onsuccess=()=>resolve(); r.onerror=()=>resolve(); }catch(e){ resolve(); } }); }

let ProjectTabs = {
  order: [],          // tab ids, display order
  activeId: null,
  records: {},        // id -> {id,name,dirty,fileName,project,zoomLevel,selectedNode,undo,redo,updatedAt}
  ready: false,
  _saveTimer: null,

  /* Restores any tabs persisted from a previous session. Resolves true if it
     restored something (caller should skip the normal start screen), false
     if there was nothing saved (caller proceeds exactly as before tabs
     existed at all). The sample story tour (tutorial.js's startFullTutorial())
     opens into an ordinary tab through this same store now, same as any
     other New/Open flow - it used to be a genuinely separate scratch browser
     tab that never touched this store at all, before #86 existed. */
  async init(){
    _ptDb = await ptOpenDb();
    this.ready = true;
    const rows = await ptGetAll();
    const meta = rows.find(r=>r.id===PT_META_KEY) || {order:[],activeId:null};
    const recs = rows.filter(r=>r.id!==PT_META_KEY);
    if(!recs.length) return false;
    recs.forEach(r=>{ this.records[r.id]=r; });
    this.order = (meta.order||[]).filter(id=>this.records[id]);
    Object.keys(this.records).forEach(id=>{ if(this.order.indexOf(id)<0) this.order.push(id); });
    if(!this.order.length) return false;
    const activeId = (meta.activeId && this.records[meta.activeId]) ? meta.activeId : this.order[0];
    this._enter(activeId);
    this.render();
    if(typeof checkOpenOverlapSoon==='function') checkOpenOverlapSoon(); // restoring tabs from a previous session is itself an "open"
    return true;
  },

  /* Call right before doing whatever a New/Open/Recent flow does to set up
     project data (usually a loadProject(...) call). Snapshots the outgoing
     tab, then stakes out a fresh blank tab so that upcoming loadProject()
     lands in a NEW tab instead of overwriting the one already open. */
  beginNewTab(){
    if(!this.ready) return;
    if(this.activeId) this._snapshotInto(this.activeId);
    const id=genId('tab');
    this.order.push(id);
    this.records[id]={id,name:'Untitled Story',project:null,zoomLevel:1,selectedNode:null,undo:[],redo:[],dirty:false,fileName:null,updatedAt:Date.now()};
    this.activeId=id;
  },
  /* Call right after that loadProject(...) (and any _fsHandle assignment)
     finishes, to capture the freshly-loaded project into the tab just
     staked out by beginNewTab(), then persist and redraw the bar. */
  finishNewTab(){
    if(!this.ready || !this.activeId) return;
    this._snapshotInto(this.activeId);
    this.render();
    this.persist();
  },

  _snapshotInto(id){
    const rec=this.records[id] || {id};
    rec.name=(project.meta && project.meta.title) || 'Untitled Story';
    rec.project=project;
    rec.zoomLevel=zoomLevel;
    rec.selectedNode=selectedNode;
    rec.undo=(typeof _undo!=='undefined')?_undo:[];
    rec.redo=(typeof _redo!=='undefined')?_redo:[];
    rec.dirty=(typeof _dirty!=='undefined')?!!_dirty:false;
    rec.fileName=(typeof _fsHandle!=='undefined' && _fsHandle && _fsHandle.name) || rec.fileName || null;
    rec.updatedAt=Date.now();
    this.records[id]=rec;
    return rec;
  },

  _enter(id){
    const rec=this.records[id]; if(!rec) return;
    loadProject(JSON.parse(JSON.stringify(rec.project)));
    if(Array.isArray(rec.undo)) _undo=rec.undo.slice();
    if(Array.isArray(rec.redo)) _redo=rec.redo.slice();
    _dirty=!!rec.dirty;
    if(typeof rec.zoomLevel==='number'){ zoomLevel=rec.zoomLevel; if(typeof applyZoom==='function') applyZoom(); }
    if(rec.selectedNode && scenes[rec.selectedNode] && typeof setSelectedNode==='function') setSelectedNode(rec.selectedNode);
    if(typeof updateUndoButtons==='function') updateUndoButtons();
    this.activeId=id;
  },

  /* Explicit "+"; always a brand new blank project, never a clone of the
     tab it was opened from. */
  newTab(){
    if(!this.ready) return;
    this.beginNewTab();
    if(typeof disconnectSavedFile==='function') disconnectSavedFile();
    loadProject(blankProject(), true);
    addScene(360,160);
    this.finishNewTab();
  },

  switchTo(id){
    if(!this.ready || id===this.activeId) return;
    if(this.activeId) this._snapshotInto(this.activeId);
    this._enter(id);
    this.render();
    this.persist();
  },

  closeTab(id){
    const rec=this.records[id]; if(!rec) return;
    const isActive = id===this.activeId;
    const dirty = isActive ? !!_dirty : !!rec.dirty;
    const doClose=()=>{
      const idx=this.order.indexOf(id);
      if(idx<0) return;
      this.order.splice(idx,1);
      delete this.records[id];
      ptDel(id);
      if(isActive){
        if(this.order.length){
          this._enter(this.order[Math.max(0,idx-1)]);
        } else {
          this.activeId=null;
          if(typeof disconnectSavedFile==='function') disconnectSavedFile();
          loadProject(blankProject(), true);
          addScene(360,160);
          this._adoptCurrentAsNewTab(); // stake a fresh tab out so the bar never goes empty
        }
      }
      this.render();
      this.persist();
    };
    // A tab that's dirty but not the one on screen has no live _dirty flag
    // to check visually right now, so its own last-saved dirty bit is used.
    if(dirty && typeof uiConfirm==='function'){
      uiConfirm('Close "'+(rec.name||'this tab')+'"? Unsaved changes in this tab will be lost.', doClose, { yes:'Close tab', no:'Keep it open' });
    } else doClose();
  },

  // Used only by closeTab() when the very last tab is closed, to reopen a
  // fresh blank tab rather than leaving the bar (and the app) with nothing.
  _adoptCurrentAsNewTab(){
    const id=genId('tab');
    this.order.push(id);
    this.activeId=id;
    this._snapshotInto(id);
  },

  /* Debounced write-behind so in-progress edits survive an unplanned reload
     without hammering IndexedDB on every keystroke; also flushed immediately
     on tab switch/close/new and on page unload. */
  markDirtySoon(){
    if(!this.ready || !this.activeId) return;
    clearTimeout(this._saveTimer);
    this._saveTimer=setTimeout(()=>this.persist(), 2000);
  },

  async persist(){
    if(!_ptDb || !this.ready) return;
    // every background tab's record was already updated in memory the
    // moment it stopped being active (see _snapshotInto() calls throughout
    // beginNewTab()/switchTo()/closeTab()); writing only the active tab
    // here would silently drop those other tabs' latest edits/titles from
    // IndexedDB the next time THIS tab happens to be the one that saves.
    if(this.activeId) this._snapshotInto(this.activeId);
    await ptPut({id:PT_META_KEY, order:this.order, activeId:this.activeId});
    await Promise.all(this.order.map(id=>this.records[id] ? ptPut(this.records[id]) : Promise.resolve()));
  },

  render(){
    const bar=document.getElementById('pt-tabbar'); if(!bar) return;
    // The bar itself only earns its header-row space once there's actually
    // something to switch between; a single open project (the common case)
    // shows no tab strip at all, same as before tabs existed.
    if(!this.ready || this.order.length<2){
      bar.innerHTML=''; bar.classList.add('hidden'); document.body.classList.remove('has-tabs');
      this._syncDockOffsets();
      return;
    }
    bar.classList.remove('hidden');
    document.body.classList.add('has-tabs');
    bar.innerHTML = this.order.map(id=>{
      const rec=this.records[id]; if(!rec) return '';
      const active=id===this.activeId;
      const nm = active ? ((project.meta&&project.meta.title)||'Untitled Story') : (rec.name||'Untitled Story');
      const dirty = active ? !!_dirty : !!rec.dirty;
      const fileHint = rec.fileName ? (', '+rec.fileName) : '';
      return `<span class="pt-tab${active?' active':''}" title="${escAttr(nm+fileHint)}" onclick="ProjectTabs.switchTo('${id}')">
          <span class="pt-tab-dot" style="visibility:${dirty?'visible':'hidden'}" title="Unsaved changes">●</span>
          <span class="pt-tab-name">${escHtml(nm)}</span>
          <span class="pt-tab-close" title="Close tab" onclick="event.stopPropagation(); ProjectTabs.closeTab('${id}')">×</span>
        </span>`;
    }).join('') + `<span class="pt-tab-new" title="Open a new project tab" onclick="ProjectTabs.newTab()">+</span>`;
    this._syncDockOffsets();
  },

  // The tab bar showing/hiding changes how much header space is taken up
  // (see body.has-tabs #workspace in editor.html), which the dockable side
  // panels (Characters/Variables/Scenes/Properties/Assets) need to know
  // about too, the same way they already react to a window resize -
  // otherwise a panel's header (with its move/dock/float/close controls)
  // ends up positioned right where the tab bar now sits, hidden underneath
  // it instead of visible above the workspace.
  _syncDockOffsets(){
    if(typeof layoutDocks==='function') layoutDocks();
    if(typeof DOCK_META!=='undefined' && typeof applyDock==='function'){
      Object.keys(DOCK_META).forEach(id=>{ const st=dockState(id); if(st.mode==='float' && st.open) applyDock(id); });
    }
  }
};
// IndexedDB writes queued by markDirtySoon()'s 2s debounce can still be
// pending when a tab is closed or reloaded; flushing immediately the moment
// the page is hidden (switching away, closing, refreshing) catches those
// without waiting out the debounce, so the very latest edits survive.
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && typeof ProjectTabs!=='undefined' && ProjectTabs.ready) ProjectTabs.persist();
});
