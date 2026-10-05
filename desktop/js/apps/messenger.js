/**
 * MESSENGER.JS - "Messages from Joe": a little instant-message that blinks in the system tray (global: Messenger).
 * A deliberately old-school, late-90s instant-messenger look and sound.
 *
 * Every 20 to 30 minutes (random) the Retro Desktop is open (busy or not), a new message arrives: a speech bubble
 * blinks in the tray and an "uh-oh!" plays, until the visitor opens it. Reading it and closing the
 * window makes it go away; another one arrives 20 to 30 minutes later. If several arrive before
 * the visitor reads them, they queue up (the tray bubble shows how many) and open one at a time, oldest
 * first, with a "Next message" button, like an old-school messenger. Each message is different (they
 * rotate through MESSAGES below, picking up where the visitor left off last time).
 *
 * The "Incoming Message" window lets visitors:
 *   - Reply in-app ("Send Message" view): sent to SiteConfig.messageEndpoint (a form service like
 *     Formspree) if one is set, otherwise their email app opens with the reply filled in.
 *     Joe's address is never shown.
 *   - email Joe, share the site, or jump to whatever the message suggests (a game, a folder...)
 *   - turn messages off. Also: right-click the blinking tray bubble, or Settings > "Messages from Joe".
 *
 * Sound: plays sounds/uh-oh.mp3 if that file exists (drop one in to use it); otherwise a short
 * synthesized, voice-like "uh-oh!". Follows the tray volume / mute.
 * Test quickly in the browser console: Messenger.deliver()
 * Styles: desktop/css/apps.css ("MESSENGER")
 */
