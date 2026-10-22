/* ============================================================================
   Scenemaker editor; Sound Studio  (feature #3; waveform + append, #84)
   Record from the mic (or load an existing asset), shape it with an OBS-style
   chain (input gain, low/high cut, 3-band EQ, compressor, noise gate, normalize),
   preview it, and save the processed clip to the asset library as a WAV.
   A simple peak-waveform canvas shows whatever's currently loaded (level-
   checking, spotting dead air/clipping - not a trim/select editor), and
   "+ Append" records more audio onto the END of the current clip instead of
   replacing it, for building up a take in pieces.
   Uses Web Audio + MediaRecorder; degrades gracefully if unavailable.
   Shares core.js scope.
   ==========================================================================*/
let _ssBuffer=null, _ssRec=null, _ssChunks=[], _ssStream=null, _ssPreview=null;
// a real 3-2-1 countdown before the mic actually goes live, so a take
// doesn't lose its first word to "wait, is this thing on"; _ssCountdownTimer
// is the live setInterval id (or null when no countdown is running).
let _ssCountdownTimer=null;
// #123: waveform selection (click-drag a range) + an internal clipboard, so
// a clip can be trimmed/edited right here instead of only shaping the WHOLE
// buffer with the effect chain below. _ssSel is {start,end} in SAMPLES
// (start<=end always), or null when nothing is selected.
let _ssSel=null, _ssClipboard=null, _ssDragStart=null;
const _ssFx = { inGain:0, lowCut:70, highCut:16000, eqLow:0, eqMid:0, eqHigh:0,
                compThresh:-24, compRatio:3, compAttack:3, compRelease:150, gate:-60, normalize:true, outGain:0 };

function _ssAC(){ try{ return new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } }
function _db2gain(db){ return Math.pow(10, db/20); }

function openSoundStudio(){
  let bg=document.getElementById('sound-studio');
  if(!bg){ bg=document.createElement('div'); bg.id='sound-studio'; bg.className='modal-bg hidden';
    // #172: the mic itself can't follow a detached copy (getUserMedia is tied
    // to whichever window actually requested it) - recording always still
    // happens back here in the main window even while this is popped out
    // elsewhere, so a permission prompt or the live recording indicator may
    // appear there instead of in the detached window the user is looking at.
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('sound-studio', 'Sound Studio') : '';
    bg.innerHTML=`<div class="modal-card" style="max-width:560px"><h2>\uD83C\uDF99 Sound Studio${detachIco}</h2>
      <div class="modal-body" id="ss-body"></div>
      <div class="modal-foot"><button class="tb-btn tb-slate" onclick="closeSoundStudio()">Close</button></div></div>`;
    document.body.appendChild(bg);
  }
  renderSoundStudio(); bg.classList.remove('hidden');
  if(typeof maybeShowMini==='function') maybeShowMini('soundstudio');
}
function closeSoundStudio(){ ssStopPreview(); if(_ssCountdownTimer){ clearInterval(_ssCountdownTimer); _ssCountdownTimer=null; } if(_ssRec&&_ssRec.state==='recording'){ try{_ssRec.stop();}catch(e){} } if(_ssStream){ _ssStream.getTracks().forEach(t=>t.stop()); _ssStream=null; } _ssDragStart=null; document.getElementById('sound-studio').classList.add('hidden'); }
/* open the studio already loaded with an existing library asset, e.g. from the Assets panel's right-click menu */
function openSoundStudioWithAsset(k){
  openSoundStudio();
  const sel=document.getElementById('ss-load');
  if(sel && Array.from(sel.options).some(o=>o.value===k)){ sel.value=k; ssLoadAsset(); }
  else { _ssMsg('That asset could not be loaded here.'); }
}

