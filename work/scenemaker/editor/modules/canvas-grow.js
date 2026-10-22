/* ============================================================================
   Scenemaker editor; canvas auto-grow  (feature #10)
   Enlarge the working canvas by hand, or (toggle in Settings; Workspace) grow it
   automatically when a scene or group is dragged near the current edge, so you
   never run out of room. Shares core.js scope.
   ==========================================================================*/
let _canvasW=15000, _canvasH=15000;
const CANVAS_STEP=3000, CANVAS_MARGIN=600;
// The left/top "shift everything over" trigger needs a much tighter margin
// than the right/bottom grow check: a scene's x/y can never actually go
// negative (drag clamps to Math.max(0,...)), so this exists purely to give
// the illusion of room past x=0/y=0 once a drag gets genuinely close to that
// hard wall. Scenes are placed well inside 600px of the origin by default
// (addSceneAtView's +300/+120), so using CANVAS_MARGIN here fired on nearly
// any drag of a project's first scene, teleporting the whole canvas 3000px
// for a one-pixel nudge.
const CANVAS_SHIFT_MARGIN=100;
function autoGrowOn(){ return (typeof ToolSettings==='undefined') || ToolSettings.get('autoGrowCanvas','1')==='1'; }
function applyCanvasSize(){ const zl=document.getElementById('zoom-layer'); if(zl){ zl.style.width=_canvasW+'px'; zl.style.height=_canvasH+'px'; } }
function enlargeCanvas(){ _canvasW+=CANVAS_STEP; _canvasH+=CANVAS_STEP; applyCanvasSize(); toast('Stage enlarged'); }
/* grow if a dragged item nears any edge. Left/top growth shifts all content
   (and the scroll) so the item stays put visually while room opens up. */
function growCanvasFor(rightPx, bottomPx, leftPx, topPx){
  if(!autoGrowOn()) return; let grew=false;
  while(rightPx > _canvasW - CANVAS_MARGIN){ _canvasW += CANVAS_STEP; grew=true; }
  while(bottomPx > _canvasH - CANVAS_MARGIN){ _canvasH += CANVAS_STEP; grew=true; }
  // left / top: shift everything by a step so there's room on that side
  if(leftPx!=null && leftPx < CANVAS_SHIFT_MARGIN){ _shiftAll(CANVAS_STEP, 0); _canvasW += CANVAS_STEP; grew=true; }
  if(topPx!=null && topPx < CANVAS_SHIFT_MARGIN){ _shiftAll(0, CANVAS_STEP); _canvasH += CANVAS_STEP; grew=true; }
  if(grew) applyCanvasSize();
}
function _shiftAll(dx, dy){
  Object.values(scenes).forEach(s=>{ s.x=(s.x||0)+dx; s.y=(s.y||0)+dy; });
  Object.values(backdrops).forEach(b=>{ b.x=(b.x||0)+dx; b.y=(b.y||0)+dy; });
  const ws=document.getElementById('workspace'); if(ws){ ws.scrollLeft += dx*zoomLevel; ws.scrollTop += dy*zoomLevel; }
  if(typeof renderAll==='function') renderAll();
}
function setAutoGrow(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('autoGrowCanvas', on?'1':'0'); }

/* #50: the inverse of growCanvasFor() above - after a lot of dragging (or
   deleting scenes that used to anchor the far edge), the working canvas can
   end up much bigger than anything actually on it, with a lot of dead space
   to scroll through. This pulls everything toward the origin (reclaiming any
   empty margin on the left/top, the same way growCanvasFor's own left/top
   branch pushes it away) and shrinks _canvasW/_canvasH down to the content's
   real bounds plus a comfortable margin - never below a sane floor, so
   there's still room to drag into right after. Considers EVERY layer's
   scenes/groups, not just the one on screen, since the canvas itself is
   shared workspace behind all of them. */
const CANVAS_CROP_MARGIN=1200, CANVAS_MIN=6000;
function _allContentBounds(){
  const ids=Object.keys(scenes); if(!ids.length) return null;
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  const consider=(x,y,w,h)=>{ minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x+w);maxY=Math.max(maxY,y+h); };
  ids.forEach(id=>{ const n=scenes[id]; const wh=(typeof nodeSize==='function')?nodeSize(id):[420,240]; consider(n.x,n.y,wh[0],wh[1]); });
  Object.values(backdrops).forEach(b=>consider(b.x,b.y,b.w||300,b.h||200));
  return {minX,minY,maxX,maxY};
}
function autoCropCanvas(){
  const b=_allContentBounds(); if(!b){ toast('Nothing on the stage to crop to'); return; }
  const shiftX=Math.max(0, Math.floor(b.minX-CANVAS_CROP_MARGIN));
  const shiftY=Math.max(0, Math.floor(b.minY-CANVAS_CROP_MARGIN));
  const newW=Math.max(CANVAS_MIN, Math.ceil(b.maxX-shiftX+CANVAS_CROP_MARGIN));
  const newH=Math.max(CANVAS_MIN, Math.ceil(b.maxY-shiftY+CANVAS_CROP_MARGIN));
  if(shiftX===0 && shiftY===0 && newW>=_canvasW && newH>=_canvasH){ toast('Stage is already cropped to its content'); return; }
  pushUndo();
  if(shiftX>0 || shiftY>0) _shiftAll(-shiftX,-shiftY);
  _canvasW=newW; _canvasH=newH; applyCanvasSize();
  toast('Stage cropped to '+newW+' × '+newH+'px');
}
