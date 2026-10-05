/**
 * WALLPAPER-GALLERY.JS - The "Display Properties" window: pick a wallpaper, display mode
 * (fill / center / tile) and a solid backup color, with live preview + OK / Cancel / Apply.
 * The "Change wallpaper every..." slideshow controls come from wallpaper-cycle.js.
 * Reads the list from wallpapers-data.js (must load first). Wallpapers are applied to <body>.
 * The chosen wallpaper is remembered in this browser (localStorage "wallpaper") and put back
 * on the next visit; System > Reset forgets it.
 */
// Snapshot of current "Saved" settings
let savedWallpaperSettings = {
    src: 'images/wallpapers/clouds.png',
    mode: 'cover',
    color: '#008080'
};

let stagedWallpaperSrc = savedWallpaperSettings.src;

function openWallpaperWindow() {
    WM.open('window-wallpaper', 'Display Properties', '');
    
    const win = document.getElementById('window-window-wallpaper') || document.getElementById('window-wallpaper');
    if(!win) return; 

    // Set custom initial size if it's new
    if(!win.dataset.initialized) {
        win.style.width = '550px';
        win.style.height = '670px';
        win.dataset.initialized = 'true';
    }

    const contentDiv = win.querySelector('.window-content');
    contentDiv.style.display = 'flex';
    contentDiv.style.flexDirection = 'column';
    contentDiv.style.gap = '10px';
    
    contentDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 10px 0 10px;">
            <span style="font-weight: bold;">Select Background:</span>
            <label title="Show or hide the photos I took (listed as 'Photo: ...')" style="cursor: pointer; font-size: 12px;">
                <input type="checkbox" id="wallpaper-show-photos" ${showPhotoWallpapers() ? 'checked' : ''} onchange="setShowPhotoWallpapers(this.checked)"> Include Joe's photos
            </label>
        </div>
        
        <div style="flex: 1; border: 2px inset var(--ui-dark); background: #fff; overflow-y: auto; padding: 10px; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 10px; min-height: 200px;" id="wallpaper-thumbnails">
            </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; border: 1px solid var(--ui-dark);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <label>Display Mode:</label>
                <select id="wallpaper-display-mode" style="width: 150px;" onchange="previewWallpaper()">
                    <option value="cover" ${savedWallpaperSettings.mode === 'cover' ? 'selected' : ''}>Fill</option>
                    <option value="center" ${savedWallpaperSettings.mode === 'center' ? 'selected' : ''}>Center</option>
                    <option value="repeat" ${savedWallpaperSettings.mode === 'repeat' ? 'selected' : ''}>Tile</option>
                </select>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <label>Solid Color:</label>
                <input type="color" id="solid-bg-color" value="${savedWallpaperSettings.color}" style="cursor: pointer; width: 150px;" oninput="previewWallpaper()">
            </div>
            <!-- Slideshow: change wallpaper every X minutes (wallpaper-cycle.js) -->
            <div id="wallpaper-cycle-box" style="border-top: 1px solid var(--ui-dark); padding-top: 8px;"></div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: auto; padding: 0 10px 10px 10px;">
            <button onclick="saveWallpaperSettings(); WM.close('window-wallpaper');">OK</button>
            <button onclick="cancelWallpaper()">Cancel</button>
            <button onclick="saveWallpaperSettings()">Apply</button>
        </div>
    `;

    if (window.WallpaperCycle) WallpaperCycle.renderControls();
    populateGallery();
}

/** "Include Joe's photos" checkbox (on by default; remembered in localStorage "wallpaper-photos"). */
function showPhotoWallpapers() {
    try { return localStorage.getItem('wallpaper-photos') !== 'off'; } catch (e) { return true; }
}
function setShowPhotoWallpapers(on) {
    try { localStorage.setItem('wallpaper-photos', on ? 'on' : 'off'); } catch (e) {}
    populateGallery();
}

function populateGallery() {
    const container = document.getElementById('wallpaper-thumbnails');
    if(!container) return;
    container.innerHTML = '';

    const photos = showPhotoWallpapers();
    const sortedGallery = wallpaperGallery.filter(wp => photos || !wp.id.startsWith('photo-'))
        .sort((a, b) => a.name.localeCompare(b.name));

    sortedGallery.forEach(wp => {
        const item = document.createElement('div');
        item.className = "wallpaper-thumb-item";
        item.dataset.id = wp.id;                                 // wallpaper-cycle.js tick boxes
        item.style.cssText = `width: 85px; display: flex; flex-direction: column; align-items: center; padding: 5px; cursor: pointer; border: 1px dotted transparent; color:black;`;

        const thumbContent = wp.id === 'wp-none' 
            ? `<div style="width: 60px; height: 60px; background: #808080; border: 1px solid #000; display:flex; align-items:center; justify-content:center; color: #fff; font-size: 10px;">None</div>`
            : `<img src="${wp.thumb || wp.src}" loading="lazy" style="width: 60px; height: 60px; object-fit: cover; border: 1px solid #000; background: #fff;">`;

        item.innerHTML = `${thumbContent}<span style="font-size: 11px; margin-top: 4px; text-align: center; width: 100%; word-wrap:break-word;">${wp.name}</span>`;
        if (wp.credit) item.title = `${wp.name}\nFrom: ${wp.credit}`;   // image credit (wallpapers-data.js)

        item.onclick = () => {
            stagedWallpaperSrc = wp.src;
            document.querySelectorAll('.wallpaper-thumb-item').forEach(el => {
                el.style.backgroundColor = 'transparent';
                el.style.color = 'black';
            });
            item.style.backgroundColor = '#000080';
            item.style.color = '#fff';
            previewWallpaper(); 
        };
        container.appendChild(item);
    });
    if (window.WallpaperCycle) WallpaperCycle.decorate();
}

function previewWallpaper() {
    const desktop = document.body;
    const mode = document.getElementById('wallpaper-display-mode').value;
    const color = document.getElementById('solid-bg-color').value;

    desktop.style.backgroundColor = color;
    
    if (!stagedWallpaperSrc) {
        desktop.style.backgroundImage = 'none';
    } else {
        desktop.style.backgroundImage = `url('${stagedWallpaperSrc}')`;
        if (mode === 'cover') { desktop.style.backgroundSize = 'cover'; desktop.style.backgroundPosition = 'center'; desktop.style.backgroundRepeat = 'no-repeat'; }
        else if (mode === 'center') { desktop.style.backgroundSize = 'auto'; desktop.style.backgroundPosition = 'center'; desktop.style.backgroundRepeat = 'no-repeat'; }
        else if (mode === 'repeat') { desktop.style.backgroundSize = 'auto'; desktop.style.backgroundPosition = 'top left'; desktop.style.backgroundRepeat = 'repeat'; }
    }
}

function saveWallpaperSettings() {
    savedWallpaperSettings.src = stagedWallpaperSrc;
    savedWallpaperSettings.mode = document.getElementById('wallpaper-display-mode').value;
    savedWallpaperSettings.color = document.getElementById('solid-bg-color').value;
    try { localStorage.setItem('wallpaper', JSON.stringify(savedWallpaperSettings)); } catch (e) {}   // keep for next visit
}

/** Next visit: put back the wallpaper this visitor picked last time (if any). */
function restoreWallpaper() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('wallpaper') || 'null'); } catch (e) {}
    if (!saved || typeof saved.src !== 'string') return;
    // only wallpapers that still exist in the gallery (or none)
    if (saved.src && !wallpaperGallery.some(w => w.src === saved.src)) return;
    Object.assign(savedWallpaperSettings, { src: saved.src, mode: saved.mode || 'cover', color: saved.color || '#008080' });
    stagedWallpaperSrc = savedWallpaperSettings.src;
    const b = document.body, m = savedWallpaperSettings.mode;
    b.style.backgroundColor = savedWallpaperSettings.color;
    b.style.backgroundImage = savedWallpaperSettings.src ? `url('${savedWallpaperSettings.src}')` : 'none';
    b.style.backgroundSize = m === 'cover' ? 'cover' : 'auto';
    b.style.backgroundPosition = m === 'repeat' ? 'top left' : 'center';
    b.style.backgroundRepeat = m === 'repeat' ? 'repeat' : 'no-repeat';
}
document.addEventListener('DOMContentLoaded', () => setTimeout(restoreWallpaper, 0));

function cancelWallpaper() {
    stagedWallpaperSrc = savedWallpaperSettings.src;
    const desktop = document.body;
    desktop.style.backgroundColor = savedWallpaperSettings.color;
    desktop.style.backgroundImage = savedWallpaperSettings.src ? `url('${savedWallpaperSettings.src}')` : 'none';
    WM.close('window-wallpaper');
}