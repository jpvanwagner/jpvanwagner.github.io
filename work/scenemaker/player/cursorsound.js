/* ============================================================================
   Scenemaker player; menu cursor sound
   A short "blip" played whenever the pointer hovers, or keyboard focus lands
   on, a menu option - choice buttons and the HUD Settings menu's own items.
   Off by default (project.settings.cursorSound.enabled). No media set means
   "play the built-in synthesized blip" (a quick two-tone chirp, Web Audio,
   no bundled file - same no-external-asset approach typesound.js already
   uses for the typing blip); a custom media key overrides it. Shares the
   existing SFX volume channel rather than adding a whole new one.
   ==========================================================================*/
window.VNCursorSound = (function(){
  var ctx=null, cfg=null, customUrl=null, master=1;
  function ac(){ if(!ctx){ var AC=window.AudioContext||window.webkitAudioContext; if(AC){ try{ ctx=new AC(); }catch(e){} } } return ctx; }
  function setMasterVolume(v){ master=Math.max(0,Math.min(1,Number(v))); }
  function set(c, mediaUrl){ cfg=(c&&c.enabled)?c:null; customUrl=(cfg&&mediaUrl)?mediaUrl:null; }
  function playDefault(){
    var a=ac(); if(!a) return;
    if(a.state==='suspended' && a.resume){ try{ a.resume(); }catch(e){} }
    try{
      var t=a.currentTime, dur=0.07;
      var g=a.createGain(); g.connect(a.destination);
      g.gain.setValueAtTime(0.16*master,t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      var o=a.createOscillator(); o.type='square';
      o.frequency.setValueAtTime(520,t); o.frequency.exponentialRampToValueAtTime(880, t+dur*0.6);
      o.connect(g); o.start(t); o.stop(t+dur);
    }catch(e){}
  }
  function play(){
    if(!cfg) return;
    if(customUrl){ try{ var a=new Audio(customUrl); a.volume=master; var p=a.play(); if(p&&p.catch)p.catch(function(){}); }catch(e){} return; }
    playDefault();
  }
  return { set:set, play:play, setMasterVolume:setMasterVolume };
})();
