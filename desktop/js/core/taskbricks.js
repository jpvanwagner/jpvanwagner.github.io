/**
 * TASKBRICKS.JS - The taskbar, reimagined as bricks that stack up from the bottom of the screen
 * and can be dragged around (global: TaskBricks). One brick per open window.
 *
 * Quick reference:
 *   init()                     builds the brick layer (+ the special bricks from taskbricks-parts.js)
 *   addWindowBrick / removeWindowBrick / setActive   called by the window manager
 *   updateLayout()             packs bricks into rows ("gravity" pulls unsupported bricks down)
 *   findEmptySlot(width)       first free spot for a new brick
 *   setupDragging(el)          drag a brick to restack it (ignored while "locked")
 * Styles: desktop/css/taskbricks.css
 */
window.TaskBricks = {
    container: null,

    initialized: false,

    brickHeight: 32,

    brickGap: 2,

    bricks: {},

    hasFallen: new Set(),

    isLocked: false,       // NEW: Tracks if the taskbar is locked,

    glitchTimeout: null,   // NEW: Stores the easter egg timeout,

    init() {
        if (this.initialized) return;
        this.container = document.getElementById('brick-layer');
        if (!this.container) return; 

        Object.assign(this.container.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            pointerEvents: 'none', zIndex: '9999', overflow: 'hidden'
        });


        this.createStartBrick();
        this.createSystemTray();     
        
        // NEW: Initialize Context Menu
        this.createContextMenu();
        
        // NEW: Listen for Right-Clicks on any brick
        this.container.addEventListener('contextmenu', (e) => {
            const brick = e.target.closest('.brick');
            // Window bricks get Restore/Minimize/Close from context-menu.js instead
            if (brick && !brick.classList.contains('window-brick')) {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY);
            }
        });
        
        this.updateLayout();
        this.initialized = true;
        
        if (document.fonts) document.fonts.ready.then(() => this.updateLayout());
        setTimeout(() => this.updateLayout(), 100);
        setTimeout(() => this.updateLayout(), 500);
        setTimeout(() => this.updateLayout(), 1000);
        window.addEventListener('resize', () => this.updateLayout());
    },

    updateLayout() {
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        for (let id in this.bricks) {
            let b = this.bricks[id];
            if (!b.el.classList.contains('dragging-wobble') && b.el.offsetWidth > 0) {
                b.width = b.el.offsetWidth;
            }
        }

        // The system tray (fullscreen + clock) always hugs the bottom-right corner unless dragged
        let tray = this.bricks['system-tray'];
        if (tray && !tray.isManual) {
            tray.row = 0;
            tray.x = winW - tray.width - 5;
        }

        let gravityChanged = true;
        let loops = 0;
        while(gravityChanged && loops < 10) {
            gravityChanged = false;
            loops++;
            let sortedIds = Object.keys(this.bricks).filter(id => id !== 'start-brick' && !this.bricks[id].el.classList.contains('dragging-wobble'))
                                                  .sort((a,b) => this.bricks[a].row - this.bricks[b].row);
            
            for (let id of sortedIds) {
                let b = this.bricks[id];
                if (b.row > 0 && b.isManual) {
                    let supported = Object.values(this.bricks).some(other => 
                        other.id !== id && other.row === b.row - 1 && !other.el.classList.contains('dragging-wobble') &&
                        Math.max(b.x, other.x) < Math.min(b.x + b.width, other.x + other.width) + this.brickGap
                    );
                    if (!supported) {
                        b.row--; 
                        gravityChanged = true;
                    }
                }
            }
        }

        // Window bricks line up in the order their windows were opened: oldest on the left, filling
        // the bottom row first, then stacking upward in new rows when a row runs out of room
        let autoBricks = Object.values(this.bricks)
            .filter(b => !b.isFree && !b.isManual && b.id !== 'start-brick' && !b.el.classList.contains('dragging-wobble'))
            .sort((a,b) => (a.seq || 0) - (b.seq || 0));
            
        autoBricks.forEach(b => { b.row = -1; b.x = -1000; });

        for (let b of autoBricks) {
            let slot = this.findEmptySlot(b.width);
            b.x = slot.x;
            b.row = slot.row;
        }

        for (let id in this.bricks) {
            let b = this.bricks[id];
            if (!b.el.classList.contains('dragging-wobble')) {
                b.el.style.left = b.x + 'px';
                b.el.style.top = (winH - this.brickHeight - 5 - (b.row * (this.brickHeight + this.brickGap))) + 'px';
            }
        }

        // The taskbricks' height decides how far down icons and maximized windows can go:
        // tell them after the bricks settle (more rows = less room)
        clearTimeout(this._notifyT);
        this._notifyT = setTimeout(() => {
            if (window.Desktop && Desktop.layout) Desktop.layout();
            if (typeof WM !== 'undefined' && WM.onScreenResize) WM.onScreenResize();
        }, 60);
    },

    findEmptySlot(targetWidth) {
        const winW = window.innerWidth;
        let row = 0;
        
        while(true) {
            let x = 5;
            if (row === 0 && this.bricks['start-brick']) x = this.bricks['start-brick'].x + this.bricks['start-brick'].width + this.brickGap;

            let rowBricks = Object.values(this.bricks)
                .filter(b => b.row === row && !b.el.classList.contains('dragging-wobble') && b.id !== 'start-brick')
                .sort((a,b) => a.x - b.x);

            for (let b of rowBricks) {
                if (b.x - x >= targetWidth) return {x, row}; 
                x = Math.max(x, b.x + b.width + this.brickGap);
            }

            if (winW - 5 - x >= targetWidth) return {x, row};
            row++;
        }
    },

    addWindowBrick(id, title, iconUrl) {
        let brick = document.getElementById(`brick-${id}`);
        if (brick) return;

        brick = document.createElement('div');
        brick.id = `brick-${id}`;
        brick.className = 'brick window-brick';
        
        const icon = iconUrl || 'images/icons/logo.svg';
        brick.innerHTML = `<img src="${icon}" style="width:14px; height:14px; margin-right:5px; vertical-align:middle; image-rendering:pixelated;"><span style="vertical-align:middle;">${title}</span>`;
        
        brick.onclick = (e) => { 
            if (brick.classList.contains('was-dragged')) { e.preventDefault(); e.stopPropagation(); return; }
            if (typeof WM !== 'undefined') WM.toggle(id); 
            else if (typeof WindowManager !== 'undefined') WindowManager.toggleWindow(id);
        };
        
        this.container.appendChild(brick);
        this.seqCounter = (this.seqCounter || 0) + 1;       // opening order (see updateLayout)
        this.bricks[brick.id] = { id: brick.id, el: brick, width: 0, x: 0, row: 0, isFree: false, isManual: false, seq: this.seqCounter };
        this.setupDragging(brick); 
        this.updateLayout();

        if (!this.hasFallen.has(id)) {
            this.hasFallen.add(id);
            
            requestAnimationFrame(() => {
                brick.animate([
                    { transform: 'translateY(-100vh)', opacity: 0 },
                    { transform: 'translateY(0)', opacity: 1 }
                ], { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
            });
        }
    },

    setupDragging(el) {
        let isDragging = false;
        let hasMoved = false;
        let startX, startY, origLeft, origTop;

        const dragStart = (e) => {
            if (this.isLocked) return; // --- FIX: Aborts drag if taskbar is locked ---
            
            if (e.target.id === 'tray-fullscreen') return;
            if (e.button !== 0 && e.type === 'mousedown') return;
            
            isDragging = true;
            hasMoved = false;
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            origLeft = el.offsetLeft; 
            origTop = el.offsetTop;

            const onMove = (ev) => {
                if (!isDragging) return;
                const curX = ev.touches ? ev.touches[0].clientX : ev.clientX;
                const curY = ev.touches ? ev.touches[0].clientY : ev.clientY;
                
                if (!hasMoved && (Math.abs(curX - startX) > 3 || Math.abs(curY - startY) > 3)) {
                    hasMoved = true;
                    el.classList.add('dragging-wobble');
                    this.updateLayout(); 
                }
                
                if (hasMoved) {
                    el.style.left = (origLeft + (curX - startX)) + 'px';
                    el.style.top = (origTop + (curY - startY)) + 'px';
                }
            };

            const onUp = () => {
                if (!isDragging) return;
                isDragging = false;
                
                if (hasMoved) {
                    el.classList.remove('dragging-wobble');
                    el.classList.add('was-dragged');
                    setTimeout(() => el.classList.remove('was-dragged'), 100);
                    
                    let targetX = el.offsetLeft;
                    let winH = window.innerHeight;
                    let winW = window.innerWidth;
                    
                    let targetRow = Math.max(0, Math.round((winH - el.offsetTop - this.brickHeight - 5) / (this.brickHeight + this.brickGap)));

                    let bestX = targetX;
                    let collision = true;
                    let loops = 0;
                    
                    while (collision && loops < 20) {
                        collision = false;
                        loops++;
                        let rowBricks = Object.values(this.bricks).filter(b => b.row === targetRow && b.id !== el.id && !b.el.classList.contains('dragging-wobble'));
                        
                        for (let b of rowBricks) {
                            if (bestX < b.x + b.width && bestX + el.offsetWidth > b.x) {
                                collision = true;
                                bestX = b.x + b.width + this.brickGap;
                            }
                        }
                        if (bestX + el.offsetWidth > winW - 5) {
                            targetRow++;
                            bestX = 5;
                            collision = true; 
                        }
                    }

                    let isValid = false;
                    let rowBricksFinal = Object.values(this.bricks).filter(b => b.row === targetRow && b.id !== el.id);
                    if (targetRow === 0 || bestX <= 5 || bestX + el.offsetWidth >= winW - 5) {
                        isValid = true;
                    } else {
                        let touchH = rowBricksFinal.some(b => Math.abs(bestX + el.offsetWidth - b.x) <= this.brickGap + 1 || Math.abs(bestX - (b.x + b.width)) <= this.brickGap + 1);
                        let touchV = Object.values(this.bricks).some(b => b.row === targetRow - 1 && Math.max(bestX, b.x) < Math.min(bestX + el.offsetWidth, b.x + b.width));
                        if (touchH || touchV) isValid = true;
                    }

                    if (isValid) {
                        this.bricks[el.id].x = bestX;
                        this.bricks[el.id].row = targetRow;
                        this.bricks[el.id].isManual = true; 
                    }
                    this.updateLayout(); 
                }

                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, {passive: false});
            document.addEventListener('touchend', onUp);
        };
        el.addEventListener('mousedown', dragStart);
        el.addEventListener('touchstart', dragStart, {passive: false});
    },

    removeWindowBrick(id) {
        const brickId = `brick-${id}`;
        if (this.bricks[brickId]) {
            this.bricks[brickId].el.remove();
            delete this.bricks[brickId];
        }
        this.updateLayout(); 
    },

    setActive(id) {
        document.querySelectorAll('.window-brick').forEach(b => b.classList.remove('active'));
        const brick = document.getElementById(`brick-${id}`);
        if (brick) brick.classList.add('active');
    },
};

document.addEventListener('DOMContentLoaded', () => { window.TaskBricks.init(); });