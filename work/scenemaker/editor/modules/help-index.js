/* ============================================================================
   Scenemaker editor; searchable Help Index (feature #106)
   A classic "Help ▸ Help Index" reference: a topic list on the left, a search
   box above it that filters by title AND body text, and the selected topic's
   full write-up on the right. Reuses the same topic content the per-panel
   mini-tutorials already show (MINI_TUTS, tutorial-parts.js) as its single
   source of truth rather than duplicating a second copy of that prose, plus a
   couple of topics that only make sense as a standalone reference (Groups,
   Keyboard shortcuts, an intro). Keyboard shortcuts are built live from
   MENU_DEF (menubar.js), so this can never drift out of sync with the real
   menu. Shares core.js scope.
   ==========================================================================*/
const HELP_EXTRA_TOPICS = {
  welcome: { title:'Getting started', body:`
    <p>Scenemaker builds branching stories as scenes on a graph, wired together by choices, and exports them for an LMS or as a standalone file.</p>
    <ul>
      <li>Brand new here? The <b>Sample story tour</b> (below) walks through a complete example story feature by feature.</li>
      <li>Each side panel (Characters, Variables, Scenes…) has its own ⓘ icon in its title bar for a quick reminder of just that panel.</li>
      <li>Use the search box above to jump straight to a topic; it matches both titles and the text inside them.</li>
    </ul>
    <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="mini-btn" onclick="closeModal('help-index-modal');startFullTutorial&&startFullTutorial()">📖 Sample story tour</button>
      <button class="mini-btn" onclick="closeModal('help-index-modal');restartTutorial&&restartTutorial()">Restart the quick tour</button>
    </div>` },
  groups: { title:'Groups', body:`
    <p>A <b>Group</b> is a coloured, labelled box drawn around a cluster of scenes on the stage, purely organizational; it never changes how the story plays.</p>
    <ul>
      <li>Create one from the toolbar's <b>+ GROUP</b> button, the Insert menu, or right-clicking empty stage space.</li>
      <li>Drag a group's header to move every scene inside it together; resize it to add or drop members.</li>
      <li>Right-click a group for <b>Fit to members</b> (shrink/grow to exactly its contents), collapse, colour, and rename.</li>
      <li>A scene's own colour tag and a group's own colour are independent; use whichever (or both) helps a busy graph read at a glance.</li>
    </ul>` },
  shortcuts: { title:'Keyboard shortcuts', body:null } // computed live from MENU_DEF, see _hiShortcutsBody()
};
// Order shown in the sidebar; MINI_TUTS entries (tutorial-parts.js) are reused
// as-is rather than copied, so editing a panel's own mini-tutorial keeps this
// index in sync automatically.
const HELP_TOPIC_ORDER = ['welcome','chars','vars','scenes','canvas','props','groups','assets','soundstudio','layers','export','settings','shortcuts'];

// #15: when a topic's own name is mentioned in running text (another Help
// topic's body, or a Settings modal hint), turn that mention into a link
// straight to it - see _hiLinkifyBox() below. Multi-word phrases match
// case-insensitively (distinctive enough on their own, e.g. "Canvas
// editor"); a bare single word only matches Title-Cased exactly (e.g.
// "Export"), so an ordinary sentence using "export" as a verb doesn't get
// linked by accident.
const HELP_TOPIC_ALIASES = {
  chars: ['Characters panel', 'Characters'],
  vars: ['Variables panel', 'Variables'],
  scenes: ['Scenes panel'],
  canvas: ['Canvas editor'],
  props: ['Properties panel'],
  groups: ['Groups'],
  assets: ['Assets library', 'Assets panel'],
  soundstudio: ['Sound Studio'],
  layers: ['Layers'],
  export: ['Export'],
  settings: ['Settings'],
};

let _hiSelected = 'welcome';

