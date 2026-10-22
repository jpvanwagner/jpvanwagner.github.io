/* ============================================================================
   Scenemaker editor; detachable panels/modals (native app only, pywebview)
   Lets any dock panel or modal pop out into its OWN separate native OS window
   (dragged to another monitor, tiled with something like PowerToys FancyZones,
   whatever the user wants), instead of staying pinned inside the main app
   window. Native-only by nature: a plain browser tab has no way to open a
   real second top-level window that shares this page's own live JS state the
   way this does (window.open() popups exist, but pywebview's own windows -
   unlike same-origin browser tabs and their `opener` reference - do NOT share
   a JS heap at all, so this needs its own relay).

   THE CORE IDEA: the main window stays the one and only place any of this
   app's real logic ever runs. Detaching a surface never moves its element,
   its render functions, or its data anywhere - it just:
     1. Hides the surface's element LOCALLY (a forced inline display:none)
        while leaving it fully alive in the DOM, still re-rendering normally
        exactly as it always has whenever its own data changes.
     2. Mirrors that element's current HTML out to the detached window
        whenever it changes (a MutationObserver, debounced).
     3. Relays user interaction (clicks, typing, drags) FROM the detached
        window's mirrored copy back onto the REAL, hidden element in the main
        window, by replaying the same event there - so every existing
        onclick/onchange/render function in this app keeps working completely
        unmodified; detach.js never needs to know what any of them do.
   Closing the detached window (from either side) just removes the forced
   display:none, and the surface reappears locally exactly as it was left -
   nothing was ever destroyed, so there's nothing to "restore".

   KNOWN LIMITS, stated plainly rather than glossed over:
     - Anything tied to the window that originally requested it (Sound
       Studio's microphone recording, via getUserMedia) can't follow a
       detached copy - recording still has to happen back in the main
       window even while that panel is popped out elsewhere.
     - Drag gestures (mousedown/move/up) relay too, so dragging still works
       detached, but each move is a real round trip through the native
       bridge, so it can feel a beat less immediate than an in-window drag.
     - Two ways to reach the exact same input at once (typing directly in a
       detached window while ALSO applying an incoming HTML update to it)
       are resolved defensively: an update destined for whatever field
       currently has focus HERE is held back until that field is blurred,
       rather than overwriting an in-progress keystroke.
   Shares core.js scope.
   ==========================================================================*/

/* ---------------------------------------------------------------------------
   Structural element addressing: a plain array of child-indexes from a root
   element down to a target, e.g. [2,0,1]. Used instead of relying on every
   element already having a stable id (most don't) - since the mirrored HTML
   in the detached window is, at the moment it's applied, an exact structural
   copy of the real element in the main window, the same path reliably
   resolves to the matching real element there too.
   ------------------------------------------------------------------------ */
function _drPathTo(root, el){
  if(el===root) return [];
  const path=[];
  let node=el;
  while(node && node!==root){
    const parent=node.parentElement;
    if(!parent) return null;
    const idx=Array.prototype.indexOf.call(parent.children, node);
    if(idx<0) return null;
    path.unshift(idx);
    node=parent;
  }
  return node===root ? path : null;
}
function _drResolvePath(root, path){
  let node=root;
  for(let i=0;i<path.length;i++){
    if(!node || !node.children || !node.children[path[i]]) return null;
    node = node.children[path[i]];
  }
  return node;
}

/* Form controls' live, user-edited value/checked state lives in their IDL
   property, not their HTML attribute, so a plain .outerHTML snapshot would
   silently serialize whatever the STALE initial markup said instead of what
   the user actually typed/checked. Synced into the attribute (harmless -
   once a control's "dirty value flag" is set, re-setting its attribute this
   way never resets the live property or disturbs focus/cursor/selection)
   right before every snapshot, so the mirror always reflects reality. */
function _drSyncFormAttrs(root){
  const els = root.querySelectorAll ? root.querySelectorAll('input,textarea,select') : [];
  Array.prototype.forEach.call(els, function(el){
    if(el.tagName==='TEXTAREA'){ el.textContent = el.value; return; }
    if(el.tagName==='SELECT'){
      Array.prototype.forEach.call(el.options, function(opt){
        if(opt.value===el.value) opt.setAttribute('selected',''); else opt.removeAttribute('selected');
      });
      return;
    }
    if(el.type==='checkbox' || el.type==='radio'){
      if(el.checked) el.setAttribute('checked',''); else el.removeAttribute('checked');
      return;
    }
    el.setAttribute('value', el.value);
  });
}

