/* ============================================================================
   Scenemaker editor; Embeddable HTML export
   A single self-contained HTML fragment with no separate files: dialogue
   text, character names, and player choices (branching, variable effects/
   conditions/routes, dice, ask-input all still work), meant for pasting into
   an LMS's raw-HTML/embed block or anywhere else raw HTML is accepted. Its
   fluid CSS adapts to whatever width/host page it lands in instead of a
   fixed canvas size. Independent, on-by-default toggles decide how much of
   the real project's presentation survives the trip:
     - colorScheme:  the project's screen style/font/border + per-character
                      name colours (see player/theme.js's 5 CSS skins, ported
                      here) instead of a plain system font. A manual "Style"
                      override (LITE_STYLE_CHOICES) can pick a different
                      named skin, or fully custom colours (LITE_CUSTOM_FIELDS/
                      LITE_SKIN_COLORS), independent of the live project.
     - typeSound:    a synthesized typing blip (Web Audio, no bundled file -
                      same approach as player/typesound.js), only audible
                      while animations is also on.
     - cursorSound:  a synthesized blip on choice/button hover or focus (same
                      approach as player/cursorsound.js). Split from typeSound
                      (a real report asked to control specific sounds
                      separately) rather than one combined "sounds" toggle.
     - externalAudio: a scene's audio when it streams live from an external
                      URL (scene.music.source==='url' - see core.js's
                      setMusicSource/setMusicUrl) rather than an uploaded
                      asset; the one media type this export can carry at all.
     - showMuteBtn:  a small corner button letting the PLAYER silence typing/
                      hover blips and streamed audio at runtime, independent
                      of the 3 build-time toggles above - only actually
                      emitted when at least one of them is also on, so it
                      never shows up with nothing to mute.
     - animations:   lines reveal one at a time with a typewriter effect and
                      scenes crossfade, instead of dumping every line at once.
     - textSpeed:    1 (slow) .. 10 (fast), same scale/formula as the real
                      player's own Settings -> Text speed (LITE_RUNTIME_JS's
                      delayFor()); only matters while animations is on.
                      Defaults from the project's own project.settings.text.
   All boolean toggles off together reproduces the export's original plain,
   instant, silent baseline. Shares core.js/export-modal.js scope; reuses
   _speakerNameForLine/_resolveCastFace from export-modal.js to bake plain
   character names (and, when colorScheme is on, their colour) in at export
   time - no cast/character data ships in the file itself.
   ==========================================================================*/

// Bracket markup ([kw=...]...[/kw] etc.) is stripped once here, at export
// time, the same way exportGameScript() already does for its plain-text
// script - it's purely cosmetic keyphrase styling, never present in
// {token}/{{variable}} substitution, which the runtime still performs live
// (see LITE_RUNTIME_JS's subst()) since it can depend on play-time state.
function _liteStripMarkup(t){ return String(t==null?'':t).replace(/\[[^\]]*\]/g,''); }

// #celebrations: the only scene/choice effect cues (see scene-fx-cues.js's
// FX_CUE_EFFECTS, shared with the full player) this lightweight export ever
// ships or plays - a deliberate subset, not the full flash/shake/glitch
// palette, so a project that leans on those elsewhere doesn't balloon this
// self-contained export with animation code nobody asked to embed here.
// Confetti/fireworks/big-check/big-X are exactly the "celebration/bad-
// choice" effects a direct owner request asked for.
const LITE_FX_TYPES = ['confetti','fireworks','goodcheck','badx'];

function _liteSpeakerColor(s,l){
  if(l.speaker) return null; // a manually-typed speaker name has no character record to colour
  if(l.speakingCast && s.cast){
    const entry=s.cast.find(x=>x.id===l.speakingCast);
    if(entry){ const face=(typeof _resolveCastFace==='function')?_resolveCastFace(entry):entry; return face.color||null; }
  }
  return null;
}

function _liteBuildData(opts){
  const start = project.settings.startScene || Object.keys(scenes)[0] || null;
  const variables = (project.variables||[]).map(v=>({ id:v.id, name:v.name, type:v.type, initial:v.initial }));
  const scenesOut = {};
  Object.values(scenes).forEach(s=>{
    const mu = s.music||{};
    const sceneOut = {
      lines: (s.lines||[]).map(l=>{
        const line = { speaker: (typeof _speakerNameForLine==='function' ? _speakerNameForLine(s,l) : (l.speaker||'')) || '', text: _liteStripMarkup(l.text) };
        if(opts.colorScheme){ const col=_liteSpeakerColor(s,l); if(col) line.speakerColor=col; }
        if(l.unattributed) line.unattributed=true; // #168: narrator/off-screen text, no speaker name
        return line;
      }),
      musicUrl: (opts.externalAudio && mu.source==='url' && mu.url) ? mu.url : null,
      musicLoop: mu.loop!==false,
      musicVolume: (mu.volume!=null ? mu.volume : 0.6),
      musicStop: !!mu.stop,
      choices: (s.choices||[]).map(c=>{
        const choiceOut = {
          text: _liteStripMarkup(c.text||''),
          isContinue: !!c.continue,
          effects: (c.effects||[]).map(e=>({ var:e.var, op:e.op, value:e.value })),
          condition: c.condition ? { var:c.condition.var, cmp:c.condition.cmp, value:c.condition.value, hide:c.condition.hide } : null,
          dice: (c.dice && c.dice.enabled) ? { sides:c.dice.sides||20, count:c.dice.count||1, target:c.dice.target||10, modVar:c.dice.modVar||null } : null,
          routes: (c.routes||[]).map(r=>({ var:r.var, cmp:r.cmp, value:r.value, target:r.target })),
          outcomes: (c.outcomes||[]).map(o=>({ type:o.type, targetNode:o.targetNode })),
          askInput: c.askInput ? { var:c.askInput.var, label:c.askInput.label||'' } : null
        };
        // #celebrations: only when the toggle is on, and only one of the 4
        // effects this export actually knows how to play (LITE_FX_TYPES) -
        // a choice's pickFx set to some other cue effect (e.g. 'shake')
        // simply ships nothing here, the same silent-drop treatment every
        // other unsupported media type already gets in this export.
        if(opts.celebrations && c.pickFx && c.pickFx.effect && LITE_FX_TYPES.indexOf(c.pickFx.effect)>=0){
          choiceOut.pickFx = { effect:c.pickFx.effect, intensity:c.pickFx.intensity||5 };
        }
        return choiceOut;
      })
    };
    if(opts.celebrations){
      const cues = (s.cues||[]).filter(c=>c && c.effect && LITE_FX_TYPES.indexOf(c.effect)>=0)
        .map(c=>({ on:c.on, effect:c.effect, intensity:c.intensity||5 }));
      if(cues.length) sceneOut.cues = cues;
    }
    // #share: a scene's own title (e.g. "Ending: Resolved") is only ever
    // needed by the share-at-ending prompt, so it's left out of every other
    // export the same way every other not-actually-used-here field already
    // is - kept small on purpose.
    if(opts.shareEnding) sceneOut.title = _liteStripMarkup(s.title||'');
    scenesOut[s.id] = sceneOut;
  });
  // #3: a plain, text-only stand-in for the real project's title screen -
  // just its heading/subheading/start-button label, honouring the SAME
  // project.title.enabled flag the real player checks (TITLE.enabled in
  // player/runtime.js), so an untouched project (title screen never turned
  // on) emits nothing here and plays exactly as before. Background image/
  // video/music never ship, matching every other media type this export
  // already omits.
  const pt = project.title || {};
  const titleScreen = pt.enabled ? {
    enabled: true,
    heading: _liteStripMarkup(pt.heading||''),
    subheading: _liteStripMarkup(pt.subheading||''),
    startLabel: pt.startLabel || 'Start',
    returnOnEnd: !!pt.returnOnEnd
  } : null;
  // #share: the full player's share prompt reuses project.meta/settings.share
  // directly since it has the whole project object; this export only ever
  // gets the small DATA payload, so the pieces it actually needs (whether
  // it's on, the message template, and the link to share) are pulled out
  // here, once, instead of shipping all of meta/settings for one feature.
  const shr = (project.settings && project.settings.share) || {};
  const share = (opts.shareEnding && shr.enabled) ? {
    message: shr.message || 'I got the “{ending}” ending in {title}!',
    website: (project.meta && project.meta.website) || ''
  } : null;
  return {
    title:(project.meta&&project.meta.title)||'Story', start, variables, scenes:scenesOut, titleScreen, share,
    // typeSound/cursorSound (was one combined "sounds" toggle - a real
    // report asked to turn specific sounds on/off separately) and
    // textSpeed (1..10, same scale as the real player's own Settings ->
    // Text speed - see player/typewriter.js's delayFor()) baked in at
    // export time from the modal's own controls.
    options: { typeSound:!!opts.typeSound, cursorSound:!!opts.cursorSound, animations:!!opts.animations, textSpeed:Number(opts.textSpeed)||5, showLog:!!opts.showLog, celebrations:!!opts.celebrations,
      // #mute: only actually emitted when there's some sound to mute in the
      // first place (typing/hover blips, or a streamed scene track) - a mute
      // button that mutes nothing would just be clutter, the same "no-op
      // when nothing here applies" rule every other toggle already follows.
      showMuteBtn: !!opts.showMuteBtn && (!!opts.typeSound || !!opts.cursorSound || !!opts.externalAudio) }
  };
}

