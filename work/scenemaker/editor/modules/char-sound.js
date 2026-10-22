/* ============================================================================
   Scenemaker editor; per-character typing sound  (features #9, #3)
   The Characters-panel control for a character's typing "boop": on/off, waveform
   (incl. "noise" for alien static), pitch, volume, chirp (pitch slide) and detune
   (second voice); each a slider PLUS a numeric box you can type into. ▶ preview
   synthesizes a sample (mirrors player/typesound.js). Shared scope.
   ==========================================================================*/
const TYPE_WAVES = ['square','sine','triangle','sawtooth','noise'];

// #6: a real report ("what are 'chirp' and 'detune'?") - these two in
// particular have no obvious everyday meaning outside sound synthesis, and
// the row's own text hint (below, in charSoundHtml) only explains them once
// you've already scrolled past the sliders themselves. Hovering the actual
// control (its label or its slider) now explains it right there too.
const TS_FIELD_TITLES = {
  pitch:  'Base pitch of the typing blip; higher = a higher-pitched beep',
  volume: 'How loud the typing blip is',
  chirp:  'Pitch slide on each blip; 0 = a flat beep, higher = more of a rising/falling "chirp" sound',
  detune: 'Adds a second, slightly-off-pitch voice to each blip for an "alien"/robotic doubled sound; 0 = off'
};
function tsSlider(i,field,val,min,max){
  const t=TS_FIELD_TITLES[field]||'';
  return `<span class="opt-num-wrap" title="${t}"><span class="opt-lbl">${field}</span>`
    +`<input type="range" min="${min}" max="${max}" value="${val}" title="${t}" oninput="syncPair(this);setCharSound(${i},'${field}',this.value)" style="width:96px">`
    +`<input type="number" class="opt-num" min="${min}" max="${max}" value="${val}" oninput="syncPair(this)" onchange="setCharSound(${i},'${field}',this.value)"></span>`;
}
function charSoundHtml(i,c){
  const ts=c.typeSound||{enabled:false,wave:'square',pitch:6,volume:5,chirp:0,detune:0};
  if(!ts.enabled){
    return `<div class="opt-row" style="margin-left:30px">
      <label class="chk" style="margin:0"><input type="checkbox" onchange="setCharSound(${i},'enabled',this.checked)"> typing sound</label></div>`;
  }
  return `<div class="opt-group" style="margin-left:30px">
    <div class="opt-row">
      <label class="chk" style="margin:0"><input type="checkbox" checked onchange="setCharSound(${i},'enabled',this.checked)"> typing sound</label>
      <span class="opt-lbl">tone</span><select class="mini-sel" onchange="setCharSound(${i},'wave',this.value)">${TYPE_WAVES.map(w=>`<option value="${w}" ${ts.wave===w?'selected':''}>${w}</option>`).join('')}</select>
      <button class="mini-btn" onclick="previewCharSound(${i})">▶ preview</button>
    </div>
    <div class="opt-row">${tsSlider(i,'pitch',ts.pitch||6,1,10)}${tsSlider(i,'volume',ts.volume!=null?ts.volume:5,1,10)}</div>
    <div class="opt-row">${tsSlider(i,'chirp',ts.chirp||0,0,10)}${tsSlider(i,'detune',ts.detune||0,0,10)}
      <span class="hint" style="margin:0 0 0 6px">chirp = pitch slide · detune = alien second voice</span></div>
  </div>`;
}
function setCharSound(i,f,v){
  const c=project.characters[i]; if(!c.typeSound) c.typeSound={enabled:false,wave:'square',pitch:6,volume:5,chirp:0,detune:0};
  c.typeSound[f] = (f==='enabled') ? !!v : (f==='wave' ? v : Math.max(0,Math.min(10,parseInt(v,10)||0)));
  if(f==='enabled'||f==='wave') renderCharList();
}

/* Editor preview; a short run of blips using the current settings (mirrors player). */
let _twPreviewCtx=null;
function previewCharSound(i){
  const ts=(project.characters[i]||{}).typeSound||{};
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC){ toast('This browser has no Web Audio support'); return; }
  if(!_twPreviewCtx){ try{ _twPreviewCtx=new AC(); }catch(e){ return; } }
  const a=_twPreviewCtx; if(a.state==='suspended'&&a.resume) a.resume();
  const freq=140+(Number(ts.pitch)||6)*70, vol=Math.max(0,Math.min(1,(Number(ts.volume)||5)/10))*0.14;
  const chirp=Number(ts.chirp)||0, detune=Number(ts.detune)||0, wave=ts.wave||'square';
  for(let k=0;k<8;k++){ (function(off){ try{
    const t=a.currentTime+off, dur=0.06;
    const g=a.createGain(); g.connect(a.destination);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    if(wave==='noise'){ const n=Math.floor(a.sampleRate*dur), buf=a.createBuffer(1,n,a.sampleRate), d=buf.getChannelData(0);
      for(let j=0;j<n;j++) d[j]=Math.random()*2-1; const src=a.createBufferSource(); src.buffer=buf; src.connect(g); src.start(t); src.stop(t+dur); return; }
    const mk=det=>{ const o=a.createOscillator(); o.type=wave; o.frequency.setValueAtTime(freq,t);
      if(chirp) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*(1-chirp*0.06)),t+dur);
      if(det) o.detune.value=det; o.connect(g); o.start(t); o.stop(t+dur); };
    mk(0); if(detune) mk(detune*14);
  }catch(e){} })(k*0.075); }
}
