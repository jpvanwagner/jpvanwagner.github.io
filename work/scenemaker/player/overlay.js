/* ============================================================================
   Scenemaker player; Overlay/popup embed mode (global: VNOverlay)
   Lets an exported scenario run as a layer on top of ANOTHER page or game
   instead of filling its own tab: a full-screen mode (the host page/game
   shows through everywhere the scene itself has no background set, same as
   a letterbox) or a small centered modal popup with its own backdrop. Two
   ways to use the same exported file:
     - iframe: point a host page's <iframe> at this file. The host shows/
       hides the iframe itself; this script applies the chosen mode's CSS on
       load and reports back over postMessage - an 'ended' message in the
       same {source:'scenemaker-embed', ...} envelope the "embeddable HTML"
       export's own resize signal already uses - once a run reaches an
       ending.
     - direct mount (same-origin only, by construction): a host page calls
       VNOverlay.mount(container, opts) to render straight into its own
       element instead of an iframe; results go to opts.onEnd directly since
       there's no frame boundary to relay across.
   Config comes from window.VN_OVERLAY_OPTS, injected at export time the same
   way window.VN_PROJECT already is (see scorm.py's build_overlay_html) - a
   mount() call's own opts take over instead, for a host that wants to pick
   modes at runtime rather than bake one in at export time. Completely inert
   or a project that hasn't turned on the Overlay/popup export: nothing here
   runs, so a normal SCORM/preview/lite export is byte-for-byte unaffected.
   ========================================================================= */
(function(){
  'use strict';
  var _cfg = null, _onEnd = null;

  function baseCfg(){
    return (window.VN_OVERLAY_OPTS && typeof window.VN_OVERLAY_OPTS==='object') ? window.VN_OVERLAY_OPTS : {};
  }

  // Draws the chosen mode's CSS hooks (see player/index_template.html's own
  // "#overlay" stylesheet block for what each class actually does) and the
  // optional dim backdrop. Idempotent: a stray double-call (mount() after
  // the config already applied itself on load) just re-applies the same
  // classes rather than stacking a second dim layer.
  function applyMode(o){
    var root=document.documentElement;
    root.classList.remove('vn-overlay-fullscreen','vn-overlay-modal','vn-overlay-noportraits');
    root.classList.add('vn-overlay', o.mode==='modal' ? 'vn-overlay-modal' : 'vn-overlay-fullscreen');
    if(o.hidePortraits) root.classList.add('vn-overlay-noportraits');
    if(o.mode==='modal'){
      root.style.setProperty('--vn-overlay-w', (o.modalWidth!=null?o.modalWidth:70)+'%');
      root.style.setProperty('--vn-overlay-h', (o.modalHeight!=null?o.modalHeight:70)+'%');
    }
    var dim=document.getElementById('vn-overlay-dim');
    if(o.dim===false){ if(dim && dim.parentNode) dim.parentNode.removeChild(dim); }
    else {
      if(!dim){ dim=document.createElement('div'); dim.id='vn-overlay-dim'; document.body.insertBefore(dim, document.body.firstChild); }
      dim.style.opacity = String((o.dimAlpha!=null?o.dimAlpha:60)/100);
    }
  }

  function report(result){
    if(_onEnd){ try{ _onEnd(result); }catch(e){} }
    try{
      if(window.parent && window.parent!==window){
        window.parent.postMessage(Object.assign({source:'scenemaker-embed', type:'ended'}, result), '*');
      }
    }catch(e){}
  }

  window.VNOverlay = {
    // Called once from runtime.js's endOrChoices(), every time a run reaches
    // an ending - a no-op whenever overlay mode isn't actually on, so this
    // costs nothing on every other export. `result` is a plain
    // {endingId, title, vars} object runtime.js already builds; this file
    // never reaches into the player's own state directly, keeping it a
    // self-contained, independently loadable module per the project's
    // strict-modularity rule.
    onEnded: function(result){ if(_cfg && _cfg.enabled) report(result); },

    // Direct DOM-embed entry point: a same-origin host page that would
    // rather not use an iframe at all calls this once, after this script has
    // loaded, to move the player's own stage into its own container and
    // apply the chosen mode. opts overrides window.VN_OVERLAY_OPTS entirely
    // (a host picking modes at runtime, e.g. per-scene, rather than baking
    // exactly one mode in at export time).
    mount: function(container, opts){
      opts = opts || {};
      _cfg = Object.assign({enabled:true, mode:'fullscreen', dim:true, dimAlpha:60}, baseCfg(), opts);
      _onEnd = opts.onEnd || null;
      if(container){
        var stage=document.getElementById('vn-fit');
        if(stage && stage.parentNode!==container) container.appendChild(stage);
      }
      applyMode(_cfg);
    }
  };

  // iframe case: nothing to wait on, apply immediately from the injected
  // config exactly like every other window.VN_* boot-time read in this
  // player already does.
  _cfg = baseCfg();
  if(_cfg.enabled) applyMode(_cfg);
})();
