/* ============================================================================
   Scenemaker player; per-line sound effects  (feature #7)
   Each dialogue line can carry sound effects. An effect plays either after a
   delay from when the line appears, or the moment a chosen word is revealed by
   the typewriter. Effects can loop (off by default); any looping/queued effect
   is stopped when the line changes.
       VNSfx.load(sfxArray)      arm a line's effects (media values are ready URLs)
       VNSfx.tick(typedText)     called per typed unit; fires word-triggered ones
       VNSfx.stop()              stop + clear everything (called on line change)
   ==========================================================================*/
window.VNSfx = (function(){
  var timers=[], audios=[], pending=[], master=1;
  function setMasterVolume(v){ master=Math.max(0,Math.min(1,Number(v))); audios.forEach(function(a){ try{ a.volume=master; }catch(e){} }); }
  function stop(){
    timers.forEach(clearTimeout); timers=[];
    audios.forEach(function(a){ try{ a.pause(); }catch(e){} }); audios=[];
    pending=[];
  }
  function fire(url, loop){
    try{ var a=new Audio(url); a.loop=!!loop; a.volume=master; audios.push(a); var p=a.play(); if(p&&p.catch)p.catch(function(){}); }catch(e){}
  }
  function load(sfxArr){
    stop();
    (sfxArr||[]).forEach(function(s){
      if(!s || !s.media) return;
      if(s.onWord){ pending.push({ word:String(s.onWord).toLowerCase(), url:s.media, loop:s.loop, done:false }); }
      else { timers.push(setTimeout(function(){ fire(s.media, s.loop); }, Math.max(0, Number(s.delay)||0))); }
    });
  }
  function tick(typedText){
    if(!pending.length) return;
    var lower=String(typedText||'').toLowerCase();
    pending.forEach(function(p){ if(!p.done && lower.indexOf(p.word)>=0){ p.done=true; fire(p.url, p.loop); } });
  }
  return { load:load, tick:tick, stop:stop, setMasterVolume:setMasterVolume };
})();
