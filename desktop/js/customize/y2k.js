/**
 * Y2K.JS - A silly Easter egg (global: Y2K). When the desktop clock rolls over from
 * 11:59:59 PM, December 31, 1999 to 2000 (set it in Date/Time Properties and wait), the
 * "millennium bug" strikes: the screen shakes, warps, tears and changes color, the tray thinks
 * it's 1900, fake error boxes pop up, and the tray clock blinks "12:00" / "CLICK TO STOP" like
 * every VCR in 1999. Clicking the clock (or pressing Esc) ends it; otherwise it ends by itself
 * after a minute (never longer) and everything goes back to normal, as it did in real life.
 * If nobody has stopped it after 15 seconds, Joe's pixel head peeks in from a random spot on the
 * left or right edge with a word bubble ("I can fix this, come with me!"), and again every 15
 * seconds from somewhere else with a new line until the minute is up. Clicking him ends the bug.
 * Noises: low, worried BZZZ hums plus beeps, boops and bzzzts, made on the fly with Web Audio
 * (no sound files; they follow the tray volume / mute).
 * People who prefer reduced motion get the error boxes, colors, clock and sounds without the
 * shaking, warping, tearing and scrambling.
 * Started by sys-clock.js. Styles: desktop/css/y2k.css
 */
window.Y2K = {
    active: false,
    seconds: 60,                   // ends by itself after this long
    peekEvery: 15,                 // seconds between Joe's peeks (the first one comes after this long, too)
    peekLines: [
        ['I can fix this!', 'Come with me. Click me.'],
        ['Don\'t panic! I\'ve seen this before.', 'Click me and I\'ll patch it.'],
        ['Psst! Over here!', 'I know how to stop the clock. Click me.'],
        ['Stand back, I\'m a professional.', 'Click me to fix the millennium.'],
        ['Good thing I kept the manual.', 'Click me, I\'ll handle it.']
    ],
    messages: [
        ['Y2K.EXE', 'This program has performed an illegal operation: the year is now 1900.'],
        ['Calendar', 'Your library books are now 100 years overdue.'],
        ['VCR Clock', 'Blinking 12:00. As usual.'],
        ['Mortgage Calculator', 'Congratulations! You have been paying since 1900.'],
        ['Toaster.sys', 'Toaster cannot find the year. Toast canceled.'],
        ['Elevator', 'Elevator last serviced in 1900. Please take the stairs.'],
        ['Bank', 'Your savings earned -100 years of interest.'],
        ['System', 'Please do not panic. Everyone else is.'],
        ['Scheduler', 'Your 9:00 meeting is in 36,524 days.']
    ],

    start() {
        if (this.active) return;
        this.active = true;
        const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.body.classList.add('y2k-glitch');
        if (calm) document.body.classList.add('y2k-calm');

        const layer = document.createElement('div');
        layer.id = 'y2k-layer';
        layer.innerHTML = `<div class="y2k-banner">&#9888; 01/01/1900 &#9888;<small>Millennium bug detected. Stop the clock to restore reality.</small></div>
            <div class="y2k-blot"></div><div class="y2k-blot b2"></div>`;
        document.body.appendChild(layer);

        let n = 0;
        this.popTimer = setInterval(() => { this.popup(layer, n++); this.sound('beep'); }, 1600);
        this.popup(layer, n++);
        this.endsAt = Date.now() + this.seconds * 1000;
        this.countTimer = setTimeout(() => this.stop(), this.seconds * 1000);
        // Joe comes to the rescue: a peek every 15 seconds until the minute is up
        this.peekLeft = this.peekLines.slice().sort(() => Math.random() - 0.5);
        this.lastPeek = null;
        this.peekTimer = setInterval(() => {
            if (Date.now() + 2000 < this.endsAt) this.peek(layer);
        }, this.peekEvery * 1000);

        // The tray clock blinks brightly: "12:00", then "CLICK TO STOP". Clicking it ends the bug.
        const clock = document.getElementById('tray-clock');
        let on = false;
        const blink = () => {
            if (Date.now() >= this.endsAt) { this.stop(); return; }   // a hard one-minute cap, even if a timer ran late
            const el = document.getElementById('tray-clock');
            if (!el) return;
            on = !on;
            el.classList.add('y2k-clock');
            el.classList.toggle('y2k-clock-alt', !on);
            el.textContent = on ? '12:00' : 'CLICK TO STOP';
            el.title = 'Click to stop the millennium bug';
        };
        blink();
        this.blinkTimer = setInterval(blink, 650);
        this.clockClick = (e) => { if (e.target.closest('#tray-clock')) { e.preventDefault(); e.stopPropagation(); this.stop(); } };
        document.addEventListener('click', this.clockClick, true);
        if (clock && window.TaskBricks && TaskBricks.updateLayout) TaskBricks.updateLayout();

        // Noises: a low worried hum right away, then hums, beeps and bzzzts at random
        this.sound('hum', 1.6);
        const noise = () => {
            if (!this.active) return;
            this.sound(['hum', 'beep', 'hum', 'boop', 'bzzt', 'hum', 'chirp'][Math.floor(Math.random() * 7)]);
            this.sfxTimer = setTimeout(noise, 600 + Math.random() * 1300);
        };
        this.sfxTimer = setTimeout(noise, 900);
        if (!calm) {
            this.tearTimer = setInterval(() => this.tear(layer), 200);
            this.scrambleTimer = setInterval(() => this.scramble(), 350);
            this.warpTimer = setInterval(() => this.warp(), 900);
        }
        this.esc = (e) => { if (e.key === 'Escape') this.stop(); };
        document.addEventListener('keydown', this.esc);
    },

    // ------------------------------------------------------------------ sounds (Web Audio)

    /** beep = short square tone, boop = falling tone, chirp = quick rising blip, bzzt = buzzy noise,
     *  hum = a low, worried BZZZ (two detuned sawtooth waves that wobble and sag in pitch). */
    sound(kind, len) {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            const ctx = this.ctx || (this.ctx = new AC());
            if (ctx.state === 'suspended') ctx.resume();
            const t = ctx.currentTime, out = ctx.createGain();
            out.connect(ctx.destination);
            if (kind === 'hum') {
                const d = len || 0.7 + Math.random() * 0.9;
                const f0 = 48 + Math.random() * 30;
                const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 3;
                const wob = ctx.createOscillator(), wobAmt = ctx.createGain();      // tremolo: the "zzz" in BZZZ
                wob.frequency.value = 9 + Math.random() * 7; wobAmt.gain.value = 0.07;
                const amp = ctx.createGain(); amp.gain.value = 0.11;
                wob.connect(wobAmt); wobAmt.connect(amp.gain);
                [0, 1].forEach(k => {
                    const o = ctx.createOscillator(); o.type = 'sawtooth';
                    o.frequency.setValueAtTime(f0 * (k ? 1.012 : 1), t);
                    o.frequency.linearRampToValueAtTime(f0 * 0.8, t + d);       // sags at the end, like something giving up
                    o.connect(lp); o.start(t); o.stop(t + d + 0.05);
                });
                lp.connect(amp); amp.connect(out);
                out.gain.setValueAtTime(0.001, t); out.gain.exponentialRampToValueAtTime(1, t + 0.06);
                out.gain.setValueAtTime(1, t + d - 0.15); out.gain.exponentialRampToValueAtTime(0.001, t + d);
                wob.start(t); wob.stop(t + d + 0.05);
                return;
            }
            if (kind === 'bzzt') {
                const d = len || 0.25 + Math.random() * 0.3;
                const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * d), ctx.sampleRate), ch = buf.getChannelData(0);
                for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (Math.floor(i / 180) % 2 ? 1 : 0.3);   // gritty, chopped noise
                const src = ctx.createBufferSource(); src.buffer = buf;
                const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 900; f.Q.value = 0.8;
                out.gain.setValueAtTime(0.18, t); out.gain.exponentialRampToValueAtTime(0.001, t + d);
                src.connect(f); f.connect(out); src.start(t); src.stop(t + d);
                return;
            }
            const o = ctx.createOscillator();
            o.type = kind === 'boop' ? 'triangle' : 'square';
            const f0 = { beep: 880 + Math.random() * 700, boop: 520, chirp: 400 }[kind] || 800;
            const d = { beep: 0.12, boop: 0.35, chirp: 0.14 }[kind] || 0.15;
            o.frequency.setValueAtTime(f0, t);
            if (kind === 'boop') o.frequency.exponentialRampToValueAtTime(110, t + d);
            if (kind === 'chirp') o.frequency.exponentialRampToValueAtTime(1800, t + d);
            out.gain.setValueAtTime(0.08, t); out.gain.exponentialRampToValueAtTime(0.001, t + d);
            o.connect(out); o.start(t); o.stop(t + d + 0.02);
            if (kind === 'beep' && Math.random() < 0.5) setTimeout(() => this.active && this.sound('beep'), 140);   // beep-beep
        } catch (e) {}
    },

    // ------------------------------------------------------------------ visual glitches

    /** Brief horizontal "tearing" bars across the screen. */
    tear(layer) {
        for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++) {
            const bar = document.createElement('div');
            bar.className = 'y2k-tear';
            bar.style.top = Math.round(Math.random() * 100) + '%';
            bar.style.height = (3 + Math.round(Math.random() * 36)) + 'px';
            bar.style.setProperty('--shift', (Math.random() * 60 - 30).toFixed(0) + 'px');
            layer.appendChild(bar);
            setTimeout(() => bar.remove(), 120 + Math.random() * 260);
        }
    },

    /** Now and then the whole screen bends: a quick stretch, squash or wave (y2k.css "y2k-warp-*"). */
    warp() {
        const kinds = ['y2k-warp-a', 'y2k-warp-b', 'y2k-warp-c'];
        document.body.classList.remove(...kinds);
        if (Math.random() < 0.6) {
            void document.body.offsetWidth;                  // restart the animation
            document.body.classList.add(kinds[Math.floor(Math.random() * kinds.length)]);
        }
    },

    /** Desktop icon labels flicker into junk characters (put back when it ends). */
    scramble() {
        const junk = '#$%&@!?/\\|<>*^~01';
        document.querySelectorAll('.desktop-icon > span').forEach(sp => {
            if (sp.dataset.y2kText === undefined) sp.dataset.y2kText = sp.textContent;
            const orig = sp.dataset.y2kText;
            sp.textContent = Math.random() < 0.5 ? orig
                : orig.split('').map(c => c !== ' ' && Math.random() < 0.35 ? junk[Math.floor(Math.random() * junk.length)] : c).join('');
        });
    },

    /** Joe's pixel head peeks in from a random spot on the left or right edge, with a word bubble.
     *  Each peek picks a new side/height and a line not used yet; clicking him ends the bug. */
    peek(layer) {
        const old = layer.querySelector('.y2k-peek');
        if (old) old.remove();
        let side, top, tries = 0;
        do {
            side = Math.random() < 0.5 ? 'left' : 'right';
            top = 12 + Math.round(Math.random() * 62);              // % of the screen height, clear of the taskbar
        } while (this.lastPeek && side === this.lastPeek.side && Math.abs(top - this.lastPeek.top) < 25 && ++tries < 10);
        this.lastPeek = { side, top };
        if (!this.peekLeft.length) this.peekLeft = this.peekLines.slice().sort(() => Math.random() - 0.5);
        const [line, sub] = this.peekLeft.pop();
        const el = document.createElement('div');
        el.className = 'y2k-peek ' + side;
        el.style.top = top + 'vh';
        el.setAttribute('role', 'button');
        el.title = 'Click to stop the millennium bug';
        el.innerHTML = `<img src="images/icons/apple-touch-icon.png" alt="Joe"><div class="y2k-bubble">${line}<small>${sub}</small></div>`;
        el.addEventListener('click', (e) => { e.stopPropagation(); this.stop(true); });
        layer.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
        this.sound('chirp');
        clearTimeout(this.peekHide);
        this.peekHide = setTimeout(() => el.classList.remove('in'), (this.peekEvery - 3) * 1000);   // ducks back out before the next one
    },

    /** A fake Windows error box somewhere random. */
    popup(layer, i) {
        const [title, text] = this.messages[i % this.messages.length];
        const box = document.createElement('div');
        box.className = 'y2k-error';
        box.style.left = Math.round(Math.random() * Math.max(10, innerWidth - 300)) + 'px';
        box.style.top = Math.round(Math.random() * Math.max(10, innerHeight - 180)) + 'px';
        box.innerHTML = `<div class="y2k-title">${title}<span>X</span></div>
            <div class="y2k-body"><span class="y2k-icon">!</span><p>${text}</p></div>
            <div class="y2k-ok"><button type="button" tabindex="-1">OK</button></div>`;
        box.addEventListener('click', () => box.remove());
        layer.appendChild(box);
        const boxes = layer.querySelectorAll('.y2k-error');
        if (boxes.length > 8) boxes[0].remove();
    },

    stop(byJoe) {
        if (!this.active) return;
        this.active = false;
        clearInterval(this.popTimer);
        clearInterval(this.peekTimer);
        clearTimeout(this.peekHide);
        clearTimeout(this.countTimer);
        clearInterval(this.tearTimer);
        clearInterval(this.scrambleTimer);
        clearInterval(this.warpTimer);
        clearInterval(this.blinkTimer);
        clearTimeout(this.sfxTimer);
        document.removeEventListener('click', this.clockClick, true);
        const clock = document.getElementById('tray-clock');
        if (clock) { clock.classList.remove('y2k-clock', 'y2k-clock-alt'); clock.title = ''; clock.dataset.text = ''; }
        document.querySelectorAll('.desktop-icon > span[data-y2k-text]').forEach(sp => {
            sp.textContent = sp.dataset.y2kText; delete sp.dataset.y2kText;
        });
        this.sound('boop');                                  // power-down
        document.removeEventListener('keydown', this.esc);
        document.body.classList.remove('y2k-glitch', 'y2k-calm', 'y2k-warp-a', 'y2k-warp-b', 'y2k-warp-c');
        const layer = document.getElementById('y2k-layer');
        if (layer) layer.remove();
        if (window.SysClock) SysClock.tick();
        if (window.TaskBricks && TaskBricks.updateLayout) TaskBricks.updateLayout();
        if (window.SiteShare && SiteShare.toast) SiteShare.toast(byJoe ? 'Fixed it. Happy 2000! (Told you I could.)' : 'Crisis averted. Happy 2000! (It turned out fine.)');
    }
};
