/* ============================================================================
   Scenemaker editor; startup dependency check
   A brief loading screen shown once per launch, right before the start
   screen (or a restored tab) appears: pings the local server/native bridge
   for what's actually installed/present - pywebview (the native, no-browser-
   chrome window; app_native.py) and PyInstaller (the "export a standalone
   executable" button), both truly optional extras, PLUS tailwind_css
   (editor/vendor/tailwind.css, deps.py's own docstring explains why it's
   different: a regression guard, not an optional extra - it's what lets the
   editor's own base styling work with zero internet connection; see
   docs/eisenhower-matrix.md) - and offers a real, in-UI, one-click install
   (with a progress indicator) for anything missing, no terminal involved.
   When everything's already installed/present (the common, every-later-
   launch case) this is just a brief "checking..." flash before continuing;
   when there's no backend to check at all (a bare file:// open of
   editor.html, neither a server nor the native bridge) it's skipped
   entirely, since there's nothing to check or install.

   pywebview is never listed while running INSIDE the native bridge already
   (HAS_BRIDGE()) - at that point pywebview is obviously already installed,
   there's nothing to check or offer for it. When missing entirely (running
   over app.py's own browser fallback, per app_native.py's own
   _missing_webview_fallback()), this is the ONE place that offers to
   install it, in-UI - app_native.py itself can't show an in-page prompt for
   that case, since pywebview being missing is exactly what stops it from
   having a window to show one in.

   Shares core.js's global scope like every other module.
   ==========================================================================*/
const DEP_INFO = {
  pywebview:   { label: 'pywebview', hint: 'Needed for the native window (no browser chrome). Restart Scenemaker via its native launcher after installing.' },
  pyinstaller: { label: 'PyInstaller', hint: 'Needed to export a standalone executable.' },
  tailwind_css: { label: 'Editor base styling (offline)', hint: 'A file this install is missing; until it’s regenerated, the editor needs an internet connection to fully style itself. Needs Node.js/npm on this machine (Scenemaker itself only ever needs Python).' },
};

function _depsOverlayDom(){
  let o = document.getElementById('deps-check');
  if(o) return o;
  o = document.createElement('div'); o.id = 'deps-check'; o.className = 'modal-bg hidden';
  // No project-wide generic ".hidden{display:none}" utility class exists
  // (every hidden toggle elsewhere is scoped to a specific selector, e.g.
  // ".modal-bg.hidden"); these new pieces just toggle inline style.display
  // directly instead of relying on one that isn't there.
  o.innerHTML = `<div class="modal-card" style="width:420px">
      <div style="padding:20px 20px 4px;text-align:center">
        <h2 id="deps-title" style="margin:0 0 10px">Checking Scenemaker's setup&hellip;</h2>
        <div class="pl-bar" id="deps-spin"><div class="pl-fill"></div></div>
      </div>
      <div id="deps-rows" style="padding:6px 20px"></div>
      <div class="modal-foot" id="deps-foot" style="display:none">
        <button class="tb-btn" id="deps-skip">Continue without installing</button>
        <button class="tb-btn tb-accent" id="deps-continue">Continue</button>
      </div>
    </div>`;
  document.body.appendChild(o);
  return o;
}

function _depsRowHtml(key){
  const info = DEP_INFO[key];
  return `<div class="dep-row" id="dep-row-${key}" style="padding:8px 0;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px">
    <div style="flex:1;min-width:0">
      <b>${info.label}</b>
      <div class="hint" style="margin-top:2px">${info.hint}</div>
      <div class="pl-bar" id="dep-progress-${key}" style="margin-top:6px;display:none"><div class="pl-fill"></div></div>
      <div id="dep-status-${key}" style="font-size:12px;color:var(--mut);margin-top:2px"></div>
    </div>
    <button class="tb-btn" id="dep-btn-${key}" onclick="_depsInstall('${key}')">Install</button>
  </div>`;
}

let _depsPending = {};

