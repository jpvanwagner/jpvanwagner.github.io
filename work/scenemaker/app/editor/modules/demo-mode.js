/* ============================================================================
   Scenemaker editor; standalone portfolio/demo mode
   NOT part of the real app - app.py / app_native.py never add this script
   tag, and a normal checkout never loads it. Only the separate standalone
   demo export (built for static hosting, e.g. a Neocities portfolio) adds
   an extra <script src="modules/demo-mode.js"></script> at the end of its
   own copy of editor.html, after every other script. Its whole job:

     1. Flip on SCENEMAKER_NO_SERVER (see HAS_SERVER() in core.js) so every
        server-only feature (Save/Open/SCORM export/EXE export) degrades to
        its OWN already-built browser-only fallback - a local file download,
        a local file picker, or a friendly "needs the local helper, grab the
        real app" message - instead of looking connected and then silently
        failing against an /api/* route that was never there on static
        hosting.
     2. Give Preview a genuinely working fallback instead of just that
        message, since actually trying the thing is the whole point of a
        demo: it reuses the exact single-file export Export -> Embeddable
        HTML already builds client-side (buildLiteExportHtml(), no server
        involved) and opens it in the same app-like popup window the real
        Preview does.
     3. Add a small, unobtrusive credit line to the bottom of every HTML
        export actually made this way (Export -> Embeddable HTML's Copy/
        Download/Preview, which all funnel through buildLiteExportHtml() -
        this is the ONLY export that can ever produce real output in the
        browser-only demo; SCORM/EXE/the Overlay embed all need the local
        helper per #1 above, so they never reach this). Wraps the function
        rather than touching lite-export.js itself, so the real app's own
        export carries no demo-only text.
     4. Add a small, unobtrusive "this is a demo" corner badge linking back
        to the real project on GitHub.

   Shares core.js/lite-export.js scope, like every other module.
   ==========================================================================*/
window.SCENEMAKER_NO_SERVER = true;

const _demoRealBuildLiteExportHtml = buildLiteExportHtml;
buildLiteExportHtml = function(opts){
  const html = _demoRealBuildLiteExportHtml(opts);
  const credit = '<div style="position:fixed;right:6px;bottom:4px;z-index:9999;'
    + 'font:11px system-ui,sans-serif;color:#94a3b8;background:rgba(15,17,24,.55);'
    + 'padding:2px 6px;border-radius:4px;pointer-events:none">Made with '
    + '<a href="https://jvanwagner.neocities.org/pages/project-scenemaker.html" target="_blank" '
    + 'rel="noopener" style="color:#f472b6;pointer-events:auto">Scenemaker</a></div>';
  return html.replace('</body>', credit + '</body>');
};

async function doPreview(){
  if(!Object.keys(scenes).length){ toast('Add a scene first'); return; }
  if(!project.settings.startScene){ toast('Set a start scene in ⚙️ SETTINGS first'); return; }
  _showPreviewLoading(true);
  try{
    const html = buildLiteExportHtml();
    const win = window.open('about:blank', '_blank', (typeof _previewPopupFeatures==='function') ? _previewPopupFeatures() : '');
    if(!win){ toast('Your browser blocked the preview popup; allow popups for this site and try again'); return; }
    win.document.write(html);
    win.document.close();
  }catch(err){
    toast('Preview failed: '+err.message);
  }finally{
    setTimeout(()=>_showPreviewLoading(false), 200);
  }
}

function _demoBadgeHtml(){
  return '<div id="demo-badge" style="position:fixed;left:10px;bottom:10px;z-index:9000;'
    + 'font:12px system-ui,sans-serif;background:rgba(15,17,24,.92);color:#f1f5f9;'
    + 'border:1px solid #3d4152;border-radius:8px;padding:8px 12px;box-shadow:0 6px 20px rgba(0,0,0,.4);'
    + 'display:flex;align-items:center;gap:10px;max-width:300px">'
    + '<span style="line-height:1.4">👾 <b>Portfolio demo</b>, runs fully in your browser. '
    + 'Full desktop app (SCORM export, native saves, more) on '
    + '<a href="https://github.com/Nostalginaut/TOOL-Scenemaker" target="_blank" rel="noopener" style="color:#f472b6">GitHub</a>.</span>'
    + '<span onclick="document.getElementById(\'demo-badge\').style.display=\'none\'" '
    + 'style="cursor:pointer;opacity:.6;align-self:flex-start" title="Dismiss">✕</span>'
    + '</div>';
}
window.addEventListener('load', ()=>{
  const host=document.createElement('div');
  host.innerHTML=_demoBadgeHtml();
  document.body.appendChild(host.firstElementChild);
});
