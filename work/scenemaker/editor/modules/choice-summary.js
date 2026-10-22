/* ============================================================================
   Scenemaker editor; choice logic snapshot
   Renders a readable, at-a-glance summary of the effects / condition / dice
   attached to a dialogue choice, shown as small chips inside the choice box so
   authors can see what a choice does without opening the ⚙ options modal.
   Purely an editor display; the player already applies this logic at runtime.
   Shared scope with core.js (uses varById from variables.js).
   ==========================================================================*/
function _opSym(op){ return {add:'+',sub:'\u2212',set:'=',toggle:'toggle'}[op]||op; }
function _cmpSym(cmp){ return {'>=':'\u2265','<=':'\u2264','==':'=','!=':'\u2260'}[cmp]||cmp; }
function _varName(id){ var v=(typeof varById==='function')?varById(id):null; return v?v.name:'?'; }
function _valFor(varId, v){
  var t=(typeof varById==='function' ? (varById(varId)||{}).type : null);
  if(t==='bool') return (v===true||v==='true'||v===1||v==='1');
  if(t==='number' && typeof v==='string') return (parseFloat(v)||0);
  return v;
}
function _fmtVal(v){
  if(v===true) return 'true'; if(v===false) return 'false';
  if(typeof v==='string') return v==='' ? '""' : '"'+v+'"';
  return String(v);
}
function choiceHasLogic(c){
  return !!((c.effects&&c.effects.length) || (c.condition&&c.condition.var) || (c.dice&&c.dice.enabled));
}
/* Mirrors player/runtime.js's choiceExit(): a choice with none of these will
   never actually be offered to the player (silently filtered out), which is
   an easy authoring trap to miss without a clear warning here. */
function choiceGoesNowhere(c){
  var hasOutcome = c.outcomes && c.outcomes.some(function(o){ return o.targetNode; });
  var hasRoute = c.routes && c.routes.some(function(r){ return r.target; });
  var hasDice = c.dice && c.dice.enabled;
  return !(hasOutcome || hasRoute || hasDice);
}
function choiceSummary(c){
  var chips=[];
  if(choiceGoesNowhere(c)){
    chips.push('<span class="sum-chip broken" title="This choice has no destination scene, no variable branch, and no dice roll - it will never actually be offered to the player"><img class="chip-ico" src="../assets/icons/link-broken.png" alt=""> no destination</span>');
  }
  if(c.condition&&c.condition.var){ var cd=c.condition;
    var otherwise = cd.hide==='hide' ? 'hidden' : 'greyed out';
    chips.push('<span class="sum-chip cond" title="Only shown when true ('+otherwise+' otherwise)">\uD83D\uDC41 if '
      + escHtml(_varName(cd.var)+' '+_cmpSym(cd.cmp)+' '+_fmtVal(_valFor(cd.var,cd.value))) + '</span>');
  }
  if(c.effects&&c.effects.length){ c.effects.forEach(function(e){ if(!e.var) return;
    var txt = e.op==='toggle' ? (_varName(e.var)+' toggle') : (_varName(e.var)+' '+_opSym(e.op)+' '+_fmtVal(_valFor(e.var,e.value)));
    chips.push('<span class="sum-chip eff" title="Changes a variable when picked">\u0192 '+escHtml(txt)+'</span>');
  }); }
  if(c.dice&&c.dice.enabled){ var d=c.dice; var cnt=(d.count>1?d.count:''); var mod=d.modVar?(' +'+_varName(d.modVar)):'';
    chips.push('<span class="sum-chip dice" title="Dice check; success vs failure branch">\uD83C\uDFB2 '
      + escHtml(cnt+'d'+d.sides+' \u2265 '+d.target+mod) + '</span>');
  }
  if(c.routes&&c.routes.length){ c.routes.forEach(function(r){ if(!r.target) return;
    var scn=(typeof scenes!=='undefined')?scenes[r.target]:null; var to=scn?(scn.title||'scene'):'?';
    var cond=(r.var==null||r.var==='') ? 'else' : (_varName(r.var)+' '+_cmpSym(r.cmp)+' '+_fmtVal(_valFor(r.var,r.value)));
    chips.push('<span class="sum-chip route" title="Variable branch (priority order)">\u2387 '+escHtml(cond+' \u2192 '+to)+'</span>');
  }); }
  return chips.length ? '<div class="choice-sum">'+chips.join('')+'</div>' : '';
}
