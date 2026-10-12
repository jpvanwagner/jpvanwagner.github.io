'use strict';
/* ============================== CLIPBOARD FORM ==============================
   Using the clipboard on a feature opens its line on the move-out form: pick a condition, attach a photo,
   file it. In "immediate" feedback mode a filed mark is final and graded on the spot; in "end of shift"
   mode you can change your mind until you submit the report. */
const Mark = {
  fid: null, sel: null,
  open(fid) {
    if (isView(fid)) { const msg = `It's a window. A perfectly good one. Nothing to write up.`; if (UI.isOpen('inspectScreen')) Inspect.say(msg, 'clipboard'); else Game.tell(msg); return; }
    this.fid = fid; PhotoAsk.hide();
    const f = FEATURE[fid] || ANOMALY[fid], m = Game.marks[fid], locked = !!m && Settings.get('feedback') === 'now';
    this.sel = m ? m.cat : null;
    $('markName').textContent = f.name; $('markRoom').textContent = ROOMS[f.room].name.toUpperCase();
    const cats = $('markCats'); cats.querySelectorAll('label').forEach(l => l.remove());
    CATS.forEach((c, i) => {
      const lab = document.createElement('label'); lab.className = 'c' + i;
      const inp = document.createElement('input'); inp.type = 'radio'; inp.name = 'cat'; inp.value = i; inp.checked = this.sel === i; inp.disabled = locked;
      const txt = document.createElement('span');
      const l1 = document.createElement('span'); l1.className = 'lbl'; l1.textContent = i + ' · ' + c.name;
      const l2 = document.createElement('span'); l2.className = 'hint'; l2.textContent = c.hint;
      txt.append(l1, l2); lab.append(inp, txt);
      inp.addEventListener('change', () => { this.sel = i; this.sync(); Audio2.synth('pencil'); });
      cats.append(lab);
    });
    const notes = Game.notes[fid] || [], ul = $('markNotes');
    ul.replaceChildren(...(notes.length ? notes : ['No field notes yet. Look closer, touch, smell, measure...']).map((n, i) => { const li = document.createElement('li'); if (notes.length) li.append(SopLinks.linkify(n)); else { li.textContent = n; li.className = 'none'; } return li; }));
    $('markFile').textContent = locked ? 'Filed' : m ? 'Update' : 'File it';
    this.locked = locked; this.sync(); this.showPhoto();
    UI.open('markScreen'); Audio2.sfx('swish');
  },
  sync() {
    document.querySelectorAll('#markCats label').forEach(l => l.classList.toggle('sel', +l.querySelector('input').value === this.sel));
    $('markFile').disabled = this.sel === null || this.locked;
  },
  showPhoto() {
    const slot = $('markPhotoSlot'), url = Game.photos[this.fid];
    slot.replaceChildren();
    if (url) { const img = new Image(); img.src = url; img.alt = 'Your photo of the ' + truth(this.fid).name; slot.append(img); }
    else { const s = document.createElement('span'); s.textContent = 'NO PHOTO'; slot.append(s); }
    $('markTakePhoto').innerHTML = '<span class="ico ico-camera"></span> ' + (url ? 'Retake' : 'Take photo');
  },
  file() {
    if (this.sel === null || this.locked) return;
    UI.close('markScreen');
    Game.mark(this.fid, this.sel);
    if (UI.isOpen('inspectScreen')) Inspect.refresh();
  }
};

/* ============================== DIGITAL CAMERA ==============================
   A slim forest-green 2008 point-and-shoot, drawn as pixel art. The LCD shows the close-up (or, for anything that isn't a checklist feature,
   that part of the room), a little shaky. The shutter on top focuses, fires, and saves a small JPEG with the orange
   date stamp. Minus and plus zoom; playback pages through every shot with the pad's arrows; up (the trash can) then
   OK erases one. A photo of a checklist feature goes on its form line and into the report. Photos of things that turn out
   fine never count against you. */
