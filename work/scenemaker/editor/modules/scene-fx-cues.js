/* ============================================================================
   Scenemaker editor; animated effect cues  (feature #2)
   Author one-shot effects (flash, shake, glitch, static;) tied to scene
   start/end and to a line's start/end or a specific word. Shares core.js scope.
   ==========================================================================*/
const FX_CUE_EFFECTS = [
  ['flash','Light flash'],['whiteflash','White flash'],['redflash','Red flash'],['blueflash','Blue flash'],
  ['lightning','Lightning'],['shake','Screen shake'],['bigshake','Big shake'],['rumble','Rumble'],
  ['glitch','Glitch burst'],['chromatic','Chromatic split'],['static','TV static'],['zoompunch','Zoom punch'],
  ['blurpulse','Blur pulse'],['invert','Invert flash'],['fadeblack','Fade to black'],['fadewhite','Fade to white'],
  ['vignettepulse','Vignette pulse'],['ripple','Ripple'],
  // Celebration / bad-choice effects: a direct owner request for something
  // "confetti or fireworks... or a big red X vs big green check" for
  // reaching specific endings or making specific choices. These reuse this
  // exact cue mechanism (scene start/end already covers "reaching an
  // ending"; see core.js's choiceLogicHtml() for the matching per-choice
  // "when this choice is picked" field) rather than inventing a parallel
  // trigger system, and are also the only cue effects the embeddable HTML
  // export ports over (lite-export.js's LITE_FX_TYPES), so both the full
  // player and the lightweight export share one definition of what each
  // effect looks like.
  ['confetti','Confetti burst'],['fireworks','Fireworks'],['goodcheck','Big green check'],['badx','Big red X']
];
function _fxEffOptions(sel){ return FX_CUE_EFFECTS.map(e=>`<option value="${e[0]}" ${sel===e[0]?'selected':''}>${e[1]}</option>`).join(''); }

/* scene-level cues (start / end of the scene) */
function sceneCuesHtml(n){
  if(!Array.isArray(n.cues)) n.cues=[];
  const rows=n.cues.map((c,i)=>`<div class="mini-row">
    <select onchange="setSceneCue('${n.id}',${i},'on',this.value)"><option value="start" ${c.on==='start'?'selected':''}>scene starts</option><option value="end" ${c.on==='end'?'selected':''}>scene ends</option></select>
    <select onchange="setSceneCue('${n.id}',${i},'effect',this.value)">${_fxEffOptions(c.effect)}</select>
    <span class="row-x" onclick="delSceneCue('${n.id}',${i})" title="Remove">✕</span></div>`).join('');
  return `<div class="sec"><h3>Scene effect cues</h3><div class="hint" style="margin-bottom:5px">Play an animated effect when this scene starts or ends.</div>
    ${rows}<button class="mini-btn" onclick="addSceneCue('${n.id}')" title="Add an effect cue">+ effect cue</button></div>`;
}
function addSceneCue(id){ const n=scenes[id]; if(!n.cues)n.cues=[]; pushUndo(); n.cues.push({on:'start',effect:'flash',intensity:5}); renderPropsPanel(); }
function setSceneCue(id,i,f,v){ const n=scenes[id]; if(n.cues&&n.cues[i]) n.cues[i][f]=v; }
function delSceneCue(id,i){ const n=scenes[id]; if(n.cues){ pushUndo(); n.cues.splice(i,1); renderPropsPanel(); } }

/* line-level cues (start / end / on a word) */
function lineCuesHtml(n,l){
  if(!Array.isArray(l.vfx)) l.vfx=[];
  const rows=l.vfx.map((c,i)=>`<div class="mini-row" style="flex-wrap:wrap">
    <select onchange="setLineCue('${n.id}','${l.id}',${i},'on',this.value)"><option value="start" ${c.on==='start'?'selected':''}>line starts</option><option value="end" ${c.on==='end'?'selected':''}>line ends</option><option value="word" ${c.on==='word'?'selected':''}>on word</option></select>
    ${c.on==='word'?`<input placeholder="word" value="${escAttr(c.word||'')}" oninput="setLineCue('${n.id}','${l.id}',${i},'word',this.value)" style="width:90px">`:''}
    <select onchange="setLineCue('${n.id}','${l.id}',${i},'effect',this.value)">${_fxEffOptions(c.effect)}</select>
    <span class="row-x" onclick="delLineCue('${n.id}','${l.id}',${i})" title="Remove">✕</span></div>`).join('');
  return `<div class="sec"><h3>Line effect cues</h3><div class="hint" style="margin-bottom:5px">Fire an effect at the start/end of this line, or when a word is typed.</div>
    ${rows}<button class="mini-btn" onclick="addLineCue('${n.id}','${l.id}')" title="Add an effect cue">+ effect cue</button></div>`;
}
function addLineCue(sid,lid){ const l=scenes[sid].lines.find(x=>x.id===lid); if(!l.vfx)l.vfx=[]; pushUndo(); l.vfx.push({on:'start',effect:'flash',word:'',intensity:5}); renderPropsPanel(); }
function setLineCue(sid,lid,i,f,v){ const l=scenes[sid].lines.find(x=>x.id===lid); if(l&&l.vfx&&l.vfx[i]){ l.vfx[i][f]=v; if(f==='on') renderPropsPanel(); } }
function delLineCue(sid,lid,i){ const l=scenes[sid].lines.find(x=>x.id===lid); if(l&&l.vfx){ pushUndo(); l.vfx.splice(i,1); renderPropsPanel(); } }
