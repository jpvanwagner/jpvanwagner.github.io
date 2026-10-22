/* ============================================================================
   Scenemaker editor; warn when opening a project lands on significantly
   overlapping scenes. #65's obstruction-warning.js already catches a scene
   or group ending up COMPLETELY hidden behind another one right as a drag/
   resize ends; this is a different, complementary check for a board that's
   just generally cluttered (several scenes overlapping enough to be hard to
   read, not necessarily one fully swallowing another) at the moment a
   project is actually opened, not on every edit. Offers the exact same
   "Clean up" the toolbar/menu's own Clean up board button already runs
   (tidy.js's cleanUpBoard()), so accepting here is identical to running that
   yourself afterward.
   Scope decided while building this (documented in docs/eisenhower-matrix.md):
   checked once per real "open" (New/Open a file/Recent/Sample, and the very
   first restore of a previous session's tabs on launch), never on switching
   BETWEEN already-open project tabs later in the same session - that's not
   "opening" a project, just bringing already-open work back into view, and
   would make the dismissible checkbox below far less useful (a board you've
   deliberately left overlapping would re-prompt on every switch back to it
   otherwise).
   Shares core.js scope.
   ==========================================================================*/
function openOverlapWarnOff(){ return (typeof ToolSettings!=='undefined') && ToolSettings.get('openOverlapWarnOff','0')==='1'; }
function setOpenOverlapWarn(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('openOverlapWarnOff', on?'0':'1'); }

function _oowArea(r){ return Math.max(0,r.w)*Math.max(0,r.h); }
function _oowOverlapArea(a,b){
  const ix=Math.max(0, Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
  const iy=Math.max(0, Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  return ix*iy;
}
// an overlap covering at least a quarter of the SMALLER of the two scenes
// counts as "significant" (hard to read), as opposed to tidy.js's own much
// looser _overlap() (a small padded bounding-box touch, used to decide
// whether boxes need pushing apart at all, not whether the overlap is bad
// enough to interrupt the user about on open).
const OPEN_OVERLAP_RATIO = 0.25;
function _boardHasSignificantOverlap(){
  const ids=Object.keys(typeof visibleScenes==='function'?visibleScenes():scenes);
  for(let i=0;i<ids.length;i++){ for(let j=i+1;j<ids.length;j++){
    const A=_sceneRect(ids[i]), B=_sceneRect(ids[j]);
    const areaA=_oowArea(A), areaB=_oowArea(B); if(!areaA||!areaB) continue;
    if(_oowOverlapArea(A,B)/Math.min(areaA,areaB) >= OPEN_OVERLAP_RATIO) return true;
  }}
  return false;
}
function checkOpenOverlap(){
  if(openOverlapWarnOff()) return;
  if(!_boardHasSignificantOverlap()) return;
  uiConfirm('Some scenes on this layer overlap significantly and may be hard to see. Clean up the board now?',
    ()=>{ cleanUpBoard(); },
    { yes:'Clean up', no:'Leave it',
      checkbox:{ label:'Don’t warn me again (re-enable in Settings → Workspace)',
                 onChecked:()=>{ setOpenOverlapWarn(false); } } });
}
// small delay so the check runs after the just-opened project has actually
// rendered and landed on its own last-edited scene (loadProject()'s own
// warpAcrossLayers), rather than racing that scroll/render.
function checkOpenOverlapSoon(){ setTimeout(checkOpenOverlap, 350); }
