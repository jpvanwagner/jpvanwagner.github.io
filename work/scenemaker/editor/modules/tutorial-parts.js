/* ============================================================================
   Scenemaker editor; modular, context-triggered tutorials  (feature #6)
   Small "mini tutorials" pop up the first time you open a feature (Characters,
   Variables, Scenes, Assets, Canvas, Properties, Export, Settings, Sound
   Studio, Layers). Each part is independent, so skipping one doesn't skip the
   others, and each is a short, actual feature-by-feature rundown rather than
   a one-line blurb - the idea is you never have to sit through one long tour
   to learn a panel; each one teaches itself the first time you open it.
   Bumping TUTORIAL_VERSION re-shows them all after an update. Shares core.js
   scope.
   ==========================================================================*/
const TUTORIAL_VERSION = '2026.10';   // bump this on each release to re-show tutorials

const MINI_TUTS = {
  chars: { title:'Characters', body:`<ul>
    <li>Define each person once: portrait, size, entrance/exit animation, border.</li>
    <li><b>Face states</b> add extra expressions you can swap per line.</li>
    <li><b>Portrait effects</b> stack as many as you like (CRT, glitch, sepia\u2026) instead of just one.</li>
    <li>An optional <b>colour</b> tags them everywhere in the editor (cast rows, dialogue lines, Canvas editor) - never in the exported game.</li>
    <li>Drop a character into any scene\u2019s cast, then click their face on a card to fine-tune that line in <b>Properties</b>.</li>
  </ul>` },
  vars: { title:'Variables', body:`<ul>
    <li>Variables are your story\u2019s memory: numbers, flags, or typed-in text.</li>
    <li>A choice can <b>require</b> one to be shown, <b>change</b> it when picked, or <b>branch</b> to a different scene based on it.</li>
    <li>Each variable\u2019s <b>\u201CWhere used\u201D</b> lists every place it\u2019s referenced, so nothing gets orphaned.</li>
    <li>Recall a value anywhere in dialogue with <code>{{varName}}</code>.</li>
    <li>Not the same as the <b>Keyphrases</b> list further down this panel: a keyphrase just colours/styles a word wherever it appears, it carries no value and can\u2019t be required, changed, or branched on.</li>
  </ul>` },
  scenes: { title:'Scenes panel', body:`<ul>
    <li>Every scene in one list; click one for its details, double-click (or <b>Warp</b>) to fly straight to it on the stage.</li>
    <li>Duplicate, copy, or delete a scene right from the list, no need to find it on the board first.</li>
    <li><b>Pin</b> the scenes you keep coming back to so they stay easy to find.</li>
    <li>The <b>▸</b> beside a scene's title, on the stage or in this list, sets it as the layer's <b>start scene</b>; the bottom bar's two ⤢ buttons jump the stage straight to the start scene or wherever you last edited.</li>
  </ul>` },
  assets: { title:'Assets library', body:`<ul>
    <li>Every image, sound and video in your project, in one place - add one here before it\u2019s used anywhere.</li>
    <li><b>Drag</b> a tile straight onto a background/audio/portrait slot to assign it, no picker dialog needed.</li>
    <li><b>Double-click</b> an asset for a full info view: a zoomable preview, when it was added, embedded authorship (EXIF/PNG metadata) when a file has any, and a one-click <b>copy to credits</b>.</li>
    <li><b>Cleanup unused</b> and <b>merge duplicates</b> keep the library from accumulating cruft.</li>
  </ul>` },
  canvas: { title:'Canvas editor', body:`<ul>
    <li>Lay out the game screen like a slide: drag the dialogue box, choices, and portraits anywhere.</li>
    <li>Add extra boxes for simultaneous speakers - combine them into one spot, or keep them all the same size automatically.</li>
    <li>Pick a shape and <b>stack several entrance effects</b> at once, each with its own delay and speed.</li>
    <li><b>Click</b> any element to edit just its own properties in the sidebar; <b>right-click</b> one for a quick lock/reset menu.</li>
    <li>Start from a template, save your own layout, or scope one to a single scene or group.</li>
  </ul>` },
  props: { title:'Properties panel', body:`<ul>
    <li>Edits whatever you\u2019ve selected: a line, an on-stage face, a choice, a scene, or a group.</li>
    <li>Rich text formatting, stage placement, and effect cues all live here now, instead of crowding the scene card itself.</li>
    <li>Selecting anything on the stage jumps straight here automatically.</li>
  </ul>` },
  export: { title:'Export', body:`<ul>
    <li><b>SCORM package</b> for your LMS (any SCORM 1.2/2004 host), with scoring and mastery options.</li>
    <li><b>Stage PNG</b>: a picture of your whole scene graph, handy for documentation.</li>
    <li><b>Printable script</b>: every scene\u2019s text laid out as pages, condensed however you like, ready to Print \u2192 Save as PDF.</li>
  </ul>` },
  settings: { title:'Settings', body:`<ul>
    <li><b>Story</b>: start scene, completion rules, smart routing.</li>
    <li><b>Title screen</b>, <b>Screen &amp; frame</b> (box style/border/font), <b>Text speed</b>, <b>Effects</b>.</li>
    <li><b>Info &amp; credits</b>: your author/social links plus per-asset attributions, and an optional automatic end-credits screen.</li>
    <li><b>Appearance</b> and <b>Workspace</b> are just for you while you work - never exported with the game.</li>
  </ul>` },
  soundstudio: { title:'Sound Studio', body:`<ul>
    <li>Record straight from your microphone, with a live countdown.</li>
    <li>Load an existing library asset to trim or clean up, then save it back.</li>
    <li>Preview before committing - closing this window doesn\u2019t lose your take.</li>
    <li>Jump here directly from any audio asset\u2019s right-click menu ("Edit in Sound Studio\u2026").</li>
  </ul>` },
  layers: { title:'Layers', body:`<ul>
    <li>A layer is a second full stage grid inside the same project - handy for splitting up a big branching story.</li>
    <li>Link a choice to another layer with a <b>portal</b>; it shows a small tab on the node and jumps you there.</li>
    <li><b>Reorder or rename</b> layers right here, or with the "\u270e layers" button on the bottom bar.</li>
    <li><b>Import</b> an entire other project as a new layer to merge two stories into one.</li>
  </ul>` }
};