function renderSoundStudio(){
  const body=document.getElementById('ss-body'); if(!body) return; const f=_ssFx;
  const audioKeys=Object.keys(project.media||{}).filter(k=>/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(k));
  const sl=(id,label,min,max,val,step)=>`<div class="ss-row"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step||1}" value="${val}" oninput="ssSet('${id}',this.value)"><span class="ss-val" id="ssv-${id}">${val}</span></div>`;
  body.innerHTML=`
    <div class="ss-source">
      <button class="tb-btn tb-accent" id="ss-recbtn" onclick="ssRecordClick(false)" title="Start (or stop) recording, after a short 3-2-1 countdown; a new take replaces whatever clip is currently loaded. Click again during the countdown to cancel it">\u25CF Record</button>
      <button class="mini-btn" id="ss-appendbtn" onclick="ssRecordClick(true)" ${(_ssBuffer && !(_ssRec&&_ssRec.state==='recording') && !_ssCountdownTimer)?'':'disabled'} title="Record more audio (after the same 3-2-1 countdown) and tack it onto the END of the current clip, instead of replacing it">+ Append</button>
      <span class="ss-recdot${(_ssRec&&_ssRec.state==='recording')?'':' hidden'}" id="ss-recdot" title="Recording"></span>
      <span class="hint" id="ss-status">${_ssBuffer?('clip ready ('+_ssBuffer.duration.toFixed(1)+'s)'):'no clip yet'}</span>
      <span style="flex:1"></span>
      ${audioKeys.length?`<select id="ss-load" class="mini-sel">${audioKeys.map(k=>`<option value="${escAttr(k)}">${escHtml(k.split('/').pop())}</option>`).join('')}</select><button class="mini-btn" onclick="ssLoadAsset()">load asset</button>`:''}
    </div>
    <canvas id="ss-wave" width="600" height="72" style="width:100%;height:72px;display:block;background:#0b1120;border:1px solid #334155;border-radius:6px;margin:6px 0;cursor:${_ssBuffer?'text':'default'}"
      onmousedown="ssWaveDown(event)" title="${_ssBuffer?'Click-drag to select a range to copy/trim/delete':''}"></canvas>
    <div class="ss-source" style="margin:-2px 0 6px">
      <span class="hint" id="ss-selinfo">${_ssSelInfoText()}</span>
      <span style="flex:1"></span>
      <button class="mini-btn" id="ss-copy" onclick="ssCopySelection()" ${_ssHasSel()?'':'disabled'} title="Copy the selected range to the clipboard">Copy</button>
      <button class="mini-btn" id="ss-trim" onclick="ssTrimToSelection()" ${_ssHasSel()?'':'disabled'} title="Keep only the selected range, discard the rest">Trim to selection</button>
      <button class="mini-btn warn" id="ss-delsel" onclick="ssDeleteSelection()" ${_ssHasSel()?'':'disabled'} title="Remove the selected range from the clip">Delete selection</button>
      <button class="mini-btn" id="ss-paste" onclick="ssPasteClipboard()" ${_ssClipboard?'':'disabled'} title="Insert the copied clip at the selection (or at the end, if nothing is selected)">Paste</button>
    </div>
    <div class="sec"><h3>Filters &amp; dynamics</h3>
      ${sl('inGain','Input gain (dB)',-24,24,f.inGain)}
      ${sl('lowCut','Low cut / high-pass (Hz)',20,400,f.lowCut)}
      ${sl('highCut','High cut / low-pass (Hz)',2000,20000,f.highCut,100)}
      ${sl('eqLow','EQ low (dB)',-15,15,f.eqLow)}
      ${sl('eqMid','EQ mid (dB)',-15,15,f.eqMid)}
      ${sl('eqHigh','EQ high (dB)',-15,15,f.eqHigh)}
      ${sl('compThresh','Compressor threshold (dB)',-60,0,f.compThresh)}
      ${sl('compRatio','Compressor ratio',1,20,f.compRatio)}
      ${sl('gate','Noise gate (dB, -100 = off)',-100,-10,f.gate)}
      ${sl('outGain','Output gain (dB)',-24,24,f.outGain)}
      <label class="chk"><input type="checkbox" ${f.normalize?'checked':''} onchange="ssSet('normalize',this.checked)"> Normalize (bring peak up to full)</label>
    </div>
    <div style="display:flex;gap:8px">
      <button class="tb-btn" onclick="ssPreview()" ${_ssBuffer?'':'disabled'}>\u25B6 Preview processed</button>
      <button class="tb-btn" onclick="ssStopAny()" title="Stops whatever's currently happening here: an in-progress recording, a running countdown, or preview playback">\u25A0 Stop</button>
      <span style="flex:1"></span>
      <button class="tb-btn tb-emerald" onclick="ssSaveToLibrary()" ${_ssBuffer?'':'disabled'}>Save to library</button>
    </div>
    <div class="hint" id="ss-msg" style="margin-top:6px"></div>`;
  ssDrawWaveform();
}
function ssSet(id,v){ _ssFx[id]=(id==='normalize')?!!v:parseFloat(v); const el=document.getElementById('ssv-'+id); if(el) el.textContent=(''+_ssFx[id]); }
function _ssMsg(t){ const m=document.getElementById('ss-msg'); if(m) m.textContent=t||''; }
function _ssHasSel(){ return !!(_ssBuffer && _ssSel && _ssSel.end>_ssSel.start); }
function _ssSelInfoText(){
  if(!_ssBuffer) return '';
  if(!_ssHasSel()) return _ssClipboard ? ('clipboard: '+_ssClipboard.duration.toFixed(2)+'s') : 'no selection';
  const dur=(_ssSel.end-_ssSel.start)/_ssBuffer.sampleRate;
  return 'selected '+dur.toFixed(2)+'s'+(_ssClipboard?' · clipboard: '+_ssClipboard.duration.toFixed(2)+'s':'');
}