const LITE_BASE_CSS = ':root{--lv-ink:#1a1a1a;--lv-bg:#fff;--lv-mut:#666;--lv-line:#d9dce2;--lv-accent:#3b5bfd;--lv-hover:#eef0f5}'
  + '@media (prefers-color-scheme:dark){:root{--lv-ink:#e8e8ec;--lv-bg:#15161c;--lv-mut:#9a9ca6;--lv-line:#33353f;--lv-hover:#20222b}}'
  // position:relative anchors the Log button/overlay and the celebration fx
  // layer (both position:absolute) to the embed's own box, so they stay
  // confined to this card instead of the browser's full viewport - the
  // whole point of a "fluid, drops into whatever width it's given" embed.
  + '.lv-root{position:relative;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px;box-sizing:border-box;color:var(--lv-ink);background:var(--lv-bg)}'
  + '.lv-root *{box-sizing:border-box}'
  // A real report: the dialogue area kept resizing as different lines/
  // scenes played, most jarring while a line was still typing out. #lv-stage
  // wraps #lv-line/#lv-choices and gets a JS-computed min-height (the tallest
  // any single line, or any full scene+choices, will ever need across the
  // whole project - see computeStageMinHeight() in LITE_RUNTIME_JS), with
  // shorter content centered inside it instead of the box itself resizing.
  // The fixed 3.2em on #lv-line is just a same-frame fallback for the rare
  // case that measurement can't run (e.g. zero-width host) or yields 0.
  + '.lv-stage{display:flex;flex-direction:column;justify-content:center}'
  + '#lv-line{min-height:3.2em}'
  + '.lv-speaker{font-weight:700;margin-bottom:4px;display:inline-block}'
  + '.lv-text{white-space:pre-wrap;margin:0 0 16px}'
  + '.lv-text.lv-narrator{font-style:italic;color:var(--lv-mut)}'
  + '.lv-hint{margin-top:6px;color:var(--lv-mut);font-size:13px;font-style:italic}'
  + '.lv-choices{display:flex;flex-direction:column;gap:8px;margin-top:4px}'
  + '.lv-choice{font:inherit;padding:10px 14px;border:1px solid var(--lv-line);border-radius:8px;background:transparent;color:inherit;cursor:pointer;text-align:left}'
  + '.lv-choice:hover:not(:disabled){background:var(--lv-hover)}'
  + '.lv-choice:disabled{opacity:.45;cursor:not-allowed}'
  + '.lv-input{font:inherit;padding:8px 10px;border:1px solid var(--lv-line);border-radius:6px;background:transparent;color:inherit;width:100%;margin-bottom:8px}'
  + '.lv-end{font-style:italic;color:var(--lv-mut);margin:8px 0 16px}'
  + '.lv-share{margin-top:10px;padding-top:10px;border-top:1px solid var(--lv-line)}'
  + '.lv-share .lv-hint{margin:0 0 6px}'
  + '.lv-share-row{display:flex;flex-wrap:wrap;gap:8px}'
  + '.lv-share-btn{font:inherit;font-size:13px;padding:7px 12px;border-radius:7px;border:1px solid var(--lv-line);background:transparent;color:inherit;cursor:pointer}'
  + '.lv-share-btn:hover{background:var(--lv-hover)}'
  + '.lv-fade{transition:opacity .18s ease}'
  + '.lv-fade.lv-out{opacity:0}'
  // Log button/overlay (backlog, "just in case a line got skipped" - only
  // emitted when the showLog toggle is on): a small corner button opens a
  // scrollable card listing everything said and chosen so far, the same
  // shape the full player's own Backlog HUD button already uses.
  + '.lv-log-btn{position:absolute;top:8px;right:8px;font:12px system-ui;padding:4px 10px;border:1px solid var(--lv-line);border-radius:6px;background:var(--lv-bg);color:var(--lv-ink);cursor:pointer;opacity:.8}'
  + '.lv-log-btn:hover{opacity:1;background:var(--lv-hover)}'
  // Mute button sits in the OPPOSITE corner from Log so the two never
  // collide when both toggles are on at once.
  + '.lv-mute-btn{position:absolute;top:8px;left:8px;font:12px system-ui;padding:4px 10px;border:1px solid var(--lv-line);border-radius:6px;background:var(--lv-bg);color:var(--lv-ink);cursor:pointer;opacity:.8}'
  + '.lv-mute-btn:hover{opacity:1;background:var(--lv-hover)}'
  + '.lv-log-overlay{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:5;border-radius:inherit}'
  + '.lv-log-card{background:var(--lv-bg);color:var(--lv-ink);border-radius:8px;max-width:100%;width:360px;max-height:80%;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,.35)}'
  + '.lv-log-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--lv-line);font-weight:700}'
  + '.lv-log-close{background:none;border:none;color:inherit;font-size:16px;cursor:pointer;line-height:1;padding:0}'
  + '.lv-log-body{overflow-y:auto;padding:10px 14px}'
  + '.lv-log-line{margin:0 0 8px;font-size:14px}'
  + '.lv-log-spk{font-weight:700}'
  + '.lv-log-choice{color:var(--lv-accent)}'
  // Celebration / bad-choice fx layer (only emitted when the celebrations
  // toggle is on): confetti/fireworks paint on a canvas filling the embed's
  // own box; the big check/X pop in centered over it. Both overflow:hidden
  // so nothing spills past the card's own edges into the host page.
  + '.lv-fx-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3;border-radius:inherit}'
  + '.lv-fx-layer canvas{width:100%;height:100%;display:block}'
  + '.lv-fx-bigicon{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:3}'
  + '@keyframes lvBigIconPop{0%{opacity:0;transform:scale(.3)}14%{opacity:1;transform:scale(1.1)}26%{transform:scale(.96)}34%{transform:scale(1)}76%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}'
  + '.lv-fx-bigicon svg{width:96px;height:96px;max-width:40%;filter:drop-shadow(0 4px 14px rgba(0,0,0,.4));animation:lvBigIconPop 1.1s ease}'
  // Title screen (#3, only emitted at all when the project has one enabled):
  // a plain, text-only stand-in for the real player's own image/video/music
  // title card - just a heading, an optional subheading, and the project's
  // own configured start-button label (project.title.startLabel).
  + '.lv-title{text-align:center;padding:24px 0}'
  + '.lv-title-h{margin:0 0 8px;font-size:1.5em;font-weight:700}'
  + '.lv-title-sub{margin:0 0 18px;color:var(--lv-mut)}'
  // .lv-choice's own text-align:left (right, for a multi-line list of real
  // choices) leaves a single title-screen Start button's label hugging the
  // button's left edge instead of sitting centred in it, once min-width
  // makes the button wider than the word itself - a real report ("extra
  // space on the left-hand side of the Start button"). Centred text on a
  // narrower auto-width button (a min just for a comfortable tap target,
  // not a fixed wide box) fixes it.
  + '.lv-title-start{display:inline-block;min-width:96px;text-align:center}'
  + '@media (max-width:420px){.lv-root{padding:10px;font-size:15px}}';

// The 5 named screen "skins" a project can pick in Settings -> Screen &
// frame, PLUS the unstyled default ('plain', sc.style's own fallback value -
// see project-settings.js's `sc.style||'plain'`) are pure CSS
// (player/index_template.html's #vn-box/.sk-* rules; no images), so they
// port over directly - #vn-box/#vn-speaker/#vn-text/.vn-choice become
// .lv-root/.lv-speaker/.lv-text/.lv-choice. Kept spec-identical to those
// rules on purpose; update both places together if a skin's colours change.
// 'plain' was missing entirely until a real report: since it's what any
// project that's never touched the Screen style picker actually uses, the
// "keep the look and feel" toggle had visibly NO EFFECT for that (likely
// most common) case - there was simply no CSS branch for it, so toggling
// colorScheme on/off never changed anything to look at. #vn-box's own
// default colours (--box-bg/--accent/--btn/--btn-h) are fixed constants,
// never per-project customized (grep confirms no code ever overrides them),
// so this can be ported as a plain literal skin exactly like the other 5.
// Each skin's `.lv-text` selector also covers `.lv-title-h` (the title
// screen's heading, #3) so a themed export's title card matches its story
// text instead of falling back to the unstyled default ink colour.
const LITE_SKIN_CSS = {
  plain: '.lv-root{background:rgba(9,12,20,.86);border-radius:8px}'
    + '.lv-speaker{background:#e879f9;color:#1a032b}'
    + '.lv-text,.lv-title-h{color:#f1f5f9}'
    + '.lv-choice{background:#1e293b;border:1px solid #475569;color:#f1f5f9}'
    + '.lv-choice:hover:not(:disabled){background:#334155}',
  jrpg: '.lv-root{background:linear-gradient(180deg,#0b1e6b 0%,#071246 100%);border:4px solid #eef2ff;border-radius:10px}'
    + '.lv-speaker{background:#eef2ff;color:#0b1e6b;padding:2px 10px;border-radius:6px}'
    + '.lv-text,.lv-title-h{color:#fff;text-shadow:1px 1px 0 #000}'
    + '.lv-choice{background:linear-gradient(180deg,#12297f,#0a1a58);border:2px solid #cdd7ff;color:#fff}',
  terminal: '.lv-root{background:#020a02;border:2px solid #22c55e;border-radius:0;box-shadow:0 0 24px #16a34a55 inset}'
    + '.lv-speaker{background:#052e05;color:#4ade80;font-family:"VT323","Courier New",monospace;letter-spacing:2px;padding:2px 10px}'
    + '.lv-text,.lv-title-h{color:#4ade80;font-family:"VT323","Courier New",monospace;text-shadow:0 0 6px #22c55e88}'
    + '.lv-choice{background:#020a02;border:1px solid #22c55e;color:#4ade80;font-family:"VT323","Courier New",monospace}'
    + '.lv-choice:hover:not(:disabled){background:#052e05}',
  parchment: '.lv-root{background:linear-gradient(180deg,#f4e4c1,#e7d3a8);border:3px solid #7c5a2e;border-radius:6px}'
    + '.lv-speaker{background:#7c5a2e;color:#f4e4c1;font-family:Georgia,serif;padding:2px 10px;border-radius:4px}'
    + '.lv-text,.lv-title-h{color:#3a2a12;font-family:Georgia,"Times New Roman",serif}'
    + '.lv-choice{background:#efdcb4;border:2px solid #7c5a2e;color:#3a2a12;font-family:Georgia,serif}'
    + '.lv-choice:hover:not(:disabled){background:#e2c793}',
  comic: '.lv-root{background:#fffbe8;border:4px solid #111;border-radius:14px;box-shadow:6px 6px 0 #111}'
    + '.lv-speaker{background:#ffe14d;color:#111;border:3px solid #111;border-radius:8px;padding:2px 10px}'
    + '.lv-text,.lv-title-h{color:#111;font-family:"Comic Sans MS","Trebuchet MS",sans-serif;font-weight:700}'
    + '.lv-choice{background:#8ad3ff;border:3px solid #111;color:#111;font-weight:800;box-shadow:3px 3px 0 #111}'
    + '.lv-choice:hover:not(:disabled){background:#5ec0ff}',
  neon: '.lv-root{background:linear-gradient(180deg,#1a0330 0%,#0b0118 100%);border:2px solid #ec4899;border-radius:8px;box-shadow:0 0 22px #ec489988}'
    + '.lv-speaker{background:#22d3ee;color:#0b0118;box-shadow:0 0 14px #22d3eeaa;padding:2px 10px;border-radius:6px}'
    + '.lv-text,.lv-title-h{color:#f5d0fe;text-shadow:0 0 8px #ec4899aa}'
    + '.lv-choice{background:linear-gradient(180deg,#2a0845,#170229);border:1px solid #22d3ee;color:#f5d0fe;box-shadow:0 0 12px #22d3ee55}'
    + '.lv-choice:hover:not(:disabled){border-color:#ec4899;box-shadow:0 0 16px #ec489988}'
};
const LITE_FONTS = { system:'system-ui,-apple-system,sans-serif', serif:'Georgia,"Times New Roman",serif',
  mono:'"Courier New",monospace', rounded:'"Trebuchet MS","Segoe UI",sans-serif',
  comic:'"Comic Sans MS","Comic Sans",cursive', pixel:'"Press Start 2P",monospace',
  terminal:'"VT323","Courier New",monospace' };

