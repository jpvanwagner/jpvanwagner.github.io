/**
 * DOODLETOP-UI.JS - DoodleTop's drawer (buttons, color, size), help window, and saving.
 * Adds methods onto window.DoodleTop (defined in doodletop.js, which must load first).
 * "Current Screen" saving loads html2canvas from a CDN only when first used.
 */
Object.assign(window.DoodleTop, {
    injectUI() {
        const canvas = document.createElement('canvas');
        canvas.id = 'doodletop-canvas';
        canvas.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:99990; pointer-events:none;`;
        document.body.appendChild(canvas);

        const drawer = document.createElement('div');
        drawer.id = 'doodletop-drawer';
        
        // Box shadow removed here
        drawer.style.cssText = `
            position: fixed; 
            top: 200px; 
            right: -175px; 
            width: 175px; 
            z-index: 99999; 
            background: var(--ui-face); 
            color: var(--ui-text); 
            transition: right 0.3s cubic-bezier(0, 0, 0.2, 1), opacity 0.3s ease; 
            padding: 10px; 
            display: flex; 
            flex-direction: column; 
            gap: 10px; 
            border-top: 2px solid var(--ui-light);
            border-left: 2px solid var(--ui-light);
            border-bottom: 2px solid var(--ui-dark);
            border-right: 2px solid var(--ui-dark);
        `;
        
        drawer.innerHTML = `
            <div id="doodletop-tab" class="drawer-tab" title="DoodleTop: draw on top of the whole screen. Drag up or down to move it, or across the screen to switch sides; right-click for options.">
                <img src="images/icons/os/doodletop.png" style="width:24px; height:24px; image-rendering:pixelated;">
                <span>DOODLETOP</span>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--ui-dark); padding-bottom:5px;">
                <strong style="font-family:var(--user-font); display:flex; align-items:center; gap:5px;">
                    <img src="images/icons/os/doodletop.png" style="width:16px; height:16px; image-rendering:pixelated;">
                    DoodleTop
                </strong>
                <button class="bevel-out" onclick="window.DoodleTop.showHelp()" title="How DoodleTop works" style="padding:2px 6px; font-weight:bold; cursor:pointer;">?</button>
            </div>
            
            <button class="bevel-out" onclick="window.DoodleTop.clearCanvas()" title="Erase everything you drew" style="width:100%; font-weight:bold; color:#a00000; margin-bottom:5px; display:flex; align-items:center; justify-content:center; gap:5px;">
                <img src="images/icons/os/clearall.png" style="width:14px; height:14px; image-rendering:pixelated;"> Clear Canvas
            </button>

            <div style="display:flex; flex-wrap:wrap; gap:5px;">
                <button class="dt-tool bevel-out" data-tool="pen" title="Pen: freehand drawing" style="flex:1; min-width:50px;">Pen</button>
                <button class="dt-tool bevel-out" data-tool="spray" title="Spray can" style="flex:1; min-width:50px;">Spray</button>
                <button class="dt-tool bevel-out" data-tool="line" title="Straight line: drag from start to end" style="flex:1; min-width:50px;">Line</button>
                <button class="dt-tool bevel-out" data-tool="circle" title="Circle: drag out from the center" style="flex:1; min-width:50px;">Circle</button>
                <button class="dt-tool bevel-out" data-tool="eraser" title="Eraser" style="flex:1; min-width:50px; display:flex; align-items:center; justify-content:center; gap:4px;">
                    <img src="images/icons/os/eraser.png" style="width:14px; height:14px; image-rendering:pixelated;"> Eraser
                </button>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:5px;">
                <label style="font-size:11px;">Color:</label>
                <input type="color" id="dt-color" title="Brush color" value="#ff0000" style="cursor:pointer; width:60px; height:25px; padding:0; border:2px inset var(--ui-dark);">
            </div>
            
            <div style="display:flex; flex-direction:column; gap:5px;">
                <label style="font-size:11px; display:flex; justify-content:space-between;">Size: <span id="dt-size-val">5px</span></label>
                <input type="range" id="dt-size" title="Brush size" min="1" max="50" value="5">
            </div>

            <div style="display:flex; align-items:center; gap:5px; padding:5px 0;">
                <input type="checkbox" id="dt-glow" title="Neon glow around strokes" style="cursor:pointer;">
                <label for="dt-glow" style="font-size:11px; cursor:pointer;">Enable Glow</label>
            </div>
            
            <div style="border-top:2px solid var(--ui-dark); margin-top:5px; padding-top:10px; display:flex; flex-direction:column; gap:5px;">
                <strong style="font-size:11px;">Save Doodle...</strong>
                <button class="bevel-out" onclick="window.DoodleTop.save('transparent')" title="Save your drawing as a PNG with a see-through background" style="display:flex; align-items:center; gap:5px;"><img src="images/icons/os/save.png" style="width:12px; height:12px; image-rendering:pixelated;"> Transparent BG</button>
                <button class="bevel-out" onclick="window.DoodleTop.save('white')" title="Save your drawing on white" style="display:flex; align-items:center; gap:5px;"><img src="images/icons/os/save.png" style="width:12px; height:12px; image-rendering:pixelated;"> White BG</button>
                <button class="bevel-out" onclick="window.DoodleTop.save('black')" title="Save your drawing on black" style="display:flex; align-items:center; gap:5px;"><img src="images/icons/os/save.png" style="width:12px; height:12px; image-rendering:pixelated;"> Black BG</button>
                <button class="bevel-out" id="dt-save-screen-btn" onclick="window.DoodleTop.save('screen')" title="Save a picture of the whole screen with your drawing on top" style="display:flex; align-items:center; gap:5px;"><img src="images/icons/os/save.png" style="width:12px; height:12px; image-rendering:pixelated;"> Current Screen</button>
            </div>
        `;
        document.body.appendChild(drawer);

        const tools = document.querySelectorAll('.dt-tool');
        tools.forEach(btn => {
            btn.onclick = (e) => this.setTool(e.target.closest('.dt-tool').dataset.tool);
        });

        this.setupTabDragging(drawer);

        document.getElementById('dt-color').onchange = (e) => this.color = e.target.value;
        document.getElementById('dt-size').oninput = (e) => {
            this.size = parseInt(e.target.value);
            document.getElementById('dt-size-val').innerText = this.size + 'px';
        };
        document.getElementById('dt-glow').onchange = (e) => this.glow = e.target.checked;
    },

    // Slides the DoodleTop drawer open (used by the Start menu)
    openDrawer() {
        const drawer = document.getElementById('doodletop-drawer');
        if (drawer) drawer.style.right = '0px';
        if (window.DrawerTabs) DrawerTabs.syncOpenState();
    },

    startVisibilityWatcher() {
        setInterval(() => {
            const boot = document.getElementById('boot-screen');
            const shutdown = document.getElementById('shutdown-screen');
            const drawer = document.getElementById('doodletop-drawer');
            const canvas = document.getElementById('doodletop-canvas');
            
            const isSystemBusy = (boot && boot.style.display !== 'none') || (shutdown && shutdown.style.display !== 'none');
            
            if (drawer) {
                drawer.style.opacity = isSystemBusy ? '0' : '1';
                drawer.style.pointerEvents = isSystemBusy ? 'none' : 'auto';
            }
            if (canvas) {
                canvas.style.display = isSystemBusy ? 'none' : 'block';
            }
        }, 100);
    },

    setupTabDragging(drawer) {
        const tab = document.getElementById('doodletop-tab');
        let isDragging = false;
        let startY = 0; let startTop = 0;

        const dragStart = (e) => {
            e.preventDefault();
            isDragging = false;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            startTop = drawer.offsetTop;

            const onMove = (ev) => {
                const currentY = ev.touches ? ev.touches[0].clientY : ev.clientY;
                if (Math.abs(currentY - startY) > 3) isDragging = true;
                
                let newTop = Math.max(0, startTop + (currentY - startY));
                
                const tDrawer = document.getElementById('tools-drawer');
                const tTab = document.getElementById('tools-tab');
                
                if (tDrawer && tTab) {
                    const tY = tDrawer.offsetTop;
                    const tH = tTab.offsetHeight || 80;
                    const tBottom = tY + tH;
                    
                    const dtH = tab.offsetHeight || 80;
                    const dtBottom = newTop + dtH;
                    const gap = 4; 
                    
                    if (newTop < tBottom + gap && dtBottom > tY - gap) {
                        const dtCenter = newTop + (dtH / 2);
                        const tCenter = tY + (tH / 2);
                        
                        if (dtCenter < tCenter && (tY - dtH - gap) >= 0) {
                            newTop = tY - dtH - gap;
                        } else {
                            newTop = tBottom + gap;
                        }
                    }
                }

                drawer.style.top = newTop + 'px';
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchend', onUp);
                
                if (!isDragging) {
                    drawer.style.right = drawer.style.right === '0px' ? '-175px' : '0px';
                    if (window.DrawerTabs) DrawerTabs.syncOpenState();   // hide the TOOLS tab right away
                }
            };

            document.addEventListener('mousemove', onMove, {passive: false});
            document.addEventListener('touchmove', onMove, {passive: false});
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchend', onUp);
        };

        tab.addEventListener('mousedown', dragStart);
        tab.addEventListener('touchstart', dragStart, {passive: false});
    },

    showHelp() {
        const html = `
            <div style="padding:10px; font-family:var(--user-font); font-size:var(--font-size); color:var(--ui-text); background:var(--ui-face); height:100%; box-sizing:border-box; overflow-y:auto;">
                <h3 style="margin-top:0; border-bottom:2px solid var(--ui-dark); padding-bottom:5px;">How to use DoodleTop</h3>
                
                <p><strong>DoodleTop</strong> lets you draw directly on top of the entire desktop!</p>
                
                <ul style="padding-left:20px; line-height:1.5;">
                    <li><strong>Drawing:</strong> Select any tool (Pen, Spray, Line, Circle) to begin. While a tool is active, your mouse will draw instead of clicking windows.</li>
                    <li><strong>Canceling:</strong> To stop drawing and use your computer normally again, simply <strong>Right-Click</strong> anywhere or press the <strong>Escape</strong> key.</li>
                    <li><strong>Glow:</strong> Enable the "Glow Effect" checkbox to give your pen or spray a neon shine.</li>
                    <li><strong>Saving:</strong> You can save your artwork as a PNG file. "Current Screen" will take a full screenshot of your open windows and desktop, with your doodle layered perfectly on top!</li>
                </ul>
                
                <div style="text-align:center; margin-top:20px;">
                    <button class="bevel-out" 
                        onmousedown="this.classList.replace('bevel-out','bevel-in')" 
                        onmouseup="this.classList.replace('bevel-in','bevel-out')" 
                        onmouseleave="this.classList.replace('bevel-in','bevel-out')"
                        onclick="WM.close('doodletop-help')" 
                        style="padding:5px 20px; font-weight:bold; outline:none; cursor:pointer;">Got it!</button>
                </div>
            </div>
        `;
        
        if (typeof WM !== 'undefined') {
            WM.open('doodletop-help', 'DoodleTop Help', html, 'images/icons/os/doodletop.png');
            
            setTimeout(() => {
                const win = document.getElementById('window-doodletop-help');
                if(win) {
                    win.style.setProperty('transform', 'none', 'important');
                    win.style.setProperty('margin', '0', 'important');
                    win.style.setProperty('z-index', '100006', 'important');
                    win.style.setProperty('width', '350px', 'important');
                    win.style.setProperty('height', '320px', 'important');
                    win.style.setProperty('left', Math.max(10, window.innerWidth - 350 - 280) + 'px', 'important');
                    win.style.setProperty('top', '80px', 'important');
                }
            }, 100);
        }
    },

    save(type) {
        const link = document.createElement('a');
        link.download = `doodle_${new Date().getTime()}.png`;

        if (type === 'transparent') {
            link.href = this.canvas.toDataURL();
            link.click();
        } 
        else if (type === 'white' || type === 'black') {
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = this.canvas.width;
            tmpCanvas.height = this.canvas.height;
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.fillStyle = type;
            tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
            tmpCtx.drawImage(this.canvas, 0, 0);
            link.href = tmpCanvas.toDataURL();
            link.click();
        } 
        else if (type === 'screen') {
            const btn = document.getElementById('dt-save-screen-btn');
            btn.innerText = "Processing...";
            
            document.getElementById('doodletop-drawer').style.right = '-175px';

            if (typeof html2canvas === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = () => this.captureScreen(link, btn);
                document.head.appendChild(script);
            } else {
                this.captureScreen(link, btn);
            }
        }
    },

    captureScreen(link, btn) {
        html2canvas(document.body, { backgroundColor: null, useCORS: true }).then(bgCanvas => {
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = this.canvas.width;
            finalCanvas.height = this.canvas.height;
            const finalCtx = finalCanvas.getContext('2d');
            
            finalCtx.drawImage(bgCanvas, 0, 0);
            finalCtx.drawImage(this.canvas, 0, 0);
            
            link.href = finalCanvas.toDataURL();
            link.click();
            
            btn.innerText = "Current Screen";
            document.getElementById('doodletop-drawer').style.right = '0px'; 
        });
    },
});
