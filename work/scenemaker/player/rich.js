/* ============================================================================
   Scenemaker player; rich text (mini-markup -> safe HTML)
   Shares the exact markup spec with the editor's live preview.
   Global vnRenderRich(); loaded before runtime.js.
   ==========================================================================*/
(function(){
  var COLOR_OK=/^#[0-9a-fA-F]{3,6}$/;
  var NAMED={red:1,blue:1,green:1,yellow:1,orange:1,purple:1,pink:1,white:1,black:1,cyan:1,magenta:1,gray:1,grey:1,gold:1,lime:1,teal:1,navy:1,brown:1};
  var URL_OK=/^https?:\/\//i; // http(s) only - blocks javascript:/data: etc from a malicious/tampered .vnproj
  function escapeHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escapeAttr(s){ return String(s==null?'':s).replace(/"/g,'&quot;'); }
  window.vnRenderRich=function(t){
    var s=escapeHtml(t);
    // #146: [url=https://...]label[/url] - hyperlinks in dialogue text. The
    // URL comes through escapeHtml() above already ('&' etc escaped), so
    // only quotes need escaping before it lands inside an href="" attribute;
    // an unrecognized scheme (not plain http/https) renders as plain text
    // instead of a live link rather than risking a javascript: URL.
    s=s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/g,function(m,url,inner){
      // stopPropagation: the stage/dialogue box advance to the next line on
      // any click, so without this a link click would ALSO skip the line
      // out from under the reader the instant they click it.
      return URL_OK.test(url) ? '<a href="'+escapeAttr(url)+'" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">'+inner+'</a>' : inner;
    });
    s=s.replace(/\[c=([#0-9a-zA-Z]+)\]([\s\S]*?)\[\/c\]/g,function(m,c,inner){ c=c.toLowerCase(); return (COLOR_OK.test(c)||NAMED[c])?'<span style="color:'+c+'">'+inner+'</span>':inner; });
    // #99: [kw=<color>|<bold>|<italic>]text[/kw] - the keyphrase/character-name
    // highlighter and per-variable {{token}} style both emit this internally
    // (never hand-typed); a compact payload avoids any combination ambiguity
    // between separately-nested **bold**/*italic* markers.
    s=s.replace(/\[kw=([^|\]]*)\|([01]?)\|([01]?)\]([\s\S]*?)\[\/kw\]/g,function(m,c,b,it,inner){
      c=c.toLowerCase(); var colorOk=c&&(COLOR_OK.test(c)||NAMED[c]);
      var out=inner; if(it==='1') out='<i>'+out+'</i>'; if(b==='1') out='<b>'+out+'</b>';
      return colorOk ? '<span style="color:'+c+'">'+out+'</span>' : out;
    });
    s=s.replace(/\[big\]([\s\S]*?)\[\/big\]/g,'<span style="font-size:1.35em">$1</span>');
    s=s.replace(/\[small\]([\s\S]*?)\[\/small\]/g,'<span style="font-size:.8em">$1</span>');
    s=s.replace(/\*\*([\s\S]+?)\*\*/g,'<b>$1</b>');
    s=s.replace(/\*([\s\S]+?)\*/g,'<i>$1</i>');
    s=s.replace(/__([\s\S]+?)__/g,'<u>$1</u>');
    s=s.replace(/~~([\s\S]+?)~~/g,'<s>$1</s>');
    return s;
  };
})();
