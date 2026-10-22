/* ============================================================================
   Scenemaker editor; tool settings (editor-wide preferences, persisted)
   Part of the modular editor. Classic script sharing global scope with core.js.

   Persistence: settings are stored durably in a per-user settings.json, read
   and written through whichever backend is actually running - app.py's own
   GET/POST /__settings in browser mode, or the equivalent get_settings()/
   save_settings() bridge calls in native mode (app_native.py; there is no
   HTTP server there at all, so /__settings simply doesn't exist to fetch()).
   Both backends read/write the exact same settings.json format, so a
   preference set in one mode (theme, panel layout, whether the tutorial's
   been seen, everything) is visible in the other too - without this, native
   mode only ever saw its own empty file:// localStorage and looked like a
   different, older install every time. localStorage is used only as a fast
   synchronous cache/mirror in both modes. On boot we seed from the cache,
   then pull the durable copy and re-apply the look.
   ==========================================================================*/
const _TS_PREFIX = 'sm_';
let _tsCache = {}; // authoritative in-memory copy (string values)
let _tsSaveTimer = null;

// seed synchronously from localStorage so first paint has values
(function _tsSeed(){
  try{
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
      if(k && k.indexOf(_TS_PREFIX)===0) _tsCache[k.slice(_TS_PREFIX.length)] = localStorage.getItem(k);
    }
  }catch(e){}
})();

// pywebview injects window.pywebview.api asynchronously, some short time
// after this page's own scripts start running - it fires a one-time
// 'pywebviewready' event once that's actually done. Calling a bridge
// method before then is a real, documented pywebview gotcha: HAS_BRIDGE()
// (which just checks whether window.pywebview.api already exists) can
// genuinely still read false at that exact instant, especially for the
// very FIRST bridge call a page makes - ToolSettings.load(), called early
// in core.js's own window 'load' handler, often is - which then silently
// looks identical to "no bridge at all" and falls back to
// fetch('/__settings'), which has nothing to reach in native mode.
// Deliberately NOT a synchronous "wait before the first attempt" (that
// would delay every browser-mode load too, since there is no cheap way
// from in here to tell "native app whose bridge just isn't ready yet"
// apart from "plain browser tab, no bridge ever coming" ahead of time) -
// instead, load() still tries immediately as before, and this listens
// once for the real readiness signal to run a correcting reconciliation
// pass right after, in case that first attempt raced and lost. Costs
// nothing when the bridge either was already ready (the event still fires,
// this just reconciles again with the same result) or never comes at all
// (a plain browser tab, or pywebview's older builds that don't fire it -
// this listener then just never runs, same as before it existed).
// A native window ALWAYS loads editor.html over file:// (app_native.py's
// _file_url()); app.py's browser mode ALWAYS serves it over http(s). That
// makes location.protocol a synchronous, 100%-reliable way to tell "this is
// definitely native mode, the pywebview bridge WILL exist eventually" apart
// from "a plain browser tab, no bridge is ever coming" - unlike HAS_BRIDGE()
// itself, which reads false during the real startup race described above
// (pywebview injects window.pywebview.api asynchronously, sometime after
// this page's own scripts start running). Without this distinction, load()/
// _pushNow() below used to fall through to fetch('/__settings') the moment
// the bridge merely wasn't ready YET, not only when it was truly never
// coming - and in native mode that fetch has no server to reach at all, so
// it silently no-ops (GET, load() just returns the stale cache) or silently
// drops the write (POST). That's how the exact bug Api.get_settings()'s own
// comment describes (app_native.py) could resurface even after that fix
// landed: a slow bridge injection meant the very FIRST load() call (fired
// synchronously on the page's 'load' event, see core.js) could race, lose,
// and give up for good rather than waiting - leaving the theme/tutorial-seen
// state read back from disk never applied at all, not just applied a moment
// late; a 'pywebviewready' listener registered too late to catch an
// injection that already happened, or a build that doesn't fire that event
// reliably, left nothing to correct it afterward either.
function _tsIsNativeOrigin(){
  try{ return location.protocol==='file:'; }catch(e){ return false; }
}
// Polls for window.pywebview.api to actually exist (up to ~4s, generous next
// to pywebview's own documented injection delay) instead of trusting a
// single readiness check or the 'pywebviewready' event alone.
function _tsWaitForBridge(){
  return new Promise(function(resolve){
    const started=Date.now();
    (function poll(){
      if(typeof HAS_BRIDGE==='function' && HAS_BRIDGE()){ resolve(true); return; }
      if(Date.now()-started > 4000){ resolve(false); return; }
      setTimeout(poll, 50);
    })();
  });
}

