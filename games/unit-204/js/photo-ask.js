'use strict';
/* ============================== "WRITE IT UP?" AFTER A PHOTO ==============================
   Right after the camera saves a photo of a checklist feature or an oddity, a small pill pops up in the corner:
   click it to jump straight to that line on the clipboard form (the photo is already attached). It fades on its
   own after a few seconds, and never shows when the photo was taken from the form itself. */
const PhotoAsk = {
  fid: null, _t: 0,
  build() {
    if ($('photoAsk')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'photoAsk'; b.className = 'photo-ask';
    b.addEventListener('click', e => { e.stopPropagation(); const fid = this.fid; this.hide(); if (fid && (FEATURE[fid] || ANOMALY[fid])) Mark.open(fid); });
    $('feedback').after(b);
  },
  offer(fid) {
    if (!fid || !(FEATURE[fid] || ANOMALY[fid]) || isView(fid) || UI.isOpen('markScreen')) return;
    const m = Game.marks[fid], locked = !!m && Settings.get('feedback') === 'now';
    if (locked) return;                                         // already filed for good: nothing left to write
    this.build(); this.fid = fid;
    const b = $('photoAsk'), name = (FEATURE[fid] || ANOMALY[fid]).name;
    b.innerHTML = '<span class="ico ico-clipboard"></span>';
    const t = document.createElement('span'); t.textContent = m ? 'Update the report?' : 'Write it up?';
    const s = document.createElement('small'); s.textContent = name;
    t.append(s); b.append(t);
    b.dataset.tip = 'Clipboard|Open the ' + lower(name) + ' on your form, with this photo attached.';
    void b.offsetWidth; b.classList.add('on');
    clearTimeout(this._t); this._t = setTimeout(() => this.hide(), 6500);
  },
  hide() { clearTimeout(this._t); const b = $('photoAsk'); if (b) b.classList.remove('on'); this.fid = null; }
};
