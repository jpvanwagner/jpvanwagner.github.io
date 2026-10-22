/* ============================================================================
   Scenemaker player; full-screen effects  (feature #8, player side)
   window.VNFx.apply(list) layers any number of simultaneous effects: colour/
   contrast filters (combined into one CSS filter string), overlay washes
   (crt/glitch/bow/warm/cold/vignette, each its own layer) and, for weather/
   dust, independent animated canvas particle systems - e.g. CRT scanlines
   with a vignette and light snow, all applied together (#10). list is
   [{type, intensity}, ...]; apply() also still accepts the older single
   {overlay, filter, intensity} shape for projects that never touched the
   new stacked picker, so nothing changes for them. Self-contained: injects
   its own CSS.
   ==========================================================================*/
(function(){
  var root, filterTarget, layer, effectsLayer, canvas, cctx, raf=null, W=0, H=0;
  var particleSets={}; // type -> parts[]
  var particleIntensity={}; // type -> intensity, so a window resize can reseed at the right density
  var TRUE_FILTERS=['sepia','noir','contrast','dream'];
  var WASH_OR_OVERLAY=['warm','cold','vignette','crt','glitch','bow'];
  var PARTICLE_TYPES=['snow','rain','dust'];
  function css(){
    if(document.getElementById('vn-fx-css')) return;
    var s=document.createElement('style'); s.id='vn-fx-css';
    s.textContent=[
      '#vn-fx{position:absolute;inset:0;pointer-events:none;z-index:42;overflow:hidden}',
      '#vn-fx-layers{position:absolute;inset:0}',
      '#vn-fx-layers>div,#vn-fx>canvas{position:absolute;inset:0;width:100%;height:100%}',
      '.fx-crt{background:repeating-linear-gradient(to bottom,rgba(0,0,0,.18) 0,rgba(0,0,0,.18) 1px,transparent 1px,transparent 3px);mix-blend-mode:multiply;animation:fxflick 6s infinite}',
      '.fx-crt:after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.5) 100%)}',
      '@keyframes fxflick{0%,100%{opacity:.9}48%{opacity:.82}50%{opacity:1}}',
      '.fx-glitch{background:linear-gradient(90deg,rgba(255,0,60,.10),rgba(0,255,255,.10));mix-blend-mode:screen;animation:fxglitch .7s steps(2) infinite,fxtear 2.4s steps(1) infinite}',
      '@keyframes fxglitch{0%{transform:translateX(0)}20%{transform:translateX(-3px)}22%{transform:translateX(3px)}24%{transform:translateX(0)}70%{transform:translateX(2px)}72%{transform:translateX(0)}}',
      '.fx-vignette{background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.75) 100%)}',
      '.fx-bow{background:radial-gradient(ellipse at center,transparent 42%,rgba(0,0,0,.55) 100%);box-shadow:inset 0 0 60px 20px rgba(0,0,0,.35)}',
      '.fx-bow:before{content:"";position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,.05),transparent 40%);border-radius:50%/8%}',
      '@keyframes fxtear{0%,100%{clip-path:inset(0 0 0 0)}42%{clip-path:inset(18% 0 60% 0)}44%{clip-path:inset(60% 0 12% 0);transform:translateX(4px)}46%{clip-path:inset(0 0 0 0);transform:translateX(-4px)}80%{clip-path:inset(40% 0 40% 0)}82%{clip-path:inset(0 0 0 0)}}',
      '.fx-warm{background:rgba(255,168,74,.28);mix-blend-mode:soft-light}',
      '.fx-cold{background:rgba(70,130,255,.26);mix-blend-mode:soft-light}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function ensure(){
    css();
    root=document.getElementById('vn-root')||document.body;
    filterTarget=document.getElementById('vn-screen')||document.getElementById('vn-stage')||root;
    layer=document.getElementById('vn-fx');
    if(!layer){ layer=document.createElement('div'); layer.id='vn-fx'; root.appendChild(layer); }
    if(!effectsLayer){ effectsLayer=document.createElement('div'); effectsLayer.id='vn-fx-layers'; layer.appendChild(effectsLayer); }
    if(!canvas){ canvas=document.createElement('canvas'); layer.appendChild(canvas); cctx=canvas.getContext('2d'); }
  }
  function filterCss(f,k){ // k = intensity 0.2..2
    switch(f){
      case 'sepia':    return 'sepia('+(0.55*k)+') saturate(1.15)';
      case 'noir':     return 'grayscale('+Math.min(1,0.85*k)+') contrast('+(1+0.12*k)+')';
      case 'contrast': return 'contrast('+(1+0.32*k)+') saturate('+(1+0.22*k)+')';
      case 'dream':    return 'brightness('+(1+0.06*k)+') saturate(1.15) blur('+(0.6*k)+'px)';
      default: return 'none';
    }
  }
  function resize(){ if(!canvas) return; var r=(root&&root.getBoundingClientRect)?root.getBoundingClientRect():{width:960,height:600};
    W=canvas.width=Math.max(2,r.width||960); H=canvas.height=Math.max(2,r.height||600); }
  function newPart(type,intensity){ var s=(intensity||5)/5;
    if(type==='rain') return {x:Math.random()*W,y:Math.random()*H,l:8+Math.random()*12,v:6+Math.random()*6*s};
    if(type==='snow') return {x:Math.random()*W,y:Math.random()*H,r:1+Math.random()*2.5,v:0.5+Math.random()*1.2*s,sway:Math.random()*6};
    return {x:Math.random()*W,y:Math.random()*H,r:0.5+Math.random()*1.5,v:0.15+Math.random()*0.5*s,a:0.2+Math.random()*0.4}; // dust
  }
  function seed(type,intensity){ var n=Math.round((type==='rain'?120:type==='snow'?90:70)*((intensity||5)/6));
    var arr=[]; for(var i=0;i<n;i++) arr.push(newPart(type,intensity)); return arr; }
  function drawType(t,parts){
    if(t==='rain'){ cctx.strokeStyle='rgba(150,180,255,.5)'; cctx.lineWidth=1;
      parts.forEach(function(p){ cctx.beginPath(); cctx.moveTo(p.x,p.y); cctx.lineTo(p.x-2,p.y+p.l); cctx.stroke(); p.y+=p.v; p.x-=1; if(p.y>H){ p.y=-10; p.x=Math.random()*W; } }); }
    else if(t==='snow'){ cctx.fillStyle='rgba(255,255,255,.85)';
      parts.forEach(function(p){ cctx.beginPath(); cctx.arc(p.x,p.y,p.r,0,7); cctx.fill(); p.y+=p.v; p.x+=Math.sin((p.y+p.sway)/30)*0.6; if(p.y>H){ p.y=-6; p.x=Math.random()*W; } }); }
    else if(t==='dust'){ parts.forEach(function(p){ cctx.fillStyle='rgba(220,210,190,'+p.a+')'; cctx.beginPath(); cctx.arc(p.x,p.y,p.r,0,7); cctx.fill(); p.y+=p.v; p.x+=Math.sin(p.y/40)*0.3; if(p.y>H){ p.y=-4; p.x=Math.random()*W; } }); }
  }
  function frame(){
    if(!cctx){ raf=null; return; }
    var types=Object.keys(particleSets);
    if(!types.length){ raf=null; return; }
    cctx.clearRect(0,0,W,H);
    types.forEach(function(t){ drawType(t,particleSets[t]); });
    raf=requestAnimationFrame(frame);
  }
  // #10: accepts either the new [{type,intensity},...] stacked list, or the
  // older single {overlay,filter,intensity} object (projects/scenes/groups
  // that never touched the new picker); both resolve to the same internal shape.
  function normalizeList(fx){
    if(Array.isArray(fx)) return fx.filter(function(f){ return f && f.type && f.type!=='none'; });
    var out=[]; if(fx){
      if(fx.overlay && fx.overlay!=='none') out.push({type:fx.overlay, intensity:fx.intensity||5});
      if(fx.filter && fx.filter!=='none') out.push({type:fx.filter, intensity:fx.intensity||5});
    }
    return out;
  }
  function apply(fx){
    ensure();
    var list=normalizeList(fx);
    // 1. every true-CSS-filter entry (sepia/noir/contrast/dream) combines into one filter string
    var filterParts=[];
    list.forEach(function(f){ if(TRUE_FILTERS.indexOf(f.type)>=0){ var part=filterCss(f.type,(f.intensity||5)/5); if(part!=='none') filterParts.push(part); } });
    if(filterTarget) filterTarget.style.filter = filterParts.length ? filterParts.join(' ') : 'none';
    // 2. washes (warm/cold/vignette) and CSS overlays (crt/glitch/bow) each get their own layer
    effectsLayer.innerHTML='';
    var bow=null;
    list.forEach(function(f){
      if(WASH_OR_OVERLAY.indexOf(f.type)<0) return;
      var div=document.createElement('div');
      div.className='fx-'+f.type;
      div.style.opacity=Math.min(1,0.5+0.05*(f.intensity||5));
      effectsLayer.appendChild(div);
      if(f.type==='bow') bow=f;
    });
    if(filterTarget){
      filterTarget.style.borderRadius = bow ? Math.round(6+(bow.intensity||5)*1.4)+'px' : '';
      filterTarget.style.overflow = bow ? 'hidden' : '';
    }
    // 3. weather/dust: independent particle systems, one per active type, sharing one canvas
    var wanted={};
    list.forEach(function(f){ if(PARTICLE_TYPES.indexOf(f.type)>=0) wanted[f.type]=f.intensity||5; });
    Object.keys(particleSets).forEach(function(t){ if(!(t in wanted)){ delete particleSets[t]; delete particleIntensity[t]; } });
    if(Object.keys(wanted).length){
      resize();
      Object.keys(wanted).forEach(function(t){ particleIntensity[t]=wanted[t]; if(!particleSets[t]) particleSets[t]=seed(t,wanted[t]); });
      canvas.style.display='block';
      if(!raf) frame();
    } else {
      if(raf){ cancelAnimationFrame(raf); raf=null; }
      if(cctx) cctx.clearRect(0,0,W,H);
      if(canvas) canvas.style.display='none';
    }
  }
  function clear(){ apply([]); }
  window.addEventListener('resize', function(){
    var types=Object.keys(particleSets); if(!types.length) return;
    resize();
    types.forEach(function(t){ particleSets[t]=seed(t,particleIntensity[t]); });
  });
  window.VNFx={ apply:apply, clear:clear };
})();