/* ---- record ---- */
let _ssAppendMode=false;
// append (#84): concatenate two AudioBuffers end-to-end - the SAME shape a
// real AudioBuffer already has (numberOfChannels/length/sampleRate/
// getChannelData), so this works whether `a`/`b` came from a real decode or
// (in tests) a plain stand-in object with just those four members.
function ssConcatBuffers(a,b){
  if(!a) return b; if(!b) return a;
  const ch=Math.max(a.numberOfChannels,b.numberOfChannels), rate=a.sampleRate||b.sampleRate, len=a.length+b.length;
  let out; try{ out=new AudioBuffer({numberOfChannels:ch, length:len, sampleRate:rate}); }
  catch(e){ const ac=_ssAC(); if(!ac) return a; out=ac.createBuffer(ch, len, rate); }
  for(let c=0;c<ch;c++){ const dst=out.getChannelData(c);
    dst.set(a.getChannelData(Math.min(c,a.numberOfChannels-1)), 0);
    dst.set(b.getChannelData(Math.min(c,b.numberOfChannels-1)), a.length); }
  return out;
}
function ssToggleRecord(append){
  if(_ssRec && _ssRec.state==='recording'){ _ssRec.stop(); return; }
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){ _ssMsg('Recording is not supported in this environment.'); return; }
  _ssAppendMode = !!append && !!_ssBuffer;
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
    _ssStream=stream; _ssChunks=[]; _ssRec=new MediaRecorder(stream);
    _ssRec.ondataavailable=function(e){ if(e.data&&e.data.size) _ssChunks.push(e.data); };
    _ssRec.onstop=function(){ var blob=new Blob(_ssChunks,{type:_ssChunks[0]?_ssChunks[0].type:'audio/webm'});
      var ac=_ssAC(); if(!ac){ _ssMsg('Audio not available.'); return; }
      var wasAppend=_ssAppendMode, priorBuffer=_ssBuffer; _ssAppendMode=false;
      blob.arrayBuffer().then(function(ab){ ac.decodeAudioData(ab, function(buf){
        _ssBuffer = wasAppend ? ssConcatBuffers(priorBuffer, buf) : buf; _ssSel=null;
        renderSoundStudio(); _ssMsg((wasAppend?'Appended ':'Recorded ')+buf.duration.toFixed(1)+'s'+(wasAppend?(' (clip now '+_ssBuffer.duration.toFixed(1)+'s)'):''));
      }, function(){ _ssMsg('Could not decode the recording.'); }); });
      if(_ssStream){ _ssStream.getTracks().forEach(t=>t.stop()); _ssStream=null; }
      var b=document.getElementById('ss-recbtn'); if(b){ b.textContent='\u25CF Record'; b.classList.add('tb-accent'); }
      var dot=document.getElementById('ss-recdot'); if(dot) dot.classList.add('hidden'); };
    _ssRec.start();
    var b=document.getElementById('ss-recbtn'); if(b){ b.textContent='\u25A0 Stop'; b.classList.remove('tb-accent'); }
    var dot=document.getElementById('ss-recdot'); if(dot) dot.classList.remove('hidden');
    var ab=document.getElementById('ss-appendbtn'); if(ab) ab.disabled=true;
    _ssMsg((_ssAppendMode?'Recording more to append\u2026':'Recording\u2026')+' click \u25A0 Stop (or Record again) when done.');
  }).catch(function(){ _ssAppendMode=false; _ssMsg('Microphone permission denied or unavailable.'); });
}
// UI-level wrapper around ssToggleRecord(): runs a real 3-2-1 countdown
// before the mic actually goes live, so a take doesn't lose its first word
// to "wait, is this thing on". ssToggleRecord() itself stays countdown-free
// (existing/future direct callers, including tests, still get an immediate
// start) - only the Record/Append buttons a user actually clicks route
// through here.
function ssRecordClick(append){
  if(_ssCountdownTimer){ ssCancelCountdown(); return; }               // a second click cancels the count
  if(_ssRec && _ssRec.state==='recording'){ ssToggleRecord(append); return; } // stopping is immediate, no countdown
  ssStartCountdown(append);
}
function ssStartCountdown(append){
  if(_ssCountdownTimer) return;
  let n=3;
  const paint=()=>{
    const btn=document.getElementById('ss-recbtn'); if(btn) btn.textContent='\u23F1 '+n;
    const ab=document.getElementById('ss-appendbtn'); if(ab) ab.disabled=true;
    _ssMsg('Get ready\u2026 recording starts in '+n+'. Click Record again to cancel.');
  };
  paint();
  _ssCountdownTimer=setInterval(()=>{
    n--;
    if(n<=0){ clearInterval(_ssCountdownTimer); _ssCountdownTimer=null; ssToggleRecord(append); return; }
    paint();
  }, 1000);
}
function ssCancelCountdown(){
  if(!_ssCountdownTimer) return;
  clearInterval(_ssCountdownTimer); _ssCountdownTimer=null;
  renderSoundStudio(); _ssMsg('Recording canceled.');
}
// the bottom "\u25A0 Stop" button used to only ever call ssStopPreview(), so
// clicking it mid-recording (the natural thing to reach for) silently did
// nothing - the actual stop control was only the OTHER button up top, which
// by then read "\u25A0 Stop" too (same label, two different meanings). This
// one stop button now genuinely stops whatever's actually happening.
function ssStopAny(){
  if(_ssCountdownTimer){ ssCancelCountdown(); return; }
  if(_ssRec && _ssRec.state==='recording'){ ssToggleRecord(false); return; }
  ssStopPreview();
}
function ssLoadAsset(){ const sel=document.getElementById('ss-load'); if(!sel||!sel.value) return; const url=mediaURL(sel.value); const ac=_ssAC(); if(!ac) return;
  fetch(url).then(r=>r.arrayBuffer()).then(ab=>ac.decodeAudioData(ab, buf=>{ _ssBuffer=buf; _ssSel=null; renderSoundStudio(); _ssMsg('Loaded '+buf.duration.toFixed(1)+'s'); }, ()=>_ssMsg('Could not decode that asset.'))).catch(()=>_ssMsg('Could not load that asset.')); }