/* ---------------------------------------------------------------------------
   Main-window side: detachSurface() is the public entry point, wired to a
   pop-out icon on each detachable surface's own header.
   ------------------------------------------------------------------------ */
const _detachMirrors = {}; // viewId -> { observer, pushTimer }
function detachSurface(viewId, title){
  if(!HAS_BRIDGE()){ if(typeof toast==='function') toast('Detaching into its own window needs the native app.'); return; }
  const el = document.getElementById(viewId);
  if(!el) return;
  if(_detachMirrors[viewId]) return;   // already detached
  window.pywebview.api.open_detached(viewId, title || document.title).then(function(r){
    if(!r || !r.ok) return;
    el.style.setProperty('display','none','important');
    _startMirroring(viewId, el);
  });
}
function _startMirroring(viewId, el){
  const push = function(){
    if(!HAS_BRIDGE()) return;
    _drSyncFormAttrs(el);
    // el itself carries the forced display:none!important that hides it
    // LOCALLY (detachSurface set that before mirroring ever started) - a
    // bare el.outerHTML would ship that same "hidden" style into the
    // detached window's copy too, hiding it there as well. Snapshotted from
    // a clone with just that one override stripped, rather than touching
    // the live element's own style even briefly (no flicker, no spurious
    // extra MutationObserver cycle from watching our own edit).
    const clone = el.cloneNode(true);
    clone.style.removeProperty('display');
    window.pywebview.api.push_to_view(viewId, clone.outerHTML);
  };
  const mirror = { observer:null, pushTimer:null };
  mirror.observer = new MutationObserver(function(){
    clearTimeout(mirror.pushTimer);
    mirror.pushTimer = setTimeout(push, 80);
  });
  mirror.observer.observe(el, {childList:true, subtree:true, attributes:true, characterData:true});
  _detachMirrors[viewId] = mirror;
  push();   // initial snapshot
}
function _stopMirroring(viewId){
  const m = _detachMirrors[viewId]; if(!m) return;
  m.observer.disconnect(); clearTimeout(m.pushTimer);
  delete _detachMirrors[viewId];
}
/* Bridge -> main window: the detached window for viewId was closed. */
function __detachClosed(viewId){
  _stopMirroring(viewId);
  const el = document.getElementById(viewId);
  if(el) el.style.removeProperty('display');
}
/* Bridge -> main window: replay an interaction that happened in the
   detached copy onto the real, still-live element here. */
function __detachReceive(viewId, kind, payload){
  const el = document.getElementById(viewId); if(!el) return;
  const target = _drResolvePath(el, payload.path||[]); if(!target) return;
  if(kind==='input' || kind==='change'){
    if(Object.prototype.hasOwnProperty.call(payload,'checked')) target.checked = payload.checked;
    else target.value = payload.value;
  }
  let evt;
  if(kind==='input' || kind==='change'){
    evt = new Event(kind, {bubbles:true, cancelable:true});
  } else if(kind==='keydown' || kind==='keyup'){
    evt = new KeyboardEvent(kind, {bubbles:true, cancelable:true, key:payload.key, code:payload.key,
      ctrlKey:!!payload.ctrlKey, metaKey:!!payload.metaKey, shiftKey:!!payload.shiftKey});
  } else {
    // Mouse coordinates travel as an offset from the TARGET's own top-left
    // (offsetX/offsetY, per payload.ox/oy below), not raw viewport clientX/Y -
    // the detached window is a different, differently-positioned/sized
    // window, so a bare clientX/Y would be meaningless once replayed here.
    // Reconstructed against the real target's OWN current position in this
    // window, so any handler reading e.clientX/Y relative to its own
    // getBoundingClientRect() (chromaPick's pixel-sampling, for one) gets a
    // value that's actually correct for where the element really sits here.
    const r = target.getBoundingClientRect();
    const clientX = r.left + (payload.ox||0), clientY = r.top + (payload.oy||0);
    evt = new MouseEvent(kind, {bubbles:true, cancelable:true, clientX:clientX, clientY:clientY});
  }
  target.dispatchEvent(evt);
}

/* ---------------------------------------------------------------------------
   Detached-window side: gated behind a #detached=<viewId> URL FRAGMENT that
   app_native.py's open_detached() appends when it opens the second window.
   Deliberately a fragment, not a query string (?detached=<viewId>, what this
   used to be) - some Windows webview backends fail a local file:// URL's
   whole navigation outright when it carries a `?`, treating the query
   string as part of the literal filename to look up rather than a query
   delimiter (the exact bug a real report traced #overlay=1's own former
   query string to - see editor.html's matching comment). A `#` fragment is
   never involved in file lookup on any engine, so this sidesteps it
   entirely. Boots into a bare shell showing just the mirrored surface,
   full-window. */
