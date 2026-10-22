/* ============================================================================
   Scenemaker editor; panel "How this works" help  (features #2, #3)
   A compact ⓘ icon in each dock's title bar opens a floating explainer popover
   (Characters / Variables / Scenes). No longer eats panel space. Edit copy below.
   ==========================================================================*/
const PANEL_HELP = {
  chars:
    'Characters are your cast. Each one carries:'
    +'<ul><li><b>Portrait</b>; the default face. Use <b>bg</b> to switch on background transparency (off until enabled).</li>'
    +'<li><b>Face states</b>; extra named expressions (e.g. <i>upset</i>); pick one per line.</li>'
    +'<li><b>Typing sound</b>; a synth blip as their text types.</li>'
    +'<li><b>Text speed &amp; font</b>; per-character overrides.</li></ul>'
    +'Stage a character on a line and their portrait + sound come along.'
    +'<div style="margin-top:6px"><button class="mini-btn" onclick="loadSampleModule&&loadSampleModule()">Load the sample story to see it</button></div>',
  vars:
    'Variables are the <b>memory</b> of your story; numbers, text or true/false that persist as the reader plays:'
    +'<ul><li><b>Choices change them</b>; “Reassure” → score +2.</li>'
    +'<li><b>Choices can require them</b>; show/grey a choice by a condition.</li>'
    +'<li><b>Choices can branch on them</b>; send the reader to different scenes by value, in a priority order you set.</li></ul>'
    +'Wire branching in a choice’s <b>⚙ options → Branch by variable</b>.'
    +'<div class="hint" style="margin-top:6px"><b>Not the same as Keyphrases</b> (further down this panel); a keyphrase only changes how a word LOOKS in dialogue (colour/bold/italic) and carries no value; a variable is what the story actually remembers.</div>'
    +'<div style="margin-top:6px"><button class="mini-btn" onclick="startFullTutorial&&startFullTutorial()">Show me with the sample story</button></div>',
  scenes:
    'The Scenes panel lists every scene in your story:'
    +'<ul><li><b>Click</b> a scene to see its group, characters and opening dialogue.</li>'
    +'<li><b>Double-click</b> (or ⤢ Warp) to fly the stage to it with a flash.</li>'
    +'<li><b>Right-click</b> a row for duplicate / copy / delete.</li>'
    +'<li>The ▸ mark shows the <b>start scene</b>.</li></ul>'
    +'Great for jumping around big branching stories without hunting on the stage.'
};
function panelHelpIcon(kind){
  if(!PANEL_HELP[kind]) return '';
  return `<span class="dock-help-ic" title="How this works" onclick="event.stopPropagation();togglePanelHelp('${kind}',event)">\u24D8</span>`;
}
function togglePanelHelp(kind, ev){
  let pop=document.getElementById('panel-help-pop');
  const same = pop && pop.getAttribute('data-kind')===kind;
  if(pop){ pop.remove(); document.removeEventListener('mousedown',_phpOutside,true); }
  if(same) return;
  pop=document.createElement('div'); pop.id='panel-help-pop'; pop.className='panel-help-pop'; pop.setAttribute('data-kind',kind);
  pop.innerHTML=`<div class="php-head"><b>\u24D8 How this works</b><span class="php-x" title="Close" onclick="document.getElementById('panel-help-pop').remove()">\u2715</span></div>`
    +`<div class="php-body">${PANEL_HELP[kind]||''}</div>`;
  document.body.appendChild(pop);
  const x=(ev&&ev.clientX)||220, y=(ev&&ev.clientY)||120, w=pop.offsetWidth||300, h=pop.offsetHeight||200;
  pop.style.left=Math.max(8, Math.min(x-w+40, window.innerWidth-w-8))+'px';
  pop.style.top =Math.min(y+18, window.innerHeight-h-8)+'px';
  setTimeout(()=>document.addEventListener('mousedown',_phpOutside,true),0);
}
function _phpOutside(e){ const pop=document.getElementById('panel-help-pop'); if(pop && !pop.contains(e.target)){ pop.remove(); document.removeEventListener('mousedown',_phpOutside,true); } }