/* ---- waveform (#84, #123): a peak-per-column view of whatever's loaded,
   drawn fresh any time renderSoundStudio() runs (record/append/load all
   funnel through it already), with a click-drag selection overlay - not
   just level-checking/spotting dead air/clipping anymore, since the
   selection now feeds real Copy/Trim/Delete/Paste editing below. */
function ssWaveformPeaks(buf, width){
  const ch=buf.numberOfChannels, len=buf.length, step=Math.max(1, Math.floor(len/width));
  const chans=[]; for(let c=0;c<ch;c++) chans.push(buf.getChannelData(c));
  const points=[];
  for(let x=0;x<width;x++){
    const start=x*step, end=Math.min(len, start+step); let peak=0;
    for(let i=start;i<end;i++) for(let c=0;c<ch;c++){ const v=Math.abs(chans[c][i]); if(v>peak) peak=v; }
    points.push(peak);
  }
  return points;
}
function ssDrawWaveform(){
  const canvas=document.getElementById('ss-wave'); if(!canvas) return;
  const ctx=canvas.getContext && canvas.getContext('2d'); if(!ctx) return;
  const w=canvas.width, h=canvas.height, mid=h/2;
  ctx.clearRect(0,0,w,h);
  if(!_ssBuffer || !_ssBuffer.length) return;
  const pts=ssWaveformPeaks(_ssBuffer, w);
  // reads the CURRENT theme's accent colour rather than a hardcoded fuchsia,
  // so the waveform always matches whichever theme is active.
  const accentHex=(getComputedStyle(document.documentElement).getPropertyValue('--accent')||'#e879f9').trim();
  ctx.strokeStyle=accentHex; ctx.lineWidth=1; ctx.beginPath();
  pts.forEach((p,x)=>{ const y=Math.max(1,p*mid); ctx.moveTo(x+0.5, mid-y); ctx.lineTo(x+0.5, mid+y); });
  ctx.stroke();
  if(_ssSel && _ssBuffer.length){
    const x0=_ssSel.start/_ssBuffer.length*w, x1=_ssSel.end/_ssBuffer.length*w;
    const [ar,ag,ab]=hexToRgb(accentHex);
    ctx.fillStyle=`rgba(${ar},${ag},${ab},0.25)`; ctx.fillRect(x0,0,Math.max(1,x1-x0),h);
  }
}
// #123: sample index under a real page-coordinate click, for the waveform's
// own click-drag selection; separated from the mousedown handler itself so
// tests can drive selection with plain sample numbers instead of needing
// jsdom's zero-sized getBoundingClientRect() to cooperate.
function _ssSampleAtClientX(canvas, clientX){
  const r=canvas.getBoundingClientRect(); const rw=r.width||canvas.width;
  const x=Math.max(0,Math.min(canvas.width,(clientX-r.left)*(canvas.width/rw)));
  return Math.round(x/canvas.width*_ssBuffer.length);
}
function ssWaveDown(e){
  if(!_ssBuffer||!_ssBuffer.length) return;
  const canvas=document.getElementById('ss-wave'); if(!canvas) return;
  _ssDragStart=_ssSampleAtClientX(canvas, e.clientX);
  _ssSel={start:_ssDragStart,end:_ssDragStart}; ssDrawWaveform();
}
window.addEventListener('mousemove', e=>{
  if(_ssDragStart==null||!_ssBuffer) return;
  const canvas=document.getElementById('ss-wave'); if(!canvas) return;
  const s=_ssSampleAtClientX(canvas, e.clientX);
  _ssSel={start:Math.min(_ssDragStart,s), end:Math.max(_ssDragStart,s)};
  ssDrawWaveform();
});
window.addEventListener('mouseup', ()=>{
  if(_ssDragStart==null) return; _ssDragStart=null;
  // a near-zero drag (a plain click) clears the selection rather than
  // leaving a phantom one-sample range that would otherwise "count" as one
  const minSamples = _ssBuffer ? Math.max(1,Math.floor(_ssBuffer.sampleRate*0.005)) : 1;
  if(_ssSel && (_ssSel.end-_ssSel.start)<minSamples) _ssSel=null;
  _ssRefreshEditButtons();
});
function _ssRefreshEditButtons(){
  const info=document.getElementById('ss-selinfo'); if(info) info.textContent=_ssSelInfoText();
  const has=_ssHasSel();
  ['ss-copy','ss-trim','ss-delsel'].forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=!has; });
  const pb=document.getElementById('ss-paste'); if(pb) pb.disabled=!_ssClipboard;
  ssDrawWaveform();
}
// #123: slice out [startSample,endSample) as a brand-new AudioBuffer, and
// remove that same range in place (splicing the rest together) - the two
// primitives Copy/Trim/Delete/Paste below are all built from. Same
// real-buffer-or-plain-stand-in duck-typing ssConcatBuffers already relies
// on, so these work against the same test doubles.
function ssSliceBuffer(buf, startSample, endSample){
  const ch=buf.numberOfChannels, rate=buf.sampleRate, len=Math.max(1,endSample-startSample);
  let out; try{ out=new AudioBuffer({numberOfChannels:ch, length:len, sampleRate:rate}); }
  catch(e){ const ac=_ssAC(); if(!ac) return null; out=ac.createBuffer(ch, len, rate); }
  for(let c=0;c<ch;c++){ const src=buf.getChannelData(Math.min(c,buf.numberOfChannels-1));
    out.getChannelData(c).set(src.subarray(startSample,endSample)); }
  return out;
}
function ssRemoveRange(buf, startSample, endSample){
  const ch=buf.numberOfChannels, rate=buf.sampleRate, len=Math.max(1, buf.length-(endSample-startSample));
  let out; try{ out=new AudioBuffer({numberOfChannels:ch, length:len, sampleRate:rate}); }
  catch(e){ const ac=_ssAC(); if(!ac) return buf; out=ac.createBuffer(ch, len, rate); }
  for(let c=0;c<ch;c++){ const src=buf.getChannelData(Math.min(c,buf.numberOfChannels-1)), dst=out.getChannelData(c);
    dst.set(src.subarray(0,startSample),0);
    dst.set(src.subarray(endSample), startSample); }
  return out;
}
function ssCopySelection(){ if(!_ssHasSel()) return; _ssClipboard=ssSliceBuffer(_ssBuffer,_ssSel.start,_ssSel.end);
  _ssMsg('Copied '+_ssClipboard.duration.toFixed(2)+'s'); _ssRefreshEditButtons(); }
