/**
 * VOLUME.JS - A speaker icon in the system tray (next to the clock) with a volume slider and
 * mute box (global: SiteVolume). It controls this site's sound only (the computer's own volume
 * is off-limits to web pages): course narration, videos, and the games' sound effects.
 *
 * How it reaches the sound: every couple of seconds (and whenever the level changes) it walks
 * through the desktop and every page/course/game frame inside it and
 *   - sets the volume of each <audio> / <video> element (and of any that start playing later), and
 *   - routes Web Audio (what the games use) through one "master" gain node per audio context.
 * Frames from other websites can't be reached (browsers forbid it), and neither can frames when
 * the site is opened from a folder via file:// in some browsers; it works on the live site.
 * The level is remembered in this browser (localStorage "site-volume").
 * Styles: desktop/css/taskbricks.css ("VOLUME")
 */
window.SiteVolume = {
    storageKey: 'site-volume',
    level: 1,          // 0..1
    muted: false,
    masters: [],       // gain nodes we inserted into Web Audio contexts

    init() {
        try {
            const s = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
            if (s) { this.level = Math.min(1, Math.max(0, Number(s.level))); this.muted = !!s.muted; }
        } catch (e) {}
        this.addTrayButton();
        this.applyEverywhere();
        setInterval(() => this.applyEverywhere(), 2000);   // catch newly opened pages, courses and games
    },

    effective() { return this.muted ? 0 : this.level; },

    set(level, muted) {
        if (level !== undefined) this.level = Math.min(1, Math.max(0, level));
        if (muted !== undefined) this.muted = muted;
        try { localStorage.setItem(this.storageKey, JSON.stringify({ level: this.level, muted: this.muted })); } catch (e) {}
        this.applyEverywhere();
        this.updateIcon();
    },

    /** Apply the volume to this window and, recursively, every same-site frame inside it. */
    applyEverywhere(win = window, depth = 0) {
        if (depth > 4) return;
        let doc;
        try { doc = win.document; if (!doc) return; } catch (e) { return; }   // another site's frame: not allowed
        const v = this.effective();
        try {
            doc.querySelectorAll('audio, video').forEach(m => { m.volume = v; });
            if (!doc.__siteVolumeHooked) {
                doc.__siteVolumeHooked = true;
                // media that starts later (e.g. the next narration clip) gets the current level too
                doc.addEventListener('play', (e) => { if (e.target && 'volume' in e.target) e.target.volume = this.effective(); }, true);
                this.patchWebAudio(win);
            }
        } catch (e) {}
        this.masters = this.masters.filter(g => { try { g.gain.value = v; return true; } catch (e) { return false; } });
        for (let i = 0; i < win.frames.length; i++) this.applyEverywhere(win.frames[i], depth + 1);
    },

    /** Send anything connected to the speakers through a master gain we control (one per context). */
    patchWebAudio(win) {
        try {
            const AN = win.AudioNode, AD = win.AudioDestinationNode;
            if (!AN || !AD || AN.prototype.__siteVolumePatched) return;
            const original = AN.prototype.connect;
            const self = this;
            AN.prototype.connect = function (dest, ...rest) {
                if (dest instanceof AD && !this.__isSiteMaster) {
                    const ctx = dest.context;
                    if (!ctx.__siteMaster) {
                        const g = ctx.createGain();
                        g.__isSiteMaster = true;
                        g.gain.value = self.effective();
                        original.call(g, dest);
                        ctx.__siteMaster = g;
                        self.masters.push(g);
                    }
                    return original.call(this, ctx.__siteMaster, ...rest);
                }
                return original.call(this, dest, ...rest);
            };
            AN.prototype.__siteVolumePatched = true;
        } catch (e) {}
    },

    // ------------------------------------------------------------------ tray button + slider

    iconSvg() {
        const v = this.effective();
        const waves = v === 0 ? '<path d="M11 6l4 4M15 6l-4 4" stroke="#d93025" stroke-width="1.8"/>'   // muted: a red X
            : (v < 0.5 ? '<path d="M11 6.5c1 1 1 2 0 3" fill="none" stroke="currentColor" stroke-width="1.5"/>'
                       : '<path d="M11 6.5c1 1 1 2 0 3M13 4.5c2 2 2 5 0 7" fill="none" stroke="currentColor" stroke-width="1.5"/>');
        return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor"/>${waves}</svg>`;
    },

    updateIcon() {
        const btn = document.getElementById('tray-volume');
        if (!btn) return;
        btn.innerHTML = this.iconSvg();
        const pct = Math.round(this.level * 100);
        btn.title = this.muted ? 'Sound is muted (this site only). Click to change.' : `Site volume: ${pct}% (this site only). Click to change.`;
        const slider = document.getElementById('volume-slider');
        if (slider) slider.value = pct;
        const label = document.getElementById('volume-pct');
        if (label) label.textContent = this.muted ? 'Muted' : pct + '%';
        const mute = document.getElementById('volume-mute');
        if (mute) mute.checked = this.muted;
    },

    addTrayButton() {
        const tray = document.getElementById('system-tray');
        if (!tray || document.getElementById('tray-volume')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'tray-volume';
        btn.setAttribute('aria-label', 'Site volume');
        tray.insertBefore(btn, tray.firstChild);

        const pop = document.createElement('div');
        pop.id = 'volume-popup';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-label', 'Volume');
        pop.innerHTML = `
            <div class="vol-title">Volume</div>
            <div class="vol-track-box"><input type="range" id="volume-slider" min="0" max="100" step="5" aria-label="Site volume" aria-orientation="vertical" title="Drag to change this site's volume"></div>
            <div id="volume-pct"></div>
            <label class="vol-mute" title="Silence this site"><input type="checkbox" id="volume-mute"> Mute</label>
            <div class="vol-note">This site only</div>`;
        document.body.appendChild(pop);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = pop.style.display !== 'block';
            pop.style.display = open ? 'block' : 'none';
            if (open) {
                const r = btn.getBoundingClientRect();
                pop.style.left = Math.min(window.innerWidth - pop.offsetWidth - 4, r.left + r.width / 2 - pop.offsetWidth / 2) + 'px';
                pop.style.top = (r.top - pop.offsetHeight - 6) + 'px';
                document.getElementById('volume-slider').focus();
            }
        });
        pop.querySelector('#volume-slider').addEventListener('input', (e) => this.set(Number(e.target.value) / 100, false));
        pop.querySelector('#volume-mute').addEventListener('change', (e) => this.set(undefined, e.target.checked));
        document.addEventListener('mousedown', (e) => {
            if (pop.style.display === 'block' && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) pop.style.display = 'none';
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.style.display = 'none'; });
        window.addEventListener('blur', () => { pop.style.display = 'none'; });

        this.updateIcon();
        if (window.TaskBricks && TaskBricks.updateLayout) TaskBricks.updateLayout();   // the tray got wider
    }
};
document.addEventListener('DOMContentLoaded', () => setTimeout(() => SiteVolume.init(), 0));
