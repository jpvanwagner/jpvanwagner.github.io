/* ============================================================================
   Scenemaker player; typewriter (text speed) engine  (feature #8)
   Reveals a line's text by letter, by word, by whole line, or instantly, at a
   chosen speed. Markup-agnostic: it types the PLAIN text, then swaps in the fully
   formatted (rich) version when done. Exposes window.VNType:
       VNType.play(el, markup, speed, onDone)   speed = {mode, speed(1..10)}
       VNType.finish()      finish the current reveal immediately (skip)
       VNType.typing()      → true while a reveal is in progress
       VNType.onTick        optional hook(el, index, unit); used by the typing
                            sound / word-trigger features (#9/#7) when present.
   Loaded before runtime.js so runtime can call it.
   ==========================================================================*/
window.VNType = (function(){
  var timer=null, el=null, full=null, cb=null, active=false;
  // #81: pause/resume support for the "stop when the box is full" overflow
  // mode - units/i/delay are hoisted out of play() (not just local to it) so
  // resume() can restart the same reveal exactly where pause() left it,
  // instead of needing its own copy of the reveal state.
  var units=null, i=0, delay=130, paused=false, pageStart=0;

  function delayFor(speed){
    var s = (speed && speed.speed!=null) ? Number(speed.speed) : 5; // 1 (slow) .. 10 (fast)
    return Math.max(6, Math.round(130 - s*12)); // ms per unit
  }
  function clear(){ if(timer){ clearInterval(timer); timer=null; } }

  // pageStart lets the visible text be a WINDOW into the full reveal
  // (units[pageStart..i]) rather than always from the very start - see
  // nextPage() below, the "stop when the box is full" overflow mode.
  function tick(){
    i++; el.textContent = units.slice(pageStart,i).join('');
    if(typeof VNType.onTick==='function'){ try{ VNType.onTick(el, i, units[i-1], delay); }catch(e){} }
    if(i>=units.length) done();
  }

  function done(){
    clear(); paused=false; pageStart=0;
    if(el && full!=null) el.innerHTML = full;
    active=false; var d=cb; cb=null; el=null; full=null; units=null;
    if(d) d();
  }

  function play(target, markup, speed, onDone){
    finish(); // wrap up anything mid-reveal
    var rich = window.vnRenderRich ? window.vnRenderRich(markup||'') : (markup||'');
    var mode = (speed && speed.mode) || 'letter';
    if(mode==='instant' || mode==='line'){ target.innerHTML = rich; active=false; onDone&&onDone(); return; }
    // derive the plain text from the rendered rich HTML (markup-agnostic)
    var tmp=document.createElement('div'); tmp.innerHTML=rich; var plain=tmp.textContent||'';
    if(!plain){ target.innerHTML=rich; active=false; onDone&&onDone(); return; }
    units = (mode==='word') ? (plain.match(/\S+\s*/g) || [plain]) : plain.split('');
    el=target; full=rich; cb=onDone; active=true; paused=false; pageStart=0;
    i=0; delay=delayFor(speed);
    el.textContent='';
    timer=setInterval(tick, delay);
  }

  function finish(){ if(active) done(); }
  function typing(){ return active; }
  // pause: stops revealing more units without finishing the line (unlike
  // finish(), the un-typed remainder stays un-typed) - the box keeps showing
  // whatever's already visible. No-op if not currently active or already paused.
  function pause(){ if(active && !paused && timer){ clear(); paused=true; } }
  function isPaused(){ return paused; }
  // #81: resumes a paused reveal as a fresh PAGE - clears the box and moves
  // the visible window to start from here, instead of continuing to append
  // onto text that already filled the box (which would just re-overflow on
  // the very next unit, forever). Only meaningful use of a pause right now
  // is the "stop when the box is full" overflow mode.
  function nextPage(){ if(active && paused){ pageStart=i; if(el) el.textContent=''; paused=false; timer=setInterval(tick, delay); } }

  return { play:play, finish:finish, typing:typing, pause:pause, isPaused:isPaused, nextPage:nextPage, onTick:null };
})();
