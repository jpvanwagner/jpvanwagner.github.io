/* ============================================================================
   Scenemaker editor; Find in Project (+ optional Replace)
   A project-wide search (Ctrl/Cmd+F, or Edit menu), across every layer at
   once: scene titles, dialogue text, speaker-name overrides, choice labels,
   and both kinds of developer notes (#47). A branching story with dozens of
   scenes has no other way to locate "which scene says that line" short of
   scrolling the whole node graph by eye - this is the fix. Clicking a result
   switches to its layer if needed, expands its scene if collapsed, and opens
   it in the Properties panel (reusing selectLineProp/selectChoiceProp/
   selectSceneProp, which already handle scrolling it into view).
   A collapsed-by-default "Replace" row lets the same search rename a
   recurring character mention or fix a repeated typo in one field at a time
   (its own "replace" button per result) or everywhere at once ("Replace
   all", confirmed first since it's a real bulk edit - still just one undo
   step away like everything else here). Shares core.js scope.
   ==========================================================================*/
let _fpLastMatches = [];
let _fpLastQuery = '';

/* ---- pure helpers (testable without a real project/DOM) ------------------ */
function fpMatch(text, q){ return !!(text && q && String(text).toLowerCase().indexOf(String(q).toLowerCase())!==-1); }
/* first match, with a little surrounding context on each side for a
   readable result row; null if there's no match at all. */
function fpSnippet(text, q, radius){
  radius = radius || 40;
  if(!text || !q) return null;
  const hay = String(text), idx = hay.toLowerCase().indexOf(String(q).toLowerCase());
  if(idx < 0) return null;
  const start = Math.max(0, idx-radius), end = Math.min(hay.length, idx+String(q).length+radius);
  return {
    pre: (start>0?'…':'') + hay.slice(start, idx),
    hit: hay.slice(idx, idx+String(q).length),
    post: hay.slice(idx+String(q).length, end) + (end<hay.length?'…':'')
  };
}
/* every case-insensitive occurrence of q in text replaced with `replacement`
   (a literal string, not a regex pattern - q is user free text, so its own
   regex-special characters are escaped first). Text/query missing is a
   no-op, same as fpMatch/fpSnippet. */
function fpReplaceInText(text, q, replacement){
  if(!text || !q) return text;
  const esc = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).replace(new RegExp(esc, 'gi'), replacement==null?'':replacement);
}
/* how many times q actually occurs in text - a field can contain the query
   more than once (e.g. a name said twice in one line), so this is NOT the
   same number as how many result rows/fields matched; used so "replace all"
   can honestly say how much text it's about to touch, not just how many
   fields. */
function fpCountOccurrences(text, q){
  if(!text || !q) return 0;
  const esc = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = String(text).match(new RegExp(esc, 'gi'));
  return m ? m.length : 0;
}
/* the actual search: every scene title, line (text/speaker override/note),
   choice label, and scene dev-note, across every layer (scenesObj is the
   flat { id: scene } map, same shape as the real `scenes` global - passed
   in rather than read directly so this stays a pure, independently
   testable function). Order: title, then lines top-to-bottom, then choices,
   then the scene's own dev note, scene by scene in object key order. */
function fpSearchScenes(scenesObj, q){
  const out = [];
  if(!q) return out;
  Object.values(scenesObj||{}).forEach(function(n){
    if(fpMatch(n.title, q)) out.push({sceneId:n.id, kind:'title', snippet:fpSnippet(n.title, q)});
    (n.lines||[]).forEach(function(l){
      if(fpMatch(l.text, q)) out.push({sceneId:n.id, lineId:l.id, kind:'line', snippet:fpSnippet(l.text, q)});
      if(fpMatch(l.speaker, q)) out.push({sceneId:n.id, lineId:l.id, kind:'speaker', snippet:fpSnippet(l.speaker, q)});
      if(fpMatch(l.note, q)) out.push({sceneId:n.id, lineId:l.id, kind:'note', snippet:fpSnippet(l.note, q)});
    });
    (n.choices||[]).forEach(function(c){
      if(fpMatch(c.text, q)) out.push({sceneId:n.id, choiceId:c.id, kind:'choice', snippet:fpSnippet(c.text, q)});
    });
    if(n.devNote && fpMatch(n.devNote.text, q)) out.push({sceneId:n.id, kind:'devnote', snippet:fpSnippet(n.devNote.text, q)});
  });
  return out;
}
const FP_KIND_LABEL = { title:'Scene title', line:'Dialogue', speaker:'Speaker name', note:'Line note', devnote:'Scene dev note', choice:'Choice' };

