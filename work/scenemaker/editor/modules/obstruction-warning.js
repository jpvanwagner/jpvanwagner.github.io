/* ============================================================================
   Scenemaker editor; warn when a scene/group box ends up fully hidden behind
   another one (#65). Neither scenes nor groups have an explicit z-order, so
   after a drag or resize one box can end up completely swallowed inside
   another same-type box - it's still there and still connects, but neither
   the author nor the reader can see or click it anymore. Checked once, right
   when a drag/resize actually ends (never live mid-drag, which would fire on
   every intermediate pixel); offers to snap the just-moved box clear of the
   overlap, reusing the same spiral free-spot search "Disable overlapping"
   already uses, but never moves anything without asking first.
   Shares core.js scope.
   ==========================================================================*/
function _fullyContains(outer, inner, tol){
  tol = tol||2;
  return inner.x >= outer.x-tol && inner.y >= outer.y-tol &&
    (inner.x+inner.w) <= (outer.x+outer.w)+tol && (inner.y+inner.h) <= (outer.y+outer.h)+tol;
}
function obstructWarnOff(){ return (typeof ToolSettings!=='undefined') && ToolSettings.get('obstructWarnOff','0')==='1'; }
function setObstructWarn(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('obstructWarnOff', on?'0':'1'); }
function _obstructRect(id,kind){
  if(kind==='scene'){ return (typeof _sceneRect==='function') ? _sceneRect(id) : null; }
  const b=backdrops[id]; if(!b) return null;
  return { x:b.x, y:b.y, w:b.w||300, h:b.h||200 };
}
function _findFullObstruction(movedId, kind){
  const pool = kind==='scene' ? (typeof visibleScenes==='function'?visibleScenes():scenes) : (typeof visibleBackdrops==='function'?visibleBackdrops():backdrops);
  const moved = _obstructRect(movedId,kind); if(!moved || !moved.w || !moved.h) return null;
  for(const otherId of Object.keys(pool)){
    if(otherId===movedId) continue;
    const other = _obstructRect(otherId,kind); if(!other || !other.w || !other.h) continue;
    if(_fullyContains(other,moved) || _fullyContains(moved,other)) return otherId;
  }
  return null;
}
function checkObstruction(movedId, kind){
  if(obstructWarnOff()) return;
  if(!movedId) return;
  const otherId=_findFullObstruction(movedId,kind); if(!otherId) return;
  const label=(id)=> kind==='scene' ? ((scenes[id]&&scenes[id].title)||'this scene') : ((backdrops[id]&&backdrops[id].name)||'this group');
  const movedLabel=label(movedId), otherLabel=label(otherId), kindWord=kind==='scene'?'scene':'group';
  uiConfirm(`“${escHtml(movedLabel)}” now completely overlaps “${escHtml(otherLabel)}”; one ${kindWord} is fully hidden behind the other and can’t be clicked. Move “${escHtml(movedLabel)}” clear of it?`,
    ()=>{ _snapOutOfObstruction(movedId,kind); },
    { yes:'Snap it out', no:'Leave it',
      checkbox:{ label:'Don’t warn me again (re-enable in Settings → Workspace)',
                 onChecked:()=>{ setObstructWarn(false); } } });
}
/* spiral out from the current spot to the nearest position that collides
   with nothing else of the same kind - the exact search popApartIfNeeded()
   (tidy.js) already uses for a dropped scene, generalized to also cover
   group boxes. */
function _snapOutOfObstruction(movedId, kind){
  pushUndo();
  const pool = kind==='scene' ? (typeof visibleScenes==='function'?visibleScenes():scenes) : (typeof visibleBackdrops==='function'?visibleBackdrops():backdrops);
  const r0=_obstructRect(movedId,kind); if(!r0) return;
  const others=Object.keys(pool).filter(k=>k!==movedId).map(id=>_obstructRect(id,kind)).filter(Boolean);
  const collides=(x,y)=>{ const r={x,y,w:r0.w,h:r0.h}; return others.some(o=>_overlap(r,o,4)); };
  const ox=r0.x, oy=r0.y, step=Math.max(r0.w,r0.h)*0.6+40;
  let placed=false, nx=ox, ny=oy;
  for(let ring=1; ring<=60 && !placed; ring++){
    for(let a=0;a<8;a++){
      const ang=a*Math.PI/4;
      const x=Math.max(0,Math.round(ox+Math.cos(ang)*ring*step)), y=Math.max(0,Math.round(oy+Math.sin(ang)*ring*step));
      if(!collides(x,y)){ nx=x; ny=y; placed=true; break; }
    }
  }
  if(!placed){ toast('Couldn’t find a clear spot nearby; try moving it manually'); return; }
  if(kind==='scene'){
    scenes[movedId].x=nx; scenes[movedId].y=ny;
  } else {
    const b=backdrops[movedId]; const dx=nx-b.x, dy=ny-b.y; b.x=nx; b.y=ny;
    // moving a group takes its members along, same as a normal group drag
    if(typeof groupMembers==='function') groupMembers(movedId).forEach(s=>{ s.x=Math.max(0,s.x+dx); s.y=Math.max(0,s.y+dy); });
  }
  renderAll();
  toast('Moved clear of the overlap');
}
