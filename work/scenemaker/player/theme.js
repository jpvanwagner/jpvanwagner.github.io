/* ============================================================================
   Scenemaker player; in-game UI / themes
   Screen frame, FF7 skin, universal font, and the nav-button visibility.
   Global (not wrapped) so runtime.js can call it. Loaded before runtime.js.
   ==========================================================================*/
window.VN_FONTS = {
  system:'system-ui,-apple-system,sans-serif', serif:'Georgia,"Times New Roman",serif',
  mono:'"Courier New",monospace', rounded:'"Trebuchet MS","Segoe UI",sans-serif',
  comic:'"Comic Sans MS","Comic Sans",cursive', pixel:'"Press Start 2P",monospace',
  terminal:'"VT323","Courier New",monospace'
};
function vnApplyScreen(settings, stage){
  settings = settings || {}; var screen = settings.screen || {}, dbg = settings.debug || {};
  var root = document.documentElement.style, byId = function(id){ return document.getElementById(id); };
  root.setProperty('--font', VN_FONTS[screen.font] || VN_FONTS.system);
  var SKINS = ['jrpg','terminal','parchment','comic','neon'];
  var style = screen.style==='ff7' ? 'jrpg' : (screen.style || 'plain'); // legacy 'ff7' → 'jrpg'
  SKINS.forEach(function(s){ stage.classList.remove('sk-'+s); });
  if(style!=='plain') stage.classList.add('sk-'+style);
  if(screen.border){ root.setProperty('--frame-w',(screen.width||6)+'px'); root.setProperty('--frame',screen.color||'#e5e7eb'); root.setProperty('--frame-r',(screen.radius||0)+'px'); }
  else root.setProperty('--frame-w','0px');
  // Back/Forward/Restart live under Debug features now (only shown when debug is on).
  var on = !!dbg.enabled, any = on && (dbg.back||dbg.forward||dbg.restart);
  byId('vn-nav').style.display = any ? 'flex' : 'none';
  byId('vn-back').style.display    = (on&&dbg.back)?'inline-block':'none';
  byId('vn-fwd').style.display     = (on&&dbg.forward)?'inline-block':'none';
  byId('vn-restart').style.display = (on&&dbg.restart)?'inline-block':'none';
}
