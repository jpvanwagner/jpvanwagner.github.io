/* ============================================================================
   Scenemaker editor; interactive tutorial  (feature #4)
   Small anchored popups + a spotlight that guide the user through making a first
   scene, using features, and connecting scenes. It's *responsive*: each step
   watches for you to actually do the thing (via a done() check polled a few times
   a second) and moves on when you do; so it stays out of the way and reacts to
   your progress instead of lecturing up front. Controls: Prev / Next / Show me /
   Skip (dismiss for now) / Turn off tutorials. Re-enable under ⚙️ Settings or
   Help ▸ Restart tutorial. "Off" is remembered per-computer (ToolSettings).

   To EDIT the walkthrough, change TUTORIAL_STEPS below; each step is:
     { sel:'#css-target' | ()=>element,  title, body(HTML),  done:()=>boolean }
   ==========================================================================*/
const TUTORIAL_STEPS = [
  { sel:'#tb-scene', title:'Start with a scene',
    body:'Every story is a set of <b>scenes</b>. Click <b>+ SCENE</b> to drop another one on the board.',
    done:()=>Object.keys(scenes).length>=2 },
  { sel:()=>document.querySelector('.node .dialogue-line'), title:'Write a line',
    body:'Each scene holds dialogue lines. <b>Click a line</b> on a card to edit its text (and more) in the <b>Properties</b> panel on the right; press <b>+ line</b> for more.',
    done:()=>Object.values(scenes).some(s=>(s.lines||[]).some(l=>(l.text||'').trim().length>0)) },
  { sel:()=>document.getElementById('panel-props')||document.getElementById('props-list'), title:'The Properties panel',
    body:'The <b>Properties</b> panel (right side) edits whatever you select: a line, an on-stage face, a choice, or the scene itself, so the cards stay tidy.',
    // A real report: this step only ever pointed AT the panel, it never
    // actually opened it - if a returning user had closed it (or restarted
    // the tutorial with a different dock layout than a brand-new project's
    // own default), the panel it's meant to show off was sitting there
    // display:none the whole time, so the step highlighted nothing at all.
    // openDock() is a no-op if it's already open, so this is safe to call
    // on every entry into this step regardless of prior state.
    enter:()=>{ if(typeof openDock==='function') openDock('props'); },
    done:()=>false },
  { sel:()=>document.querySelector('.node .choices-container .mini-btn')||document.querySelector('.node'), title:'Offer a choice',
    body:'Give the reader a decision. Press <b>+ Choice</b> on a scene, then click its <b>\u2699 options</b> to set effects, conditions and variable branches in Properties.',
    done:()=>Object.values(scenes).some(s=>(s.choices||[]).length>0) },
  { sel:()=>document.querySelector('.port.out')||document.querySelector('.node'), title:'Connect scenes',
    body:'Drag from a choice\u2019s <b>dot</b> onto another scene to wire them together. That link is the branch the choice leads to.',
    done:()=>Object.values(scenes).some(s=>(s.choices||[]).some(c=>(c.outcomes||[]).some(o=>o.targetNode))) },
  { sel:'#tb-chars', title:'Characters, variables & assets',
    body:'The right-side panels hold your <b>Characters</b> (portraits, sounds, face states), <b>Variables</b> (the story\u2019s memory), <b>Scenes</b> (jump around), and <b>Assets</b> (every image/sound/video).',
    done:()=>false },
  { sel:()=>document.querySelector('.tb-btn[onclick*="openCanvasEditor"]')||document.querySelector('.ui-bar'), title:'Design the screen',
    body:'<b>CANVAS</b> opens a full-window editor where you drag the dialogue box, choices and portraits to lay out how the game looks, with templates and animations.',
    done:()=>false },
  { sel:'#tb-preview', title:'Preview anytime',
    body:'Press <b>PREVIEW</b> to play your story in a window exactly as learners will see it.',
    done:()=>false },
  { sel:'#tb-export', title:'Export when ready',
    body:'<b>EXPORT</b> opens your options: a <b>SCORM</b> package for your LMS, a <b>PNG of the stage</b>, or a <b>printable script</b>. That\u2019s it, you\u2019re set!',
    done:()=>false, last:true },
];

let _tutIdx=0, _tutTimer=null, _tutActive=false, _tutArmed=false, _tutSteps=TUTORIAL_STEPS, _tutReadonly=false, _tutCurEl=null;
// The in-UI project tab (project-tabs.js, #86) the sample story tour was
// opened into, if any - see startFullTutorial()'s own header comment below.
let _tutSampleTabId=null;

