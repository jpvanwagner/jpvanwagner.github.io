/* ============================================================================
   Scenemaker; Visual Novel Player Runtime  (v3)
   ----------------------------------------------------------------------------
   Adds on top of v2:
     • Title screen (precedes the story; endings can return to it)
     • Full-screen cutscenes (text over background, no dialogue box; dim + FX)
     • Variables (choices add/subtract/set them; choices can be greyed/hidden
       until a variable threshold is met)
     • Dice-roll choices (roll N d<sides> + modifier vs a target -> success/fail)

   Bookmark stays compact for SCORM 1.2:  {s,i,v[],sc,vars{}}
   ==========================================================================*/
(function(){
  'use strict';
  var P = window.VN_PROJECT || {};
  var scenes = P.scenes || {};
  var settings = P.settings || {};
  settings.nav = settings.nav || {};
  settings.screen = settings.screen || {};
  var TITLE = P.title || {enabled:false};
  // {token} substitution from project info (title screen, credits, dialogue).
  // #99: `rich` (only ever passed true for dialogue/cutscene text, the two
  // places that actually render through vnRenderRich()) wraps a {{token}}'s
  // substituted value in the variable's own optional style, IF it has one.
  // Never on by default: everywhere else subst() is used (title heading,
  // credits, HUD/menu labels) sets plain .textContent, which would otherwise
  // show the [kw=...] markup as literal bracket text instead of rendering it.
  function subst(t, rich){ if(t==null) return ''; var m=P.meta||{}; var now=new Date();
    return String(t)
      .replace(/\{title\}/g, (m.title||''))
      .replace(/\{author\}/g, (m.author||''))
      .replace(/\{email\}/g, (m.email||''))
      .replace(/\{website\}/g, (m.website||''))
      .replace(/\{year\}/g, String(now.getFullYear()))
      // #64: the PLAYER'S OWN local clock, read fresh each time a line
      // shows (not a fixed value baked in at export) - {time}/{date} use
      // the browser's own locale formatting so they read naturally in
      // whatever region the module is actually played in.
      .replace(/\{time\}/g, now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}))
      .replace(/\{date\}/g, now.toLocaleDateString())
      .replace(/\{weekday\}/g, now.toLocaleDateString(undefined,{weekday:'long'}))
      .replace(/\{month\}/g, now.toLocaleDateString(undefined,{month:'long'}))
      .replace(/\{day\}/g, String(now.getDate()))
      .replace(/\{\{\s*([^}]+?)\s*\}\}/g, function(mm, nm){
        var v=(P.variables||[]).find(function(x){ return x.name===nm || x.id===nm; });
        var val=(v && state.vars[v.id]!=null) ? String(state.vars[v.id]) : '';
        var st=v && v.style;
        if(rich && st && (st.color||st.bold||st.italic)){
          return '[kw='+(st.color||'')+'|'+(st.bold?'1':'')+'|'+(st.italic?'1':'')+']'+val+'[/kw]';
        }
        return val;
      });
  }
  // #99: keyphrases - a project-wide list of words/phrases (Variables panel,
  // Settings -> Info & credits has nothing to do with this) that always get a
  // consistent look wherever they appear in dialogue/cutscene text, plus any
  // character whose own "highlight name" toggle is on (bold, and coloured if
  // that character has an editor colour set). Computed fresh each call rather
  // than cached, so a character rename/recolour picks up immediately without
  // needing its own separate sync step.
  function keyphraseList(){
    var list=[], seen={};
    (P.keyphrases||[]).forEach(function(k){
      if(k && k.phrase && (k.color||k.bold||k.italic) && !seen[k.phrase.toLowerCase()]){
        seen[k.phrase.toLowerCase()]=1;
        list.push({phrase:k.phrase, color:k.color||'', bold:!!k.bold, italic:!!k.italic});
      }
    });
    (CHARS||[]).forEach(function(c){
      if(c && c.highlightName && c.name && !seen[c.name.toLowerCase()]){
        seen[c.name.toLowerCase()]=1;
        list.push({phrase:c.name, color:c.color||'', bold:true, italic:false});
      }
    });
    list.sort(function(a,b){ return b.phrase.length-a.phrase.length; }); // longest phrase wins at a shared start position
    return list;
  }
  function _kwEscapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function applyKeywordHighlights(text){
    if(!text) return text;
    var list=keyphraseList(); if(!list.length) return text;
    var byLower={}, alts=[];
    list.forEach(function(k){ var low=k.phrase.toLowerCase(); if(byLower[low]) return; byLower[low]=k; alts.push(_kwEscapeRe(k.phrase)); });
    if(!alts.length) return text;
    // one combined alternation, one pass - matching each span of text at most
    // once avoids double-wrapping a shorter phrase that sits inside a longer
    // one already matched (longest-first order in the list above).
    var re=new RegExp('\\b(?:'+alts.join('|')+')\\b','gi');
    return text.replace(re, function(m){
      var k=byLower[m.toLowerCase()]; if(!k) return m;
      return '[kw='+(k.color||'')+'|'+(k.bold?'1':'')+'|'+(k.italic?'1':'')+']'+m+'[/kw]';
    });
  }
  function showInputPrompt(c, cb){
    var ov=document.createElement('div'); ov.className='vn-ov'; ov.style.cssText='position:absolute;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72)';
    var vDef=(P.variables||[]).find(function(x){return x.id===c.askInput.var||x.name===c.askInput.var;});
    var cur=(vDef && state.vars[vDef.id]!=null)?state.vars[vDef.id]:'';
    ov.innerHTML='<div style="background:#12151c;color:#e5e7eb;border:1px solid #333;border-radius:12px;padding:20px 22px;max-width:440px;width:90%"><div style="margin-bottom:10px">'+crEsc(c.askInput.label||'Enter a value:')+'</div><input id="vn-input-field" type="text" value="'+crEsc(cur)+'" style="width:100%;padding:8px 10px;font-size:15px;border-radius:6px;border:1px solid #475569;background:#0b1120;color:#fff"><div style="text-align:right;margin-top:12px"><button class="vn-choice" id="vn-input-ok">OK</button></div></div>';
    (document.getElementById('vn-root')||document.body).appendChild(ov);
    var fld=ov.querySelector('#vn-input-field'); if(fld) fld.focus();
    function submit(){ var val=fld?fld.value:''; if(vDef){ state.vars[vDef.id]=coerceVar(vDef, val); } if(ov.parentNode)ov.parentNode.removeChild(ov); cb&&cb(); }
    ov.querySelector('#vn-input-ok').addEventListener('click', function(e){ e.stopPropagation(); submit(); });
    if(fld) fld.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); submit(); } });
  }
  function coerceVar(v, val){ if(!v) return val; if(v.type==='number') return (parseFloat(val)||0); if(v.type==='bool') return (val===true||val==='true'||val==='1'); return String(val); }
  function crEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function creditsAvailable(){ var m=P.meta||{};
    return !!(m.author||m.website||m.email||(m.socials&&m.socials.length)||(m.collaborators&&m.collaborators.length)||(P.credits&&P.credits.length)); }
  // #98: the credits screen editor's own config; every field defaults to the
  // exact old, hardcoded behaviour, so a project that's never opened it
  // renders byte-for-byte the same credits overlay as before this existed.
  function creditsScreenCfg(){
    return Object.assign({ style:'static', scrollSpeed:40, bg:{type:'none',media:null,fit:'cover'}, music:{media:null,volume:0.6},
      textColor:'', headingColor:'', closeLabel:'Close', showAuthor:true, showTeam:true, showAssetCredits:true, showSocials:true }, P.creditsScreen||{});
  }
  function buildCreditsHtml(cfg){
    cfg = cfg || creditsScreenCfg();
    var m=P.meta||{}, body='';
    if(cfg.showAuthor){
      if(m.author) body+='<div class="vn-cr-row"><b>'+crEsc(m.author)+'</b></div>';
      if(m.website) body+='<div class="vn-cr-row">'+crEsc(m.website)+'</div>';
      if(m.email) body+='<div class="vn-cr-row">'+crEsc(m.email)+'</div>';
    }
    if(cfg.showSocials){ (m.socials||[]).forEach(function(s){ if(s.label||s.url) body+='<div class="vn-cr-row">'+crEsc(s.label)+(s.url?(': '+crEsc(s.url)):'')+'</div>'; }); }
    if(cfg.showTeam && (m.collaborators||[]).length){ body+='<h4>Team</h4>'; m.collaborators.forEach(function(c){ if(c.name||c.role) body+='<div class="vn-cr-row">'+crEsc(c.name)+(c.role?(': '+crEsc(c.role)):'')+'</div>'; }); }
    if(cfg.showAssetCredits && (P.credits||[]).length){ body+='<h4>Credits &amp; attributions</h4>'; P.credits.forEach(function(c){ if(c.asset||c.author||c.url){ body+='<div class="vn-cr-row">'+crEsc(c.asset||'')+(c.author?(': '+crEsc(c.author)):'')+(c.license?(' ('+crEsc(c.license)+')'):'')+(c.url?('<br><span style="opacity:.7;font-size:.85em">'+crEsc(c.url)+'</span>'):'')+'</div>'; } }); }
    var headStyle = cfg.headingColor ? (';color:'+crEsc(cfg.headingColor)) : '';
    return '<h3 style="margin:0 0 12px'+headStyle+'">'+crEsc(TITLE.creditsHeading||'Credits')+'</h3>'+(body||'<div class="vn-cr-row">No credits added.</div>');
  }
  var _creditsMusicEl = null;
  function stopCreditsMusic(){ if(_creditsMusicEl){ try{ _creditsMusicEl.pause(); }catch(e){} _creditsMusicEl=null; } }
  function showCreditsOverlay(){
    var cfg=creditsScreenCfg();
    var ov=document.getElementById('vn-credits');
    if(!ov){ ov=document.createElement('div'); ov.id='vn-credits';
      ov.style.cssText='position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center';
      (document.getElementById('vn-root')||document.body).appendChild(ov); }
    // #98: an optional custom background (image/video) behind the credits
    // panel, in place of the plain dark dim; untouched (bg.type:'none')
    // renders the exact same rgba(0,0,0,.72) dim as always.
    var bg=cfg.bg||{}, bgHtml='', overlayBg='rgba(0,0,0,.72)';
    if(bg.type==='image' && bg.media){ overlayBg='rgba(0,0,0,.45)';
      var bgSize=({cover:'cover',stretch:'100% 100%',contain:'contain',tile:'auto',center:'auto'})[bg.fit||'cover'];
      var bgRepeat=(bg.fit==='tile')?'repeat':'no-repeat';
      bgHtml='<div style="position:absolute;inset:0;background-image:url(\''+mediaSrc(bg.media)+'\');background-size:'+bgSize+';background-repeat:'+bgRepeat+';background-position:center"></div>';
    } else if(bg.type==='video' && bg.media){ overlayBg='rgba(0,0,0,.45)';
      var ofit=({cover:'cover',stretch:'fill',contain:'contain',tile:'none',center:'none'})[bg.fit||'cover'];
      bgHtml='<video src="'+mediaSrc(bg.media)+'" autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:'+ofit+'"></video>';
    }
    ov.style.background=overlayBg;
    var textStyle = cfg.textColor ? (';color:'+crEsc(cfg.textColor)) : ';color:#e5e7eb';
    var contentHtml=buildCreditsHtml(cfg);
    var closeLabel=crEsc(cfg.closeLabel||'Close');
    var panelHtml;
    if(cfg.style==='scroll'){
      // a real movie-style roll: content scrolls up from below the visible
      // area, looping forever, while a Close button stays pinned so it's
      // always dismissible (unlike a real film credits roll, this is an
      // in-game overlay someone may want to skip).
      panelHtml = '<div style="position:relative;width:100%;height:100%;max-width:640px;overflow:hidden'+textStyle+'">'
        + '<div id="vn-cr-scroll-inner" style="position:absolute;left:0;right:0;top:100%;text-align:center;animation:vnCrScroll linear infinite">'+contentHtml+'</div></div>'
        + '<button class="vn-choice" id="vn-cr-close" style="position:absolute;top:14px;right:14px">'+closeLabel+'</button>';
    } else {
      panelHtml = '<div style="max-width:560px;max-height:82%;overflow:auto;background:#12151c;border:1px solid #333;border-radius:12px;padding:22px 26px;line-height:1.6;box-shadow:0 20px 50px rgba(0,0,0,.5)'+textStyle+'">'
        + contentHtml
        + '<button class="vn-choice" id="vn-cr-close" style="margin-top:16px">'+closeLabel+'</button></div>';
    }
    ov.innerHTML = bgHtml + panelHtml;
    ov.style.display='flex';
    document.getElementById('vn-cr-close').addEventListener('click', function(e){ e.stopPropagation(); ov.style.display='none'; stopCreditsMusic(); });
    if(cfg.style==='scroll'){
      var inner=document.getElementById('vn-cr-scroll-inner'), wrap=inner&&inner.parentElement;
      if(inner && wrap){
        var dist = inner.scrollHeight + wrap.clientHeight;
        var dur = Math.max(4, dist / Math.max(10, cfg.scrollSpeed||40));
        inner.style.animationDuration = dur+'s';
      }
    }
    if(cfg.music && cfg.music.media){
      stopCreditsMusic();
      _creditsMusicEl = new Audio(mediaSrc(cfg.music.media));
      _creditsMusicEl.loop = true;
      _creditsMusicEl.volume = (cfg.music.volume!=null ? cfg.music.volume : 0.6);
      var crP=_creditsMusicEl.play(); if(crP&&crP.catch)crP.catch(function(){});
    }
  }
  var VARDEFS = P.variables || [];
  var CHARS = P.characters || [];

  // Resolve a scene cast entry: if it links a library character (charId), pull the
  // character's props; otherwise the entry carries its own props.
  function resolveFace(entry){
    if(entry && entry.charId){ var c=CHARS.filter(function(x){return x.id===entry.charId;})[0]; if(c) return c; }
    return entry || {};
  }

  // Rich text lives in rich.js (window.vnRenderRich); fonts in theme.js (VN_FONTS).
  var FONTS = window.VN_FONTS || {};

  var state = { s:settings.startScene, i:0, v:[], sc:0, vars:{}, interactions:0 };
  var history = [], histPos = -1;
  var completed = false, canAdvance = false;
  var _creditsAutoShown = false; // #5: the automatic end-credits popup fires at most once per playthrough; navRestart() resets it
  var curMusic = null, curFade = 0, curBg = null, fadeTimer = null, pendingRoll = null;
  // #7: the single in-box/cutscene "click to continue" element currently on
  // screen (dialogue box or cutscene choices area) - tracked so a fresh one
  // never gets appended on top of a stale one left over from an earlier
  // line, scene, or restart. showContinuePrompt()/showCutsceneLine() create
  // it; hideContinuePrompt() is the one place that removes it.
  var _contHintInBox = null;
  // #80: which extra dialogue-box SLOTS (index into showDialogueLine's own
  // `boxes` array, not a literal box2/3/4 id - see there) have had a line
  // spoken through them at least once THIS scene; reset whenever a genuinely
  // new scene is entered (render(), below). Drives the optional
  // "hide until spoken" behavior for boxes 2-4 (the main box always shows,
  // to avoid disturbing the many places that already assume it's always
  // present/visible).
  var _spokenSlots = {};
  // #92: which box SLOT (index into showDialogueLine's own `boxes` array) a
  // given library character last spoke through, remembered ACROSS scenes for
  // the rest of this playthrough - unlike _spokenSlots above (per-scene,
  // reset every scene entry), this deliberately survives scene changes, so a
  // character who was "box 2" in one scene doesn't jump to "box 1" just
  // because a different scene happens to list its cast in a different order.
  // Keyed by the stable project.characters[] id (characterFor() resolves
  // this), so it only ever applies to a character actually linked to the
  // library; an ad-hoc scene-only cast entry has no cross-scene identity to
  // persist against and always falls back to that scene's own cast order.
  // Reset on navRestart() (a fresh playthrough), same as visitCount.
  var _charBoxSlot = {};
  // #81: the currently-typing line's scene/box, so handleTextOverflow()
  // (called from VNType.onTick, which only gets the text element itself)
  // can call showContinuePrompt() with the same args showDialogueLine()
  // itself would.
  var _curScene=null, _curActiveBox=null;
  // in-game tools state (#4 volumes, #8 backlog)
  var _musVol=1, _sfxVol=1, _typeVol=1, _mute=false, _speedScale=1, curBaseVol=0.6;
  var VNLog = []; // backlog of seen lines + choices, in order
  function applyAudioVolume(){
    if(audioEl) audioEl.volume=Math.max(0,Math.min(1, curBaseVol*_musVol*(_mute?0:1)));
    if(window.VNSfx&&VNSfx.setMasterVolume) VNSfx.setMasterVolume(_mute?0:_sfxVol);
    if(window.VNTypeSound&&VNTypeSound.setMasterVolume) VNTypeSound.setMasterVolume(_mute?0:_typeVol);
    if(window.VNCursorSound&&VNCursorSound.setMasterVolume) VNCursorSound.setMasterVolume(_mute?0:_sfxVol);
  }
  // mouse hover or keyboard focus on any menu option (choice buttons, HUD
  // settings items) plays the cursor sound, when settings.cursorSound.enabled.
  function wireCursorSound(btn){
    if(!btn) return;
    var play=function(){ if(window.VNCursorSound) VNCursorSound.play(); };
    btn.addEventListener('mouseenter', play);
    btn.addEventListener('focus', play);
  }
  function logLine(scene, i){
    var line=scene.lines[i]; if(!line) return;
    var last=VNLog[VNLog.length-1];
    if(last && last.kind==='line' && last.s===scene.id && last.i===i) return; // dedupe re-renders
    var spk=characterFor(line); 
    VNLog.push({kind:'line', s:scene.id, i:i, scene:scene.title||'', speaker:spk?spk.name:'', text:subst(line.text||'')});
  }
  function logChoice(c, before, audioBefore){
    var entry={kind:'choice', text:c.text||'(continue)', effects:[]};
    if(P.settings && P.settings.hud && P.settings.hud.backlogEffects){
      (c.effects||[]).forEach(function(e){ if(!e||!e.var) return; var d=varDef(e.var); var nm=(d&&d.name)||e.var;
        entry.effects.push(nm+': '+(before[e.var]!=null?before[e.var]:'?')+' → '+state.vars[e.var]); });
      var AUDIO_NAME={music:'Music volume', sfx:'SFX volume', typing:'Typing volume'};
      (c.audioFx||[]).forEach(function(e){ if(!e||!audioBefore) return; var cur=e.source==='music'?_musVol:e.source==='sfx'?_sfxVol:_typeVol;
        entry.effects.push((AUDIO_NAME[e.source]||e.source)+': '+Math.round((audioBefore[e.source]||0)*100)+'% → '+Math.round(cur*100)+'%'); });
    }
    VNLog.push(entry);
  }
  // ---- in-game tools API (consumed by hud.js) ----------------------------
  window.VNRuntime = {
    log: VNLog,
    hud: (P.settings && P.settings.hud) || {},
    fullscreenRoot: function(){ return document.getElementById('vn-root')||document.body; },
    setMusicVol: function(v){ _musVol=clamp01(v); applyAudioVolume(); },
    setSfxVol:   function(v){ _sfxVol=clamp01(v); applyAudioVolume(); },
    setTypeVol:  function(v){ _typeVol=clamp01(v); applyAudioVolume(); },
    setMute:     function(b){ _mute=!!b; applyAudioVolume(); },
    isMuted:     function(){ return _mute; },
    getVolumes:  function(){ return { music:_musVol, sfx:_sfxVol, typing:_typeVol }; },
    setSpeedScale: function(v){ _speedScale=(Number(v)||1); },
    getSpeedScale: function(){ return _speedScale; },
    // #47: a per-line note (text only) wins over the scene's own note when
    // both exist, since it's the more specific one for whatever's on screen
    // right now; onSceneChange (despite the name) already fires on every
    // line render, not just real scene changes, so this stays live as the
    // player advances through a scene, not just when they land on it.
    currentDevNote: function(){
      var sc=scenes[state.s]; if(!sc) return null;
      var ln=sc.lines&&sc.lines[state.i];
      if(ln && ln.note && ln.note.trim()) return {text:ln.note, media:[]};
      if(sc.devNote&&((sc.devNote.text||'').trim()||(sc.devNote.media&&sc.devNote.media.length))) return sc.devNote;
      return null;
    },
    mediaUrl: function(k){ return k; },
    onSceneChange: null
  };
  function clamp01(v){ v=Number(v); if(isNaN(v))return 1; return Math.max(0,Math.min(1,v)); }

  var stage, fit, bgLayer, portraitLayer, box, speakerEl, textEl, choicesEl, docBtn, navEl, audioEl;
  var csEl, csDim, csWrap, csText, csChoices, titleEl;
  var narrEl, narrDim, narrText, narrChoices; // #168: unattributed ("narrator") lines
  var viewerEl, viewerStage, viewerImg, viewerVideo, viewerCaption, viewerChoices; // #90: photo/video viewer scenes

  function grab(){
    stage=el('vn-stage'); fit=el('vn-fit'); bgLayer=el('vn-bg'); portraitLayer=el('vn-portraits');
    box=el('vn-box'); speakerEl=el('vn-speaker'); textEl=el('vn-text'); choicesEl=el('vn-choices');
    docBtn=el('vn-doc'); navEl=el('vn-nav'); audioEl=el('vn-audio');
    csEl=el('vn-cs'); csDim=el('vn-cs-dim'); csWrap=el('vn-cs-wrap'); csText=el('vn-cs-text'); csChoices=el('vn-cs-choices');
    titleEl=el('vn-title');
    narrEl=el('vn-narr'); narrDim=el('vn-narr-dim'); narrText=el('vn-narr-text'); narrChoices=el('vn-narr-choices');
    viewerEl=el('vn-viewer'); viewerStage=el('vn-viewer-stage'); viewerImg=el('vn-viewer-img');
    viewerVideo=el('vn-viewer-video'); viewerCaption=el('vn-viewer-caption'); viewerChoices=el('vn-viewer-choices');
  }
  function el(id){ return document.getElementById(id); }
  function mediaSrc(k){ return (k && P.media && P.media[k]) ? P.media[k] : k; }   // data-URL from the map (preview) or the key as a relative path (export)

  // #3: canvas size presets - mirrors editor/modules/project-settings.js's
  // CANVAS_SIZES exactly. Every box/choices/portrait position is stored as a
  // PERCENTAGE of the stage, so switching presets only ever needs a
  // different reference width/height here; 'widescreen' keeps the app's
  // original 1000x640 exactly, so a project with no canvasSize set renders
  // byte-identical to before this feature existed.
  var CANVAS_SIZES = { widescreen:{w:1000,h:640}, standard:{w:1000,h:750}, portrait:{w:562,h:1000}, landscape:{w:1000,h:562} };
  var _stageW=1000, _stageH=640;
  function applyCanvasSize(){
    var cs = CANVAS_SIZES[(settings.screen&&settings.screen.canvasSize)] || CANVAS_SIZES.widescreen;
    _stageW=cs.w; _stageH=cs.h;
    if(stage){ stage.style.width=_stageW+'px'; stage.style.height=_stageH+'px'; }
  }
  function fitScale(){ if(!fit||!stage)return; var s=Math.min(fit.clientWidth/_stageW, fit.clientHeight/_stageH); stage.style.transform='scale('+s+')'; }

  function applyScreen(){ vnApplyScreen(settings, stage); }   // theme.js
  // #59: opt-in (Settings > Screen & frame); blocks right-click and text
  // selection in preview/export. Off leaves everything exactly as before.
  function applyLockdown(){
    if(!(settings.screen && settings.screen.lockdown)) return;
    document.body.classList.add('vn-lockdown');
    document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }

  // ---- in-game debug panel (interaction count + reset-all + live variable editor)
  function setupDebug(){
    var dbg = settings.debug || {};
    var btn = el('vn-debug-btn'), panel = el('vn-debug-panel');
    var show = dbg.enabled && (dbg.varEditor || dbg.resetAll || dbg.interactionCount);
    btn.style.display = show ? 'block' : 'none';
    if(!show) return;
    btn.onclick = function(e){ e.stopPropagation(); var open=panel.style.display!=='none'; panel.style.display=open?'none':'block'; if(!open) renderDebugPanel(); };
    panel.addEventListener('click', function(e){ e.stopPropagation(); });
    var rb = el('vn-debug-reset');
    rb.style.display = dbg.resetAll ? 'block' : 'none';
    rb.onclick = function(e){ e.stopPropagation(); panel.style.display='none'; navRestart(); };
    updateDebugCount();
  }
  // called on every choice made and on restart, so the count stays live even
  // while the panel is left open across a choice (renderDebugPanel() itself
  // only runs when the panel is opened, not on every subsequent choice).
  function updateDebugCount(){
    var dbg = settings.debug || {}; var el2 = el('vn-debug-count'); if(!el2) return;
    if(!(dbg.enabled && dbg.interactionCount)){ el2.style.display='none'; return; }
    el2.style.display='block';
    el2.textContent = 'Interactions this run: ' + (state.interactions||0);
  }
  function afterDebugEdit(){
    saveBookmark();
    var scene=scenes[state.s]; if(!scene) return;
    renderSceneLine(scene, state.i);
  }
  // #168: unattributed lines float over the stage instead of using a
  // scene's normal dialogue box; a cutscene already floats its text over a
  // hidden stage, so an unattributed line there is left to the cutscene
  // renderer rather than double-floating it. #90: a viewer scene is its own
  // full-screen mode too, so it's excluded from the narrator-line check the
  // same way cutscene already is.
  function renderSceneLine(scene, idx){
    var line=scene.lines[idx];
    if(scene.mode==='viewer') showViewerScene(scene, idx);
    else if(line && line.unattributed && scene.mode!=='cutscene') showNarratorLine(scene, idx);
    else if(scene.mode==='cutscene') showCutsceneLine(scene, idx);
    else showDialogueLine(scene, idx);
  }
  function renderDebugPanel(){
    updateDebugCount();
    var dbg = settings.debug || {}; var box = el('vn-debug-vars'); box.innerHTML='';
    if(!dbg.varEditor){ box.innerHTML='<div style="opacity:.6">Variable editor is off.</div>'; return; }
    if(!VARDEFS.length){ box.innerHTML='<div style="opacity:.6">No variables defined.</div>'; return; }
    VARDEFS.forEach(function(d){
      var row=document.createElement('div'); row.className='dbg-row';
      var lab=document.createElement('label'); lab.textContent=d.name; lab.title=d.name; row.appendChild(lab);
      var t=d.type||'number', cur=state.vars[d.id], ctrl;
      if(t==='bool'){ ctrl=document.createElement('input'); ctrl.type='checkbox'; ctrl.checked=toBool(cur);
        ctrl.onchange=function(){ state.vars[d.id]=ctrl.checked; afterDebugEdit(); }; }
      else if(t==='text'){ ctrl=document.createElement('input'); ctrl.type='text'; ctrl.value=String(cur==null?'':cur); ctrl.style.width='120px';
        ctrl.oninput=function(){ state.vars[d.id]=ctrl.value; afterDebugEdit(); }; }
      else { ctrl=document.createElement('input'); ctrl.type='number'; ctrl.value=Number(cur||0); ctrl.style.width='84px';
        ctrl.oninput=function(){ state.vars[d.id]=Number(ctrl.value)||0; afterDebugEdit(); }; }
      row.appendChild(ctrl); box.appendChild(row);
    });
  }

  // ---- variables (number / text / bool) -----------------------------------
  function varDef(id){ return VARDEFS.filter(function(d){return d.id===id;})[0]; }
  function typeOf(id){ var d=varDef(id); return (d&&d.type)||'number'; }
  function toBool(v){ return v===true||v==='true'||v===1||v==='1'; }
  function typedInit(d){ var t=d.type||'number'; return t==='bool'?toBool(d.initial):(t==='text'?String(d.initial==null?'':d.initial):(Number(d.initial)||0)); }
  function initVars(){ var v={}; VARDEFS.forEach(function(d){ v[d.id]=typedInit(d); }); return v; }
  function clampVar(def, val){ if(!def) return val; if(def.min!=null && val<def.min) val=def.min; if(def.max!=null && val>def.max) val=def.max; return val; }
  function applyEffects(effects){
    if(!effects) return;
    effects.forEach(function(e){
      if(!e || !e.var) return;
      var def=varDef(e.var), t=(def&&def.type)||'number', cur=state.vars[e.var], nv=cur;
      if(t==='bool'){ nv = e.op==='toggle' ? !toBool(cur) : toBool(e.value); }
      else if(t==='text'){ nv = String(e.value==null?'':e.value); }               // 'set'
      else { var c=Number(cur||0), val=Number(e.value)||0;
        nv = e.op==='add' ? c+val : e.op==='sub' ? c-val : val;
        nv = clampVar(def, nv); }
      state.vars[e.var]=nv;
    });
  }
  // Audio-volume choice effects (#7): a separate list from the variable
  // effects above, since it targets a channel (music/sfx/typing) rather than
  // a story variable. Values are 0-100%; 'set' is absolute, 'adjust' is a
  // delta on top of whatever the player (or a prior effect) already set.
  function applyAudioFx(list){
    if(!list || !list.length) return;
    list.forEach(function(e){
      var delta=(Number(e.value)||0)/100;
      var cur = e.source==='music'?_musVol : e.source==='sfx'?_sfxVol : _typeVol;
      var next = clamp01(e.mode==='adjust' ? cur+delta : delta);
      if(e.source==='music') _musVol=next; else if(e.source==='sfx') _sfxVol=next; else _typeVol=next;
    });
    applyAudioVolume();
  }
  function cmpTyped(type, a, op, b){
    if(type==='bool'){ a=toBool(a); b=toBool(b); return op==='!=' ? a!==b : a===b; }
    if(type==='text'){ a=String(a==null?'':a); b=String(b==null?'':b);
      if(op==='contains') return a.indexOf(b)>=0; return op==='!=' ? a!==b : a===b; }
    a=Number(a); b=Number(b);
    switch(op){ case '>=':return a>=b; case '<=':return a<=b; case '>':return a>b; case '<':return a<b; case '==':return a===b; case '!=':return a!==b; } return true;
  }
  function evalCondition(c){
    if(!c.condition || !c.condition.var) return {show:true, locked:false};
    var ok = cmpTyped(typeOf(c.condition.var), state.vars[c.condition.var], c.condition.cmp||'==', c.condition.value);
    if(ok) return {show:true, locked:false};
    return (c.condition.hide==='hidden') ? {show:false, locked:false} : {show:true, locked:true};
  }
  // #4: variable-based branching. Routes are checked top-to-bottom (priority order);
  // the first whose "var cmp value" is true wins. A route with no var is an
  // unconditional catch-all. If none match, the choice's default connection is used.
  function routeTarget(c){
    if(!c.routes || !c.routes.length) return null;
    for(var i=0;i<c.routes.length;i++){ var r=c.routes[i]; if(!r.target) continue;
      if(r.var==null || r.var===''){ return r.target; }
      if(cmpTyped(typeOf(r.var), state.vars[r.var], r.cmp||'==', r.value)) return r.target;
    }
    return null;
  }
  function choiceExit(c){
    return (c.outcomes && c.outcomes.some(function(o){return o.targetNode;}))
        || (c.routes && c.routes.some(function(r){return r.target;}))
        || (c.dice && c.dice.enabled);
  }

  // ---- boot ---------------------------------------------------------------
  // #4: a module icon (project.meta.icon, a picked image/icon file) becomes
  // the browser-tab favicon in both preview and the exported SCORM package;
  // no-op when unset, so an old project with none looks exactly as before.
  function applyFavicon(){
    var icon=(P.meta&&P.meta.icon)||null; if(!icon) return;
    var link=document.querySelector('link[rel="icon"]');
    if(!link){ link=document.createElement('link'); link.rel='icon'; document.head.appendChild(link); }
    link.href=mediaSrc(icon);
  }
  function boot(){
    grab(); applyScreen(); applyCanvasSize(); applyFavicon(); setupDebug(); applyLockdown();
    if(window.VNCursorSound){ var cs=settings.cursorSound||{}; VNCursorSound.set(cs, cs.media?mediaSrc(cs.media):null); }
    state.vars = initVars();
    if(window.SCORM) SCORM.init();
    var resumed=false;
    if(!window.VN_PREVIEW && window.SCORM){
      var bm=SCORM.getBookmark();
      if(bm){ try{ var r=JSON.parse(bm); if(r && r.s && scenes[r.s]){ state=r; if(!state.vars) state.vars=initVars(); resumed=true; } }catch(e){} }
    }
    if(!scenes[state.s]) state.s=settings.startScene||Object.keys(scenes)[0];

    fitScale(); window.addEventListener('resize', fitScale);
    if(window.ResizeObserver){ try{ new ResizeObserver(fitScale).observe(fit); }catch(e){} }

    stage.addEventListener('click', function(e){
      // #90: releasing a real photo-viewer drag fires a native click right
      // after mouseup same as any other click would; swallow just that one
      // so panning around a photo never also advances the story.
      if(_viewerDragMoved){ _viewerDragMoved=false; e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
    stage.addEventListener('click', tryAdvance);
    if(viewerVideo) viewerVideo.addEventListener('click', function(e){ e.stopPropagation(); }); // clicking the native video controls must not also advance the story
    if(viewerImg){
      viewerImg.addEventListener('mousedown', function(e){ if(!_viewerActive) return; e.preventDefault(); _viewerDrag={x:e.clientX,y:e.clientY,offX:_viewerOffX,offY:_viewerOffY}; _viewerDragMoved=false; viewerStage.classList.add('dragging'); });
      viewerImg.addEventListener('touchstart', function(e){ if(!_viewerActive||!e.touches[0]) return; var t=e.touches[0]; _viewerDrag={x:t.clientX,y:t.clientY,offX:_viewerOffX,offY:_viewerOffY}; _viewerDragMoved=false; }, {passive:true});
    }
    window.addEventListener('mousemove', function(e){
      if(!_viewerDrag) return;
      var dx=e.clientX-_viewerDrag.x, dy=e.clientY-_viewerDrag.y;
      if(Math.abs(dx)>4||Math.abs(dy)>4) _viewerDragMoved=true;
      _viewerOffX=_viewerDrag.offX+dx; _viewerOffY=_viewerDrag.offY+dy; _viewerClamp(); _viewerApply();
    });
    window.addEventListener('touchmove', function(e){
      if(!_viewerDrag||!e.touches[0]) return;
      var t=e.touches[0]; var dx=t.clientX-_viewerDrag.x, dy=t.clientY-_viewerDrag.y;
      if(Math.abs(dx)>4||Math.abs(dy)>4) _viewerDragMoved=true;
      _viewerOffX=_viewerDrag.offX+dx; _viewerOffY=_viewerDrag.offY+dy; _viewerClamp(); _viewerApply();
    }, {passive:true});
    window.addEventListener('mouseup', function(){ _viewerDrag=null; if(viewerStage) viewerStage.classList.remove('dragging'); });
    window.addEventListener('touchend', function(){ _viewerDrag=null; });
    if(viewerStage) viewerStage.addEventListener('wheel', function(e){
      if(!_viewerActive) return; e.preventDefault();
      _viewerZoom=Math.max(1,Math.min(4,_viewerZoom+(e.deltaY>0?-0.15:0.15))); _viewerClamp(); _viewerApply();
    }, {passive:false});
    document.addEventListener('keydown', function(e){
      var cp=(P.settings&&P.settings.continuePrompt)||{}; var keys=cp.keys||[];
      if(!keys.length) return; // default: click only, unless the author opted a key in
      var tag=document.activeElement&&document.activeElement.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA') return; // don't hijack the ask-input prompt, etc.
      var name = e.code==='Space' ? 'Space' : e.key; // Space needs .code (.key is literally ' ')
      if(keys.indexOf(name)===-1) return;
      e.preventDefault(); tryAdvance();
    });
    el('vn-back').addEventListener('click', function(e){ e.stopPropagation(); navBack(); });
    el('vn-fwd').addEventListener('click', function(e){ e.stopPropagation(); navFwd(); });
    el('vn-restart').addEventListener('click', function(e){ e.stopPropagation(); navRestart(); });
    docBtn.addEventListener('click', function(e){ e.stopPropagation(); });
    el('vn-title-start').addEventListener('click', function(e){ e.stopPropagation(); startFromTitle(); });
    document.addEventListener('click', function(){ if(curMusic && audioEl.paused){ var p=audioEl.play(); if(p&&p.catch)p.catch(function(){}); } });

    history=[snapshot()]; histPos=0;

    // typing sound (#9) + word-triggered SFX (#7) both ride the typewriter's per-unit hook
    VNType.onTick = function(elx, i, unit, delay){ VNTypeSound.blip(unit, delay); VNSfx.tick(elx.textContent); tickWordCues(elx.textContent); handleTextOverflow(elx); };

    // Show the title screen first (fresh start only); a resumed LMS session skips it.
    if(TITLE.enabled && !resumed){ showTitle(); }
    else { hideTitle(); visitCount[state.s]=(visitCount[state.s]||0)+1; render(); }
  }

  // ---- title screen -------------------------------------------------------
  // #96: bg.fit ('cover' default matches the old hardcoded CSS exactly, so
  // an untouched project renders byte-identical) - background-image sizing
  // has no single CSS property, so this maps a fit name to the 3 that do.
  function applyTitleBgFit(bgEl, fit){
    var map={ cover:{size:'cover',repeat:'no-repeat',pos:'center'}, stretch:{size:'100% 100%',repeat:'no-repeat',pos:'center'},
      contain:{size:'contain',repeat:'no-repeat',pos:'center'}, tile:{size:'auto',repeat:'repeat',pos:'top left'},
      center:{size:'auto',repeat:'no-repeat',pos:'center'} };
    var m=map[fit]||map.cover;
    bgEl.style.backgroundSize=m.size; bgEl.style.backgroundRepeat=m.repeat; bgEl.style.backgroundPosition=m.pos;
  }
  // a <video> has no repeat/tile analogue, so 'tile' falls back to 'center'
  function applyTitleVideoFit(v, fit){
    v.style.objectFit=({cover:'cover',stretch:'fill',contain:'contain',tile:'none',center:'none'})[fit]||'cover';
    if(fit==='tile'||fit==='center') v.style.objectPosition='center';
  }
  var _titlePlaysLeft=0;
  function handleTitleMusicEnded(){
    if(_titlePlaysLeft>1){ _titlePlaysLeft--; try{ audioEl.currentTime=0; var pr=audioEl.play(); if(pr&&pr.catch)pr.catch(function(){}); }catch(e){} }
  }
  // a small, self-contained "fire and forget" clip player for the title
  // screen's own optional hover cue - deliberately NOT routed through
  // VNSfx (built around a LINE's queued/word-triggered effects, a
  // different shape of problem) since this is just "play this one clip on
  // mouseenter". Assigning via .onmouseenter (a property, not
  // addEventListener) is what makes re-running showTitle() (every
  // navRestart() back to the title) idempotent instead of stacking a fresh
  // listener - and therefore a fresh, overlapping playback - on every visit.
  function playTitleHoverSound(){ var key=TITLE.hoverSound; if(!key) return;
    try{ var a=new Audio(mediaSrc(key)); var p=a.play(); if(p&&p.catch)p.catch(function(){}); }catch(e){} }
  function wireHoverSound(elx){ if(elx) elx.onmouseenter = TITLE.hoverSound ? playTitleHoverSound : null; }
  // no brand logo set is shipped/maintained here - just a plain glyph keyed
  // off the link's own label, matched loosely so "Twitter/X", "My Discord",
  // etc all still resolve; anything unrecognized gets a generic chain-link.
  var SOCIAL_ICONS={ twitter:'𝕏', x:'𝕏', bluesky:'🦋', mastodon:'🐘', instagram:'📷',
    facebook:'📘', youtube:'▶', tiktok:'🎵', discord:'💬', twitch:'🎮',
    patreon:'Ⓟ', itch:'🎮', github:'🐙', reddit:'👽', linkedin:'in', website:'🌐' };
  function socialIconGlyph(label){ var k=String(label||'').toLowerCase();
    for(var name in SOCIAL_ICONS){ if(k.indexOf(name)>=0) return SOCIAL_ICONS[name]; } return '🔗'; }
  function renderTitleMenuItems(){
    var host=el('vn-title-menu'); if(!host) return; host.innerHTML='';
    (TITLE.menuItems||[]).forEach(function(mi){
      if(!mi || !mi.type) return;
      if(mi.type==='credits' && !creditsAvailable()) return; // nothing to show; don't offer a dead button
      var btn=document.createElement('button'); btn.className='vn-title-menu-btn';
      btn.textContent = subst(mi.label || (mi.type==='credits'?'Credits':mi.type==='settings'?'Settings':'Link'));
      btn.addEventListener('click', function(e){ e.stopPropagation();
        if(mi.type==='credits') showCreditsOverlay();
        else if(mi.type==='settings'){ if(window.VNHud && window.VNHud.openSettings) window.VNHud.openSettings(); }
        else if(mi.type==='url' && mi.url){ window.open(mi.url, '_blank', 'noopener'); } });
      wireHoverSound(btn); host.appendChild(btn);
    });
  }
  function renderTitleSocials(){
    var host=el('vn-title-social'); if(!host) return; host.innerHTML='';
    if(!TITLE.showSocials) return;
    ((P.meta&&P.meta.socials)||[]).forEach(function(s){
      if(!s||!s.url) return;
      var a=document.createElement('a'); a.className='vn-title-social-ic'; a.href=s.url; a.target='_blank'; a.rel='noopener';
      a.title=s.label||s.url; a.textContent=socialIconGlyph(s.label);
      wireHoverSound(a); host.appendChild(a);
    });
  }
  function showTitle(){
    var _ld=document.getElementById('vn-loading'); if(_ld) _ld.style.display='none';
    titleEl.style.display='block';
    var bg=TITLE.bg||{type:'none'}, fit=bg.fit||'cover';
    var bgEl=el('vn-title-bg'); bgEl.innerHTML='';
    applyTitleBgFit(bgEl, fit);
    if(bg.type==='image'&&bg.media){ bgEl.style.backgroundImage='url("'+mediaSrc(bg.media)+'")'; }
    else if(bg.type==='video'&&bg.media){ bgEl.style.backgroundImage='none';
      var v=document.createElement('video'); v.src=mediaSrc(bg.media); v.autoplay=true; v.loop=true; v.muted=true; v.playsInline=true;
      v.playbackRate=(bg.speed>0?bg.speed:1); applyTitleVideoFit(v, fit); bgEl.appendChild(v); }
    else bgEl.style.backgroundImage='none';
    el('vn-title-h').textContent = subst(TITLE.heading || (P.meta&&P.meta.title) || '');
    el('vn-title-sub').textContent = subst(TITLE.subheading || '');
    var startBtn=el('vn-title-start'); startBtn.textContent = TITLE.startLabel || 'Start'; wireHoverSound(startBtn);
    renderTitleMenuItems();
    renderTitleSocials();
    // title music (optional); playCount>0 plays that many times then stops
    // instead of looping forever - handleTitleMusicEnded() (wired via
    // audioEl.onended, a property so it's cleanly replaced/cleared rather
    // than stacking) counts down and restarts playback until it hits 0.
    var m=TITLE.music||{}, playCount=m.playCount>0?m.playCount:0;
    _titlePlaysLeft=playCount;
    if(m.media){ setMusicRaw(mediaSrc(m.media), playCount>0?false:(m.loop!==false), (m.volume!=null?m.volume:0.6), 0);
      audioEl.onended = playCount>0 ? handleTitleMusicEnded : null; }
    else audioEl.onended=null;
  }
  function startFromTitle(){
    hideTitle();
    audioEl.onended=null; // done with the title screen's own play-count bookkeeping; scene music never uses this hook
    state.s=settings.startScene||Object.keys(scenes)[0]; state.i=0;
    history=[snapshot()]; histPos=0; visitCount[state.s]=(visitCount[state.s]||0)+1;
    render();
  }
  function hideTitle(){ titleEl.style.display='none'; }

  // ---- navigation / history ----------------------------------------------
  function snapshot(){ return {s:state.s, i:state.i, vars:JSON.parse(JSON.stringify(state.vars))}; }
  // #83/#118: scene transitions - a fade/slide/wipe/zoom/iris/flip effect on
  // ONE specific link (outcome.transition, set in the editor via the
  // connection line's own indicator), played as the stage genuinely changes
  // scenes. `trans` is undefined for every existing/untouched link, so this
  // is a pure no-op (0ms, moves immediately) unless an author configured one.
  var TRANS_KF = { fade:{out:'vnSceneFadeOut',in:'vnSceneFadeIn'},
    slide:{ up:{out:'vnSceneSlideOutUp',in:'vnSceneSlideInUp'}, down:{out:'vnSceneSlideOutDown',in:'vnSceneSlideInDown'},
            left:{out:'vnSceneSlideOutLeft',in:'vnSceneSlideInLeft'}, right:{out:'vnSceneSlideOutRight',in:'vnSceneSlideInRight'} },
    wipe:{ up:{out:'vnSceneWipeOutUp',in:'vnSceneWipeInUp'}, down:{out:'vnSceneWipeOutDown',in:'vnSceneWipeInDown'},
           left:{out:'vnSceneWipeOutLeft',in:'vnSceneWipeInLeft'}, right:{out:'vnSceneWipeOutRight',in:'vnSceneWipeInRight'} },
    zoom:{out:'vnSceneZoomOut',in:'vnSceneZoomIn'},
    iris:{out:'vnSceneIrisOut',in:'vnSceneIrisIn'},
    flip:{out:'vnSceneFlipOut',in:'vnSceneFlipIn'} };
  var TRANS_DUR = { fade:.35, slide:.4, wipe:.4, zoom:.35, iris:.45, flip:.4 };
  var TRANS_DIRECTIONAL = { slide:1, wipe:1 }; // the only types that read spec.dir
  function transKeyframe(spec, isIn){
    if(!spec || !spec.type || spec.type==='none' || !TRANS_KF[spec.type]) return null;
    if(!TRANS_DIRECTIONAL[spec.type]) return TRANS_KF[spec.type][isIn?'in':'out'];
    var g=TRANS_KF[spec.type][spec.dir||'up']||TRANS_KF[spec.type].up; return g[isIn?'in':'out'];
  }
  function playTransitionSide(spec, isIn){
    var frame=document.getElementById('vn-frame'); var kf=transKeyframe(spec, isIn);
    if(!frame || !kf) return 0;
    var speed=(spec.speed>0)?spec.speed:1, dur=(TRANS_DUR[spec.type]||.35)/speed;
    frame.style.animation=''; void frame.offsetWidth; // restart even if the same keyframe just played
    frame.style.animation=kf+' '+dur.toFixed(3)+'s ease both';
    return Math.round(dur*1000);
  }
  function playSceneTransition(trans, doMove){
    var outSpec = trans && (trans.mode==='combined' ? trans.combined : trans.out);
    var inSpec = trans && (trans.mode==='combined' ? trans.combined : trans.in);
    var outDur = playTransitionSide(outSpec, false);
    if(outDur>0) setTimeout(function(){ doMove(); playTransitionSide(inSpec, true); }, outDur);
    else { doMove(); playTransitionSide(inSpec, true); }
  }
  function moveTo(s,i,trans){
    playSceneTransition(trans, function(){
      if(i===0) visitCount[s]=(visitCount[s]||0)+1; // count each fresh entry (loops re-count)
      state.s=s; state.i=i;
      history=history.slice(0,histPos+1); history.push(snapshot()); histPos=history.length-1;
      render();
    });
  }
  function restoreFrom(h){ state.s=h.s; state.i=h.i; if(h.vars) state.vars=JSON.parse(JSON.stringify(h.vars)); render(); }
  function navBack(){ if(histPos>0){ histPos--; restoreFrom(history[histPos]); } }
  function navFwd(){ if(histPos<history.length-1){ histPos++; restoreFrom(history[histPos]); } }
  function navRestart(){ state.vars=initVars(); state.i=0; state.s=settings.startScene||Object.keys(scenes)[0]; state.interactions=0; visitCount={}; _creditsAutoShown=false; _charBoxSlot={};
    if(P.settings && P.settings.hud && P.settings.hud.backlogResetOnReplay) VNLog.length=0; // #85; mutate in place, VNRuntime.log holds this same array
    history=[]; histPos=-1; if(TITLE.enabled){ showTitle(); history=[snapshot()]; histPos=0; } else moveTo(state.s,0); updateDebugCount(); }
  function updateNav(){ el('vn-back').disabled=histPos<=0; el('vn-fwd').disabled=histPos>=history.length-1; }

  // ---- media --------------------------------------------------------------
  function clearFade(){ if(fadeTimer){ clearInterval(fadeTimer); fadeTimer=null; } }
  function stopMusicWithFade(seconds, done){
    if(!curMusic){ done&&done(); return; }
    if(!seconds||seconds<=0){ audioEl.pause(); done&&done(); return; }
    clearFade(); var sv=audioEl.volume, steps=Math.max(1,Math.round(seconds*20)), n=0;
    fadeTimer=setInterval(function(){ n++; audioEl.volume=Math.max(0,sv*(1-n/steps));
      if(n>=steps){ clearFade(); audioEl.pause(); audioEl.volume=sv; done&&done(); } },50);
  }
  function setMusicRaw(media, loop, vol, fade){
    if(media===curMusic){ if(media){ audioEl.loop=loop; if(vol!=null)curBaseVol=vol; applyAudioVolume(); curFade=fade||0; } return; }
    var startNew=function(){ if(media){ audioEl.src=media; audioEl.loop=loop; curBaseVol=(vol!=null?vol:0.6); applyAudioVolume();
      var pr=audioEl.play(); if(pr&&pr.catch)pr.catch(function(){}); curMusic=media; curFade=fade||0; } else { curMusic=null; curFade=0; } };
    stopMusicWithFade(curFade, startNew);
  }
  function setMusic(scene){ var m=scene.music||{};
    if(m.stop){ setMusicRaw(null, false, 0, m.fadeOut||0); return; }   // explicit silence
    // A URL-streamed track (the embeddable HTML export's one supported audio
    // source, but honoured here too so a normal preview/SCORM play matches
    // it) plays straight from that address; no project.media/mediaSrc() involved.
    if(m.source==='url' && m.url){ setMusicRaw(m.url, m.loop!==false, (m.volume!=null?m.volume:0.6), m.fadeOut||0); return; }
    if(!m.media){ return; }                                            // no track here: keep whatever is playing (continues across scenes)
    setMusicRaw(mediaSrc(m.media), m.loop!==false, (m.volume!=null?m.volume:0.6), m.fadeOut||0); }

  function setBackground(scene){
    var bg=scene.bg||{type:'none'}; var key=(bg.type!=='none')?bg.media:null;
    if(key===curBg && bg.type==='video') return;
    curBg=key;
    if(bg.type==='image'&&bg.media){ bgLayer.innerHTML=''; bgLayer.style.backgroundImage='url("'+mediaSrc(bg.media)+'")'; }
    else if(bg.type==='video'&&bg.media){ bgLayer.style.backgroundImage='none'; bgLayer.innerHTML=''; var v=document.createElement('video'); v.src=mediaSrc(bg.media); v.autoplay=true; v.loop=true; v.muted=true; v.playsInline=true; bgLayer.appendChild(v); }
    else { bgLayer.style.backgroundImage='none'; bgLayer.innerHTML=''; }
  }
  var faceEls = {}, stageScene = null, _carriedCharIds = {};
  var POS = {farLeft:16, left:30, center:50, right:70, farRight:84};
  function posPct(p){ return (typeof p==='number') ? p : (POS[p]!=null?POS[p]:50); }
  function clearStage(){ portraitLayer.innerHTML=''; faceEls={}; }
  // How far portraitLayer's own `bottom` (it fills the frame from top:0 down
  // to this) needs to sit above the frame's bottom edge so its own bottom
  // edge lands exactly on the dialogue box's TOP edge, not the box's height.
  // Those only match when the box itself is flush against the frame's bottom
  // (its CSS `bottom` is 0); any box with a gap below it (an 'h' that doesn't
  // reach all the way to 100%, e.g. a layout with margin under the box) made
  // the old box.offsetHeight-only math undershoot by exactly that gap, so an
  // auto/bottom-anchored portrait sank down into the box instead of sitting
  // above it. box.offsetTop already accounts for the gap either way.
  function _portraitsBottomPx(boxEl){
    var frameEl=document.getElementById('vn-frame');
    if(!frameEl || !boxEl) return (boxEl && boxEl.offsetHeight) || 180;
    return Math.max(0, frameEl.offsetHeight - boxEl.offsetTop);
  }

  // Multi-face stage: persistent <img> per cast member so moves animate and
  // entrances/exits play. Falls back to a single portrait when a scene has no cast.
  function faceBase(size){ return size==='square'?150:(size==='full'?84:62); }
  function applyFaceSize(el, size, scale){
    scale = (scale!=null && scale>0) ? scale : 1;
    if(size==='square'){ el.style.width=Math.round(150*scale)+'px'; el.style.height=Math.round(150*scale)+'px'; }
    else { el.style.height=(Math.round(faceBase(size)*scale*10)/10)+'%'; el.style.width='auto'; }
  }
  function stateMedia(c, stateId){
    if(c && c.portraits && stateId){ var p=c.portraits.filter(function(x){return x.id===stateId;})[0]; if(p && p.media) return p.media; }
    return c ? c.media : null;
  }
  // Frame Studio's own animation: a portrait state with 2+ frames of its
  // own (each an asset key + its own on-screen duration) instead of one
  // static image. Anything short of 2 real frames just isn't an animation.
  function stateFrames(c, stateId){
    if(c && c.portraits && stateId){
      var p=c.portraits.filter(function(x){return x.id===stateId;})[0];
      if(p && Array.isArray(p.frames) && p.frames.length>1) return p.frames;
    }
    return null;
  }
  // #51: "crt" has no true scanline pattern here (a plain <img> can't host a
  // reliable overlay pseudo-element across browsers), so it's approximated
  // as a filter - a slight desaturate/contrast pass reminiscent of the look,
  // stackable with everything else via the same filter string.
  function pfxFilter(f,k){ switch(f){ case 'sepia':return 'sepia('+(0.6*k)+') saturate(1.15)'; case 'noir':return 'grayscale('+Math.min(1,0.9*k)+') contrast('+(1+0.12*k)+')'; case 'contrast':return 'contrast('+(1+0.35*k)+') saturate('+(1+0.2*k)+')'; case 'dream':return 'brightness('+(1+0.06*k)+') saturate(1.2) blur('+(0.5*k)+'px)'; case 'warm':return 'sepia('+(0.3*k)+') saturate(1.35) hue-rotate(-12deg)'; case 'cold':return 'saturate(1.1) brightness(1.02) hue-rotate(12deg)'; case 'crt':return 'contrast('+(1+0.2*k)+') saturate('+(1-0.15*k)+') brightness('+(1-0.04*k)+')'; default:return ''; } }
  // a character's portrait effects as a flat list of {type,intensity},
  // migrating an older single {overlay,filter,intensity} shape on the fly -
  // a project saved before this landed only ever has that legacy field, and
  // the exported player has to keep rendering it exactly as before without
  // the editor ever having "touched" (and thus migrated) it first.
  function portraitEffects(c){
    if(!c) return [];
    if(Array.isArray(c.portraitFxList)) return c.portraitFxList;
    var f=c.portraitFx, out=[];
    if(f){
      if(f.overlay && f.overlay!=='none') out.push({type:f.overlay, intensity:f.intensity});
      if(f.filter && f.filter!=='none') out.push({type:f.filter, intensity:f.intensity});
    }
    return out;
  }
  function applyPortraitFx(el, c){
    var list=portraitEffects(c);
    if(!list.length){ el.style.filter=''; el.classList.remove('pfx-glitch','pfx-bow','pfx-crt'); return; }
    var filterParts=[], active={};
    list.forEach(function(f){ var k=(f.intensity||5)/5; var part=pfxFilter(f.type,k); if(part) filterParts.push(part); active[f.type]=true; });
    el.style.filter = filterParts.join(' ');
    el.classList.toggle('pfx-glitch', !!active.glitch);
    el.classList.toggle('pfx-bow', !!active.bow);
    el.classList.toggle('pfx-crt', !!active.crt);
  }
  function renderStage(scene, line){
    if(stageScene!==scene.id){
      // A library character (stable charId, not a one-off scene-local face)
      // who was visibly on stage right up to this scene change is still
      // "already on-screen" to the audience, even though each scene keeps
      // its own DOM faces (cleared below) - so their entrance shouldn't
      // replay just because the story moved to a new scene mid-conversation.
      var carry={}; var prevScene=stageScene && scenes[stageScene];
      if(prevScene){ Object.keys(faceEls).forEach(function(cid){
        var prevEntry=(prevScene.cast||[]).filter(function(x){return x.id===cid;})[0];
        if(prevEntry && prevEntry.charId) carry[prevEntry.charId]=true;
      }); }
      clearStage(); stageScene=scene.id; _carriedCharIds=carry;
    }
    var cast = scene.cast || [];
    if(!cast.length){                                  // legacy single-portrait path
      clearStage();
      var p=line.portrait||{}; var im;
      if(p.media && !p.hidden){ im=document.createElement('img');
        im.className='vn-face size-tall'+((p.border&&p.border!=='none')?(' pb-'+p.border):'');
        im.style.left=posPct(p.pos||'center')+'%';
        applyFaceSize(im, 'tall', p.scale);
        im.style.maxWidth=Math.round(34*((p.scale&&p.scale>0)?p.scale:1))+'%'; im.src=mediaSrc(p.media); portraitLayer.appendChild(im); }
      if(window.VNLayout && VNLayout.applyNameToPortrait) VNLayout.applyNameToPortrait(P, scene, im||null, document.getElementById('vn-frame'));
      return;
    }
    var stage = line.stage || [];
    var present = {}; stage.forEach(function(s){ present[s.castId]=true; });
    // exit faces no longer on stage
    Object.keys(faceEls).forEach(function(cid){
      if(!present[cid]){ var el=faceEls[cid]; var ex=el._exit||'fade';
        if(el._frameTimer){ clearTimeout(el._frameTimer); el._frameTimer=null; el._frameKey=null; }
        // fix: classList.remove() throws on an empty token, but this used to
        // pass '' whenever the face's className had no "enter-X" class to
        // begin with (e.g. entrance 'none') - crashing every exit for that
        // face and aborting the rest of renderStage()/showDialogueLine()
        // mid-render (a caller several frames up, so the failure looked
        // unrelated to portraits entirely).
        var enterCls=el.className.match(/enter-\S+/); if(enterCls) el.classList.remove(enterCls[0]);
        el.classList.add('exit-'+ex);
        setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, (ex==='none')?0:340); delete faceEls[cid]; }
    });
    var topOn = scene.speakerTop!==false; // #10: speaker on top when overlapping (default on)
    var speakingFaceEl=null; // tracked for the "name attached to portrait" layout mode below
    // add / update faces on stage
    stage.forEach(function(s, idx){
      var entry = cast.filter(function(x){return x.id===s.castId;})[0]; if(!entry) return;
      var c = resolveFace(entry);
      var speaking = line.speakingCast===s.castId, someoneSpeaking = !!line.speakingCast;
      // a dedicated "talking" state (char-states.js's 🗣 marker) wins over
      // whatever state a line's own 🎭 picker otherwise selected, but only
      // while THIS character is actually the one speaking - an animated GIF
      // dropped in as that state's face just plays natively, no extra code.
      var effectiveState = (speaking && c.talkState) ? c.talkState : s.state;
      var faceSrc = mediaSrc(stateMedia(c, effectiveState) || '') || '';
      var el = faceEls[s.castId];
      var fresh=false;
      if(!el){ fresh=true; el=document.createElement('img'); el.src=faceSrc; portraitLayer.appendChild(el);
        faceEls[s.castId]=el; el._exit=c.exit||'fade';
        var alreadyOnScreen = entry.charId && _carriedCharIds[entry.charId];
        var enters=alreadyOnScreen ? ['none'] : ((Array.isArray(c.enterFx)&&c.enterFx.length)?c.enterFx:[c.enter||'fade']);
        el.className='vn-face '+enters.map(function(e){return 'enter-'+e;}).join(' ');
        (function(x){ setTimeout(function(){ x.className=x.className.replace(/\benter-\S+/g,'').replace(/\s+/g,' ').trim(); }, 600); })(el);   // one-shot: never re-animate while on stage
      }
      else if(el.getAttribute('src')!==faceSrc){ el.src=faceSrc; }   // switch expression per line
      // Frame Studio's own frame-by-frame animation for this state, if it
      // has one: cycles el.src on its own timer for as long as this same
      // face+state combo stays active, restarting only when either changes.
      // Self-terminating once the face leaves the stage (clearStage() wipes
      // portraitLayer, so el.parentNode goes null and the loop below just
      // stops rescheduling itself; the exit path above also clears it early).
      var frames = stateFrames(c, effectiveState);
      var frameKey = frames ? (s.castId+':'+effectiveState) : null;
      if(frameKey && el._frameKey!==frameKey){
        if(el._frameTimer) clearTimeout(el._frameTimer);
        el._frameKey=frameKey; el._frameIdx=0;
        (function cycle(){
          if(!el.parentNode || el._frameKey!==frameKey) return;
          var fr=frames[el._frameIdx % frames.length];
          var fsrc=mediaSrc(fr.media||'')||'';
          if(fsrc) el.src=fsrc;
          el._frameIdx++;
          el._frameTimer=setTimeout(cycle, Math.max(30, fr.ms||150));
        })();
      } else if(!frameKey && el._frameTimer){
        clearTimeout(el._frameTimer); el._frameTimer=null; el._frameKey=null;
      }
      if(!fresh){ el.className='vn-face size-'+(c.size||'square')+((c.border&&c.border!=='none')?(' pb-'+c.border):''); }
      else { el.className+=' size-'+(c.size||'square')+((c.border&&c.border!=='none')?(' pb-'+c.border):''); }
      var _lay=(window.VNLayout&&VNLayout.resolved)?VNLayout.resolved(P,scene):null;
      var _slots=_lay&&_lay.portraits&&_lay.portraits.mode==='manual'?_lay.portraits.slots:null;
      var _slIdx=idx;
      if(_slots){ var g=0; while(_slots[_slIdx]&&_slots[_slIdx].link!=null&&_slots[_slots[_slIdx].link]&&g++<6){ _slIdx=_slots[_slIdx].link; } }
      el._slotKey=_slots?_slIdx:('p'+idx);
      // A stage entry with posLocked (set via Scene Properties' position
      // dropdown) pins this character explicitly, overriding whatever the
      // canvas layout's manual slot for this index would otherwise place
      // here; unlocked (the default) still inherits the canvas layout.
      if(s.posLocked && s.pos){ el.style.left=posPct(s.pos)+'%'; el.style.top=''; el.style.bottom=''; el.style.transform=''; }
      else if(_slots && _slots[_slIdx]!=null && _slots[_slIdx].x!=null){ var _sl=_slots[_slIdx]; el.style.left=_sl.x+'%'; if(_sl.y!=null){ el.style.top=_sl.y+'%'; el.style.bottom='auto'; el.style.transform='translate(-50%,-50%)'; } }
      else if(_lay && _lay.portraits && _lay.portraits.mode==='box' && window.VNLayout && VNLayout.boxAttachPos){
        // #6: attached to the main dialogue box's own edge, evenly spread
        // across however many characters are actually on stage this line
        // unless dragged per-portrait (boxAlong[idx]) in the Canvas editor.
        var _bp=_lay.portraits, _side=_bp.boxSide||'top';
        var _along=(_bp.boxAlong && _bp.boxAlong[idx]!=null) ? _bp.boxAlong[idx] : ((idx+0.5)*100/Math.max(1,stage.length));
        var _pos=VNLayout.boxAttachPos(_lay.box, _side, _along);
        el.style.left=_pos.x+'%'; el.style.top=_pos.y+'%'; el.style.bottom='auto';
        el.style.transform = _side==='bottom'?'translate(-50%,0)':(_side==='left'?'translate(-100%,-50%)':(_side==='right'?'translate(0,-50%)':'translate(-50%,-100%)'));
      }
      else { el.style.left=posPct(s.pos)+'%'; el.style.top=''; el.style.bottom=''; el.style.transform=''; }
      applyFaceSize(el, c.size||'square', c.scale);
      if(speaking) speakingFaceEl=el;
      var single = stage.length<=1; // one face on stage: no emphasis needed
      if(!single && someoneSpeaking && !speaking) el.classList.add('dim'); else el.classList.remove('dim');
      // #NEW: a subtle grow-and-glow pulse while THIS character is talking,
      // opt-in per character (Characters panel's own Intensity/Speed
      // sliders) - purely a CSS custom-property + class toggle, so it costs
      // nothing on every line for a project that never turns it on.
      if(speaking && c.speakPulse){
        var _pInt=(c.speakIntensity!=null?c.speakIntensity:50)/100, _pSpd=(c.speakSpeed!=null?c.speakSpeed:50)/100;
        el.style.setProperty('--vn-pulse-scale', (1.02+_pInt*0.16).toFixed(3));
        el.style.setProperty('--vn-pulse-glow', (4+_pInt*14).toFixed(0)+'px');
        el.style.setProperty('--vn-pulse-dur', (1.4-_pSpd*1.0).toFixed(2)+'s');
        el.style.setProperty('--vn-pulse-color', c.color||'var(--accent)');
        el.classList.add('vn-speak-pulse');
      } else { el.classList.remove('vn-speak-pulse'); }
      el.style.zIndex = (speaking && topOn) ? 50 : (idx+1);
      el.style.maxWidth = scene.overlap ? '' : (Math.floor(94/Math.max(1,stage.length))+'%');
      if(_lay && _lay.portraits){ var _p=_lay.portraits; var _force=!!_p.overrideChars;
        // Normally a character's own Portrait-look (shape/fit) and Scale win
        // over the layout whenever they're set, same as with no layout at
        // all. The layout's "override each character's own look" toggle
        // flips that: the layout's own shape/fit/size then apply to every
        // portrait regardless of what any individual character has set.
        var _shape = _force ? (_p.shape||'') : (c.portraitShape||_p.shape||''); var _fit = _force ? (_p.fit||'') : (c.portraitFit||_p.fit||'');
        if(_shape){ el.style.borderRadius = _shape==='circle'?'50%':(_shape==='rounded'?'16px':''); if(_shape==='circle'){ el.style.aspectRatio='1/1'; if(!_fit)_fit='cover'; } else { el.style.aspectRatio=''; } }
        if(_fit){ el.style.objectFit=_fit; }
        // The layout's size is the BASE for the whole cast; a character's own
        // scale (Characters panel / cast override) still multiplies on top of
        // it, the same way it already does with no layout at all, instead of
        // being silently discarded by the layout the moment one is applied -
        // unless overrideChars is on, in which case the layout's size alone
        // applies and a character's own scale is ignored.
        // width:auto (rather than applyFaceSize's fixed px for size:'square')
        // keeps the image proportional now that height is a % of the stage.
        if(_p.size){ var _scMul=(!_force && c.scale!=null&&c.scale>0)?c.scale:1; el.style.height=(_p.size*_scMul)+'%'; el.style.width='auto'; el.style.maxWidth='none'; }
        // #5: matches the Canvas editor's own mirror of this - only means
        // anything once actually attached to the dialogue box's edge.
        // #98: matchBoxBorder (an existing, unrelated feature - the accent
        // colour, only once actually attached to the box) wins if both are
        // on; otherwise the opt-in character-colour-borders setting tints
        // THIS portrait with its own character's colour, same as the box.
        el.style.border = (_p.mode==='box' && _p.matchBoxBorder) ? '2px solid var(--accent)'
          : (P.settings && P.settings.screen && P.settings.screen.charColorBorders && c.color) ? '2px solid '+c.color : '';
        // #103: stashed rather than applied straight to el.style.opacity -
        // the "linked slots" cross-fade pass below (#3) unconditionally
        // overwrites this element's own opacity afterwards (winner/loser
        // 0-1, or a plain reset to '' for an unshared slot), so setting it
        // here would just get silently clobbered. That pass reads this back
        // and folds it in instead. Multiplies with 'dim' (inline always
        // wins over that class's own opacity:.6 for the same property) so
        // both effects still stack; left null (no stash at all) once alpha
        // is the default 100, so an untouched layout behaves exactly as
        // before this feature existed.
        el._alphaFactor = (_p.alpha!=null && _p.alpha<100) ? (_p.alpha/100) * (el.classList.contains('dim')?.6:1) : null; }
      applyPortraitFx(el, c);
      // #4: stay on stage (speaking, staged, counted for dim/zIndex/linked-
      // slot logic above) without actually showing the face - e.g. talking
      // from off-screen. Font and typing sound are handled elsewhere in
      // showDialogueLine() and are unaffected by this.
      el.style.display = s.hidden ? 'none' : '';
    });
    if(window.VNLayout && VNLayout.applyNameToPortrait) VNLayout.applyNameToPortrait(P, scene, speakingFaceEl, document.getElementById('vn-frame'));
    // #3 linked slots: when faces share a spot, cross-fade to the active (speaking) one
    (function(){
      var byKey={}; Object.keys(faceEls).forEach(function(cid){ var el=faceEls[cid]; if(el._slotKey==null) return; (byKey[el._slotKey]=byKey[el._slotKey]||[]).push(cid); });
      Object.keys(byKey).forEach(function(k){ var group=byKey[k];
        // #103: this pass owns the final word on every face's opacity (the
        // cross-fade above already needed to), so it's also where each
        // face's own stashed portraits.alpha factor (see the stage.forEach
        // above) actually gets applied - multiplied in rather than replacing
        // the 0/1 cross-fade state or the plain "not sharing a slot" case.
        if(group.length<2){ var only=faceEls[group[0]]; if(only){ only.classList.remove('vn-linked');
          only.style.opacity = (only._alphaFactor!=null) ? only._alphaFactor : ''; } return; }
        var winner = group.indexOf(line.speakingCast)>=0 ? line.speakingCast : group[group.length-1];
        group.forEach(function(cid){ var el=faceEls[cid]; el.classList.add('vn-linked'); el.style.display='';
          var base = (cid===winner)?1:0, af=(el._alphaFactor!=null)?el._alphaFactor:1;
          el.style.opacity = String(base*af); el.style.zIndex = (cid===winner)?'40':'1'; el.style.pointerEvents='none'; });
      });
    })();
  }
  function speakerName(scene, line){
    if(line.speaker) return line.speaker;
    if(line.speakingCast && scene.cast){ var e=scene.cast.filter(function(x){return x.id===line.speakingCast;})[0]; if(e){ var c=resolveFace(e); return c.name||''; } }
    return '';
  }
  function fontStack(f){ return f ? (FONTS[f]||'') : ''; }

  // ---- completion ---------------------------------------------------------
  function markVisited(id){ if(state.v.indexOf(id)<0) state.v.push(id); }
  // ---- visit counting + first-time content (#5) ---------------------------
  var visitCount = {};
  function sceneVisits(id){ return visitCount[id] || 1; }
  function lineShows(line, count){
    var v = line && line.visit; if(!v || !v.mode || v.mode==='always') return true;
    var n = v.n || 1;
    if(v.mode==='first')  return count <= 1;
    if(v.mode==='firstN') return count <= n;
    if(v.mode==='afterN') return count >  n;
    return true;
  }
  function visibleIdx(scene, from, count){
    var i=Math.max(0,from);
    while(i < scene.lines.length && !lineShows(scene.lines[i], count)) i++;
    return i; // == scene.lines.length when nothing visible remains
  }
  // ---- text speed resolution (#8): line override > character > project ----
  function characterFor(line){
    var scene=scenes[state.s]; if(!scene || !line) return null;
    if(line.speakingCast && scene.cast){
      var e=scene.cast.filter(function(x){return x.id===line.speakingCast;})[0];
      if(e){ if(e.charId) return (P.characters||[]).filter(function(c){return c.id===e.charId;})[0]||null; return e; }
    }
    if(scene.cast && scene.cast.length===1){ var only=scene.cast[0]; return only.charId ? ((P.characters||[]).filter(function(c){return c.id===only.charId;})[0]||null) : only; }
    return null;
  }
  function effectiveSpeed(line){
    if(line && line.textSpeed && line.textSpeed.mode) return scaleSpeed(line.textSpeed);
    var c=characterFor(line);
    if(c && c.textSpeed && c.textSpeed.mode) return scaleSpeed(c.textSpeed);
    var d=settings.text||{}; var base={ mode:d.mode||'letter', speed:(d.speed!=null?d.speed:5) };
    return scaleSpeed(base);
  }
  function scaleSpeed(b){ if(_speedScale!==1 && (b.mode==='letter'||b.mode==='word')){ return {mode:b.mode, speed:Math.max(1,Math.min(10,Math.round((b.speed||5)*_speedScale)))}; } return b; }
  function anyTarget(scene){ return scene.choices.some(function(c){ return choiceExit(c); }); }
  function isEnding(scene){ return !anyTarget(scene); }
  function scormCfg(){ return (settings.scorm)||{}; }
  function scoreValue(){
    var sc=scormCfg(); if(sc.scoreVar && state.vars && state.vars[sc.scoreVar]!=null){
      var v=Number(state.vars[sc.scoreVar]); if(!isNaN(v)){ var mx=Number(sc.scoreMax)||100; return Math.max(0,Math.min(100,Math.round(v/mx*100))); } }
    return 100;
  }
  // #16: any ONE of the configured criteria being true marks the learner
  // complete, so a story can define several distinct "endings" (an ending
  // scene, a scene-view count, a variable reaching some value) instead of
  // being limited to a single mode. A project saved before this existed has
  // its legacy mode/count normalized into an equivalent single-item list by
  // loadProject() (editor) / scorm.py's save path, so this always has at
  // least one criterion to check.
  function criterionMet(c, scene){
    if(c.type==='viewCount') return state.v.length>=(c.count||1);
    if(c.type==='variable') return c.var!=null && c.var!=='' && cmpTyped(typeOf(c.var), state.vars[c.var], c.cmp||'==', c.value);
    return isEnding(scene); // 'reachEnd', and the fallback for an unrecognized/legacy type
  }
  function checkComplete(scene){
    if(completed) return;
    var criteria = (settings.completion && settings.completion.criteria) || [{type:'reachEnd'}];
    var done = criteria.some(function(c){ return criterionMet(c, scene); });
    if(done){ completed=true; if(window.SCORM){ var sc=scormCfg(); var score=scoreValue();
      var passed = (sc.masteryScore!=null) ? (score>=sc.masteryScore) : null;
      SCORM.setScore(score); SCORM.setComplete(passed); SCORM.commit(); } }
  }
  function saveBookmark(){ if(window.SCORM){ SCORM.setBookmark(JSON.stringify(state)); SCORM.commit(); } }

  // ---- render -------------------------------------------------------------
  // effects + music resolve with scene → group → project fallback
  function groupOfScene(scene){ var b=P.backdrops||{}; return (scene && scene.group && b[scene.group]) ? b[scene.group] : null; }
  // #10: scene/group still override as a single effect exactly as before
  // (whichever is more specific wins outright, no mixing); the project
  // baseline can now be several effects stacked at once (P.fxList), falling
  // back to its own legacy single P.fx for projects that never touched the
  // new stacked picker. VNFx.apply() accepts either shape.
  function resolveFx(scene){
    var g=groupOfScene(scene); var sf=scene&&scene.fx, gf=g&&g.fx;
    function hasEffect(f){ return !!(f && ((f.overlay&&f.overlay!=='none') || (f.filter&&f.filter!=='none'))); }
    if(hasEffect(sf)) return sf;
    if(hasEffect(gf)) return gf;
    if(Array.isArray(P.fxList) && P.fxList.length) return P.fxList;
    if(hasEffect(P.fx)) return P.fx;
    return [];
  }
  function applyFx(scene){ if(window.VNFx) window.VNFx.apply(resolveFx(scene)); }
  function effectiveMusic(scene){
    var m=scene.music||{}; if(m.stop || m.media) return m; // scene decides
    var g=groupOfScene(scene); if(g && g.music && (g.music.media || g.music.stop)) return g.music; // else inherit group
    return m;
  }
  var _prevSceneId=null, _wordCues=[];
  function fireCues(list, on){ if(!window.VNSceneFx||!list) return; list.forEach(function(cue){ if(cue && cue.on===on && cue.effect) VNSceneFx.fire(cue.effect, cue.intensity); }); }
  function tickWordCues(typed){ if(!_wordCues.length||!window.VNSceneFx) return; var low=String(typed||'').toLowerCase(); _wordCues.forEach(function(wc){ if(!wc.done && low.indexOf(wc.word)>=0){ wc.done=true; VNSceneFx.fire(wc.effect, wc.intensity); } }); }
  function render(){
    var scene=scenes[state.s]; if(!scene) return;
    var _ld=document.getElementById('vn-loading'); if(_ld) _ld.style.display='none';
    if(_prevSceneId && _prevSceneId!==scene.id){ var ps=scenes[_prevSceneId]; if(ps) fireCues(ps.cues,'end'); }
    if(_prevSceneId!==scene.id) fireCues(scene.cues,'start');
    if(_prevSceneId!==scene.id) _spokenSlots={}; // #80: a fresh scene means nobody's spoken through any box yet
    _prevSceneId=scene.id;
    (function(){ var dbg=(P.settings&&P.settings.debug)||{}; var lbl=document.getElementById('vn-scenename');
      if(dbg.enabled && dbg.sceneName){ if(!lbl){ lbl=document.createElement('div'); lbl.id='vn-scenename'; lbl.style.cssText='position:absolute;top:6px;left:8px;z-index:65;background:rgba(0,0,0,.55);color:#fff;font:600 12px system-ui;padding:2px 9px;border-radius:6px;pointer-events:none'; (document.getElementById('vn-root')||document.body).appendChild(lbl); } lbl.textContent=scene.title||''; lbl.style.display='block'; } else if(lbl){ lbl.style.display='none'; } })();
    markVisited(scene.id); pendingRoll=null;
    setBackground(scene); setMusic({music:effectiveMusic(scene)}); applyFx(scene);
    if(window.VNLayout) VNLayout.apply(P, scene);
    if(state.i>=scene.lines.length) state.i=Math.max(0,scene.lines.length-1);
    if(state.i<0) state.i=0;
    var count=sceneVisits(scene.id);
    state.i = visibleIdx(scene, state.i, count); // #5: skip first-time-only lines already seen
    renderSceneLine(scene, state.i);
    logLine(scene, state.i);
    updateNav(); saveBookmark();
    if(window.VNRuntime && VNRuntime.onSceneChange) VNRuntime.onSceneChange();
    if(el('vn-debug-panel') && el('vn-debug-panel').style.display!=='none') renderDebugPanel();
  }
  function advanceLine(){
    var scene=scenes[state.s]; if(!scene) return;
    var j=visibleIdx(scene, state.i+1, sceneVisits(scene.id));
    if(j < scene.lines.length) moveTo(state.s, j);
  }
  // Shared by the stage click and any configured continue-prompt keys (#4):
  // finish a mid-reveal line first, then advance, exactly like a click does.
  function tryAdvance(){
    // #81: a click while paused for "box is full" resumes revealing the
    // REST of this same line, instead of being read as skip-to-end (typing()
    // still reports true while paused - a reveal genuinely in progress just
    // isn't ticking right now) or advance-to-next-line.
    if(window.VNType && VNType.isPaused && VNType.isPaused()){
      // only hide it here when it was showing SOLELY because of the page
      // break - a canAdvance-true line already shows this same hint
      // continuously from the moment the line started (for "advance to the
      // next line" once the whole reveal finishes), so hiding it here would
      // just make it flicker off and on for no reason.
      if(!canAdvance) hideContinuePrompt();
      VNType.nextPage(); return;
    }
    if(VNType.typing()){ VNType.finish(); return; } if(canAdvance) advanceLine(); }

  function endOrChoices(scene, container){
    if(window.VNLayout) VNLayout.animateChoices(P, scene);
    var visible = scene.choices.filter(function(c){ return choiceExit(c) && evalCondition(c).show; });
    if(!visible.length){
      if(P.settings && P.settings.hud && P.settings.hud.backlogClearOnEnding) VNLog.length=0; // #85; any conclusion, replay or not
      var end=document.createElement('div'); end.className='vn-end';
      end.textContent = completed ? '\u00b7 The End \u00b7' : '\u00b7 End of this path \u00b7';
      container.appendChild(end);
      if(TITLE.enabled && TITLE.returnOnEnd){
        var rb=document.createElement('button'); rb.className='vn-choice'; rb.textContent='\u21A9 Return to title';
        rb.addEventListener('click', function(e){ e.stopPropagation(); navRestart(); });
        wireCursorSound(rb);
        container.appendChild(rb);
      } else if(settings.endRestart!==false){
        var pa=document.createElement('button'); pa.className='vn-choice'; pa.textContent='\u21BA Play again';
        pa.addEventListener('click', function(e){ e.stopPropagation(); navRestart(); });
        wireCursorSound(pa);
        container.appendChild(pa);
      }
      if(TITLE.showCredits && creditsAvailable()){
        var cb=document.createElement('button'); cb.className='vn-choice'; cb.textContent='\u2606 View credits';
        cb.addEventListener('click', function(e){ e.stopPropagation(); showCreditsOverlay(); });
        wireCursorSound(cb);
        container.appendChild(cb);
        // #5: Settings' own label promises an AUTOMATIC credits screen at the
        // end ("Show an automatic credits screen..."), but this used to be
        // manual-only - a button players had to notice and click, easy to
        // miss entirely, which is exactly why toggling it on read as "doesn't
        // show". Pop it up for real, once per ending reached (navRestart()
        // resets the flag so Play Again shows it again too); the button
        // above still works afterward to reopen it, and the Play again /
        // Return to title buttons remain reachable once it's closed.
        if(!_creditsAutoShown){ _creditsAutoShown=true; showCreditsOverlay(); }
      }
      buildShareUI(scene, container);
      if(window.SCORM) SCORM.commit();
      if(window.VNOverlay && VNOverlay.onEnded) VNOverlay.onEnded({ endingId: scene.id, title: scene.title||'', vars: varsSnapshot() });
      return;
    }
    visible.forEach(function(c){
      var st=evalCondition(c);
      var b=document.createElement('button'); b.className='vn-choice'+(st.locked?' locked':'');
      b.textContent = c.continue ? 'Continue \u25B8' : (c.text||'\u2026');
      if(!st.locked){ b.addEventListener('click', function(e){ e.stopPropagation(); chooseChoice(scene, c, container); }); wireCursorSound(b); }
      container.appendChild(b);
    });
  }
  // #overlay: a plain {varName: value} snapshot (names, not ids - a host
  // game reading this over postMessage has no reason to know Scenemaker's
  // internal variable ids) handed to VNOverlay.onEnded() on every ending, so
  // an embedding host game can react to how a run went (e.g. branch its own
  // story on a reputation/outcome variable this scenario set).
  function varsSnapshot(){
    var out={};
    (P.variables||[]).forEach(function(v){ out[v.name]=state.vars[v.id]; });
    return out;
  }
  // #share: an opt-in prompt at the end of a run (settings.share.enabled,
  // Settings -> Info & credits). Deliberately reuses project.meta's existing
  // Website/Author/Title fields instead of a second set of link fields to
  // keep in sync - "share your ending" just means "help people find and
  // play this story", and that's already where its real home page lives.
  function buildShareUI(scene, container){
    var sh=(P.settings && P.settings.share) || {}; if(!sh.enabled) return;
    var meta=P.meta||{};
    var endingTitle=(scene.title||'').trim();
    var projectTitle=(meta.title||'').trim();
    var msg=(sh.message||'I got the \u201C{ending}\u201D ending in {title}!')
      .replace(/\{ending\}/g, endingTitle||'this')
      .replace(/\{title\}/g, projectTitle||'this story');
    var url=(meta.website||'').trim();
    var wrap=document.createElement('div'); wrap.className='vn-share';
    var cap=document.createElement('div'); cap.className='vn-hint'; cap.textContent='Share your ending:';
    wrap.appendChild(cap);
    var row=document.createElement('div'); row.className='vn-share-row'; wrap.appendChild(row);
    function addBtn(label, title, onClick){
      var b=document.createElement('button'); b.type='button'; b.className='vn-share-btn'; b.textContent=label;
      if(title) b.title=title;
      b.addEventListener('click', function(e){ e.stopPropagation(); onClick(b); });
      wireCursorSound(b);
      row.appendChild(b);
    }
    if(navigator.share){
      addBtn('\u{1F4E4} Share', 'Share your ending', function(){
        navigator.share({ title: projectTitle||undefined, text: msg, url: url||undefined }).catch(function(){});
      });
    } else {
      addBtn('\u{1F517} Copy link', 'Copy the share text to your clipboard', function(btn){
        shareCopyToClipboard(url ? (msg+' '+url) : msg, function(ok){
          var was=btn.textContent; btn.textContent = ok ? '\u2713 Copied!' : '\u2717 Copy failed';
          setTimeout(function(){ btn.textContent=was; }, 1600);
        });
      });
      addBtn('Share on X', 'Share to X (Twitter)', function(){
        window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(msg)+(url?'&url='+encodeURIComponent(url):''), '_blank', 'noopener');
      });
      addBtn('Share on Bluesky', 'Share to Bluesky', function(){
        window.open('https://bsky.app/intent/compose?text='+encodeURIComponent(msg+(url?' '+url:'')), '_blank', 'noopener');
      });
    }
    container.appendChild(wrap);
  }
  // SCORM/LMS iframes often block the async Clipboard API outright, so this
  // falls back to the same hidden-textarea + execCommand trick the editor's
  // own lite-export copy button already uses (lite-export.js), reimplemented
  // standalone here since the player ships with no editor code to reuse.
  function shareCopyToClipboard(text, cb){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ cb&&cb(true); }, function(){ shareCopyViaTextarea(text, cb); });
    } else { shareCopyViaTextarea(text, cb); }
  }
  function shareCopyViaTextarea(text, cb){
    try{
      var ta=document.createElement('textarea');
      ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; ta.style.left='-9999px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok=document.execCommand('copy');
      document.body.removeChild(ta);
      cb&&cb(ok);
    }catch(e){ cb&&cb(false); }
  }

  function chooseChoice(scene, c, container){
    if(c.askInput && c.askInput.var && !c._inputHandled){ showInputPrompt(c, function(){ c._inputHandled=true; chooseChoice(scene,c,container); c._inputHandled=false; }); return; }
    state.interactions=(state.interactions||0)+1; updateDebugCount();
    var before=JSON.parse(JSON.stringify(state.vars));
    var audioBefore={music:_musVol, sfx:_sfxVol, typing:_typeVol};
    applyEffects(c.effects);
    applyAudioFx(c.audioFx);
    logChoice(c, before, audioBefore);
    if(c.pickFx && c.pickFx.effect && window.VNSceneFx) VNSceneFx.fire(c.pickFx.effect, c.pickFx.intensity);
    if(window.SCORM && SCORM.interaction){ SCORM.interaction({ id:(scene.id+'_'+(c.id||'')), type:'choice', response:(c.text||'continue').slice(0,250) }); }
    if(c.dice && c.dice.enabled){ rollDice(c, container); return; }
    var rt=routeTarget(c); if(rt){ moveTo(rt, 0); return; }   // #4 priority routing
    var o=c.outcomes[0]; if(o && o.targetNode) moveTo(o.targetNode, 0, o.transition);
  }

  function rollDice(c, container){
    var d=c.dice, count=Math.max(1,d.count||1), sides=d.sides||20, target=d.target||10;
    var sum=0; for(var k=0;k<count;k++){ sum += 1 + Math.floor(Math.random()*sides); }
    var mod = d.modVar ? Number(state.vars[d.modVar]||0) : 0;
    var total=sum+mod, success=total>=target;
    var out = c.outcomes.filter(function(o){ return o.type===(success?'success':'failure'); })[0] || c.outcomes[0];
    container.innerHTML='';
    var r=document.createElement('div'); r.className='vn-roll';
    r.textContent='\uD83C\uDFB2 '+count+'d'+sides+(mod?(' + '+mod):'')+' = '+total+' vs '+target+': '+(success?'Success!':'Failure');
    container.appendChild(r);
    var b=document.createElement('button'); b.className='vn-choice'; b.textContent='Continue \u25B8';
    b.addEventListener('click', function(e){ e.stopPropagation(); if(out && out.targetNode) moveTo(out.targetNode,0,out.transition); });
    wireCursorSound(b);
    container.appendChild(b);
  }

  // "Click to continue" prompt (#4): defaults to sitting in the dialogue box.
  // Placement can come from two places: the legacy Settings-modal fields
  // (project.settings.continuePrompt.placement/x/y - free-anywhere or in-box)
  // or, once an author actually drags it in the Canvas editor, a
  // continuePrompt block in the layout system (project/group/scene.layout),
  // which takes priority when present. Text/style/keys always come from
  // settings regardless of which placement source is active.
  // #81: called on every typewriter tick (VNType.onTick) with the text
  // element currently being revealed. Default ('scroll', or unset - existing
  // projects are unaffected either way): keep the newest text in view by
  // scrolling to the bottom; a no-op whenever the text already fits (the
  // usual case, no custom fixed-height layout). Opt-in ('pageBreak'): once
  // the box is actually full, pause the reveal and show the same "click to
  // continue" hint used for advancing between lines - clicking resumes as a
  // fresh page (VNType.nextPage(), via tryAdvance's isPaused check) instead
  // of endlessly re-overflowing one character at a time.
  function handleTextOverflow(elx){
    var mode=(P.settings&&P.settings.textOverflow)||'scroll';
    if(mode!=='pageBreak'){ elx.scrollTop=elx.scrollHeight; return; }
    if(elx.scrollHeight>elx.clientHeight+1){ VNType.pause(); showContinuePrompt(_curScene, _curActiveBox); }
  }
  function showContinuePrompt(scene, activeBox){
    var cp=(P.settings&&P.settings.continuePrompt)||{};
    if(cp.enabled===false){ hideContinuePrompt(); return; }
    var layoutCP=(window.VNLayout&&VNLayout.explicitContinuePrompt)?VNLayout.explicitContinuePrompt(P,scene):null;
    var mode = layoutCP ? layoutCP.mode : (cp.placement==='free'?'free':'box');
    var align = (layoutCP&&layoutCP.align) || cp.align || 'right';
    var cls='vn-hint vn-cont-'+(cp.style||'blinkArrow');
    var html;
    if(cp.iconMedia){
      // a custom icon replaces the arrow/cursor glyph; its own animation (blink/pulse/none)
      // is independent of the text style, so it's applied via a separate class.
      html='<img class="vn-cont-icon vn-cont-icon-'+(cp.iconAnim||'none')+'" src="'+String(mediaSrc(cp.iconMedia)).replace(/"/g,'%22')+'"> '+(cp.style==='none'?'':crEsc(cp.text||'click to continue'));
    } else {
      var glyph = cp.style==='blinkArrow' ? '<span class="vn-cont-arrow">▸</span> ' : (cp.style==='cursor' ? '<span class="vn-cont-cursor">|</span> ' : (cp.style==='none' ? '' : '▸ '));
      html=glyph+crEsc(cp.text||'click to continue');
    }
    if(mode==='free'){
      var frame=document.getElementById('vn-frame'); if(!frame) return;
      var h=document.getElementById('vn-cont-free');
      if(!h){ h=document.createElement('div'); h.id='vn-cont-free'; h.style.position='absolute'; h.style.zIndex='7'; frame.appendChild(h); }
      var fx = (layoutCP&&layoutCP.x!=null) ? layoutCP.x : (cp.x!=null?cp.x:50);
      var fy = (layoutCP&&layoutCP.y!=null) ? layoutCP.y : (cp.y!=null?cp.y:92);
      h.className=cls; h.innerHTML=html; h.style.display='block';
      h.style.textAlign=align; h.style.fontSize=(cp.size||13)+'px';
      h.style.left=fx+'%'; h.style.top=fy+'%'; h.style.transform='translate(-50%,-50%)';
      return;
    }
    hideContinuePrompt(); // clear a stale free-floating OR in-box prompt (any prior line/scene/restart) before adding this one
    var hb=document.createElement('div'); hb.className=cls; hb.innerHTML=html;
    hb.style.textAlign=align; if(cp.size) hb.style.fontSize=cp.size+'px';
    // The box actually showing this line's text when there's more than one
    // (N dialogue boxes, #4) - never choicesEl: a Canvas-editor layout with
    // choices.mode:'free' reparents #vn-choices out to the stage, and this
    // prompt appending there instead of the box was the bug where "in the
    // dialogue box (default)" landed wherever choices happened to be.
    var target=(activeBox||box||choicesEl);
    // Belt-and-suspenders (#7 follow-up, reported still duplicating on a
    // restart despite _contHintInBox's own tracking): purge any stray
    // .vn-hint already sitting in the TARGET box regardless of whether it
    // matches the single tracked _contHintInBox reference, so a duplicate
    // can't survive even if that reference ever falls out of sync with
    // reality (e.g. two different boxes used across a restart).
    var stray=target.querySelectorAll('.vn-hint'); for(var si=0;si<stray.length;si++) stray[si].parentNode.removeChild(stray[si]);
    target.appendChild(hb);
    _contHintInBox=hb;
  }
  function hideContinuePrompt(){
    var h=document.getElementById('vn-cont-free'); if(h) h.style.display='none';
    if(_contHintInBox){ if(_contHintInBox.parentNode) _contHintInBox.parentNode.removeChild(_contHintInBox); _contHintInBox=null; }
  }

  // #93: a line's own recorded/attached voice clip plays once, right when
  // the line shows - folded into the SAME VNSfx pool as the line's sound
  // effects (sfx.js already creates a fresh <audio> per clip, no fixed DOM
  // element needed) so it starts and gets cut off on line-change exactly
  // like any other line-scoped sound already does, with zero new plumbing.
  function _lineAudioClips(line){
    var out=(line.voice && line.voice.media) ? [{media:mediaSrc(line.voice.media), delay:0, loop:false}] : [];
    return out.concat((line.sfx||[]).map(function(sf){ return Object.assign({}, sf, {media:mediaSrc(sf.media)}); }));
  }
  function showDialogueLine(scene, idx){
    csEl.style.display='none'; if(narrEl) narrEl.style.display='none'; box.style.display='flex'; portraitLayer.style.display='block'; if(csChoices) csChoices.innerHTML='';
    _viewerTeardown(); // #90: leaving a viewer scene stops its video/drag state rather than leaving it running hidden
    var line=scene.lines[idx]||{speaker:'',text:'',portrait:{},doc:{}};
    renderStage(scene, line);
    fireCues(line.vfx,'start');
    _wordCues=(line.vfx||[]).filter(function(c){return c.on==='word'&&c.word;}).map(function(c){return {word:String(c.word).toLowerCase(),effect:c.effect,intensity:c.intensity,done:false};});
    var nm=speakerName(scene, line);
    var spk=characterFor(line);
    // N dialogue boxes (#4): route the speaker to the box matching their on-stage order
    var _lay=(window.VNLayout&&VNLayout.resolved)?VNLayout.resolved(P,scene):null;
    var boxes=[box]; ['2','3','4'].forEach(function(n){ var cfg=_lay&&_lay['box'+n]; if(cfg&&cfg.enabled){ var bx=document.getElementById('vn-box'+n); if(bx) boxes.push(bx); } });
    var slot=0; (scene.cast||[]).forEach(function(c,ix){ if(c.id===line.speakingCast) slot=ix; });
    // #92: a library-linked speaker keeps their remembered box slot from an
    // earlier scene instead of just this scene's own cast order, if one is
    // already on record; either way, record (or re-affirm) that raw
    // preference AFTER computing it, so a later scene with fewer boxes
    // clamping it down doesn't corrupt what gets remembered for a scene
    // with more boxes again after that.
    var castEntry=(scene.cast||[]).filter(function(c){return c.id===line.speakingCast;})[0];
    var persistId=(spk && castEntry && castEntry.charId===spk.id) ? spk.id : null;
    if(persistId){ if(_charBoxSlot[persistId]!=null) slot=_charBoxSlot[persistId]; else _charBoxSlot[persistId]=slot; }
    var boxIdx = (boxes.length>1) ? Math.min(slot, boxes.length-1) : 0;
    var activeBox=boxes[boxIdx];
    var tEl = boxIdx===0 ? textEl : document.getElementById('vn-text'+(boxIdx+1));
    var sEl = boxIdx===0 ? speakerEl : document.getElementById('vn-speaker'+(boxIdx+1));
    if(!tEl){ tEl=textEl; sEl=speakerEl; activeBox=box; boxIdx=0; }
    _spokenSlots[boxIdx]=true;
    // #98: an opt-in setting - the currently-speaking box's border tints to
    // that character's own editor colour (Characters panel), so a reader can
    // tell speakers apart at a glance the same way the editor already can.
    // Always resets first, win or lose: activeBox is the SAME element reused
    // across every line, so a stale tint from an earlier colored speaker
    // must not linger once a colorless one (or this whole setting) applies.
    activeBox.style.borderWidth=''; activeBox.style.borderStyle=''; activeBox.style.borderColor='';
    if(P.settings && P.settings.screen && P.settings.screen.charColorBorders && spk && spk.color){
      activeBox.style.borderWidth='2px'; activeBox.style.borderStyle='solid'; activeBox.style.borderColor=spk.color;
    }
    // #80: a non-active box keeps showing whatever it last said (just
    // dimmed via vn-box-dim below) instead of going blank the moment a
    // different character speaks - it only actually clears once that box
    // itself goes away (layout.js's apply(), when its `enabled` flag turns
    // off). Optionally (hideUntilSpoken), an extra box (2-4) that's never
    // had a line yet stays fully hidden rather than sitting there empty;
    // the main box always shows, so nothing that already assumes it's
    // present has to change.
    var hideUnspoken=(window.VNLayout&&VNLayout.hideUntilSpoken)?VNLayout.hideUntilSpoken(P,scene):false;
    boxes.forEach(function(bx,i){ if(!bx) return;
      if(i>0) bx.style.display=(hideUnspoken && !_spokenSlots[i]) ? 'none' : 'flex';
      bx.classList.toggle('vn-box-dim', i!==boxIdx); });
    tEl.style.fontFamily=fontStack(line.font); sEl.style.fontFamily=fontStack(line.font);
    sEl.textContent=nm;
    if(sEl===speakerEl && _lay && _lay.name && _lay.name.mode==='portrait'){
      // display is fully owned by applyNameToPortrait (called from
      // renderStage(), above), which knows whether there's an actual
      // portrait to attach the name to - not just whether there's name
      // text - so a stray name never floats at a stale leftover position.
    } else { sEl.style.display=nm?'inline-block':'none'; }
    VNTypeSound.set(spk && spk.typeSound);
    VNSfx.load(_lineAudioClips(line));
    _curScene=scene; _curActiveBox=activeBox; tEl.scrollTop=0; // #81: fresh line starts scrolled to its top
    VNType.play(tEl, subst(applyKeywordHighlights(line.text||''), true), effectiveSpeed(line), function(){ VNSfx.tick(tEl.textContent); tickWordCues(tEl.textContent); fireCues(line.vfx,'end'); portraitLayer.style.bottom=_portraitsBottomPx(box)+'px'; if(window.VNLayout && VNLayout.applyName && _lay) VNLayout.applyName(_lay, box, document.getElementById('vn-frame')); });
    var doc=line.doc||{media:null};
    if(doc.media){ docBtn.style.display='inline-block'; docBtn.textContent='\uD83D\uDCC4 '+(doc.label||'Open document'); docBtn.onclick=function(e){ e.stopPropagation(); window.open(mediaSrc(doc.media),'_blank'); }; }
    else docBtn.style.display='none';
    choicesEl.innerHTML=''; canAdvance = visibleIdx(scene, idx+1, sceneVisits(scene.id)) < scene.lines.length;
    if(canAdvance){ showContinuePrompt(scene, activeBox); } else { hideContinuePrompt(); checkComplete(scene); endOrChoices(scene, choicesEl); }
    // Anchor the portrait area to the actual box height so faces sit ABOVE the
    // dialogue box (and never overlap the box or the name) as it grows/shrinks.
    portraitLayer.style.bottom = _portraitsBottomPx(box) + 'px';
    // #tab-reflow: VNLayout.apply() (and the tab's own position within it)
    // already ran once this line, back when the box still held the PREVIOUS
    // line's content - before a fixed-height box that grows to fit (see
    // layout.js's styleBox()) had actually grown for this one. A 'tab' name
    // mode reads the box's rendered offsetTop/offsetWidth, so this first
    // re-run (right after THIS line's choices, if any, are already in the
    // box) gets it close immediately. It isn't the last word, though: with
    // little or no choices and a lot of DIALOGUE TEXT, the box's real height
    // comes mostly from the typewriter revealing that text over time, not
    // from anything present yet at this synchronous point - a second real
    // report found the tab still landing inside the box, this time on a
    // single-line ending with no choices at all. The SAME call also runs
    // inside VNType.play()'s own onDone callback above (which fires once
    // typing truly finishes, naturally or via a skip-to-end click, exactly
    // where portraitLayer's own re-measurement already happens) - that's the
    // one guaranteed to see the box at its final, fully-grown height.
    if(window.VNLayout && VNLayout.applyName && _lay) VNLayout.applyName(_lay, box, document.getElementById('vn-frame'));
  }

  function showCutsceneLine(scene, idx){
    // A real report: an empty, styled little pill stayed visible, floating
    // over the frame, whenever a cutscene showed - a 'tab'/'free' name mode
    // positions #vn-speaker as a sibling of the box (not inside it, so it can
    // sit ON the box's edge), so hiding the BOX alone never hid this too; on
    // a project's very first scene it's even emptier, since no dialogue line
    // has ever run yet to give it a display style at all.
    box.style.display='none'; if(speakerEl) speakerEl.style.display='none'; if(narrEl) narrEl.style.display='none'; portraitLayer.style.display='none'; csEl.style.display='block'; if(choicesEl) choicesEl.innerHTML='';
    _viewerTeardown(); // #90: leaving a viewer scene stops its video/drag state rather than leaving it running hidden
    hideContinuePrompt(); // a free-floating prompt lives outside the box, so it needs its own clear here
    clearStage(); stageScene=null;
    var cs=scene.cutscene||{dim:0.4,effect:'shadow',size:'lg',align:'center'};
    csDim.style.opacity = (cs.dim!=null?cs.dim:0.4);
    csWrap.className = 'align-'+(cs.align||'center');
    var line=scene.lines[idx]||{text:'',font:''};
    csText.className = 'size-'+(cs.size||'lg')+' fx-'+(cs.effect||'shadow');
    csText.style.fontFamily=fontStack(line.font);
    var csSpk=characterFor(line);
    VNTypeSound.set(csSpk && csSpk.typeSound);
    VNSfx.load(_lineAudioClips(line));
    VNType.play(csText, subst(applyKeywordHighlights(line.text||''), true), effectiveSpeed(line), function(){ VNSfx.tick(csText.textContent); });
    csChoices.innerHTML=''; canAdvance = visibleIdx(scene, idx+1, sceneVisits(scene.id)) < scene.lines.length;
    if(canAdvance){ var h=document.createElement('div'); h.className='vn-hint'; h.textContent='\u25B8 click to continue'; csChoices.appendChild(h); }
    else { checkComplete(scene); endOrChoices(scene, csChoices); }
  }

  // #90: viewer scenes (a whole screen dedicated to examining one photo or
  // video). _viewerActive gates the shared drag/wheel listeners (set up
  // once in boot(), not re-attached per scene) so they're no-ops whenever a
  // viewer isn't actually on screen; _viewerZoom/_viewerOffX/_viewerOffY are
  // the photo's current pan/zoom state, reset fresh every time this renders.
  var _viewerActive=false, _viewerZoom=1, _viewerOffX=0, _viewerOffY=0;
  var _viewerDrag=null, _viewerDragMoved=false;
  function _viewerClamp(){
    var sw=viewerStage.clientWidth||1, sh=viewerStage.clientHeight||1;
    var iw=viewerImg.naturalWidth||sw, ih=viewerImg.naturalHeight||sh;
    var rh=sh*_viewerZoom, rw=(iw/ih)*rh; // rendered at height:100% * zoom, width follows the image's own aspect ratio
    var maxX=Math.max(0,(rw-sw)/2), maxY=Math.max(0,(rh-sh)/2);
    _viewerOffX=Math.max(-maxX,Math.min(maxX,_viewerOffX));
    _viewerOffY=Math.max(-maxY,Math.min(maxY,_viewerOffY));
  }
  function _viewerApply(){
    viewerImg.style.transform='translate(-50%,-50%) translate('+_viewerOffX+'px,'+_viewerOffY+'px) scale('+_viewerZoom+')';
  }
  function _viewerTeardown(){
    _viewerActive=false; _viewerDrag=null;
    if(viewerEl) viewerEl.style.display='none';
    if(viewerVideo){ try{ viewerVideo.pause(); }catch(e){} viewerVideo.onended=null; viewerVideo.removeAttribute('src'); viewerVideo.load(); viewerVideo.style.display='none'; }
    if(viewerImg) viewerImg.style.display='none';
    if(viewerStage) viewerStage.classList.remove('dragging');
  }
  function showViewerScene(scene, idx){
    box.style.display='none'; if(narrEl) narrEl.style.display='none'; csEl.style.display='none'; portraitLayer.style.display='none';
    if(choicesEl) choicesEl.innerHTML=''; if(csChoices) csChoices.innerHTML=''; if(narrChoices) narrChoices.innerHTML='';
    hideContinuePrompt(); clearStage(); stageScene=null;
    _viewerTeardown(); viewerEl.style.display='block';
    var line=scene.lines[idx]||{text:'',font:''};
    var v=scene.viewer||{kind:'photo360',media:null,loop:true};
    viewerCaption.style.fontFamily=fontStack(line.font);
    var capTxt=subst(applyKeywordHighlights(line.text||''), false);
    viewerCaption.textContent=capTxt; viewerCaption.style.display=capTxt?'block':'none';
    if(v.kind==='video' && v.media){
      viewerVideo.style.display='block'; viewerVideo.loop=!!v.loop; viewerVideo.src=mediaSrc(v.media);
      viewerVideo.onended=function(){ if(!viewerVideo.loop && canAdvance) advanceLine(); };
      var p=viewerVideo.play(); if(p&&p.catch) p.catch(function(){}); // autoplay can be blocked; native controls still let them press play
    } else {
      _viewerZoom=1; _viewerOffX=0; _viewerOffY=0;
      viewerImg.style.display='block'; viewerImg.src=v.media?mediaSrc(v.media):'';
      viewerImg.onload=function(){ _viewerClamp(); _viewerApply(); };
      _viewerApply(); _viewerActive=true;
    }
    viewerChoices.innerHTML=''; canAdvance = visibleIdx(scene, idx+1, sceneVisits(scene.id)) < scene.lines.length;
    if(canAdvance){ var h=document.createElement('div'); h.className='vn-hint'; h.textContent='\u25B8 click to continue'; viewerChoices.appendChild(h); }
    else { checkComplete(scene); endOrChoices(scene, viewerChoices); }
  }

  // #168: an "unattributed" line (narrator commentary, off-screen dialogue,
  // and the like) floats over the stage with no speaker name or dialogue
  // box, but unlike a cutscene it leaves the background/portraits showing
  // (dimmed by default, project.settings.narration.dimOthers) instead of
  // hiding them.
  function showNarratorLine(scene, idx){
    box.style.display='none'; csEl.style.display='none'; portraitLayer.style.display='block'; narrEl.style.display='block';
    _viewerTeardown(); // #90: leaving a viewer scene stops its video/drag state rather than leaving it running hidden
    if(choicesEl) choicesEl.innerHTML=''; if(csChoices) csChoices.innerHTML='';
    hideContinuePrompt(); // a free-floating prompt lives outside the box, so it needs its own clear here
    var line=scene.lines[idx]||{text:'',font:''};
    renderStage(scene, line); // keep portraits/background visible and current, just dimmed below
    portraitLayer.style.bottom='0px'; // no dialogue box eating space at the bottom
    fireCues(line.vfx,'start');
    _wordCues=(line.vfx||[]).filter(function(c){return c.on==='word'&&c.word;}).map(function(c){return {word:String(c.word).toLowerCase(),effect:c.effect,intensity:c.intensity,done:false};});
    var ns=(P.settings&&P.settings.narration)||{dimOthers:true};
    narrDim.style.opacity = (ns.dimOthers!==false) ? 0.55 : 0;
    narrText.style.fontFamily=fontStack(line.font);
    var nSpk=characterFor(line);
    VNTypeSound.set(nSpk && nSpk.typeSound);
    VNSfx.load(_lineAudioClips(line));
    VNType.play(narrText, subst(applyKeywordHighlights(line.text||''), true), effectiveSpeed(line), function(){ VNSfx.tick(narrText.textContent); tickWordCues(narrText.textContent); fireCues(line.vfx,'end'); });
    narrChoices.innerHTML=''; canAdvance = visibleIdx(scene, idx+1, sceneVisits(scene.id)) < scene.lines.length;
    if(canAdvance){ var h=document.createElement('div'); h.className='vn-hint'; h.textContent='\u25B8 click to continue'; narrChoices.appendChild(h); }
    else { checkComplete(scene); endOrChoices(scene, narrChoices); }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
