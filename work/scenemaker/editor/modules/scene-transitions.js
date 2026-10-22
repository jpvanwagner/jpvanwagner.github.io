/* ============================================================================
   Scenemaker editor; scene transitions  (#83)
   A small popover, opened from the ⇄ indicator on a connection line
   (editor/connections.js's renderTransitionIndicator, wired in via
   SceneConnections.init's onTransitionClick), configuring a fade/slide/wipe/
   zoom/iris/flip effect for that ONE specific link between two scenes: either
   one combined
   effect (played once, covering both the exit of the old scene and the
   entry of the new one) or separate scene-out and scene-in effects picked
   independently. Stored on the outcome object itself (outcome.transition),
   right next to targetNode - it IS a property of that specific link, same
   as everything else connections.js already reads per-outcome. The player
   (player/runtime.js) reads it at the moment that outcome is actually
   followed. Undefined/missing transition is a total no-op everywhere, so
   existing projects and links are unaffected until an author opens this.
   ==========================================================================*/
const TRANSITION_TYPES = [['none','None (instant)'],['fade','Fade'],['slide','Slide'],['wipe','Wipe'],['zoom','Zoom'],['iris','Iris (circle)'],['flip','Flip']];
const TRANSITION_DIRS = [['up','Up'],['down','Down'],['left','Left'],['right','Right']];
const TRANSITION_DIRECTIONAL = ['slide','wipe']; // the only types a direction actually applies to

function defaultTransition(){
  return { mode:'combined',
    combined:{ type:'fade', dir:'up', speed:1 },
    out:{ type:'fade', dir:'up', speed:1 },
    in:{ type:'fade', dir:'up', speed:1 } };
}
function _findOutcome(sourceId, choiceId, outcomeId){
  const n=scenes[sourceId]; if(!n) return null;
  const c=(n.choices||[]).find(x=>x.id===choiceId); if(!c) return null;
  return (c.outcomes||[]).find(x=>x.id===outcomeId) || null;
}

let _transPopEl=null, _transPopCtx=null;
function _transPopHide(){ if(_transPopEl){ _transPopEl.remove(); _transPopEl=null; _transPopCtx=null; document.removeEventListener('mousedown',_transPopOutside,true); } }
function _transPopOutside(e){ if(_transPopEl && !_transPopEl.contains(e.target)) _transPopHide(); }

