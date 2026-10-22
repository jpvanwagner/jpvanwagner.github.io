/* ============================================================================
   Scenemaker editor; in-game tools & dev notes  (features #4-#9)
   Editor UI for the player's on-screen tool bar (fullscreen / screenshot /
   settings menu / backlog) and per-scene developer notes. Shares core.js scope.
   ==========================================================================*/
function ensureHud(){ const st=project.settings; if(!st.hud) st.hud={};
  const d={fullscreen:false,screenshot:false,settingsMenu:false,backlog:false,backlogEffects:false,devNotes:false,
    backlogResetOnReplay:false,backlogClearOnEnding:false};
  Object.keys(d).forEach(k=>{ if(st.hud[k]==null) st.hud[k]=d[k]; }); return st.hud; }

function openHudSettings(){ const h=ensureHud();
  const g=id=>document.getElementById(id);
  if(g('h-fullscreen'))  g('h-fullscreen').checked  = !!h.fullscreen;
  if(g('h-screenshot'))  g('h-screenshot').checked  = !!h.screenshot;
  if(g('h-settingsmenu'))g('h-settingsmenu').checked = !!h.settingsMenu;
  if(g('h-backlog'))     g('h-backlog').checked     = !!h.backlog;
  if(g('h-backlogfx'))   g('h-backlogfx').checked   = !!h.backlogEffects;
  if(g('h-backlogresetreplay')) g('h-backlogresetreplay').checked = !!h.backlogResetOnReplay;
  if(g('h-backlogclearend'))    g('h-backlogclearend').checked    = !!h.backlogClearOnEnding;
  if(g('h-devnotes'))    g('h-devnotes').checked    = !!h.devNotes;
  if(!project.settings.cursorSound) project.settings.cursorSound={enabled:false,media:null};
  if(g('h-cursorsound')) g('h-cursorsound').checked = !!project.settings.cursorSound.enabled;
  if(typeof refreshCursorSoundUI==='function') refreshCursorSoundUI();
}
function setHud(key,on){ ensureHud(); project.settings.hud[key]=!!on; }
// separate from setHud() (a different settings sub-object, project.settings.
// cursorSound, so the media-picker functions above have one place to init it).
function setCursorSoundEnabled(on){ if(!project.settings.cursorSound) project.settings.cursorSound={enabled:false,media:null}; project.settings.cursorSound.enabled=!!on; }

/* ---- per-scene developer notes ----------------------------------------- */
function ensureDevNote(n){ if(!n.devNote) n.devNote={text:'',media:[]}; if(!Array.isArray(n.devNote.media)) n.devNote.media=[]; return n.devNote; }
function devNoteHtml(n){ const d=ensureDevNote(n);
  return `<div class="sec"><h3>Developer note <span class="hint" style="font-weight:400">(shown in-game only if dev notes are enabled)</span></h3>
    <div class="hint" style="margin-bottom:6px">A note-to-self reminder, or director's commentary for players. Attach images / audio / video too.</div>
    <textarea class="dn-text" rows="3" style="width:100%" placeholder="e.g. TODO: revise this line / Director: we recorded this at 2am…" oninput="setDevNoteText('${n.id}',this.value)">${escHtml(d.text||'')}</textarea>
    <div id="dn-media-${n.id}">${d.media.map((m,i)=>dnMediaRow(n.id,m,i)).join('')}</div>
    <div style="display:flex;gap:6px;margin-top:6px">
      <button class="mini-btn" onclick="addDevNoteMedia('${n.id}','image')" title="Attach an image">+ image</button>
      <button class="mini-btn" onclick="addDevNoteMedia('${n.id}','audio')" title="Attach audio">+ audio</button>
      <button class="mini-btn" onclick="addDevNoteMedia('${n.id}','video')" title="Attach video">+ video</button>
    </div></div>`;
}
function dnMediaRow(id,m,i){ return `<div class="mini-row"><span class="hint">${m.type}${m.media?' ✓':''}</span>
    <input placeholder="label (optional)" value="${escAttr(m.label||'')}" oninput="setDevNoteMedia('${id}',${i},'label',this.value)">
    <span class="row-x" title="Remove" onclick="delDevNoteMedia('${id}',${i})">✕</span></div>`; }
