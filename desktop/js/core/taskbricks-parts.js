/**
 * TASKBRICKS-PARTS.JS - The special bricks: START button, system tray (fullscreen + clock),
 * and the right-click "Lock the taskbar" menu (with its glitchy easter egg).
 * Adds methods onto window.TaskBricks (defined in taskbricks.js, which must load first).
 */
Object.assign(window.TaskBricks, {
    // --- NEW: Context Menu Generation ---
    createContextMenu() {
        if (document.getElementById('taskbrick-context-menu')) return;
        
        const menu = document.createElement('div');
        menu.id = 'taskbrick-context-menu';
        menu.style.cssText = `
            position: fixed;
            background: var(--ui-face, #c0c0c0);
            border-top: 2px solid var(--ui-light, #fff);
            border-left: 2px solid var(--ui-light, #fff);
            border-bottom: 2px solid var(--ui-dark, #888);
            border-right: 2px solid var(--ui-dark, #888);
            padding: 4px;
            z-index: 100005;
            display: none;
            font-family: var(--user-font, 'Press Start 2P', monospace);
            font-size: var(--user-font-size, 12px);
            color: var(--ui-text, black);
            box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
            white-space: nowrap;
        `;
        
        menu.innerHTML = `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px; margin: 0;">
                <input type="checkbox" id="taskbrick-lock-check" style="cursor: pointer; margin: 0;">
                <span id="taskbrick-lock-text">Lock the taskbar</span>
            </label>
        `;
        document.body.appendChild(menu);

        document.getElementById('taskbrick-lock-check').addEventListener('change', (e) => {
            this.isLocked = e.target.checked;
            menu.style.display = 'none'; // Auto-close menu on selection
        });

        // Click off to close
        document.addEventListener('mousedown', (e) => {
            if (menu.style.display === 'block' && !menu.contains(e.target)) {
                if (e.button !== 2) menu.style.display = 'none';
            }
        });
    },

    // --- NEW: Context Menu Display & Glitch Easter Egg ---
    showContextMenu(x, y) {
        const menu = document.getElementById('taskbrick-context-menu');
        const checkbox = document.getElementById('taskbrick-lock-check');
        const textSpan = document.getElementById('taskbrick-lock-text');

        if (!menu || !checkbox || !textSpan) return;

        // Reset state
        checkbox.checked = this.isLocked;
        textSpan.innerText = 'Lock the taskbar';
        menu.style.display = 'block';

        // Keep inside viewport bounds
        let finalX = x;
        let finalY = y;
        if (finalX + menu.offsetWidth > window.innerWidth) finalX = window.innerWidth - menu.offsetWidth - 2;
        if (finalY + menu.offsetHeight > window.innerHeight) finalY = window.innerHeight - menu.offsetHeight - 2;
        
        menu.style.left = finalX + 'px';
        menu.style.top = finalY + 'px';

        // Clear any existing glitch timeouts to prevent overlaps
        if (this.glitchTimeout) clearTimeout(this.glitchTimeout);

        // The Easter Egg Sequence
        this.glitchTimeout = setTimeout(() => {
            if (menu.style.display === 'block') {
                textSpan.innerText = 'Lock the t̵a̷s̵k̵b̶a̶r̶'; // Stage 1 Glitch
                
                setTimeout(() => {
                    if (menu.style.display === 'block') {
                        textSpan.innerText = 'Lock the t̷a̵s̸k̷b̷r̴i̴c̷k̸s̶'; // Stage 2 Glitch
                        
                        setTimeout(() => {
                            if (menu.style.display === 'block') {
                                textSpan.innerText = 'Lock the taskbricks'; // Final Form
                            }
                        }, 80);
                    }
                }, 80);
            }
        }, 750);
    },

    createStartBrick() {
        const btn = document.createElement('div');
        btn.id = 'start-brick';
        btn.className = 'brick';
        btn.innerHTML = `<img src="images/icons/logo.svg" style="width:16px; height:16px; margin-right:5px; image-rendering:pixelated;"><span style="vertical-align:middle;">MENU</span>`;
        btn.title = 'Open the menu: pages, programs, search, settings, and Traditional View';
        
        btn.onclick = (e) => {
            if (btn.classList.contains('was-dragged')) { e.preventDefault(); e.stopPropagation(); return; }
            
            if (typeof window.Menu !== 'undefined') window.Menu.toggle();
        };
        
        this.container.appendChild(btn);
        this.bricks['start-brick'] = { id: 'start-brick', el: btn, width: 0, x: 5, row: 0, isFree: false, isManual: true };
    },

    createSystemTray() {
        const tray = document.createElement('div');
        tray.id = 'system-tray';
        tray.className = 'brick'; 
        tray.innerHTML = `
            <button type="button" id="tray-fullscreen" title="Full screen (hide your browser's toolbars). Press Esc to exit." aria-label="Enter full screen">
                <!-- four corner brackets = the universal "full screen" symbol -->
                <svg viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true">
                    <path class="fs-enter" d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path class="fs-exit" d="M6 1v5H1M15 6h-5V1M10 15v-5h5M1 10h5v5" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
            </button>
            <span id="tray-clock" title="" style="vertical-align:middle;">12:00</span>
        `;
        this.container.appendChild(tray);
        
        const fsBtn = tray.querySelector('#tray-fullscreen');
        fsBtn.onclick = (e) => { e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); };
        // Swap the icon + tooltip when full screen turns on/off (also when the visitor presses Esc)
        document.addEventListener('fullscreenchange', () => {
            const on = !!document.fullscreenElement;
            fsBtn.classList.toggle('is-full', on);
            fsBtn.title = on ? 'Exit full screen (or press Esc)' : "Full screen (hide your browser's toolbars). Press Esc to exit.";
            fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Enter full screen');
        });
        // Clock tooltip = today's date; double-click opens the Clock app
        const clock = tray.querySelector('#tray-clock');
        clock.addEventListener('mouseenter', () => {
            clock.title = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '\nDouble-click for the clock and timers';
        });
        clock.addEventListener('dblclick', () => { if (window.ClockApp) ClockApp.open(); });

        const updateClock = () => {
            if (window.SysClock) return;                 // sys-clock.js shows the date + time instead
            const now = new Date();
            let h = now.getHours() % 12 || 12; let m = now.getMinutes().toString().padStart(2, '0');
            const el = document.getElementById('tray-clock');
            if(el) el.innerText = `${h}:${m} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
        };
        updateClock(); setInterval(updateClock, 1000);

        this.bricks['system-tray'] = { id: 'system-tray', el: tray, width: 0, x: 0, row: 0, isFree: true, isManual: false };
        this.setupDragging(tray);
    },
});