// #4: manual colour override. The export modal's "Custom colors..." style
// exposes these exact fields (with these exact starting values, the same
// ones the 'plain' skin above uses) as editable colour pickers, so picking
// "Custom colors..." with nothing changed reproduces 'plain' exactly - the
// defaults are genuinely visible/editable, not hidden behind the skin CSS.
const LITE_CUSTOM_DEFAULTS = {
  bg:'#0b0e17', text:'#f1f5f9', speakerBg:'#e879f9', speakerText:'#1a032b',
  choiceBg:'#1e293b', choiceBorder:'#475569', choiceText:'#f1f5f9', choiceHover:'#334155'
};
// #187: a real report asked the custom-colour starting point to "depict
// what's actually used" - one plain solid-colour approximation of each
// named skin above (gradients collapse to their dominant/first stop,
// text-shadow/box-shadow/border-width/font drop out entirely, since none
// of those fit the simple 8-swatch model) so switching the Style dropdown
// to a named skin and THEN to "Custom colors..." starts from real,
// recognisable colours instead of always the 'plain' defaults regardless
// of what was just picked. Kept next to LITE_SKIN_CSS on purpose so the two
// are easy to keep in sync by eye if a skin's real colours ever change;
// this is a convenience starting point, not the skin's authoritative
// definition (LITE_SKIN_CSS, used verbatim whenever colorScheme is on and
// the Style isn't 'custom', is untouched by this).
const LITE_SKIN_COLORS = {
  plain: LITE_CUSTOM_DEFAULTS,
  jrpg: { bg:'#0b1e6b', text:'#ffffff', speakerBg:'#eef2ff', speakerText:'#0b1e6b',
    choiceBg:'#12297f', choiceBorder:'#cdd7ff', choiceText:'#ffffff', choiceHover:'#1c3499' },
  terminal: { bg:'#020a02', text:'#4ade80', speakerBg:'#052e05', speakerText:'#4ade80',
    choiceBg:'#020a02', choiceBorder:'#22c55e', choiceText:'#4ade80', choiceHover:'#052e05' },
  parchment: { bg:'#f4e4c1', text:'#3a2a12', speakerBg:'#7c5a2e', speakerText:'#f4e4c1',
    choiceBg:'#efdcb4', choiceBorder:'#7c5a2e', choiceText:'#3a2a12', choiceHover:'#e2c793' },
  comic: { bg:'#fffbe8', text:'#111111', speakerBg:'#ffe14d', speakerText:'#111111',
    choiceBg:'#8ad3ff', choiceBorder:'#111111', choiceText:'#111111', choiceHover:'#5ec0ff' },
  neon: { bg:'#1a0330', text:'#f5d0fe', speakerBg:'#22d3ee', speakerText:'#0b0118',
    choiceBg:'#2a0845', choiceBorder:'#22d3ee', choiceText:'#f5d0fe', choiceHover:'#3a0f5c' }
};
function _liteCustomCss(colors){
  const d = Object.assign({}, LITE_CUSTOM_DEFAULTS, colors||{});
  return '.lv-root{background:'+d.bg+';border-radius:8px}'
    + '.lv-speaker{background:'+d.speakerBg+';color:'+d.speakerText+'}'
    + '.lv-text,.lv-title-h{color:'+d.text+'}'
    + '.lv-choice{background:'+d.choiceBg+';border:1px solid '+d.choiceBorder+';color:'+d.choiceText+'}'
    + '.lv-choice:hover:not(:disabled){background:'+d.choiceHover+'}';
}

function _liteBuildCss(opts){
  let css = LITE_BASE_CSS;
  if(!opts.colorScheme) return css;
  const sc = (project.settings && project.settings.screen) || {};
  // styleOverride (#4): the export modal's manual "Style" picker. Empty/
  // unset means "match the project's own Screen style" (the original,
  // automatic behaviour); any other value (a named skin, or 'custom')
  // overrides it, letting the export look different from the live project
  // on purpose - e.g. picking a punchier skin just for this one embed.
  if(opts.styleOverride==='custom'){
    css += _liteCustomCss(opts.customColors);
  } else {
    css += LITE_SKIN_CSS[_liteResolveStyleKey(opts.styleOverride)];
  }
  if(LITE_FONTS[sc.font]) css += '.lv-root{font-family:'+LITE_FONTS[sc.font]+'}';
  if(sc.border) css += '.lv-root{border-width:'+(sc.width||6)+'px;border-style:solid;border-color:'+(sc.color||'#e5e7eb')+';border-radius:'+(sc.radius||0)+'px}';
  return css;
}

