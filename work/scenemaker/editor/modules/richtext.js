/* ============================================================================
   Scenemaker editor; richtext
   Part of the modular editor. Classic script sharing global scope with core.js.
   ==========================================================================*/
/* rich text (#16): same mini-markup renderer as the player, for live preview */
const _COLOR_OK=/^#[0-9a-fA-F]{3,6}$/;
const _NAMED={red:1,blue:1,green:1,yellow:1,orange:1,purple:1,pink:1,white:1,black:1,cyan:1,magenta:1,gray:1,grey:1,gold:1,lime:1,teal:1,navy:1,brown:1};
const _URL_OK=/^https?:\/\//i; // http(s) only, same allowlist as the player's own vnRenderRich()
function renderRich(t){
  let s=escHtml(t);
  // #146: [url=https://...]label[/url] - same markup + scheme allowlist as
  // player/rich.js's vnRenderRich(); an unrecognized scheme falls back to
  // plain text instead of a live link.
  s=s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/g,(m,url,inner)=>{
    return _URL_OK.test(url) ? `<a href="${escAttr(url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)" onclick="event.stopPropagation()">${inner}</a>` : inner;
  });
  s=s.replace(/\[c=([#0-9a-zA-Z]+)\]([\s\S]*?)\[\/c\]/g,(m,c,inner)=>{ c=c.toLowerCase(); return (_COLOR_OK.test(c)||_NAMED[c])?`<span style="color:${c}">${inner}</span>`:inner; });
  // #99: same [kw=] payload tag as player/rich.js's vnRenderRich() - see there
  // for why. Never hand-typed by an author; only ever emitted programmatically.
  s=s.replace(/\[kw=([^|\]]*)\|([01]?)\|([01]?)\]([\s\S]*?)\[\/kw\]/g,(m,c,b,it,inner)=>{
    c=c.toLowerCase(); const colorOk=c&&(_COLOR_OK.test(c)||_NAMED[c]);
    let out=inner; if(it==='1') out=`<i>${out}</i>`; if(b==='1') out=`<b>${out}</b>`;
    return colorOk ? `<span style="color:${c}">${out}</span>` : out;
  });
  s=s.replace(/\[big\]([\s\S]*?)\[\/big\]/g,'<span style="font-size:1.35em">$1</span>');
  s=s.replace(/\[small\]([\s\S]*?)\[\/small\]/g,'<span style="font-size:.8em">$1</span>');
  s=s.replace(/\*\*([\s\S]+?)\*\*/g,'<b>$1</b>').replace(/\*([\s\S]+?)\*/g,'<i>$1</i>').replace(/__([\s\S]+?)__/g,'<u>$1</u>').replace(/~~([\s\S]+?)~~/g,'<s>$1</s>');
  return s;
}
// #8: the rendered-preview row only earns its own vertical space when it
// would actually show something different from the plain textarea right
// above it - for the overwhelmingly common case (a line with no rich
// markup at all), it was a pure duplicate of the same text, doubling the
// height of every single dialogue line for zero benefit.
const _RICH_MARKUP_RE=/\[url=[^\]]+\][\s\S]*?\[\/url\]|\[c=[#0-9a-zA-Z]+\][\s\S]*?\[\/c\]|\[kw=[^|\]]*\|[01]?\|[01]?\][\s\S]*?\[\/kw\]|\[big\][\s\S]*?\[\/big\]|\[small\][\s\S]*?\[\/small\]|\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|__[\s\S]+?__|~~[\s\S]+?~~/;
function hasRichMarkup(t){ return _RICH_MARKUP_RE.test(t||''); }
function updatePreview(lid,val){ const pv=document.getElementById('pv-'+lid); if(pv){ pv.innerHTML=renderRich(val); pv.style.display=hasRichMarkup(val)?'':'none'; } }
function fmt(sid,lid,before,after){ fmtTa('ta-'+lid, sid, lid, before, after); }
function fmtTa(taid,sid,lid,before,after){ const ta=document.getElementById(taid); if(!ta)return;
  const s=ta.selectionStart,e=ta.selectionEnd,v=ta.value,sel=v.slice(s,e)||'text';
  ta.value=v.slice(0,s)+before+sel+after+v.slice(e); setLine(sid,lid,'text',ta.value); updatePreview(lid,ta.value);
  const mir=document.getElementById(taid==='ta-'+lid?'pta-'+lid:'ta-'+lid); if(mir) mir.value=ta.value; // keep node + props in sync
  ta.focus(); ta.selectionStart=s+before.length; ta.selectionEnd=s+before.length+sel.length; }
function fmtColor(sid,lid){ const inp=document.getElementById('col-'+lid); fmt(sid,lid,'[c='+((inp&&inp.value)||'#ff5555')+']','[/c]'); }
function fmtColorTa(taid,sid,lid,colid){ const inp=document.getElementById(colid); fmtTa(taid,sid,lid,'[c='+((inp&&inp.value)||'#ff5555')+']','[/c]'); }
// #146: hyperlinks - wrapping the current selection needs a URL first, so
// unlike the other fmt*() calls (which wrap immediately) this asks via the
// app's own themed prompt, then wraps on confirm. The textarea's own
// selectionStart/selectionEnd survive losing focus to that modal (a plain
// textarea property, not tied to focus), so fmtTa() still wraps the right
// span once the URL comes back.
function fmtLinkTa(taid,sid,lid){ const ta=document.getElementById(taid); if(!ta) return;
  uiPromptText('Link URL (http:// or https://):','https://',(url)=>{ if(url) fmtTa(taid,sid,lid,'[url='+url+']','[/url]'); },
    { validate:v=>(!v||/^https?:\/\//i.test(v))?null:'Must start with http:// or https://' }); }
function fmtLink(sid,lid){ fmtLinkTa('ta-'+lid,sid,lid); }

/* Ctrl/Cmd+B/I/U word-processor hotkeys, and Ctrl/Cmd+Enter to insert a new
   dialogue line, inside a rich-text textarea */
function rtHotkey(e, sid, lid, taid){
  if(!(e.ctrlKey||e.metaKey) || e.altKey) return;
  const k=(e.key||'').toLowerCase();
  if(k==='enter'){ e.preventDefault(); addLineAfter(sid, lid); return; }
  const wrap={ b:['**','**'], i:['*','*'], u:['__','__'] };
  if(wrap[k]){ e.preventDefault(); fmtTa(taid, sid, lid, wrap[k][0], wrap[k][1]); }
}

/* keep a range slider and its number box in step (#16) */
function syncPair(el){
  const wrap=el.closest('.opt-num-wrap')||el.parentElement; if(!wrap) return;
  const other=wrap.querySelector(el.type==='range'?'input[type=number]':'input[type=range]');
  if(other && other!==el) other.value=el.value;
}
