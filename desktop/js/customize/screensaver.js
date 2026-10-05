/**
 * SCREENSAVER.JS - After 2 minutes of no activity ON THIS SITE, a bouncing logo that changes color at
 * every wall hit and counts perfect corner hits (global: Screensaver). Any input dismisses it.
 * Toggle: Tools drawer or Start > Settings. Change idleTime below to adjust the delay.
 * A corner hit sets off a burst of confetti from that corner (smaller and gentler with reduced motion).
 * Quick reference: start(), stop(), resetTimer() (also fed by activity inside the NetCrawler pages)
 */
window.Screensaver = {
    isEnabled: true, // Matches your Tools drawer toggle default
    isActive: false,
    idleTimer: null,
    idleTime: 120000, // 2 minutes with no activity on this site (5000 = quick test). Using other windows,
                      // apps or monitors doesn't count as activity here; moving the mouse over the site does.
    cornerHits: 0,
    
    // Position and velocity
    x: 0, y: 0,
    vx: 2.5, vy: 2.5,
    hue: 0,
    
    element: null,
    logo: null,
    counterEl: null,
    animationFrameId: null,

    init() {
        this.injectUI();
        
        // Bind the reset timer function so it keeps its 'this' context
        this.resetTimer = this.resetTimer.bind(this);
        
        // Listen for any user activity to reset the timer and banish the screensaver
        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
        events.forEach(evt => document.addEventListener(evt, this.resetTimer, {passive: true}));

        // Link to the Tools drawer toggle!
        window.toggleScreensaverState = (isEnabled) => {
            this.isEnabled = isEnabled;
            if (!this.isEnabled && this.isActive) {
                this.stop();
            } else if (this.isEnabled) {
                this.resetTimer();
            }
        };

        this.resetTimer();
    },

    injectUI() {
        // The Dark, Blurred Overlay
        this.element = document.createElement('div');
        this.element.id = 'screensaver-overlay';
        this.element.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(5px);
            z-index: 9999999; /* Over everything! */
            display: none;
            overflow: hidden;
            cursor: none;
        `;

        // The Bouncing Logo
        this.logo = document.createElement('div');
        this.logo.innerHTML = `<img src="images/icons/logo.svg" style="width:64px; height:64px; image-rendering:pixelated; display:block; margin:0 auto 6px;">${window.SiteConfig ? SiteConfig.osName : ''}<div style="font-size:12px; margin-top:9px; opacity:0.95;">by Joe VanWagner</div>`;
        this.logo.style.cssText = `
            position: absolute;
            top: 0; left: 0;
            color: #ff00ff;
            text-align: center;
            font-family: 'Press Start 2P', monospace;
            font-size: 14px;
            white-space: nowrap;
            filter: drop-shadow(4px 4px 0px rgba(0,0,0,0.8));
            transition: filter 0.1s linear;
            will-change: transform;
        `;

        // The Itty-Bitty Corner Hit Counter
        this.counterEl = document.createElement('div');
        this.counterEl.style.cssText = `
            position: absolute;
            bottom: 5px;
            left: 50%;
            transform: translateX(-50%);
            color: rgba(255, 255, 255, 0.4);
            font-family: var(--user-font, monospace);
            font-size: 9px;
            letter-spacing: 1px;
            pointer-events: none;
        `;
        this.counterEl.innerText = "Corner Hits: 0";

        // Confetti layer for corner hits (drawn behind the logo)
        this.confettiCanvas = document.createElement('canvas');
        this.confettiCanvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;';
        this.element.appendChild(this.confettiCanvas);
        this.confetti = [];

        this.element.appendChild(this.logo);
        this.element.appendChild(this.counterEl);
        document.body.appendChild(this.element);
    },

    resetTimer(e) {
        // Browsers send "mouse moved" events even when the pointer hasn't moved (when something under a
        // resting cursor changes, like the tray clock ticking). Only a real move counts as activity.
        if (e && e.type === 'mousemove') {
            if (e.screenX === this._lastX && e.screenY === this._lastY) return;
            this._lastX = e.screenX; this._lastY = e.screenY;
        }
        if (this.isActive) this.stop();
        
        clearTimeout(this.idleTimer);
        
        if (this.isEnabled) {
            this.idleTimer = setTimeout(() => this.start(), this.idleTime);
        }
    },

    canStart() {
        // Prevent starting during boot sequence
        const bootScreen = document.getElementById('boot-screen');
        if (bootScreen && bootScreen.style.display !== 'none') return false;
        
        // Prevent starting during shutdown (assuming you add a class or overlay)
        if (document.body.classList.contains('shutting-down')) return false;
        const shutdownScreen = document.getElementById('shutdown-screen');
        if (shutdownScreen && shutdownScreen.style.display !== 'none') return false;
        
        return true;
    },

    start() {
        if (!this.canStart()) {
            this.resetTimer(); // Try again later
            return;
        }

        this.isActive = true;
        this.element.style.display = 'block';
        
        // Start at a random position
        const maxX = window.innerWidth - this.logo.clientWidth;
        const maxY = window.innerHeight - this.logo.clientHeight;
        
        this.x = Math.random() * maxX;
        this.y = Math.random() * maxY;
        
        // Randomize initial direction
        this.vx = (Math.random() > 0.5 ? 2.5 : -2.5);
        this.vy = (Math.random() > 0.5 ? 2.5 : -2.5);
        this.hue = Math.random() * 360;

        this.changeColor();
        this.animate = this.animate.bind(this);
        this.animationFrameId = requestAnimationFrame(this.animate);
    },

    stop() {
        this.isActive = false;
        this.element.style.display = 'none';
        cancelAnimationFrame(this.animationFrameId);
        this.confetti = [];
    },

    /** Burst of confetti from the corner the logo just hit (cx, cy = that corner). */
    burstConfetti(cx, cy) {
        // Always shown (the logo is already bouncing around); reduced motion just gets a smaller, gentler burst
        let calm = false;
        try { calm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
        const c = this.confettiCanvas;
        if (c.width !== innerWidth || c.height !== innerHeight) { c.width = innerWidth; c.height = innerHeight; }
        const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ff5555', '#55ff55', '#ffffff', '#ff9900'];
        const dirX = cx > 0 ? -1 : 1, dirY = cy > 0 ? -1 : 1;   // shoot out of the corner, into the screen
        for (let i = 0, n = calm ? 60 : 180; i < n; i++) {
            const speed = (calm ? 2.5 : 4) + Math.random() * (calm ? 4 : 9);
            const ang = Math.random() * Math.PI / 2;                // a 90-degree fan
            this.confetti.push({
                x: cx, y: cy,
                vx: dirX * Math.cos(ang) * speed, vy: dirY * Math.sin(ang) * speed,
                w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
                rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
                color: colors[i % colors.length], life: 180 + Math.random() * 80
            });
        }
    },

    drawConfetti() {
        const c = this.confettiCanvas, ctx = c.getContext('2d');
        if (!this.confetti.length) { if (this.confettiDrawn) { ctx.clearRect(0, 0, c.width, c.height); this.confettiDrawn = false; } return; }
        ctx.clearRect(0, 0, c.width, c.height);
        this.confetti = this.confetti.filter(p => (p.life -= 1) > 0 && p.y < c.height + 20);
        this.confetti.forEach(p => {
            p.vy += 0.18; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;   // gravity + a little drag
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.globalAlpha = Math.min(1, p.life / 40);
            ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });
        this.confettiDrawn = true;
    },

    changeColor() {
        // Shift the hue significantly so it's a noticeable color change
        this.hue = (this.hue + 60 + Math.random() * 60) % 360;
        this.logo.style.filter = `drop-shadow(4px 4px 0px rgba(0,0,0,0.8)) hue-rotate(${this.hue}deg)`;
    },

    animate() {
        if (!this.isActive) return;

        const maxX = window.innerWidth - this.logo.clientWidth;
        const maxY = window.innerHeight - this.logo.clientHeight;

        let hitX = false;
        let hitY = false;

        this.x += this.vx;
        this.y += this.vy;

        // X-Axis Bounce
        if (this.x <= 0) {
            this.x = 0;
            this.vx *= -1;
            hitX = true;
        } else if (this.x >= maxX) {
            this.x = maxX;
            this.vx *= -1;
            hitX = true;
        }

        // Y-Axis Bounce
        if (this.y <= 0) {
            this.y = 0;
            this.vy *= -1;
            hitY = true;
        } else if (this.y >= maxY) {
            this.y = maxY;
            this.vy *= -1;
            hitY = true;
        }

        // A gentle nudge toward corners: if it just bounced off one wall and is only a few frames
        // from reaching the other wall it's heading for, let it "make it". Near-misses become corner
        // hits a bit more often, without the path ever looking off.
        const ASSIST = 4;   // frames of leeway
        if (hitX && !hitY) {
            if (this.vy < 0 && this.y <= Math.abs(this.vy) * ASSIST) { this.y = 0; this.vy *= -1; hitY = true; }
            else if (this.vy > 0 && maxY - this.y <= Math.abs(this.vy) * ASSIST) { this.y = maxY; this.vy *= -1; hitY = true; }
        } else if (hitY && !hitX) {
            if (this.vx < 0 && this.x <= Math.abs(this.vx) * ASSIST) { this.x = 0; this.vx *= -1; hitX = true; }
            else if (this.vx > 0 && maxX - this.x <= Math.abs(this.vx) * ASSIST) { this.x = maxX; this.vx *= -1; hitX = true; }
        }

        // Register Edge or Corner Hits
        if (hitX || hitY) {
            this.changeColor();
            
            // If both flipped at the exact same frame, it's a corner hit!
            if (hitX && hitY) {
                this.cornerHits++;
                this.counterEl.innerText = `Corner Hits: ${this.cornerHits}`;
                this.burstConfetti(this.x <= 0 ? 0 : window.innerWidth, this.y <= 0 ? 0 : window.innerHeight);
            }
        }

        this.logo.style.transform = `translate(${this.x}px, ${this.y}px)`;
        this.drawConfetti();

        // Loop the animation
        this.animationFrameId = requestAnimationFrame(this.animate);
    }
};

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', () => {
    window.Screensaver.init();
});