// Runtime shipped inside the exported file; a much smaller, text-only cousin
// of player/runtime.js's chooseChoice/applyEffects/evalCondition/routeTarget
// (kept in exact semantic lockstep with that spec: askInput prompt first,
// then effects, then dice short-circuits, then priority routes, then the
// default outcome). Token substitution uses indexOf/split, not regex, so
// nothing here needs brace-escaping headaches inside this template string.
// DATA.options.sounds/animations (baked in at export time from the toggle
// checkboxes) gate the typing/cursor blips and the typewriter/fade effects;
// both off reproduces the original plain, instant, silent baseline.
const LITE_RUNTIME_JS = "(function(){\n"
  + "var DATA = window.SCENEMAKER_LITE_DATA;\n"
  + "var OPT = DATA.options||{};\n"
  + "var vars = {};\n"
  + "(DATA.variables||[]).forEach(function(d){ vars[d.id] = d.type==='bool' ? !!d.initial : d.type==='text' ? String(d.initial||'') : (Number(d.initial)||0); });\n"
  + "var state = { s: DATA.start, li: 0 };\n"
  + "var log = [], _prevSceneForFx = null;\n"
  + "\n"
  + "/* -- backlog (Log button, showLog) - everything said/chosen so far -- */\n"
  + "function escLog(s){ var d=document.createElement('div'); d.textContent=String(s==null?'':s); return d.innerHTML; }\n"
  + "function logLine(l){ if(!OPT.showLog||!l) return; log.push({kind:'line', speaker:(l.speaker&&!l.unattributed)?subst(l.speaker):'', text:subst(l.text)}); }\n"
  + "function logChoicePicked(c){ if(!OPT.showLog) return; log.push({kind:'choice', text: subst(c.isContinue ? (c.text||'Continue') : c.text)}); }\n"
  + "function renderLog(){\n"
  + "  var body=document.getElementById('lv-log-body'); if(!body) return;\n"
  + "  if(!log.length){ body.innerHTML='<p class=\"lv-hint\">Nothing yet.</p>'; return; }\n"
  + "  body.innerHTML = log.map(function(e){\n"
  + "    if(e.kind==='line') return '<p class=\"lv-log-line\">'+(e.speaker?'<span class=\"lv-log-spk\">'+escLog(e.speaker)+':</span> ':'')+escLog(e.text)+'</p>';\n"
  + "    return '<p class=\"lv-log-line lv-log-choice\">\\u25B6 '+escLog(e.text)+'</p>';\n"
  + "  }).join('');\n"
  + "  body.scrollTop = body.scrollHeight;\n"
  + "}\n"
  + "function openLog(){ renderLog(); var ov=document.getElementById('lv-log-overlay'); if(ov) ov.style.display='flex'; }\n"
  + "function closeLog(){ var ov=document.getElementById('lv-log-overlay'); if(ov) ov.style.display='none'; }\n"
  + "\n"
  + "/* -- celebration / bad-choice effects (confetti, fireworks, big check/X) -- */\n"
  + "var FX_COLORS=['#f43f5e','#fb923c','#facc15','#4ade80','#38bdf8','#a78bfa','#f472b6'];\n"
  + "function fxParticles(kind, ms){\n"
  + "  var host=document.createElement('div'); host.className='lv-fx-layer'; root.appendChild(host);\n"
  + "  var c=document.createElement('canvas'); host.appendChild(c);\n"
  + "  var rect=host.getBoundingClientRect(); var W=c.width=Math.max(2,rect.width), H=c.height=Math.max(2,rect.height);\n"
  + "  var ctx=c.getContext&&c.getContext('2d'); if(!ctx){ if(host.parentNode) host.parentNode.removeChild(host); return; }\n"
  + "  var parts=[], t0=Date.now(), nextBurst=0;\n"
  + "  function spawnConfetti(n){ for(var i=0;i<n;i++) parts.push({x:Math.random()*W, y:-10-Math.random()*H*0.4, vx:(Math.random()-0.5)*2, vy:2+Math.random()*3, rot:Math.random()*6.28, vr:(Math.random()-0.5)*0.3, w:6+Math.random()*4, h:3+Math.random()*3, color:FX_COLORS[Math.floor(Math.random()*FX_COLORS.length)]}); }\n"
  + "  function spawnFirework(){ var cx=W*(0.2+Math.random()*0.6), cy=H*(0.15+Math.random()*0.35), color=FX_COLORS[Math.floor(Math.random()*FX_COLORS.length)], n=26+Math.floor(Math.random()*12);\n"
  + "    for(var i=0;i<n;i++){ var ang=(i/n)*6.28, spd=2+Math.random()*3; parts.push({x:cx, y:cy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, r:2+Math.random()*1.5, color:color, life:0, spark:true}); } }\n"
  + "  if(kind==='confetti') spawnConfetti(80);\n"
  + "  function tick(){\n"
  + "    var elapsed=Date.now()-t0;\n"
  + "    if(kind==='fireworks' && elapsed>=nextBurst && elapsed<ms-300){ spawnFirework(); nextBurst=elapsed+280+Math.random()*260; }\n"
  + "    ctx.clearRect(0,0,W,H);\n"
  + "    for(var i=parts.length-1;i>=0;i--){ var p=parts[i];\n"
  + "      if(p.spark){ p.x+=p.vx; p.vy+=0.04; p.y+=p.vy; p.life++; var a=Math.max(0,1-p.life/40);\n"
  + "        ctx.fillStyle=p.color; ctx.globalAlpha=a; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); ctx.globalAlpha=1;\n"
  + "        if(a<=0) parts.splice(i,1);\n"
  + "      } else { p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.rot+=p.vr;\n"
  + "        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();\n"
  + "        if(p.y>H+20) parts.splice(i,1);\n"
  + "      }\n"
  + "    }\n"
  + "    if(elapsed<ms || parts.length) requestAnimationFrame(tick); else if(host.parentNode) host.parentNode.removeChild(host);\n"
  + "  }\n"
  + "  tick();\n"
  + "}\n"
  + "function fxBigIcon(kind, ms){\n"
  + "  var host=document.createElement('div'); host.className='lv-fx-bigicon';\n"
  + "  host.innerHTML = kind==='goodcheck'\n"
  + "    ? '<svg viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"46\" fill=\"none\" stroke=\"#22c55e\" stroke-width=\"8\"/><path d=\"M28 52 L44 68 L74 34\" fill=\"none\" stroke=\"#22c55e\" stroke-width=\"9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>'\n"
  + "    : '<svg viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"46\" fill=\"none\" stroke=\"#ef4444\" stroke-width=\"8\"/><path d=\"M32 32 L68 68 M68 32 L32 68\" stroke=\"#ef4444\" stroke-width=\"9\" stroke-linecap=\"round\"/></svg>';\n"
  + "  root.appendChild(host);\n"
  + "  setTimeout(function(){ if(host.parentNode) host.parentNode.removeChild(host); }, ms);\n"
  + "}\n"
  + "function fireLiteFx(effect, intensity){\n"
  + "  if(!OPT.celebrations || !effect) return;\n"
  + "  if(effect==='confetti') fxParticles('confetti', 1700);\n"
  + "  else if(effect==='fireworks') fxParticles('fireworks', 2000);\n"
  + "  else if(effect==='goodcheck'||effect==='badx') fxBigIcon(effect, 1150);\n"
  + "}\n"
  + "function fireSceneCues(scene, on){ if(!scene) return; (scene.cues||[]).forEach(function(cue){ if(cue && cue.on===on) fireLiteFx(cue.effect, cue.intensity); }); }\n"
  + "\n"
  + "function typeOf(id){ var d=(DATA.variables||[]).filter(function(x){return x.id===id;})[0]; return d?d.type:'number'; }\n"
  + "function truthy(v){ return v===true||v==='true'||v===1||v==='1'; }\n"
  + "function cmpTyped(t,a,op,b){\n"
  + "  if(t==='bool'){ var ab=!!a, bb=truthy(b); return op==='!=' ? ab!==bb : ab===bb; }\n"
  + "  if(t==='text'){ var as=String(a==null?'':a), bs=String(b==null?'':b); return op==='!=' ? as!==bs : op==='contains' ? as.indexOf(bs)>=0 : as===bs; }\n"
  + "  var an=Number(a)||0, bn=Number(b)||0;\n"
  + "  if(op==='>=') return an>=bn; if(op==='<=') return an<=bn; if(op==='>') return an>bn; if(op==='<') return an<bn; if(op==='!=') return an!==bn; return an===bn;\n"
  + "}\n"
  + "function applyEffects(effects){\n"
  + "  (effects||[]).forEach(function(e){\n"
  + "    if(!e||!e.var) return;\n"
  + "    var t=typeOf(e.var), cur=vars[e.var], nv;\n"
  + "    if(t==='bool') nv = e.op==='toggle' ? !cur : truthy(e.value);\n"
  + "    else if(t==='text') nv = String(e.value==null?'':e.value);\n"
  + "    else { var c=Number(cur||0), v=Number(e.value)||0; nv = e.op==='add'?c+v : e.op==='sub'?c-v : v; }\n"
  + "    vars[e.var]=nv;\n"
  + "  });\n"
  + "}\n"
  + "function evalCondition(c){\n"
  + "  if(!c.condition||!c.condition.var) return {show:true, locked:false};\n"
  + "  var ok = cmpTyped(typeOf(c.condition.var), vars[c.condition.var], c.condition.cmp||'==', c.condition.value);\n"
  + "  if(ok) return {show:true, locked:false};\n"
  + "  return (c.condition.hide==='hidden') ? {show:false, locked:false} : {show:true, locked:true};\n"
  + "}\n"
  + "function routeTarget(c){\n"
  + "  var routes=c.routes||[];\n"
  + "  for(var i=0;i<routes.length;i++){ var r=routes[i]; if(!r.var || cmpTyped(typeOf(r.var), vars[r.var], r.cmp||'==', r.value)) return r.target||null; }\n"
  + "  return null;\n"
  + "}\n"
  + "function replaceAll(s, find, val){ return s.split(find).join(val); }\n"
  + "function subst(t){\n"
  + "  var now=new Date(), s=String(t==null?'':t);\n"
  + "  s = replaceAll(s, '{title}', DATA.title||'');\n"
  + "  s = replaceAll(s, '{year}', String(now.getFullYear()));\n"
  + "  s = replaceAll(s, '{time}', now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}));\n"
  + "  s = replaceAll(s, '{date}', now.toLocaleDateString());\n"
  + "  s = replaceAll(s, '{weekday}', now.toLocaleDateString(undefined,{weekday:'long'}));\n"
  + "  s = replaceAll(s, '{month}', now.toLocaleDateString(undefined,{month:'long'}));\n"
  + "  s = replaceAll(s, '{day}', String(now.getDate()));\n"
  + "  var out='', i=0;\n"
  + "  while(i < s.length){\n"
  + "    var open = s.indexOf('{{', i);\n"
  + "    if(open < 0){ out += s.slice(i); break; }\n"
  + "    out += s.slice(i, open);\n"
  + "    var close = s.indexOf('}}', open+2);\n"
  + "    if(close < 0){ out += s.slice(open); break; }\n"
  + "    var nm = s.slice(open+2, close).trim();\n"
  + "    var d=(DATA.variables||[]).filter(function(x){ return x.name===nm || x.id===nm; })[0];\n"
  + "    out += d ? String(vars[d.id]!=null?vars[d.id]:'') : '';\n"
  + "    i = close+2;\n"
  + "  }\n"
  + "  return out;\n"
  + "}\n"
  + "\n"
  + "/* -- sounds (no bundled file; same synthesis approach as typesound.js/cursorsound.js) -- */\n"
  + "var actx=null, _muted=false;\n"
  + "function ac(){ if(!actx){ var AC=window.AudioContext||window.webkitAudioContext; if(AC){ try{ actx=new AC(); }catch(e){} } } return actx; }\n"
  + "function playCursorBlip(){\n"
  + "  if(!OPT.cursorSound || _muted) return;\n"
  + "  var a=ac(); if(!a) return;\n"
  + "  if(a.state==='suspended'&&a.resume){ try{ a.resume(); }catch(e){} }\n"
  + "  try{\n"
  + "    var t=a.currentTime, dur=0.07, g=a.createGain(); g.connect(a.destination);\n"
  + "    g.gain.setValueAtTime(0.16,t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);\n"
  + "    var o=a.createOscillator(); o.type='square';\n"
  + "    o.frequency.setValueAtTime(520,t); o.frequency.exponentialRampToValueAtTime(880, t+dur*0.6);\n"
  + "    o.connect(g); o.start(t); o.stop(t+dur);\n"
  + "  }catch(e){}\n"
  + "}\n"
  + "var _lastTypeBlip=0;\n"
  + "function playTypeBlip(){\n"
  + "  if(!OPT.typeSound||!OPT.animations||_muted) return;\n"
  + "  var now=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();\n"
  + "  if(now-_lastTypeBlip<33) return; _lastTypeBlip=now;\n"
  + "  var a=ac(); if(!a) return;\n"
  + "  if(a.state==='suspended'&&a.resume){ try{ a.resume(); }catch(e){} }\n"
  + "  try{\n"
  + "    var t=a.currentTime, dur=0.045, g=a.createGain(); g.connect(a.destination);\n"
  + "    g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);\n"
  + "    var o=a.createOscillator(); o.type='square'; o.frequency.setValueAtTime(440,t);\n"
  + "    o.connect(g); o.start(t); o.stop(t+dur);\n"
  + "  }catch(e){}\n"
  + "}\n"
  + "function wireCursorSound(btn){ if(!btn) return; btn.addEventListener('mouseenter', playCursorBlip); btn.addEventListener('focus', playCursorBlip); }\n"
  + "/* -- mute (showMuteBtn) - a runtime, player-facing override on top of\n"
  + "   the build-time typeSound/cursorSound/externalAudio toggles above;\n"
  + "   session-only (not persisted), matching this export's own single-file,\n"
  + "   no-external-state design. -- */\n"
  + "function setMuted(m){\n"
  + "  _muted=!!m;\n"
  + "  if(audioEl) audioEl.muted=_muted;\n"
  + "  var btn=document.getElementById('lv-mute-btn');\n"
  + "  if(btn){ btn.textContent=_muted?'\\uD83D\\uDD07 Muted':'\\uD83D\\uDD0A Sound'; btn.setAttribute('aria-pressed', _muted?'true':'false'); }\n"
  + "}\n"
  + "function toggleMute(){ setMuted(!_muted); }\n"
  + "\n"
  + "/* -- typewriter reveal (per-line, click/tap to skip or advance) -- */\n"
  // Same 1 (slow) .. 10 (fast) scale and formula as the real player's own
  // Settings -> Text speed (player/typewriter.js's delayFor()), so a
  // project's chosen speed - and the export modal's own slider, defaulted
  // from it - actually means the same thing in both places.
  + "function delayFor(s){ var n=(s!=null)?Number(s):5; return Math.max(6, Math.round(130 - n*12)); }\n"
  + "var typeTimer=null, typeActive=false, typeDone=null, typeEl=null, typeFull=null;\n"
  + "function typeText(el, text, onDone){\n"
  + "  if(!OPT.animations){ el.textContent=text; onDone&&onDone(); return; }\n"
  + "  var units=text.split(''), i=0;\n"
  + "  el.textContent=''; typeActive=true; typeDone=onDone; typeEl=el; typeFull=text;\n"
  + "  clearInterval(typeTimer);\n"
  + "  typeTimer=setInterval(function(){\n"
  + "    i++; el.textContent=units.slice(0,i).join('');\n"
  + "    if(!/^\\s*$/.test(units[i-1]||'')) playTypeBlip();\n"
  + "    if(i>=units.length) finishType();\n"
  + "  }, delayFor(OPT.textSpeed));\n"
  + "}\n"
  + "function finishType(){ if(!typeActive) return; clearInterval(typeTimer); typeTimer=null; typeActive=false; if(typeEl) typeEl.textContent=typeFull; var d=typeDone; typeDone=null; typeEl=null; typeFull=null; d&&d(); }\n"
  + "\n"
  + "/* -- audio (external-URL streamed scene tracks only) -- */\n"
  + "var root, audioEl, stageEl;\n"
  + "function applyMusic(scene){\n"
  + "  if(scene.musicStop){ audioEl.pause(); audioEl.removeAttribute('src'); return; }\n"
  + "  if(!scene.musicUrl) return;\n"
  + "  if(audioEl.getAttribute('data-src')===scene.musicUrl){ return; }\n"
  + "  audioEl.setAttribute('data-src', scene.musicUrl);\n"
  + "  audioEl.src = scene.musicUrl; audioEl.loop = scene.musicLoop!==false; audioEl.volume = scene.musicVolume!=null?scene.musicVolume:0.6; audioEl.muted = _muted;\n"
  + "  var p = audioEl.play(); if(p && p.catch) p.catch(function(){});\n"
  + "}\n"
  + "\n"
  + "function moveTo(id){ state.s = id; state.li = 0; render(true); }\n"
  + "function rollDice(c, after){\n"
  + "  var d=c.dice, sum=0, i;\n"
  + "  for(i=0;i<d.count;i++) sum += 1+Math.floor(Math.random()*d.sides);\n"
  + "  var mod = d.modVar ? Number(vars[d.modVar]||0) : 0;\n"
  + "  var total = sum+mod, success = total>=d.target;\n"
  + "  var outcomes=c.outcomes||[], out=null, j;\n"
  + "  for(j=0;j<outcomes.length;j++){ if(outcomes[j].type===(success?'success':'failure')) out=outcomes[j]; }\n"
  + "  if(!out) out = outcomes[0];\n"
  + "  var box=document.createElement('div'); box.className='lv-end';\n"
  + "  box.textContent = 'Rolled ' + d.count + 'd' + d.sides + (mod?(mod>0?' +':' ')+mod:'') + ' = ' + total + ' vs target ' + d.target + ': ' + (success?'Success!':'Failure.');\n"
  + "  var btn=document.createElement('button'); btn.className='lv-choice'; btn.textContent='Continue \\u25b8'; wireCursorSound(btn);\n"
  + "  btn.onclick=function(){ if(out && out.targetNode) moveTo(out.targetNode); else render(false); };\n"
  + "  after.appendChild(box); after.appendChild(btn);\n"
  + "}\n"
  + "function askInputThen(c, cb){\n"
  + "  var vDef=(DATA.variables||[]).filter(function(x){return x.id===c.askInput.var;})[0];\n"
  + "  var wrap=document.createElement('div');\n"
  + "  var input=document.createElement('input'); input.className='lv-input';\n"
  + "  input.placeholder = subst(c.askInput.label||'');\n"
  + "  if(vDef){ input.value = vars[vDef.id]!=null ? vars[vDef.id] : ''; if(vDef.type==='number') input.type='number'; }\n"
  + "  var btn=document.createElement('button'); btn.className='lv-choice'; btn.textContent='OK'; wireCursorSound(btn);\n"
  + "  var submit=function(){\n"
  + "    if(vDef){ vars[vDef.id] = vDef.type==='number' ? (parseFloat(input.value)||0) : vDef.type==='bool' ? truthy(input.value) : String(input.value); }\n"
  + "    cb();\n"
  + "  };\n"
  + "  input.addEventListener('keydown', function(e){ if(e.key==='Enter') submit(); });\n"
  + "  btn.onclick=submit;\n"
  + "  wrap.appendChild(input); wrap.appendChild(btn);\n"
  + "  var choicesEl=document.getElementById('lv-choices'); choicesEl.innerHTML=''; choicesEl.appendChild(wrap);\n"
  + "}\n"
  + "function chooseChoice(c){\n"
  + "  if(c.askInput && c.askInput.var){ askInputThen(c, function(){ finishChoice(c); }); return; }\n"
  + "  finishChoice(c);\n"
  + "}\n"
  + "function finishChoice(c){\n"
  + "  logChoicePicked(c);\n"
  + "  if(c.pickFx) fireLiteFx(c.pickFx.effect, c.pickFx.intensity);\n"
  + "  applyEffects(c.effects);\n"
  + "  if(c.dice){ var choicesEl=document.getElementById('lv-choices'); choicesEl.innerHTML=''; rollDice(c, choicesEl); return; }\n"
  + "  var rt = routeTarget(c); if(rt){ moveTo(rt); return; }\n"
  + "  var outcomes=c.outcomes||[], o=outcomes[0];\n"
  + "  if(o && o.targetNode){ moveTo(o.targetNode); return; }\n"
  + "  render(false);\n"
  + "}\n"
  // Shared by the real render paths AND computeStageMinHeight()'s offscreen
  // probe pass below, so "how a line looks" is defined in exactly one place.
  + "function buildLineNode(l){\n"
  + "  var frag=document.createDocumentFragment();\n"
  + "  if(l.speaker && !l.unattributed){ var sp=document.createElement('div'); sp.className='lv-speaker'; sp.textContent=subst(l.speaker); if(l.speakerColor) sp.style.color=l.speakerColor; frag.appendChild(sp); }\n"
  + "  var tx=document.createElement('p'); tx.className='lv-text'+(l.unattributed?' lv-narrator':''); tx.textContent=subst(l.text); frag.appendChild(tx);\n"
  + "  return frag;\n"
  + "}\n"
  + "function buildChoicesInto(scene, choicesEl){\n"
  + "  choicesEl.innerHTML='';\n"
  + "  var visible = (scene.choices||[]).map(function(c){ return {c:c, v:evalCondition(c)}; }).filter(function(x){ return x.v.show; });\n"
  + "  if(!visible.length){ var end2=document.createElement('div'); end2.className='lv-end'; end2.textContent='The End'; choicesEl.appendChild(end2); addRestart(choicesEl); if(DATA.titleScreen && DATA.titleScreen.returnOnEnd) addReturnToTitle(choicesEl); buildShareUI(scene, choicesEl); return; }\n"
  + "  visible.forEach(function(x){\n"
  + "    var btn=document.createElement('button'); btn.className='lv-choice';\n"
  + "    btn.textContent = x.c.isContinue ? (subst(x.c.text)||'Continue \\u25b8') : subst(x.c.text);\n"
  + "    if(x.v.locked) btn.disabled=true;\n"
  + "    btn.onclick=function(){ chooseChoice(x.c); };\n"
  + "    wireCursorSound(btn);\n"
  + "    choicesEl.appendChild(btn);\n"
  + "  });\n"
  + "}\n"
  + "function showChoices(scene){\n"
  + "  var choicesEl=document.getElementById('lv-choices');\n"
  + "  buildChoicesInto(scene, choicesEl);\n"
  // choice COUNT is the single biggest driver of height changing between
  // scenes (a real report about pasting into an LMS embed block) - always
  // notify after the choice list settles, not just when animating.
  + "  notifyHeight();\n"
  + "}\n"
  + "function renderLineInstant(scene){\n"
  + "  var lineEl=document.getElementById('lv-line'); lineEl.innerHTML='';\n"
  + "  (scene.lines||[]).forEach(function(l){ lineEl.appendChild(buildLineNode(l)); logLine(l); });\n"
  + "  showChoices(scene);\n"
  + "}\n"
  // A real report: (a) nothing told the reader the dialogue area was
  // clickable to skip the typewriter reveal in progress, or to advance once
  // a line finished typing but more remained; (b) the box kept resizing as
  // shorter/longer lines typed out, most jarring mid-scene. Fixed together:
  // a persistent .lv-hint sits under the line the WHOLE time it's showing
  // (not just after it finishes), reading "click to skip" while typing and
  // "click to continue" once done (mirroring the real player's own .vn-hint
  // wording) for every line except the last, which drops the hint and goes
  // straight to choices instead, no extra click needed there. The box's own
  // size no longer follows any of this - see computeStageMinHeight().
  + "function renderLineAnimated(scene){\n"
  + "  var lineEl=document.getElementById('lv-line'); lineEl.innerHTML='';\n"
  + "  var lines=scene.lines||[]; var l=lines[state.li];\n"
  + "  if(!l){ showChoices(scene); return; }\n"
  + "  logLine(l);\n"
  + "  if(l.speaker && !l.unattributed){ var sp=document.createElement('div'); sp.className='lv-speaker'; sp.textContent=subst(l.speaker); if(l.speakerColor) sp.style.color=l.speakerColor; lineEl.appendChild(sp); }\n"
  + "  var tx=document.createElement('p'); tx.className='lv-text'+(l.unattributed?' lv-narrator':''); lineEl.appendChild(tx);\n"
  + "  var hint=document.createElement('div'); hint.className='lv-hint'; hint.textContent='\\u25b8 click to skip'; lineEl.appendChild(hint);\n"
  + "  var advance=function(e){\n"
  + "    if(e && e.target && e.target.closest && e.target.closest('button,input')) return;\n"
  + "    if(typeActive){ finishType(); return; }\n"
  + "    lineEl.removeEventListener('click', advance);\n"
  + "    state.li++; renderLineAnimated(scene);\n"
  + "  };\n"
  + "  lineEl.addEventListener('click', advance);\n"
  + "  typeText(tx, subst(l.text), function(){\n"
  + "    if(state.li>=lines.length-1){ lineEl.removeEventListener('click', advance); if(hint.parentNode) hint.parentNode.removeChild(hint); showChoices(scene); }\n"
  + "    else { hint.textContent='\\u25b8 click to continue'; notifyHeight(); }\n"
  + "  });\n"
  + "}\n"
  + "function render(animateIn){\n"
  + "  var lineEl=document.getElementById('lv-line'), choicesEl=document.getElementById('lv-choices');\n"
  + "  finishType(); choicesEl.innerHTML='';\n"
  + "  var scene = DATA.scenes[state.s];\n"
  + "  if(_prevSceneForFx!==state.s){ fireSceneCues(DATA.scenes[_prevSceneForFx], 'end'); fireSceneCues(scene, 'start'); _prevSceneForFx=state.s; }\n"
  + "  var doRender=function(){\n"
  + "    if(!scene){ lineEl.innerHTML=''; var end=document.createElement('div'); end.className='lv-end'; end.textContent='The End'; lineEl.appendChild(end); addRestart(choicesEl); if(DATA.titleScreen && DATA.titleScreen.returnOnEnd) addReturnToTitle(choicesEl); buildShareUI(null, choicesEl); if(OPT.animations) fadeIn(); notifyHeight(); return; }\n"
  + "    applyMusic(scene);\n"
  + "    if(OPT.animations) renderLineAnimated(scene); else renderLineInstant(scene);\n"
  + "    if(OPT.animations) fadeIn();\n"
  + "  };\n"
  + "  if(OPT.animations && animateIn && root){\n"
  + "    root.classList.add('lv-fade','lv-out');\n"
  + "    setTimeout(doRender, 180);\n"
  + "  } else doRender();\n"
  + "}\n"
  + "function fadeIn(){ if(!root) return; root.classList.add('lv-fade'); requestAnimationFrame(function(){ root.classList.remove('lv-out'); }); }\n"
  + "function resetVars(){ (DATA.variables||[]).forEach(function(d){ vars[d.id] = d.type==='bool' ? !!d.initial : d.type==='text' ? String(d.initial||'') : (Number(d.initial)||0); }); }\n"
  + "function addRestart(container){\n"
  + "  var btn=document.createElement('button'); btn.className='lv-choice'; btn.style.marginTop='8px'; btn.textContent='\\u21ba Restart'; wireCursorSound(btn);\n"
  + "  btn.onclick=function(){ resetVars(); state.s=DATA.start; state.li=0; render(true); };\n"
  + "  container.appendChild(btn);\n"
  + "}\n"
  // #3: only ever appended when the project's own title screen has
  // returnOnEnd set (project.title.returnOnEnd, defaults true in the
  // editor), mirroring the real player's own "Return to title" ending
  // button (player/runtime.js's TITLE.returnOnEnd branch).
  + "function addReturnToTitle(container){\n"
  + "  var btn=document.createElement('button'); btn.className='lv-choice'; btn.style.marginTop='8px'; btn.textContent='\\u21A9 Return to title'; wireCursorSound(btn);\n"
  + "  btn.onclick=function(){ resetVars(); state.s=DATA.start; state.li=0; if(stageEl) stageEl.style.display='none'; showTitleScreen(); };\n"
  + "  container.appendChild(btn);\n"
  + "}\n"
  // #share: mirrors the full player's buildShareUI(); DATA.share is only
  // ever present when both the project's own setting AND this export's
  // toggle are on (see _liteBuildData() - null otherwise, so this is a
  // single cheap check for every project that hasn't touched the feature).
  + "function buildShareUI(scene, container){\n"
  + "  if(!DATA.share) return;\n"
  + "  var endingTitle=(scene&&scene.title||'').trim(), projectTitle=(DATA.title||'').trim();\n"
  + "  var msg=(DATA.share.message||'I got the \\u201c{ending}\\u201d ending in {title}!')\n"
  + "    .replace(/\\{ending\\}/g, endingTitle||'this').replace(/\\{title\\}/g, projectTitle||'this story');\n"
  + "  var url=(DATA.share.website||'').trim();\n"
  + "  var wrap=document.createElement('div'); wrap.className='lv-share';\n"
  + "  var cap=document.createElement('div'); cap.className='lv-hint'; cap.textContent='Share your ending:'; wrap.appendChild(cap);\n"
  + "  var row=document.createElement('div'); row.className='lv-share-row'; wrap.appendChild(row);\n"
  + "  function addBtn(label, title, onClick){\n"
  + "    var b=document.createElement('button'); b.type='button'; b.className='lv-share-btn'; b.textContent=label; if(title) b.title=title;\n"
  + "    b.onclick=function(){ onClick(b); }; wireCursorSound(b); row.appendChild(b);\n"
  + "  }\n"
  + "  if(navigator.share){\n"
  + "    addBtn('\\u{1F4E4} Share', 'Share your ending', function(){ navigator.share({ title: projectTitle||undefined, text: msg, url: url||undefined }).catch(function(){}); });\n"
  + "  } else {\n"
  + "    addBtn('\\u{1F517} Copy link', 'Copy the share text to your clipboard', function(btn){\n"
  + "      liteShareCopy(url ? (msg+' '+url) : msg, function(ok){\n"
  + "        var was=btn.textContent; btn.textContent = ok ? '\\u2713 Copied!' : '\\u2717 Copy failed';\n"
  + "        setTimeout(function(){ btn.textContent=was; }, 1600);\n"
  + "      });\n"
  + "    });\n"
  + "    addBtn('Share on X', 'Share to X (Twitter)', function(){ window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(msg)+(url?'&url='+encodeURIComponent(url):''), '_blank', 'noopener'); });\n"
  + "    addBtn('Share on Bluesky', 'Share to Bluesky', function(){ window.open('https://bsky.app/intent/compose?text='+encodeURIComponent(msg+(url?' '+url:'')), '_blank', 'noopener'); });\n"
  + "  }\n"
  + "  container.appendChild(wrap);\n"
  + "}\n"
  + "function liteShareCopy(text, cb){\n"
  + "  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){ cb&&cb(true); }, function(){ liteShareCopyViaTextarea(text, cb); }); }\n"
  + "  else liteShareCopyViaTextarea(text, cb);\n"
  + "}\n"
  + "function liteShareCopyViaTextarea(text, cb){\n"
  + "  try{ var ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; ta.style.left='-9999px';\n"
  + "    document.body.appendChild(ta); ta.focus(); ta.select(); var ok=document.execCommand('copy'); document.body.removeChild(ta); cb&&cb(ok); }\n"
  + "  catch(e){ cb&&cb(false); }\n"
  + "}\n"
  // A real report: pasted into an LMS embed block (e.g. Rise 360), the
  // page's own height changes as the story plays (line reveals, choice
  // count varying scene to scene), and nothing here ever told the host
  // page what that height actually was - broadcasts it via postMessage on
  // every layout change (a standard, widely-supported convention for a
  // responsive-height iframe/embed; a no-op, not an error, if the host
  // never listens for it) so a host that DOES support it can size its own
  // frame to match instead of clipping or leaving dead space.
  + "function notifyHeight(){\n"
  + "  try{ if(window.parent && window.parent!==window) window.parent.postMessage({ source:'scenemaker-embed', height: document.documentElement.scrollHeight }, '*'); }catch(e){}\n"
  + "}\n"
  + "\n"
  // A real report: the dialogue area's own size kept changing as different
  // lines/scenes played, on top of the outer iframe resizing (notifyHeight,
  // above). Measures the tallest ANY single frame this project will ever
  // actually render will need (offscreen, against a hidden clone of the
  // real stage so it picks up the live skin/font/border/width), then that
  // one number becomes #lv-stage's min-height for the whole play session -
  // shorter content just centers inside it (.lv-stage's own
  // justify-content:center) instead of the box resizing around it. Reuses
  // buildLineNode/buildChoicesInto, the exact same functions the real
  // render path uses, so this measures precisely what will actually show,
  // not a separate guess at it. Best-effort: wrapped in try/catch and a
  // >0 check, so a host environment where measurement can't run (e.g. a
  // hidden/zero-width iframe) just falls back to the CSS's own 3.2em
  // min-height on #lv-line instead of failing anything.\n"
  + "function computeStageMinHeight(){\n"
  + "  try{\n"
  + "    var rect = root.getBoundingClientRect();\n"
  + "    if(!rect.width) return 0;\n"
  + "    var probeRoot=document.createElement('div'); probeRoot.className='lv-root';\n"
  + "    probeRoot.style.cssText='position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0;box-sizing:border-box;width:'+rect.width+'px;';\n"
  + "    var probeStage=document.createElement('div'); probeStage.className='lv-stage';\n"
  + "    var probeLine=document.createElement('div'), probeChoices=document.createElement('div'); probeChoices.className='lv-choices';\n"
  + "    probeStage.appendChild(probeLine); probeStage.appendChild(probeChoices); probeRoot.appendChild(probeStage);\n"
  + "    document.body.appendChild(probeRoot);\n"
  + "    var maxH=0;\n"
  + "    Object.keys(DATA.scenes||{}).forEach(function(sid){\n"
  + "      var scene=DATA.scenes[sid], lines=scene.lines||[];\n"
  + "      if(OPT.animations){\n"
  + "        if(!lines.length){ probeLine.innerHTML=''; buildChoicesInto(scene, probeChoices); maxH=Math.max(maxH, probeStage.scrollHeight); return; }\n"
  + "        lines.forEach(function(l, idx){\n"
  + "          probeLine.innerHTML=''; probeChoices.innerHTML='';\n"
  + "          probeLine.appendChild(buildLineNode(l));\n"
  + "          var hint=document.createElement('div'); hint.className='lv-hint'; hint.textContent='\\u25b8 click to continue'; probeLine.appendChild(hint);\n"
  + "          maxH=Math.max(maxH, probeStage.scrollHeight);\n"
  + "          if(idx===lines.length-1){\n"
  + "            probeLine.innerHTML=''; probeLine.appendChild(buildLineNode(l));\n"
  + "            buildChoicesInto(scene, probeChoices);\n"
  + "            maxH=Math.max(maxH, probeStage.scrollHeight);\n"
  + "          }\n"
  + "        });\n"
  + "      } else {\n"
  + "        probeLine.innerHTML=''; probeChoices.innerHTML='';\n"
  + "        lines.forEach(function(l){ probeLine.appendChild(buildLineNode(l)); });\n"
  + "        buildChoicesInto(scene, probeChoices);\n"
  + "        maxH=Math.max(maxH, probeStage.scrollHeight);\n"
  + "      }\n"
  + "    });\n"
  + "    document.body.removeChild(probeRoot);\n"
  + "    return maxH;\n"
  + "  }catch(e){ return 0; }\n"
  + "}\n"
  + "function applyStageMinHeight(){\n"
  + "  if(!stageEl) return;\n"
  + "  stageEl.style.minHeight='0';\n"
  + "  var minH=computeStageMinHeight();\n"
  + "  if(minH>0) stageEl.style.minHeight=minH+'px';\n"
  + "}\n"
  + "\n"
  // #3: the real project's own title screen (project.title), text-only -
  // heading/subheading/start-button label, no bg/video/music. Only ever
  // wired up when the export HTML actually contains the #lv-title markup
  // (buildLiteExportHtml() only emits it when DATA.titleScreen is set).\n"
  + "function showTitleScreen(){\n"
  + "  var t=DATA.titleScreen; if(!t) return;\n"
  + "  var h=document.getElementById('lv-title-h'); if(h) h.textContent=subst(t.heading||DATA.title||'');\n"
  + "  var sub=document.getElementById('lv-title-sub'); if(sub){ var sv=subst(t.subheading||''); sub.textContent=sv; sub.style.display=sv?'':'none'; }\n"
  + "  var titleEl=document.getElementById('lv-title'); if(titleEl) titleEl.style.display='';\n"
  + "  var btn=document.getElementById('lv-title-start');\n"
  + "  if(btn){ btn.textContent=subst(t.startLabel||'Start'); wireCursorSound(btn); btn.onclick=beginStory; }\n"
  + "  notifyHeight();\n"
  + "}\n"
  + "function beginStory(){\n"
  + "  var titleEl=document.getElementById('lv-title'); if(titleEl) titleEl.style.display='none';\n"
  + "  if(stageEl) stageEl.style.display='';\n"
  + "  render(false);\n"
  + "  notifyHeight();\n"
  + "}\n"
  + "\n"
  + "function boot(){\n"
  + "  root=document.getElementById('lv-root'); audioEl=document.getElementById('lv-audio'); stageEl=document.getElementById('lv-stage');\n"
  + "  var logBtn=document.getElementById('lv-log-btn'); if(logBtn){ logBtn.onclick=openLog; wireCursorSound(logBtn); }\n"
  + "  var logClose=document.getElementById('lv-log-close'); if(logClose) logClose.onclick=closeLog;\n"
  + "  var logOv=document.getElementById('lv-log-overlay'); if(logOv) logOv.addEventListener('click', function(e){ if(e.target===logOv) closeLog(); });\n"
  + "  var muteBtn=document.getElementById('lv-mute-btn'); if(muteBtn){ muteBtn.onclick=toggleMute; wireCursorSound(muteBtn); }\n"
  + "  applyStageMinHeight();\n"
  + "  if(DATA.titleScreen) showTitleScreen(); else render(false);\n"
  + "  notifyHeight();\n"
  + "  if(typeof ResizeObserver!=='undefined'){ try{ new ResizeObserver(notifyHeight).observe(document.body); }catch(e){} }\n"
  // Recomputes the reserved box size on a genuine viewport-width change
  // (e.g. the host page reflowing on rotation/resize), not on our own
  // content changes - window 'resize' only fires for the former, so this
  // can't loop against notifyHeight()'s own document.body ResizeObserver.\n"
  + "  var resizeTimer=null;\n"
  + "  window.addEventListener('resize', function(){\n"
  + "    clearTimeout(resizeTimer);\n"
  + "    resizeTimer=setTimeout(function(){ applyStageMinHeight(); notifyHeight(); }, 200);\n"
  + "  });\n"
  + "}\n"
  + "if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();\n"
  + "})();";