function ssTrimToSelection(){ if(!_ssHasSel()) return; _ssBuffer=ssSliceBuffer(_ssBuffer,_ssSel.start,_ssSel.end); _ssSel=null;
  renderSoundStudio(); _ssMsg('Trimmed to selection ('+_ssBuffer.duration.toFixed(2)+'s)'); }
function ssDeleteSelection(){ if(!_ssHasSel()) return; _ssBuffer=ssRemoveRange(_ssBuffer,_ssSel.start,_ssSel.end); _ssSel=null;
  renderSoundStudio(); _ssMsg('Deleted selection ('+_ssBuffer.duration.toFixed(2)+'s left)'); }
function ssPasteClipboard(){
  if(!_ssClipboard){ _ssMsg('Clipboard is empty; copy a selection first.'); return; }
  const insertAt=_ssHasSel() ? _ssSel.start : (_ssBuffer ? _ssBuffer.length : 0);
  const before=(_ssBuffer && insertAt>0) ? ssSliceBuffer(_ssBuffer,0,insertAt) : null;
  const after=(_ssBuffer && insertAt<_ssBuffer.length) ? ssSliceBuffer(_ssBuffer,insertAt,_ssBuffer.length) : null;
  let result=before ? ssConcatBuffers(before,_ssClipboard) : _ssClipboard;
  if(after) result=ssConcatBuffers(result,after);
  _ssBuffer=result; _ssSel=null; renderSoundStudio(); _ssMsg('Pasted '+_ssClipboard.duration.toFixed(2)+'s');
}

