/**
 * TOOLS-DRAWER.JS - The TOOLS drawer on the right edge (global: Tools): theme painter
 * (left-click a swatch = window color, right-click = accent color), font picker, and the color
 * math that turns two colors into the whole UI palette. The Quick Toggles are in tools-toggles.js.
 *
 * Quick reference:
 *   applyTheme(primary, secondary)   sets the CSS variables everything else uses
 *   renderPalette / renderFonts / swapColors / updatePreviewBoxes
 *   getContrastColor(hex) -> 'black' | 'white';  adjustBrightness(hex, amount)
 * Styles: desktop/css/drawers.css
 */
window.Tools = {
    colors: [],

    fonts: ['Courier New', 'Verdana', 'Tahoma', 'Times New Roman', 'Arial', 'Comic Sans MS', '"Press Start 2P", cursive'],

    primary: '#c0c0c0', secondary: '#000080',   // default = the "Windows 95 UI" theme,

    init() {
        // Starting palette = the "Windows 95 UI" theme's swatches
        this.colors = (window.OSThemes && OSThemes.themes['Windows 95 UI']) ? OSThemes.themes['Windows 95 UI'].colors.slice() : [
            '#000000', '#444444', '#888888', '#ffffff', 
            '#7f0000', '#ff0000', '#800000', '#ffcccc',
            '#808000', '#ffff00', '#808080', '#ffffcc',
            '#008000', '#00ff00', '#00ff80', '#ccffcc',
            '#008080', '#00ffff', '#000080', '#0000ff',
            '#000040', '#800080', '#ff00ff', '#e0e0e0'
        ];

        const env = document.getElementById('desktop-environment');
        let drawer = document.getElementById('tools-drawer');
        
        if (!drawer && env) {
            drawer = document.createElement('div');
            drawer.id = 'tools-drawer';
            drawer.innerHTML = `
                <div id="tools-tab" onclick="window.Tools.toggleDrawer()" title="Tools: colors, fonts, themes, wallpapers, effects. Drag up or down to move it, or across the screen to switch sides; right-click for options.">
                    <img src="images/icons/os/displayoptions.png">
                    <span>TOOLS</span>
                </div>
                <div id="tools-content">
                    <div class="tool-section">
                        <strong>Theme Painter</strong>
                        <div id="color-preview" title="Click to swap the two colors" onclick="window.Tools.swapColors()">
                            <div id="bg-color-box"></div> 
                            <div id="fg-color-box"></div> 
                        </div>
                        <div id="color-grid"></div>
                        <small>Affects UI Only (Windows/Bricks)</small>
                        <button onclick="window.Tools.resetSystem()" title="Put the colors, font, and effects back to the defaults" style="width:100%; margin-top:5px;">Reset System</button>
                    </div>
                </div>
            `;
            env.appendChild(drawer);
        }

        if (drawer) {
            drawer.style.setProperty('box-shadow', 'none', 'important');
        }

        this.renderFonts();
        this.renderQuickToggles(); 
        
        this.updatePreviewBoxes();
        this.setupDrawerDrag();
        this.setupAutoRetract(); 
        this.setupAutohideLogic(); 
        
        this.applyTheme(this.primary, this.secondary);
        this.renderPalette();
    },

    toggleDrawer() { 
        document.getElementById('tools-drawer').classList.toggle('open'); 
        if (window.DrawerTabs) DrawerTabs.syncOpenState();   // hide the DoodleTop tab right away
    },

    setupDrawerDrag() { 
        const drawer = document.getElementById('tools-drawer');
        const tab = document.getElementById('tools-tab');
        if(!drawer || !tab) return;
        let startY = 0; let startTop = 0;
        tab.onmousedown = (e) => {
            if(e.target !== tab && e.target.parentElement !== tab) return;
            e.preventDefault();
            startY = e.clientY; startTop = drawer.offsetTop;
            const onMove = (ev) => { drawer.style.top = (startTop + (ev.clientY - startY)) + 'px'; };
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
        };
    },

    setupAutoRetract() {
        document.addEventListener('mousedown', (e) => {
            const drawer = document.getElementById('tools-drawer');
            if (drawer && drawer.classList.contains('open')) {
                if (!drawer.contains(e.target)) {
                    const themeWin = document.getElementById('theme-browser') || document.getElementById('window-theme-browser');
                    if (themeWin) return; 
                    drawer.classList.remove('open');
                }
            }
        });
    },

    renderFonts() {
        const container = document.getElementById('tools-content');
        if(!container || document.getElementById('font-section')) return;
        
        const section = document.createElement('div');
        section.id = 'font-section'; 
        section.className = 'tool-section';
        section.innerHTML = `<strong>System Font</strong><br><select id="font-select" style="width:100%; font-family:var(--user-font); margin-top:5px;"></select>`;
        container.appendChild(section);
        
        const select = document.getElementById('font-select');
        this.fonts.forEach(f => {
            const opt = document.createElement('option');
            opt.innerText = f.replace(/['",]/g, '').replace('cursive', '').trim();
            opt.value = f;
            select.appendChild(opt);
        });
        select.onchange = (e) => { 
            const font = e.target.value;
            document.documentElement.style.setProperty('--user-font', font);
            if(font.includes('Press Start 2P')) {
                document.documentElement.style.setProperty('--font-size', '10px');
            } else {
                document.documentElement.style.setProperty('--font-size', '12px');
            }
        };
    },

    renderPalette() {
        const grid = document.getElementById('color-grid');
        if(!grid) return;
        grid.innerHTML = '';
        this.colors.forEach(c => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = c;
            swatch.title = 'Left-click: window color · Right-click: accent color';
            swatch.onclick = () => { this.primary = c; this.applyTheme(this.primary, this.secondary); this.updatePreviewBoxes(); };
            swatch.oncontextmenu = (e) => { e.preventDefault(); this.secondary = c; this.applyTheme(this.primary, this.secondary); this.updatePreviewBoxes(); };
            grid.appendChild(swatch);
        });
    },

    swapColors() {
        const temp = this.primary; this.primary = this.secondary; this.secondary = temp;
        this.applyTheme(this.primary, this.secondary); this.updatePreviewBoxes();
    },

    updatePreviewBoxes() {
        const fg = document.getElementById('fg-color-box');
        const bg = document.getElementById('bg-color-box');
        if(fg) fg.style.backgroundColor = this.primary;
        if(bg) bg.style.backgroundColor = this.secondary;
    },

    applyTheme(prim, sec) {
        const root = document.documentElement.style;
        root.setProperty('--ui-face', prim);
        root.setProperty('--ui-light', this.adjustBrightness(prim, 40));
        root.setProperty('--ui-dark', this.adjustBrightness(prim, -40));
        root.setProperty('--title-grad-1', prim);
        root.setProperty('--title-grad-2', sec);
        const textColor = this.getContrastColor(prim);
        root.setProperty('--ui-text', textColor);
        root.setProperty('--title-text', textColor); 
    },

    getContrastColor(hex) {
        if(hex.startsWith('#')) hex = hex.slice(1);
        const r = parseInt(hex.substr(0,2), 16);
        const g = parseInt(hex.substr(2,2), 16);
        const b = parseInt(hex.substr(4,2), 16);
        return (((r*299)+(g*587)+(b*114))/1000 >= 128) ? 'black' : 'white';
    },

    adjustBrightness(col, amt) {
        let usePound = false;
        if (col[0] == "#") { col = col.slice(1); usePound = true; }
        let num = parseInt(col,16);
        let r = (num >> 16) + amt; if (r > 255) r = 255; else if  (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt; if (b > 255) b = 255; else if  (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt; if (g > 255) g = 255; else if (g < 0) g = 0;
        return (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16).padStart(6,'0');
    },
};

document.addEventListener('DOMContentLoaded', () => {
    window.Tools.init();
});