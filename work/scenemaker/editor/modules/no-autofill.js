/* ============================================================================
   Scenemaker editor; no-autofill
   Part of the modular editor. Classic script sharing global scope with core.js.
   The editor's inputs/textareas are re-rendered constantly (every scene edit
   rebuilds the DOM), so browsers happily offer up previously-typed values as
   autofill suggestions on brand-new fields. Blanket-disable that everywhere,
   including anything rendered later, without having to touch every module
   that builds markup.
   Deliberately leaves spellcheck alone: this is a writing tool, and the
   dialogue textarea (along with choice text, notes, and everything else an
   author actually writes prose into) is exactly where the browser's own
   red-squiggle spellcheck is most wanted, not least. Autofill suggestions
   and spellcheck are unrelated browser features; only the former is what
   this file exists to suppress. */
function _killAutofill(el){
  el.setAttribute('autocomplete','off');
  el.setAttribute('autocorrect','off');
}
function disableAutofill(root){
  const scope=root||document;
  if(scope.matches && scope.matches('input,textarea,select') && !scope.hasAttribute('autocomplete')) _killAutofill(scope);
  if(scope.querySelectorAll) scope.querySelectorAll('input:not([autocomplete]), textarea:not([autocomplete]), select:not([autocomplete])').forEach(_killAutofill);
}
disableAutofill(document);
new MutationObserver(muts=>{
  for(const m of muts) m.addedNodes.forEach(node=>{ if(node.nodeType===1) disableAutofill(node); });
}).observe(document.documentElement, { childList:true, subtree:true });
