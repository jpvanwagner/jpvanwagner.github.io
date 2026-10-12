'use strict';
/* ============================== SPRITE SHEET EXPORT ==============================
   Open the game with ?sheets on the end of the address to get the characters and the left-behind items as PNG
   sprite sheets, each with a JSON file in Aseprite's own sprite-sheet format (frames, plus tags for the
   animations). Aseprite opens them with File > Import Sprite Sheet; the JSON is what Aseprite itself writes with
   File > Export Sprite Sheet, so the round trip works. Nothing here runs during a normal game. */
const SpriteSheets = {
  /* lay frames out in a row: [{ name, canvas, tag }] -> { png (data URL), json } */
  pack(image, frames, pad = 1) {
    const w = frames.reduce((a, f) => a + f.canvas.width + pad, pad), h = Math.max(...frames.map(f => f.canvas.height)) + pad * 2;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    let x = pad; const list = [], tags = [];
    frames.forEach((f, i) => {
      g.drawImage(f.canvas, x, pad);
      const fw = f.canvas.width, fh = f.canvas.height;
      list.push({ filename: f.name, frame: { x, y: pad, w: fw, h: fh }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: fw, h: fh }, sourceSize: { w: fw, h: fh }, duration: f.ms || 100 });
      if (f.tag) { const t = tags.find(t => t.name === f.tag); if (t) t.to = i; else tags.push({ name: f.tag, from: i, to: i, direction: 'forward', color: '#000000ff' }); }
      x += fw + pad;
    });
    const json = { frames: list, meta: { app: 'https://www.aseprite.org/', version: '1.3', image, format: 'RGBA8888', size: { w, h }, scale: '1', frameTags: tags, layers: [{ name: 'Layer 1', opacity: 255, blendMode: 'normal' }], slices: [] } };
    return { png: c.toDataURL('image/png'), json: JSON.stringify(json, null, 1) };
  },
  characters() {                         // only the poses each person really uses, plus their idle (breathing), blink, talk, and walk
    const POSES = { you: ['clip'], dana: ['phone', 'point', 'pointUp'], mgr: [] }, frames = [];
    for (const who of ['you', 'dana', 'mgr']) {
      frames.push({ name: `${who} idle 0`, canvas: Sprites.get(who, {}), tag: `${who} idle`, ms: 1100 }, { name: `${who} idle 1`, canvas: Sprites.get(who, { breath: true }), tag: `${who} idle`, ms: 1100 });
      frames.push({ name: `${who} blink`, canvas: Sprites.get(who, { blink: true }), tag: `${who} blink`, ms: 130 });
      frames.push({ name: `${who} talk 0`, canvas: Sprites.get(who, { talk: true }), tag: `${who} talk`, ms: 125 }, { name: `${who} talk 1`, canvas: Sprites.get(who, {}), tag: `${who} talk`, ms: 125 });
      for (const [i, step] of [0, .5, 1, .5, 0, -.5, -1, -.5].entries()) frames.push({ name: `${who} walk ${i}`, canvas: Sprites.get(who, { walk: true, step, bob: Math.abs(step) > .7 ? -1 : 0 }), tag: `${who} walk`, ms: 90 });
      for (const pose of POSES[who]) frames.push({ name: `${who} ${pose}`, canvas: Sprites.get(who, { pose }), tag: `${who} ${pose}` });
    }
    return this.pack('characters.png', frames);
  },
  items() {
    const frames = Object.entries(ITEM_SPRITES).map(([k, rows]) => ({ name: k, canvas: spriteCanvas(rows, SPR_PAL), tag: k }));
    frames.push({ name: 'tie', canvas: spriteCanvas(SPR_TIE, SPR_PAL), tag: 'tie' }, { name: 'tie draped', canvas: spriteCanvas(SPR_TIE_DRAPE, SPR_PAL), tag: 'tie draped' }, { name: 'tie small', canvas: spriteCanvas(SPR_TIE_HANG, SPR_PAL), tag: 'tie small' });
    return this.pack('items.png', frames);
  },
  /* the ?sheets page: download links for each file */
  show() {
    const out = { characters: this.characters(), items: this.items() }, box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:20px;z-index:99999;background:#1b1728;color:#fff;padding:20px;overflow:auto;font:14px sans-serif';
    box.innerHTML = '<h2>Sprite sheets for Aseprite</h2><p>Each PNG comes with a JSON file in Aseprite\'s sprite-sheet format.</p>';
    for (const [name, s] of Object.entries(out)) {
      const p = document.createElement('p'), img = new Image(); img.src = s.png; img.style.cssText = 'image-rendering:pixelated;width:' + 4 * 100 + '%;max-width:100%;background:#776;display:block;margin:8px 0';
      const a1 = Object.assign(document.createElement('a'), { href: s.png, download: name + '.png', textContent: name + '.png' });
      const a2 = Object.assign(document.createElement('a'), { href: 'data:application/json;charset=utf-8,' + encodeURIComponent(s.json), download: name + '.json', textContent: name + '.json' });
      a1.style.color = a2.style.color = '#ff8ad0'; p.append(a1, ' · ', a2, img); box.append(p);
    }
    document.body.append(box); this.out = out;
  }
};
if (/[?&]sheets\b/.test(location.search)) addEventListener('load', () => setTimeout(() => SpriteSheets.show(), 300));
