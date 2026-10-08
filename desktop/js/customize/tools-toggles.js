/**
 * TOOLS-TOGGLES.JS - The Tools drawer's "Quick Toggles" and system-wide switches:
 * theme/wallpaper windows, CRT effect, screensaver, taskbrick auto-hide, and Reset System.
 * Adds methods onto window.Tools (defined in tools-drawer.js, which must load first).
 */
Object.assign(window.Tools, {
    openThemes() {
        if(window.OSThemes) {
            window.OSThemes.openBrowser();
        } else {
            console.error('OSThemes missing');
            return;
        }

        let attempts = 0;
        const fixThemes = setInterval(() => {
            attempts++;
            if (attempts > 40) { clearInterval(fixThemes); return; }

            const win = document.getElementById('window-theme-browser');
            if(win) {
                clearInterval(fixThemes); 
                
                setTimeout(() => {
                    const w = win.offsetWidth || 400;
                    win.style.setProperty('transform', 'none', 'important');
                    win.style.setProperty('margin', '0', 'important');
                    win.style.setProperty('z-index', '100005', 'important');
                    win.style.setProperty('left', Math.max(10, window.innerWidth - w - 360) + 'px', 'important');
                    win.style.setProperty('top', '40px', 'important');
                }, 100); 
            }
        }, 50);
    },

    openWallpapers() {
        if(window.Wallpapers && typeof window.Wallpapers.open === 'function') {
            window.Wallpapers.open();
        } else if(typeof openWallpaperWindow === 'function') {
            openWallpaperWindow();
        } else {
            console.error('Wallpapers missing');
            return;
        }

        let attempts = 0;
        const fixWallpapers = setInterval(() => {
            attempts++;
            if (attempts > 40) { clearInterval(fixWallpapers); return; }

            let win = null;
            document.querySelectorAll('[id^="window-"]').forEach(w => {
                const titleBar = w.querySelector('.window-title') || w.querySelector('div');
                if (titleBar && (titleBar.innerText.trim() === 'Display Settings' || titleBar.innerText.trim() === 'Display Properties' || titleBar.innerText.trim() === 'Wallpaper Gallery')) {
                    win = w;
                }
            });

            if (win && win.dataset.fixedLayout !== "true") {
                clearInterval(fixWallpapers); 
                win.dataset.fixedLayout = "true";

                setTimeout(() => {
                    const titleBar = win.querySelector('.window-title') || win.querySelector('div');
                    if (titleBar) {
                        const walk = document.createTreeWalker(titleBar, NodeFilter.SHOW_TEXT, null, false);
                        let node;
                        while(node = walk.nextNode()) {
                            if(node.nodeValue.includes('Display Settings')) {
                                node.nodeValue = node.nodeValue.replace('Display Settings', 'Wallpaper Gallery');
                            } else if(node.nodeValue.includes('Display Properties')) {
                                node.nodeValue = node.nodeValue.replace('Display Properties', 'Wallpaper Gallery');
                            }
                        }
                    }

                    const exactWidth = 440; 
                    win.style.setProperty('transform', 'none', 'important');
                    win.style.setProperty('margin', '0', 'important');
                    win.style.setProperty('width', exactWidth + 'px', 'important');
                    win.style.setProperty('left', Math.max(10, window.innerWidth - exactWidth - 360) + 'px', 'important');
                    win.style.setProperty('top', '40px', 'important');
                    win.style.setProperty('z-index', '100005', 'important');

                    const content = win.querySelector('.window-content');
                    if (content) {
                        content.style.setProperty('width', '100%', 'important');
                        content.style.setProperty('overflow-x', 'hidden', 'important');
                    }
                }, 100); 
            }
        }, 50);
    },

    renderQuickToggles() {
        const container = document.getElementById('tools-content');
        if(!container || document.getElementById('quick-toggles-section')) return;
        

        const section = document.createElement('div');
        section.id = 'quick-toggles-section';
        section.className = 'tool-section';
        section.style.borderBottom = 'none'; 
        
        section.innerHTML = `
            <strong>Quick Toggles</strong>
            <div class="icon-grid">
                <button class="icon-btn" title="Theme Presets" onclick="window.Tools.openThemes()">
                    <img src="images/icons/os/themesgallery.png" alt="Themes">
                </button>
                
                <button class="icon-btn" title="Wallpapers" onclick="window.Tools.openWallpapers()">
                    <img src="images/icons/os/wallpapergallery.png" alt="Wallpapers">
                </button>
                
                <button class="icon-btn depressed" id="btn-screensaver" title="Toggle Screensaver" onclick="window.Tools.toggleScreensaver()">
                    <img src="images/icons/os/screensaver.png" alt="Screensaver">
                </button>
                
                <button class="icon-btn" id="btn-autohide" title="Autohide Taskbricks" onclick="window.Tools.toggleAutohide()">
                    <img src="images/icons/os/taskbricks.png" alt="Autohide">
                </button>
                
                <button class="icon-btn" id="btn-crt" title="Toggle CRT FX" onclick="window.Tools.toggleCRT()">
                    <img src="images/icons/os/displayoptions.png" alt="CRT FX">
                </button>

                <button class="icon-btn ${!window.RetroCursor || RetroCursor.on() ? 'depressed' : ''}" id="btn-cursor" title="Retro mouse pointer (on/off)" onclick="window.RetroCursor && RetroCursor.toggle()">
                    <img src="images/cursors/arrow.png" alt="Retro pointer" style="image-rendering:pixelated; width:24px; height:24px; object-fit:none; object-position:4px 2px;">
                </button>
            </div>
        `;
        container.appendChild(section);
    },

    toggleCRT() {
        const btn = document.getElementById('btn-crt');
        const overlay = document.getElementById('crt-overlay');
        if (!btn || !overlay) return;

        btn.classList.toggle('depressed');
        overlay.className = btn.classList.contains('depressed') ? 'crt-on' : 'crt-off';
        if (window.OSSettings) OSSettings.remember('crt', btn.classList.contains('depressed'));   // keep for next visit
    },

    toggleScreensaver() {
        const btn = document.getElementById('btn-screensaver');
        if (!btn) return;
        
        btn.classList.toggle('depressed');
        const isEnabled = btn.classList.contains('depressed');
        if (window.OSSettings) OSSettings.remember('screensaver', isEnabled);   // keep for next visit
        
        if (typeof window.toggleScreensaverState === 'function') {
            window.toggleScreensaverState(isEnabled);
        } else {
            console.log("Screensaver is now " + (isEnabled ? "ON" : "OFF"));
        }
    },

    toggleAutohide() {
        const btn = document.getElementById('btn-autohide');
        if (!btn) return;

        btn.classList.toggle('depressed');
        const isEnabled = btn.classList.contains('depressed');
        if (window.OSSettings) OSSettings.remember('autohide', isEnabled);   // keep for next visit
        
        if (isEnabled) {
            document.body.classList.add('autohide-bricks');
        } else {
            document.body.classList.remove('autohide-bricks');
            document.body.classList.remove('show-bricks');
            
            if (typeof WM !== 'undefined' && WM.windows) {
                Object.keys(WM.windows).forEach(id => {
                    const win = WM.windows[id];
                    if (win && win.dataset.isMaximized === "true") {
                        win.dataset.isMaximized = "false";
                        WM.maximize(id);
                    }
                });
            }
        }
    },

    setupAutohideLogic() {

        document.addEventListener('mousemove', (e) => {
            if (document.body.classList.contains('autohide-bricks')) {
                if (e.clientY >= window.innerHeight - 15) {
                    document.body.classList.add('show-bricks');
                } 
                else if (document.body.classList.contains('show-bricks')) {
                    const menuOpen = !!(window.Menu && window.Menu.isOpen);
                    
                    if (!menuOpen) {
                        let minTop = window.innerHeight;
                        const bricks = document.querySelectorAll('.brick:not(.free):not(.dragging)');
                        if (bricks.length === 0) {
                            minTop = window.innerHeight - 44;
                        } else {
                            bricks.forEach(b => {
                                const rect = b.getBoundingClientRect();
                                if (rect.top > 0 && rect.top < minTop) minTop = rect.top;
                            });
                        }
                        
                        if (e.clientY < minTop - 20) {
                            document.body.classList.remove('show-bricks');
                        }
                    }
                }
            }
        });

        document.addEventListener('touchstart', (e) => {
            if (document.body.classList.contains('autohide-bricks')) {
                const touchY = e.touches[0].clientY;
                if (touchY >= window.innerHeight - 30) {
                    document.body.classList.add('show-bricks');
                } else {
                    const menuOpen = !!(window.Menu && window.Menu.isOpen);
                    if (!menuOpen) {
                        document.body.classList.remove('show-bricks');
                    }
                }
            }
        }, {passive: true});
    },

    resetSystem() {
        OSDialog.confirm({ title: 'Reset settings', message: 'Reset all OS settings to default without restarting?', ok: 'Reset', cancel: 'Cancel' })
            .then(yes => { if (yes) this.resetSystemNow(); });
    },
    resetSystemNow() {

        this.primary = '#c0c0c0';
        this.secondary = '#000080';
        this.applyTheme(this.primary, this.secondary);
        this.updatePreviewBoxes();

        const defaultFont = 'Courier New';
        document.documentElement.style.setProperty('--user-font', defaultFont);
        document.documentElement.style.setProperty('--font-size', '12px'); 
        const fontSelect = document.getElementById('font-select');
        if (fontSelect) fontSelect.value = defaultFont;

        // Wallpaper back to the default clouds
        document.body.style.backgroundColor = '#008080';
        document.body.style.backgroundImage = "url('images/wallpapers/clouds.png')";
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        if (typeof savedWallpaperSettings !== 'undefined') {
            savedWallpaperSettings.src = 'images/wallpapers/clouds.png';
            savedWallpaperSettings.mode = 'cover';
            savedWallpaperSettings.color = '#008080';
            stagedWallpaperSrc = savedWallpaperSettings.src;
            try { localStorage.removeItem('wallpaper'); } catch (e) {}
            if (window.WallpaperCycle) WallpaperCycle.reset();       // slideshow off
        }

        const crtBtn = document.getElementById('btn-crt');
        if (crtBtn && crtBtn.classList.contains('depressed')) this.toggleCRT();
        
        // Restore screensaver to ON (Default) if it is off
        const ssBtn = document.getElementById('btn-screensaver');
        if (ssBtn && !ssBtn.classList.contains('depressed')) this.toggleScreensaver();
        
        const autoBtn = document.getElementById('btn-autohide');
        if (autoBtn && autoBtn.classList.contains('depressed')) this.toggleAutohide();

        // Retro mouse pointer back ON (the default)
        if (window.RetroCursor && !RetroCursor.on()) RetroCursor.toggle();

        if (window.TaskBricks && window.TaskBricks.bricks) {
            window.TaskBricks.isLocked = false;
            const lockCheck = document.getElementById('taskbrick-lock-check');
            if (lockCheck) lockCheck.checked = false;

            for (let id in window.TaskBricks.bricks) {
                let b = window.TaskBricks.bricks[id];
                if (b.id !== 'start-brick' && !b.isFree) {
                    b.isManual = false; 
                    b.row = -1; 
                    b.x = -1000;
                }
            }
            
            window.TaskBricks.updateLayout();
            setTimeout(() => window.TaskBricks.updateLayout(), 100);
            setTimeout(() => window.TaskBricks.updateLayout(), 250);
        }
    },
});
