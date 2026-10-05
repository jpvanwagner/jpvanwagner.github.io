/**
 * STARTUP.JS - The boot sequence: fake BIOS text, then a splash with the logo and OS name.
 * Short on purpose (under 2 seconds). Plays on every visit to the desktop by default; the
 * visitor can change that in Settings (OSSettings key "boot": 'always' | 'session' | 'off').
 * Reduced-motion users get it without fades. Any click or key skips it.
 * When done it opens the NetCrawler browser on ?page=... (or home) and shows the welcome tip.
 *
 * Quick reference: init -> startSequence -> runBIOS -> runWin95Splash -> finishStartup
 * Loaded in <head> so it can cover the screen before the desktop draws. Styles: desktop/css/effects.css
 */
const StartupSequence = {
    init() {
        const checkExist = setInterval(() => {
            const desktop = document.getElementById('desktop');
            const bricks = document.getElementById('brick-layer');

            if (desktop && bricks) {
                clearInterval(checkExist);
                this.startSequence();
            }
        }, 50);
    },

    startSequence() {
        // Boot preference (set in Settings): 'always' (default), 'session' (once per tab), or 'off'.
        // Read straight from storage because the settings module loads after this file.
        let pref = 'always', booted = false;
        try {
            pref = (JSON.parse(localStorage.getItem('os-settings') || '{}').boot) || 'always';
            booted = sessionStorage.getItem('hasBooted') === 'true';
        } catch (e) {}
        const skipBoot = pref === 'off' || (pref === 'session' && booted);
        if (skipBoot) {
            this.finishStartup();
            return;
        }
        // "Reduce motion" (a common Windows/Mac setting) still gets the boot screen, just without
        // the fades, so a refresh always shows it (it's under 2 seconds and any click skips it)
        this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Warm the browser's cache with the home page while the BIOS text runs, so NetCrawler
        // shows it the moment it opens
        ['pages/home.html', 'pages/css/classic.css', 'pages/js/classic.js'].forEach(href => {
            const l = document.createElement('link');
            l.rel = 'prefetch'; l.href = href;
            document.head.appendChild(l);
        });

        document.body.classList.add('system-busy');
        this.setOSOpacity(0);

        this.container = document.createElement('div');
        this.container.id = 'startup-screen';
        

        Object.assign(this.container.style, {
            position: 'fixed',
            top: '0', left: '0',
            width: '100vw', height: '100vh',
            backgroundColor: 'black',
            color: '#c0c0c0',
            fontFamily: 'monospace',
            fontSize: '14px',
            zIndex: '100000',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            padding: '20px',
            boxSizing: 'border-box',
            cursor: 'pointer'
        });

        // Any click or key skips straight to the desktop
        this.skip = () => this.finishStartup();
        this.container.addEventListener('click', this.skip);
        document.addEventListener('keydown', this.skip);

        const hint = document.createElement('div');
        hint.textContent = 'Click or press any key to skip';
        Object.assign(hint.style, { position: 'absolute', bottom: '12px', right: '16px', opacity: '0.6', zIndex: '3', fontSize: '12px' });
        this.hint = hint;
        
        this.container.classList.add('crt-boot-active');
        document.body.appendChild(this.container);

        this.runBIOS();
    },

    setOSOpacity(val) {
        const desktop = document.getElementById('desktop');
        const bricks = document.getElementById('brick-layer');
        if (desktop) desktop.style.opacity = val;
        if (bricks) bricks.style.opacity = val;
    },

    runBIOS() {
        const biosLines = [
            "Award Modular BIOS v4.51PG, An Energy Star Ally",
            "Copyright (C) 1984-95, Award Software, Inc.",
            "",
            (window.SiteConfig ? SiteConfig.osName.toUpperCase() + " V" + SiteConfig.osVersion : "PORTFOLIO OS"),
            "",
            "Main Processor : Pentium(r) 75MHz",
            "Math Processor : Built-In",
            "Floppy Drive A : 1.44M, 3.5 in.",
            "Floppy Drive B : None",
            "",
            "Starting MS-DOS...",
            ""
        ];
        // 1 or 2 nerdy one-liners, picked at random each boot, slipped in just before "Starting MS-DOS..."
        const quips = [
            "Reticulating splines...", "Blowing on the cartridge...", "Rewinding VHS tapes (be kind)...",
            "Warming up the CRT...", "Defragmenting the floppy...", "Untangling the phone cord...",
            "Adjusting the rabbit ears...", "Feeding the Tamagotchi...", "Negotiating with the modem...",
            "Consulting the Magic 8-Ball...", "Loading the loading screen...", "Calibrating the flux capacitor...",
            "Checking 640K (ought to be enough for anybody)...", "Charging the lightsaber batteries...",
            "Counting sheep (electric)...", "Polishing the pixels..."
        ];
        const pick = quips.slice().sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.5 ? 1 : 2);
        biosLines.splice(biosLines.indexOf("Starting MS-DOS..."), 0, ...pick);

        this.container.appendChild(this.hint);
        let lineIndex = 0;
        const printInterval = setInterval(() => {
            if (this.done) { clearInterval(printInterval); return; }
            if (lineIndex < biosLines.length) {
                const line = document.createElement('div');
                line.textContent = biosLines[lineIndex];
                this.container.appendChild(line);
                lineIndex++;
            } else {
                clearInterval(printInterval);
                setTimeout(() => { if (!this.done) this.runWin95Splash(); }, 350);   // a beat to read the one-liners
            }
        }, 550 / biosLines.length);   // whole BIOS screen: about 0.6 s
    },

    runWin95Splash() {
        this.container.innerHTML = '';
        this.container.style.padding = '0';
        this.container.style.justifyContent = 'center';
        this.container.style.alignItems = 'center';
        this.container.style.backgroundColor = 'transparent';

        const cloudBg = document.createElement('div');
        Object.assign(cloudBg.style, {
            position: 'absolute',
            top: '0', left: '0',
            width: '100%', height: '100%',
            backgroundColor: 'black',
            backgroundImage: "url('images/wallpapers/clouds.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: this.reduced ? 'none' : 'opacity 0.8s ease-in-out',
            zIndex: '1'
        });
        this.container.appendChild(cloudBg);

        const bannerGraphic = document.createElement('div');
        bannerGraphic.innerHTML = `
            <img src="images/icons/logo.svg" style="width:96px; height:96px; image-rendering:pixelated; display:block; margin:0 auto 16px;">
            <div style="font-family:'Press Start 2P', monospace; font-size:clamp(18px, 4vw, 36px); color:#fff; letter-spacing:2px;">${window.SiteConfig ? SiteConfig.osName : 'Portfolio OS'}</div>
            <div style="font-family:Verdana, sans-serif; font-size:14px; color:#fff; margin-top:10px;">${window.SiteConfig ? SiteConfig.ownerName : ''}</div>`;
        Object.assign(bannerGraphic.style, {
            position: 'relative',
            zIndex: '2',
            textAlign: 'center',
            filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,1))',
            transition: this.reduced ? 'none' : 'opacity 0.3s ease-in-out'
        });
        this.container.appendChild(bannerGraphic);

        this.setOSOpacity(1);

        // Splash: about 1.2 s, so the whole boot stays under 2 seconds
        setTimeout(() => { cloudBg.style.opacity = '0'; }, 50);
        setTimeout(() => { bannerGraphic.style.opacity = '0'; }, 900);
        // Open NetCrawler on the home page partway through the splash (as the clouds clear), so
        // the page is already loaded by the time the boot screen goes away
        setTimeout(() => { if (!this.done) this.openHome(); }, 450);

        this.container.appendChild(this.hint);
        setTimeout(() => this.finishStartup(), 1200);
    },

    finishStartup() {
        if (this.done) return;
        this.done = true;
        if (this.container) this.container.remove();
        if (this.skip) document.removeEventListener('keydown', this.skip);

        try { sessionStorage.setItem('hasBooted', 'true'); } catch (e) {}
        document.body.classList.remove('system-busy');
        this.setOSOpacity(1);

        this.openHome();
        const welcome = () => { if (window.ViewMode) window.ViewMode.showWelcome(); };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(welcome, 0));
        else welcome();
    },

    /** Open the browser on the requested page (?page=about.html) or the home page; only once. */
    openHome() {
        if (this.homeOpened) return;
        const go = () => {
            if (this.homeOpened) return;
            if (!(window.Browser && typeof window.Browser.openPage === 'function')) return;
            this.homeOpened = true;
            // ?page=about or ?page=about.html (links avoid ending in ".html"; see pages/js/classic.js)
            const page = (new URLSearchParams(location.search).get('page') || '').replace(/\.html$/i, '') + '.html';
            window.Browser.openPage(/^[\w-]+\.html$/.test(page) ? page : 'home.html');
        };
        // The desktop scripts load after this file, so wait for them if needed
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(go, 0));
        else go();
    }
};

StartupSequence.init();