function buildLiteExportHtml(opts){
  opts = opts || _liteReadOptions();
  const data = _liteBuildData(opts);
  const dataJson = JSON.stringify(data).replace(/</g, '\\u003c');
  const title = escHtml(data.title);
  // #3: the title screen markup only exists at all when the project has one
  // enabled - an untouched project (title screen off) gets no #lv-title, no
  // behaviour change, matching every other opt-in feature here.
  const titleHtml = data.titleScreen
    ? '<div class="lv-title" id="lv-title" style="display:none">'
      + '<h1 class="lv-title-h" id="lv-title-h"></h1>'
      + '<p class="lv-title-sub" id="lv-title-sub"></p>'
      + '<button class="lv-choice lv-title-start" id="lv-title-start"></button>'
      + '</div>'
    : '';
  const stageHtml = '<div class="lv-stage" id="lv-stage"' + (data.titleScreen ? ' style="display:none"' : '') + '>'
    + '<div id="lv-line"></div><div class="lv-choices" id="lv-choices"></div></div>';
  // Log button/overlay (backlog, "just in case a line got skipped"): only
  // emitted at all when showLog is on, an untouched export gets neither the
  // button nor the (empty, harmless either way) overlay markup, matching
  // every other opt-in feature here.
  const logHtml = data.options.showLog
    ? '<button type="button" class="lv-log-btn" id="lv-log-btn" title="Everything said and chosen so far">☷ Log</button>'
      + '<div class="lv-log-overlay" id="lv-log-overlay" style="display:none"><div class="lv-log-card"><div class="lv-log-head"><span>Log</span><button type="button" class="lv-log-close" id="lv-log-close">✕</button></div><div class="lv-log-body" id="lv-log-body"></div></div></div>'
    : '';
  // #mute: only emitted at all when data.options.showMuteBtn is true (which
  // is itself already gated on at least one sound-producing toggle being on
  // - see _liteBuildData()), matching every other opt-in feature here.
  const muteHtml = data.options.showMuteBtn
    ? '<button type="button" class="lv-mute-btn" id="lv-mute-btn" title="Mute all sound" aria-pressed="false">🔊 Sound</button>'
    : '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + title + '</title><style>' + _liteBuildCss(opts) + '</style></head><body>'
    + '<div class="lv-root" id="lv-root">' + muteHtml + logHtml + titleHtml + stageHtml + '</div>'
    + '<audio id="lv-audio" style="display:none"></audio>'
    + '<script>window.SCENEMAKER_LITE_DATA = ' + dataJson + ';</script>'
    + '<script>' + LITE_RUNTIME_JS + '</script>'
    + '</body></html>';
}