/* ---- read/write the one field a match came from - the shared plumbing
   both the jump-to-result click and the replace buttons need, kept in one
   place so they can never drift out of sync with fpSearchScenes() above. */
function fpGetField(m){
  const n=scenes[m.sceneId]; if(!n) return null;
  if(m.kind==='title') return n.title;
  if(m.kind==='devnote') return n.devNote ? n.devNote.text : null;
  if(m.kind==='line' || m.kind==='speaker' || m.kind==='note'){
    const l=(n.lines||[]).find(function(x){ return x.id===m.lineId; }); if(!l) return null;
    return m.kind==='line' ? l.text : (m.kind==='speaker' ? l.speaker : l.note);
  }
  if(m.kind==='choice'){
    const c=(n.choices||[]).find(function(x){ return x.id===m.choiceId; }); return c ? c.text : null;
  }
  return null;
}
function fpSetField(m, value){
  const n=scenes[m.sceneId]; if(!n) return false;
  if(m.kind==='title'){ n.title=value; return true; }
  if(m.kind==='devnote'){ if(!n.devNote) return false; n.devNote.text=value; return true; }
  if(m.kind==='line' || m.kind==='speaker' || m.kind==='note'){
    const l=(n.lines||[]).find(function(x){ return x.id===m.lineId; }); if(!l) return false;
    if(m.kind==='line') l.text=value; else if(m.kind==='speaker') l.speaker=value; else l.note=value;
    return true;
  }
  if(m.kind==='choice'){
    const c=(n.choices||[]).find(function(x){ return x.id===m.choiceId; }); if(!c) return false;
    c.text=value; return true;
  }
  return false;
}

/* ---- modal shell ---------------------------------------------------------*/
function openFindProject(){
  let bg=document.getElementById('find-project');
  if(!bg){ bg=document.createElement('div'); bg.id='find-project'; bg.className='modal-bg hidden';
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('find-project', 'Find in Project') : '';
    bg.innerHTML=`<div class="modal-card big"><h2>🔎 Find in Project${detachIco}</h2>
      <div class="modal-body">
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input type="text" id="fp-input" style="flex:1;box-sizing:border-box;background:var(--field);border:1px solid var(--line);color:var(--ink);padding:8px 10px;border-radius:5px;font-size:14px;outline:none" placeholder="Search scene titles, dialogue, choices, notes…" oninput="fpRunSearch()" onkeydown="fpKey(event)">
          <button class="mini-btn" onclick="fpToggleReplace()" title="Also replace what you find">⇄ Replace</button>
        </div>
        <div id="fp-replace-row" class="hidden" style="display:flex;gap:6px;margin-bottom:8px">
          <input type="text" id="fp-replace" style="flex:1;box-sizing:border-box;background:var(--field);border:1px solid var(--line);color:var(--ink);padding:8px 10px;border-radius:5px;font-size:14px;outline:none" placeholder="Replace with…" oninput="fpSyncReplaceAllState()">
          <button class="tb-btn tb-emerald" id="fp-replace-all-btn" onclick="fpReplaceAll()" disabled>Replace all</button>
        </div>
        <div id="fp-results"></div>
      </div>
      <div class="modal-foot"><button class="tb-btn tb-slate" onclick="closeFindProject()">Close</button></div></div>`;
    document.body.appendChild(bg);
  }
  bg.classList.remove('hidden');
  const input=document.getElementById('fp-input'); if(input) input.value='';
  const replace=document.getElementById('fp-replace'); if(replace) replace.value='';
  document.getElementById('fp-replace-row').classList.add('hidden');
  _fpLastMatches=[]; _fpLastQuery='';
  const box=document.getElementById('fp-results');
  if(box) box.innerHTML='<div class="hint">Type to search across every scene, line, choice, and note in the whole project (every layer).</div>';
  setTimeout(function(){ if(input) input.focus(); }, 30);
}
function closeFindProject(){ const bg=document.getElementById('find-project'); if(bg) bg.classList.add('hidden'); }
function fpToggleReplace(){
  const row=document.getElementById('fp-replace-row'); if(!row) return;
  row.classList.toggle('hidden');
  if(!row.classList.contains('hidden')) setTimeout(function(){ const r=document.getElementById('fp-replace'); if(r) r.focus(); }, 10);
}
function fpKey(e){
  if(e.key==='Escape'){ closeFindProject(); return; }
  if(e.key==='Enter'){ const first=document.querySelector('#fp-results .fp-row'); if(first) first.click(); }
}
function fpSyncReplaceAllState(){
  const btn=document.getElementById('fp-replace-all-btn'); if(!btn) return;
  btn.disabled = !_fpLastMatches.length;
}

