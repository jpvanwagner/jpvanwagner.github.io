/* ============================================================================
   Scenemaker editor; fill in empty content, one at a time  (Edit menu)
   A companion to the Lorem Ipsum autofill toggle (Settings -> Workspace):
   that one blocks out a branching structure's shape with placeholder text so
   nothing stays visibly blank while you plan; this one is for the opposite
   moment, actually writing the real thing - it jumps you, one click at a
   time, to the next genuinely EMPTY dialogue line or choice label anywhere
   in the project (every layer), so filling in a big batch of blank scenes
   doesn't mean hunting the node graph by eye for what's still untouched.
   Deliberately scoped to literal blanks: a line/choice a Lorem-autofilled
   project already filled with placeholder text isn't "empty" (it has real,
   if fake, content you'd deliberately go overwrite) - this and Lorem
   autofill are complementary, not overlapping, and with Lorem autofill on
   this simply never finds anything, since nothing is ever left blank.
   Shares core.js scope (reuses the exact same jump-to plumbing Find in
   Project already uses: sceneLayer/switchLayer/selectLineProp/
   selectChoiceProp).
   ==========================================================================*/

/* ---- pure helpers (testable without a real project/DOM) ------------------ */
function ecfIsEmptyLine(l){ return !!(l && !String(l.text||'').trim()); }
// a "continue" choice deliberately carries no label of its own (its button
// just reads "Continue ▸" in real play), so it's never "empty" content.
function ecfIsEmptyChoice(c){ return !!(c && !c.continue && !String(c.text||'').trim()); }
/* every empty line/choice across every layer (scenesObj is the flat
   { id: scene } map, same shape as the real `scenes` global - passed in
   rather than read directly so this stays independently testable), scene by
   scene, lines before choices, in each scene's own stored order. */
function ecfCollectEmpty(scenesObj){
  const out=[];
  Object.values(scenesObj||{}).forEach(function(n){
    (n.lines||[]).forEach(function(l){ if(ecfIsEmptyLine(l)) out.push({sceneId:n.id, lineId:l.id, kind:'line'}); });
    (n.choices||[]).forEach(function(c){ if(ecfIsEmptyChoice(c)) out.push({sceneId:n.id, choiceId:c.id, kind:'choice'}); });
  });
  return out;
}

/* ---- navigation --------------------------------------------------------- */
// the id of the line/choice last jumped to, so a repeat call continues
// forward from there instead of always restarting at the very first blank -
// the whole point is fast one-at-a-time progress through a big batch.
let _ecfLastId = null;
function findNextEmptyContent(){
  const all = ecfCollectEmpty(scenes);
  if(!all.length){ _ecfLastId=null; toast('No empty dialogue or choices left to fill in!'); return; }
  let idx = 0;
  if(_ecfLastId){
    const pos = all.findIndex(function(m){ return (m.lineId||m.choiceId)===_ecfLastId; });
    idx = (pos>=0) ? (pos+1) % all.length : 0;
  }
  const m = all[idx];
  _ecfLastId = m.lineId || m.choiceId;
  ecfJumpTo(m);
  toast('Empty content '+(idx+1)+' of '+all.length+(idx+1===all.length?' (wraps back to the first next time)':''));
}
function ecfJumpTo(m){
  const n=scenes[m.sceneId]; if(!n) return;
  if(typeof sceneLayer==='function' && typeof switchLayer==='function' && sceneLayer(n)!==currentLayerId) switchLayer(sceneLayer(n));
  if(n.collapsed){ n.collapsed=false; renderScenes(); }
  if(m.kind==='line' && typeof selectLineProp==='function') selectLineProp(m.sceneId, m.lineId);
  else if(m.kind==='choice' && typeof selectChoiceProp==='function') selectChoiceProp(m.sceneId, m.choiceId);
}