/* ---- build the effect chain onto a context ---- */
function ssBuildChain(ctx, srcNode){
  const f=_ssFx;
  const g0=ctx.createGain(); g0.gain.value=_db2gain(f.inGain);
  const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=f.lowCut;
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=f.highCut;
  const eqL=ctx.createBiquadFilter(); eqL.type='lowshelf'; eqL.frequency.value=250; eqL.gain.value=f.eqLow;
  const eqM=ctx.createBiquadFilter(); eqM.type='peaking'; eqM.frequency.value=1200; eqM.Q.value=1; eqM.gain.value=f.eqMid;
  const eqH=ctx.createBiquadFilter(); eqH.type='highshelf'; eqH.frequency.value=5000; eqH.gain.value=f.eqHigh;
  const comp=ctx.createDynamicsCompressor(); comp.threshold.value=f.compThresh; comp.ratio.value=f.compRatio; comp.attack.value=f.compAttack/1000; comp.release.value=f.compRelease/1000;
  const g1=ctx.createGain(); g1.gain.value=_db2gain(f.outGain);
  srcNode.connect(g0); g0.connect(hp); hp.connect(lp); lp.connect(eqL); eqL.connect(eqM); eqM.connect(eqH); eqH.connect(comp); comp.connect(g1);
  return g1;
}
function ssPreview(){ ssStopPreview(); if(!_ssBuffer) return; const ctx=_ssAC(); if(!ctx) return; _ssPreview=ctx;
  const src=ctx.createBufferSource(); src.buffer=_ssBuffer; const out=ssBuildChain(ctx, src); out.connect(ctx.destination); src.start(); src.onended=function(){ ssStopPreview(); }; }
