/* ============================================================================
   Scenemaker editor; per-line options: first-time content (#5) + text speed (#8)
   Renders the "Show / Text speed" row under each dialogue line. The speed control
   (speedControlHtml) is reused by the project default and per-character editors.
   Uses the shared .opt-row styling so all feature rows match. Shared scope.
   ==========================================================================*/
function speedModeOptions(mode, includeInherit){
  var opts = includeInherit ? [['','inherit (use default)']] : [];
  opts = opts.concat([['letter','by letter'],['word','by word'],['line','whole line at once'],['instant','instant']]);
  return opts.map(function(o){ return '<option value="'+o[0]+'"'+(mode===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('');
}
/* mode <select> + (for letter/word) a 1..10 slider AND a numeric box that mirrors it. */
function speedControlHtml(spd, includeInherit, onMode, onSpeed){
  spd = spd || {mode:(includeInherit?'':'letter'), speed:5};
  var sliders = (spd.mode==='letter'||spd.mode==='word')
    ? '<span class="opt-num-wrap"><img class="btn-ico" style="margin:0" src="../assets/icons/speed-slow.png" alt="slow" title="Slow"><input type="range" min="1" max="10" value="'+(spd.speed||5)+'" title="typing speed (slow → fast)" oninput="syncPair(this);'+onSpeed+'" style="width:80px"><img class="btn-ico" style="margin:0" src="../assets/icons/speed-fast.png" alt="fast" title="Fast">'
      +'<input type="number" class="opt-num" min="1" max="10" value="'+(spd.speed||5)+'" title="speed 1-10" oninput="syncPair(this)" onchange="'+onSpeed+'"></span>'
    : '';
  return '<select class="mini-sel" onchange="'+onMode+'">'+speedModeOptions(spd.mode, includeInherit)+'</select> '+sliders;
}

function lineTimingHtml(n,l){
  var v=l.visit||{mode:'always',n:2}, s=l.textSpeed||{mode:'',speed:5};
  var visitSel = '<select class="mini-sel" title="When this line appears" onchange="setLineVisit(\''+n.id+'\',\''+l.id+'\',\'mode\',this.value)">'
    + [['always','every time'],['first','first time only'],['firstN','first N times'],['afterN','after N times']]
        .map(function(o){ return '<option value="'+o[0]+'"'+(v.mode===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
    + '</select>';
  var nBox = (v.mode==='firstN'||v.mode==='afterN')
    ? '<input type="number" class="opt-num" min="1" value="'+(v.n||2)+'" title="N (scene visits)" onchange="setLineVisit(\''+n.id+'\',\''+l.id+'\',\'n\',this.value)">'
    : '';
  var spd = speedControlHtml(s, true,
    'setLineSpeed(\''+n.id+'\',\''+l.id+'\',\'mode\',this.value)',
    'setLineSpeed(\''+n.id+'\',\''+l.id+'\',\'speed\',this.value)');
  return '<div class="opt-row"><span class="opt-lbl">Show:</span>'+visitSel+nBox
    +'<span class="opt-lbl" style="margin-left:8px">Text speed:</span>'+spd+'</div>';
}
function setLineVisit(nid,lid,f,val){
  var l=scenes[nid].lines.find(function(x){return x.id===lid;}); if(!l) return;
  if(!l.visit) l.visit={mode:'always',n:2};
  l.visit[f] = (f==='n') ? Math.max(1,parseInt(val,10)||1) : val;
  if(f==='mode') renderScenes();
}
function setLineSpeed(nid,lid,f,val){
  var l=scenes[nid].lines.find(function(x){return x.id===lid;}); if(!l) return;
  if(!l.textSpeed) l.textSpeed={mode:'',speed:5};
  l.textSpeed[f] = (f==='speed') ? Math.max(1,Math.min(10,parseInt(val,10)||5)) : val;
  if(f==='mode') renderScenes();
}
