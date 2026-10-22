/* ============================================================================
   Scenemaker editor; keyphrase highlighting  (#99)
   A project-wide list of words/phrases that always get a consistent look
   (colour/bold/italic) wherever they appear in dialogue or cutscene text, in
   actual play - instead of hand-wrapping every occurrence in markup by hand
   each time. Rendered as its own section at the bottom of the Variables panel
   (renderVarList(), variables.js, calls renderKeyphraseSectionHtml() below and
   appends it), since it's project-wide "story memory" the same way variables
   are, not scoped to any one character or scene.

   Character names use their own opt-in toggle (Characters panel: "Highlight
   this character's name in dialogue") instead of living in this list, so a
   renamed/recoloured character stays in sync automatically rather than
   needing its keyphrase entry hand-edited too; see characters.js.

   The actual matching/highlighting (which text gets wrapped, and how) lives
   in player/runtime.js (keyphraseList()/applyKeywordHighlights()), since it
   only ever matters in real play; this module only edits the data.
   Shares core.js scope.
   ==========================================================================*/
function ensureKeyphrases(){ if(!Array.isArray(project.keyphrases)) project.keyphrases=[]; }
function addKeyphrase(){
  ensureKeyphrases(); pushUndo();
  project.keyphrases.push({id:genId('kw'), phrase:'', color:'#f472b6', bold:false, italic:false});
  renderKeyphraseList();
}
function setKeyphrase(i,field,val){
  ensureKeyphrases(); const k=project.keyphrases[i]; if(!k) return;
  if(field==='bold'||field==='italic') k[field]=!!val;
  else if(field==='color') k.color=normalizeHex(val)||'';
  else k[field]=val;
}
function delKeyphrase(i){ ensureKeyphrases(); pushUndo(); project.keyphrases.splice(i,1); renderKeyphraseList(); }
function keyphraseRowHtml(k,i){
  return `<div class="mini-row" style="align-items:center">
    <input placeholder="word or phrase" style="flex:1" value="${escAttr(k.phrase)}" oninput="setKeyphrase(${i},'phrase',this.value)">
    <input type="color" value="${k.color||'#f472b6'}" oninput="setKeyphrase(${i},'color',this.value); document.getElementById('kw-hex-${i}').value=this.value" title="Colour">
    <input type="text" id="kw-hex-${i}" class="hex-field" maxlength="7" placeholder="#rrggbb" value="${escAttr(k.color)}" oninput="hexSyncToColor(this); setKeyphrase(${i},'color',this.value)" title="Type a hex color code">
    <label class="chk" style="margin:0" title="Bold"><input type="checkbox" ${k.bold?'checked':''} onchange="setKeyphrase(${i},'bold',this.checked)"> B</label>
    <label class="chk" style="margin:0" title="Italic"><input type="checkbox" ${k.italic?'checked':''} onchange="setKeyphrase(${i},'italic',this.checked)"> I</label>
    <span class="row-x" title="Remove" onclick="delKeyphrase(${i})">✕</span></div>`;
}
function renderKeyphraseList(){
  ensureKeyphrases(); const box=document.getElementById('keyphrase-rows'); if(!box) return;
  box.innerHTML = project.keyphrases.length
    ? project.keyphrases.map((k,i)=>keyphraseRowHtml(k,i)).join('')
    : '<div class="hint">None yet. Add a word or phrase (a place name, an item, a faction) to always show it the same way in dialogue.</div>';
}
function renderKeyphraseSectionHtml(){
  ensureKeyphrases();
  return `<div class="lbl-sm" style="margin-top:14px;display:flex;align-items:center;gap:6px">
      <span>Keyphrases</span>
      <span class="hint" title="Any word or phrase here is automatically colored/styled everywhere it appears in dialogue and cutscene text, in actual play - no need to wrap it in markup by hand each time. Unlike Variables above, a keyphrase is purely a look; it carries no value and can't be required, changed, or branched on.">ⓘ</span>
    </div>
    <div id="keyphrase-rows"></div>
    <button class="mini-btn" onclick="addKeyphrase()" title="Add a word or phrase to always highlight in dialogue">+ keyphrase</button>`;
}