/* ---- results ---------------------------------------------------------- */
function fpRunSearch(){
  const q=((document.getElementById('fp-input')||{}).value||'').trim();
  _fpLastQuery = q;
  const box=document.getElementById('fp-results'); if(!box) return;
  if(!q){ _fpLastMatches=[]; box.innerHTML='<div class="hint">Type to search across every scene, line, choice, and note in the whole project (every layer).</div>'; fpSyncReplaceAllState(); return; }
  const matches=fpSearchScenes(scenes, q);
  _fpLastMatches = matches;
  fpSyncReplaceAllState();
  if(!matches.length){ box.innerHTML='<div class="hint">No matches.</div>'; return; }
  box.innerHTML = matches.map(function(m, i){
    const n=scenes[m.sceneId]; if(!n) return '';
    const onOtherLayer = (typeof sceneLayer==='function' && sceneLayer(n)!==currentLayerId);
    const layerTag = onOtherLayer ? ' <span class="hint">('+escHtml((typeof layerName==='function'?layerName(sceneLayer(n)):'other layer'))+')</span>' : '';
    const snip = m.snippet ? (escHtml(m.snippet.pre)+'<mark>'+escHtml(m.snippet.hit)+'</mark>'+escHtml(m.snippet.post)) : '';
    return '<div class="fp-row" onclick="fpJumpTo(\''+m.sceneId+'\','+(m.lineId?('\''+m.lineId+'\''):'null')+','+(m.choiceId?('\''+m.choiceId+'\''):'null')+')">'
      + '<div class="hint" style="margin-bottom:2px;display:flex;align-items:center;gap:6px"><span style="flex:1">'+escHtml(n.title||'Untitled')+layerTag+' · '+(FP_KIND_LABEL[m.kind]||m.kind)+'</span>'
      + '<button class="mini-btn" onclick="event.stopPropagation();fpReplaceRow('+i+')" title="Replace just this occurrence">replace</button></div>'
      + '<div style="font-size:13px">'+snip+'</div></div>';
  }).join('');
}
function fpJumpTo(sceneId, lineId, choiceId){
  const n=scenes[sceneId]; if(!n) return;
  closeFindProject();
  if(typeof sceneLayer==='function' && typeof switchLayer==='function' && sceneLayer(n)!==currentLayerId) switchLayer(sceneLayer(n));
  if(n.collapsed){ n.collapsed=false; renderScenes(); }
  if(lineId && typeof selectLineProp==='function') selectLineProp(sceneId, lineId);
  else if(choiceId && typeof selectChoiceProp==='function') selectChoiceProp(sceneId, choiceId);
  else if(typeof selectSceneProp==='function') selectSceneProp(sceneId);
}

/* ---- replace --------------------------------------------------------- */
function fpReplaceRow(i){
  const m=_fpLastMatches[i]; if(!m) return;
  const replacement=(document.getElementById('fp-replace')||{}).value||'';
  const cur=fpGetField(m); if(cur==null) return;
  const occCount=fpCountOccurrences(cur,_fpLastQuery);
  pushUndo();
  fpSetField(m, fpReplaceInText(cur, _fpLastQuery, replacement));
  renderScenes();
  toast('Replaced '+occCount+' occurrence'+(occCount===1?'':'s'));
  fpRunSearch();
}
function fpReplaceAll(){
  if(!_fpLastMatches.length) return;
  const replacement=(document.getElementById('fp-replace')||{}).value||'';
  const q=_fpLastQuery, targets=_fpLastMatches.slice();
  // a field can contain the query more than once (the same name said twice
  // in one line), so "occurrences" is the sum of real hits, not just how
  // many fields matched - the confirm text should never undersell how much
  // text is about to change.
  const occCount=targets.reduce(function(sum,m){ const cur=fpGetField(m); return sum+(cur!=null?fpCountOccurrences(cur,q):0); },0);
  const doIt=function(){
    pushUndo();
    targets.forEach(function(m){ const cur=fpGetField(m); if(cur!=null) fpSetField(m, fpReplaceInText(cur, q, replacement)); });
    renderScenes();
    toast('Replaced '+occCount+' occurrence'+(occCount===1?'':'s'));
    fpRunSearch();
  };
  const msg='Replace all '+occCount+' occurrence'+(occCount===1?'':'s')+' of "'+q+'" with "'+replacement+'"?';
  if(typeof uiConfirm==='function') uiConfirm(msg, doIt, {yes:'Replace all', no:'Cancel'});
  else doIt();
}
