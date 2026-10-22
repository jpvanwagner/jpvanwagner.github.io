/* ============================================================================
   Scenemaker editor; custom editor themes  (feature #2)
   Download a blank theme template, edit the colours, and import it back. Custom
   themes are saved (persisted across restarts) and appear in the theme dropdown.
   Shares core.js scope.
   ==========================================================================*/
const THEME_VAR_KEYS = ['--body','--workspace','--dot','--panel','--panel2','--ink','--mut','--line','--bar','--field','--accent','--accent2'];
const THEME_VAR_HELP = {
  '--body':'page background behind the stage', '--workspace':'the stage surface',
  '--dot':'grid dots', '--panel':'panel / card background', '--panel2':'secondary panel background',
  '--ink':'main text colour', '--mut':'muted / secondary text', '--line':'borders & dividers',
  '--bar':'top bar / modal header background', '--field':'input field background',
  '--accent':'primary accent (buttons, highlights)', '--accent2':'darker accent (hover)'
};
function _slugTheme(s){ return 'custom_'+String(s||'theme').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32); }
function loadCustomThemes(){
  try{ const raw=ToolSettings.get('customThemes',''); if(!raw) return; const obj=JSON.parse(raw);
    Object.keys(obj).forEach(k=>{ const t=obj[k]; if(t&&t.vars) EDITOR_THEMES[k]={ label:'\u2605 '+(t.label||k.replace('custom_','')), vars:t.vars, custom:true }; });
  }catch(e){}
}
function saveCustomThemePref(key, theme){
  let obj={}; try{ obj=JSON.parse(ToolSettings.get('customThemes','')||'{}'); }catch(e){}
  obj[key]=theme; ToolSettings.set('customThemes', JSON.stringify(obj));
}
function downloadThemeTemplate(){
  const base=EDITOR_THEMES.midnight.vars;
  const light=(EDITOR_THEMES.paper&&EDITOR_THEMES.paper.vars)||base;
  const tpl={
    "_1_README":"This is a Scenemaker EDITOR theme. It only changes how the editor looks; it does NOT affect your exported story.",
    "_2_HOW_TO_USE":[
      "1) Change \"label\" to whatever you want your theme called.",
      "2) Edit each colour under \"vars\". Values are any CSS colour: #rrggbb, #rgb, rgb(...), rgba(...), hsl(...).",
      "3) Save the file, then in Scenemaker open Settings \u2192 Appearance \u2192 Import theme (or Help \u2192 Import editor theme) and pick it.",
      "4) Your theme appears in the theme dropdown marked with a star, and is remembered across restarts.",
      "Tip: keep --ink readable against --panel, and --accent distinct from --bar. Lines starting with _ are notes and are ignored on import."
    ],
    "_3_WHAT_EACH_COLOUR_DOES":THEME_VAR_HELP,
    "_4_A_LIGHT_EXAMPLE_you_can_copy_into_vars":Object.fromEntries(THEME_VAR_KEYS.map(k=>[k, light[k]||'#ffffff'])),
    "label":"My Theme",
    "vars":Object.fromEntries(THEME_VAR_KEYS.map(k=>[k, base[k]||'#000000']))
  };
  downloadTextFile('scenemaker-theme-template.json', JSON.stringify(tpl,null,2));
}
function downloadTextFile(name, text){
  try{ const b=new Blob([text],{type:'application/json'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },100);
  }catch(e){ toast('Could not start download'); }
}
function importCustomTheme(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
  inp.onchange=function(){ const f=inp.files&&inp.files[0]; if(!f) return; const rd=new FileReader();
    rd.onload=function(){ try{
      const obj=JSON.parse(rd.result);
      if(!obj || !obj.vars || typeof obj.vars!=='object'){ toast('That file has no "vars" object'); return; }
      const label=(obj.label||f.name.replace(/\.json$/i,'')).slice(0,40);
      const vars={}; THEME_VAR_KEYS.forEach(k=>{ vars[k]= (obj.vars[k]!=null)? String(obj.vars[k]) : (EDITOR_THEMES.midnight.vars[k]); });
      const key=_slugTheme(label);
      EDITOR_THEMES[key]={ label:'\u2605 '+label, vars, custom:true };
      saveCustomThemePref(key, { label, vars });
      loadToolTheme(); // refresh dropdown
      const sel=document.getElementById('tl-theme'); if(sel) sel.value=key;
      applyEditorTheme(key);
      toast('Theme "'+label+'" imported');
    }catch(e){ toast('Could not read theme file (invalid JSON)'); } };
    rd.readAsText(f);
  };
  inp.click();
}