function setDevNoteText(id,v){ const n=scenes[id]; if(n){ ensureDevNote(n).text=v; } }
function addDevNoteMedia(id,type){ const n=scenes[id]; if(!n) return; ensureDevNote(n);
  pickMedia(type==='image'?'image':(type==='video'?'video':'audio')).then(k=>{ if(k){ pushUndo(); n.devNote.media.push({type,media:k,label:''}); refreshDevNoteMedia(id); toast('Attached to dev note'); } }); }
function setDevNoteMedia(id,i,f,v){ const n=scenes[id]; if(n&&n.devNote&&n.devNote.media[i]) n.devNote.media[i][f]=v; }
function delDevNoteMedia(id,i){ const n=scenes[id]; if(n&&n.devNote){ pushUndo(); n.devNote.media.splice(i,1); refreshDevNoteMedia(id); } }

/* ---- per-LINE developer notes (#47) --------------------------------------
   A lighter-weight sibling to the scene-level note above: plain text only
   (no media attachments) since this sits on every single line's already-
   busy card, and collapsed by default behind a small toggle so it costs
   nothing until you actually want one. Shown in-game via the SAME "show
   developer notes" toggle the scene-level note already uses; when the
   player is on a line that has its own note, that note wins over the
   scene's (more specific beats more general), otherwise the scene note
   still shows exactly as before. */
// tri-state per line: undefined (never explicitly toggled - follow whether
// there's actually text), true/false (explicitly opened/closed, which wins
// regardless of text) - so a note box can be collapsed back down even once
// it holds text, instead of being stuck open forever the moment you type
// anything into it.
let _lineNoteOpen={};
function _lineNoteEffectiveOpen(l){ const has=!!(l.note&&l.note.trim()); const ex=_lineNoteOpen[l.id]; return ex!==undefined?ex:has; }
// the toggle button/box are shared verbatim between the scene card
// (lineHtml(), hidden behind compact-card mode's line-fontdoc row) and the
// Properties panel's own separately-templated line view (_propLine(), the
// one actually visible by default since compact cards are on by default) -
// refresh whichever of those is currently showing this exact line, not just
// whichever one the click happened to come from.
function toggleLineNote(lid){
  const n=Object.values(scenes).find(s=>(s.lines||[]).some(l=>l.id===lid)); const l=n&&n.lines.find(l=>l.id===lid); if(!l) return;
  _lineNoteOpen[lid]=!_lineNoteEffectiveOpen(l);
  renderScenes();
  if(typeof _propSel!=='undefined' && _propSel && _propSel.kind==='line' && _propSel.lineId===lid && typeof renderPropsPanel==='function') renderPropsPanel();
}
// split in two (rather than one block) so the caller can put the compact
// toggle button inline with the line's other buttons, and the textarea (once
// opened) on its own full-width row below - a textarea can't usefully share
// a flex row with a handful of small buttons.
function lineNoteToggleHtml(l){
  const has=!!(l.note&&l.note.trim());
  return `<button class="mini-btn${has?' active':''}" onclick="toggleLineNote('${l.id}')" title="A quick note-to-self for this line, shown in-game only if dev notes are enabled">📝 note${has?' ✓':''}</button>`;
}
// idPrefix keeps the scene-card copy ('ln-') and the Properties panel copy
// ('pln-') as two distinct elements with their own ids - same convention as
// the main dialogue textarea's ta-/pta- pair - so setLineNoteText() below
// can push a live edit from one straight into the other's .value without a
// full re-render (which would drop focus/cursor position mid-typing).
function lineNoteBoxHtml(n,l,idPrefix){
  if(!_lineNoteEffectiveOpen(l)) return '';
  return `<textarea id="${idPrefix}${l.id}" class="dn-text" rows="2" style="width:100%" placeholder="e.g. TODO: revise this line…" oninput="setLineNoteText('${n.id}','${l.id}',this.value)">${escHtml(l.note||'')}</textarea>`;
}
// mirrors the main dialogue textarea's own cross-sync (props copy pushes
// into the scene-card copy on every keystroke; the scene card is compact-
// hidden by default so that's the direction that actually matters).
function setLineNoteText(sid,lid,v){
  const n=scenes[sid]; const l=n&&n.lines.find(x=>x.id===lid); if(l) l.note=v;
  const other=document.getElementById('ln-'+lid); if(other && other.value!==v) other.value=v;
}
function refreshDevNoteMedia(id){ const box=document.getElementById('dn-media-'+id); const n=scenes[id];
  if(box&&n&&n.devNote) box.innerHTML=n.devNote.media.map((m,i)=>dnMediaRow(id,m,i)).join(''); }