const LITE_HINT_HTML = '<p>A single, portable HTML file for embedding in an LMS’s raw-HTML/embed block, or anywhere else raw HTML is accepted. It has no separate files of its own and adjusts to whatever width it’s given.</p>'
  + '<p>Always included: dialogue text, character names, and choices with their full branching (variable effects/conditions, priority routes, dice, ask-input). If the project has a title screen turned on, its heading/subheading/start-button text comes along too (never its background image, video, or music). Everything else - images, backgrounds, portraits, video, uploaded audio, the credits screen - never ships, no matter what’s toggled below.</p>'
  + '<p>The dialogue/choice area reserves the largest size any line or scene in the story will ever need, up front, so it holds still while typing out and playing through instead of resizing around each line - shorter lines just centre inside it. The whole embed still broadcasts its own height via postMessage on every real change (a standard responsive-embed signal), so a host page that listens for it can resize its own frame to match instead of clipping or scrolling.</p>'
  + '<p>Typing and hover sounds are separate toggles below, so either can be turned off on its own. A Mute button (its own toggle, and only ever shown when there’s actually a sound to mute) lets the player silence them at will, at runtime, on top of these build-time toggles rather than instead of them. Text speed defaults to the project’s own Settings → Text speed. The colour Style can match the project automatically, force a specific named skin, or go fully custom - every custom swatch takes a typed hex code too, and the small preview strip always shows the colours actually in effect.</p>'
  + '<p>The Log button shows a scrollable backlog of every line and choice seen so far in this run, in case a line typed past too quickly to read. Celebration effects (confetti, fireworks, a big green check, or a big red X) fire wherever a scene or choice is set up with one in the editor (a scene’s own Effect cues, or a choice’s “Screen effect; when this choice is picked”) - only those four effects ship here; anything else set up there (flashes, screen shake, and the rest) is a full-player-only effect and never appears in this export.</p>'
  + '<p>Share, below, only ever does anything once the project’s own "Share at the ending" is turned on (Settings → Info & credits), which also sets the message shown; this toggle here just lets this one export leave it off even if the project has it on.</p>';