function _hiShortcutsBody(){
  if(typeof MENU_DEF==='undefined') return '<p class="hint">Shortcuts are listed in the app’s own menu bar.</p>';
  const sections = MENU_DEF.map(m=>{
    const rows=(m.items||[]).filter(it=>it.key).map(it=>`<li><b>${escHtml(it.key)}</b>; ${escHtml(it.label)}</li>`).join('');
    return rows ? `<div style="margin-bottom:10px"><b>${escHtml(m.title)}</b><ul>${rows}</ul></div>` : '';
  }).join('');
  return sections || '<p class="hint">No shortcuts are currently defined.</p>';
}
function _hiTopicTitle(key){
  if(HELP_EXTRA_TOPICS[key]) return HELP_EXTRA_TOPICS[key].title;
  if(typeof MINI_TUTS!=='undefined' && MINI_TUTS[key]) return MINI_TUTS[key].title;
  return key;
}
function _hiTopicBody(key){
  if(key==='shortcuts') return _hiShortcutsBody();
  if(HELP_EXTRA_TOPICS[key]) return HELP_EXTRA_TOPICS[key].body;
  if(typeof MINI_TUTS!=='undefined' && MINI_TUTS[key]) return MINI_TUTS[key].body;
  return '';
}
// Strips tags for plain-text search matching only; never used as HTML output.
function _hiPlainText(html){ return String(html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().toLowerCase(); }
function _hiFilterTopics(query){
  const q=String(query||'').trim().toLowerCase();
  if(!q) return HELP_TOPIC_ORDER.slice();
  return HELP_TOPIC_ORDER.filter(key=>{
    const title=_hiTopicTitle(key).toLowerCase();
    if(title.indexOf(q)>=0) return true;
    return _hiPlainText(_hiTopicBody(key)).indexOf(q)>=0;
  });
}
function ensureHelpIndexModal(){
  let bg=document.getElementById('help-index-modal');
  if(bg) return bg;
  bg=document.createElement('div'); bg.id='help-index-modal'; bg.className='modal-bg hidden';
  bg.innerHTML='<div class="modal-card settings-card">'
    + '<h2>Help Index ' + (typeof detachIconHtml==='function' ? detachIconHtml('help-index-modal', 'Help Index') : '')
    + ' <span class="hdr-icon" onclick="closeModal(\'help-index-modal\')" style="cursor:pointer">✕</span></h2>'
    + '<div class="settings-wrap">'
    + '<nav class="settings-nav">'
    + '<input type="text" id="hi-search" placeholder="Search help…" oninput="_hiSearch(this.value)" '
    + 'style="width:100%;box-sizing:border-box;background:var(--field);border:1px solid var(--line);color:var(--ink);padding:6px 8px;border-radius:4px;font-size:12px;margin-bottom:8px">'
    + '<div id="hi-list"></div>'
    + '</nav>'
    + '<div class="settings-pane modal-body" id="hi-content"></div>'
    + '</div></div>';
  document.body.appendChild(bg);
  return bg;
}
function _hiRenderList(keys){
  const list=document.getElementById('hi-list'); if(!list) return;
  if(!keys.length){ list.innerHTML='<div class="hint" style="padding:6px 2px">No topics found.</div>'; return; }
  list.innerHTML = keys.map(key=>
    `<a class="set-nav-item${key===_hiSelected?' active':''}" onclick="_hiSelect('${key}')">${escHtml(_hiTopicTitle(key))}</a>`
  ).join('');
}
function _hiRenderContent(){
  const box=document.getElementById('hi-content'); if(!box) return;
  const key=_hiSelected;
  box.innerHTML = key
    ? `<h3 style="margin-top:0;color:var(--accent)">${escHtml(_hiTopicTitle(key))}</h3>${_hiTopicBody(key)}`
    : '<div class="hint">Pick a topic on the left, or search above.</div>';
  if(key) _hiLinkifyBox(box, { excludeKeys:[key], onClick:_hiSelect });
  box.scrollTop = 0;
}
// #15: walks every real text node under `box` (never raw HTML string
// replacement, so it can't touch anything inside an existing tag or
// attribute) looking for another topic's name, and wraps each match in a
// real <a> that jumps straight there via `opts.onClick(key)`. `excludeKeys`
// skips a topic's own name inside its own body (and, from the Settings
// modal, the "settings" topic itself - linking Settings-to-Settings from
// inside Settings is circular and not useful).
function _hiLinkifyBox(box, opts){
  opts = opts || {};
  const exclude = new Set(opts.excludeKeys || []);
  const onClick = opts.onClick || _hiSelect;
  const entries = [];
  Object.keys(HELP_TOPIC_ALIASES).forEach(key=>{
    if(exclude.has(key)) return;
    HELP_TOPIC_ALIASES[key].forEach(alias=>entries.push({ key, alias, ci: alias.indexOf(' ')>=0 }));
  });
  if(!entries.length) return;
  const walker=document.createTreeWalker(box, NodeFilter.SHOW_TEXT, null);
  const nodes=[]; let n;
  while((n=walker.nextNode())) nodes.push(n);
  nodes.forEach(node=>{
    const p=node.parentNode;
    if(p && p.closest && p.closest('a,button,select,option,input,textarea,h3,code')) return;
    const frag=_hiLinkifyTextNode(node.nodeValue, entries, onClick);
    if(frag) node.parentNode.replaceChild(frag, node);
  });
}
// Scans one text node left-to-right for the EARLIEST alias match at each
// position (longest alias wins on a tie, so "Assets library" beats the
// shorter "Assets panel" starting at the same spot), splitting it into
// alternating text/<a> pieces; returns null when nothing matched at all, so
// the caller can skip an unnecessary DOM replace.
function _hiLinkifyTextNode(text, entries, onClick){
  const lower=text.toLowerCase();
  let i=0, any=false;
  const frag=document.createDocumentFragment();
  while(i<text.length){
    let best=null;
    entries.forEach(e=>{
      const idx = e.ci ? lower.indexOf(e.alias.toLowerCase(), i) : text.indexOf(e.alias, i);
      if(idx<0) return;
      const before=text[idx-1], after=text[idx+e.alias.length];
      if(before && /[a-zA-Z]/.test(before)) return; // whole-word only, so this never matches inside a longer unrelated word
      if(after && /[a-zA-Z]/.test(after)) return;
      if(!best || idx<best.idx || (idx===best.idx && e.alias.length>best.alias.length)) best={ key:e.key, alias:e.alias, idx };
    });
    if(!best){ frag.appendChild(document.createTextNode(text.slice(i))); break; }
    if(best.idx>i) frag.appendChild(document.createTextNode(text.slice(i, best.idx)));
    const a=document.createElement('a');
    a.href='javascript:void(0)';
    a.className='help-xref';
    a.textContent=text.slice(best.idx, best.idx+best.alias.length);
    a.title='Jump to the "'+_hiTopicTitle(best.key)+'" Help topic';
    (function(targetKey){ a.onclick=function(ev){ ev.preventDefault(); onClick(targetKey); }; })(best.key);
    frag.appendChild(a);
    any=true;
    i=best.idx+best.alias.length;
  }
  return any ? frag : null;
}
function _hiSelect(key){
  _hiSelected = key;
  _hiRenderList(_hiFilterTopics(document.getElementById('hi-search') ? document.getElementById('hi-search').value : ''));
  _hiRenderContent();
}
function _hiSearch(query){
  const matches=_hiFilterTopics(query);
  if(!matches.length){ _hiSelected=null; }
  else if(matches.indexOf(_hiSelected)<0){ _hiSelected=matches[0]; }
  _hiRenderList(matches);
  _hiRenderContent();
}
function openHelpIndex(){
  const bg=ensureHelpIndexModal();
  const search=document.getElementById('hi-search'); if(search) search.value='';
  _hiSelected='welcome';
  _hiRenderList(HELP_TOPIC_ORDER.slice());
  _hiRenderContent();
  bg.classList.remove('hidden');
}
// #15: opens the Help Index straight to one topic, ON TOP of whatever else
// is open (same "stack another modal, don't close this one" pattern the
// Title Screen/Credits Screen editor buttons already use from inside
// Settings) - used by feature mentions linkified outside the Help Index
// itself, e.g. in the Settings modal's own hint text.
function jumpToHelpTopic(key){ openHelpIndex(); _hiSelect(key); }
