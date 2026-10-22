/* ============================================================================
   Scenemaker player; on-screen tools bar  (features #4-#9)
   A small bottom bar with the tools the author enabled: fullscreen, screenshot,
   a settings menu (volume/mute/text-speed), a backlog/history viewer, and a
   pulsing developer-note indicator. Reads window.VNRuntime. Self-contained CSS.
   ==========================================================================*/
(function(){
  function R(){ return window.VNRuntime; }
  function css(){ if(document.getElementById('vn-hud-css')) return;
    var s=document.createElement('style'); s.id='vn-hud-css';
    s.textContent=[
      '#vn-hud{position:absolute;left:0;right:0;bottom:0;z-index:60;display:flex;align-items:center;gap:6px;justify-content:flex-end;padding:5px 10px;background:linear-gradient(to top,rgba(0,0,0,.55),transparent);font-family:system-ui,sans-serif}',
      '.vn-hud-btn{background:rgba(20,22,30,.72);color:#e5e7eb;border:1px solid rgba(255,255,255,.18);border-radius:7px;padding:5px 9px;font-size:13px;cursor:pointer;line-height:1}',
      '.vn-hud-btn:hover{background:rgba(40,44,58,.92);border-color:var(--vn-accent,#e879f9)}',
      '#vn-devnote-ic{position:absolute;left:12px;bottom:6px;z-index:61;width:30px;height:30px;border-radius:50%;display:none;align-items:center;justify-content:center;cursor:pointer;background:rgba(232,121,249,.22);color:#fff;border:1px solid #e879f9;font-weight:700;animation:vnPulse 1.6s infinite}',
      '@keyframes vnPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,121,249,.6)}50%{box-shadow:0 0 0 8px rgba(232,121,249,0)}}',
      '.vn-ov{position:absolute;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72)}',
      '.vn-ov-card{background:#12151c;color:#e5e7eb;border:1px solid #333;border-radius:12px;padding:18px 20px;max-width:620px;max-height:82%;overflow:auto;line-height:1.55;box-shadow:0 20px 50px rgba(0,0,0,.5);width:92%}',
      '.vn-ov-card h3{margin:0 0 12px}',
      '.vn-row{display:flex;align-items:center;gap:10px;margin:9px 0}',
      '.vn-row label{flex:0 0 130px;color:#cbd5e1;font-size:13px}',
      '.vn-row input[type=range]{flex:1}',
      '.vn-log-line{padding:4px 0;border-bottom:1px solid #ffffff14}',
      '.vn-log-spk{color:#e879f9;font-weight:600}',
      '.vn-log-choice{color:#67e8f9}.vn-log-eff{color:#9ca3af;font-size:.85em;margin-left:14px}',
      '.vn-close{float:right;cursor:pointer;color:#9ca3af}.vn-close:hover{color:#ef4444}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function mk(tag,cls,html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
  function root(){ return (R()&&R().fullscreenRoot())||document.getElementById('vn-root')||document.body; }

  function build(){
    if(!R()) return;
    var hud=R().hud||{};
    if(!(hud.fullscreen||hud.screenshot||hud.settingsMenu||hud.backlog||hud.devNotes)) return;
    css();
    var host=root(); if(getComputedStyle(host).position==='static') host.style.position='relative';
    var bar=mk('div'); bar.id='vn-hud';
    if(hud.backlog){ var b=mk('button','vn-hud-btn','\u2637 Log'); b.title='Backlog; text & choices seen so far'; b.onclick=openBacklog; bar.appendChild(b); }
    if(hud.settingsMenu){ var st=mk('button','vn-hud-btn','\u2699'); st.title='Settings'; st.onclick=openSettings; bar.appendChild(st); }
    if(hud.screenshot){ var sc=mk('button','vn-hud-btn','\u1F4F7'.length?'\uD83D\uDCF7':'Shot'); sc.title='Screenshot (saves a PNG)'; sc.onclick=screenshot; bar.appendChild(sc); }
    if(hud.fullscreen){ var fs=mk('button','vn-hud-btn'); fs.id='vn-hud-fs'; fs.onclick=toggleFullscreen; bar.appendChild(fs); }
    host.appendChild(bar);
    refreshFsIcon();
    if(hud.devNotes){ var dn=mk('div',null,'<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADfElEQVR42uWXz2tdRRTHv2fuzX15iW0MiAYXNSLYQNHaIri1igsXxY0F3bgQWwU3riSShRv/gnbTlQtXygMXulBBzEJQ0UIl6UJB6MLGvtCWxL7XO2d+3Pl20XvbEGree8nLxl4YLszMnfO9M5/vnBngQX9ktx+SlPuMQwAQEe6bYpJC0gzoY7YJHM8MkJTm7+oA0yXKg1ksjsWUrkwXxV8ArIiksS9BE5xk24VwGsRrhMmFvEKDBYLrINpGDIU4X/z045dy4kTcKnrXAppBnHNHiOxcAh8H8G0y+E68XwkhlNnMTJHHeFQSThJ4XYhvWq38HQDcExP1msva2tqUOv+D1XCpLHlop2+c41H18fub5CP3AXZ3tJcaF0v1XZILdX3WwLalmAbQnnPPrK+vP7Rn4uv3hNWwUjr/1ZbgspMLho0xVMc+MEvBlBH8UvNQ1UDKfwTnsNO+o4BOp2MAII/xWSGfgEz8LiLcJGdJ5rUIsw3WJCJDg2eG3zMFQMwBYDJUbzkXz6+RUyKSmrWvnfKc3uNExsJAj3zM+viHi/FtkkLlgrrwq7rws6oebvpr4KtWw7+q8YNRWRgIofpw0ar/ommzlvPWh0vW+T97zh3REE6qC5dL9R+RnBllOx4kwgCA+rhUWn+N5GGS2V0RLv4WQtVVH69aH9/dj+RjAKDf789ZF/5W587W9QUA9B2PuxCj+upzAFheXs7r9nmS7bFlQACwPr5nXbjes/alRpy19kn1cVN9/JCk8GMakm314bNer/fo2GCsS25d7FgNNwLDiwCgqk+rjzfVx6W7MKpftBrWSE4NEmCGc6A0B43obP8MgNUUzackZ1NKbmtS2+DGwxQ8L8D7IlIOyob58NuAkGQmIhvq49ckP9lUnSHA6TuNqOF0KHBaRDaGOR2N5tPOvYOIiPgsTPb/abevVlW6hoRYb9FWRDaGXfd8JAGn7uT20sXLrdwcTK249JSHK1r5vA/VKWvddTNRpJjCqohc2LcjGckD6uMiiVcEqEwmIVZVbsQEETnOVK1MtoqXRUQHMbBXdxR1aTWev2X9GavhIsnpYSyY79aWdcbz29uyzBwgmLrdLsbPwBZHuBjfQCXHEpIzMIZkSOA8E98EsDo3N7e/F5Nb3r+Q0xyKZMwyABWALE8AgiFuTEzggohU/+urmdlhTI5yOXmwn9slIb7iOo7CgAAAAABJRU5ErkJggg==" alt="" style="width:16px;height:16px">'); dn.id='vn-devnote-ic'; dn.title='Developer note'; dn.onclick=openDevNote; host.appendChild(dn);
      R().onSceneChange=refreshDevNote; refreshDevNote(); }
  }
  function refreshDevNote(){ var ic=document.getElementById('vn-devnote-ic'); if(!ic||!R()) return;
    ic.style.display = R().currentDevNote() ? 'flex' : 'none'; }

  // ---- fullscreen (#5) ----
  // #75: enter and exit used the same glyph, so nothing on the button itself
  // showed which action clicking it would take; now each state gets its own
  // distinct icon (and title), and it stays correct even when fullscreen is
  // left via Escape or the browser's own UI, not just this button.
  var FS_ENTER_ICON='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  var FS_EXIT_ICON='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
  function refreshFsIcon(){ var fs=document.getElementById('vn-hud-fs'); if(!fs) return;
    var isFs=!!document.fullscreenElement;
    fs.innerHTML=isFs?FS_EXIT_ICON:FS_ENTER_ICON;
    fs.title=isFs?'Exit fullscreen':'Fullscreen'; }
  function toggleFullscreen(){ var el=root();
    if(!document.fullscreenElement){ (el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el); }
    else { (document.exitFullscreen||document.webkitExitFullscreen||function(){}).call(document); } }
  document.addEventListener('fullscreenchange', refreshFsIcon);
  document.addEventListener('webkitfullscreenchange', refreshFsIcon);

  // ---- screenshot (#6) ----
  // #13: this never actually worked - the collected <style> text (raw CSS,
  // valid straight inside HTML's own <style>) was concatenated directly
  // into the SVG's XHTML <style>, which is parsed as strict XML; any CSS
  // combinator/selector using a bare '>' (or an unescaped '&') makes that a
  // malformed document, so the resulting data: URI image failed to decode
  // at all (img.onerror fired) on every real stylesheet, every time - not a
  // "some browsers block this" edge case as the old comment assumed.
  // Wrapping the raw CSS in a CDATA section is the standard fix for mixing
  // literal text into XML this way.
  function flashBtn(btn, glyph){ if(!btn) return; var orig=btn.innerHTML; btn.innerHTML=glyph; setTimeout(function(){ btn.innerHTML=orig; }, 1400); }
  function screenshot(e){
    var btn=e&&e.currentTarget;
    try{
      var host=root(), r=host.getBoundingClientRect();
      var clone=host.cloneNode(true);
      var h=clone.querySelector('#vn-hud'); if(h)h.remove();
      var dn=clone.querySelector('#vn-devnote-ic'); if(dn)dn.remove();
      var styles=''; Array.prototype.forEach.call(document.querySelectorAll('style'), function(s){ if(s.id!=='vn-hud-css') styles+=s.textContent+'\n'; });
      var xml=new XMLSerializer().serializeToString(clone);
      var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+Math.round(r.width)+'" height="'+Math.round(r.height)+'">'
        +'<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style><![CDATA['+styles+']]></style>'+xml+'</div></foreignObject></svg>';
      var img=new Image();
      img.onload=function(){ try{
        var c=document.createElement('canvas'); c.width=r.width; c.height=r.height;
        var cx=c.getContext('2d'); cx.fillStyle='#000'; cx.fillRect(0,0,c.width,c.height); cx.drawImage(img,0,0);
        c.toBlob(function(bl){ if(!bl){ flashBtn(btn,'✖'); return; } var a=document.createElement('a'); a.href=URL.createObjectURL(bl);
          a.download='scenemaker-'+Date.now()+'.png'; document.body.appendChild(a); a.click(); a.remove(); flashBtn(btn,'✓'); });
      }catch(e2){ flashBtn(btn,'✖'); } };
      img.onerror=function(){ flashBtn(btn,'✖'); /* some engines still refuse to rasterize foreignObject content at all */ };
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    }catch(e3){ flashBtn(btn,'✖'); }
  }

  // ---- settings menu (#4) ----
  function overlay(html){ close(); var ov=mk('div','vn-ov'); ov.id='vn-ov'; ov.innerHTML='<div class="vn-ov-card">'+html+'</div>';
    ov.addEventListener('click',function(e){ if(e.target===ov) close(); }); root().appendChild(ov); return ov; }
  function close(){ var o=document.getElementById('vn-ov'); if(o)o.remove(); }
  function openSettings(){
    var muted=R().isMuted();
    // reflect whatever the player already set this session, rather than
    // always redrawing every slider at 100 regardless of the real value
    var vol=R().getVolumes();
    var spd=Math.round((R().getSpeedScale?R().getSpeedScale():1)*100);
    var ov=overlay('<h3>Settings <span class="vn-close" onclick="VNHud.close()">\u2715</span></h3>'
      +'<div class="vn-row"><label>Mute all</label><input type="checkbox" id="s-mute" '+(muted?'checked':'')+'></div>'
      +'<div class="vn-row"><label>Music volume</label><input type="range" id="s-mus" min="0" max="100" value="'+Math.round(vol.music*100)+'"></div>'
      +'<div class="vn-row"><label>Sound effects</label><input type="range" id="s-sfx" min="0" max="100" value="'+Math.round(vol.sfx*100)+'"></div>'
      +'<div class="vn-row"><label>Typing sound</label><input type="range" id="s-typ" min="0" max="100" value="'+Math.round(vol.typing*100)+'"></div>'
      +'<div class="vn-row"><label>Text speed</label><input type="range" id="s-spd" min="50" max="200" value="'+spd+'"></div>'
      +'<div class="vn-row"><label>Fullscreen</label><button class="vn-hud-btn" onclick="VNHud.fullscreen()">Toggle</button></div>');
    var g=function(id){ return ov.querySelector(id); };
    g('#s-mute').onchange=function(){ R().setMute(this.checked); };
    g('#s-mus').oninput=function(){ R().setMusicVol(this.value/100); };
    g('#s-sfx').oninput=function(){ R().setSfxVol(this.value/100); };
    g('#s-typ').oninput=function(){ R().setTypeVol(this.value/100); };
    g('#s-spd').oninput=function(){ R().setSpeedScale(this.value/100); };
  }

  // ---- backlog (#8) ----
  function openBacklog(){
    var log=R().log||[]; var body=log.map(function(e){
      if(e.kind==='line'){ return '<div class="vn-log-line">'+(e.speaker?'<span class="vn-log-spk">'+esc(e.speaker)+':</span> ':'')+esc(e.text)+'</div>'; }
      var eff=(e.effects&&e.effects.length)?('<div class="vn-log-eff">'+e.effects.map(esc).join(' · ')+'</div>'):'';
      return '<div class="vn-log-line"><span class="vn-log-choice">\u25B6 '+esc(e.text)+'</span>'+eff+'</div>';
    }).join('')||'<div class="vn-log-line">Nothing yet.</div>';
    var ov=overlay('<h3>Backlog <span class="vn-close" onclick="VNHud.close()">\u2715</span></h3><div>'+body+'</div>');
    var card=ov.querySelector('.vn-ov-card'); card.scrollTop=card.scrollHeight;
  }

  // ---- dev note (#7) ----
  function openDevNote(){ var d=R().currentDevNote(); if(!d) return;
    var media=(d.media||[]).map(function(m){ var u=R().mediaUrl(m.media); if(!u) return '';
      if(m.type==='image') return '<div class="vn-row"><img src="'+u+'" style="max-width:100%;border-radius:8px"></div>';
      if(m.type==='audio') return '<div class="vn-row"><audio controls src="'+u+'"></audio> '+esc(m.label||'')+'</div>';
      if(m.type==='video') return '<div class="vn-row"><video controls style="max-width:100%" src="'+u+'"></video></div>';
      return ''; }).join('');
    overlay('<h3>\u24D8 Developer note <span class="vn-close" onclick="VNHud.close()">\u2715</span></h3>'
      +'<div style="white-space:pre-wrap">'+esc(d.text||'')+'</div>'+media);
  }

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  // #96: openSettings exposed too (not just close/fullscreen/refreshDevNote)
  // so a title-screen "Settings" menu item can open this SAME overlay
  // before Play is even pressed, instead of needing its own second settings
  // UI - it already reads/writes real runtime state (volumes, text speed),
  // which works identically whether the story has started or not.
  window.VNHud={ close:close, fullscreen:toggleFullscreen, refreshDevNote:refreshDevNote, openSettings:openSettings };
  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded', function(){ setTimeout(build,50); });
  else setTimeout(build,50);
})();
