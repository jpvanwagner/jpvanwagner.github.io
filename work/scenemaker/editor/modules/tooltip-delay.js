/* ============================================================================
   Scenemaker editor; custom tooltip delay / off switch  (#146)
   Browsers give no way to change a native title="" tooltip's hover delay, or
   turn it off - so this replaces the native mechanism outright with a
   matching custom one: one global mouseover/mouseout listener finds the
   hovered element's own title (or its nearest ancestor's), suppresses the
   real browser tooltip by removing that attribute for the duration of the
   hover, and shows an identical-looking custom popup after the configured
   delay (or never, if tooltips are off) - restoring the real title attribute
   on mouseout either way, so markup/accessibility are unchanged once the
   pointer leaves. Both prefs are per-computer (ToolSettings), like the rest
   of Settings -> Workspace.
   Shares core.js scope.
   ==========================================================================*/
let _ttyTimer=null, _ttyEl=null, _ttyPop=null;
function tooltipDelayMs(){ if(typeof ToolSettings==='undefined') return 500;
  const v=parseInt(ToolSettings.get('tooltipDelay','500'),10); return isNaN(v)?500:Math.max(0,Math.min(5000,v)); }
function tooltipsOff(){ return typeof ToolSettings!=='undefined' && ToolSettings.get('tooltipOff','0')==='1'; }
function setTooltipsEnabled(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('tooltipOff', on?'0':'1'); }
function setTooltipDelay(ms){ const n=parseInt(ms,10); const v=Math.max(0,Math.min(5000,isNaN(n)?500:n));
  if(typeof ToolSettings!=='undefined') ToolSettings.set('tooltipDelay', String(v)); }

function _ttyEnsurePop(){
  if(_ttyPop && document.body.contains(_ttyPop)) return _ttyPop;
  _ttyPop=document.createElement('div'); _ttyPop.id='tty-pop';
  _ttyPop.style.cssText='position:fixed;z-index:9999;background:#0b0713;color:#f1f5f9;'
    +'border:1px solid var(--accent,#c026d3);border-radius:6px;padding:5px 9px;font-size:12px;'
    +'max-width:280px;pointer-events:none;box-shadow:0 8px 20px rgba(0,0,0,.4);display:none';
  document.body.appendChild(_ttyPop);
  return _ttyPop;
}
function _ttyFindTitled(el){
  while(el && el.nodeType===1 && el!==document.body){ if(el.getAttribute('title')) return el; el=el.parentElement; }
  return null;
}
function _ttyClear(){
  if(_ttyTimer){ clearTimeout(_ttyTimer); _ttyTimer=null; }
  if(_ttyPop) _ttyPop.style.display='none';
  if(_ttyEl){ const orig=_ttyEl.getAttribute('data-tty'); if(orig!=null) _ttyEl.setAttribute('title', orig); _ttyEl.removeAttribute('data-tty'); }
  _ttyEl=null;
}
document.addEventListener('mouseover', e=>{
  const target=_ttyFindTitled(e.target);
  if(!target || target===_ttyEl) return;
  _ttyClear();
  _ttyEl=target;
  const text=target.getAttribute('title');
  target.setAttribute('data-tty', text); target.removeAttribute('title'); // suppress the native tooltip either way
  if(tooltipsOff()) return; // off for good - title stays stripped until mouseout restores it, nothing ever shows
  const x=e.clientX, y=e.clientY;
  _ttyTimer=setTimeout(()=>{
    if(_ttyEl!==target) return;
    const pop=_ttyEnsurePop(); pop.textContent=text; pop.style.display='block';
    const pad=14; pop.style.left=(x+pad)+'px'; pop.style.top=(y+pad)+'px';
    requestAnimationFrame(()=>{
      const r=pop.getBoundingClientRect();
      if(r.right>innerWidth) pop.style.left=Math.max(4,innerWidth-r.width-4)+'px';
      if(r.bottom>innerHeight) pop.style.top=Math.max(4,y-r.height-pad)+'px';
    });
  }, tooltipDelayMs());
}, true);
document.addEventListener('mouseout', e=>{
  if(!_ttyEl) return;
  if(e.relatedTarget && _ttyEl.contains(e.relatedTarget)) return; // still within the same titled element
  _ttyClear();
});