function ssStopPreview(){ if(_ssPreview){ try{ _ssPreview.close(); }catch(e){} _ssPreview=null; } }

/* ---- offline render + WAV encode + save ---- */
function ssSaveToLibrary(){ if(!_ssBuffer){ return; }
  const Off=window.OfflineAudioContext||window.webkitOfflineAudioContext; if(!Off){ _ssMsg('Rendering not supported here.'); return; }
  _ssMsg('Rendering\u2026'); const ch=_ssBuffer.numberOfChannels, len=_ssBuffer.length, rate=_ssBuffer.sampleRate;
  const octx=new Off(ch, len, rate); const src=octx.createBufferSource(); src.buffer=_ssBuffer; const out=ssBuildChain(octx, src); out.connect(octx.destination); src.start();
  octx.startRendering().then(function(rendered){
    ssNoiseGate(rendered, _ssFx.gate); if(_ssFx.normalize) ssNormalize(rendered);
    const wav=ssBufferToWav(rendered); const key=makeKey('recording.wav'); project.media[key]=wav;
    pushUndo(); if(typeof _assetSel!=='undefined') _assetSel=key; if(typeof renderAssetsPanel==='function') renderAssetsPanel();
    _ssMsg('Saved to the asset library.'); toast('Sound saved to the library');
  }).catch(function(){ _ssMsg('Render failed.'); });
}
function ssNoiseGate(buf, thrDb){ if(thrDb<=-100) return; const thr=_db2gain(thrDb); const win=Math.floor(buf.sampleRate*0.02);
  for(var c=0;c<buf.numberOfChannels;c++){ var d=buf.getChannelData(c);
    for(var i=0;i<d.length;i+=win){ var peak=0; for(var j=i;j<i+win&&j<d.length;j++) peak=Math.max(peak,Math.abs(d[j]));
      if(peak<thr){ for(var k=i;k<i+win&&k<d.length;k++) d[k]*=0.06; } } } }
function ssNormalize(buf){ var peak=0; for(var c=0;c<buf.numberOfChannels;c++){ var d=buf.getChannelData(c); for(var i=0;i<d.length;i++) peak=Math.max(peak,Math.abs(d[i])); }
  if(peak>0.0001){ var g=0.98/peak; for(var c2=0;c2<buf.numberOfChannels;c2++){ var d2=buf.getChannelData(c2); for(var i2=0;i2<d2.length;i2++) d2[i2]*=g; } } }
function ssBufferToWav(buf){
  var ch=buf.numberOfChannels, len=buf.length, rate=buf.sampleRate, bytes=len*ch*2, total=44+bytes;
  var ab=new ArrayBuffer(total), v=new DataView(ab), off=0;
  function s(str){ for(var i=0;i<str.length;i++) v.setUint8(off++, str.charCodeAt(i)); }
  function u32(x){ v.setUint32(off,x,true); off+=4; } function u16(x){ v.setUint16(off,x,true); off+=2; }
  s('RIFF'); u32(36+bytes); s('WAVE'); s('fmt '); u32(16); u16(1); u16(ch); u32(rate); u32(rate*ch*2); u16(ch*2); u16(16); s('data'); u32(bytes);
  var chans=[]; for(var c=0;c<ch;c++) chans.push(buf.getChannelData(c));
  for(var i=0;i<len;i++){ for(var c2=0;c2<ch;c2++){ var x=Math.max(-1,Math.min(1,chans[c2][i])); v.setInt16(off, x<0?x*0x8000:x*0x7FFF, true); off+=2; } }
  var b64=''; var arr=new Uint8Array(ab); var CH=0x8000; for(var p=0;p<arr.length;p+=CH){ b64+=String.fromCharCode.apply(null, arr.subarray(p,p+CH)); }
  return 'data:audio/wav;base64,'+btoa(b64);
}