// #16: every "don't ask me again"/one-time-dismiss flag across the app -
// a direct owner instruction ("Reset tutorials/popups with every new
// version... Do not retain these types of settings... with new versions").
// Each one gates a one-off popup a user can dismiss forever (a tutorial
// step, a first-run offer, or a "don't warn me again" checkbox on a warning
// dialog). toastsOff/tooltipOff read more like ongoing display preferences
// than one-time dismissals, but a direct owner follow-up asked for them to
// reset too, so they're included on purpose, not an oversight.
// New "don't ask again" checkboxes added elsewhere in the app belong in
// this same list, not a separate one-off reset.
const TUTORIAL_VERSION_RESET_KEYS = [
  'tutorialOff', 'tutorialSeen', 'sampleOfferSeen',
  'obstructWarnOff', 'ceOobWarnOff', 'ceUnsavedWarnOff', 'openOverlapWarnOff',
  'groupAnnexOff', 'assetQualityWarnOff', 'dockOfferOff', 'endpointDisconnectOff',
  'toastsOff', 'tooltipOff',
];
function tutorialVersionCheck(){
  if(typeof ToolSettings==='undefined') return;
  if(ToolSettings.get('tutVersion','') !== TUTORIAL_VERSION){
    // a new version: forget what was seen/dismissed, unconditionally - even
    // an explicit prior "off"/"don't ask again" - so every popup this
    // release touches gets a fresh chance to be seen.
    TUTORIAL_VERSION_RESET_KEYS.forEach(k=>ToolSettings.set(k,'0'));
    Object.keys(MINI_TUTS).forEach(k=>ToolSettings.set('tut_seen_'+k,'0'));
    ToolSettings.set('tutVersion', TUTORIAL_VERSION);
  }
}
function _miniSeen(key){ return (typeof ToolSettings!=='undefined') && ToolSettings.get('tut_seen_'+key,'0')==='1'; }
function _miniMark(key){ if(typeof ToolSettings!=='undefined') ToolSettings.set('tut_seen_'+key,'1'); }
function maybeShowMini(key){
  if(typeof tutorialOff==='function' && tutorialOff()) return;   // tutorials disabled
  if(!MINI_TUTS[key] || _miniSeen(key)) return;
  if(typeof _tutActive!=='undefined' && _tutActive) return;       // don't stack on the main tour
  setTimeout(()=>showMiniTut(key), 350);
}
function showMiniTut(key){
  const t=MINI_TUTS[key]; if(!t) return;
  let pop=document.getElementById('mini-tut');
  if(!pop){ pop=document.createElement('div'); pop.id='mini-tut'; pop.className='mini-tut'; document.body.appendChild(pop); }
  pop.setAttribute('data-key',key);
  pop.innerHTML=`<div class="mt-head"><b>\u24D8 ${escHtml(t.title)}</b></div>
    <div class="mt-body">${t.body}</div>
    <div class="mt-foot"><button class="mini-btn" onclick="dismissMini(false)">Skip this tip</button>
      <button class="mini-btn tb-accent" style="background:var(--accent);color:#fff;border:none" onclick="dismissMini(true)">Got it</button></div>`;
  pop.style.display='block';
}
function dismissMini(got){
  const pop=document.getElementById('mini-tut'); if(!pop) return;
  const key=pop.getAttribute('data-key'); _miniMark(key);   // seen either way (skip only skips THIS part)
  pop.style.display='none';
}
/* replay all tutorials on demand (Help menu) */
function replayAllTutorials(){
  if(typeof ToolSettings==='undefined') return;
  ToolSettings.set('tutorialSeen','0'); ToolSettings.set('tutorialOff','0');
  Object.keys(MINI_TUTS).forEach(k=>ToolSettings.set('tut_seen_'+k,'0'));
  if(typeof restartTutorial==='function') restartTutorial();
  toast('Tutorials reset; they\u2019ll show as you use each feature.');
}