function tutDone(step){ try{ return !!(step && step.done && step.done()); }catch(e){ return false; } }
function tutorialOff(){ return ToolSettings.get('tutorialOff','0')==='1'; }
function ensureTutorialDom(){
  if(document.getElementById('tut-pop')) return;
  const veil=document.createElement('div'); veil.id='tut-veil';
  veil.style.cssText='position:fixed;inset:0;z-index:588;background:rgba(0,0,0,.42);pointer-events:none;display:none';
  const spot=document.createElement('div'); spot.id='tut-spot';
  spot.style.cssText='position:fixed;z-index:600;border:2px solid var(--accent);border-radius:8px;box-shadow:0 0 0 4000px rgba(0,0,0,.45);pointer-events:none;transition:all .18s ease;display:none';
  const pop=document.createElement('div'); pop.id='tut-pop';
  pop.style.cssText='position:fixed;z-index:601;width:280px;max-width:90vw;background:var(--bar);border:1px solid var(--accent);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.5);padding:12px 14px;display:none;font-family:system-ui,sans-serif';
  document.body.appendChild(veil); document.body.appendChild(spot); document.body.appendChild(pop);
}
function tutTarget(step){ try{ return typeof step.sel==='function' ? step.sel() : document.querySelector(step.sel); }catch(e){ return null; } }

