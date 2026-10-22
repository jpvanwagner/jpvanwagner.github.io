/* ============================================================================
   Scenemaker editor; de-overlap & tidy the board  (features #14, #16)
   "Disable overlapping" pops a dropped scene to the nearest free spot; the
   "Clean up" button spreads out overlapping scenes and pulls faraway ones back
   toward the group while keeping their rough relative arrangement.
   Shares core.js scope.
   ==========================================================================*/
function _sceneRect(id){ const n=scenes[id]; const wh=(typeof nodeSize==='function')?nodeSize(id):[420,240];
  return { x:n.x, y:n.y, w:wh[0], h:wh[1] }; }
function _overlap(a,b,pad){ pad=pad||14;
  return a.x < b.x+b.w+pad && a.x+a.w+pad > b.x && a.y < b.y+b.h+pad && a.y+a.h+pad > b.y; }
function disableOverlapOn(){ return (typeof ToolSettings!=='undefined') && ToolSettings.get('disableOverlap','0')==='1'; }
function setDisableOverlap(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('disableOverlap', on?'1':'0'); }

/* #14: after a drop, if this scene overlaps another, spiral it out to a free spot */
function popApartIfNeeded(id){
  if(!disableOverlapOn()) return;
  const n=scenes[id]; if(!n) return;
  const sameLayer=typeof visibleScenes==='function'?visibleScenes():scenes;
  const others=Object.keys(sameLayer).filter(k=>k!==id).map(_sceneRect);
  const collides=(x,y)=>{ const r={x,y,w:_sceneRect(id).w,h:_sceneRect(id).h}; return others.some(o=>_overlap(r,o)); };
  if(!collides(n.x,n.y)) return;
  const step=40; const ox=n.x, oy=n.y;
  for(let ring=1; ring<=60; ring++){
    for(let a=0; a<8; a++){
      const ang=a*Math.PI/4; const x=Math.max(0, Math.round(ox+Math.cos(ang)*ring*step)); const y=Math.max(0, Math.round(oy+Math.sin(ang)*ring*step));
      if(!collides(x,y)){ n.x=x; n.y=y; renderAll(); return; }
    }
  }
}

/* #16: clean up the whole board */
function cleanUpBoard(){
  const ids=Object.keys(typeof visibleScenes==='function'?visibleScenes():scenes); if(ids.length<2){ toast('Nothing to tidy'); return; }
  pushUndo();
  // 1) pull far-flung scenes toward the centroid (keep relative direction, cap distance)
  let cx=0, cy=0; ids.forEach(id=>{ cx+=scenes[id].x; cy+=scenes[id].y; }); cx/=ids.length; cy/=ids.length;
  const MAXR=2600;
  ids.forEach(id=>{ const n=scenes[id]; const dx=n.x-cx, dy=n.y-cy; const d=Math.hypot(dx,dy);
    if(d>MAXR){ const k=MAXR/d; n.x=Math.round(cx+dx*k); n.y=Math.round(cy+dy*k); } });
  // 2) resolve overlaps: push pairs apart iteratively
  for(let iter=0; iter<120; iter++){
    let moved=false;
    for(let i=0;i<ids.length;i++){ for(let j=i+1;j<ids.length;j++){
      const A=_sceneRect(ids[i]), B=_sceneRect(ids[j]);
      if(_overlap(A,B,24)){
        let dx=(A.x+A.w/2)-(B.x+B.w/2), dy=(A.y+A.h/2)-(B.y+B.h/2);
        if(dx===0&&dy===0){ dx=Math.random()-0.5; dy=Math.random()-0.5; }
        const len=Math.hypot(dx,dy)||1; const push=26;
        const na=scenes[ids[i]], nb=scenes[ids[j]];
        na.x=Math.max(0,na.x+ (dx/len)*push); na.y=Math.max(0,na.y+ (dy/len)*push);
        nb.x=Math.max(0,nb.x- (dx/len)*push); nb.y=Math.max(0,nb.y- (dy/len)*push);
        moved=true;
      }
    }}
    if(!moved) break;
  }
  // round + refit groups
  ids.forEach(id=>{ scenes[id].x=Math.round(scenes[id].x); scenes[id].y=Math.round(scenes[id].y); });
  Object.keys(typeof visibleBackdrops==='function'?visibleBackdrops():backdrops).forEach(gid=>{ if(typeof refitGroup==='function') refitGroup(gid); });
  renderAll();
  toast('Board tidied up');
}

// #98: color each scene's card to match whichever library character speaks
// the most lines in it (its "dominant" speaker) - manual per-scene coloring
// already existed (multiSetColor, via multi-select), this is a one-click way
// to derive the same field automatically instead of picking each one by
// hand. Skips a scene with no clear single-character speaker (narrator-only,
// several characters tied, or a speaker with no color set) rather than
// guessing; only ever touches the current layer, matching Clean up board.
function autoColorScenesBySpeaker(){
  const ids=Object.keys(typeof visibleScenes==='function'?visibleScenes():scenes);
  if(!ids.length){ toast('No scenes to color'); return; }
  uiConfirm('Color every scene on this layer to match its most-often-speaking character? This overwrites any manual scene colors already set.',
    ()=>{
      pushUndo();
      let colored=0;
      ids.forEach(id=>{
        const sc=scenes[id]; if(!sc.cast||!sc.cast.length) return;
        const counts={};
        (sc.lines||[]).forEach(l=>{
          if(!l.speakingCast) return;
          const entry=sc.cast.find(c=>c.id===l.speakingCast); if(!entry||!entry.charId) return;
          counts[entry.charId]=(counts[entry.charId]||0)+1;
        });
        let bestId=null, bestN=0, tie=false;
        Object.keys(counts).forEach(cid=>{ if(counts[cid]>bestN){ bestN=counts[cid]; bestId=cid; tie=false; } else if(counts[cid]===bestN) tie=true; });
        if(bestId && !tie){ const ch=(project.characters||[]).find(c=>c.id===bestId); if(ch&&ch.color){ sc.color=ch.color; colored++; } }
      });
      renderAll();
      toast(colored ? `Colored ${colored} scene${colored===1?'':'s'} by speaker` : 'No scenes had one clear, colored speaker to match');
    }, { yes:'Color scenes', no:'Cancel' });
}
