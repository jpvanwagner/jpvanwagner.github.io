/* ============================================================================
   Scenemaker editor; per-line voice recording  (#93)
   A dedicated one-click mic button on each dialogue line, for quickly
   recording (or dragging in) that line's own spoken voice-over - distinct
   from the line's sound effects (line-sfx.js, which can hold several,
   triggered on a delay or a word) and lighter-weight than routing every
   line through the full Sound Studio FX chain for something this quick.
   Reuses Sound Studio's own record -> decode -> WAV pipeline (ssBufferToWav,
   sound-studio.js) so a recorded clip ends up the same consistent format
   either way, just without the filter chain - a quick take, not a mix.
   Shares core.js scope.
   ==========================================================================*/
let _lvRec=null, _lvChunks=[], _lvStream=null, _lvRecordingFor=null;

function lineVoiceHtml(n,l){
  const v=l.voice||{media:null};
  const recording=_lvRecordingFor===l.id;
  const canRecord=!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  return `<div class="opt-group">
    <div class="opt-row"><span class="opt-lbl">Voice</span>
      <span class="sfx-drop" ondragover="assetDragOver(event)" ondragleave="assetDragLeave(event)" ondrop="dropLineVoice(event,'${n.id}','${l.id}')" title="Drop an audio asset here to set this line's own spoken voice clip"><button class="mini-btn" onclick="pickLineVoice('${n.id}','${l.id}')">${v.media?'voice ✓':'+ voice'}</button></span>
      ${canRecord?`<button class="mini-btn${recording?' tb-accent':''}" onclick="toggleLineVoiceRecord('${n.id}','${l.id}')" title="${recording?'Stop recording':'Record this line from the mic'}">${recording?'⏹ stop':'🎙 record'}</button>`:''}
      ${v.media?`<button class="mini-btn" onclick="previewLineVoice('${n.id}','${l.id}')" title="Preview this line's voice clip">▶</button><button class="mini-btn" onclick="openSoundStudioWithAsset('${escAttr(v.media)}')" title="Edit this voice clip in Sound Studio (trim, filter, effects)">✏ edit</button><button class="mini-btn warn" onclick="clearLineVoice('${n.id}','${l.id}')" title="Remove this line's voice clip">×</button>`:''}
    </div>
  </div>`;
}
async function pickLineVoice(nid,lid){ const k=await pickMedia('audio'); if(k){ pushUndo(); const l=scenes[nid].lines.find(x=>x.id===lid); if(!l.voice)l.voice={media:null}; l.voice.media=k; renderScenes(); } }
function clearLineVoice(nid,lid){ pushUndo(); const l=scenes[nid].lines.find(x=>x.id===lid); if(l.voice) l.voice.media=null; renderScenes(); }
function previewLineVoice(nid,lid){ const l=scenes[nid].lines.find(x=>x.id===lid); const url=l && l.voice && mediaURL(l.voice.media); if(!url) return; try{ new Audio(url).play(); }catch(e){} }
function dropLineVoice(e,sid,lid){ assetDrop(e,'audio', k=>{ pushUndo(); const l=scenes[sid].lines.find(x=>x.id===lid); if(!l.voice)l.voice={media:null}; l.voice.media=k; renderScenes(); }); }

/* only one line records at a time; clicking record on a DIFFERENT line while
   one is already going is a no-op with a toast, rather than silently
   stopping the wrong one or starting two overlapping mic captures. */
function toggleLineVoiceRecord(nid,lid){
  if(_lvRec && _lvRec.state==='recording'){
    if(_lvRecordingFor===lid){ _lvRec.stop(); }
    else if(typeof toast==='function'){ toast('Already recording another line; stop that one first'); }
    return;
  }
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){ if(typeof toast==='function') toast('Recording is not supported in this environment.'); return; }
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
    _lvStream=stream; _lvChunks=[]; _lvRecordingFor=lid; renderScenes();
    _lvRec=new MediaRecorder(stream);
    _lvRec.ondataavailable=function(e){ if(e.data && e.data.size) _lvChunks.push(e.data); };
    _lvRec.onstop=function(){
      if(_lvStream){ _lvStream.getTracks().forEach(t=>t.stop()); _lvStream=null; }
      _lvRecordingFor=null;
      const blob=new Blob(_lvChunks, {type:_lvChunks[0]?_lvChunks[0].type:'audio/webm'});
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC){ renderScenes(); if(typeof toast==='function') toast('Could not process the recording.'); return; }
      blob.arrayBuffer().then(function(ab){
        const ac=new AC();
        ac.decodeAudioData(ab, function(buf){
          const wav=ssBufferToWav(buf); const key=makeKey('voice.wav');
          project.media[key]=wav;
          const l=scenes[nid] && scenes[nid].lines.find(x=>x.id===lid);
          if(l){ pushUndo(); if(!l.voice)l.voice={media:null}; l.voice.media=key; }
          renderScenes(); if(typeof toast==='function') toast('Voice recorded ('+buf.duration.toFixed(1)+'s)');
        }, function(){ renderScenes(); if(typeof toast==='function') toast('Could not decode the recording.'); });
      });
    };
    _lvRec.start();
  }).catch(function(){ _lvRecordingFor=null; renderScenes(); if(typeof toast==='function') toast('Microphone permission denied or unavailable.'); });
}
