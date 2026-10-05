/**
 * DOODLETOP.JS - Draw on top of the whole screen (global: DoodleTop). This file holds the
 * drawing engine: a full-screen transparent canvas and the pen / spray / line / circle / eraser
 * tools. The drawer UI, help and saving are in doodletop-ui.js.
 * While a tool is active the canvas captures the mouse; right-click or Esc returns to normal.
 * Quick reference: setTool(name|'none'), bindEvents(), applyStyles(), drawSpray(), clearCanvas()
 */
window.DoodleTop = {
    canvas: null,

    ctx: null,

    isDrawing: false,

    currentTool: 'none',

    color: '#ff0000',

    size: 5,

    glow: false,

    startX: 0, startY: 0,

    snapshot: null,

    sprayInterval: null,

    mouseX: 0, mouseY: 0,

    init() {
        this.injectUI();
        this.canvas = document.getElementById('doodletop-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.bindEvents();
        this.setTool('none');
        this.startVisibilityWatcher(); 
    },

    resizeCanvas() {
        const temp = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.putImageData(temp, 0, 0);
    },

    setTool(toolName) {
        this.currentTool = toolName;
        
        document.querySelectorAll('.dt-tool').forEach(b => {
            if (b.dataset.tool === toolName) {
                b.classList.remove('bevel-out');
                b.classList.add('bevel-in', 'active');
            } else {
                b.classList.remove('bevel-in', 'active');
                b.classList.add('bevel-out');
            }
        });

        this.canvas.style.pointerEvents = (toolName === 'none') ? 'none' : 'auto';
        this.canvas.style.cursor = (toolName === 'none') ? 'default' : 'crosshair';
    },

    bindEvents() {
        document.addEventListener('mousedown', (e) => {
            const drawer = document.getElementById('doodletop-drawer');
            if (!drawer || drawer.style.right !== '0px') return; 
            
            if (!drawer.contains(e.target)) {
                if (e.button === 2) {
                    drawer.style.right = '-175px'; 
                } 
                else if (e.button === 0 && this.currentTool === 'none') {
                    drawer.style.right = '-175px'; 
                }
            }
        });

        document.addEventListener('contextmenu', (e) => {
            if (this.currentTool !== 'none') {
                e.preventDefault(); 
                this.setTool('none'); 
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.currentTool !== 'none') {
                    this.setTool('none');
                } else {
                    const drawer = document.getElementById('doodletop-drawer');
                    if (drawer) drawer.style.right = '-175px';
                }
            }
        });

        const start = (e) => {
            if (this.currentTool === 'none') return;
            if (e.target !== this.canvas) return; 
            if (e.button === 2) return; 
            
            e.preventDefault();
            this.isDrawing = true;
            this.updateMousePos(e);
            this.startX = this.mouseX;
            this.startY = this.mouseY;
            this.snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            this.applyStyles();
            this.ctx.beginPath();
            this.ctx.moveTo(this.startX, this.startY);

            if (this.currentTool === 'spray') {
                this.sprayInterval = setInterval(() => this.drawSpray(), 10);
            }
        };

        const move = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            this.updateMousePos(e);

            if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
                this.ctx.lineTo(this.mouseX, this.mouseY);
                this.ctx.stroke();
            } else if (this.currentTool === 'line') {
                this.ctx.putImageData(this.snapshot, 0, 0);
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(this.mouseX, this.mouseY);
                this.ctx.stroke();
            } else if (this.currentTool === 'circle') {
                this.ctx.putImageData(this.snapshot, 0, 0);
                this.ctx.beginPath();
                const radius = Math.hypot(this.mouseX - this.startX, this.mouseY - this.startY);
                this.ctx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        };

        const stop = (e) => {
            if (!this.isDrawing) return;
            if (e && e.type !== 'mouseout') e.preventDefault();
            this.isDrawing = false;
            clearInterval(this.sprayInterval);
            this.ctx.closePath();
            this.ctx.globalCompositeOperation = 'source-over'; 
        };

        this.canvas.addEventListener('mousedown', start, {passive: false});
        this.canvas.addEventListener('mousemove', move, {passive: false});
        this.canvas.addEventListener('mouseup', stop);
        this.canvas.addEventListener('mouseout', stop);

        this.canvas.addEventListener('touchstart', start, {passive: false});
        this.canvas.addEventListener('touchmove', move, {passive: false});
        this.canvas.addEventListener('touchend', stop);
    },

    updateMousePos(e) {
        if (e.touches && e.touches.length > 0) {
            this.mouseX = e.touches[0].clientX;
            this.mouseY = e.touches[0].clientY;
        } else {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        }
    },

    applyStyles() {
        this.ctx.lineWidth = this.size;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.color;
        this.ctx.fillStyle = this.color;
        
        if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.shadowBlur = 0;
            this.ctx.lineWidth = this.size * 2; 
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            if (this.glow) {
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = this.color;
            } else {
                this.ctx.shadowBlur = 0;
            }
        }
    },

    drawSpray() {
        const density = this.size * 15; 
        const radius = this.size * 2.5; 
        for (let i = 0; i < density; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * radius;
            const x = this.mouseX + Math.cos(angle) * r;
            const y = this.mouseY + Math.sin(angle) * r;
            this.ctx.fillRect(x, y, 1, 1);
        }
    },

    clearCanvas() {
        if(confirm("Clear your doodle?")) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    },
};

document.addEventListener('DOMContentLoaded', () => {
    window.DoodleTop.init();
});