try{
  window.addEventListener('pywebviewready', function(){
    ToolSettings.load().then(function(){
      if(typeof loadToolTheme==='function') loadToolTheme();
      if(typeof applyGridStyle==='function') applyGridStyle();
      if(typeof applyWorkspacePrefs==='function') applyWorkspacePrefs();
      if(typeof loadWorkspacePrefsUI==='function') loadWorkspacePrefsUI();
      if(typeof tutorialVersionCheck==='function') tutorialVersionCheck();
    });
  }, { once:true });
}catch(e){}

const ToolSettings = {
  get(key, dflt){
    if(Object.prototype.hasOwnProperty.call(_tsCache,key)) return _tsCache[key];
    try{ const v=localStorage.getItem(_TS_PREFIX+key); if(v!=null){ _tsCache[key]=v; return v; } }catch(e){}
    return dflt;
  },
  set(key, val){
    val = String(val); _tsCache[key]=val;
    try{ localStorage.setItem(_TS_PREFIX+key, val); }catch(e){}
    ToolSettings._pushSoon();
  },
  all(){ return Object.assign({}, _tsCache); },
  // Pull the durable copy (native bridge in native mode, /__settings over
  // HTTP otherwise) and merge it in (durable copy wins). Returns a promise.
  load(){
    if(typeof HAS_BRIDGE==='function' && HAS_BRIDGE() && window.pywebview.api.get_settings){
      return Promise.resolve(window.pywebview.api.get_settings()).then(ToolSettings._mergeIn).catch(function(){ return _tsCache; });
    }
    if(_tsIsNativeOrigin()){
      // Definitely native mode; the bridge just isn't ready yet - wait for
      // it instead of ever falling through to fetch() below, which has no
      // server to reach here and would otherwise silently return the
      // not-yet-reconciled cache as if that were the real, durable state.
      return _tsWaitForBridge().then(function(ready){
        if(ready && window.pywebview.api.get_settings){
          return Promise.resolve(window.pywebview.api.get_settings()).then(ToolSettings._mergeIn).catch(function(){ return _tsCache; });
        }
        return _tsCache;
      });
    }
    // #demo: HAS_SERVER() is false on static hosting (no app.py there to
    // answer /__settings at all - a Neocities demo build, or just editor.html
    // opened straight from disk) just like it already is for SCORM/Save/
    // Open elsewhere; skip straight to the in-memory/localStorage cache
    // instead of firing a fetch() that can only ever fail there.
    if(typeof fetch!=='function' || !HAS_SERVER()) return Promise.resolve(_tsCache);
    return fetch('/__settings').then(function(r){ return r.ok?r.json():{}; }).then(ToolSettings._mergeIn).catch(function(){ return _tsCache; });
  },
  _mergeIn(obj){
    if(obj && typeof obj==='object'){
      Object.keys(obj).forEach(function(k){ _tsCache[k]=String(obj[k]);
        try{ localStorage.setItem(_TS_PREFIX+k, String(obj[k])); }catch(e){} });
    }
    return _tsCache;
  },
  _pushSoon(){
    // Native mode: always schedule the push, even before the bridge exists -
    // _pushNow() below waits for it rather than needing save_settings to
    // already be callable right now (mirrors load()'s own native handling).
    // #demo: on static hosting (HAS_SERVER() false, same signal as load()
    // above) there's neither a bridge nor a server to push to either, so
    // skip scheduling it at all rather than firing a fetch() that can only
    // ever fail 250ms from now.
    if(!_tsIsNativeOrigin() && !(typeof HAS_BRIDGE==='function' && HAS_BRIDGE() && window.pywebview.api.save_settings) && (typeof fetch!=='function' || !HAS_SERVER())) return;
    if(_tsSaveTimer) clearTimeout(_tsSaveTimer);
    _tsSaveTimer=setTimeout(ToolSettings._pushNow, 250);
  },
  _pushNow(){
    _tsSaveTimer=null;
    try{
      if(typeof HAS_BRIDGE==='function' && HAS_BRIDGE() && window.pywebview.api.save_settings){ window.pywebview.api.save_settings(_tsCache); return; }
      if(_tsIsNativeOrigin()){
        // Bridge not ready yet at the 250ms mark; wait for it rather than
        // dropping this write on the floor (fetch() has no server to reach
        // here) - retries with whatever _tsCache holds at the moment the
        // bridge actually comes up, not a stale snapshot from now.
        _tsWaitForBridge().then(function(ready){
          if(ready && window.pywebview.api.save_settings) window.pywebview.api.save_settings(_tsCache);
        });
        return;
      }
      if(!HAS_SERVER()) return; // #demo: nothing listening on static hosting; the localStorage write above is all that's possible there
      fetch('/__settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(_tsCache)}).catch(function(){});
    }catch(e){}
  }
};
