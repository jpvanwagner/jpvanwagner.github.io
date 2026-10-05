/**
 * THEME-BROWSER.JS - The "Theme Browser" window and applying a theme by name.
 * Adds methods onto window.OSThemes (the data object from themes-data.js, which must load first).
 * Colors are applied through window.Tools (tools-drawer.js).
 */
Object.assign(window.OSThemes, {
    openBrowser() {
        let html = `<div style="padding:10px; display:flex; flex-direction:column; gap:10px; height:100%; box-sizing:border-box;">`;
        html += `<p style="margin:0;">Select a theme to apply:</p>`;
        html += `<div style="overflow-y:auto; flex-grow:1; border:2px inset var(--ui-dark); background:var(--win-bg); padding:5px; display:flex; flex-direction:column; gap:5px;">`;
        
        const sortedThemes = Object.keys(this.themes).sort((a, b) => a.localeCompare(b));

        sortedThemes.forEach(themeName => {
            const theme = this.themes[themeName];
            
            const grad = `linear-gradient(135deg, ${theme.colors[0]} 0%, ${theme.colors[4]} 20%, ${theme.colors[8]} 40%, ${theme.colors[12]} 60%, ${theme.colors[16]} 80%, ${theme.colors[20]} 100%)`;

            let rightThumb = '';
            if (theme.wallpaper) {
                rightThumb = `<div style="width:28px; height:28px; border:2px inset var(--ui-dark); background-image:url('${theme.wallpaper}'); background-size:cover; background-position:center; flex-shrink:0;"></div>`;
            } else {
                rightThumb = `<div style="width:28px; height:28px; border:2px inset var(--ui-dark); background:${grad}; flex-shrink:0;"></div>`;
            }

            html += `<button class="bevel-out" style="padding:6px; display:flex; justify-content:space-between; align-items:center; gap:10px; cursor:pointer; font-family:var(--user-font);" onclick="window.OSThemes.applyThemeByName('${themeName}')">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:28px; height:28px; border:2px inset var(--ui-dark); background:${grad}; flex-shrink:0;"></div>
                    <strong style="text-align:left;">${themeName}</strong>
                </div>
                ${rightThumb}
            </button>`;
        });

        html += `</div>`;
        
        // Add the checkbox at the bottom
        html += `<div style="display:flex; align-items:center; gap:5px;">
            <input type="checkbox" id="theme-use-wallpaper" checked style="cursor:pointer;">
            <label for="theme-use-wallpaper" style="cursor:pointer;">Use theme wallpaper</label>
        </div>`;
        
        html += `</div>`;

        WM.open('theme-browser', 'Theme Browser', html);

        setTimeout(() => {
            const win = document.getElementById('theme-browser') || document.getElementById('window-theme-browser');
            if(win) {
                win.style.width = '320px';
                win.style.height = '450px';
            }
        }, 100);
    },

    applyThemeByName(name) {
        const theme = this.themes[name];
        if (!theme) return;
        
        if (typeof Tools !== 'undefined') {
            Tools.colors = theme.colors;
            Tools.primary = theme.prim;
            Tools.secondary = theme.sec;
            Tools.renderPalette();
            Tools.applyTheme(Tools.primary, Tools.secondary);
            Tools.updatePreviewBoxes();
        } else {
            console.error("Tools engine not found!");
        }

        const checkbox = document.getElementById('theme-use-wallpaper');
        if (checkbox && checkbox.checked && theme.wallpaper) {
            document.body.style.backgroundImage = `url('${theme.wallpaper}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
            
            // Sync with wallpapers.js global state so the gallery doesn't get confused
            if (typeof stagedWallpaperSrc !== 'undefined') stagedWallpaperSrc = theme.wallpaper;
            if (typeof savedWallpaperSettings !== 'undefined') savedWallpaperSettings.src = theme.wallpaper;
        }
    }
});
