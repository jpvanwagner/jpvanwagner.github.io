/**
 * WALLPAPER-CYCLE.JS - A wallpaper slideshow for the retro desktop (global: WallpaperCycle).
 *
 * In Display Properties (wallpaper-gallery.js) visitors can pick:
 *   Change wallpaper every  Never / 1 / 5 / 10 / 15 / 30 / 60 minutes
 *   Use  (o) All wallpapers  (respects "Include Joe's photos")
 *        (o) Only the ones I tick  (a checkbox appears on each thumbnail)
 * Every so often a random different wallpaper is shown: tiled patterns are tiled, pictures
 * fill the screen. Choices are remembered in this browser (localStorage "wallpaper-cycle");
 * System > Reset turns it off.
 */
window.WallpaperCycle = {
    key: 'wallpaper-cycle',
    prefs: { minutes: 0, mode: 'all', picked: [] },
    lastChange: Date.now(),

    load() {
        try { Object.assign(this.prefs, JSON.parse(localStorage.getItem(this.key) || '{}')); } catch (e) {}
        if (!Array.isArray(this.prefs.picked)) this.prefs.picked = [];
    },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.prefs)); } catch (e) {} },

    /** Wallpapers the slideshow may use right now. */
    pool() {
        const all = (typeof wallpaperGallery !== 'undefined' ? wallpaperGallery : []).filter(w => w.src);
        if (this.prefs.mode === 'picked') return all.filter(w => this.prefs.picked.includes(w.id));
        const photos = typeof showPhotoWallpapers !== 'function' || showPhotoWallpapers();
        return all.filter(w => photos || !w.id.startsWith('photo-'));
    },

    /** Show a random wallpaper from the pool (never the one already showing). */
    next() {
        const cur = typeof savedWallpaperSettings !== 'undefined' ? savedWallpaperSettings.src : '';
        const choices = this.pool().filter(w => w.src !== cur);
        if (!choices.length) return;
        const wp = choices[Math.floor(Math.random() * choices.length)];
        const mode = wp.id.startsWith('tiled-') ? 'repeat' : 'cover';
        if (typeof savedWallpaperSettings !== 'undefined') {
            Object.assign(savedWallpaperSettings, { src: wp.src, mode });
            stagedWallpaperSrc = wp.src;
            try { localStorage.setItem('wallpaper', JSON.stringify(savedWallpaperSettings)); } catch (e) {}
        }
        const b = document.body;
        b.style.backgroundImage = `url('${wp.src}')`;
        b.style.backgroundSize = mode === 'cover' ? 'cover' : 'auto';
        b.style.backgroundPosition = mode === 'repeat' ? 'top left' : 'center';
        b.style.backgroundRepeat = mode === 'repeat' ? 'repeat' : 'no-repeat';
        this.lastChange = Date.now();
    },

    tick() {
        if (!this.prefs.minutes || document.hidden) return;
        if (document.getElementById('window-wallpaper')) return;          // not while the visitor is choosing
        if (Date.now() - this.lastChange >= this.prefs.minutes * 60000) this.next();
    },

    // ---------------------------------------------------------------- Display Properties controls

    /** The "Change wallpaper every..." controls (put into #wallpaper-cycle-box). */
    renderControls() {
        const box = document.getElementById('wallpaper-cycle-box');
        if (!box) return;
        const m = this.prefs.minutes;
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <label for="wallpaper-cycle-min" title="Show a random wallpaper every so often">Change wallpaper every:</label>
                <select id="wallpaper-cycle-min" style="width:150px;">
                    ${[[0, 'Never'], [1, '1 minute'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '60 minutes']]
                        .map(([v, t]) => `<option value="${v}" ${v === m ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
            <div class="wp-cycle-pool" style="display:${m ? 'flex' : 'none'}; gap:14px; align-items:center; font-size:12px; margin-top:6px;">
                <span>Use:</span>
                <label title="Every wallpaper in the list"><input type="radio" name="wp-cycle-mode" value="all" ${this.prefs.mode !== 'picked' ? 'checked' : ''}> All wallpapers</label>
                <label title="Tick the wallpapers above that you want in the rotation"><input type="radio" name="wp-cycle-mode" value="picked" ${this.prefs.mode === 'picked' ? 'checked' : ''}> Only the ones I tick</label>
                <span id="wp-cycle-count" style="margin-left:auto; opacity:.75;"></span>
            </div>`;
        box.querySelector('#wallpaper-cycle-min').addEventListener('change', (e) => {
            this.prefs.minutes = Number(e.target.value); this.lastChange = Date.now(); this.save();
            box.querySelector('.wp-cycle-pool').style.display = this.prefs.minutes ? 'flex' : 'none';
            this.decorate();
        });
        box.querySelectorAll('input[name="wp-cycle-mode"]').forEach(r => r.addEventListener('change', (e) => {
            this.prefs.mode = e.target.value; this.save(); this.decorate();
        }));
        this.updateCount();
    },

    updateCount() {
        const c = document.getElementById('wp-cycle-count');
        if (c) c.textContent = this.prefs.mode === 'picked' ? `${this.prefs.picked.length} ticked` : `${this.pool().length} in rotation`;
    },

    /** Tick boxes on the thumbnails while "Only the ones I tick" is chosen. */
    decorate() {
        const on = this.prefs.minutes && this.prefs.mode === 'picked';
        document.querySelectorAll('#wallpaper-thumbnails .wallpaper-thumb-item').forEach(item => {
            let cb = item.querySelector('.wp-cycle-check');
            const id = item.dataset.id;
            if (!on || !id || id === 'wp-none') { if (cb) cb.remove(); return; }
            if (!cb) {
                cb = document.createElement('label');
                cb.className = 'wp-cycle-check';
                cb.title = 'Include this wallpaper in the rotation';
                cb.style.cssText = 'font-size:10px; display:flex; align-items:center; gap:2px; margin-top:2px;';
                cb.innerHTML = '<input type="checkbox"> cycle';
                cb.addEventListener('click', (e) => e.stopPropagation());   // don't also pick it as the wallpaper
                cb.querySelector('input').addEventListener('change', (e) => {
                    const list = this.prefs.picked.filter(x => x !== id);
                    if (e.target.checked) list.push(id);
                    this.prefs.picked = list; this.save(); this.updateCount();
                });
                item.appendChild(cb);
            }
            cb.querySelector('input').checked = this.prefs.picked.includes(id);
        });
        this.updateCount();
    },

    reset() { this.prefs = { minutes: 0, mode: 'all', picked: [] }; try { localStorage.removeItem(this.key); } catch (e) {} },

    init() {
        this.load();
        this.lastChange = Date.now();
        setInterval(() => this.tick(), 15000);
    }
};
document.addEventListener('DOMContentLoaded', () => WallpaperCycle.init());
