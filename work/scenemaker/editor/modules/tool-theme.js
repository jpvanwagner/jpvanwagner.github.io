/* ============================================================================
   Scenemaker editor; tool theme engine
   Applies one of the full palettes from theme-presets.js to the editor UI and
   remembers the choice on this computer. Classic script sharing global scope.
   (Palette DATA lives in theme-presets.js; add themes there, not here.)
   ==========================================================================*/
function resolveThemeName(name){
  if(name==='system'){ return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'paper' : EDITOR_THEME_DEFAULT; }
  return EDITOR_THEMES[name] ? name : EDITOR_THEME_DEFAULT;
}
function applyEditorTheme(name){
  ToolSettings.set('theme', name);
  const t = EDITOR_THEMES[resolveThemeName(name)];
  const r = document.documentElement.style;
  Object.entries(t.vars).forEach(([k,v])=>r.setProperty(k,v));
}
/* Back-compat: map the old scheme+mode settings onto a named theme. */
function migrateThemePref(){
  if(ToolSettings.get('theme','')) return ToolSettings.get('theme','');
  const scheme=ToolSettings.get('scheme',''), mode=ToolSettings.get('mode','');
  if(!scheme && !mode) return EDITOR_THEME_DEFAULT;
  if(mode==='light') return 'paper';
  const map={ fuchsia:'midnight', ocean:'ocean', forest:'forest' };
  return map[scheme] || EDITOR_THEME_DEFAULT;
}
function loadToolTheme(){
  if(typeof loadCustomThemes==='function') loadCustomThemes();
  const sel=document.getElementById('tl-theme');
  const current=migrateThemePref();
  if(sel){
    sel.innerHTML = '<option value="system">Match system (light/dark)</option>' +
      Object.keys(EDITOR_THEMES).map(k=>`<option value="${k}">${EDITOR_THEMES[k].label}</option>`).join('');
    sel.value = current;
  }
  applyEditorTheme(current);
  const vm=document.getElementById('tl-viewmode'); if(vm) vm.value=ToolSettings.get('themeViewMode','grid');
  if(typeof renderThemeGrid==='function') renderThemeGrid();
}
/* #82: the theme selector's own dedicated section defaults to a grid of
   real preview swatches (mini mockups built from each theme's own vars,
   not just a name in a dropdown) instead of the plain <select> - a "List"
   view toggle switches back to that select for anyone who prefers it. Both
   views share the same underlying selection (applyEditorTheme), so picking
   one in either view updates the other. */
function setThemeViewMode(mode){ ToolSettings.set('themeViewMode', mode==='list'?'list':'grid'); renderThemeGrid(); }
function selectThemeFromGrid(key){
  const sel=document.getElementById('tl-theme'); if(sel) sel.value=key;
  applyEditorTheme(key);
  renderThemeGrid();
}
function renderThemeGrid(){
  const box=document.getElementById('theme-grid'); if(!box) return;
  const sel=document.getElementById('tl-theme');
  const mode=ToolSettings.get('themeViewMode','grid');
  box.style.display = mode==='grid' ? 'grid' : 'none';
  if(sel) sel.style.display = mode==='grid' ? 'none' : '';
  if(mode!=='grid') return;
  const current=migrateThemePref();
  const card=(key,label,vars)=>{
    const bg = vars ? vars['--body'] : 'linear-gradient(135deg,#f7f9fc 50%,#0f172a 50%)';
    const bar = vars ? (vars['--bar']||vars['--panel']) : '#94a3b8';
    const ws = vars ? vars['--workspace'] : 'transparent';
    const panel = vars ? vars['--panel'] : '#ffffff';
    const accent = vars ? vars['--accent'] : '#8b5cf6';
    return `<div class="theme-card${current===key?' current':''}" onclick="selectThemeFromGrid('${key}')" title="${escAttr(label)}">
      <div class="theme-card-preview" style="background:${bg}">
        <div class="theme-card-bar" style="background:${bar}"></div>
        <div class="theme-card-ws" style="background:${ws}">
          <div class="theme-card-panel" style="background:${panel}"></div>
          <div class="theme-card-accent" style="background:${accent}"></div>
        </div>
      </div>
      <div class="theme-card-label">${escHtml(label)}</div>
    </div>`;
  };
  box.innerHTML = card('system','Match system (light/dark)', null)
    + Object.keys(EDITOR_THEMES).map(k=>card(k, EDITOR_THEMES[k].label, EDITOR_THEMES[k].vars)).join('');
}
