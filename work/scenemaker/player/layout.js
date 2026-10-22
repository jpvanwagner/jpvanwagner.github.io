/* ============================================================================
   Scenemaker player; screen layout + element animations  (features #3,#4,#6)
   Positions the dialogue box, choices and portrait band from a layout object
   (percentages of the frame), resolving scene → group → project → default.
   Choices can live inside the box or float free anywhere. Elements can animate
   in (fade/slide/swoop/pop/glitch + direction). Self-contained CSS.
   ==========================================================================*/
(function(){
  var DEF={
    // #103: 'alpha' is the whole element's opacity (text and all), distinct
    // from 'bgAlpha' which only fades the box's own background fill.
    box:{x:2,y:70,w:96,h:27, fontSize:19, autoFit:false, bgAlpha:100, alpha:100},
    box2:{enabled:false, combine:false, x:2, y:3, w:96, h:22},
    box3:{enabled:false, combine:false, x:2, y:26, w:47, h:20},
    box4:{enabled:false, combine:false, x:51, y:26, w:47, h:20},
    choices:{mode:'inBox',x:54,y:34,w:44,align:'center', alpha:100},
    portraits:{anchor:'bottom',offY:0, mode:'auto', slots:[], boxSide:'top', boxAlong:[], shape:'square', size:0, fit:'contain', alpha:100, overrideChars:false, matchBoxBorder:false},
    name:{mode:'inBox', x:6, y:62, orient:'horizontal', bg:true, matchBox:false, textColor:'', alpha:100, portraitSide:'top'},
    continuePrompt:{enabled:false, mode:'inBox', x:88, y:92, align:'right'},
    // #55: each element can now stack SEVERAL simultaneous entrance effects
    // (not just one), each with its own delay/speed, instead of exactly one
    // type+direction - see normalizeAnimList()/animate() below.
    anim:{box:[{type:'fade',dir:'up',delay:0,speed:1}], choices:[{type:'fade',dir:'up',delay:0,speed:1}], portraits:[{type:'fade',dir:'up',delay:0,speed:1}]}
  };
  function css(){ if(document.getElementById('vn-layout-css')) return;
    var s=document.createElement('style'); s.id='vn-layout-css';
    var K=[
     '@keyframes vnFade{from{opacity:0}to{opacity:1}}',
     '@keyframes vnUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}',
     '@keyframes vnDown{from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:translateY(0)}}',
     '@keyframes vnLeft{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}',
     '@keyframes vnRight{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:translateX(0)}}',
     '@keyframes vnPop{0%{opacity:0;transform:scale(.6)}70%{transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}',
     '@keyframes vnSwoop{0%{opacity:0;transform:translateX(-80px) rotate(-6deg) scale(.9)}100%{opacity:1;transform:translateX(0) rotate(0) scale(1)}}',
     '@keyframes vnGlitchIn{0%{opacity:0;clip-path:inset(45% 0 45% 0);transform:translateX(-8px)}20%{opacity:1;clip-path:inset(0 0 70% 0);transform:translateX(8px)}40%{clip-path:inset(60% 0 0 0);transform:translateX(-6px)}60%{clip-path:inset(20% 0 20% 0);transform:translateX(4px)}100%{opacity:1;clip-path:inset(0 0 0 0);transform:none}}',
     '#vn-choices.vn-choices-free{background:none;padding:0;display:flex;flex-direction:column;gap:8px;z-index:20}'
    ].join('\n');
    s.textContent=K; document.head.appendChild(s);
  }
  // #55: an element's entrance animation is now a LIST of stacked effects
  // (each with its own type/dir/delay/speed) rather than a single {type,dir}
  // object. Normalizes both shapes to a list: an older project (or a scene/
  // group/project level that never touched this feature) still has the
  // legacy single-object shape, which becomes a one-item list here; 'none'
  // or nothing at all becomes an empty list (no animation).
  function normalizeAnimList(v){
    if(Array.isArray(v)) return v.map(function(a){ return {type:a&&a.type, dir:a&&a.dir, delay:(a&&a.delay)||0, speed:(a&&a.speed>0)?a.speed:1}; });
    if(v && v.type && v.type!=='none') return [{type:v.type, dir:v.dir, delay:0, speed:1}];
    return [];
  }
  function merged(P, scene){
    var g=(scene && scene.group && P.backdrops && P.backdrops[scene.group]) ? P.backdrops[scene.group].layout : null;
    var out={};
    ['box','box2','box3','box4','choices','portraits','name','anim'].forEach(function(k){
      out[k]=Object.assign({}, DEF[k], (P.layout&&P.layout[k])||{}, (g&&g[k])||{}, (scene&&scene.layout&&scene.layout[k])||{});
    });
    // anim.box/choices/portraits are whole-value overrides (most specific
    // scope that actually sets that key wins), not field-merged the way
    // box/choices/portraits themselves are - merging two different-length
    // effect lists field-by-field wouldn't mean anything.
    ['box','choices','portraits'].forEach(function(k){ out.anim[k]=normalizeAnimList(out.anim[k]); });
    return out;
  }
  function styleBox(el, b){
    if(!el) return;
    el.style.position='absolute'; el.style.left=b.x+'%';
    el.style.width=b.w+'%'; el.style.right='auto'; el.style.maxWidth='none';
    // A real report: a scene whose dialogue + choices need more room than a
    // fixed-height box (b.h) just spilled the extra choice buttons straight
    // past the box's visible border instead of showing them. b.h is now a
    // FLOOR (minHeight), not a hard cap - the box grows with its content like
    // the Canvas editor's own design-time preview already does (cePlace() in
    // canvas-editor.js uses min-height/height:auto the same way), so what an
    // author sees while designing now matches what actually plays.
    //
    // Which edge stays put while it grows depends on where the box already
    // sits: a box placed in the lower half of the stage (the common "dialogue
    // box along the bottom" layout, including every built-in preset) grows
    // UPWARD from its bottom edge - the far more common convention, and the
    // only direction with real room to grow when the box starts near the
    // bottom. A box in the upper half grows downward from its top edge, same
    // as before. Either way it's capped at the stage's own far edge, so it
    // can never push content past the playable canvas; #vn-box/.vn-box2's
    // own overflow-y:auto (index_template.html) scrolls internally for the
    // rare case that even that isn't room enough.
    var bottomAnchored = (b.y + b.h/2) > 50;
    if(bottomAnchored){
      el.style.top='auto'; el.style.bottom=Math.max(0, 100-(b.y+b.h))+'%';
      el.style.maxHeight='calc(' + Math.max(0, b.y+b.h) + '% - 10px)';
    } else {
      el.style.top=b.y+'%'; el.style.bottom='auto';
      el.style.maxHeight='calc(' + Math.max(0, 100-b.y) + '% - 10px)';
    }
    el.style.minHeight=b.h+'%';
    el.style.height='auto';
    if(b.bgAlpha!=null && b.bgAlpha<100){ el.style.background='rgba(8,10,18,'+(b.bgAlpha/100)+')'; el.style.backdropFilter='blur(2px)'; }
    else { el.style.background=''; }
    el.style.opacity = (b.alpha!=null && b.alpha<100) ? (b.alpha/100) : '';
    var txt=el.querySelector('#vn-text')||el.querySelector('.vn-text');
    if(txt && b.fontSize){ txt.style.fontSize=b.fontSize+'px'; if(b.autoFit) autoFit(el, txt, b.fontSize); else txt.style.fontSize=b.fontSize+'px'; }
  }
  // autoFit (opt-in, b.autoFit) shrinks the TEXT until the box's own content
  // fits within its floor height (b.h) rather than growing taller - for an
  // author who'd rather keep a fixed-size box and shrink dialogue to match.
  // Starts from the box's own configured fontSize (not whatever the CSS
  // default happens to be) so it shrinks FROM the author's chosen size, not
  // from a disconnected 18/19px baseline.
  function autoFit(box, txt, fontSize){
    var size=fontSize||parseInt(getComputedStyle(txt).fontSize,10)||18; var guard=0;
    txt.style.fontSize=size+'px';
    while(box.scrollHeight>box.clientHeight && size>9 && guard++<40){ size-=1; txt.style.fontSize=size+'px'; }
  }
  function ensureBox(n){
    var frame=document.getElementById('vn-frame'); if(!frame) return null;
    var id='vn-box'+n, b=document.getElementById(id);
    if(!b){ b=document.createElement('div'); b.id=id; b.className='vn-box2';
      b.innerHTML='<span id="vn-speaker'+n+'" class="vn-speaker2"></span><div id="vn-text'+n+'" class="vn-text2"></div>';
      frame.appendChild(b); }
    return b;
  }
  function ensureBox2(){ return ensureBox(2); }
  // #55: builds one CSS `animation` shorthand value per stacked effect and
  // joins them with commas - CSS natively runs any number of comma-separated
  // animations on one element at once, so "fade AND slide together" is just
  // two specs in the same string, each with its own duration (from `speed`,
  // a multiplier on that effect type's base duration) and `delay`.
  var ANIM_KEYFRAME={fade:'vnFade',pop:'vnPop',swoop:'vnSwoop',glitch:'vnGlitchIn'};
  var ANIM_BASE_DUR={fade:.35,slide:.38,pop:.4,swoop:.45,glitch:.5};
  var ANIM_EASE={swoop:'cubic-bezier(.2,.8,.2,1)',glitch:'steps(3)'};
  function animate(el, list){
    if(!el) return;
    el.style.animation='';
    if(!Array.isArray(list) || !list.length) return;
    var specs=list.map(function(a){
      if(!a || !a.type || a.type==='none') return null;
      var kf = a.type==='slide' ? ('vn'+(a.dir||'up').charAt(0).toUpperCase()+(a.dir||'up').slice(1)) : ANIM_KEYFRAME[a.type];
      if(!kf) return null;
      var dur=(ANIM_BASE_DUR[a.type]||.35)/((a.speed>0)?a.speed:1);
      var ease=ANIM_EASE[a.type]||'ease';
      return kf+' '+dur.toFixed(3)+'s '+ease+' '+((a.delay)||0)+'s both';
    }).filter(Boolean);
    if(!specs.length) return;
    void el.offsetWidth; el.style.animation=specs.join(', ');
  }
  // #6: where a portrait sits when attached to the main dialogue box's own
  // edge - computed purely from the box's own resolved x/y/w/h percentages,
  // mirroring editor/modules/canvas-editor.js's ceBoxAttachPos() exactly so
  // the Canvas editor preview and real play always agree.
  function boxAttachPos(box, side, along){
    var b=box||{x:0,y:0,w:100,h:0}, a=(along==null?50:along)/100;
    if(side==='left') return {x:b.x, y:b.y+a*b.h};
    if(side==='right') return {x:b.x+b.w, y:b.y+a*b.h};
    if(side==='bottom') return {x:b.x+a*b.w, y:b.y+b.h};
    return {x:b.x+a*b.w, y:b.y}; // 'top' default
  }
  // #80: whether an extra dialogue box (2-4) that hasn't had a line spoken
  // through it yet this scene should stay hidden instead of sitting there
  // empty. Not part of merged()'s per-field box/box2/etc merge (it's a
  // whole-project/group/scene toggle, not a per-box style), same shape as
  // explicitContinuePrompt()'s own separate resolution: scene wins, then
  // group, then project, defaulting false (existing layouts show every
  // enabled box from the start, unaffected until this is turned on).
  function hideUntilSpoken(P, scene){
    var g=(scene && scene.group && P.backdrops && P.backdrops[scene.group]) ? P.backdrops[scene.group].layout : null;
    var vals=[ scene && scene.layout && scene.layout.hideUntilSpoken, g && g.hideUntilSpoken, P.layout && P.layout.hideUntilSpoken ];
    for(var i=0;i<vals.length;i++){ if(vals[i]!=null) return !!vals[i]; }
    return false;
  }
  function hasLayout(P, scene){
    var g=(scene && scene.group && P.backdrops && P.backdrops[scene.group]) ? P.backdrops[scene.group] : null;
    return !!(P.layout || (g && g.layout) || (scene && scene.layout));
  }
  function apply(P, scene){
    if(!hasLayout(P, scene)) return; // no custom layout → leave the default CSS untouched
    css(); var lay=merged(P, scene);
    var frame=document.getElementById('vn-frame'); if(!frame) return;
    var box=document.getElementById('vn-box'), choices=document.getElementById('vn-choices'), portraits=document.getElementById('vn-portraits');
    styleBox(box, lay.box);
    // extra dialogue boxes 2..4 (one per simultaneous speaker)
    [2,3,4].forEach(function(n){ var cfg=lay['box'+n]; var bx=document.getElementById('vn-box'+n);
      if(cfg && cfg.enabled){ bx=ensureBox(n); var _src=cfg.combine?lay.box:cfg;
        styleBox(bx, Object.assign({fontSize:lay.box.fontSize,bgAlpha:lay.box.bgAlpha,alpha:lay.box.alpha,autoFit:lay.box.autoFit}, {x:_src.x,y:_src.y,w:_src.w,h:_src.h})); bx.style.display='flex'; }
      // #80: this box is genuinely gone (disabled at this scope) - clear
      // whatever it last retained so it never reappears with stale dialogue
      // if it's re-enabled again later (a different scene/group/scope).
      else if(bx){ bx.style.display='none';
        var t=bx.querySelector('.vn-text2'), s=bx.querySelector('.vn-speaker2');
        if(t) t.textContent=''; if(s) s.textContent=''; } });
    if(choices){ var c=lay.choices;
      if(c.mode==='free'){ if(choices.parentNode!==frame) frame.appendChild(choices);
        choices.classList.add('vn-choices-free'); choices.style.position='absolute';
        choices.style.left=c.x+'%'; choices.style.top=c.y+'%'; choices.style.width=c.w+'%';
        choices.style.textAlign=c.align||'center'; choices.style.alignItems=(c.align==='center')?'center':(c.align==='right'?'flex-end':'flex-start');
        choices.style.opacity = (c.alpha!=null && c.alpha<100) ? (c.alpha/100) : '';
        // same spill fix as styleBox(): free-mode choices have no box to grow
        // with, so cap them at the stage's own bottom edge and scroll inside
        // rather than let a long choice list run off the bottom of the frame.
        choices.style.maxHeight='calc(' + Math.max(0, 100-c.y) + '% - 10px)'; choices.style.overflowY='auto'; }
      else { if(box && choices.parentNode!==box) box.appendChild(choices);
        choices.classList.remove('vn-choices-free'); choices.style.position=''; choices.style.left=''; choices.style.top=''; choices.style.width=''; choices.style.textAlign=''; choices.style.alignItems=''; choices.style.opacity=''; choices.style.maxHeight=''; choices.style.overflowY=''; }
    }
    if(portraits){ var p=lay.portraits;
      portraits.style.alignItems = p.anchor==='center'?'center':(p.anchor==='top'?'flex-start':'flex-end');
      // anchor/nudge only apply in auto-spread mode; manual slots are each an
      // explicit absolute position already, so this must match the Canvas
      // editor's own preview (#2) or a project with manual portrait slots
      // could visibly drift in real play whenever offY is non-zero.
      portraits.style.transform = (p.mode==='manual'||p.mode==='box') ? '' : 'translateY('+(Number(p.offY)||0)+'%)'; }
    applyName(lay, box, frame);
    animate(box, lay.anim.box); animate(portraits, lay.anim.portraits);
  }
  function applyName(lay, box, frame){
    var nm=lay.name||DEF.name; var sp=document.getElementById('vn-speaker'); if(!sp) return;
    sp.classList.toggle('vn-name-nobg', nm.bg===false);
    // #7: only the inBox class removes the base rule's absolute-tab
    // positioning; every other mode still wants that same base look
    // (tab/free float above/around the box, portrait attaches to a face).
    sp.classList.toggle('vn-name-inbox', nm.mode==='inBox');
    // #64: match the dialogue box's own background instead of the theme
    // accent colour, and/or an explicit text colour - both optional,
    // applying to #vn-speaker regardless of placement mode since it's the
    // same element reused (and repositioned) for all of them.
    sp.style.background = (nm.bg!==false && nm.matchBox) ? 'var(--box-bg)' : '';
    sp.style.color = nm.textColor || '';
    sp.style.writingMode = (nm.orient==='vertical') ? 'vertical-rl' : '';
    sp.style.textOrientation = (nm.orient==='vertical') ? 'mixed' : '';
    if(nm.mode==='inBox'){ if(box && sp.parentNode!==box) box.insertBefore(sp, box.firstChild);
      sp.style.position=''; sp.style.left=''; sp.style.top=''; sp.style.transform=''; sp.style.zIndex=''; sp.style.opacity=''; return; }
    sp.style.opacity = (nm.alpha!=null && nm.alpha<100) ? (nm.alpha/100) : '';
    // 'portrait' mode is positioned per-line, once the speaking face is known
    // (see applyNameToPortrait below, called from runtime.js's renderStage);
    // there's nothing meaningful to do with it here at scene-enter time.
    if(nm.mode==='portrait') return;
    if(frame && sp.parentNode!==frame) frame.appendChild(sp);
    sp.style.position='absolute'; sp.style.zIndex='6'; sp.style.bottom='auto'; sp.style.right='auto';
    if(nm.mode==='tab' && box){
      // anchor to the actual dialogue box: sit on its top edge, x along its width
      sp.style.left=(box.offsetLeft + box.offsetWidth*((nm.x||0)/100))+'px';
      sp.style.top=box.offsetTop+'px';
      sp.style.transform=(nm.orient==='vertical'?'translateX(-100%)':'translate(-2px,-100%)');
    } else {
      sp.style.left=(nm.x||0)+'%'; sp.style.top=(nm.y||0)+'%'; sp.style.transform='';
    }
  }
  /* #10 (name-attach-to-portrait): pin the speaker name to the edge of
     whichever portrait is currently speaking. Unlike applyName (called once
     per scene), this runs once per line from runtime.js's renderStage(),
     since which face is speaking - and where it sits - can change every
     line. No-ops unless this layout's name.mode is 'portrait'; with no
     speaking face (e.g. nobody on stage that line) the name is just hidden,
     leaving text/visibility itself to runtime.js as usual. */
  function applyNameToPortrait(P, scene, faceEl, frame){
    var lay=merged(P, scene); var nm=lay.name||DEF.name; var sp=document.getElementById('vn-speaker');
    if(!sp || nm.mode!=='portrait') return false;
    sp.classList.toggle('vn-name-nobg', nm.bg===false);
    sp.style.background = (nm.bg!==false && nm.matchBox) ? 'var(--box-bg)' : '';
    sp.style.color = nm.textColor || '';
    sp.style.writingMode = (nm.orient==='vertical') ? 'vertical-rl' : '';
    sp.style.textOrientation = (nm.orient==='vertical') ? 'mixed' : '';
    sp.style.opacity = (nm.alpha!=null && nm.alpha<100) ? (nm.alpha/100) : '';
    if(!faceEl || !frame){ sp.style.display='none'; return true; }
    if(sp.parentNode!==frame) frame.appendChild(sp);
    sp.style.position='absolute'; sp.style.zIndex='51'; sp.style.bottom='auto'; sp.style.right='auto';
    var side=nm.portraitSide||'top';
    var fl=faceEl.offsetLeft, ft=faceEl.offsetTop, fw=faceEl.offsetWidth, fh=faceEl.offsetHeight;
    var along=((nm.x!=null?nm.x:50)/100);
    if(side==='bottom'){ sp.style.left=(fl+fw*along)+'px'; sp.style.top=(ft+fh)+'px'; sp.style.transform='translate(-50%,0)'; }
    else if(side==='left'){ sp.style.left=fl+'px'; sp.style.top=(ft+fh*along)+'px'; sp.style.transform='translate(-100%,-50%)'; }
    else if(side==='right'){ sp.style.left=(fl+fw)+'px'; sp.style.top=(ft+fh*along)+'px'; sp.style.transform='translate(0,-50%)'; }
    else { sp.style.left=(fl+fw*along)+'px'; sp.style.top=ft+'px'; sp.style.transform='translate(-50%,-100%)'; } // 'top' (default)
    return true;
  }
  function animateChoices(P, scene){ if(!hasLayout(P, scene)) return; var lay=merged(P, scene); animate(document.getElementById('vn-choices'), lay.anim.choices); }
  /* continuePrompt placement deliberately isn't part of merged()'s always-
     merge-with-defaults behavior: unlike box/choices/portraits, its LEGACY
     placement lived in project.settings.continuePrompt (Settings modal, not
     the Canvas editor). The Canvas editor always writes SOME continuePrompt
     block into a saved layout once it has one (same shape as box2/3/4's
     always-present-but-often-disabled config), so presence alone can't mean
     "the author chose this" - only enabled:true does. Only returns something
     once an author has actually ticked that on at some scope; runtime.js
     falls back to the legacy settings-based placement otherwise. */
  function explicitContinuePrompt(P, scene){
    var g=(scene && scene.group && P.backdrops && P.backdrops[scene.group]) ? P.backdrops[scene.group].layout : null;
    var merged=Object.assign({}, DEF.continuePrompt, (P.layout&&P.layout.continuePrompt)||{}, (g&&g.continuePrompt)||{}, (scene&&scene.layout&&scene.layout.continuePrompt)||{});
    return merged.enabled ? merged : null;
  }
  window.VNLayout={ apply:apply, animateChoices:animateChoices, resolved:merged, explicitContinuePrompt:explicitContinuePrompt, applyName:applyName, applyNameToPortrait:applyNameToPortrait, boxAttachPos:boxAttachPos, hideUntilSpoken:hideUntilSpoken, DEFAULT:DEF };
})();
