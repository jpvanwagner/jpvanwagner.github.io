/* ============================================================================
   Scenemaker editor; Properties panel  (feature #7)
   A context-sensitive dock (right side, on by default). Select a scene, a line,
   or an on-stage face and edit its properties here; keeping the scene cards on
   the canvas clean. Shares core.js scope.
   ==========================================================================*/
let _propSel=null; // {kind:'scene'|'line'|'cast', sceneId, lineId?, castId?}

function selectSceneProp(sceneId){ _propSel={kind:'scene',sceneId}; _propReflect(); }
function selectLineProp(sceneId,lineId){ _propSel={kind:'line',sceneId,lineId}; _propReflect(); }
function selectCastProp(sceneId,castId){ _propSel={kind:'cast',sceneId,castId}; _propReflect(); }
function selectChoiceProp(sceneId,choiceId){ _propSel={kind:'choice',sceneId,choiceId}; if(typeof logicCtx!=='undefined'){ logicCtx={sceneId,choiceId}; } _propReflect(); }
function selectGroupProp(gid){ _propSel={kind:'group',gid}; _propReflect(); }
function _propReflect(){ if(typeof maybeShowMini==='function') maybeShowMini('props'); if(typeof applyPropsVisibility==='function') applyPropsVisibility(); if(typeof openDock==='function'){ const st=(typeof dockState==='function')?dockState('props'):null; if(st&&!st.open) openDock('props'); } renderPropsPanel(); if(typeof refreshSbCoords==='function') refreshSbCoords();
  document.querySelectorAll('.prop-selected').forEach(e=>e.classList.remove('prop-selected'));
  if(_propSel){ const id=_propSel.kind==='cast'?('cast-'+_propSel.castId):(_propSel.kind==='line'?('line-'+_propSel.lineId):_propSel.sceneId);
    const el=document.getElementById(id)||document.querySelector('[data-line="'+(_propSel.lineId||'')+'"]'); if(el) el.classList.add('prop-selected');
    const boxId = _propSel.kind==='group' ? _propSel.gid : _propSel.sceneId;
    if(boxId && typeof scrollPastPropsPanel==='function') setTimeout(()=>scrollPastPropsPanel(boxId), 0);
    // remember what you were last working on so re-opening this project
    // lands you back there instead of the far upper-left (#2)
    if(_propSel.sceneId && scenes[_propSel.sceneId]) project.meta.lastEditScene=_propSel.sceneId; } }
/* #3: the docked Properties panel can overlap whatever's selected on the
   canvas (e.g. a scene near the right edge, under a right-docked panel).
   Nudge the workspace scroll so the selected element clears the panel
   instead of sitting hidden underneath it. */
function scrollPastPropsPanel(elId){
  const el=document.getElementById(elId); const panel=document.getElementById('panel-props');
  const ws=document.getElementById('workspace');
  if(!el || !panel || !ws) return;
  const pRect=panel.getBoundingClientRect();
  if(pRect.width===0 || pRect.height===0) return; // panel closed/collapsed
  const eRect=el.getBoundingClientRect();
  const vOverlap = eRect.bottom>pRect.top && eRect.top<pRect.bottom;
  if(!vOverlap) return;
  const margin=24;
  const panelOnRight = pRect.left > window.innerWidth/2;
  if(panelOnRight && eRect.right>pRect.left) ws.scrollLeft += (eRect.right-pRect.left+margin);
  else if(!panelOnRight && eRect.left<pRect.right) ws.scrollLeft += (eRect.left-pRect.right-margin);
}

