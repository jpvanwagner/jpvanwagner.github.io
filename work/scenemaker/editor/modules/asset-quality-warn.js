/* ============================================================================
   Scenemaker editor; warn when a background image is too low-resolution for
   the stage it's being stretched to fill (#66). Every scene/title background
   fills the whole canvas (CSS background-size:cover, no cropping controls of
   its own), so an image imported well below the project's own design
   resolution (CANVAS_SIZES via ceCanvasSizeOf, project-settings.js - the same
   reference every layout's percentage math is already built against) gets
   silently upscaled past the point it still looks sharp. Checked once, right
   when a background is actually assigned (never live/continuously - nothing
   here re-checks on its own if the canvas size changes later). Video
   backgrounds are out of scope for this pass (a meaningfully different check,
   loading video metadata instead of an <img>). Shares core.js scope.
   ==========================================================================*/
const ASSET_STRETCH_LIMIT = 1.3;
function assetQualityWarnOff(){ return (typeof ToolSettings!=='undefined') && ToolSettings.get('assetQualityWarnOff','0')==='1'; }
function setAssetQualityWarn(on){ if(typeof ToolSettings!=='undefined') ToolSettings.set('assetQualityWarnOff', on?'0':'1'); }
/* the larger of the two axes' required upscale factor - a very wide but
   short image can still need heavy stretching on just its height, and vice
   versa, so either axis alone can trigger the warning. */
function _assetStretchRatio(naturalW, naturalH, targetW, targetH){
  if(!naturalW || !naturalH) return 0;
  return Math.max(targetW/naturalW, targetH/naturalH);
}
/* the synchronous half - given dimensions already known (real load callback,
   or a test double), decide whether to show the warning. Split out from
   checkBgStretch() below purely so it's callable (and testable) without a
   real decoded image, which jsdom can't provide. */
function _offerBgStretchWarning(nw, nh, ref, revertFn){
  if(!nw || !nh) return false;
  const ratio = _assetStretchRatio(nw, nh, ref.w, ref.h);
  if(ratio <= ASSET_STRETCH_LIMIT) return false;
  uiConfirm(`This background is <b>${nw}×${nh}px</b>, but the stage is designed at <b>${ref.w}×${ref.h}px</b> - it'll be stretched about <b>${ratio.toFixed(1)}×</b> to fill the screen and may look soft or pixelated. Use it anyway?`,
    ()=>{},
    { yes:'Use it anyway', no:'Remove it',
      onNo:()=>{ if(typeof revertFn==='function') revertFn(); },
      checkbox:{ label:'Don’t warn me again (re-enable in Settings → Workspace)',
                 onChecked:()=>{ setAssetQualityWarn(false); } } });
  return true;
}
function checkBgStretch(mediaKey, revertFn){
  if(assetQualityWarnOff()) return;
  if(!mediaKey || typeof document==='undefined' || typeof Image==='undefined') return;
  const url = (typeof mediaURL==='function') ? mediaURL(mediaKey) : ''; if(!url) return;
  const img = new Image();
  img.onload=()=>{
    const ref = (typeof ceCanvasSizeOf==='function') ? ceCanvasSizeOf() : {w:1000,h:640};
    _offerBgStretchWarning(img.naturalWidth, img.naturalHeight, ref, revertFn);
  };
  img.onerror=()=>{};
  img.src=url;
}
