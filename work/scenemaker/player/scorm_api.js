/* ============================================================================
   Scenemaker; SCORM runtime wrapper (SCORM 1.2 AND SCORM 2004)
   ----------------------------------------------------------------------------
   A dependency-free bridge that talks to whichever LMS runtime is present.
   It auto-detects the API (API_1484_11 = 2004, API = 1.2), or honours the
   version chosen in the project (settings.scorm.version), and maps a single
   set of helpers onto the right CMI data model:

     SCORM.init()                 initialise + resume status
     SCORM.getBookmark()          resume cursor (suspend_data)
     SCORM.setBookmark(str)       store resume cursor (+ location)
     SCORM.setScore(0..100)       raw/min/max (+ scaled on 2004)
     SCORM.setComplete(passed)    completion + (optional) success status
     SCORM.setIncomplete()        mark still in progress
     SCORM.interaction(o)         log a choice as a cmi.interactions record
     SCORM.commit() / finish()    flush / close (records session time)

   Reporting is configurable via settings.scorm:
     version:'1.2'|'2004', reportScore, masteryScore, reportInteractions,
     reportTime, reportSuccess.
   With no LMS present every call is a safe no-op and bookmarks fall back to
   localStorage, so the story still plays and resumes locally.
   ==========================================================================*/
