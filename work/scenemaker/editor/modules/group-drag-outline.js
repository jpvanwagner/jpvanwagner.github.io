/* ============================================================================
   Scenemaker editor; show a group's outline through obscuring elements while
   dragging a scene over it (#67). Group boxes sit BEHIND every scene
   (z-index:2 vs a scene's 10, selected 20) by design, so a scene being
   dragged right across a group's edge - exactly the moment you'd want to see
   that boundary - has its own opaque card sitting on top of it, hiding it.
   This traces the group's outline on its own layer above everything else
   while the drag is live, using the SAME "which group is this scene over"
   check the real drop (handleSceneDropGroup, core.js) already uses, so the
   preview always matches what dropping here would actually do.
   Shares core.js scope.
   ==========================================================================*/
function _groupDragOutlineEl(){
  return document.getElementById('group-drag-outline');
}
// called on every mousemove while a scene is being dragged; n is the
// scene's own model object (fresh x/y already applied this move), el its
// live DOM node (used only as a size fallback if nodeSize() can't measure).
function updateGroupDragOutline(n, el){
  const outline=_groupDragOutlineEl(); if(!outline) return;
  const wh = typeof nodeSize==='function' ? nodeSize(n.id) : [ (el&&el.offsetWidth)||420, (el&&el.offsetHeight)||220 ];
  const cx=n.x+wh[0]/2, cy=n.y+wh[1]/2;
  const gid = typeof groupAtPoint==='function' ? groupAtPoint(cx,cy) : null;
  const gEl = gid && document.getElementById(gid);
  if(!gEl){ outline.style.display='none'; return; }
  const b=backdrops[gid];
  outline.style.display='block';
  outline.style.left=gEl.offsetLeft+'px'; outline.style.top=gEl.offsetTop+'px';
  outline.style.width=gEl.offsetWidth+'px'; outline.style.height=gEl.offsetHeight+'px';
  outline.style.borderColor=(b&&b.color)||'';
}
function hideGroupDragOutline(){ const outline=_groupDragOutlineEl(); if(outline) outline.style.display='none'; }