function propsVisMode(){ return (typeof ToolSettings!=='undefined') ? ToolSettings.get('propsAutoHide','hide') : 'hide'; }
function setPropsAutoHide(mode){ if(typeof ToolSettings!=='undefined') ToolSettings.set('propsAutoHide', mode); applyPropsVisibility(); }
function applyPropsVisibility(){
  const mode=propsVisMode(); const st=(typeof dockState==='function')?dockState('props'):null; if(!st) return;
  const hasSel=!!(_propSel && scenes[_propSel.sceneId]);
  if(hasSel){ if(!st.open){ st.open=true; if(st.collapsed)st.collapsed=false; dockSave('props',st); applyDock('props'); if(typeof layoutDocks==='function')layoutDocks(); } return; }
  if(mode==='show') return;
  if(mode==='collapse'){ if(st.open && !st.collapsed){ st.collapsed=true; dockSave('props',st); applyDock('props'); } }
  else { if(st.open){ st.open=false; dockSave('props',st); applyDock('props'); if(typeof layoutDocks==='function')layoutDocks(); } }
}
function clearPropsSelection(){ _propSel=null; applyPropsVisibility(); if(typeof refreshSbCoords==='function') refreshSbCoords(); }
function renderPropsPanel(){
  const box=document.getElementById('props-list'); if(!box) return;
  if(_propSel && _propSel.kind==='multi'){ if(typeof _propMulti==='function') return _propMulti(box); }
  if(_propSel && _propSel.kind==='group'){ if(backdrops[_propSel.gid]) return _propGroup(box, backdrops[_propSel.gid]); }
  if(!_propSel || !scenes[_propSel.sceneId]){ box.innerHTML='<div class="hint">Select a scene header, a group, a line, or an on-stage face on the stage to edit its properties here.</div>'; return; }
  const n=scenes[_propSel.sceneId];
  if(_propSel.kind==='line') return _propLine(box,n);
  if(_propSel.kind==='cast') return _propCast(box,n);
  if(_propSel.kind==='choice') return _propChoice(box,n);
  return _propScene(box,n);
}

