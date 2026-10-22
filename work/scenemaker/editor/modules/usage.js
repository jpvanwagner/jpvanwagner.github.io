/* ============================================================================
   Scenemaker editor; usage scanning  (features #12, #13)
   Finds everywhere a media asset, a character, or a variable is referenced, so
   the Assets / Characters / Variables panels can show "used in" lists and jump
   to those spots. Shares core.js scope.
   ==========================================================================*/
function mediaUsage(key){
  const hits=[];
  const add=(sceneId,label)=>hits.push({sceneId,label});
  // title screen + project-level
  const t=project.title||{};
  if(t.bg&&t.bg.media===key) add(null,'Title screen background');
  if(t.music&&t.music.media===key) add(null,'Title screen audio');
  // characters
  (project.characters||[]).forEach(c=>{ if(c.media===key) add(null,'Character "'+(c.name||'?')+'" portrait');
    (c.portraits||[]).forEach(p=>{ if(p.media===key||p.mediaRaw===key) add(null,'Character "'+(c.name||'?')+'" state "'+(p.name||'?')+'"'); }); });
  // scenes
  Object.values(scenes).forEach(s=>{
    if(s.bg&&s.bg.media===key) add(s.id,'Background of "'+(s.title||'scene')+'"');
    if(s.music&&s.music.media===key) add(s.id,'Audio of "'+(s.title||'scene')+'"');
    if(s.devNote&&Array.isArray(s.devNote.media)&&s.devNote.media.some(m=>m.media===key)) add(s.id,'Dev note in "'+(s.title||'scene')+'"');
    (s.lines||[]).forEach((l,li)=>{
      if(l.portrait&&l.portrait.media===key) add(s.id,'Portrait, line '+(li+1)+' of "'+(s.title||'scene')+'"');
      if(l.doc&&l.doc.media===key) add(s.id,'Document, line '+(li+1)+' of "'+(s.title||'scene')+'"');
      (l.sfx||[]).forEach(sf=>{ if(sf.media===key) add(s.id,'Sound, line '+(li+1)+' of "'+(s.title||'scene')+'"'); });
    });
  });
  return hits;
}
function allUsedMedia(){
  const used=new Set();
  Object.keys(project.media||{}).forEach(k=>{ if(mediaUsage(k).length) used.add(k); });
  return used;
}
function charUsage(cid){
  const hits=[];
  Object.values(scenes).forEach(s=>{ if((s.cast||[]).some(c=>c.charId===cid)) hits.push({sceneId:s.id,label:'Staged in "'+(s.title||'scene')+'"'}); });
  return hits;
}
function varUsage(vid){
  const hits=[];
  Object.values(scenes).forEach(s=>{ (s.choices||[]).forEach((c,ci)=>{
    const where='choice '+(ci+1)+' of "'+(s.title||'scene')+'"';
    if((c.effects||[]).some(e=>e.var===vid)) hits.push({sceneId:s.id,label:'Effect in '+where});
    if(c.condition&&c.condition.var===vid) hits.push({sceneId:s.id,label:'Condition on '+where});
    if((c.routes||[]).some(r=>r.var===vid)) hits.push({sceneId:s.id,label:'Branch in '+where});
    if(c.dice&&c.dice.modVar===vid) hits.push({sceneId:s.id,label:'Dice modifier in '+where});
  }); });
  return hits;
}
function usageListHtml(hits){
  if(!hits.length) return '<div class="hint">Not used anywhere yet.</div>';
  return '<div class="use-list">'+hits.map(h=>`<button class="use-item" ${h.sceneId?`onclick="warpToScene('${h.sceneId}')"`:''} ${h.sceneId?'':'disabled'}>${escHtml(h.label)}${h.sceneId?' <span class="use-go">go</span>':''}</button>`).join('')+'</div>';
}