function _detachViewIdFromUrl(search){
  const m = /[?&#]detached=([^&]+)/.exec(String(search||''));
  return m ? decodeURIComponent(m[1]) : null;
}
let _detachViewId = null;
let _detachPendingHtml = null;
const _DETACH_RELAY_EVENTS = ['click','dblclick','contextmenu','mousedown','mouseup','keydown','keyup'];
const _DETACH_VALUE_EVENTS = ['input','change'];
let _detachLastMouseMove = 0;
function _detachBootIfNeeded(){
  // location.hash is the real, current signal; location.search stays here
  // too only defensively, in case anything ever still sends it as a query
  // string (see _detachViewIdFromUrl's own comment above for why the query
  // string form was dropped).
  const id = _detachViewIdFromUrl(location.hash + location.search);
  if(!id) return false;
  _detachViewId = id;
  document.documentElement.classList.add('detached-view');
  document.title = 'Scenemaker; ' + id;
  document.body.innerHTML = '';
  _detachWireDelegation();
  return true;
}
function _detachWireDelegation(){
  if(document.body._detachWired) return;
  document.body._detachWired = true;
  const relay = function(type, payload){
    if(!_detachViewId || !HAS_BRIDGE()) return;
    window.pywebview.api.relay_to_main(_detachViewId, type, payload);
  };
  const rootEl = function(){ return document.body.firstElementChild; };
  _DETACH_RELAY_EVENTS.forEach(function(type){
    document.addEventListener(type, function(e){
      const root = rootEl(); if(!root) return;
      const path = _drPathTo(root, e.target); if(path===null) return;
      // ox/oy: offset from e.target's OWN top-left (offsetX/offsetY), not a
      // raw viewport clientX/Y - the receiving side reconstructs a real
      // clientX/Y against wherever the equivalent element actually sits in
      // the main window, since that's what handlers reading e.clientX/Y
      // actually mean by it (see __detachReceive's own comment).
      relay(type, {path:path, ox:e.offsetX, oy:e.offsetY, key:e.key, ctrlKey:e.ctrlKey, metaKey:e.metaKey, shiftKey:e.shiftKey});
    }, true);
  });
  // mousemove is far chattier than any other event (dozens/sec during a
  // drag) - throttled separately so relaying a drag gesture doesn't flood
  // the native bridge with a call for every single pixel of movement.
  document.addEventListener('mousemove', function(e){
    const now=Date.now(); if(now-_detachLastMouseMove<30) return; _detachLastMouseMove=now;
    const root = rootEl(); if(!root) return;
    const path = _drPathTo(root, e.target); if(path===null) return;
    relay('mousemove', {path:path, ox:e.offsetX, oy:e.offsetY});
  }, true);
  _DETACH_VALUE_EVENTS.forEach(function(type){
    document.addEventListener(type, function(e){
      const root = rootEl(); if(!root) return;
      const path = _drPathTo(root, e.target); if(path===null) return;
      const payload = {path:path, value:e.target.value};
      if(e.target.type==='checkbox' || e.target.type==='radio') payload.checked = e.target.checked;
      relay(type, payload);
    }, true);
  });
  // A field mid-edit here always wins over an incoming update destined for
  // it; once it loses focus, apply whatever arrived while it was busy.
  document.addEventListener('focusout', function(){
    if(_detachPendingHtml){ const h=_detachPendingHtml; _detachPendingHtml=null; __detachApply(h); }
  }, true);
}
/* Bridge -> detached window: a fresh snapshot of the mirrored surface. */
function __detachApply(html){
  const active = document.activeElement;
  if(active && (active.tagName==='INPUT' || active.tagName==='TEXTAREA' || active.isContentEditable)){
    _detachPendingHtml = html;
    return;
  }
  document.body.innerHTML = html;
}

/* Small, consistent pop-out icon for any detachable surface's own header.
   iconClass defaults to the .hdr-icon convention every modal's own ✕ already
   uses; dock panels pass 'dock-ic' instead, to match their own header icon
   row's styling. onmousedown always stops propagation - harmless anywhere,
   and necessary in a dock panel header, whose own mousedown starts a drag. */
function detachIconHtml(viewId, title, iconClass){
  return '<span class="'+(iconClass||'hdr-icon')+'" title="Open in its own window (native app only)" '+
    'onmousedown="event.stopPropagation()" onclick="detachSurface(\''+viewId+'\',\''+(title||'').replace(/'/g,"\\'")+'\')">⧉</span>';
}
