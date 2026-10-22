/* ============================================================================
   Scenemaker editor; opening / start screen  (feature #2)
   Shown on launch: create a new project (standard, or straight into the canvas
   editor), open the built-in sample story, open a .vnproj file, or pick a
   recent project. Recents are saved server-side (see app.py /__recents).
   Shares core.js scope.
   ==========================================================================*/
/* Small minimap of the scene graph (not the actual art), used as a "which
   story is this" thumbnail on the start screen's recent-projects list. Drawn
   straight onto a <canvas> from scene/group x/y/w/h - deliberately NOT the
   fragile foreignObject/DOM-clone technique exportCanvasImage() uses (that's
   fine for an occasional user-triggered PNG export, but this runs on every
   Save and needs to be fast and never silently fail). */
function _canvasThumbDataUrl(){
  try{
    var W=160, H=100;
    var c=document.createElement('canvas'); c.width=W; c.height=H;
    var cx=c.getContext('2d');
    // reads the CURRENT theme's own colours at draw time (not a hardcoded
    // fuchsia/midnight guess) so a saved project's thumbnail always matches
    // whichever theme made it, present or future.
    var rootStyle=getComputedStyle(document.documentElement);
    var wsColor=(rootStyle.getPropertyValue('--workspace')||'#0f172a').trim();
    var accentColor=(rootStyle.getPropertyValue('--accent')||'#c026d3').trim();
    var accent2Color=(rootStyle.getPropertyValue('--accent2')||'#a21caf').trim();
    cx.fillStyle=wsColor; cx.fillRect(0,0,W,H);
    var sceneList=Object.values(scenes||{});
    if(!sceneList.length) return c.toDataURL('image/png');
    var bw=function(n){ return n.w||420; }, bh=function(n){ return n.collapsed?40:(n.h||200); };
    var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
    sceneList.forEach(function(n){ minX=Math.min(minX,n.x); minY=Math.min(minY,n.y); maxX=Math.max(maxX,n.x+bw(n)); maxY=Math.max(maxY,n.y+bh(n)); });
    Object.values(backdrops||{}).forEach(function(b){ minX=Math.min(minX,b.x); minY=Math.min(minY,b.y); maxX=Math.max(maxX,b.x+(b.w||300)); maxY=Math.max(maxY,b.y+(b.h||200)); });
    var pad=20; minX-=pad; minY-=pad; maxX+=pad; maxY+=pad;
    var spanX=Math.max(1,maxX-minX), spanY=Math.max(1,maxY-minY);
    var scale=Math.min(W/spanX, H/spanY);
    var offX=(W-spanX*scale)/2, offY=(H-spanY*scale)/2;
    var tx=function(x){ return offX+(x-minX)*scale; }, ty=function(y){ return offY+(y-minY)*scale; };
    cx.fillStyle='rgba(99,102,241,.28)'; cx.strokeStyle='rgba(99,102,241,.6)'; cx.lineWidth=1;
    Object.values(backdrops||{}).forEach(function(b){
      var x=tx(b.x), y=ty(b.y), w=(b.w||300)*scale, h=(b.h||200)*scale;
      cx.fillRect(x,y,w,h); cx.strokeRect(x+.5,y+.5,w,h);
    });
    var startId=project.settings&&project.settings.startScene;
    sceneList.forEach(function(n){
      var x=tx(n.x), y=ty(n.y), w=Math.max(2,bw(n)*scale), h=Math.max(2,bh(n)*scale);
      cx.fillStyle = (n.id===startId) ? accentColor : accent2Color;
      cx.fillRect(x,y,w,h);
    });
    return c.toDataURL('image/png');
  }catch(e){ return ''; }
}
// #demo: /__recents only exists behind app.py (no native-mode bridge for it
// either - see app_native.py, which has none), so HAS_SERVER() false means
// there's genuinely nothing to reach: static hosting, or editor.html opened
// straight from disk. Recent-projects just silently stays empty there
// instead of a doomed-to-fail fetch() every time, same spirit as every
// other server-only feature's own HAS_SERVER() gate.
function recentSave(){
  if(typeof fetch!=='function' || !HAS_SERVER()) return;
  try{ const name=(project.meta&&project.meta.title)||'Untitled Story';
    const thumb=_canvasThumbDataUrl();
    fetch('/__recents',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name, project, thumb})}).catch(()=>{}); }catch(e){}
}
function recentList(){ if(typeof fetch!=='function' || !HAS_SERVER()) return Promise.resolve([]);
  return fetch('/__recents').then(r=>r.ok?r.json():[]).catch(()=>[]); }
