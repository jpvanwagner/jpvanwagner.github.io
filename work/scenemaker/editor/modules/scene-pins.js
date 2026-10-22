/* ============================================================================
   Scenemaker editor; pinned title-bar info  (feature #5)
   Small badges under a scene/group header showing who appears (and optionally
   the line count). Toggled in Settings → Workspace. Shares core.js scope.
   ==========================================================================*/
function pinShowChars(){ return (typeof ToolSettings==='undefined') || ToolSettings.get('pinChars','1')==='1'; }
function pinShowCount(){ return (typeof ToolSettings!=='undefined') && ToolSettings.get('pinLineCount','0')==='1'; }
function setPin(key,on){ if(typeof ToolSettings!=='undefined') ToolSettings.set(key, on?'1':'0'); renderScenes(); renderBackdrops(); }

function charByIdSafe(cid){ return (project.characters||[]).find(c=>c.id===cid)||null; }
function charsInScene(n){
  const ids=new Set();
  (n.cast||[]).forEach(c=>{ if(c.charId) ids.add(c.charId); });
  const out=[]; ids.forEach(id=>{ const c=charByIdSafe(id); if(c) out.push(c); });
  return out;
}
function charChip(c){
  const face=c.media?mediaURL(c.media):null;
  const av = face ? `<span class="pin-face" style="background-image:url('${face}')"></span>`
                  : `<span class="pin-face pin-face-i">${escHtml((c.name||'?').slice(0,1))}</span>`;
  return `<span class="pin-chip" title="${escAttr(c.name||'character')}">${av}${escHtml(c.name||'')}</span>`;
}
function scenePinsHtml(n){
  const bits=[];
  if(pinShowChars()){ const cs=charsInScene(n); cs.forEach(c=>bits.push(charChip(c))); }
  if(pinShowCount()){ bits.push(`<span class="pin-chip pin-meta">${(n.lines||[]).length} line${(n.lines||[]).length===1?'':'s'}</span>`); }
  if(!bits.length) return '';
  return `<div class="node-pins">${bits.join('')}</div>`;
}
function groupPinsHtml(b){
  if(!pinShowChars()) return '';
  const ids=new Set(); groupMembers(b.id).forEach(n=>charsInScene(n).forEach(c=>ids.add(c.id)));
  if(!ids.size) return '';
  const chips=[...ids].map(id=>charByIdSafe(id)).filter(Boolean).map(charChip).join('');
  return `<span class="bd-pins">${chips}</span>`;
}