// Testable in isolation from the actual environment/backend detection -
// takes what it already knows (nativeMode) rather than re-deriving it, so a
// test can drive either branch directly by stubbing window.pywebview.api or
// fetch, matching the pattern every other native-vs-server call in this
// codebase already uses (see doExportExe).
async function _depsCheckAll(nativeMode){
  if(nativeMode){
    if(window.pywebview.api.check_deps) return await window.pywebview.api.check_deps();
    return { pyinstaller: { installed: false }, tailwind_css: { installed: false } };
  }
  try{
    const res = await fetch('/api/check_deps');
    const j = await res.json();
    return j.deps || null;
  }catch(e){ return null; }
}

// #startup-check: called once from core.js's window 'load' handler, right
// before it would otherwise show the start screen or restore tabs; `next`
// is exactly that "proceed with the normal startup" continuation.
function runDependencyCheck(next){
  const nativeMode = HAS_BRIDGE();
  if(!nativeMode && !HAS_SERVER()){ next(); return; } // nothing to check without a backend
  const o = _depsOverlayDom();
  o.classList.remove('hidden');
  const started = Date.now();
  const MIN_SHOW_MS = 300; // a genuine, deliberate flash even in the all-good case, not an imperceptible blink
  _depsCheckAll(nativeMode).then(deps => {
    const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - started));
    setTimeout(() => _depsShowResult(o, deps, nativeMode, next), wait);
  });
}

function _depsShowResult(o, deps, nativeMode, next){
  const keys = Object.keys(DEP_INFO).filter(k => !(k === 'pywebview' && nativeMode));
  const missing = deps ? keys.filter(k => deps[k] && !deps[k].installed) : [];
  if(!missing.length){ o.classList.add('hidden'); next(); return; }
  document.getElementById('deps-title').textContent = missing.length===1 ? "One thing needs attention" : "A few things need attention";
  document.getElementById('deps-spin').style.display = 'none';
  document.getElementById('deps-rows').innerHTML = missing.map(_depsRowHtml).join('');
  document.getElementById('deps-foot').style.display = '';
  const finish = () => { o.classList.add('hidden'); next(); };
  document.getElementById('deps-skip').onclick = finish;
  document.getElementById('deps-continue').onclick = finish;
}

async function _depsInstall(key){
  if(_depsPending[key]) return;
  _depsPending[key] = true;
  const btn = document.getElementById('dep-btn-' + key);
  const prog = document.getElementById('dep-progress-' + key);
  const status = document.getElementById('dep-status-' + key);
  btn.disabled = true; btn.textContent = 'Installing…';
  prog.style.display = '';
  status.textContent = '';
  let r;
  try{
    if(HAS_BRIDGE()){
      // pywebview can never be installed FROM native mode - you're already
      // running inside it by the time this could show; every other key has
      // a matching bridge method that does the real work, same shape as the
      // fetch endpoints below.
      if(key === 'pywebview') r = { ok: false, log: 'not applicable while already running natively' };
      else if(key === 'pyinstaller') r = await window.pywebview.api.install_pyinstaller();
      else if(key === 'tailwind_css') r = await window.pywebview.api.install_tailwind_css();
    } else {
      const ep = { pywebview: '/api/install_pywebview', pyinstaller: '/api/install_pyinstaller', tailwind_css: '/api/install_tailwind_css' }[key];
      const res = await fetch(ep, { method: 'POST' });
      r = await res.json();
    }
  }catch(e){ r = { ok: false, log: e.message }; }
  prog.style.display = 'none';
  if(r && r.ok){
    btn.textContent = 'Installed ✓'; btn.disabled = true;
    status.textContent = key === 'pywebview' ? 'Restart Scenemaker via the native launcher to use it.' : 'Ready to use.';
  } else {
    btn.textContent = 'Retry'; btn.disabled = false;
    // r.log is pip's own tail (see build_exe.install_pyinstaller/deps.install_pywebview) -
    // same field name doExportExe's own PyInstaller-install-offer toast already reads;
    // trimmed here (unlike that transient toast) since this status text stays on screen.
    const logTail = (r && r.log) ? String(r.log).slice(-300) : '';
    status.textContent = 'Install failed' + (logTail ? (': ' + logTail) : '') + '.';
  }
  _depsPending[key] = false;
}
