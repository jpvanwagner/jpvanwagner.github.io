'use strict';
/* ============================== CLIPBOARD FORM ==============================
   Using the clipboard on a feature opens its line on the move-out form: pick a condition, attach a photo,
   file it. In "immediate" feedback mode a filed mark is final and graded on the spot; in "end of shift"
   mode you can change your mind until you submit the report. */
const Mark = {
  fid: null, sel: null,
  open(fid) {
    this.fid = fid;
    const f = FEATURE[fid], m = Game.marks[fid], locked = !!m && Settings.get('feedback') === 'now';
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
    ul.replaceChildren(...(notes.length ? notes : ['No field notes yet. Look closer, touch, smell, measure...']).map((n, i) => { const li = document.createElement('li'); li.textContent = n; if (!notes.length) li.className = 'none'; return li; }));
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
    if (url) { const img = new Image(); img.src = url; img.alt = 'Your photo of the ' + FEATURE[this.fid].name; slot.append(img); }
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
   A silver 2008 point-and-shoot. The LCD shows the close-up, a little shaky; SNAP focuses, flashes and
   saves a small JPEG with the orange date stamp, which goes on the form and into the report. */
const Camera = {
  fid: null, busy: false, onDone: null,
  open(fid, onDone) {
    this.fid = fid; this.onDone = onDone; this.busy = false;
    $('camSaved').classList.remove('on'); $('camDate').textContent = GAME_DATE;
    $('camShots').textContent = String(42 + Game.shots).padStart(3, '0');
    UI.open('cameraScreen'); Audio2.synth('blip');
  },
  frame(g, t, shaky) {
    const f = FEATURE[this.fid], z = this._z || (this._z = document.createElement('canvas'));
    z.width = ZW; z.height = ZH; drawZoom(z.getContext('2d'), f, Game.cond[f.id], Game.flags[f.id], t);
    g.imageSmoothingEnabled = false; g.fillStyle = '#000'; g.fillRect(0, 0, ZW, ZH);
    const dx = shaky && Settings.get('motion') ? Math.round(Math.sin(t * 2.1) * 1.2) : 0, dy = shaky && Settings.get('motion') ? Math.round(Math.cos(t * 1.7) * 1) : 0;
    g.drawImage(z, -4 + dx, -2 + dy, ZW + 8, ZH + 5);
  },
  render(t) {
    if (!this.fid || this.busy) return;
    const g = $('camCanvas').getContext('2d');
    this.frame(g, t, true);
    speckle(g, 0, 0, ZW, ZH, 'rgba(255,255,255,0.08)', 160, Math.floor(t * 30));
  },
  snap() {
    if (this.busy || !this.fid) return;
    this.busy = true;
    const lcd = document.querySelector('.cam-lcd'); lcd.classList.add('focused'); Audio2.synth('focus');
    setTimeout(() => {
      Audio2.synth('shutter');
      if (Settings.get('motion')) { const fl = $('camFlash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
      // the saved photo: the scene, a touch of grain and warmth, and the date stamp
      const c = document.createElement('canvas'); c.width = ZW; c.height = ZH;
      const g = c.getContext('2d'); this.frame(g, Game.t, false);
      g.fillStyle = 'rgba(255,240,210,0.08)'; g.fillRect(0, 0, ZW, ZH);
      speckle(g, 0, 0, ZW, ZH, 'rgba(0,0,0,0.12)', 500, 7);
      g.font = "8px 'Silkscreen', monospace"; g.textAlign = 'right'; g.fillStyle = '#5a2400'; g.fillText(GAME_DATE, ZW - 5, ZH - 5); g.fillStyle = '#ff9a3a'; g.fillText(GAME_DATE, ZW - 6, ZH - 6);
      Game.photos[this.fid] = c.toDataURL('image/jpeg', .82); Game.shots++;
      $('camCanvas').getContext('2d').drawImage(c, 0, 0);
      const n = String(42 + Game.shots).padStart(4, '0');
      $('camSaved').innerHTML = `IMG_${n}.JPG<br>SAVED`; $('camSaved').classList.add('on'); $('camShots').textContent = n.slice(1);
      lcd.classList.remove('focused');
      setTimeout(() => {
        UI.close('cameraScreen'); this.busy = false;
        if (UI.isOpen('markScreen')) Mark.showPhoto();
        if (UI.isOpen('inspectScreen')) { Inspect.refresh(); Inspect.say('Snapped a photo for the report.', 'Camera'); }
        if (this.onDone) this.onDone();
        this.fid = null;
      }, 900);
    }, 280);
  }
};