(function(){
  'use strict';
  var api=null, mode='1.2', ready=false, startMs=0, ix=0, LS_KEY='scenemaker_bookmark';
  var cfg = (function(){ try{ return (window.VN_PROJECT&&window.VN_PROJECT.settings&&window.VN_PROJECT.settings.scorm)||{}; }catch(e){ return {}; } })();

  // #overlay: climbing win.parent can cross a cross-origin (or opaque
  // file:///sandboxed) frame boundary, where simply READING win[name]
  // throws a SecurityError instead of just coming back undefined - an
  // uncaught throw here used to abort the player's whole boot sequence the
  // moment it ran inside any such iframe (found via the new Overlay/popup
  // export, whose entire point is embedding in another page's iframe, but
  // it could already happen to any SCORM/preview export an LMS framed
  // cross-domain). Can't see into a frame once that happens, so there's
  // nothing further to find past it either; stop there instead of crashing.
  function findAPI(win, name){
    var t=0;
    while(win && t<500){
      var found; try{ found=win[name]; }catch(e){ return null; }
      if(found) return found;
      var p; try{ p=(win.parent&&win.parent!==win)?win.parent:null; }catch(e){ return null; }
      if(!p) return null;
      win=p; t++;
    }
    return null;
  }
  function locate(name){ var a=findAPI(window,name); if(!a && window.opener) a=findAPI(window.opener,name); return a; }

  // choose the runtime: honour the requested version, else auto-detect
  function pick(){
    var want=(cfg.version==='2004')?'2004':(cfg.version==='1.2'?'1.2':'auto');
    var a04=locate('API_1484_11'), a12=locate('API');
    if(want==='2004' && a04){ mode='2004'; return a04; }
    if(want==='1.2'  && a12){ mode='1.2';  return a12; }
    if(a04){ mode='2004'; return a04; }
    if(a12){ mode='1.2';  return a12; }
    return null;
  }
  var FN={ '1.2':{init:'LMSInitialize',get:'LMSGetValue',set:'LMSSetValue',commit:'LMSCommit',fin:'LMSFinish'},
           '2004':{init:'Initialize',get:'GetValue',set:'SetValue',commit:'Commit',fin:'Terminate'} };
  function G(k){ try{ return api[FN[mode].get](k); }catch(e){ return ''; } }
  function S(k,v){ try{ api[FN[mode].set](k,String(v)); return true; }catch(e){ return false; } }

  function fmtTime12(ms){ var s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=s%60;
    function p(n){ return (n<10?'0':'')+n; } return p(h)+':'+p(m)+':'+p(ss)+'.00'; }
  function fmtTime04(ms){ var s=Math.round(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=s%60;
    return 'PT'+(h?h+'H':'')+(m?m+'M':'')+ss+'S'; }

  var SCORM={
    present:false, version:function(){ return mode; },
    init:function(){
      api=pick(); if(!api){ this.present=false; return false; }
      this.present=true; startMs=Date.now();
      var ok=api[FN[mode].init](''); ready=(ok==='true'||ok===true);
      if(!ready) return false;
      if(mode==='2004'){
        var cs=G('cmi.completion_status'); if(cs===''||cs==='unknown'||cs==='not attempted') S('cmi.completion_status','incomplete');
        if(cfg.masteryScore!=null) S('cmi.scaled_passing_score', String(Math.max(0,Math.min(1,cfg.masteryScore/100))));
      } else {
        var st=G('cmi.core.lesson_status'); if(st===''||st==='unknown'||st==='not attempted') S('cmi.core.lesson_status','incomplete');
        if(cfg.masteryScore!=null) S('cmi.student_data.mastery_score', String(cfg.masteryScore));
      }
      this.commit(); return true;
    },
    _cap:function(){ return mode==='2004'?60000:3800; },   // suspend_data size budget
    getBookmark:function(){
      if(ready){ try{ return G(mode==='2004'?'cmi.suspend_data':'cmi.suspend_data')||''; }catch(e){ return ''; } }
      try{ return localStorage.getItem(LS_KEY)||''; }catch(e){ return ''; }
    },
    setBookmark:function(str){ str=String(str||''); if(str.length>this._cap()) str=str.slice(0,this._cap());
      if(ready){ S('cmi.suspend_data',str); S(mode==='2004'?'cmi.location':'cmi.core.lesson_location', str.slice(0,mode==='2004'?1000:255)); }
      else { try{ localStorage.setItem(LS_KEY,str); }catch(e){} }
    },
    setScore:function(raw){ if(!ready || cfg.reportScore===false) return; raw=Math.max(0,Math.min(100,Math.round(raw)));
      if(mode==='2004'){ S('cmi.score.raw',raw); S('cmi.score.min',0); S('cmi.score.max',100); S('cmi.score.scaled', String(raw/100)); }
      else { S('cmi.core.score.raw',raw); S('cmi.core.score.min',0); S('cmi.core.score.max',100); }
    },
    setComplete:function(passed){ if(!ready) return;
      if(mode==='2004'){ S('cmi.completion_status','completed'); if(cfg.reportSuccess!==false && passed!=null) S('cmi.success_status', passed?'passed':'failed'); }
      else { S('cmi.core.lesson_status', (cfg.reportSuccess!==false && passed!=null) ? (passed?'passed':'failed') : 'completed'); }
      this.commit();
    },
    setIncomplete:function(){ if(!ready) return; if(mode==='2004') S('cmi.completion_status','incomplete'); else S('cmi.core.lesson_status','incomplete'); },
    interaction:function(o){ if(!ready || cfg.reportInteractions===false) return; o=o||{};
      var p = (mode==='2004'?'cmi.interactions.':'cmi.interactions.')+ix+'.';
      S(p+'id', o.id||('choice_'+ix)); S(p+'type', o.type||'choice');
      if(mode==='2004'){ S(p+'learner_response', o.response||''); if(o.result!=null) S(p+'result', o.result); S(p+'timestamp', new Date().toISOString()); }
      else { S(p+'student_response', (o.response||'').slice(0,255)); if(o.result!=null) S(p+'result', o.result); }
      ix++;
    },
    commit:function(){ if(ready){ try{ api[FN[mode].commit](''); }catch(e){} } },
    finish:function(){ if(!ready) return;
      if(cfg.reportTime!==false){ var d=Date.now()-startMs; S(mode==='2004'?'cmi.session_time':'cmi.core.session_time', mode==='2004'?fmtTime04(d):fmtTime12(d)); }
      try{ api[FN[mode].commit](''); api[FN[mode].fin](''); }catch(e){} ready=false;
    }
  };
  window.addEventListener('beforeunload',function(){ SCORM.finish(); });
  window.SCORM=SCORM;
})();
