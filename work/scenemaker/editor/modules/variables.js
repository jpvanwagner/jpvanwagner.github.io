/* ============================================================================
   Scenemaker editor; variables library
   Typed variables: number (default), text, or true/false (bool).
   Classic script sharing global scope with core.js.
   ==========================================================================*/
const VAR_TYPES = ['number','text','bool'];
function varById(id){ return (project.variables||[]).find(v=>v.id===id); }
function varDefault(type){ return type==='text'?'':(type==='bool'?false:0); }
function coerceVal(type, v){
  if(type==='bool') return (v===true||v==='true'||v===1||v==='1');
  if(type==='number') return (parseFloat(v)||0);
  return String(v==null?'':v);
}
function addVariable(){ pushUndo(); if(!project.variables)project.variables=[]; project.variables.push({id:genId('var'),name:'newVar',type:'number',initial:0}); renderVarList(); }
function setVar(i,f,v){
  const vv=project.variables[i];
  if(f==='type'){ vv.type=v; vv.initial=varDefault(v); }          // reset initial to a valid default for the new type
  else if(f==='initial'){ vv.initial=coerceVal(vv.type||'number', v); }
  else vv[f]=v;
  if(f==='type') renderVarList();
  // #88: a {{token}} in dialogue resolves by NAME (runtime.js's subst()),
  // matching whichever variable with that name it finds first - two
  // variables sharing a name isn't just confusing in the list, it makes
  // one of them permanently unreachable by {{token}}. Flagged, not blocked
  // (a legitimate mid-edit state while renaming one of a pair).
  if(f==='name' && v){ const dupe=project.variables.find((x,xi)=>xi!==i && x.name===v);
    if(dupe && typeof toast==='function') toast(`Another variable is already named "${v}" - {{${v}}} in dialogue would only ever resolve to one of them`); }
}
function delVariable(i){ pushUndo(); const removed=project.variables[i].id; project.variables.splice(i,1);
  Object.values(scenes).forEach(s=>s.choices.forEach(c=>{
    if(c.effects) c.effects=c.effects.filter(e=>e.var!==removed);
    if(c.condition&&c.condition.var===removed) c.condition=null;
    if(c.dice&&c.dice.modVar===removed) c.dice.modVar='';
  })); renderVarList(); renderScenes(); }