const LITE_OPTIONS = [
  ['lite-opt-colors', 'colorScheme', 'Apply a colour scheme (screen style, font, border, character name colours)'],
  ['lite-opt-typesound', 'typeSound', 'Typing sound (blip as each line types out)'],
  ['lite-opt-cursorsound', 'cursorSound', 'Choice/button hover sound'],
  ['lite-opt-audio', 'externalAudio', 'Stream a scene’s audio if it’s set to play from a URL'],
  ['lite-opt-anim', 'animations', 'Animate (lines type out, scenes crossfade)'],
  ['lite-opt-log', 'showLog', 'Show a “Log” button (everything said and chosen so far, in case a line got skipped)'],
  ['lite-opt-mutebtn', 'showMuteBtn', 'Show a mute button (lets the player silence any sounds left on above; only appears if there’s something to mute)'],
  ['lite-opt-celebrate', 'celebrations', 'Celebration / bad-choice effects (confetti, fireworks, a big check or X) on endings and picked choices, when set up in the editor'],
  ['lite-opt-share', 'shareEnding', 'Let players share their ending (Settings → Info & credits → Share at the ending; no-op unless that’s turned on there too)']
];

// #4: the manual style override. '' (the first option) means "match the
// project's own Screen style" - the original, automatic behaviour, still
// the default - every other value forces that look regardless of what the
// live project is set to, for a one-off embed that should look different.
const LITE_STYLE_CHOICES = [
  ['', 'Match project setting'], ['plain', 'Plain'], ['jrpg', 'JRPG'], ['terminal', 'Terminal'],
  ['parchment', 'Parchment'], ['comic', 'Comic'], ['neon', 'Neon'], ['custom', 'Custom colors…']
];
// Field id suffix -> LITE_CUSTOM_DEFAULTS key -> visible label.
const LITE_CUSTOM_FIELDS = [
  ['bg', 'bg', 'Background'], ['text', 'text', 'Dialogue text'],
  ['speakerBg', 'speakerBg', 'Name badge'], ['speakerText', 'speakerText', 'Name text'],
  ['choiceBg', 'choiceBg', 'Choice button'], ['choiceBorder', 'choiceBorder', 'Choice border'],
  ['choiceText', 'choiceText', 'Choice text'], ['choiceHover', 'choiceHover', 'Choice hover']
];
// The 4 swatches shown in the always-visible colour preview strip.
const LITE_PREVIEW_SWATCHES = [
  ['bg', 'Background'], ['text', 'Text'], ['speakerBg', 'Name badge'], ['choiceBg', 'Choice button']
];

// Resolves whatever colour scheme is ACTUALLY in effect down to one of
// LITE_SKIN_CSS/LITE_SKIN_COLORS' own keys - a named override, or (when
// styleOverride is '', "match project setting") the project's real,
// currently-configured Screen style. Shared by _liteBuildCss (the real CSS
// output) and the modal's own preview/pre-fill logic, so what's SHOWN and
// what actually SHIPS can never drift apart.
function _liteResolveStyleKey(styleOverride){
  if(styleOverride && styleOverride!=='custom' && LITE_SKIN_CSS[styleOverride]) return styleOverride;
  const sc = (project.settings && project.settings.screen) || {};
  return sc.style==='ff7' ? 'jrpg' : (sc.style||'plain');
}

// The effective 8-swatch colour map for whatever's currently selected -
// custom values verbatim, or the resolved named skin's approximation
// otherwise - used to paint the preview strip and to pre-fill Custom
// colors when switching into it.
function _liteEffectiveColors(styleOverride, customColors){
  if(styleOverride==='custom') return Object.assign({}, LITE_CUSTOM_DEFAULTS, customColors||{});
  return LITE_SKIN_COLORS[_liteResolveStyleKey(styleOverride)] || LITE_CUSTOM_DEFAULTS;
}

function _liteReadOptions(){
  const g=id=>document.getElementById(id);
  const out={};
  LITE_OPTIONS.forEach(([id,key])=>{ const el=g(id); out[key] = el ? el.checked : true; });
  const styleSel = g('lite-opt-style');
  out.styleOverride = styleSel ? styleSel.value : '';
  out.customColors = {};
  LITE_CUSTOM_FIELDS.forEach(([id,key])=>{ const el=g('lite-cc-'+id); if(el) out.customColors[key]=el.value; });
  const speedEl = g('lite-opt-speed');
  out.textSpeed = speedEl ? Number(speedEl.value) : ((project.settings && project.settings.text && project.settings.text.speed) || 5);
  return out;
}