/* ---------- the pocket camera: one shutter on top, a zoom ring (W/T, face detection, playback), DISP/BACK, and a 4-way pad around MENU/OK ---------- */
const LCD_H = 180, PIC_Y = 22;
const PLAY_ICON = '<svg class="oi" viewBox="0 0 10 10"><path d="M3 2v6l5-3z" class="fill"/></svg>';
const Camera = {
  fid: null, scene: null, busy: false, onDone: null, ix: -1,
  mode: 'rec', zoom: 1, pzoom: 1, pan: [0, 0], stab: true, stamp: true, quality: 0, flash: 'AUTO',   // the flash fires by itself in a dark room
  prompt: null, _msgT: 0, _cd: 0,
  open(fid, onDone) { this.fid = fid; this.scene = null; this.onDone = onDone; this.start('rec'); },
  openScene(h) { this.fid = null; this.scene = { box: h.box, name: h.name, id: h.kind === 'anomaly' ? h.id : null }; this.onDone = null; this.start('rec'); },
  roll() { this.fid = null; this.scene = null; this.onDone = null; this.start('play'); },
  live() { return !!(this.fid || this.scene); },
  start(mode) {
    this.sess = (this.sess || 0) + 1; this._hold = false; this.busy = false; this.prompt = null; this.zoom = 1; this.pzoom = 1; this.pan = [0, 0]; clearTimeout(this._cd);
    this.mode = this.live() ? mode : 'play'; this.ix = Game.gallery.length - 1;
    $('camDate').textContent = GAME_DATE; this.msg('');
    UI.open('cameraScreen'); Audio2.synth('blip'); this.sync();
    requestAnimationFrame(() => this.paint());
  },
  /* ---------- the body, as pixel art: a forest-green shell, a black screen, a few chunky buttons ---------- */
  _hov: null, _press: null,
  paint() {
    const cam = $('camBody'), cv = $('camArt'); if (!cam || !cv || !UI.isOpen('cameraScreen')) return;
    const R = cam.getBoundingClientRect(); if (!R.width || !cam.offsetWidth) return;
    const sc = R.width / cam.offsetWidth;                    // the camera may be mid-way through its slide-in, scaled
    const k = Math.max(2, Math.round(cam.offsetWidth / 150)), W = Math.ceil(cam.offsetWidth / k), H = Math.ceil(cam.offsetHeight / k);   // layout pixels per art pixel
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), C = { O: '#0b1a0e', D: '#173a20', B: '#24502c', L: '#3d7341', H: '#5f9658', s1: '#8f949c', s2: '#c3c7ce', s3: '#e6e8ec', ink: '#24272d', hov: '#f2b878', prs: '#d98a3e' };
    const box = el => { const r = el.getBoundingClientRect(), f = sc * k; return { x: Math.round((r.left - R.left) / f), y: Math.round((r.top - R.top) / f), w: Math.round(r.width / f), h: Math.round(r.height / f) }; };
    const rr = (b, rad, c) => { g.fillStyle = c; for (let y = 0; y < b.h; y++) { const d = y < rad ? rad - y - .5 : y >= b.h - rad ? y - (b.h - rad) + .5 : -1; const ins = d < 0 ? 0 : Math.round(rad - Math.sqrt(Math.max(0, rad * rad - d * d))); g.fillRect(b.x + ins, b.y + y, b.w - 2 * ins, 1); } };
    const inset = (b, n) => ({ x: b.x + n, y: b.y + n, w: b.w - 2 * n, h: b.h - 2 * n });
    const disc = (cx, cy, r, c) => { g.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); g.fillRect(cx - w, cy + y, 2 * w + 1, 1); } };
    const glyph = (rows, cx, cy, c, z = 1) => { g.fillStyle = c; const w = rows[0].length, h = rows.length, x0 = cx - Math.floor(w * z / 2), y0 = cy - Math.floor(h * z / 2);
      rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') g.fillRect(x0 + i * z, y0 + j * z, z, z); })); };
    const state = el => el.id && this._press === el.id ? 'prs' : el.id && this._hov === el.id ? 'hov' : null;
    const play = this.mode === 'play', photos = play && Game.gallery.length > 0;
    // power and shutter on top
    for (const id of ['camPower', 'camShutter']) {
      const el = $(id), b = box(el), st = state(el), t = { x: b.x, y: b.y + (st === 'prs' ? 1 : 0), w: b.w, h: b.h + 4 };
      rr(t, 2, C.O); rr(inset(t, 1), 1, st ? C[st] : C.s2); g.fillStyle = st ? '#ffe6c4' : C.s3; g.fillRect(t.x + 2, t.y + 1, t.w - 4, 1);
    }
    // the shell: outline, a shaded lower half, one shine along the top
    const body = box(cam.querySelector('.cam-shell'));
    rr(body, 5, C.O); rr(inset(body, 1), 4, C.D); rr({ x: body.x + 1, y: body.y + 1, w: body.w - 2, h: Math.round(body.h * .55) }, 4, C.B);
    g.fillStyle = C.H; g.fillRect(body.x + 5, body.y + 2, body.w - 10, 1);
    const sd = cam.querySelector('.cam-side');                // a plain grip along the left edge
    if (sd.offsetParent) { const b = box(sd); rr(b, 2, C.D); g.fillStyle = C.L; g.fillRect(b.x + 1, b.y + 2, 1, b.h - 4); }
    const bz = box(cam.querySelector('.cam-bezel')); rr(bz, 3, C.O); rr(inset(bz, 1), 2, '#141518');
    const led = box($('camLed')), lit = $('camLcd').classList.contains('focused');
    g.fillStyle = C.O; g.fillRect(led.x, led.y, 3, 3); g.fillStyle = lit ? '#9aff7a' : '#2f4a26'; g.fillRect(led.x + 1, led.y + 1, 1, 1);
    // a round green button, with a highlight; it lights up under the pointer and sinks when pressed
    const knob = (cx, cy, r, st, shine = true) => { const dy = st === 'prs' ? 1 : 0; disc(cx, cy + 1, r, C.O); disc(cx, cy + dy, r, C.O); disc(cx, cy + dy, r - 1, st ? C[st] : C.L); if (!st) disc(cx, cy + 1 + dy, r - 2, C.B); g.fillStyle = st ? '#fff0dc' : C.H; if (shine) g.fillRect(cx - Math.round(r * .45), cy - Math.round(r * .5) + dy, 2, 1); return dy; };
    const z = Math.max(1, Math.round(box($('camPlay')).w / 9));       // icon pixel size
    // zoom: a silver rocker, minus on the left, plus on the right
    for (const id of ['camW', 'camT']) {
      const el = $(id), b = box(el), st = state(el), left = id === 'camW';
      const t = { x: b.x, y: b.y + (st === 'prs' ? 1 : 0), w: b.w, h: b.h };
      rr({ ...t, y: t.y + 1 }, 3, C.O); rr(t, 3, C.O); rr(inset(t, 1), 2, st ? C[st] : C.s2); g.fillStyle = C.s3; g.fillRect(t.x + 3, t.y + 1, t.w - 6, 1);
      glyph(left ? ['###'] : ['.#.', '###', '.#.'], t.x + (t.w >> 1), t.y + (t.h >> 1), C.ink, z);
    }
    // playback: a green button with a white play arrow
    { const el = $('camPlay'), b = box(el), cx = b.x + (b.w >> 1), cy = b.y + (b.h >> 1), dy = knob(cx, cy, b.w >> 1, state(el), false);
      glyph(['#..', '##.', '###', '##.', '#..'], cx + 1, cy + dy, play ? '#fff6cc' : '#e8f2e0', z); }
    // the pad: a silver ring with arrows and a trash can, and OK in the middle. Its arrows only work in playback, so they're faint otherwise.
    const dial = cam.querySelector('.cam-dial'), db = box(dial), cx = db.x + (db.w >> 1), cy = db.y + (db.h >> 1), r = db.w >> 1;
    disc(cx, cy + 1, r, C.O); disc(cx, cy, r, C.O); disc(cx, cy, r - 1, C.s1); disc(cx, cy - 1, r - 2, C.s2);
    for (const seg of dial.querySelectorAll('.seg')) { const st = state(seg); if (st) { const q = box(seg); disc(q.x + (q.w >> 1), q.y + (q.h >> 1), Math.max(2, (q.w >> 1) - 1), C[st]); } }
    const ink = photos ? C.ink : '#a4a8b0', at = el => { const q = box(el); return [q.x + (q.w >> 1), q.y + (q.h >> 1)]; };
    let [x, y] = at($('camLeft')); glyph(['..#', '.##', '###', '.##', '..#'], x, y, ink, z);
    [x, y] = at($('camRight')); glyph(['#..', '##.', '###', '##.', '#..'], x, y, ink, z);
    [x, y] = at($('camUp')); glyph(['.###.', '#####', '.#.#.', '.#.#.', '.###.'], x, y, this.prompt ? '#c0270f' : ink, z);
    const hub = $('camOk'), hb = box(hub); knob(cx, cy, hb.w >> 1, state(hub));
  },

  /* the readouts on the screen */
  sync() {
    const play = this.mode === 'play', n = Game.gallery.length, e = Game.gallery[this.ix], cam = $('camBody');
    cam.classList.toggle('reviewing', play);
    $('camMode').innerHTML = play ? PLAY_ICON + (this.pzoom > 1 ? ` X${this.pzoom}` : '') : '';
    $('camShots').textContent = play ? (n ? `${this.ix + 1}/${n}` : '') : String(Math.max(0, 999 - 42 - Game.shots)).padStart(3, '0');
    $('camInfo').textContent = play && e ? e.label.toUpperCase() : '';
    const z = $('camZoom'); z.classList.toggle('on', !play && this.zoom > 1); z.firstChild.style.width = ((this.zoom - 1) / 2 * 100) + '%';
    if (this.prompt) this.msg('ERASE THIS PHOTO?\nOK TO ERASE. ANY OTHER BUTTON TO KEEP IT.', 0);
    if (play && !n && !this.prompt) this.msg('NO PHOTOS YET', 0);
    this.paint();
  },
  msg(text, secs = 1.4) {
    const el = $('camMsg'); el.textContent = text; el.classList.toggle('on', !!text);
    clearTimeout(this._msgT); if (text && secs) this._msgT = setTimeout(() => { el.classList.remove('on'); }, secs * 1000);
  },
  beep() { Audio2.synth('blip'); },
  cancel() { if (!this.prompt) return false; this.prompt = null; this.msg(''); this.beep(); this.sync(); return true; },   // any other button keeps the photo
  /* ---------- the controls: shutter, zoom, playback, and in playback previous / next / erase ---------- */
  shutter() {
    if (this.busy) return;
    if (this.mode === 'play') {                                  // like a real one: the shutter drops you back to shooting
      this.prompt = null; this.msg('');
      if (this.live()) { this.mode = 'rec'; this.beep(); this.sync(); } else this.msg('NOTHING TO SHOOT. LOOK AT SOMETHING FIRST.');
      return;
    }
    this.snap();
  },
  zoomBy(d) {
    if (this.cancel()) return;
    if (this.mode === 'rec') { const z = clamp(this.zoom + d * .5, 1, 3); if (z !== this.zoom) { this.zoom = z; Audio2.synth('focus'); } }
    else if (Game.gallery.length) { this.pzoom = clamp(this.pzoom + d, 1, 4); if (this.pzoom === 1) this.pan = [0, 0]; this.beep(); }
    this.sync();
  },
  playback() {
    if (this.busy) return;
    this.prompt = null; this.msg('');
    if (this.mode === 'rec') { this.mode = 'play'; this.ix = Game.gallery.length - 1; this.pzoom = 1; this.pan = [0, 0]; }
    else if (this.live()) this.mode = 'rec';
    this.beep(); this.sync();
  },
  ok() {
    if (this.busy) return;
    if (this.prompt === 'erase') { this.prompt = null; this.msg(''); return this.erase(); }
    if (this.mode === 'play' && this.pzoom > 1) { this.pzoom = 1; this.pan = [0, 0]; this.beep(); this.sync(); }
  },
  pad(dir) {                                                      // the arrows around OK only do anything in playback
    if (this.busy || this.mode !== 'play' || this.cancel()) return;
    if (this.pzoom > 1) { const k = 30 / this.pzoom; this.pan[0] = clamp(this.pan[0] + (dir === 'left' ? -k : dir === 'right' ? k : 0), -120, 120); this.pan[1] = clamp(this.pan[1] + (dir === 'up' ? -k : dir === 'down' ? k : 0), -68, 68); return this.sync(); }
    if (dir === 'left') this.step(-1); else if (dir === 'right') this.step(1);
    else if (dir === 'up' && Game.gallery.length) { this.prompt = 'erase'; this.beep(); this.sync(); }
  },
  step(d) {
    const n = Game.gallery.length; if (!n) return;
    this.ix = (this.ix + d + n) % n; this.pzoom = 1; this.pan = [0, 0]; this.beep(); this.sync();
  },
  erase() {
    if (!Game.gallery.length) return;
    const [e] = Game.gallery.splice(this.ix, 1); Audio2.synth('wrong');
    if (e.fid && Game.photos[e.fid] === e.url) {                 // it was on the form: fall back to another shot of the same thing
      const other = Game.gallery.filter(x => x.fid === e.fid).pop();
      if (other) Game.photos[e.fid] = other.url; else delete Game.photos[e.fid];
      if (UI.isOpen('markScreen')) Mark.showPhoto();
      if (UI.isOpen('inspectScreen')) Inspect.refresh();
    }
    this.ix = Math.min(this.ix, Game.gallery.length - 1); this.msg('ERASED', .8); this.sync();
  },
  back() { this.power(); },
  power() { clearTimeout(this._cd); this.busy = false; UI.close('cameraScreen'); this.fid = this.scene = null; },
  /* ---------- the picture ---------- */
  dark() { const r = ROOMS[Game.room]; return !!(r && r.lightsOff); },
  frame(g, t, shaky) {
    const amp = shaky && Settings.get('motion') ? (this.stab ? .5 : 1.6) : 0, dx = Math.round(Math.sin(t * 2.1) * amp), dy = Math.round(Math.cos(t * 1.7) * amp * .8);
    const z = this.zoom, cw = ZW / z, ch = ZH / z, cx = (ZW - cw) / 2, cy = (ZH - ch) / 2;
    const src = this._s || (this._s = document.createElement('canvas')); src.width = ZW; src.height = ZH;
    const sg = src.getContext('2d'); sg.imageSmoothingEnabled = false; sg.fillStyle = '#000'; sg.fillRect(0, 0, ZW, ZH);
    if (this.fid) {
      const f = FEATURE[this.fid], zc = this._z || (this._z = document.createElement('canvas'));
      zc.width = ZW; zc.height = ZH; drawZoom(zc.getContext('2d'), f, Game.cond[f.id], Game.flags[f.id], t);
      sg.drawImage(zc, -4 + dx, -2 + dy, ZW + 8, ZH + 5);
    } else if (this.scene) {                                   // that part of the room, framed 16:9, with nobody standing in the way
      const b = this.scene.box, w = clamp((b.x1 - b.x0) * 2.2, 96, SW), h = w * 9 / 16;
      const sx = clamp((b.x0 + b.x1) / 2 - w / 2, 0, SW - w), sy = clamp((b.y0 + b.y1) / 2 - h / 2, 0, SH - h);
      const rc = this._r || (this._r = document.createElement('canvas')); rc.width = SW; rc.height = SH;
      const rg = rc.getContext('2d'); rg.imageSmoothingEnabled = false; Rooms.draw(rg, Game.room, t); Rooms.overlay(rg, Game.room, t);
      sg.drawImage(rc, sx + dx * .3, sy + dy * .3, w, h, 0, 0, ZW, ZH);
    }
    g.imageSmoothingEnabled = false; g.drawImage(src, cx, cy, cw, ch, 0, 0, ZW, ZH);
  },
  render(t) {
    const g = $('camCanvas').getContext('2d'); g.imageSmoothingEnabled = false;
    if (this.busy && this._hold) return;
    g.fillStyle = '#000'; g.fillRect(0, 0, ZW, LCD_H);
    if (this.mode === 'play') {
      const e = Game.gallery[this.ix]; if (!e) return;
      if (!e.img) { e.img = new Image(); e.img.src = e.url; }
      if (!e.img.complete) return;
      const z = this.pzoom, w = ZW / z, h = ZH / z, sx = clamp((ZW - w) / 2 + this.pan[0], 0, ZW - w), sy = clamp((ZH - h) / 2 + this.pan[1], 0, ZH - h);
      g.drawImage(e.img, sx, sy, w, h, 0, PIC_Y, ZW, ZH); return;
    }
    g.save(); g.translate(0, PIC_Y); this.frame(g, t, true); g.restore();
    speckle(g, 0, PIC_Y, ZW, ZH, 'rgba(255,255,255,0.08)', 160, Math.floor(t * 30));
    if (this.dark() && this.flash === 'OFF') { g.fillStyle = 'rgba(0,0,10,0.45)'; g.fillRect(0, PIC_Y, ZW, ZH); }
  },
  snap() {
    if (this.busy || !this.live() || this.mode !== 'rec') return;
    this.busy = true;
    const sess = this.sess, fid = this.fid, scene = this.scene, onDone = this.onDone;   // this shot's subject, even if the camera gets reopened meanwhile
    const lcd = $('camLcd'); lcd.classList.add('focused'); Audio2.synth('focus'); this.paint();
    setTimeout(() => {
      if (this.sess !== sess || !UI.isOpen('cameraScreen')) { lcd.classList.remove('focused'); if (this.sess === sess) this.busy = false; return; }   // put away mid-focus
      Audio2.synth('shutter');
      const fires = this.flash === 'ON' || (this.flash === 'AUTO' && this.dark());
      if (Settings.get('motion')) { const fl = $('camFlash'); fl.classList.toggle('bright', fires); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
      // the saved photo: the scene, a touch of grain and warmth, the flash if it fired, and the date stamp
      const c = document.createElement('canvas'); c.width = ZW; c.height = ZH;
      const g = c.getContext('2d'); this.frame(g, Game.t, !this.stab);
      g.fillStyle = 'rgba(255,240,210,0.08)'; g.fillRect(0, 0, ZW, ZH);
      if (fires) { const rg = g.createRadialGradient(ZW / 2, ZH / 2, 10, ZW / 2, ZH / 2, ZW * .7); rg.addColorStop(0, 'rgba(255,255,255,0.22)'); rg.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = rg; g.fillRect(0, 0, ZW, ZH); }
      else if (this.dark()) { g.fillStyle = 'rgba(0,0,10,0.45)'; g.fillRect(0, 0, ZW, ZH); }
      speckle(g, 0, 0, ZW, ZH, 'rgba(0,0,0,0.12)', 500, 7);
      if (this.stamp) { g.font = "8px 'Silkscreen', monospace"; g.textAlign = 'right'; g.fillStyle = '#5a2400'; g.fillText(GAME_DATE, ZW - 5, ZH - 5); g.fillStyle = '#ff9a3a'; g.fillText(GAME_DATE, ZW - 6, ZH - 6); }
      const url = c.toDataURL('image/jpeg', [.85, .7, .55][this.quality]); Game.shots++;
      const pid = fid || scene.id;
      Game.gallery.push({ fid: pid, label: fid ? FEATURE[fid].name : scene.name, url, n: 42 + Game.shots });
      if (pid) Game.photos[pid] = url;
      if (fid && Birds.visible(fid, Game.t)) Achievements.unlock(fid === 'bwindow' ? 'bigfoot' : 'birder', fid === 'bwindow' ? '' : `A ${Birds.kind(fid, Game.t)}, at the ${lower(FEATURE[fid].name)}.`);
      if (Game.shots >= 20) Achievements.unlock('shutterbug');
      const lg = $('camCanvas').getContext('2d'); lg.fillStyle = '#000'; lg.fillRect(0, 0, ZW, LCD_H); lg.drawImage(c, 0, PIC_Y); this._hold = true;   // image display, like the real thing
      this.msg(`${String(100 + 42 + Game.shots)}-${String(42 + Game.shots).padStart(4, '0')}`, 0);
      lcd.classList.remove('focused'); this.paint();
      setTimeout(() => {
        if (this.sess === sess) { this._hold = false; this.msg(''); this.busy = false; UI.close('cameraScreen'); this.fid = this.scene = null; }
        if (UI.isOpen('markScreen')) Mark.showPhoto();
        if (UI.isOpen('inspectScreen')) { Inspect.refresh(); Inspect.say('Snap. You take a photo for the report.', 'camera'); }
        else if (!fid) Game.tell(`Snap. A photo of the ${lower(scene.name)}, for the file.`);
        if (onDone) onDone(); else PhotoAsk.offer(pid);         // offer to write it up, unless the form asked for this photo
      }, 1300);
    }, 280);
  }
};