function initialInputHtml(v,i){
  const t=v.type||'number';
  if(t==='bool') return `<select class="mini-sel" style="width:74px" onchange="setVar(${i},'initial',this.value)"><option value="false" ${!v.initial?'selected':''}>false</option><option value="true" ${v.initial?'selected':''}>true</option></select>`;
  if(t==='text') return `<input type="text" class="mini-sel" style="width:90px" value="${escAttr(v.initial)}" oninput="setVar(${i},'initial',this.value)">`;
  return `<input type="number" class="mini-sel" style="width:60px" value="${v.initial}" oninput="setVar(${i},'initial',this.value)">`;
}
function renderVarList(){
  const box=document.getElementById('var-list'); if(!box) return;
  // #215: a "Variables" header + its own ⓘ, matching the "Keyphrases" header
  // just below it (renderKeyphraseSectionHtml()) - a direct owner report
  // that the two lists, sitting right on top of each other in the same
  // panel, weren't clearly explained as DIFFERENT things (one drives story
  // logic, the other is a purely cosmetic text style), not just each
  // explained on its own.
  box.innerHTML = `<div class="lbl-sm" style="display:flex;align-items:center;gap:6px">
      <span>Variables</span>
      <span class="hint" title="Story memory: a number, text, or true/false that a choice can require, change, or branch on. Unlike Keyphrases below, a variable can affect what happens next in the story, not just how a word looks.">ⓘ</span>
    </div>`;
  box.innerHTML+=(project.variables&&project.variables.length)? project.variables.map((v,i)=>`
    <div class="line-top" style="gap:4px" oncontextmenu="if(event.target.tagName!=='INPUT'&&event.target.tagName!=='SELECT'){varRowMenu(event,${i})}">
      <input class="mini-sel" style="flex:1" value="${escAttr(v.name)}" oninput="setVar(${i},'name',this.value)">
      <select class="mini-sel" title="type" onchange="setVar(${i},'type',this.value)">${VAR_TYPES.map(t=>`<option value="${t}" ${(v.type||'number')===t?'selected':''}>${t}</option>`).join('')}</select>
      <span style="font-size:10px;color:var(--mut)">start</span>${initialInputHtml(v,i)}
      <span class="hdr-icon" style="color:#ef4444" onclick="delVariable(${i})">✕</span>
    </div>
    <details class="use-block"><summary>🔎 Where used</summary>${typeof varUsage==='function'?usageListHtml(varUsage(v.id)):''}</details>
    <details class="use-block"><summary>🎨 Text style ${varStyleSummary(v)}</summary>${varStyleRowHtml(v,i)}</details>`).join('') : '<div class="hint">No variables yet. Add one to track things like a running score (number), a name (text), or a flag (true/false).</div>';
  // #99: keyphrases are project-wide "story memory" like variables, so they
  // live in the same dockable panel, just below the variable rows - a
  // separate DOM subtree (#keyphrase-rows) rendered by keyphrases.js so
  // editing one never re-renders (and loses in-progress typing/focus in) the
  // other.
  box.innerHTML += (typeof renderKeyphraseSectionHtml==='function') ? renderKeyphraseSectionHtml() : '';
  if(typeof renderKeyphraseList==='function') renderKeyphraseList();
}
// #99: a variable's own optional per-substitution style - applied to
// whatever its {{token}} actually resolves to wherever it's used in
// dialogue, in actual play (player/runtime.js's subst()). Blank/false on
// every field (the default) means no change from before this existed.
function varStyleSummary(v){ const st=v.style||{}; return (st.color||st.bold||st.italic) ? '<span style="color:var(--accent)">✓ set</span>' : ''; }
function varStyleRowHtml(v,i){
  const st=v.style||{color:'',bold:false,italic:false};
  return `<div class="hint" style="margin:4px 0 6px">Colours/styles whatever <code>{{${escHtml(v.name)}}}</code> resolves to, wherever it's used in dialogue.</div>
    <div class="mini-row" style="align-items:center">
      <input type="color" value="${st.color||'#38bdf8'}" oninput="setVarStyle(${i},'color',this.value); document.getElementById('vst-hex-${i}').value=this.value" title="Colour">
      <input type="text" id="vst-hex-${i}" class="hex-field" maxlength="7" placeholder="#rrggbb" value="${escAttr(st.color)}" oninput="hexSyncToColor(this); setVarStyle(${i},'color',this.value)" title="Leave blank for no colour override">
      <label class="chk" style="margin:0" title="Bold"><input type="checkbox" ${st.bold?'checked':''} onchange="setVarStyle(${i},'bold',this.checked)"> B</label>
      <label class="chk" style="margin:0" title="Italic"><input type="checkbox" ${st.italic?'checked':''} onchange="setVarStyle(${i},'italic',this.checked)"> I</label>
      <button class="mini-btn warn" onclick="clearVarStyle(${i})" title="Remove this style">clear</button>
    </div>`;
}
function setVarStyle(i,field,val){
  const v=project.variables[i]; if(!v) return; if(!v.style) v.style={color:'',bold:false,italic:false};
  if(field==='bold'||field==='italic') v.style[field]=!!val;
  else if(field==='color') v.style.color=normalizeHex(val)||'';
}
function clearVarStyle(i){ pushUndo(); const v=project.variables[i]; if(!v) return; v.style={color:'',bold:false,italic:false}; renderVarList(); }
/* right-click a variable row: duplicate, copy its name, or delete */
function duplicateVariable(i){ pushUndo(); const v=project.variables[i]; const copy=Object.assign({},v,{id:genId('var'),name:v.name+' copy'}); project.variables.splice(i+1,0,copy); renderVarList(); }
function copyVariableName(i){ const v=project.variables[i]; try{ if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(v.name); }catch(e){} if(typeof toast==='function') toast('Copied "'+v.name+'"'); }
function varRowMenu(e,i){
  e.preventDefault(); e.stopPropagation();
  if(typeof showContextMenu!=='function') return;
  showContextMenu(e.clientX,e.clientY,[
    { icon:'⧉', label:'Duplicate', onClick:()=>duplicateVariable(i) },
    { icon:'📋', label:'Copy name', onClick:()=>copyVariableName(i) },
    { sep:true },
    { icon:'✕', label:'Delete', onClick:()=>delVariable(i) },
  ]);
}
function varOptions(sel){ if(!project.variables||!project.variables.length) return '<option value="">(none)</option>'; return project.variables.map(v=>`<option value="${v.id}" ${sel===v.id?'selected':''}>${escHtml(v.name)}</option>`).join(''); }
function numberVarOptions(sel){ const ns=(project.variables||[]).filter(v=>(v.type||'number')==='number'); if(!ns.length)return '<option value="">(no number vars)</option>'; return ns.map(v=>`<option value="${v.id}" ${sel===v.id?'selected':''}>${escHtml(v.name)}</option>`).join(''); }