function openLiteExportModal(){
  const html = buildLiteExportHtml();
  let bg=document.getElementById('lite-export-modal');
  if(!bg){
    bg=document.createElement('div'); bg.id='lite-export-modal'; bg.className='modal-bg hidden';
    const detachIco = typeof detachIconHtml==='function' ? detachIconHtml('lite-export-modal', 'Embeddable HTML export') : '';
    // textSpeed defaults from the project's own Settings -> Text speed
    // (project.settings.text.speed), the same field the real player reads,
    // so an untouched export types at the same pace the project already
    // plays at instead of a separate, disconnected default.
    const defaultSpeed = (project.settings && project.settings.text && project.settings.text.speed) || 5;
    bg.innerHTML='<div class="modal-card" style="max-width:640px"><h2>Embeddable HTML export'+detachIco+'</h2>'
      + '<div class="modal-body">'
      + '<div class="hint" style="margin-bottom:10px">' + LITE_HINT_HTML + '</div>'
      + '<div id="lite-opt-list" style="margin-bottom:10px"></div>'
      + '<div id="lite-speed-row" style="margin:2px 0 8px"><label class="chk" title="How fast lines type out; only matters while Animate is on. Same 1 (slow)-10 (fast) scale as Settings -> Text speed.">Text speed: '
      + '<input type="range" id="lite-opt-speed" min="1" max="10" step="1" value="'+defaultSpeed+'" oninput="document.getElementById(\'lite-speed-val\').textContent=this.value; _liteRefresh()" style="vertical-align:middle"> '
      + '<span id="lite-speed-val">'+defaultSpeed+'</span></label></div>'
      + '<div id="lite-style-row" style="margin:2px 0 8px"></div>'
      + '<div id="lite-color-preview" style="display:flex;gap:10px;align-items:center;margin:2px 0 8px;font-size:11px"></div>'
      + '<div id="lite-custom-colors" style="display:none;grid-template-columns:repeat(2,minmax(210px,1fr));gap:8px 16px;margin:2px 0 10px;font-size:12px;align-items:center"></div>'
      + '<div class="cv-wrap" id="lite-export-code" style="height:260px"></div>'
      + '<div style="display:flex;gap:8px;margin-top:10px">'
      + '<button class="tb-btn tb-accent" onclick="_liteCopyToClipboard()">📋 Copy to clipboard</button>'
      + '<button class="tb-btn" onclick="_liteDownloadHtml()">⬇ Download .html</button>'
      + '<button class="tb-btn" onclick="_liteOpenPreviewTab()">▶ Preview</button>'
      + '</div></div>'
      + '<div class="modal-foot"><button class="tb-btn tb-slate" onclick="closeModal(\'lite-export-modal\')">Close</button></div></div>';
    document.body.appendChild(bg);
    bg.querySelector('#lite-opt-list').innerHTML = LITE_OPTIONS.map(([id,key,label])=>
      `<label class="chk" style="display:block;margin:2px 0"><input type="checkbox" id="${id}" checked onchange="_liteRefresh()"> ${label}</label>`
    ).join('');
    bg.querySelector('#lite-style-row').innerHTML = '<label class="chk" title="Overrides the project\'s own Screen style for just this export">Style: '
      + '<select id="lite-opt-style" onchange="_liteStyleChanged()">'
      + LITE_STYLE_CHOICES.map(([v,label])=>`<option value="${v}">${label}</option>`).join('')
      + '</select></label>';
    bg.querySelector('#lite-custom-colors').innerHTML = LITE_CUSTOM_FIELDS.map(([id,key,label])=>
      `<label style="display:flex;align-items:center;gap:4px">${label}<input type="color" id="lite-cc-${id}" value="${LITE_CUSTOM_DEFAULTS[key]}" oninput="hexSyncFromColor(this); _liteRefresh()">${hexFieldHtml(LITE_CUSTOM_DEFAULTS[key])}</label>`
    ).join('') + '<button class="tb-btn" style="grid-column:1/-1;justify-self:start" onclick="_liteResetCustomColors()">Reset to plain defaults</button>';
    bg.querySelector('#lite-color-preview').innerHTML = LITE_PREVIEW_SWATCHES.map(([key,label])=>
      `<span title="${label} (as it'll actually appear)" style="display:inline-flex;align-items:center;gap:4px"><span id="lite-sw-${key}" style="display:inline-block;width:16px;height:16px;border-radius:4px;border:1px solid var(--line)"></span>${label}</span>`
    ).join('');
  }
  _liteCurrentHtml = html;
  _codeViewRender(bg.querySelector('#lite-export-code'), html);
  bg.classList.remove('hidden');
  _liteUpdateColorPreview();
}
function _liteStyleChanged(){
  const sel=document.getElementById('lite-opt-style');
  const box=document.getElementById('lite-custom-colors');
  const prev = sel ? (sel.dataset.prevValue || '') : '';
  const isCustom = !!sel && sel.value==='custom';
  if(box) box.style.display = isCustom ? 'grid' : 'none';
  // #187: switching straight into "Custom colors..." pre-fills from
  // whatever style was actually in effect a moment ago (a named skin, or
  // the project's own live Screen style if it was "Match project
  // setting") - a real starting point instead of always the plain
  // defaults, addressing a report that asked the shown colours to
  // "depict those used within the scenario... if a theme is chosen".
  if(isCustom && prev!=='custom'){
    const src = LITE_SKIN_COLORS[_liteResolveStyleKey(prev)] || LITE_CUSTOM_DEFAULTS;
    LITE_CUSTOM_FIELDS.forEach(([id,key])=>{
      const el=document.getElementById('lite-cc-'+id);
      if(el){ el.value=src[key]||LITE_CUSTOM_DEFAULTS[key]; hexSyncFromColor(el); }
    });
  }
  if(sel) sel.dataset.prevValue = sel.value;
  _liteRefresh();
}
function _liteResetCustomColors(){
  LITE_CUSTOM_FIELDS.forEach(([id,key])=>{
    const el=document.getElementById('lite-cc-'+id);
    if(el){ el.value=LITE_CUSTOM_DEFAULTS[key]; hexSyncFromColor(el); }
  });
  _liteRefresh();
}
// #187: paints the always-visible preview strip from whatever colour
// scheme is actually in effect right now (named skin, project match, or
// live custom-picker values) - "clearer colour elements" was a direct
// report, and a live swatch reads faster than cross-referencing hex codes.
function _liteUpdateColorPreview(){
  const g=id=>document.getElementById(id);
  const colorsOn = g('lite-opt-colors') ? g('lite-opt-colors').checked : true;
  const styleSel = g('lite-opt-style');
  const customColors = {};
  LITE_CUSTOM_FIELDS.forEach(([id,key])=>{ const el=g('lite-cc-'+id); if(el) customColors[key]=el.value; });
  const colors = colorsOn ? _liteEffectiveColors(styleSel ? styleSel.value : '', customColors) : LITE_CUSTOM_DEFAULTS;
  LITE_PREVIEW_SWATCHES.forEach(([key])=>{ const sw=g('lite-sw-'+key); if(sw) sw.style.background = colorsOn ? (colors[key]||'#888') : 'transparent'; });
  const strip = g('lite-color-preview'); if(strip) strip.style.opacity = colorsOn ? '1' : '.4';
}
function _liteRefresh(){
  const box=document.getElementById('lite-export-code'); if(!box) return;
  _liteCurrentHtml = buildLiteExportHtml();
  _codeViewRender(box, _liteCurrentHtml);
  _liteUpdateColorPreview();
}
function _liteOpenPreviewTab(){
  const html = buildLiteExportHtml();
  try{ const w=window.open('', '_blank'); if(!w){ toast('Allow pop-ups to preview the export'); return; } w.document.write(html); w.document.close(); }
  catch(e){ toast('Preview failed to open'); }
}
// Copies the RAW, byte-identical export string (never the highlighted/
// line-numbered markup _codeViewRender() builds for on-screen display only -
// see that function's own header comment) - a hidden textarea stands in for
// the old visible-and-selectable one, just for the execCommand('copy')
// fallback path.
function _liteCopyToClipboard(){
  if(_liteCurrentHtml==null) return;
  const finish=()=>toast('Copied to clipboard');
  try{
    navigator.clipboard.writeText(_liteCurrentHtml).then(finish).catch(()=>_liteCopyViaHiddenTextarea(finish));
  }catch(e){ _liteCopyViaHiddenTextarea(finish); }
}
function _liteCopyViaHiddenTextarea(onOk){
  try{
    const ta=document.createElement('textarea');
    ta.value=_liteCurrentHtml; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    onOk();
  }catch(e){ toast('Copy failed; select the text manually'); }
}
function _liteDownloadHtml(){
  if(_liteCurrentHtml==null) return;
  downloadBlob(new Blob([_liteCurrentHtml],{type:'text/html'}), safeTitle()+'-embed.html');
  toast('HTML downloaded');
}

/* ============================================================================
   Read-only code view: line numbers (never copied/selected along with the
   code - a real report) + basic syntax colour for the exported HTML/CSS/JS,
   so this reads like actual code instead of a plain wall of characters in a
   textarea. Display-only: _liteCurrentHtml (the exact bytes Copy/Download
   use) is never touched by any of this - only what's rendered on screen.
   A hand-rolled, purpose-built highlighter (no CDN library, matching this
   project's no-bundler/no-live-CDN rule) tuned to what buildLiteExportHtml()
   actually emits, not a general-purpose HTML/CSS/JS parser:
     - the generator concatenates the whole <head>/<style>/<body> shell as
       ONE long line (real, correct output - nothing needs it broken up to
       work) - _codeViewPretty() inserts DISPLAY-ONLY line breaks (one CSS
       rule per line inside <style>, one tag per line outside <script>) so
       it reads naturally, without changing a single byte of the actual
       exported file.
     - the runtime <script> block is already one statement per line from the
       generator itself and is left alone; the one self-contained data
       <script>...</script> line (the project's JSON) is highlighted as JS
       in place, tags included, rather than pretty-printed - JSON string
       values could coincidentally contain '><' or other sequences a
       generic splitter might misread, so that line is left exactly as
       generated and just colour-highlighted.
   ==========================================================================*/
let _liteCurrentHtml = null;

function _cvEsc(s){ return (typeof escHtml==='function') ? escHtml(s) : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Applies `re` (a single alternation regex, 'g' flag) to `line`, wrapping
// each match in a classed span (per `classify(match)`, returning a suffix
// for "cv-<suffix>" or null/'' for no highlight) and HTML-escaping both the
// matched and the plain in-between text exactly once each - the single-pass
// approach that keeps sequential independent regexes from re-matching
// inside spans this function already inserted (e.g. a keyword-shaped
// substring INSIDE a highlighted string literal getting wrongly re-coloured
// as a keyword).
function _cvApply(line, re, classify){
  let out='', last=0, m; re.lastIndex=0;
  while((m=re.exec(line))){
    if(m.index>last) out+=_cvEsc(line.slice(last,m.index));
    const cls=classify(m);
    out += cls ? '<span class="cv-'+cls+'">'+_cvEsc(m[0])+'</span>' : _cvEsc(m[0]);
    last=m.index+m[0].length;
    if(m[0].length===0) re.lastIndex++; // guard against zero-length matches looping forever
  }
  out+=_cvEsc(line.slice(last));
  return out;
}
const _CV_HTML_RE = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w:-]*)|([a-zA-Z-]+(?==))|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
function _cvHtmlLine(line){
  return _cvApply(line, _CV_HTML_RE, m=> m[1]?'cm' : m[2]?'tag' : m[3]?'attr' : m[4]?'str' : null);
}
function _cvCssLine(line){
  const i=line.indexOf('{');
  if(i<0) return _cvApply(line, /(\/\*[\s\S]*?\*\/)|([a-zA-Z-]+)(?=\s*:)/g, m=> m[1]?'cm':(m[2]?'prop':null));
  const sel=line.slice(0,i), rest=line.slice(i);
  return '<span class="cv-sel">'+_cvEsc(sel)+'</span>'
    + _cvApply(rest, /([a-zA-Z-]+)(?=\s*:)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m=> m[1]?'prop':(m[2]?'str':null));
}
const _CV_JS_KEYWORDS = 'var|let|const|function|return|if|else|for|while|new|typeof|true|false|null|undefined|this|break|continue|in|of|do|switch|case|default|try|catch|throw';
const _CV_JS_RE = new RegExp('(\\/\\/.*$)|(\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*"|`(?:[^`\\\\]|\\\\.)*`)|\\b('+_CV_JS_KEYWORDS+')\\b|\\b(\\d+(?:\\.\\d+)?)\\b','g');
function _cvJsLine(line){
  return _cvApply(line, _CV_JS_RE, m=> m[1]?'cm' : m[2]?'str' : m[3]?'kw' : m[4]?'num' : null);
}
// DISPLAY-ONLY reformatting (see this section's header comment) - never
// changes what Copy/Download actually send out.
function _codeViewPretty(raw){
  let s = raw.replace(/(<style>)([\s\S]*?)(<\/style>)/, (m,open,css,close)=>{
    const pretty = css.replace(/}/g,'}\n').trim();
    return open+'\n'+pretty+'\n'+close;
  });
  // one HTML element boundary per line, but never inside a <script>...
  // </script> block (already well-formatted by the generator, and may
  // contain '><' inside a JSON string value coincidentally).
  const parts = s.split(/(<script>[\s\S]*?<\/script>)/);
  s = parts.map((part,i)=> i%2===1 ? part : part.replace(/></g,'>\n<')).join('');
  return s;
}
function _codeViewHighlight(raw){
  const lines = _codeViewPretty(raw).split('\n');
  let mode='html';
  return lines.map(line=>{
    const styleOpen=/<style>/.test(line), styleClose=/<\/style>/.test(line);
    const scriptOpen=/<script>/.test(line), scriptClose=/<\/script>/.test(line);
    const selfScript = scriptOpen && scriptClose, selfStyle = styleOpen && styleClose;
    let lineMode = mode;
    if(selfScript) lineMode='js';
    else if(selfStyle) lineMode='css';
    else if(styleClose && mode==='css'){ lineMode='html'; mode='html'; }
    else if(scriptClose && mode==='js'){ lineMode='html'; mode='html'; }
    const html = lineMode==='css' ? _cvCssLine(line) : lineMode==='js' ? _cvJsLine(line) : _cvHtmlLine(line);
    if(!selfStyle && styleOpen && mode==='html') mode='css';
    if(!selfScript && scriptOpen && mode==='html') mode='js';
    return html;
  });
}
function _codeViewRender(container, raw){
  if(!container) return;
  const lines = _codeViewHighlight(raw);
  const pad = String(lines.length).length;
  container.innerHTML = '<pre class="cv-code">' + lines.map((html,i)=>
    '<span class="cv-line"><span class="cv-ln">'+String(i+1).padStart(pad,' ')+'</span><span class="cv-content">'+(html||' ')+'</span></span>'
  ).join('\n') + '</pre>';
}
