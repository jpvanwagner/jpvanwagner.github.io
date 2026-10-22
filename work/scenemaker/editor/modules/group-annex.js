/* ============================================================================
   Scenemaker editor; resizing a group box out over ungrouped scenes offers to
   add them (#68). Growing a group's box to now cover a scene that was never
   part of it is a strong signal you actually want it in the group (the same
   "is this scene's center inside the box" check dropping a scene onto a
   group already uses, handleSceneDropGroup/groupAtPoint in core.js) - but it
   should never happen silently, since a scene picking up a group changes
   what moves/collapses/hides with it from here on. Checked once, right when
   a resize actually ends (never live mid-resize). Shares core.js scope.
   ==========================================================================*/
function groupAnnexWarnOff(){ return (typeof ToolSettings!=='undefined') && ToolSettings.get('groupAnnexOff','0')==='1'; }
function setGroupAnnexWarn(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('groupAnnexOff', on?'0':'1'); }
function _groupAnnexCandidates(gid){
  const g=backdrops[gid]; if(!g) return [];
  return Object.keys(scenes).filter(id=>{
    const s=scenes[id]; if(!s || s.group) return false; // only scenes with no group of their own yet
    const wh=nodeSize(id), cx=s.x+wh[0]/2, cy=s.y+wh[1]/2;
    return cx>=g.x && cx<=g.x+g.w && cy>=g.y && cy<=g.y+g.h;
  });
}
function checkGroupResizeAnnex(gid){
  if(groupAnnexWarnOff()) return;
  const g=backdrops[gid]; if(!g) return;
  const ids=_groupAnnexCandidates(gid); if(!ids.length) return;
  const one=ids.length===1;
  const label=one ? `“${escHtml(scenes[ids[0]].title||'(untitled)')}”` : `${ids.length} ungrouped scenes`;
  uiConfirm(`${label} ${one?'now sits':'now sit'} inside group <b>${escHtml(g.name)}</b>. Add ${one?'it':'them'} to the group?`,
    ()=>{ pushUndo(); ids.forEach(id=>{ scenes[id].group=gid; }); refitGroup(gid); renderAll(); toast(one?'Scene added to the group':`${ids.length} scenes added to the group`); },
    { yes:'Add to group', no:'Keep separate',
      checkbox:{ label:'Don’t ask me this again (re-enable in Settings → Workspace)',
                 onChecked:()=>{ setGroupAnnexWarn(false); } } });
}