window.Messenger = {
    minMs: 20 * 60 * 1000,                // a new message every 20 to 30 minutes (picked at random each time)
    maxMs: 30 * 60 * 1000,                //   the desktop is open, until the visitor turns them off
    number: '15547384',                   // Joe's "#" shown on every message
    offKey: 'messenger-off',
    nextKey: 'messenger-next',
    soundFile: 'sounds/uh-oh.mp3',
    icon: 'images/icons/apps/messenger.png',

    // What "Joe" says. Keep them short and friendly. `go` = an optional button that opens something.
    MESSAGES: [
        { text: 'Hey there! Thanks for stopping by my portfolio. How are you liking it so far?' },
        { text: 'Psst... have you played any of the quiz games yet? Quiz-Man is my favorite. You can even make your own version with your own questions!',
          go: { label: 'Open the Games folder', run: () => window.FolderApp && FolderApp.open('games') } },
        { text: 'Have you tried the Midnight at the Multiplex demo? It\'s the game I\'m building, set in a 1999 movie theater. I\'d love to hear what you think.',
          go: { label: 'Play the demo', run: () => window.MidnightApp && MidnightApp.open() } },
        { text: 'Quick question: have you opened any of my sample courses? I built them in Rise 360 for real teams, and I\'m always curious which ones people pick.',
          go: { label: 'Open Sample Courses', run: () => window.FolderApp && FolderApp.open('courses') } },
        { text: 'Still here? I really appreciate it! Have you taken Scenemaker for a spin? It\'s the branching-story tool I\'m building for training.',
          go: { label: 'Launch Scenemaker', run: () => window.SceneMakerApp && SceneMakerApp.open() } },
        { text: 'If you know someone who\'s looking for an instructional designer, I\'d be grateful if you passed this site along.',
          go: { label: 'Share this site', run: () => window.SiteShare && SiteShare.open() } },
        { text: 'Fun fact: this whole desktop is hand-built. Have you peeked at the Tools drawer on the right, or tried DoodleTop yet?' },
        { text: 'How\'s the experience been overall? Anything confusing, broken, or delightful? Reply right here and it comes straight to me.' },
        { text: 'Have you checked out my resume yet? It\'s got the numbers behind the fun stuff.',
          go: { label: 'Open my resume', run: () => window.Browser && Browser.openPage('resume.html') } },
        { text: 'You\'ve been here a while, so I have to ask: did anything make you smile? (The screensaver\'s corner hits count!)' }
    ],

    queue: [],                             // unread messages waiting in the tray, oldest first

    isOff() { try { return localStorage.getItem(this.offKey) === 'true'; } catch (e) { return false; } },
    setOff(off) {
        try { off ? localStorage.setItem(this.offKey, 'true') : localStorage.removeItem(this.offKey); } catch (e) {}
        if (off) { this.queue = []; this.showTray(false); }
    },

    init() {
        const wait = () => this.minMs + Math.random() * (this.maxMs - this.minMs);
        this.due = Date.now() + wait();
        // Checked every 20 s (timers in background tabs are slowed down, so we compare clock time)
        setInterval(() => {
            if (Date.now() >= this.due) { this.due = Date.now() + wait(); this.deliver(); }
        }, 20000);
    },

    /** A new message arrives and joins the queue (skipped when messages are turned off). */
    deliver() {
        if (this.isOff()) return;
        let i = 0;
        try { i = (parseInt(localStorage.getItem(this.nextKey), 10) || 0) % this.MESSAGES.length; localStorage.setItem(this.nextKey, i + 1); } catch (e) {}
        this.queue.push({ msg: this.MESSAGES[i], at: new Date() });
        this.showTray(true);
        this.updateNext();                    // an open message window offers the new one with "Next message"
        this.chime();
    },

    /** The blinking speech bubble in the system tray (added next to the clock only while a message waits). */
    showTray(on) {
        let btn = document.getElementById('tray-msg');
        if (!on) { if (btn) btn.remove(); if (window.TaskBricks) TaskBricks.updateLayout(); return; }
        if (!btn) {
            const tray = document.getElementById('system-tray');
            if (!tray) return;
            btn = document.createElement('button');
            btn.type = 'button'; btn.id = 'tray-msg';
            btn.title = 'New message from Joe! Click to read it (right-click for options)';
            btn.setAttribute('aria-label', 'New message from Joe');
            btn.innerHTML = `<img src="${this.icon}" alt="">`;
            tray.insertBefore(btn, tray.firstChild);
            btn.addEventListener('mousedown', (e) => e.stopPropagation());   // not a taskbrick drag
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.read(); });
            btn.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); this.trayMenu(e.clientX, e.clientY); });
            if (window.TaskBricks) TaskBricks.updateLayout();
        }
        // more than one waiting: a little count on the bubble, like an old-school messenger
        const n = this.queue.length;
        let badge = btn.querySelector('.im-badge');
        if (n > 1) {
            if (!badge) { badge = document.createElement('span'); badge.className = 'im-badge'; btn.appendChild(badge); }
            badge.textContent = n;
        } else if (badge) badge.remove();
        btn.title = n > 1 ? `${n} new messages from Joe! Click to read them one at a time (right-click for options)`
                          : 'New message from Joe! Click to read it (right-click for options)';
        btn.setAttribute('aria-label', n > 1 ? `${n} new messages from Joe` : 'New message from Joe');
    },

    /** The open message window's "Next message" row: shown while more messages are waiting. */
    updateNext() {
        const win = typeof WM !== 'undefined' && WM.windows.messenger;
        const row = win && win.querySelector('.im-next');
        if (!row) return;
        const n = this.queue.length;
        row.hidden = !n;
        row.querySelector('.im-next-count').textContent = n === 1 ? '1 more message waiting' : n + ' more messages waiting';
    },

    /** Right-click menu on the blinking bubble. */
    trayMenu(x, y) {
        document.querySelectorAll('.im-menu').forEach(m => m.remove());
        const m = document.createElement('div');
        m.className = 'im-menu bevel-out';
        m.innerHTML = `<button type="button" data-a="read"><b>Read message</b></button>
                       <button type="button" data-a="off">Turn off messages</button>`;
        document.body.appendChild(m);
        m.style.left = Math.min(x, window.innerWidth - m.offsetWidth - 4) + 'px';
        m.style.top = Math.max(4, y - m.offsetHeight - 4) + 'px';
        const close = () => { m.remove(); document.removeEventListener('pointerdown', away, true); };
        const away = (e) => { if (!m.contains(e.target)) close(); };
        setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
        m.onclick = (e) => {
            const a = e.target.closest('[data-a]'); if (!a) return;
            close();
            if (a.dataset.a === 'read') this.read();
            else { this.setOff(true); if (window.SiteShare) SiteShare.toast('Messages turned off. Turn them back on in Settings.'); }
        };
    },

    /** Open the waiting message in its own "Incoming Message" window. */
    read() {
        const p = this.queue.shift();
        if (!p) return;
        this.showTray(this.queue.length > 0);
        if (typeof WM !== 'undefined' && WM.windows.messenger) WM.close('messenger');   // one message window at a time
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const date = p.at.toLocaleDateString(), time = p.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const field = (label, value, cls) => `<label class="im-f ${cls || ''}"><span>${label}</span><input class="bevel-in" readonly value="${esc(value)}" tabindex="-1"></label>`;
        const html = `
            <div class="im">
                <!-- INCOMING -->
                <div class="im-view im-in">
                    <div class="im-who">
                        <img class="im-pic" src="images/icons/apple-touch-icon.png" alt="">
                        <div class="im-fields">
                            ${field('Nickname', 'Joe', 'short')}${field('#', Messenger.number, 'short')}
                            ${field('Name', 'Joe VanWagner')}
                        </div>
                        <span class="im-status" title="Online"><i></i>Online</span>
                    </div>
                    <div class="im-when">${field('Date', date, 'short')}${field('Time', time, 'short')}</div>
                    <div class="im-body bevel-in">
                        <p>${esc(p.msg.text)}</p>
                        ${p.msg.go ? `<button type="button" class="im-link">${esc(p.msg.go.label)} &raquo;</button>` : ''}
                    </div>
                    <div class="im-btns">
                        <button type="button" class="bevel-out im-reply" title="Write back to Joe"><u>R</u>eply</button>
                        <button type="button" class="bevel-out im-email" title="Write to Joe from your own email app">E-mail</button>
                        <button type="button" class="bevel-out im-share" title="Share this portfolio">Share</button>
                        <button type="button" class="bevel-out im-close"><u>C</u>lose</button>
                    </div>
                    <div class="im-next" hidden><span class="im-next-count"></span>
                        <button type="button" class="bevel-out im-next-btn" title="Read the next waiting message"><u>N</u>ext message &raquo;</button></div>
                    <label class="im-off" title="You can turn them back on in Settings"><input type="checkbox"> Don't send me any more messages</label>
                </div>
                <!-- SEND (reply) -->
                <div class="im-view im-out" hidden>
                    <div class="im-who">
                        <img class="im-pic" src="images/icons/apple-touch-icon.png" alt="">
                        <div class="im-fields">${field('To', 'Joe', 'short')}${field('#', Messenger.number, 'short')}
                            <label class="im-f"><span>Your e-mail</span><input type="email" class="bevel-in im-from" maxlength="120" placeholder="optional, if you'd like a reply"></label>
                        </div>
                    </div>
                    <div class="im-quote">&gt; ${esc(p.msg.text)}</div>
                    <textarea class="bevel-in im-text" maxlength="450" placeholder="Enter your message here..."></textarea>
                    <div class="im-count">0 / 450</div>
                    <div class="im-btns">
                        <button type="button" class="bevel-out im-send"><b><u>S</u>end</b></button>
                        <button type="button" class="bevel-out im-cancel">Cancel</button>
                    </div>
                </div>
                <p class="im-status-line" role="status"></p>
            </div>`;
        WM.open('messenger', 'Incoming Message From Joe', html, this.icon, { width: 400, height: 430, center: true });
        const win = WM.windows.messenger;
        if (!win) return;
        const $ = (s) => win.querySelector(s);
        const status = $('.im-status-line');
        const title = win.querySelector('.title-label span');
        // Size the window to what's in it (the incoming view is short; the reply view has a text box).
        // Keeps the window's center where it was, and never grows past the screen.
        const fit = () => {
            if (win.classList.contains('maximized')) return;
            const im = $('.im');
            im.style.height = 'auto';
            const chrome = win.offsetHeight - $('.window-content').clientHeight;
            const want = Math.min(Math.ceil(im.scrollHeight + chrome), window.innerHeight - 40);
            im.style.height = '';
            const oldTop = win.offsetTop, oldH = win.offsetHeight;
            win.style.height = want + 'px';
            win.style.top = Math.max(0, Math.round(oldTop + (oldH - want) / 2)) + 'px';
        };
        const show = (out) => {
            $('.im-in').hidden = out; $('.im-out').hidden = !out; status.textContent = '';
            if (title) title.textContent = out ? 'Send Message to Joe' : 'Incoming Message From Joe';
            fit();
            if (out) $('.im-text').focus();
        };
        if ($('.im-link')) $('.im-link').onclick = () => p.msg.go.run();
        $('.im-close').onclick = () => WM.close('messenger');
        $('.im-next-btn').onclick = () => this.read();
        this.updateNext();
        fit(); requestAnimationFrame(fit); setTimeout(fit, 400);   // again after the window's opening animation
        $('.im-reply').onclick = () => show(true);
        $('.im-cancel').onclick = () => show(false);
        $('.im-share').onclick = () => window.SiteShare && SiteShare.open();
        $('.im-email').onclick = () => window.SiteConfig && SiteConfig.openEmail('Hello from your portfolio');
        $('.im-text').oninput = () => { $('.im-count').textContent = $('.im-text').value.length + ' / 450'; };
        $('.im-off input').onchange = (e) => {
            this.setOff(e.target.checked);
            status.textContent = e.target.checked ? 'Okay! No more messages. (Settings can turn them back on.)' : 'Messages are back on.';
        };
        $('.im-send').onclick = () => {
            const text = $('.im-text').value.trim(), from = $('.im-from').value.trim();
            if (!text) { status.textContent = 'Type a message first.'; $('.im-text').focus(); return; }
            const endpoint = window.SiteConfig && SiteConfig.messageEndpoint;
            const body = text + (from ? '\n\nFrom: ' + from : '') + '\n\n(In reply to: "' + p.msg.text + '")';
            if (!endpoint) {                         // no form service set up: use the visitor's email app
                SiteConfig.openEmail('Message from your portfolio', body);
                status.textContent = 'Your e-mail app should open with your message ready to send.';
                return;
            }
            status.textContent = 'Sending...';
            fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ message: text, email: from || undefined, _subject: 'Message from your portfolio', inReplyTo: p.msg.text }) })
                .then(r => { if (!r.ok) throw new Error(); $('.im-text').value = ''; show(false); status.textContent = 'Message sent! Thanks for writing.'; })
                .catch(() => { status.textContent = 'That didn\'t go through. Opening your e-mail app instead...'; SiteConfig.openEmail('Message from your portfolio', body); });
        };
    },

    /** "Uh-oh!": the sound file if there is one, otherwise a two-note synthesized chirp. */
    chime() {
        const vol = window.SiteVolume ? SiteVolume.effective() : 1;
        if (!vol) return;
        let played = false;
        // A voice-like "uh-oh!": a buzzy source shaped by two vowel "formant" filters, "uh" then "oh",
        // at a high, cartoonish pitch that jumps up and then drops
        const synth = () => {
            if (played) return; played = true;
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const t0 = ctx.currentTime + 0.02;
                const syllable = (start, len, pitch, pitchEnd, formants) => {
                    const src = ctx.createOscillator(); src.type = 'sawtooth';
                    src.frequency.setValueAtTime(pitch, t0 + start);
                    src.frequency.exponentialRampToValueAtTime(pitchEnd, t0 + start + len);
                    const out = ctx.createGain();
                    out.gain.setValueAtTime(0.0001, t0 + start);
                    out.gain.exponentialRampToValueAtTime(0.9 * vol, t0 + start + 0.025);
                    out.gain.setValueAtTime(0.9 * vol, t0 + start + len * 0.6);
                    out.gain.exponentialRampToValueAtTime(0.0001, t0 + start + len);
                    formants.forEach(([f, q, g]) => {
                        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
                        const fg = ctx.createGain(); fg.gain.value = g;
                        src.connect(bp); bp.connect(fg); fg.connect(out);
                    });
                    out.connect(ctx.destination);
                    src.start(t0 + start); src.stop(t0 + start + len + 0.03);
                };
                syllable(0, 0.16, 520, 600, [[700, 6, 0.9], [1250, 8, 0.45], [2600, 10, 0.15]]);    // "uh"
                syllable(0.2, 0.34, 640, 400, [[520, 6, 1.0], [880, 8, 0.5], [2400, 10, 0.1]]);     // "oh!"
                setTimeout(() => ctx.close(), 1000);
            } catch (e) {}
        };
        try {
            const a = new Audio(this.soundFile);
            a.volume = vol;
            a.onerror = synth;
            a.play().then(() => { played = true; }).catch(synth);
        } catch (e) { synth(); }
    }
};
document.addEventListener('DOMContentLoaded', () => Messenger.init());