function renderTutStep(){
  ensureTutorialDom();
  const step=_tutSteps[_tutIdx]; if(!step) return endTutorial(false);
  // Optional one-shot setup a step runs the moment it's shown - lets a
  // (readonly) tour actually DEMONSTRATE an action (e.g. collapsing a scene
  // card) instead of only describing it, since _tutReadonly blocks the
  // learner's own clicks on the real app during the full tutorial.
  if(step.enter){ try{ step.enter(); }catch(e){} }
  // A step auto-advances only if its goal was NOT already met when shown. (#4 bug fix)
  _tutArmed = !tutDone(step);
  const pop=document.getElementById('tut-pop');
  const n=_tutSteps.length;
  pop.style.display='block';
  pop.innerHTML=
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
       <div style="font-weight:800;font-size:13px;color:var(--accent)">${escHtml(step.title)}</div>
       <div class="hint" style="font-size:11px">${_tutIdx+1}/${n}</div>
     </div>
     <div class="hint" style="font-size:13px;color:var(--ink);line-height:1.5;margin-bottom:10px">${step.body}</div>
     <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
       <button class="mini-btn" onclick="tutPrev()" ${_tutIdx===0?'disabled style=\"opacity:.4\"':''}>\u2039 Prev</button>
       <button class="mini-btn" onclick="tutShowMe()">Show me</button>
       <button class="mini-btn tb-accent" style="background:var(--accent);color:#fff;border:none" onclick="tutNext()">${step.last?'Done':'Next \u203A'}</button>
       <span style="flex:1"></span>
       ${_tutReadonly?'':'<button class="mini-btn" onclick="startFullTutorial()" title="Load the built-in sample story and take an in-depth, feature-by-feature tour of it (distinct from Help ▸ Replay all tutorials, which just restarts this quick tour on your own project)">Sample story tour</button>'}
       <button class="mini-btn" onclick="tutSkip()" title="Hide for now">Skip</button>
       <button class="mini-btn" onclick="tutTurnOff()" title="Don\u2019t show tutorials again">Turn off</button>
     </div>`;
  _tutCurEl = tutTarget(step);
  positionTut();
}
// Scroll the target into view, place spotlight + popup, then freeze the canvas so
// nothing drifts. Workspace is briefly un-frozen to allow the scroll-to.
function positionTut(){
  const ws=document.getElementById('workspace'); const el=_tutCurEl;
  const spot=document.getElementById('tut-spot');
  if(spot){ spot.style.borderColor='var(--accent)'; spot.style.borderWidth='2px'; }
  if(ws) ws.style.overflow='auto';
  if(el && el.scrollIntoView){ try{ el.scrollIntoView({block:'center',inline:'center'}); }catch(e){} }
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(_placeTutOverlay); else setTimeout(_placeTutOverlay,16);
}
// Re-measures and repositions the spotlight/popup against the CURRENT layout,
// without re-scrolling - called right after a step renders (via positionTut,
// above, which scrolls first) and again on a steady poll/window-resize so
// drift (a dock panel finishing its own async auto-placement, a resize, a
// dragged scene node) self-corrects instead of leaving the highlight box
// pointing at wherever the target used to be. Measures the popup's own
// actual rendered size instead of a guessed constant, and clamps both axes,
// so a step with a longer body never gets pushed off-screen and unclickable.
function _placeTutOverlay(){
  const spot=document.getElementById('tut-spot'), pop=document.getElementById('tut-pop'), veil=document.getElementById('tut-veil');
  const ws=document.getElementById('workspace'); const el=_tutCurEl;
  if(!spot || !pop) return;
  const r=el && el.getBoundingClientRect && el.getBoundingClientRect();
  const popW=pop.offsetWidth||280, popH=pop.offsetHeight||190;
  if(r && r.width && r.height){
    if(veil) veil.style.display='none';
    spot.style.display='block';
    spot.style.left=(r.left-6)+'px'; spot.style.top=(r.top-6)+'px';
    spot.style.width=(r.width+12)+'px'; spot.style.height=(r.height+12)+'px';
    let top=r.bottom+12;
    if(top+popH>window.innerHeight-8) top=r.top-popH-12;
    top=Math.max(8, Math.min(top, window.innerHeight-popH-8));
    const left=Math.min(Math.max(8,r.left), window.innerWidth-popW-8);
    pop.style.left=left+'px'; pop.style.top=top+'px';
  } else {
    spot.style.display='none';
    if(veil) veil.style.display=_tutActive?'block':'none';
    pop.style.left=Math.max(8,(window.innerWidth-popW)/2)+'px';
    pop.style.top=Math.max(8, Math.min(window.innerHeight/2-120, window.innerHeight-popH-8))+'px';
  }
  if(ws && _tutActive) ws.style.overflow='hidden';
}
// ---- modal lock: block stray clicks/scroll while the tutorial is up ----------
function _tutInPop(t){ const p=document.getElementById('tut-pop'); return !!(p && t && p.contains(t)); }
function _tutInTarget(t){ return !!(_tutCurEl && _tutCurEl.contains && t && _tutCurEl.contains(t)); }
// A themed dialog (uiConfirm, uiPromptText, etc.) can be spawned WHILE the
// tutorial is locked - e.g. "Show me" needing to load the sample module
// asks first if the current project is dirty. It lives outside both the
// tutorial popup and the step's own target, so without this check every
// click on it (Yes AND No) was silently swallowed below, leaving the
// confirm stuck open with no way to dismiss it and the whole app locked
// behind it.
function _tutInModal(t){ return !!(t && t.closest && t.closest('.modal-bg:not(.hidden)')); }
function _tutInField(t){
  if(!t) return false;
  const tag=(t.tagName||'').toUpperCase();
  return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||t.isContentEditable===true;
}
function _tutGuard(e){
  if(!_tutActive) return;
  if(_tutInPop(e.target)) return;
  if(_tutInModal(e.target)) return;
  if(!_tutReadonly && _tutInTarget(e.target)) return;
  if(e.preventDefault) e.preventDefault(); if(e.stopPropagation) e.stopPropagation();
}
function _tutWheel(e){ if(!_tutActive) return; if(_tutInPop(e.target)) return; if(_tutInModal(e.target)) return; if(e.preventDefault) e.preventDefault(); if(e.stopPropagation) e.stopPropagation(); }
function _tutKey(e){ if(!_tutActive) return; if(_tutInPop(e.target)) return; if(_tutInModal(e.target)) return;
  // Never swallow keys meant for whatever text field is actually focused -
  // the tutorial itself routinely asks the learner to type into one (e.g.
  // "Write a line" targets the scene card, but the real typing happens in
  // the Properties panel's textarea), and this guard's job is to freeze the
  // rest of the app, not to break ordinary typing wherever it happens.
  if(_tutInField(document.activeElement)) return;
  if([' ','PageUp','PageDown','Home','End','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key)>=0){ if(e.preventDefault) e.preventDefault(); } }
function tutLock(){
  document.addEventListener('click', _tutGuard, true);
  document.addEventListener('mousedown', _tutGuard, true);
  document.addEventListener('keydown', _tutKey, true);
  window.addEventListener('resize', _placeTutOverlay);
  try{ window.addEventListener('wheel', _tutWheel, {capture:true, passive:false}); }catch(e){ window.addEventListener('wheel', _tutWheel, true); }
}
function tutUnlock(){
  document.removeEventListener('click', _tutGuard, true);
  document.removeEventListener('mousedown', _tutGuard, true);
  document.removeEventListener('keydown', _tutKey, true);
  window.removeEventListener('resize', _placeTutOverlay);
  try{ window.removeEventListener('wheel', _tutWheel, {capture:true}); }catch(e){ window.removeEventListener('wheel', _tutWheel, true); }
  const ws=document.getElementById('workspace'); if(ws) ws.style.overflow='auto';
  const veil=document.getElementById('tut-veil'); if(veil) veil.style.display='none';
}
function pollTut(){
  if(!_tutActive) return;
  _placeTutOverlay();
  const step=_tutSteps[_tutIdx];
  if(step && !step.last && _tutArmed && tutDone(step)){
    _tutArmed=false; _tutIdx++;
    if(_tutIdx>=_tutSteps.length){ return endTutorial(true); }
    renderTutStep();
  }
}
function startTutorial(force, fromStart){
  if(!force && tutorialOff()) return;
  _tutSteps=TUTORIAL_STEPS; _tutReadonly=false; _tutActive=true; _tutIdx=0;
  // Skip steps already satisfied by the project being tutorialized, so it
  // meets a returning user (or someone opening their own in-progress file)
  // where they are. Never do this for the built-in sample story: its scenes
  // and dialogue are pre-built by US, not something the current user just
  // accomplished, so silently jumping ahead there robbed a first-time
  // viewer of the very steps meant to orient them (used to land on step 3).
  // A real report: an EXPLICIT "Restart tutorial" (Help menu / restartTutorial())
  // landed on step 3 too, on any project that already has scenes/dialogue
  // written - which is most real, in-progress projects, so this read as
  // "restart is just broken". That smart-skip only makes sense for the
  // AUTOMATIC tour that greets you when a project loads (maybeAutostartTutorial());
  // an explicit "restart" unambiguously means "from the beginning", so
  // fromStart bypasses the skip-ahead entirely and always lands on step 1.
  if(!fromStart && (typeof sampleModuleLoaded!=='function' || !sampleModuleLoaded())){
    while(_tutIdx<_tutSteps.length-1 && _tutSteps[_tutIdx].done && (()=>{try{return _tutSteps[_tutIdx].done();}catch(e){return false;}})()) _tutIdx++;
  }
  tutLock();
  renderTutStep();
  if(_tutTimer) clearInterval(_tutTimer);
  _tutTimer=setInterval(pollTut,600);
}
function endTutorial(completed){
  _tutActive=false; if(_tutTimer){ clearInterval(_tutTimer); _tutTimer=null; }
  tutUnlock();
  const spot=document.getElementById('tut-spot'), pop=document.getElementById('tut-pop');
  if(spot)spot.style.display='none'; if(pop)pop.style.display='none';
  if(completed) toast('Tutorial complete; happy building!');
  // #91/regression fix: the sample tour used to open a whole separate
  // BROWSER tab (window.open) so touring it never touched whatever project
  // was already open - a real report ("opens in a completely new window
  // instead of an in-UI tab") called this out once #86 added real in-UI
  // project tabs, since the old browser-tab workaround now reads as a
  // jarring inconsistency rather than "part of the app". startFullTutorial()
  // now opens a normal in-UI ProjectTabs tab instead (see its own header
  // comment); this still offers to close THAT tab and hop back once the
  // tour ends, same as before, just via ProjectTabs.closeTab() instead of
  // window.close().
  if(_tutSampleTabId && typeof ProjectTabs!=='undefined' && ProjectTabs.activeId===_tutSampleTabId && typeof uiConfirm==='function'){
    const closeId=_tutSampleTabId;
    setTimeout(()=>{
      uiConfirm('Ready to head back? This tab was just for the sample tour.', ()=>{
        ProjectTabs.closeTab(closeId);
      }, { yes:'Close this tab', no:'Keep exploring the sample' });
    }, 200);
  }
  _tutSampleTabId=null;
}
function tutNext(){ if(_tutSteps[_tutIdx]&&_tutSteps[_tutIdx].last){ return endTutorial(true); } _tutIdx=Math.min(_tutSteps.length-1,_tutIdx+1); renderTutStep(); }
function tutPrev(){ _tutIdx=Math.max(0,_tutIdx-1); renderTutStep(); }
function tutSkip(){ endTutorial(false); toast('Tutorial hidden; reopen from Help ▸ Restart tutorial'); }
function tutTurnOff(){ ToolSettings.set('tutorialOff','1'); endTutorial(false); toast('Tutorials off; turn back on in ⚙️ Settings'); }
function tutShowMe(){
  const step=_tutSteps[_tutIdx]; const el=tutTarget(step);
  // "Show me" loads the sample story (once) so the feature is actually on screen to see
  if(typeof sampleModuleLoaded==='function' && !sampleModuleLoaded() && typeof loadSampleModule==='function'){
    // #6: loadSampleModule() may now show an in-UI confirm (async) instead of
    // loading synchronously, so the "advance the tutorial" follow-up has to
    // run from its onLoaded callback rather than trusting the return value -
    // it fires at the right time either way (immediately if no confirm was
    // needed, or once the user actually agrees).
    loadSampleModule({ onLoaded:function(){ setTimeout(function(){ renderTutStep(); tutFlashSpot(tutTarget(_tutSteps[_tutIdx])); }, 120); } });
    return;
  }
  if(el && el.scrollIntoView){ try{ el.scrollIntoView({block:'center',inline:'center',behavior:'smooth'}); }catch(e){} }
  setTimeout(function(){ renderTutStep(); tutFlashSpot(el); }, 60);
}
function tutFlashSpot(el){
  if(el && el.scrollIntoView){ try{ el.scrollIntoView({block:'center',inline:'center',behavior:'smooth'}); }catch(e){} }
  const spot=document.getElementById('tut-spot');
  if(!spot || spot.style.display==='none'){
    const pop=document.getElementById('tut-pop');
    if(pop){ pop.classList.remove('tut-pulse'); void pop.offsetWidth; pop.classList.add('tut-pulse'); setTimeout(function(){ pop.classList.remove('tut-pulse'); }, 1400); }
    return;
  }
  let n=0; const iv=setInterval(function(){
    const on=(n%2===0); spot.style.borderColor = on?'#ffffff':'var(--accent)'; spot.style.borderWidth = on?'4px':'2px';
    if(++n>6){ clearInterval(iv); spot.style.borderColor='var(--accent)'; spot.style.borderWidth='2px'; }
  }, 130);
}
function restartTutorial(){ ToolSettings.set('tutorialOff','0'); startTutorial(true, true); }
function setTutorialsEnabled(on){ ToolSettings.set('tutorialOff', on?'0':'1'); if(on) startTutorial(true); else endTutorial(false); }
// #102: fires the BASIC tutorial (never the full sample-story deep-dive)
// every time Scenemaker is opened, not just the first time ever - the
// in-memory flag (not a ToolSettings value) is what makes that "every
// launch" instead of "every project loaded this session": loadProject() runs
// on New/Open/Recent/Sample alike, so without this guard picking a second
// file in one sitting would pop the tour again; a real relaunch always
// starts this flag fresh. tutorialOff() (Settings, or "Turn off" on any
// tutorial popup) is still the one durable way to silence it for good.
let _tutAutostartFired=false;
function maybeAutostartTutorial(){
  if(_tutAutostartFired || tutorialOff()) return;
  _tutAutostartFired=true;
  startTutorial(true);
}
// loadProject() calls this (not maybeAutostartTutorial() directly) so the
// popup can wait a beat for the DOM to settle after a fresh render, without
// paying for a real setTimeout on every project load for the rest of the
// session - the guard is checked HERE, synchronously, before scheduling
// anything, so only the very first, actually-eligible call ever creates a
// timer at all.
function maybeAutostartTutorialSoon(){
  if(_tutAutostartFired || tutorialOff()) return;
  setTimeout(maybeAutostartTutorial, 800);
}

/* ============================================================================
   FULL TUTORIAL; an in-depth guided tour of the built-in sample module.
   Entered from the "Sample story tour" button on any basic-tutorial popup, or
   Help ▸ Sample story tour - a DIFFERENT, longer thing than Help ▸ Replay all
   tutorials, which only resets and restarts the short 8-step tour above (on
   the user's OWN project) plus the per-panel mini-tutorials; this one loads
   the sample story ("The Whistleblower") and walks through each of its real
   features - the node graph, characters, variables, branching choices,
   canvas layout, assets and export - so a complete newbie can read through
   in roughly 5-15 minutes and come away understanding how Scenemaker fits
   together, not just what one button does. Steps are readonly (advance with
   Next; the underlying app is locked so nothing gets accidentally edited
   mid-tour) - a step can still DEMONSTRATE an action via its own `enter()`
   hook (e.g. collapsing a scene card for real) rather than only describing
   it, since the learner's own clicks on the app are blocked while the tour
   is up. Edit the copy freely; each step points at a sample scene node or a
   toolbar button by CSS selector (or a function returning an element, for
   things that only exist once a panel is open).
   ==========================================================================*/
const FULL_TUTORIAL_STEPS = [
  { sel:'#intro', title:'1 · Welcome to The Whistleblower',
    body:'This short branching story is now loaded so you can see every feature on the real thing, not just hear about it. It’s a handful of scenes across <b>two layers</b>: an opening cutscene, a two-character conversation with an optional side-trip, a branch, and three different endings depending on how you play it. This tour takes about 12 minutes; <b>Skip</b> or <b>Turn off</b> below exit any time, and Help ▸ <b>Sample story tour</b> always restarts from here.',
    done:()=>false },
  { sel:'#intro', title:'2 · Scenes are boxes on a graph',
    body:'Every scene is one of these boxes on an open stage, not a linear list. Drag a header to move a scene; drag from a choice’s dot to another scene’s edge to connect them. To disconnect a wire, drag again from either end, the origin dot or the target scene’s own edge, either one now offers to cut it. <b>Intro</b> is a <b>cutscene</b>; full-screen narration with no dialogue box, good for scene-setting text like this one’s two lines. The small <b>▸</b> beside a scene’s title (any scene but the current start) sets it as the layer’s new start scene in one click.',
    done:()=>false },
  { sel:'#intro', title:'3 · Scene transitions',
    body:'Look at the wire leaving <b>Intro</b>: the small ⇄ badge on it means this link plays a <b>transition</b> when followed - here, a gentle fade. Click that badge on any connection (after the tour) to pick from fade, slide, wipe, zoom, iris or flip, with separate scene-out/scene-in effects if you want them to differ. Undecorated links (like <b>Meeting → Reaction</b>) just cut instantly, which is still the right choice most of the time.',
    done:()=>false },
  { sel:()=>document.getElementById('meeting'), title:'4 · Collapsing scenes to cut clutter',
    enter:()=>{ if(typeof scenes!=='undefined' && scenes['meeting']){ scenes['meeting'].collapsed=true; if(typeof renderScenes==='function') renderScenes(); } },
    body:'Watch <b>Meeting</b> shrink to a compact one-line pill - that’s what a collapsed scene looks like once a story has dozens of them and the graph gets busy. Double-click any scene’s header (or right-click → Collapse) to do this yourself; the toolbar’s "Collapse all / Expand all" does every scene at once.',
    done:()=>false },
  { sel:()=>document.getElementById('meeting'), title:'5 · Expanding it back',
    enter:()=>{ if(typeof scenes!=='undefined' && scenes['meeting']){ scenes['meeting'].collapsed=false; if(typeof renderScenes==='function') renderScenes(); } },
    body:'And back open, exactly as it was - collapsing never changes a scene’s content, only how much room it takes up while you’re not working on it. <b>Meeting</b> puts <b>two characters on stage</b> at once (Mira and Kade); each dialogue line below picks who’s speaking and which side of the screen they stand on.',
    done:()=>false },
  { sel:'#tb-chars', title:'6 · Characters: portraits, faces, sound & layers',
    body:'This story’s cast lives under <b>👥 CHARS</b>. Mira has a default portrait <b>plus an “upset” face state</b> she switches to later, and a soft <b>typing sound</b>; Kade has his own, distinct one. A third character, <b>Priya</b>, only appears on the <b>Evidence</b> layer (covered in a few steps) - she’s tagged to that one layer so she doesn’t clutter this list while you’re working on the main story; every character defaults to “all layers” unless you scope it like that. Click a face on a card to edit it in the <b>Properties</b> panel.',
    done:()=>false },
  { sel:()=>document.getElementById('panel-chars')||document.getElementById('tb-chars'), title:'7 · Panels: dock, float, and resize',
    body:'That Characters panel you just opened can dock to either edge, float anywhere (drag its header), collapse to just its title bar, or close entirely, using the icons in its own header. Two panels docked to the same side share a column and stack; the <b>⇄</b> icon moves one into a second column instead, so a crowded side doesn’t squeeze everyone into an ever-shorter stack. Drag a panel’s bottom edge to resize it taller or shorter (double-click that edge to go back to auto); its side edge still resizes width the same way it always has.',
    done:()=>false },
  { sel:'#tb-vars', title:'8 · Variables: the story’s memory',
    body:'This sample tracks three variables under <b>🎚 VARS</b>: two numbers, <b>empathy</b> and <b>escalation</b> (both start at 0), and a <b>true/false flag</b>, <b>hasEvidence</b> (starts false). Variables are what let a story remember what the reader did earlier and react to it later - a flag, a score, a relationship meter, or typed-in text, whatever the moment calls for. Don’t confuse them with <b>Keyphrases</b>, further down that same panel: a keyphrase only colours/styles a word in dialogue, it carries no value of its own.',
    done:()=>false },
  { sel:'#meeting', title:'9 · Choices carry effects',
    body:'Open <b>Meeting</b>’s choices (the ⚙ gear on each) after the tour and you’ll find an <b>Effects</b> list: “Reassure her, she’s safe here” adds 2 to <b>empathy</b>; “Press her for the hard details” adds 3 to <b>escalation</b>. Any choice can add to, subtract from, or set a variable outright - this is how a reader’s pick actually changes the story’s memory. The third choice, “Ask if anyone else can confirm this”, carries no effect of its own; it carries a <b>portal</b> instead, covered in a moment.',
    done:()=>false },
  { sel:'#reaction', title:'10 · Branching by variable, with priority',
    body:'The <b>Reaction</b> scene’s own choice <b>branches on those variables</b> - see the cyan chips and dashed wires: empathy ≥ 2 → <i>Trust</i>, escalation ≥ 3 → <i>Fracture</i>. Routes are checked <b>top to bottom</b>, so if a reader somehow qualifies for both, <b>empathy wins</b> because its route is listed first; if neither matches, the plain connection below them (→ Unsettled) is the fallback. This same top-to-bottom priority applies to every choice’s routes, not just this one.',
    done:()=>false },
  { sel:()=>document.getElementById('goodEnd')||document.getElementById('tenseEnd')||document.getElementById('neutralEnd'), title:'11 · Three endings, grouped together',
    body:'That single choice’s branching leads to three different endings: <b>Trust</b> (reassure enough), <b>Fracture</b> (press too hard), or <b>Unsettled</b> (neither). An ending is just a scene with no outgoing choices - the player reads its line(s) and the story stops there. Nothing marks a scene as “an ending” explicitly; Scenemaker just detects it has nowhere left to go. Notice the labelled, coloured box drawn around all three, that’s a <b>Group</b>: purely organizational (nothing about how the story plays), it clusters related scenes so you can drag, collapse or colour them together instead of one at a time. Make one yourself (after the tour) from the toolbar’s Group button, or by right-clicking empty space on the stage.',
    done:()=>false },
  { sel:()=>document.querySelector('#meeting .portal-tab, #meeting .portal-icon')||document.getElementById('meeting'), title:'12 · Layers & portals',
    body:'Scenemaker projects aren’t limited to one stage: the bottom bar’s layer picker (bottom-left) can hold several, each its own full node graph. This sample has a second one, <b>Evidence</b>, reached from <b>Meeting</b>’s third choice via a <b>portal</b> - the small tab on that choice’s edge. Follow it and you land on <b>The Source</b>, a short scene introducing <b>Priya</b>, who sets <b>hasEvidence</b> to true and portals straight back into <b>Meeting</b> to continue. Portals work in either direction and can jump to any layer’s start scene or one you name specifically; open the layer picker after the tour to see <b>Evidence</b> for yourself.',
    done:()=>false },
  { sel:'#tb-assets', title:'13 · Assets: every file in one place',
    body:'Every image and sound this story uses - Mira, Kade and Priya’s portraits, Mira’s upset face, every typing sound, the chime sound effect on “listening” - lives in the <b>🗂 ASSETS</b> library. Drag any asset straight onto a character’s face, a scene’s background/audio slot, or a line’s portrait to assign it; double-click one for its full file info.',
    done:()=>false },
  { sel:'#tb-canvas', title:'14 · Canvas editor: design the actual screen',
    body:'Everything so far shapes WHAT happens; the <b>🖼 CANVAS</b> editor shapes what it looks like - drag the dialogue box, choices and portraits anywhere on screen, pick a template layout, or attach portraits to an edge of the dialogue box. This sample uses Scenemaker’s plain default layout, so open Canvas after the tour to see (and change) exactly what a player would see.',
    done:()=>false },
  { sel:()=>document.getElementById('sb-coords')||document.getElementById('status-bar'), title:'15 · Finding your way around the stage',
    body:'The bottom bar tracks the <b>X/Y position</b> of your cursor (or whatever’s selected) as you work, and its two ⤢ buttons jump straight to the <b>start scene</b> or the <b>scene you last edited</b>, handy once a story has dozens of scenes scattered around. Zooming with the bar’s own <b>−/+</b> buttons centres on your current selection; zooming with the mouse wheel (or Ctrl/Cmd+wheel) centres on the cursor instead.',
    done:()=>false },
  { sel:'#tb-preview', title:'16 · Play it yourself',
    body:'When the tour finishes, hit <b>▶ PREVIEW</b> to actually play through this story in a new tab. Try it a few times: pick “Ask if anyone else can confirm this” first to meet Priya before continuing, then compare picking “Reassure her” both times (lands on <i>Trust</i>) against “Press her” both times (lands on <i>Fracture</i>) - watching the ending actually change is the clearest way to see variables and branching working together.',
    done:()=>false },
  { sel:'#tb-export', title:'17 · Export when a story is ready',
    body:'When your own story is ready for real learners, <b>⇪ EXPORT SCORM</b> packages it - with every image and sound bundled in - for any SCORM 1.2 learning platform. The same Export screen also offers a plain printable script, a visual storyboard, and (on Windows/Mac) a standalone double-click executable, if you don’t need an LMS at all.',
    done:()=>false },
  { sel:'#tb-scene', title:'18 · You’re ready to build', last:true,
    body:'That’s the whole shape of Scenemaker: scenes on a graph (across as many layers as you need, linked by portals), characters and variables that feed into branching choices and transitions, a canvas to design the screen, and export when you’re done. Explore any part of this sample to experiment - nothing here is precious - or start a brand-new project from the File menu whenever you’re ready. Happy building!' },
];
// #91: the full sample tour used to load "The Whistleblower" straight into
// whatever tab/project you already had open (with only an easy-to-miss
// "this replaces the current story" confirm as a safety net); every single
// entry point (Help menu, the start screen's own button, the first-run
// offer, "Show me" from inside the short basic tutorial) funnels through
// here, so opening somewhere else for it - leaving the current tab's
// project completely untouched - is a one-place fix.
// Regression fix: #91 originally did that by opening a whole separate
// BROWSER tab (window.open(...'?sample=tour'...)), from before #86 added
// real in-UI project tabs. A real report after #86 shipped ("opens in a
// completely new window instead of an in-UI tab") called that out as
// inconsistent now that the app has its own tab bar for exactly this - a
// second, genuinely separate browser tab/window reads as a bug, not a
// feature. This now opens a normal in-UI ProjectTabs tab instead (same
// "leaves your current tab untouched" guarantee, same one-place fix for
// every entry point), tracked via _tutSampleTabId so endTutorial() can
// still offer to close just that tab once the tour ends. If you're already
// looking at the sample (any tab, e.g. restarting the tour from its own
// Help menu), this restarts in place instead of opening yet another tab.
function startFullTutorial(){
  const alreadyOnSample = typeof sampleModuleLoaded==='function' && sampleModuleLoaded();
  if(!alreadyOnSample){
    const useTabs = typeof ProjectTabs!=='undefined' && ProjectTabs.ready;
    if(useTabs) ProjectTabs.beginNewTab();
    if(typeof loadSampleModule==='function'){ loadSampleModule({silent:true}); }
    if(useTabs){ _tutSampleTabId=ProjectTabs.activeId; ProjectTabs.finishNewTab(); }
  }
  if(typeof ToolSettings!=='undefined') ToolSettings.set('tutorialSeen','1');
  _tutSteps=FULL_TUTORIAL_STEPS; _tutReadonly=true; _tutActive=true; _tutIdx=0;
  setTimeout(function(){
    tutLock();
    renderTutStep();
    if(_tutTimer) clearInterval(_tutTimer);
    _tutTimer=setInterval(pollTut,700);
  }, 220);
}
