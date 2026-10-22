/* ============================================================================
   Scenemaker editor; variable-based choice routing  (feature #4)
   A choice can send the reader to different scenes depending on variable values,
   checked in PRIORITY order (top to bottom; first match wins). If none match, the
   choice's normal dragged connection is used. E.g. prioritize "empathy ≥ 4 → Scene A"
   above "escalation ≥ 8 → Scene B" so empathy wins when both are true.
   Renders the section inside the choice ⚙ options modal. Shared scope with core.js.
   ==========================================================================*/
function sceneOptions(sel){
  return '<option value="">(pick scene)</option>' + Object.values(scenes).map(function(s){
    return '<option value="'+s.id+'" '+(sel===s.id?'selected':'')+'>'+escHtml(s.title||'(untitled)')+'</option>';
  }).join('');
}
function routeValueHtml(r,i,t){
  if(t==='bool') return '<select class="mini-sel" style="width:70px" onchange="setRoute('+i+',\'value\',this.value)"><option value="false" '+(!r.value?'selected':'')+'>false</option><option value="true" '+(r.value?'selected':'')+'>true</option></select>';
  if(t==='text') return '<input type="text" class="mini-sel" style="width:90px" value="'+escAttr(r.value)+'" oninput="setRoute('+i+',\'value\',this.value)">';
  return '<input type="number" class="mini-sel" style="width:60px" value="'+r.value+'" oninput="setRoute('+i+',\'value\',this.value)">';
}
function routesSectionHtml(c){
  var noVars=!(project.variables&&project.variables.length);
  var rows=(c.routes||[]).map(function(r,i){ var t=(varById(r.var)||{}).type||'number';
    return '<div class="line-top" style="flex-wrap:wrap;gap:4px;align-items:center">'
      +'<span class="opt-lbl" title="priority '+(i+1)+'">#'+(i+1)+'</span><span class="opt-lbl">if</span>'
      +'<select class="mini-sel" onchange="setRoute('+i+',\'var\',this.value)">'+varOptions(r.var)+'</select>'
      +'<select class="mini-sel" onchange="setRoute('+i+',\'cmp\',this.value)">'+cmpsForType(t).map(function(o){return '<option value="'+o+'" '+(r.cmp===o?'selected':'')+'>'+o+'</option>';}).join('')+'</select>'
      + routeValueHtml(r,i,t)
      +'<span class="opt-lbl">→</span>'
      +'<select class="mini-sel" onchange="setRoute('+i+',\'target\',this.value)">'+sceneOptions(r.target)+'</select>'
      +'<span class="hdr-icon" title="raise priority" onclick="moveRoute('+i+',-1)">▲</span>'
      +'<span class="hdr-icon" title="lower priority" onclick="moveRoute('+i+',1)">▼</span>'
      +'<span class="hdr-icon" style="color:#ef4444" onclick="delRoute('+i+')">✕</span></div>';
  }).join('');
  return '<div class="sec"><h3>Branch by variable; priority order</h3>'
    + '<div class="hint" style="margin-bottom:6px">Checked top to bottom; the first match wins and sends the reader to that scene. If none match, the choice\u2019s normal connection (the dot you drag) is used. Use \u25B2\u25BC to prioritize; e.g. put a more specific rule above a broader one so it wins when both match.</div>'
    + (rows||'<div class="hint">No variable branches.</div>')
    + '<button class="mini-btn" style="margin-top:8px" onclick="addRoute()" '+(noVars?'disabled':'')+'>+ branch</button></div>';
}
function addRoute(){ var c=curChoice(); pushUndo(); if(!c.routes)c.routes=[]; var v0=project.variables[0]||{}; var t=v0.type||'number';
  c.routes.push({id:genId('rt'),var:v0.id||'',cmp:cmpsForType(t)[0],value:varDefault(t),target:''}); renderLogic(); renderScenes(); }
function setRoute(i,f,v){ var c=curChoice(); var r=c.routes[i]; if(!r)return; var t=(varById(r.var)||{}).type||'number';
  if(f==='var'){ r.var=v; var nt=(varById(v)||{}).type||'number'; if(cmpsForType(nt).indexOf(r.cmp)<0)r.cmp=cmpsForType(nt)[0]; r.value=coerceVal(nt,r.value); renderLogic(); }
  else if(f==='value'){ r.value=coerceVal(t,v); }
  else { r[f]=v; if(f==='target') renderScenes(); }
}
function delRoute(i){ var c=curChoice(); pushUndo(); c.routes.splice(i,1); renderLogic(); renderScenes(); }
function moveRoute(i,dir){ var c=curChoice(); var j=i+dir; if(j<0||j>=c.routes.length)return; pushUndo();
  var tmp=c.routes[i]; c.routes[i]=c.routes[j]; c.routes[j]=tmp; renderLogic(); renderScenes(); }