function recentOpen(id){ if(typeof fetch!=='function' || !HAS_SERVER()) return;
  fetch('/__recent_get?id='+encodeURIComponent(id)).then(r=>r.json()).then(p=>{
    if(p && (p.scenes||p.meta)){
      if(typeof ProjectTabs!=='undefined' && ProjectTabs.ready) ProjectTabs.beginNewTab();
      loadProject(p); closeStartScreen(); toast('Opened '+((p.meta&&p.meta.title)||'project'));
      if(typeof ProjectTabs!=='undefined' && ProjectTabs.ready) ProjectTabs.finishNewTab();
      if(typeof checkOpenOverlapSoon==='function') checkOpenOverlapSoon();
    }
  }).catch(()=>toast('Could not open that project'));
}

// #171: small themed inline SVGs for the start screen (branching-nodes
// wordmark, and one icon per action) - currentColor throughout so each
// picks up its own chip's colour automatically, whatever the active theme;
// no new asset files, same technique already used for the scene-type icons
// (core.js's cutsceneIco/viewerIco).
const SS_ICO_BRAND=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="2.6"/><circle cx="19" cy="5" r="2.6"/><circle cx="19" cy="19" r="2.6"/><path d="M7.3 10.8 12 6h4.7M7.3 13.2 12 18h4.7"/></svg>`;
const SS_ICO_NEW=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13 3v6h6"/><path d="M12 12v6M9 15h6"/></svg>`;
const SS_ICO_OPEN=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
const SS_ICO_TOUR=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1v13c3-1 6-.5 8 1 2-1.5 5-2 8-1V5c-3-1-6-.5-8 1z"/><path d="M12 6v13"/></svg>`;
function ensureStartDom(){
  if(document.getElementById('start-screen')) return;
  const d=document.createElement('div'); d.id='start-screen'; d.className='start-screen';
  d.innerHTML=`<div class="ss-card">
      <div class="ss-brandwrap"><div class="ss-brandmark">${SS_ICO_BRAND}</div><div class="ss-brand">SCENEMAKER</div></div>
      <div class="ss-sub">Interactive scenario builder</div>
      <div class="ss-cols">
        <div class="ss-actions">
          <button class="ss-btn ss-primary" onclick="startNewProject(ssDesignChecked())">
            <span class="ss-btn-ico">${SS_ICO_NEW}</span>
            <span class="ss-btn-body"><b>New project</b><span class="ss-btn-desc">Blank story with standard defaults</span>
              <label class="chk ss-design-chk" onclick="event.stopPropagation()" title="Start by opening the Canvas editor to design the screen, instead of landing on the empty node graph"><input type="checkbox" id="ss-design-screen" onclick="event.stopPropagation()"> Design the screen first</label>
            </span>
          </button>
          <button class="ss-btn" onclick="startOpenFile()">
            <span class="ss-btn-ico">${SS_ICO_OPEN}</span>
            <span class="ss-btn-body"><b>Open a file&hellip;</b><span class="ss-btn-desc">Load a .vnproj you saved</span></span>
          </button>
        </div>
        <div class="ss-recent">
          <div class="ss-recent-h">Recent projects</div>
          <div id="ss-recent-list" class="ss-recent-list"><div class="hint">Loading…</div></div>
        </div>
      </div>
      <div class="ss-foot">
        <button class="mini-btn ss-tour-btn" onclick="closeStartScreen(); startFullTutorial();" title="Load “The Whistleblower” and take the in-depth, feature-by-feature Sample story tour">${SS_ICO_TOUR} Sample story tour</button>
      </div>
    </div>
    <div class="ss-credit">© 2006- Brickroad</div>`;
  document.body.appendChild(d);
}
function showStartScreen(){
  ensureStartDom();
  document.getElementById('start-screen').style.display='flex';
  const box=document.getElementById('ss-recent-list');
  recentList().then(items=>{
    if(!items.length){ box.innerHTML='<div class="hint">No recent projects yet. They\u2019ll appear here once you save or open one.</div>'; return; }
    box.innerHTML=items.map(it=>`<button class="ss-recent-item" onclick="recentOpen('${it.id}')">${it.thumb?`<img class="ss-recent-thumb" src="${it.thumb}" alt="">`:'<span class="ss-recent-thumb ss-recent-thumb-blank"></span>'}<span class="ss-recent-info"><b>${escHtml(it.name)}</b><span>${_ssWhen(it.ts)}</span></span></button>`).join('');
  });
  maybeOfferSampleTour();
}
// #143: the very first time someone opens THIS version of Scenemaker
// (never asked before, or since the last version bump - tutorialVersionCheck()
// resets this the same way it resets every other first-run flag), OFFER the
// guided sample story tour via the app's own themed confirm instead of
// silently starting anything; answered either way, it never asks again until
// the next version bump. Respects the existing "tutorials off" toggle.
function maybeOfferSampleTour(){
  if(typeof ToolSettings==='undefined') return;
  if(typeof tutorialOff==='function' && tutorialOff()) return;
  if(ToolSettings.get('sampleOfferSeen','0')==='1') return;
  ToolSettings.set('sampleOfferSeen','1');
  setTimeout(()=>{
    if(typeof uiConfirm!=='function') return;
    uiConfirm(
      'Welcome to Scenemaker! Want a quick guided tour through a sample story (about 10 minutes), or would you rather dive in on your own?',
      ()=>{
        // A real, reproducible soft-lock: the start screen (#start-screen,
        // z-index 800) was never closed here, so it sat ON TOP of the full
        // tutorial's own popup/spotlight (z-index 601/600) - visible and
        // "active" in memory, but every click (including the tutorial's own
        // Skip/Turn off buttons) landed on the start screen instead and was
        // swallowed, with no way out short of reloading the page.
        closeStartScreen();
        if(typeof startFullTutorial==='function') startFullTutorial();
      },
      { yes:'Show me the tour', no:'I\u2019ll explore myself' }
    );
  }, 350);
}
function _ssWhen(ts){ if(!ts) return ''; const d=new Date(ts); return d.toLocaleDateString()+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
function closeStartScreen(){ const s=document.getElementById('start-screen'); if(s) s.style.display='none'; }

function ssDesignChecked(){ const el=document.getElementById('ss-design-screen'); return !!(el && el.checked); }
function startNewProject(withCanvas){
  if(typeof ProjectTabs!=='undefined' && ProjectTabs.ready) ProjectTabs.beginNewTab();
  if(typeof disconnectSavedFile==='function') disconnectSavedFile();
  loadProject(blankProject(), true); addScene(360,160);
  if(typeof ProjectTabs!=='undefined' && ProjectTabs.ready) ProjectTabs.finishNewTab();
  closeStartScreen();
  if(withCanvas && typeof openCanvasEditor==='function') openCanvasEditor('project');
  else toast('New story; press ⚙️ SETTINGS to name it');
}
function startOpenFile(){ closeStartScreen(); if(typeof doOpen==="function") doOpen(); }
