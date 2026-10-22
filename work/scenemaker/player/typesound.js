/* ============================================================================
   Scenemaker player; typing sound  (features #9, #3)
   Earthbound-style "blip" per typed character, synthesized with Web Audio (no
   audio file). Config comes from the speaking character:
       {enabled, wave, pitch(1..10), volume(1..10), chirp(0..10), detune(0..10)}
   wave: square | sine | triangle | sawtooth | noise (alien static).
   chirp: slides the pitch down over the blip. detune: adds a second detuned
   voice for a richer / weirder / alien tone. Driven by VNType.onTick.
   ==========================================================================*/
window.VNTypeSound = (function(){
  var ctx=null, cfg=null, master=1;
  function setMasterVolume(v){ master=Math.max(0,Math.min(1,Number(v))); }
  function ac(){ if(!ctx){ var AC=window.AudioContext||window.webkitAudioContext; if(AC){ try{ ctx=new AC(); }catch(e){} } } return ctx; }
  function set(c){ cfg = (c && c.enabled) ? c : null; }
  function freqFor(p){ return 140 + (Number(p)||6) * 70; }        // pitch 1..10 → ~210..840 Hz
  var _lastBlip=0;
  function blip(unit, delayMs){
    if(!cfg) return;
    if(unit!=null && /^\s+$/.test(unit)) return; // skip whitespace
    var now=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
    if(now-_lastBlip < 33) return;   // throttle to ~30/sec so fast typing stays crisp, not a buzz
    _lastBlip=now;
    var a=ac(); if(!a) return;
    if(a.state==='suspended' && a.resume){ try{ a.resume(); }catch(e){} }
    try{
      var t=a.currentTime, dur=(delayMs>0)?Math.max(0.018,Math.min(0.06, (delayMs/1000)*0.85)):0.06;
      var vol=Math.max(0,Math.min(1,(Number(cfg.volume)||5)/10))*0.14*master;
      var g=a.createGain(); g.connect(a.destination);
      g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      var freq=freqFor(cfg.pitch), chirp=Number(cfg.chirp)||0, detune=Number(cfg.detune)||0;
      if((cfg.wave||'square')==='noise'){
        var n=Math.floor(a.sampleRate*dur), buf=a.createBuffer(1,n,a.sampleRate), d=buf.getChannelData(0);
        for(var i=0;i<n;i++) d[i]=Math.random()*2-1;
        var src=a.createBufferSource(); src.buffer=buf; src.connect(g); src.start(t); src.stop(t+dur); return;
      }
      function voice(det){
        var o=a.createOscillator(); o.type=cfg.wave||'square';
        o.frequency.setValueAtTime(freq,t);
        if(chirp) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*(1-chirp*0.06)), t+dur);
        if(det) o.detune.value=det;
        o.connect(g); o.start(t); o.stop(t+dur);
      }
      voice(0);
      if(detune) voice(detune*14); // second detuned voice
    }catch(e){}
  }
  return { set:set, blip:blip, setMasterVolume:setMasterVolume };
})();
