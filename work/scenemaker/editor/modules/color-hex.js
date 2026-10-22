/* ============================================================================
   Scenemaker editor; hex color code entry (feature #61)
   Pairs a plain text hex field with every native <input type="color"> swatch
   in the editor, so exact/pasted hex values can be typed instead of only
   picked from the browser's own color-picker UI. Deliberately dumb: the hex
   field never knows what a given swatch is FOR (a scene color, a character
   color, a canvas text color...) - it just keeps its sibling color input's
   value in sync and re-dispatches that input's own "input" event, so
   whatever handler is already wired to the swatch fires exactly as if the
   user had picked that color natively. Shares core.js scope.
   ==========================================================================*/
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(raw){
  const m = HEX_RE.exec(String(raw||'').trim());
  if(!m) return null;
  let h = m[1];
  if(h.length===3) h = h.split('').map(c=>c+c).join('');
  return '#'+h.toLowerCase();
}

/* Markup helper: an <input type="color"> tag already has its own oninput
   wired up by the caller; this appends the paired hex field right after it.
   Usage: `<input type="color" ...>${hexFieldHtml('#334155')}` */
function hexFieldHtml(value){
  return `<input type="text" class="hex-field" maxlength="7" placeholder="#rrggbb" value="${escAttr(normalizeHex(value)||value||'')}" oninput="hexSyncToColor(this)" title="Type a hex color code, e.g. #ff5599">`;
}

/* Wire this into the color swatch's own oninput, e.g.:
   oninput="setSceneColor('${n.id}',this.value); hexSyncFromColor(this)" */
function hexSyncFromColor(colorEl){
  const hex = colorEl && colorEl.nextElementSibling;
  if(hex && hex.classList && hex.classList.contains('hex-field')){ hex.value = colorEl.value; hex.classList.remove('hex-invalid'); }
}

function hexSyncToColor(hexEl){
  const norm = normalizeHex(hexEl.value);
  const colorEl = hexEl.previousElementSibling;
  if(!norm || !colorEl || colorEl.type!=='color'){ hexEl.classList.add('hex-invalid'); return; }
  hexEl.classList.remove('hex-invalid');
  colorEl.value = norm;
  colorEl.dispatchEvent(new Event('input', {bubbles:true}));
}