function openTransitionEditor(sourceId, choiceId, outcomeId, e){
  const o=_findOutcome(sourceId, choiceId, outcomeId); if(!o) return;
  if(!o.transition) o.transition=defaultTransition();
  _transPopHide();
  _transPopCtx={ sourceId, choiceId, outcomeId };
  const box=document.createElement('div'); box.className='trans-pop';
  document.body.appendChild(box);
  _transPopEl=box;
  _transPopRender();
  const w=box.offsetWidth||260, h=box.offsetHeight||160;
  const x=(e&&e.clientX!=null)?e.clientX:window.innerWidth/2;
  const y=(e&&e.clientY!=null)?e.clientY:window.innerHeight/2;
  box.style.left=Math.min(x, window.innerWidth-w-10)+'px';
  box.style.top=Math.min(y, window.innerHeight-h-10)+'px';
  setTimeout(()=>document.addEventListener('mousedown',_transPopOutside,true),0);
}
function _transPopRender(){
  if(!_transPopEl || !_transPopCtx) return;
  const {sourceId,choiceId,outcomeId}=_transPopCtx;
  const o=_findOutcome(sourceId,choiceId,outcomeId);
  if(!o){ _transPopHide(); return; } // the link itself is gone (deleted mid-edit)
  const t=o.transition;
  // Speed (#1): spec.speed has always been part of the stored shape
  // (defaultTransition() below) and player/runtime.js's own playback
  // (dur=BASE_DURATION/speed) already honours it, but there was never an
  // actual control to set it from - it silently sat at its default (1x,
  // normal speed) forever. 0.4x (noticeably slower, a beat you can savor)
  // to 3x (a near-instant snap) covers the useful range either side of
  // "normal", a direct owner request ("add sliders to scene transition
  // effects"). Hidden entirely for 'none' (instant, nothing to time).
  const effRow=(label, spec, prefix)=>`
    <div class="rowflex" style="align-items:flex-end;margin-top:6px">
      <div class="fld"><label>${label}</label><select onchange="setTransField('${prefix}','type',this.value)">
        ${TRANSITION_TYPES.map(x=>`<option value="${x[0]}" ${spec.type===x[0]?'selected':''}>${x[1]}</option>`).join('')}
      </select></div>
      <div class="fld" ${TRANSITION_DIRECTIONAL.includes(spec.type)?'':'style="display:none"'}><label>Direction</label><select onchange="setTransField('${prefix}','dir',this.value)">
        ${TRANSITION_DIRS.map(d=>`<option value="${d[0]}" ${spec.dir===d[0]?'selected':''}>${d[1]}</option>`).join('')}
      </select></div>
      <div class="fld" ${spec.type==='none'?'style="display:none"':''} title="How fast this transition plays; 1x is normal">
        <label>Speed</label>
        <span style="display:flex;align-items:center;gap:6px">
          <input type="range" min="0.4" max="3" step="0.1" value="${spec.speed||1}" oninput="setTransSpeed('${prefix}',this.value); this.nextElementSibling.textContent=(+this.value).toFixed(1)+'x'" style="width:90px;vertical-align:middle">
          <span style="font-size:11px;color:var(--mut);min-width:28px">${(+(spec.speed||1)).toFixed(1)}x</span>
        </span>
      </div>
    </div>`;
  _transPopEl.innerHTML = `
    <h3 style="margin:0 0 8px;display:flex;align-items:center;justify-content:space-between">Scene transition
      <span class="hdr-icon" onclick="_transPopHide()">✕</span></h3>
    <div class="fld"><label>Mode</label>
      <select onchange="setTransMode(this.value)">
        <option value="combined" ${t.mode==='combined'?'selected':''}>One combined effect (out + in together)</option>
        <option value="separate" ${t.mode==='separate'?'selected':''}>Separate scene-out / scene-in effects</option>
      </select></div>
    ${t.mode==='combined' ? effRow('Effect', t.combined, 'combined') : (effRow('Scene-out effect', t.out, 'out') + effRow('Scene-in effect', t.in, 'in'))}
    <button class="mini-btn warn" style="margin-top:10px" onclick="clearTransition()">Clear (no transition)</button>`;
}
function setTransMode(mode){
  if(!_transPopCtx) return; const {sourceId,choiceId,outcomeId}=_transPopCtx;
  const o=_findOutcome(sourceId,choiceId,outcomeId); if(!o) return;
  pushUndo(); o.transition.mode=(mode==='separate'?'separate':'combined'); renderScenes(); _transPopRender();
}
function setTransField(which,field,value){
  if(!_transPopCtx) return; const {sourceId,choiceId,outcomeId}=_transPopCtx;
  const o=_findOutcome(sourceId,choiceId,outcomeId); if(!o || !o.transition[which]) return;
  pushUndo(); o.transition[which][field]=value; renderScenes(); _transPopRender();
}
// Speed's own setter, called continuously on the slider's oninput (every
// pixel of drag) rather than a discrete choice like type/dir - deliberately
// skips pushUndo() so dragging it doesn't flood undo history with one entry
// per tick, matching the same no-undo-per-tick convention scene-fx-cues.js's
// intensity sliders already established. Coerced and clamped to the
// slider's own [0.4, 3] range since it arrives as a string from the DOM.
function setTransSpeed(which,value){
  if(!_transPopCtx) return; const {sourceId,choiceId,outcomeId}=_transPopCtx;
  const o=_findOutcome(sourceId,choiceId,outcomeId); if(!o || !o.transition[which]) return;
  o.transition[which].speed=Math.max(0.4,Math.min(3,parseFloat(value)||1));
}
function clearTransition(){
  if(!_transPopCtx) return; const {sourceId,choiceId,outcomeId}=_transPopCtx;
  const o=_findOutcome(sourceId,choiceId,outcomeId); if(!o) return;
  pushUndo(); delete o.transition; renderScenes(); _transPopHide();
}