function _propChoice(box,n){
  const c=(n.choices||[]).find(x=>x.id===_propSel.choiceId); if(!c){ box.innerHTML='<div class="hint">Choice not found.</div>'; return; }
  if(typeof logicCtx!=='undefined') logicCtx={sceneId:n.id,choiceId:c.id};
  box.innerHTML=`<div class="prop-h">Choice · ${escHtml(n.title||'scene')}</div>
    <div class="fld"><label>Choice text</label><input value="${escAttr(c.text||'')}" placeholder="Choice label" oninput="setChoice('${n.id}','${c.id}',this.value); if(typeof renderScenes==='function')renderScenes()" onblur="renderPropsPanel()"></div>
    <label class="chk"><input type="checkbox" ${c.continue?'checked':''} onchange="setChoiceContinue('${n.id}','${c.id}',this.checked)"> Plain continue (no label, goes straight on)</label>
    <div class="sec"><h3>Ask the player to type</h3>
      <label class="chk"><input type="checkbox" ${c.askInput?'checked':''} onchange="toggleAskInput('${n.id}','${c.id}',this.checked)"> When picked, prompt the player and save their typed text to a variable</label>
      ${c.askInput?`<div class="fld"><label>Save to variable</label><select onchange="setAskInput('${n.id}','${c.id}','var',this.value)">${typeof varOptions==='function'?varOptions(c.askInput.var):''}</select></div>
        <div class="fld"><label>Prompt shown to the player</label><input value="${escAttr(c.askInput.label||'')}" oninput="setAskInput('${n.id}','${c.id}','label',this.value)" placeholder="e.g. What is your name?"></div>
        <div class="hint">Recall it anywhere in dialogue (or a character\u2019s name) with <code>{{${(function(){var v=(project.variables||[]).find(x=>x.id===c.askInput.var);return v?v.name:'varName';})()}}}</code>.</div>`:''}
    </div>
    ${typeof choiceLogicHtml==='function'?choiceLogicHtml(c):''}`;
}
function toggleAskInput(sid,cid,on){ const c=scenes[sid].choices.find(x=>x.id===cid); if(!c)return; pushUndo(); if(on){ c.askInput={var:(project.variables[0]||{}).id||'',label:'Enter a value:'}; } else { delete c.askInput; } renderPropsPanel(); }
function setAskInput(sid,cid,f,v){ const c=scenes[sid].choices.find(x=>x.id===cid); if(c&&c.askInput){ c.askInput[f]=v; if(f==='var') renderPropsPanel(); } }
function setChoiceContinue(sid,cid,v){ const c=scenes[sid].choices.find(x=>x.id===cid); if(c){ pushUndo(); c.continue=!!v; renderScenes(); renderPropsPanel(); } }
function _propGroup(box,b){
  box.innerHTML=`<div class="prop-h">Group · ${escHtml(b.name||'group')}</div>
    <div class="fld"><label>Name</label><input value="${escAttr(b.name||'')}" oninput="updateBackdrop('${b.id}','name',this.value)"></div>
    <div class="fld"><label>Colour</label><div style="display:flex;gap:8px;align-items:center"><input type="color" value="${b.color||'#334155'}" oninput="setGroupColor('${b.id}',this.value); hexSyncFromColor(this)" style="width:44px;height:28px;padding:0;border:none;background:none;cursor:pointer">${hexFieldHtml(b.color||'#334155')}</div></div>
    <div class="prop-sub"><div class="media-slot"><span style="color:var(--mut)">Group audio</span>
      <button class="mini-btn" onclick="pickGroupMusic('${b.id}')">${(b.music&&b.music.media)?'change':'set'}</button>
      ${(b.music&&b.music.media)?`<button class="mini-btn warn" onclick="clearGroupMusic('${b.id}');renderPropsPanel()">clear</button>`:''}
      <span class="hint">${(b.music&&b.music.media)?'♪ set':'none'}</span></div></div>
    <div class="prop-sub"><h3>Group effects</h3>${typeof fxPickerHtml==='function'?fxPickerHtml(b.id):''}</div>
    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="mini-btn" onclick="shrinkGroupToFit('${b.id}')" title="Resize the group down to fit its scenes">⤡ Shrink to fit</button>
      <button class="mini-btn" onclick="toggleGroupCollapse('${b.id}')">${b.collapsed?'Expand':'Collapse'}</button>
      <button class="mini-btn" onclick="openCanvasEditor('${b.id}')">Canvas layout…</button>
      <button class="mini-btn warn" onclick="deleteBackdrop('${b.id}')">Delete group</button>
    </div>`;
}
function _propScene(box,n){
  const bg=n.bg||{type:'none'}, mu=n.music||{media:null};
  box.innerHTML=`<div class="prop-h">Scene · ${escHtml(n.title||'untitled')}</div>
    <div class="fld"><label>Title</label><input value="${escAttr(n.title||'')}" oninput="setTitle('${n.id}',this.value)"></div>
    <div class="fld"><label>Type</label><select onchange="setSceneMode('${n.id}',this.value)"><option value="dialogue" ${n.mode!=='cutscene'?'selected':''}>Dialogue</option><option value="cutscene" ${n.mode==='cutscene'?'selected':''}>Cutscene</option></select></div>
    <label class="chk"><input type="checkbox" ${n.locked?'checked':''} onchange="toggleSceneLock('${n.id}')"> Lock this scene\u2019s position on the grid</label>
    <div class="fld"><label>Card colour</label><div style="display:flex;gap:8px;align-items:center"><input type="color" value="${n.color||'#334155'}" oninput="setSceneColor('${n.id}',this.value); hexSyncFromColor(this)" style="width:44px;height:28px;padding:0;border:none;background:none;cursor:pointer">${hexFieldHtml(n.color||'#334155')}<button class="mini-btn" onclick="setSceneColor('${n.id}',null)">clear</button></div></div>
    <div class="prop-sub">
      ${bg.media
        ? `<div class="media-slot" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropSceneBg(event,'${n.id}')" title="Drop an image or video asset here to replace the background"><span style="color:var(--mut)">Background</span>
             <button class="mini-btn" onclick="pickBg('${n.id}')">change</button>
             <button class="mini-btn warn" onclick="clearBg('${n.id}')">clear</button>
             <span class="hint">✓ ${bg.type}</span></div>`
        : `<div class="media-slot media-slot-empty" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropSceneBg(event,'${n.id}')" title="Drop an image or video asset here to set it as the background"><button class="mini-btn" onclick="pickBg('${n.id}')" title="Add a background image or video">＋ background</button></div>`}
      <label class="chk" style="margin-top:5px" title="Stream this scene's audio live from a web address instead of an uploaded file - the only audio the embeddable HTML export can carry, since it ships no files of its own"><input type="checkbox" ${mu.source==='url'?'checked':''} onchange="setMusicSource('${n.id}',this.checked?'url':'local')"> Stream audio from a URL instead</label>
      ${mu.source==='url'
        ? `<div class="fld" style="margin-top:3px"><input type="text" placeholder="https://example.com/track.mp3" value="${escAttr(mu.url||'')}" oninput="setMusicUrl('${n.id}',this.value)"></div>`
        : (mu.media
          ? `<div class="media-slot" style="margin-top:5px" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropSceneMusic(event,'${n.id}')" title="Drop an audio asset here to replace it"><span style="color:var(--mut)">Audio</span>
               <button class="mini-btn" onclick="pickMusic('${n.id}')">change</button>
               <button class="mini-btn warn" onclick="clearMusic('${n.id}')">clear</button>
               <span class="hint">♪ set</span></div>`
          : `<div class="media-slot media-slot-empty" style="margin-top:5px" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropSceneMusic(event,'${n.id}')" title="Drop an audio asset here to set it as this scene's background audio"><button class="mini-btn" onclick="pickMusic('${n.id}')" title="Add background audio">＋ audio</button></div>`)}
      ${(bg.media||mu.media||mu.source==='url')&&typeof audioSettingsHtml==='function'?audioSettingsHtml(n):''}
    </div>
    ${typeof sceneCuesHtml==='function'?sceneCuesHtml(n):''}
    <div class="hint" style="margin-top:6px">Click a line or a staged face on the card to edit it here.</div>
    <div style="margin-top:8px"><button class="mini-btn" onclick="focusScene('${n.id}')">Full editor</button>
      <button class="mini-btn" onclick="openCanvasEditor('${n.id}')">Canvas layout…</button></div>`;
}

function _propLine(box,n){
  const l=(n.lines||[]).find(x=>x.id===_propSel.lineId); if(!l){ box.innerHTML='<div class="hint">Line not found.</div>'; return; }
  const hasCast=(n.cast||[]).length>0;
  const spkOpts = hasCast ? `<div class="fld"><label>Speaking face</label><select onchange="setLine('${n.id}','${l.id}','speakingCast',this.value);renderPropsPanel()">
      <option value="">; narrator / override;</option>
      ${n.cast.map(c=>{ const ch=(project.characters||[]).find(x=>x.id===c.charId); return `<option value="${c.id}" ${l.speakingCast===c.id?'selected':''}>${escHtml((ch&&ch.name)||c.name||'face')}</option>`; }).join('')}
    </select></div>` : '';
  box.innerHTML=`<div class="prop-h">Line · ${escHtml(n.title||'scene')}</div>
    ${spkOpts}
    <div class="fld"><label>Speaker name ${hasCast?'(override)':''}</label><input value="${escAttr(l.speaker||'')}" placeholder="${hasCast?'blank = use face name':'blank = narrator'}" oninput="setLine('${n.id}','${l.id}','speaker',this.value)"></div>
    <label class="chk" title="Renders as free-floating text with no speaker name or dialogue box - narrator commentary, off-screen dialogue, and the like. Dims the other on-stage portraits/text and the background by default (Canvas editor -> Narrator text)."><input type="checkbox" ${l.unattributed?'checked':''} onchange="setLine('${n.id}','${l.id}','unattributed',this.checked);renderPropsPanel()"> Unattributed (narrator text, no box)</label>
    <div class="prop-fmt">
      <button class="mini-btn" onmousedown="event.preventDefault()" onclick="fmtTa('pta-${l.id}','${n.id}','${l.id}','**','**')" title="Bold"><b>B</b></button>
      <button class="mini-btn" onmousedown="event.preventDefault()" onclick="fmtTa('pta-${l.id}','${n.id}','${l.id}','*','*')" title="Italic"><i>I</i></button>
      <button class="mini-btn" onmousedown="event.preventDefault()" onclick="fmtTa('pta-${l.id}','${n.id}','${l.id}','__','__')" title="Underline"><u>U</u></button>
      <button class="mini-btn" onmousedown="event.preventDefault()" onclick="fmtTa('pta-${l.id}','${n.id}','${l.id}','~~','~~')" title="Strikethrough"><s>S</s></button>
      <button class="mini-btn" onmousedown="event.preventDefault()" onclick="fmtTa('pta-${l.id}','${n.id}','${l.id}','[big]','[/big]')" title="Bigger">A+</button>
      <button class="mini-btn" onmousedown="event.preventDefault()" onclick="fmtTa('pta-${l.id}','${n.id}','${l.id}','[small]','[/small]')" title="Smaller">A-</button>
      <input type="color" id="pcol-${l.id}" value="#ff5555" title="Colour" style="width:26px;height:22px;padding:0;border:1px solid #475569;border-radius:4px;cursor:pointer" oninput="hexSyncFromColor(this)">${hexFieldHtml('#ff5555')}
      <button class="mini-btn" onmousedown="event.preventDefault()" onclick="fmtColorTa('pta-${l.id}','${n.id}','${l.id}','pcol-${l.id}')" title="Colour selection">color</button>
      <button class="mini-btn" onmousedown="event.preventDefault()" onclick="fmtLinkTa('pta-${l.id}','${n.id}','${l.id}')" title="Hyperlink selection">🔗</button>
    </div>
    <textarea id="pta-${l.id}" class="dialogue-text" style="min-height:90px" placeholder="What is said on this beat…" onkeydown="rtHotkey(event,'${n.id}','${l.id}','pta-${l.id}')" oninput="setLine('${n.id}','${l.id}','text',this.value);updatePreview('${l.id}',this.value);var t=document.getElementById('ta-${l.id}');if(t)t.value=this.value;var pv=document.getElementById('ppv-${l.id}');pv.innerHTML=renderRich(this.value);pv.style.display=hasRichMarkup(this.value)?'':'none'">${escHtml(l.text||'')}</textarea>
    <div id="ppv-${l.id}" class="prop-preview" style="${hasRichMarkup(l.text||'')?'':'display:none'}">${renderRich(l.text||'')}</div>
    <div class="prop-sub"><div class="line-top">
      <select class="mini-sel" title="Line font (blank = universal)" onchange="setLineFont('${n.id}','${l.id}',this.value)"><option value="">font: default</option>${(typeof FONT_OPTS!=='undefined'?FONT_OPTS:[]).map(fo=>`<option value="${fo}"${typeof fontOptionStyle==='function'?fontOptionStyle(fo):''} ${l.font===fo?'selected':''}>${fo}</option>`).join('')}</select>
      <button class="mini-btn" onclick="pickDoc('${n.id}','${l.id}')" title="Attach a handout/document shown on this line">${(l.doc&&l.doc.media)?'doc ✓':'+ doc'}</button>
      ${(l.doc&&l.doc.media)?`<button class="mini-btn warn" onclick="clearDoc('${n.id}','${l.id}');renderPropsPanel()">× doc</button>`:''}
      ${typeof lineNoteToggleHtml==='function'?lineNoteToggleHtml(l):''}
    </div>
    ${typeof lineNoteBoxHtml==='function'?lineNoteBoxHtml(n,l,'pln-'):''}</div>
    ${(n.cast&&n.cast.length&&typeof stageHtml==='function')?('<div class="prop-sub">'+stageHtml(n,l,'-props')+'</div>'):''}
    ${typeof lineTimingHtml==='function'?('<div class="prop-sub">'+lineTimingHtml(n,l)+'</div>'):''}
    ${typeof lineVoiceHtml==='function'?('<div class="prop-sub">'+lineVoiceHtml(n,l)+'</div>'):''}
    ${typeof lineSfxHtml==='function'?('<div class="prop-sub">'+lineSfxHtml(n,l)+'</div>'):''}
    ${typeof lineCuesHtml==='function'?lineCuesHtml(n,l):''}`;
}

function _propCast(box,n){
  const c=(n.cast||[]).find(x=>x.id===_propSel.castId); if(!c){ box.innerHTML='<div class="hint">Face not found.</div>'; return; }
  const lib=(project.characters||[]);
  const ch=lib.find(x=>x.id===c.charId);
  const stateOpts = (ch&&ch.portraits&&ch.portraits.length)
    ? `<div class="fld"><label>Default face state (per line)</label><div class="hint">Face states are chosen per line on the scene card (the state picker on each line).</div></div>` : '';
  box.innerHTML=`<div class="prop-h">Face · ${escHtml((ch&&ch.name)||c.name||'face')}</div>
    <div class="fld"><label>Who is this?</label>
      <select onchange="assignCastChar('${n.id}','${c.id}',this.value)">
        <option value="">; custom (not from library);</option>
        ${lib.map(x=>`<option value="${x.id}" ${c.charId===x.id?'selected':''}>${escHtml(x.name)}</option>`).join('')}
      </select></div>
    ${c.charId?'':`<div class="fld"><label>Name</label><input value="${escAttr(c.name||'')}" oninput="setCastField('${n.id}','${c.id}','name',this.value)"></div>`}
    <div class="rowflex">
      <div class="fld"><label>Enter</label><select onchange="setCastField('${n.id}','${c.id}','enter',this.value)">${['fade','slide','pop','none'].map(o=>`<option value="${o}" ${c.enter===o?'selected':''}>${o}</option>`).join('')}</select></div>
      <div class="fld"><label>Border</label><select onchange="setCastField('${n.id}','${c.id}','border',this.value)">${['none','soft','hard'].map(o=>`<option value="${o}" ${c.border===o?'selected':''}>${o}</option>`).join('')}</select></div>
    </div>
    ${ch?`<div class="rowflex">
      <div class="fld"><label>Portrait shape</label><select onchange="setCharPortrait('${ch.id}','portraitShape',this.value)" title="Overrides the canvas default for this character">${[['','(canvas default)'],['square','square'],['rounded','rounded'],['circle','circle']].map(o=>`<option value="${o[0]}" ${(ch.portraitShape||'')===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
      <div class="fld"><label>Image fit</label><select onchange="setCharPortrait('${ch.id}','portraitFit',this.value)">${[['','(canvas default)'],['contain','fits frame'],['cover','fill & crop'],['fill','stretch']].map(o=>`<option value="${o[0]}" ${(ch.portraitFit||'')===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
    </div>`:''}
    ${stateOpts}
    <div class="hint">Tip: a face\u2019s on-stage position (left/centre/right) and state are set per line, right on the scene card. Full character setup (portrait, sounds) lives in the <b>Characters</b> panel.</div>
    <div style="margin-top:8px"><button class="mini-btn" onclick="openCharacters()">Open Characters</button></div>`;
}
/* light setters used by the panel */
function setCharPortrait(charId,f,v){ const c=(project.characters||[]).find(x=>x.id===charId); if(c){ pushUndo(); c[f]=v; renderScenes(); renderPropsPanel(); } }
function setCastField(sid,cid,f,v){ const s=scenes[sid]; const c=(s.cast||[]).find(x=>x.id===cid); if(c){ pushUndo(); c[f]=v; renderScenes(); } }
function assignCastChar(sid,cid,charId){ const s=scenes[sid]; const c=(s.cast||[]).find(x=>x.id===cid); if(c){ pushUndo(); c.charId=charId||null; renderScenes(); renderPropsPanel(); } }

function setCompactCards(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('compactCards', on?'1':'0'); renderScenes(); }
