/* ============================================================================
   Scenemaker player; one-shot animated effects  (feature #2)
   window.VNSceneFx.fire('flash') plays a brief full-screen effect: light
   flashes, screen shake, glitch bursts, static, and more. Fired from cues tied
   to scene start/end, line start/end, a word being typed, or a character
   appearing. Self-contained CSS.
   ==========================================================================*/
(function(){
  var EFFECTS = ['flash','whiteflash','redflash','blueflash','shake','bigshake','rumble','glitch','static','zoompunch','blurpulse','fadeblack','fadewhite','invert','lightning','vignettepulse','chromatic','ripple','confetti','fireworks','goodcheck','badx'];
  function css(){ if(document.getElementById('vn-sfx-css')) return;
    var s=document.createElement('style'); s.id='vn-sfx-css';
    s.textContent=[
      '#vn-scenefx{position:absolute;inset:0;pointer-events:none;z-index:70;overflow:hidden}',
      '.sfx-layer{position:absolute;inset:0}',
      '@keyframes sfxFlash{0%{opacity:0}12%{opacity:.9}100%{opacity:0}}',
      '@keyframes sfxLightning{0%,100%{opacity:0}8%{opacity:.95}16%{opacity:.1}26%{opacity:.85}40%{opacity:0}70%{opacity:.6}82%{opacity:0}}',
      '@keyframes sfxFadeIn{0%{opacity:0}45%{opacity:1}100%{opacity:0}}',
      '@keyframes sfxInvert{0%,100%{filter:none}30%,60%{filter:invert(1) hue-rotate(180deg)}}',
      '@keyframes sfxBlur{0%,100%{filter:none}50%{filter:blur(6px)}}',
      '@keyframes sfxZoom{0%,100%{transform:scale(1)}30%{transform:scale(1.14)}55%{transform:scale(.97)}}',
      '@keyframes sfxShake{0%,100%{transform:translate(0,0)}10%{transform:translate(-6px,3px)}20%{transform:translate(7px,-4px)}30%{transform:translate(-8px,-3px)}40%{transform:translate(6px,5px)}50%{transform:translate(-5px,4px)}60%{transform:translate(6px,-5px)}70%{transform:translate(-6px,3px)}80%{transform:translate(5px,4px)}90%{transform:translate(-3px,-2px)}}',
      '@keyframes sfxBigShake{0%,100%{transform:translate(0,0) rotate(0)}15%{transform:translate(-14px,8px) rotate(-1deg)}30%{transform:translate(15px,-10px) rotate(1deg)}45%{transform:translate(-16px,-8px) rotate(-1deg)}60%{transform:translate(13px,11px) rotate(1deg)}75%{transform:translate(-11px,7px) rotate(-.5deg)}90%{transform:translate(8px,-6px)}}',
      '@keyframes sfxRumble{0%,100%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,2px)}}',
      '@keyframes sfxGlitchLayer{0%{opacity:0;clip-path:inset(0 0 100% 0)}10%{opacity:.9;clip-path:inset(20% 0 40% 0);transform:translateX(8px)}22%{clip-path:inset(60% 0 10% 0);transform:translateX(-10px)}34%{clip-path:inset(0 0 70% 0);transform:translateX(6px)}50%{opacity:.5}100%{opacity:0;transform:translateX(0)}}',
      '@keyframes sfxStatic{0%,100%{opacity:0}10%,90%{opacity:.5}}',
      '@keyframes sfxRipple{0%{transform:scale(0);opacity:.6}100%{transform:scale(2.4);opacity:0}}',
      '.sfx-shake{animation:sfxShake .5s ease}.sfx-bigshake{animation:sfxBigShake .7s ease}.sfx-rumble{animation:sfxRumble .12s linear 8}',
      '.sfx-zoompunch{animation:sfxZoom .45s ease}.sfx-blurpulse{animation:sfxBlur .6s ease}.sfx-invert{animation:sfxInvert .5s steps(2)}',
      // Celebration / bad-choice: a big green check or red X, popping in
      // with a brief overshoot then holding before fading, centered over
      // whatever's on screen.
      '@keyframes sfxBigIconPop{0%{opacity:0;transform:scale(.3)}14%{opacity:1;transform:scale(1.12)}26%{transform:scale(.96)}34%{transform:scale(1)}76%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}',
      '.sfx-bigicon{display:flex;align-items:center;justify-content:center}',
      '.sfx-bigicon svg{width:34%;max-width:220px;filter:drop-shadow(0 4px 18px rgba(0,0,0,.45));animation:sfxBigIconPop 1.1s ease}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function layer(){ var root=document.getElementById('vn-root')||document.body;
    var l=document.getElementById('vn-scenefx'); if(!l){ l=document.createElement('div'); l.id='vn-scenefx'; root.appendChild(l); } return l; }
  function stageEl(){ return document.getElementById('vn-stage')||document.getElementById('vn-frame')||document.getElementById('vn-root'); }
  function once(el, cls, ms){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(function(){ el.classList.remove(cls); }, ms); }
  function overlay(styleCss, anim, ms){ css(); var d=document.createElement('div'); d.className='sfx-layer'; d.style.cssText=styleCss+';animation:'+anim; layer().appendChild(d); setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, ms); }
  function noiseCanvas(ms){ css(); var c=document.createElement('canvas'); c.className='sfx-layer'; var L=layer(); L.appendChild(c);
    var r=L.getBoundingClientRect(); c.width=Math.max(2,r.width/2); c.height=Math.max(2,r.height/2); c.style.width='100%'; c.style.height='100%'; c.style.opacity='.35'; c.style.mixBlendMode='screen';
    var ctx=c.getContext&&c.getContext('2d'); var raf=null, t0=Date.now();
    function draw(){ if(!ctx){ return; } var img=ctx.createImageData(c.width,c.height); var d=img.data; for(var i=0;i<d.length;i+=4){ var v=Math.random()*255; d[i]=d[i+1]=d[i+2]=v; d[i+3]=255; } ctx.putImageData(img,0,0);
      if(Date.now()-t0<ms) raf=requestAnimationFrame(draw); else { if(c.parentNode)c.parentNode.removeChild(c); } }
    draw(); }
  // Celebration (confetti/fireworks) / bad-choice (big check/X): a direct
  // owner request for reaching specific endings or making specific choices
  // (wired via scene-start/end cues and a choice's own pickFx - see
  // core.js's sceneCuesHtml()/choiceLogicHtml()). Confetti/fireworks are
  // small canvas particle systems, same self-contained approach as this
  // file's existing 'static' noise canvas; a bare rect-per-confetti-piece
  // and radial-burst-per-firework keep this cheap enough to run without a
  // real physics/particle library.
  var CONFETTI_COLORS=['#f43f5e','#fb923c','#facc15','#4ade80','#38bdf8','#a78bfa','#f472b6'];
  function particleBurst(kind, ms){
    css(); var c=document.createElement('canvas'); c.className='sfx-layer'; var L=layer(); L.appendChild(c);
    var r=L.getBoundingClientRect(); var W=c.width=Math.max(2,r.width), H=c.height=Math.max(2,r.height);
    c.style.width='100%'; c.style.height='100%';
    var ctx=c.getContext&&c.getContext('2d'); if(!ctx){ if(c.parentNode)c.parentNode.removeChild(c); return; }
    var parts=[], t0=Date.now(), nextBurst=0;
    function spawnConfetti(n){ for(var i=0;i<n;i++) parts.push({x:Math.random()*W, y:-10-Math.random()*H*0.4, vx:(Math.random()-0.5)*2, vy:2+Math.random()*3, rot:Math.random()*6.28, vr:(Math.random()-0.5)*0.3, w:6+Math.random()*4, h:3+Math.random()*3, color:CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)]}); }
    function spawnFirework(){
      var cx=W*(0.2+Math.random()*0.6), cy=H*(0.15+Math.random()*0.35), color=CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)], n=26+Math.floor(Math.random()*12);
      for(var i=0;i<n;i++){ var ang=(i/n)*6.28, spd=2+Math.random()*3; parts.push({x:cx, y:cy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, r:2+Math.random()*1.5, color:color, life:0, spark:true}); }
    }
    if(kind==='confetti') spawnConfetti(90);
    function tick(){
      var elapsed=Date.now()-t0;
      if(kind==='fireworks' && elapsed>=nextBurst && elapsed<ms-300){ spawnFirework(); nextBurst=elapsed+280+Math.random()*260; }
      ctx.clearRect(0,0,W,H);
      for(var i=parts.length-1;i>=0;i--){ var p=parts[i];
        if(p.spark){ p.x+=p.vx; p.vy+=0.04; p.y+=p.vy; p.life++; var a=Math.max(0,1-p.life/40);
          ctx.fillStyle=p.color; ctx.globalAlpha=a; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); ctx.globalAlpha=1;
          if(a<=0) parts.splice(i,1);
        } else { p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.rot+=p.vr;
          ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();
          if(p.y>H+20) parts.splice(i,1);
        }
      }
      if(elapsed<ms || parts.length) requestAnimationFrame(tick); else if(c.parentNode) c.parentNode.removeChild(c);
    }
    tick();
  }
  function bigIcon(kind, ms){
    css(); var wrap=document.createElement('div'); wrap.className='sfx-layer sfx-bigicon';
    wrap.innerHTML = kind==='goodcheck'
      ? '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#22c55e" stroke-width="8"/><path d="M28 52 L44 68 L74 34" fill="none" stroke="#22c55e" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#ef4444" stroke-width="8"/><path d="M32 32 L68 68 M68 32 L32 68" stroke="#ef4444" stroke-width="9" stroke-linecap="round"/></svg>';
    layer().appendChild(wrap);
    setTimeout(function(){ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }, ms);
  }
  function fire(effect, intensity){
    css(); var k=(intensity||5)/5;
    switch(effect){
      case 'flash': case 'whiteflash': overlay('background:#fff;opacity:0','sfxFlash '+(0.5)+'s ease',600); break;
      case 'redflash': overlay('background:#e11d48;opacity:0','sfxFlash .55s ease',600); break;
      case 'blueflash': overlay('background:#3b82f6;opacity:0','sfxFlash .55s ease',600); break;
      case 'lightning': overlay('background:#fff;opacity:0','sfxLightning .9s ease',950); break;
      case 'fadeblack': overlay('background:#000;opacity:0','sfxFadeIn '+(0.6+0.3*k)+'s ease',(600+300*k)); break;
      case 'fadewhite': overlay('background:#fff;opacity:0','sfxFadeIn '+(0.6+0.3*k)+'s ease',(600+300*k)); break;
      case 'vignettepulse': overlay('background:radial-gradient(ellipse at center,transparent 40%,#000 100%);opacity:0','sfxFadeIn .7s ease',760); break;
      case 'shake': once(stageEl(),'sfx-shake',560); break;
      case 'bigshake': once(stageEl(),'sfx-bigshake',760); break;
      case 'rumble': once(stageEl(),'sfx-rumble',1000); break;
      case 'zoompunch': once(stageEl(),'sfx-zoompunch',480); break;
      case 'blurpulse': once(stageEl(),'sfx-blurpulse',640); break;
      case 'invert': once(stageEl(),'sfx-invert',520); break;
      case 'glitch': case 'chromatic':
        overlay('background:linear-gradient(90deg,rgba(255,0,80,.5),transparent 40%);mix-blend-mode:screen','sfxGlitchLayer .5s steps(4)',560);
        overlay('background:linear-gradient(270deg,rgba(0,255,255,.5),transparent 40%);mix-blend-mode:screen','sfxGlitchLayer .5s steps(4)',560);
        once(stageEl(),'sfx-shake',400); break;
      case 'static': noiseCanvas(500+300*k); break;
      case 'ripple': overlay('background:radial-gradient(circle,rgba(255,255,255,.4) 0%,transparent 60%);border-radius:50%;left:25%;top:25%;right:25%;bottom:25%','sfxRipple .7s ease',760); break;
      case 'confetti': particleBurst('confetti', 1700); break;
      case 'fireworks': particleBurst('fireworks', 2000); break;
      case 'goodcheck': bigIcon('goodcheck', 1150); break;
      case 'badx': bigIcon('badx', 1150); break;
      default: overlay('background:#fff;opacity:0','sfxFlash .5s ease',600);
    }
  }
  window.VNSceneFx = { fire:fire, list:EFFECTS };
})();
